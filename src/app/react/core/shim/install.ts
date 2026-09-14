// @ts-nocheck
/**
 * R2 启动契约装配（shim 层唯一入口）。
 *
 * 原实现是单个 2936 行 IIFE（`core/shimsLegacy.ts`）：定义即求值、无显式安装/释放边界、
 * 运行模式靠散落的 `!window.eagleDesktop` 隐式判定。R2 后：
 *  - 职责按环境/浏览器适配/模块加载/设置 i18n/事件 IPC/桌面能力/演示态分到 `shim/*.ts`；
 *  - **装配显式化**：本文件 `installLegacyShimContract()` 按原 IIFE 的求值顺序调用各层装配函数，
 *    幂等（`window.__eagleBrowserShimLoaded` 守卫），并返回 `teardown()` 释放计时器/监听器；
 *  - **模式显式化**：演示种子只在 `resolveRuntimeMode() === 'demo'` 时安装。
 *
 * 铁律：`window.process/Buffer/global/require/electron/ipcRenderer/electronSettings/pluginModule/
 * i18n/EagleConfig/settings/preferences` 以及各事件时序（'initial'→'app-status-loading'→
 * 'preload-library'→'app-status-library-loaded'）逐字保留——这是 React 模块图的启动前置契约。
 */
import { isElectronRuntime, nativeRequire, resolveRuntimeMode, resolveWindowClass } from "./environment";
import {
  BrowserBuffer, installBrowserFetchRewrite, installMediaDurationPatch, pluginModule, syncText,
} from "./browserRuntime";
import { appRootModule, bareModules, installPinyinModules, populateBareModules, requireModule } from "./moduleRegistry";
import { currentPreferences, electronSettings, handleSettingsStorage, syncNativePreferences } from "./settingsI18n";
import { ipcRenderer, installReturnBridgeFallback } from "./ipcBus";
import { electron } from "./desktopCapability";
import {
  disposeDemoTimers, installDemoLibrarySeed, installDuplicateCheckerGuard, installLifecycleWiring,
} from "./demoSeed";

function noopTeardown() { /* 已安装：返回空释放体，保证调用方总能拿到可调用的 teardown */ }

export function installLegacyShimContract() {
  if (window.__eagleBrowserShimLoaded) return noopTeardown;
  window.__eagleBrowserShimLoaded = true;

  const mode = resolveRuntimeMode();
  const windowClass = resolveWindowClass();
  const cleanups: Array<() => void> = [];
  (window as any).__eagleShim = { mode, windowClass, installedAt: Date.now() };

  // ── ① 演示态种子（原 `if (!window.eagleDesktop) { ... }` 块；语义等价于 mode === 'demo'）──
  if (mode === 'demo') installDemoLibrarySeed();

  // ── ② 浏览器适配（原 519-554，早于其余装配）────────────────────────────────
  installBrowserFetchRewrite();
  installMediaDurationPatch();

  // ── ③ 模块装配表 + 反编译目录模块（原 2669-2892）──────────────────────────
  populateBareModules();
  installPinyinModules();

  // ── ④ 全局启动契约（原 2954-3007 逐字）────────────────────────────────────
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
  window.require = requireModule;
  window.__eagleRequire = requireModule;
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
    const timer = setTimeout(() => syncNativePreferences(currentPreferences()), 250);
    cleanups.push(() => clearTimeout(timer));
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
  const tinyPinyinGuardStop = setTimeout(() => clearInterval(tinyPinyinGuard), 6000);
  cleanups.push(() => { clearInterval(tinyPinyinGuard); clearTimeout(tinyPinyinGuardStop); });

  // ── ⑤ 偏好跨窗同步（原 2626 `window.addEventListener('storage', ...)`）──────
  window.addEventListener('storage', handleSettingsStorage);
  cleanups.push(() => window.removeEventListener('storage', handleSettingsStorage));

  // ── ⑥ 回程扇出回退注册（原 1727-1837 的 0ms timer）──────────────────────────
  installReturnBridgeFallback();
  cleanups.push(disposeDemoTimers);

  // ── ⑦ 重复检测门面保鲜 + 生命周期接线（原 3067-3070、3371-3383）──────────────
  installDuplicateCheckerGuard();
  installLifecycleWiring();

  // ── ⑧ 解析期内联 boot 的等价供给（原 3385-3400）────────────────────────────
  try {
    if (!window.appRoot) window.appRoot = requireModule('app-root-path');
    if (!window.i18n) window.i18n = new (requireModule(appRootModule.path + '/i18n'))();
    if (!window.EagleConfig) window.EagleConfig = requireModule(appRootModule.path + '/config.js');
    // collect-window 内联 boot 的等价供给（原经 require('/src/my_modules/electron-settings')）
    if (!window.settings) window.settings = requireModule(appRootModule.path + '/my_modules/electron-settings');
    if (!window.preferences) window.preferences = window.settings.getPreferences();
  } catch (err) {
    console.warn('[eagle-shim] legacy boot replication failed', err);
  }

  const teardown = () => {
    for (const fn of cleanups.splice(0)) {
      try { fn(); } catch (err) { /* 释放尽力而为，不阻塞后续 */ }
    }
    delete (window as any).__eagleBrowserShimLoaded;
  };
  (window as any).__eagleShim.teardown = teardown;
  return teardown;
}
