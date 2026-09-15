const { contextBridge, ipcRenderer } = require('electron');

const thumbnailBaseUrl = String(process.env.EAGLE_THUMBNAIL_URL || 'http://localhost:41692').replace(/\/$/, '');

// b1-9ak：冒烟旗标直通（preload 的 process 是原生对象，先于 shims 注入且不被其覆盖；
// 渲染层 window.process/window.require 均被 shims stub，env 不可达）
window.__EAGLE_MENU_SMOKE = String(process.env.EAGLE_MENU_SMOKE || '') === '1';

// contextBridge 会代理函数，跨调用不应依赖 callback 的 === 身份；优先使用返回的 disposer。
// 映射仅用于兼容同身份的 off/removeListener；每次注册都有独立且幂等的清理句柄。
const subscriptions = new Map();

function subscribe(channel, callback, once = false, withPayload = true) {
  if (typeof callback !== 'function') throw new TypeError('IPC callback must be a function');
  const callbacks = subscriptions.get(channel) || new Map();
  const disposers = callbacks.get(callback) || new Set();
  let active = true;
  const dispose = () => {
    if (!active) return;
    active = false;
    disposers.delete(dispose);
    if (!disposers.size) callbacks.delete(callback);
    if (!callbacks.size) subscriptions.delete(channel);
    ipcRenderer.removeListener(channel, wrapper);
  };
  const wrapper = (_event, value) => {
    if (!active) return;
    // 先清理再调用，保证重入或 callback 抛错时 once 仍只消费一次。
    if (once) dispose();
    if (withPayload) callback(value);
    else callback();
  };
  ipcRenderer.on(channel, wrapper);
  disposers.add(dispose);
  callbacks.set(callback, disposers);
  subscriptions.set(channel, callbacks);
  return dispose;
}

function unsubscribe(channel, callback) {
  const disposers = subscriptions.get(channel)?.get(callback);
  // 对齐 EventEmitter：重复注册同一 callback 时，一次 off 只移除最近的一次。
  if (disposers) Array.from(disposers).pop()();
}

// 只拆本桥自己的 wrapper：既不能误伤宿主或第三方直接注册在 ipcRenderer 上的监听，
// 也不能走 ipcRenderer.removeAllListeners（它按 channel 无差别清空，会连外部监听一起删）。
// 对外部监听而言本桥就应当不存在，因此未登记过的 channel 是彻底的空操作。
function removeAllSubscriptions(channel) {
  const channels = channel === undefined ? Array.from(subscriptions.keys()) : [channel];
  for (const name of channels) {
    const callbacks = subscriptions.get(name);
    if (!callbacks) continue;
    for (const disposers of callbacks.values()) {
      for (const dispose of Array.from(disposers)) dispose();
    }
  }
}

const api = {
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  onIpc: (channel, callback) => subscribe(channel, callback),
  // P1-b：通用 IPC 桥。渲染层 `core/channelBridge.ts` 的 facade 用它把「纯原生直通」频道直达
  // 主进程（其余频道仍走 shims 的路由表）。此前渲染层没有通用 send 能力（preload 只暴露具名 API），
  // 这也是 shims 长期兼任 IPC 路由器的原因之一。
  ipc: {
    send: (channel, params) => ipcRenderer.send(channel, params),
    sendTo: (webContentsId, channel, params) => ipcRenderer.sendTo(webContentsId, channel, params),
    on: (channel, callback) => subscribe(channel, callback),
    once: (channel, callback) => subscribe(channel, callback, true),
    off: unsubscribe,
    removeListener: unsubscribe,
    removeAllListeners: removeAllSubscriptions,
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    sendSync: (channel, ...args) => ipcRenderer.sendSync(channel, ...args),
    r2r: (channel, ...args) => (typeof ipcRenderer.r2r === 'function' ? ipcRenderer.r2r(channel, ...args) : undefined),
  },
  getCurrentLibrary: () => ipcRenderer.invoke('library:get-current'),
  library: {
    current: () => ipcRenderer.invoke('library:get-current'),
    history: () => ipcRenderer.invoke('library:get-history'),
    setHistory: (history) => ipcRenderer.invoke('library:set-history', history),
    updateStructure: (params) => ipcRenderer.invoke('library:update-structure', params),
    create: (params) => ipcRenderer.invoke('library:create', params),
    open: (libraryPath) => ipcRenderer.invoke('library:open', libraryPath),
    switch: (libraryPath) => ipcRenderer.invoke('library:switch', libraryPath),
    onChanged: (callback) => subscribe('library:changed', callback),
    onOperationResult: (callback) => subscribe('library:operation-result', callback),
  },
  dialog: {
    open: (options) => ipcRenderer.invoke('dialog:show-open', options),
    openDirectory: (options) => ipcRenderer.invoke('dialog:openDirectory', options),
    save: (options) => ipcRenderer.invoke('dialog:show-save', options),
  },
  sourceMode: {
    pickAndAdd: () => ipcRenderer.invoke('source-mode:pick-and-add'),
    addPath: (filePath) => ipcRenderer.invoke('source-mode:add-path', filePath),
    list: () => ipcRenderer.invoke('source-mode:list'),
    remove: (id) => ipcRenderer.invoke('source-mode:remove', id),
    rescan: (id, relativePath) => ipcRenderer.invoke('source-mode:rescan', id, relativePath),
    openFolderPicker: (options) => ipcRenderer.invoke('source-mode:open-folder-picker', options),
  },
  getCollectWindowData: () => ipcRenderer.invoke('get-collect-window-data'),
  openViewer: (payload) => ipcRenderer.invoke('viewer:open', payload),
  preview: {
    open: (payload) => ipcRenderer.invoke('preview:open-original', payload),
    onInit: (callback) => subscribe('preview:init', callback),
  },
  item: {
    updateMany: (items) => ipcRenderer.invoke('item:update-many', items),
    batchSave: (params) => ipcRenderer.invoke('item:batch-save', params),
    moveToTrash: (ids) => ipcRenderer.invoke('item:move-to-trash', ids),
    restore: (ids) => ipcRenderer.invoke('item:restore', ids),
    openDefault: (id) => ipcRenderer.invoke('item:open-default', { id }),
    reveal: (id) => ipcRenderer.invoke('item:reveal', { id }),
    copyPath: (id) => ipcRenderer.invoke('item:copy-path', { id }),
    copyImage: (id) => ipcRenderer.invoke('item:copy-image', { id }),
    dragStart: (ids) => ipcRenderer.invoke('item:drag-start', { ids: Array.isArray(ids) ? ids : [ids] }),
    onOperationResult: (callback) => subscribe('item:operation-result', callback),
  },
  duplicates: {
    scan: (params) => ipcRenderer.invoke('duplicates:scan', params),
    merge: (params) => ipcRenderer.invoke('duplicates:merge', params),
    emptyTrash: (ids, options) => ipcRenderer.invoke('duplicates:empty-trash', { ids, ...(options || {}) }),
    status: (jobId) => ipcRenderer.invoke('duplicates:status', jobId),
    cancel: (jobId) => ipcRenderer.invoke('duplicates:cancel', jobId),
  },
  openPlugin: (payload) => ipcRenderer.invoke('plugin:open', payload),
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  listDirectory: (target) => ipcRenderer.invoke('fs:list', target),
  readFile: (target) => ipcRenderer.invoke('fs:read', target),
  resolvePath: (target) => ipcRenderer.invoke('library:resolve', target),
  nativeThumbnail: (target, options) => ipcRenderer.invoke('thumbnail:native', target, options),
  // b1-9aa：后台窗通道族完成通知（duplicate-file/set-custom-thumbnail 落盘后 main 回发）
  onRebindRefresh: (callback) => subscribe('rebind-refresh', callback, false, false),
  thumbnailUrl: (target) => `${thumbnailBaseUrl}/file/${encodeURIComponent(String(target || ''))}`,
  thumbnail: {
    setCustom: (params) => ipcRenderer.invoke('item:set-custom-thumbnail', params),
    resetCustom: (params) => ipcRenderer.invoke('item:reset-custom-thumbnail', params),
    refresh: (params) => ipcRenderer.invoke('item:refresh-thumbnail', params),
    start: (params) => ipcRenderer.invoke('thumbnail-task:start', params),
    status: (taskId) => ipcRenderer.invoke('thumbnail-task:status', taskId),
    cancel: (taskId) => ipcRenderer.invoke('thumbnail-task:cancel', taskId),
  },
  clipboardImage: () => ipcRenderer.invoke('clipboard:readImage'),
  clipboard: {
    read: () => ipcRenderer.invoke('clipboard:read'),
    readSync: () => ipcRenderer.sendSync('clipboard:read-sync'),
    import: (params) => ipcRenderer.invoke('clipboard:import', params),
  },
  importPaths: (paths) => ipcRenderer.invoke('item:importPaths', paths),
  import: {
    files: (params) => ipcRenderer.invoke('item:import-files', params),
    onFileProgress: (callback) => subscribe('import-file-progress', callback),
    folders: (params) => ipcRenderer.invoke('item:import-folders', params),
    onFolderProgress: (callback) => subscribe('import-folder-progress', callback),
    url: (params) => ipcRenderer.invoke('item:import-url', params),
    urls: (params) => ipcRenderer.invoke('item:import-urls', params),
  },
  download: {
    direct: (params) => ipcRenderer.invoke('download:direct', params),
    start: (params) => ipcRenderer.invoke('download:start', params),
    status: (taskId) => ipcRenderer.invoke('download:status', taskId),
    cancel: (taskId) => ipcRenderer.invoke('download:cancel', taskId),
    release: (taskId) => ipcRenderer.invoke('download:release', taskId),
  },
  export: {
    images: (params) => ipcRenderer.invoke('export:images', params),
    asFolder: (params) => ipcRenderer.invoke('export:as-folder', params),
    eaglepack: (params) => ipcRenderer.invoke('export:eaglepack', params),
    cancel: (jobId) => ipcRenderer.invoke('export:cancel', jobId),
    reveal: (jobId) => ipcRenderer.invoke('export:reveal', { jobId }),
    onProgress: (callback) => subscribe('export:progress', callback),
    onComplete: (callback) => subscribe('export:complete', callback),
    onError: (callback) => subscribe('export:error', callback),
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:action', 'minimize'),
    maximize: () => ipcRenderer.invoke('window:action', 'maximize'),
    unmaximize: () => ipcRenderer.invoke('window:action', 'unmaximize'),
    close: () => ipcRenderer.invoke('window:action', 'close'),
    setFullScreen: (value) => ipcRenderer.invoke('window:action', 'set-full-screen', value),
    setAlwaysOnTop: (value) => ipcRenderer.invoke('window:action', 'set-always-on-top', value),
    reload: () => ipcRenderer.invoke('window:action', 'reload'),
    forceReload: () => ipcRenderer.invoke('window:action', 'force-reload'),
    toggleDevTools: () => ipcRenderer.invoke('window:action', 'toggle-devtools'),
    resetZoom: () => ipcRenderer.invoke('window:action', 'reset-zoom'),
    zoomIn: () => ipcRenderer.invoke('window:action', 'zoom-in'),
    zoomOut: () => ipcRenderer.invoke('window:action', 'zoom-out'),
    quit: () => ipcRenderer.invoke('window:action', 'quit'),
    isMaximized: () => ipcRenderer.sendSync('window:query', 'isMaximized'),
    isFullScreen: () => ipcRenderer.sendSync('window:query', 'isFullScreen'),
    onStateChanged: (callback) => subscribe('window:state-changed', callback),
  },
};

if (contextBridge && contextBridge.exposeInMainWorld) {
  try {
    contextBridge.exposeInMainWorld('eagleDesktop', api);
  } catch (err) {
    window.eagleDesktop = api;
  }
} else {
  window.eagleDesktop = api;
}
