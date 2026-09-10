/**
 * b1-9bz-A：viewOpsService.ts 新建落点——controllerFns 表体归位。
 * 函数体为 makeControllerFns 表内壳逐字平移（getScope()→getBodyScope()）。
 */

import { getBodyScope } from '../core/appCore';
import { detailZoom } from '../core/smoothZoomEngine';
import { syncBodyFromScope } from '../store/bodyState';
import { syncDetailFromScope } from '../store/detailState';
import { syncInspectorFromScope } from '../store/inspectorState';
import { syncToolbarFromScope } from '../store/toolbarState';
import { machineryAdjustLayoutWidth, machineryChangeListHeight, machineryGetSelection, machineryLastZoom, machinerySaveLayout, machinerySmartZoom, machinerySwitchLayout, machineryUpdateZoomRatio, machineryZoom, machineryZoomFit, machineryZoomFitEdge, machineryZoomIn } from '../core/dataMachinery';


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
                  if (getBodyScope().currentFolder) {
                      localStorage.setItem("eagle.list.thumbSize." + getBodyScope().currentFolder.id, height);
                  } else if (getBodyScope().currentSmartFolder) {
                      localStorage.setItem("eagle.list.thumbSize." + getBodyScope().currentSmartFolder.id, height);
                  } else if (getBodyScope().currentTag) {
                      localStorage.setItem("eagle.list.thumbSize." + getBodyScope().currentTag, height);
                  } else if (getBodyScope().viewMode === 'all') {
                      localStorage.setItem("eagle.list.thumbSize.all", height);
                  } else if (getBodyScope().viewMode === 'unfiled') {
                      localStorage.setItem("eagle.list.thumbSize.unfiled", height);
                  } else if (getBodyScope().viewMode === 'untagged') {
                      localStorage.setItem("eagle.list.thumbSize.untagged", height);
                  } else if (getBodyScope().viewMode === 'trash') {
                      localStorage.setItem("eagle.list.thumbSize.trash", height);
                  } else if (getBodyScope().viewMode === 'random') {
                      localStorage.setItem("eagle.list.thumbSize.random", height);
                  } else if (getBodyScope().viewMode === 'recent') {
                      localStorage.setItem("eagle.list.thumbSize.recent", height);
                  }
              }, 150);
          };
};

const getScope = getBodyScope;  // b1-9bz-A：原 makeControllerFns(getScope) 注入的等价别名

export function getRatioExp(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (ratio) {
            if (ratio > 100) {
                ratio = 100 + (ratio - 100) * 7;
            }
            return parseInt(ratio);
        }).apply(null, args);
  }

export function getRatioNonExp(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (ratio) {
            if (ratio > 100) {
                ratio = (ratio - 100) / 7 + 100;
            }
            return ratio;
        }).apply(null, args);
  }

export function lastZoom(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版等价，统一转发消除重复实现。
  const s = getBodyScope();
  if (!s) return;   // 原 c3 体的 scope 守卫，逐字保留
  machineryLastZoom(s);
}

export function smartZoom(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 委托的 detailSmartZoom 逐行等价
  // （差异仅参数名 __lv_target/target、$ → w.$）。
  const s = getBodyScope();
  if (!s) return;   // 原 c3 体的 scope 守卫，逐字保留
  machinerySmartZoom(s, args[0], args[1]);
}

export function switchGridLayout(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            machinerySwitchLayout(s, "GridLayout");
            s.$evalAsync();
            machinerySaveLayout(s, s.currentFolder || s.currentSmartFolder, "GridLayout");
        }).apply(null, args);
  }

export function switchJustifiedLayout(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            machinerySwitchLayout(s, "JustifiedLayout");
            s.$evalAsync();
            machinerySaveLayout(s, s.currentFolder || s.currentSmartFolder, "JustifiedLayout");
        }).apply(null, args);
  }

export function switchListLayout(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            machinerySwitchLayout(s, "ListLayout");
            s.$evalAsync();
            machinerySaveLayout(s, s.currentFolder || s.currentSmartFolder, "ListLayout");
        }).apply(null, args);
  }

export function switchSquareLayout(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            machinerySwitchLayout(s, "SquareLayout");
            s.$evalAsync();
            machinerySaveLayout(s, s.currentFolder || s.currentSmartFolder, "SquareLayout");
        }).apply(null, args);
  }

export function updateZoomRatio(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版等价（beginZoomingTransition 与 c3 的 hasTransition 分支逐行一致）。
  const s = getBodyScope();
  if (!s) return;   // 原 c3 体的 scope 守卫，逐字保留
  machineryUpdateZoomRatio(s, args[0], args[1], args[2], args[3]);
}

export function zoom(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版等价，统一转发消除重复实现。
  const s = getBodyScope();
  if (!s) return;   // 原 c3 体的 scope 守卫，逐字保留
  machineryZoom(s);
}

export function zoomFit(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(event, noAnimation) {
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
                    __lv_saveListHeight(s.imageSize.height);
                }
            } else {
                if (s.VIDEO_TYPES[s.current.ext]) {
                    // 如果是視頻格式，撐滿畫面
                    var mpvPlayer = $(".detail-wrap mpv-video")[0];
                    if (mpvPlayer) {
                        mpvPlayer.scaleMode = 'fit';
                    }
                    else {
                        var $__lv_video = $(".detail-wrap video");
                        if ($__lv_video.length > 0) {
                            $__lv_video.removeClass("fit");
                        }
                    }
                    return;
                }
                s.zoomFitSize = 0;
                s.lastZoomMode = "fit";
                syncDetailFromScope();
                localStorage["eagle.viewer.lastZoomMode"] = s.lastZoomMode;
                s.imageSize.zoomRatio = 100;
                s.imageSize.zoomRatioExp = s.getRatioExp(s.imageSize.zoomRatio);

                if (!noAnimation) {
                    $("#detail-container").addClass("zooming");
                    setTimeout(function () {
                        $("#detail-container").removeClass("zooming");
                    }, 300);
                }

                machinerySmartZoom(s, undefined, true);
            }
        }).apply(null, args);
  }

export function zoomIn(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版等价，统一转发消除重复实现。
  const s = getBodyScope();
  if (!s) return;   // 原 c3 体的 scope 守卫，逐字保留
  machineryZoomIn(s, args[0]);
}

export function getNext(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
        var selection = machineryGetSelection(s);
        var start = selection.start;
        var end = selection.end;
        return s.allData[end + 1] || s.allData[end - 1];
    }).apply(null, args);
  }
