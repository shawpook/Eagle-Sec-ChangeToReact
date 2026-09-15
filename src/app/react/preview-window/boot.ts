/**
 * M1-F04：预览窗 boot 的**模块图内**安装面。
 *
 * 迁移前，这些全局由 `src/app/preview-window.html` `<head>` 的内联经典脚本供给。实测
 * （真实 Electron + CDP，2026-09-15，见 F04 报告）该内联脚本在解析期 `require(appRoot + '/config.js')`
 * 一行即抛 `Uncaught ReferenceError: appRoot is not defined`——`appRoot` 原是该页已退役的
 * `preview-window.js` 顶层 const 形成的全局词法绑定，React 化后页面加载期无人定义它。后果：
 * 紧随的 `js/global.js` 在第 1 行同样中止，`EagleConfig` 之后的全局面
 * （electron/shell/clipboard/ipcRenderer/remote/fse/electronSettings）**从未被安装**，只有
 * `path`/`fs`（抛错点之前）与 `devicesMetrics` 存活。整套供给实际是死代码。
 *
 * 本模块把该供给搬进模块图，并**显式声明依赖与顺序**，不再依赖「页面顶部的经典脚本已经跑过」：
 *
 *   1. 文件顶部 `import '../core/shimsLegacy'` 是本模块的**前置契约**：boot 只通过 shim 的
 *      `window.require`（`moduleRegistry.requireModule`）取模块，故 shim 必须先完成装配
 *      （ESM 依赖求值顺序保证：shimsLegacy 在本模块主体之前求值完毕）。
 *   2. 模块求值末尾自带 `installPreviewBoot()` 副作用；`entry.tsx` 把本模块的 import 放在
 *      `./controller` **之前**，因此 controller 模块求值期读取的全局（`req('path')`、
 *      `req('@electron/remote')`、`window.videojs`）看到的已是安装后的值。
 *   3. `assertPreviewBootInstalled()` 在 `createRoot()` 之前调用：必需面缺失即抛错，把
 *      「顺序不变式」变成可验证断言而非约定。
 *
 * **覆盖策略：只补缺，不覆盖。** shim 已供给的面（electron/ipcRenderer/electronSettings/
 * EagleConfig）原样采用——内联脚本在 Electron 下从未成功装过它们，覆盖等于换源。
 */

// 前置契约：boot 的载入器就是 shim 的 requireModule，因此 shim 必须先装配。
// （本 import 只读取 shim，不修改 shim 层任何实现。）
import '../core/shimsLegacy';

/** 必需面：缺失即契约破损，`assertPreviewBootInstalled()` 抛错。 */
const REQUIRED_PREVIEW_BOOT_GLOBALS = [
  'path', 'fs', 'EagleConfig', 'electron', 'shell', 'clipboard', 'ipcRenderer',
] as const;

/**
 * 可选面：源模块在本仓可能不可解析——`@electron/remote` 未在 main 侧 initialize/enable、
 * `fs-extra` 不在渲染层依赖表。缺席时静默跳过，与内联脚本的 try/catch 语义逐字一致。
 */
const OPTIONAL_PREVIEW_BOOT_GLOBALS = [
  'fse', 'remote', 'Menu', 'MenuItem', 'currentWindow', 'electronSettings',
] as const;

/** 内联脚本供给面的完整清单（顺序即安装顺序），静态契约测试以此为准。 */
export const PREVIEW_BOOT_GLOBALS = [
  ...REQUIRED_PREVIEW_BOOT_GLOBALS,
  ...OPTIONAL_PREVIEW_BOOT_GLOBALS,
] as const;

export type PreviewBootGlobal = (typeof PREVIEW_BOOT_GLOBALS)[number];

/**
 * 安装报告。落盘在 `window.__eaglePreviewBoot`，供 e2e 探针与故障定位读取
 * （「装过什么 / 谁供的 / 什么缺席」必须是可观测事实，而不是靠猜）。
 */
export interface PreviewBootReport {
  /** 载入器来源：`require` = shim 的 requireModule；`none` = 连它都没有（页面被单独打开）。 */
  loader: 'require' | 'none';
  /** 本模块写入的全局（内联脚本的原供给面）。 */
  installed: string[];
  /** shim 已供给、本模块未动的全局。 */
  adopted: string[];
  /** 可选面缺席：源模块不可解析或产物是 genericStub。 */
  skipped: string[];
}

type ModuleLoader = (name: string) => unknown;

interface PreviewBootHost {
  require?: ModuleLoader;
  __eaglePreviewBoot?: PreviewBootReport;
  [key: string]: unknown;
}

const host = window as unknown as PreviewBootHost;

/** 安全属性读取：`unknown` 源上取成员，非对象一律 undefined。（不引入 any） */
function pick(source: unknown, key: string): unknown {
  if (typeof source !== 'object' || source === null) return undefined;
  return (source as Record<string, unknown>)[key];
}

/** 安全无参调用：成员不是函数或调用抛错时返回 undefined。 */
function call(source: unknown, key: string): unknown {
  const fn = pick(source, key);
  if (typeof fn !== 'function') return undefined;
  try {
    return (fn as () => unknown)();
  } catch (err) {
    return undefined;
  }
}

/**
 * `genericStub`（shim/browserRuntime.ts）的产物是「什么都答应的函数」，带 `__mockName` 标记。
 * 把它装到窗口上会让消费方误以为第三方模块真的存在——本模块一律按缺席处理。
 */
function isGeneratedStub(value: unknown): boolean {
  if (typeof value !== 'function') return false;
  return typeof (value as { __mockName?: unknown }).__mockName === 'string';
}

function resolveModuleLoader(): ModuleLoader | null {
  const loader = host.require;
  return typeof loader === 'function' ? loader : null;
}

/**
 * 幂等安装。返回报告；重复调用返回同一份报告（不重复写入，也不覆盖已安装值）。
 */
export function installPreviewBoot(): PreviewBootReport {
  const done = host.__eaglePreviewBoot;
  if (done) return done;

  const load = resolveModuleLoader();
  const report: PreviewBootReport = {
    loader: load ? 'require' : 'none',
    installed: [],
    adopted: [],
    skipped: [],
  };
  host.__eaglePreviewBoot = report;
  if (!load) {
    report.skipped.push(...PREVIEW_BOOT_GLOBALS);
    return report;
  }

  const appRoot = typeof host.appRoot === 'string' ? host.appRoot : '';
  const read = (name: string): unknown => {
    try {
      const value = load(name);
      return isGeneratedStub(value) ? undefined : value;
    } catch (err) {
      return undefined;
    }
  };
  const write = (key: string, value: unknown): boolean => {
    if (value === undefined) return false;
    host[key] = value;
    report.installed.push(key);
    return true;
  };
  /** 可选面：缺席不抛错，记进报告。 */
  const writeOptional = (key: string, value: unknown): void => {
    if (!write(key, value)) report.skipped.push(key);
  };
  /** shim 已供给的面：原样采用，只补缺。 */
  const adopt = (key: string, value: unknown): void => {
    if (host[key] !== undefined) { report.adopted.push(key); return; }
    if (!write(key, value)) report.skipped.push(key);
  };

  // ① path / fs —— 内联脚本第 21-22 行。shim 不供给这两个；requireModule 在 Electron 下对
  //    'path'/'fs' 直接转原生 require，故此处拿到的仍是原生模块对象（与迁移前同源同值）。
  write('path', read('path'));
  write('fs', read('fs'));

  // ② EagleConfig —— 内联脚本第 25 行（原经裸 appRoot 拼路径，即本次的故障点）。shim §⑧ 已按
  //    requireModule(appRoot + '/config.js') 供给；此处只补缺，避免换掉 controller 的
  //    VIDEO/AUDIO/MODEL/FONT/URL_TYPES 表来源。
  adopt('EagleConfig', appRoot ? read(`${appRoot}/config.js`) : undefined);

  // ③ fse —— 内联脚本第 26 行（原 try/catch，fs-extra 缺席时静默）。按可选面处理。
  writeOptional('fse', read('fs-extra'));

  // ④ electron 及其派生面 —— 内联脚本第 27-30 行。shim 供给 window.electron；
  //    shell/clipboard 由本模块派生（与 controller.ts 的 req('electron') 同源同对象）。
  adopt('electron', read('electron'));
  const electronSurface = host.electron !== undefined ? host.electron : undefined;
  writeOptional('shell', pick(electronSurface, 'shell'));
  writeOptional('clipboard', pick(electronSurface, 'clipboard'));
  adopt('ipcRenderer', pick(electronSurface, 'ipcRenderer'));

  // ⑤ remote / Menu / MenuItem / currentWindow —— 内联脚本第 32-36 行。原 require('@electron/remote')
  //    在 Electron 的 try/catch 里从未成功：本仓 main 侧不 initialize/enable @electron/remote。
  //    渲染层可用面即 shim 的 desktopCapability.remote —— controller.ts / shell.tsx 消费的也是它。
  const remote = read('@electron/remote');
  writeOptional('remote', remote);
  writeOptional('Menu', pick(remote, 'Menu'));
  writeOptional('MenuItem', pick(remote, 'MenuItem'));
  writeOptional('currentWindow', call(remote, 'getCurrentWindow'));

  // ⑥ electronSettings —— 内联脚本第 39 行。shim §④ 已供给同一对象；此处只补缺。
  adopt('electronSettings', appRoot ? read(`${appRoot}/my_modules/electron-settings`) : undefined);

  // ⑦ **刻意不迁移**：内联脚本第 36/38 行的 USER_DATA_PATH / EAGLE_THUMBNAIL_TEMP_PATH。
  //    原脚本只在 require('@electron/remote') 成功时才给这两个赋值，而该 require 在本仓
  //    Electron 下从未成功（见 ⑤）——即二者迁移前就一直是 undefined。现在唯一能拿到 remote 的
  //    通道是 shim 的 desktopCapability，其 app.getPath('userData') 恒为 '/mock-user-data'，
  //    照搬会在 Electron 下把**演示态 mock 路径**写成真值，且与 shim/install.ts 第 72-77 行
  //    「EAGLE_THUMBNAIL_TEMP_PATH 仅浏览器预览态注入」的显式取舍直接冲突。预览闭包内亦无消费者
  //    （controller.ts 自持同名局部量）。故维持不安装，避免用假值掩盖真值。

  return report;
}

/**
 * 顺序不变式断言：必需面全部到位才允许 React 挂载。
 * 缺失即抛——宁可启动期显式失败，也不要让半装状态静默流入 controller 的模块求值。
 */
export function assertPreviewBootInstalled(): void {
  const report = host.__eaglePreviewBoot;
  if (!report) {
    throw new Error('[eagle-preview-boot] installPreviewBoot() 未执行：entry.tsx 必须在 ./controller 之前 import ./boot');
  }
  const missing = REQUIRED_PREVIEW_BOOT_GLOBALS.filter((key) => host[key] === undefined);
  if (missing.length > 0) {
    throw new Error(`[eagle-preview-boot] 必需全局缺失（loader=${report.loader}）：${missing.join(', ')}`);
  }
}

// 模块求值期即安装：entry.tsx 对本模块的 import 排在 ./controller 之前，ESM 保证本文件
// 主体在 controller 主体之前求值完毕——这就是「先安装、后求值」的顺序保证本身。
installPreviewBoot();
