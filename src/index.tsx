// eGPUBridge v0.3.alfa - gamepad friendly frontend using Decky/Steam ButtonItem. WAGON_UI_SKELETON_90004 ROUTE_STATUS_WAGON_90101 GPU_PROFILES_WAGON_UI_90202R1 GPU_WAGON_STATE_9020302 GPU_POLISH_TVCHECK_9020303 AMD_CAPABILITY_UI_90302R1 GPU_POLICY_UI_90304 GPU_ACTIONS_UI_90402R1 GPU_PROFILE_UI_90501B UI_SHELL_GPU_BEFORE_RECOVERY_90602R2 UI_SHELL_RENAME_GPU_CENTER_9060302 UI_SHELL_REMOVED_HOTKEY_MINI_9060303 UI_SHELL_REPAIR_GPU_CENTER_BOUNDARIES_9060304R1 UI_SHELL_REMOVED_DUPLICATE_TV_CHECK_9060305 UI_GPU_HEADERS_90702

const DFL = Object.assign(
  {},
  window.DeckyPluginLoader || {},
  window.DFL || {},
  window.deckyFrontendLib || {}
);
const React =
  DFL.React ||
  window.React ||
  window.SP_REACT ||
  window.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.React ||
  globalThis.React;

const Components =
  DFL.Components ||
  DFL.components ||
  window.DeckyPluginLoader?.Components ||
  window.DeckyPluginLoader?.components ||
  {};

const PanelSection =
  Components.PanelSection ||
  DFL.PanelSection ||
  function(props) {
    return React.createElement("div", { style: { marginBottom: "8px" } },
      React.createElement("div", { style: { fontWeight: 800, margin: "8px 0" } }, props.title || ""),
      props.children
    );
  };

const PanelSectionRow =
  Components.PanelSectionRow ||
  DFL.PanelSectionRow ||
  function(props) {
    return React.createElement("div", { style: { margin: "6px 0" } }, props.children);
  };

const ButtonItem =
  DFL.ButtonItem ||
  Components.ButtonItem ||
  Components.Button ||
  DFL.Button;

const DialogButton =
  DFL.DialogButton ||
  Components.DialogButton ||
  null;

const Focusable =
  DFL.Focusable ||
  Components.Focusable ||
  null;

function getServerApi(x) {
  if (!x) return null;
  if (x.serverAPI) return x.serverAPI;
  if (x.serverApi) return x.serverApi;
  return x;
}

function call(serverApi, method, args) {
  args = args || {};
  if (!serverApi || !serverApi.callPluginMethod) {
    return Promise.resolve({ ok: false, error: "serverApi.callPluginMethod unavailable" });
  }
  return serverApi.callPluginMethod(method, args).then(function(res) {
    return res && res.result !== undefined ? res.result : res;
  });
}

function e(tag, props) {
  var children = Array.prototype.slice.call(arguments, 2);
  return React.createElement.apply(React, [tag, props || {}].concat(children));
}

function Pre(props) {
  var obj = props.obj;
  return e(
    "pre",
    {
      style: {
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        overflow: "auto",
        maxHeight: props.maxHeight || "170px",
        fontSize: "9.5px",
        lineHeight: "14px",
        background: "rgba(0,0,0,.35)",
        borderRadius: "10px",
        padding: "10px",
        margin: "8px 0"
      }
    },
    typeof obj === "string" ? obj : JSON.stringify(obj, null, 2)
  );
}

// IP Roller component - gamepad-friendly IP input (adapted from Reroll plugin)
// Format: 3 digits . 3 digits . 3 digits . 2 digits = 11 digits total
function IpRoller(props) {
  var value = props.value || "192.168.188.00";
  var onChange = props.onChange;
  var disabled = !!props.disabled;

  // IP has 4 octets: first three are 3 digits, last is 2 digits
  var OCTET_LENGTHS = [3, 3, 3, 2];
  var TOTAL_DIGITS = 11;

  // Parse IP to digits array
  function ipToDigits(ip) {
    var parts = ip.split(".");
    var digits = [];
    for (var i = 0; i < 4; i++) {
      var len = OCTET_LENGTHS[i];
      var part = (parts[i] || "0").padStart(len, "0");
      // Take last len digits (in case part is longer)
      part = part.slice(-len);
      for (var j = 0; j < len; j++) {
        digits.push(part[j] || "0");
      }
    }
    return digits;
  }

  function digitsToIp(digits) {
    var parts = [];
    var offset = 0;
    for (var i = 0; i < 4; i++) {
      var len = OCTET_LENGTHS[i];
      parts.push(digits.slice(offset, offset + len).join(""));
      offset += len;
    }
    return parts.join(".");
  }

  // Map digit index to dot position (dot before index 3, 6, 9)
  function shouldShowDot(index) {
    return index === 3 || index === 6 || index === 9;
  }

  var _state = React.useState(ipToDigits(value));
  var digits = _state[0];
  var setDigits = _state[1];

  var _cursor = React.useState(0);
  var cursor = _cursor[0];
  var setCursor = _cursor[1];

  var _editing = React.useState(false);
  var isEditing = _editing[0];
  var setIsEditing = _editing[1];

  // Update digits when value changes externally
  React.useEffect(function() {
    if (!isEditing) {
      setDigits(ipToDigits(value));
    }
  }, [value, isEditing]);

  // Handle gamepad direction - correct button values from Reroll
  function handleDirection(event) {
    if (!isEditing) return false;
    var button = event.detail.button;
    if (button === 11) { // DIR_LEFT
      setCursor(function(p) { return (p - 1 + TOTAL_DIGITS) % TOTAL_DIGITS; });
    } else if (button === 12) { // DIR_RIGHT
      setCursor(function(p) { return (p + 1) % TOTAL_DIGITS; });
    } else if (button === 9) { // DIR_UP
      var newDigits = digits.slice();
      newDigits[cursor] = String((parseInt(newDigits[cursor]) + 1) % 10);
      setDigits(newDigits);
      if (onChange) onChange(digitsToIp(newDigits));
    } else if (button === 10) { // DIR_DOWN
      var newDigits = digits.slice();
      newDigits[cursor] = String((parseInt(newDigits[cursor]) + 9) % 10);
      setDigits(newDigits);
      if (onChange) onChange(digitsToIp(newDigits));
    }
  }

  // Handle OK button - enter editing or set digit to 0
  function handleOkButton(event) {
    if (!isEditing) {
      event.currentTarget.click();
      return false;
    }
    var newDigits = digits.slice();
    newDigits[cursor] = "0";
    setDigits(newDigits);
    if (onChange) onChange(digitsToIp(newDigits));
  }

  // Handle cancel - exit editing
  function handleCancel() {
    if (!isEditing) return false;
    setIsEditing(false);
  }

  // Render digit with dot separators
  function renderDigit(index) {
    var isActive = isEditing && index === cursor;
    var showDot = shouldShowDot(index);
    return React.createElement("div", {
      key: index,
      style: { display: "flex", alignItems: "center" }
    },
      showDot ? React.createElement("div", {
        style: {
          fontSize: "12px", fontWeight: "900", color: "rgba(245,248,255,.50)",
          margin: "0 1px"
        }
      }, ".") : null,
      React.createElement("div", {
        style: {
          display: "flex", flexDirection: "column", alignItems: "center",
          width: "10px"
        }
      },
        // Up caret
        React.createElement("div", {
          style: {
            fontSize: "7px", color: "rgba(255,255,255,.70)",
            visibility: isActive ? "visible" : "hidden",
            marginBottom: "-1px", lineHeight: "7px"
          }
        }, "^"),
        // Digit
        React.createElement("div", {
          style: {
            fontSize: "12px", fontWeight: "900",
            color: isActive ? "rgba(100,200,255,1)" : "rgba(245,248,255,.94)",
            background: isActive ? "rgba(100,200,255,.15)" : "transparent",
            borderRadius: "2px", padding: "1px 0px",
            minWidth: "8px", textAlign: "center"
          }
        }, digits[index]),
        // Down caret
        React.createElement("div", {
          style: {
            fontSize: "7px", color: "rgba(255,255,255,.70)",
            visibility: isActive ? "visible" : "hidden",
            marginTop: "-1px", lineHeight: "7px"
          }
        }, "v")
      )
    );
  }

  return React.createElement(Focusable, {
    className: "egpuProfileRow",
    onGamepadDirection: handleDirection,
    onOKButton: handleOkButton,
    onCancel: handleCancel,
    onActivate: function() {
      if (disabled) return false;
      setIsEditing(true);
    },
    onGamepadFocus: function() {},
    onGamepadBlur: function() {
      if (isEditing) setIsEditing(false);
    },
    actionDescriptionMap: isEditing ? {
      "DPAD_UP": "Increase",
      "DPAD_DOWN": "Decrease",
      "DPAD_LEFT": "Move",
      "DPAD_RIGHT": "Move",
      "CANCEL": "Back"
    } : {
      "OK": "Edit IP"
    },
    style: {
      width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center",
      gap: "4px", marginBottom: "6px", padding: "4px 6px", borderRadius: "8px",
      background: isEditing ? "rgba(100,200,255,.08)" : "transparent"
    }
  },
    // Label
    React.createElement("div", {
      className: "egb-label",
      style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)", flex: "0 0 auto" }
    }, "TV IP"),
    // Digits container
    React.createElement("div", {
      style: {
        flex: "1 1 auto", display: "flex", alignItems: "center",
        justifyContent: "center", gap: "0px", overflow: "hidden", minWidth: "0"
      }
    },
      renderDigit(0), renderDigit(1), renderDigit(2),
      renderDigit(3), renderDigit(4), renderDigit(5),
      renderDigit(6), renderDigit(7), renderDigit(8),
      renderDigit(9), renderDigit(10)
    ),
    // Right slot (Save button)
    props.rightSlot ? React.createElement("div", {
      style: { flex: "0 0 auto", marginLeft: "2px" }
    }, props.rightSlot) : null
  );
}



function sensorMax(list, field) {
  if (!list || !list.length) return null;
  var best = null;
  for (var i = 0; i < list.length; i++) {
    var v = Number(list[i][field]);
    if (isFinite(v) && (best === null || v > best)) best = v;
  }
  return best;
}

function sensorFirst(list, field) {
  if (!list || !list.length) return null;
  for (var i = 0; i < list.length; i++) {
    var v = Number(list[i][field]);
    if (isFinite(v)) return v;
  }
  return null;
}

function sensorPct(value, maxValue) {
  value = Number(value);
  maxValue = Number(maxValue || 1);
  if (!isFinite(value) || !isFinite(maxValue) || maxValue <= 0) return 0;
  var p = value / maxValue;
  if (p < 0) return 0;
  if (p > 1) return 1;
  return p;
}

function SensorRings(props) {
  var sensors = props.sensors || {};

  var temp = sensorMax(sensors.temps, "value_c");
  var power = sensorFirst(sensors.powers, "value_w");
  var fan = sensorFirst(sensors.fans, "rpm");
  var voltage = sensorFirst(sensors.voltages, "value_v");

  var tempPct = sensorPct(temp || 0, 100);
  var powerPct = sensorPct(power || 0, 300);
  var fanPct = sensorPct(fan || 0, 3000);

  var tempText = temp === null ? "n/a" : String(Math.round(temp)) + "°C";
  var powerText = power === null ? "n/a" : String(Math.round(power)) + "W";
  var fanText = fan === null ? "n/a" : String(Math.round(fan)) + "rpm";
  var voltageText = voltage === null ? "n/a" : String(Number(voltage).toFixed(3)).replace(/\.000$/, "") + "V";

  var renderLabel = props.currentMode && props.currentMode.label ? props.currentMode.label : "n/a";
  var signalLabel = props.tvSignalMode && props.tvSignalMode.label ? props.tvSignalMode.label : "n/a";
  function cleanConnectorName(n) { return n ? n.replace(/^HDMI-A-/i, "HDMI ").replace(/^DP-/i, "DP ").replace(/^eDP-/i, "eDP ") : n; }
  var outputLabel = props.connector ? cleanConnectorName(props.connector.name) : "none";
  var patchLabel = props.patch && props.patch.has_prefer_vk_active ? "TV/eGPU active" : "Internal/default";

  function bg(r) {
    return React.createElement("circle", {
      cx: "64",
      cy: "64",
      r: String(r),
      fill: "none",
      stroke: "rgba(255,255,255,.12)",
      strokeWidth: "7"
    });
  }

  function ring(r, pct, opacity) {
    var c = 2 * Math.PI * r;
    return React.createElement("circle", {
      cx: "64",
      cy: "64",
      r: String(r),
      fill: "none",
      stroke: "rgba(255,255,255," + opacity + ")",
      strokeWidth: "7",
      strokeLinecap: "round",
      strokeDasharray: String(c),
      strokeDashoffset: String(c * (1 - pct)),
      transform: "rotate(-90 64 64)"
    });
  }

  function icon(x, y, text, opacity) {
    return React.createElement("text", {
      x: String(x),
      y: String(y),
      textAnchor: "middle",
      dominantBaseline: "middle",
      fill: "rgba(255,255,255," + opacity + ")",
      fontSize: "11",
      fontWeight: "900"
    }, text);
  }

  function row(label, value) {
    return [
      e("div", {
        key: label + "-label",
        style: {
          opacity: ".62",
          fontWeight: "900",
          whiteSpace: "nowrap"
        }
      }, label),
      e("div", {
        key: label + "-value",
        style: {
          fontWeight: "800",
          textAlign: "right",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }
      }, value)
    ];
  }

  return e(
    "div",
    {
      style: {
        width: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "10px",
        margin: "10px 0",
        padding: "9px 10px",
        borderRadius: "16px",
        background: "rgba(12,18,32,.92)",
        border: "1px solid rgba(180,210,255,.25)",
        boxShadow: "0 6px 18px rgba(0,0,0,.26), inset 0 1px 0 rgba(255,255,255,.04)"
      }
    },

    e("div", {
      style: {
        width: "100%",
        textAlign: "center",
        fontWeight: "900",
        fontSize: "12px",
        opacity: ".96",
        marginBottom: "-2px"
      }
    }, "Display / eGPU"),

    React.createElement(
      "svg",
      {
        width: "150",
        height: "150",
        viewBox: "0 0 128 128",
        style: { flex: "0 0 auto" }
      },
      bg(54),
      bg(41),
      bg(28),
      ring(54, tempPct, ".95"),
      ring(41, powerPct, ".68"),
      ring(28, fanPct, ".43"),

      icon(64, 10, "T", ".92"),
      icon(112, 66, "W", ".78"),
      icon(64, 118, "F", ".62"),

      React.createElement("text", {
        x: "64",
        y: "58",
        textAnchor: "middle",
        fill: "white",
        fontSize: "15",
        fontWeight: "900"
      }, voltageText),
      React.createElement("text", {
        x: "64",
        y: "76",
        textAnchor: "middle",
        fill: "rgba(255,255,255,.66)",
        fontSize: "10",
        fontWeight: "700"
      }, "VOLT")
    ),

    e(
      "div",
      {
        style: {
          width: "100%",
          boxSizing: "border-box",
          display: "grid",
          gridTemplateColumns: "auto minmax(0, 1fr)",
          columnGap: "10px",
          rowGap: "3px",
          alignItems: "baseline",
          fontSize: "10px",
          lineHeight: "14px",
          padding: "2px 2px 0 2px"
        }
      },
      row("Output", outputLabel),
      row("Render", renderLabel),
      row("Signal", signalLabel),
      row("Patch", patchLabel),
      row("Temp", tempText),
      row("Power", powerText),
      row("Fan", fanText)
    )
  );
}


function GamepadButton(props) {
  var disabled = !!props.disabled;

  if (ButtonItem) {
    return React.createElement(
      ButtonItem,
      {
        layout: "below",
        bottomSeparator: "none",
        disabled: disabled,
        focusable: !disabled,
        onClick: props.onClick,
        onOKButton: props.onClick,
        onActivate: props.onClick
      },
      props.children
    );
  }

  if (Focusable && DialogButton) {
    return React.createElement(
      Focusable,
      {
        style: { width: "100%", boxSizing: "border-box" },
        focusable: !disabled,
        onActivate: disabled ? undefined : props.onClick,
        onOKButton: disabled ? undefined : props.onClick,
        onClick: disabled ? undefined : props.onClick
      },
      React.createElement(
        DialogButton,
        {
          disabled: disabled,
          focusable: !disabled,
          onClick: props.onClick,
          onOKButton: props.onClick,
          style: {
            width: "100%",
            minHeight: "42px",
            fontWeight: "800"
          }
        },
        props.children
      )
    );
  }

  return e(
    "button",
    {
      disabled: disabled,
      tabIndex: 0,
      onClick: props.onClick,
      onKeyDown: function(ev) {
        if (!disabled && (ev.key === "Enter" || ev.key === " ")) {
          ev.preventDefault();
          props.onClick();
        }
      },
      style: {
        width: "100%",
        minHeight: "42px",
        margin: "5px 0",
        padding: "10px",
        borderRadius: "10px",
        border: "1px solid rgba(180,210,255,.25)",
        background: props.danger ? "rgba(120,35,55,.88)" : "rgba(12,18,32,.92)",
        color: "rgba(245,248,255,.96)",
        fontSize: "14px",
        fontWeight: "800"
      }
    },
    props.children
  );
}




function modeKey(m) {
  return String(m.width) + "x" + String(m.height) + "@" + String(m.refresh || 60);
}

function normalizeTvModes(status, connector) {
  var raw = status && status.tv_modes && status.tv_modes.length ? status.tv_modes : [];
  var modes = [];
  var seen = {};

  function addMode(w, h, hz) {
    w = Number(w);
    h = Number(h);
    hz = Number(hz || 60);
    if (!isFinite(w) || !isFinite(h) || !isFinite(hz)) return;
    if (w < 1280 || h < 720) return;

    var key = String(w) + "x" + String(h) + "@" + String(hz);
    if (seen[key]) return;
    seen[key] = true;

    modes.push({
      width: w,
      height: h,
      refresh: hz,
      label: String(w) + "x" + String(h) + " @ " + String(hz) + "Hz"
    });
  }

  for (var i = 0; i < raw.length; i++) {
    addMode(raw[i].width, raw[i].height, raw[i].refresh || 60);
  }

  if (!modes.length && connector && connector.modes && connector.modes.length) {
    for (var j = 0; j < connector.modes.length; j++) {
      var s = String(connector.modes[j] || "");
      var m = s.match(/(\\d+)x(\\d+)/);
      if (m) addMode(Number(m[1]), Number(m[2]), 60);
    }
  }

  if (!modes.length) {
    addMode(3840, 2160, 60);
    addMode(2560, 1440, 60);
    addMode(1920, 1080, 60);
  }

  function rank(x) {
    var k = modeKey(x);
    if (k === "3840x2160@60") return 0;
    if (k === "2560x1440@120") return 1;
    if (k === "2560x1440@60") return 2;
    if (k === "1920x1080@120") return 3;
    if (k === "1920x1080@60") return 4;
    if (k === "1280x720@120") return 5;
    if (k === "1280x720@60") return 6;
    return 100000000 - (x.width * x.height);
  }

  modes.sort(function(a, b) {
    return rank(a) - rank(b);
  });

  return modes;
}


function renderModeHint(m) {
  if (!m) return "";
  var k = modeKey(m);
  if (k === "3840x2160@60") return "Best quality";
  if (k === "2560x1440@120") return "Smooth 2K";
  if (k === "2560x1440@60") return "Balanced render";
  if (k === "1920x1080@120") return "Smooth performance";
  if (k === "1920x1080@60") return "Performance";
  if (k === "1280x720@120") return "Low load 120Hz";
  if (k === "1280x720@60") return "Battery / low load";
  return "Custom render";
}


function renderModeBaseLabel(m) {
  if (!m) return "Select resolution";
  return m.label || (String(m.width) + "x" + String(m.height) + " @ " + String(m.refresh || 60) + "Hz");
}


function renderModeShortLabel(m) {
  if (!m) return "4K60";

  if (typeof m === "string") {
    var s = String(m || "");
    var mat = s.match(/([0-9]{3,4})x([0-9]{3,4}).*?([0-9]{2,3})\s*Hz/i);
    if (mat) {
      return renderModeShortLabel({
        width: parseInt(mat[1], 10),
        height: parseInt(mat[2], 10),
        refresh: parseInt(mat[3], 10)
      });
    }
    return s;
  }

  var w = parseInt(m.width || 0, 10);
  var h = parseInt(m.height || 0, 10);
  var r = parseInt(m.refresh || 0, 10);
  var rr = r ? String(r) : "";

  if (w >= 3800 || h >= 2100) return "4K" + rr;
  if ((w >= 2500 && h >= 1300) || h === 1440) return "2K" + rr;
  if (h === 1200) return "1200p" + rr;
  if ((w >= 1900 && h >= 1000) || h === 1080) return "1080p" + rr;
  if ((w >= 1200 && h >= 700) || h === 720) return "720p" + rr;

  if (w && h) return String(w) + "x" + String(h) + (r ? "@" + String(r) : "");
  return m.label || "mode";
}


function renderModeLabel(m) {
  if (!m) return "Select resolution";
  var base = m.label || (String(m.width) + "x" + String(m.height) + " @ " + String(m.refresh || 60) + "Hz");
  return base + " — " + renderModeHint(m);
}


function MenuRow(props) {
  var disabled = !!props.disabled;
  var focusState = React.useState(false);
  var focused = focusState[0];
  var setFocused = focusState[1];

  var row = e("div", {
      style: {
        width: "100%",
        boxSizing: "border-box",
        minHeight: props.compact ? "34px" : "42px",
        padding: props.indent ? "5px 2px 5px 18px" : "6px 2px",
        background: focused ? "rgba(120,145,190,.16)" : "transparent",
        borderBottom: focused ? "1px solid rgba(160,190,245,.55)" : "1px solid rgba(180,210,255,.16)",
        opacity: disabled ? ".45" : "1"
      }
    },
    e("div", {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          width: "100%"
        }
      },
      e("div", {
          style: {
            textAlign: "left",
            lineHeight: props.compact ? "14px" : "15px",
            minWidth: "0",
            overflow: "hidden"
          }
        },
        e("div", {
          style: {
            fontWeight: "900",
            fontSize: props.compact ? "11px" : "12px",
            whiteSpace: "normal"
          }
        }, props.title || ""),
        props.description ? e("div", {
          style: {
            opacity: ".76",
            fontSize: "10px",
            fontWeight: "700",
            lineHeight: "13px",
            marginTop: "1px"
          }
        }, props.description) : null
      ),
      e("div", {
          style: {
            minWidth: "28px",
            textAlign: "right",
            color: props.ok ? "rgb(120,255,170)" : "rgba(230,240,255,.82)",
            fontSize: "15px",
            fontWeight: "900",
            flex: "0 0 auto"
          }
        },
        props.rightText || ""
      )
    )
  );

  if (Focusable) {
    return React.createElement(
      Focusable,
      {
        style: { width: "100%", boxSizing: "border-box" },
        onFocus: function() { setFocused(true); },
        onBlur: function() { setFocused(false); },
        focusable: !disabled,
        onClick: disabled ? undefined : props.onClick,
        onActivate: disabled ? undefined : props.onClick,
        onOKButton: disabled ? undefined : props.onClick
      },
      row
    );
  }

  return e("button", {
      disabled: disabled,
      tabIndex: 0,
      onClick: props.onClick,
      onFocus: function() { setFocused(true); },
      onBlur: function() { setFocused(false); },
      style: {
        width: "100%",
        boxSizing: "border-box",
        padding: 0,
        margin: "0",
        border: "0",
        background: "transparent",
        color: "rgba(245,248,255,.96)"
      }
    },
    row
  );
}



function SteamSwitchVisual(props) {
  var enabled = !!props.enabled;
  return e("div", {
      style: {
        width: "42px",
        height: "17px",
        borderRadius: "999px",
        border: "1px solid rgba(180,205,245,.34)",
        background: enabled ? "rgba(44,145,245,.95)" : "rgba(95,112,140,.46)",
        position: "relative",
        flex: "0 0 auto",
        boxShadow: enabled ? "inset 0 0 0 1px rgba(255,255,255,.12)" : "none"
      }
    },
    e("div", {
      style: {
        position: "absolute",
        top: "2px",
        left: enabled ? "20px" : "2px",
        width: "16px",
        height: "16px",
        borderRadius: "999px",
        background: "rgba(245,248,255,.96)",
        boxShadow: "0 1px 3px rgba(0,0,0,.38)"
      }
    })
  );
}

function FocusAction(props) {
  var disabled = !!props.disabled;
  var focusState = React.useState(false);
  var focused = focusState[0];
  var setFocused = focusState[1];

  var child = typeof props.children === "function" ? props.children(focused) : props.children;

  if (Focusable) {
    return React.createElement(
      Focusable,
      {
        style: { width: "100%", boxSizing: "border-box" },
        focusable: !disabled,
        onFocus: function() { setFocused(true); },
        onBlur: function() { setFocused(false); },
        onClick: disabled ? undefined : props.onClick,
        onActivate: disabled ? undefined : props.onClick,
        onOKButton: disabled ? undefined : props.onClick
      },
      child
    );
  }

  return e("button", {
      disabled: disabled,
      tabIndex: 0,
      onClick: props.onClick,
      onFocus: function() { setFocused(true); },
      onBlur: function() { setFocused(false); },
      style: {
        width: "100%",
        boxSizing: "border-box",
        padding: 0,
        margin: 0,
        border: 0,
        background: "transparent",
        color: "white",
        textAlign: "left"
      }
    },
    child
  );
}

function DisplayCardRow(props) {
  var lines = props.lines || [];

  return React.createElement(
    FocusAction,
    {
      disabled: props.disabled,
      onClick: props.onClick
    },
    function(focused) {
      return e("div", {
          style: {
            width: "100%",
            marginLeft: "0",
            marginRight: "0",
            boxSizing: "border-box",
            minHeight: "82px",
            padding: "12px 12px",
            borderRadius: "10px",
            background: focused ? "rgba(120,145,190,.15)" : "rgba(14,24,38,.58)",
            border: focused ? "1px solid rgba(160,190,245,.50)" : "1px solid rgba(130,160,205,.25)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.035)"
          }
        },
        e("div", {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px"
            }
          },
          e("div", { style: { minWidth: 0, lineHeight: "18px" } },
            e("div", {
              style: {
                fontSize: "14px",
                fontWeight: "900",
                color: "rgba(245,248,255,.96)",
                marginBottom: "4px"
              }
            }, props.title || ""),
            lines.map(function(line, idx) {
              return e("div", {
                key: idx,
                style: {
                  fontSize: "11px",
                  fontWeight: "700",
                  lineHeight: "15px",
                  color: "rgba(200,215,235,.72)"
                }
              }, line);
            })
          ),
          SteamSwitchVisual({ enabled: props.enabled })
        )
      );
    }
  );
}

function SelectFieldRow(props) {
  return React.createElement(
    FocusAction,
    {
      disabled: props.disabled,
      onClick: props.onClick
    },
    function(focused) {
      return e("div", {
          style: {
            width: "100%",
            boxSizing: "border-box",
            minHeight: "40px",
            padding: "9px 12px",
            borderRadius: "5px",
            background: focused ? "rgba(128,154,205,.26)" : "rgba(100,122,160,.24)",
            border: focused ? "1px solid rgba(170,200,255,.55)" : "1px solid rgba(160,185,225,.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            boxShadow: focused ? "inset 0 1px 0 rgba(255,255,255,.08)" : "none"
          }
        },
        e("span", {
          style: {
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: "12px",
            fontWeight: "800",
            color: "rgba(235,242,255,.88)"
          }
        }, props.title || ""),
        e("span", {
          style: {
            width: "0",
            height: "0",
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderTop: props.open ? "0" : "7px solid rgba(235,242,255,.82)",
            borderBottom: props.open ? "7px solid rgba(235,242,255,.82)" : "0",
            flex: "0 0 auto"
          }
        })
      );
    }
  );
}

function ResolutionOptionRow(props) {
  return React.createElement(
    FocusAction,
    {
      disabled: props.disabled,
      onClick: props.onClick
    },
    function(focused) {
      return e("div", {
          style: {
            width: "100%",
            boxSizing: "border-box",
            minHeight: "34px",
            padding: "6px 10px",
            borderRadius: "5px",
            background: focused ? "rgba(120,145,190,.18)" : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px"
          }
        },
        e("div", { style: { minWidth: 0 } },
          e("div", {
            style: {
              fontSize: "11px",
              fontWeight: "900",
              lineHeight: "14px",
              color: "rgba(245,248,255,.92)"
            }
          }, props.title || ""),
          props.description ? e("div", {
            style: {
              fontSize: "10px",
              fontWeight: "700",
              lineHeight: "13px",
              color: "rgba(200,215,235,.64)"
            }
          }, props.description) : null
        ),
        e("div", {
          style: {
            minWidth: "17px",
            textAlign: "right",
            color: props.ok ? "rgb(120,255,170)" : "rgba(235,242,255,.70)",
            fontSize: "13px",
            fontWeight: "900"
          }
        }, props.ok ? "✓" : "")
      );
    }
  );
}

function ExternalDisplayCard(props) {
  var modes = props.modes || [];

  return e("div", {
      style: {
        width: "100%",
        marginLeft: "0",
        marginRight: "0",
        boxSizing: "border-box",
        padding: "12px 12px",
        borderRadius: "10px",
        background: "rgba(14,24,38,.58)",
        border: "1px solid rgba(130,160,205,.25)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.035)"
      }
    },
    React.createElement(
      FocusAction,
      {
        disabled: props.disabled,
        onClick: props.onToggle
      },
      function(focused) {
        return e("div", {
            style: {
              margin: "0 0 8px 0",
              padding: "4px",
              borderRadius: "8px",
              background: focused ? "rgba(120,145,190,.15)" : "transparent"
            }
          },
          e("div", {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px"
              }
            },
            e("div", { style: { minWidth: 0, lineHeight: "18px" } },
              e("div", {
                style: {
                  fontSize: "14px",
                  fontWeight: "900",
                  color: "rgba(245,248,255,.96)",
                  marginBottom: "4px"
                }
              }, props.title || ""),
              e("div", {
                style: {
                  fontSize: "11px",
                  fontWeight: "700",
                  lineHeight: "15px",
                  color: "rgba(200,215,235,.72)"
                }
              }, props.connector || ""),
              e("div", {
                style: {
                  fontSize: "11px",
                  fontWeight: "700",
                  lineHeight: "15px",
                  color: "rgba(200,215,235,.72)"
                }
              }, props.signal || "")
            ),
            SteamSwitchVisual({ enabled: props.enabled })
          )
        );
      }
    ),

    SelectFieldRow({
      disabled: props.disabled,
      open: props.open,
      title: props.selectedTitle || "Choose render size",
      onClick: props.onSelect
    }),

    props.open ? e("div", {
        style: {
          marginTop: "4px",
          paddingTop: "4px",
          borderTop: "1px solid rgba(180,210,255,.12)"
        }
      },
      modes.map(function(m) {
        return ResolutionOptionRow({
          key: modeKey(m),
          disabled: props.busy,
          title: renderModeShortLabel(m),
          description: renderModeHint(m),
          ok: modeKey(m) === props.currentKey,
          onClick: function() {
            props.onPick(m);
          }
        });
      })
    ) : null
  );
}


function ToggleRow(props) {
  var enabled = !!props.enabled;
  var disabled = !!props.disabled;
  var focusState = React.useState(false);
  var focused = focusState[0];
  var setFocused = focusState[1];

  var card = e("div", {
      style: {
        width: "100%",
        boxSizing: "border-box",
        minHeight: "42px",
        padding: "6px 2px",
        borderRadius: "8px",
        background: focused ? "rgba(120,145,190,.16)" : "transparent",
        border: "0",
        borderBottom: focused ? "1px solid rgba(130,180,255,.65)" : "1px solid rgba(180,210,255,.22)",
        boxShadow: "none",
        opacity: disabled ? ".55" : "1"
      }
    },
    e("div", {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          width: "100%"
        }
      },
      e("div", {
          style: {
            textAlign: "left",
            lineHeight: "14px",
            minWidth: "0",
            overflow: "hidden"
          }
        },
        e("div", {
          style: {
            fontWeight: "900",
            fontSize: "12px",
            whiteSpace: "normal"
          }
        }, props.title || ""),
        props.description ? e("div", {
          style: {
            opacity: ".76",
            fontSize: "10px",
            fontWeight: "700",
            lineHeight: "14px",
            marginTop: "1px"
          }
        }, props.description) : null
      ),
      e("div", {
          style: {
            width: "38px",
            height: "17px",
            borderRadius: "999px",
            border: "1px solid rgba(180,205,245,.32)",
            background: enabled ? "rgba(105,130,185,.82)" : "rgba(130,145,175,.28)",
            position: "relative",
            flex: "0 0 auto",
            boxShadow: enabled ? "inset 0 0 0 1px rgba(255,255,255,.08)" : "none"
          }
        },
        e("div", {
          style: {
            position: "absolute",
            top: "2px",
            left: enabled ? "20px" : "2px",
            width: "16px",
            height: "16px",
            borderRadius: "999px",
            background: "rgba(255,255,255,.95)",
            boxShadow: "0 1px 3px rgba(0,0,0,.35)"
          }
        })
      )
    )
  );

  if (Focusable) {
    return React.createElement(
      Focusable,
      {
        style: { width: "100%", boxSizing: "border-box" },
        onFocus: function() { setFocused(true); },
        onBlur: function() { setFocused(false); },
        focusable: !disabled,
        onClick: disabled ? undefined : props.onClick,
        onActivate: disabled ? undefined : props.onClick,
        onOKButton: disabled ? undefined : props.onClick
      },
      card
    );
  }

  return e("button", {
      disabled: disabled,
      tabIndex: 0,
      onClick: props.onClick,
      onFocus: function() { setFocused(true); },
      onBlur: function() { setFocused(false); },
      style: {
        width: "100%",
        boxSizing: "border-box",
        padding: 0,
        margin: "0",
        border: "0",
        background: focused ? "rgba(120,145,190,.16)" : "transparent",
        color: "rgba(245,248,255,.96)"
      }
    },
    card
  );
}


function App(props) {
  var serverApi = getServerApi(props.serverApi || props.serverAPI || props);
  var statusState = React.useState(null);
  var status = statusState[0];
  var setStatus = statusState[1];

  var busyState = React.useState(false);
  var busy = busyState[0];
  var setBusy = busyState[1];

  var lastState = React.useState(null);
  var last = lastState[0];
  var setLast = lastState[1];

  var debugState = React.useState(false);
  var showDebug = debugState[0];
  var setShowDebug = debugState[1];

  var eventLogState = React.useState(null);
  var eventLog = eventLogState[0];
  var setEventLog = eventLogState[1];


  var selectedModeState = React.useState({ width: 3840, height: 2160, refresh: 60, label: "3840x2160 @ 60Hz" });
  var selectedMode = selectedModeState[0];
  var setSelectedMode = selectedModeState[1];

  var modeListState = React.useState(false);
  var showModeList = modeListState[0];
  var setShowModeList = modeListState[1];

  // Expose toggle for title bar button
  React.useEffect(function() {
    window.__egpuToggleTvMode = function() {
      setShowModeList(function(prev) { return !prev; });
    };
    return function() { delete window.__egpuToggleTvMode; };
  }, []);

  var tvControlState = React.useState(false);
  var showTvControl = tvControlState[0];
  var setShowTvControl = tvControlState[1];
  // UI_SKETCH_ACCORDION_DASHBOARD_91007R4
  var egpuAccordionState = React.useState(false);
  var showEgpuAccordion = egpuAccordionState[0];
  var setShowEgpuAccordion = egpuAccordionState[1];
  var egpuTimerRef = React.useRef(null);
  var tuningLocalRef = React.useRef(false); // true when user manually adjusted sliders
  var showPerfDropdownState = React.useState(false);
  var showPerfDropdown = showPerfDropdownState[0];
  var setShowPerfDropdown = showPerfDropdownState[1];
  var showProfileDropdownState = React.useState(false);
  var showProfileDropdown = showProfileDropdownState[0];
  var setShowProfileDropdown = showProfileDropdownState[1];
  var showManualWarningState = React.useState(false);
  var showManualWarning = showManualWarningState[0];
  var setShowManualWarning = showManualWarningState[1];
  var showCustomWarningState = React.useState(false);
  var showCustomWarning = showCustomWarningState[0];
  var setShowCustomWarning = showCustomWarningState[1];
  var customActivatedState = React.useState(false);
  var customActivated = customActivatedState[0];
  var setCustomActivated = customActivatedState[1];
  var odClocksState = React.useState(null);
  var odClocks = odClocksState[0];
  var setOdClocks = odClocksState[1];
  var odSclkState = React.useState(null);
  var odSclk = odSclkState[0];
  var setOdSclk = odSclkState[1];
  var odMclkState = React.useState(null);
  var odMclk = odMclkState[0];
  var setOdMclk = odMclkState[1];
  var odVddgfxState = React.useState(null);
  var odVddgfx = odVddgfxState[0];
  var setOdVddgfx = odVddgfxState[1];
  var tvAccordionState = React.useState(false);
  var showTvAccordion = tvAccordionState[0];
  var setShowTvAccordion = tvAccordionState[1];
  // UI_OTHER_ACCORDION_RECOVERY_DIAG_91007R5
  var otherAccordionState = React.useState(false);
  var showOtherAccordion = otherAccordionState[0];
  var setShowOtherAccordion = otherAccordionState[1];

    // UI_REGROUP_VARIANT_B_81303_R3
    var hotkeyEnabledState = React.useState(false);
    var hotkeysEnabled = hotkeyEnabledState[0];
    var setHotkeysEnabled = hotkeyEnabledState[1];

    var tvAutoEnabledState = React.useState(false);
    var tvAutoEnabled = tvAutoEnabledState[0];
    var setTvAutoEnabled = tvAutoEnabledState[1];

    var dockStatusState = React.useState(null);
    var dockStatus = dockStatusState[0];
    var setDockStatus = dockStatusState[1];

    // ADB state
    var adbStatusState = React.useState(null);
    var adbStatus = adbStatusState[0];
    var setAdbStatus = adbStatusState[1];
    var adbInstallingState = React.useState(false);
    var adbInstalling = adbInstallingState[0];
    var setAdbInstalling = adbInstallingState[1];

    // TV IP state
    var tvIpState = React.useState("");
    var tvIp = tvIpState[0];
    var setTvIp = tvIpState[1];
    var tvIpInputState = React.useState("");
    var tvIpInput = tvIpInputState[0];
    var setTvIpInput = tvIpInputState[1];
    var tvCheckResultState = React.useState(null);
    var tvCheckResult = tvCheckResultState[0];
    var setTvCheckResult = tvCheckResultState[1];

    // Diagnostics state
    var diagState = React.useState(null);
    var diagnostics = diagState[0];
    var setDiagnostics = diagState[1];
    var diagLoadingState = React.useState(false);
    var diagLoading = diagLoadingState[0];
    var setDiagLoading = diagLoadingState[1];

    var tvHealthState = React.useState(null);
    var tvHealth = tvHealthState[0];
    var setTvHealth = tvHealthState[1];

    // TV_POWER_LIGHT_91007
    var tvPowerLightState = React.useState(null);
    var tvPowerLight = tvPowerLightState[0];
    var setTvPowerLight = tvPowerLightState[1];

    // GPU_WAGON_STATE_9020302 — UNUSED visually, kept for: GPU card detection (eGPU/iGPU), connectors (HDMI/DP), load%, throttle status
    var gpuWagonState = React.useState(null);
    var gpuWagon = gpuWagonState[0];
    var setGpuWagon = gpuWagonState[1];

    var gpuWagonLoadingState = React.useState(false);
    var gpuWagonLoading = gpuWagonLoadingState[0];
    var setGpuWagonLoading = gpuWagonLoadingState[1];

    var gpuWagonUpdatedState = React.useState(null);
    var gpuWagonUpdated = gpuWagonUpdatedState[0];
    var setGpuWagonUpdated = gpuWagonUpdatedState[1];


    // GPU_TUNING_STATE
    var gpuTuningState = React.useState(null);
    var gpuTuning = gpuTuningState[0];
    var setGpuTuning = gpuTuningState[1];

    var gpuTuningLoadingState = React.useState(false);
    var gpuTuningLoading = gpuTuningLoadingState[0];
    var setGpuTuningLoading = gpuTuningLoadingState[1];

    // Fan local state (for slider responsiveness)
    var fanPwmLocalState = React.useState(null);
    var fanPwmLocal = fanPwmLocalState[0];
    var setFanPwmLocal = fanPwmLocalState[1];

    // Power cap local state
    var powerCapLocalState = React.useState(null);
    var powerCapLocal = powerCapLocalState[0];
    var setPowerCapLocal = powerCapLocalState[1];


    function readBoolFromResult(res, key) {
      if (!res) return null;
      if (typeof res[key] === "boolean") return res[key];
      if (res.settings && typeof res.settings[key] === "boolean") return res.settings[key];
      if (res.data && typeof res.data[key] === "boolean") return res.data[key];
      return null;
    }

    function absorbUiResult(method, res) {
      var v;
      if (method === "dock_status") setDockStatus(res);
      if (method === "tv_control_health") setTvHealth(res);

      if (method === "get_hotkey_settings" || method === "set_hotkey_settings") {
        v = readBoolFromResult(res, "hotkeys_enabled");
        if (v !== null) setHotkeysEnabled(v);
      }

      if (method === "get_tv_automation_settings" || method === "set_tv_automation_settings") {
        v = readBoolFromResult(res, "tv_control_automation_enabled");
        if (v !== null) setTvAutoEnabled(v);
      }
    }

    function loadUiSideStatus(silent) {
      call(serverApi, "dock_status", {}).then(function(res) {
        setDockStatus(res);
      }).catch(function(err) {
        if (!silent) setLast({ ok: false, source: "dock_status", error: String(err) });
      });

      call(serverApi, "get_hotkey_settings", {}).then(function(res) {
        absorbUiResult("get_hotkey_settings", res);
      }).catch(function(err) {
        if (!silent) setLast({ ok: false, source: "get_hotkey_settings", error: String(err) });
      });

      call(serverApi, "get_tv_automation_settings", {}).then(function(res) {
        absorbUiResult("get_tv_automation_settings", res);
      }).catch(function(err) {
        if (!silent) setLast({ ok: false, source: "get_tv_automation_settings", error: String(err) });
      });
    }


  function refresh(silent) {
    if (!silent) setBusy(true);
    call(serverApi, "status", {}).then(function(res) {
      setStatus(res);
      if (!silent) setLast(res);
    }).catch(function(err) {
      if (!silent) setLast({ ok: false, error: String(err) });
    }).finally(function() {
      if (!silent) setBusy(false);
    });
  }

  function doCall(method, args) {
    setBusy(true);
    call(serverApi, method, args || {}).then(function(res) {
      setLast(res);
        absorbUiResult(method, res);
      return call(serverApi, "status", {});
    }).then(function(st) {
      if (st) setStatus(st);
    }).catch(function(err) {
      setLast({ ok: false, error: String(err) });
    }).finally(function() {
      setBusy(false);
    });
  }



    // GPU_TUNING_LOAD
    function loadGpuTuning(force) {
      setGpuTuningLoading(true);
      call(serverApi, "gpu_tuning_wagon", {}).then(function(res) {
        setGpuTuning(res);
        if (res && res.ok) {
          if (force || !tuningLocalRef.current) {
            setFanPwmLocal(res.fan_pwm);
            setPowerCapLocal(res.power_cap_w);
          }
        }
      }).catch(function(err) {
        setGpuTuning({ ok: false, error: String(err) });
      }).finally(function() {
        setGpuTuningLoading(false);
      });
    }

    // GPU_TUNING_SETTERS
    function gpuSetPowerCap(watts) {
      setBusy(true);
      call(serverApi, "gpu_set_power_cap", { watts: watts }).then(function(res) {
        setLast(res);
        return call(serverApi, "gpu_tuning_wagon", {});
      }).then(function(tuningReport) {
        setGpuTuning(tuningReport);
        if (tuningReport && tuningReport.ok) setPowerCapLocal(tuningReport.power_cap_w);
      }).catch(function(err) {
        setLast({ ok: false, error: String(err) });
      }).finally(function() { setBusy(false); });
    }

    function gpuSetFanControl(mode, pwm) {
      setBusy(true);
      call(serverApi, "gpu_set_fan_control", { mode: mode, pwm: pwm }).then(function(res) {
        setLast(res);
        if (mode === "auto") {
          setFanPwmLocal(null);
        } else {
          setFanPwmLocal(pwm); // keep user's chosen value
        }
        // Refresh tuning but override fan_pwm with user's value
        return call(serverApi, "gpu_tuning_wagon", {});
      }).then(function(tuningReport) {
        if (tuningReport && tuningReport.ok) {
          if (mode !== "auto") tuningReport.fan_pwm = pwm;
          setGpuTuning(tuningReport);
        }
      }).catch(function(err) {
        setLast({ ok: false, error: String(err) });
      }).finally(function() { setBusy(false); });
    }

    function gpuSetPerfLevel(level) {
      setBusy(true);
      return call(serverApi, "gpu_set_perf_level", { level: level }).then(function(res) {
        setLast(res);
        return call(serverApi, "gpu_tuning_wagon", {});
      }).then(function(tuningReport) {
        setGpuTuning(tuningReport);
      }).catch(function(err) {
        setLast({ ok: false, error: String(err) });
      }).finally(function() { setBusy(false); });
    }

    function gpuSetPowerProfile(index) {
      setBusy(true);
      return call(serverApi, "gpu_set_power_profile", { index: index }).then(function(res) {
        setLast(res);
        return call(serverApi, "gpu_tuning_wagon", {});
      }).then(function(tuningReport) {
        setGpuTuning(tuningReport);
      }).catch(function(err) {
        setLast({ ok: false, error: String(err) });
      }).finally(function() { setBusy(false); });
    }

    function loadOdClocks() {
      call(serverApi, "gpu_get_od_clocks", {}).then(function(res) {
        if (res && res.ok) {
          setOdClocks(res);
          if (res.sclk && res.sclk.length > 1) setOdSclk(res.sclk[1].mhz);
          if (res.mclk && res.mclk.length > 1) setOdMclk(res.mclk[1].mhz);
          if (res.vddgfx && res.vddgfx.length > 1) setOdVddgfx(res.vddgfx[1].mv);
        }
      }).catch(function() {});
    }

    function gpuSetOdClocks(commit) {
      setBusy(true);
      var params = { commit: !!commit };
      if (odSclk !== null) params.sclk_mhz = odSclk;
      if (odMclk !== null) params.mclk_mhz = odMclk;
      if (odVddgfx !== null) params.vddgfx_mv = odVddgfx;
      return call(serverApi, "gpu_set_od_clocks", params).then(function(res) {
        setLast(res);
        return call(serverApi, "gpu_tuning_wagon", {});
      }).then(function(tuningReport) {
        setGpuTuning(tuningReport);
        loadOdClocks();
      }).catch(function(err) {
        setLast({ ok: false, error: String(err) });
      }).finally(function() { setBusy(false); });
    }

    // UNUSED visually — data provides: card.kind (eGPU/iGPU), hwmon (temp/power), connectors, gpu_busy_percent, throttle detection
    function loadGpuWagon9020302() {
      setGpuWagonLoading(true);
      call(serverApi, "amd_sysfs_wagon", {}).then(function(res) {
        setGpuWagon(res);
        setGpuWagonUpdated(Date.now());
        setLast({
          ok: !!(res && res.ok),
          source: "gpu-wagon-ui",
          message: res && res.label ? res.label : "AMD GPU wagon updated"
        });
      }).catch(function(err) {
        var fail = { ok: false, source: "gpu-wagon-ui", error: String(err) };
        setGpuWagon(fail);
        setLast(fail);
      }).finally(function() {
        setGpuWagonLoading(false);
      });
    }

    function loadRecentEvents() {
      setBusy(true);
      call(serverApi, "recent_events", { minutes: 10 }).then(function(res) {
        setEventLog(res);
        setLast(res);
      }).catch(function(err) {
        var fail = { ok: false, error: String(err) };
        setEventLog(fail);
        setLast(fail);
      }).finally(function() {
        setBusy(false);
      });
    }

  React.useEffect(function() {
    refresh(false);
      loadUiSideStatus(true);

    var timer = setInterval(function() {
      refresh(true);
    }, 5000);

    return function() {
      clearInterval(timer);
    };
  }, []);

  // Load ADB status and TV IP on mount
  React.useEffect(function() {
    call(serverApi, "adb_status", {}).then(function(res) { setAdbStatus(res); }).catch(function() {});
    call(serverApi, "get_tv_ip", {}).then(function(res) {
      if (res && res.tv_ip) { setTvIp(res.tv_ip); setTvIpInput(res.tv_ip); }
    }).catch(function() {});
  }, []);

  // TV_POWER_LIGHT_91007: check TV power state once on mount when ADB is available
  React.useEffect(function() {
    if (!adbStatus || !adbStatus.installed) return;
    call(serverApi, "tv_power_light", {}).then(function(res) { setTvPowerLight(res); }).catch(function() {});
  }, [adbStatus && adbStatus.installed]);

  // EGPU_CENTER_V2_AUTO_REFRESH — gpuWagon calls UNUSED (Section 2 removed), kept for future eGPU/iGPU detection
  // Auto-load GPU tuning on mount
  React.useEffect(function() {
    loadGpuTuning();
  }, []);

  React.useEffect(function() {
    if (gpuTuning && (gpuTuning.perf_level === "manual" || gpuTuning.active_profile === "CUSTOM") && !odClocks) {
      loadOdClocks();
    }
  }, [gpuTuning && gpuTuning.perf_level, gpuTuning && gpuTuning.active_profile]);

  React.useEffect(function() {
    if (showEgpuAccordion) {
      // Load immediately on expand
      // loadGpuWagon9020302(); // DISABLED — no visual consumer
      loadGpuTuning();

      // Then refresh every 3 seconds
      // egpuTimerRef.current = setInterval(function() {
      //   loadGpuWagon9020302(); // DISABLED — no visual consumer
      // }, 3000);
    } else {
      // Stop timer when collapsed
      if (egpuTimerRef.current) {
        clearInterval(egpuTimerRef.current);
        egpuTimerRef.current = null;
      }
    }

    // Cleanup on unmount
    return function() {
      if (egpuTimerRef.current) {
        clearInterval(egpuTimerRef.current);
        egpuTimerRef.current = null;
      }
    };
  }, [showEgpuAccordion]);

  var patch = status && status.patch_state ? status.patch_state : {};
  var gamescope = status && status.gamescope ? status.gamescope : "";
  var egpu = status && status.egpu ? status.egpu : null;
  function parseGtLink(value) {
    var m = String(value || "").match(/([0-9]+(?:\.[0-9]+)?)\s*GT\/s/i);
    return m ? parseFloat(m[1]) : 0;
  }

  function linkColorFromSpeed(value) {
    var gt = parseGtLink(value);
    if (gt >= 32) return "rgb(90,245,255)";
    if (gt >= 16) return "rgb(120,255,170)";
    if (gt >= 8) return "rgb(255,210,90)";
    return "rgb(255,150,120)";
  }

  function connectorIconNode(value) {
    var color = linkColorFromSpeed(value);
    return e("svg", {
      width: "15px",
      height: "15px",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: color,
      strokeWidth: "1.8",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        display: "block",
        flex: "0 0 auto",
        filter: "drop-shadow(0 0 4px rgba(255,255,255,.08))"
      }
    },
      e("path", { d: "M3 12H8" }),
      e("rect", { x: "8", y: "8", width: "8", height: "8", rx: "2" }),
      e("path", { d: "M16 12H21" }),
      e("path", { d: "M10.5 10.5H13.5" }),
      e("path", { d: "M10.5 13.5H13.5" })
    );
  }

  function laneIconNode() {
    return e("svg", {
      width: "15px",
      height: "15px",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "rgba(235,242,255,.92)",
      strokeWidth: "1.8",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        display: "block",
        flex: "0 0 auto",
        filter: "drop-shadow(0 0 4px rgba(255,255,255,.05))"
      }
    },
      e("path", { d: "M8 4L6.2 20" }),
      e("path", { d: "M16 4L17.8 20" }),
      e("path", { d: "M12 5.5V8" }),
      e("path", { d: "M12 10.5V13" }),
      e("path", { d: "M12 15.5V18" })
    );
  }

  function speedIconNode(value) {
    var gt = parseGtLink(value);
    var color = linkColorFromSpeed(value);
    return e("svg", {
      width: "15px",
      height: "15px",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: color,
      strokeWidth: "1.8",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        display: "block",
        flex: "0 0 auto",
        filter: "drop-shadow(0 0 4px rgba(255,255,255,.08))"
      }
    },
      gt >= 8 ? e("path", { d: "M6 16L10 12L6 8" }) : null,
      gt >= 16 ? e("path", { d: "M10 16L14 12L10 8" }) : null,
      gt >= 32 ? e("path", { d: "M14 16L18 12L14 8" }) : null,
      gt < 8 ? e("path", { d: "M7 12H17" }) : null
    );
  }

  function detailIconNode(label, good, hasValue) {
    var color = good === false ? "rgb(255,140,140)" : "rgb(120,255,170)";
    var common = {
      width: "14px",
      height: "14px",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: color,
      strokeWidth: "1.8",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: {
        display: "block",
        opacity: hasValue ? "1" : ".55",
        filter: good === false
          ? "drop-shadow(0 0 4px rgba(255,120,120,.22))"
          : "drop-shadow(0 0 4px rgba(80,255,150,.20))"
      }
    };

    if (label === "eGPU") {
      return e("svg", common,
        e("rect", { x: "7", y: "7", width: "10", height: "10", rx: "2" }),
        e("path", { d: "M9 2V5" }),
        e("path", { d: "M12 2V5" }),
        e("path", { d: "M15 2V5" }),
        e("path", { d: "M9 19V22" }),
        e("path", { d: "M12 19V22" }),
        e("path", { d: "M15 19V22" }),
        e("path", { d: "M2 9H5" }),
        e("path", { d: "M2 12H5" }),
        e("path", { d: "M2 15H5" }),
        e("path", { d: "M19 9H22" }),
        e("path", { d: "M19 12H22" }),
        e("path", { d: "M19 15H22" })
      );
    }

    if (label === "Active display") {
      return e("svg", common,
        e("rect", { x: "4", y: "5", width: "16", height: "11", rx: "2" }),
        e("path", { d: "M10 19H14" }),
        e("path", { d: "M12 16V19" })
      );
    }

    if (label === "Panel signal" || label === "External signal") {
      return e("svg", common,
        e("path", { d: "M4 16C6.2 13.5 8.8 12 12 12C15.2 12 17.8 13.5 20 16" }),
        e("path", { d: "M7 13C8.5 11.4 10.2 10.6 12 10.6C13.8 10.6 15.5 11.4 17 13" }),
        e("path", { d: "M10 10C10.7 9.4 11.3 9.2 12 9.2C12.7 9.2 13.3 9.4 14 10" }),
        e("circle", { cx: "12", cy: "18", r: "1.3", fill: color, stroke: "none" })
      );
    }

    if (label === "Game mode" || label === "Performance mode" || label === "Performance profile") {
      return e("svg", common,
        e("path", { d: "M7.5 9H16.5C18.4 9 19.8 10.1 20.3 11.9L21 14.4C21.6 16.5 20.2 18.5 18.1 18.5C17 18.5 16 17.9 15.5 16.9L14.9 15.8H9.1L8.5 16.9C8 17.9 7 18.5 5.9 18.5C3.8 18.5 2.4 16.5 3 14.4L3.7 11.9C4.2 10.1 5.6 9 7.5 9Z" }),
        e("path", { d: "M8.2 13H11.8" }),
        e("path", { d: "M10 11.2V14.8" }),
        e("circle", { cx: "15.8", cy: "12.4", r: "0.8", fill: color, stroke: "none" }),
        e("circle", { cx: "17.8", cy: "14.4", r: "0.8", fill: color, stroke: "none" })
      );
    }

    return e("svg", common,
      e("circle", { cx: "12", cy: "12", r: "3.2" })
    );
  }

  var pcieLink = status && status.pcie_link ? status.pcie_link : null;

  var parseGtSpeedStatus = function(value) {
    var m = String(value || "").match(/([0-9]+(?:\.[0-9]+)?)\s*GT\/s/i);
    return m ? parseFloat(m[1]) : 0;
  };

  var speedEmojiFromLinkStatus = function(value) {
    var gt = parseGtSpeedStatus(value);
    if (gt >= 32) return "🚀";
    if (gt >= 16) return "🚗";
    if (gt >= 8) return "🛺";
    return "🐢";
  };

  var cableColorFromLinkStatus = function(value) {
    var gt = parseGtSpeedStatus(value);
    if (gt >= 32) return "rgb(80,170,255)";
    if (gt >= 16) return "rgb(80,255,150)";
    if (gt >= 8) return "rgba(245,248,255,.92)";
    return "rgb(255,160,70)";
  };

  var cableIconFromLinkStatus = function(value) {
    var c = cableColorFromLinkStatus(value);
    return e("svg", {
      width: "17",
      height: "12",
      viewBox: "0 0 34 22",
      style: {
        display: "inline-block",
        verticalAlign: "-2px",
        flex: "0 0 auto",
        marginRight: "2px",
        filter: "drop-shadow(0 0 4px rgba(0,0,0,.35))"
      }
    },
      e("path", {
        d: "M2 11 C7 11, 8 11, 12 11",
        fill: "none",
        stroke: c,
        strokeWidth: "3.2",
        strokeLinecap: "round"
      }),
      e("rect", {
        x: "12",
        y: "6",
        width: "10",
        height: "10",
        rx: "2.2",
        fill: c
      }),
      e("rect", {
        x: "21",
        y: "4.5",
        width: "9",
        height: "13",
        rx: "2",
        fill: "none",
        stroke: c,
        strokeWidth: "2.4"
      }),
      e("path", {
        d: "M24 8.5H30M24 13.5H30",
        stroke: c,
        strokeWidth: "1.8",
        strokeLinecap: "round",
        opacity: ".95"
      })
    );
  };

  var pcieLinkOk = pcieLink && pcieLink.ok && pcieLink.width && pcieLink.speed;
  var statusContent = egpu ? (
    pcieLinkOk ? (
      "eGPU  •  " + pcieLink.width + "  •  " + pcieLink.speed
    ) : "eGPU"
  ) : "eGPU not connected";

  var connector = status && status.recommended_connector ? status.recommended_connector : null;

  var sensors = egpu && egpu.sensors ? egpu.sensors : {};
  var gpuLabel = status && status.gpu_label ? status.gpu_label : (egpu ? "External GPU" : "Internal GPU");
  var igpuLabel = status && status.igpu_label ? status.igpu_label : "iGPU";

  function shortGpuName(fullName) {
    if (!fullName) return "";
    var s = fullName;
    s = s.replace(/^AMD Radeon\s*/i, "");
    s = s.replace(/^AMD\s*/i, "");
    s = s.replace(/^NVIDIA GeForce\s*/i, "");
    s = s.replace(/^NVIDIA\s*/i, "");
    s = s.replace(/\s+/g, " ").trim();
    return s || fullName;
  }

  function isNvidiaGpu(label) {
    if (!label) return false;
    return /nvidia|geforce|rtx|gtx/i.test(label);
  }

  function isAmdGpu(label) {
    if (!label) return false;
    return /amd|radeon|rx|navi/i.test(label);
  }

  function getDriverName(driver) {
    if (!driver || driver === "none" || driver === "unknown") return "";
    if (driver === "amdgpu") return "AMD";
    if (driver === "nvidia") return "NVIDIA";
    if (driver === "i915") return "Intel";
    return driver;
  }
  var displayLabel = status && status.display_label ? status.display_label : (connector ? (connector.name || "").replace(/^HDMI-A-/i, "HDMI ").replace(/^DP-/i, "DP ").replace(/^eDP-/i, "eDP ") : "Internal display");
  var bannerMode = status && status.display_target ? status.display_target : (egpu ? "external" : "internal");
  var availableTvModes = normalizeTvModes(status, connector);
  var selectedModeKey = modeKey(selectedMode);
  var currentMode = status && status.current_mode ? status.current_mode : null;
  var currentModeKey = currentMode ? modeKey(currentMode) : "";
  var tvSignalMode = status && status.tv_signal_mode ? status.tv_signal_mode : null;


  function fmtSensorList(list, field, unit) {
    if (!list || !list.length) return "n/a";
    return list.map(function(x) {
      var label = x.label ? x.label + "=" : "";
      var value = x[field];
      if (value === undefined || value === null) return "";
      return label + value + unit;
    }).filter(Boolean).join(", ");
  }

    function detailLine(label, value, good) {
    var text = value === undefined || value === null || value === "" ? "n/a" : String(value);
    var hasValue = text !== "n/a" && text !== "not found";

    return e("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginTop: "4px",
        padding: "1px 0",
        minHeight: "18px",
        whiteSpace: "nowrap",
        overflow: "hidden"
      }
    },
      e("span", {
        style: {
          opacity: ".74",
          fontWeight: "700",
          minWidth: "104px",
          maxWidth: "104px",
          flex: "0 0 104px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }
      }, label + ":"),
      e("span", {
        style: {
          marginLeft: "auto",
          textAlign: "right",
          color: good === false ? "rgba(255,170,170,.96)" : "rgba(245,248,255,.92)",
          fontWeight: "800",
          opacity: hasValue ? "1" : ".65",
          minWidth: "0",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap"
        }
      }, text)
    );
  }

  // Unified button helper: Focusable + DialogButton with consistent style
  function egbButton(opts) {
    var cls = opts.className || "egb-std-btn-wrap";
    return React.createElement(
      Focusable,
      { className: cls, onActivate: opts.onClick },
      React.createElement(
        DialogButton,
        {
          disabled: opts.disabled,
          onClick: opts.onClick,
          onOKButton: opts.onClick,
          onOKActionDescription: opts.title || "",
          style: {
            width: "100%",
            minWidth: "0",
            height: opts.height || "40px",
            boxSizing: "border-box",
            padding: opts.padding || "8px 10px",
            borderRadius: "10px",
            border: "1px solid rgba(255,255,255,.13)",
            background: opts.background || "linear-gradient(180deg, rgba(54,61,73,.96), rgba(31,36,45,.98))",
            boxShadow: "0 0 0 1px rgba(255,255,255,.035), 0 8px 16px rgba(0,0,0,.22)",
            color: "rgba(245,248,255,.96)",
            display: "flex",
            flexDirection: opts.flexDirection || "column",
            alignItems: "center",
            justifyContent: "center",
            gap: opts.gap || "2px"
          }
        },
        opts.children
      )
    );
  }

  function applyExternalCurrent() {
    var m = currentMode || selectedMode || { width: 3840, height: 2160, refresh: 60 };
    doCall("apply_egpu_mode", {
      restart: true,
      width: m.width,
      height: m.height,
      refresh: m.refresh || 60
    });
  }

  var internalInfo = status && status.internal_display ? status.internal_display : {};
  var externalInfo = status && status.external_display ? status.external_display : {};

  var internalActive = internalInfo.active !== undefined ? !!internalInfo.active : !patch.has_prefer_vk_active;
  var externalActive = externalInfo.active !== undefined ? !!externalInfo.active : !!patch.has_prefer_vk_active;

  var deviceHint = status && status.device_hint ? status.device_hint : null;
  var internalPanelRaw = status && status.internal_panel_label ? status.internal_panel_label : "";
  var internalText = (deviceHint && deviceHint.known) ? deviceHint.friendly_name : (internalPanelRaw || internalInfo.name || "Built-in display");
  var internalPanelDetail = internalPanelRaw && internalPanelRaw !== internalText ? internalPanelRaw : "Built-in panel";
  var externalText = externalInfo.name || displayLabel || "External display";
  var signalText = tvSignalMode && tvSignalMode.label ? tvSignalMode.label : "n/a";
  var internalSignalText = "1200p120";
  var shownSignalLabel = externalActive ? "External signal" : "Panel signal";
  var shownSignalText = externalActive ? signalText : internalSignalText;
  var renderText = currentMode && currentMode.label ? currentMode.label : "n/a";
  // UI_DISPLAY_MODE_FALLBACK_90909
  var displayModeText = shownSignalText !== "n/a" ? renderModeShortLabel(shownSignalText) : (
    externalActive ? (renderText !== "n/a" ? renderModeShortLabel(renderText) : "Auto") : "n/a"
  );
  var displayModeKnown = shownSignalText !== "n/a" || (externalActive && displayModeText !== "n/a");
  var gameModeText = "Custom";
  if (!externalActive) {
    gameModeText = "Handheld";
  } else if (renderText === "1920x1080 @ 60Hz") {
    gameModeText = "Performance";
  } else if (renderText !== "n/a") {
    gameModeText = "Custom • " + renderText;
  }
  var cpuModeInfo = status && status.cpu_mode ? status.cpu_mode : null;
  var cpuModeText = cpuModeInfo && cpuModeInfo.label ? cpuModeInfo.label : "";
  if (cpuModeText) {
    gameModeText = cpuModeText;
  }
  var connectorText = connector && connector.name ? connector.name.replace(/^HDMI-A-/i, "HDMI ").replace(/^DP-/i, "DP ").replace(/^eDP-/i, "eDP ") : "none";
  var routeStatusText = statusContent;
  if (dockStatus && dockStatus.label) {
    routeStatusText = statusContent + " • " + dockStatus.label;
  }
  var routeStatusTickerText = routeStatusText + "  " + routeStatusText + "  " + routeStatusText;
  // UI_TOP_STATUS_COMPACT_90907R2
  var topStatusLeft = egpu ? (dockStatus && dockStatus.label ? dockStatus.label : statusContent) : "eGPU not connected";
  topStatusLeft = String(topStatusLeft || "")
    .replace("USB4 40 Gb/s by ASMedia 246x detected", "USB4 40G · ASMedia 246x")
    .replace("USB4 40 Gb/s by ASMedia 246x", "USB4 40G · ASMedia 246x")
    .replace("by ASMedia 246x detected", "ASMedia 246x")
    .replace("by ASMedia 246x", "ASMedia 246x")
    .replace("detected", "")
    .trim();
  if (topStatusLeft.length > 30) {
    topStatusLeft = topStatusLeft
      .replace("USB4 40 Gb/s", "USB4 40G")
      .replace("ASMedia", "ASM")
      .slice(0, 30)
      .trim();
  }
  var topStatusRight = egpu ? "eGPU" : "OFF";

  return e(
    "div",
    { style: { padding: "0 8px 12px 8px", position: "relative" } },

      e("style", null, "/* UI_SKETCH_ALIGNMENT_STEP1_91006R2 */\n/* UI_RECOVERY_CSS_ONLY_UNIFORM_91006R14I2 */\n.egbRecoveryAction91006R14I2{width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;margin:0!important;}\n.egbRecoveryAction91006R14I2 button,.egbRecoveryAction91006R14I2 [role=button],.egbRecoveryAction91006R14I2 div[role=button]{width:100%!important;max-width:100%!important;min-width:0!important;height:40px!important;min-height:40px!important;max-height:40px!important;box-sizing:border-box!important;padding:6px 10px!important;border-radius:10px!important;overflow:hidden!important;display:flex!important;align-items:center!important;justify-content:center!important;background:linear-gradient(180deg,rgba(54,61,73,.96),rgba(31,36,45,.98))!important;border:1px solid rgba(255,255,255,.13)!important;box-shadow:0 0 0 1px rgba(255,255,255,.035),0 8px 16px rgba(0,0,0,.22)!important;color:rgba(245,248,255,.96)!important;font-size:12px!important;font-weight:900!important;text-align:center!important;}\n.egbRecoveryAction91006R14I2 button:focus,.egbRecoveryAction91006R14I2 [role=button]:focus,.egbRecoveryAction91006R14I2 div[role=button]:focus,.egbRecoveryAction91006R14I2 button:focus-visible,.egbRecoveryAction91006R14I2 [role=button]:focus-visible,.egbRecoveryAction91006R14I2 div[role=button]:focus-visible{background:linear-gradient(180deg,rgba(238,240,246,.98),rgba(210,214,226,.98))!important;color:rgba(35,38,45,.98)!important;box-shadow:0 0 0 2px rgba(255,255,255,.24),0 0 0 1px rgba(0,0,0,.18)!important;}\n.egbRecoveryAction91006R14I2 button *,.egbRecoveryAction91006R14I2 [role=button] *,.egbRecoveryAction91006R14I2 div[role=button] *{box-sizing:border-box!important;min-width:0!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;}\n.egbRecoveryAction91006R14I2 span{line-height:12px!important;}\n/* UI_RECOVERY_COMPACT_SAFE_91006R14G */\n.egbRecoveryCompact91006R14G button,.egbRecoveryCompact91006R14G [role=button]{width:100%!important;max-width:100%!important;min-width:0!important;min-height:36px!important;height:auto!important;box-sizing:border-box!important;padding:5px 8px!important;border-radius:9px!important;overflow:hidden!important;}\n.egbRecoveryCompact91006R14G button *,.egbRecoveryCompact91006R14G [role=button] *{min-width:0!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;}\n.egbRecoveryCompact91006R14G span{line-height:12px!important;}\n.egbRecoveryCompact91006R14G + .egbRecoveryCompact91006R14G{margin-top:-2px!important;}\n\n/* UI_TV_ROW_CSS_FORCE_91006R13B */\n.egbTvMiniRow91006R13B{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:5px!important;width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;overflow:visible!important;}.egbTvMiniCell91006R13B{min-width:0!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important;overflow:visible!important;}.egbTvMiniCell91006R13B button,.egbTvMiniCell91006R13B [role=button],.egbTvMiniCell91006R13B div[role=button]{width:100%!important;max-width:100%!important;min-width:0!important;height:40px!important;min-height:40px!important;padding:0!important;margin:0!important;box-sizing:border-box!important;display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important;overflow:visible!important;white-space:nowrap!important;font-size:10px!important;font-weight:900!important;line-height:12px!important;letter-spacing:.02em!important;}.egbTvMiniCell91006R13B button > *,.egbTvMiniCell91006R13B [role=button] > *,.egbTvMiniCell91006R13B div[role=button] > *{display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important;width:100%!important;max-width:100%!important;min-width:0!important;overflow:visible!important;white-space:nowrap!important;}.quickaccessmenu .PanelSection, .quickaccessmenu [class*=PanelSection]{border-radius:14px!important;}.quickaccessmenu button{border-radius:10px!important;}"),

        e("style", null, ".egbDebugToggleWrap81318R7{box-sizing:border-box!important;overflow:hidden!important;contain:paint!important;}.egbDebugToggleWrap81318R7 *{box-sizing:border-box!important;}.egbDebugToggleStable81318R7{box-sizing:border-box!important;transform:none!important;overflow:hidden!important;contain:paint!important;outline:2px solid transparent!important;outline-offset:-4px!important;max-width:100%!important;}.egbDebugToggleStable81318R7:focus,.egbDebugToggleStable81318R7:focus-visible,.egbDebugToggleWrap81318R7 button:focus,.egbDebugToggleWrap81318R7 button:focus-visible,.egbDebugToggleWrap81318R7 [role=button]:focus,.egbDebugToggleWrap81318R7 [role=button]:focus-visible{transform:none!important;outline:2px solid rgba(255,255,255,.78)!important;outline-offset:-4px!important;box-shadow:inset 0 0 0 2px rgba(255,255,255,.32),0 0 0 1px rgba(255,255,255,.06)!important;max-width:100%!important;overflow:hidden!important;}"),

      e("style", null, "@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');"),
      e("style", null, "@keyframes egbRouteTicker81316 { 0% { transform: translate3d(0,0,0); } 100% { transform: translate3d(-33.333%,0,0); } }"),
      e("style", null, "@keyframes egpu-mode-blink{0%,100%{opacity:1;box-shadow:0 0 8px rgba(80,220,130,.60)}50%{opacity:.4;box-shadow:0 0 2px rgba(80,220,130,.15)}}"),
      e("style", null, "@keyframes egpu-mode-blink-blue{0%,100%{opacity:1;box-shadow:0 0 8px rgba(100,170,255,.60)}50%{opacity:.4;box-shadow:0 0 2px rgba(100,170,255,.15)}}"),
      e("style", null, "@keyframes egpu-mode-blink-gray{0%,100%{opacity:.8;box-shadow:0 0 6px rgba(180,180,180,.40)}50%{opacity:.3;box-shadow:0 0 2px rgba(180,180,180,.10)}}"),

      /* === EGB DESIGN TOKENS === */
      e("style", null, ":root{--egb-bg-panel:rgba(18,22,32,.88);--egb-bg-row:rgba(255,255,255,.035);--egb-bg-input:rgba(0,0,0,.15);--egb-border:rgba(160,190,245,.12);--egb-border-focus:rgba(160,190,245,.35);--egb-text-primary:rgba(245,248,255,.94);--egb-text-label:rgba(180,205,245,.70);--egb-text-value:rgba(245,248,255,.88);--egb-text-muted:rgba(180,205,245,.45);--egb-accent-purple:rgba(220,130,255,.95);--egb-accent-blue:rgba(80,200,255,.85);--egb-accent-green:rgba(80,255,150,.90);--egb-accent-red:rgba(255,120,120,.90);--egb-accent-yellow:rgba(255,210,90,.95);--egb-radius-sm:6px;--egb-radius-md:8px;--egb-radius-lg:10px;--egb-radius-xl:12px}" +
      /* Button classes */
      ".egb-btn-primary{min-height:34px!important;border-radius:var(--egb-radius-lg)!important;background:linear-gradient(180deg,rgba(54,61,73,.96),rgba(31,36,45,.98))!important;border:1px solid rgba(255,255,255,.13)!important;box-shadow:0 0 0 1px rgba(255,255,255,.035),0 8px 16px rgba(0,0,0,.22)!important;color:var(--egb-text-primary)!important;font-size:11px!important;font-weight:800!important;}.egb-btn-round{width:36px!important;min-width:36px!important;height:36px!important;min-height:36px!important;border-radius:999px!important;padding:0!important;box-sizing:border-box!important;display:flex!important;align-items:center!important;justify-content:center!important;}" +
      ".egb-btn-small{min-height:28px!important;padding:4px 10px!important;border-radius:var(--egb-radius-sm)!important;background:transparent!important;border:1px solid var(--egb-border)!important;color:var(--egb-text-value)!important;font-size:10px!important;font-weight:700!important;}" +
      ".egb-btn-icon{width:36px!important;height:36px!important;min-width:36px!important;min-height:36px!important;aspect-ratio:1/1!important;border-radius:999px!important;background:linear-gradient(180deg,rgba(54,61,73,.96),rgba(31,36,45,.98))!important;border:1px solid rgba(255,255,255,.13)!important;box-shadow:0 0 0 1px rgba(255,255,255,.035),0 8px 16px rgba(0,0,0,.22)!important;color:var(--egb-text-primary)!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:0!important;box-sizing:border-box!important;overflow:hidden!important;}" +
      /* Toggle classes */
      ".egb-toggle{width:40px!important;height:22px!important;border-radius:999px!important;}" +
      ".egb-toggle-off{background:rgba(255,255,255,.12)!important;border:1px solid rgba(255,255,255,.22)!important;}" +
      ".egb-toggle-on{background:rgba(80,255,150,.28)!important;border:1px solid rgba(80,255,150,.70)!important;}" +
      ".egb-toggle-thumb{width:16px!important;height:16px!important;border-radius:999px!important;}" +
      /* Card / Accordion / Row */
      ".egb-card{background:var(--egb-bg-panel)!important;border:1px solid var(--egb-border)!important;border-radius:var(--egb-radius-lg)!important;}" +
      ".egb-accordion{background:var(--egb-bg-panel)!important;border:1px solid var(--egb-border)!important;border-radius:var(--egb-radius-xl)!important;padding:10px!important;}" +
      ".egb-row{background:var(--egb-bg-row)!important;border:1px solid rgba(255,255,255,.08)!important;border-radius:var(--egb-radius-lg)!important;min-height:52px!important;}" +
      /* Badge */
      ".egb-badge{font-size:9px!important;font-weight:700!important;padding:1px 5px!important;border-radius:4px!important;border:1px solid var(--egb-border)!important;}" +
      ".egb-badge-purple{color:var(--egb-accent-purple)!important;background:rgba(192,38,211,.12)!important;border-color:rgba(192,38,211,.25)!important;}" +
      ".egb-badge-blue{color:var(--egb-accent-blue)!important;background:rgba(80,200,255,.10)!important;border-color:rgba(80,200,255,.2)!important;}" +
      ".egb-badge-green{color:var(--egb-accent-green)!important;background:rgba(80,255,150,.10)!important;border-color:rgba(80,255,150,.2)!important;}" +
      ".egb-badge-red{color:var(--egb-accent-red)!important;background:rgba(255,120,120,.10)!important;border-color:rgba(255,120,120,.2)!important;}" +
      ".egb-badge-yellow{color:var(--egb-accent-yellow)!important;background:rgba(255,210,90,.10)!important;border-color:rgba(255,210,90,.2)!important;}" +
      /* Typography */
      ".egb-title{font-size:12px!important;font-weight:900!important;color:var(--egb-text-primary)!important;line-height:14px!important;}" +
      ".egb-label{font-size:10px!important;font-weight:700!important;color:var(--egb-text-label)!important;}" +
      ".egb-value{font-size:11px!important;font-weight:900!important;color:var(--egb-text-value)!important;}" +
      ".egb-desc{font-size:9px!important;font-weight:600!important;color:var(--egb-text-muted)!important;}" +
      /* Focus ring (shared) */
      ".egb-btn-primary:focus,.egb-btn-primary:focus-visible,.egb-btn-primary.gpfocus,.egb-btn-small:focus,.egb-btn-small:focus-visible,.egb-btn-small.gpfocus{outline:none!important;box-shadow:0 0 0 2px rgba(255,255,255,.9)!important;background:linear-gradient(180deg,rgba(238,240,246,.98),rgba(210,214,226,.98))!important;color:rgba(35,38,45,.98)!important;}.egb-btn-icon:focus,.egb-btn-icon:focus-visible,.egb-btn-icon.gpfocus{outline:none!important;box-shadow:0 0 0 2px rgba(255,255,255,.7)!important;border-radius:999px!important;}"),

      e("style", null, "/* UI_SKETCH_ACCORDION_DASHBOARD_91007R4 */\n/* UI_DASHBOARD_POLISH_91007R4B */\n.egbSketchRoot91007R4{width:100%!important;box-sizing:border-box!important;}\n.egbMainCollapsed91007R4{width:100%!important;box-sizing:border-box!important;display:flex!important;flex-direction:column!important;gap:6px!important;padding:12px!important;border-radius:12px!important;background:rgba(18,22,32,.88)!important;border:1px solid rgba(100,160,240,.18)!important;}\n.egbMainHeader91007R4{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;margin-bottom:4px!important;}\n.egbMainActionGrid91007R4{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;width:100%!important;}\n.egbMainActionButton91007R4{min-width:0!important;overflow:hidden!important;}\n.egbMainActionButton91007R4 button{width:100%!important;min-width:0!important;height:56px!important;min-height:56px!important;box-sizing:border-box!important;border-radius:10px!important;overflow:hidden!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:11px!important;font-weight:900!important;white-space:nowrap!important;}\n.egbMainActionButton91007R4 button *{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;}\n.egbDashboard91007R4{width:100%!important;box-sizing:border-box!important;display:flex!important;flex-direction:column!important;gap:4px!important;}\n.egbDashRow91007R4{display:flex!important;align-items:center!important;gap:10px!important;padding:10px 12px!important;border-radius:10px!important;background:rgba(255,255,255,.035)!important;border:1px solid rgba(255,255,255,.08)!important;height:52px!important;box-sizing:border-box!important;}\n.egbDashIcon91007R4{flex:0 0 auto!important;width:24px!important;height:24px!important;display:flex!important;align-items:center!important;justify-content:center!important;}\n.egbDashText91007R4{flex:1 1 auto!important;min-width:0!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;}\n.egbDashTitle91007R4{font-size:11px!important;font-weight:900!important;color:#EEEAFE!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;line-height:13px!important;}\n.egbDashValue91007R4{font-size:10px!important;font-weight:700!important;color:#9AA4B2!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;line-height:12px!important;margin-top:1px!important;}\n.egbDashGearBtn91007R4{flex:0 0 auto!important;width:36px!important;height:36px!important;min-width:36px!important;min-height:36px!important;padding:0!important;border-radius:8px!important;display:flex!important;align-items:center!important;justify-content:center!important;background:rgba(255,255,255,.06)!important;border:1px solid rgba(255,255,255,.12)!important;cursor:pointer!important;}\n.egbDashGearBtn91007R4:focus,.egbDashGearBtn91007R4:focus-visible{outline:2px solid rgba(255,255,255,.5)!important;outline-offset:-2px!important;}\n.egbAccordion91007R4{width:100%!important;box-sizing:border-box!important;margin-top:8px!important;border-radius:12px!important;background:rgba(18,22,32,.88)!important;border:1px solid rgba(255,255,255,.08)!important;overflow:hidden!important;}\n.egbAccordionHeader91007R4{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:10px 12px!important;cursor:pointer!important;}\n.egbAccordionBody91007R4{padding:0 12px 12px 12px!important;}\n.egbTvControlCompact91007R4{width:100%!important;box-sizing:border-box!important;}\n.egbGpuCenterCompact91007R4{width:100%!important;box-sizing:border-box!important;}\n.egbDashChevron91007R4{flex:0 0 auto!important;width:16px!important;height:16px!important;display:flex!important;align-items:center!important;justify-content:center!important;color:rgba(255,255,255,.3)!important;font-size:14px!important;}\n/* UI_UNIFORM_BTN_STYLE */\n.egbRecoveryAction91006R14I2 button,.egbRecoveryAction91006R14I2 [role=button]{height:40px!important;min-height:40px!important;max-height:40px!important;border-radius:10px!important;background:linear-gradient(180deg,rgba(54,61,73,.96),rgba(31,36,45,.98))!important;border:1px solid rgba(255,255,255,.13)!important;box-shadow:0 0 0 1px rgba(255,255,255,.035),0 8px 16px rgba(0,0,0,.22)!important;color:rgba(245,248,255,.96)!important;}\n.egbRecoveryAction91006R14I2 button:focus,.egbRecoveryAction91006R14I2 button:focus-visible,.egbRecoveryAction91006R14I2 button.gpfocus,.egbRecoveryAction91006R14I2 [role=button]:focus,.egbRecoveryAction91006R14I2 [role=button]:focus-visible,.egbRecoveryAction91006R14I2 [role=button].gpfocus{outline:none!important;box-shadow:0 0 0 2px rgba(255,255,255,.9)!important;background:linear-gradient(180deg,rgba(238,240,246,.98),rgba(210,214,226,.98))!important;color:rgba(35,38,45,.98)!important;}\n.egbRecoveryCompact91006R14G button,.egbRecoveryCompact91006R14G [role=button]{height:40px!important;min-height:40px!important;max-height:40px!important;border-radius:10px!important;background:linear-gradient(180deg,rgba(54,61,73,.96),rgba(31,36,45,.98))!important;border:1px solid rgba(255,255,255,.13)!important;box-shadow:0 0 0 1px rgba(255,255,255,.035),0 8px 16px rgba(0,0,0,.22)!important;}\n.egbRecoveryCompact91006R14G button:focus,.egbRecoveryCompact91006R14G button:focus-visible,.egbRecoveryCompact91006R14G button.gpfocus,.egbRecoveryCompact91006R14G [role=button]:focus,.egbRecoveryCompact91006R14G [role=button].gpfocus{outline:none!important;box-shadow:0 0 0 2px rgba(255,255,255,.9)!important;background:linear-gradient(180deg,rgba(238,240,246,.98),rgba(210,214,226,.98))!important;color:rgba(35,38,45,.98)!important;}\n.egbTvMiniCell91006R13B button,.egbTvMiniCell91006R13B [role=button]{height:40px!important;min-height:40px!important;border-radius:10px!important;background:linear-gradient(180deg,rgba(54,61,73,.96),rgba(31,36,45,.98))!important;border:1px solid rgba(255,255,255,.13)!important;box-shadow:0 0 0 1px rgba(255,255,255,.035),0 8px 16px rgba(0,0,0,.22)!important;}\n.egbTvMiniCell91006R13B button:focus,.egbTvMiniCell91006R13B button:focus-visible,.egbTvMiniCell91006R13B button.gpfocus{outline:none!important;box-shadow:0 0 0 2px rgba(255,255,255,.9)!important;background:linear-gradient(180deg,rgba(238,240,246,.98),rgba(210,214,226,.98))!important;color:rgba(35,38,45,.98)!important;}\n/* UI_FOCUS_RING */\n.egb-std-btn-wrap button:focus,.egb-std-btn-wrap button:focus-visible,.egb-std-btn-wrap button.gpfocus,.egb-std-btn-wrap.gpfocus button{outline:none!important;box-shadow:0 0 0 2px rgba(255,255,255,.9)!important;}\n.egb-tv-ctrl-btn-wrap button:focus,.egb-tv-ctrl-btn-wrap button:focus-visible,.egb-tv-ctrl-btn-wrap button.gpfocus,.egb-tv-ctrl-btn-wrap.gpfocus button{outline:none!important;box-shadow:0 0 0 2px rgba(255,255,255,.9)!important;}\n.egb-tv-btn-wrap button:focus,.egb-tv-btn-wrap button:focus-visible,.egb-tv-btn-wrap button.gpfocus,.egb-tv-btn-wrap.gpfocus button{outline:none!important;box-shadow:0 0 0 2px rgba(255,255,255,.9)!important;}\n.egb-tv-status-wrap button:focus,.egb-tv-status-wrap button:focus-visible,.egb-tv-status-wrap button.gpfocus,.egb-tv-status-wrap.gpfocus button{outline:none!important;box-shadow:0 0 0 2px rgba(255,255,255,.9)!important;}\n.egbDashDotBtn91008R1:focus,.egbDashDotBtn91008R1:focus-visible,.egbDashDotBtn91008R1.gpfocus,.egbDashDotBtn91008R1 button:focus,.egbDashDotBtn91008R1 button.gpfocus{outline:none!important;box-shadow:0 0 0 2px rgba(255,255,255,.7)!important;border-radius:999px!important;}\n.egbSmartSwitchBtn button,.egbSmartSwitchBtn [role=button]{width:100%!important;height:52px!important;min-height:52px!important;max-height:52px!important;box-sizing:border-box!important;border-radius:12px!important;border:2px solid #FACC15!important;background:linear-gradient(180deg, rgba(30,32,40,.98), rgba(20,22,28,.98))!important;box-shadow:0 0 12px rgba(250,204,21,.15), 0 0 0 1px rgba(250,204,21,.08), 0 8px 16px rgba(0,0,0,.3)!important;color:#FACC15!important;padding:8px 12px!important;display:flex!important;align-items:center!important;justify-content:center!important;}\n.egbSmartSwitchBtn button:focus,.egbSmartSwitchBtn button:focus-visible,.egbSmartSwitchBtn button.gpfocus,.egbSmartSwitchBtn.gpfocus button,.egbSmartSwitchBtn [role=button]:focus,.egbSmartSwitchBtn [role=button]:focus-visible,.egbSmartSwitchBtn [role=button].gpfocus{outline:none!important;outline-offset:0!important;border:2px solid #F59E0B!important;background:linear-gradient(180deg, #FACC15, #F59E0B)!important;box-shadow:0 0 14px rgba(245,158,11,.35), 0 8px 16px rgba(0,0,0,.25)!important;border-radius:12px!important;height:52px!important;min-height:52px!important;max-height:52px!important;}\n.egbSmartSwitchBtn button:focus *,.egbSmartSwitchBtn button:focus-visible *,.egbSmartSwitchBtn button.gpfocus *,.egbSmartSwitchBtn.gpfocus button *{color:#1A1A1A!important;fill:#1A1A1A!important;}\n.PanelSectionRow button:focus,.PanelSectionRow button:focus-visible,.PanelSectionRow button.gpfocus,.PanelSectionRow.gpfocus button{outline:none!important;box-shadow:0 0 0 2px rgba(255,255,255,.9)!important;}\n.egpuCenterBtn:focus,.egpuCenterBtn:focus-visible,.egpuCenterBtn.gpfocus,.egpuCenterBtn button:focus,.egpuCenterBtn button.gpfocus{outline:none!important;box-shadow:0 0 0 2px rgba(255,255,255,.9)!important;}\n.egpuProfileRow.gpfocus,.egpuProfileRow:focus-visible{background:rgba(255,255,255,.06)!important;border-radius:8px!important;outline:none!important;box-shadow:0 0 0 2px rgba(255,255,255,.9)!important;}\n.egpuProfileRow.gpfocus span,.egpuProfileRow:focus-visible span{color:rgba(245,248,255,.95)!important;}\n.egpuProfileBtn90501.gpfocus,.egpuProfileBtn90501:focus-visible{background:rgba(192,38,211,.25)!important;border-color:rgba(192,38,211,.5)!important;box-shadow:0 0 0 2px rgba(255,255,255,.9)!important;border-radius:6px!important;outline:none!important;}.egpuProfileBtn90501.egb-btn-round.gpfocus,.egpuProfileBtn90501.egb-btn-round:focus-visible{border-radius:999px!important;}.egb-refresh-btn.gpfocus,.egb-refresh-btn:focus-visible{background:rgba(255,255,255,.15)!important;border-color:rgba(255,255,255,.3)!important;box-shadow:0 0 0 2px rgba(255,255,255,.7)!important;outline:none!important;}.egb-refresh-btn.egb-btn-round.gpfocus,.egb-refresh-btn.egb-btn-round:focus-visible{border-radius:999px!important;}\n.egpuTuningSlider.gpfocus{background:rgba(255,255,255,.06)!important;border-radius:8px!important;outline:none!important;box-shadow:0 0 0 2px rgba(255,255,255,.9)!important;}\n.egpuTuningSlider.gpfocus span{color:rgba(245,248,255,.95)!important;}\n.egpuIconBtn:focus,.egpuIconBtn:focus-visible,.egpuIconBtn.gpfocus{outline:none!important;box-shadow:0 0 0 2px rgba(255,255,255,.9)!important;background:linear-gradient(180deg,rgba(238,240,246,.98),rgba(210,214,226,.98))!important;color:rgba(35,38,45,.98)!important;}\ndiv[class*=Focusable].gpfocus{outline:none!important;}.egb-tv-btn-wrap.gpfocus{box-shadow:none!important;}"),



      // TV Mode dropdown — below plugin title, above SMART
      showModeList ? React.createElement(
        PanelSectionRow,
        null,
        e("div", {
          style: {
            width: "100%",
            boxSizing: "border-box",
            marginBottom: "8px",
            padding: "6px",
            borderRadius: "10px",
            background: "rgba(0,0,0,.24)",
            border: "1px solid rgba(160,190,245,.20)"
          }
        },
          (availableTvModes && availableTvModes.length ? availableTvModes : [
            { width: 3840, height: 2160, refresh: 60, label: "3840x2160 @ 60Hz" },
            { width: 2560, height: 1440, refresh: 120, label: "2560x1440 @ 120Hz" },
            { width: 2560, height: 1440, refresh: 60, label: "2560x1440 @ 60Hz" },
            { width: 1920, height: 1080, refresh: 120, label: "1920x1080 @ 120Hz" },
            { width: 1920, height: 1080, refresh: 60, label: "1920x1080 @ 60Hz" },
            { width: 1280, height: 720, refresh: 120, label: "1280x720 @ 120Hz" },
            { width: 1280, height: 720, refresh: 60, label: "1280x720 @ 60Hz" }
          ]).map(function(m) {
            var k = modeKey(m);
            return ResolutionOptionRow({
              disabled: busy || !egpu,
              selected: k === currentModeKey,
              title: renderModeShortLabel(m),
              rightText: k === currentModeKey ? "ACTIVE" : "",
              onClick: function() {
                setSelectedMode(m);
                setShowModeList(false);
                setLast({
                  ok: true,
                  marker: "FRONTEND_PICK_TV_MODE_INLINE",
                  message: "Diagnostics: inline TV Mode picked",
                  next_mode: modeKey(m)
                });
                doCall("tv_input_mode", {
                  width: m.width,
                  height: m.height,
                  refresh: m.refresh || 60
                });
              }
            });
          })
        )
      ) : null,

      // Portable/Steam Machine badge (moved from top header)
      e("div", {
        className: "egb-card",
        style: {
          width: "100%",
          boxSizing: "border-box",
          padding: "8px 10px",
          marginBottom: "8px",
          borderRadius: "12px",
          background: externalActive ? (isNvidiaGpu(gpuLabel) ? "rgba(18,28,18,.88)" : "rgba(28,18,18,.88)") : "rgba(18,22,32,.88)",
          border: externalActive ? (isNvidiaGpu(gpuLabel) ? "1px solid rgba(80,200,120,.18)" : "1px solid rgba(220,80,80,.18)") : "1px solid rgba(100,160,240,.18)",
          boxShadow: "0 1px 4px rgba(0,0,0,.14)"
        }
      },
        e("div", {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            marginBottom: "3px"
          }
        },
          e("div", {
            style: { display: "flex", alignItems: "center", gap: "7px", minWidth: "0", flex: "1 1 auto" }
          },
            e("span", {
              style: {
                width: "8px", height: "8px", borderRadius: "999px", flex: "0 0 auto", display: "inline-block",
                background: externalActive ? (isNvidiaGpu(gpuLabel) ? "rgba(80,220,130,.95)" : "rgba(220,80,80,.95)") : "rgba(100,170,255,.95)",
                boxShadow: externalActive ? (isNvidiaGpu(gpuLabel) ? "0 0 6px rgba(80,220,130,.40)" : "0 0 6px rgba(220,80,80,.40)") : "0 0 6px rgba(100,170,255,.35)"
              }
            }),
            e("span", {
              style: { fontSize: "12px", fontWeight: "900", letterSpacing: ".04em", textTransform: "uppercase", color: "rgba(245,248,255,.96)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
            }, externalActive ? "STEAM MACHINE MODE" : "PORTABLE MODE")
          ),
          e("span", {
            style: {
              fontSize: "10px", fontWeight: "800", padding: "2px 7px", borderRadius: "6px",
              background: externalActive ? (isNvidiaGpu(gpuLabel) ? "rgba(80,200,120,.12)" : "rgba(220,60,60,.12)") : "rgba(100,160,240,.10)",
              border: externalActive ? (isNvidiaGpu(gpuLabel) ? "1px solid rgba(80,200,120,.20)" : "1px solid rgba(220,60,60,.20)") : "1px solid rgba(100,160,240,.18)",
              color: externalActive ? (isNvidiaGpu(gpuLabel) ? "rgba(140,240,170,.90)" : "rgba(255,120,120,.90)") : "rgba(160,200,255,.90)", flex: "0 0 auto"
            }
          }, externalActive ? shortGpuName(gpuLabel) || "eGPU" : shortGpuName(igpuLabel) || "iGPU")
        ),

      ),

      // Dashboard separator
      e("div", {
        style: {
          marginTop: "4px",
          marginBottom: "2px",
          paddingTop: "6px",
          borderTop: "1px solid rgba(255,255,255,.08)"
        }
      }),

      // UI_REMOVE_TOP_SAFE_UNPLUG_90905R2

      e("div", {
          className: "egbMainDisplayCard91007R2",
          onClick: function() {
            refresh(false);
          },
          title: "Refresh status",
        style: {
            cursor: "pointer",
          background: "rgba(18,22,32,.88)",
          border: externalActive ? "1px solid rgba(80,200,120,.18)" : "1px solid rgba(100,160,240,.18)",
          borderRadius: "12px",
          padding: "7px 9px",
          marginBottom: "8px",
          fontSize: "11px",
          fontWeight: 900,
          position: "relative",
          boxSizing: "border-box",
          width: "100%",
          overflow: "hidden"
        }
      },
        // UI_MAIN_DISPLAY_COLLAPSED_DASHBOARD_91007R3
        // UI_MAIN_DISPLAY_SKETCH_COMPACT_91007R2 (collapsed by R3)
        e("div", {
          className: "egbMainCollapsed91007R3",
          style: {
            width: "100%",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            marginTop: "2px",
            marginBottom: "8px"
          }
        },

          // SMART button — full width, 2 rows (lightning bolt + GPU label)
          e("div", { className: "egbSmartSwitchBtn", style: { width: "100%", marginBottom: "6px" } },
            React.createElement(
              GamepadButton,
              {
                disabled: busy || !egpu,
                onClick: function() {
                  setLast({ ok: true, marker: "FRONTEND_CLICK_SMART", message: "Diagnostics: SMART frontend click reached React handler" });
                  doCall("smart_toggle_display", { restart: true });
                },
                style: {
                  width: "100%",
                  height: "52px",
                  minHeight: "52px",
                  boxSizing: "border-box",
                  borderRadius: "12px",
                  border: "2px solid #FACC15",
                  background: "linear-gradient(180deg, rgba(30,32,40,.98), rgba(20,22,28,.98))",
                  boxShadow: "0 0 12px rgba(250,204,21,.15), 0 0 0 1px rgba(250,204,21,.08), 0 8px 16px rgba(0,0,0,.3)",
                  color: "#FACC15",
                  padding: "8px 12px",
                  opacity: (busy || !egpu) ? ".55" : "1"
                }
              },
              e("span", {
                style: { display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", width: "100%" }
              },
                e("svg", {
                  width: "22", height: "22", viewBox: "0 0 24 24",
                  fill: "#FACC15", stroke: "none", flex: "0 0 auto"
                },
                  e("path", { d: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" })
                ),
                e("span", {
                  style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", minWidth: "0", flex: "1 1 auto" }
                },
                  e("span", {
                    style: { fontSize: "10px", fontWeight: "900", lineHeight: "12px", color: "#FACC15", letterSpacing: ".08em", textTransform: "uppercase", fontFamily: "'Share Tech Mono', 'Courier New', monospace", textAlign: "center", width: "100%" }
                  }, "SMART switch to"),
                  e("span", {
                    style: { fontSize: "13px", fontWeight: "900", lineHeight: "15px", color: "rgba(245,248,255,.96)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center", width: "100%" }
                  }, externalActive ? (internalText || "Internal") : (externalText && externalText !== "External display" ? externalText : (connectorText !== "none" ? connectorText + " TV" : "TV")))
                )
              )
            )
          ),


          // Dashboard rows (R4)
          e("div", {
            className: "egbDashboard91007R4",
            style: {
              width: "100%",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              gap: "4px"
            }
          },

            // Combined row: Dock/eGPU + Link/Port/Speed
            e("div", {
              style: {
                display: "flex",
                flexDirection: "column",
                gap: "0",
                padding: "0",
                borderRadius: "10px",
                background: "rgba(255,255,255,.035)",
                border: "1px solid rgba(255,255,255,.08)",
                boxSizing: "border-box",
                overflow: "hidden",
                width: "100%",
                marginBottom: "6px"
              }
            },
              // Sub-row 1: Dock/eGPU
              e("div", {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 12px",
                  boxSizing: "border-box"
                }
              },
                e("div", {
                  style: { flex: "0 0 auto", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", color: "#22C55E" }
                },
                  e("svg", { viewBox: "0 0 24 24", width: "24", height: "24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" },
                    e("rect", { x: "1", y: "6", width: "22", height: "12", rx: "2" }),
                    e("circle", { cx: "12", cy: "12", r: "4" }),
                    e("circle", { cx: "12", cy: "12", r: "1.5" }),
                    e("line", { x1: "12", y1: "8", x2: "12", y2: "10.5" }),
                    e("line", { x1: "12", y1: "13.5", x2: "12", y2: "16" }),
                    e("line", { x1: "8", y1: "12", x2: "10.5", y2: "12" }),
                    e("line", { x1: "13.5", y1: "12", x2: "16", y2: "12" }),
                    e("rect", { x: "3", y: "8", width: "4", height: "2", rx: "0.5" }),
                    e("rect", { x: "3", y: "11", width: "4", height: "2", rx: "0.5" }),
                    e("rect", { x: "3", y: "14", width: "4", height: "2", rx: "0.5" }),
                    e("line", { x1: "18", y1: "10", x2: "22", y2: "10" }),
                    e("line", { x1: "18", y1: "14", x2: "22", y2: "14" })
                  )
                ),
                e("div", {
                  style: { flex: "1 1 auto", minWidth: "0", display: "flex", flexDirection: "column", overflow: "hidden" }
                },
                  e("span", {
                    style: { fontSize: "11px", fontWeight: "900", color: "#EEEAFE", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: "13px" }
                  }, "Dock / eGPU"),
                  e("span", {
                    style: { fontSize: "10px", fontWeight: "700", color: "#9AA4B2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: "12px", marginTop: "1px" }
                  }, egpu ? "ASMedia 246x \u00b7 " + (getDriverName(status && status.egpu_driver) || "GPU") + (status && status.mesa_version ? " (MESA" + status.mesa_version + ")" : "") : "no eGPU")
                )
              ),
              // Divider
              e("div", { style: { height: "1px", background: "rgba(255,255,255,.06)", margin: "0 12px" } }),
              // Sub-row 2: Link / Port / Speed
              e("div", {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 12px",
                  boxSizing: "border-box"
                }
              },
                e("div", {
                  style: { flex: "0 0 auto", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", color: "#00C8FF" }
                },
                  e("svg", { viewBox: "0 0 24 24", width: "24", height: "24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" },
                    e("text", { x: "12", y: "6", textAnchor: "middle", fill: "#00C8FF", stroke: "none", fontSize: "5", fontWeight: "800", fontFamily: "monospace" }, "USB"),
                    e("rect", { x: "3", y: "8", width: "18", height: "7", rx: "3.5" }),
                    e("rect", { x: "6", y: "10", width: "12", height: "3", rx: "1.5" }),
                    e("text", { x: "12", y: "20", textAnchor: "middle", fill: "#00C8FF", stroke: "none", fontSize: "4.5", fontWeight: "800", fontFamily: "monospace" }, "Type C")
                  )
                ),
                e("div", {
                  style: { flex: "1 1 auto", minWidth: "0", display: "flex", flexDirection: "column", overflow: "hidden" }
                },
                  e("span", {
                    style: { fontSize: "11px", fontWeight: "900", color: "#EEEAFE", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: "13px" }
                  }, "Link / Port / Speed"),
                  e("span", {
                    style: { fontSize: "10px", fontWeight: "700", color: "#9AA4B2", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: "12px", marginTop: "1px" }
                  }, egpu ? (dockStatus && dockStatus.usb4 ? "USB4 x" + (dockStatus.usb4.rx_lanes || "?") + " \u00b7 " + (dockStatus.usb4.rx_total_gbps || dockStatus.usb4.tx_total_gbps || "40") + "G \u00b7 " + (dockStatus.usb4.link_ok_40gbps ? "Tunnel OK" : "Tunnel Low") : "USB4 \u00b7 checking") : "n/a")
                )
              )
            ),

            // Row 3: TV + gear
            e("div", {
              className: "egbDashRow91007R4 egb-row",
              style: {
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 12px",
                borderRadius: "10px",
                background: "rgba(255,255,255,.035)",
                border: "1px solid rgba(255,255,255,.08)",
                height: "52px",
                boxSizing: "border-box"
              }
            },
              // Purple TV icon
              e("div", {
                className: "egbDashIcon91007R4",
                style: {
                  flex: "0 0 auto",
                  width: "24px",
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#A855F7"
                }
              },
                e("svg", { viewBox: "0 0 24 24", width: "24", height: "24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                  e("rect", { x: "2", y: "3", width: "20", height: "14", rx: "2" }),
                  e("path", { d: "M8 21h8" }),
                  e("path", { d: "M12 17v4" })
                )
              ),
              e("div", {
                className: "egbDashText91007R4",
                style: {
                  flex: "1 1 auto",
                  minWidth: "0",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden"
                }
              },
                e("span", {
                  className: "egbDashTitle91007R4",
                  style: {
                    fontSize: "11px",
                    fontWeight: "900",
                    color: "#EEEAFE",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    lineHeight: "13px"
                  }
                }, "External Display"),
                e("span", {
                  className: "egbDashValue91007R4",
                  style: {
                    fontSize: "10px",
                    fontWeight: "700",
                    color: externalActive ? "#22C55E" : "#9AA4B2",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    lineHeight: "12px",
                    marginTop: "1px"
                  }
                }, adbStatus && adbStatus.installed ? (tvPowerLight && tvPowerLight.tv_name ? tvPowerLight.tv_name : "TV") + " \u00b7 ADB run" : "ADB not installed")
              ),
              // TV power state indicator (shows real TV on/off from ADB)


              // TV settings button (sliders icon, TabMaster style)
              React.createElement(
                Focusable,
                {
                  className: "egbDashDotBtn91008R1 egb-btn-icon",
                  onActivate: function() { setShowTvAccordion(!showTvAccordion); },
                  style: { flex: "0 0 auto", marginLeft: "auto" }
                },
                React.createElement(
                  DialogButton,
                  {
                    className: "egbDashDotBtn91008R1 egb-btn-icon",
                    onClick: function() {
                      setShowTvAccordion(!showTvAccordion);
                      setLast({ ok: true, marker: "FRONTEND_DASHBOARD_TV_GEAR_91007R4", message: "TV accordion toggled" });
                    },
                    onOKButton: function() { setShowTvAccordion(!showTvAccordion); },
                    onOKActionDescription: "Open TV options",
                    style: {
                      height: "36px",
                      width: "36px",
                      minWidth: "36px",
                      padding: "0",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      borderRadius: "50%",
                      border: "1px solid rgba(255,255,255,.13)",
                      background: "linear-gradient(180deg, rgba(54,61,73,.96), rgba(31,36,45,.98))",
                      boxShadow: "0 0 0 1px rgba(255,255,255,.035), 0 8px 16px rgba(0,0,0,.22)",
                      color: "rgba(245,248,255,.96)"
                    }
                  },
                  // Simple lines icon
                  e("svg", {
                    width: "13", height: "13", viewBox: "0 0 24 24",
                    fill: "none", stroke: "currentColor",
                    strokeWidth: "2.5", strokeLinecap: "round"
                  },
                    e("line", { x1: "4", y1: "6", x2: "20", y2: "6" }),
                    e("line", { x1: "4", y1: "12", x2: "20", y2: "12" }),
                    e("line", { x1: "4", y1: "18", x2: "20", y2: "18" })
                  )
                )
              )
            ),

            // TV Control inline panel (toggled by gear in TV row)
            showTvAccordion ? e("div", {
              className: "egb-accordion",
              style: {
                width: "100%",
                boxSizing: "border-box",
                padding: "10px",
                borderRadius: "12px",
                background: "rgba(18,22,32,.88)",
                border: "1px solid rgba(255,255,255,.08)",
                overflow: "hidden"
              }
            },
              e("div", {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "8px"
                }
              },
                e("span", {
                  style: {
                    fontSize: "11px",
                    fontWeight: "900",
                    color: "#EEEAFE",
                    lineHeight: "13px"
                  }
                }, "TV Control"),
                e("span", {
                  style: {
                    fontSize: "10px",
                    fontWeight: "700",
                    color: "#9AA4B2",
                    lineHeight: "12px"
                  }
                }, tvPowerLight && tvPowerLight.tv_name ? tvPowerLight.tv_name + (tvPowerLight.tv_on ? " \u00b7 ON" : " \u00b7 OFF") : "TCL C745")
              ),
              e("div", {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "999px",
                  background: "rgba(255,255,255,.035)",
                  border: "1px solid rgba(255,255,255,.08)",
                  marginBottom: "6px",
                  width: "100%",
                  boxSizing: "border-box"
                }
              },
                e("div", null,
                  React.createElement(Focusable, { className: "egb-tv-btn-wrap", onActivate: function() { doCall("tv_on", {}); } },
                    React.createElement(DialogButton, {
                      className: "egb-btn-primary egb-btn-round",
                      disabled: busy || (last && last.source === "safe-tv-control-health" && last.buttons && last.buttons.tv_on === false),
                      onClick: function() { doCall("tv_on", {}); },
                      onOKButton: function() { doCall("tv_on", {}); },
                      style: { fontSize: "10px", fontWeight: "900", textAlign: "center", whiteSpace: "nowrap" }
                    }, "ON")
                  )
                ),
                e("div", null,
                  React.createElement(Focusable, { className: "egb-tv-btn-wrap", onActivate: function() { doCall("tv_input", {}); } },
                    React.createElement(DialogButton, {
                      className: "egb-btn-primary egb-btn-round",
                      disabled: busy || (last && last.source === "safe-tv-control-health" && last.buttons && last.buttons.hdmi === false),
                      onClick: function() { doCall("tv_input", {}); },
                      onOKButton: function() { doCall("tv_input", {}); },
                      style: { fontSize: "10px", fontWeight: "900", textAlign: "center", whiteSpace: "nowrap" }
                    }, "HDMI")
                  )
                ),
                e("div", null,
                  React.createElement(Focusable, { className: "egb-tv-btn-wrap", onActivate: function() { doCall("tv_off", {}); } },
                    React.createElement(DialogButton, {
                      className: "egb-btn-primary egb-btn-round",
                      disabled: busy || (last && last.source === "safe-tv-control-health" && last.buttons && last.buttons.tv_off === false),
                      onClick: function() { doCall("tv_off", {}); },
                      onOKButton: function() { doCall("tv_off", {}); },
                      style: { fontSize: "10px", fontWeight: "900", textAlign: "center", whiteSpace: "nowrap" }
                    }, "OFF")
                  )
                )
              ),




              // Wi-Fi TV Auto Start toggle
              e(Focusable, {
                className: "egpuProfileRow",
                onActivate: function() {
                  var next = !tvAutoEnabled;
                  setTvAutoEnabled(next);
                  setLast({ ok: true, marker: "FRONTEND_SWITCH_WIFI_TV_AUTO_81304", message: next ? "Wi-Fi TV Auto Start enabled" : "Wi-Fi TV Auto Start disabled" });
                  doCall("set_tv_automation_settings", { tv_control_automation_enabled: next });
                }
              },
                e("div", { style: { width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px", borderRadius: "8px" } },
                  e("span", { className: "egb-label", style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, "Wi-Fi TV Auto Start"),
                  e("span", {
                    className: "egb-toggle " + (tvAutoEnabled ? "egb-toggle-on" : "egb-toggle-off"),
                    onClick: function() {
                      var next = !tvAutoEnabled;
                      setTvAutoEnabled(next);
                      setLast({ ok: true, marker: "FRONTEND_SWITCH_WIFI_TV_AUTO_81304", message: next ? "Wi-Fi TV Auto Start enabled" : "Wi-Fi TV Auto Start disabled" });
                      doCall("set_tv_automation_settings", { tv_control_automation_enabled: next });
                    },
                    style: { width: "40px", height: "22px", borderRadius: "999px", padding: "2px", boxSizing: "border-box", display: "inline-flex", alignItems: "center", justifyContent: tvAutoEnabled ? "flex-end" : "flex-start", flex: "0 0 auto", cursor: "pointer", background: tvAutoEnabled ? "rgba(80,255,150,.28)" : "rgba(255,255,255,.12)", border: tvAutoEnabled ? "1px solid rgba(80,255,150,.70)" : "1px solid rgba(255,255,255,.22)", boxShadow: tvAutoEnabled ? "0 0 7px rgba(80,255,150,.18)" : "none" }
                  },
                    e("span", { style: { width: "16px", height: "16px", borderRadius: "999px", display: "block", background: tvAutoEnabled ? "rgba(130,255,180,.98)" : "rgba(230,235,245,.78)", boxShadow: tvAutoEnabled ? "0 0 8px rgba(80,255,150,.65)" : "0 1px 4px rgba(0,0,0,.35)" } })
                  )
                )
              ),

              // TV IP Input + Save button (bottom of card)
              e("div", {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  padding: "4px 8px",
                  borderRadius: "999px",
                  background: "rgba(255,255,255,.035)",
                  border: "1px solid rgba(255,255,255,.08)",
                  marginTop: "6px",
                  width: "100%",
                  boxSizing: "border-box"
                }
              },
                React.createElement("div", { style: { flex: "1 1 auto", minWidth: "0" } },
                  React.createElement(IpRoller, {
                    value: tvIpInput || "192.168.1.100",
                    onChange: function(val) { setTvIpInput(val); }
                  })
                ),
                React.createElement(Focusable, {
                  className: "egbDashDotBtn91008R1 egb-btn-icon",
                  onActivate: function() {
                    call(serverApi, "save_tv_ip", { ip: tvIpInput }).then(function(res) {
                      setLast({ ok: res && res.ok, source: "save-tv-ip", message: res && res.ok ? "IP saved: " + res.tv_ip : (res && res.error ? res.error : "Error") });
                      if (res && res.ok) setTvIp(res.tv_ip);
                    }).catch(function(err) { setLast({ ok: false, source: "save-tv-ip", error: String(err) }); });
                  }
                },
                  React.createElement(DialogButton, {
                    onClick: function() {
                      call(serverApi, "save_tv_ip", { ip: tvIpInput }).then(function(res) {
                        setLast({ ok: res && res.ok, source: "save-tv-ip", message: res && res.ok ? "IP saved: " + res.tv_ip : (res && res.error ? res.error : "Error") });
                        if (res && res.ok) setTvIp(res.tv_ip);
                      }).catch(function(err) { setLast({ ok: false, source: "save-tv-ip", error: String(err) }); });
                    },
                    style: {
                      height: "34px", width: "34px", minWidth: "34px",
                      padding: "7px", display: "flex", justifyContent: "center", alignItems: "center",
                      borderRadius: "50%",
                      border: "1px solid rgba(255,255,255,.13)",
                      background: "linear-gradient(180deg, rgba(54,61,73,.96), rgba(31,36,45,.98))",
                      boxShadow: "0 0 0 1px rgba(255,255,255,.035), 0 8px 16px rgba(0,0,0,.22)",
                      color: "rgba(245,248,255,.96)"
                    }
                  },
                    // Floppy disk icon
                    e("svg", {
                      width: "18", height: "18", viewBox: "0 0 24 24", fill: "none",
                      xmlns: "http://www.w3.org/2000/svg"
                    },
                      e("path", {
                        d: "M17 3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V7L17 3ZM19 19H5V5H16.17L19 7.83V19ZM12 12C10.34 12 9 13.34 9 15S10.34 18 12 18 15 16.66 15 15 13.66 12 12 12ZM6 6H15V10H6V6Z",
                        fill: "rgba(245,248,255,.96)"
                      })
                    )
                  )
                )
              ),

              // ADB Install / Status (bottom of card)
              e(Focusable, {
                className: "egpuProfileRow",
                onActivate: function() {
                  if (adbInstalling) return;
                  if (adbStatus && adbStatus.installed) return;
                  setAdbInstalling(true);
                  call(serverApi, "install_adb", {}).then(function(res) {
                    setAdbInstalling(false);
                    setLast({ ok: res && res.ok, source: "adb-install", message: res && res.message ? res.message : (res && res.error ? res.error : "Unknown") });
                    call(serverApi, "adb_status", {}).then(function(r) { setAdbStatus(r); }).catch(function() {});
                  }).catch(function(err) {
                    setAdbInstalling(false);
                    setLast({ ok: false, source: "adb-install", error: String(err) });
                  });
                }
              },
                e("div", { style: { width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px", borderRadius: "8px" } },
                  e("span", { className: "egb-label", style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, "ADB"),
                  e("span", { style: { fontSize: "10px", fontWeight: "700", color: adbStatus && adbStatus.installed ? "rgba(80,255,150,.90)" : (adbInstalling ? "rgba(255,210,90,.90)" : "rgba(245,248,255,.50)") } },
                    adbInstalling ? "Installing..." : (adbStatus && adbStatus.installed ? "Installed" : "Install"))
                )
              )

            ) : null,

            // Row 4: GPU Profile + gear
            e("div", {
              className: "egbDashRow91007R4 egb-row",
              style: {
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 12px",
                borderRadius: "10px",
                background: "rgba(255,255,255,.035)",
                border: "1px solid rgba(255,255,255,.08)",
                height: "52px",
                boxSizing: "border-box"
              }
            },
              // Magenta GPU icon
              e("div", {
                className: "egbDashIcon91007R4",
                style: {
                  flex: "0 0 auto",
                  width: "24px",
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#C026D3"
                }
              },
                e("svg", { viewBox: "0 0 24 24", width: "24", height: "24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                  e("rect", { x: "4", y: "4", width: "16", height: "16", rx: "2" }),
                  e("path", { d: "M9 9h6v6H9z" }),
                  e("path", { d: "M9 1v3" }),
                  e("path", { d: "M15 1v3" }),
                  e("path", { d: "M9 20v3" }),
                  e("path", { d: "M15 20v3" }),
                  e("path", { d: "M20 9h3" }),
                  e("path", { d: "M20 14h3" }),
                  e("path", { d: "M1 9h3" }),
                  e("path", { d: "M1 14h3" })
                )
              ),
              e("div", {
                className: "egbDashText91007R4",
                style: {
                  flex: "1 1 auto",
                  minWidth: "0",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden"
                }
              },
                e("span", {
                  className: "egbDashTitle91007R4",
                  style: {
                    fontSize: "11px",
                    fontWeight: "900",
                    color: "#EEEAFE",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    lineHeight: "13px"
                  }
                }, "GPU Profile"),
                e("span", {
                  className: "egbDashValue91007R4",
                  style: {
                    fontSize: "10px",
                    fontWeight: "700",
                    color: "#9AA4B2",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    lineHeight: "12px",
                    marginTop: "1px"
                  }
                }, gpuTuning && gpuTuning.ok ? (gpuTuning.power_cap_w || "?") + "W / " + (gpuTuning.power_cap_max_w || "?") + "W \u00b7 " + (gpuTuning.perf_level || "auto").toUpperCase() : "GPU Tuning")
              ),
              // GPU settings button (sliders icon, TabMaster style)
              React.createElement(
                Focusable,
                {
                  className: "egbDashDotBtn91008R1 egb-btn-icon",
                  onActivate: function() {
                    setShowEgpuAccordion(!showEgpuAccordion);
                  },
                  style: { flex: "0 0 auto", marginLeft: "auto" }
                },
                React.createElement(
                  DialogButton,
                  {
                    className: "egbDashDotBtn91008R1 egb-btn-icon",
                    onClick: function() {
                      setShowEgpuAccordion(!showEgpuAccordion);
                      setLast({ ok: true, marker: "FRONTEND_DASHBOARD_GPU_GEAR_91007R4", message: "eGPU accordion toggled" });
                    },
                    onOKButton: function() {
                      setShowEgpuAccordion(!showEgpuAccordion);
                    },
                    onOKActionDescription: "Open GPU options",
                    style: {
                      height: "36px",
                      width: "36px",
                      minWidth: "36px",
                      padding: "0",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      borderRadius: "50%",
                      border: "1px solid rgba(255,255,255,.13)",
                      background: "linear-gradient(180deg, rgba(54,61,73,.96), rgba(31,36,45,.98))",
                      boxShadow: "0 0 0 1px rgba(255,255,255,.035), 0 8px 16px rgba(0,0,0,.22)",
                      color: "rgba(245,248,255,.96)"
                    }
                  },
                  // Simple lines icon
                  e("svg", {
                    width: "13", height: "13", viewBox: "0 0 24 24",
                    fill: "none", stroke: "currentColor",
                    strokeWidth: "2.5", strokeLinecap: "round"
                  },
                    e("line", { x1: "4", y1: "6", x2: "20", y2: "6" }),
                    e("line", { x1: "4", y1: "12", x2: "20", y2: "12" }),
                    e("line", { x1: "4", y1: "18", x2: "20", y2: "18" })
                  )
                )
              )
            ),

            // EGPU_CENTER_V2: controls + status dashboard
            showEgpuAccordion ? e("div", {
              className: "egb-accordion",
              style: {
                width: "100%",
                boxSizing: "border-box",
                padding: "10px",
                borderRadius: "12px",
                background: "rgba(0,0,0,.12)",
                border: "1px solid rgba(160,190,245,.20)",
                overflow: "hidden"
              }
            },
              // === Section 1.4: GPU Tuning (power cap, fan, perf, profile) ===
              (gpuTuning && gpuTuning.ok) ? e("div", {},
                e("div", {
                  className: "egb-title",
                  style: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", fontWeight: "900", color: "rgba(245,248,255,.94)", marginBottom: "8px", lineHeight: "14px" }
                },
                  e("span", null, gpuTuning && gpuTuning.ok ? (gpuTuning.power_cap_w || "?") + "W / " + (gpuTuning.power_cap_max_w || "?") + "W \u00b7 " + (gpuTuning.perf_level || "auto").toUpperCase() : "GPU Tuning"),
                  e(Focusable, {
                    className: "egpuProfileBtn90501 egb-btn-round egb-refresh-btn",
                    onActivate: function() { tuningLocalRef.current = false; loadGpuTuning(true); },
                    style: {
                      width: "28px", minWidth: "28px", height: "28px",
                      background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)",
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }
                  }, e("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "rgba(255,255,255,.7)", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
                    e("path", { d: "M21 2v6h-6" }),
                    e("path", { d: "M3 12a9 9 0 0 1 15-6.7L21 8" }),
                    e("path", { d: "M3 22v-6h6" }),
                    e("path", { d: "M21 12a9 9 0 0 1-15 6.7L3 16" })
                  ))
                ),

                // --- Active settings + stats ---
                (function() {
                  var perfColors = { auto: "rgba(220,130,255,.85)", high: "rgba(255,80,80,.90)", low: "rgba(80,255,150,.90)", manual: "rgba(255,180,60,.90)" };
                  var profileColors = {
                    "BOOTUP_DEFAULT": "rgba(80,200,255,.90)",
                    "3D_FULL_SCREEN": "rgba(255,80,80,.90)",
                    "POWER_SAVING": "rgba(80,255,150,.90)",
                    "VIDEO": "rgba(255,200,60,.90)",
                    "VR": "rgba(200,130,255,.90)",
                    "COMPUTE": "rgba(255,150,60,.90)",
                    "CUSTOM": "rgba(180,205,245,.60)",
                    "WINDOW_3D": "rgba(100,180,255,.90)"
                  };
                  var perfLevel = (gpuTuning.perf_level || "auto").toLowerCase();
                  var perfColor = perfColors[perfLevel] || "rgba(220,130,255,.85)";
                  var profileName = gpuTuning.active_profile || "";
                  var profileColor = profileColors[profileName] || "rgba(180,205,245,.60)";
                  function formatProfileName(name) {
                    if (name === "BOOTUP_DEFAULT") return "BOOTUP (DEFAULT)";
                    return name.replace(/_/g, " ");
                  }
                  return e("div", {
                    style: {
                      display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px", padding: "8px",
                      borderRadius: "12px", background: "rgba(255,255,255,.035)", border: "1px solid rgba(255,255,255,.08)"
                    }
                  },
                    // Active settings badges
                    e("span", { style: { fontSize: "9px", fontWeight: "700", color: perfColor, padding: "1px 5px", borderRadius: "4px", background: "rgba(255,255,255,.04)" } },
                      "PERF:" + perfLevel.toUpperCase()
                    ),
                    profileName ? e("span", { style: { fontSize: "9px", fontWeight: "700", color: profileColor, padding: "1px 5px", borderRadius: "4px", background: "rgba(255,255,255,.04)" } },
                      "POW:" + formatProfileName(profileName)
                    ) : null,
                    e("span", { style: { fontSize: "9px", fontWeight: "700", color: "rgba(80,200,255,.85)", padding: "1px 5px", borderRadius: "4px", background: "rgba(255,255,255,.04)" } },
                      "CAP:" + (gpuTuning.power_cap_w || "?") + "W"
                    ),
                  // Separator
                  e("span", { style: { width: "1px", background: "rgba(160,190,245,.15)", margin: "0 2px" } }),
                  // Live stats
                  gpuTuning.temp_c !== null ? e("span", { style: { fontSize: "9px", fontWeight: "600", color: "rgba(255,120,120,.80)" } }, gpuTuning.temp_c + "\u00B0C") : null,
                  gpuTuning.power_avg_w !== null ? e("span", { style: { fontSize: "9px", fontWeight: "600", color: "rgba(255,210,90,.75)" } }, gpuTuning.power_avg_w + "W") : null,
                  gpuTuning.gpu_clock_mhz !== null ? e("span", { className: "egb-desc", style: { fontSize: "9px", fontWeight: "600", color: "rgba(180,205,245,.55)" } }, gpuTuning.gpu_clock_mhz + "MHz") : null,
                  gpuTuning.mem_clock_mhz !== null ? e("span", { className: "egb-desc", style: { fontSize: "9px", fontWeight: "600", color: "rgba(180,205,245,.55)" } }, "VRAM" + gpuTuning.mem_clock_mhz) : null
                );
                })(),


                // --- Power Limit ---
                (function() {
                  var capMin = gpuTuning.power_cap_min_w || 50;
                  var capMax = gpuTuning.power_cap_max_w || 400;
                  var capDefault = gpuTuning.power_cap_default_w || gpuTuning.power_cap_w || 0;
                  var capVal = powerCapLocal !== null ? powerCapLocal : capDefault;
                  var capPct = ((capVal - capMin) / (capMax - capMin)) * 100;
                  var isChanged = powerCapLocal !== null && powerCapLocal !== capDefault;
                  return e("div", { style: { marginBottom: "10px", padding: "8px", borderRadius: "12px", background: "rgba(255,255,255,.035)", border: "1px solid rgba(255,255,255,.08)" } },
                    e("div", {
                      style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }
                    },
                      e("span", { className: "egb-label", style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, "Power Limit"),
                      e("span", { style: { fontSize: "11px", fontWeight: "900", color: isChanged ? "rgba(255,210,90,.95)" : "rgba(80,255,150,.90)" } }, capVal + "W")
                    ),
                    e(Focusable, {
                      className: "egpuTuningSlider",
                      onActivate: function() { tuningLocalRef.current = false; gpuSetPowerCap(capVal); },
                      onGamepadDirection: function(ev) {
                        var btn = ev.detail && ev.detail.button;
                        if (btn === 11) { tuningLocalRef.current = true; var nv = Math.max(capMin, capVal - 5); setPowerCapLocal(nv); return true; }
                        if (btn === 12) { tuningLocalRef.current = true; var nv = Math.min(capMax, capVal + 5); setPowerCapLocal(nv); return true; }
                        return false;
                      },
                      style: {
                        display: "flex", alignItems: "center", gap: "6px", padding: "6px 8px",
                        borderRadius: "8px", cursor: "pointer"
                      }
                    },
                      e("span", {
                        className: "egb-desc",
                        style: { fontSize: "9px", fontWeight: "600", color: "rgba(180,205,245,.50)", whiteSpace: "nowrap" }
                      }, capMin + "W"),
                      e("div", { style: { flex: "1", height: "8px", borderRadius: "4px", background: "rgba(255,255,255,.08)", overflow: "hidden", position: "relative" } },
                        e("div", { style: { position: "absolute", left: 0, top: 0, bottom: 0, width: capPct + "%", borderRadius: "4px", background: capPct < 50 ? "linear-gradient(90deg, #22C55E, #22C55E)" : capPct < 75 ? "linear-gradient(90deg, #22C55E, #F59E0B)" : "linear-gradient(90deg, #F59E0B, #EF4444)", transition: "width .15s" } })
                      ),
                      e("span", {
                        className: "egb-desc",
                        style: { fontSize: "9px", fontWeight: "600", color: "rgba(180,205,245,.50)", whiteSpace: "nowrap" }
                      }, capMax + "W")
                    ),
                    e("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" } },
                      isChanged ? e(Focusable, {
                        className: "egpuProfileBtn90501 egb-btn-round",
                        onActivate: function() { tuningLocalRef.current = false; setPowerCapLocal(null); },
                        style: {
                          width: "36px", minWidth: "36px", height: "36px", fontSize: "9px", fontWeight: "700",
                          background: "rgba(255,80,80,.15)", color: "rgba(255,120,120,.90)", border: "1px solid rgba(255,80,80,.25)",
                          display: "flex", alignItems: "center", justifyContent: "center"
                        }
                      }, "RST") : null,
                      e("span", {
                        className: "egb-desc",
                        style: { flex: "1", fontSize: "8px", fontWeight: "600", color: "rgba(180,205,245,.35)", lineHeight: "11px", textAlign: "center" }
                      }, "Too high wattage can damage hardware. Use \u{1F6E1}\uFE0F button for factory default"),
                      e(Focusable, {
                        className: "egpuProfileBtn90501 egb-btn-round egb-refresh-btn",
                        onActivate: function() { tuningLocalRef.current = false; setPowerCapLocal(capDefault); gpuSetPowerCap(capDefault); },
                        style: {
                          width: "36px", minWidth: "36px", height: "36px", fontSize: "8px", fontWeight: "700",
                          background: "rgba(80,200,255,.15)", color: "rgba(80,200,255,.90)", border: "1px solid rgba(80,200,255,.25)",
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1px"
                        }
                      }, e("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "#22C55E", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
                        e("path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" }),
                        e("path", { d: "M9 12l2 2 4-4" })
                      ), capDefault + "W")
                    )
                  );
                })(),

                // --- Performance Level (dropdown) ---
                (function() {
                  var perfLevels = [
                    { id: "auto", label: "AUTO", desc: "Driver manages clocks automatically" },
                    { id: "high", label: "HIGH", desc: "Force maximum clocks, best performance" },
                    { id: "low", label: "LOW", desc: "Force minimum clocks, power saving" },
                    { id: "manual", label: "MANUAL", desc: "Manual control via sysfs" }
                  ];
                  var perfColors = { auto: "rgba(220,130,255,.95)", high: "rgba(255,80,80,.90)", low: "rgba(80,255,150,.90)", manual: "rgba(255,180,60,.90)" };
                  var current = perfLevels.find(function(l) { return l.id === gpuTuning.perf_level; }) || perfLevels[0];
                  return e("div", { style: { marginBottom: "10px" } },
                    e("div", {
                      className: "egb-label",
                      style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)", marginBottom: "4px" }
                    }, "Performance Level"),
                    // Dropdown header (current value)
                    e(Focusable, {
                      className: "egpuProfileBtn90501 egb-refresh-btn",
                      onActivate: function() { setShowPerfDropdown(!showPerfDropdown); },
                      style: {
                        padding: "6px 10px", borderRadius: "8px", marginBottom: showPerfDropdown ? "4px" : "0",
                        background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)",
                        display: "flex", alignItems: "center", justifyContent: "space-between"
                      }
                    },
                      e("div", { style: { display: "flex", alignItems: "center", gap: "8px" } },
                        e("span", { style: { fontSize: "9px", fontWeight: "900", color: perfColors[current.id] || "rgba(180,205,245,.60)" } }, current.label),
                        e("span", { className: "egb-desc", style: { fontSize: "9px", fontWeight: "600", color: "rgba(180,205,245,.45)" } }, current.desc)
                      ),
                      e("span", { style: { fontSize: "10px", color: "rgba(180,205,245,.50)" } }, showPerfDropdown ? "\u25B2" : "\u25BC")
                    ),
                    // Dropdown options
                    showPerfDropdown ? e("div", { style: { display: "flex", flexDirection: "column", gap: "2px", padding: "4px 0" } },
                      perfLevels.filter(function(l) { return l.id !== gpuTuning.perf_level; }).map(function(item) {
                        return e(Focusable, {
                          key: "perf-dd-" + item.id,
                          className: "egpuProfileBtn90501 egb-refresh-btn",
                          onActivate: function() {
                            if (item.id === "manual") {
                              setShowManualWarning(true);
                              setShowPerfDropdown(false);
                            } else {
                              gpuSetPerfLevel(item.id);
                              setShowPerfDropdown(false);
                            }
                          },
                          style: {
                            padding: "5px 10px", borderRadius: "6px",
                            background: "rgba(255,255,255,.03)", border: "1px solid rgba(160,190,245,.08)",
                            display: "flex", alignItems: "center", gap: "8px"
                          }
                        },
                          e("span", { style: { fontSize: "9px", fontWeight: "900", minWidth: "48px", color: perfColors[item.id] || "rgba(180,205,245,.60)" } }, item.label),
                          e("span", { className: "egb-desc", style: { fontSize: "9px", fontWeight: "600", color: "rgba(180,205,245,.40)" } }, item.desc)
                        );
                      })
                    ) : null,
                    // Manual Mode Warning (inside Performance Level card)
                    showManualWarning ? e("div", {
                      style: {
                        marginTop: "6px", padding: "8px", borderRadius: "8px",
                        background: "rgba(255,80,80,.08)", border: "1px solid rgba(255,80,80,.25)"
                      }
                    },
                      e("div", { style: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" } },
                        e("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "#EF4444", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
                          e("path", { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }),
                          e("path", { d: "M12 9v4" }),
                          e("path", { d: "M12 17h.01" })
                        ),
                        e("span", { style: { fontSize: "10px", fontWeight: "900", color: "rgba(255,120,120,.95)" } }, "Manual Mode Warning")
                      ),
                      e("div", { className: "egb-desc", style: { fontSize: "9px", fontWeight: "600", color: "rgba(255,180,180,.75)", lineHeight: "12px", marginBottom: "6px" } },
                        "Direct control over GPU clocks and voltage. Incorrect values can cause crashes or hardware damage."
                      ),
                      e("div", { style: { display: "flex", gap: "6px" } },
                        e(Focusable, {
                          className: "egpuProfileBtn90501 egb-btn-round egb-refresh-btn",
                          onActivate: function() { gpuSetPerfLevel("manual"); setShowManualWarning(false); },
                          style: { width: "28px", minWidth: "28px", height: "28px", background: "rgba(255,80,80,.15)", border: "1px solid rgba(255,80,80,.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: "700", color: "rgba(255,120,120,.90)" }
                        }, "OK"),
                        e(Focusable, {
                          className: "egpuProfileBtn90501 egb-btn-round egb-refresh-btn",
                          onActivate: function() { setShowManualWarning(false); },
                          style: { width: "28px", minWidth: "28px", height: "28px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: "700", color: "rgba(180,205,245,.60)" }
                        }, "NO")
                      )
                    ) : null,
                    // Manual Clocks (inside Performance Level card)
                    gpuTuning.perf_level === "manual" ? (function() {
                      var sclkMax = odClocks && odClocks.sclk_max ? odClocks.sclk_max : 3000;
                      var mclkMax = odClocks && odClocks.mclk_max ? odClocks.mclk_max : 2500;
                      var vddgfxMax = odClocks && odClocks.vddgfx_max ? odClocks.vddgfx_max : 1200;
                      var sclkMin = odClocks && odClocks.sclk_min ? odClocks.sclk_min : 500;
                      var mclkMin = odClocks && odClocks.mclk_min ? odClocks.mclk_min : 500;
                      var vddgfxMin = odClocks && odClocks.vddgfx_min ? odClocks.vddgfx_min : 600;
                      var sclkVal = odSclk !== null ? odSclk : (odClocks && odClocks.sclk && odClocks.sclk[1] ? odClocks.sclk[1].mhz : 0);
                      var mclkVal = odMclk !== null ? odMclk : (odClocks && odClocks.mclk && odClocks.mclk[1] ? odClocks.mclk[1].mhz : 0);
                      var vddgfxVal = odVddgfx !== null ? odVddgfx : (odClocks && odClocks.vddgfx && odClocks.vddgfx[1] ? odClocks.vddgfx[1].mv : 0);

                      function makeSlider(label, val, min, max, unit, setFn) {
                        var pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
                        return e("div", { style: { marginBottom: "4px" } },
                          e("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "2px" } },
                            e("span", { className: "egb-label", style: { fontSize: "9px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, label),
                            e("span", { className: "egb-desc", style: { fontSize: "9px", fontWeight: "700", color: "rgba(245,248,255,.85)" } }, val + unit)
                          ),
                          e(Focusable, {
                            className: "egpuTuningSlider",
                            onActivate: function() { gpuSetOdClocks(true); },
                            onGamepadDirection: function(ev) {
                              var btn = ev.detail && ev.detail.button;
                              var step = unit === "MHz" ? 10 : 5;
                              if (btn === 11) { setFn(Math.max(min, val - step)); return true; }
                              if (btn === 12) { setFn(Math.min(max, val + step)); return true; }
                              return false;
                            },
                            style: { display: "flex", alignItems: "center", gap: "6px", padding: "4px 8px", borderRadius: "8px", cursor: "pointer" }
                          },
                            e("span", { className: "egb-desc", style: { fontSize: "8px", fontWeight: "600", color: "rgba(180,205,245,.40)", whiteSpace: "nowrap" } }, min + unit),
                            e("div", { style: { flex: "1", height: "6px", borderRadius: "3px", background: "rgba(255,255,255,.08)", overflow: "hidden", position: "relative" } },
                              e("div", { style: { position: "absolute", left: 0, top: 0, bottom: 0, width: pct + "%", borderRadius: "3px", background: "linear-gradient(90deg, #22C55E, #F59E0B)", transition: "width .15s" } })
                            ),
                            e("span", { className: "egb-desc", style: { fontSize: "8px", fontWeight: "600", color: "rgba(180,205,245,.40)", whiteSpace: "nowrap" } }, max + unit)
                          )
                        );
                      }

                      return e("div", { style: { marginTop: "6px", padding: "6px", borderRadius: "8px", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" } },
                        e("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" } },
                          e("span", { className: "egb-label", style: { fontSize: "9px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, "Manual Clocks"),
                          e(Focusable, {
                            className: "egpuProfileBtn90501 egb-btn-round egb-refresh-btn",
                            onActivate: function() { gpuSetOdClocks(true); },
                            style: { width: "24px", minWidth: "24px", height: "24px", background: "rgba(80,255,150,.15)", border: "1px solid rgba(80,255,150,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: "900", color: "rgba(80,255,150,.90)" }
                          }, "\u2713")
                        ),
                        makeSlider("GPU Clock", sclkVal, sclkMin, sclkMax, "MHz", function(v) { setOdSclk(v); }),
                        makeSlider("VRAM Clock", mclkVal, mclkMin, mclkMax, "MHz", function(v) { setOdMclk(v); }),
                        makeSlider("Voltage", vddgfxVal, vddgfxMin, vddgfxMax, "mV", function(v) { setOdVddgfx(v); })
                      );
                    })() : null
                  );
                })(),

                // --- Power Profile Mode (dropdown) ---
                (gpuTuning.profiles && gpuTuning.profiles.length > 0) ? (function() {
                  var profileDescs = {
                    "BOOTUP_DEFAULT": "Balanced, applied at boot",
                    "3D_FULL_SCREEN": "Max perf for fullscreen games",
                    "POWER_SAVING": "Max efficiency, lower clocks",
                    "VIDEO": "Video playback optimized",
                    "VR": "Virtual Reality workloads",
                    "COMPUTE": "GPGPU, rendering, AI tasks",
                    "CUSTOM": "Manual freq/limit tuning",
                    "WINDOW_3D": "3D apps in windowed mode"
                  };
                  var profileColors = {
                    "BOOTUP_DEFAULT": "rgba(80,200,255,.90)",
                    "3D_FULL_SCREEN": "rgba(255,80,80,.90)",
                    "POWER_SAVING": "rgba(80,255,150,.90)",
                    "VIDEO": "rgba(255,200,60,.90)",
                    "VR": "rgba(200,130,255,.90)",
                    "COMPUTE": "rgba(255,150,60,.90)",
                    "CUSTOM": "rgba(180,205,245,.60)",
                    "WINDOW_3D": "rgba(100,180,255,.90)"
                  };
                  var profileOrder = ["BOOTUP_DEFAULT", "3D_FULL_SCREEN", "POWER_SAVING", "WINDOW_3D", "COMPUTE", "VR", "VIDEO", "CUSTOM"];
                  function formatProfileName(name) {
                    if (name === "BOOTUP_DEFAULT") return "BOOTUP (DEFAULT)";
                    return name.replace(/_/g, " ");
                  }
                  var sortedProfiles = gpuTuning.profiles.slice().sort(function(a, b) {
                    var ia = profileOrder.indexOf(a.name); if (ia < 0) ia = 99;
                    var ib = profileOrder.indexOf(b.name); if (ib < 0) ib = 99;
                    return ia - ib;
                  });
                  var activeP = gpuTuning.profiles.find(function(p) { return p.name === gpuTuning.active_profile; }) || gpuTuning.profiles[0];
                  var activeDesc = profileDescs[activeP.name] || "";
                  var activeColor = profileColors[activeP.name] || "rgba(180,205,245,.60)";
                  return e("div", { style: { marginBottom: "8px" } },
                    e("div", {
                      className: "egb-label",
                      style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)", marginBottom: "4px" }
                    }, "Power Profile"),
                    // Dropdown header
                    e(Focusable, {
                      className: "egpuProfileBtn90501 egb-refresh-btn",
                      onActivate: function() { setShowProfileDropdown(!showProfileDropdown); },
                      style: {
                        padding: "6px 10px", borderRadius: "8px", marginBottom: showProfileDropdown ? "4px" : "0",
                        background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)",
                        display: "flex", alignItems: "center", justifyContent: "space-between"
                      }
                    },
                      e("div", { style: { display: "flex", alignItems: "center", gap: "8px" } },
                        e("span", { style: { fontSize: "9px", fontWeight: "900", color: activeColor } }, formatProfileName(activeP.name)),
                        activeDesc ? e("span", { className: "egb-desc", style: { fontSize: "9px", fontWeight: "600", color: "rgba(180,205,245,.45)" } }, activeDesc) : null
                      ),
                      e("span", { style: { fontSize: "10px", color: "rgba(180,205,245,.50)" } }, showProfileDropdown ? "\u25B2" : "\u25BC")
                    ),
                    // Dropdown options
                    showProfileDropdown ? e("div", { style: { display: "flex", flexDirection: "column", gap: "2px", padding: "4px 0" } },
                      sortedProfiles.filter(function(p) { return p.name !== gpuTuning.active_profile; }).map(function(p) {
                        var desc = profileDescs[p.name] || "";
                        var color = profileColors[p.name] || "rgba(180,205,245,.60)";
                        return e(Focusable, {
                          key: "pprofile-dd-" + p.index,
                          className: "egpuProfileBtn90501 egb-refresh-btn",
                          onActivate: function() {
                            if (p.name === "CUSTOM") {
                              setShowCustomWarning(true);
                              setShowProfileDropdown(false);
                            } else {
                              gpuSetPowerProfile(p.index);
                              setShowProfileDropdown(false);
                              setCustomActivated(false);
                            }
                          },
                          style: {
                            padding: "5px 10px", borderRadius: "6px",
                            background: "rgba(255,255,255,.03)", border: "1px solid rgba(160,190,245,.08)",
                            display: "flex", alignItems: "center", gap: "8px"
                          }
                        },
                          e("span", { style: { fontSize: "9px", fontWeight: "900", minWidth: "120px", color: color } }, formatProfileName(p.name)),
                          desc ? e("span", { className: "egb-desc", style: { fontSize: "9px", fontWeight: "600", color: "rgba(180,205,245,.40)" } }, desc) : null
                        );
                      })
                    ) : null,
                    // Custom Profile Warning (inside Power Profile card)
                    showCustomWarning ? e("div", {
                      style: {
                        marginTop: "6px", padding: "8px", borderRadius: "8px",
                        background: "rgba(255,180,60,.08)", border: "1px solid rgba(255,180,60,.25)"
                      }
                    },
                      e("div", { style: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" } },
                        e("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "#F59E0B", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
                          e("path", { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }),
                          e("path", { d: "M12 9v4" }),
                          e("path", { d: "M12 17h.01" })
                        ),
                        e("span", { style: { fontSize: "10px", fontWeight: "900", color: "rgba(255,200,100,.95)" } }, "Custom Profile Warning")
                      ),
                      e("div", { className: "egb-desc", style: { fontSize: "9px", fontWeight: "600", color: "rgba(255,210,140,.75)", lineHeight: "12px", marginBottom: "6px" } },
                        "Manual GPU clock and voltage tuning. Incorrect values can cause crashes or hardware damage. Note: MANUAL perf level and CUSTOM profile must be active together."
                      ),
                      e("div", { style: { display: "flex", gap: "6px" } },
                        e(Focusable, {
                          className: "egpuProfileBtn90501 egb-btn-round egb-refresh-btn",
                          onActivate: function() {
                            var customP = gpuTuning.profiles.find(function(p) { return p.name === "CUSTOM"; });
                            if (customP) {
                              gpuSetPerfLevel("manual").then(function() {
                                return gpuSetPowerProfile(customP.index);
                              }).then(function() {
                                setShowCustomWarning(false);
                                setCustomActivated(true);
                              });
                            } else {
                              setLast({ ok: false, error: "CUSTOM profile not found" });
                            }
                          },
                          style: { width: "28px", minWidth: "28px", height: "28px", background: "rgba(255,180,60,.15)", border: "1px solid rgba(255,180,60,.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: "700", color: "rgba(255,200,100,.90)" }
                        }, "OK"),
                        e(Focusable, {
                          className: "egpuProfileBtn90501 egb-btn-round egb-refresh-btn",
                          onActivate: function() { setShowCustomWarning(false); },
                          style: { width: "28px", minWidth: "28px", height: "28px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: "700", color: "rgba(180,205,245,.60)" }
                        }, "NO")
                      )
                    ) : null,
                    // Custom Profile Tuning (inside Power Profile card)
                    (gpuTuning.active_profile === "CUSTOM" || customActivated) && !showCustomWarning ? (function() {
                      var sclkMax = odClocks && odClocks.sclk_max ? odClocks.sclk_max : 3000;
                      var mclkMax = odClocks && odClocks.mclk_max ? odClocks.mclk_max : 2500;
                      var vddgfxMax = odClocks && odClocks.vddgfx_max ? odClocks.vddgfx_max : 1200;
                      var sclkMin = odClocks && odClocks.sclk_min ? odClocks.sclk_min : 500;
                      var mclkMin = odClocks && odClocks.mclk_min ? odClocks.mclk_min : 500;
                      var vddgfxMin = odClocks && odClocks.vddgfx_min ? odClocks.vddgfx_min : 600;
                      var sclkVal = odSclk !== null ? odSclk : (odClocks && odClocks.sclk && odClocks.sclk[1] ? odClocks.sclk[1].mhz : 0);
                      var mclkVal = odMclk !== null ? odMclk : (odClocks && odClocks.mclk && odClocks.mclk[1] ? odClocks.mclk[1].mhz : 0);
                      var vddgfxVal = odVddgfx !== null ? odVddgfx : (odClocks && odClocks.vddgfx && odClocks.vddgfx[1] ? odClocks.vddgfx[1].mv : 0);

                      function makeCustomSlider(label, val, min, max, unit, setFn) {
                        var pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
                        return e("div", { style: { marginBottom: "4px" } },
                          e("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "2px" } },
                            e("span", { className: "egb-label", style: { fontSize: "9px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, label),
                            e("span", { className: "egb-desc", style: { fontSize: "9px", fontWeight: "700", color: "rgba(245,248,255,.85)" } }, val + unit)
                          ),
                          e(Focusable, {
                            className: "egpuTuningSlider",
                            onActivate: function() { gpuSetOdClocks(true); },
                            onGamepadDirection: function(ev) {
                              var btn = ev.detail && ev.detail.button;
                              var step = unit === "MHz" ? 10 : 5;
                              if (btn === 11) { setFn(Math.max(min, val - step)); return true; }
                              if (btn === 12) { setFn(Math.min(max, val + step)); return true; }
                              return false;
                            },
                            style: { display: "flex", alignItems: "center", gap: "6px", padding: "4px 8px", borderRadius: "8px", cursor: "pointer" }
                          },
                            e("span", { className: "egb-desc", style: { fontSize: "8px", fontWeight: "600", color: "rgba(180,205,245,.40)", whiteSpace: "nowrap" } }, min + unit),
                            e("div", { style: { flex: "1", height: "6px", borderRadius: "3px", background: "rgba(255,255,255,.08)", overflow: "hidden", position: "relative" } },
                              e("div", { style: { position: "absolute", left: 0, top: 0, bottom: 0, width: pct + "%", borderRadius: "3px", background: "linear-gradient(90deg, #22C55E, #F59E0B)", transition: "width .15s" } })
                            ),
                            e("span", { className: "egb-desc", style: { fontSize: "8px", fontWeight: "600", color: "rgba(180,205,245,.40)", whiteSpace: "nowrap" } }, max + unit)
                          )
                        );
                      }

                      return e("div", { style: { marginTop: "6px", padding: "6px", borderRadius: "8px", background: "rgba(255,180,60,.06)", border: "1px solid rgba(255,180,60,.12)" } },
                        e("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" } },
                          e("span", { className: "egb-label", style: { fontSize: "9px", fontWeight: "700", color: "rgba(255,200,100,.90)" } }, "Custom Tuning"),
                          e(Focusable, {
                            className: "egpuProfileBtn90501 egb-btn-round egb-refresh-btn",
                            onActivate: function() {
                              gpuSetOdClocks(true).then(function() {
                                var customP = gpuTuning.profiles.find(function(p) { return p.name === "CUSTOM"; });
                                if (customP) return gpuSetPowerProfile(customP.index);
                              }).then(function() {
                                setCustomActivated(false);
                              });
                            },
                            style: { width: "24px", minWidth: "24px", height: "24px", background: "rgba(80,255,150,.15)", border: "1px solid rgba(80,255,150,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: "900", color: "rgba(80,255,150,.90)" }
                          }, "\u2713")
                        ),
                        makeCustomSlider("GPU Clock", sclkVal, sclkMin, sclkMax, "MHz", function(v) { setOdSclk(v); }),
                        makeCustomSlider("VRAM Clock", mclkVal, mclkMin, mclkMax, "MHz", function(v) { setOdMclk(v); }),
                        makeCustomSlider("Voltage", vddgfxVal, vddgfxMin, vddgfxMax, "mV", function(v) { setOdVddgfx(v); })
                      );
                    })() : null
                  );
                })() : null,

              ) : null,

              // === Section 1.5: NVIDIA Driver Management ===
              (function() {
                var vendor = status && status.active_vendor ? status.active_vendor : "auto";
                var nvidiaInstalled = status && status.nvidia_driver_installed;
                var nvidiaSmi = status && status.nvidia_smi;
                var isNvidia = vendor === "nvidia" || (vendor === "auto" && nvidiaInstalled);
                if (!isNvidia && !nvidiaInstalled) return null;
                return e("div", { style: { borderTop: "1px solid rgba(160,190,245,.12)", paddingTop: "8px", marginTop: "4px" } },
                  e("div", {
                    className: "egb-title",
                    style: { fontSize: "12px", fontWeight: "900", color: "rgba(245,248,255,.94)", marginBottom: "6px", lineHeight: "14px" }
                  }, "NVIDIA Driver"),
                  // Install button
                  !nvidiaInstalled ? e(Focusable, {
                    className: "egpuProfileRow",
                    onActivate: function() {
                      setBusy(true);
                      call(serverApi, "nvidia_install_driver", {}).then(function(res) {
                        setLast(res);
                      }).catch(function(err) {
                        setLast({ ok: false, error: String(err) });
                      }).finally(function() { setBusy(false); });
                    }
                  }, e("div", { style: { padding: "4px 6px", fontSize: "10px", fontWeight: "700", color: "rgba(80,255,150,.90)" } }, "Install NVIDIA Driver")) : null,
                  // Uninstall button
                  nvidiaInstalled ? e(Focusable, {
                    className: "egpuProfileRow",
                    onActivate: function() {
                      setBusy(true);
                      call(serverApi, "nvidia_uninstall_driver", {}).then(function(res) {
                        setLast(res);
                      }).catch(function(err) {
                        setLast({ ok: false, error: String(err) });
                      }).finally(function() { setBusy(false); });
                    }
                  }, e("div", { style: { padding: "4px 6px", fontSize: "10px", fontWeight: "700", color: "rgba(255,80,80,.90)" } }, "Uninstall NVIDIA Driver")) : null,
                  // Activate button
                  nvidiaInstalled ? e(Focusable, {
                    className: "egpuProfileRow",
                    onActivate: function() {
                      setBusy(true);
                      call(serverApi, "nvidia_activate", {}).then(function(res) {
                        setLast(res);
                      }).catch(function(err) {
                        setLast({ ok: false, error: String(err) });
                      }).finally(function() { setBusy(false); });
                    }
                  }, e("div", { style: { padding: "4px 6px", fontSize: "10px", fontWeight: "700", color: "rgba(80,200,255,.90)" } }, "Activate eGPU")) : null,
                  // Deactivate button
                  nvidiaInstalled ? e(Focusable, {
                    className: "egpuProfileRow",
                    onActivate: function() {
                      setBusy(true);
                      call(serverApi, "nvidia_deactivate", {}).then(function(res) {
                        setLast(res);
                      }).catch(function(err) {
                        setLast({ ok: false, error: String(err) });
                      }).finally(function() { setBusy(false); });
                    }
                  }, e("div", { className: "egb-label", style: { padding: "4px 6px", fontSize: "10px", fontWeight: "700", color: "rgba(255,210,90,.90)" } }, "Deactivate eGPU")) : null,
                  // nvidia-smi status
                  nvidiaSmi && nvidiaSmi.available ? e("div", { className: "egb-label", style: { padding: "2px 6px", fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)" } },
                    nvidiaSmi.name + (nvidiaSmi.temp_c != null ? " \u00B7 " + nvidiaSmi.temp_c + "\u00B0C" : "")
                  ) : null,
                  // Warning
                  e("div", { className: "egb-desc", style: { padding: "2px 6px", fontSize: "9px", fontWeight: "600", color: "rgba(255,210,90,.50)" } }, "Modifies SteamOS rootfs. System update reverts changes.")
                );
              })(),

              // Section 2: Status — REMOVED (gpuWagon state kept for future use)
            ) : null,


          )
        )
),

        // Other button (unified style)
        e("div", {
          style: {
            width: "100%",
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 12px",
            borderRadius: "10px",
            background: "rgba(255,255,255,.035)",
            border: "1px solid rgba(255,255,255,.08)",
            overflow: "hidden",
            marginBottom: "6px",
            height: "52px"
          }
        },
          e("span", { style: { flex: "1 1 auto", fontSize: "10px", fontWeight: "900", color: "rgba(245,248,255,.94)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "Other"),
          React.createElement(
            Focusable,
            {
              className: "egbDashDotBtn91008R1",
              onActivate: function() { setShowOtherAccordion(!showOtherAccordion); },
              style: { flex: "0 0 auto", marginLeft: "auto" }
            },
            React.createElement(
              DialogButton,
              {
                className: "egbDashDotBtn91008R1",
                onClick: function() {
                  setShowOtherAccordion(!showOtherAccordion);
                  setLast({ ok: true, marker: "FRONTEND_TOGGLE_OTHER_91008R1", message: showOtherAccordion ? "Other collapsed" : "Other expanded" });
                },
                onOKButton: function() { setShowOtherAccordion(!showOtherAccordion); },
                onOKActionDescription: showOtherAccordion ? "Collapse Other" : "Expand Other",
                style: {
                  height: "36px",
                  width: "36px",
                  minWidth: "36px",
                  padding: "0",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  borderRadius: "50%",
                  border: "1px solid rgba(255,255,255,.13)",
                  background: "linear-gradient(180deg, rgba(54,61,73,.96), rgba(31,36,45,.98))",
                  boxShadow: "0 0 0 1px rgba(255,255,255,.035), 0 8px 16px rgba(0,0,0,.22)",
                  color: "rgba(245,248,255,.96)"
                }
              },
              e("svg", { viewBox: "0 0 24 24", width: "20", height: "20", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
                showOtherAccordion ? e("polyline", { points: "6 15 12 9 18 15" }) : e("polyline", { points: "6 9 12 15 18 9" })
              )
            )
          )
        ),

    // UI_SKETCH_ACCORDION_DASHBOARD_91007R4: TV Control now inline in dashboard
    false && showTvAccordion ? React.createElement(
          PanelSection,
          { title: "3. TV Control" },

          // UI_TV_CONTROL_VISIBLE_LABELS_91006R9 UI_TV_CONTROL_LABEL_CENTER_91006R8B UI_TV_CONTROL_COMPACT_3_BUTTON_ROW_91006R8
          e("div", {
            className: "egb-accordion",
            style: {
              width: "100%",
              boxSizing: "border-box",
              marginTop: "6px",
              marginBottom: "10px",
              padding: "10px",
              borderRadius: "14px",
              background: "rgba(0,0,0,.12)",
              border: "1px solid rgba(100,155,255,.40)",
              overflow: "hidden"
            }
          },

            e("div", {
              style: {
                width: "100%",
                boxSizing: "border-box",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "4px",
                marginBottom: "8px"
              }
            },
              e("div", {
                style: {
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start"
                }
              },
                e("span", {
                  style: {
                    fontSize: "12px",
                    fontWeight: "900",
                    lineHeight: "14px",
                    color: "rgba(245,248,255,.94)"
                  }
                }, "Optional helper"),
                e("span", {
                  style: {
                    marginTop: "2px",
                    fontSize: "10px",
                    fontWeight: "800",
                    lineHeight: "11px",
                    color: "rgba(190,205,235,.78)"
                  }
                }, "ADB / WoL / CEC")
              )
            ),

            // TV Control toggle removed - gear in dashboard controls visibility (91007R4)

            React.createElement(
              PanelSectionRow,
              null,
              e("div", {
                  className: "egbTvMiniRow91006R13B",
                style: {
                  width: "100%",
                  maxWidth: "100%",
                  minWidth: "0",
                  boxSizing: "border-box",
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)",
                  gap: "5px",
                  marginTop: "4px",
                  marginBottom: "6px",
                  overflow: "visible"
                }
              },

                e("div", {
                    className: "egbTvMiniCell91006R13B",
                  style: {
                    minWidth: "0",
                    maxWidth: "100%",
                    overflow: "visible"
                  }
                },
                  React.createElement(
                    GamepadButton,
                    {
                      disabled: busy || (last && last.source === "safe-tv-control-health" && last.buttons && last.buttons.tv_on === false),
                      onClick: function() { doCall("tv_on", {}); },
                      style: {
                        width: "100%",
                        minWidth: "0",
                        maxWidth: "100%",
                        height: "34px",
                        minHeight: "34px",
                        boxSizing: "border-box",
                        padding: "0",
                        borderRadius: "8px",
                        overflow: "visible",
                        fontSize: "9px",
                        fontWeight: "900",
                        lineHeight: "12px",
                        textAlign: "center",
                        whiteSpace: "nowrap"
                      }
                    },
                    "ON"
                  )
                ),

                e("div", {
                    className: "egbTvMiniCell91006R13B",
                  style: {
                    minWidth: "0",
                    maxWidth: "100%",
                    overflow: "visible"
                  }
                },
                  React.createElement(
                    GamepadButton,
                    {
                      disabled: busy || (last && last.source === "safe-tv-control-health" && last.buttons && last.buttons.hdmi === false),
                      onClick: function() { doCall("tv_input", {}); },
                      style: {
                        width: "100%",
                        minWidth: "0",
                        maxWidth: "100%",
                        height: "34px",
                        minHeight: "34px",
                        boxSizing: "border-box",
                        padding: "0",
                        borderRadius: "8px",
                        overflow: "visible",
                        fontSize: "9px",
                        fontWeight: "900",
                        lineHeight: "12px",
                        textAlign: "center",
                        whiteSpace: "nowrap"
                      }
                    },
                    "HDMI"
                  )
                ),

                e("div", {
                    className: "egbTvMiniCell91006R13B",
                  style: {
                    minWidth: "0",
                    maxWidth: "100%",
                    overflow: "visible"
                  }
                },
                  React.createElement(
                    GamepadButton,
                    {
                      disabled: busy || (last && last.source === "safe-tv-control-health" && last.buttons && last.buttons.tv_off === false),
                      onClick: function() { doCall("tv_off", {}); },
                      style: {
                        width: "100%",
                        minWidth: "0",
                        maxWidth: "100%",
                        height: "34px",
                        minHeight: "34px",
                        boxSizing: "border-box",
                        padding: "0",
                        borderRadius: "8px",
                        overflow: "visible",
                        fontSize: "9px",
                        fontWeight: "900",
                        lineHeight: "12px",
                        textAlign: "center",
                        whiteSpace: "nowrap"
                      }
                    },
                    "OFF"
                  )
                )
              )
            ),

            React.createElement(
              PanelSectionRow,
              null,
              React.createElement(
                GamepadButton,
                {
                  disabled: busy,
                  onClick: function() {
                    setLast({
                      ok: true,
                      marker: "FRONTEND_CLICK_TV_CONTROL_STATUS_9020303",
                      message: "TV Control status click reached React handler"
                    });
                    doCall("tv_control_health", {});
                  },
                  style: {
                    width: "100%",
                    minWidth: "0",
                    maxWidth: "100%",
                    minHeight: "34px",
                    boxSizing: "border-box",
                    padding: "6px 8px",
                    borderRadius: "9px",
                    overflow: "visible",
                    fontSize: "12px",
                    fontWeight: "900",
                    textAlign: "center",
                    whiteSpace: "nowrap"
                  }
                },
                "Check TV Control status"
              )
            )
          )
        ) : null,

        // OTHER accordion: Recovery/Safety + Diagnostics
        showOtherAccordion ? e("div", {
              className: "egbOtherAccordion91008R1 egb-accordion",
              style: {
                width: "100%",
                boxSizing: "border-box",
                padding: "10px",
                borderRadius: "12px",
                background: "rgba(0,0,0,.12)",
                border: "1px solid rgba(160,190,245,.20)",
                overflow: "hidden"
              }
            },

        // Section: Recovery / Safety
        e("div", {
          className: "egb-title",
          style: { fontSize: "12px", fontWeight: "900", color: "rgba(245,248,255,.94)", marginBottom: "6px", lineHeight: "14px" }
        }, "Recovery / Safety"),

        // Recovery Hotkey toggle
        e(Focusable, {
          className: "egpuProfileRow",
          onActivate: function() {
            var next = !hotkeysEnabled;
            setHotkeysEnabled(next);
            setLast({ ok: true, marker: "FRONTEND_SWITCH_HOTKEYS_81304", message: next ? "Recovery Hotkey enabled" : "Recovery Hotkey disabled" });
            doCall("set_hotkey_settings", { hotkeys_enabled: next });
          }
        },
          e("div", { style: { width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", padding: "4px 6px", borderRadius: "8px" } },
            e("span", { className: "egb-label", style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, "Recovery Hotkey"),
            e("span", {
              className: "egb-toggle " + (hotkeysEnabled ? "egb-toggle-on" : "egb-toggle-off"),
              onClick: function() {
                var next = !hotkeysEnabled;
                setHotkeysEnabled(next);
                setLast({ ok: true, marker: "FRONTEND_SWITCH_HOTKEYS_81304", message: next ? "Recovery Hotkey enabled" : "Recovery Hotkey disabled" });
                doCall("set_hotkey_settings", { hotkeys_enabled: next });
              },
              style: { width: "40px", height: "22px", borderRadius: "999px", padding: "2px", boxSizing: "border-box", display: "inline-flex", alignItems: "center", justifyContent: hotkeysEnabled ? "flex-end" : "flex-start", flex: "0 0 auto", cursor: "pointer", background: hotkeysEnabled ? "rgba(80,255,150,.28)" : "rgba(255,255,255,.12)", border: hotkeysEnabled ? "1px solid rgba(80,255,150,.70)" : "1px solid rgba(255,255,255,.22)", boxShadow: hotkeysEnabled ? "0 0 7px rgba(80,255,150,.18)" : "none" }
            },
              e("span", { style: { width: "16px", height: "16px", borderRadius: "999px", display: "block", background: hotkeysEnabled ? "rgba(130,255,180,.98)" : "rgba(230,235,245,.78)", boxShadow: hotkeysEnabled ? "0 0 8px rgba(80,255,150,.65)" : "0 1px 4px rgba(0,0,0,.35)" } })
            )
          )
        ),

        // Safe Unplug button
        e(Focusable, {
          className: "egpuProfileRow",
          onActivate: function() { doCall("prepare_for_unplug", {}); }
        },
          e("div", { style: { width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", padding: "4px 6px", borderRadius: "8px" } },
            e("span", { className: "egb-label", style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, "Safe Unplug"),
            e("span", { style: { fontSize: "10px", fontWeight: "700", color: "rgba(245,248,255,.50)" } }, "Eject eGPU")
          )
        ),

        // Restore Internal button
        e(Focusable, {
          className: "egpuProfileRow",
          onActivate: function() { doCall("restore_internal_mode", { restart: true }); }
        },
          e("div", { style: { width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", padding: "4px 6px", borderRadius: "8px" } },
            e("span", { className: "egb-label", style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, "Restore Internal"),
            e("span", { style: { fontSize: "10px", fontWeight: "700", color: "rgba(245,248,255,.50)" } }, "Force iGPU")
          )
        ),

        // Reapply TV Mode button
        e(Focusable, {
          className: "egpuProfileRow",
          onActivate: function() { applyExternalCurrent(); }
        },
          e("div", { style: { width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", padding: "4px 6px", borderRadius: "8px" } },
            e("span", { className: "egb-label", style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, "Reapply TV Mode"),
            e("span", { style: { fontSize: "10px", fontWeight: "700", color: "rgba(245,248,255,.50)" } }, "4K@60")
          )
        ),

        // Fallback 1080p60 button
        e(Focusable, {
          className: "egpuProfileRow",
          onActivate: function() {
            setSelectedMode({ width: 1920, height: 1080, refresh: 60, label: "1920x1080 @ 60Hz" });
            setShowModeList(false);
            doCall("apply_egpu_mode", { restart: true, width: 1920, height: 1080, refresh: 60 });
          }
        },
          e("div", { style: { width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", padding: "4px 6px", borderRadius: "8px" } },
            e("span", { className: "egb-label", style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, "Fallback 1080p60"),
            e("span", { style: { fontSize: "10px", fontWeight: "700", color: "rgba(245,248,255,.50)" } }, "Safe mode")
          )
        ),

        // Section: Diagnostics
        e("div", {
          className: "egb-title",
          style: { fontSize: "12px", fontWeight: "900", color: "rgba(245,248,255,.94)", marginBottom: "6px", lineHeight: "14px", borderTop: "1px solid rgba(160,190,245,.12)", paddingTop: "8px" }
        }, "Diagnostics"),

        // Collect Diagnostics button
        e(Focusable, {
          className: "egpuProfileRow",
          onActivate: function() {
            if (diagLoading) return;
            setDiagLoading(true);
            call(serverApi, "collect_diagnostics", {}).then(function(res) {
              setDiagLoading(false);
              setDiagnostics(res);
              setLast({ ok: res && res.ok, source: "diagnostics", message: "Diagnostics collected" });
            }).catch(function(err) {
              setDiagLoading(false);
              setLast({ ok: false, source: "diagnostics", error: String(err) });
            });
          }
        },
          e("div", { style: { width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", padding: "4px 6px", borderRadius: "8px" } },
            e("span", { className: "egb-label", style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, "Collect Device Info"),
            e("span", { style: { fontSize: "10px", fontWeight: "700", color: diagLoading ? "rgba(255,210,90,.90)" : "rgba(245,248,255,.50)" } }, diagLoading ? "Collecting..." : "Run")
          )
        ),
        // Diagnostics summary
        diagnostics ? e("div", {
          className: "egb-label",
          style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)", padding: "0 6px 6px", lineHeight: "16px" }
        },
          e("div", null, "CPU: " + (diagnostics.cpu || "?")),
          e("div", null, "RAM: " + (diagnostics.ram || "?")),
          e("div", null, "GPU: " + (diagnostics.gpus ? diagnostics.gpus.length + " device(s)" : "?")),
          e("div", null, "ADB: " + (diagnostics.adb && diagnostics.adb.installed ? "Yes" : "No")),
          e("div", null, "Errors in log: " + (diagnostics.log_errors != null ? diagnostics.log_errors : "?")),
          e("div", null, "Warnings in log: " + (diagnostics.log_warnings != null ? diagnostics.log_warnings : "?"))
        ) : null,

        // TV Control Health button
        e(Focusable, {
          className: "egpuProfileRow",
          onActivate: function() { doCall("tv_control_health", {}); call(serverApi, "tv_power_light", {}).then(function(res) { setTvPowerLight(res); }).catch(function() {}); }
        },
          e("div", { style: { width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", padding: "4px 6px", borderRadius: "8px" } },
            e("span", { className: "egb-label", style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, "TV Control Health"),
            e("span", { style: { fontSize: "10px", fontWeight: "700", color: "rgba(245,248,255,.50)" } }, "Check")
          )
        ),

        // Recent Events button
        e(Focusable, {
          className: "egpuProfileRow",
          onActivate: function() { loadRecentEvents(); }
        },
          e("div", { style: { width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", padding: "4px 6px", borderRadius: "8px" } },
            e("span", { className: "egb-label", style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, "Recent Events"),
            e("span", { style: { fontSize: "10px", fontWeight: "700", color: "rgba(245,248,255,.50)" } }, "Last 10 events")
          )
        ),

        // Debug Info toggle
        e(Focusable, {
          className: "egpuProfileRow",
          onActivate: function() {
            var next = !showDebug;
            setShowDebug(next);
            setLast({ ok: true, marker: "FRONTEND_TOGGLE_DEBUG_INFO_81319_TEMPLATE", message: next ? "Debug info shown" : "Debug info hidden" });
          }
        },
          e("div", { style: { width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", padding: "4px 6px", borderRadius: "8px" } },
            e("span", { className: "egb-label", style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, "Debug Info"),
            e("span", {
              onClick: function() {
                var next = !showDebug;
                setShowDebug(next);
                setLast({ ok: true, marker: "FRONTEND_TOGGLE_DEBUG_INFO_81319_TEMPLATE", message: next ? "Debug info shown" : "Debug info hidden" });
              },
              className: "egb-toggle " + (showDebug ? "egb-toggle-on" : "egb-toggle-off"),
              style: { width: "40px", height: "22px", borderRadius: "999px", padding: "2px", boxSizing: "border-box", display: "inline-flex", alignItems: "center", justifyContent: showDebug ? "flex-end" : "flex-start", flex: "0 0 auto", cursor: "pointer", background: showDebug ? "rgba(80,255,150,.28)" : "rgba(255,255,255,.12)", border: showDebug ? "1px solid rgba(80,255,150,.70)" : "1px solid rgba(255,255,255,.22)", boxShadow: showDebug ? "0 0 7px rgba(80,255,150,.18)" : "none" }
            },
              e("span", { style: { width: "16px", height: "16px", borderRadius: "999px", display: "block", background: showDebug ? "rgba(130,255,180,.98)" : "rgba(230,235,245,.78)", boxShadow: showDebug ? "0 0 8px rgba(80,255,150,.65)" : "0 1px 4px rgba(0,0,0,.35)" } })
            )
          )
        )

        ) : null,  // end showOtherAccordion wrapper

        eventLog ? React.createElement(
        PanelSection,
        { title: "Recent events" },
        React.createElement(PanelSectionRow, null, Pre({ obj: eventLog, maxHeight: "260px" }))
      ) : null,

    showDebug ? React.createElement(
      PanelSection,
      { title: "Gamescope" },
      React.createElement(PanelSectionRow, null, Pre({ obj: gamescope || "no gamescope data", maxHeight: "120px" }))
    ) : null,

    showDebug ? React.createElement(
      PanelSection,
      { title: "Last result" },
      React.createElement(PanelSectionRow, null, Pre({ obj: last || "no action yet", maxHeight: "180px" }))
    ) : null
  );
}


if (!React || !React.createElement) {
  throw new Error("React not found");
}

function definePlugin(serverApi) {
  return {
    titleView: React.createElement(
      Focusable,
      {
        style: { display: "flex", padding: "0", flex: "auto", boxShadow: "none" },
        className: "quickaccessmenu_TitleView_3VRtw"
      },
      React.createElement("div", { style: { marginRight: "auto" } }, "eGPUBridge"),
      React.createElement(
        DialogButton,
        {
          onOKActionDescription: "Select TV Mode",
          style: {
            height: "28px",
            width: "40px",
            minWidth: 0,
            padding: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
          },
          onClick: function() {
            if (typeof window.__egpuToggleTvMode === "function") {
              window.__egpuToggleTvMode();
            }
          }
        },
        // Settings Display SVG: monitor + small gear
        e("svg", {
          width: "16", height: "16", viewBox: "0 0 24 24",
          fill: "none", stroke: "currentColor",
          strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round"
        },
          e("rect", { x: "2", y: "3", width: "15", height: "11", rx: "1.5" }),
          e("line", { x1: "6", y1: "18", x2: "13", y2: "18" }),
          e("line", { x1: "9.5", y1: "14", x2: "9.5", y2: "18" }),
          e("circle", { cx: "18.5", cy: "16.5", r: "2.5", strokeWidth: "1.5" }),
          e("line", { x1: "18.5", y1: "14", x2: "18.5", y2: "13.5", strokeWidth: "1.3" }),
          e("line", { x1: "18.5", y1: "19.5", x2: "18.5", y2: "19", strokeWidth: "1.3" }),
          e("line", { x1: "16", y1: "16.5", x2: "15.5", y2: "16.5", strokeWidth: "1.3" }),
          e("line", { x1: "21.5", y1: "16.5", x2: "21", y2: "16.5", strokeWidth: "1.3" })
        )
      ),
      // Safe Disconnect eGPU button — classic eject icon
      React.createElement(
        DialogButton,
        {
          onOKActionDescription: "Safe Disconnect eGPU",
          style: {
            height: "28px",
            width: "40px",
            minWidth: 0,
            padding: 0,
            marginLeft: "4px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
          },
          onClick: function() {
            doCall("safe_disconnect", {});
          }
        },
        e("svg", {
          width: "16", height: "16", viewBox: "0 0 24 24",
          fill: "none", stroke: "currentColor",
          strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round"
        },
          // Arrow pointing up
          e("polyline", { points: "6,14 12,8 18,14" }),
          // Base line (tray)
          e("line", { x1: "4", y1: "20", x2: "20", y2: "20" })
        )
      )
    ),
    content: React.createElement(App, { serverApi: serverApi }),
    icon: React.createElement(
      "svg",
      {
        viewBox: "0 0 24 24",
        width: "20",
        height: "20",
        fill: "none",
        style: { color: "rgba(245,248,255,.96)" }
      },

      React.createElement("path", {
        d: "M4.6 8.2H18.1C19.05 8.2 19.8 8.95 19.8 9.9V15.6C19.8 16.55 19.05 17.3 18.1 17.3H4.6C3.65 17.3 2.9 16.55 2.9 15.6V9.9C2.9 8.95 3.65 8.2 4.6 8.2Z",
        fill: "currentColor"
      }),

      React.createElement("path", {
        d: "M2.7 8.9H1.5V16.6H2.7",
        stroke: "currentColor",
        strokeWidth: "1.35",
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }),

      React.createElement("path", {
        d: "M1.55 10.3H.85V11.7H1.55",
        stroke: "currentColor",
        strokeWidth: "1.15",
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }),

      React.createElement("path", {
        d: "M1.55 13.8H.85V15.2H1.55",
        stroke: "currentColor",
        strokeWidth: "1.15",
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }),

      React.createElement("circle", {
        cx: "11.3",
        cy: "12.75",
        r: "3.8",
        fill: "rgba(18,22,28,.96)"
      }),

      React.createElement("circle", {
        cx: "11.3",
        cy: "12.75",
        r: "3.25",
        stroke: "currentColor",
        strokeWidth: ".95"
      }),

      React.createElement("circle", {
        cx: "11.3",
        cy: "12.75",
        r: ".72",
        fill: "currentColor"
      }),

      React.createElement("path", {
        d: "M11.3 9.65C12.25 10.05 12.65 10.75 12.35 11.55C11.72 11.17 11.25 10.65 11.3 9.65Z",
        fill: "currentColor"
      }),

      React.createElement("path", {
        d: "M14.15 11.5C13.95 12.52 13.35 13.05 12.5 12.95C12.72 12.23 13.18 11.7 14.15 11.5Z",
        fill: "currentColor"
      }),

      React.createElement("path", {
        d: "M13.05 15.15C12.1 15.55 11.35 15.35 10.95 14.6C11.7 14.45 12.4 14.55 13.05 15.15Z",
        fill: "currentColor"
      }),

      React.createElement("path", {
        d: "M9.05 14.25C8.45 13.4 8.45 12.65 9.05 12.05C9.45 12.72 9.55 13.42 9.05 14.25Z",
        fill: "currentColor"
      }),

      React.createElement("path", {
        d: "M9.05 10.65C10.0 10.25 10.75 10.45 11.15 11.2C10.4 11.35 9.7 11.25 9.05 10.65Z",
        fill: "currentColor"
      }),

      React.createElement("path", {
        d: "M5.2 9.35L4.1 10.7V14.95L5.2 16.15",
        stroke: "rgba(18,22,28,.96)",
        strokeWidth: ".85",
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }),

      React.createElement("path", {
        d: "M17.0 11.4H18.4",
        stroke: "rgba(18,22,28,.96)",
        strokeWidth: ".8",
        strokeLinecap: "round"
      }),
      React.createElement("path", {
        d: "M17.0 12.85H18.4",
        stroke: "rgba(18,22,28,.96)",
        strokeWidth: ".8",
        strokeLinecap: "round"
      }),
      React.createElement("path", {
        d: "M17.0 14.3H18.4",
        stroke: "rgba(18,22,28,.96)",
        strokeWidth: ".8",
        strokeLinecap: "round"
      }),

      React.createElement("path", {
        d: "M6.8 17.55V18.45",
        stroke: "currentColor",
        strokeWidth: ".95",
        strokeLinecap: "round"
      }),
      React.createElement("path", {
        d: "M8.0 17.55V18.45",
        stroke: "currentColor",
        strokeWidth: ".95",
        strokeLinecap: "round"
      }),
      React.createElement("path", {
        d: "M9.2 17.55V18.45",
        stroke: "currentColor",
        strokeWidth: ".95",
        strokeLinecap: "round"
      }),
      React.createElement("path", {
        d: "M10.4 17.55V18.45",
        stroke: "currentColor",
        strokeWidth: ".95",
        strokeLinecap: "round"
      }),
      React.createElement("path", {
        d: "M11.6 17.55V18.45",
        stroke: "currentColor",
        strokeWidth: ".95",
        strokeLinecap: "round"
      }),
      React.createElement("path", {
        d: "M12.8 17.55V18.45",
        stroke: "currentColor",
        strokeWidth: ".95",
        strokeLinecap: "round"
      }),

      React.createElement("circle", {
        cx: "4.2",
        cy: "9.65",
        r: ".32",
        fill: "rgba(18,22,28,.96)"
      }),
      React.createElement("circle", {
        cx: "18.45",
        cy: "9.65",
        r: ".32",
        fill: "rgba(18,22,28,.96)"
      }),
      React.createElement("circle", {
        cx: "18.45",
        cy: "15.85",
        r: ".32",
        fill: "rgba(18,22,28,.96)"
      })
    ),
      onDismount: function() {}
  };
}

window.eGPUBridgePlugin = definePlugin;

// HOTKEY_UI_BUTTONS_81109
