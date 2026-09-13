import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MasonryInfiniteGrid, JustifiedInfiniteGrid } from '@egjs/react-infinitegrid';
// b1-9bz-B：callScope 字符串派发退役——改为落点导出直 import（表项本就是同对象指针）
import { onBoxListDblClick, onBoxMouseup, select } from '../../services/selectionService';
import { openItemContextMenu } from '../../services/itemMenuService';
import { openFileListContextMenu } from '../../services/miscMenuService';
import {
  installBoxGrid,
  subscribeEngine,
  getEngineState,
  registerGridRef,
  scrollPercentageTarget,
} from './boxGridEngine';
import { BoxItem } from './boxItem';
import { zoomIn as gridZoomIn, zoomOut as gridZoomOut } from '../../services/gridService';
import { runInBodyScope } from '../../core/appCore';
import { cleanSelected } from '../../services/batchOpsService';
import { useItemState } from '../../store/itemState';
import { useBodyState } from '../../store/bodyState';
import { useFolderState } from '../../store/folderState';
import { useLayoutState } from '../../store/layoutState';
import { useMiscRawState } from '../../store/miscRawState';
/**
 * b1-9be2：#box-list 接管 —— @egjs/react-infinitegrid v4 renderer。
 *
 * 布局映射（bundle:66592-66638 语义）：
 *  - GridLayout/SquareLayout（瀑布流）→ MasonryInfiniteGrid（v3 GridLayout = 最短列 +
 *    统一列宽重缩放，Masonry 同型）gap 8
 *  - ListLayout → MasonryInfiniteGrid gap 0（.list-layout .box width:100% CSS 行布局）
 *  - 默认（谷歌流）→ JustifiedInfiniteGrid sizeRange imageSize±10（v3 JustifiedLayout
 *    minSize/maxSize 逐字换算）/ gap 8
 *
 * 虚拟化 = 全量 children + v4 visible-group 渲染；分组键 = 1000000 + floor(idx/60)
 * （v3 组页编码逐字保留 —— facade.getGroupKeys/getItems().groupKey 消费面依赖）。
 * 容器契约：portal 进静态 #box-list 壳（index.html 保留元素、去 class —— v4 wrapper
 * 承接 .box-list 规则），#box-container 为滚动容器（v4 自动探测）。
 * 网格交互层（b1-9o/au：mousedown 选中 / mouseup / 双击 / 右键 / ctrl+wheel 缩放）原样保留。
 */

const PAGE = 60;

export function BoxList() {
  const [, force] = useState(0);
  const gridRef = useRef<any>(null);
  const [hostEl, setHostEl] = useState<HTMLElement | null>(null);

  const unsubscribe = useRef<(() => void) | null>(null);
  if (!unsubscribe.current) {
    unsubscribe.current = subscribeEngine(() => force((v) => v + 1));
  }
  useEffect(() => () => { unsubscribe.current && unsubscribe.current(); }, []);

  useEffect(() => {
    setHostEl(document.getElementById('box-list'));
    const cleanups: Array<() => void> = [];
    const host = document.getElementById('box-list');

    if (host) {
      const onMouseDown = (e: MouseEvent) => {
        const boxEl = (e.target as HTMLElement | null)?.closest?.('.box') as HTMLElement | null;
        if (boxEl) {
          runInBodyScope(() => {
            const id = boxEl.getAttribute('data-box-id');
            const item = id && useItemState.getState().itemMappings ? useItemState.getState().itemMappings[id] : null;
            if (item) select(e, item);
          });
          return;
        }
        runInBodyScope(() => cleanSelected(e));
      };

      const boxFrom = (target: EventTarget | null) =>
        (target as HTMLElement | null)?.closest?.('.box') as HTMLElement | null;
      const itemOf = (boxEl: HTMLElement | null) => {
                const id = boxEl?.getAttribute('data-box-id');
        return id && useItemState.getState().itemMappings ? useItemState.getState().itemMappings[id] : null;
      };
      // b1-9bz-B：原 callScope 字符串路由 → 落点导出直调（表项本就是这些导出的指针，
      // 同对象调用，零行为变化）；scopeApply 包裹保留原 ng-click digest 语义。
      const callFn = (fn: (...a: any[]) => any, ...args: any[]) => {
        runInBodyScope(() => fn(...args));
      };

      const onMouseUp = (e: MouseEvent) => {
        const boxEl = boxFrom(e.target);
        if (!boxEl) return;
        callFn(onBoxMouseup, e, itemOf(boxEl));
      };
      const onDblClick = (e: MouseEvent) => {
        const boxEl = boxFrom(e.target);
        if (!boxEl) return;
        const isName = !!(e.target as HTMLElement | null)?.classList?.contains('name');
        callFn(onBoxListDblClick, e, itemOf(boxEl), isName, isName ? (e.target as HTMLElement) : null);
      };
      const onContextMenu = (e: MouseEvent) => {
        const boxEl = boxFrom(e.target);
        if (boxEl) {
          e.stopPropagation();
          callFn(openItemContextMenu, e, itemOf(boxEl));
          return;
        }
        callFn(openFileListContextMenu, e);
      };

      let wheelLocked = false;
      const onWheel = (e: WheelEvent) => {
        if (!e.altKey && !e.ctrlKey) return;
        e.preventDefault();
        e.stopPropagation();
        if (wheelLocked) return;
        wheelLocked = true;
        window.setTimeout(() => { wheelLocked = false; }, 120);
        e.deltaY < 0 ? gridZoomIn(e) : gridZoomOut(e);
      };

      host.addEventListener('mousedown', onMouseDown);
      host.addEventListener('mouseup', onMouseUp);
      host.addEventListener('dblclick', onDblClick);
      host.addEventListener('contextmenu', onContextMenu);
      const boxContainer = document.getElementById('box-container');
      boxContainer?.addEventListener('wheel', onWheel, { passive: false });
      cleanups.push(() => {
        host.removeEventListener('mousedown', onMouseDown);
        host.removeEventListener('mouseup', onMouseUp);
        host.removeEventListener('dblclick', onDblClick);
        host.removeEventListener('contextmenu', onContextMenu);
        boxContainer?.removeEventListener('wheel', onWheel);
      });
    }

    cleanups.push(installBoxGrid());

    return () => cleanups.forEach((fn) => fn());
  }, []);

  const engine = getEngineState();
  const layout: string = (useBodyState.getState().layout) || '';
  const imageSizeHeight = (useLayoutState.getState().imageSize && useLayoutState.getState().imageSize.height) || 200;

  useLayoutEffect(() => {
    registerGridRef(gridRef.current);
  });

  // v4 React 包装器只同步 children/光标，不驱动测量定位（Renderer.updated 仅走 setState
  // 环）—— 引擎通知后显式 renderItems 触发测量+定位+renderComplete（v3 append 后自动布局
  // 的等价驱动点）。
  // 实机 QA（2026-09-13）：v4 布局管线依赖 ResizeObserver 异步测量，视图切换（文件夹/
  // 智能文件夹/恢复会话）插入全新 children 时，提交期的这次调用会停在「条目已挂载、
  // 观察回调未回」的窗口 → 整网格塌陷在原点（transform 缺失），直到下一次无关重渲染才恢复。
  // 补：rAF 自纠错重试，直至首个条目被 v4 写入 inline 定位（或次数耗尽——防死循环）。
  useEffect(() => {
    const grid = gridRef.current;
    if (engine.items.length === 0 || !grid || !grid.renderItems) return;
    try { grid.renderItems(); } catch (err) {}
    let raf = 0;
    let tries = 0;
    const settle = () => {
      tries += 1;
      const container = grid.getContainerElement && grid.getContainerElement();
      const first = container && (container.querySelector('.box[data-box-id]') as HTMLElement | null);
      const positioned = !!first && (first.getAttribute('style') || '').indexOf('absolute') !== -1;
      if (!positioned) {
        try { grid.renderItems(); } catch (err) {}
        if (tries < 30) raf = requestAnimationFrame(settle);
      }
    };
    raf = requestAnimationFrame(settle);
    return () => cancelAnimationFrame(raf);
  });

  // 启动竞态兜底（实机 QA 2026-09-13）：boot 时 rebind 与 UI 挂载竞速，若引擎从未收到
  // reset（rebindRefresh 早退或 muteMode 路径），allData 已就绪而 engine.items 恒空 →
  // 网格永久空白且无后续事件可自愈。挂载后短窗轮询该形态并补发一次 reset
  // （allData 即当前视图计算列表，语义与 rebindRefresh 尾部的 reset 一致）。
  useEffect(() => {
    if (engine.items.length > 0) return;
    const w = window as any;
    if (typeof w.resetNgGridLayoutData !== 'function') return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      const allData = useItemState.getState().allData;
      if (allData && allData.length > 0 && useMiscRawState.getState().isItemBindCalculated) {
        clearInterval(timer);
        w.resetNgGridLayoutData(allData, useFolderState.getState().startCursor || 0);
      } else if (tries > 60) {
        clearInterval(timer);
      }
    }, 250);
    return () => clearInterval(timer);
  });

  // 容器布局类 + box-size 属性反射（bundle:66610-66638 / 6859 逐字语义）
  useEffect(() => {
    const container = document.getElementById('box-container');
    if (!container) return;
    const all = 'grid-layout justified-layout list-layout';
    container.classList.remove(...all.split(' '));
    if (layout === 'GridLayout' || layout === 'SquareLayout') container.classList.add('grid-layout');
    else if (layout === 'ListLayout') container.classList.add('list-layout');
    else container.classList.add('justified-layout');
    if (useLayoutState.getState().imageSize && useLayoutState.getState().imageSize.height) {
      container.setAttribute('box-size', String(useLayoutState.getState().imageSize.height));
    }
  }, [layout, imageSizeHeight]);

  // 滚动恢复（v3 applyScrollPercentage / pendingScrollPercentage 语义；渲染未就绪则挂起重试）
  useEffect(() => {
    if (engine.scrollPercentage == null || engine.items.length === 0) return;
    const container = document.getElementById('box-container');
    if (!container || container.scrollHeight < 50) return;
    const target = scrollPercentageTarget(engine.scrollPercentage, engine.items.length);
    if (target == null) return;
    container.scrollTop = target;
    engine.scrollPercentage = null;
  });

  const isListLike = layout === 'GridLayout' || layout === 'SquareLayout' || layout === 'ListLayout';
  const GridComponent: any = isListLike ? MasonryInfiniteGrid : JustifiedInfiniteGrid;
  const gridProps: any = isListLike
    ? { gap: layout === 'ListLayout' ? 0 : 8, align: 'start' }
    : { sizeRange: [Math.max(1, imageSizeHeight - 10), imageSizeHeight + 10], gap: 8 };

  const items = engine.items;
  const startCursor = engine.startCursor;

  // v4 光标模型：首挂载时 children 必须已在（useFirstRender → setCursors(0,0) 渲染首组），
  // 后续滚动经 onRequestAppend/Prepend 推进光标 —— 数据已在树内，直接 ready() 放行。
  const grid = items.length === 0 ? null : (
    <GridComponent
      ref={gridRef}
      tag="div"
      className="box-list"
      useFirstRender={true}
      {...gridProps}
      onRequestAppend={(e: any) => { e.ready && e.ready(); }}
      onRequestPrepend={(e: any) => { e.ready && e.ready(); }}
      onRenderComplete={() => {
        if (!useMiscRawState.getState().lazyLoadManager) return;
        const lzm = useMiscRawState.getState().lazyLoadManager;
        const container = gridRef.current && gridRef.current.getContainerElement && gridRef.current.getContainerElement();
        if (!container) return;
        container.querySelectorAll('.box:not(.show)').forEach((el: HTMLElement) => {
          try { lzm.observe(el); } catch (err) {}
        });
      }}
    >
      {items.map((item, idx) => (
        <BoxItem
          key={item.id}
          item={item}
          // v4 groupBy 读顶层 child props 的 data-grid-groupkey（组页编码：1000000+页号）
          data-grid-groupkey={1000000 + startCursor + Math.floor(idx / PAGE)}
        />
      ))}
    </GridComponent>
  );

  return hostEl ? createPortal(grid, hostEl) : null;
}
