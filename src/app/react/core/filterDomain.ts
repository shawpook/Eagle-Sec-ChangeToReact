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
import { machineryCalcuteContainFolders, machineryOpenQuickSearch } from '../core/dataMachinery';
import { syncListFromScope } from '../store/listState';
import { syncToolbarFromScope } from '../store/toolbarState';
// b1-9bz-A 收口：迁移体 contentFilter/search/searchFocus 消费的原 controllerFns 闭包符号
// isInFolder / updateSuggestions 已随 bz-A 归位到 itemDomain / miscDomain；本落点缺 import 时
// 运行期 ReferenceError（与 initLinkVars 缺失同款的静默-catch 陷阱），补齐解析。
import { isInFolder } from './itemDomain';
import { updateSuggestions } from './miscDomain';
import { machineryCalculateFilterCounts, machineryExistInSmartFilter, machineryRgbToHex, machinerySearchInAll, machineryUpdateContainerHieght } from './dataMachinery';

let done = false;

function domainTimeout(s: any, fn: any, ms?: number): any {
  return setTimeout(() => {
    try { if (typeof fn === 'function') fn(); } finally { try { s.$apply(); } catch (err) { /* noop */ } }
  }, ms || 0);
}


/* 按事件名摘除 scope $$listener（幂等；返回摘除数） */
function removeScopeListener(s: any, evt: string): number {
  let removed = 0;
  try {
    const listeners = s.$$listeners && s.$$listeners[evt];
    if (Array.isArray(listeners)) {
      removed = listeners.length;
      s.$$listeners[evt] = [];
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
    const s: any = getBodyScope();
    if (!s) return;
    if (keywords) {
      s.globalKeywords = keywords;
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
    machinerySearchInAll(s);
    s.$evalAsync();
  });

  // filter-folder（23712）
  ipc.on('filter-folder', function (_event: any) {
    const s: any = getBodyScope();
    if (!s) return;
    s.$evalAsync(function () {
      w.$("#folder-search").focus();
    });
  });

  // ── toggleFilter（30898 逐字；b1-9k 补端口——Toolbar 筛选按钮 onClick=call('toggleFilter')，
  //    缺席时 call() 静默 no-op → 按钮 active 不翻转、FilterItems2 消费的 filterIsOpen 恒 false。
  //    updateContainerHieght 为 controllerFns 移植件（bundle 原码 typo 逐字保留））──
  const s0toggle: any = getBodyScope();
  if (s0toggle) {
    s0toggle.toggleFilter = function () {
      const s: any = getBodyScope();
      if (!s) return;
      w.eagle.filter.isOpen = !w.eagle.filter.isOpen;
      syncFilterFromScope();
      if (!w.eagle.filter.isOpen) {
        w.$("[filter-item].open").removeClass("open");
      }
      machineryUpdateContainerHieght(s, true);
      if (w.eagle.filter.isOpen) { w.electronLog && w.electronLog.info("[app] Filter: ON"); }
      else { w.electronLog && w.electronLog.info("[app] Filter: OFF"); }
    };
  }

  // ── eagle.filter watch 族 12 个（b1-9bi：scopeShim 轮询 watcher → filterService 订阅）──
  // 原 12 个字符串 watcher（file/duration/bpm min/max ×6、shape ×2、resolution ×4）随
  // bundle 摘除已无对端竞争，轮询式变更探测由 filterService 的显式写通知替代；
  // shape 双条件（width && height 才 filterContent）原语义保留。1m1 的 a7 契约同步改为
  // 「scope 零 watcher + 订阅在」（diag.ruleSubscribed）。
  const s0: any = getBodyScope();
  onFilterRuleChange((group: string, _key: string) => {
    const s: any = getBodyScope();
    if (!s) return;
    if (group === 'shape') {
      const shape = w.eagle.filter.filterRules.shape || {};
      if (shape.width && shape.height) s.filterContent();
      return;
    }
    s.filterContent();
  });
  diag.ruleSubscribed = true;

  // keyword watcher（bundle 33653 → listState 订阅；keyword 已是委托字段——scope 写经
  // 委托进 store，store 订阅即全量触发面；变更差值守卫对齐原 watcher 的 last 比较语义）
  if (s0) {
    useListState.subscribe((state: any, prev: any) => {
      if (state && prev && state.keyword !== prev.keyword) {
        const s: any = getBodyScope();
        if (s && typeof s.search === 'function') s.search(state.keyword);
      }
    });
    diag.keywordSubscribed = true;
  }

  // ── $on 广播处理器（摘 bundle → 域内重挂；发送方仍在 bundle 未移植路径）──
  if (s0 && typeof s0.$on === 'function') {
    diag.listenersRemoved['CALCULATE_IMAGE_BINDING'] = removeScopeListener(s0, 'CALCULATE_IMAGE_BINDING');
    s0.$on('CALCULATE_IMAGE_BINDING', function (_e: any, params: any) {
      const s: any = getBodyScope();
      if (!s) return;
      s.calculateImageBinding(params);
    });

    diag.listenersRemoved['REBIND_REFRESH'] = removeScopeListener(s0, 'REBIND_REFRESH');
    s0.$on('REBIND_REFRESH', function (_e: any, mute: any) {
      const s: any = getBodyScope();
      if (!s) return;
      domainTimeout(s, function () {
        s.rebindRefresh(mute);
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
  try { if (typeof fn === 'function') fn(); } finally { try { getBodyScope().$apply(); } catch (err) { /* noop */ } }
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

            var __lv_result = machineryCalcuteContainFolders(s, data);
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
            s.$root.$broadcast('CLOSE_QUICK_SEARCH_MODAL');
        }).apply(null, args);
  }

export function contentFilter(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(__lv_image) {
            try {
                if (s.$root.selectedSmartFolders.length > 0) {
                    if (__lv_image.isDeleted) return false;
                    for (let i = 0; i < s.$root.selectedSmartFolders.length; i++) {
                        let smartFolder = s.$root.selectedSmartFolders[i];
                		if (machineryExistInSmartFilter(s, smartFolder, __lv_image)) {
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
    	            		if (machineryExistInSmartFilter(s, smartFolder, __lv_image)) {
    	                        return true;
    	                    }
    	                }
    	                return false;
                	}
                	else {
                		return machineryExistInSmartFilter(s, s.currentSmartFolder, __lv_image);
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
                        if (s.$root.selectedFolders.length > 0) {
                            if (__lv_image.isDeleted) return false;
                            for (var i = 0; i < s.$root.selectedFolders.length; i++) {
                                var folder = s.$root.selectedFolders[i];
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
                $("#filter-folder-list").scrollTop(0);
            }

            s.filterContent();
            machineryCalculateFilterCounts(s);
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
            s.rebindRefresh(undefined, s.contentFilterCache);
            s.$evalAsync();
            $("#box-container").scrollTop(0);
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
                var hexColor = machineryRgbToHex(s, eagle.filter.filterRules.color.value[0], eagle.filter.filterRules.color.value[1], eagle.filter.filterRules.color.value[2]);
                // b1-9bj：原 ColorPickerSetColor 随 vendor 退役——自研 picker 经 props 从
                // rules.color.value 派生，此处写面即外部同步
                if (hexColor.length > 6) {
                    s.hexColor = hexColor;
                }
            }
            eagle.filter.isOpen = true;
            syncFilterFromScope();
            s.isDetailMode = false;
            machineryUpdateContainerHieght(s);
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
                s.filterContent();
                machineryCalculateFilterCounts(s);
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
                $("#filter-folder-list").scrollTop(0);
            }

            s.filterContent();
            machineryCalculateFilterCounts(s);
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
  const s = getBodyScope();
  if (!s) return;   // 原 c3 体的 scope 守卫，逐字保留
  machineryOpenQuickSearch(s);
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

            $("[filter-item].open").removeClass("open");
            s.startCursor = 0;
            s.$root.$broadcast("Reset_Filter");
            machineryCalculateFilterCounts(s);
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
                    s.filterContent();
                    machineryCalculateFilterCounts(s);
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
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (__lv_image, inc, __lv_now) {

            if (!__lv_image) return;

            try {

                var type = __lv_image.medium || __lv_image.ext;
                var shape;

                if (eagle.filter.filterCounts['type'][type] === undefined) {
                    eagle.filter.filterCounts['type'][type] = 1;
                }
                else {
                    eagle.filter.filterCounts['type'][type]+=inc;
                }

                if (__lv_image.rawMetas) {

                    var camera = __lv_image.rawMetas.camera;
                    if (eagle.filter.filterCounts['camera'][camera] === undefined) {
                        eagle.filter.filterCounts['camera'][camera] = 1;
                        if (!eagle.filter.filterCamerasMapping[camera]) {
                            eagle.filter.filterCamerasMapping[camera] = true;
                            eagle.filter.filterCameras = Object.keys(eagle.filter.filterCamerasMapping);
                            syncFilterFromScope();
                        }
                    }
                    else {
                        eagle.filter.filterCounts['camera'][camera]+=inc;
                    }
                }

                if (__lv_image.fontMetas) {
                    try {
                        var key = Object.keys(__lv_image.fontMetas.postScriptName)[0];
                        var postScriptName = __lv_image.fontMetas.postScriptName && __lv_image.fontMetas.postScriptName[key];
                        if (installedFonts[`${postScriptName}_.${__lv_image.ext}`]) {
                            eagle.filter.filterCounts['fontActivated']['activated']+=inc;
                        }
                        else {
                            eagle.filter.filterCounts['fontActivated']['deactivated']+=inc;
                        }
                    }
                    catch (err) {

                    }
                }

                if (__lv_image.star) {
                    eagle.filter.filterCounts['rating'][__lv_image.star]+=inc;
                }
                else {
                    eagle.filter.filterCounts['rating']['0']+=inc;
                }

                // 形状筛选，只需要针对图片格式进行
                if (__lv_image.width && !AUDIO_TYPES[__lv_image.ext] && !FONT_TYPES[__lv_image.ext] ) {
                    if (__lv_image.width > __lv_image.height) {
                        if (__lv_image.width / __lv_image.height >= 2.5) {
                            shape = "panoramic-landscape";
                        }
                        else {
                            shape = "landscape";
                        }
                        eagle.filter.filterCounts['shape'][shape] += inc;
                    }
                    else if (__lv_image.width < __lv_image.height) {
                        if (__lv_image.height / __lv_image.width >= 2.5) {
                            shape = "panoramic-portrait";
                        }
                        else {
                            shape = "portrait";
                        }
                        eagle.filter.filterCounts['shape'][shape] += inc;
                    }
                    else if (__lv_image.width === __lv_image.height) {
                        shape = "square";
                        eagle.filter.filterCounts['shape'][shape] += inc;
                    }
                    if (__lv_image.width / __lv_image.height === 4 / 3) {
                        shape = "4:3";
                        eagle.filter.filterCounts['shape'][shape] += inc;
                    }
                    else if (__lv_image.width / __lv_image.height === 3 / 4) {
                        shape = "3:4";
                        eagle.filter.filterCounts['shape'][shape] += inc;
                    }
                    else if (__lv_image.width / __lv_image.height === 16 / 9) {
                        shape = "16:9";
                        eagle.filter.filterCounts['shape'][shape] += inc;
                    }
                    else if (__lv_image.width / __lv_image.height === 9 / 16) {
                        shape = "9:16";
                        eagle.filter.filterCounts['shape'][shape] += inc;
                    }
                }

        	}
        	catch (err) {
        	}
        }).apply(null, args);
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
