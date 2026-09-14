import { glRemoveitemsChannel, glResetChannel, glScrolltotopChannel } from '../../global/bus';
import { useBodyState } from '../../store/bodyState';
import { useFolderState, writeStartCursor } from '../../store/folderState';
import { useItemState } from '../../store/itemState';
import { useListState } from '../../store/listState';
import { useMiscRawState } from '../../store/miscRawState';

import {
  captureGridPosition, restoreGridPosition,
  type ContinuousLayout, type GridScrollPosition,
} from './continuousGridLayout';

type ScrollTarget =
  | { kind: 'position'; position: GridScrollPosition }
  | { kind: 'item'; id: string; align: 'start' | 'center' | 'nearest' }
  | { kind: 'bottom' }
  | { kind: 'legacy'; index: number; fraction: number };

type EngineState = {
  items: any[];
  version: number;
  layoutVersion: number;
  viewKey: string;
  pendingScroll: { viewKey: string; target: ScrollTarget } | null;
};

let state: EngineState = { items: [], version: 0, layoutVersion: 0, viewKey: '', pendingScroll: null };
const listeners = new Set<() => void>();
let view: { element: HTMLElement; container: HTMLElement; layout: ContinuousLayout; origin: number } | null = null;

export const getEngineState = () => state;
export const getEngineVersion = () => state.version;
export function subscribeEngine(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function notify() {
  state.version++;
  listeners.forEach((listener) => listener());
}

export function gridViewKey(): string {
  const folders = useFolderState.getState();
  const misc = useMiscRawState.getState();
  const filter = (window as any).eagle?.filter;
  return JSON.stringify([
    misc.libraryPath, useBodyState.getState().viewMode, folders.currentFolder?.id,
    folders.currentSmartFolder?.id, misc.currentTag, useListState.getState().keyword,
    filter?.filterRules,
  ]);
}

/** The old window.ig surface remains for selection, deletion and layout commands. It now
 * describes one continuous group; it never owns a second scroll position or changes pages. */
function visibleElements(): HTMLElement[] {
  return Array.from(view?.element.querySelectorAll<HTMLElement>('.box[data-box-id]') || []);
}

function invalidateLayout() {
  state.layoutVersion++;
  notify();
}

const facade = {
  remove(target: HTMLElement | { el?: HTMLElement; id?: string }) { removeGridItems([target]); },
  getItems(_visibleOnly?: boolean) {
    return visibleElements().map((el) => ({ id: el.dataset.boxId, el, groupKey: 1000000 }));
  },
  clear() {
    state.items = [];
    notify();
  },
  trigger(_name: string) { /* All results already belong to the same container. */ },
  layout: invalidateLayout,
  setLayout: invalidateLayout,
  getGroupKeys() { return state.items.length ? [1000000] : []; },
  _renderer: { updateSize() { /* Geometry comes from metadata, not mounted thumbnails. */ } },
  _watcher: {
    _onCheck() { /* Native scrolling drives the viewport. */ },
    getScrollPos() { return view?.container.scrollTop || 0; },
  },
  get _items() {
    return { _data: state.items.length ? [{ groupKey: 1000000, outlines: { start: [0], end: [view?.layout.height || 0] } }] : [] };
  },
  _layout: { get _columnLength() { return view?.layout.columns || 0; } },
  _updateContainerHeight() { /* React commits the full list height atomically. */ },
};

function removeGridItems(targets: Array<HTMLElement | { el?: HTMLElement; id?: string }>): void {
  const ids = new Set(targets.map((target) => target instanceof HTMLElement
    ? target.getAttribute('data-box-id') : target?.el?.getAttribute('data-box-id') || target?.id));
  const remaining = state.items.filter((item) => !ids.has(item.id));
  if (remaining.length === state.items.length) return;
  state.items = remaining;
  notify();
}

export function registerGridView(element: HTMLElement, container: HTMLElement, layout: ContinuousLayout): void {
  const origin = element.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
  view = { element, container, layout, origin };
}

export function unregisterGridView(): void { view = null; }

function requestScroll(target: ScrollTarget): void {
  state.pendingScroll = { viewKey: gridViewKey(), target };
  notify();
}

export function getGridScrollPosition(): GridScrollPosition {
  const top = document.getElementById('box-container')?.scrollTop || 0;
  return view ? captureGridPosition(view.layout, top, view.origin) : { top };
}

export function restoreGridScrollPosition(position: GridScrollPosition): void {
  requestScroll({ kind: 'position', position });
}

export function scrollGridToOffset(top: number): void {
  restoreGridScrollPosition({ top });
}

export function scrollGridToBottom(): void { requestScroll({ kind: 'bottom' }); }

export function scrollGridToItem(id: string, align: 'start' | 'center' | 'nearest' = 'nearest'): boolean {
  if (!state.items.some((item) => item.id === id)) return false;
  requestScroll({ kind: 'item', id, align });
  return true;
}

/** Consume a navigation request once, after React commits both geometry and container height.
 * A request saved before folder reload waits for that folder's result set, never a timer. */
export function applyPendingGridScroll(): boolean {
  const pending = state.pendingScroll;
  if (!view || !pending || pending.viewKey !== state.viewKey) return false;
  const { container, layout, origin } = view;
  const target = pending.target;
  let top = container.scrollTop;
  if (target.kind === 'position') top = restoreGridPosition(layout, target.position, origin);
  else if (target.kind === 'bottom') top = container.scrollHeight;
  else {
    const rect = target.kind === 'item' ? layout.byId.get(target.id) : layout.rects[Math.min(target.index, layout.rects.length - 1)];
    if (rect) {
      const itemTop = origin + rect.top;
      if (target.kind === 'legacy') {
        const end = layout.rects[Math.min(target.index + 60, layout.rects.length - 1)];
        top = itemTop + ((end?.top || rect.top) - rect.top) * target.fraction;
      } else if (target.align === 'center') top = itemTop - (container.clientHeight - rect.height) / 2;
      else if (target.align === 'start' || itemTop < top || rect.height >= container.clientHeight) top = itemTop;
      else if (itemTop + rect.height > top + container.clientHeight) top = itemTop + rect.height - container.clientHeight;
    }
  }
  state.pendingScroll = null;
  container.scrollTop = Math.max(0, Math.min(top, container.scrollHeight - container.clientHeight));
  return true;
}

function applyReset(items: any[], cursor = 0, fraction?: number): void {
  const key = gridViewKey();
  const changedView = key !== state.viewKey;
  const pending = state.pendingScroll?.viewKey === key ? state.pendingScroll : null;
  state = { ...state, items: Array.isArray(items) ? [...items] : [], viewKey: key, pendingScroll: pending };
  if (!pending) {
    if (cursor > 0 || fraction != null) {
      state.pendingScroll = { viewKey: key, target: { kind: 'legacy', index: Math.max(0, cursor) * 60, fraction: fraction || 0 } };
    } else if (changedView) {
      state.pendingScroll = { viewKey: key, target: { kind: 'position', position: { top: 0 } } };
    }
  }
  // Retain the field for older callers. There is no longer a current page to advance.
  writeStartCursor(0);
  notify();
}

let installed = false;
export function installBoxGrid(): () => void {
  if (installed) return () => {};
  installed = true;
  const w = window as any;
  w.ig = facade;
  w.NgGridStrings = {};
  w.resetNgGridLayoutData = applyReset;
  const cleanups = [
    // Muted refreshes and filter-driven removals also replace allData. Keep offscreen
    // items in sync without requiring a mounted element or resetting the scroll position.
    useItemState.subscribe((next, previous) => {
      if (next.allData === previous.allData || gridViewKey() !== state.viewKey) return;
      state.items = Array.isArray(next.allData) ? [...next.allData] : [];
      notify();
    }),
    glResetChannel.on((items: any[]) => applyReset(items)),
    glScrolltotopChannel.on(() => scrollGridToOffset(0)),
    glRemoveitemsChannel.on((elements: any[]) => {
      if (Array.isArray(elements)) removeGridItems(elements);
    }),
  ];
  return () => {
    cleanups.forEach((cleanup) => cleanup());
    unregisterGridView();
    installed = false;
    if (w.ig === facade) delete w.ig;
    if (w.resetNgGridLayoutData === applyReset) delete w.resetNgGridLayoutData;
  };
}
