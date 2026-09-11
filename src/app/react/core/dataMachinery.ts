/**
 * c9 数据机器域——EagleController 内部机器移植（scope 函数替换绞杀）。
 *
 * - **sortRawData（bundle 21621-21708 逐字）**：raw 排序 + updateCurrentOrderAndIncrease。
 *   排序语言依赖 languageBCP → root.language 重算（bundle 20053：`languageBCP = $scope.language.replace("_", "-")`，
 *   初值 "en"（19053）。
 * - **getAncestorFolders（bundle 42508 逐字）/ getExtendTags（32028 逐字）**：controller 闭包函数 → 域内移植。
 *
 * - **c9b rebindRefresh 域**：
 *   - rebindRefresh（27366-27454 逐字；async）：calcuteFilterResult 置顶排序 allData/filtereds
 *     重建 + refreshSubfolderList + keywordDebounce 梯度 + updateItemsView + 网格重置 +
 *     HoverPreview 隐藏。calcuteFilterResult/calcuteContainTags/refreshSubfolderList/
 *     updateItemsView 仍由 bundle 承载（经 scope 解析，后续片接管）；resetNgGridLayoutData
 *     为 ngGridLayout 指令 66970 隐式全局（window.*）；calcuteFilterBadge 为域内移植版。
 *   - calcuteFilterBadge（27522-27633 逐字；controller 闭包函数）：纯 eagle.filter.filterBadge
 *     计数（标签/颜色/类型/相机/星等/字体/时间/BPM/标注/网址/以图找图/语义）。
 *   - filterSidebarItem（37967-38001 逐字；controller 闭包函数）：chineseConvert/cartesianProduct/
 *     pinyinlite（re-require 十行成员）+ _.uniq/_.max + String.prototype.score（bundle 2621）。
 *   - rebindRefreshLazy（27007-27013 逐字；1000ms 防抖）/ updateSidebarList（42545-42617 逐字；
 *     20ms 防抖）——rebindRefreshLazyTimeout/updateSidebarListTimeout 域内自管。
 *
 * - **c9c 视图/加载域**：updateItemsView（35065-35072 逐字）、switchLayout（33790-33846 逐字；
 *   relayout/offsetScrollbar/initMenu 经 scope 解析）、prependImages（30524-30538 逐字）+
 *   resetImageData（30540-30548 闭包函数；prependImagesTimeout 域内自管）、reload（42867-42918
 *   逐字；_.debounce(fn,100,true) leading-edge，实例一次性创建）+ autoResizeTagFilter（43119-43128
 *   闭包函数）。
 *
 * - **c9d 缩放/放映/计数/最近文件夹**：getRatioExp（31336）/ getRatioNonExp（31343）纯函数、
 *   updateZoomRatio（31391-31418 逐字；smoothZoom vendor 插件、updateZoomRatioTimeout 域内
 *   自管）、toggleSlideshow（23816）、smartFolderCount（46646；existInSmartFilter/lockImageFilter
 *   经 scope 解析）、getRecentFolders（31969；localStorage recentMoveFolders 逐字键）。
 *   注：unlockPassword 为 scope 字段（非函数），React 侧 5 处读写经桥接/字段解析，无需移植。
 *
 * - **c9e 单条目视图机**：updateItemView（34847-35063 逐字；updateItemsView 循环体）——
 *   metas 十分支（RESOLUTION/FILESIZE/TYPE/MTIME/BTIME/TAGS/RATING）+ 选中/标记/旋转类/
 *   字体激活状态 DOM 更新；依赖 window.* 全局（fileSize/fontFolder/sanitize/installedFonts/
 *   i18n/VIDEO_TYPES 等）+ $filter 经 injector + fs 经 window.require('fs')。checkTouchIDSupport
 *   （29002-29010 逐字）一并替换（React lockState 与 bundle 29014/29109 调用点共用）。
 *
 * - **calculateImageBinding（bundle 28684-28965 逐字）**：核心重建机——duration 1/50 退避逻辑
 *   （重入时退避 50ms）、TagManager.azGroups → $timeout.cancel、$timeout(work,duration)、
 *   work = raw 检查 + sortRawData + 全部 resets + 三次 tree.walk（folderMappings/folderList/pinyin/
 *   tagsSuggestion/ancestorsCache、extendTags/covers、smartFolderMappings）+ raw 循环（itemMappings/
 *   trash/all/exts/untaggedCount/unfiledCount/folders 修复/lockedImages/tags 计数/封面 default map）+
 *   extList→eagle.filter.filterTypes + covers 补全 walk + TagManager.rawdata/pinyinCache/calculateTags +
 *   s.tags + timeEnd + callback + catch）。pinyinCache/calculateImageBindingTimeout 原为 controller
 *   闭包变量 → 域内自管。**scope 函数替换后**，bundle 侧 muteCalcuteImageBinding 等全部
 *   `$scope.calculateImageBinding(...)` 调用面即走本实现（绞杀内部机器）。
 *
 * - **有意略去（无副作用，注释标注）**：`var path = require('path');`（原文内从未使用）。
 *
 * 外部依赖经 window.* live binding（eagle/tinyPinyin/_/FileUrlHelper/AUDIO_TYPES/electronLog），
 * TagManager 经 scope 字段（bundle 48351 `$scope.TagManager = TagManager`）；updateCurrentOrderAndIncrease
 * 复用 controllerFns 移植版（getBodyScope 后端）；$filter/$timeout 经 injector 注入（Angular digest 语义不变）。
 */

import { detailZoom, ensureDetailZoom } from './smoothZoomEngine';
import { machineryBuildTagManager } from './tagManagerDomain';
import { FolderSelectPanel } from '../components/stage7/selectPanelEngine';
import { updateCurrentOrderAndIncrease } from './miscDomain';
import { isInFolder } from './itemDomain';
import { gridSaveListHeight, gridAdjustLayoutWidth, gridZoomFit, gridZoomIn, gridZoomOut, gridSwitchLayout } from '../services/gridService';
import { detailUpdateZoomRatio, detailSmartZoom, detailToggleDetailMode, beginZoomingTransition } from '../services/detailService';
import { machineryAddVideoComment, machineryNextGifFrame, machineryPrevGifFrame, machineryRememberVideoCurrentTime, toggleGifPlay } from '../services/mediaService';
import { debounce, throttle } from '../utils/func';
import { get, isString, max, uniq, unescape, isNumeric } from '../utils/lang';
import { q, qa, qaVisible, widthOf, heightOf, addClass, removeClass, setAttr, cssSet, hide, show, setHtml, hasClass, setHtmlEl, textEl, triggerEl, selectText, onEl, offEl, trigger, clickEl, focusEl, blurEl, selectEl, scrollTopValue, setScrollTop, setScrollLeft, offsetOf, offsetTopOf, outerHeightOf, getAttr, setAttrEl, addClassEl, removeClassEl } from '../utils/domQuery';
import { syncFolderLock } from '../store/lockState';
import { syncUploadFromScope } from '../store/uploadState';
import { syncListFromScope } from '../store/listState';
import { syncPanelFromScope } from '../store/panelState';
import { syncSidebarFromScope } from '../store/sidebarState';
import { syncTagManagerFromScope } from '../store/tagManagerState';
import { syncFilterFromScope } from '../store/filterState';
import { syncBodyFromScope } from '../store/bodyState';
import { syncDetailFromScope } from '../store/detailState';
import { syncInspectorFromScope } from '../store/inspectorState';
import { syncToolbarFromScope } from '../store/toolbarState';
import { getBodyScope } from './appCore';
import { callExternal } from './externalSupply';
import { openFolder, openSmartFolder } from '../services/folderCoreService';
import { select } from '../services/selectionService';
import { uploadFiles } from '../services/uploadService';
import { getRatioExp } from '../services/viewOpsService';
import { resetFilter } from './filterDomain';
import { addToRecentFolders } from '../services/batchOpsService';
import { saveCrop } from '../services/imageOpsService';
import { moveCropToolChannel, openRenameChannel, resizeCropToolChannel } from './../global/bus';
import { autoscrollChannel, calculateImageBindingChannel, glRemoveitemsChannel, importArtstationChannel, inspectorTagSelectPanelOpenChannel, newSmartFolderChannel, openDuplicateScanPanelChannel, openMousewheelPreferenceWindowChannel, openPluginPanelChannel, openUrlInPanelChannel, rebindRefreshChannel, updateInspectorChannel, updateSelectionChannel } from '../global/bus';
import { scopeEvalAsync } from '../global/scopeShim';
import { emojiRegex, escapeRegex, getRemainingFilenameLength, getSanitize, pinyinCache } from '../utils/normalize';
import { machineryColorSimilarityDistance, machineryRgbToHex } from '../utils/color';
import { machineryCloseWindowHandler, machineryDestoryMousetrap, machineryMHandler, machineryModShiftDownHandler, machineryModShiftLeftHandler, machineryModShiftRightHandler, machineryModShiftUpHandler, machineryOpenActionsPanel, machineryOpenQuickSearch } from './keymapActions';
import { machineryBatchRenameFolders, machineryBatchRenameSmartFolders, machineryGetAncestorFolders, machineryGetChildFoldersMaps, machineryGetFolderImages, machineryGetRecentFolders, machineryRefreshRandom, machineryRenameFolder, machineryRenameSmartFolder, machinerySaveFolder } from './libraryDomain';
import { buildScrollbarSaver, machineryAdjustLayoutWidth, machineryChangeListHeight, machineryCurrentIndex, machineryGetArroundBox, machineryGotoBottom, machineryGotoTop, machineryOffsetScrollbar, machineryRelayout, machineryRememberScrollTops, machinerySaveListHeight, machineryScrollbarTo, machinerySwitchLayout, machineryUpdateContainerHieght, machineryUpdateListHeight, machineryUpdateListSlider } from '../services/gridService';
import { machineryCheckOperationSafety, machineryCheckOperationSafety2, machineryGetRatioExp, machineryGetRatioNonExp, machineryLastZoom, machinerySetViewMode, machineryToggleZoom, machineryUpdateZoomRatio, machineryZoom, machineryZoomFitEdge, machineryZoomIn, machineryZoomOut } from '../services/viewOpsService';
import { buildRecentFileManager, machineryAddToRecentFile, machineryGetAllChildFolder, machineryOpenNextFolder, machineryOpenNextSmartFolder, machineryOpenParentFolder, machineryOpenPrevFolder, machineryOpenPrevSmartFolder, machineryOpenRecent, machineryOpenTrash, machineryOpenUnfiled, machineryRemoveFolder, machineryRemoveFolderContents, machineryRemoveFolderInner, machineryRemoveSmartFolder, machineryRemoveSmartFolderInner, machineryResetFolderCover, machinerySetFolderCover, machinerySetLastFolder, machinerySmartFolderCount, machineryToggleAllFolders, machineryToggleCurrentLevelSmartFoldersInner, machineryUpdateSidebarList, openRecentTimeout, openTrashTimeout, openUnfiledTimeout, updateSidebarListTimeout } from './libraryDomain';

import { calculateImageBindingTimeout, machineryCalculateImageBinding, machineryCopyImages, machineryCreateTxtFileFromTemplate, machineryFindDupclipate, machineryForceFitImageSize, machineryGetItemByElement, machineryHideUploadQueue, machineryOnImageSizeHeightChanged, machineryPreloadImage, machineryPrependImages, machineryRebindRefresh, machineryRebindRefreshLazy, machineryShowUploadQueue, machinerySortData, machineryToggleCommentMode, machineryUpdateItemsView, prependImagesTimeout, rebindRefreshLazyTimeout } from './itemDomain';

import { FILTER_ID_MAP, calculateFilterCountsTimeout, getFilter, machineryCalculateFilterCounts, machineryCalcuteFilterBadge, machineryCalcuteFilterResult, machineryColorFilter, machineryContentFilter, machineryExistInSmartFilter, machineryFilterContent, machineryFilterData, machineryGrayColorFilter, machineryToggleFilterByType, machineryUpdateFilterCounts } from './filterDomain';
import { machineryAutoResizeTagFilter, machineryConvertToRegexGroup, machineryMatchWithRegexGroup, machineryOpenAllTags, machineryOpenNextGroup, machineryOpenPrevGroup, machineryOpenUntagged, machineryRefreshSubfolderList, machineryRemoveTagGroup, machineryUpdateSubFolderWidth, openUntaggedTimeout, tagRectSelecting } from './tagManagerDomain';
let timeoutCache: any = null;
let shimTimeoutInst: any = null;
// b1-9k 导出：tagManagerDomain 的裸 getTimeout（1307/1379/1654/1670）此前是死标识符
export function getTimeout(): any {
  if (timeoutCache) return timeoutCache;
  try {
    const ang = (window as any).angular;
    if (ang && ang.element && ang.element(document).injector) {
      timeoutCache = ang.element(document).injector().get('$timeout');
    }
  } catch (err) { /* noop */ }
  // b1-9d：Angular 缺席（shim 世界）→ $timeout 等价物（延时执行 + $evalAsync digest；
  // cancel 句柄表——updateSidebarListTimeout/calculateImageBindingTimeout 等域内自管
  // var 的 cancel 调用面语义不变）
  if (!timeoutCache) {
    if (!shimTimeoutInst) {
      const timers: any = {};
      let seq = 0;
      shimTimeoutInst = function (fn: any, ms?: number) {
        const id = ++seq;
        timers[id] = setTimeout(function () {
          delete timers[id];
          try { if (typeof fn === 'function') fn(); } catch (err) { console.error('[shimTimeout] fn failed', err); }
          try {
            const s = getBodyScope();
            if (s && typeof s.$evalAsync === 'function') scopeEvalAsync();
          } catch (err) { /* noop */ }
        }, ms || 0);
        return id;
      };
      shimTimeoutInst.cancel = function (id: any) {
        if (id != null && timers[id]) { clearTimeout(timers[id]); delete timers[id]; }
      };
    }
    timeoutCache = shimTimeoutInst;
  }
  return timeoutCache;
}

/* languageBCP 重算（bundle 20053 逐字；初值 "en"） */
function getLanguageBCP(s: any): string {
  try {
    const lang = s.language ?? s.$root?.language ?? 'en';
    return String(lang).replace('_', '-');
  } catch (err) {
    return 'en';
  }
}



/* sortRawData（bundle 21621-21708 逐字） */
export function machinerySortRawData(s: any, orderBy: any): void {
  console.time("sortRawData");
  const languageBCP = getLanguageBCP(s);
  switch (orderBy) {
    case 'NAME':
      // 使用 collator 会比直接呼叫 localeCompare 快上 20x 以上
      var collator = new Intl.Collator(languageBCP, { numeric: true, sensitivity: 'base' } );
      s.raw = s.raw.sort(function (a: any, b: any) {
        return collator.compare(a.name, b.name);
      });
      syncListFromScope();
      break;
    case 'EXT':
      var collator2 = new Intl.Collator(languageBCP, { numeric: true, sensitivity: 'base' } );
      s.raw = s.raw.sort(function (a: any, b: any) {
        return collator2.compare(a.ext, b.ext);
      });
      syncListFromScope();
      break;
    case 'RESOLUTION':
      s.raw = s.raw.sort(function(a: any, b: any) {
        var ra = a.width * a.height;
        var rb = b.width * b.height;
        if(ra > rb) return 1;
        if(ra < rb) return -1;
        return 0;
      });
      syncListFromScope();
      break;
    case 'FILESIZE':
      s.raw = s.raw.sort(function(a: any, b: any) {
        var sizeA = parseInt(a.size);
        var sizeB = parseInt(b.size);
        if(sizeA > sizeB) return 1;
        if(sizeA < sizeB) return -1;
        return 0;
      });
      syncListFromScope();
      break;
    case 'RATING':
      s.raw = s.raw.sort(function(a: any, b: any) {
        var starA = parseInt(a.star) || 0;
        var starB = parseInt(b.star) || 0;
        if(starA > starB) return 1;
        if(starA < starB) return -1;
        return 0;
      });
      syncListFromScope();
      break;
    case 'DURATION':
      s.raw = s.raw.sort(function(a: any, b: any) {
        var durationA = parseInt(a.duration) || 0;
        var durationB = parseInt(b.duration) || 0;
        if(durationA > durationB) return 1;
        if(durationA < durationB) return -1;
        return 0;
      });
      syncListFromScope();
      break;
    case 'BTIME':
      s.raw = s.raw.sort(function(a: any, b: any) {
        var btimeA = a.btime || a.modificationTime;
        var btimeB = b.btime || b.modificationTime;
        if(btimeA > btimeB) return -1;
        if(btimeA < btimeB) return 1;
      });
      syncListFromScope();
      break;
    case 'MTIME':
      s.raw = s.raw.sort(function(a: any, b: any) {
        var mtimeA = a.mtime || a.modificationTime;
        var mtimeB = b.mtime || b.modificationTime;
        if(mtimeA > mtimeB) return -1;
        if(mtimeA < mtimeB) return 1;
      });
      syncListFromScope();
      break;
    case 'TAGS':
      // 使用 collator 会比直接呼叫 localeCompare 快上 20x 以上
      var collator3 = new Intl.Collator(languageBCP, { numeric: true, sensitivity: 'base' } );
      s.raw = s.raw.sort(function (a: any, b: any) {
        const aTag1 = a?.tags?.[0] ?? '';
        const bTag1 = b?.tags?.[0] ?? '';
        return collator3.compare(aTag1, bTag1);
      });
      syncListFromScope();
      break;
    default:
      s.raw = s.raw.sort(function(a: any, b: any) {
        var mtimeA = a.modificationTime || a.mtime;
        var mtimeB = b.modificationTime || b.mtime;
        if(mtimeA > mtimeB) return -1;
        if(mtimeA < mtimeB) return 1;
      });
      syncListFromScope();
  }
  updateCurrentOrderAndIncrease();
  console.timeEnd("sortRawData");
}


/* ── c9b：rebindRefresh 域 ───────────────────────────────────────────── */

/* calcuteFilterBadge（bundle 27522-27633 逐字；controller 闭包函数 → 域内移植。
   纯 eagle.filter.* 读写，无 scope 依赖） */

/* filterSidebarItem（bundle 37967-38001 逐字；controller 闭包函数 → 域内移植。
   依赖 chineseConvert/cartesianProduct/pinyinlite（re-require 十行成员，window.* live binding）、
   _.uniq/_.max（vendor 全局）、String.prototype.score（bundle 2621 原型扩展）） */

/* rebindRefresh（bundle 27366-27454 逐字；async。calcuteFilterResult/calcuteContainTags/
   refreshSubfolderList/updateItemsView/getFolderList 等仍由 bundle 承载，经 scope 解析；
   resetNgGridLayoutData = ngGridLayout 指令 66970 隐式全局赋值（window.*）；HoverPreview
   顶层 var（51689）→ window.*；calcuteFilterBadge 为域内移植版） */


/* updateSidebarList（bundle 42545-42617 逐字；20ms 防抖，updateSidebarListTimeout 域内自管。
   getFolderList/getSmartFolderList/getQuickAccessList 仍由 bundle 承载经 scope 解析；
   filterSidebarItem 为域内移植版） */

/* ── c9c：视图/加载域 ───────────────────────────────────────────────── */


/* b1-9be：switchLayout 实现体归位 services/gridService.ts（body class 四分支 +
   relayout/offsetScrollbar/initMenu 仍经 scope 解析） */


/* prependImages（bundle 30524-30538 逐字；prependImagesTimeout 域内自管。
   原码 updateView 参数未使用，逐字保留签名） */


/* reload（bundle 42867-42918 逐字；_.debounce(fn, 100, true) leading-edge 防抖原样复刻，
   防抖实例在 applyDataMachineryScope 时一次性创建（与 bundle controller init 同语义）。
   leaveDetailMode/relayout/updateSelection/calculateFilterCounts/updateSubFolderWidth/
   adjustLayoutWidth 仍由 bundle 承载经 scope 解析；rebindRefresh 已是移植版（scope 解析即达）） */
export function machineryReload(s: any): any {
  const w = window as any;
  return debounce(function reload(keepDetailMode: any) {
    s.hexColor = undefined;
    s.unlockPassword = "";

    if (!keepDetailMode) {
      if (s.isDetailMode) {
        machineryLeaveDetailMode(s);
      }

      if (s.selected.length > 0) {
        s.selected = [];
        syncInspectorFromScope();
      }
    }

    s.loadMoreDisable = false;
    s.lastImageHeight = s.imageSize.height;
    s.boxContianerWidth = widthOf(q("#box-container")) || s.boxContianerWidth;
    machineryRebindRefresh(s);
    machineryRelayout(s);
    machineryUpdateSelection(s);
    machineryCalculateFilterCounts(s);
    machineryUpdateSubFolderWidth(s);
    trigger("#box-container-scrollbar", "UPDATE_BOX_SCROLLBAR");

    machineryAutoResizeTagFilter(s);
    if (s.layout === "GridLayout" || s.layout === "SquareLayout") {
      machineryAdjustLayoutWidth(s, 0);
    }
    s.listDone = true;

    if (scrollTopValue("#box-container") !== 0) {
      setScrollTop("#box-container", 0);
    }
    removeClass(".box.processed", "processed");
    setTimeout(function () {
      show("#image-drop-area");
      trigger("#box-container", "scroll");
    }, 100);
    setTimeout(function () {
      trigger("#box-container", "scroll");
    }, 500);
  }, 100, true);
}

/* ── c9d：缩放/放映/计数/最近文件夹 ──────────────────────────────────── */



/* updateZoomRatio（bundle 31391-31418 逐字；smoothZoom = vendor jQuery 插件；
   updateZoomRatioTimeout 域内自管） */

/* toggleSlideshow（bundle 23816-23823 逐字；enter/leaveSlideshowMode 经 scope 解析） */
export function machineryToggleSlideshow(s: any): void {
  if (!s.isSlideshowMode) {
    machineryEnterSlideshowMode(s);
  } else {
    machineryLeaveSlideshowMode(s);
  }
}



/* updateItemView（bundle 34847-35063 逐字；单条目 DOM 更新机——updateItemsView 循环体。
   依赖：window.* 全局（$/FileUrlHelper/fileSize/fontFolder/sanitize/installedFonts/i18n/
   VIDEO_TYPES/AUDIO_TYPES/FONT_TYPES/SPECIAL_TYPES）、$filter 经 injector（duration/domainName/
   date）、fs 经 window.require('fs')、TagManager/listMetaType 经 scope 字段） */

/* checkTouchIDSupport（bundle 29002-29010 逐字；systemPreferences 经 @electron/remote。
   原码 quirk 逐字保留：非 darwin 平台不写 canUseTouchID（无 else 分支）。bundle 29014/29109
   调用点与 React lockState 流共用本实现） */
export function machineryCheckTouchIDSupport(s: any): void {
  const w = window as any;
  let systemPreferences: any = null;
  try {
    systemPreferences = w.require && w.require('@electron/remote').systemPreferences;
  } catch (err) { /* noop */ }
  if (w.process && w.process.platform === 'darwin' && systemPreferences && systemPreferences.canPromptTouchID) {
    try {
      s.canUseTouchID = systemPreferences.canPromptTouchID();
    } catch (err) {
      console.error('檢查 Touch ID 支援時發生錯誤:', err);
      s.canUseTouchID = false;
    }
  }
}

/* relayout（bundle 27329-27364 逐字；be2 起 ig = window.ig facade（v4 引擎），布局选项
   经 setLayout(label, opts) 通知 facade——v4 sizeRange/gap 由 BoxList 渲染时从 scope 派生） */

/* ── c14：智能文件夹规则匹配域 ───────────────────────────────────────── */

/* MATCH_FUNCTION 表（bundle 32117-32143 逐字；26 规则函数经 window 解析——bundle 8369-9418
   顶层函数（b1 后由 public/vendor/eagle-match-rules.js script 注入供给）） */



/* ── c14b：筛选引擎（filterData 27654-28504 逐字分片）────────────────── */

// ── c14b 域内自管（原 controller 闭包 var：27004/27005）──
let imageSearchController: any = null;
let semanticSearchController: any = null;

/* filterData 分片 1：import 月份/时间、mtime、类型含排、档案大小、长度、BPM、解析度、
   标注、注释（27654-27960 逐字） */

// ── APPEND:c14b-2 ──

/* filterData 分片 2：注释/网址/方向/星等/字体/相机/颜色/关键字/已删排序/random 预筛
   （27960-28170 逐字） */

// ── APPEND:c14b-3 ──

/* filterData 分片 3：标签 OR/AND/EQUAL、文件夹 OR/AND/EQUAL、lockedImages、排序、
   以图找图/语义搜索、recent 排序（28170-28504 逐字） */
export async function machineryFilterDataPart3(s: any, w: any, data: any[]): Promise<any[]> {

  // 如果是 OR 逻辑需要保留所有 tags filter 的结果，为了计算 containTags
  if (w.eagle.filter.tagFilterLogic === "OR") {

    if ((w.eagle.filter.filterRules.tag.includes && w.eagle.filter.filterRules.tag.includes.length > 0) || (w.eagle.filter.filterRules.tag.excludes && w.eagle.filter.filterRules.tag.excludes.length > 0)) {
      data = data.filter(function (image: any) {

        // 包含標籤
        if (w.eagle.filter.filterRules.tag.includes.length > 0) {
          for (var i = 0; i < w.eagle.filter.filterRules.tag.includes.length; i++) {
            var tag = w.eagle.filter.filterRules.tag.includes[i];
            if (image.tags && image.tags.length > 0) {
              for (var j = 0; j < image.tags.length; j++) {
                if (image.tags[j] == tag) {
                  return true;
                }
              }
            }
          }
        }

        // 排除標籤
        if (w.eagle.filter.filterRules.tag.excludes.length > 0) {
          var matchCount = 0;
          for (var i = 0; i < w.eagle.filter.filterRules.tag.excludes.length; i++) {
            var tag = w.eagle.filter.filterRules.tag.excludes[i];
            if (image.tags && image.tags.length > 0) {
              if (image.tags.indexOf(tag) !== -1) {
                matchCount++;
              }
            }
          }
          if (matchCount === 0) {
            return true;
          }
        }
        return false;
      });

      if (w.eagle.filter.filterRules.tag.no) {
        s.preelaborations.forEach(function (image: any) {
          if (!image.tags || image.tags.length === 0) {
            data.push(image);
          }
        });
      }
    }
    else {
      if (w.eagle.filter.filterRules.tag.no) {
        data = data.filter(function (image: any) {
          return !image.tags || image.tags.length === 0;
        });
      }
    }
  }
  // 标签筛选（and 逻辑）
  else if (w.eagle.filter.tagFilterLogic === "AND" || w.eagle.filter.tagFilterLogic === "EQUAL") {

    // 包含標籤
    if (w.eagle.filter.filterRules.tag.includes && w.eagle.filter.filterRules.tag.includes.length > 0) {
      data = data.filter(function (image: any) {
        var matchCount = 0;
        for (var i = 0; i < w.eagle.filter.filterRules.tag.includes.length; i++) {
          var tag = w.eagle.filter.filterRules.tag.includes[i];
          if (image.tags && image.tags.length > 0) {
            for (var j = 0; j < image.tags.length; j++) {
              if (image.tags[j] == tag) {
                if (w.eagle.filter.tagFilterLogic === "EQUAL") {
                  if (image.tags.length === w.eagle.filter.filterRules.tag.includes.length) {
                    matchCount++;
                  }
                }
                else {
                  matchCount++;
                }
                break;
              }
            }
          }
        }
        return (matchCount == w.eagle.filter.filterRules.tag.includes.length);
      });
    }

    // 排除標籤
    if (w.eagle.filter.filterRules.tag.excludes && w.eagle.filter.filterRules.tag.excludes.length > 0) {
      data = data.filter(function (image: any) {
        for (var i = 0; i < w.eagle.filter.filterRules.tag.excludes.length; i++) {
          var tag = w.eagle.filter.filterRules.tag.excludes[i];
          if (image.tags && image.tags.length > 0) {
            if (image.tags.indexOf(tag) !== -1) {
              return false;
            }
          }
        }
        return true;
      });
    }

    // 没标签筛选
    if (w.eagle.filter.filterRules.tag.no) {
      data = data.filter(function (image: any) {
        return !image.tags || image.tags.length === 0;
      });
    }
  }

  // 筛选器文件夹
  // OR
  if (w.eagle.filter.folderFilterLogic === "OR") {

    var filterFolders = Object.values(w.eagle.filter.filterRules.folder.includes).map(function (folder: any) { return folder; });
    var excludeFolders = Object.values(w.eagle.filter.filterRules.folder.excludes).map(function (folder: any) { return folder; });

    if (filterFolders.length > 0 || excludeFolders.length > 0) {

      data = data.filter(function (image: any) {

        // 包含文件夹
        if (filterFolders.length > 0) {
          for (var i = 0; i < filterFolders.length; i++) {
            var folderId = filterFolders[i].id;
            if (folderId === "NoFolders" && image.folders.length === 0) {
              return true;
            }
            if (folderId && image.folders && image.folders.length > 0) {
              for (var j = 0; j < image.folders.length; j++) {
                if (image.folders[j] == folderId) {
                  return true;
                }
              }
            }
          }
        }

        // 排除文件夹
        if (excludeFolders.length > 0) {
          var matchCount = 0;
          for (var i = 0; i < excludeFolders.length; i++) {
            var folderId = excludeFolders[i].id;
            if (folderId === "NoFolders" && image.folders.length === 0) {
              matchCount++;
            }
            if (image.folders && image.folders.length > 0) {
              if (image.folders.indexOf(folderId) !== -1) {
                matchCount++;
              }
            }
          }
          if (matchCount === 0) {
            return true;
          }
        }

        return false;
      });
    }
  }
  // AND
  else if (w.eagle.filter.folderFilterLogic === "AND" || w.eagle.filter.folderFilterLogic === "EQUAL") {

    var filterFolders2 = Object.values(w.eagle.filter.filterRules.folder.includes).map(function (folder: any) { return folder; });
    var excludeFolders2 = Object.values(w.eagle.filter.filterRules.folder.excludes).map(function (folder: any) { return folder; });

    // 包含文件夹
    if (filterFolders2.length > 0) {
      data = data.filter(function (image: any) {
        var matchCount = 0;
        for (var i = 0; i < filterFolders2.length; i++) {
          var folder = filterFolders2[i];
          var folderId = folder.id;
          if (folderId === "NoFolders" && image.folders.length === 0) {
            matchCount++;
          }
          if (folder && image.folders && image.folders.length > 0) {
            for (var j = 0; j < image.folders.length; j++) {
              if (image.folders[j] == folder.id) {
                if (w.eagle.filter.folderFilterLogic === "EQUAL") {
                  if (image.folders.length === filterFolders2.length) {
                    matchCount++;
                  }
                }
                else {
                  matchCount++;
                }
                break;
              }
            }
          }
        }
        return (matchCount === filterFolders2.length);
      });
    }

    // 排除文件夹
    if (excludeFolders2.length > 0) {
      data = data.filter(function (image: any) {
        for (var i = 0; i < excludeFolders2.length; i++) {
          var folderId = excludeFolders2[i].id;
          if (folderId === "NoFolders" && image.folders.length === 0) {
            return false;
          }
          if (image.folders && image.folders.length > 0) {
            if (image.folders.indexOf(folderId) !== -1) {
              return false;
            }
          }
        }
        return true;
      });
    }
  }

  // 如果沒有使用加密文件夾，就不需要判斷這件事情
  if (Object.keys(s.lockedImages).length > 0) {
    data = data.filter(s.lockImageFilter);
  }

  // 文件夹有自己的排序方式
  if (!s.$root.selectedFolders.length && s.currentFolder && s.currentFolder.orderBy) {
    if (s.orderBy !== "IMPORT" || s.currentFolder.orderBy !== s.orderBy) {
      data = machinerySortData(s, data, s.currentFolder.orderBy);
    }
    if (!s.currentFolder.sortIncrease) {
      data = data.reverse();
    }
  }

  // 智能文件夹有自己的排序方式
  else if (s.currentSmartFolder && s.currentSmartFolder.orderBy) {
    if (s.currentSmartFolder.orderBy !== s.orderBy || s.currentSmartFolder.orderBy === "RANDOM") {
      data = machinerySortData(s, data, s.currentSmartFolder.orderBy);
    }
    if (!s.currentSmartFolder.sortIncrease) {
      data = data.reverse();
    }
  }
  else if (!s.sortIncrease && !w.eagle.filter.filterRules.color.value) {
    data = data.reverse();
  }

  // 內部以圖找圖 by id
  if (w.eagle.filter.filterRules.image.itemId || w.eagle.filter.filterRules.image.base64) {
    if (imageSearchController) {
      imageSearchController.abort();
    }
    imageSearchController = new AbortController();
    const imageSignal = imageSearchController.signal;

    try {
      const handle = (w.eagle.filter.filterRules.image.itemId)
        ? w.eagle.aiSearch.searchByItemId(w.eagle.filter.filterRules.image.itemId, { signal: imageSignal })
        : w.eagle.aiSearch.searchByBase64(w.eagle.filter.filterRules.image.base64, { signal: imageSignal });
      const result = await handle;
      const ids: any = {};
      ids[result.eagleId] = {
        score: 1,
        id: result.eagleId
      };
      result.results.forEach((item: any) => {
        if (item.score > 0.1) {
          ids[item.id] = item;
        }
      });

      data = data.filter((item: any) => {
        return ids[item.id];
      }).sort((a: any, b: any) => {
        return ids[b.id].score - ids[a.id].score;
      });
    }
    catch (err: any) {
      if (err.name === 'AbortError') return data;
    }
  }

  // 语义
  if (w.eagle.filter.filterRules.semantic.value) {
    if (semanticSearchController) {
      semanticSearchController.abort();
    }
    semanticSearchController = new AbortController();

    try {
      const result = await w.eagle.aiSearch.searchByText(
        w.eagle.filter.filterRules.semantic.value,
        { signal: semanticSearchController.signal }
      );
      const ids: any = {};
      ids[result.eagleId] = {
        score: 1,
        id: result.eagleId
      };
      result.results.forEach((item: any) => {
        ids[item.id] = item;
      });

      data = data.filter((item: any) => {
        return ids[item.id];
      }).sort((a: any, b: any) => {
        return ids[b.id].score - ids[a.id].score;
      });
    }
    catch (err: any) {
      if (err.name === 'AbortError') return data;
    }
  }

  if (s.viewMode === 'recent') {
    data = data.sort(function (a: any, b: any) {
      return w.RecentFileManager.recentFilesOrder[a.id] - w.RecentFileManager.recentFilesOrder[b.id];
    });
  }

  return data;
}



/* ── c14c：contentFilter / calcuteContainTags / RecentFileManager ───────── */


/* contentFilter（bundle 31804-31896 逐字；isInFolder 复用 controllerFns 移植版，
   RecentFileManager 经 window 解析） */



/* ── c15：选择广播 + 缩放分发 ────────────────────────────────────────── */

/* updateSelection（bundle 34662-34665 逐字） */
// b1-9n：updateSelectionTimeout 为 bundle link var（updateSelection $timeout 防抖句柄）
let updateSelectionTimeout: any = null;

export function machineryUpdateSelection(s: any): void {
  machineryCalls.updateSelection++;
  const w = window as any;
  // shim 世界保留桥：React inspector 面板经 UPDATE_INSPECTOR 刷新（bundle 54678 版无此广播，
  // 其 UI 直接双向绑定 scope.inspector.*——适配注明）
  updateInspectorChannel.emit();

  /* bundle 54678-54826 完整版逐字（双赋值怪癖：34662 简版被本版覆盖——此前只移植了被覆盖的
     简版；inspector 字段派生（newTags/newName/newUrl/newAnnotation/folders/star/size/
     activeTab/category）经 30ms $timeout 防抖写 scope.inspector.*，7d3a 三断言与
     InspectorTagSelectPanel 的 eagle.inspector.newTags 数据源。适配：$scope→s /
     $rootScope→s.$root / $timeout→getTimeout() / $filter→getFilter() / i18n→w.i18n /
     eagle→w.eagle / $bodyScope→getBodyScope()。s.inspector 即 eagle.inspector（bundle
     21615/54307 `$scope.inspector = eagle.inspector` 同引用） */
  getTimeout().cancel(updateSelectionTimeout);
  updateSelectionTimeout = getTimeout()(function () {

    var selected = s.selected;
    if (selected.length > 1) {
      s.inspector.newNamePlaceholder = w.i18n.__("inspector.names.multipleTitles");
      syncInspectorFromScope();
      s.inspector.newUrlPlaceholder = w.i18n.__("inspector.names.multipleUrls");
      syncInspectorFromScope();
      s.inspector.newName = w.eagle.inspector.calculateName(selected);
      syncInspectorFromScope();
      s.inspector.newUrl = w.eagle.inspector.calculateUrl(selected);
      syncInspectorFromScope();
      s.inspector.newTags = w.eagle.inspector.calculateTags(selected);
      syncInspectorFromScope();
      s.inspector.newAnnotation = w.eagle.inspector.calculateAnnotation(selected);
      syncInspectorFromScope();
      s.inspector.folders = w.eagle.inspector.calculateFolders(selected);
      s.inspector.star = w.eagle.inspector.calculateStar(selected);
      syncInspectorFromScope();
      s.inspector.size = w.eagle.inspector.calculateFileSize(selected);
      syncInspectorFromScope();
      s.inspector.activeTab = "ITEM";
      syncInspectorFromScope();
    } else if (selected.length == 1) {
      if (selected[0]) {
        s.inspector.newNamePlaceholder = getFilter()('i18n')("title");
        syncInspectorFromScope();
        s.inspector.newUrlPlaceholder = "http://";
        syncInspectorFromScope();
        s.inspector.newName = selected[0].name || "";
        syncInspectorFromScope();
        s.inspector.newUrl = selected[0].url || "";
        syncInspectorFromScope();
        s.inspector.newTags = selected[0].tags;
        syncInspectorFromScope();
        s.inspector.newAnnotation = selected[0].annotation || "";
        syncInspectorFromScope();
        s.inspector.folders = [];
        s.inspector.star = selected[0].star || 0;
        syncInspectorFromScope();
        s.inspector.activeTab = "ITEM";
        syncInspectorFromScope();
      }
    }
    else {
      s.inspector.activeTab = "SIDEBAR";
      syncInspectorFromScope();
      switch (s.viewMode) {
        case "all":
          s.inspector.category = {
            newName: w.i18n.__('inspector.names.all'),
            newDescription: "",
            createDate: undefined,
            imageCount: getBodyScope().all.length,
            fileSize: w.eagle.inspector.calculateFileSize(getBodyScope().all),
            exportable: false,
            editable: false
          };
          syncInspectorFromScope();
          break;
        case "unfiled":
          s.inspector.category = {
            newName: w.i18n.__('inspector.names.unfiled'),
            newDescription: "",
            createDate: undefined,
            imageCount: getBodyScope().unfiledCount,
            fileSize: w.eagle.inspector.calculateFileSize(getBodyScope().allData),
            exportable: false,
            editable: false
          };
          syncInspectorFromScope();
          break;
        case "untagged":
          s.inspector.category = {
            newName: w.i18n.__('inspector.names.untagged'),
            newDescription: "",
            createDate: undefined,
            imageCount: getBodyScope().untaggedCount,
            fileSize: w.eagle.inspector.calculateFileSize(getBodyScope().allData),
            exportable: false,
            editable: false
          };
          syncInspectorFromScope();
          break;
        case "trash":
          s.inspector.category = {
            newName: w.i18n.__('inspector.names.trash'),
            newDescription: "",
            createDate: undefined,
            imageCount: getBodyScope().allData.length,
            fileSize: w.eagle.inspector.calculateFileSize(getBodyScope().allData),
            exportable: false,
            editable: false
          };
          syncInspectorFromScope();
          break;
        case "duplicate":
          s.inspector.category = {
            newName: getFilter()('i18n')('inspector.names.duplicate'),
            newDescription: "",
            createDate: undefined,
            imageCount: getBodyScope().allData.length,
            fileSize: w.eagle.inspector.calculateFileSize(getBodyScope().allData),
            exportable: false,
            editable: false
          };
          syncInspectorFromScope();
          break;
        default:
          if (s.$root.selectedFolders.length > 0) {
            s.inspector.category = {
              newName: w.i18n.__('inspector.names.multipleTitles'),
              newDescription: "",
              createDate: undefined,
              imageCount: getBodyScope().allData.length,
              fileSize: w.eagle.inspector.calculateFileSize(getBodyScope().allData),
              exportable: false,
              editable: false
            };
            syncInspectorFromScope();
          }
          else if (s.selectedFolderMappings && Object.keys(s.selectedFolderMappings).length >= 1) {
            var selectedFolders = Object.keys(s.selectedFolderMappings).map(function (key) {
              return key;
            });
            if (selectedFolders[0] && s.folderMappings[selectedFolders[0]]) {
              w.eagle.inspector.inspectorFolder = s.folderMappings[selectedFolders[0]];
              s.inspector.category = {
                newName: w.eagle.inspector.inspectorFolder.name,
                newDescription: w.eagle.inspector.inspectorFolder.description || "",
                createDate: w.eagle.inspector.inspectorFolder.modificationTime,
                imageCount: w.eagle.inspector.inspectorFolder.imageCount,
                fileSize: undefined,
                exportable: !(w.eagle.inspector.inspectorFolder.password && !w.eagle.inspector.inspectorFolder.isUnLock),
                editable: !(w.eagle.inspector.inspectorFolder.password && !w.eagle.inspector.inspectorFolder.isUnLock)
              };
              syncInspectorFromScope();
            }
          }
          else if (s.currentFolder) {
            w.eagle.inspector.inspectorFolder = s.currentFolder;
            s.inspector.category = {
              newName: w.eagle.inspector.inspectorFolder.name,
              newDescription: w.eagle.inspector.inspectorFolder.description || "",
              createDate: w.eagle.inspector.inspectorFolder.modificationTime,
              imageCount: getBodyScope().allData.length,
              fileSize: w.eagle.inspector.calculateFileSize(getBodyScope().allData),
              exportable: true,
              editable: true
            };
            syncInspectorFromScope();
          }
          else if (s.currentSmartFolder) {
            s.inspector.category = {
              newName: s.currentSmartFolder.name,
              newDescription: s.currentSmartFolder.description || "",
              createDate: s.currentSmartFolder.modificationTime,
              imageCount: getBodyScope().allData.length,
              fileSize: w.eagle.inspector.calculateFileSize(getBodyScope().allData),
              exportable: true,
              editable: true
            };
            syncInspectorFromScope();
          }
      }
    }

    // 排序標籤，優先使用群組順序排，皆者使用字母順序排
    if (s.inspector.newTags.length > 0) {
      s.inspector.newTags = sortTagsForSelection(s, s.inspector.newTags);
      syncInspectorFromScope();
    }
  }, 30);
}

/* sortTags（bundle 54828 逐字；$scope→s。try/catch 原码自带——tagMappings 缺项不炸派生） */
function sortTagsForSelection(s: any, original: any): any {
  try {
    if (!original || original.length === 0) return;
    let tags = [...original];

    const tagGroupsIndexMap: any = {};
    s.TagManager.groups.forEach((tagGroup: any, index: any) => {
      tagGroupsIndexMap[tagGroup.id] = index;
    });

    tagGroupsIndexMap['none'] = s.TagManager.groups.length;

    tags = tags.sort((tagA: any, tagB: any) => {
      const a = s.TagManager.tagMappings[tagA];
      const b = s.TagManager.tagMappings[tagB];
      const aName = a.name;
      const bName = b.name;
      const aGroup = a?.groups?.[0] || 'none';
      const bGroup = b?.groups?.[0] || 'none';

      // sort by groups index, if same group, sort by name
      if (tagGroupsIndexMap[aGroup] < tagGroupsIndexMap[bGroup]) return -1;
      if (tagGroupsIndexMap[aGroup] > tagGroupsIndexMap[bGroup]) return 1;
      if (aName < bName) return -1;
      if (aName > bName) return 1;
      return 0;
    });

    return tags;
  } catch (err) {
    console.error(err);
    return original;
  }
}


/* ── c15b：列表高度/缩放适配 ─────────────────────────────────────────── */

/* b1-9bd：saveListHeight 实现体归位 services/gridService.ts——此处仅存委托壳
   （machinery 内部其余 2 处直调点与 scope 挂载面不变）。 */



/* ── c15c：选择定位/侧栏索引/页面重置/筛选计数 ───────────────────────── */

/* getSelection（bundle 36632-36649 逐字） */
export function machineryGetSelection(s: any): any {
  var arr: any[] = [];
  s.selected.forEach(function (image: any) {
    var idx = s.allData.indexOf(image);
    if (idx != -1) {
      arr.push(idx);
    }
  });
  var invert = arr[0] > arr[1];
  arr = arr.sort(function (a: any, b: any) {
    return a - b;
  });
  return {
    start: arr[0],
    end: arr[arr.length - 1],
    invert: invert
  };
}


/* resetPage（bundle 36668-36700 逐字；resetFilter/findDupclipate 经 scope 解析，
   eagle.inspector.reset 经 c12 挂载面，ig.clear 经 window） */
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
    machineryFindDupclipate(s, undefined);
  }
}

/* calculateFilterCounts（bundle 42929-42944 逐字；calculateFilterCountsTimeout 域内自管，
   updateFilterCounts 经 scope 解析） */

/* ── c15d：openAll 及支撑链 ──────────────────────────────────────────── */

// ── c15d 域内自管（原 controller 闭包 var）──
let openAllTimeout: any = null;

/* setViewMode（bundle 38475-38479 逐字；_.debounce 500——防抖实例为模块级单例，与 bundle
   controller init 同语义） */




/* openAll（bundle 36702-36733 逐字；openAllTimeout 域内自管；UrlStateService 经 scope
   解析（bundle 20208 $scope 赋值）——post-b1 Angular $location 缺席为诚实缺口，该服务
   移植随 c16 详情族定 $location shim 方案） */
export function machineryOpenAll(s: any, ignoreHistory: any, callback: any): void {
  const w = window as any;
  const $timeout = getTimeout();

  if (s.viewMode === 'all' && s.allData.length > 0 && w.eagle.filter.filterRules.color.value == undefined) {
    if (callback) {
      callback();
    }
    if (s.isDetailMode) {
      machineryLeaveDetailMode(s);
    }
    return;
  }

  w.ScrollbarSaver.saveScrollPosition();

  s.viewMode = 'all';
  s.$root.currentFocus = "sidebar";
  machineryResetPage(s);

  $timeout.cancel(openAllTimeout);
  openAllTimeout = $timeout(function () {
    if (!ignoreHistory) {
      s.UrlStateService.setState({ view: 'all', folder: null, smartfolder: null, tag: null, color: null });
    }
    s.imageSize.height = localStorage.getItem("eagle.list.thumbSize.all") || 150;
    syncToolbarFromScope();
    syncBodyFromScope();
    syncDetailFromScope();
    syncInspectorFromScope();
    s.imageSize.height = parseInt(s.imageSize.height);
    // b1-9bz-C-4：原 $watch("imageSize.height") 在 flush 时触发 —— 改为写入点直调
    machineryOnImageSizeHeightChanged(s);
    syncToolbarFromScope();
    syncBodyFromScope();
    syncDetailFromScope();
    syncInspectorFromScope();
    machinerySetLastFolder(s, undefined);
    machineryUpdateListHeight(s, s.imageSize.height);
    w.ScrollbarSaver.restoreScrollPosition();
    setScrollTop("#sidebar-item-container", 0);
    s.reload();
    if (callback) {
      callback();
    }
    w.analytics.screenView('All');
  }, 50);
}

/* ── c16a：详情模式进出 ──────────────────────────────────────────────── */

// ── c16a 域内自管（原 controller 闭包 var：zoomInitTimeout，31586）──
let zoomInitTimeout: any = null;

/* enterDetailMode（bundle 31587-31664 逐字；smoothZoom = vendor jQuery 插件；
   lastZoom/preloadImage/addToRecentFile 经 scope 解析；removePlayingAudios/HoverPreview
   经 window（bundle 顶层——b1 后随 hover-preview 字节提取片供给）；initDetailMode/
   smoothZoomDone 为 scope 字段） */
export function machineryEnterDetailMode(s: any, $event: any, image: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  cssSet("#detail-container", { opacity: 0 });

  var duration = 100;
  if (s.isInlineMode) {
    duration = 50;
  }

  if (s.selected.length <= 0) return;
  image = image || s.selected[s.selected.length - 1];
  s.isDetailMode = true;
  s.current = image;
  syncDetailFromScope();
  syncInspectorFromScope();
  s.selected = [image];
  syncInspectorFromScope();
  s.showDetailImage = true;
  syncDetailFromScope();
  // 移除 $scope.zoom(image) — 此時 Angular 尚未跑 digest，
  // body 還沒有 is-detail-mode class，$(".content-panel").width() 讀到的是列表模式尺寸，
  // 算出的 zoom 一定是錯的。正確的 zoom 會在下方 $timeout 回調中執行。
  w.eagle.inspector.activeTab = "ITEM";
  s.smoothZoomDone = false;
  syncDetailFromScope();
  // bundle 依赖 Angular digest：ng-click 处理器返回后本轮 digest 立即把 body 的
  // is-detail-mode 落到 DOM，100ms 后的 smoothZoom 初始化才量得到详情面板尺寸。
  // shim 世界的 body 类走 watcher flush → store → React effect，若不在此显式 flush，
  // 初始化会赶在类名之前跑，#bitmap-viewer 高度为 0 → BitmapViewer 不建 canvas、
  // 无瓦片 → 详情原图交付闸门超时（m1 detail original delivery）。
  scopeEvalAsync();

  $timeout.cancel(zoomInitTimeout);
  zoomInitTimeout = $timeout(function () {
    if (!s.initDetailMode) {
      s.initDetailMode = true;
      syncDetailFromScope();
      ensureDetailZoom({
        width: '100%',
        height: '100%',
        responsive: true,
        mouse_WHEEL: true,
        mouse_DOUBLE_CLICK: false,
        zoom_BUTTONS_SHOW: false,
        pan_BUTTONS_SHOW: false,
        background_COLOR: 'transparent',
        border_SIZE: 0,
        animation_SMOOTHNESS: 0,
        animation_SPEED_ZOOM: 0,
        animation_SPEED_PAN: 0,
        zoom_MAX: 800,
        zoom_MIN: 5,
        on_IMAGE_LOAD: function () {
          $timeout(function () {
            window.dispatchEvent(new Event("orientationchange"));
            s.showDetailImage = true;
            syncDetailFromScope();
            s.smoothZoomDone = true;
            syncDetailFromScope();
            if (!machineryLastZoom(s)) {
              machineryZoom(s, image);
            }
            detailZoom()?.updateNavigator( s.current);

            cssSet("#detail-container", { opacity: 1 });
            show(".smooth_zoom_preloader");

            // 如果用户没有设置过 mousewheel 偏好
            if (!s.$root.preferences.habits.scrollBehaviorTour) {
              q(".smooth_zoom_preloader")?.addEventListener("wheel", function () {
                openMousewheelPreferenceWindowChannel.emit();
              }, { once: true });
            }
          }, 100);
        }
      });
    } else {
      s.smoothZoomDone = true;
      syncDetailFromScope();
      detailZoom()?.updateNavigator( s.current);
      window.dispatchEvent(new Event("orientationchange"));
      if (!machineryLastZoom(s)) {
        machineryZoom(s, image);
      }
      cssSet("#detail-container", { opacity: 1 });
      setTimeout(function () {
        machineryPreloadImage(s, "next");
      }, 200);
    }
    machineryAddToRecentFile(s, s.current);
    w.removePlayingAudios();
    w.HoverPreview.hide();
  }, duration);
}

/* leaveDetailMode（bundle 31680-31726 逐字；rememberScrollTops/rememberVideoCurrentTime/
   fadeOutDetailMode/initMousetrap 经 window/scope 解析——initMousetrap 归键盘域后续片；
   gifUpadteInterval 原码 typo 逐字保留） */
export function machineryLeaveDetailMode(s: any): void {
  const w = window as any;
  const $timeout = getTimeout();

  s.isCropMode = false;
  syncDetailFromScope();
  s.usingGifPlayer = false;
  syncDetailFromScope();
  if (s.isDetailMode) {

    machineryRememberScrollTops(s, s.current);

    s.isDetailMode = false;
    s.showDetailImage = false;
    syncDetailFromScope();
    s.smoothZoomDone = false;
    syncDetailFromScope();
    s.commentRect = undefined;
    syncDetailFromScope();
    // 記住上次播放位置
    machineryRememberVideoCurrentTime(s, s.current); s.current = undefined;
    syncDetailFromScope();
    syncInspectorFromScope();
    $timeout.cancel(zoomInitTimeout);

    setTimeout(function () {
      if (s.isDetailMode) return;
      removeClass(".content-panel.detail-mode", "inline-mode open");
      setScrollLeft(".smooth_zoom_preloader", 0);
    }, 50);

    s.isInlineMode = false;
    machineryFadeOutDetailMode(s);
    detailZoom()?.cleanBitmapViewer();
    detailZoom()?.clearPreloadData();

    if (s.isGifReady === true) {
      s.isGifReady = false;
      syncDetailFromScope();
      delete s.gifViewer.frames;
      s.gifViewer.frames = [];
      syncDetailFromScope();
      s.gifViewer.mousedownTime = 0;
      syncDetailFromScope();
      s.gifViewer.mousedownX = 0;
      syncDetailFromScope();
      s.gifViewer.mousedownY = 0;
      syncDetailFromScope();
      s.gifViewer.range = undefined;
      syncDetailFromScope();
      s.gifPlayer = undefined;
      syncDetailFromScope();
    }

    w.initMousetrap ? w.initMousetrap() : machineryInitMousetrap(s);
    clearInterval(s.gifUpadteInterval);
  }
}

/* ── c16c：saveFolder ────────────────────────────────────────────────── */

/* saveFolder（bundle 42399-42467 逐字；cloneTree 经 window（c10a-2）、IPCHelper 经
   window（shims 顶层词法上 window，libraryDomain 同一消费模式）、appRoot.path = app-root-path
   模块的 path 属性、TagManager 经 scope） */

/* ── c16d：键盘域（buildMousetrap/destoryMousetrap/initMousetrap）──────── */

/* buildMousetrap（bundle 49177-49314 逐字；handlers 全部 $scope.* → s.*；preferences 经
   window（var live binding）、ShortcutManager/Mousetrap 为 vendor script（b1 存活）。
   返回 bindings 映射——由 mgo-mousetrap 指令消费绑定，与 bundle 同语义） */
export function machineryBuildMousetrap(s: any): any {
  const w = window as any;
  const bindings: any = {};

  // 建立快捷鍵名稱到處理函數的映射
  const shortcutHandlerMap: any = {
    'player.playAndPause': () => {
      machineryQuicklook(s);
    },
    'player.prev1frame': () => {
      machineryPrevGifFrame(s, 1);
    },
    'player.next1frame': () => {
      machineryNextGifFrame(s, 1);
    },
    'player.prev10frame': () => {
      machineryPrevGifFrame(s, 10);
    },
    'player.next10frame': () => {
      machineryNextGifFrame(s, 10);
    },
    'player.speed.up': () => {
      let playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4, 8];
      if (s.current.ext == 'gif') {
        let currnt = s.gifViewer.speed;
        let idx = playbackRates.indexOf(currnt);
        if (idx !== -1 && playbackRates[idx + 1]) {
          s.gifViewer.setSpeed(playbackRates[idx + 1]);
        }
      }
    },
    'player.speed.down': () => {
      let playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4, 8];
      if (s.isDetailMode) {
        if (s.current.ext == 'gif') {
          let currnt = s.gifViewer.speed;
          let idx = playbackRates.indexOf(currnt);
          if (idx !== -1 && playbackRates[idx - 1]) {
            s.gifViewer.setSpeed(playbackRates[idx - 1]);
          }
        }
      }
    },
    'player.thumbnail.set': () => { }, // 不做任何事情，但需要把這個快速鍵還給其它有綁定的人
    'player.thumbnail.copy': () => { }, // 不做任何事情，但需要把這個快速鍵還給其它有綁定的人
    'player.thumbnail.save': () => { }, // 不做任何事情，但需要把這個快速鍵還給其它有綁定的人
  };

  // 從 preferences 載入快捷鍵
  if (w.preferences && w.preferences.shortcuts && w.preferences.shortcuts.keybinds && w.ShortcutManager) {
    for (const [keyName, electronKey] of Object.entries(w.preferences.shortcuts.keybinds)) {
      if (shortcutHandlerMap[keyName] && electronKey) {
        const mousetrapKey = w.ShortcutManager.electronToMousetrap(electronKey);
        if (mousetrapKey) {
          bindings[mousetrapKey] = shortcutHandlerMap[keyName];
          // console.log(`[Preview] Mapped ${keyName}: ${electronKey} -> ${mousetrapKey}`);
        }
      }
    }
  }

  // 添加硬編碼的快捷鍵（未在 preferences 中定義或沒有對應設定的）
  const hardcodedShortcuts: any = {
    '*': (folders: any, isExpand: any) => machineryToggleAllFolders(s, folders, isExpand),
    '/': (folders: any, isExpand: any) => machineryToggleAllFolders(s, folders, isExpand),
    '-': (event: any) => machineryZoomOut(s, event),
    '+': (event: any) => machineryZoomIn(s, event),
    '=': (event: any) => machineryZoomIn(s, event),
    '0': () => machineryRemoveStar(s),
    '1': (event: any) => machineryChangeTo1Star(s, event),
    '2': (event: any) => machineryChangeTo2Star(s, event),
    '3': (event: any) => machineryChangeTo3Star(s, event),
    '4': (event: any) => machineryChangeTo4Star(s, event),
    '5': (event: any) => machineryChangeTo5Star(s, event),
    'r': () => machineryRefreshRandom(s),
    't': () => machineryOpenInspectorTagSelectPanel(s),
    'g': (event: any) => machineryOpenActionsPanel(s, event),
    'f': (event: any) => machineryOpenInspectorFolderSelectPanel(s, event),
    'j': (event: any) => machineryOpenQuickSearch(s, event),
    'n': ($event: any) => machineryNHandler(s, $event),
    'm': ($event: any) => machineryMHandler(s, $event),
    'mod+z': () => machineryUndo(s),
    'mod+a': (event: any) => machinerySelectAll(s, event),
    'mod+c': (event: any) => machineryCopyImages(s, event),
    'mod+w': ($event: any) => machineryCloseWindowHandler(s, $event),
    'space': (event: any) => machineryQuicklook(s, event),
    'shift+space': getPageUpHandlerFn(s),
    'c': (event: any) => machineryKeyCHandler(s, event),
    'p': (event: any) => machineryKeyPHandler(s, event),
    'a': (event: any) => machineryKeyLeftHandler(s, event),
    'd': (event: any) => machineryKeyRightHandler(s, event),
    'w': (event: any) => machineryKeyUpHandler(s, event),
    's': (event: any) => machineryKeyDownHandler(s, event),
    'left': (event: any) => machineryKeyLeftHandler(s, event),
    'right': (event: any) => machineryKeyRightHandler(s, event),
    'up': (event: any) => machineryKeyUpHandler(s, event),
    'shift+up': (event: any) => machineryMultipleSelectUp(s, event),
    'down': (event: any) => machineryKeyDownHandler(s, event),
    'shift+down': (event: any) => machineryMultipleSelectDown(s, event),
    'shift+right': (event: any) => machineryMultipleSelectNext(s, event),
    'shift+left': (event: any) => machineryMultipleSelectPrev(s, event),
    'mod+up': (event: any) => machineryModUpHandler(s, event),
    'mod+down': (event: any) => machineryModDownHandler(s, event),
    'mod+left': (event: any) => machineryModLeftHandler(s, event),
    'mod+right': (event: any) => machineryModRightHandler(s, event),
    'mod+shift+up': (event: any) => machineryModShiftUpHandler(s, event),
    'mod+shift+down': (event: any) => machineryModShiftDownHandler(s, event),
    'mod+shift+left': (event: any) => machineryModShiftLeftHandler(s, event),
    'mod+shift+right': (event: any) => machineryModShiftRightHandler(s, event),
    'backspace': () => machineryBack(s),
    'alt+right': () => machineryNextHistory(s),
    'alt+left': () => machineryPrevHistory(s),
    'mod+s': () => machinerySaveHandler(s),
    '`': (event: any) => machineryToggleZoom(s, event),
    'mod++': (event: any) => machineryZoomIn(s, event),
    'mod+-': (event: any) => machineryZoomOut(s, event),
    'tab': ($event: any) => machineryToggleAll(s, $event),
    'alt+up': () => machineryOpenParentFolder(s),
    'alt+shift+n': (event: any) => machineryCreateTxtFileFromTemplate(s, event),
    'alt+shift+c': () => machinerySetFolderCover(s),
    'enter': ($event: any, isInline: any) => machineryToggleDetailMode(s, $event, isInline),
    'del': (event: any) => machineryRemoveSelected(s, event),
  };

  // 合併硬編碼快捷鍵（如果沒有被 preferences 覆蓋）
  for (const [key, handler] of Object.entries(hardcodedShortcuts)) {
    if (!bindings[key]) {
      bindings[key] = handler;
    }
  }

  // 處理 'mod+plus' 的特殊情況（確保 + 號的快捷鍵都能正常工作）
  if (bindings['mod+='] && !bindings['mod+plus']) {
    bindings['mod+plus'] = bindings['mod+='];
  }

  console.log('[App] Total mousetrap bindings:', Object.keys(bindings).length);
  return bindings;
}

/* destoryMousetrap（bundle 49316-49325 逐字；destory 原码 typo 逐字保留） */
/* initMousetrap（bundle 49326-49330 逐字） */
export function machineryInitMousetrap(s: any): void {
  machineryDestoryMousetrap(s);
  s.mousetrap = machineryBuildMousetrap(s);
  // b1-9av：mousetrap 绑定消费端补移植（bundle 49326-49341 逐字——原由 mgo-mousetrap
  // 指令 + 本函数双承载，Angular 消亡后 map 无人 bind，全键盘层死：Enter/方向键/Del/
  // Mod+Z/空格 quicklook 等）。applyWrapper 逐字：throttle 25 + $evalAsync。
  const w = window as any;
  const Mousetrap = w.Mousetrap;
  if (!Mousetrap || !s.mousetrap) return;
  const applyWrapper = function (func: any) {
    return w.throttle(function (e: any) {
      func(e);
      scopeEvalAsync();
    }, 25);
  };
  for (var key in s.mousetrap) {
    if (s.mousetrap.hasOwnProperty(key)) {
      Mousetrap.unbind(key);
      Mousetrap.bind(key, applyWrapper(s.mousetrap[key]));
    }
  }
}

/* ── c17b：notify（cgNotify 服务等价移植）────────────────────────────── */

// ── c17b 域内自管（cgNotify 闭包状态 f/g/h/l/m/n + undoTimeout 20255 邻域）──
const cgStack: any[] = [];        // m：已附加的消息元素栈
const cgScopes: any[] = [];       // n：scope 桩栈
const CG_START_TOP = 10;          // f
const CG_SPACING = 15;            // g
let undoTimeout: any = null;

/* angular-notify.html 模板（bundle 16724 templateCache 逐字；ng-class/ng-style/ng-show/
   ng-click 以具体值物化） */
function cgBuildTemplate(position: string, classes: string, centerMargin: string | null, message: string, messageTemplate: string | undefined, onClose: () => void): string {
  const posClass = position === 'center' ? 'cg-notify-message-center' : (position === 'left' ? 'cg-notify-message-left' : (position === 'right' ? 'cg-notify-message-right' : ''));
  const ngClass = `[${classes ? `'${classes}', ` : ''}'${posClass}']`.replace(/'/g, '"');
  const styleAttr = centerMargin !== null ? ` style="margin-left: ${centerMargin};"` : '';
  const messageDiv = messageTemplate !== undefined
    ? `    <div style="display: none;">\n    </div>\n\n    <div class="cg-notify-message-template">\n    </div>`
    : `    <div>\n        ${message}\n    </div>\n\n    <div style="display: none;" class="cg-notify-message-template">\n        \n    </div>`;
  return `<div class="${[classes, posClass].filter(Boolean).join(' ')}"${styleAttr}>` +
    messageDiv +
    `    <button type="button" class="cg-notify-close">` +
    `        <span aria-hidden="true">&times;</span>` +
    `        <span class="cg-notify-sr-only">Close</span>` +
    `    </button>` +
    `</div>`;
}

/* cgNotify restack（bundle 16724 内 i() 逐字：startTop 10 / spacing 15 / closing +20） */
function cgRestack(): void {
  let b = CG_START_TOP;
  for (let c = cgStack.length - 1; c >= 0; c--) {
    const d = 10;
    const e: any = cgStack[c];
    const h = e.offsetHeight;
    let i = b + h + d;
    if (e.getAttribute('data-closing')) i += 20; else b += h + CG_SPACING;
    e.style.top = i + 'px';
    e.style.marginTop = '-' + (h + d) + 'px';
    e.style.visibility = 'visible';
  }
}

/* notify（$rootScope.notify 20157-20191 + cgNotify 服务核心 16724 等价移植。
   ng-click="closeAll();undo();" 以委托 click 复刻（undo = $rootScope.undo 桩，duration+5000
   后置空，undoTimeout 域内自管）；templateUrl '' → bundle 走 $http 缓存缺省模板，本移植直接
   物化同一模板 DOM） */
export function machineryNotify(s: any, params: any, restoreCallbackk: any): void {
  const w = window as any;
  const $timeout = getTimeout();

  if (!params.message) return;

  const i18nUndo = getFilter()('i18n')("notify.button.undo");
  let messageTemplate = `<span><icon class="${params.status || ''}"></icon>` + params.message;
  if (restoreCallbackk) {
    messageTemplate = messageTemplate + ' <a style="margin-left: 10px;" data-cg-undo="true">' + i18nUndo + '</a></span>';
  } else {
    messageTemplate = messageTemplate + '</span>';
  }

  cgNotifyServiceCloseAll();

  $timeout(function () {
    var duration = params.duration || 4000;

    // ── cgNotify 服务核心（16724 逐字语义）──
    const message = params.message;
    const classes = params.classes || '';
    const position = params.position || 'center';
    const useTemplate = true; // $rootScope.notify 恒传 messageTemplate

    const holder = document.createElement('div');
    holder.innerHTML = cgBuildTemplate(position, classes, null, message, messageTemplate, () => { });
    const element: any = holder.firstElementChild;
    // undo 锚点：ng-click="closeAll();undo();" 等价委托
    element.addEventListener('click', function (ev: any) {
      const t = ev.target as Element;
      if (!t || !t.closest('[data-cg-undo]')) return;
      cgNotifyServiceCloseAll();
      const undo = s.$root.undo;
      if (typeof undo === 'function') undo();
    });
    // 关闭按钮：ng-click="$close()" 等价委托
    element.addEventListener('click', function (ev: any) {
      const t = ev.target as Element;
      if (!t || !t.closest('.cg-notify-close')) return;
      element.style.opacity = 0;
      element.setAttribute('data-closing', 'true');
      cgRestack();
    });
    // transitionend（opacity）→ remove + 出栈 + restack（bundle 16724 同语义）
    element.addEventListener('transitionend', function (a: any) {
      if (a.propertyName === 'opacity' || element.style.opacity === '0' || (a.originalEvent && 'opacity' === a.originalEvent.propertyName)) {
        element.remove();
        const mi = cgStack.indexOf(element);
        if (mi > -1) cgStack.splice(mi, 1);
        cgRestack();
      }
    });
    // messageTemplate 注入 .cg-notify-message-template
    const tpl = element.querySelector('.cg-notify-message-template');
    if (tpl) {
      const span = document.createElement('span');
      span.innerHTML = messageTemplate;
      while (span.firstChild) tpl.appendChild(span.firstChild);
    }
    document.body.appendChild(element);
    cgStack.push(element);
    if (position === 'center') {
      $timeout(function () {
        element.style.marginLeft = '-' + element.offsetWidth / 2 + 'px';
      });
    }
    const closeSelf = function () {
      element.style.opacity = 0;
      element.setAttribute('data-closing', 'true');
      cgRestack();
    };
    $timeout(function () { cgRestack(); });
    if (params.duration !== 0 && (params.duration || 10000) > 0) {
      $timeout(closeSelf, params.duration || 10000);
    }

    if (restoreCallbackk) {
      s.$root.undo = restoreCallbackk;
    } else {
      s.$root.undo = function () { };
    }
    // 如果使用者超過時間沒有點擊反悔，就把 callback 移除，避免發生錯亂
    clearTimeout(undoTimeout);
    undoTimeout = setTimeout(function () {
      s.$root.undo = function () { };
    }, duration + 5000);

  }, 10);
}

/* cgNotify closeAll（bundle 16724 o.closeAll 逐字：全栈 opacity 0） */
function cgNotifyServiceCloseAll(): void {
  for (let a = cgStack.length - 1; a >= 0; a--) {
    cgStack[a].style.opacity = 0;
  }
}

/* ── c18a：smartZoom/lastZoom（详情智能缩放）──────────────────────────── */


/* smartZoom（bundle 31209-31334 逐字；devicesMetrics/isMobileResolution/getImagePixelDensity/
   isMobileWidth 经 window（c18a 供给），zoomRatio 换算走 machinery 版） */

/* ── c18b：详情缩放余部（zoomActual/toggleZoom/zoomFitEdge/updateContainerHieght）── */





/* ── c18c：历史导航/撤销 ─────────────────────────────────────────────── */

/* undo（bundle 26999-27002 逐字；$rootScope.undo 桩 + closeAll——root 上无 closeAll 时
   走 cg 栈清屏等价） */
export function machineryUndo(s: any): void {
  if (typeof s.$root.undo === 'function') s.$root.undo();
  if (typeof s.$root.closeAll === 'function') s.$root.closeAll();
  else cgNotifyServiceCloseAll();
}

/* nextHistory/prevHistory（bundle 38566-38577 逐字；UrlStateService.canGo* 方法存在性
   判定原样保留，goForward/goBack 经 currentWindow） */
export function machineryNextHistory(s: any): void {
  const w = window as any;
  if (s.UrlStateService.canGoForward) {
    w.currentWindow.webContents.goForward();
  }
}

export function machineryPrevHistory(s: any): void {
  const w = window as any;
  if (s.UrlStateService.canGoBack) {
    w.currentWindow.webContents.goBack();
  }
}

/* back（bundle 30889-30896 逐字） */
export function machineryBack(s: any): void {
  if (!s.isDetailMode) {
    machineryPrevHistory(s);
  }
  else {
    machineryLeaveDetailMode(s);
  }
}

/* ── c18d：全选/详情切换 ─────────────────────────────────────────────── */

// ── c18d 域内自管（原 controller 闭包 var：cleanSelectedTimeout，46644 邻域）──
let cleanSelectedTimeout: any = null;

/* selectAll（bundle 46628-46645 逐字） */
export function machinerySelectAll(s: any, event: any): void {
  const $timeout = getTimeout();
  event && event.stopPropagation();
  if (s.viewMode == 'alltags') {
    s.selectedTags = {};
    syncTagManagerFromScope();
    s.TagManager.tagsResult.tags.forEach((tagName: any) => {
      s.selectedTags[tagName] = true;
      syncTagManagerFromScope();
    });
  }
  else {
    var selected: any[] = [];
    Array.prototype.push.apply(selected, s.allData);
    s.selected = selected;
    syncInspectorFromScope();
    s.selectedMappings = {};
    $timeout.cancel(cleanSelectedTimeout);
    s.$root.currentFocus = "content";
  }
}

/* toggleDetailMode（bundle 31005-31029 逐字；saveCrop/renameCurrentFolder/openFolder
   经 scope 解析） */
export function machineryToggleDetailMode(s: any, $event: any, isInline: any): void {
  detailToggleDetailMode(s, $event, isInline);
}

/* ── c18e-1：选择导航（selectNext/selectPrev）────────────────────────── */

// ── c18e-1 域内自管（原 controller 闭包 var：nextTimeout 36419 邻域 / prevTimeout 36536 邻域）──
let nextTimeout: any = null;
let prevTimeout: any = null;

/* selectNext（bundle 36382-36444 逐字；getSelection/lastZoom 已 machinery 版经 scope 解析，
   autoScroll/forceFitImageSize/preloadImage/addToRecentFile 为 bundle scope 函数经 scope 解析） */
export function machinerySelectNext(s: any, event: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  if (s.isCropMode) {
    moveCropToolChannel.emit({ horizontal: 1, vertical: 0 });
    return;
  }

  var selection = machineryGetSelection(s);
  var start = selection.start;
  var end = selection.end + 1;

  if (s.isDetailMode) {
    machineryRememberScrollTops(s, s.current);
  }

  if (!s.allData[end]) {
    show("#is-last-item");
    setTimeout(() => { hide("#is-last-item"); }, 500);
    return;
  }
  else {
    detailZoom()?.cleanBitmapViewer();
  }

  s.selected = [s.allData[end]];
  syncInspectorFromScope();
  s.selectedFolderMappings = {};
  syncListFromScope();
  s.$root.currentFocus = "content";

  if (s.isDetailMode) {
    $timeout.cancel(nextTimeout);
    machineryForceFitImageSize(s, s.selected[0], true);
    s.current = s.selected[0];
    syncDetailFromScope();
    syncInspectorFromScope();
    s.isGifReady = false;
    syncDetailFromScope();
  }

  machineryAutoScroll(s, end);

  if (s.current) {
    detailZoom()?.updateNavigator( s.current);
    if (!machineryLastZoom(s)) {
      machineryZoom(s);
    }
    nextTimeout = $timeout(function () {
      if (!machineryLastZoom(s)) {
        machineryZoom(s);
      }
      var nextImage = s.allData[end + 1];
      machineryPreloadImage(s, "next");
    }, 100);
    machineryAddToRecentFile(s, s.current);
  }
}

/* selectPrev（bundle 36502-36552 逐字；首项 is-first-item 提示 + allData 空守卫 +
   详情模式 cleanBitmapViewer + start-1 越界回落 allData[0]） */
export function machinerySelectPrev(s: any, event: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  if (s.isCropMode) {
    moveCropToolChannel.emit({ horizontal: -1, vertical: 0 });
    return;
  }

  var selection = machineryGetSelection(s);
  var start = selection.start;
  var end = selection.end + 1;

  if (start === 0) {
    show("#is-first-item");
    setTimeout(() => { hide("#is-first-item"); }, 500);
    return;
  }
  if (s.allData.length == 0) { return; }

  if (s.isDetailMode) {
    detailZoom()?.cleanBitmapViewer();
    machineryRememberScrollTops(s, s.current);
    s.isGifReady = false;
    syncDetailFromScope();
  }

  if (s.allData[start - 1]) {
    s.selected = [];
    syncInspectorFromScope();
    s.selected.push(s.allData[start - 1]);
    syncInspectorFromScope();
    if (s.isDetailMode) {
      machineryForceFitImageSize(s, s.selected[0], true);
      s.current = s.selected[0];
      syncDetailFromScope();
      syncInspectorFromScope();
    }
    machineryAutoScroll(s, start - 1);
  } else {
    s.selected = [];
    syncInspectorFromScope();
    s.selected.push(s.allData[0]);
    syncInspectorFromScope();
    machineryForceFitImageSize(s, s.selected[0], true);
    s.current = s.selected[0];
    syncDetailFromScope();
    syncInspectorFromScope();
    machineryAutoScroll(s, 0);
  }
  s.selectedFolderMappings = {};
  syncListFromScope();
  s.$root.currentFocus = "content";
  if (s.current) {
    detailZoom()?.updateNavigator( s.current);
    if (!machineryLastZoom(s)) {
      machineryZoom(s);
    }
    $timeout.cancel(prevTimeout);
    prevTimeout = $timeout(function () {
      if (!machineryLastZoom(s)) {
        machineryZoom(s);
      }
      machineryPreloadImage(s, "prev");
    }, 100);
    machineryAddToRecentFile(s, s.current);
  }
}

/* ── c18e-2：多选系（multipleSelect 四件套）──────────────────────────── */

/* multipleSelectUp（bundle 35898-35906 逐字：ListLayout 委派 multipleSelectPrev） */
export function machineryMultipleSelectUp(s: any, event: any): void {
  if (s.isCropMode) {
    moveCropToolChannel.emit({ horizontal: 0, vertical: -10 });
    return;
  }
  if (s.layout === "ListLayout") {
    machineryMultipleSelectPrev(s, event);
  }
}

/* multipleSelectDown（bundle 35964-35972 逐字：ListLayout 委派 multipleSelectNext） */
export function machineryMultipleSelectDown(s: any, event: any): void {
  if (s.isCropMode) {
    moveCropToolChannel.emit({ horizontal: 0, vertical: 10 });
    return;
  }
  if (s.layout === "ListLayout") {
    machineryMultipleSelectNext(s, event);
  }
}

/* multipleSelectNext（bundle 36559-36585 逐字：sidebar 焦点守卫 + 详情模式跳过 +
   start < lastSelectedIndex 时收缩选区否则扩展 + autoScroll 经 scope） */
export function machineryMultipleSelectNext(s: any, event: any): void {
  if (s.$root.currentFocus == 'sidebar') return;
  if (s.isCropMode) {
    moveCropToolChannel.emit({ horizontal: 10, vertical: 0 });
    return;
  }
  if (s.isDetailMode) return;
  var selection = machineryGetSelection(s);
  var start = selection.start;
  var end = selection.end + 1;

  if (start < s.lastSelectedIndex) {
    let startItem = s.allData[start];
    let idx = s.selected.indexOf(startItem);
    if (idx !== -1) {
      s.selected.splice(idx, 1);
      syncInspectorFromScope();
      machineryAutoScroll(s, s.lastSelectedIndex);
    }
  }
  else {
    if (s.allData[end]) {
      s.selected.push(s.allData[end]);
      syncInspectorFromScope();
      machineryAutoScroll(s, end);
    }
  }
}

/* multipleSelectPrev（bundle 36586-36613 逐字：end > lastSelectedIndex 时收缩否则
   向 start-1 扩展） */
export function machineryMultipleSelectPrev(s: any, event: any): void {
  if (s.$root.currentFocus == 'sidebar') return;
  if (s.isCropMode) {
    moveCropToolChannel.emit({ horizontal: -10, vertical: 0 });
    return;
  }
  if (s.isDetailMode) return;
  var selection = machineryGetSelection(s);
  var start = selection.start;
  var end = selection.end;

  if (end > s.lastSelectedIndex) {
    let endItem = s.allData[end];
    let idx = s.selected.indexOf(endItem);
    if (idx !== -1) {
      s.selected.splice(idx, 1);
      syncInspectorFromScope();
      machineryAutoScroll(s, s.lastSelectedIndex);
    }
  }
  else {
    if (s.allData[start - 1]) {
      s.selected.push(s.allData[start - 1]);
      syncInspectorFromScope();
      machineryAutoScroll(s, start - 1);
    }
  }
}

/* ── c18e-2b：removeSelected（46118-46343）───────────────────────────── */

// ── c18e-2b 域内自管（原 controller 闭包 var：lastMoveToTrashCheckbox 46118）──
let lastMoveToTrashCheckbox: any = 1;

/* removeSelected（bundle 46119-46343 逐字；removeSelectedFolders/removeFolder/
   removeFolderContents/checkOperationSafety/removePermanently/resetFolderCover/
   updateFilterCounts/getSelectedItemElements/updateSelection 等 bundle scope 函数经
   scope 解析；TagManager 经 scope 字段（48351）；$filter('i18n') 走 getFilter()；
   swal/i18n/ScrollbarSaver/ayncsImagesChange/hiddenByCurrentFilter/electronLog 经 window） */
export function machineryRemoveSelected(s: any, event: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  event?.preventDefault();
  event?.stopPropagation();

  if (s.$root.currentFocus == 'sidebar') {
    if (s.$root.selectedFolders.length > 0) {
      machineryRemoveSelectedFolders(s);
    }
    else if (s.$root.selectedSmartFolders.length > 0) {
      machineryRemoveSelectedSmartFolders(s);
    }
    else if (s.currentFolder) {
      machineryRemoveFolder(s, s.currentFolder);
    } else if (s.currentSmartFolder) {
      machineryRemoveSmartFolder(s, s.currentSmartFolder);
    }
  }
  else if (s.$root.currentFocus == 'tags') {
    if (s.currentTagGroup) {
      machineryRemoveTagGroup(s, s.currentTagGroup);
    }
  }
  else if (s.selectedFolderMappings && Object.keys(s.selectedFolderMappings).length > 0) {
    var selectedFolders = Object.keys(s.selectedFolderMappings).map(function (key: any) {
      return key;
    });
    var folderId = selectedFolders[0];
    if (folderId && s.folderMappings[folderId]) {
      machineryRemoveFolder(s, s.folderMappings[folderId], {
        ignoreSelectNext: true
      });
    }
  }
  else if (s.viewMode === 'alltags' && s.currentTagGroup) {
    var selectedTags = machineryGetSelectedTags(s);
    if (selectedTags && selectedTags.length > 0) {
      s.TagManager.removeTagsFromGroup(s.currentTagGroup.id, selectedTags);
    }
  }
  else {

    if (s.selected.length <= 0) return;

    if (s.viewMode == "trash") {
      w.swal({
        html: `
                            <div class="alert">
                                <div class="alert-icon warning"></div>
                                <h4 class="alert-title">${w.i18n.__('dialog.permanentlyDelay.title')}</h4>
                                <p class="alert-desc">${w.i18n.__("dialog.permanentlyDelay.desc")}</p>
                            </div>
                        `,
        showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: false, focusCancel: false, padding: 24,
        allowEnterKey: false,
        width: 400,
        customClass: "alert-box",
        cancelButtonColor: "#777777",
        confirmButtonText: w.i18n.__('dialog.permanentlyDelay.button'),
        cancelButtonText: w.i18n.__("general.cancel"),
      }).then(function () {
        scopeEvalAsync(function () {
          machineryRemovePermanently(s);
        });
      });
    }
    else {
      machineryCheckOperationSafety(s, function () {
        s.lastIndex = machineryGetSelection(s).start;

        if (s.currentFolder) {

          // 强制重置该文件夹及祖先封面
          machineryResetFolderCover(s, s.currentFolder);

          var containsMultipleFolder = false;
          for (var i = 0; i < s.selected.length; i++) {
            var img = s.selected[i];
            if (img && img.folders && img.folders.length > 1) {
              containsMultipleFolder = true;
              break;
            }
          }
          if (containsMultipleFolder) {
            w.swal({
              html: `
                                        <div class="alert">
                                            <div class="alert-icon warning"></div>
                                            <h4 class="alert-title">${w.i18n.__("dialog.moveTrashWhenMultiCategory.title")}</h4>
                                            <p class="alert-desc">${w.i18n.__("dialog.moveTrashWhenMultiCategory.descript")}</p>
                                        </div>
                                    `,
              customClass: "alert-box check-multiple-categories-dialog",
              showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
              width: 400,
              cancelButtonColor: "#777777",
              input: 'radio',
              inputOptions: {
                '1': w.i18n.__("dialog.moveTrashWhenMultiCategory.checkbox"),
                '2': w.i18n.__("dialog.moveTrashWhenMultiCategory.button2"),
              },
              inputValue: lastMoveToTrashCheckbox,
              inputValidator: function (result: any) {
                return new Promise(function (resolve: any, reject: any) {
                  resolve(result);
                })
              },
              confirmButtonText: w.i18n.__("dialog.moveTrashWhenMultiCategory.button"),
              cancelButtonText: w.i18n.__("general.cancel"),
            }).then(function (result: any) {
              var isForceToTrash = (result === '2');
              lastMoveToTrashCheckbox = result;
              machineryRemoveFolderContents(s, { isForceToTrash: isForceToTrash });
              scopeEvalAsync();
            }, function () { });
          }
          else {
            machineryRemoveFolderContents(s, { isForceToTrash: true });
          }
        } else if (s.currentTag || s.currentSmartFolder || s.viewMode === 'all' || s.viewMode === 'unfiled' || s.viewMode === 'untagged' || s.viewMode === 'recent' || s.viewMode === 'random') {

          var origin: any[] = [];
          let now = Date.now();
          s.selected.forEach(function (image: any) {
            image.isDeleted = true;
            image.deletedTime = Date.now();
            origin.push(image);
            machineryUpdateFilterCounts(s, image, -1, now);
          });

          var message = getFilter()('i18n')("notify.image.remove", [
            { "property": "count", "value": s.selected.length },
          ]);
          if (s.selected.length === 1) { message = message.replace("images", "image"); }

          (s.$root.notify || s.notify).call(s.$root, {
            message: message,
            duration: 4000,
          }, function () {
            let now = Date.now();
            origin.forEach(function (image: any) {
              image.isDeleted = false;
              delete image.deletedTime;
              machineryUpdateFilterCounts(s, image, 1, now);
            });
            s.selected = origin;
            syncInspectorFromScope();
            if (s.isDetailMode) {
              s.current = origin[0];
              syncDetailFromScope();
              syncInspectorFromScope();
            }
            machineryCalculateImageBinding(s, { ignoreSort: true }, function () {
              if (
                s.viewMode !== 'random'
              ) {
                machineryRebindRefresh(s);
              }
              w.ScrollbarSaver.restoreScrollPosition();
            });
            w.ayncsImagesChange(origin);
            w.hiddenByCurrentFilter(origin);
          });

          if (s.isDetailMode) {
            $timeout(function () {
              machineryZoom(s);
            }, 100)
          }

          if (s.$root.preferences.notification.soundEffect.enable != 'false' && s.$root.preferences.notification.soundEffect.when.deleteImage == 'true') {
            s.removeSound && s.removeSound.play && s.removeSound.play();
          }
          w.ayncsImagesChange(s.selected);
          w.hiddenByCurrentFilter(s.selected);

          // 自動選取下一個圖片，如果沒有下一個，選上一個，都沒有就空
          s.lastIndex = machineryGetSelection(s).start;
          var next = s.allData[s.lastIndex + s.selected.length];
          var prev = s.allData[s.lastIndex - 1];

          if (next) {
            s.selected = [next];
            syncInspectorFromScope();
            if (s.isDetailMode) {
              s.current = next;
              syncDetailFromScope();
              syncInspectorFromScope();
            }
          } else if (prev) {
            s.selected = [prev];
            syncInspectorFromScope();
            if (s.isDetailMode) {
              s.current = prev;
              syncDetailFromScope();
              syncInspectorFromScope();
            }
          } else {
            s.selected = [];
            syncInspectorFromScope();
            if (s.isDetailMode) {
              machineryLeaveDetailMode(s);
            }
          }

          $timeout(function () {
            machineryForceFitImageSize(s, s.current);
            machineryZoom(s);
          }, 100);

          w.ScrollbarSaver.saveScrollPosition();

          var itemElements = machineryGetSelectedItemElements(s);
          glRemoveitemsChannel.emit(itemElements);

          s.lastSelectedIndex = machineryCurrentIndex(s) - 1;
          machineryAutoScroll(s);

          machineryCalculateImageBinding(s, { ignoreSort: true }, function () {
            if (
              s.viewMode !== 'random' ||
              (s.currentFolder && s.currentFolder.orderBy !== "RANDOM")
            ) {
              machineryRebindRefresh(s, true);
            }
            machineryUpdateSelection(s);
            if (s.currentFolder) { w.electronLog && w.electronLog.info(`[app] Remove ${itemElements.length} files from ${s.currentFolder.name}(${s.currentFolder.id}), folder remain ${s.currentFolder.imageCount} files, all remain ${s.all.length} files, trash remain ${s.trash.length} files`); }
            else { w.electronLog && w.electronLog.info(`[app] Remove ${itemElements.length} files, all remain ${s.all.length} files, trash remain ${s.trash.length} files`); }
          });
        } else {
          return;
        }
      }, 200);
    }
  }
}

/* ── c18e-3：quicklook/copyImages ───────────────────────────────────── */

/* quicklook（bundle 33542-33580 逐字；toggleGifPlay/toggleDetailMode/pageDownHandler 经
   scope 解析；IPCHelper 为脚本级词法绑定（c17a if-absent 接装）经 window；analytics 顶层
   var（105501）/process/swal 容器经 window） */
export function machineryQuicklook(s: any, event: any): void {
  const w = window as any;
  if (qa(".swal2-container").length > 0) {
    return;
  }
  if (s.isCropMode) return;
  event && event.preventDefault();
  // if ($scope.isDetailMode && !$scope.isInlineMode && VIDEO_TYPES[$scope.current.ext]) {
  //     $scope.toggleVideoPlay();
  // }
  // else if ($scope.isDetailMode && !$scope.isInlineMode && AUDIO_TYPES[$scope.current.ext]) {
  //     $scope.toggleVideoPlay();
  // }
  // else
  if (s.isDetailMode && !s.isInlineMode && (s.current.ext == 'gif')) {
    toggleGifPlay();
  }
  else {
    // 如果用户设定是预览
    if (s.$root.preferences.habits.keyspace === "preview") {
      if (s.selected.length > 0) {
        addClass(".content-panel.detail-mode", "inline-mode");
        setTimeout(function () {
          addClass(".content-panel.detail-mode", "open");
        }, 30);
        machineryToggleDetailMode(s, event, true);
        w.analytics.event('QuickLook', 'Open');
      }
    }
    else if (s.$root.preferences.habits.keyspace === "preview-native") {
      if (s.selected.length > 0) {
        if (w.process.platform == 'darwin' && !s.isDetailMode) {
          s.isPreviewing = !s.isPreviewing;
          w.IPCHelper.send('quicklook', s.selected[0]);
        }
      }
    }
    // 如果用户设定是滚动页面
    else {
      getPageDownHandlerFn(s)(event);
    }
  }
}

/* copyImages（bundle 31747-31795 逐字；clipboard 为 renderer 全局（controllerFns 同款裸引）；
   ipcRenderer 统一表达式；RecentFileManager if-absent 接装经 window；notify 走 machinery 版） */

/* ── c18e-4：方向键/修饰键 handler 族（第一批）───────────────────────── */

/* keyCHandler（bundle 35099-35103 逐字）、keyPHandler（35104-35106 逐字） */
export function machineryKeyCHandler(s: any, event: any): void {
  if (s.isInlineMode) return;
  if (s.isDetailMode) {
    machineryToggleCommentMode(s, event);
  }
}

export function machineryKeyPHandler(s: any, event: any): void {
  machineryOpenPluginPanel(s, event);
}

/* keyLeftHandler（bundle 35107-35146 逐字：swal 容器守卫 + content→selectPrev(machinery 版) +
   tags→焦点回落 sidebar + sidebar 文件夹/smart 文件夹折叠（多选折叠与单选展开-折叠分叉），
   localStorage 键逐字） */
export function machineryKeyLeftHandler(s: any, event: any): void {
  const w = window as any;
  event && event.preventDefault();
  if (qa(".swal2-container").length > 0) return;
  if (s.$root.currentFocus == "content") {
    machinerySelectPrev(s, event);
  }
  else if (s.$root.currentFocus == "tags") {
    s.$root.currentFocus = "sidebar";
  }
  else {
    if (s.$root.selectedFolders.length > 1) {
      s.$root.selectedFolders.forEach(function (folder: any) {
        if (folder.children && folder.children.length > 0) {
          if (folder.isExpand !== false) {
            folder.isExpand = false;
            w.localStorage.setItem("eagle.sidebar.folder.expand." + folder.id, false);
          }
        }
      });
      machineryUpdateSidebarList(s);
    }
    else if (s.currentFolder) {
      if (!s.currentFolder.children || s.currentFolder.children.length == 0) {
        s.currentFolder.isExpand = true;
        machineryUpdateSidebarList(s);
      }
      else {
        s.currentFolder.isExpand = false;
        machineryUpdateSidebarList(s);
      }
      w.localStorage.setItem("eagle.sidebar.folder.expand." + s.currentFolder.id, false);
    }
    else if (s.currentSmartFolder) {
      if (!s.currentSmartFolder.children || s.currentSmartFolder.children.length == 0) {
        s.currentSmartFolder.isExpand = true;
        machineryUpdateSidebarList(s);
      }
      else {
        s.currentSmartFolder.isExpand = false;
        machineryUpdateSidebarList(s);
      }
      w.localStorage.setItem("eagle.sidebar.smartFolder.expand." + s.currentSmartFolder.id, false);
    }
  }
}

/* keyRightHandler（bundle 35148-35189 逐字：content→selectNext + sidebar 多选展开/单选展开 +
   alltags→焦点 tags，localStorage 键逐字） */
export function machineryKeyRightHandler(s: any, event: any): void {
  const w = window as any;
  event && event.preventDefault();
  if (qa(".swal2-container").length > 0) return;
  if (s.$root.currentFocus == "content") {
    machinerySelectNext(s, event);
  }
  else {
    if (s.$root.selectedFolders.length > 1) {
      s.$root.selectedFolders.forEach(function (folder: any) {
        if (folder.children && folder.children.length > 0) {
          if (folder.isExpand !== true) {
            folder.isExpand = true;
            w.localStorage.setItem("eagle.sidebar.folder.expand." + folder.id, true);
          }
        }
      });
      machineryUpdateSidebarList(s);
    }
    else if (s.currentFolder) {
      s.currentFolder.isExpand = true;
      machineryUpdateSidebarList(s);
      w.localStorage.setItem("eagle.sidebar.folder.expand." + s.currentFolder.id, true);
    }
    else if (s.currentSmartFolder) {
      s.currentSmartFolder.isExpand = true;
      machineryUpdateSidebarList(s);
      w.localStorage.setItem("eagle.sidebar.smartFolder.expand." + s.currentSmartFolder.id, true);
    }
    else if (s.viewMode == "alltags") {
      s.$root.currentFocus = "tags";
    }
  }
}

/* mod 八件套（bundle 35343-35438 逐字：crop 模式→RESIZE-CROP-TOOL 广播（mod 上下 1/
   shift 上下左右 10），否则 mod 上/下委派 homeHandler/endHandler（scope 函数 35636/35650）、
   mod 左/右详情外委派 prevHistory/nextHistory（machinery 版）、modShift 纯 crop 广播） */
export function machineryModUpHandler(s: any, event: any): void {
  if (s.isCropMode) {
    event && event.preventDefault();
    resizeCropToolChannel.emit({
      horizontal: 0,
      vertical: -1
    });
    return;
  }
  else {
    machineryHomeHandler(s, event);
  }
}

export function machineryModDownHandler(s: any, event: any): void {
  if (s.isCropMode) {
    event && event.preventDefault();
    resizeCropToolChannel.emit({
      horizontal: 0,
      vertical: 1
    });
    return;
  }
  else {
    machineryEndHandler(s, event);
  }
}

export function machineryModLeftHandler(s: any, event: any): void {
  event && event.preventDefault();
  if (s.isDetailMode) {
    if (s.isCropMode) {
      resizeCropToolChannel.emit({
        horizontal: -1,
        vertical: 0
      });
      return;
    }
  }
  else {
    machineryPrevHistory(s, event);
  }
}

export function machineryModRightHandler(s: any, event: any): void {
  event && event.preventDefault();
  if (s.isDetailMode) {
    if (s.isCropMode) {
      resizeCropToolChannel.emit({
        horizontal: 1,
        vertical: 0
      });
      return;
    }
  }
  else {
    machineryNextHistory(s, event);
  }
}

/* ── c18e-5：keyUp/keyDown handler 族（含侧栏导航闭包）───────────────── */

/* 域内闭包移植（原 controller 内 function 声明，非 scope 成员）：
   openPrevQuickAccess（35287-35302）/ openNextQuickAccess（35304-35341）/
   openPrevGroup（35704-35725）/ openNextGroup（35730-35752） */
function machineryOpenPrevQuickAccess(s: any): void {
  var $quickAccessItems = qaVisible(".sidebar-quick-access-item");
  var $current = q(".sidebar-quick-access-item.active");
  var currentIndex = $current ? $quickAccessItems.indexOf($current) : -1;

  if (currentIndex - 1 >= 0) {
    $quickAccessItems[currentIndex - 1].click();
  }
  else {
    machineryOpenTrash(s);
  }
}

function machineryOpenNextQuickAccess(s: any): void {
  var $quickAccessItems = qaVisible(".sidebar-quick-access-item");
  var $current = q(".sidebar-quick-access-item.active");
  var currentIndex = $current ? $quickAccessItems.indexOf($current) : -1;

  if (currentIndex + 1 < $quickAccessItems.length) {
    $quickAccessItems[currentIndex + 1].click();
  }
  else {
    var listItems = s.sidebarList;
    var folders = listItems.filter(function (item: any) {
      return item.vstype === 'folder';
    });
    var smartFolders = listItems.filter(function (item: any) {
      return item.vstype === 'smartFolder' || item.vstype === 'smartFolderGroup';
    });
    if (smartFolders.length > 0 && smartFolders[0]) {
      openSmartFolder(smartFolders[0]);
    }
    else if (folders.length > 0 && folders[0]) {
      openFolder(folders[0]);
    }
  }
}



/* keyUpHandler（bundle 35191-35285 逐字：content→crop 广播/moveY -150/selectUp +
   sidebar 清空选择后按 viewMode 七级回落（all 分支为空体、unfiled→openAll、untagged→
   unfiled/all、recent→untagged/unfiled/all、random→recent/untagged/unfiled/all、
   community→random/recent/untagged/unfiled/all、alltags→community/random/recent/untagged/
   unfiled/all 偏好门控、trash→openAllTags）+ currentId 三分（smart-folder/quick/folder，
   注意含 currentId 真值守卫）+ tags→openPrevGroup） */
export function machineryKeyUpHandler(s: any, event: any): void {
  const w = window as any;
  event && event.preventDefault();
  if (qa(".swal2-container").length > 0) return;
  if (s.$root.currentFocus == "content") {
    if (s.isDetailMode && !s.isInlineMode) {
      if (s.isCropMode) {
        moveCropToolChannel.emit({ horizontal: 0, vertical: -1 });
        return;
      }
      else {
        detailZoom()?.moveY( -150);
      }
    } else {
      machinerySelectUp(s, event);
    }
  }
  else if (s.$root.currentFocus == "sidebar") {
    s.$root.selectedFolders = [];
    syncListFromScope();
    s.$root.selectedFoldersMappings = {};
    s.$root.selectedSmartFoldersMappings = {};
    s.$root.selectedSmartFolders = [];
    if (s.viewMode == "all") { } else if (s.viewMode == "unfiled") { machineryOpenAll(s) }
      else if (s.viewMode == "untagged") {
        if (s.$root.preferences.sidebar.unfiled != 'false') {
          machineryOpenUnfiled(s);
        }
        else {
          machineryOpenAll(s);
        }
      }
      else if (s.viewMode == "recent") {
        if (s.$root.preferences.sidebar.untagged != 'false') {
          machineryOpenUntagged(s);
        }
        else if (s.$root.preferences.sidebar.unfiled != 'false') {
          machineryOpenUnfiled(s);
        }
        else {
          machineryOpenAll(s);
        }
      }
      else if (s.viewMode == "random") {
        if (s.$root.preferences.sidebar.recent != 'false') {
          machineryOpenRecent(s);
        }
        else if (s.$root.preferences.sidebar.untagged != 'false') {
          machineryOpenUntagged(s);
        }
        else if (s.$root.preferences.sidebar.unfiled != 'false') {
          machineryOpenUnfiled(s);
        }
        else {
          machineryOpenAll(s);
        }
      }
      else if (s.viewMode == "community") {
        if (s.$root.preferences.sidebar.random != 'false') {
          machineryOpenRandom(s);
        }
        else if (s.$root.preferences.sidebar.recent != 'false') {
          machineryOpenRecent(s);
        }
        else if (s.$root.preferences.sidebar.untagged != 'false') {
          machineryOpenUntagged(s);
        }
        else if (s.$root.preferences.sidebar.unfiled != 'false') {
          machineryOpenUnfiled(s);
        }
        else {
          machineryOpenAll(s);
        }
      }
      else if (s.viewMode == "alltags") {
        if (s.$root.preferences.sidebar.community2 != 'false') {
          machineryOpenCommunity(s);
        }
        else if (s.$root.preferences.sidebar.random != 'false') {
          machineryOpenRandom(s);
        }
        else if (s.$root.preferences.sidebar.recent != 'false') {
          machineryOpenRecent(s);
        }
        else if (s.$root.preferences.sidebar.untagged != 'false') {
          machineryOpenUntagged(s);
        }
        else if (s.$root.preferences.sidebar.unfiled != 'false') {
          machineryOpenUnfiled(s);
        }
        else {
          machineryOpenAll(s);
        }
      }
      else if (s.viewMode == "trash") {
        machineryOpenAllTags(s)
      }
      else {
        if (s.currentId) {
          if (s.currentId.indexOf("smart-folder") > -1) {
            machineryOpenPrevSmartFolder(s);
          }
          else if (s.currentId.indexOf("quick") > -1) {
            machineryOpenPrevQuickAccess(s);
          }
          else if (s.currentId.indexOf("folder") > -1) {
            machineryOpenPrevFolder(s);
          }
        }
      }
  }
  else if (s.$root.currentFocus == "tags") {
    machineryOpenPrevGroup(s);
  }
}

/* keyDownHandler（bundle 35440-35610 逐字：content→crop 广播/moveY 150/selectDown +
   sidebar 清空选择后按 viewMode 七级回落（all→unfiled/untagged/recent/random/community/
   allTags、unfiled→untagged/recent/random/community/allTags、untagged→recent/random/
   community/allTags、recent→random/community/allTags、random→community/allTags、
   community→allTags 偏好门控、alltags→openTrash、trash→quickAccess→smartFolders→folders）
   + currentId 三分（**无 currentId 真值守卫，bundle 原样**）+ tags→openNextGroup） */
export function machineryKeyDownHandler(s: any, event: any): void {
  const w = window as any;
  event && event.preventDefault();
  if (qa(".swal2-container").length > 0) return;
  if (s.$root.currentFocus == "content") {
    if (s.isDetailMode && !s.isInlineMode) {
      if (s.isCropMode) {
        moveCropToolChannel.emit({ horizontal: 0, vertical: 1 });
        return;
      }
      else {
        detailZoom()?.moveY( 150);
      }
    } else {
      machinerySelectDown(s, event);
    }
  }
  else if (s.$root.currentFocus == "sidebar") {
    s.$root.selectedFolders = [];
    syncListFromScope();
    s.$root.selectedFoldersMappings = {};
    s.$root.selectedSmartFoldersMappings = {};
    s.$root.selectedSmartFolders = [];
    if (s.viewMode == "all") {
      if (s.$root.preferences.sidebar.unfiled != 'false') {
        machineryOpenUnfiled(s);
      }
      else if (s.$root.preferences.sidebar.untagged != 'false') {
        machineryOpenUntagged(s);
      }
      else if (s.$root.preferences.sidebar.recent != 'false') {
        machineryOpenRecent(s);
      }
      else if (s.$root.preferences.sidebar.random != 'false') {
        machineryOpenRandom(s);
      }
      else if (s.$root.preferences.sidebar.community2 != 'false') {
        machineryOpenCommunity(s);
      }
      else {
        machineryOpenAllTags(s);
      }
    }
    else if (s.viewMode == "unfiled") {
      if (s.$root.preferences.sidebar.untagged != 'false') {
        machineryOpenUntagged(s);
      }
      else if (s.$root.preferences.sidebar.recent != 'false') {
        machineryOpenRecent(s);
      }
      else if (s.$root.preferences.sidebar.random != 'false') {
        machineryOpenRandom(s);
      }
      else if (s.$root.preferences.sidebar.community2 != 'false') {
        machineryOpenCommunity(s);
      }
      else {
        machineryOpenAllTags(s);
      }
    }
    else if (s.viewMode == "untagged") {
      if (s.$root.preferences.sidebar.recent != 'false') {
        machineryOpenRecent(s);
      }
      else if (s.$root.preferences.sidebar.random != 'false') {
        machineryOpenRandom(s);
      }
      else if (s.$root.preferences.sidebar.community2 != 'false') {
        machineryOpenCommunity(s);
      }
      else {
        machineryOpenAllTags(s);
      }
    }
    else if (s.viewMode == "recent") {
      if (s.$root.preferences.sidebar.random != 'false') {
        machineryOpenRandom(s);
      }
      else if (s.$root.preferences.sidebar.community2 != 'false') {
        machineryOpenCommunity(s);
      }
      else {
        machineryOpenAllTags(s);
      }
    }
    else if (s.viewMode == "random") {
      if (s.$root.preferences.sidebar.community2 != 'false') {
        machineryOpenCommunity(s);
      }
      else {
        machineryOpenAllTags(s);
      }
    }
    else if (s.viewMode == "community") {
      machineryOpenAllTags(s);
    }
    else if (s.viewMode == "alltags") { machineryOpenTrash(s) } else if (s.viewMode == "trash") {

      var listItems = s.sidebarList;
      var folders = listItems.filter(function (item: any) {
        return item.vstype === 'folder';
      });
      var smartFolders = listItems.filter(function (item: any) {
        return item.vstype === 'smartFolder' || item.vstype === 'smartFolderGroup';
      });
      var quickAccessItems = listItems.filter(function (item: any) {
        return item.vstype === 'quickAccess';
      });
      if (quickAccessItems.length > 0) {
        clickEl("#quick-access-" + quickAccessItems[0].id);
      }
      else if (smartFolders.length > 0 && smartFolders[0]) {
        openSmartFolder(smartFolders[0]);
      }
      else if (folders.length > 0 && folders[0]) {
        openFolder(folders[0]);
      }
    }
    else {
      if (s.currentId.indexOf("smart-folder") > -1) {
        machineryOpenNextSmartFolder(s);
      }
      else if (s.currentId.indexOf("quick") > -1) {
        machineryOpenNextQuickAccess(s);
      }
      else if (s.currentId.indexOf("folder") > -1) {
        machineryOpenNextFolder(s);
      }
    }
  }
  else if (s.$root.currentFocus == "tags") {
    machineryOpenNextGroup(s);
  }
}

/* ── c18e-6：selectUp/Down + pageUp/pageDownHandler（滚动翻页面）──────── */


/* scrollbarTo（bundle 35612-35635 逐字）+ Math.easeInOutQuad（35638-35643 逐字；bundle 于
   controller init 补丁全局 Math，此处同体幂等补丁） */
(Math as any).easeInOutQuad = function (t: any, b: any, c: any, d: any) {
  t /= d / 2;
  if (t < 1) return c / 2 * t * t + b;
  t--;
  return -c / 2 * (t * (t - 2) - 1) + b;
};


/* pageDownHandler（bundle 35680-35689 逐字）——_.throttle 实例 apply 时一次性创建
   （与 bundle controller init 同语义），shift+space 绑定消费 */
export function machineryPageDownHandler(s: any): any {
  const w = window as any;
  return throttle(function (event: any) {
    var offset = window.innerHeight - 72;
    if (s.isDetailMode) {
      detailZoom()?.moveY( offset);
    }
    else {
      var scrollTop = scrollTopValue(".box-container");
      machineryScrollbarTo(q(".box-container"), scrollTop + offset * 1, 100);
    }
  }, 100, true);
}

/* pageUpHandler（bundle 35691-35702 逐字：含 prepend 触发面 ig.trigger("prepend")） */
export function machineryPageUpHandler(s: any): any {
  const w = window as any;
  return throttle(function (event: any) {
    var offset = window.innerHeight - 72;
    if (s.isDetailMode) {
      detailZoom()?.moveY( -offset);
    }
    else {
      var scrollTop = scrollTopValue(".box-container");
      machineryScrollbarTo(q(".box-container"), scrollTop - offset * 1, 100);
      setTimeout(function () {
        if (s.startCursor !== 0 && scrollTopValue("#box-container") === 0) {
          w.ig.trigger("prepend");
        }
      }, 200);
    }
  }, 100, true);
}

/* selectUp（bundle 35840-35906 逐字：GridLayout 同列最近上方盒 / 其他布局上方 20px 外
   最近距离盒，selected 首盒为锚点）+ selectDown（35908-35962 逐字：getArroundBox(end) 邻域 +
   selected 末盒为锚点；**autoScroll(target) 传元素非索引，bundle 怪癖逐字保留**；
   getItemByElement 经 scope 解析） */
export function machinerySelectUp(s: any, event: any): void {
  event && event.preventDefault();

  var selection = machineryGetSelection(s);
  var start = selection.start;
  var $box = q(".box.selected");
  var boxOffest = offsetOf($box);
  if (!boxOffest) return;
  var boxCenterX = boxOffest.left;
  var boxCenterY = boxOffest.top;
  var target: HTMLElement | undefined;
  var d = 100000;

  qa(".box").forEach(function (b) {
    var $b = b;
    var offset = offsetOf($b);
    if (!offset) return;
    var bx = offset.left;
    var by = offset.top;
    if (s.layout === "GridLayout") {
      var td = Math.abs(boxCenterY - by);
      if (boxCenterX == bx && boxCenterY > by) {
        if (td < d) {
          d = td;
          target = $b;
        }
      }
    }
    else {
      var td2 = Math.sqrt((boxCenterY - by) * (boxCenterY - by) + (boxCenterX - bx) * (boxCenterX - bx));
      if (boxCenterY > offset.top && Math.abs(boxCenterY - offset.top) > 20) {
        if (td2 < d) {
          d = td2;
          target = $b;
        }
      }
    }
  });
  if (target) {
    var image = machineryGetItemByElement(s, target);
    s.selected = [image];
    syncInspectorFromScope();
    s.selectedFolderMappings = {};
    syncListFromScope();
    if (s.isDetailMode) {
      s.current = s.selected[0];
      syncDetailFromScope();
      syncInspectorFromScope();
    }
    machineryAutoScroll(s, target);
  }
  if (s.isDetailMode) {
    machineryForceFitImageSize(s, s.selected[0], true);
    s.current = s.selected[0];
    syncDetailFromScope();
    syncInspectorFromScope();
    s.isGifReady = false;
    syncDetailFromScope();
    detailZoom()?.updateNavigator( s.current);
    if (!machineryLastZoom(s)) {
      machineryZoom(s);
    }
  }
}

export function machinerySelectDown(s: any, event: any): void {
  event && event.preventDefault();
  var selection = machineryGetSelection(s);
  var end = selection.end || 0;
  var $arround = machineryGetArroundBox(s, end);
  var $box = qa(".box.selected").slice(-1)[0] as HTMLElement | undefined;
  var boxOffest = offsetOf($box || null);
  if (!boxOffest) return;
  var boxCenterX = boxOffest.left;
  var boxCenterY = boxOffest.top;
  var target: HTMLElement | undefined;
  var d = 100000;
  qa(".box").forEach(function (b) {
    var $b = b;
    var offset = offsetOf($b);
    if (!offset) return;
    var bx = offset.left;
    var by = offset.top;
    if (s.layout === "GridLayout") {
      var td = Math.abs(by - boxCenterY);
      if (boxCenterX == bx && by > boxCenterY) {
        if (td < d) {
          d = td;
          target = $b;
        }
      }
    }
    else {
      var td2 = Math.sqrt((boxCenterY - by) * (boxCenterY - by) + (boxCenterX - bx) * (boxCenterX - bx));
      if (boxCenterY < offset.top && Math.abs(boxCenterY - offset.top) > 20) {
        if (td2 < d) {
          d = td2;
          target = $b;
        }
      }
    }
  });
  if (target) {
    var image = machineryGetItemByElement(s, target);
    s.selected = [image];
    syncInspectorFromScope();
    s.selectedFolderMappings = {};
    syncListFromScope();
    if (s.isDetailMode) {
      s.current = s.selected[0];
      syncDetailFromScope();
      syncInspectorFromScope();
    }
    machineryAutoScroll(s, target);
  }
  if (s.isDetailMode) {
    machineryForceFitImageSize(s, s.selected[0], true);
    s.current = s.selected[0];
    syncDetailFromScope();
    syncInspectorFromScope();
    s.isGifReady = false;
    syncDetailFromScope();
    detailZoom()?.updateNavigator( s.current);
    if (!machineryLastZoom(s)) {
      machineryZoom(s);
    }
  }
}

/* ── c18f-1：小 handler 批（评分/视频键/侧栏开关/缩放步进/保存/随机刷新）── */

/* changeTo5Star（bundle 30316-30319 逐字；changeStar 为 bundle scope 函数经 scope 解析） */
export function machineryChangeTo5Star(s: any, event: any): void {
  if (event?.altKey || event?.metaKey || event?.ctrlKey) return;
  machineryChangeStar(s, 5, true, true);
}

/* removeStar/changeTo1Star…changeTo4Star（bundle 30292-30314 逐字补齐——b1-9ay：c18f-1 批
   此前仅落了 changeTo5Star，mousetrap '0'-'4' 五键绑定期读到 undefined，按键即
   TypeError: func is not a function（sweep B5/B6 实锤）） */
export function machineryRemoveStar(s: any): void {
  machineryChangeStar(s, undefined, true);
}

export function machineryChangeTo1Star(s: any, event: any): void {
  if (event?.altKey || event?.metaKey || event?.ctrlKey) return;
  machineryChangeStar(s, 1, true, true);
}

export function machineryChangeTo2Star(s: any, event: any): void {
  if (event?.altKey || event?.metaKey || event?.ctrlKey) return;
  machineryChangeStar(s, 2, true, true);
}

export function machineryChangeTo3Star(s: any, event: any): void {
  if (event?.altKey || event?.metaKey || event?.ctrlKey) return;
  machineryChangeStar(s, 3, true, true);
}

export function machineryChangeTo4Star(s: any, event: any): void {
  if (event?.altKey || event?.metaKey || event?.ctrlKey) return;
  machineryChangeStar(s, 4, true, true);
}

/* closeWindowHandler（bundle 30802-30812 逐字；**bundle 原版怪癖：参数名为 $event 但体内
   引用全局 event——ESM 经 w.event 复刻同语义**（mousetrap 派发期内 window.event 即键盘事件）；
   IPCHelper 脚本级词法绑定（c17a 接装）经 window） */
/* nHandler（bundle 30813-30824 逐字：详情内视频/音频添加视频评论；VIDEO_TYPES/AUDIO_TYPES
   经 window（Tier-1 TYPES 契约），addVideoComment 经 scope 解析） */
export function machineryNHandler(s: any, $event: any): void {
  const w = window as any;
  if (!s.isDetailMode) {
    return;
  }
  if (w.VIDEO_TYPES[s.current.ext] || w.AUDIO_TYPES[s.current.ext]) {
    var video = q(".detail-wrap video") || q(".detail-wrap mpv-video");
    if (video) {
      machineryAddVideoComment(s, s.current, video);
    }
  }
}

/* toggleAll（bundle 30968-31003 逐字：侧栏+检查器联动开合（eagle.inspector.isHideInspector
   双写）+ lastItemStates 清空 + orientationchange + boxContianerWidth/Height 快照 + relayout/
   offsetScrollbar + 详情 edge 模式 zoomFitEdge（**裸 event 怪癖：$timeout 回调期 window.event
   为 null，以 w.event 复刻**）+ isHideSidebar localStorage 键逐字 + electronLog 双分支） */
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
    machineryRelayout(s);
    getOffsetScrollbarFn(s)(30);
    if (s.isDetailMode) {
      s.$root.currentFocus = "content";
    }
    if (s.isDetailMode && s.lastZoomMode === "edge") {
      machineryZoomFitEdge(s, w.event);
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

/* b1-9bd：zoomIn/zoomOut 实现体归位 services/gridService.ts（详情分支的 ratio 梯度
   仍经 scope 解析 getRatioExp/getRatioNonExp/updateZoomRatio，S4 详情竖切归位） */


/* saveHandler（bundle 35985-35991 逐字：crop 模式 saveCrop；saveCrop 经 scope 解析） */
export function machinerySaveHandler(s: any): void {
  if (s.isRotating) return;
  if (s.isCropMode) {
    saveCrop();
  }
}

/* refreshRandom（bundle 42824-42837 逐字：random 视图/RANDOM 排序守卫 + shuffle 清空 +
   refresh-random active 闪烁 50ms + reload（machinery 版经 scope）） */

/* ── c18f-2：openParentFolder/createTxtFileFromTemplate/setFolderCover ── */


/* createTxtFileFromTemplate（bundle 37329-37334 逐字；newFileFromTemplate 为 bundle scope
   函数经 scope 解析——文件创建域后续独立切片） */

/* setFolderCover（bundle 41438-41454 逐字；FileUrlHelper 经 window、getFilter() 复刻
   $filter('i18n')、notify/saveFolder 走 machinery 版） */

/* ── c18f-3：inspector 面板/快捷搜索打开器（D-1 B-3 已归位 core/keymapActions.ts）── */

/* openInspectorTagSelectPanel（bundle 43283-43287 逐字；body scope 生效版——54887 系为
   其他 controller 的 $bodyScope 委派壳） */
export function machineryOpenInspectorTagSelectPanel(s: any): void {
  if (s.selected.length === 0) return;
  inspectorTagSelectPanelOpenChannel.emit();
}

/* openInspectorFolderSelectPanel（bundle 43288-43448 逐字：FolderSelectPanel.open 参数组
   （ folders/selectedIds/onChanged：checkOperationSafety 包装 → selectedFolderIds/deselected
   FolderIds 分拣 → addToRecentFolders → origin 四联快照 → eagle.utils.tree.walk 添加/删除
   双分支（extendTags 传染、ig.remove + imagesMappings、updateFilterCounts）→ ayncsImagesChange/
   hiddenByCurrentFilter → unfiled 分支 gl:removeItems → calculateImageBinding/rebindRefresh/
   updateSelection → i18n 单复数两形态（复数走 getFilter()，单数逐字 angular.injector 链）→
   notify undo 四字段回滚 → electronLog + analytics 'File','Categorize','QuickCategorize'）。
   FolderSelectPanel 为 bundle 顶层 class（55801，词法绑定不上 window）→ 直连 React 移植版
   selectPanelEngine 的 static open（同 rootScope $broadcast 语义，bundle 在世/缺席双期兼容）；
   体内 $bodyScope.* 引用逐字保留（= 真身 body scope，w.$bodyScope）。 */
export function machineryOpenInspectorFolderSelectPanel(s: any, event: any): void {
  const w = window as any;
  event && event.stopPropagation();

  if (s.selected.length === 0) return;

  const folders = s.folders;
  const originalSelectedIds = w.eagle.inspector.calculateFolders(s.selected).reduce((acc: any, cur: any) => {
    acc[cur] = true;
    return acc;
  }, {});

  FolderSelectPanel.open({
    folders: folders,
    selectedIds: originalSelectedIds,
    onChanged: (result: any) => {

      if (!result?.isDirty) return;

      const { selectedFolderIds, deselectedFolderIds } = result;
      machineryCheckOperationSafety(s, () => {
        try {
          let selectedFolders: any[] = [];
          let folderIds: any[] = [];
          let selectedItems: any[] = [];

          s.selected.forEach((item: any) => {
            selectedItems.push(item);
          });

          Object.keys(selectedFolderIds).forEach((folderId) => {
            if (s.folderMappings[folderId] && !originalSelectedIds[folderId]) {
              selectedFolders.push(s.folderMappings[folderId]);
              folderIds.push(folderId);
            }
          });

          addToRecentFolders(folderIds);

          let origin: any[] = [];
          let originFolders: any[] = [];
          let originTags: any[] = [];
          let originDeleted: any[] = [];

          selectedItems.forEach((item: any) => {
            origin.push(item);
            originFolders.push(structuredClone(item.folders));
            originTags.push(structuredClone(item.tags));
            originDeleted.push(item.isDeleted);
          });

          let removedFolderIds: any[] = [];
          Object.keys(deselectedFolderIds).forEach((folderId) => {
            removedFolderIds.push(folderId);
          });

          let hasChanged = false;
          let changedItems: any[] = [];
          let changedMaps: any = {};

          w.eagle.utils.tree.walk(s.folders, 'children', (folder: any, parent: any) => {
            // 添加新分类
            if (selectedFolderIds[folder.id] && !deselectedFolderIds[folder.id]) {
              selectedItems.forEach((item: any) => {
                if (item.folders.indexOf(folder.id) === -1) {
                  item.folders.push(folder.id);
                  if (folder.extendTags) {
                    folder.extendTags.forEach(function (tag: any) {
                      if (item.tags.indexOf(tag) === -1) {
                        item.tags.push(tag);
                      }
                    });
                  }
                  item.isDeleted = false;
                  hasChanged = true;
                  changedItems.push(item);
                  changedMaps[item.id] = true;
                }
              });
            }


            // 删除已有
            else if (deselectedFolderIds[folder.id]) {
              selectedItems.forEach((item: any) => {
                var idx2 = item.folders.indexOf(folder.id);
                if (idx2 !== -1) {
                  if (s.currentFolder && s.currentFolder.id === folder.id) {
                    w.ig.remove(q("#box-" + item.id));
                    s.currentFolder.imagesMappings[item.id] = false;
                  }
                  item.folders.splice(idx2, 1);
                  machineryUpdateFilterCounts(s, item, -1);
                  item.isDeleted = false;
                  hasChanged = true;
                  changedItems.push(item);
                  changedMaps[item.id] = true;
                }
              });
            }
          });

          changedItems = [...new Set(changedItems)];

          if (hasChanged) {
            w.ayncsImagesChange(changedItems);
            w.hiddenByCurrentFilter(changedItems);
            if (w.$bodyScope.viewMode === 'unfiled') {
              glRemoveitemsChannel.emit(w.$bodyScope.getSelectedItemElements());
            }

            machineryCalculateImageBinding(w.$bodyScope, { ignoreSort: true }, () => {
              machineryRebindRefresh(w.$bodyScope, true, undefined, undefined);
              machineryUpdateSelection(w.$bodyScope);
            });

            var message = getFilter()('i18n')("notify.image.moveToFolders", [
              { "property": "imageCount", "value": selectedItems.length },
              { "property": "folderCount", "value": selectedFolders.length }
            ]);

            if (s.selected.length === 1) {
              message = message.replace("images", "image");
            }
            if (selectedFolders.length === 1) {
              message = getFilter()('i18n')("notify.image.moveToFolder", [
                { "property": "folderId", "value": selectedFolders[0].id },
                { "property": "imageCount", "value": selectedItems.length },
                { "property": "folderName", "value": selectedFolders[0].name }
              ]);
            }

            // 復原操作
            s.$root.notify({
              message: message,
              duration: 4000,
            }, function () {
              origin.forEach((item: any, index: any) => {
                if (changedMaps[item.id]) {
                  item.folders = originFolders[index];
                  item.tags = originTags[index];
                  item.isDeleted = originDeleted[index];
                }
              });
              s.selected = origin;
              syncInspectorFromScope();
              s.current = origin[0];
              syncDetailFromScope();
              syncInspectorFromScope();
              calculateImageBindingChannel.emit();
              rebindRefreshChannel.emit(true);
              updateSelectionChannel.emit();
            });

            w.electronLog && w.electronLog.info(`[app] Categorize ${selectedItems.length} files to ${selectedFolders.length} folders`);
            w.analytics.event('File', 'Categorize', 'QuickCategorize');
          }
        }
        catch (err: any) {
          w.electronLog && w.electronLog.error(err.stack || err);
        }
      });
    }
  });
}

/* ── c18g-1：getItemByElement/changeStar/gif 帧步进/addVideoComment/newFileFromTemplate ── */

/* getItemByElement（bundle 21834-21839 逐字：data-box-id 属性 → itemMappings；含
   element.id.replace("box-") 旧实现注释逐字保留） */

/* changeStar（bundle 30320-30381 逐字：空选守卫 + 零星单选无星守卫 + checkOperationSafety
   包装两分支——刪除星星（filterCounts rating 0/原星数增减 + delete image.star）与设置星星
   （原星数减/new 星数增/rating 0 减 + eagle.inspector.star 记录）+ i18n 通知 + analytics +
   updateItemsView（machinery 版）+ ayncsImagesChange/hiddenByCurrentFilter） */
export function machineryChangeStar(s: any, star: any, showNotify: any, force: any): void {
  const w = window as any;
  if (s.selected.length === 0) return;
  if (!star && s.selected.length === 1 && !s.selected[0].star) {
    return;
  }

  machineryCheckOperationSafety(s, function () {

    let changedItems: any[] = [];

    // 刪除星星
    if (star === undefined || (w.eagle.inspector.star === star && !force)) {
      for (var i = 0; i < s.selected.length; i++) {
        let image = s.selected[i];
        if (image.star) {
          w.eagle.filter.filterCounts['rating']['0']++;
          w.eagle.filter.filterCounts['rating']['' + image.star]--;
          delete image.star;
          changedItems.push(image);
        }
      }
      delete w.eagle.inspector.star;
      if (showNotify) {
        s.notify({
          message: getFilter()('i18n')('appmenu.tag>removeRating'),
          duration: 750
        });
      }
      w.electronLog && w.electronLog.info(`[app] Remove rating, total: ${changedItems.length} files`);
      w.analytics.event('Rating', 'Remove');
    }
    else {
      for (var i = 0; i < s.selected.length; i++) {
        let image = s.selected[i];
        if (image.star !== star) {
          w.eagle.filter.filterCounts['rating']['' + image.star]--;
          image.star = star;
          w.eagle.filter.filterCounts['rating']['' + star]++;
          w.eagle.filter.filterCounts['rating']['0']--;
          changedItems.push(image);
        }
      }
      w.eagle.inspector.star = star;
      var message = getFilter()('i18n')("notify.setStar.msg", [
        { "property": "star", "value": star }
      ]);
      if (showNotify) {
        s.notify({
          message: message,
          duration: 750
        });
      }
      w.electronLog && w.electronLog.info(`[app] Add ${star} star, total: ${changedItems.length} files`);
      w.analytics.event('Rating', 'Set', star);
    }
    machineryUpdateItemsView(s, s.selected);
    if (changedItems.length > 0) {
      w.ayncsImagesChange(changedItems);
      w.hiddenByCurrentFilter(changedItems);
    }
  });
}

// ── b1-9ab：searchFilter 管线移植（bundle 29211-29346 + 32182-32283 逐字）──
// 此前 s.searchFilter 无定义：machineryFilterContent 的 `data.filter(s.searchFilter)`
// 在非空关键词时抛 TypeError，被 $timeout shim 的 try 吞掉 → 关键词搜索静默失效
// （11a49 的非空用例期望空结果，崩了也空，断言空洞通过）。scopeShim get 无 fns 回退，
// 故走 machinery 赋值面（colorFilter/grayColorFilter 同类缺口另批处理）。



function machinerySearchFilter(s: any, image: any): any {
    const w = window as any;
    try {
        // 如果還沒有建立 RegEx 群組，先建立
        if (!s.searchRegexGroup) {
            s.searchRegexGroup = machineryConvertToRegexGroup(
                s.keywords,
                s.keywords_cn,
                s.keywords_tw
            );
        }

        // 建構要搜尋的文字內容
        var name = image.name || "",
            annotation = image.annotation || "",
            ext = image.ext || "",
            url = image.url || "",
            allText = "";

        // 組合所有可搜尋的文字
        if (image.text) {
            allText += image.text.toLowerCase() + " ";
        }

        if (image.rawMetas && image.rawMetas.camera) {
            allText += `${image.rawMetas.camera} `;
        }

        if (name && s.isSearchScopeName) {
            allText += `${name} `;
        }

        if (ext && s.isSearchScopeExt) {
            allText += `.${ext} `;
        }

        if (url && s.isSearchScopeUrl && s.keyword.length >= 2) {
            allText += `${url} `;
        }

        if (annotation && s.isSearchScopeNote) {
            allText += `${annotation} `;
        }

        // 標註
        if (s.isSearchScopeAnnotation && image.comments) {
            image.comments.forEach(function (comment: any) {
                allText += `${comment.annotation} `;
            });
        }

        // 字體特殊處理
        if (image.ext && w.FONT_TYPES[image.ext] && image.fontMetas) {
            var preferLng = "zh";
            var fullName = get(image.fontMetas, `fullName.${preferLng}`, undefined) ||
                           get(image.fontMetas, `fullName.en`, "");
            allText += `${fullName} `;

            if (s.keyword.length > 2 && image.fontMetas.postScriptName) {
                allText += `${JSON.stringify(image.fontMetas)} `;
            }
        }

        // 標籤
        if (s.isSearchScopeTag && image.tags && image.tags.length > 0) {
            image.tags.forEach(function (tag: any) {
                if (tag) allText += `${tag} `;
            });
        }

        // 資料夾
        if ((s.isSearchScopeFolderDesc || s.isSearchScopeFolderName) &&
            image.folders && image.folders.length > 0) {
            image.folders.forEach(function (folderId: any) {
                var folder = s.folderMappings[folderId];
                if (folder) {
                    if (s.isSearchScopeFolderName && folder.name) {
                        allText += `${folder.name} `;
                    }
                    if (s.isSearchScopeFolderDesc && folder.description) {
                        allText += `${folder.description} `;
                    }
                }
            });
        }

        // 使用 RegEx 群組進行匹配
        const regexMatch = machineryMatchWithRegexGroup(allText.toLowerCase(), s.searchRegexGroup);

        // 如果 regex 已經匹配，直接返回 true
        if (regexMatch) return true;

        // 否則使用 indexOf 進行簡單字串匹配（處理包含特殊字符的情況）
        const keywordForIndexOf = s.keyword.toLowerCase();
        return allText.toLowerCase().indexOf(keywordForIndexOf) > -1;
    }
    catch (err) {
        console.error("Search filter error:", err);
    }
    return false;
}

// ── b1-9ad：颜色筛选管线移植（bundle 32688-32813 逐字；$scope→s）──
// 此前 s.colorFilter/s.grayColorFilter 无定义：machineryFilterContent 的
// `data.filter(s.colorFilter)` 在开启颜色筛选时抛 TypeError 被吞、黑白筛选同理，
// 且 colorDistancesMap 排序比较器恒空。
// D-1 B-2：machineryColorSimilarityDistance / machineryRgbToHex 已归位 utils/color.ts
// （color-convert/delta-e 依赖随之迁出）。




/* filterContent（bundle 32583-32589 逐字；$scope→s。b1-9p 补端口——重新计算画面图片
   列表的统一入口：keyword watcher / eagle.filter 规则 watcher / 显示隐藏切换都汇聚到它，
   本体只是「清 shuffle + rebindRefresh(contentFilterCache) + 滚动归零」的编排） */

/* nextGifFrame/prevGifFrame（bundle 32838-32863 逐字：gifPlayer/gifViewer 经 scope 解析；
   **next 帧越界上界为 total-1、prev 下界 0——bundle 原样**） */
/* addVideoComment（bundle 21182-21237 逐字：swal textarea（i18n 经 window）→ guid（Tier-2）
   构造 comment（duration/annotation）→ current.comments 插入 + duration 升序排序 →
   REFRESH_VIDEO_COMMENTS 广播 + updateItemView（scope 解析）+ ipcRenderer 统一表达式
   send('image-change')） */
/* newFileFromTemplate（bundle 37336-37374 逐字：resourcesPath/EAGLE_THUMBNAIL_TEMP_PATH 为
   bundle 顶层 var 经 window、fs/path 经 window.require、i18n/FileUrlHelper 经 window、
   uploadFiles/showUploadQueue 经 scope 解析、electronLog 兜底 catch） */

/* ── c18g-2：视图开启器族（random/unfiled/untagged/recent/community/allTags/trash）── */

// ── c18g-2 域内自管（原 controller 闭包 var：openRandomTimeout 36758 邻域 /
//    openUnfiledTimeout 36773 / openUntaggedTimeout 36804 / openRecentTimeout 36835 /
//    openTrashTimeout 36968）──
let openRandomTimeout: any = null;

/* openRandom（bundle 36740-36770 逐字：同视图+有色规则外早退（callback/leaveDetailMode）+
   resetPage + image-drop-area 隐藏 + 50ms timeout（UrlStateService setState + random 专用
   thumbSize 键 + setLastFolder/updateListHeight **不调** + scrollTop 0 + reload + callback +
   screenView）——**本开启器无 ScrollbarSaver 存取，bundle 原样**） */
export function machineryOpenRandom(s: any, ignoreHistory: any, callback: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  if (s.viewMode === 'random' && s.allData.length > 0 && w.eagle.filter.filterRules.color.value == undefined) {
    if (callback) {
      callback();
    }
    if (s.isDetailMode) {
      machineryLeaveDetailMode(s);
    }
    return;
  }

  s.viewMode = 'random';
  machineryResetPage(s);
  s.$root.currentFocus = "sidebar";

  hide("#image-drop-area");
  $timeout.cancel(openRandomTimeout);
  openRandomTimeout = $timeout(function () {
    if (!ignoreHistory) {
      w.UrlStateService.setState({ view: 'random', folder: null, smartfolder: null, tag: null, color: null });
    }
    s.imageSize.height = w.localStorage.getItem("eagle.list.thumbSize.random") || 150;
    syncToolbarFromScope();
    syncBodyFromScope();
    syncDetailFromScope();
    syncInspectorFromScope();
    s.imageSize.height = parseInt(s.imageSize.height);
    syncToolbarFromScope();
    syncBodyFromScope();
    syncDetailFromScope();
    syncInspectorFromScope();
    machinerySetLastFolder(s, undefined);
    setScrollTop("#sidebar-item-container", 0);
    s.reload();
    if (callback) {
      callback();
    }
    w.analytics.screenView('Random');
  }, 50);
}

/* openUnfiled（bundle 36774-36802 逐字：早退 + ScrollbarSaver 存取 + unfiled thumbSize 键 +
   updateListHeight + restoreScrollPosition + screenView） */



/* openCommunity（bundle 36866-36888 逐字：community 面板 iframe 化——images 清空 + 详情退出 +
   lng2locale 三语映射 + OPEN_URL_IN_PANEL 广播 + leaveDetailMode（经 $bodyScope 逐字）） */
export function machineryOpenCommunity(s: any, ignoreHistory: any): void {
  const w = window as any;
  w.ScrollbarSaver.saveScrollPosition();
  s.viewMode = 'community';
  s.$root.currentFocus = "sidebar";
  machineryResetPage(s);
  s.images = [];
  s.isDetailMode = false;
  s.selected = [];
  syncInspectorFromScope();
  if (!ignoreHistory) {
    w.UrlStateService.setState({ view: 'community', folder: null, smartfolder: null, tag: null, color: null });
  }

  let lng2locale: any = {
    "zh_CN": "cn",
    "zh_TW": "tw",
    "ja_JP": "jp"
  };
  let baseUrl = `https://community-${lng2locale[w.preferences.general.language] || "en"}.eagle.cool`;
  openUrlInPanelChannel.emit(`${baseUrl}`);
  machineryLeaveDetailMode(w.$bodyScope);
}

/* openAllTags（bundle 36889-36911 逐字：同视图有色早退 + ScrollbarSaver 存 + rebindRefresh +
   TagManager.renderTagsResult（scope 字段 TagManager，48351）50ms 延迟——**无 imageSize/
   reload 面，bundle 原样**） */

/* openTrash（bundle 36969-36996 逐字：早退 + ScrollbarSaver 存取 + trash thumbSize 键 +
   updateListHeight + screenView） */

/* ── b1-3：侧栏 prev/next 导航（folder/smartFolder 四向）──────────────── */

/* openNextFolder（bundle 35689-35701 逐字：sidebarList folder 过滤 → 当前索引 +1 →
   openFolder + changeSidebarIndex（machinery 版）） */

/* openPrevFolder（bundle 35806-35835 逐字：folder -1；越界回落 smartFolders 末项 →
   quickAccess 末项（#quick-access-{id} click）→ openTrash） */

/* openNextSmartFolder（bundle 35755-35774 逐字：smartFolder(smartFolderGroup 含) 当前 +1 →
   越界回落 folders 首项） */

/* openPrevSmartFolder（bundle 35775-35804 逐字：smartFolder -1 → 越界按
   preferences.sidebar.quickAccess 门控走 quickAccess 末项或 openTrash） */

/* ── b1-4a：滚动/列表辅助族（第一批）─────────────────────────────────── */

/* autoScroll（bundle 35086-35091 逐字：AutoScroll 广播 50ms 延迟；**注意 54389 系
   $bodyScope 委派壳属子 scope controller，body scope 生效版即本闭包**） */
export function machineryAutoScroll(s: any, index: any): void {
  const $timeout = getTimeout();
  $timeout(function () {
    autoscrollChannel.emit(index);
  }, 50);
}


/* getSelectedItems（bundle 21852-21862 逐字：ig.getItems(true) × selectedMappings 过滤，
   含旧实现注释逐字保留） */
export function machineryGetSelectedItems(s: any): any[] {
  const w = window as any;
  var items = w.ig.getItems(true);
  items = items.filter(function (item: any) {
    return s.selectedMappings[item.id];
    // if (item && item.el && item.el.id) {
    //     var id = item.el.id.replace("box-", "");
    //     return $scope.selectedMappings[id] !== undefined;
    // }
  });
  return items;
}

/* getSelectedItemElements（bundle 21864-21876 逐字） */
export function machineryGetSelectedItemElements(s: any): any[] {
  var items = machineryGetSelectedItems(s);
  items = items.map(function (item: any) {
    // if (!item.el) {
    //     item.el = $(item.content)[0];
    //     console.log(item.el);
    // }
    return item.el;
  });
  return items;
}

/* getSelectedTags（bundle 38865-38869 逐字） */
export function machineryGetSelectedTags(s: any): string[] {
  if (!s.selectedTags) return [];
  return Object.keys(s.selectedTags);
}



/* checkListItemsLessThanContainer（bundle 33658-33674 逐字：<180 项时 500ms 后量
   box-list 高度不足一屏则 ig.trigger("append") 一次載入兩頁） */

/* updateSubFolderWidth（bundle 33676-33688 逐字：容器宽 → 列数 → 38+10col 修正 →
   5 取整 → 下限 90 → MAX_LIST_WIDTH 封顶 → imageSize.subfolderWidth） */


/* changeListHeight（bundle 33746-33785 逐字：5 取整 + lastImageHeight 留档 + 500ms 后
   thumbSize 键持久化（currentFolder/smartFolder/tag/viewMode 九分支键逐字）+ 即时
   box-size 属性 + relayout + scrollToCurrentItem（machinery 版）） */


/* forceFitImageSize（bundle 36481-36497 逐字：详情模式限定 + detail-image 尺寸直设 +
   usingThumbnail 分支（animated/orientation → getRawUrl，否则 thumbnail URL）） */

/* ── b1-4b：sortData/offsetScrollbar/updateFilterCounts ──────────────── */

/* Array.prototype.shuffle（bundle 2594-2605 逐字；global.js 不在 index.html，b1 后原型
   扩展随 bundle 死亡——machinery 同体幂等补丁接装，bundle 在世时为惰性重定义） */
if (!(Array.prototype as any).shuffle) {
  (Array.prototype as any).shuffle = function () {
    var tmp, current, top = this.length;

    if (top) while (--top) {
      current = Math.floor(Math.random() * (top + 1));
      tmp = this[current];
      this[current] = this[top];
      this[top] = tmp;
    }

    return this;
  };
}

/* sortData（bundle 21710-21833 逐字：NAME/EXT（Intl.Collator 20x 优化注释）/RESOLUTION/
   FILESIZE/RATING/DURATION/MANUAL（orderMappings 预登记 20x 优化 + folderId 取
   currentFolder.id）/BTIME/MTIME（降序无相等分支）/RANDOM（shuffle 原型扩展）/TAGS
   （首标签 collator）/default modificationTime 降序；languageBCP 经 window） */

/* offsetScrollbarImm（bundle 34140-34166 逐字：delay||1 后 selected 末盒居中 scrollTo；
   无选中时防越界（末盒 transform Y 与 scrollTop 比较）+ updateContainerHieght（machinery
   版经 scope）） */

/* offsetScrollbar（bundle 34168-34170 逐字）——_.debounce(100, leading) 实例 apply 时
   一次性创建（与 bundle controller init 同语义） */

/* updateFilterCounts（bundle 42946-43040 逐字：type/camera（filterCamerasMapping 联动）/
   fontActivated（installedFonts 键）/star（0 归档）/shape（横竖比 2.5 与 4:3、3:4、16:9、
   9:16 五档）——AUDIO_TYPES/FONT_TYPES/installedFonts 经 window，全程 try 静默） */

/* ── b1-5：记忆/预载族（rememberScrollTops/rememberVideoCurrentTime/addToRecentFile/
   preloadImage + getVideoPlayer 域内闭包）──────────────────────────────── */

/* getVideoPlayer（bundle 36159-36164 逐字，controller 闭包：mpv 优先 native 次之） */
/* rememberScrollTops（bundle 31142-31150 逐字：inline/edge 模式跳过 + smoothZoom
   getChangedData 快照入 lastItemStates） */

/* rememberVideoCurrentTime（bundle 31726-31736 逐字：视频类 → getVideoPlayer().el.currentTime
   → eagle.videoPlayer.currentTime.{id} 键） */
/* addToRecentFile（bundle 36435-36443 逐字：1s 后 current 换人则不记（已換人 console）→
   RecentFileManager.addFile（c14c 版经 window if-absent）） */


/* preloadImage（bundle 36449-36481 逐字：supportFoamts **typo 逐字保留** + currentIndex()
   + next 为 idx / prev 为 idx-2 + smoothZoom('preload') 100ms 防抖） */

/* ── b1-5b：homeHandler/endHandler（mod 上下委派目标）─────────────────── */

/* homeHandler（bundle 35636-35648 逐字：详情 goToY 40（zooming 类 300ms 护栏，复用 c9d
   updateZoomRatioTimeout 域内变量）+ 列表 gotoTop（fns 桥覆盖经 scope）） */
export function machineryHomeHandler(s: any, event: any): void {
  const w = window as any;
  if (s.isDetailMode) {
    beginZoomingTransition();
    detailZoom()?.goToY( 40);
  }
  else {
    machineryGotoTop(s);
  }
}

/* endHandler（bundle 35650-35664 逐字：详情 goToY -99999999 + moveY -outerHeight+60 +
   列表 gotoBottom） */
export function machineryEndHandler(s: any, event: any): void {
  const w = window as any;
  if (s.isDetailMode) {
    beginZoomingTransition();
    detailZoom()?.goToY( -99999999);
    detailZoom()?.moveY( -window.outerHeight + 60);
  }
  else {
    machineryGotoBottom(s);
  }
}

/* ── b1-6a：删除族第一批（checkOperationSafety 双件/resetFolderCover/removePermanently）── */

/* checkOperationSafety（bundle 26789-26817 逐字：selected ≥ amount 时 BulkAction 确认框
   （swal + i18n），否则/catch 直通 callback） */


/* resetFolderCover（bundle 41454-41461 逐字：getAncestorFolders（c9b machinery 版）+
   covers 清空） */

/* removePermanently（bundle 37074-37094 逐字：trash 视图限定 + raw splice 移除 +
   ayncsImagesRemove（49709 顶层 function 经 window）+ gl:removeItems + 清选 + 重建绑定） */
export function machineryRemovePermanently(s: any): void {
  const w = window as any;
  if (s.viewMode !== "trash") { return; }
  var images = s.selected;

  images.forEach(function (r: any) {
    var idx = s.raw.indexOf(r);
    if (idx != -1) {
      s.raw.splice(idx, 1);
      syncListFromScope();
    }
  });

  w.ayncsImagesRemove(images);

  var itemElements = machineryGetSelectedItemElements(s);
  glRemoveitemsChannel.emit(itemElements);
  s.selected = [];
  syncInspectorFromScope();
  machineryCalculateImageBinding(s, { ignoreSort: true }, function () {
    machineryRebindRefresh(s, true);
    machineryUpdateSelection(s);
  });
}

/* ── b1-6b：删除族第二批（removeSmartFolder/removeFolder 双层 + 多选删除）── */

/* removeSmartFolder wrapper（bundle 41831-41849 逐字：100ms 延迟确认框）+ 内部闭包
   removeSmartFolder（41851-41933 逐字：parent/顶层 children 定位 + splice + mappings 删除
   + QuickAccessManager.remove（19061 顶层 var 经 window）+ idx===0/else 双分支续开 +
   音效 + updateSidebarList + saveFolderDebounce 1s + notify undo（origin 回填 + 树重索引
   + openSmartFolder）） */


/* removeFolder wrapper（bundle 41935-41980 逐字：密码锁守卫 + 有图/有子夹时 100ms 后
   checkbox 确认框（isDeleteImages=result==1）+ checkOperationSafety2(50)） */


/* removeSelectedFolders（bundle 41981-42019 逐字：多选文件夹 checkbox 确认 + 
   checkOperationSafety2(count, 1) + 逐夹 removeFolder（ignoreRestore）） */
export function machineryRemoveSelectedFolders(s: any): void {
  const w = window as any;
  if (s.$root.selectedFolders.length === 0) return;

  var removeConfirmMsg = getFilter()('i18n')("dialog.removeFolder.descMultiple", [
    { "property": "count", "value": s.$root.selectedFolders.length },
  ]);
  w.swal({
    html: `
                    <div class="alert">
                        <div class="alert-icon warning"></div>
                        <h4 class="alert-title">${getFilter()('i18n')('dialog.removeFolder.title')}</h4>
                        <p class="alert-desc">${removeConfirmMsg}</p>
                    </div>
                `,
    showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
    width: 400,
    customClass: "alert-box",
    cancelButtonColor: "#777777",
    input: 'checkbox',
    inputValue: 1,
    inputValidator: function (result: any) {
      return new Promise(function (resolve: any, reject: any) {
        resolve(result);
      })
    },
    inputPlaceholder: getFilter()('i18n')('dialog.removeFolder.checkbox'),
    confirmButtonText: getFilter()('i18n')('dialog.removeFolder.button'),
    cancelButtonText: getFilter()('i18n')("general.cancel"),
  }).then(function (result: any) {
    machineryCheckOperationSafety2(s, s.$root.selectedFolders.length, function () {
      var isDeleteImages = (result == 1);
      s.$root.selectedFolders.forEach(function (folder: any) {
        if (folder.password && !folder.isUnLock) return;
        machineryRemoveFolderInner(s, folder, { isDeleteImages: isDeleteImages, ignoreRestore: true });
      });
    }, 1);
  }, function () { });
}

/* removeSelectedSmartFolders（bundle 42021-42058 逐字：多选智能文件夹确认 + 逐个
   removeSmartFolderInner（ignoreRestore）+ 清多选） */
export function machineryRemoveSelectedSmartFolders(s: any): void {
  const w = window as any;
  if (s.$root.selectedSmartFolders.length === 0) return;

  var removeConfirmMsg = getFilter()('i18n')("dialog.removeSmartFolder.descMultiple", [
    { "property": "count", "value": s.$root.selectedSmartFolders.length },
  ]);
  w.swal({
    html: `
                    <div class="alert">
                        <div class="alert-icon warning"></div>
                        <h4 class="alert-title">${w.i18n.__('dialog.removeSmartFolder.title')}</h4>
                        <p class="alert-desc">${removeConfirmMsg}</p>
                    </div>
                `,
    showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
    width: 400,
    customClass: "alert-box",
    cancelButtonColor: "#777777",
    confirmButtonText: w.i18n.__('dialog.removeSmartFolder.button'),
    cancelButtonText: w.i18n.__("general.cancel"),
  }).then(function (result: any) {
    s.$root.selectedSmartFolders.forEach(function (smartFolder: any) {
      machineryRemoveSmartFolderInner(s, smartFolder, { ignoreRestore: true });
    });
    s.$root.selectedSmartFolders = [];
  }, function () { });
}

/* ── b1-6c：removeFolderContents（bundle 46345-46457 逐字）────────────── */

/* removeFolderContents（清空当前文件夹内容：isForceToTrash 分流（多夹图仅摘索引 vs
   isDeleted）+ 父夹/子夹 imagesMappings 同步 + 音效 + notify undo（isDeleted/folders 回滚）
   + 自动选下一张 + gl:removeItems + RANDOM 视图跳过 rebindRefresh 分支 + electronLog 双
   分支；autoScroll/updateFilterCounts/forceFitImageSize/ScrollbarSaver 均 machinery 版） */

/* ── b1-7a：小件批（注释模式/详情淡出/插件面板/存库防抖/标签群组四向/删群组）── */


/* fadeOutDetailMode（bundle 31672-31678 逐字：selected 首盒 popdown 100ms） */
export function machineryFadeOutDetailMode(s: any): void {
  var $box = q(".box.selected");
  if ($box) $box.classList.add("popdown");
  setTimeout(function () {
    if ($box) $box.classList.remove("popdown");
  }, 100);
}

/* openPluginPanel（bundle 37324 逐字：OPEN_PLUGIN_PANEL 广播，含 // return 注释逐字） */
export function machineryOpenPluginPanel(s: any, event: any): void {
  // return;
  openPluginPanelChannel.emit();
}

/* saveFolderDebounce（bundle 42390-42396 逐字：isLibrarySaving 指示 + saveFolder 防抖 1s；
   timeout 存 scope 字段（bundle 原样 $scope.saveFolderDebounceTimeout）） */


/* 标签群组四向（bundle 48363-48416 逐字：ALL/UNFILED/STARRED 三向同构（同视图早退 +
   tagRectSelecting 复位 + keyword 清空 + tagViewMode(Name) + 焦点 tags + 清 currentTagGroup/
   selectedTags + TagManager.renderTagsResult）+ GROUP 向（blur 焦点输入 + currentTagGroup ===
   group 早退在清空之后——bundle 原样）） */




/* removeTagGroup（bundle 48620-48661 逐字：有标签确认框 → remove 内嵌闭包（TagManager
   removeGroup + 兄弟/前项续开，皆亡 openTagAllGroup）） */

/* ── b1-7b：幻灯片对/锁屏/调色板/布局/过滤入口/多开 ──────────────────── */

/* enterSlideshowMode（bundle 23824-23839 逐字：**!selected.length === 0 双重否定怪癖
   逐字保留**（实际效果为空选才能进入）+ 全屏 + enterDetailMode + 700/300ms 双层延迟缩放） */
export function machineryEnterSlideshowMode(s: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  if (s.isSlideshowMode) return;
  const duration = (w.process.platform === 'darwin') ? 300 : 100;
  if ((!s.selected.length as any) === 0) return;
  w.currentWindow.setFullScreen(true);
  machineryEnterDetailMode(s, null, s.selected[0]);
  s.isSlideshowMode = true;
  $timeout(function () {
    window.dispatchEvent(new Event("orientationchange"));
    window.dispatchEvent(new Event("resize"));
    $timeout(function () {
      machineryZoom(s, undefined);
    }, duration);
  }, 700);
  w.electronLog && w.electronLog.info(`[app] Enter slideshow mode.`);
}

/* leaveSlideshowMode（bundle 23841-23856 逐字：**setFullScreen(false) 双写——bundle 原样**） */
export function machineryLeaveSlideshowMode(s: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  const duration = (w.process.platform === 'darwin') ? 300 : 100;
  w.currentWindow.setFullScreen(false);
  s.isSlideshowMode = false;
  w.currentWindow.setFullScreen(false);
  $timeout(function () {
    window.dispatchEvent(new Event("orientationchange"));
    window.dispatchEvent(new Event("resize"));
    $timeout(function () {
      machineryZoom(s, undefined);
    }, duration);
  }, 700);
  w.electronLog && w.electronLog.info(`[app] Leave slideshow mode.`);
}

/* rgbToHex（bundle 28976-28981 逐字）—— D-1 B-2 已归位 utils/color.ts */

/* lockApp（bundle 29016-29023 逐字）+ focusAppUnlockPassword（29025-29034 逐字） */
export function machineryLockApp(s: any): void {
  const w = window as any;
  s.$root.isAppLocked = true;
  if (s.$root && typeof s.$root.initMenu === 'function') s.$root.initMenu();
  setTimeout(function () {
    machineryFocusAppUnlockPassword(s);
  }, 100);
}

export function machineryFocusAppUnlockPassword(s: any): void {
  setTimeout(() => {
    focusEl("#app-lock-password-input");
  }, 24);
  q("#app-lock-password-input")?.addEventListener("blur", () => {
    setTimeout(() => {
      focusEl("#app-lock-password-input");
    }, 24);
  });
}

/* pausePalette/resumePalette（bundle 37201/37207 逐字；change-palette-pause 通道 typo
   原样；IPCHelper c17a 接装经 window） */




/* openFilter（bundle 30173-30178 逐字）+ FILTER_ID_MAP（30204 前注释映射表逐字）+
   toggleFilterByType（30204-30216 逐字：_.throttle(300) 实例 apply 时一次性创建 +
   eagle.aiSearch 守卫） */



/* getChildFoldersMaps/Map（bundle 31890/31901 逐字，controller 闭包——供 multipleOpenFolder
   与 fns 表裸引用后备） */


/* multipleOpenFolder（bundle 38128-38162 逐字：resetFilter + 多选态切换（indexOf 增删 +
   needReload reload）+ currentFolderChildren getChildFoldersMaps） */

/* ── b1-7c：展开族/重复图/排序/搜索全览 ──────────────────────────────── */

/* expandFolder/expandSmartFolder（bundle 38054/38061 逐字：isExpand + updateSidebarList +
   localStorage 键逐字） */



/* isDuplicateImage/addToDuplicateMapping/removeFromDuplicateMapping（bundle 30572/30585/
   30591 逐字：svg/tif/tiff 排除 + getHashID（Tier-2）+ 垃圾桶排除） */



/* openDuplicate（bundle 36944-36974 逐字：selected/currentPage/all 三档
   OPEN_DUPLICATE_SCAN_PANEL 广播，selected 档含合并回调过滤 isDeleted） */

/* toggleCurrentLevelSmartFolders 内嵌闭包（38841 逐字）+ toggleAllSmartFolders 内嵌闭包
   （38831 逐字：tree.walk 全展开/收起）——localStorage 键逐字 */


/* toggleSelectSmartFolder/toggleCurrentLevelSmartFolders/toggleAllSmartFolderExpand
   （bundle 38786/38793/38803 逐字：smartFolder ±1 展开反转 / 当前层级反转 /
   全体反转（含 selectedSmartFolder 父级取向 + sidebarIndex=0）） */
export function machineryToggleSelectSmartFolder(s: any, event: any, smartFolder: any): void {
  var expand = !smartFolder.isExpand;
  var smartFolders = smartFolder.children;
  smartFolder.isExpand = expand;
  machineryToggleCurrentLevelSmartFoldersInner(s, smartFolders, expand);
}



/* setFolderOrder/setSmartFolderOrder（bundle 41360/41404 逐字：orderBy 清除/设置 +
   sortIncrease 默认 true + reload（当前匹配时）+ saveFolder（machinery 版经 scope）） */


/* updateTxtItem（bundle 34478-34489 逐字：txt 盒内容 HTML 重绘 + **selected.length === 0
   且 selected[0] === item 的矛盾守卫——bundle 原样（实际恒 false 不生效）**） */

/* ── b1-7d-1：外部站点 opener 族/教程/试用/多开/重命名入口/TouchID ────── */

/* openPinterest（bundle 26859-26871 逐字三语）+ openHuaban（26873）+ openArtstation
   （26877 广播）；shell 经 w.electron.shell（19019 解构同源） */



/* quickOpenFolder（bundle 44900-44936 逐字：openFolder(ignoreReload=true)/openAll 分流 +
   changeSidebarIndex 200ms + 自动定位（60/页倒序扫 allData → startCursor + 藏容器 reload +
   500ms select(undefined,target)+autoScroll+显容器）） */

/* multipleOpenSmartFolder（bundle 38172-38197 逐字：与 multipleOpenFolder 对称
   （smartFolder 多选态切换，currentFolder 清空）） */

/* renameFolder/renameSmartFolder（bundle 38163 邻域/38168 邻域逐字：editable + newFolderName
   + 双 100/200ms focus select——bundle 原样双写） */


/* showTutorial（bundle 37xxx 逐字：空库+单历史+无文件夹 && 教程未看过守卫 + themePath
   filter（getFilter()）+ swal 四语 open 文档跳转） */


/* unlockFolderWithTouchID（bundle 37xxx 逐字 async：canUseTouchID 守卫 + remote
   systemPreferences promptTouchID（@electron/remote 为 bundle 19020 词法绑定 →
   window.require('@electron/remote') 惰性取——nodeIntegration 两期可达）+ 解锁链 +
   失败 shake 动画 500ms + 焦点回密碼框） */

/* ── b1-7d-2：getSmartFolderList/getFolderList（侧栏树渲染核心）───────── */

/* getSmartFolderList（bundle 42644-42737 逐字：tree.walk 全树 → guidelines 色谱继承 +
   parent 指针维护（;;双分号原样）+ smartFolderList/mappings 双登记 + depth/size/vstype/
   styles 首尾位标注 + isVisible 三态 + 根层/过滤期/父可见三档入列） */

/* getFolderList（bundle 42738-42823 逐字：与 Smart 版同构 + 密码夹可见性三态
   （parent.password → isExpand && parent.isVisible && !!parent.isUnLock）+ 无
   smartFolderList/mappings 登记面——bundle 原样） */

/* ── b1-7d-3：列表滑条/元信息/移入文件夹/上传队列/链接导入 ───────────── */


/* ── b1-9bz-C-4：缩略图放大/还原（自 selectionViewDomain 迁入；原 domainEnlarge/ShrinkThumbnails
   随 imageSize.height watcher 退役改为写入点直调，故实现迁到本模块 —— 本模块不能被域反向
   import（循环），而域可以 import 本模块） ── */





/* moveToFolders（bundle 43242-43251 逐字：MOVE_TO_FOLDER 广播（folderList 活对象））
   b1-9ba：该频道全树无 $on 接收者（原接收者随 bundle 摘除退役，js/directives 侧文件
   从未挂载）——广播体移除，函数保形（快捷键 'move-to-folders' 入口与 s.moveToFolders
   挂载面不变；移动到文件夹竖切时按 React 语义归位）。 */


/* calcuteAddImageTimeLeft（bundle 45326-45338 逐字闭包：**is.number——is.min.js 为孤儿
   文件（index.html 未加载），bundle 同引用同样潜在崩——w.is 镜像同语义**） */

/* onDropContainer（bundle 52717-52928 逐字；controller 顶层函数 → 域内移植）
   裸标识符 → window：dragging（bundle 顶层 var，读写均落 window live binding）/
   require('path')/require('electron')/jQuery/$/fs/getExt/EagleConfig/IS_HIDDEN_FILE/
   IS_DIRECTORY/walk/swal/i18n/electronLog/process/sortByAZ；$scope → s（bodyScope）；
   $filter('i18n') 走 getFilter()（shim 版见 getFilter，bundle 在世走 injector 同语义）。
   TS 唯一适配：三个独占 return 分支内 bundle 重复声明 file（第 2 分支为 let）→ 统一 var
   （无行为差异）。
   诚实缺口（与既有 w.is 消费面 8744 同状态，不在 b1-9 装载链上）：dragUrl 分支的
   w.is（my_modules 无 is_js 包）与 s.uploadUrl（单数版，React 侧仅 uploadUrls）。 */
export function machineryOnDropContainer(s: any, event: any): void {
  const w = window as any;


    if (w.dragging) {
        w.dragging = false;
        return;
    }

    event && event.preventDefault();
    event && event.stopPropagation();

    var fsPath = w.require('path');
    var ipcRenderer = w.require('electron').ipcRenderer;
    var folder = s.currentFolder;
    var dragUrl: any = undefined;
    if (event.dataTransfer) {
      const holder = document.createElement("div");
      holder.innerHTML = event.dataTransfer.getData("text/html");
      dragUrl = holder.querySelector("img")?.getAttribute("src");
    }
    var files = event.dataTransfer && event.dataTransfer.files;
    var dragFile = false;

    if (!dragUrl) {
        if (w.is.url(event.dataTransfer.getData("text/plain"))) {
            dragUrl = event.dataTransfer.getData("text/plain");
        }
        // if (dragUrl && dragUrl.indexOf("data:image") === -1 ) {
        //     dragUrl = undefined;
        // }
        if (files && files[0] && files[0].path) {
            dragFile = true;
        }
    }
    console.log(dragFile);

    removeClass("#box-container", "drag-accept");

    if (!w.dragging && files.length == 1 && files[0].path.indexOf(".eaglepack") !== -1) {
        var file = files[0];
        var packPath = file.path;
        ipcRenderer.send("open-eaglepack", {
            path: packPath,
            folderId: folder && folder.id
        });
        return;
    }
	else if (!w.dragging && files.length == 1 && files[0].path.indexOf(".eagleplugin") !== -1) {
        var file = files[0];
        var pluginPath = file.path;
        ipcRenderer.send("open-eagleplugin-file", {
            path: pluginPath
        });
        return;
    }
    else if (!w.dragging && files.length == 1 && files[0].path.endsWith(".library")) {
        var file2 = files[0];
        var libraryPath = file.path;
        ipcRenderer.send('open-library', libraryPath);
        return;
    }

    if (!w.dragging && files && files[0] && files[0].path) {

        // 如果文件夾名稱過長，路徑會變成很奇怪的符號
        if (files[0] && !w.fs.existsSync(files[0].path)) {
            w.swal({
                html: `
                    <div class="alert">
                        <div class="alert-icon error"></div>
                        <h4 class="alert-title">${w.i18n.__("Dialog.PathTooLong.Title")}</h4>
                        <p class="alert-desc">${w.i18n.__("Dialog.PathTooLong.Description")}</p>
                    </div>
                `,
                showCloseButton: false, showCancelButton: false, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
                width: 360,
                customClass: "alert-box",
                cancelButtonColor: "#777777",
                confirmButtonText: w.i18n.__("general.close"),
            }).then(function () {});
            w.electronLog && w.electronLog.error("[app] Unable to add local folder, beacuse the path is too long: " + files[0].path);
            return;
        }

        console.time("拖曳档案事件");
        machineryShowUploadQueue(s);

        var fds = [];
        var notSupportFiles = [];   // 不支持添加的文件


        for (var i = 0; i < files.length; i++) {
        // for (var i = files.length - 1; i >= 0; i--) {
            var filePath = files[i].path;
            var lowercase = filePath.toLowerCase();
            var ext = w.getExt(files[i]);
            if (ext) {
                // var ext = w.getExt(files[i]);
                if (w.EagleConfig.SUPPORT_FORMATS[ext]) {
                    files[i].type = "image/" + ext;
                    fds.push(files[i]);
                }
                else if (filePath.indexOf("svg") !== -1 || filePath.indexOf("icns") !== -1 || filePath.indexOf("ico") !== -1) {
                    fds.push(files[i]);
                }
                else if (!w.IS_HIDDEN_FILE.check(lowercase)) {
                    fds.push(files[i]);
                }
            }
            // 使用者拖曳資料夾
            else if (w.IS_DIRECTORY.check(filePath)) {
                var dirFiles = w.walk(filePath);
                if (dirFiles && dirFiles.length !== 0) {
                    var now = Date.now();
                    dirFiles.forEach(function (p: any, index: any) {
                        var fpath = p;
                        // var stat = fs.statSync(fpath);
                        var f: any = {
                            name: fsPath.basename(fpath),
                            // size: stat.size,
                            path: fpath,
                            lastModified: now,
                        };
                        var ext = w.getExt(f);
                        if (w.EagleConfig.SUPPORT_FORMATS[ext]) {
                            f.type = "image/" + ext;
                            fds.push(f);
                        }
                        else if (fpath.indexOf("svg") !== -1) {
                            f.type = "image/svg+xml";
                            fds.push(f);
                        }
                        else if (fpath.indexOf("icns") !== -1) {
                            f.type = "icns";
                            fds.push(f);
                        }
                        else if (fpath.indexOf("ico") !== -1) {
                            f.type = "ico";
                            fds.push(f);
                        }
                        else {
                            fds.push(f);
                            // notSupportFiles.push(f);
                        }
                    });
                }
                else {
                    machineryHideUploadQueue(s);
                }
            }
            else {
                fds.push(files[i]);
                // notSupportFiles.push(files[i]);
            }
        }

        if (fds.length == 0 && files.length == 1 && notSupportFiles.length > 0) {
            machineryHideUploadQueue(s);
        }
        else {
            // let reason = (w.process.platform === 'darwin')? w.i18n.__("Dialog.NotSupport.Format.Descript.Mac") :  w.i18n.__("Dialog.NotSupport.Format.Descript.Windows");
            // notSupportFiles.forEach(function (file) {
            //     $bodyScope.errorList.push({
            //         type: 'ADD_ERROR',
            //         object: { 
            //             name: file.name,
            //             path: file.path 
            //         },
            //         reason: reason
            //     });
            // });
            console.log("收到 Drop，準備添加");
            // Windows 拖拽顺序无法对应当前 explorer，所以这里自己做了排序
            if (w.process.platform === 'win32') { w.sortByAZ(fds); }
            uploadFiles(fds, folder);
            if (folder) { w.electronLog && w.electronLog.info(`[app] Drop ${fds.length} files to ${folder.name}(${folder.id})(Center), path: ${fds[0].path}`); }
            else { w.electronLog && w.electronLog.info(`[app] Drop ${fds.length} files to All(Center), path: ${fds[0].path}`); }
            scopeEvalAsync();
        }
        console.timeEnd("拖曳档案事件");
    }
    // else if (!w.dragging && dragFile) {
    //     s.uploadDraggingBoard(folder, dragUrl);
    //     machineryShowUploadQueue(s);
    //     console.log("上传记忆体内的图片");
    // }
    else if (!w.dragging && dragUrl) {
        if (w.is.url(dragUrl)) {
        // if (w.is.url(dragUrl) && dragUrl.indexOf("data:image" !== -1)) {
            machineryShowUploadQueue(s);
        }
        if (w.is.url(dragUrl)) {
            s.uploadUrl(dragUrl, folder);
            if (folder) { w.electronLog && w.electronLog.info(`[app] Drop url: ${dragUrl} to ${folder.name}(${folder.id})（Center）`); }
            else { w.electronLog && w.electronLog.info(`[app] Drop url ${dragUrl} to All(Center)`); }
        }
        // bundle 原 bug 逐字保留：实参实为 ("data:image" > -1)，即 indexOf(false)
        else if ((dragUrl as any).indexOf(("data:image" as any) > -1) ) {
            s.uploadUrl(dragUrl, folder);
            if (folder) { w.electronLog && w.electronLog.info(`[app] Drop base64 url to: ${folder.name}(${folder.id})(Center)`); }
            else { w.electronLog && w.electronLog.info(`[app] Drop base64 url to All(Center)`); }
        }
        else {
            var $filter = getFilter();
            var html = (w.process.platform === 'darwin')? $filter('i18n')("Dialog.NotSupport.Format.Descript.Mac") :  $filter('i18n')("Dialog.NotSupport.Format.Descript.Windows");
            machineryHideUploadQueue(s);
            w.swal({
                title: w.i18n.__("Dialog.NotSupport.Format.Title"),
                html: html,
                showCloseButton: false, showCancelButton: false, allowOutsideClick: true, focusConfirm: true, focusCancel: false, padding: 24,
                width: 360,
                cancelButtonColor: "#777777",
                confirmButtonText: w.i18n.__("Dialog.NotSupport.Format.Buttom"),
            }).then(function () {});
        }
    }
    w.dragging = false;
}

/* showUploadQueue（bundle 45313-45324 逐字：addImageStartTime 立时 + 上传队列面板 +
   1s 剩余时间轮询）+ hideUploadQueue（45343-45351 逐字：空队列收面板 +
   updateWindowProgressBar（bundle 49810 **顶层 var throttle 单例 → window 可达**，w.* 直连
   保留原节流实例语义）） */


/* importLinks（bundle 26906-26994 逐字：剪贴板 http 预读（**clipboard 裸引 →
   w.electron.clipboard**；is.url → w.is 镜像）+ textarea 校验 swal → 逐链 HEAD 探测分流
   （image → upload-url 通道 / 其他 → 书签 url-from-extension）+ uploadQueue 占位） */

/* videoScreenShot（bundle 33233-33288 逐字 async：mpv screenshot API / native drawImage
   双路 → copyMode 剪贴板（electron.nativeImage）或 screencapture-from-extension 上送
   （guid + currentTime.toFixed(2) 命名）） */
/* getFolderImages（bundle 42841-42865 逐字：倒序扫描 raw + folders 归属判定；
   includeSubFolder 时 eagle.utils.tree.walk 子树命中即含（回调 return 原样）；
   try/catch 吞错原样） */

/* findDupclipate（bundle 28507-28868 逐字，typo 唯一：全局查重主表 + filterExtensions/
   filterCameras 建表副产物（currentFolder 空分支）+ duplicateGroupings 主动扫描（hasColorInfo
   才分组、>1 才成组）；getHashID 为 bundle 2127 顶层函数（w.* 直连，双参）；第二段循环
   var rindex/image/hashID 与首段同名 → *2 后缀（TS 语义同 var 重声明）） */


/* refreshSubfolderList（bundle 27462-27492 逐字：showSubfolderContent 分流 subFolders +
   keyword 过滤（**filter 回调非命中路径无 return——undefined 隐式剔除怪癖原样**）；
   subFolderSortableOptions.disabled 开关为 bundle 38947 controller init 种子对象
   （applyDataMachineryScope if-absent 补种）） */


/* newSmartFolder（bundle 39944-39946 逐字：$rootScope.$broadcast → s.$root（shim $root
   同体语义）） */

/* prependFolder（bundle 39968-39979 逐字：unshift + folderMappings 登记 + updateSidebarList
   + 1s 后 calculateImageBinding→saveFolder） */

/* gotoTop/gotoBottom（bundle 21886-21916 逐字：resetNgGridLayoutData 为 ngGridLayout 指令
   66970 隐式全局赋值（window 可达，w.* 直连——同 764/944 先例；post-b1 由 grid 域供给）；
   gotoBottomTimeout 存 scope 字段原样；gotoBottom else 分支 offset 死变量原样保留） */


/* ── b1-8 rename 域 ──
   emojiRegex / remainingFilenameLength / sanitize / escapeRegex / pinyinCache 已随
   D-1 B-1 归位 `utils/normalize.ts`（本域仅剩业务函数）。 */

/* selectFolder（bundle 34666-34676 逐字：文件夹单项选中重置面） */
export function machinerySelectFolder(s: any, event: any, folder: any): void {
  (document.activeElement as any).blur();
  if (folder) {
    s.selectedFolderMappings = {};
    syncListFromScope();
    s.selectedMappings = {};
    s.selectedFolderMappings[folder.id] = true;
    syncListFromScope();
    s.$root.currentFocus = "content";
    s.selected = [];
    syncInspectorFromScope();
    machineryUpdateSelection(s);
  }
}

/* enableImageNameEditable（bundle 21975-22075 逐字；controller 闭包函数）：contenteditable
   行内重命名 + exitEditable 内嵌闭包 + blur debounce（bundle 80222 顶层 var debounce →
   w.debounce 直连，200ms immediate）；blur 内 angular.element("body").scope() → getBodyScope()
   （同双轨解析）；重命名数据面 ayncsImagesChange/hiddenByCurrentFilter 为 bundle 顶层函数
   （49667/49600）→ w.* 直连（b1 终审 vendor 提取清单登记）。 */

/* enableSubFolderNameEditable（bundle 22077-22175 逐字）：子文件夹行内重命名——keydown 27
   还原**无 span 包裹**（与图片版差异原样）+ blur debounce 500ms immediate + selectFolder
   经 scope 解析（machinery 版）；exitEditable 内嵌闭包。 */

/* renameImages（bundle 41480-41496 逐字；controller 闭包函数）：多选 OPEN_RENAME 广播 /
   单选 50ms 后 enableImageNameEditable——**bundle 裸 event 引用（41492）→ w.event**
   （$timeout/setTimeout 回调期 window.event，同 bundle 语义） */




/* editTag（bundle 45532-45700 逐字）：swal 单标签重命名 + raw 倒序 tags 替换（ayncsImagesChange/
   hiddenByCurrentFilter w.* 直连）+ TagManager 群组/historyTags 更新（**45615
   angular.copy(originHistoryTags) 自复制 undefined 怪癖原样**）+ folders/smartFolders.conditions
   树替换 + tagsSuggestion 补录 + saveFolder + calculateImageBinding→rebindRefresh +
   $filter('i18n') 经 injector（getFilter）+ $rootScope.notify → s.$root.notify */

/* renameCurrentFolder（bundle 41498-41569 逐字）：F2 重命名五路分流路由——图片
   （多选 renameImages / 详情 inspector-name selectAll）→ 子文件夹（jQuery.Event 合成 +
   enableSubFolderNameEditable）→ 侧栏文件夹（batch/renameFolder）→ 智能文件夹
   （batch/renameSmartFolder）→ 标签（单 editTag / 多 OPEN_RENAME / 空 renameTagGroup
   50ms $timeout） */

/* ── b1-8 fns 表裸引用审计修复：controller 闭包裸调的 machinery 供给面（export 供
   controllerFns fns 表直调——经 ESM 循环依赖，函数声明提升运行时安全；同时接装
   非碰撞 scope 面）── */

/* getAncestorSmartFolders（bundle 42527-42542 逐字：smartFolderMappings 祖先链 +
   electronLog catch 原样） */

/* calcuteContainFolders 闭包版（bundle 27283-27325 逐字：倒序 folders 计数 +
   foldersMappings 建表（isSelected=filterRules.folder.includes）+ filter 剔 null +
   {containFoldersMappings, containFolders, noFoldersCount} 返回——**与 $scope 版
   （27259，含 containFolders 落 scope）不同体，scope 面不可接装（同名碰撞）**） */


/* calcRotateDegree（bundle 36170-36180 逐字：click 分支 shift ±90 / 其余 -90 + 360 归一；
   纯函数无 scope 依赖） */
/* getArroundBox（bundle 35094-35099 逐字：index ±20 窗口 .box 切片）——既有移植版
   5180 行（bundle 35091-35097 锚）承担，此处不再重复 */

/* toggleAllFolders / toggleCurrentLevelFolders（bundle 38730-38748 逐字：树全层 / 当前层
   isExpand 反转 + localStorage eagle.sidebar.folder.expand.* 键逐字 + updateSidebarList；
   与 smart Inners（8006/8017）同构镜像） */


/* D-1 A-4：单例 debounce/throttle 工厂缓存。
   reload/offsetScrollbar/pageUpDownHandler/toggleFilterByType 的右侧是**调用**（返回 debounce/
   throttle 实例），原挂在 scope 上按 seed 时机创建一次。直调化后改用本缓存按 scope 取用，
   保证「每 scope 一个实例」——否则每次调用新建实例会丢掉防抖/节流状态。 */
const singletonByScope = new WeakMap<object, Map<string, any>>();
function scopeSingleton<T>(s: any, key: string, make: () => T): T {
  let m = singletonByScope.get(s);
  if (!m) { m = new Map(); singletonByScope.set(s, m); }
  if (!m.has(key)) m.set(key, make());
  return m.get(key) as T;
}
export function getOffsetScrollbarFn(s: any): any { return scopeSingleton(s, 'offsetScrollbar', () => machineryOffsetScrollbar(s)); }
export function getPageUpHandlerFn(s: any): any { return scopeSingleton(s, 'pageUpHandler', () => machineryPageUpHandler(s)); }
export function getPageDownHandlerFn(s: any): any { return scopeSingleton(s, 'pageDownHandler', () => machineryPageDownHandler(s)); }
export function getToggleFilterByTypeFn(s: any): any { return scopeSingleton(s, 'toggleFilterByType', () => machineryToggleFilterByType(s)); }

/* D-1 A-2：测试诊断计数（`window.__eagleMachinery.calls`）——替代 scope 挂载 spy
 * （m1-D-filter-watch / m1-D-rebind-broadcast / m1-E-selected-watch）。
 * 仅在函数入口自增，无任何行为影响。 */
export const machineryCalls: Record<string, number> = { rebindRefresh: 0, updateSelection: 0, filterContent: 0 };

/* controller init 状态面（bundle 21242-21619 逐字——$scope→s / $rootScope→s.$root 机械替换；
   initEvent/var allTags/var updateTimer 略去：React 组件自有事件面 + 闭包死变量；
   仅 shim 世界调用（bundle 在世时状态由 controller init 填充，零调用零改变）） */
export function machinerySeedControllerState(s: any): void {
  const w = window as any;
        s.libraryHistory = [];  // bundle 20535（seed 区间外的 controller init 字段——showTutorial 等消费）
        s.MAX_LIST_WIDTH = 900;
        syncToolbarFromScope();
        s.MAX_DIMENSION = 120000000;
        s.isHideMainNav = true;	// 3.0 侧栏
        s.isHideSidebar = false;
        s.isHideSubFolder = true;
        s.isHideNavigator = false;
        s.unlockPassword = "";
        // 音效三件套（bundle 20238-20254 逐字；$.playSound 由 js/vendors/jquery-audio.js 提供，
        // 该插件原内联在 app.bundle.js 内，b1-9d 后由 index.html 独立引入）
        s.removeSound = {
            play: function () {
                w.__eagleAudio.playSound('sounds/remove.wav');
            }
        };
        s.duplicateSound = {
            play: function () {
                w.__eagleAudio.playSound('sounds/duplicate.wav');
            }
        };
        s.errorSound = {
            play: function () {
                w.__eagleAudio.playSound('sounds/error.wav');
            }
        };
        // b1-9l：controller init 接线补种三件（b1-9g 台账根因 5 + fx/fc 补种）
        // platform（bundle 20066 `$scope.platform = process.platform`——BodyBindings 的
        // data-platform 属性唯一数据源，shim 世界此前无人写入）
        s.platform = w.process && w.process.platform ? w.process.platform : undefined;
        // containerSize（bundle 21095-21121 逐字；React 侧 bodyState:159 直接消费
        // scope.containerSize.sidebar、BodyBindings 面板 left = sidebarWidth+1——bundle 默认
        // 240 与 React 旧兜底 220 不一致，以 bundle 为准。$$rebind::refreshContainSize 广播
        // 为 Angular rebind 系统工件，shim 世界由 bodyState 的 watch 自动跟随；
        // #sidebar 的 resizable 指令（index.html:34）b1 后失效，拖拽写回链待办）
        s.containerSize = { sidebar: 240 };
        syncSidebarFromScope();
        syncTagManagerFromScope();
        const sidebarSizeRaw = localStorage.getItem("eagle.containerSize.sidebar");
        if (sidebarSizeRaw) {
            s.containerSize.sidebar = parseInt(sidebarSizeRaw);
            syncBodyFromScope();
            syncSidebarFromScope();
            syncTagManagerFromScope();
            if (s.containerSize.sidebar < 200) s.containerSize.sidebar = 200;
            syncBodyFromScope();
            syncSidebarFromScope();
            syncTagManagerFromScope();
        }
        const tagSidebarRaw = localStorage.getItem("eagle.containerSize.tagSidebar");
        if (tagSidebarRaw) {
            s.containerSize.tagSidebar = parseInt(tagSidebarRaw);
            syncBodyFromScope();
            syncSidebarFromScope();
            syncTagManagerFromScope();
        }
        const tagFilterRaw = localStorage.getItem("eagle.containerSize.tagFilter");
        if (tagFilterRaw) {
            s.containerSize.tagFilter = parseInt(tagFilterRaw);
            syncBodyFromScope();
            syncSidebarFromScope();
            syncTagManagerFromScope();
        }
        // fixUtils（bundle 20513 `$scope.fixUtils = {}`——fixutil 进度对话框开合状态载体；
        // 缺席时 body.fixUtils.isFixing 赋值直接 TypeError、7d6c 的 fx/fc 对话框永不出现）
        s.fixUtils = {};
        // containTags（bundle 20533 `$scope.containTags = []`——updateSuggestions/
        // machineryCalcuteFilterBadge 读取；缺席时 search 链在 updateSuggestions 处
        // TypeError 断链、filterContent 永不执行（b1-9o 探针实证））
        s.containTags = [];
        syncFilterFromScope();
        // page（bundle 21062 `$scope.page = 1`——rebindRefresh 的
        // `s.filtereds = s.allData.slice(0, s.len * s.page)` 乘数；缺席时 NaN →
        // filtereds 恒空数组（b1-9o 探针实证 a4 空态无法闭合））
        s.page = 1;
        // historySearchKeywords（bundle 21097-21103 逐字——updateSuggestions 首行读取，
        // 缺席时 search 防抖体 TypeError 断链、filterContent 永不执行（b1-9o 计数探针实证））
        var historySearchKeywords = localStorage.getItem("historySearchKeywords");
        if (historySearchKeywords) {
            try {
                s.historySearchKeywords = JSON.parse(historySearchKeywords);
            }
            catch (err) {
                s.historySearchKeywords = [];
            }
        }
        else {
            s.historySearchKeywords = [];
        }
        // initPlugins（bundle 20028 RootController init 调用——scope.inspector.inspectorItems
        // 只由它填充，stage6 的 tags/folders/annotations/information 分区渲染数据源；
        // eagleClasses 在 main.tsx 侧副作用安装，先于域接管；pluginModule 经 b1-9j 桥接）
        if (w.eagle && w.eagle.inspector && typeof w.eagle.inspector.initPlugins === 'function') {
            w.eagle.inspector.initPlugins();
        }
        // eagle（b1-9p：bundle $rootScope.eagle 的 shim 等价——scope 链上 'eagle.filter...'
        // 字符串 watcher（evalPath 经 coreState 解析）与 toolbarState 等快照的数据源；
        // 缺席时 watcher 读取抛 TypeError 被 flushWatchers 吞掉、listener 永不触发）
        s.eagle = w.eagle;
        // inspector.width（b1-9o：bundle 由 inspector 面板 resize 维护——React ResizeObserver 前
        // 对齐 inspectorState store 的兜底默认 300（ProgressBars/面板 right = width+1）；
        // s.inspector 即 w.eagle.inspector（bundle 21615 同引用）
        if (w.eagle && w.eagle.inspector && w.eagle.inspector.width === undefined) {
            w.eagle.inspector.width = 300;
        }
        s.len = 100;
        s.sidebarList = [];
        syncSidebarFromScope();
        s.sidebarIndex;
        s.all = [];
        syncSidebarFromScope();
        s.trash = [];
        syncSidebarFromScope();
        syncListFromScope();
        s.untaggedCount = 0;
        s.unfiledCount = 0;
        s.images = [];
        s.selected = [];
        syncInspectorFromScope();
        s.selectedMappings = {};
        s.lockedImages = {};
        s.filtereds = [];
        syncListFromScope();
        s.allData = [];
        syncListFromScope();
        s.shuffle = [];
        s.$root.selectedFolders = [];
        syncListFromScope();
        s.$root.selectedFoldersMappings = {};
        s.$root.selectedSmartFolders = [];
        s.$root.selectedSmartFoldersMappings = {};
        s.folderMappings = {};
        s.smartFolderMappings = {};
        s.uploadQueue = [];
        syncUploadFromScope();
        s.finishQueue = [];
        syncUploadFromScope();
        s.finishGenerateQueue = [];
        s.regenerateThumbnailQueue = [];
        
        s.duplicateQueue = [];
        s.$root.currentFocus = "sidebar";
        s.showSubfolderContent = false;
        s.showOriginalImageWhenLarge = localStorage.getItem("eagle.list.show.originalImageWhenLarge") !== 'false'
        syncPanelFromScope();
        s.showName = false;
        syncPanelFromScope();
        s.showMetas = false;
        syncPanelFromScope();
        s.showAnnotation = true;
        syncPanelFromScope();
        s.showFileExtension = true;
        syncPanelFromScope();
        s.showFileExtensionLabel = true;
        syncPanelFromScope();
        s.orderBy = localStorage.getItem("eagle.list.orderBy") || "IMPORT";
        syncBodyFromScope();
        s.orderByName = w.i18n.__(`context.order.orderBy>${s.orderBy.toLowerCase()}`);
        s.isSearchScopeName = true;
        s.isSearchScopeFolderName = true;
        s.isSearchScopeFolderDesc = true;
        s.isSearchScopeExt = true;
        s.isSearchScopeTag = true;
        s.isSearchScopeUrl = true;
        s.isSearchScopeAnnotation = true;
        s.isSearchScopeNote = true;
        s.listMetaType = localStorage.getItem("eagle.list.meta.type") || "RESOLUTION";
        syncPanelFromScope();
        s.sortIncrease = true;
        s.layout = "";
        s.layoutOptions = localStorage["eagle.list.layout.options"] || "Fit";
        syncPanelFromScope();
        s.paletteQueuePaused = false;
        syncSidebarFromScope();
        s.paletteQueueDelay = 20;
        
        // Grid Layout 相关
        s.itemMappings = {};
        s.modifiedMappings = {};
        s.options = {
            page: 60,           // 每页数量
            preload: 1,         // 预先载入页次，如果填写 3 表示载入 page x 3 个内容
            align: "left"     // 瀑布流排版对其方式
        };

        s.folderIcons = [

            // 集合、多媒体、工具
            { type: 'icon' },
            { type: 'icon', icon: 'library' },
            { type: 'icon', icon: 'box' },
            { type: 'icon', icon: 'grid' },
            { type: 'icon', icon: 'layer' },
            { type: 'icon', icon: 'briefcase' },
            { type: 'icon', icon: 'photo' },
            { type: 'icon', icon: 'photos' },
            { type: 'icon', icon: 'video' },
            { type: 'icon', icon: 'film' },
            { type: 'icon', icon: 'film2' },
            { type: 'icon', icon: 'film3' },
            { type: 'icon', icon: 'music' },
            { type: 'icon', icon: 'book' },
            { type: 'icon', icon: 'book2' },
            { type: 'icon', icon: 'bookshelf' },
            { type: 'icon', icon: 'keynote' },
            { type: 'icon', icon: 'camera' },
            { type: 'icon', icon: 'aperture' },
            { type: 'icon', icon: 'attachment' },
            { type: 'icon', icon: 'scissors' },
            { type: 'icon', icon: 'palette' },
            { type: 'icon', icon: 'wrench' },
            { type: 'icon', icon: 'helmet' },
            { type: 'icon', icon: 'life-buoy' },
            { type: 'icon', icon: 'graph' },
            { type: 'icon', icon: 'graph2' },
            { type: 'icon', icon: 'tableware' },
            { type: 'icon', icon: 'cog' },
            { type: 'icon', icon: 'bachelor-cap' },
            { type: 'icon', icon: 'cones' },
            { type: 'icon', icon: 'dribbble' },
            { type: 'icon', icon: 'email' },
            { type: 'icon', icon: 'business-card' },
            { type: 'icon', icon: 'coffee' },
            { type: 'icon', icon: 'cart' },
            { type: 'icon', icon: 'lightbulb' },
            { type: 'icon', icon: 'inspiration' },
            
            // { type: 'separator' },

            // 评价、符号、钱、时间
            { type: 'icon', icon: 'thumb-up' },
            { type: 'icon', icon: 'thumb-down' },
            { type: 'icon', icon: 'like' },
            { type: 'icon', icon: 'unlike' },
            { type: 'icon', icon: 'star' },
            { type: 'icon', icon: 'hot' },
            { type: 'icon', icon: 'upload' },
            { type: 'icon', icon: 'download' },
            { type: 'icon', icon: 'paid' },
            { type: 'icon', icon: 'free' },
            { type: 'icon', icon: 'medical' },
            { type: 'icon', icon: 'shield' },
            { type: 'icon', icon: 'search' },
            { type: 'icon', icon: 'shortcuts' },
            { type: 'icon', icon: 'recycle' },
            { type: 'icon', icon: 'excalmation' },
            { type: 'icon', icon: 'question' },
            { type: 'icon', icon: 'coin1' },
            { type: 'icon', icon: 'coin2' },
            { type: 'icon', icon: 'coin3' },
            { type: 'icon', icon: 'coin4' },
            { type: 'icon', icon: 'wallet' },
            { type: 'icon', icon: 'watch' },
            { type: 'icon', icon: 'clock' },
            { type: 'icon', icon: 'calendar-week' },
            { type: 'icon', icon: 'calendar-month' },

            { type: 'separator' },

            // 设备、图表、设计类型、字体
            { type: 'icon', icon: 'website' },
            { type: 'icon', icon: 'phone' },
            { type: 'icon', icon: 'tablet' },
            { type: 'icon', icon: 'desktop' },
            { type: 'icon', icon: 'tv' },
            { type: 'icon', icon: 'cpu' },
            { type: 'icon', icon: 'safari' },
            { type: 'icon', icon: 'chrome' },
            { type: 'icon', icon: 'pie' },
            { type: 'icon', icon: 'bar-chart' },
            { type: 'icon', icon: 'line-chart' },
            { type: 'icon', icon: '2d' },
            { type: 'icon', icon: '3d' },
            { type: 'icon', icon: 'contrast' },
            { type: 'icon', icon: 'texture' },
            { type: 'icon', icon: 'transition' },
            { type: 'icon', icon: 'animation' },
            { type: 'icon', icon: 'spectrogram' },
            { type: 'icon', icon: 'font-sans' },
            { type: 'icon', icon: 'font-sans-serif' },
            { type: 'icon', icon: 'font-handwritten' },

            // { type: 'separator' },

            { type: 'icon', icon: 'flag' },
            { type: 'icon', icon: 'earth' },
            { type: 'icon', icon: 'pin' },
            { type: 'icon', icon: 'pin-check' },
            { type: 'icon', icon: 'map' },
            { type: 'icon', icon: 'road' },
            { type: 'icon', icon: 'motor' },
            { type: 'icon', icon: 'rocket' },
            { type: 'icon', icon: 'airplan' },
            { type: 'icon', icon: 'ship' },
            { type: 'icon', icon: 'train' },
            { type: 'icon', icon: 'car' },
            { type: 'icon', icon: 'truck' },
            { type: 'icon', icon: 'water-drop' },
            { type: 'icon', icon: 'sun' },
            { type: 'icon', icon: 'moon' },
            { type: 'icon', icon: 'tree' },
            { type: 'icon', icon: 'mountain' },
            { type: 'icon', icon: 'cloud' },

            // { type: 'separator' },

            // 建筑、家俱、游戏、成就
            { type: 'icon', icon: 'bathtub' },
            { type: 'icon', icon: 'door' },
            { type: 'icon', icon: 'bed' },
            { type: 'icon', icon: 'cabinet' },
            { type: 'icon', icon: 'sofa' },
            { type: 'icon', icon: 'home' },
            { type: 'icon', icon: 'store' },
            { type: 'icon', icon: 'house' },
            { type: 'icon', icon: 'game' },
            { type: 'icon', icon: 'weapon' },
            { type: 'icon', icon: 'armor' },
            { type: 'icon', icon: 'award2' },
            { type: 'icon', icon: 'award' },
            { type: 'icon', icon: 'award3' },
            { type: 'icon', icon: 'crown' },
            { type: 'icon', icon: 'rophy' },
            { type: 'icon', icon: 'gift' },
            { type: 'icon', icon: 'facebook' },
            { type: 'icon', icon: 'twitter' },
            { type: 'icon', icon: 'instagram' },

            { type: 'separator' },

            // 人、動物、神、魔
            { type: 'icon', icon: 'eye' },
            { type: 'icon', icon: 'bear' },
            { type: 'icon', icon: 'dog' },
            { type: 'icon', icon: 'cat' },
            { type: 'icon', icon: 'man' },
            { type: 'icon', icon: 'woman' },
            { type: 'icon', icon: 'group' },
            { type: 'icon', icon: 'smile' },
            { type: 'icon', icon: 'meh' },
            { type: 'icon', icon: 'frown' },
            { type: 'icon', icon: 'die' },
            { type: 'icon', icon: 'baby' },
            { type: 'icon', icon: 'kid' },
            { type: 'icon', icon: 'angel' },
            { type: 'icon', icon: 'demon' },
            { type: 'icon', icon: 'hand' },
            { type: 'icon', icon: 'brain' },

            { type: 'separator' },

            // 数字
            { type: 'icon', icon: 'number0' },
            { type: 'icon', icon: 'number1' },
            { type: 'icon', icon: 'number2' },
            { type: 'icon', icon: 'number3' },
            { type: 'icon', icon: 'number4' },
            { type: 'icon', icon: 'number5' },
            { type: 'icon', icon: 'number6' },
            { type: 'icon', icon: 'number7' },
            { type: 'icon', icon: 'number8' },
            { type: 'icon', icon: 'number9' },
            { type: 'icon', icon: 'number10' },
            { type: 'icon', icon: 'number11' },
            { type: 'icon', icon: 'number12' },
            { type: 'icon', icon: 'number13' },
            { type: 'icon', icon: 'number14' },
            { type: 'icon', icon: 'number15' },
            { type: 'icon', icon: 'number16' },
            { type: 'icon', icon: 'number17' },
            { type: 'icon', icon: 'number18' },
            { type: 'icon', icon: 'number19' },
            { type: 'icon', icon: 'number20' },
        ];

        if (localStorage.getItem("isHideMainNav") == 'true') {
            s.isHideMainNav = true;
        }

        if (localStorage.getItem("isHideSidebar") == 'true') {
            s.isHideSidebar = true;
        }

        if (localStorage.getItem("isHideSubFolder") == 'false') {
            s.isHideSubFolder = false;
        }

        if (localStorage.getItem("eagle.list.sortIncrease") == 'false') {
            s.sortIncrease = false;
        }

        if (localStorage.getItem("isHideNavigator") == 'true') {
            s.isHideNavigator = true;
        }

        if (localStorage.getItem("eagle.search.scope.name") === 'false') { s.isSearchScopeName = false; }
        if (localStorage.getItem("eagle.search.scope.folderName") === 'false') { s.isSearchScopeFolderName = false; }
        if (localStorage.getItem("eagle.search.scope.folderDesc") === 'false') { s.isSearchScopeFolderDesc = false; }
        if (localStorage.getItem("eagle.search.scope.ext") === 'false') { s.isSearchScopeExt = false; }
        if (localStorage.getItem("eagle.search.scope.tag") === 'false') { s.isSearchScopeTag = false; }
        if (localStorage.getItem("eagle.search.scope.url") === 'false') { s.isSearchScopeUrl = false; }
        if (localStorage.getItem("eagle.search.scope.annotation") === 'false') { s.isSearchScopeAnnotation = false; }
        if (localStorage.getItem("eagle.search.scope.note") === 'false') { s.isSearchScopeNote = false; }
        // b1-9ab：searchFilter 管线（bundle 32182 逐字；machineryFilterContent 的
        // `data.filter(s.searchFilter)` 消费面——此前无定义、非空关键词 TypeError 被吞）
        // b1-9ad：颜色/黑白筛选（bundle 32689/32797 逐字；machineryFilterContent 的
        // data.filter(...) 消费面已改直调 machineryColorFilter/machineryGrayColorFilter）
        w.preferences = (w.electronSettings && w.electronSettings.getPreferences) ? w.electronSettings.getPreferences() : (w.preferences || {});
        s.showSubfolderContent = w.preferences.showSubfolderContent;

        if (localStorage.getItem("eagle.list.show.name") == 'false') {
            s.showName = false;
            syncPanelFromScope();
            addClass("#box-container", "hide-box-name");
        }
        else {
            s.showName = true;
            syncPanelFromScope();
            removeClass("#box-container", "hide-box-name");
        }

        if (localStorage.getItem("eagle.list.show.meta") == 'false') {
            s.showMetas = false;
            syncPanelFromScope();
            addClass("#box-container", "hide-box-metas");
        }
        else {
            s.showMetas = true;
            syncPanelFromScope();
            removeClass("#box-container", "hide-box-metas");
        }

        if (localStorage.getItem("eagle.list.show.annotation") == 'false') {
            s.showAnnotation = false;
            syncPanelFromScope();
            addClass("#box-container", "hide-box-annotation");
        }

        if (localStorage.getItem("eagle.list.show.extension") == 'false') {
            s.showFileExtension = false;
            syncPanelFromScope();
            addClass("#box-container", "hide-box-extension");
        }

        if (localStorage.getItem("eagle.list.show.extension_LABEL") == 'false') {
            s.showFileExtensionLabel = false;
            syncPanelFromScope();
            addClass("#box-container", "hide-box-extension-label");
        }

        let defaultListLayoutSettings = {
            props: {
                resolution: true,
                fileSize: true,
                dateImported: true,
                tags: false,
                extension: true,
                rating: false
            }
        };
        if (localStorage["eagle.list.layout.settings"]) {
            try {
                s.listLayoutSettings = JSON.parse(localStorage["eagle.list.layout.settings"]);
                syncBodyFromScope();
            } catch (err) {
                s.listLayoutSettings = defaultListLayoutSettings;
                syncBodyFromScope();
            }
        }
        else {
            s.listLayoutSettings = defaultListLayoutSettings;
            syncBodyFromScope();
        }

        s.imageSize = {
            height: 150,
            zoomRatio: 100,
            subfolderWidth: 150
        };
        syncToolbarFromScope();
        syncBodyFromScope();
        syncDetailFromScope();
        syncInspectorFromScope();
        s.sliderZoomRatio = 100;
        syncDetailFromScope();
        s.lastZoomMode = localStorage["eagle.viewer.lastZoomMode"] || "fit";
        syncDetailFromScope();
        s.tagsSuggestion = [];
        s.folders = [];
        s.smartFolders = [];
        s.quickAccess = [];
        syncSidebarFromScope();
        s.isExpandFolder = true;
        syncSidebarFromScope();
        s.isExpandSmartFolder = true;
        syncSidebarFromScope();
        s.isExpandQuickAccess = true;
        syncSidebarFromScope();

        if (localStorage.getItem("eagle.sidebar.folder.expand") == 'false') {
            s.isExpandFolder = false;
            syncSidebarFromScope();
        }
        if (localStorage.getItem("eagle.sidebar.smartFolder.expand") == 'false') {
            s.isExpandSmartFolder = false;
            syncSidebarFromScope();
        }
        if (localStorage.getItem("eagle.sidebar.quickAccess.expand") == 'false') {
            s.isExpandQuickAccess = false;
            syncSidebarFromScope();
        }

        s.inspector = w.eagle.inspector;
}

let applied = false;
export function applyDataMachineryScope(): void {
  if (applied) return;
  applied = true;
  const s = getBodyScope();
  if (!s) return;

  // b1-9d：controller init 状态面种子（仅 shim 世界——bundle 在世时由 controller init
  // 填充同名默认值，此处调用为恒等幂等）
  if (s.__eagleShim) {
    machinerySeedControllerState(s);
  }

  // b1-9d：TagManager 供给（bundle 48351 $scope.TagManager = TagManager 的 shim 等价；
  // bundle 在世时 s.TagManager 已存在，零调用）
  if (s.__eagleShim && !s.TagManager) {
    const w = window as any;
    w.TagManager = machineryBuildTagManager(s);
    syncFilterFromScope();
    syncTagManagerFromScope();
    s.TagManager = w.TagManager;
    syncFilterFromScope();
    syncTagManagerFromScope();
  }

  // b1-9d：controller init 注入面补种（bundle 20055 `$rootScope.preferences = preferences` /
  // 20208 `$scope.UrlStateService = UrlStateService`；种子区间 21242-21619 之外的同批 DI 本地）
  // ——shim 世界无 Angular DI，同名本地改由窗口单例供给：
  //   · s.UrlStateService：dataMachinery 逐字端口按 scope 解析（openAll/nextHistory/prevHistory、
  //     toolbarState 消费），缺失时 openAll 的 $timeout 回调首行即抛，reload/listDone 永不置位；
  //   · s.preferences：shim 的 $root 即 scope 自身，故 s.preferences 同时覆盖
  //     s.$root.preferences（updateSidebarList 消费 .sidebar.*）。
  // if-absent + shim-only：bundle 在世时两处均由 controller init 赋值，零调用零改变。
  if (s.__eagleShim) {
    const w = window as any;
    if (!s.preferences && w.preferences) s.preferences = w.preferences;
    if (!s.UrlStateService && w.UrlStateService) s.UrlStateService = w.UrlStateService;
  }

  // b1-7e：subFolderSortableOptions（bundle 38947 controller init 种子逐字——React 侧写方
  // machineryRefreshSubfolderList 开关 .disabled；ListRegion ui-sortable 消费原对象
  // {...options}，update 回调 $timeout 经 injector（getTimeout，缺 Angular 时跳过））
  if (!s.subFolderSortableOptions) {
    s.subFolderSortableOptions = {
      distance: 10,
      disabled: false,
      tolerance: "pointer",
      helper: 'clone',
      update: function (e: any, ui: any) {
        machineryUpdateSidebarList(s);
        const $timeout = getTimeout();
        $timeout && $timeout(function () {
          machinerySaveFolder(s);
        }, 500);
      },
    };
  }

  // scope 函数替换：此后 bundle 侧全部 $scope.calculateImageBinding 调用面（muteCalcuteImageBinding/
  // library.changed 等）即走移植实现（绞杀内部机器）。c9b：rebindRefresh/rebindRefreshLazy/
  // updateSidebarList 一并替换（React 域 10+ 处调用面 + bundle 18203/18438/$broadcast 路径）。
  // D-1 A-2：rebindRefresh/filterContent 挂载已退役——filterDomain 域内监听 / filterService
  // 写入点 / 各组件均已 import 直调；调用观测改用 __eagleMachinery.calls 计数。
  // c9c：updateItemsView/switchLayout/prependImages/reload（reload = 一次性创建的 leading-edge
  // 防抖实例，与 bundle controller init 同语义）
  s.reload = machineryReload(s);
  // c9d：缩放/放映/计数/最近文件夹（getRatioExp/getRatioNonExp 纯函数被 updateZoomRatio
  // 与 React 域 24 处调用面共用）
  // D-1 A-2：toggleSlideshow 挂载已退役（DetailViewer/miscDomain/itemMenuService/mediaService 均 import 直调）
  // c9e：updateItemView（updateItemsView 循环体；bundle 侧 $bodyScope.updateItemView 19688-19751
  // 与 ipc 路径 21234/23632+ 全部改走移植版）
  // c13：relayout（ig/eg 经 window 解析）
  // c14：existInSmartFilter（26 规则函数经 window + MATCH_FUNCTION 表）
  // c14b：筛选引擎（filterData/calcuteFilterResult scope 替换——rebindRefresh 的
  // await s.calcuteFilterResult 即走移植实现）
  // c14c：contentFilter/calcuteContainTags + RecentFileManager（if-absent）
  // D-1 A-2：contentFilter 挂载已退役（FolderModals/bundleGlobals/FolderSelectPanels 谓词位置改直调包装）
  const w2 = window as any;
  if (!w2.RecentFileManager) w2.RecentFileManager = buildRecentFileManager();
  // c15：updateSelection/zoom
  // D-1 A-2 误判修正（2026-09-11 全量套件实测）：`electron/main.cjs` 工作流驱动脚本经 scope 面
  // 直调 updateSelection（:1858，**无 typeof 守卫**）与 zoom（:2932/3015，try 包裹）——脚本
  // 无法 import ESM，必须以 scope 面供给（同 B-8 跨边界清单）。此前「主窗口无消费面」结论
  // 只扫了 React 树，漏掉 main.cjs；缺 updateSelection 会使 m1 selectItems 直接 TypeError。
  s.updateSelection = () => machineryUpdateSelection(s);
  s.zoom = () => machineryZoom(s);
  // 同因：main.cjs 主窗工作流还直调 changeStar（:2058/2083）、removeSelected（:2192）、
  // toggleAll（:2319/2325）、addImagesToFolder（:2057）；selectNext/selectPrev 为详情导航
  // 的 bundle scope 面（DetailViewer 以 typeof 守卫消费），一并恢复以保 parity。
  s.changeStar = (...a: any[]) => (machineryChangeStar as any)(s, ...a);
  s.removeSelected = (...a: any[]) => (machineryRemoveSelected as any)(s, ...a);
  s.toggleAll = (...a: any[]) => (machineryToggleAll as any)(s, ...a);
  s.selectNext = (...a: any[]) => (machinerySelectNext as any)(s, ...a);
  s.selectPrev = (...a: any[]) => (machinerySelectPrev as any)(s, ...a);
  // c15b：adjustLayoutWidth/zoomFit
  // c15c：getSelection/changeSidebarIndex/resetPage/calculateFilterCounts
  // c15d：openAll + ScrollbarSaver（if-absent；bundle 在世沿用其隐式全局绑定）
  if (!w2.ScrollbarSaver) w2.ScrollbarSaver = buildScrollbarSaver();
  // c16a：enterDetailMode/leaveDetailMode（**保留挂载**：frontend/public/shims.js 以 25ms 轮询
  // 包装 scope.enterDetailMode/leaveDetailMode 实现详情原图交付门控——属全局消费面，
  // D-2 退役 shims.js 前不可删；应用内真实入口已走 import 直调。）
  s.enterDetailMode = ($event: any, image: any) => machineryEnterDetailMode(s, $event, image);
  s.leaveDetailMode = () => machineryLeaveDetailMode(s);
  // c16c：saveFolder
  // c17b：notify（root scope 函数——bundle $rootScope.notify 20157 的等价实现，root/body
  // 双写保证 $rootScope.notify 直调与 s.notify 原型链解析都走移植版）
  const notifyFn = (params: any, restoreCallbackk: any) => machineryNotify(s, params, restoreCallbackk);
  s.$root.notify = notifyFn;
  s.notify = notifyFn;
  // c18a：smartZoom/lastZoom
  // c18b：zoomActual/toggleZoom/zoomFitEdge/updateContainerHieght
  // c18c：undo/nextHistory/prevHistory/back
  // c18d：selectAll/toggleDetailMode
  // c18e-1：selectNext/selectPrev
  // c18e-2：multipleSelect 四件套
  // c18e-2b：removeSelected
  // c18e-3：quicklook/copyImages
  // c18e-4：方向键/修饰键 handler 族（第一批）
  // c18e-5：keyUp/keyDown（侧栏导航级联 + QuickAccess/Group 闭包域内移植）
  // c18e-6：selectUp/Down + pageUp/pageDown（throttle 实例经 getPage*HandlerFn 单例缓存）
  // c18f-1：小 handler 批
  // b1-9ay：评级键族补齐（mousetrap '0'-'5' 六键的 handler 此前仅 changeTo5Star 在册）
  // c18f-2：openParentFolder/createTxtFileFromTemplate/setFolderCover
  // c18f-3：inspector 面板/快捷搜索打开器
  // c18g-1：getItemByElement/changeStar/gif 帧步进/addVideoComment/newFileFromTemplate
  // c18g-2：视图开启器族
  // b1-3：侧栏 prev/next 导航四向
  // b1-4a：滚动/列表辅助族第一批
  // D-1 A-2：currentIndex 挂载已退役（imageOpsService/detailState/域内均 import 直调）
  // b1-4b：sortData/offsetScrollbar/updateFilterCounts（offsetScrollbar 实例经 getOffsetScrollbarFn 单例缓存）
  // b1-5：记忆/预载族
  // b1-5b：homeHandler/endHandler
  // b1-6a：删除族第一批
  // b1-6b：删除族第二批
  // b1-6c：removeFolderContents
  // b1-7a：小件批
  // b1-7b：幻灯片/锁屏/调色板/布局/过滤入口/多开
  // b1-7c：展开族/重复图/排序/搜索全览
  // b1-7d-1：外部站点/教程/试用/多开/重命名入口/TouchID
  // D-1 A-2：quickOpenFolder 挂载已退役（Inspector/DuplicateFamily import 直调）
  // b1-7d-2：侧栏树渲染核心
  // b1-7d-3：列表滑条/元信息/移入文件夹/上传队列/链接导入/截屏
  // D-1 A-2：showUploadQueue 挂载已退役（apiServerDomain import 直调）
  // b1-9d 收口：onDropContainer（bundle 顶层 function → 同 window live binding 语义）。
  // 三处消费面都要命中：① smoke/CDP 直接调全局 onDropContainer(...)；② ListRegion
  // scopeFn('onDropContainer') 只在 scope 上找；③ callScope 先查 fns 表再查 scope
  // ——两者均不回落 window，故 window 与 scope 都要挂。bundle 在世时 window 已有绑定，
  // if-absent 零改变。
  s.onDropContainer = (event: any) => machineryOnDropContainer(s, event);
  if (s.__eagleShim && !(window as any).onDropContainer) (window as any).onDropContainer = s.onDropContainer;
  // b1-7e：全局查重（getFolderImages/findDupclipate）+ 子文件夹列表 + 搜索聚焦 +
  // 新建智能文件夹/前置插入 + 列表滚顶/滚底
  // b1-8：rename 域（路由 + 图片/子文件夹行内编辑 + 批量 + 标签/群组 + selectFolder）
  // b1-8 裸引用审计修复：controllerFns fns 表内闭包裸调改走 scope 解析——闭包三件
  // （getExtendTags/getChildFoldersMaps/getChildFoldersMap）+ setViewMode 闭包 debounce
  // 经 apply 接装后可解析（machinery 版本均已存在；setViewMode 现为 export 直调）
  // b1-8 续：闭包供给面的非碰撞 scope 接装（calcuteContainFolders/toggleCurrentLevel{Folders,
  // SmartFolders} 与 bundle $scope 同名——**不可接装**，controllerFns 经 import 直调）

  // b1-9bz-B-8：**子窗口**（viewers/font、viewers/text-editor）经  驱动的
  // 名字 —— 跨窗口无法直 import，必须由 scope 面供给。原先依赖 controllerFns fns 表的
  // if-absent 挂载（表退役后即 undefined），故在此**显式挂载**（本块就是 scope 面供给层）。
  // 清单来自 tests-tmp/bz-b8-viewers.py 的枚举（子窗引用 ∩ 表供给且未挂载）。
  s.activateFont = (...args: any[]) => callExternal('activateFont', ...args);
  s.deactivateFont = (...args: any[]) => callExternal('deactivateFont', ...args);
  s.escHandler = (...args: any[]) => callExternal('escHandler', ...args);

  // b1-9bz-B-8：原版主 UI 工作流驱动脚本（electron/main.cjs 的 selectItems / 等）经 scope
  // 面调用的名字 —— 与子窗口同款需求（脚本在页面主世界驱动 scope，无法直 import）。
  // 原由 fns 表 if-absent 供给，表退役后改为显式挂载。
  s.copyAsPath = (...args: any[]) => callExternal('copyAsPath', ...args);
  s.getRawPath = (...args: any[]) => callExternal('getRawPath', ...args);
  s.getRawUrl = (...args: any[]) => callExternal('getRawUrl', ...args);
  s.select = (...args: any[]) => callExternal('select', ...args);
  // D-1 A-2 误判修正：addImagesToFolder 已在 externalSupplyRegistrar 注册，却漏了 scope 面挂载，
  // main.cjs:2057 直调 scope.addImagesToFolder 即 TypeError（m1 实测）。
  s.addImagesToFolder = (...args: any[]) => callExternal('addImagesToFolder', ...args);

  // b1-9av：启动期键盘绑定。原链 = update-menu/update-preferences IPC → initMousetrap
  // （bundle 22399/22408），该两通道 React 世界无发送方无桥（PROGRESS 曾登记"暂留"）——
  // 键盘层自启动起全死（Enter/方向键/Del/星标/undo/quicklook 等 ~50 键）。
  // 直接调模块函数（initMousetrap/buildMousetrap/destoryMousetrap 三者从未装配到 scope，
  // s.initMousetrap 恒 undefined——route 表只是标记）；initMousetrap = destory+rebuild+
  // rebind 幂等（controller 种子的 s.mousetrap = {} 不可作 if-absent 判据），无条件执行。
  try {
    const wm = window as any;
    if (s.__eagleShim && wm.Mousetrap) {
      machineryInitMousetrap(s);
    }
  } catch (err: any) {
    console.error('[data-machinery] keyboard init failed', err);
  }

  // D-1 A-2：测试诊断面 —— 把契约需要的 machinery 函数挂到 window，供测试从「scope 挂载
  // 存在性」改为「machinery 导出已就位」。代码内部一律 import 直调，本表不做运行时分发。
  (window as any).__eagleMachinery = {
    colorFilter: machineryColorFilter,
    grayColorFilter: machineryGrayColorFilter,
    calculateImageBinding: machineryCalculateImageBinding,
    sortRawData: machinerySortRawData,
    rebindRefresh: machineryRebindRefresh,
    rebindRefreshLazy: machineryRebindRefreshLazy,
    updateSidebarList: machineryUpdateSidebarList,
    updateItemsView: machineryUpdateItemsView,
    switchLayout: machinerySwitchLayout,
    prependImages: machineryPrependImages,
    getRatioExp: machineryGetRatioExp,
    getRatioNonExp: machineryGetRatioNonExp,
    updateZoomRatio: machineryUpdateZoomRatio,
    toggleSlideshow: machineryToggleSlideshow,
    smartFolderCount: machinerySmartFolderCount,
    getRecentFolders: machineryGetRecentFolders,
    filterData: machineryFilterData,
    calcuteFilterResult: machineryCalcuteFilterResult,
    relayout: machineryRelayout,
    existInSmartFilter: machineryExistInSmartFilter,
    contentFilter: machineryContentFilter,
    updateSelection: machineryUpdateSelection,
    filterContent: machineryFilterContent,
    enterDetailMode: machineryEnterDetailMode,
    leaveDetailMode: machineryLeaveDetailMode,
    toggleAll: machineryToggleAll,
    calls: machineryCalls,
  };

  (window as any).__eagleDataMachinery = {
    version: 50,
    applied: true,
    sortRawData: 'machinery',
    calculateImageBinding: 'machinery',
    getAncestorFolders: 'machinery',
    getExtendTags: 'machinery',
    rebindRefresh: 'machinery',
    rebindRefreshLazy: 'machinery',
    updateSidebarList: 'machinery',
    calcuteFilterBadge: 'machinery',
    filterSidebarItem: 'machinery',
    updateItemsView: 'machinery',
    switchLayout: 'machinery',
    prependImages: 'machinery',
    reload: 'machinery',
    autoResizeTagFilter: 'machinery',
    resetImageData: 'machinery',
    getRatioExp: 'machinery',
    getRatioNonExp: 'machinery',
    updateZoomRatio: 'machinery',
    toggleSlideshow: 'machinery',
    smartFolderCount: 'machinery',
    getRecentFolders: 'machinery',
    updateItemView: 'machinery',
    checkTouchIDSupport: 'machinery',
    relayout: 'machinery',
    existInSmartFilter: 'machinery',
    isMatchCondition: 'machinery',
    filterData: 'machinery',
    calcuteFilterResult: 'machinery',
    contentFilter: 'machinery',
    calcuteContainTags: 'machinery',
    updateSelection: 'machinery',
    zoom: 'machinery',
    adjustLayoutWidth: 'machinery',
    zoomFit: 'machinery',
    saveListHeight: 'machinery',
    getSelection: 'machinery',
    changeSidebarIndex: 'machinery',
    resetPage: 'machinery',
    calculateFilterCounts: 'machinery',
    openAll: 'machinery',
    updateListHeight: 'machinery',
    setLastFolder: 'machinery',
    setViewMode: 'machinery',
    enterDetailMode: 'machinery',
    leaveDetailMode: 'machinery',
    saveFolder: 'machinery',
    buildMousetrap: 'machinery',
    destoryMousetrap: 'machinery',
    initMousetrap: 'machinery',
    notify: 'machinery',
    smartZoom: 'machinery',
    lastZoom: 'machinery',
    zoomActual: 'machinery',
    toggleZoom: 'machinery',
    zoomFitEdge: 'machinery',
    updateContainerHieght: 'machinery',
    undo: 'machinery',
    nextHistory: 'machinery',
    prevHistory: 'machinery',
    back: 'machinery',
    selectAll: 'machinery',
    toggleDetailMode: 'machinery',
    multipleSelectUp: 'machinery',
    multipleSelectDown: 'machinery',
    multipleSelectNext: 'machinery',
    multipleSelectPrev: 'machinery',
    removeSelected: 'machinery',
    quicklook: 'machinery',
    copyImages: 'machinery',
    keyCHandler: 'machinery',
    keyPHandler: 'machinery',
    keyLeftHandler: 'machinery',
    keyRightHandler: 'machinery',
    modUpHandler: 'machinery',
    modDownHandler: 'machinery',
    modLeftHandler: 'machinery',
    modRightHandler: 'machinery',
    modShiftUpHandler: 'machinery',
    modShiftDownHandler: 'machinery',
    modShiftLeftHandler: 'machinery',
    modShiftRightHandler: 'machinery',
    keyUpHandler: 'machinery',
    keyDownHandler: 'machinery',
    selectUp: 'machinery',
    selectDown: 'machinery',
    pageDownHandler: 'machinery',
    pageUpHandler: 'machinery',
    changeTo5Star: 'machinery',
    removeStar: 'machinery',
    changeTo1Star: 'machinery',
    changeTo2Star: 'machinery',
    changeTo3Star: 'machinery',
    changeTo4Star: 'machinery',
    closeWindowHandler: 'machinery',
    nHandler: 'machinery',
    mHandler: 'machinery',
    toggleAll: 'machinery',
    zoomIn: 'machinery',
    zoomOut: 'machinery',
    saveHandler: 'machinery',
    refreshRandom: 'machinery',
    openParentFolder: 'machinery',
    createTxtFileFromTemplate: 'machinery',
    setFolderCover: 'machinery',
    openQuickSearch: 'machinery',
    openActionsPanel: 'machinery',
    openInspectorTagSelectPanel: 'machinery',
    openInspectorFolderSelectPanel: 'machinery',
    getItemByElement: 'machinery',
    changeStar: 'machinery',
    nextGifFrame: 'machinery',
    prevGifFrame: 'machinery',
    addVideoComment: 'machinery',
    newFileFromTemplate: 'machinery',
    openRandom: 'machinery',
    openUnfiled: 'machinery',
    openUntagged: 'machinery',
    openRecent: 'machinery',
    openCommunity: 'machinery',
    openAllTags: 'machinery',
    openTrash: 'machinery',
    openNextFolder: 'machinery',
    openPrevFolder: 'machinery',
    openNextSmartFolder: 'machinery',
    openPrevSmartFolder: 'machinery',
    autoScroll: 'machinery',
    currentIndex: 'machinery',
    getSelectedItems: 'machinery',
    getSelectedItemElements: 'machinery',
    getSelectedTags: 'machinery',
    getQuickAccessList: 'machinery',
    checkListItemsLessThanContainer: 'machinery',
    updateSubFolderWidth: 'machinery',
    updateSliderPosition: 'machinery',
    changeListHeight: 'machinery',
    scrollToCurrentItem: 'machinery',
    forceFitImageSize: 'machinery',
    sortData: 'machinery',
    offsetScrollbar: 'machinery',
    updateFilterCounts: 'machinery',
    rememberScrollTops: 'machinery',
    rememberVideoCurrentTime: 'machinery',
    addToRecentFile: 'machinery',
    preloadImage: 'machinery',
    homeHandler: 'machinery',
    endHandler: 'machinery',
    checkOperationSafety: 'machinery',
    checkOperationSafety2: 'machinery',
    resetFolderCover: 'machinery',
    removePermanently: 'machinery',
    removeSmartFolder: 'machinery',
    removeFolder: 'machinery',
    removeSelectedFolders: 'machinery',
    removeSelectedSmartFolders: 'machinery',
    removeFolderContents: 'machinery',
    toggleCommentMode: 'machinery',
    fadeOutDetailMode: 'machinery',
    openPluginPanel: 'machinery',
    saveFolderDebounce: 'machinery',
    openTagAllGroup: 'machinery',
    openUnfiledGroup: 'machinery',
    openStarredGroup: 'machinery',
    openTagGroup: 'machinery',
    removeTagGroup: 'machinery',
    enterSlideshowMode: 'machinery',
    leaveSlideshowMode: 'machinery',
    rgbToHex: 'machinery',
    lockApp: 'machinery',
    focusAppUnlockPassword: 'machinery',
    pausePalette: 'machinery',
    resumePalette: 'machinery',
    saveLayout: 'machinery',
    cancelCrop: 'machinery',
    openFilter: 'machinery',
    toggleFilterByType: 'machinery',
    multipleOpenFolder: 'machinery',
    expandFolder: 'machinery',
    expandSmartFolder: 'machinery',
    searchInAll: 'machinery',
    isDuplicateImage: 'machinery',
    addToDuplicateMapping: 'machinery',
    removeFromDuplicateMapping: 'machinery',
    openDuplicate: 'machinery',
    toggleSelectSmartFolder: 'machinery',
    toggleCurrentLevelSmartFolders: 'machinery',
    toggleAllSmartFolderExpand: 'machinery',
    setFolderOrder: 'machinery',
    setSmartFolderOrder: 'machinery',
    updateTxtItem: 'machinery',
    openPinterest: 'machinery',
    openHuaban: 'machinery',
    openArtstation: 'machinery',
    quickOpenFolder: 'machinery',
    multipleOpenSmartFolder: 'machinery',
    renameFolder: 'machinery',
    renameSmartFolder: 'machinery',
    showTutorial: 'machinery',
    openTrialModal: 'machinery',
    unlockFolderWithTouchID: 'machinery',
    getSmartFolderList: 'machinery',
    getFolderList: 'machinery',
    updateListSlider: 'machinery',
    changeMetaItems: 'machinery',
    moveToFolders: 'machinery',
    showUploadQueue: 'machinery',
    hideUploadQueue: 'machinery',
    importLinks: 'machinery',
    videoScreenShot: 'machinery',
    selectNext: 'machinery',
    selectPrev: 'machinery',
    getFolderImages: 'machinery',
    findDupclipate: 'machinery',
    refreshSubfolderList: 'machinery',
    focusSeach: 'machinery',
    newSmartFolder: 'machinery',
    prependFolder: 'machinery',
    gotoTop: 'machinery',
    gotoBottom: 'machinery',
    selectFolder: 'machinery',
    enableSubFolderNameEditable: 'machinery',
    batchRenameFolders: 'machinery',
    batchRenameSmartFolders: 'machinery',
    renameTagGroup: 'machinery',
    editTag: 'machinery',
    renameCurrentFolder: 'machinery',
    getChildFoldersMaps: 'machinery',
    getChildFoldersMap: 'machinery',
    getVideoPlayer: 'machinery',
    getFolderParentChilder: 'machinery',
    calcRotateDegree: 'machinery',
    getArroundBox: 'machinery',
    getAncestorSmartFolders: 'machinery',
    toggleAllFolders: 'machinery',
    toggleAllSmartFolders: 'machinery',
  };
}
