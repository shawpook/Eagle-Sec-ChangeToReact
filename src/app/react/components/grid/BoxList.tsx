import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { onBoxListDblClick, onBoxMouseup, select } from '../../services/selectionService';
import { openItemContextMenu } from '../../services/itemMenuService';
import { openFileListContextMenu } from '../../services/miscMenuService';
import {
  installBoxGrid, subscribeEngine, getEngineState, getEngineVersion,
  registerGridView, unregisterGridView, applyPendingGridScroll,
} from './boxGridEngine';
import {
  calculateContinuousLayout, visibleGridRects, captureGridPosition, restoreGridPosition,
  type ContinuousLayout,
} from './continuousGridLayout';
import { BoxItem } from './boxItem';
import { zoomIn as gridZoomIn, zoomOut as gridZoomOut } from '../../services/gridService';
import { runInBodyScope } from '../../core/appCore';
import { cleanSelected } from '../../services/batchOpsService';
import { useItemState } from '../../store/itemState';
import { useBodyState } from '../../store/bodyState';
import { useLayoutState } from '../../store/layoutState';
import { useMiscRawState } from '../../store/miscRawState';
import './continuousGrid.css';

/** One full-height list with a bounded DOM window. Geometry is computed for all results before
 * paint; neither scrolling nor lazy thumbnails can replace the list or resize its scrollbar. */
export function BoxList() {
  const version = useSyncExternalStore(subscribeEngine, getEngineVersion);
  const engine = getEngineState();
  const layoutName = useBodyState((state) => state.layout) || 'JustifiedLayout';
  const size = useLayoutState((state) => state.imageSize?.height || 150);
  const showName = useMiscRawState((state) => state.showName !== false);
  const showMetas = useMiscRawState((state) => state.showMetas !== false);
  const [hostEl, setHostEl] = useState<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);
  const previous = useRef<{ layout: ContinuousLayout; origin: number; viewKey: string } | null>(null);
  const [viewport, setViewport] = useState({ top: 0, height: 0, width: 0, origin: 0 });

  const measureViewport = useCallback(() => {
    const container = document.getElementById('box-container');
    if (!container || container.clientWidth === 0 || container.clientHeight === 0) return;
    const origin = listRef.current
      ? listRef.current.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop
      : 0;
    const next = { top: container.scrollTop, height: container.clientHeight, width: container.clientWidth, origin };
    lastScrollTop.current = next.top;
    setViewport((old) => old.top === next.top && old.height === next.height && old.width === next.width && old.origin === next.origin ? old : next);
  }, []);

  useEffect(() => {
    setHostEl(document.getElementById('box-list'));
    const cleanups: Array<() => void> = [];
    const host = document.getElementById('box-list');
    if (host) {
      const boxFrom = (target: EventTarget | null) =>
        (target as HTMLElement | null)?.closest?.('.box') as HTMLElement | null;
      const itemOf = (box: HTMLElement | null) => {
        const id = box?.getAttribute('data-box-id');
        return id ? useItemState.getState().itemMappings?.[id] : null;
      };
      const onMouseDown = (event: MouseEvent) => {
        const box = boxFrom(event.target);
        if (box) {
          const item = itemOf(box);
          if (item) runInBodyScope(() => select(event, item));
        }
        else runInBodyScope(() => cleanSelected(event));
      };
      const onMouseUp = (event: MouseEvent) => {
        const box = boxFrom(event.target);
        if (box) runInBodyScope(() => onBoxMouseup(event, itemOf(box)));
      };
      const onDblClick = (event: MouseEvent) => {
        const box = boxFrom(event.target);
        if (!box) return;
        const isName = !!(event.target as HTMLElement | null)?.classList?.contains('name');
        runInBodyScope(() => onBoxListDblClick(event, itemOf(box), isName, isName ? event.target as HTMLElement : null));
      };
      const onContextMenu = (event: MouseEvent) => {
        const box = boxFrom(event.target);
        if (box) {
          event.stopPropagation();
          runInBodyScope(() => openItemContextMenu(event, itemOf(box)));
        } else runInBodyScope(() => openFileListContextMenu(event));
      };
      let wheelTimer = 0;
      const onWheel = (event: WheelEvent) => {
        if (!event.altKey && !event.ctrlKey) return;
        event.preventDefault();
        event.stopPropagation();
        if (wheelTimer) return;
        wheelTimer = window.setTimeout(() => { wheelTimer = 0; }, 120);
        event.deltaY < 0 ? gridZoomIn(event) : gridZoomOut(event);
      };
      host.addEventListener('mousedown', onMouseDown);
      host.addEventListener('mouseup', onMouseUp);
      host.addEventListener('dblclick', onDblClick);
      host.addEventListener('contextmenu', onContextMenu);
      const container = document.getElementById('box-container');
      container?.addEventListener('wheel', onWheel, { passive: false });
      cleanups.push(() => {
        host.removeEventListener('mousedown', onMouseDown);
        host.removeEventListener('mouseup', onMouseUp);
        host.removeEventListener('dblclick', onDblClick);
        host.removeEventListener('contextmenu', onContextMenu);
        container?.removeEventListener('wheel', onWheel);
        clearTimeout(wheelTimer);
      });
    }
    cleanups.push(installBoxGrid());
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  useLayoutEffect(() => {
    const container = document.getElementById('box-container');
    if (!container) return;
    container.classList.remove('grid-layout', 'justified-layout', 'list-layout', 'hide-scrollbar');
    container.classList.add(layoutName === 'ListLayout' ? 'list-layout'
      : layoutName === 'GridLayout' || layoutName === 'SquareLayout' ? 'grid-layout' : 'justified-layout');
    container.setAttribute('box-size', String(Math.floor(size / 5) * 5));
  }, [layoutName, size]);

  useLayoutEffect(() => {
    const container = document.getElementById('box-container');
    if (!hostEl || !container) return;
    let frame = 0;
    const onScroll = () => {
      lastScrollTop.current = container.scrollTop;
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; measureViewport(); });
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    const observer = new ResizeObserver(measureViewport);
    [container, hostEl, document.getElementById('eagle-sub-folder-host'), document.getElementById('eagle-list-header-host')]
      .forEach((element) => { if (element) observer.observe(element); });
    measureViewport();
    return () => {
      container.removeEventListener('scroll', onScroll);
      observer.disconnect();
      cancelAnimationFrame(frame);
      unregisterGridView();
    };
  }, [hostEl, measureViewport]);

  const geometry = useMemo(() => calculateContinuousLayout(viewport.width ? engine.items : [], {
    width: Math.max(1, viewport.width - (layoutName === 'ListLayout' ? 4 : 0)),
    size, layout: layoutName, showName, showMetas,
  }), [engine.items, engine.layoutVersion, viewport.width, size, layoutName, showName, showMetas]);

  useLayoutEffect(() => {
    const element = listRef.current;
    const container = document.getElementById('box-container');
    if (!element || !container || viewport.width === 0) return;
    const origin = element.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    const old = previous.current;
    registerGridView(element, container, geometry);
    const navigated = applyPendingGridScroll();
    // Preserve the visible item on resize, zoom or a same-view data update. A normal scroll
    // only swaps mounted rectangles: it never writes scrollTop.
    if (!navigated && old && old.viewKey === engine.viewKey && (old.layout !== geometry || old.origin !== origin)) {
      const position = captureGridPosition(old.layout, lastScrollTop.current, old.origin);
      container.scrollTop = restoreGridPosition(geometry, position, origin);
    }
    previous.current = { layout: geometry, origin, viewKey: engine.viewKey };
    measureViewport();
  }, [geometry, engine.viewKey, version, viewport.width, viewport.origin, measureViewport]);

  // Boot can finish before the React host mounts. Recover that one missed reset.
  useEffect(() => {
    if (engine.items.length) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      const items = useItemState.getState().allData;
      if (items?.length && useMiscRawState.getState().isItemBindCalculated) {
        clearInterval(timer);
        (window as any).resetNgGridLayoutData?.(items);
      } else if (++attempts >= 60) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [engine.items.length]);

  const visible = visibleGridRects(geometry, viewport.top - viewport.origin, viewport.height, Math.max(800, viewport.height));
  const grid = (
    <div ref={listRef} className="box-list continuous-box-list"
      data-total-items={engine.items.length}
      style={{ height: geometry.height, width: geometry.width }}>
      {visible.map((rect) => (
        <BoxItem key={rect.id} item={engine.items[rect.index]}
          data-grid-groupkey={1000000} data-grid-index={rect.index}
          style={{ position: 'absolute', left: rect.left, top: rect.top, width: rect.width, height: rect.height,
            '--grid-thumbnail-height': rect.thumbnailHeight + 'px' } as React.CSSProperties} />
      ))}
    </div>
  );
  return hostEl ? createPortal(grid, hostEl) : null;
}
