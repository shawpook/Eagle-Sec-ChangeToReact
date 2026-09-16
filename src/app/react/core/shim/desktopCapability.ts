/**
 * R2 桌面能力层：Electron 主/渲染进程 API 的 shim 面（currentWindow/app/dialog/Menu/
 * BrowserWindow/remote/clipboard/shell），以及写文件原子化的受控转接。
 *
 * 迁移自 `core/shimsLegacy.ts` 的 IIFE（原 1838-2303 区间），函数体逐字保留——
 * 有桌面桥时一律转调 `window.eagleDesktop.*`（真实能力面），无桥时回落只读 stub。
 * 依赖 `./ipcBus`（总线实体与预览面助手）、`./browserRuntime`（BrowserBuffer/electronLog）、
 * `./environment`（桌面桥探针）。`windowApi` 系列导出供窗口状态事件与其它模块复用。
 *
 * M2-6 类型化：本文件已撤销整文件 `// @ts-nocheck`。类型面一律对着**真实契约**写——
 * 桌面桥成员取自 `electron/preload.cjs`（逐处标注出处行号），桥载荷取自 `electron/main.cjs`；
 * 运行期形状无法静态假设的（渲染层原生模块探针）一律读成 `unknown` 后在调用点就地窄化。
 * 无新增 `any` / `@ts-ignore` / `@ts-expect-error`，不改门禁，可观察行为零改动。
 */
import {
  capabilityGap, demoFileStore, desktopApi, markUnavailable, nativeRequire, unavailableResult, warnCapability,
} from "./environment";
import { BrowserBuffer, electronLog } from "./browserRuntime";
import { ipcRenderer, isCurrentPreviewRawPath, previewCurrentItemId, runPreviewAction } from "./ipcBus";

/**
 * 宿主窗口上的**运行期扩展面**（本模块实际读到的那两个）。
 *
 * `global/globals.d.ts` 把两者都声明成 `any`；此处用具名 interface + `unknown` 收窄，
 * 手法与 `environment.ts:23-42` 的 `ShimHostWindow` 同源（该文件不属本批 ownership）。
 */
interface DesktopCapabilityHostWindow {
  /** 桌面桥（`electron/preload.cjs:204-212` 经 contextBridge 暴露）。 */
  eagleDesktop?: unknown;
  /** 演示态库对象（生产者：`core/channelBridge.ts:148/219/330` 的合并写入）。 */
  __mockLibrary?: DesktopMockLibraryFace;
}

/** 演示态库对象上本模块读写的成员（`writeFileAtomic`：读根目录转给 `updateStructure`，回写两处结构）。 */
interface DesktopMockLibraryFace {
  rootDir?: string;
  path?: string;
  savedFilters?: unknown;
  tags?: unknown;
}

/** 演示态库根目录（`updateStructure` 的 `libraryPath`；**与修前 `__mockLibrary && (rootDir || path)` 同义**）。 */
function mockLibraryRoot(): string | undefined {
  const library = hostWindow().__mockLibrary;
  return library && (library.rootDir || library.path);
}

function hostWindow(): DesktopCapabilityHostWindow {
  return window as DesktopCapabilityHostWindow;
}

/**
 * 任意值的**具名成员读取**（`environment.ts:212-215` 同款手法的本地副本——原函数未导出，
 * 而本批不得改动 `environment.ts`）。`null`/`undefined` 与原始值取成员均为 `undefined`，
 * 与修前的裸属性访问同义；结果留在 `unknown` 上，迫使调用点显式判定。
 */
function readMember(value: unknown, key: string): unknown {
  if (value === null || value === undefined) return undefined;
  return (value as Record<string, unknown>)[key];
}

/**
 * 从原生模块面取方法并**保留 `this` 绑定**（等价于修前的 `nativeXxx.method(...)` 直调）。
 *
 * 成员缺席或非函数时返回 `null`——与修前的 `typeof nativeXxx.method === 'function'` 守卫同义。
 * 泛型 `A` 只描述调用点已知的参数表；返回值默认 `unknown`，需要更确切契约的调用点显式给 `R`
 * （如 `webFrame.getZoomFactor` 按 Electron 契约声明为 `number`）。
 */
function nativeMethod<A extends unknown[], R = unknown>(target: unknown, key: string): ((...args: A) => R) | null {
  const member = readMember(target, key);
  if (typeof member !== 'function') return null;
  return (...args: A): R => (member as (...a: unknown[]) => R).apply(target, args);
}

/**
 * 桌面桥的**本模块消费面**。
 *
 * `environment.desktopApi` 只声明了它自己用到的那部分（`library.setHistory`，见
 * `environment.ts:120-131`）；本模块消费的是同一个运行期对象上的另外几组成员，形状取自
 * `electron/preload.cjs`：
 *  - `dialog.open` / `dialog.save`（`:91` / `:93`，`ipcRenderer.invoke`，恒返回 Promise）；
 *  - `item.copyPath`（`:123`，fire-and-forget 的按钮回调路径）；
 *  - `clipboard.readSync`（`:155`，`sendSync`；载荷见 `electron/main.cjs:1264-1272`）；
 *  - `library.updateStructure`（`:83`，`ipcRenderer.invoke`，恒返回 Promise）。
 */
interface DesktopCapabilityBridge {
  readonly library?: DesktopLibraryWriteFace | null;
  readonly dialog?: DesktopDialogFace | null;
  readonly item?: DesktopItemFace | null;
  readonly clipboard?: DesktopClipboardFace | null;
}

/** `library.updateStructure` 的入参（消费点见本文件 `writeFileAtomic`，逐字保留原实参）。 */
interface DesktopStructureUpdateParams {
  libraryPath: string | undefined;
  savedFilters?: unknown;
  tags?: unknown;
}

interface DesktopLibraryWriteFace {
  updateStructure(params: DesktopStructureUpdateParams): Promise<unknown>;
}

interface DesktopDialogFace {
  open(options: unknown): Promise<unknown>;
  save(options: unknown): Promise<unknown>;
}

interface DesktopItemFace {
  copyPath(id: unknown): unknown;
}

/** `clipboard:read-sync` 的载荷（`electron/main.cjs:1264-1272` 逐字形状；字段可缺席）。 */
interface DesktopClipboardReadResult {
  text?: string;
  imageDataUrl?: string;
  filePaths?: string[];
  formats?: string[];
}

interface DesktopClipboardFace {
  readSync(): DesktopClipboardReadResult;
}

/**
 * 经 `environment.desktopApi`（同一运行期对象的**局部视图**）取本模块的消费面。
 * 与修前的 `desktopApi && desktopApi.x` 同一真值判据：桥为空则整面为 `null`。
 */
const desktopBridge: DesktopCapabilityBridge | null = desktopApi
  ? (desktopApi as DesktopCapabilityBridge)
  : null;

/**
 * 桌面桥的**窗口组**面（`electron/preload.cjs:184-201`）。成员一律可选——桥未必装配齐全，
 * 本文件全部调用点照旧逐个判定（判定失败走能力缺口降级，见 `windowVisibilityGap`）。
 */
interface DesktopWindowFace {
  isMaximized(): unknown;
  isFullScreen(): unknown;
  hide?(): unknown;
  show?(): unknown;
  close?(): unknown;
  minimize?(): unknown;
  maximize?(): unknown;
  unmaximize?(): unknown;
  focus?(): unknown;
  blur?(): unknown;
  setFullScreen?(value: unknown): unknown;
  setAlwaysOnTop?(value: unknown): unknown;
  reload?(): unknown;
  forceReload?(): unknown;
  toggleDevTools?(): unknown;
  resetZoom?(): unknown;
  zoomIn?(): unknown;
  zoomOut?(): unknown;
  quit?(): unknown;
  onStateChanged?(callback: (state: DesktopWindowState) => void): unknown;
}

/** `window:state-changed` 载荷（两字段按布尔判定，见 `wireWindowStateEvents`）。 */
interface DesktopWindowState {
  maximized?: unknown;
  fullScreen?: unknown;
}

/** 窗口事件监听器回调（`emitWindowEvent` 以 `(event, ...args)` 调用，`event` 恒为 `{}`——与修前一致）。 */
type WindowEventCallback = (...args: unknown[]) => void;

/** 取桌面桥的窗口组；**与修前 `(window.eagleDesktop && window.eagleDesktop.window) || null` 逐字同义**。 */
export function windowApi(): DesktopWindowFace | null {
  const bridge = hostWindow().eagleDesktop;
  const win = bridge ? readMember(bridge, 'window') : null;
  return win ? (win as DesktopWindowFace) : null;
}

/**
 * M2-1（调研 §C-17 / §E.5）：`hide/show/focus/blur` 在 `preload.cjs:177-194` 与
 * `main.cjs` 的 `window:action` switch 中**均无实现**——修前是静默 no-op，预览窗显隐、
 * 筛选面板聚焦全部无声失效。补真实实现须改 `electron/**`（本批不可触碰），故按调研 §E.5
 * 的规定做**显式降级**：登记 `window.visibility` 为不可用（`RuntimeCapabilities.window.visibility === false`）
 * 并单次告警，由调用方按能力位门控入口，而不再是不留痕迹的空操作。
 */
function windowVisibilityGap(capability: string) {
  warnCapability(capability, '窗口显隐无 preload/main 实现（调研 §E.5：需补 window:action case）；本批声明降级待接线');
}

/**
 * M2-1：渲染层可达的**真实** Electron 模块面（探针）。
 *
 * 关键区分——`window.require` 在装配期已被 `install.ts` 换成 shim 的 `requireModule`，
 * 而 `requireModule('electron')` 返回的**正是本文件的替身对象**（`moduleRegistry.ts:136`）。
 * 所以「消费者 require 到的是替身」这件事本身不等于「渲染层拿不到真模块」：宿主原生 require
 * 由 `environment.nativeRequire`（求值期定格，早于覆盖）持有，`sandbox:false` +
 * `nodeIntegration:true`（`electron/main.cjs:801-807`）下渲染层确实能 require electron——
 * 本文件早就用同一路径取 `webFrame`（确属渲染层模块）。
 *
 * 但**哪些模块在渲染层真的导出**不能靠假设：Electron 只把渲染层模块（`webFrame`/
 * `ipcRenderer`/`clipboard`/`nativeImage`…）放进来，主进程模块（`app`/`shell`/`dialog`）通常缺席。
 * 故此处一律**运行时探针**：探到即接真实现，探不到才声明缺口——两个方向都不猜。
 * 本批无法在 Electron 实机跑，探针在实机上会自行给出结论（见交付说明「实机未验证」）。
 *
 * 类型注记：探到的模块面形状不可静态假设，故返回 `unknown`——调用方一律经
 * {@link readMember} / {@link nativeMethod} 窄化后再用。
 */
export function nativeElectronExport(name: string): unknown {
  if (!nativeRequire) return null;
  try {
    const mod = nativeRequire('electron');
    const value = readMember(mod, name);
    if (!value) return null;
    return typeof value === 'object' || typeof value === 'function' ? value : null;
  } catch (err) {
    return null; // 非 electron 运行态 / 模块不可达——由调用方按缺口处理。
  }
}

const windowListeners = new Map<string, WindowEventCallback[]>();
export const windowState = (() => {
  const api = windowApi();
  return {
    maximized: api ? Boolean(api.isMaximized()) : false,
    fullScreen: api ? Boolean(api.isFullScreen()) : false,
  };
})();

export function addWindowListener(channel: string, callback: WindowEventCallback): void {
  // 与修前 `if (!has) set(channel, [])` + `get(channel).push(cb)` 等价（同一数组回写同一键）。
  const list = windowListeners.get(channel) || [];
  list.push(callback);
  windowListeners.set(channel, list);
}

export function emitWindowEvent(channel: string, ...args: unknown[]): void {
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

export const currentWindow = {
  id: 1,
  getTitle: () => 'Eagle',
  isDestroyed: () => false,
  isMaximized: () => windowState.maximized,
  isFullScreen: () => windowState.fullScreen,
  hide() {
    const api = windowApi();
    if (api && typeof api.hide === 'function') api.hide();
    else windowVisibilityGap('window.hide');
  },
  show() {
    const api = windowApi();
    if (api && typeof api.show === 'function') api.show();
    else windowVisibilityGap('window.show');
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
  setFullScreen(value: unknown) {
    const api = windowApi();
    if (api && typeof api.setFullScreen === 'function') {
      api.setFullScreen(value);
      windowState.fullScreen = Boolean(value);
    }
  },
  setAlwaysOnTop(value: unknown) {
    const api = windowApi();
    if (api && typeof api.setAlwaysOnTop === 'function') api.setAlwaysOnTop(value);
  },
  getOpacity: () => 1,
  setOpacity() {},
  focus() {
    const api = windowApi();
    if (api && typeof api.focus === 'function') api.focus();
    else windowVisibilityGap('window.focus');
  },
  blur() {
    const api = windowApi();
    if (api && typeof api.blur === 'function') api.blur();
    else windowVisibilityGap('window.blur');
  },
  getBounds: () => ({ x: 0, y: 0, width: 1280, height: 720 }),
  setBounds() {},
  setMinimumSize() {},
  setSize() {},
  getSize: () => [1280, 720],
  on(channel: string, callback: WindowEventCallback) {
    addWindowListener(channel, callback);
    return this;
  },
  once(channel: string, callback: WindowEventCallback) {
    const wrap = (...args: unknown[]) => {
      this.removeListener(channel, wrap);
      callback(...args);
    };
    return this.on(channel, wrap);
  },
  addListener(channel: string, callback: WindowEventCallback) {
    return this.on(channel, callback);
  },
  removeListener(channel: string, callback: WindowEventCallback) {
    const list = windowListeners.get(channel) || [];
    windowListeners.set(channel, list.filter((entry) => entry !== callback));
    return this;
  },
  emit(channel: string, ...args: unknown[]) {
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

/**
 * M2-1（调研 §C-18/19/20）：`app` 面修前恒返回 `/mock-user-data` / `isPackaged:false`，
 * 与宿主真值无关。取证结论：
 *  - `app` 属**主进程模块**，渲染层的 `require('electron')` 通常不导出它（由
 *    {@link nativeElectronExport} 运行时探针判定，不做静态假设）；
 *  - `@electron/remote` **不在** `package.json` 依赖内、`electron/main.cjs` 亦未初始化；
 *  - 既有 preload 面 `eagleDesktop.getAppInfo()`（`preload.cjs:61`）只回
 *    `{name,version,electron,platform}`，不含路径与 `isPackaged`，且为异步
 *    （`app.getPath` 是同步契约，改签名会波及既有消费者）。
 * 真值不可得时按调研 §E.5 同款做法**显式降级**：登记缺口 + 单次告警，并保留既有回落值
 * 使真实流程不中断。补真值须改 `electron/preload.cjs` / `electron/main.cjs`（本批不可触碰）→ 遗留清单。
 */
function appPathGap(capability: string) {
  warnCapability(capability, '渲染层无 app 真值来源（app 为主进程模块、无 @electron/remote）；需 preload 补路径 IPC');
}

/** 演示态 / 无真值来源时的路径回落（与修前逐字一致，仅在降级后使用）。 */
const APP_PATH_FALLBACK = '/mock-user-data';

export const app = {
  get isPackaged() {
    const nativeApp = nativeElectronExport('app');
    const isPackaged = readMember(nativeApp, 'isPackaged');
    if (typeof isPackaged === 'boolean') return isPackaged;
    appPathGap('app.isPackaged');
    return false;
  },
  getPath(name: string) {
    const nativeApp = nativeElectronExport('app');
    const nativeGetPath = nativeMethod<[string]>(nativeApp, 'getPath');
    if (nativeGetPath) {
      try {
        const value = nativeGetPath(name);
        if (typeof value === 'string' && value) return value;
      } catch (err) {
        // 未知 name 或主进程拒绝：落到下面的显式降级。
      }
    }
    appPathGap(`app.getPath(${String(name || 'unknown')})`);
    return APP_PATH_FALLBACK;
  },
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

export const nativeTheme = { shouldUseDarkColors: false, on() {}, off() {} };

/** 对话框选项：`(options)` 与 `(window, options)` 两种调用形态共用（判定逐字保留）。 */
function dialogOptions(first: unknown, second: unknown): unknown {
  return second && typeof second === 'object'
    ? second
    : (first && typeof first === 'object' && !readMember(first, 'webContents') ? first : {});
}

/**
 * M2-1（调研 §C-37）：对话框兜底修前恒为 `{canceled:true, filePaths:[]}` / `{response:0}`
 * ——**「用户取消」与「无对话框能力」不可区分**，导入/导出路径选择在无桌面桥时静默什么都不做。
 * 现在真实业务态明确 reject；只有 demo 态保留「视为取消」的演示语义。
 */
function dialogFallback(capability: string, demoValue: unknown) {
  const err = capabilityGap(capability, '无桌面桥对话框能力（本运行态无原生文件选择器）');
  return err ? Promise.reject(err) : Promise.resolve(demoValue);
}

export const dialog = {
  showOpenDialog(first: unknown, second: unknown) {
    const options = dialogOptions(first, second);
    if (desktopBridge && desktopBridge.dialog) return desktopBridge.dialog.open(options);
    // 渲染层探到真 dialog 模块时接真实现（`dialog` 属主进程模块，通常探不到——不假设）。
    const nativeDlg = nativeElectronExport('dialog');
    const nativeOpenDialog = nativeMethod<[unknown]>(nativeDlg, 'showOpenDialog');
    if (nativeOpenDialog) return nativeOpenDialog(options);
    return dialogFallback('dialog.showOpenDialog', { canceled: true, filePaths: [] });
  },
  showSaveDialog(first: unknown, second: unknown) {
    const options = dialogOptions(first, second);
    if (desktopBridge && desktopBridge.dialog) return desktopBridge.dialog.save(options);
    const nativeDlg = nativeElectronExport('dialog');
    const nativeSaveDialog = nativeMethod<[unknown]>(nativeDlg, 'showSaveDialog');
    if (nativeSaveDialog) return nativeSaveDialog(options);
    return dialogFallback('dialog.showSaveDialog', { canceled: true, filePath: '' });
  },
  // M2-1：`{response:0}` 会被确认框消费者当作「用户点了第一个按钮（通常是确定）」——同属
  // 「无实现返回成功」。真实业务态明确失败，由调用方按失败处理。
  showMessageBox(...args: unknown[]) {
    const nativeDlg = nativeElectronExport('dialog');
    const nativeShowMessageBox = nativeMethod<unknown[]>(nativeDlg, 'showMessageBox');
    if (nativeShowMessageBox) return nativeShowMessageBox(...args);
    return dialogFallback('dialog.showMessageBox', { response: 0 });
  },
};

export class MenuItem {
  /** 类型声明面（运行期与修前一致：先 `Object.assign` 平铺选项，再落 `submenu`）。 */
  declare submenu: unknown;

  constructor(options: Record<string, unknown> = {}) {
    Object.assign(this, options);
    this.submenu = options.submenu || [];
  }

  append(item: unknown) {
    (this.submenu as unknown[]).push(item);
  }
}

let applicationMenu: ShimMenuFace | null = null;

/** shim 菜单面（`createShimMenu` 产物；`popup` 转投全局 `ContextMenu`）。 */
interface ShimMenuFace {
  items: Record<string, unknown>[];
  showSearch: boolean;
  popup?: () => void;
  append?: () => void;
}

export function getRoleClick(role: string): (() => void) | null {
  const winApi = () => windowApi();
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

function normalizeMenuItems(items: unknown): Record<string, unknown>[] {
  const list = Array.isArray(items) ? (items as unknown[]) : [];
  return list.map((item) => {
    if (!item) return { role: 'separator' };
    if (readMember(item, 'type') === 'separator' || readMember(item, 'role') === 'separator') return { role: 'separator' };

    const normalized: Record<string, unknown> = { ...(item as Record<string, unknown>) };
    delete normalized.type;

    const submenu = normalized.submenu;
    if (Array.isArray(submenu)) {
      normalized.submenu = { items: normalizeMenuItems(submenu), showSearch: false };
    } else if (submenu && typeof submenu === 'object' && Array.isArray(readMember(submenu, 'items'))) {
      normalized.submenu = { ...(submenu as Record<string, unknown>), items: normalizeMenuItems(readMember(submenu, 'items')) };
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

/**
 * 全局上下文菜单面。
 *
 * 取证：本仓 TS/JS 面内**没有** `ContextMenu` 的写入点（`collect-window/contextMenu.tsx`
 * 导出的是同名 ES 类，走 `import`，与这个裸全局无关；`window.__eagleCollectContextMenu`
 * 是另一个对象）。即原 bundle 依赖的是外部/宿主供给的全局，本仓运行期多为 `undefined`。
 * 原判定的 `typeof ContextMenu !== 'undefined'` 因此是一条**恒假分支**（保留不删——本批不得
 * 移除无替代方案的旧代码）；此处只补类型形状，不改判定。
 */
declare const ContextMenu: { open?: (options: unknown) => unknown } | undefined;

function createShimMenu(template: unknown): ShimMenuFace {
  const menu: ShimMenuFace = { items: normalizeMenuItems(template || []), showSearch: false };
  menu.popup = () => {
    if (typeof ContextMenu !== 'undefined' && typeof ContextMenu.open === 'function') {
      ContextMenu.open({ items: menu.items, showSearch: false });
    }
  };
  menu.append = () => {};
  return menu;
}

export const Menu = {
  buildFromTemplate: (template: unknown) => createShimMenu(template),
  setApplicationMenu(menu: ShimMenuFace | null) {
    applicationMenu = menu;
  },
  getApplicationMenu: (): ShimMenuFace => applicationMenu || createShimMenu([]),
};

export class BrowserWindow {
  /**
   * 类型声明面：`declare` 零运行期产物，构造器内赋值与修前逐字保持不变
   * （TS 不因构造器赋值而推断实例字段，故此处必须显式声明）。
   */
  declare webContents: { id: number; on(): void; send(): void; executeJavaScript(): Promise<string> };
  declare on: () => this;
  declare hide: () => this;
  declare show: () => this;
  declare destroy: () => this;
  declare close: () => this;

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

export const remote = {
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
  require: (id: unknown) => (String(id || '').includes('electron-log') ? electronLog : {}),
};

// M2-1（调研 §C-20）：`@electron/remote`（`remote` 导出）是 class stub——本仓 `package.json`
// **未声明** `@electron/remote`，`electron/main.cjs` 亦未初始化，渲染层拿不到真实 remote，
// 故 `remote.app.getPath` 等一律走本文件的降级面（见 `app`）。此处显式登记缺口，
// 使消费者/诊断面板可查 `capabilities.remote === false`，而不再误以为拿到了主进程代理。
markUnavailable('remote.*', '无 @electron/remote 依赖与初始化；主进程代理不可得，需改 electron/** 接线');

/** 无桥 / 读失败时的剪贴板回落载荷（**每次新建**，与修前的字面量逐字同义，避免调用方改动共享对象）。 */
function clipboardReadFallback(): DesktopClipboardReadResult {
  return { text: '', imageDataUrl: '', filePaths: [], formats: [] };
}

function readDesktopClipboardSync(): DesktopClipboardReadResult {
  if (!desktopBridge || !desktopBridge.clipboard || typeof desktopBridge.clipboard.readSync !== 'function') {
    return clipboardReadFallback();
  }
  try {
    return desktopBridge.clipboard.readSync() || clipboardReadFallback();
  } catch (err) {
    return clipboardReadFallback();
  }
}

function clipboardImageFromDataUrl(dataUrl: string | undefined) {
  const match = /^data:image\/[^;,]+;base64,(.*)$/s.exec(String(dataUrl || ''));
  // `BrowserBuffer.from` 的推断签名要求两个形参（`browserRuntime.ts:157`），而第二形参
  // `encoding` 在该实现体内**从未被读取**；此处显式传 `undefined` 只为满足签名，行为零改动。
  const bytes = match ? BrowserBuffer.from(atob(match[1]), undefined) : BrowserBuffer.alloc(0);
  return {
    isEmpty: () => bytes.length === 0,
    toPNG: () => bytes,
    toJPEG: () => bytes,
    toDataURL: () => dataUrl || '',
    getSize: () => ({ width: bytes.length > 0 ? 1 : 0, height: bytes.length > 0 ? 1 : 0 }),
  };
}

export const electron = {
  ipcRenderer,
  webFrame: {
    setZoomFactor(factor: unknown) {
      if (nativeRequire) {
        try {
          const nativeWebFrame = readMember(nativeRequire('electron'), 'webFrame');
          const nativeSetZoomFactor = nativeMethod<[number]>(nativeWebFrame, 'setZoomFactor');
          if (nativeSetZoomFactor) {
            nativeSetZoomFactor(Number(factor) || 1);
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
          const nativeWebFrame = readMember(nativeRequire('electron'), 'webFrame');
          // Electron 契约：`webFrame.getZoomFactor(): number`，故此处显式给出返回类型。
          const nativeGetZoomFactor = nativeMethod<[], number>(nativeWebFrame, 'getZoomFactor');
          if (nativeGetZoomFactor) {
            return nativeGetZoomFactor();
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
    // M2-1（调研 §C-15/16）：仅「预览窗当前项原始路径」这一条经 `item.copyPath` 有真实实现；
    // 其余写面（复制 item URL / 复制路径 / 复制图片）在 `preload.cjs` 中**没有写能力**
    // （该桥只暴露 `read`/`readSync`/`import`，无 `clipboard:write*` handler）——修前静默无效，
    // 而调用方仍弹「复制成功」通知（`itemDomain.ts:800-803`）。
    // 显式降级：登记 `clipboard.writeText`/`writeImage` 缺口 + 单次告警，由调用方按能力位门控；
    // 不抛错是因为这些调用点是 fire-and-forget 的按钮回调（抛错会变成 unhandledrejection）。
    // 探针先行：Electron 渲染层（`sandbox:false`）确实导出 `clipboard` 时**接真实现**，
    // 只有探不到才声明缺口。两个方向都不猜——声明一个不存在的缺口与假装成功同样有害。
    writeText(text: unknown) {
      if (desktopBridge && desktopBridge.item && isCurrentPreviewRawPath(text)) {
        runPreviewAction('copy-path', desktopBridge.item.copyPath(previewCurrentItemId()));
        return true;
      }
      const nativeClipboard = nativeElectronExport('clipboard');
      const nativeWriteText = nativeMethod<[string]>(nativeClipboard, 'writeText');
      if (nativeWriteText) {
        nativeWriteText(String(text == null ? '' : text));
        return true;
      }
      warnCapability('clipboard.writeText', 'preload 无剪贴板写能力（仅有 read/readSync/import），渲染层亦无 clipboard 模块');
      return false;
    },
    readText: () => readDesktopClipboardSync().text || '',
    writeImage(image: unknown) {
      const nativeClipboard = nativeElectronExport('clipboard');
      const nativeWriteImage = nativeMethod<[unknown]>(nativeClipboard, 'writeImage');
      if (nativeWriteImage && image) {
        nativeWriteImage(image);
        return true;
      }
      warnCapability('clipboard.writeImage', 'preload 无剪贴板写能力；渲染层亦无 clipboard 模块');
      return false;
    },
    readImage: () => clipboardImageFromDataUrl(readDesktopClipboardSync().imageDataUrl),
    clear() {
      const nativeClipboard = nativeElectronExport('clipboard');
      const nativeClear = nativeMethod<[]>(nativeClipboard, 'clear');
      if (nativeClear) {
        nativeClear();
        return true;
      }
      warnCapability('clipboard.clear', 'preload 无剪贴板写能力（仅有 read/readSync/import），渲染层亦无 clipboard 模块');
      return false;
    },
    availableFormats: () => readDesktopClipboardSync().formats || [],
  },
  /**
   * M2-1（调研 §C-12/13/14）：`shell.*` 在渲染层**无任何真实实现**——`preload.cjs` 无 `shell` 组，
   * `electron/main.cjs` 无 `shell:*` handler（主进程只在内部用 `shell.openPath`/`showItemInFolder`，
   * `electron/main.cjs:374/383/392`）。修前返回 `Promise.resolve()` 使「在浏览器打开」「定位文件」
   * 静默无效而无从察觉。真实修复须改 `electron/**`（本批不可触碰）→ 按调研 §E.9 显式声明
   * `capabilities.shell.{external,path,reveal} === false` 并返回带 `unavailable` 标记的结果，
   * 由消费者门控入口（对偶修复记入遗留清单）。
   */
  shell: {
    openExternal(url: unknown) {
      const nativeShell = nativeElectronExport('shell');
      const nativeOpenExternal = nativeMethod<[string]>(nativeShell, 'openExternal');
      if (nativeOpenExternal) {
        return Promise.resolve(nativeOpenExternal(String(url || ''))).then(() => undefined);
      }
      warnCapability('shell.openExternal', 'preload/main 均无 shell 面，渲染层亦无 shell 模块（shell 为主进程模块）');
      return Promise.resolve(unavailableResult('shell.openExternal', `无法打开 ${String(url || '')}`));
    },
    openPath(target: unknown) {
      const nativeShell = nativeElectronExport('shell');
      const nativeOpenPath = nativeMethod<[string]>(nativeShell, 'openPath');
      if (nativeOpenPath) {
        return Promise.resolve(nativeOpenPath(String(target || ''))).then((message) => {
          // Electron 契约：成功返回空串，失败返回错误描述——原样透传，不吞错。
          if (message) return unavailableResult('shell.openPath', String(message));
          return undefined;
        });
      }
      warnCapability('shell.openPath', 'preload/main 均无 shell 面，渲染层亦无 shell 模块（shell 为主进程模块）');
      return Promise.resolve(unavailableResult('shell.openPath', `无法打开 ${String(target || '')}`));
    },
    showItemInFolder(target: unknown) {
      const nativeShell = nativeElectronExport('shell');
      const nativeShowItemInFolder = nativeMethod<[string]>(nativeShell, 'showItemInFolder');
      if (nativeShowItemInFolder) {
        nativeShowItemInFolder(String(target || ''));
        return undefined;
      }
      warnCapability('shell.showItemInFolder', 'preload 的 item.reveal 未接线此面，渲染层亦无 shell 模块');
      return unavailableResult('shell.showItemInFolder', '定位文件能力不可用');
    },
    beep() {
      const nativeShell = nativeElectronExport('shell');
      const nativeBeep = nativeMethod<[]>(nativeShell, 'beep');
      if (nativeBeep) {
        nativeBeep();
        return undefined;
      }
      warnCapability('shell.beep', 'preload/main 均无 shell 面，渲染层亦无 shell 模块');
      return unavailableResult('shell.beep', '系统提示音能力不可用');
    },
  },
};

/**
 * 演示态的**内存写存储**（`kind === 'demo'` 专用）。
 *
 * 定义在环境层（`environment.demoFileStore`，与 `browserRuntime.fsModule` 共享同一实例，
 * 避免环境层之上的循环依赖）；此处再导出一次，供本模块既有消费者沿用同一入口。
 */
export { demoFileStore };

/** 原子写回调（Node `fs` 风格：成功 `null`，失败 `Error`；消费者见 `core/runtimeServices.ts:575`）。 */
type WriteFileCallback = (err: unknown) => void;

export function writeFileAtomic(file: string, data: unknown, cb?: WriteFileCallback | null): void {
  const target = String(file || '').replace(/\\/g, '/');
  if (desktopBridge && desktopBridge.library && target.endsWith('/saved-filters.json')) {
    // Electron 下把原版 writeFileAtomic 的 saved-filters 写入转接到受控结构接口。
    let savedFilters: unknown;
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
    desktopBridge.library.updateStructure({
      libraryPath: mockLibraryRoot(),
      savedFilters,
    }).then(() => {
      const library = hostWindow().__mockLibrary;
      if (library) library.savedFilters = savedFilters;
      if (typeof cb === 'function') cb(null);
    }).catch((err) => {
      if (typeof cb === 'function') cb(err);
    });
    return;
  }
  if (desktopBridge && desktopBridge.library && target.endsWith('/tags.json')) {
    let tags: unknown;
    try {
      tags = typeof data === 'string' ? JSON.parse(data) : data;
    } catch (err) {
      if (typeof cb === 'function') setTimeout(() => cb(err), 0);
      return;
    }
    desktopBridge.library.updateStructure({
      libraryPath: mockLibraryRoot(),
      tags,
    }).then(() => {
      const library = hostWindow().__mockLibrary;
      if (library) library.tags = tags;
      if (typeof cb === 'function') cb(null);
    }).catch((err) => {
      if (typeof cb === 'function') cb(err);
    });
    return;
  }
  // ── 其余路径：修前 `setTimeout(cb, 0)` = **假成功**（调研 §C-11）────────────────
  // 写盘「成功」但磁盘上无任何变化，重启后设置丢失且无从察觉。调研 §E.4 明令：
  // 「**禁止** setTimeout(cb,0) 假成功：无法实现时必须 reject，让 UI 显示真实失败」。
  // 真实业务态无通用原子写能力（preload 仅 `fs:list`/`fs:read`，写侧缺口需新增 `fs:write` IPC），
  // 故回调明确错误；demo 态写入内存演示存储（**不落盘**）。
  const err = capabilityGap(
    `writeFileAtomic(${target})`,
    '无通用原子写能力：preload 仅暴露 fs:list/fs:read，写侧缺口需新增 fs:write IPC（调研 §E.4）',
  );
  if (err) {
    if (typeof cb === 'function') setTimeout(() => cb(err), 0);
    else throw err;
    return;
  }
  demoFileStore()[target] = typeof data === 'string' ? data : String(data);
  if (typeof cb === 'function') setTimeout(cb, 0);
}
