/**
 * M2-1 契约测试：**有限 RuntimeServices** + 三态运行模式 + 「能力缺失即明确失败」。
 *
 * 覆盖任务书四项目标的可观测面：
 *  1. 三态判定（`electron` / `browser-connected` / `demo`）与「浏览器连真后端**不再**被当作 demo」；
 *  2. 「未知能力返回成功」消失：未登记模块/未登记 invoke 频道/无实现的 shell·dialog·clipboard
 *     一律**抛错或返回带 `unavailable` 标记的结果**，且**只有 demo 态**才允许模拟实现；
 *  3. demo 态**不写用户资源**（写入只落内存演示存储，且整图从不请求 `node:fs`）；
 *  4. RuntimeServices 装配面（8 服务 / 单一装配点 / 显式依赖表 / 能力位语义）。
 *
 * 手段与 `tests/boot-ready-sequence.mjs` 同款：typescript 内存转译 + `node:vm` 隔离加载**真实模块**，
 * 依赖经 vm 的 require 闸门显式登记——未登记的依赖**直接断言失败**，避免「测到替身而不是被测代码」。
 *
 * 注意：本测试**不**起 Electron。实机可达性（渲染层 `require('electron')` 究竟导出哪些模块）
 * 由 `desktopCapability.nativeElectronExport` 的运行时探针决定，本测试用可控的 `require` 替身
 * 分别模拟「导出 clipboard」与「不导出」两种实机形态，验证探针两个方向都对。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const { posix } = path;

/** 本测试允许加载的**真实模块**集合（`core/` 下的 shim 图 + 新装配点 + 唯一写状态）。 */
const ALLOWED_MODULES = new Set([
  'src/app/react/core/runtimeServices.ts',
  'src/app/react/core/ipcWriteState.ts',
  'src/app/react/core/shim/environment.ts',
  'src/app/react/core/shim/browserRuntime.ts',
  'src/app/react/core/shim/desktopCapability.ts',
  'src/app/react/core/shim/ipcBus.ts',
  'src/app/react/core/shim/demoSeed.ts',
  'src/app/react/core/shim/moduleRegistry.ts',
  'src/app/react/core/shim/settingsI18n.ts',
]);

const ENV_MODULE = 'src/app/react/core/shim/environment.ts';
const RUNTIME_MODULE = 'src/app/react/core/runtimeServices.ts';
const CAPABILITY_MODULE = 'src/app/react/core/shim/desktopCapability.ts';
const BROWSER_MODULE = 'src/app/react/core/shim/browserRuntime.ts';
const IPC_MODULE = 'src/app/react/core/shim/ipcBus.ts';
const SEED_MODULE = 'src/app/react/core/shim/demoSeed.ts';

function readSource(rel) {
  return fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
}

// ─────────────────────────────────────────────────────────────────────────────
// 隔离加载器（每个场景一份，模块求值期捕获的判据必须随场景重建）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 为单个场景创建模块加载器。
 *
 * `environment.ts` 在**模块求值期**定格 `nativeFs` / `desktopApi` / `hasDesktopApi` /
 * `isElectronRuntime`，所以每个场景必须重新加载整张图——跨场景复用会测到上一个场景的判据。
 */
function createLoader(context) {
  const cache = new Map();
  const requested = [];

  function resolve(fromRel, spec) {
    assert.ok(
      spec.startsWith('.'),
      `禁止加载未登记的外部依赖：${spec}（来自 ${fromRel}）`,
    );
    const base = posix.join(posix.dirname(fromRel), spec);
    for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
      if (ALLOWED_MODULES.has(candidate)) return candidate;
    }
    assert.fail(`模块不在本测试登记的依赖集合内：${base}（来自 ${fromRel}）`);
  }

  function load(rel) {
    if (cache.has(rel)) return cache.get(rel);
    requested.push(rel);
    const { outputText, diagnostics } = ts.transpileModule(readSource(rel), {
      fileName: rel,
      reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    assert.equal(diagnostics.length, 0, `${rel} 转译应无诊断`);
    const module = { exports: {} };
    // 先登记再执行：环形依赖按 CJS 语义拿到「部分填充」的 exports。
    cache.set(rel, module.exports);
    vm.runInNewContext(outputText, {
      ...context,
      module,
      exports: module.exports,
      require: (spec) => load(resolve(rel, spec)),
    }, { filename: rel });
    return module.exports;
  }

  return { load, loadedModules: () => requested.slice() };
}

/** 内存 localStorage 替身（`settingsI18n` 会直取该全局）。 */
function makeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(String(key)) ? map.get(String(key)) : null),
    setItem: (key, value) => { map.set(String(key), String(value)); },
    removeItem: (key) => { map.delete(String(key)); },
    clear: () => map.clear(),
    get length() { return map.size; },
    key: (index) => Array.from(map.keys())[index] ?? null,
  };
}

function captureConsole(warnings) {
  const noop = () => {};
  return {
    log: noop,
    info: noop,
    debug: noop,
    error: noop,
    warn: (...args) => { warnings.push(args.map(String).join(' ')); },
  };
}

/** 浏览器侧最小 `document` 替身（仅满足求值期取值，不承担渲染语义）。 */
function makeDocument() {
  return {
    body: null,
    documentElement: null,
    addEventListener() {},
    removeEventListener() {},
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
    querySelector: () => null,
  };
}

/** `XMLHttpRequest` 替身：任何请求都失败（浏览器演示态不该有真实文件读取）。 */
class FailingXhr {
  open() {}
  send() { if (typeof this.onerror === 'function') this.onerror(new Error('no network in test')); }
  setRequestHeader() {}
}

function makeWindow(extra = {}) {
  const localStorage = makeStorage();
  const win = {
    location: { pathname: '/src/app/index.html', href: 'http://localhost:5173/src/app/index.html' },
    localStorage,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
    ...extra,
  };
  return { win, localStorage };
}

/**
 * 建立一个场景：返回真实模块导出 + 场景夹具。
 *
 * @param {{name: string, windowExtra?: object, fetch?: Function, process?: object, appModule?: object}} scenario
 */
function createScenario(scenario) {
  const warnings = [];
  const { win, localStorage } = makeWindow(scenario.windowExtra || {});
  const context = {
    window: win,
    globalThis: win,
    console: captureConsole(warnings),
    localStorage,
    document: makeDocument(),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    setImmediate,
    XMLHttpRequest: FailingXhr,
    fetch: scenario.fetch,
    process: scenario.process,
  };
  const loader = createLoader(context);
  return {
    name: scenario.name,
    window: win,
    warnings,
    load: loader.load,
    loadedModules: loader.loadedModules,
  };
}

/** 演示态：浏览器、无后端（`fetch` 失败）。 */
function demoScenario(extra = {}) {
  return createScenario({
    name: 'demo',
    fetch: () => Promise.reject(new Error('ECONNREFUSED')),
    ...extra,
  });
}

/** 浏览器连真后端：`/api/library/current` 返回库描述。 */
function browserConnectedScenario() {
  return createScenario({
    name: 'browser-connected',
    fetch: (url) => {
      assert.match(String(url), /\/api\/library\/current/, '探测目标应是库描述端点');
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          status: 'success',
          data: { rootDir: '/real-library', libraryName: '真实库', items: [{ id: 'REAL1' }] },
        }),
      });
    },
  });
}

/**
 * electron 场景：`window.eagleDesktop`（preload 桥）+ 宿主 `window.require`。
 *
 * `require('electron')` 返回的模块面**可控**——实机上哪些模块在渲染层导出由探针决定，
 * 本测试两种形态都要覆盖。
 */
function electronScenario(options = {}) {
  const nativeCalls = [];
  const electronModule = {
    webFrame: { setZoomFactor() {}, getZoomFactor: () => 1 },
    ipcRenderer: { send() {}, on() {}, invoke: () => Promise.resolve() },
    ...(options.electronExports || {}),
  };
  const windowExtra = {
    eagleDesktop: options.bridge || {
      library: { current: () => ({ rootDir: '/real-library', libraryName: '真实库', items: [] }) },
      window: { minimize() {}, close() {}, isMaximized: () => false, isFullScreen: () => false },
    },
    require: (spec) => {
      nativeCalls.push(String(spec));
      if (spec === 'electron') return electronModule;
      if (spec === 'node:fs') return fs;
      if (spec === 'node:path') return path;
      throw new Error(`未登记的 nativeRequire：${spec}`);
    },
  };
  const runtime = createScenario({
    name: 'electron',
    windowExtra,
    process: { versions: { electron: '22.3.7', node: '22.0.0' }, platform: 'win32' },
  });
  runtime.nativeCalls = nativeCalls;
  runtime.electronModule = electronModule;
  return runtime;
}

/** 该运行态下的错误断言（跨 realm：按 `name` + `code` 判，不用 `instanceof`）。 */
function assertCapabilityError(err, hint) {
  assert.ok(err, `${hint}：应产生失败而不是成功`);
  assert.equal(err.name, 'RuntimeCapabilityError', `${hint}：应为 RuntimeCapabilityError`);
  assert.equal(err.code, 'EAGLE_CAPABILITY_UNAVAILABLE', `${hint}：错误码应稳定`);
}

async function expectRejects(promise, hint) {
  const outcome = await promise.then(
    (value) => ({ settled: 'fulfilled', value }),
    (err) => ({ settled: 'rejected', err }),
  );
  assert.equal(outcome.settled, 'rejected', `${hint}：应为失败`);
  assertCapabilityError(outcome.err, hint);
  return outcome.err;
}

// ─────────────────────────────────────────────────────────────────────────────
// 目标 3：三态判定
// ─────────────────────────────────────────────────────────────────────────────

test('三态判定：demo / browser-connected / electron 各自成立且互不混淆', async () => {
  const demo = demoScenario();
  const demoEnv = demo.load(ENV_MODULE);
  assert.equal(demoEnv.resolveRuntimeMode(), 'demo', '无桥无后端 ⇒ demo');
  assert.equal(demoEnv.hasDesktopApi, false);
  assert.equal(demoEnv.isDemoRuntime(), true);
  assert.equal(demoEnv.isRealRuntime(), false);

  const bc = browserConnectedScenario();
  const bcEnv = bc.load(ENV_MODULE);
  assert.equal(bcEnv.resolveRuntimeMode(), 'demo', '探测完成前是待定结论（demo）');
  assert.equal(await bcEnv.probeRuntimeMode(), 'browser-connected', '真后端 ⇒ browser-connected');
  assert.equal(bc.window.__EAGLE_BROWSER_CONNECTED, true, '探测结论应落盘到窗口标记');
  assert.equal(bcEnv.resolveRuntimeMode(), 'browser-connected', '同步判定应与探测一致');
  assert.equal(bcEnv.isDemoRuntime(), false, 'browser-connected **不是** demo');
  assert.equal(bcEnv.isRealRuntime(), true);

  const el = electronScenario();
  const elEnv = el.load(ENV_MODULE);
  assert.equal(elEnv.resolveRuntimeMode(), 'electron', '有桌面桥 ⇒ electron');
  assert.equal(elEnv.isDemoRuntime(), false);
});

test('三态判定：`__EAGLE_SHIM_MODE` 显式标记优先，且非法值回落探测', () => {
  const forced = demoScenario({ windowExtra: { __EAGLE_SHIM_MODE: 'browser-connected' } });
  const env = forced.load(ENV_MODULE);
  assert.equal(env.resolveRuntimeMode(), 'browser-connected', '显式标记优先于一切探测');

  const bogus = demoScenario({ windowExtra: { __EAGLE_SHIM_MODE: 'not-a-mode' } });
  const bogusEnv = bogus.load(ENV_MODULE);
  assert.equal(bogusEnv.resolveRuntimeMode(), 'demo', '非法取值应回落探测结果');
  assert.ok(
    bogus.warnings.some((line) => line.includes('unknown') || line.includes('未知')),
    '非法取值应留下告警而不是静默忽略',
  );
});

test('浏览器连真后端不被当作 demo：演示种子必须拒绝安装', async () => {
  const bc = browserConnectedScenario();
  const env = bc.load(ENV_MODULE);
  const seed = bc.load(SEED_MODULE);
  await env.probeRuntimeMode();
  assert.equal(env.resolveRuntimeMode(), 'browser-connected');

  // 直接调用种子安装点：真实业务态必须拒绝（纵深防御，不只靠调用方判断）。
  seed.installDemoLibrarySeed();
  assert.equal(bc.window.__mockLibrary, undefined, '真实后端态**不得**落下演示库数据');
  assert.equal(bc.window.__mockLibraryCache, undefined, '真实后端态**不得**落下演示缓存');
  assert.ok(
    Object.prototype.hasOwnProperty.call(env.unavailableCapabilities, 'demoSeed.librarySeed'),
    '拒绝安装应登记为可查的能力缺口，而不是静默返回',
  );
});

test('demo 态才允许演示种子：种子落位且标记 demoSeed 已安装', () => {
  const demo = demoScenario();
  const env = demo.load(ENV_MODULE);
  const seed = demo.load(SEED_MODULE);
  assert.equal(env.resolveRuntimeMode(), 'demo');
  seed.installDemoLibrarySeed();
  assert.ok(demo.window.__mockLibrary, 'demo 态应落演示库');
  assert.ok(Array.isArray(demo.window.__mockLibraryCache), 'demo 态应落演示条目缓存');
});

// ─────────────────────────────────────────────────────────────────────────────
// 目标 2：未知能力不再「返回成功」
// ─────────────────────────────────────────────────────────────────────────────

test('未登记模块：真实业务态必须在 require 调用时就抛错，demo 态才保留可链式假对象', () => {
  const bc = browserConnectedScenario();
  const bcEnv = bc.load(ENV_MODULE);
  const bcRuntime = bc.load(BROWSER_MODULE);
  bc.window.__EAGLE_BROWSER_CONNECTED = true;
  assert.equal(bcEnv.resolveRuntimeMode(), 'browser-connected');

  // 抛点必须落在 **require 调用本身**，不能是「返回一个取值才抛的替身」。
  // 实测依据：`core/bundleGlobals.ts` 取 `require('junk')` 写的是
  //   `if (!w.junk) { try { w.junk = req('junk'); } catch { …内联真实兼容实现… } }`
  // 作者把「模块取不到」当作**可预期失败**并准备了真实回落。若返回「取值才抛」的替身，
  // 该 catch 永不触发（赋值成功），抛点改落到后面**没有 try/catch 保护**的
  // `typeof w.junk.is` 上 → 整个 `installBundleGlobals()` 中断 → 主窗不渲染。
  assert.throws(() => bcRuntime.genericStub('some-unknown-module'), (err) => {
    assertCapabilityError(err, 'genericStub 调用');
    return true;
  }, '真实业务态：调用未登记模块必须抛错，而不是返回可链式假对象');

  const demo = demoScenario();
  demo.load(ENV_MODULE);
  const demoRuntime = demo.load(BROWSER_MODULE);
  const demoStub = demoRuntime.genericStub('some-unknown-module');
  assert.equal(typeof demoStub, 'function', 'demo 态保留演示替身');
  assert.equal(demoStub().map().filter(), demoStub, 'demo 态替身可链式（显式选择的演示语义）');
});

test('未登记 invoke 频道：真实业务态 reject，demo 态才回落演示值', async () => {
  const el = electronScenario();
  const elEnv = el.load(ENV_MODULE);
  const elIpc = el.load(IPC_MODULE);
  assert.equal(elEnv.resolveRuntimeMode(), 'electron');

  await expectRejects(
    elIpc.ipcRenderer.invoke('definitely-not-registered-channel'),
    'electron 态未登记 invoke 频道',
  );
  assert.ok(
    Object.keys(elEnv.unavailableCapabilities).some((key) => key.startsWith('ipc.invoke(')),
    '未登记 invoke 应登记为能力缺口',
  );

  const demo = demoScenario();
  demo.load(ENV_MODULE);
  const demoIpc = demo.load(IPC_MODULE);
  const value = await demoIpc.ipcRenderer.invoke('definitely-not-registered-channel');
  assert.equal(value.ok, true, 'demo 态保留既有演示回落（显式选择的演示语义）');
});

test('无实现的 shell：返回带 unavailable 标记的结果而非静默成功', async () => {
  const el = electronScenario(); // electronExports 不含 shell —— 复刻「shell 属主进程模块」
  const elEnv = el.load(ENV_MODULE);
  const caps = el.load(CAPABILITY_MODULE);
  assert.equal(elEnv.resolveRuntimeMode(), 'electron');

  const external = await caps.electron.shell.openExternal('https://example.com');
  assert.equal(external.ok, false, 'openExternal 不得返回「成功」');
  assert.equal(external.unavailable, true, '应带显式 unavailable 标记');
  assert.equal(external.capability, 'shell.openExternal', '结果应自报是哪个能力不可用');
  assert.match(external.reason, /https:\/\/example\.com/, '原因应带上被拒绝的目标，便于定位');

  const reveal = caps.electron.shell.showItemInFolder('/tmp/a.png');
  assert.equal(reveal.unavailable, true, 'showItemInFolder 应显式不可用');
  assert.ok(
    Object.prototype.hasOwnProperty.call(elEnv.unavailableCapabilities, 'shell.openExternal'),
    '缺口应登记可查',
  );
});

test('渲染层探到真 electron 模块时接真实现（不声明不存在的缺口）', async () => {
  const opened = [];
  const el = electronScenario({
    electronExports: {
      // 复刻实机另一种形态：渲染层确实导出 shell / clipboard
      shell: {
        openExternal: (url) => { opened.push(url); return Promise.resolve(); },
        openPath: () => Promise.resolve(''),
        showItemInFolder: () => {},
        beep: () => {},
      },
      clipboard: { writeText: (text) => { opened.push(`clip:${text}`); }, readText: () => 'x' },
    },
  });
  const env = el.load(ENV_MODULE);
  const caps = el.load(CAPABILITY_MODULE);
  assert.equal(env.resolveRuntimeMode(), 'electron');

  await caps.electron.shell.openExternal('https://example.com');
  assert.deepEqual(opened, ['https://example.com'], '探到 shell 应真的调用原生实现');

  assert.equal(caps.electron.clipboard.writeText('hello'), true, '探到 clipboard 应返回成功');
  assert.deepEqual(opened, ['https://example.com', 'clip:hello']);
  assert.equal(
    Object.prototype.hasOwnProperty.call(env.unavailableCapabilities, 'shell.openExternal'),
    false,
    '真实现可达时**不得**登记为缺口',
  );
});

test('无对话框能力：真实业务态 reject，不伪造成「用户取消」', async () => {
  const bc = browserConnectedScenario();
  const env = bc.load(ENV_MODULE);
  const caps = bc.load(CAPABILITY_MODULE);
  await env.probeRuntimeMode();
  assert.equal(env.resolveRuntimeMode(), 'browser-connected');

  await expectRejects(
    caps.dialog.showOpenDialog({ properties: ['openFile'] }),
    'browser-connected 无桌面桥的 showOpenDialog',
  );
  await expectRejects(
    caps.dialog.showMessageBox({ message: 'hi' }),
    'browser-connected 无桌面桥的 showMessageBox',
  );
});

test('无原生 fs 时的行读取：真实业务态构造即抛，不静默改读陈旧内存缓存', () => {
  const bc = browserConnectedScenario();
  const env = bc.load(ENV_MODULE);
  const runtime = bc.load(BROWSER_MODULE);
  bc.window.__EAGLE_BROWSER_CONNECTED = true;
  assert.equal(env.resolveRuntimeMode(), 'browser-connected');

  assert.throws(
    () => new runtime.lineByLineMock('/real/file.txt'),
    (err) => {
      assertCapabilityError(err, 'LineByLine 构造');
      return true;
    },
    '真实业务态无原生 fs 必须明确失败',
  );
});

test('无本地 REST 服务实现：start() 同步明确失败，不返回「已启动」', async () => {
  const bc = browserConnectedScenario();
  const env = bc.load(ENV_MODULE);
  const runtime = bc.load(BROWSER_MODULE);
  bc.window.__EAGLE_BROWSER_CONNECTED = true;
  assert.equal(env.resolveRuntimeMode(), 'browser-connected');

  const server = new runtime.JsonRestServerStub();
  let started = false;

  // M2-2：失败必须是**同步抛出**而不是 rejected Promise。两个真实调用点
  // （bundleGlobals._startAPIServer、miscDomain 的 power-resume）都只对同步抛错设了
  // try/catch——rejected Promise 两者都接不住，会变成 unhandled rejection，把「能力缺口」
  // 淹没成未捕获异常。这里同时钉住「同步抛出」与「回调不得触发」两件事。
  assert.throws(
    () => server.start(() => { started = true; }),
    (err) => {
      assertCapabilityError(err, 'JsonRestServerStub.start');
      assert.equal(err.capability, 'JsonRestServer.start', '缺口名应稳定');
      return true;
    },
    '真实业务态必须同步抛出 RuntimeCapabilityError',
  );

  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(started, false, '失败时「服务已启动」成功回调不得触发');
  assert.equal(
    env.unavailableCapabilities['JsonRestServer.start'] !== undefined,
    true,
    '缺口须登记到 capabilities.gaps，供诊断面板/门控消费',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 目标 3（续）：demo 不写用户资源
// ─────────────────────────────────────────────────────────────────────────────

test('demo 不写用户资源：写入只落内存演示存储，且整图从不请求 node:fs', async () => {
  const demo = demoScenario();
  const env = demo.load(ENV_MODULE);
  const runtimeServices = demo.load(RUNTIME_MODULE);
  const browser = demo.load(BROWSER_MODULE);
  assert.equal(env.resolveRuntimeMode(), 'demo');
  assert.equal(env.nativeFs, null, 'demo 态不应拿到原生 fs');

  const services = runtimeServices.getRuntimeServices();
  assert.equal(services.capabilities.fs.write, false, 'demo 态不得声明「能写真实库数据」');
  assert.equal(services.capabilities.fs.memoryOnly, true, 'demo 态应显式声明「只写内存」');

  const target = '/user-library/tags.json';
  await services.storage.writeJson(target, { historyTags: ['a'] });

  const store = env.demoFileStore();
  assert.equal(
    Object.prototype.hasOwnProperty.call(store, target),
    true,
    '演示写入应落在内存演示存储',
  );
  assert.deepEqual(JSON.parse(store[target]), { historyTags: ['a'] });

  // 反向证据：整张模块图在 demo 态从未请求过原生 fs（没有第二条真实写路径）。
  assert.equal(
    Object.prototype.hasOwnProperty.call(env, 'nativeFs') && env.nativeFs === null,
    true,
  );
  assert.equal(
    typeof demo.window.require,
    'undefined',
    'demo 态窗口不应暴露宿主 require（没有原生写入口）',
  );

  // 演示存储与 fsModule 同源：读回来的是刚写进去的值。
  assert.equal(browser.fsModule.readFileSync(target, 'utf8'), store[target]);
});

test('demo 之外的真实态：同一写入路径不得落内存演示存储', async () => {
  const bc = browserConnectedScenario();
  const env = bc.load(ENV_MODULE);
  const runtimeServices = bc.load(RUNTIME_MODULE);
  await env.probeRuntimeMode();
  assert.equal(env.resolveRuntimeMode(), 'browser-connected');

  const services = runtimeServices.getRuntimeServices();
  await expectRejects(
    services.storage.writeJson('/user-library/tags.json', { a: 1 }),
    'browser-connected 无写能力的库数据写',
  );
  assert.equal(
    Object.keys(env.demoFileStore()).length,
    0,
    '真实态写入**不得**悄悄落进内存演示存储',
  );
});

test('demo 之外的真实态：读侧同样不得返回合成演示内容', async () => {
  const bc = browserConnectedScenario();
  const env = bc.load(ENV_MODULE);
  const browser = bc.load(BROWSER_MODULE);
  await env.probeRuntimeMode();
  assert.equal(env.resolveRuntimeMode(), 'browser-connected');

  const tags = browser.fsModule.readFileSync('/real-library/tags.json', 'utf8');
  assert.doesNotMatch(
    String(tags),
    /historyTags/,
    '真实业务态读 tags.json 不得返回演示标签（读侧「未知能力返回成功」）',
  );
  assert.equal(
    browser.fsModule.existsSync('/real-library/Settings'),
    false,
    '真实业务态不得凭路径名宣告「存在」',
  );

  // 反向对照：同一调用在 demo 态仍返回演示内容（演示链路自洽）。
  const demo = demoScenario();
  demo.load(ENV_MODULE);
  const demoBrowser = demo.load(BROWSER_MODULE);
  assert.match(
    String(demoBrowser.fsModule.readFileSync('/mock-settings/Settings', 'utf8')),
    /preferences/,
    'demo 态应保留演示内容（显式选择的演示实现）',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 目标 1：RuntimeServices 装配面
// ─────────────────────────────────────────────────────────────────────────────

test('RuntimeServices：单一装配点产出 8 个服务，且与依赖表/顺序表一致', () => {
  const demo = demoScenario();
  demo.load(ENV_MODULE);
  const runtimeServices = demo.load(RUNTIME_MODULE);

  const services = runtimeServices.createRuntimeServices();
  const names = Object.keys(runtimeServices.RUNTIME_SERVICE_DEPENDENCIES);
  assert.deepEqual(
    [...runtimeServices.RUNTIME_SERVICE_ORDER].sort(),
    names.sort(),
    '装配顺序表与依赖表必须覆盖同一组服务',
  );
  assert.equal(names.length, 8, 'RuntimeServices 是**有限**集合：8 个服务');
  for (const name of runtimeServices.RUNTIME_SERVICE_ORDER) {
    assert.ok(services[name], `服务 ${name} 应已装配`);
  }
  assert.ok(services.capabilities, '装配结果应携带能力位');
  assert.equal(services.env.kind, services.capabilities.kind, '能力位与运行环境判定应一致');

  // 依赖表可审计：每个 shim 依赖都指向真实存在（且已登记）的模块。
  for (const name of runtimeServices.RUNTIME_SERVICE_ORDER) {
    const deps = runtimeServices.RUNTIME_SERVICE_DEPENDENCIES[name];
    assert.ok(Array.isArray(deps) && deps.length > 0, `${name} 应显式声明依赖`);
  }
});

test('RuntimeServices：能力位 `false` 必须能在 gaps 里查到原因', () => {
  const el = electronScenario({
    bridge: {
      library: { updateStructure: () => {}, current: () => ({}) },
      window: { minimize() {}, close() {}, isMaximized: () => false, isFullScreen: () => false },
    },
  });
  const env = el.load(ENV_MODULE);
  const runtimeServices = el.load(RUNTIME_MODULE);
  assert.equal(env.resolveRuntimeMode(), 'electron');

  const caps = runtimeServices.describeCapabilities();
  assert.equal(caps.kind, 'electron');
  assert.equal(caps.fs.write, true, '有 library.updateStructure ⇒ 可写库数据');

  const probes = [
    ['fs.write', caps.fs.write],
    ['shell.external', caps.shell.external],
    ['shell.path', caps.shell.path],
    ['shell.reveal', caps.shell.reveal],
    ['clipboard.readText', caps.clipboard.readText],
    ['clipboard.writeText', caps.clipboard.writeText],
    ['clipboard.writeImage', caps.clipboard.writeImage],
    ['window.visibility', caps.window.visibility],
    ['window.lifecycle', caps.window.lifecycle],
    ['plugins', caps.plugins],
    ['imageOps.rotate', caps.imageOps.rotate],
    ['mediaTasks.thumbnail', caps.mediaTasks.thumbnail],
  ];
  for (const [key, enabled] of probes) {
    if (enabled === false) {
      assert.ok(caps.gaps[key], `能力位 ${key}=false 必须给出原因（消费者要据此禁用入口并说明）`);
    }
  }
  assert.equal(caps.window.visibility, false, '窗口显隐在本运行态确无实现');
  assert.equal(caps.window.lifecycle, true, '有最小化/关闭桥 ⇒ 生命周期可用');
  assert.equal(caps.plugins, false, '插件管理面无 IPC，应显式不可用');
});

test('RuntimeServices：装配点按运行态重建，能力位随三态切换', async () => {
  const bc = browserConnectedScenario();
  const env = bc.load(ENV_MODULE);
  const runtimeServices = bc.load(RUNTIME_MODULE);
  assert.equal(env.resolveRuntimeMode(), 'demo');

  const before = runtimeServices.getRuntimeServices();
  assert.equal(before.capabilities.kind, 'demo');
  assert.equal(before.capabilities.fs.memoryOnly, true);

  await env.probeRuntimeMode();
  assert.equal(env.resolveRuntimeMode(), 'browser-connected');
  const after = runtimeServices.getRuntimeServices();
  assert.equal(after.capabilities.kind, 'browser-connected', '结论变化后应重建装配结果');
  assert.equal(after.capabilities.fs.memoryOnly, false, '真实态不得声明「只写内存」');
  assert.notEqual(after, before, '不同运行态不应复用同一实例');

  assert.equal(runtimeServices.installRuntimeServices().env.kind, 'browser-connected');
  assert.equal(bc.window.__EAGLE_RUNTIME_KIND, 'browser-connected', '装配应登记可读的运行态标记');
  assert.ok(bc.window.__eagleRuntimeServices, '装配结果应登记到窗口供诊断读取');
});

test('RuntimeServices：库来源随三态切换，且不复制第二份库实现', () => {
  const demo = demoScenario();
  demo.load(ENV_MODULE);
  const demoServices = demo.load(RUNTIME_MODULE).createRuntimeServices();
  assert.equal(demoServices.library.source('demo'), 'demo-seed');
  assert.equal(demoServices.library.source('electron'), 'desktop-bridge');
  assert.equal(demoServices.library.source('browser-connected'), 'backend');

  // backend 装载路径复用既有实现（`demoSeed.loadLibraryFromBackend`），不另写一份 fetch 逻辑。
  const runtimeSource = readSource(RUNTIME_MODULE);
  assert.match(runtimeSource, /loadLibraryFromBackend/, '库装载应复用 shim 既有实现');
  const fetchOccurrences = runtimeSource.match(/fetch\(/g) || [];
  assert.equal(fetchOccurrences.length, 0, 'runtimeServices 不得自己写 HTTP 取数');
});

test('RuntimeServices：IPC 服务复用唯一总线（不另建第二条路由）', () => {
  const demo = demoScenario();
  demo.load(ENV_MODULE);
  const runtimeServices = demo.load(RUNTIME_MODULE);
  const services = runtimeServices.createRuntimeServices();
  const seen = [];
  services.ipc.on('probe-channel', (...args) => { seen.push(args); });
  assert.equal(typeof services.ipc.send, 'function');

  const source = readSource(RUNTIME_MODULE);
  assert.match(source, /from "\.\/shim\/ipcBus"/, 'IPC 服务必须取自 shim 总线');
  assert.equal(
    (source.match(/new EventEmitter/g) || []).length,
    0,
    '不得新建第二条 IPC 总线',
  );
});

test('静态接线：shim 装配入口调用 RuntimeServices 单一装配点', () => {
  const installSource = readSource('src/app/react/core/shim/install.ts');
  assert.match(
    installSource,
    /installRuntimeServices\(\)/,
    'install.ts 应调用装配点（否则运行时拿不到 RuntimeServices）',
  );
  assert.match(
    installSource,
    /from "\.\.\/runtimeServices"/,
    'install.ts 应从 core/runtimeServices.ts 取装配函数',
  );
});
