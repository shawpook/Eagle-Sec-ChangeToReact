/**
 * D-2f：自研 draggable（替代 jQuery UI `.draggable()`）。
 *
 * 用于 3 个浮动 select 面板。向回调合成 `ui.helper`（ElHandle）与
 * `position/originalPosition`，使既有 start/stop 回调（读 `ui.helper.outerWidth/Height`、
 * 用 `$selectPanel.height()/width()` 还原尺寸）无需改写。
 *
 * 与 jQuery UI 对齐：默认 `cancel` 命中 `input/textarea/button/select/option/.ui-resizable-handle`
 * 时不启动拖拽；`distance` 像素内视为点击；`containment: 'body'` 约束在视口内。
 */

import { elementHandle, ElHandle } from './domHandle';

export interface DragUi {
  helper: ElHandle;
  position: { left: number; top: number };
  originalPosition: { left: number; top: number };
}

export interface DraggableOptions {
  distance?: number;
  containment?: string | HTMLElement;
  axis?: 'x' | 'y';
  start?: (event: PointerEvent, ui: DragUi) => void;
  drag?: (event: PointerEvent, ui: DragUi) => void;
  stop?: (event: PointerEvent, ui: DragUi) => void;
}

export interface DraggableHandle {
  destroy(): void;
}

const MARK = '__eagleDraggable';

interface Rect { left: number; top: number; right: number; bottom: number; }

function containmentRect(c: string | HTMLElement | undefined, el: HTMLElement): Rect | null {
  if (!c) return null;
  if (c === 'body' || c === 'html') {
    return { left: 0, top: 0, right: window.innerWidth + window.scrollX, bottom: window.innerHeight + window.scrollY };
  }
  const target = c === 'parent' ? el.parentElement : (typeof c === 'string' ? (document.querySelector(c) as HTMLElement | null) : c);
  if (!target) return null;
  const r = target.getBoundingClientRect();
  return { left: r.left + window.scrollX, top: r.top + window.scrollY, right: r.right + window.scrollX, bottom: r.bottom + window.scrollY };
}

export function makeDraggable(el: HTMLElement, opts: DraggableOptions = {}): DraggableHandle {
  const existing = (el as any)[MARK] as DraggableHandle | undefined;
  if (existing) return existing;

  const hEl = elementHandle(el);
  const cs0 = getComputedStyle(el);
  const prevPosition = el.style.position;
  if (cs0.position === 'static') el.style.position = 'absolute';

  let sx = 0, sy = 0, sL = 0, sT = 0;
  let started = false;
  let ui: DragUi | null = null;
  let cont: Rect | null = null;

  const onMove = (ev: PointerEvent): void => {
    if (!ui) return;
    const dx = ev.clientX - sx;
    const dy = ev.clientY - sy;
    if (!started) {
      if (Math.hypot(dx, dy) < (opts.distance ?? 0)) return;
      started = true;
      opts.start?.(ev, ui);
    }
    let l = opts.axis === 'y' ? sL : sL + dx;
    let t = opts.axis === 'x' ? sT : sT + dy;
    if (cont) {
      const ow = el.offsetWidth;
      const oh = el.offsetHeight;
      l = Math.min(Math.max(l, cont.left), Math.max(cont.left, cont.right - ow));
      t = Math.min(Math.max(t, cont.top), Math.max(cont.top, cont.bottom - oh));
    }
    el.style.left = `${l}px`;
    el.style.top = `${t}px`;
    ui.position.left = el.offsetLeft;
    ui.position.top = el.offsetTop;
    opts.drag?.(ev, ui);
  };

  const finish = (ev: PointerEvent): void => {
    document.removeEventListener('pointermove', onMove);
    if (started && ui) opts.stop?.(ev, ui);
    started = false;
    ui = null;
  };

  const onDown = (ev: PointerEvent): void => {
    if (ev.button !== 0) return;
    const target = ev.target as HTMLElement | null;
    if (target && target.closest('input, textarea, button, select, option, .ui-resizable-handle')) return;
    ev.preventDefault();
    sx = ev.clientX;
    sy = ev.clientY;
    sL = el.offsetLeft;
    sT = el.offsetTop;
    cont = containmentRect(opts.containment, el);
    ui = { helper: hEl, position: { left: sL, top: sT }, originalPosition: { left: sL, top: sT } };
    started = false;
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', finish, { once: true });
  };

  el.addEventListener('pointerdown', onDown);

  const api: DraggableHandle = {
    destroy(): void {
      el.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointermove', onMove);
      if (cs0.position === 'static') el.style.position = prevPosition;
      delete (el as any)[MARK];
    },
  };
  (el as any)[MARK] = api;
  return api;
}
