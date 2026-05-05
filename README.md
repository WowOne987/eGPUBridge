# eGPUBridge

Decky Loader plugin for SteamOS Game Mode that helps manage an external GPU display path.

## Current focus

eGPUBridge is designed for SteamOS / Decky Loader systems where an external GPU is connected through USB4 / Thunderbolt and the external display is attached to the eGPU.

Main features:

- eGPU status display
- internal display / external TV display switching
- TV/eGPU render mode selection
- optional TV control through Wake-on-LAN / ADB / CEC
- emergency recovery hotkey
- read-only USB4 dock status

## Important safety notes

This plugin is experimental.

It should not patch the system Gamescope session file directly.
It should not restart SDDM or display-manager for normal switching.
The intended safe switching path is through plugin wrapper config files and gamescope-session.target.

## Runtime files

The plugin may create local runtime config files on the target system:

- output_order.conf
- prefer_vk_device.conf
- gamescope_mode.conf
- hotkey_settings.json
- tv_control_automation.json

These files are intentionally ignored by Git and should not be committed.

## TV control config

Optional TV control config can be placed at:

    /home/deck/.config/egpubridge-tv.conf

Use the example file:

    examples/egpubridge-tv.conf.example

Do not publish your real TV IP address, MAC address, or ADB details.

## Android platform-tools

ADB binaries are not included in this repository.
If ADB-based TV control is needed, provide adb separately according to your system and licensing requirements.

## Dock control

Dock status is read-only.

The plugin must not send ASMedia vendor commands, USB reset commands, or dock power-control commands.

## Known tested hardware path

The current development setup used a Lenovo Legion Go S class SteamOS handheld with an AMD eGPU connected through an ASMedia USB4 bridge.

The implementation should prefer detection from sysfs, DRM, PCI, USB4, EDID, and runtime state rather than relying on one hardcoded device.
