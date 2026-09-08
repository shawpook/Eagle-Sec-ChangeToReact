/**
 * b1-9bx2：flatpickr v3.0.6 自研月历（js/modules/flatpicker/flatpickr.min.js +
 * l10n/zh.js 退役；css/modules/flatpicker/flatpickr.min.css 保留=类名契约）。
 *
 * 契约 = 本仓消费面（考据定案见 PROGRESS b1-9bx2，beautified 716 行逐条）：
 * - 双全局：flatpickr（函数选择器包装 + statics defaultConfig/l10ns/localize/
 *   setDefaults）+ FlatpickrInstance（构造器）；
 * - `new FlatpickrInstance(input, {dateFormat:'Y-m-d', allowInput:false, locale,
 *   mode?:'range', onChange})`（FolderSelectPanels FlatpickrInput 消费面）；
 * - instance._input === input（__eagleRule 挂载点）+ setDate(Date|Date[])（不触发
 *   Change）+ destroy() 全清还原；
 * - 供给链 tests 断言（stage-smoke b1-9z）：typeof window.flatpickr === 'function'
 *   + l10ns.zh + new 返回实例三方法。
 * **enableTime 原框架即 no-op**（data-enabletime→dataset.enabletime 大小写错位，时间
 * 选择器从未渲染）——本实现 date-only 维持行为等价（录档）。
 * descope（消费面/tests 零触及）：altInput/mobile input、time picker 整面、weekNumbers/
 * inline/static/appendTo、plugins、keyboard 完整导航（保 Esc/Enter/年份输入）。
 */

const _w: any = window as any;

let installed = false;

/* ── en l10n（vendor 逐字） ── */
const EN_L10N: any = {
  weekdays: {
    shorthand: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    longhand: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  },
  months: {
    shorthand: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    longhand: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  },
  daysInMonth: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
  firstDayOfWeek: 0,
  ordinal: (day: number) => {
    const s = day % 100;
    if (s > 3 && s < 21) return 'th';
    switch (s % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  },
  rangeSeparator: ' ~ ',
  weekAbbreviation: 'Wk',
  scrollTitle: 'Scroll to increment',
  toggleTitle: 'Click to toggle',
};

/* ── zh l10n（l10n/zh.js 逐字；缺省键沿原型链落 en） ── */
const ZH_L10N: any = {
  weekdays: {
    shorthand: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
    longhand: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
  },
  months: {
    shorthand: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
    longhand: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
  },
  rangeSeparator: ' 至 ',
  weekAbbreviation: '周',
  scrollTitle: '滚动切换',
  toggleTitle: '点击切换 12/24 小时时制',
};

const L10NS: any = { en: EN_L10N };
L10NS.default = Object.create(EN_L10N);
L10NS.zh = ZH_L10N;

/* ── defaultConfig（vendor 逐字消费面相关键） ── */
const DEFAULT_CONFIG: any = {
  mode: 'single', position: 'auto', animate: window.navigator.userAgent.indexOf('MSIE') === -1,
  wrap: false, weekNumbers: false, allowInput: false, clickOpens: true, closeOnSelect: true,
  time_24hr: false, enableTime: false, noCalendar: false, dateFormat: 'Y-m-d',
  ariaDateFormat: 'F j, Y', altInput: false, altInputClass: 'form-control input', altFormat: 'F j, Y',
  defaultDate: null, minDate: null, maxDate: null, parseDate: null, formatDate: null,
  getWeek: (date: Date) => {
    const onejan = new Date(date.getFullYear(), 0, 1);
    return Math.ceil(((date.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  },
  enable: [], disable: [], shorthandCurrentMonth: false, inline: false, static: false, appendTo: null,
  prevArrow: "<svg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 17 17'><g></g><path d='M5.207 8.471l7.146 7.147-0.707 0.707-7.853-7.854 7.854-7.853 0.707 0.707-7.147 7.146z' /></svg>",
  nextArrow: "<svg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 17 17'><g></g><path d='M13.207 8.472l-7.854 7.854-0.707-0.707 7.146-7.146-7.146-7.148 0.707-0.707 7.854 7.854z' /></svg>",
  enableSeconds: false, hourIncrement: 1, minuteIncrement: 5, defaultHour: 12, defaultMinute: 0,
  disableMobile: false, locale: 'default', plugins: [], ignoredFocusElements: [],
};

const pad = (n: any) => ('0' + n).slice(-2);
const DAY_MS = 86400000;

class FlatpickrLite {
  element: any;
  instanceConfig: any;
  config: any;
  l10n: any;
  input: any;
  _input: any;
  _positionElement: any;
  selectedDates: Date[] = [];
  latestSelectedDateObj: any = null;
  now: Date;
  currentYear: number;
  currentMonth: number;
  isOpen = false;
  calendarContainer: any;
  monthNav: any;
  prevMonthNav: any;
  nextMonthNav: any;
  currentMonthElement: any;
  currentYearElement: any;
  weekdaysContainer: any;
  daysContainer: any;
  days: any;
  todayDateElem: any;
  selectedDateElem: any;
  minRangeDate: any;
  maxRangeDate: any;
  utils: any;
  _handlers: Array<{ element: any; event: any; handler: any }> = [];

  constructor(element: any, instanceConfig?: any) {
    this.element = element;
    this.instanceConfig = instanceConfig || {};
    this._input = element;
    /* W：config = defaults + instanceConfig + dataset（dataset 键 enabletime≠enableTime
     * 原样落位——vendor 语义逐字） */
    let dataset: any = {};
    try { dataset = JSON.parse(JSON.stringify(element.dataset || {})); } catch (e) { dataset = {}; }
    this.config = Object.assign({}, DEFAULT_CONFIG, this.instanceConfig, dataset);
    ['wrap', 'weekNumbers', 'allowInput', 'clickOpens', 'time_24hr', 'enableTime', 'noCalendar', 'altInput', 'shorthandCurrentMonth', 'inline', 'static', 'enableSeconds', 'disableMobile'].forEach((key) => {
      this.config[key] = this.config[key] === true || this.config[key] === 'true';
    });
    /* B：l10n 原型链 */
    if (typeof this.config.locale !== 'object' && L10NS[this.config.locale] === undefined && this.config.locale !== 'default' && this.config.locale !== 'en') {
      console.warn('flatpickr: invalid locale ' + this.config.locale);
    }
    this.l10n = Object.assign(Object.create(L10NS.default),
      typeof this.config.locale === 'object' ? this.config.locale
        : (this.config.locale !== 'default' ? L10NS[this.config.locale] || {} : {}));
    /* X：input 面 */
    this.input = element;
    if (!this.input || !this.input.tagName) { console.warn('Error: invalid input element specified', this.input); return; }
    this.input._type = this.input.type;
    this.input.type = 'text';
    this.input.classList.add('flatpickr-input');
    this._input = this.input;
    if (!this.config.allowInput) this._input.setAttribute('readonly', 'readonly');
    this._positionElement = this.config.positionElement || this._input;
    /* Z：utils */
    this.utils = {
      duration: { DAY: DAY_MS },
      getDaysinMonth: (month?: number, year?: number) => {
        month = month === undefined ? this.currentMonth : month;
        year = year === undefined ? this.currentYear : year;
        if (month === 1 && (year % 4 === 0 && year % 100 !== 0 || year % 400 === 0)) return 29;
        return this.l10n.daysInMonth[month];
      },
      monthToStr: (number: number, shorthand?: boolean) => {
        shorthand = shorthand === undefined ? this.config.shorthandCurrentMonth : shorthand;
        return this.l10n.months[(shorthand ? 'short' : 'long') + 'hand'][number];
      },
    };
    /* V：日期初始化 */
    this.now = new Date();
    this.selectedDates = [];
    const seed = this.config.defaultDate || this.input.value;
    if (seed) this.setSelectedDates(seed, this.config.dateFormat);
    const first = this.selectedDates.length ? this.selectedDates[0] : this.now;
    this.currentYear = first.getFullYear();
    this.currentMonth = first.getMonth();
    this.latestSelectedDateObj = this.selectedDates.length ? this.selectedDates[0] : null;
    /* 日历 DOM + 事件 */
    this.buildCalendar();
    this.bindEvents();
  }

  /* ── 日期比较（pe 逐字简化：日粒度） ── */
  private sameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  private isSelected(date: Date) {
    for (let i = 0; i < this.selectedDates.length; i++) if (this.sameDay(this.selectedDates[i], date)) return String(i);
    return false;
  }

  private inRange(date: Date) {
    if (this.config.mode !== 'range' || this.selectedDates.length < 2) return false;
    return date.getTime() >= this.selectedDates[0].getTime() && date.getTime() <= this.selectedDates[1].getTime();
  }

  /* ── 值回写（le） ── */
  private updateInputValue(triggerChange?: any) {
    if (!this.selectedDates.length) { this.clear(triggerChange); return; }
    const sep = this.config.mode !== 'range' ? '; ' : this.l10n.rangeSeparator;
    this.input.value = this.selectedDates.map((d) => this.formatDate(d, this.config.dateFormat)).join(sep);
    if (triggerChange !== false) this.trigger('ValueUpdate');
  }

  /* ── 格式化（formats 消费面 token） ── */
  formatDate(date: Date, format: string): string {
    if (this.config.formatDate) return this.config.formatDate(date, format);
    let out = '';
    for (let i = 0; i < format.length; i++) {
      const tok = format[i];
      const prev = format[i - 1];
      if (prev === '\\') { if (tok !== '\\') out += tok; continue; }
      if (tok === '\\') continue;
      out += this.formatToken(tok, date);
    }
    return out;
  }

  private formatToken(tok: string, date: Date): string {
    switch (tok) {
      case 'Y': return String(date.getFullYear());
      case 'y': return String(date.getFullYear()).substring(2);
      case 'm': return pad(date.getMonth() + 1);
      case 'n': return String(date.getMonth() + 1);
      case 'd': return pad(date.getDate());
      case 'j': return String(date.getDate());
      case 'J': return date.getDate() + this.l10n.ordinal(date.getDate());
      case 'H': return pad(date.getHours());
      case 'h': return String(date.getHours() % 12 ? date.getHours() % 12 : 12);
      case 'G': return pad(this.formatTokenH(date));
      case 'i': return pad(date.getMinutes());
      case 's': return String(date.getSeconds());
      case 'S': return pad(date.getSeconds());
      case 'K': return date.getHours() > 11 ? 'PM' : 'AM';
      case 'D': return this.l10n.weekdays.shorthand[date.getDay()];
      case 'l': return this.l10n.weekdays.longhand[date.getDay()];
      case 'F': return this.utils.monthToStr(date.getMonth(), false);
      case 'M': return this.utils.monthToStr(date.getMonth(), true);
      case 'U': return String(date.getTime() / 1000);
      case 'W': return String(this.config.getWeek(date));
      case 'w': return String(date.getDay());
      case 'Z': return date.toISOString();
      default: return tok;
    }
  }
  private formatTokenH(date: Date) { return date.getHours(); }

  /* ── 解析（parseDate 消费面：Date/number/'Y-m-d'） ── */
  parseDate(dateObj: any, format?: string, flipHours?: boolean): Date | null {
    if (dateObj === 0 || !dateObj) return null;
    let d: any = dateObj;
    if (dateObj instanceof Date) d = new Date(dateObj.getTime());
    else if (typeof dateObj === 'number') d = new Date(dateObj);
    else {
      const i = format || this.config.dateFormat;
      d = String(dateObj).trim();
      if (d === 'today') { d = new Date(); flipHours = true; }
      else if (/Z$/.test(d) || /GMT$/.test(d)) d = new Date(d);
      else if (this.config.parseDate) d = this.config.parseDate(d, i);
      else {
        const result = new Date(0);
        result.setFullYear(1970, 0, 1);
        result.setHours(0, 0, 0, 0);
        let matched = false;
        const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(d);
        if (i === 'Y-m-d' && m) { result.setFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3])); matched = true; }
        else { result.setTime(NaN); }
        d = matched ? result : (isNaN(new Date(d).getTime()) ? null : new Date(d));
      }
    }
    if (d instanceof Date && !isNaN(d.getTime())) {
      if (flipHours === true) d.setHours(0, 0, 0, 0);
      return d;
    }
    return null;
  }

  /* ── 选择集装载（z） ── */
  private setSelectedDates(dates: any, format?: string) {
    if (dates instanceof Array) this.selectedDates = dates.map((d) => this.parseDate(d, format)).filter(Boolean) as Date[];
    else if (dates instanceof Date || !isNaN(dates)) this.selectedDates = [this.parseDate(dates, format)].filter(Boolean) as Date[];
    else if (dates && dates.substring) {
      if (this.config.mode === 'single') this.selectedDates = [this.parseDate(dates, format)].filter(Boolean) as Date[];
      else if (this.config.mode === 'multiple') this.selectedDates = String(dates).split('; ').map((s) => this.parseDate(s, format)).filter(Boolean) as Date[];
      else this.selectedDates = String(dates).split(this.l10n.rangeSeparator).map((s) => this.parseDate(s, format)).filter(Boolean) as Date[];
    }
    this.selectedDates = this.selectedDates.filter((d) => d instanceof Date);
    this.selectedDates.sort((a, b) => a.getTime() - b.getTime());
  }

  /* ── 日历 DOM（v+k+E+M） ── */
  private buildCalendar() {
    const cal = document.createElement('div');
    cal.className = 'flatpickr-calendar';
    cal.tabIndex = -1;
    cal.style.position = 'absolute';
    cal.style.visibility = 'hidden';
    /* month nav */
    const monthNav = document.createElement('div');
    monthNav.className = 'flatpickr-month';
    const prev = document.createElement('span');
    prev.className = 'flatpickr-prev-month';
    prev.innerHTML = this.config.prevArrow;
    const curMonth = document.createElement('span');
    curMonth.className = 'cur-month';
    curMonth.title = this.l10n.scrollTitle;
    const navMonth = document.createElement('span');
    navMonth.className = 'flatpickr-current-month';
    const yearWrapper = document.createElement('div');
    yearWrapper.className = 'numInputWrapper';
    const curYear = document.createElement('input');
    curYear.className = 'numInput cur-year';
    curYear.type = 'text';
    (curYear as any).pattern = '\\d*';
    const arrowUp = document.createElement('span');
    arrowUp.className = 'arrowUp';
    const arrowDown = document.createElement('span');
    arrowDown.className = 'arrowDown';
    yearWrapper.appendChild(curYear); yearWrapper.appendChild(arrowUp); yearWrapper.appendChild(arrowDown);
    curYear.title = this.l10n.scrollTitle;
    const next = document.createElement('span');
    next.className = 'flatpickr-next-month';
    next.innerHTML = this.config.nextArrow;
    navMonth.appendChild(curMonth);
    navMonth.appendChild(yearWrapper);
    monthNav.appendChild(prev);
    monthNav.appendChild(navMonth);
    monthNav.appendChild(next);
    cal.appendChild(monthNav);
    this.monthNav = monthNav;
    this.prevMonthNav = prev;
    this.nextMonthNav = next;
    this.currentMonthElement = curMonth;
    this.currentYearElement = curYear;
    /* inner container: weekdays + days */
    const inner = document.createElement('div');
    inner.className = 'flatpickr-innerContainer';
    const rContainer = document.createElement('div');
    rContainer.className = 'flatpickr-rContainer';
    const weekdays = document.createElement('div');
    weekdays.className = 'flatpickr-weekdays';
    rContainer.appendChild(weekdays);
    this.weekdaysContainer = weekdays;
    const daysContainer = document.createElement('div');
    daysContainer.className = 'flatpickr-days';
    daysContainer.tabIndex = -1;
    rContainer.appendChild(daysContainer);
    this.daysContainer = daysContainer;
    inner.appendChild(rContainer);
    cal.appendChild(inner);
    document.body.appendChild(cal);
    this.calendarContainer = cal;
    this.buildWeekdays();
    this.buildDays();
    this.updateNav();
  }

  /* E：weekday 表（firstDayOfWeek 轮转） */
  private buildWeekdays() {
    const first = this.l10n.firstDayOfWeek;
    let names = this.l10n.weekdays.shorthand.slice();
    if (first > 0 && first < names.length) names = names.slice(first).concat(names.slice(0, first));
    this.weekdaysContainer.innerHTML = '\n\t\t<span class=flatpickr-weekday>\n\t\t\t' + names.join('</span><span class=flatpickr-weekday>') + '\n\t\t</span>\n\t\t';
  }

  /* M：42 格日历（prevMonthDay/nextMonthDay/today/selected/range 态） */
  private buildDays() {
    const offset = (new Date(this.currentYear, this.currentMonth, 1).getDay() - this.l10n.firstDayOfWeek + 7) % 7;
    const isRange = this.config.mode === 'range';
    const prevMonthDays = this.utils.getDaysinMonth((this.currentMonth - 1 + 12) % 12);
    const monthDays = this.utils.getDaysinMonth();
    const frag = document.createDocumentFragment();
    this.todayDateElem = undefined;
    this.selectedDateElem = undefined;
    let cellIndex = 0;
    const makeDay = (cls: string, date: Date) => {
      const cell = document.createElement('span');
      cell.className = 'flatpickr-day ' + cls;
      cell.textContent = String(date.getDate());
      (cell as any).dateObj = date;
      (cell as any).$i = cellIndex++;
      cell.setAttribute('aria-label', this.formatDate(date, this.config.ariaDateFormat));
      if (this.sameDay(date, this.now)) { this.todayDateElem = cell; cell.classList.add('today'); }
      const sel = this.isSelected(date);
      if (sel !== false) {
        cell.tabIndex = -1;
        cell.classList.add('selected');
        this.selectedDateElem = cell;
        if (isRange) {
          cell.classList.toggle('startRange', this.sameDay(date, this.selectedDates[0]));
          cell.classList.toggle('endRange', this.selectedDates.length > 1 && this.sameDay(date, this.selectedDates[1]));
        }
      }
      if (isRange && this.inRange(date) && sel === false) cell.classList.add('inRange');
      return cell;
    };
    if (isRange && this.selectedDates.length) {
      this.minRangeDate = new Date(this.selectedDates[0].getTime() - DAY_MS);
      this.maxRangeDate = this.selectedDates.length > 1 ? this.selectedDates[1] : new Date(Date.now() + 365 * DAY_MS);
    }
    for (let i = prevMonthDays + 1 - offset; i <= prevMonthDays; i++, cellIndex++) {
      frag.appendChild(makeDay('prevMonthDay', new Date(this.currentYear, this.currentMonth - 1, i)));
    }
    for (let i = 1; i <= monthDays; i++, cellIndex++) {
      frag.appendChild(makeDay('', new Date(this.currentYear, this.currentMonth, i)));
    }
    for (let i = monthDays + 1; i <= 42 - offset; i++, cellIndex++) {
      frag.appendChild(makeDay('nextMonthDay', new Date(this.currentYear, this.currentMonth + 1, i % monthDays)));
    }
    const dayBox = document.createElement('div');
    dayBox.className = 'dayContainer';
    dayBox.appendChild(frag);
    while (this.daysContainer.firstChild) this.daysContainer.removeChild(this.daysContainer.firstChild);
    this.daysContainer.appendChild(dayBox);
    this.days = dayBox;
  }

  /* oe：月份导航文字 */
  private updateNav() {
    this.currentMonthElement.textContent = this.utils.monthToStr(this.currentMonth) + ' ';
    this.currentYearElement.value = String(this.currentYear);
  }

  jumpToDate(date?: any) {
    const d = date ? this.parseDate(date) : (this.latestSelectedDateObj || (this.selectedDates.length ? this.selectedDates[this.selectedDates.length - 1] : null))
      || (this.config.minDate && this.config.minDate > this.now ? this.config.minDate
        : (this.config.maxDate && this.config.maxDate < this.now ? this.config.maxDate : this.now));
    this.currentYear = d.getFullYear();
    this.currentMonth = d.getMonth();
    this.redraw();
  }

  private redraw() {
    this.buildWeekdays();
    this.updateNav();
    this.buildDays();
  }

  changeMonth(delta: number) {
    let m = this.currentMonth + delta;
    if (m < 0) { this.currentYear -= 1; m = 11; this.trigger('YearChange'); }
    else if (m > 11) { this.currentYear += 1; m = 0; this.trigger('YearChange'); }
    this.currentMonth = m;
    this.buildDays();
    this.updateNav();
    this.trigger('MonthChange');
  }

  /* ── 事件绑定（d） ── */
  private addH(element: any, event: any, handler: any) {
    if (event instanceof Array) { event.forEach((ev) => this.addH(element, ev, handler)); return; }
    element.addEventListener(event, handler);
    this._handlers.push({ element, event, handler });
  }

  private bindEvents() {
    const onlyLeft = (fn: any) => (e: any) => { if (e.which === 1) fn(e); };
    this.addH(document, 'keydown', this.onDocumentKeydown);
    this.addH(document, 'mousedown', onlyLeft(this.onOutsideMouseDown));
    this.addH(this._input, 'blur', this.onBlur);
    this.addH(window, 'resize', this.onResize);
    if (this.config.clickOpens) {
      this.addH(this._input, 'focus', this.open);
      this.addH(this._input, 'mousedown', onlyLeft(this.open));
    }
    this.addH(this.monthNav, 'mousedown', onlyLeft(this.onMonthNav));
    this.addH(this.daysContainer, 'mousedown', onlyLeft(this.onDayClick));
    if (this.config.mode === 'range') this.addH(this.daysContainer, 'mouseover', (e: any) => this.hoverRange(e.target));
    this.addH(this.currentYearElement, ['keyup'], this.onYearKeyup);
  }

  private onDocumentKeydown = (e: any) => {
    const inCalendar = this.calendarContainer && (this.calendarContainer === e.target || this.calendarContainer.contains(e.target));
    if (!inCalendar && !this.isOpen) return;
    if (!inCalendar && e.target !== this._input) return;
    switch (e.key) {
      case 'Enter':
        if (e.target === this._input && this.config.allowInput) {
          this.setDate(this._input.value, true, this.config.dateFormat);
        }
        break;
      case 'Escape':
        e.preventDefault();
        this.close();
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        if (this.daysContainer) {
          e.preventDefault();
          const day: any = e.target.classList && e.target.classList.contains('flatpickr-day') ? e.target : this.selectedDateElem || this.todayDateElem;
          const step = e.key === 'ArrowRight' ? 1 : -1;
          const cell = (this.days.childNodes as any)[(day && day.$i !== undefined ? day.$i : 0) + step];
          if (cell) cell.focus();
        }
        break;
      case 'ArrowUp':
      case 'ArrowDown':
        if (e.ctrlKey) { this.setYear(this.currentYear + (e.key === 'ArrowDown' ? -1 : 1)); }
        break;
    }
  };

  private setYear(year: number) {
    if (!year) return;
    const changed = this.currentYear !== year;
    this.currentYear = year;
    this.redraw();
    if (changed) this.trigger('YearChange');
  }

  private onYearKeyup = (e: any) => {
    const value = e.target.value;
    if (value.length === 4 || e.key === 'Enter') {
      e.target.blur();
      if (!/[^\d]/.test(value)) this.setYear(Number(value));
    }
  };

  private onMonthNav = (e: any) => {
    let el = e.target;
    while (el && el !== this.monthNav && !el.classList) el = el.parentNode;
    if (!el) return;
    const cls = String((e.target as any).className || '');
    if (e.target.closest && (e.target.closest('.flatpickr-prev-month') || (e.target as any).classList.contains('arrowUp'))) this.changeMonth(-1);
    else if (e.target.closest && e.target.closest('.flatpickr-next-month')) this.changeMonth(1);
    else if ((e.target as any).classList && (e.target as any).classList.contains('arrowDown')) this.changeMonth(1);
  };

  private onDayClick = (e: any) => {
    const target = e.target;
    if (!target.classList || !target.classList.contains('flatpickr-day') || target.classList.contains('disabled') || target.classList.contains('notAllowed')) return;
    e.preventDefault();
    e.stopPropagation();
    const date = new Date(target.dateObj.getTime());
    this.latestSelectedDateObj = date;
    if (this.config.mode === 'single') {
      this.selectedDates = [date];
    } else if (this.config.mode === 'range') {
      if (this.selectedDates.length === 2) {
        this.selectedDates = [];
      }
      this.selectedDates.push(date);
      if (!this.sameDay(date, this.selectedDates[0])) this.selectedDates.sort((a, b) => a.getTime() - b.getTime());
    }
    this.buildDays();
    this.updateInputValue();
    this.trigger('Change');
    if (this.config.mode === 'range' && this.selectedDates.length === 1) {
      this.hoverRange(target);
    }
    if (this.config.closeOnSelect) {
      const singleClose = this.config.mode === 'single';
      const rangeClose = this.config.mode === 'range' && this.selectedDates.length === 2;
      if (singleClose || rangeClose) this.close();
    }
  };

  /* P：range hover inRange 预览 */
  private hoverRange(target: any) {
    if (this.selectedDates.length !== 1 || !target.classList || !target.classList.contains('flatpickr-day')) return;
    const endDate = new Date(target.dateObj.getTime());
    const startDate = this.selectedDates[0];
    const min = Math.min(endDate.getTime(), startDate.getTime());
    const max = Math.max(endDate.getTime(), startDate.getTime());
    const cells = this.days.childNodes as any;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const t = cell.dateObj.getTime();
      ['startRange', 'inRange', 'endRange', 'notAllowed'].forEach((c) => cell.classList.remove(c));
      if (t >= min && t <= max) {
        if (t === startDate.getTime()) cell.classList.add('startRange');
        else if (t === endDate.getTime()) cell.classList.add('endRange');
        else cell.classList.add('inRange');
      }
    }
  }

  private onOutsideMouseDown = (e: any) => {
    if (!this.isOpen || this.config.inline) return;
    const inCalendar = this.calendarContainer.contains(e.target);
    const onInput = e.target === this.input || (this.element && this.element.contains(e.target));
    if (!onInput && !inCalendar && this.config.ignoredFocusElements.indexOf(e.target) === -1) {
      this.close();
      if (this.config.mode === 'range' && this.selectedDates.length === 1) {
        this.clear(false);
        this.redraw();
      }
    }
  };

  private onBlur = (e: any) => {
    if (!this.isOpen) return;
    const related = e.relatedTarget;
    if (related && this.calendarContainer.contains(related)) return;
    this.close();
  };

  private onResize = (() => {
    let timer: any = null;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (this.isOpen) this.positionCalendar(); }, 50);
    };
  })();

  /* H/I：开合 */
  open = () => {
    if (this.isOpen || this._input.disabled) return;
    this.isOpen = true;
    this.calendarContainer.classList.add('open');
    this.positionCalendar();
    this._input.classList.add('active');
    this.calendarContainer.style.visibility = '';
    this.trigger('Open');
  };

  close = () => {
    this.isOpen = false;
    this.calendarContainer.classList.remove('open');
    this._input.classList.remove('active');
    this.calendarContainer.style.visibility = 'hidden';
    this.trigger('Close');
  };

  toggle = () => { if (this.isOpen) this.close(); else this.open(); };

  /* J：定位（absolute 文档坐标+翻转+rightMost 逐字） */
  private positionCalendar(positionEl?: any) {
    const el = positionEl || this._positionElement;
    if (!this.calendarContainer) return;
    const height = this.calendarContainer.offsetHeight;
    const width = this.calendarContainer.offsetWidth;
    const configPos = this.config.position;
    const rect = el.getBoundingClientRect();
    const belowSpace = window.innerHeight - rect.bottom;
    const flipUp = configPos === 'above' || (configPos !== 'below' && belowSpace < height && rect.top > height);
    const top = window.pageYOffset + rect.top + (flipUp ? -height - 2 : el.offsetHeight + 2);
    this.calendarContainer.classList.toggle('arrowTop', !flipUp);
    this.calendarContainer.classList.toggle('arrowBottom', flipUp);
    if (!this.config.inline) {
      const left = window.pageXOffset + rect.left;
      const right = window.document.body.offsetWidth - rect.right;
      const rightMost = left + width > window.document.body.offsetWidth;
      this.calendarContainer.classList.toggle('rightMost', rightMost);
      if (!this.config.static) {
        this.calendarContainer.style.top = top + 'px';
        if (rightMost) {
          this.calendarContainer.style.left = 'auto';
          this.calendarContainer.style.right = right + 'px';
        } else {
          this.calendarContainer.style.left = left + 'px';
          this.calendarContainer.style.right = 'auto';
        }
      }
    }
  }

  /* T/q：清空/设值 */
  clear = (triggerChange?: any) => {
    this.input.value = '';
    this.selectedDates = [];
    this.latestSelectedDateObj = null;
    this.redraw();
    if (triggerChange !== false) this.trigger('Change');
  };

  setDate = (date: any, triggerChange?: any, format?: string) => {
    if (date === 0 || !date) { this.clear(triggerChange); return; }
    this.setSelectedDates(date, format);
    this.latestSelectedDateObj = this.selectedDates[0];
    this.redraw();
    this.jumpToDate(this.selectedDates.length ? this.selectedDates[this.selectedDates.length - 1] : undefined);
    this.updateInputValue(triggerChange);
    if (triggerChange) this.trigger('Change');
  };

  private trigger(event: string, extra?: any) {
    const handler = this.config['on' + event];
    if (typeof handler === 'function') handler(this.selectedDates, this.input.value, this, extra);
    if (event === 'Change') {
      this.input.dispatchEvent(new Event('change', { bubbles: true }));
      this.input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  /* S：销毁还原 */
  destroy = () => {
    for (let i = this._handlers.length; i--;) {
      const h = this._handlers[i];
      h.element.removeEventListener(h.event, h.handler);
    }
    this._handlers = [];
    if (this.calendarContainer && this.calendarContainer.parentNode) this.calendarContainer.parentNode.removeChild(this.calendarContainer);
    if (this.input) {
      this.input.type = this.input._type || 'text';
      this.input.classList.remove('flatpickr-input');
      this.input.removeAttribute('readonly');
      this.input.value = '';
    }
  };
}

/* ── 双全局：flatpickr 函数选择器包装 + FlatpickrInstance 构造器 ── */
function flatpickr(targets: any, options?: any): any {
  if (targets instanceof NodeList) return Array.from(targets).map((el: any) => new FlatpickrLite(el, options));
  if (typeof targets === 'string') return Array.from(document.querySelectorAll(targets)).map((el: any) => new FlatpickrLite(el, options));
  return new FlatpickrLite(targets, options);
}
(flatpickr as any).defaultConfig = DEFAULT_CONFIG;
(flatpickr as any).l10ns = L10NS;
(flatpickr as any).localize = (locale: any) => Object.assign(L10NS.default, locale || {});
(flatpickr as any).setDefaults = (opts: any) => Object.assign(DEFAULT_CONFIG, opts || {});
(FlatpickrLite as any).defaultConfig = DEFAULT_CONFIG;
(FlatpickrLite as any).prototype.formats = {};

export function installFlatpickr(): void {
  if (installed) return;
  installed = true;
  if (!_w.flatpickr) _w.flatpickr = flatpickr;
  if (!_w.FlatpickrInstance) _w.FlatpickrInstance = FlatpickrLite;
}
