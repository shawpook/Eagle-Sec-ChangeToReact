/**
 * D-2f：原生元素的最小 jQuery 风格包装。
 *
 * 目的：自研交互层（resizable/sortable/draggable）需要向既有回调合成 **jQuery-UI 兼容的
 * `ui.element` / `ui.helper`**，这些回调消费 `.css('left')` / `.width()` / `.innerWidth()` /
 * `.outerWidth()` 等 jQuery 语义。本包装只实现被消费到的那几个方法，不做选择器/链式集合。
 *
 * 语义对齐（与 jQuery 一致）：
 * - `width()/height()`：**content-box**（`getComputedStyle().width` 即 CSS 计算宽度，border-box
 *   元素的该值亦为内容宽）。
 * - `innerWidth()`：content + padding；`outerWidth()`：inner + border。
 * - `css(prop)` 取值返回计算值字符串（`left` 即 px 字面量，供 `parseInt` 消费）。
 */

export interface ElHandle {
  el: HTMLElement;
  css(prop: string | Record<string, string | number>, value?: string | number): any;
  width(value?: number | string): any;
  height(value?: number | string): any;
  innerWidth(): number;
  innerHeight(): number;
  outerWidth(): number;
  outerHeight(): number;
  offset(): { left: number; top: number };
  position(): { left: number; top: number };
  hide(): ElHandle;
  show(): ElHandle;
}

/** jQuery `.css()` 对无单位属性不补 px。 */
const UNITLESS = new Set(['zIndex', 'opacity', 'fontWeight', 'lineHeight', 'order', 'flex', 'flexGrow', 'flexShrink']);

function toCssValue(prop: string, value: string | number): string {
  if (typeof value === 'number' && !UNITLESS.has(prop)) return `${value}px`;
  return String(value);
}

function pad(cs: CSSStyleDeclaration, side: 'Left' | 'Right' | 'Top' | 'Bottom'): number {
  return parseFloat(cs[`padding${side}` as any]) || 0;
}

function border(cs: CSSStyleDeclaration, side: 'Left' | 'Right' | 'Top' | 'Bottom'): number {
  return parseFloat(cs[`border${side}Width` as any]) || 0;
}

export function elementHandle(el: HTMLElement): ElHandle {
  const h: ElHandle = {
    el,
    css(prop: any, value?: any) {
      if (typeof prop === 'string' && value === undefined) {
        return getComputedStyle(el).getPropertyValue(prop);
      }
      if (typeof prop === 'string') {
        (el.style as any)[prop] = toCssValue(prop, value);
      } else {
        for (const k of Object.keys(prop)) (el.style as any)[k] = toCssValue(k, prop[k]);
      }
      return h;
    },
    width(value?: number | string) {
      if (value === undefined) return parseFloat(getComputedStyle(el).width) || 0;
      el.style.width = typeof value === 'number' ? `${value}px` : value;
      return h;
    },
    height(value?: number | string) {
      if (value === undefined) return parseFloat(getComputedStyle(el).height) || 0;
      el.style.height = typeof value === 'number' ? `${value}px` : value;
      return h;
    },
    innerWidth() { const cs = getComputedStyle(el); return h.width() + pad(cs, 'Left') + pad(cs, 'Right'); },
    innerHeight() { const cs = getComputedStyle(el); return h.height() + pad(cs, 'Top') + pad(cs, 'Bottom'); },
    outerWidth() { const cs = getComputedStyle(el); return h.innerWidth() + border(cs, 'Left') + border(cs, 'Right'); },
    outerHeight() { const cs = getComputedStyle(el); return h.innerHeight() + border(cs, 'Top') + border(cs, 'Bottom'); },
    offset() { const r = el.getBoundingClientRect(); return { left: r.left + window.scrollX, top: r.top + window.scrollY }; },
    position() { return { left: el.offsetLeft, top: el.offsetTop }; },
    hide() { el.style.display = 'none'; return h; },
    show() { el.style.display = ''; return h; },
  };
  return h;
}
