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
import { getBodyScope } from '../global/scopeBridge';

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
  s.boxContianerWidth = w.$("#box-container").width() || s.boxContianerWidth;
  s.boxContianerHeight = w.$("#box-container").height() || s.boxContianerHeight;
  if (s.layout === "GridLayout" || s.layout === "SquareLayout") {
    if (!w.ig._layout._columnLength) return;
    var containerWidth = w.$("#box-container").width() || s.boxContianerWidth;
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

  if (!height) height = s.imageSize.height;
  if (Number.isFinite(height) && height > 0) {
    s.lastImageHeight = s.imageSize.height;
    w.$("#box-container").attr("box-size", height);
    var margin = Math.floor((containerWidth % height) / (parseInt(containerWidth / height as any) - 1));
    if (margin === Infinity) margin = 10;
    s.relayout(margin);

    s.scrollToCurrentItem();
  }
}

/* zoomFit（bundle 33949-33985 逐字；changeListHeight/adjustLayoutWidth/smartZoom/
   zoomFitEdge 经 scope 解析） */
export function gridZoomFit(s: any, event: any, noAnimation: any): void {
  const w = window as any;
  event && event.preventDefault && event.preventDefault();
  if (!s.isDetailMode) {
    s.imageSize.height = 150;
    s.changeListHeight();
    if (s.layout === "GridLayout" || s.layout === "SquareLayout") {
      s.adjustLayoutWidth(0);
      gridSaveListHeight(s, s.imageSize.height);
    }
  } else {
    if (s.VIDEO_TYPES[s.current.ext]) {
      // 如果是視頻格式，撐滿畫面
      var mpvPlayer = w.$(".detail-wrap mpv-video")[0];
      if (mpvPlayer) {
        mpvPlayer.scaleMode = 'fit';
      }
      else {
        var $video = w.$(".detail-wrap video");
        if ($video.length > 0) {
          $video.removeClass("fit");
        }
      }
      return;
    }
    s.zoomFitSize = 0;
    s.lastZoomMode = "fit";
    localStorage["eagle.viewer.lastZoomMode"] = s.lastZoomMode;
    s.imageSize.zoomRatio = 100;
    s.imageSize.zoomRatioExp = s.getRatioExp(s.imageSize.zoomRatio);

    if (!noAnimation) {
      w.$("#detail-container").addClass("zooming");
      setTimeout(function () {
        w.$("#detail-container").removeClass("zooming");
      }, 300);
    }

    s.smartZoom(undefined, true);
  }
}

/* zoomIn（bundle 33883-33898 逐字：非详情 adjustLayoutWidth(-1)+saveListHeight +
   详情 5 步进 ratioExp 梯度（400/200/100/50/25/10/5 封顶 800）+ updateZoomRatio）；
   zoomOut（33899-33914 逐字：对称梯度 + 非详情多一步 checkListItemsLessThanContainer） */
export function gridZoomIn(s: any, event: any): void {
  event && event.preventDefault && event.preventDefault();
  if (!s.isDetailMode) {
    s.adjustLayoutWidth(-1);
    gridSaveListHeight(s, s.imageSize.height);
  } else {
    var ratio = Math.ceil(s.imageSize.zoomRatio / 5) * 5;
    var ratioExp = s.getRatioExp(ratio);
    if (ratioExp >= 400) { ratioExp = 800; } else if (ratioExp >= 200) { ratioExp = 400; } else if (ratioExp >= 100) { ratioExp = 200; } else if (ratioExp >= 50) { ratioExp = 100; } else if (ratioExp >= 25) { ratioExp = 50; } else if (ratioExp >= 10) { ratioExp = 25; } else if (ratioExp >= 5) { ratioExp = 10; } else { ratioExp = 5; }
    if (ratioExp > 800) ratioExp = 800;
    s.imageSize.zoomRatio = s.getRatioNonExp(ratioExp);
    s.imageSize.zoomRatioExp = s.getRatioExp(s.imageSize.zoomRatio);
    s.updateZoomRatio(undefined, undefined, undefined, true);
  }
}

export function gridZoomOut(s: any, event: any): void {
  event && event.preventDefault && event.preventDefault();
  if (!s.isDetailMode) {
    s.adjustLayoutWidth(1);
    gridSaveListHeight(s, s.imageSize.height);
    s.checkListItemsLessThanContainer();
  } else {
    var ratio = Math.floor(s.imageSize.zoomRatio / 5) * 5;
    var ratioExp = s.getRatioExp(ratio);
    if (ratioExp <= 10) { ratioExp = 5; } else if (ratioExp <= 25) { ratioExp = 10; } else if (ratioExp <= 50) { ratioExp = 25; } else if (ratioExp <= 100) { ratioExp = 50; } else if (ratioExp <= 200) { ratioExp = 100; } else if (ratioExp <= 400) { ratioExp = 200; } else if (ratioExp <= 800) { ratioExp = 400; }
    s.imageSize.zoomRatio = s.getRatioNonExp(ratioExp);
    s.imageSize.zoomRatioExp = s.getRatioExp(s.imageSize.zoomRatio);
    s.updateZoomRatio(undefined, undefined, undefined, true);
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
