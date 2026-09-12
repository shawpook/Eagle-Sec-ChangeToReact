/**
 * cZ-7a：杂项域——主块 56 通道截肢 + 逐字重挂（窗口/分析/守护/Swal/任务/导航/字体/幻灯片/
 * 折叠面板徽标/库目录/移除/卸载/电源/浏览器事件）。
 *
 * - **暂留（插件/菜单/标签域，cZ-7b/后续）**：update-menu（initMousetrap 闭包重绑定）、
 *   update-preferences（pluginModule+initMousetrap+preferences 闭包）、plugin-installed/
 *   uninstalled/reloaded、install-plugin/open-plugin-center-and-search、jieba-extract-done。
 * - **休眠站点免处理**：app-status-module-* / checking-library-cache* / app-status-library-
 *   dirs-loading/metadata-* / cache-loading 均在 LoadProgress 类（libraryLoadProgress 岛已换
 *   React host → 不 link）；@1089-1937 为 pluginManager 模块级监听（插件域再处理）；
 *   @54292/@54297 在 inspector 指令 link（岛已删休眠）；@62437 PluginCenter 指令（岛已删
 *   休眠）。@18672 thumbnail-generated 为插件管理器 responseCallback（模块级，保留）。
 * - **RootController 块三通道**：app-expired（body 反活化）/change.zoom（webFrame 缩放）/
 *   change.current.theme（主题落点 RootController scope——owner 桥后写入透明进 AppCore，
 *   cZ-2 缓释条件已成熟：React BodyBindings 经原型链读一致）。preview-window 控制器为
 *   独立窗口上下文，其同名监听不在本总线，无冲突。
 * - **未核查闭环的后验证项**：opening alert（swal/dialog/shell/app/*）等浏览器全局在
 *   主窗口均可用（bundle 同样用法）；open-unregister 的 $http Promise 语义用 jqXHR
 *   .then 等价复刻（Angular response {data:...} 包装经适配函数还原）。
 */

import { getBodyScope, getRootScope, removeChannelListenersBySource } from './appCore';
import { ipcRenderer } from '../global/eagleGlobals';
import { syncErrorCount } from '../store/toastState';
import { syncUploadFromScope } from '../store/uploadState';
import { syncSidebarFromScope } from '../store/sidebarState';
import { syncTagManagerFromScope } from '../store/tagManagerState';
import { syncFilterFromScope } from '../store/filterState';
import { syncBodyFromScope } from '../store/bodyState';
import { syncDetailFromScope } from '../store/detailState';
import { syncInspectorFromScope } from '../store/inspectorState';
import { syncToolbarFromScope } from '../store/toolbarState';
import { detailZoom } from '../core/smoothZoomEngine';
import { openFolder, openSmartFolder } from '../services/folderCoreService';
import { select } from '../services/selectionService';
import { importFolders } from '../services/uploadService';

import { machineryRememberVideoCurrentTime } from '../services/mediaService';
import { addToRecentFolders, cleanSelected, scrollToSelectedItem } from '../services/batchOpsService';
import { newFolder } from '../services/folderCoreService';
import { activateFont, deactivateFont } from '../services/fontTagService';
import { openErrorChannel } from '../global/bus';
import { scopeEvalAsync } from './scopeRuntime';
import { q, qaNot, widthOf, heightOf, hasClass, addClass, removeClass, cssSet, setScrollLeft } from '../utils/domQuery';
import { machineryNewSmartFolder } from './libraryDomain';
import { machineryGetRecentFolders } from './libraryDomain';
import { machineryRememberScrollTops } from '../services/gridService';
import { machineryChangeSidebarIndex, machineryPrependFolder, machineryQuickOpenFolder, machinerySetFolderOrder, machinerySetSmartFolderOrder, machineryUpdateSidebarList } from './libraryDomain';
import { machineryFindDupclipate, machineryHideUploadQueue, machineryRebindRefresh } from './itemDomain';
import { machineryOpenAll } from '../services/folderCoreService';
import { openMousewheelPreferenceWindowChannel, openPluginPanelChannel } from '../global/bus';
import { detailToggleDetailMode } from '../services/detailService';
import { toggleGifPlay } from '../services/mediaService';
import { machineryLastZoom, machineryZoom } from '../services/viewOpsService';
import { focusEl, qa, show } from '../utils/domQuery';
import { machineryPreloadImage } from './itemDomain';
import { machineryAddToRecentFile } from './libraryDomain';
import { ensureDetailZoom } from './smoothZoomEngine';
import { getFilter } from './filterDomain';

import { machinerySortRawData } from './itemDomain';
import { machineryUndo } from './navHistory';
import { getPageDownHandlerFn, machineryInitMousetrap } from './keymap';
import { getTimeout } from './machineryInfra';
import { useFolderState } from '../store/folderState';
import { useListState } from '../store/listState';
import { useMiscRawState } from '../store/miscRawState';
import { writeScopeField } from './scopeFieldBridge';
// 原 bundle controller 闭包 var（唯一写方 machineryNotify 已随迁本域）
let undoTimeout: any = null;
declare const IPCHelper: any;
declare const remote: any;

let done = false;

function domainTimeout(s: any, fn: any, ms?: number): any {
  return setTimeout(() => {
    try { if (typeof fn === 'function') fn(); } finally { try { scopeEvalAsync(); } catch (err) { /* noop */ } }
  }, ms || 0);
}

// b1-9bz-D-1 B-15：删除本域旧的无 shim 兜底 getFilter 副本，统一用 canonic 版
// （filterDomain.getFilter 含 angular 与 shim 双路径；原副本在 shim 世界返回 null，
//  machineryNotify 的 getFilter()('i18n') 会抛「getFilter(...) is not a function」）

export function takeoverMiscDomain(): void {
  if (done) return;
  done = true;
  const w = window as any;
  const ipc: any = ipcRenderer();
  if (!ipc || typeof ipc.on !== 'function') return;

  const diag: any = { takenOver: true, removed: {} as Record<string, number> };
  w.__eagleMiscDomain = diag;

  const electronLog: any = w.electronLog || console;
  const swal: any = w.swal;
  const sNow = (): any => getBodyScope();
  const rNow = (): any => getRootScope();
  const currentWindow = (): any => (w.electron && w.electron.remote && w.electron.remote.getCurrentWindow && w.electron.remote.getCurrentWindow())
    || (w.require && w.require('@electron/remote') && w.require('@electron/remote').getCurrentWindow && w.require('@electron/remote').getCurrentWindow());

  // ── 截肢（按 bundle 特征串）──
  const chans: Array<[string, string[]]> = [
    ['show-swal', ['focusConfirm: true']],
    ['show-minor-update-message', ['dialog.minorUpdate.title']],
    ['open-relaunch-confirm', ['app.relaunch']],
    ['get-duplicate-map', ['get-duplicate-map-done']],
    ['lock-now', ['$scope.lockApp()']],
    ['window.maximize', ['$scope.isMaximize = true']],
    ['window.unmaximize', ['$scope.isMaximize = false']],
    ['analytics.event', ['analytics.event(data.category']],
    ['analytics.performance', ['analytics.timing("performance"']],
    ['analytics.custom', ['analytics.custom(data)']],
    ['analytics.exception', ['暂时保留 GA 纪录错误讯息使用']],
    ['log', ['console.log(data)']],
    ['confirm-import-eaglepack', ['extrack-eaglepack']],
    ['reload', ['location.reload()']],
    ['show-intel-compatibility-issue', ['dialog.rosetta.title']],
    ['before-quit', ['swal({']],
    ['update-progress', ['$scope.progress = progress']],
    ['add-download-task', ['$scope.uploadQueue.push({})']],
    ['add-download-tasks', ['for (var i = 0; i < count; i++)']],
    ['extension-server-init-failed', ['$scope.localhostError = true']],
    ['load-open-with', ['$scope.openWithInfo = openWithInfo']],
    ['move-to-folders', ['$scope.moveToFolders(event)']],
    ['rebind-refresh', ['$scope.rebindRefresh();']],
    ['open-item', ['$scope.enterDetailMode(e, item)']],
    ['go-folder', ['$scope.openFolder(folder)']],
    ['go-smart-folder', ['$scope.openSmartFolder(smartFolder)']],
    ['add-history-tag', ['TagManager.addHistoryTag(tag)']],
    ['add-history-tags', ['TagManager.addHistoryTags(tags)']],
    ['clear-history-tag', ['TagManager.historyTags = []']],
    ['prepend-folder', ['$scope.prependFolder(folder)']],
    ['new-folder', ['$scope.newFolder()']],
    ['new-smart-folder', ['$scope.newSmartFolder()']],
    ['hide-upload-queue', ['$scope.uploadQueue.length === 0']],
    ['open-and-reveal-image', ['$scope.lastestAddItem']],
    ['power-suspend', ['[app] stop api server']],
    ['power-resume', ['[app] start api server']],
    ['window-close', ['$(".detail-wrap video")[0]']],
    ['open-preferences', ['open.preferences']],
    ['toggle-slideshow', ['$scope.toggleSlideshow()']],
    ['leave-slideshow', ['scopeEvalAsync();']],
    ['show-sidebar-badge', ['showSidebarBadge = true']],
    ['hide-sidebar-badge', ['showSidebarBadge = false']],
    ['import-folders', ['$scope.importFolders()']],
    ['activate-font', ['$scope.activateFont(item, {showNotify: false, updateView: true})']],
    ['deactivate-font', ['$scope.deactivateFont(item, {showNotify: false, updateView: true})']],
    ['reveal-in-eagle', ['$scope.quickOpenFolder(folder, item)']],
    ['open-unregister', ['dialog.unregister.title']],
    ['get-current-folder', ['ipcRenderer.send("current-folder"']],
    ['get-recent-folders', ['$scope.getRecentFolders()']],
    ['add-recent-folders', ['$scope.addToRecentFolders(folders)']],
    ['image-processing-error', ['$scope.errorList.push(errorItem)']],
    ['remove-trash-item', ['$scope.currentTrashRemoved++']],
    ['ondragend', ['console.log("ondragend")']],
    ['app-expired', ['"opacity": "0.3"']],
    ['change.current.theme', ['remote.nativeTheme.shouldUseDarkColors']],
    ['change.zoom', ['electron.webFrame.setZoomFactor']],
  ];
  for (const [ch, sigs] of chans) {
    diag.removed[ch] = removeChannelListenersBySource(ipc, ch, sigs);
  }

  // ── show-swal（22224 逐字）──
  ipc.on('show-swal', function (_event: any, params: any) {
    if (!params) return;
    if (!swal) return;
    swal({
      title: params.title,
      html: params.description,
      showCloseButton: false, showCancelButton: false, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
      width: 400,
      cancelButtonColor: "#777777",
      confirmButtonText: params.button,
    }).then(function () { /* noop */ });
  });

  // ── show-minor-update-message（22236 逐字）──
  ipc.on('show-minor-update-message', function (_event: any, params: any) {
    if (!params) return;
    if (!swal) return;
    swal({
      html: `
        <div class="alert">
          <div class="alert-icon info"></div>
          <h4 class="alert-title">${w.i18n.__("dialog.minorUpdate.title")}</h4>
          <p class="alert-desc">${w.i18n.__("dialog.minorUpdate.desc")}<br>
          ${w.i18n.__("dialog.minorUpdate.newVersion")} Build ${params.newBuildNumber} (${params.newBuildVersion})<br>
          ${w.i18n.__("dialog.minorUpdate.currentVersion")} Build ${params.currentBuildNumber} (${params.currentBuildVersion})</p>
        </div>
      `,
      showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
      width: 400,
      customClass: "alert-box",
      cancelButtonColor: "#777777",
      confirmButtonText: w.i18n.__("dialog.minorUpdate.download"),
      cancelButtonText: w.i18n.__("dialog.minorUpdate.skip"),
    }).then(function () {
      try { w.shell.openExternal("https://eagle.cool/download/"); } catch (err) { /* noop */ }
    });
  });

  // ── open-relaunch-confirm（22252 逐字；app.relaunch/exit → window.app）──
  ipc.on('open-relaunch-confirm', function (_event: any, params: any) {
    if (!params) return;
    if (!swal) return;
    swal({
      html: `
        <div class="alert">
          <div class="alert-icon info"></div>
          <h4 class="alert-title">${params.title}</h4>
          <p class="alert-desc">${params.description}</p>
        </div>
      `,
      showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
      width: 400,
      customClass: "alert-box",
      cancelButtonColor: "#777777",
      confirmButtonText: params.confirmButtonText,
      cancelButtonText: params.cancelButtonText,
    }).then(function () {
      const s = sNow();
      if (!s) return;
      const showAlert = s.uploadQueue.length > 0 || s.downloadQueueLength > 0 || s.metadataQueueLength > 0 || s.isCleaningTrash || s.isImporting || qaNot(".progress-dialog.open", ".library-loading-dialog").length > 0 || !!q("#saving-progress-bar.open");
      const doRelaunch = () => {
        ipc.send("save-cache-file");
        const cw = currentWindow();
        if (cw && !cw.isDestroyed()) {
          cw.hide();
        }
        setTimeout(function () {
          if (w.app && w.app.relaunch) w.app.relaunch();
          if (w.app && w.app.exit) w.app.exit(0);
        }, 3000);
      };
      if (showAlert) {
        swal({
          html: `
            <div class="alert">
              <div class="alert-icon warning"></div>
              <h4 class="alert-title">${w.i18n.__('Dialog.BeforeQuit.Title')}</h4>
              <p class="alert-desc">${w.i18n.__("Dialog.BeforeQuit.Descript")}</p>
            </div>
          `,
          showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
          width: 400,
          customClass: "alert-box",
          cancelButtonColor: "#777777",
          confirmButtonText: w.i18n.__("Dialog.BeforeQuit.Quit"),
          cancelButtonText: w.i18n.__("general.cancel"),
          icon: "success"
        }).then(function () { doRelaunch(); });
      }
      else {
        doRelaunch();
      }
    });
  });

  // ── get-duplicate-map（22319 逐字；backgroundWindowID → window）──
  ipc.on('get-duplicate-map', function (_event: any, items: any) {
    const s = sNow();
    if (!s) return;

    function isDuplicateImage(image: any): any {
      if (!s.duplicateMappings) return false;
      if (image.ext === 'svg') return false;
      if (image.ext === 'tif') return false;
      if (image.ext === 'tiff') return false;

      const hashID = w.getHashID(image);
      if (!hashID) return false;
      return s.duplicateMappings[hashID];
    }

    function ignoreDuplicates(duplicates: string[]): Promise<boolean> {
      return new Promise((resolve, reject) => {
        if (!duplicates || duplicates.length === 0) {
          return resolve(false);
        }
        if (!swal) return resolve(false);
        const detail = w.i18n.__('dialog.eaglepackDuplicates.desc').replace("{count}", duplicates.length);
        swal({
          html: `
            <div class="alert">
              <div class="alert-icon warning"></div>
              <h4 class="alert-title">${w.i18n.__('dialog.eaglepackDuplicates.title')}</h4>
              <p class="alert-desc">${detail}</p>
            </div>
          `,
          showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
          width: 400,
          customClass: "alert-box",
          cancelButtonColor: "#777777",
          confirmButtonText: w.i18n.__('dialog.eaglepackDuplicates.cancel'),
          cancelButtonText: w.i18n.__('dialog.eaglepackDuplicates.import'),
        }).then(function () {
          // 移除重複
          return resolve(true);
        }, function () {
          // 不移除重複
          return resolve(false);
        });
      });
    }

    if (!items || items.length === 0) {
      ipc.sendTo(w.backgroundWindowID, 'get-duplicate-map-done', {});
      return;
    }
    try {
      machineryFindDupclipate(undefined);
      const duplicatesItemsMap: Record<string, boolean> = {};
      items.forEach(function (item: any) {
        if (isDuplicateImage(item)) {
          duplicatesItemsMap[item.id] = true;
        }
      });

      ignoreDuplicates(Object.keys(duplicatesItemsMap)).then(function (isIgnoreDuplicates) {
        if (isIgnoreDuplicates) {
          ipc.send('electron-info', `[bg] ignore ${Object.keys(duplicatesItemsMap).length} duplicate files`);
          ipc.sendTo(w.backgroundWindowID, 'get-duplicate-map-done', duplicatesItemsMap);
        }
        else {
          ipc.sendTo(w.backgroundWindowID, 'get-duplicate-map-done', undefined);
        }
      });
    }
    catch (err) {
      ipc.sendTo(w.backgroundWindowID, 'get-duplicate-map-done', undefined);
    }
  });

  // ── lock-now（22392 逐字）──
  ipc.on('lock-now', function () {
    const s = sNow();
    if (!s) return;
    machineryLockApp(s);
    scopeEvalAsync();
  });

  // ── window.maximize / window.unmaximize（22465/22483 逐字）──
  ipc.on('window.maximize', function () {
    const s = sNow();
    if (!s) return;
    setTimeout(function () {
      s.boxContianerWidth = widthOf(q("#box-container")) || s.boxContianerWidth;
      s.boxContianerHeight = heightOf(q("#box-container")) || s.boxContianerHeight;
    }, 200);
    s.isMaximize = true;
    syncToolbarFromScope();
    s.lastItemStates = {};
    scopeEvalAsync();
  });

  ipc.on('window.unmaximize', function () {
    const s = sNow();
    if (!s) return;
    setTimeout(function () {
      s.boxContianerWidth = widthOf(q("#box-container")) || s.boxContianerWidth;
      s.boxContianerHeight = heightOf(q("#box-container")) || s.boxContianerHeight;
    }, 200);
    s.isMaximize = false;
    syncToolbarFromScope();
    s.lastItemStates = {};
    scopeEvalAsync();
  });

  // ── analytics.* / log（22518-22544 逐字）──
  ipc.on('analytics.event', function (_e: any, data: any) {
    if (w.analytics) {
      w.analytics.event(data.category, data.action, data.label, data.value || undefined);
    }
  });
  ipc.on('analytics.performance', function (_e: any, data: any) {
    if (data && data.name && data.time && w.analytics) {
      w.analytics.timing("performance", data.name, data.time);
    }
  });
  ipc.on('analytics.custom', function (_e: any, data: any) {
    if (data && w.analytics) {
      w.analytics.custom(data);
    }
  });
  ipc.on('analytics.exception', w.throttle(function (_e: any, message: any) {
    // 暂时保留 GA 纪录错误讯息使用
    if (w.analytics) w.analytics.exception(message);
  }, 1000));
  ipc.on('log', function (_e: any, data: any) {
    console.log(data);
  });

  // ── confirm-import-eaglepack（22545 逐字）──
  ipc.on('confirm-import-eaglepack', function (_e: any, params: any) {
    const s = sNow();
    if (!s) return;
    if (hasClass(q("#extract-eaglepack-progress"), "open")) return;

    const eaglepackPath = params.path;
    const sizeStr = params.sizeStr;
    void eaglepackPath;

    try {
      if (!swal) return;
      swal({
        html: `
          <div class="alert">
            <div class="alert-icon info"></div>
            <h4 class="alert-title">${w.i18n.__("Dialog.Import.Eaglepack.Message")}</h4>
            <p class="alert-desc">${w.i18n.__('Dialog.Import.Eaglepack.Detail.1') + sizeStr + w.i18n.__('Dialog.Import.Eaglepack.Detail.2')}</p>
          </div>
        `,
        showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
        width: 400,
        customClass: "alert-box",
        cancelButtonColor: "#777777",
        confirmButtonText: w.i18n.__("Dialog.Import.Eaglepack.Button.Import"),
        cancelButtonText: w.i18n.__("general.cancel"),
      }).then(function () {
        IPCHelper.send('extrack-eaglepack', params);
      });
    }
    catch (err) { /* noop */ }
  });

  // ── reload（22574 逐字）──
  ipc.on('reload', function (_e: any, _data: any) {
    const s = sNow();
    if (typeof w.stopAPIServer === 'function') w.stopAPIServer();
    location.reload();
    if (s && s.SavedFilter && s.SavedFilter.unwatch) s.SavedFilter.unwatch();
    if (w.eagle && w.eagle.action && w.eagle.action.destroy) w.eagle.action.destroy();
  });

  // ── show-intel-compatibility-issue（22581 逐字；dialog → remote dialog）──
  ipc.on('show-intel-compatibility-issue', function (_e: any, _data: any) {
    let dialog: any = null;
    try { dialog = w.require('@electron/remote').dialog; } catch (err) { /* noop */ }
    if (!dialog || !dialog.showMessageBox) return;
    dialog.showMessageBox(currentWindow(), {
      type: "none",
      cancelId: 0,
      buttons: [w.i18n.__("general.cancel"), w.i18n.__("dialog.rosetta.download")],
      defaultId: 1,
      message: w.i18n.__("dialog.rosetta.title"),
      detail: w.i18n.__("dialog.rosetta.desc")
    }).then((result: any) => {
      if (result.response === 1) {
        try { w.shell.openExternal("https://eagle.cool/download/"); } catch (err) { /* noop */ }
      }
    });
  });

  // ── before-quit（22597 逐字；swal 语义 + $filter 经 injector）──
  ipc.on('before-quit', function (_e: any, _data: any) {
    const s = sNow();
    if (!s) return;
    const doQuit = () => {
      if (typeof w.stopAPIServer === 'function') w.stopAPIServer();
      if (s.SavedFilter && s.SavedFilter.unwatch) s.SavedFilter.unwatch();
      if (w.eagle && w.eagle.action && w.eagle.action.destroy) w.eagle.action.destroy();
      ipc.send("quit-app");
      const cw = currentWindow();
      if (cw && !cw.isDestroyed()) {
        cw.hide();
      }
    };
    const showAlert = s.uploadQueue.length > 0 || s.downloadQueueLength > 0 || s.metadataQueueLength > 0 || s.isCleaningTrash || s.isImporting || qaNot(".progress-dialog.open", ".library-loading-dialog").length > 0 || !!q("#saving-progress-bar.open");
    if (showAlert) {
      if (!swal) { doQuit(); return; }
      const $filter = getFilter();
      swal({
        title: $filter ? $filter('i18n')('Dialog.BeforeQuit.Title') : 'Dialog.BeforeQuit.Title',
        html: $filter ? $filter('i18n')("Dialog.BeforeQuit.Descript") : 'Dialog.BeforeQuit.Descript',
        showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
        width: 400,
        confirmButtonColor: "#F23459", // 1373FB DA4945
        cancelButtonColor: "#777777",
        confirmButtonText: $filter ? $filter('i18n')("Dialog.BeforeQuit.Quit") : 'Dialog.BeforeQuit.Quit',
        cancelButtonText: $filter ? $filter('i18n')("general.cancel") : 'general.cancel',
        icon: "success"
      }).then(function () { doQuit(); });
    }
    else {
      doQuit();
    }
  });

  // ── update-progress / add-download-task(s) / extension-server-init-failed（22639-22662 逐字）──
  ipc.on('update-progress', function (_e: any, progress: any) {
    const s = sNow();
    if (!s) return;
    scopeEvalAsync(function () {
      s.progress = progress;
      syncUploadFromScope();
    });
  });
  ipc.on('add-download-task', function () {
    const s = sNow();
    if (!s) return;
    scopeEvalAsync(function () {
      s.uploadQueue.push({});
      syncUploadFromScope();
    });
  });
  ipc.on('add-download-tasks', function (_event: any, count: any) {
    const s = sNow();
    if (!s) return;
    scopeEvalAsync(function () {
      for (let i = 0; i < count; i++) {
        s.uploadQueue.push({});
        syncUploadFromScope();
      }
    });
  });
  ipc.on('extension-server-init-failed', function (_e: any, _total: any) {
    const s = sNow();
    if (!s) return;
    s.localhostError = true;
    scopeEvalAsync();
  });

  // ── load-open-with（23527 逐字）──
  ipc.on('load-open-with', function (_e: any, openWithInfo: any) {
    const s = sNow();
    if (!s) return;
    if (openWithInfo && openWithInfo["png"]) {
      openWithInfo["jpg"] = openWithInfo["jpeg"];
      s.openWithInfo = openWithInfo;
      scopeEvalAsync();
    }
  });

  // ── move-to-folders / rebind-refresh / open-item / go-folder / go-smart-folder（23718-23782）──
  ipc.on('move-to-folders', function (event: any) {
    const s = sNow();
    if (!s) return;
    machineryMoveToFolders(s, event);
    scopeEvalAsync();
  });

  ipc.on('rebind-refresh', function (_e: any) {
    const s = sNow();
    if (!s) return;
    machineryRebindRefresh(s);
    scrollToSelectedItem();
  });

  ipc.on('open-item', function (_e: any, itemId: any) {
    const s = sNow();
    if (!s) return;
    const item = s.itemMappings[itemId];
    if (item) {
      const folders = item.folders;
      if (folders && folders.length > 0) {
        const firstFolder = s.folderMappings[folders[0]];
        openFolder(firstFolder);
        setTimeout(function () { machineryChangeSidebarIndex(firstFolder); scopeEvalAsync(); }, 200);
      }
      else {
        machineryOpenAll(s);
      }
      s.selected = [];
      syncInspectorFromScope();
      domainTimeout(s, function () {
        select(undefined, item);
        machineryEnterDetailMode(s, undefined, item);
        scrollToSelectedItem();
      }, 250);
      scopeEvalAsync();
      const cw = currentWindow();
      if (cw && cw.isMinimized()) {
        cw.restore();
      }
      if (cw) { cw.show(); cw.focus(); }
    }
  });

  ipc.on('go-folder', function (_e: any, folderId: any) {
    const s = sNow();
    if (!s) return;
    const folder = s.folderMappings[folderId];
    if (folder) {
      openFolder(folder);
      setTimeout(function () { machineryChangeSidebarIndex(folder); scopeEvalAsync(); }, 200);
      scopeEvalAsync();
      const cw = currentWindow();
      if (cw && cw.isMinimized()) {
        cw.restore();
      }
      if (cw) { cw.show(); cw.focus(); }
    }
  });

  ipc.on('go-smart-folder', function (_e: any, smartFolderId: any) {
    const s = sNow();
    if (!s) return;
    const smartFolder = s.smartFolderMappings[smartFolderId];
    if (smartFolder) {
      openSmartFolder(smartFolder);
      setTimeout(function () { machineryChangeSidebarIndex(smartFolder); scopeEvalAsync(); }, 200);
      scopeEvalAsync();
      const cw = currentWindow();
      if (cw && cw.isMinimized()) {
        cw.restore();
      }
      if (cw) { cw.show(); cw.focus(); }
    }
  });

  // ── 标签历史 / 文件夹 / 收藏（23783-23882 逐字；TagManager → scope）──
  ipc.on('add-history-tag', function (_e: any, tag: any) {
    const s = sNow();
    if (!s) return;
    s.TagManager.addHistoryTag(tag);
    s.TagManager.save();
    scopeEvalAsync();
  });
  ipc.on('add-history-tags', function (_e: any, tags: any) {
    const s = sNow();
    if (!s) return;
    s.TagManager.addHistoryTags(tags);
    scopeEvalAsync();
  });
  ipc.on('clear-history-tag', function (_e: any, _tag: any) {
    const s = sNow();
    if (!s) return;
    s.TagManager.historyTags = [];
    syncFilterFromScope();
    syncTagManagerFromScope();
    s.availableHistoryTags = [];
    s.TagManager.save();
    scopeEvalAsync();
  });
  ipc.on('prepend-folder', function (_e: any, folder: any) {
    const s = sNow();
    if (!s) return;
    machineryPrependFolder(s, folder);
    scopeEvalAsync();
  });
  ipc.on('new-folder', function (_e: any) {
    const s = sNow();
    if (!s) return;
    newFolder();
    scopeEvalAsync();
  });
  ipc.on('new-smart-folder', function (_e: any) {
    const s = sNow();
    if (!s) return;
    machineryNewSmartFolder();
    scopeEvalAsync();
  });

  // ── 上传队列隐藏 / 揭示图片 / 电源 / 窗口关闭（23877-23940 逐字）──
  ipc.on('hide-upload-queue', function () {
    const s = sNow();
    if (!s) return;
    if (s.uploadQueue.length === 0) {
      machineryHideUploadQueue();
      scopeEvalAsync();
    }
  });

  ipc.on('open-and-reveal-image', function (_e: any) {
    const s = sNow();
    if (!s) return;
    if (s.lastestAddItem) {
      const image = s.lastestAddItem;
      const folders = s.lastestAddItem.folders;
      if (folders && folders.length > 0 && folders[0] && s.folderMappings[folders[0]]) {
        openFolder(s.folderMappings[folders[0]]);
        s.selected = [];
        syncInspectorFromScope();
        domainTimeout(s, function () {
          select(undefined, image);
          scrollToSelectedItem();
        }, 500);
      }
      else {
        machineryOpenAll(s);
        s.selected = [];
        syncInspectorFromScope();
        domainTimeout(s, function () {
          select(undefined, image);
          scrollToSelectedItem();
        }, 500);
      }
    }
    else {
      s.selected = [];
      syncInspectorFromScope();
      machineryOpenAll(s);
    }
    scopeEvalAsync();
  });

  ipc.on('power-suspend', function (_event: any) {
    try {
      ipc.send('electron-info', "[app] stop api server");
      if (w.APIServer && w.APIServer.stop) w.APIServer.stop();
    }
    catch (err) {
      electronLog && electronLog.error((err as any).stack || err);
    }
  });

  ipc.on('power-resume', function (_event: any) {
    try {
      ipc.send('electron-info', "[app] start api server");
      if (w.APIServer && w.APIServer.start) w.APIServer.start();
      window.dispatchEvent(new Event("resize"));
    }
    catch (err) {
      electronLog && electronLog.error((err as any).stack || err);
    }
  });

  ipc.on('window-close', function () {
    const s = sNow();
    if (!s) return;
    if (s.isDetailMode) {
      const video = q(".detail-wrap video") as HTMLVideoElement | null;
      if (video && !video.paused) { video.pause(); }
    }
  });

  // ── 偏好 / 幻灯片 / 徽标 / 目录 / 字体 / 揭示（23940-23987 逐字）──
  ipc.on('open-preferences', function (_e: any, params: any) {
    const s = sNow();
    if (!s) return;
    if (s.$root.isAppLocked) return;
    ipc.send('open.preferences', params);
  });

  ipc.on('toggle-slideshow', function (_e: any) {
    const s = sNow();
    if (!s) return;
    machineryToggleSlideshow(s);
    scopeEvalAsync();
  });

  ipc.on('leave-slideshow', function (_e: any) {
    const s = sNow();
    if (!s) return;
    scopeEvalAsync();
  });

  ipc.on('show-sidebar-badge', function (_e: any) {
    const s = sNow();
    if (!s) return;
    s.$root.preferences.general.showSidebarBadge = true;
    syncToolbarFromScope();
    syncBodyFromScope();
    syncDetailFromScope();
    scopeEvalAsync();
  });

  ipc.on('hide-sidebar-badge', function (_e: any) {
    const s = sNow();
    if (!s) return;
    s.$root.preferences.general.showSidebarBadge = false;
    syncToolbarFromScope();
    syncBodyFromScope();
    syncDetailFromScope();
    scopeEvalAsync();
  });

  ipc.on('import-folders', function (_e: any) {
    const s = sNow();
    if (!s) return;
    importFolders();
    scopeEvalAsync();
  });

  ipc.on('activate-font', function (_e: any, item: any) {
    const s = sNow();
    if (!s) return;
    activateFont(item, { showNotify: false, updateView: true });
  });

  ipc.on('deactivate-font', function (_e: any, item: any) {
    const s = sNow();
    if (!s) return;
    deactivateFont(item, { showNotify: false, updateView: true });
  });

  ipc.on('reveal-in-eagle', function (_e: any, it: any) {
    const s = sNow();
    if (!s) return;
    const item = s.itemMappings[it.id];
    let folder;
    if (!item) return;
    if (item.folders && item.folders.length > 0) {
      folder = s.folderMappings[item.folders[0]];
    }
    machineryQuickOpenFolder(s, folder, item);
    scopeEvalAsync();
  });

  // ── open-unregister（24013 逐字；$http → $.ajax Promise 等价；Registration/machineID = window）──
  ipc.on('open-unregister', function (_e: any) {
    const s = sNow();
    if (!s) return;

    function unregister({ email, licenseCode, machineID }: any, url: string, callback: any): void {
      // Angular $http.post(...).then(success, failure)：response 带 .data 包装；fetch Promise 同语义
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          licenseCode: licenseCode,
          machineID: machineID,
        }),
      }).then(function (r: any) { return r.json(); }).then(function (resp: any) {
        const data = { data: resp };
        electronLog && electronLog.info(`[app] Unregister successfully, email: ${s.email}`);
        domainTimeout(s, function () {
          const result = data.data;
          try { ipc.send('electron-info', result); }
          catch (err) { /* noop */ }
          if (result && result.error !== undefined) {
          }
          else {
            callback && callback();
          }
        });
      }, function () {
        callback({}, undefined);
      });
    }

    scopeEvalAsync(function () {
      if (!swal) return;
      swal({
        html: `
          <div class="alert">
            <div class="alert-icon warning"></div>
            <h4 class="alert-title">${w.i18n.__("dialog.unregister.title")}</h4>
            <p class="alert-desc">${w.i18n.__("dialog.unregister.desc")}</p>
          </div>
        `,
        showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
        width: 400,
        customClass: "alert-box",
        cancelButtonColor: "#777777",
        confirmButtonText: w.i18n.__('dialog.unregister.unregisterBtn'),
        cancelButtonText: w.i18n.__("general.cancel"),
      }).then(function () {

        const email = w.Registration.license.email;
        const params = {
          email: w.Registration.license.email,
          licenseCode: w.Registration.license.code,
          machineID: w.machineID,
        };

        unregister(params, "https://core.eagle.cool/unregister", function (err: any, _data: any) {
          if (err) {
            electronLog && electronLog.error(`[app] Can not access server: https://core.eagle.cool/unregister`);
            electronLog && electronLog.error(err.stack || err);
            unregister(params, "https://en.eagle.cool/unregister", function (err2: any) {
              if (err2) {
                electronLog && electronLog.error(`[app] Can not access server: https://en.eagle.cool/unregister`);
                electronLog && electronLog.error(err2.stack || err2);
                unregister(params, "http://120.79.10.37/unregister", function (err3: any) {
                  if (err3) {
                    electronLog && electronLog.error(`[app] Can not access server: http://120.79.10.37/unregister`);
                    electronLog && electronLog.error(err3.stack || err3);
                  }
                });
              }
            });
          }
        });

        w.Registration = {
          activated: false,
          expireDate: Date.now()
        };

        setTimeout(function () {
          ipc.send("remove-registration");
          s.$root.initMenu();
          electronLog && electronLog.info(`[app] Unregister successfully, email: ${email}`);
        }, 2000);
      });
    });
  });

  // ── get-current-folder / get-recent-folders / add-recent-folders（24095-24110 逐字）──
  ipc.on('get-current-folder', function (_event: any) {
    const s = sNow();
    if (!s) return;
    scopeEvalAsync(function () {
      ipc.send("current-folder", s.currentFolder);
    });
  });

  ipc.on('get-recent-folders', function (_event: any) {
    const s = sNow();
    if (!s) return;
    const recentFolders = machineryGetRecentFolders();
    ipc.send("get-recent-folders", recentFolders);
  });

  ipc.on('add-recent-folders', function (_event: any, folders: any) {
    const s = sNow();
    if (!s) return;
    addToRecentFolders(folders);
  });

  // ── image-processing-error（30402 逐字）──
  ipc.on('image-processing-error', function (_e: any, errorItem: any) {
    const s = sNow();
    if (!s) return;
    // 针对特定文件提供错误帮助
    if (errorItem && errorItem.object) {
      const obj = errorItem.object;
      const ext = obj.ext;
      if (obj.reason && obj.reason.indexOf("UNKNOWN: unknown error") > -1) {
        errorItem.reason = w.i18n.__("modal.importError.reason.unknown");
      }
    }

    // 针对特定类型（超时）提供错误帮助
    s.errorList.push(errorItem);
    syncErrorCount();
    if (s.errorList.length === 1) {
      if (s.$root.preferences.notification.soundEffect.enable != 'false') {
        s.errorSound.play();
        openErrorModal();
      }
      setTimeout(() => {
        ipc.send('show-inactive');
      }, 500);
    }
    scopeEvalAsync();
  });

  // ── remove-trash-item（36999 逐字）──
  ipc.on('remove-trash-item', function (_e: any) {
    const s = sNow();
    if (!s) return;
    s.currentTrashRemoved++;
    s.removeProgress = s.currentTrashRemoved / s.trashRemoved * 100;
    s.removeProgress = (s.removeProgress > 100) ? 100 : s.removeProgress;
    scopeEvalAsync();
    if (s.currentTrashRemoved >= s.trashRemoved || s.removeProgress > 98) {
      s.isCleaningTrash = false;
      syncSidebarFromScope();
      s.trashRemoved = 0;
      s.currentTrashRemoved = 0;
      IPCHelper.send('palette-resume');
      scopeEvalAsync();
    }
  });

  // ── ondragend（52413 逐字；dragging → window）──
  ipc.on('ondragend', function () {
    w.dragging = false;
    console.log("ondragend");
  });

  // ── RootController 块：app-expired / change.current.theme / change.zoom ──
  ipc.on('app-expired', function () {
    cssSet("body", {
      "pointer-events": "none",
      "opacity": "0.3"
    });
  });

  ipc.on('change.current.theme', function (_e: any, theme: any) {
    const r = rNow();
    if (!r) return;
    if (theme.name === "Auto") {
      if (remote.nativeTheme.shouldUseDarkColors) {
        r.theme = "gray";
      }
      else {
        r.theme = "light";
      }
    }
    else {
      r.theme = theme.css || "gray";
    }
    scopeEvalAsync();
  });

  ipc.on('change.zoom', function (_e: any, zoom: any) {
    try {
      const webFrame = w.require && w.require('electron') && w.require('electron').webFrame;
      if (webFrame && webFrame.setZoomFactor) webFrame.setZoomFactor(parseInt(zoom, 10) / 100);
    } catch (err) { /* noop */ }
  });

  // ── jieba-extract-done（48725 逐字；标签推荐域收编——languageBCP 闭包变量经
  //    $rootScope.language 等价重算，stopword 经 require）──
  diag.removed['jieba-extract-done'] = removeChannelListenersBySource(ipc, 'jieba-extract-done', [
    '取得推荐标签',
  ]);
  ipc.on('jieba-extract-done', function (_e: any, result: any) {
    const s = sNow();
    if (!s) return;

    // console.timeEnd("======== 取得推荐标签 ========");

    const selectedTags = w.eagle.inspector.calculateTags(s.selected);

    result.forEach(function (term: any) {
      const idx = s.TagManager.suggestions.indexOf(term.word);
      // var existIdx = selectedTags.indexOf(term.word);

      if (idx == -1 && term.word.split(/d/).length < 3 && term.word.localeLength() >= 2) {
        s.TagManager.suggestions.push(term.word.capitalize());
      }
    });

    s.TagManager.suggestions = s.TagManager.excludeExistTags(selectedTags, s.TagManager.suggestions);
    syncFilterFromScope();
    syncTagManagerFromScope();
    // TagManager.suggestions = TagManager.suggestions.unique();
    s.TagManager.suggestions = [...new Set(s.TagManager.suggestions)];
    syncFilterFromScope();
    syncTagManagerFromScope();

    // 移除 Stopword
    const sw = w.require('stopword');
    s.TagManager.suggestions = sw.removeStopwords(s.TagManager.suggestions);
    syncFilterFromScope();
    syncTagManagerFromScope();
    s.TagManager.suggestions = sw.removeStopwords(s.TagManager.suggestions, sw.zh);
    syncFilterFromScope();
    syncTagManagerFromScope();
    s.TagManager.suggestions = sw.removeStopwords(s.TagManager.suggestions, sw.ja);
    syncFilterFromScope();
    syncTagManagerFromScope();

    // Note: 优先将已经有标签放在最前方，剩下的标签使用标题排序放在后面
    s.TagManager.suggestions = s.TagManager.suggestions.sort(function (a: any, b: any) {
      if (s.TagManager.tagMappings[a])
        return -1;
      if (s.TagManager.tagMappings[b])
        return 1;
      try {
        const na = a.toLowerCase();
        const nb = b.toLowerCase();
        const languageBCP = (rNow().language || 'en').replace("_", "-");
        if (na && na) {
          return na.localeCompare(nb, languageBCP, { numeric: true });
        }
      }
      catch (err) { /* noop */ }
      return 0;
    });
    syncFilterFromScope();
    syncTagManagerFromScope();
    scopeEvalAsync();
  });
}

// ═══ b1-9bz-A：controllerFns 表体归位（逐字平移；getScope()→getBodyScope()；表项指针化）═══
// —— controllerFns 模块级声明随迁（verbatim；按原声明顺序防 TDZ）——
const _req: any = (n: string) => { try { return (window as any).require(n); } catch (err) { return undefined; } };

const currentWindow: any = (window as any).electron?.remote?.getCurrentWindow?.() || _req('@electron/remote')?.getCurrentWindow?.();

const electronLog: any = (window as any).electronLog || console;

const __cf_ipcRenderer: any = (window as any).__eagleIpc || (window as any).electron?.ipcRenderer;

const systemPreferences: any = _req('@electron/remote')?.systemPreferences;

const remote: any = _req('@electron/remote');

const $timeout: any = (fn: any, ms?: number) => setTimeout(() => {
  try { if (typeof fn === 'function') fn(); } finally { try { scopeEvalAsync(); } catch (err) { /* noop */ } }
}, ms || 0);
// b1-9bz-A 收口：`$timeout.cancel(timer)` 是 Angular 注入服务的第二形态（详见 filterDomain
// 同款注释）。本落点此前只有调用形态 → __lv_zoomInitTimeout 取消点 `$timeout.cancel is not a
// function` 即抛，且被上层 electronLog 缺席的 catch 静默吞掉。语义 = 取消延时执行。
$timeout.cancel = function (timer: any): boolean {
  if (timer === null || timer === undefined) return false;
  try { clearTimeout(timer); } catch (err) { /* noop */ }
  return true;
};

// —— link 级共享态（原 makeControllerFns 闭包声明）——
var __lv_zoomInitTimeout: any;

let lvInited = false;
const initLinkVars = () => {
  if (lvInited) return;
  lvInited = true;
};

const getScope = getBodyScope;  // b1-9bz-A：原 makeControllerFns(getScope) 注入的等价别名

export function changeOrderBy(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (orderBy) {
            if (s.currentFolder) {
                machinerySetFolderOrder(s, s.currentFolder, orderBy);
                try { electronLog && electronLog.info(`[app] Change folder order to “${s.currentFolder.name}(${s.currentFolder.id})” order by: ${orderBy}`); } catch (err) {};
            }
            else if (s.currentSmartFolder) {
                machinerySetSmartFolderOrder(s, s.currentSmartFolder, orderBy);
                try { electronLog && electronLog.info(`[app] Change smart-folder order to “${s.currentSmartFolder.name}(${s.currentSmartFolder.id})” order by: ${orderBy}`); } catch (err) {};
            }
            else {
                if (orderBy) {
                    s.orderBy = orderBy;
                    syncBodyFromScope();
                    s.orderByName = i18n.__(`context.order.orderBy>${s.orderBy.toLowerCase()}`);
                    localStorage.setItem(`eagle.list.orderBy.${s.rootDir}`, s.orderBy);
                    machinerySortRawData(s, s.orderBy);
                    machineryRebindRefresh(s);
                    scopeEvalAsync();
                    try { electronLog && electronLog.info(`[app] Change global list order to: ${orderBy}`); } catch (err) {};
                }
            }
            updateCurrentOrderAndIncrease();
        }).apply(null, args);
  }

export function cleanLibraryPathPermissionError(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event) {
            s.libraryPathPermissionError = false;
        }).apply(null, args);
  }

export function cleanLocalhostError(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event) {
            s.localhostError = false;
        }).apply(null, args);
  }

export function contentFocus(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function($event) {
            s.$root.currentFocus = "content";
        }).apply(null, args);
  }

export function dblclickContentPanel(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            if (!s.isCropMode) {
                machineryLeaveDetailMode(s);
            }    
        }).apply(null, args);
  }

export function escHandler(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function($event) {
            if (q(".swal2-container")) return;
            if (q(".select-panel.open:not(.pinned)")) {
                removeClass(".select-panel.open", "open");
                return;
            }
            s.selectedFolder = undefined;
            if (s.isSlideshowMode) {
                s.isSlideshowMode = false;
                __cf_ipcRenderer.send("leave-slideshow");
                return;
            }
            if (!s.isDetailMode) {
                if (document.activeElement?.tagName !== "INPUT") {
                    cleanSelected($event);
                }
            } 
            else {
                if (s.isCropMode) {
                    s.isCropMode = false;
                    syncDetailFromScope();
                }
                else if (AnnotationPreview.isShow) {
                	AnnotationPreview.hide();
                }
                else {
                    machineryLeaveDetailMode(s);
                }
            }
            if (s.isPreviewing) {
                if (process.platform == 'darwin') {
                    __cf_ipcRenderer.send('quicklook', s.selected[0]);
                    s.isPreviewing = false;
                }
                return;
            }
        }).apply(null, args);
  }

export function leaveDetailMode(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {

            s.isCropMode = false;
            syncDetailFromScope();
            s.usingGifPlayer = false;
            syncDetailFromScope();
            if (s.isDetailMode) {
                
                machineryRememberScrollTops(s.current);

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
                $timeout.cancel(__lv_zoomInitTimeout);

                setTimeout(function() {
                    if (s.isDetailMode) return;
                    removeClass(".content-panel.detail-mode", "inline-mode open");
                    setScrollLeft(".smooth_zoom_preloader", 0);
                }, 50);

                s.isInlineMode = false;
                machineryFadeOutDetailMode();
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

                // b1-8：initMousetrap 为 bundle 闭包链（destoryMousetrap/buildMousetrap）——
                // strangling 期 bundle 自管重绑定 / post-b1 bridgeWhenReady 等价；此处跳过不阻塞清理
                try { initMousetrap(); } catch (err) { /* b1-8b 接装前可达性缺失，忽略 */ }
                clearInterval(s.gifUpadteInterval);
            }
        }).apply(null, args);
  }

export function maximize(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            if (process.platform == 'darwin') {
                var isMax = remote.systemPreferences.getUserDefault("AppleActionOnDoubleClick", "string") !== 'Minimize';
                if (isMax) {
                    if (!currentWindow.isMaximized()) {
                        currentWindow.maximize();
                        s.isMaximize = true;
                        syncToolbarFromScope();
                    } else {
                        currentWindow.unmaximize();
                        s.isMaximize = false;
                        syncToolbarFromScope();
                    }
                } else {
                    currentWindow.minimize();
                }
            }
        }).apply(null, args);
  }

export function openErrorModal(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            openErrorChannel.emit({
                errorList: s.errorList
            });
        }).apply(null, args);
  }

export function toggleFolderVisible(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            s.isExpandFolder = !s.isExpandFolder;
            syncSidebarFromScope();
            localStorage.setItem("eagle.sidebar.folder.expand", s.isExpandFolder);
            machineryUpdateSidebarList(s);
        }).apply(null, args);
  }

export function togglePaletteProcessing(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            if (s.paletteQueuePaused) {
                machineryResumePalette();
            }
            else {
                machineryPausePalette();
            }
        }).apply(null, args);
  }

export function toggleQuickAccessVisible(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            s.isExpandQuickAccess = !s.isExpandQuickAccess;
            syncSidebarFromScope();
            localStorage.setItem("eagle.sidebar.quickAccess.expand", s.isExpandQuickAccess);
            machineryUpdateSidebarList(s);
        }).apply(null, args);
  }

export function toggleSmartFolderVisible(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            s.isExpandSmartFolder = !s.isExpandSmartFolder;
            syncSidebarFromScope();
            localStorage.setItem("eagle.sidebar.smartFolder.expand", s.isExpandSmartFolder);
            machineryUpdateSidebarList(s);
        }).apply(null, args);
  }

export function undo(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 收敛到 machinery（machinery 带 typeof 守卫 + cgNotifyServiceCloseAll 兜底）。
  const s = getBodyScope();
  if (!s) return;   // 原 c3 体的 scope 守卫，逐字保留
  machineryUndo(s);
}

export function updateCurrentOrderAndIncrease () {
        	var orderBy;
            var sortIncrease;
            if (useFolderState.getState().currentFolder) {
                orderBy = useFolderState.getState().currentFolder.orderBy;
                if (useFolderState.getState().currentFolder.orderBy) {
                    sortIncrease = useFolderState.getState().currentFolder.sortIncrease;
                }
                else {
                    sortIncrease = useMiscRawState.getState().sortIncrease;
                }
            }
            else if (useFolderState.getState().currentSmartFolder) {
                if (useFolderState.getState().currentSmartFolder.orderBy) {
                    sortIncrease = useFolderState.getState().currentSmartFolder.sortIncrease;
                }
                else {
                    sortIncrease = useMiscRawState.getState().sortIncrease;
                }
                orderBy = useFolderState.getState().currentSmartFolder.orderBy;
            }
            else {
                orderBy = getBodyScope().orderBy;
                sortIncrease = useMiscRawState.getState().sortIncrease;
            }
            getBodyScope().currentOrderBy = orderBy;
            getBodyScope().currentSortIncrease = sortIncrease;
        }

export function updateSuggestions() {
            console.time("updateSuggestions");
            getBodyScope().searchIndex = -1;
            syncToolbarFromScope();
            var keyword = "";
            if (useListState.getState().keyword) {
                keyword = useListState.getState().keyword.toLowerCase();
            }

            getBodyScope().hsks = getBodyScope().historySearchKeywords.filter(function (word) {
                if (!keyword || keyword == "") return true;
                if (word) {
                    return fuzzy_match(word, keyword).length > 0;
                }
                return false;
            }).slice(0,8);
            syncToolbarFromScope();
            var suggestions = [];
            var wordsIndex = {};
            var dataset = [];
            var currPageTags = [];
            var allCount = $bodyScope.all.length;
            useMiscRawState.getState().containTags.forEach(function (tag) {
            	if (tag.imageCount && !tag.isNoTags) {
	            	currPageTags.push({
	            		word: tag.name.toLowerCase(),
	            		weight: tag.imageCount,
	            	})
            	}
            });

            if (!keyword) {
                // 推薦關鍵字，暫時移除，感覺多餘了
            	// suggestions = currPageTags;
            	// suggestions.forEach(function (suggestion) {
	        	// 	wordsIndex[suggestion.word] = suggestion.weight;
	        	// });

	        	// // 去重复
	            // var duplicatesMap = {};
	            // suggestions = suggestions.filter(function (suggestion) {
	            // 	if (!duplicatesMap[suggestion.word]) {
	            // 		duplicatesMap[suggestion.word] = true;
	            // 		return true;
	            // 	}
	            // 	return false;
	            // });

            	// suggestions = suggestions.sort(function(a, b) {
	            //     if(a.weight > b.weight) return -1;
	            //     if(a.weight < b.weight) return 1;
	            //     return 0;
	            // });

	            // if (suggestions.length > 5) {
	            //     suggestions.length = 5;
	            // }
            	getBodyScope().keywordSuggestions = suggestions;
            	syncToolbarFromScope();
                getBodyScope().keywordSuggestions = useMiscRawState.getState().keywordSuggestions.filter((suggestion) => {
                    return useMiscRawState.getState().hsks.indexOf(suggestion.word) === -1 && suggestion.word;
                });
                syncToolbarFromScope();
            	console.timeEnd("updateSuggestions");
            	return;
            }

            if (useMiscRawState.getState().globalKeywords && useMiscRawState.getState().globalKeywords.length) {
            	dataset = currPageTags.concat(useMiscRawState.getState().globalKeywords);
            }

            getBodyScope().keyword_cn = chineseConvert.tw2cn(keyword);
            getBodyScope().keyword_tw = chineseConvert.cn2tw(keyword);
            getBodyScope().isKeywordTW = keyword === useMiscRawState.getState().keyword_tw;
            getBodyScope().isKeywordCN = keyword === useMiscRawState.getState().keyword_cn;
            getBodyScope().isEnglish = getBodyScope().isKeywordTW === useMiscRawState.getState().isKeywordCN;

            if (keyword.length === 1 && useMiscRawState.getState().isContainAlphabet) {
                suggestions = dataset.filter(function(suggestion) {
                    return keyword.toLowerCase() === suggestion.word[0].toLowerCase();
                });
            }
            else {
                suggestions = dataset.filter(function(suggestion) {
                    var __lv_idx = suggestion.word.toLowerCase().indexOf(keyword);
                    if (getBodyScope().isEnglish) {
                        return (__lv_idx > -1);
                    }
                    else if (useMiscRawState.getState().isKeywordTW) {
                        return (__lv_idx > -1) && (suggestion.word != keyword) ||
                        (suggestion.word.indexOf(useMiscRawState.getState().keyword_cn) > -1)
                    }
                    else if (useMiscRawState.getState().isKeywordCN) {
                        return (__lv_idx > -1) && (suggestion.word != keyword) ||
                        (suggestion.word.indexOf(useMiscRawState.getState().keyword_tw) > -1)
                    }
                });
            }

            suggestions.forEach(function (suggestion) {
        		wordsIndex[suggestion.word] = suggestion.weight;
        	});

            suggestions = suggestions.sort(function(a, b) {
                if(a.weight > b.weight) return -1;
                if(a.weight < b.weight) return 1;
                return 0;
            });

            // 去重复
            var duplicatesMap = {};
            suggestions = suggestions.filter(function (suggestion) {
            	if (!duplicatesMap[suggestion.word]) {
            		duplicatesMap[suggestion.word] = true;
            		return true;
            	}
            	return false;
            });

            if (suggestions.length > 5) {
                suggestions.length = 5;
            }
            
            if (suggestions.length > 0) {
                if (suggestions.length === 1 && suggestions[0].word == useListState.getState().keyword) {

                }
                else {
                    // getBodyScope().showSuggestions = true;
                }
            }
            else {
                getBodyScope().showSuggestions = false;
                syncToolbarFromScope();
            }

            getBodyScope().keywordSuggestions = suggestions;
            syncToolbarFromScope();
            console.timeEnd("updateSuggestions");
        }


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
export function machineryMoveToFolders(_s: any, _e: any): void {}

export function machineryPausePalette(): void {
  const w = window as any;
  writeScopeField('paletteQueuePaused', true);
  syncSidebarFromScope();
  removeClass("#background-state-spinner .sm-spiner", "has-animation");
  w.IPCHelper.send('change-palette-pause');
}

export function machineryResumePalette(): void {
  const w = window as any;
  writeScopeField('paletteQueuePaused', false);
  syncSidebarFromScope();
  addClass("#background-state-spinner .sm-spiner", "has-animation");
  w.IPCHelper.send('change-palette-resume');
}


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
const CG_SPACING = 15;            // g

const CG_START_TOP = 10;          // f

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

/* cgNotify closeAll（bundle 16724 o.closeAll 逐字：全栈 opacity 0） */
export function cgNotifyServiceCloseAll(): void {
  for (let a = cgStack.length - 1; a >= 0; a--) {
    cgStack[a].style.opacity = 0;
  }
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

const cgScopes: any[] = [];       // n：scope 桩栈

// ── c17b 域内自管（cgNotify 闭包状态 f/g/h/l/m/n + undoTimeout 20255 邻域）──
const cgStack: any[] = [];        // m：已附加的消息元素栈

/* languageBCP 重算（bundle 20053 逐字；初值 "en"） */
export function getLanguageBCP(s: any): string {
  try {
    const lang = s.language ?? s.$root?.language ?? 'en';
    return String(lang).replace('_', '-');
  } catch (err) {
    return 'en';
  }
}

export function machineryCheckTouchIDSupport(): void {
  const w = window as any;
  let systemPreferences: any = null;
  try {
    systemPreferences = w.require && w.require('@electron/remote').systemPreferences;
  } catch (err) { /* noop */ }
  if (w.process && w.process.platform === 'darwin' && systemPreferences && systemPreferences.canPromptTouchID) {
    try {
      writeScopeField('canUseTouchID', systemPreferences.canPromptTouchID());
    } catch (err) {
      console.error('檢查 Touch ID 支援時發生錯誤:', err);
      writeScopeField('canUseTouchID', false);
    }
  }
}

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
        machineryPreloadImage("next");
      }, 200);
    }
    machineryAddToRecentFile(s.current);
    w.removePlayingAudios();
    w.HoverPreview.hide();
  }, duration);
}

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

/* fadeOutDetailMode（bundle 31672-31678 逐字：selected 首盒 popdown 100ms） */
export function machineryFadeOutDetailMode(): void {
  var $box = q(".box.selected");
  if ($box) $box.classList.add("popdown");
  setTimeout(function () {
    if ($box) $box.classList.remove("popdown");
  }, 100);
}

export function machineryFocusAppUnlockPassword(): void {
  setTimeout(() => {
    focusEl("#app-lock-password-input");
  }, 24);
  q("#app-lock-password-input")?.addEventListener("blur", () => {
    setTimeout(() => {
      focusEl("#app-lock-password-input");
    }, 24);
  });
}

export function machineryLeaveDetailMode(s: any): void {
  const w = window as any;
  const $timeout = getTimeout();

  s.isCropMode = false;
  syncDetailFromScope();
  s.usingGifPlayer = false;
  syncDetailFromScope();
  if (s.isDetailMode) {

    machineryRememberScrollTops(s.current);

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
    machineryFadeOutDetailMode();
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

/* lockApp（bundle 29016-29023 逐字）+ focusAppUnlockPassword（29025-29034 逐字） */
export function machineryLockApp(s: any): void {
  const w = window as any;
  s.$root.isAppLocked = true;
  if (s.$root && typeof s.$root.initMenu === 'function') s.$root.initMenu();
  setTimeout(function () {
    machineryFocusAppUnlockPassword();
  }, 100);
}

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

/* openPluginPanel（bundle 37324 逐字：OPEN_PLUGIN_PANEL 广播，含 // return 注释逐字） */
export function machineryOpenPluginPanel(event: any): void {
  // return;
  openPluginPanelChannel.emit();
}

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

export function machineryToggleDetailMode(s: any, $event: any, isInline: any): void {
  detailToggleDetailMode(s, $event, isInline);
}

/* toggleSlideshow（bundle 23816-23823 逐字；enter/leaveSlideshowMode 经 scope 解析） */
export function machineryToggleSlideshow(s: any): void {
  if (!s.isSlideshowMode) {
    machineryEnterSlideshowMode(s);
  } else {
    machineryLeaveSlideshowMode(s);
  }
}

// ── c16a 域内自管（原 controller 闭包 var：zoomInitTimeout，31586）──
let zoomInitTimeout: any = null;
