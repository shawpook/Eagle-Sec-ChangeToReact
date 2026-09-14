// @ts-nocheck
/**
 * R2 事件/IPC 总线族：shim 的 EventEmitter 总线、ipcRenderer facade、通道路由表、回程回退注册。
 *
 * 迁移自 `core/shimsLegacy.ts` 的 IIFE（原 798-910、1268-1726、1727-1837 区间），
 * 函数体逐字保留（含所有通道名的原拼写与注释取证）。
 * 与 R2 前的差别：①写路径状态改为复用 `core/ipcWriteState`（见下方 writeState）；
 * ②回程注册体包成 `installReturnBridgeFallback()`，由 `shim/install.ts` 显式调用（时序不变，
 * 仍为 0ms timer）；③预览面动作助手（runPreviewAction 等）随总线一同迁入（desktopCapability 消费）。
 */
import { bodyScope, desktopApi, nativeRequire } from "./environment";
import { applyPreferencesToCurrentDocument, broadcastIpc, savePreferences } from "./settingsI18n";
import { browserImportLocalFiles, browserImportUrl, browserImportUrls } from "./demoSeed";
import { getIpcWriteState } from "../ipcWriteState";
export class EventEmitter {
  constructor() {
    this.listeners = new Map();
  }

  on(channel, callback) {
    if (!this.listeners.has(channel)) this.listeners.set(channel, []);
    this.listeners.get(channel).push(callback);
    return this;
  }

  once(channel, callback) {
    const wrap = (...args) => {
      this.off(channel, wrap);
      callback(...args);
    };
    return this.on(channel, wrap);
  }

  off(channel, callback) {
    const list = this.listeners.get(channel) || [];
    this.listeners.set(channel, list.filter((fn) => fn !== callback));
    return this;
  }

  removeAllListeners(channel) {
    if (channel) this.listeners.delete(channel);
    else this.listeners.clear();
    return this;
  }

  emit(channel, ...args) {
    const list = (this.listeners.get(channel) || []).slice();
    list.forEach((callback) => {
      try {
        callback({}, ...args);
      } catch (err) {
        console.warn(`[eagle-shim] ipc listener error on ${channel}`, err);
      }
    });
    return true;
  }

  send(channel, params) {
    if (channel === 'update-main-window-id' || channel === 'check-for-update') return;
    console.debug('[eagle-shim] ipc send', channel, params);
  }

  sendTo(id, channel, params) {
    this.send(channel, params);
  }

  invoke(channel, params) {
    console.debug('[eagle-shim] ipc invoke', channel, params);
    if (channel === 'get-collect-window-data') {
      const items = window.__mockLibraryCache || [];
      const item = items.find((entry) => entry.id === 'MOCK0001') || items[0] || {};
      const lib = window.__mockLibrary || {};
      const imagesDir = lib.imagesDir || '/mock-library/Eagle Reverse Demo.library/images/';
      const name = item.name || 'Welcome Library';
      const ext = item.ext || 'png';
      return Promise.resolve({
        ok: true,
        canceled: false,
        filePath: '',
        filePaths: [],
        path: `${imagesDir}${item.id || 'MOCK0001'}.info/${encodeURIComponent(name)}.${ext}`,
        url: item.url || '',
        name,
        type: 'image',
        tags: item.tags || [],
        folders: item.folders || [],
        annotation: item.annotation || '',
        width: item.width || 0,
        height: item.height || 0,
        star: item.star || 0,
      });
    }
    return Promise.resolve({ canceled: true, filePaths: [], filePath: '', ok: true });
  }
}

export const ipcRenderer = new EventEmitter();
export const mockEmit = ipcRenderer.emit.bind(ipcRenderer);
export const emitIpc = ipcRenderer.emit.bind(ipcRenderer);
ipcRenderer.emit = function (channel, ...args) {
  if (channel === 'file-uploaded' && args[0] && args[0].id) {
    try {
      const scope = window.angular ? angular.element(document.body).scope() : null;
      // 实机 QA（2026-09-13）：Angular 退役后 scope 恒 null、守卫空转——补 React 侧
      // store 观测口（__eagleScopeRegistry.read('raw')，与 useItemState.raw 同一数组），
      // 使逐文件桥接与 emitImportedItems 收尾 emit 之间幂等。
      let rawList = scope && Array.isArray(scope.raw) ? scope.raw : null;
      if (!rawList) {
        const registry = window.__eagleScopeRegistry;
        const viaRegistry = registry && typeof registry.read === 'function' ? registry.read('raw') : null;
        if (Array.isArray(viaRegistry)) rawList = viaRegistry;
      }
      if (rawList && rawList.some((item) => item && item.id === args[0].id)) return true;
    } catch (err) {
      // Fall through to the normal event dispatch.
    }
  }
  if (channel === 'library:changed' || channel === 'preload-library' || channel === 'app-status-library-loaded') {
    // The library (or its items) changed under the document viewer — unmount it.
    // b1-9bz-E8：编排已迁 core/documentViewer.ts（React），经全局桥调用；pre-seam 窗口无桥则无 viewer 可卸载。
    if (typeof window.__eagleCloseDocumentViewer === 'function') {
      window.__eagleCloseDocumentViewer();
    }
  }
  return emitIpc(channel, ...args);
};
export const desktopSendChannels = new Set(['create-library', 'open-library', 'add-to-history-and-open']);

// P1-c-2 / R2：写路径共享状态一律复用 `core/ipcWriteState.ts` 的**同一实例**——主窗 React 启动期
// 经 installIpcWriteState() 安装 window.__eagleIpcWriteState；无 React 的窗口由 getIpcWriteState()
// 惰性自建等价实例。R2 前此处另存一份等价实现（队列/计数器/发布器第二真身），已删除。
export function writeState() {
  return getIpcWriteState();
}

export function previewCurrentItemId() {
  const scope = bodyScope();
  return scope && scope.current && scope.current.id ? scope.current.id : '';
}

export function dragStartItemIds(params) {
  const value = params && typeof params === 'object' ? params : {};
  let images = value.images;
  if (typeof images === 'string') {
    try {
      images = JSON.parse(images);
    } catch (err) {
      images = [];
    }
  }
  const imageIds = Array.isArray(images)
    ? images.map((entry) => (entry && entry.id) || (typeof entry === 'string' ? entry : '')).filter(Boolean)
    : [];
  const target = value.target;
  const targetId = (target && target.id) || (typeof target === 'string' ? target : '');
  if (targetId) imageIds.unshift(targetId);
  return [...new Set(imageIds.map((id) => String(id)).filter(Boolean))];
}

export function runPreviewAction(action, promise) {
  Promise.resolve(promise)
    .then((result) => mockEmit('preview:action-result', { ok: true, action, ...(result || {}) }))
    .catch((err) => mockEmit('preview:action-result', { ok: false, action, error: err.message }));
}

export function isCurrentPreviewRawPath(rawPath) {
  const scope = bodyScope();
  if (!scope || !scope.current || !scope.current.id || !scope.current.name || !scope.current.ext) return false;
  const expected = `${scope.libraryImagesPath || ''}/${scope.current.id}.info/${scope.current.name}.${scope.current.ext}`
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/');
  const actual = String(rawPath || '').replace(/\\/g, '/').replace(/\/+/g, '/');
  return expected === actual;
}

ipcRenderer.send = function (channel, params) {
  // b1-9ak：smoke:* 测试通道原生直通（未路由通道走 shim 本地总线会进 console.debug
  // 黑洞——menu-popup 闭环测试依赖 main 侧实收）
  if (String(channel || '').indexOf('smoke:') === 0 && nativeRequire) {
    try {
      nativeRequire('electron').ipcRenderer.send(channel, params);
    } catch (err) {
      console.warn('[eagle-shim] smoke channel send failed', channel, err);
    }
    return;
  }
  // b1-9as：update-txt-item 原生直通（text-editor 保存 → main 回发各渲染窗 →
  // itemDomain 既有监听更新 itemMappings[id].text；本地总线发不到 main）
  if (channel === 'update-txt-item' && nativeRequire) {
    try {
      nativeRequire('electron').ipcRenderer.send(channel, params);
    } catch (err) {
      console.warn('[eagle-shim] update-txt-item native send failed', err);
    }
    return;
  }
  // b1-9ar：empty-trash / cancel-empty-trash 原生直通（原 background 窗 trashQueue
  // 承载——main 侧逐 id 物理删除 + 回发 remove-trash-item；发送面 = ayncsImagesRemove
  // 分批串 + DuplicateFamily 四处 + cancelEmptyTrash 的 sendTo（shim sendTo 忽略 id
  // 落到本路由）。本地总线发不到 main）
  if ((channel === 'empty-trash' || channel === 'cancel-empty-trash') && nativeRequire) {
    try {
      nativeRequire('electron').ipcRenderer.send(channel, params);
    } catch (err) {
      console.warn('[eagle-shim] ' + channel + ' native send failed', err);
    }
    return;
  }
  // b1-9at：generate-hight-resolution-thumbnail 原生直通（native-viewer win32 面——
  // main 侧 b1-9at 走 backend nativePreview，成功落 finalFile 由轮询自取，失败回发
  // native-preview-failed）。nodeIntegration 下 window.ipcRenderer 原生不存在
  // （探针实证），供给 shim 版后 native/entry.tsx 的 parent.ipcRenderer.send 走本路由
  if (channel === 'generate-hight-resolution-thumbnail' && nativeRequire) {
    try {
      nativeRequire('electron').ipcRenderer.send(channel, params);
    } catch (err) {
      console.warn('[eagle-shim] generate-hight-resolution-thumbnail native send failed', err);
    }
    return;
  }
  // b1-9au：open-with-default 原生直通（主窗网格/菜单「以默认应用打开」——main 侧既有
  // ipcMain.on('open-with-default') handler 收 rawPath。下方 1587 附近的既有分支只服务
  // 预览窗（previewCurrentItemId 面），主窗路径此前黑洞。预览窗上下文仍走既有分支——
  // 其 runPreviewAction → preview:action-result 回程是 preview-delivery 闭环测试契约）
  if (channel === 'open-with-default' && typeof params === 'string' && nativeRequire && !previewCurrentItemId()) {
    try {
      nativeRequire('electron').ipcRenderer.send(channel, params);
    } catch (err) {
      console.warn('[eagle-shim] open-with-default native send failed', err);
    }
    return;
  }
  // b1-9au：duplicate-file / copy-thumbnails 原生直通（main 侧 b1-9aa 既有 handler——
  // 此前无 shim 路由致 UI 面创建副本/复制缩略图黑洞；channel-wiring 闭环曾因冒烟窗
  // 加载失败走原生 require 侥幸通过，全栈页面下实锚黑洞）
  if ((channel === 'duplicate-file' || channel === 'copy-thumbnails') && nativeRequire) {
    try {
      nativeRequire('electron').ipcRenderer.send(channel, params);
    } catch (err) {
      console.warn('[eagle-shim] ' + channel + ' native send failed', err);
    }
    return;
  }
  if (channel === 'regenerate-palette') {
    const items = Array.isArray(params) ? params : [];
    items.forEach((item) => writeState().analyzeItemPalette(item, { force: true }));
    return;
  }
  if (channel === 'chnage-preferences' && params && typeof params === 'object') {
    savePreferences(params);
    applyPreferencesToCurrentDocument();
    return;
  }
  if (channel === 'change-theme' && params && typeof params === 'object') {
    savePreferences({ theme: params });
    applyPreferencesToCurrentDocument();
    return;
  }
  if (channel === 'change-zoom' && params) {
    savePreferences({ general: { zoom: String(params) } });
    applyPreferencesToCurrentDocument();
    return;
  }
  if (channel === 'chnage-shortcut' && params && typeof params === 'object') {
    savePreferences({
      shortcuts: {
        keybinds: {
          'global.capture.area': params.screenCaptureShortcut || '',
          'global.capture.window': params.windowCaptureShortcut || '',
        },
      },
    });
    applyPreferencesToCurrentDocument();
    return;
  }
  if (channel === 'chnage-scrollBehavior' && params) {
    savePreferences({ habits: { scrollBehavior: String(params) } });
    applyPreferencesToCurrentDocument();
    return;
  }
  if (channel === 'lock-now') {
    broadcastIpc('lock-now');
    return;
  }
  if (channel === 'update-preferences') {
    applyPreferencesToCurrentDocument();
    return;
  }
  if (channel === 'open.preferences') {
    if (nativeRequire) {
      try {
        nativeRequire('electron').ipcRenderer.send('open.preferences', params || {});
        return;
      } catch (err) {
        console.warn('[eagle-shim] native preferences IPC unavailable, opening directly', err);
      }
    }
    const query = new URLSearchParams();
    if (params && params.panel) query.set('panel', String(params.panel));
    if (params && params.keyword) query.set('keyword', String(params.keyword));
    const search = query.toString();
    window.open(`/src/app/preferences.html${search ? `?${search}` : ''}`, '_blank');
    return;
  }
  if (desktopApi && desktopApi.library && desktopSendChannels.has(channel)) {
    const action = channel === 'create-library'
      ? desktopApi.library.create(params || {})
      : desktopApi.library.switch(params);
    const actionName = channel === 'create-library' ? 'create' : 'open';
    Promise.resolve(action)
      .then((library) => {
        if (library) {
          window.__mockLibrary = { ...(window.__mockLibrary || {}), ...library };
          if (Array.isArray(library.items)) window.__mockLibraryCache = library.items.slice();
          writeState().scheduleMissingPaletteAnalysis((library.items || []));
        }
        mockEmit('library:changed', library);
        mockEmit('library:operation-result', { ok: true, action: actionName, library });
      })
      .catch((err) => mockEmit('library:operation-result', { ok: false, action: actionName, error: err.message }));
    return;
  }
  if (!desktopApi && desktopSendChannels.has(channel)) {
    const libraryPath = typeof params === 'string'
      ? params
      : params && (params.libraryPath || params.path || params.libraryDir);
    const apiBase = (window.__EAGLE_API_BASE_URL || 'http://localhost:41695').replace(/\/$/, '');
    const actionName = channel === 'create-library' ? 'create' : 'open';
    const route = channel === 'create-library' ? '/api/library/create' : '/api/library/switch';
    const body = channel === 'create-library'
      ? (params || {})
      : { libraryPath };
    Promise.resolve()
      .then(() => fetch(`${apiBase}${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }))
      .then((response) => response.json())
      .then((result) => {
        if (!result || result.status !== 'success') {
          throw new Error(result && result.message ? result.message : 'Library switch failed');
        }
        const library = result.data;
        window.__mockLibrary = { ...(window.__mockLibrary || {}), ...library };
        if (Array.isArray(library.items)) window.__mockLibraryCache = library.items.slice();
        writeState().scheduleMissingPaletteAnalysis((library.items || []));
        mockEmit('library:changed', library);
        mockEmit('library:operation-result', { ok: true, action: actionName, library });
      })
      .catch((err) => mockEmit('library:operation-result', { ok: false, action: actionName, error: err.message }));
    return;
  }
  if (desktopApi && desktopApi.library && channel === 'folders-change') {
    desktopApi.library.updateStructure(params || {}).then((library) => {
      if (library) {
        window.__mockLibrary = { ...(window.__mockLibrary || {}), ...library };
        if (Array.isArray(library.items)) window.__mockLibraryCache = library.items.slice();
      }
    }).catch((err) => {
      mockEmit('library:operation-result', { ok: false, action: channel, error: err.message });
    });
    return;
  }
  if (desktopApi && desktopApi.duplicates && channel === 'empty-trash') {
    const ids = String(params || '').split(',').map((id) => id.trim()).filter(Boolean);
    if (ids.length > 0) {
      desktopApi.duplicates.emptyTrash(ids, { force: true }).catch((err) => {
        mockEmit('item:operation-result', { ok: false, action: channel, error: err.message });
      });
    }
    return;
  }
  if (desktopApi && desktopApi.clipboard && (channel === 'read-win-files' || channel === 'paste-image' || channel === 'paste-paths')) {
    const payload = params && params.params ? { ...params.params, folder: params.folder || params.params.folder } : (params || {});
    if (channel === 'paste-paths') payload.files = Array.isArray(params && params.files) ? params.files : [];
    writeState().trackLocalImport(desktopApi.clipboard.import(payload)).then((items) => writeState().emitImportedItems(items, channel)).catch((err) => {
      mockEmit('import:operation-result', { ok: false, channel, error: err.message });
      mockEmit('file-uploaded-end', { error: err.message });
    });
    return;
  }
  if (desktopApi && desktopApi.preview && channel === 'open-preview-window') {
    const images = Array.isArray(params && params.images)
      ? params.images.filter((item) => item && item.id).map((item) => structuredClone(item))
      : [];
    desktopApi.preview.open({ images }).then((result) => {
      mockEmit('preview:operation-result', { ok: true, result });
    }).catch((err) => mockEmit('preview:operation-result', { ok: false, error: err.message }));
    return;
  }
  if (desktopApi && desktopApi.item) {
    const itemId = previewCurrentItemId();
    if (channel === 'open-with-default' && itemId) {
      runPreviewAction('open-with-default', desktopApi.item.openDefault(itemId));
      return;
    }
    if (channel === 'show-item-in-folder' && itemId && !(params && typeof params === 'string' && !isCurrentPreviewRawPath(params))) {
      runPreviewAction('show-item-in-folder', desktopApi.item.reveal(itemId));
      return;
    }
    if (channel === 'copy-images' && itemId) {
      runPreviewAction('copy-images', desktopApi.item.copyImage(itemId));
      return;
    }
    if (channel === 'ondragstart') {
      const ids = dragStartItemIds(params);
      if (ids.length === 0) {
        const currentId = previewCurrentItemId();
        if (currentId) ids.push(currentId);
      }
      if (ids.length > 0) {
        runPreviewAction('ondragstart', desktopApi.item.dragStart(ids.length === 1 ? ids[0] : ids));
        return;
      }
    }
  }
  if (desktopApi && desktopApi.thumbnail) {
    if (channel === 'set-custom-thumbnail') {
      const item = params && params.item;
      desktopApi.thumbnail.setCustom({
        itemId: item && item.id,
        filePath: params && params.thumbnailPath,
        width: params && params.width,
        height: params && params.height,
      }).then((result) => {
        const updated = result && result.item ? result.item : result;
        if (updated && updated.id) {
          writeState().customThumbnailItemIds.add(updated.id);
          const items = window.__mockLibraryCache || [];
          const index = items.findIndex((entry) => entry.id === updated.id);
          if (index >= 0) items[index] = updated;
          mockEmit('thumbnail-generated', updated);
        }
      }).catch((err) => mockEmit('thumbnail-operation-error', { action: channel, error: err.message }));
      return;
    }
    if (channel === 'regenerate-video-thumbnail') {
      const video = params && params.video;
      const itemId = video && video.id;
      if (itemId) {
        const refresh = () => desktopApi.thumbnail.refresh({
          itemId,
          startAt: params.startAt ?? video.thumbnailAt,
        });
        const automaticTaskId = video.thumbnailTask;
        const waitForAutomatic = automaticTaskId
          ? new Promise((resolve, reject) => {
              const poll = () => desktopApi.thumbnail.status(automaticTaskId).then((status) => {
                if (status.status === 'complete') resolve();
                else if (status.status === 'failed' || status.status === 'cancelled') reject(new Error(status.error || status.code || 'Automatic thumbnail failed'));
                else setTimeout(poll, 50);
              }).catch(reject);
              poll();
            })
          : Promise.resolve();
        waitForAutomatic.then(refresh).then((result) => {
          const updated = result && result.item ? result.item : result;
          if (updated && updated.id) {
            const cached = window.__mockLibraryCache || [];
            const index = cached.findIndex((entry) => entry.id === updated.id);
            if (index >= 0) cached[index] = updated;
            mockEmit('thumbnail-generated', updated);
          }
        }).catch((err) => mockEmit('thumbnail-operation-error', { action: channel, error: err.message }));
      }
      return;
    }
    if (channel === 'regenerate-thumbnail') {
      const items = Array.isArray(params) ? params : [];
      items.forEach((item) => {
        const itemId = item && item.id;
        const shouldReset = Boolean(itemId && (item.customThumbnail || writeState().customThumbnailItemIds.has(itemId)));
        const action = shouldReset
          ? desktopApi.thumbnail.resetCustom({ itemId })
          : desktopApi.thumbnail.refresh({ itemId });
        Promise.resolve(action).then((result) => {
          const updated = result && result.item ? result.item : result;
          if (updated && updated.id) {
            if (!updated.customThumbnail) writeState().customThumbnailItemIds.delete(updated.id);
            const cached = window.__mockLibraryCache || [];
            const index = cached.findIndex((entry) => entry.id === updated.id);
            if (index >= 0) cached[index] = updated;
            mockEmit('thumbnail-generated', updated);
          }
        }).catch((err) => mockEmit('thumbnail-operation-error', { action: channel, error: err.message }));
      });
      return;
    }
  }
  if (!desktopApi && channel === 'upload-local-files') {
    browserImportLocalFiles(params && params.files ? params.files : []).catch(() => {});
    return;
  }
  if (!desktopApi && channel === 'upload-url') {
    browserImportUrl(params).catch(() => {});
    return;
  }
  if (!desktopApi && channel === 'upload-urls') {
    browserImportUrls(params).catch(() => {});
    return;
  }
  if (desktopApi && desktopApi.import) {
    let action = null;
    if (channel === 'upload-local-files') action = desktopApi.import.files(params || {});
    if (channel === 'upload-url') action = desktopApi.import.url(params || {});
    if (channel === 'upload-urls') action = desktopApi.import.urls(params || []);
    if (channel === 'import-folders') action = desktopApi.import.folders(params || {});
    if (action) {
      writeState().trackLocalImport(Promise.resolve(action))
        .then((result) => {
          const batches = channel === 'import-folders' && Array.isArray(result) ? result : [result];
          const items = batches.flatMap((batch) => Array.isArray(batch) ? batch : Array.isArray(batch && batch.items) ? batch.items : batch && batch.id ? [batch] : []);
          writeState().emitImportedItems(items, channel);
          if (channel === 'import-folders') {
            desktopApi.library.current().then((library) => {
              window.__mockLibrary = { ...window.__mockLibrary, ...library };
              window.__mockLibraryCache = Array.isArray(library.items) ? library.items.slice() : window.__mockLibraryCache;
              mockEmit('library:changed', library);
            }).catch(() => {});
          }
        })
        .catch((err) => mockEmit('import:operation-result', { ok: false, channel, error: err.message }));
      return;
    }
  }
  if (desktopApi && desktopApi.export) {
    if (channel === 'export-images') {
      const exportParams = params || {};
      if (String(exportParams.savePath || '').toLowerCase().endsWith('.eaglepack')) {
        desktopApi.export.eaglepack(exportParams).catch(() => {});
      } else {
        desktopApi.export.images(exportParams).catch(() => {});
      }
      return;
    }
    if (channel === 'export-as-folder') {
      desktopApi.export.asFolder(params || {}).catch(() => {});
      return;
    }
    if (channel === 'show-item-in-folder') {
      if (desktopApi.export.reveal && window.__lastExportJobId) {
        runPreviewAction('show-item-in-folder', desktopApi.export.reveal(window.__lastExportJobId));
      } else {
        const itemId = previewCurrentItemId();
        if (itemId) runPreviewAction('show-item-in-folder', desktopApi.item.reveal(itemId));
      }
      return;
    }
    if (channel === 'cancel.all') {
      desktopApi.export.cancel().catch(() => {});
      return;
    }
  }
  if (channel === 'update-main-window-id' || channel === 'check-for-update') return;
  console.debug('[eagle-shim] ipc send', channel, params);
};
ipcRenderer.invoke = function (channel, params) {
  // b1-9at：darwin nativeImage 缩图直通（main 侧 b1-9at handle；win32 无效路径不触达）
  if (channel === 'nativeImage.createThumbnailFromPath' && nativeRequire) {
    try {
      return nativeRequire('electron').ipcRenderer.invoke(channel, params);
    } catch (err) {
      console.warn('[eagle-shim] nativeImage.createThumbnailFromPath invoke failed', err);
      return Promise.resolve({ ok: false });
    }
  }
  if (desktopApi) {
    if (channel === 'get-collect-window-data') return desktopApi.getCollectWindowData();
    if (channel === 'library:get-current' && desktopApi.library) return desktopApi.library.current();
    if (channel === 'item:set-custom-thumbnail' && desktopApi.thumbnail) return desktopApi.thumbnail.setCustom(params || {});
    if (channel === 'item:reset-custom-thumbnail' && desktopApi.thumbnail) return desktopApi.thumbnail.resetCustom(params || {});
    if (channel === 'item:refresh-thumbnail' && desktopApi.thumbnail) return desktopApi.thumbnail.refresh(params || {});
    if (channel === 'thumbnail-task:start' && desktopApi.thumbnail) return desktopApi.thumbnail.start(params || {});
    if (channel === 'thumbnail-task:status' && desktopApi.thumbnail) return desktopApi.thumbnail.status(params && (params.taskId || params.id) || params);
    if (channel === 'thumbnail-task:cancel' && desktopApi.thumbnail) return desktopApi.thumbnail.cancel(params && (params.taskId || params.id) || params);
    if ((channel === 'downloadWithNet' || channel === 'downloadWithRequest') && desktopApi.download) {
      return desktopApi.download.direct(params || {}).then((result) => result.path);
    }
    if (channel === 'download:direct' && desktopApi.download) return desktopApi.download.direct(params || {});
    if (channel === 'download:start' && desktopApi.download) return desktopApi.download.start(params || {});
    if (channel === 'download:status' && desktopApi.download) return desktopApi.download.status(params);
    if (channel === 'download:cancel' && desktopApi.download) return desktopApi.download.cancel(params);
    if (channel === 'download:release' && desktopApi.download) return desktopApi.download.release(params);
  }
  return EventEmitter.prototype.invoke.call(this, channel, params);
};
ipcRenderer.r2r = function (targetId, channel, params) {
  if (desktopApi && desktopApi.thumbnail) {
    if (channel === 'item.setCustomThumbnail') return desktopApi.thumbnail.setCustom(params || {});
    if (channel === 'item.refreshThumbnail') return desktopApi.thumbnail.refresh({ itemId: params && (params.itemId || params.id) });
  }
  return Promise.resolve(false);
};

/** E7（P1-c-4）：回程扇出回退注册（React 入口的 core/returnBridge 未安装时才注册）。 */
export function installReturnBridgeFallback() {
  setTimeout(() => {
    if (window.__eagleReturnBridgeInstalled) return;
    if (!(desktopApi && typeof desktopApi.onIpc === 'function')) return;
    desktopApi.onIpc('show-item-in-folder', (value) => {
      if (desktopApi.export && desktopApi.export.reveal && window.__lastExportJobId) {
        runPreviewAction('show-item-in-folder', desktopApi.export.reveal(window.__lastExportJobId));
      }
    });
    desktopApi.onIpc('close-export-task', (value) => {
      // b1-9bz-E9：angular 面板复位分支删除（window.angular 在 React 世界恒缺席 → 死代码；
      // 哨兵 C-6 禁项 scope.$evalAsync）。总线事件扇出保留。
      mockEmit('close-export-task', value);
    });
    for (const channel of [
      'show-export-task',
      'finish-export-task',
      'show-archive-task',
      'add-archive-task',
      'update-archive-percent',
      'finish-archive-task',
      'abort-archive-task',
      // b1-9as：main 回发 → shim 总线（itemDomain 两参监听签名兼容：shim emit 前置 {} 事件参）
      'update-txt-item',
      // b1-9ar：empty-trash 逐项删除进度回程（miscDomain:892 既有监听递进收口）
      'remove-trash-item',
      // b1-9at：native-viewer 优雅降级回程（native/entry.tsx 停轮询 + ready）
      'native-preview-failed',
    ]) {
      desktopApi.onIpc(channel, (value) => mockEmit(channel, value));
    }
    // 实机 QA（2026-09-13）：main 逐文件导入回程未桥接 → 导入期间进度条停 0/N、条目只能等
    // invoke 整体 resolve 后批量出现。file-uploaded 先并 cache 再过总线（emit 覆写处的
    // store 感知去重守卫使其与 emitImportedItems 收尾 emit 幂等，条目流式插入网格）。
    desktopApi.onIpc('file-uploaded', (item) => {
      if (item && item.id) writeState().mergeCachedItems(item);
      mockEmit('file-uploaded', item);
    });
    // set-custom-thumbnail 的承诺链回程（apiServerDomain machinerySetCustomThumbnail 等
    // thumbnail-generated resolve）+ rebind-refresh 刷新面（miscDomain:522 监听）。
    desktopApi.onIpc('thumbnail-generated', (value) => mockEmit('thumbnail-generated', value));
    desktopApi.onIpc('rebind-refresh', (value) => mockEmit('rebind-refresh', value));
  if (desktopApi && desktopApi.export) {
    if (typeof desktopApi.export.onProgress === 'function') {
      desktopApi.export.onProgress((progress) => {
        if (progress && progress.jobId) window.__lastExportJobId = progress.jobId;
      });
    }
    if (typeof desktopApi.export.onComplete === 'function') {
      desktopApi.export.onComplete((result) => {
        if (result && result.jobId) window.__lastExportJobId = result.jobId;
      });
    }
  }
  if (desktopApi && desktopApi.import) {
    if (typeof desktopApi.import.onFileProgress === 'function') {
      desktopApi.import.onFileProgress((job) => mockEmit('import-file-progress', job));
    }
    if (typeof desktopApi.import.onFolderProgress === 'function') {
      desktopApi.import.onFolderProgress((job) => mockEmit('import-folder-progress', job));
    }
  }
  if (desktopApi && desktopApi.library) {
    if (typeof desktopApi.library.onChanged === 'function') {
      desktopApi.library.onChanged((library) => mockEmit('library:changed', library));
    }
    if (typeof desktopApi.library.onOperationResult === 'function') {
      desktopApi.library.onOperationResult((result) => mockEmit('library:operation-result', result));
    }
  }
  if (desktopApi && desktopApi.item && typeof desktopApi.item.onOperationResult === 'function') {
    desktopApi.item.onOperationResult((result) => mockEmit('item:operation-result', result));
  }
  // b1-9aa：后台窗通道族接管后的完成通知——main 在 duplicate-file/set-custom-thumbnail
  // 落盘后回发 rebind-refresh；bundle 渲染层监听（bundle 23723）语义 =
  // $scope.rebindRefresh() + $scope.scrollToSelectedItem()
  if (desktopApi && typeof desktopApi.onRebindRefresh === 'function') {
    desktopApi.onRebindRefresh(() => {
      const scope = typeof window !== 'undefined' ? bodyScope() : null;
      const M = window.__eagleMachinery;
      if (scope && M && typeof M.rebindRefresh === 'function') {
        try {
          // E5-2：machineryRebindRefresh 已去 scope 化（E4，签名 (muteMode, cache, startCursor)）——
          // 原 scope 首参会被当作 muteMode 误用。
          M.rebindRefresh();
          if (typeof scope.scrollToSelectedItem === 'function') scope.scrollToSelectedItem();
        } catch (err) { /* 重载失败不阻塞通知链 */ }
      }
    });
  }
  if (desktopApi && desktopApi.preview && typeof desktopApi.preview.onInit === 'function') {
    // 阶段9a：init 桥改缓冲——React 入口冷启动 vite transform 可能慢于本桥（8e-2 同款竞态）。
    // 未就绪时暂存 __eaglePendingPreviewInit 并 25ms 轮询就绪标记后补发（兜底 10s）。
    desktopApi.preview.onInit((payload) => {
      window.__eaglePendingPreviewInit = payload;
      if (window.__eaglePreviewEntryReady) {
        mockEmit('init', payload);
        return;
      }
      const retry = setInterval(() => {
        if (!window.__eaglePreviewEntryReady) return;
        clearInterval(retry);
        mockEmit('init', payload);
      }, 25);
      setTimeout(() => clearInterval(retry), 10000);
    });
  }
  }, 0);
}
