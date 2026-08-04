const { contextBridge, ipcRenderer } = require('electron');

const api = {
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  getCurrentLibrary: () => ipcRenderer.invoke('library:get-current'),
  getCollectWindowData: () => ipcRenderer.invoke('get-collect-window-data'),
  openViewer: (payload) => ipcRenderer.invoke('viewer:open', payload),
  openPlugin: (payload) => ipcRenderer.invoke('plugin:open', payload),
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  listDirectory: (target) => ipcRenderer.invoke('fs:list', target),
  readFile: (target) => ipcRenderer.invoke('fs:read', target),
  resolvePath: (target) => ipcRenderer.invoke('library:resolve', target),
  nativeThumbnail: (target, options) => ipcRenderer.invoke('thumbnail:native', target, options),
  clipboardImage: () => ipcRenderer.invoke('clipboard:readImage'),
  importPaths: (paths) => ipcRenderer.invoke('item:importPaths', paths),
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
