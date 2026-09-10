"use strict";
!function(e, t) {
  "object" == typeof exports && "undefined" != typeof module ? module.exports = t() : "function" == typeof define && define.amd ? define(t) : e.Sweetalert2 = t();
}(this, function() {
  "use strict";
  var e = { title: "", titleText: "", text: "", html: "", type: null, customClass: "", target: "body", animation: true, allowOutsideClick: true, allowEscapeKey: true, allowEnterKey: true, showConfirmButton: true, showCancelButton: false, preConfirm: null, confirmButtonText: "OK", confirmButtonAriaLabel: "", confirmButtonColor: "", confirmButtonClass: null, cancelButtonText: "Cancel", cancelButtonAriaLabel: "", cancelButtonColor: "#aaa", cancelButtonClass: null, buttonsStyling: true, reverseButtons: false, focusConfirm: true, focusCancel: false, showCloseButton: false, closeButtonAriaLabel: "Close this dialog", showLoaderOnConfirm: false, imageUrl: null, imageWidth: null, imageHeight: null, imageAlt: "", imageClass: null, timer: null, width: 500, padding: 20, background: "#fff", input: null, inputPlaceholder: "", inputValue: "", inputOptions: {}, inputAutoTrim: true, inputClass: null, inputAttributes: {}, inputValidator: null, grow: false, position: "center", progressSteps: [], currentProgressStep: null, progressStepsDistance: "40px", onBeforeOpen: null, onOpen: null, onClose: null, useRejections: true }, t = function(e2) {
    var t2 = {};
    for (var n2 in e2) t2[e2[n2]] = "swal2-" + e2[n2];
    return t2;
  }, n = t(["container", "shown", "iosfix", "modal", "overlay", "fade", "show", "hide", "noanimation", "close", "title", "content", "buttonswrapper", "confirm", "cancel", "icon", "image", "input", "file", "range", "select", "radio", "checkbox", "textarea", "inputerror", "validationerror", "progresssteps", "activeprogressstep", "progresscircle", "progressline", "loading", "styled", "top", "top-left", "top-right", "center", "center-left", "center-right", "bottom", "bottom-left", "bottom-right", "grow-row", "grow-column", "grow-fullscreen"]), o = t(["success", "warning", "info", "question", "error"]), r = function(e2, t2) {
    (e2 = String(e2).replace(/[^0-9a-f]/gi, "")).length < 6 && (e2 = e2[0] + e2[0] + e2[1] + e2[1] + e2[2] + e2[2]), t2 = t2 || 0;
    for (var n2 = "#", o2 = 0; o2 < 3; o2++) {
      var r2 = parseInt(e2.substr && e2.substr(2 * o2, 2), 16);
      n2 += ("00" + (r2 = Math.round(Math.min(Math.max(0, r2 + r2 * t2), 255)).toString(16))).substr(r2.length);
    }
    return n2;
  }, i = function(e2) {
    var t2 = [];
    for (var n2 in e2) -1 === t2.indexOf(e2[n2]) && t2.push(e2[n2]);
    return t2;
  }, a = function(e2) {
    console.warn("SweetAlert2: " + e2);
  }, l = function(e2) {
    console.error("SweetAlert2: " + e2);
  }, s = { previousWindowKeyDown: null, previousActiveElement: null, previousBodyPadding: null }, u = function(e2) {
    var t2 = d();
    t2 && t2.parentNode.removeChild(t2);
    {
      if ("undefined" != typeof document) {
        var o2 = document.createElement("div");
        o2.className = n.container, o2.innerHTML = c, ("string" == typeof e2.target ? document.querySelector(e2.target) : e2.target).appendChild(o2);
        var r2 = p(), i2 = L(r2, n.input), a2 = L(r2, n.file), s2 = r2.querySelector("." + n.range + " input"), u2 = r2.querySelector("." + n.range + " output"), f2 = L(r2, n.select), m2 = r2.querySelector("." + n.checkbox + " input"), v2 = L(r2, n.textarea);
        return i2.oninput = function() {
          J.resetValidationError();
        }, a2.onchange = function() {
          J.resetValidationError();
        }, s2.oninput = function() {
          J.resetValidationError(), u2.value = s2.value;
        }, s2.onchange = function() {
          J.resetValidationError(), s2.previousSibling.value = s2.value;
        }, f2.onchange = function() {
          J.resetValidationError();
        }, m2.onchange = function() {
          J.resetValidationError();
        }, v2.oninput = function() {
          J.resetValidationError();
        }, r2;
      }
      l("SweetAlert2 requires document to initialize");
    }
  }, c = ('\n <div role="dialog" aria-modal="true" aria-labelledby="' + n.title + '" aria-describedby="' + n.content + '" class="' + n.modal + '" tabindex="-1">\n   <ul class="' + n.progresssteps + '"></ul>\n   <div class="' + n.icon + " " + o.error + '">\n     <span class="swal2-x-mark"><span class="swal2-x-mark-line-left"></span><span class="swal2-x-mark-line-right"></span></span>\n   </div>\n   <div class="' + n.icon + " " + o.question + '">?</div>\n   <div class="' + n.icon + " " + o.warning + '">!</div>\n   <div class="' + n.icon + " " + o.info + '">i</div>\n   <div class="' + n.icon + " " + o.success + '">\n     <div class="swal2-success-circular-line-left"></div>\n     <span class="swal2-success-line-tip"></span> <span class="swal2-success-line-long"></span>\n     <div class="swal2-success-ring"></div> <div class="swal2-success-fix"></div>\n     <div class="swal2-success-circular-line-right"></div>\n   </div>\n   <img class="' + n.image + '" />\n   <h2 class="' + n.title + '" id="' + n.title + '"></h2>\n   <div id="' + n.content + '" class="' + n.content + '"></div>\n   <input class="' + n.input + '" />\n   <input type="file" class="' + n.file + '" />\n   <div class="' + n.range + '">\n     <output></output>\n     <input type="range" />\n   </div>\n   <select class="' + n.select + '"></select>\n   <div class="' + n.radio + '"></div>\n   <label for="' + n.checkbox + '" class="' + n.checkbox + '">\n     <input type="checkbox" />\n   </label>\n   <textarea class="' + n.textarea + '"></textarea>\n   <div class="' + n.validationerror + '" id="' + n.validationerror + '"></div>\n   <div class="' + n.buttonswrapper + '">\n     <button type="button" class="' + n.confirm + '">OK</button>\n     <button type="button" class="' + n.cancel + '">Cancel</button>\n   </div>\n   <button type="button" class="' + n.close + '">\xD7</button>\n </div>\n').replace(/(^|\n)\s*/g, ""), d = function() {
    return document.body.querySelector("." + n.container);
  }, p = function() {
    return d() ? d().querySelector("." + n.modal) : null;
  }, f = function() {
    return p().querySelectorAll("." + n.icon);
  }, m = function(e2) {
    return d() ? d().querySelector("." + e2) : null;
  }, v = function() {
    return m(n.title);
  }, g = function() {
    return m(n.content);
  }, h = function() {
    return m(n.image);
  }, b = function() {
    return m(n.progresssteps);
  }, y = function() {
    return m(n.validationerror);
  }, w = function() {
    return m(n.confirm);
  }, C = function() {
    return m(n.cancel);
  }, k = function() {
    return m(n.buttonswrapper);
  }, x = function() {
    return m(n.close);
  }, S = function() {
    var e2 = Array.from(p().querySelectorAll('[tabindex]:not([tabindex="-1"]):not([tabindex="0"])')).sort(function(e3, t3) {
      return e3 = parseInt(e3.getAttribute("tabindex")), t3 = parseInt(t3.getAttribute("tabindex")), e3 > t3 ? 1 : e3 < t3 ? -1 : 0;
    }), t2 = Array.prototype.slice.call(p().querySelectorAll('button, input:not([type=hidden]), textarea, select, a, [tabindex="0"]'));
    return i(e2.concat(t2));
  }, A = function(e2, t2) {
    return !!e2.classList && e2.classList.contains(t2);
  }, B = function(e2) {
    if (e2.focus(), "file" !== e2.type) {
      var t2 = e2.value;
      e2.value = "", e2.value = t2;
    }
  }, E = function(e2, t2) {
    e2 && t2 && t2.split(/\s+/).filter(Boolean).forEach(function(t3) {
      e2.classList.add(t3);
    });
  }, P = function(e2, t2) {
    e2 && t2 && t2.split(/\s+/).filter(Boolean).forEach(function(t3) {
      e2.classList.remove(t3);
    });
  }, L = function(e2, t2) {
    for (var n2 = 0; n2 < e2.childNodes.length; n2++) if (A(e2.childNodes[n2], t2)) return e2.childNodes[n2];
  }, T = function(e2, t2) {
    t2 || (t2 = "block"), e2.style.opacity = "", e2.style.display = t2;
  }, q = function(e2) {
    e2.style.opacity = "", e2.style.display = "none";
  }, V = function(e2) {
    for (; e2.firstChild; ) e2.removeChild(e2.firstChild);
  }, M = function(e2) {
    return e2.offsetWidth || e2.offsetHeight || e2.getClientRects().length;
  }, O = function(e2, t2) {
    e2.style.removeProperty ? e2.style.removeProperty(t2) : e2.style.removeAttribute(t2);
  }, H = function() {
    var e2 = document.createElement("div"), t2 = { WebkitAnimation: "webkitAnimationEnd", OAnimation: "oAnimationEnd oanimationend", animation: "animationend" };
    for (var n2 in t2) if (t2.hasOwnProperty(n2) && void 0 !== e2.style[n2]) return t2[n2];
    return false;
  }(), N = function() {
    if (window.onkeydown = s.previousWindowKeyDown, s.previousActiveElement && s.previousActiveElement.focus) {
      var e2 = window.scrollX, t2 = window.scrollY;
      s.previousActiveElement.focus(), e2 && t2 && window.scrollTo(e2, t2);
    }
  }, j = function() {
    if ("ontouchstart" in window || navigator.msMaxTouchPoints) return 0;
    var e2 = document.createElement("div");
    e2.style.width = "50px", e2.style.height = "50px", e2.style.overflow = "scroll", document.body.appendChild(e2);
    var t2 = e2.offsetWidth - e2.clientWidth;
    return document.body.removeChild(e2), t2;
  }, I = function(e2, t2) {
    var n2 = void 0;
    return function() {
      clearTimeout(n2), n2 = setTimeout(function() {
        n2 = null, e2();
      }, t2);
    };
  }, R = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e2) {
    return typeof e2;
  } : function(e2) {
    return e2 && "function" == typeof Symbol && e2.constructor === Symbol && e2 !== Symbol.prototype ? "symbol" : typeof e2;
  }, D = (function() {
    function e2(e3) {
      this.value = e3;
    }
    function t2(t3) {
      function n2(r3, i3) {
        try {
          var a2 = t3[r3](i3), l2 = a2.value;
          l2 instanceof e2 ? Promise.resolve(l2.value).then(function(e3) {
            n2("next", e3);
          }, function(e3) {
            n2("throw", e3);
          }) : o2(a2.done ? "return" : "normal", a2.value);
        } catch (e3) {
          o2("throw", e3);
        }
      }
      function o2(e3, t4) {
        switch (e3) {
          case "return":
            r2.resolve({ value: t4, done: true });
            break;
          case "throw":
            r2.reject(t4);
            break;
          default:
            r2.resolve({ value: t4, done: false });
        }
        (r2 = r2.next) ? n2(r2.key, r2.arg) : i2 = null;
      }
      var r2, i2;
      this._invoke = function(e3, t4) {
        return new Promise(function(o3, a2) {
          var l2 = { key: e3, arg: t4, resolve: o3, reject: a2, next: null };
          i2 ? i2 = i2.next = l2 : (r2 = i2 = l2, n2(e3, t4));
        });
      }, "function" != typeof t3.return && (this.return = void 0);
    }
    "function" == typeof Symbol && Symbol.asyncIterator && (t2.prototype[Symbol.asyncIterator] = function() {
      return this;
    }), t2.prototype.next = function(e3) {
      return this._invoke("next", e3);
    }, t2.prototype.throw = function(e3) {
      return this._invoke("throw", e3);
    }, t2.prototype.return = function(e3) {
      return this._invoke("return", e3);
    };
  }(), Object.assign || function(e2) {
    for (var t2 = 1; t2 < arguments.length; t2++) {
      var n2 = arguments[t2];
      for (var o2 in n2) Object.prototype.hasOwnProperty.call(n2, o2) && (e2[o2] = n2[o2]);
    }
    return e2;
  }), U = D({}, e), W = [], K = void 0;
  "undefined" == typeof Promise && l("This package requires a Promise library, please include a shim to enable it in this browser (See: https://github.com/limonte/sweetalert2/wiki/Migration-from-SweetAlert-to-SweetAlert2#1-ie-support)");
  var z = function(e2) {
    ("string" == typeof e2.target && !document.querySelector(e2.target) || "string" != typeof e2.target && !e2.target.appendChild) && (a('Target parameter is not valid, defaulting to "body"'), e2.target = "body");
    var t2 = void 0, r2 = p(), i2 = "string" == typeof e2.target ? document.querySelector(e2.target) : e2.target;
    t2 = r2 && i2 && r2.parentNode !== i2.parentNode ? u(e2) : r2 || u(e2);
    for (var s2 in e2) J.isValidParameter(s2) || a('Unknown parameter "' + s2 + '"');
    t2.style.width = "number" == typeof e2.width ? e2.width + "px" : e2.width, t2.style.padding = e2.padding + "px", t2.style.background = e2.background;
    for (var c2 = t2.querySelectorAll("[class^=swal2-success-circular-line], .swal2-success-fix"), m2 = 0; m2 < c2.length; m2++) c2[m2].style.background = e2.background;
    var y2 = d(), S2 = v(), A2 = g(), B2 = k(), L2 = w(), M2 = C(), H2 = x();
    if (e2.titleText ? S2.innerText = e2.titleText : S2.innerHTML = e2.title.split("\n").join("<br />"), e2.text || e2.html) {
      if ("object" === R(e2.html)) if (A2.innerHTML = "", 0 in e2.html) for (var N2 = 0; N2 in e2.html; N2++) A2.appendChild(e2.html[N2].cloneNode(true));
      else A2.appendChild(e2.html.cloneNode(true));
      else e2.html ? A2.innerHTML = e2.html : e2.text && (A2.textContent = e2.text);
      T(A2);
    } else q(A2);
    if (e2.position in n && E(y2, n[e2.position]), e2.grow && "string" == typeof e2.grow) {
      var j2 = "grow-" + e2.grow;
      j2 in n && E(y2, n[j2]);
    }
    e2.showCloseButton ? (H2.setAttribute("aria-label", e2.closeButtonAriaLabel), T(H2)) : q(H2), t2.className = n.modal, e2.customClass && E(t2, e2.customClass);
    var I2 = b(), D2 = parseInt(null === e2.currentProgressStep ? J.getQueueStep() : e2.currentProgressStep, 10);
    e2.progressSteps.length ? (T(I2), V(I2), D2 >= e2.progressSteps.length && a("Invalid currentProgressStep parameter, it should be less than progressSteps.length (currentProgressStep like JS arrays starts from 0)"), e2.progressSteps.forEach(function(t3, o2) {
      var r3 = document.createElement("li");
      if (E(r3, n.progresscircle), r3.innerHTML = t3, o2 === D2 && E(r3, n.activeprogressstep), I2.appendChild(r3), o2 !== e2.progressSteps.length - 1) {
        var i3 = document.createElement("li");
        E(i3, n.progressline), i3.style.width = e2.progressStepsDistance, I2.appendChild(i3);
      }
    })) : q(I2);
    for (var U2 = f(), W2 = 0; W2 < U2.length; W2++) q(U2[W2]);
    if (e2.type) {
      var K2 = false;
      for (var z2 in o) if (e2.type === z2) {
        K2 = true;
        break;
      }
      if (!K2) return l("Unknown alert type: " + e2.type), false;
      var _2 = t2.querySelector("." + n.icon + "." + o[e2.type]);
      if (T(_2), e2.animation) switch (e2.type) {
        case "success":
          E(_2, "swal2-animate-success-icon"), E(_2.querySelector(".swal2-success-line-tip"), "swal2-animate-success-line-tip"), E(_2.querySelector(".swal2-success-line-long"), "swal2-animate-success-line-long");
          break;
        case "error":
          E(_2, "swal2-animate-error-icon"), E(_2.querySelector(".swal2-x-mark"), "swal2-animate-x-mark");
      }
    }
    var Z2 = h();
    e2.imageUrl ? (Z2.setAttribute("src", e2.imageUrl), Z2.setAttribute("alt", e2.imageAlt), T(Z2), e2.imageWidth ? Z2.setAttribute("width", e2.imageWidth) : Z2.removeAttribute("width"), e2.imageHeight ? Z2.setAttribute("height", e2.imageHeight) : Z2.removeAttribute("height"), Z2.className = n.image, e2.imageClass && E(Z2, e2.imageClass)) : q(Z2), e2.showCancelButton ? M2.style.display = "inline-block" : q(M2), e2.showConfirmButton ? O(L2, "display") : q(L2), e2.showConfirmButton || e2.showCancelButton ? T(B2) : q(B2), L2.innerHTML = e2.confirmButtonText, M2.innerHTML = e2.cancelButtonText, L2.setAttribute("aria-label", e2.confirmButtonAriaLabel), M2.setAttribute("aria-label", e2.cancelButtonAriaLabel), e2.buttonsStyling && (L2.style.backgroundColor = e2.confirmButtonColor, M2.style.backgroundColor = e2.cancelButtonColor), L2.className = n.confirm, E(L2, e2.confirmButtonClass), M2.className = n.cancel, E(M2, e2.cancelButtonClass), e2.buttonsStyling ? (E(L2, n.styled), E(M2, n.styled)) : (P(L2, n.styled), P(M2, n.styled), L2.style.backgroundColor = L2.style.borderLeftColor = L2.style.borderRightColor = "", M2.style.backgroundColor = M2.style.borderLeftColor = M2.style.borderRightColor = ""), true === e2.animation ? P(t2, n.noanimation) : E(t2, n.noanimation), e2.showLoaderOnConfirm && !e2.preConfirm && a("showLoaderOnConfirm is set to true, but preConfirm is not defined.\nshowLoaderOnConfirm should be used together with preConfirm, see usage example:\nhttps://limonte.github.io/sweetalert2/#ajax-request");
  }, _ = function(e2, t2, o2) {
    var r2 = d(), i2 = p();
    null !== t2 && "function" == typeof t2 && t2(i2), e2 ? (E(i2, n.show), E(r2, n.fade), P(i2, n.hide)) : P(i2, n.fade), T(i2), r2.style.overflowY = "hidden", H && !A(i2, n.noanimation) ? i2.addEventListener(H, function e3() {
      i2.removeEventListener(H, e3), r2.style.overflowY = "auto";
    }) : r2.style.overflowY = "auto", E(document.documentElement, n.shown), E(document.body, n.shown), E(r2, n.shown), Z(), Y(), s.previousActiveElement = document.activeElement, null !== o2 && "function" == typeof o2 && setTimeout(function() {
      o2(i2);
    });
  }, Z = function() {
    null === s.previousBodyPadding && document.body.scrollHeight > window.innerHeight && (s.previousBodyPadding = document.body.style.paddingRight, document.body.style.paddingRight = j() + "px");
  }, Q = function() {
    null !== s.previousBodyPadding && (document.body.style.paddingRight = s.previousBodyPadding, s.previousBodyPadding = null);
  }, Y = function() {
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream && !A(document.body, n.iosfix)) {
      var e2 = document.body.scrollTop;
      document.body.style.top = -1 * e2 + "px", E(document.body, n.iosfix);
    }
  }, $ = function() {
    if (A(document.body, n.iosfix)) {
      var e2 = parseInt(document.body.style.top, 10);
      P(document.body, n.iosfix), document.body.style.top = "", document.body.scrollTop = -1 * e2;
    }
  }, J = function e2() {
    for (var t2 = arguments.length, o2 = Array(t2), i2 = 0; i2 < t2; i2++) o2[i2] = arguments[i2];
    if (void 0 === o2[0]) return l("SweetAlert2 expects at least 1 attribute!"), false;
    var a2 = D({}, U);
    switch (R(o2[0])) {
      case "string":
        a2.title = o2[0], a2.html = o2[1], a2.type = o2[2];
        break;
      case "object":
        D(a2, o2[0]), a2.extraParams = o2[0].extraParams, "email" === a2.input && null === a2.inputValidator && (a2.inputValidator = function(e3) {
          return new Promise(function(t3, n2) {
            /^[a-zA-Z0-9.+_-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/.test(e3) ? t3() : n2("Invalid email address");
          });
        }), "url" === a2.input && null === a2.inputValidator && (a2.inputValidator = function(e3) {
          return new Promise(function(t3, n2) {
            /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)$/.test(e3) ? t3() : n2("Invalid URL");
          });
        });
        break;
      default:
        return l('Unexpected type of argument! Expected "string" or "object", got ' + R(o2[0])), false;
    }
    z(a2);
    var u2 = d(), c2 = p();
    return new Promise(function(t3, o3) {
      a2.timer && (c2.timeout = setTimeout(function() {
        e2.closeModal(a2.onClose), a2.useRejections ? o3("timer") : t3({ dismiss: "timer" });
      }, a2.timer));
      var i3 = function(e3) {
        if (!(e3 = e3 || a2.input)) return null;
        switch (e3) {
          case "select":
          case "textarea":
          case "file":
            return L(c2, n[e3]);
          case "checkbox":
            return c2.querySelector("." + n.checkbox + " input");
          case "radio":
            return c2.querySelector("." + n.radio + " input:checked") || c2.querySelector("." + n.radio + " input:first-child");
          case "range":
            return c2.querySelector("." + n.range + " input");
          default:
            return L(c2, n.input);
        }
      }, f2 = function() {
        var e3 = i3();
        if (!e3) return null;
        switch (a2.input) {
          case "checkbox":
            return e3.checked ? 1 : 0;
          case "radio":
            return e3.checked ? e3.value : null;
          case "file":
            return e3.files.length ? e3.files[0] : null;
          default:
            return a2.inputAutoTrim ? e3.value.trim() : e3.value;
        }
      };
      a2.input && setTimeout(function() {
        var e3 = i3();
        e3 && B(e3);
      }, 0);
      for (var m2 = function(n2) {
        a2.showLoaderOnConfirm && e2.showLoading(), a2.preConfirm ? a2.preConfirm(n2, a2.extraParams).then(function(o4) {
          e2.closeModal(a2.onClose), t3(o4 || n2);
        }, function(t4) {
          e2.hideLoading(), t4 && e2.showValidationError(t4);
        }) : (e2.closeModal(a2.onClose), t3(a2.useRejections ? n2 : { value: n2 }));
      }, A2 = function(n2) {
        var i4 = n2 || window.event, l2 = i4.target || i4.srcElement, s2 = w(), u3 = C(), c3 = s2 && (s2 === l2 || s2.contains(l2)), d2 = u3 && (u3 === l2 || u3.contains(l2));
        switch (i4.type) {
          case "mouseover":
          case "mouseup":
            a2.buttonsStyling && (c3 ? s2.style.backgroundColor = r(a2.confirmButtonColor, -0.1) : d2 && (u3.style.backgroundColor = r(a2.cancelButtonColor, -0.1)));
            break;
          case "mouseout":
            a2.buttonsStyling && (c3 ? s2.style.backgroundColor = a2.confirmButtonColor : d2 && (u3.style.backgroundColor = a2.cancelButtonColor));
            break;
          case "mousedown":
            a2.buttonsStyling && (c3 ? s2.style.backgroundColor = r(a2.confirmButtonColor, -0.2) : d2 && (u3.style.backgroundColor = r(a2.cancelButtonColor, -0.2)));
            break;
          case "click":
            if (c3 && e2.isVisible()) if (e2.disableButtons(), a2.input) {
              var p2 = f2();
              a2.inputValidator ? (e2.disableInput(), a2.inputValidator(p2, a2.extraParams).then(function() {
                e2.enableButtons(), e2.enableInput(), m2(p2);
              }, function(t4) {
                e2.enableButtons(), e2.enableInput(), t4 && e2.showValidationError(t4);
              })) : m2(p2);
            } else m2(true);
            else d2 && e2.isVisible() && (e2.disableButtons(), e2.closeModal(a2.onClose), a2.useRejections ? o3("cancel") : t3({ dismiss: "cancel" }));
        }
      }, V2 = c2.querySelectorAll("button"), O2 = 0; O2 < V2.length; O2++) V2[O2].onclick = A2, V2[O2].onmouseover = A2, V2[O2].onmouseout = A2, V2[O2].onmousedown = A2;
      x().onclick = function() {
        e2.closeModal(a2.onClose), a2.useRejections ? o3("close") : t3({ dismiss: "close" });
      }, u2.onclick = function(n2) {
        n2.target === u2 && a2.allowOutsideClick && (e2.closeModal(a2.onClose), a2.useRejections ? o3("overlay") : t3({ dismiss: "overlay" }));
      };
      var H2 = k(), N2 = w(), j2 = C();
      a2.reverseButtons ? N2.parentNode.insertBefore(j2, N2) : N2.parentNode.insertBefore(N2, j2);
      var D2 = function(e3, t4) {
        for (var n2 = S(a2.focusCancel), o4 = 0; o4 < n2.length; o4++) {
          (e3 += t4) === n2.length ? e3 = 0 : -1 === e3 && (e3 = n2.length - 1);
          var r2 = n2[e3];
          if (M(r2)) return r2.focus();
        }
      }, U2 = function(n2) {
        var r2 = n2 || window.event;
        if ("Enter" === r2.key && r2.keyCode !== 229) r2.target === i3() && (e2.clickConfirm(), r2.preventDefault());
        else if ("Tab" === r2.key && r2.keyCode !== 229) {
          for (var l2 = r2.target || r2.srcElement, s2 = S(a2.focusCancel), u3 = -1, c3 = 0; c3 < s2.length; c3++) if (l2 === s2[c3]) {
            u3 = c3;
            break;
          }
          r2.shiftKey ? D2(u3, -1) : D2(u3, 1), r2.stopPropagation(), r2.preventDefault();
        } else ["ArrowLeft", "ArrowRight", "ArrowUp", "Arrowdown"].includes(r2.key) ? document.activeElement === N2 && M(j2) ? j2.focus() : document.activeElement === j2 && M(N2) && N2.focus() : "Escape" === r2.key && r2.keyCode !== 229 && true === a2.allowEscapeKey && (e2.closeModal(a2.onClose), a2.useRejections ? o3("esc") : t3({ dismiss: "esc" }));
      };
      window.onkeydown && window.onkeydown.toString() === U2.toString() || (s.previousWindowKeyDown = window.onkeydown, window.onkeydown = U2), a2.buttonsStyling && (N2.style.borderLeftColor = a2.confirmButtonColor, N2.style.borderRightColor = a2.confirmButtonColor), e2.hideLoading = e2.disableLoading = function() {
        a2.showConfirmButton || (q(N2), a2.showCancelButton || q(k())), P(H2, n.loading), P(c2, n.loading), c2.removeAttribute("aria-busy"), N2.disabled = false, j2.disabled = false;
      }, e2.getTitle = function() {
        return v();
      }, e2.getContent = function() {
        return g();
      }, e2.getInput = function() {
        return i3();
      }, e2.getImage = function() {
        return h();
      }, e2.getButtonsWrapper = function() {
        return k();
      }, e2.getConfirmButton = function() {
        return w();
      }, e2.getCancelButton = function() {
        return C();
      }, e2.enableButtons = function() {
        N2.disabled = false, j2.disabled = false;
      }, e2.disableButtons = function() {
        N2.disabled = true, j2.disabled = true;
      }, e2.enableConfirmButton = function() {
        N2.disabled = false;
      }, e2.disableConfirmButton = function() {
        N2.disabled = true;
      }, e2.enableInput = function() {
        var e3 = i3();
        if (!e3) return false;
        if ("radio" === e3.type) for (var t4 = e3.parentNode.parentNode.querySelectorAll("input"), n2 = 0; n2 < t4.length; n2++) t4[n2].disabled = false;
        else e3.disabled = false;
      }, e2.disableInput = function() {
        var e3 = i3();
        if (!e3) return false;
        if (e3 && "radio" === e3.type) for (var t4 = e3.parentNode.parentNode.querySelectorAll("input"), n2 = 0; n2 < t4.length; n2++) t4[n2].disabled = true;
        else e3.disabled = true;
      }, e2.recalculateHeight = I(function() {
        var e3 = p();
        if (e3) {
          var t4 = e3.style.display;
          e3.style.minHeight = "", T(e3), e3.style.minHeight = e3.scrollHeight + 1 + "px", e3.style.display = t4;
        }
      }, 50), e2.showValidationError = function(e3) {
        var t4 = y();
        t4.innerHTML = e3, T(t4);
        var o4 = i3();
        o4 && (o4.setAttribute("aria-invalid", true), o4.setAttribute("aria-describedBy", n.validationerror), B(o4), E(o4, n.inputerror));
      }, e2.resetValidationError = function() {
        var t4 = y();
        q(t4), e2.recalculateHeight();
        var o4 = i3();
        o4 && (o4.removeAttribute("aria-invalid"), o4.removeAttribute("aria-describedBy"), P(o4, n.inputerror));
      }, e2.getProgressSteps = function() {
        return a2.progressSteps;
      }, e2.setProgressSteps = function(e3) {
        a2.progressSteps = e3, z(a2);
      }, e2.showProgressSteps = function() {
        T(b());
      }, e2.hideProgressSteps = function() {
        q(b());
      }, e2.enableButtons(), e2.hideLoading(), e2.resetValidationError();
      for (var W2 = ["input", "file", "range", "select", "radio", "checkbox", "textarea"], Z2 = void 0, Q2 = 0; Q2 < W2.length; Q2++) {
        var Y2 = n[W2[Q2]], $2 = L(c2, Y2);
        if (Z2 = i3(W2[Q2])) {
          for (var J2 in Z2.attributes) if (Z2.attributes.hasOwnProperty(J2)) {
            var X = Z2.attributes[J2].name;
            "type" !== X && "value" !== X && Z2.removeAttribute(X);
          }
          for (var F in a2.inputAttributes) Z2.setAttribute(F, a2.inputAttributes[F]);
        }
        $2.className = Y2, a2.inputClass && E($2, a2.inputClass), q($2);
      }
      var G = void 0;
      switch (a2.input) {
        case "text":
        case "email":
        case "password":
        case "number":
        case "tel":
        case "url":
          (Z2 = L(c2, n.input)).value = a2.inputValue, Z2.placeholder = a2.inputPlaceholder, Z2.type = a2.input, T(Z2);
          break;
        case "file":
          (Z2 = L(c2, n.file)).placeholder = a2.inputPlaceholder, Z2.type = a2.input, T(Z2);
          break;
        case "range":
          var ee = L(c2, n.range), te = ee.querySelector("input"), ne = ee.querySelector("output");
          te.value = a2.inputValue, te.type = a2.input, ne.value = a2.inputValue, T(ee);
          break;
        case "select":
          var oe = L(c2, n.select);
          if (oe.innerHTML = "", a2.inputPlaceholder) {
            var re = document.createElement("option");
            re.innerHTML = a2.inputPlaceholder, re.value = "", re.disabled = true, re.selected = true, oe.appendChild(re);
          }
          G = function(e3) {
            for (var t4 in e3) {
              var n2 = document.createElement("option");
              n2.value = t4, n2.innerHTML = e3[t4], a2.inputValue.toString() === t4 && (n2.selected = true), oe.appendChild(n2);
            }
            T(oe), oe.focus();
          };
          break;
        case "radio":
          var ie = L(c2, n.radio);
          ie.innerHTML = "", G = function(e3) {
            for (var t4 in e3) {
              var o4 = document.createElement("input"), r2 = document.createElement("label"), i4 = document.createElement("span");
              o4.type = "radio", o4.name = n.radio, o4.value = t4, a2.inputValue.toString() === t4 && (o4.checked = true), i4.innerHTML = e3[t4], r2.appendChild(o4), r2.appendChild(i4), r2.for = o4.id, ie.appendChild(r2);
            }
            T(ie);
            var l2 = ie.querySelectorAll("input");
            l2.length && l2[0].focus();
          };
          break;
        case "checkbox":
          var ae = L(c2, n.checkbox), le = i3("checkbox");
          le.type = "checkbox", le.value = 1, le.id = n.checkbox, le.checked = Boolean(a2.inputValue);
          var se = ae.getElementsByTagName("span");
          se.length && ae.removeChild(se[0]), (se = document.createElement("span")).innerHTML = a2.inputPlaceholder, ae.appendChild(se), T(ae);
          break;
        case "textarea":
          var ue = L(c2, n.textarea);
          ue.value = a2.inputValue, ue.placeholder = a2.inputPlaceholder, T(ue);
          break;
        case null:
          break;
        default:
          l('Unexpected type of input! Expected "text", "email", "password", "number", "tel", "select", "radio", "checkbox", "textarea", "file" or "url", got "' + a2.input + '"');
      }
      "select" !== a2.input && "radio" !== a2.input || (a2.inputOptions instanceof Promise ? (e2.showLoading(), a2.inputOptions.then(function(t4) {
        e2.hideLoading(), G(t4);
      })) : "object" === R(a2.inputOptions) ? G(a2.inputOptions) : l("Unexpected type of inputOptions! Expected object or Promise, got " + R(a2.inputOptions))), _(a2.animation, a2.onBeforeOpen, a2.onOpen), a2.allowEnterKey ? a2.focusCancel && M(j2) ? j2.focus() : a2.focusConfirm && M(N2) ? N2.focus() : D2(-1, 1) : document.activeElement && document.activeElement.blur(), d().scrollTop = 0, "undefined" == typeof MutationObserver || K || (K = new MutationObserver(e2.recalculateHeight)).observe(c2, { childList: true, characterData: true, subtree: true });
    });
  };
  return J.isVisible = function() {
    return !!p();
  }, J.queue = function(e2) {
    W = e2;
    var t2 = function() {
      W = [], document.body.removeAttribute("data-swal2-queue-step");
    }, n2 = [];
    return new Promise(function(e3, o2) {
      !function r2(i2, a2) {
        i2 < W.length ? (document.body.setAttribute("data-swal2-queue-step", i2), J(W[i2]).then(function(e4) {
          n2.push(e4), r2(i2 + 1, a2);
        }, function(e4) {
          t2(), o2(e4);
        })) : (t2(), e3(n2));
      }(0);
    });
  }, J.getQueueStep = function() {
    return document.body.getAttribute("data-swal2-queue-step");
  }, J.insertQueueStep = function(e2, t2) {
    return t2 && t2 < W.length ? W.splice(t2, 0, e2) : W.push(e2);
  }, J.deleteQueueStep = function(e2) {
    void 0 !== W[e2] && W.splice(e2, 1);
  }, J.close = J.closeModal = function(e2) {
    var t2 = d(), o2 = p();
    if (o2) {
      P(o2, n.show), E(o2, n.hide), clearTimeout(o2.timeout), N();
      var r2 = function() {
        t2.parentNode && t2.parentNode.removeChild(t2), P(document.documentElement, n.shown), P(document.body, n.shown), Q(), $();
      };
      H && !A(o2, n.noanimation) ? o2.addEventListener(H, function e3() {
        o2.removeEventListener(H, e3), A(o2, n.hide) && r2();
      }) : r2(), null !== e2 && "function" == typeof e2 && setTimeout(function() {
        e2(o2);
      });
    }
  }, J.clickConfirm = function() {
    return w().click();
  }, J.clickCancel = function() {
    return C().click();
  }, J.showLoading = J.enableLoading = function() {
    var e2 = p();
    e2 || J(""), e2 = p();
    var t2 = k(), o2 = w(), r2 = C();
    T(t2), T(o2, "inline-block"), E(t2, n.loading), E(e2, n.loading), o2.disabled = true, r2.disabled = true, e2.setAttribute("aria-busy", true), e2.focus();
  }, J.isValidParameter = function(t2) {
    return e.hasOwnProperty(t2) || "extraParams" === t2;
  }, J.setDefaults = function(e2) {
    if (!e2 || "object" !== (void 0 === e2 ? "undefined" : R(e2))) return l("the argument for setDefaults() is required and has to be a object");
    for (var t2 in e2) J.isValidParameter(t2) || (a('Unknown parameter "' + t2 + '"'), delete e2[t2]);
    D(U, e2);
  }, J.resetDefaults = function() {
    U = D({}, e);
  }, J.noop = function() {
  }, J.version = "6.11.0", J.default = J, J;
}), window.Sweetalert2 && (window.sweetAlert = window.swal = window.Sweetalert2);
