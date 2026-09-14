// @ts-nocheck
/**
 * R2 浏览器/Node 适配层：shim 需要的 node 内置模块面、同步 XHR 读取、Buffer 兜底、
 * 浏览器 fetch/媒体 duration 补丁，以及 Electron 原生模块的浏览器回退实现。
 *
 * 迁移自 `core/shimsLegacy.ts` 的 IIFE（原 519-796、2305-2460 区间），函数体逐字保留。
 * 跨模块依赖仅 `./environment`（原生桥探针）；模块装配表（bareModules）与 require 链
 * 在 `./moduleRegistry`（需要 Electron 能力面，避免此处引入反向依赖）。
 */
import { desktopApi, isElectronRuntime, nativeFs, nativeRequire } from "./environment";
let browserFetchRewritten = false;
let mediaDurationPatched = false;

export function installBrowserFetchRewrite() {
  if (browserFetchRewritten) return;
  browserFetchRewritten = true;
  const browserFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
  if (browserFetch) {
    window.fetch = function (input, init) {
      let target = typeof input === 'string' ? input : input && input.url;
      if (typeof target === 'string') {
        const apiBase = window.__EAGLE_API_BASE_URL || 'http://localhost:41695';
        const extensionBase = window.__EAGLE_EXTENSION_BASE_URL || 'http://localhost:41693';
        target = target
          .replace(/^http:\/\/localhost:41595(?=\/|$)/i, apiBase.replace(/\/$/, ''))
          .replace(/^http:\/\/localhost:41593(?=\/|$)/i, extensionBase.replace(/\/$/, ''));
        if (typeof input === 'string') input = target;
        else input = new Request(target, input);
      }
      return browserFetch(input, init);
    };
  }
}

export function installMediaDurationPatch() {
  if (mediaDurationPatched) return;
  mediaDurationPatched = true;
  if (typeof HTMLMediaElement !== 'undefined') {
    const durationDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'duration');
    if (durationDescriptor && typeof durationDescriptor.get === 'function') {
      const nativeDurationGet = durationDescriptor.get;
      Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
        configurable: true,
        enumerable: durationDescriptor.enumerable,
        get() {
          const native = nativeDurationGet.call(this);
          if (Number.isFinite(native) && native > 0) return native;
          if (this.readyState >= 1) return 1;
          return NaN;
        },
        set(value) {
          if (typeof durationDescriptor.set === 'function') durationDescriptor.set.call(this, value);
        },
      });
    }
  }
}

export function syncText(url) {
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

export function syncArrayBuffer(url) {
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

export function toFileUrl(p) {
  const s = String(p || '').replace(/\\/g, '/');
  if (/^[a-z]+:\/\//i.test(s)) return s;
  if (s.startsWith('/')) return window.location.origin + s;
  return window.location.origin + '/' + s;
}

export function dirname(p) {
  const clean = String(p || '').replace(/\\/g, '/').replace(/\/+$/, '');
  const idx = clean.lastIndexOf('/');
  return idx <= 0 ? '/' : clean.slice(0, idx) || '/';
}

export const pathModule = {
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

export class BrowserBuffer extends Uint8Array {
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

export const osModule = {
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

export const fsModule = {
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
    if (s.endsWith('saved-filters.json')) {
      // 浏览器 fallback 读取当前库真实保存筛选，不再固定返回空数组。
      const savedFilters = window.__mockLibrary && window.__mockLibrary.savedFilters;
      return Array.isArray(savedFilters) ? JSON.stringify(savedFilters) : '[]';
    }
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
      const savedFilters = window.__mockLibrary && window.__mockLibrary.savedFilters;
      setTimeout(() => callback(null, Array.isArray(savedFilters) ? JSON.stringify(savedFilters) : '[]'), 0);
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

export const electronLog = {
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

export function genericStub(name) {
  const stub = function () { return stub; };
  stub.__mockName = String(name || 'module');
  ['forEach', 'map', 'filter', 'reduce', 'then', 'catch', 'finally', 'on', 'once', 'off'].forEach((key) => {
    if (!stub[key]) stub[key] = function () { return stub; };
  });
  return stub;
}

export const lineByLineMock = class LineByLineMock {
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

export function localAssetUrl(value) {
  const target = String(value || '');
  if (/^https?:\/\//i.test(target)) return target;
  if (/^(?:[a-zA-Z]:[\\/]|\\\\)/.test(target)) {
    if (window.location && /^https?:$/.test(window.location.protocol)) {
      return `${window.location.origin}/file/${encodeURIComponent(target)}`;
    }
    if (desktopApi && typeof desktopApi.thumbnailUrl === 'function') {
      return desktopApi.thumbnailUrl(target);
    }
    return `${window.location.origin}/file/${encodeURIComponent(target)}`;
  }
  return new URL(target.replace(/^file:\/\//, ''), window.location.origin).href;
}

export const urlModule = {
  pathToFileURL(p) {
    return new URL(localAssetUrl(p));
  },
  fileURLToPath(u) {
    const value = String(u || '');
    try {
      const parsed = new URL(value);
      if (/^https?:$/i.test(parsed.protocol) && parsed.searchParams.has('filePath')) {
        return parsed.searchParams.get('filePath');
      }
      if (/^https?:$/i.test(parsed.protocol) && parsed.pathname.startsWith('/file/')) {
        return decodeURIComponent(parsed.pathname.slice('/file/'.length));
      }
    } catch (err) {}
    return value.replace(/^file:\/\//, '');
  },
  format(u) {
    return String(u || '');
  },
};

export class JsonRestServerStub {
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

export const pluginModule = {
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
    getViewerPluginExt(item) {
      if (!item) return undefined;
      if (this.viewerPluginMap && this.viewerPluginMap[item.ext]) return 'plugin';
      const imageTypes = {
        jpg: true, jpeg: true, png: true, webp: true, avif: true, insp: true,
        jfif: true, jpe: true, jxl: true, bmp: true, tif: true, tiff: true,
        hif: true, heif: true, heic: true,
      };
      if (imageTypes[item.ext]) return 'image';
      if (item.customThumbnail && window.EagleConfig && !window.EagleConfig.SUPPORT_FORMATS[item.ext]) return 'custom';
      return item.ext;
    },
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
