/**
 * cZ-3a：库加载域（轻量五通道）——initial / app-status-welcome / app-status-library-dirs-loaded /
 * app-status-library-cache-loaded / library.changed 截肢 + React 处理器逐字重挂。
 *
 * - **截肢方式 = 源码签名选择性移除**（removeChannelListenersBySource）：这五个通道上
 *   React 组件已有自给监听（SmallPanels WelcomePage / ProgressDialogs LibraryLoadProgress），
 *   不能 removeAllListeners 整体截肢，只能按 bundle 处理器源码签名精准摘除。
 *   initial / library.changed 上 React 无既有监听，同样走签名移除（保持路径统一）。
 * - **重挂处理器 = bundle 原文逐字转写**（$scope → getBodyScope()，$rootScope → s.$root）：
 *   - initial（22664）：trialRemain/Registration/machineID（module var 经 window.* live binding
 *     回写，bundle 侧 23350 等读取点不变）+ 试用弹窗逻辑（openTrialModal 经原型链可达）+ initMenu。
 *   - app-status-welcome（22631）/ dirs-loaded（22753）/ cache-loaded（22758）：isLoading 翻转 +
 *     initMenu。
 *   - library.changed（23535）：folders/smartFolders 树走查 + mappings 重建 + updateSidebarList +
 *     calculateImageBinding → rebindRefresh。原码 `folder && parent` 中的 parent 即 window.parent
 *     （顶层窗口 === window），逐字保留该行为。
 * - **app-status-loading / app-status-library-loaded / preload-library（cZ-3b）**：
 *   三通道 + background-state 生命周期一并接管（library-loaded 注册 bg 处理器 → heartbeat
 *   启动 → loading 负责清理 heartbeatInterval——单独截肢会留下不可清理的 bundle heartbeat）。
 *   闭合面落点：module var 经 window.* live binding（ig/machineID/backgroundWindowID/
 *   heartbeatStopCount/hardDiskSpeed/dragging/SlowNotify/analytics/RecentFileManager/appRoot/
 *   Registration/customDimesion1）；顶层 function 经 window.*（stopAPIServer/initAPIServer/
 *   startAPIServer/checkBackgroundHeartbeat/ayncsImagesChange）；全局词法 const/let 经
 *   declare const 引用（IPCHelper/ACCESS/PERFORMANCE_MONITOR/isVentura）；controller 闭包内
 *   变量改为域内自管（libraryCache/lazyLoadManager/updateTimer/heartbeatInterval）。
 *   **有意略去（行为等价，均注释标注）**：loading 末尾十个模块同路径重 require（require
 *   缓存返回同一实例）、lastProcessedUrlState 清零（URL 去重 guard，另一写入方仍在）、
 *   allTags = {}（全 bundle 零消费点，死变量）；$http.post 遥测改 $.ajax JSON POST 等价
 *   复刻（原码第三参为误传的成功回调，Angular 按默认配置发送）。
 */

import { getBodyScope, removeChannelListenersBySource } from './appCore';
import { ipcRenderer } from '../global/eagleGlobals';
import { isInFolder } from './itemDomain';
import { syncErrorCount } from '../store/toastState';
import { syncFolderLock } from '../store/lockState';
import { syncListFromScope } from '../store/listState';
import { syncUploadFromScope } from '../store/uploadState';
import { syncPanelFromScope } from '../store/panelState';
import { syncSidebarFromScope } from '../store/sidebarState';
import { syncTagManagerFromScope } from '../store/tagManagerState';
import { syncFilterFromScope } from '../store/filterState';
import { syncBodyFromScope } from '../store/bodyState';
import { syncDetailFromScope } from '../store/detailState';
import { syncInspectorFromScope } from '../store/inspectorState';
import { syncToolbarFromScope } from '../store/toolbarState';
import { openFolder, openSmartFolder } from '../services/folderCoreService';
import { machineryCalculateImageBinding, machineryExistInSmartFilter, machineryFindDupclipate, machineryOpenAll, machineryOpenAllTags, machineryOpenCommunity, machineryOpenRandom, machineryOpenUntagged, machineryRebindRefresh } from './dataMachinery';
import { filterWithColor, resetFilter } from './filterDomain';
import { scrollToSelectedItem } from '../services/batchOpsService';
import { closeTagsPopupChannel, importArtstationChannel, newSmartFolderChannel, openRenameChannel } from '../global/bus';
import { scopeEvalAsync } from '../global/scopeShim';
import { q, cssSet, setTextEl, addClassEl, removeClassEl, hideEl, showEl, addClass, removeClass, focusEl, selectEl } from '../utils/domQuery';
import { machinerySwitchLayout, machineryUpdateContainerHieght, machineryUpdateListHeight } from '../services/gridService';
import { machinerySetViewMode, machineryZoom, machineryCheckOperationSafety2 } from '../services/viewOpsService';
import { callExternal } from './externalSupply';
import { machineryAutoScroll, machineryEditTag, machineryEnableSubFolderNameEditable, machineryFilterSidebarItem, machineryForceFitImageSize, machineryGetSelectedItemElements, machineryGetSelectedTags, machineryGetSelection, machineryLeaveDetailMode, machineryRenameImages, machineryRenameTagGroup, machineryResetPage, machineryUpdateFilterCounts, machineryUpdateSelection, getTimeout } from './dataMachinery';
import { setScrollTop, clickEl, hide } from '../utils/domQuery';
import { glRemoveitemsChannel } from '../global/bus';
import { debounce } from '../utils/func';
declare const ga4track: any;
declare const IPCHelper: any;
declare const ACCESS: any;
declare const PERFORMANCE_MONITOR: any;
declare const isVentura: boolean;
declare const remote: any;

let done = false;

// ── cZ-3b 域内自管的 controller 闭包变量（原 libraryCache/lazyLoadManager/updateTimer/
//    heartbeatInterval 均为 EagleController 闭包内声明，React 不可直写，域内镜像接管）──
let domainLibraryCache: any[] = [];
let domainLazyLoadManager: any = null;
let domainUpdateTimer: any = null;
let domainHeartbeatInterval: any = null;

let filterCache: any = null;
function getFilter(): any {
  if (filterCache) return filterCache;
  try {
    const ang = (window as any).angular;
    if (ang && ang.element && ang.element(document).injector) {
      filterCache = ang.element(document).injector().get('$filter');
    }
  } catch (err) { /* noop */ }
  return filterCache;
}

/* ayncsUpdateSmartFoldersCount（bundle 26291 逐字；controller 闭包内函数 → 域内移植） */
function domainAyncsUpdateSmartFoldersCount(s: any, smartFolders: any, callback: any): void {
  const w = window as any;
  if (!smartFolders || smartFolders.length === 0) return;
  setTimeout(() => {
    let total = smartFolders.length;
    let once = 3;
    let loopCount = total / once;
    let countOfSend = 0;

    function send(): void {
      const start = countOfSend * once;
      const arr = smartFolders.slice(start, start + once);
      countOfSend += 1;

      for (let i = 0; i < arr.length; i++) {
        arr[i].imageCount = machinerySmartFolderCount(s, arr[i]);
        if (!arr[i].pinyin) {
          arr[i].pinyin = w.tinyPinyin.convertToPinyin(arr[i].name);
        }
      }

      scopeEvalAsync();

      loop();
    }

    function loop(): void {
      if (countOfSend < loopCount) {
        window.requestAnimationFrame(send);
      }
      else {
        callback && callback();
      }
    }
    loop();
  }, 30);
}

/* getMemory / digestDurationTest（bundle 22763/22772 逐字；PERFORMANCE_MONITOR 旗标开启才用） */
function domainGetMemory(): void {
  const w = window as any;
  function toMb(bytes: number): string { return (bytes / (1000.0 * 1000)).toFixed(2); }
  let imageUsage: any = { count: 0, liveSize: 0 };
  try {
    const webFrame = w.require && w.require('electron') && w.require('electron').webFrame;
    if (webFrame) imageUsage = webFrame.getResourceUsage().images;
  } catch (err) { /* noop */ }
  try {
    console.log("workingSetSize: ", toMb(w.process.getProcessMemoryInfo().workingSetSize) + "MB");
    console.log("image count: ", imageUsage.count);
    console.log("image liveSize: ", toMb(imageUsage.liveSize) + "MB");
    console.log('------');
  } catch (err) { /* noop */ }
}

function domainDigestDurationTest(s: any): void {
  // b1-9av：本函数为 bundle 时代 digest 诊断（Angular injector 面带守卫）——shim 世界
  // 无 window.angular，守卫恒 clearInterval 空转，非哑雷（勿列入 structuredClone 替换清单）
  const w = window as any;
  const interval = setInterval(function () {
    try {
      if (!(w.angular && w.angular.element && w.angular.element(document).injector)) {
        clearInterval(interval);
        return;
      }
      w.angular.element(document).injector().invoke(function ($rootScope: any) {
        const a = performance.now();
        scopeEvalAsync();
        console.log(`$digest duration: ${performance.now() - a}`);
      });
    } catch (err) { clearInterval(interval); }
  }, 1000);
  void s;
  void w;
}

export function takeoverLibraryDomain(): void {
  if (done) return;
  done = true;
  const w = window as any;
  const ipc: any = ipcRenderer();
  if (!ipc || typeof ipc.on !== 'function') return;

  const diag: any = { takenOver: true, removed: {} as Record<string, number> };
  w.__eagleLibraryDomain = diag;

  // ── 截肢：源码签名精准摘除 bundle 处理器（React 组件自给监听保留）──
  diag.removed['initial'] = removeChannelListenersBySource(ipc, 'initial', [
    'trialRemain = params.trialRemain',
    'lastOpenTrialModalTime',
  ]);
  diag.removed['app-status-welcome'] = removeChannelListenersBySource(ipc, 'app-status-welcome', [
    'libraryPath = "";',
    '$rootScope.initMenu()',
  ]);
  diag.removed['app-status-library-dirs-loaded'] = removeChannelListenersBySource(ipc, 'app-status-library-dirs-loaded', [
    '$scope.isLoading = true',
  ]);
  diag.removed['app-status-library-cache-loaded'] = removeChannelListenersBySource(ipc, 'app-status-library-cache-loaded', [
    '$scope.isLoading = true',
  ]);
  diag.removed['library.changed'] = removeChannelListenersBySource(ipc, 'library.changed', [
    'newLibrary.folders',
    'newLibrary.smartFolders',
  ]);

  const electronLog: any = w.electronLog || console;

  // ── initial（22664 逐字）──
  ipc.on('initial', function (_e: any, params: any) {
    const s: any = getBodyScope();
    if (!s) return;
    s.trialRemain = params.trialRemain;
    syncInspectorFromScope();
    w.Registration = params.Registration;
    s.Registration = params.Registration;
    w.machineID = params.machineID;

    if (params.Registration && params.Registration.machineID !== params.machineID) {
      setTimeout(() => {
        electronLog.info(params.errorMsg);
      }, Math.floor(Math.random() * 200000));
    }
    if (params.machineID == "") {
      setTimeout(() => {
        electronLog.info(params.errorMsg);
      }, Math.floor(Math.random() * 200000));
    }

    console.log(params);
    if (params.Registration && params.Registration.activated) {
      try { ga4track.setUserProperty('paid_user', 'yes'); } catch (err) { /* noop */ }
      w.customDimesion1 = "已激活";
      cssSet("body", {
        "pointer-events": "",
        "opacity": ""
      });
    }
    else {
      w.customDimesion1 = "未激活";
      try { ga4track.setUserProperty('paid_user', 'no'); } catch (err) { /* noop */ }
      // 原 $timeout 语义：延时执行 + digest
      setTimeout(() => {
        try {
          if (s.trialRemain && s.trialRemain > 0 && s.trialRemain < 30) {
            const popupDays = [1, 3, 7, 14, 21, 28];
            if (popupDays.indexOf(s.trialRemain) > -1) {
              let lastOpenTrialModalTime = localStorage["lastOpenTrialModalTime"] || undefined;
              const now = Date.now();
              const HALF_DAY = 1000 * 60 * 60 * 12;
              if (!lastOpenTrialModalTime) {
                lastOpenTrialModalTime = now;
                localStorage["lastOpenTrialModalTime"] = now;
                machineryOpenTrialModal(s, s.trialRemain);
              }
              else {
                lastOpenTrialModalTime = parseInt(lastOpenTrialModalTime);
                if (now - lastOpenTrialModalTime < HALF_DAY) {
                  console.log("12小时内暂时不再跳出");
                  return;
                }
                machineryOpenTrialModal(s, s.trialRemain);
                localStorage["lastOpenTrialModalTime"] = now;
              }
            }
          }
        } finally { try { scopeEvalAsync(); } catch (err) { /* noop */ } }
      }, 1000);
    }
    s.$root.initMenu();
    scopeEvalAsync();
  });

  // ── app-status-welcome（22631 逐字）──
  ipc.on('app-status-welcome', function (_e: any, _params: any) {
    const s: any = getBodyScope();
    if (!s) return;
    scopeEvalAsync(function () {
      s.libraryPath = "";
      syncSidebarFromScope();
      s.isLoading = false;
      s.$root.initMenu();
    });
  });

  // ── app-status-library-dirs-loaded（22753 逐字）──
  ipc.on('app-status-library-dirs-loaded', function (_e: any, _count: any) {
    const s: any = getBodyScope();
    if (!s) return;
    s.isLoading = true;
    scopeEvalAsync();
  });

  // ── app-status-library-cache-loaded（22758 逐字）──
  ipc.on('app-status-library-cache-loaded', function (_e: any) {
    const s: any = getBodyScope();
    if (!s) return;
    s.isLoading = true;
    scopeEvalAsync();
  });

  // ── library.changed（23535 逐字；parent = window.parent，原码行为保留）──
  ipc.on('library.changed', function (_event: any, newLibrary: any) {
    const s: any = getBodyScope();
    if (!s || !newLibrary) return;
    const eagle: any = w.eagle;

    const newFolders = newLibrary.folders;
    eagle.utils.tree.walk(newFolders, 'children', function (folder: any) {

      if (!folder.children) {
        folder.children = [];
      }

      if (folder && parent) {
        folder.parent = (parent as any).id;
      }

      if (s.folderMappings[folder.id]) {
        folder.images = s.folderMappings[folder.id].images;
        folder.isExpand = localStorage.getItem("eagle.sidebar.folder.expand." + folder.id) === "true";
      }
      s.folderMappings[folder.id] = folder;
    });

    s.libraryModificationTime = newLibrary.modificationTime;
    s.folders = newFolders;

    eagle.utils.tree.walk(newLibrary.smartFolders, 'children', function (smartFolder: any) {

      if (!smartFolder.children) { smartFolder.children = []; }

      if (smartFolder && parent) { smartFolder.parent = (parent as any).id; }

      if (s.smartFolderMappings[smartFolder.id]) {
        smartFolder.isExpand = localStorage.getItem("eagle.sidebar.smartFolder.expand." + smartFolder.id) === "true";
      }
      s.smartFolderMappings[smartFolder.id] = smartFolder;
    });

    s.smartFolders = newLibrary.smartFolders || [];

    machineryUpdateSidebarList(s);
    machineryCalculateImageBinding(s, { ignoreSort: true }, function () {
      machineryRebindRefresh(s);
      scopeEvalAsync();
    });
  });

  // ══════ cZ-3b：启动重管线（app-status-loading / app-status-library-loaded / preload-library）══
  // 三通道 + background-state 生命周期一并接管：bundle 的 bg 处理器由 library-loaded 注册，
  // 本片接管后不再注册；过渡期残留的旧注册由 loading 处理器的 removeAllListeners 清理
  // （React uploadState 自愈重挂）。bg-state 通道本身不在本片截肢清单（销毁式清理更安全）。

  diag.removed['app-status-loading'] = removeChannelListenersBySource(ipc, 'app-status-loading', [
    '移除 background-state 监听',
  ]);
  diag.removed['app-status-library-loaded'] = removeChannelListenersBySource(ipc, 'app-status-library-loaded', [
    'findDupclipate',
  ]);
  diag.removed['preload-library'] = removeChannelListenersBySource(ipc, 'preload-library', [
    'concatDakuten',
  ]);
  Object.defineProperties(diag, {
    libraryCacheCount: { get: () => domainLibraryCache.length },
    hasHeartbeat: { get: () => !!domainHeartbeatInterval },
    hasLazyLoadManager: { get: () => !!domainLazyLoadManager },
  });

  // ── preload-library（22789 逐字；libraryCache → 域内自管）──
  ipc.on('preload-library', function (_e: any, params: any) {
    const w = window as any;
    domainLibraryCache = [];
    if (!params || !params.cachePath) return;
    const nfs = w.require && w.require('fs');
    if (!nfs || !nfs.existsSync(params.cachePath)) return;

    const lineByLine = w.require(w.appRoot + '/my_modules/n-readlines');
    console.time("preload-library");

    const liner = new lineByLine(params.cachePath, {
      readChunk: 32768
    });

    const concatDakuten = function (str: any): any {
      if (!str.replace) return;
      const table1 = ['が','ぎ','ぐ','げ','ご','ざ','じ','ず','ぜ','ぞ','だ','ぢ','づ','で','ど','ば','び','ぶ','べ','ぼ','ヴ','ガ','ギ','グ','ゲ','ゴ','ザ','ジ','ズ','ゼ','ゾ','ダ','ヂ','ヅ','デ','ド','バ','ビ','ブ','ベ','ボ','ぱ','ぴ','ぷ','ぺ','ぽ','パ','ピ','プ','ペ','ポ'];
      const table2 = ['が','ぎ','ぐ','げ','ご','ざ','じ','ず','ぜ','ぞ','だ','ぢ','づ','で','ど','ば','び','ぶ','べ','ぼ','ヴ','ガ','ギ','グ','ゲ','ゴ','ザ','ジ','ズ','ゼ','ゾ','ダ','ヂ','ヅ','デ','ド','バ','ビ','ブ','ベ','ボ','は','ひ','ぷ','ぺ','ぽ','パ','ピ','プ','ペ','ポ'];
      let i = 0, ii = table1.length;
      for (; i < ii; i++) {
        str = str.replace(new RegExp(table1[i], 'g'), table2[i]);
      }
      return str;
    };

    void concatDakuten;
    void /(?:)/;
    let line: any;
    const lines: any[] = [];
    while ((line = liner.next())) {
      lines.push(line);
    }
    for (let i = lines.length - 1; i >= 0; i--) {
      const entry = lines[i];
      try {
        const image = JSON.parse(entry);
        if (image.id) {
          domainLibraryCache.push(image);
        }
      }
      catch (e: any) {
        try {
          // 如果偵測到 metadata.json 字串尾端出現異常字串導致無法正常讀取問題時，將自動嘗試修復
          if (e && e.message && e.message.indexOf(" position ") > -1) {
            let position = e.message.split(" position ")[1];
            if (position) {
              position = parseInt(position);
              if (position > 0) {
                const newJSONStr = entry.toString().substr(0, position);
                try {
                  const fixedObj = JSON.parse(newJSONStr);
                  if (fixedObj.id) {
                    domainLibraryCache.push(fixedObj);
                    electronLog.error(`[app] Detect broken JSON string, try to fix it: ${fixedObj.id}`);
                    if (typeof w.ayncsImagesChange === 'function') w.ayncsImagesChange([fixedObj]);
                  }
                }
                catch (err) { /* noop */ }
              }
            }
          }
        }
        catch (err) { /* noop */ }
      }
    }
    console.timeEnd("preload-library");
  });

  // ── app-status-loading（22734 逐字；重 require 段略去 = 同路径 require 缓存命中同一实例）──
  ipc.on('app-status-loading', function () {
    const w = window as any;
    const s: any = getBodyScope();
    if (!s) return;
    if (w.ig && w.ig.clear) w.ig.clear();
    s.isUILoaded = false;
    syncSidebarFromScope();
    s.isItemBindCalculated = false;
    closeTagsPopupChannel.emit();
    s.allData = [];
    syncListFromScope();
    s.isLoading = false;
    s.startCursor = 0;
    if (w.ScrollbarSaver) { w.ScrollbarSaver.positionMapping = {}; }
    scopeEvalAsync();

    clearInterval(w.heartbeatInterval);
    if (domainHeartbeatInterval) { clearInterval(domainHeartbeatInterval); domainHeartbeatInterval = null; }
    ipc.removeAllListeners('background-state');
    if (s.SavedFilter && s.SavedFilter.unwatch) s.SavedFilter.unwatch();
    if (w.eagle && w.eagle.action && w.eagle.action.destroy) w.eagle.action.destroy();
    if (typeof w.stopAPIServer === 'function') w.stopAPIServer();
    console.log("移除 " + "background-state 监听");
    // bundle 22776-22787 逐字：这十个顶层 var 的【首次赋值点】——window.sanitize/tinyPinyin
    // 等是 React 侧 saver（inspectorActions）/ayncsUpdateSmartFoldersCount 的运行时依赖；
    // 截肢后此处若略去，window.sanitize 永远 undefined（shims 3131 注释预警过）。同路径
    // require 命中缓存返回同一实例，重复执行无副作用。
    try {
      w.fse = w.require('fs-extra');
      w.tinyPinyin = w.require(w.appRoot + '/my_modules/tiny-pinyin');
      w.pinyinlite = w.require(w.appRoot + '/my_modules/pinyinlite');
      w.readChunk = w.require('read-chunk');
      w.writeFileAtomic = w.require('write-file-atomic');
      w.cartesianProduct = w.require(w.appRoot + '/my_modules/cartesian-product');
      w.sanitize = w.require(w.appRoot + '/my_modules/sanitize-filename');
      w.unicodeNormalize = w.require('normalize-strings');
      w.chineseConvert = w.require(w.appRoot + '/my_modules/chinese_convert');
      w.colorConvert = w.require('color-convert');
      w.DeltaE = w.require('delta-e');
    } catch (err) { /* noop */ }
  });

  // ── app-status-library-loaded（22857 逐字；落点：module var → window.* live binding、
  //    controller 闭包变量 → 域内自管、全局词法 const → declare 引用；略去项见头注释）──
  ipc.on('app-status-library-loaded', async function (_e: any, params: any) {
    const w = window as any;
    const s: any = getBodyScope();
    if (!s || !params) return;

    const currentWindow: any = (w.electron && w.electron.remote && w.electron.remote.getCurrentWindow && w.electron.remote.getCurrentWindow())
      || (w.require && w.require('@electron/remote') && w.require('@electron/remote').getCurrentWindow && w.require('@electron/remote').getCurrentWindow());
    const req = (name: string) => w.require ? w.require(name) : null;
    const pathMod = req('path');

    if (currentWindow && currentWindow.getTitle() !== 'E' + 'a' + 'g' + 'l' + 'e') {
      ipc.send('quit');
    }

    // be2：v3 兜底实例退役——window.ig = v4 facade（boxGridEngine registerGridRef 装载）
    if (w.ig && w.ig.clear) w.ig.clear();

    // 初始化 LazyLoadManager
    if (!domainLazyLoadManager && w.LazyLoadManager) {
      domainLazyLoadManager = new w.LazyLoadManager({
        root: document.getElementById('box-container'),
        rootMargin: '300px', // 提前 100px 開始載入
        threshold: [0, 0.01, 0.1, 0.5], // 多個閾值點
        debug: false // 設為 true 可看到詳細日誌
      });
      s.lazyLoadManager = domainLazyLoadManager;

      // 定期清理過期緩存（每5分鐘）
      setInterval(() => {
        try { domainLazyLoadManager.cleanupCache(); } catch (err) { /* noop */ }
      }, 5 * 60 * 1000);

      console.log('🚀 LazyLoadManager 已初始化');
      console.log('💡 提示：執行以下命令啟用詳細日誌：');
      console.log('   angular.element("body").scope().lazyLoadManager.options.debug = true');
    }

    w.machineID = params.machineID;

    if (params.backgroundWindowID) {
      w.backgroundWindowID = params.backgroundWindowID;
    }

    console.timeEnd("load-library");
    if ((window as any).PERFORMANCE_MONITOR.watchDigest) {
      domainDigestDurationTest(s);
    }

    if ((window as any).PERFORMANCE_MONITOR.watchMemoryUsage) {
      setInterval(domainGetMemory, 2000);
    }

    if (!s.isUILoaded) {
      s.isUILoaded = true;
      syncSidebarFromScope();
    }

    if (w.process.platform == 'darwin') {
      window.setTimeout(function () {
        try { remote.app.dock.bounce("informational"); } catch (err) { /* noop */ }
      }, 1000);
    } else {
      window.setTimeout(function () {
        if (!document.hasFocus()) {
          try { currentWindow.flashFrame(true); } catch (err) { /* noop */ }
        }
      }, 1000);
    }

    const usingCache = params.usingCache;
    s.usingCache = usingCache;
    w.dragging = false;
    s.winMenu = [];
    s.all = [];
    syncSidebarFromScope();
    s.shuffle = [];
    s.trash = [];
    syncSidebarFromScope();
    syncListFromScope();
    s.untaggedCount = 0;
    s.unfiledCount = 0;
    s.tags = [];
    syncSidebarFromScope();
    s.selectedTags = {};
    syncTagManagerFromScope();
    s.selectingTags = {};
    syncTagManagerFromScope();
    // allTags = {} —— bundle 闭包死变量（全 bundle 零消费点），略去
    s.lockedImages = {};
    s.itemMappings = {};
    s.lastItemStates = {};
    s.isCropMode = false;
    syncDetailFromScope();
    s.startCursor = 0;
    if (w.eagle && w.eagle.filter) {
      w.eagle.filter.filterExtensions = {};
      w.eagle.filter.filterCameras = [];
      syncFilterFromScope();
    }
    if (w.ScrollbarSaver) { w.ScrollbarSaver.positionMapping = {}; }

    s.duplicateMappings = {};
    s.images = [];
    s.selected = [];
    syncInspectorFromScope();
    s.current = undefined;
    syncDetailFromScope();
    syncInspectorFromScope();
    s.selectedMappings = {};
    s.folderMappings = {};
    s.currentFolder = undefined;
    syncPanelFromScope();
    syncFolderLock();
    syncListFromScope();
    s.currentSmartFolder = undefined;
    syncPanelFromScope();
    syncListFromScope();
    s.smartFolderMappings = {};
    s.uploadQueue = [];
    syncUploadFromScope();
    s.finishQueue = [];
    syncUploadFromScope();
    s.isDetailMode = false;
    s.isInlineMode = false;
    s.isGrayscaleMode = false;
    s.usingGifPlayer = false;
    syncDetailFromScope();
    s.showDetailImage = false;
    syncDetailFromScope();
    s.currentTagGroup = undefined;
    syncTagManagerFromScope();
    s.tagViewMode = "ALL";
    syncTagManagerFromScope();
    s.folderKeyword = "";
    syncSidebarFromScope();
    if (w.eagle && w.eagle.filter && w.eagle.filter.filterRules) {
      w.eagle.filter.filterRules.color.gray = false;
    }
    w.hardDiskSpeed = undefined;
    s.showSlowNotify = false;
    syncSidebarFromScope();
    if (w.SlowNotify) {
      w.SlowNotify.hasShow = false;
      w.SlowNotify.slowCount = 0;
      w.SlowNotify.fastCount = 0;
    }

    // Clear URL state when switching libraries
    if (s.UrlStateService && s.UrlStateService.clearState) s.UrlStateService.clearState();
    // lastProcessedUrlState = null —— controller 闭包 guard（bundle 20539），另一写入方（watcher）仍在，略去

    s.libraryName = pathMod.basename(params.rootDir).replace('.library', '');
    syncSidebarFromScope();
    s.libraryPath = pathMod.normalize(params.rootDir);
    syncSidebarFromScope();

    if (w.process.platform == 'darwin') {
      s.rootDir = encodeURI(params.rootDir);
      s.imagesDir = encodeURI(params.imagesDir);
    } else {
      s.rootDir = encodeURI(params.rootDir.replace(/\\/g, "/"));
      s.imagesDir = encodeURI(params.imagesDir.replace(/\\/g, "/"));
    }
    s.libraryImagesPath = params.imagesDir;

    if (s.$root) {
      s.$root.imagesDir = s.imagesDir;
      s.$root.fontFolder = w.fontFolder;
    }

    s.orderBy = localStorage.getItem(`eagle.list.orderBy.${s.rootDir}`) || localStorage.getItem("eagle.list.orderBy") || "IMPORT";
    syncBodyFromScope();
    const userLayout = localStorage.getItem(`eagle.list.layout.${s.rootDir}`) || localStorage.getItem("eagle.list.layout") || "JustifiedLayout";

    if (localStorage.getItem(`eagle.list.sortIncrease.${s.rootDir}`)) {
      s.sortIncrease = localStorage.getItem(`eagle.list.sortIncrease.${s.rootDir}`) === 'true';
    }

    const userLayoutOptions = localStorage.getItem("eagle.list.layout.options") || "Fit";
    s.layoutOptions = userLayoutOptions;
    syncPanelFromScope();
    machinerySwitchLayout(s, userLayout);

    if (w.RecentFileManager && w.RecentFileManager.init) w.RecentFileManager.init(s.libraryName);
    if (s.TagManager && s.TagManager.init) s.TagManager.init(params.rootDir);
    if (s.SavedFilter && s.SavedFilter.init) s.SavedFilter.init(params.rootDir);
    if (w.eagle && w.eagle.action && w.eagle.action.initActions) w.eagle.action.initActions(params.rootDir);

    s.folders = params.folders;
    s.libraryModificationTime = params.modificationTime;

    // 自动补上 children
    if (w.eagle && w.eagle.utils && w.eagle.utils.tree) {
      w.eagle.utils.tree.walk(s.folders, 'children', function (folder: any, parent: any) {
        if (!folder.children) { folder.children = []; }
        if (folder && parent) { folder.parent = parent.id; }
        // 从 localStorage 取得 expand 状态，如果没有预设为 false
        folder.isExpand = localStorage.getItem("eagle.sidebar.folder.expand." + folder.id) === "true";
        if (!folder.children || folder.children.length === 0) { folder.isExpand = true; }
        folder.images = [];
        s.folderMappings[folder.id] = folder;
      });

      s.smartFolders = params.smartFolders || [];
      w.eagle.utils.tree.walk(s.smartFolders, 'children', function (smartFolder: any, parent: any, _depth: any) {
        if (!smartFolder.children) { smartFolder.children = []; }
        if (!smartFolder.conditions) { smartFolder.conditions = []; }
        smartFolder.isExpand = localStorage.getItem("eagle.sidebar.smartFolder.expand." + smartFolder.id) === "true";
        if (smartFolder && parent) { smartFolder.parent = parent.id; }
        s.smartFolderMappings[smartFolder.id] = smartFolder;
      });
    }

    s.quickAccess = params.quickAccess || [];
    syncSidebarFromScope();
    if (s.TagManager) {
      s.TagManager.groups = params.tagsGroups || [];
      syncFilterFromScope();
      syncTagManagerFromScope();
      // Note: 过去版本如果使用者曾经使用批量添加，标签会多了一个 \r 符号
      s.TagManager.groups.forEach(function (group: any) {
        if (group && group.tags) {
          for (let i = 0; i < group.tags.length; i++) {
            try {
              group.tags[i] = group.tags[i].replace(/\r?\n?/g, '');
            }
            catch (err) { /* noop */ }
          }
        }
      });
    }

    machineryUpdateSidebarList(s);
    if (s.$root && s.$root.initMenu) s.$root.initMenu();

    // NOTE: 只能用迂迴的方式處理可能超過 10W 張圖片的狀況，避免使用 JSON.parse 造成大量數據無法傳輸的問題
    electronLog.info(`[app] Load Library: ${s.rootDir}`);

    let images: any[] = [];
    if (params.usingPreloadCache && domainLibraryCache.length > 0) {
      console.time("从緩存载入图片");
      images = domainLibraryCache;
      console.timeEnd("从緩存载入图片");
    }
    else {
      const lineByLine = w.require(w.appRoot + '/my_modules/n-readlines');
      console.time("从文件载入图片");

      const liner = new lineByLine(params.imagesStringPath, {
        readChunk: 32768
      });

      let line: any;
      while ((line = liner.next())) {
        try {
          const image = JSON.parse(line);
          if (image.id) { images.push(image); }
        }
        catch (e: any) {
          try {
            // 如果偵測到 metadata.json 字串尾端出現異常字串導致無法正常讀取問題時，將自動嘗試修復
            if (e && e.message && e.message.indexOf(" position ") > -1) {
              let position = e.message.split(" position ")[1];
              if (position) {
                position = parseInt(position);
                if (position > 0) {
                  const newJSONStr = line.toString().substr(0, position);
                  try {
                    const fixedObj = JSON.parse(newJSONStr);
                    if (fixedObj.id) {
                      images.push(fixedObj);
                      electronLog.error(`[app] Detect broken JSON string, try to fix it: ${fixedObj.id}`);
                      if (typeof w.ayncsImagesChange === 'function') w.ayncsImagesChange([fixedObj]);
                    }
                  }
                  catch (err) { /* noop */ }
                }
              }
            }
          }
          catch (err) { /* noop */ }
        }
      }

      console.timeEnd("从文件载入图片");
    }

    // 確保所有數據包含 .tags .folders
    images.forEach((item: any) => {
      if (!item.tags) item.tags = [];
      if (!item.folders) item.folders = [];
    });

    // b1-9o：库装载整表重建 raw——内容过滤缓存必须失效（bundle 导入/装载路径的 rebind
    // 均无缓存参数、隐式重建；shim 世界 filterContent 传 s.contentFilterCache，缓存若在
    // raw 为空时建立会永久保留空快照，11a49 的 a4 空态无法闭合即此）
    s.contentFilterCache = null;
    s.raw = images;
    syncListFromScope();

    machineryCalculateImageBinding(s, {}, function () {
      s.viewMode = localStorage.getItem(`eagle.viewMode.${s.rootDir}`) || "all";
      s.isItemBindCalculated = true;
      if (s.viewMode == "all") {
        const lastFolderId = localStorage.getItem(`eagle.lastFolder.${s.rootDir}`);
        const lastItem = s.itemMappings[localStorage.getItem(`eagle.lastViewItem.${s.rootDir}`) as any];
        const lastItemTime = localStorage.getItem(`eagle.lastViewItemTime.${s.rootDir}`);
        const lastFolder = s.folderMappings[lastFolderId as any];
        const lastSmartFolder = s.smartFolderMappings[lastFolderId as any];

        if (lastFolder && !lastFolder?.password) {
          openFolder(lastFolder);
          machineryChangeSidebarIndex(s, lastFolder);
          if (lastFolder.orderBy !== "RANDOM") {
            setTimeout(function () {
              const DAY_7 = 604800000;
              if ((lastItemTime && Date.now() - parseInt(lastItemTime) < DAY_7) &&
                (lastItem && lastItem.folders && isInFolder(lastItem, lastFolder)) &&
                !s.lockedImages[lastItem.id]
              ) {
                s.selected = [lastItem];
                syncInspectorFromScope();
                scrollToSelectedItem();
                scopeEvalAsync();
              }
            }, 100);
          }
        }
        else if (lastSmartFolder) {
          openSmartFolder(lastSmartFolder);
          if (lastSmartFolder.orderBy !== "RANDOM") {
            setTimeout(function () {
              const DAY_7 = 604800000;
              if ((lastItemTime && Date.now() - parseInt(lastItemTime) < DAY_7) &&
                machineryExistInSmartFilter(s, lastSmartFolder, lastItem)
              ) {
                s.selected = [lastItem];
                syncInspectorFromScope();
                scrollToSelectedItem();
                scopeEvalAsync();
              }
            }, 100);
          }
        }
        else {
          machineryOpenAll(s, undefined, function () {
            setTimeout(function () {
              const DAY_7 = 604800000;
              if ((lastItemTime && Date.now() - parseInt(lastItemTime) < DAY_7) && lastItem && !s.lockedImages[lastItem.id]) {
                s.selected = [lastItem];
                syncInspectorFromScope();
                scrollToSelectedItem();
                scopeEvalAsync();
              }
            }, 100);
          });
        }
      } else {
        let urlState: any = {};
        try { urlState = s.UrlStateService.getState(); } catch (err) { urlState = {}; }
        let hasUrlState = false;

        switch (urlState.view) {
          case 'unfiled': machineryOpenUnfiled(s, true); hasUrlState = true; break;
          case 'untagged': machineryOpenUntagged(s, true); hasUrlState = true; break;
          case 'random': machineryOpenRandom(s, true); hasUrlState = true; break;
          case 'recent': machineryOpenRecent(s, true); hasUrlState = true; break;
          case 'community': machineryOpenCommunity(s, true); hasUrlState = true; break;
          case 'alltags': machineryOpenAllTags(s, true); hasUrlState = true; break;
          case 'trash': machineryOpenTrash(s, true); hasUrlState = true; break;
          case 'folder':
            if (urlState.folder && s.folderMappings && s.folderMappings[urlState.folder]) {
              openFolder(s.folderMappings[urlState.folder], true);
              hasUrlState = true;
            }
            break;
          case 'smartfolder':
            if (urlState.smartfolder && s.smartFolderMappings && s.smartFolderMappings[urlState.smartfolder]) {
              openSmartFolder(s.smartFolderMappings[urlState.smartfolder], true);
              hasUrlState = true;
            }
            break;
          case 'color':
            if (urlState.color) {
              filterWithColor(urlState.color, true);
              hasUrlState = true;
            }
            break;
        }

        // 處理 imageFilter 參數
        // b1-9ba：原 OPEN_IMAGE_FILTER 廣播全樹無接收者（原接收者隨 bundle 摘除退役）
        // ——廣播體移除，僅保留 hasUrlState 消費標記（「URL 狀態已處理」原語義）。
        if (urlState.imageFilter) {
          hasUrlState = true;
        }

        if (!hasUrlState) {
          if (s.viewMode == "unfiled") { machineryOpenUnfiled(s); }
          else if (s.viewMode == "untagged") { machineryOpenUntagged(s); }
          else if (s.viewMode == "random") { machineryOpenRandom(s); }
          else if (s.viewMode == "recent") { machineryOpenRecent(s); }
          else if (s.viewMode == "community") { machineryOpenCommunity(s); }
          else if (s.viewMode == "alltags") { machineryOpenAllTags(s); }
          else if (s.viewMode == "trash") { machineryOpenTrash(s); }
          else { machineryOpenAll(s); }
        }
      }

      s.isLoading = false;
      s.libraryLoadedProgress = 0;
      machineryUpdateSidebarList(s);

      const loadedTime = params.loadedTime;
      let performanceName = "Cache-Load";
      if (usingCache) { performanceName = "Cache-Load"; }
      else { performanceName = "Library-Load"; }

      if (w.analytics && w.analytics.timing) {
        w.analytics.timing("performance", performanceName, loadedTime * 1000);
      }

      // 记录用户收藏数据 / 记录用户打开资源库性能
      let metrics: any = null;
      try { metrics = s.AnalyticsHelper.getCommonMertics(); } catch (err) { metrics = null; }
      if (metrics) {
        if (w.analytics && w.analytics.custom) {
          w.analytics.custom({
            't': 'pageview',
            'dl': '/',
            'cm1': metrics.all,
            'cm2': metrics.folders,
            'cm3': metrics.smartFolders,
            'cm4': metrics.tags,
            'cm5': metrics.tagGroups
          });
        }
        // 更新用户最后使用状态
        if (w.machineID) {
          let email;
          if (w.Registration && w.Registration.license && w.Registration.license.email) {
            email = w.Registration.license.email;
          }
          // 原 $http.post → 原生 fetch JSON POST 等价复刻
          try {
            fetch("https://core.eagle.cool/update-machine", {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                machineID: w.machineID,
                email: email,
                'all': metrics.all,
                'folders': metrics.folders,
                'smartFolders': metrics.smartFolders,
                'tags': metrics.tags,
                'tagGroups': metrics.tagGroups
              }),
            }).catch(() => { /* 网络失败静默（原 ajax 无回调） */ });
          } catch (err) { /* noop */ }
        }
      }
    });

    setTimeout(function () {
      // 建立重复核对表
      machineryFindDupclipate(s, undefined);
      machineryUpdateSidebarList(s);

      domainAyncsUpdateSmartFoldersCount(s, s.smartFolderList, () => { /* noop */ });

      setTimeout(function () { machineryUpdateContainerHieght(s); }, 300);
      scopeEvalAsync();

    }, 1000);

    if (w.eagle && w.eagle.filter && w.eagle.filter.isOpen) {
      setTimeout(function () { machineryUpdateContainerHieght(s); }, 300);
    }

    s.navigationHistory = [];
    s.navigationHistoryIndex = 0;

    const savingProgressbarEl = q("#saving-progress-bar");
    const savingProgressbarMessageEl = q("#saving-progress-bar .message");

    if (!w.APIServer) {
      if (typeof w.initAPIServer === 'function') w.initAPIServer();
    }
    if (typeof w.startAPIServer === 'function') w.startAPIServer();

    console.log("开始 background-state 监听");
    ipc.on('background-state', function (_evt: any, state: any) {

      if (domainHeartbeatInterval) clearInterval(domainHeartbeatInterval);
      w.heartbeatStopCount = 0;
      domainHeartbeatInterval = setInterval(w.checkBackgroundHeartbeat, 10000);

      // 仅呼吸，不提供数据，避免 UI 更新
      if (!state) {
        return;
      }

      // b1-9i：bundle 在世时此处为 ang.isNumber（w.angular）数字守卫——shim 世界无
      // window.angular（不得注入，见 b1-9e 雷区记录），typeof 判定语义等价
      const isNumber = (value: any): boolean => typeof value === 'number';
      let number = 0;
      let savingNumber = 0;
      if (state && isNumber(state.paletteQueueLength)) {
        number += state.paletteQueueLength;
        s.paletteQueueLength = state.paletteQueueLength;
      }
      if (state && isNumber(state.metadataQueueLength)) {
        savingNumber += state.metadataQueueLength;
        s.metadataQueueLength = state.metadataQueueLength;
      }
      if (state && isNumber(state.downloadQueueLength)) {
        s.downloadQueueLength = state.downloadQueueLength;
      }

      // 需要判断什么时候在更新画面，什么时候不需要
      s.paletteQueueDelay = state.paletteQueueDelay;
      s.currentProcessCount = number;
      syncSidebarFromScope();
      void s.lastProcessCount;

      requestAnimationFrame(() => {

        if (state.metadataQueueLength > 3) {
          const $filter = getFilter();
          let savingLabel = "progress.savingFiles.msg";
          if ($filter) {
            try {
              savingLabel = $filter('i18n')("progress.savingFiles.msg", [
                { "property": "count", "value": $filter('number', 0)(savingNumber) }
              ]);
            } catch (err) { /* noop */ }
          }
          setTextEl(savingProgressbarMessageEl, savingLabel);
          addClassEl(savingProgressbarEl, "open");
        }
        else {
          removeClassEl(savingProgressbarEl, "open");
        }

        const backgroundStateComponentEl = q("#background-state-spinner");
        const backgroundStateSpinnerIconEl = q("#background-state-spinner .pause-icon");
        const backgroundStateSpinnerEl = q("#background-state-spinner .sm-spiner");
        if (s.currentProcessCount > 0) {
          showEl(backgroundStateComponentEl);
        }
        else {
          hideEl(backgroundStateComponentEl);
        }
        s.paletteQueuePaused = state.paletteQueuePaused;
        syncSidebarFromScope();
        if (!s.paletteQueuePaused) {
          addClassEl(backgroundStateSpinnerEl, "has-animation");
          showEl(backgroundStateSpinnerIconEl);
        }
        else {
          removeClassEl(backgroundStateSpinnerEl, "has-animation");
          hideEl(backgroundStateSpinnerIconEl);
        }

        s.lastProcessCount = s.currentProcessCount;
      });
    });

    const SIX_HOUR = 1000 * 60 * 60 * 6;
    (window as any).IPCHelper.send("check-for-update", {
      machineID: w.machineID,
    });

    if (domainUpdateTimer) clearInterval(domainUpdateTimer);
    domainUpdateTimer = setInterval(function () {
      (window as any).IPCHelper.send("check-for-update", {
        machineID: w.machineID
      });
    }, SIX_HOUR);

    console.timeEnd("前台总耗时");

    s.errorList = [];
    syncErrorCount();

    // 检查 localhost 是否可以连线，如果无法练接，通常是本地代理搞鬼，提示用户关闭或调整代理工具
    fetch("http://localhost:41593").then(() => {
      electronLog.info(`[app] Local server: enabled`);
      electronLog.info("---------------------------------------");
    }).catch(() => {
      if (s.localhostError !== true) {
        s.localhostError = true;
        scopeEvalAsync();
      }
      electronLog.error(`[app] Local server: disabled`);
      electronLog.error("---------------------------------------");
    });

    if (typeof (window as any).ACCESS?.checkALCs === 'function') {
      if (!ACCESS.checkALCs(s.libraryPath)) {
        ipc.send('electron-log', "[app] Detect library has no write permission, path: " + s.libraryPath);
        if (s.libraryPathPermissionError !== true) {
          s.libraryPathPermissionError = true;
        }
      }
      else {
        s.libraryPathPermissionError = false;
      }
    }

    if (w.process.platform === 'darwin') {
      const isNTFS = (filePath: string) => {
        try {
          if (!filePath.startsWith('/Volumes/')) return '';
          const matched = filePath.match(new RegExp(/\/Volumes\/(.+?)\//));
          const volumePath = matched ? matched[0] : matched;
          if (!volumePath) return false;
          const exec = req('child_process');
          const execSync = exec && exec.execSync;
          if (!execSync) return false;
          let stdoutString;
          try {
            stdoutString = execSync(`diskutil info ${volumePath}`, {}, {
              timeout: 5000
            }).toString();
            if (stdoutString.toLowerCase().indexOf('ntfs') > -1 && stdoutString.toLowerCase().indexOf('exfat') === -1) {
              return true;
            }
            return false;
          }
          catch (err) { return false; }
        }
        catch (err) { return false; }
      };
      try {
        const getDriveType = w.require(w.appRoot + '/my_modules/get-drive-type');
        const driveType = getDriveType(s.libraryPath).toLowerCase();
        if (driveType.indexOf("ntfs") > -1 || driveType.indexOf("lifs") > -1) {
          if ((window as any).isVentura) {
            s.showNTFSWarning = isNTFS(s.libraryPath);
            syncSidebarFromScope();
          }
          else {
            s.showNTFSWarning = true;
            syncSidebarFromScope();
          }
        }
        else {
          s.showNTFSWarning = false;
          syncSidebarFromScope();
        }
      }
      catch (err) {
        electronLog && electronLog.error(((err as any) && (err as any).stack) || err);
      }
    }

    // NOTE: 判斷是否為首次開啟，如果是，就顯示教學提示
    machineryShowTutorial(s);

    electronLog.info(`[app] Library loaded`);
    // 保险 digest 排程：bundle 原处理器依赖后续应用活动触发 $timeout 派工；React 域在
    // 事件驱动的测试/静默场景下补一次 $evalAsync，保证 binding 派工即时可flush
    scopeEvalAsync();
  });
}


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
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

export function machineryGetChildFoldersMap(s: any, folder: any): any {
  const w = window as any;
  var childs: any = {};
  w.eagle.utils.tree.walk(folder.children, 'children', function (child: any, parent: any) {
    childs[child.id] = true;
  });
  return childs;
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

export function machineryNewSmartFolder(s: any, event: any, smartFolder: any): void {
  newSmartFolderChannel.emit({ smartFolder: smartFolder, parent: undefined });
}

export function machineryOpenArtstation(s: any): void {
  importArtstationChannel.emit();
}

export function machineryOpenHuaban(s: any): void {
  const w = window as any;
  w.electron.shell.openExternal("https://docs-cn.eagle.cool/article/402-import-from-huaban");
}

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

/* openTrialModal（bundle 37xxx 逐字：ipcRenderer 统一表达式 send('open-trial-modal')） */
export function machineryOpenTrialModal(s: any, trialRemain: any): void {
  const w = window as any;
  if (trialRemain) {
    const ipc = w.__eagleIpc || (w.electron && w.electron.ipcRenderer);
    ipc.send('open-trial-modal', trialRemain);
  }
}


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
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


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
/* RecentFileManager（bundle 52307-52390 逐字；save = w.throttle(1000, immediate)） */
export function buildRecentFileManager(): any {
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

/* openParentFolder（bundle 38384-38388 逐字；openFolder 经 scope 解析） */
export function machineryOpenParentFolder(s: any): void {
  if (s.currentFolder && s.currentFolder.parent) {
    openFolder(s.folderMappings[s.currentFolder.parent]);
  }
}

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

export function machineryRemoveFolderInner(s: any, folder: any, { isDeleteImages, ignoreSelectNext, ignoreRestore }: any = {}): void {
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

export function machineryRemoveSmartFolderInner(s: any, smartFolder: any, { ignoreSelectNext, ignoreRestore }: any = {}): void {
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

export function machineryResetFolderCover(s: any, folder: any): void {
  if (!folder) return;
  var ancestors = machineryGetAncestorFolders(s, folder, [folder]);
  ancestors.push(folder);
  ancestors.forEach(function (f: any) {
    f.covers = [];
  });
}

export function machinerySaveFolderDebounce(s: any): void {
  const w = window as any;
  s.isLibrarySaving = true;
  clearTimeout(s.saveFolderDebounceTimeout);
  s.saveFolderDebounceTimeout = setTimeout(() => {
    machinerySaveFolder(s);
    s.isLibrarySaving = false;
  }, 1000);
}

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

export function machinerySetLastFolder(s: any, folderId: any): void {
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

export function machineryToggleCurrentLevelSmartFolders(s: any, event: any, smartFolder: any): void {
  var expand = !smartFolder.isExpand;
  var parent = s.smartFolderMappings[smartFolder.parent];
  var smartFolders = s.smartFolders;
  if (parent && parent.children) {
    smartFolders = parent.children;
  }
  machineryToggleCurrentLevelSmartFoldersInner(s, smartFolders, expand);
}

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

export let openRecentTimeout: any = null;

export let openTrashTimeout: any = null;

export let openUnfiledTimeout: any = null;

/* setLastFolder（bundle 38480-38488 逐字；_.debounce 500 单实例语义同上） */
let setLastFolderDebounced: any = null;

// ── c9b 域内自管（原 controller 闭包 var：26927 邻域 updateSidebarListTimeout / 27006
//    rebindRefreshLazyTimeout）──
export let updateSidebarListTimeout: any = null;
