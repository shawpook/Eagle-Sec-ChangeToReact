// @ts-nocheck
/**
 * R2 演示/浏览器开发态适配层：mock 库种子、浏览器导入（拖拽/上传/URL）、
 * 非媒体条目 meta 修补、重复检测转接、capture 轮询，以及**窗口生命周期驱动**
 * （emitMockLifecycle/startLifecycle —— 演示态发合成库事件；Electron 态由真实库事件承担数据）。
 *
 * 迁移自 `core/shimsLegacy.ts` 的 IIFE（原 9-464 mock 种子块 + 1085-1265、3009-3383 区间），
 * 函数体逐字保留。种子安装由 `installDemoLibrarySeed()` 承担，且**只在显式 demo 模式**执行
 * （原判据 `!window.eagleDesktop` → 现为 `resolveRuntimeMode() === "demo"`，语义等价）。
 * 计时器句柄提升为模块级，供 `disposeDemoTimers()` 释放。
 */
import { bodyScope, desktopApi, isElectronRuntime, resolutionMediaExtensions, resolveRuntimeMode } from "./environment";
import { pluginModule } from "./browserRuntime";
import { readSetting, settingsMemory } from "./settingsI18n";
import { ipcRenderer, mockEmit, writeState } from "./ipcBus";

let nonMediaMetaPatcherTimer: any = null;
let capturePollTimer: any = null;
let duplicateCheckerGuard: any = null;
let duplicateCheckerGuardTimer: any = null;

/** 释放本层创建的周期计时器（幂等；供安装期返回的 teardown 调用）。 */
export function disposeDemoTimers() {
  if (nonMediaMetaPatcherTimer) { clearInterval(nonMediaMetaPatcherTimer); nonMediaMetaPatcherTimer = null; }
  if (capturePollTimer) { clearInterval(capturePollTimer); capturePollTimer = null; }
  if (duplicateCheckerGuard) { clearInterval(duplicateCheckerGuard); duplicateCheckerGuard = null; }
  if (duplicateCheckerGuardTimer) { clearTimeout(duplicateCheckerGuardTimer); duplicateCheckerGuardTimer = null; }
}

/** 重复检测门面保鲜（原 IIFE 内 3067-3070 的守卫计时器，逐字迁入安装函数）。 */
export function installDuplicateCheckerGuard() {
  duplicateCheckerGuard = setInterval(() => {
    if (window.eagle && window.eagle.duplicateChecker && desktopApi && desktopApi.duplicates) patchDuplicateChecker();
  }, 100);
  duplicateCheckerGuardTimer = setTimeout(() => clearInterval(duplicateCheckerGuard), 8000);
}

/** 生命周期接线（原 IIFE 尾部 3371-3383 的 DCL 判定，逐字迁入安装函数）。 */
export function installLifecycleWiring() {
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
}
export function installDemoLibrarySeed() {
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
}

// 本地导入在飞计数。capture 轮询（startCapturePolling）以「库里出现了 known/cache/raw
// 都没有的条目」判定为外部捕获并补发 file-uploaded；而本地导入的条目在 invoke 回到
// renderer 之前正好是这个形态（后端已落库、cache 尚未合并）——轮询与导入 .then 抢跑就会把
// 同一 id 各发一次 file-uploaded，itemDomain 因此两次 unshift（实测抢跑差 50~250ms，
// m1 的 `* drop import inserted duplicate item IDs` 即此）。轮询在 await 之后据此整轮跳过，
// 条目落地后统一由 emitImportedItems 发布。

export async function browserUploadLocalFiles(files) {
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

export function browserImportLocalFiles(files, channel = 'upload-local-files') {
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

export async function browserImportUrl(params, channel = 'upload-url') {
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

export async function browserImportUrls(params, channel = 'upload-urls') {
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



export function installBrowserDropImport() {
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

export function installImportTransitionStyle() {
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

export function formatFileSize(bytes) {
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

export function patchNonMediaMeta() {
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

export function installNonMediaMetaPatcher() {
  if (!window.location.pathname.endsWith('/src/app/index.html')) return;
  const target = document.querySelector('#box-container .box-list') || document;
  const observer = new MutationObserver(patchNonMediaMeta);
  observer.observe(target, { childList: true, subtree: true });
  patchNonMediaMeta();
  // 兜底重扫：网格重建（resetNgGridLayoutData）期间若观察节点被替换/漏触发，meta 会停留在
  // “宽 × 高”。低频重扫（300ms）保证非媒体条目的 meta 最终收敛为文件大小。
  nonMediaMetaPatcherTimer = setInterval(patchNonMediaMeta, 300);
}

export async function pollDuplicateJob(jobId, cancelToken, onProgress, total) {
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

export function enrichDuplicateGroups(groups, sourceItems) {
  const mapping = new Map((sourceItems || []).map((item) => [item.id, item]));
  return (groups || []).map((group) => ({
    ...group,
    items: (group.items || []).map((entry) => mapping.get(entry.id) || entry),
  }));
}

export function patchDuplicateChecker() {
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

let capturePollStarted = false;
let capturePollLibraryPath = '';
export function startCapturePolling() {
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

export function emitMockLifecycle() {
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

export function startLifecycle() {
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
