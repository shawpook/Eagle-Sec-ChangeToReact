/**
 * R2 演示/浏览器开发态适配层：mock 库种子、浏览器导入（拖拽/上传/URL）、
 * 非媒体条目 meta 修补、重复检测转接、capture 轮询，以及**窗口生命周期驱动**
 * （emitMockLifecycle/startLifecycle —— 演示态发合成库事件；Electron 态由真实库事件承担数据）。
 *
 * 迁移自 `core/shimsLegacy.ts` 的 IIFE（原 9-464 mock 种子块 + 1085-1265、3009-3383 区间），
 * 函数体逐字保留。种子安装由 `installDemoLibrarySeed()` 承担，且**只在显式 demo 模式**执行
 * （原判据 `!window.eagleDesktop` → 现为 `resolveRuntimeMode() === "demo"`，语义等价）。
 * 计时器句柄提升为模块级，供 `disposeDemoTimers()` 释放。
 *
 * M2-8 类型化：本文件已撤销整文件 `// @ts-nocheck`，只补类型标注。宿主 `window` 上的运行期扩展字段
 * 与桌面桥视图一律经**具名 interface**读取（与 `shim/environment.ts` 的 `ShimHostWindow`、
 * `ipcBus.ts` 的 `IpcBusHostWindow` 同口径：只声明本模块实际读写的字段，逐条标注运行期写入点；
 * `global/globals.d.ts` 只声明了其中一部分，且 `tests/shim-module-boundaries.mjs` 以
 * `core/shim/*.ts` 为根建 Program、不加载该 d.ts——shim 模块须自包含）；
 * 形状未知的成员读取一律经 {@link readMember}（与裸属性访问同义）。本批不新增
 * `any` / `@ts-ignore` / `@ts-expect-error` / `as any` / `as unknown as`；
 * **可观察行为零改动**——尤其 `installDemoLibrarySeed` 的非 demo 态拒绝安装（下方 `markUnavailable`）
 * 与 `emitMockLifecycle` 的 browser-connected 拒发分支逐字保留，类型化未把任何
 * 抛错/登记缺口退回成静默返回。
 */
import {
  bodyScope, desktopApi as rawDesktopApi, isDemoRuntime, isElectronRuntime, markUnavailable, probeRuntimeModeOnce,
  resolutionMediaExtensions, resolveRuntimeMode, RuntimeCapabilityError, unavailableResult,
} from "./environment";
import { pluginModule } from "./browserRuntime";
import { readSetting, settingsMemory } from "./settingsI18n";
import { ipcRenderer, mockEmit, writeState } from "./ipcBus";

/* ── 本模块的运行期形状面（M2-8） ──────────────────────────────────────────────
 * 与 `shim/environment.ts` / `shim/ipcBus.ts` 同口径：只声明**本模块实际读写的字段**，
 * 不做全量镜像；形状的出处逐条标注在成员上（不新造第二套事实源）。
 */

/**
 * 库条目在本模块的消费面。字段**全可选**：条目既可能来自下方的演示种子字面量，
 * 也可能来自桌面桥 `library.current()` / backend 的**真实**库描述，本模块一律按
 * `|| 兜底` 读（与修前的裸属性访问同义）。留索引签名是因为种子字面量携带的字段
 * （`palettes`/`website`/`modificationTime`…）多于本模块实际读取的那几个，
 * 逐条镜像会把「显示用字段」也变成此处的事实源。
 */
interface DemoLibraryItem {
  id?: string;
  name?: string;
  ext?: string;
  url?: string;
  size?: number;
  star?: number;
  tags?: string[];
  folders?: string[];
  customThumbnail?: unknown;
  [key: string]: unknown;
}

/**
 * 库快照在本模块的消费面（写点：{@link installDemoLibrarySeed} 与 {@link applyLibrarySnapshot}）。
 * 来源同上：演示种子（8 个字段）或真实库描述（字段更多），故亦留索引签名。
 */
interface DemoLibrarySnapshot {
  rootDir?: string;
  imagesDir?: string;
  /** backend 库描述用 `path` 承载根目录（见 {@link applyLibrarySnapshot} 的 `rootDir || path`）。 */
  path?: string;
  libraryName?: string;
  name?: string;
  items?: DemoLibraryItem[];
  folders?: unknown;
  smartFolders?: unknown;
  quickAccess?: unknown;
  tagsGroups?: unknown;
  [key: string]: unknown;
}

/** 重复扫描作业在本模块的消费面（`preload.cjs:129-133` 的 `duplicates.scan/status` 回执）。 */
interface DemoDuplicateJob {
  id?: unknown;
  status?: string;
  message?: string;
  progress?: unknown;
  /** `status==='complete'` 时的结果载荷（本身也是一份作业视图：含 `groups`）。 */
  result?: DemoDuplicateJob | null;
  cancelled?: boolean;
  groups?: DemoDuplicateGroup[];
}

/** 重复分组：{@link enrichDuplicateGroups} 只按 `items[].id` 回填条目，其余字段原样透传。 */
interface DemoDuplicateGroup {
  items?: DemoLibraryItem[];
  [key: string]: unknown;
}

/**
 * 桌面桥的**本模块消费面**（形状取自 `electron/preload.cjs`，逐成员标注出处行号）。
 * `environment.desktopApi` 只声明了 `library.setHistory`（M2-3 批的消费面），本模块另需
 * `library.current` / `duplicates` / `preview`；沿用 `desktopCapability.ts:129-131` 与
 * `ipcBus.ts:211` 的同款做法**就地具名 + 断言**——不改 `environment.ts`（非本批 ownership），
 * 也不借 `any` 传播。桥面成员一律返回 Promise（preload 侧恒 `ipcRenderer.invoke`）。
 */
interface DemoDesktopBridge {
  library?: {
    current(): Promise<DemoLibrarySnapshot>;                                      // preload.cjs:80
  } | null;
  duplicates?: {
    scan(params: unknown): Promise<DemoDuplicateJob>;                             // preload.cjs:129
    status(jobId: unknown): Promise<DemoDuplicateJob>;                            // preload.cjs:132
    cancel(jobId: unknown): Promise<unknown>;                                     // preload.cjs:133
  } | null;
  /** 预览窗桌面桥（本模块只判存在性：存在 ⇒ 真实 Electron 预览，不发 mock 载荷）。 */
  preview?: unknown;                                                              // preload.cjs:105
}

/** 重复检测门面（{@link patchDuplicateChecker} 覆写其 `findDuplicateFiles`/`findSimilarFiles`）。 */
interface DemoDuplicateCheckerFace {
  __shimmed?: boolean;
  findDuplicateFiles?(items: unknown, cancelToken: unknown, options?: { onProgress?: unknown }): Promise<unknown>;
  findSimilarFiles?(items: unknown, cancelToken: unknown, options?: { onProgress?: unknown }): Promise<unknown>;
}

/** `eagle` 基座在本模块的消费面（`core/eagleApi.ts` 求值期安装；本模块只读写 `duplicateChecker`）。 */
interface DemoEagleFace {
  duplicateChecker?: DemoDuplicateCheckerFace | null;
}

/**
 * font/text/gif viewer 页的 mock body scope（本文件 {@link emitMockLifecycle} 写入；
 * 字段取自修前的字面量，`environment.ts:64-81` 的 `$bodyScope` 取证即含本写入点）。
 */
interface DemoBodyScopeFace {
  preferences?: { general?: { language?: string } };
  imagesDir?: string;
  inspector?: { newName?: string };
  gifViewer?: {
    onFinished?(data: unknown): unknown;
    onProgress?(progress: number, length: number): unknown;
  };
  current?: DemoLibraryItem & { fontMetas?: unknown };
  [key: string]: unknown;
}

/**
 * 宿主窗口上的**运行期扩展面**（写入方逐条标注；`global/globals.d.ts` 只声明了其中一部分）。
 *
 * 只补 `globals.d.ts` 里**缺失**或声明为 `any` 的字段；已在 M2-5 区被精确声明的
 * （`__EAGLE_API_BASE_URL` / `__eaglePreferencesEntryReady`）**不在此重复声明**——同一字段
 * 两处事实源正是本仓禁止的债，那两处仍按裸 `window.` 读（与 `ipcBus.ts` 同口径）。
 *
 * `angular` 一节：修前写作 `window.angular ? angular.element(document.body).scope() : …`
 * ——裸 `angular` 与 `window.angular` 在渲染层是**同一个全局对象**（本文件无同名 import 遮蔽），
 * 故改经本面读取：取值与判定逐字同义，且免去一条 `Cannot find name 'angular'` 的全局声明。
 */
interface DemoSeedHostWindow {
  /** 演示/当前库快照（写点：{@link installDemoLibrarySeed}、{@link applyLibrarySnapshot}）。 */
  __mockLibrary?: DemoLibrarySnapshot;
  /** 库条目缓存（写点同上；读点遍布本文件的 meta 修补、capture 轮询与生命周期载荷）。 */
  __mockLibraryCache?: DemoLibraryItem[];
  /** `eagle` 基座（`core/eagleApi.ts` 求值期安装；保鲜计时器与 {@link patchDuplicateChecker} 读写）。 */
  eagle?: DemoEagleFace | null;
  /** 子窗 mock scope 面（本文件为 font/text/gif viewer 页写入）。 */
  $bodyScope?: DemoBodyScopeFace;
  /** 生命周期发射入口（本文件自挂到 window 上，供 Angular 侧遗留调用）。 */
  __eagleEmitMockLifecycle?: () => void;
  /** model-viewer 页的遗留回调标记（本文件置位）。 */
  hasCallback?: boolean;
  /** 预览窗 entry 就绪标记 / 待发 init 载荷（`preview-window/entry.tsx` 与回程桥写入）。 */
  __eaglePreviewEntryReady?: boolean;
  __eaglePendingPreviewInit?: unknown;
  /** collect-window 的 entry 就绪标记 / controller / 文件夹面板（`collect-window/*` 写入）。 */
  __eagleCollectEntryReady?: boolean;
  __eagleCollectController?: { folders?: unknown[]; initFolderSelect?: () => unknown } | null;
  __eagleCollectFolderPanel?: { listData?: { items?: unknown[] } } | null;
  /** Angular 遗留面（{@link patchNonMediaMeta} 与 {@link startCapturePolling} 读）。 */
  angular?: { element(node: unknown): { scope(): unknown } } | null;
}

/** 宿主窗口视图（**纯类型窄化**，运行期即 `window` 本身，不做任何包装/代理）。 */
function hostWindow(): DemoSeedHostWindow {
  return window as DemoSeedHostWindow;
}

/** 桌面桥视图（`environment.desktopApi` 的本模块消费面；无桥为 `null`）。 */
const desktopApi: DemoDesktopBridge | null = rawDesktopApi ? (rawDesktopApi as DemoDesktopBridge) : null;

/**
 * 任意值的**具名成员读取**（与 `environment.ts:212-215` 同名同义，未导出故就地复制）。
 * 与修前的裸属性访问同义：`null`/`undefined` 返回 `undefined`，原始值取成员亦为 `undefined`。
 */
function readMember(value: unknown, key: string): unknown {
  if (value === null || value === undefined) return undefined;
  return (value as Record<string, unknown>)[key];
}

/** 计时器句柄类型（修前为 `any`）：只用于 `clearInterval`/`clearTimeout` 与真值判定。 */
type TimerHandle = ReturnType<typeof setInterval> | null;

let nonMediaMetaPatcherTimer: TimerHandle = null;
let capturePollTimer: TimerHandle = null;
let duplicateCheckerGuard: TimerHandle = null;
let duplicateCheckerGuardTimer: ReturnType<typeof setTimeout> | null = null;

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
    const host = hostWindow();
    if (host.eagle && host.eagle.duplicateChecker && desktopApi && desktopApi.duplicates) patchDuplicateChecker();
  }, 100);
  // 句柄类型化自 `any` 收窄为 `number | null` 后，`clearInterval` 的入参不再接受 `null`；
  // `clearInterval(null)` 本身即空操作（与不调用不可区分），故按句柄存在性跳过，取值域不变。
  duplicateCheckerGuardTimer = setTimeout(() => {
    if (duplicateCheckerGuard) clearInterval(duplicateCheckerGuard);
  }, 8000);
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

  // M2-1 防御性门禁（纵深防御）：演示种子是**唯一**允许伪造业务数据的地方，只有 demo 态可入。
  // 调用方（`install.ts`）已在 await 后端探测后判定，此处再判一次，杜绝「浏览器连真后端时
  // 仍灌 demo seed」经由任何新增调用点复发。
  if (!isDemoRuntime()) {
    markUnavailable('demoSeed.librarySeed', `非 demo 态（${resolveRuntimeMode()}）拒绝安装演示库种子`);
    return;
  }

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

  const host = hostWindow();
  host.__mockLibrary = {
    rootDir,
    imagesDir,
    libraryName: 'Eagle Reverse Demo',
    folders,
    smartFolders,
    quickAccess,
    tagsGroups,
    items,
  };

  host.__mockLibraryCache = items.slice();
}

// 本地导入在飞计数。capture 轮询（startCapturePolling）以「库里出现了 known/cache/raw
// 都没有的条目」判定为外部捕获并补发 file-uploaded；而本地导入的条目在 invoke 回到
// renderer 之前正好是这个形态（后端已落库、cache 尚未合并）——轮询与导入 .then 抢跑就会把
// 同一 id 各发一次 file-uploaded，itemDomain 因此两次 unshift（实测抢跑差 50~250ms，
// m1 的 `* drop import inserted duplicate item IDs` 即此）。轮询在 await 之后据此整轮跳过，
// 条目落地后统一由 emitImportedItems 发布。

export async function browserUploadLocalFiles(files: unknown) {
  const list = Array.isArray(files) ? files : [];
  if (list.length === 0) return [];
  const apiBase = (window.__EAGLE_API_BASE_URL || 'http://localhost:41695').replace(/\/$/, '');
  const blobFiles = list.filter((file) => file && typeof Blob !== 'undefined' && file instanceof Blob);
  const pathFiles = list.filter((file) => file && !(typeof Blob !== 'undefined' && file instanceof Blob) && typeof file.path === 'string' && file.path);
  // 标注为 `unknown[]`（修前是空数组字面量的演进型 `any[]`）：入参来自拖拽/上传的动态载荷，
  // 元素形状由调用方（`ipcBus`）决定，本模块只负责聚合与回报。
  const imported: unknown[] = [];

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

export function browserImportLocalFiles(files: unknown, channel = 'upload-local-files') {
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

export async function browserImportUrl(params: unknown, channel = 'upload-url') {
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

export async function browserImportUrls(params: unknown, channel = 'upload-urls') {
  // 修前的 `Array.isArray(params) ? params : (params && (params.images || params.urls)) || []`
  // **逐字同义**：`readMember` 对 `null`/`undefined`/原始值与裸属性访问取值一致（一律 `undefined`），
  // 故省去 `params &&` 前缀；`as unknown[]` 只是类型标注——**非数组真值仍原样传下去**
  // （下方 `.map` 照旧对它抛 TypeError，不在此处静默归一为空数组，避免把「明确失败」改成「静默返回」）。
  const list = (Array.isArray(params)
    ? params
    : readMember(params, 'images') || readMember(params, 'urls') || []) as unknown[];
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
    // `event.target` 运行期即落点 DOM 元素（drag/drop 的 target 不会是文本节点）；此处是类型层
    // 收窄，**下方 `typeof closest !== 'function'` 守卫逐字保留**——非元素目标仍走同一条早退。
    const target = event.target as Element | null;
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

/** 字节数格式化。入参取 `unknown`：调用点传的是条目上取值域不定的 `size`（`Number()` 归一，同修前）。 */
export function formatFileSize(bytes: unknown) {
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
      const host = hostWindow();
      const extClass = Array.from(box.classList).find((name) => name.startsWith('ext-'));
      const ext = extClass ? extClass.slice(4).toLowerCase() : '';
      if (!ext || resolutionMediaExtensions.has(ext)) return;
      const meta = box.querySelector('.metas');
      // `Element.textContent` 在 DOM 规范里恒为字符串（只有 Document/doctype 节点才是 `null`），
      // 故此处的非空断言与修前的裸 `.trim()` 同义（真为 null 时照旧抛 TypeError 进下方 catch）。
      if (!meta || !/^\d+\s*×\s*\d+$/.test(meta.textContent!.trim())) return;
      const sizeElement = box.querySelector('.prop.size');
      const sizeText = sizeElement && sizeElement.textContent!.trim();
      const itemId = box.getAttribute('data-box-id');
      const cached = (host.__mockLibraryCache || []).find((entry) => entry && entry.id === itemId);
      const angular = host.angular;
      const scope = angular ? angular.element(document.body).scope() : null;
      // `itemMappings[itemId]` 的逐字同义读法：`obj[null]` 与 `obj['null']` 在 JS 里是同一键
      // （属性访问按 ToPropertyKey 归一），故 `String(itemId)` 不改变任何取值；
      // 条目形状未知（Angular scope 侧），取值经 readMember 留在 `unknown` 上。
      const mappings = readMember(scope, 'itemMappings');
      const item = (mappings && readMember(mappings, String(itemId))) || cached;
      meta.textContent = sizeText || formatFileSize(item && readMember(item, 'size'));
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

/**
 * 轮询一个重复扫描作业直到终态。`cancelToken` / `onProgress` 取 `unknown`：前者是宿主传进来的
 * 取消令牌（本模块只探它的 `isCancelled`），后者是调用方回调（只按 `typeof === 'function'` 判）。
 */
export async function pollDuplicateJob(
  jobId: unknown,
  cancelToken: unknown,
  onProgress: unknown,
  total: number,
): Promise<DemoDuplicateJob> {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    // `cancelToken && typeof cancelToken.isCancelled === 'function' && cancelToken.isCancelled()`
    // 的逐字等价读法：`readMember` 对 null/undefined/原始值一律给 `undefined`（与裸属性访问同义），
    // 且只在 `cancelToken` 为真值时读——与修前的短路顺序一致；`.call(cancelToken)` 保住 `this` 绑定。
    const isCancelled = cancelToken ? readMember(cancelToken, 'isCancelled') : undefined;
    if (typeof isCancelled === 'function' && isCancelled.call(cancelToken)) {
      if (desktopApi && desktopApi.duplicates) desktopApi.duplicates.cancel(jobId).catch(() => {});
      return { cancelled: true, groups: [] };
    }
    // 修前此处即 `desktopApi.duplicates.status(...)`：无桌面桥时**当场抛 TypeError**，
    // 属「能力缺失即明确失败」契约的一部分。非空断言只抹掉类型里的 `null`，不改运行期求值序列
    // （断言后仍是同一处 `null.status` 的 TypeError），故**不**改成静默返回。
    const job = await desktopApi!.duplicates!.status(jobId);
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

/**
 * 把分组里条目的 `id` 回填为缓存中的完整条目。入参取 `unknown`（分组来自桌面桥回执，
 * 形状不归本模块定义）；两处 `as` 都只在类型层——**非数组真值仍照旧在 `.map` 处抛 TypeError**，
 * 不在此处静默归一为空数组（那会把「明确失败」改成「静默返回」）。
 */
export function enrichDuplicateGroups(groups: unknown, sourceItems: unknown) {
  const mapping = new Map<string | undefined, DemoLibraryItem>(
    ((sourceItems || []) as DemoLibraryItem[]).map((item) => [item.id, item]),
  );
  return ((groups || []) as DemoDuplicateGroup[]).map((group) => ({
    ...group,
    items: (group.items || []).map((entry) => mapping.get(entry.id) || entry),
  }));
}

export function patchDuplicateChecker() {
  const host = hostWindow();
  // 修前的三处 `window.eagle…` 守卫与写入顺序逐字保留（`eagle` 是同一对象引用，
  // 只是改经具名面读取：免掉一条 `window.eagle` 的全局声明，取值与判定同义）。
  if (!host.eagle) return;
  if (host.eagle.duplicateChecker && host.eagle.duplicateChecker.__shimmed) return;
  // 守卫后定格为 const：`desktopApi.duplicates` 的属性收窄不跨下面两个 async 方法体
  // （跨闭包失效），定格后 const 收窄保留，方法体内无需再断言。
  const duplicates = desktopApi ? desktopApi.duplicates : null;
  if (!duplicates) return;
  host.eagle.duplicateChecker = {
    __shimmed: true,
    async findDuplicateFiles(items: unknown, cancelToken: unknown, options: { onProgress?: unknown } = {}) {
      const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
      // 入参断言为 `unknown[]`（只做类型标注）：修前 `Array.isArray(items) ? items : []` 的
      // `any[]` 隐式 any 就此收敛，取值域不变——元素仍是原样的 `unknown`。
      const list: unknown[] = Array.isArray(items) ? items : [];
      const job = await duplicates.scan({
        method: 'same',
        // `item.id` 保持裸属性访问：`item` 为 null/undefined 时照旧抛 TypeError（readMember 会把它
        // 变成 `undefined`，那是行为改动），`as` 只在类型层。
        ids: list.map((item) => (item as DemoLibraryItem).id),
        async: true,
      });
      const result = await pollDuplicateJob(job.id, cancelToken, onProgress, list.length);
      if (result.cancelled) return { cancel: true, groups: [] };
      return { groups: enrichDuplicateGroups(result.groups, list) };
    },
    async findSimilarFiles(items: unknown, cancelToken: unknown, options: { onProgress?: unknown } = {}) {
      const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
      const list: unknown[] = Array.isArray(items) ? items : [];
      // 本轮只承诺 exact；similar 不返回伪造结果。
      if (typeof onProgress === 'function' && list.length > 0) onProgress(list.length, list.length);
      return { groups: [], fingerprintMap: {} };
    },
  };
}

let capturePollStarted = false;
let capturePollLibraryPath = '';
export function startCapturePolling() {
  // 守卫后定格为 const（跨下面 `tick` 闭包使用）：修前的判据 `!desktopApi || !desktopApi.library
  // || typeof desktopApi.library.current !== 'function'` 与之取值域逐一等价——
  // 无桥 / 桥无 library / `library` 是真值但 `current` 非函数，三条都仍在此 return。
  const libraryApi = desktopApi ? desktopApi.library : null;
  if (capturePollStarted || !libraryApi || typeof libraryApi.current !== 'function') return;
  const pagePath = window.location.pathname || '';
  if (!pagePath.endsWith('/src/app/index.html')) return;
  capturePollStarted = true;
  const host = hostWindow();
  // 修前 `new Set()` 在 strict 下推断为 `Set<any>`；显式参数只在类型层，
  // 运行期是同一个无类型 Set（下表只放 id、只问 id；`add` 收的 id 声明为可选，
  // 与 `item.id` 的实际类型一致）。
  const known = new Set<string | undefined>();
  (host.__mockLibraryCache || []).forEach((item) => {
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
      const library = await libraryApi.current();
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
      const cachedIds = new Set((host.__mockLibraryCache || []).map((item) => item && item.id).filter(Boolean));
      let rawIds: Set<unknown> = new Set();
      try {
        // 去 Angular 后 body scope 由 bodyScope() 承载（angular 缺席时原表达式恒 null，
        // 这道「已在列表里」的防线会整条失效）。`scope.raw` 形状未知，经 readMember 读
        // （与裸属性访问取值同义）；`item && item.id` 保持修前的取值域（null 元素给 null，
        // 交给 filter(Boolean) 滤掉，不改成可选链——那会把 null 变成 undefined）。
        const angular = host.angular;
        const scope = angular ? angular.element(document.body).scope() : (bodyScope() || null);
        const rawValue = readMember(scope, 'raw');
        const rawItems: unknown[] = Array.isArray(rawValue) ? rawValue : [];
        rawIds = new Set(rawItems.map((item) => item && (item as DemoLibraryItem).id).filter(Boolean));
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
  const host = hostWindow();
  host.__eagleEmitMockLifecycle = emitMockLifecycle;
  // M2-1 目标 3 的唯一收紧点：**browser-connected 且无真实库快照**时拒绝发射。
  //
  // 为什么不是「按运行态一刀切拒绝非 demo」——见下（对照实验证据）。为什么只收 browser-connected：
  //  - `electron`：本函数是各子窗启动载荷的当前唯一投递入口，而子窗不一定持有库快照
  //    （桌面桥分支与子窗 `startLifecycle()` 两条路径的时序不同）。收紧 electron 会直接
  //    打断子窗（实测：text-editor iframe 超时、主窗布局网格不渲染），属于破坏现有业务行为。
  //    该路径下是否仍有「无快照回落演示常量」的假数据问题，本批**不修**，登记为遗留
  //    （调研 §C 未收录此条，见交付汇报）。
  //  - `demo`：演示态本就是**显式选择**的合成数据来源。
  //  - `browser-connected`：修前它被当作 demo 而灌演示数据；现要求「有真实来源才发」，
  //    避免浏览器连真后端时把演示常量当成库数据广播出去。
  if (!host.__mockLibrary && resolveRuntimeMode() === 'browser-connected') {
    const reason = 'browser-connected 态无真实库快照（backend 未取回库），拒绝发射演示生命周期载荷';
    markUnavailable('demoSeed.mockLifecycle', reason);
    console.warn('[eagle-shim] emitMockLifecycle 被拒绝：' + reason);
    return;
  }
  const lib = host.__mockLibrary || {
    rootDir: '/mock-library/Eagle Reverse Demo.library',
    imagesDir: '/mock-library/Eagle Reverse Demo.library/images/',
    folders: [],
    smartFolders: [],
    quickAccess: [],
    tagsGroups: [],
  };
  const items = host.__mockLibraryCache || [];
  const registration = windowRegistration();
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
    host.$bodyScope = {
      ...viewerMethods,
      preferences: { general: { language: 'zh_CN' } },
      imagesDir: '/mock-library/Eagle Reverse Demo.library/images/',
      inspector: { newName: '' },
      gifViewer: {
        // 修前是 `data && data.frames ? data.frames.length : 0`：判据与取值域逐字保留
        // （`data` 为假值时取 0；`frames` 为真值时才读它的 `length`，故用断言而非
        // `readMember(…,'length')`——后者对字符串 `frames` 会给出 `undefined`，而
        // `'abc'.length` 是 3，那是取值改动）。
        onFinished: (data) => {
          const frames = data ? readMember(data, 'frames') : undefined;
          console.debug('[eagle-shim] gif viewer finished', frames ? (frames as { length?: unknown }).length : 0);
        },
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
    host.hasCallback = true;
    try {
      // `frameElement` 是 Window 上的只读属性，只能在真实 `window` 上 defineProperty
      // （本模块的具名面是纯类型视图，无运行期对象可写）。
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
      if (!host.__eaglePreviewEntryReady) return;
      clearInterval(retry);
      ipcRenderer.emit('init', host.__eaglePendingPreviewInit || payload);
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
          if (!host.__eagleCollectEntryReady) return;
          const root = host.__eagleCollectController;
          if (!root) return;
          const panel = document.querySelector('folder-select-panel');
          if (!panel) return;
          const listData = (host.__eagleCollectFolderPanel || {}).listData;
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
    // 修前是给函数对象挂 `waitPreferencesEntry.attempts` 计数；TS 不允许在函数表达式上声明属性，
    // 而该属性在本文件外不可达（`waitPreferencesEntry` 是块级局部），其值也不参与任何判定。
    // 故改为等价的闭包计数器（与本文件 `emitLibraryLifecycle` 的 `emitAttempts` 同款）。
    let waitPreferencesEntryAttempts = 0;
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
      waitPreferencesEntryAttempts += 1;
      setTimeout(waitPreferencesEntry, 25);
    };
    waitPreferencesEntry();
    return;
  }

  if (!pagePath.endsWith('/index.html') && !pagePath.endsWith('/src/app/index.html')) {
    return;
  }

  emitLibraryLifecycle(lib, registration);
}

/**
 * 库生命周期事件序列（`initial` → `app-status-loading` → `preload-library` →
 * `app-status-library-loaded`），**由 electron 与 browser-connected 共用**。
 *
 * M2-1 抽出：修前这段只内联在 `emitMockLifecycle()` 里，于是「浏览器 + 真后端」若想走真实库
 * 就只能再抄一份事件序列（任务书禁止第二次复制业务实现）。参数化后，两种真实来源
 * （桌面桥 `library.current()` / backend `/api/library/current`）走**同一条**序列。
 */
export function emitLibraryLifecycle(lib: DemoLibrarySnapshot, registration: unknown) {
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

/** 窗口启动载荷里的 Registration 形状（各窗 `initial` 事件共用；非库业务数据）。 */
function windowRegistration() {
  return {
    activated: true,
    machineID: 'preview',
    license: { email: 'preview@eagle.local' },
  };
}

/**
 * 把库描述落到本地快照槽位（`__mockLibrary` / `__mockLibraryCache`）。
 *
 * 槽位名带 `mock` 是 R2 之前的历史命名——它实际承载的是**本窗的库快照**：electron 态
 * 一直写的就是 `desktopApi.library.current()` 取回的真实库。M2-1 把同一段落到函数里，
 * 供桌面桥与 backend 两条真实来源共用，避免第二次拷贝（重命名槽位会波及大量消费者，另行登记）。
 */
function applyLibrarySnapshot(library: DemoLibrarySnapshot) {
  const host = hostWindow();
  host.__mockLibrary = {
    ...library,
    rootDir: library.rootDir || library.path,
    imagesDir: library.imagesDir,
    libraryName: library.libraryName || library.name,
  };
  // 修前此处是「写 `window.__mockLibraryCache`，再读回该槽位 forEach」——中间无任何可观察步骤，
  // 故把写下去的那份数组定格为 `cache` 再迭代，取值与迭代对象逐一相同。
  const cache: DemoLibraryItem[] = Array.isArray(library.items) ? library.items.slice() : [];
  host.__mockLibraryCache = cache;
  cache.forEach((item) => {
    if (item && item.customThumbnail) writeState().customThumbnailItemIds.add(item.id);
  });
  writeState().scheduleMissingPaletteAnalysis(cache);
  const storedHistory = readSetting('libraryHistory');
  // `...priorHistory` 显式收敛为 `unknown[]`（修前 `Array.isArray` 收窄出的 `any[]` 的隐式 any）；
  // 元素是原样的值，`filter(Boolean)` 与去重比较的取值域不变。
  const priorHistory: unknown[] = Array.isArray(storedHistory) ? storedHistory : [];
  settingsMemory.libraryHistory = [library.path, ...priorHistory]
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);
}

/**
 * M2-1：`browser-connected` 态的库引导——经既有 backend HTTP 端点取真实库。
 *
 * 与 electron 分支共用 {@link applyLibrarySnapshot} 与 {@link emitLibraryLifecycle}，
 * 不新增第二套业务实现。失败时**不回落演示数据**，而是返回带 `unavailable` 标记的结果对象
 * 并广播 `library:operation-result` 失败事件，让 UI 能显示真实失败。
 */
export function loadLibraryFromBackend() {
  const apiBase = String(window.__EAGLE_API_BASE_URL || 'http://localhost:41695').replace(/\/$/, '');
  return fetch(`${apiBase}/api/library/current?includeItems=true`)
    .then((response) => {
      if (!response || !response.ok) {
        throw new RuntimeCapabilityError('library.current', `backend ${apiBase} 未返回库描述（HTTP ${response ? response.status : 'n/a'}）`);
      }
      return response.json();
    })
    // 载荷显式收成 `unknown`（`response.json()` 本返回 `any`）：下方的信封解包因此走具名断言 +
    // 逐项判定，不再有 `any` 传播。
    .then((payload: unknown) => {
      // `payload && payload.status === 'success' ? payload.data : payload` 的逐字等价读法：
      // 断言出的 `envelope` 与 `payload` 是同一个值，`envelope && …` 对 null/undefined/假值
      // 一律回落到 `payload` 本身（与修前的短路结果相同，不会把 null 载荷变成 `undefined`）。
      const envelope = payload as Record<string, unknown> | null;
      const library = envelope && envelope.status === 'success' ? envelope.data : payload;
      if (!library || typeof library !== 'object') {
        throw new RuntimeCapabilityError('library.current', 'backend 响应缺少库描述');
      }
      applyLibrarySnapshot(library as DemoLibrarySnapshot);
      startCapturePolling();
      mockEmit('library:changed', library);
      // 与 electron 分支共用**同一个**投递入口（`emitMockLifecycle` 内部按 pathname 分发子窗载荷），
      // 不另写一套事件序列。快照已落位 ⇒ 序列里用的是 backend 取回的真实库。
      emitMockLifecycle();
      return library;
    })
    .catch((err: unknown) => {
      // `(err && err.message) || String(err)`：`readMember` 与裸属性访问取值同义，`String(err)`
      // 仍作用于原值 ⇒ 兜底串逐字相同。`reason` 保持 `unknown`（修前它也可能是非字符串的
      // 真值 message），仅在 `markUnavailable` 处 `String()`——该函数内部本就
      // `String(reason || …)`，故登记值与修前一致；`console.warn` 与事件载荷仍收到原样的值。
      const reason = readMember(err, 'message') || String(err);
      console.warn('[eagle-shim] browser-connected 库引导失败', reason);
      markUnavailable('library.current', String(reason));
      mockEmit('library:operation-result', { ok: false, action: 'current', error: reason });
      return unavailableResult('library.current', String(reason));
    });
}

/**
 * 窗口生命周期驱动（三态）。
 *
 *  - `electron`          桌面桥 `library.current()`（真实现，语义未变）；
 *  - `browser-connected` 经 backend `/api/library/current`（真实现，不灌演示数据）；
 *  - `demo`              发合成库事件（**显式选择的**演示实现）。
 *
 * 修前判据是「有没有 `desktopApi.library.current`」——无桌面桥就一律发 mock 生命周期，
 * 于是浏览器连真后端时 UI 上「真实库」与「演示数据」无法区分（F07 调研 §B.2-3）。
 */
export function startLifecycle() {
  const libraryApi = desktopApi ? desktopApi.library : null;
  if (libraryApi && typeof libraryApi.current === 'function') {
    libraryApi.current().then((library) => {
      applyLibrarySnapshot(library);
      startCapturePolling();
      // **必须**回到 `emitMockLifecycle()`，不能直接发库生命周期：它同时是各子窗
      // （font-viewer / text-editor / gif-viewer / preview / model-viewer）启动载荷的
      // 唯一投递入口，按 `location.pathname` 分发。初版重构在此处换成
      // `emitLibraryLifecycle(...)`，等于只发主窗那一段——实测后果：electron 态下
      // 子窗永远拿不到载荷（`react-stage-smoke` 的 text-editor iframe 超时）。
      // 快照已落位，故 `emitMockLifecycle()` 用的是真实库数据，不是演示常量。
      emitMockLifecycle();
    }).catch((err: unknown) => {
      // 真实业务态取库失败时**不再回落演示数据**（M2 验收：真实模式不读取 demo seed 冒充业务数据），
      // 只登记不可用并由 UI 呈现空态/错误态。
      // `reason` 的读法与 `loadLibraryFromBackend` 的 catch 同款（见该处注释）。
      const reason = readMember(err, 'message') || String(err);
      console.warn('[eagle-shim] current library bootstrap failed', reason);
      markUnavailable('library.current', String(reason));
      mockEmit('library:operation-result', { ok: false, action: 'current', error: reason });
    });
    return;
  }
  // 无桌面桥：必须区分「浏览器 + 真后端」与「浏览器 + 无后端」——同步判据做不到，
  // 故与 `install.ts` 的种子判定共用同一个探测 Promise（probeRuntimeModeOnce）。
  probeRuntimeModeOnce().then((kind) => {
    if (kind === 'browser-connected') {
      loadLibraryFromBackend();
      return;
    }
    emitMockLifecycle();
  });
}
