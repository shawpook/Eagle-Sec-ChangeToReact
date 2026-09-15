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

/**
 * M2-1 显式运行模式（**三态**）：
 *  - `electron`          桌面应用进程内（preload 已暴露 `window.eagleDesktop`）。
 *  - `browser-connected` 普通浏览器打开页面但**指向真实 backend**（无桌面桥，能力经 HTTP）。
 *  - `demo`              浏览器预览/演示态，靠 `installDemoLibrarySeed()` 出数据。
 *
 * 三态化的动因（F07 调研 §B.2-3）：修前判据是 `!hasDesktopApi ⇒ demo`，于是「浏览器连真后端」
 * 与「浏览器无后端」走同一分支，真实库页面被灌 demo seed 冒充业务数据，UI 上无法区分。
 */
export type ShimRuntimeMode = 'electron' | 'browser-connected' | 'demo';

/** 合法模式值（显式标记的取值域；其余值视为未标记并告警）。 */
export const SHIM_RUNTIME_MODES: ReadonlyArray<ShimRuntimeMode> = ['electron', 'browser-connected', 'demo'];

/** 能力缺失错误的稳定标识（跨 realm/跨包判定用；`instanceof` 在 vm 隔离下不可靠）。 */
export const RUNTIME_CAPABILITY_ERROR_CODE = 'EAGLE_CAPABILITY_UNAVAILABLE';

/**
 * M2-1：**能力缺失即明确失败**的统一错误类型。
 *
 * 修前「未知能力返回成功」（调研 §C，37 条）把「没有实现」伪装成「调用成功」——查错的能力
 * 表现为静默 no-op，错误永不冒泡。凡本运行态下确无真实实现的能力，一律抛本错误，
 * 由调用方（或上层 UI）按失败处理，**不得**回落为空操作或可链式假对象。
 */
export class RuntimeCapabilityError extends Error {
  code: string;
  capability: string;
  detail: string;

  constructor(capability: string, detail?: string) {
    super(`[eagle-runtime] 能力不可用：${String(capability || 'unknown')}${detail ? ` —— ${detail}` : ''}`);
    this.name = 'RuntimeCapabilityError';
    this.code = RUNTIME_CAPABILITY_ERROR_CODE;
    this.capability = String(capability || 'unknown');
    this.detail = String(detail || '');
  }
}

/** 稳定的能力错误判定（不依赖 `instanceof`——vm/iframe 隔离下原型链不同）。 */
export function isRuntimeCapabilityError(err) {
  return Boolean(err) && err.name === 'RuntimeCapabilityError' && err.code === RUNTIME_CAPABILITY_ERROR_CODE;
}

/**
 * 显式不可用结果对象（任务书允许的第二种形态：抛错 **或** 返回带 unavailable 标记的结果）。
 * 仅用于**同步查询型**能力——返回值必须自带 `ok:false`/`unavailable:true`，
 * 使调用方无法把它当作成功结果继续推进。
 */
export function unavailableResult(capability, detail?) {
  return {
    ok: false,
    unavailable: true,
    capability: String(capability || 'unknown'),
    reason: String(detail || 'no implementation in current runtime'),
  };
}

/**
 * M2-1 显式运行模式判定（**同步**，单一入口）。
 *
 * 优先级：
 *  1. `window.__EAGLE_SHIM_MODE`（`'electron'` | `'browser-connected'` | `'demo'`）显式标记
 *     ——测试夹具/工具/启动器可强制；取值非法时告警并按探测回落。
 *  2. 有桌面桥 ⇒ `electron`。
 *  3. `window.__EAGLE_BROWSER_CONNECTED === true`（由 {@link probeRuntimeMode} 探测得出）
 *     ⇒ `browser-connected`。
 *  4. 否则 `demo`。
 *
 * 第 3 步之前（探测未完成）落在 `demo`——因此 **`install.ts` 不会在探测前安装演示种子**：
 * 见 `demoSeed.startLifecycle()`，它先 await 探测再决定是否发演示生命周期。
 */
export function resolveRuntimeMode(): ShimRuntimeMode {
  const explicit = window.__EAGLE_SHIM_MODE;
  if (SHIM_RUNTIME_MODES.indexOf(explicit) >= 0) return explicit;
  if (explicit !== undefined && explicit !== null && explicit !== '') {
    console.warn(`[eagle-shim] 未知 __EAGLE_SHIM_MODE=${String(explicit)}，按能力探测回落`);
  }
  if (hasDesktopApi) return 'electron';
  if (window.__EAGLE_BROWSER_CONNECTED === true) return 'browser-connected';
  return 'demo';
}

/** 是否处于演示态（**只有**此态允许注入模拟实现/写内存演示存储）。 */
export function isDemoRuntime(): boolean {
  return resolveRuntimeMode() === 'demo';
}

/** 是否处于真实业务态（electron 或 browser-connected）——此态下能力缺失必须明确失败。 */
export function isRealRuntime(): boolean {
  return resolveRuntimeMode() !== 'demo';
}

/** backend 的 `/api/library/current` 成功响应判据（探测真后端用，避免把任意 200 当后端）。 */
function isBackendLibraryPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.status === 'success') return true;
  return typeof payload.rootDir === 'string' || typeof payload.libraryName === 'string';
}

/**
 * M2-1：真实 backend 探测（**异步**，用于把「浏览器 + 真后端」与「浏览器 + 无后端」分开）。
 *
 * 判据不是「端口有人听」而是「`/api/library/current` 返回库描述」——dev server 占着同一端口时
 * 返回的是 HTML/404，必须落回 demo。任何失败（网络错、超时、非库响应）都落回 `demo`，
 * 因为浏览器无后端时的既有体验就是演示态。
 *
 * 成功时写 `window.__EAGLE_BROWSER_CONNECTED = true`，使后续同步 `resolveRuntimeMode()` 一致。
 */
export function probeRuntimeMode(timeoutMs = 1200): Promise<ShimRuntimeMode> {
  const sync = resolveRuntimeMode();
  // 已显式标记或已有桌面桥：无需探测，避免覆盖显式声明。
  if (sync === 'electron' || window.__EAGLE_SHIM_MODE) return Promise.resolve(sync);
  if (typeof fetch !== 'function') return Promise.resolve('demo');
  const apiBase = String(window.__EAGLE_API_BASE_URL || 'http://localhost:41695').replace(/\/$/, '');
  let timer = null;
  const abort = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      if (abort) {
        try { abort.abort(); } catch (err) { /* 已结束 */ }
      }
      resolve(null);
    }, timeoutMs);
  });
  const request = fetch(`${apiBase}/api/library/current`, abort ? { signal: abort.signal } : {})
    .then((response) => (response && response.ok ? response.json() : null))
    .catch(() => null);
  return Promise.race([request, timeout]).then((payload) => {
    if (timer) clearTimeout(timer);
    if (!isBackendLibraryPayload(payload)) return 'demo';
    window.__EAGLE_BROWSER_CONNECTED = true;
    return 'browser-connected';
  });
}

/**
 * 探测结果的**单例 Promise**：`install.ts`（是否落演示种子）与 `demoSeed.startLifecycle()`
 * （库数据从桌面桥 / backend / 演示种子哪来）必须看到**同一个**判定，否则「种子判定说 demo、
 * 生命周期判定说 browser-connected」这类自相矛盾会重现。首次调用即定型，后续调用复用。
 */
let runtimeModeProbe = null;

export function probeRuntimeModeOnce(timeoutMs = 1200): Promise<ShimRuntimeMode> {
  if (!runtimeModeProbe) runtimeModeProbe = probeRuntimeMode(timeoutMs);
  return runtimeModeProbe;
}

/** 释放探测单例（仅测试夹具使用：同一进程内需要重新判定时）。 */
export function resetRuntimeModeProbe(): void {
  runtimeModeProbe = null;
}

/**
 * **演示态专用**的内存写存储。
 *
 * M2 验收要求「demo 不写用户资源」：演示态的写落到本对象而非任何磁盘面，读侧
 * （`browserRuntime.fsModule.readFileSync`）同源回读，使演示链路自洽且不触及真实文件。
 * 置于环境层（最低层，无反向依赖），供 `browserRuntime`/`desktopCapability` 共用**同一实例**。
 */
export function demoFileStore(): Record<string, string> {
  if (!window.__mockWrittenFiles || typeof window.__mockWrittenFiles !== 'object') {
    window.__mockWrittenFiles = {};
  }
  return window.__mockWrittenFiles;
}

/**
 * M2-1：声明并返回「本运行态确无真实实现」的能力缺口。
 *
 * 真实业务态（`electron` / `browser-connected`）→ 返回 {@link RuntimeCapabilityError} 并登记；
 * demo 态 → 返回 `null`，表示调用方可以继续走**显式选择的**演示实现。
 * 集中一处判定，避免各 shim 模块各写一份 demo 判据（修前 40+ 个替身全都无条件生效）。
 */
export function capabilityGap(capability: string, detail?: string) {
  if (isDemoRuntime()) return null;
  const reason = String(detail || 'no implementation in current runtime');
  markUnavailable(capability, reason);
  return new RuntimeCapabilityError(capability, reason);
}

/** 同步面：真实态直接抛错；demo 态返回，由调用方继续走演示实现。 */
export function failCapability(capability: string, detail?: string): void {
  const err = capabilityGap(capability, detail);
  if (err) throw err;
}

/** Promise 面：真实态返回 rejected Promise；demo 态返回 resolved Promise。 */
export function rejectCapability(capability: string, detail?: string): Promise<never> | Promise<void> {
  const err = capabilityGap(capability, detail);
  if (err) return Promise.reject(err);
  return Promise.resolve();
}

/** 单次告警去重集合（同一能力在同一文档内只提示一次，避免刷屏）。 */
const warnedCapabilities = new Set<string>();

/**
 * 已声明缺口的**可观察降级**（真实态：登记 + 单次 `console.warn`，**不抛错**）。
 *
 * 用途限定：消费者是 fire-and-forget 的 UI 胶水（外链打开、复制到剪贴板、窗口显隐），
 * 真实修复需要改 `electron/preload.cjs` / `electron/main.cjs`——本批不可触碰。
 * 抛错会使这些调用点产生 unhandledrejection，反而把「能力缺失」淹没成噪声
 * （`tests/react-stage9a2-smoke.mjs:188` 明确断言零未捕获错误）。
 * 调用方应按 `RuntimeServices.capabilities.*` 门控入口（调研 §E.9 的对偶修复）。
 *
 * @returns 是否处于真实业务态（即该能力确实是缺口）
 */
export function warnCapability(capability: string, detail?: string): boolean {
  if (isDemoRuntime()) return false;
  const key = String(capability || 'unknown');
  markUnavailable(key, String(detail || 'no implementation in current runtime'));
  if (!warnedCapabilities.has(key)) {
    warnedCapabilities.add(key);
    console.warn(`[eagle-runtime] 能力不可用：${key} —— ${String(detail || '')}`);
  }
  return true;
}

/** 释放告警去重集合（仅测试夹具使用）。 */
export function resetCapabilityWarnings(): void {
  warnedCapabilities.clear();
}

/**
 * 当前运行态下**已确认不可用**的能力名登记（供 RuntimeServices 与诊断面板消费）。
 * 键为「能力路径」，值为不可用原因；消费者据此禁用入口而非静默 no-op（调研 §E.9）。
 */
export const unavailableCapabilities: Record<string, string> = {};

/** 登记一项不可用能力（幂等；同名重复登记保留首因）。 */
export function markUnavailable(capability: string, reason: string): void {
  const key = String(capability || 'unknown');
  if (!Object.prototype.hasOwnProperty.call(unavailableCapabilities, key)) {
    unavailableCapabilities[key] = String(reason || 'no implementation in current runtime');
  }
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
