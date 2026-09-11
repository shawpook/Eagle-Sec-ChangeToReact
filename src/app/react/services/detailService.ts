/**
 * b1-9bk：详情服务 —— toggleDetailMode / smartZoom / updateZoomRatio 归位（自
 * dataMachinery 逐字搬移；machinery 留委托壳，挂载面与键位表 'enter' 路径零改动）。
 *
 * smoothZoom 仍为 vendor jQuery 插件消费面（S4-bl 剥壳重写）；getRatioExp/NonExp 留
 * machinery（与本模块为双侧函数声明提升、无顶层执行面的既有循环依赖模式，同
 * controllerFns⇄dataMachinery 先例）。组件侧唯一入口：FolderModals 的 smartZoom ×2、
 * detailHooks 的 updateZoomRatio ×1 改直调。
 */
import { detailZoom } from '../core/smoothZoomEngine';
import { machineryEnterDetailMode, machineryGetRatioExp, machineryGetRatioNonExp, machineryLeaveDetailMode, machineryOnZoomRatioChanged, machineryRenameCurrentFolder } from '../core/dataMachinery';
import { syncDetailFromScope } from '../store/detailState';
import { getBodyScope } from '../core/appCore';
import { openFolder } from './folderCoreService';
import { saveCrop } from './imageOpsService';
import { q, qa, widthOf, heightOf, addClass, removeClass, cssSet } from '../utils/domQuery';
import { isNumeric } from '../utils/lang';
// ── 域内自管（原 controller 闭包 var：updateZoomRatioTimeout，31389 邻域）——
// updateZoomRatio/homeHandler/endHandler 三处共用的 zooming 类 300ms 护栏 ──
let updateZoomRatioTimeout: any = null;

/** zooming 护栏（b1-9bk 抽取：原三处重复的 clearTimeout + addClass + 300ms 移除块） */
export function beginZoomingTransition(): void {
  clearTimeout(updateZoomRatioTimeout);
  addClass("#detail-container", "zooming");
  updateZoomRatioTimeout = setTimeout(function () {
    removeClass("#detail-container", "zooming");
  }, 300);
}

/* updateZoomRatio（bundle 31391-31418 逐字；smoothZoom = vendor jQuery 插件；
   updateZoomRatioTimeout 域内自管） */
export function detailUpdateZoomRatio(s: any, ratio: any, x: any, y: any, hasTransition: any): void {
  var pageX: any, pageY: any;

  if (ratio) {
    s.imageSize.zoomRatio = ratio;
    machineryOnZoomRatioChanged(s);
    s.imageSize.zoomRatioExp = machineryGetRatioExp(s.imageSize.zoomRatio);
  }

  if (isNumeric(x) && isNumeric(y)) {
    pageX = x;
    pageY = y;
  } else {
    pageX = window.innerWidth / 2;
    pageY = window.innerHeight / 2;
  }

  if (hasTransition) {
    beginZoomingTransition();
  }

  detailZoom()?.focusTo( {
    zoom: s.imageSize.zoomRatioExp,
    pageX: pageX,
    pageY: pageY,
    speed: 0
  });
}

/* smartZoom（bundle 31209-31334 逐字；devicesMetrics/isMobileResolution/getImagePixelDensity/
   isMobileWidth 经 window（c18a 供给），zoomRatio 换算走 machinery 版） */
export function detailSmartZoom(s: any, target: any, forceMode: any): void {
  const w = window as any;
  var current = target || s.current;
  var ratio = s.imageSize.zoomRatio || 100;
  var lastRatio = ratio;
  var $container = q(".content-panel");
  var toolbarHeight = 0;
  var containerWidth;
  var containerHeight;
  var offsetY = 0;

  if (s.isSlideshowMode) {
    toolbarHeight = 0;
    containerWidth = window.innerWidth;
    containerHeight = window.innerHeight - toolbarHeight;
  }
  else if (s.isInlineMode) {
    toolbarHeight = 96;
    containerWidth = window.innerWidth;
    containerHeight = heightOf($container) - toolbarHeight;
  }
  else {
    toolbarHeight = 48;
    containerWidth = widthOf($container);
    containerHeight = heightOf($container) - toolbarHeight;
  }

  if (!current) return;

  cssSet("#detail-image", {
    "transform": `rotate(0deg)`,
    "transition": "none"
  });

  // 不使用智能縮放
  if (s.$root.preferences.habits.defaultRatio != "auto" && !forceMode) {
    ratio = 100;
    offsetY = toolbarHeight / 2 * 100 / ratio;
  }
  // 使用智能縮放
  else {
    if (
      (current.width >= 960 && current.width * 1.8 < current.height) ||
      (current.width >= 320 && current.width * 2.7 < current.height)
    ) {
      ratio = parseInt((containerWidth - 0) / current.width * 100 as any);
      if (ratio > 100) {
        ratio = 100;
      }
      if (current.height > heightOf($container)) {
        offsetY = toolbarHeight / 2 * 100 / ratio;
        offsetY += (current.height - containerHeight * 100 / ratio) / -2;
      }
      else {
        offsetY = toolbarHeight / 2 * 100 / ratio;
      }
    }
    else {
      if (current.height + toolbarHeight / 2 > containerHeight || current.width + toolbarHeight / 2 > containerWidth) {
        var a = parseInt((containerHeight) / current.height * 100 as any);
        var b = parseInt((containerWidth) / current.width * 100 as any);
        ratio = Math.min(a, b);
      }
      else {
        ratio = 100;
      }
      offsetY = toolbarHeight / 2 * 100 / ratio;
    }

    // 如果是手机尺寸并且尺寸符合画面大小
    if (w.getImagePixelDensity(current) !== 100) {
      var mr = w.getImagePixelDensity(current);
      var largeThanCotainer = current.width * mr / 100 > containerWidth || current.height * mr / 100 > containerHeight;
      if (!largeThanCotainer) {
        ratio = mr;
        offsetY = toolbarHeight / 2 * 100 / ratio;
      }
      else {
        var wr = mr / ((current.width * mr / 100) / containerWidth);
        var hr = mr / ((current.height * mr / 100) / containerHeight);
        ratio = Math.min(wr, hr);
        offsetY = toolbarHeight / 2 * 100 / ratio;
      }
    }
    else if (w.isMobileResolution(current.width, current.height)) {
      var mr2 = 100 * w.isMobileResolution(current.width, current.height) / current.height;
      var largeThanCotainer2 = current.width * mr2 / 100 > containerWidth || current.height * mr2 / 100 > containerHeight;
      if (!largeThanCotainer2) {
        ratio = mr2;
        offsetY = toolbarHeight / 2 * 100 / ratio;
      }
      else {
        var wr2 = mr2 / ((current.width * mr2 / 100) / containerWidth);
        var hr2 = mr2 / ((current.height * mr2 / 100) / containerHeight);
        ratio = Math.min(wr2, hr2);
        offsetY = toolbarHeight / 2 * 100 / ratio;
      }
    }
    else if (w.isMobileWidth(current.width) && current.width * 2.4 < current.height) {
      ratio = w.isMobileWidth(current.width) / current.width * 100;
      if (ratio > 100) {
        ratio = 100;
      }
      if (current.height > heightOf($container)) {
        offsetY = (current.height - heightOf($container) * 100 / ratio) / -2;
        offsetY = toolbarHeight / 2 * 100 / ratio;
      }
    }
  }

  var $detailContainer = q("#detail-container");
  var width = widthOf($detailContainer);
  var height = current && current.height || heightOf($detailContainer);

  offsetY = offsetY || 0;

  if (ratio) {
    s.imageSize.zoomRatio = machineryGetRatioNonExp(ratio);
    machineryOnZoomRatioChanged(s);
    s.imageSize.zoomRatioExp = machineryGetRatioExp(s.imageSize.zoomRatio);
  }
  s.showLargeImage = true;
  detailZoom()?.focusTo( {
    x: width / 2,
    y: height / 2 + offsetY,
    zoom: s.imageSize.zoomRatio,
    speed: 0
  });
}

/* toggleDetailMode（bundle 31005-31029 逐字；saveCrop/renameCurrentFolder/openFolder
   经 scope 解析） */
export function detailToggleDetailMode(s: any, $event: any, isInline: any): void {
  if (qa(".swal2-container").length > 0) return;
  if (s.isCropMode) {
    saveCrop();
    return;
  }
  if (isInline !== undefined) {
    s.isInlineMode = !!isInline;
    if (s.isInlineMode) {
      s.isCommentMode = false;
      syncDetailFromScope();
    }
  }
  if (s.$root.currentFocus == "sidebar" || s.$root.currentFocus == "tags") {
    machineryRenameCurrentFolder(s, $event);
  }
  else {
    if (s.selectedFolderMappings && Object.keys(s.selectedFolderMappings).length >= 1) {
      var folderId = Object.keys(s.selectedFolderMappings)[0];
      if (s.folderMappings[folderId]) {
        openFolder(s.folderMappings[folderId]);
      }
    }
    else {
      if (s.isDetailMode) {
        machineryLeaveDetailMode(s, $event);
      }
      else {
        machineryEnterDetailMode(s, $event, null);
      }
    }
  }
}
/* ── React 直调便捷面（无 scope 参数版本）——组件侧直调不绕 scope。 */
export function smartZoom(target?: any, forceMode?: any): void {
  const s = getBodyScope();
  if (s) detailSmartZoom(s, target, forceMode);
}

export function updateZoomRatio(ratio?: any, x?: any, y?: any, hasTransition?: any): void {
  const s = getBodyScope();
  if (s) detailUpdateZoomRatio(s, ratio, x, y, hasTransition);
}
