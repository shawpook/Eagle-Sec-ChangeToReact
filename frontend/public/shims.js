(function () {
  'use strict';

  if (window.__eagleBrowserShimLoaded) return;
  window.__eagleBrowserShimLoaded = true;

  const nativeRequire = typeof window.require === 'function' ? window.require : null;
  const isElectronRuntime =
    typeof process !== 'undefined' && process.versions && typeof process.versions.electron === 'string';
  let nativeFs = null;
  let nativePath = null;
  if (isElectronRuntime && nativeRequire) {
    try {
      nativeFs = nativeRequire('node:fs');
      nativePath = nativeRequire('node:path');
    } catch (err) {
      console.warn('[eagle-shim] native filesystem bridge unavailable', err);
    }
  }
  const desktopApi = window.eagleDesktop || null;

  function syncText(url) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      if (xhr.status >= 200 && xhr.status < 300) return xhr.responseText;
      return null;
    } catch (err) {
      return null;
    }
  }

  function syncArrayBuffer(url) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.responseType = 'arraybuffer';
      xhr.send(null);
      if (xhr.status >= 200 && xhr.status < 300) return xhr.response;
      return null;
    } catch (err) {
      return null;
    }
  }

  function toFileUrl(p) {
    const s = String(p || '').replace(/\\/g, '/');
    if (/^[a-z]+:\/\//i.test(s)) return s;
    if (s.startsWith('/')) return window.location.origin + s;
    return window.location.origin + '/' + s;
  }

  function dirname(p) {
    const clean = String(p || '').replace(/\\/g, '/').replace(/\/+$/, '');
    const idx = clean.lastIndexOf('/');
    return idx <= 0 ? '/' : clean.slice(0, idx) || '/';
  }

  const pathModule = {
    sep: '/',
    delimiter: ';',
    normalize(p) {
      const s = String(p || '').replace(/\\/g, '/').replace(/\/+/g, '/');
      return s.replace(/\/$/, '') || '/';
    },
    join(...parts) {
      const out = [];
      for (const part of parts) {
        const s = String(part || '').replace(/\\/g, '/');
        if (!s) continue;
        if (s.startsWith('/') && out.length === 0) out.push(s.replace(/^\//, ''));
        else if (s.startsWith('/')) continue;
        else out.push(s.replace(/^\/+/, ''));
      }
      const joined = '/' + out.join('/');
      return pathModule.normalize(joined);
    },
    resolve(...parts) {
      return pathModule.join('/', ...parts);
    },
    basename(p, ext) {
      const clean = String(p || '').replace(/\\/g, '/').replace(/\/+$/, '');
      const base = clean.slice(clean.lastIndexOf('/') + 1);
      if (ext && base.endsWith(ext)) return base.slice(0, -ext.length);
      return base;
    },
    dirname(p) {
      return dirname(p);
    },
    extname(p) {
      const base = pathModule.basename(p);
      const idx = base.lastIndexOf('.');
      return idx > 0 ? base.slice(idx) : '';
    },
    isAbsolute(p) {
      return String(p || '').startsWith('/') || /^[a-zA-Z]:[\\/]/.test(p);
    },
    relative() {
      return '';
    },
  };

  class BrowserBuffer extends Uint8Array {
    static from(value, encoding) {
      if (value instanceof Uint8Array) return new BrowserBuffer(value);
      if (Array.isArray(value)) return new BrowserBuffer(value);
      const str = String(value == null ? '' : value);
      return new BrowserBuffer([...str].map((ch) => ch.charCodeAt(0) & 0xff));
    }

    static alloc(size) {
      return new BrowserBuffer(size);
    }

    static isBuffer(value) {
      return value instanceof BrowserBuffer || value instanceof Uint8Array;
    }

    toString(encoding) {
      return Array.from(this).map((code) => String.fromCharCode(code)).join('');
    }
  }

  const osModule = {
    platform: 'win32',
    arch: 'x64',
    type: () => 'Windows_NT',
    hostname: () => 'EAGLE-REVERSE',
    release: () => '10.0.22631',
    tmpdir: () => '/mock-tmp',
    homedir: () => '/mock-user-data',
    EOL: '\n',
    cpus: () => [],
    totalmem: () => 0,
    freemem: () => 0,
  };

  const fsModule = {
    F_OK: 0,
    R_OK: 4,
    W_OK: 2,
    X_OK: 1,
    existsSync(p) {
      const s = String(p || '').replace(/\\/g, '/');
      if (s.includes('/mock-library/')) return true;
      if (s.includes('Settings')) return true;
      if (s.includes('/src/i18n/') && s.endsWith('.js')) return syncText(s) !== null;
      return false;
    },
    access(p, callback) {
      if (typeof callback === 'function') setTimeout(() => callback(null), 0);
    },
    accessSync() {},
    readFileSync(p, encoding) {
      const s = String(p || '').replace(/\\/g, '/');
      if (s.includes('Settings')) {
        return JSON.stringify({ preferences: { general: { language: 'zh_CN' } } });
      }
      if (s.endsWith('tags.json')) {
        return JSON.stringify({ historyTags: ['UI', '空状态'], starredTags: ['UI', '收藏'] });
      }
      if (s.endsWith('saved-filters.json')) return '[]';
      if (s.endsWith('.js') && s.includes('/src/i18n/')) return syncText(s) || '{}';
      const url = toFileUrl(s);
      if (encoding === 'utf8' || encoding === 'utf-8') {
        return syncText(url) || '';
      }
      const binary = syncArrayBuffer(url);
      if (binary) return BrowserBuffer.from(new Uint8Array(binary));
      return '';
    },
    exists(p, callback) {
      if (typeof callback === 'function') setTimeout(() => callback(fsModule.existsSync(p)), 0);
    },
    writeFileSync() {},
    writeFile() {
      const cb = arguments[arguments.length - 1];
      if (typeof cb === 'function') setTimeout(cb, 0);
    },
    readFile(p, encoding, callback) {
      if (typeof encoding === 'function') {
        callback = encoding;
        encoding = undefined;
      }
      if (typeof callback !== 'function') return;
      const s = String(p || '').replace(/\\/g, '/');
      if (s.includes('Settings')) {
        setTimeout(() => callback(null, JSON.stringify({ preferences: { general: { language: 'zh_CN' } } })), 0);
        return;
      }
      if (s.endsWith('tags.json')) {
        setTimeout(() => callback(null, JSON.stringify({ historyTags: ['UI', 'empty'], starredTags: ['UI', 'favorite'] })), 0);
        return;
      }
      if (s.endsWith('saved-filters.json')) {
        setTimeout(() => callback(null, '[]'), 0);
        return;
      }
      const xhr = new XMLHttpRequest();
      xhr.open('GET', toFileUrl(s), true);
      xhr.responseType = encoding === 'utf8' || encoding === 'utf-8' ? 'text' : 'arraybuffer';
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) callback(null, xhr.response);
        else callback(new Error(`ENOENT: no such file or directory, open '${s}'`));
      };
      xhr.onerror = () => callback(new Error(`ENOENT: no such file or directory, open '${s}'`));
      xhr.send(null);
    },
    readdirSync() {
      return [];
    },
    readdir() {
      const cb = arguments[arguments.length - 1];
      if (typeof cb === 'function') setTimeout(() => cb(null, []), 0);
      return [];
    },
    statSync() {
      return {
        isDirectory: () => false,
        isFile: () => true,
        isSymbolicLink: () => false,
        size: 1,
        mtimeMs: Date.now(),
      };
    },
    lstatSync() {
      return fsModule.statSync();
    },
    renameSync() {},
    unlinkSync() {},
    mkdirSync() {},
    rmSync() {},
    removeSync() {},
    copyFileSync() {},
    createReadStream() {
      return { on() { return this; }, pipe() { return this; } };
    },
    createWriteStream() {
      return { on() { return this; }, end() {}, write() {} };
    },
  };

  const electronLog = {
    info() {},
    warn() {},
    error() {},
    debug() {},
    verbose() {},
    transports: {
      file: {
        appName: '',
        level: 'info',
        maxSize: 20 * 1024 * 1024,
      },
    },
  };

  class EventEmitter {
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

  const ipcRenderer = new EventEmitter();
  const mockEmit = ipcRenderer.emit.bind(ipcRenderer);
  const desktopSendChannels = new Set(['create-library', 'open-library', 'add-to-history-and-open']);
  ipcRenderer.send = function (channel, params) {
    if (desktopApi && desktopApi.library && desktopSendChannels.has(channel)) {
      if (channel === 'create-library') desktopApi.library.create(params || {}).catch(() => {});
      else desktopApi.library.switch(params).catch(() => {});
      return;
    }
    if (desktopApi && desktopApi.import) {
      let action = null;
      if (channel === 'upload-local-files') action = desktopApi.import.files(params || {});
      if (channel === 'upload-url') action = desktopApi.import.url(params || {});
      if (channel === 'upload-urls') action = desktopApi.import.urls(params || []);
      if (channel === 'import-folders') action = desktopApi.import.folders(params || {});
      if (action) {
        Promise.resolve(action)
          .then((result) => {
            const items = Array.isArray(result) ? result : [result];
            items.forEach((item) => mockEmit('file-uploaded', item));
            mockEmit('import:operation-result', { ok: true, channel, items });
          })
          .catch((err) => mockEmit('import:operation-result', { ok: false, channel, error: err.message }));
        return;
      }
    }
    if (desktopApi && desktopApi.export) {
      if (channel === 'export-images') {
        desktopApi.export.images(params || {}).catch(() => {});
        return;
      }
      if (channel === 'export-as-folder') {
        desktopApi.export.asFolder(params || {}).catch(() => {});
        return;
      }
      if (channel === 'cancel.all') {
        desktopApi.export.cancel().catch(() => {});
        return;
      }
      if (channel === 'show-item-in-folder') {
        console.debug('[eagle-shim] reveal exported item', params);
        return;
      }
    }
    if (channel === 'update-main-window-id' || channel === 'check-for-update') return;
    console.debug('[eagle-shim] ipc send', channel, params);
  };
  ipcRenderer.invoke = function (channel, params) {
    if (desktopApi) {
      if (channel === 'get-collect-window-data') return desktopApi.getCollectWindowData();
      if (channel === 'library:get-current' && desktopApi.library) return desktopApi.library.current();
    }
    return EventEmitter.prototype.invoke.call(this, channel, params);
  };
  if (desktopApi && desktopApi.library) {
    if (typeof desktopApi.library.onChanged === 'function') {
      desktopApi.library.onChanged((library) => mockEmit('library:changed', library));
    }
    if (typeof desktopApi.library.onOperationResult === 'function') {
      desktopApi.library.onOperationResult((result) => mockEmit('library:operation-result', result));
    }
  }

  const windowApi = () => (window.eagleDesktop && window.eagleDesktop.window) || null;
  const windowListeners = new Map();
  const windowState = (() => {
    const api = windowApi();
    return {
      maximized: api ? Boolean(api.isMaximized()) : false,
      fullScreen: api ? Boolean(api.isFullScreen()) : false,
    };
  })();

  function addWindowListener(channel, callback) {
    if (!windowListeners.has(channel)) windowListeners.set(channel, []);
    windowListeners.get(channel).push(callback);
  }

  function emitWindowEvent(channel, ...args) {
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

  const currentWindow = {
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

  const app = {
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

  const nativeTheme = { shouldUseDarkColors: false, on() {}, off() {} };
  function dialogOptions(first, second) {
    return second && typeof second === 'object' ? second : (first && typeof first === 'object' && !first.webContents ? first : {});
  }

  const dialog = {
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

  class MenuItem {
    constructor(options = {}) {
      Object.assign(this, options);
      this.submenu = options.submenu || [];
    }

    append(item) {
      this.submenu.push(item);
    }
  }

  let applicationMenu = null;

  function getRoleClick(role) {
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

  const Menu = {
    buildFromTemplate: (template) => createShimMenu(template),
    setApplicationMenu(menu) {
      applicationMenu = menu;
    },
    getApplicationMenu: () => applicationMenu || createShimMenu([]),
  };

  class BrowserWindow {
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

  const remote = {
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

  const electron = {
    ipcRenderer,
    webFrame: {
      setZoomFactor() {},
      getZoomFactor: () => 1,
      getResourceUsage: () => ({ images: { count: 0, liveSize: 0 } }),
    },
    clipboard: {
      writeText() {},
      readText: () => '',
      writeImage() {},
      readImage: () => ({ toPNG: () => BrowserBuffer.alloc(0), getSize: () => ({ width: 0, height: 0 }) }),
      clear() {},
      availableFormats: () => [],
    },
    shell: {
      openExternal: () => Promise.resolve(),
      openPath: () => Promise.resolve(''),
      showItemInFolder() {},
      beep() {},
    },
  };

  function writeFileAtomic(file, data, cb) {
    if (typeof cb === 'function') setTimeout(cb, 0);
  }

  function genericStub(name) {
    const stub = function () { return stub; };
    stub.__mockName = String(name || 'module');
    ['forEach', 'map', 'filter', 'reduce', 'then', 'catch', 'finally', 'on', 'once', 'off'].forEach((key) => {
      if (!stub[key]) stub[key] = function () { return stub; };
    });
    return stub;
  }

  const lineByLineMock = class LineByLineMock {
    constructor(filePath, options) {
      let lines = [];
      if (nativeFs) {
        try {
          lines = nativeFs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
        } catch (err) {
          lines = [];
        }
      }
      if (lines.length === 0) {
        const items = (window.__mockLibraryCache || []).slice();
        lines = items.map((item) => JSON.stringify(item));
      }
      this.lines = lines;
      this.index = 0;
    }

    next() {
      if (this.index >= this.lines.length) return false;
      return this.lines[this.index++];
    }

    close() {}
  };

  const urlModule = {
    pathToFileURL(p) {
      const path = String(p || '').replace(/^file:\/\//, '');
      return new URL(path, window.location.origin);
    },
    fileURLToPath(u) {
      return String(u || '').replace(/^file:\/\//, '');
    },
    format(u) {
      return String(u || '');
    },
  };

  class JsonRestServerStub {
    constructor(options) {
      this.options = options || {};
    }

    addAPI() {}
    addHandler() {}
    start(callback) {
      if (typeof callback === 'function') setTimeout(callback, 0);
      return Promise.resolve(this);
    }
    stop() {}
  }

  const pluginModule = {
    plugins: [],
    pinnedPlugins: [],
    pluginWindowIds: [],
    pluginShortcuts: {},
    installedPluginMaps: {},
    needUpdatePluginMaps: {},
    servicePlugins: {},
    disabledPluginMaps: {},
    pluginMenu: { submenu: [] },
    previewExtension: {
      inspectorPlugins: [],
      inspectorPluginsMap: {},
      inspectorPluginPathMap: {},
      thumbnailPluginMap: {},
      thumbnailPath: {},
      thumbnailOptions: {},
      viewerPluginMap: {},
      viewerURL: {},
      getViewerPlugin: () => undefined,
      allowZoom: () => false,
      getInspectorPluginURL: () => '',
      hasInspectorPlugin: () => false,
      getMultiSelectInspectorPlugin: () => [],
    },
    isPluginDisabled: () => false,
    loadDisabledPlugins() {},
    saveDisabledPlugins() {},
    init: () => Promise.resolve(),
    initIPC() {},
    initServicePlugins() {},
    initShortcuts() {},
    initMenu() {},
    checkAllDependencies() {},
    refresh: () => Promise.resolve(),
    refreshInstalledPlugins() {},
    checkPluginInstalled: () => false,
    showInstallPluginDialog() {},
    openPluginById() {},
    showPluginById() {},
    isOpen: () => false,
    isVisible: () => false,
    getLastOpenedPlugins: () => [],
    addToLastOpenedPlugins() {},
    create: () => Promise.resolve(),
    open() {},
    openPreview() {},
    pinPlugin() {},
    unpinPlugin() {},
    reloadPlugin: () => Promise.resolve(),
    packPlugin: () => Promise.resolve(),
    enablePlugin() {},
    disablePlugin() {},
    destroyPlugin() {},
    destoryPlugin() {},
    localPlugin: { load: () => Promise.resolve(), uninstall: () => Promise.resolve() },
    remotePlugin: { install: () => Promise.resolve(), uninstall: () => Promise.resolve() },
  };

  const settingsMemory = {};
  const settingsPrefix = 'eagle.reverse.settings.';
  function readSetting(key) {
    if (Object.prototype.hasOwnProperty.call(settingsMemory, key)) return settingsMemory[key];
    try {
      const raw = localStorage.getItem(settingsPrefix + key);
      return raw === null ? undefined : JSON.parse(raw);
    } catch (err) {
      return undefined;
    }
  }
  function writeSetting(key, value) {
    settingsMemory[key] = value;
    try {
      localStorage.setItem(settingsPrefix + key, JSON.stringify(value));
    } catch (err) {
      // Keep the in-memory value when storage is unavailable.
    }
    if (desktopApi && desktopApi.library && key === 'libraryHistory') {
      desktopApi.library.setHistory(value).catch(() => {});
    }
  }

  const electronSettings = {
    getPreferences() {
      const defaults = loadJsModule('/src/app/js/default-preferences.js') || {};
      return {
        ...defaults,
        general: { ...(defaults.general || {}), language: 'zh_CN' },
        theme: { ...(defaults.theme || {}), name: 'DARK', css: 'dark' },
      };
    },
    getSync(key) {
      const value = readSetting(key);
      if (value !== undefined) return value;
      if (key === 'colorSpace') return 'Unmanaged';
      if (key === 'libraryHistory') {
        const current = window.__mockLibrary && window.__mockLibrary.rootDir;
        return current ? [current] : [];
      }
      return undefined;
    },
    setSync(key, value) { writeSetting(key, value); },
    get(key) { return Promise.resolve(this.getSync(key)); },
    set(key, value) { writeSetting(key, value); return Promise.resolve(value); },
    has: (key) => readSetting(key) !== undefined,
    delete(key) {
      delete settingsMemory[key];
      try { localStorage.removeItem(settingsPrefix + key); } catch (err) {}
    },
    clear() {
      Object.keys(settingsMemory).forEach((key) => delete settingsMemory[key]);
    },
  };

  class MockI18n {
    constructor() {
      this.locale = 'zh_CN';
      this.translations = this.load(this.locale);
      if (Object.keys(this.translations).length === 0) {
        const retry = setInterval(() => {
          const loaded = this.load(this.locale);
          if (Object.keys(loaded).length > 0) {
            this.translations = loaded;
            clearInterval(retry);
          }
        }, 50);
        setTimeout(() => clearInterval(retry), 3000);
      }
    }

    load(locale) {
      const raw = syncText(`/src/i18n/${locale}.js`);
      const text = raw ? raw.split(/\r?\n\/\/# sourceMappingURL=/)[0] : null;
      if (text === null) return {};
      try {
        return JSON.parse(text);
      } catch (err) {
        console.warn('[eagle-shim] failed to parse i18n', locale, err);
        return {};
      }
    }

    __(phrase) {
      return this.translations[phrase] !== undefined ? this.translations[phrase] : phrase;
    }

    reload() {
      const preferences = electronSettings.getPreferences() || {};
      const locale = (preferences.general && preferences.general.language) || 'zh_CN';
      this.locale = locale;
      this.translations = this.load(locale);
    }
  }

  const bareModules = {
    'electron': electron,
    '@electron/remote': remote,
    'path': nativePath || pathModule,
    'node:path': nativePath || pathModule,
    'url': urlModule,
    'node:url': urlModule,
    'fs': nativeFs || fsModule,
    'os': osModule,
    'console': console,
    'crypto': {
      randomUUID: () => 'mock-uuid-' + Math.random().toString(36).slice(2),
      randomBytes: (size) => BrowserBuffer.alloc(size || 16),
      createHash: () => ({ update() { return this; }, digest: () => BrowserBuffer.alloc(32) }),
    },
    'child_process': {
      execSync: () => BrowserBuffer.from(''),
      exec() {},
      spawnSync: () => ({ stdout: BrowserBuffer.from(''), status: 0 }),
      spawn: () => ({ on() {}, stdout: { on() {} }, stderr: { on() {} } }),
    },
    'fs-extra': nativeFs || fsModule,
    'async': {
      each() {},
      eachOf() {},
      eachLimit() {},
      eachOfLimit() {},
      map() {},
      series() {},
      parallel() {},
      waterfall() {},
      queue: () => ({ push() {}, drain() {} }),
    },
    'request': Object.assign(function request() {}, { get() {}, post() {}, put() {}, del() {} }),
    'mpv-video-player': {
      MpvVideoElement: { use() {} },
      defaultPlugins: [],
      ABLoopPlugin: {},
    },
    'auto-launch': class AutoLaunchMock {
      constructor() {
        this._enabled = false;
      }
      enable() {
        this._enabled = true;
        return Promise.resolve();
      }
      disable() {
        this._enabled = false;
        return Promise.resolve();
      }
      isEnabled() {
        return Promise.resolve(this._enabled);
      }
    },
    'color-convert': {},
    'delta-e': { getDeltaE76: () => 0, getDeltaE00: () => 0 },
    'tiny-pinyin': { convertToPinyin: (text) => String(text || '').split('').join('') },
    'pinyinlite': { searchAll: () => [] },
    'read-chunk': () => BrowserBuffer.alloc(0),
    'write-file-atomic': writeFileAtomic,
    'cartesian-product': () => [],
    'sanitize-filename': (name) => String(name || '').replace(/[\\/:*?"<>|]/g, '-'),
    'normalize-strings': (text) => String(text || ''),
    'chinese_convert': { t2s: (s) => s, s2t: (s) => s, convert: (s) => s },
    'isnumber': () => false,
    'moment': (value) => new Date(value || Date.now()),
    'cancellation': () => ({ token: {} }),
    'fast-glob': () => Promise.resolve([]),
    'archiver': () => ({
      on() { return this; },
      pipe() { return this; },
      append() { return this; },
      directory() { return this; },
      finalize() { return this; },
    }),
    'electron-log': electronLog,
  };

  const moduleCache = new Map();
  const appRootModule = {
    path: '/src',
    toString: () => '/src',
  };

  function loadJsModule(urlPath) {
    if (moduleCache.has(urlPath)) return moduleCache.get(urlPath).exports;
    const source = syncText(urlPath);
    if (source === null) {
      const stub = genericStub(urlPath);
      moduleCache.set(urlPath, { exports: stub });
      return stub;
    }
    const module = { exports: {} };
    const fn = new Function(
      'module',
      'exports',
      'require',
      'process',
      'global',
      'Buffer',
      '__filename',
      '__dirname',
      source
    );
    try {
      fn(module, module.exports, require, window.process, window, window.Buffer, urlPath, dirname(urlPath));
    } catch (err) {
      console.warn(`[eagle-shim] failed to load ${urlPath}`, err);
      module.exports = genericStub(urlPath);
    }
    moduleCache.set(urlPath, module);
    return module.exports;
  }

  function require(request) {
    const req = String(request || '').replace(/\\/g, '/');
    if (isElectronRuntime && nativeRequire && (req === 'fs' || req === 'node:fs' || req === 'path' || req === 'node:path')) {
      return nativeRequire(req);
    }
    if (req === 'app-root-path') return appRootModule;
    if (bareModules[req] !== undefined) return bareModules[req];
    if (req === '/src/i18n' || req === '/src/i18n/index.js') return MockI18n;
    if (req.startsWith('/src/')) {
      if (req.endsWith('/my_modules/electron-settings')) return electronSettings;
      if (req.endsWith('/my_modules/url')) return urlModule;
      if (req.endsWith('/my_modules/json-rest-light')) return { JsonRestServer: JsonRestServerStub };
      if (req.endsWith('/app/js/api-server-v2')) return { initAPIServerV2() {} };
      if (req.endsWith('/app/js/plugin')) return pluginModule;
      if (req.endsWith('/app/js/plugins/eagle-note-plugin')) return {};
      if (req.endsWith('/my_modules/n-readlines')) return lineByLineMock;
      if (req.endsWith('/my_modules/appdata-path')) return () => '/mock-user-data';
      if (req.endsWith('/my_modules/junk')) return { not: () => true, is: () => false };
      if (req.endsWith('/my_modules/is-hidden-file')) return () => false;
      if (req.endsWith('/my_modules/file-icon')) return { getFileIcon: () => Promise.resolve({}), getFileIconSync: () => null };
      if (req.endsWith('/my_modules/is-directory')) return { check: () => false, checkSync: () => false };
      if (req.endsWith('/my_modules/access')) return { checkALCs: () => true, checkAccess: () => true, checkACL: () => true };
      if (req.endsWith('/app/js/utils/remainingFilenameLength.js')) return () => 240;
      if (req.endsWith('/app/js/utils/getBestURL.js')) return () => '';
      if (req.endsWith('/app/js/utils/is-accelerator.js')) return () => true;
      if (req.endsWith('/app/js/utils/unorm.js')) return { nfc: (s) => s, nfd: (s) => s };
      if (req.endsWith('/app/js/utils/flipImage.js')) return () => {};
      if (req.endsWith('/app/js/utils/rotateImage.js')) return () => {};
      if (req.endsWith('/my_modules/tiny-pinyin')) return bareModules['tiny-pinyin'];
      if (req.endsWith('/my_modules/pinyinlite')) return bareModules['pinyinlite'];
      if (req.endsWith('/my_modules/cartesian-product')) return () => [];
      if (req.endsWith('/my_modules/sanitize-filename')) return bareModules['sanitize-filename'];
      if (req.endsWith('/my_modules/chinese_convert')) return bareModules['chinese_convert'];
      if (req.endsWith('/my_modules/get-drive-type')) return () => 'local';
      if (req.endsWith('/my_modules/curl-request')) return { get: () => Promise.resolve(''), post: () => Promise.resolve('') };
      if (req.endsWith('/my_modules/downloadFile')) return { download: () => Promise.resolve() };
      if (req.endsWith('/my_modules/vtt2srt')) return () => {};
      if (req.endsWith('/my_modules/bplist-parse')) return () => '';
      if (req.endsWith('/my_modules/heif/native')) return {};
      if (req.endsWith('/my_modules/image-cropper')) return () => {};
      if (req.endsWith('/my_modules/get-associated-application')) return () => Promise.resolve([]);
      if (req.endsWith('/my_modules/image-size')) return () => null;
      if (req.endsWith('.json')) {
        const text = syncText(req);
        return text === null ? {} : JSON.parse(text);
      }
      return loadJsModule(req);
    }
    return genericStub(req);
  }

  window.process = {
    platform: 'win32',
    arch: 'x64',
    env: { SYSTEMROOT: 'C:\\Windows' },
    resourcesPath: '/mock-resources',
    versions: { electron: '22.3.7', node: '22.0.0' },
    release: '10.0.22631',
    getProcessMemoryInfo: () => Promise.resolve({ workingSetSize: 0 }),
    getSystemMemoryInfo: () => ({ total: 0 }),
    getCPUUsage: () => ({ percentCPUUsage: 0 }),
    cwd: () => '/src',
    pid: 1,
    ppid: 0,
    on() {},
    once() {},
    removeListener() {},
    nextTick: (callback, ...args) => setTimeout(() => callback(...args), 0),
  };

  window.Buffer = BrowserBuffer;
  window.global = window;
  window.global.EAGLE_THUMBNAIL_TEMP_PATH = '/mock-thumbnails';
  window.require = require;
  window.__eagleRequire = require;
  window.electron = electron;
  window.$$electronIpc = ipcRenderer;
  window.__eagleIpc = ipcRenderer;
  window.__eagleSyncText = syncText;
  window.electronSettings = electronSettings;
  window.pluginModule = pluginModule;
  window.tinyPinyin = bareModules['tiny-pinyin'];
  window.pinyinlite = bareModules['pinyinlite'];

  const tinyPinyinGuard = setInterval(() => {
    if (!window.tinyPinyin || typeof window.tinyPinyin.convertToPinyin !== 'function') {
      window.tinyPinyin = bareModules['tiny-pinyin'];
    }
    if (!window.pinyinlite || typeof window.pinyinlite.searchAll !== 'function') {
      window.pinyinlite = bareModules['pinyinlite'];
    }
  }, 50);
  setTimeout(() => clearInterval(tinyPinyinGuard), 6000);

  function emitMockLifecycle() {
    const lib = window.__mockLibrary || {
      rootDir: '/mock-library/Eagle Reverse Demo.library',
      imagesDir: '/mock-library/Eagle Reverse Demo.library/images/',
      folders: [],
      smartFolders: [],
      quickAccess: [],
      tagsGroups: [],
    };
    const items = window.__mockLibraryCache || [];
    const registration = {
      activated: true,
      machineID: 'preview',
      license: { email: 'preview@eagle.local' },
    };
    const pagePath = window.location.pathname || '';

    if (pagePath.includes('font-viewer') || pagePath.includes('text-editor') || pagePath.includes('gif-viewer')) {
      const noop = () => {};
      const viewerMethods = {
        removeStar: noop,
        changeTo1Star: noop,
        changeTo2Star: noop,
        changeTo3Star: noop,
        changeTo4Star: noop,
        changeTo5Star: noop,
        selectPrev: noop,
        selectNext: noop,
        escHandler: noop,
        activateFont: noop,
        deactivateFont: noop,
        isFontActivate: () => false,
        imagesChange: noop,
        $evalAsync: noop,
        $eavlAsync: noop,
      };
      window.$bodyScope = {
        ...viewerMethods,
        preferences: { general: { language: 'zh_CN' } },
        imagesDir: '/mock-library/Eagle Reverse Demo.library/images/',
        inspector: { newName: '' },
        gifViewer: {
          onFinished: (data) => console.debug('[eagle-shim] gif viewer finished', data && data.frames ? data.frames.length : 0),
          onProgress: (progress, length) => console.debug('[eagle-shim] gif viewer progress', progress, length),
        },
        current: {
          id: pagePath.includes('font-viewer') ? 'MOCK-FONT' : 'MOCK0001',
          name: pagePath.includes('font-viewer') ? 'LiberationSans-Regular' : 'Sample Notes',
          ext: pagePath.includes('font-viewer') ? 'ttf' : 'txt',
          star: 5,
          tags: ['UI'],
          fontMetas: {
            support: {},
            fontFamily: { en: 'Liberation Sans', zh_CN: 'Liberation Sans' },
            postScriptName: { en: 'LiberationSans-Regular' },
            fullName: { en: 'Liberation Sans' },
            version: { en: '2.00.1' },
            designer: { en: 'Red Hat, Inc.' },
            manufacturer: { en: 'Red Hat, Inc.' },
            license: { en: 'SIL Open Font License' },
            numGlyphs: 3257,
          },
        },
      };
    }

    if (pagePath.includes('model-viewer')) {
      window.hasCallback = true;
      try {
        Object.defineProperty(window, 'frameElement', {
          configurable: true,
          value: {
            getAttribute: () => null,
          },
        });
      } catch (err) {
        console.warn('[eagle-shim] failed to mock frameElement', err);
      }
    }

    if (pagePath.includes('preferences.html')) {
      const query = new URLSearchParams(window.location.search);
      setTimeout(() => {
        ipcRenderer.emit('init', {
          Registration: registration,
          panel: query.get('panel') || '',
          keyword: query.get('keyword') || '',
        });
      }, 500);
      return;
    }

    if (pagePath.includes('preview-window.html')) {
      const query = new URLSearchParams(window.location.search);
      const id = query.get('id');
      const image = items.find((item) => item.id === id) || items[0];
      setTimeout(() => {
        ipcRenderer.emit('init', {
          images: image ? [image] : [],
          imagesDir: lib.imagesDir,
          rootDir: lib.rootDir,
          machineID: 'preview',
          Registration: registration,
          pluginModule,
        });
      }, 500);
      return;
    }

    if (pagePath.includes('collect-window')) {
      setTimeout(() => {
        const retry = setInterval(() => {
          try {
            if (!window.angular) return;
            const panel = document.querySelector('folder-select-panel');
            if (!panel) return;
            const iso = angular.element(panel).isolateScope();
            const root = angular.element(document.querySelector('[ng-controller]')).scope();
            if (!iso || !root) return;
            if (iso.listData && Array.isArray(iso.listData.items) && iso.listData.items.length > 0) {
              clearInterval(retry);
              return;
            }
            if (Array.isArray(root.folders) && root.folders.length > 0 && typeof root.initFolderSelect === 'function') {
              root.initFolderSelect();
            }
          } catch (err) {
            console.warn('[eagle-shim] collect panel retry failed', err);
          }
        }, 100);
        setTimeout(() => clearInterval(retry), 6000);
      }, 250);
    }

    if (!pagePath.endsWith('/index.html') && !pagePath.endsWith('/src/app/index.html')) {
      return;
    }

    setTimeout(() => {
      ipcRenderer.emit('initial', {
        trialRemain: 0,
        machineID: 'preview',
        Registration: registration,
        errorMsg: '',
      });
    }, 250);

    setTimeout(() => {
      ipcRenderer.emit('preload-library', {
        cachePath: `${lib.rootDir}/cache.json`,
      });
    }, 350);

    setTimeout(() => {
      ipcRenderer.emit('app-status-library-loaded', {
        machineID: 'preview',
        backgroundWindowID: 1,
        usingCache: false,
        usingPreloadCache: true,
        loadedTime: 0.01,
        rootDir: lib.rootDir,
        imagesDir: lib.imagesDir,
        imagesStringPath: `${lib.rootDir}/cache.json`,
        cachePath: `${lib.rootDir}/cache.json`,
        folders: lib.folders || [],
        smartFolders: lib.smartFolders || [],
        quickAccess: lib.quickAccess || [],
        tagsGroups: lib.tagsGroups || [],
        modificationTime: Date.now(),
      });
    }, 550);
  }

  function startLifecycle() {
    if (desktopApi && desktopApi.library && typeof desktopApi.library.current === 'function') {
      desktopApi.library.current().then((library) => {
        window.__mockLibrary = {
          ...library,
          rootDir: library.rootDir || library.path,
          imagesDir: library.imagesDir,
          libraryName: library.libraryName || library.name,
        };
        window.__mockLibraryCache = Array.isArray(library.items) ? library.items.slice() : [];
        const storedHistory = readSetting('libraryHistory');
        settingsMemory.libraryHistory = [library.path, ...(Array.isArray(storedHistory) ? storedHistory : [])].filter(Boolean).filter((value, index, array) => array.indexOf(value) === index);
        emitMockLifecycle();
      }).catch((err) => {
        console.warn('[eagle-shim] current library bootstrap failed', err);
        emitMockLifecycle();
      });
      return;
    }
    emitMockLifecycle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startLifecycle, { once: true });
  } else {
    startLifecycle();
  }
})();
