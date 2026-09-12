/**
 * cZ-5：筛选/搜索域——3 通道截肢 + eagle.filter watch 族 12 个 + 2 个 $on 广播处理器接管。
 *
 * - **通道**：keyword-suggestion（23520 → globalKeywords）/ show-and-search（23705 →
 *   show+focus+searchInAll）/ filter-folder（23712 → #folder-search 聚焦）。
 * - **watch 族（34180-34199，12 个）**：file/duration/bpm 的 min/max ×6、shape width/height
 *   ×2（双双就位才 filterContent）、resolution minW/maxW/minH/maxH ×4 → 全部
 *   filterContent()。scope watch 不随通道消亡——按 exp 从 scope.$$watchers 摘除 bundle
 *   watcher 后域内重挂同表达式。
 * - **$on 广播（42371/42375）**：CALCULATE_IMAGE_BINDING → calculateImageBinding(params)；
 *   REBIND_REFRESH → $timeout(500) rebindRefresh(mute)。bundle 仍有多处 $rootScope.$broadcast
 *   发送方（43433/55168/59582 等，未移植代码路径），接收端由本域独占——按 $$listeners 摘除
 *   bundle 处理器后重挂。UPDATE_SELECTION/SAVE_FOLDER 留 cZ-6。
 */

import { getBodyScope, removeChannelListenersBySource } from './appCore';
import { onFilterRuleChange } from '../services/filterService';
import { useListState } from '../store/listState';
import { ipcRenderer } from '../global/eagleGlobals';
import { syncFilterFromScope } from '../store/filterState';

import { machineryOpenQuickSearch } from '../core/keymapActions';
import { syncListFromScope } from '../store/listState';
import { syncToolbarFromScope } from '../store/toolbarState';
// b1-9bz-A 收口：迁移体 contentFilter/search/searchFocus 消费的原 controllerFns 闭包符号
// isInFolder / updateSuggestions 已随 bz-A 归位到 itemDomain / miscDomain；本落点缺 import 时
// 运行期 ReferenceError（与 initLinkVars 缺失同款的静默-catch 陷阱），补齐解析。
import { isInFolder } from './itemDomain';
import { updateSuggestions } from './miscDomain';

import { machineryRgbToHex } from '../utils/color';
import { calculateImageBindingChannel, closeQuickSearchModalChannel, rebindRefreshChannel, resetFilterChannel } from '../global/bus';
import { scopeEvalAsync } from './scopeRuntime';
import { setScrollTop, removeClass } from '../utils/domQuery';

import { machineryUpdateContainerHieght } from '../services/gridService';
import { machineryCalculateImageBinding, machineryRebindRefresh } from './itemDomain';
import { machineryColorSimilarityDistance } from '../utils/color';
import { clickEl, focusEl, selectEl } from '../utils/domQuery';
import { throttle } from '../utils/func';
import { isNumeric } from '../utils/lang';


import { machineryOpenAll } from '../services/folderCoreService';
import { get } from '../utils/lang';
import { machinerySortData } from './itemDomain';
import { machineryConvertToRegexGroup, machineryMatchWithRegexGroup } from './tagManagerDomain';

import { getTimeout, machineryCalls, scopeSingleton } from './machineryInfra';
import { writeScopeField } from './scopeFieldBridge';
import { useItemState } from '../store/itemState';
import { useMiscRawState } from '../store/miscRawState';
import { useFolderState } from '../store/folderState';
import { useBodyState } from '../store/bodyState';
declare const RecentFileManager: any;
declare const UrlStateService: any;
declare const analytics: any;
declare const chineseConvert: any;
declare const eagle: any;
declare const i18n: any;
declare const rectSelecting: any;
let done = false;

function domainTimeout(fn: any, ms?: number): any {
  return setTimeout(() => {
    try { if (typeof fn === 'function') fn(); } finally { try { scopeEvalAsync(); } catch (err) { /* noop */ } }
  }, ms || 0);
}


/* 按事件名摘除 scope $$listener（幂等；返回摘除数） */
function removeScopeListener(evt: string): number {
  let removed = 0;
  try {
    const listeners = useMiscRawState.getState().$$listeners && useMiscRawState.getState().$$listeners[evt];
    if (Array.isArray(listeners)) {
      removed = listeners.length;
      useMiscRawState.getState().$$listeners[evt] = [];
    }
  } catch (err) { /* noop */ }
  return removed;
}

export function takeoverFilterDomain(): void {
  if (done) return;
  done = true;
  const w = window as any;
  const ipc: any = ipcRenderer();
  if (!ipc || typeof ipc.on !== 'function') return;
  const s0probe = (): any => getBodyScope();

  const diag: any = { takenOver: true, removed: {} as Record<string, number>, watchesRemoved: 0, listenersRemoved: {} as Record<string, number> };
  try {
    const ws0 = (s0probe() as any).$watchers || [];
    diag.watchersAtTakeover = ws0.length;
    diag.filterWatchersAtTakeover = ws0.filter((x: any) => typeof x.exp === 'string' && String(x.exp).indexOf('eagle.filter') === 0).length;
  } catch (err) { diag.watchersAtTakeover = 'err:' + String(err).slice(0, 80); }
  w.__eagleFilterDomain = diag;

  // ── 通道截肢 ──
  diag.removed['keyword-suggestion'] = removeChannelListenersBySource(ipc, 'keyword-suggestion', [
    'globalKeywords = keywords',
  ]);
  diag.removed['show-and-search'] = removeChannelListenersBySource(ipc, 'show-and-search', [
    'searchInAll()',
  ]);
  diag.removed['filter-folder'] = removeChannelListenersBySource(ipc, 'filter-folder', [
    'folder-search',
  ]);

  // ── 通道重挂（逐字）──
  // keyword-suggestion（23520）
  ipc.on('keyword-suggestion', function (_event: any, keywords: any) {
    if (keywords) {
      writeScopeField('globalKeywords', keywords);
    }
  });

  // show-and-search（23705）
  ipc.on('show-and-search', function (_e: any) {
    const s: any = getBodyScope();
    if (!s) return;
    const currentWindow: any = (w.electron && w.electron.remote && w.electron.remote.getCurrentWindow && w.electron.remote.getCurrentWindow())
      || (w.require && w.require('@electron/remote') && w.require('@electron/remote').getCurrentWindow && w.require('@electron/remote').getCurrentWindow());
    if (currentWindow) {
      currentWindow.show();
      currentWindow.focus();
    }
    machinerySearchInAll();
    scopeEvalAsync();
  });

  // filter-folder（23712）
  ipc.on('filter-folder', function (_event: any) {
    scopeEvalAsync(function () {
      (document.getElementById('folder-search') as HTMLElement | null)?.focus();
    });
  });

  // ── toggleFilter（30898 逐字；b1-9k 补端口——Toolbar 筛选按钮 onClick=call('toggleFilter')，
  //    缺席时 call() 静默 no-op → 按钮 active 不翻转、FilterItems2 消费的 filterIsOpen 恒 false。
  //    updateContainerHieght 为 controllerFns 移植件（bundle 原码 typo 逐字保留））──
  {
    writeScopeField('toggleFilter', function () {
      w.eagle.filter.isOpen = !w.eagle.filter.isOpen;
      syncFilterFromScope();
      if (!w.eagle.filter.isOpen) {
        document.querySelectorAll("[filter-item].open").forEach((el) => el.classList.remove("open"));
      }
      machineryUpdateContainerHieght(true);
      if (w.eagle.filter.isOpen) { w.electronLog && w.electronLog.info("[app] Filter: ON"); }
      else { w.electronLog && w.electronLog.info("[app] Filter: OFF"); }
    });
  }

  // ── eagle.filter watch 族 12 个（b1-9bi：scopeShim 轮询 watcher → filterService 订阅）──
  // 原 12 个字符串 watcher（file/duration/bpm min/max ×6、shape ×2、resolution ×4）随
  // bundle 摘除已无对端竞争，轮询式变更探测由 filterService 的显式写通知替代；
  // shape 双条件（width && height 才 filterContent）原语义保留。1m1 的 a7 契约同步改为
  // 「scope 零 watcher + 订阅在」（diag.ruleSubscribed）。
  onFilterRuleChange((group: string, _key: string) => {
    if (group === 'shape') {
      const shape = w.eagle.filter.filterRules.shape || {};
      if (shape.width && shape.height) machineryFilterContent();
      return;
    }
    machineryFilterContent();
  });
  diag.ruleSubscribed = true;

  // keyword watcher（bundle 33653 → listState 订阅；keyword 已是委托字段——scope 写经
  // 委托进 store，store 订阅即全量触发面；变更差值守卫对齐原 watcher 的 last 比较语义）
  {
    useListState.subscribe((state: any, prev: any) => {
      if (state && prev && state.keyword !== prev.keyword) {
        search(state.keyword);
      }
    });
    diag.keywordSubscribed = true;
  }

  // ── $on 广播处理器（摘 bundle → 域内重挂；发送方仍在 bundle 未移植路径）──
  { // E1c：原以 $on 存在性判就绪；CALCULATE_IMAGE_BINDING/REBIND_REFRESH 已迁 eagleBus
    diag.listenersRemoved['CALCULATE_IMAGE_BINDING'] = removeScopeListener('CALCULATE_IMAGE_BINDING');
    calculateImageBindingChannel.on(function (params: any) {
      machineryCalculateImageBinding(params);
    });

    diag.listenersRemoved['REBIND_REFRESH'] = removeScopeListener('REBIND_REFRESH');
    rebindRefreshChannel.on(function (mute: any) {
      domainTimeout(function () {
        machineryRebindRefresh(mute, undefined, undefined);
      }, 500);
    });
  }
}

// ═══ b1-9bz-A：controllerFns 表体归位（逐字平移；getScope()→getBodyScope()；表项指针化）═══
// —— controllerFns 模块级声明随迁（verbatim；按原声明顺序防 TDZ）——
const EagleConfig: any = (window as any).EagleConfig || {};

const DATE_1_DAY = 86400000;

const DATE_7_DAY = 86400000 * 7;

const DATE_30_DAY = 86400000 * 30;

const DATE_90_DAY = 86400000 * 90;

const DATE_365_DAY = 86400000 * 365;

const AUDIO_TYPES: any = {}; (EagleConfig.AUDIO_FORMATS || []).forEach(function (ext: string) { AUDIO_TYPES[ext] = true; });

const FONT_TYPES: any = {}; (EagleConfig.FONT_FORMATS || []).forEach(function (ext: string) { FONT_TYPES[ext] = true; });

const $timeout: any = (fn: any, ms?: number) => setTimeout(() => {
  try { if (typeof fn === 'function') fn(); } finally { try { scopeEvalAsync(); } catch (err) { /* noop */ } }
}, ms || 0);
// b1-9bz-A 收口：`$timeout.cancel(timer)` 是 Angular 注入服务的第二形态，被 60+ 处移植代码
// 消费（__lv_keywordModelTimeout / __lv_nextTimeout / __lv_calculateImageBindingTimeout …）。
// 本落点此前只提供调用形态 → search 首行 `$timeout.cancel is not a function` 即抛，异常经
// calculateImageBinding 的 catch（electronLog 缺席时静默）吞掉 → boot 链 openAll→reload→
// listDone 永不闭合（35/55 挂）。语义取「取消延时执行」（不涉 Angular promise/$apply 未决异常）。
$timeout.cancel = function (timer: any): boolean {
  if (timer === null || timer === undefined) return false;
  try { clearTimeout(timer); } catch (err) { /* noop */ }
  return true;
};

// —— link 级共享态（原 makeControllerFns 闭包声明）——
var __lv_ext: any;
var __lv_image: any;
var __lv_keywordModelTimeout: any;
var __lv_now: any;
var __lv_searchTimeout: any;

let lvInited = false;
const initLinkVars = () => {
  if (lvInited) return;
  lvInited = true;
};

const getScope = getBodyScope;  // b1-9bz-A：原 makeControllerFns(getScope) 注入的等价别名

export function calculateDateFilter(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {

            eagle.filter.filterCounts.import = {
                'today': 0,
                'yesterday': 0,
                '7day': 0,
                '30day': 0,
                '90day': 0,
                '365day': 0,
                "year/month": {},
            };

            eagle.filter.filterCounts.mtime = {
                'today': 0,
                'yesterday': 0,
                '7day': 0,
                '30day': 0,
                '90day': 0,
                '365day': 0,
                "year/month": {},
            };

            let __lv_now = Date.now();
            let today = new Date();
            today.setHours(0,0,0);
            let todayTime = today.getTime();
            let yesterdayTime = todayTime - DATE_1_DAY;

            for (let i = 0; i < s.allData.length; i++) {
                const __lv_image = s.allData[i];
                if (__lv_image.modificationTime > todayTime) eagle.filter.filterCounts['import']['today']++;
                else if (__lv_image.modificationTime < todayTime && __lv_image.modificationTime > yesterdayTime) eagle.filter.filterCounts['import']['yesterday']++;
                if (__lv_now - __lv_image.modificationTime < DATE_7_DAY) eagle.filter.filterCounts['import']['7day']++;
                if (__lv_now - __lv_image.modificationTime < DATE_30_DAY) eagle.filter.filterCounts['import']['30day']++;
                if (__lv_now - __lv_image.modificationTime < DATE_90_DAY) eagle.filter.filterCounts['import']['90day']++;
                if (__lv_now - __lv_image.modificationTime < DATE_365_DAY) eagle.filter.filterCounts['import']['365day']++;

                let importDate = new Date(__lv_image.modificationTime);
                let importYear = importDate.getFullYear();
                let importMonth = ("" + (importDate.getMonth() + 1)).padStart(2, "0");
                let dateObj = eagle.filter.filterCounts['import']['year/month'];
                let dateKey = `${importYear}/${importMonth}`;
                if (importYear) {
                    if (!dateObj[dateKey]) {
                         dateObj[dateKey] = 0;
                    }
                    dateObj[dateKey]++;
                }

                // 修改时间
                var mtime = __lv_image.mtime || __lv_image.modificationTime;
                if (mtime) {
                    if (mtime > todayTime) eagle.filter.filterCounts['mtime']['today']++;
                    else if (mtime < todayTime && mtime > yesterdayTime) eagle.filter.filterCounts['mtime']['yesterday']++;
                    if (__lv_now - mtime < DATE_7_DAY) eagle.filter.filterCounts['mtime']['7day']++;
                    if (__lv_now - mtime < DATE_30_DAY) eagle.filter.filterCounts['mtime']['30day']++;
                    if (__lv_now - mtime < DATE_90_DAY) eagle.filter.filterCounts['mtime']['90day']++;
                    if (__lv_now - mtime < DATE_365_DAY) eagle.filter.filterCounts['mtime']['365day']++;

                    let modifyDate = new Date(mtime);
                    let modifyYear = modifyDate.getFullYear();
                    let modifyMonth = ("" + (modifyDate.getMonth() + 1)).padStart(2, "0");
                    if (modifyYear) {
                        if (!eagle.filter.filterCounts['mtime']['year/month'][`${modifyYear}/${modifyMonth}`]) {
                             eagle.filter.filterCounts['mtime']['year/month'][`${modifyYear}/${modifyMonth}`] = 0;
                        }
                        eagle.filter.filterCounts['mtime']['year/month'][`${modifyYear}/${modifyMonth}`]++;
                    }
                }
            }
        }).apply(null, args);
  }

export function calcuteContainFolders(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (data) {

            var __lv_result = machineryCalcuteContainFolders(data);
            var foldersMappings = __lv_result.containFoldersMappings;
            
            s.containFolders = [];
            syncFilterFromScope();

            if (__lv_result.noFoldersCount > 0) {
                s.containFolders.push({
                    id: "NoFolders",
                    name: i18n.__('general.pages.unfiled'),
                    isNoFolder: true,
                    imageCount: __lv_result.noFoldersCount
                });
                syncFilterFromScope();
            }

            eagle.utils.tree.walk(s.folders, 'children', function (folder, parent, depth) {
                var __lv_folderId = folder.id;
                if (foldersMappings[__lv_folderId]) {
                    s.containFolders.push(foldersMappings[__lv_folderId]);
                    syncFilterFromScope();
                }
            });
        }).apply(null, args);
  }

export function closeQuickSearch(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event) {
            closeQuickSearchModalChannel.emit();
        }).apply(null, args);
  }

export function contentFilter(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(__lv_image) {
            try {
                if (useMiscRawState.getState().selectedSmartFolders.length > 0) {
                    if (__lv_image.isDeleted) return false;
                    for (let i = 0; i < useMiscRawState.getState().selectedSmartFolders.length; i++) {
                        let smartFolder = useMiscRawState.getState().selectedSmartFolders[i];
                		if (machineryExistInSmartFilter(smartFolder, __lv_image)) {
                            return true;
                        }
                    }
                    return false;
                }
                else if (s.currentSmartFolder) {
                	if (__lv_image.isDeleted) return false;
                	if (s.currentSmartFolder.children && s.currentSmartFolder.children.length === 0 && s.currentSmartFolder.conditions && s.currentSmartFolder.conditions.length === 0) {
                		return false;
                	}
                	else if (s.currentSmartFolder.children && s.currentSmartFolder.children.length > 0 && s.currentSmartFolder.conditions && s.currentSmartFolder.conditions.length === 0) {
                		for (let i = 0; i < s.currentSmartFolder.children.length; i++) {
    	                    let smartFolder = s.currentSmartFolder.children[i];
    	            		if (machineryExistInSmartFilter(smartFolder, __lv_image)) {
    	                        return true;
    	                    }
    	                }
    	                return false;
                	}
                	else {
                		return machineryExistInSmartFilter(s.currentSmartFolder, __lv_image);
                	}
                }
                switch (s.viewMode) {
                    case "all":
                        if (!__lv_image.isDeleted) return true;
                        break;
                    case "unfiled":
                        if (__lv_image.isDeleted) return false;
                        if (!__lv_image.folders || __lv_image.folders.length === 0 || (__lv_image.folders.length === 1 && __lv_image.folders[0] && !s.folderMappings[__lv_image.folders[0]])) {
                            return true;
                        }
                        break;
                    case "untagged":
                        if (__lv_image.isDeleted) return false;
                        if (!__lv_image.tags || __lv_image.tags.length === 0) {
                            return true;
                        }
                        break;
                    case "random":
                        if (!__lv_image.isDeleted) return true;
                        break;
                    case "recent":
                        return (RecentFileManager.isExists(__lv_image));
                        break;
                    case "trash":
                        if (__lv_image.isDeleted) return true;
                        break;
                    default:
                        // 文件夹多选
                        if (useMiscRawState.getState().selectedFolders.length > 0) {
                            if (__lv_image.isDeleted) return false;
                            for (var i = 0; i < useMiscRawState.getState().selectedFolders.length; i++) {
                                var folder = useMiscRawState.getState().selectedFolders[i];
                                if (isInFolder(__lv_image, folder)) {
                                    return true;
                                }
                            }
                        }
                        // 文件夹单选
                        else if (s.currentFolder) {
                            if (__lv_image.isDeleted) return false;
                            if (isInFolder(__lv_image, s.currentFolder)) {
                                return true;
                            }
                            return false;
                        } else if (s.currentTag) {
                            if (__lv_image.isDeleted) return false;
                            return __lv_image.tags.indexOf(s.currentTag) > -1;
                        }
                        return false;
                }
                return false;
            }
            catch (err) {
                return false;
            }
        }).apply(null, args);
  }

export function excludeWithFolder(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (folder) {
            if (eagle.filter.filterRules.folder.excludes[folder.id]) {
                delete eagle.filter.filterRules.folder.excludes[folder.id];
            }
            else {
                eagle.filter.filterRules.folder.excludes[folder.id] = folder;
                delete eagle.filter.filterRules.folder.includes[folder.id];
            }

            if (eagle.filter.folderFilterLogic === "AND") {
                setScrollTop("#filter-folder-list", 0);
            }

            machineryFilterContent();
            machineryCalculateFilterCounts();
            analytics.event('Filter', 'Folder');
        }).apply(null, args);
  }

export function filterContent(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(type) {
            if (!s.isItemBindCalculated) return;
            // 重新计算画面图片列表
            s.shuffle = [];
            machineryRebindRefresh(undefined, s.contentFilterCache);
            scopeEvalAsync();
            setScrollTop("#box-container", 0);
        }).apply(null, args);
  }

export function filterWithColor(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(color, ignoreHistory) {

            if (!color || eagle.filter.filterRules.color.value == color) {
                eagle.filter.filterRules.color.value = undefined;
                eagle.filter.filterRules.color.gray = false;
                s.hexColor = "";
            }
            else if (color === "gray") {
                eagle.filter.filterRules.color.value = undefined;
                eagle.filter.filterRules.color.gray = true;
                s.hexColor = "";
            }
            else {
                eagle.filter.filterRules.color.gray = false;
                eagle.filter.filterRules.color.value = color;
                var hexColor = machineryRgbToHex(eagle.filter.filterRules.color.value[0], eagle.filter.filterRules.color.value[1], eagle.filter.filterRules.color.value[2]);
                // b1-9bj：原 ColorPickerSetColor 随 vendor 退役——自研 picker 经 props 从
                // rules.color.value 派生，此处写面即外部同步
                if (hexColor.length > 6) {
                    s.hexColor = hexColor;
                }
            }
            eagle.filter.isOpen = true;
            syncFilterFromScope();
            s.isDetailMode = false;
            machineryUpdateContainerHieght();
            s.page = 1;

            // Add URL state management for color filtering
            if (!ignoreHistory && (eagle.filter.filterRules.color.value || eagle.filter.filterRules.color.gray)) {
                var colorValue = eagle.filter.filterRules.color.gray ? "gray" : eagle.filter.filterRules.color.value;
                UrlStateService.setState({ 
                    view: 'color', 
                    color: colorValue,
                    folder: null, 
                    smartfolder: null, 
                    tag: null 
                });
            }

            $timeout(function () {
                machineryFilterContent();
                machineryCalculateFilterCounts();
            }, 50);
            analytics.event('Filter', 'Color');
        }).apply(null, args);
  }

export function filterWithFolder(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (folder) {

            if (eagle.filter.filterRules.folder.excludes[folder.id]) {
                excludeWithFolder(folder);
                return;
            }

            if (eagle.filter.filterRules.folder.includes[folder.id]) {
                delete eagle.filter.filterRules.folder.includes[folder.id];
            }
            else {
                eagle.filter.filterRules.folder.includes[folder.id] = folder;
                delete eagle.filter.filterRules.folder.excludes[folder.id];
            }

            if (eagle.filter.folderFilterLogic === "AND") {
                eagle.filter.filterFolderKeyword = "";
                syncFilterFromScope();
                setScrollTop("#filter-folder-list", 0);
            }

            machineryFilterContent();
            machineryCalculateFilterCounts();
            analytics.event('Filter', 'Folder');
        }).apply(null, args);
  }

export function filterWithHexColor(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(hex) {
            if (hex.length === 6 && !hex.startsWith("#") && /^[0-9A-F]{6}$/i.test(hex) ) {
                hex = "#" + hex;
                s.hexColor = hex;
            }
            if (hex && hex.length == 7) {
                var rgb = hexToRGB(hex);
                filterWithColor(rgb);
            }
            else if (hex && hex == "gray") {
                filterWithColor("gray");
            }
        }).apply(null, args);
  }

export function getDateFilterCountsArray(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (type) {
            try {
                var arr = [];
                Object.keys(eagle.filter.filterCounts[type]['year/month']).forEach(function (key) {
                    arr.push({
                        key: key,
                        value: eagle.filter.filterCounts[type]['year/month'][key]
                    })
                });
                return arr;
            }
            catch (err) {
                return [];
            }
        }).apply(null, args);
  }

export function hexToRGB(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(hex, alpha) {
            var r = parseInt(hex.slice(1, 3), 16),
                g = parseInt(hex.slice(3, 5), 16),
                b = parseInt(hex.slice(5, 7), 16);
            return [r, g, b];
        }).apply(null, args);
  }

export function openQuickSearch(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版等价，统一转发消除重复实现。
   // 原 c3 体的 scope 守卫，逐字保留
  machineryOpenQuickSearch();
}

export function resetFilter(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            eagle.filter.isLock = false;
            syncFilterFromScope();
            eagle.filter.filterBadge = 0;
            syncListFromScope();

            eagle.filter.resetFilterRules();

            s.containTags = [];
            syncFilterFromScope();
            s.containFolders = [];
            syncFilterFromScope();

            eagle.filter.filterRules.import.selectedMonths = {};
            eagle.filter.filterRules.mtime.selectedMonths = {};

            removeClass("[filter-item].open", "open");
            s.startCursor = 0;
            resetFilterChannel.emit();
            machineryCalculateFilterCounts();
        }).apply(null, args);
  }

export function search(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            $timeout.cancel(__lv_keywordModelTimeout);
            __lv_keywordModelTimeout = $timeout(function () {
                if (s.keyword === undefined) return;
                if (s.viewMode !=='alltags') {
                    var keyword = s.keyword.toLowerCase();
                    s.isContainAlphabet = keyword.match(/^[A-Za-z0-9]+$/);
                    
                    // 使用新的解析函數支援 OR 語法
                    let keywordStr = s.keyword; // 保留原始大小寫以識別 OR
                    s.keywords = parseKeywordsWithOR(keywordStr);
                    
                    // 將所有關鍵字轉為小寫（但保留結構）
                    s.keywords = s.keywords.map(kw => {
                        if (Array.isArray(kw)) {
                            return kw.map(k => k.toLowerCase());
                        } else {
                            return kw.toLowerCase();
                        }
                    });

                    // 處理繁簡體轉換
                    if (keyword && !s.isContainAlphabet) {
                        // 需要處理 OR 群組的繁簡體轉換
                        s.keywords_cn = s.keywords.map(kw => {
                            if (Array.isArray(kw)) {
                                // OR 群組
                                return kw.map(k => {
                                    // 移除雙引號後進行轉換
                                    let cleanK = k.replace(/"/g, '');
                                    let converted = chineseConvert.tw2cn(cleanK);
                                    // 如果原本有雙引號，加回去
                                    return k.startsWith('"') ? `"${converted}"` : converted;
                                });
                            } else {
                                // 單一關鍵字
                                let cleanK = kw.replace(/"/g, '');
                                let converted = chineseConvert.tw2cn(cleanK);
                                return kw.startsWith('"') ? `"${converted}"` : converted;
                            }
                        });
                        
                        s.keywords_tw = s.keywords.map(kw => {
                            if (Array.isArray(kw)) {
                                // OR 群組
                                return kw.map(k => {
                                    let cleanK = k.replace(/"/g, '');
                                    let converted = chineseConvert.cn2tw(cleanK);
                                    return k.startsWith('"') ? `"${converted}"` : converted;
                                });
                            } else {
                                // 單一關鍵字
                                let cleanK = kw.replace(/"/g, '');
                                let converted = chineseConvert.cn2tw(cleanK);
                                return kw.startsWith('"') ? `"${converted}"` : converted;
                            }
                        });
                    }
                    else {
                        s.keywords_cn = [];
                        s.keywords_tw = [];
                    }
                    
                    // 清除 RegEx 快取，下次搜尋時會重新建立
                    s.searchRegexGroup = null;
                    
                    updateSuggestions();
                    s.startCursor = 0;
                    machineryFilterContent();
                    machineryCalculateFilterCounts();
                }
                else {
                    s.TagManager.renderTagsResult();
                }
                clearTimeout(__lv_searchTimeout);
                __lv_searchTimeout = setTimeout(function () {
                    if (keyword) {
                        analytics.event('Search', 'Keyword', keyword);
                    }
                }, 1000);
            }, s.keywordDebounce);
        }).apply(null, args);
  }

export function searchFocus(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            // 標籤管理模式下，不需要顯示搜尋建議
            if (s.viewMode === 'alltags') {
                s.showSuggestions = false;
                syncToolbarFromScope();
                return;
            }
            if (rectSelecting) return;
            updateSuggestions();
            s.showSuggestions = true;
            syncToolbarFromScope();
        }).apply(null, args);
  }

export function toggleExtFilter(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (__lv_ext) {
            delete eagle.filter.filterRules.type.excludes[__lv_ext];
            if (!eagle.filter.filterRules.type.includes[__lv_ext]) {
                eagle.filter.filterRules.type.includes[__lv_ext] = true;
            }
            else {
                delete eagle.filter.filterRules.type.includes[__lv_ext];
            }
        }).apply(null, args);
  }

export function toggleExtFilterExclude(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (__lv_ext) {
            delete eagle.filter.filterRules.type.includes[__lv_ext];
            if (!eagle.filter.filterRules.type.excludes[__lv_ext]) {
                eagle.filter.filterRules.type.excludes[__lv_ext] = true;
            }
            else {
                delete eagle.filter.filterRules.type.excludes[__lv_ext];
            }
        }).apply(null, args);
  }

export function updateFilterCounts(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版等价（diff 仅参数名 __lv_image/image
  // 与 eagle → w.eagle）。
   // 原 c3 体的 scope 守卫，逐字保留
  machineryUpdateFilterCounts(args[0], args[1], args[2]);
}

export function parseKeywordsWithOR(keywordStr) {
            // 先處理括號表達式
            function parseWithParentheses(str) {
                // 標記化：將字串分解成 tokens
                function tokenize(input) {
                    let tokens = [];
                    let current = '';
                    let inQuotes = false;
                    let quoteChar = '';
                    
                    for (let i = 0; i < input.length; i++) {
                        let char = input[i];
                        let nextChar = input[i + 1];
                        
                        if (!inQuotes && (char === '"' || char === "'")) {
                            inQuotes = true;
                            quoteChar = char;
                            current += char;
                        } else if (inQuotes && char === quoteChar) {
                            inQuotes = false;
                            current += char;
                            tokens.push(current);
                            current = '';
                        } else if (!inQuotes) {
                            if (char === '(' || char === ')') {
                                if (current.trim()) {
                                    tokens.push(current.trim());
                                    current = '';
                                }
                                tokens.push(char);
                            } else if (char === '|' && nextChar === '|') {
                                if (current.trim()) {
                                    tokens.push(current.trim());
                                    current = '';
                                }
                                tokens.push('OR');
                                i++; // 跳過第二個 |
                            } else if (char === ' ') {
                                if (current.trim()) {
                                    // 檢查是否是 OR 或 or
                                    if (current.toUpperCase() === 'OR') {
                                        tokens.push('OR');
                                    } else {
                                        tokens.push(current.trim());
                                    }
                                    current = '';
                                }
                            } else {
                                current += char;
                            }
                        } else {
                            current += char;
                        }
                    }
                    
                    if (current.trim()) {
                        if (current.toUpperCase() === 'OR') {
                            tokens.push('OR');
                        } else {
                            tokens.push(current.trim());
                        }
                    }
                    
                    return tokens;
                }
                
                // 解析 tokens 成表達式樹
                function parseExpression(tokens) {
                    let index = 0;
                    
                    function parseOr() {
                        let left = parseAnd();
                        
                        while (index < tokens.length && tokens[index] === 'OR') {
                            index++; // 消耗 OR
                            let right = parseAnd();
                            left = { type: 'OR', children: [left, right] };
                        }
                        
                        return left;
                    }
                    
                    function parseAnd() {
                        let terms = [];
                        
                        while (index < tokens.length && tokens[index] !== 'OR' && tokens[index] !== ')') {
                            if (tokens[index] === '(') {
                                index++; // 消耗 (
                                let expr = parseOr();
                                if (index < tokens.length && tokens[index] === ')') {
                                    index++; // 消耗 )
                                }
                                terms.push(expr);
                            } else {
                                terms.push({ type: 'TERM', value: tokens[index] });
                                index++;
                            }
                        }
                        
                        if (terms.length === 0) return null;
                        if (terms.length === 1) return terms[0];
                        return { type: 'AND', children: terms };
                    }
                    
                    return parseOr();
                }
                
                let tokens = tokenize(str);
                return parseExpression(tokens);
            }
            
            // 將表達式樹轉換為扁平化的關鍵字陣列
            function flattenExpression(expr) {
                if (!expr) return [];
                
                if (expr.type === 'TERM') {
                    return [expr.value];
                } else if (expr.type === 'OR') {
                    // 收集所有 OR 的子項
                    let orTerms = [];
                    function collectOrTerms(node) {
                        if (node.type === 'OR') {
                            node.children.forEach(collectOrTerms);
                        } else if (node.type === 'TERM') {
                            orTerms.push(node.value);
                        } else if (node.type === 'AND') {
                            // OR 中包含 AND，整個 AND 群組作為一個單位
                            // 例如: dog || (cat black) 中的 (cat black)
                            let andTerms = [];
                            node.children.forEach(child => {
                                if (child.type === 'TERM') {
                                    andTerms.push(child.value);
                                }
                            });
                            orTerms.push(andTerms.join(' ')); // 合併成一個字串
                        }
                    }
                    collectOrTerms(expr);
                    return [orTerms];
                } else if (expr.type === 'AND') {
                    let __lv_result = [];
                    expr.children.forEach(child => {
                        let flattened = flattenExpression(child);
                        __lv_result = __lv_result.concat(flattened);
                    });
                    return __lv_result;
                }
                
                return [];
            }
            
            // 使用新的解析器
            let expr = parseWithParentheses(keywordStr);
            let keywords = flattenExpression(expr);
            
            return keywords;
        }


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
export function machineryCalcuteContainFolders(data: any): any {
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
    var folder = useItemState.getState().folderMappings[key];
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


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
export const FILTER_ID_MAP: any = {
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

export let calculateFilterCountsTimeout: any = null;

let filterCache: any = null;

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

export function machineryCalculateFilterCounts(): void {
  const w = window as any;
  clearTimeout(calculateFilterCountsTimeout);
  calculateFilterCountsTimeout = setTimeout(function () {
    console.time("calculateFilterCounts");
    w.eagle.filter.resetFilterCounts();
    let now = Date.now();
    for (let i = 0; i < useItemState.getState().allData.length; i++) {
      const image = useItemState.getState().allData[i];
      machineryUpdateFilterCounts(image, 1, now);
    }
    console.timeEnd("calculateFilterCounts");
    scopeEvalAsync();
  }, 500);
}

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

/* calcuteFilterResult（bundle 27634-27653 逐字） */
export async function machineryCalcuteFilterResult(data: any[], contentFilterCache: any): Promise<any[]> {
  writeScopeField('colorDistancesMap', {});
  return new Promise<any[]>(async (resolve, reject) => {
    try {
      let result: any[];
      if (contentFilterCache) {
        result = contentFilterCache.slice(0);
      }
      else {
        result = useItemState.getState().raw.filter((x: any) => machineryContentFilter(x));
        writeScopeField('contentFilterCache', result.slice(0));
      }
      const filtered = await machineryFilterData(result);
      resolve(filtered);
    } catch (err) {
      reject(err);
    }
  });
}

/* colorFilter（bundle 32689-32781 逐字） */
export function machineryColorFilter(image: any): boolean {
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
                    useMiscRawState.getState().colorDistancesMap[image.id] = 0.01;
                    return true;
                }
            }
            catch (err) {}
        }

        // 使用 YUV 相似模型计算 （ 0 ~ 1 ）
        if (ratio0 > 33) {
            let d1 = machineryColorSimilarityDistance(w.eagle.filter.filterRules.color.value, image.palettes[0].color);
            if (d1.d2000 < acceptAccuracy1 && d1.d76 < acceptAccuracy1 + 50) {
                useMiscRawState.getState().colorDistancesMap[image.id] = d1.d76;
                return true;
            }
            if (ratio0 > 50) {
                let white_d = machineryColorSimilarityDistance(white, image.palettes[0].color);
                if (white_d.d2000 < 5) {
                    if (image.palettes[1] && image.palettes[1].ratio > 8) {
                        let d2 = machineryColorSimilarityDistance(w.eagle.filter.filterRules.color.value, image.palettes[1].color);
                        if (d2.d2000 < acceptAccuracy1 && d2.d76 < acceptAccuracy1 + 50) {
                            useMiscRawState.getState().colorDistancesMap[image.id] = d2.d76 + 5;
                            return true;
                        }
                    }
                }
            }
        }
        if (image.palettes[1] && image.palettes[1].ratio > 33) {
            let d2 = machineryColorSimilarityDistance(w.eagle.filter.filterRules.color.value, image.palettes[1].color);
            if (d2.d2000 < acceptAccuracy1 && d2.d76 < acceptAccuracy1 + 50) {
                useMiscRawState.getState().colorDistancesMap[image.id] = d2.d76;
                return true;
            }
        }

        // 自定义主色
        for (var i = 0; i < image.palettes.length; i++) {
            var palette = image.palettes[i];
            if (palette.marked) {
                var md = machineryColorSimilarityDistance(w.eagle.filter.filterRules.color.value, palette.color);
                if (md.d2000 < 30) {
                    useMiscRawState.getState().colorDistancesMap[image.id] = md.d76;
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

export function machineryContentFilter(image: any): boolean {
  const w = window as any;
  try {
    if (useMiscRawState.getState().selectedSmartFolders.length > 0) {
      if (image.isDeleted) return false;
      for (let i = 0; i < useMiscRawState.getState().selectedSmartFolders.length; i++) {
        let smartFolder = useMiscRawState.getState().selectedSmartFolders[i];
        if (machineryExistInSmartFilter(smartFolder, image)) {
          return true;
        }
      }
      return false;
    }
    else if (useFolderState.getState().currentSmartFolder) {
      if (image.isDeleted) return false;
      if (useFolderState.getState().currentSmartFolder.children && useFolderState.getState().currentSmartFolder.children.length === 0 && useFolderState.getState().currentSmartFolder.conditions && useFolderState.getState().currentSmartFolder.conditions.length === 0) {
        return false;
      }
      else if (useFolderState.getState().currentSmartFolder.children && useFolderState.getState().currentSmartFolder.children.length > 0 && useFolderState.getState().currentSmartFolder.conditions && useFolderState.getState().currentSmartFolder.conditions.length === 0) {
        for (let i = 0; i < useFolderState.getState().currentSmartFolder.children.length; i++) {
          let smartFolder = useFolderState.getState().currentSmartFolder.children[i];
          if (machineryExistInSmartFilter(smartFolder, image)) {
            return true;
          }
        }
        return false;
      }
      else {
        return machineryExistInSmartFilter(useFolderState.getState().currentSmartFolder, image);
      }
    }
    switch (useBodyState.getState().viewMode) {
      case "all":
        if (!image.isDeleted) return true;
        break;
      case "unfiled":
        if (image.isDeleted) return false;
        if (!image.folders || image.folders.length === 0 || (image.folders.length === 1 && image.folders[0] && !useItemState.getState().folderMappings[image.folders[0]])) {
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
        if (useMiscRawState.getState().selectedFolders.length > 0) {
          if (image.isDeleted) return false;
          for (var i = 0; i < useMiscRawState.getState().selectedFolders.length; i++) {
            var folder = useMiscRawState.getState().selectedFolders[i];
            if (isInFolder(image, folder)) {
              return true;
            }
          }
        }
        // 文件夹单选
        else if (useFolderState.getState().currentFolder) {
          if (image.isDeleted) return false;
          if (isInFolder(image, useFolderState.getState().currentFolder)) {
            return true;
          }
          return false;
        } else if (useMiscRawState.getState().currentTag) {
          if (image.isDeleted) return false;
          return image.tags.indexOf(useMiscRawState.getState().currentTag) > -1;
        }
        return false;
    }
    return false;
  }
  catch (err) {
    return false;
  }
}

/* existInSmartFilter（bundle 32091-32116 逐字；递归 parent 链） */
export function machineryExistInSmartFilter(smartFolder: any, image: any): boolean {
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
    let parent = useItemState.getState().smartFolderMappings[smartFolder.parent];
    if (parent) {
      return machineryExistInSmartFilter(parent, image);
    }
    else {
      return true;
    }
  }
  catch (err) {
    return false;
  }
}

export function machineryFilterContent(type?: any): void {
  machineryCalls.filterContent++;
  const w = window as any;
  // b1-9by-B：规则流汇聚点——eagle.filter 规则深变异经本函数收口后直推 filter 快照
  syncFilterFromScope();
  if (!useMiscRawState.getState().isItemBindCalculated) return;
  // 重新计算画面图片列表
  writeScopeField('shuffle', []);
  machineryRebindRefresh(undefined, useMiscRawState.getState().contentFilterCache);
  scopeEvalAsync();
  setScrollTop("#box-container", 0);
  void type;
}

/* filterData（bundle 27654-28504 装配；三分片顺序执行） */
export async function machineryFilterData(data: any[]): Promise<any[]> {
  const w = window as any;
  data = machineryFilterDataPart1(w, data);
  data = machineryFilterDataPart2(w, data);
  data = await machineryFilterDataPart3(w, data);
  return data;
}

function machineryFilterDataPart1(w: any, data: any[]): any[] {

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

function machineryFilterDataPart2(w: any, data: any[]): any[] {

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
    data = data.filter((x: any) => machineryColorFilter(x));
  }

  // 黑白图片过滤
  if (w.eagle.filter.filterRules.color.gray) {
    console.time("grayColorFilter");
    data = data.filter((x: any) => machineryGrayColorFilter(x));
    console.timeEnd("grayColorFilter");
  }

  if (w.eagle.filter.filterRules.color.value && useBodyState.getState().viewMode !== "random") {
    data = data.sort(function (a: any, b: any) {
      var da = useMiscRawState.getState().colorDistancesMap[a.id] || 100;
      var db = useMiscRawState.getState().colorDistancesMap[b.id] || 100;
      if (da > db) return 1;
      if (da < db) return -1;
      return 0;
    });
  }

  // 关键字筛选
  if (useListState.getState().keyword) {
    console.time("$scope.searchFilter");
    data = data.filter(useMiscRawState.getState().searchFilter);
    console.timeEnd("$scope.searchFilter");
  }

  // 已刪除時間排序
  if (useBodyState.getState().viewMode === 'trash') {
    data = getFilter()('orderBy')(data, function (image: any) {
      if (image.deletedTime) {
        return -image.deletedTime;
      }
      return -image.modificationTime;
    });
  }
  else if (useBodyState.getState().viewMode === 'random') {
    console.time("shuffle");
    if (useItemState.getState().shuffle.length > 0) {
      data = useItemState.getState().shuffle.filter(function (item: any) {
        return useItemState.getState().itemMappings[item.id] && !useItemState.getState().itemMappings[item.id].isDeleted;
      });
    }
    else {
      (data as any).shuffle();
      writeScopeField('shuffle', data);
    }
    console.timeEnd("shuffle");
  }

  writeScopeField('preelaborations', []);
  if (w.eagle.filter.filterBadge > 0) {
    if (w.eagle.filter.folderFilterLogic === "OR" || w.eagle.filter.tagFilterLogic === "OR") {
      data.forEach(function (image: any) {
        useMiscRawState.getState().preelaborations.push(image);
      });
    }
    else {
      writeScopeField('preelaborations', data);
    }
  }
  else {
    writeScopeField('preelaborations', data);
  }

  return data;
}

/* focusSeach（bundle 29192-29195 逐字，typo 原样） */
export function machineryFocusSeach(): void {
  const w = window as any;
  focusEl("#search"); selectEl("#search");
  writeScopeField('showSuggestions', true);
  syncToolbarFromScope();
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

export function machineryOpenFilter(): void {
  const w = window as any;
  if (!w.eagle.filter.isOpen) {
    w.eagle.filter.isOpen = true;
    syncFilterFromScope();
    machineryUpdateContainerHieght(true);
  }
}

/* searchInAll（bundle 29201-29205 逐字：openAll(true) + focusSeach **typo 逐字**） */
export function machinerySearchInAll(): void {
  machineryOpenAll(true, function () {
    machineryFocusSeach();
  });
}

export function machineryToggleFilterByType(): any {
  const w = window as any;
  return throttle(function (filterType: any, event: any) {
    event && event.preventDefault();

    // 特殊處理：image 篩選器需要檢查 AI 搜尋
    if (filterType === 'image' && !w.eagle.aiSearch.isInstalled) {
      w.eagle.aiSearch.open();
      return;
    }

    machineryOpenFilter();
    const filterId = FILTER_ID_MAP[filterType];
    if (filterId) {
      clickEl("#" + filterId);
    }
  }, 300);
}

export function machineryUpdateFilterCounts(image: any, inc: any, now: any): void {
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

let shimFilterInst: any = null;


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
export function getToggleFilterByTypeFn(): any { return scopeSingleton('toggleFilterByType', () => machineryToggleFilterByType()); }

// ── c14b 域内自管（原 controller 闭包 var：27004/27005）──
let imageSearchController: any = null;

export async function machineryFilterDataPart3(w: any, data: any[]): Promise<any[]> {

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
        useMiscRawState.getState().preelaborations.forEach(function (image: any) {
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
  if (Object.keys(useItemState.getState().lockedImages).length > 0) {
    data = data.filter(useMiscRawState.getState().lockImageFilter);
  }

  // 文件夹有自己的排序方式
  if (!useMiscRawState.getState().selectedFolders.length && useFolderState.getState().currentFolder && useFolderState.getState().currentFolder.orderBy) {
    if (useMiscRawState.getState().orderBy !== "IMPORT" || useFolderState.getState().currentFolder.orderBy !== useMiscRawState.getState().orderBy) {
      data = machinerySortData(data, useFolderState.getState().currentFolder.orderBy);
    }
    if (!useFolderState.getState().currentFolder.sortIncrease) {
      data = data.reverse();
    }
  }

  // 智能文件夹有自己的排序方式
  else if (useFolderState.getState().currentSmartFolder && useFolderState.getState().currentSmartFolder.orderBy) {
    if (useFolderState.getState().currentSmartFolder.orderBy !== useMiscRawState.getState().orderBy || useFolderState.getState().currentSmartFolder.orderBy === "RANDOM") {
      data = machinerySortData(data, useFolderState.getState().currentSmartFolder.orderBy);
    }
    if (!useFolderState.getState().currentSmartFolder.sortIncrease) {
      data = data.reverse();
    }
  }
  else if (!useMiscRawState.getState().sortIncrease && !w.eagle.filter.filterRules.color.value) {
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

  if (useBodyState.getState().viewMode === 'recent') {
    data = data.sort(function (a: any, b: any) {
      return w.RecentFileManager.recentFilesOrder[a.id] - w.RecentFileManager.recentFilesOrder[b.id];
    });
  }

  return data;
}

function machinerySearchFilter(image: any): any {
    const w = window as any;
    try {
        // 如果還沒有建立 RegEx 群組，先建立
        if (!useMiscRawState.getState().searchRegexGroup) {
            writeScopeField('searchRegexGroup', machineryConvertToRegexGroup(
                useMiscRawState.getState().keywords,
                useMiscRawState.getState().keywords_cn,
                useMiscRawState.getState().keywords_tw
            ));
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

        if (name && useMiscRawState.getState().isSearchScopeName) {
            allText += `${name} `;
        }

        if (ext && useMiscRawState.getState().isSearchScopeExt) {
            allText += `.${ext} `;
        }

        if (url && useMiscRawState.getState().isSearchScopeUrl && useListState.getState().keyword.length >= 2) {
            allText += `${url} `;
        }

        if (annotation && useMiscRawState.getState().isSearchScopeNote) {
            allText += `${annotation} `;
        }

        // 標註
        if (useMiscRawState.getState().isSearchScopeAnnotation && image.comments) {
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

            if (useListState.getState().keyword.length > 2 && image.fontMetas.postScriptName) {
                allText += `${JSON.stringify(image.fontMetas)} `;
            }
        }

        // 標籤
        if (useMiscRawState.getState().isSearchScopeTag && image.tags && image.tags.length > 0) {
            image.tags.forEach(function (tag: any) {
                if (tag) allText += `${tag} `;
            });
        }

        // 資料夾
        if ((useMiscRawState.getState().isSearchScopeFolderDesc || useMiscRawState.getState().isSearchScopeFolderName) &&
            image.folders && image.folders.length > 0) {
            image.folders.forEach(function (folderId: any) {
                var folder = useItemState.getState().folderMappings[folderId];
                if (folder) {
                    if (useMiscRawState.getState().isSearchScopeFolderName && folder.name) {
                        allText += `${folder.name} `;
                    }
                    if (useMiscRawState.getState().isSearchScopeFolderDesc && folder.description) {
                        allText += `${folder.description} `;
                    }
                }
            });
        }

        // 使用 RegEx 群組進行匹配
        const regexMatch = machineryMatchWithRegexGroup(allText.toLowerCase(), useMiscRawState.getState().searchRegexGroup);

        // 如果 regex 已經匹配，直接返回 true
        if (regexMatch) return true;

        // 否則使用 indexOf 進行簡單字串匹配（處理包含特殊字符的情況）
        const keywordForIndexOf = useListState.getState().keyword.toLowerCase();
        return allText.toLowerCase().indexOf(keywordForIndexOf) > -1;
    }
    catch (err) {
        console.error("Search filter error:", err);
    }
    return false;
}

let semanticSearchController: any = null;
