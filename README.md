# eGPUBridge

Decky Loader plugin for SteamOS Game Mode that helps manage an external GPU display path.

eGPUBridge is built for SteamOS / SteamOS-like handheld systems where an external GPU is connected through USB4 / Thunderbolt and the external display is connected to the eGPU.

The main goal is to make eGPU display switching safer and easier from SteamOS Game Mode without manually editing Gamescope commands every time.

## Current status

This project is experimental.

It works on the tested hardware setup, but it should not be treated as a universal eGPU solution for every SteamOS device yet.

The code is being developed around one real working setup first, with the goal of becoming more generic over time.

If you use different hardware and want to improve detection, add profiles, clean up the code, or adapt it for your own eGPU setup, contributions, forks, and pull requests are welcome.

## Tested hardware

This plugin was developed and tested on one personal hardware setup:

- Lenovo Legion Go S running SteamOS / SteamOS-like Game Mode
- AMD Radeon RX 9070 / RX 9070 XT class eGPU
- ASMedia 246x USB4 bridge / dock path
- External TV connected through the eGPU HDMI output
- Optional TV control tested with Wake-on-LAN and ADB

This does not mean the plugin is limited only to this setup, but other devices may need adjustments.

The implementation should prefer hardware discovery from sysfs, DRM, PCI, USB4, EDID, connector state, vendor/device IDs, and runtime Gamescope state instead of relying only on one hardcoded device.

## Main features

eGPUBridge currently focuses on:

- eGPU status display
- internal display / external TV display switching
- TV/eGPU render mode selection
- optional TV control through Wake-on-LAN, ADB, or CEC
- emergency recovery back to the internal display
- read-only USB4 dock / bridge status
- diagnostics and recent event display

## What the plugin shows

The main status card is intended to show the current display route.

It can show information such as:

- current route status
- detected eGPU
- active GPU / primary GPU path
- USB4 / dock status
- active display target
- TV control status
- recovery hotkey status
- current panel or TV signal mode

The dock status is read-only. It is only used to report the USB4 / ASMedia bridge state.

The plugin must not send ASMedia vendor commands, USB reset commands, or dock power-control commands.

## Main controls

### SMART

SMART is the main display switch.

It is designed as a safe toggle:

- if the internal display is active, SMART switches to the TV/eGPU path
- if the TV/eGPU path is active, SMART switches back to the internal display

The intended TV/eGPU path is:

- prefer the eGPU Vulkan device
- put the external connector first in Gamescope output order
- keep the internal panel as fallback when needed
- restart only the user Gamescope session target

The intended internal path is:

- disable the eGPU Vulkan preference
- restore internal display priority
- disable custom TV render mode
- restart only the user Gamescope session target

### TV Mode

TV Mode selects the render size and refresh rate for the external display path.

Example modes:

- 3840x2160 @ 60Hz
- 2560x1440 @ 120Hz
- 2560x1440 @ 60Hz
- 1920x1080 @ 120Hz
- 1920x1080 @ 60Hz

The selected mode is written to the plugin runtime config and applied through the same safe Gamescope wrapper path.

TV Mode is not a separate unsafe display switch. It is part of the controlled external display path.

## How display switching works

eGPUBridge should not directly patch the system Gamescope session file.

The safe switching model is based on plugin-controlled wrapper config files.

For TV/eGPU mode, the runtime state is typically:

    output_order.conf = HDMI-A-1,eDP-1
    prefer_vk_device.conf = 1002:7550
    gamescope_mode.conf = selected mode or disabled

This results in Gamescope being started with options similar to:

    --prefer-vk-device 1002:7550
    -O HDMI-A-1,eDP-1

For internal mode, the runtime state is typically:

    output_order.conf = *,eDP-1
    prefer_vk_device.conf = disabled
    gamescope_mode.conf = disabled

This results in Gamescope being started with output order similar to:

    -O *,eDP-1

The important safety principle is:

- do not patch `/usr/lib/steamos/gamescope-session`
- do not restart `sddm`
- do not restart the system display manager
- use the plugin wrapper configuration
- restart only `gamescope-session.target` when a display mode change must be applied

## Runtime files

The plugin may create local runtime files on the target SteamOS system.

These files are local state and should not be committed to Git:

    output_order.conf
    prefer_vk_device.conf
    gamescope_mode.conf
    hotkey_settings.json
    tv_control_automation.json

These files are intentionally listed in `.gitignore`.

## Optional TV control

TV control is optional. Display switching can work without it.

TV control may use:

- Wake-on-LAN to wake the TV
- ADB to control Android TV / Google TV style devices
- CEC if a supported CEC device or CEC path is available

Optional TV control can be configured through a local file:

    /home/deck/.config/egpubridge-tv.conf

Use the example config:

    examples/egpubridge-tv.conf.example

Do not commit your real TV IP address, MAC address, ADB target, or private network details.

Example config format:

    TV_IP=YOUR_TV_IP
    TV_MAC=YOUR_TV_MAC
    TV_ADB_PORT=5555
    TV_DEFAULT_HDMI=1

## Wi-Fi TV Auto Start

Wi-Fi TV Auto Start is an optional automation layer.

When enabled, the plugin can try to wake the TV and switch the TV input before applying the TV/eGPU display path.

This is useful when the external display path depends on the TV being awake and on the correct HDMI input.

This feature is optional and should stay configurable because not all TVs support the same wake/input control methods.

The setting is stored locally in:

    tv_control_automation.json

Typical local setting:

    {
      "tv_control_automation_enabled": true,
      "tv_off_on_internal_enabled": false
    }

The `tv_off_on_internal_enabled` option should stay optional. It should not be enabled by default because not every user wants the TV to turn off automatically when returning to the internal display.

## Manual TV Control

Manual TV Control is a separate optional section for direct TV actions.

It can expose actions such as:

- TV ON
- HDMI input switch
- TV OFF
- TV Control status check

These actions are separate from the main SMART display switch.

The HDMI button changes TV input only. It does not by itself change the SteamOS / Gamescope display path.

To get a visible TV/eGPU picture, the external display path still needs to be enabled through SMART or TV Mode.

## Recovery Hotkey

The recovery hotkey is intended as an emergency fallback.

On the tested device, holding Y1 + Y2 for several seconds can force recovery back to the internal display path.

The recovery goal is:

- restore internal display output order
- disable eGPU Vulkan preference
- disable custom TV mode
- restart only `gamescope-session.target`

This is useful if the external display path is selected but the TV picture is not visible.

The setting is stored locally in:

    hotkey_settings.json

Typical local setting:

    {
      "hotkeys_enabled": true
    }

## Diagnostics / Recovery

The Diagnostics / Recovery section contains helper actions.

Examples:

- Prepare for unplug  
  Safe path before unplugging USB4/eGPU.

- Legacy restore internal  
  Force back to the built-in display path.

- Reapply TV mode  
  Apply the current TV/eGPU mode again.

- Safe Mode 1080p60  
  Fallback mode if the TV picture is wrong.

- Recent events  
  Show recent plugin / display events.

- Debug info  
  Show Gamescope command and last backend result.

These tools are meant for troubleshooting and recovery.

Normal daily switching should use SMART and TV Mode.

## Android platform-tools

ADB binaries are not included in this repository.

If ADB-based TV control is needed, provide `adb` separately according to your system and licensing requirements.

The public repository should not include Android platform-tools binaries.

## Installation notes

This repository is currently a public source snapshot, not a polished Decky Store package.

Manual installation for development/testing is expected to use a Decky Loader plugin folder such as:

    /home/deck/homebrew/plugins/eGPUBridge

After copying the plugin files, restart Decky Plugin Loader if needed:

    sudo systemctl restart plugin_loader.service

Normal display switching should not require restarting SDDM or the system display manager.

## Project structure

Expected public repository structure:

    README.md
    LICENSE
    .gitignore
    main.py
    plugin.json
    package.json
    src/index.tsx
    dist/index.js
    examples/
    docs/
    bin/

The public repository should not include:

    stable_backup/
    backup_old_edits/
    node_modules/
    __pycache__/
    runtime .conf files
    runtime .json settings
    logs
    Android platform-tools binaries
    personal TV IP/MAC configuration

## Known limitations

This project is experimental.

Known limitations:

- tested primarily on one hardware setup
- different USB4 docks may report different sysfs information
- different GPUs may need different device IDs or detection improvements
- different TVs may need different Wake-on-LAN, ADB, CEC, or HDMI input mapping
- SteamOS / Gamescope behavior may change between updates
- UI behavior depends on Decky Loader and SteamOS Game Mode components
- the project still contains development history and may need cleanup before wider packaging

## Safety principles

The project should keep these safety principles:

- diagnose before changing display state
- keep the internal display as the recovery target
- avoid patching system Gamescope files directly
- avoid SDDM/display-manager restarts for normal switching
- avoid dock power control and USB reset commands
- prefer read-only hardware detection where possible
- keep TV control optional
- keep local IP/MAC/config outside Git

## Contributions

Contributions are welcome.

Useful improvements may include:

- better hardware detection
- more generic GPU / dock profiles
- safer config handling
- better UI polish
- better diagnostics
- support for more TVs and input switching methods
- cleaner separation between runtime config and public source
- improved packaging for Decky Loader
- better documentation for different hardware setups

If you adapt eGPUBridge for your own SteamOS/eGPU setup, please share improvements so other users can benefit too.

## License

MIT License.
