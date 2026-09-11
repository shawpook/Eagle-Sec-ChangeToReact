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
import { getBodyScope } from '../core/appCore';
import { detailZoom } from '../core/smoothZoomEngine';
import { getOffsetScrollbarFn } from '../core/dataMachinery';
import { getRatioExp, getRatioNonExp } from './viewOpsService';
import { q, qa, cssSet, widthOf, heightOf, addClass, removeClass, setAttr, setScrollTop, scrollTopValue, outerHeightOf, offsetTopOf } from '../utils/domQuery';
import { debounce } from '../utils/func';

import { machinerySmartZoom, machineryUpdateZoomRatio, machineryZoomIn } from './viewOpsService';
import { machineryCheckListItemsLessThanContainer, machineryScrollToCurrentItem } from '../core/itemDomain';
let saveListHeightTimeout: any = null;

/* saveListHeight（bundle 33720-33742 逐字；150ms 防抖，per-view localStorage 键逐字） */
export function gridSaveListHeight(s: any, height: any): void {
  clearTimeout(saveListHeightTimeout);
  saveListHeightTimeout = setTimeout(function () {
    if (s.currentFolder) {
      localStorage.setItem("eagle.list.thumbSize." + s.currentFolder.id, height);
    } else if (s.currentSmartFolder) {
      localStorage.setItem("eagle.list.thumbSize." + s.currentSmartFolder.id, height);
    } else if (s.currentTag) {
      localStorage.setItem("eagle.list.thumbSize." + s.currentTag, height);
    } else if (s.viewMode === 'all') {
      localStorage.setItem("eagle.list.thumbSize.all", height);
    } else if (s.viewMode === 'unfiled') {
      localStorage.setItem("eagle.list.thumbSize.unfiled", height);
    } else if (s.viewMode === 'untagged') {
      localStorage.setItem("eagle.list.thumbSize.untagged", height);
    } else if (s.viewMode === 'trash') {
      localStorage.setItem("eagle.list.thumbSize.trash", height);
    } else if (s.viewMode === 'random') {
      localStorage.setItem("eagle.list.thumbSize.random", height);
    } else if (s.viewMode === 'recent') {
      localStorage.setItem("eagle.list.thumbSize.recent", height);
    }
  }, 150);
}

/* adjustLayoutWidth（bundle 33839-33947 逐字；ig._layout._columnLength 经 window 解析，
   scrollToCurrentItem 经 scope 解析） */
export function gridAdjustLayoutWidth(s: any, increases: any): void {
  const w = window as any;
  if (!s.isItemBindCalculated) return;

  increases = increases || 0;
  var height;
  s.boxContianerWidth = widthOf(q("#box-container")) || s.boxContianerWidth;
  s.boxContianerHeight = heightOf(q("#box-container")) || s.boxContianerHeight;
  if (s.layout === "GridLayout" || s.layout === "SquareLayout") {
    if (!w.ig._layout._columnLength) return;
    var containerWidth = widthOf(q("#box-container")) || s.boxContianerWidth;
    containerWidth = containerWidth - 16 - 10 - 6;
    var currentColumn = w.ig._layout._columnLength;
    var newColumn = (currentColumn + increases) || 1;
    var newHeight = parseInt(((containerWidth - 10 * (newColumn + 1))) / newColumn as any);
    height = Math.ceil(newHeight / 5) * 5;
    if (height > s.MAX_LIST_WIDTH) height = s.MAX_LIST_WIDTH;
  }
  else {
    let step = 50;
    if (s.imageSize.height > 500) {
      step = 100;
    }
    else if (s.imageSize.height < 200) {
      step = 25;
    }
    height = parseInt((s.imageSize.height + (step * -increases)) / 5 as any) * 5;
  }
  if (height > s.MAX_LIST_WIDTH) height = s.MAX_LIST_WIDTH;
  if (height < 75) height = 75;
  s.imageSize.height = parseInt(height);
  syncToolbarFromScope();
  syncBodyFromScope();
  syncDetailFromScope();
  syncInspectorFromScope();
  if (!height) height = s.imageSize.height;
  if (Number.isFinite(height) && height > 0) {
    s.lastImageHeight = s.imageSize.height;
    setAttr("#box-container", "box-size", height);
    var margin = Math.floor((containerWidth % height) / (parseInt(containerWidth / height as any) - 1));
    if (margin === Infinity) margin = 10;
    machineryRelayout(s, margin);

    machineryScrollToCurrentItem(s);
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
    machineryChangeListHeight(s);
    if (s.layout === "GridLayout" || s.layout === "SquareLayout") {
      machineryAdjustLayoutWidth(s, 0);
      gridSaveListHeight(s, s.imageSize.height);
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

    machinerySmartZoom(s, undefined, true);
  }
}

/* zoomIn（bundle 33883-33898 逐字：非详情 adjustLayoutWidth(-1)+saveListHeight +
   详情 5 步进 ratioExp 梯度（400/200/100/50/25/10/5 封顶 800）+ updateZoomRatio）；
   zoomOut（33899-33914 逐字：对称梯度 + 非详情多一步 checkListItemsLessThanContainer） */
export function gridZoomIn(s: any, event: any): void {
  event && event.preventDefault && event.preventDefault();
  if (!s.isDetailMode) {
    machineryAdjustLayoutWidth(s, -1);
    gridSaveListHeight(s, s.imageSize.height);
  } else {
    var ratio = Math.ceil(s.imageSize.zoomRatio / 5) * 5;
    var ratioExp = getRatioExp(ratio);
    if (ratioExp >= 400) { ratioExp = 800; } else if (ratioExp >= 200) { ratioExp = 400; } else if (ratioExp >= 100) { ratioExp = 200; } else if (ratioExp >= 50) { ratioExp = 100; } else if (ratioExp >= 25) { ratioExp = 50; } else if (ratioExp >= 10) { ratioExp = 25; } else if (ratioExp >= 5) { ratioExp = 10; } else { ratioExp = 5; }
    if (ratioExp > 800) ratioExp = 800;
    s.imageSize.zoomRatio = getRatioNonExp(ratioExp);
    s.imageSize.zoomRatioExp = getRatioExp(s.imageSize.zoomRatio);
    machineryUpdateZoomRatio(s, undefined, undefined, undefined, true);
  }
}

export function gridZoomOut(s: any, event: any): void {
  event && event.preventDefault && event.preventDefault();
  if (!s.isDetailMode) {
    machineryAdjustLayoutWidth(s, 1);
    gridSaveListHeight(s, s.imageSize.height);
    machineryCheckListItemsLessThanContainer(s);
  } else {
    var ratio = Math.floor(s.imageSize.zoomRatio / 5) * 5;
    var ratioExp = getRatioExp(ratio);
    if (ratioExp <= 10) { ratioExp = 5; } else if (ratioExp <= 25) { ratioExp = 10; } else if (ratioExp <= 50) { ratioExp = 25; } else if (ratioExp <= 100) { ratioExp = 50; } else if (ratioExp <= 200) { ratioExp = 100; } else if (ratioExp <= 400) { ratioExp = 200; } else if (ratioExp <= 800) { ratioExp = 400; }
    s.imageSize.zoomRatio = getRatioNonExp(ratioExp);
    s.imageSize.zoomRatioExp = getRatioExp(s.imageSize.zoomRatio);
    machineryUpdateZoomRatio(s, undefined, undefined, undefined, true);
  }
}

/* React 直调便捷面（无 scope 参数版本）——组件侧（如 BoxList 滚轮）不再绕 callFn。 */
export function zoomIn(event: any): void {
  const s = getBodyScope();
  if (s) gridZoomIn(s, event);
}

export function zoomOut(event: any): void {
  const s = getBodyScope();
  if (s) gridZoomOut(s, event);
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
      machineryRelayout(s);
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
      machineryRelayout(s);
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
      machineryRelayout(s);
      w.electronLog && w.electronLog.info("[app] Layout: List");
      break;
    default:
      window.requestAnimationFrame(() => {
        removeClass("body", "is-square-layout is-list-layout");
      });
      s.layout = "JustifiedLayout";
      removeClass("#box-container", allLayout); addClass("#box-container", "justified-layout");
      machineryRelayout(s);
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
export function machineryUpdateSliderPosition(s: any): void {
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
      const s: any = getBodyScope();
      var id;
      if (s.currentFolder) { id = s.currentFolder.id; }
      else if (s.currentSmartFolder) { id = s.currentSmartFolder.id; }
      else if (s.viewMode == "all") { id = "all"; }
      else if (s.viewMode == "unfiled") { id = "unfiled"; }
      else if (s.viewMode == "untagged") { id = "untagged"; }
      else if (s.viewMode == "trash") { id = "trash"; }
      else if (s.viewMode == "random") { id = "random"; }
      else if (s.viewMode == "recent") { id = "recent"; }
      return id;
    },
    saveScrollPosition: function () {
      const s: any = getBodyScope();
      if (w.eagle.filter.filterBadge > 0) return;
      if (s.keyword) return;
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
      if (qa(".sub-folder").length > 0 && s.startCursor === 0) {
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
      const s: any = getBodyScope();
      if (s.viewMode === 'random') return;
      if (w.eagle.filter.filterBadge > 0) return;
      var id = ScrollbarSaver.getId();

      if (!id) return;

      var obj = ScrollbarSaver.positionMapping[id];
      var $boxContainer = q("#box-container");
      if (obj) {
        s.startCursor = obj.cursor || 0;
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
        s.startCursor = 0;
      }
    }
  };
  return ScrollbarSaver;
}

let changeListHeightTimeout: any = null;

/* b1-9bd：adjustLayoutWidth 实现体归位 services/gridService.ts */
export function machineryAdjustLayoutWidth(s: any, increases: any): void {
  gridAdjustLayoutWidth(s, increases);
}

export function machineryChangeListHeight(s: any, height: any): void {
  const w = window as any;
  if (!height) height = s.imageSize.height;
  if (Number.isFinite(height) && height > 0) {

    height = parseInt(height / 5 as any) * 5;

    s.lastImageHeight = s.imageSize.height;

    clearTimeout(changeListHeightTimeout);
    changeListHeightTimeout = setTimeout(function () {
      if (s.currentFolder) {
        w.localStorage.setItem("eagle.list.thumbSize." + s.currentFolder.id, height as any);
      } else if (s.currentSmartFolder) {
        w.localStorage.setItem("eagle.list.thumbSize." + s.currentSmartFolder.id, height as any);
      } else if (s.currentTag) {
        w.localStorage.setItem("eagle.list.thumbSize." + s.currentTag, height as any);
      } else if (s.viewMode === 'all') {
        w.localStorage.setItem("eagle.list.thumbSize.all", height as any);
      } else if (s.viewMode === 'unfiled') {
        w.localStorage.setItem("eagle.list.thumbSize.unfiled", height as any);
      } else if (s.viewMode === 'untagged') {
        w.localStorage.setItem("eagle.list.thumbSize.untagged", height as any);
      } else if (s.viewMode === 'trash') {
        w.localStorage.setItem("eagle.list.thumbSize.trash", height as any);
      } else if (s.viewMode === 'random') {
        w.localStorage.setItem("eagle.list.thumbSize.random", height as any);
      } else if (s.viewMode === 'recent') {
        w.localStorage.setItem("eagle.list.thumbSize.recent", height as any);
      }
    }, 500);

    setAttr("#box-container", "box-size", height as any);
    machineryRelayout(s);

    machineryScrollToCurrentItem(s);
  }
}

/* currentIndex（bundle 28993-28997 逐字：selected[0] 在 allData 的位次 +1） */
export function machineryCurrentIndex(s: any): any {
  if (!s.allData) return undefined;
  return s.allData.indexOf(s.selected[0]) + 1;
}

/* getArroundBox（bundle 35091-35097 逐字，controller 闭包） */
export function machineryGetArroundBox(s: any, index: any): any {
  var arroundStart = (index - 20 >= 0) ? index - 20 : 0;
  var arroundEnd = (index + 20 > s.allData.length) ? s.allData.length : index + 20;
  var $arround = qa(".box").slice(arroundStart, arroundEnd);
  return $arround;
}

export function machineryGotoBottom(s: any): void {
  const w = window as any;
  if (s.allData.length < s.options.page) {
    var offset = (q("#box-container") as HTMLElement | null)?.scrollHeight;
    setScrollTop("#box-container", offset as any);
  }
  else {
    var endCursor = Math.ceil(s.allData.length / s.options.page) - 1 || 0;
    w.resetNgGridLayoutData(s.allData, endCursor);
    var times = [100, 400];
    for (var i = times[0]; i < times[1]; i += 100) {
      s.gotoBottomTimeout = setTimeout(function () { setScrollTop("#box-container", 1000000); }, i);
    }
  }
}

export function machineryGotoTop(s: any): void {
  const w = window as any;
  if (s.allData.length < s.options.page) {
    setScrollTop("#box-container", 0);
  }
  else {
    clearTimeout(s.gotoBottomTimeout);
    w.resetNgGridLayoutData(s.allData, 0);
    setScrollTop("#box-container", 0);
  }
}

export function machineryOffsetScrollbar(s: any): any {
  const w = window as any;
  return debounce(function offsetScrollbar(delay: any, forceScroll: any) {
    machineryOffsetScrollbarImm(s, delay, forceScroll);
  }, 100, true);
}

export function machineryOffsetScrollbarImm(s: any, delay: any, forceScroll: any): void {
  setTimeout(function () {
    var container = q("#box-container") as HTMLElement | null;
    if (s.selected.length > 0) {
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
  machineryUpdateContainerHieght(s);
}

export function machineryRelayout(s: any, margin: any): void {
  const w = window as any;
  if (!s.isItemBindCalculated) return;
  var $container = q("#box-container");
  var currentImageSize = s.imageSize.height;
  setAttr("#box-container", "box-size", Math.floor(currentImageSize / 5) * 5);
  const ig = w.ig;
  if (!ig) return;
  if (s.layout === "JustifiedLayout") {
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
  else if (s.layout === "ListLayout") {
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

export function machineryRememberScrollTops(s: any, item: any): void {
  const w = window as any;
  if (s.isInlineMode) return;
  if (s.lastZoomMode === "edge") return;
  if (item && item.id) {
    s.lastItemStates[item.id] = {
      data: detailZoom()?.getChangedData()
    }
  }
}

export function machinerySaveListHeight(s: any, height: any): void {
  gridSaveListHeight(s, height);
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
export function machineryUpdateContainerHieght(s: any, hasAnimation: any, delay: any = 1): void {
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
export function machineryUpdateListHeight(s: any, height: any): void {
  const w = window as any;
  clearTimeout(updateListHeightTimeout);
  updateListHeightTimeout = setTimeout(function () {
    setAttr("#box-container", "box-size", height);
  }, 50);
}

/* updateListSlider（bundle 31350-31352：**函数体为空——no-op 原样**） */
export function machineryUpdateListSlider(s: any, size: any): void {

}

let updateListHeightTimeout: any = null;
