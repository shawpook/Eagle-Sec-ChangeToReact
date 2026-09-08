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
import { isInFolder } from './controllerFns';
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
        arr[i].imageCount = s.smartFolderCount(arr[i]);
        if (!arr[i].pinyin) {
          arr[i].pinyin = w.tinyPinyin.convertToPinyin(arr[i].name);
        }
      }

      s.$evalAsync();

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
        $rootScope.$apply();
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
  const $: any = w.$;

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
      if ($) {
        $("body").css({
          "pointer-events": "",
          "opacity": ""
        });
      }
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
                s.openTrialModal(s.trialRemain);
              }
              else {
                lastOpenTrialModalTime = parseInt(lastOpenTrialModalTime);
                if (now - lastOpenTrialModalTime < HALF_DAY) {
                  console.log("12小时内暂时不再跳出");
                  return;
                }
                s.openTrialModal(s.trialRemain);
                localStorage["lastOpenTrialModalTime"] = now;
              }
            }
          }
        } finally { try { s.$apply(); } catch (err) { /* noop */ } }
      }, 1000);
    }
    s.$root.initMenu();
    s.$evalAsync();
  });

  // ── app-status-welcome（22631 逐字）──
  ipc.on('app-status-welcome', function (_e: any, _params: any) {
    const s: any = getBodyScope();
    if (!s) return;
    s.$evalAsync(function () {
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
    s.$evalAsync();
  });

  // ── app-status-library-cache-loaded（22758 逐字）──
  ipc.on('app-status-library-cache-loaded', function (_e: any) {
    const s: any = getBodyScope();
    if (!s) return;
    s.isLoading = true;
    s.$evalAsync();
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

    s.updateSidebarList();
    s.calculateImageBinding({ ignoreSort: true }, function () {
      s.rebindRefresh();
      s.$evalAsync();
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
    if (s.$root && s.$root.$broadcast) s.$root.$broadcast("CLOSE-TAGS-POPUP");
    s.allData = [];
    syncListFromScope();
    s.isLoading = false;
    s.startCursor = 0;
    if (w.ScrollbarSaver) { w.ScrollbarSaver.positionMapping = {}; }
    s.$evalAsync();

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
    s.switchLayout(userLayout);

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

    s.updateSidebarList();
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

    s.calculateImageBinding({}, function () {
      s.viewMode = localStorage.getItem(`eagle.viewMode.${s.rootDir}`) || "all";
      s.isItemBindCalculated = true;
      if (s.viewMode == "all") {
        const lastFolderId = localStorage.getItem(`eagle.lastFolder.${s.rootDir}`);
        const lastItem = s.itemMappings[localStorage.getItem(`eagle.lastViewItem.${s.rootDir}`) as any];
        const lastItemTime = localStorage.getItem(`eagle.lastViewItemTime.${s.rootDir}`);
        const lastFolder = s.folderMappings[lastFolderId as any];
        const lastSmartFolder = s.smartFolderMappings[lastFolderId as any];

        if (lastFolder && !lastFolder?.password) {
          s.openFolder(lastFolder);
          s.changeSidebarIndex(lastFolder);
          if (lastFolder.orderBy !== "RANDOM") {
            setTimeout(function () {
              const DAY_7 = 604800000;
              if ((lastItemTime && Date.now() - parseInt(lastItemTime) < DAY_7) &&
                (lastItem && lastItem.folders && isInFolder(lastItem, lastFolder)) &&
                !s.lockedImages[lastItem.id]
              ) {
                s.selected = [lastItem];
                syncInspectorFromScope();
                s.scrollToSelectedItem();
                s.$evalAsync();
              }
            }, 100);
          }
        }
        else if (lastSmartFolder) {
          s.openSmartFolder(lastSmartFolder);
          if (lastSmartFolder.orderBy !== "RANDOM") {
            setTimeout(function () {
              const DAY_7 = 604800000;
              if ((lastItemTime && Date.now() - parseInt(lastItemTime) < DAY_7) &&
                s.existInSmartFilter(lastSmartFolder, lastItem)
              ) {
                s.selected = [lastItem];
                syncInspectorFromScope();
                s.scrollToSelectedItem();
                s.$evalAsync();
              }
            }, 100);
          }
        }
        else {
          s.openAll(undefined, function () {
            setTimeout(function () {
              const DAY_7 = 604800000;
              if ((lastItemTime && Date.now() - parseInt(lastItemTime) < DAY_7) && lastItem && !s.lockedImages[lastItem.id]) {
                s.selected = [lastItem];
                syncInspectorFromScope();
                s.scrollToSelectedItem();
                s.$evalAsync();
              }
            }, 100);
          });
        }
      } else {
        let urlState: any = {};
        try { urlState = s.UrlStateService.getState(); } catch (err) { urlState = {}; }
        let hasUrlState = false;

        switch (urlState.view) {
          case 'unfiled': s.openUnfiled(true); hasUrlState = true; break;
          case 'untagged': s.openUntagged(true); hasUrlState = true; break;
          case 'random': s.openRandom(true); hasUrlState = true; break;
          case 'recent': s.openRecent(true); hasUrlState = true; break;
          case 'community': s.openCommunity(true); hasUrlState = true; break;
          case 'alltags': s.openAllTags(true); hasUrlState = true; break;
          case 'trash': s.openTrash(true); hasUrlState = true; break;
          case 'folder':
            if (urlState.folder && s.folderMappings && s.folderMappings[urlState.folder]) {
              s.openFolder(s.folderMappings[urlState.folder], true);
              hasUrlState = true;
            }
            break;
          case 'smartfolder':
            if (urlState.smartfolder && s.smartFolderMappings && s.smartFolderMappings[urlState.smartfolder]) {
              s.openSmartFolder(s.smartFolderMappings[urlState.smartfolder], true);
              hasUrlState = true;
            }
            break;
          case 'color':
            if (urlState.color) {
              s.filterWithColor(urlState.color, true);
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
          if (s.viewMode == "unfiled") { s.openUnfiled(); }
          else if (s.viewMode == "untagged") { s.openUntagged(); }
          else if (s.viewMode == "random") { s.openRandom(); }
          else if (s.viewMode == "recent") { s.openRecent(); }
          else if (s.viewMode == "community") { s.openCommunity(); }
          else if (s.viewMode == "alltags") { s.openAllTags(); }
          else if (s.viewMode == "trash") { s.openTrash(); }
          else { s.openAll(); }
        }
      }

      s.isLoading = false;
      s.libraryLoadedProgress = 0;
      s.updateSidebarList();

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
          // 原 $http.post（第三参为误传的成功回调，Angular 按默认配置发送）→ $.ajax JSON POST 等价复刻
          if ($) {
            try {
              $.ajax({
                type: 'POST',
                url: "https://core.eagle.cool/update-machine",
                data: JSON.stringify({
                  machineID: w.machineID,
                  email: email,
                  'all': metrics.all,
                  'folders': metrics.folders,
                  'smartFolders': metrics.smartFolders,
                  'tags': metrics.tags,
                  'tagGroups': metrics.tagGroups
                }),
                contentType: 'application/json'
              });
            } catch (err) { /* noop */ }
          }
        }
      }
    });

    setTimeout(function () {
      // 建立重复核对表
      s.findDupclipate(undefined);
      s.updateSidebarList();

      domainAyncsUpdateSmartFoldersCount(s, s.smartFolderList, () => { /* noop */ });

      setTimeout(function () { s.updateContainerHieght(); }, 300);
      s.$evalAsync();

    }, 1000);

    if (w.eagle && w.eagle.filter && w.eagle.filter.isOpen) {
      setTimeout(function () { s.updateContainerHieght(); }, 300);
    }

    s.navigationHistory = [];
    s.navigationHistoryIndex = 0;

    const $savingProgressbar = $("#saving-progress-bar");
    const $savingProgressbarMessage = $("#saving-progress-bar .message");

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
          $savingProgressbarMessage.text(savingLabel);
          $savingProgressbar.addClass("open");
        }
        else {
          $savingProgressbar.removeClass("open");
        }

        const $backgroundStateComponent = $("#background-state-spinner");
        const $backgroundStateSpinnerIcon = $("#background-state-spinner .pause-icon");
        const $backgroundStateSpinner = $("#background-state-spinner .sm-spiner");
        if (s.currentProcessCount > 0) {
          $backgroundStateComponent.show();
        }
        else {
          $backgroundStateComponent.hide();
        }
        s.paletteQueuePaused = state.paletteQueuePaused;
        syncSidebarFromScope();
        if (!s.paletteQueuePaused) {
          $backgroundStateSpinner.addClass("has-animation");
          $backgroundStateSpinnerIcon.show();
        }
        else {
          $backgroundStateSpinner.removeClass("has-animation");
          $backgroundStateSpinnerIcon.hide();
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

    if ($) {
      // 检查 localhost 是否可以连线，如果无法练接，通常是本地代理搞鬼，提示用户关闭或调整代理工具
      $.ajax({
        url: "http://localhost:41593"
      }).done(function (res: any) {
        void res;
        electronLog.info(`[app] Local server: enabled`);
        electronLog.info("---------------------------------------");
      }).fail(function () {
        if (s.localhostError !== true) {
          s.localhostError = true;
          s.$evalAsync();
        }
        electronLog.error(`[app] Local server: disabled`);
        electronLog.error("---------------------------------------");
      });
    }

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
    s.showTutorial();

    electronLog.info(`[app] Library loaded`);
    // 保险 digest 排程：bundle 原处理器依赖后续应用活动触发 $timeout 派工；React 域在
    // 事件驱动的测试/静默场景下补一次 $evalAsync，保证 binding 派工即时可flush
    s.$evalAsync();
  });
}
