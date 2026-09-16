// @ts-nocheck
/**
 * R2 浏览器/Node 适配层：shim 需要的 node 内置模块面、同步 XHR 读取、Buffer 兜底、
 * 浏览器 fetch/媒体 duration 补丁，以及 Electron 原生模块的浏览器回退实现。
 *
 * 迁移自 `core/shimsLegacy.ts` 的 IIFE（原 519-796、2305-2460 区间），函数体逐字保留。
 * 跨模块依赖仅 `./environment`（原生桥探针）；模块装配表（bareModules）与 require 链
 * 在 `./moduleRegistry`（需要 Electron 能力面，避免此处引入反向依赖）。
 */
import {
  capabilityGap, demoFileStore, desktopApi, failCapability, isDemoRuntime, isElectronRuntime, markUnavailable, nativeFs,
  nativeRequire, RuntimeCapabilityError,
} from "./environment";
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

/**
 * M2-1：媒体 `duration` 全局补丁 —— **仅 demo 态注入**。
 *
 * 修前（`install.ts:44` 无条件调用）在 electron 下同样覆盖 `HTMLMediaElement.prototype.duration`，
 * 把「未知时长」伪造成 `1` 秒（调研 §D-11、§E.8：electron/Chromium 原生实现本已正确，此补丁
 * 纯属污染，直接影响时长显示、进度条与 `vtt2srt` 字幕时间轴）。M2 验收明令「不全局伪造媒体原型」，
 * 故真实业务态一律不装；demo 态保留（Angular 时代的媒体元数据兼容，属显式选择的演示实现）。
 */
export function installMediaDurationPatch() {
  if (mediaDurationPatched) return;
  mediaDurationPatched = true;
  if (!isDemoRuntime()) {
    markUnavailable('media.durationPatch', '真实业务态不伪造媒体原型（M2 验收：不全局伪造媒体原型）');
    return;
  }
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

/**
 * M2-1（调研 §C-22）：`fsModule` 的写族修前一律空实现——**数据静默丢弃**，调用方却收到
 * 类 Node 的「已写入」语义。electron 态下 `moduleRegistry.ts:73` 已透传真实 `fs`，故此面
 * 只在无原生 fs 的运行态生效。现在：真实业务态明确抛 {@link RuntimeCapabilityError}；
 * demo 态写入内存演示存储（`demoFileStore`，**不落盘**），读侧同源回读。
 */
function fsWriteCapability(op: string): boolean {
  const err = capabilityGap(
    `fs.${op}`,
    '浏览器无文件系统写能力：preload 仅暴露 fs:list/fs:read，写侧缺口需新增 fs:write IPC（调研 §E.4）',
  );
  if (err) throw err;
  return true; // demo 态：写入内存演示存储
}

export const fsModule = {
  F_OK: 0,
  R_OK: 4,
  W_OK: 2,
  X_OK: 1,
  existsSync(p) {
    const s = String(p || '').replace(/\\/g, '/');
    if (Object.prototype.hasOwnProperty.call(demoFileStore(), s)) return true;
    // M2-1（目标 3）：以下合成路径只属于**演示态**。修前它们无条件成立，于是
    // browser-connected（浏览器 + 真后端）里任何含 `Settings` 的路径都被判「存在」——
    // 与「未知能力返回成功」同源：调用方拿到肯定答复，真实文件却不在。
    if (isDemoRuntime()) {
      if (s.includes('/mock-library/')) return true;
      if (s.includes('Settings')) return true;
    }
    if (s.includes('/src/i18n/') && s.endsWith('.js')) return syncText(s) !== null;
    return false;
  },
  access(p, callback) {
    if (typeof callback === 'function') setTimeout(() => callback(null), 0);
  },
  accessSync() {},
  readFileSync(p, encoding) {
    const s = String(p || '').replace(/\\/g, '/');
    // M2-1：演示态写存储同源回读——写与读共用同一实例，演示链路自洽且不触及真实文件。
    if (Object.prototype.hasOwnProperty.call(demoFileStore(), s)) return demoFileStore()[s];
    // M2-1（目标 3）：以下合成内容同样是**演示态专属**。修前无条件返回硬编码标签/偏好，
    // browser-connected 下读 `tags.json` 会拿到演示标签并当作真实库数据——「未知能力返回成功」
    // 的读侧同款。真实业务态一律落到下面的真实读取路径（HTTP / 原生已截获的上游）。
    if (isDemoRuntime()) {
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
  writeFileSync(p, data) {
    fsWriteCapability('writeFileSync');
    demoFileStore()[String(p || '')] = typeof data === 'string' ? data : String(data);
  },
  writeFile(p, data, callback) {
    fsWriteCapability('writeFile');
    demoFileStore()[String(p || '')] = typeof data === 'string' ? data : String(data);
    const cb = arguments[arguments.length - 1];
    if (typeof cb === 'function') setTimeout(() => cb(null), 0);
  },
  readFile(p, encoding, callback) {
    if (typeof encoding === 'function') {
      callback = encoding;
      encoding = undefined;
    }
    if (typeof callback !== 'function') return;
    const s = String(p || '').replace(/\\/g, '/');
    if (Object.prototype.hasOwnProperty.call(demoFileStore(), s)) {
      setTimeout(() => callback(null, demoFileStore()[s]), 0);
      return;
    }
    // M2-1（目标 3）：与 `readFileSync` 同口径——合成内容只属演示态，真实业务态走下面的
    // 真实读取路径（失败即回调错误，不返回伪造内容）。
    if (isDemoRuntime()) {
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
  /**
   * M2-1（调研 §C-23）：修前返回固定假 stat——**对象永远「存在」且大小恒为 1**，存在性判断
   * 全部失真。真实业务态明确失败（无原生 fs 时不存在可信 stat 来源：preload 无 `fs:stat`）；
   * demo 态保留演示值。
   */
  statSync(p) {
    fsWriteCapability('statSync');
    return {
      isDirectory: () => false,
      isFile: () => true,
      isSymbolicLink: () => false,
      size: 1,
      mtimeMs: Date.now(),
    };
  },
  lstatSync(p) {
    return fsModule.statSync(p);
  },
  renameSync(from, to) {
    fsWriteCapability('renameSync');
    renameDemoEntry(from, to);
  },
  unlinkSync(p) {
    fsWriteCapability('unlinkSync');
    delete demoFileStore()[String(p || '')];
  },
  mkdirSync() {
    fsWriteCapability('mkdirSync');
  },
  rmSync(p) {
    fsWriteCapability('rmSync');
    delete demoFileStore()[String(p || '')];
  },
  removeSync(p) {
    fsModule.rmSync(p);
  },
  copyFileSync(from, to) {
    fsWriteCapability('copyFileSync');
    const store = demoFileStore();
    const key = String(from || '');
    if (Object.prototype.hasOwnProperty.call(store, key)) store[String(to || '')] = store[key];
  },
  createReadStream() {
    return { on() { return this; }, pipe() { return this; } };
  },
  createWriteStream() {
    return { on() { return this; }, end() {}, write() {} };
  },
};

/** 演示态内存存储的重命名（与 `fsModule.renameSync` 同源）。 */
function renameDemoEntry(from, to) {
  const store = demoFileStore();
  const source = String(from || '');
  if (Object.prototype.hasOwnProperty.call(store, source)) {
    store[String(to || '')] = store[source];
    delete store[source];
  }
}

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

/**
 * 未登记模块的明确失败错误（同时登记到运行期能力缺口表，供诊断面板/`capabilities.gaps` 查询）。
 *
 * 初版曾返回一个「取值即抛」的 Proxy 替身，实测证明不可用：抛点会落到消费者**没有**
 * try/catch 保护的属性读取上（如 `typeof w.junk.is`），直接把启动流程打断。见
 * {@link genericStub} 的说明。
 */
function unavailableModuleError(name, detail) {
  const capability = `require(${String(name || 'unknown')})`;
  const reason = String(detail || '该模块未登记真实实现，本运行态下不可用');
  markUnavailable(capability, reason);
  return new RuntimeCapabilityError(capability, reason);
}

/**
 * 未登记模块的兜底（`moduleRegistry.ts:36/56/128` 的唯一消费者）。
 *
 * **M2-1 行为变更**：修前无条件返回「调用即成功、返回自身、可无限链式」的假对象——调研 §C-1
 * 列为最严重的一条（electron 生产态同样生效）：任何查错的能力都表现为调用成功，错误永不冒泡。
 * 现在：
 *  - 真实业务态（`electron` / `browser-connected`）→ **调用即抛** `RuntimeCapabilityError`
 *    （见下方实测说明）；
 *  - demo 态 → 保留原可链式假对象（**显式选择的**演示实现，不再是默认行为）。
 */
export function genericStub(name, detail) {
  if (!isDemoRuntime()) {
    // M2-1：**调用期抛错**（而不是返回一个「取值即抛」的替身）。
    //
    // 这个区别是实测出来的，不是风格选择：`bundleGlobals.ts` 取 `require('junk')` 时写的是
    // `try { w.junk = req('junk') } catch { …内联真实兼容实现… }`——作者本来就把「模块取不到」
    // 当成**可预期失败**，并准备了真实回落。修前假替身让这个 catch 永不触发（`typeof
    // stub.is === 'function'` 恒真），于是走到的是「静默假成功」而不是作者写的真实实现。
    // 只有在 **require 调用本身**抛错时，该 catch 才会按设计生效。
    //
    // 若改成返回「取值才抛」的替身（初版写法），抛点会落在 `typeof w.junk.is` 这种**没有
    // try/catch 保护**的表达式上 → 整个 `installBundleGlobals()` 中断 → 主窗不渲染
    // （实测：`react-ipc-bridge-routing` grid boxes 超时、`react-stage-smoke` iframe 超时）。
    throw unavailableModuleError(name, detail);
  }
  const stub = function () { return stub; };
  stub.__mockName = String(name || 'module');
  ['forEach', 'map', 'filter', 'reduce', 'then', 'catch', 'finally', 'on', 'once', 'off'].forEach((key) => {
    if (!stub[key]) stub[key] = function () { return stub; };
  });
  return stub;
}

/**
 * M2-1（调研 §C-36）：修前在没有原生 fs 时静默改读 `window.__mockLibraryCache`——**磁盘与内存
 * 不一致时读的是旧缓存**且无从察觉。现在真实业务态若拿不到原生 fs，构造即抛
 * {@link RuntimeCapabilityError}；demo 态保留内存缓存读（显式选择的演示实现）。
 */
export const lineByLineMock = class LineByLineMock {
  constructor(filePath, options) {
    let lines = [];
    if (nativeFs) {
      try {
        lines = nativeFs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
      } catch (err) {
        lines = [];
      }
    } else if (!isDemoRuntime()) {
      throw new RuntimeCapabilityError(
        'LineByLine',
        '真实业务态无原生 fs，无法按行读取真实文件（修前静默改读 __mockLibraryCache，会读到陈旧内存态）',
      );
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

/**
 * M2-1（调研 §C-28）：修前 `start()` 恒 `Promise.resolve(this)`——**旧 REST 服务「启动成功」
 * 但根本没起**。真实业务态明确失败；demo 态保留演示语义。
 *
 * M2-2（回归修复）：失败**必须同步抛出**，不能返回 rejected Promise。
 * 两个真实调用点都对同步抛错有处置：`bundleGlobals._startAPIServer` 把 `start(cb)` 包在
 * try/catch 里、catch 体为 noop（bundle 18945-18968 逐字，作者本就把「起不来」当作可预期
 * 失败，另有 5s 后的 XHR 探活走 `electronLog.info('[app] API server start fail[1].')` +
 * `stopAPIServer()`）；`miscDomain` 的 power-resume 分支同样是 try/catch +
 * `electronLog.error`。而 rejected Promise 两个 catch 都接不住 → 成为 unhandled rejection，
 * 把「能力缺口」淹没成未捕获异常（实测：`continuous-grid-scroll` 的
 * `Runtime.exceptionThrown` 断言）。
 *
 * 失败语义本身不变：`capabilityGap` 仍登记 `JsonRestServer.start` 缺口（`capabilities.gaps`
 * 可查），且**成功回调照旧不触发**——不会退回「启动成功」的假象。修前那个 `Promise.resolve`
 * 之所以是假成功，正是因为它无条件调用了 callback。
 */
export class JsonRestServerStub {
  constructor(options) {
    this.options = options || {};
  }

  addAPI() {}
  addHandler() {}
  start(callback) {
    failCapability('JsonRestServer.start', '无本地 REST 服务实现（启动即「成功」但服务未起）');
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

// M2-1：`pluginModule` 是**无真实实现**的假门面（调研 §C-21/§E.7）——`preload.cjs` 只有
// `openPlugin`，没有安装/启用/列表能力，`main.cjs` 亦无对应 handler，故它在 electron 生产态
// 同样是假的（装了不显示、禁用无效、`checkPluginInstalled` 恒 false）。本批**不接线真实实现**
// （那需要改 `electron/preload.cjs`/`electron/main.cjs`，超出本 Worker 的文件所有权），
// 但必须**显式声明**不可用，使消费者/诊断面板能查 `capabilities.plugins === false`
// 而不是把 `checkPluginInstalled() === false` 当成「真的没装」。
pluginModule.__unavailable = true;
pluginModule.__unavailableReason = '插件系统无 preload/main IPC 实现（仅 openPlugin）；真实实现待 M2 后续批次';

if (!isDemoRuntime()) {
  markUnavailable('plugins.*', pluginModule.__unavailableReason);
  markUnavailable('require(archiver)', 'eaglepack 导出无真实实现：链式 no-op 永不产出 zip（调研 §C-34）');
  markUnavailable('require(fast-glob)', '批量导入扫描无真实实现：恒返回空列表（调研 §C-35）');
  markUnavailable('require(auto-launch)', '开机自启无真实实现：仅把偏好写回 settings（调研 §C-33）');
}
