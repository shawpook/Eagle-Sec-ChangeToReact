/**
 * D-2f：自研 sortable（替代 jQuery UI `.sortable()`）。
 *
 * 覆盖 7 个宿主的实际用法：`distance` / `handle` / `disabled` / `helper:'clone'`（视觉克隆，
 * 忽略其差异）/ `update` / `stop`，以及 `sortable('toArray', { attribute })` 的顺序回读。
 *
 * 行为：以 pointer 事件驱动，拖动项在父容器内按兄弟节点中点重排；`update` 在落点后触发，
 * 宿主再用 `sortableToArray(el, attr)` 读新顺序。item 的 data-* 属性**不随重排改写**（是身份标记）。
 */

export interface SortableOptions {
  handle?: string;
  items?: string;
  distance?: number;
  disabled?: boolean;
  helper?: string;
  animation?: number;
  tolerance?: string;
  axis?: string;
  update?: (event: Event) => void;
  stop?: (event: Event) => void;
}

export interface SortableHandle {
  destroy(): void;
  setDisabled(value: boolean): void;
}

const MARK = '__eagleSortable';

export function sortableToArray(el: HTMLElement, attribute: string): string[] {
  const out: string[] = [];
  for (const child of Array.from(el.children)) {
    if (child instanceof HTMLElement && child.classList.contains('eagle-sort-placeholder')) continue;
    const v = child.getAttribute(attribute);
    if (v !== null) out.push(v);
  }
  return out;
}

export function getSortable(el: HTMLElement): SortableHandle | undefined {
  return (el as any)[MARK] as SortableHandle | undefined;
}

function directChildOf(el: HTMLElement, target: HTMLElement | null, items?: string): HTMLElement | null {
  let node: HTMLElement | null = target;
  while (node && node.parentElement !== el) node = node.parentElement;
  if (!node || node.parentElement !== el) return null;
  if (items && !node.matches(items)) return null;
  return node;
}

export function makeSortable(el: HTMLElement, opts: SortableOptions = {}): SortableHandle {
  const existing = (el as any)[MARK] as SortableHandle | undefined;
  if (existing) return existing;

  let disabled = !!opts.disabled;
  let item: HTMLElement | null = null;
  let placeholder: HTMLElement | null = null;
  let startX = 0, startY = 0;
  let started = false;
  let rect: DOMRect | null = null;

  const onMove = (ev: PointerEvent): void => {
    if (!item) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (!started) {
      if (Math.hypot(dx, dy) < (opts.distance ?? 0)) return;
      started = true;
      rect = item.getBoundingClientRect();
      placeholder = document.createElement('div');
      placeholder.className = 'eagle-sort-placeholder';
      placeholder.style.width = `${rect.width}px`;
      placeholder.style.height = `${rect.height}px`;
      placeholder.style.pointerEvents = 'none';
      el.insertBefore(placeholder, item);
      item.style.position = 'fixed';
      item.style.left = `${rect.left}px`;
      item.style.top = `${rect.top}px`;
      item.style.width = `${rect.width}px`;
      item.style.height = `${rect.height}px`;
      item.style.zIndex = '9999';
      item.style.pointerEvents = 'none';
      item.style.opacity = '0.9';
    }
    const targetTop = rect!.top + dy;
    const targetLeft = rect!.left + dx;
    item.style.left = `${targetLeft}px`;
    item.style.top = `${targetTop}px`;

    const siblings = Array.from(el.children).filter(
      (c) => c !== item && c !== placeholder && c instanceof HTMLElement
    ) as HTMLElement[];
    const pointerY = targetTop + rect!.height / 2;
    let before: HTMLElement | null = null;
    for (const sib of siblings) {
      const r = sib.getBoundingClientRect();
      if (pointerY < r.top + r.height / 2) { before = sib; break; }
    }
    if (before) el.insertBefore(placeholder!, before);
    else el.appendChild(placeholder!);
  };

  const finish = (ev: PointerEvent): void => {
    document.removeEventListener('pointermove', onMove);
    if (item && started && placeholder && placeholder.parentElement) {
      el.insertBefore(item, placeholder);
      item.style.position = '';
      item.style.left = '';
      item.style.top = '';
      item.style.width = '';
      item.style.height = '';
      item.style.zIndex = '';
      item.style.pointerEvents = '';
      item.style.opacity = '';
      placeholder.remove();
      placeholder = null;
      opts.update?.(ev);
      opts.stop?.(ev);
    }
    started = false;
    item = null;
  };

  const onDown = (ev: PointerEvent): void => {
    if (disabled || ev.button !== 0) return;
    const target = ev.target as HTMLElement | null;
    if (opts.handle && !(target && target.closest(opts.handle))) return;
    const found = directChildOf(el, target, opts.items);
    if (!found) return;
    item = found;
    startX = ev.clientX;
    startY = ev.clientY;
    started = false;
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', finish, { once: true });
  };

  el.addEventListener('pointerdown', onDown);

  const api: SortableHandle = {
    setDisabled(value: boolean): void { disabled = value; },
    destroy(): void {
      el.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointermove', onMove);
      if (placeholder) { placeholder.remove(); placeholder = null; }
      delete (el as any)[MARK];
    },
  };
  (el as any)[MARK] = api;
  return api;
}
