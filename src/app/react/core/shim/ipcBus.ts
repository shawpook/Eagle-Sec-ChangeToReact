/**
 * R2 事件/IPC 总线族：shim 的 EventEmitter 总线、ipcRenderer facade、通道路由表、回程回退注册。
 *
 * 迁移自 `core/shimsLegacy.ts` 的 IIFE（原 798-910、1268-1726、1727-1837 区间），
 * 函数体逐字保留（含所有通道名的原拼写与注释取证）。
 * 与 R2 前的差别：①写路径状态改为复用 `core/ipcWriteState`（见下方 writeState）；
 * ②回程注册体包成 `installReturnBridgeFallback()`，由 `shim/install.ts` 显式调用（时序不变，
 * 仍为 0ms timer）；③预览面动作助手（runPreviewAction 等）随总线一同迁入（desktopCapability 消费）。
 *
 * M2-8 类型化：本文件已撤销整文件 `// @ts-nocheck`，只补类型标注。宿主 `window` 上的运行期扩展字段、
 * 桌面桥与写状态共享实例一律经**具名 interface**读取（`global/globals.d.ts` 只声明了其中一部分；
 * 且 `tests/shim-module-boundaries.mjs` 以 `core/shim/*.ts` 为根、不加载该 d.ts——shim 模块须自包含），
 * 动态形状的成员读取一律经 {@link readMember}（与裸属性访问同义）。
 * 本批不新增 `any` / `@ts-ignore` / `@ts-expect-error` / `as any` / `as unknown as`；**可观察行为零改动**
 * ——尤其 `invoke` 的「未登记频道 → 明确 reject」契约（下方 105-110 行，M2-1 调研 §E.6 红线）逐字保留，
 * 类型化未把任何抛错/拒绝退回成静默返回。
 */
import { bodyScope, capabilityGap, desktopApi as rawDesktopApi, nativeRequire } from "./environment";
import { applyPreferencesToCurrentDocument, broadcastIpc, savePreferences } from "./settingsI18n";
import { browserImportLocalFiles, browserImportUrl, browserImportUrls } from "./demoSeed";
import { getIpcWriteState } from "../ipcWriteState";

/* ── 本模块的运行期形状面（M2-8） ──────────────────────────────────────────────
 * 与 `shim/environment.ts` 的 `ShimHostWindow` / `ShimScopeFace` 同口径：只声明**本模块实际读写
 * 的字段**，不做全量镜像；形状的出处逐条标注在成员上（不新造第二套事实源）。
 */

/** 总线监听回调。`emit` 恒以 `({}, ...args)` 调用（`{}` 事件首参是 shim 既有契约）；
 *  参数面取 `unknown`——总线不解释载荷，与 `RuntimeIpcService.on`（`runtimeServices.ts:406`）同源。 */
type IpcListener = (...args: unknown[]) => void;

/**
 * 库条目在本模块的消费面。字段**全可选**：条目既可能来自演示种子
 * （`demoSeed.installDemoLibrarySeed` 的字面量），也可能来自桌面桥/backend 的真实载荷，
 * 本模块一律按 `|| 兜底` 读（与修前的裸属性访问同义）。
 */
interface IpcLibraryItem {
  id?: string;
  name?: string;
  ext?: string;
  url?: string;
  tags?: string[];
  folders?: string[];
  annotation?: string;
  width?: number;
  height?: number;
  star?: number;
  /** 自定义缩图标记（`regenerate-thumbnail` 分支读它判「是否需先复位」）。 */
  customThumbnail?: unknown;
  /** 视频缩图的自动任务 id 与时间点（`regenerate-video-thumbnail` 分支读）。 */
  thumbnailTask?: unknown;
  thumbnailAt?: unknown;
}

/** 库快照在本模块的消费面（写点见 `installDemoLibrarySeed`/`applyLibrarySnapshot` 与下方四处赋值）。 */
interface IpcLibrarySnapshot {
  items?: IpcLibraryItem[];
  imagesDir?: string;
  rootDir?: string;
}

/** React 侧 store 观测口（`core/scopeFace.ts` 安装）；`emit` 覆写处的 raw 去重守卫读它。 */
interface IpcScopeRegistryFace {
  read?(key: string): unknown;
}

/**
 * 写状态共享实例的**本模块消费面**（装配面 = `core/ipcWriteState.ts:251-263`，各导出函数签名同源）。
 * `getIpcWriteState()` 自身返回 `any`（该文件不在本批 ownership），此处用具名面取代 `any` 传播。
 */
interface IpcWriteStateFace {
  /**
   * 已设自定义缩略图的条目 id 集（`ipcWriteState.ts:252` 的 `customThumbnailItemIds`）。
   * 三个方法按 `unknown` 收入参：本模块传入的 id 取自动态载荷，运行期类型不限；
   * **不做 `String()` 归一**——`Set.has` 的同值判定本身即「未命中」，归一反而会改变修前的判定结果。
   */
  customThumbnailItemIds: {
    has(value: unknown): boolean;
    add(value: unknown): unknown;
    delete(value: unknown): unknown;
  };
  analyzeItemPalette(item: unknown, options?: unknown): Promise<unknown>;
  scheduleMissingPaletteAnalysis(items: unknown): void;
  /**
   * 本地导入的在飞/落定计数（`ipcWriteState.ts:51` `export function importCounters()`）。
   * 读点：`demoSeed.startCapturePolling` 的抢跑判定（在飞/刚落定 ⇒ 该批条目由导入路径
   * 独家发布，轮询整轮跳过）。形状即该函数的返回字面量。
   */
  importCounters(): { pending: number; settled: number };
  trackLocalImport<T>(promise: Promise<T>): Promise<T>;
  emitImportedItems(items: unknown, channel: string): unknown[];
  mergeCachedItems(items: unknown): unknown[];
}

/**
 * 桌面桥的**本模块消费面**（形状取自 `electron/preload.cjs`，逐成员标注出处行号）。
 * `environment.desktopApi` 只声明了 `library.setHistory`（M2-3 批的消费面），本模块另需约三十个
 * 成员；沿用 `desktopCapability.ts:129-131` 的同款做法**就地具名 + 断言**——不改 `environment.ts`
 * （非本批 ownership），也不借 `any` 传播。桥面成员一律返回 Promise（preload 侧恒 `ipcRenderer.invoke`）。
 */
interface IpcDesktopBridge {
  getCollectWindowData(): Promise<unknown>;                                        // preload.cjs:103
  onIpc(channel: string, callback: (value: unknown) => void): unknown;             // preload.cjs:62
  onRebindRefresh(callback: () => void): unknown;                                  // preload.cjs:142
  library?: {
    current(): Promise<IpcLibrarySnapshot>;                                        // preload.cjs:80
    updateStructure(params: unknown): Promise<IpcLibrarySnapshot>;                 // preload.cjs:83
    create(params: unknown): Promise<IpcLibrarySnapshot>;                          // preload.cjs:84
    switch(libraryPath: unknown): Promise<IpcLibrarySnapshot>;                     // preload.cjs:86
    onChanged(callback: (library: unknown) => void): unknown;                      // preload.cjs:87
    onOperationResult(callback: (result: unknown) => void): unknown;               // preload.cjs:88
  } | null;
  duplicates?: {
    emptyTrash(ids: string[], options: unknown): Promise<unknown>;                 // preload.cjs:131
  } | null;
  clipboard?: {
    import(params: unknown): Promise<unknown>;                                     // preload.cjs:156
  } | null;
  preview?: {
    open(payload: unknown): Promise<unknown>;                                      // preload.cjs:106
    onInit(callback: (payload: unknown) => void): unknown;                          // preload.cjs:107
  } | null;
  item?: {
    openDefault(id: unknown): Promise<unknown>;                                    // preload.cjs:121
    reveal(id: unknown): Promise<unknown>;                                         // preload.cjs:122
    copyImage(id: unknown): Promise<unknown>;                                      // preload.cjs:124
    dragStart(ids: unknown): Promise<unknown>;                                     // preload.cjs:125
    onOperationResult(callback: (result: unknown) => void): unknown;               // preload.cjs:126
  } | null;
  thumbnail?: {
    setCustom(params: unknown): Promise<unknown>;                                  // preload.cjs:145
    resetCustom(params: unknown): Promise<unknown>;                                // preload.cjs:146
    refresh(params: unknown): Promise<unknown>;                                    // preload.cjs:147
    start(params: unknown): Promise<unknown>;                                      // preload.cjs:148
    status(taskId: unknown): Promise<IpcThumbnailJob>;                             // preload.cjs:149
    cancel(taskId: unknown): Promise<unknown>;                                     // preload.cjs:150
  } | null;
  import?: {
    files(params: unknown): Promise<unknown>;                                      // preload.cjs:160
    folders(params: unknown): Promise<unknown>;                                    // preload.cjs:162
    url(params: unknown): Promise<unknown>;                                        // preload.cjs:164
    urls(params: unknown): Promise<unknown>;                                       // preload.cjs:165
    onFileProgress(callback: (job: unknown) => void): unknown;                     // preload.cjs:161
    onFolderProgress(callback: (job: unknown) => void): unknown;                   // preload.cjs:163
  } | null;
  export?: {
    images(params: unknown): Promise<unknown>;                                     // preload.cjs:175
    asFolder(params: unknown): Promise<unknown>;                                   // preload.cjs:176
    eaglepack(params: unknown): Promise<unknown>;                                  // preload.cjs:177
    cancel(jobId?: unknown): Promise<unknown>;                                     // preload.cjs:178
    reveal?(jobId: unknown): Promise<unknown>;                                     // preload.cjs:179
    onProgress(callback: (progress: unknown) => void): unknown;                    // preload.cjs:180
    onComplete(callback: (result: unknown) => void): unknown;                      // preload.cjs:181
  } | null;
  download?: {
    direct(params: unknown): Promise<IpcDownloadResult>;                           // preload.cjs:168
    start(params: unknown): Promise<unknown>;                                      // preload.cjs:169
    status(taskId: unknown): Promise<unknown>;                                     // preload.cjs:170
    cancel(taskId: unknown): Promise<unknown>;                                     // preload.cjs:171
    release(taskId: unknown): Promise<unknown>;                                    // preload.cjs:172
  } | null;
}

/** `thumbnail.status` 的**本模块消费面**（`regenerate-video-thumbnail` 分支的三态判定）。 */
interface IpcThumbnailJob {
  status?: string;
  error?: unknown;
  code?: unknown;
}

/** `download.direct` 的**本模块消费面**（`downloadWithNet`/`downloadWithRequest` 分支取 `result.path`）。 */
interface IpcDownloadResult {
  path?: string;
}

/** 原生 electron 模块的**本模块消费面**（`settingsI18n.ts:152-154` 同源同口径，未导出故就地具名）。 */
interface NativeElectronFace {
  ipcRenderer: {
    send(channel: string, params?: unknown): void;
    invoke(channel: string, params?: unknown): Promise<unknown>;
  };
}

/** 宿主窗口上的**运行期扩展面**（写入方见各成员注释；`global/globals.d.ts` 只声明了其中一部分）。 */
interface IpcBusHostWindow {
  /** 演示/当前库快照（写点：`demoSeed.installDemoLibrarySeed`/`applyLibrarySnapshot`、本文件四处赋值）。 */
  __mockLibrary?: IpcLibrarySnapshot;
  /** 库条目缓存（写点同上；读点遍布总线、桥与 `core/sourceMode.ts`）。 */
  __mockLibraryCache?: IpcLibraryItem[];
  /** React store 观测口（`core/scopeFace.ts` 安装）。 */
  __eagleScopeRegistry?: IpcScopeRegistryFace;
  /** 文档浏览器卸载桥（`core/documentViewer.ts` 安装；见 `emit` 覆写的 library 变更分支）。 */
  __eagleCloseDocumentViewer?: () => unknown;
  /** 最近一次导出任务 id（导出回程写入，`show-item-in-folder` 读）。 */
  __lastExportJobId?: unknown;
  /** 批量操作门面（`core/machinery.ts` 安装；`onRebindRefresh` 回程读其 `rebindRefresh`）。 */
  __eagleMachinery?: { rebindRefresh?: () => unknown };
  /** 回程桥已安装标记（`core/returnBridge.ts` 置位）。 */
  __eagleReturnBridgeInstalled?: unknown;
  /** 预览窗 entry 就绪标记 / 待发 init 载荷（`onInit` 桥的缓冲竞态兜底读写）。 */
  __eaglePreviewEntryReady?: unknown;
  __eaglePendingPreviewInit?: unknown;
  /**
   * Angular 遗留面（`file-uploaded` 去重守卫读）。修前写作 `window.angular ? angular.element(…) : null`
   * ——裸 `angular` 与 `window.angular` 在渲染层是**同一个全局对象**（本文件无同名 import 遮蔽），
   * 故改经本面读取：取值与判定逐字同义，且免去一条 `Cannot find name 'angular'` 的全局声明。
   */
  angular?: { element(node: unknown): { scope(): unknown } };
}

/** 宿主窗口视图（**纯类型窄化**，运行期即 `window` 本身，不做任何包装/代理）。 */
function hostWindow(): IpcBusHostWindow {
  return window as IpcBusHostWindow;
}

/** 桌面桥视图（`environment.desktopApi` 的本模块消费面；无桥为 `null`）。 */
const desktopApi: IpcDesktopBridge | null = rawDesktopApi ? (rawDesktopApi as IpcDesktopBridge) : null;

/**
 * 任意值的**具名成员读取**（与 `environment.ts:212-215` 同名同义，未导出故就地复制）。
 * 与修前的裸属性访问同义：`null`/`undefined` 返回 `undefined`，原始值取成员亦为 `undefined`。
 */
function readMember(value: unknown, key: string): unknown {
  if (value === null || value === undefined) return undefined;
  return (value as Record<string, unknown>)[key];
}

/**
 * 桌面桥回程载荷里的**条目视图**：**与修前 `result && result.item ? result.item : result` 逐字同义**
 * （桥的 setCustom/refresh 有的回 `{item}` 信封、有的直接回条目，见各调用点注释）；
 * 非真值一律 `null`，调用方的 `if (updated && updated.id)` 守卫判据不变。
 */
function resultItem(result: unknown): IpcLibraryItem | null {
  const item = readMember(result, 'item');
  return (item ? item : result) as IpcLibraryItem | null;
}

export class EventEmitter {
  /**
   * 频道 → 监听器表。`declare` 字段：**零运行期发射**——`useDefineForClassFields` 下普通字段声明
   * 会多出一条 `defineProperty(…, undefined)`（修前没有），构造函数体照旧赋值，语义不变。
   */
  declare listeners: Map<string, IpcListener[]>;

  constructor() {
    this.listeners = new Map();
  }

  on(channel: string, callback: IpcListener): this {
    // 与修前的 `if (!has) set([]); get(channel).push(cb)` 逐字同义：`Map.get` 在键缺席时返回
    // `undefined`，而本表的取值恒为数组（真值），故 `|| []` 与 `has` 判定等价；把同一数组再
    // `set` 回同一键是幂等的——省去了一处非空断言，且只查一次表。
    const list = this.listeners.get(channel) || [];
    this.listeners.set(channel, list);
    list.push(callback);
    return this;
  }

  once(channel: string, callback: IpcListener): this {
    const wrap = (...args: unknown[]) => {
      this.off(channel, wrap);
      callback(...args);
    };
    return this.on(channel, wrap);
  }

  off(channel: string, callback: IpcListener): this {
    const list = this.listeners.get(channel) || [];
    this.listeners.set(channel, list.filter((fn) => fn !== callback));
    return this;
  }

  removeAllListeners(channel?: string): this {
    if (channel) this.listeners.delete(channel);
    else this.listeners.clear();
    return this;
  }

  emit(channel: string, ...args: unknown[]): boolean {
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

  send(channel: string, params?: unknown): void {
    if (channel === 'update-main-window-id' || channel === 'check-for-update') return;
    console.debug('[eagle-shim] ipc send', channel, params);
  }

  sendTo(id: unknown, channel: string, params?: unknown): void {
    this.send(channel, params);
  }

  invoke(channel: string, params?: unknown): Promise<unknown> {
    console.debug('[eagle-shim] ipc invoke', channel, params);
    if (channel === 'get-collect-window-data') {
      const host = hostWindow();
      const items = host.__mockLibraryCache || [];
      const item: IpcLibraryItem = items.find((entry) => entry.id === 'MOCK0001') || items[0] || {};
      const lib: IpcLibrarySnapshot = host.__mockLibrary || {};
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
    // M2-1（调研 §C-2 / §E.6）：修前兜底返回 `{canceled:true, filePaths:[], filePath:'', ok:true}`
    // ——调用方**同时**收到「已取消」与「ok:true」，分支逻辑依实现随机走，且任何未登记频道
    // 都被伪造成「调用成功」。调研 §E.6 明令：「未登记频道抛错而非 ipcBus.ts:93 的双语义兜底」。
    // 真实业务态 → 明确 reject；只有 demo 态保留「视为取消」的演示语义。
    const gap = capabilityGap(
      `ipc.invoke(${String(channel || 'unknown')})`,
      '该 invoke 频道未登记任何真实实现（preload/main 均无 handler）',
    );
    if (gap) return Promise.reject(gap);
    return Promise.resolve({ canceled: true, filePaths: [], filePath: '', ok: true });
  }
}

/**
 * 总线单例的**装配面**：`r2r` 是构造后补挂到单例上的方法（见下方赋值），
 * **不是** {@link EventEmitter} 的类成员——故按单例类型（而非 class 字段）声明，
 * 不把「每个 EventEmitter 都有 r2r」这个假陈述写进类面。可选是因为它在赋值前确实缺席。
 */
export interface IpcRendererBus extends EventEmitter {
  /** 跨窗定向回程（签名 `(targetId, channel, params)`；本文件只覆写缩略图两个频道）。 */
  r2r?(targetId: unknown, channel: string, params?: unknown): Promise<unknown>;
}

export const ipcRenderer: IpcRendererBus = new EventEmitter();
export const mockEmit = ipcRenderer.emit.bind(ipcRenderer);
export const emitIpc = ipcRenderer.emit.bind(ipcRenderer);
ipcRenderer.emit = function (channel: string, ...args: unknown[]): boolean {
  const host = hostWindow();
  if (channel === 'file-uploaded' && readMember(args[0], 'id')) {
    try {
      const legacy = host.angular;
      const scope = legacy ? legacy.element(document.body).scope() : null;
      // 实机 QA（2026-09-13）：Angular 退役后 scope 恒 null、守卫空转——补 React 侧
      // store 观测口（__eagleScopeRegistry.read('raw')，与 useItemState.raw 同一数组），
      // 使逐文件桥接与 emitImportedItems 收尾 emit 之间幂等。
      const scopeRaw = readMember(scope, 'raw');
      let rawList: unknown[] | null = Array.isArray(scopeRaw) ? scopeRaw : null;
      if (!rawList) {
        const registry = host.__eagleScopeRegistry;
        const viaRegistry = registry && typeof registry.read === 'function' ? registry.read('raw') : null;
        if (Array.isArray(viaRegistry)) rawList = viaRegistry;
      }
      const uploadedId = readMember(args[0], 'id');
      if (rawList && rawList.some((item) => readMember(item, 'id') === uploadedId)) return true;
    } catch (err) {
      // Fall through to the normal event dispatch.
    }
  }
  if (channel === 'library:changed' || channel === 'preload-library' || channel === 'app-status-library-loaded') {
    // The library (or its items) changed under the document viewer — unmount it.
    // b1-9bz-E8：编排已迁 core/documentViewer.ts（React），经全局桥调用；pre-seam 窗口无桥则无 viewer 可卸载。
    if (typeof host.__eagleCloseDocumentViewer === 'function') {
      host.__eagleCloseDocumentViewer();
    }
  }
  return emitIpc(channel, ...args);
};
export const desktopSendChannels = new Set(['create-library', 'open-library', 'add-to-history-and-open']);

// P1-c-2 / R2：写路径共享状态一律复用 `core/ipcWriteState.ts` 的**同一实例**——主窗 React 启动期
// 经 installIpcWriteState() 安装 window.__eagleIpcWriteState；无 React 的窗口由 getIpcWriteState()
// 惰性自建等价实例。R2 前此处另存一份等价实现（队列/计数器/发布器第二真身），已删除。
export function writeState(): IpcWriteStateFace {
  return getIpcWriteState() as IpcWriteStateFace;
}

export function previewCurrentItemId(): unknown {
  const scope = bodyScope();
  const current = readMember(scope, 'current');
  const id = readMember(current, 'id');
  return id ? id : '';
}

export function dragStartItemIds(params: unknown): string[] {
  const value: Record<string, unknown> = params && typeof params === 'object' ? (params as Record<string, unknown>) : {};
  let images = value.images;
  if (typeof images === 'string') {
    try {
      images = JSON.parse(images);
    } catch (err) {
      images = [];
    }
  }
  const imageIds = Array.isArray(images)
    ? images.map((entry) => (readMember(entry, 'id') || (typeof entry === 'string' ? entry : ''))).filter(Boolean)
    : [];
  const target = value.target;
  const targetId = readMember(target, 'id') || (typeof target === 'string' ? target : '');
  if (targetId) imageIds.unshift(targetId);
  return [...new Set(imageIds.map((id) => String(id)).filter(Boolean))];
}

export function runPreviewAction(action: string, promise: unknown): void {
  Promise.resolve(promise)
    .then((result) => mockEmit('preview:action-result', { ok: true, action, ...(result || {}) as Record<string, unknown> }))
    .catch((err) => mockEmit('preview:action-result', { ok: false, action, error: err.message }));
}

export function isCurrentPreviewRawPath(rawPath: unknown): boolean {
  const scope = bodyScope();
  const current = readMember(scope, 'current');
  const id = readMember(current, 'id');
  const name = readMember(current, 'name');
  const ext = readMember(current, 'ext');
  if (!scope || !current || !id || !name || !ext) return false;
  const expected = `${readMember(scope, 'libraryImagesPath') || ''}/${id}.info/${name}.${ext}`
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/');
  const actual = String(rawPath || '').replace(/\\/g, '/').replace(/\/+/g, '/');
  return expected === actual;
}

ipcRenderer.send = function (channel: string, params?: unknown): void {
  // b1-9ak：smoke:* 测试通道原生直通（未路由通道走 shim 本地总线会进 console.debug
  // 黑洞——menu-popup 闭环测试依赖 main 侧实收）
  if (String(channel || '').indexOf('smoke:') === 0 && nativeRequire) {
    try {
      (nativeRequire('electron') as NativeElectronFace).ipcRenderer.send(channel, params);
    } catch (err) {
      console.warn('[eagle-shim] smoke channel send failed', channel, err);
    }
    return;
  }
  // b1-9as：update-txt-item 原生直通（text-editor 保存 → main 回发各渲染窗 →
  // itemDomain 既有监听更新 itemMappings[id].text；本地总线发不到 main）
  if (channel === 'update-txt-item' && nativeRequire) {
    try {
      (nativeRequire('electron') as NativeElectronFace).ipcRenderer.send(channel, params);
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
      (nativeRequire('electron') as NativeElectronFace).ipcRenderer.send(channel, params);
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
      (nativeRequire('electron') as NativeElectronFace).ipcRenderer.send(channel, params);
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
      (nativeRequire('electron') as NativeElectronFace).ipcRenderer.send(channel, params);
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
      (nativeRequire('electron') as NativeElectronFace).ipcRenderer.send(channel, params);
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
          'global.capture.area': readMember(params, 'screenCaptureShortcut') || '',
          'global.capture.window': readMember(params, 'windowCaptureShortcut') || '',
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
        (nativeRequire('electron') as NativeElectronFace).ipcRenderer.send('open.preferences', params || {});
        return;
      } catch (err) {
        console.warn('[eagle-shim] native preferences IPC unavailable, opening directly', err);
      }
    }
    const query = new URLSearchParams();
    if (params && readMember(params, 'panel')) query.set('panel', String(readMember(params, 'panel')));
    if (params && readMember(params, 'keyword')) query.set('keyword', String(readMember(params, 'keyword')));
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
          hostWindow().__mockLibrary = { ...(hostWindow().__mockLibrary || {}), ...library };
          if (Array.isArray(library.items)) hostWindow().__mockLibraryCache = library.items.slice();
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
      : params && (readMember(params, 'libraryPath') || readMember(params, 'path') || readMember(params, 'libraryDir'));
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
        hostWindow().__mockLibrary = { ...(hostWindow().__mockLibrary || {}), ...library };
        if (Array.isArray(library.items)) hostWindow().__mockLibraryCache = library.items.slice();
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
        hostWindow().__mockLibrary = { ...(hostWindow().__mockLibrary || {}), ...library };
        if (Array.isArray(library.items)) hostWindow().__mockLibraryCache = library.items.slice();
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
    const innerParams = readMember(params, 'params');
    const payload: Record<string, unknown> = innerParams
      ? { ...(innerParams as Record<string, unknown>), folder: readMember(params, 'folder') || readMember(innerParams, 'folder') }
      : (params as Record<string, unknown>) || {};
    if (channel === 'paste-paths') payload.files = Array.isArray(readMember(params, 'files')) ? readMember(params, 'files') : [];
    writeState().trackLocalImport(desktopApi.clipboard.import(payload)).then((items) => writeState().emitImportedItems(items, channel)).catch((err) => {
      mockEmit('import:operation-result', { ok: false, channel, error: err.message });
      mockEmit('file-uploaded-end', { error: err.message });
    });
    return;
  }
  if (desktopApi && desktopApi.preview && channel === 'open-preview-window') {
    // 修前的 `params && params.images`（短路返回 `params` 本身）由 {@link readMember} 承担：
    // 空值/原始值取成员一律 `undefined`，`Array.isArray` 判据不变。
    const rawImages = readMember(params, 'images');
    const images = Array.isArray(rawImages)
      ? rawImages.filter((item) => readMember(item, 'id')).map((item) => structuredClone(item))
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
      const ids: unknown[] = dragStartItemIds(params);
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
    // 桥面的**本地定格**：`desktopApi.thumbnail` 是可写属性，其收窄在嵌套回调（`.then` /
    // `new Promise` 执行器 / `forEach` 回调）内不被保留；定格为 `const` 后收窄随闭包保留。
    // 取值对象与修前逐字同一（桥在 preload 期一次装成，本函数内无写入方），故语义零改动。
    const thumbnailApi = desktopApi.thumbnail;
    if (channel === 'set-custom-thumbnail') {
      const item = readMember(params, 'item');
      thumbnailApi.setCustom({
        itemId: readMember(item, 'id'),
        filePath: readMember(params, 'thumbnailPath'),
        width: readMember(params, 'width'),
        height: readMember(params, 'height'),
      }).then((result) => {
        const updated = resultItem(result);
        if (updated && updated.id) {
          writeState().customThumbnailItemIds.add(updated.id);
          const items = hostWindow().__mockLibraryCache || [];
          const index = items.findIndex((entry) => entry.id === updated.id);
          if (index >= 0) items[index] = updated;
          mockEmit('thumbnail-generated', updated);
        }
      }).catch((err) => mockEmit('thumbnail-operation-error', { action: channel, error: err.message }));
      return;
    }
    if (channel === 'regenerate-video-thumbnail') {
      const video = readMember(params, 'video');
      const itemId = readMember(video, 'id');
      if (itemId) {
        const refresh = () => thumbnailApi.refresh({
          itemId,
          startAt: readMember(params, 'startAt') ?? readMember(video, 'thumbnailAt'),
        });
        const automaticTaskId = readMember(video, 'thumbnailTask');
        const waitForAutomatic = automaticTaskId
          ? new Promise<void>((resolve, reject) => {
              const poll = () => thumbnailApi.status(automaticTaskId).then((status) => {
                if (status.status === 'complete') resolve();
                // `String()` 只做类型层归一：`Error` 构造函数对非字符串 message 恒取 `ToString`，
                // 而 `||` 链末项已保证取值非空，故取值与抛出的错误消息与修前逐字相同。
                else if (status.status === 'failed' || status.status === 'cancelled') reject(new Error(String(status.error || status.code || 'Automatic thumbnail failed')));
                else setTimeout(poll, 50);
              }).catch(reject);
              poll();
            })
          : Promise.resolve();
        waitForAutomatic.then(refresh).then((result) => {
          const updated = resultItem(result);
          if (updated && updated.id) {
            const cached = hostWindow().__mockLibraryCache || [];
            const index = cached.findIndex((entry) => entry.id === updated.id);
            if (index >= 0) cached[index] = updated;
            mockEmit('thumbnail-generated', updated);
          }
        }).catch((err) => mockEmit('thumbnail-operation-error', { action: channel, error: err.message }));
      }
      return;
    }
    if (channel === 'regenerate-thumbnail') {
      const items: IpcLibraryItem[] = Array.isArray(params) ? params : [];
      items.forEach((item) => {
        const itemId = item && item.id;
        const shouldReset = Boolean(itemId && (item.customThumbnail || writeState().customThumbnailItemIds.has(itemId)));
        const action = shouldReset
          ? thumbnailApi.resetCustom({ itemId })
          : thumbnailApi.refresh({ itemId });
        Promise.resolve(action).then((result) => {
          const updated = resultItem(result);
          if (updated && updated.id) {
            if (!updated.customThumbnail) writeState().customThumbnailItemIds.delete(updated.id);
            const cached = hostWindow().__mockLibraryCache || [];
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
    browserImportLocalFiles(readMember(params, 'files') ? readMember(params, 'files') : []).catch(() => {});
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
    let action: Promise<unknown> | null = null;
    if (channel === 'upload-local-files') action = desktopApi.import.files(params || {});
    if (channel === 'upload-url') action = desktopApi.import.url(params || {});
    if (channel === 'upload-urls') action = desktopApi.import.urls(params || []);
    if (channel === 'import-folders') action = desktopApi.import.folders(params || {});
    if (action) {
      writeState().trackLocalImport(Promise.resolve(action))
        .then((result) => {
          const batches: unknown[] = channel === 'import-folders' && Array.isArray(result) ? result : [result];
          // 修前的三层内联三元逐字等价改写为显式分支：`batch && batch.items` / `batch && batch.id`
          // 的读法由 {@link readMember} 承担（原始值/空值取成员一律 `undefined`，判据不变）。
          const items = batches.flatMap((batch) => {
            if (Array.isArray(batch)) return batch;
            const innerItems = readMember(batch, 'items');
            if (Array.isArray(innerItems)) return innerItems;
            return readMember(batch, 'id') ? [batch] : [];
          });
          writeState().emitImportedItems(items, channel);
          if (channel === 'import-folders') {
            // 非空断言 `!`（本文件两处断言之一，另一处在 `send` 的 show-item-in-folder 分支）：
            // 修前此处直接 `desktopApi.library.current()`，
            // 桥面缺 `library` 时取成员即抛 TypeError，由外层 `.catch` 收口成 import:operation-result
            // 错误事件。断言在运行期被抹除，故该失败路径的取值、抛错时机与消息与修前逐字一致；
            // 换成 `if (library)` 守卫会把这条失败路径静默掉（改行为），故不采用。
            desktopApi.library!.current().then((library) => {
              hostWindow().__mockLibrary = { ...hostWindow().__mockLibrary, ...library };
              hostWindow().__mockLibraryCache = Array.isArray(library.items) ? library.items.slice() : hostWindow().__mockLibraryCache;
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
      const exportParams: Record<string, unknown> = (params as Record<string, unknown>) || {};
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
      if (desktopApi.export.reveal && hostWindow().__lastExportJobId) {
        runPreviewAction('show-item-in-folder', desktopApi.export.reveal(hostWindow().__lastExportJobId));
      } else {
        const itemId = previewCurrentItemId();
        // 非空断言 `!`：本分支在 `if (desktopApi && desktopApi.export)` 内，桥面缺 `item` 时修前
        // 即在此处抛 TypeError（**不是**返回假结果）；断言在运行期被抹除，失败路径逐字保留。
        // 换成 `desktopApi.item && …` 守卫会把「能力缺失即明确失败」退回成静默跳过——本项目红线。
        if (itemId) runPreviewAction('show-item-in-folder', desktopApi.item!.reveal(itemId));
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
ipcRenderer.invoke = function (channel: string, params?: unknown): Promise<unknown> {
  // b1-9at：darwin nativeImage 缩图直通（main 侧 b1-9at handle；win32 无效路径不触达）
  if (channel === 'nativeImage.createThumbnailFromPath' && nativeRequire) {
    try {
      return (nativeRequire('electron') as NativeElectronFace).ipcRenderer.invoke(channel, params);
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
    if (channel === 'thumbnail-task:status' && desktopApi.thumbnail) return desktopApi.thumbnail.status(readMember(params, 'taskId') || readMember(params, 'id') || params);
    if (channel === 'thumbnail-task:cancel' && desktopApi.thumbnail) return desktopApi.thumbnail.cancel(readMember(params, 'taskId') || readMember(params, 'id') || params);
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
ipcRenderer.r2r = function (targetId: unknown, channel: string, params?: unknown): Promise<unknown> {
  if (desktopApi && desktopApi.thumbnail) {
    if (channel === 'item.setCustomThumbnail') return desktopApi.thumbnail.setCustom(params || {});
    if (channel === 'item.refreshThumbnail') {
      // 修前的 `params && (params.itemId || params.id)` 逐字等价：`params` 为假值时原式短路返回
      // `params` 本身（含 `0`/`''`），故保留 `params ? … : params` 的三元形状，且读成员只在本
      // 分支内求值（与修前同一时机，不给 Proxy/取值器多一次触发）。
      const refreshTarget = params ? (readMember(params, 'itemId') || readMember(params, 'id')) : params;
      return desktopApi.thumbnail.refresh({ itemId: refreshTarget });
    }
  }
  return Promise.resolve(false);
};

/** E7（P1-c-4）：回程扇出回退注册（React 入口的 core/returnBridge 未安装时才注册）。 */
export function installReturnBridgeFallback() {
  setTimeout(() => {
    const host = hostWindow();
    if (host.__eagleReturnBridgeInstalled) return;
    if (!(desktopApi && typeof desktopApi.onIpc === 'function')) return;
    desktopApi.onIpc('show-item-in-folder', (value) => {
      if (desktopApi.export && desktopApi.export.reveal && host.__lastExportJobId) {
        runPreviewAction('show-item-in-folder', desktopApi.export.reveal(host.__lastExportJobId));
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
      if (readMember(item, 'id')) writeState().mergeCachedItems(item);
      mockEmit('file-uploaded', item);
    });
    // set-custom-thumbnail 的承诺链回程（apiServerDomain machinerySetCustomThumbnail 等
    // thumbnail-generated resolve）+ rebind-refresh 刷新面（miscDomain:522 监听）。
    desktopApi.onIpc('thumbnail-generated', (value) => mockEmit('thumbnail-generated', value));
    desktopApi.onIpc('rebind-refresh', (value) => mockEmit('rebind-refresh', value));
  if (desktopApi && desktopApi.export) {
    if (typeof desktopApi.export.onProgress === 'function') {
      desktopApi.export.onProgress((progress) => {
        const jobId = readMember(progress, 'jobId');
        if (progress && jobId) host.__lastExportJobId = jobId;
      });
    }
    if (typeof desktopApi.export.onComplete === 'function') {
      desktopApi.export.onComplete((result) => {
        const jobId = readMember(result, 'jobId');
        if (result && jobId) host.__lastExportJobId = jobId;
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
      const M = host.__eagleMachinery;
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
      host.__eaglePendingPreviewInit = payload;
      if (host.__eaglePreviewEntryReady) {
        mockEmit('init', payload);
        return;
      }
      const retry = setInterval(() => {
        if (!host.__eaglePreviewEntryReady) return;
        clearInterval(retry);
        mockEmit('init', payload);
      }, 25);
      setTimeout(() => clearInterval(retry), 10000);
    });
  }
  }, 0);
}
