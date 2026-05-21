#!/bin/bash
LOG="/home/deck/homebrew/plugins/eGPUBridge/shutdown.log"
echo "$(date) eGPUBridge shutdown: starting" >> "$LOG"
NVIDIA_SLOT=""
for dev in /sys/bus/pci/devices/*; do
    vendor=$(cat "$dev/vendor" 2>/dev/null)
    boot=$(cat "$dev/boot_vga" 2>/dev/null)
    if [ "$vendor" = "0x10de" ] && [ "$boot" != "1" ]; then
        NVIDIA_SLOT=$(basename "$dev")
        break
    fi
done
if [ -z "$NVIDIA_SLOT" ]; then
    echo "$(date) no NVIDIA eGPU" >> "$LOG"
    exit 0
fi
echo "$(date) teardown $NVIDIA_SLOT" >> "$LOG"
fuser -k /dev/dri/* 2>/dev/null
sleep 2
timeout 15 modprobe -r nvidia_uvm nvidia_drm nvidia_modeset nvidia 2>> "$LOG"
echo 1 > "/sys/bus/pci/devices/$NVIDIA_SLOT/remove" 2>> "$LOG"
echo "$(date) done" >> "$LOG"
