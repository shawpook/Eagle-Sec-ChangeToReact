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

declare const IPCHelper: any;
declare const remote: any;

let done = false;

function domainTimeout(s: any, fn: any, ms?: number): any {
  return setTimeout(() => {
    try { if (typeof fn === 'function') fn(); } finally { try { s.$apply(); } catch (err) { /* noop */ } }
  }, ms || 0);
}

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

export function takeoverMiscDomain(): void {
  if (done) return;
  done = true;
  const w = window as any;
  const ipc: any = ipcRenderer();
  if (!ipc || typeof ipc.on !== 'function') return;

  const diag: any = { takenOver: true, removed: {} as Record<string, number> };
  w.__eagleMiscDomain = diag;

  const electronLog: any = w.electronLog || console;
  const $: any = w.$;
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
    ['leave-slideshow', ['$scope.$evalAsync();']],
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
      const showAlert = s.uploadQueue.length > 0 || s.downloadQueueLength > 0 || s.metadataQueueLength > 0 || s.isCleaningTrash || s.isImporting || $(".progress-dialog.open").not(".library-loading-dialog").length > 0 || $("#saving-progress-bar.open").length > 0;
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
      s.findDupclipate(undefined);
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
    s.lockApp();
    s.$root.$evalAsync();
  });

  // ── window.maximize / window.unmaximize（22465/22483 逐字）──
  ipc.on('window.maximize', function () {
    const s = sNow();
    if (!s) return;
    setTimeout(function () {
      s.boxContianerWidth = $("#box-container").width() || s.boxContianerWidth;
      s.boxContianerHeight = $("#box-container").height() || s.boxContianerHeight;
    }, 200);
    s.isMaximize = true;
    syncToolbarFromScope();
    s.lastItemStates = {};
    s.$evalAsync();
  });

  ipc.on('window.unmaximize', function () {
    const s = sNow();
    if (!s) return;
    setTimeout(function () {
      s.boxContianerWidth = $("#box-container").width() || s.boxContianerWidth;
      s.boxContianerHeight = $("#box-container").height() || s.boxContianerHeight;
    }, 200);
    s.isMaximize = false;
    syncToolbarFromScope();
    s.lastItemStates = {};
    s.$evalAsync();
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
    if ($("#extract-eaglepack-progress").hasClass("open")) return;

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
    const showAlert = s.uploadQueue.length > 0 || s.downloadQueueLength > 0 || s.metadataQueueLength > 0 || s.isCleaningTrash || s.isImporting || $(".progress-dialog.open").not(".library-loading-dialog").length > 0 || $("#saving-progress-bar.open").length > 0;
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
    s.$evalAsync(function () {
      s.progress = progress;
      syncUploadFromScope();
    });
  });
  ipc.on('add-download-task', function () {
    const s = sNow();
    if (!s) return;
    s.$evalAsync(function () {
      s.uploadQueue.push({});
      syncUploadFromScope();
    });
  });
  ipc.on('add-download-tasks', function (_event: any, count: any) {
    const s = sNow();
    if (!s) return;
    s.$evalAsync(function () {
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
    s.$evalAsync();
  });

  // ── load-open-with（23527 逐字）──
  ipc.on('load-open-with', function (_e: any, openWithInfo: any) {
    const s = sNow();
    if (!s) return;
    if (openWithInfo && openWithInfo["png"]) {
      openWithInfo["jpg"] = openWithInfo["jpeg"];
      s.openWithInfo = openWithInfo;
      s.$evalAsync();
    }
  });

  // ── move-to-folders / rebind-refresh / open-item / go-folder / go-smart-folder（23718-23782）──
  ipc.on('move-to-folders', function (event: any) {
    const s = sNow();
    if (!s) return;
    s.moveToFolders(event);
    s.$evalAsync();
  });

  ipc.on('rebind-refresh', function (_e: any) {
    const s = sNow();
    if (!s) return;
    s.rebindRefresh();
    s.scrollToSelectedItem();
  });

  ipc.on('open-item', function (_e: any, itemId: any) {
    const s = sNow();
    if (!s) return;
    const item = s.itemMappings[itemId];
    if (item) {
      const folders = item.folders;
      if (folders && folders.length > 0) {
        const firstFolder = s.folderMappings[folders[0]];
        s.openFolder(firstFolder);
        setTimeout(function () { s.changeSidebarIndex(firstFolder); s.$evalAsync(); }, 200);
      }
      else {
        s.openAll();
      }
      s.selected = [];
      syncInspectorFromScope();
      domainTimeout(s, function () {
        s.select(undefined, item);
        s.enterDetailMode(undefined, item);
        s.scrollToSelectedItem();
      }, 250);
      s.$evalAsync();
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
      s.openFolder(folder);
      setTimeout(function () { s.changeSidebarIndex(folder); s.$evalAsync(); }, 200);
      s.$evalAsync();
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
      s.openSmartFolder(smartFolder);
      setTimeout(function () { s.changeSidebarIndex(smartFolder); s.$evalAsync(); }, 200);
      s.$evalAsync();
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
    s.$evalAsync();
  });
  ipc.on('add-history-tags', function (_e: any, tags: any) {
    const s = sNow();
    if (!s) return;
    s.TagManager.addHistoryTags(tags);
    s.$evalAsync();
  });
  ipc.on('clear-history-tag', function (_e: any, _tag: any) {
    const s = sNow();
    if (!s) return;
    s.TagManager.historyTags = [];
    syncFilterFromScope();
    syncTagManagerFromScope();
    s.availableHistoryTags = [];
    s.TagManager.save();
    s.$evalAsync();
  });
  ipc.on('prepend-folder', function (_e: any, folder: any) {
    const s = sNow();
    if (!s) return;
    s.prependFolder(folder);
    s.$evalAsync();
  });
  ipc.on('new-folder', function (_e: any) {
    const s = sNow();
    if (!s) return;
    s.newFolder();
    s.$evalAsync();
  });
  ipc.on('new-smart-folder', function (_e: any) {
    const s = sNow();
    if (!s) return;
    s.newSmartFolder();
    s.$evalAsync();
  });

  // ── 上传队列隐藏 / 揭示图片 / 电源 / 窗口关闭（23877-23940 逐字）──
  ipc.on('hide-upload-queue', function () {
    const s = sNow();
    if (!s) return;
    if (s.uploadQueue.length === 0) {
      s.hideUploadQueue();
      s.$evalAsync();
    }
  });

  ipc.on('open-and-reveal-image', function (_e: any) {
    const s = sNow();
    if (!s) return;
    if (s.lastestAddItem) {
      const image = s.lastestAddItem;
      const folders = s.lastestAddItem.folders;
      if (folders && folders.length > 0 && folders[0] && s.folderMappings[folders[0]]) {
        s.openFolder(s.folderMappings[folders[0]]);
        s.selected = [];
        syncInspectorFromScope();
        domainTimeout(s, function () {
          s.select(undefined, image);
          s.scrollToSelectedItem();
        }, 500);
      }
      else {
        s.openAll();
        s.selected = [];
        syncInspectorFromScope();
        domainTimeout(s, function () {
          s.select(undefined, image);
          s.scrollToSelectedItem();
        }, 500);
      }
    }
    else {
      s.selected = [];
      syncInspectorFromScope();
      s.openAll();
    }
    s.$evalAsync();
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
      $(window).trigger("resize");
    }
    catch (err) {
      electronLog && electronLog.error((err as any).stack || err);
    }
  });

  ipc.on('window-close', function () {
    const s = sNow();
    if (!s) return;
    if (s.isDetailMode) {
      const video = $(".detail-wrap video")[0];
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
    s.toggleSlideshow();
    s.$evalAsync();
  });

  ipc.on('leave-slideshow', function (_e: any) {
    const s = sNow();
    if (!s) return;
    s.$evalAsync();
  });

  ipc.on('show-sidebar-badge', function (_e: any) {
    const s = sNow();
    if (!s) return;
    s.$root.preferences.general.showSidebarBadge = true;
    syncToolbarFromScope();
    syncBodyFromScope();
    syncDetailFromScope();
    s.$evalAsync();
  });

  ipc.on('hide-sidebar-badge', function (_e: any) {
    const s = sNow();
    if (!s) return;
    s.$root.preferences.general.showSidebarBadge = false;
    syncToolbarFromScope();
    syncBodyFromScope();
    syncDetailFromScope();
    s.$evalAsync();
  });

  ipc.on('import-folders', function (_e: any) {
    const s = sNow();
    if (!s) return;
    s.importFolders();
    s.$evalAsync();
  });

  ipc.on('activate-font', function (_e: any, item: any) {
    const s = sNow();
    if (!s) return;
    s.activateFont(item, { showNotify: false, updateView: true });
  });

  ipc.on('deactivate-font', function (_e: any, item: any) {
    const s = sNow();
    if (!s) return;
    s.deactivateFont(item, { showNotify: false, updateView: true });
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
    s.quickOpenFolder(folder, item);
    s.$evalAsync();
  });

  // ── open-unregister（24013 逐字；$http → $.ajax Promise 等价；Registration/machineID = window）──
  ipc.on('open-unregister', function (_e: any) {
    const s = sNow();
    if (!s) return;

    function unregister({ email, licenseCode, machineID }: any, url: string, callback: any): void {
      // Angular $http.post(...).then(success, failure)：response 带 .data 包装；jqXHR 同 Promise 语义
      $.ajax({
        type: 'POST',
        url: url,
        data: JSON.stringify({
          email: email,
          licenseCode: licenseCode,
          machineID: machineID,
        }),
        contentType: 'application/json',
      }).then(function (resp: any) {
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

    s.$evalAsync(function () {
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
    s.$evalAsync(function () {
      ipc.send("current-folder", s.currentFolder);
    });
  });

  ipc.on('get-recent-folders', function (_event: any) {
    const s = sNow();
    if (!s) return;
    const recentFolders = s.getRecentFolders();
    ipc.send("get-recent-folders", recentFolders);
  });

  ipc.on('add-recent-folders', function (_event: any, folders: any) {
    const s = sNow();
    if (!s) return;
    s.addToRecentFolders(folders);
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
        s.openErrorModal();
      }
      setTimeout(() => {
        ipc.send('show-inactive');
      }, 500);
    }
    s.$evalAsync();
  });

  // ── remove-trash-item（36999 逐字）──
  ipc.on('remove-trash-item', function (_e: any) {
    const s = sNow();
    if (!s) return;
    s.currentTrashRemoved++;
    s.removeProgress = s.currentTrashRemoved / s.trashRemoved * 100;
    s.removeProgress = (s.removeProgress > 100) ? 100 : s.removeProgress;
    s.$evalAsync();
    if (s.currentTrashRemoved >= s.trashRemoved || s.removeProgress > 98) {
      s.isCleaningTrash = false;
      syncSidebarFromScope();
      s.trashRemoved = 0;
      s.currentTrashRemoved = 0;
      IPCHelper.send('palette-resume');
      s.$evalAsync();
    }
  });

  // ── ondragend（52413 逐字；dragging → window）──
  ipc.on('ondragend', function () {
    w.dragging = false;
    console.log("ondragend");
  });

  // ── RootController 块：app-expired / change.current.theme / change.zoom ──
  ipc.on('app-expired', function () {
    $("body").css({
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
    r.$evalAsync();
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
    s.$evalAsync();
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
  try { if (typeof fn === 'function') fn(); } finally { try { getBodyScope().$apply(); } catch (err) { /* noop */ } }
}, ms || 0);

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
                s.setFolderOrder(s.currentFolder, orderBy);
                try { electronLog && electronLog.info(`[app] Change folder order to “${s.currentFolder.name}(${s.currentFolder.id})” order by: ${orderBy}`); } catch (err) {};
            }
            else if (s.currentSmartFolder) {
                s.setSmartFolderOrder(s.currentSmartFolder, orderBy);
                try { electronLog && electronLog.info(`[app] Change smart-folder order to “${s.currentSmartFolder.name}(${s.currentSmartFolder.id})” order by: ${orderBy}`); } catch (err) {};
            }
            else {
                if (orderBy) {
                    s.orderBy = orderBy;
                    syncBodyFromScope();
                    s.orderByName = i18n.__(`context.order.orderBy>${s.orderBy.toLowerCase()}`);
                    localStorage.setItem(`eagle.list.orderBy.${s.rootDir}`, s.orderBy);
                    s.sortRawData(s.orderBy);
                    s.rebindRefresh();
                    s.$evalAsync();
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
                s.leaveDetailMode();
            }    
        }).apply(null, args);
  }

export function escHandler(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function($event) {
            if ($(".swal2-container").length > 0) return;
            if ($(".select-panel.open:not(.pinned)").length > 0) {
                $(".select-panel.open").removeClass("open");
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
                    s.cleanSelected($event);
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
                    s.leaveDetailMode();
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
                
                s.rememberScrollTops(s.current);

                s.isDetailMode = false;
                s.showDetailImage = false;
                syncDetailFromScope();
                s.smoothZoomDone = false;
                syncDetailFromScope();
                s.commentRect = undefined;
                syncDetailFromScope();
                // 記住上次播放位置
                s.rememberVideoCurrentTime(s.current); s.current = undefined;
                syncDetailFromScope();
                syncInspectorFromScope();
                $timeout.cancel(__lv_zoomInitTimeout);

                setTimeout(function() {
                    if (s.isDetailMode) return;
                    $(".content-panel.detail-mode").removeClass("inline-mode open");
                    $(".smooth_zoom_preloader").scrollLeft(0);
                }, 50);

                s.isInlineMode = false;
                s.fadeOutDetailMode();
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
            s.$root.$broadcast("OPEN_ERROR", {
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
            s.updateSidebarList();
        }).apply(null, args);
  }

export function togglePaletteProcessing(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function () {
            if (s.paletteQueuePaused) {
                s.resumePalette();
            }
            else {
                s.pausePalette();
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
            s.updateSidebarList();
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
            s.updateSidebarList();
        }).apply(null, args);
  }

export function undo(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function() {
            s.$root.undo();
            s.$root.closeAll();
        }).apply(null, args);
  }

export function updateCurrentOrderAndIncrease () {
        	var orderBy;
            var sortIncrease;
            if (getBodyScope().currentFolder) {
                orderBy = getBodyScope().currentFolder.orderBy;
                if (getBodyScope().currentFolder.orderBy) {
                    sortIncrease = getBodyScope().currentFolder.sortIncrease;
                }
                else {
                    sortIncrease = getBodyScope().sortIncrease;
                }
            }
            else if (getBodyScope().currentSmartFolder) {
                if (getBodyScope().currentSmartFolder.orderBy) {
                    sortIncrease = getBodyScope().currentSmartFolder.sortIncrease;
                }
                else {
                    sortIncrease = getBodyScope().sortIncrease;
                }
                orderBy = getBodyScope().currentSmartFolder.orderBy;
            }
            else {
                orderBy = getBodyScope().orderBy;
                sortIncrease = getBodyScope().sortIncrease;
            }
            getBodyScope().currentOrderBy = orderBy;
            getBodyScope().currentSortIncrease = sortIncrease;
        }

export function updateSuggestions() {
            console.time("updateSuggestions");
            getBodyScope().searchIndex = -1;
            syncToolbarFromScope();
            var keyword = "";
            if (getBodyScope().keyword) {
                keyword = getBodyScope().keyword.toLowerCase();
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
            getBodyScope().containTags.forEach(function (tag) {
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
                getBodyScope().keywordSuggestions = getBodyScope().keywordSuggestions.filter((suggestion) => {
                    return getBodyScope().hsks.indexOf(suggestion.word) === -1 && suggestion.word;
                });
                syncToolbarFromScope();
            	console.timeEnd("updateSuggestions");
            	return;
            }

            if (getBodyScope().globalKeywords && getBodyScope().globalKeywords.length) {
            	dataset = currPageTags.concat(getBodyScope().globalKeywords);
            }

            getBodyScope().keyword_cn = chineseConvert.tw2cn(keyword);
            getBodyScope().keyword_tw = chineseConvert.cn2tw(keyword);
            getBodyScope().isKeywordTW = keyword === getBodyScope().keyword_tw;
            getBodyScope().isKeywordCN = keyword === getBodyScope().keyword_cn;
            getBodyScope().isEnglish = getBodyScope().isKeywordTW === getBodyScope().isKeywordCN;

            if (keyword.length === 1 && getBodyScope().isContainAlphabet) {
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
                    else if (getBodyScope().isKeywordTW) {
                        return (__lv_idx > -1) && (suggestion.word != keyword) ||
                        (suggestion.word.indexOf(getBodyScope().keyword_cn) > -1)
                    }
                    else if (getBodyScope().isKeywordCN) {
                        return (__lv_idx > -1) && (suggestion.word != keyword) ||
                        (suggestion.word.indexOf(getBodyScope().keyword_tw) > -1)
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
                if (suggestions.length === 1 && suggestions[0].word == getBodyScope().keyword) {

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
