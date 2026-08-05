const { contextBridge, ipcRenderer } = require('electron');

const thumbnailBaseUrl = String(process.env.EAGLE_THUMBNAIL_URL || 'http://localhost:41592').replace(/\/$/, '');

const api = {
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  onIpc: (channel, callback) => {
    ipcRenderer.on(channel, (_event, value) => callback(value));
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
    onChanged: (callback) => ipcRenderer.on('library:changed', (_event, library) => callback(library)),
    onOperationResult: (callback) => ipcRenderer.on('library:operation-result', (_event, result) => callback(result)),
  },
  dialog: {
    open: (options) => ipcRenderer.invoke('dialog:show-open', options),
    openDirectory: (options) => ipcRenderer.invoke('dialog:openDirectory', options),
    save: (options) => ipcRenderer.invoke('dialog:show-save', options),
  },
  getCollectWindowData: () => ipcRenderer.invoke('get-collect-window-data'),
  openViewer: (payload) => ipcRenderer.invoke('viewer:open', payload),
  preview: {
    open: (payload) => ipcRenderer.invoke('preview:open-original', payload),
    onInit: (callback) => ipcRenderer.on('preview:init', (_event, payload) => callback(payload)),
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
    dragStart: (id) => ipcRenderer.invoke('item:drag-start', { id }),
    onOperationResult: (callback) => ipcRenderer.on('item:operation-result', (_event, result) => callback(result)),
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
    onFileProgress: (callback) => ipcRenderer.on('import-file-progress', (_event, job) => callback(job)),
    folders: (params) => ipcRenderer.invoke('item:import-folders', params),
    onFolderProgress: (callback) => ipcRenderer.on('import-folder-progress', (_event, job) => callback(job)),
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
    onProgress: (callback) => ipcRenderer.on('export:progress', (_event, progress) => callback(progress)),
    onComplete: (callback) => ipcRenderer.on('export:complete', (_event, result) => callback(result)),
    onError: (callback) => ipcRenderer.on('export:error', (_event, result) => callback(result)),
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
    onStateChanged: (callback) => {
      ipcRenderer.on('window:state-changed', (_event, state) => callback(state));
    },
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
