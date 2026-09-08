/**
 * b1-9bw-A：sweetalert2 v6.11.0 自研替换（js/vendors/sweetalert2/sweetalert2.all.min.js 退役）。
 *
 * 契约 = 本仓 65 调用点消费面（考据定案见 PROGRESS P3-bw，v6.11 beautified 561 行逐条）：
 * - `swal(options)` 直调形态，Promise useRejections:true——confirm resolve(true|输入值)、
 *   cancel/×/overlay/esc reject('cancel'|'close'|'overlay'|'esc')；then(ok,cancel) 双参
 *   消费真实存在（FolderModals:1783）；
 * - DOM 类结构 = .swal2-* 逐字复刻（sweetalert2.min.css 续用=零视觉回归，css 不退役）；
 * - statics：getInput/getConfirmButton（onOpen 内消费——现网 v6.11 静态面无此二者=哑雷，
 *   本批拆除并实装）+ isVisible/close/closeModal/clickConfirm/clickCancel；
 * - input 面：text（含 type 原生透传）/textarea/radio（inputOptions）/select/checkbox；
 * - descope（全树零消费，v6 有面）：string 简写形式、preConfirm/showLoaderOnConfirm/
 *   showLoading、timer、image*、progressSteps、queue/setDefaults/resetDefaults/noop、
 *   email/url 内置 validator、file/range 输入、inputAttributes、reverseButtons、
 *   confirmButtonClass/cancelButtonClass 等次要参数（按 DEFAULTS 白名单之外的键一律忽略，
 *   icon/maxWidth 现网即被 v6 静默忽略+warn——自研忽略不 warn，零行为差异）。
 * v6 劫持 window.onkeydown 属性（save/restore）——全树无其他 onkeydown 属性使用者
 * （grep 实证）→ 本实现用 document.addEventListener 等价替代，关闭时移除。
 */

const _w: any = window as any;

let installed = false;

/* ── v6.11 类名表（n = t([...]) 逐字） ── */
const C: Record<string, string> = {};
for (const name of [
  'container', 'shown', 'iosfix', 'modal', 'overlay', 'fade', 'show', 'hide',
  'noanimation', 'close', 'title', 'content', 'buttonswrapper', 'confirm', 'cancel',
  'icon', 'image', 'input', 'file', 'range', 'select', 'radio', 'checkbox',
  'textarea', 'inputerror', 'validationerror', 'progresssteps', 'activeprogressstep',
  'progresscircle', 'progressline', 'loading', 'styled', 'top', 'top-left', 'top-right',
  'center', 'center-left', 'center-right', 'bottom', 'bottom-left', 'bottom-right',
  'grow-row', 'grow-column', 'grow-fullscreen',
]) C[name] = 'swal2-' + name;

const ICON_TYPES: Record<string, string> = {};
for (const name of ['success', 'warning', 'info', 'question', 'error']) ICON_TYPES[name] = 'swal2-' + name;

/* ── v6.11 defaults（消费面契约集；未列键=忽略，等价 vendor 的 Unknown parameter 丢弃） ── */
const DEFAULTS: any = {
  title: '', titleText: '', text: '', html: '', type: null,
  customClass: '', target: 'body', animation: true,
  allowOutsideClick: true, allowEscapeKey: true, allowEnterKey: true,
  showConfirmButton: true, showCancelButton: false,
  confirmButtonText: 'OK', confirmButtonAriaLabel: '',
  cancelButtonText: 'Cancel', cancelButtonAriaLabel: '',
  confirmButtonColor: '', cancelButtonColor: '#aaa',
  buttonsStyling: true, focusConfirm: true, focusCancel: false,
  showCloseButton: false, closeButtonAriaLabel: 'Close this dialog',
  width: 500, padding: 20, background: '#fff',
  input: null, inputPlaceholder: '', inputValue: '', inputOptions: {},
  inputAutoTrim: true, inputValidator: null,
  position: 'center', onOpen: null, onClose: null,
  useRejections: true,
};

/* ── DOM 模板（v6.11 c 串逐字，类名插值已落） ── */
const MODAL_TEMPLATE = (
  '\n <div role="dialog" aria-modal="true" aria-labelledby="' + C.title + '" aria-describedby="' + C.content + '" class="' + C.modal + '" tabindex="-1">' +
  '\n   <ul class="' + C.progresssteps + '"></ul>' +
  '\n   <div class="' + C.icon + ' ' + ICON_TYPES.error + '">' +
  '\n     <span class="swal2-x-mark"><span class="swal2-x-mark-line-left"></span><span class="swal2-x-mark-line-right"></span></span>' +
  '\n   </div>' +
  '\n   <div class="' + C.icon + ' ' + ICON_TYPES.question + '">?</div>' +
  '\n   <div class="' + C.icon + ' ' + ICON_TYPES.warning + '">!</div>' +
  '\n   <div class="' + C.icon + ' ' + ICON_TYPES.info + '">i</div>' +
  '\n   <div class="' + C.icon + ' ' + ICON_TYPES.success + '">' +
  '\n     <div class="swal2-success-circular-line-left"></div>' +
  '\n     <span class="swal2-success-line-tip"></span> <span class="swal2-success-line-long"></span>' +
  '\n     <div class="swal2-success-ring"></div> <div class="swal2-success-fix"></div>' +
  '\n     <div class="swal2-success-circular-line-right"></div>' +
  '\n   </div>' +
  '\n   <img class="' + C.image + '" />' +
  '\n   <h2 class="' + C.title + '" id="' + C.title + '"></h2>' +
  '\n   <div id="' + C.content + '" class="' + C.content + '"></div>' +
  '\n   <input class="' + C.input + '" />' +
  '\n   <input type="file" class="' + C.file + '" />' +
  '\n   <div class="' + C.range + '">' +
  '\n     <output></output>' +
  '\n     <input type="range" />' +
  '\n   </div>' +
  '\n   <select class="' + C.select + '"></select>' +
  '\n   <div class="' + C.radio + '"></div>' +
  '\n   <label for="' + C.checkbox + '" class="' + C.checkbox + '">' +
  '\n     <input type="checkbox" />' +
  '\n   </label>' +
  '\n   <textarea class="' + C.textarea + '"></textarea>' +
  '\n   <div class="' + C.validationerror + '" id="' + C.validationerror + '"></div>' +
  '\n   <div class="' + C.buttonswrapper + '">' +
  '\n     <button type="button" class="' + C.confirm + '">OK</button>' +
  '\n     <button type="button" class="' + C.cancel + '">Cancel</button>' +
  '\n   </div>' +
  '\n   <button type="button" class="' + C.close + '">\xD7</button>' +
  '\n </div>'
).replace(/(^|\n)\s*/g, '');

/* ── 小工具（v6.11 同语义） ── */
const hasClass = (el: any, name: string) => !!el && !!el.classList && el.classList.contains(name);
const addClass = (el: any, names: string) => {
  if (el && names) names.split(/\s+/).filter(Boolean).forEach((n) => el.classList.add(n));
};
const removeClass = (el: any, names: string) => {
  if (el && names) names.split(/\s+/).filter(Boolean).forEach((n) => el.classList.remove(n));
};
const showEl = (el: any, display?: string) => {
  if (!el) return;
  el.style.opacity = '';
  el.style.display = display || 'block';
};
const hideEl = (el: any) => { if (el) { el.style.opacity = ''; el.style.display = 'none'; } };
const removeProp = (el: any, prop: string) => {
  if (!el) return;
  if (el.style.removeProperty) el.style.removeProperty(prop);
  else el.style.removeAttribute(prop);
};
const isVisibleEl = (el: any) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
/** L()：按 class 找直接子节点 */
const childByClass = (parent: any, name: string) => {
  if (!parent) return null;
  for (let i = 0; i < parent.childNodes.length; i++) if (hasClass(parent.childNodes[i], name)) return parent.childNodes[i];
  return null;
};
/* animationend 事件名探测（v6.11 H 逐字） */
const animationEnd = (() => {
  const probe = document.createElement('div');
  const table: Record<string, string> = {
    WebkitAnimation: 'webkitAnimationEnd', OAnimation: 'oAnimationEnd oanimationend',
    animation: 'animationend',
  };
  for (const key of Object.keys(table)) {
    if (Object.prototype.hasOwnProperty.call(table, key) && (probe.style as any)[key] !== undefined) return table[key];
  }
  return false;
})();

const getContainer = () => document.body.querySelector('.' + C.container);
const getModal = () => { const c = getContainer(); return c ? c.querySelector('.' + C.modal) : null; };

/* ── 模块态（v6.11 s） ── */
const state: any = { previousActiveElement: null, previousBodyPadding: null };
let currentDialog: any = null; // { params, keyHandler, observer, resolve, reject }
let observerSingletonStarted = false;

/* 滚动条补偿（Z）/还原（Q） */
const measureScrollbar = () => {
  if ('ontouchstart' in window || (navigator as any).msMaxTouchPoints) return 0;
  const probe = document.createElement('div');
  probe.style.width = '50px'; probe.style.height = '50px'; probe.style.overflow = 'scroll';
  document.body.appendChild(probe);
  const width = probe.offsetWidth - probe.clientWidth;
  document.body.removeChild(probe);
  return width;
};
const compensateBodyPadding = () => {
  if (state.previousBodyPadding === null && document.body.scrollHeight > window.innerHeight) {
    state.previousBodyPadding = document.body.style.paddingRight;
    document.body.style.paddingRight = measureScrollbar() + 'px';
  }
};
const restoreBodyPadding = () => {
  if (state.previousBodyPadding !== null) {
    document.body.style.paddingRight = state.previousBodyPadding;
    state.previousBodyPadding = null;
  }
};
/* iOS 锁滚（Y/$） */
const iosFix = () => {
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream && !hasClass(document.body, C.iosfix)) {
    const top = document.body.scrollTop;
    document.body.style.top = -1 * top + 'px';
    addClass(document.body, C.iosfix);
  }
};
const iosUnfix = () => {
  if (hasClass(document.body, C.iosfix)) {
    const top = parseInt(document.body.style.top as any, 10);
    removeClass(document.body, C.iosfix);
    document.body.style.top = '';
    document.body.scrollTop = -1 * top;
  }
};
/* 焦点还原（N；window.onkeydown 劫持→本实现用 removeEventListener） */
const restoreAfterClose = () => {
  if (currentDialog && currentDialog.keyHandler) {
    document.removeEventListener('keydown', currentDialog.keyHandler);
    currentDialog.keyHandler = null;
  }
  if (state.previousActiveElement && state.previousActiveElement.focus) {
    const x = window.scrollX, y = window.scrollY;
    state.previousActiveElement.focus();
    if (x && y) window.scrollTo(x, y);
  }
};

/* focus 光标置尾（B） */
const focusInput = (el: any) => {
  el.focus();
  if (el.type !== 'file') { const value = el.value; el.value = ''; el.value = value; }
};
/* focusables 表（S；v6 tabindex 排序 + 常规可聚焦 concat） */
const getFocusables = () => {
  const modal = getModal();
  if (!modal) return [];
  const byTabindex = Array.from(modal.querySelectorAll('[tabindex]:not([tabindex="-1"]):not([tabindex="0"])'))
    .sort((a, b) => parseInt((a as HTMLElement).getAttribute('tabindex') as any, 10) - parseInt((b as HTMLElement).getAttribute('tabindex') as any, 10));
  const regular = Array.prototype.slice.call(modal.querySelectorAll('button, input:not([type=hidden]), textarea, select, a, [tabindex="0"]'));
  return byTabindex.concat(regular).filter((el: any, index: number, self: any[]) => self.indexOf(el) === index && isVisibleEl(el));
};
/* D2 循环聚焦（v6 有界 for o4 < n2.length——本实现同构，防无可见元素死循环） */
const focusCycle = (start: number, step: number) => {
  const list = getFocusables();
  let i = start;
  for (let iter = 0; iter < list.length; iter++) {
    i += step;
    if (i === list.length) i = 0;
    else if (i === -1) i = list.length - 1;
    const el: any = list[i];
    if (el && isVisibleEl(el)) return el.focus();
  }
};

/* ── container 重建（u）＋ 输入 reset-validation 绑定；v6 z 实为 target=body 时
 * r2.parentNode(container→body) ≠ i2.parentNode(body→html) → 恒重建，本实现同构
 * ＋ 输入 reset-validation 绑定。 ── */
function buildContainer(params: any) {
  const existing = getContainer();
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
  if (typeof document === 'undefined') throw new Error('[dialog] SweetAlert2 requires document to initialize');
  const container = document.createElement('div');
  container.className = C.container;
  container.innerHTML = MODAL_TEMPLATE;
  const target: any = typeof params.target === 'string' ? document.querySelector(params.target) : params.target;
  (target || document.body).appendChild(container);
  const m: any = container.querySelector('.' + C.modal);
  const inputEl = childByClass(m, C.input);
  const fileEl = childByClass(m, C.file);
  const rangeInput: any = m.querySelector('.' + C.range + ' input');
  const rangeOutput: any = m.querySelector('.' + C.range + ' output');
  const selectEl = childByClass(m, C.select);
  const checkboxInput: any = m.querySelector('.' + C.checkbox + ' input');
  const textareaEl = childByClass(m, C.textarea);
  const reset = () => { if (currentDialog) currentDialog.resetValidationError(); };
  if (inputEl) inputEl.oninput = reset;
  if (fileEl) fileEl.onchange = reset;
  if (rangeInput) rangeInput.oninput = () => { reset(); if (rangeOutput) rangeOutput.value = rangeInput.value; };
  if (selectEl) selectEl.onchange = reset;
  if (checkboxInput) checkboxInput.onchange = reset;
  if (textareaEl) textareaEl.oninput = reset;
  return m;
}

/* ── 参数应用面（z） ── */
function applyParams(params: any) {
  if (typeof params.target === 'string' && !document.querySelector(params.target)) params.target = 'body';
  const modal: any = buildContainer(params);
  const container = getContainer();
  modal.style.width = typeof params.width === 'number' ? params.width + 'px' : params.width;
  modal.style.padding = params.padding + 'px';
  modal.style.background = params.background;
  for (const el of Array.from(modal.querySelectorAll('[class^=swal2-success-circular-line], .swal2-success-fix'))) (el as HTMLElement).style.background = params.background;

  // v6 语义：L()＝modal 直接子节点（全输入类型）；w()/C()/k()/x()/m()＝container
  // querySelector（confirm/cancel 在 buttonswrapper 内，非 modal 直系）。本处统一用
  // querySelector（等价且覆盖直系/隔代两种）。
  const titleEl: any = modal.querySelector('.' + C.title);
  const contentEl: any = modal.querySelector('.' + C.content);
  const buttonsWrapper: any = modal.querySelector('.' + C.buttonswrapper);
  const confirmBtn: any = modal.querySelector('.' + C.confirm);
  const cancelBtn: any = modal.querySelector('.' + C.cancel);
  const closeBtn: any = modal.querySelector('.' + C.close);

  if (params.titleText) titleEl.innerText = params.titleText;
  else titleEl.innerHTML = String(params.title == null ? '' : params.title).split('\n').join('<br />');
  if (params.text || params.html) {
    if (typeof params.html === 'object') {
      contentEl.innerHTML = '';
      if (0 in params.html) for (let i = 0; i in params.html; i++) contentEl.appendChild(params.html[i].cloneNode(true));
      else contentEl.appendChild(params.html.cloneNode(true));
    } else if (params.html) contentEl.innerHTML = params.html;
    else if (params.text) contentEl.textContent = params.text;
    showEl(contentEl);
  } else hideEl(contentEl);

  if (params.position in C) addClass(container, C[params.position]);
  params.showCloseButton ? (closeBtn.setAttribute('aria-label', params.closeButtonAriaLabel), showEl(closeBtn)) : hideEl(closeBtn);
  modal.className = C.modal;
  if (params.customClass) addClass(modal, params.customClass);

  hideEl(modal.querySelector('.' + C.progresssteps));
  for (const iconEl of Array.from(modal.querySelectorAll('.' + C.icon))) hideEl(iconEl);
  if (params.type) {
    if (!ICON_TYPES[params.type]) { console.error('[dialog] Unknown alert type: ' + params.type); }
    else {
      const iconEl: any = modal.querySelector('.' + C.icon + '.' + ICON_TYPES[params.type]);
      showEl(iconEl);
      if (params.animation) {
        if (params.type === 'success') {
          addClass(iconEl, 'swal2-animate-success-icon');
          addClass(iconEl.querySelector('.swal2-success-line-tip'), 'swal2-animate-success-line-tip');
          addClass(iconEl.querySelector('.swal2-success-line-long'), 'swal2-animate-success-line-long');
        } else if (params.type === 'error') {
          addClass(iconEl, 'swal2-animate-error-icon');
          addClass(iconEl.querySelector('.swal2-x-mark'), 'swal2-animate-x-mark');
        }
      }
    }
  }
  hideEl(modal.querySelector('.' + C.image));

  params.showCancelButton ? (cancelBtn.style.display = 'inline-block') : hideEl(cancelBtn);
  params.showConfirmButton ? removeProp(confirmBtn, 'display') : hideEl(confirmBtn);
  params.showConfirmButton || params.showCancelButton ? showEl(buttonsWrapper) : hideEl(buttonsWrapper);
  confirmBtn.innerHTML = params.confirmButtonText;
  cancelBtn.innerHTML = params.cancelButtonText;
  confirmBtn.setAttribute('aria-label', params.confirmButtonAriaLabel);
  cancelBtn.setAttribute('aria-label', params.cancelButtonAriaLabel);
  if (params.buttonsStyling) {
    confirmBtn.style.backgroundColor = params.confirmButtonColor;
    cancelBtn.style.backgroundColor = params.cancelButtonColor;
  }
  confirmBtn.className = C.confirm;
  cancelBtn.className = C.cancel;
  params.buttonsStyling ? (addClass(confirmBtn, C.styled), addClass(cancelBtn, C.styled))
    : (removeClass(confirmBtn, C.styled), removeClass(cancelBtn, C.styled), confirmBtn.style.backgroundColor = confirmBtn.style.borderLeftColor = confirmBtn.style.borderRightColor = '', cancelBtn.style.backgroundColor = cancelBtn.style.borderLeftColor = cancelBtn.style.borderRightColor = '');
  params.animation === true ? removeClass(modal, C.noanimation) : addClass(modal, C.noanimation);
  return { modal, container, confirmBtn, cancelBtn, closeBtn };
}

/* ── open 动画序列（_） ── */
function openModal(modal: any, container: any, params: any) {
  if (typeof params.onBeforeOpen === 'function') params.onBeforeOpen(modal);
  if (params.animation) { addClass(modal, C.show); addClass(container, C.fade); removeClass(modal, C.hide); }
  else removeClass(container, C.fade);
  showEl(modal);
  container.style.overflowY = 'hidden';
  if (animationEnd && !hasClass(modal, C.noanimation)) {
    const handler = () => { modal.removeEventListener(animationEnd, handler); container.style.overflowY = 'auto'; };
    modal.addEventListener(animationEnd, handler);
  } else container.style.overflowY = 'auto';
  addClass(document.documentElement, C.shown);
  addClass(document.body, C.shown);
  addClass(container, C.shown);
  compensateBodyPadding();
  iosFix();
  state.previousActiveElement = document.activeElement;
  if (typeof params.onOpen === 'function') setTimeout(() => params.onOpen(modal));
}

/* ── close（J.close/J.closeModal） ── */
function closeModal(onClose?: any) {
  const container = getContainer();
  const modal: any = getModal();
  if (!modal) return;
  removeClass(modal, C.show);
  addClass(modal, C.hide);
  if (modal.timeout) clearTimeout(modal.timeout);
  restoreAfterClose();
  const finish = () => {
    if (container && container.parentNode) container.parentNode.removeChild(container);
    removeClass(document.documentElement, C.shown);
    removeClass(document.body, C.shown);
    restoreBodyPadding();
    iosUnfix();
  };
  if (animationEnd && !hasClass(modal, C.noanimation)) {
    const handler = () => {
      modal.removeEventListener(animationEnd, handler);
      if (hasClass(modal, C.hide)) finish();
    };
    modal.addEventListener(animationEnd, handler);
  } else finish();
  if (typeof onClose === 'function') setTimeout(() => onClose(modal));
}

/* ── 主函数（v6.11 J/modal 合流：直调 options 对象） ── */
function swal(options: any): Promise<any> {
  if (options === undefined || options === null || typeof options !== 'object') {
    console.error('[dialog] SweetAlert2 expects at least 1 attribute!');
    return Promise.resolve(false);
  }
  const params: any = Object.assign({}, DEFAULTS, options);

  const { modal, container, confirmBtn, cancelBtn, closeBtn } = applyParams(params);

  return new Promise((resolve, reject) => {
    /* ── 本次 dialog 内部态（v6.11 promise 体闭包） ── */
    const inputElementFor = (forcedType?: string) => {
      const type = forcedType || params.input;
      if (!type) return null;
      switch (type) {
        case 'select': case 'textarea': case 'file':
          return childByClass(modal, C[type]);
        case 'checkbox':
          return modal.querySelector('.' + C.checkbox + ' input');
        case 'radio':
          return modal.querySelector('.' + C.radio + ' input:checked') || modal.querySelector('.' + C.radio + ' input:first-child');
        case 'range':
          return modal.querySelector('.' + C.range + ' input');
        default:
          return childByClass(modal, C.input);
      }
    };
    const readInput = () => {
      const el: any = inputElementFor();
      if (!el) return null;
      switch (params.input) {
        case 'checkbox': return el.checked ? 1 : 0;
        case 'radio': return el.checked ? el.value : null;
        case 'file': return el.files.length ? el.files[0] : null;
        default: return params.inputAutoTrim ? el.value.trim() : el.value;
      }
    };

    const dialog: any = {
      params,
      resolve, reject,
      resetValidationError, showValidationError, recalculateHeight,
      inputElementFor,
      keyHandler: null,
    };
    if (currentDialog && currentDialog.keyHandler) document.removeEventListener('keydown', currentDialog.keyHandler);
    currentDialog = dialog;

    function enableButtons() { confirmBtn.disabled = false; cancelBtn.disabled = false; }
    function disableButtons() { confirmBtn.disabled = true; cancelBtn.disabled = true; }
    function enableInput() { const el: any = inputElementFor(); if (!el) return false; el.disabled = false; }
    function disableInput() { const el: any = inputElementFor(); if (el) el.disabled = true; }
    function showValidationError(error: any) {
      const errEl: any = modal.querySelector('.' + C.validationerror);
      errEl.innerHTML = error;
      showEl(errEl);
      const el: any = inputElementFor();
      if (el) {
        el.setAttribute('aria-invalid', true);
        el.setAttribute('aria-describedBy', C.validationerror);
        focusInput(el);
        addClass(el, C.inputerror);
      }
      recalculateHeight();
    }
    function resetValidationError() {
      const errEl: any = modal.querySelector('.' + C.validationerror);
      hideEl(errEl);
      recalculateHeight();
      const el: any = inputElementFor();
      if (el) { el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedBy'); removeClass(el, C.inputerror); }
    }
    function recalculateHeight() {
      const m: any = getModal();
      if (m) {
        const display = m.style.display;
        m.style.minHeight = '';
        showEl(m);
        m.style.minHeight = m.scrollHeight + 1 + 'px';
        m.style.display = display;
      }
    }

    /* confirm 决议链（m2；preConfirm/showLoaderOnConfirm descope——全树零消费） */
    const confirmValue = (value: any) => {
      closeModal(params.onClose);
      resolve(params.useRejections ? value : { value });
    };

    const dismiss = (reason: string) => {
      closeModal(params.onClose);
      params.useRejections ? reject(reason) : resolve({ dismiss: reason });
    };

    /* 按钮事件（A2——v6 全按钮 onclick/onmouseover/onmouseout/onmousedown） */
    const buttonHandler = (event: any) => {
      const e = event || _w.event;
      const el = e.target || e.srcElement;
      const isConfirm = confirmBtn && (confirmBtn === el || confirmBtn.contains(el));
      const isCancel = cancelBtn && (cancelBtn === el || cancelBtn.contains(el));
      switch (e.type) {
        case 'mouseover': case 'mouseup':
          if (params.buttonsStyling) isConfirm ? (confirmBtn.style.backgroundColor = darken(params.confirmButtonColor)) : isCancel && (cancelBtn.style.backgroundColor = darken(params.cancelButtonColor));
          break;
        case 'mousedown':
          if (params.buttonsStyling) isConfirm ? (confirmBtn.style.backgroundColor = darken(params.confirmButtonColor, true)) : isCancel && (cancelBtn.style.backgroundColor = darken(params.cancelButtonColor, true));
          break;
        case 'click':
          if (isConfirm && isVisibleEl(modal)) {
            disableButtons();
            if (params.input) {
              const value = readInput();
              if (params.inputValidator) {
                disableInput();
                params.inputValidator(value, params.extraParams).then(() => {
                  enableButtons(); enableInput(); confirmValue(value);
                }, (err: any) => {
                  enableButtons(); enableInput(); if (err) showValidationError(err);
                });
              } else confirmValue(value);
            } else confirmValue(true);
          } else if (isCancel && isVisibleEl(modal)) { disableButtons(); dismiss('cancel'); }
          break;
      }
    };
    /* v6 色阶工具（r：十六进制 ±百分比） */
    function darken(hex: string, strong?: boolean) {
      const percent = strong ? -0.2 : -0.1;
      if (!hex || typeof hex !== 'string' || hex[0] !== '#') return hex;
      const normalized = hex.length === 4 ? '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3] : hex;
      let out = '#';
      for (let i = 1; i < 7; i += 2) {
        const comp = parseInt(normalized.substr(i, 2), 16);
        const next = Math.round(Math.min(Math.max(0, comp + comp * percent), 255)).toString(16);
        out += ('00' + next).substr(next.length);
      }
      return out;
    }
    for (const btn of Array.from(modal.querySelectorAll('button'))) {
      btn.onclick = buttonHandler;
      (btn as any).onmouseover = buttonHandler;
      (btn as any).onmouseout = buttonHandler;
      (btn as any).onmousedown = buttonHandler;
    }
    closeBtn.onclick = () => dismiss('close');
    container.onclick = (e: any) => { if (e.target === container && params.allowOutsideClick) dismiss('overlay'); };

    /* 键盘（U2——addEventListener 等价 v6 劫持；Enter 仅焦点在 input 上 confirm） */
    const keyHandler = (event: any) => {
      const e = event || _w.event;
      if (e.key === 'Enter' && e.keyCode !== 229) {
        if (e.target === inputElementFor()) { confirmBtn.click(); e.preventDefault(); }
      } else if (e.key === 'Tab' && e.keyCode !== 229) {
        const list = getFocusables();
        let index = -1;
        for (let i = 0; i < list.length; i++) if (list[i] === (e.target || e.srcElement)) { index = i; break; }
        e.shiftKey ? focusCycle(index, -1) : focusCycle(index, 1);
        e.stopPropagation();
        e.preventDefault();
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Arrowdown'].indexOf(e.key) > -1) {
        // v6 逐字 "Arrowdown" 系其原码拼写——保留（零消费面影响）
        if (_w.document.activeElement === cancelBtn && isVisibleEl(confirmBtn)) confirmBtn.focus();
        else if (_w.document.activeElement === confirmBtn && isVisibleEl(cancelBtn)) cancelBtn.focus();
      } else if (e.key === 'Escape' && e.keyCode !== 229 && params.allowEscapeKey === true) {
        dismiss('esc');
      }
    };
    dialog.keyHandler = keyHandler;
    document.addEventListener('keydown', keyHandler);

    /* input 填充（各类型） */
    const fillInputOptions = (optionsObj: any) => {
      if (params.input === 'select') {
        const selectEl: any = childByClass(modal, C.select);
        selectEl.innerHTML = '';
        for (const key of Object.keys(optionsObj)) {
          const opt = document.createElement('option');
          opt.value = key;
          opt.innerHTML = optionsObj[key];
          if (String(params.inputValue) === key) (opt as any).selected = true;
          selectEl.appendChild(opt);
        }
        showEl(selectEl);
        selectEl.focus();
      } else if (params.input === 'radio') {
        const radioEl: any = childByClass(modal, C.radio);
        radioEl.innerHTML = '';
        for (const key of Object.keys(optionsObj)) {
          const radio = document.createElement('input');
          const label = document.createElement('label');
          const span = document.createElement('span');
          radio.type = 'radio';
          radio.name = C.radio;
          radio.value = key;
          if (String(params.inputValue) === key) radio.checked = true;
          span.innerHTML = optionsObj[key];
          label.appendChild(radio);
          label.appendChild(span);
          radioEl.appendChild(label);
        }
        showEl(radioEl);
        const inputs = radioEl.querySelectorAll('input');
        if (inputs.length) inputs[0].focus();
      }
    };
    switch (params.input) {
      case 'text': case 'email': case 'password': case 'number': case 'tel': case 'url': {
        const el: any = childByClass(modal, C.input);
        el.type = params.input;
        el.value = params.inputValue;
        el.placeholder = params.inputPlaceholder;
        showEl(el);
        break;
      }
      case 'textarea': {
        const el: any = childByClass(modal, C.textarea);
        el.value = params.inputValue;
        el.placeholder = params.inputPlaceholder;
        showEl(el);
        break;
      }
      case 'select': case 'radio': break; // inputOptions 统一处理（下方）
      case 'checkbox': {
        const wrap: any = childByClass(modal, C.checkbox);
        const el: any = inputElementFor('checkbox');
        el.type = 'checkbox'; el.value = 1; el.id = C.checkbox; el.checked = Boolean(params.inputValue);
        const spans = wrap.getElementsByTagName('span');
        if (spans.length) wrap.removeChild(spans[0]);
        const span = document.createElement('span');
        span.innerHTML = params.inputPlaceholder;
        wrap.appendChild(span);
        showEl(wrap);
        break;
      }
      case null: case undefined: break;
      default:
        console.error('[dialog] Unexpected type of input! Expected "text", "email", "password", "number", "tel", "select", "radio", "checkbox", "textarea", "file" or "url", got "' + params.input + '"');
    }
    if (params.input === 'select' || params.input === 'radio') {
      const optionsObj = params.inputOptions;
      if (optionsObj && typeof optionsObj.then === 'function') optionsObj.then(fillInputOptions); // Promise 形态（v6 showLoading descope）
      else if (optionsObj && typeof optionsObj === 'object') fillInputOptions(optionsObj);
    }
    if (params.input) setTimeout(() => { const el: any = inputElementFor(); if (el) focusInput(el); }, 0);

    /* open + 焦点策略 + scrollTop + MutationObserver（v6 尾段逐序） */
    openModal(modal, container, params);
    if (params.allowEnterKey) {
      params.focusCancel && isVisibleEl(cancelBtn) ? cancelBtn.focus()
        : params.focusConfirm && isVisibleEl(confirmBtn) ? confirmBtn.focus()
          : focusCycle(-1, 1);
    } else if (_w.document.activeElement && _w.document.activeElement.blur) _w.document.activeElement.blur();
    getContainer().scrollTop = 0;
    if (typeof MutationObserver !== 'undefined' && !observerSingletonStarted) {
      observerSingletonStarted = true;
      let timer: any = null;
      const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(recalculateHeight, 50);
      });
      observer.observe(modal, { childList: true, characterData: true, subtree: true });
      dialog.observer = observer;
    }
  });
}

/* ── statics（v6.11 J 面 + 本批实装 getConfirmButton/getInput——现网 v6 缺位=哑雷） ── */
const swalStatics: any = swal;
swalStatics.isVisible = () => !!getModal();
swalStatics.close = swalStatics.closeModal = () => closeModal(currentDialog ? currentDialog.params.onClose : null);
swalStatics.clickConfirm = () => { const el: any = getModal(); const btn = el ? el.querySelector('.' + C.confirm) : null; if (btn) btn.click(); };
swalStatics.clickCancel = () => { const el: any = getModal(); const btn = el ? el.querySelector('.' + C.cancel) : null; if (btn) btn.click(); };
swalStatics.getConfirmButton = () => { const el: any = getModal(); return el ? el.querySelector('.' + C.confirm) : null; };
swalStatics.getCancelButton = () => { const el: any = getModal(); return el ? el.querySelector('.' + C.cancel) : null; };
swalStatics.getInput = () => {
  const dialog = currentDialog;
  if (!dialog) return null;
  return dialog.inputElementFor ? dialog.inputElementFor() : null;
};

export function installDialog(): void {
  if (installed) return;
  installed = true;
  if (!_w.swal) _w.swal = swalStatics;
  if (!_w.sweetAlert) _w.sweetAlert = swalStatics;
}
