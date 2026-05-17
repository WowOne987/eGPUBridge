// eGPUBridge v0.7.27 - gamepad friendly frontend using Decky/Steam ButtonItem. WAGON_UI_SKELETON_90004 ROUTE_STATUS_WAGON_90101 GPU_PROFILES_WAGON_UI_90202R1 GPU_WAGON_STATE_9020302 GPU_POLISH_TVCHECK_9020303 AMD_CAPABILITY_UI_90302R1 GPU_POLICY_UI_90304 GPU_ACTIONS_UI_90402R1 GPU_PROFILE_UI_90501B UI_SHELL_GPU_BEFORE_RECOVERY_90602R2 UI_SHELL_RENAME_GPU_CENTER_9060302 UI_SHELL_REMOVED_HOTKEY_MINI_9060303 UI_SHELL_REPAIR_GPU_CENTER_BOUNDARIES_9060304R1 UI_SHELL_REMOVED_DUPLICATE_TV_CHECK_9060305 UI_GPU_HEADERS_90702 UI_REMOVE_EMPTY_DIAGNOSTICS_ROW_90703 UI_TV_CONTROL_REAL_SECTION_90802R1 UI_RENAME_EGPU_CENTER_90803 UI_VARIANT_C_MAIN_DISPLAY_COMPACT_90902

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
        fontSize: "10px",
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
  var outputLabel = props.connector ? props.connector.name : "none";
  var patchLabel = props.patch && props.patch.has_prefer_vk_9070 ? "TV/eGPU active" : "Internal/default";

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

  var tvControlState = React.useState(false);
  var showTvControl = tvControlState[0];
  var setShowTvControl = tvControlState[1];

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

    var tvHealthState = React.useState(null);
    var tvHealth = tvHealthState[0];
    var setTvHealth = tvHealthState[1];

    // GPU_WAGON_STATE_9020302
    var gpuWagonState = React.useState(null);
    var gpuWagon = gpuWagonState[0];
    var setGpuWagon = gpuWagonState[1];

    var gpuWagonLoadingState = React.useState(false);
    var gpuWagonLoading = gpuWagonLoadingState[0];
    var setGpuWagonLoading = gpuWagonLoadingState[1];

    var gpuWagonUpdatedState = React.useState(null);
    var gpuWagonUpdated = gpuWagonUpdatedState[0];
    var setGpuWagonUpdated = gpuWagonUpdatedState[1];

    // AMD_CAPABILITY_UI_90302R1
    var amdCapabilityState = React.useState(null);
    var amdCapability = amdCapabilityState[0];
    var setAmdCapability = amdCapabilityState[1];

    var amdCapabilityLoadingState = React.useState(false);
    var amdCapabilityLoading = amdCapabilityLoadingState[0];
    var setAmdCapabilityLoading = amdCapabilityLoadingState[1];

    // GPU_POLICY_UI_90304
    var gpuPolicyState = React.useState(null);
    var gpuPolicy = gpuPolicyState[0];
    var setGpuPolicy = gpuPolicyState[1];

    var gpuPolicyLoadingState = React.useState(false);
    var gpuPolicyLoading = gpuPolicyLoadingState[0];
    var setGpuPolicyLoading = gpuPolicyLoadingState[1];

    // GPU_ACTIONS_UI_90402R1
    var gpuActionsState = React.useState(null);

    // GPU_PROFILE_UI_90501B
    var gpuProfilesState = React.useState(null);
    var gpuProfiles = gpuProfilesState[0];
    var setGpuProfiles = gpuProfilesState[1];

    var gpuProfilesLoadingState = React.useState(false);
    var gpuProfilesLoading = gpuProfilesLoadingState[0];
    var setGpuProfilesLoading = gpuProfilesLoadingState[1];

    var gpuActions = gpuActionsState[0];
    var setGpuActions = gpuActionsState[1];

    var gpuActionsLoadingState = React.useState(false);
    var gpuActionsLoading = gpuActionsLoadingState[0];
    var setGpuActionsLoading = gpuActionsLoadingState[1];

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



    function loadGpuProfiles90501B() {
      setGpuProfilesLoading(true);

      call(serverApi, "gpu_profile_wagon", {}).then(function(res) {
        setGpuProfiles(res);

        setLast({
          ok: !!(res && res.ok),
          source: "gpu-profile-ui",
          message: res && res.label ? res.label : "GPU profiles updated"
        });

      }).catch(function(err) {

        var fail = {
          ok: false,
          source: "gpu-profile-ui",
          error: String(err)
        };

        setGpuProfiles(fail);
        setLast(fail);

      }).finally(function() {
        setGpuProfilesLoading(false);
      });
    }

    function applyGpuProfile90501B(profileId, label) {

      setBusy(true);

      setLast({
        ok: true,
        source: "gpu-profile-ui",
        message: label + " requested"
      });

      call(serverApi, "gpu_apply_profile", {
        profile: profileId
      }).then(function(res) {

        setLast(res);

        return call(serverApi, "gpu_profile_wagon", {});

      }).then(function(profileReport) {

        setGpuProfiles(profileReport);

        return call(serverApi, "gpu_actions_wagon", {});

      }).then(function(actionsReport) {

        setGpuActions(actionsReport);

        return call(serverApi, "gpu_policy_wagon", {});

      }).then(function(policyReport) {

        setGpuPolicy(policyReport);

      }).catch(function(err) {

        setLast({
          ok: false,
          source: "gpu-profile-ui",
          error: String(err)
        });

      }).finally(function() {
        setBusy(false);
      });
    }

    function loadGpuActions90402R1() {
      setGpuActionsLoading(true);
      call(serverApi, "gpu_actions_wagon", {}).then(function(res) {
        setGpuActions(res);
        setLast({
          ok: !!(res && res.ok),
          source: "gpu-actions-ui",
          message: res && res.label ? res.label : "GPU actions status updated"
        });
      }).catch(function(err) {
        var fail = { ok: false, source: "gpu-actions-ui", error: String(err) };
        setGpuActions(fail);
        setLast(fail);
      }).finally(function() {
        setGpuActionsLoading(false);
      });
    }

    function runGpuAction90402R1(method, label) {
      setBusy(true);
      setLast({
        ok: true,
        source: "gpu-actions-ui",
        message: label + " requested"
      });

      call(serverApi, method, {}).then(function(res) {
        setLast(res);
        return call(serverApi, "gpu_actions_wagon", {});
      }).then(function(actionsReport) {
        setGpuActions(actionsReport);
        return call(serverApi, "gpu_policy_wagon", {});
      }).then(function(policyReport) {
        setGpuPolicy(policyReport);
      }).catch(function(err) {
        setLast({
          ok: false,
          source: "gpu-actions-ui",
          error: String(err)
        });
      }).finally(function() {
        setBusy(false);
      });
    }

    function loadGpuPolicy90304() {
      setGpuPolicyLoading(true);
      call(serverApi, "gpu_policy_wagon", {}).then(function(res) {
        setGpuPolicy(res);
        setLast({
          ok: !!(res && res.ok),
          source: "gpu-policy-ui",
          message: res && res.label ? res.label : "GPU policy scan updated"
        });
      }).catch(function(err) {
        var fail = { ok: false, source: "gpu-policy-ui", error: String(err) };
        setGpuPolicy(fail);
        setLast(fail);
      }).finally(function() {
        setGpuPolicyLoading(false);
      });
    }

    function loadAmdCapability90302R1() {
      setAmdCapabilityLoading(true);
      call(serverApi, "amd_capability_wagon", {}).then(function(res) {
        setAmdCapability(res);
        setLast({
          ok: !!(res && res.ok),
          source: "amd-capability-ui",
          message: res && res.label ? res.label : "AMD capability scan updated"
        });
      }).catch(function(err) {
        var fail = { ok: false, source: "amd-capability-ui", error: String(err) };
        setAmdCapability(fail);
        setLast(fail);
      }).finally(function() {
        setAmdCapabilityLoading(false);
      });
    }

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
  var displayLabel = status && status.display_label ? status.display_label : (connector ? connector.name : "Internal display");
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

  var internalActive = internalInfo.active !== undefined ? !!internalInfo.active : !patch.has_prefer_vk_9070;
  var externalActive = externalInfo.active !== undefined ? !!externalInfo.active : !!patch.has_prefer_vk_9070;

  var internalPanelRaw = status && status.internal_panel_label ? status.internal_panel_label : "";
  var internalText = internalPanelRaw.indexOf("NS080WUM-LX1") >= 0 ? "Lenovo Legion Go S LCD" : (internalPanelRaw || internalInfo.name || "Built-in display");
  var internalPanelDetail = internalPanelRaw && internalPanelRaw !== internalText ? internalPanelRaw : "Built-in panel";
  var externalText = externalInfo.name || displayLabel || "External display";
  var signalText = tvSignalMode && tvSignalMode.label ? tvSignalMode.label : "n/a";
  var internalSignalText = "1200p120";
  var shownSignalLabel = externalActive ? "External signal" : "Panel signal";
  var shownSignalText = externalActive ? signalText : internalSignalText;
  var renderText = currentMode && currentMode.label ? currentMode.label : "n/a";
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
  var connectorText = connector && connector.name ? connector.name : "none";
  var routeStatusText = statusContent;
  if (dockStatus && dockStatus.label) {
    routeStatusText = statusContent + " • " + dockStatus.label;
  }
  var routeStatusTickerText = routeStatusText + "  " + routeStatusText + "  " + routeStatusText;

  return e(
    "div",
    { style: { padding: "0 8px 12px 8px", position: "relative" } },

      e("style", null, ".egbDebugToggleWrap81318R7{box-sizing:border-box!important;overflow:hidden!important;contain:paint!important;}.egbDebugToggleWrap81318R7 *{box-sizing:border-box!important;}.egbDebugToggleStable81318R7{box-sizing:border-box!important;transform:none!important;overflow:hidden!important;contain:paint!important;outline:2px solid transparent!important;outline-offset:-4px!important;max-width:100%!important;}.egbDebugToggleStable81318R7:focus,.egbDebugToggleStable81318R7:focus-visible,.egbDebugToggleWrap81318R7 button:focus,.egbDebugToggleWrap81318R7 button:focus-visible,.egbDebugToggleWrap81318R7 [role=button]:focus,.egbDebugToggleWrap81318R7 [role=button]:focus-visible{transform:none!important;outline:2px solid rgba(255,255,255,.78)!important;outline-offset:-4px!important;box-shadow:inset 0 0 0 2px rgba(255,255,255,.32),0 0 0 1px rgba(255,255,255,.06)!important;max-width:100%!important;overflow:hidden!important;}"),

      e("style", null, "@keyframes egbRouteTicker81316 { 0% { transform: translate3d(0,0,0); } 100% { transform: translate3d(-33.333%,0,0); } }"),

      e("button", {
        title: "Recovery: prepare for unplug",
        disabled: busy,
        onClick: function() {
          doCall("prepare_for_unplug", {});
        },
        style: {
          position: "absolute",
          top: "-40px",
          right: "14px",
          width: "39px",
          height: "25px",
          borderRadius: "3px",
          border: "1px solid rgba(255,255,255,.08)",
          background: "rgba(34,36,40,.96)",
          color: "rgba(245,248,255,.90)",
          fontSize: "15px",
          fontWeight: "700",
          lineHeight: "25px",
          textAlign: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0",
          opacity: busy ? ".45" : "1",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
          zIndex: 50
        }
      }, e("svg", {
          width: "24",
          height: "24",
          viewBox: "0 0 24 24",
          fill: "none",
          style: {
            display: "block"
          }
        },
          e("path", {
            d: "M12 4L5.5 13.5H18.5L12 4Z",
            fill: "rgba(245,248,255,.90)"
          }),
          e("path", {
            d: "M6 18.5H18",
            stroke: "rgba(245,248,255,.90)",
            strokeWidth: "2.4",
            strokeLinecap: "round"
          })
        )),

    e("div", {
        onClick: function() {
          refresh(false);
        },
        title: "Refresh status",
      style: {
          cursor: "pointer",
        background: egpu ? "rgba(40,160,90,.25)" : "rgba(180,55,55,.25)",
        border: egpu ? "1px solid rgba(80,255,150,.55)" : "1px solid rgba(255,120,120,.65)",
        borderRadius: "12px",
        padding: "8px",
        paddingRight: "10px",
        marginBottom: "8px",
        fontSize: "12px",
        fontWeight: 800,
        position: "relative"
      }
    },

      e("div", {
        style: {
          marginBottom: "6px",
          fontWeight: "900",
          display: "flex",
          alignItems: "center",
          gap: "7px"
        }
      },
        e("span", {
          style: {
            width: "8px",
            height: "8px",
            borderRadius: "999px",
            background: egpu ? "rgba(80,255,150,.95)" : "rgba(255,120,120,.95)",
            boxShadow: egpu ? "0 0 8px rgba(80,255,150,.65)" : "0 0 8px rgba(255,120,120,.45)",
            display: "inline-block",
            flex: "0 0 auto"
          }
        }),
        e("span", {
          style: {
            color: egpu ? "rgb(120,255,170)" : "rgb(255,140,140)",
            fontWeight: "900",
            display: "block",
            flex: "1 1 auto",
            minWidth: "0",
            maxWidth: "100%",
            overflow: "hidden",
            whiteSpace: "nowrap",
            contain: "paint"
          }
        }, e("span", {
          style: {
            display: "block",
            width: "100%",
            maxWidth: "100%",
            minWidth: "0",
            overflow: "hidden",
            whiteSpace: "nowrap",
            boxSizing: "border-box",
            contain: "paint"
          }
        },
          e("span", {
            style: {
              display: "inline-flex",
              alignItems: "center",
              whiteSpace: "nowrap",
              minWidth: "max-content",
              animation: "egbRouteTicker81316 10s linear infinite",
              willChange: "transform"
            }
          },
            e("span", {
              style: {
                paddingRight: "2.2em",
                flex: "0 0 auto"
              }
            }, routeStatusText),
            e("span", {
              style: {
                paddingRight: "2.2em",
                flex: "0 0 auto"
              }
            }, routeStatusText),
            e("span", {
              style: {
                paddingRight: "2.2em",
                flex: "0 0 auto"
              }
            }, routeStatusText)
          )
        ))
      ),
        // UI_VARIANT_C_MAIN_DISPLAY_COMPACT_90902
        e("div", {
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
          e("div", {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              padding: "7px 9px",
              borderRadius: "10px",
              background: "rgba(0,0,0,.20)",
              border: "1px solid rgba(255,255,255,.08)"
            }
          },
            e("span", {
              style: {
                opacity: ".68",
                fontSize: "11px",
                fontWeight: "900",
                textTransform: "uppercase",
                letterSpacing: ".06em"
              }
            }, "Route"),
            e("span", {
              style: {
                minWidth: "0",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: egpu ? "rgb(135,255,190)" : "rgba(245,248,255,.82)",
                fontSize: "12px",
                fontWeight: "900"
              }
            }, egpu ? "eGPU active" : "Internal / iGPU")
          ),

          e("div", {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              padding: "7px 9px",
              borderRadius: "10px",
              background: "rgba(0,0,0,.16)",
              border: "1px solid rgba(255,255,255,.07)"
            }
          },
            e("span", {
              style: {
                opacity: ".68",
                fontSize: "11px",
                fontWeight: "900",
                textTransform: "uppercase",
                letterSpacing: ".06em"
              }
            }, "Output"),
            e("span", {
              style: {
                minWidth: "0",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: shownSignalText !== "n/a" ? "rgba(245,248,255,.94)" : "rgba(255,150,150,.95)",
                fontSize: "12px",
                fontWeight: "900"
              }
            }, connectorText)
          ),

          e("div", {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              padding: "7px 9px",
              borderRadius: "10px",
              background: "rgba(0,0,0,.16)",
              border: "1px solid rgba(255,255,255,.07)"
            }
          },
            e("span", {
              style: {
                opacity: ".68",
                fontSize: "11px",
                fontWeight: "900",
                textTransform: "uppercase",
                letterSpacing: ".06em"
              }
            }, "Mode"),
            e("span", {
              style: {
                minWidth: "0",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: shownSignalText !== "n/a" ? "rgba(245,248,255,.94)" : "rgba(245,248,255,.62)",
                fontSize: "12px",
                fontWeight: "900"
              }
            }, shownSignalText !== "n/a" ? renderModeShortLabel(shownSignalText) : "n/a")
          )
        ),

        e("div", {
          style: {
            marginTop: "10px",
            marginBottom: "6px",
            paddingTop: "8px",
            borderTop: "1px solid rgba(255,255,255,.10)",
            fontSize: "11px",
            fontWeight: "900",
            textTransform: "uppercase",
            letterSpacing: ".35px",
            color: "rgba(245,248,255,.78)"
          }
        }, "Main Display Control"),




            React.createElement(
              PanelSectionRow,
              null,
              React.createElement(
                GamepadButton,
                {
                  disabled: busy || !egpu,
                  onClick: function() {
                    setLast({
                      ok: true,
                      marker: "FRONTEND_CLICK_SMART",
                      message: "Diagnostics: SMART frontend click reached React handler"
                    });
                    doCall("smart_toggle_display", { restart: true });
                  },
                  style: {
                    width: "100%",
                    maxWidth: "100%",
                    minWidth: "0",
                    overflow: "hidden",
                    minHeight: "42px",
                    boxSizing: "border-box",
                    borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,.13)",
                    background: "linear-gradient(180deg, rgba(72,80,92,.96), rgba(38,43,52,.98))",
                    boxShadow: "0 0 0 1px rgba(255,255,255,.035), 0 8px 16px rgba(0,0,0,.22)",
                    color: "rgba(245,248,255,.96)",
                    fontFamily: "inherit",
                    fontSize: "14px",
                    fontWeight: "900",
                    textAlign: "center",
                    padding: "8px 10px",
                    opacity: (busy || !egpu) ? ".55" : "1"
                  }
                },
                  e("div", {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "10px",
                      width: "100%"
                    }
                  },
                    e("span", {
                      style: {
                        minWidth: "0",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }
                    }, e("div", {
                    style: {
                      width: "100%",
                      boxSizing: "border-box",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      minWidth: "0"
                    }
                  },
                    e("span", {
                      style: {
                        flex: "1 1 auto",
                        minWidth: "0",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontWeight: "900",
                        letterSpacing: ".25px"
                      }
                    }, "SMART"),
                    e("span", {
                      style: {
                        flex: "0 0 auto",
                        width: "auto",
                        minWidth: "0",
                        maxWidth: "100%",
                        marginLeft: "0",
                        boxSizing: "border-box",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        borderRadius: "999px",
                        padding: "5px 10px",
                        border: "1px solid rgba(80,255,180,.65)",
                        background: "rgba(0,190,120,.16)",
                        color: "rgb(135,255,190)",
                        fontSize: "12px",
                        fontWeight: "900",
                        letterSpacing: ".25px",
                        lineHeight: "16px"
                      }
                    }, externalActive ? "INTERNAL" : "TV/eGPU")
                  ))
                  )
                )
            ),
            React.createElement(
              PanelSectionRow,
              null,
              React.createElement(
                GamepadButton,
                {
                  disabled: busy || !egpu,
                  onClick: function() {
                    setLast({
                      ok: true,
                      marker: "FRONTEND_CLICK_TV_MODE",
                      message: "Diagnostics: TV Mode dropdown opened"
                    });
                    setShowModeList(!showModeList);
                  },
                  style: {
                    width: "100%",
                    maxWidth: "100%",
                    minWidth: "0",
                    overflow: "hidden",
                    minHeight: "42px",
                    boxSizing: "border-box",
                    borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,.13)",
                    background: "linear-gradient(180deg, rgba(72,80,92,.96), rgba(38,43,52,.98))",
                    boxShadow: "0 0 0 1px rgba(255,255,255,.035), 0 8px 16px rgba(0,0,0,.22)",
                    color: "rgba(245,248,255,.96)",
                    fontFamily: "inherit",
                    fontSize: "14px",
                    fontWeight: "900",
                    textAlign: "center",
                    padding: "8px 10px",
                    opacity: (busy || !egpu) ? ".55" : "1"
                  }
                },
                  e("div", {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "10px",
                      width: "100%"
                    }
                  },
                    e("span", {
                      style: {
                        minWidth: "0",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }
                    }, "TV Mode: " + (currentMode ? renderModeShortLabel(currentMode) : (selectedMode ? renderModeShortLabel(selectedMode) : "4K60"))),
                    e("span", {
                      style: {
                    flex: "0 0 auto",
                    width: "auto",
                    minWidth: "0",
                    maxWidth: "100%",
                    marginLeft: "0",
                    boxSizing: "border-box",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    whiteSpace: "nowrap",
                    borderRadius: "999px",
                    padding: "5px 8px",
                    border: "1px solid rgba(255,255,255,.18)",
                    background: "rgba(0,0,0,.24)",
                    color: "rgba(245,248,255,.94)",
                    fontSize: "15px",
                    fontWeight: "900",
                    lineHeight: "16px"
                  }
                    }, showModeList ? "▲" : "▼")
                  )
                )
            ),

            showModeList ? React.createElement(
              PanelSectionRow,
              null,
              e("div", {
                style: {
                  width: "100%",
                  boxSizing: "border-box",
                  marginTop: "-4px",
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


        
        // UI_SHELL_REMOVED_HOTKEY_MINI_9060303
),

        // UI_TV_CONTROL_MOVED_FROM_DISPLAY_90802R1

    React.createElement(
          PanelSection,
          { title: "eGPU Center" },

          React.createElement(
            PanelSectionRow,
            null,
            e("div", {
              style: {
                width: "100%",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }
            },

              // GPU_WAGON_LIVE_BADGE_9020303
              e("div", {
                style: {
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "8px 10px",
                  borderRadius: "10px",
                  background: gpuWagonLoading ? "rgba(255,210,90,.10)" : "rgba(80,255,150,.08)",
                  border: gpuWagonLoading ? "1px solid rgba(255,210,90,.25)" : "1px solid rgba(80,255,150,.18)",
                  color: "rgba(245,248,255,.88)",
                  fontSize: "11px",
                  fontWeight: "800",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "10px"
                }
              },
                e("span", null, gpuWagonLoading ? "LOADING" : (gpuWagon ? "LIVE / READ-ONLY" : "WAITING")),
                e("span", { style: { opacity: ".75" } },
                  gpuWagonUpdated ? ("updated " + new Date(gpuWagonUpdated).toLocaleTimeString()) : "not loaded"
                )
              ),

              ((gpuWagon && gpuWagon.source === "amd-sysfs-wagon" && gpuWagon.cards) ? gpuWagon.cards : []).map(function(gpu, idx) {
                var hw = gpu.hwmon || {};
                var connectors = gpu.connectors || [];
                var connected = connectors
                  .filter(function(c) { return c.status === "connected"; })
                  .map(function(c) { return c.name; })
                  .join(", ");

                return e("div", {
                  key: "gpu-wagon-" + idx,
                  style: {
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "12px",
                    borderRadius: "12px",
                    background: gpu.kind === "egpu"
                      ? "linear-gradient(180deg, rgba(50,80,120,.22), rgba(25,35,55,.28))"
                      : "linear-gradient(180deg, rgba(70,70,70,.22), rgba(28,28,28,.30))",
                    border: gpu.kind === "egpu"
                      ? "1px solid rgba(120,180,255,.22)"
                      : "1px solid rgba(255,255,255,.10)",
                    boxShadow: "0 4px 14px rgba(0,0,0,.18)"
                  }
                },
                  e("div", {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                      marginBottom: "8px"
                    }
                  },
                    e("div", {
                      style: {
                        display: "flex",
                        flexDirection: "column",
                        minWidth: 0
                      }
                    },
                      e("span", {
                        style: {
                          fontSize: "14px",
                          fontWeight: "900",
                          color: "rgba(245,248,255,.96)"
                        }
                      }, (gpu.kind === "egpu" ? "eGPU" : (gpu.kind === "igpu" ? "iGPU" : "AMD GPU")) + " • " + gpu.card),
                      e("span", {
                        style: {
                          marginTop: "2px",
                          fontSize: "11px",
                          fontWeight: "700",
                          opacity: ".72"
                        }
                      }, (gpu.device || "unknown") + " • " + (gpu.driver || "amdgpu"))
                    ),
                    e("span", {
                      style: {
                        flex: "0 0 auto",
                        borderRadius: "999px",
                        padding: "4px 8px",
                        background: gpu.perf_level === "high"
                          ? "rgba(80,255,150,.18)"
                          : "rgba(255,255,255,.10)",
                        border: gpu.perf_level === "high"
                          ? "1px solid rgba(80,255,150,.45)"
                          : "1px solid rgba(255,255,255,.12)",
                        color: gpu.perf_level === "high"
                          ? "rgb(140,255,190)"
                          : "rgba(245,248,255,.90)",
                        fontSize: "11px",
                        fontWeight: "900"
                      }
                    }, gpu.perf_level || "unknown")
                  ),

                  detailLine("Temperature",
                    hw.temp_c !== null && hw.temp_c !== undefined ? (String(hw.temp_c) + "°C") : "n/a",
                    hw.temp_c !== null && hw.temp_c !== undefined
                  ),
                  detailLine("Power",
                    hw.power_w !== null && hw.power_w !== undefined ? (String(hw.power_w) + "W") : "n/a",
                    hw.power_w !== null && hw.power_w !== undefined
                  ),
                  detailLine("GPU Busy",
                    gpu.gpu_busy_percent !== null && gpu.gpu_busy_percent !== undefined ? (String(gpu.gpu_busy_percent) + "%") : "n/a",
                    gpu.gpu_busy_percent !== null && gpu.gpu_busy_percent !== undefined
                  ),
                  detailLine("Connected",
                    connected || "none",
                    !!connected
                  )
                );
              }),

              (!gpuWagon || gpuWagon.source !== "amd-sysfs-wagon") ? e("div", {
                style: {
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "12px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(255,255,255,.08)",
                  color: "rgba(245,248,255,.78)",
                  fontSize: "12px",
                  fontWeight: "700",
                  lineHeight: "18px"
                }
              },
                e("div", {
                  style: {
                    fontSize: "13px",
                    fontWeight: "900",
                    marginBottom: "6px",
                    color: "rgba(245,248,255,.96)"
                  }
                }, "AMD GPU wagon"),
                e("div", null, "Read-only discovery layer"),
                e("div", { style: { opacity: ".72", marginTop: "4px" } }, "Run report to load card0/card1 sysfs data")
              ) : null
            )
          ),

          React.createElement(
            PanelSectionRow,
            null,
            
          // UI_GPU_HEADERS_90702

          React.createElement(
            PanelSectionRow,
            null,
            e("div", {
              style: {
                width: "100%",
                boxSizing: "border-box",
                paddingTop: "2px",
                paddingBottom: "2px",
                opacity: ".72",
                fontSize: "11px",
                fontWeight: "900",
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "rgba(180,190,210,.88)"
              }
            }, "Live Monitoring")
          ),
React.createElement(
              GamepadButton,
              {
                disabled: busy,
                onClick: function() {
                  setLast({
                    ok: true,
                    marker: "FRONTEND_LOAD_AMD_WAGON_9020302",
                    message: "AMD GPU wagon discovery requested"
                  });
                  loadGpuWagon9020302();
                }
              },
              gpuWagonLoading ? "Loading AMD GPU report..." : "Load AMD GPU report"
            )
          )
        ,

          // UI_SHELL_REPAIR_GPU_CENTER_BOUNDARIES_9060304R1
React.createElement(
            PanelSectionRow,
            null,
            
          // UI_GPU_HEADERS_90702

          React.createElement(
            PanelSectionRow,
            null,
            e("div", {
              style: {
                width: "100%",
                boxSizing: "border-box",
                paddingTop: "2px",
                paddingBottom: "2px",
                opacity: ".72",
                fontSize: "11px",
                fontWeight: "900",
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "rgba(180,190,210,.88)"
              }
            }, "Capabilities")
          ),
React.createElement(
              GamepadButton,
              {
                disabled: busy || amdCapabilityLoading,
                onClick: function() {
                  setLast({
                    ok: true,
                    marker: "FRONTEND_LOAD_AMD_CAPABILITY_90302R1",
                    message: "AMD capability scan requested"
                  });
                  loadAmdCapability90302R1();
                }
              },
              amdCapabilityLoading ? "Loading AMD capabilities..." : "Load AMD capabilities"
            )
          ),

          (amdCapability && amdCapability.source === "amd-capability-wagon" && amdCapability.cards) ? React.createElement(
            PanelSectionRow,
            null,
            e("div", {
              style: {
                width: "100%",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }
            },
              amdCapability.cards.map(function(c, idx) {
                return e("div", {
                  key: "amd-cap-" + idx,
                  style: {
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px",
                    borderRadius: "10px",
                    background: "rgba(0,0,0,.22)",
                    border: "1px solid rgba(255,255,255,.10)",
                    fontSize: "11px",
                    fontWeight: "800",
                    color: "rgba(245,248,255,.88)"
                  }
                },
                  e("div", {
                    style: {
                      fontSize: "13px",
                      fontWeight: "900",
                      marginBottom: "6px",
                      color: "rgba(245,248,255,.96)"
                    }
                  }, (c.kind === "egpu" ? "eGPU" : "iGPU") + " capabilities • " + c.card),

                  detailLine("Perf level",
                    c.can_read_perf_level ? (c.can_write_perf_level ? "read/write" : "read OK / root write needed") : "missing",
                    !!c.can_read_perf_level
                  ),
                  detailLine("Power profile",
                    c.has_power_profile ? "available" : "missing",
                    !!c.has_power_profile
                  ),
                  detailLine("Sensors",
                    c.has_hwmon ? "hwmon OK" : "missing",
                    !!c.has_hwmon
                  ),
                  detailLine("Busy metrics",
                    (c.has_gpu_busy ? "GPU" : "no GPU") + " / " + (c.has_mem_busy ? "VRAM" : "no VRAM"),
                    !!c.has_gpu_busy
                  ),
                  detailLine("Connectors",
                    String(c.connectors_count || 0) + " detected",
                    (c.connectors_count || 0) > 0
                  )
                );
              })
            )
          ) : null,

          React.createElement(
            PanelSectionRow,
            null,
            
          // UI_GPU_HEADERS_90702

          React.createElement(
            PanelSectionRow,
            null,
            e("div", {
              style: {
                width: "100%",
                boxSizing: "border-box",
                paddingTop: "2px",
                paddingBottom: "2px",
                opacity: ".72",
                fontSize: "11px",
                fontWeight: "900",
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "rgba(180,190,210,.88)"
              }
            }, "Policy")
          ),
React.createElement(
              GamepadButton,
              {
                disabled: busy || gpuPolicyLoading,
                onClick: function() {
                  setLast({
                    ok: true,
                    marker: "FRONTEND_LOAD_GPU_POLICY_90304",
                    message: "GPU policy scan requested"
                  });
                  loadGpuPolicy90304();
                }
              },
              gpuPolicyLoading ? "Loading GPU policy..." : "Load GPU policy"
            )
          ),

          (gpuPolicy && gpuPolicy.source === "gpu-policy-wagon" && gpuPolicy.cards) ? React.createElement(
            PanelSectionRow,
            null,
            e("div", {
              style: {
                width: "100%",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }
            },
              gpuPolicy.cards.map(function(c, idx) {
                var warn = (c.warnings && c.warnings.length) ? c.warnings.join("; ") : "none";
                return e("div", {
                  key: "gpu-policy-" + idx,
                  style: {
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px",
                    borderRadius: "10px",
                    background: c.is_high ? "rgba(80,255,150,.08)" : "rgba(0,0,0,.22)",
                    border: c.is_high ? "1px solid rgba(80,255,150,.22)" : "1px solid rgba(255,255,255,.10)",
                    fontSize: "11px",
                    fontWeight: "800",
                    color: "rgba(245,248,255,.88)"
                  }
                },
                  e("div", {
                    style: {
                      fontSize: "13px",
                      fontWeight: "900",
                      marginBottom: "6px",
                      color: "rgba(245,248,255,.96)"
                    }
                  }, "GPU policy • " + c.card),

                  detailLine("Perf level",
                    c.perf_level || "unknown",
                    !!c.perf_level
                  ),
                  detailLine("Power profile",
                    c.has_power_profile ? "available" : "missing",
                    !!c.has_power_profile
                  ),
                  detailLine("Policy state",
                    c.is_high ? "high performance" : (c.is_auto ? "auto / dynamic" : "custom / other"),
                    true
                  ),
                  detailLine("Warning",
                    warn,
                    !(c.warnings && c.warnings.length)
                  )
                );
              })
            )
          ) : null,

          React.createElement(
            PanelSectionRow,
            null,
            
          // UI_GPU_HEADERS_90702

          React.createElement(
            PanelSectionRow,
            null,
            e("div", {
              style: {
                width: "100%",
                boxSizing: "border-box",
                paddingTop: "2px",
                paddingBottom: "2px",
                opacity: ".72",
                fontSize: "11px",
                fontWeight: "900",
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "rgba(180,190,210,.88)"
              }
            }, "Actions / Advanced")
          ),
React.createElement(
              GamepadButton,
              {
                disabled: busy || gpuActionsLoading,
                onClick: function() {
                  setLast({
                    ok: true,
                    marker: "FRONTEND_LOAD_GPU_ACTIONS_90402R1",
                    message: "GPU actions status requested"
                  });
                  loadGpuActions90402R1();
                }
              },
              gpuActionsLoading ? "Loading GPU actions..." : "Load GPU actions"
            )
          ),

          (gpuActions && gpuActions.source === "gpu-actions-wagon") ? React.createElement(
            PanelSectionRow,
            null,
            e("div", {
              style: {
                width: "100%",
                boxSizing: "border-box",
                padding: "10px",
                borderRadius: "12px",
                background: "rgba(0,0,0,.22)",
                border: "1px solid rgba(255,255,255,.10)",
                fontSize: "11px",
                fontWeight: "800",
                color: "rgba(245,248,255,.88)"
              }
            },
              e("div", {
                style: {
                  fontSize: "13px",
                  fontWeight: "900",
                  marginBottom: "6px",
                  color: "rgba(245,248,255,.96)"
                }
              }, "GPU Actions • eGPU card1"),

              detailLine("Current policy",
                gpuActions.current || "unknown",
                gpuActions.current === "high"
              ),

              detailLine("Writable",
                gpuActions.writable ? "YES" : "NO",
                !!gpuActions.writable
              ),

              detailLine("Supported",
                gpuActions.supported ? gpuActions.supported.join(" / ") : "auto / high",
                true
              ),

              detailLine("Warning",
                gpuActions.warnings && gpuActions.warnings.length ? gpuActions.warnings.join("; ") : "none",
                !(gpuActions.warnings && gpuActions.warnings.length)
              )
            )
          ) : null,

          (gpuActions && gpuActions.source === "gpu-actions-wagon") ? React.createElement(
            PanelSectionRow,
            null,
            React.createElement(
              GamepadButton,
              {
                disabled: busy || gpuActionsLoading || !gpuActions.writable || gpuActions.current === "high",
                onClick: function() {
                  setLast({
                    ok: true,
                    marker: "FRONTEND_GPU_SET_HIGH_90402R1",
                    message: "Apply HIGH requested"
                  });
                  runGpuAction90402R1("gpu_set_high", "Apply HIGH");
                }
              },
              gpuActions.current === "high" ? "HIGH already active" : "Apply HIGH"
            )
          ) : null,

          (gpuActions && gpuActions.source === "gpu-actions-wagon") ? React.createElement(
            PanelSectionRow,
            null,
            React.createElement(
              GamepadButton,
              {
                disabled: busy || gpuActionsLoading || !gpuActions.writable || gpuActions.current === "auto",
                onClick: function() {
                  setLast({
                    ok: true,
                    marker: "FRONTEND_GPU_SET_AUTO_90402R1",
                    message: "Restore AUTO requested"
                  });
                  runGpuAction90402R1("gpu_set_auto", "Restore AUTO");
                }
              },
              gpuActions.current === "auto" ? "AUTO already active" : "Restore AUTO"
            )
          ) : null,

          React.createElement(
            PanelSectionRow,
            null,
            
          // UI_GPU_HEADERS_90702

          React.createElement(
            PanelSectionRow,
            null,
            e("div", {
              style: {
                width: "100%",
                boxSizing: "border-box",
                paddingTop: "2px",
                paddingBottom: "2px",
                opacity: ".72",
                fontSize: "11px",
                fontWeight: "900",
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "rgba(180,190,210,.88)"
              }
            }, "Profiles")
          ),
React.createElement(
              GamepadButton,
              {
                disabled: busy || gpuProfilesLoading,
                onClick: function() {
                  setLast({
                    ok: true,
                    marker: "FRONTEND_LOAD_GPU_PROFILES_90501B",
                    message: "GPU profile wagon requested"
                  });

                  loadGpuProfiles90501B();
                }
              },
              gpuProfilesLoading ? "Loading GPU profiles..." : "Load GPU profiles"
            )
          ),

          (gpuProfiles && gpuProfiles.source === "gpu-profile-wagon") ? React.createElement(
            PanelSectionRow,
            null,
            e("div", {
              style: {
                width: "100%",
                boxSizing: "border-box",
                padding: "10px",
                borderRadius: "12px",
                background: "rgba(0,0,0,.22)",
                border: "1px solid rgba(255,255,255,.10)",
                fontSize: "11px",
                fontWeight: "800",
                color: "rgba(245,248,255,.90)"
              }
            },

              e("div", {
                style: {
                  fontSize: "13px",
                  fontWeight: "900",
                  marginBottom: "6px"
                }
              }, "GPU Profiles"),

              detailLine(
                "Active",
                gpuProfiles.active_profile || "unknown",
                gpuProfiles.active_profile === "Performance"
              ),

              e("div", {
                style: {
                  opacity: ".72",
                  marginTop: "6px"
                }
              }, "Profiles call safe action layer only")
            )
          ) : null,

          (gpuProfiles && gpuProfiles.source === "gpu-profile-wagon" && gpuProfiles.profiles)
          ? gpuProfiles.profiles.map(function(profile, idx) {

              var active =
                gpuProfiles.active_profile &&
                profile.label &&
                gpuProfiles.active_profile === profile.label;

              return React.createElement(
                PanelSectionRow,
                { key: "gpu-profile-" + idx },

                React.createElement(
                  GamepadButton,
                  {
                    disabled:
                      busy ||
                      gpuProfilesLoading ||
                      active,

                    onClick: function() {

                      setLast({
                        ok: true,
                        marker: "FRONTEND_APPLY_GPU_PROFILE_90501B",
                        profile: profile.id,
                        message: "Apply profile: " + profile.label
                      });

                      applyGpuProfile90501B(
                        profile.id,
                        profile.label
                      );
                    }
                  },

                  active
                    ? (profile.label + " ACTIVE")
                    : profile.label
                )
              );

          }) : null
),

React.createElement(
          PanelSection,
          { title: "TV Control" },

          // UI_TV_CONTROL_REAL_SECTION_90802R1
e("div", {
        style: {
          width: "100%",
          boxSizing: "border-box",
          marginTop: "14px",
          marginBottom: "12px"
        }
      },
        e("div", {
          style: {
            fontSize: "18px",
            fontWeight: "900",
            letterSpacing: ".4px",
            textTransform: "uppercase",
              textAlign: "center",
            color: "rgba(245,248,255,.96)",
            margin: "0 0 10px 0"
          }
        }, "TV Control"),

          React.createElement(
            PanelSectionRow,
            null,
            React.createElement(
              GamepadButton,
              {
                disabled: busy,
                onClick: function() {
                  setShowTvControl(!showTvControl);
                  setLast({
                    ok: true,
                    marker: "FRONTEND_TV_CONTROL_BETA_TOGGLE",
                    message: showTvControl ? "TV Control closed" : "TV Control opened"
                  });
                }
              },
              "TV Control " + (showTvControl ? "▲" : "▼")
            )
          ),

          // TV_CONTROL_FOCUS_ROWS_VERIFIED_CANDIDATE

          showTvControl ? React.createElement(
            PanelSectionRow,
            null,
            e("div", {
              style: {
                width: "100%",
                boxSizing: "border-box",
                marginTop: "-4px",
                marginBottom: "4px",
                padding: "7px",
                borderRadius: "10px",
                background: "rgba(255,190,80,.07)",
                border: "1px solid rgba(255,190,80,.16)",
                color: "rgba(255,235,200,.84)",
                fontSize: "10px",
                fontWeight: "800",
                lineHeight: "13px",
                textAlign: "center"
              }
            }, "Optional wagon. Uses ADB / WoL / CEC when available. Display switching works without it.")
          ) : null,

          showTvControl ? React.createElement(
            PanelSectionRow,
            null,
            React.createElement(
              GamepadButton,
              {
                disabled: busy || (last && last.source === "safe-tv-control-health" && last.buttons && last.buttons.tv_on === false),
                onClick: function() { doCall("tv_on", {}); }
              },
              "TV ON"
            )
          ) : null,

          showTvControl ? React.createElement(
            PanelSectionRow,
            null,
            React.createElement(
              GamepadButton,
              {
                disabled: busy || (last && last.source === "safe-tv-control-health" && last.buttons && last.buttons.hdmi === false),
                onClick: function() { doCall("tv_input", {}); }
              },
              "HDMI"
            )
          ) : null,

          showTvControl ? React.createElement(
            PanelSectionRow,
            null,
            React.createElement(
              GamepadButton,
              {
                disabled: busy || (last && last.source === "safe-tv-control-health" && last.buttons && last.buttons.tv_off === false),
                onClick: function() { doCall("tv_off", {}); }
              },
              "TV OFF"
            )
          ) : null,


      ),
        ),


React.createElement(
            PanelSection,
            { title: "Recovery / Safety" },

            // UI_VISUAL_ALIGNMENT_TO_SKETCH_91005R2 UI_COMPACT_RECOVERY_DIAG_91005R3

            React.createElement(
              PanelSectionRow,
              null,
              React.createElement(
                  GamepadButton,
                  {
                    disabled: busy,
                    onClick: function() {
                      var next = !hotkeysEnabled;
                      setHotkeysEnabled(next);
                      setLast({
                        ok: true,
                        marker: "FRONTEND_SWITCH_HOTKEYS_81304",
                        message: next ? "Recovery Hotkey enabled" : "Recovery Hotkey disabled"
                      });
                      doCall("set_hotkey_settings", { hotkeys_enabled: next });
                    }
                  },
                  e("div", {
                    style: {
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px"
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
                          lineHeight: "14px"
                        }
                      }, "Recovery Hotkey"),
                      e("span", {
                        style: {
                          marginTop: "1px",
                          fontSize: "9px",
                          fontWeight: "700",
                          lineHeight: "11px",
                          opacity: ".72"
                        }
                      }, "Y1 + Y2 hold 7s")
                    ),
                    e("span", {
                      style: {
                        width: "40px",
                        height: "22px",
                        borderRadius: "999px",
                        padding: "2px",
                        boxSizing: "border-box",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: hotkeysEnabled ? "flex-end" : "flex-start",
                        flex: "0 0 auto",
                        background: hotkeysEnabled ? "rgba(80,255,150,.28)" : "rgba(255,255,255,.12)",
                        border: hotkeysEnabled ? "1px solid rgba(80,255,150,.70)" : "1px solid rgba(255,255,255,.22)",
                        boxShadow: hotkeysEnabled ? "0 0 7px rgba(80,255,150,.18)" : "none"
                      }
                    },
                      e("span", {
                        style: {
                          width: "16px",
                          height: "16px",
                          borderRadius: "999px",
                          display: "block",
                          background: hotkeysEnabled ? "rgba(130,255,180,.98)" : "rgba(230,235,245,.78)",
                          boxShadow: hotkeysEnabled ? "0 0 8px rgba(80,255,150,.65)" : "0 1px 4px rgba(0,0,0,.35)"
                        }
                      })
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
                      var next = !tvAutoEnabled;
                      setTvAutoEnabled(next);
                      setLast({
                        ok: true,
                        marker: "FRONTEND_SWITCH_WIFI_TV_AUTO_81304",
                        message: next ? "Wi-Fi TV Auto Start enabled" : "Wi-Fi TV Auto Start disabled"
                      });
                      doCall("set_tv_automation_settings", { tv_control_automation_enabled: next });
                    }
                  },
                  e("div", {
                    style: {
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px"
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
                          lineHeight: "14px"
                        }
                      }, "Wi-Fi TV Auto Start"),
                      e("span", {
                        style: {
                          marginTop: "1px",
                          fontSize: "9px",
                          fontWeight: "700",
                          lineHeight: "11px",
                          opacity: ".72"
                        }
                      }, "TV + HDMI before TV/eGPU")
                    ),
                    e("span", {
                      style: {
                        width: "40px",
                        height: "22px",
                        borderRadius: "999px",
                        padding: "2px",
                        boxSizing: "border-box",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: tvAutoEnabled ? "flex-end" : "flex-start",
                        flex: "0 0 auto",
                        background: tvAutoEnabled ? "rgba(80,255,150,.28)" : "rgba(255,255,255,.12)",
                        border: tvAutoEnabled ? "1px solid rgba(80,255,150,.70)" : "1px solid rgba(255,255,255,.22)",
                        boxShadow: tvAutoEnabled ? "0 0 7px rgba(80,255,150,.18)" : "none"
                      }
                    },
                      e("span", {
                        style: {
                          width: "16px",
                          height: "16px",
                          borderRadius: "999px",
                          display: "block",
                          background: tvAutoEnabled ? "rgba(130,255,180,.98)" : "rgba(230,235,245,.78)",
                          boxShadow: tvAutoEnabled ? "0 0 8px rgba(80,255,150,.65)" : "0 1px 4px rgba(0,0,0,.35)"
                        }
                      })
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
                    message: "Diagnostics: TV Control status click reached React handler"
                  });
                  doCall("tv_control_health", {});
                }
              },
              "Check TV Control status"
            )
          ),

            
          // UI_REMOVE_EMPTY_DIAGNOSTICS_ROW_90703


          React.createElement(
              PanelSectionRow,
              null,
              React.createElement(
                  GamepadButton,
                  {
                    disabled: busy || !egpu,
                    onClick: function() {
                      setLast({
                        ok: true,
                        marker: "FRONTEND_ACTION_PREPARE_UNPLUG_81305R5",
                        message: "Safe Unplug click reached React handler"
                      });
                      doCall("prepare_for_unplug", {});
                    }
                  },
                  e("div", {
                    style: {
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px"
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
                          lineHeight: "14px"
                        }
                      }, "Safe Unplug"),
                      e("span", {
                        style: {
                          marginTop: "1px",
                          fontSize: "9px",
                          fontWeight: "700",
                          lineHeight: "11px",
                          opacity: ".72"
                        }
                      }, "Prepare before unplugging USB4/eGPU")
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
                        marker: "FRONTEND_ACTION_LEGACY_RESTORE_81305R5",
                        message: "Legacy restore internal click reached React handler"
                      });
                      doCall("restore_internal_mode", { restart: true });
                    }
                  },
                  e("div", {
                    style: {
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px"
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
                          lineHeight: "14px"
                        }
                      }, "Legacy restore internal"),
                      e("span", {
                        style: {
                          marginTop: "1px",
                          fontSize: "9px",
                          fontWeight: "700",
                          lineHeight: "11px",
                          opacity: ".72"
                        }
                      }, "Back to built-in display")
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
                    disabled: busy || !egpu,
                    onClick: function() {
                      setLast({
                        ok: true,
                        marker: "FRONTEND_ACTION_REAPPLY_TV_MODE_81305R5",
                        message: "Reapply TV mode click reached React handler"
                      });
                      applyExternalCurrent();
                    }
                  },
                  e("div", {
                    style: {
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px"
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
                          lineHeight: "14px"
                        }
                      }, "Reapply TV mode"),
                      e("span", {
                        style: {
                          marginTop: "1px",
                          fontSize: "9px",
                          fontWeight: "700",
                          lineHeight: "11px",
                          opacity: ".72"
                        }
                      }, "Reapply current TV/eGPU")
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
                    disabled: busy || !egpu,
                    onClick: function() {
                      setLast({
                        ok: true,
                        marker: "FRONTEND_ACTION_SAFE_1080P60_81305R5",
                        message: "Safe Mode 1080p60 click reached React handler"
                      });
                      setSelectedMode({ width: 1920, height: 1080, refresh: 60, label: "1920x1080 @ 60Hz" });
                      setShowModeList(false);
                      doCall("apply_egpu_mode", { restart: true, width: 1920, height: 1080, refresh: 60 });
                    }
                  },
                  e("div", {
                    style: {
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px"
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
                          lineHeight: "14px"
                        }
                      }, "Safe Mode 1080p60"),
                      e("span", {
                        style: {
                          marginTop: "1px",
                          fontSize: "9px",
                          fontWeight: "700",
                          lineHeight: "11px",
                          opacity: ".72"
                        }
                      }, "Fallback picture mode")
                    )
                  )
                )
            ),

            // UI_RECOVERY_SAFETY_BOUNDARY_FIXED_91004R11
          ),

          React.createElement(
            PanelSection,
            { title: "Diagnostics" },
            // UI_DIAGNOSTICS_BOUNDARY_AFTER_RECOVERY_91004R11

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
                        marker: "FRONTEND_ACTION_RECENT_EVENTS_81305R5",
                        message: "Recent events click reached React handler"
                      });
                      loadRecentEvents();
                    }
                  },
                  e("div", {
                    style: {
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px"
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
                          lineHeight: "14px"
                        }
                      }, "Recent events"),
                      e("span", {
                        style: {
                          marginTop: "1px",
                          fontSize: "9px",
                          fontWeight: "700",
                          lineHeight: "11px",
                          opacity: ".72"
                        }
                      }, "Last 10 min events")
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
                    disabled: false,
                    onClick: function() {
                      var next = !showDebug;
                      setShowDebug(next);
                      setLast({
                        ok: true,
                        marker: "FRONTEND_TOGGLE_DEBUG_INFO_81319_TEMPLATE",
                        message: next ? "Debug info shown" : "Debug info hidden"
                      });
                    }
                  },
                  e("div", {
                    style: {
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px"
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
                          lineHeight: "14px"
                        }
                      }, "Debug Info"),
                      e("span", {
                        style: {
                          marginTop: "1px",
                          fontSize: "9px",
                          fontWeight: "700",
                          lineHeight: "11px",
                          opacity: ".72"
                        }
                      }, "Gamescope + result")
                    ),
                    e("span", {
                      style: {
                        width: "40px",
                        height: "22px",
                        borderRadius: "999px",
                        padding: "2px",
                        boxSizing: "border-box",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: showDebug ? "flex-end" : "flex-start",
                        flex: "0 0 auto",
                        background: showDebug ? "rgba(80,255,150,.28)" : "rgba(255,255,255,.12)",
                        border: showDebug ? "1px solid rgba(80,255,150,.40)" : "1px solid rgba(255,255,255,.16)",
                        boxShadow: showDebug ? "0 0 6px rgba(80,255,150,.16)" : "inset 0 1px 2px rgba(0,0,0,.24)"
                      }
                    },
                      e("span", {
                        style: {
                          width: "16px",
                          height: "16px",
                          borderRadius: "999px",
                          display: "block",
                          background: showDebug ? "rgba(130,255,180,.98)" : "rgba(230,235,245,.78)",
                          boxShadow: showDebug ? "0 0 8px rgba(80,255,150,.65)" : "0 1px 4px rgba(0,0,0,.35)"
                        }
                      })
                    )
                  )
                )
            )
        ),eventLog ? React.createElement(
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
    title: "eGPUBridge",
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
