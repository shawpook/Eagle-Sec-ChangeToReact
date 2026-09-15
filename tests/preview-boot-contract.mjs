/**
 * M1-F04：**预览窗 boot 契约测试**（静态接线 + 真实模块隔离运行）。
 *
 * 背景：迁移前，预览窗在一组全局（path/fs/EagleConfig/electron/shell/clipboard/ipcRenderer/remote/
 * Menu/MenuItem/currentWindow/electronSettings）由 `preview-window.html` 的**内联经典脚本**供给，
 * 且该脚本在解析期因裸 `appRoot` 未定义而整体中止——供给实际从未成功。本测试守护本次迁移的三件事：
 *
 *   第一组（静态接线）：内联 boot 已消失；boot 安装面由 entry.tsx **显式依赖**且排在 ./controller
 *   之前；`createRoot()` 之前有可验证断言；被删的 marker 副作用没有留在 global.js。
 *
 *   第二组（真实模块运行）：用 `typescript` 内存转译 `src/app/react/preview-window/boot.ts` 的本体，
 *   在 `node:vm` 隔离上下文里注入**假 window**执行 —— 断言的不是文本，而是 `installPreviewBoot()`
 *   的真实返回报告与真实写入结果：只补缺不覆盖（adopted）、可选面缺席不抛错（skipped）、
 *   genericStub 产物不得被当成真模块装上去、幂等、以及必需面缺失时 `assertPreviewBootInstalled()`
 *   必须抛错。boot.ts 对 shim 的唯一引用是副作用 import，本测试以**依赖闸门**注桩（未登记依赖直接失败）。
 *
 * 注意（如实声明）：本文件是**单元/静态**验证，不起 Electron、不起 Vite。预览窗的真实运行时行为
 * 由 F04 报告中的 CDP 探针（真实 Electron + `--smoke-preview-delivery`）另行取证。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const HTML_PATH = 'src/app/preview-window.html';
const ENTRY_PATH = 'src/app/react/preview-window/entry.tsx';
const BOOT_PATH = 'src/app/react/preview-window/boot.ts';
const GLOBAL_JS_PATH = 'src/app/js/global.js';
const SHIMS_LEGACY_PATH = '../core/shimsLegacy';

function read(rel) {
  return fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
}

const htmlSource = read(HTML_PATH);
const entrySource = read(ENTRY_PATH);
const bootSource = read(BOOT_PATH);
const globalJsSource = read(GLOBAL_JS_PATH);

/** vm 内构造的数组跨 realm 比较会因原型不同而失败，统一在本 realm 重建。 */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * 转译真实 boot.ts 后在隔离 vm 中加载。`window` 以假对象注入；`../core/shimsLegacy`
 * 是纯副作用 import（boot 只读它装出来的 `window.require`），故注桩即可 —— 任何其它
 * require 都是未登记依赖，直接断言失败，避免「测到替身而不是被测代码」。
 */
const bootTranspiled = (() => {
  const { outputText, diagnostics } = ts.transpileModule(bootSource, {
    fileName: BOOT_PATH,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  assert.equal(diagnostics.length, 0, `${BOOT_PATH} 转译应无诊断`);
  return outputText;
})();

function loadBoot(fakeWindow) {
  const exports = {};
  vm.runInNewContext(bootTranspiled, {
    window: fakeWindow,
    exports,
    module: { exports },
    require(name) {
      assert.equal(name, SHIMS_LEGACY_PATH, `禁止加载未隔离的依赖：${name}`);
      return {};
    },
  }, { filename: BOOT_PATH });
  return exports;
}

/** 记录调用序列的载入器；未登记的模块名返回 undefined（等价于 requireModule 回落失败）。 */
function makeLoader(modules) {
  const calls = [];
  const load = (name) => {
    calls.push(name);
    return Object.hasOwn(modules, name) ? modules[name] : undefined;
  };
  load.calls = calls;
  return load;
}

/* =====================================================================================
   第一组：静态接线
   ===================================================================================== */

test('F04-静态：preview-window.html 不再含内联 boot 脚本', () => {
  const inlineScripts = [...htmlSource.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1]);
  assert.deepEqual(
    inlineScripts.filter((body) => /require\s*\(/.test(body)),
    [],
    '内联脚本不得再直接 require —— boot 供给已归 src/app/react/preview-window/boot.ts',
  );
  assert.ok(
    !/window\s*\.\s*(path|fs|EagleConfig|electron|REMOTE)\s*=/.test(htmlSource),
    'html 不得再直接给 boot 全局赋值',
  );
});

test('F04-静态：html 保留模块入口并逐条声明经典脚本顺序契约', () => {
  const moduleTagIndex = htmlSource.indexOf('/src/app/react/preview-window/entry.tsx');
  assert.ok(moduleTagIndex > 0, 'html 必须仍以模块脚本加载 entry.tsx');
  // 顺序契约本身（③）：video.js 必须解析期执行且早于模块标签——controller 的
  // initVideoJsOverrides() IIFE 在模块求值期读 window.videojs，缺席即静默失效。
  const videoJsIndex = htmlSource.indexOf('js/vendors/videojs/video.js');
  assert.ok(videoJsIndex > 0 && videoJsIndex < moduleTagIndex, 'video.js 必须早于模块标签');
  for (const lang of ['en.js', 'zh_TW.js', 'zh_CN.js', 'ko_KR.js', 'ja_JP.js']) {
    assert.ok(htmlSource.includes(`js/vendors/videojs/lang/${lang}`), `语言包 ${lang} 不得被摘除`);
  }
  // 契约的三条声明必须写在 html 里，而不是只存在于提交信息或报告里。
  assert.match(htmlSource, /经典脚本顺序契约/, 'html 必须声明经典脚本顺序契约');
  assert.match(htmlSource, /js\/global\.js/, 'global.js 的加载期局限须在 html 中声明');
  assert.match(htmlSource, /js\/devices\.js/, 'devices.js 的保留理由须在 html 中声明');
});

test('F04-静态：entry.tsx 显式依赖 ./boot 且排在 ./controller 之前', () => {
  const bootImportIndex = entrySource.indexOf("from './boot'");
  const controllerImportIndex = entrySource.indexOf("from './controller'");
  assert.ok(bootImportIndex > 0, 'entry.tsx 必须显式 import ./boot');
  assert.ok(controllerImportIndex > 0, 'entry.tsx 必须仍 import ./controller');
  assert.ok(
    bootImportIndex < controllerImportIndex,
    './boot 必须排在 ./controller 之前 —— controller 模块求值期就读 boot 全局',
  );
  // 顺序不变式断言必须在 React 挂载之前。
  const assertIndex = entrySource.indexOf('assertPreviewBootInstalled()');
  const mountIndex = entrySource.indexOf('createRoot(');
  assert.ok(assertIndex > 0, 'entry.tsx 必须在挂载前调用 assertPreviewBootInstalled()');
  assert.ok(assertIndex < mountIndex, '断言必须早于 createRoot()');
});

test('F04-静态：global.js 的 marker 副作用已删除', () => {
  // 只认「代码行」：注释里的墓碑说明（记明删了什么、为什么）不算残留。
  const codeLines = globalJsSource
    .split('\n')
    .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'));
  const code = codeLines.join('\n');
  assert.ok(!code.includes('eagle-reverse-marker'), 'marker 写入块应已删除');
  assert.ok(!code.includes('EAGLE-REVERSE-OK'), 'marker 写入块应已删除');
  // 只删副作用：其余工具函数必须原样在位。
  for (const kept of ['moveToCursorPosition', 'getRawPath', 'getThumbnailPath', 'getClipboardImage']) {
    assert.ok(globalJsSource.includes(kept), `${kept} 不得被误删`);
  }
});

test('F04-静态：boot.ts 不引入 any / ts-ignore / ts-nocheck', () => {
  assert.ok(!/@ts-(nocheck|ignore|expect-error)/.test(bootSource), 'boot.ts 不得使用 ts 抑制指令');
  assert.ok(!/\bas\s+any\b|:\s*any\b|<any>/.test(bootSource), 'boot.ts 不得新增 any');
});

/* =====================================================================================
   第二组：真实模块隔离运行（假 window，跑真 installPreviewBoot）
   ===================================================================================== */

/** 与 shim 供给面同形的假依赖：electron/ipcRenderer/electronSettings/EagleConfig 由 shim 预置。 */
function makeElectronLikeWindow(extraModules = {}) {
  const pathModule = { normalize: (value) => value, join: (...parts) => parts.join('/') };
  const fsModule = { writeFileSync() {} };
  const shimElectron = {
    ipcRenderer: { on() {}, send() {} },
    shell: { openExternal: () => Promise.resolve() },
    clipboard: { readText: () => '' },
  };
  const shimRemote = { Menu: { buildFromTemplate: () => ({}) }, MenuItem: class MenuItem {}, getCurrentWindow: () => ({ id: 1 }) };
  const settings = { getPreferences: () => ({}) };
  const config = { VIDEO_FORMATS: ['jpg', 'mp4'] };
  const loader = makeLoader({
    path: pathModule,
    fs: fsModule,
    electron: shimElectron,
    '@electron/remote': shimRemote,
    '/src/my_modules/electron-settings': settings,
    ...extraModules,
  });
  const fakeWindow = {
    require: loader,
    appRoot: '/src',
    // shim §④/§⑧ 先于 boot 装好的面（boot 必须 adopt 而非覆盖）：
    electron: shimElectron,
    ipcRenderer: shimElectron.ipcRenderer,
    electronSettings: settings,
    EagleConfig: config,
  };
  return { fakeWindow, loader, pathModule, fsModule, shimElectron, shimRemote, settings, config };
}

test('F04-运行：安装面覆盖内联脚本原供给，且只补缺不覆盖 shim 已供给的面', () => {
  const { fakeWindow, pathModule, shimElectron, shimRemote, settings, config } = makeElectronLikeWindow();
  const boot = loadBoot(fakeWindow);
  const report = fakeWindow.__eaglePreviewBoot;

  assert.equal(report.loader, 'require');
  assert.deepEqual(
    plain(report.installed),
    ['path', 'fs', 'shell', 'clipboard', 'remote', 'Menu', 'MenuItem', 'currentWindow'],
    'boot 应写入的正是内联脚本原供给面中 shim 未供给的部分',
  );
  assert.deepEqual(
    plain(report.adopted),
    ['EagleConfig', 'electron', 'ipcRenderer', 'electronSettings'],
    'shim 已供给的面必须原样采用，不得换源',
  );
  assert.deepEqual(plain(report.skipped), ['fse'], 'fs-extra 不可解析时按可选面跳过');

  // 值层面：同源同对象，且 shim 面未被替换。
  assert.equal(fakeWindow.path, pathModule);
  assert.equal(fakeWindow.electron, shimElectron);
  assert.equal(fakeWindow.EagleConfig, config);
  assert.equal(fakeWindow.electronSettings, settings);
  assert.equal(fakeWindow.clipboard, shimElectron.clipboard);
  assert.equal(fakeWindow.shell, shimElectron.shell);
  assert.equal(fakeWindow.remote, shimRemote);
  assert.equal(fakeWindow.Menu, shimRemote.Menu);
  assert.equal(fakeWindow.currentWindow.id, 1);

  // 契约清单与安装面一一对应（静态文本 + 运行期报告双向对齐）。
  assert.deepEqual(plain(boot.PREVIEW_BOOT_GLOBALS), [
    'path', 'fs', 'EagleConfig', 'electron', 'shell', 'clipboard', 'ipcRenderer',
    'fse', 'remote', 'Menu', 'MenuItem', 'currentWindow', 'electronSettings',
  ]);
  for (const name of boot.PREVIEW_BOOT_GLOBALS) {
    assert.match(
      bootSource,
      new RegExp(`(write|writeOptional|adopt)\\('${name}'`),
      `PREVIEW_BOOT_GLOBALS 的 ${name} 必须有对应安装调用`,
    );
  }

  boot.assertPreviewBootInstalled();
});

test('F04-运行：USER_DATA_PATH / EAGLE_THUMBNAIL_TEMP_PATH 刻意不安装（不臆造 mock 真值）', () => {
  const { fakeWindow } = makeElectronLikeWindow();
  loadBoot(fakeWindow);
  assert.equal(fakeWindow.USER_DATA_PATH, undefined);
  assert.equal(fakeWindow.EAGLE_THUMBNAIL_TEMP_PATH, undefined);
  assert.ok(
    !/USER_DATA_PATH|EAGLE_THUMBNAIL_TEMP_PATH/.test(
      bootSource.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n').split('⑦')[0],
    ),
    '注释之外不得出现这两个全局的赋值',
  );
});

test('F04-运行：genericStub 产物不得被当作真模块装到 window 上', () => {
  const stub = () => stub;
  stub.__mockName = 'fs-extra';
  const { fakeWindow, loader } = makeElectronLikeWindow({ 'fs-extra': stub });
  loadBoot(fakeWindow);
  assert.equal(fakeWindow.fse, undefined, 'genericStub 产物必须按缺席处理');
  assert.ok(loader.calls.includes('fs-extra'));
  assert.deepEqual(plain(fakeWindow.__eaglePreviewBoot.skipped), ['fse']);
});

test('F04-运行：幂等 —— 重复调用返回同一份报告且不再写入', () => {
  const { fakeWindow, loader } = makeElectronLikeWindow();
  const boot = loadBoot(fakeWindow);
  const first = fakeWindow.__eaglePreviewBoot;
  const callsAfterLoad = loader.calls.length;
  const second = boot.installPreviewBoot();
  assert.equal(second, first, '重复安装必须返回同一份报告');
  assert.equal(loader.calls.length, callsAfterLoad, '重复安装不得再触发模块加载');
});

test('F04-运行：必需面缺失时 assertPreviewBootInstalled() 必须抛错并可定位', () => {
  const { fakeWindow, loader } = makeElectronLikeWindow();
  // 让 'fs' 不可解析（path 仍可解析，用于确认报错精确到缺失项）。
  const original = loader;
  fakeWindow.require = (name) => (name === 'fs' ? undefined : original(name));
  const boot = loadBoot(fakeWindow);
  assert.throws(
    () => boot.assertPreviewBootInstalled(),
    /必需全局缺失（loader=require）：fs/,
  );
});

test('F04-运行：载入器缺席（无 shim）时报告 loader=none 且断言抛错', () => {
  const fakeWindow = { appRoot: '/src' };
  const boot = loadBoot(fakeWindow);
  const report = fakeWindow.__eaglePreviewBoot;
  assert.equal(report.loader, 'none');
  assert.deepEqual(plain(report.skipped), plain(boot.PREVIEW_BOOT_GLOBALS));
  assert.throws(() => boot.assertPreviewBootInstalled(), /必需全局缺失（loader=none）/);
});

test('F04-运行：未安装就断言（installPreviewBoot 从未执行）必须显式失败', () => {
  const fakeWindow = { require: () => undefined };
  const boot = loadBoot(fakeWindow);
  delete fakeWindow.__eaglePreviewBoot;
  assert.throws(() => boot.assertPreviewBootInstalled(), /installPreviewBoot\(\) 未执行/);
});
