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
  // F23g：首次布局就绪标志（未就绪时宿主隐藏，见 settle 内的说明与下方 effect）
  const [revealed, setRevealed] = useState(false);
  const revealedRef = useRef(false);

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

  // F23g：首帧就绪前隐藏 #box-list（见 settle 内说明）。宿主是 index.html 里保留的静态壳，
  // 只装网格内容，故直接切它的 visibility 最省事且不影响 v4 的尺寸测量。
  useLayoutEffect(() => {
    const host = document.getElementById('box-list');
    if (host) host.style.visibility = revealed ? '' : 'hidden';
  }, [revealed, hostEl]);

  // v4 React 包装器只同步 children/光标，不驱动测量定位（Renderer.updated 仅走 setState
  // 环）—— 引擎通知后显式 renderItems 触发测量+定位+renderComplete（v3 append 后自动布局
  // 的等价驱动点）。
  // 实机 QA（2026-09-13）：v4 布局管线依赖 ResizeObserver 异步测量，视图切换（文件夹/
  // 智能文件夹/恢复会话）插入全新 children 时，提交期的这次调用会停在「条目已挂载、
  // 观察回调未回」的窗口 → 整网格塌陷在原点（transform 缺失），直到下一次无关重渲染才恢复。
  // 补：rAF 自纠错重试，直至容器内不再有条目停在 v4 的 -9999 占位坐标（或次数耗尽——防死循环）。
  useEffect(() => {
    const grid = gridRef.current;
    if (engine.items.length === 0 || !grid || !grid.renderItems) return;
    try { grid.renderItems(); } catch (err) {}
    let raf = 0;
    let tries = 0;
    let stable = 0;
    // F22：v4 的 onRenderComplete 在本集成下不可靠（实测从不触发）→ 缩略图懒加载
    // （lazyLoadManager.observe）从未被调用：box 无 .show、img src 恒空 → 大量灰块
    // （用户观感「只显示一部分内容」）。定位成功后主动把容器内未加载的 box 交给 LazyLoadManager
    // （它自带 IntersectionObserver，只对进入可视区的触发加载）。
    const observeLazy = () => {
      const lzm = useMiscRawState.getState().lazyLoadManager;
      if (!lzm || typeof lzm.observe !== 'function') return;
      const container = grid.getContainerElement && grid.getContainerElement();
      if (!container) return;
      container.querySelectorAll('.box:not(.show)').forEach((el: HTMLElement) => {
        if ((el as any).__eagleLazyObserved) return;
        (el as any).__eagleLazyObserved = true;
        try { lzm.observe(el); } catch (err) {}
      });
    };
    const settle = () => {
      tries += 1;
      const container = grid.getContainerElement && grid.getContainerElement();
      const boxes: HTMLElement[] = container
        ? (Array.from(container.querySelectorAll('.box[data-box-id]')) as HTMLElement[])
        : [];
      // F23d（实机 QA 2026-09-14）：原判据 `style.indexOf('absolute') !== -1` 会被 v4 给
      // 「已挂载但尚未定位」条目写的占位样式 `position:absolute; top:-9999px; left:-9999px;`
      // 命中（该串同样含 absolute）→ settle 第一帧就自我判定「已定位」而停止重试。
      // F23g（同日用户复测「加载时全都挤在一起」）：还有第二种未布局态 —— v4 测量完成但尚未
      // 布局时，会给**所有**条目写同一个 initialRect（实测 60 个 box 的 style.top/left 全等，
      // 表现为全部叠在同一格）。该态没有 -9999，旧判据同样漏检。两态一起纳入 pending。
      const styles = boxes.map((el) => el.getAttribute('style') || '');
      const hasGhost = styles.some((s) => s.indexOf('-9999') !== -1);
      const stackedPlaceholder =
        boxes.length > 1 &&
        boxes.every((el) => el.style.top === boxes[0].style.top && el.style.left === boxes[0].style.left);
      const pending = hasGhost || stackedPlaceholder;
      if (pending) {
        try { grid.renderItems(); } catch (err) {}
        stable = 0;
      } else {
        stable += 1;
      }
      // F23g：首次布局就绪前把宿主（#box-list）隐起来。v4 从「条目挂载」到「写入定位」之间
      // 会把所有条目渲染在同一个 initialRect 上，肉眼就是「加载时全都挤在一起」；即使自纠错
      // 能在数百毫秒内收敛，那一帧的观感也已经是坏的。就绪后再显形，代价只是一次 visibility
      // 切换（不影响尺寸测量 —— visibility:hidden 仍参与布局）。
      if (!pending && !revealedRef.current) {
        revealedRef.current = true;
        setRevealed(true);
      } else if (pending && tries > 60 && !revealedRef.current) {
        revealedRef.current = true; // 兜底：极端情况下也不能永久隐藏
        setRevealed(true);
      }
      observeLazy();
      if ((pending || stable < 3) && tries < 180) raf = requestAnimationFrame(settle);
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
  // F21：v4 模型下容器高度只覆盖当前页（一页一组），scrollPercentage 是**页内小数**（0~1）。
  // 旧实现走 scrollPercentageTarget（(startCursor+decimal)*page*pitch 的全局定位）——在
  // 一页一组模型里该值恒远大于 scrollHeight，被钳到容器底部 → 切页后视图停在页尾/中间
  // （用户观感「内容错位、像只显示一部分」）。改为按容器高度做页内定位。
  useEffect(() => {
    if (engine.scrollPercentage == null || engine.items.length === 0) return;
    const container = document.getElementById('box-container');
    if (!container || container.scrollHeight < 50) return;
    const decimal = Math.min(Math.max(0, engine.scrollPercentage), 1);
    const target = Math.round(decimal * Math.max(0, container.scrollHeight - container.clientHeight));
    container.scrollTop = target;
    engine.scrollPercentage = null;
  });

  const isListLike = layout === 'GridLayout' || layout === 'SquareLayout' || layout === 'ListLayout';
  const GridComponent: any = isListLike ? MasonryInfiniteGrid : JustifiedInfiniteGrid;
  // F17：v4 ScrollManager 未显式传 scrollContainer 时回退 document.body（本应用
  // body{overflow:hidden}），滚动监听挂到 window → #box-container 的真实滚动永不触发
  // v4 的 _onCheck：游标不推进（列表只显示首页）、容器高度只覆盖已布局组（滚不到末尾）、
  // ig._watcher.getScrollPos() 恒 0（自定义滚动条滑块恒停在 0）。原版 v3 用
  // isOverflowScroll:false 自动绑定滚动父级，v4 需显式指定。
  const scrollHost = typeof document !== 'undefined' ? document.getElementById('box-container') : null;

  // F23c（实机 QA 2026-09-14）：children = 从 startCursor 起的一页（bundle 时代 v3 是
  // 「一组一页」）。切页由 resetNgGridLayoutData(allData, page) → startCursor 变化驱动。
  const startCursor = engine.startCursor;
  const PRELOAD = 1; // 连续滚动页数（F23i 待定：见 onRequestAppend）
  const pageStart = startCursor * PAGE;
  const windowItems = engine.items.slice(pageStart, pageStart + PAGE * PRELOAD);
  const items = windowItems;

  // F23h（用户复测「文件夹内的排列缩略图显示不正常」）：v4 JustifiedGrid 的
  // stretch / isCroppedSize 两个开关都不能直接用 ——
  //   · 都关（默认）：sizeRange 只作「行高代价」，越界代价含常量 max²（每行都付）→ 断行最优解
  //     退化为「最少行数」= 每行塞满 columnRange 上限（默认 8），行高被「填满容器宽度」倒推
  //     （实测 imageSize.height=710 时行高恒 116）→ 缩放不生效。
  //   · 只开 isCroppedSize（F23b 旧解）：行高被钳到 sizeRange ✓，但 `_setStyle` 会把**行内各条
  //     宽度**整体 scale 放大去填满容器 —— 而 .thumbnail 是「aspect-ratio + max-height」自适应
  //     （不裁切），宽度撑大后缩略图并不会跟着变大：实测 4 张 1152×2048 竖图文件夹，box 被撑成
  //     261×160 而缩略图只有 70×124 左对齐 → 稀疏文件夹「缩略图挤在一边、格子巨大」。
  // 正解 = 让 DP 自己挑出「行高落在 sizeRange 内」的断行组合：用 columnRange 把每行条数约束到
  // 「按目标行高与容器宽度反算出的条数」附近。行高因此跟随 imageSize.height；行内宽度不做任何
  // 拉伸（各条 box 宽 = ratio×(行高−标签块) = 缩略图自然宽，天然铺满格子）；条目不足以成满行时
  // 该行自然变高（经典 justified 语义，v4 的 passUnstretchRow 保证末行不参与拉伸代价）。
  const ratios = items
    .map((it: any) => (it && it.width > 0 && it.height > 0 ? it.width / it.height : 1))
    .filter((r: number) => Number.isFinite(r) && r > 0);
  const avgRatio = ratios.length ? ratios.reduce((a: number, b: number) => a + b, 0) / ratios.length : 1;
  const targetHeight = Math.max(60, imageSizeHeight);
  // 注意（v4 setter 语义）：`InfiniteGridGetterSetter` 的 RENDER_PROPERTY setter 用 **`===`**
  // 比较新旧值（src/utils.ts:336），而 React 每次渲染都会新建数组/函数字面量 → 若不缓存身份，
  // 每次重渲染都会把 sizeRange/columnRange 判为「已变更」并触发一次全量重排（v4 排版 →
  // renderComplete → setState → 重渲染 → 再重排 的隐性循环）。故按「影响布局的输入」做身份缓存。
  const minRatio = ratios.length ? Math.min(...ratios) : 0.5;
  // F23h（用户复测「文件夹内的排列缩略图显示不正常」）—— 为什么必须放开/约束每行条数：
  // v4 JustifiedGrid 是经典 justified：行高**只能**由「填满容器宽度」反算
  // （`_getExpectedRowSize` = (容器宽−间隙)/Σratio），sizeRange 本身不钳制行高。而断行 DP
  // 的越界代价是 `(rowSize−min)² + max²` —— **每行都带常量 max²**，于是最优解退化倾向
  // 「最少行数」。两个开关又都不合用：`isCroppedSize` 能钳住行高但会把行内条宽整体 scale
  // 去填满容器，而 .thumbnail 是 aspect-ratio+max-height 自适应不裁切 → 宽度被撑大缩略图
  // 不会跟着变大（实测 4 张 1152×2048 竖图：box 被撑成 261×160、缩略图只有 70×124 左对齐）；
  // `stretch` 同样钳行高且按 stretchRange 拉伸条宽，道理相同。所以走「不拉伸（缩略图恒好铺满
  // 格子，实测差 >1.5px 的条数恒为 0）+ 用 columnRange 把每行条数约束到『该目标行高物理可达
  // 的条数上限』」：上限 = ⌊(容器宽−间隙)/(目标行高 × 页面最小 ratio)⌋ —— 保证竖图多的行也能
  // 凑到目标高度，同时不让 DP 逃到「一堆小图凑一行」。
  // 注：v4 `InfiniteGridGetterSetter` 的 RENDER_PROPERTY setter 用 `===` 比较新旧值，React
  // 每次渲染都新建数组/函数 → 必须做身份缓存，否则每次重渲染都会触发一次全量重排（隐性循环）。
  const layoutPropsRef = useRef<{ key: string; sizeRange: number[]; columnRange: (self: any) => number[] } | null>(null);
  const layoutKey = `${layout}|${targetHeight}|${avgRatio.toFixed(3)}|${minRatio.toFixed(3)}|${items.length}`;
  if (!layoutPropsRef.current || layoutPropsRef.current.key !== layoutKey) {
    const columnRangeFn = (self: any) => {
      const w =
        (self && typeof self.getContainerInlineSize === 'function' && self.getContainerInlineSize()) ||
        (scrollHost ? scrollHost.clientWidth - 24 : 1024);
      const byMin = Math.floor((Math.max(200, w) - 8) / (targetHeight * Math.max(0.2, minRatio)));
      const maxColumn = Math.max(4, Math.min(40, byMin || 8));
      return [1, maxColumn];
    };
    layoutPropsRef.current = {
      key: layoutKey,
      sizeRange: [Math.max(1, targetHeight - 10), targetHeight + 10],
      columnRange: columnRangeFn,
    };
  }
  const gridProps: any = {
    ...(isListLike
      ? { gap: layout === 'ListLayout' ? 0 : 8, align: 'start' }
      : {
          sizeRange: layoutPropsRef.current.sizeRange,
          gap: 8,
          columnRange: layoutPropsRef.current.columnRange,
        }),
    scrollContainer: scrollHost || '#box-container',
  };

  // v4 光标模型：首挂载时 children 必须已在（useFirstRender → setCursors(0,0) 渲染首组），
  // 后续滚动经 onRequestAppend/Prepend 推进光标 —— 数据已在树内，直接 ready() 放行。
  // 注（2026-09-14 QA 实测）：曾试在 append 时 setCursors 扩展游标范围，v4 会渲染后续组的
  // DOM 却只布局首组（无坐标、随后回收），对「一页一组 + 滚动条切页」的 Eagle 分页模型无益，
  // 故保持 no-op 放行；跨页由 resetNgGridLayoutData（滚动条拖动）驱动。

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
          // v4 groupBy 读顶层 child props 的 data-grid-groupkey（组页编码：1000000+页号）。
          // F23c/F23i：children 是「从 startCursor 起的 PRELOAD 页」切片 → 每 PAGE 条切一组，
          // 组 key = 1000000 + startCursor + 页内序号。gridDirectives 的切页/滚动条反查
          // （groupKey - 1000000 === page）依赖该编码。
          data-grid-groupkey={1000000 + startCursor + Math.floor(idx / PAGE)}
        />
      ))}
    </GridComponent>
  );

  return hostEl ? createPortal(grid, hostEl) : null;
}
