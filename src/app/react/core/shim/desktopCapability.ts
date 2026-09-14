// @ts-nocheck
/**
 * R2 桌面能力层：Electron 主/渲染进程 API 的 shim 面（currentWindow/app/dialog/Menu/
 * BrowserWindow/remote/clipboard/shell），以及写文件原子化的受控转接。
 *
 * 迁移自 `core/shimsLegacy.ts` 的 IIFE（原 1838-2303 区间），函数体逐字保留——
 * 有桌面桥时一律转调 `window.eagleDesktop.*`（真实能力面），无桥时回落只读 stub。
 * 依赖 `./ipcBus`（总线实体与预览面助手）、`./browserRuntime`（BrowserBuffer/electronLog）、
 * `./environment`（桌面桥探针）。`windowApi` 系列导出供窗口状态事件与其它模块复用。
 */
import { desktopApi, nativeRequire } from "./environment";
import { BrowserBuffer, electronLog } from "./browserRuntime";
import { ipcRenderer, isCurrentPreviewRawPath, previewCurrentItemId, runPreviewAction } from "./ipcBus";
export const windowApi = () => (window.eagleDesktop && window.eagleDesktop.window) || null;
const windowListeners = new Map();
export const windowState = (() => {
  const api = windowApi();
  return {
    maximized: api ? Boolean(api.isMaximized()) : false,
    fullScreen: api ? Boolean(api.isFullScreen()) : false,
  };
})();

export function addWindowListener(channel, callback) {
  if (!windowListeners.has(channel)) windowListeners.set(channel, []);
  windowListeners.get(channel).push(callback);
}

export function emitWindowEvent(channel, ...args) {
  (windowListeners.get(channel) || []).slice().forEach((callback) => {
    try {
      callback({}, ...args);
    } catch (err) {
      console.warn(`[eagle-shim] window listener error on ${channel}`, err);
    }
  });
}

(function wireWindowStateEvents() {
  const api = windowApi();
  if (!api || typeof api.onStateChanged !== 'function') return;
  api.onStateChanged((state) => {
    const previous = { ...windowState };
    if (typeof state.maximized === 'boolean') windowState.maximized = state.maximized;
    if (typeof state.fullScreen === 'boolean') windowState.fullScreen = state.fullScreen;
    if (windowState.maximized && !previous.maximized) emitWindowEvent('maximize');
    if (!windowState.maximized && previous.maximized) emitWindowEvent('unmaximize');
    if (windowState.fullScreen && !previous.fullScreen) emitWindowEvent('enter-full-screen');
    if (!windowState.fullScreen && previous.fullScreen) emitWindowEvent('leave-full-screen');
  });
})();

export const currentWindow = {
  id: 1,
  getTitle: () => 'Eagle',
  isDestroyed: () => false,
  isMaximized: () => windowState.maximized,
  isFullScreen: () => windowState.fullScreen,
  hide() {
    const api = windowApi();
    if (api && typeof api.hide === 'function') api.hide();
  },
  show() {
    const api = windowApi();
    if (api && typeof api.show === 'function') api.show();
  },
  close() {
    const api = windowApi();
    if (api && typeof api.close === 'function') api.close();
  },
  minimize() {
    const api = windowApi();
    if (api && typeof api.minimize === 'function') api.minimize();
  },
  maximize() {
    const api = windowApi();
    if (api && typeof api.maximize === 'function') {
      api.maximize();
      windowState.maximized = true;
    }
  },
  unmaximize() {
    const api = windowApi();
    if (api && typeof api.unmaximize === 'function') {
      api.unmaximize();
      windowState.maximized = false;
    }
  },
  restore() {
    const api = windowApi();
    if (api && typeof api.unmaximize === 'function') {
      api.unmaximize();
      windowState.maximized = false;
    }
  },
  flashFrame() {},
  setFullScreen(value) {
    const api = windowApi();
    if (api && typeof api.setFullScreen === 'function') {
      api.setFullScreen(value);
      windowState.fullScreen = Boolean(value);
    }
  },
  setAlwaysOnTop(value) {
    const api = windowApi();
    if (api && typeof api.setAlwaysOnTop === 'function') api.setAlwaysOnTop(value);
  },
  getOpacity: () => 1,
  setOpacity() {},
  focus() {},
  blur() {},
  getBounds: () => ({ x: 0, y: 0, width: 1280, height: 720 }),
  setBounds() {},
  setMinimumSize() {},
  setSize() {},
  getSize: () => [1280, 720],
  on(channel, callback) {
    addWindowListener(channel, callback);
    return this;
  },
  once(channel, callback) {
    const wrap = (...args) => {
      this.removeListener(channel, wrap);
      callback(...args);
    };
    return this.on(channel, wrap);
  },
  addListener(channel, callback) {
    return this.on(channel, callback);
  },
  removeListener(channel, callback) {
    const list = windowListeners.get(channel) || [];
    windowListeners.set(channel, list.filter((entry) => entry !== callback));
    return this;
  },
  emit(channel, ...args) {
    emitWindowEvent(channel, ...args);
    return true;
  },
  webContents: {
    id: 1,
    send() {},
    canGoBack: () => false,
    canGoForward: () => false,
    goBack() {},
    goForward() {},
    loadURL() {},
    getURL: () => '',
    reload() {},
    stop() {},
    executeJavaScript() { return Promise.resolve(''); },
    on() {},
    once() {},
    setWindowOpenHandler() {},
  },
};

export const app = {
  isPackaged: false,
  getPath: (name) => (name === 'home' ? '/mock-user-data' : '/mock-user-data'),
  getLocale: () => 'zh-CN',
  getName: () => 'Eagle',
  getVersion: () => '4.0.0',
  getAppPath: () => '/src',
  runningUnderARM64Translation: false,
  dock: { bounce() {}, show() {}, hide() {} },
  on() {},
  once() {},
  whenReady: () => Promise.resolve(),
  quit() {},
  exit() {},
};

export const nativeTheme = { shouldUseDarkColors: false, on() {}, off() {} };
function dialogOptions(first, second) {
  return second && typeof second === 'object' ? second : (first && typeof first === 'object' && !first.webContents ? first : {});
}

export const dialog = {
  showOpenDialog(first, second) {
    const options = dialogOptions(first, second);
    if (desktopApi && desktopApi.dialog) return desktopApi.dialog.open(options);
    return Promise.resolve({ canceled: true, filePaths: [] });
  },
  showSaveDialog(first, second) {
    const options = dialogOptions(first, second);
    if (desktopApi && desktopApi.dialog) return desktopApi.dialog.save(options);
    return Promise.resolve({ canceled: true, filePath: '' });
  },
  showMessageBox: () => Promise.resolve({ response: 0 }),
};

export class MenuItem {
  constructor(options = {}) {
    Object.assign(this, options);
    this.submenu = options.submenu || [];
  }

  append(item) {
    this.submenu.push(item);
  }
}

let applicationMenu = null;

export function getRoleClick(role) {
  const winApi = () => (window.eagleDesktop && window.eagleDesktop.window) || null;
  switch (role) {
    case 'reload':
      return () => {
        const api = winApi();
        if (api && typeof api.reload === 'function') api.reload();
        else window.location.reload();
      };
    case 'forceReload':
      return () => {
        const api = winApi();
        if (api && typeof api.forceReload === 'function') api.forceReload();
        else window.location.reload();
      };
    case 'toggleDevTools':
      return () => {
        const api = winApi();
        if (api && typeof api.toggleDevTools === 'function') api.toggleDevTools();
      };
    case 'resetZoom':
      return () => {
        const api = winApi();
        if (api && typeof api.resetZoom === 'function') api.resetZoom();
      };
    case 'zoomIn':
      return () => {
        const api = winApi();
        if (api && typeof api.zoomIn === 'function') api.zoomIn();
      };
    case 'zoomOut':
      return () => {
        const api = winApi();
        if (api && typeof api.zoomOut === 'function') api.zoomOut();
      };
    case 'minimize':
      return () => currentWindow.minimize();
    case 'close':
      return () => currentWindow.close();
    case 'quit':
      return () => {
        const api = winApi();
        if (api && typeof api.quit === 'function') api.quit();
        else currentWindow.close();
      };
    case 'undo':
      return () => document.execCommand('undo');
    case 'redo':
      return () => document.execCommand('redo');
    case 'cut':
      return () => document.execCommand('cut');
    case 'copy':
      return () => document.execCommand('copy');
    case 'paste':
      return () => document.execCommand('paste');
    case 'selectAll':
      return () => document.execCommand('selectAll');
    default:
      return null;
  }
}

function normalizeMenuItems(items) {
  return (Array.isArray(items) ? items : []).map((item) => {
    if (!item) return { role: 'separator' };
    if (item.type === 'separator' || item.role === 'separator') return { role: 'separator' };

    const normalized = { ...item };
    delete normalized.type;

    if (Array.isArray(normalized.submenu)) {
      normalized.submenu = { items: normalizeMenuItems(normalized.submenu), showSearch: false };
    } else if (normalized.submenu && Array.isArray(normalized.submenu.items)) {
      normalized.submenu = { ...normalized.submenu, items: normalizeMenuItems(normalized.submenu.items) };
    }

    if (normalized.enabled === false) normalized.disabled = true;
    if (typeof normalized.role === 'string') {
      const roleClick = getRoleClick(normalized.role);
      if (roleClick) normalized.click = roleClick;
      else if (!normalized.submenu) normalized.disabled = true;
      delete normalized.role;
    }

    return normalized;
  });
}

function createShimMenu(template) {
  const menu = { items: normalizeMenuItems(template || []), showSearch: false };
  menu.popup = () => {
    if (typeof ContextMenu !== 'undefined' && typeof ContextMenu.open === 'function') {
      ContextMenu.open({ items: menu.items, showSearch: false });
    }
  };
  menu.append = () => {};
  return menu;
}

export const Menu = {
  buildFromTemplate: (template) => createShimMenu(template),
  setApplicationMenu(menu) {
    applicationMenu = menu;
  },
  getApplicationMenu: () => applicationMenu || createShimMenu([]),
};

export class BrowserWindow {
  constructor() {
    this.webContents = {
      id: 2,
      on() {},
      send() {},
      executeJavaScript: () => Promise.resolve(''),
    };
    this.on = () => this;
    this.hide = () => this;
    this.show = () => this;
    this.destroy = () => this;
    this.close = () => this;
  }

  static fromId() {
    return null;
  }
}

export const remote = {
  app,
  nativeTheme,
  systemPreferences: {},
  screen: {
    getCursorScreenPoint: () => ({ x: 0, y: 0 }),
    getPrimaryDisplay: () => ({
      bounds: { x: 0, y: 0, width: 1280, height: 720 },
      workArea: { x: 0, y: 0, width: 1280, height: 720 },
      scaleFactor: 1,
    }),
    getAllDisplays: () => [],
  },
  dialog,
  Menu,
  MenuItem,
  BrowserWindow,
  getCurrentWindow: () => currentWindow,
  getCurrentWebContents: () => currentWindow.webContents,
  require: (id) => (String(id || '').includes('electron-log') ? electronLog : {}),
};

function readDesktopClipboardSync() {
  if (!desktopApi || !desktopApi.clipboard || typeof desktopApi.clipboard.readSync !== 'function') {
    return { text: '', imageDataUrl: '', filePaths: [], formats: [] };
  }
  try {
    return desktopApi.clipboard.readSync() || { text: '', imageDataUrl: '', filePaths: [], formats: [] };
  } catch (err) {
    return { text: '', imageDataUrl: '', filePaths: [], formats: [] };
  }
}

function clipboardImageFromDataUrl(dataUrl) {
  const match = /^data:image\/[^;,]+;base64,(.*)$/s.exec(String(dataUrl || ''));
  const bytes = match ? BrowserBuffer.from(atob(match[1])) : BrowserBuffer.alloc(0);
  return {
    isEmpty: () => bytes.length === 0,
    toPNG: () => bytes,
    toJPEG: () => bytes,
    toDataURL: () => dataUrl || '',
    getSize: () => ({ width: bytes.length > 0 ? 1 : 0, height: bytes.length > 0 ? 1 : 0 }),
  };
}

export const electron = {
  ipcRenderer,
  webFrame: {
    setZoomFactor(factor) {
      if (nativeRequire) {
        try {
          const nativeWebFrame = nativeRequire('electron').webFrame;
          if (nativeWebFrame && typeof nativeWebFrame.setZoomFactor === 'function') {
            nativeWebFrame.setZoomFactor(Number(factor) || 1);
            return;
          }
        } catch (err) {
          // Fall back to the browser shim below.
        }
      }
      const zoom = String(Number(factor) || 1);
      if (document.body) document.body.style.zoom = zoom;
      else if (document.documentElement) document.documentElement.style.zoom = zoom;
    },
    getZoomFactor() {
      if (nativeRequire) {
        try {
          const nativeWebFrame = nativeRequire('electron').webFrame;
          if (nativeWebFrame && typeof nativeWebFrame.getZoomFactor === 'function') {
            return nativeWebFrame.getZoomFactor();
          }
        } catch (err) {
          // Fall through to the browser shim.
        }
      }
      return Number((document.body && document.body.style.zoom) || (document.documentElement && document.documentElement.style.zoom)) || 1;
    },
    getResourceUsage: () => ({ images: { count: 0, liveSize: 0 } }),
  },
  clipboard: {
    writeText(text) {
      if (desktopApi && desktopApi.item && isCurrentPreviewRawPath(text)) {
        runPreviewAction('copy-path', desktopApi.item.copyPath(previewCurrentItemId()));
      }
    },
    readText: () => readDesktopClipboardSync().text || '',
    writeImage() {},
    readImage: () => clipboardImageFromDataUrl(readDesktopClipboardSync().imageDataUrl),
    clear() {},
    availableFormats: () => readDesktopClipboardSync().formats || [],
  },
  shell: {
    openExternal: () => Promise.resolve(),
    openPath: () => Promise.resolve(''),
    showItemInFolder() {},
    beep() {},
  },
};

export function writeFileAtomic(file, data, cb) {
  const target = String(file || '').replace(/\\/g, '/');
  if (desktopApi && desktopApi.library && target.endsWith('/saved-filters.json')) {
    // Electron 下把原版 writeFileAtomic 的 saved-filters 写入转接到受控结构接口。
    let savedFilters;
    try {
      savedFilters = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (err) {
      if (typeof cb === 'function') setTimeout(() => cb(err), 0);
      return;
    }
    if (!Array.isArray(savedFilters)) {
      const err = new Error('Saved filters must be an array');
      if (typeof cb === 'function') setTimeout(() => cb(err), 0);
      return;
    }
    desktopApi.library.updateStructure({
      libraryPath: window.__mockLibrary && (window.__mockLibrary.rootDir || window.__mockLibrary.path),
      savedFilters,
    }).then(() => {
      if (window.__mockLibrary) window.__mockLibrary.savedFilters = savedFilters;
      if (typeof cb === 'function') cb(null);
    }).catch((err) => {
      if (typeof cb === 'function') cb(err);
    });
    return;
  }
  if (desktopApi && desktopApi.library && target.endsWith('/tags.json')) {
    let tags;
    try {
      tags = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (err) {
      if (typeof cb === 'function') setTimeout(() => cb(err), 0);
      return;
    }
    desktopApi.library.updateStructure({
      libraryPath: window.__mockLibrary && (window.__mockLibrary.rootDir || window.__mockLibrary.path),
      tags,
    }).then(() => {
      if (window.__mockLibrary) window.__mockLibrary.tags = tags;
      if (typeof cb === 'function') cb(null);
    }).catch((err) => {
      if (typeof cb === 'function') cb(err);
    });
    return;
  }
  if (typeof cb === 'function') setTimeout(cb, 0);
}
