// eGPUBridge v0.7.27 - gamepad friendly frontend using Decky/Steam ButtonItem. WAGON_UI_SKELETON_90004 ROUTE_STATUS_WAGON_90101 GPU_PROFILES_WAGON_UI_90202R1 GPU_WAGON_STATE_9020302 GPU_POLISH_TVCHECK_9020303 AMD_CAPABILITY_UI_90302R1 GPU_POLICY_UI_90304 GPU_ACTIONS_UI_90402R1 GPU_PROFILE_UI_90501B UI_SHELL_GPU_BEFORE_RECOVERY_90602R2 UI_SHELL_RENAME_GPU_CENTER_9060302 UI_SHELL_REMOVED_HOTKEY_MINI_9060303 UI_SHELL_REPAIR_GPU_CENTER_BOUNDARIES_9060304R1 UI_SHELL_REMOVED_DUPLICATE_TV_CHECK_9060305 UI_GPU_HEADERS_90702

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

  // EGPU_CENTER_V2_AUTO_REFRESH: auto-load gpuWagon when accordion is open
  React.useEffect(function() {
    if (showEgpuAccordion) {
      // Load immediately on expand
      loadGpuWagon9020302();
      loadGpuProfiles90501B();
      loadGpuActions90402R1();

      // Then refresh every 3 seconds
      egpuTimerRef.current = setInterval(function() {
        loadGpuWagon9020302();
      }, 3000);
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

  var internalActive = internalInfo.active !== undefined ? !!internalInfo.active : !patch.has_prefer_vk_9070;
  var externalActive = externalInfo.active !== undefined ? !!externalInfo.active : !!patch.has_prefer_vk_9070;

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

      e("style", null, "/* UI_SKETCH_ALIGNMENT_STEP1_91006R2 */\n/* UI_RECOVERY_CSS_ONLY_UNIFORM_91006R14I2 */\n.egbRecoveryAction91006R14I2{width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;margin:0!important;}\n.egbRecoveryAction91006R14I2 button,.egbRecoveryAction91006R14I2 [role=button],.egbRecoveryAction91006R14I2 div[role=button]{width:100%!important;max-width:100%!important;min-width:0!important;height:42px!important;min-height:42px!important;max-height:42px!important;box-sizing:border-box!important;padding:6px 10px!important;border-radius:10px!important;overflow:hidden!important;display:flex!important;align-items:center!important;justify-content:center!important;background:linear-gradient(180deg,rgba(82,96,124,.96),rgba(60,72,94,.98))!important;border:1px solid rgba(160,185,235,.20)!important;box-shadow:none!important;color:rgba(245,248,255,.96)!important;font-size:12px!important;font-weight:900!important;text-align:center!important;}\n.egbRecoveryAction91006R14I2 button:focus,.egbRecoveryAction91006R14I2 [role=button]:focus,.egbRecoveryAction91006R14I2 div[role=button]:focus,.egbRecoveryAction91006R14I2 button:focus-visible,.egbRecoveryAction91006R14I2 [role=button]:focus-visible,.egbRecoveryAction91006R14I2 div[role=button]:focus-visible{background:linear-gradient(180deg,rgba(238,240,246,.98),rgba(210,214,226,.98))!important;color:rgba(35,38,45,.98)!important;box-shadow:0 0 0 2px rgba(255,255,255,.24),0 0 0 1px rgba(0,0,0,.18)!important;}\n.egbRecoveryAction91006R14I2 button *,.egbRecoveryAction91006R14I2 [role=button] *,.egbRecoveryAction91006R14I2 div[role=button] *{box-sizing:border-box!important;min-width:0!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;}\n.egbRecoveryAction91006R14I2 span{line-height:12px!important;}\n/* UI_RECOVERY_COMPACT_SAFE_91006R14G */\n.egbRecoveryCompact91006R14G button,.egbRecoveryCompact91006R14G [role=button]{width:100%!important;max-width:100%!important;min-width:0!important;min-height:36px!important;height:auto!important;box-sizing:border-box!important;padding:5px 8px!important;border-radius:9px!important;overflow:hidden!important;}\n.egbRecoveryCompact91006R14G button *,.egbRecoveryCompact91006R14G [role=button] *{min-width:0!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;}\n.egbRecoveryCompact91006R14G span{line-height:12px!important;}\n.egbRecoveryCompact91006R14G + .egbRecoveryCompact91006R14G{margin-top:-2px!important;}\n\n/* UI_TV_ROW_CSS_FORCE_91006R13B */\n.egbTvMiniRow91006R13B{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:5px!important;width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;overflow:visible!important;}.egbTvMiniCell91006R13B{min-width:0!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important;overflow:visible!important;}.egbTvMiniCell91006R13B button,.egbTvMiniCell91006R13B [role=button],.egbTvMiniCell91006R13B div[role=button]{width:100%!important;max-width:100%!important;min-width:0!important;height:36px!important;min-height:36px!important;padding:0!important;margin:0!important;box-sizing:border-box!important;display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important;overflow:visible!important;white-space:nowrap!important;font-size:10px!important;font-weight:900!important;line-height:12px!important;letter-spacing:.02em!important;}.egbTvMiniCell91006R13B button > *,.egbTvMiniCell91006R13B [role=button] > *,.egbTvMiniCell91006R13B div[role=button] > *{display:flex!important;align-items:center!important;justify-content:center!important;text-align:center!important;width:100%!important;max-width:100%!important;min-width:0!important;overflow:visible!important;white-space:nowrap!important;}.quickaccessmenu .PanelSection, .quickaccessmenu [class*=PanelSection]{border-radius:14px!important;}.quickaccessmenu button{border-radius:10px!important;}"),

        e("style", null, ".egbDebugToggleWrap81318R7{box-sizing:border-box!important;overflow:hidden!important;contain:paint!important;}.egbDebugToggleWrap81318R7 *{box-sizing:border-box!important;}.egbDebugToggleStable81318R7{box-sizing:border-box!important;transform:none!important;overflow:hidden!important;contain:paint!important;outline:2px solid transparent!important;outline-offset:-4px!important;max-width:100%!important;}.egbDebugToggleStable81318R7:focus,.egbDebugToggleStable81318R7:focus-visible,.egbDebugToggleWrap81318R7 button:focus,.egbDebugToggleWrap81318R7 button:focus-visible,.egbDebugToggleWrap81318R7 [role=button]:focus,.egbDebugToggleWrap81318R7 [role=button]:focus-visible{transform:none!important;outline:2px solid rgba(255,255,255,.78)!important;outline-offset:-4px!important;box-shadow:inset 0 0 0 2px rgba(255,255,255,.32),0 0 0 1px rgba(255,255,255,.06)!important;max-width:100%!important;overflow:hidden!important;}"),

      e("style", null, "@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');"),
      e("style", null, "@keyframes egbRouteTicker81316 { 0% { transform: translate3d(0,0,0); } 100% { transform: translate3d(-33.333%,0,0); } }"),
      e("style", null, "/* UI_SKETCH_ACCORDION_DASHBOARD_91007R4 */\n/* UI_DASHBOARD_POLISH_91007R4B */\n.egbSketchRoot91007R4{width:100%!important;box-sizing:border-box!important;}\n.egbMainCollapsed91007R4{width:100%!important;box-sizing:border-box!important;display:flex!important;flex-direction:column!important;gap:6px!important;padding:12px!important;border-radius:12px!important;background:rgba(18,22,32,.88)!important;border:1px solid rgba(100,160,240,.18)!important;}\n.egbMainHeader91007R4{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;margin-bottom:4px!important;}\n.egbMainActionGrid91007R4{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;width:100%!important;}\n.egbMainActionButton91007R4{min-width:0!important;overflow:hidden!important;}\n.egbMainActionButton91007R4 button{width:100%!important;min-width:0!important;height:56px!important;min-height:56px!important;box-sizing:border-box!important;border-radius:10px!important;overflow:hidden!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:11px!important;font-weight:900!important;white-space:nowrap!important;}\n.egbMainActionButton91007R4 button *{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;}\n.egbDashboard91007R4{width:100%!important;box-sizing:border-box!important;display:flex!important;flex-direction:column!important;gap:4px!important;}\n.egbDashRow91007R4{display:flex!important;align-items:center!important;gap:10px!important;padding:10px 12px!important;border-radius:10px!important;background:rgba(255,255,255,.035)!important;border:1px solid rgba(255,255,255,.08)!important;height:48px!important;box-sizing:border-box!important;}\n.egbDashIcon91007R4{flex:0 0 auto!important;width:24px!important;height:24px!important;display:flex!important;align-items:center!important;justify-content:center!important;}\n.egbDashText91007R4{flex:1 1 auto!important;min-width:0!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;}\n.egbDashTitle91007R4{font-size:11px!important;font-weight:900!important;color:#EEEAFE!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;line-height:13px!important;}\n.egbDashValue91007R4{font-size:10px!important;font-weight:700!important;color:#9AA4B2!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;line-height:12px!important;margin-top:1px!important;}\n.egbDashGearBtn91007R4{flex:0 0 auto!important;width:36px!important;height:36px!important;min-width:36px!important;min-height:36px!important;padding:0!important;border-radius:8px!important;display:flex!important;align-items:center!important;justify-content:center!important;background:rgba(255,255,255,.06)!important;border:1px solid rgba(255,255,255,.12)!important;cursor:pointer!important;}\n.egbDashGearBtn91007R4:focus,.egbDashGearBtn91007R4:focus-visible{outline:2px solid rgba(255,255,255,.5)!important;outline-offset:-2px!important;}\n.egbAccordion91007R4{width:100%!important;box-sizing:border-box!important;margin-top:8px!important;border-radius:12px!important;background:rgba(18,22,32,.88)!important;border:1px solid rgba(255,255,255,.08)!important;overflow:hidden!important;}\n.egbAccordionHeader91007R4{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:10px 12px!important;cursor:pointer!important;}\n.egbAccordionBody91007R4{padding:0 12px 12px 12px!important;}\n.egbTvControlCompact91007R4{width:100%!important;box-sizing:border-box!important;}\n.egbGpuCenterCompact91007R4{width:100%!important;box-sizing:border-box!important;}\n.egbDashChevron91007R4{flex:0 0 auto!important;width:16px!important;height:16px!important;display:flex!important;align-items:center!important;justify-content:center!important;color:rgba(255,255,255,.3)!important;font-size:14px!important;}\n/* UI_UNIFORM_BTN_STYLE */\n.egbRecoveryAction91006R14I2 button,.egbRecoveryAction91006R14I2 [role=button]{height:40px!important;min-height:40px!important;max-height:40px!important;border-radius:10px!important;background:linear-gradient(180deg,rgba(54,61,73,.96),rgba(31,36,45,.98))!important;border:1px solid rgba(255,255,255,.13)!important;box-shadow:0 0 0 1px rgba(255,255,255,.035),0 8px 16px rgba(0,0,0,.22)!important;color:rgba(245,248,255,.96)!important;}\n.egbRecoveryAction91006R14I2 button:focus,.egbRecoveryAction91006R14I2 button:focus-visible,.egbRecoveryAction91006R14I2 button.gpfocus,.egbRecoveryAction91006R14I2 [role=button]:focus,.egbRecoveryAction91006R14I2 [role=button]:focus-visible,.egbRecoveryAction91006R14I2 [role=button].gpfocus{outline:2px solid rgba(255,255,255,.9)!important;outline-offset:2px!important;background:linear-gradient(180deg,rgba(238,240,246,.98),rgba(210,214,226,.98))!important;color:rgba(35,38,45,.98)!important;}\n.egbRecoveryCompact91006R14G button,.egbRecoveryCompact91006R14G [role=button]{height:40px!important;min-height:40px!important;max-height:40px!important;border-radius:10px!important;background:linear-gradient(180deg,rgba(54,61,73,.96),rgba(31,36,45,.98))!important;border:1px solid rgba(255,255,255,.13)!important;box-shadow:0 0 0 1px rgba(255,255,255,.035),0 8px 16px rgba(0,0,0,.22)!important;}\n.egbRecoveryCompact91006R14G button:focus,.egbRecoveryCompact91006R14G button:focus-visible,.egbRecoveryCompact91006R14G button.gpfocus,.egbRecoveryCompact91006R14G [role=button]:focus,.egbRecoveryCompact91006R14G [role=button].gpfocus{outline:2px solid rgba(255,255,255,.9)!important;outline-offset:2px!important;background:linear-gradient(180deg,rgba(238,240,246,.98),rgba(210,214,226,.98))!important;color:rgba(35,38,45,.98)!important;}\n.egbTvMiniCell91006R13B button,.egbTvMiniCell91006R13B [role=button]{height:40px!important;min-height:40px!important;border-radius:10px!important;background:linear-gradient(180deg,rgba(54,61,73,.96),rgba(31,36,45,.98))!important;border:1px solid rgba(255,255,255,.13)!important;box-shadow:0 0 0 1px rgba(255,255,255,.035),0 8px 16px rgba(0,0,0,.22)!important;}\n.egbTvMiniCell91006R13B button:focus,.egbTvMiniCell91006R13B button:focus-visible,.egbTvMiniCell91006R13B button.gpfocus{outline:2px solid rgba(255,255,255,.9)!important;outline-offset:2px!important;background:linear-gradient(180deg,rgba(238,240,246,.98),rgba(210,214,226,.98))!important;color:rgba(35,38,45,.98)!important;}\n/* UI_FOCUS_RING */\n.egb-std-btn-wrap button:focus,.egb-std-btn-wrap button:focus-visible,.egb-std-btn-wrap button.gpfocus,.egb-std-btn-wrap.gpfocus button{outline:2px solid rgba(255,255,255,.9)!important;outline-offset:2px!important;}\n.egb-tv-ctrl-btn-wrap button:focus,.egb-tv-ctrl-btn-wrap button:focus-visible,.egb-tv-ctrl-btn-wrap button.gpfocus,.egb-tv-ctrl-btn-wrap.gpfocus button{outline:2px solid rgba(255,255,255,.9)!important;outline-offset:2px!important;}\n.egb-tv-btn-wrap button:focus,.egb-tv-btn-wrap button:focus-visible,.egb-tv-btn-wrap button.gpfocus,.egb-tv-btn-wrap.gpfocus button{outline:2px solid rgba(255,255,255,.9)!important;outline-offset:2px!important;}\n.egb-tv-status-wrap button:focus,.egb-tv-status-wrap button:focus-visible,.egb-tv-status-wrap button.gpfocus,.egb-tv-status-wrap.gpfocus button{outline:2px solid rgba(255,255,255,.9)!important;outline-offset:2px!important;}\n.egbDashDotBtn91008R1:focus,.egbDashDotBtn91008R1:focus-visible,.egbDashDotBtn91008R1.gpfocus,.egbDashDotBtn91008R1 button:focus,.egbDashDotBtn91008R1 button.gpfocus{outline:none!important;background:rgba(255,255,255,.22)!important;border-radius:50%!important;}\n.egbSmartSwitchBtn button,.egbSmartSwitchBtn [role=button]{width:100%!important;height:52px!important;min-height:52px!important;max-height:52px!important;box-sizing:border-box!important;border-radius:12px!important;border:2px solid #FACC15!important;background:linear-gradient(180deg, rgba(30,32,40,.98), rgba(20,22,28,.98))!important;box-shadow:0 0 12px rgba(250,204,21,.15), 0 0 0 1px rgba(250,204,21,.08), 0 8px 16px rgba(0,0,0,.3)!important;color:#FACC15!important;padding:8px 12px!important;display:flex!important;align-items:center!important;justify-content:center!important;}\n.egbSmartSwitchBtn button:focus,.egbSmartSwitchBtn button:focus-visible,.egbSmartSwitchBtn button.gpfocus,.egbSmartSwitchBtn.gpfocus button,.egbSmartSwitchBtn [role=button]:focus,.egbSmartSwitchBtn [role=button]:focus-visible,.egbSmartSwitchBtn [role=button].gpfocus{outline:none!important;outline-offset:0!important;border:2px solid #F59E0B!important;background:linear-gradient(180deg, #FACC15, #F59E0B)!important;box-shadow:0 0 14px rgba(245,158,11,.35), 0 8px 16px rgba(0,0,0,.25)!important;border-radius:12px!important;height:52px!important;min-height:52px!important;max-height:52px!important;}\n.egbSmartSwitchBtn button:focus *,.egbSmartSwitchBtn button:focus-visible *,.egbSmartSwitchBtn button.gpfocus *,.egbSmartSwitchBtn.gpfocus button *{color:#1A1A1A!important;fill:#1A1A1A!important;}\n.PanelSectionRow button:focus,.PanelSectionRow button:focus-visible,.PanelSectionRow button.gpfocus,.PanelSectionRow.gpfocus button{outline:2px solid rgba(255,255,255,.9)!important;outline-offset:2px!important;}\n.egpuCenterBtn:focus,.egpuCenterBtn:focus-visible,.egpuCenterBtn.gpfocus,.egpuCenterBtn button:focus,.egpuCenterBtn button.gpfocus{outline:2px solid rgba(255,255,255,.9)!important;outline-offset:2px!important;}\n.egpuProfileRow.gpfocus,.egpuProfileRow:focus-visible{background:rgba(255,255,255,.06)!important;border-radius:8px!important;}\n.egpuProfileRow.gpfocus span,.egpuProfileRow:focus-visible span{color:rgba(245,248,255,.95)!important;}\n.egpuIconBtn:focus,.egpuIconBtn:focus-visible,.egpuIconBtn.gpfocus{outline:2px solid rgba(255,255,255,.9)!important;outline-offset:2px!important;background:linear-gradient(180deg,rgba(238,240,246,.98),rgba(210,214,226,.98))!important;color:rgba(35,38,45,.98)!important;}\ndiv[class*=Focusable].gpfocus{outline:2px solid rgba(255,255,255,.9)!important;outline-offset:2px!important;}"),



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

      // UI_TOP_MODEBADGE_READONLY_91007R1 — moved to inline after SMART

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

          // Portable/Steam Machine badge (moved from top header)
          e("div", {
            style: {
              width: "100%",
              boxSizing: "border-box",
              padding: "8px 10px",
              marginBottom: "8px",
              borderRadius: "12px",
              background: externalActive ? "rgba(18,28,18,.88)" : "rgba(18,22,32,.88)",
              border: externalActive ? "1px solid rgba(80,200,120,.18)" : "1px solid rgba(100,160,240,.18)",
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
                    background: externalActive ? "rgba(80,220,130,.95)" : "rgba(100,170,255,.95)",
                    boxShadow: externalActive ? "0 0 6px rgba(80,220,130,.40)" : "0 0 6px rgba(100,170,255,.35)"
                  }
                }),
                e("span", {
                  style: { fontSize: "12px", fontWeight: "900", letterSpacing: ".04em", textTransform: "uppercase", color: "rgba(245,248,255,.96)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
                }, externalActive ? "STEAM MACHINE" : "PORTABLE")
              ),
              e("span", {
                style: {
                  fontSize: "10px", fontWeight: "800", padding: "2px 7px", borderRadius: "6px",
                  background: externalActive ? "rgba(80,200,120,.12)" : "rgba(100,160,240,.10)",
                  border: externalActive ? "1px solid rgba(80,200,120,.20)" : "1px solid rgba(100,160,240,.18)",
                  color: externalActive ? "rgba(140,240,170,.90)" : "rgba(160,200,255,.90)", flex: "0 0 auto"
                }
              }, externalActive ? "eGPU" : "iGPU")
            ),
            e("div", {
              style: { fontSize: "10px", fontWeight: "700", color: "rgba(190,200,220,.70)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
            },
              externalActive ? ("RX 9070 active" + " · " + connectorText + (displayModeText !== "n/a" ? " · " + displayModeText : "")) : ("iGPU active" + " · " + "eDP-1" + " · " + "1200p120")
            )
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
                    e("rect", { x: "2", y: "3", width: "20", height: "14", rx: "1" }),
                    e("circle", { cx: "8", cy: "10", r: "3.5" }),
                    e("circle", { cx: "8", cy: "10", r: "1" }),
                    e("circle", { cx: "16", cy: "10", r: "3.5" }),
                    e("circle", { cx: "16", cy: "10", r: "1" }),
                    e("path", { d: "M2 6h-1v8h1" }),
                    e("path", { d: "M5 17v3" }),
                    e("path", { d: "M9 17v3" }),
                    e("path", { d: "M13 17v3" }),
                    e("path", { d: "M17 17v3" }),
                    e("path", { d: "M21 17v3" })
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
                  }, egpu ? (dockStatus && dockStatus.label ? "Dock active \u00b7 RX 9070" : "RX 9070 seen") : "no eGPU")
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
                  }, egpu ? (dockStatus && dockStatus.label ? "USB4 40G \u00b7 ASM246x \u00b7 Good" : "USB4 \u00b7 checking") : "n/a")
                )
              )
            ),

            // Row 3: TV + gear
            e("div", {
              className: "egbDashRow91007R4",
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
                }, "TV"),
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
                }, externalActive ? ("Active \u00b7 " + connectorText) : "Inactive")
              ),
              // TV settings button (sliders icon, TabMaster style)
              React.createElement(
                Focusable,
                {
                  className: "egbDashDotBtn91008R1",
                  onActivate: function() { setShowTvAccordion(!showTvAccordion); },
                  style: { flex: "0 0 auto", marginLeft: "auto" }
                },
                React.createElement(
                  DialogButton,
                  {
                    className: "egbDashDotBtn91008R1",
                    onClick: function() {
                      setShowTvAccordion(!showTvAccordion);
                      setLast({ ok: true, marker: "FRONTEND_DASHBOARD_TV_GEAR_91007R4", message: "TV accordion toggled" });
                    },
                    onOKButton: function() { setShowTvAccordion(!showTvAccordion); },
                    onOKActionDescription: "Open TV options",
                    style: {
                      height: "40px",
                      width: "40px",
                      minWidth: "40px",
                      padding: "10px",
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
                  // Sliders icon: 3 horizontal lines with dots
                  e("svg", {
                    width: "20", height: "20", viewBox: "0 0 24 24",
                    fill: "none", stroke: "currentColor",
                    strokeWidth: "2", strokeLinecap: "round"
                  },
                    e("line", { x1: "3", y1: "6", x2: "21", y2: "6" }),
                    e("circle", { cx: "8", cy: "6", r: "2", fill: "currentColor", stroke: "none" }),
                    e("line", { x1: "3", y1: "12", x2: "21", y2: "12" }),
                    e("circle", { cx: "16", cy: "12", r: "2", fill: "currentColor", stroke: "none" }),
                    e("line", { x1: "3", y1: "18", x2: "21", y2: "18" }),
                    e("circle", { cx: "12", cy: "18", r: "2", fill: "currentColor", stroke: "none" })
                  )
                )
              )
            ),

            // TV Control inline panel (toggled by gear in TV row)
            showTvAccordion ? e("div", {
              style: {
                width: "100%",
                boxSizing: "border-box",
                padding: "10px",
                borderRadius: "12px",
                background: "rgba(0,0,0,.12)",
                border: "1px solid rgba(100,155,255,.40)",
                overflow: "hidden"
              }
            },
              e("div", {
                style: {
                  fontSize: "12px",
                  fontWeight: "900",
                  color: "rgba(245,248,255,.94)",
                  marginBottom: "8px",
                  lineHeight: "14px"
                }
              }, "TV Control"),
              e("div", {
                style: {
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)",
                  gap: "5px",
                  marginBottom: "6px"
                }
              },
                e("div", null,
                  React.createElement(Focusable, { className: "egb-tv-btn-wrap", onActivate: function() { doCall("tv_on", {}); } },
                    React.createElement(DialogButton, {
                      disabled: busy || (last && last.source === "safe-tv-control-health" && last.buttons && last.buttons.tv_on === false),
                      onClick: function() { doCall("tv_on", {}); },
                      onOKButton: function() { doCall("tv_on", {}); },
                      style: { width: "100%", minWidth: "0", height: "34px", boxSizing: "border-box", padding: "0", borderRadius: "10px", border: "1px solid rgba(255,255,255,.13)", background: "linear-gradient(180deg, rgba(54,61,73,.96), rgba(31,36,45,.98))", boxShadow: "0 0 0 1px rgba(255,255,255,.035), 0 8px 16px rgba(0,0,0,.22)", color: "rgba(245,248,255,.96)", fontSize: "11px", fontWeight: "900", textAlign: "center", whiteSpace: "nowrap" }
                    }, "ON")
                  )
                ),
                e("div", null,
                  React.createElement(Focusable, { className: "egb-tv-btn-wrap", onActivate: function() { doCall("tv_input", {}); } },
                    React.createElement(DialogButton, {
                      disabled: busy || (last && last.source === "safe-tv-control-health" && last.buttons && last.buttons.hdmi === false),
                      onClick: function() { doCall("tv_input", {}); },
                      onOKButton: function() { doCall("tv_input", {}); },
                      style: { width: "100%", minWidth: "0", height: "34px", boxSizing: "border-box", padding: "0", borderRadius: "10px", border: "1px solid rgba(255,255,255,.13)", background: "linear-gradient(180deg, rgba(54,61,73,.96), rgba(31,36,45,.98))", boxShadow: "0 0 0 1px rgba(255,255,255,.035), 0 8px 16px rgba(0,0,0,.22)", color: "rgba(245,248,255,.96)", fontSize: "11px", fontWeight: "900", textAlign: "center", whiteSpace: "nowrap" }
                    }, "HDMI")
                  )
                ),
                e("div", null,
                  React.createElement(Focusable, { className: "egb-tv-btn-wrap", onActivate: function() { doCall("tv_off", {}); } },
                    React.createElement(DialogButton, {
                      disabled: busy || (last && last.source === "safe-tv-control-health" && last.buttons && last.buttons.tv_off === false),
                      onClick: function() { doCall("tv_off", {}); },
                      onOKButton: function() { doCall("tv_off", {}); },
                      style: { width: "100%", minWidth: "0", height: "34px", boxSizing: "border-box", padding: "0", borderRadius: "10px", border: "1px solid rgba(255,255,255,.13)", background: "linear-gradient(180deg, rgba(54,61,73,.96), rgba(31,36,45,.98))", boxShadow: "0 0 0 1px rgba(255,255,255,.035), 0 8px 16px rgba(0,0,0,.22)", color: "rgba(245,248,255,.96)", fontSize: "11px", fontWeight: "900", textAlign: "center", whiteSpace: "nowrap" }
                    }, "OFF")
                  )
                )
              ),
              React.createElement(PanelSectionRow, null,
                React.createElement(Focusable, { className: "egb-tv-status-wrap", onActivate: function() { doCall("tv_control_health", {}); } },
                  React.createElement(DialogButton, {
                    disabled: busy,
                    onClick: function() {
                      setLast({ ok: true, marker: "FRONTEND_CLICK_TV_CONTROL_STATUS_9020303", message: "TV Control status click reached React handler" });
                      doCall("tv_control_health", {});
                    },
                    onOKButton: function() { doCall("tv_control_health", {}); },
                    style: { width: "100%", minWidth: "0", height: "34px", boxSizing: "border-box", padding: "6px 8px", borderRadius: "10px", border: "1px solid rgba(255,255,255,.13)", background: "linear-gradient(180deg, rgba(54,61,73,.96), rgba(31,36,45,.98))", boxShadow: "0 0 0 1px rgba(255,255,255,.035), 0 8px 16px rgba(0,0,0,.22)", color: "rgba(245,248,255,.96)", fontSize: "12px", fontWeight: "900", textAlign: "center", whiteSpace: "nowrap" }
                  }, "Check TV Control status")
                )
              )
            ) : null,

            // Row 4: GPU Profile + gear
            e("div", {
              className: "egbDashRow91007R4",
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
                    color: (gpuActions && gpuActions.current) ? (gpuActions.current === "high" ? "#F59E0B" : "#3B82F6") : "#9AA4B2",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    lineHeight: "12px",
                    marginTop: "1px"
                  }
                }, (gpuActions && gpuActions.current) ? (gpuActions.current === "high" ? "Performance / HIGH" : "Balanced / AUTO") : (gpuProfiles && gpuProfiles.active_profile ? gpuProfiles.active_profile : "not loaded"))
              ),
              // GPU settings button (sliders icon, TabMaster style)
              React.createElement(
                Focusable,
                {
                  className: "egbDashDotBtn91008R1",
                  onActivate: function() {
                    setShowEgpuAccordion(!showEgpuAccordion);
                  },
                  style: { flex: "0 0 auto", marginLeft: "auto" }
                },
                React.createElement(
                  DialogButton,
                  {
                    className: "egbDashDotBtn91008R1",
                    onClick: function() {
                      setShowEgpuAccordion(!showEgpuAccordion);
                      setLast({ ok: true, marker: "FRONTEND_DASHBOARD_GPU_GEAR_91007R4", message: "eGPU accordion toggled" });
                    },
                    onOKButton: function() {
                      setShowEgpuAccordion(!showEgpuAccordion);
                    },
                    onOKActionDescription: "Open GPU options",
                    style: {
                      height: "40px",
                      width: "40px",
                      minWidth: "40px",
                      padding: "10px",
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
                  // Sliders icon
                  e("svg", {
                    width: "20", height: "20", viewBox: "0 0 24 24",
                    fill: "none", stroke: "currentColor",
                    strokeWidth: "2", strokeLinecap: "round"
                  },
                    e("line", { x1: "3", y1: "6", x2: "21", y2: "6" }),
                    e("circle", { cx: "8", cy: "6", r: "2", fill: "currentColor", stroke: "none" }),
                    e("line", { x1: "3", y1: "12", x2: "21", y2: "12" }),
                    e("circle", { cx: "16", cy: "12", r: "2", fill: "currentColor", stroke: "none" }),
                    e("line", { x1: "3", y1: "18", x2: "21", y2: "18" }),
                    e("circle", { cx: "12", cy: "18", r: "2", fill: "currentColor", stroke: "none" })
                  )
                )
              )
            ),

            // EGPU_CENTER_V2: controls + status dashboard
            showEgpuAccordion ? e("div", {
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
              // === Section 1: Controls (top) ===
              e("div", {
                style: { fontSize: "12px", fontWeight: "900", color: "rgba(245,248,255,.94)", marginBottom: "6px", lineHeight: "14px" }
              }, "Controls"),

              // Profile toggles
              ((gpuProfiles && gpuProfiles.ok && gpuProfiles.profiles) ?
                gpuProfiles.profiles.filter(function(p) {
                  var lid = (p.label || p.id).toLowerCase();
                  return lid.indexOf("diagnostic") === -1 && lid.indexOf("stable") === -1;
                }).map(function(profile, pi) {
                  var isActive = gpuProfiles.active_profile && gpuProfiles.active_profile.toLowerCase() === (profile.label || profile.id).toLowerCase();
                  var raw = profile.label || profile.id;
                  return e(Focusable, {
                    key: "egpu-profile-" + pi,
                    className: "egpuProfileRow",
                    onActivate: function() { if (!isActive) applyGpuProfile90501B(profile.id, raw); }
                  },
                    e("div", {
                      style: {
                        width: "100%", boxSizing: "border-box", display: "flex",
                        alignItems: "center", justifyContent: "space-between",
                        marginBottom: "6px", padding: "4px 6px", borderRadius: "8px"
                      }
                    },
                      e("span", {
                        style: {
                          fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          marginRight: "8px"
                        }
                      }, raw),
                      e("span", {
                        onClick: function() { if (!isActive) applyGpuProfile90501B(profile.id, raw); },
                        style: {
                          width: "40px", height: "22px", borderRadius: "999px", padding: "2px",
                          boxSizing: "border-box", display: "inline-flex", alignItems: "center",
                          justifyContent: isActive ? "flex-end" : "flex-start", flex: "0 0 auto", cursor: "pointer",
                          background: isActive ? "rgba(255,80,80,.28)" : "rgba(255,255,255,.12)",
                          border: isActive ? "1px solid rgba(255,80,80,.70)" : "1px solid rgba(255,255,255,.22)",
                          boxShadow: isActive ? "0 0 7px rgba(255,80,80,.18)" : "none"
                        }
                      },
                        e("span", {
                          style: {
                            width: "16px", height: "16px", borderRadius: "999px", display: "block",
                            background: isActive ? "rgba(255,130,130,.98)" : "rgba(230,235,245,.78)",
                            boxShadow: isActive ? "0 0 8px rgba(255,80,80,.65)" : "0 1px 4px rgba(0,0,0,.35)"
                          }
                        })
                      )
                    )
                  );
                })
              : (
                gpuProfilesLoading ? e("div", {
                  style: { fontSize: "11px", fontWeight: "700", color: "rgba(255,210,90,.70)", textAlign: "center", padding: "6px 0" }
                }, "Loading profiles...") : null
              )),


              // === Section 2: Status (unified style) ===
              e("div", {
                style: { fontSize: "12px", fontWeight: "900", color: "rgba(245,248,255,.94)", marginBottom: "6px", lineHeight: "14px", borderTop: "1px solid rgba(160,190,245,.12)", paddingTop: "8px" }
              }, "Status"),

              // GPU cards with header + details
              ((gpuWagon && gpuWagon.source === "amd-sysfs-wagon" && gpuWagon.cards) ? gpuWagon.cards.map(function(card, ci) {
                var hw = card.hwmon || {};
                var statusLabel = gpuWagonLoading ? "Loading..." :
                  (hw.temp_c >= 90 ? "Throttle" : (hw.temp_c >= 80 ? "Hot" : "Normal"));
                var statusColor = gpuWagonLoading ? "rgba(255,210,90,.70)" :
                  (hw.temp_c >= 90 ? "rgba(255,80,80,.90)" : (hw.temp_c >= 80 ? "rgba(255,210,90,.90)" : "rgba(80,255,150,.90)"));
                var connected = (card.connectors || []).filter(function(c) { return c.status === "connected"; });
                return e("div", { key: "egpu-card-" + ci, style: { marginBottom: "6px" } },
                  // Header: GPU name + status
                  e("div", {
                    style: {
                      width: "100%", boxSizing: "border-box", display: "flex",
                      alignItems: "center", justifyContent: "space-between",
                      padding: "4px 6px"
                    }
                  },
                    e("span", {
                      style: {
                        fontSize: "10px", fontWeight: "900", color: "rgba(245,248,255,.94)"
                      }
                    }, card.kind === "egpu" ? "eGPU" : "iGPU"),
                    e("span", {
                      style: {
                        fontSize: "10px", fontWeight: "700", color: statusColor
                      }
                    }, statusLabel)
                  ),
                  // Temperature
                  e("div", {
                    style: {
                      width: "100%", boxSizing: "border-box", display: "flex",
                      alignItems: "center", justifyContent: "space-between",
                      padding: "2px 6px 2px 16px"
                    }
                  },
                    e("span", { style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, "Temperature"),
                    e("span", { style: { fontSize: "10px", fontWeight: "700", color: "rgba(245,248,255,.88)" } },
                      hw.temp_c != null ? hw.temp_c + "\u00B0C" : "\u2014")
                  ),
                  // Power
                  e("div", {
                    style: {
                      width: "100%", boxSizing: "border-box", display: "flex",
                      alignItems: "center", justifyContent: "space-between",
                      padding: "2px 6px 2px 16px"
                    }
                  },
                    e("span", { style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, "Power"),
                    e("span", { style: { fontSize: "10px", fontWeight: "700", color: "rgba(245,248,255,.88)" } },
                      hw.power_w != null ? hw.power_w + "W" : "\u2014")
                  ),
                  // Load
                  e("div", {
                    style: {
                      width: "100%", boxSizing: "border-box", display: "flex",
                      alignItems: "center", justifyContent: "space-between",
                      padding: "2px 6px 2px 16px"
                    }
                  },
                    e("span", { style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, "Load"),
                    e("span", { style: { fontSize: "10px", fontWeight: "700", color: "rgba(245,248,255,.88)" } },
                      card.gpu_busy_percent != null ? card.gpu_busy_percent + "%" : "\u2014")
                  ),
                  // Connected ports
                  connected.length > 0 ? e("div", {
                    style: {
                      width: "100%", boxSizing: "border-box", display: "flex",
                      alignItems: "center", justifyContent: "space-between",
                      padding: "2px 6px 2px 16px"
                    }
                  },
                    e("span", { style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, "Ports"),
                    e("span", { style: { fontSize: "10px", fontWeight: "700", color: "rgba(245,248,255,.88)" } },
                      connected.map(function(conn) { return (conn.name || "").replace(/^HDMI-A-/i, "HDMI ").replace(/^DP-/i, "DP ").replace(/^eDP-/i, "eDP "); }).join(", "))
                  ) : null
                );
              }) : (
                !gpuWagonLoading ? e("div", {
                  style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.50)", padding: "4px 6px" }
                }, "No GPU data") : null
              ))
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
                  height: "40px",
                  width: "40px",
                  minWidth: "40px",
                  padding: "10px",
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
              className: "egbOtherAccordion91008R1",
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
            e("span", { style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, "Recovery Hotkey"),
            e("span", {
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
          e("div", { style: { width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", padding: "4px 6px", borderRadius: "8px" } },
            e("span", { style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, "Wi-Fi TV Auto Start"),
            e("span", {
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

        // Safe Unplug button
        e(Focusable, {
          className: "egpuProfileRow",
          onActivate: function() { doCall("prepare_for_unplug", {}); }
        },
          e("div", { style: { width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", padding: "4px 6px", borderRadius: "8px" } },
            e("span", { style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, "Safe Unplug"),
            e("span", { style: { fontSize: "10px", fontWeight: "700", color: "rgba(245,248,255,.50)" } }, "Eject eGPU")
          )
        ),

        // Restore Internal button
        e(Focusable, {
          className: "egpuProfileRow",
          onActivate: function() { doCall("restore_internal_mode", { restart: true }); }
        },
          e("div", { style: { width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", padding: "4px 6px", borderRadius: "8px" } },
            e("span", { style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, "Restore Internal"),
            e("span", { style: { fontSize: "10px", fontWeight: "700", color: "rgba(245,248,255,.50)" } }, "Force iGPU")
          )
        ),

        // Reapply TV Mode button
        e(Focusable, {
          className: "egpuProfileRow",
          onActivate: function() { applyExternalCurrent(); }
        },
          e("div", { style: { width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", padding: "4px 6px", borderRadius: "8px" } },
            e("span", { style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, "Reapply TV Mode"),
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
            e("span", { style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, "Fallback 1080p60"),
            e("span", { style: { fontSize: "10px", fontWeight: "700", color: "rgba(245,248,255,.50)" } }, "Safe mode")
          )
        ),

        // Section: Diagnostics
        e("div", {
          style: { fontSize: "12px", fontWeight: "900", color: "rgba(245,248,255,.94)", marginBottom: "6px", lineHeight: "14px", borderTop: "1px solid rgba(160,190,245,.12)", paddingTop: "8px" }
        }, "Diagnostics"),

        // Recent Events button
        e(Focusable, {
          className: "egpuProfileRow",
          onActivate: function() { loadRecentEvents(); }
        },
          e("div", { style: { width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", padding: "4px 6px", borderRadius: "8px" } },
            e("span", { style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, "Recent Events"),
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
            e("span", { style: { fontSize: "10px", fontWeight: "700", color: "rgba(180,205,245,.70)" } }, "Debug Info"),
            e("span", {
              onClick: function() {
                var next = !showDebug;
                setShowDebug(next);
                setLast({ ok: true, marker: "FRONTEND_TOGGLE_DEBUG_INFO_81319_TEMPLATE", message: next ? "Debug info shown" : "Debug info hidden" });
              },
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
