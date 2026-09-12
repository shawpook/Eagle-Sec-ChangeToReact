/**
 * b1-9bd：网格服务 —— zoom 族 + 布局尺寸链归位（自 dataMachinery 逐字搬移）。
 *
 * 覆盖：adjustLayoutWidth（列数/步进换算 + egjs relayout）、saveListHeight（150ms 防抖
 * per-view localStorage）、zoomIn/zoomOut（网格分支直算；详情分支的 zoomRatio 梯度仍经
 * scope 解析 getRatioExp/getRatioNonExp/updateZoomRatio——S4 详情竖切归位）、zoomFit。
 *
 * 约定：函数显式收 `s`（body scope），s.* 读写仍走 scope 世界——machinery 的挂载
 * （s.zoomIn = (e) => machineryZoomIn(s, e)）已改为委托本模块，行为零变化；
 * imageSize 对象态的 store 单源化随 S1-be（infinitegrid 交换）一并落地——
 * 对象嵌套写不经 scopeShim 顶层 set 陷阱，先行镜像会造成第三份拷贝。
 */
import { syncBodyFromScope } from '../store/bodyState';
import { syncDetailFromScope } from '../store/detailState';
import { syncInspectorFromScope } from '../store/inspectorState';
import { syncToolbarFromScope } from '../store/toolbarState';

import { detailZoom } from '../core/smoothZoomEngine';

import { getRatioExp, getRatioNonExp } from './viewOpsService';
import { q, qa, cssSet, widthOf, heightOf, addClass, removeClass, setAttr, setScrollTop, scrollTopValue, outerHeightOf, offsetTopOf } from '../utils/domQuery';
import { debounce } from '../utils/func';

import { machinerySmartZoom, machineryUpdateZoomRatio, machineryZoomIn } from './viewOpsService';
import { machineryCheckListItemsLessThanContainer, machineryScrollToCurrentItem } from '../core/itemDomain';
import { autoscrollChannel } from '../global/bus';
import { machineryZoomFitEdge } from './viewOpsService';
import { syncListFromScope } from '../store/listState';
import { syncFolderLock } from '../store/lockState';
import { syncPanelFromScope } from '../store/panelState';
import { syncSidebarFromScope } from '../store/sidebarState';
import { hide } from '../utils/domQuery';
import { resetFilter } from '../core/filterDomain';
import { machineryFindDupclipate } from '../core/itemDomain';

import { getTimeout, scopeSingleton } from '../core/machineryInfra';
import { useFolderState } from '../store/folderState';
import { useListState } from '../store/listState';
import { useBodyState } from '../store/bodyState';
import { writeScopeField } from '../core/scopeFieldBridge';
import { useItemState } from '../store/itemState';
import { useSelectionState } from '../store/selectionState';
import { useMiscRawState } from '../store/miscRawState';
import { useLayoutState } from '../store/layoutState';
let saveListHeightTimeout: any = null;

/* saveListHeight（bundle 33720-33742 逐字；150ms 防抖，per-view localStorage 键逐字） */
export function gridSaveListHeight(height: any): void {
  clearTimeout(saveListHeightTimeout);
  saveListHeightTimeout = setTimeout(function () {
    if (useFolderState.getState().currentFolder) {
      localStorage.setItem("eagle.list.thumbSize." + useFolderState.getState().currentFolder.id, height);
    } else if (useFolderState.getState().currentSmartFolder) {
      localStorage.setItem("eagle.list.thumbSize." + useFolderState.getState().currentSmartFolder.id, height);
    } else if (useMiscRawState.getState().currentTag) {
      localStorage.setItem("eagle.list.thumbSize." + useMiscRawState.getState().currentTag, height);
    } else if (useBodyState.getState().viewMode === 'all') {
      localStorage.setItem("eagle.list.thumbSize.all", height);
    } else if (useBodyState.getState().viewMode === 'unfiled') {
      localStorage.setItem("eagle.list.thumbSize.unfiled", height);
    } else if (useBodyState.getState().viewMode === 'untagged') {
      localStorage.setItem("eagle.list.thumbSize.untagged", height);
    } else if (useBodyState.getState().viewMode === 'trash') {
      localStorage.setItem("eagle.list.thumbSize.trash", height);
    } else if (useBodyState.getState().viewMode === 'random') {
      localStorage.setItem("eagle.list.thumbSize.random", height);
    } else if (useBodyState.getState().viewMode === 'recent') {
      localStorage.setItem("eagle.list.thumbSize.recent", height);
    }
  }, 150);
}

/* adjustLayoutWidth（bundle 33839-33947 逐字；ig._layout._columnLength 经 window 解析，
   scrollToCurrentItem 经 scope 解析） */
export function gridAdjustLayoutWidth(increases: any): void {
  const w = window as any;
  if (!useMiscRawState.getState().isItemBindCalculated) return;

  increases = increases || 0;
  var height;
  writeScopeField('boxContianerWidth', widthOf(q("#box-container")) || useMiscRawState.getState().boxContianerWidth);
  writeScopeField('boxContianerHeight', heightOf(q("#box-container")) || useMiscRawState.getState().boxContianerHeight);
  if (useBodyState.getState().layout === "GridLayout" || useBodyState.getState().layout === "SquareLayout") {
    if (!w.ig._layout._columnLength) return;
    var containerWidth = widthOf(q("#box-container")) || useMiscRawState.getState().boxContianerWidth;
    containerWidth = containerWidth - 16 - 10 - 6;
    var currentColumn = w.ig._layout._columnLength;
    var newColumn = (currentColumn + increases) || 1;
    var newHeight = parseInt(((containerWidth - 10 * (newColumn + 1))) / newColumn as any);
    height = Math.ceil(newHeight / 5) * 5;
    if (height > useMiscRawState.getState().MAX_LIST_WIDTH) height = useMiscRawState.getState().MAX_LIST_WIDTH;
  }
  else {
    let step = 50;
    if (useLayoutState.getState().imageSize.height > 500) {
      step = 100;
    }
    else if (useLayoutState.getState().imageSize.height < 200) {
      step = 25;
    }
    height = parseInt((useLayoutState.getState().imageSize.height + (step * -increases)) / 5 as any) * 5;
  }
  if (height > useMiscRawState.getState().MAX_LIST_WIDTH) height = useMiscRawState.getState().MAX_LIST_WIDTH;
  if (height < 75) height = 75;
  useLayoutState.getState().imageSize.height = parseInt(height);
  syncToolbarFromScope();
  syncBodyFromScope();
  syncDetailFromScope();
  syncInspectorFromScope();
  if (!height) height = useLayoutState.getState().imageSize.height;
  if (Number.isFinite(height) && height > 0) {
    writeScopeField('lastImageHeight', useLayoutState.getState().imageSize.height);
    setAttr("#box-container", "box-size", height);
    var margin = Math.floor((containerWidth % height) / (parseInt(containerWidth / height as any) - 1));
    if (margin === Infinity) margin = 10;
    machineryRelayout(margin);

    machineryScrollToCurrentItem();
  }
}

/* zoomFit（bundle 33949-33985 逐字；changeListHeight/adjustLayoutWidth/smartZoom/
   zoomFitEdge 经 scope 解析） */
export function gridZoomFit(s: any, event: any, noAnimation: any): void {
  const w = window as any;
  event && event.preventDefault && event.preventDefault();
  if (!s.isDetailMode) {
    s.imageSize.height = 150;
    syncToolbarFromScope();
    syncBodyFromScope();
    syncDetailFromScope();
    syncInspectorFromScope();
    machineryChangeListHeight();
    if (s.layout === "GridLayout" || s.layout === "SquareLayout") {
      machineryAdjustLayoutWidth(0);
      gridSaveListHeight(s.imageSize.height);
    }
  } else {
    if (s.VIDEO_TYPES[s.current.ext]) {
      // 如果是視頻格式，撐滿畫面
      var mpvPlayer = q(".detail-wrap mpv-video") as any;
      if (mpvPlayer) {
        mpvPlayer.scaleMode = 'fit';
      }
      else {
        removeClass(".detail-wrap video", "fit");
      }
      return;
    }
    s.zoomFitSize = 0;
    s.lastZoomMode = "fit";
    syncDetailFromScope();
    localStorage["eagle.viewer.lastZoomMode"] = s.lastZoomMode;
    s.imageSize.zoomRatio = 100;
    s.imageSize.zoomRatioExp = getRatioExp(s.imageSize.zoomRatio);

    if (!noAnimation) {
      addClass("#detail-container", "zooming");
      setTimeout(function () {
        removeClass("#detail-container", "zooming");
      }, 300);
    }

    machinerySmartZoom(undefined, true);
  }
}

/* zoomIn（bundle 33883-33898 逐字：非详情 adjustLayoutWidth(-1)+saveListHeight +
   详情 5 步进 ratioExp 梯度（400/200/100/50/25/10/5 封顶 800）+ updateZoomRatio）；
   zoomOut（33899-33914 逐字：对称梯度 + 非详情多一步 checkListItemsLessThanContainer） */
export function gridZoomIn(event: any): void {
  event && event.preventDefault && event.preventDefault();
  if (!useBodyState.getState().isDetailMode) {
    machineryAdjustLayoutWidth(-1);
    gridSaveListHeight(useLayoutState.getState().imageSize.height);
  } else {
    var ratio = Math.ceil(useLayoutState.getState().imageSize.zoomRatio / 5) * 5;
    var ratioExp = getRatioExp(ratio);
    if (ratioExp >= 400) { ratioExp = 800; } else if (ratioExp >= 200) { ratioExp = 400; } else if (ratioExp >= 100) { ratioExp = 200; } else if (ratioExp >= 50) { ratioExp = 100; } else if (ratioExp >= 25) { ratioExp = 50; } else if (ratioExp >= 10) { ratioExp = 25; } else if (ratioExp >= 5) { ratioExp = 10; } else { ratioExp = 5; }
    if (ratioExp > 800) ratioExp = 800;
    useLayoutState.getState().imageSize.zoomRatio = getRatioNonExp(ratioExp);
    useLayoutState.getState().imageSize.zoomRatioExp = getRatioExp(useLayoutState.getState().imageSize.zoomRatio);
    machineryUpdateZoomRatio(undefined, undefined, undefined, true);
  }
}

export function gridZoomOut(event: any): void {
  event && event.preventDefault && event.preventDefault();
  if (!useBodyState.getState().isDetailMode) {
    machineryAdjustLayoutWidth(1);
    gridSaveListHeight(useLayoutState.getState().imageSize.height);
    machineryCheckListItemsLessThanContainer();
  } else {
    var ratio = Math.floor(useLayoutState.getState().imageSize.zoomRatio / 5) * 5;
    var ratioExp = getRatioExp(ratio);
    if (ratioExp <= 10) { ratioExp = 5; } else if (ratioExp <= 25) { ratioExp = 10; } else if (ratioExp <= 50) { ratioExp = 25; } else if (ratioExp <= 100) { ratioExp = 50; } else if (ratioExp <= 200) { ratioExp = 100; } else if (ratioExp <= 400) { ratioExp = 200; } else if (ratioExp <= 800) { ratioExp = 400; }
    useLayoutState.getState().imageSize.zoomRatio = getRatioNonExp(ratioExp);
    useLayoutState.getState().imageSize.zoomRatioExp = getRatioExp(useLayoutState.getState().imageSize.zoomRatio);
    machineryUpdateZoomRatio(undefined, undefined, undefined, true);
  }
}

/* React 直调便捷面（无 scope 参数版本）——组件侧（如 BoxList 滚轮）不再绕 callFn。 */
export function zoomIn(event: any): void {
  gridZoomIn(event);
}

export function zoomOut(event: any): void {
  gridZoomOut(event);
}

/* switchLayout（bundle 33790-33846 逐字；body class 四分支 + relayout/offsetScrollbar/
   initMenu 仍经 scope 解析；forceLayout 参数原实现未消费，逐字保留签名） */
export function gridSwitchLayout(s: any, layout: any, forceLayout: any): void {
  const w = window as any;
  var allLayout = "grid-layout justified-layout list-layout";
  switch (layout) {
    case "GridLayout":
      window.requestAnimationFrame(() => {
        removeClass("body", "is-square-layout is-list-layout");
      });
      s.layout = "GridLayout";
      removeClass("#box-container", allLayout); addClass("#box-container", "grid-layout");
      machineryRelayout();
      // $scope.adjustLayoutWidth(0);
      w.electronLog && w.electronLog.info("[app] Layout: Waterfall");
      break;
    case "SquareLayout":
      window.requestAnimationFrame(() => {
        removeClass("body", "is-square-layout is-list-layout");
        addClass("body", "is-square-layout");
      });
      s.layout = "SquareLayout";
      removeClass("#box-container", allLayout); addClass("#box-container", "grid-layout");
      machineryRelayout();
      // $scope.adjustLayoutWidth(0);
      w.electronLog && w.electronLog.info("[app] Layout: Grid");
      break;
    case "ListLayout":
      window.requestAnimationFrame(() => {
        removeClass("body", "is-square-layout is-list-layout");
        addClass("body", "is-list-layout");
      });
      s.layout = "ListLayout";
      removeClass("#box-container", allLayout); addClass("#box-container", "list-layout");
      machineryRelayout();
      w.electronLog && w.electronLog.info("[app] Layout: List");
      break;
    default:
      window.requestAnimationFrame(() => {
        removeClass("body", "is-square-layout is-list-layout");
      });
      s.layout = "JustifiedLayout";
      removeClass("#box-container", allLayout); addClass("#box-container", "justified-layout");
      machineryRelayout();
      w.electronLog && w.electronLog.info("[app] Layout: Justified");
  }

  getOffsetScrollbarFn(s)(30);
  // b1-9d：initMenu 为 bundle 顶层函数（$rootScope.initMenu）——shim 世界无此成员，守卫
  if (s.$root && typeof s.$root.initMenu === 'function') s.$root.initMenu();
}

/* ── b1-9be：@egjs/react-infinitegrid 交换的 window.ig facade 契约（交换批施工依据）──
   现存 vanilla InfiniteGrid 实例（libraryDomain 创建 `new w.eg.InfiniteGrid("#box-container
   .box-list")`）被以下方法面消费（全树普查）：
   - remove ×7 / getItems ×6 / clear ×5 / trigger ×2（'prepend' 等）/ layout ×2 /
     getGroupKeys ×1 / _layout._columnLength ×2（gridAdjustLayoutWidth 列数换算）
   交换批保留 window.ig 为 facade 对象：方法子集委托 React InfiniteGrid ref，
   machinery/scope 世界调用面零改动；React 侧条目渲染改由 React 组件承载。
*/


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
/* updateSliderPosition（bundle 33689-33705：函数体全被注释——no-op 原样保留注释） */
export function machineryUpdateSliderPosition(): void {
  // var $breadcrumbs = $(".content-panel .toolbar .breadcrumbs ul");
  // var $right = $(".content-panel .toolbar .right:visible");
  // var $slider = $(".sliders-bar:visible");

  // if ($slider.length === 0 || $right.length === 0 || $breadcrumbs.length === 0) return;

  // var x1 = $slider.offset().left + $slider.width();
  // var x2 = $right.offset().left;

  // var x3 = $slider.offset().left;
  // var x4 = $breadcrumbs.offset().left + $breadcrumbs.width();

  // if ( x1 + 5 > x2 || x4 + 5 > x3 ) {
  //     $slider.addClass("response");
  // }
  // else {
  //     $slider.removeClass("response");
  // }
}


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
/* ScrollbarSaver（bundle 46754-46812 逐字；隐式全局赋值 → if-absent 接装 window） */
export function buildScrollbarSaver(): any {
  const w = window as any;
  const ScrollbarSaver: any = {
    positionMapping: {},
    getId: function () {
      var id;
      if (useFolderState.getState().currentFolder) { id = useFolderState.getState().currentFolder.id; }
      else if (useFolderState.getState().currentSmartFolder) { id = useFolderState.getState().currentSmartFolder.id; }
      else if (useBodyState.getState().viewMode == "all") { id = "all"; }
      else if (useBodyState.getState().viewMode == "unfiled") { id = "unfiled"; }
      else if (useBodyState.getState().viewMode == "untagged") { id = "untagged"; }
      else if (useBodyState.getState().viewMode == "trash") { id = "trash"; }
      else if (useBodyState.getState().viewMode == "random") { id = "random"; }
      else if (useBodyState.getState().viewMode == "recent") { id = "recent"; }
      return id;
    },
    saveScrollPosition: function () {
      if (w.eagle.filter.filterBadge > 0) return;
      if (useListState.getState().keyword) return;
      if (qa(".box").length + qa(".sub-folder").length === 0) return;
      var scrollTop = scrollTopValue("#box-container");
      var obj: any = {};
      var id = ScrollbarSaver.getId();

      if (scrollTop === 0) {
        delete ScrollbarSaver.positionMapping[id];
        return;
      }

      var startCursor = 0;
      var offsetTop = (q(".box-list")?.offsetTop) || 0;
      var scrollOffset;
      if (qa(".sub-folder").length > 0 && useFolderState.getState().startCursor === 0) {
        scrollOffset = scrollTopValue("#box-container");
      }
      else {
        if (qa(".box").length === 0) return;
        scrollOffset = Math.abs(offsetTopOf(q(".box")) - 44) + offsetTop;
      }
      var its = w.ig.getItems();
      if (its[0]) { startCursor = its[0].groupKey - 1000000; }

      if (!id) return;

      if (startCursor) { obj.cursor = startCursor; }
      obj.offset = scrollOffset;
      ScrollbarSaver.positionMapping[id] = obj;
    },
    restoreScrollPosition: function () {
      if (useBodyState.getState().viewMode === 'random') return;
      if (w.eagle.filter.filterBadge > 0) return;
      var id = ScrollbarSaver.getId();

      if (!id) return;

      var obj = ScrollbarSaver.positionMapping[id];
      var $boxContainer = q("#box-container");
      if (obj) {
        writeScopeField('startCursor', obj.cursor || 0);
        var offset = obj.offset || 0;
        var times = [20, 300];
        for (var i = times[0]; i < times[1]; i += 20) {
          setTimeout(function () {
            if (ScrollbarSaver.getId() !== id || ($boxContainer?.scrollTop || 0) !== offset) {
              if ($boxContainer) $boxContainer.scrollTop = offset;
            }
          }, i);
        }
      }
      else {
        writeScopeField('startCursor', 0);
      }
    }
  };
  return ScrollbarSaver;
}

let changeListHeightTimeout: any = null;

/* b1-9bd：adjustLayoutWidth 实现体归位 services/gridService.ts */
export function machineryAdjustLayoutWidth(increases: any): void {
  gridAdjustLayoutWidth(increases);
}

export function machineryChangeListHeight(height: any): void {
  const w = window as any;
  if (!height) height = useLayoutState.getState().imageSize.height;
  if (Number.isFinite(height) && height > 0) {

    height = parseInt(height / 5 as any) * 5;

    writeScopeField('lastImageHeight', useLayoutState.getState().imageSize.height);

    clearTimeout(changeListHeightTimeout);
    changeListHeightTimeout = setTimeout(function () {
      if (useFolderState.getState().currentFolder) {
        w.localStorage.setItem("eagle.list.thumbSize." + useFolderState.getState().currentFolder.id, height as any);
      } else if (useFolderState.getState().currentSmartFolder) {
        w.localStorage.setItem("eagle.list.thumbSize." + useFolderState.getState().currentSmartFolder.id, height as any);
      } else if (useMiscRawState.getState().currentTag) {
        w.localStorage.setItem("eagle.list.thumbSize." + useMiscRawState.getState().currentTag, height as any);
      } else if (useBodyState.getState().viewMode === 'all') {
        w.localStorage.setItem("eagle.list.thumbSize.all", height as any);
      } else if (useBodyState.getState().viewMode === 'unfiled') {
        w.localStorage.setItem("eagle.list.thumbSize.unfiled", height as any);
      } else if (useBodyState.getState().viewMode === 'untagged') {
        w.localStorage.setItem("eagle.list.thumbSize.untagged", height as any);
      } else if (useBodyState.getState().viewMode === 'trash') {
        w.localStorage.setItem("eagle.list.thumbSize.trash", height as any);
      } else if (useBodyState.getState().viewMode === 'random') {
        w.localStorage.setItem("eagle.list.thumbSize.random", height as any);
      } else if (useBodyState.getState().viewMode === 'recent') {
        w.localStorage.setItem("eagle.list.thumbSize.recent", height as any);
      }
    }, 500);

    setAttr("#box-container", "box-size", height as any);
    machineryRelayout();

    machineryScrollToCurrentItem();
  }
}

/* currentIndex（bundle 28993-28997 逐字：selected[0] 在 allData 的位次 +1） */
export function machineryCurrentIndex(): any {
  if (!useItemState.getState().allData) return undefined;
  return useItemState.getState().allData.indexOf(useSelectionState.getState().selected[0]) + 1;
}

/* getArroundBox（bundle 35091-35097 逐字，controller 闭包） */
export function machineryGetArroundBox(index: any): any {
  var arroundStart = (index - 20 >= 0) ? index - 20 : 0;
  var arroundEnd = (index + 20 > useItemState.getState().allData.length) ? useItemState.getState().allData.length : index + 20;
  var $arround = qa(".box").slice(arroundStart, arroundEnd);
  return $arround;
}

export function machineryGotoBottom(): void {
  const w = window as any;
  if (useItemState.getState().allData.length < useMiscRawState.getState().options.page) {
    var offset = (q("#box-container") as HTMLElement | null)?.scrollHeight;
    setScrollTop("#box-container", offset as any);
  }
  else {
    var endCursor = Math.ceil(useItemState.getState().allData.length / useMiscRawState.getState().options.page) - 1 || 0;
    w.resetNgGridLayoutData(useItemState.getState().allData, endCursor);
    var times = [100, 400];
    for (var i = times[0]; i < times[1]; i += 100) {
      writeScopeField('gotoBottomTimeout', setTimeout(function () { setScrollTop("#box-container", 1000000); }, i));
    }
  }
}

export function machineryGotoTop(): void {
  const w = window as any;
  if (useItemState.getState().allData.length < useMiscRawState.getState().options.page) {
    setScrollTop("#box-container", 0);
  }
  else {
    clearTimeout(useMiscRawState.getState().gotoBottomTimeout);
    w.resetNgGridLayoutData(useItemState.getState().allData, 0);
    setScrollTop("#box-container", 0);
  }
}

export function machineryOffsetScrollbar(): any {
  const w = window as any;
  return debounce(function offsetScrollbar(delay: any, forceScroll: any) {
    machineryOffsetScrollbarImm(delay, forceScroll);
  }, 100, true);
}

export function machineryOffsetScrollbarImm(delay: any, forceScroll: any): void {
  setTimeout(function () {
    var container = q("#box-container") as HTMLElement | null;
    if (useSelectionState.getState().selected.length > 0) {
      var $current = qa(".box.selected").slice(-1)[0] as HTMLElement | undefined;
      if (container && $current) {
        var offsetTop = container.clientHeight / 2 - $current.offsetHeight / 2;
        var delta = $current.getBoundingClientRect().top - container.getBoundingClientRect().top;
        container.scrollTop = container.scrollTop + delta - offsetTop;
      }
    }
    else {
      // Note: 這段程式馬主要用來避免因為列表縮放，
      // Container 的 scrollTop 超過最後一個 box 的位置，造成畫面變成空白的
      // 判斷方式：找到最後一個 box 並與 container 進行高度比較
      var $lastBox = qa(".box").slice(-1)[0] as HTMLElement | undefined;
      if ($lastBox) {
        var lastBoxY: any = $lastBox.style.transform.split(',')[1];
        lastBoxY = parseInt(lastBoxY);
        if (container && container.scrollTop > lastBoxY) {
          var delta2 = $lastBox.getBoundingClientRect().top - container.getBoundingClientRect().top;
          container.scrollTop = container.scrollTop + delta2 - container.clientHeight;
        }
      }
    }
  }, delay || 1);
  machineryUpdateContainerHieght();
}

export function machineryRelayout(margin: any): void {
  const w = window as any;
  if (!useMiscRawState.getState().isItemBindCalculated) return;
  var $container = q("#box-container");
  var currentImageSize = useLayoutState.getState().imageSize.height;
  setAttr("#box-container", "box-size", Math.floor(currentImageSize / 5) * 5);
  const ig = w.ig;
  if (!ig) return;
  if (useBodyState.getState().layout === "JustifiedLayout") {
    var cw = widthOf($container);
    ig.setLayout('JustifiedLayout', {
      minSize: currentImageSize * 1 - 10,
      maxSize: currentImageSize * 1 + 10,
      margin: 8,
    });
    ig._renderer.updateSize(ig.getItems(false));
    ig.layout(true);
    ig._watcher._onCheck();
  }
  else if (useBodyState.getState().layout === "ListLayout") {
    ig.setLayout('GridLayout', {
      margin: 0,
      align: "left",
    });
    ig._renderer.updateSize(ig.getItems(false));
    ig.layout(true);
    ig._watcher._onCheck();
  }
  else {
    ig.setLayout('GridLayout', {
      margin: Math.max(margin, 8) || 8,
      align: "left",
    });
    ig._renderer.updateSize(ig.getItems(false));
    ig.layout(true);
    ig._watcher._onCheck();
  }
  ig._updateContainerHeight();
}

export function machineryRememberScrollTops(item: any): void {
  const w = window as any;
  if (useBodyState.getState().isInlineMode) return;
  if (useMiscRawState.getState().lastZoomMode === "edge") return;
  if (item && item.id) {
    useItemState.getState().lastItemStates[item.id] = {
      data: detailZoom()?.getChangedData()
    }
  }
}

export function machinerySaveListHeight(height: any): void {
  gridSaveListHeight(height);
}

export function machineryScrollbarTo(element: any, to: any, duration: any): void {
  var start = element.scrollTop,
    change = to - start,
    currentTime = 0,
    increment = 20;

  var animateScroll = function () {
    currentTime += increment;
    var val = (Math as any).easeInOutQuad(currentTime, start, change, duration);
    element.scrollTop = val;
    if (currentTime < duration) {
      setTimeout(animateScroll, increment);
    }
  };
  animateScroll();
}

export function machinerySwitchLayout(s: any, layout: any, forceLayout: any): void {
  gridSwitchLayout(s, layout, forceLayout);
}

/* updateContainerHieght（bundle 34078-34119 逐字；typo 逐字保留） */
export function machineryUpdateContainerHieght(hasAnimation: any, delay: any = 1): void {
  const w = window as any;
  let duration = 170;
  if (!hasAnimation) duration = 1;
  setTimeout(() => {
    if (w.eagle.filter.isOpen) {
      var $filterBar = q("#filter-toolbar");
      var height = outerHeightOf($filterBar);
      cssSet("#box-container", {
        "padding-bottom": height,
        "height": `calc(100% - ${48 + height}px)`
      });
      cssSet("#box-container-scrollbar", {
        "top": 48 + height,
      });
      cssSet("#box-container", {
        "margin-top": height,
      });
    }
    else {
      cssSet("#box-container", {
        "padding-bottom": 0,
        "height": `calc(100% - 48px)`
      });
      cssSet("#box-container-scrollbar", {
        "top": 48,
      });
      cssSet("#box-container", {
        "margin-top": 0,
      });
    }
  }, delay);
}

/* updateListHeight（bundle 33712-33719 逐字；50ms 防抖） */
export function machineryUpdateListHeight(height: any): void {
  const w = window as any;
  clearTimeout(updateListHeightTimeout);
  updateListHeightTimeout = setTimeout(function () {
    setAttr("#box-container", "box-size", height);
  }, 50);
}

/* updateListSlider（bundle 31350-31352：**函数体为空——no-op 原样**） */
export function machineryUpdateListSlider(size: any): void {

}

let updateListHeightTimeout: any = null;


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
export function getOffsetScrollbarFn(s: any): any { return scopeSingleton(s, 'offsetScrollbar', () => machineryOffsetScrollbar()); }

export function machineryAutoScroll(index: any): void {
  const $timeout = getTimeout();
  $timeout(function () {
    autoscrollChannel.emit(index);
  }, 50);
}

export function machineryResetPage(s: any): void {
  const w = window as any;

  // Note: 切换文件夹时，强制触发 inspector 输入框先进行 change
  // b1-9ba：RESET_PAGE 广播全树无接收者（原接收者随 bundle 摘除退役）——广播体移除，
  // 本函数其余状态复位语义不变。
  (document.activeElement as any)?.blur?.();
  s.listDone = false;
  setTimeout(() => { w.ig.clear(); }, 40);
  s.isOpenWebpagePanel = false;
  s.currentTag = undefined;
  syncToolbarFromScope();
  s.startCursor = 0;
  s.currentFolder = undefined;
  syncPanelFromScope();
  syncFolderLock();
  syncListFromScope();
  w.eagle.inspector.reset();
  s.currentFolderChildren = undefined;
  s.currentSmartFolder = undefined;
  syncPanelFromScope();
  syncListFromScope();
  s.$root.selectedFoldersMappings = {};
  s.$root.selectedFolders = [];
  syncListFromScope();
  s.selectedFolderMappings = {};
  syncListFromScope();
  s.$root.selectedSmartFoldersMappings = {};
  s.$root.selectedSmartFolders = [];
  s.currentId = undefined;
  syncSidebarFromScope();
  s.layout = localStorage.getItem(`eagle.list.layout.${s.rootDir}`) || localStorage.getItem("eagle.list.layout") || "JustifiedLayout";

  if (!w.eagle.filter.isLock) {
    resetFilter();
    s.keyword = undefined;
  }
  hide("#image-drop-area");

  if (s.duplicateTarget) {
    s.duplicateTarget = undefined;
    machineryFindDupclipate(undefined);
  }
}

export function machineryToggleAll(s: any, $event: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  if ($event) {
    $event.preventDefault();
    $event.stopPropagation();
  }
  if (s.isHideSidebar) {
    w.eagle.inspector.isHideInspector = s.isHideSidebar = false;
    syncPanelFromScope();
  } else {
    w.eagle.inspector.isHideInspector = s.isHideSidebar = true;
    syncPanelFromScope();
  }
  $timeout(function () {
    s.lastItemStates = {};
    window.dispatchEvent(new Event("orientationchange"));
    s.boxContianerWidth = widthOf(q("#box-container")) || s.boxContianerWidth;
    s.boxContianerHeight = heightOf(q("#box-container")) || s.boxContianerHeight;
    machineryRelayout();
    getOffsetScrollbarFn(s)(30);
    if (s.isDetailMode) {
      s.$root.currentFocus = "content";
    }
    if (s.isDetailMode && s.lastZoomMode === "edge") {
      machineryZoomFitEdge(w.event);
    }
    // if ($scope.layout === "GridLayout" || $scope.layout === "SquareLayout") {
    //     var currentColumn = ig._layout._columnLength;
    //     var currentWidth = $scope.imageSize.height;
    //     var targetColumn = Math.floor($scope.boxContianerWidth / currentWidth);
    //     $scope.adjustLayoutWidth(targetColumn - currentColumn);
    // }
  }, 100);
  w.localStorage.setItem("isHideSidebar", s.isHideSidebar);
  if (s.isHideSidebar) { w.electronLog && w.electronLog.info("[app] Sidebar: OFF"); }
  else { w.electronLog && w.electronLog.info("[app] Sidebar: ON"); }
  if (w.eagle.inspector.isHideInspector) { w.electronLog && w.electronLog.info("[app] Sidebar: OFF"); }
  else { w.electronLog && w.electronLog.info("[app] Sidebar: ON"); }
}
