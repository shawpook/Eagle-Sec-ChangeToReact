"use strict";
(function(q, u, c) {
  function v(a, b, g) {
    a.addEventListener ? a.addEventListener(b, g, false) : a.attachEvent("on" + b, g);
  }
  function z(a) {
    if ("keypress" == a.type) {
      var b = String.fromCharCode(a.which);
      a.shiftKey || (b = b.toLowerCase());
      return b;
    }
    return n[a.which] ? n[a.which] : r[a.which] ? r[a.which] : String.fromCharCode(a.which).toLowerCase();
  }
  function F(a) {
    var b = [];
    a.shiftKey && b.push("shift");
    a.altKey && b.push("alt");
    a.ctrlKey && b.push("ctrl");
    a.metaKey && b.push("meta");
    return b;
  }
  function w(a) {
    return "shift" == a || "ctrl" == a || "alt" == a || "meta" == a;
  }
  function A(a, b) {
    var g, d2 = [];
    var e = a;
    "+" === e ? e = ["+"] : (e = e.replace(/\+{2}/g, "+plus"), e = e.split("+"));
    for (g = 0; g < e.length; ++g) {
      var m = e[g];
      B[m] && (m = B[m]);
      b && "keypress" != b && C[m] && (m = C[m], d2.push("shift"));
      w(m) && d2.push(m);
    }
    e = m;
    g = b;
    if (!g) {
      if (!p) {
        p = {};
        for (var c2 in n) 95 < c2 && 112 > c2 || n.hasOwnProperty(c2) && (p[n[c2]] = c2);
      }
      g = p[e] ? "keydown" : "keypress";
    }
    "keypress" == g && d2.length && (g = "keydown");
    return { key: m, modifiers: d2, action: g };
  }
  function D(a, b) {
    return null === a || a === u ? false : a === b ? true : D(a.parentNode, b);
  }
  function d(a) {
    function b(a2) {
      a2 = a2 || {};
      var b2 = false, l;
      for (l in p2) a2[l] ? b2 = true : p2[l] = 0;
      b2 || (x = false);
    }
    function g(a2, b2, t, f, g2, d2) {
      var l, E = [], h = t.type;
      if (!k._callbacks[a2]) return [];
      "keyup" == h && w(a2) && (b2 = [a2]);
      for (l = 0; l < k._callbacks[a2].length; ++l) {
        var c3 = k._callbacks[a2][l];
        if ((f || !c3.seq || p2[c3.seq] == c3.level) && h == c3.action) {
          var e2;
          (e2 = "keypress" == h && !t.metaKey && !t.ctrlKey) || (e2 = c3.modifiers, e2 = b2.sort().join(",") === e2.sort().join(","));
          e2 && (e2 = f && c3.seq == f && c3.level == d2, (!f && c3.combo == g2 || e2) && k._callbacks[a2].splice(l, 1), E.push(c3));
        }
      }
      return E;
    }
    function c2(a2, b2, c3, f) {
      k.stopCallback(
        b2,
        b2.target || b2.srcElement,
        c3,
        f
      ) || false !== a2(b2, c3) || (b2.preventDefault ? b2.preventDefault() : b2.returnValue = false, b2.stopPropagation ? b2.stopPropagation() : b2.cancelBubble = true);
    }
    function e(a2) {
      "number" !== typeof a2.which && (a2.which = a2.keyCode);
      var b2 = z(a2);
      b2 && ("keyup" == a2.type && y === b2 ? y = false : k.handleKey(b2, F(a2), a2));
    }
    function m(a2, g2, t, f) {
      function h(c3) {
        return function() {
          x = c3;
          ++p2[a2];
          clearTimeout(q2);
          q2 = setTimeout(b, 1e3);
        };
      }
      function l(g3) {
        c2(t, g3, a2);
        "keyup" !== f && (y = z(g3));
        setTimeout(b, 10);
      }
      for (var d2 = p2[a2] = 0; d2 < g2.length; ++d2) {
        var e2 = d2 + 1 === g2.length ? l : h(f || A(g2[d2 + 1]).action);
        n2(g2[d2], e2, f, a2, d2);
      }
    }
    function n2(a2, b2, c3, f, d2) {
      k._directMap[a2 + ":" + c3] = b2;
      a2 = a2.replace(/\s+/g, " ");
      var e2 = a2.split(" ");
      1 < e2.length ? m(a2, e2, b2, c3) : (c3 = A(a2, c3), k._callbacks[c3.key] = k._callbacks[c3.key] || [], g(c3.key, c3.modifiers, { type: c3.action }, f, a2, d2), k._callbacks[c3.key][f ? "unshift" : "push"]({ callback: b2, modifiers: c3.modifiers, action: c3.action, seq: f, level: d2, combo: a2 }));
    }
    var k = this;
    a = a || u;
    if (!(k instanceof d)) return new d(a);
    k.target = a;
    k._callbacks = {};
    k._directMap = {};
    var p2 = {}, q2, y = false, r2 = false, x = false;
    k._handleKey = function(a2, d2, e2) {
      var f = g(a2, d2, e2), h;
      d2 = {};
      var k2 = 0, l = false;
      for (h = 0; h < f.length; ++h) f[h].seq && (k2 = Math.max(k2, f[h].level));
      for (h = 0; h < f.length; ++h) f[h].seq ? f[h].level == k2 && (l = true, d2[f[h].seq] = 1, c2(f[h].callback, e2, f[h].combo, f[h].seq)) : l || c2(f[h].callback, e2, f[h].combo);
      f = "keypress" == e2.type && r2;
      e2.type != x || w(a2) || f || b(d2);
      r2 = l && "keydown" == e2.type;
    };
    k._bindMultiple = function(a2, b2, c3) {
      for (var d2 = 0; d2 < a2.length; ++d2) n2(a2[d2], b2, c3);
    };
    v(a, "keypress", e);
    v(a, "keydown", e);
    v(a, "keyup", e);
  }
  if (q) {
    var n = {
      8: "backspace",
      9: "tab",
      13: "enter",
      16: "shift",
      17: "ctrl",
      18: "alt",
      20: "capslock",
      27: "esc",
      32: "space",
      33: "pageup",
      34: "pagedown",
      35: "end",
      36: "home",
      37: "left",
      38: "up",
      39: "right",
      40: "down",
      45: "ins",
      46: "del",
      91: "meta",
      93: "meta",
      224: "meta"
    }, r = { 106: "*", 107: "+", 109: "-", 110: ".", 111: "/", 186: ";", 187: "=", 188: ",", 189: "-", 190: ".", 191: "/", 192: "`", 219: "[", 220: "\\", 221: "]", 222: "'" }, C = { "~": "`", "!": "1", "@": "2", "#": "3", $: "4", "%": "5", "^": "6", "&": "7", "*": "8", "(": "9", ")": "0", _: "-", "+": "=", ":": ";", '"': "'", "<": ",", ">": ".", "?": "/", "|": "\\" }, B = {
      option: "alt",
      command: "meta",
      "return": "enter",
      escape: "esc",
      plus: "+",
      mod: /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? "meta" : "ctrl"
    }, p;
    for (c = 1; 20 > c; ++c) n[111 + c] = "f" + c;
    for (c = 0; 9 >= c; ++c) n[c + 96] = c.toString();
    d.prototype.bind = function(a, b, c2) {
      a = a instanceof Array ? a : [a];
      this._bindMultiple.call(this, a, b, c2);
      return this;
    };
    d.prototype.unbind = function(a, b) {
      return this.bind.call(this, a, function() {
      }, b);
    };
    d.prototype.trigger = function(a, b) {
      if (this._directMap[a + ":" + b]) this._directMap[a + ":" + b]({}, a);
      return this;
    };
    d.prototype.reset = function() {
      this._callbacks = {};
      this._directMap = {};
      return this;
    };
    d.prototype.stopCallback = function(a, b) {
      if (-1 < (" " + b.className + " ").indexOf(" mousetrap ") || D(b, this.target)) return false;
      if ("composedPath" in a && "function" === typeof a.composedPath) {
        var c2 = a.composedPath()[0];
        c2 !== a.target && (b = c2);
      }
      return "INPUT" == b.tagName || "SELECT" == b.tagName || "TEXTAREA" == b.tagName || b.isContentEditable;
    };
    d.prototype.handleKey = function() {
      return this._handleKey.apply(this, arguments);
    };
    d.addKeycodes = function(a) {
      for (var b in a) a.hasOwnProperty(b) && (n[b] = a[b]);
      p = null;
    };
    d.init = function() {
      var a = d(u), b;
      for (b in a) "_" !== b.charAt(0) && (d[b] = /* @__PURE__ */ function(b2) {
        return function() {
          return a[b2].apply(a, arguments);
        };
      }(b));
    };
    d.init();
    q.Mousetrap = d;
    "undefined" !== typeof module && module.exports && (module.exports = d);
    "function" === typeof define && define.amd && define(function() {
      return d;
    });
  }
})("undefined" !== typeof window ? window : null, "undefined" !== typeof window ? document : null);
