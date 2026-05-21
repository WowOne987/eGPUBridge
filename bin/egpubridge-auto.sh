#!/bin/bash
# eGPUBridge: Auto-detect and activate eGPU at boot
VENDOR_FILE="/home/deck/.config/egpubridge/vendor"
LOG="/home/deck/homebrew/plugins/eGPUBridge/auto.log"

echo "$(date) eGPUBridge auto: starting" >> "$LOG"

vendor=$(cat "$VENDOR_FILE" 2>/dev/null || echo "auto")

# Wait for Thunderbolt devices to enumerate
sleep 5

# Check for NVIDIA eGPU
nvidia_found=false
for dev in /sys/bus/pci/devices/*; do
    v=$(cat "$dev/vendor" 2>/dev/null)
    boot=$(cat "$dev/boot_vga" 2>/dev/null)
    if [ "$v" = "0x10de" ] && [ "$boot" != "1" ]; then
        nvidia_found=true
        echo "$(date) eGPUBridge auto: NVIDIA device found at $(basename $dev)" >> "$LOG"
        break
    fi
done

if [ "$nvidia_found" = "true" ]; then
    # Load nvidia modules
    echo "$(date) eGPUBridge auto: loading nvidia modules" >> "$LOG"
    modprobe nvidia 2>> "$LOG"
    modprobe nvidia-uvm 2>> "$LOG"
    modprobe nvidia-drm modeset=1 2>> "$LOG"
    
    # Verify
    if nvidia-smi -L 2>/dev/null; then
        echo "$(date) eGPUBridge auto: nvidia-smi OK" >> "$LOG"
    else
        echo "$(date) eGPUBridge auto: nvidia-smi failed" >> "$LOG"
    fi
fi

echo "$(date) eGPUBridge auto: done" >> "$LOG"
