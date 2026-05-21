import os
import re
import json
import time
import signal
import shutil
import subprocess
import base64
import zlib
from pathlib import Path
from urllib.parse import quote

try:
    import decky_plugin
except Exception:
    decky_plugin = None


VERSION = "0.3.alfa"

GAMESCOPE_SESSION = Path("/usr/lib/steamos/gamescope-session")
BACKUP_ORIGINAL = Path("/usr/lib/steamos/gamescope-session.egpubridge-original")
BACKUP_LAST = Path("/usr/lib/steamos/gamescope-session.egpubridge-last")
LEGACY_BACKUP = Path("/usr/lib/steamos/gamescope-session.bak-egpu")

# eGPUBridge 0.2.00 safe wrapper config.
# Do NOT patch /usr/lib/steamos/gamescope-session for normal display switching.
PLUGIN_DIR = Path("/home/deck/homebrew/plugins/eGPUBridge")
LOG_PATH = PLUGIN_DIR / "plugin.log"
STATUS_PATH = PLUGIN_DIR / "last_status.json"
OUTPUT_ORDER_CONF = PLUGIN_DIR / "output_order.conf"
PREFER_VK_DEVICE_CONF = PLUGIN_DIR / "prefer_vk_device.conf"
GAMESCOPE_MODE_CONF = PLUGIN_DIR / "gamescope_mode.conf"

ENV_OVERRIDE = Path("/home/deck/.config/environment.d/99-egpubridge.conf")

# Vendor branching infrastructure
VENDOR_FILE = Path("/home/deck/.config/egpubridge/vendor")
PROGRESS_FILE = PLUGIN_DIR / "operation_progress.json"
PCI_VENDOR_AMD = "0x1002"
PCI_VENDOR_NVIDIA = "0x10de"
PCI_VENDOR_INTEL = "0x8086"
_operation_lock = None


def _read_vendor() -> str:
    try:
        v = VENDOR_FILE.read_text().strip().lower()
        if v in ("amd", "nvidia", "auto"):
            return v
    except Exception:
        pass
    return "auto"


def _write_vendor(vendor: str):
    VENDOR_FILE.parent.mkdir(parents=True, exist_ok=True)
    VENDOR_FILE.write_text(vendor.strip().lower() + "\n")


def _detect_vendor_from_pci() -> str:
    for card in sorted(Path("/sys/class/drm").glob("card[0-9]*")):
        device = card / "device"
        if not device.exists():
            continue
        boot_vga = ""
        vendor = ""
        try:
            boot_vga = (device / "boot_vga").read_text(errors="ignore").strip()
            vendor = (device / "vendor").read_text(errors="ignore").strip().lower()
        except Exception:
            continue
        if boot_vga == "1":
            continue
        if vendor == PCI_VENDOR_NVIDIA:
            return "nvidia"
        if vendor == PCI_VENDOR_AMD:
            return "amd"
    return "amd"


def get_active_vendor() -> str:
    v = _read_vendor()
    if v == "auto":
        return _detect_vendor_from_pci()
    return v


def _query_nvidia_smi() -> dict:
    result = {"available": False, "name": None, "temp_c": None, "mem_used_mb": None, "mem_total_mb": None, "power_w": None}
    try:
        r = run(["/usr/bin/nvidia-smi", "--query-gpu=name,temperature.gpu,memory.used,memory.total,power.default_limit", "--format=csv,noheader,nounits"], timeout=5)
        if r.get("rc") != 0:
            return result
        parts = [x.strip() for x in r.get("out", "").split(",")]
        if len(parts) >= 5:
            result["available"] = True
            result["name"] = parts[0]
            result["temp_c"] = float(parts[1]) if parts[1] not in ("[N/A]", "") else None
            result["mem_used_mb"] = float(parts[2]) if parts[2] not in ("[N/A]", "") else None
            result["mem_total_mb"] = float(parts[3]) if parts[3] not in ("[N/A]", "") else None
            result["power_w"] = float(parts[4]) if parts[4] not in ("[N/A]", "") else None
    except Exception:
        pass
    return result


def _write_progress(stage: str, percent: int, message: str):
    try:
        data = {"stage": stage, "percent": percent, "message": message, "timestamp": int(time.time())}
        PROGRESS_FILE.write_text(json.dumps(data) + "\n")
    except Exception:
        pass


def _read_progress() -> dict:
    try:
        return json.loads(PROGRESS_FILE.read_text())
    except Exception:
        return {"stage": "idle", "percent": 0, "message": ""}


def _begin_operation(name: str) -> bool:
    global _operation_lock
    if _operation_lock is not None:
        return False
    _operation_lock = name
    return True


def _end_operation():
    global _operation_lock
    _operation_lock = None


DEFAULT_WIDTH = 1920
DEFAULT_HEIGHT = 1080
DEFAULT_REFRESH = 60

# Device hint database — labels only, never used for routing.
DEVICE_HINTS = {
    ("ASUSTeK COMPUTER INC.", "RC71L"): "ASUS ROG Ally",
    ("ASUSTeK COMPUTER INC.", "RC72LA"): "ASUS ROG Ally X",
    ("ASUSTeK COMPUTER INC.", "RC72L"): "ASUS ROG Ally X",
    ("LENOVO", "Legion Go 8APU1"): "Lenovo Legion Go",
    ("LENOVO", "Legion Go S 8APU1"): "Lenovo Legion Go S",
    ("LENOVO", "Legion Go S 8ARP1"): "Lenovo Legion Go S",
    ("Valve", "Jupiter"): "Steam Deck",
    ("Valve", "Galileo"): "Steam Deck OLED",
    ("Valve", "Valve Jupiter"): "Steam Deck",
    ("Valve", "Valve Galileo"): "Steam Deck OLED",
}


def detect_device_hint():
    vendor = _read_text("/sys/devices/virtual/dmi/id/sys_vendor")
    product = _read_text("/sys/devices/virtual/dmi/id/product_name")
    if not vendor or not product:
        return None
    friendly = DEVICE_HINTS.get((vendor, product))
    if not friendly:
        for (v, p), label in DEVICE_HINTS.items():
            if v == vendor and product.startswith(p.split()[0]):
                friendly = label
                break
    return {
        "vendor": vendor,
        "product_name": product,
        "friendly_name": friendly or (vendor + " " + product),
        "known": friendly is not None,
        "source": "dmi",
    }


def detect_drm_driver(card_path=None):
    """Detect DRM driver name from sysfs. Falls back to 'unknown'."""
    if card_path:
        link = Path(card_path) / "device" / "driver"
        if link.exists():
            try:
                return link.resolve().name
            except Exception:
                pass
    # Fallback: scan all cards for first non-vgem driver
    for card in sorted(Path("/sys/class/drm").glob("card[0-9]*")):
        link = card / "device" / "driver"
        if link.exists():
            try:
                name = link.resolve().name
                if name not in ("vgem", "ast"):
                    return name
            except Exception:
                pass
    return "unknown"


def find_internal_display_card():
    """Find the card and eDP connector for the internal display.
    Returns (card_name, connector_name, sysfs_path) or ("card0", "eDP-1", None) as fallback."""
    for card in sorted(Path("/sys/class/drm").glob("card[0-9]*")):
        for conn in sorted(card.glob("*-eDP-*")):
            status_file = conn / "status"
            if status_file.exists():
                try:
                    status = status_file.read_text(errors="ignore").strip()
                    if status == "connected":
                        card_name = card.name  # "card0", "card2", etc.
                        conn_name = conn.name.split("-", 1)[1] if "-" in conn.name else "eDP-1"
                        return card_name, conn_name, str(conn)
                except Exception:
                    pass
    # Fallback: try any eDP connector
    for card in sorted(Path("/sys/class/drm").glob("card[0-9]*")):
        for conn in card.glob("*-eDP-*"):
            card_name = card.name
            conn_name = conn.name.split("-", 1)[1] if "-" in conn.name else "eDP-1"
            return card_name, conn_name, str(conn)
    return "card0", "eDP-1", None


def rotate_log_if_needed():
    try:
        max_bytes = 2 * 1024 * 1024
        keep_bytes = 700 * 1024
        if LOG_PATH.exists() and LOG_PATH.stat().st_size > max_bytes:
            data = LOG_PATH.read_bytes()
            LOG_PATH.with_suffix(".log.1").write_bytes(data[-keep_bytes:])
            LOG_PATH.write_text(
                f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] log rotated by eGPUBridge {VERSION}\\n",
                encoding="utf-8",
            )
    except Exception:
        pass


def log(msg: str):
    try:
        PLUGIN_DIR.mkdir(parents=True, exist_ok=True)
        rotate_log_if_needed()
        msg = str(msg)
        if len(msg) > 3500:
            msg = msg[:3500] + "... <truncated>"
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}\\n")
    except Exception:
        pass

def _compact_log_text(text: str, limit: int = 900) -> str:
    """
    v0.7.11:
    Keep plugin.log small.
    Heavy commands like modetest/debugfs may return thousands of lines.
    We keep only useful summary lines and hard-limit the final string.
    """
    text = str(text or "")
    if not text:
        return ""

    useful = []
    keywords = (
        "connected",
        "disconnected",
        "HDMI",
        "DP-",
        "eDP",
        "mode:",
        "3840x2160",
        "2560x1440",
        "1920x1080",
        "1280x720",
        "GT/s",
        "Width",
        "Speed",
        "error",
        "failed",
        "unauthorized",
        "offline",
        "awake",
        "asleep",
        "state=",
        "mWakefulness",
        "Display Power",
    )

    for line in text.splitlines():
        if any(k.lower() in line.lower() for k in keywords):
            useful.append(line.strip())
        if len(useful) >= 28:
            break

    compact = "\n".join(useful) if useful else text[:limit]
    if len(compact) > limit:
        compact = compact[:limit] + "...[truncated]"
    return compact.replace("\x00", "")



def _is_quiet_status_cmd(cmd) -> bool:
    """
    Avoid plugin.log spam from frequent background status polling.
    These commands are still logged when they fail.
    """
    try:
        if cmd and str(cmd[0]) == "/usr/bin/ping":
            return True
        s = " ".join(map(str, cmd))
    except Exception:
        return False

    quiet_parts = [
        "/usr/bin/lspci -s",
        "/usr/bin/pgrep -naf",
        f"/usr/bin/modetest -M {detect_drm_driver()}",
        "/usr/bin/cat /sys/kernel/debug/dri/",
    ]
    return any(x in s for x in quiet_parts)





def run(cmd, timeout=12):
    # EGPUBRIDGE_QUIET_PING_V0726
    # TV network probe must never flood plugin.log when Wi-Fi/TV is unavailable.
    try:
        if cmd and str(cmd[0]) == "/usr/bin/ping":
            cp = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
            return {
                "ok": cp.returncode == 0,
                "rc": cp.returncode,
                "out": cp.stdout or "",
                "err": cp.stderr or "",
                "cmd": cmd,
            }
    except Exception as e:
        return {
            "ok": False,
            "rc": -1,
            "out": "",
            "err": str(e),
            "cmd": cmd,
        }

    quiet = _is_quiet_status_cmd(cmd)

    if not quiet:
        log("RUN: " + " ".join(map(str, cmd)))

    try:
        p = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout,
        )
        out = (p.stdout or "").strip()
        err = (p.stderr or "").strip()

        if (not quiet) or p.returncode != 0:
            try:
                log(f"RC={p.returncode} OUT={_compact_log_text(out, 900)} ERR={_compact_log_text(err, 900)}")
            except Exception:
                log(f"RC={p.returncode} OUT={out[:900]} ERR={err[:900]}")

        return {
            "ok": p.returncode == 0,
            "rc": p.returncode,
            "out": out,
            "err": err,
            "cmd": cmd,
        }
    except Exception as e:
        log(f"EXC running {cmd}: {e}")
        return {
            "ok": False,
            "rc": -1,
            "out": "",
            "err": str(e),
            "cmd": cmd,
        }


class _TimeoutError(Exception):
    pass


class plugin_timeout:
    """SIGALRM-based hard timeout context manager.
    Kills truly stuck processes that ignore subprocess timeout.
    Only works on the main thread — for executor threads use subprocess.run(timeout=N)."""
    @staticmethod
    def time_limit(seconds: int):
        class _CM:
            def __init__(self, s):
                self.s = s
            def __enter__(self):
                def _handler(signum, frame):
                    raise _TimeoutError(f"Operation timed out after {self.s}s")
                self.old = signal.signal(signal.SIGALRM, _handler)
                signal.alarm(self.s)
                return self
            def __exit__(self, *args):
                signal.alarm(0)
                if self.old:
                    signal.signal(signal.SIGALRM, self.old)
                return False
        return _CM(seconds)


def _shell_quote(s: str) -> str:
    """Single-quote a string for safe shell embedding."""
    return "'" + s.replace("'", "'\\''") + "'"


def _run(cmd: str, timeout: int = 30, sudo: bool = False):
    """Shell-string command runner returning (rc, stdout) tuple.
    Unlike run() which takes a list, _run() takes a shell string
    (may contain pipes, redirects, semicolons) and returns a simple
    (returncode, stdout) tuple. Based on xg-mobile-linux pattern."""
    try:
        if sudo:
            cmd = f"/usr/bin/sudo sh -c {_shell_quote(cmd)}"
        log(f"_RUN: {cmd[:200]}")
        p = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        out = (p.stdout or "").strip()
        if p.returncode != 0:
            err = (p.stderr or "").strip()
            log(f"_RUN RC={p.returncode} OUT={out[:500]} ERR={err[:500]}")
        return (p.returncode, out)
    except subprocess.TimeoutExpired:
        log(f"_RUN TIMEOUT after {timeout}s: {cmd[:200]}")
        return (-1, f"timeout after {timeout}s")
    except Exception as e:
        log(f"_RUN EXC: {e} cmd={cmd[:200]}")
        return (-1, str(e))


def _run_user(cmd: str, timeout: int = 10) -> tuple:
    """Shell-string command runner WITHOUT sudo. For status checks, queries."""
    return _run(cmd, timeout=timeout, sudo=False)


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""


def write_text(path: Path, text: str):
    path.write_text(text, encoding="utf-8")


def atomic_write(path: Path, text: str):
    tmp = path.with_suffix(path.suffix + ".tmp-egpubridge")
    write_text(tmp, text)
    os.replace(tmp, path)


def safe_backup_original():
    """
    Сохраняет оригинальный gamescope-session.
    Если уже есть старый ручной backup bak-egpu, используем его как эталон.
    """
    if BACKUP_ORIGINAL.exists():
        return str(BACKUP_ORIGINAL)

    if LEGACY_BACKUP.exists():
        shutil.copy2(LEGACY_BACKUP, BACKUP_ORIGINAL)
        log(f"backup original from legacy {LEGACY_BACKUP} -> {BACKUP_ORIGINAL}")
        return str(BACKUP_ORIGINAL)

    if GAMESCOPE_SESSION.exists():
        shutil.copy2(GAMESCOPE_SESSION, BACKUP_ORIGINAL)
        log(f"backup original from current {GAMESCOPE_SESSION} -> {BACKUP_ORIGINAL}")
        return str(BACKUP_ORIGINAL)

    raise FileNotFoundError(str(GAMESCOPE_SESSION))


def get_drm_card_info(card: str):
    card_path = Path("/sys/class/drm") / card
    dev_link = card_path / "device"
    real = ""
    pci = ""
    vendor = ""
    device = ""
    boot_vga = ""

    try:
        real = os.path.realpath(dev_link)
        matches = re.findall(r"([0-9a-fA-F]{4}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}\.[0-9])", real)
        pci = matches[-1] if matches else ""
    except Exception:
        pass

    try:
        vendor = read_text(dev_link / "vendor").strip()
    except Exception:
        pass

    try:
        device = read_text(dev_link / "device").strip()
    except Exception:
        pass

    try:
        boot_vga = read_text(dev_link / "boot_vga").strip()
    except Exception:
        pass

    lspci = ""
    if pci:
        lspci = run(["/usr/bin/lspci", "-s", pci], timeout=4).get("out", "")

    connectors = []
    for p in sorted(Path("/sys/class/drm").glob(f"{card}-*")):
        name = p.name.replace(f"{card}-", "", 1)
        if name.startswith("Writeback"):
            continue
        status = read_text(p / "status").strip()
        enabled = read_text(p / "enabled").strip()
        modes = [x.strip() for x in read_text(p / "modes").splitlines() if x.strip()]
        connectors.append({
            "name": name,
            "full_name": p.name,
            "status": status,
            "enabled": enabled,
            "modes": modes,
        })

    return {
        "card": card,
        "path": f"/dev/dri/{card}",
        "pci": pci,
        "vendor": vendor,
        "device": device,
        "boot_vga": boot_vga,
        "lspci": lspci,
        "is_amd": vendor.lower() == "0x1002",
        "is_internal": boot_vga == "1",
        "is_egpu": boot_vga != "1",
        "connectors": connectors,
    }


def scan_cards():
    cards = []
    for p in sorted(Path("/sys/class/drm").glob("card[0-9]")):
        if p.name.startswith("card"):
            cards.append(get_drm_card_info(p.name))
    return cards


def pick_egpu(cards):
    external = [
        c for c in cards
        if c.get("is_egpu") and Path(c.get("path", "")).exists()
    ]
    if not external:
        return None
    for c in external:
        for conn in c.get("connectors", []):
            if conn.get("status") == "connected":
                return c
    return external[0]


def pick_connector(card):
    if not card:
        return None

    connected = [
        c for c in card.get("connectors", [])
        if c.get("status") == "connected"
    ]

    if not connected:
        return None

    # HDMI сначала, потому что твой рабочий кейс именно HDMI-A-1.
    for c in connected:
        if c.get("name", "").startswith("HDMI"):
            return c

    return connected[0]


def current_gamescope_process():
    # Берём самый новый gamescope, иначе status может показывать старый PID.
    r = run(["/usr/bin/pgrep", "-naf", "^gamescope|gamescope --"], timeout=4)
    return r.get("out", "")


def _is_valid_egpu_vk_id(value: str) -> bool:
    """Check if value is a valid PCI vendor:device ID (not 'disabled')."""
    v = str(value or "").strip().lower()
    return bool(v) and v not in ("disabled", "none", "") and bool(re.fullmatch(r"[0-9a-f]{4}:[0-9a-f]{4}", v))


def _has_egpu_vk_in_gamescope(gs_cmdline: str) -> bool:
    """Check if gamescope process has any --prefer-vk-device with a real ID."""
    return bool(re.search(r"--prefer-vk-device\s+[0-9a-fA-F]{4}:[0-9a-fA-F]{4}", gs_cmdline or ""))


def get_current_patch_state():
    """
    eGPUBridge 0.2.00:
    Status comes from wrapper config and current Gamescope process.
    Legacy system-file patch state is kept only as diagnostic information.
    """
    gs = current_gamescope_process()
    output_order = read_text(OUTPUT_ORDER_CONF).strip() if OUTPUT_ORDER_CONF.exists() else ""
    prefer_vk = read_text(PREFER_VK_DEVICE_CONF).strip() if PREFER_VK_DEVICE_CONF.exists() else ""

    legacy_txt = read_text(GAMESCOPE_SESSION)

    return {
        "method": "wrapper-config",
        "output_order": output_order,
        "prefer_vk_device": prefer_vk,
        "has_prefer_vk_9070": (
            _is_valid_egpu_vk_id(prefer_vk)
            or _has_egpu_vk_in_gamescope(gs)
        ),
        "has_prefer_vk_active": (
            _is_valid_egpu_vk_id(prefer_vk)
            or _has_egpu_vk_in_gamescope(gs)
        ),
        "has_1080p60": "-W 1920 -H 1080 -r 60" in gs,
        "prefer_output": [output_order] if output_order else re.findall(r"\s-O\s+([^\n]+)", gs),
        "has_env_override_file": ENV_OVERRIDE.exists(),
        "backup_original_exists": BACKUP_ORIGINAL.exists(),
        "legacy_backup_exists": LEGACY_BACKUP.exists(),
        "legacy_system_file_has_prefer_vk_9070": _has_egpu_vk_in_gamescope(legacy_txt),
    }


def patch_gamescope_session(vendor_device: str, output_name: str, width: int, height: int, refresh: int):
    safe_backup_original()

    if not GAMESCOPE_SESSION.exists():
        raise FileNotFoundError(str(GAMESCOPE_SESSION))

    shutil.copy2(GAMESCOPE_SESSION, BACKUP_LAST)

    txt = read_text(GAMESCOPE_SESSION)

    # Убираем старые вставки eGPUBridge, чтобы патч был идемпотентный.
    txt = re.sub(r"^\s*--prefer-vk-device\s+[0-9a-fA-F]{4}:[0-9a-fA-F]{4}\s*\\\n", "", txt, flags=re.M)
    txt = re.sub(r"^\s*-W\s+\d+\s+-H\s+\d+\s+-r\s+\d+\s*\\\n", "", txt, flags=re.M)

    # Добавляем prefer-vk-device после generate-drm-mode.
    txt = re.sub(
        r"(^\s*--generate-drm-mode\s+fixed\s*\\\n)",
        r"\1        --prefer-vk-device " + vendor_device + r" \\" + "\n",
        txt,
        count=1,
        flags=re.M,
    )

    # Добавляем фиксированный безопасный режим после socket/stats.
    txt = re.sub(
        r'(^\s*-e\s+-R\s+"\$socket"\s+-T\s+"\$stats"\s*\\\n)',
        r"\1        -W " + str(width) + " -H " + str(height) + " -r " + str(refresh) + r" \\" + "\n",
        txt,
        count=1,
        flags=re.M,
    )

    # Меняем output preference.
    # ВАЖНО: replacement через lambda, иначе одинарный trailing backslash ломает re.sub:
    # bad escape (end of pattern)
    txt = re.sub(
        r"^\s*-O\s+.*$",
        lambda _m: f"        -O {output_name} \\",
        txt,
        count=1,
        flags=re.M,
    )

    if "--prefer-vk-device" not in txt:
        raise RuntimeError("Не удалось вставить --prefer-vk-device")
    if f"-O {output_name}" not in txt:
        raise RuntimeError("Не удалось вставить -O output")
    if f"-W {width} -H {height} -r {refresh}" not in txt:
        raise RuntimeError("Не удалось вставить режим вывода")

    atomic_write(GAMESCOPE_SESSION, txt)
    os.chmod(GAMESCOPE_SESSION, 0o755)

    # Старый env override больше не используем.
    try:
        if ENV_OVERRIDE.exists():
            ENV_OVERRIDE.unlink()
    except Exception as e:
        log(f"failed to delete env override: {e}")

    return {
        "ok": True,
        "patched": True,
        "vendor_device": vendor_device,
        "output": output_name,
        "mode": f"{width}x{height}@{refresh}",
        "backup_original": str(BACKUP_ORIGINAL),
        "backup_last": str(BACKUP_LAST),
    }


def restore_gamescope_session():
    src = None
    if BACKUP_ORIGINAL.exists():
        src = BACKUP_ORIGINAL
    elif LEGACY_BACKUP.exists():
        src = LEGACY_BACKUP

    if not src:
        raise FileNotFoundError("Нет backup оригинального gamescope-session")

    shutil.copy2(src, GAMESCOPE_SESSION)
    os.chmod(GAMESCOPE_SESSION, 0o755)

    try:
        if ENV_OVERRIDE.exists():
            ENV_OVERRIDE.unlink()
    except Exception as e:
        log(f"failed to delete env override during restore: {e}")

    return {
        "ok": True,
        "restored_from": str(src),
    }


def restart_sddm():
    clean_env = os.environ.copy()
    for k in ("LD_LIBRARY_PATH", "LD_PRELOAD", "PYTHONHOME", "PYTHONPATH"):
        clean_env.pop(k, None)

    log("RUN CLEAN: /usr/bin/systemctl restart sddm")
    try:
        p = subprocess.run(
            ["sudo", "-n", "/usr/bin/systemctl", "restart", "sddm"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=20,
            env=clean_env,
        )
        out = (p.stdout or "").strip()
        err = (p.stderr or "").strip()
        log(f"RC={p.returncode} OUT={out[:3000]} ERR={err[:3000]}")
        return {
            "ok": p.returncode == 0,
            "rc": p.returncode,
            "out": out,
            "err": err,
            "cmd": ["sudo", "-n", "/usr/bin/systemctl", "restart", "sddm"],
        }
    except Exception as e:
        log(f"EXC clean restart sddm: {e}")
        return {
            "ok": False,
            "rc": -1,
            "out": "",
            "err": str(e),
            "cmd": ["sudo", "-n", "/usr/bin/systemctl", "restart", "sddm"],
        }




def _read_int(path: Path):
    try:
        return int(path.read_text().strip())
    except Exception:
        return None


def _read_label(path: Path, fallback: str) -> str:
    try:
        s = path.read_text(encoding="utf-8", errors="replace").strip()
        return s or fallback
    except Exception:
        return fallback


def collect_card_sensors(card_name: str):
    """
    Collect AMDGPU hwmon telemetry for /sys/class/drm/cardX.
    Values depend on what amdgpu exposes for this GPU.
    """
    result = {
        "ok": False,
        "hwmon_paths": [],
        "temps": [],
        "voltages": [],
        "powers": [],
        "fans": [],
    }

    if not card_name:
        return result

    base = Path("/sys/class/drm") / card_name / "device" / "hwmon"
    if not base.exists():
        result["error"] = f"{base} not found"
        return result

    hwmons = sorted(base.glob("hwmon*"))
    if not hwmons:
        result["error"] = "no hwmon dirs"
        return result

    for hw in hwmons:
        result["hwmon_paths"].append(str(hw))
        name = _read_label(hw / "name", hw.name)

        # Temperatures: millidegrees Celsius.
        for f in sorted(hw.glob("temp*_input")):
            idx = f.name.replace("temp", "").replace("_input", "")
            raw = _read_int(f)
            if raw is None:
                continue
            label = _read_label(hw / f"temp{idx}_label", f"temp{idx}")
            result["temps"].append({
                "name": name,
                "label": label,
                "value_c": round(raw / 1000.0, 1),
                "raw": raw,
            })

        # Voltages: usually millivolts.
        for f in sorted(hw.glob("in*_input")):
            idx = f.name.replace("in", "").replace("_input", "")
            raw = _read_int(f)
            if raw is None:
                continue
            label = _read_label(hw / f"in{idx}_label", f"in{idx}")
            result["voltages"].append({
                "name": name,
                "label": label,
                "value_v": round(raw / 1000.0, 3),
                "raw": raw,
            })

        # Power: usually microwatts.
        for suffix in ["average", "input"]:
            for f in sorted(hw.glob(f"power*_{suffix}")):
                idx = f.name.replace("power", "").replace(f"_{suffix}", "")
                raw = _read_int(f)
                if raw is None:
                    continue
                label = _read_label(hw / f"power{idx}_label", f"power{idx}_{suffix}")
                result["powers"].append({
                    "name": name,
                    "label": label,
                    "kind": suffix,
                    "value_w": round(raw / 1000000.0, 1),
                    "raw": raw,
                })

        # Fan RPM.
        for f in sorted(hw.glob("fan*_input")):
            idx = f.name.replace("fan", "").replace("_input", "")
            raw = _read_int(f)
            if raw is None:
                continue
            label = _read_label(hw / f"fan{idx}_label", f"fan{idx}")
            result["fans"].append({
                "name": name,
                "label": label,
                "rpm": raw,
            })

    result["ok"] = bool(
        result["temps"] or result["voltages"] or result["powers"] or result["fans"]
    )
    return result


def _safe_write_text(path: str, value: str):
    try:
        Path(path).write_text(value)
        return {"ok": True, "path": path, "value": value}
    except Exception as e:
        return {"ok": False, "path": path, "value": value, "error": str(e)}


def find_framebuffer():
    """Find primary framebuffer device. Returns sysfs path like '/sys/class/graphics/fb0'."""
    for fb in sorted(Path("/sys/class/graphics").glob("fb*")):
        return str(fb)
    return "/sys/class/graphics/fb0"


def find_framebuffer_console():
    """Find vtconsole bound to framebuffer (fbcon). Returns sysfs path like '/sys/class/vtconsole/vtcon1'."""
    for vt in sorted(Path("/sys/class/vtconsole").glob("vtcon*")):
        name_file = vt / "name"
        if name_file.exists():
            try:
                name = name_file.read_text(errors="ignore").strip().lower()
                if "frame buffer" in name or "fbcon" in name or "drm" in name:
                    return str(vt)
            except Exception:
                pass
    # Fallback: return second vtconsole (often fbcon on SteamOS)
    consoles = sorted(Path("/sys/class/vtconsole").glob("vtcon*"))
    if len(consoles) >= 2:
        return str(consoles[1])
    if consoles:
        return str(consoles[0])
    return "/sys/class/vtconsole/vtcon1"


def find_internal_edp_connector_id():
    """
    Find connected internal eDP connector id.
    On this device it was 108, but we detect it dynamically.
    """
    card_name, _, _ = find_internal_display_card()
    r = run(["/usr/bin/modetest", "-M", detect_drm_driver(), "-D", f"/dev/dri/{card_name}", "-c"], timeout=8)
    out = r.get("out", "") or ""

    for line in out.splitlines():
        # Example:
        # 108     107     connected       eDP-1
        m = re.match(r"^\s*(\d+)\s+\d+\s+connected\s+(eDP-\d+)\b", line)
        if m:
            return {
                "ok": True,
                "connector_id": m.group(1),
                "connector_name": m.group(2),
                "source": "modetest",
            }

    # Fallback from our confirmed device.
    return {
        "ok": False,
        "connector_id": "108",
        "connector_name": "eDP-1",
        "source": "fallback",
        "error": "connected eDP connector not found in modetest output",
    }



BACKLIGHT_SAVE_PATH = PLUGIN_DIR / "backlight_saved.txt"
_BACKLIGHT_SAVED = None
_BACKLIGHT_PATH_CACHE = None


def _find_backlight_path():
    """Find the internal display backlight brightness file. Vendor-agnostic."""
    amdgpu = Path("/sys/class/backlight/amdgpu_bl0/brightness")
    if amdgpu.exists():
        return amdgpu
    for bl in sorted(Path("/sys/class/backlight").glob("*/brightness")):
        return bl
    return None


def get_backlight_path():
    global _BACKLIGHT_PATH_CACHE
    if _BACKLIGHT_PATH_CACHE is None or not _BACKLIGHT_PATH_CACHE.exists():
        _BACKLIGHT_PATH_CACHE = _find_backlight_path()
    return _BACKLIGHT_PATH_CACHE


def _save_backlight():
    global _BACKLIGHT_SAVED
    bl = get_backlight_path()
    if not bl:
        return
    try:
        val = bl.read_text().strip()
        _BACKLIGHT_SAVED = int(val)
    except Exception:
        _BACKLIGHT_SAVED = None
    log(f"BACKLIGHT save={_BACKLIGHT_SAVED} setting=0")
    try:
        bl.write_text("0")
    except Exception as e:
        log(f"BACKLIGHT write failed: {e}")


def _restore_backlight():
    global _BACKLIGHT_SAVED
    bl = get_backlight_path()
    if not bl:
        return
    if _BACKLIGHT_SAVED is None:
        try:
            val = BACKLIGHT_SAVE_PATH.read_text().strip()
            _BACKLIGHT_SAVED = int(val) if val else None
        except Exception:
            pass
    log(f"BACKLIGHT restore={_BACKLIGHT_SAVED}")
    if _BACKLIGHT_SAVED is not None:
        try:
            bl.write_text(str(_BACKLIGHT_SAVED))
            BACKLIGHT_SAVE_PATH.unlink(missing_ok=True)
        except Exception as e:
            log(f"BACKLIGHT restore failed: {e}")
        _BACKLIGHT_SAVED = None

def internal_panel_off():
    """
    Turn off internal eDP panel after switching to external TV/eGPU.
    Also blanks fb and unbinds fbcon to remove boot/logo leftovers.
    """
    card_name, conn_name, _ = find_internal_display_card()
    info = find_internal_edp_connector_id()
    cid = str(info.get("connector_id") or "108")
    fb_path = find_framebuffer()
    vtcon_path = find_framebuffer_console()

    steps = []
    steps.append(_safe_write_text(f"{fb_path}/blank", "1"))
    steps.append(_safe_write_text(f"{vtcon_path}/bind", "0"))

    dpms = run(
        ["/usr/bin/modetest", "-M", detect_drm_driver(), "-D", f"/dev/dri/{card_name}", "-w", f"{cid}:DPMS:3"],
        timeout=8,
    )
    steps.append({"step": "dpms_off", "connector_id": cid, "result": dpms})


    _save_backlight()

    edp_path = f"/sys/class/drm/{card_name}-{conn_name}"
    state = {
        "edp_enabled": read_text(Path(f"{edp_path}/enabled")).strip(),
        "edp_status": read_text(Path(f"{edp_path}/status")).strip(),
    }

    return {
        "ok": dpms.get("rc") == 0,
        "action": "internal_panel_off",
        "connector": info,
        "steps": steps,
        "state_after": state,
    }


def internal_panel_on():
    """
    Restore internal eDP panel.
    """
    card_name, conn_name, _ = find_internal_display_card()
    info = find_internal_edp_connector_id()
    cid = str(info.get("connector_id") or "108")
    fb_path = find_framebuffer()
    vtcon_path = find_framebuffer_console()

    steps = []

    dpms = run(
        ["/usr/bin/modetest", "-M", detect_drm_driver(), "-D", f"/dev/dri/{card_name}", "-w", f"{cid}:DPMS:0"],
        timeout=8,
    )
    steps.append({"step": "dpms_on", "connector_id": cid, "result": dpms})

    steps.append(_safe_write_text(f"{vtcon_path}/bind", "1"))
    steps.append(_safe_write_text(f"{fb_path}/blank", "0"))

    _restore_backlight()


    edp_path = f"/sys/class/drm/{card_name}-{conn_name}"
    state = {
        "edp_enabled": read_text(Path(f"{edp_path}/enabled")).strip(),
        "edp_status": read_text(Path(f"{edp_path}/status")).strip(),
    }

    return {
        "ok": dpms.get("rc") == 0,
        "action": "internal_panel_on",
        "connector": info,
        "steps": steps,
        "state_after": state,
    }




def _find_external_display_connectors():
    """Find HDMI and DP connectors that could be on an external eGPU."""
    results = []
    for pattern in ("*-HDMI-*", "*-DP-*"):
        for conn in sorted(Path("/sys/class/drm").glob(pattern)):
            if "eDP" in conn.name:
                continue
            results.append(conn)
    return results


def hdmi_panel_off():
    """
    Force-disconnect external display (HDMI/DP) on eGPU so TV shows 'no signal' instead of black screen.
    Uses modetest DPMS Off via PCI bus ID.
    """
    for conn in _find_external_display_connectors():
        status_file = conn / "status"
        val = status_file.read_text().strip() if status_file.exists() else ""
        if val == "connected":
            cid = (conn / "connector_id").read_text().strip() if (conn / "connector_id").exists() else ""
            # Find PCI bus ID for this card
            card_name = conn.name.split("-")[0]  # e.g. "card1" from "card1-HDMI-A-1"
            uevent = Path(f"/sys/class/drm/{card_name}/device/uevent")
            pci_slot = ""
            if uevent.exists():
                for line in uevent.read_text().splitlines():
                    if line.startswith("PCI_SLOT_NAME="):
                        pci_slot = line.split("=", 1)[1]
                        break
            if not pci_slot:
                log(f"HDMI_OFF: no PCI slot for {conn.name}")
                continue
            log(f"HDMI_OFF: {conn.name} cid={cid} pci={pci_slot}")
            dpms = run(
                ["/usr/bin/modetest", "-D", f"pci:{pci_slot}", "-w", f"{cid}:DPMS:3"],
                timeout=8,
            )
            log(f"HDMI_OFF DPMS result: rc={dpms.get('rc')}")
            return {"ok": dpms.get("rc") == 0, "cid": cid, "pci": pci_slot}
    log("HDMI_OFF: no connected HDMI found")
    return {"ok": False, "error": "no connected HDMI"}




def hdmi_panel_on():
    """
    Re-enable external display (HDMI/DP) on eGPU (undo DPMS off).
    Uses modetest DPMS On via PCI bus ID.
    """
    for conn in _find_external_display_connectors():
        status_file = conn / "status"
        cid = (conn / "connector_id").read_text().strip() if (conn / "connector_id").exists() else ""
        card_name = conn.name.split("-")[0]
        uevent = Path(f"/sys/class/drm/{card_name}/device/uevent")
        pci_slot = ""
        if uevent.exists():
            for line in uevent.read_text().splitlines():
                if line.startswith("PCI_SLOT_NAME="):
                    pci_slot = line.split("=", 1)[1]
                    break
        if not pci_slot or not cid:
            continue
        # Also restore sysfs status if it was forced off
        val = status_file.read_text().strip() if status_file.exists() else ""
        if val and val != "connected":
            _safe_write_text(str(status_file), "on")
        log(f"HDMI_ON: {conn.name} cid={cid} pci={pci_slot}")
        for attempt in range(5):
            dpms = run(
                ["/usr/bin/modetest", "-D", f"pci:{pci_slot}", "-w", f"{cid}:DPMS:0"],
                timeout=8,
            )
            log(f"HDMI_ON DPMS attempt {attempt+1}: rc={dpms.get('rc')}")
            if dpms.get("rc") == 0:
                return {"ok": True, "cid": cid, "pci": pci_slot}
            time.sleep(2)
        return {"ok": False, "cid": cid, "pci": pci_slot}
    log("HDMI_ON: no HDMI connector found")
    return {"ok": False, "error": "no HDMI connector"}


def poll_drm_card_appear(timeout_s: int = 15, interval_s: float = 1.0) -> bool:
    """Poll /dev/dri/card* for a new card to appear after PCI rescan."""
    import glob as _glob_mod
    before = set(_glob_mod.glob("/dev/dri/card[0-9]*"))
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        time.sleep(interval_s)
        after = set(_glob_mod.glob("/dev/dri/card[0-9]*"))
        if after - before:
            log(f"DRM_POLL: new card appeared after {timeout_s - (deadline - time.time()):.1f}s")
            return True
    log(f"DRM_POLL: no new card after {timeout_s}s")
    return False


def find_egpu_pci_slot():
    """Find PCI slot of the eGPU (non-boot VGA device)."""
    for card in sorted(Path("/sys/class/drm").glob("card[0-9]*")):
        uevent = card / "device" / "uevent"
        if not uevent.exists():
            continue
        pci_slot = ""
        boot_vga = ""
        for line in uevent.read_text(errors="ignore").splitlines():
            if line.startswith("PCI_SLOT_NAME="):
                pci_slot = line.split("=", 1)[1]
            if line.startswith("BOOT_VGA="):
                boot_vga = line.split("=", 1)[1]
        if boot_vga == "1":
            continue
        if pci_slot:
            vendor = _read_text(card / "device" / "vendor")
            if vendor in ("0x1002", "0x10de", "0x8086"):
                return pci_slot
    return ""


def find_thunderbolt_device():
    """Find Thunderbolt device ID for the eGPU (e.g. '1-2')."""
    for d in sorted(Path("/sys/bus/thunderbolt/devices").glob("*-*")):
        auth = d / "authorized"
        if auth.exists():
            val = auth.read_text(errors="ignore").strip()
            if val == "1":
                name = _read_text(d / "device_name")
                vendor = _read_text(d / "vendor_name")
                if name and vendor:
                    return d.name, name, vendor
    return "", "", ""


def safe_disconnect_egpu():
    """
    Safely disconnect eGPU:
    1. Switch to internal display
    2. Turn off HDMI (DPMS)
    3. Restore internal panel
    4. Remove PCI device
    5. Deauthorize Thunderbolt device
    """
    if not _begin_operation("safe_disconnect"):
        return {"ok": False, "error": "Operation already in progress: " + str(_operation_lock)}
    try:
        return _safe_disconnect_egpu_body()
    finally:
        _end_operation()

def _safe_disconnect_egpu_body():
    steps = {}
    log("SAFE_DISCONNECT: start")

    # Step 1: switch to internal display
    try:
        wrapper = write_gamescope_wrapper_config("*,eDP-1", "disabled")
        steps["wrapper"] = wrapper
        log(f"SAFE_DISCONNECT wrapper: ok={wrapper.get('ok')}")
    except Exception as e:
        steps["wrapper"] = {"ok": False, "error": str(e)}

    # Step 2: HDMI off
    try:
        hdmi = hdmi_panel_off()
        steps["hdmi_off"] = hdmi
        log(f"SAFE_DISCONNECT hdmi_off: ok={hdmi.get('ok')}")
    except Exception as e:
        steps["hdmi_off"] = {"ok": False, "error": str(e)}

    # Step 3: internal panel on
    try:
        panel = internal_panel_on()
        steps["panel_on"] = panel
        log(f"SAFE_DISCONNECT panel_on: ok={panel.get('ok')}")
    except Exception as e:
        steps["panel_on"] = {"ok": False, "error": str(e)}

    # Step 3.5: NVIDIA module unload (if NVIDIA eGPU)
    vendor = get_active_vendor()
    if vendor == "nvidia":
        try:
            _run("modprobe -r nvidia_uvm nvidia_drm nvidia_modeset nvidia 2>/dev/null", timeout=15, sudo=True)
            steps["nvidia_unload"] = {"ok": True}
            log("SAFE_DISCONNECT nvidia_unload: done")
        except Exception as e:
            steps["nvidia_unload"] = {"ok": False, "error": str(e)}
            log(f"SAFE_DISCONNECT nvidia_unload: {e}")

    # Step 4: remove PCI device
    pci_slot = find_egpu_pci_slot()
    if pci_slot:
        remove_path = Path(f"/sys/bus/pci/devices/{pci_slot}/remove")
        if remove_path.exists():
            try:
                remove_path.write_text("1")
                steps["pci_remove"] = {"ok": True, "pci": pci_slot}
                log(f"SAFE_DISCONNECT pci_remove: {pci_slot}")
                time.sleep(1)
            except Exception as e:
                steps["pci_remove"] = {"ok": False, "pci": pci_slot, "error": str(e)}
                log(f"SAFE_DISCONNECT pci_remove error: {e}")
        else:
            steps["pci_remove"] = {"ok": False, "error": f"no remove path for {pci_slot}"}
    else:
        steps["pci_remove"] = {"ok": False, "error": "eGPU PCI slot not found"}

    # Step 5: deauthorize Thunderbolt device
    tb_id, tb_name, tb_vendor = find_thunderbolt_device()
    if tb_id:
        auth_path = Path(f"/sys/bus/thunderbolt/devices/{tb_id}/authorized")
        if auth_path.exists():
            try:
                auth_path.write_text("0")
                steps["tb_deauth"] = {"ok": True, "device": tb_id, "name": tb_name, "vendor": tb_vendor}
                log(f"SAFE_DISCONNECT tb_deauth: {tb_id} ({tb_vendor} {tb_name})")
            except Exception as e:
                steps["tb_deauth"] = {"ok": False, "device": tb_id, "error": str(e)}
                log(f"SAFE_DISCONNECT tb_deauth error: {e}")
        else:
            steps["tb_deauth"] = {"ok": False, "error": f"no authorized path for {tb_id}"}
    else:
        steps["tb_deauth"] = {"ok": False, "error": "Thunderbolt device not found"}

    # Step 6: disable output_order and mode configs
    try:
        atomic_write(OUTPUT_ORDER_CONF, "*,eDP-1\n")
        atomic_write(PREFER_VK_DEVICE_CONF, "disabled\n")
        atomic_write(GAMESCOPE_MODE_CONF, "disabled\n")
        steps["config_cleanup"] = {"ok": True}
    except Exception as e:
        steps["config_cleanup"] = {"ok": False, "error": str(e)}

    all_ok = all(
        (s.get("ok") if isinstance(s, dict) else False)
        for s in steps.values()
    )

    log(f"SAFE_DISCONNECT done: all_ok={all_ok}")
    return {
        "ok": all_ok,
        "action": "safe_disconnect",
        "steps": steps,
        "pci_slot": pci_slot,
        "thunderbolt": {"id": tb_id, "name": tb_name, "vendor": tb_vendor},
    }


def safe_reconnect_egpu():
    """
    Reconnect eGPU after safe disconnect:
    1. Reauthorize Thunderbolt device
    2. Rescan PCI bus
    3. Wait for GPU to appear
    """
    if not _begin_operation("safe_reconnect"):
        return {"ok": False, "error": "Operation already in progress: " + str(_operation_lock)}
    try:
        return _safe_reconnect_egpu_body()
    finally:
        _end_operation()

def _safe_reconnect_egpu_body():
    steps = {}
    log("SAFE_RECONNECT: start")

    # Step 1: reauthorize Thunderbolt
    tb_id, tb_name, tb_vendor = find_thunderbolt_device()
    if not tb_id:
        for d in sorted(Path("/sys/bus/thunderbolt/devices").glob("*-*")):
            name = _read_text(d / "device_name")
            vendor = _read_text(d / "vendor_name")
            if name and vendor:
                tb_id = d.name
                tb_name = name
                tb_vendor = vendor
                break

    if tb_id:
        auth_path = Path(f"/sys/bus/thunderbolt/devices/{tb_id}/authorized")
        if auth_path.exists():
            try:
                auth_path.write_text("1")
                steps["tb_auth"] = {"ok": True, "device": tb_id, "name": tb_name, "vendor": tb_vendor}
                log(f"SAFE_RECONNECT tb_auth: {tb_id} ({tb_vendor} {tb_name})")
                time.sleep(2)
            except Exception as e:
                steps["tb_auth"] = {"ok": False, "device": tb_id, "error": str(e)}
                log(f"SAFE_RECONNECT tb_auth error: {e}")
        else:
            steps["tb_auth"] = {"ok": False, "error": f"no authorized path for {tb_id}"}
    else:
        steps["tb_auth"] = {"ok": False, "error": "Thunderbolt device not found"}

    # Step 2: rescan PCI bus
    rescan_path = Path("/sys/bus/pci/rescan")
    if rescan_path.exists():
        try:
            rescan_path.write_text("1")
            steps["pci_rescan"] = {"ok": True}
            log("SAFE_RECONNECT pci_rescan: done")
            poll_drm_card_appear(timeout_s=15)
        except Exception as e:
            steps["pci_rescan"] = {"ok": False, "error": str(e)}
            log(f"SAFE_RECONNECT pci_rescan error: {e}")
    else:
        steps["pci_rescan"] = {"ok": False, "error": "no /sys/bus/pci/rescan"}

    # Step 2.5: NVIDIA module load (if NVIDIA eGPU)
    vendor = get_active_vendor()
    if vendor == "nvidia":
        try:
            _run("modprobe nvidia", timeout=30, sudo=True)
            _run("modprobe nvidia-uvm", timeout=15, sudo=True)
            _run("modprobe nvidia-drm modeset=1", timeout=15, sudo=True)
            steps["nvidia_load"] = {"ok": True}
            log("SAFE_RECONNECT nvidia_load: done")
        except Exception as e:
            steps["nvidia_load"] = {"ok": False, "error": str(e)}
            log(f"SAFE_RECONNECT nvidia_load: {e}")

    # Step 3: check if GPU appeared
    pci_slot = find_egpu_pci_slot()
    steps["gpu_check"] = {"ok": bool(pci_slot), "pci": pci_slot}
    log(f"SAFE_RECONNECT gpu_check: pci={pci_slot}")

    all_ok = all(
        (s.get("ok") if isinstance(s, dict) else False)
        for s in steps.values()
    )

    log(f"SAFE_RECONNECT done: all_ok={all_ok}")
    return {
        "ok": all_ok,
        "action": "safe_reconnect",
        "steps": steps,
        "pci_slot": pci_slot,
        "thunderbolt": {"id": tb_id, "name": tb_name, "vendor": tb_vendor},
    }


def _read_text(path):
    try:
        return Path(path).read_text(errors="ignore").strip()
    except Exception:
        return ""

def _read_bytes(path):
    try:
        return Path(path).read_bytes()
    except Exception:
        return b""

def _decode_edid_monitor_name(edid_bytes: bytes) -> str:
    if not edid_bytes or len(edid_bytes) < 128:
        return ""
    # EDID monitor-name descriptor: 00 00 00 FC 00 + text(13)
    for i in range(54, min(len(edid_bytes) - 18 + 1, 126), 18):
        block = edid_bytes[i:i+18]
        if len(block) < 18:
            continue
        if block[:5] == b"\x00\x00\x00\xfc\x00":
            raw = block[5:18]
            name = raw.split(b"\x0a")[0].decode("ascii", errors="ignore").strip(" \x00\r\n\t")
            if name:
                return name
    return ""

def _connector_display_name(card_name: str, connector_name: str) -> str:
    # Example sysfs path: /sys/class/drm/card1-HDMI-A-1/edid
    if not card_name or not connector_name:
        return connector_name or "Unknown display"
    base = f"/sys/class/drm/{card_name}-{connector_name}"
    edid = _read_bytes(base + "/edid")
    name = _decode_edid_monitor_name(edid)
    if name:
        return name
    return connector_name

def _gpu_pretty_name(card: dict) -> str:
    # Prefer a readable model if available. Fallbacks are fine.
    lspci = (card or {}).get("lspci", "") or ""
    vendor = (card or {}).get("vendor", "") or ""
    device = (card or {}).get("device", "") or ""

    s = lspci.lower()

    if "navi 48" in s or device == "0x7550":
        return "AMD Radeon RX 9070"
    if "radeon" in lspci or "geforce" in lspci or "arc" in lspci:
        return lspci

    if vendor == "0x1002":
        return f"AMD GPU ({device})" if device else "AMD GPU"
    if vendor == "0x10de":
        device_int = int(device, 16) if device else 0
        nvidia_names = {
            0x2684: "NVIDIA GeForce RTX 4090",
            0x2488: "NVIDIA GeForce RTX 4080",
            0x2782: "NVIDIA GeForce RTX 4070 Ti SUPER",
            0x2786: "NVIDIA GeForce RTX 4070 Ti",
            0x2783: "NVIDIA GeForce RTX 4070 SUPER",
            0x2484: "NVIDIA GeForce RTX 4070",
            0x2504: "NVIDIA GeForce RTX 4060 Ti",
            0x2503: "NVIDIA GeForce RTX 4060",
            0x2204: "NVIDIA GeForce RTX 3090 Ti",
            0x2203: "NVIDIA GeForce RTX 3090",
            0x2206: "NVIDIA GeForce RTX 3080 Ti",
            0x2208: "NVIDIA GeForce RTX 3080",
            0x2487: "NVIDIA GeForce RTX 3070 Ti",
            0x2482: "NVIDIA GeForce RTX 3070",
        }
        if device_int in nvidia_names:
            return nvidia_names[device_int]
        return f"NVIDIA GPU ({device})" if device else "NVIDIA GPU"
    if vendor == "0x8086":
        return f"Intel GPU ({device})" if device else "Intel GPU"

    return lspci or "Unknown GPU"

def _internal_display_state():
    card_name, conn_name, _ = find_internal_display_card()
    edp_path = f"/sys/class/drm/{card_name}-{conn_name}"

    state = {
        "name": "Internal display",
        "connector": conn_name,
        "connected": False,
        "enabled": False,
        "dpms": None,
        "crtc_active": None,
        "active": False,
    }

    try:
        state["connected"] = _read_text(f"{edp_path}/status") == "connected"
    except Exception:
        pass

    try:
        state["enabled"] = _read_text(f"{edp_path}/enabled") == "enabled"
    except Exception:
        pass

    try:
        r = run(["/usr/bin/modetest", "-M", detect_drm_driver(), "-D", f"/dev/dri/{card_name}", "-c"], timeout=8)
        out = r.get("out", "") or ""
        show = False
        for line in out.splitlines():
            if re.match(r"^\s*\d+\s+\d+\s+connected\s+eDP-\d+\b", line):
                show = True
            elif show and re.match(r"^\s*\d+\s+", line) and "eDP" not in line and "props:" not in line:
                show = False
            if show and "DPMS:" in line:
                pass
            if show and "value:" in line and state["dpms"] is None:
                m = re.search(r"value:\s*(\d+)", line)
                if m:
                    state["dpms"] = int(m.group(1))
    except Exception:
        pass

    try:
        dbg = run(["/usr/bin/cat", "/sys/kernel/debug/dri/0/state"], timeout=8)
        out = dbg.get("out", "") or ""
        m = re.search(r"crtc\[94\]:.*?\n(?:.*\n){0,8}?\s*active=(\d+)", out)
        if m:
            state["crtc_active"] = m.group(1) == "1"
    except Exception:
        pass

    # active only if physically connected AND not DPMS off AND CRTC active when known
    if state["connected"]:
        if state["dpms"] == 3:
            state["active"] = False
        elif state["crtc_active"] is False:
            state["active"] = False
        else:
            state["active"] = bool(state["enabled"])

    return state


def _external_display_state(status_obj: dict):
    conn = (status_obj or {}).get("recommended_connector") or {}
    egpu = (status_obj or {}).get("egpu") or {}
    patch = (status_obj or {}).get("patch_state") or {}

    name = conn.get("name") or "External display"
    display_name = "External display"

    try:
        if conn and egpu:
            display_name = _connector_display_name(egpu.get("card", ""), conn.get("name", "")) or name
    except Exception:
        display_name = name

    active = bool(conn and conn.get("status") == "connected" and patch.get("has_prefer_vk_active"))

    return {
        "name": display_name,
        "connector": name,
        "connected": bool(conn and conn.get("status") == "connected"),
        "active": active,
    }

def _display_target_label(status_obj: dict) -> str:
    patch = (status_obj or {}).get("patch_state") or {}
    connector = (status_obj or {}).get("recommended_connector") or {}
    egpu = (status_obj or {}).get("egpu") or {}

    # If we have a live connector on eGPU -> external
    if egpu and connector and connector.get("name"):
        return "external"

    if patch.get("has_prefer_vk_active"):
        return "external"

    return "internal"



def _safe_tv_modes_default():
    """
    Lightweight mode list for normal UI status.
    Heavy real DRM/modetest probing is reserved for diagnostics/support report.
    """
    return [
        {"width": 3840, "height": 2160, "refresh": 60, "label": "3840x2160 @ 60Hz", "source": "safe-default"},
        {"width": 2560, "height": 1440, "refresh": 120, "label": "2560x1440 @ 120Hz", "source": "safe-default"},
        {"width": 2560, "height": 1440, "refresh": 60, "label": "2560x1440 @ 60Hz", "source": "safe-default"},
        {"width": 1920, "height": 1080, "refresh": 120, "label": "1920x1080 @ 120Hz", "source": "safe-default"},
        {"width": 1920, "height": 1080, "refresh": 60, "label": "1920x1080 @ 60Hz", "source": "safe-default"},
        {"width": 1280, "height": 720, "refresh": 120, "label": "1280x720 @ 120Hz", "source": "safe-default"},
        {"width": 1280, "height": 720, "refresh": 60, "label": "1280x720 @ 60Hz", "source": "safe-default"},
    ]

def _tv_modes_from_modetest(card_name: str, connector_name: str):
    """
    Read real connector modes with refresh from modetest.
    Returns modes like:
      {"width": 3840, "height": 2160, "refresh": 60, "label": "3840x2160 @ 60Hz"}
    """
    if not card_name or not connector_name:
        return []

    dev = f"/dev/dri/{card_name}"
    r = run(["/usr/bin/modetest", "-M", detect_drm_driver(), "-D", dev, "-c"], timeout=8)
    out = r.get("out", "") or ""

    modes = []
    in_connector = False
    in_modes = False

    for line in out.splitlines():
        # Example connector line:
        # 135 134 connected HDMI-A-1 ...
        m_conn = re.match(r"^\s*\d+\s+\d+\s+(connected|disconnected)\s+(\S+)\s+", line)
        if m_conn:
            in_connector = (m_conn.group(2) == connector_name and m_conn.group(1) == "connected")
            in_modes = False
            continue

        if in_connector and line.strip() == "modes:":
            in_modes = True
            continue

        if in_connector and in_modes:
            # Stop when props starts
            if line.strip().startswith("props:"):
                break

            # Example:
            # #0 3840x2160 60.00 3840 ...
            m = re.search(r"#\d+\s+(\d+)x(\d+)\s+([0-9.]+)", line)
            if not m:
                continue

            w = int(m.group(1))
            h = int(m.group(2))
            hz = int(round(float(m.group(3))))

            # Keep useful TV/game modes only.
            if hz < 50:
                continue
            if w < 1280 or h < 720:
                continue

            label = f"{w}x{h} @ {hz}Hz"
            item = {
                "width": w,
                "height": h,
                "refresh": hz,
                "label": label,
            }

            if item not in modes:
                modes.append(item)

    # Manual gaming modes.
    # Some DRM/sysfs/modetest outputs expose resolution duplicates but not all refresh rates.
    # We expose common TV render sizes explicitly so 2K/1080p/720p 120Hz can be selected.
    manual_modes = [
        (3840, 2160, 60),
        (2560, 1440, 120),
        (2560, 1440, 60),
        (1920, 1080, 120),
        (1920, 1080, 60),
        (1280, 720, 120),
        (1280, 720, 60),
    ]

    existing = {
        (m.get("width"), m.get("height"), m.get("refresh"))
        for m in modes
        if isinstance(m, dict)
    }

    for w, h, hz in manual_modes:
        if (w, h, hz) not in existing:
            modes.append({
                "width": w,
                "height": h,
                "refresh": hz,
                "label": f"{w}x{h} @ {hz}Hz",
            })
            existing.add((w, h, hz))

    # Prefer common gaming modes first.
    def score(x):
        preferred = {
            (3840, 2160, 60): 0,
            (2560, 1440, 120): 1,
            (2560, 1440, 60): 2,
            (1920, 1080, 120): 3,
            (1920, 1080, 60): 4,
            (1280, 720, 120): 5,
            (1280, 720, 60): 6,
        }
        return preferred.get((x["width"], x["height"], x["refresh"]), 100000 - x["width"] * x["height"])

    modes.sort(key=score)
    return modes

def _parse_gamescope_current_mode(gamescope: str):
    if not gamescope:
        return None
    m = re.search(r"\s-W\s+(\d+)\s+-H\s+(\d+)\s+-r\s+(\d+)", gamescope)
    if not m:
        return None
    w = int(m.group(1))
    h = int(m.group(2))
    hz = int(m.group(3))
    return {
        "width": w,
        "height": h,
        "refresh": hz,
        "label": f"{w}x{h} @ {hz}Hz",
        "key": f"{w}x{h}@{hz}",
    }

def _parse_drm_signal_mode(card_name: str):
    """
    Parse real active DRM output signal from debugfs.
    Example: mode: "3840x2160": 60 ...
    """
    if not card_name:
        return None

    candidates = []
    try:
        n = str(card_name).replace("card", "")
        candidates.append(f"/sys/kernel/debug/dri/{n}/state")
    except Exception:
        pass

    try:
        dev = Path(f"/sys/class/drm/{card_name}/device").resolve()
        candidates.append(f"/sys/kernel/debug/dri/{dev.name}/state")
    except Exception:
        pass

    for path in candidates:
        try:
            data = Path(path).read_text(errors="ignore")
        except Exception:
            continue

        # find first active crtc with a mode
        blocks = re.split(r"\n(?=crtc\[\d+\]:)", data)
        for b in blocks:
            if "active=1" not in b:
                continue
            m = re.search(r'mode:\s+"(\d+)x(\d+)":\s+([0-9.]+)', b)
            if not m:
                continue
            w = int(m.group(1))
            h = int(m.group(2))
            hz = int(round(float(m.group(3))))
            return {
                "width": w,
                "height": h,
                "refresh": hz,
                "label": f"{w}x{h} @ {hz}Hz",
                "key": f"{w}x{h}@{hz}",
                "source": path,
            }

    return None

def read_internal_panel_label():
    """
    Read internal eDP panel name from EDID.
    Example: NS080WUM-LX1 on Legion Go S.
    """
    try:
        for edid_path in Path("/sys/class/drm").glob("card*-eDP-*/edid"):
            try:
                data = edid_path.read_bytes()
            except Exception:
                continue

            # EDID monitor name descriptor: 00 00 00 fc 00 + 13 bytes
            m = re.search(rb"\x00\x00\x00\xfc\x00(.{13})", data, re.S)
            if m:
                name = m.group(1).decode("latin1", errors="ignore").replace("\n", " ").strip()
                name = re.sub(r"\s+", " ", name)
                if name:
                    return name

            # Fallback: try printable strings.
            printable = "".join(chr(b) if 32 <= b <= 126 else " " for b in data)
            candidates = re.findall(r"[A-Z0-9]{2,}[-_A-Z0-9]{3,}", printable)
            for c in candidates:
                if len(c) >= 6 and not c.startswith("EDID"):
                    return c
    except Exception:
        pass

    return "Built-in display"


def get_pcie_link_status(card_name=None):
    """
    Return current PCIe link info for the eGPU DRM card.
    Example: {"ok": True, "speed": "32GT/s", "width": "x16", "pci": "0000:09:00.0"}
    """
    result = {
        "ok": False,
        "speed": "",
        "width": "",
        "pci": "",
        "source": "",
    }

    try:

        pci_addr = ""

        if card_name:
            by_path = Path("/dev/dri/by-path")
            if by_path.exists():
                for link in by_path.glob("pci-*-card"):
                    try:
                        if link.resolve().name == str(card_name):
                            name = link.name
                            if name.startswith("pci-") and name.endswith("-card"):
                                pci_addr = name[len("pci-"):-len("-card")]
                                break
                    except Exception:
                        pass

        if not pci_addr:
            return result

        result["pci"] = pci_addr
        dev = Path("/sys/bus/pci/devices") / pci_addr

        raw_speed = ""
        raw_width = ""

        try:
            raw_speed = (dev / "current_link_speed").read_text(errors="ignore").strip()
        except Exception:
            raw_speed = ""

        try:
            raw_width = (dev / "current_link_width").read_text(errors="ignore").strip()
        except Exception:
            raw_width = ""

        speed = ""
        width = ""

        if raw_speed:
            m = re.search(r'([0-9]+(?:\.[0-9]+)?)\s*GT/s', raw_speed)
            if m:
                val = m.group(1)
                if val.endswith(".0"):
                    val = val[:-2]
                speed = val + "GT/s"

        if raw_width:
            m = re.search(r'([0-9]+)', raw_width)
            if m:
                width = "x" + m.group(1)

        if (not speed or not width) and pci_addr:
            try:
                cp = subprocess.run(
                    ["/usr/bin/lspci", "-vv", "-s", pci_addr],
                    text=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    timeout=2,
                )
                out = cp.stdout or ""
                for line in out.splitlines():
                    if "LnkSta:" in line and "LnkSta2:" not in line:
                        ms = re.search(r'Speed\s+([0-9]+(?:\.[0-9]+)?)GT/s', line)
                        mw = re.search(r'Width\s+x([0-9]+)', line)
                        if ms and not speed:
                            val = ms.group(1)
                            if val.endswith(".0"):
                                val = val[:-2]
                            speed = val + "GT/s"
                        if mw and not width:
                            width = "x" + mw.group(1)
                        break
            except Exception:
                pass

        result["speed"] = speed
        result["width"] = width
        result["source"] = "sysfs/lspci"
        result["ok"] = bool(speed and width)

        return result

    except Exception as e:
        result["error"] = str(e)
        return result



def get_cpu_mode_status():
    """
    SteamOS / Deck real device performance profile.

    Primary source:
      ~/.local/share/Steam/logs/steamui_steamos.txt
      line example: Set platform performance profile: balanced

    Fallback:
      CPU governor from sysfs, only if SteamOS log profile is unavailable.
    """
    from pathlib import Path
    import re

    def pretty_profile(raw):
        v = str(raw or "").strip().lower()
        names = {
            "performance": "Performance",
            "balanced": "Balanced",
            "low-power": "Power saving",
            "low_power": "Power saving",
            "powersave": "Power saving",
            "power-saver": "Power saving",
            "power_saver": "Power saving",
            "custom": "Custom",
        }
        return names.get(v, v.replace("_", " ").replace("-", " ").title() if v else "")

    steam_log = Path("/home/deck/.local/share/Steam/logs/steamui_steamos.txt")
    try:
        if steam_log.exists():
            # Read from the end; the file can be large.
            data = steam_log.read_text(errors="ignore").splitlines()
            for line in reversed(data[-2500:]):
                m = re.search(r"Set platform performance profile:\s*([A-Za-z0-9_-]+)", line)
                if m:
                    raw = m.group(1).strip()
                    return {
                        "ok": True,
                        "label": pretty_profile(raw),
                        "raw": raw,
                        "kind": "steamos_platform_performance_profile",
                        "source": str(steam_log),
                    }
    except Exception as e:
        steam_err = str(e)
    else:
        steam_err = ""

    # Fallback only. This is NOT the real SteamOS profile, just CPU governor.
    gov_path = Path("/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor")
    try:
        raw = gov_path.read_text(errors="ignore").strip()
        label_map = {
            "performance": "CPU Performance",
            "schedutil": "CPU Balanced",
            "ondemand": "CPU Balanced",
            "powersave": "CPU Power saver",
            "conservative": "CPU Power saver",
        }
        return {
            "ok": True,
            "label": label_map.get(raw.lower(), "CPU " + pretty_profile(raw)),
            "raw": raw,
            "kind": "cpu_governor_fallback",
            "source": str(gov_path),
            "note": "SteamOS platform profile was not found in steamui_steamos.txt",
            "steam_log_error": steam_err,
        }
    except Exception as e:
        return {
            "ok": False,
            "label": "Unknown",
            "raw": "",
            "kind": "unknown",
            "source": "",
            "error": str(e),
            "steam_log_error": steam_err,
        }


def build_status(heavy: bool = False):
    cards = scan_cards()
    egpu = pick_egpu(cards)
    vendor = get_active_vendor()
    for _card in cards:
        if egpu and _card.get("card") == egpu.get("card"):
            # eGPU card — enable vendor-appropriate telemetry
            if vendor == "nvidia":
                _card["sensors"] = _query_nvidia_smi()
            else:
                _card["sensors"] = collect_card_sensors(_card.get("card", ""))
        else:
            # iGPU or non-eGPU cards — keep disabled for stability
            _card["sensors"] = {"ok": False, "disabled": True, "reason": "non-eGPU card, polling disabled"}
    connector = pick_connector(egpu)

    igpu = next((c for c in cards if c.get("kind") == "igpu"), None)
    status = {
        "ok": True,
        "version": VERSION,
        "connected": bool(egpu),
        "mode": "egpu_detected" if egpu else "no_egpu",
        "cards": cards,
        "egpu": egpu,
        "igpu": igpu,
        "recommended_connector": connector,
        "patch_state": get_current_patch_state(),
        "gamescope": current_gamescope_process(),
        "paths": {
            "gamescope_session": str(GAMESCOPE_SESSION),
            "backup_original": str(BACKUP_ORIGINAL),
            "backup_last": str(BACKUP_LAST),
            "env_override": str(ENV_OVERRIDE),
        },
    }

    try:
        status["device_hint"] = detect_device_hint()
    except Exception:
        status["device_hint"] = None

    # v0.7.10:
    # Do not write last_status.json here.
    # The status object is still incomplete at this point.
    # Final write happens at the end of build_status().
    try:
        status["gpu_label"] = _gpu_pretty_name(status.get("egpu") or {})
    except Exception:
        status["gpu_label"] = "Unknown GPU"

    try:
        igpu = status.get("igpu") or {}
        status["igpu_label"] = _gpu_pretty_name(igpu) if igpu else "iGPU"
    except Exception:
        status["igpu_label"] = "iGPU"

    try:
        egpu = status.get("egpu") or {}
        if egpu:
            card_path = f"/sys/class/drm/{egpu.get('card', '')}"
            status["egpu_driver"] = detect_drm_driver(card_path) if card_path else "unknown"
        else:
            status["egpu_driver"] = "none"
    except Exception:
        status["egpu_driver"] = "unknown"

    try:
        mesa_out = run(["pacman", "-Q", "mesa"], timeout=3).get("out", "")
        if mesa_out:
            # "mesa 26.1.0.221388.radeonsi_26.1.0-1" -> "26.1"
            parts = mesa_out.strip().split()
            if len(parts) >= 2:
                ver = parts[1].split(".")
                status["mesa_version"] = ver[0] + "." + ver[1] if len(ver) >= 2 else parts[1]
            else:
                status["mesa_version"] = ""
        else:
            status["mesa_version"] = ""
    except Exception:
        status["mesa_version"] = ""

    try:
        conn = status.get("recommended_connector") or {}
        egpu = status.get("egpu") or {}
        if conn and egpu:
            status["display_label"] = _connector_display_name(egpu.get("card", ""), conn.get("name", ""))
        else:
            status["display_label"] = "Internal display"
    except Exception:
        status["display_label"] = "Internal display"

    try:
        status["display_target"] = _display_target_label(status)
    except Exception:
        status["display_target"] = "internal"
    try:
        status["internal_display"] = _internal_display_state()
    except Exception as e:
        status["internal_display"] = {"name": "Internal display", "active": False, "error": str(e)}

    try:
        status["external_display"] = _external_display_state(status)
    except Exception as e:
        status["external_display"] = {"name": "External display", "active": False, "error": str(e)}
    try:
        status["current_mode"] = _parse_gamescope_current_mode(status.get("gamescope", ""))
    except Exception as e:
        status["current_mode"] = None
        status["current_mode_error"] = str(e)

    # v0.7.9: normal UI status must stay lightweight.
    # Do not run modetest/debugfs every 5 seconds from the frontend poller.
    if heavy:
        try:
            _conn = status.get("recommended_connector") or {}
            _egpu = status.get("egpu") or {}
            status["tv_modes"] = _tv_modes_from_modetest(_egpu.get("card", ""), _conn.get("name", ""))
            status["tv_modes_source"] = "modetest"
        except Exception as e:
            status["tv_modes"] = _safe_tv_modes_default()
            status["tv_modes_error"] = str(e)
            status["tv_modes_source"] = "safe-default-after-error"
        try:
            _eg = status.get("egpu") or {}
            status["tv_signal_mode"] = _parse_drm_signal_mode(_eg.get("card", ""))
        except Exception as e:
            status["tv_signal_mode"] = None
            status["tv_signal_mode_error"] = str(e)
    else:
        status["tv_modes"] = _safe_tv_modes_default()
        status["tv_modes_source"] = "safe-default-light-status"
        status["tv_signal_mode"] = status.get("current_mode")
    try:
        status["internal_panel_label"] = read_internal_panel_label()
    except Exception as e:
        status["internal_panel_label"] = "Built-in display"
        status["internal_panel_label_error"] = str(e)






    try:
        egpu_for_link = status.get("egpu") or {}
        status["pcie_link"] = get_pcie_link_status(egpu_for_link.get("card"))
    except Exception as e:
        status["pcie_link"] = {"ok": False, "error": str(e), "speed": "", "width": "", "pci": ""}

    try:
        status["cpu_mode"] = get_cpu_mode_status()
        try:
            status["tv_network"] = detect_tv_network_state()
        except Exception as e:
            status["tv_network"] = {"ok": False, "reachable": False, "label": "", "icon": "", "error": str(e)}


        # v0.7.9: ADB TV power detection is heavy and may block/log a lot.
        # Only run it for heavy diagnostics/support report. Normal UI derives a safe label below.
        if heavy:
            status["tv_power"] = detect_tv_power_state()
        else:
            status["tv_power"] = {
                "ok": False,
                "on": None,
                "label": "Unknown",
                "source": "light-status-skip-adb",
            }

        # eGPUBridge UI truth source:
        # In SteamOS Game Mode, the active display is the connector selected by gamescope -O.
        # Sysfs may keep eDP-1 as connected/enabled even when Game Mode is rendering to HDMI-A-1.
        try:
            gs = status.get("gamescope") or ""
            internal = status.get("internal_display") or {}
            external = status.get("external_display") or {}

            if "-O HDMI-A-1" in gs or "-O 'HDMI-A-1'" in gs or "-O \"HDMI-A-1\"" in gs:
                internal["active"] = False
                external["active"] = True
                status["display_target"] = "external"
                status["internal_display"] = internal
                status["external_display"] = external

            elif "-O *,eDP-1" in gs or "-O '*',eDP-1" in gs or "-O eDP-1" in gs:
                internal["active"] = True
                external["active"] = False
                status["display_target"] = "internal"
                status["internal_display"] = internal
                status["external_display"] = external

            # If TV power detection is skipped/unknown, but Game Mode is already on HDMI,
            # show a useful assumed state instead of breaking the UI with Unknown.
            tvp = status.get("tv_power")
            if isinstance(tvp, dict) and not tvp.get("ok"):
                if (status.get("display_target") == "external") and external.get("connected"):
                    tvp["ok"] = True
                    tvp["on"] = True
                    tvp["label"] = "On"
                    tvp["assumed"] = True
                    tvp["reason"] = "Assumed from active HDMI-A-1 gamescope output"
                    if not heavy:
                        tvp["source"] = "light-status-gamescope-assumption"
                    status["tv_power"] = tvp

        except Exception as e:
            status["display_state_warning"] = str(e)
    except Exception as e:
        status["cpu_mode"] = {"ok": False, "label": "", "raw": "", "source": "", "error": str(e)}

    # Vendor-aware status
    try:
        vendor = get_active_vendor()
        status["active_vendor"] = vendor
        if vendor == "nvidia":
            nvidia_stats = _query_nvidia_smi()
            status["nvidia_smi"] = nvidia_stats
            if egpu and nvidia_stats.get("available"):
                egpu["sensors"] = {
                    "ok": True,
                    "temp_c": nvidia_stats.get("temp_c"),
                    "power_w": nvidia_stats.get("power_w"),
                    "mem_used_mb": nvidia_stats.get("mem_used_mb"),
                    "mem_total_mb": nvidia_stats.get("mem_total_mb"),
                }
        status["nvidia_driver_installed"] = os.path.exists("/usr/bin/nvidia-smi") or os.path.exists("/usr/sbin/nvidia-smi")
    except Exception:
        status["active_vendor"] = "unknown"

    try:
        atomic_write(STATUS_PATH, json.dumps(status, indent=2, ensure_ascii=False))
    except Exception:
        pass

    try:
        summary = {
            "version": status.get("version"),
            "connected": status.get("connected"),
            "mode": status.get("mode"),
            "egpu": (status.get("egpu") or {}).get("card"),
            "egpu_pci": (status.get("egpu") or {}).get("pci"),
            "connector": (status.get("recommended_connector") or {}).get("name"),
            "tv_modes_source": status.get("tv_modes_source"),
            "current_mode": status.get("current_mode"),
            "tv_power": status.get("tv_power", {}).get("label") if isinstance(status.get("tv_power"), dict) else None,
        }
        if not getattr(build_status, "_status_summary_logged_once", False):
            log("STATUS_SUMMARY " + json.dumps(summary, ensure_ascii=False))
            build_status._status_summary_logged_once = True
    except Exception:
        pass

    return status



def tail_text(path: Path, max_lines: int = 80) -> str:
    try:
        data = path.read_text(encoding="utf-8", errors="replace").splitlines()
        return "\n".join(data[-max_lines:])
    except Exception as e:
        return f"<tail failed: {e}>"


def gamescope_session_block() -> str:
    try:
        lines = read_text(GAMESCOPE_SESSION).splitlines()
        out = []
        for i, line in enumerate(lines, 1):
            if 245 <= i <= 285:
                out.append(f"{i:04d}: {line}")
        return "\n".join(out)
    except Exception as e:
        return f"<gamescope-session read failed: {e}>"


def make_encoded_report(obj) -> str:
    raw = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    packed = zlib.compress(raw, 9)
    b64 = base64.urlsafe_b64encode(packed).decode("ascii").rstrip("=")
    return "EGBR1." + b64


def make_qr_utf8(payload: str) -> dict:
    q = run(["/usr/bin/qrencode", "-t", "UTF8"], timeout=8)
    # run() cannot pass stdin, so use subprocess directly here.
    try:
        p = subprocess.run(
            ["/usr/bin/qrencode", "-t", "UTF8"],
            input=payload,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=8,
        )
        return {
            "ok": p.returncode == 0,
            "rc": p.returncode,
            "qr": p.stdout,
            "err": p.stderr.strip(),
        }
    except Exception as e:
        return {"ok": False, "rc": -1, "qr": "", "err": str(e)}


def build_support_report():
    status = build_status(heavy=True)

    journal = run(
        [
            "/usr/bin/journalctl",
            "-u",
            "plugin_loader.service",
            "--no-pager",
            "-n",
            "80",
        ],
        timeout=8,
    )

    report = {
        "kind": "eGPUBridge support report",
        "version": VERSION,
        "time": time.strftime("%Y-%m-%d %H:%M:%S"),
        "status": status,
        "gamescope_session_block": gamescope_session_block(),
        "plugin_log_tail": tail_text(LOG_PATH, 80),
        "journal_tail": journal.get("out", "")[-8000:],
    }

    # Compact QR payload: enough for diagnostics, not too huge for QR.
    compact = {
        "kind": "eGPUBridge compact report",
        "version": VERSION,
        "time": report["time"],
        "connected": status.get("connected"),
        "mode": status.get("mode"),
        "egpu": status.get("egpu"),
        "recommended_connector": status.get("recommended_connector"),
        "patch_state": status.get("patch_state"),
        "gamescope": status.get("gamescope"),
        "gamescope_session_block": report["gamescope_session_block"],
    }

    encoded = make_encoded_report(compact)
    qr = make_qr_utf8(encoded)

    return {
        "ok": True,
        "report": report,
        "compact_report": compact,
        "encoded_report": encoded,
        "encoded_report_length": len(encoded),
        "qr_ok": qr.get("ok"),
        "qr_error": qr.get("err"),
        "qr_utf8": qr.get("qr", ""),
        "hint": "Send encoded_report to ChatGPT. It is zlib+base64url, prefix EGBR1.",
    }

def read_tv_config():
    """
    Reads /home/deck/.config/egpubridge-tv.conf:
      TV_IP=192.168.1.50
      TV_MAC=AA:BB:CC:DD:EE:FF
      TV_ADB_PORT=5555
    """
    cfg = {
        "TV_IP": "",
        "TV_MAC": "",
        "TV_ADB_PORT": "5555",
    }

    path = Path("/home/deck/.config/egpubridge-tv.conf")
    try:
        if path.exists():
            for line in path.read_text(errors="ignore").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                cfg[k.strip()] = v.strip().strip('"').strip("'")
    except Exception as e:
        return cfg, str(e)

    return cfg, ""


def get_active_display_connector_for_tv():
    """
    Finds the SteamOS/eGPU active external display connector.
    Preferred result example: HDMI-A-1.
    """
    for fn_name in [
        "get_external_display_status",
        "get_external_display",
        "get_display_status",
    ]:
        try:
            status_fn = globals().get(fn_name)
            if callable(status_fn):
                data = status_fn()
                if isinstance(data, dict):
                    connector = data.get("connector") or data.get("name") or ""
                    if connector and ("HDMI" in connector.upper() or "DP" in connector.upper()):
                        return str(connector), fn_name + "()"
        except Exception:
            pass

    try:
        # Same fallback logic as status(): read current plugin status if helper exists.
        status_data = {}
        for fn_name in ["get_status", "build_status"]:
            status_fn = globals().get(fn_name)
            if callable(status_fn):
                status_data = status_fn()
                break

        if isinstance(status_data, dict):
            ext = status_data.get("external_display")
            if isinstance(ext, dict):
                connector = ext.get("connector") or ""
                if connector:
                    return str(connector), "status external_display"
    except Exception:
        pass

    try:
        r = subprocess.run(
            ["kscreen-doctor", "-o"],
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=5,
        )
        out = r.stdout or ""
        current = ""
        active = False

        for line in out.splitlines():
            line_s = line.strip()

            if line_s.startswith("Output:"):
                if current and active:
                    return current, "kscreen-doctor"

                parts = line_s.split()
                current = ""
                active = False

                if len(parts) >= 3:
                    current = parts[2]

            low = line_s.lower()
            if current and ("enabled" in low or "connected" in low):
                active = True

        if current and active:
            return current, "kscreen-doctor"
    except Exception:
        pass

    try:
        r = subprocess.run(
            ["xrandr", "--query"],
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=5,
        )
        for line in (r.stdout or "").splitlines():
            if " connected" not in line:
                continue
            connector = line.split()[0]
            up = connector.upper()
            if up.startswith("HDMI") or up.startswith("DP") or up.startswith("DISPLAYPORT"):
                return connector, "xrandr"
    except Exception:
        pass

    return "", "unknown"


def normalize_connector_key(connector):
    out = []
    for ch in str(connector).strip():
        if ch.isalnum():
            out.append(ch.upper())
        else:
            out.append("_")
    return "_".join([x for x in "".join(out).split("_") if x])


def get_tv_hdmi_target(cfg):
    connector, source = get_active_display_connector_for_tv()

    hdmi_num = ""
    map_key = ""

    if connector:
        map_key = "TV_CONNECTOR_" + normalize_connector_key(connector)
        hdmi_num = cfg.get(map_key, "")

    if not hdmi_num:
        hdmi_num = cfg.get("TV_DEFAULT_HDMI", "1")

    input_id = cfg.get(f"TV_HDMI_{hdmi_num}", "")

    return {
        "connector": connector,
        "connector_source": source,
        "map_key": map_key,
        "hdmi_num": str(hdmi_num),
        "input_id": input_id,
    }


def write_tv_config_value(key, value):
    path = Path("/home/deck/.config/egpubridge-tv.conf")
    try:
        lines = []
        found = False
        if path.exists():
            lines = path.read_text(errors="ignore").splitlines()

        out = []
        for line in lines:
            if line.strip().startswith(key + "="):
                out.append(f"{key}={value}")
                found = True
            else:
                out.append(line)

        if not found:
            out.append(f"{key}={value}")

        path.write_text("\n".join(out) + "\n")
        return True
    except Exception:
        return False


def save_tv_last_mode(width, height, refresh):
    try:
        write_tv_config_value("TV_LAST_WIDTH", int(width))
        write_tv_config_value("TV_LAST_HEIGHT", int(height))
        write_tv_config_value("TV_LAST_REFRESH", int(refresh))
        return True
    except Exception:
        return False


def read_tv_last_mode(cfg=None):
    if cfg is None:
        cfg, _ = read_tv_config()

    def _int(name, default):
        try:
            return int(cfg.get(name) or default)
        except Exception:
            return default

    return {
        "width": _int("TV_LAST_WIDTH", DEFAULT_WIDTH),
        "height": _int("TV_LAST_HEIGHT", DEFAULT_HEIGHT),
        "refresh": _int("TV_LAST_REFRESH", DEFAULT_REFRESH),
    }




_TV_NET_CACHE = {"ts": 0.0, "data": None}

def detect_tv_network_state():
    """
    Very light TV network check for UI icon.
    It is safe:
    - no ADB
    - no wake command
    - no HDMI switch
    - short timeout
    - cached to avoid polling spam
    """
    try:
        cfg, cfg_err = read_tv_config()
    except Exception as e:
        return {
            "ok": False,
            "reachable": False,
            "label": "",
            "icon": "",
            "source": "config-error",
            "error": str(e),
        }

    ip = (cfg.get("TV_IP") or "").strip()
    if not ip:
        return {
            "ok": False,
            "reachable": False,
            "label": "",
            "icon": "",
            "source": "no-tv-ip",
        }

    try:
        now = time.time()
        cached = _TV_NET_CACHE.get("data")
        if cached and (now - float(_TV_NET_CACHE.get("ts") or 0)) < 25:
            return cached
    except Exception:
        pass

    # Prefer ping if available. Failure must be silent for UI.
    try:
        r = run(["/usr/bin/ping", "-c", "1", "-W", "1", ip], timeout=2)
        reachable = bool(r.get("rc") == 0)
        data = {
            "ok": True,
            "reachable": reachable,
            "label": "TV Wi-Fi" if reachable else "",
            "icon": "📺 Wi-Fi" if reachable else "",
            "ip_set": True,
            "source": "ping-cache-25s",
        }
    except Exception as e:
        data = {
            "ok": False,
            "reachable": False,
            "label": "",
            "icon": "",
            "ip_set": True,
            "source": "ping-failed",
            "error": str(e),
        }

    try:
        _TV_NET_CACHE["ts"] = time.time()
        _TV_NET_CACHE["data"] = data
    except Exception:
        pass

    return data

def detect_tv_power_state():
    """
    Robust TCL/Android TV power detection.

    Important:
    - run_tv_command truncates stdout, so for dumpsys power we use subprocess.run directly.
    - The parser reads full dumpsys output, but returns only compact debug text.
    """
    cfg, cfg_err = read_tv_config()
    ip = cfg.get("TV_IP") or "192.168.188.20"
    port = cfg.get("TV_ADB_PORT") or "5555"
    adb_target = f"{ip}:{port}"
    steps = []

    if cfg_err:
        steps.append({"stage": "config", "ok": False, "error": cfg_err})

    if not ip:
        return {
            "ok": False,
            "on": None,
            "label": "Unknown",
            "error": "TV_IP missing",
            "steps": steps,
        }

    connect = run_tv_command(["adb", "connect", adb_target], timeout=8)
    steps.append({"stage": "adb_connect", **connect})

    try:
        adb_path = _egpubridge_resolve_local_tool("adb") or "adb"
        p = subprocess.run(
            [adb_path, "shell", "dumpsys", "power"],
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=8,
        )
        full_stdout = p.stdout or ""
        full_stderr = p.stderr or ""
        full_text = full_stdout + "\n" + full_stderr
        low = full_text.lower()

        # Keep debug compact, but parse full_text above.
        interesting_lines = []
        for line in full_text.splitlines():
            l = line.lower()
            if (
                "mwakefulness" in l
                or "wakefulness" in l
                or "interactive" in l
                or "display power" in l
                or "state=" in l
                or "mhalinteractivemodeenabled" in l
                or "mlastsleepreason" in l
                or "mlastwaketime" in l
            ):
                interesting_lines.append(line)

        compact_stdout = "\n".join(interesting_lines[-80:])
        if not compact_stdout:
            compact_stdout = full_stdout[-1200:]

        power = {
            "ok": p.returncode == 0,
            "rc": p.returncode,
            "cmd": ["adb", "shell", "dumpsys", "power"],
            "stdout": compact_stdout[-3000:],
            "stderr": full_stderr[-1200:],
        }
        steps.append({"stage": "dumpsys_power_full_parse", **power})

    except Exception as e:
        steps.append({
            "stage": "dumpsys_power_full_parse",
            "ok": False,
            "rc": -1,
            "cmd": ["adb", "shell", "dumpsys", "power"],
            "stdout": "",
            "stderr": str(e),
        })
        return {
            "ok": False,
            "on": None,
            "label": "Unknown",
            "adb_target": adb_target,
            "steps": steps,
        }

    if (
        "device offline" in low
        or "unauthorized" in low
        or "no devices" in low
        or "failed to connect" in low
    ):
        return {
            "ok": False,
            "on": None,
            "label": "Unknown",
            "adb_target": adb_target,
            "steps": steps,
        }

    awake = (
        "mwakefulness=awake" in low
        or "wakefulness=awake" in low
        or "display power: state=on" in low
        or "state=on" in low
        or "mhalinteractivemodeenabled=true" in low
    )

    asleep = (
        "mwakefulness=asleep" in low
        or "wakefulness=asleep" in low
        or "display power: state=off" in low
        or "state=off" in low
        or "mhalinteractivemodeenabled=false" in low
    )

    if awake and not asleep:
        return {
            "ok": True,
            "on": True,
            "label": "On",
            "adb_target": adb_target,
            "steps": steps,
        }

    if asleep and not awake:
        return {
            "ok": True,
            "on": False,
            "label": "Off",
            "adb_target": adb_target,
            "steps": steps,
        }

    if awake:
        return {
            "ok": True,
            "on": True,
            "label": "On",
            "adb_target": adb_target,
            "ambiguous": True,
            "steps": steps,
        }

    return {
        "ok": False,
        "on": None,
        "label": "Unknown",
        "adb_target": adb_target,
        "steps": steps,
    }

def tv_control_action(action):
    cfg, cfg_err = read_tv_config()

    ip = cfg.get("TV_IP") or ""
    mac = cfg.get("TV_MAC") or ""
    port = cfg.get("TV_ADB_PORT") or "5555"

    steps = []

    if cfg_err:
        steps.append({"ok": False, "stage": "config", "error": cfg_err})

    if not ip:
        return {
            "ok": False,
            "action": action,
            "error": "TV_IP не задан в /home/deck/.config/egpubridge-tv.conf",
            "config": cfg,
            "steps": steps,
        }

    # TCL/Android TV wake reliability:
    # ADB KEYCODE_WAKEUP may fail when the TV is asleep, even if adb still lists the device.
    # Therefore both TV ON and HDMI/input actions send Wake-on-LAN first when TV_MAC is configured.
    if action in ("on", "input"):
        if mac and "AA:BB:CC:DD:EE:FF" not in mac:
            wol_stage = "wakeonlan" if action == "on" else "wakeonlan_for_input"
            steps.append({"stage": wol_stage, **_egpubridge_send_wol_packet_safe(mac, ip=ip)})
            time.sleep(6 if action == "on" else 4)
        else:
            steps.append({
                "ok": False,
                "stage": "wakeonlan",
                "error": "TV_MAC не задан или оставлен шаблонным",
            })

    adb_target = f"{ip}:{port}"

    steps.append({"stage": "adb_connect", **run_tv_command(["adb", "connect", adb_target], timeout=10)})
    time.sleep(1)

    if action == "off":
        steps.append({
            "stage": "KEYCODE_SLEEP",
            **run_tv_command(["adb", "shell", "input", "keyevent", "KEYCODE_SLEEP"], timeout=8),
        })

        return {
            "ok": any(s.get("ok") for s in steps if s.get("stage") == "KEYCODE_SLEEP"),
            "action": action,
            "tv_ip": ip,
            "tv_mac_set": bool(mac and "AA:BB:CC:DD:EE:FF" not in mac),
            "adb_target": adb_target,
            "steps": steps,
        }

    if action in ("on", "input"):
        wake_step = {
            "stage": "KEYCODE_WAKEUP",
            **run_tv_command(["adb", "shell", "input", "keyevent", "KEYCODE_WAKEUP"], timeout=8),
        }
        steps.append(wake_step)

        # Some TCL/Android TV units need a few seconds after WOL before ADB becomes usable.
        # Do not fail the whole button immediately on "offline" / "still authorizing".
        wake_text = (str(wake_step.get("stdout", "")) + " " + str(wake_step.get("stderr", ""))).lower()
        if not wake_step.get("ok") and (
            "offline" in wake_text or "authorizing" in wake_text or "no devices" in wake_text or "device still" in wake_text
        ):
            time.sleep(4)
            steps.append({
                "stage": "adb_retry_after_wakeup_fail",
                **run_tv_command(["adb", "connect", adb_target], timeout=8),
            })
            time.sleep(1)
            steps.append({
                "stage": "KEYCODE_WAKEUP_RETRY",
                **run_tv_command(["adb", "shell", "input", "keyevent", "KEYCODE_WAKEUP"], timeout=8),
            })

        time.sleep(0.7)

        target = get_tv_hdmi_target(cfg)

        if not target.get("input_id"):
            return {
                "ok": False,
                "action": action,
                "error": "Не найден TV_HDMI_N для текущего connector. Проверь TV_CONNECTOR_* и TV_HDMI_* в /home/deck/.config/egpubridge-tv.conf",
                "target": target,
                "config": cfg,
                "steps": steps,
            }

        uri = "content://android.media.tv/passthrough/" + quote(target["input_id"], safe="")

        steps.append({
            "stage": "HDMI_SWITCH",
            "target": target,
            **run_tv_command([
                "adb", "shell", "am", "start",
                "-a", "android.intent.action.VIEW",
                "-d", uri,
            ], timeout=10),
        })

        hdmi_ok = any(s.get("ok") for s in steps if s.get("stage") == "HDMI_SWITCH")
        wol_ok = any(
            s.get("ok") for s in steps
            if str(s.get("stage", "")).startswith("wakeonlan")
            or s.get("stage") == "python_wol"
            or s.get("method") == "internal-python-wol"
        )
        adb_ok = any(s.get("ok") for s in steps if s.get("stage") in ("adb_connect", "adb_retry_after_wakeup_fail"))
        action_ok = bool(hdmi_ok)
        if action == "on":
            # For TV ON, successful WoL is enough. ADB/HDMI may be unavailable.
            action_ok = bool(wol_ok or adb_ok or hdmi_ok)

        return {
            "ok": bool(action_ok),
            "partial": bool((wol_ok or adb_ok) and not hdmi_ok and action != "on"),
            "action": action,
            "tv_ip": ip,
            "tv_mac_set": bool(mac and "AA:BB:CC:DD:EE:FF" not in mac),
            "adb_target": adb_target,
            "target": target,
            "steps": steps,
        }

    return {
        "ok": False,
        "action": action,
        "error": f"unknown TV action: {action}",
        "config": cfg,
        "steps": steps,
    }



def _valid_output_order(value: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z0-9_,.\-*]+", str(value or "")))


def _valid_vk_device(value: str) -> bool:
    value = str(value or "").strip()
    if value in ("", "disabled", "none"):
        return True
    return bool(re.fullmatch(r"[0-9A-Fa-f]{4}:[0-9A-Fa-f]{4}", value))


def _valid_gamescope_mode(value: str) -> bool:
    value = str(value or "").strip()
    if value in ("", "disabled", "none"):
        return True
    return bool(re.fullmatch(r"\d{3,5}x\d{3,5}@\d{2,3}", value))


def write_gamescope_mode_config(width=None, height=None, refresh=None, disabled: bool = False):
    """
    Safe Gamescope render/output mode config for eGPUBridge wrapper.
    Writes gamescope_mode.conf only. Does not restart Gamescope.
    """
    GAMESCOPE_MODE_CONF.parent.mkdir(parents=True, exist_ok=True)

    if disabled:
        atomic_write(GAMESCOPE_MODE_CONF, "disabled\n")
        return {
            "ok": True,
            "method": "wrapper-mode-config",
            "gamescope_mode": "disabled",
            "gamescope_mode_conf": str(GAMESCOPE_MODE_CONF),
        }

    try:
        w = int(width)
        h = int(height)
        r = int(refresh)
    except Exception:
        return {"ok": False, "error": f"invalid mode values: {width}x{height}@{refresh}"}

    mode = f"{w}x{h}@{r}"

    allowed = {
        "3840x2160@60",
        "2560x1440@120",
        "2560x1440@60",
        "1920x1080@120",
        "1920x1080@60",
        "1280x720@120",
        "1280x720@60",
    }

    if mode not in allowed:
        return {"ok": False, "error": f"unsupported safe TV mode: {mode}", "allowed": sorted(allowed)}

    atomic_write(GAMESCOPE_MODE_CONF, mode + "\n")
    return {
        "ok": True,
        "method": "wrapper-mode-config",
        "gamescope_mode": mode,
        "gamescope_mode_conf": str(GAMESCOPE_MODE_CONF),
    }


def write_gamescope_wrapper_config(output_order: str, prefer_vk_device: str = "disabled"):
    """
    Safe display switch backend:
    only writes eGPUBridge wrapper config files.
    Does not patch /usr/lib/steamos/gamescope-session.
    """
    output_order = str(output_order or "").strip()
    prefer_vk_device = str(prefer_vk_device or "disabled").strip()

    if not _valid_output_order(output_order):
        return {"ok": False, "error": f"invalid output_order: {output_order!r}"}

    if not _valid_vk_device(prefer_vk_device):
        return {"ok": False, "error": f"invalid prefer_vk_device: {prefer_vk_device!r}"}

    OUTPUT_ORDER_CONF.parent.mkdir(parents=True, exist_ok=True)
    atomic_write(OUTPUT_ORDER_CONF, output_order + "\n")
    atomic_write(PREFER_VK_DEVICE_CONF, prefer_vk_device + "\n")

    return {
        "ok": True,
        "method": "wrapper-config",
        "output_order": output_order,
        "prefer_vk_device": prefer_vk_device,
        "output_order_conf": str(OUTPUT_ORDER_CONF),
        "prefer_vk_device_conf": str(PREFER_VK_DEVICE_CONF),
    }


def restart_gamescope_session_target():
    """
    Restart current user's Gamescope session target.
    Works from Decky root backend by calling deck user's systemd --user.
    """
    uid = os.geteuid()

    if uid == 0:
        cmd = [
            "/usr/bin/runuser", "-u", "deck", "--",
            "/usr/bin/env",
            "XDG_RUNTIME_DIR=/run/user/1000",
            "DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus",
            "/usr/bin/systemctl", "--user", "restart", "gamescope-session.target",
        ]
    else:
        cmd = ["/usr/bin/systemctl", "--user", "restart", "gamescope-session.target"]

    log("RUN CLEAN: " + " ".join(cmd))
    p = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=20,
        env={k: v for k, v in os.environ.items() if k not in ("LD_LIBRARY_PATH", "LD_PRELOAD", "PYTHONPATH", "PYTHONHOME")},
    )

    return {
        "ok": p.returncode == 0,
        "rc": p.returncode,
        "out": p.stdout[-2000:],
        "err": p.stderr[-2000:],
        "cmd": cmd,
    }


def _decky_call_value(args, kwargs, key, default=None):
    """
    Decky legacy calls may pass plugin args as:
      - keyword args
      - first positional dict
      - unexpected positional self/object
    This helper normalizes that safely.
    """
    try:
        if isinstance(kwargs, dict) and key in kwargs:
            return kwargs.get(key)
        for item in args or ():
            if isinstance(item, dict) and key in item:
                return item.get(key)
    except Exception:
        pass
    return default


def _decky_bool(args, kwargs, key, default=False):
    value = _decky_call_value(args, kwargs, key, default)
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in ("1", "true", "yes", "y", "on", "да", "д")
    return bool(value)


def _decky_int(args, kwargs, key, default):
    value = _decky_call_value(args, kwargs, key, default)
    try:
        return int(value)
    except Exception:
        return int(default)


def _decky_str(args, kwargs, key, default):
    value = _decky_call_value(args, kwargs, key, default)
    if value is None:
        return default
    return str(value)



def _apply_restart_sync():
    """Blocking: gamescope restart + sleep + panel operations."""
    r = restart_gamescope_session_target()
    time.sleep(6)
    try:
        hdmi_on = hdmi_panel_on()
        log(f"hdmi_panel_on: {hdmi_on}")
    except Exception as e:
        log(f"hdmi_panel_on EXCEPTION: {e}")
    try:
        panel_result = internal_panel_off()
        log(f"internal_panel_off: {panel_result}")
    except Exception as e:
        log(f"internal_panel_off EXCEPTION: {e}")
    return r


def _restore_restart_sync():
    """Blocking: gamescope restart + sleep + hdmi panel off."""
    r = restart_gamescope_session_target()
    time.sleep(6)
    try:
        hdmi_result = hdmi_panel_off()
        log(f"hdmi_panel_off: {hdmi_result}")
    except Exception as e:
        log(f"hdmi_panel_off EXCEPTION: {e}")
    return r


class Plugin:
    async def _main(self):
        log(f"init v{VERSION}")
        status = build_status()
        # If gamescope is already in external/HDMI mode, turn off internal backlight
        gamescope = status.get("gamescope") or ""
        display_target = status.get("display_target") or "unknown"
        patch = status.get("patch_state") or {}
        output_order = patch.get("output_order") or ""
        external_active = (
            display_target == "external"
            or output_order.startswith("HDMI-A-1")
            or "-O HDMI-A-1" in gamescope
            or _has_egpu_vk_in_gamescope(gamescope)
        )
        if external_active:
            log("init: gamescope in external mode, turning off internal backlight")
            try:
                internal_panel_off()
            except Exception as e:
                log(f"init: internal_panel_off failed: {e}")

    async def _unload(self):
        log("unload")

    async def status(self):
        return build_status()


    async def tv_on(self):
        # Full TV wake path:
        # tv_input() now performs Wake-on-LAN before ADB wake/input and also restores eGPU output
        # when the current SteamOS session is on the internal display.
        result = await self.tv_input()
        try:
            if isinstance(result, dict):
                result["action"] = "on"
                result["tv_on_path"] = "wol_adb_hdmi_display_restore"
        except Exception:
            pass
        return result

    async def tv_off(self):
        result = {
            "ok": False,
            "action": "off",
            "display_restore": None,
            "tv_off": None,
        }

        try:
            result["display_restore"] = await self.restore_internal_mode(restart=True)
        except Exception as e:
            result["display_restore"] = {
                "ok": False,
                "error": str(e),
            }

        try:
            import asyncio
            loop = asyncio.get_event_loop()
            result["tv_off"] = await loop.run_in_executor(None, tv_control_action, "off")
        except Exception as e:
            result["tv_off"] = {
                "ok": False,
                "error": str(e),
            }

        result["ok"] = bool(
            (isinstance(result.get("display_restore"), dict) and result["display_restore"].get("ok")) or
            (isinstance(result.get("tv_off"), dict) and result["tv_off"].get("ok"))
        )
        return result

    @staticmethod
    async def tv_input_mode(*args, **kwargs):
        """
        Apply selected TV resolution/frequency even when HDMI is already active.
        Safe path:
          gamescope_mode.conf + wrapper config + restart gamescope-session.target.
        """
        width = _decky_int(args, kwargs, "width", DEFAULT_WIDTH)
        height = _decky_int(args, kwargs, "height", DEFAULT_HEIGHT)
        refresh = _decky_int(args, kwargs, "refresh", DEFAULT_REFRESH)
        log(f"UI_CALL tv_input_mode width={width} height={height} refresh={refresh}")

        save_tv_last_mode(width, height, refresh)

        result = tv_control_action("input")
        result["requested_mode"] = {
            "width": int(width),
            "height": int(height),
            "refresh": int(refresh),
            "key": f"{int(width)}x{int(height)}@{int(refresh)}",
        }

        result["gamescope_mode_config"] = write_gamescope_mode_config(width, height, refresh)

        if not result["gamescope_mode_config"].get("ok"):
            result["display_switch"] = {
                "ok": False,
                "error": result["gamescope_mode_config"].get("error"),
            }
            result["ok"] = False
            return result

        try:
            result["display_switch"] = await Plugin.apply_egpu_mode(
                restart=True,
                width=int(width),
                height=int(height),
                refresh=int(refresh),
            )
        except Exception as e:
            result["display_switch"] = {
                "ok": False,
                "error": str(e),
            }

        result["ok"] = bool(result.get("ok")) or bool(
            isinstance(result.get("display_switch"), dict) and result["display_switch"].get("ok")
        )
        return result

    async def tv_input(self):
        import asyncio
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, tv_control_action, "input")

        try:
            status = await self.status()
            internal = status.get("internal_display") or {}
            external = status.get("external_display") or {}

            internal_active = bool(internal.get("active"))
            external_active = bool(external.get("active"))

            if internal_active or not external_active:
                cfg, _ = read_tv_config()
                mode = read_tv_last_mode(cfg)

                result["display_switch"] = await self.apply_egpu_mode(
                    restart=True,
                    width=mode["width"],
                    height=mode["height"],
                    refresh=mode["refresh"],
                )
            else:
                result["display_switch"] = {
                    "ok": True,
                    "skipped": True,
                    "reason": "external display already active",
                }

            result["ok"] = bool(result.get("ok")) or bool(
                isinstance(result.get("display_switch"), dict) and result["display_switch"].get("ok")
            )

        except Exception as e:
            result["display_switch"] = {
                "ok": False,
                "error": str(e),
            }

        return result


    async def prepare_for_unplug(self):
        """
        Safe preparation before physically unplugging USB4/eGPU.
        This does NOT remove the PCI device.
        It restores the internal gamescope config, restarts sddm/Steam UI,
        and writes a log telling the user when unplugging is expected to be safe.
        """
        status = build_status()
        egpu = (status or {}).get("egpu") or {}
        external = (status or {}).get("external_display") or {}
        internal = (status or {}).get("internal_display") or {}

        paths = (status or {}).get("paths") or {}
        gamescope_session = paths.get("gamescope_session") or str(GAMESCOPE_SESSION)
        backup_original = paths.get("backup_original") or str(BACKUP_ORIGINAL)

        script_path = Path("/tmp/egpubridge-prepare-unplug.sh")
        log_path = "/tmp/egpubridge-prepare-unplug.log"

        script_lines = [
            "#!/bin/bash",
            "set -u",
            "",
            f"LOG={log_path}",
            "",
            'echo "=== eGPUBridge Prepare for unplug start $(date) ===" > "$LOG"',
            f'echo "egpu_present={bool(egpu)}" >> "$LOG"',
            f'echo "external_active={bool(external.get("active"))}" >> "$LOG"',
            f'echo "internal_active={bool(internal.get("active"))}" >> "$LOG"',
            "",
            'echo "--- restore internal gamescope config ---" >> "$LOG"',
            f'if [ -f "{backup_original}" ]; then',
            f'  cp -a "{backup_original}" "{gamescope_session}" >> "$LOG" 2>&1',
            f'  chmod 755 "{gamescope_session}" >> "$LOG" 2>&1 || true',
            '  echo "internal gamescope config restored" >> "$LOG"',
            "else",
            f'  echo "backup original not found: {backup_original}" >> "$LOG"',
            "fi",
            "",
            'echo "--- restart sddm / close Steam session ---" >> "$LOG"',
            'systemctl restart sddm >> "$LOG" 2>&1 || true',
            "",
            'echo "--- wait for Steam UI restart ---" >> "$LOG"',
            "sleep 8",
            "",
            'echo "READY: internal mode requested. You can unplug USB4/eGPU after the internal screen is visible and stable." >> "$LOG"',
            'echo "IMPORTANT: this script did NOT remove the PCI device." >> "$LOG"',
            'echo "=== eGPUBridge Prepare for unplug done $(date) ===" >> "$LOG"',
            "",
        ]

        try:
            script_path.write_text("\n".join(script_lines))
            script_path.chmod(0o755)
        except Exception as e:
            return {
                "ok": False,
                "error": f"Failed to write prepare script: {e}",
                "script_path": str(script_path),
            }

        # Do NOT use systemd-run here.
        # Decky/PluginLoader can run from a bundled PyInstaller environment
        # whose LD_LIBRARY_PATH may shadow system OpenSSL/libcrypto and break systemd-run.
        # Start the helper script directly, detached, with a clean environment.
        try:
            clean_env = {
                "PATH": "/usr/sbin:/usr/bin:/sbin:/bin",
                "HOME": "/root",
                "LANG": "C.UTF-8",
                "LC_ALL": "C.UTF-8",
            }
            p = subprocess.Popen(
                ["/bin/bash", str(script_path)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                stdin=subprocess.DEVNULL,
                start_new_session=True,
                close_fds=True,
                env=clean_env,
            )
            res = {
                "ok": True,
                "rc": 0,
                "pid": p.pid,
                "cmd": ["/bin/bash", str(script_path)],
                "method": "subprocess.Popen detached clean env",
            }
        except Exception as e:
            res = {
                "ok": False,
                "rc": -1,
                "error": str(e),
                "cmd": ["/bin/bash", str(script_path)],
                "method": "subprocess.Popen detached clean env",
            }

        return {
            "ok": bool(res.get("ok")),
            "action": "prepare_for_unplug",
            "message": "Prepare for unplug started. Wait until internal screen is visible and stable, then unplug USB4/eGPU.",
            "script": str(script_path),
            "log": log_path,
            "launcher": res,
        }


    @staticmethod
    async def apply_egpu_mode(*args, **kwargs):
        restart = _decky_bool(args, kwargs, "restart", False)
        explicit_mode_request = any(_decky_call_value(args, kwargs, k, None) is not None for k in ("width", "height", "refresh"))
        width = _decky_int(args, kwargs, "width", DEFAULT_WIDTH)
        height = _decky_int(args, kwargs, "height", DEFAULT_HEIGHT)
        refresh = _decky_int(args, kwargs, "refresh", DEFAULT_REFRESH)
        log(f"UI_CALL apply_egpu_mode restart={restart} explicit_mode={explicit_mode_request} width={width} height={height} refresh={refresh}")
        """
        eGPUBridge 0.2.00 safe path:
        use wrapper config + gamescope-session restart.
        Do NOT patch /usr/lib/steamos/gamescope-session.
        """
        status = build_status(heavy=True)
        egpu = status.get("egpu")
        connector = status.get("recommended_connector")

        if not egpu:
            return {"ok": False, "error": "eGPU не найден"}

        if not connector:
            return {"ok": False, "error": "На eGPU нет connected-коннектора. Проверь HDMI/DP кабель и вход ТВ."}

        vendor = egpu.get("vendor", "").lower().replace("0x", "")
        device = egpu.get("device", "").lower().replace("0x", "")
        if not vendor or not device:
            return {"ok": False, "error": "Не удалось определить vendor/device eGPU"}

        output_name = connector.get("name") or "HDMI-A-1"
        vendor_device = f"{vendor}:{device}"
        # FPS/MES stability profile:
        # HDMI-only is safer for TV/eGPU mode.
        # Do NOT append eDP-1 here, otherwise internal scanout stays enabled.
        output_order = f"{output_name}"

        result = write_gamescope_wrapper_config(output_order, vendor_device)
        if result.get("ok") and explicit_mode_request:
            result["gamescope_mode_config"] = write_gamescope_mode_config(width, height, refresh)
            if not result["gamescope_mode_config"].get("ok"):
                result["ok"] = False
                result["error"] = result["gamescope_mode_config"].get("error")
                return result
        result["action"] = "apply_egpu_mode"
        result["restart_requested"] = bool(restart)
        result["mode_request"] = f"{int(width)}x{int(height)}@{int(refresh)}"

        if restart and result.get("ok"):
            import asyncio
            loop = asyncio.get_event_loop()
            restart_result = await loop.run_in_executor(None, _apply_restart_sync)
            result["restart_gamescope_session"] = restart_result

        result["status_after"] = build_status()
        return result


    @staticmethod
    async def restore_internal_mode(*args, **kwargs):
        restart = _decky_bool(args, kwargs, "restart", False)
        log(f"UI_CALL restore_internal_mode restart={restart}")
        """
        Restore to internal display using safe wrapper config.
        Do NOT patch /usr/lib/steamos/gamescope-session.
        """
        sleep_after_restore = str(restart).lower() in ("sleep", "suspend", "prepare_sleep", "prepare-sleep")
        restart_requested = bool(restart)

        result = write_gamescope_wrapper_config("*,eDP-1", "disabled")
        result["gamescope_mode_config"] = write_gamescope_mode_config(disabled=True)
        result["action"] = "restore_internal_mode"
        result["restart_requested"] = restart_requested
        result["sleep_after_restore"] = sleep_after_restore

        try:
            internal_panel_on()
        except Exception:
            pass

        if restart_requested and result.get("ok"):
            import asyncio
            loop = asyncio.get_event_loop()
            restart_result = await loop.run_in_executor(None, _restore_restart_sync)
            result["restart_gamescope_session"] = restart_result

        if sleep_after_restore:
            sleep_run = run(["/usr/bin/systemctl", "suspend"], timeout=10)
            result["sleep_run"] = sleep_run

        result["status_after"] = build_status()
        return result


    @staticmethod
    async def safe_disconnect(*args, **kwargs):
        log("UI_CALL safe_disconnect")
        return safe_disconnect_egpu()

    @staticmethod
    async def safe_reconnect(*args, **kwargs):  # orphaned: not called from frontend
        log("UI_CALL safe_reconnect")
        return safe_reconnect_egpu()


    @staticmethod
    async def smart_toggle_display(*args, **kwargs):
        if not _begin_operation("smart_toggle"):
            return {"ok": False, "error": "Operation already in progress: " + str(_operation_lock)}
        try:
            restart = _decky_bool(args, kwargs, "restart", True)
            log(f"UI_CALL smart_toggle_display restart={restart}")
            """
            Smart Toggle Display.

            If current Gamescope target is external TV/eGPU:
                switch back to internal display.

            If current Gamescope target is internal:
                switch to TV/eGPU using the known-good wrapper path.

            Safe path:
                output_order.conf
                prefer_vk_device.conf
                restart gamescope-session.target
            """
            status = build_status(heavy=True)
            patch = status.get("patch_state") or {}
            gamescope = status.get("gamescope") or ""
            display_target = status.get("display_target") or "unknown"
            output_order = patch.get("output_order") or ""

            external_active = (
                display_target == "external"
                or output_order.startswith("HDMI-A-1")
                or "-O HDMI-A-1" in gamescope
                or _has_egpu_vk_in_gamescope(gamescope)
            )

            result = {
                "ok": False,
                "action": "smart_toggle_display",
                "from_display": "external" if external_active else "internal",
                "restart_requested": bool(restart),
                "before": {
                    "display_target": display_target,
                    "output_order": output_order,
                    "gamescope": gamescope,
                },
            }

            if external_active:
                result["to_display"] = "internal"
                switch_result = await Plugin.restore_internal_mode(restart=restart)
            else:
                result["to_display"] = "external"
                switch_result = await Plugin.apply_egpu_mode(restart=restart)

            result["switch_result"] = switch_result
            result["ok"] = bool(isinstance(switch_result, dict) and switch_result.get("ok"))

            after = build_status(heavy=False)
            result["after"] = {
                "display_target": after.get("display_target"),
                "gamescope": after.get("gamescope"),
                "patch_state": after.get("patch_state"),
            }

            return result
        finally:
            _end_operation()


    async def restart_sddm(self):  # orphaned: not called from frontend
        return restart_sddm()

    async def internal_panel_off(self):
        return internal_panel_off()

    async def internal_panel_on(self):
        return internal_panel_on()

    async def recent_events(self, minutes: int = 10):
        """
        Return recent useful system events after user presses the Events button.
        Focused on eGPUBridge, gamescope, sddm, Steam UI, amdgpu, PCIe/USB4,
        suspend/resume and common crash/hang messages.
        """
        try:
            m = int(minutes)
        except Exception:
            m = 10

        if m < 1:
            m = 1
        if m > 60:
            m = 60

        res = run([
            "/usr/bin/journalctl",
            "-b",
            "--since", f"{m} minutes ago",
            "--no-pager",
        ], timeout=14)

        out = (res.get("out") or "") + "\n" + (res.get("err") or "")

        # Focused event filter.
        # Avoid generic PluginLoader/CSS Loader noise unless it is clearly related
        # to eGPUBridge, gamescope, display, ADB/TV, USB4/PCIe or GPU stability.
        include_needles = [
            "egpubridge",
            "egpu",
            "gamescope",
            "sddm",
            "amdgpu",
            "drm",
            "hdmi",
            "display",
            "connector",
            "usb4",
            "thunderbolt",
            "pciehp",
            "pcie",
            "aer",
            "dpc",
            "device lost from bus",
            "gpu reset",
            "ring gfx",
            "ring sdma",
            "smu",
            "transfertablesmu2dram",
            "failed to export smu",
            "adb",
            "android debug bridge",
            "tv",
            "tcl",
            "wakeup",
            "resume",
            "suspend",
            "blocked for more than",
            "soft lockup",
            "hard lockup",
        ]

        exclude_needles = [
            "sudo[",
            "tty=pts",
            "command=/usr/bin/cp ",
            "command=/usr/bin/python3 -",
            "command=/usr/bin/grep ",
            "command=/usr/bin/mv ",
            "command=/usr/bin/touch ",
            "command=/usr/bin/chmod ",
            "command=/usr/bin/systemctl restart plugin_loader.service",
            "steamos_log_submitter",
            "plugin egpubridge is already loaded",
            "metadata display",
            "could not get game info",
            "no valid store:game_id",
            "initializing epicconnector",
            "initializing amazonconnector",
            "initializing microsoftconnector",
            "downloadqueue initialized",
            "css_loader",
            "css loader",
            "loading theme",
            "injecting theme",
            "injecting patch",
            "loaded css",
            "tabmaster",
            "unifideck",
            "ubisoft",
            "steamgriddb",
            "audio loader",
            "game theme music",
            "decky translator",
            "vibrantdeck",
            "screen saver",
            "screensaver",
            "microdeck",
            "microsdeck",
            "friendsgames",
            "got tabs",
            "got tab profiles",
            "got 450 tags",
            "saving tabs",
        ]

        severe_needles = [
            "traceback",
            "exception",
            "segfault",
            "panic",
            "gpu reset",
            "device lost from bus",
            "blocked for more than",
            "soft lockup",
            "hard lockup",
        ]

        lines = []
        for line in out.splitlines():
            low = line.lower()

            include = any(x in low for x in include_needles)
            severe = any(x in low for x in severe_needles)
            excluded = any(x in low for x in exclude_needles)

            if (include or severe) and not excluded:
                lines.append(line)

        # Keep the newest useful lines.
        lines = lines[-80:]

        return {
            "ok": res.get("rc") == 0,
            "action": "recent_events",
            "minutes": m,
            "count": len(lines),
            "events": lines if lines else ["No relevant events found in the selected window."],
            "journalctl": {
                "ok": res.get("rc") == 0,
                "rc": res.get("rc"),
                "cmd": res.get("cmd"),
            },
        }

    async def support_report(self):  # orphaned: not called from frontend
        return build_support_report()

    async def adb_status(self):
        return adb_status()

    async def install_adb(self):
        return install_adb()

    async def save_tv_ip(self, *args, **kwargs):
        ip = _decky_str(args, kwargs, "ip", "")
        return save_tv_ip(ip)

    async def get_tv_ip(self):
        return get_tv_ip()

    async def check_tv_online(self, *args, **kwargs):  # orphaned: not called from frontend
        ip = _decky_str(args, kwargs, "ip", None)
        return check_tv_online(ip)

    async def collect_diagnostics(self):
        return collect_diagnostics()

    async def clear_override(self):  # orphaned: not called from frontend
        removed = False
        if ENV_OVERRIDE.exists():
            ENV_OVERRIDE.unlink()
            removed = True
        return {"ok": True, "removed": removed, "status_after": build_status()}


if __name__ == "__main__":
    import sys
    import asyncio

    async def _cli():
        cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
        plugin = Plugin()

        try:
            if cmd == "status":
                res = await plugin.status()
            elif cmd == "apply":
                res = await plugin.apply_egpu_mode(restart=False)
            elif cmd == "apply-restart":
                res = await plugin.apply_egpu_mode(restart=True)

            elif cmd == "apply-1080":
                res = await plugin.apply_egpu_mode(restart=False, width=1920, height=1080, refresh=60)

            elif cmd == "apply-1080-restart":
                res = await plugin.apply_egpu_mode(restart=True, width=1920, height=1080, refresh=60)

            elif cmd == "apply-4k":
                res = await plugin.apply_egpu_mode(restart=False, width=3840, height=2160, refresh=60)

            elif cmd == "apply-4k-restart":
                res = await plugin.apply_egpu_mode(restart=True, width=3840, height=2160, refresh=60)
            elif cmd == "restore":
                res = await plugin.restore_internal_mode(restart=False)
            elif cmd == "restore-restart":
                res = await plugin.restore_internal_mode(restart=True)
            elif cmd == "restart":
                res = await plugin.restart_sddm()
            elif cmd == "clear-override":
                res = await plugin.clear_override()
            else:
                res = {
                    "ok": False,
                    "error": f"Unknown command: {cmd}",
                    "commands": [
                        "status",
                        "apply",
                        "apply-restart",
                        "apply-1080",
                        "apply-1080-restart",
                        "apply-4k",
                        "apply-4k-restart",
                        "restore",
                        "restore-restart",
                        "restart",
                        "clear-override",
                    ],
                }

            print(json.dumps(res, indent=2, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({"ok": False, "error": str(e)}, indent=2, ensure_ascii=False))
            raise SystemExit(1)

    asyncio.run(_cli())


# SAFE_TV_CONTROL_HEALTH_8100501
def detect_tv_control_health_safe():
    """
    Diagnostics-only TV Control BETA health.
    Safe:
    - does not switch display
    - does not restart Gamescope
    - does not run adb/wol/cec commands
    - only checks paths/config/light network status
    """
    import shutil
    from pathlib import Path as _Path

    try:
        cfg, cfg_error = read_tv_config()
    except Exception as e:
        cfg = {}
        cfg_error = str(e)

    adb_path = _egpubridge_resolve_local_tool("adb")
    wakeonlan_path = _egpubridge_resolve_local_tool("wakeonlan")
    etherwake_path = _egpubridge_resolve_local_tool("etherwake")
    wol_path = wakeonlan_path or etherwake_path
    cec_ctl_path = _egpubridge_resolve_local_tool("cec-ctl")
    cec_client_path = _egpubridge_resolve_local_tool("cec-client")

    try:
        cec_devices = sorted(str(x) for x in _Path("/dev").glob("cec*") if x.exists())
    except Exception:
        cec_devices = []

    try:
        tv_network = detect_tv_network_state()
    except TypeError:
        try:
            tv_network = detect_tv_network_state(cfg)
        except Exception as e:
            tv_network = {"ok": False, "reachable": False, "label": "Unknown", "error": str(e)}
    except Exception as e:
        tv_network = {"ok": False, "reachable": False, "label": "Unknown", "error": str(e)}

    ip = str(cfg.get("TV_IP") or "").strip()
    mac = str(cfg.get("TV_MAC") or "").strip()
    adb_port = str(cfg.get("TV_ADB_PORT") or "5555").strip()

    try:
        connector, connector_source = get_active_display_connector_for_tv()
    except Exception:
        connector, connector_source = "", "unknown"

    hdmi_num = ""
    input_id = ""
    try:
        map_key = "TV_CONNECTOR_" + normalize_connector_key(connector)
        hdmi_num = str(cfg.get(map_key) or cfg.get("TV_DEFAULT_HDMI") or "1").strip()
        input_id = str(cfg.get(f"TV_HDMI_{hdmi_num}") or "").strip()
    except Exception:
        pass

    has_adb = bool(adb_path)
    has_builtin_wol = True
    has_wol_tool = bool(wol_path)
    has_wol = bool((wol_path or has_builtin_wol) and mac and mac.upper() != "AA:BB:CC:DD:EE:FF")
    has_cec = bool(cec_ctl_path and cec_devices)
    tv_reachable = bool(tv_network.get("reachable"))

    can_tv_on = bool(has_wol or has_adb or has_cec)
    can_hdmi = bool((has_adb and tv_reachable and input_id) or has_cec)
    can_tv_off = bool((has_adb and tv_reachable) or has_cec)

    missing = []
    if not has_adb:
        missing.append("ADB not found")
    if not has_wol:
        missing.append("WoL not available")
    elif not has_wol_tool:
        # Built-in Python WoL is available, external wakeonlan package is not required.
        pass
    if not cec_devices:
        missing.append("CEC device not found")
    if not tv_reachable:
        missing.append("TV not reachable")
    if not input_id:
        missing.append("HDMI input mapping missing")

    if has_cec:
        label = "CEC ready"
    elif has_adb and tv_reachable and input_id:
        label = "ADB ready"
    elif tv_reachable and not (has_adb or has_wol or has_cec):
        label = "TV reachable, control tools missing"
    elif has_wol and not has_adb and not has_cec:
        label = "WoL ready for TV ON"
    elif can_tv_on or can_hdmi or can_tv_off:
        label = "Partial"
    else:
        label = "Not ready"

    return {
        "ok": bool(can_tv_on or can_hdmi or can_tv_off),
        "label": label,
        "tv_ip": ip,
        "tv_mac_set": bool(mac and mac.upper() != "AA:BB:CC:DD:EE:FF"),
        "adb": {
            "ok": has_adb,
            "path": adb_path,
            "target": f"{ip}:{adb_port}" if ip else "",
        },
        "wol": {
            "ok": has_wol,
            "tool_found": has_wol_tool,
            "builtin": has_builtin_wol,
            "path": wol_path,
            "wakeonlan_path": wakeonlan_path,
            "etherwake_path": etherwake_path,
        },
        "cec": {
            "ok": has_cec,
            "cec_ctl_path": cec_ctl_path,
            "cec_client_path": cec_client_path,
            "devices": cec_devices,
        },
        "network": tv_network,
        "hdmi": {
            "connector": connector,
            "connector_source": connector_source,
            "hdmi_num": hdmi_num,
            "input_id_set": bool(input_id),
        },
        "buttons": {
            "tv_on": can_tv_on,
            "hdmi": can_hdmi,
            "tv_off": can_tv_off,
        },
        "missing": missing,
        "config_error": cfg_error,
        "source": "safe-tv-control-health",
    }


async def _egpubridge_tv_control_health_method(*args, **kwargs):
    return detect_tv_control_health_safe()


try:
    Plugin.tv_control_health = staticmethod(_egpubridge_tv_control_health_method)
except Exception:
    pass


# TV_POWER_LIGHT_91007
def detect_tv_power_light():
    """Lightweight TV power state check via ping + ADB dumpsys power."""
    cfg, cfg_err = read_tv_config()
    ip = cfg.get("TV_IP") or ""
    port = cfg.get("TV_ADB_PORT") or "5555"
    adb_path = _egpubridge_resolve_local_tool("adb")

    # Detect TV model from config comments
    tv_name = "TV"
    try:
        cfg_path = Path.home() / ".config" / "egpubridge-tv.conf"
        if cfg_path.exists():
            for line in cfg_path.read_text().splitlines():
                if "TCL" in line and ("C745" in line or "C755" in line):
                    tv_name = "TCL C745"
                    break
    except Exception:
        pass

    if not ip:
        return {"ok": False, "tv_on": None, "label": "Unknown", "error": "No TV IP", "tv_name": tv_name}

    # Check network reachability first (fast ping)
    try:
        p = subprocess.run(["ping", "-c", "1", "-W", "1", ip], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=3)
        if p.returncode != 0:
            return {"ok": True, "tv_on": False, "label": "Off", "reachable": False, "tv_name": tv_name}
    except Exception:
        return {"ok": True, "tv_on": False, "label": "Off", "reachable": False, "tv_name": tv_name}

    # TV is reachable, try ADB if available
    if not adb_path:
        return {"ok": True, "tv_on": True, "label": "On", "reachable": True, "tv_name": tv_name}

    adb_target = f"{ip}:{port}"
    try:
        subprocess.run([adb_path, "connect", adb_target], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=3)
        time.sleep(0.5)
        p = subprocess.run([adb_path, "-s", adb_target, "shell", "dumpsys", "power"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
        low = (p.stdout or "").lower()

        awake = "mwakefulness=awake" in low or "wakefulness=awake" in low or "display power: state=on" in low
        asleep = "mwakefulness=asleep" in low or "wakefulness=asleep" in low or "display power: state=off" in low

        if awake and not asleep:
            return {"ok": True, "tv_on": True, "label": "On", "reachable": True, "tv_name": tv_name}
        elif asleep and not awake:
            return {"ok": True, "tv_on": False, "label": "Off", "reachable": True, "tv_name": tv_name}
        else:
            # reachable but unknown state = assume on
            return {"ok": True, "tv_on": True, "label": "On", "reachable": True, "tv_name": tv_name}
    except Exception as e:
        return {"ok": True, "tv_on": True, "label": "On", "reachable": True, "note": str(e), "tv_name": tv_name}


async def _egpubridge_tv_power_light_method(*args, **kwargs):
    return detect_tv_power_light()


try:
    Plugin.tv_power_light = staticmethod(_egpubridge_tv_power_light_method)
except Exception:
    pass



# BUILTIN_WOL_81009
def _egpubridge_send_wol_packet_safe(mac: str, ip: str = "", repeats: int = 3):
    """
    Internal Wake-on-LAN sender.
    Safe:
    - no external wakeonlan/etherwake dependency
    - sends only UDP magic packets
    - does not touch display/Gamescope
    """
    import socket
    import re

    raw_mac = str(mac or "").strip()
    clean = re.sub(r"[^0-9A-Fa-f]", "", raw_mac)

    if len(clean) != 12:
        return {
            "ok": False,
            "rc": -1,
            "stage": "python_wol",
            "error": f"invalid MAC address: {raw_mac!r}",
            "mac": raw_mac,
        }

    try:
        mac_bytes = bytes.fromhex(clean)
        packet = b"\xff" * 6 + mac_bytes * 16

        targets = ["255.255.255.255"]
        ip = str(ip or "").strip()
        parts = ip.split(".")
        if len(parts) == 4 and all(x.isdigit() and 0 <= int(x) <= 255 for x in parts):
            targets.append(".".join(parts[:3] + ["255"]))

        # dedupe while keeping order
        seen = set()
        targets = [x for x in targets if not (x in seen or seen.add(x))]

        sent = []
        errors = []

        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            sock.settimeout(2)
            for target in targets:
                for port in (9, 7):
                    for _ in range(max(1, int(repeats))):
                        try:
                            sock.sendto(packet, (target, port))
                            sent.append(f"{target}:{port}")
                        except Exception as e:
                            errors.append(f"{target}:{port}: {e}")
        finally:
            sock.close()

        return {
            "ok": bool(sent),
            "rc": 0 if sent else -1,
            "stage": "python_wol",
            "method": "internal-python-wol",
            "mac": raw_mac,
            "targets": sorted(set(sent)),
            "errors": errors[-5:],
        }

    except Exception as e:
        return {
            "ok": False,
            "rc": -1,
            "stage": "python_wol",
            "method": "internal-python-wol",
            "mac": raw_mac,
            "error": str(e),
        }


# === ADB INSTALL / STATUS ===
ADB_PLATFORM_TOOLS_URL = "https://dl.google.com/android/repository/platform-tools-latest-linux.zip"

def _adb_bin_path():
    return PLUGIN_DIR / "bin" / "platform-tools" / "adb"

def adb_status():
    """Check if ADB is installed and accessible."""
    adb_path = _adb_bin_path()
    installed = adb_path.exists() and os.access(str(adb_path), os.X_OK)
    version = None
    if installed:
        try:
            p = subprocess.run([str(adb_path), "version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
            if p.returncode == 0:
                version = (p.stdout or "").strip().split("\n")[0]
        except Exception:
            pass
    return {
        "ok": True,
        "source": "adb-status",
        "installed": installed,
        "path": str(adb_path),
        "version": version,
    }

def install_adb():
    """Download and install Android platform-tools (adb) into plugin bin."""
    import zipfile
    import tempfile
    bin_dir = PLUGIN_DIR / "bin"
    target_dir = bin_dir / "platform-tools"
    adb_path = target_dir / "adb"

    # Already installed
    if adb_path.exists() and os.access(str(adb_path), os.X_OK):
        return {"ok": True, "source": "adb-install", "message": "ADB already installed", "path": str(adb_path)}

    try:
        bin_dir.mkdir(parents=True, exist_ok=True)
        target_dir.mkdir(parents=True, exist_ok=True)

        log("ADB install: downloading platform-tools...")
        req = __import__("urllib.request", fromlist=["urlretrieve"])
        zip_path = os.path.join(str(bin_dir), "platform-tools.zip")
        req.urlretrieve(ADB_PLATFORM_TOOLS_URL, zip_path)

        log("ADB install: extracting...")
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(str(bin_dir))

        # Cleanup zip
        try:
            os.remove(zip_path)
        except Exception:
            pass

        # Make adb executable
        if adb_path.exists():
            os.chmod(str(adb_path), 0o755)
            log("ADB install: done, adb at " + str(adb_path))
            return {"ok": True, "source": "adb-install", "message": "ADB installed", "path": str(adb_path)}
        else:
            return {"ok": False, "source": "adb-install", "error": "adb binary not found after extract"}

    except Exception as e:
        log("ADB install failed: " + repr(e))
        return {"ok": False, "source": "adb-install", "error": str(e)}


# === TV IP CONFIG ===
TV_CONF_PATH = Path("/home/deck/.config/egpubridge-tv.conf")

def _read_tv_conf():
    """Read TV config from existing egpubridge-tv.conf."""
    cfg = {}
    try:
        if TV_CONF_PATH.exists():
            for line in TV_CONF_PATH.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    cfg[k.strip()] = v.strip()
    except Exception:
        pass
    return cfg

def _write_tv_conf_value(key, value):
    """Update a single value in egpubridge-tv.conf."""
    try:
        lines = []
        found = False
        if TV_CONF_PATH.exists():
            lines = TV_CONF_PATH.read_text(encoding="utf-8").splitlines(keepends=True)
        new_lines = []
        for line in lines:
            stripped = line.strip()
            if stripped.startswith(key + "="):
                new_lines.append(key + "=" + str(value) + "\n")
                found = True
            else:
                new_lines.append(line)
        if not found:
            new_lines.append(key + "=" + str(value) + "\n")
        TV_CONF_PATH.write_text("".join(new_lines), encoding="utf-8")
    except Exception as e:
        log("TV conf write error: " + repr(e))

def save_tv_ip(ip):
    """Save TV IP address to config."""
    ip = str(ip or "").strip()
    # Validate IP format
    parts = ip.split(".")
    if len(parts) != 4:
        return {"ok": False, "error": "Invalid IP format (need 4 octets)"}
    for p in parts:
        try:
            n = int(p)
            if n < 0 or n > 255:
                return {"ok": False, "error": "Octet " + p + " out of range (0-255)"}
        except ValueError:
            return {"ok": False, "error": "Invalid octet: " + p}
    _write_tv_conf_value("TV_IP", ip)
    log("TV IP saved: " + ip)
    return {"ok": True, "tv_ip": ip}

def get_tv_ip():
    """Get saved TV IP."""
    cfg = _read_tv_conf()
    return {"ok": True, "tv_ip": cfg.get("TV_IP", "")}

def check_tv_online(ip=None):
    """Check if TV is reachable via ping."""
    if not ip:
        cfg = _read_tv_conf()
        ip = cfg.get("TV_IP", "")
    ip = str(ip).strip()
    if not ip:
        return {"ok": False, "error": "No TV IP configured"}
    try:
        p = subprocess.run(["ping", "-c", "1", "-W", "2", ip], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
        reachable = p.returncode == 0
        return {"ok": True, "tv_ip": ip, "reachable": reachable, "output": (p.stdout or "")[-500:]}
    except Exception as e:
        return {"ok": False, "tv_ip": ip, "error": str(e)}


# === DIAGNOSTICS ===
def collect_diagnostics():
    """Collect system diagnostics for troubleshooting."""
    info = {
        "ok": True,
        "source": "diagnostics",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "plugin_version": VERSION,
    }

    # System info
    try:
        info["hostname"] = os.uname().nodename
        info["kernel"] = os.uname().release
    except Exception:
        pass

    # CPU info
    try:
        with open("/proc/cpuinfo", "r") as f:
            lines = f.readlines()
        for line in lines:
            if "model name" in line:
                info["cpu"] = line.split(":")[1].strip()
                break
    except Exception:
        pass

    # Memory
    try:
        with open("/proc/meminfo", "r") as f:
            for line in f:
                if line.startswith("MemTotal"):
                    info["ram"] = line.split(":")[1].strip()
                    break
    except Exception:
        pass

    # GPU info
    try:
        p = subprocess.run(["lspci"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
        gpus = []
        for line in (p.stdout or "").split("\n"):
            if "VGA" in line or "Display" in line or "3D" in line:
                gpus.append(line.strip())
        info["gpus"] = gpus
    except Exception:
        pass

    # ADB status
    info["adb"] = adb_status()

    # Display info
    try:
        p = subprocess.run(["xrandr", "--query"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
        displays = []
        for line in (p.stdout or "").split("\n"):
            if " connected" in line:
                displays.append(line.strip())
        info["displays"] = displays
    except Exception:
        pass

    # Gamescope session
    info["gamescope_session"] = GAMESCOPE_SESSION.exists()
    try:
        info["gamescope_patched"] = not _is_original_gamescope()
    except Exception:
        info["gamescope_patched"] = None

    # Plugin log tail
    try:
        if LOG_PATH.exists():
            lines = LOG_PATH.read_text(encoding="utf-8", errors="replace").strip().split("\n")
            info["log_tail"] = lines[-30:]
    except Exception:
        pass

    # Error count from log
    try:
        if LOG_PATH.exists():
            content = LOG_PATH.read_text(encoding="utf-8", errors="replace")
            info["log_errors"] = content.lower().count("error")
            info["log_warnings"] = content.lower().count("warn")
    except Exception:
        pass

    # TV config
    info["tv_ip_config"] = _read_tv_conf()

    # Hotkey settings
    try:
        if _EGB_HOTKEY_SETTINGS_FILE_81107.exists():
            info["hotkey_settings"] = json.loads(_EGB_HOTKEY_SETTINGS_FILE_81107.read_text(encoding="utf-8"))
    except Exception:
        pass

    return info


# LOCAL_TOOL_RESOLVER_81012
def _egpubridge_resolve_local_tool(name: str):
    """
    Resolve tools from plugin-local bin first, then system PATH.
    Used for local ADB without changing SteamOS readonly or system PATH.
    """
    try:
        raw = str(name or "").strip()
        base = os.path.basename(raw)

        if raw and "/" in raw and os.access(raw, os.X_OK):
            return raw

        candidates = [
            PLUGIN_DIR / "bin" / base,
            PLUGIN_DIR / "bin" / "platform-tools" / base,
        ]

        for c in candidates:
            try:
                if c.exists() and os.access(str(c), os.X_OK):
                    return str(c)
            except Exception:
                pass

        return shutil.which(base)
    except Exception:
        return shutil.which(str(name or "").strip())



def run_tv_command(cmd, timeout=10):
    """
    Run TV control command with plugin-local tools.
    Uses clean environment and ADB key handling for root.
    Retries ADB commands on connection errors.
    """
    def _run_with_env(env):
        return subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout,
            env=env,
        )

    try:
        cmd = list(cmd or [])
        if not cmd:
            return {
                "ok": False,
                "rc": -1,
                "cmd": [],
                "stdout": "",
                "stderr": "empty command",
            }

        original_cmd = list(cmd)

        try:
            resolved0 = _egpubridge_resolve_local_tool(str(cmd[0]))
        except Exception:
            resolved0 = None

        if resolved0:
            cmd[0] = resolved0

        clean_env = {
            k: v for k, v in os.environ.items()
            if k not in ("LD_LIBRARY_PATH", "LD_PRELOAD", "PYTHONPATH", "PYTHONHOME")
        }

        plugin_bin = str(PLUGIN_DIR / "bin")
        platform_tools = str(PLUGIN_DIR / "bin" / "platform-tools")
        old_path = clean_env.get("PATH", "/usr/sbin:/usr/bin:/sbin:/bin")
        clean_env["PATH"] = platform_tools + ":" + plugin_bin + ":" + old_path

        # Decky backend may run as root. Use deck's ADB key store, because
        # the TV was already authorized from the deck user session.
        if os.geteuid() == 0 and Path("/home/deck").exists():
            clean_env["HOME"] = "/home/deck"
            adbkey = Path("/home/deck/.android/adbkey")
            if adbkey.exists():
                clean_env["ADB_VENDOR_KEYS"] = str(adbkey)

        p = _run_with_env(clean_env)

        # ADB reconnect retry on connection errors
        is_adb_cmd = Path(str(cmd[0])).name == "adb"
        if is_adb_cmd and p.returncode != 0:
            combined = ((p.stdout or "") + "\n" + (p.stderr or "")).lower()
            needs_reconnect = any(err in combined for err in (
                "device offline",
                "no devices/emulators found",
                "device unauthorized",
                "failed to connect",
            ))
            if needs_reconnect:
                try:
                    subprocess.run(
                        [cmd[0], "kill-server"],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        timeout=4,
                        env=clean_env,
                    )
                except Exception:
                    pass
                time.sleep(1)
                p = _run_with_env(clean_env)

        return {
            "ok": p.returncode == 0,
            "rc": p.returncode,
            "cmd": cmd,
            "original_cmd": original_cmd,
            "stdout": p.stdout[-4000:],
            "stderr": p.stderr[-4000:],
        }

    except Exception as e:
        return {
            "ok": False,
            "rc": -1,
            "cmd": list(cmd or []),
            "stdout": "",
            "stderr": str(e),
        }



# TV_CONTROL_UI_METHOD_OVERRIDES_8101302
def _egpubridge_tv_ui_log_8101302(message):
    try:
        import time as _time
        log_path = PLUGIN_DIR / "plugin.log"
        with open(log_path, "a", encoding="utf-8") as f:
            f.write("[" + _time.strftime("%Y-%m-%d %H:%M:%S") + "] " + str(message) + "\n")
    except Exception:
        pass


async def _egpubridge_ui_tv_on_8101302(*args, **kwargs):
    _egpubridge_tv_ui_log_8101302("UI_CALL tv_on")
    return tv_control_action("on")


async def _egpubridge_ui_tv_input_8101302(*args, **kwargs):
    _egpubridge_tv_ui_log_8101302("UI_CALL tv_input")
    return tv_control_action("input")


async def _egpubridge_ui_tv_off_8101302(*args, **kwargs):
    _egpubridge_tv_ui_log_8101302("UI_CALL tv_off")
    return tv_control_action("off")


try:
    Plugin.tv_on = staticmethod(_egpubridge_ui_tv_on_8101302)
    Plugin.tv_input = staticmethod(_egpubridge_ui_tv_input_8101302)
    Plugin.tv_off = staticmethod(_egpubridge_ui_tv_off_8101302)
    _egpubridge_tv_ui_log_8101302("TV_CONTROL_UI_METHOD_OVERRIDES_8101302 installed")
except Exception as e:
    try:
        _egpubridge_tv_ui_log_8101302("TV_CONTROL_UI_METHOD_OVERRIDES_8101302 failed: " + repr(e))
    except Exception:
        pass




# TV_CONTROL_AUTOMATION_SETTINGS_81101
def _egb_tv_auto_base_81101():
    try:
        return PLUGIN_DIR
    except Exception:
        from pathlib import Path as _Path
        return _Path("/home/deck/homebrew/plugins/eGPUBridge")


def _egb_tv_auto_settings_path_81101():
    return _egb_tv_auto_base_81101() / "tv_control_automation.json"


def _egb_tv_auto_log_81101(message):
    log(str(message))


def _egb_tv_auto_bool_81101(value, default=False):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        v = value.strip().lower()
        if v in ("1", "true", "yes", "on", "enable", "enabled", "да", "вкл", "включено"):
            return True
        if v in ("0", "false", "no", "off", "disable", "disabled", "нет", "выкл", "выключено"):
            return False
    return default


def _egb_tv_auto_defaults_81101():
    return {
        "tv_control_automation_enabled": False,
        "tv_off_on_internal_enabled": False,
    }


def _egb_tv_auto_read_81101():
    import json as _json

    path = _egb_tv_auto_settings_path_81101()
    defaults = _egb_tv_auto_defaults_81101()

    data = {}
    try:
        if path.exists():
            raw = path.read_text(encoding="utf-8").strip()
            if raw:
                loaded = _json.loads(raw)
                if isinstance(loaded, dict):
                    data = loaded
    except Exception as e:
        _egb_tv_auto_log_81101("TV_AUTO_SETTINGS_READ_ERROR " + repr(e))
        data = {}

    out = dict(defaults)
    for key in defaults:
        if key in data:
            out[key] = _egb_tv_auto_bool_81101(data.get(key), defaults[key])

    return out


def _egb_tv_auto_write_81101(updates):
    import json as _json
    import os as _os

    path = _egb_tv_auto_settings_path_81101()
    current = _egb_tv_auto_read_81101()

    if isinstance(updates, dict):
        for key in current:
            if key in updates:
                current[key] = _egb_tv_auto_bool_81101(updates.get(key), current[key])

    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = str(path) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        _json.dump(current, f, indent=2, ensure_ascii=False)
        f.write("\n")
    _os.replace(tmp, path)

    return current


async def _egb_get_tv_automation_settings_81101(*args, **kwargs):
    settings = _egb_tv_auto_read_81101()
    return {
        "ok": True,
        "source": "tv-control-automation-settings-81101",
        "settings": settings,
        "tv_control_automation_enabled": settings.get("tv_control_automation_enabled", False),
        "tv_off_on_internal_enabled": settings.get("tv_off_on_internal_enabled", False),
    }


async def _egb_set_tv_automation_settings_81101(*args, **kwargs):
    payload = {}

    try:
        if args and isinstance(args[0], dict):
            payload.update(args[0])
    except Exception:
        pass

    try:
        payload.update(kwargs)
    except Exception:
        pass

    updates = {}

    if "tv_control_automation_enabled" in payload:
        updates["tv_control_automation_enabled"] = payload.get("tv_control_automation_enabled")
    elif "enabled" in payload:
        updates["tv_control_automation_enabled"] = payload.get("enabled")

    if "tv_off_on_internal_enabled" in payload:
        updates["tv_off_on_internal_enabled"] = payload.get("tv_off_on_internal_enabled")
    elif "off_on_internal" in payload:
        updates["tv_off_on_internal_enabled"] = payload.get("off_on_internal")

    settings = _egb_tv_auto_write_81101(updates)
    _egb_tv_auto_log_81101("TV_AUTO_SETTINGS_SET " + str(settings))

    return {
        "ok": True,
        "source": "tv-control-automation-settings-81101",
        "settings": settings,
        "tv_control_automation_enabled": settings.get("tv_control_automation_enabled", False),
        "tv_off_on_internal_enabled": settings.get("tv_off_on_internal_enabled", False),
    }


try:
    Plugin.get_tv_automation_settings = staticmethod(_egb_get_tv_automation_settings_81101)
    Plugin.set_tv_automation_settings = staticmethod(_egb_set_tv_automation_settings_81101)
    _egb_tv_auto_log_81101("TV_CONTROL_AUTOMATION_SETTINGS_81101 installed")
except Exception as e:
    try:
        _egb_tv_auto_log_81101("TV_CONTROL_AUTOMATION_SETTINGS_81101 failed: " + repr(e))
    except Exception:
        pass



# WIFI_TV_AUTO_START_LOGIC_81103
# Purpose:
# If tv_control_automation_enabled is ON:
#   before TV/eGPU display path -> TV ON + HDMI input
# If tv_off_on_internal_enabled is ON:
#   after restore internal -> TV OFF
#
# Default settings are OFF, so normal display logic is unchanged unless user enables it.

try:
    _egb_81103_old_apply_egpu_mode = Plugin.apply_egpu_mode
    _egb_81103_old_tv_input_mode = Plugin.tv_input_mode
    _egb_81103_old_restore_internal_mode = Plugin.restore_internal_mode
except Exception:
    _egb_81103_old_apply_egpu_mode = None
    _egb_81103_old_tv_input_mode = None
    _egb_81103_old_restore_internal_mode = None


def _egb_81103_log(message):
    log(str(message))


def _egb_81103_read_auto_settings():
    try:
        import json as _json
        path = PLUGIN_DIR / "tv_control_automation.json"
        if not path.exists():
            return {
                "tv_control_automation_enabled": False,
                "tv_off_on_internal_enabled": False,
            }

        data = _json.loads(path.read_text(encoding="utf-8"))

        return {
            "tv_control_automation_enabled": bool(data.get("tv_control_automation_enabled", False)),
            "tv_off_on_internal_enabled": bool(data.get("tv_off_on_internal_enabled", False)),
        }
    except Exception as e:
        _egb_81103_log("WIFI_TV_AUTO settings read failed: " + repr(e))
        return {
            "tv_control_automation_enabled": False,
            "tv_off_on_internal_enabled": False,
        }


async def _egb_81103_call_old(method, *args, **kwargs):
    import inspect as _inspect

    if method is None:
        return {
            "ok": False,
            "error": "old method missing",
        }

    res = method(*args, **kwargs)
    if _inspect.isawaitable(res):
        return await res
    return res


async def _egb_81103_run_tv_action(action, reason):
    try:
        import asyncio as _asyncio

        _egb_81103_log("WIFI_TV_AUTO action=" + str(action) + " reason=" + str(reason))

        try:
            return await _asyncio.to_thread(tv_control_action, action)
        except AttributeError:
            # Fallback for older Python, should not normally be needed.
            return tv_control_action(action)

    except Exception as e:
        _egb_81103_log("WIFI_TV_AUTO action failed action=" + str(action) + " error=" + repr(e))
        return {
            "ok": False,
            "action": action,
            "error": repr(e),
        }


async def _egb_81103_prepare_tv_for_external(reason):
    settings = _egb_81103_read_auto_settings()

    if not settings.get("tv_control_automation_enabled", False):
        _egb_81103_log("WIFI_TV_AUTO skipped disabled reason=" + str(reason))
        return {
            "ok": True,
            "skipped": True,
            "reason": "disabled",
            "settings": settings,
        }

    _egb_81103_log("WIFI_TV_AUTO prepare external start reason=" + str(reason))

    on_res = await _egb_81103_run_tv_action("on", reason)
    input_res = await _egb_81103_run_tv_action("input", reason)

    ok = bool(on_res.get("ok")) and bool(input_res.get("ok"))

    _egb_81103_log(
        "WIFI_TV_AUTO prepare external done ok="
        + str(ok)
        + " on_ok="
        + str(on_res.get("ok"))
        + " input_ok="
        + str(input_res.get("ok"))
    )

    return {
        "ok": ok,
        "skipped": False,
        "reason": reason,
        "settings": settings,
        "tv_on": on_res,
        "tv_input": input_res,
    }


async def _egb_81103_maybe_tv_off_after_internal(reason):
    settings = _egb_81103_read_auto_settings()

    if not settings.get("tv_off_on_internal_enabled", False):
        _egb_81103_log("WIFI_TV_AUTO tv_off skipped disabled reason=" + str(reason))
        return {
            "ok": True,
            "skipped": True,
            "reason": "disabled",
            "settings": settings,
        }

    _egb_81103_log("WIFI_TV_AUTO tv_off after internal start reason=" + str(reason))
    off_res = await _egb_81103_run_tv_action("off", reason)

    _egb_81103_log(
        "WIFI_TV_AUTO tv_off after internal done ok="
        + str(off_res.get("ok"))
    )

    return {
        "ok": bool(off_res.get("ok")),
        "skipped": False,
        "reason": reason,
        "settings": settings,
        "tv_off": off_res,
    }


async def _egb_81103_apply_egpu_mode(*args, **kwargs):
    prep = await _egb_81103_prepare_tv_for_external("apply_egpu_mode")
    res = await _egb_81103_call_old(_egb_81103_old_apply_egpu_mode, *args, **kwargs)

    try:
        if isinstance(res, dict):
            res["wifi_tv_auto"] = prep
    except Exception:
        pass

    return res


async def _egb_81103_tv_input_mode(*args, **kwargs):
    prep = await _egb_81103_prepare_tv_for_external("tv_input_mode")
    res = await _egb_81103_call_old(_egb_81103_old_tv_input_mode, *args, **kwargs)

    try:
        if isinstance(res, dict):
            res["wifi_tv_auto"] = prep
    except Exception:
        pass

    return res


async def _egb_81103_restore_internal_mode(*args, **kwargs):
    res = await _egb_81103_call_old(_egb_81103_old_restore_internal_mode, *args, **kwargs)
    off = await _egb_81103_maybe_tv_off_after_internal("restore_internal_mode")

    try:
        if isinstance(res, dict):
            res["wifi_tv_auto_tv_off"] = off
    except Exception:
        pass

    return res


try:
    Plugin.apply_egpu_mode = staticmethod(_egb_81103_apply_egpu_mode)
    Plugin.tv_input_mode = staticmethod(_egb_81103_tv_input_mode)
    Plugin.restore_internal_mode = staticmethod(_egb_81103_restore_internal_mode)
    _egb_81103_log("WIFI_TV_AUTO_START_LOGIC_81103 installed")
except Exception as e:
    try:
        _egb_81103_log("WIFI_TV_AUTO_START_LOGIC_81103 install failed: " + repr(e))
    except Exception:
        pass



# HOTKEY_SETTINGS_81107
from pathlib import Path as _EGB_Path_81107
import json as _egb_json_81107

try:
    _EGB_PLUGIN_DIR_81107 = PLUGIN_DIR
except Exception:
    _EGB_PLUGIN_DIR_81107 = _EGB_Path_81107(__file__).resolve().parent

_EGB_HOTKEY_SETTINGS_FILE_81107 = _EGB_PLUGIN_DIR_81107 / "hotkey_settings.json"


def _egb_81107_log(message):
    log(str(message))


def _egb_81107_default_hotkey_settings():
    return {
        "hotkeys_enabled": False
    }


def _egb_81107_read_hotkey_settings():
    data = _egb_81107_default_hotkey_settings()
    try:
        if _EGB_HOTKEY_SETTINGS_FILE_81107.exists():
            raw = _egb_json_81107.loads(_EGB_HOTKEY_SETTINGS_FILE_81107.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                data.update(raw)
    except Exception as e:
        _egb_81107_log("HOTKEY_SETTINGS_READ_ERROR " + repr(e))

    data["hotkeys_enabled"] = bool(data.get("hotkeys_enabled", False))
    return data


def _egb_81107_write_hotkey_settings(data):
    clean = _egb_81107_default_hotkey_settings()
    if isinstance(data, dict):
        clean.update(data)

    clean["hotkeys_enabled"] = bool(clean.get("hotkeys_enabled", False))

    tmp = _EGB_HOTKEY_SETTINGS_FILE_81107.with_suffix(".json.tmp")
    tmp.write_text(_egb_json_81107.dumps(clean, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(_EGB_HOTKEY_SETTINGS_FILE_81107)
    return clean


def _egb_81107_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        v = value.strip().lower()
        if v in ("1", "true", "yes", "on", "enable", "enabled"):
            return True
        if v in ("0", "false", "no", "off", "disable", "disabled"):
            return False
    return default


def _egb_81107_payload(args, kwargs):
    payload = {}
    try:
        if args and isinstance(args[0], dict):
            payload.update(args[0])
    except Exception:
        pass
    try:
        payload.update(kwargs or {})
    except Exception:
        pass
    return payload


async def _egb_81107_get_hotkey_settings(*args, **kwargs):
    settings = _egb_81107_read_hotkey_settings()
    return {
        "ok": True,
        "source": "hotkey-settings-81107",
        "settings": settings,
        "hotkeys_enabled": settings.get("hotkeys_enabled", False),
    }


async def _egb_81107_set_hotkey_settings(*args, **kwargs):
    payload = _egb_81107_payload(args, kwargs)
    settings = _egb_81107_read_hotkey_settings()

    if "hotkeys_enabled" in payload:
        settings["hotkeys_enabled"] = _egb_81107_bool(payload.get("hotkeys_enabled"), settings.get("hotkeys_enabled", False))
    elif "enabled" in payload:
        settings["hotkeys_enabled"] = _egb_81107_bool(payload.get("enabled"), settings.get("hotkeys_enabled", False))

    settings = _egb_81107_write_hotkey_settings(settings)
    _egb_81107_log("HOTKEY_SETTINGS_SET " + repr(settings))

    return {
        "ok": True,
        "source": "hotkey-settings-81107",
        "settings": settings,
        "hotkeys_enabled": settings.get("hotkeys_enabled", False),
    }


try:
    Plugin.get_hotkey_settings = staticmethod(_egb_81107_get_hotkey_settings)
    Plugin.set_hotkey_settings = staticmethod(_egb_81107_set_hotkey_settings)
    _egb_81107_log("HOTKEY_SETTINGS_81107 installed")
except Exception as e:
    try:
        _egb_81107_log("HOTKEY_SETTINGS_81107 install failed: " + repr(e))
    except Exception:
        pass



# HOTKEY_WATCHER_81118
# Y1 + Y2 hold 7 sec => force internal display
# Uses discovered Legion Go S rear-button fingerprint:
# hidraw report len=32, byte[2]: Y1=0x01, Y2=0x02, Y1+Y2=0x03

import os as _egb81118_os
import glob as _egb81118_glob
import json as _egb81118_json
import time as _egb81118_time
import select as _egb81118_select
import asyncio as _egb81118_asyncio
import threading as _egb81118_threading
import traceback as _egb81118_traceback
import inspect as _egb81118_inspect

_EGB81118_BASE = _egb81118_os.path.dirname(_egb81118_os.path.abspath(__file__))
_EGB81118_LOG = _egb81118_os.path.join(_EGB81118_BASE, "plugin.log")
_EGB81118_SETTINGS = _egb81118_os.path.join(_EGB81118_BASE, "hotkey_settings.json")

_EGB81118_STOP = None
_EGB81118_THREAD = None
_EGB81118_LOCK = _egb81118_threading.Lock()
_EGB81118_HOLD_SECONDS = 7.0
_EGB81118_COOLDOWN_SECONDS = 20.0


def _egb81118_log(msg):
    log(str(msg))


def _egb81118_hotkeys_enabled():
    try:
        with open(_EGB81118_SETTINGS, "r", encoding="utf-8") as f:
            data = _egb81118_json.load(f)
        return bool(data.get("hotkeys_enabled", False))
    except Exception:
        return False


def _egb81118_is_rear_report(data):
    try:
        return (
            isinstance(data, (bytes, bytearray))
            and len(data) == 32
            and data[0] == 0
            and data[1] == 0
            and data[2] in (0, 1, 2, 3)
        )
    except Exception:
        return False


def _egb81118_find_rear_hidraw(stop_event, scan_seconds=1.2):
    fds = {}
    counts = {}

    try:
        for path in sorted(_egb81118_glob.glob("/dev/hidraw*")):
            try:
                fd = _egb81118_os.open(path, _egb81118_os.O_RDONLY | _egb81118_os.O_NONBLOCK)
                fds[fd] = path
                counts[path] = 0
            except Exception:
                pass

        end = _egb81118_time.time() + scan_seconds

        while not stop_event.is_set() and _egb81118_time.time() < end and fds:
            try:
                readable, _, _ = _egb81118_select.select(list(fds.keys()), [], [], 0.1)
            except Exception:
                break

            for fd in readable:
                path = fds.get(fd)
                if not path:
                    continue

                while True:
                    try:
                        data = _egb81118_os.read(fd, 64)
                    except BlockingIOError:
                        break
                    except Exception:
                        break

                    if not data:
                        break

                    if _egb81118_is_rear_report(data):
                        counts[path] = counts.get(path, 0) + 1

        best = None
        best_count = 0

        for path, count in counts.items():
            if count > best_count:
                best = path
                best_count = count

        if best and best_count >= 10:
            _egb81118_log(f"HOTKEY_WATCHER_81118 candidate={best} reports={best_count}")
            return best

        _egb81118_log(f"HOTKEY_WATCHER_81118 no_candidate counts={counts}")
        return None

    finally:
        for fd in list(fds.keys()):
            try:
                _egb81118_os.close(fd)
            except Exception:
                pass


def _egb81118_force_internal_from_thread():
    async def _run():
        try:
            _egb81118_log("HOTKEY_ACTION_81118 force_internal started")
            res = await Plugin.restore_internal_mode(restart=True)
            _egb81118_log("HOTKEY_ACTION_81118 force_internal result=" + repr(res)[:800])
        except Exception as e:
            _egb81118_log("HOTKEY_ACTION_81118 force_internal failed: " + repr(e))
            _egb81118_log(_egb81118_traceback.format_exc()[-1200:])

    try:
        _egb81118_asyncio.run(_run())
    except Exception as e:
        _egb81118_log("HOTKEY_ACTION_81118 asyncio failed: " + repr(e))


def _egb81118_watch_loop(stop_event):
    _egb81118_log("HOTKEY_WATCHER_81118 started")

    candidate = None
    fd = None
    hold_start = None
    fired_for_hold = False
    last_action = 0.0
    last_report = 0.0
    last_disabled_log = 0.0

    while not stop_event.is_set():
        try:
            if not _egb81118_hotkeys_enabled():
                now = _egb81118_time.time()
                hold_start = None
                fired_for_hold = False

                if now - last_disabled_log > 30:
                    _egb81118_log("HOTKEY_WATCHER_81118 idle: hotkeys disabled")
                    last_disabled_log = now

                _egb81118_time.sleep(0.5)
                continue

            if fd is None:
                candidate = _egb81118_find_rear_hidraw(stop_event)
                if not candidate:
                    _egb81118_time.sleep(2.0)
                    continue

                try:
                    fd = _egb81118_os.open(candidate, _egb81118_os.O_RDONLY | _egb81118_os.O_NONBLOCK)
                    last_report = _egb81118_time.time()
                    _egb81118_log(f"HOTKEY_WATCHER_81118 opened {candidate}")
                except Exception as e:
                    _egb81118_log(f"HOTKEY_WATCHER_81118 open failed {candidate}: {e!r}")
                    fd = None
                    candidate = None
                    _egb81118_time.sleep(2.0)
                    continue

            try:
                readable, _, _ = _egb81118_select.select([fd], [], [], 0.2)
            except Exception as e:
                _egb81118_log("HOTKEY_WATCHER_81118 select failed: " + repr(e))
                try:
                    _egb81118_os.close(fd)
                except Exception:
                    pass
                fd = None
                candidate = None
                hold_start = None
                fired_for_hold = False
                continue

            now = _egb81118_time.time()

            if not readable:
                if last_report and now - last_report > 8:
                    _egb81118_log("HOTKEY_WATCHER_81118 no reports, reopening")
                    try:
                        _egb81118_os.close(fd)
                    except Exception:
                        pass
                    fd = None
                    candidate = None
                    hold_start = None
                    fired_for_hold = False
                continue

            for _fd in readable:
                while True:
                    try:
                        data = _egb81118_os.read(_fd, 64)
                    except BlockingIOError:
                        break
                    except Exception as e:
                        _egb81118_log("HOTKEY_WATCHER_81118 read failed: " + repr(e))
                        try:
                            _egb81118_os.close(fd)
                        except Exception:
                            pass
                        fd = None
                        candidate = None
                        hold_start = None
                        fired_for_hold = False
                        break

                    if not data:
                        break

                    if not _egb81118_is_rear_report(data):
                        continue

                    last_report = _egb81118_time.time()
                    mask = data[2] & 0x03

                    if mask == 0x03:
                        if hold_start is None:
                            hold_start = last_report
                            fired_for_hold = False
                            _egb81118_log("HOTKEY_WATCHER_81118 Y1+Y2 hold started")

                        held = last_report - hold_start

                        if (
                            held >= _EGB81118_HOLD_SECONDS
                            and not fired_for_hold
                            and last_report - last_action >= _EGB81118_COOLDOWN_SECONDS
                        ):
                            fired_for_hold = True
                            last_action = last_report
                            _egb81118_log(f"HOTKEY_TRIGGER_81118 Y1+Y2 held {held:.1f}s => force internal")
                            _egb81118_force_internal_from_thread()

                    else:
                        if hold_start is not None:
                            held = last_report - hold_start
                            _egb81118_log(f"HOTKEY_WATCHER_81118 Y1+Y2 released after {held:.1f}s mask=0x{mask:02x}")
                        hold_start = None
                        fired_for_hold = False

        except Exception as e:
            _egb81118_log("HOTKEY_WATCHER_81118 loop error: " + repr(e))
            _egb81118_log(_egb81118_traceback.format_exc()[-1200:])
            try:
                if fd is not None:
                    _egb81118_os.close(fd)
            except Exception:
                pass
            fd = None
            candidate = None
            hold_start = None
            fired_for_hold = False
            _egb81118_time.sleep(2.0)

    try:
        if fd is not None:
            _egb81118_os.close(fd)
    except Exception:
        pass

    _egb81118_log("HOTKEY_WATCHER_81118 stopped")


def _egb81118_start_hotkey_watcher():
    global _EGB81118_STOP, _EGB81118_THREAD

    with _EGB81118_LOCK:
        try:
            if _EGB81118_THREAD is not None and _EGB81118_THREAD.is_alive():
                return True

            _EGB81118_STOP = _egb81118_threading.Event()
            _EGB81118_THREAD = _egb81118_threading.Thread(
                target=_egb81118_watch_loop,
                args=(_EGB81118_STOP,),
                daemon=True,
                name="eGPUBridgeHotkey81118",
            )
            _EGB81118_THREAD.start()
            return True

        except Exception as e:
            _egb81118_log("HOTKEY_WATCHER_81118 start failed: " + repr(e))
            return False


def _egb81118_stop_hotkey_watcher():
    global _EGB81118_STOP, _EGB81118_THREAD

    with _EGB81118_LOCK:
        try:
            if _EGB81118_STOP is not None:
                _EGB81118_STOP.set()

            if _EGB81118_THREAD is not None and _EGB81118_THREAD.is_alive():
                _EGB81118_THREAD.join(timeout=2.0)

            _EGB81118_STOP = None
            _EGB81118_THREAD = None
            return True

        except Exception as e:
            _egb81118_log("HOTKEY_WATCHER_81118 stop failed: " + repr(e))
            return False


async def _egb81118_call_original_async(fn, self_obj, *args, **kwargs):
    if fn is None:
        return None

    try:
        res = fn(self_obj, *args, **kwargs)
    except TypeError:
        res = fn(*args, **kwargs)

    if _egb81118_inspect.isawaitable(res):
        return await res

    return res


try:
    _egb81118_original_main = getattr(Plugin, "_main", None)
    _egb81118_original_unload = getattr(Plugin, "_unload", None)

    async def _egb81118_main(self, *args, **kwargs):
        _egb81118_start_hotkey_watcher()
        return await _egb81118_call_original_async(_egb81118_original_main, self, *args, **kwargs)

    async def _egb81118_unload(self, *args, **kwargs):
        _egb81118_stop_hotkey_watcher()
        return await _egb81118_call_original_async(_egb81118_original_unload, self, *args, **kwargs)

    Plugin._main = _egb81118_main
    Plugin._unload = _egb81118_unload

    _egb81118_log("HOTKEY_WATCHER_81118 installed")

except Exception as e:
    try:
        _egb81118_log("HOTKEY_WATCHER_81118 install failed: " + repr(e))
    except Exception:
        pass


# DOCK_STATUS_81202_R1
try:
    import subprocess
    from pathlib import Path

    def _egb_81202r1_log(msg):
        log(str(msg))

    def _egb_81202r1_read(path):
        try:
            return Path(path).read_text(encoding="utf-8", errors="replace").strip()
        except Exception:
            return None

    def _egb_81202r1_float(v):
        try:
            return float(str(v).split()[0])
        except Exception:
            return None

    def _egb_81202r1_int(v):
        try:
            return int(str(v).strip())
        except Exception:
            return 0

    def _egb_81202r1_run(cmd, timeout=4):
        try:
            r = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=timeout,
            )
            return {
                "ok": r.returncode == 0,
                "rc": r.returncode,
                "out": r.stdout.strip(),
                "err": r.stderr.strip(),
            }
        except Exception as e:
            return {"ok": False, "rc": None, "out": "", "err": repr(e)}

    def _egb_81202r1_tb_devices():
        root = Path("/sys/bus/thunderbolt/devices")
        items = []
        if not root.exists():
            return items

        for d in sorted(root.iterdir()):
            if not d.is_dir():
                continue

            item = {"id": d.name}
            for key in [
                "device_name",
                "vendor_name",
                "unique_id",
                "authorized",
                "rx_speed",
                "tx_speed",
                "rx_lanes",
                "tx_lanes",
            ]:
                val = _egb_81202r1_read(d / key)
                if val:
                    item[key] = val

            if len(item) == 1:
                continue

            rx_speed = _egb_81202r1_float(item.get("rx_speed"))
            tx_speed = _egb_81202r1_float(item.get("tx_speed"))
            rx_lanes = _egb_81202r1_int(item.get("rx_lanes"))
            tx_lanes = _egb_81202r1_int(item.get("tx_lanes"))

            if rx_speed and rx_lanes:
                item["rx_total_gbps"] = rx_speed * rx_lanes
            if tx_speed and tx_lanes:
                item["tx_total_gbps"] = tx_speed * tx_lanes

            items.append(item)

        return items

    def _egb_81202r1_drm_connected():
        root = Path("/sys/class/drm")
        out = []
        if not root.exists():
            return out

        for c in sorted(root.glob("card*-*")):
            status = _egb_81202r1_read(c / "status")
            if status != "connected":
                continue

            enabled = _egb_81202r1_read(c / "enabled")
            modes = []
            try:
                modes = [
                    x.strip()
                    for x in (c / "modes").read_text(encoding="utf-8", errors="replace").splitlines()
                    if x.strip()
                ][:6]
            except Exception:
                pass

            out.append({
                "connector": c.name,
                "status": status,
                "enabled": enabled,
                "modes": modes,
            })

        return out

    async def _egb_81202r1_dock_status(*args, **kwargs):
        tb = _egb_81202r1_tb_devices()

        asmedia = None
        for d in tb:
            hay = (str(d.get("vendor_name", "")) + " " + str(d.get("device_name", ""))).lower()
            if "asmedia" in hay or "246" in hay:
                asmedia = d
                break

        chosen = asmedia or (tb[0] if tb else None)

        pci = _egb_81202r1_run(["/usr/bin/lspci", "-nn"])
        pci_out = pci.get("out", "")

        asmedia_pci = ("ASMedia" in pci_out) or ("1b21:2461" in pci_out)
        rx9070 = ("1002:7550" in pci_out) or ("Navi 48" in pci_out) or ("Radeon RX 9070" in pci_out)
        nvidia_egpu = ("10de:" in pci_out) or ("GeForce" in pci_out) or ("NVIDIA" in pci_out)
        egpu_detected = rx9070 or nvidia_egpu

        dock_name = "Unknown"
        dock_vendor = None
        usb4_label = "USB4: unknown"
        link_ok = False

        if chosen:
            dock_vendor = chosen.get("vendor_name")
            dev_name = chosen.get("device_name") or chosen.get("id") or "USB4 device"
            dock_name = ((dock_vendor + " ") if dock_vendor else "") + dev_name

            rx_total = chosen.get("rx_total_gbps")
            tx_total = chosen.get("tx_total_gbps")

            if rx_total and tx_total:
                gbps = int(min(float(rx_total), float(tx_total)))
                usb4_label = "USB4 %d Gb/s" % gbps
                link_ok = gbps >= 40
            else:
                usb4_label = "USB4 link detected"

        if chosen and link_ok:
            label = "%s by %s detected" % (usb4_label, dock_name)
        elif chosen:
            label = "USB4 dock detected: %s" % dock_name
        elif asmedia_pci:
            label = "ASMedia 246x bridge detected by PCI"
        else:
            label = "Dock not clearly detected"

        result = {
            "ok": bool(chosen or asmedia_pci),
            "source": "dock-status-81202-r1",
            "read_only": True,
            "label": label,
            "dock": {
                "detected": bool(chosen or asmedia_pci),
                "name": dock_name,
                "vendor": dock_vendor,
                "asmedia_246x": bool(asmedia or asmedia_pci),
                "authorized": chosen.get("authorized") if chosen else None,
            },
            "usb4": {
                "detected": bool(chosen),
                "label": usb4_label,
                "link_ok_40gbps": bool(link_ok),
                "rx_speed": chosen.get("rx_speed") if chosen else None,
                "tx_speed": chosen.get("tx_speed") if chosen else None,
                "rx_lanes": chosen.get("rx_lanes") if chosen else None,
                "tx_lanes": chosen.get("tx_lanes") if chosen else None,
                "rx_total_gbps": chosen.get("rx_total_gbps") if chosen else None,
                "tx_total_gbps": chosen.get("tx_total_gbps") if chosen else None,
            },
            "egpu_tunnel": {
                "active": bool(egpu_detected and (chosen or asmedia_pci)),
                "gpu_hint": ("AMD Radeon RX 9070 [1002:7550]" if rx9070 else
                             "NVIDIA GPU" if nvidia_egpu else None),
                "asmedia_bridge": bool(asmedia_pci),
            },
            "display": {
                "connected": _egb_81202r1_drm_connected(),
            },
            "control": {
                "vendor_api": False,
                "power_control": False,
                "reason": "READ ONLY. No ASMedia vendor commands, no USB reset, no power control.",
            },
        }

        _egb_81202r1_log("DOCK_STATUS_81202_R1 " + str({
            "label": result.get("label"),
            "dock": result.get("dock"),
            "usb4": result.get("usb4"),
            "egpu_tunnel": result.get("egpu_tunnel"),
        }))

        return result

    Plugin.dock_status = staticmethod(_egb_81202r1_dock_status)
    _egb_81202r1_log("DOCK_STATUS_81202_R1 installed")

except Exception as e:
    try:
        _egb_81202r1_log("DOCK_STATUS_81202_R1 install failed: " + repr(e))
    except Exception:
        pass



# AMD_SYSFS_WAGON_90201

# Read-only AMD GPU discovery wagon.
# No sysfs writes here. No profile changes here.

def _egb_read_text(path, max_len=4096):
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read(max_len).strip()
    except Exception:
        return None

def _egb_read_int(path):
    v = _egb_read_text(path)
    if v is None:
        return None
    try:
        return int(str(v).strip())
    except Exception:
        return None

def _egb_hwmon_read_best(device_path):
    import os, glob
    result = {
        "hwmon_path": None,
        "temp_c": None,
        "power_w": None,
        "fan_rpm": None,
        "freq_mhz": None
    }

    for h in glob.glob(os.path.join(device_path, "hwmon", "hwmon*")):
        result["hwmon_path"] = h

        vals = []
        for f in glob.glob(os.path.join(h, "temp*_input")):
            val = _egb_read_int(f)
            if val is not None:
                vals.append(val / 1000.0)
        if vals:
            result["temp_c"] = round(max(vals), 1)

        vals = []
        for f in glob.glob(os.path.join(h, "power*_average")) + glob.glob(os.path.join(h, "power*_input")):
            val = _egb_read_int(f)
            if val is not None:
                vals.append(val / 1000000.0)
        if vals:
            result["power_w"] = round(max(vals), 1)

        vals = []
        for f in glob.glob(os.path.join(h, "fan*_input")):
            val = _egb_read_int(f)
            if val is not None:
                vals.append(val)
        if vals:
            result["fan_rpm"] = max(vals)

        vals = []
        for f in glob.glob(os.path.join(h, "freq*_input")):
            val = _egb_read_int(f)
            if val is not None:
                vals.append(val / 1000000.0)
        if vals:
            result["freq_mhz"] = round(max(vals), 0)

        if any(result.get(k) is not None for k in ("temp_c", "power_w", "fan_rpm", "freq_mhz")):
            break

    return result

def _egb_classify_gpu(card_name, device_path, vendor, device):
    import os
    kind = "unknown"
    hints = []

    boot_vga = _egb_read_text(os.path.join(device_path, "boot_vga"))
    if boot_vga == "1":
        kind = "igpu"
        hints.append("boot_vga=1")

    real = os.path.realpath(device_path).lower()
    if "usb" in real or "thunderbolt" in real:
        hints.append("external-path-hint")

    # Known eGPU device hints
    if str(device).lower() == "0x7550":
        kind = "egpu"
        hints.append("known-navi48-egpu-hint")

    if kind == "unknown" and str(vendor).lower() == "0x1002":
        kind = "amd"
    elif kind == "unknown" and str(vendor).lower() == "0x10de":
        kind = "nvidia"

    return kind, hints

def _egb_read_gpu_card(card_path):
    import os, glob

    card = os.path.basename(card_path)
    devpath = os.path.join(card_path, "device")
    vendor = _egb_read_text(os.path.join(devpath, "vendor"))
    device = _egb_read_text(os.path.join(devpath, "device"))

    if str(vendor).lower() not in ("0x1002", "0x10de", "0x8086"):
        return None

    kind, hints = _egb_classify_gpu(card, devpath, vendor, device)

    connectors = []
    base = os.path.dirname(card_path)
    for c in sorted(glob.glob(os.path.join(base, card + "-*"))):
        name = os.path.basename(c).replace(card + "-", "", 1)
        status = _egb_read_text(os.path.join(c, "status"))
        modes = _egb_read_text(os.path.join(c, "modes"), max_len=2048)
        connectors.append({
            "name": name,
            "status": status,
            "modes_count": 0 if not modes else len([x for x in modes.splitlines() if x.strip()])
        })

    hw = _egb_hwmon_read_best(devpath)

    return {
        "card": card,
        "kind": kind,
        "vendor": vendor,
        "device": device,
        "device_path": os.path.realpath(devpath),
        "driver": os.path.basename(os.path.realpath(os.path.join(devpath, "driver"))) if os.path.exists(os.path.join(devpath, "driver")) else None,
        "boot_vga": _egb_read_text(os.path.join(devpath, "boot_vga")),
        "perf_level": _egb_read_text(os.path.join(devpath, "power_dpm_force_performance_level")),
        "power_profile_raw": _egb_read_text(os.path.join(devpath, "pp_power_profile_mode"), max_len=2048),
        "gpu_busy_percent": _egb_read_int(os.path.join(devpath, "gpu_busy_percent")),
        "mem_busy_percent": _egb_read_int(os.path.join(devpath, "mem_busy_percent")),
        "hwmon": hw,
        "connectors": connectors,
        "hints": hints
    }

def _egb_amd_sysfs_report():
    import glob, time

    cards = []
    for card_path in sorted(glob.glob("/sys/class/drm/card[0-9]*")):
        item = _egb_read_gpu_card(card_path)
        if item:
            cards.append(item)

    egpu = None
    igpu = None
    for c in cards:
        if c.get("kind") == "egpu" and egpu is None:
            egpu = c
        if c.get("kind") == "igpu" and igpu is None:
            igpu = c

    return {
        "ok": True,
        "source": "amd-sysfs-wagon",
        "read_only": True,
        "timestamp": int(time.time()),
        "cards_count": len(cards),
        "egpu": egpu,
        "igpu": igpu,
        "cards": cards,
        "label": ("AMD GPUs: %d" % len(cards)) if cards else "No AMD DRM cards found"
    }

async def amd_sysfs_wagon(*args, **kwargs):
    try:
        return _egb_amd_sysfs_report()
    except Exception as e:
        return {
            "ok": False,
            "source": "amd-sysfs-wagon",
            "read_only": True,
            "error": repr(e),
            "label": "AMD sysfs wagon error"
        }

try:
    Plugin.amd_sysfs_wagon = staticmethod(amd_sysfs_wagon)
except Exception:
    pass




# GPU_TUNING_WAGON — direct sysfs GPU tuning (power cap, fan, perf level, profiles)

def _egb_find_egpu_hwmon():
    """Find hwmon path for the eGPU (non-boot-VGA AMD or NVIDIA card). Returns (hwmon, device_path, vendor)."""
    import pathlib
    drm = pathlib.Path("/sys/class/drm")
    if not drm.exists():
        return None, None, None
    for card in sorted(drm.glob("card[0-9]*")):
        device = card / "device"
        try:
            vendor = (device / "vendor").read_text().strip().lower()
            boot = (device / "boot_vga").read_text().strip()
            if boot == "1":
                continue
            # AMD eGPU
            if vendor == "0x1002":
                driver = (device / "driver/module").resolve().name
                if driver != "amdgpu":
                    continue
                hwmons = sorted(device.glob("hwmon/hwmon*"))
                if hwmons:
                    return str(hwmons[0]), str(device), "amd"
            # NVIDIA eGPU
            elif vendor == "0x10de":
                driver = (device / "driver/module").resolve().name
                if driver not in ("nvidia", "nvidia_drm", "nvidia_modeset"):
                    continue
                hwmons = sorted(device.glob("hwmon/hwmon*"))
                if hwmons:
                    return str(hwmons[0]), str(device), "nvidia"
        except Exception:
            continue
    return None, None, None

def _egb_gpu_tuning_report():
    """Read all GPU tuning parameters from sysfs or nvidia-smi."""
    hwmon, device_path, vendor = _egb_find_egpu_hwmon()
    if not hwmon or not device_path:
        return {"ok": False, "source": "gpu-tuning-wagon", "error": "eGPU hwmon not found"}

    import pathlib

    # === NVIDIA branch ===
    if vendor == "nvidia":
        from subprocess import run as _run
        result = {
            "ok": True, "source": "gpu-tuning-wagon", "vendor": "nvidia",
            "hwmon_path": hwmon, "device_path": device_path,
            "power_cap_w": None, "power_cap_min_w": None, "power_cap_max_w": None, "power_cap_default_w": None,
            "power_avg_w": None, "fan_pwm": None, "fan_pwm_max": 100, "fan_rpm": None,
            "fan_rpm_max": 0, "fan_rpm_min": 0, "fan_percent": None,
            "temp_c": None, "perf_level": None, "profiles": [], "active_profile": None,
            "gpu_clock_mhz": None, "mem_clock_mhz": None,
        }
        try:
            # Power info
            r = _run(["/usr/bin/nvidia-smi", "-q", "-d", "POWER"], capture_output=True, text=True, timeout=5)
            if r.returncode == 0:
                for line in r.stdout.splitlines():
                    l = line.strip()
                    if "Power Limit" in l and "Default" not in l and "Min" not in l and "Max" not in l:
                        try: result["power_cap_w"] = float(l.split(":")[1].strip().replace("W", "").strip())
                        except: pass
                    elif "Default Power Limit" in l:
                        try: result["power_cap_default_w"] = float(l.split(":")[1].strip().replace("W", "").strip())
                        except: pass
                    elif "Min Power Limit" in l:
                        try: result["power_cap_min_w"] = float(l.split(":")[1].strip().replace("W", "").strip())
                        except: pass
                    elif "Max Power Limit" in l:
                        try: result["power_cap_max_w"] = float(l.split(":")[1].strip().replace("W", "").strip())
                        except: pass
                    elif "Power Draw" in l:
                        try: result["power_avg_w"] = float(l.split(":")[1].strip().replace("W", "").strip())
                        except: pass
        except: pass

        try:
            # Temp + clocks
            r = _run(["/usr/bin/nvidia-smi", "--query-gpu=temperature.gpu,clocks.current.graphics,clocks.current.memory",
                       "--format=csv,noheader,nounits"], capture_output=True, text=True, timeout=5)
            if r.returncode == 0:
                parts = [x.strip() for x in r.stdout.split(",")]
                if len(parts) >= 3:
                    try: result["temp_c"] = float(parts[0])
                    except: pass
                    try: result["gpu_clock_mhz"] = int(parts[1])
                    except: pass
                    try: result["mem_clock_mhz"] = int(parts[2])
                    except: pass
        except: pass

        try:
            # Performance state (P0=high, P8=low, else=auto)
            r = _run(["/usr/bin/nvidia-smi", "-q", "-d", "PERFORMANCE"], capture_output=True, text=True, timeout=5)
            if r.returncode == 0:
                for line in r.stdout.splitlines():
                    if "Performance State" in line:
                        pstate = line.split(":")[1].strip()
                        if pstate == "P0":
                            result["perf_level"] = "high"
                        elif pstate in ("P7", "P8"):
                            result["perf_level"] = "low"
                        else:
                            result["perf_level"] = "auto"
                        break
        except: pass

        try:
            # Fan speed via nvidia-settings
            r = _run(["/usr/bin/nvidia-settings", "-q", "[fan:0]/GPUFanSpeed", "-t"],
                      capture_output=True, text=True, timeout=5)
            if r.returncode == 0:
                fan_val = r.stdout.strip()
                if fan_val and fan_val.replace(".", "").isdigit():
                    result["fan_percent"] = int(float(fan_val))
                    result["fan_pwm"] = int(float(fan_val) * 255 / 100)
        except: pass

        return result

    # === AMD branch ===
    dev = pathlib.Path(device_path)
    hw = pathlib.Path(hwmon)

    def _r(p):
        try: return p.read_text().strip()
        except: return None
    def _ri(p):
        v = _r(p)
        return int(v) if v and v.isdigit() else None

    # Power cap (microwatts -> watts)
    cap_uw = _ri(hw / "power1_cap")
    cap_min_uw = _ri(hw / "power1_cap_min")
    cap_max_uw = _ri(hw / "power1_cap_max")
    cap_def_uw = _ri(hw / "power1_cap_default")
    power_avg_uw = _ri(hw / "power1_average")

    # Fan
    fan_pwm = _ri(hw / "pwm1")
    fan_pwm_max = _ri(hw / "pwm1_max") or 255
    fan_rpm = _ri(hw / "fan1_input")
    fan_rpm_max = _ri(hw / "fan1_max") or 0
    fan_rpm_min = _ri(hw / "fan1_min") or 0

    # Temp (millidegrees -> celsius)
    temp_raw = _ri(hw / "temp1_input")

    # Perf level
    perf_level = _r(dev / "power_dpm_force_performance_level")

    # Power profile mode
    profile_raw = _r(dev / "pp_power_profile_mode")

    # Parse profiles
    profiles = []
    active_profile = None
    if profile_raw:
        for line in profile_raw.splitlines():
            line = line.strip()
            if not line or line.startswith("PROFILE_INDEX"):
                continue
            stripped = line.lstrip()
            if stripped and stripped[0].isdigit() and "(" not in stripped.split()[0]:
                parts = stripped.split()
                if len(parts) >= 2:
                    idx_str = parts[0]
                    name = parts[1].strip("*: ")
                    is_active = "*" in line
                    try:
                        profiles.append({"index": int(idx_str), "name": name})
                    except ValueError:
                        continue
                    if is_active:
                        active_profile = name

    # Clocks
    gpu_clock = _ri(hw / "freq1_input")
    mem_clock = _ri(hw / "freq2_input")

    return {
        "ok": True,
        "source": "gpu-tuning-wagon",
        "vendor": "amd",
        "hwmon_path": hwmon,
        "device_path": device_path,
        "power_cap_w": round(cap_uw / 1000000, 1) if cap_uw else None,
        "power_cap_min_w": round(cap_min_uw / 1000000, 1) if cap_min_uw else None,
        "power_cap_max_w": round(cap_max_uw / 1000000, 1) if cap_max_uw else None,
        "power_cap_default_w": round(cap_def_uw / 1000000, 1) if cap_def_uw else None,
        "power_avg_w": round(power_avg_uw / 1000000, 1) if power_avg_uw else None,
        "fan_pwm": fan_pwm,
        "fan_pwm_max": fan_pwm_max,
        "fan_rpm": fan_rpm,
        "fan_rpm_max": fan_rpm_max,
        "fan_rpm_min": fan_rpm_min,
        "fan_percent": round(fan_pwm / fan_pwm_max * 100) if fan_pwm is not None and fan_pwm_max else None,
        "temp_c": round(temp_raw / 1000, 1) if temp_raw else None,
        "perf_level": perf_level,
        "profiles": profiles,
        "active_profile": active_profile,
        "gpu_clock_mhz": round(gpu_clock / 1000000) if gpu_clock else None,
        "mem_clock_mhz": round(mem_clock / 1000000) if mem_clock else None,
    }


async def gpu_tuning_wagon(*args, **kwargs):
    try:
        return _egb_gpu_tuning_report()
    except Exception as e:
        return {"ok": False, "source": "gpu-tuning-wagon", "error": str(e)}


async def gpu_set_power_cap(*args, **kwargs):
    """Set GPU power cap in watts."""
    watts = None
    if args and isinstance(args[0], dict):
        watts = args[0].get("watts")
    if kwargs:
        watts = kwargs.get("watts", watts)
    if watts is None:
        return {"ok": False, "error": "missing watts"}

    hwmon, _, vendor = _egb_find_egpu_hwmon()
    if not hwmon:
        return {"ok": False, "error": "eGPU hwmon not found"}

    # NVIDIA: nvidia-smi -pl
    if vendor == "nvidia":
        from subprocess import run as _run
        try:
            r = _run(["/usr/bin/nvidia-smi", "-pl", str(int(float(watts)))], capture_output=True, text=True, timeout=10)
            if r.returncode != 0:
                return {"ok": False, "error": f"nvidia-smi failed: {r.stderr.strip()}"}
        except Exception as e:
            return {"ok": False, "error": str(e)}
        return {"ok": True, "source": "gpu-tuning", "label": f"power cap set to {watts}W", "watts": watts}

    # AMD: sysfs write
    import pathlib
    cap_path = pathlib.Path(hwmon) / "power1_cap"
    cap_uw = int(float(watts) * 1000000)

    # Validate range
    cap_min = _egb_read_int(pathlib.Path(hwmon) / "power1_cap_min")
    cap_max = _egb_read_int(pathlib.Path(hwmon) / "power1_cap_max")
    if cap_min and cap_uw < cap_min:
        return {"ok": False, "error": f"minimum is {cap_min // 1000000}W"}
    if cap_max and cap_uw > cap_max:
        return {"ok": False, "error": f"maximum is {cap_max // 1000000}W"}

    try:
        cap_path.write_text(str(cap_uw))
    except Exception as e:
        return {"ok": False, "error": f"write failed: {e}"}

    return {"ok": True, "source": "gpu-tuning", "label": f"power cap set to {watts}W", "watts": watts}


async def gpu_set_fan_control(*args, **kwargs):
    """Set fan mode: auto (default driver) or manual with PWM value 0-255."""
    mode = None
    pwm = None
    if args and isinstance(args[0], dict):
        mode = args[0].get("mode")
        pwm = args[0].get("pwm")
    if kwargs:
        mode = kwargs.get("mode", mode)
        pwm = kwargs.get("pwm", pwm)

    hwmon, _, vendor = _egb_find_egpu_hwmon()
    if not hwmon:
        return {"ok": False, "error": "eGPU hwmon not found"}

    # NVIDIA: nvidia-settings
    if vendor == "nvidia":
        from subprocess import run as _run
        if mode == "auto":
            try:
                r = _run(["/usr/bin/nvidia-settings", "-a", "[gpu:0]/GPUFanControlState=0"],
                          capture_output=True, text=True, timeout=10)
                if r.returncode != 0:
                    return {"ok": False, "error": f"nvidia-settings failed: {r.stderr.strip()}"}
            except Exception as e:
                return {"ok": False, "error": str(e)}
            return {"ok": True, "source": "gpu-tuning", "label": "fan set to auto", "mode": "auto"}
        elif mode == "manual":
            if pwm is None:
                return {"ok": False, "error": "missing pwm value (0-255)"}
            pct = int(int(pwm) * 100 / 255)
            try:
                r = _run(["/usr/bin/nvidia-settings", "-a", "[gpu:0]/GPUFanControlState=1", "-a", f"[fan:0]/GPUFanSpeed={pct}"],
                          capture_output=True, text=True, timeout=10)
                if r.returncode != 0:
                    return {"ok": False, "error": f"nvidia-settings failed: {r.stderr.strip()}"}
            except Exception as e:
                return {"ok": False, "error": str(e)}
            return {"ok": True, "source": "gpu-tuning", "label": f"fan set to {pct}%", "mode": "manual", "pwm": pwm}
        return {"ok": False, "error": f"unknown fan mode: {mode}"}

    # AMD: sysfs
    import pathlib
    hw = pathlib.Path(hwmon)
    pwm_path = hw / "pwm1"

    if mode == "auto":
        # Write 2 to pwm1_enable if it exists, otherwise restore pwm1 to max (driver default)
        pwm_enable = hw / "fan1_enable"
        if pwm_enable.exists():
            try:
                pwm_enable.write_text("2")
            except Exception as e:
                return {"ok": False, "error": f"fan enable write failed: {e}"}
        else:
            # RDNA4 may not have pwm1_enable — set pwm1 to max as "auto" equivalent
            fan_max = _egb_read_int(hw / "fan1_max") or 255
            try:
                pwm_path.write_text(str(fan_max))
            except Exception as e:
                return {"ok": False, "error": f"fan restore failed: {e}"}
        return {"ok": True, "source": "gpu-tuning", "label": "fan set to auto", "mode": "auto"}

    elif mode == "manual":
        if pwm is None:
            return {"ok": False, "error": "missing pwm value (0-255)"}
        pwm = int(pwm)
        if pwm < 0 or pwm > 255:
            return {"ok": False, "error": "pwm must be 0-255"}

        pwm_enable = hw / "fan1_enable"
        if pwm_enable.exists():
            try:
                pwm_enable.write_text("1")
            except Exception as e:
                return {"ok": False, "error": f"fan enable write failed: {e}"}

        try:
            pwm_path.write_text(str(pwm))
        except Exception as e:
            return {"ok": False, "error": f"pwm write failed: {e}"}

        return {"ok": True, "source": "gpu-tuning", "label": f"fan set to manual PWM {pwm}", "mode": "manual", "pwm": pwm}

    return {"ok": False, "error": "mode must be 'auto' or 'manual'"}


async def gpu_set_perf_level(*args, **kwargs):
    """Set performance level (auto/high/low/manual)."""
    level = None
    if args and isinstance(args[0], dict):
        level = args[0].get("level")
    if kwargs:
        level = kwargs.get("level", level)
    if not level:
        return {"ok": False, "error": "missing level"}

    level = str(level).strip().lower()
    if level not in ("auto", "high", "low", "manual"):
        return {"ok": False, "error": "level must be auto/high/low/manual"}

    import pathlib
    _, device_path, vendor = _egb_find_egpu_hwmon()
    if not device_path:
        return {"ok": False, "error": "eGPU device not found"}

    # NVIDIA: GPUPowerMizerMode (0=auto, 1=max perf, 2=adaptive, 3=max power saving)
    if vendor == "nvidia":
        from subprocess import run as _run
        nv_map = {"auto": "0", "high": "1", "manual": "2", "low": "3"}
        nv_mode = nv_map.get(level, "0")
        try:
            r = _run(["/usr/bin/nvidia-settings", "-a", f"[gpu:0]/GPUPowerMizerMode={nv_mode}"],
                      capture_output=True, text=True, timeout=10)
            if r.returncode != 0:
                return {"ok": False, "error": f"nvidia-settings failed: {r.stderr.strip()}"}
        except Exception as e:
            return {"ok": False, "error": str(e)}
        return {"ok": True, "source": "gpu-tuning", "label": f"perf level set to {level}", "level": level}

    # AMD: sysfs
    perf = pathlib.Path(device_path) / "power_dpm_force_performance_level"
    if not perf.exists():
        return {"ok": False, "error": "perf level sysfs not found"}

    try:
        perf.write_text(level)
    except Exception as e:
        return {"ok": False, "error": f"write failed: {e}"}

    return {"ok": True, "source": "gpu-tuning", "label": f"perf level set to {level}", "level": level}


async def gpu_set_power_profile(*args, **kwargs):
    """Set power profile mode by index."""
    index = None
    if args and isinstance(args[0], dict):
        index = args[0].get("index")
    if kwargs:
        index = kwargs.get("index", index)
    if index is None:
        return {"ok": False, "error": "missing profile index"}

    import pathlib
    _, device_path, vendor = _egb_find_egpu_hwmon()
    if not device_path:
        return {"ok": False, "error": "eGPU device not found"}

    # NVIDIA: no equivalent
    if vendor == "nvidia":
        return {"ok": True, "source": "gpu-tuning", "label": "power profiles not available on NVIDIA"}

    profile_path = pathlib.Path(device_path) / "pp_power_profile_mode"
    if not profile_path.exists():
        return {"ok": False, "error": "pp_power_profile_mode not found"}

    try:
        profile_path.write_text(str(int(index)))
    except Exception as e:
        return {"ok": False, "error": f"write failed: {e}"}

    return {"ok": True, "source": "gpu-tuning", "label": f"power profile set to index {index}", "index": index}


async def gpu_get_od_clocks(*args, **kwargs):
    """Read OD clock/voltage table from pp_od_clk_voltage."""
    import pathlib, re
    _, device_path, vendor = _egb_find_egpu_hwmon()
    if not device_path:
        return {"ok": False, "error": "eGPU device not found"}

    if vendor == "nvidia":
        return {"ok": False, "error": "OD clocks not available on NVIDIA via sysfs"}

    od_path = pathlib.Path(device_path) / "pp_od_clk_voltage"
    if not od_path.exists():
        return {"ok": False, "error": "pp_od_clk_voltage not found"}

    try:
        content = od_path.read_text().strip()
    except Exception as e:
        return {"ok": False, "error": f"read failed: {e}"}

    result = {"ok": True, "raw": content, "sclk": [], "mclk": [], "vddgfx": []}
    current_section = None
    for line in content.splitlines():
        line = line.strip()
        if line.startswith("OD_SCLK:"):
            current_section = "sclk"
        elif line.startswith("OD_MCLK:"):
            current_section = "mclk"
        elif line.startswith("OD_VDDGFX:"):
            current_section = "vddgfx"
        elif line.startswith("OD_RANGE:"):
            current_section = "range"
        elif current_section and line:
            parts = line.split()
            if current_section in ("sclk", "mclk") and len(parts) >= 2:
                try:
                    result[current_section].append({"state": parts[0], "mhz": int(parts[1])})
                except ValueError:
                    pass
            elif current_section == "vddgfx" and len(parts) >= 2:
                try:
                    result["vddgfx"].append({"state": parts[0], "mv": int(parts[1])})
                except ValueError:
                    pass
            elif current_section == "range":
                m = re.match(r"(SCLK|MCLK|VDDGFX)\s+(\d+)\s+(\d+)", line)
                if m:
                    key = m.group(1).lower()
                    result[f"{key}_min"] = int(m.group(2))
                    result[f"{key}_max"] = int(m.group(3))

    return result


async def gpu_set_od_clocks(*args, **kwargs):
    """Write OD clock/voltage values and commit."""
    import pathlib
    sclk_mhz = None
    mclk_mhz = None
    vddgfx_mv = None
    commit = False

    if args and isinstance(args[0], dict):
        d = args[0]
        sclk_mhz = d.get("sclk_mhz")
        mclk_mhz = d.get("mclk_mhz")
        vddgfx_mv = d.get("vddgfx_mv")
        commit = d.get("commit", False)
    if kwargs:
        sclk_mhz = kwargs.get("sclk_mhz", sclk_mhz)
        mclk_mhz = kwargs.get("mclk_mhz", mclk_mhz)
        vddgfx_mv = kwargs.get("vddgfx_mv", vddgfx_mv)
        commit = kwargs.get("commit", commit)

    _, device_path, vendor = _egb_find_egpu_hwmon()
    if not device_path:
        return {"ok": False, "error": "eGPU device not found"}

    if vendor == "nvidia":
        return {"ok": False, "error": "OD clocks not supported on NVIDIA via sysfs"}

    od_path = pathlib.Path(device_path) / "pp_od_clk_voltage"
    if not od_path.exists():
        return {"ok": False, "error": "pp_od_clk_voltage not found"}

    cmds = []
    if sclk_mhz is not None:
        cmds.append(f"s 1 {int(sclk_mhz)}")
    if mclk_mhz is not None:
        cmds.append(f"m 1 {int(mclk_mhz)}")
    if vddgfx_mv is not None:
        cmds.append(f"v 1 {int(vddgfx_mv)}")
    if commit:
        cmds.append("c")

    if not cmds:
        return {"ok": False, "error": "no values provided"}

    results = []
    for cmd in cmds:
        try:
            od_path.write_text(cmd)
            results.append({"cmd": cmd, "ok": True})
        except Exception as e:
            results.append({"cmd": cmd, "ok": False, "error": str(e)})

    return {"ok": True, "source": "gpu-tuning", "cmds": results}


try:
    Plugin.gpu_tuning_wagon = staticmethod(gpu_tuning_wagon)
    Plugin.gpu_set_power_cap = staticmethod(gpu_set_power_cap)
    Plugin.gpu_set_fan_control = staticmethod(gpu_set_fan_control)
    Plugin.gpu_set_perf_level = staticmethod(gpu_set_perf_level)
    Plugin.gpu_set_power_profile = staticmethod(gpu_set_power_profile)
    Plugin.gpu_get_od_clocks = staticmethod(gpu_get_od_clocks)
    Plugin.gpu_set_od_clocks = staticmethod(gpu_set_od_clocks)
except Exception:
    pass


# NVIDIA_DRIVER_MANAGEMENT_90500

def _nvidia_install_sync():
    """Install NVIDIA DKMS drivers on SteamOS. Adapted from xg-mobile-linux."""
    steps = []

    def step(num, msg, cmd, critical=True, timeout=300):
        _write_progress("install", int(num * 10), f"Step {num}: {msg}")
        log(f"NVIDIA_INSTALL step {num}: {msg}")
        rc, out = _run(cmd, timeout=timeout)
        steps.append({"step": num, "msg": msg, "rc": rc, "out": out[:500]})
        if rc != 0 and critical:
            raise RuntimeError(f"Step {num} failed: {msg}\n{out[:300]}")
        return rc, out

    try:
        # Step 1: Check if already installed
        rc, _ = _run_user("pacman -Q nvidia-dkms", timeout=10)
        if rc == 0:
            _write_progress("install", 100, "NVIDIA driver already installed")
            return {"ok": True, "already_installed": True, "steps": steps}

        # Step 2: Unlock filesystem + drop stale pacman locks
        step(2, "Unlock filesystem",
             "steamos-readonly disable; rm -f /var/lib/pacman/db.lck /usr/lib/holo/pacmandb/db.lck 2>/dev/null; true",
             critical=False)

        # Step 3: Initialize package keys
        step(3, "Initialize pacman keys",
             "(pacman-key --init && pacman-key --populate archlinux holo) || "
             "(rm -rf /etc/pacman.d/gnupg && pacman-key --init && pacman-key --populate archlinux holo)",
             timeout=120)

        # Step 4: Free disk space
        _write_progress("install", 35, "Step 4: Free disk space")
        log("NVIDIA_INSTALL step 4: Free disk space")
        cleanup_cmds = [
            "rm -rf /usr/share/man /usr/share/doc /usr/share/info /usr/share/help 2>/dev/null; true",
            "rm -rf /usr/share/appstream /usr/share/wallpapers 2>/dev/null; true",
            "journalctl --vacuum-size=10M 2>/dev/null; true",
        ]
        for cmd in cleanup_cmds:
            _run(cmd, timeout=30, sudo=True)
        steps.append({"step": 4, "msg": "Free disk space", "rc": 0})

        # Step 5: Prepare build dirs
        step(5, "Prepare build environment",
             "mkdir -p /home/.egpubridge/dkms /home/.egpubridge/pacman-cache /home/.egpubridge/tmp; "
             "rm -rf /var/cache/pacman/pkg 2>/dev/null; "
             "ln -sfn /home/.egpubridge/pacman-cache /var/cache/pacman/pkg; "
             "if [ -d /var/lib/dkms ] && [ ! -L /var/lib/dkms ]; then "
             "  mkdir -p /home/.egpubridge/dkms; "
             "  cp -an /var/lib/dkms/. /home/.egpubridge/dkms/ 2>/dev/null; "
             "  rm -rf /var/lib/dkms; "
             "  ln -sfn /home/.egpubridge/dkms /var/lib/dkms; "
             "fi; true",
             critical=False)

        # Step 6: Detect kernel headers
        _write_progress("install", 50, "Step 6: Install NVIDIA packages")
        _, kernel = _run_user("uname -r", timeout=5)
        kernel = kernel.strip()
        m = re.search(r"neptune-(\d+)", kernel)
        kver = m.group(1) if m else "616"
        headers_pkg = f"linux-neptune-{kver}-headers"

        # Step 7: Install packages
        step(7, f"Install nvidia-dkms + {headers_pkg}",
             f"pacman -S --noconfirm --overwrite '*' {headers_pkg} nvidia-dkms nvidia-utils",
             timeout=600)

        # Step 8: DKMS build
        _write_progress("install", 70, "Step 8: DKMS build")
        log("NVIDIA_INSTALL step 8: DKMS build")
        _, nvidia_ver_out = _run_user("pacman -Q nvidia-dkms | awk '{print $2}' | cut -d- -f1", timeout=5)
        nvidia_ver = nvidia_ver_out.strip().split("-")[0] if nvidia_ver_out.strip() else ""
        if nvidia_ver:
            _run(f"dkms remove nvidia/{nvidia_ver} -k {kernel} 2>/dev/null", timeout=30, sudo=True)
            rc, out = _run(f"TMPDIR=/home/.egpubridge/tmp dkms install nvidia/{nvidia_ver} -k {kernel} --force", timeout=600, sudo=True)
            steps.append({"step": 8, "msg": f"DKMS build nvidia/{nvidia_ver}", "rc": rc, "out": out[:500]})
            if rc != 0:
                raise RuntimeError(f"DKMS build failed: {out[:300]}")

        # Step 9: Blacklist nouveau + cleanup
        step(9, "Configure blacklists",
             'echo "blacklist nouveau" > /etc/modprobe.d/egpubridge-nvidia.conf; '
             'echo "options nvidia-drm modeset=1" >> /etc/modprobe.d/egpubridge-nvidia.conf; '
             'rm -f /usr/share/glvnd/egl_vendor.d/10_nvidia.json '
             '/usr/lib/udev/rules.d/60-nvidia.rules '
             '/usr/lib/modprobe.d/nvidia-sleep.conf 2>/dev/null; true',
             critical=False)

        # Step 10: Load driver
        step(10, "Load NVIDIA driver",
             "modprobe nvidia && modprobe nvidia-uvm && modprobe nvidia-drm modeset=1",
             critical=False)

        # Step 11: Verify
        _write_progress("install", 95, "Step 11: Verify installation")
        rc, smi = _run_user("nvidia-smi -L", timeout=10)
        steps.append({"step": 11, "msg": "Verify nvidia-smi", "rc": rc, "out": smi[:300]})

        _write_progress("install", 100, "NVIDIA driver installed successfully")
        return {"ok": True, "steps": steps, "nvidia_smi": rc == 0}

    except Exception as e:
        _write_progress("install", -1, f"Failed: {e}")
        return {"ok": False, "error": str(e), "steps": steps}
    finally:
        _end_operation()


async def nvidia_install_driver(*args, **kwargs):
    if not _begin_operation("nvidia_install"):
        return {"ok": False, "error": "Another operation in progress: " + str(_operation_lock)}
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _nvidia_install_sync)
    except Exception as e:
        _end_operation()
        return {"ok": False, "error": str(e)}


def _nvidia_uninstall_sync():
    """Remove NVIDIA drivers and restore system."""
    steps = []
    try:
        _write_progress("uninstall", 10, "Unloading NVIDIA modules")
        _run("modprobe -r nvidia_uvm nvidia_drm nvidia_modeset nvidia 2>/dev/null", timeout=15, sudo=True)
        steps.append({"step": 1, "msg": "Unload modules"})

        _write_progress("uninstall", 30, "Removing DKMS modules")
        _run("dkms remove nvidia --all 2>/dev/null", timeout=60, sudo=True)
        steps.append({"step": 2, "msg": "DKMS remove"})

        _write_progress("uninstall", 50, "Removing packages")
        _run("pacman -Rdd --noconfirm nvidia-dkms nvidia-utils 2>/dev/null", timeout=120, sudo=True)
        steps.append({"step": 3, "msg": "Pacman remove"})

        _write_progress("uninstall", 70, "Cleaning configs")
        _run("rm -f /etc/modprobe.d/egpubridge-nvidia.conf /etc/modprobe.d/blacklist-nouveau.conf 2>/dev/null; true", timeout=10, sudo=True)
        _run("rm -f /home/.egpubridge/dkms 2>/dev/null; true", timeout=10, sudo=True)
        steps.append({"step": 4, "msg": "Clean configs"})

        _write_progress("uninstall", 90, "Re-enabling read-only filesystem")
        _run("steamos-readonly enable", timeout=10, sudo=True)
        steps.append({"step": 5, "msg": "Read-only restored"})

        _write_progress("uninstall", 100, "NVIDIA driver removed")
        return {"ok": True, "steps": steps}
    except Exception as e:
        _write_progress("uninstall", -1, f"Failed: {e}")
        return {"ok": False, "error": str(e), "steps": steps}
    finally:
        _end_operation()


async def nvidia_uninstall_driver(*args, **kwargs):
    if not _begin_operation("nvidia_uninstall"):
        return {"ok": False, "error": "Another operation in progress"}
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _nvidia_uninstall_sync)
    except Exception as e:
        _end_operation()
        return {"ok": False, "error": str(e)}


def _nvidia_activate_sync():
    """Activate NVIDIA eGPU: PCI rescan + modprobe + verify."""
    try:
        # Check driver installed
        rc, _ = _run_user("pacman -Q nvidia-dkms", timeout=10)
        if rc != 0:
            return {"ok": False, "error": "NVIDIA driver not installed. Run Install Driver first."}

        # PCI rescan
        _write_progress("activate", 20, "Rescanning PCI bus")
        _run("echo 1 > /sys/bus/pci/rescan", timeout=15, sudo=True)
        poll_drm_card_appear(timeout_s=15)

        # Check for NVIDIA device
        _write_progress("activate", 40, "Detecting NVIDIA GPU")
        found = False
        for vp in Path("/sys/bus/pci/devices").glob("*/vendor"):
            try:
                if vp.read_text().strip().lower() == PCI_VENDOR_NVIDIA:
                    boot = (vp.parent / "boot_vga").read_text(errors="ignore").strip()
                    if boot != "1":
                        found = True
                        break
            except Exception:
                continue
        if not found:
            return {"ok": False, "error": "No NVIDIA GPU found on PCI bus"}

        # Load modules
        _write_progress("activate", 60, "Loading NVIDIA modules")
        _run("modprobe nvidia", timeout=30, sudo=True)
        _run("modprobe nvidia-uvm", timeout=15, sudo=True)
        _run("modprobe nvidia-drm modeset=1", timeout=15, sudo=True)

        # Verify
        _write_progress("activate", 80, "Verifying nvidia-smi")
        rc, smi = _run_user("nvidia-smi --query-gpu=name --format=csv,noheader", timeout=10)
        if rc != 0:
            return {"ok": False, "error": "nvidia-smi failed after loading driver", "smi_out": smi}

        # Detect connector
        _write_progress("activate", 90, "Detecting display connector")
        nvidia_card = None
        for card in sorted(Path("/sys/class/drm").glob("card[0-9]*")):
            driver_link = card / "device" / "driver"
            if driver_link.exists():
                try:
                    if driver_link.resolve().name == "nvidia":
                        nvidia_card = card.name
                        break
                except Exception:
                    continue

        connector_name = None
        if nvidia_card:
            for c in sorted(Path("/sys/class/drm").glob(f"{nvidia_card}-*")):
                name = c.name.replace(f"{nvidia_card}-", "")
                if "eDP" not in name:
                    status = (c / "status").read_text(errors="ignore").strip()
                    if status == "connected":
                        connector_name = name
                        break
                    if not connector_name:
                        connector_name = name

        # Get vendor:device ID
        vendor_device = None
        if nvidia_card:
            dev_path = Path(f"/sys/class/drm/{nvidia_card}/device")
            v = (dev_path / "vendor").read_text(errors="ignore").strip()
            d = (dev_path / "device").read_text(errors="ignore").strip()
            vendor_device = f"{v}:{d}".replace("0x", "")

        # Set environment for Wayland/gamescope to prefer NVIDIA
        if vendor_device:
            _run(f"systemctl set-environment MESA_VK_DEVICE_SELECT={vendor_device}", timeout=5, sudo=True)
            _run("systemctl set-environment VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/nvidia_icd.json", timeout=5, sudo=True)
            _run("systemctl set-environment __NV_PRIME_RENDER_OFFLOAD=1", timeout=5, sudo=True)
            _run("systemctl set-environment __GLX_VENDOR_LIBRARY_NAME=nvidia", timeout=5, sudo=True)

        # Restart gamescope to pick up new env vars
        _write_progress("activate", 95, "Restarting gamescope session")
        try:
            _run("systemctl restart gamescope-session", timeout=15, sudo=True)
        except Exception:
            pass

        _write_progress("activate", 100, "NVIDIA eGPU activated")
        _write_vendor("nvidia")

        return {
            "ok": True,
            "gpu_name": smi.strip(),
            "nvidia_card": nvidia_card,
            "connector": connector_name,
            "vendor_device": vendor_device,
        }
    except Exception as e:
        _write_progress("activate", -1, f"Failed: {e}")
        return {"ok": False, "error": str(e)}
    finally:
        _end_operation()


async def nvidia_activate(*args, **kwargs):
    if not _begin_operation("nvidia_activate"):
        return {"ok": False, "error": "Another operation in progress"}
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _nvidia_activate_sync)
    except Exception as e:
        _end_operation()
        return {"ok": False, "error": str(e)}


def _nvidia_deactivate_sync():
    """Deactivate NVIDIA eGPU: unload modules + PCI remove."""
    try:
        # Switch to internal display first
        _write_progress("deactivate", 10, "Switching to internal display")
        try:
            write_gamescope_wrapper_config("*,eDP-1", "disabled")
            write_gamescope_mode_config(disabled=True)
        except Exception:
            pass

        # Try modprobe -r
        _write_progress("deactivate", 30, "Unloading NVIDIA modules")
        _run("modprobe -r nvidia_uvm nvidia_drm nvidia_modeset nvidia 2>/dev/null", timeout=15, sudo=True)

        # Check if modules are still loaded
        rc, _ = _run_user("lsmod | grep '^nvidia '", timeout=5)
        if rc == 0:
            # Try killing only nvidia DRI clients (not iGPU)
            _write_progress("deactivate", 50, "Killing NVIDIA DRI clients")
            for card_path in sorted(Path("/sys/class/drm").glob("card[0-9]*/device/driver")):
                try:
                    if card_path.resolve().name == "nvidia":
                        card_name = card_path.parent.parent.name
                        _run(f"fuser -k /dev/dri/{card_name} 2>/dev/null; true", timeout=10, sudo=True)
                except Exception:
                    pass
            time.sleep(2)
            _run("modprobe -r nvidia_uvm nvidia_drm nvidia_modeset nvidia 2>/dev/null", timeout=15, sudo=True)

            rc2, _ = _run_user("lsmod | grep '^nvidia '", timeout=5)
            if rc2 == 0:
                log("NVIDIA_DEACTIVATE: modules still loaded, skipping PCI remove to avoid kernel panic")
                _write_progress("deactivate", -1, "NVIDIA modules still loaded. Close GPU applications first.")
                return {"ok": False, "error": "NVIDIA modules still loaded. Close all GPU applications first.", "modules_stuck": True}

        # PCI remove
        _write_progress("deactivate", 70, "Removing PCI devices")
        removed = 0
        for vp in Path("/sys/bus/pci/devices").glob("*/vendor"):
            try:
                if vp.read_text().strip().lower() == PCI_VENDOR_NVIDIA:
                    boot = (vp.parent / "boot_vga").read_text(errors="ignore").strip()
                    if boot != "1":
                        _run(f"echo 1 > {vp.parent}/remove", timeout=10, sudo=True)
                        removed += 1
            except Exception:
                continue

        # Unset NVIDIA environment variables
        for env_key in ("MESA_VK_DEVICE_SELECT", "VK_ICD_FILENAMES", "WLR_DRM_DEVICES", "__NV_PRIME_RENDER_OFFLOAD", "__GLX_VENDOR_LIBRARY_NAME"):
            _run(f"systemctl unset-environment {env_key}", timeout=5, sudo=True)

        _write_vendor("auto")
        _write_progress("deactivate", 100, f"Deactivated ({removed} PCI devices removed)")

        return {"ok": True, "pci_removed": removed}
    except Exception as e:
        _write_progress("deactivate", -1, f"Failed: {e}")
        return {"ok": False, "error": str(e)}
    finally:
        _end_operation()


async def nvidia_deactivate(*args, **kwargs):
    if not _begin_operation("nvidia_deactivate"):
        return {"ok": False, "error": "Another operation in progress"}
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _nvidia_deactivate_sync)
    except Exception as e:
        _end_operation()
        return {"ok": False, "error": str(e)}


async def read_progress(*args, **kwargs):
    return _read_progress()


async def get_vendor_api(*args, **kwargs):
    return {"vendor": get_active_vendor(), "config": _read_vendor()}


async def set_vendor_api(*args, **kwargs):
    vendor = _decky_str(args, kwargs, "vendor", "auto")
    _write_vendor(vendor)
    return {"ok": True, "vendor": vendor}


try:
    Plugin.nvidia_install_driver = staticmethod(nvidia_install_driver)
    Plugin.nvidia_uninstall_driver = staticmethod(nvidia_uninstall_driver)
    Plugin.nvidia_activate = staticmethod(nvidia_activate)
    Plugin.nvidia_deactivate = staticmethod(nvidia_deactivate)
    Plugin.read_progress = staticmethod(read_progress)  # orphaned: not called from frontend
    Plugin.get_vendor = staticmethod(get_vendor_api)  # orphaned: not called from frontend
    Plugin.set_vendor = staticmethod(set_vendor_api)  # orphaned: not called from frontend
except Exception:
    pass

