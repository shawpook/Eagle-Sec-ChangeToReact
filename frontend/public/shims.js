(function () {
  'use strict';

  if (window.__eagleBrowserShimLoaded) return;
  window.__eagleBrowserShimLoaded = true;

  const nativeRequire = typeof window.require === 'function' ? window.require : null;
  const isElectronRuntime =
    typeof process !== 'undefined' && process.versions && typeof process.versions.electron === 'string';
  let realElectron = null;
  let realRemote = null;
  if (isElectronRuntime && nativeRequire) {
    // Keep the renderer on the mock IPC path in both browser and Electron so
    // the original app can receive the same lifecycle events used by the preview.
    realElectron = null;
    realRemote = null;
  }

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
      console.debug('[eagle-shim] ipc sendTo', id, channel, params);
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

  const currentWindow = {
    id: 1,
    getTitle: () => 'Eagle',
    isDestroyed: () => false,
    isMaximized: () => false,
    isFullScreen: () => false,
    hide() {},
    show() {},
    close() {},
    minimize() {},
    maximize() {},
    unmaximize() {},
    restore() {},
    flashFrame() {},
    setFullScreen() {},
    setAlwaysOnTop() {},
    getOpacity: () => 1,
    setOpacity() {},
    focus() {},
    blur() {},
    getBounds: () => ({ x: 0, y: 0, width: 1280, height: 720 }),
    setBounds() {},
    setMinimumSize() {},
    setSize() {},
    getSize: () => [1280, 720],
    on() {},
    once() {},
    addListener() {},
    removeListener() {},
    emit() {},
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
  const dialog = {
    showOpenDialog: () => Promise.resolve({ canceled: true, filePaths: [] }),
    showSaveDialog: () => Promise.resolve({ canceled: true, filePath: '' }),
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

  const Menu = {
    buildFromTemplate: () => ({ popup() {}, append() {}, submenu: [], items: [] }),
    setApplicationMenu() {},
    getApplicationMenu: () => null,
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
      const items = (window.__mockLibraryCache || []).slice();
      this.lines = items.map((item) => JSON.stringify(item));
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
      return key === 'colorSpace' ? 'Unmanaged' : undefined;
    },
    setSync() {},
    get() {},
    set() {},
    has: () => false,
    delete() {},
    clear() {},
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
    'electron': realElectron || electron,
    '@electron/remote': realRemote || remote,
    'path': pathModule,
    'node:path': pathModule,
    'url': urlModule,
    'node:url': urlModule,
    'fs': fsModule,
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
    'fs-extra': fsModule,
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
  window.electron = realElectron || electron;
  window.$$electronIpc = (realElectron && realElectron.ipcRenderer) || ipcRenderer;
  window.__eagleIpc = (realElectron && realElectron.ipcRenderer) || ipcRenderer;
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', emitMockLifecycle, { once: true });
  } else {
    emitMockLifecycle();
  }
})();
