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
import { mediaAddVideoComment, mediaGetVideoPlayer, mediaRememberVideoCurrentTime, mediaVideoScreenShot, toggleGifPlay } from '../services/mediaService';
// b1-9ad：颜色筛选依赖（bundle 9153-9154 同款；ambient 声明见 global/vendor-modules.d.ts）
import colorConvert from 'color-convert';
import DeltaE from 'delta-e';
import { debounce, throttle } from '../utils/func';
import { get, isString, max, uniq, unescape, isNumeric } from '../utils/lang';
import { q, qa, qaVisible, widthOf, heightOf, addClass, removeClass, setAttr, cssSet, hide, show, setHtml, hasClass, setHtmlEl, textEl, triggerEl, selectText, onEl, offEl, trigger, clickEl, focusEl, blurEl, selectEl, scrollTopValue, setScrollTop, setScrollLeft, offsetOf, offsetTopOf, outerHeightOf } from '../utils/domQuery';
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
import { autoscrollChannel, calculateImageBindingChannel, glRemoveitemsChannel, importArtstationChannel, inspectorTagSelectPanelOpenChannel, newSmartFolderChannel, openDuplicateScanPanelChannel, openMousewheelPreferenceWindowChannel, openPluginPanelChannel, openQuickSearchModalChannel, openUrlInPanelChannel, rebindRefreshChannel, updateInspectorChannel, updateSelectionChannel } from '../global/bus';
import { scopeEvalAsync } from '../global/scopeShim';
// ── 域内自管的 controller 闭包变量（原 bundle 28682/28683 内 var）──
let pinyinCache: Record<string, string> = {};
let calculateImageBindingTimeout: any = null;
// ── c9b 域内自管（原 controller 闭包 var：26927 邻域 updateSidebarListTimeout / 27006
//    rebindRefreshLazyTimeout）──
let updateSidebarListTimeout: any = null;
let rebindRefreshLazyTimeout: any = null;
// ── c9c 域内自管（原 controller 闭包 var：prependImagesTimeout，30519 邻域）──
let prependImagesTimeout: any = null;

let filterCache: any = null;
let shimFilterInst: any = null;
export function getFilter(): any {
  if (filterCache) return filterCache;
  try {
    const ang = (window as any).angular;
    if (ang && ang.element && ang.element(document).injector) {
      filterCache = ang.element(document).injector().get('$filter');
    }
  } catch (err) { /* noop */ }
  // b1-9d：Angular 缺席（shim 世界）→ $filter 等价物（与下方 getTimeout() shim 同一手法）。
  // 消费面共 6 个滤镜：unique/duration/domainName/i18n 为 EagleApp.filter 逐字移植
  // （bundle 19849 / 19922 / 19942 / 19979，angular.* 判定换等价表达式），orderBy/date 为
  // Angular 内建（仅复刻本工程实际用到的调用形态：函数谓词排序 / "yyyy/MM/dd HH:mm"）。
  // 缺失时 calculateImageBinding 的 folder walk 首行即抛 "$filter is not a function"，
  // 回调永不触发 → isItemBindCalculated/listDone 永不置位（任何含文件夹的库均命中）。
  if (!filterCache) {
    if (!shimFilterInst) {
      // angular.equals 等价（本工程实际比较对象为 id 字符串/数字）
      const shimEquals = function (a: any, b: any): boolean {
        if (a === b) return true;
        if (a === null || b === null || a === undefined || b === undefined) return false;
        if (typeof a !== typeof b) return false;
        if (Array.isArray(a) && Array.isArray(b)) {
          if (a.length !== b.length) return false;
          for (let i = 0; i < a.length; i++) { if (!shimEquals(a[i], b[i])) return false; }
          return true;
        }
        if (typeof a === 'object') {
          const ka = Object.keys(a);
          const kb = Object.keys(b);
          if (ka.length !== kb.length) return false;
          for (const k of ka) { if (!shimEquals(a[k], b[k])) return false; }
          return true;
        }
        return false;
      };
      // 注意 API 形状：Angular 的 EagleApp.filter(name, factory) 在注册期即展开工厂，
      // $filter(name) 直接返回滤镜函数本体——故表内必须是滤镜函数，不能再包一层工厂
      // （曾误包一层 → $filter('unique')(children,'id') 返回的是函数，folder.children 被
      // 赋成函数，eagle.utils.tree.walk 由此无限递归爆栈）。
      const shimFilters: any = {
        // bundle 19849-19888 逐字
        unique: function (items: any, filterOn: any) {
          if (filterOn === false) return items;
          if ((filterOn || typeof filterOn === 'undefined') && Array.isArray(items)) {
            const newItems: any[] = [];
            const extractValueToCompare = function (item: any) {
              if (item && typeof item === 'object' && typeof filterOn === 'string') return item[filterOn];
              return item;
            };
            items.forEach(function (item: any) {
              let isDuplicate = false;
              for (let i = 0; i < newItems.length; i++) {
                if (shimEquals(extractValueToCompare(newItems[i]), extractValueToCompare(item))) {
                  isDuplicate = true;
                  break;
                }
              }
              if (!isDuplicate) newItems.push(item);
            });
            items = newItems;
          }
          return items;
        },
        // bundle 19922-19940 逐字
        duration: function (str: any) {
          try {
            if (str) {
              const date = new Date(0); // 原文 new Date(null)；Date(null) === Date(0)（TS 重载不接受 null）
              const seconds = Math.max(1, parseInt(str));
              date.setSeconds(seconds);
              if (seconds < 3600) return date.toISOString().substr(14, 5);
              else return date.toISOString().substr(11, 8);
            }
          }
          catch (err) { /* noop */ }
          return "";
        },
        // bundle 19942-19949 逐字
        domainName: function (url: any) {
          if (!url) return "";
          const a = document.createElement('a');
          a.href = url;
          return a.hostname.toLowerCase();
        },
        // bundle 19979-19989 逐字（顶层 i18n → w.i18n）
        i18n: function (key: any, pairs: any) {
          const w = window as any;
          let i18nString = w.i18n.__(key);
          if (pairs) {
            pairs.forEach(function (pair: any) {
              i18nString = i18nString.replace("{" + pair.property + "}", pair.value);
            });
          }
          return i18nString;
        },
        // Angular 内建 date：本工程仅用 "yyyy/MM/dd HH:mm" 形态；非法日期返回入参（Angular 同）
        date: function (value: any, format: any) {
          const date = value instanceof Date ? value : new Date(value);
          if (isNaN(date.getTime())) return value;
          const p = (n: number) => String(n).length >= 2 ? String(n) : '0' + String(n);
          return String(format)
            .replace(/yyyy/g, String(date.getFullYear()))
            .replace(/MM/g, p(date.getMonth() + 1))
            .replace(/dd/g, p(date.getDate()))
            .replace(/HH/g, p(date.getHours()))
            .replace(/mm/g, p(date.getMinutes()))
            .replace(/ss/g, p(date.getSeconds()));
        },
        // Angular 内建 orderBy：本工程仅用「函数谓词」形态，返回排序副本（Array.sort 稳定）
        orderBy: function (collection: any, predicate: any) {
          if (!Array.isArray(collection)) return collection;
          const get = typeof predicate === 'function' ? predicate : function (item: any) { return item; };
          return collection.slice().sort(function (a: any, b: any) {
            const va = get(a);
            const vb = get(b);
            if (va === vb) return 0;
            if (typeof va === 'number' && typeof vb === 'number') return va < vb ? -1 : 1;
            const sa = String(va);
            const sb = String(vb);
            return sa < sb ? -1 : (sa > sb ? 1 : 0);
          });
        },
      };
      shimFilterInst = function (name: string) {
        return shimFilters[name];
      };
    }
    filterCache = shimFilterInst;
  }
  return filterCache;
}

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

/* 取得文件夹祖先们（bundle 42508 逐字） */
export function machineryGetAncestorFolders(s: any, folder: any, folders: any[]): any[] {
  try {
    if (folder.parent && s.folderMappings[folder.parent]) {
      const parent = s.folderMappings[folder.parent];
      if (parent.id != folder.id) {
        folders.push(parent);
        return machineryGetAncestorFolders(s, parent, folders);
      }
    }
    folders = [...new Set(folders)];
    return folders;
  } catch (err: any) {
    const w = window as any;
    w.electronLog && w.electronLog.error(err.stack || err);
    folders = [...new Set(folders)];
    return folders;
  }
}

/* 取得继承炼的标签（bundle 32028 逐字；tags.unique() 为 bundle Array 原型扩展，保留原调用） */
export function machineryGetExtendTags(s: any, folder: any, tags: any[]): any[] {
  const uniqueTags: any = tags as any;
  try {
    if (folder.tags) {
      folder.tags.forEach(function (tag: any) {
        tags.push(tag);
      });
    }
    const parent = s.folderMappings[folder.parent];
    if (parent && parent.tags && folder.parent) {
      return machineryGetExtendTags(s, parent, tags);
    }
    else {
      return uniqueTags.unique().reverse();
    }
  } catch (err) {
    return uniqueTags.unique().reverse();
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

/* calculateImageBinding（bundle 28684-28965 逐字） */
export function machineryCalculateImageBinding(s: any, params: any, callback: any): void {
  const w = window as any;
  var duration = 50;
  if (calculateImageBindingTimeout) {
    duration = 50;
  } else {
    duration = 1;
  }
  const TagManager = s.TagManager;
  if (TagManager && TagManager.azGroups) {
    const $timeout = getTimeout();
    $timeout && $timeout.cancel(calculateImageBindingTimeout);
  }
  const $timeout = getTimeout();
  calculateImageBindingTimeout = $timeout(function () {
    try {
      if (!s.raw) return;

      if (!params.ignoreSort) {
        machinerySortRawData(s, s.orderBy);
      }

      console.time("calculateImageBinding");
      /* var path = require('path');（原文未使用，略去——无副作用） */
      var tags: any = {};
      var exts: any = {};
      s.all = [];
      syncSidebarFromScope();
      s.untagged = [];
      s.unfiledCount = 0;
      s.untaggedCount = 0;
      s.trash = [];
      syncSidebarFromScope();
      syncListFromScope();
      s.folderMappings = {};
      s.tagsSuggestion = [];
      s.folderList = [];
      syncSidebarFromScope();
      s.lockedImages = {};

      const ancestorsCache: any = {};
      const defaultFolderCoverIdMap: any = {};

      w.eagle.utils.tree.walk(s.folders, 'children', function(folder: any, parent: any, depth: any) {
        if (folder && parent) {
          folder.parent = parent.id;
        }

        // 列表版本 Folders
        s.folderList.push(folder);
        syncSidebarFromScope();

        // 去除重複的資料夾
        const $filter = getFilter();
        folder.children = $filter('unique')(folder.children, 'id');
        folder.imagesMappings = {};
        folder.images = [];
        folder.imageCount = 0;
        folder.depth = depth;
        folder.descendantImageCount = 0;

        if (!folder.pinyin && typeof folder.name === "string") {
          folder.pinyin = w.tinyPinyin.convertToPinyin(folder.name);
        }

        if (folder.tags && folder.tags.length > 0) {
          folder.tags.forEach(function(tag: any) {
            s.tagsSuggestion.push({
              value: tag,
              text: tag
            });
          });
        }

        ancestorsCache[folder.id] = machineryGetAncestorFolders(s, folder, [folder]);

        s.folderMappings[folder.id] = folder;
      });

      w.eagle.utils.tree.walk(s.folders, 'children', function(folder: any, parent: any) {
        folder.extendTags = machineryGetExtendTags(s, folder, []);
        folder.covers = [];
      });


      w.eagle.utils.tree.walk(s.smartFolders, 'children', function (smartFolder: any, parent: any, depth: any) {
        s.smartFolderMappings[smartFolder.id] = smartFolder;
      });

      // 重新建立圖片關係
      for (var rindex = 0; rindex < s.raw.length; rindex++) {
        var image = s.raw[rindex];

        if (!s.itemMappings[image.id]) {
          s.itemMappings[image.id] = image;
        }

        if (image.isDeleted) {
          s.trash.push(image);
          syncSidebarFromScope();
          syncListFromScope();
        }
        else {

          // 計算資料夾圖片總數
          if (image.folders && image.folders.length > 0) {
            var increaseAncestors: any = {};
            image.folders.forEach(function(folderId: any) {
              var folder = s.folderMappings[folderId];
              if (folder) {
                folder.imageCount++;

                if (folder.password && !folder.isUnLock) {
                  s.lockedImages[image.id] = true;
                }

                // 祖先们也都 + 1 , 记录在其他栏位上
                var ancestors = ancestorsCache[folder.id] || machineryGetAncestorFolders(s, folder, [folder]);
                ancestors.forEach(function (ancestor: any) {
                  // 避免重复加总
                  if (increaseAncestors[ancestor.id]) {
                    return;
                  }
                  if (!ancestor.descendantImageCount) ancestor.descendantImageCount = 0;
                  ancestor.descendantImageCount++;
                  increaseAncestors[ancestor.id] = true;

                  if (ancestor.password && !ancestor.isUnLock) {
                    s.lockedImages[image.id] = true;
                  }
                });
              }
            });
          }

          if (!s.lockedImages[image.id]) {
            s.all.push(image);
            syncSidebarFromScope();
            exts[image.ext] = true;
            if (image.tags && image.tags.length == 0) {
              s.untaggedCount++;
            }

            if (!image.folders) {
              s.unfiledCount++;
            }
            else if (image.folders.length === 0) {
              s.unfiledCount++;
            }
            else {
              // 修复异常 folders
              if (image.folders.length === 1 && !s.folderMappings[image.folders[0]]) {
                if (s.libraryModificationTime && image.lastModified && image.lastModified < s.libraryModificationTime) {
                  image.folders = [];
                  s.unfiledCount++;
                }
              }
              else if (image.folders[0] === null || image.folders[1] === null) {
                image.folders = [...new Set(image.folders)].filter(function (obj: any) { return obj != null; });
                if (image.folders.length === 0) {
                  s.unfiledCount++;
                  try {
                    w.electronLog && w.electronLog.error(`[app] ${image.id} 's folder properity is incorrect[2], move to Uncategorized`);
                  } catch (err) { /* noop */ }
                }
              }
            }
          }

          if (!image.tags) {
            image.tags = [];
          }
        }


        if (!image.isDeleted && image.tags && image.tags.length > 0) {
          if (!s.lockedImages[image.id]) {
            image.tags.forEach(function(tag: any) {
              var tagName = tag;
              if (!tagName || tagName.length > 500) return;
              var tempTag = tags[tagName];
              if (!tempTag) {
                tags[tagName] = {
                  name: tag,
                  imageCount: 0,
                  groups: []
                };
                tempTag = tags[tagName];
              }
              tempTag.imageCount++;
            });
          }
        }

        if (image.folders && image.folders.length > 0) {
          for (var i = 0; i < image.folders.length; i++) {
            if (image.isDeleted) continue;
            if (image.noPreview) continue;
            if (s.lockedImages[image.id]) continue;
            // txt 不支持做为封面
            if (image.ext === 'txt') continue;
            var folderId = image.folders[i];
            var folder = s.folderMappings[folderId];
            if (folder) {
              if (!defaultFolderCoverIdMap[folderId]) {
                defaultFolderCoverIdMap[folderId] = image.id;
              }
            }
          }
        }
      }

      // 計算當前資料有哪些檔案類型
      var extList: any[] = [];
      Object.keys(exts).map(function(key: any) {
        extList.push(key);
      });

      extList = extList.sort();
      w.eagle.filter.filterTypes = [...extList, ...w.eagle.filter.buildInTypes];
      syncFilterFromScope();
      w.eagle.filter.filterTypes = [...new Set(w.eagle.filter.filterTypes)];
      syncFilterFromScope();

      // 如果祖先门没有封面，补上封面
      w.eagle.utils.tree.walk(s.folders, 'children', function(folder: any, parent: any) {
        try {
          let converId = folder.coverId || defaultFolderCoverIdMap[folder.id];
          if (!folder.covers) folder.covers = [];
          if (converId && s.itemMappings[converId]) {
            var coverImage = s.itemMappings[converId];
            var thumbnailPath = w.FileUrlHelper.getThumbnailUrl(coverImage);
            let pos = "";
            if (coverImage.fontMetas) {
              pos = `center`;
            }
            else if (w.AUDIO_TYPES[coverImage.ext]) {
              pos = `audio center;`;
            }
            folder.covers[0] = `<img class="sub-folder-cover ${pos}" src="${thumbnailPath}" style="aspect-ratio: ${coverImage.width / coverImage.height};">`;
            if (!parent?.covers?.length) {
              parent.covers = [`<img class="sub-folder-cover ${pos}" src="${thumbnailPath}" style="aspect-ratio: ${coverImage.width / coverImage.height};">`];
            }
          }
          if (folder.covers.length == 0) {
            folder.children.forEach(function (child: any) {
              Array.prototype.push.apply(folder.covers, child.covers);
              if (folder.covers.length > 3) return;
            });
          }
        }
        catch (err) { /* noop */ }
      });

      // 初始化 Tags
      TagManager.rawdata = [];
      Object.keys(tags).forEach(function(key: any) {
        if (!pinyinCache[key]) {
          if (isString(tags[key].name)) {
            pinyinCache[key] = w.tinyPinyin.convertToPinyin(tags[key].name);
          }
        }
        tags[key].pinyin = pinyinCache[key];
        if (key) {
          TagManager.rawdata.push(tags[key]);
        }
      });

      TagManager.calculateTags();
      s.tags = TagManager.rawdata;
      syncSidebarFromScope();

      if (!s.tags) {
        s.tags = [];
        syncSidebarFromScope();
      }

      console.timeEnd("calculateImageBinding");
      if (callback) {
        callback();
      }
    }
    catch (err: any) {
      w.electronLog && w.electronLog.error(err.stack || err);
    }
  }, duration);
}

/* ── c9b：rebindRefresh 域 ───────────────────────────────────────────── */

/* calcuteFilterBadge（bundle 27522-27633 逐字；controller 闭包函数 → 域内移植。
   纯 eagle.filter.* 读写，无 scope 依赖） */
export function machineryCalcuteFilterBadge(): void {
  const w = window as any;
  const filter = w.eagle.filter;
  filter.filterBadge = 0;
  syncListFromScope();
  // 标签
  if (filter.filterRules.tag.includes) {
    filter.filterBadge += filter.filterRules.tag.includes.length;
  }
  if (filter.filterRules.tag.excludes) {
    filter.filterBadge += filter.filterRules.tag.excludes.length;
  }
  var filterFolderCount = Object.keys(filter.filterRules.folder.includes).length;
  if (filterFolderCount) {
    filter.filterBadge += filterFolderCount;
  }
  var excludeFolderCount = Object.keys(filter.filterRules.folder.excludes).length;
  if (excludeFolderCount) {
    filter.filterBadge += excludeFolderCount;
  }

  if (filter.filterRules.tag.no) { filter.filterBadge++; }
  // 颜色
  if (filter.filterRules.color.value) filter.filterBadge++;
  if (filter.filterRules.color.gray) filter.filterBadge++;
  // 类型
  if (filter.filterRules.shape.landscape) filter.filterBadge++;
  if (filter.filterRules.shape.portrait) filter.filterBadge++;
  if (filter.filterRules.shape.square) filter.filterBadge++;
  if (filter.filterRules.shape.panoramicLandscape) filter.filterBadge++;
  if (filter.filterRules.shape.panoramicPortrait) filter.filterBadge++;
  if (filter.filterRules.shape.custom) filter.filterBadge++;
  if (filter.filterRules.shape['43']) filter.filterBadge++;
  if (filter.filterRules.shape['34']) filter.filterBadge++;
  if (filter.filterRules.shape['169']) filter.filterBadge++;
  if (filter.filterRules.shape['916']) filter.filterBadge++;


  // 相机
  if (Object.keys(filter.filterRules.camera).length > 0) {
    filter.filterBadge += Object.keys(filter.filterRules.camera).length;
  }
  // 星等
  if (filter.filterRules.rating['5']) filter.filterBadge++;
  if (filter.filterRules.rating['4']) filter.filterBadge++;
  if (filter.filterRules.rating['3']) filter.filterBadge++;
  if (filter.filterRules.rating['2']) filter.filterBadge++;
  if (filter.filterRules.rating['1']) filter.filterBadge++;
  if (filter.filterRules.rating['0']) filter.filterBadge++;
  // 字体
  if (filter.filterRules.font.activated) filter.filterBadge++;
  if (filter.filterRules.font.deactivated) filter.filterBadge++;

  // 类型
  filter.filterBadge += Object.keys(filter.filterRules.type.includes).length;
  filter.filterBadge += Object.keys(filter.filterRules.type.excludes).length;

  // 时间过滤
  if (filter.filterRules.import.today) filter.filterBadge++;
  if (filter.filterRules.import.yesterday) filter.filterBadge++;
  if (filter.filterRules.import.last7day) filter.filterBadge++;
  if (filter.filterRules.import.last30day) filter.filterBadge++;
  if (filter.filterRules.import.last90day) filter.filterBadge++;
  if (filter.filterRules.import.last365day) filter.filterBadge++;
  if (filter.filterRules.import.usingRange) filter.filterBadge++;
  if (Object.keys(filter.filterRules.import.selectedMonths).length > 0) {
    filter.filterBadge += Object.keys(filter.filterRules.import.selectedMonths).length;
  }

  // 修改时间过滤
  if (filter.filterRules.mtime.today) filter.filterBadge++;
  if (filter.filterRules.mtime.yesterday) filter.filterBadge++;
  if (filter.filterRules.mtime.last7day) filter.filterBadge++;
  if (filter.filterRules.mtime.last30day) filter.filterBadge++;
  if (filter.filterRules.mtime.last90day) filter.filterBadge++;
  if (filter.filterRules.mtime.last365day) filter.filterBadge++;
  if (filter.filterRules.mtime.usingRange) filter.filterBadge++;
  if (Object.keys(filter.filterRules.mtime.selectedMonths).length > 0) {
    filter.filterBadge += Object.keys(filter.filterRules.mtime.selectedMonths).length;
  }

  // 解析度
  if (filter.filterRules.resolution.minW) filter.filterBadge++;
  if (filter.filterRules.resolution.maxW) filter.filterBadge++;
  if (filter.filterRules.resolution.minH) filter.filterBadge++;
  if (filter.filterRules.resolution.maxH) filter.filterBadge++;
  // 档案大小
  if (filter.filterRules.file.min) filter.filterBadge++;
  if (filter.filterRules.file.max) filter.filterBadge++;
  // 长度
  if (filter.filterRules.duration.min) filter.filterBadge++;
  if (filter.filterRules.duration.max) filter.filterBadge++;
  // BPM
  if (filter.filterRules.bpm.min) filter.filterBadge++;
  if (filter.filterRules.bpm.max) filter.filterBadge++;
  // 标注
  if (filter.filterRules.annotation.has) filter.filterBadge++;
  if (filter.filterRules.annotation.no) filter.filterBadge++;
  // 标注
  if (filter.filterRules.note.has) filter.filterBadge++;
  if (filter.filterRules.note.no) filter.filterBadge++;
  // 网址
  if (filter.filterRules.url.has) filter.filterBadge++;
  if (filter.filterRules.url.no) filter.filterBadge++;
  // 以图找图
  if (filter.filterRules.image.base64) filter.filterBadge++;
  if (filter.filterRules.image.itemId) filter.filterBadge++;
  // 自然语言
  if (filter.filterRules.semantic.value) filter.filterBadge++;
}

/* filterSidebarItem（bundle 37967-38001 逐字；controller 闭包函数 → 域内移植。
   依赖 chineseConvert/cartesianProduct/pinyinlite（re-require 十行成员，window.* live binding）、
   _.uniq/_.max（vendor 全局）、String.prototype.score（bundle 2621 原型扩展）） */
export function machineryFilterSidebarItem(folders: any[], keyword: any): any[] {
  const w = window as any;
  if (!keyword) return folders;
  var keyword_cn = w.chineseConvert.tw2cn(keyword).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\ /g, '').toLowerCase();

  var folderSearchItems = folders.map((folder: any) => {
    var folderNameCN = w.chineseConvert.tw2cn(folder.name).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (keyword.length >= 30 || folder.name.length >= 30) {
      return {
        folder: folder,
        name: folderNameCN,
        search: [folderNameCN]
      };
    }
    return {
      folder: folder,
      name: folderNameCN,
      search: [folderNameCN, ...uniq(
        w.cartesianProduct(w.pinyinlite(folderNameCN, { keepUnrecognized: true }).filter((p: any) => p.length > 0))
          .map((item: any) => item.join(' '))
      )],
    };
  });

  var scores = folderSearchItems.map((item: any) => {
    return {
      item: item,
      name: item.name,
      score: max(item.search.map((pinyin: any) => pinyin.score(keyword_cn))),
    };
  });

  var result = scores.filter((i: any) => i.score > 0).map(function (i: any) {
    return i.item.folder;
  });

  return result;
}

/* rebindRefresh（bundle 27366-27454 逐字；async。calcuteFilterResult/calcuteContainTags/
   refreshSubfolderList/updateItemsView/getFolderList 等仍由 bundle 承载，经 scope 解析；
   resetNgGridLayoutData = ngGridLayout 指令 66970 隐式全局赋值（window.*）；HoverPreview
   顶层 var（51689）→ window.*；calcuteFilterBadge 为域内移植版） */
export async function machineryRebindRefresh(s: any, muteMode: any, contentFilterCache: any, startCursor: any): Promise<void> {
  machineryCalls.rebindRefresh++;
  const w = window as any;

  if (!s.isItemBindCalculated) return;
  if (!s.raw) return;
  console.time("rebindRefresh");
  var data: any[] = [];

  console.time("calcuteFilterResult");
  data = await machineryCalcuteFilterResult(s, data, contentFilterCache);
  console.timeEnd("calcuteFilterResult");


  // 计算这批图片里面出现的标签
  if (w.eagle.filter.tagFilterLogic === "OR" || w.eagle.filter.tagFilterLogic === "EQUAL") {
    machineryCalcuteContainTags(s, s.preelaborations);
  }
  else if (w.eagle.filter.tagFilterLogic === "AND") {
    machineryCalcuteContainTags(s, data);
  }

  // 计算 Filter Badge 数量
  machineryCalcuteFilterBadge();

  // 置顶排序
  console.time("sort:置顶");
  if (s.currentFolder && s.currentFolder.orderBy !== "RANDOM") {
    let currentFolderId = s.currentFolder.id;
    // 原码 comparator 在 ta/tb 皆空时隐式返回 undefined（quirk 逐字保留），故 return 标注 any
    data = data.sort(function (a: any, b: any): any {
      var ta = a.pinned ? a.pinned[currentFolderId] : undefined;
      var tb = b.pinned ? b.pinned[currentFolderId] : undefined;
      if (ta || tb) {
        try {
          if (ta && !tb) return -1;
          if (!ta && tb) return 1;
          if (ta > tb) return -1;
          if (ta < tb) return 1;
          return 0;
        } catch (err) {
          return 0;
        }
      }
    });
  }
  console.timeEnd("sort:置顶");

  s.allData = data;
  syncListFromScope();

  // Note: 2019/08/05 避免拖拽順序使用 $scope.itemMappings 獲取的內容跟真實內容不一致，造成拖拽無法使用
  // 這段代碼主要用來刷新頁面上出現元件的有效性
  if (s.currentFolder) {
    try {
      for (let i = 0; i < s.allData.length; i++) {
        s.itemMappings[s.allData[i].id] = s.allData[i];
      }
    } catch (err) { /* noop */ }
  }

  s.filtereds = s.allData.slice(0, s.len * s.page);
  syncListFromScope();

  machineryRefreshSubfolderList(s);

  // 減少重複計算，將原先計算智能文件夾數量功能，放在這裡
  if (s.$root.selectedSmartFolders.length === 0 && s.currentSmartFolder) {
    if (s.currentSmartFolder.conditions && s.currentSmartFolder.conditions.length > 0) {
      s.currentSmartFolder.imageCount = s.allData.length;
    }
  }

  let currentViewDataLength = s.allData.length;
  if (currentViewDataLength < 200) {
    s.keywordDebounce = 50;
  }
  else if (currentViewDataLength < 50000) {
    s.keywordDebounce = 200;
  }
  else if (currentViewDataLength < 100000) {
    s.keywordDebounce = 250;
  }
  else {
    s.keywordDebounce = 300;
  }

  console.timeEnd("rebindRefresh");

  if (!muteMode) {
    if (w.eagle.filter.filterBadge > 0) s.startCursor = 0;
    w.resetNgGridLayoutData(s.allData, startCursor || s.startCursor);
  }
  machineryUpdateItemsView(s, s.selected);
  trigger("#box-container-scrollbar", "UPDATE_BOX_SCROLLBAR");
  if (w.HoverPreview.isShow) {
    w.HoverPreview.hide();
  }
  scopeEvalAsync();
}

/* rebindRefreshLazy（bundle 27007-27013 逐字；1000ms 防抖，rebindRefreshLazyTimeout 域内自管） */
export function machineryRebindRefreshLazy(s: any): void {
  const $timeout = getTimeout();
  $timeout.cancel(rebindRefreshLazyTimeout);
  rebindRefreshLazyTimeout = $timeout(function () {
    machineryRebindRefresh(s);
  }, 1000);
}

/* updateSidebarList（bundle 42545-42617 逐字；20ms 防抖，updateSidebarListTimeout 域内自管。
   getFolderList/getSmartFolderList/getQuickAccessList 仍由 bundle 承载经 scope 解析；
   filterSidebarItem 为域内移植版） */
export function machineryUpdateSidebarList(s: any): void {
  const $timeout = getTimeout();
  $timeout.cancel(updateSidebarListTimeout);
  updateSidebarListTimeout = $timeout(function () {
    // console.time("$scope.updateSidebarList");
    var list: any[] = [];
    var allItem = { vstype: 'all', size: 27 };
    var unfiledItem = { vstype: 'unfiled', size: 27 };
    var untaggedItem = { vstype: 'untagged', size: 27 };
    var randomItem = { vstype: 'random', size: 27 };
    var recentItem = { vstype: 'recent', size: 27 };
    var communityItem = { vstype: 'community', size: 27 };
    var allTagsItem = { vstype: 'allTags', size: 27 };
    var trashItem = { vstype: 'trash', size: 27 };
    var folders = machineryGetFolderList(s);
    var smartFolders = machineryGetSmartFolderList(s);
    var quickAccess = machineryGetQuickAccessList(s);
    var quickAccessLabel = { vstype: 'label-qucik-access', size: 25 };
    var smartFolderLabel = { vstype: 'label-smart-folder', size: 25 };
    var folderLabel = { vstype: 'label-folder', size: 25 };

    folders = machineryFilterSidebarItem(folders, s.folderKeyword);
    smartFolders = machineryFilterSidebarItem(smartFolders, s.folderKeyword);

    list.push(allItem);
    if (s.$root.preferences.sidebar.unfiled != 'false') {
      list.push(unfiledItem);
    }
    if (s.$root.preferences.sidebar.untagged != 'false') {
      list.push(untaggedItem);
    }
    if (s.$root.preferences.sidebar.recent != 'false') {
      list.push(recentItem);
    }
    if (s.$root.preferences.sidebar.random != 'false') {
      list.push(randomItem);
    }
    if (s.$root.preferences.sidebar.community2 != 'false') {
      list.push(communityItem);
    }
    list.push(allTagsItem);
    list.push(trashItem);

    if (s.quickAccess.length > 0 && s.$root.preferences.sidebar.quickAccess != 'false') {
      list.push({ vstype: 'separator', size: 14 });
      list.push(quickAccessLabel);
      if (s.isExpandQuickAccess && s.quickAccess.length > 0) {
        list = list.concat(quickAccess);
        list.push({ vstype: 'separator', size: 14 });
      }
    }
    else {
      list.push({ vstype: 'separator', size: 14 });
    }

    if (s.$root.preferences.sidebar.smartFolder != 'false') {
      if (!s.folderKeyword) {
        list.push(smartFolderLabel);
      }
      else if (smartFolders.length > 0) {
        list.push(smartFolderLabel);
      }
      if (smartFolders.length > 0) {
        if (s.isExpandSmartFolder) {
          list = list.concat(smartFolders);
          list.push({ vstype: 'separator', size: 14 });
        }
      }
    }

    if (s.$root.preferences.sidebar.folder != 'false') {
      if (!s.folderKeyword) {
        list.push(folderLabel);
      }
      else if (folders.length > 0) {
        list.push(folderLabel);
      }
      if (s.isExpandFolder) {
        list = list.concat(folders);
      }
    }

    list.forEach(function (node: any, index: number) {
      node.index = index;
    });

    s.sidebarList = list;
    syncSidebarFromScope();
  }, 20);
}

/* ── c9c：视图/加载域 ───────────────────────────────────────────────── */

/* updateItemsView（bundle 35065-35072 逐字；updateItemView 仍由 bundle 承载经 scope 解析） */
export function machineryUpdateItemsView(s: any, items: any[]): void {
  const w = window as any;
  removeClass(".box.selected", "selected");
  for (var i = items.length - 1; i >= 0; i--) {
    var item = items[i];
    machineryUpdateItemView(s, item);
  }
}

/* b1-9be：switchLayout 实现体归位 services/gridService.ts（body class 四分支 +
   relayout/offsetScrollbar/initMenu 仍经 scope 解析） */
export function machinerySwitchLayout(s: any, layout: any, forceLayout: any): void {
  gridSwitchLayout(s, layout, forceLayout);
}

/* resetImageData（bundle 30540-30548 逐字；controller 闭包函数 → 域内移植） */
function machineryResetImageData(s: any, images: any[]): void {
  const w = window as any;
  if (s.viewMode == "all" || (s.currentFolder && images[0].folders[0] && images[0].folders.indexOf(s.currentFolder.id) > -1) || (images[0].folders && images[0].folders.length === 0 && s.viewMode == "unfiled")) {
    w.resetNgGridLayoutData(s.allData, 0);
    scopeEvalAsync();
  }
}

/* prependImages（bundle 30524-30538 逐字；prependImagesTimeout 域内自管。
   原码 updateView 参数未使用，逐字保留签名） */
export function machineryPrependImages(s: any, images: any[], updateView: any): void {
  for (var i = 0; i < images.length; i++) {
    s.itemMappings[images[i].id] = images[i];
  }

  if (images[0].id) {
    s.allData.unshift(images[0]);
    syncListFromScope();
    clearTimeout(prependImagesTimeout);
    prependImagesTimeout = setTimeout(function () {
      machineryResetImageData(s, images);
    }, 500);
  }
}

/* autoResizeTagFilter（bundle 43119-43128 逐字；controller 闭包函数 → 域内移植） */
function machineryAutoResizeTagFilter(s: any): void {
  const w = window as any;
  var tagsLength = s.containTags.length;
  var height = tagsLength * 24 + 54;
  if (s.containerSize && s.containerSize.tagFilter) {
    if (s.containerSize.tagFilter > height) {
      cssSet(".tags-filter", { height: height });
    }
    else {
      cssSet(".tags-filter", { height: s.containerSize.tagFilter });
    }
  }
}

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

/* updateZoomRatio（bundle 31391-31418 逐字；smoothZoom = vendor jQuery 插件；
   updateZoomRatioTimeout 域内自管） */
export function machineryUpdateZoomRatio(s: any, ratio: any, x: any, y: any, hasTransition: any): void {
  detailUpdateZoomRatio(s, ratio, x, y, hasTransition);
}

/* toggleSlideshow（bundle 23816-23823 逐字；enter/leaveSlideshowMode 经 scope 解析） */
export function machineryToggleSlideshow(s: any): void {
  if (!s.isSlideshowMode) {
    machineryEnterSlideshowMode(s);
  } else {
    machineryLeaveSlideshowMode(s);
  }
}

/* smartFolderCount（bundle 46646-46661 逐字；existInSmartFilter/lockImageFilter 经 scope 解析） */
export function machinerySmartFolderCount(s: any, smartFolder: any): any {
  if (smartFolder) {
    if (smartFolder.conditions.length === 0) return 0;
    // console.time("计算智能文件夹图片数量");
    var images: any[] = [];
    images = s.raw.filter(function (image: any) {
      if (image.isDeleted) return false;
      return machineryExistInSmartFilter(s, smartFolder, image);
    });
    if (Object.keys(s.lockedImages).length > 0) {
      images = images.filter(s.lockImageFilter);
    }
    // console.timeEnd("计算智能文件夹图片数量");
    return images.length;
  }
}

/* getRecentFolders（bundle 31969-31988 逐字） */
export function machineryGetRecentFolders(s: any, length: any): any[] {
  var len = length;
  if (!length) len = 8;
  var recentMoveFolders: any = localStorage.getItem("recentMoveFolders");
  if (recentMoveFolders) {
    recentMoveFolders = JSON.parse(recentMoveFolders);
    recentMoveFolders = recentMoveFolders.slice(0, len);
  }
  else {
    return [];
  }

  recentMoveFolders = recentMoveFolders.filter(function (folderId: any) {
    return !!s.folderMappings[folderId];
  });

  var recentFolders = recentMoveFolders.map(function (folderId: any) {
    return s.folderMappings[folderId];
  });

  recentFolders = [...new Set(recentFolders)];
  return recentFolders;
}

/* updateItemView（bundle 34847-35063 逐字；单条目 DOM 更新机——updateItemsView 循环体。
   依赖：window.* 全局（$/FileUrlHelper/fileSize/fontFolder/sanitize/installedFonts/i18n/
   VIDEO_TYPES/AUDIO_TYPES/FONT_TYPES/SPECIAL_TYPES）、$filter 经 injector（duration/domainName/
   date）、fs 经 window.require('fs')、TagManager/listMetaType 经 scope 字段） */
export function machineryUpdateItemView(s: any, item: any): void {
  const w = window as any;
  const fs = w.require && w.require('fs');

  if (!item) return;
  try {
    var id = item.id;
    var $element = q("#box-" + id) as HTMLElement | null;
    if (!$element) return;
    const findEl = (sel: string) => $element!.querySelector(sel) as HTMLElement | null;
    var $name = findEl(".name span");
    var $iconName = findEl(".ext-icon-name");
    var $metas = findEl(".metas");
    var $propTags = findEl(".prop.tags");
    var $propResolution = findEl(".prop.resolution");
    var $propRating = findEl(".prop.rating");
    var $propSize = findEl(".prop.size");
    var isSelected = s.selectedMappings[id];
    var tags = item.tags || [];
    var isTagged = tags.length > 0;
    var $annotationCount = findEl(".annotation-count");
    var ratingStrings: any = {
      "undefined": "★★★★★",
      "0": "★★★★★",
      "1": "<y>★</y>★★★★",
      "2": "<y>★★</y>★★★",
      "3": "<y>★★★</y>★★",
      "4": "<y>★★★★</y>★",
      "5": "<y>★★★★★</y>",
    };
    var tagsFormated = "-";
    if (item.tags && item.tags.length) {
      var tags2 = item.tags.map(function (tag: any) {
        try {
          return `<div class="tag color-${s.TagManager.tagMappings[tag].color}">${tag}</div>`;
        } catch (err) { /* noop */ }
      });
      tagsFormated = tags2.join("");
    }

    $element.setAttribute("data-height", item.height);
    $element.setAttribute("data-width", item.width);

    if (textEl($name) !== item.name) {
      if (!s.modifiedMappings[item.id]) s.modifiedMappings[item.id] = 0;
      s.modifiedMappings[item.id]++;
      let src = w.FileUrlHelper.getLastestThumbnailUrl(item);
      var $img = findEl(".thumbnail img");
      if ($img) {
        $img.setAttribute("lazysrc", "");
        $img.setAttribute("lsrc", src);
        $img.setAttribute("raw", src);
      }
      // 確保不是在編輯模式
      if (!$name?.parentElement?.classList.contains('editable')) {
        if ($name) $name.textContent = item.name;
        if ($iconName) $iconName.textContent = item.name;
      }
    }

    if (item.comments && item.comments.length > 0) {
      $element.classList.add("has-annotation");
      if ($annotationCount) $annotationCount.textContent = String(item.comments.length);
    }
    else {
      $element.classList.remove("has-annotation");
    }

    $element.classList.remove("bg-light", "bg-dark", "bg-gray", "bg-grid");
    if (item.background) {
      $element.classList.add(`bg-${item.background}`);
    }

    var metas = '';
    const $filter = getFilter();
    switch (s.listMetaType) {
      case 'RESOLUTION':
        if (item.duration && w.VIDEO_TYPES[item.ext]) {
          metas = $filter('duration')(item.duration);
        }
        else if (item.duration && w.AUDIO_TYPES[item.ext]) {
          metas = $filter('duration')(item.duration);
        }
        else if (item.fontMetas && w.FONT_TYPES[item.ext]) {
          metas = item.fontMetas.weight;
        }
        else if (item.noPreview) {
          metas = `${w.fileSize(item.size, 1)}`;
        }
        else if (w.SPECIAL_TYPES[item.ext]) {
          metas = `${w.fileSize(item.size, 1)}`;
        }
        else if (item.ext === "url") {
          if (item.duration) {
            metas = $filter('duration')(item.duration);
          }
          else {
            metas = $filter('domainName')(item.url);
          }
        }
        else {
          metas = item.width + " x " + item.height;
        }
        if (item.ext === "txt") {
          var paragraphs = item.text.split("\n");
          var paragraphsHTML = "";
          paragraphsHTML += `<h4>${item.name.trim()}</h4>`;
          paragraphs.forEach(function (paragraph: any) {
            paragraphsHTML += `<p>${paragraph.trim()}</p>`;
          });
          setHtml("#box-" + item.id + " .txt-content div", paragraphsHTML);
        }
        break;
      case 'FILESIZE':
        metas = `${w.fileSize(item.size, 1)}`;
        break;
      case 'TYPE':
        metas = item.ext && item.ext.toUpperCase();
        break;
      case 'MTIME':
        var mtime = item.mtime || item.modificationTime;
        metas = $filter("date")(item.mtime || item.modificationTime, "yyyy/MM/dd HH:mm");
        break;
      case 'BTIME':
        var btime = item.btime || item.modificationTime;
        metas = $filter("date")(item.btime || item.modificationTime, "yyyy/MM/dd HH:mm");
        break;
      case 'TAGS':
        metas = tagsFormated;
        break;
      case 'RATING':
        metas = `<span class="small star">${ratingStrings[item.star]}</span>`;
        break;
    }
    if ($metas) $metas.innerHTML = metas;

    if ($propTags) $propTags.innerHTML = tagsFormated;
    if (item.width) {
      if ($propResolution) $propResolution.innerHTML = `${item.width} x ${item.height}`;
    }
    else {
      if ($propResolution) $propResolution.innerHTML = `-`;
    }
    if ($propRating) $propRating.innerHTML = `<span class="small star">${ratingStrings[item.star]}</span>`;
    if ($propSize) $propSize.innerHTML = `${w.fileSize(item.size, 1)}`;

    if (isSelected) {
      $element.classList.add("selected");
    }
    else {
      $element.classList.remove("selected");
    }

    if (isTagged) {
      $element.classList.add("tagged");
    }
    else {
      $element.classList.remove("tagged");
    }

    const imgs = Array.from($element.querySelectorAll("img"));
    imgs.forEach((im) => im.classList.remove("r2", "r3", "r4", "r5", "r6", "r7", "r8"));
    if (item.orientation && !item.noThumbnail) {
      if (item.orientation === 8) {
        imgs.forEach((im) => im.classList.add("r8"));
      }
      else if (item.orientation === 7) {
        imgs.forEach((im) => im.classList.add("r7"));
      }
      else if (item.orientation === 6) {
        imgs.forEach((im) => im.classList.add("r6"));
      }
      else if (item.orientation === 5) {
        imgs.forEach((im) => im.classList.add("r5"));
      }
      else if (item.orientation === 4) {
        imgs.forEach((im) => im.classList.add("r4"));
      }
      else if (item.orientation === 3) {
        imgs.forEach((im) => im.classList.add("r3"));
      }
      else if (item.orientation === 2) {
        imgs.forEach((im) => im.classList.add("r2"));
      }

      if (item.orientation > 4) {
        if (item.width < item.height) {
          imgs.forEach((im) => { (im as HTMLElement).style.minWidth = `${item.height / item.width * 100}%`; });
        }
        else {
          imgs.forEach((im) => { (im as HTMLElement).style.width = `${item.height / item.width * 100}%`; });
        }
      }
    }

    if (item.fontMetas && item.fontMetas.postScriptName) {
      var key = Object.keys(item.fontMetas.postScriptName)[0];
      var postScriptName = item.fontMetas.postScriptName && item.fontMetas.postScriptName[key];
      var fontPath = `${w.fontFolder}/${w.sanitize(postScriptName)}.${item.ext}`;
      var activatedLabel = w.i18n.__("Context.Image.Font.Activate");
      var deactivatedLabel = w.i18n.__("Context.Image.Font.Deactivate");
      // 添加正在启用、正在停用状态
      if (item.activating || item.deactivating) {
        $element.classList.add("activating");
      }
      else if (fs && fs.existsSync(fontPath)) {
        w.installedFonts[`${postScriptName}_.${item.ext}`] = true;
        $element.classList.remove("activating");
        $element.classList.add("activated");
        findEl(".activate-btn")?.setAttribute("title", deactivatedLabel);
      }
      else {
        w.installedFonts[`${postScriptName}_.${item.ext}`] = false;
        $element.classList.remove("activating");
        $element.classList.remove("activated");
        findEl(".activate-btn")?.setAttribute("title", activatedLabel);
      }
    }
  }
  catch (err) {
    console.error(err);
  }
}

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

/* ── c14：智能文件夹规则匹配域 ───────────────────────────────────────── */

/* MATCH_FUNCTION 表（bundle 32117-32143 逐字；26 规则函数经 window 解析——bundle 8369-9418
   顶层函数（b1 后由 public/vendor/eagle-match-rules.js script 注入供给）） */
function getMatchFunctionTable(): any {
  const w = window as any;
  // b1-9m：取消模块级缓存——vendor 注入晚于首次取表时，缓存内 isMatch*Rule 为 undefined
  // 且永不自愈。每次重建（26 次属性读，开销可忽略）。
  return {
    "name": w.isMatchNameRule,
    "folderName": w.isMatchFolderNameRule,
    "url": w.isMatchUrlRule,
    "annotation": w.isMatchAnnotationRule,
    "comments": w.isMatchCommentsRule,
    "width": w.isMatchWidthRule,
    "height": w.isMatchHeightRule,
    "fileSize": w.isMatchFileSizeRule,
    "createTime": w.isMatchTimeRule,
    "mtime": w.isMatchMTimeRule,
    "btime": w.isMatchBTimeRule,
    "tags": w.isMatchTagsRule,
    "rating": w.isMatchRatingRule,
    "folders": w.isMatchFoldersRule,
    "type": w.isMatchTypeRule,
    "shape": w.isMatchShapeRule,
    "color": w.isMatchColorRule,
    "duration": w.isMatchDurationRule,
    "bpm": w.isMatchBPMRule,
    "camera": w.isMatchCameraRule,
    "iso": w.isMatchISORule,
    "aperture": w.isMatchApertureRule,
    'focalLength': w.isMatchFocalLengthRule,
    'shutter': w.isMatchShutterRule,
    "timestamp": w.isMatchTimestampRule,
    "fontActivated": w.isMatchFontActivatedRule
  };
}

/* isMatchCondition（bundle 32145-32175 逐字） */
function machineryIsMatchCondition(condition: any, image: any): boolean {
  const MATCH_FUNCTION = getMatchFunctionTable();
  var allMatch = true; // 全部符合

  for (let i = 0; i < condition.rules.length; i++) {
    var isMatch = false;
    isMatch = MATCH_FUNCTION[condition.rules[i].property](condition.rules[i], image);

    // 如果有任何一調規則沒有 match，交集狀態必為 false
    if (!isMatch) {
      allMatch = false;
    }
    // 交集判斷不需要等待所有條件計算完畢
    if (condition.match === "AND" && !isMatch) {
      return false;
    }
    // 假如是聯集且有任何一條規則已經 match
    else if (condition.match === "OR" && isMatch) {
      return true;
    }
  }

  // 如果全不符合
  if (allMatch) {
    return true;
  }

  return false;
}

/* existInSmartFilter（bundle 32091-32116 逐字；递归 parent 链） */
export function machineryExistInSmartFilter(s: any, smartFolder: any, image: any): boolean {
  try {
    var conditions = smartFolder.conditions;

    for (var i = 0; i < smartFolder.conditions.length; i++) {
      var boolean = smartFolder.conditions[i].boolean || "TRUE";
      var isMatch = machineryIsMatchCondition(smartFolder.conditions[i], image);
      if (boolean === "FALSE") {
        isMatch = !isMatch;
      }
      if (!isMatch) return false;
    }
    let parent = s.smartFolderMappings[smartFolder.parent];
    if (parent) {
      return machineryExistInSmartFilter(s, parent, image);
    }
    else {
      return true;
    }
  }
  catch (err) {
    return false;
  }
}

/* ── c14b：筛选引擎（filterData 27654-28504 逐字分片）────────────────── */

// ── c14b 域内自管（原 controller 闭包 var：27004/27005）──
let imageSearchController: any = null;
let semanticSearchController: any = null;

/* filterData 分片 1：import 月份/时间、mtime、类型含排、档案大小、长度、BPM、解析度、
   标注、注释（27654-27960 逐字） */
function machineryFilterDataPart1(s: any, w: any, data: any[]): any[] {

  if (Object.keys(w.eagle.filter.filterRules.import.selectedMonths).length > 0) {
    data = data.filter(function (image: any) {
      let importDate = new Date(image.modificationTime);
      let importYear = importDate.getFullYear();
      let importMonth = ("" + (importDate.getMonth() + 1)).padStart(2, "0");
      return w.eagle.filter.filterRules.import.selectedMonths[`${importYear}/${importMonth}`];
    });
  }

  // 时间筛选
  if (w.eagle.filter.filterRules.import.today || w.eagle.filter.filterRules.import.yesterday || w.eagle.filter.filterRules.import.last7day || w.eagle.filter.filterRules.import.last30day || w.eagle.filter.filterRules.import.last90day || w.eagle.filter.filterRules.import.last365day || w.eagle.filter.filterRules.import.usingRange) {

    var ONE_DAY = 1000 * 60 * 60 * 24;
    let today = new Date();
    today.setHours(0, 0, 0);
    let todayTime = today.getTime();
    let yesterdayTime = todayTime - ONE_DAY;

    data = data.filter(function (image: any) {

      var result = false;
      if (w.eagle.filter.filterRules.import.today) {
        if (image.modificationTime > todayTime) result = true;
      }
      if (w.eagle.filter.filterRules.import.yesterday) {
        if (image.modificationTime < todayTime && image.modificationTime > yesterdayTime) result = true;
      }
      if (w.eagle.filter.filterRules.import.last7day) {
        if (Date.now() - image.modificationTime < ONE_DAY * 7) result = true;
      }
      if (w.eagle.filter.filterRules.import.last30day) {
        if (Date.now() - image.modificationTime < ONE_DAY * 30) result = true;
      }
      if (w.eagle.filter.filterRules.import.last90day) {
        if (Date.now() - image.modificationTime < ONE_DAY * 90) result = true;
      }
      if (w.eagle.filter.filterRules.import.last365day) {
        if (Date.now() - image.modificationTime < ONE_DAY * 365) result = true;
      }
      if (w.eagle.filter.filterRules.import.usingRange) {
        if (w.eagle.filter.filterRules.import.range && w.eagle.filter.filterRules.import.range[0] && w.eagle.filter.filterRules.import.range[1]) {
          if (w.eagle.filter.filterRules.import.range[0] <= image.modificationTime && image.modificationTime <= w.eagle.filter.filterRules.import.range[1] + ONE_DAY) result = true;
        }
      }
      return result;
    });
  }

  // 修改时间筛选
  if (Object.keys(w.eagle.filter.filterRules.mtime.selectedMonths).length > 0) {
    data = data.filter(function (image: any) {
      let mtime = image.mtime || image.modificationTime;
      let modifyDate = new Date(mtime);
      let modifyYear = modifyDate.getFullYear();
      let modifyMonth = ("" + (modifyDate.getMonth() + 1)).padStart(2, "0");
      return w.eagle.filter.filterRules.mtime.selectedMonths[`${modifyYear}/${modifyMonth}`];
    });
  }

  if (w.eagle.filter.filterRules.mtime.today || w.eagle.filter.filterRules.mtime.yesterday || w.eagle.filter.filterRules.mtime.last7day || w.eagle.filter.filterRules.mtime.last30day || w.eagle.filter.filterRules.mtime.last90day || w.eagle.filter.filterRules.mtime.last365day || w.eagle.filter.filterRules.mtime.usingRange) {

    var ONE_DAY2 = 1000 * 60 * 60 * 24;
    let today2 = new Date();
    today2.setHours(0, 0, 0);
    let todayTime2 = today2.getTime();
    let yesterdayTime2 = todayTime2 - ONE_DAY2;

    data = data.filter(function (image: any) {

      var result = false;
      var mtime = image.mtime || image.modificationTime;

      if (w.eagle.filter.filterRules.mtime.today) {
        if (mtime > todayTime2) result = true;
      }
      if (w.eagle.filter.filterRules.mtime.yesterday) {
        if (mtime < todayTime2 && mtime > yesterdayTime2) result = true;
      }
      if (w.eagle.filter.filterRules.mtime.last7day) {
        if (Date.now() - mtime < ONE_DAY2 * 7) result = true;
      }
      if (w.eagle.filter.filterRules.mtime.last30day) {
        if (Date.now() - mtime < ONE_DAY2 * 30) result = true;
      }
      if (w.eagle.filter.filterRules.mtime.last90day) {
        if (Date.now() - mtime < ONE_DAY2 * 90) result = true;
      }
      if (w.eagle.filter.filterRules.mtime.last365day) {
        if (Date.now() - mtime < ONE_DAY2 * 365) result = true;
      }
      if (w.eagle.filter.filterRules.mtime.usingRange) {
        if (w.eagle.filter.filterRules.import.range && w.eagle.filter.filterRules.import.range[0] && w.eagle.filter.filterRules.import.range[1]) {
          if (w.eagle.filter.filterRules.import.range[0] <= mtime && mtime <= w.eagle.filter.filterRules.import.range[1] + ONE_DAY2) result = true;
        }
      }
      return result;
    });
  }

  // 类型筛选
  if (Object.keys(w.eagle.filter.filterRules.type.includes).length > 0) {
    data = data.filter(function (image: any) {
      if (w.eagle.filter.filterRules.type.includes[image.ext]) return true;
      if (w.eagle.filter.filterRules.type.includes['video']) {
        return w.VIDEO_TYPES[image.ext];
      }
      if (w.eagle.filter.filterRules.type.includes['url']) {
        if (image.ext == 'url' && !image.medium) return true;
      }
      if (w.eagle.filter.filterRules.type.includes['youtube']) {
        if (image.ext == 'url' && image.medium == 'youtube') return true;
      }
      if (w.eagle.filter.filterRules.type.includes['vimeo']) {
        if (image.ext == 'url' && image.medium == 'vimeo') return true;
      }
      if (w.eagle.filter.filterRules.type.includes['bilibili']) {
        if (image.ext == 'url' && image.medium == 'bilibili') return true;
      }
      if (w.eagle.filter.filterRules.type.includes['audio']) {
        return w.AUDIO_TYPES[image.ext];
      }
      if (w.eagle.filter.filterRules.type.includes['powerpoint']) {
        if (image.ext == 'ppt' || image.ext == 'pptx' || image.ext == 'potx') return true;
      }
      if (w.eagle.filter.filterRules.type.includes['word']) {
        if (image.ext == 'doc' || image.ext == 'docx') return true;
      }
      if (w.eagle.filter.filterRules.type.includes['excel']) {
        if (image.ext == 'xls' || image.ext == 'xlsx') return true;
      }
      if (w.eagle.filter.filterRules.type.includes['font']) {
        return w.FONT_TYPES[image.ext];
      }
      return false;
    });
  }

  // 類型排除
  if (Object.keys(w.eagle.filter.filterRules.type.excludes).length > 0) {
    data = data.filter(function (image: any) {
      if (w.eagle.filter.filterRules.type.excludes[image.ext]) return false;
      if (w.eagle.filter.filterRules.type.excludes['video']) {
        if (w.VIDEO_TYPES[image.ext]) return false;
      }
      if (w.eagle.filter.filterRules.type.excludes['url']) {
        if (image.ext == 'url' && !image.medium) return false;
      }
      if (w.eagle.filter.filterRules.type.excludes['youtube']) {
        if (image.ext == 'url' && image.medium == 'youtube') return false;
      }
      if (w.eagle.filter.filterRules.type.excludes['vimeo']) {
        if (image.ext == 'url' && image.medium == 'vimeo') return false;
      }
      if (w.eagle.filter.filterRules.type.excludes['bilibili']) {
        if (image.ext == 'url' && image.medium == 'bilibili') return false;
      }

      if (w.eagle.filter.filterRules.type.excludes['audio']) {
        if (w.AUDIO_TYPES[image.ext]) return false;
      }
      if (w.eagle.filter.filterRules.type.excludes['powerpoint']) {
        if (image.ext == 'ppt' || image.ext == 'pptx' || image.ext == 'potx') return false;
      }
      if (w.eagle.filter.filterRules.type.excludes['word']) {
        if (image.ext == 'doc' || image.ext == 'docx') return false;
      }
      if (w.eagle.filter.filterRules.type.excludes['excel']) {
        if (image.ext == 'xls' || image.ext == 'xlsx') return false;
      }
      if (w.eagle.filter.filterRules.type.excludes['font']) {
        if (w.FONT_TYPES[image.ext]) return false;
      }
      return true;
    });
  }

  // 档案大小筛选
  // 最小值
  if (isNumeric(w.eagle.filter.filterRules.file.min)) {
    var unit = 1024;
    if (w.eagle.filter.filterRules.file.unit == 'mb') {
      unit = 1024 * 1024;
    }
    data = data.filter(function (image: any) {
      return image.size >= parseInt((w.eagle.filter.filterRules.file.min * unit) as any);
    });
  }
  // 最大值
  if (isNumeric(w.eagle.filter.filterRules.file.max)) {
    var unit2 = 1024;
    if (w.eagle.filter.filterRules.file.unit == 'mb') {
      unit2 = 1024 * 1024;
    }
    data = data.filter(function (image: any) {
      return image.size <= parseInt((w.eagle.filter.filterRules.file.max * unit2) as any);
    });
  }

  // 视频、音频长度筛选
  // 最小值
  if (isNumeric(w.eagle.filter.filterRules.duration.min)) {
    var unit3 = 1;
    if (w.eagle.filter.filterRules.duration.unit == 'h') {
      unit3 = 60 * 60;
    }
    else if (w.eagle.filter.filterRules.duration.unit == 'm') {
      unit3 = 60;
    }
    data = data.filter(function (image: any) {
      return image.duration >= parseInt((w.eagle.filter.filterRules.duration.min * unit3) as any);
    });
  }
  // 最大值
  if (isNumeric(w.eagle.filter.filterRules.duration.max)) {
    var unit4 = 1;
    if (w.eagle.filter.filterRules.duration.unit == 'h') {
      unit4 = 60 * 60;
    }
    else if (w.eagle.filter.filterRules.duration.unit == 'm') {
      unit4 = 60;
    }
    data = data.filter(function (image: any) {
      return image.duration <= parseInt((w.eagle.filter.filterRules.duration.max * unit4) as any);
    });
  }

  // BPM 最小值
  if (isNumeric(w.eagle.filter.filterRules.bpm.min)) {
    data = data.filter(function (image: any) {
      if (!image.bpm) return false;
      return image.bpm >= parseInt(w.eagle.filter.filterRules.bpm.min);
    });
  }
  // BPM 最大值
  if (isNumeric(w.eagle.filter.filterRules.bpm.max)) {
    data = data.filter(function (image: any) {
      if (!image.bpm) return false;
      return image.bpm <= parseInt(w.eagle.filter.filterRules.bpm.max);
    });
  }

  // 图片大小筛选
  // 宽度最小值
  if (isNumeric(w.eagle.filter.filterRules.resolution.minW)) {
    data = data.filter(function (image: any) {
      return image.width >= parseInt(w.eagle.filter.filterRules.resolution.minW);
    });
  }
  // 宽度最大值
  if (isNumeric(w.eagle.filter.filterRules.resolution.maxW)) {
    data = data.filter(function (image: any) {
      return image.width <= parseInt(w.eagle.filter.filterRules.resolution.maxW);
    });
  }
  // 高度最小值
  if (isNumeric(w.eagle.filter.filterRules.resolution.minH)) {
    data = data.filter(function (image: any) {
      return image.height >= parseInt(w.eagle.filter.filterRules.resolution.minH);
    });
  }
  // 高度最大值
  if (isNumeric(w.eagle.filter.filterRules.resolution.maxH)) {
    data = data.filter(function (image: any) {
      return image.height <= parseInt(w.eagle.filter.filterRules.resolution.maxH);
    });
  }

  // 图片标注筛选
  // 有标注
  if (w.eagle.filter.filterRules.annotation.has) {
    // 不需要关键字
    if (!w.eagle.filter.filterRules.annotation.keywords) {
      data = data.filter(function (image: any) {
        return image.comments && image.comments.length > 0;
      });
    }
    // 需要关键字
    else {
      var keywords = w.eagle.filter.filterRules.annotation.keywords.split(",");
      data = data.filter(function (image: any) {
        var matchCount = 0;
        for (var i = 0; i < keywords.length; i++) {
          var keyword = keywords[i].toLowerCase();
          if (image.comments && image.comments.length > 0) {
            for (var j = 0; j < image.comments.length; j++) {
              var comment = image.comments[j];
              if (comment.annotation.toLowerCase().indexOf(keyword) > -1) {
                matchCount++;
                break;
              }
            }
          }
        }
        return (matchCount == keywords.length);
      });
    }
  }
  // 没标注
  else if (w.eagle.filter.filterRules.annotation.no) {
    data = data.filter(function (image: any) {
      return !image.comments || image.comments.length == 0;
    });
  }

  return data;
}

// ── APPEND:c14b-2 ──

/* filterData 分片 2：注释/网址/方向/星等/字体/相机/颜色/关键字/已删排序/random 预筛
   （27960-28170 逐字） */
function machineryFilterDataPart2(s: any, w: any, data: any[]): any[] {

  // 图片注释筛选
  // 有注释
  if (w.eagle.filter.filterRules.note.has) {
    // 不需要关键字
    if (!w.eagle.filter.filterRules.note.keywords) {
      data = data.filter(function (image: any) {
        return image.annotation && image.annotation.length > 0;
      });
    }
    // 需要关键字
    else {
      var keywords = w.eagle.filter.filterRules.note.keywords.split(",");
      data = data.filter(function (image: any) {
        var matchCount = 0;
        for (var i = 0; i < keywords.length; i++) {
          var keyword = keywords[i].toLowerCase();
          if (image.annotation && image.annotation.toLowerCase().indexOf(keyword) > -1) {
            matchCount++;
          }
        }
        return (matchCount == keywords.length);
      });
    }
  }
  // 没注释
  else if (w.eagle.filter.filterRules.note.no) {
    data = data.filter(function (image: any) {
      return !image.annotation || image.annotation.length == 0;
    });
  }

  // 来源网址筛选
  // 有網址
  if (w.eagle.filter.filterRules.url.has) {
    // 不需要关键字
    if (!w.eagle.filter.filterRules.url.keywords) {
      data = data.filter(function (image: any) {
        return image.url && image.url.length > 0;
      });
    }
    // 需要关键字
    else {
      var keywords2 = w.eagle.filter.filterRules.url.keywords.split(",");
      data = data.filter(function (image: any) {
        var matchCount = 0;
        for (var i = 0; i < keywords2.length; i++) {
          var keyword = keywords2[i].toLowerCase();
          if (image.url && image.url.toLowerCase().indexOf(keyword) > -1) {
            matchCount++;
          }
        }
        return (matchCount == keywords2.length);
      });
    }
  }
  // 沒網址
  else if (w.eagle.filter.filterRules.url.no) {
    data = data.filter(function (image: any) {
      return !image.url || image.url.length == 0;
    });
  }

  // 方向筛选
  if (w.eagle.filter.filterRules.shape.landscape || w.eagle.filter.filterRules.shape.portrait || w.eagle.filter.filterRules.shape.square || w.eagle.filter.filterRules.shape.panoramicLandscape || w.eagle.filter.filterRules.shape.panoramicPortrait || w.eagle.filter.filterRules.shape.custom || w.eagle.filter.filterRules.shape['43'] || w.eagle.filter.filterRules.shape['34'] || w.eagle.filter.filterRules.shape['169'] || w.eagle.filter.filterRules.shape['916']) {
    data = data.filter(function (image: any) {
      var result = false;
      if (w.eagle.filter.filterRules.shape.landscape) {
        if (image.width > image.height) result = true;
      }
      if (!result && w.eagle.filter.filterRules.shape.portrait) {
        if (image.height > image.width) result = true;
      }
      if (!result && w.eagle.filter.filterRules.shape.square) {
        if (image.width == image.height) result = true;
      }
      if (!result && w.eagle.filter.filterRules.shape.panoramicLandscape) {
        if (image.width > image.height && image.width / image.height >= 2.5) result = true;
      }
      if (!result && w.eagle.filter.filterRules.shape.panoramicPortrait) {
        if (image.width < image.height && image.height / image.width >= 2.5) result = true;
      }
      if (!result && w.eagle.filter.filterRules.shape['43']) {
        if (image.width / image.height === 4 / 3) {
          result = true;
        }
      }
      if (!result && w.eagle.filter.filterRules.shape['34']) {
        if (image.width / image.height === 3 / 4) {
          result = true;
        }
      }
      if (!result && w.eagle.filter.filterRules.shape['169']) {
        if (image.width / image.height === 16 / 9) {
          result = true;
        }
      }
      if (!result && w.eagle.filter.filterRules.shape['916']) {
        if (image.width / image.height === 9 / 16) {
          result = true;
        }
      }
      if (!result && w.eagle.filter.filterRules.shape.custom) {
        if (w.eagle.filter.filterRules.shape.width && w.eagle.filter.filterRules.shape.height) {
          if (image.width / image.height === w.eagle.filter.filterRules.shape.width / w.eagle.filter.filterRules.shape.height) {
            result = true;
          }
        }
        else {
          result = true;
        }
      }
      return result;
    });
  }

  // 星等筛选
  if (w.eagle.filter.filterRules.rating['5'] || w.eagle.filter.filterRules.rating['4'] || w.eagle.filter.filterRules.rating['3'] || w.eagle.filter.filterRules.rating['2'] || w.eagle.filter.filterRules.rating['1'] || w.eagle.filter.filterRules.rating['0']) {
    let starMap: any = {
      "5": w.eagle.filter.filterRules.rating['5'],
      "4": w.eagle.filter.filterRules.rating['4'],
      "3": w.eagle.filter.filterRules.rating['3'],
      "2": w.eagle.filter.filterRules.rating['2'],
      "1": w.eagle.filter.filterRules.rating['1'],
    };
    data = data.filter(function (image: any) {
      if (w.eagle.filter.filterRules.rating['0'] && !image.star) return true;
      return starMap[image.star];
    });
  }

  // 字体筛选
  if (w.eagle.filter.filterRules.font.activated) {
    data = data.filter(function (image: any) {
      if (!image.fontMetas) return false;
      try {
        var key = Object.keys(image.fontMetas.postScriptName)[0];
        var postScriptName = image.fontMetas.postScriptName && image.fontMetas.postScriptName[key];
        return w.installedFonts[`${postScriptName}_.${image.ext}`];
      }
      catch (err) { /* noop */ }
    });
  }
  else if (w.eagle.filter.filterRules.font.deactivated) {
    data = data.filter(function (image: any) {
      if (!image.fontMetas) return false;
      try {
        var key = Object.keys(image.fontMetas.postScriptName)[0];
        var postScriptName = image.fontMetas.postScriptName && image.fontMetas.postScriptName[key];
        return !w.installedFonts[`${postScriptName}_.${image.ext}`];
      }
      catch (err) { /* noop */ }
    });
  }

  var selectedCameras = Object.keys(w.eagle.filter.filterRules.camera);
  if (selectedCameras.length > 0) {
    data = data.filter(function (image: any) {
      if (image && image.rawMetas && image.rawMetas.camera) {
        return w.eagle.filter.filterRules.camera[image.rawMetas.camera];
      }
      return false;
    });
  }

  // 颜色筛选
  if (w.eagle.filter.filterRules.color.value) {
    data = data.filter((x: any) => machineryColorFilter(s, x));
  }

  // 黑白图片过滤
  if (w.eagle.filter.filterRules.color.gray) {
    console.time("grayColorFilter");
    data = data.filter((x: any) => machineryGrayColorFilter(x));
    console.timeEnd("grayColorFilter");
  }

  if (w.eagle.filter.filterRules.color.value && s.viewMode !== "random") {
    data = data.sort(function (a: any, b: any) {
      var da = s.colorDistancesMap[a.id] || 100;
      var db = s.colorDistancesMap[b.id] || 100;
      if (da > db) return 1;
      if (da < db) return -1;
      return 0;
    });
  }

  // 关键字筛选
  if (s.keyword) {
    console.time("$scope.searchFilter");
    data = data.filter(s.searchFilter);
    console.timeEnd("$scope.searchFilter");
  }

  // 已刪除時間排序
  if (s.viewMode === 'trash') {
    data = getFilter()('orderBy')(data, function (image: any) {
      if (image.deletedTime) {
        return -image.deletedTime;
      }
      return -image.modificationTime;
    });
  }
  else if (s.viewMode === 'random') {
    console.time("shuffle");
    if (s.shuffle.length > 0) {
      data = s.shuffle.filter(function (item: any) {
        return s.itemMappings[item.id] && !s.itemMappings[item.id].isDeleted;
      });
    }
    else {
      (data as any).shuffle();
      s.shuffle = data;
    }
    console.timeEnd("shuffle");
  }

  s.preelaborations = [];
  if (w.eagle.filter.filterBadge > 0) {
    if (w.eagle.filter.folderFilterLogic === "OR" || w.eagle.filter.tagFilterLogic === "OR") {
      data.forEach(function (image: any) {
        s.preelaborations.push(image);
      });
    }
    else {
      s.preelaborations = data;
    }
  }
  else {
    s.preelaborations = data;
  }

  return data;
}

// ── APPEND:c14b-3 ──

/* filterData 分片 3：标签 OR/AND/EQUAL、文件夹 OR/AND/EQUAL、lockedImages、排序、
   以图找图/语义搜索、recent 排序（28170-28504 逐字） */
async function machineryFilterDataPart3(s: any, w: any, data: any[]): Promise<any[]> {

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

/* filterData（bundle 27654-28504 装配；三分片顺序执行） */
export async function machineryFilterData(s: any, data: any[]): Promise<any[]> {
  const w = window as any;
  data = machineryFilterDataPart1(s, w, data);
  data = machineryFilterDataPart2(s, w, data);
  data = await machineryFilterDataPart3(s, w, data);
  return data;
}

/* calcuteFilterResult（bundle 27634-27653 逐字） */
export async function machineryCalcuteFilterResult(s: any, data: any[], contentFilterCache: any): Promise<any[]> {
  s.colorDistancesMap = {};
  return new Promise<any[]>(async (resolve, reject) => {
    try {
      let result: any[];
      if (contentFilterCache) {
        result = contentFilterCache.slice(0);
      }
      else {
        result = s.raw.filter((x: any) => machineryContentFilter(s, x));
        s.contentFilterCache = result.slice(0);
      }
      const filtered = await machineryFilterData(s, result);
      resolve(filtered);
    } catch (err) {
      reject(err);
    }
  });
}

/* ── c14c：contentFilter / calcuteContainTags / RecentFileManager ───────── */

/* RecentFileManager（bundle 52307-52390 逐字；save = w.throttle(1000, immediate)） */
function buildRecentFileManager(): any {
  const w = window as any;
  const RecentFileManager: any = {
    libraryName: "",
    recentFiles: [],
    recentFilesOrder: {},
    maxHistory: 5000,
    init: function (libraryName: any) {
      RecentFileManager.libraryName = libraryName;
      let json = (window as any).localStorage[`eagle.recentFiles.${RecentFileManager.libraryName}`];
      if (json) {
        try {
          RecentFileManager.recentFiles = JSON.parse(json);
          RecentFileManager.calOrders();
        }
        catch (err) {
          RecentFileManager.recentFiles = [];
        }
      }
    },
    calOrders: function () {
      try {
        for (var i = 0; i < RecentFileManager.recentFiles.length; i++) {
          let itemId = RecentFileManager.recentFiles[i];
          RecentFileManager.recentFilesOrder[itemId] = i + 1;
        }
      }
      catch (err) { /* noop */ }
    },
    isExists: function (item: any) {
      if (!item || !item.id) return false;
      return RecentFileManager.recentFilesOrder[item.id];
    },
    addFile: function (item: any) {
      try {
        if (!RecentFileManager.libraryName) {
          console.error("RecentFileManager.libraryName is empty");
          return;
        }
        if (!item || !item.id) return;
        RecentFileManager.recentFiles.unshift(item.id);
        RecentFileManager.calOrders();
        RecentFileManager.save();
      }
      catch (err) { /* noop */ }
    },
    addFiles: function (items: any) {
      try {
        if (!RecentFileManager.libraryName) {
          console.error("RecentFileManager.libraryName is empty");
          return;
        }
        if (!items) return;
        if (items.length >= 20) return;
        items.reverse().forEach(function (item: any) {
          if (!item || !item.id) return;
          RecentFileManager.recentFiles.unshift(item.id);
          RecentFileManager.calOrders();
        });
        RecentFileManager.save();
      }
      catch (err) { /* noop */ }
    },
    clean: function () {
      RecentFileManager.recentFiles = [];
      RecentFileManager.recentFilesOrder = {};
      RecentFileManager.save();
    },
    save: w.throttle(function () {
      try {
        if (!RecentFileManager.libraryName) {
          console.error("RecentFileManager.libraryName is empty");
          return;
        }
        // 最多保存 5000 個
        RecentFileManager.recentFiles = [...new Set(RecentFileManager.recentFiles)];
        if (RecentFileManager.recentFiles.length > RecentFileManager.maxHistory) {
          RecentFileManager.recentFiles.length = RecentFileManager.maxHistory;
        }
        let json = JSON.stringify(RecentFileManager.recentFiles);
        (window as any).localStorage[`eagle.recentFiles.${RecentFileManager.libraryName}`] = json;
      }
      catch (err) { /* noop */ }
    }, 1000, true),
  };
  return RecentFileManager;
}

/* contentFilter（bundle 31804-31896 逐字；isInFolder 复用 controllerFns 移植版，
   RecentFileManager 经 window 解析） */
export function machineryContentFilter(s: any, image: any): boolean {
  const w = window as any;
  try {
    if (s.$root.selectedSmartFolders.length > 0) {
      if (image.isDeleted) return false;
      for (let i = 0; i < s.$root.selectedSmartFolders.length; i++) {
        let smartFolder = s.$root.selectedSmartFolders[i];
        if (machineryExistInSmartFilter(s, smartFolder, image)) {
          return true;
        }
      }
      return false;
    }
    else if (s.currentSmartFolder) {
      if (image.isDeleted) return false;
      if (s.currentSmartFolder.children && s.currentSmartFolder.children.length === 0 && s.currentSmartFolder.conditions && s.currentSmartFolder.conditions.length === 0) {
        return false;
      }
      else if (s.currentSmartFolder.children && s.currentSmartFolder.children.length > 0 && s.currentSmartFolder.conditions && s.currentSmartFolder.conditions.length === 0) {
        for (let i = 0; i < s.currentSmartFolder.children.length; i++) {
          let smartFolder = s.currentSmartFolder.children[i];
          if (machineryExistInSmartFilter(s, smartFolder, image)) {
            return true;
          }
        }
        return false;
      }
      else {
        return machineryExistInSmartFilter(s, s.currentSmartFolder, image);
      }
    }
    switch (s.viewMode) {
      case "all":
        if (!image.isDeleted) return true;
        break;
      case "unfiled":
        if (image.isDeleted) return false;
        if (!image.folders || image.folders.length === 0 || (image.folders.length === 1 && image.folders[0] && !s.folderMappings[image.folders[0]])) {
          return true;
        }
        break;
      case "untagged":
        if (image.isDeleted) return false;
        if (!image.tags || image.tags.length === 0) {
          return true;
        }
        break;
      case "random":
        if (!image.isDeleted) return true;
        break;
      case "recent":
        return (w.RecentFileManager.isExists(image));
      case "trash":
        if (image.isDeleted) return true;
        break;
      default:
        // 文件夹多选
        if (s.$root.selectedFolders.length > 0) {
          if (image.isDeleted) return false;
          for (var i = 0; i < s.$root.selectedFolders.length; i++) {
            var folder = s.$root.selectedFolders[i];
            if (isInFolder(image, folder)) {
              return true;
            }
          }
        }
        // 文件夹单选
        else if (s.currentFolder) {
          if (image.isDeleted) return false;
          if (isInFolder(image, s.currentFolder)) {
            return true;
          }
          return false;
        } else if (s.currentTag) {
          if (image.isDeleted) return false;
          return image.tags.indexOf(s.currentTag) > -1;
        }
        return false;
    }
    return false;
  }
  catch (err) {
    return false;
  }
}

/* calcuteContainTags 闭包版（bundle 27196-27292 逐字） */
function machineryCalcuteContainTagsInner(s: any, data: any[]): any {
  const w = window as any;
  var tagsCount: any = {};
  var tagsMappings: any = {};
  var noTagsCount = 0;

  w.eagle.filter.filterRules.tag.excludes.forEach(function (tag: any) {
    tagsCount[tag] = 0;
  });

  for (var i = data.length - 1; i >= 0; i--) {
    var image = data[i];
    if (image.tags && image.tags.length > 0) {
      image.tags.forEach(function (tag: any) {
        if (tag && tag.length > 200) return;
        if (!tagsCount[tag]) { tagsCount[tag] = 0; }
        tagsCount[tag]++;
      });
    }
    else {
      noTagsCount++;
    }
  }

  var tags = Object.keys(tagsCount).map(function (key: any) {
    var idx = w.eagle.filter.filterRules.tag.includes.indexOf(key);
    var eidx = w.eagle.filter.filterRules.tag.excludes.indexOf(key);
    var index;
    if (idx > -1 && (w.eagle.filter.tagFilterLogic === "AND")) {
      index = tagsCount[key] - idx;
    }
    else if (eidx > -1 && (w.eagle.filter.tagFilterLogic === "AND")) {
      index = tagsCount[key] - 100;
    }
    else {
      index = tagsCount[key] - 100;
    }
    tagsMappings[key] = {
      isSelected: idx > -1,
      isExcluded: eidx > -1,
      name: key,
      pinyin: s.TagManager.tagMappings[key] && s.TagManager.tagMappings[key].pinyin,
      imageCount: tagsCount[key],
      index: index
    };
    return tagsMappings[key];
  });

  tags.sort(function (tag1: any, tag2: any) {
    return tag2.imageCount - tag1.imageCount;
  });

  if (noTagsCount === 0 && !w.eagle.filter.isLock) {
    w.eagle.filter.filterRules.tag.no = false;
  }

  return {
    containTagsMappings: tagsMappings,
    containTags: tags,
    noTagsCount: noTagsCount
  };
}

/* $scope.calcuteContainTags（bundle 27155-27194 逐字） */
export function machineryCalcuteContainTags(s: any, data: any[]): void {
  const w = window as any;
  var result = machineryCalcuteContainTagsInner(s, data);

  // 建立群组列表
  var tagsMappings = result.containTagsMappings;
  s.TagManager.groups.forEach(function (group: any) {
    var groupObject = [];
    group.tags.forEach(function (tag: any) {
      if (tagsMappings[tag]) {
        groupObject.push(tagsMappings[tag]);
        tagsMappings[tag].type = "group-item";
        tagsMappings[tag].group = group;
      }
    });
  });

  s.containTags = [];
  syncFilterFromScope();

  var collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  result.containTags = result.containTags.sort(function (a: any, b: any) {
    return collator.compare(a.name, b.name);
  });

  result.containTags.forEach(function (tag: any) {
    s.containTags.push(tag);
    syncFilterFromScope();
  });

  // 显示未标签功能
  if (result.noTagsCount > 0) {
    s.containTags.unshift({
      isSelected: w.eagle.filter.filterRules.tag.no,
      name: w.i18n.__("Filter.NoTags"),
      imageCount: result.noTagsCount,
      index: 100000000,
      isNoTags: true
    });
    syncFilterFromScope();
  }
}

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

/* zoom（bundle 31191-31204 逐字；zoomFitEdge/zoomFit/smartZoom 经 scope 解析） */
export function machineryZoom(s: any): void {
  const w = window as any;
  if (!s.isDetailMode) return;
  if (s.lastZoomMode === "edge") {
    if (s.current && !w.VIDEO_TYPES[s.current.ext]) {
      machineryZoomFitEdge(s);
    }
    else {
      machineryZoomFit(s);
    }
  }
  else {
    machinerySmartZoom(s);
  }
}

/* ── c15b：列表高度/缩放适配 ─────────────────────────────────────────── */

/* b1-9bd：saveListHeight 实现体归位 services/gridService.ts——此处仅存委托壳
   （machinery 内部其余 2 处直调点与 scope 挂载面不变）。 */
export function machinerySaveListHeight(s: any, height: any): void {
  gridSaveListHeight(s, height);
}

/* b1-9bd：adjustLayoutWidth 实现体归位 services/gridService.ts */
export function machineryAdjustLayoutWidth(s: any, increases: any): void {
  gridAdjustLayoutWidth(s, increases);
}

/* b1-9bd：zoomFit 实现体归位 services/gridService.ts */
export function machineryZoomFit(s: any, event: any, noAnimation: any): void {
  gridZoomFit(s, event, noAnimation);
}

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

/* changeSidebarIndex（bundle 36656-36665 逐字） */
export function machineryChangeSidebarIndex(s: any, node: any): void {
  const $timeout = getTimeout();
  const folder = s.folderMappings[node?.id];
  const idx = s.sidebarList.indexOf(folder);
  if (idx !== -1) {
    s.sidebarIndex = -1;
    syncSidebarFromScope();
    $timeout(function () {
      s.sidebarIndex = idx;
      syncSidebarFromScope();
    }, 1);
  }
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
let calculateFilterCountsTimeout: any = null;
export function machineryCalculateFilterCounts(s: any): void {
  const w = window as any;
  clearTimeout(calculateFilterCountsTimeout);
  calculateFilterCountsTimeout = setTimeout(function () {
    console.time("calculateFilterCounts");
    w.eagle.filter.resetFilterCounts();
    let now = Date.now();
    for (let i = 0; i < s.allData.length; i++) {
      const image = s.allData[i];
      machineryUpdateFilterCounts(s, image, 1, now);
    }
    console.timeEnd("calculateFilterCounts");
    scopeEvalAsync();
  }, 500);
}

/* ── c15d：openAll 及支撑链 ──────────────────────────────────────────── */

// ── c15d 域内自管（原 controller 闭包 var）──
let openAllTimeout: any = null;
let updateListHeightTimeout: any = null;

/* setViewMode（bundle 38475-38479 逐字；_.debounce 500——防抖实例为模块级单例，与 bundle
   controller init 同语义） */
let setViewModeDebounced: any = null;
export function machinerySetViewMode(s: any, viewMode: any): void {
  const w = window as any;
  if (!viewMode) return;
  if (!setViewModeDebounced) {
    setViewModeDebounced = debounce(function (vm: any) {
      localStorage.setItem(`eagle.viewMode.${s.rootDir}`, vm);
    }, 500);
  }
  setViewModeDebounced(viewMode);
}

/* setLastFolder（bundle 38480-38488 逐字；_.debounce 500 单实例语义同上） */
let setLastFolderDebounced: any = null;
function machinerySetLastFolder(s: any, folderId: any): void {
  const w = window as any;
  if (!setLastFolderDebounced) {
    setLastFolderDebounced = debounce(function (fid: any) {
      if (!fid) {
        localStorage.removeItem(`eagle.lastFolder.${s.rootDir}`);
      }
      else {
        machinerySetViewMode(s, "all");
        localStorage.setItem(`eagle.lastFolder.${s.rootDir}`, fid);
      }
    }, 500);
  }
  setLastFolderDebounced(folderId);
}

/* updateListHeight（bundle 33712-33719 逐字；50ms 防抖） */
export function machineryUpdateListHeight(s: any, height: any): void {
  const w = window as any;
  clearTimeout(updateListHeightTimeout);
  updateListHeightTimeout = setTimeout(function () {
    setAttr("#box-container", "box-size", height);
  }, 50);
}

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
export function machinerySaveFolder(s: any): void {
  const w = window as any;
  console.time("$scope.saveFolder");

  // 保存時進行日文濁音正規化
  const unrom = w.require(w.appRoot.path + '/app/js/utils/unorm.js');
  const nfc = (text: any) => {
    try {
      return unrom.nfc(text);
    }
    catch (err) {
      return text;
    }
  };

  var folders: any[] = [];
  w.cloneTree(folders, s.folders);

  w.eagle.utils.tree.walk(folders, 'children', function (folder: any, parent: any, depth: any) {
    folder.name = nfc(folder.name);
  });

  const smartFolders = s.smartFolders.map(function (smartFolder: any) {
    var clone: any = {
      id: smartFolder.id,
      icon: smartFolder.icon,
      iconColor: smartFolder.iconColor,
      name: smartFolder.name,
      description: smartFolder.description || "",
      modificationTime: smartFolder.modificationTime,
      conditions: smartFolder.conditions,
    };
    if (smartFolder.children) {
      clone.children = smartFolder.children;
    }
    if (smartFolder.orderBy) {
      clone.orderBy = smartFolder.orderBy;
      clone.sortIncrease = smartFolder.sortIncrease;
    }
    return clone;
  });

  w.eagle.utils.tree.walk(smartFolders, 'children', function (smartFolder: any, parent: any, depth: any) {
    smartFolder.name = nfc(smartFolder.name);
  });

  const groups = s.TagManager.groups.map(function (group: any) {
    var g: any = {
      id: group.id,
      name: nfc(group.name),
      tags: group.tags
    };
    if (group.color) {
      g.color = group.color;
    }
    if (group.description !== undefined) {
      g.description = group.description;
    }
    return g;
  });

  const quickAccess = s.quickAccess.map(function (item: any) {
    return {
      type: item.type,
      id: item.id
    };
  });

  const libraryPath = s.libraryPath;

    // IPCHelper（bundle 3471 const = 脚本级词法绑定，window/ESM 均不可达）——send 语义等价
  // 复刻（bundle 3473-3482：ipcRenderer.send + electronLog + try/catch 静默）
  try {
    const ipc = w.__eagleIpc || (w.electron && w.electron.ipcRenderer);
    ipc.send('folders-change', {
      // NOTE: 把資源庫路徑寫死，避免更新到其他資源庫路徑
      libraryDir: libraryPath,
      folders: folders,
      smartFolders: smartFolders,
      quickAccess: quickAccess,
      tagsGroups: groups,
    });
    w.electronLog && w.electronLog.info('[ipc] folders-change');
  }
  catch (err) {
  }

  console.timeEnd("$scope.saveFolder");
}

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
export function machineryDestoryMousetrap(s: any): void {
  const w = window as any;
  if (!s.mousetrap) return;

  for (var key in s.mousetrap) {
    if (s.mousetrap.hasOwnProperty(key)) {
      w.Mousetrap.unbind(key);
    }
  }
}

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

/* lastZoom（bundle 31288-31305 逐字；lastItemStates 经 scope 解析） */
export function machineryLastZoom(s: any): boolean {
  const w = window as any;
  if (s.lastZoomMode === "edge") return false;
  if (s.$root.preferences.habits.rememberLastZoom === "off") return false;
  if (!s.current) return false;
  if (s.isInlineMode) return false;
  var state = s.lastItemStates[s.current.id];
  if (state && state.data && state.data.tX !== undefined) {
    detailZoom()?.goTo( state.data.tX, state.data.tY, state.data.rA);
    var ratio = parseInt(state.data.rA * 100 as any);
    s.imageSize.zoomRatio = machineryGetRatioNonExp(ratio);
    machineryOnZoomRatioChanged(s);
    s.imageSize.zoomRatioExp = ratio;
    return true;
  }
  return false;
}

/* smartZoom（bundle 31209-31334 逐字；devicesMetrics/isMobileResolution/getImagePixelDensity/
   isMobileWidth 经 window（c18a 供给），zoomRatio 换算走 machinery 版） */
export function machinerySmartZoom(s: any, target: any, forceMode: any): void {
  detailSmartZoom(s, target, forceMode);
}

/* ── c18b：详情缩放余部（zoomActual/toggleZoom/zoomFitEdge/updateContainerHieght）── */

/* zoomActual（bundle 33915-33937 逐字） */
export function machineryZoomActual(s: any, event: any): void {
  const w = window as any;
  event && event.preventDefault && event.preventDefault();
  if (!s.isDetailMode) {
    s.imageSize.height = 150;
    syncToolbarFromScope();
    syncBodyFromScope();
    syncDetailFromScope();
    syncInspectorFromScope();
    machineryOnImageSizeHeightChanged(s);
    machineryChangeListHeight(s);
    if (s.layout === "GridLayout" || s.layout === "SquareLayout") {
      machineryAdjustLayoutWidth(s, 0);
      machinerySaveListHeight(s, s.imageSize.height);
    }
  } else {
    s.imageSize.zoomRatio = 100;
    machineryOnZoomRatioChanged(s);
    s.imageSize.zoomRatioExp = getRatioExp(s.imageSize.zoomRatio);
    machineryUpdateZoomRatio(s, 100, undefined, undefined, true);

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

/* toggleZoom（bundle 33990-34012 逐字） */
export function machineryToggleZoom(s: any, event: any): void {
  const w = window as any;
  if (!s.isDetailMode) return;
  if (s.VIDEO_TYPES[s.current.ext]) {
    if (s.lastZoomMode !== "edge") {
      machineryZoomFit(s, event);
      s.lastZoomMode = "edge";
      syncDetailFromScope();
      s.zoomFitSize = s.imageSize.zoomRatioExp;
    }
    else {
      machineryZoomActual(s, event);
      s.lastZoomMode = "fit";
      syncDetailFromScope();
      s.zoomFitSize = 0;
    }
  }
  else {
    if (s.lastZoomMode !== "edge") {
      machineryZoomFitEdge(s, event, true);
      s.lastZoomMode = "edge";
      syncDetailFromScope();
    }
    else {
      machineryZoomFit(s, event);
      s.lastZoomMode = "fit";
      syncDetailFromScope();
    }
  }
  localStorage["eagle.viewer.lastZoomMode"] = s.lastZoomMode;
}

/* zoomFitEdge（bundle 34015-34077 逐字） */
export function machineryZoomFitEdge(s: any, event: any, hasTransition: any): void {
  const w = window as any;
  event && event.preventDefault && event.preventDefault();

  if (hasTransition) {
    addClass("#detail-container", "zooming");
    setTimeout(function () {
      removeClass("#detail-container", "zooming");
    }, 300);
  }

  var current = s.current;
  var ratio = s.imageSize.zoomRatio || 100;
  var lastRatio = ratio;
  var $container = q(".content-panel");
  var toolbarHeight = 40;
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
    s.imageSize.zoomRatio = machineryGetRatioNonExp(ratio);
    machineryOnZoomRatioChanged(s);
    s.imageSize.zoomRatioExp = ratio;
    s.zoomFitSize = ratio;
  }
  s.showLargeImage = true;
  detailZoom()?.focusTo( {
    x: width / 2,
    y: height / 2 + offsetY,
    zoom: parseInt(ratio),
    speed: 0
  });
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
export function machineryCopyImages(s: any, event: any): void {
  const w = window as any;
  if (s.viewMode === 'alltags') {
    var selectedTags = machineryGetSelectedTags(s);
    if (selectedTags && selectedTags.length > 0) {
      w.electron.clipboard.writeText(selectedTags.join(","));
      s.notify({
        message: getFilter()('i18n')("Context.Tag.Copy.Success"),
        duration: 1000
      });
    }
  }
  else {
    if (s.$root.currentFocus == "sidebar") {
      if (s.$root.selectedFolders.length > 0) {
        let copyText = "";
        s.$root.selectedFolders.forEach(function (folder: any, index: any) {
          copyText += folder.name;
          if (index < s.$root.selectedFolders.length - 1) {
            copyText += "\n";
          }
        });
        w.electron.clipboard.writeText(copyText);
      }
      else if (s.$root.selectedSmartFolders.length > 0) {
        let copyText = "";
        s.$root.selectedSmartFolders.forEach(function (folder: any, index: any) {
          copyText += folder.name;
          if (index < s.$root.selectedSmartFolders.length - 1) {
            copyText += "\n";
          }
        });
        w.electron.clipboard.writeText(copyText);
      }
      else if (s.currentSmartFolder) {
        w.electron.clipboard.writeText(s.currentSmartFolder.name);
      }
      else if (s.currentFolder) {
        w.electron.clipboard.writeText(s.currentFolder.name);
      }
    }
    else if (s.selected.length > 0) {
      const ipc = w.__eagleIpc || (w.electron && w.electron.ipcRenderer);
      ipc.sendTo(w.backgroundWindowID, 'copy-images', s.selected);
      w.RecentFileManager.addFiles(s.selected);
      setTimeout(function () {
        s.notify({
          message: getFilter()('i18n')("previewWindow.copied"),
          duration: 1000
        });
      }, 150);
    }
  }
}

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

export function machineryModShiftUpHandler(s: any, event: any): void {
  event && event.preventDefault();
  if (s.isCropMode) {
    resizeCropToolChannel.emit({
      horizontal: 0,
      vertical: -10
    });
    return;
  }
}

export function machineryModShiftDownHandler(s: any, event: any): void {
  event && event.preventDefault();
  if (s.isCropMode) {
    resizeCropToolChannel.emit({
      horizontal: 0,
      vertical: 10
    });
    return;
  }
}

export function machineryModShiftLeftHandler(s: any, event: any): void {
  event && event.preventDefault();
  if (s.isCropMode) {
    resizeCropToolChannel.emit({
      horizontal: -10,
      vertical: 0
    });
    return;
  }
}

export function machineryModShiftRightHandler(s: any, event: any): void {
  event && event.preventDefault();
  if (s.isCropMode) {
    resizeCropToolChannel.emit({
      horizontal: 10,
      vertical: 0
    });
    return;
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

function machineryOpenPrevGroup(s: any): void {
  if (s.tagViewMode === "ALL") {
    return;
  }
  else if (s.tagViewMode === "UNFILED") {
    machineryOpenTagAllGroup(s);
  }
  else if (s.tagViewMode === "STARRED") {
    machineryOpenUnfiledGroup(s);
  }
  else {
    var $visibleGroups = qaVisible(".tag-manager-sidebar .group-item");
    var $currentGroup = q(".tag-manager-sidebar .group-item.active");
    var currentIndex = $currentGroup ? $visibleGroups.indexOf($currentGroup) : -1;
    if (currentIndex === 0) {
      machineryOpenStarredGroup(s);
    }
    else if (currentIndex > 0) {
      var prev = s.TagManager.groups[currentIndex - 1];
      if (prev) {
        machineryOpenTagGroup(s, prev);
      }
    }
  }
}

function machineryOpenNextGroup(s: any): void {
  if (s.tagViewMode === "ALL") {
    machineryOpenUnfiledGroup(s);
  }
  else if (s.tagViewMode === "UNFILED") {
    machineryOpenStarredGroup(s);
  }
  else if (s.tagViewMode === "STARRED") {
    if (s.TagManager.groups[0]) {
      machineryOpenTagGroup(s, s.TagManager.groups[0]);
    }
  }
  else if (s.TagManager.groups.length > 0) {
    var $visibleGroups = qaVisible(".tag-manager-sidebar .group-item");
    var $currentGroup = q(".tag-manager-sidebar .group-item.active");
    var currentIndex = $currentGroup ? $visibleGroups.indexOf($currentGroup) : -1;
    var next = s.TagManager.groups[currentIndex + 1];
    if (next) {
      machineryOpenTagGroup(s, next);
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

/* getArroundBox（bundle 35091-35097 逐字，controller 闭包） */
export function machineryGetArroundBox(s: any, index: any): any {
  var arroundStart = (index - 20 >= 0) ? index - 20 : 0;
  var arroundEnd = (index + 20 > s.allData.length) ? s.allData.length : index + 20;
  var $arround = qa(".box").slice(arroundStart, arroundEnd);
  return $arround;
}

/* scrollbarTo（bundle 35612-35635 逐字）+ Math.easeInOutQuad（35638-35643 逐字；bundle 于
   controller init 补丁全局 Math，此处同体幂等补丁） */
(Math as any).easeInOutQuad = function (t: any, b: any, c: any, d: any) {
  t /= d / 2;
  if (t < 1) return c / 2 * t * t + b;
  t--;
  return -c / 2 * (t * (t - 2) - 1) + b;
};

function machineryScrollbarTo(element: any, to: any, duration: any): void {
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
export function machineryCloseWindowHandler(s: any, $event: any): void {
  const w = window as any;
  if (s.isPreviewing) {
    if (w.process.platform == 'darwin') {
      w.event && w.event.stopPropagation();
      w.event && w.event.preventDefault();
      w.IPCHelper.send('quicklook', s.selected[0]);
      s.isPreviewing = false;
    }
  }
}

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

/* mHandler（bundle 30825-30834 逐字：详情内视频/音频静音切换） */
export function machineryMHandler(s: any, $event: any): void {
  const w = window as any;
  if (!s.isDetailMode) {
    return;
  }
  if (w.VIDEO_TYPES[s.current.ext] || w.AUDIO_TYPES[s.current.ext]) {
    clickEl(".vjs-mute-control");
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
export function machineryZoomIn(s: any, event: any): void {
  gridZoomIn(s, event);
}

export function machineryZoomOut(s: any, event: any): void {
  gridZoomOut(s, event);
}

/* saveHandler（bundle 35985-35991 逐字：crop 模式 saveCrop；saveCrop 经 scope 解析） */
export function machinerySaveHandler(s: any): void {
  if (s.isRotating) return;
  if (s.isCropMode) {
    saveCrop();
  }
}

/* refreshRandom（bundle 42824-42837 逐字：random 视图/RANDOM 排序守卫 + shuffle 清空 +
   refresh-random active 闪烁 50ms + reload（machinery 版经 scope）） */
export function machineryRefreshRandom(s: any): void {
  const w = window as any;
  if (s.isDetailMode) return;

  if (
    s.viewMode === 'random' ||
    (s.currentFolder && s.currentFolder.orderBy === "RANDOM") ||
    (s.currentSmartFolder && s.currentSmartFolder.orderBy === "RANDOM")
  ) {
    s.shuffle = [];
    addClass("#refresh-random", "active");
    setTimeout(function () {
      removeClass("#refresh-random", "active");
    }, 50);
    s.reload();
  }
}

/* ── c18f-2：openParentFolder/createTxtFileFromTemplate/setFolderCover ── */

/* openParentFolder（bundle 38384-38388 逐字；openFolder 经 scope 解析） */
export function machineryOpenParentFolder(s: any): void {
  if (s.currentFolder && s.currentFolder.parent) {
    openFolder(s.folderMappings[s.currentFolder.parent]);
  }
}

/* createTxtFileFromTemplate（bundle 37329-37334 逐字；newFileFromTemplate 为 bundle scope
   函数经 scope 解析——文件创建域后续独立切片） */
export function machineryCreateTxtFileFromTemplate(s: any, event: any): void {
  event && event.preventDefault();
  machineryNewFileFromTemplate(s, "txt");
  scopeEvalAsync();
}

/* setFolderCover（bundle 41438-41454 逐字；FileUrlHelper 经 window、getFilter() 复刻
   $filter('i18n')、notify/saveFolder 走 machinery 版） */
export function machinerySetFolderCover(s: any): void {
  const item = s.selected[0];
  if (!s.currentFolder || !item) return;
  s.currentFolder.coverId = item.id;
  var thumbnailUrl = (window as any).FileUrlHelper.getThumbnailUrl(item);
  s.currentFolder.covers[0] = `<img class="sub-folder-cover" src="${thumbnailUrl}" style="aspect-ratio: ${s.selected[0].width / s.selected[0].height};">`;
  var message = getFilter()('i18n')("notify.folder.setAsCover", [
    { "property": "folderName", "value": s.currentFolder.name }
  ]);
  s.notify({
    message: message,
    duration: 750
  });
  machinerySaveFolder(s);
}

/* ── c18f-3：inspector 面板/快捷搜索打开器 ───────────────────────────── */

/* openQuickSearch（bundle 32512-32514 逐字） */
export function machineryOpenQuickSearch(s: any, event: any): void {
  openQuickSearchModalChannel.emit();
}

/* openActionsPanel（bundle 43279-43282 逐字；eagle.action 经 window） */
export function machineryOpenActionsPanel(s: any, event: any): void {
  (window as any).eagle.action.open(s.selected);
}

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
export function machineryGetItemByElement(s: any, element: any): any {
  if (!element) return "";
  // var id = element.id.replace("box-", "");
  var id = element.getAttribute("data-box-id");
  return s.itemMappings[id];
}

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
function escapeRegex(str: any): any {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function machineryConvertToRegexGroup(keywords: any, keywords_cn: any, keywords_tw: any): any {
    const regexGroup: any = {
        mustMatch: [] as any[],      // AND 邏輯
        mustNotMatch: [] as any[],   // NOT 邏輯
        anyMatch: [] as any[],       // OR 邏輯
        exactMatch: [] as any[]      // 精確匹配（雙引號）
    };

    keywords.forEach((keyword: any, index: any) => {
        if (Array.isArray(keyword)) {
            // OR 群組
            const positives: any[] = [];
            const negatives: any[] = [];

            keyword.forEach((k: any, orIndex: any) => {
                if (k.startsWith('-')) {
                    // 處理負向條件
                    let word = k.substring(1).replace(/"/g, '');
                    negatives.push(word);

                    // 加入繁簡體版本
                    if (keywords_cn && keywords_cn[index] && keywords_cn[index][orIndex]) {
                        let word_cn = keywords_cn[index][orIndex].substring(1).replace(/"/g, '');
                        if (word_cn !== word) negatives.push(word_cn);
                    }
                    if (keywords_tw && keywords_tw[index] && keywords_tw[index][orIndex]) {
                        let word_tw = keywords_tw[index][orIndex].substring(1).replace(/"/g, '');
                        if (word_tw !== word) negatives.push(word_tw);
                    }
                } else if (k.startsWith('"') && k.endsWith('"')) {
                    // OR 群組中的精確匹配暫時當作一般匹配處理
                    let word = k.replace(/"/g, '');
                    positives.push(word);

                    // 加入繁簡體版本
                    if (keywords_cn && keywords_cn[index] && keywords_cn[index][orIndex]) {
                        let word_cn = keywords_cn[index][orIndex].replace(/"/g, '');
                        if (word_cn !== word) positives.push(word_cn);
                    }
                    if (keywords_tw && keywords_tw[index] && keywords_tw[index][orIndex]) {
                        let word_tw = keywords_tw[index][orIndex].replace(/"/g, '');
                        if (word_tw !== word) positives.push(word_tw);
                    }
                } else {
                    // 處理正向條件
                    let word = k;
                    positives.push(word);

                    // 加入繁簡體版本
                    if (keywords_cn && keywords_cn[index] && keywords_cn[index][orIndex]) {
                        let word_cn = keywords_cn[index][orIndex];
                        if (word_cn !== word) positives.push(word_cn);
                    }
                    if (keywords_tw && keywords_tw[index] && keywords_tw[index][orIndex]) {
                        let word_tw = keywords_tw[index][orIndex];
                        if (word_tw !== word) positives.push(word_tw);
                    }
                }
            });

            // 建立正向 OR 的 RegEx
            if (positives.length > 0) {
                const pattern = positives.map(escapeRegex).join('|');
                regexGroup.anyMatch.push(new RegExp(`(${pattern})`, 'i'));
            }

            // 負向條件單獨處理
            negatives.forEach((neg: any) => {
                regexGroup.mustNotMatch.push(new RegExp(escapeRegex(neg), 'i'));
            });

        } else if (keyword.startsWith('-')) {
            // 單純 NOT
            let word = keyword.substring(1).replace(/"/g, '');
            let patterns = [word];

            // 加入繁簡體版本
            if (keywords_cn && keywords_cn[index]) {
                let word_cn = keywords_cn[index].substring(1).replace(/"/g, '');
                if (word_cn !== word) patterns.push(word_cn);
            }
            if (keywords_tw && keywords_tw[index]) {
                let word_tw = keywords_tw[index].substring(1).replace(/"/g, '');
                if (word_tw !== word) patterns.push(word_tw);
            }

            const pattern = patterns.map(escapeRegex).join('|');
            regexGroup.mustNotMatch.push(new RegExp(`(${pattern})`, 'i'));

        } else {
            // 單純 AND
            let word = keyword.replace(/"/g, '');
            let patterns = [word];

            // 加入繁簡體版本
            if (keywords_cn && keywords_cn[index]) {
                let word_cn = keywords_cn[index].replace(/"/g, '');
                if (word_cn !== word) patterns.push(word_cn);
            }
            if (keywords_tw && keywords_tw[index]) {
                let word_tw = keywords_tw[index].replace(/"/g, '');
                if (word_tw !== word) patterns.push(word_tw);
            }

            const pattern = patterns.map(escapeRegex).join('|');
            regexGroup.mustMatch.push(new RegExp(`(${pattern})`, 'i'));
        }
    });

    return regexGroup;
}

function machineryMatchWithRegexGroup(text: any, regexGroup: any): any {
    // 1. 所有 mustMatch 都必須匹配
    for (let regex of regexGroup.mustMatch) {
        if (!regex.test(text)) return false;
    }

    // 2. 所有 mustNotMatch 都不能匹配
    for (let regex of regexGroup.mustNotMatch) {
        if (regex.test(text)) return false;
    }

    // 3. 每個 anyMatch（OR群組）至少要有一個匹配
    for (let regex of regexGroup.anyMatch) {
        if (!regex.test(text)) return false;
    }

    // 如果沒有任何條件，或所有條件都通過
    return regexGroup.mustMatch.length > 0 ||
           regexGroup.mustNotMatch.length > 0 ||
           regexGroup.anyMatch.length > 0;
}

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
// 且 colorDistancesMap 排序比较器恒空。依赖 npm color-convert@2 + delta-e
// （bundle 9153-9154 顶层 require 同款；v2 裸 .lab 输出取整 Lab 与原版行为一致）。
// bundle 同域 rgb2lab（32664）全 bundle 零调用（死代码）不移植；
// `eagle.filter.filterRules.color.accuracy = 20` 默认值已由 eagleClasses.ts 初始化承载。
// 計算顏色相似性（bundle 32784-32795 逐字）
function machineryColorSimilarityDistance(color1: any, color2: any): any {
    var c1: any = colorConvert.rgb.lab(color1[0], color1[1], color1[2]);
    var c2: any = colorConvert.rgb.lab(color2[0], color2[1], color2[2]);
    var l1 = { L: c1[0], A: c1[1], B: c1[2] };
    var l2 = { L: c2[0], A: c2[1], B: c2[2] };
    var d76 = DeltaE.getDeltaE76(l1, l2);
    var d2000 = DeltaE.getDeltaE00(l1, l2);
    return {
        d76: d76,
        d2000: d2000,
    };
}

/* colorFilter（bundle 32689-32781 逐字） */
export function machineryColorFilter(s: any, image: any): boolean {
    const w = window as any;
    try {
        // 防呆
        if (!image.palettes || image.palettes.length === 0) return false;

        var ratio0 = image.palettes[0].ratio;
        var r0 = image.palettes[0].color[0];
        var g0 = image.palettes[0].color[1];
        var b0 = image.palettes[0].color[2];
        var rt = w.eagle.filter.filterRules.color.value[0];
        var gt = w.eagle.filter.filterRules.color.value[1];
        var bt = w.eagle.filter.filterRules.color.value[2];

        if (ratio0 < 25) {
            return false;
        }

        var white = [255, 255, 255];
        var acceptAccuracy1 = w.eagle.filter.filterRules.color.accuracy;
        var acceptAccuracy2 = (w.eagle.filter.filterRules.color.accuracy - 10 >= 5) ? w.eagle.filter.filterRules.color.accuracy - 10 : 3;

        if (!w.eagle.filter.filterRules.color.value) return true;
        if (!image.palettes || image.palettes.length < 0) return false;
        if (!image.palettes[0]) return false;

        if (image?.palettes?.[0]?.color && w.eagle?.filter?.filterRules?.color?.value) {
            try {
                const palette0 = image.palettes[0].color;
                const filterColor = w.eagle.filter.filterRules.color.value;

                const isMatchPalette0 = palette0[0] === filterColor[0] && palette0[1] === filterColor[1] && palette0[2] === filterColor[2];
                const isMatchPalette1 = image.palettes[1]?.color &&
                                        image.palettes[1].color[0] === filterColor[0] &&
                                        image.palettes[1].color[1] === filterColor[1] &&
                                        image.palettes[1].color[2] === filterColor[2];

                if (isMatchPalette0 || isMatchPalette1) {
                    s.colorDistancesMap[image.id] = 0.01;
                    return true;
                }
            }
            catch (err) {}
        }

        // 使用 YUV 相似模型计算 （ 0 ~ 1 ）
        if (ratio0 > 33) {
            let d1 = machineryColorSimilarityDistance(w.eagle.filter.filterRules.color.value, image.palettes[0].color);
            if (d1.d2000 < acceptAccuracy1 && d1.d76 < acceptAccuracy1 + 50) {
                s.colorDistancesMap[image.id] = d1.d76;
                return true;
            }
            if (ratio0 > 50) {
                let white_d = machineryColorSimilarityDistance(white, image.palettes[0].color);
                if (white_d.d2000 < 5) {
                    if (image.palettes[1] && image.palettes[1].ratio > 8) {
                        let d2 = machineryColorSimilarityDistance(w.eagle.filter.filterRules.color.value, image.palettes[1].color);
                        if (d2.d2000 < acceptAccuracy1 && d2.d76 < acceptAccuracy1 + 50) {
                            s.colorDistancesMap[image.id] = d2.d76 + 5;
                            return true;
                        }
                    }
                }
            }
        }
        if (image.palettes[1] && image.palettes[1].ratio > 33) {
            let d2 = machineryColorSimilarityDistance(w.eagle.filter.filterRules.color.value, image.palettes[1].color);
            if (d2.d2000 < acceptAccuracy1 && d2.d76 < acceptAccuracy1 + 50) {
                s.colorDistancesMap[image.id] = d2.d76;
                return true;
            }
        }

        // 自定义主色
        for (var i = 0; i < image.palettes.length; i++) {
            var palette = image.palettes[i];
            if (palette.marked) {
                var md = machineryColorSimilarityDistance(w.eagle.filter.filterRules.color.value, palette.color);
                if (md.d2000 < 30) {
                    s.colorDistancesMap[image.id] = md.d76;
                    return true;
                }
            }
        }
    }
    catch (err: any) {
        w.electronLog && w.electronLog.error(err.stack || err);
        return false;
    }

    return false;
}

/* grayColorFilter（bundle 32797-32813 逐字；零依赖） */
export function machineryGrayColorFilter(image: any): boolean {
    if (image && image.palettes) {
        for (var i = image.palettes.length - 1; i >= 0; i--) {
            var palette = image.palettes[i];
            if (palette.ratio >= 0.02) {
                var r = palette.color[0];
                var g = palette.color[1];
                var b = palette.color[2];
                if (Math.abs(r - g) >= 8 || Math.abs(r - b) >= 8 || Math.abs(g - b) >= 8) {
                    return false;
                }
            }
        }
        return true;
    }
    return false;
}

/* filterContent（bundle 32583-32589 逐字；$scope→s。b1-9p 补端口——重新计算画面图片
   列表的统一入口：keyword watcher / eagle.filter 规则 watcher / 显示隐藏切换都汇聚到它，
   本体只是「清 shuffle + rebindRefresh(contentFilterCache) + 滚动归零」的编排） */
export function machineryFilterContent(s: any, type?: any): void {
  machineryCalls.filterContent++;
  const w = window as any;
  // b1-9by-B：规则流汇聚点——eagle.filter 规则深变异经本函数收口后直推 filter 快照
  syncFilterFromScope();
  if (!s.isItemBindCalculated) return;
  // 重新计算画面图片列表
  s.shuffle = [];
  machineryRebindRefresh(s, undefined, s.contentFilterCache);
  scopeEvalAsync();
  setScrollTop("#box-container", 0);
  void type;
}

/* nextGifFrame/prevGifFrame（bundle 32838-32863 逐字：gifPlayer/gifViewer 经 scope 解析；
   **next 帧越界上界为 total-1、prev 下界 0——bundle 原样**） */
export function machineryNextGifFrame(s: any, amount: any = 1): void {
  if (s.gifPlayer && s.isGifReady) {
    s.gifPlayer.pause();
    s.gifViewer.playing = false;
    syncDetailFromScope();
    var curr = s.gifPlayer.get_current_frame();
    var total = s.gifViewer.frames.length;
    var idx = curr + amount;
    if (idx > total) idx = total - 1;
    s.gifPlayer.move_to(idx);
    scopeEvalAsync();
  }
}

export function machineryPrevGifFrame(s: any, amount: any = 1): void {
  if (s.gifPlayer && s.isGifReady) {
    s.gifPlayer.pause();
    s.gifViewer.playing = false;
    syncDetailFromScope();
    var curr = s.gifPlayer.get_current_frame();
    var idx = curr - amount;
    if (idx < 0) idx = 0;
    s.gifPlayer.move_to(idx);
    scopeEvalAsync();
  }
}

/* addVideoComment（bundle 21182-21237 逐字：swal textarea（i18n 经 window）→ guid（Tier-2）
   构造 comment（duration/annotation）→ current.comments 插入 + duration 升序排序 →
   REFRESH_VIDEO_COMMENTS 广播 + updateItemView（scope 解析）+ ipcRenderer 统一表达式
   send('image-change')） */
export function machineryAddVideoComment(s: any, video: any, videoElem: any): void {
  mediaAddVideoComment(s, video, videoElem);
}

/* newFileFromTemplate（bundle 37336-37374 逐字：resourcesPath/EAGLE_THUMBNAIL_TEMP_PATH 为
   bundle 顶层 var 经 window、fs/path 经 window.require、i18n/FileUrlHelper 经 window、
   uploadFiles/showUploadQueue 经 scope 解析、electronLog 兜底 catch） */
export function machineryNewFileFromTemplate(s: any, ext: any): void {
  const w = window as any;
  const fs = w.require('fs');
  const path = w.require('path');

  const templatePath = path.normalize(`${w.resourcesPath}/templates/Untitled.${ext}`);
  if (!fs.existsSync(templatePath)) return;

  const newFilePath = `${w.EAGLE_THUMBNAIL_TEMP_PATH}/Untitled.${ext}`;
  const filePath = newFilePath;
  try {
    const templateContent = fs.readFileSync(templatePath);
    fs.writeFileSync(newFilePath, templateContent);

    const file: any = {
      name: w.i18n.__("general.untitled.title"),
      path: filePath,
      lastModified: Date.now()
    };

    if (s.currentFolder && s.currentFolder.id) {
      file.folders = [s.currentFolder.id];
      if (s.currentFolder.extendTags) {
        file.tags = s.currentFolder.extendTags;
        file.tags = [...new Set(file.tags)];
      }
    }
    uploadFiles([file]);
    machineryShowUploadQueue(s);

    const ipc = w.__eagleIpc || (w.electron && w.electron.ipcRenderer);
    ipc.send('electron-info', `[app] Create file from [Untitled.${ext}]`);
  }
  catch (err: any) {
    w.electronLog && w.electronLog.error(err.stack || err);
  }
}

/* ── c18g-2：视图开启器族（random/unfiled/untagged/recent/community/allTags/trash）── */

// ── c18g-2 域内自管（原 controller 闭包 var：openRandomTimeout 36758 邻域 /
//    openUnfiledTimeout 36773 / openUntaggedTimeout 36804 / openRecentTimeout 36835 /
//    openTrashTimeout 36968）──
let openRandomTimeout: any = null;
let openUnfiledTimeout: any = null;
let openUntaggedTimeout: any = null;
let openRecentTimeout: any = null;
let openTrashTimeout: any = null;

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
export function machineryOpenUnfiled(s: any, ignoreHistory: any): void {
  const w = window as any;
  const $timeout = getTimeout();

  if (s.viewMode === 'unfiled' && s.allData.length > 0 && w.eagle.filter.filterRules.color.value == undefined) {
    if (s.isDetailMode) {
      machineryLeaveDetailMode(s);
    }
    return;
  }

  w.ScrollbarSaver.saveScrollPosition();
  s.viewMode = 'unfiled';
  s.$root.currentFocus = "sidebar";
  machineryResetPage(s);

  $timeout.cancel(openUnfiledTimeout);
  openUnfiledTimeout = $timeout(function () {
    if (!ignoreHistory) {
      w.UrlStateService.setState({ view: 'unfiled', folder: null, smartfolder: null, tag: null, color: null });
    }
    s.imageSize.height = w.localStorage.getItem("eagle.list.thumbSize.unfiled") || 150;
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
    machineryUpdateListHeight(s, s.imageSize.height);
    w.ScrollbarSaver.restoreScrollPosition();
    setScrollTop("#sidebar-item-container", 0);
    s.reload();
    w.analytics.screenView('Unfiled');
  }, 50);
}

/* openUntagged（bundle 36805-36833 逐字：同 openUnfiled 模板，untagged 键） */
export function machineryOpenUntagged(s: any, ignoreHistory: any): void {
  const w = window as any;
  const $timeout = getTimeout();

  if (s.viewMode === 'untagged' && s.allData.length > 0 && w.eagle.filter.filterRules.color.value == undefined) {
    if (s.isDetailMode) {
      machineryLeaveDetailMode(s);
    }
    return;
  }

  w.ScrollbarSaver.saveScrollPosition();
  s.viewMode = 'untagged';
  s.$root.currentFocus = "sidebar";
  machineryResetPage(s);

  $timeout.cancel(openUntaggedTimeout);
  openUntaggedTimeout = $timeout(function () {
    if (!ignoreHistory) {
      w.UrlStateService.setState({ view: 'untagged', folder: null, smartfolder: null, tag: null, color: null });
    }
    s.imageSize.height = w.localStorage.getItem("eagle.list.thumbSize.untagged") || 150;
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
    machineryUpdateListHeight(s, s.imageSize.height);
    w.ScrollbarSaver.restoreScrollPosition();
    setScrollTop("#sidebar-item-container", 0);
    s.reload();
    w.analytics.screenView('Untagged');
  }, 50);
}

/* openRecent（bundle 36836-36864 逐字：同 openUnfiled 模板，recent 键） */
export function machineryOpenRecent(s: any, ignoreHistory: any): void {
  const w = window as any;
  const $timeout = getTimeout();

  if (s.viewMode === 'recent' && s.allData.length > 0 && w.eagle.filter.filterRules.color.value == undefined) {
    if (s.isDetailMode) {
      machineryLeaveDetailMode(s);
    }
    return;
  }

  w.ScrollbarSaver.saveScrollPosition();
  s.viewMode = 'recent';
  s.$root.currentFocus = "sidebar";
  machineryResetPage(s);

  $timeout.cancel(openRecentTimeout);
  openRecentTimeout = $timeout(function () {
    if (!ignoreHistory) {
      w.UrlStateService.setState({ view: 'recent', folder: null, smartfolder: null, tag: null, color: null });
    }
    s.imageSize.height = w.localStorage.getItem("eagle.list.thumbSize.recent") || 150;
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
    machineryUpdateListHeight(s, s.imageSize.height);
    w.ScrollbarSaver.restoreScrollPosition();
    setScrollTop("#sidebar-item-container", 0);
    s.reload();
    w.analytics.screenView('Recent');
  }, 50);
}

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
export function machineryOpenAllTags(s: any, ignoreHistory: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  if (s.viewMode === 'alltags' && s.allData.length > 0 && w.eagle.filter.filterRules.color.value == undefined) return;

  w.ScrollbarSaver.saveScrollPosition();

  s.viewMode = 'alltags';
  s.$root.currentFocus = "sidebar";
  machineryResetPage(s);
  s.images = [];
  s.isDetailMode = false;
  s.selected = [];
  syncInspectorFromScope();
  if (!ignoreHistory) {
    w.UrlStateService.setState({ view: 'alltags', folder: null, smartfolder: null, tag: null, color: null });
  }

  machineryRebindRefresh(s);
  w.analytics.screenView('AllTags');
  $timeout(() => {
    s.TagManager.renderTagsResult();
  }, 50);
}

/* openTrash（bundle 36969-36996 逐字：早退 + ScrollbarSaver 存取 + trash thumbSize 键 +
   updateListHeight + screenView） */
export function machineryOpenTrash(s: any, ignoreHistory: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  if (s.viewMode === 'trash' && s.allData.length > 0 && w.eagle.filter.filterRules.color.value == undefined) {
    if (s.isDetailMode) {
      machineryLeaveDetailMode(s);
    }
    return;
  }
  w.ScrollbarSaver.saveScrollPosition();

  s.viewMode = 'trash';
  machineryResetPage(s);
  s.$root.currentFocus = "sidebar";

  hide("#image-drop-area");
  $timeout.cancel(openTrashTimeout);
  openTrashTimeout = $timeout(function () {
    if (!ignoreHistory) {
      w.UrlStateService.setState({ view: 'trash', folder: null, smartfolder: null, tag: null, color: null });
    }
    s.imageSize.height = w.localStorage.getItem("eagle.list.thumbSize.trash") || 150;
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
    machineryUpdateListHeight(s, s.imageSize.height);
    w.ScrollbarSaver.restoreScrollPosition();
    setScrollTop("#sidebar-item-container", 0);
    s.reload();
    w.analytics.screenView('Trash');
  }, 50);
}

/* ── b1-3：侧栏 prev/next 导航（folder/smartFolder 四向）──────────────── */

/* openNextFolder（bundle 35689-35701 逐字：sidebarList folder 过滤 → 当前索引 +1 →
   openFolder + changeSidebarIndex（machinery 版）） */
export function machineryOpenNextFolder(s: any): void {
  var nextFolder;
  var listItems = s.sidebarList;
  var folders = listItems.filter(function (item: any) {
    return item.vstype === 'folder';
  });
  var idx = folders.indexOf(s.currentFolder);
  nextFolder = folders[idx + 1];

  if (nextFolder) {
    openFolder(nextFolder);
    machineryChangeSidebarIndex(s, nextFolder);
  }
}

/* openPrevFolder（bundle 35806-35835 逐字：folder -1；越界回落 smartFolders 末项 →
   quickAccess 末项（#quick-access-{id} click）→ openTrash） */
export function machineryOpenPrevFolder(s: any): void {
  const w = window as any;

  var prevFolder;
  var listItems = s.sidebarList;
  var folders = listItems.filter(function (item: any) {
    return item.vstype === 'folder';
  });
  var idx = folders.indexOf(s.currentFolder);
  prevFolder = folders[idx - 1];

  if (prevFolder) {
    openFolder(prevFolder);
    machineryChangeSidebarIndex(s, prevFolder);
  }
  else {
    var quickAccessItems = listItems.filter(function (item: any) {
      return item.vstype === 'quickAccess';
    });
    var smartFolders = listItems.filter(function (item: any) {
      return item.vstype === 'smartFolder' || item.vstype === 'smartFolderGroup';
    });
    if (smartFolders.length > 0 && smartFolders[smartFolders.length - 1]) {
      openSmartFolder(smartFolders[smartFolders.length - 1]);
      machineryChangeSidebarIndex(s, smartFolders[smartFolders.length - 1]);
    }
    else if (quickAccessItems.length > 0 && quickAccessItems[quickAccessItems.length - 1]) {
      clickEl("#quick-access-" + quickAccessItems[quickAccessItems.length - 1].id);
    }
    else {
      machineryOpenTrash(s);
    }
  }
}

/* openNextSmartFolder（bundle 35755-35774 逐字：smartFolder(smartFolderGroup 含) 当前 +1 →
   越界回落 folders 首项） */
export function machineryOpenNextSmartFolder(s: any): void {
  var nextSmartFolder;
  var listItems = s.sidebarList;
  var smartFolders = listItems.filter(function (item: any) {
    return item.vstype === 'smartFolder' || item.vstype === 'smartFolderGroup';
  });
  var idx = smartFolders.indexOf(s.currentSmartFolder);
  nextSmartFolder = smartFolders[idx + 1];
  if (nextSmartFolder) {
    openSmartFolder(nextSmartFolder);
    machineryChangeSidebarIndex(s, nextSmartFolder);
  }
  else {
    var folders = listItems.filter(function (item: any) {
      return item.vstype === 'folder';
    });
    if (folders.length > 0) {
      openFolder(folders[0]);
      machineryChangeSidebarIndex(s, folders[0]);
    }
  }
}

/* openPrevSmartFolder（bundle 35775-35804 逐字：smartFolder -1 → 越界按
   preferences.sidebar.quickAccess 门控走 quickAccess 末项或 openTrash） */
export function machineryOpenPrevSmartFolder(s: any): void {
  const w = window as any;
  var prevSmartFolder;
  var listItems = s.sidebarList;
  var smartFolders = listItems.filter(function (item: any) {
    return item.vstype === 'smartFolder' || item.vstype === 'smartFolderGroup';
  });
  var idx = smartFolders.indexOf(s.currentSmartFolder);
  prevSmartFolder = smartFolders[idx - 1];
  if (prevSmartFolder) {
    openSmartFolder(prevSmartFolder);
    machineryChangeSidebarIndex(s, prevSmartFolder);
  } else {
    // 如果有 quick access 就进入 quick access 若无，进入 Trash
    if (s.$root.preferences.sidebar.quickAccess != 'false') {
      var quickAccessItems = listItems.filter(function (item: any) {
        return item.vstype === 'quickAccess';
      });
      if (quickAccessItems.length > 0) {
        clickEl("#quick-access-" + quickAccessItems[quickAccessItems.length - 1].id);
      }
      else {
        machineryOpenTrash(s);
      }
    }
    else {
      machineryOpenTrash(s);
    }
  }
}

/* ── b1-4a：滚动/列表辅助族（第一批）─────────────────────────────────── */

/* autoScroll（bundle 35086-35091 逐字：AutoScroll 广播 50ms 延迟；**注意 54389 系
   $bodyScope 委派壳属子 scope controller，body scope 生效版即本闭包**） */
export function machineryAutoScroll(s: any, index: any): void {
  const $timeout = getTimeout();
  $timeout(function () {
    autoscrollChannel.emit(index);
  }, 50);
}

/* currentIndex（bundle 28993-28997 逐字：selected[0] 在 allData 的位次 +1） */
export function machineryCurrentIndex(s: any): any {
  if (!s.allData) return undefined;
  return s.allData.indexOf(s.selected[0]) + 1;
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

/* getQuickAccessList（bundle 42634-42643 逐字：quickAccess 逐项 size=27 + vstype 标记） */
export function machineryGetQuickAccessList(s: any): any[] {
  var list: any[] = [];
  s.quickAccess.forEach(function (item: any) {
    item.size = 27;
    item.vstype = 'quickAccess';
    list.push(item);
  });
  return list;
}

// ── b1-4a 域内自管（原 controller 闭包 var：checkListItemsLessThanContainerTimeout 33661
//    邻域 / changeListHeightTimeout 33745 邻域）──
let checkListItemsLessThanContainerTimeout: any = null;
let changeListHeightTimeout: any = null;

/* checkListItemsLessThanContainer（bundle 33658-33674 逐字：<180 项时 500ms 后量
   box-list 高度不足一屏则 ig.trigger("append") 一次載入兩頁） */
export function machineryCheckListItemsLessThanContainer(s: any): void {
  const w = window as any;
  if (!w.ig) return;
  if (w.ig.getItems().length < 180) {
    clearTimeout(checkListItemsLessThanContainerTimeout);
    checkListItemsLessThanContainerTimeout = setTimeout(function () {
      console.log("checkListItemsLessThanContainer");
      // 如果列表尺寸很小，一次載入兩頁
      var boxList = q("#box-container .box-list") as HTMLElement | null;
      if (boxList && boxList.style) {
        var boxListHeight = parseInt(boxList.style.height);
        if (boxListHeight < heightOf(q("#box-container"))) {
          w.ig.trigger("append");
        }
      }
    }, 500);
  }
}

/* updateSubFolderWidth（bundle 33676-33688 逐字：容器宽 → 列数 → 38+10col 修正 →
   5 取整 → 下限 90 → MAX_LIST_WIDTH 封顶 → imageSize.subfolderWidth） */
export function machineryUpdateSubFolderWidth(s: any): void {
  const w = window as any;
  const boxContainer = q("#box-container");
  if (!boxContainer) return;
  var containerWidth = boxContainer.clientWidth;
  var column = parseInt(containerWidth / s.imageSize.height as any);
  if (!column) column = 1;
  var result = parseInt((containerWidth - 38 - (column * 10)) / column as any);
  result = parseInt(result / 5 as any) * 5;
  if (result < 90) result = 90;
  if (result >= s.MAX_LIST_WIDTH) {
    result = s.MAX_LIST_WIDTH;
  }
  s.imageSize.subfolderWidth = result;
}

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

/* changeListHeight（bundle 33746-33785 逐字：5 取整 + lastImageHeight 留档 + 500ms 后
   thumbSize 键持久化（currentFolder/smartFolder/tag/viewMode 九分支键逐字）+ 即时
   box-size 属性 + relayout + scrollToCurrentItem（machinery 版）） */
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

/* scrollToCurrentItem（bundle 34118-34130 逐字：selected 末盒 posy 属性 → 容器居中定位） */
export function machineryScrollToCurrentItem(s: any): void {
  const w = window as any;
  if (s.selected.length > 0) {
    var $lastItem = qa(".box.selected").slice(-1)[0] as HTMLElement | undefined;
    if ($lastItem) {
      let y = $lastItem.getAttribute("posy");
      if (y != null) {
        let offsetTop = heightOf(q("#box-container")) / 2 - heightOf($lastItem) / 2;
        setScrollTop("#box-container", parseInt(y as any) - offsetTop);
      }
    }
  }
}

/* forceFitImageSize（bundle 36481-36497 逐字：详情模式限定 + detail-image 尺寸直设 +
   usingThumbnail 分支（animated/orientation → getRawUrl，否则 thumbnail URL）） */
export function machineryForceFitImageSize(s: any, image: any, usingThumbnail: any): void {
  const w = window as any;
  if (!image) return;
  if (!s.isDetailMode) return;
  if (qa("#detail-image").length === 0) return;
  cssSet("#detail-image", {
    width: image.width,
    height: image.height,
    transition: 'none'
  });
  if (usingThumbnail) {
    if (image.animated || (image.orientation && image.orientation !== 1)) {
      setAttr("img#detail-image", "src", callExternal('getRawUrl', image));
    }
    else {
      setAttr("img#detail-image", "src", w.FileUrlHelper.getThumbnailUrl(image));
    }
  }
}

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
export function machinerySortData(s: any, data: any, orderBy: any): any {
  const w = window as any;
  let clone = data.slice();
  console.time("sortRawData");
  switch (orderBy) {
    case 'NAME':
      // 使用 collator 会比直接呼叫 localeCompare 快上 20x 以上
      var collator = new Intl.Collator(w.languageBCP, { numeric: true, sensitivity: 'base' });
      clone.sort(function (a: any, b: any) {
        return collator.compare(a.name, b.name);
      });
      break;
    case 'EXT':
      var collator2 = new Intl.Collator(w.languageBCP, { numeric: true, sensitivity: 'base' });
      clone.sort(function (a: any, b: any) {
        return collator2.compare(a.ext, b.ext);
      });
      break;
    case 'RESOLUTION':
      clone.sort(function (a: any, b: any) {
        var ra = a.width * a.height;
        var rb = b.width * b.height;
        if (ra > rb) return 1;
        if (ra < rb) return -1;
        return 0;
      });
      break;
    case 'FILESIZE':
      clone.sort(function (a: any, b: any) {
        var sizeA = parseInt(a.size);
        var sizeB = parseInt(b.size);
        if (sizeA > sizeB) return 1;
        if (sizeA < sizeB) return -1;
        return 0;
      });
      break;
    case 'RATING':
      clone.sort(function (a: any, b: any) {
        var starA = parseInt(a.star) || 0;
        var starB = parseInt(b.star) || 0;
        if (starA > starB) return 1;
        if (starA < starB) return -1;
        return 0;
      });
      break;
    case 'DURATION':
      clone.sort(function (a: any, b: any) {
        var durationA = parseInt(a.duration) || 0;
        var durationB = parseInt(b.duration) || 0;
        if (durationA > durationB) return 1;
        if (durationA < durationB) return -1;
        return 0;
      });
      break;
    case 'MANUAL':
      console.time("MANUAL");
      // Note: 使用 mapping 先记录 order 数据，在 sort 函式就不需要使用 _.get 来获取，这样能提升 20x 性能
      var orderMappings: any = {};
      var folderId = s.currentFolder.id;
      for (var i = 0; i < data.length; i++) {
        var item = data[i];
        if (item.order && item.order[folderId]) { orderMappings[item.id] = item.order[folderId] }
        else { orderMappings[item.id] = item.modificationTime + ''; }
      }

      clone.sort(function (a: any, b: any) {
        var aTime = orderMappings[a.id];
        var bTime = orderMappings[b.id];
        if (aTime > bTime) return -1;
        else if (aTime < bTime) return 1;
        else { return 0; }
      });

      console.timeEnd("MANUAL");
      break;
    case 'BTIME':
      clone.sort(function (a: any, b: any) {
        var btimeA = a.btime || a.modificationTime;
        var btimeB = b.btime || b.modificationTime;
        if (btimeA > btimeB) return -1;
        if (btimeA < btimeB) return 1;
      });
      break;
    case 'MTIME':
      clone.sort(function (a: any, b: any) {
        var mtimeA = a.mtime || a.modificationTime;
        var mtimeB = b.mtime || b.modificationTime;
        if (mtimeA > mtimeB) return -1;
        if (mtimeA < mtimeB) return 1;
      });
      break;
    case 'RANDOM':
      clone.shuffle();
      break;
    case 'TAGS':
      // 使用 collator 会比直接呼叫 localeCompare 快上 20x 以上
      var collator3 = new Intl.Collator(w.languageBCP, { numeric: true, sensitivity: 'base' });
      clone.sort(function (a: any, b: any) {
        const aTag1 = a?.tags?.[0] ?? '';
        const bTag1 = b?.tags?.[0] ?? '';
        return collator3.compare(aTag1, bTag1);
      });
      break;
    default:
      clone.sort(function (a: any, b: any) {
        if (a.modificationTime > b.modificationTime) return -1;
        else if (a.modificationTime < b.modificationTime) return 1;
        return 0;
      });
  }
  console.timeEnd("sortRawData");
  return clone;
}

/* offsetScrollbarImm（bundle 34140-34166 逐字：delay||1 后 selected 末盒居中 scrollTo；
   无选中时防越界（末盒 transform Y 与 scrollTop 比较）+ updateContainerHieght（machinery
   版经 scope）） */
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

/* offsetScrollbar（bundle 34168-34170 逐字）——_.debounce(100, leading) 实例 apply 时
   一次性创建（与 bundle controller init 同语义） */
export function machineryOffsetScrollbar(s: any): any {
  const w = window as any;
  return debounce(function offsetScrollbar(delay: any, forceScroll: any) {
    machineryOffsetScrollbarImm(s, delay, forceScroll);
  }, 100, true);
}

/* updateFilterCounts（bundle 42946-43040 逐字：type/camera（filterCamerasMapping 联动）/
   fontActivated（installedFonts 键）/star（0 归档）/shape（横竖比 2.5 与 4:3、3:4、16:9、
   9:16 五档）——AUDIO_TYPES/FONT_TYPES/installedFonts 经 window，全程 try 静默） */
export function machineryUpdateFilterCounts(s: any, image: any, inc: any, now: any): void {
  const w = window as any;

  if (!image) return;

  try {

    var type = image.medium || image.ext;
    var shape;

    if (w.eagle.filter.filterCounts['type'][type] === undefined) {
      w.eagle.filter.filterCounts['type'][type] = 1;
    }
    else {
      w.eagle.filter.filterCounts['type'][type] += inc;
    }

    if (image.rawMetas) {

      var camera = image.rawMetas.camera;
      if (w.eagle.filter.filterCounts['camera'][camera] === undefined) {
        w.eagle.filter.filterCounts['camera'][camera] = 1;
        if (!w.eagle.filter.filterCamerasMapping[camera]) {
          w.eagle.filter.filterCamerasMapping[camera] = true;
          w.eagle.filter.filterCameras = Object.keys(w.eagle.filter.filterCamerasMapping);
          syncFilterFromScope();
        }
      }
      else {
        w.eagle.filter.filterCounts['camera'][camera] += inc;
      }
    }

    if (image.fontMetas) {
      try {
        var key = Object.keys(image.fontMetas.postScriptName)[0];
        var postScriptName = image.fontMetas.postScriptName && image.fontMetas.postScriptName[key];
        if (w.installedFonts[`${postScriptName}_.${image.ext}`]) {
          w.eagle.filter.filterCounts['fontActivated']['activated'] += inc;
        }
        else {
          w.eagle.filter.filterCounts['fontActivated']['deactivated'] += inc;
        }
      }
      catch (err) {

      }
    }

    if (image.star) {
      w.eagle.filter.filterCounts['rating'][image.star] += inc;
    }
    else {
      w.eagle.filter.filterCounts['rating']['0'] += inc;
    }

    // 形状筛选，只需要针对图片格式进行
    if (image.width && !w.AUDIO_TYPES[image.ext] && !w.FONT_TYPES[image.ext]) {
      if (image.width > image.height) {
        if (image.width / image.height >= 2.5) {
          shape = "panoramic-landscape";
        }
        else {
          shape = "landscape";
        }
        w.eagle.filter.filterCounts['shape'][shape] += inc;
      }
      else if (image.width < image.height) {
        if (image.height / image.width >= 2.5) {
          shape = "panoramic-portrait";
        }
        else {
          shape = "portrait";
        }
        w.eagle.filter.filterCounts['shape'][shape] += inc;
      }
      else if (image.width === image.height) {
        shape = "square";
        w.eagle.filter.filterCounts['shape'][shape] += inc;
      }
      if (image.width / image.height === 4 / 3) {
        shape = "4:3";
        w.eagle.filter.filterCounts['shape'][shape] += inc;
      }
      else if (image.width / image.height === 3 / 4) {
        shape = "3:4";
        w.eagle.filter.filterCounts['shape'][shape] += inc;
      }
      else if (image.width / image.height === 16 / 9) {
        shape = "16:9";
        w.eagle.filter.filterCounts['shape'][shape] += inc;
      }
      else if (image.width / image.height === 9 / 16) {
        shape = "9:16";
        w.eagle.filter.filterCounts['shape'][shape] += inc;
      }
    }

  }
  catch (err) {
  }
}

/* ── b1-5：记忆/预载族（rememberScrollTops/rememberVideoCurrentTime/addToRecentFile/
   preloadImage + getVideoPlayer 域内闭包）──────────────────────────────── */

/* getVideoPlayer（bundle 36159-36164 逐字，controller 闭包：mpv 优先 native 次之） */
export function machineryGetVideoPlayer(s: any): any {
  return mediaGetVideoPlayer(s);
}

/* rememberScrollTops（bundle 31142-31150 逐字：inline/edge 模式跳过 + smoothZoom
   getChangedData 快照入 lastItemStates） */
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

/* rememberVideoCurrentTime（bundle 31726-31736 逐字：视频类 → getVideoPlayer().el.currentTime
   → eagle.videoPlayer.currentTime.{id} 键） */
export function machineryRememberVideoCurrentTime(s: any, item: any): void {
  mediaRememberVideoCurrentTime(s, item);
}

/* addToRecentFile（bundle 36435-36443 逐字：1s 后 current 换人则不记（已換人 console）→
   RecentFileManager.addFile（c14c 版经 window if-absent）） */
export function machineryAddToRecentFile(s: any, item: any): void {
  const w = window as any;
  // 記錄在最近使用
  setTimeout(function () {
    if (s.current !== item) {
      console.log("已換人，無須記錄")
    }
    else {
      console.log(`添加 ${item.id} 至最近使用`)
      w.RecentFileManager.addFile(item);
    }
  }, 1000);
}

// ── b1-5 域内自管（原 controller 闭包 var：preloadImageTimeout 36447 邻域）──
let preloadImageTimeout: any = null;

/* preloadImage（bundle 36449-36481 逐字：supportFoamts **typo 逐字保留** + currentIndex()
   + next 为 idx / prev 为 idx-2 + smoothZoom('preload') 100ms 防抖） */
export function machineryPreloadImage(s: any, mode: any): void {
  const w = window as any;
  const supportFoamts: any = {
    "jpg": true,
    "jpeg": true,
    "png": true,
    "webp": true,
    "avif": true,
    "insp": true,
    "jfif": true,
    "jpe": true,
    "jxl": true,
    "bmp": true,
  };
  clearTimeout(preloadImageTimeout);
  preloadImageTimeout = setTimeout(function () {
    const idx = machineryCurrentIndex(s);
    const nextImage = s.allData[idx];
    const preImage = s.allData[idx - 2];
    if (mode === "next") {
      if (nextImage && supportFoamts[nextImage?.ext]) {
        detailZoom()?.preload( nextImage);
      }
    }
    else {
      if (preImage && supportFoamts[preImage?.ext]) {
        detailZoom()?.preload( preImage);
      }
    }
  }, 100);
}

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
export function machineryCheckOperationSafety(s: any, callback: any, amount: any = 100): void {
  const w = window as any;
  try {
    if (s.selected && s.selected.length >= amount) {
      var html = getFilter()('i18n')("Dialog.BulkAction.Descript", [
        { "property": "count", "value": s.selected.length },
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
        scopeEvalAsync();
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
export function machineryCheckOperationSafety2(s: any, count: any, callback: any, amount: any = 100): void {
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
        scopeEvalAsync();
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

/* resetFolderCover（bundle 41454-41461 逐字：getAncestorFolders（c9b machinery 版）+
   covers 清空） */
export function machineryResetFolderCover(s: any, folder: any): void {
  if (!folder) return;
  var ancestors = machineryGetAncestorFolders(s, folder, [folder]);
  ancestors.push(folder);
  ancestors.forEach(function (f: any) {
    f.covers = [];
  });
}

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
export function machineryRemoveSmartFolder(s: any, smartFolder: any, _p: any = {}): void {
  const w = window as any;
  setTimeout(function () {
    var removeConfirmMsg = getFilter()('i18n')("dialog.removeSmartFolder.desc", [
      { "property": "folder", "value": smartFolder.name },
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
    }).then(function () {
      machineryRemoveSmartFolderInner(s, smartFolder, {});
    });
  }, 100);
}

function machineryRemoveSmartFolderInner(s: any, smartFolder: any, { ignoreSelectNext, ignoreRestore }: any = {}): void {
  const w = window as any;
  const $timeout = getTimeout();

  var message = getFilter()('i18n')("notify.folder.remove", [
    { "property": "folder", "value": smartFolder.name },
  ]);

  var children = s.smartFolders;
  if (smartFolder.parent && s.smartFolderMappings[smartFolder.parent]) {
    let parent = s.smartFolderMappings[smartFolder.parent];
    children = parent.children;
  }
  var origin = structuredClone(children);
  var idx = children.indexOf(smartFolder);

  if (idx === -1) return;

  children.splice(idx, 1);
  delete s.smartFolderMappings[smartFolder.id];
  w.QuickAccessManager.remove("smartFolder", smartFolder);

  // 如果已經沒有資料夾
  if (idx === 0) {
    if (children[idx]) {
      openSmartFolder(children[idx]);
    } else {
      s.currentSmartFolder = undefined;
      syncPanelFromScope();
      syncListFromScope();
      machineryOpenAll(s);
    }
  }
  // 如果還有資料夾
  else {
    if (children[idx]) {
      openSmartFolder(children[idx]);
    } else {
      if (children[idx - 1]) {
        openSmartFolder(children[idx - 1]);
      } else {
        s.currentSmartFolder = undefined;
        syncPanelFromScope();
        syncListFromScope();
        machineryOpenAll(s);
      }
    }
  }

  // 如果声音效果是开启的
  if (s.$root.preferences.notification.soundEffect.enable != 'false' && s.$root.preferences.notification.soundEffect.when.deleteFolder == 'true') {
    s.removeSound && s.removeSound.play && s.removeSound.play();
  }
  machineryUpdateSidebarList(s);

  $timeout(function () {
    s.saveFolderDebounce && machinerySaveFolderDebounce(s);
  }, 1000);

  w.electronLog && w.electronLog.info(`[app] Remove smart-folder: ${smartFolder.name}(${smartFolder.id})`);

  if (!ignoreRestore) {
    (s.$root.notify || s.notify).call(s.$root, {
      message: message,
      duration: 5000,
    }, function () {
      if (smartFolder.parent && s.smartFolderMappings[smartFolder.parent]) {
        let parent = s.smartFolderMappings[smartFolder.parent];
        parent.children = origin;
      }
      else {
        s.smartFolders = origin;
      }
      s.smartFolderMappings[smartFolder.id] = smartFolder;
      w.eagle.utils.tree.walk(s.smartFolders, 'children', function (sf: any, parent: any, depth: any) {
        s.smartFolderMappings[sf.id] = sf;
      });
      machineryUpdateSidebarList(s);
      openSmartFolder(smartFolder);
      s.saveFolderDebounce && machinerySaveFolderDebounce(s);
      scopeEvalAsync();
    });
  }
}

/* removeFolder wrapper（bundle 41935-41980 逐字：密码锁守卫 + 有图/有子夹时 100ms 后
   checkbox 确认框（isDeleteImages=result==1）+ checkOperationSafety2(50)） */
export function machineryRemoveFolder(s: any, folder: any, params: any = {}): void {
  const w = window as any;
  const _p: any = { isDeleteImages: params.isDeleteImages, ignoreSelectNext: params.ignoreSelectNext, ignoreRestore: params.ignoreRestore };

  if (folder.password && !folder.isUnLock) return;

  // 如果圖片或子文件夾超過數量，就需要顯示詢問視窗
  if (folder.images && folder.imageCount > 0 || folder && folder.children.length > 0) {
    setTimeout(function () {
      var removeConfirmMsg = getFilter()('i18n')("dialog.removeFolder.desc", [
        { "property": "folder", "value": folder.name },
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
        machineryCheckOperationSafety2(s, folder.descendantImageCount, function () {
          _p.isDeleteImages = (result == 1);
          machineryRemoveFolderInner(s, folder, _p);
          scopeEvalAsync();
        }, 50);
      }, function () { });
    }, 100);
  }
  else {
    machineryRemoveFolderInner(s, folder, _p);
  }
}

function machineryRemoveFolderInner(s: any, folder: any, { isDeleteImages, ignoreSelectNext, ignoreRestore }: any = {}): void {
  const w = window as any;

  // 支持復原文件夾
  var originalFolders: any[] = [];
  var originalImages: any[] = [];
  var originalImageFolders: any[] = [];
  var folderId = folder.id;
  if (!ignoreRestore) {
    w.cloneTree(originalFolders, s.folders, true);
  }

  // 找到包含 folder 的 list
  var parent = s.folderMappings[folder.parent];
  var children = (parent) ? parent.children : s.folders;
  if (!Array.isArray(children)) return;

  var index = children.indexOf(folder);
  if (index === -1) return;

  // 移除 folder
  children.splice(index, 1);

  // 删除包含 folder.id 的图片
  if (s.raw && s.raw.length > 0) {
    var changed: any[] = [];
    for (var rindex = s.raw.length - 1; rindex >= 0; rindex--) {
      var image = s.raw[rindex];
      if (image.folders) {
        var idx = image.folders.indexOf(folder.id);
        if (idx > -1) {
          if (isDeleteImages) {
            // 如果圖片還存在於其它文件夾，就不丟到垃圾桶
            if (image.folders && image.folders.length === 1) {
              image.isDeleted = true;
            }
          }
          originalImageFolders.push(structuredClone(image.folders));
          image.folders.splice(idx, 1);
          changed.push(image);
          originalImages.push(image);
        }
      }
    }
    w.ayncsImagesChange(changed);
    w.hiddenByCurrentFilter(changed);
  }

  // 同时删除子文件夹图片
  if (folder.children) {
    w.eagle.utils.tree.walk(folder.children, 'children', function (child: any, parent: any) {
      if (s.raw && s.raw.length > 0) {
        var changed: any[] = [];
        for (var rindex = s.raw.length - 1; rindex >= 0; rindex--) {
          var image = s.raw[rindex];
          if (image.folders) {
            var idx = image.folders.indexOf(child.id);
            if (idx > -1) {
              if (isDeleteImages) {
                // 如果圖片還存在於其它文件夾，就不丟到垃圾桶
                if (image.folders && image.folders.length === 1) {
                  image.isDeleted = true;
                }
              }
              originalImageFolders.push(structuredClone(image.folders));
              image.folders.splice(idx, 1);
              changed.push(image);
              originalImages.push(image);
            }
          }
        }
        w.ayncsImagesChange(changed);
        w.hiddenByCurrentFilter(changed);
      }
    });
  }

  // 开启下一个文件夹
  // 优先开启兄弟，若兄弟皆亡，找老爸，老爸亡，找 All
  if (!ignoreSelectNext) {
    if (children.length > 0) {
      var next = children[index] || children[index - 1] || children[0];
      openFolder(next);
    } else if (parent) {
      openFolder(parent);
    } else {
      machineryOpenAll(s);
    }
  }
  else {
    machineryRebindRefresh(s);
  }

  // 播放删除音效
  if (s.$root.preferences.notification.soundEffect.enable != 'false' && s.$root.preferences.notification.soundEffect.when.deleteFolder == 'true') {
    s.removeSound && s.removeSound.play && s.removeSound.play();
  }

  w.QuickAccessManager.remove("folder", folder);
  if (folder.children && s.quickAccess.length > 0) {
    w.eagle.utils.tree.walk(folder.children, 'children', function (child: any, parent: any) {
      w.QuickAccessManager.remove("folder", child);
    });
  }
  machineryUpdateSidebarList(s);

  // 移除记录
  delete s.folderMappings[folder.id];
  machineryCalculateImageBinding(s, { ignoreSort: true }, function () {
    scopeEvalAsync();
    s.saveFolderDebounce && machinerySaveFolderDebounce(s);
    if (isDeleteImages) { w.electronLog && w.electronLog.info(`[app] Delete folder: ${folder.name}(${folder.id}), contains ${originalImages.length} files, all remain ${s.all.length} files, trash remain: ${s.trash.length} files`); }
    else { w.electronLog && w.electronLog.info(`[app] Delete folder: ${folder.name}(${folder.id}), just remove folder not contains ${originalImages.length} files, all remain ${s.all.length} files, trash remain: ${s.trash.length} files`); }
  });

  if (!ignoreRestore) {
    var message = getFilter()('i18n')("notify.folder.remove", [
      { "property": "folder", "value": folder.name },
    ]);
    (s.$root.notify || s.notify).call(s.$root, {
      message: message,
      duration: 7000,
    }, function () {
      s.folders = originalFolders;

      w.eagle.utils.tree.walk(s.folders, 'children', function (folder2: any, parent: any) {
        if (!folder2.children) { folder2.children = []; }
        if (folder2 && parent) { folder2.parent = parent.id; }
        s.folderMappings[folder2.id] = folder2;
      });

      for (var i = originalImages.length - 1; i >= 0; i--) {
        var img = originalImages[i];
        if (!img) continue;
        img.folders = originalImageFolders[i];
        img.folders = [...new Set(img.folders)];
        delete img.isDeleted;
      }

      machineryCalculateImageBinding(s, { ignoreSort: true }, function () {
        openFolder(s.folderMappings[folder.id]);
        w.electronLog && w.electronLog.info(`[app] Resotre deleted folder: ${folder.name}(${folder.id}), contains ${originalImages.length} files, all remain ${s.all.length} files, trash remain ${s.trash.length} files`);
      });

      scopeEvalAsync();
      machineryUpdateSidebarList(s);
      s.saveFolderDebounce && machinerySaveFolderDebounce(s);
      w.ayncsImagesChange(originalImages);
    });
  }
}

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
export function machineryRemoveFolderContents(s: any, params: any): void {
  const w = window as any;
  const $timeout = getTimeout();

  var origin: any[] = [];
  var originFolders: any[] = [];
  var isForceToTrash = params.isForceToTrash;
  let now = Date.now();
  s.selected.forEach(function (image: any) {
    origin.push(image);
    originFolders.push(structuredClone(image.folders));
    s.currentFolder.imagesMappings[image.id] = false;
    if (s.currentFolder.parent) {
      if (s.folderMappings[s.currentFolder.parent].imagesMappings) {
        s.folderMappings[s.currentFolder.parent].imagesMappings[image.id] = false;
      }
    }

    // 遍歷所有子資料夾，移除子資料夾也出現這張圖的索引
    if (s.currentFolder.children) {
      s.currentFolder.children.forEach(function (child: any) {
        child.imagesMappings[image.id] = false;
      });
    }

    // 如果图片包含多个文件夹
    if (!isForceToTrash && image.folders && image.folders.length > 1) {
      var idx = image.folders.indexOf(s.currentFolder.id);
      if (idx > -1) {
        image.folders.splice(idx, 1);
      }
    }
    else {
      image.isDeleted = true;
      image.deletedTime = now;
    }
    machineryUpdateFilterCounts(s, image, -1, now);
  });

  machineryAutoScroll(s, undefined);

  if (s.$root.preferences.notification.soundEffect.enable != 'false' && s.$root.preferences.notification.soundEffect.when.deleteImage == 'true') {
    s.removeSound && s.removeSound.play && s.removeSound.play();
  }

  var message = getFilter()('i18n')("notify.image.remove", [
    { "property": "count", "value": s.selected.length },
  ]);
  if (s.selected.length === 1) { message = message.replace("images", "image"); }

  (s.$root.notify || s.notify).call(s.$root, {
    message: message,
    duration: 4000,
  }, function () {
    let now = Date.now();
    origin.forEach(function (image: any, index: any) {
      image.isDeleted = false;
      image.folders = originFolders[index];
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
      machineryRebindRefresh(s);
      w.ScrollbarSaver.restoreScrollPosition();
    });
    machineryZoom(s);
    w.ayncsImagesChange(origin);
  });

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
    machineryLeaveDetailMode(s);
  }
  $timeout(function () {
    machineryForceFitImageSize(s, s.current, undefined);
    machineryZoom(s);
  }, 100);
  w.ScrollbarSaver.saveScrollPosition();

  var itemElements = machineryGetSelectedItemElements(s);
  glRemoveitemsChannel.emit(itemElements);

  machineryAutoScroll(s, undefined);

  machineryCalculateImageBinding(s, { ignoreSort: true }, function () {
    if (s.currentFolder && s.currentFolder.orderBy === "RANDOM") { }
    else {
      machineryRebindRefresh(s, true);
    }
    machineryUpdateSelection(s);
    if (s.currentFolder) { w.electronLog && w.electronLog.info(`[app] Remove ${itemElements.length} files from ${s.currentFolder.name}(${s.currentFolder.id}), folder remain ${s.currentFolder.imageCount} files, all remain ${s.all.length} files, trash remain ${s.trash.length} files`); }
    else { w.electronLog && w.electronLog.info(`[app] Remove ${itemElements.length} files, all remain ${s.all.length} files, trash remain ${s.trash.length} files`); }
  });
}

/* ── b1-7a：小件批（注释模式/详情淡出/插件面板/存库防抖/标签群组四向/删群组）── */

/* toggleCommentMode（bundle 21166-21169 逐字） */
export function machineryToggleCommentMode(s: any, event: any): void {
  event.preventDefault();
  s.isCommentMode = !s.isCommentMode;
  syncDetailFromScope();
}

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
export function machinerySaveFolderDebounce(s: any): void {
  const w = window as any;
  s.isLibrarySaving = true;
  clearTimeout(s.saveFolderDebounceTimeout);
  s.saveFolderDebounceTimeout = setTimeout(() => {
    machinerySaveFolder(s);
    s.isLibrarySaving = false;
  }, 1000);
}

// ── b1-7a 域内自管（原 controller 闭包 var：tagRectSelecting，标签框选态）──
let tagRectSelecting: any = false;

/* 标签群组四向（bundle 48363-48416 逐字：ALL/UNFILED/STARRED 三向同构（同视图早退 +
   tagRectSelecting 复位 + keyword 清空 + tagViewMode(Name) + 焦点 tags + 清 currentTagGroup/
   selectedTags + TagManager.renderTagsResult）+ GROUP 向（blur 焦点输入 + currentTagGroup ===
   group 早退在清空之后——bundle 原样）） */
export function machineryOpenTagAllGroup(s: any): void {
  if (s.tagViewMode === "ALL") return;
  tagRectSelecting = false;
  s.keyword = "";
  s.tagViewMode = "ALL";
  syncTagManagerFromScope();
  s.tagViewModeName = "ALL";
  syncTagManagerFromScope();
  s.$root.currentFocus = 'tags';
  s.currentTagGroup = undefined;
  syncTagManagerFromScope();
  s.selectedTags = {};
  syncTagManagerFromScope();
  s.TagManager.renderTagsResult();
}

export function machineryOpenUnfiledGroup(s: any): void {
  if (s.tagViewMode === "UNFILED") return;
  tagRectSelecting = false;
  s.keyword = "";
  s.tagViewMode = "UNFILED";
  syncTagManagerFromScope();
  s.tagViewModeName = "UNFILED";
  syncTagManagerFromScope();
  s.$root.currentFocus = 'tags';
  s.currentTagGroup = undefined;
  syncTagManagerFromScope();
  s.selectedTags = {};
  syncTagManagerFromScope();
  s.TagManager.renderTagsResult();
}

export function machineryOpenStarredGroup(s: any): void {
  if (s.tagViewMode === "STARRED") return;
  tagRectSelecting = false;
  s.keyword = "";
  s.tagViewMode = "STARRED";
  syncTagManagerFromScope();
  s.tagViewModeName = "STARRED";
  syncTagManagerFromScope();
  s.$root.currentFocus = 'tags';
  s.currentTagGroup = undefined;
  syncTagManagerFromScope();
  s.selectedTags = {};
  syncTagManagerFromScope();
  s.TagManager.renderTagsResult();
}

export function machineryOpenTagGroup(s: any, group: any): void {
  const w = window as any;
  tagRectSelecting = false;
  s.keyword = "";
  s.tagViewMode = "GROUP";
  syncTagManagerFromScope();
  s.tagViewModeName = `GROUP-${group.id}`;
  syncTagManagerFromScope();
  s.$root.currentFocus = 'tags';
  s.currentTagGroup = group;
  syncTagManagerFromScope();
  s.TagManager.renderTagsResult();
  blurEl("input:focus");
  if (s.currentTagGroup === group) return;
  s.selectedTags = {};
  syncTagManagerFromScope();
}

/* removeTagGroup（bundle 48620-48661 逐字：有标签确认框 → remove 内嵌闭包（TagManager
   removeGroup + 兄弟/前项续开，皆亡 openTagAllGroup）） */
export function machineryRemoveTagGroup(s: any, group: any): void {
  const w = window as any;

  const remove = function (group: any) {
    var idx = s.TagManager.removeGroup(group.id);
    if (s.TagManager.groups[idx]) {
      s.currentTagGroup = s.TagManager.groups[idx];
      syncTagManagerFromScope();
    }
    else if (s.TagManager.groups[idx - 1]) {
      s.currentTagGroup = s.TagManager.groups[idx - 1];
      syncTagManagerFromScope();
    }
    else {
      machineryOpenTagAllGroup(s);
    }
  };

  if (group.tags.length > 0) {
    w.swal({
      html: `
                        <div class="alert">
                            <div class="alert-icon warning"></div>
                            <h4 class="alert-title">${w.i18n.__("dialog.removeTagGroup.title")}</h4>
                            <p class="alert-desc">${w.i18n.__("dialog.removeTagGroup.desc")}</p>
                        </div>
                    `,
      showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
      width: 400,
      customClass: "alert-box",
      cancelButtonColor: "#777777",
      confirmButtonText: w.i18n.__('dialog.removeTagGroup.button'),
      cancelButtonText: w.i18n.__("general.cancel"),
    }).then(function () {
      remove(group);
      scopeEvalAsync();
    });
  }
  else {
    remove(group);
    scopeEvalAsync();
  }
}

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

/* rgbToHex（bundle 28976-28981 逐字） */
export function machineryRgbToHex(s: any, r: any, g: any, b: any): any {
  if (r === undefined) {
    return false;
  }
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

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
export function machineryPausePalette(s: any): void {
  const w = window as any;
  s.paletteQueuePaused = true;
  syncSidebarFromScope();
  removeClass("#background-state-spinner .sm-spiner", "has-animation");
  w.IPCHelper.send('change-palette-pause');
}

export function machineryResumePalette(s: any): void {
  const w = window as any;
  s.paletteQueuePaused = false;
  syncSidebarFromScope();
  addClass("#background-state-spinner .sm-spiner", "has-animation");
  w.IPCHelper.send('change-palette-resume');
}

/* saveLayout（bundle 37280-37286 逐字：localStorage bracket 赋值原样） */
export function machinerySaveLayout(s: any, folder: any, layout: any): void {
  const w = window as any;
  if (folder) {
    w.localStorage[`eagle.list.layout.${folder.id}`] = layout;
  }
  else {
    w.localStorage[`eagle.list.layout.${s.rootDir}`] = layout;
  }
}

/* cancelCrop（bundle 36091-36093 逐字） */
export function machineryCancelCrop(s: any): void {
  s.isCropMode = false;
  syncDetailFromScope();
}

/* openFilter（bundle 30173-30178 逐字）+ FILTER_ID_MAP（30204 前注释映射表逐字）+
   toggleFilterByType（30204-30216 逐字：_.throttle(300) 实例 apply 时一次性创建 +
   eagle.aiSearch 守卫） */
const FILTER_ID_MAP: any = {
  'tag': 'tags-filter-item',
  'folder': 'folders-filter-item',
  'color': 'color-filter-item',
  'rating': 'rating-filter-item',
  'shape': 'shape-filter-item',
  'date': 'import-filter-item',  // date 實際對應 import
  'type': 'types-filter-item',
  'image': 'image-filter-item',
  'size': 'size-filter-item',
  'resolution': 'resolution-filter-item',
  'duration': 'duration-filter-item',
  'annotation': 'annotation-filter-item',
  'note': 'note-filter-item',
  'url': 'url-filter-item',
  'semantic': 'semantic-filter-item',
  'bpm': 'bpm-filter-item',
  'camera': 'camera-filter-item',
  'fonts': 'fontActivated-filter-item',  // fonts 對應 fontActivated
  'import': 'mtime-filter-item'  // import 對應 mtime (修改時間)
};

export function machineryOpenFilter(s: any): void {
  const w = window as any;
  if (!w.eagle.filter.isOpen) {
    w.eagle.filter.isOpen = true;
    syncFilterFromScope();
    machineryUpdateContainerHieght(s, true);
  }
}

export function machineryToggleFilterByType(s: any): any {
  const w = window as any;
  return throttle(function (filterType: any, event: any) {
    event && event.preventDefault();

    // 特殊處理：image 篩選器需要檢查 AI 搜尋
    if (filterType === 'image' && !w.eagle.aiSearch.isInstalled) {
      w.eagle.aiSearch.open();
      return;
    }

    machineryOpenFilter(s);
    const filterId = FILTER_ID_MAP[filterType];
    if (filterId) {
      clickEl("#" + filterId);
    }
  }, 300);
}

/* getChildFoldersMaps/Map（bundle 31890/31901 逐字，controller 闭包——供 multipleOpenFolder
   与 fns 表裸引用后备） */
export function machineryGetChildFoldersMaps(s: any, folders: any): any {
  const w = window as any;
  var childs: any = {};
  for (var i = 0; i < folders.length; i++) {
    var folder = folders[i];
    w.eagle.utils.tree.walk(folder.children, 'children', function (child: any, parent: any) {
      childs[child.id] = true;
    });
  }
  return childs;
}

export function machineryGetChildFoldersMap(s: any, folder: any): any {
  const w = window as any;
  var childs: any = {};
  w.eagle.utils.tree.walk(folder.children, 'children', function (child: any, parent: any) {
    childs[child.id] = true;
  });
  return childs;
}

/* multipleOpenFolder（bundle 38128-38162 逐字：resetFilter + 多选态切换（indexOf 增删 +
   needReload reload）+ currentFolderChildren getChildFoldersMaps） */
export function machineryMultipleOpenFolder(s: any, folder: any, needReload: any): void {
  const w = window as any;
  resetFilter();
  s.keyword = "";
  s.$root.currentFocus = "sidebar";
  s.viewMode = undefined;
  s.currentTag = undefined;
  syncToolbarFromScope();
  s.startCursor = 0;
  s.currentSmartFolder = undefined;
  syncPanelFromScope();
  syncListFromScope();
  s.$root.selectedSmartFolders = [];
  s.$root.selectedSmartFoldersMappings = {};
  var idx = s.$root.selectedFolders.indexOf(folder);
  if (idx === -1) {
    s.$root.selectedFolders.push(folder);
    syncListFromScope();
    s.$root.selectedFoldersMappings[folder.id] = folder;
    if (needReload) {
      s.startCursor = 0;
      s.reload();
    }
    s.currentId = 'folder-' + folder.id;
    syncSidebarFromScope();
  }
  else {
    if (s.$root.selectedFolders.length > 1) {
      s.$root.selectedFolders.splice(idx, 1);
      syncListFromScope();
      delete s.$root.selectedFoldersMappings[folder.id];
      if (needReload) {
        s.startCursor = 0;
        s.reload();
      }
    }
    else {
      return;
    }
  }
  s.currentFolderChildren = machineryGetChildFoldersMaps(s, s.$root.selectedFolders);
}

/* ── b1-7c：展开族/重复图/排序/搜索全览 ──────────────────────────────── */

/* expandFolder/expandSmartFolder（bundle 38054/38061 逐字：isExpand + updateSidebarList +
   localStorage 键逐字） */
export function machineryExpandFolder(s: any, folder: any): void {
  const w = window as any;
  if (!folder) return;
  folder.isExpand = true;
  machineryUpdateSidebarList(s);
  w.localStorage.setItem("eagle.sidebar.folder.expand." + folder.id, true);
}

export function machineryExpandSmartFolder(s: any, smartFolder: any): void {
  const w = window as any;
  if (!smartFolder) return;
  smartFolder.isExpand = true;
  machineryUpdateSidebarList(s);
  w.localStorage.setItem("eagle.sidebar.smartFolder.expand." + smartFolder.id, true);
}

/* searchInAll（bundle 29201-29205 逐字：openAll(true) + focusSeach **typo 逐字**） */
export function machinerySearchInAll(s: any): void {
  machineryOpenAll(s, true, function () {
    machineryFocusSeach(s);
  });
}

/* isDuplicateImage/addToDuplicateMapping/removeFromDuplicateMapping（bundle 30572/30585/
   30591 逐字：svg/tif/tiff 排除 + getHashID（Tier-2）+ 垃圾桶排除） */
export function machineryIsDuplicateImage(s: any, image: any): any {
  const w = window as any;
  if (!s.duplicateMappings) return false;
  if (image.ext === 'svg') return false;
  if (image.ext === 'tif') return false;
  if (image.ext === 'tiff') return false;

  var hashID = w.getHashID(image);
  if (!hashID) return false;
  // 垃圾桶文件不纳入考量
  if (s.duplicateMappings[hashID] && s.duplicateMappings[hashID].isDeleted) return false;
  return s.duplicateMappings[hashID];
}

export function machineryAddToDuplicateMapping(s: any, image: any): void {
  const w = window as any;
  var hashID = w.getHashID(image);
  if (!s.duplicateMappings) s.duplicateMappings = {};
  s.duplicateMappings[hashID] = image;
}

export function machineryRemoveFromDuplicateMapping(s: any, image: any): void {
  const w = window as any;
  var hashID = w.getHashID(image);
  delete s.duplicateMappings[hashID];
}

/* openDuplicate（bundle 36944-36974 逐字：selected/currentPage/all 三档
   OPEN_DUPLICATE_SCAN_PANEL 广播，selected 档含合并回调过滤 isDeleted） */
export function machineryOpenDuplicate(s: any, options: any = {}): void {
  if (options?.selected) {
    openDuplicateScanPanelChannel.emit({
      items: [...s.selected],
      onMergedCallback: () => {
        s.selected = s.selected.filter((item: any) => {
          return !item.isDeleted;
        });
        syncInspectorFromScope();
        scopeEvalAsync();
      },
    });
  }
  else if (options?.currentPage) {
    openDuplicateScanPanelChannel.emit({
      items: [...s.allData],
    });
  }
  else {
    openDuplicateScanPanelChannel.emit({
      items: [...s.all],
    });
  }
}

/* toggleCurrentLevelSmartFolders 内嵌闭包（38841 逐字）+ toggleAllSmartFolders 内嵌闭包
   （38831 逐字：tree.walk 全展开/收起）——localStorage 键逐字 */
export function machineryToggleCurrentLevelSmartFoldersInner(s: any, smartFolders: any, isExpand: any): void {
  const w = window as any;
  smartFolders.forEach(function (f: any) {
    if (f.isExpand !== isExpand) {
      f.isExpand = isExpand;
      w.localStorage.setItem("eagle.sidebar.smartFolder.expand." + f.id, f.isExpand);
    }
  });
  machineryUpdateSidebarList(s);
}

export function machineryToggleAllSmartFoldersInner(s: any, smartFolders: any, isExpand: any): void {
  const w = window as any;
  w.eagle.utils.tree.walk(smartFolders, 'children', function (f: any, parent: any) {
    if (f.isExpand !== isExpand) {
      f.isExpand = isExpand;
      w.localStorage.setItem("eagle.sidebar.smartFolder.expand." + f.id, f.isExpand);
    }
  });
  machineryUpdateSidebarList(s);
}

/* toggleSelectSmartFolder/toggleCurrentLevelSmartFolders/toggleAllSmartFolderExpand
   （bundle 38786/38793/38803 逐字：smartFolder ±1 展开反转 / 当前层级反转 /
   全体反转（含 selectedSmartFolder 父级取向 + sidebarIndex=0）） */
export function machineryToggleSelectSmartFolder(s: any, event: any, smartFolder: any): void {
  var expand = !smartFolder.isExpand;
  var smartFolders = smartFolder.children;
  smartFolder.isExpand = expand;
  machineryToggleCurrentLevelSmartFoldersInner(s, smartFolders, expand);
}

export function machineryToggleCurrentLevelSmartFolders(s: any, event: any, smartFolder: any): void {
  var expand = !smartFolder.isExpand;
  var parent = s.smartFolderMappings[smartFolder.parent];
  var smartFolders = s.smartFolders;
  if (parent && parent.children) {
    smartFolders = parent.children;
  }
  machineryToggleCurrentLevelSmartFoldersInner(s, smartFolders, expand);
}

export function machineryToggleAllSmartFolderExpand(s: any, event: any, selectedSmartFolder: any): void {
  const w = window as any;
  var smartFolder = selectedSmartFolder || s.currentSmartFolder;
  if (s.smartFolders && s.smartFolders.length > 0) {
    var expand = !s.smartFolders[0].isExpand;
    if (smartFolder) {
      setTimeout(function () { machineryChangeSidebarIndex(s, smartFolder); scopeEvalAsync(); }, 100);
      if (smartFolder.parent) {
        var parent = s.smartFolderMappings[smartFolder.parent];
        if (parent) {
          expand = !parent.isExpand;
        }
      }
    }
    if (!expand) s.sidebarIndex = 0;
    syncSidebarFromScope();
    machineryToggleAllSmartFoldersInner(s, s.smartFolders, expand);
    machineryUpdateSidebarList(s);
  }
}

/* setFolderOrder/setSmartFolderOrder（bundle 41360/41404 逐字：orderBy 清除/设置 +
   sortIncrease 默认 true + reload（当前匹配时）+ saveFolder（machinery 版经 scope）） */
export function machinerySetFolderOrder(s: any, folder: any, orderBy: any, ignoreReload: any): void {
  var folder = folder;
  if (!folder) return;
  if (!orderBy) {
    delete folder.orderBy;
    delete folder.sortIncrease;
  }
  else {
    folder.orderBy = orderBy;
    if (folder.sortIncrease === undefined) {
      folder.sortIncrease = true;
    }
  }
  if (s.currentFolder === folder && !ignoreReload) {
    s.reload();
  }
  machinerySaveFolder(s);
}

export function machinerySetSmartFolderOrder(s: any, folder: any, orderBy: any): void {
  var folder = folder;
  if (!folder) return;
  if (!orderBy) {
    delete folder.orderBy;
    delete folder.sortIncrease;
  }
  else {
    folder.orderBy = orderBy;
    if (folder.sortIncrease === undefined) {
      folder.sortIncrease = true;
    }
  }
  if (s.currentSmartFolder === folder) {
    s.reload();
  }
  machinerySaveFolder(s);
}

/* updateTxtItem（bundle 34478-34489 逐字：txt 盒内容 HTML 重绘 + **selected.length === 0
   且 selected[0] === item 的矛盾守卫——bundle 原样（实际恒 false 不生效）**） */
export function machineryUpdateTxtItem(s: any, item: any): void {
  const w = window as any;
  var paragraphs = item.text.split("\n");
  var paragraphsHTML = "";
  paragraphsHTML += `<h4>${item.name.trim()}</h4>`;
  paragraphs.forEach(function (paragraph: any) {
    paragraphsHTML += `<p>${paragraph.trim()}</p>`;
  });
  setHtml("#box-" + item.id + " .txt-content div", paragraphsHTML);
  if (s.selected.length === 0 && s.selected[0] === item) {
    setHtml(".inspector .txt-content div", paragraphsHTML);
  }
}

/* ── b1-7d-1：外部站点 opener 族/教程/试用/多开/重命名入口/TouchID ────── */

/* openPinterest（bundle 26859-26871 逐字三语）+ openHuaban（26873）+ openArtstation
   （26877 广播）；shell 经 w.electron.shell（19019 解构同源） */
export function machineryOpenPinterest(s: any): void {
  const w = window as any;
  switch (s.$root.preferences.general.language) {
    case 'zh_CN':
      w.electron.shell.openExternal("https://docs-cn.eagle.cool/article/828-import-from-pinterest");
      break;
    case 'zh_TW':
      w.electron.shell.openExternal("https://docs-tw.eagle.cool/article/950-import-from-pinterest");
      break;
    default:
      w.electron.shell.openExternal("https://docs-en.eagle.cool/article/517-import-from-pinterest");
      break;
  }
}

export function machineryOpenHuaban(s: any): void {
  const w = window as any;
  w.electron.shell.openExternal("https://docs-cn.eagle.cool/article/402-import-from-huaban");
}

export function machineryOpenArtstation(s: any): void {
  importArtstationChannel.emit();
}

/* quickOpenFolder（bundle 44900-44936 逐字：openFolder(ignoreReload=true)/openAll 分流 +
   changeSidebarIndex 200ms + 自动定位（60/页倒序扫 allData → startCursor + 藏容器 reload +
   500ms select(undefined,target)+autoScroll+显容器）） */
export function machineryQuickOpenFolder(s: any, folder: any, t: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  var target = t || s.selected[0];
  if (folder) {
    openFolder(folder, undefined, undefined, true);
  }
  else {
    machineryOpenAll(s);
  }
  setTimeout(function () {
    machineryChangeSidebarIndex(s, folder);
    scopeEvalAsync();
  }, 200);
  // 自动定位
  if (target) {
    setTimeout(function () {
      for (var i = s.allData.length - 1; i >= 0; i--) {
        var image = s.allData[i];
        if (target === image) {
          var startPage = parseInt(i / 60 as any);
          console.log(`目标在第 ${startPage} 页`);
          s.startCursor = startPage;
          cssSet("#box-container", { visibility: "hidden" });
          s.reload();
          s.selected = [];
          syncInspectorFromScope();
          $timeout(function () {
            callExternal('select', undefined, target);
            machineryAutoScroll(s, undefined);
            setTimeout(function () {
              cssSet("#box-container", { visibility: "initial" });
            }, 100);
          }, 500);
          scopeEvalAsync();
        }
      }
    }, 200);
  }
}

/* multipleOpenSmartFolder（bundle 38172-38197 逐字：与 multipleOpenFolder 对称
   （smartFolder 多选态切换，currentFolder 清空）） */
export function machineryMultipleOpenSmartFolder(s: any, smartFolder: any, needReload: any): void {
  resetFilter();
  s.keyword = "";
  s.$root.currentFocus = "sidebar";
  s.viewMode = undefined;
  s.currentTag = undefined;
  syncToolbarFromScope();
  s.startCursor = 0;
  s.currentFolder = undefined;
  syncPanelFromScope();
  syncFolderLock();
  syncListFromScope();
  s.$root.selectedFolders = [];
  syncListFromScope();
  s.$root.selectedFoldersMappings = {};
  var idx = s.$root.selectedSmartFolders.indexOf(smartFolder);
  if (idx === -1) {
    s.$root.selectedSmartFolders.push(smartFolder);
    s.$root.selectedSmartFoldersMappings[smartFolder.id] = smartFolder;
    if (needReload) {
      s.startCursor = 0;
      s.reload();
    }
    s.currentId = 'smart-folder-' + smartFolder.id;
    syncSidebarFromScope();
  }
  else {
    if (s.$root.selectedSmartFolders.length > 1) {
      s.$root.selectedSmartFolders.splice(idx, 1);
      delete s.$root.selectedSmartFoldersMappings[smartFolder.id];
      if (needReload) {
        s.startCursor = 0;
        s.reload();
      }
    }
    else {
      return;
    }
  }
}

/* renameFolder/renameSmartFolder（bundle 38163 邻域/38168 邻域逐字：editable + newFolderName
   + 双 100/200ms focus select——bundle 原样双写） */
export function machineryRenameFolder(s: any, event: any, folder: any): void {
  const w = window as any;
  // if (folder.password && !folder.isUnLock) return;
  s.viewMode = undefined;
  s.currentFolder = folder;
  syncPanelFromScope();
  syncFolderLock();
  syncListFromScope();
  folder.editable = true;
  folder.newFolderName = folder.name;
  setTimeout(function () {
    focusEl("#folder-input-" + folder.id);
    selectEl("#folder-input-" + folder.id);
  }, 100);
  setTimeout(function () {
    focusEl("#folder-input-" + folder.id);
    selectEl("#folder-input-" + folder.id);
  }, 200);
}

export function machineryRenameSmartFolder(s: any, event: any, smartFolder: any): void {
  const w = window as any;
  s.viewMode = undefined;
  s.currentSmartFolder = smartFolder;
  syncPanelFromScope();
  syncListFromScope();
  smartFolder.editable = true;
  smartFolder.newFolderName = smartFolder.name;
  setTimeout(function () {
    focusEl("#folder-input-" + smartFolder.id);
    selectEl("#folder-input-" + smartFolder.id);
  }, 100);
  setTimeout(function () {
    focusEl("#folder-input-" + smartFolder.id);
    selectEl("#folder-input-" + smartFolder.id);
  }, 200);
}

/* showTutorial（bundle 37xxx 逐字：空库+单历史+无文件夹 && 教程未看过守卫 + themePath
   filter（getFilter()）+ swal 四语 open 文档跳转） */
export function machineryShowTutorial(s: any): void {
  const w = window as any;
  if (s.all.length === 0 && s.libraryHistory.length === 1 && s.folders.length === 0) {
    if (w.localStorage["eagle.show.tutorial"] !== "true") {
      const theme = getFilter()('themePath')(s.theme);

      w.swal({
        html: `
                            <div class="alert">
                                <div class="alert-image">
                                    <img width="384" height="216" src="assets/images/${theme}/illustrations/illustration-tutorial-${s.platform}.png" style="width: calc(100% + 32px);margin-bottom: 12px;aspect-ratio: 768/432;margin-left: -16px;margin-right: -16px;margin-top: -16px;">
                                </div>
                                <h4 class="alert-title">${w.i18n.__('dialog.tutorial.title')}</h4>
                                <p class="alert-desc">${w.i18n.__('dialog.tutorial.desc')}</p>
                            </div>
                        `,
        showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
        width: 400,
        customClass: "tutorial-modal",
        cancelButtonColor: "#777777",
        confirmButtonText: w.i18n.__('dialog.tutorial.open'),
        cancelButtonText: w.i18n.__('dialog.tutorial.later'),
      }).then(function (result: any) {
        w.localStorage.setItem("eagle.show.tutorial", "true");
        switch (w.preferences.general.language) {
          case 'zh_CN':
            w.electron.shell.openExternal('https://docs-cn.eagle.cool/article/167-tutorial-1-overview-of-library-and-interface')
            break;
          case 'zh_TW':
            w.electron.shell.openExternal('https://docs-tw.eagle.cool/article/288-tutorial-1-overview-of-library-and-interface')
            break;
          case 'ja_JP':
            w.electron.shell.openExternal('https://docs-jp.eagle.cool/article/1043-tutorial-1-overview-of-library-and-interface')
            break;
          default:
            w.electron.shell.openExternal('https://docs-en.eagle.cool/article/266-tutorial-1-overview-of-library-and-interface')
        }
      });

    }
  }
}

/* openTrialModal（bundle 37xxx 逐字：ipcRenderer 统一表达式 send('open-trial-modal')） */
export function machineryOpenTrialModal(s: any, trialRemain: any): void {
  const w = window as any;
  if (trialRemain) {
    const ipc = w.__eagleIpc || (w.electron && w.electron.ipcRenderer);
    ipc.send('open-trial-modal', trialRemain);
  }
}

/* unlockFolderWithTouchID（bundle 37xxx 逐字 async：canUseTouchID 守卫 + remote
   systemPreferences promptTouchID（@electron/remote 为 bundle 19020 词法绑定 →
   window.require('@electron/remote') 惰性取——nodeIntegration 两期可达）+ 解锁链 +
   失败 shake 动画 500ms + 焦点回密碼框） */
export async function machineryUnlockFolderWithTouchID(s: any, event: any): Promise<void> {
  const w = window as any;
  // 防止事件冒泡
  if (event) {
    event.stopPropagation();
  }

  // 檢查設備支援
  if (!s.canUseTouchID) {
    return;
  }

  try {
    await w.require('@electron/remote').systemPreferences.promptTouchID(w.i18n.__('unlock.folder.touchid.prompt') || '驗證以解鎖文件夾');
    // 驗證成功，解鎖文件夾
    s.currentFolder.isUnLock = true;
    syncFolderLock();
    syncListFromScope();
    s.isLoading = true;
    machineryUpdateSidebarList(s);
    machineryCalculateImageBinding(s, { ignoreSort: true }, function () {
      s.reload();
      machineryUpdateSelection(s);
      s.isLoading = false;
      s.unlockPassword = "";
      scopeEvalAsync();
    });
  } catch (err) {
    // 驗證失敗或用戶取消
    console.log('Touch ID 驗證失敗:', err);

    // 顯示錯誤動畫
    addClass(".touchid-btn-inline", "animation--shake-horizontal");
    setTimeout(() => {
      removeClass(".touchid-btn-inline", "animation--shake-horizontal");
    }, 500);

    // 焦點回到密碼輸入框
    setTimeout(() => {
      focusEl("#lock-password-input");
    }, 100);
  }
}

/* ── b1-7d-2：getSmartFolderList/getFolderList（侧栏树渲染核心）───────── */

/* getSmartFolderList（bundle 42644-42737 逐字：tree.walk 全树 → guidelines 色谱继承 +
   parent 指针维护（;;双分号原样）+ smartFolderList/mappings 双登记 + depth/size/vstype/
   styles 首尾位标注 + isVisible 三态 + 根层/过滤期/父可见三档入列） */
export function machineryGetSmartFolderList(s: any): any[] {
  const w = window as any;
  let list: any[] = [];
  let isFiltering = !!s.folderKeyword;
  let guidelinesMap: any = {};

  s.smartFolderList = [];
  syncSidebarFromScope();

  w.eagle.utils.tree.walk(s.smartFolders, 'children', function (smartFolder: any, parent: any, depth: any) {

    // 計算 guidelines 顏色及數量
    let guidelines: any[] = [];
    if (parent && guidelinesMap[parent.id]) {
      const parentGuidelines = guidelinesMap[parent.id];
      guidelines = [...parentGuidelines, smartFolder.iconColor || 'normal'];
    }
    else {
      guidelines = [smartFolder.iconColor || 'normal'];
    }
    guidelinesMap[smartFolder.id] = guidelines;

    var idx;
    var isVisible = false;

    if (parent) {
      smartFolder.parent = parent.id;;
    }
    else {
      delete smartFolder.parent;
    }

    // 列表版本 SmartFolders
    s.smartFolderList.push(smartFolder);
    syncSidebarFromScope();

    s.smartFolderMappings[smartFolder.id] = smartFolder;

    smartFolder.depth = depth;
    smartFolder.size = 27;
    smartFolder.vstype = 'smartFolder';
    smartFolder.guidelines = guidelines.slice(0, guidelines.length - 1);
    smartFolder.styles = {
      depth: depth,
      first: false,
      last: false
    };

    if (parent) {
      smartFolder.isVisible = smartFolder.isExpand && parent.isVisible;
    }
    else {
      smartFolder.isVisible = smartFolder.isExpand;
    }

    if (depth !== 0 && parent && parent.children) {
      idx = parent.children.indexOf(smartFolder);
      if (idx === 0 && parent.children.length > 1) {
        smartFolder.styles.first = true;
        smartFolder.styles.last = false;
      }
      else if (idx === 0 && parent.children.length === 1) {
        smartFolder.styles.first = false;
        smartFolder.styles.last = true;
      }
      else if (idx === parent.children.length - 1) {
        smartFolder.styles.first = false;
        smartFolder.styles.last = true;
      }
      else {
        smartFolder.styles.first = false;
        smartFolder.styles.last = false;
      }
    }
    if (smartFolder && smartFolder.isExpand && smartFolder.children && smartFolder.children.length > 0) {
      smartFolder.styles.last = true;
    }

    // 决定是否要在画面上显示
    if (!parent) {
      list.push(smartFolder);
    }
    else if (isFiltering) {
      list.push(smartFolder);
    }
    else {
      if (smartFolder && parent.isVisible) {
        list.push(smartFolder);
      }
    }

  });

  return list;
}

/* getFolderList（bundle 42738-42823 逐字：与 Smart 版同构 + 密码夹可见性三态
   （parent.password → isExpand && parent.isVisible && !!parent.isUnLock）+ 无
   smartFolderList/mappings 登记面——bundle 原样） */
export function machineryGetFolderList(s: any): any[] {
  const w = window as any;
  let list: any[] = [];
  let isFiltering = !!s.folderKeyword;
  let guidelinesMap: any = {};

  w.eagle.utils.tree.walk(s.folders, 'children', function (folder: any, parent: any, depth: any) {

    // 計算 guidelines 顏色及數量
    let guidelines: any[] = [];
    if (parent && guidelinesMap[parent.id]) {
      const parentGuidelines = guidelinesMap[parent.id];
      guidelines = [...parentGuidelines, folder.iconColor || 'normal'];
    }
    else {
      guidelines = [folder.iconColor || 'normal'];
    }
    guidelinesMap[folder.id] = guidelines;

    var idx;
    folder.size = 27;
    folder.vstype = 'folder';
    folder.guidelines = guidelines.slice(0, guidelines.length - 1);
    folder.styles = {
      depth: depth,
      first: false,
      last: false
    };

    if (parent) {
      if (parent.password) {
        folder.isVisible = folder.isExpand && parent.isVisible && !!parent.isUnLock;
      }
      else {
        folder.isVisible = folder.isExpand && parent.isVisible;
      }
    }
    else {
      folder.isVisible = folder.isExpand;
    }

    if (depth !== 0 && parent && parent.children) {
      idx = parent.children.indexOf(folder);
      if (idx === 0 && parent.children.length > 1) {
        folder.styles.first = true;
        folder.styles.last = false;
      }
      else if (idx === 0 && parent.children.length === 1) {
        folder.styles.first = false;
        folder.styles.last = true;
      }
      else if (idx === parent.children.length - 1) {
        folder.styles.first = false;
        folder.styles.last = true;
      }
      else {
        folder.styles.first = false;
        folder.styles.last = false;
      }
    }
    if (folder && folder.isExpand && folder.children.length > 0) {
      folder.styles.last = true;
    }

    // 决定是否要在画面上显示
    if (!parent) {
      list.push(folder);
    }
    else if (isFiltering) {
      list.push(folder);
    }
    else {
      if (parent.password) {
        if (folder && parent.isVisible && !!parent.isUnLock) {
          list.push(folder);
        }
      }
      else {
        if (folder && parent.isVisible) {
          list.push(folder);
        }
      }
    }
  });
  return list;
}

/* ── b1-7d-3：列表滑条/元信息/移入文件夹/上传队列/链接导入 ───────────── */

/* updateListSlider（bundle 31350-31352：**函数体为空——no-op 原样**） */
export function machineryUpdateListSlider(s: any, size: any): void {

}

/* ── b1-9bz-C-4：缩略图放大/还原（自 selectionViewDomain 迁入；原 domainEnlarge/ShrinkThumbnails
   随 imageSize.height watcher 退役改为写入点直调，故实现迁到本模块 —— 本模块不能被域反向
   import（循环），而域可以 import 本模块） ── */
let machineryEnlargeThumbnailsTimeout: any = null;
export function machineryEnlargeThumbnails(): void {
  const $: any = (window as any).$;
  clearTimeout(machineryEnlargeThumbnailsTimeout);
  machineryEnlargeThumbnailsTimeout = setTimeout(() => {
    console.time("enlargeThumbnails");
    const $boxs = $(".box.show.jpg, .box.show.png, .box.show.webp, .box.show.bmp, .box.show.jfif").not(".enlarge-thumbnail");
    const $imgs = $boxs.find(".thumbnail img");

    $imgs.each(function (this: any) {
      const $self = $(this);
      const $box = $self.parent().parent();
      const rawsrc = $self.attr('raw');
      if (rawsrc) {
        $self.attr('src', rawsrc);
        $box.addClass("enlarge-thumbnail");
      }
    });
    console.timeEnd("enlargeThumbnails");
  }, 600);
}

let machineryShrinkThumbnailsTimeout: any = null;
export function machineryShrinkThumbnails(): void {
  const $: any = (window as any).$;
  clearTimeout(machineryShrinkThumbnailsTimeout);
  machineryShrinkThumbnailsTimeout = setTimeout(() => {
    console.time("shrinkThumbnails");
    const $boxs = $(".box.enlarge-thumbnail.jpg, .box.enlarge-thumbnail.png, .box.enlarge-thumbnail.webp, .box.enlarge-thumbnail.bmp, .box.enlarge-thumbnail.jfif");
    const $imgs = $boxs.find(".thumbnail img");

    $imgs.each(function (this: any) {
      const $self = $(this);
      const $box = $self.parent().parent();
      const lsrc = $self.attr('lsrc');
      if (lsrc) {
        $self.attr('src', lsrc);
        $box.removeClass("enlarge-thumbnail");
      }
    });
    console.timeEnd("shrinkThumbnails");
  }, 600);
}

/** imageSize.height 变化后的统一处理（原 $watch("imageSize.height") 的 listener）。 */
export function machineryOnImageSizeHeightChanged(s: any): void {
  if (!s || !s.imageSize) return;
  machineryUpdateSubFolderWidth(s);
  machineryUpdateListSlider(s, s.imageSize.height);
  if (s.imageSize.height > 600 && s.showOriginalImageWhenLarge) {
    machineryEnlargeThumbnails();
  }
  else {
    machineryShrinkThumbnails();
  }
}

/** imageSize.zoomRatio 变化后的统一处理（原 $watch("imageSize.zoomRatio") 的 listener）。 */
export function machineryOnZoomRatioChanged(s: any): void {
  if (!s || !s.imageSize) return;
  s.sliderZoomRatio = s.imageSize.zoomRatio;
  syncDetailFromScope();
}

/* changeMetaItems（bundle 37273-37278 逐字） */
export function machineryChangeMetaItems(s: any, type: any): void {
  const w = window as any;
  s.listMetaType = type;
  syncPanelFromScope();
  w.localStorage.setItem("eagle.list.meta.type", s.listMetaType);
  machineryUpdateItemsView(s, s.allData);
  w.electronLog && w.electronLog.info(`[app] Change list display info: ${s.listMetaType}`);
}

/* moveToFolders（bundle 43242-43251 逐字：MOVE_TO_FOLDER 广播（folderList 活对象））
   b1-9ba：该频道全树无 $on 接收者（原接收者随 bundle 摘除退役，js/directives 侧文件
   从未挂载）——广播体移除，函数保形（快捷键 'move-to-folders' 入口与 s.moveToFolders
   挂载面不变；移动到文件夹竖切时按 React 语义归位）。 */
export function machineryMoveToFolders(_s: any, _e: any): void {}

// ── b1-7d-3 域内自管（原 controller 闭包 var：addImageTimeLeftInterval 45319 邻域）──
let addImageTimeLeftInterval: any = null;

/* calcuteAddImageTimeLeft（bundle 45326-45338 逐字闭包：**is.number——is.min.js 为孤儿
   文件（index.html 未加载），bundle 同引用同样潜在崩——w.is 镜像同语义**） */
function machineryCalcuteAddImageTimeLeft(s: any): void {
  const w = window as any;
  if (s.uploadQueue.length > 0) {
    if (!s.addImageStartTime) {
      s.addImageStartTime = Date.now();
    }
    var elapsedTime = (new Date().getTime()) - s.addImageStartTime;
    var chunksPerTime = s.finishQueue.length / elapsedTime;
    var estimatedTotalTime = s.uploadQueue.length / chunksPerTime;
    var remain = parseInt((estimatedTotalTime - elapsedTime) / 1000 as any);
    if (w.is.number(remain)) {
      s.addImageTimeLeftInSeconds = remain;
      syncUploadFromScope();
    }
  }
}

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
    var dragUrl = event.dataTransfer && w.jQuery("<div></div>").html(event.dataTransfer.getData("text/html")).find("img").attr("src");
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
export function machineryShowUploadQueue(s: any): void {
  const w = window as any;
  if (!s.addImageStartTime) {
    s.addImageStartTime = Date.now();
  }
  addClass("body", "is-uploading");
  addClass("#upload-queue-progress", "open");
  removeClass("#upload-queue-progress .progressbar", "ng-hide");
  setHtml("#upload-queue-progress .message .percentage", s.finishQueue.length + "/" + s.uploadQueue.length);
  addImageTimeLeftInterval = setInterval(function () {
    machineryCalcuteAddImageTimeLeft(s);
    scopeEvalAsync();
  }, 1000);
}

export function machineryHideUploadQueue(s: any): void {
  const w = window as any;
  if (s.uploadQueue.length === 0) {
    removeClass("#upload-queue-progress", "open");
    removeClass("body", "is-uploading");
    w.updateWindowProgressBar(-1);
  }
}

/* importLinks（bundle 26906-26994 逐字：剪贴板 http 预读（**clipboard 裸引 →
   w.electron.clipboard**；is.url → w.is 镜像）+ textarea 校验 swal → 逐链 HEAD 探测分流
   （image → upload-url 通道 / 其他 → 书签 url-from-extension）+ uploadQueue 占位） */
export function machineryImportLinks(s: any): void {
  const w = window as any;

  var inputValue = '';

  // 從剪貼版預先讀取用戶的資料，如果發現是 http 開頭
  const clipboardText = w.electron.clipboard.readText();
  if (clipboardText.startsWith('http')) {
    const links = clipboardText.split('\n').map((line: any) => line.trim()).filter((line: any) => line.length > 0 && w.is.url(line));
    if (links.length > 0) {
      inputValue = links.join('\n');
    }
  }

  w.swal({
    html: `
                    <div class="alert">
                        <div class="alert-icon links"></div>
                        <h4 class="alert-title">${w.i18n.__('Dialog.ImportLinks.title')}</h4>
                        <p class="alert-desc">${w.i18n.__('Dialog.ImportLinks.desc')}</p>
                    </div>
                `,
    showCloseButton: false,
    showCancelButton: true,
    allowOutsideClick: false,
    focusConfirm: true,
    focusCancel: false,
    padding: 24,
    width: 480,
    maxWidth: 480,
    input: 'textarea',
    inputValue: inputValue ?? '',
    inputValidator: function (value: any) {
      return new Promise(function (resolve: any, reject: any) {
        if (!value || value.trim() === "") {
          reject(w.i18n.__('Dialog.ImportLinks.LinkFormatError'));
          return;
        }
        // 支援多行，每行一個鏈接
        const lines = value.split('\n').map((line: any) => line.trim()).filter((line: any) => line.length > 0);
        // 簡單的 URL 格式驗證
        const urlPattern = /^(https?:\/\/)[^\s\/$.?#].[^\s]*$/i;
        const invalidLinks = lines.filter((line: any) => !urlPattern.test(line));
        if (invalidLinks.length > 0) {
          reject(w.i18n.__('Dialog.ImportLinks.LinkFormatError') + "\n" + invalidLinks.join('\n'));
        } else {
          resolve();
        }
      });
    },
    customClass: "alert-box",
    cancelButtonColor: "#777777",
    confirmButtonText: w.i18n.__("Dialog.ImportLinks.Button"),
    cancelButtonText: w.i18n.__("general.cancel"),
  }).then(function (result: any) {
    // 批量處理鏈接
    const links = result.split('\n').map((line: any) => line.trim()).filter((line: any) => line.length > 0);
    const currentFolderId = s.currentFolder?.id;
    const folderIds = currentFolderId ? [currentFolderId] : [];

    links.forEach((link: any) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const onComplete = function (contentType: string) {
        clearTimeout(timer);
        if (contentType.indexOf("image") > -1) {
          // 圖片類型：直接下載圖片
          w.IPCHelper.send('upload-url', {
            url: link,
            folders: folderIds,
            tags: [],
          });
        }
        else {
          // 其他所有情況（html、未知類型、HEAD 請求失敗等）：
          // 一律當作書籤匯入，截圖能不能成功由後端決定
          const data = {
            id: w.guid(),
            url: link,
            tags: [],
            modificationTime: Date.now(),
            folders: folderIds,
          };
          const ipc = w.__eagleIpc || (w.electron && w.electron.ipcRenderer);
          ipc.sendTo(w.backgroundWindowID, 'url-from-extension', data);
        }
        s.uploadQueue.push({});
        syncUploadFromScope();
      };
      fetch(link, { method: "HEAD", signal: controller.signal })
        .then(function (resp) {
          onComplete((resp.headers.get('Content-Type') || "").toLowerCase());
        })
        .catch(function () {
          onComplete("");
        });
    });
  }, function () { });
}

/* videoScreenShot（bundle 33233-33288 逐字 async：mpv screenshot API / native drawImage
   双路 → copyMode 剪贴板（electron.nativeImage）或 screencapture-from-extension 上送
   （guid + currentTime.toFixed(2) 命名）） */
export async function machineryVideoScreenShot(s: any, copyMode: any): Promise<void> {
  return mediaVideoScreenShot(s, copyMode);
}

/* getFolderImages（bundle 42841-42865 逐字：倒序扫描 raw + folders 归属判定；
   includeSubFolder 时 eagle.utils.tree.walk 子树命中即含（回调 return 原样）；
   try/catch 吞错原样） */
export function machineryGetFolderImages(s: any, folder: any, includeSubFolder: any): any[] {
  const w = window as any;
  var images: any[] = [];
  for (var rindex = s.raw.length - 1; rindex >= 0; rindex--) {
    try {
      var image = s.raw[rindex];
      if (image.isDeleted) continue;
      var isContain = image.folders.indexOf(folder.id) > -1;
      if (includeSubFolder) {
        if (!isContain) {
          w.eagle.utils.tree.walk(folder.children, 'children', function (child: any, parent: any) {
            if (image.folders.indexOf(child.id) > -1) {
              isContain = true;
              return;
            }
          });
        }
      }
      if (isContain) {
        images.push(image);
      }
    }
    catch (err) { }
  }
  return images;
}

/* findDupclipate（bundle 28507-28868 逐字，typo 唯一：全局查重主表 + filterExtensions/
   filterCameras 建表副产物（currentFolder 空分支）+ duplicateGroupings 主动扫描（hasColorInfo
   才分组、>1 才成组）；getHashID 为 bundle 2127 顶层函数（w.* 直连，双参）；第二段循环
   var rindex/image/hashID 与首段同名 → *2 后缀（TS 语义同 var 重声明）） */
export function machineryFindDupclipate(s: any, currentFolder: any, hasColorInfo: any): void {
  const w = window as any;
  var duplicates: any[] = [];
  var pushedMapping: any = {};
  var duplicateMappings: any = {};

  s.duplicates = [];
  s.duplicateGroupings = {};

  if (!s.raw) return;

  if (!hasColorInfo) {
    duplicateMappings = s.duplicateMappings;
  }
  else {
    duplicateMappings = {};
  }

  s.duplicateTarget = currentFolder;

  // 全部圖片
  if (!currentFolder) {
    // 建立查詢表
    w.eagle.filter.filterExtensions = {};
    w.eagle.filter.filterCamerasMapping = {};
    for (var rindex = s.raw.length - 1; rindex >= 0; rindex--) {
      var image = s.raw[rindex];

      // Note: 这部分原来放在 rebindRefresh 中，因为不需要重复计算，故放在这里
      if (w.VIDEO_TYPES[image.ext]) {
        w.eagle.filter.filterExtensions['video'] = true;
      } else if (w.AUDIO_TYPES[image.ext]) {
        w.eagle.filter.filterExtensions[image.ext] = true;
        w.eagle.filter.filterExtensions['audio'] = true;
      } else if (w.FONT_TYPES[image.ext]) {
        w.eagle.filter.filterExtensions['font'] = true;
      } else {
        switch (image.ext) {
          case 'ppt':
          case 'pptx':
          case 'potx':
            w.eagle.filter.filterExtensions['powerpoint'] = true;
            break;
          case 'doc':
          case 'docx':
            w.eagle.filter.filterExtensions['word'] = true;
            break;
          case 'xls':
          case 'xlsx':
            w.eagle.filter.filterExtensions['excel'] = true;
            break;
          case 'arw':
          case 'cr2':
          case 'cr3':
          case 'crw':
          case 'dng':
          case 'erf':
          case 'nef':
          case 'nrw':
          case 'mrw':
          case 'orf':
          case 'pef':
          case 'raf':
          case 'raw':
          case 'rw2':
          case 'sr2':
          case 'srw':
          case 'x3f':
            w.eagle.filter.filterExtensions['raw'] = true;
            w.eagle.filter.filterExtensions[image.ext] = true;
            break;
          default:
            w.eagle.filter.filterExtensions[image.ext] = true;
        }
      }

      if (image.rawMetas) {
        w.eagle.filter.filterCamerasMapping[image.rawMetas.camera] = true;
      }

      var hashID = w.getHashID(image, hasColorInfo);
      if (!hashID) continue;
      if (image.ext === 'svg') continue;
      if (image.ext === 'tif') continue;
      if (image.ext === 'tiff') continue;
      if (image.isDeleted) continue;

      // NOTE: 如果是用户主动扫描，才计算图片去重复
      if (hasColorInfo) {
        if (!s.duplicateGroupings[hashID]) {
          s.duplicateGroupings[hashID] = [];
        }
        s.duplicateGroupings[hashID].push(image);
      }

      // 如果有東西，裡面的東西跟自己都是那個重複者
      if (!duplicateMappings[hashID]) {
        duplicateMappings[hashID] = image;
      } else {
        // Note: 下面注解的代码严重影响效能
        // 优化版
        if (!pushedMapping[hashID]) {
          duplicates.push(duplicateMappings[hashID]);
        }
        pushedMapping[hashID] = true;
        duplicates.push(image);
      }
    }

    if (Object.keys(w.eagle.filter.filterCamerasMapping).length > 0) {
      w.eagle.filter.filterCameras = Object.keys(w.eagle.filter.filterCamerasMapping);
      syncFilterFromScope();
      w.eagle.filter.filterCameras = w.eagle.filter.filterCameras.sort(function (a: any, b: any) {
        if (a > b) return 1;
        if (a < b) return -1;
        return 0;
      });
      syncFilterFromScope();
    }
  }
  else {

    var images = machineryGetFolderImages(s, currentFolder, s.showSubfolderContent);
    for (var rindex2 = images.length - 1; rindex2 >= 0; rindex2--) {

      var image2 = images[rindex2];
      var hashID2 = w.getHashID(image2, hasColorInfo);
      if (!hashID2) continue;
      if (image2.ext === 'svg') continue;
      if (image2.ext === 'tif') continue;
      if (image2.ext === 'tiff') continue;
      if (image2.isDeleted) continue;

      if (hasColorInfo) {
        if (!s.duplicateGroupings[hashID2]) {
          s.duplicateGroupings[hashID2] = [];
        }
        s.duplicateGroupings[hashID2].push(image2);
      }

      // 如果有東西，裡面的東西跟自己都是那個重複者
      if (!duplicateMappings[hashID2]) {
        duplicateMappings[hashID2] = image2;
      } else {
        // 优化版
        if (!pushedMapping[hashID2]) {
          duplicates.push(duplicateMappings[hashID2]);
        }
        pushedMapping[hashID2] = true;
        duplicates.push(image2);
      }
    }
  }

  s.duplicates = duplicates;

  if (hasColorInfo) {
    var duplicateGroupings = Object.keys(s.duplicateGroupings).map(function (key: any) { return s.duplicateGroupings[key]; });
    duplicateGroupings = duplicateGroupings.filter(function (group: any) {
      return group.length > 1;
    });
    s.duplicateGroupings = duplicateGroupings;
  }
}

/* getAllChildFolder（bundle 42498-42505 逐字：tree.walk 全子树收集 + Set 去重） */
export function machineryGetAllChildFolder(s: any, fd: any): any[] {
  const w = window as any;
  let folders: any[] = [];
  w.eagle.utils.tree.walk(fd.children, 'children', function (folder: any, parent: any, depth: any) {
    folders.push(folder);
  });
  folders = [...new Set(folders)];
  return folders;
}

/* refreshSubfolderList（bundle 27462-27492 逐字：showSubfolderContent 分流 subFolders +
   keyword 过滤（**filter 回调非命中路径无 return——undefined 隐式剔除怪癖原样**）；
   subFolderSortableOptions.disabled 开关为 bundle 38947 controller init 种子对象
   （applyDataMachineryScope if-absent 补种）） */
export function machineryRefreshSubfolderList(s: any): void {
  // 过滤子文件夹
  if (s.currentFolder) {
    if (s.showSubfolderContent) {
      s.subFolders = machineryGetAllChildFolder(s, s.currentFolder);
      syncListFromScope();
      if (s.subFolderSortableOptions) s.subFolderSortableOptions.disabled = true;
    }
    else {
      s.subFolders = s.currentFolder.children;
      syncListFromScope();
      if (s.subFolderSortableOptions) s.subFolderSortableOptions.disabled = false;
    }
    if (s.keyword) {
      s.subFolders = s.subFolders.filter(function (folder: any) {
        if (folder.name.toLowerCase().indexOf(s.keyword.toLowerCase()) > -1) {
          return true;
        }
        if (folder && folder.tags) {
          var folderTags = folder.tags.join("");
          if (folderTags.toLowerCase().indexOf(s.keyword.toLowerCase()) > -1) {
            return true;
          }
        }
      });
      syncListFromScope();
      if (s.subFolderSortableOptions) s.subFolderSortableOptions.disabled = true;
    }
  }
  else {
    s.subFolders = [];
    syncListFromScope();
  }
}

/* focusSeach（bundle 29192-29195 逐字，typo 原样） */
export function machineryFocusSeach(s: any): void {
  const w = window as any;
  focusEl("#search"); selectEl("#search");
  s.showSuggestions = true;
  syncToolbarFromScope();
}

/* newSmartFolder（bundle 39944-39946 逐字：$rootScope.$broadcast → s.$root（shim $root
   同体语义）） */
export function machineryNewSmartFolder(s: any, event: any, smartFolder: any): void {
  newSmartFolderChannel.emit({ smartFolder: smartFolder, parent: undefined });
}

/* prependFolder（bundle 39968-39979 逐字：unshift + folderMappings 登记 + updateSidebarList
   + 1s 后 calculateImageBinding→saveFolder） */
export function machineryPrependFolder(s: any, folder: any): void {
  s.folders.unshift(folder);
  s.folderMappings[folder.id] = folder;
  machineryUpdateSidebarList(s);
  setTimeout(function () {
    machineryCalculateImageBinding(s, { ignoreSort: true }, function () {
      machinerySaveFolder(s);
    });
  }, 1000);
}

/* gotoTop/gotoBottom（bundle 21886-21916 逐字：resetNgGridLayoutData 为 ngGridLayout 指令
   66970 隐式全局赋值（window 可达，w.* 直连——同 764/944 先例；post-b1 由 grid 域供给）；
   gotoBottomTimeout 存 scope 字段原样；gotoBottom else 分支 offset 死变量原样保留） */
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

/* ── b1-8 rename 域 ──
   emojiRegex（bundle 19014 顶层 const → 词法绑定不可达，域内同字面移植；**g 标志 lastIndex
   状态跨调用共享与 bundle 顶层单例同语义**）、remainingFilenameLength（19018 require）与
   sanitize（22746 函数内 require(appRoot + ...)——**无 .path 后缀，bundle 原样**）为惰性
   require 缓存（bundle 为顶层即时，machinery 首用 —— 调用面语义同）。 */
const emojiRegex = /\p{Emoji_Presentation}|\p{Extended_Pictographic}|([0-9]\u{FE0F}\u{20E3})|([\*#\u{1F51F}]\u{FE0F}\u{20E3})/gmu;
let remainingFilenameLengthCache: any = null;
function getRemainingFilenameLength(): any {
  const w = window as any;
  if (!remainingFilenameLengthCache) {
    remainingFilenameLengthCache = w.require(w.appRoot.path + '/app/js/utils/remainingFilenameLength.js');
  }
  return remainingFilenameLengthCache;
}
let sanitizeCache: any = null;
function getSanitize(): any {
  const w = window as any;
  if (!sanitizeCache) {
    sanitizeCache = w.require(w.appRoot + '/my_modules/sanitize-filename');
  }
  return sanitizeCache;
}

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
export function machineryEnableImageNameEditable(s: any, event: any, $name: any): void {
  const w = window as any;
  const el = (($name as any) instanceof HTMLElement ? $name : ($name && $name[0])) as HTMLElement;
  if (!el) return;
  if (hasClass(el, "editable")) return;
  var originalName = textEl(el).trim();
  el.setAttribute("contenteditable", "true");
  el.classList.add("editable");
  el.focus();
  setTimeout(function () {
    el.focus();
    selectText(el);
    document.execCommand('selectAll', false, null as any);
  }, 50);

  onEl(el, "mousedown", function (event: any) {
    event.stopPropagation();
  });

  onEl(el, "keydown", function (event: any) {
    var keyCode = event.keyCode;
    switch (keyCode) {
      case 13:
        event.preventDefault();
        event.stopPropagation();
        triggerEl(el, "blur");
        break;
      case 27:
        event.preventDefault();
        event.stopPropagation();
        setHtmlEl(el, `<span>${originalName}</span>`);
        exitEditable();
        break;
      case 65:
        if (event.metaKey || event.ctrlKey) {
          event.preventDefault();
          event.stopPropagation();
          document.execCommand('selectAll', false, null as any);
        }
        break;
    }
  });

  onEl(el, "paste", function (e: any) {
    e.preventDefault();
    var text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
    document.execCommand("insertHTML", false, text);
  });

  onEl(el, "blur", w.debounce(function () {
    exitEditable();
    var $scope = getBodyScope();
    var newName = textEl(el);
    if (!newName || !newName.trim()) {
      setHtmlEl(el, `<span>${originalName}</span>`);
      return;
    }
    if (newName !== originalName && $scope && $scope.selected[0]) {

      var name = newName;
      var image = $scope.selected[0];

      name = name.substr(0, getRemainingFilenameLength()($scope.libraryPath));
      name = getSanitize()(name).replace(/%/g, "").replace(/&lt;/g, "").replace(/&gt;/g, "").trim();
      name = unescape(name);
      w.eagle.inspector.newName = name;

      if (emojiRegex.test(name)) {
        name = name.replace(emojiRegex, '');
        w.eagle.inspector.newName = name;
      }

      if (name) {
        image.oldName = originalName;
        image.name = name;
        image.newName = name;
      }
      setHtmlEl(el, `<span>${name}</span>`);
      console.log(`${originalName} > ${name}`);
      w.ayncsImagesChange([image]);
      w.hiddenByCurrentFilter([image]);
      // TagManager.getSuggestTags([image]);
      scopeEvalAsync();
      try { w.electronLog && w.electronLog.info(`[app] Change list item's name: ${originalName}(${image.id}) > ${newName}`); } catch (err) { }
    }
  }, 200, true));

  function exitEditable() {
    el.style.whiteSpace = "normal";
    el.setAttribute("contenteditable", "false");
    el.classList.remove("editable");
    offEl(el, "keyup");
    offEl(el, "keydown");
    offEl(el, "mousedown");
    setTimeout(function () {
      el.style.whiteSpace = "";
    }, 33);
  }
}

/* enableSubFolderNameEditable（bundle 22077-22175 逐字）：子文件夹行内重命名——keydown 27
   还原**无 span 包裹**（与图片版差异原样）+ blur debounce 500ms immediate + selectFolder
   经 scope 解析（machinery 版）；exitEditable 内嵌闭包。 */
export function machineryEnableSubFolderNameEditable(s: any, event: any, folder: any): void {
  const w = window as any;
  const el = ((event && event.target) || null) as HTMLElement;
  if (!folder) return;
  if (hasClass(el, "editable")) return;
  if (!el) return;

  machinerySelectFolder(s, event, folder);

  var originalName = textEl(el).trim();
  el.setAttribute("contenteditable", "true");
  el.classList.add("editable");
  el.focus();
  setTimeout(function () {
    selectText(el);
    document.execCommand('selectAll', false, null as any);
  }, 50);

  onEl(el, "mousedown", function (event: any) {
    event.stopPropagation();
  });

  onEl(el, "keydown", function (event: any) {
    var keyCode = event.keyCode;
    switch (keyCode) {
      case 13:
        event.preventDefault();
        event.stopPropagation();
        triggerEl(el, "blur");
        break;
      case 27:
        event.preventDefault();
        event.stopPropagation();
        setHtmlEl(el, `${originalName}`);
        exitEditable();
        break;
      case 65:
        if (event.metaKey || event.ctrlKey) {
          event.preventDefault();
          event.stopPropagation();
          document.execCommand('selectAll', false, null as any);
        }
        break;
    }
  });

  onEl(el, "paste", function (e: any) {
    e.preventDefault();
    var text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
    document.execCommand("insertHTML", false, text);
  });

  onEl(el, "click", function (event: any) {
    event.stopPropagation();
  });

  onEl(el, "blur", w.debounce(function () {
    exitEditable();
    var $scope = getBodyScope();
    var newName = textEl(el);
    if (!newName || !newName.trim()) {
      setHtmlEl(el, `${originalName}`);
      return;
    }
    if (newName !== originalName && folder) {

      var name = newName;
      name = name.substr(0, getRemainingFilenameLength()($scope.libraryPath));
      name = getSanitize()(name).replace(/%/g, "").replace(/&lt;/g, "").replace(/&gt;/g, "").trim();
      name = unescape(name);

      if (emojiRegex.test(name)) {
        name = name.replace(emojiRegex, '');
      }

      setHtmlEl(el, `${name}`);
      folder.name = name;
      $scope.saveFolder();
      scopeEvalAsync();
      try { w.electronLog && w.electronLog.info(`[app] Change sub-folder name: ${originalName}(${folder.id}) > ${newName}`); } catch (err) { }
    }
  }, 500, true));

  function exitEditable() {
    el.style.whiteSpace = "normal";
    el.setAttribute("contenteditable", "false");
    el.classList.remove("editable");
    offEl(el, "click");
    offEl(el, "keyup");
    offEl(el, "keydown");
    offEl(el, "mousedown");
    setTimeout(function () {
      el.style.whiteSpace = "";
    }, 33);
  }
}

/* renameImages（bundle 41480-41496 逐字；controller 闭包函数）：多选 OPEN_RENAME 广播 /
   单选 50ms 后 enableImageNameEditable——**bundle 裸 event 引用（41492）→ w.event**
   （$timeout/setTimeout 回调期 window.event，同 bundle 语义） */
export function machineryRenameImages(s: any): void {
  const w = window as any;
  if (s.selected.length > 1) {
    openRenameChannel.emit({
      type: "IMAGE",
      images: s.selected
    });
  }
  else {
    var imageId = s.selected[0].id;
    var $box = q(`#box-${imageId}`);
    if ($box) {
      const boxEl = $box;
      setTimeout(() => {
        machineryEnableImageNameEditable(s, w.event, boxEl.querySelector(".name"));
      }, 50);
    }
  }
}

/* batchRenameFolders（bundle 41631-41639）/ batchRenameSmartFolders（41654-41662）逐字 */
export function machineryBatchRenameFolders(s: any): void {
  var selectedFolders = s.$root.selectedFolders;
  if (selectedFolders.length === 0) return;

  openRenameChannel.emit({
    type: "FOLDER",
    folders: selectedFolders
  });
}

export function machineryBatchRenameSmartFolders(s: any): void {
  var selectedSmartFolders = s.$root.selectedSmartFolders;
  if (selectedSmartFolders.length === 0) return;

  openRenameChannel.emit({
    type: "SMART_FOLDER",
    folders: selectedSmartFolders
  });
}

/* renameTagGroup（bundle 48582-48592 逐字：双 100/200ms focus 双写原样） */
export function machineryRenameTagGroup(s: any, group: any): void {
  const w = window as any;
  s.currentTagGroup = group;
  syncTagManagerFromScope();
  s.newGroupName = group.name;
  syncTagManagerFromScope();
  group.editable = true;
  setTimeout(function () {
    focusEl("#group-input-" + group.id);
    selectEl("#group-input-" + group.id);
  }, 100);
  setTimeout(function () {
    focusEl("#group-input-" + group.id);
    selectEl("#group-input-" + group.id);
  }, 200);
}

/* editTag（bundle 45532-45700 逐字）：swal 单标签重命名 + raw 倒序 tags 替换（ayncsImagesChange/
   hiddenByCurrentFilter w.* 直连）+ TagManager 群组/historyTags 更新（**45615
   angular.copy(originHistoryTags) 自复制 undefined 怪癖原样**）+ folders/smartFolders.conditions
   树替换 + tagsSuggestion 补录 + saveFolder + calculateImageBinding→rebindRefresh +
   $filter('i18n') 经 injector（getFilter）+ $rootScope.notify → s.$root.notify */
export function machineryEditTag(s: any, tag: any): void {
  const w = window as any;
  const TagManager = s.TagManager;
  w.swal({
    title: w.i18n.__("Context.Tag.Edit.Title"),
    html: w.i18n.__("Context.Tag.Edit.Descript"),
    showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
    onOpen: function () {
      setTimeout(function () {
        var input = w.swal.getInput();
        if (input) {
          (input as HTMLInputElement).select();
          (input as HTMLInputElement).focus();
        }
      }, 100);
    },
    width: 400,
    input: 'text',
    inputPlaceholder: w.i18n.__('Context.Tag.Edit.Placeholder'),
    inputValue: tag.name,
    inputValidator: function (value: any) {
      return new Promise(function (resolve: any, reject: any) {
        // if (value && !/[$%^*<>'"\\|?*]+/.test(value)) {
        resolve()
        // } else {
        // reject(i18n.__('Dialog.CreateLibrary.Error'))
        // }
      })
    },
    cancelButtonColor: "#777777",
    confirmButtonText: w.i18n.__("Context.Tag.Edit.Title"),
    cancelButtonText: w.i18n.__("general.cancel"),
  }).then(function (newName: any) {

    if (newName === tag.name) return;

    w.electronLog && w.electronLog.info(`[app] Rename tag: [${tag.name}] > [${newName}]`);
    w.analytics.event('Tag', 'Rename', newName);

    var originTag = structuredClone(tag);

    // 更新所有出现该标签的图片
    var originImages: any[] = [];
    var originImagesTags: any[] = [];
    var changed: any[] = [];

    // $scope.raw.forEach(function(image) {
    for (var rindex = s.raw.length - 1; rindex >= 0; rindex--) {
      var image = s.raw[rindex];
      if (image && image.tags) {
        var idx = image.tags.indexOf(tag.name);
        if (idx !== -1 && newName) {
          originImages.push(image);
          originImagesTags.push(structuredClone(image.tags));
          image.tags[idx] = newName;
          image.tags = [...new Set(image.tags)];
          changed.push(image);
        }
      }
    }
    w.ayncsImagesChange(changed);
    w.hiddenByCurrentFilter(changed);

    // 修改标签群组包含的标签
    var originGroups: any[] = [];
    var originGroupsTags: any[] = [];
    if (TagManager.groups.length > 0) {
      TagManager.groups.forEach(function (group: any) {
        originGroups.push(group);
        originGroupsTags.push(structuredClone(group.tags));
        if (group.tags) {
          var idx = group.tags.indexOf(tag.name);
          if (idx !== -1 && newName) {
            var nidx = group.tags.indexOf(newName);
            if (nidx === -1) {
              group.tags[idx] = newName;
              group.tags = [...new Set(group.tags)];
            }
            else {
              group.tags.splice(idx, 1);
            }
          }
        }
      });
    }

    var originHistoryTags: any = structuredClone(originHistoryTags);
    try {
      if (TagManager.historyTags && TagManager.historyTags.length > 0) {
        var idx = TagManager.historyTags.indexOf(tag.name);
        if (idx !== -1 && newName) {
          var nidx = TagManager.historyTags.indexOf(newName);
          if (nidx === -1) {
            TagManager.historyTags[idx] = newName;
            TagManager.historyTags = [...new Set(TagManager.historyTags)];
          }
          else {
            TagManager.historyTags.splice(idx, 1);
          }
          TagManager.save();
        }
      }
    } catch (err: any) {
      w.electronLog && w.electronLog.error(err.stack || err);
    }

    // 更新所有文件夹智能标签
    var originFolders: any[] = [];
    var originFoldersTags: any[] = [];
    w.eagle.utils.tree.walk(s.folders, 'children', function (folder: any, parent: any) {
      if (folder && folder.tags) {
        var idx = folder.tags.indexOf(tag.name);
        if (idx !== -1 && newName) {
          originFolders.push(folder);
          originFoldersTags.push(structuredClone(folder.tags));
          folder.tags[idx] = newName;
          folder.tags = [...new Set(folder.tags)];
        }
      }
    });

    // 更新智能文件夹的标签属性
    var originConditions: any[] = [];
    var originSmartFolders: any[] = [];
    w.eagle.utils.tree.walk(s.smartFolders, 'children', function (smartFolder: any, parent: any, depth: any) {
      if (!smartFolder.conditions) return;
      originSmartFolders.push(smartFolder);
      originConditions.push(structuredClone(smartFolder.conditions));

      smartFolder.conditions.forEach(function (condition: any) {
        if (!condition.rules) return;
        condition.rules.forEach(function (rule: any) {
          if (rule && rule.property === 'tags') {
            var ruleTags = rule.value;
            if (ruleTags && ruleTags.length > 0) {
              var idx = ruleTags.indexOf(tag.name);
              if (idx !== -1 && newName) {
                rule.value[idx] = newName;
                rule.value = [...new Set(rule.value)];
              }
            }
          }
        });
      });
    });

    s.tagsSuggestion.push({
      value: newName,
      text: newName
    });

    machinerySaveFolder(s);

    tag.name = newName;
    tag.pinyin = w.tinyPinyin.convertToPinyin(tag.name);
    machineryCalculateImageBinding(s, { ignoreSort: true }, function () {
      machineryRebindRefresh(s);
      machineryUpdateSelection(s);
    });

    var message = getFilter()('i18n')("notify.tag.nameChange", [
      { "property": "origin", "value": originTag.name },
      { "property": "new", "value": tag.name }
    ]);
    // 復原
    s.$root.notify({
      message: message,
      duration: 2000,
    });

  }, function () { });
}

/* renameCurrentFolder（bundle 41498-41569 逐字）：F2 重命名五路分流路由——图片
   （多选 renameImages / 详情 inspector-name selectAll）→ 子文件夹（jQuery.Event 合成 +
   enableSubFolderNameEditable）→ 侧栏文件夹（batch/renameFolder）→ 智能文件夹
   （batch/renameSmartFolder）→ 标签（单 editTag / 多 OPEN_RENAME / 空 renameTagGroup
   50ms $timeout） */
export function machineryRenameCurrentFolder(s: any, event: any): void {
  const w = window as any;
  if (s.selected.length > 0 && s.$root.currentFocus !== "sidebar") {
    if (!s.isDetailMode) {
      machineryRenameImages(s);
    }
    else {
      focusEl("#inspector-name");
      setTimeout(() => {
        document.execCommand('selectAll', false, null as any);
      }, 100);
    }
  }
  else if (s.$root.currentFocus !== "sidebar" && s.selectedFolderMappings && Object.keys(s.selectedFolderMappings).length > 0) {
    var nameEl = q(".sub-folder.selected .name");
    if (!nameEl) return;
    var e: any = { target: nameEl, preventDefault: function () { }, stopPropagation: function () { }, stopImmediatePropagation: function () { } };
    let folderId = Object.keys(s.selectedFolderMappings)[0];
    let folder = s.folderMappings[folderId];
    machineryEnableSubFolderNameEditable(s, e, folder);
  }
  else if (!s.isDetailMode && s.currentFolder && s.$root.currentFocus === 'sidebar') {
    event && event.preventDefault();
    if (s.$root.selectedFolders.length > 1) {
      machineryBatchRenameFolders(s);
    }
    else {
      machineryRenameFolder(s, event, s.currentFolder);
    }
  } else if (!s.isDetailMode && s.currentSmartFolder && s.$root.currentFocus === 'sidebar') {
    event && event.preventDefault();
    if (s.$root.selectedSmartFolders.length > 1) {
      machineryBatchRenameSmartFolders(s);
    }
    else {
      machineryRenameSmartFolder(s, event, s.currentSmartFolder);
    }
  } else if (!s.isDetailMode && s.currentTagGroup) {

    // 先檢查是否有選中的標籤
    var selectedTagKeys = machineryGetSelectedTags(s);
    if (selectedTagKeys.length > 0) {
      // 有選中標籤時，重命名標籤
      if (selectedTagKeys.length === 1) {
        // 單個標籤：直接編輯
        var tagName = selectedTagKeys[0];
        var tag = s.tags.find(function (t: any) { return t.name === tagName; });

        if (tag) {
          machineryEditTag(s, tag);
        }

      } else {
        // 多個標籤：批次重命名
        var selectedTags = s.tags.filter(function (tag: any) {
          return !!s.selectedTags[tag.name];
        });

        openRenameChannel.emit({
          type: "TAGS",
          tags: selectedTags.slice()
        });
      }
    } else {
      // 沒有選中標籤時，重命名標籤群組
      const $timeout = getTimeout();
      $timeout && $timeout(function () {
        machineryRenameTagGroup(s, s.currentTagGroup);
      }, 50);
    }
  }

}

/* ── b1-8 fns 表裸引用审计修复：controller 闭包裸调的 machinery 供给面（export 供
   controllerFns fns 表直调——经 ESM 循环依赖，函数声明提升运行时安全；同时接装
   非碰撞 scope 面）── */

/* getAncestorSmartFolders（bundle 42527-42542 逐字：smartFolderMappings 祖先链 +
   electronLog catch 原样） */
export function machineryGetAncestorSmartFolders(s: any, folder: any, folders: any[]): any[] {
  const w = window as any;
  try {
    if (folder.parent && s.smartFolderMappings[folder.parent]) {
      var parent = s.smartFolderMappings[folder.parent];
      if (parent.id != folder.id) {
        folders.push(parent);
        return machineryGetAncestorSmartFolders(s, parent, folders);
      }
    }
    return folders;
  }
  catch (err: any) {
    w.electronLog && w.electronLog.error(err.stack || err);
    return folders;
  }
}

/* calcuteContainFolders 闭包版（bundle 27283-27325 逐字：倒序 folders 计数 +
   foldersMappings 建表（isSelected=filterRules.folder.includes）+ filter 剔 null +
   {containFoldersMappings, containFolders, noFoldersCount} 返回——**与 $scope 版
   （27259，含 containFolders 落 scope）不同体，scope 面不可接装（同名碰撞）**） */
export function machineryCalcuteContainFolders(s: any, data: any): any {
  const w = window as any;
  var foldersCount: any = {};
  var foldersMappings: any = {};
  var noFoldersCount = 0;

  for (var i = data.length - 1; i >= 0; i--) {
    var image = data[i];
    if (image.folders && image.folders.length > 0) {
      image.folders.forEach(function (folder: any) {
        if (!foldersCount[folder]) { foldersCount[folder] = 0 };
        foldersCount[folder]++;
      });
    }
    else {
      noFoldersCount++;
    }
  }

  var folders = Object.keys(foldersCount).map(function (key: any) {
    var folder = s.folderMappings[key];
    if (!folder) return;
    var index = foldersCount[key];

    foldersMappings[key] = {
      id: key,
      isSelected: !!w.eagle.filter.filterRules.folder.includes[key],
      name: folder.name,
      pinyin: folder.pinyin,
      imageCount: foldersCount[key],
      index: index
    };
    return foldersMappings[key];
  });

  folders = folders.filter(function (f: any) {
    return !!f;
  });

  return {
    containFoldersMappings: foldersMappings,
    containFolders: folders,
    noFoldersCount: noFoldersCount
  }
}

/* getFolderParentChilder（bundle 40842-40848 逐字，typo 原样：父级 children / 根层回落） */
export function machineryGetFolderParentChilder(s: any, folder: any): any {
  if (folder.parent && s.folderMappings[folder.parent]) {
    return s.folderMappings[folder.parent].children;
  }
  else {
    return s.folders;
  }
}

/* calcRotateDegree（bundle 36170-36180 逐字：click 分支 shift ±90 / 其余 -90 + 360 归一；
   纯函数无 scope 依赖） */
export function machineryCalcRotateDegree(currentDegree: any, event: any): any {
  var degree = currentDegree;
  if (event.type === "click") {
    degree += event.shiftKey ? 90 : -90;
  }
  else {
    degree -= 90;
  }
  degree = degree % 360;
  if (degree < 0) degree += 360;
  return degree;
}

/* getArroundBox（bundle 35094-35099 逐字：index ±20 窗口 .box 切片）——既有移植版
   5180 行（bundle 35091-35097 锚）承担，此处不再重复 */

/* toggleAllFolders / toggleCurrentLevelFolders（bundle 38730-38748 逐字：树全层 / 当前层
   isExpand 反转 + localStorage eagle.sidebar.folder.expand.* 键逐字 + updateSidebarList；
   与 smart Inners（8006/8017）同构镜像） */
export function machineryToggleAllFolders(s: any, folders: any, isExpand: any): void {
  const w = window as any;
  w.eagle.utils.tree.walk(folders, 'children', function (f: any, parent: any) {
    if (f.isExpand !== isExpand) {
      f.isExpand = isExpand;
      w.localStorage.setItem("eagle.sidebar.folder.expand." + f.id, f.isExpand);
    }
  });
  machineryUpdateSidebarList(s);
}

export function machineryToggleCurrentLevelFolders(s: any, folders: any, isExpand: any): void {
  const w = window as any;
  folders.forEach(function (f: any) {
    if (f.isExpand !== isExpand) {
      f.isExpand = isExpand;
      w.localStorage.setItem("eagle.sidebar.folder.expand." + f.id, f.isExpand);
    }
  });
  machineryUpdateSidebarList(s);
}

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
  // D-1 A-2：updateSelection / zoom 挂载已退役（域内/组件均 import 直调；zoom 主窗口无消费面）
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
