"use strict";
/*! flatpickr v3.0.6, @license MIT */
function FlatpickrInstance(e, t) {
  function n(e2) {
    return e2.bind(De);
  }
  function a(e2) {
    De.config.noCalendar && !De.selectedDates.length && (De.selectedDates = [De.now]), he(e2), De.selectedDates.length && (!De.minDateHasTime || "input" !== e2.type || e2.target.value.length >= 2 ? (i(), le()) : setTimeout(function() {
      i(), le();
    }, 1e3));
  }
  function i() {
    if (De.config.enableTime) {
      var e2 = (parseInt(De.hourElement.value, 10) || 0) % (De.amPM ? 12 : 24), t2 = (parseInt(De.minuteElement.value, 10) || 0) % 60, n2 = De.config.enableSeconds ? (parseInt(De.secondElement.value, 10) || 0) % 60 : 0;
      void 0 !== De.amPM && (e2 = e2 % 12 + 12 * ("PM" === De.amPM.textContent)), De.minDateHasTime && 0 === pe(De.latestSelectedDateObj, De.config.minDate) && (e2 = Math.max(e2, De.config.minDate.getHours())) === De.config.minDate.getHours() && (t2 = Math.max(t2, De.config.minDate.getMinutes())), De.maxDateHasTime && 0 === pe(De.latestSelectedDateObj, De.config.maxDate) && (e2 = Math.min(e2, De.config.maxDate.getHours())) === De.config.maxDate.getHours() && (t2 = Math.min(t2, De.config.maxDate.getMinutes())), o(e2, t2, n2);
    }
  }
  function r(e2) {
    var t2 = e2 || De.latestSelectedDateObj;
    t2 && o(t2.getHours(), t2.getMinutes(), t2.getSeconds());
  }
  function o(e2, t2, n2) {
    De.selectedDates.length && De.latestSelectedDateObj.setHours(e2 % 24, t2, n2 || 0, 0), De.config.enableTime && !De.isMobile && (De.hourElement.value = De.pad(De.config.time_24hr ? e2 : (12 + e2) % 12 + 12 * (e2 % 12 == 0)), De.minuteElement.value = De.pad(t2), De.config.time_24hr || (De.amPM.textContent = e2 >= 12 ? "PM" : "AM"), true === De.config.enableSeconds && (De.secondElement.value = De.pad(n2)));
  }
  function l(e2) {
    var t2 = e2.target.value;
    e2.delta && (t2 = (parseInt(t2) + e2.delta).toString()), 4 !== t2.length && "Enter" !== e2.key || (De.currentYearElement.blur(), /[^\d]/.test(t2) || O(t2));
  }
  function c(e2, t2, n2) {
    return t2 instanceof Array ? t2.forEach(function(t3) {
      return c(e2, t3, n2);
    }) : e2 instanceof Array ? e2.forEach(function(e3) {
      return c(e3, t2, n2);
    }) : (e2.addEventListener(t2, n2), void De._handlers.push({ element: e2, event: t2, handler: n2 }));
  }
  function s(e2) {
    return function(t2) {
      return 1 === t2.which && e2(t2);
    };
  }
  function d() {
    if (De._handlers = [], De._animationLoop = [], De.config.wrap && ["open", "close", "toggle", "clear"].forEach(function(e3) {
      Array.prototype.forEach.call(De.element.querySelectorAll("[data-" + e3 + "]"), function(t2) {
        return c(t2, "mousedown", s(De[e3]));
      });
    }), De.isMobile) return ee();
    if (De.debouncedResize = ge(j, 50), De.triggerChange = function() {
      ne("Change");
    }, De.debouncedChange = ge(De.triggerChange, 300), "range" === De.config.mode && De.daysContainer && c(De.daysContainer, "mouseover", function(e3) {
      return P(e3.target);
    }), c(window.document.body, "keydown", L), De.config.static || c(De._input, "keydown", L), De.config.inline || De.config.static || c(window, "resize", De.debouncedResize), void 0 !== window.ontouchstart && c(window.document, "touchstart", Y), c(window.document, "mousedown", s(Y)), c(De._input, "blur", Y), true === De.config.clickOpens && (c(De._input, "focus", De.open), c(De._input, "mousedown", s(De.open))), De.config.noCalendar || (De.monthNav.addEventListener("wheel", function(e3) {
      return e3.preventDefault();
    }), c(De.monthNav, "wheel", ge(se, 10)), c(De.monthNav, "mousedown", s(de)), c(De.monthNav, ["keyup", "increment"], l), c(De.daysContainer, "mousedown", s(U)), De.config.animate && (c(De.daysContainer, ["webkitAnimationEnd", "animationend"], f), c(De.monthNav, ["webkitAnimationEnd", "animationend"], m))), De.config.enableTime) {
      var e2 = function(e3) {
        return e3.target.select();
      };
      c(De.timeContainer, ["wheel", "input", "increment"], a), c(De.timeContainer, "mousedown", s(p)), c(De.timeContainer, ["wheel", "increment"], De.debouncedChange), c(De.timeContainer, "input", De.triggerChange), c([De.hourElement, De.minuteElement], "focus", e2), void 0 !== De.secondElement && c(De.secondElement, "focus", function() {
        return De.secondElement.select();
      }), void 0 !== De.amPM && c(De.amPM, "mousedown", s(function(e3) {
        a(e3), De.triggerChange(e3);
      }));
    }
  }
  function u() {
    for (var e2 = De._animationLoop.length; e2--; ) De._animationLoop[e2](), De._animationLoop.splice(e2, 1);
  }
  function f(e2) {
    if (De.daysContainer.childNodes.length > 1) switch (e2.animationName) {
      case "fpSlideLeft":
        De.daysContainer.lastChild.classList.remove("slideLeftNew"), De.daysContainer.removeChild(De.daysContainer.firstChild), De.days = De.daysContainer.firstChild, u();
        break;
      case "fpSlideRight":
        De.daysContainer.firstChild.classList.remove("slideRightNew"), De.daysContainer.removeChild(De.daysContainer.lastChild), De.days = De.daysContainer.firstChild, u();
    }
  }
  function m(e2) {
    switch (e2.animationName) {
      case "fpSlideLeftNew":
      case "fpSlideRightNew":
        De.navigationCurrentMonth.classList.remove("slideLeftNew"), De.navigationCurrentMonth.classList.remove("slideRightNew");
        for (var t2 = De.navigationCurrentMonth; t2.nextSibling && /curr/.test(t2.nextSibling.className); ) De.monthNav.removeChild(t2.nextSibling);
        for (; t2.previousSibling && /curr/.test(t2.previousSibling.className); ) De.monthNav.removeChild(t2.previousSibling);
        De.oldCurMonth = null;
    }
  }
  function g(e2) {
    e2 = e2 ? De.parseDate(e2) : De.latestSelectedDateObj || (De.config.minDate > De.now ? De.config.minDate : De.config.maxDate && De.config.maxDate < De.now ? De.config.maxDate : De.now);
    try {
      De.currentYear = e2.getFullYear(), De.currentMonth = e2.getMonth();
    } catch (t2) {
      console.error(t2.stack), console.warn("Invalid date supplied: " + e2);
    }
    De.redraw();
  }
  function p(e2) {
    ~e2.target.className.indexOf("arrow") && h(e2, e2.target.classList.contains("arrowUp") ? 1 : -1);
  }
  function h(e2, t2, n2) {
    var a2 = n2 || e2.target.parentNode.childNodes[0], i2 = ae("increment");
    i2.delta = t2, a2.dispatchEvent(i2);
  }
  function D(e2) {
    var t2 = ue("div", "numInputWrapper"), n2 = ue("input", "numInput " + e2), a2 = ue("span", "arrowUp"), i2 = ue("span", "arrowDown");
    return n2.type = "text", n2.pattern = "\\d*", t2.appendChild(n2), t2.appendChild(a2), t2.appendChild(i2), t2;
  }
  function v() {
    var e2 = window.document.createDocumentFragment();
    De.calendarContainer = ue("div", "flatpickr-calendar"), De.calendarContainer.tabIndex = -1, De.config.noCalendar || (e2.appendChild(k()), De.innerContainer = ue("div", "flatpickr-innerContainer"), De.config.weekNumbers && De.innerContainer.appendChild(N()), De.rContainer = ue("div", "flatpickr-rContainer"), De.rContainer.appendChild(E()), De.daysContainer || (De.daysContainer = ue("div", "flatpickr-days"), De.daysContainer.tabIndex = -1), M(), De.rContainer.appendChild(De.daysContainer), De.innerContainer.appendChild(De.rContainer), e2.appendChild(De.innerContainer)), De.config.enableTime && e2.appendChild(x()), me(De.calendarContainer, "rangeMode", "range" === De.config.mode), me(De.calendarContainer, "animate", De.config.animate), De.calendarContainer.appendChild(e2);
    var t2 = De.config.appendTo && De.config.appendTo.nodeType;
    if (De.config.inline || De.config.static) {
      if (De.calendarContainer.classList.add(De.config.inline ? "inline" : "static"), De.config.inline && !t2) return De.element.parentNode.insertBefore(De.calendarContainer, De._input.nextSibling);
      if (De.config.static) {
        var n2 = ue("div", "flatpickr-wrapper");
        return De.element.parentNode.insertBefore(n2, De.element), n2.appendChild(De.element), De.altInput && n2.appendChild(De.altInput), void n2.appendChild(De.calendarContainer);
      }
    }
    (t2 ? De.config.appendTo : window.document.body).appendChild(De.calendarContainer);
  }
  function C(e2, t2, n2, a2) {
    var i2 = A(t2, true), r2 = ue("span", "flatpickr-day " + e2, t2.getDate());
    return r2.dateObj = t2, r2.$i = a2, r2.setAttribute("aria-label", De.formatDate(t2, De.config.ariaDateFormat)), 0 === pe(t2, De.now) && (De.todayDateElem = r2, r2.classList.add("today")), i2 ? (r2.tabIndex = -1, ie(t2) && (r2.classList.add("selected"), De.selectedDateElem = r2, "range" === De.config.mode && (me(r2, "startRange", 0 === pe(t2, De.selectedDates[0])), me(r2, "endRange", 0 === pe(t2, De.selectedDates[1]))))) : (r2.classList.add("disabled"), De.selectedDates[0] && t2 > De.minRangeDate && t2 < De.selectedDates[0] ? De.minRangeDate = t2 : De.selectedDates[0] && t2 < De.maxRangeDate && t2 > De.selectedDates[0] && (De.maxRangeDate = t2)), "range" === De.config.mode && (re(t2) && !ie(t2) && r2.classList.add("inRange"), 1 === De.selectedDates.length && (t2 < De.minRangeDate || t2 > De.maxRangeDate) && r2.classList.add("notAllowed")), De.config.weekNumbers && "prevMonthDay" !== e2 && n2 % 7 == 1 && De.weekNumbers.insertAdjacentHTML("beforeend", "<span class='disabled flatpickr-day'>" + De.config.getWeek(t2) + "</span>"), ne("DayCreate", r2), r2;
  }
  function w(e2, t2) {
    var n2 = e2 + t2 || 0, a2 = void 0 !== e2 ? De.days.childNodes[n2] : De.selectedDateElem || De.todayDateElem || De.days.childNodes[0], i2 = function() {
      (a2 = a2 || De.days.childNodes[n2]).focus(), "range" === De.config.mode && P(a2);
    };
    if (void 0 === a2 && 0 !== t2) return t2 > 0 ? (De.changeMonth(1), n2 %= 42) : t2 < 0 && (De.changeMonth(-1), n2 += 42), b(i2);
    i2();
  }
  function b(e2) {
    if (true === De.config.animate) return De._animationLoop.push(e2);
    e2();
  }
  function M(e2) {
    var t2 = (new Date(De.currentYear, De.currentMonth, 1).getDay() - De.l10n.firstDayOfWeek + 7) % 7, n2 = "range" === De.config.mode;
    De.prevMonthDays = De.utils.getDaysinMonth((De.currentMonth - 1 + 12) % 12), De.selectedDateElem = void 0, De.todayDateElem = void 0;
    var a2 = De.utils.getDaysinMonth(), i2 = window.document.createDocumentFragment(), r2 = De.prevMonthDays + 1 - t2, o2 = 0;
    for (De.config.weekNumbers && De.weekNumbers.firstChild && (De.weekNumbers.textContent = ""), n2 && (De.minRangeDate = new Date(De.currentYear, De.currentMonth - 1, r2), De.maxRangeDate = new Date(De.currentYear, De.currentMonth + 1, (42 - t2) % a2)); r2 <= De.prevMonthDays; r2++, o2++) i2.appendChild(C("prevMonthDay", new Date(De.currentYear, De.currentMonth - 1, r2), r2, o2));
    for (r2 = 1; r2 <= a2; r2++, o2++) i2.appendChild(C("", new Date(De.currentYear, De.currentMonth, r2), r2, o2));
    for (var l2 = a2 + 1; l2 <= 42 - t2; l2++, o2++) i2.appendChild(C("nextMonthDay", new Date(De.currentYear, De.currentMonth + 1, l2 % a2), l2, o2));
    n2 && 1 === De.selectedDates.length && i2.childNodes[0] ? (De._hidePrevMonthArrow = De._hidePrevMonthArrow || De.minRangeDate > i2.childNodes[0].dateObj, De._hideNextMonthArrow = De._hideNextMonthArrow || De.maxRangeDate < new Date(De.currentYear, De.currentMonth + 1, 1)) : oe();
    var c2 = ue("div", "dayContainer");
    if (c2.appendChild(i2), De.config.animate && void 0 !== e2) for (; De.daysContainer.childNodes.length > 1; ) De.daysContainer.removeChild(De.daysContainer.firstChild);
    else y(De.daysContainer);
    return e2 >= 0 ? De.daysContainer.appendChild(c2) : De.daysContainer.insertBefore(c2, De.daysContainer.firstChild), De.days = De.daysContainer.firstChild, De.daysContainer;
  }
  function y(e2) {
    for (; e2.firstChild; ) e2.removeChild(e2.firstChild);
  }
  function k() {
    var e2 = window.document.createDocumentFragment();
    De.monthNav = ue("div", "flatpickr-month"), De.prevMonthNav = ue("span", "flatpickr-prev-month"), De.prevMonthNav.innerHTML = De.config.prevArrow, De.currentMonthElement = ue("span", "cur-month"), De.currentMonthElement.title = De.l10n.scrollTitle;
    var t2 = D("cur-year");
    return De.currentYearElement = t2.childNodes[0], De.currentYearElement.title = De.l10n.scrollTitle, De.config.minDate && (De.currentYearElement.min = De.config.minDate.getFullYear()), De.config.maxDate && (De.currentYearElement.max = De.config.maxDate.getFullYear(), De.currentYearElement.disabled = De.config.minDate && De.config.minDate.getFullYear() === De.config.maxDate.getFullYear()), De.nextMonthNav = ue("span", "flatpickr-next-month"), De.nextMonthNav.innerHTML = De.config.nextArrow, De.navigationCurrentMonth = ue("span", "flatpickr-current-month"), De.navigationCurrentMonth.appendChild(De.currentMonthElement), De.navigationCurrentMonth.appendChild(t2), e2.appendChild(De.prevMonthNav), e2.appendChild(De.navigationCurrentMonth), e2.appendChild(De.nextMonthNav), De.monthNav.appendChild(e2), Object.defineProperty(De, "_hidePrevMonthArrow", { get: function() {
      return this.__hidePrevMonthArrow;
    }, set: function(e3) {
      this.__hidePrevMonthArrow !== e3 && (De.prevMonthNav.style.display = e3 ? "none" : "block"), this.__hidePrevMonthArrow = e3;
    } }), Object.defineProperty(De, "_hideNextMonthArrow", { get: function() {
      return this.__hideNextMonthArrow;
    }, set: function(e3) {
      this.__hideNextMonthArrow !== e3 && (De.nextMonthNav.style.display = e3 ? "none" : "block"), this.__hideNextMonthArrow = e3;
    } }), oe(), De.monthNav;
  }
  function x() {
    De.calendarContainer.classList.add("hasTime"), De.config.noCalendar && De.calendarContainer.classList.add("noCalendar"), De.timeContainer = ue("div", "flatpickr-time"), De.timeContainer.tabIndex = -1;
    var e2 = ue("span", "flatpickr-time-separator", ":"), t2 = D("flatpickr-hour");
    De.hourElement = t2.childNodes[0];
    var n2 = D("flatpickr-minute");
    if (De.minuteElement = n2.childNodes[0], De.hourElement.tabIndex = De.minuteElement.tabIndex = -1, De.hourElement.value = De.pad(De.latestSelectedDateObj ? De.latestSelectedDateObj.getHours() : De.config.defaultHour), De.minuteElement.value = De.pad(De.latestSelectedDateObj ? De.latestSelectedDateObj.getMinutes() : De.config.defaultMinute), De.hourElement.step = De.config.hourIncrement, De.minuteElement.step = De.config.minuteIncrement, De.hourElement.min = De.config.time_24hr ? 0 : 1, De.hourElement.max = De.config.time_24hr ? 23 : 12, De.minuteElement.min = 0, De.minuteElement.max = 59, De.hourElement.title = De.minuteElement.title = De.l10n.scrollTitle, De.timeContainer.appendChild(t2), De.timeContainer.appendChild(e2), De.timeContainer.appendChild(n2), De.config.time_24hr && De.timeContainer.classList.add("time24hr"), De.config.enableSeconds) {
      De.timeContainer.classList.add("hasSeconds");
      var a2 = D("flatpickr-second");
      De.secondElement = a2.childNodes[0], De.secondElement.value = De.latestSelectedDateObj ? De.pad(De.latestSelectedDateObj.getSeconds()) : "00", De.secondElement.step = De.minuteElement.step, De.secondElement.min = De.minuteElement.min, De.secondElement.max = De.minuteElement.max, De.timeContainer.appendChild(ue("span", "flatpickr-time-separator", ":")), De.timeContainer.appendChild(a2);
    }
    return De.config.time_24hr || (De.amPM = ue("span", "flatpickr-am-pm", ["AM", "PM"][De.hourElement.value > 11 | 0]), De.amPM.title = De.l10n.toggleTitle, De.amPM.tabIndex = -1, De.timeContainer.appendChild(De.amPM)), De.timeContainer;
  }
  function E() {
    De.weekdayContainer || (De.weekdayContainer = ue("div", "flatpickr-weekdays"));
    var e2 = De.l10n.firstDayOfWeek, t2 = De.l10n.weekdays.shorthand.slice();
    return e2 > 0 && e2 < t2.length && (t2 = [].concat(t2.splice(e2, t2.length), t2.splice(0, e2))), De.weekdayContainer.innerHTML = "\n		<span class=flatpickr-weekday>\n			" + t2.join("</span><span class=flatpickr-weekday>") + "\n		</span>\n		", De.weekdayContainer;
  }
  function N() {
    return De.calendarContainer.classList.add("hasWeeks"), De.weekWrapper = ue("div", "flatpickr-weekwrapper"), De.weekWrapper.appendChild(ue("span", "flatpickr-weekday", De.l10n.weekAbbreviation)), De.weekNumbers = ue("div", "flatpickr-weeks"), De.weekWrapper.appendChild(De.weekNumbers), De.weekWrapper;
  }
  function _(e2, t2, n2) {
    var a2 = (t2 = void 0 === t2 || t2) ? e2 : e2 - De.currentMonth, i2 = !De.config.animate || false === n2;
    if (!(a2 < 0 && De._hidePrevMonthArrow || a2 > 0 && De._hideNextMonthArrow)) {
      if (De.currentMonth += a2, (De.currentMonth < 0 || De.currentMonth > 11) && (De.currentYear += De.currentMonth > 11 ? 1 : -1, De.currentMonth = (De.currentMonth + 12) % 12, ne("YearChange")), M(i2 ? void 0 : a2), i2) return ne("MonthChange"), oe();
      var r2 = De.navigationCurrentMonth;
      if (a2 < 0) for (; r2.nextSibling && /curr/.test(r2.nextSibling.className); ) De.monthNav.removeChild(r2.nextSibling);
      else if (a2 > 0) for (; r2.previousSibling && /curr/.test(r2.previousSibling.className); ) De.monthNav.removeChild(r2.previousSibling);
      if (De.oldCurMonth = De.navigationCurrentMonth, De.navigationCurrentMonth = De.monthNav.insertBefore(De.oldCurMonth.cloneNode(true), a2 > 0 ? De.oldCurMonth.nextSibling : De.oldCurMonth), a2 > 0 ? (De.daysContainer.firstChild.classList.add("slideLeft"), De.daysContainer.lastChild.classList.add("slideLeftNew"), De.oldCurMonth.classList.add("slideLeft"), De.navigationCurrentMonth.classList.add("slideLeftNew")) : a2 < 0 && (De.daysContainer.firstChild.classList.add("slideRightNew"), De.daysContainer.lastChild.classList.add("slideRight"), De.oldCurMonth.classList.add("slideRight"), De.navigationCurrentMonth.classList.add("slideRightNew")), De.currentMonthElement = De.navigationCurrentMonth.firstChild, De.currentYearElement = De.navigationCurrentMonth.lastChild.childNodes[0], oe(), De.oldCurMonth.firstChild.textContent = De.utils.monthToStr(De.currentMonth - a2), ne("MonthChange"), document.activeElement && document.activeElement.$i) {
        var o2 = document.activeElement.$i;
        b(function() {
          w(o2, 0);
        });
      }
    }
  }
  function T(e2) {
    De.input.value = "", De.altInput && (De.altInput.value = ""), De.mobileInput && (De.mobileInput.value = ""), De.selectedDates = [], De.latestSelectedDateObj = void 0, De.showTimeInput = false, De.redraw(), false !== e2 && ne("Change");
  }
  function I() {
    De.isOpen = false, De.isMobile || (De.calendarContainer.classList.remove("open"), De._input.classList.remove("active")), ne("Close");
  }
  function S() {
    void 0 !== De.config && ne("Destroy");
    for (var e2 = De._handlers.length; e2--; ) {
      var t2 = De._handlers[e2];
      t2.element.removeEventListener(t2.event, t2.handler);
    }
    De._handlers = [], De.mobileInput ? (De.mobileInput.parentNode && De.mobileInput.parentNode.removeChild(De.mobileInput), De.mobileInput = null) : De.calendarContainer && De.calendarContainer.parentNode && De.calendarContainer.parentNode.removeChild(De.calendarContainer), De.altInput && (De.input.type = "text", De.altInput.parentNode && De.altInput.parentNode.removeChild(De.altInput), delete De.altInput), De.input && (De.input.type = De.input._type, De.input.classList.remove("flatpickr-input"), De.input.removeAttribute("readonly"), De.input.value = ""), ["_showTimeInput", "latestSelectedDateObj", "_hideNextMonthArrow", "_hidePrevMonthArrow", "__hideNextMonthArrow", "__hidePrevMonthArrow", "isMobile", "isOpen", "selectedDateElem", "minDateHasTime", "maxDateHasTime", "days", "daysContainer", "_input", "_positionElement", "innerContainer", "rContainer", "monthNav", "todayDateElem", "calendarContainer", "weekdayContainer", "prevMonthNav", "nextMonthNav", "currentMonthElement", "currentYearElement", "navigationCurrentMonth", "selectedDateElem", "config"].forEach(function(e3) {
      return delete De[e3];
    });
  }
  function F(e2) {
    return !(!De.config.appendTo || !De.config.appendTo.contains(e2)) || De.calendarContainer.contains(e2);
  }
  function Y(e2) {
    if (De.isOpen && !De.config.inline) {
      var t2 = F(e2.target), n2 = e2.target === De.input || e2.target === De.altInput || De.element.contains(e2.target) || e2.path && e2.path.indexOf && (~e2.path.indexOf(De.input) || ~e2.path.indexOf(De.altInput));
      ("blur" === e2.type ? n2 && e2.relatedTarget && !F(e2.relatedTarget) : !n2 && !t2) && -1 === De.config.ignoredFocusElements.indexOf(e2.target) && (De.close(), "range" === De.config.mode && 1 === De.selectedDates.length && (De.clear(false), De.redraw()));
    }
  }
  function O(e2) {
    if (!(!e2 || De.currentYearElement.min && e2 < De.currentYearElement.min || De.currentYearElement.max && e2 > De.currentYearElement.max)) {
      var t2 = parseInt(e2, 10), n2 = De.currentYear !== t2;
      De.currentYear = t2 || De.currentYear, De.config.maxDate && De.currentYear === De.config.maxDate.getFullYear() ? De.currentMonth = Math.min(De.config.maxDate.getMonth(), De.currentMonth) : De.config.minDate && De.currentYear === De.config.minDate.getFullYear() && (De.currentMonth = Math.max(De.config.minDate.getMonth(), De.currentMonth)), n2 && (De.redraw(), ne("YearChange"));
    }
  }
  function A(e2, t2) {
    if (De.config.minDate && pe(e2, De.config.minDate, void 0 !== t2 ? t2 : !De.minDateHasTime) < 0 || De.config.maxDate && pe(e2, De.config.maxDate, void 0 !== t2 ? t2 : !De.maxDateHasTime) > 0) return false;
    if (!De.config.enable.length && !De.config.disable.length) return true;
    for (var n2, a2 = De.parseDate(e2, null, true), i2 = De.config.enable.length > 0, r2 = i2 ? De.config.enable : De.config.disable, o2 = 0; o2 < r2.length; o2++) {
      if ((n2 = r2[o2]) instanceof Function && n2(a2)) return i2;
      if (n2 instanceof Date && n2.getTime() === a2.getTime()) return i2;
      if ("string" == typeof n2 && De.parseDate(n2, null, true).getTime() === a2.getTime()) return i2;
      if ("object" === (void 0 === n2 ? "undefined" : _typeof(n2)) && n2.from && n2.to && a2 >= n2.from && a2 <= n2.to) return i2;
    }
    return !i2;
  }
  function L(e2) {
    var t2 = e2.target === De._input, n2 = F(e2.target), r2 = De.config.allowInput, o2 = De.isOpen && (!r2 || !t2), l2 = De.config.inline && t2 && !r2;
    if ("Enter" === e2.key && r2 && t2) return De.setDate(De._input.value, true, e2.target === De.altInput ? De.config.altFormat : De.config.dateFormat), e2.target.blur();
    if (n2 || o2 || l2) {
      var c2 = De.timeContainer && De.timeContainer.contains(e2.target);
      switch (e2.key) {
        case "Enter":
          c2 ? le() : U(e2);
          break;
        case "Escape":
          e2.preventDefault(), De.close();
          break;
        case "ArrowLeft":
        case "ArrowRight":
          if (!c2) if (e2.preventDefault(), De.daysContainer) {
            var s2 = "ArrowRight" === e2.key ? 1 : -1;
            e2.ctrlKey ? _(s2, true) : w(e2.target.$i, s2);
          } else De.config.enableTime && !c2 && De.hourElement.focus();
          break;
        case "ArrowUp":
        case "ArrowDown":
          e2.preventDefault();
          var d2 = "ArrowDown" === e2.key ? 1 : -1;
          De.daysContainer ? e2.ctrlKey ? (O(De.currentYear - d2), w(e2.target.$i, 0)) : c2 || w(e2.target.$i, 7 * d2) : De.config.enableTime && (c2 || De.hourElement.focus(), a(e2));
          break;
        case "Tab":
          e2.target === De.hourElement ? (e2.preventDefault(), De.minuteElement.select()) : e2.target === De.minuteElement && (De.secondElement || De.amPM) ? (e2.preventDefault(), (De.secondElement || De.amPM).focus()) : e2.target === De.secondElement && (e2.preventDefault(), De.amPM.focus());
          break;
        case "a":
          e2.target === De.amPM && (De.amPM.textContent = "AM", i(), le());
          break;
        case "p":
          e2.target === De.amPM && (De.amPM.textContent = "PM", i(), le());
      }
      ne("KeyDown", e2);
    }
  }
  function P(e2) {
    if (1 === De.selectedDates.length && e2.classList.contains("flatpickr-day")) {
      for (var t2 = e2.dateObj, n2 = De.parseDate(De.selectedDates[0], null, true), a2 = Math.min(t2.getTime(), De.selectedDates[0].getTime()), i2 = Math.max(t2.getTime(), De.selectedDates[0].getTime()), r2 = false, o2 = a2; o2 < i2; o2 += De.utils.duration.DAY) if (!A(new Date(o2))) {
        r2 = true;
        break;
      }
      for (var l2 = De.days.childNodes[0].dateObj.getTime(), c2 = 0; c2 < 42; c2++, l2 += De.utils.duration.DAY) {
        (function(o3, l3) {
          var c3 = o3 < De.minRangeDate.getTime() || o3 > De.maxRangeDate.getTime(), s2 = De.days.childNodes[l3];
          if (c3) return De.days.childNodes[l3].classList.add("notAllowed"), ["inRange", "startRange", "endRange"].forEach(function(e3) {
            s2.classList.remove(e3);
          }), "continue";
          if (r2 && !c3) return "continue";
          ["startRange", "inRange", "endRange", "notAllowed"].forEach(function(e3) {
            s2.classList.remove(e3);
          });
          var d2 = Math.max(De.minRangeDate.getTime(), a2), u2 = Math.min(De.maxRangeDate.getTime(), i2);
          e2.classList.add(t2 < De.selectedDates[0] ? "startRange" : "endRange"), n2 < t2 && o3 === n2.getTime() ? s2.classList.add("startRange") : n2 > t2 && o3 === n2.getTime() && s2.classList.add("endRange"), o3 >= d2 && o3 <= u2 && s2.classList.add("inRange");
        })(l2, c2);
      }
    }
  }
  function j() {
    !De.isOpen || De.config.static || De.config.inline || J();
  }
  function H(e2, t2) {
    if (De.isMobile) return e2 && (e2.preventDefault(), e2.target.blur()), setTimeout(function() {
      De.mobileInput.click();
    }, 0), void ne("Open");
    De.isOpen || De._input.disabled || De.config.inline || (De.isOpen = true, De.calendarContainer.classList.add("open"), J(t2), De._input.classList.add("active"), ne("Open"));
  }
  function R(e2) {
    return function(t2) {
      var n2 = De.config["_" + e2 + "Date"] = De.parseDate(t2), a2 = De.config["_" + ("min" === e2 ? "max" : "min") + "Date"], i2 = t2 && n2 instanceof Date;
      i2 && (De[e2 + "DateHasTime"] = n2.getHours() || n2.getMinutes() || n2.getSeconds()), De.selectedDates && (De.selectedDates = De.selectedDates.filter(function(e3) {
        return A(e3);
      }), De.selectedDates.length || "min" !== e2 || r(n2), le()), De.daysContainer && (K(), i2 ? De.currentYearElement[e2] = n2.getFullYear() : De.currentYearElement.removeAttribute(e2), De.currentYearElement.disabled = a2 && n2 && a2.getFullYear() === n2.getFullYear());
    };
  }
  function W() {
    var e2 = ["wrap", "weekNumbers", "allowInput", "clickOpens", "time_24hr", "enableTime", "noCalendar", "altInput", "shorthandCurrentMonth", "inline", "static", "enableSeconds", "disableMobile"], t2 = ["onChange", "onClose", "onDayCreate", "onDestroy", "onKeyDown", "onMonthChange", "onOpen", "onParseConfig", "onReady", "onValueUpdate", "onYearChange"];
    De.config = Object.create(flatpickr.defaultConfig);
    var a2 = _extends({}, De.instanceConfig, JSON.parse(JSON.stringify(De.element.dataset || {})));
    De.config.parseDate = a2.parseDate, De.config.formatDate = a2.formatDate, Object.defineProperty(De.config, "enable", { get: function() {
      return De.config._enable || [];
    }, set: function(e3) {
      return De.config._enable = G(e3);
    } }), Object.defineProperty(De.config, "disable", { get: function() {
      return De.config._disable || [];
    }, set: function(e3) {
      return De.config._disable = G(e3);
    } }), _extends(De.config, a2), !a2.dateFormat && a2.enableTime && (De.config.dateFormat = De.config.noCalendar ? "H:i" + (De.config.enableSeconds ? ":S" : "") : flatpickr.defaultConfig.dateFormat + " H:i" + (De.config.enableSeconds ? ":S" : "")), a2.altInput && a2.enableTime && !a2.altFormat && (De.config.altFormat = De.config.noCalendar ? "h:i" + (De.config.enableSeconds ? ":S K" : " K") : flatpickr.defaultConfig.altFormat + " h:i" + (De.config.enableSeconds ? ":S" : "") + " K"), Object.defineProperty(De.config, "minDate", { get: function() {
      return this._minDate;
    }, set: R("min") }), Object.defineProperty(De.config, "maxDate", { get: function() {
      return this._maxDate;
    }, set: R("max") }), De.config.minDate = a2.minDate, De.config.maxDate = a2.maxDate;
    for (var i2 = 0; i2 < e2.length; i2++) De.config[e2[i2]] = true === De.config[e2[i2]] || "true" === De.config[e2[i2]];
    for (var r2 = t2.length; r2--; ) void 0 !== De.config[t2[r2]] && (De.config[t2[r2]] = fe(De.config[t2[r2]] || []).map(n));
    for (var o2 = 0; o2 < De.config.plugins.length; o2++) {
      var l2 = De.config.plugins[o2](De) || {};
      for (var c2 in l2) De.config[c2] instanceof Array || ~t2.indexOf(c2) ? De.config[c2] = fe(l2[c2]).map(n).concat(De.config[c2]) : void 0 === a2[c2] && (De.config[c2] = l2[c2]);
    }
    ne("ParseConfig");
  }
  function B() {
    "object" !== _typeof(De.config.locale) && void 0 === flatpickr.l10ns[De.config.locale] && console.warn("flatpickr: invalid locale " + De.config.locale), De.l10n = _extends(Object.create(flatpickr.l10ns.default), "object" === _typeof(De.config.locale) ? De.config.locale : "default" !== De.config.locale ? flatpickr.l10ns[De.config.locale] || {} : {});
  }
  function J() {
    var e2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : De._positionElement;
    if (void 0 !== De.calendarContainer) {
      var t2 = De.calendarContainer.offsetHeight, n2 = De.calendarContainer.offsetWidth, a2 = De.config.position, i2 = e2.getBoundingClientRect(), r2 = window.innerHeight - i2.bottom, o2 = "above" === a2 || "below" !== a2 && r2 < t2 && i2.top > t2, l2 = window.pageYOffset + i2.top + (o2 ? -t2 - 2 : e2.offsetHeight + 2);
      if (me(De.calendarContainer, "arrowTop", !o2), me(De.calendarContainer, "arrowBottom", o2), !De.config.inline) {
        var c2 = window.pageXOffset + i2.left, s2 = window.document.body.offsetWidth - i2.right, d2 = c2 + n2 > window.document.body.offsetWidth;
        me(De.calendarContainer, "rightMost", d2), De.config.static || (De.calendarContainer.style.top = l2 + "px", d2 ? (De.calendarContainer.style.left = "auto", De.calendarContainer.style.right = s2 + "px") : (De.calendarContainer.style.left = c2 + "px", De.calendarContainer.style.right = "auto"));
      }
    }
  }
  function K() {
    De.config.noCalendar || De.isMobile || (E(), oe(), M());
  }
  function U(e2) {
    if (e2.preventDefault(), e2.stopPropagation(), e2.target.classList.contains("flatpickr-day") && !e2.target.classList.contains("disabled") && !e2.target.classList.contains("notAllowed")) {
      var t2 = De.latestSelectedDateObj = new Date(e2.target.dateObj.getTime()), n2 = t2.getMonth() !== De.currentMonth && "range" !== De.config.mode;
      if (De.selectedDateElem = e2.target, "single" === De.config.mode) De.selectedDates = [t2];
      else if ("multiple" === De.config.mode) {
        var a2 = ie(t2);
        a2 ? De.selectedDates.splice(a2, 1) : De.selectedDates.push(t2);
      } else "range" === De.config.mode && (2 === De.selectedDates.length && De.clear(), De.selectedDates.push(t2), 0 !== pe(t2, De.selectedDates[0], true) && De.selectedDates.sort(function(e3, t3) {
        return e3.getTime() - t3.getTime();
      }));
      if (i(), n2) {
        var o2 = De.currentYear !== t2.getFullYear();
        De.currentYear = t2.getFullYear(), De.currentMonth = t2.getMonth(), o2 && ne("YearChange"), ne("MonthChange");
      }
      if (M(), De.minDateHasTime && De.config.enableTime && 0 === pe(t2, De.config.minDate) && r(De.config.minDate), le(), De.config.enableTime && setTimeout(function() {
        return De.showTimeInput = true;
      }, 50), "range" === De.config.mode && (1 === De.selectedDates.length ? (P(e2.target), De._hidePrevMonthArrow = De._hidePrevMonthArrow || De.minRangeDate > De.days.childNodes[0].dateObj, De._hideNextMonthArrow = De._hideNextMonthArrow || De.maxRangeDate < new Date(De.currentYear, De.currentMonth + 1, 1)) : oe()), ne("Change"), n2 ? b(function() {
        return De.selectedDateElem.focus();
      }) : w(e2.target.$i, 0), De.config.enableTime && setTimeout(function() {
        return De.hourElement.select();
      }, 451), De.config.closeOnSelect) {
        var l2 = "single" === De.config.mode && !De.config.enableTime, c2 = "range" === De.config.mode && 2 === De.selectedDates.length && !De.config.enableTime;
        (l2 || c2) && De.close();
      }
    }
  }
  function $(e2, t2) {
    De.config[e2] = t2, De.redraw(), g();
  }
  function z(e2, t2) {
    if (e2 instanceof Array) De.selectedDates = e2.map(function(e3) {
      return De.parseDate(e3, t2);
    });
    else if (e2 instanceof Date || !isNaN(e2)) De.selectedDates = [De.parseDate(e2, t2)];
    else if (e2 && e2.substring) switch (De.config.mode) {
      case "single":
        De.selectedDates = [De.parseDate(e2, t2)];
        break;
      case "multiple":
        De.selectedDates = e2.split("; ").map(function(e3) {
          return De.parseDate(e3, t2);
        });
        break;
      case "range":
        De.selectedDates = e2.split(De.l10n.rangeSeparator).map(function(e3) {
          return De.parseDate(e3, t2);
        });
    }
    De.selectedDates = De.selectedDates.filter(function(e3) {
      return e3 instanceof Date && A(e3, false);
    }), De.selectedDates.sort(function(e3, t3) {
      return e3.getTime() - t3.getTime();
    });
  }
  function q(e2, t2, n2) {
    if (0 !== e2 && !e2) return De.clear(t2);
    z(e2, n2), De.showTimeInput = De.selectedDates.length > 0, De.latestSelectedDateObj = De.selectedDates[0], De.redraw(), g(), r(), le(t2), t2 && ne("Change");
  }
  function G(e2) {
    for (var t2 = e2.length; t2--; ) "string" == typeof e2[t2] || +e2[t2] ? e2[t2] = De.parseDate(e2[t2], null, true) : e2[t2] && e2[t2].from && e2[t2].to && (e2[t2].from = De.parseDate(e2[t2].from), e2[t2].to = De.parseDate(e2[t2].to));
    return e2.filter(function(e3) {
      return e3;
    });
  }
  function V() {
    De.selectedDates = [], De.now = /* @__PURE__ */ new Date();
    var e2 = De.config.defaultDate || De.input.value;
    e2 && z(e2, De.config.dateFormat);
    var t2 = De.selectedDates.length ? De.selectedDates[0] : De.config.minDate && De.config.minDate.getTime() > De.now ? De.config.minDate : De.config.maxDate && De.config.maxDate.getTime() < De.now ? De.config.maxDate : De.now;
    De.currentYear = t2.getFullYear(), De.currentMonth = t2.getMonth(), De.selectedDates.length && (De.latestSelectedDateObj = De.selectedDates[0]), De.minDateHasTime = De.config.minDate && (De.config.minDate.getHours() || De.config.minDate.getMinutes() || De.config.minDate.getSeconds()), De.maxDateHasTime = De.config.maxDate && (De.config.maxDate.getHours() || De.config.maxDate.getMinutes() || De.config.maxDate.getSeconds()), Object.defineProperty(De, "latestSelectedDateObj", { get: function() {
      return De._selectedDateObj || De.selectedDates[De.selectedDates.length - 1];
    }, set: function(e3) {
      De._selectedDateObj = e3;
    } }), De.isMobile || Object.defineProperty(De, "showTimeInput", { get: function() {
      return De._showTimeInput;
    }, set: function(e3) {
      De._showTimeInput = e3, De.calendarContainer && me(De.calendarContainer, "showTimeInput", e3), J();
    } });
  }
  function Z() {
    De.utils = { duration: { DAY: 864e5 }, getDaysinMonth: function(e2, t2) {
      return e2 = void 0 === e2 ? De.currentMonth : e2, t2 = void 0 === t2 ? De.currentYear : t2, 1 === e2 && (t2 % 4 == 0 && t2 % 100 != 0 || t2 % 400 == 0) ? 29 : De.l10n.daysInMonth[e2];
    }, monthToStr: function(e2, t2) {
      return t2 = void 0 === t2 ? De.config.shorthandCurrentMonth : t2, De.l10n.months[(t2 ? "short" : "long") + "hand"][e2];
    } };
  }
  function Q() {
    De.formats = Object.create(FlatpickrInstance.prototype.formats), ["D", "F", "J", "M", "W", "l"].forEach(function(e2) {
      De.formats[e2] = FlatpickrInstance.prototype.formats[e2].bind(De);
    }), De.revFormat.F = FlatpickrInstance.prototype.revFormat.F.bind(De), De.revFormat.M = FlatpickrInstance.prototype.revFormat.M.bind(De);
  }
  function X() {
    if (De.input = De.config.wrap ? De.element.querySelector("[data-input]") : De.element, !De.input) return console.warn("Error: invalid input element specified", De.input);
    De.input._type = De.input.type, De.input.type = "text", De.input.classList.add("flatpickr-input"), De._input = De.input, De.config.altInput && (De.altInput = ue(De.input.nodeName, De.input.className + " " + De.config.altInputClass), De._input = De.altInput, De.altInput.placeholder = De.input.placeholder, De.altInput.disabled = De.input.disabled, De.altInput.required = De.input.required, De.altInput.type = "text", De.input.type = "hidden", !De.config.static && De.input.parentNode && De.input.parentNode.insertBefore(De.altInput, De.input.nextSibling)), De.config.allowInput || De._input.setAttribute("readonly", "readonly"), De._positionElement = De.config.positionElement || De._input;
  }
  function ee() {
    var e2 = De.config.enableTime ? De.config.noCalendar ? "time" : "datetime-local" : "date";
    De.mobileInput = ue("input", De.input.className + " flatpickr-mobile"), De.mobileInput.step = "any", De.mobileInput.tabIndex = 1, De.mobileInput.type = e2, De.mobileInput.disabled = De.input.disabled, De.mobileInput.placeholder = De.input.placeholder, De.mobileFormatStr = "datetime-local" === e2 ? "Y-m-d\\TH:i:S" : "date" === e2 ? "Y-m-d" : "H:i:S", De.selectedDates.length && (De.mobileInput.defaultValue = De.mobileInput.value = De.formatDate(De.selectedDates[0], De.mobileFormatStr)), De.config.minDate && (De.mobileInput.min = De.formatDate(De.config.minDate, "Y-m-d")), De.config.maxDate && (De.mobileInput.max = De.formatDate(De.config.maxDate, "Y-m-d")), De.input.type = "hidden", De.config.altInput && (De.altInput.type = "hidden");
    try {
      De.input.parentNode.insertBefore(De.mobileInput, De.input.nextSibling);
    } catch (e3) {
    }
    De.mobileInput.addEventListener("change", function(e3) {
      De.setDate(e3.target.value, false, De.mobileFormatStr), ne("Change"), ne("Close");
    });
  }
  function te() {
    if (De.isOpen) return De.close();
    De.open();
  }
  function ne(e2, t2) {
    var n2 = De.config["on" + e2];
    if (void 0 !== n2 && n2.length > 0) for (var a2 = 0; n2[a2] && a2 < n2.length; a2++) n2[a2](De.selectedDates, De.input.value, De, t2);
    "Change" === e2 && (De.input.dispatchEvent(ae("change")), De.input.dispatchEvent(ae("input")));
  }
  function ae(e2) {
    return De._supportsEvents ? new Event(e2, { bubbles: true }) : (De._[e2 + "Event"] = document.createEvent("Event"), De._[e2 + "Event"].initEvent(e2, true, true), De._[e2 + "Event"]);
  }
  function ie(e2) {
    for (var t2 = 0; t2 < De.selectedDates.length; t2++) if (0 === pe(De.selectedDates[t2], e2)) return "" + t2;
    return false;
  }
  function re(e2) {
    return !("range" !== De.config.mode || De.selectedDates.length < 2) && (pe(e2, De.selectedDates[0]) >= 0 && pe(e2, De.selectedDates[1]) <= 0);
  }
  function oe() {
    De.config.noCalendar || De.isMobile || !De.monthNav || (De.currentMonthElement.textContent = De.utils.monthToStr(De.currentMonth) + " ", De.currentYearElement.value = De.currentYear, De._hidePrevMonthArrow = De.config.minDate && (De.currentYear === De.config.minDate.getFullYear() ? De.currentMonth <= De.config.minDate.getMonth() : De.currentYear < De.config.minDate.getFullYear()), De._hideNextMonthArrow = De.config.maxDate && (De.currentYear === De.config.maxDate.getFullYear() ? De.currentMonth + 1 > De.config.maxDate.getMonth() : De.currentYear > De.config.maxDate.getFullYear()));
  }
  function le(e2) {
    if (!De.selectedDates.length) return De.clear(e2);
    De.isMobile && (De.mobileInput.value = De.selectedDates.length ? De.formatDate(De.latestSelectedDateObj, De.mobileFormatStr) : "");
    var t2 = "range" !== De.config.mode ? "; " : De.l10n.rangeSeparator;
    De.input.value = De.selectedDates.map(function(e3) {
      return De.formatDate(e3, De.config.dateFormat);
    }).join(t2), De.config.altInput && (De.altInput.value = De.selectedDates.map(function(e3) {
      return De.formatDate(e3, De.config.altFormat);
    }).join(t2)), false !== e2 && ne("ValueUpdate");
  }
  function ce(e2) {
    return Math.max(-1, Math.min(1, e2.wheelDelta || -e2.deltaY));
  }
  function se(e2) {
    e2.preventDefault();
    var t2 = De.currentYearElement.parentNode.contains(e2.target);
    if (e2.target === De.currentMonthElement || t2) {
      var n2 = ce(e2);
      t2 ? (O(De.currentYear + n2), e2.target.value = De.currentYear) : De.changeMonth(n2, true, false);
    }
  }
  function de(e2) {
    var t2 = De.prevMonthNav.contains(e2.target), n2 = De.nextMonthNav.contains(e2.target);
    t2 || n2 ? _(t2 ? -1 : 1) : e2.target === De.currentYearElement ? (e2.preventDefault(), De.currentYearElement.select()) : "arrowUp" === e2.target.className ? De.changeYear(De.currentYear + 1) : "arrowDown" === e2.target.className && De.changeYear(De.currentYear - 1);
  }
  function ue(e2, t2, n2) {
    var a2 = window.document.createElement(e2);
    return t2 = t2 || "", n2 = n2 || "", a2.className = t2, void 0 !== n2 && (a2.textContent = n2), a2;
  }
  function fe(e2) {
    return e2 instanceof Array ? e2 : [e2];
  }
  function me(e2, t2, n2) {
    if (n2) return e2.classList.add(t2);
    e2.classList.remove(t2);
  }
  function ge(e2, t2, n2) {
    var a2 = void 0;
    return function() {
      var i2 = this, r2 = arguments;
      clearTimeout(a2), a2 = setTimeout(function() {
        a2 = null, n2 || e2.apply(i2, r2);
      }, t2), n2 && !a2 && e2.apply(i2, r2);
    };
  }
  function pe(e2, t2, n2) {
    return e2 instanceof Date && t2 instanceof Date && (false !== n2 ? new Date(e2.getTime()).setHours(0, 0, 0, 0) - new Date(t2.getTime()).setHours(0, 0, 0, 0) : e2.getTime() - t2.getTime());
  }
  function he(e2) {
    e2.preventDefault();
    var t2 = "keydown" === e2.type, n2 = (e2.type, e2.type, e2.target);
    if (De.amPM && e2.target === De.amPM) return e2.target.textContent = ["AM", "PM"]["AM" === e2.target.textContent | 0];
    var a2 = Number(n2.min), i2 = Number(n2.max), r2 = Number(n2.step), o2 = parseInt(n2.value, 10), l2 = o2 + r2 * (e2.delta || (t2 ? 38 === e2.which ? 1 : -1 : Math.max(-1, Math.min(1, e2.wheelDelta || -e2.deltaY)) || 0));
    if (void 0 !== n2.value && 2 === n2.value.length) {
      var c2 = n2 === De.hourElement, s2 = n2 === De.minuteElement;
      l2 < a2 ? (l2 = i2 + l2 + !c2 + (c2 && !De.amPM), s2 && h(null, -1, De.hourElement)) : l2 > i2 && (l2 = n2 === De.hourElement ? l2 - i2 - !De.amPM : a2, s2 && h(null, 1, De.hourElement)), De.amPM && c2 && (1 === r2 ? l2 + o2 === 23 : Math.abs(l2 - o2) > r2) && (De.amPM.textContent = "PM" === De.amPM.textContent ? "AM" : "PM"), n2.value = De.pad(l2);
    }
  }
  var De = this;
  return De._ = {}, De._.afterDayAnim = b, De._bind = c, De._compareDates = pe, De._setHoursFromDate = r, De.changeMonth = _, De.changeYear = O, De.clear = T, De.close = I, De._createElement = ue, De.destroy = S, De.isEnabled = A, De.jumpToDate = g, De.open = H, De.redraw = K, De.set = $, De.setDate = q, De.toggle = te, function() {
    De.element = De.input = e, De.instanceConfig = t || {}, De.parseDate = FlatpickrInstance.prototype.parseDate.bind(De), De.formatDate = FlatpickrInstance.prototype.formatDate.bind(De), Q(), W(), B(), X(), V(), Z(), De.isOpen = false, De.isMobile = !De.config.disableMobile && !De.config.inline && "single" === De.config.mode && !De.config.disable.length && !De.config.enable.length && !De.config.weekNumbers && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent), De.isMobile || v(), d(), (De.selectedDates.length || De.config.noCalendar) && (De.config.enableTime && r(De.config.noCalendar ? De.latestSelectedDateObj || De.config.minDate : null), le()), De.showTimeInput = De.selectedDates.length > 0 || De.config.noCalendar, De.config.weekNumbers && (De.calendarContainer.style.width = De.daysContainer.offsetWidth + De.weekWrapper.offsetWidth + "px"), De.isMobile || J(), ne("Ready");
  }(), De;
}
function _flatpickr(e, t) {
  for (var n = Array.prototype.slice.call(e), a = [], i = 0; i < n.length; i++) try {
    if (null !== n[i].getAttribute("data-fp-omit")) continue;
    n[i]._flatpickr && (n[i]._flatpickr.destroy(), n[i]._flatpickr = null), n[i]._flatpickr = new FlatpickrInstance(n[i], t || {}), a.push(n[i]._flatpickr);
  } catch (e2) {
    console.warn(e2, e2.stack);
  }
  return 1 === a.length ? a[0] : a;
}
function flatpickr(e, t) {
  return e instanceof NodeList ? _flatpickr(e, t) : e instanceof HTMLElement ? _flatpickr([e], t) : _flatpickr(window.document.querySelectorAll(e), t);
}
var _extends = Object.assign || function(e) {
  for (var t = 1; t < arguments.length; t++) {
    var n = arguments[t];
    for (var a in n) Object.prototype.hasOwnProperty.call(n, a) && (e[a] = n[a]);
  }
  return e;
}, _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e) {
  return typeof e;
} : function(e) {
  return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e;
};
FlatpickrInstance.prototype = { formats: { Z: function(e) {
  return e.toISOString();
}, D: function(e) {
  return this.l10n.weekdays.shorthand[this.formats.w(e)];
}, F: function(e) {
  return this.utils.monthToStr(this.formats.n(e) - 1, false);
}, G: function(e) {
  return FlatpickrInstance.prototype.pad(FlatpickrInstance.prototype.formats.h(e));
}, H: function(e) {
  return FlatpickrInstance.prototype.pad(e.getHours());
}, J: function(e) {
  return e.getDate() + this.l10n.ordinal(e.getDate());
}, K: function(e) {
  return e.getHours() > 11 ? "PM" : "AM";
}, M: function(e) {
  return this.utils.monthToStr(e.getMonth(), true);
}, S: function(e) {
  return FlatpickrInstance.prototype.pad(e.getSeconds());
}, U: function(e) {
  return e.getTime() / 1e3;
}, W: function(e) {
  return this.config.getWeek(e);
}, Y: function(e) {
  return e.getFullYear();
}, d: function(e) {
  return FlatpickrInstance.prototype.pad(e.getDate());
}, h: function(e) {
  return e.getHours() % 12 ? e.getHours() % 12 : 12;
}, i: function(e) {
  return FlatpickrInstance.prototype.pad(e.getMinutes());
}, j: function(e) {
  return e.getDate();
}, l: function(e) {
  return this.l10n.weekdays.longhand[e.getDay()];
}, m: function(e) {
  return FlatpickrInstance.prototype.pad(e.getMonth() + 1);
}, n: function(e) {
  return e.getMonth() + 1;
}, s: function(e) {
  return e.getSeconds();
}, w: function(e) {
  return e.getDay();
}, y: function(e) {
  return String(e.getFullYear()).substring(2);
} }, formatDate: function(e, t) {
  var n = this;
  return void 0 !== this.config && void 0 !== this.config.formatDate ? this.config.formatDate(e, t) : t.split("").map(function(t2, a, i) {
    return n.formats[t2] && "\\" !== i[a - 1] ? n.formats[t2](e) : "\\" !== t2 ? t2 : "";
  }).join("");
}, revFormat: { D: function() {
}, F: function(e, t) {
  e.setMonth(this.l10n.months.longhand.indexOf(t));
}, G: function(e, t) {
  e.setHours(parseFloat(t));
}, H: function(e, t) {
  e.setHours(parseFloat(t));
}, J: function(e, t) {
  e.setDate(parseFloat(t));
}, K: function(e, t) {
  var n = e.getHours();
  12 !== n && e.setHours(n % 12 + 12 * /pm/i.test(t));
}, M: function(e, t) {
  e.setMonth(this.l10n.months.shorthand.indexOf(t));
}, S: function(e, t) {
  e.setSeconds(t);
}, U: function(e, t) {
  return new Date(1e3 * parseFloat(t));
}, W: function(e, t) {
  return t = parseInt(t), new Date(e.getFullYear(), 0, 2 + 7 * (t - 1), 0, 0, 0, 0, 0);
}, Y: function(e, t) {
  e.setFullYear(t);
}, Z: function(e, t) {
  return new Date(t);
}, d: function(e, t) {
  e.setDate(parseFloat(t));
}, h: function(e, t) {
  e.setHours(parseFloat(t));
}, i: function(e, t) {
  e.setMinutes(parseFloat(t));
}, j: function(e, t) {
  e.setDate(parseFloat(t));
}, l: function() {
}, m: function(e, t) {
  e.setMonth(parseFloat(t) - 1);
}, n: function(e, t) {
  e.setMonth(parseFloat(t) - 1);
}, s: function(e, t) {
  e.setSeconds(parseFloat(t));
}, w: function() {
}, y: function(e, t) {
  e.setFullYear(2e3 + parseFloat(t));
} }, tokenRegex: { D: "(\\w+)", F: "(\\w+)", G: "(\\d\\d|\\d)", H: "(\\d\\d|\\d)", J: "(\\d\\d|\\d)\\w+", K: "(am|AM|Am|aM|pm|PM|Pm|pM)", M: "(\\w+)", S: "(\\d\\d|\\d)", U: "(.+)", W: "(\\d\\d|\\d)", Y: "(\\d{4})", Z: "(.+)", d: "(\\d\\d|\\d)", h: "(\\d\\d|\\d)", i: "(\\d\\d|\\d)", j: "(\\d\\d|\\d)", l: "(\\w+)", m: "(\\d\\d|\\d)", n: "(\\d\\d|\\d)", s: "(\\d\\d|\\d)", w: "(\\d\\d|\\d)", y: "(\\d{2})" }, pad: function(e) {
  return ("0" + e).slice(-2);
}, parseDate: function(e, t, n) {
  if (0 !== e && !e) return null;
  var a = e;
  if (e instanceof Date) e = new Date(e.getTime());
  else if (void 0 !== e.toFixed) e = new Date(e);
  else {
    var i = t || (this.config || flatpickr.defaultConfig).dateFormat;
    if ("today" === (e = String(e).trim())) e = /* @__PURE__ */ new Date(), n = true;
    else if (/Z$/.test(e) || /GMT$/.test(e)) e = new Date(e);
    else if (this.config && this.config.parseDate) e = this.config.parseDate(e, i);
    else {
      for (var r = this.config && this.config.noCalendar ? new Date((/* @__PURE__ */ new Date()).setHours(0, 0, 0, 0)) : new Date((/* @__PURE__ */ new Date()).getFullYear(), 0, 1, 0, 0, 0, 0), o = void 0, l = 0, c = 0, s = ""; l < i.length; l++) {
        var d = i[l], u = "\\" === d, f = "\\" === i[l - 1] || u;
        if (this.tokenRegex[d] && !f) {
          s += this.tokenRegex[d];
          var m = new RegExp(s).exec(e);
          m && (o = true) && (r = this.revFormat[d](r, m[++c]) || r);
        } else u || (s += ".");
      }
      e = o ? r : null;
    }
  }
  return e instanceof Date ? (true === n && e.setHours(0, 0, 0, 0), e) : (console.warn("flatpickr: invalid date " + a), console.info(this.element), null);
} }, "undefined" != typeof HTMLElement && (HTMLCollection.prototype.flatpickr = NodeList.prototype.flatpickr = function(e) {
  return _flatpickr(this, e);
}, HTMLElement.prototype.flatpickr = function(e) {
  return _flatpickr([this], e);
}), flatpickr.defaultConfig = FlatpickrInstance.defaultConfig = { mode: "single", position: "auto", animate: -1 === window.navigator.userAgent.indexOf("MSIE"), wrap: false, weekNumbers: false, allowInput: false, clickOpens: true, closeOnSelect: true, time_24hr: false, enableTime: false, noCalendar: false, dateFormat: "Y-m-d", ariaDateFormat: "F j, Y", altInput: false, altInputClass: "form-control input", altFormat: "F j, Y", defaultDate: null, minDate: null, maxDate: null, parseDate: null, formatDate: null, getWeek: function(e) {
  var t = new Date(e.getTime()), n = new Date(t.getFullYear(), 0, 1);
  return Math.ceil(((t - n) / 864e5 + n.getDay() + 1) / 7);
}, enable: [], disable: [], shorthandCurrentMonth: false, inline: false, static: false, appendTo: null, prevArrow: "<svg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 17 17'><g></g><path d='M5.207 8.471l7.146 7.147-0.707 0.707-7.853-7.854 7.854-7.853 0.707 0.707-7.147 7.146z' /></svg>", nextArrow: "<svg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 17 17'><g></g><path d='M13.207 8.472l-7.854 7.854-0.707-0.707 7.146-7.146-7.146-7.148 0.707-0.707 7.854 7.854z' /></svg>", enableSeconds: false, hourIncrement: 1, minuteIncrement: 5, defaultHour: 12, defaultMinute: 0, disableMobile: false, locale: "default", plugins: [], ignoredFocusElements: [], onClose: void 0, onChange: void 0, onDayCreate: void 0, onMonthChange: void 0, onOpen: void 0, onParseConfig: void 0, onReady: void 0, onValueUpdate: void 0, onYearChange: void 0, onKeyDown: void 0, onDestroy: void 0 }, flatpickr.l10ns = { en: { weekdays: { shorthand: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], longhand: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] }, months: { shorthand: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], longhand: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] }, daysInMonth: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], firstDayOfWeek: 0, ordinal: function(e) {
  var t = e % 100;
  if (t > 3 && t < 21) return "th";
  switch (t % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}, rangeSeparator: " ~ ", weekAbbreviation: "Wk", scrollTitle: "Scroll to increment", toggleTitle: "Click to toggle" } }, flatpickr.l10ns.default = Object.create(flatpickr.l10ns.en), flatpickr.localize = function(e) {
  return _extends(flatpickr.l10ns.default, e || {});
}, flatpickr.setDefaults = function(e) {
  return _extends(flatpickr.defaultConfig, e || {});
}, "undefined" != typeof jQuery && (jQuery.fn.flatpickr = function(e) {
  return _flatpickr(this, e);
}), Date.prototype.fp_incr = function(e) {
  return new Date(this.getFullYear(), this.getMonth(), this.getDate() + parseInt(e, 10));
}, "undefined" != typeof module && (module.exports = flatpickr);
