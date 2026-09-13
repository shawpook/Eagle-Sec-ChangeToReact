// @ts-nocheck
// b1-9bz-E9（P5）：shims.js 全量迁入 React 模块图（frontend/public/shims.js 删除）。
// 语义零改动：整段 IIFE 原样执行（module eval 时序 = DCL 链，先于 onDidFinishLoad 驱动）。
// 每窗入口必须把本模块放在第一个 import（为后续 React 模块供给 window.require/process/
// Buffer/global/electron/electronSettings/i18n/EagleConfig/总线等启动契约）。
// b1-9bz-E9（P4-b）：mock 库种子（原 frontend/public/mock-data.js 全量）——浏览器开发态专用。
// Electron 态（preload 提供 eagleDesktop）零注入：真实库事件负责 __mockLibrary(Cache)，
// 种子在此只会被整体覆盖（行为等价、去掉无谓内存与捕获窗口）。
if (!(window as any).eagleDesktop) {
(function () {
  'use strict';

  const day = 86400000;
  const now = Date.now();

  const items = [
    {
      id: 'MOCK0001',
      name: 'Welcome Library',
      ext: 'png',
      width: 1536,
      height: 960,
      size: 50538,
      url: 'https://eagle.cool',
      website: 'eagle.cool',
      annotation: '原版欢迎页素材，用于主界面快速预览。',
      tags: ['UI', '欢迎', 'Eagle'],
      folders: ['FOLDER-ROOT', 'FOLDER-WELCOME'],
      star: 5,
      modificationTime: now - day,
      lastModified: now - day,
      palettes: [{ color: [26, 27, 30] }, { color: [255, 255, 255] }],
      noThumbnail: false,
      isDeleted: false,
    },
    {
      id: 'MOCK0002',
      name: 'Welcome Extension',
      ext: 'png',
      width: 1536,
      height: 960,
      size: 74499,
      url: 'https://eagle.cool/extensions',
      website: 'eagle.cool',
      annotation: '浏览器扩展引导素材。',
      tags: ['UI', '扩展', '引导'],
      folders: ['FOLDER-ROOT', 'FOLDER-WELCOME'],
      star: 4,
      modificationTime: now - 2 * day,
      lastModified: now - 2 * day,
      palettes: [{ color: [32, 34, 38] }, { color: [242, 243, 246] }],
      noThumbnail: false,
      isDeleted: false,
    },
    {
      id: 'MOCK0003',
      name: 'Welcome Hero',
      ext: 'png',
      width: 1920,
      height: 1080,
      size: 369087,
      url: 'https://eagle.cool',
      website: 'eagle.cool',
      annotation: 'Eagle 欢迎页首屏视觉。',
      tags: ['UI', '欢迎', 'Hero'],
      folders: ['FOLDER-ROOT', 'FOLDER-WELCOME'],
      star: 5,
      modificationTime: now - 3 * day,
      lastModified: now - 3 * day,
      palettes: [{ color: [15, 17, 22] }, { color: [126, 88, 255] }],
      noThumbnail: false,
      isDeleted: false,
    },
    {
      id: 'MOCK0004',
      name: 'Tutorial',
      ext: 'png',
      width: 1280,
      height: 720,
      size: 114819,
      url: 'https://docs-cn.eagle.cool',
      website: 'docs-cn.eagle.cool',
      annotation: '教程插图，可复用为收藏图。',
      tags: ['教程', '帮助', 'UI'],
      folders: ['FOLDER-ROOT', 'FOLDER-WELCOME'],
      star: 4,
      modificationTime: now - 4 * day,
      lastModified: now - 4 * day,
      palettes: [{ color: [245, 246, 248] }, { color: [88, 101, 242] }],
      noThumbnail: false,
      isDeleted: false,
    },
    {
      id: 'MOCK0005',
      name: 'Empty Folder',
      ext: 'png',
      width: 1280,
      height: 800,
      size: 73742,
      url: '',
      website: '',
      annotation: '空文件夹状态插画。',
      tags: ['空状态', '文件夹'],
      folders: ['FOLDER-ROOT', 'FOLDER-EMPTY'],
      star: 4,
      modificationTime: now - 5 * day,
      lastModified: now - 5 * day,
      palettes: [{ color: [250, 250, 252] }, { color: [166, 175, 191] }],
      noThumbnail: false,
      isDeleted: false,
    },
    {
      id: 'MOCK0006',
      name: 'Empty Library',
      ext: 'png',
      width: 1280,
      height: 800,
      size: 67036,
      url: '',
      website: '',
      annotation: '空资源库状态插画。',
      tags: ['空状态', '资源库'],
      folders: ['FOLDER-ROOT', 'FOLDER-EMPTY'],
      star: 3,
      modificationTime: now - 6 * day,
      lastModified: now - 6 * day,
      palettes: [{ color: [248, 249, 251] }, { color: [199, 204, 214] }],
      noThumbnail: false,
      isDeleted: false,
    },
    {
      id: 'MOCK0007',
      name: 'Empty Search',
      ext: 'png',
      width: 1280,
      height: 800,
      size: 55788,
      url: '',
      website: '',
      annotation: '空搜索结果状态。',
      tags: ['空状态', '搜索'],
      folders: ['FOLDER-ROOT', 'FOLDER-EMPTY'],
      star: 3,
      modificationTime: now - 7 * day,
      lastModified: now - 7 * day,
      palettes: [{ color: [249, 250, 251] }, { color: [150, 156, 168] }],
      noThumbnail: false,
      isDeleted: false,
    },
    {
      id: 'MOCK0008',
      name: 'Empty Trash',
      ext: 'png',
      width: 1280,
      height: 800,
      size: 100736,
      url: '',
      website: '',
      annotation: '回收站空状态插画。',
      tags: ['空状态', '回收站'],
      folders: ['FOLDER-ROOT', 'FOLDER-EMPTY'],
      star: 3,
      modificationTime: now - 8 * day,
      lastModified: now - 8 * day,
      palettes: [{ color: [248, 248, 250] }, { color: [180, 182, 192] }],
      noThumbnail: false,
      isDeleted: false,
    },
    {
      id: 'MOCK0009',
      name: 'AI SDK Intro',
      ext: 'png',
      width: 1600,
      height: 900,
      size: 412522,
      url: 'https://developer.eagle.cool',
      website: 'developer.eagle.cool',
      annotation: 'AI SDK 介绍图。',
      tags: ['插件', 'AI', '开发'],
      folders: ['FOLDER-ROOT', 'FOLDER-PLUGIN'],
      star: 5,
      modificationTime: now - 9 * day,
      lastModified: now - 9 * day,
      palettes: [{ color: [23, 27, 35] }, { color: [53, 143, 255] }],
      noThumbnail: false,
      isDeleted: false,
    },
    {
      id: 'MOCK0010',
      name: 'MCP Intro',
      ext: 'png',
      width: 1600,
      height: 900,
      size: 79779,
      url: 'https://developer.eagle.cool/plugin-api',
      website: 'developer.eagle.cool',
      annotation: 'MCP 插件介绍素材。',
      tags: ['插件', 'MCP', '开发'],
      folders: ['FOLDER-ROOT', 'FOLDER-PLUGIN'],
      star: 5,
      modificationTime: now - 10 * day,
      lastModified: now - 10 * day,
      palettes: [{ color: [250, 251, 253] }, { color: [73, 111, 255] }],
      noThumbnail: false,
      isDeleted: false,
    },
    {
      id: 'MOCK0011',
      name: 'Plugin Created',
      ext: 'png',
      width: 1280,
      height: 720,
      size: 7092,
      url: 'https://developer.eagle.cool',
      website: 'developer.eagle.cool',
      annotation: '插件创建完成提示图。',
      tags: ['插件', '创建'],
      folders: ['FOLDER-ROOT', 'FOLDER-PLUGIN'],
      star: 4,
      modificationTime: now - 11 * day,
      lastModified: now - 11 * day,
      palettes: [{ color: [255, 255, 255] }, { color: [255, 202, 66] }],
      noThumbnail: false,
      isDeleted: false,
    },
    {
      id: 'MOCK0012',
      name: 'Duplicate Merged',
      ext: 'png',
      width: 1280,
      height: 720,
      size: 22103,
      url: '',
      website: '',
      annotation: '重复文件合并示意图。',
      tags: ['重复文件', '工具'],
      folders: ['FOLDER-ROOT', 'FOLDER-PLUGIN'],
      star: 4,
      modificationTime: now - 12 * day,
      lastModified: now - 12 * day,
      palettes: [{ color: [244, 245, 248] }, { color: [51, 119, 255] }],
      noThumbnail: false,
      isDeleted: false,
    },
    {
      id: 'MOCK0013',
      name: 'Register Remain',
      ext: 'png',
      width: 800,
      height: 500,
      size: 11318,
      url: '',
      website: '',
      annotation: '注册/试用剩余天数插画。',
      tags: ['授权', '注册', 'UI'],
      folders: ['FOLDER-ROOT'],
      star: 2,
      modificationTime: now - 13 * day,
      lastModified: now - 13 * day,
      palettes: [{ color: [248, 249, 251] }, { color: [255, 214, 102] }],
      noThumbnail: false,
      isDeleted: false,
    },
    {
      id: 'MOCK0014',
      name: 'Register Expired',
      ext: 'png',
      width: 800,
      height: 500,
      size: 12809,
      url: '',
      website: '',
      annotation: '授权过期插画。',
      tags: ['授权', '注册', 'UI'],
      folders: ['FOLDER-ROOT'],
      star: 2,
      modificationTime: now - 14 * day,
      lastModified: now - 14 * day,
      palettes: [{ color: [255, 249, 249] }, { color: [255, 108, 108] }],
      noThumbnail: false,
      isDeleted: false,
    },
    {
      id: 'MOCK0015',
      name: 'Not Supported Format',
      ext: 'png',
      width: 800,
      height: 500,
      size: 6235,
      url: '',
      website: '',
      annotation: '不支持格式的提示插画。',
      tags: ['格式', '提示'],
      folders: ['FOLDER-ROOT', 'FOLDER-EMPTY'],
      star: 2,
      modificationTime: now - 15 * day,
      lastModified: now - 15 * day,
      palettes: [{ color: [255, 255, 255] }, { color: [150, 155, 165] }],
      noThumbnail: false,
      isDeleted: false,
    },
    {
      id: 'MOCK0016',
      name: 'Lock Screen',
      ext: 'png',
      width: 1280,
      height: 800,
      size: 108080,
      url: '',
      website: '',
      annotation: '锁定屏视觉素材。',
      tags: ['锁定', 'UI'],
      folders: ['FOLDER-ROOT', 'FOLDER-WELCOME'],
      star: 3,
      modificationTime: now - 16 * day,
      lastModified: now - 16 * day,
      palettes: [{ color: [28, 30, 35] }, { color: [255, 255, 255] }],
      noThumbnail: false,
      isDeleted: false,
    },
    {
      id: 'MOCK0017',
      name: 'Trashed Item',
      ext: 'png',
      width: 1280,
      height: 800,
      size: 100736,
      url: '',
      website: '',
      annotation: '已移入回收站的预览素材。',
      tags: ['回收站', '示例'],
      folders: [],
      star: 1,
      modificationTime: now - 17 * day,
      lastModified: now - 17 * day,
      palettes: [{ color: [248, 248, 250] }, { color: [190, 190, 195] }],
      noThumbnail: false,
      isDeleted: true,
    },
  ];

  const folders = [
    {
      id: 'FOLDER-ROOT',
      name: '设计参考',
      description: '从原版资源中整理的界面素材',
      children: [
        {
          id: 'FOLDER-WELCOME',
          name: '欢迎 / 引导',
          description: '欢迎页、教程与扩展引导',
          children: [],
          modificationTime: now - 4 * day,
          tags: ['UI', '欢迎'],
          icon: 'folder',
          iconColor: '#5B8DEF',
          coverId: 'MOCK0001',
          orderBy: 'IMPORT',
          sortIncrease: false,
        },
        {
          id: 'FOLDER-EMPTY',
          name: '空状态',
          description: '空资源库、空文件夹、空搜索等状态',
          children: [],
          modificationTime: now - 8 * day,
          tags: ['UI', '空状态'],
          icon: 'folder',
          iconColor: '#7B68EE',
          coverId: 'MOCK0005',
          orderBy: 'IMPORT',
          sortIncrease: false,
        },
        {
          id: 'FOLDER-PLUGIN',
          name: '插件 / 工具',
          description: '插件中心、AI 与重复文件工具素材',
          children: [],
          modificationTime: now - 12 * day,
          tags: ['插件', '工具'],
          icon: 'folder',
          iconColor: '#F2994A',
          coverId: 'MOCK0009',
          orderBy: 'IMPORT',
          sortIncrease: false,
        },
      ],
      modificationTime: now - 12 * day,
      tags: ['设计'],
      icon: 'folder',
      iconColor: '#5B8DEF',
      coverId: 'MOCK0001',
      orderBy: 'IMPORT',
      sortIncrease: false,
    },
  ];

  const smartFolders = [
    {
      id: 'SMART-STAR',
      name: '五星收藏',
      description: '自动收集评分为 5 的素材',
      icon: 'star',
      iconColor: '#F7B955',
      modificationTime: now - 3 * day,
      conditions: [{ field: 'star', operator: '=', value: 5 }],
      orderBy: 'IMPORT',
      sortIncrease: false,
      children: [],
    },
    {
      id: 'SMART-UI',
      name: 'UI 参考',
      description: '包含 UI 标签的素材',
      icon: 'grid',
      iconColor: '#7B68EE',
      modificationTime: now - 6 * day,
      conditions: [{ field: 'tags', operator: 'contains', value: 'UI' }],
      orderBy: 'IMPORT',
      sortIncrease: false,
      children: [],
    },
  ];

  const tagsGroups = [
    {
      id: 'TAGGROUP-DESIGN',
      name: '设计',
      tags: ['UI', '欢迎', '空状态', '插件', '工具'],
      color: '#5B8DEF',
      modificationTime: now - 2 * day,
    },
    {
      id: 'TAGGROUP-WORKFLOW',
      name: '流程',
      tags: ['注册', '授权', '回收站', '教程', '搜索'],
      color: '#F2994A',
      modificationTime: now - 5 * day,
    },
  ];

  const quickAccess = [
    { type: 'folder', id: 'FOLDER-ROOT' },
    { type: 'smartFolder', id: 'SMART-STAR' },
  ];

  const rootDir = '/mock-library/Eagle Reverse Demo.library';
  const imagesDir = '/mock-library/Eagle Reverse Demo.library/images/';

  window.__mockLibrary = {
    rootDir,
    imagesDir,
    libraryName: 'Eagle Reverse Demo',
    folders,
    smartFolders,
    quickAccess,
    tagsGroups,
    items,
  };

  window.__mockLibraryCache = items.slice();
})();

}

(function () {
  'use strict';

  // b1-9bz-E5-3：本窗 scope 面访问器——优先显式驱动面 window.__eagleDriver
  // （main.tsx 的 core/driverApi.ts 安装：数据 getter + 动作 + $evalAsync no-op），
  // 过渡期回落 window.$bodyScope（子窗/预览窗自有面）。E5-4 主窗别名退役后仍可工作。
  function bodyScope() {
    return window.__eagleDriver || window.$bodyScope || null;
  }

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
  const detailBitmapExtensions = new Set([
    'avif', 'bmp', 'heic', 'heif', 'hif', 'insp', 'jfif', 'jpe', 'jpeg', 'jpg', 'jxl',
    'png', 'svg', 'tif', 'tiff', 'webp',
  ]);
  const textThumbnailExtensions = new Set([
    'txt', 'md', 'markdown', 'log', 'rst', 'json', 'xml', 'yaml', 'yml', 'csv', 'tsv',
  ]);
  // Unified document workspace activation set: text/structured text, Office
  // Open XML, direct PDF, and legacy/OpenDocument formats the backend can
  // either read structurally or convert to a derived PDF. `.key/.numbers/
  // .pages/.xla/.xlam` are intentionally absent — the backend cannot convert
  // them, so routing them into the viewer would only degrade their preview.
  const resolutionMediaExtensions = new Set([
    'png', 'jpg', 'jpeg', 'jfif', 'jpe', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'heic',
    'heif', 'hif', 'avif', 'svg', 'psd', 'psdt', 'psb', 'ai', 'ait', 'raw', 'cr2',
    'cr3', 'crw', 'dng', 'raf', 'rw2', 'orf', 'nef', 'nrw', 'arw', '3fr', 'erf',
    'srw', 'sr2', 'pef', 'x3f', 'mrw', 'jxl', 'hdr', 'exr', 'ico', 'icns',
    'mp4', 'm4v', 'webm', 'mkv', 'avi', 'mov', 'mpg', 'mts', 'wmv', 'flv', 'ts',
    'f4v', '3gp', '360', 'afx', 'eva', 'vap',
  ]);
  // ── 详情原图交付门控已迁至 src/app/react/core/detailDeliveryGate.ts（P2，2026-09-14）──
  // 原实现以 25ms 轮询包装 scope 面/驱动面的 enterDetailMode/leaveDetailMode；实测 React UI 各入口
  // 直接调用 import 的 machineryEnterDetailMode（非同一函数对象）故门控在 UI 路径下不生效。
  // 现由 React 在 machineryEnterDetailMode/leaveDetailMode 内部直接挂钩（见该模块与计划文档 §0.1）。


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
  const emitIpc = ipcRenderer.emit.bind(ipcRenderer);
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
  const desktopSendChannels = new Set(['create-library', 'open-library', 'add-to-history-and-open']);

  // P1-c-2：共享写路径状态。主窗 React 启动期安装 window.__eagleIpcWriteState（唯一实例，
  // core/ipcWriteState.ts）；本文件所有消费方经 writeState() 取用同一实例（队列/计数器/发布器
  // 不得各留一套）。无 React 的窗口（viewer 等）惰性自建等价实例——窗内仍唯一，不产生跨窗分裂。
  function installLocalWriteStateFallback() {
    const fallback = { customThumbnailItemIds: new Set() };
    let writeChain = Promise.resolve();
    fallback.enqueueWrite = function (fn) {
      const run = writeChain.catch(() => undefined).then(fn);
      writeChain = run.catch(() => undefined);
      return run;
    };
    fallback.whenWriteQueueIdle = function () { return writeChain.catch(() => undefined); };
    let pendingLocalImports = 0;
    let settledLocalImports = 0;
    fallback.trackLocalImport = function (promise) {
      pendingLocalImports += 1;
      const settle = () => { pendingLocalImports -= 1; settledLocalImports += 1; };
      return promise.then(
        (value) => { settle(); return value; },
        (err) => { settle(); throw err; },
      );
    };
    fallback.importCounters = function () { return { pending: pendingLocalImports, settled: settledLocalImports }; };
    fallback.emitEvent = function (channel, payload) {
      if (ipcRenderer && typeof ipcRenderer.emit === 'function') ipcRenderer.emit(channel, payload);
    };
    fallback.mergeCachedItems = function (updatedItems) {
      const cached = window.__mockLibraryCache || [];
      const updates = Array.isArray(updatedItems) ? updatedItems : [updatedItems];
      updates.forEach((updated) => {
        if (!updated || !updated.id) return;
        const index = cached.findIndex((entry) => entry.id === updated.id);
        if (index >= 0) Object.assign(cached[index], updated);
        else cached.unshift(updated);
      });
      window.__mockLibraryCache = cached;
      return cached;
    };
    fallback.thumbnailTaskSnapshot = async function (taskId) {
      const d = desktopApi;
      if (d && d.thumbnail && typeof d.thumbnail.status === 'function') return d.thumbnail.status(taskId);
      const apiBase = (window.__EAGLE_API_BASE_URL || 'http://localhost:41695').replace(/\/$/, '');
      const response = await fetch(`${apiBase}/api/item/thumbnailTask/status?taskId=${encodeURIComponent(String(taskId || ''))}`);
      const payload = await response.json();
      if (!response.ok || !payload || payload.status !== 'success') throw new Error(payload && payload.message ? payload.message : 'Thumbnail status failed');
      return payload.data;
    };
    fallback.libraryItemsSnapshot = async function () {
      const d = desktopApi;
      if (d && d.library && typeof d.library.current === 'function') {
        const library = await d.library.current();
        return Array.isArray(library.items) ? library.items : [];
      }
      const apiBase = (window.__EAGLE_API_BASE_URL || 'http://localhost:41695').replace(/\/$/, '');
      const response = await fetch(`${apiBase}/api/library/current?includeItems=true`);
      const payload = await response.json();
      if (!response.ok || !payload || payload.status !== 'success') throw new Error(payload && payload.message ? payload.message : 'Library refresh failed');
      return Array.isArray(payload.data.items) ? payload.data.items : [];
    };
    fallback.refreshImportedThumbnails = async function (items) {
      const list = (Array.isArray(items) ? items : [items]).filter((item) => item && item.id);
      for (const item of list) {
        try {
          let complete = false;
          const deadline = Date.now() + 30000;
          while (Date.now() < deadline) {
            if (item.thumbnailTask) {
              const task = await fallback.thumbnailTaskSnapshot(item.thumbnailTask).catch(() => null);
              if (task && task.status === 'complete') { complete = true; break; }
              if (task && (task.status === 'failed' || task.status === 'cancelled' || task.error)) break;
            } else {
              const probeItems = await fallback.libraryItemsSnapshot();
              const probe = probeItems.find((entry) => entry && entry.id === item.id);
              if (probe && !probe.processingThumbnail && !probe.noThumbnail) { complete = true; break; }
            }
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
          if (!complete) continue;
          await fallback.whenWriteQueueIdle();
          const libraryItems = await fallback.libraryItemsSnapshot();
          const updated = libraryItems.find((entry) => entry && entry.id === item.id);
          if (updated && !updated.processingThumbnail) {
            if (!Number(updated.width) || !Number(updated.height)) {
              updated.width = Number(item.width) || 480;
              updated.height = Number(item.height) || 480;
            }
            fallback.mergeCachedItems(updated);
            fallback.emitEvent('thumbnail-generated', {
              id: updated.id, name: updated.name, ext: updated.ext,
              width: updated.width, height: updated.height,
              noThumbnail: updated.noThumbnail, processingThumbnail: false,
              modificationTime: updated.modificationTime,
            });
          }
        } catch (err) {
          console.warn('[eagle-shim] imported thumbnail refresh failed', err);
        }
      }
    };
    fallback.emitImportedItems = function (items, channel) {
      const imported = (Array.isArray(items) ? items : [items])
        .filter((item) => item && item.id)
        .map((item) => {
          if (!item.width && !item.height && textThumbnailExtensions.has(String(item.ext || '').toLowerCase())) {
            item.width = 480;
            item.height = 480;
          }
          return item;
        });
      fallback.mergeCachedItems(imported);
      imported.forEach((item) => fallback.emitEvent('file-uploaded', item));
      if (imported.length > 0) fallback.emitEvent('file-uploaded-end', {});
      fallback.emitEvent('import:operation-result', { ok: true, channel, items: imported });
      fallback.scheduleMissingPaletteAnalysis(imported);
      void fallback.refreshImportedThumbnails(imported);
      return imported;
    };
    function canAnalyzePalette(item) {
      return Boolean(item && item.id && !item.isDeleted && !item.noPreview && Number(item.width) > 0 && Number(item.height) > 0);
    }
    const paletteAnalysisRequests = new Map();
    fallback.analyzeItemPalette = function (item, options) {
      const force = Boolean(options && options.force);
      if (!canAnalyzePalette(item) || (!force && Array.isArray(item.palettes))) return Promise.resolve(item);
      if (paletteAnalysisRequests.has(item.id)) return paletteAnalysisRequests.get(item.id);
      item.processingPalette = true;
      fallback.mergeCachedItems(item);
      const apiBase = (window.__EAGLE_API_BASE_URL || 'http://localhost:41695').replace(/\/$/, '');
      const request = fetch(`${apiBase}/api/item/refreshPalette`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      })
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok || !result || result.status !== 'success') throw new Error(result && result.message ? result.message : 'Palette analysis failed');
          const updated = result.data && result.data.item ? result.data.item : result.data;
          if (updated && updated.id) {
            const belongsToCurrentLibrary = (window.__mockLibraryCache || []).some((entry) => entry && entry.id === updated.id);
            if (belongsToCurrentLibrary) {
              fallback.mergeCachedItems(updated);
              fallback.emitEvent('image.palette.updated', updated);
            }
            return updated;
          }
          return item;
        })
        .catch((err) => {
          delete item.processingPalette;
          const belongsToCurrentLibrary = (window.__mockLibraryCache || []).some((entry) => entry && entry.id === item.id);
          if (belongsToCurrentLibrary) fallback.mergeCachedItems(item);
          console.warn('[eagle-shim] palette analysis failed for ' + item.id, err);
          return item;
        })
        .finally(() => paletteAnalysisRequests.delete(item.id));
      paletteAnalysisRequests.set(item.id, request);
      return request;
    };
    fallback.scheduleMissingPaletteAnalysis = function (items) {
      const list = Array.isArray(items) ? items : [items];
      list.forEach((item) => {
        if (canAnalyzePalette(item) && !Array.isArray(item.palettes)) fallback.analyzeItemPalette(item);
      });
    };
    window.__eagleIpcWriteState = fallback;
  }
  function writeState() {
    const state = window.__eagleIpcWriteState;
    if (!state) installLocalWriteStateFallback();
    return window.__eagleIpcWriteState;
  }


  // 本地导入在飞计数。capture 轮询（startCapturePolling）以「库里出现了 known/cache/raw
  // 都没有的条目」判定为外部捕获并补发 file-uploaded；而本地导入的条目在 invoke 回到
  // renderer 之前正好是这个形态（后端已落库、cache 尚未合并）——轮询与导入 .then 抢跑就会把
  // 同一 id 各发一次 file-uploaded，itemDomain 因此两次 unshift（实测抢跑差 50~250ms，
  // m1 的 `* drop import inserted duplicate item IDs` 即此）。轮询在 await 之后据此整轮跳过，
  // 条目落地后统一由 emitImportedItems 发布。

  async function browserUploadLocalFiles(files) {
    const list = Array.isArray(files) ? files : [];
    if (list.length === 0) return [];
    const apiBase = (window.__EAGLE_API_BASE_URL || 'http://localhost:41695').replace(/\/$/, '');
    const blobFiles = list.filter((file) => file && typeof Blob !== 'undefined' && file instanceof Blob);
    const pathFiles = list.filter((file) => file && !(typeof Blob !== 'undefined' && file instanceof Blob) && typeof file.path === 'string' && file.path);
    const imported = [];

    for (const file of blobFiles) {
      const form = new FormData();
      form.append('file', file);
      const tags = Array.isArray(file.tags) ? file.tags.join(',') : file.tags;
      if (tags) form.append('tags', tags);
      if (file.annotation) form.append('annotation', file.annotation);
      if (Array.isArray(file.folders) && file.folders.length > 0) form.append('folderIDs', file.folders.join(','));
      const response = await fetch(`${apiBase}/api/item/upload`, { method: 'POST', body: form });
      const payload = await response.json();
      if (!response.ok || !payload || payload.status !== 'success') {
        throw new Error(payload && payload.message ? payload.message : `Upload failed: HTTP ${response.status}`);
      }
      imported.push(payload.data);
    }

    if (pathFiles.length > 0) {
      const response = await fetch(`${apiBase}/api/item/addFromPaths`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: pathFiles.map((file) => ({
            path: file.path,
            name: file.name,
            type: file.type,
            tags: Array.isArray(file.tags) ? file.tags : [],
            folders: Array.isArray(file.folders) ? file.folders : [],
            annotation: file.annotation || '',
          })),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload || payload.status !== 'success') {
        throw new Error(payload && payload.message ? payload.message : `Path import failed: HTTP ${response.status}`);
      }
      imported.push(...(Array.isArray(payload.data) ? payload.data : []));
    }
    return imported;
  }

  function browserImportLocalFiles(files, channel = 'upload-local-files') {
    return browserUploadLocalFiles(files)
      .then((items) => {
        writeState().emitImportedItems(items, channel);
        return items;
      })
      .catch((err) => {
        mockEmit('import:operation-result', { ok: false, channel, error: err.message });
        mockEmit('file-uploaded-end', { error: err.message });
        throw err;
      });
  }

  async function browserImportUrl(params, channel = 'upload-url') {
    const apiBase = (window.__EAGLE_API_BASE_URL || 'http://localhost:41695').replace(/\/$/, '');
    const response = await fetch(`${apiBase}/api/item/addFromURL`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {}),
    });
    const payload = await response.json();
    if (!response.ok || !payload || payload.status !== 'success') {
      throw new Error(payload && payload.message ? payload.message : `URL import failed: HTTP ${response.status}`);
    }
    writeState().emitImportedItems([payload.data], channel);
    return payload.data;
  }

  async function browserImportUrls(params, channel = 'upload-urls') {
    const list = Array.isArray(params)
      ? params
      : (params && (params.images || params.urls)) || [];
    if (list.length === 0) return [];
    const apiBase = (window.__EAGLE_API_BASE_URL || 'http://localhost:41695').replace(/\/$/, '');
    const response = await fetch(`${apiBase}/api/item/addFromURLs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: list.map((source) => typeof source === 'string' ? { url: source } : source),
      }),
    });
    const payload = await response.json();
    if (!response.ok || !payload || payload.status !== 'success') {
      throw new Error(payload && payload.message ? payload.message : `URL batch import failed: HTTP ${response.status}`);
    }
    writeState().emitImportedItems(payload.data, channel);
    return payload.data;
  }



  function installBrowserDropImport() {
    if (desktopApi || isElectronRuntime) return;
    if (!window.location.pathname.endsWith('/src/app/index.html')) return;
    document.addEventListener('drop', (event) => {
      const files = Array.from((event.dataTransfer && event.dataTransfer.files) || []);
      if (files.length === 0) return;
      const target = event.target;
      if (!target || typeof target.closest !== 'function' || !target.closest('#box-container')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      browserImportLocalFiles(files).catch(() => {});
    }, true);
  }

  function installImportTransitionStyle() {
    if (!window.location.pathname.endsWith('/src/app/index.html')) return;
    const style = document.createElement('style');
    style.textContent = `
      .box-list .box .thumbnail,
      .box-list .box .thumbnail img,
      .box-list .box .thumbnail video {
        transition: opacity 220ms ease !important;
      }
      .box-list .box.show .thumbnail img,
      .box-list .box.show .thumbnail video {
        animation: boxImgfadeIn 220ms ease forwards !important;
      }
    `;
    document.head.appendChild(style);
  }

  function formatFileSize(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let size = value;
    let unitIndex = -1;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size >= 100 ? Math.round(size) : size.toFixed(1)} ${units[unitIndex]}`;
  }

  function patchNonMediaMeta() {
    document.querySelectorAll('#box-container .box').forEach((box) => {
      // 单个 box 异常不得中断整轮（MutationObserver 回调抛出会漏掉后续 box）
      try {
        const extClass = Array.from(box.classList).find((name) => name.startsWith('ext-'));
        const ext = extClass ? extClass.slice(4).toLowerCase() : '';
        if (!ext || resolutionMediaExtensions.has(ext)) return;
        const meta = box.querySelector('.metas');
        if (!meta || !/^\d+\s*×\s*\d+$/.test(meta.textContent.trim())) return;
        const sizeElement = box.querySelector('.prop.size');
        const sizeText = sizeElement && sizeElement.textContent.trim();
        const itemId = box.getAttribute('data-box-id');
        const cached = (window.__mockLibraryCache || []).find((entry) => entry && entry.id === itemId);
        const scope = window.angular ? angular.element(document.body).scope() : null;
        const item = (scope && scope.itemMappings && scope.itemMappings[itemId]) || cached;
        meta.textContent = sizeText || formatFileSize(item && item.size);
      } catch (err) {
        console.warn('[eagle-shim] non-media meta patch failed', err);
      }
    });
  }

  function installNonMediaMetaPatcher() {
    if (!window.location.pathname.endsWith('/src/app/index.html')) return;
    const target = document.querySelector('#box-container .box-list') || document;
    const observer = new MutationObserver(patchNonMediaMeta);
    observer.observe(target, { childList: true, subtree: true });
    patchNonMediaMeta();
    // 兜底重扫：网格重建（resetNgGridLayoutData）期间若观察节点被替换/漏触发，meta 会停留在
    // “宽 × 高”。低频重扫（300ms）保证非媒体条目的 meta 最终收敛为文件大小。
    setInterval(patchNonMediaMeta, 300);
  }


  function previewCurrentItemId() {
    const scope = bodyScope();
    return scope && scope.current && scope.current.id ? scope.current.id : '';
  }

  function dragStartItemIds(params) {
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

  function runPreviewAction(action, promise) {
    Promise.resolve(promise)
      .then((result) => mockEmit('preview:action-result', { ok: true, action, ...(result || {}) }))
      .catch((err) => mockEmit('preview:action-result', { ok: false, action, error: err.message }));
  }

  function isCurrentPreviewRawPath(rawPath) {
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
  // b1-9bz-E7（P1-c-4）：回程扇出已迁 `core/returnBridge.ts`（React 入口安装并置
  // __eagleReturnBridgeInstalled）。shims 的注册体延迟到 0ms timer：deferred module（React 入口）
  // 在 DCL 链内先执行 → 检测到标记即跳过，保证单注册（无双发）；pre-seam 世界（无 React 入口的
  // 页面）timer 到点后照常注册，行为不变。
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

  const electron = {
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

  function writeFileAtomic(file, data, cb) {
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

  function localAssetUrl(value) {
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

  const urlModule = {
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

  const settingsMemory = {};
  const settingsPrefix = 'eagle.reverse.settings.';
  const preferencesSettingKey = 'preferences';
  const broadcastSettingKey = 'broadcast';
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

  function cloneValue(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function mergePreferenceValue(target, source) {
    if (source === undefined || source === null) return cloneValue(target);
    if (Array.isArray(target) || Array.isArray(source)) return cloneValue(source);
    if (typeof target !== 'object' || typeof source !== 'object') return cloneValue(source);
    const result = cloneValue(target) || {};
    for (const key of Object.keys(source)) {
      result[key] = mergePreferenceValue(result[key], source[key]);
    }
    return result;
  }

  function defaultPreferences() {
    const defaults = cloneValue(loadJsModule('/src/app/js/default-preferences.js')) || {};
    defaults.general = { ...(defaults.general || {}), language: 'zh_CN' };
    defaults.theme = { ...(defaults.theme || {}), name: 'DARK', css: 'dark' };
    return defaults;
  }

  let activePreferences = null;

  function replaceActivePreferences(next) {
    if (!activePreferences) {
      activePreferences = next;
      return activePreferences;
    }
    Object.keys(activePreferences).forEach((key) => delete activePreferences[key]);
    Object.assign(activePreferences, next);
    return activePreferences;
  }

  function currentPreferences(forceReload) {
    if (activePreferences && !forceReload) return activePreferences;
    if (forceReload) delete settingsMemory[preferencesSettingKey];
    const defaults = defaultPreferences();
    const saved = readSetting(preferencesSettingKey);
    return replaceActivePreferences(
      saved && typeof saved === 'object' ? mergePreferenceValue(defaults, saved) : defaults
    );
  }

  function savePreferences(value) {
    const merged = mergePreferenceValue(currentPreferences(), value || {});
    const next = replaceActivePreferences(merged);
    writeSetting(preferencesSettingKey, next);
    syncNativePreferences(next);
    return next;
  }

  function syncNativePreferences(preferences) {
    if (!nativeRequire) return;
    try {
      nativeRequire('electron').ipcRenderer.send('preferences:update', preferences);
    } catch (err) {
      // The native preferences bridge is optional in browser preview mode.
    }
  }

  function applyPreferencesToCurrentDocument() {
    delete settingsMemory[preferencesSettingKey];
    const preferences = currentPreferences(true);
    if (window.__eagleMockI18n) window.__eagleMockI18n.reload();
    mockEmit('update-preferences');
    if (preferences.theme && preferences.theme.name) mockEmit('change.current.theme', preferences.theme);
    if (preferences.general && preferences.general.zoom) mockEmit('change.zoom', preferences.general.zoom);
    if (preferences.general && typeof window.languageBCP !== 'undefined') {
      window.languageBCP = String(preferences.general.language || 'en').replace('_', '-');
    }
    // b1-9bz-E9：angular scope 同步分支删除（window.angular 在 React 世界恒缺席 → 死代码；
    // 哨兵 C-6 禁项 scope.$evalAsync）。事件扇出已覆盖全部 React 消费面。
  }

  function broadcastIpc(channel, params) {
    mockEmit(channel, params);
    try {
      localStorage.setItem(settingsPrefix + broadcastSettingKey, JSON.stringify({ channel, params, at: Date.now() }));
    } catch (err) {
      // Cross-window sync is best-effort; the current window already received the event.
    }
  }

  function handleSettingsStorage(event) {
    if (!event || !event.key) return;
    if (event.key === settingsPrefix + preferencesSettingKey) {
      applyPreferencesToCurrentDocument();
      return;
    }
    if (event.key === settingsPrefix + broadcastSettingKey) {
      try {
        const payload = JSON.parse(event.newValue || 'null');
        if (payload && payload.channel && Date.now() - payload.at < 5000) {
          mockEmit(payload.channel, payload.params);
        }
      } catch (err) {
        // Ignore malformed broadcast payloads.
      }
    }
  }

  const electronSettings = {
    getPreferences: currentPreferences,
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
    setSync(key, value) {
      writeSetting(key, value);
      if (key === preferencesSettingKey) {
        applyPreferencesToCurrentDocument();
        syncNativePreferences(currentPreferences());
      }
    },
    get(key) { return Promise.resolve(this.getSync(key)); },
    set(key, value) {
      this.setSync(key, value);
      return Promise.resolve(value);
    },
    has: (key) => readSetting(key) !== undefined,
    delete(key) {
      delete settingsMemory[key];
      try { localStorage.removeItem(settingsPrefix + key); } catch (err) {}
      if (key === preferencesSettingKey) activePreferences = null;
    },
    clear() {
      Object.keys(settingsMemory).forEach((key) => delete settingsMemory[key]);
      activePreferences = null;
    },
  };

  window.addEventListener('storage', handleSettingsStorage);

  class MockI18n {
    constructor() {
      this.locale = 'zh_CN';
      this.translations = this.load(this.locale);
      window.__eagleMockI18n = this;
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
    // 实机 QA（2026-09-13）：fs-extra 不可简单映射为 fs——扩展 API（moveSync/removeSync/
    // copySync/copy…）是渲染层多处功能（text-editor 保存、字体标签、图片备份/复制、插件
    // 安装、导出）的依赖；映射成 fs 后这些调用 TypeError 被异步回调吞掉（实测 txt 保存
    // 临时文件已写出但 moveSync 从未执行）。Electron 下优先取真实 fs-extra
    // （src/node_modules 可解析）；浏览器回退在 fs mock 上补齐用到的扩展方法。
    'fs-extra': (() => {
      if (nativeRequire) {
        try {
          const real = nativeRequire('fs-extra');
          if (real && typeof real.moveSync === 'function') return real;
        } catch (err) { /* fall through to fs-based facade */ }
      }
      const base = nativeFs || fsModule;
      if (!base || base.__eagleFseFacade) return base;
      const fse = Object.assign({}, base);
      fse.__eagleFseFacade = true;
      if (typeof fse.removeSync !== 'function') {
        fse.removeSync = (target) => base.rmSync ? base.rmSync(target, { recursive: true, force: true })
          : (base.rmdirSync ? base.rmdirSync(target, { recursive: true, force: true }) : undefined);
      }
      if (typeof fse.remove !== 'function') fse.remove = (target, cb) => { try { fse.removeSync(target); } catch (err) { /* 与 fs-extra 一致：异步版经 cb 报错 */ } cb && cb(); };
      if (typeof fse.copySync !== 'function') {
        fse.copySync = (src, dest, opts) => {
          const stat = base.statSync(src);
          if (stat.isDirectory()) {
            base.mkdirSync(dest, { recursive: true });
            for (const entry of base.readdirSync(src)) fse.copySync(base.join(src, entry), base.join(dest, entry), opts);
          } else {
            const { preserveTimestamps } = opts || {};
            base.copyFileSync(src, dest);
            if (preserveTimestamps) {
              base.utimesSync(dest, stat.atime, stat.mtime);
            }
          }
        };
      }
      if (typeof fse.copy !== 'function') fse.copy = (src, dest, opts, cb) => {
        const callback = typeof opts === 'function' ? opts : cb;
        try { fse.copySync(src, dest, typeof opts === 'function' ? undefined : opts); callback && callback(null); }
        catch (err) { callback && callback(err); }
      };
      if (typeof fse.moveSync !== 'function') {
        fse.moveSync = (src, dest, opts) => {
          try {
            base.renameSync(src, dest);
          } catch (err) {
            if (err && (err.code === 'EXDEV' || err.code === 'EPERM')) {
              fse.copySync(src, dest, opts);
              fse.removeSync(src);
            } else {
              throw err;
            }
          }
        };
      }
      if (typeof fse.ensureDirSync !== 'function') fse.ensureDirSync = (dir) => base.mkdirSync(dir, { recursive: true });
      if (typeof fse.ensureDir !== 'function') fse.ensureDir = (dir, cb) => { try { fse.ensureDirSync(dir); cb && cb(null); } catch (err) { cb && cb(err); } };
      return fse;
    })(),
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
        this._enabled = readSetting('autoLaunch') === true;
      }
      enable() {
        this._enabled = true;
        writeSetting('autoLaunch', true);
        return Promise.resolve();
      }
      disable() {
        this._enabled = false;
        writeSetting('autoLaunch', false);
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

  function loadOriginalModule(urlPath) {
    try {
      return loadJsModule(urlPath);
    } catch (err) {
      console.warn(`[eagle-shim] failed to load ${urlPath}`, err);
      return undefined;
    }
  }

  // 加载反编译目录中的真实拼音/简繁模块，保证原版快捷搜索的拼音与简繁路径可工作。
  const pinyinliteDict = loadOriginalModule('/src/my_modules/pinyinlite/src/dict_full.js');
  const pinyinliteFactory = loadOriginalModule('/src/my_modules/pinyinlite/src/pinyin.js');
  const pinyinlite = typeof pinyinliteFactory === 'function' && pinyinliteDict
    ? pinyinliteFactory(pinyinliteDict)
    : function pinyinliteFallback() { return []; };
  pinyinlite.searchAll = function searchAllFallback() { return []; };

  const tw2cnMap = loadOriginalModule('/src/my_modules/chinese_convert/tw2cn.js');
  const cn2twMap = loadOriginalModule('/src/my_modules/chinese_convert/cn2tw.js');
  function convertByMap(text, map) {
    if (typeof text !== 'string' || !map) return text || '';
    let result = '';
    for (const ch of text) result += map[ch] === undefined ? ch : map[ch];
    return result;
  }
  const chineseConvert = {
    charMap(ch, map) { return map && map[ch] !== undefined ? map[ch] : ch; },
    textMap(text, map) { return convertByMap(text, map); },
    cn2tw(text) { return convertByMap(text, cn2twMap); },
    tw2cn(text) { return convertByMap(text, tw2cnMap); },
    t2s(text) { return convertByMap(text, tw2cnMap); },
    s2t(text) { return convertByMap(text, cn2twMap); },
    convert(text, mode) {
      return mode === 's2t' || mode === 'cn2tw' ? convertByMap(text, cn2twMap) : convertByMap(text, tw2cnMap);
    },
  };

  const tinyPinyin = loadOriginalModule('/src/my_modules/tiny-pinyin/index.js') || {
    convertToPinyin: (text) => String(text || '').split('').join(''),
  };
  const cartesianProduct = loadOriginalModule('/src/my_modules/cartesian-product/index.js') || (() => []);

  bareModules['tiny-pinyin'] = tinyPinyin;
  bareModules['pinyinlite'] = pinyinlite;
  bareModules['chinese_convert'] = chineseConvert;
  bareModules['cartesian-product'] = cartesianProduct;
  window.tinyPinyin = window.tinyPinyin || tinyPinyin;
  window.pinyinlite = window.pinyinlite || pinyinlite;
  window.chineseConvert = window.chineseConvert || chineseConvert;

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
      if (req.endsWith('/my_modules/is-hidden-file')) return { check: () => false };
      if (req.endsWith('/my_modules/file-icon')) return { getFileIcon: () => Promise.resolve({}), getFileIconSync: () => null };
      if (req.endsWith('/my_modules/is-directory')) return {
        check: (target) => {
          if (!nativeFs) return false;
          try { return nativeFs.statSync(target).isDirectory(); } catch (err) { return false; }
        },
        checkSync: (target) => {
          if (!nativeFs) return false;
          try { return nativeFs.statSync(target).isDirectory(); } catch (err) { return false; }
        },
      };
      if (req.endsWith('/my_modules/access')) return { checkALCs: () => true, checkAccess: () => true, checkACL: () => true };
      if (req.endsWith('/app/js/utils/remainingFilenameLength.js')) return () => 240;
      if (req.endsWith('/app/js/utils/getBestURL.js')) return () => '';
      if (req.endsWith('/app/js/utils/is-accelerator.js')) return () => true;
      if (req.endsWith('/app/js/utils/unorm.js')) return { nfc: (s) => s, nfd: (s) => s };
      if (req.endsWith('/app/js/utils/flipImage.js')) return () => {};
      if (req.endsWith('/app/js/utils/rotateImage.js')) return () => {};
      if (req.endsWith('/my_modules/tiny-pinyin')) return bareModules['tiny-pinyin'];
      if (req.endsWith('/my_modules/pinyinlite')) return bareModules['pinyinlite'];
      if (req.endsWith('/my_modules/cartesian-product')) return bareModules['cartesian-product'];
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
  // b1-9at：mock 缩图临时目录仅浏览器预览态注入（Electron 运行时由 bundleGlobals
  // userData/eagle-temp 接管——原 '/mock-thumbnails' 无条件写入会掩盖真实值，
  // native-viewer 的 finalFile/轮询面全部错位）
  if (!isElectronRuntime) {
    window.global.EAGLE_THUMBNAIL_TEMP_PATH = '/mock-thumbnails';
  }
  window.require = require;
  window.__eagleRequire = require;
  window.electron = electron;
  // b1-9at：原 app 世界 window.ipcRenderer 直用面（native-viewer/text-editor viewer 的
  // parent.ipcRenderer）。nodeIntegration 不注入该全局（探针实证 undefined），供 shim 总线
  // （send 路由直通 + onIpc 桥回程）
  window.ipcRenderer = ipcRenderer;
  window.$$electronIpc = ipcRenderer;
  window.__eagleIpc = ipcRenderer;
  window.__eagleSyncText = syncText;
  window.electronSettings = electronSettings;
  if (nativeRequire) {
    setTimeout(() => syncNativePreferences(currentPreferences()), 250);
  }
  window.pluginModule = pluginModule;
  window.tinyPinyin = bareModules['tiny-pinyin'];
  window.pinyinlite = bareModules['pinyinlite'];

  const tinyPinyinGuard = setInterval(() => {
    if (!window.tinyPinyin || typeof window.tinyPinyin.convertToPinyin !== 'function') {
      window.tinyPinyin = bareModules['tiny-pinyin'];
    }
    if (typeof window.pinyinlite !== 'function') {
      window.pinyinlite = bareModules['pinyinlite'];
    }
  }, 50);
  setTimeout(() => clearInterval(tinyPinyinGuard), 6000);

  async function pollDuplicateJob(jobId, cancelToken, onProgress, total) {
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      if (cancelToken && typeof cancelToken.isCancelled === 'function' && cancelToken.isCancelled()) {
        if (desktopApi && desktopApi.duplicates) desktopApi.duplicates.cancel(jobId).catch(() => {});
        return { cancelled: true, groups: [] };
      }
      const job = await desktopApi.duplicates.status(jobId);
      if (job.status === 'complete') {
        if (typeof onProgress === 'function' && total > 0) onProgress(total, total);
        return job.result || { groups: [] };
      }
      if (job.status === 'error') throw new Error(job.message || 'Duplicate scan failed');
      if (job.status === 'cancelled') return { cancelled: true, groups: [] };
      if (typeof onProgress === 'function' && total > 0) {
        onProgress(Math.round((total * Number(job.progress || 0)) / 100), total);
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error('Duplicate scan timeout');
  }

  function enrichDuplicateGroups(groups, sourceItems) {
    const mapping = new Map((sourceItems || []).map((item) => [item.id, item]));
    return (groups || []).map((group) => ({
      ...group,
      items: (group.items || []).map((entry) => mapping.get(entry.id) || entry),
    }));
  }

  function patchDuplicateChecker() {
    if (!window.eagle) return;
    if (window.eagle.duplicateChecker && window.eagle.duplicateChecker.__shimmed) return;
    if (!desktopApi || !desktopApi.duplicates) return;
    window.eagle.duplicateChecker = {
      __shimmed: true,
      async findDuplicateFiles(items, cancelToken, options = {}) {
        const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
        const list = Array.isArray(items) ? items : [];
        const job = await desktopApi.duplicates.scan({
          method: 'same',
          ids: list.map((item) => item.id),
          async: true,
        });
        const result = await pollDuplicateJob(job.id, cancelToken, onProgress, list.length);
        if (result.cancelled) return { cancel: true, groups: [] };
        return { groups: enrichDuplicateGroups(result.groups, list) };
      },
      async findSimilarFiles(items, cancelToken, options = {}) {
        const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
        const list = Array.isArray(items) ? items : [];
        // 本轮只承诺 exact；similar 不返回伪造结果。
        if (typeof onProgress === 'function' && list.length > 0) onProgress(list.length, list.length);
        return { groups: [], fingerprintMap: {} };
      },
    };
  }

  const duplicateCheckerGuard = setInterval(() => {
    if (window.eagle && window.eagle.duplicateChecker && desktopApi && desktopApi.duplicates) patchDuplicateChecker();
  }, 100);
  setTimeout(() => clearInterval(duplicateCheckerGuard), 8000);

  let capturePollStarted = false;
  let capturePollLibraryPath = '';
  function startCapturePolling() {
    if (capturePollStarted || !desktopApi || !desktopApi.library || typeof desktopApi.library.current !== 'function') return;
    const pagePath = window.location.pathname || '';
    if (!pagePath.endsWith('/src/app/index.html')) return;
    capturePollStarted = true;
    const known = new Set();
    (window.__mockLibraryCache || []).forEach((item) => {
      if (item && item.id) known.add(item.id);
    });
    // b1-9bz-E7（main-ui-workflow 定位）：原守卫只覆盖「轮询 await 期间导入在飞」的窗口——
    // 两 tick 之间完成落定的导入（秒级小文件场景）会让轮询读到后端已有、cache/raw 尚未合并
    // 的条目 → 与导入路径的 emitImportedItems 双发 file-uploaded → itemDomain 两次 unshift →
    // scope.raw 重复 id。补「settled 跨 tick 变化即本轮回跳过」判定：凡有导入在本轮前后落定，
    // 该批条目均由导入路径独家发布。
    let lastSettledImports = writeState().importCounters().settled;
    const tick = async () => {
      try {
        const importCountersAtTick = writeState().importCounters();
        const importGeneration = importCountersAtTick.settled;
        const library = await desktopApi.library.current();
        // 本地导入在飞/本轮 await 期间刚落地：这批条目由 emitImportedItems 独家发布，
        // 轮询整轮跳过，否则同 id 双发（见 trackLocalImport 处注释）。
        const { pending: pendingImports, settled: settledImports } = writeState().importCounters();
        const importsSettledSinceLastTick = settledImports !== lastSettledImports;
        lastSettledImports = settledImports;
        if (pendingImports > 0 || settledImports !== importGeneration || importsSettledSinceLastTick) return;
        const items = Array.isArray(library.items) ? library.items : [];
        const nextPath = library.path || library.rootDir || '';
        if (capturePollLibraryPath && capturePollLibraryPath !== nextPath) known.clear();
        capturePollLibraryPath = nextPath;
        const cachedIds = new Set((window.__mockLibraryCache || []).map((item) => item && item.id).filter(Boolean));
        let rawIds = new Set();
        try {
          // 去 Angular 后 body scope 由 bodyScope() 承载（angular 缺席时原表达式恒 null，
          // 这道「已在列表里」的防线会整条失效）。
          const scope = window.angular ? angular.element(document.body).scope() : (bodyScope() || null);
          rawIds = new Set((scope && Array.isArray(scope.raw) ? scope.raw : []).map((item) => item && item.id).filter(Boolean));
        } catch (err) {
          // Ignore scope access failures; the cache check still protects against local imports.
        }
        const fresh = items.filter((item) => item && item.id && !known.has(item.id) && !cachedIds.has(item.id) && !rawIds.has(item.id));
        if (fresh.length > 0) {
          fresh.forEach((item) => known.add(item.id));
          writeState().emitImportedItems(fresh, 'browser-capture');
          mockEmit('library:changed', library);
        }
      } catch (err) {
        // Polling is best effort; the next lifecycle or user action will reload the library.
      }
    };
    setInterval(tick, 700);
  }

  function emitMockLifecycle() {
  window.__eagleEmitMockLifecycle = emitMockLifecycle;
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


    if (pagePath.includes('preview-window.html')) {
      if (desktopApi && desktopApi.preview) return;
      const query = new URLSearchParams(window.location.search);
      const id = query.get('id');
      const image = items.find((item) => item.id === id) || items[0];
      // 阶段9a：等 React entry 就绪标记（8e-2 同款 25ms 轮询，兜底 10s）；优先发 real-electron
      // 路径缓冲的载荷（__eaglePendingPreviewInit），否则 mock 载荷。
      const payload = {
        images: image ? [image] : [],
        imagesDir: lib.imagesDir,
        rootDir: lib.rootDir,
        machineID: 'preview',
        Registration: registration,
        pluginModule,
      };
      const retry = setInterval(() => {
        if (!window.__eaglePreviewEntryReady) return;
        clearInterval(retry);
        ipcRenderer.emit('init', window.__eaglePendingPreviewInit || payload);
      }, 25);
      setTimeout(() => clearInterval(retry), 10000);
      return;
    }

    if (pagePath.includes('collect-window')) {
      // 阶段9b-1：collect-window 已 React 化——等 entry 就绪标记 + controller folders 就绪后
      // 调 initFolderSelect()（原 Angular 分支轮询 isolateScope.listData 行为等价）。
      setTimeout(() => {
        const retry = setInterval(() => {
          try {
            if (!window.__eagleCollectEntryReady) return;
            const root = window.__eagleCollectController;
            if (!root) return;
            const panel = document.querySelector('folder-select-panel');
            if (!panel) return;
            const listData = (window.__eagleCollectFolderPanel || {}).listData;
            if (listData && Array.isArray(listData.items) && listData.items.length > 0) {
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

    // 阶段8e-2：偏好窗口已无 Angular——等 React 入口挂载（entry.tsx 设置就绪标记、
    // 'init' 监听器已注册）后发射 init（Registration/panel/keyword）。
    if (pagePath.includes('preferences.html')) {
      const query = new URLSearchParams(window.location.search);
      const waitPreferencesEntry = () => {
        // 只在 React 入口就绪后发射（盲发会丢失：无监听器时 emit 即消失）；
        // 冷启动 vite transform 可能超过 10s，不设盲发兜底
        if (window.__eaglePreferencesEntryReady) {
          ipcRenderer.emit('init', {
            Registration: registration,
            trialRemain: 0,
            machineID: 'preview',
            panel: query.get('panel') || '',
            keyword: query.get('keyword') || '',
          });
          return;
        }
        waitPreferencesEntry.attempts = (waitPreferencesEntry.attempts || 0) + 1;
        setTimeout(waitPreferencesEntry, 25);
      };
      waitPreferencesEntry();
      return;
    }

    if (!pagePath.endsWith('/index.html') && !pagePath.endsWith('/src/app/index.html')) {
      return;
    }

    // 固定延时发射存在竞态：页面 bootstrap 慢于 300ms 时 'initial' / 'app-status-loading'
    // 会在控制器注册监听器之前丢失（bundle 22664 的 'initial' 处理器内部才注册
    // app-status-loading 监听），导致 sanitize/tinyPinyin 等运行时 require 缺失。
    // 这里改为等待控制器就绪（bodyScope() 由 bootstrap 期间设置）后再按序发射。
    const emitAfterControllerReady = () => {
      ipcRenderer.emit('initial', {
        trialRemain: 0,
        machineID: 'preview',
        Registration: registration,
        errorMsg: '',
      });

      setTimeout(() => {
        ipcRenderer.emit('app-status-loading');
      }, 50);

      setTimeout(() => {
        ipcRenderer.emit('preload-library', {
          cachePath: `${lib.rootDir}/cache.json`,
        });
      }, 100);

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
      }, 150);
    };

    // 控制器就绪后才发射（bodyScope() 由 bootstrap 期间设置；兜底 10s 后照常发射）
    let emitAttempts = 0;
    const waitControllerReady = () => {
      emitAttempts += 1;
      if (bodyScope() || emitAttempts > 400) {
        emitAfterControllerReady();
        return;
      }
      setTimeout(waitControllerReady, 25);
    };
    waitControllerReady();
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
        window.__mockLibraryCache.forEach((item) => {
          if (item && item.customThumbnail) writeState().customThumbnailItemIds.add(item.id);
        });
        writeState().scheduleMissingPaletteAnalysis(window.__mockLibraryCache);
        const storedHistory = readSetting('libraryHistory');
        settingsMemory.libraryHistory = [library.path, ...(Array.isArray(storedHistory) ? storedHistory : [])].filter(Boolean).filter((value, index, array) => array.indexOf(value) === index);
        startCapturePolling();
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
    document.addEventListener('DOMContentLoaded', () => {
      installImportTransitionStyle();
      installBrowserDropImport();
      installNonMediaMetaPatcher();
      startLifecycle();
    }, { once: true });
  } else {
    installImportTransitionStyle();
    installBrowserDropImport();
    installNonMediaMetaPatcher();
    startLifecycle();
  }

  // b1-9bz-E9（P5）：index.html / preview-window.html / collect-window/index.html 解析期内联
  // boot 的等价复制（原依赖本 IIFE 已替换的 window.require mock 链：
  //   appRoot=require('app-root-path') → {path:'/src'}; i18n=new(require('/src/i18n'))=MockI18n;
  //   EagleConfig=require('/src/config.js')=loadJsModule CommonJS 包装）。
  // guard 化：inline 仍在的过渡期由 inline 先设（parse 早于 module eval），此处跳过；
  // inline 摘除后由本块供给。
  try {
    if (!window.appRoot) window.appRoot = require('app-root-path');
    if (!window.i18n) window.i18n = new (require(appRootModule.path + '/i18n'))();
    if (!window.EagleConfig) window.EagleConfig = require(appRootModule.path + '/config.js');
    // collect-window 内联 boot 的等价供给（原经 require('/src/my_modules/electron-settings')）
    if (!window.settings) window.settings = require(appRootModule.path + '/my_modules/electron-settings');
    if (!window.preferences) window.preferences = window.settings.getPreferences();
  } catch (err) {
    console.warn('[eagle-shim] legacy boot replication failed', err);
  }
})();
