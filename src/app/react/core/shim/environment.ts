/**
 * R2 环境层：窗口类判据 + 显式运行模式 + 原生桥探针。
 *
 * 迁移自 `core/shimsLegacy.ts` 的 IIFE 头部（原 469-517 区间）。语义零改动：
 * `nativeRequire` / `isElectronRuntime` / `nativeFs` / `nativePath` / `desktopApi`
 * 与三个扩展名集合逐字保留；新增的只有「显式运行模式」与「窗口类」两个**只读判据**，
 * 用于取代原先散落各处的 `!window.eagleDesktop` 判定。
 *
 * M2-3 类型化：本文件已撤销整文件 `// @ts-nocheck`。宿主装在 `window` 上的运行期扩展字段
 * 一律经 {@link hostWindow} 的**具名窄面** {@link ShimHostWindow} 读取（`global/globals.d.ts`
 * 只声明了其中一部分，且不属本批 ownership），本文件不新增 `any`、不放宽门禁。
 */

/**
 * 宿主窗口上的**运行期扩展面**（由 `electron/preload.cjs`、`frontend/public/shims.js`
 * 与测试 harness 装上）。
 *
 * 说明：这些字段在 `global/globals.d.ts` 里只声明了一部分（`$bodyScope` / `eagleDesktop`），
 * 其余（`require` / `__eagleDriver` / `__EAGLE_SHIM_MODE` / `__EAGLE_BROWSER_CONNECTED` /
 * `__mockWrittenFiles`）在全局声明里缺席。此处用**具名 interface** 声明本模块实际读写的字段，
 * 并统一经 {@link hostWindow} 取用——不借助 `any` 传播。
 */
interface ShimHostWindow {
  /** Electron 渲染层的裸 `require`（`moduleRegistry` 亦按同一全局取用）。 */
  require?: (id: string) => unknown;
  /** 跨边界驱动面（`core/driverApi.ts` 的 `installDriverApi()` 装配）。 */
  __eagleDriver?: unknown;
  /** 子窗/预览窗自有 scope 面（见 {@link bodyScope}）。 */
  $bodyScope?: unknown;
  /** 桌面桥（preload 暴露）。 */
  eagleDesktop?: unknown;
  /** 显式运行模式标记（测试夹具/启动器可强制；见 {@link resolveRuntimeMode}）。 */
  __EAGLE_SHIM_MODE?: unknown;
  /** 真后端探测结论（{@link probeRuntimeMode} 写入）。 */
  __EAGLE_BROWSER_CONNECTED?: unknown;
  /** 演示态内存写存储（见 {@link demoFileStore}）。 */
  __mockWrittenFiles?: unknown;
}

/** 宿主窗口视图（**纯类型窄化**，运行期即 `window` 本身，不做任何包装/代理）。 */
function hostWindow(): ShimHostWindow {
  return window as ShimHostWindow;
}

/**
 * 本窗 scope 面。
 *
 * 运行期形状由**驱动面**（`core/driverApi.ts` 的 `__eagleDriver`）或**子窗自有控制器**
 * （`preview-window/controller.ts`）供给，shim 层不持有其类型定义，故按**不透明面**处理：
 * 成员读取结果一律为 `unknown`，由调用方自行窄化。
 */
export type ShimScopeFace = Record<string, unknown>;

/** 真值即面——与修前 `window.__eagleDriver || window.$bodyScope || null` 的 `||` 链**逐字同义**。 */
function truthyScopeFace(value: unknown): ShimScopeFace | null {
  return value ? (value as ShimScopeFace) : null;
}

/**
 * b1-9bz-E5-3：本窗 scope 面访问器——优先显式驱动面 `window.__eagleDriver`
 * （main.tsx 的 `core/driverApi.ts` 安装：数据 getter + 动作 + `$evalAsync` no-op），
 * 过渡期回落 `window.$bodyScope`（子窗/预览窗自有面）。E5-4 主窗别名退役后仍可工作。
 *
 * ── F01 取证结论（M2-3，2026-09-16）：**`$bodyScope` 后备保留，不删** ──
 * 全仓取证（`grep -rn '\$bodyScope'`，2026-09-16）显示该后备**仍有活消费者**，删除即回归：
 *  1. **测试 harness 写入方**：`tests/react-cdp-harness.mjs:230` 用 `Object.defineProperty`
 *     把 `$bodyScope` 装成惰性访问器（Proxy → `__eagleScopeRegistry`）；同 harness 的探针面
 *     `window.__eagleProbe` 与它同源。52 个既有套件经 `window.$bodyScope` 观测（见
 *     `docs/plan-2026-09-15-full-workspace-legacy-audit.md:348`、F25）。
 *  2. **子窗/预览窗写入方**：`src/app/react/preview-window/controller.ts:2394`
 *     `window.$bodyScope = scope`（本窗 controllerScope；gif-viewer iframe 与 detailHooks 的既有通道）。
 *  3. **演示态写入方**：`src/app/react/core/shim/demoSeed.ts:864` 为 font/text/gif viewer 页
 *     造 `window.$bodyScope` mock 面。
 *  4. **同为回落后备的兄弟路径**：`core/scopeFace.ts:78`、`core/lazyLoadManager.ts:407,489`、
 *     `viewers/shared/parentChannel.ts:32`、`viewers/text-editor/entry.tsx:231,333`、
 *     `frontend/public/vendor/eagle-match-rules.js:57` 都写着同一条
 *     `__eagleDriver || $bodyScope` 链——只删本处不会减少任何契约，只会让本模块与它们不一致。
 * **移除以何为先决条件**：任务书 M4 的验收项「不依赖 harness 补 `$bodyScope` 也能完成用户操作」
 * 达成（harness 注入退役 + 子窗/演示态写入方各自改走 `__eagleDriver`）之后，本后备才可删。
 * 在此之前保留，且本节即删除前提的登记处。
 */
export function bodyScope(): ShimScopeFace | null {
  const host = hostWindow();
  return truthyScopeFace(host.__eagleDriver) || truthyScopeFace(host.$bodyScope);
}

export type NativeRequireFn = (id: string) => unknown;

const hostRequire = hostWindow().require;
export const nativeRequire: NativeRequireFn | null = typeof hostRequire === 'function' ? hostRequire : null;

/**
 * 是否运行在 Electron 进程内（读全局 `process` 的 `versions.electron`）。
 *
 * 类型注记：`process` 由 `global/globals.d.ts` 声明为 `any`，该表达式的取值域为
 * `true | false | undefined`（仅当 `process` 存在而 `process.versions` 缺席时为 `undefined`）；
 * 它在**全部现有消费点**都是布尔上下文（`if (isElectronRuntime && …)`）。此处只补类型标注、
 * 不改表达式，故不引入 `Boolean()` 归一以免改变取值。
 */
export const isElectronRuntime: boolean =
  typeof process !== 'undefined' && process.versions && typeof process.versions.electron === 'string';
export let nativeFs: unknown = null;
export let nativePath: unknown = null;
if (isElectronRuntime && nativeRequire) {
  try {
    nativeFs = nativeRequire('node:fs');
    nativePath = nativeRequire('node:path');
  } catch (err) {
    console.warn('[eagle-shim] native filesystem bridge unavailable', err);
  }
}

/**
 * 桌面桥的**本模块实际消费面**（只声明 shim 层调用到的成员，不做全量镜像）。
 *
 * `global/globals.d.ts` 把 `window.eagleDesktop` 声明为 `any`；此处用具名 interface 取代
 * `any` 传播。`library.setHistory` 的契约来自 `electron/preload.cjs:82`
 * （`(history) => ipcRenderer.invoke('library:set-history', history)`，恒返回 Promise）。
 */
export interface DesktopLibraryFace {
  setHistory(history: unknown): Promise<unknown>;
}

export interface DesktopBridgeFace {
  readonly library?: DesktopLibraryFace | null;
}

const hostDesktopBridge = hostWindow().eagleDesktop;
export const desktopApi: DesktopBridgeFace | null = hostDesktopBridge
  ? (hostDesktopBridge as DesktopBridgeFace)
  : null;
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

/**
 * 任意值的**具名成员读取**（运行期形状未知时的唯一读口，返回值仍是 `unknown`）。
 *
 * 这是本模块唯一的「动态形状」窄化点：与修前的裸属性访问同义
 * （`null`/`undefined` 返回 `undefined`，原始值取成员亦为 `undefined`），
 * 只是把读到的值留在 `unknown` 上，迫使调用方显式判定。
 */
function readMember(value: unknown, key: string): unknown {
  if (value === null || value === undefined) return undefined;
  return (value as Record<string, unknown>)[key];
}

/** 稳定的能力错误判定（不依赖 `instanceof`——vm/iframe 隔离下原型链不同）。 */
export function isRuntimeCapabilityError(err: unknown): boolean {
  // 判据逐字保留修前的 `Boolean(err) && err.name === … && err.code === …`（短路顺序亦相同）。
  return Boolean(err)
    && readMember(err, 'name') === 'RuntimeCapabilityError'
    && readMember(err, 'code') === RUNTIME_CAPABILITY_ERROR_CODE;
}

/** 显式不可用结果（任务书允许的第二种形态：抛错 **或** 返回带 unavailable 标记的结果）。 */
export interface UnavailableResult {
  ok: false;
  unavailable: true;
  capability: string;
  reason: string;
}

/**
 * 仅用于**同步查询型**能力——返回值必须自带 `ok:false`/`unavailable:true`，
 * 使调用方无法把它当作成功结果继续推进。
 */
export function unavailableResult(capability: string, detail?: string): UnavailableResult {
  return {
    ok: false,
    unavailable: true,
    capability: String(capability || 'unknown'),
    reason: String(detail || 'no implementation in current runtime'),
  };
}

/** 合法模式值判定（对 {@link SHIM_RUNTIME_MODES} 做同源成员测试）。 */
function isShimRuntimeMode(value: unknown): value is ShimRuntimeMode {
  return SHIM_RUNTIME_MODES.some((mode) => mode === value);
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
  const explicit = hostWindow().__EAGLE_SHIM_MODE;
  if (isShimRuntimeMode(explicit)) return explicit;
  if (explicit !== undefined && explicit !== null && explicit !== '') {
    console.warn(`[eagle-shim] 未知 __EAGLE_SHIM_MODE=${String(explicit)}，按能力探测回落`);
  }
  if (hasDesktopApi) return 'electron';
  if (hostWindow().__EAGLE_BROWSER_CONNECTED === true) return 'browser-connected';
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
function isBackendLibraryPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  if (readMember(payload, 'status') === 'success') return true;
  return typeof readMember(payload, 'rootDir') === 'string' || typeof readMember(payload, 'libraryName') === 'string';
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
  const host = hostWindow();
  const sync = resolveRuntimeMode();
  // 已显式标记或已有桌面桥：无需探测，避免覆盖显式声明。
  if (sync === 'electron' || host.__EAGLE_SHIM_MODE) return Promise.resolve(sync);
  if (typeof fetch !== 'function') return Promise.resolve('demo');
  const apiBase = String(window.__EAGLE_API_BASE_URL || 'http://localhost:41695').replace(/\/$/, '');
  let timer: ReturnType<typeof setTimeout> | null = null;
  const abort = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      if (abort) {
        try { abort.abort(); } catch (err) { /* 已结束 */ }
      }
      resolve(null);
    }, timeoutMs);
  });
  const request: Promise<unknown> = fetch(
    `${apiBase}/api/library/current`,
    abort ? { signal: abort.signal } : {},
  )
    .then((response) => (response && response.ok ? response.json() : null))
    .catch(() => null);
  return Promise.race([request, timeout]).then((payload) => {
    if (timer) clearTimeout(timer);
    if (!isBackendLibraryPayload(payload)) return 'demo';
    host.__EAGLE_BROWSER_CONNECTED = true;
    return 'browser-connected';
  });
}

/**
 * 探测结果的**单例 Promise**：`install.ts`（是否落演示种子）与 `demoSeed.startLifecycle()`
 * （库数据从桌面桥 / backend / 演示种子哪来）必须看到**同一个**判定，否则「种子判定说 demo、
 * 生命周期判定说 browser-connected」这类自相矛盾会重现。首次调用即定型，后续调用复用。
 */
let runtimeModeProbe: Promise<ShimRuntimeMode> | null = null;

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
  const host = hostWindow();
  const existing = host.__mockWrittenFiles;
  if (!existing || typeof existing !== 'object') {
    host.__mockWrittenFiles = {};
  }
  // 上一行保证该槽位此时是对象；此断言只做类型窄化，不产生任何运行期转换。
  return host.__mockWrittenFiles as Record<string, string>;
}

/**
 * M2-1：声明并返回「本运行态确无真实实现」的能力缺口。
 *
 * 真实业务态（`electron` / `browser-connected`）→ 返回 {@link RuntimeCapabilityError} 并登记；
 * demo 态 → 返回 `null`，表示调用方可以继续走**显式选择的**演示实现。
 * 集中一处判定，避免各 shim 模块各写一份 demo 判据（修前 40+ 个替身全都无条件生效）。
 */
export function capabilityGap(capability: string, detail?: string): RuntimeCapabilityError | null {
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
