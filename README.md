# eGPUBridge

![Version](https://img.shields.io/badge/version-0.3.alfa-blue)
![Decky](https://img.shields.io/badge/Decky-Loader-green)
![SteamOS](https://img.shields.io/badge/SteamOS-3.x-orange)
![License](https://img.shields.io/badge/license-MIT-green)

**eGPU manager for SteamOS Game Mode** — seamless eGPU switching, TV control, and GPU tuning for handheld gaming PCs.

## Features

- **SMART Display Switch** — one-tap toggle between internal and external display
- **GPU Tuning** — power cap, fan control, performance level, overclocking (AMD)
- **TV Control** — ADB-based TV power/input control with Wi-Fi auto-start
- **NVIDIA Support** — DKMS driver install, activate/deactivate, nvidia-smi telemetry
- **Dock Detection** — USB4/Thunderbolt dock status, ASMedia 246x identification
- **Safe Disconnect** — graceful eGPU removal with PCI cleanup
- **Gamepad UI** — fully navigable with Steam Deck gamepad controls
- **Recovery Hotkeys** — hardware button combos for display recovery

## Supported Devices

| Device | Status |
|--------|--------|
| Steam Deck / OLED | Full support |
| ASUS ROG Ally / Ally X | Full support |
| Lenovo Legion Go | Full support |
| Lenovo Legion Go S | Full support (eGPU detected) |

## Installation

### Via Decky Loader (recommended)

1. Install [Decky Loader](https://decky.xyz) on your Steam Deck
2. Open Decky in Game Mode → Plugin Store
3. Search for "eGPUBridge" → Install

### Manual Install

1. Download the latest release from [Releases](https://github.com/WowOne987/eGPUBridge/releases)
2. Copy the plugin folder to `~/homebrew/plugins/eGPUBridge/`
3. Restart Decky: `sudo systemctl restart plugin_loader`

> **Note:** Plugin requires `root` flag — Decky will prompt for sudo access.

## Usage

### SMART Button
The main control — toggles between internal display and eGPU-connected external display. Shows current connector name (e.g., "HDMI 1 TV").

### TV Control
- **ON / HDMI / OFF** — control TV power and input via ADB
- **Wi-Fi Auto Start** — automatically switch TV input when eGPU is detected
- **IP Roller** — gamepad-friendly IP address input for TV

### GPU Tuning (AMD)
- **Power Limit** — adjust GPU power cap (D-pad left/right)
- **Performance Level** — AUTO / HIGH / LOW / MANUAL
- **Power Profile** — BOOTUP / 3D_FULL_SCREEN / POWER_SAVING / etc.
- **Manual Clocks** — GPU/VRAM/Voltage sliders (MANUAL mode)

### GPU Tuning (NVIDIA)
- **Power Cap** — via `nvidia-smi -pl`
- **Fan Control** — auto/manual via `nvidia-settings`
- **Performance Level** — GPUPowerMizerMode (auto/high/low)

### NVIDIA Driver Management
- **Install Driver** — DKMS-based nvidia-dkms installation on SteamOS
- **Activate / Deactivate** — module loading, environment variables, gamescope restart
- **Uninstall Driver** — clean removal with DKMS + pacman

### Other
- **Recovery Hotkey** — toggle hardware button combos for display recovery
- **Safe Unplug** — graceful eGPU disconnect
- **Restore Internal** — switch back to internal display
- **Diagnostics** — collect device info, TV health, recent events

## Building from Source

The plugin uses a pre-built frontend — no build step required.

```bash
# The dist/index.js IS the source (no TypeScript compilation)
# Edit dist/index.js directly for UI changes
# Edit main.py for backend changes

# Verify syntax
node -c dist/index.js
python3 -c "import ast; ast.parse(open('main.py').read())"
```

## Architecture

```
eGPUBridge/
├── dist/index.js      # Frontend (React via Decky API)
├── src/index.tsx       # Source copy (identical to dist)
├── main.py             # Backend (Python, Decky Plugin class)
├── package.json        # Decky plugin metadata
├── plugin.json         # Decky plugin config
├── bin/                # Shell scripts (auto-detect, shutdown)
│   ├── egpubridge-auto.sh
│   ├── egpubridge-shutdown.sh
│   ├── gamescope-session-egpubridge
│   └── platform-tools/ # ADB, fastboot
└── LICENSE
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes (edit `dist/index.js` and/or `main.py`)
4. Test on Steam Deck or compatible device
5. Submit a Pull Request

## License

[MIT](LICENSE) — Copyright (c) 2026 Vova + GPT
