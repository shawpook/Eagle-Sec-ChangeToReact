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
 * - **app-status-loading / app-status-library-loaded / preload-library 留待 cZ-3b**：
 *   三者构成启动重管线（heartbeat/bg-handler 生命周期互相咬合），单独截肢会留下不可清理的
 *   bundle heartbeatInterval，随 cZ-3b 一并接管。
 */

import { removeChannelListenersBySource } from './appCore';
import { getBodyScope } from '../global/scopeBridge';
import { ipcRenderer } from '../global/eagleGlobals';

declare const ga4track: any;

let done = false;

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
}
