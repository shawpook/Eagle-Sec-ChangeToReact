/**
 * D-2：`w.$(...)` → 原生 DOM 迁移的最小助手（只覆盖被实际用到的 jQuery 子集）。
 *
 * 语义对齐：
 * - `q/qa`：`querySelector(All)`（jQuery 集合取首元素 = `q`）。
 * - `widthOf/heightOf`：等价 jQuery `.width()/.height()`（content-box；空集合/无节点 = 0）。
 * - `outerWidthOf/outerHeightOf`：等价 `.outerWidth()/.outerHeight()`（含 padding+border）。
 * - `addClass/removeClass/attr/cssGet`：按选择器批量套用（含多类名空格拆分）。
 */

export function q(sel: string): HTMLElement | null {
  return document.querySelector(sel) as HTMLElement | null;
}

export function qa(sel: string): HTMLElement[] {
  return Array.from(document.querySelectorAll(sel)) as HTMLElement[];
}

export function widthOf(el: HTMLElement | null): number {
  return el ? parseFloat(getComputedStyle(el).width) || 0 : 0;
}

export function heightOf(el: HTMLElement | null): number {
  return el ? parseFloat(getComputedStyle(el).height) || 0 : 0;
}

export function outerWidthOf(el: HTMLElement | null): number {
  return el ? el.offsetWidth : 0;
}

export function outerHeightOf(el: HTMLElement | null): number {
  return el ? el.offsetHeight : 0;
}

/** jQuery `.offset().top`（文档坐标；window 未滚动时等于视口 top）。 */
export function offsetTopOf(el: HTMLElement | null): number {
  return el ? el.getBoundingClientRect().top + window.scrollY : 0;
}

/** jQuery `.offset().left`（文档坐标）。 */
export function offsetLeftOf(el: HTMLElement | null): number {
  return el ? el.getBoundingClientRect().left + window.scrollX : 0;
}

/** jQuery `.offset()`（文档坐标；空节点返回 undefined，与 jQuery 一致）。 */
export function offsetOf(el: HTMLElement | null): { left: number; top: number } | undefined {
  if (!el) return undefined;
  const r = el.getBoundingClientRect();
  return { left: r.left + window.scrollX, top: r.top + window.scrollY };
}

/** jQuery `.hide()`（display:none；`.show()` 清空行内值回落样式表）。 */
export function hide(sel: string): void {
  qa(sel).forEach((e) => { e.style.display = 'none'; });
}

export function show(sel: string): void {
  qa(sel).forEach((e) => { e.style.display = ''; });
}

/** jQuery `.hide()` 元素版。 */
export function hideEl(el: HTMLElement | null): void {
  if (el) el.style.display = 'none';
}

/** jQuery `.show()` 元素版。 */
export function showEl(el: HTMLElement | null): void {
  if (el) el.style.display = '';
}

/** jQuery `$(sel).has(node)`：命中集合中是否含包 node 的元素。 */
export function qaHas(sel: string, node: Node | null): boolean {
  return !!node && qa(sel).some((e) => e.contains(node));
}

/** jQuery `$(sel).has(node)` 命中元素（无则 null；用于后续 addClass 等）。 */
export function qaHasEl(sel: string, node: Node | null): HTMLElement | null {
  if (!node) return null;
  return qa(sel).find((e) => e.contains(node)) || null;
}

/** jQuery `.text()` 读取首个匹配元素的 textContent。 */
export function textOf(sel: string): string {
  return q(sel)?.textContent || '';
}

/** jQuery `.text(value)` 写入（批量）。 */
export function setText(sel: string, value: any): void {
  qa(sel).forEach((e) => { e.textContent = String(value); });
}

/** jQuery `:visible` 近似（offsetWidth/Height 或 client rects 非空即为可见）。 */
export function isVisible(el: HTMLElement | null): boolean {
  if (!el) return false;
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

/** jQuery `$(sel + ":visible")`（原生选择器不支持 :visible，按 isVisible 过滤）。 */
export function qaVisible(sel: string): HTMLElement[] {
  return qa(sel).filter(isVisible);
}

/** jQuery `$(sel).not(x)`（排除匹配 x 的元素）。 */
export function qaNot(sel: string, notSel: string): HTMLElement[] {
  return qa(sel).filter((e) => !e.matches(notSel));
}

/** 事件委托命中：返回冒泡目标上匹配 selector 且仍挂在 body 内的元素（jQuery 委托 `this`）。 */
export function delegateTarget(ev: any, selector: string): HTMLElement | null {
  const t = ev.target as Element | null;
  const m = t && typeof (t as any).closest === 'function' ? (t as any).closest(selector) : null;
  return m && document.body.contains(m) ? (m as HTMLElement) : null;
}

/** jQuery `.trigger(type)`（自定义/标准事件；jQuery 绑定走 addEventListener，原生派发可达）。 */
export function trigger(selOrEl: string | HTMLElement | null, type: string): void {
  const el = typeof selOrEl === 'string' ? q(selOrEl) : selOrEl;
  el?.dispatchEvent(new Event(type));
}

export function clickEl(sel: string): void {
  q(sel)?.click();
}

export function focusEl(sel: string): void {
  q(sel)?.focus();
}

export function blurEl(sel: string): void {
  q(sel)?.blur();
}

export function selectEl(sel: string): void {
  (q(sel) as HTMLInputElement | null)?.select();
}

/** jQuery `.scrollTop()` 读取。 */
export function scrollTopValue(sel: string): number {
  return q(sel)?.scrollTop || 0;
}

/** jQuery `.scrollTop(v)` 写入。 */
export function setScrollTop(sel: string, v: number): void {
  const el = q(sel);
  if (el) el.scrollTop = v;
}

/** jQuery `.scrollLeft(v)` 写入。 */
export function setScrollLeft(sel: string, v: number): void {
  const el = q(sel);
  if (el) el.scrollLeft = v;
}

/** jQuery `.html(value)` 写入（批量）。 */
export function setHtml(sel: string, html: any): void {
  qa(sel).forEach((e) => { e.innerHTML = String(html); });
}

/** jQuery `.html()` 读取（首元素）。 */
export function htmlOf(el: HTMLElement | null): string {
  return el ? el.innerHTML : '';
}

/** jQuery `.hasClass(cls)`。 */
export function hasClass(el: HTMLElement | null, cls: string): boolean {
  return !!el && el.classList.contains(cls);
}

/** `.html(value)` 元素版。 */
export function setHtmlEl(el: HTMLElement | null, html: any): void {
  if (el) el.innerHTML = String(html);
}

/** jQuery `.text()` 元素版。 */
export function textEl(el: HTMLElement | null): string {
  return el ? el.textContent || '' : '';
}

/** jQuery `.trigger(type)` 元素版。 */
export function triggerEl(el: HTMLElement | null, type: string): void {
  el?.dispatchEvent(new Event(type));
}

export function focusOn(el: HTMLElement | null): void {
  el?.focus();
}

/** jQuery `.trigger('blur')` / `.blur()` 元素版（真实失焦）。 */
export function blurOn(el: HTMLElement | null): void {
  el?.blur();
}

export function selectText(el: HTMLElement | null): void {
  (el as any)?.select?.();
}

/** jQuery `.off(type).on(type, fn)` 的“按类型单挂”等价（WeakMap registry，替换式）。 */
const elHandlers = new WeakMap<HTMLElement, Map<string, any>>();

export function onEl(el: HTMLElement | null, type: string, fn: any): void {
  if (!el) return;
  let m = elHandlers.get(el);
  if (!m) { m = new Map(); elHandlers.set(el, m); }
  const old = m.get(type);
  if (old) el.removeEventListener(type, old);
  m.set(type, fn);
  el.addEventListener(type, fn);
}

export function offEl(el: HTMLElement | null, type: string): void {
  if (!el) return;
  const m = elHandlers.get(el);
  const old = m && m.get(type);
  if (old) { el.removeEventListener(type, old); m!.delete(type); }
}

/** 移除该元素上所有经 onEl 注册的监听（jQuery `.off()` 语义）。 */
export function offAllEl(el: HTMLElement | null): void {
  if (!el) return;
  const m = elHandlers.get(el);
  if (!m) return;
  m.forEach((fn, type) => el.removeEventListener(type, fn));
  m.clear();
}

/** 由 HTML 字符串创建元素（jQuery `$('<div ...>')` 语义；取首个元素节点）。 */
export function createEl(html: string): HTMLElement | null {
  const holder = document.createElement('div');
  holder.innerHTML = html.trim();
  return holder.firstElementChild as HTMLElement | null;
}

function classesOf(v: string): string[] {
  return String(v).split(/\s+/).filter(Boolean);
}

export function addClass(sel: string, ...cls: string[]): void {
  const flat = cls.flatMap(classesOf);
  if (!flat.length) return;
  qa(sel).forEach((e) => e.classList.add(...flat));
}

export function removeClass(sel: string, ...cls: string[]): void {
  const flat = cls.flatMap(classesOf);
  if (!flat.length) return;
  qa(sel).forEach((e) => e.classList.remove(...flat));
}

/** jQuery `.css(prop)` 取计算值（与 elementHandle.css 取法一致）。 */
export function cssGet(el: HTMLElement | null, prop: string): string {
  return el ? getComputedStyle(el).getPropertyValue(prop) : '';
}

/** jQuery `.attr(name, value)` 写入（批量套选择器）。 */
export function setAttr(sel: string, name: string, value: any): void {
  qa(sel).forEach((e) => e.setAttribute(name, String(value)));
}

/** jQuery `.attr(name)` 读取首个匹配元素属性（无则 null）。 */
export function getAttr(el: HTMLElement | null, name: string): string | null {
  return el ? el.getAttribute(name) : null;
}

/** 无单位 CSS 属性（jQuery `.css(name, number)` 不补 px 的白名单，最小集）。 */
const UNITLESS = new Set(['opacity', 'zIndex', 'lineHeight', 'fontWeight', 'flexGrow', 'flexShrink', 'order', 'zoom', 'columnCount']);

/** 应用内联样式（jQuery `.css({...})` 语义；值尾 `!important` 提升优先级）。 */
function applyStyles(e: HTMLElement, styles: Record<string, any>): void {
  for (const k in styles) {
    const raw = styles[k];
    const isImp = typeof raw === 'string' && /!\s*important\s*$/.test(raw);
    const v = isImp ? raw.replace(/\s*!\s*important\s*$/, '') : raw;
    const priority = isImp ? 'important' : '';
    if (k.includes('-')) (e.style as any).setProperty(k, String(v), priority);
    else if (priority) (e.style as any).setProperty(k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()), String(v), priority);
    else (e.style as any)[k] = typeof v === 'number' && !UNITLESS.has(k) ? `${v}px` : v;
  }
}

/** jQuery `.css({...})` 批量写入（选择器）。 */
export function cssSet(sel: string, styles: Record<string, any>): void {
  qa(sel).forEach((e) => applyStyles(e, styles));
}

/** jQuery `.css({...})` 元素版。 */
export function setCssEl(el: HTMLElement | null, styles: Record<string, any>): void {
  if (el) applyStyles(el, styles);
}

/** jQuery `.find(sel)`（首元素）。 */
export function findEl(el: HTMLElement | null, sel: string): HTMLElement | null {
  return el ? (el.querySelector(sel) as HTMLElement | null) : null;
}

/** jQuery `.find(sel)`（全部）。 */
export function findAllEl(el: HTMLElement | null, sel: string): HTMLElement[] {
  return el ? (Array.from(el.querySelectorAll(sel)) as HTMLElement[]) : [];
}

/** jQuery `.attr(name, value)` 元素版。 */
export function setAttrEl(el: HTMLElement | null, name: string, value: any): void {
  if (el) el.setAttribute(name, String(value));
}

/** jQuery `.text(value)` 元素版。 */
export function setTextEl(el: HTMLElement | null, value: any): void {
  if (el) el.textContent = String(value);
}

/** jQuery `.addClass(...)` 元素版。 */
export function addClassEl(el: HTMLElement | null, ...cls: string[]): void {
  if (!el) return;
  const flat = cls.flatMap(classesOf);
  if (flat.length) el.classList.add(...flat);
}

/** jQuery `.removeClass(...)` 元素版。 */
export function removeClassEl(el: HTMLElement | null, ...cls: string[]): void {
  if (!el) return;
  const flat = cls.flatMap(classesOf);
  if (flat.length) el.classList.remove(...flat);
}

/** jQuery `.width(v)`（内容盒写入）。 */
export function setWidthEl(el: HTMLElement | null, v: number | string): void {
  if (el) el.style.width = typeof v === 'number' ? `${v}px` : String(v);
}

/** jQuery `.height(v)`（内容盒写入）。 */
export function setHeightEl(el: HTMLElement | null, v: number | string): void {
  if (el) el.style.height = typeof v === 'number' ? `${v}px` : String(v);
}

/** jQuery `.val()`（表单控件读取）。 */
export function valOf(el: HTMLElement | null): string {
  return el ? String((el as HTMLInputElement).value ?? '') : '';
}

/** jQuery `.val(v)` 写入。 */
export function setValEl(el: HTMLElement | null, v: any): void {
  if (el) (el as HTMLInputElement).value = String(v);
}

/** jQuery 集合 `.length` 等价（选择器命中数；用于早期存在性/批量判定）。 */
export function qaLen(sel: string): number {
  return document.querySelectorAll(sel).length;
}

/**
 * jQuery `.data()` 通道：元素内部缓存（WeakMap，写不落 `data-*` 属性）。
 * 读取未命中时回落 `data-*` 属性并按 jQuery 规则做布尔/数字/JSON 类型转换后缓存。
 */
const elData = new WeakMap<HTMLElement, Record<string, any>>();

function dataAttrName(key: string): string {
  return 'data-' + key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}

export function dataGet(el: HTMLElement | null, key: string): any {
  if (!el) return undefined;
  const store = elData.get(el);
  if (store && key in store) return store[key];
  const attr = el.getAttribute(dataAttrName(key));
  if (attr == null) return undefined;
  let v: any = attr;
  if (v === 'true') v = true;
  else if (v === 'false') v = false;
  else if (v === 'null') v = null;
  else if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
  else if (/^[[{]/.test(v)) { try { v = JSON.parse(v); } catch { /* 保留字符串 */ } }
  dataSet(el, key, v);
  return v;
}

export function dataSet(el: HTMLElement | null, key: string, value: any): void {
  if (!el) return;
  let store = elData.get(el);
  if (!store) { store = {}; elData.set(el, store); }
  store[key] = value;
}

export function dataRemove(el: HTMLElement | null, key: string): void {
  if (!el) return;
  const store = elData.get(el);
  if (store) delete store[key];
}
