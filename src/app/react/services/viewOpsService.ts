/**
 * b1-9bz-A：viewOpsService.ts 新建落点——controllerFns 表体归位。
 * 函数体为 makeControllerFns 表内壳逐字平移（getScope()→getBodyScope()）。
 */

;
import { detailZoom } from '../core/smoothZoomEngine';
import { syncBodyFromScope } from '../store/bodyState';
import { syncDetailFromScope } from '../store/detailState';
import { syncInspectorFromScope } from '../store/inspectorState';
import { syncToolbarFromScope } from '../store/toolbarState';

import { q, qa, cssSet, addClass, removeClass, widthOf, heightOf } from '../utils/domQuery';
import { debounce } from '../utils/func';
import { detailUpdateZoomRatio, detailSmartZoom } from './detailService';


import { machineryAdjustLayoutWidth, machineryChangeListHeight, machinerySwitchLayout, machinerySaveListHeight, gridZoomFit, gridZoomIn, gridZoomOut } from './gridService';
import { machineryOnImageSizeHeightChanged } from '../core/itemDomain';
import { getFilter } from '../core/filterDomain';
import { machineryGetSelection } from '../core/selectionViewDomain';
import { useFolderState } from '../store/folderState';
import { useBodyState } from '../store/bodyState';
import { useMiscRawState } from '../store/miscRawState';
import { useSelectionState } from '../store/selectionState';
import { useLayoutState } from '../store/layoutState';
import { writeScopeField } from '../core/scopeFieldBridge';
import { usePreferencesState } from '../store/preferencesState';
import { useItemState } from '../store/itemState';
// 原 bundle controller 闭包 var（viewOpsService 内 __lv_saveListHeight 唯一使用方）
let saveListHeightTimeout: any = null;
// ═══ b1-9bz-A：controllerFns 表体归位（逐字平移；getScope()→getBodyScope()；表项指针化）═══
// —— controllerFns 模块级声明随迁（verbatim；按原声明顺序防 TDZ）——
const EagleConfig: any = (window as any).EagleConfig || {};

const VIDEO_TYPES: any = {}; (EagleConfig.VIDEO_FORMATS || []).forEach(function (ext: string) { VIDEO_TYPES[ext] = true; });

const electronSettings: any = (window as any).electronSettings;

let preferences: any = (window as any).electronSettings?.getPreferences?.() || {};

// —— link 级共享态（原 makeControllerFns 闭包声明）——
var __lv_saveListHeight: any;
var __lv_target: any;
var __lv_updateZoomRatioTimeout: any;
var __lv_video: any;
var __lv_x: any;
var __lv_y: any;

let lvInited = false;
const initLinkVars = () => {
  if (lvInited) return;
  lvInited = true;
  // __lv_saveListHeight（原 initLinkVars 逐字）
        __lv_saveListHeight = function (height: any) {
              clearTimeout(saveListHeightTimeout);
              saveListHeightTimeout = setTimeout(function() {
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
          };
};


export function getRatioExp(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function (ratio) {
            if (ratio > 100) {
                ratio = 100 + (ratio - 100) * 7;
            }
            return parseInt(ratio);
        }).apply(null, args);
  }

export function getRatioNonExp(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function (ratio) {
            if (ratio > 100) {
                ratio = (ratio - 100) / 7 + 100;
            }
            return ratio;
        }).apply(null, args);
  }

export function lastZoom(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版等价，统一转发消除重复实现。
   // 原 c3 体的 scope 守卫，逐字保留
  machineryLastZoom();
}

export function smartZoom(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 委托的 detailSmartZoom 逐行等价
  // （差异仅参数名 __lv_target/target、$ → w.$）。
   // 原 c3 体的 scope 守卫，逐字保留
  machinerySmartZoom(args[0], args[1]);
}

export function switchGridLayout(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function () {
            machinerySwitchLayout("GridLayout");
            machinerySaveLayout(useFolderState.getState().currentFolder || useFolderState.getState().currentSmartFolder, "GridLayout");
        }).apply(null, args);
  }

export function switchJustifiedLayout(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function () {
            machinerySwitchLayout("JustifiedLayout");
            machinerySaveLayout(useFolderState.getState().currentFolder || useFolderState.getState().currentSmartFolder, "JustifiedLayout");
        }).apply(null, args);
  }

export function switchListLayout(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function () {
            machinerySwitchLayout("ListLayout");
            machinerySaveLayout(useFolderState.getState().currentFolder || useFolderState.getState().currentSmartFolder, "ListLayout");
        }).apply(null, args);
  }

export function switchSquareLayout(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function () {
            machinerySwitchLayout("SquareLayout");
            machinerySaveLayout(useFolderState.getState().currentFolder || useFolderState.getState().currentSmartFolder, "SquareLayout");
        }).apply(null, args);
  }

export function updateZoomRatio(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版等价（beginZoomingTransition 与 c3 的 hasTransition 分支逐行一致）。
   // 原 c3 体的 scope 守卫，逐字保留
  machineryUpdateZoomRatio(args[0], args[1], args[2], args[3]);
}

export function zoom(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版等价，统一转发消除重复实现。
   // 原 c3 体的 scope 守卫，逐字保留
  machineryZoom();
}

export function zoomFit(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function(event, noAnimation) {
            event && event.preventDefault && event.preventDefault();
            if (!useBodyState.getState().isDetailMode) {
                useLayoutState.getState().imageSize.height = 150;
                syncToolbarFromScope();
                syncBodyFromScope();
                syncDetailFromScope();
                syncInspectorFromScope();
                machineryChangeListHeight();
                if (useBodyState.getState().layout === "GridLayout" || useBodyState.getState().layout === "SquareLayout") { 
                    machineryAdjustLayoutWidth(0);
                    __lv_saveListHeight(useLayoutState.getState().imageSize.height);
                }
            } else {
                if (useMiscRawState.getState().VIDEO_TYPES[useSelectionState.getState().current.ext]) {
                    // 如果是視頻格式，撐滿畫面
                    var mpvPlayer = q(".detail-wrap mpv-video");
                    if (mpvPlayer) {
                        mpvPlayer.scaleMode = 'fit';
                    }
                    else {
                        removeClass(".detail-wrap video", "fit");
                    }
                    return;
                }
                writeScopeField('zoomFitSize', 0);
                writeScopeField('lastZoomMode', "fit");
                syncDetailFromScope();
                localStorage["eagle.viewer.lastZoomMode"] = useMiscRawState.getState().lastZoomMode;
                useLayoutState.getState().imageSize.zoomRatio = 100;
                useLayoutState.getState().imageSize.zoomRatioExp = getRatioExp(useLayoutState.getState().imageSize.zoomRatio);

                if (!noAnimation) {
                    addClass("#detail-container", "zooming");
                    setTimeout(function () {
                        removeClass("#detail-container", "zooming");
                    }, 300);
                }

                machinerySmartZoom(undefined, true);
            }
        }).apply(null, args);
  }

export function zoomIn(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版等价，统一转发消除重复实现。
   // 原 c3 体的 scope 守卫，逐字保留
  machineryZoomIn(args[0]);
}

export function getNext(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function () {
        var selection = machineryGetSelection();
        var start = selection.start;
        var end = selection.end;
        return useItemState.getState().allData[end + 1] || useItemState.getState().allData[end - 1];
    }).apply(null, args);
  }


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
/* saveLayout（bundle 37280-37286 逐字：localStorage bracket 赋值原样） */
export function machinerySaveLayout(folder: any, layout: any): void {
  const w = window as any;
  if (folder) {
    w.localStorage[`eagle.list.layout.${folder.id}`] = layout;
  }
  else {
    w.localStorage[`eagle.list.layout.${useMiscRawState.getState().rootDir}`] = layout;
  }
}


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
export function machineryCheckOperationSafety(callback: any, amount: any = 100): void {
  const w = window as any;
  try {
    if (useSelectionState.getState().selected && useSelectionState.getState().selected.length >= amount) {
      var html = getFilter()('i18n')("Dialog.BulkAction.Descript", [
        { "property": "count", "value": useSelectionState.getState().selected.length },
      ]);
      w.swal({
        html: `
                            <div class="alert">
                                <div class="alert-icon warning"></div>
                                <h4 class="alert-title">${w.i18n.__("Dialog.BulkAction.Title")}</h4>
                                <p class="alert-desc">${html}</p>
                            </div>
                        `,
        showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: false, focusCancel: false, padding: 24,
        width: 400,
        customClass: "alert-box",
        cancelButtonColor: "#777777",
        confirmButtonText: w.i18n.__("Dialog.BulkAction.Button"),
        cancelButtonText: w.i18n.__("general.cancel"),
        allowEnterKey: false,
      }).then(function (result: any) {
        callback && callback();
      });
    }
    else {
      callback && callback();
    }
  }
  catch (err) {
    callback && callback();
  }
}

/* checkOperationSafety2（bundle 26823-26855 逐字：count 参数版） */
export function machineryCheckOperationSafety2(count: any, callback: any, amount: any = 100): void {
  const w = window as any;
  try {
    if (count >= amount) {
      var html = getFilter()('i18n')("Dialog.BulkAction.Descript", [
        { "property": "count", "value": count },
      ]);
      w.swal({
        html: `
                            <div class="alert">
                                <div class="alert-icon warning"></div>
                                <h4 class="alert-title">${w.i18n.__("Dialog.BulkAction.Title")}</h4>
                                <p class="alert-desc">${html}</p>
                            </div>
                        `,
        showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: false, focusCancel: false, padding: 24,
        allowEnterKey: false,
        width: 400,
        customClass: "alert-box",
        cancelButtonColor: "#777777",
        confirmButtonText: w.i18n.__("Dialog.BulkAction.Button"),
        cancelButtonText: w.i18n.__("general.cancel"),
      }).then(function (result: any) {
        callback && callback();
      });
    }
    else {
      callback && callback();
    }
  }
  catch (err) {
    callback && callback();
  }
}

/* getRatioExp（bundle 31336-31341 逐字） */
export function machineryGetRatioExp(ratio: any): number {
  if (ratio > 100) {
    ratio = 100 + (ratio - 100) * 7;
  }
  return parseInt(ratio);
}

/* getRatioNonExp（bundle 31343-31348 逐字） */
export function machineryGetRatioNonExp(ratio: any): number {
  if (ratio > 100) {
    ratio = (ratio - 100) / 7 + 100;
  }
  return ratio;
}

/* lastZoom（bundle 31288-31305 逐字；lastItemStates 经 scope 解析） */
export function machineryLastZoom(): boolean {
  const w = window as any;
  if (useMiscRawState.getState().lastZoomMode === "edge") return false;
  if (usePreferencesState.getState().preferences.habits.rememberLastZoom === "off") return false;
  if (!useSelectionState.getState().current) return false;
  if (useBodyState.getState().isInlineMode) return false;
  var state = useItemState.getState().lastItemStates[useSelectionState.getState().current.id];
  if (state && state.data && state.data.tX !== undefined) {
    detailZoom()?.goTo( state.data.tX, state.data.tY, state.data.rA);
    var ratio = parseInt(state.data.rA * 100 as any);
    useLayoutState.getState().imageSize.zoomRatio = machineryGetRatioNonExp(ratio);
    machineryOnZoomRatioChanged();
    useLayoutState.getState().imageSize.zoomRatioExp = ratio;
    return true;
  }
  return false;
}

/** imageSize.zoomRatio 变化后的统一处理（原 $watch("imageSize.zoomRatio") 的 listener）。 */
export function machineryOnZoomRatioChanged(): void {
  if (!useLayoutState.getState().imageSize) return;
  writeScopeField('sliderZoomRatio', useLayoutState.getState().imageSize.zoomRatio);
  syncDetailFromScope();
}

export function machinerySetViewMode(viewMode: any): void {
  const w = window as any;
  if (!viewMode) return;
  if (!setViewModeDebounced) {
    setViewModeDebounced = debounce(function (vm: any) {
      localStorage.setItem(`eagle.viewMode.${useMiscRawState.getState().rootDir}`, vm);
    }, 500);
  }
  setViewModeDebounced(viewMode);
}

export function machinerySmartZoom(target: any, forceMode: any): void {
  detailSmartZoom(target, forceMode);
}

/* toggleZoom（bundle 33990-34012 逐字） */
export function machineryToggleZoom(event: any): void {
  const w = window as any;
  if (!useBodyState.getState().isDetailMode) return;
  if (useMiscRawState.getState().VIDEO_TYPES[useSelectionState.getState().current.ext]) {
    if (useMiscRawState.getState().lastZoomMode !== "edge") {
      machineryZoomFit(event);
      writeScopeField('lastZoomMode', "edge");
      syncDetailFromScope();
      writeScopeField('zoomFitSize', useLayoutState.getState().imageSize.zoomRatioExp);
    }
    else {
      machineryZoomActual(event);
      writeScopeField('lastZoomMode', "fit");
      syncDetailFromScope();
      writeScopeField('zoomFitSize', 0);
    }
  }
  else {
    if (useMiscRawState.getState().lastZoomMode !== "edge") {
      machineryZoomFitEdge(event, true);
      writeScopeField('lastZoomMode', "edge");
      syncDetailFromScope();
    }
    else {
      machineryZoomFit(event);
      writeScopeField('lastZoomMode', "fit");
      syncDetailFromScope();
    }
  }
  localStorage["eagle.viewer.lastZoomMode"] = useMiscRawState.getState().lastZoomMode;
}

export function machineryUpdateZoomRatio(ratio: any, x: any, y: any, hasTransition: any): void {
  detailUpdateZoomRatio(ratio, x, y, hasTransition);
}

/* zoom（bundle 31191-31204 逐字；zoomFitEdge/zoomFit/smartZoom 经 scope 解析） */
export function machineryZoom(): void {
  const w = window as any;
  if (!useBodyState.getState().isDetailMode) return;
  if (useMiscRawState.getState().lastZoomMode === "edge") {
    if (useSelectionState.getState().current && !w.VIDEO_TYPES[useSelectionState.getState().current.ext]) {
      machineryZoomFitEdge();
    }
    else {
      machineryZoomFit();
    }
  }
  else {
    machinerySmartZoom();
  }
}

/* zoomActual（bundle 33915-33937 逐字） */
export function machineryZoomActual(event: any): void {
  const w = window as any;
  event && event.preventDefault && event.preventDefault();
  if (!useBodyState.getState().isDetailMode) {
    useLayoutState.getState().imageSize.height = 150;
    syncToolbarFromScope();
    syncBodyFromScope();
    syncDetailFromScope();
    syncInspectorFromScope();
    machineryOnImageSizeHeightChanged();
    machineryChangeListHeight();
    if (useBodyState.getState().layout === "GridLayout" || useBodyState.getState().layout === "SquareLayout") {
      machineryAdjustLayoutWidth(0);
      machinerySaveListHeight(useLayoutState.getState().imageSize.height);
    }
  } else {
    useLayoutState.getState().imageSize.zoomRatio = 100;
    machineryOnZoomRatioChanged();
    useLayoutState.getState().imageSize.zoomRatioExp = getRatioExp(useLayoutState.getState().imageSize.zoomRatio);
    machineryUpdateZoomRatio(100, undefined, undefined, true);

    // 如果是視頻格式，尽可能使用视频原来尺寸
    var mpvPlayer = q(".detail-wrap mpv-video") as any;
    if (mpvPlayer) {
      mpvPlayer.scaleMode = 'original';
    }
    else {
      var $videos = qa(".detail-wrap video") as HTMLVideoElement[];
      if ($videos.length > 0) {
        var vW = $videos[0].videoWidth;
        var vH = $videos[0].videoHeight;
        cssSet(".detail-wrap video", {
          'max-width': `${vW}px !important`,
          'max-height': `${vH}px !important`,
        });
        addClass(".detail-wrap video", "fit");
      }
    }
  }
}

/* b1-9bd：zoomFit 实现体归位 services/gridService.ts */
export function machineryZoomFit(event: any, noAnimation: any): void {
  gridZoomFit(event, noAnimation);
}

/* zoomFitEdge（bundle 34015-34077 逐字） */
export function machineryZoomFitEdge(event: any, hasTransition: any): void {
  const w = window as any;
  event && event.preventDefault && event.preventDefault();

  if (hasTransition) {
    addClass("#detail-container", "zooming");
    setTimeout(function () {
      removeClass("#detail-container", "zooming");
    }, 300);
  }

  var current = useSelectionState.getState().current;
  var ratio = useLayoutState.getState().imageSize.zoomRatio || 100;
  var lastRatio = ratio;
  var $container = q(".content-panel");
  var toolbarHeight = 40;
  var containerWidth;
  var containerHeight;
  var offsetY = 0;

  if (useBodyState.getState().isSlideshowMode) {
    toolbarHeight = 0;
    containerWidth = window.innerWidth;
    containerHeight = window.innerHeight - toolbarHeight;
  }
  else if (useBodyState.getState().isInlineMode) {
    toolbarHeight = 96;
    containerWidth = window.innerWidth;
    containerHeight = heightOf($container) - toolbarHeight;
  }
  else {
    toolbarHeight = 48;
    containerWidth = widthOf($container);
    containerHeight = heightOf($container) - toolbarHeight;
  }

  var a = parseInt((containerHeight) / current.height * 100 as any);
  var b = parseInt((containerWidth) / current.width * 100 as any);
  ratio = Math.min(a, b);
  offsetY = toolbarHeight / 2 * 100 / ratio;

  if (!current) return;

  cssSet("#detail-image", {
    "transform": `rotate(0deg)`,
    "transition": "none"
  });

  var $detailContainer = q("#detail-container");
  var width = widthOf($detailContainer);
  var height = current && current.height || heightOf($detailContainer);

  offsetY = offsetY || 0;

  if (ratio) {
    useLayoutState.getState().imageSize.zoomRatio = machineryGetRatioNonExp(ratio);
    machineryOnZoomRatioChanged();
    useLayoutState.getState().imageSize.zoomRatioExp = ratio;
    writeScopeField('zoomFitSize', ratio);
  }
  writeScopeField('showLargeImage', true);
  detailZoom()?.focusTo( {
    x: width / 2,
    y: height / 2 + offsetY,
    zoom: parseInt(ratio),
    speed: 0
  });
}

export function machineryZoomIn(event: any): void {
  gridZoomIn(event);
}

export function machineryZoomOut(event: any): void {
  gridZoomOut(event);
}

let setViewModeDebounced: any = null;
