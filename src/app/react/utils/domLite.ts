/**
 * D-2：遗留移植体（hoverPreview / smoothZoomEngine）的自研 DOM 集合层。
 *
 * 这两个文件是 vendor 脚本的逐字归位（jQuery 集合 API 深度耦合：`.find/.each/.append/
 * `.bind(带 data/命名空间)/.animate/.wrap` 等），逐点原生化的行为风险远高于收益。
 * 按项目既定路线（D-2f「原生重写 / 换自研交互层」，同 `utils/domQuery`、
 * `components/interactions/*`），本模块以**原生 DOM 实现 jQuery 子集**，语义对齐 jQuery 1.8：
 *
 * - 只覆盖这两个文件实际用到的子集；未用到的语义不实现（不追求通用 jQuery 兼容）。
 * - `.data()` 通道与 `domQuery` 共享同一 WeakMap（degree/flip/show-at-zoom 等跨文件读写一致）。
 * - 布尔属性按 jQuery `boolHook`（`false` 删属性，真值写 `name="name"`）。
 * - 事件支持命名空间（`mousewheel.sz12`）、多类型串（`"a.sz b.sz"`）、委托（含
 *   mouseenter/mouseleave → mouseover/mouseout + relatedTarget 过滤）。
 * - `.animate/.fadeIn/.fadeOut`：本案只出现 duration=0 的调用，按瞬时应用 + 回调实现；
 *   非零时长走 rAF 数值补间（够用即可）。
 */

import { dataGet, dataSet, dataRemove, setCssEl, cssGet, widthOf, heightOf, outerWidthOf, outerHeightOf, setWidthEl, setHeightEl, setHtmlEl, htmlOf, addClassEl, removeClassEl, hasClass as hasClassEl } from './domQuery';

type AnyNode = any;

const BOOL_ATTRS = new Set([
  'autofocus', 'autoplay', 'async', 'checked', 'controls', 'defer', 'disabled',
  'hidden', 'loop', 'multiple', 'open', 'readonly', 'required', 'scoped', 'selected',
]);

function isWindow(x: any): boolean {
  return !!x && x === x.window;
}

function isDocument(x: any): boolean {
  return !!x && x.nodeType === 9;
}

function isElementish(x: any): boolean {
  return !!x && (x.nodeType === 1 || isWindow(x) || isDocument(x));
}

/** `<div ...>` → 顶层元素数组（jQuery `$('<div/>')` 语义）。 */
function createFromHtml(html: string): AnyNode[] {
  const tpl = document.createElement('template');
  tpl.innerHTML = String(html).trim();
  return Array.from(tpl.content.children);
}

function toNodes(content: any): AnyNode[] {
  if (content == null) return [];
  if (content instanceof DomSet) return content.els.slice();
  if (typeof content === 'string') {
    const s = content.trim();
    if (s.charAt(0) === '<') return createFromHtml(s);
    return [document.createTextNode(content)];
  }
  if (isElementish(content)) return [content];
  if (content.nodeType) return [content];
  if (typeof content.length === 'number') return Array.from(content);
  return [content];
}

// ── 事件存储/匹配 ──────────────────────────────────────────────────────────
interface HandlerRec { type: string; ns: string[]; fn: any; selector?: string; data?: any; wrapper?: any; }

const evStore = new WeakMap<any, HandlerRec[]>();

function parseTypes(spec: string): Array<{ type: string; ns: string[] }> {
  return String(spec).split(/\s+/).filter(Boolean).map((t) => {
    const parts = t.split('.');
    return { type: parts[0], ns: parts.slice(1).filter(Boolean) };
  });
}

function matchSpec(rec: HandlerRec, type: string, ns: string[]): boolean {
  if (type && rec.type !== type) return false;
  return ns.every((n) => rec.ns.indexOf(n) !== -1);
}

function enrich(ev: any, delegateTarget: any, data: any): any {
  ev.delegateTarget = delegateTarget;
  ev.data = data;
  return ev;
}

function bindRec(root: any, rec: HandlerRec): void {
  let list = evStore.get(root);
  if (!list) { list = []; evStore.set(root, list); }
  // 委托 mouseenter/mouseleave 需借道冒泡事件（原生 mouseenter 不冒泡）
  const domType = rec.selector
    ? (rec.type === 'mouseenter' ? 'mouseover' : rec.type === 'mouseleave' ? 'mouseout' : rec.type)
    : rec.type;
  rec.wrapper = function (ev: any) {
    if (rec.selector) {
      const t = ev.target;
      const matched = t && typeof t.closest === 'function' ? t.closest(rec.selector) : null;
      if (!matched || !(root === document || root === window || root.contains(matched))) return;
      if (rec.type === 'mouseenter' || rec.type === 'mouseleave') {
        const rel = ev.relatedTarget;
        if (rel && matched.contains(rel)) return;
      }
      rec.fn.call(matched, enrich(ev, root, rec.data));
    } else {
      rec.fn.call(root, enrich(ev, root, rec.data));
    }
  };
  root.addEventListener(domType, rec.wrapper, false);
  list.push(rec);
}

function unbindRecs(root: any, spec: { type: string; ns: string[] } | null): void {
  const list = evStore.get(root);
  if (!list) return;
  for (let i = list.length - 1; i >= 0; i--) {
    const rec = list[i];
    if (spec && !matchSpec(rec, spec.type, spec.ns)) continue;
    const domType = rec.selector
      ? (rec.type === 'mouseenter' ? 'mouseover' : rec.type === 'mouseleave' ? 'mouseout' : rec.type)
      : rec.type;
    root.removeEventListener(domType, rec.wrapper, false);
    list.splice(i, 1);
  }
}

// ── 动画（duration=0 瞬时；>0 rAF 补间） ──────────────────────────────────
const animStore = new WeakMap<any, number>();

function applyStyle(el: any, prop: string, value: any): void {
  setCssEl(el, { [prop]: value } as any);
}

function setStyleProp(el: any, prop: string, value: any): void {
  applyStyle(el, prop, value);
}

function runAnimate(els: AnyNode[], props: Record<string, any>, duration: number, cb?: any): void {
  const keys = Object.keys(props);
  if (!duration || duration <= 0) {
    els.forEach((el) => keys.forEach((k) => setStyleProp(el, k, props[k])));
    if (typeof cb === 'function') cb.call(els[0]);
    return;
  }
  const start = performance.now();
  const from: Record<string, number> = {};
  els.forEach((el) => keys.forEach((k) => { from[k] = parseFloat(cssGet(el, k)) || 0; }));
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    els.forEach((el) => keys.forEach((k) => {
      const to = parseFloat(props[k]);
      const val = isNaN(to) ? props[k] : from[k] + (to - from[k]) * t;
      setStyleProp(el, k, val);
    }));
    if (t < 1) {
      els.forEach((el) => animStore.set(el, requestAnimationFrame(step)));
    } else if (typeof cb === 'function') {
      cb.call(els[0]);
    }
  };
  els.forEach((el) => animStore.set(el, requestAnimationFrame(step)));
}

function stopAnimate(els: AnyNode[]): void {
  els.forEach((el) => {
    const id = animStore.get(el);
    if (id) { cancelAnimationFrame(id); animStore.delete(el); }
  });
}

/** jQuery `$(...)` 的原生等价（子集）。 */
export class DomSet {
  [index: number]: AnyNode;
  els: AnyNode[] = [];
  length = 0;
  prevObject: any;

  constructor(input?: any, props?: Record<string, any>) {
    if (input == null) return this;
    let els: AnyNode[];
    if (input instanceof DomSet) {
      els = input.els.slice();
      this.prevObject = input;
    } else if (typeof input === 'string') {
      const s = input.trim();
      if (s.charAt(0) === '<') {
        els = createFromHtml(s);
        if (props) els.forEach((el) => this._applyProps(el, props));
      } else {
        els = Array.from(document.querySelectorAll(s));
      }
    } else if (isElementish(input)) {
      els = [input];
    } else if (input.nodeType) {
      els = [input];
    } else if (typeof input.length === 'number') {
      els = Array.from(input);
    } else {
      els = [];
    }
    this._set(els);
    return this;
  }

  private _set(els: AnyNode[]): void {
    this.els = els;
    this.length = els.length;
    els.forEach((el, i) => { (this as any)[i] = el; });
  }

  private _applyProps(el: any, props: Record<string, any>): void {
    Object.keys(props).forEach((k) => {
      const v = props[k];
      if (typeof v === 'function') { this._onOne(el, k, undefined, undefined, v); return; }
      if (BOOL_ATTRS.has(k)) {
        if (v === false) el.removeAttribute(k);
        else el.setAttribute(k, k);
      } else {
        el.setAttribute(k, String(v));
      }
    });
  }

  private _wrap(els: AnyNode[]): DomSet {
    const d = new DomSet();
    d._set(els);
    return d;
  }

  // ── 集合遍历 ──
  each(fn: any): this {
    this.els.forEach((el, i) => fn.call(el, i, el));
    return this;
  }
  map(fn: any): any[] {
    return this.els.map((el, i) => fn.call(el, i, el));
  }
  get(i?: number): any {
    if (i == null) return this.els.slice();
    return i < 0 ? this.els[this.els.length + i] : this.els[i];
  }
  eq(i: number): DomSet {
    return this._wrap([this.get(i)].filter(Boolean));
  }
  first(): DomSet { return this.eq(0); }
  last(): DomSet { return this.eq(-1); }
  index(el?: any): number {
    if (el == null) {
      const p = (this.els[0] as any)?.parentNode;
      return p ? Array.prototype.indexOf.call(p.children, this.els[0]) : -1;
    }
    const node = el instanceof DomSet ? el.els[0] : el;
    return this.els.indexOf(node);
  }

  // ── 查找/过滤 ──
  find(sel: string): DomSet {
    const out: AnyNode[] = [];
    this.els.forEach((el) => {
      if (el && typeof el.querySelectorAll === 'function') {
        Array.prototype.push.apply(out, el.querySelectorAll(sel));
      }
    });
    return this._wrap(Array.from(new Set(out)));
  }
  children(sel?: string): DomSet {
    const out: AnyNode[] = [];
    this.els.forEach((el) => {
      const kids = el && el.children ? Array.from(el.children) : [];
      kids.forEach((c: any) => { if (!sel || c.matches(sel)) out.push(c); });
    });
    return this._wrap(Array.from(new Set(out)));
  }
  parent(): DomSet {
    const out: AnyNode[] = [];
    this.els.forEach((el) => { const p = el && el.parentElement; if (p) out.push(p); });
    return this._wrap(Array.from(new Set(out)));
  }
  parents(sel?: string): DomSet {
    const out: AnyNode[] = [];
    this.els.forEach((el) => {
      let p = el && el.parentElement;
      while (p) { if (!sel || p.matches(sel)) out.push(p); p = p.parentElement; }
    });
    return this._wrap(Array.from(new Set(out)));
  }
  closest(sel: string): DomSet {
    const out: AnyNode[] = [];
    this.els.forEach((el) => {
      const m = el && typeof el.closest === 'function' ? el.closest(sel) : null;
      if (m) out.push(m);
    });
    return this._wrap(Array.from(new Set(out)));
  }
  has(target: any): DomSet {
    const node = typeof target === 'string' ? null : (target instanceof DomSet ? target.els[0] : target);
    const out = this.els.filter((el) => {
      if (!el || typeof el.querySelectorAll !== 'function') return false;
      if (typeof target === 'string') return !!el.querySelector(target);
      return node && el !== node && el.contains(node);
    });
    return this._wrap(out);
  }
  is(sel: string): boolean {
    return this.els.some((el) => el && typeof el.matches === 'function' && el.matches(sel));
  }
  filter(sel: string): DomSet {
    return this._wrap(this.els.filter((el) => el && typeof el.matches === 'function' && el.matches(sel)));
  }
  not(sel: string): DomSet {
    return this._wrap(this.els.filter((el) => !(el && typeof el.matches === 'function' && el.matches(sel))));
  }

  // ── 类/属性/样式/数据 ──
  addClass(c: string): this { this.els.forEach((el) => addClassEl(el, c)); return this; }
  removeClass(c: string): this { this.els.forEach((el) => removeClassEl(el, c)); return this; }
  toggleClass(c: string): this {
    this.els.forEach((el) => (hasClassEl(el, c) ? removeClassEl(el, c) : addClassEl(el, c)));
    return this;
  }
  hasClass(c: string): boolean { return hasClassEl(this.els[0] || null, c); }

  attr(name: string, value?: any): any {
    if (value === undefined) {
      const el = this.els[0];
      return el ? el.getAttribute(name) : undefined;
    }
    this.els.forEach((el) => {
      if (BOOL_ATTRS.has(name)) {
        if (value === false) el.removeAttribute(name);
        else el.setAttribute(name, name);
      } else {
        el.setAttribute(name, String(value));
      }
    });
    return this;
  }
  removeAttr(name: string): this { this.els.forEach((el) => el.removeAttribute(name)); return this; }
  prop(name: string, value?: any): any {
    if (value === undefined) return this.els[0] ? this.els[0][name] : undefined;
    this.els.forEach((el) => { el[name] = value; });
    return this;
  }
  val(value?: any): any {
    if (value === undefined) return this.els[0] ? this.els[0].value : undefined;
    this.els.forEach((el) => { el.value = value; });
    return this;
  }

  css(prop: any, value?: any): any {
    if (typeof prop === 'string') {
      if (value === undefined) return cssGet(this.els[0] || null, prop);
      this.els.forEach((el) => setCssEl(el, { [prop]: value } as any));
      return this;
    }
    this.els.forEach((el) => setCssEl(el, prop));
    return this;
  }

  data(key: string, value?: any): any {
    if (value === undefined) return dataGet(this.els[0] || null, key);
    this.els.forEach((el) => dataSet(el, key, value));
    return this;
  }
  removeData(key: string): this { this.els.forEach((el) => dataRemove(el, key)); return this; }

  html(value?: any): any {
    if (value === undefined) return htmlOf(this.els[0] || null);
    this.els.forEach((el) => setHtmlEl(el, value));
    return this;
  }
  text(value?: any): any {
    if (value === undefined) return this.els[0] ? this.els[0].textContent : '';
    this.els.forEach((el) => { el.textContent = String(value); });
    return this;
  }

  // ── 尺寸/位置 ──
  width(value?: any): any {
    if (value === undefined) {
      const el = this.els[0];
      if (isWindow(el)) return window.innerWidth;
      if (isDocument(el)) return document.documentElement.clientWidth;
      return widthOf(el || null);
    }
    this.els.forEach((el) => setWidthEl(el, value));
    return this;
  }
  height(value?: any): any {
    if (value === undefined) {
      const el = this.els[0];
      if (isWindow(el)) return window.innerHeight;
      if (isDocument(el)) return document.documentElement.clientHeight;
      return heightOf(el || null);
    }
    this.els.forEach((el) => setHeightEl(el, value));
    return this;
  }
  outerWidth(): number { return outerWidthOf(this.els[0] || null); }
  outerHeight(): number { return outerHeightOf(this.els[0] || null); }
  offset(): { left: number; top: number } | undefined {
    const el = this.els[0];
    if (!el || isWindow(el)) return undefined;
    const r = el.getBoundingClientRect();
    return { left: r.left + window.scrollX, top: r.top + window.scrollY };
  }
  position(): { left: number; top: number } {
    const el = this.els[0];
    if (!el) return { left: 0, top: 0 };
    return { left: el.offsetLeft || 0, top: el.offsetTop || 0 };
  }
  scrollTop(value?: any): any {
    if (value === undefined) return this.els[0] ? this.els[0].scrollTop : 0;
    this.els.forEach((el) => { el.scrollTop = value; });
    return this;
  }
  scrollLeft(value?: any): any {
    if (value === undefined) return this.els[0] ? this.els[0].scrollLeft : 0;
    this.els.forEach((el) => { el.scrollLeft = value; });
    return this;
  }

  // ── DOM 变更 ──
  append(content: any): this {
    const nodes = toNodes(content);
    this.els.forEach((el, ti) => {
      nodes.forEach((n, ni) => {
        const node = (ti === this.els.length - 1) ? n : n.cloneNode ? n.cloneNode(true) : n;
        if (node) el.appendChild(node);
        void ni;
      });
    });
    return this;
  }
  prepend(content: any): this {
    const nodes = toNodes(content);
    this.els.forEach((el) => {
      nodes.forEach((n) => {
        const node = n.cloneNode ? n.cloneNode(true) : n;
        el.insertBefore(node, el.firstChild);
      });
    });
    return this;
  }
  appendTo(target: any): this {
    const t = target instanceof DomSet ? target : new DomSet(target);
    t.append(this.els);
    return this;
  }
  insertBefore(target: any): this {
    const t = (target instanceof DomSet ? target.els[0] : (target.nodeType ? target : new DomSet(target).els[0]));
    if (t && t.parentNode) this.els.forEach((el) => t.parentNode.insertBefore(el, t));
    return this;
  }
  wrap(html: string): this {
    this.els.forEach((el) => {
      const wrapper = createFromHtml(html)[0];
      if (!wrapper) return;
      const parent = el.parentNode;
      if (!parent) return;
      parent.insertBefore(wrapper, el);
      let deepest: any = wrapper;
      while (deepest.firstElementChild) deepest = deepest.firstElementChild;
      deepest.appendChild(el);
    });
    return this;
  }
  empty(): this { this.els.forEach((el) => { el.innerHTML = ''; }); return this; }
  remove(): this {
    this.els.forEach((el) => { if (el.parentNode) el.parentNode.removeChild(el); });
    return this;
  }
  detach(): this { return this.remove(); }
  clone(): DomSet {
    return this._wrap(this.els.map((el) => (el.cloneNode ? el.cloneNode(true) : el)));
  }

  // ── 可见性/动画 ──
  show(): this {
    this.els.forEach((el) => { el.style.display = el._domLiteDisplay || ''; });
    return this;
  }
  hide(): this {
    this.els.forEach((el) => {
      if (el.style.display && el.style.display !== 'none') el._domLiteDisplay = el.style.display;
      el.style.display = 'none';
    });
    return this;
  }
  fadeIn(duration?: number, cb?: any): this {
    this.els.forEach((el) => { el.style.display = el._domLiteDisplay || ''; el.style.opacity = '0'; });
    runAnimate(this.els, { opacity: 1 }, duration || 0, cb);
    return this;
  }
  fadeOut(duration?: number, cb?: any): this {
    runAnimate(this.els, { opacity: 0 }, duration || 0, () => {
      this.hide();
      if (typeof cb === 'function') cb.call(this.els[0]);
    });
    return this;
  }
  stop(): this { stopAnimate(this.els); return this; }
  animate(props: Record<string, any>, duration?: number, easingOrCb?: any, cb?: any): this {
    const callback = typeof easingOrCb === 'function' ? easingOrCb : cb;
    runAnimate(this.els, props, duration || 0, callback);
    return this;
  }

  // ── 事件 ──
  private _onOne(el: any, type: string, data: any, selector: string | undefined, fn: any): void {
    if (typeof data === 'function') { fn = data; data = undefined; }
    if (typeof selector === 'function') { fn = selector; selector = undefined; }
    parseTypes(type).forEach(({ type: t, ns }) => {
      if (!t) return;
      bindRec(el, { type: t, ns, fn, selector, data });
    });
  }
  on(type: any, a?: any, b?: any, c?: any): this {
    this.els.forEach((el) => {
      if (typeof a === 'string') this._onOne(el, type, undefined, a, typeof b === 'function' ? b : c);
      else this._onOne(el, type, a, undefined, typeof b === 'function' ? b : c);
    });
    return this;
  }
  off(type?: string): this {
    this.els.forEach((el) => {
      if (!type) { unbindRecs(el, null); return; }
      parseTypes(type).forEach((spec) => unbindRecs(el, spec));
    });
    return this;
  }
  bind(type: any, a?: any, b?: any): this {
    this.els.forEach((el) => this._onOne(el, type, typeof a === 'function' ? undefined : a, undefined, typeof a === 'function' ? a : b));
    return this;
  }
  unbind(type?: string): this { return this.off(type); }
  trigger(type: string, data?: any): this {
    this.els.forEach((el) => {
      if (!el || typeof el.dispatchEvent !== 'function') return;
      const ev = new CustomEvent(type, { bubbles: true, cancelable: true, detail: data });
      (ev as any).data = data;
      const m = typeof el[type] === 'function' ? el[type] : null;
      el.dispatchEvent(ev);
      if (m && ['click', 'focus', 'blur', 'select', 'submit', 'change'].indexOf(type) !== -1) {
        try { m.call(el); } catch (e) { /* noop */ }
      }
    });
    return this;
  }
  /** jQuery `.click()`（无参触发） / `.click(fn)`（绑定）。 */
  click(fn?: any): this {
    if (typeof fn === 'function') return this.on('click', fn);
    this.els.forEach((el) => { if (typeof el.click === 'function') el.click(); });
    return this;
  }
  focus(fn?: any): this {
    if (typeof fn === 'function') return this.on('focus', fn);
    this.els.forEach((el) => { if (typeof el.focus === 'function') el.focus(); });
    return this;
  }
  blur(fn?: any): this {
    if (typeof fn === 'function') return this.on('blur', fn);
    this.els.forEach((el) => { if (typeof el.blur === 'function') el.blur(); });
    return this;
  }
  select(fn?: any): this {
    if (typeof fn === 'function') return this.on('select', fn);
    this.els.forEach((el) => { if (typeof el.select === 'function') el.select(); });
    return this;
  }
  /** jQuery `.ready(fn)`：DOM 就绪后执行（已就绪则下一个微任务）。 */
  ready(fn: any): this {
    const run = () => fn.call(document);
    if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(run, 0);
    else document.addEventListener('DOMContentLoaded', run, { once: true });
    return this;
  }
}

/** jQuery `$(...)` 工厂（子集）。 */
export function dom(input?: any, props?: Record<string, any>): DomSet {
  return new DomSet(input, props);
}
