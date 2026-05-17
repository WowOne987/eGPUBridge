# eGPUBridge

Decky Loader plugin for SteamOS Game Mode that manages external GPU display switching.

## Features

- eGPU detection and status display (USB4/Thunderbolt)
- Internal display / external TV switching
- TV/eGPU render mode selection
- Optional TV control: Wake-on-LAN, ADB, CEC
- Emergency recovery hotkey
- Read-only USB4 dock status

## Requirements

- SteamOS (Steam Deck, Lenovo Legion Go S, or similar handheld)
- [Decky Loader](https://decky.xyz)
- eGPU connected via USB4/Thunderbolt with display attached

## Installation

1. Copy the plugin folder to `~/homebrew/plugins/eGPUBridge/`
2. Restart Steam or reload Decky Loader

## Safety

This plugin is experimental. It does **not**:
- Patch the system Gamescope session file directly
- Restart SDDM or display-manager for normal switching

Switching is done through plugin wrapper config files and `gamescope-session.target`.

## Runtime files

The plugin creates local config files on the target system:

- `output_order.conf` — display output order
- `prefer_vk_device.conf` — Vulkan device preference
- `gamescope_mode.conf` — Gamescope display mode
- `hotkey_settings.json` — hotkey bindings
- `tv_control_automation.json` — TV automation rules

These are generated at runtime and should not be committed.

## TV control config

Optional TV control config:

```
/home/deck/.config/egpubridge-tv.conf
```

See `examples/egpubridge-tv.conf.example`. Do not publish your real TV IP, MAC, or ADB details.

## Android platform-tools

ADB binaries are not included. If ADB-based TV control is needed, install `adb` separately.

## Tested hardware

- Lenovo Legion Go S (SteamOS) + AMD eGPU via ASMedia USB4 bridge

The plugin uses sysfs, DRM, PCI, USB4, and EDID for detection — not hardcoded to one device.

## License

[MIT](LICENSE)
