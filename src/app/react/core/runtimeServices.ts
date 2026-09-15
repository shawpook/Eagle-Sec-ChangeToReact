/**
 * M2-1：**有限的 RuntimeServices**——运行时能力的唯一装配点与唯一契约面。
 *
 * ## 为什么需要它
 *
 * M2 之前，React 侧访问「运行时能力」（文件系统、剪贴板、外链、窗口显隐、插件、库数据）
 * 没有统一入口：代码直接摸 `window.electron` / `window.eagleDesktop` / `window.require`，
 * 拿不到时各模块**各写一份替身**并让调用**当成功返回**（F07 调研 §C 共 37 条）。
 * 于是「能力缺失」在类型上、在返回值上、在日志上都不可见。
 *
 * 本模块把这条边收成**一个**有限集合：8 个服务（调研 §E 骨架），每个服务只做**转发与门控**，
 * 不复制任何业务实现——Electron 态一律指向**已有的** `electron/preload.cjs` 桥与
 * `src/app/react/core/shim/*` 真实现。
 *
 * ## 能力位语义（消费者必须按此理解，调研 §E.9）
 *
 * `RuntimeCapabilities` 里 `true` 表示「**RuntimeServices 在本运行态下确实供给**该能力，
 * 调用必有真实实现」；`false` 表示「**本服务不供给**」——调用方必须**禁用入口并给出原因**
 * （原因取自 {@link RuntimeCapabilities.gaps}），或者改走 `gaps` 里指明的其它路径。
 *
 * 因此 `false` **不等于**「功能一定不存在」：例如 `imageOps.rotate` 恒为 `false`，
 * 是因为图像变换走 backend HTTP（`backend/src/server.js` 的 `/api/item/imageTransform`），
 * 不经本服务——`gaps` 里会这么写。把口径钉死在这里，才不会重演
 * 「门口写着可用、进去是空操作」的老问题。
 *
 * ## 三态（调研 §B.2）
 *
 * {@link RuntimeKind} 有且只有三态：`electron`（桌面桥在）/ `browser-connected`
 * （浏览器但**连着真后端**）/ `demo`（浏览器且**无后端**，唯一允许注入模拟实现）。
 * 修前判据是 `!hasDesktopApi ⇒ demo`，于是「浏览器连真后端」被当作演示态灌入 `demoSeed`
 * 的假库数据。三态判定集中在 `shim/environment.resolveRuntimeMode()`，本模块只消费它。
 *
 * ## 本文件不属于 shim 层
 *
 * shim 层 8 个模块带 `@ts-nocheck`（本批不撤销，见任务书铁律 4）。本文件位于
 * `core/` 顶层，**不带** `@ts-nocheck`、**不使用** `any`/`@ts-ignore`，因此它自身受
 * `tests/typecheck.mjs` 的零诊断门禁约束。上层新代码应当依赖本模块的类型面，
 * 而不是继续直接摸 shim 全局。
 */

import {
  RuntimeCapabilityError,
  capabilityGap,
  demoFileStore,
  failCapability,
  isRuntimeCapabilityError,
  markUnavailable,
  nativeFs,
  resolveRuntimeMode,
  resolveWindowClass,
  unavailableCapabilities,
  warnCapability,
} from "./shim/environment";
import type { ShimRuntimeMode, ShimWindowClass } from "./shim/environment";
import { fsModule, pluginModule } from "./shim/browserRuntime";
import { currentWindow, dialog, electron, nativeElectronExport, writeFileAtomic } from "./shim/desktopCapability";
import { ipcRenderer } from "./shim/ipcBus";
import { loadLibraryFromBackend } from "./shim/demoSeed";
import {
  currentPreferences,
  electronSettings,
  savePreferences,
  syncNativePreferences,
} from "./shim/settingsI18n";

// ─────────────────────────────────────────────────────────────────────────────
// 运行态与能力位
// ─────────────────────────────────────────────────────────────────────────────

/** 运行态三态（与 `shim/environment` 的 `ShimRuntimeMode` 同源，此处仅为上层提供稳定别名）。 */
export type RuntimeKind = ShimRuntimeMode;

/** 本窗类别（诊断口径；用于判断某个服务在本窗是否应当存在）。 */
export type RuntimeWindowClass = ShimWindowClass;

/**
 * 能力位（调研 §E.9 形状 + 本批实测结论）。
 *
 * 各字段的 `false` 均可由 {@link RuntimeCapabilities.gaps} 查到原因字符串；`gaps` 同时
 * 汇总 shim 层各模块在运行期登记的缺口（`environment.unavailableCapabilities`）。
 */
export interface RuntimeCapabilities {
  /** 当前运行态。 */
  kind: RuntimeKind;
  /** 库数据读写面。`write` 指「能改动真实库数据」，不指演示态的内存写。 */
  fs: {
    /** 能读真实文件。 */
    read: boolean;
    /** 能写真实库数据（`library.updateStructure` 面）。演示态恒 `false`。 */
    write: boolean;
    /** 写只落内存演示存储、不触及任何用户资源（**仅 demo 态为 true**）。 */
    memoryOnly: boolean;
  };
  /** 外链/打开/定位文件（`shell.*`）。 */
  shell: { external: boolean; path: boolean; reveal: boolean };
  /** 剪贴板。 */
  clipboard: { readText: boolean; writeText: boolean; writeImage: boolean };
  /** 窗口。`visibility` 指显隐/聚焦，`lifecycle` 指最小化/最大化/关闭等生命周期动作。 */
  window: { visibility: boolean; lifecycle: boolean };
  /** 插件系统可管理（列表/安装/启停）。注意：仅「打开插件窗口」不算。 */
  plugins: boolean;
  /** 图像变换（旋转/翻转/裁剪）。 */
  imageOps: { rotate: boolean; flip: boolean; crop: boolean };
  /** 媒体派生任务（缩略图/重复检测/导入/下载/导出）的**桌面桥**供给。 */
  mediaTasks: {
    thumbnail: boolean;
    duplicates: boolean;
    import: boolean;
    download: boolean;
    export: boolean;
  };
  /** 每个 `false` 能力位的原因；键为能力路径，值为原因。 */
  gaps: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 本模块消费的桌面桥形状（局部声明；`global/globals.d.ts` 不在本批 ownership 内）
// ─────────────────────────────────────────────────────────────────────────────

/** 只声明本模块探测/调用到的那部分 `window.eagleDesktop`。 */
interface DesktopBridge {
  library?: {
    current?: () => unknown;
    updateStructure?: (...args: unknown[]) => unknown;
  };
  dialog?: {
    open?: (...args: unknown[]) => unknown;
    save?: (...args: unknown[]) => unknown;
  };
  shell?: {
    openExternal?: (...args: unknown[]) => unknown;
    openPath?: (...args: unknown[]) => unknown;
    showItemInFolder?: (...args: unknown[]) => unknown;
  };
  clipboard?: {
    read?: (...args: unknown[]) => unknown;
    readSync?: (...args: unknown[]) => unknown;
    writeText?: (...args: unknown[]) => unknown;
    writeImage?: (...args: unknown[]) => unknown;
  };
  window?: {
    hide?: (...args: unknown[]) => unknown;
    show?: (...args: unknown[]) => unknown;
    focus?: (...args: unknown[]) => unknown;
    blur?: (...args: unknown[]) => unknown;
    minimize?: (...args: unknown[]) => unknown;
    maximize?: (...args: unknown[]) => unknown;
    close?: (...args: unknown[]) => unknown;
    isMaximized?: (...args: unknown[]) => unknown;
    isFullScreen?: (...args: unknown[]) => unknown;
  };
  plugins?: unknown;
  openPlugin?: (...args: unknown[]) => unknown;
  thumbnail?: unknown;
  nativeThumbnail?: unknown;
  duplicates?: unknown;
  import?: unknown;
  importPaths?: unknown;
  download?: unknown;
  export?: unknown;
}

/**
 * 本模块读写的窗口标志（`global/globals.d.ts` 由并行 Worker 拥有，不在此处扩增声明）。
 * 一律经 {@link runtimeWindow} 单点转换，避免 `window as any` 散落。
 */
interface RuntimeFlagsWindow {
  __EAGLE_SHIM_MODE?: unknown;
  __EAGLE_BROWSER_CONNECTED?: unknown;
  __EAGLE_RUNTIME_KIND?: unknown;
  __eagleRuntimeServices?: unknown;
  __mockWrittenFiles?: unknown;
  __mockLibrary?: unknown;
  eagleDesktop?: unknown;
}

function runtimeWindow(): RuntimeFlagsWindow {
  return window as unknown as RuntimeFlagsWindow;
}

/** 取桌面桥（仅当确实存在对象时）；无桥返回 `null`——不构造空壳代理。 */
function desktopBridge(): DesktopBridge | null {
  const raw: unknown = runtimeWindow().eagleDesktop;
  if (!raw || typeof raw !== "object") return null;
  return raw as DesktopBridge;
}

/** 某持有者上是否存在可调用的方法（能力位探测的唯一原语）。 */
function hasMethod(holder: unknown, key: string): boolean {
  if (!holder || typeof holder !== "object") return false;
  return typeof (holder as Record<string, unknown>)[key] === "function";
}

// ─────────────────────────────────────────────────────────────────────────────
// 能力描述
// ─────────────────────────────────────────────────────────────────────────────

/** 汇总当前已登记的缺口（副本；调用方不得改写登记表本身）。 */
function collectGaps(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(unavailableCapabilities)) out[key] = unavailableCapabilities[key];
  return out;
}

/**
 * 探测当前运行态的能力位（**纯读取**，不产生副作用、不安装任何替身）。
 *
 * 判定来源一律是「真实实现在不在」，不猜、不兜底：探测不到即 `false` 并留原因。
 */
export function describeCapabilities(): RuntimeCapabilities {
  const kind = resolveRuntimeMode();
  const demo = kind === "demo";
  const bridge = desktopBridge();
  const library = bridge ? bridge.library : undefined;
  const win = bridge ? bridge.window : undefined;
  const clip = bridge ? bridge.clipboard : undefined;
  const shell = bridge ? bridge.shell : undefined;

  const native = Boolean(nativeFs);
  // 渲染层真模块探针（`sandbox:false` + `nodeIntegration:true`）：探到即算真能力。
  // 关键：**消费者 `require('electron')` 拿到的是 shim 替身**（`moduleRegistry.ts:136`），
  // 所以「替身里没有」不等于「渲染层没有」——两个来源都要看，否则会声明出不存在的缺口。
  const nativeShell = nativeElectronExport("shell");
  const nativeClipboard = nativeElectronExport("clipboard");
  // 库结构写是桌面桥独有的真实写能力；浏览器连真后端时后端**不暴露**该写面
  // （`electron/preload.cjs` 的 `library.updateStructure` 是唯一入口）。
  const canWriteLibrary = hasMethod(library, "updateStructure");

  const caps: RuntimeCapabilities = {
    kind,
    fs: {
      // electron 走原生 fs；browser-connected 走 backend 的文件/HTTP 面；demo 走内存演示存储。
      read: native || kind === "browser-connected" || demo,
      write: canWriteLibrary,
      memoryOnly: demo,
    },
    shell: {
      external: hasMethod(shell, "openExternal") || hasMethod(nativeShell, "openExternal"),
      path: hasMethod(shell, "openPath") || hasMethod(nativeShell, "openPath"),
      reveal: hasMethod(shell, "showItemInFolder") || hasMethod(nativeShell, "showItemInFolder"),
    },
    clipboard: {
      readText:
        hasMethod(clip, "readSync") || hasMethod(clip, "read") || hasMethod(nativeClipboard, "readText"),
      writeText: hasMethod(clip, "writeText") || hasMethod(nativeClipboard, "writeText"),
      writeImage: hasMethod(clip, "writeImage") || hasMethod(nativeClipboard, "writeImage"),
    },
    window: {
      // 调研 §E.5：`hide/show/focus/blur` 在 preload 与 main 的 window:action 中均无实现。
      visibility:
        hasMethod(win, "hide") && hasMethod(win, "show") && hasMethod(win, "focus"),
      lifecycle: hasMethod(win, "minimize") && hasMethod(win, "close"),
    },
    // 插件「管理」（列表/安装/启停）无任何 IPC——preload 只有 `openPlugin`（开窗，
    // 不是管理）。故恒 `false` 且原因写明；`openPlugin` 由 PluginsService.open 单独供给。
    plugins: hasMethod(bridge, "plugins"),
    // RuntimeServices 不供给图像变换；真实路径是 backend `/api/item/imageTransform`
    // （`backend/src/image-transform-service.js`），调用方直接走 HTTP。四条恒 `false`。
    imageOps: { rotate: false, flip: false, crop: false },
    mediaTasks: {
      thumbnail: isRealKind(kind) && (hasMethod(bridge, "nativeThumbnail") || hasMethod(bridge, "thumbnail")),
      duplicates: isRealKind(kind) && hasMethod(bridge, "duplicates"),
      import: isRealKind(kind) && (hasMethod(bridge, "import") || hasMethod(bridge, "importPaths")),
      download: isRealKind(kind) && hasMethod(bridge, "download"),
      export: isRealKind(kind) && hasMethod(bridge, "export"),
    },
    gaps: {},
  };

  for (const [path, enabled] of [
    ["fs.write", caps.fs.write],
    ["shell.external", caps.shell.external],
    ["shell.path", caps.shell.path],
    ["shell.reveal", caps.shell.reveal],
    ["clipboard.readText", caps.clipboard.readText],
    ["clipboard.writeText", caps.clipboard.writeText],
    ["clipboard.writeImage", caps.clipboard.writeImage],
    ["window.visibility", caps.window.visibility],
    ["window.lifecycle", caps.window.lifecycle],
    ["plugins", caps.plugins],
    ["imageOps.rotate", caps.imageOps.rotate],
    ["mediaTasks.thumbnail", caps.mediaTasks.thumbnail],
    ["mediaTasks.duplicates", caps.mediaTasks.duplicates],
    ["mediaTasks.import", caps.mediaTasks.import],
    ["mediaTasks.download", caps.mediaTasks.download],
    ["mediaTasks.export", caps.mediaTasks.export],
  ] as ReadonlyArray<readonly [string, boolean]>) {
    if (!enabled) caps.gaps[path] = CAPABILITY_REASONS[path] || "本运行态无真实实现";
  }

  // 运行期登记（shim 层各模块 markUnavailable 的结论）覆盖/补充静态原因。
  const runtimeGaps = collectGaps();
  for (const key of Object.keys(runtimeGaps)) caps.gaps[key] = runtimeGaps[key];

  return caps;
}

function isRealKind(kind: RuntimeKind): boolean {
  return kind !== "demo";
}

/** 静态原因文案（运行期 `markUnavailable` 的结果会覆盖同名键）。 */
const CAPABILITY_REASONS: Record<string, string> = {
  "fs.write":
    "无通用写能力：preload 仅暴露 fs:list/fs:read，写侧缺口需新增 fs:write IPC（调研 §E.4）",
  "shell.external":
    "preload/main 均无 shell 面，且渲染层 require('electron') 未导出 shell（shell 为主进程模块）",
  "shell.path": "同 shell.external：无 shell 面可达",
  "shell.reveal": "preload 的 item.reveal 未接线此面，渲染层亦无 shell 模块",
  "clipboard.readText": "非 electron 态无桌面剪贴板读取面",
  "clipboard.writeText":
    "preload 无剪贴板写能力（仅有 read/readSync/import），且渲染层 require('electron') 未导出 clipboard",
  "clipboard.writeImage":
    "preload 无剪贴板写能力（仅有 read/readSync/import），且渲染层 require('electron') 未导出 clipboard",
  "window.visibility": "窗口显隐无 preload/main 实现（调研 §E.5：需补 window:action case）",
  "window.lifecycle": "本运行态无窗口生命周期桥",
  plugins: "插件列表/安装/启停无 IPC（仅 openPlugin 开窗）；需改 electron/** 接线",
  "imageOps.rotate": "图像变换走 backend `/api/item/imageTransform`，不经 RuntimeServices",
  "imageOps.flip": "图像变换走 backend `/api/item/imageTransform`，不经 RuntimeServices",
  "imageOps.crop": "图像变换走 backend `/api/item/imageTransform`，不经 RuntimeServices",
  "mediaTasks.thumbnail": "缩略图任务需桌面桥或 backend 任务队列，不经 RuntimeServices",
  "mediaTasks.duplicates": "重复检测无桌面桥供给",
  "mediaTasks.import": "导入无桌面桥供给",
  "mediaTasks.download": "下载无桌面桥供给",
  "mediaTasks.export": "导出无桌面桥供给",
};

// ─────────────────────────────────────────────────────────────────────────────
// 服务契约（8 个）
// ─────────────────────────────────────────────────────────────────────────────

/** ① 运行环境：模式/窗口类/能力位/缺口登记。**无依赖**，所有服务都依赖它。 */
export interface RuntimeEnvService {
  readonly kind: RuntimeKind;
  readonly windowClass: RuntimeWindowClass;
  readonly isDemo: boolean;
  readonly capabilities: RuntimeCapabilities;
  /** 声明并返回缺口错误；demo 态返回 `null`（调用方可继续走显式演示实现）。 */
  gap(capability: string, detail?: string): RuntimeCapabilityError | null;
  /** 同步面：真实态抛 {@link RuntimeCapabilityError}，demo 态返回。 */
  fail(capability: string, detail?: string): void;
  /** 已声明缺口的可观察降级（登记 + 单次告警，不抛错）。返回是否确为缺口。 */
  warn(capability: string, detail?: string): boolean;
  /** 登记一项缺口（幂等）。 */
  markUnavailable(capability: string, reason: string): void;
}

/** ② 设置/偏好：转发 `shim/settingsI18n`。 */
export interface RuntimeSettingsService {
  getSync(key: string): unknown;
  get(key: string): Promise<unknown>;
  setSync(key: string, value: unknown): void;
  set(key: string, value: unknown): Promise<unknown>;
  has(key: string): boolean;
  remove(key: string): void;
  /** 当前生效偏好（跨窗同步后的值）。 */
  preferences(): unknown;
  /** 保存偏好并同步原生设置与当前文档。 */
  save(next: unknown): void;
  syncNative(): void;
}

/** 库快照（`__mockLibrary` 槽位的规范化视图）。 */
export interface RuntimeLibrarySnapshot {
  rootDir: string;
  libraryName: string;
  imagesDir?: string;
  items: unknown[];
  raw: unknown;
}

/** ③ 库：三态各自的库数据来源，**共用**已有的 `demoSeed` 装载路径（不重复实现）。 */
export interface RuntimeLibraryService {
  /** 当前库快照的**来源**：桌面桥 / backend / 演示种子。 */
  source(kind: RuntimeKind): "desktop-bridge" | "backend" | "demo-seed";
  /** 已装载的库快照（未装载为 `null`）。 */
  snapshot(): RuntimeLibrarySnapshot | null;
  /** 拉取/重载库快照。真实态取不到时**明确失败**，不回落演示数据。 */
  reload(): Promise<RuntimeLibrarySnapshot>;
}

/** ④ 存储：库数据 JSON 的读写。 */
export interface RuntimeStorageService {
  /** 能否写真实库数据（等价 `capabilities.fs.write`）。 */
  readonly writable: boolean;
  /** 读 JSON（读不到返回 `null`，不伪造空对象）。 */
  readJson(path: string): unknown;
  /** 原子写 JSON；真实态无写能力时 reject `RuntimeCapabilityError`。 */
  writeJson(path: string, data: unknown): Promise<void>;
  /** 演示态内存写存储的只读引用（非 demo 态为空对象，写入不会落到这里）。 */
  demoStore(): Record<string, string>;
}

/** ⑤ 窗口：转发 `shim/desktopCapability` 的窗口面。 */
export interface RuntimeWindowService {
  readonly current: typeof currentWindow;
  /** 窗口状态下读（最大化/全屏）。 */
  state(): { maximized: boolean; fullScreen: boolean };
}

/** ⑥ IPC：转发 `shim/ipcBus` 的单一总线（**不得**另建第二条路由）。 */
export interface RuntimeIpcService {
  send(channel: string, params?: unknown): void;
  sendTo(windowId: unknown, channel: string, params?: unknown): void;
  invoke(channel: string, params?: unknown): Promise<unknown>;
  on(channel: string, callback: (...args: unknown[]) => void): void;
  once(channel: string, callback: (...args: unknown[]) => void): void;
  off(channel: string, callback: (...args: unknown[]) => void): void;
}

/** ⑦ 插件：插件模块单例 + 打开插件窗口。 */
export interface RuntimePluginsService {
  /** 插件模块单例（`window.pluginModule` 同源）。 */
  readonly module: typeof pluginModule;
  /** 打开插件窗口；无桥时明确失败。 */
  open(id: string, params?: unknown): Promise<unknown>;
  /** 插件管理面是否可用（列表/安装/启停）。 */
  readonly manageable: boolean;
}

/** ⑧ 媒体任务：缩略图/重复/导入/下载/导出的**桥**供给。 */
export interface RuntimeMediaTasksService {
  /** 桌面桥对象（无桥为 `null`）；有桥时任务本身由 main/backend 承担。 */
  readonly bridge: unknown;
  readonly available: RuntimeCapabilities["mediaTasks"];
}

/** 装配结果：8 个服务 + 能力位 + 依赖关系表。 */
export interface RuntimeServices {
  readonly env: RuntimeEnvService;
  readonly settings: RuntimeSettingsService;
  readonly library: RuntimeLibraryService;
  readonly storage: RuntimeStorageService;
  readonly window: RuntimeWindowService;
  readonly ipc: RuntimeIpcService;
  readonly plugins: RuntimePluginsService;
  readonly mediaTasks: RuntimeMediaTasksService;
  /** 本实例的能力位（{@link RuntimeServices} 创建时定型，与 `env.kind` 一致）。 */
  readonly capabilities: RuntimeCapabilities;
}

// ─────────────────────────────────────────────────────────────────────────────
// 显式依赖关系（单一装配点的可审计依据）
// ─────────────────────────────────────────────────────────────────────────────

/** 装配顺序（自底向上；**同一数组即构造顺序**，环依赖在结构上不可能出现）。 */
export const RUNTIME_SERVICE_ORDER = [
  "env",
  "settings",
  "ipc",
  "window",
  "storage",
  "library",
  "plugins",
  "mediaTasks",
] as const;

export type RuntimeServiceName = (typeof RUNTIME_SERVICE_ORDER)[number];

/**
 * 每个服务的依赖（构造期读取项）。
 *
 * `shim/*` 条目是**复用**的既有实现——本模块只转发，不复制第二份业务实现；
 * `preload:*` 条目是桌面桥面；`backend:*` 条目说明该能力由 backend HTTP 承担、
 * **不经** RuntimeServices（对应能力位为 `false` 且原因写明）。
 */
export const RUNTIME_SERVICE_DEPENDENCIES: Record<RuntimeServiceName, readonly string[]> = {
  env: ["shim/environment"],
  settings: ["shim/settingsI18n"],
  ipc: ["shim/ipcBus"],
  window: ["shim/desktopCapability"],
  storage: ["shim/browserRuntime.fsModule", "shim/desktopCapability.writeFileAtomic"],
  library: ["shim/environment.desktopApi", "shim/demoSeed.loadLibraryFromBackend", "backend:/api/library/current"],
  plugins: ["shim/browserRuntime.pluginModule", "preload:openPlugin"],
  mediaTasks: ["preload:thumbnail|duplicates|import|download|export", "backend:任务队列"],
};

// ─────────────────────────────────────────────────────────────────────────────
// 各服务实现（全部是转发/门控，**无业务实现**）
// ─────────────────────────────────────────────────────────────────────────────

function createEnvService(): RuntimeEnvService {
  const capabilities = describeCapabilities();
  return {
    kind: capabilities.kind,
    windowClass: resolveWindowClass(),
    isDemo: capabilities.kind === "demo",
    capabilities,
    gap: (capability, detail) => capabilityGap(capability, detail) as RuntimeCapabilityError | null,
    fail: (capability, detail) => failCapability(capability, detail),
    warn: (capability, detail) => warnCapability(capability, detail),
    markUnavailable: (capability, reason) => markUnavailable(capability, reason),
  };
}

function createSettingsService(): RuntimeSettingsService {
  return {
    getSync: (key) => electronSettings.getSync(key) as unknown,
    get: (key) => Promise.resolve(electronSettings.get(key)) as Promise<unknown>,
    setSync: (key, value) => {
      electronSettings.setSync(key, value);
    },
    set: (key, value) => Promise.resolve(electronSettings.set(key, value)) as Promise<unknown>,
    has: (key) => Boolean(electronSettings.has(key)),
    remove: (key) => {
      electronSettings.delete(key);
    },
    // `currentPreferences(forceReload)` 的形参在 JS 侧可选、在 shim 的签名里必填；
    // 显式传 `undefined` 与「不传」在实现上等价（`!forceReload` 为真 ⇒ 走缓存）。
    preferences: () => currentPreferences(undefined) as unknown,
    save: (next) => {
      savePreferences(next);
    },
    syncNative: () => syncNativePreferences(currentPreferences(undefined)),
  };
}

function createIpcService(): RuntimeIpcService {
  // 单一总线：一律走 `shim/ipcBus` 的同一个 `ipcRenderer` 实例——
  // 另建第二条路由会破坏「IPC 单路由 + 唯一写状态实例」铁律。
  return {
    send: (channel, params) => ipcRenderer.send(channel, params),
    sendTo: (windowId, channel, params) => ipcRenderer.sendTo(windowId, channel, params),
    invoke: (channel, params) => Promise.resolve(ipcRenderer.invoke(channel, params)),
    on: (channel, callback) => {
      ipcRenderer.on(channel, callback);
    },
    once: (channel, callback) => {
      ipcRenderer.once(channel, callback);
    },
    off: (channel, callback) => {
      ipcRenderer.off(channel, callback);
    },
  };
}

function createWindowService(): RuntimeWindowService {
  return {
    current: currentWindow,
    state: () => ({
      maximized: Boolean(hasMethod(desktopBridge()?.window, "isMaximized")),
      fullScreen: Boolean(hasMethod(desktopBridge()?.window, "isFullScreen")),
    }),
  };
}

/** 真实态的 fs 读面：electron 用原生 `node:fs`（与 `moduleRegistry` 的同一条真实现）。 */
interface FsReadFacade {
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding?: string): unknown;
}

function readFacade(): FsReadFacade {
  if (nativeFs) return nativeFs as FsReadFacade;
  return fsModule as unknown as FsReadFacade;
}

function createStorageService(capabilities: RuntimeCapabilities): RuntimeStorageService {
  return {
    writable: capabilities.fs.write,
    readJson: (path) => {
      const facade = readFacade();
      try {
        if (!facade.existsSync(path)) return null;
        const raw = facade.readFileSync(path, "utf8");
        if (typeof raw !== "string" || raw === "") return null;
        return JSON.parse(raw) as unknown;
      } catch (err) {
        console.warn(`[eagle-runtime] 读取库数据失败：${String(path)}`, err);
        return null;
      }
    },
    writeJson: (path, data) =>
      new Promise<void>((resolve, reject) => {
        writeFileAtomic(path, JSON.stringify(data), (err: unknown) => {
          if (err) reject(err);
          else resolve();
        });
      }),
    demoStore: () => demoFileStore(),
  };
}

function normalizeLibrarySnapshot(raw: unknown): RuntimeLibrarySnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  return {
    rootDir: String(record.rootDir ?? record.path ?? ""),
    libraryName: String(record.libraryName ?? record.name ?? ""),
    imagesDir: typeof record.imagesDir === "string" ? record.imagesDir : undefined,
    items: Array.isArray(record.items) ? record.items : [],
    raw,
  };
}

function createLibraryService(): RuntimeLibraryService {
  return {
    source: (kind) => {
      if (kind === "electron") return "desktop-bridge";
      if (kind === "browser-connected") return "backend";
      return "demo-seed";
    },
    snapshot: () => normalizeLibrarySnapshot(runtimeWindow().__mockLibrary),
    reload: () => {
      const kind = resolveRuntimeMode();
      if (kind === "electron") {
        const library = desktopBridge()?.library;
        if (!hasMethod(library, "current")) {
          return Promise.reject(
            new RuntimeCapabilityError(
              "library.current",
              "electron 态无桌面桥 library.current（本应恒有；可能为窗口类别/预加载差异）",
            ),
          );
        }
        return Promise.resolve((library as { current: () => unknown }).current())
          .then((raw) => {
            const snapshot = normalizeLibrarySnapshot(raw);
            if (!snapshot) {
              throw new RuntimeCapabilityError("library.current", "桌面桥返回的库描述为空");
            }
            return snapshot;
          });
      }
      if (kind === "browser-connected") {
        // 复用既有的 backend 装载路径（含快照落位与生命周期发射），不重写一遍。
        return Promise.resolve(loadLibraryFromBackend() as Promise<unknown>).then((raw) => {
          const snapshot = normalizeLibrarySnapshot(raw);
          if (!snapshot) {
            throw new RuntimeCapabilityError("library.current", "backend 响应缺少库描述");
          }
          return snapshot;
        });
      }
      // demo 态：库数据由 `installDemoLibrarySeed()` 供给；此处只读已落位的快照。
      const seeded = normalizeLibrarySnapshot(runtimeWindow().__mockLibrary);
      if (!seeded) {
        return Promise.reject(
          new RuntimeCapabilityError("library.current", "演示库种子尚未安装（demo 态应已由 install.ts 装载）"),
        );
      }
      return Promise.resolve(seeded);
    },
  };
}

function createPluginsService(capabilities: RuntimeCapabilities): RuntimePluginsService {
  return {
    module: pluginModule,
    manageable: capabilities.plugins,
    open: (id, params) => {
      const bridge = desktopBridge();
      if (!hasMethod(bridge, "openPlugin")) {
        return Promise.reject(
          new RuntimeCapabilityError("plugins.openPlugin", "无桌面桥 openPlugin（需改 electron/** 接线）"),
        );
      }
      return Promise.resolve((bridge as { openPlugin: (...args: unknown[]) => unknown }).openPlugin(id, params));
    },
  };
}

function createMediaTasksService(capabilities: RuntimeCapabilities): RuntimeMediaTasksService {
  return {
    bridge: desktopBridge(),
    available: capabilities.mediaTasks,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 装配点
// ─────────────────────────────────────────────────────────────────────────────

/** 当前装配实例的缓存（按 `kind` 失效：模式判定在探测完成后会从 demo 改写为 browser-connected）。 */
let cachedServices: RuntimeServices | null = null;

/**
 * 创建一份 RuntimeServices（**唯一装配点**）。
 *
 * 装配顺序即 {@link RUNTIME_SERVICE_ORDER}；依赖见 {@link RUNTIME_SERVICE_DEPENDENCIES}。
 * 本函数是纯装配：不安装全局、不发事件、不写存储。
 */
export function createRuntimeServices(): RuntimeServices {
  const env = createEnvService();
  const capabilities = env.capabilities;
  const services: RuntimeServices = {
    // 顺序与 RUNTIME_SERVICE_ORDER 一致（env → settings → ipc → window → storage → library → plugins → mediaTasks）
    env,
    settings: createSettingsService(),
    ipc: createIpcService(),
    window: createWindowService(),
    storage: createStorageService(capabilities),
    library: createLibraryService(),
    plugins: createPluginsService(capabilities),
    mediaTasks: createMediaTasksService(capabilities),
    capabilities,
  };
  return services;
}

/**
 * 取当前运行态的 RuntimeServices（按 `kind` 缓存）。
 *
 * 模式判定在启动探测完成后可能变化（`demo` → `browser-connected`），因此缓存键是 `kind`
 * 而非「进程内一次性」：探测落定后再次调用会拿到与新结论一致的能力位。
 */
export function getRuntimeServices(): RuntimeServices {
  const kind = resolveRuntimeMode();
  if (cachedServices && cachedServices.env.kind === kind) return cachedServices;
  cachedServices = createRuntimeServices();
  return cachedServices;
}

/** 释放装配缓存（仅测试夹具使用：同一进程内需要重新判定时）。 */
export function resetRuntimeServices(): void {
  cachedServices = null;
}

/**
 * 装配并把结果登记到窗口（供诊断面板/调试读取）。
 *
 * 只登记两个只读标志：`__eagleRuntimeServices`（装配结果）与 `__EAGLE_RUNTIME_KIND`（模式）。
 * 不覆盖任何业务全局——`installLegacyShimContract()` 的启动契约不受本函数影响。
 */
export function installRuntimeServices(): RuntimeServices {
  const services = getRuntimeServices();
  const flags = runtimeWindow();
  flags.__eagleRuntimeServices = services;
  flags.__EAGLE_RUNTIME_KIND = services.env.kind;
  return services;
}

// ─────────────────────────────────────────────────────────────────────────────
// 对外再导出（上层只需依赖本模块，不必再深入 `shim/`）
// ─────────────────────────────────────────────────────────────────────────────

export { RuntimeCapabilityError, isRuntimeCapabilityError };
export type { ShimRuntimeMode, ShimWindowClass };
export { dialog, electron };
