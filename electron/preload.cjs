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
