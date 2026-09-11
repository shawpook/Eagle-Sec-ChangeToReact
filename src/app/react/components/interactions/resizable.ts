/**
 * D-2f：自研 resizable（替代 jQuery UI `.resizable()`）。
 *
 * 用于 D-2f-2 的各「宿主面板」：向既有回调合成 jQuery-UI 兼容的 `ui` 形状
 * （`size/position/originalSize/originalPosition` + `element/helper` 句柄），
 * 使回调体（消费 `ui.size.width` / `ui.position.left` / `ui.element.css('left')` 等）无需改写。
 *
 * 与 jQuery UI 对齐的点：
 * - handle 元素类名沿用 `ui-resizable-handle ui-resizable-<dir>`（既有 CSS 仍可命中）；
 * - `min/max` 以 content-box 计；`containment` 以 border-box 约束；
 * - `ui.size` 为 content-box，`ui.position` 为 offsetParent 相对坐标（`offsetLeft/Top`）。
 */

import { elementHandle, ElHandle } from './domHandle';

export interface ResizeUi {
  element: ElHandle;
  helper: ElHandle;
  position: { left: number; top: number };
  size: { width: number; height: number };
  originalPosition: { left: number; top: number };
  originalSize: { width: number; height: number };
}

export interface ResizableOptions {
  handles?: string;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  containment?: string | HTMLElement;
  /** 仅创建 handle 元素（供既有自研手柄逻辑消费），不挂 pointer 拖拽。 */
  handlesOnly?: boolean;
  start?: (event: PointerEvent, ui: ResizeUi) => void;
  resize?: (event: PointerEvent, ui: ResizeUi) => void;
  stop?: (event: PointerEvent, ui: ResizeUi) => void;
}

export interface ResizableHandle {
  destroy(): void;
}

/** 取元素上已装配的句柄（无则 undefined）——供「先销毁再按新闭包重建」的宿主使用。 */
export function getResizable(el: HTMLElement): ResizableHandle | undefined {
  return (el as any)[MARK] as ResizableHandle | undefined;
}

const MARK = '__eagleResizable';
const DIR_CURSOR: Record<string, string> = {
  n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
  ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize',
};

function parseHandles(s: string): string[] {
  const out: string[] = [];
  for (const raw of String(s).split(',')) {
    const d = raw.trim();
    if (d && DIR_CURSOR[d] && out.indexOf(d) === -1) out.push(d);
  }
  return out;
}

function containmentEl(c: string | HTMLElement | undefined): HTMLElement | null {
  if (!c) return null;
  if (typeof c !== 'string') return c;
  return document.querySelector(c) as HTMLElement | null;
}

interface Rect { left: number; top: number; right: number; bottom: number; }

function styleHandle(h: HTMLElement, dir: string): void {
  const s = h.style;
  s.position = 'absolute';
  s.zIndex = '90';
  s.touchAction = 'none';
  const EDGE = 7;
  const CORNER = 10;
  const set = (k: keyof CSSStyleDeclaration, v: string) => { (s as any)[k] = v; };
  if (dir === 'e') { set('right', '-4px'); set('top', '0'); set('width', `${EDGE}px`); set('height', '100%'); }
  else if (dir === 'w') { set('left', '-4px'); set('top', '0'); set('width', `${EDGE}px`); set('height', '100%'); }
  else if (dir === 'n') { set('top', '-4px'); set('left', '0'); set('height', `${EDGE}px`); set('width', '100%'); }
  else if (dir === 's') { set('bottom', '-4px'); set('left', '0'); set('height', `${EDGE}px`); set('width', '100%'); }
  else {
    set('width', `${CORNER}px`); set('height', `${CORNER}px`);
    if (dir.indexOf('n') !== -1) set('top', '-5px'); else set('bottom', '-5px');
    if (dir.indexOf('w') !== -1) set('left', '-5px'); else set('right', '-5px');
  }
  s.cursor = DIR_CURSOR[dir];
}

export function makeResizable(el: HTMLElement, opts: ResizableOptions = {}): ResizableHandle {
  const existing = (el as any)[MARK] as ResizableHandle | undefined;
  if (existing) return existing;

  const dirs = parseHandles(opts.handles || 'e, s, se');
  const hEl = elementHandle(el);
  const cs0 = getComputedStyle(el);
  const prevPosition = el.style.position;
  if (cs0.position === 'static') el.style.position = 'relative';

  const handleEls: HTMLElement[] = [];
  let startX = 0, startY = 0, dir = '';
  let startContentW = 0, startContentH = 0, startOuterW = 0, startOuterH = 0;
  let startOffsetL = 0, startOffsetT = 0;
  let startRect: Rect = { left: 0, top: 0, right: 0, bottom: 0 };
  let contRect: Rect | null = null;
  let ui: ResizeUi | null = null;
  let active = false;

  const onMove = (ev: PointerEvent): void => {
    if (!active || !ui) return;
    let dx = ev.clientX - startX;
    let dy = ev.clientY - startY;
    let w = startContentW, h = startContentH, l = startOffsetL, t = startOffsetT;

    if (dir.indexOf('e') !== -1) w = startContentW + dx;
    if (dir.indexOf('w') !== -1) { w = startContentW - dx; l = startOffsetL + dx; }
    if (dir.indexOf('s') !== -1) h = startContentH + dy;
    if (dir.indexOf('n') !== -1) { h = startContentH - dy; t = startOffsetT + dy; }

    const minW = opts.minWidth ?? 0, maxW = opts.maxWidth ?? Infinity;
    const minH = opts.minHeight ?? 0, maxH = opts.maxHeight ?? Infinity;
    if (w < minW) { if (dir.indexOf('w') !== -1) l -= (minW - w); w = minW; }
    if (w > maxW) { if (dir.indexOf('w') !== -1) l += (w - maxW); w = maxW; }
    if (h < minH) { if (dir.indexOf('n') !== -1) t -= (minH - h); h = minH; }
    if (h > maxH) { if (dir.indexOf('n') !== -1) t += (h - maxH); h = maxH; }

    if (contRect) {
      // border-box 约束：尺寸变化对 border-box 的增量 = 对 content-box 的增量。
      const bbW = startOuterW + (w - startContentW);
      const bbH = startOuterH + (h - startContentH);
      const outerL = startRect.left + (l - startOffsetL);
      const outerT = startRect.top + (t - startOffsetT);
      if (dir.indexOf('e') !== -1 && outerL + bbW > contRect.right) w -= (outerL + bbW) - contRect.right;
      if (dir.indexOf('w') !== -1 && outerL < contRect.left) { const over = contRect.left - outerL; w -= over; l += over; }
      if (dir.indexOf('s') !== -1 && outerT + bbH > contRect.bottom) h -= (outerT + bbH) - contRect.bottom;
      if (dir.indexOf('n') !== -1 && outerT < contRect.top) { const over = contRect.top - outerT; h -= over; t += over; }
      w = Math.max(w, 1); h = Math.max(h, 1);
    }

    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    if (dir.indexOf('w') !== -1) el.style.left = `${l}px`;
    if (dir.indexOf('n') !== -1) el.style.top = `${t}px`;

    ui.size.width = w;
    ui.size.height = h;
    ui.position.left = el.offsetLeft;
    ui.position.top = el.offsetTop;
    opts.resize?.(ev, ui);
  };

  const finish = (ev: PointerEvent): void => {
    if (!active) return;
    active = false;
    document.removeEventListener('pointermove', onMove);
    window.removeEventListener('blur', onBlur);
    if (ui) opts.stop?.(ev, ui);
  };

  const onBlur = (): void => { finish(new PointerEvent('blur')); };

  const down = (d: string) => (ev: PointerEvent): void => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    dir = d;
    startX = ev.clientX;
    startY = ev.clientY;
    startContentW = hEl.width();
    startContentH = hEl.height();
    startOffsetL = el.offsetLeft;
    startOffsetT = el.offsetTop;
    const r = el.getBoundingClientRect();
    startRect = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    startOuterW = r.width;
    startOuterH = r.height;
    const cEl = containmentEl(opts.containment);
    if (cEl) { const cr = cEl.getBoundingClientRect(); contRect = { left: cr.left, top: cr.top, right: cr.right, bottom: cr.bottom }; }
    else contRect = null;
    ui = {
      element: hEl,
      helper: hEl,
      position: { left: startOffsetL, top: startOffsetT },
      size: { width: startContentW, height: startContentH },
      originalPosition: { left: startOffsetL, top: startOffsetT },
      originalSize: { width: startContentW, height: startContentH },
    };
    active = true;
    opts.start?.(ev, ui);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', finish, { once: true });
    window.addEventListener('blur', onBlur);
  };

  for (const d of dirs) {
    const hd = document.createElement('div');
    hd.className = `ui-resizable-handle ui-resizable-${d}`;
    styleHandle(hd, d);
    if (!opts.handlesOnly) hd.addEventListener('pointerdown', down(d));
    el.appendChild(hd);
    handleEls.push(hd);
  }

  const api: ResizableHandle = {
    destroy(): void {
      active = false;
      document.removeEventListener('pointermove', onMove);
      window.removeEventListener('blur', onBlur);
      for (const hd of handleEls) hd.remove();
      handleEls.length = 0;
      if (cs0.position === 'static') el.style.position = prevPosition;
      delete (el as any)[MARK];
    },
  };
  (el as any)[MARK] = api;
  return api;
}
