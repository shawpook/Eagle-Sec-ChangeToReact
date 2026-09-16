/* 全局类型声明：补齐浏览器 shims / preload 暴露的全局对象类型。 */
import type { CollectItem } from "../collect-window/api/collectItem";
import type { PinyinliteModule, TinyPinyinModule } from "../core/shim/moduleRegistry";
import type { ElectronSettingsFace, PreferenceRecord } from "../core/shim/settingsI18n";

export {};

declare global {
  const process: any;
  interface Window {
    i18n: any;
    eagle: any;
    eagleDesktop: any;
    electronSettings: any;
    $bodyScope?: any;
    languageBCP?: string;
    module?: any;
    __eagleMockI18n?: any;
    __mockLibrary?: any;
    $$electronIpc?: any;
    __eagleIpc?: any;
    __EAGLE_API_BASE_URL?: string;
    __EAGLE_EXTENSION_BASE_URL?: string;
    __EAGLE_THUMBNAIL_URL?: string;
    dragCheck?: boolean;
    fuzzy_match?: (text: string, search: string) => string;

    /* ── M2-5：具名全局声明面 ────────────────────────────────────────────────
     * 本区只**新增**字段，不改动上面的既有字段（它们多为 `any`，属更大范围的债）。
     * 两类来源：
     *  ① `core/shim/install.ts` 的写入面——该文件是本区绝大多数全局的**唯一写入点**；
     *     声明于此，它才能在撤销 `@ts-nocheck` 后逐字保留原写入表达式、不新增任何 cast。
     *  ② D20 遗留的三个「由别处生产、被多窗读取」的动态全局（`preferences` / `CollectItem` /
     *     `__eaglePreferencesEntryReady`），见各自注释。
     * 形状一律取自**既有模块**（`import type` 具名引用）或在本文件就地具名定义，
     * 不新造第二套；生产者仍在 `@ts-nocheck` 下的（`browserRuntime` / `desktopCapability` /
     * `ipcBus`）暂声明为 `unknown`——不把它们的隐式 `any` 签名搬进全局面，
     * 收窄留给各自撤销 `@ts-nocheck` 的批次。
     */

    /**
     * shim 安装标志对象；由 `installLegacyShimContract()` 写入。形状的**单一事实源**是该
     * 文件自身导出的 `EagleShimInstallFace`（shim 模块须自包含，不反向依赖本 d.ts）。
     */
    __eagleShim?: import("../core/shim/install").EagleShimInstallFace;
    /** 装配幂等守卫：安装完成置 `true`，teardown 时 `delete`。 */
    __eagleBrowserShimLoaded?: boolean;
    /**
     * 进程对象。electron 态由宿主（nodeIntegration）提供；浏览器态由 install 期补**替身**，
     * 形状即 `install.ts` 里那个字面量（只覆盖 shim 层实际读到的成员）。
     */
    process?: EagleMockProcess;
    /** `browserRuntime.BrowserBuffer`（生产者仍 `@ts-nocheck`；受检子树内无读取方）。 */
    Buffer?: unknown;
    /** Node 风格全局自指别名（`window.global = window`）。 */
    global?: Window & typeof globalThis;
    /** mock 缩图临时目录：仅浏览器预览态写入；electron 态由 `bundleGlobals` 接管。 */
    EAGLE_THUMBNAIL_TEMP_PATH?: string;
    /** `moduleRegistry.requireModule`（shim 的 require 链入口；`__eagleRequire` 同源同签名）。 */
    require?: typeof import("../core/shim/moduleRegistry").requireModule;
    __eagleRequire?: typeof import("../core/shim/moduleRegistry").requireModule;
    /** `desktopCapability.electron` 门面（生产者仍 `@ts-nocheck`）。 */
    electron?: unknown;
    /** `ipcBus.ipcRenderer` 单一总线（生产者仍 `@ts-nocheck`）。 */
    ipcRenderer?: unknown;
    /** `browserRuntime.syncText`（生产者仍 `@ts-nocheck`）。 */
    __eagleSyncText?: unknown;
    /** `browserRuntime.pluginModule` 插件模块单例（生产者仍 `@ts-nocheck`）。 */
    pluginModule?: unknown;
    /**
     * 拼音模块：形状取自 `moduleRegistry.TinyPinyinModule` / `PinyinliteModule`（单一事实源）。
     * 写入方是 `bareModules`（`Record<string, unknown>` 取项），故由 install 期窄化后落盘。
     */
    tinyPinyin?: TinyPinyinModule;
    pinyinlite?: PinyinliteModule;
    /** `require('app-root-path')` 的供给面（`moduleRegistry.appRootModule`）。 */
    appRoot?: unknown;
    /** `require('/src/config.js')` 的供给面（消费方在未受检的旧脚本内）。 */
    EagleConfig?: unknown;
    /**
     * `require('/src/my_modules/electron-settings')` 的供给面：`moduleRegistry` 截获表把它
     * 解析为 `settingsI18n.electronSettings`（同一实例）。
     */
    settings?: ElectronSettingsFace;
    /**
     * D20①：全局偏好树。生产者有两处——`install.ts` 的 `installLegacyShimContract()`
     * （`window.settings.getPreferences()`）与偏好窗自身的保存路径；两个消费者分别是
     * `collect-window/controller.ts`（`theme`）与 `collect-window/api/i18n.ts`（`general.language`）。
     * 形状直接取 `settingsI18n.PreferenceRecord`（偏好树的单一事实源），不另立一套。
     */
    preferences?: PreferenceRecord;
    /**
     * D20②：采集项的全局构造器。生产者是 `collect-window/api/install.ts`
     * （`w.CollectItem = CollectItem`，对应 index.html 原内联脚本），
     * 消费者是 `collect-window/controller.ts`（`typeof === 'function'` 守卫后 `new`）。
     * 类型直接取 `collect-window/api/collectItem.ts` 的类，不另立一套。
     */
    CollectItem?: typeof CollectItem;
    /**
     * D20③：偏好窗 entry 的「监听器已挂载」标记（写入即 ready，卸载即复位）。
     * 消费者是 `core/shim/demoSeed.ts` 的偏好页 init 发射时序判定。
     */
    __eaglePreferencesEntryReady?: boolean;
  }

  /**
   * 浏览器态 `window.process` **替身**的形状——逐字对应 `install.ts` 里的对象字面量，
   * 只列 shim 层与其下游实际读到的成员（`env` / `versions` / `process.*` 内存与 CPU 面）。
   * electron 态走宿主真实 `process`，不在此形状的约束范围内（该分支不写入）。
   */
  interface EagleMockProcess {
    platform: string;
    arch: string;
    env: { SYSTEMROOT: string };
    resourcesPath: string;
    versions: { electron: string; node: string };
    release: string;
    getProcessMemoryInfo(): Promise<{ workingSetSize: number }>;
    getSystemMemoryInfo(): { total: number };
    getCPUUsage(): { percentCPUUsage: number };
    cwd(): string;
    pid: number;
    ppid: number;
    on(): void;
    once(): void;
    removeListener(): void;
    nextTick(callback: (...args: unknown[]) => void, ...args: unknown[]): void;
  }

  // 与旧版 DOM 属性逐字一致所需的自定义属性（Angular 指令名在 React 中以原生属性输出）。
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      key: any;
      s: any;
      'plugin-view': any;
      'web-view': any;
      'mpv-video': any;
      'ext-icon': any;
      'select-panel': any;
      'select-panel-list': any;
      'select-panel-overlay': any;
      'general-tag-select-panel': any;
      'inspector-tag-select-panel': any;
      group: any;
      item: any;
      'inspector-plugin-view': any;
      'tag-select-panel': any;
      'context-menu': any;
      'library-switcher': any;
    }
  }
  interface HTMLAttributes<T> {
    tippy?: string;
    'tippy-content'?: string;
    'tippy-placement'?: string;
    'library-icon'?: string;
    'library-path'?: string;
    parent?: string;
    resizable?: string;
    'on-resize'?: string;
    'auto-focus'?: string;
    selectall?: string;
    'comment-item'?: string;
    'comments-container'?: string;
    'crop-image'?: string;
    'tif-img'?: string;
    'tga-img'?: string;
    'controls-mode'?: string;
    'comment-video'?: string;
    duration?: any;
    'no-line-breaks'?: string;
  }
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {}
}
