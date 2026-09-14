// @ts-nocheck
/**
 * R2 环境层：窗口类判据 + 显式运行模式 + 原生桥探针。
 *
 * 迁移自 `core/shimsLegacy.ts` 的 IIFE 头部（原 469-517 区间）。语义零改动：
 * `nativeRequire` / `isElectronRuntime` / `nativeFs` / `nativePath` / `desktopApi`
 * 与三个扩展名集合逐字保留；新增的只有「显式运行模式」与「窗口类」两个**只读判据**，
 * 用于取代原先散落各处的 `!window.eagleDesktop` 判定。
 */

// b1-9bz-E5-3：本窗 scope 面访问器——优先显式驱动面 window.__eagleDriver
// （main.tsx 的 core/driverApi.ts 安装：数据 getter + 动作 + $evalAsync no-op），
// 过渡期回落 window.$bodyScope（子窗/预览窗自有面）。E5-4 主窗别名退役后仍可工作。
export function bodyScope() {
  return window.__eagleDriver || window.$bodyScope || null;
}

export const nativeRequire = typeof window.require === 'function' ? window.require : null;
export const isElectronRuntime =
  typeof process !== 'undefined' && process.versions && typeof process.versions.electron === 'string';
export let nativeFs = null;
export let nativePath = null;
if (isElectronRuntime && nativeRequire) {
  try {
    nativeFs = nativeRequire('node:fs');
    nativePath = nativeRequire('node:path');
  } catch (err) {
    console.warn('[eagle-shim] native filesystem bridge unavailable', err);
  }
}
export const desktopApi = window.eagleDesktop || null;
export const hasDesktopApi = Boolean(desktopApi);
/** 当前文档确实由 Electron 承载（preload 已暴露桌面桥）。 */
export const isElectronWindow = hasDesktopApi;

export const detailBitmapExtensions = new Set([
  'avif', 'bmp', 'heic', 'heif', 'hif', 'insp', 'jfif', 'jpe', 'jpeg', 'jpg', 'jxl',
  'png', 'svg', 'tif', 'tiff', 'webp',
]);
export const textThumbnailExtensions = new Set([
  'txt', 'md', 'markdown', 'log', 'rst', 'json', 'xml', 'yaml', 'yml', 'csv', 'tsv',
]);
// Unified document workspace activation set: text/structured text, Office
// Open XML, direct PDF, and legacy/OpenDocument formats the backend can
// either read structurally or convert to a derived PDF. `.key/.numbers/
// .pages/.xla/.xlam` are intentionally absent — the backend cannot convert
// them, so routing them into the viewer would only degrade their preview.
export const resolutionMediaExtensions = new Set([
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

/** 本窗类别（诊断/台账口径；R5 逐窗迁移后用于收敛各窗实际安装面）。 */
export type ShimWindowClass =
  | 'main' | 'preferences' | 'preview' | 'collect'
  | 'exif-viewer' | 'raw-viewer' | 'native-viewer' | 'gif-viewer'
  | 'text-editor' | 'font-viewer' | 'document-viewer' | 'unknown';

/** 显式运行模式：`electron` = 有桌面桥；`demo` = 浏览器预览/演示态。 */
export type ShimRuntimeMode = 'electron' | 'demo';

/**
 * R2：显式运行模式判定。原实现以散落的 `!window.eagleDesktop` 隐式判定「浏览器态」，
 * 现统一为单一入口：
 *  - `window.__EAGLE_SHIM_MODE`（`'electron'` | `'demo'`）显式标记优先——测试夹具/工具可强制；
 *  - 未标记时回落能力探测（有桌面桥即 electron）。
 * 与旧行为等价：未标记时 `!hasDesktopApi ⇒ demo`。
 */
export function resolveRuntimeMode(): ShimRuntimeMode {
  const explicit = (window as any).__EAGLE_SHIM_MODE;
  if (explicit === 'electron' || explicit === 'demo') return explicit;
  return hasDesktopApi ? 'electron' : 'demo';
}

/** 由当前 URL 判定本窗类别（与 demoSeed 中既有的 pathname 谓词同口径）。 */
export function resolveWindowClass(): ShimWindowClass {
  const p = window.location.pathname || '';
  if (p.includes('preferences.html')) return 'preferences';
  if (p.includes('preview-window.html')) return 'preview';
  if (p.includes('collect-window')) return 'collect';
  if (p.includes('document-viewer')) return 'document-viewer';
  if (p.includes('exif-viewer')) return 'exif-viewer';
  if (p.includes('raw-viewer')) return 'raw-viewer';
  if (p.includes('native-viewer')) return 'native-viewer';
  if (p.includes('gif-viewer')) return 'gif-viewer';
  if (p.includes('text-editor')) return 'text-editor';
  if (p.includes('font-viewer')) return 'font-viewer';
  if (p.endsWith('/src/app/index.html') || p.endsWith('/index.html')) return 'main';
  return 'unknown';
}
