/**
 * M4-C —— 预览窗 dispose 收口与两处**持续性开销**治理的验证。
 *
 * 背景（只读审计结论，本文件把它变成可断言判据）：
 *  1. `preview-window/controller.ts` 的 `cursorInterval`：500ms 一次
 *     `remote.screen.getCursorScreenPoint()` + `getBounds()`——**跨进程同步 IPC**；
 *     主进程以 `backgroundThrottling:false` 建窗（electron/main.cjs:837），后台不被节流，
 *     因此预览窗开着就一直在真实消耗。原实现全文件无 `clearInterval`，句柄丢失后无从取消。
 *  2. `preview-window/shell.tsx` 的 `win.on('leave-full-screen')`：注册在**主进程**
 *     BrowserWindow 代理上；effect 依赖含 `item?.id`，每次切项都再注册一次，
 *     原实现无 cleanup 且用匿名回调——摘除面为零，监听数随切项线性增长。
 *
 * 判据都不是「源码里看起来加了 clear」：
 *  - 两处都在 vm 中**真实装载源码**（只桩掉模块外依赖），用**假时钟**与**真 EventEmitter**
 *    驱动，按可观测计数判定：跨进程调用次数、主进程侧 listener 数、挂载期递延是否仍触发。
 *  - **局限（明写）**：本测试用 `node:events` 的 EventEmitter 代表 `@electron/remote` 代理的
 *    主进程 BrowserWindow——断言的是 EventEmitter 契约（`on`/`removeListener`/`off`/
 *    `listenerCount`/`listeners`），**不是**活的 Electron 主进程。活体一路由
 *    `tests/react-stage9a3-smoke.mjs` 的真实关窗断言覆盖。
 *
 * 运行：node tests/m4-preview-dispose.mjs
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const CONTROLLER_PATH = 'src/app/react/preview-window/controller.ts';
const SHELL_PATH = 'src/app/react/preview-window/shell.tsx';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function transpile(path) {
  const { outputText, diagnostics } = ts.transpileModule(read(path), {
    fileName: path,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  assert.equal(diagnostics.length, 0, `${path} 转译应无诊断`);
  return outputText;
}

/* ---------------- 确定性假时钟（按到期顺序推进，不自旋） ---------------- */

function createClock() {
  const timers = new Map();
  let now = 0;
  let seq = 0;
  const schedule = (kind) => (fn, ms) => {
    const id = ++seq;
    const delay = Number(ms) || 0;
    timers.set(id, { fn, ms: delay, kind, due: now + delay });
    return id;
  };
  return {
    now: () => now,
    pending: () => timers.size,
    /** 当前挂着的 interval 周期（用于证明轮询确有安装，避免空洞通过）。 */
    intervals: () => [...timers.values()].filter((timer) => timer.kind === 'interval').map((timer) => timer.ms),
    setTimeout: schedule('timeout'),
    setInterval: schedule('interval'),
    clearTimeout: (id) => { timers.delete(id); },
    clearInterval: (id) => { timers.delete(id); },
    advance(ms) {
      const target = now + ms;
      let guard = 0;
      for (;;) {
        let nextDue = Infinity;
        let nextId = null;
        for (const [id, timer] of timers) {
          if (timer.due < nextDue) {
            nextDue = timer.due;
            nextId = id;
          }
        }
        if (nextId === null || nextDue > target) break;
        if (++guard > 100000) throw new Error('假时钟：定时器风暴（自排定时器未收敛）');
        const timer = timers.get(nextId);
        now = nextDue;
        if (timer.kind === 'interval') timer.due = now + timer.ms;
        else timers.delete(nextId);
        timer.fn();
      }
      now = target;
    },
  };
}

const noop = () => undefined;

/** 链式 DOM 桩：`dom(sel).on(...).addClass(...)` / `[0]` 均可用，取值一律丢弃。 */
function chainable() {
  const node = new Proxy(function () {}, {
    get: (_target, key) => {
      if (key === '0' || key === 'then') return undefined;
      if (key === 'length') return 0;
      return node;
    },
    apply: () => node,
  });
  return node;
}

/* ---------------- controller.ts 装载 ---------------- */

function loadController() {
  const clock = createClock();
  const windowEvents = [];
  let cursorCalls = 0;

  const win = new EventEmitter();
  win.getBounds = () => ({ x: 0, y: 0, width: 100, height: 100 });
  win.isFullScreen = () => false;

  const remote = {
    Menu: function Menu() {},
    MenuItem: function MenuItem() {},
    nativeTheme: { shouldUseDarkColors: false },
    screen: {
      getCursorScreenPoint: () => {
        cursorCalls++;
        return { x: 0, y: 0 };
      },
    },
    getCurrentWindow: () => win,
    app: { getPath: () => '/tmp/eagle-m4' },
  };

  const documentStub = {
    addEventListener: noop,
    removeEventListener: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: () => ({ setAttribute: noop, addEventListener: noop }),
  };

  const windowStub = {
    require: (name) => {
      if (name === 'path') return { normalize: (value) => value, join: (...parts) => parts.join('/') };
      if (name === 'fs') return {};
      if (name === 'electron') return { ipcRenderer: { on: noop, send: noop } };
      if (name === '@electron/remote') return remote;
      if (name === 'app-root-path') return '/app';
      if (name.endsWith('/my_modules/electron-settings')) {
        return {
          getPreferences: () => ({
            general: { zoom: '100', language: 'zh_CN' },
            theme: { css: 'gray', name: 'Gray' },
            shortcuts: { keybinds: {} },
            habits: {},
          }),
        };
      }
      return undefined;
    },
    addEventListener: (name, handler) => windowEvents.push([name, handler]),
    removeEventListener: noop,
    location: { search: '', href: 'http://preview.invalid/' },
  };
  windowStub.window = windowStub;

  const modules = {
    '../core/fileUrlHelper': { FileUrlHelper: { getRawPath: () => '', getRawUrl: () => '' } },
    '../core/smoothZoomEngine': { detailZoom: () => undefined, ensureDetailZoom: noop },
    '../components/interactions/resizable': { getResizable: () => undefined, makeResizable: noop },
    '../utils/domQuery': {
      q: () => null, qa: () => [], dataGet: () => undefined,
      dataSet: noop, addClassEl: noop, removeClassEl: noop, setCssEl: noop,
    },
    '../utils/domLite': { dom: () => chainable() },
    '../utils/lang': { isNumeric: () => false },
    '../services/imageTransformWriteback': { commitImageTransform: noop },
  };

  const exported = {};
  vm.runInNewContext(transpile(CONTROLLER_PATH), {
    console,
    process: { platform: 'win32', env: { SYSTEMROOT: 'C:/Windows' }, versions: { electron: '22.3.7' } },
    setTimeout: clock.setTimeout,
    setInterval: clock.setInterval,
    clearTimeout: clock.clearTimeout,
    clearInterval: clock.clearInterval,
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    window: windowStub,
    document: documentStub,
    exports: exported,
    require(name) {
      assert.ok(Object.hasOwn(modules, name), `${CONTROLLER_PATH} 不得加载未隔离的依赖：${name}`);
      return modules[name];
    },
  }, { filename: CONTROLLER_PATH });

  return { exported, scope: exported.controllerScope, clock, windowEvents, cursorCalls: () => cursorCalls };
}

/* ---------------- shell.tsx 装载 ---------------- */

function makeWebview() {
  return {
    listeners: new Map(),
    attributes: new Map(),
    executed: [],
    sent: [],
    addEventListener(name, handler) {
      if (!this.listeners.has(name)) this.listeners.set(name, []);
      this.listeners.get(name).push(handler);
    },
    executeJavaScript(code) { this.executed.push(code); },
    setAttribute(name, value) { this.attributes.set(name, value); },
    send(...args) { this.sent.push(args); },
    stop: noop,
    src: '',
  };
}

function loadShell({ controllerScope = { theme: 'gray', platform: 'win' }, win = new EventEmitter() } = {}) {
  // 每次装载独立 vm 上下文：shell 的模块级单例（previewPluginWebView 等）不在测试间串味。
  const clock = createClock();
  const effects = [];
  const refs = [];
  const createdWebviews = [];

  const windowStub = {
    require: (name) => {
      if (name === '@electron/remote') return { getCurrentWindow: () => win };
      if (name === 'url') return { pathToFileURL: (value) => ({ href: `file://${value}` }) };
      if (name === 'path') return { join: (...parts) => parts.join('/') };
      return undefined;
    },
    EagleConfig: { USER_AGENT: 'eagle-m4-test' },
    appRoot: { path: '/app' },
  };
  windowStub.window = windowStub;

  const modules = {
    react: {
      useEffect: (effect) => { effects.push(effect); },
      useRef: (initial) => { const ref = { current: initial }; refs.push(ref); return ref; },
      useState: (initial) => [initial, noop],
      default: {},
    },
    'react/jsx-runtime': {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
      Fragment: 'Fragment',
    },
    'react-dom': { createPortal: (children) => children },
    './controller': {
      controllerScope,
      applyController: (fn) => { if (typeof fn === 'function') fn(controllerScope); },
      subscribeController: () => noop,
      getControllerVersion: () => 0,
      pvT: (key) => key,
    },
    './detailHooks': { usePreviewMouseGesture: noop, usePreviewTgaImage: noop, usePreviewMousetrap: noop },
    '../components/detail/detailHooks': { applyNgClassSet: noop, useMediaElement: noop, useMpvMediaElement: noop },
    '../components/detail/commentHooks': { useRetryWhenError: noop, useCommentsContainer: noop, useCommentItem: noop },
    '../components/detail/DetailToolbar': { WebviewToolbar: () => null },
    '../components/hooks': { useTippy: noop },
    '../app/filters': { shortcuts: {} },
  };

  const exported = {};
  vm.runInNewContext(transpile(SHELL_PATH), {
    console,
    process: { platform: 'win32' },
    setTimeout: clock.setTimeout,
    setInterval: clock.setInterval,
    clearTimeout: clock.clearTimeout,
    clearInterval: clock.clearInterval,
    window: windowStub,
    document: {
      createElement: () => { const webview = makeWebview(); createdWebviews.push(webview); return webview; },
      getElementById: () => null,
      querySelector: () => null,
    },
    exports: exported,
    require(name) {
      assert.ok(Object.hasOwn(modules, name), `${SHELL_PATH} 不得加载未隔离的依赖：${name}`);
      return modules[name];
    },
  }, { filename: SHELL_PATH });

  return { exported, effects, refs, clock, win, createdWebviews, windowStub };
}

/**
 * React effect 语义的最小驱动：调用组件 → 组件内 `useRef` 的当前值补成夹具 →
 * 执行本次提交的 effect 并返回其 cleanup（无 cleanup 时返回 no-op）。
 */
function mount(harness, component, props, refCurrent) {
  const effectIndex = harness.effects.length;
  const refIndex = harness.refs.length;
  const element = harness.exported[component](props);
  assert.ok(element, `${component} 应返回元素`);
  for (let index = refIndex; index < harness.refs.length; index++) harness.refs[index].current = refCurrent;
  assert.equal(harness.effects.length, effectIndex + 1, `${component} 应提交恰好一个 effect`);
  const cleanup = harness.effects[effectIndex]();
  return typeof cleanup === 'function' ? cleanup : noop;
}

function hostWithWebview() {
  const webview = makeWebview();
  return {
    webview,
    host: {
      innerHTML: '',
      querySelector: (selector) => (selector === 'webview' ? webview : null),
      appendChild: noop,
    },
  };
}

/* ================= 开销 1：cursorInterval（跨进程轮询） ================= */

test('M4-C / cursorInterval：关闭前持续轮询，dispose 后不再有任何 getCursorScreenPoint 调用', () => {
  const { exported, scope, clock, cursorCalls } = loadController();

  // 空洞防护：先证明轮询**确实在跑**，否则后面的「不再增长」毫无意义。
  assert.deepEqual(clock.intervals(), [500], '模块求值后应恰好挂着一个 500ms 轮询定时器');
  clock.advance(3000);
  assert.equal(cursorCalls(), 6, '3 秒内应发生 6 次跨进程取光标（500ms × 6）');

  assert.equal(typeof exported.disposePreviewController, 'function');
  assert.equal(typeof scope.dispose, 'function', 'scope.dispose 是显式驱动面');

  exported.disposePreviewController();
  assert.deepEqual(clock.intervals(), [], 'dispose 后不得残留轮询定时器');

  const callsAtDispose = cursorCalls();
  clock.advance(10000);
  assert.equal(cursorCalls(), callsAtDispose, 'dispose 后 10 秒内不得再有 getCursorScreenPoint 调用');
});

test('M4-C / cursorInterval：dispose 幂等，重复驱动不得复活轮询', () => {
  const { exported, clock, cursorCalls } = loadController();
  clock.advance(500);
  const calls = cursorCalls();
  assert.equal(calls, 1);

  exported.disposePreviewController();
  exported.disposePreviewController();
  exported.disposePreviewController();

  clock.advance(5000);
  assert.equal(cursorCalls(), calls, '重复 dispose 不得释放出新的轮询');
  assert.equal(clock.pending(), 0, '重复 dispose 后不应有任何待触发定时器');
});

test('M4-C / cursorInterval：beforeunload 已注册为关窗释放驱动点', () => {
  const { windowEvents } = loadController();
  const entry = windowEvents.find(([name]) => name === 'beforeunload');
  assert.ok(entry, `关窗释放驱动点必须注册，实际注册了：${JSON.stringify(windowEvents.map(([name]) => name))}`);
  assert.equal(typeof entry[1], 'function');
});

/* ================= 开销 2：主进程 leave-full-screen 监听 ================= */

const URL_ITEM = { id: 'item-url-1', ext: 'url' };
const URL_SRC = 'https://example.invalid/page';
const BRANCH = 'PreviewWebViewBranch';

test('M4-C / leave-full-screen：反复切项 50 次，主进程侧 listener 数不增长', () => {
  const harness = loadShell();
  const win = harness.win;
  assert.equal(typeof harness.exported[BRANCH], 'function');

  const peer = () => {};
  win.on('leave-full-screen', peer);
  const baseline = win.listenerCount('leave-full-screen');
  assert.equal(baseline, 1);

  let peak = baseline;
  for (let index = 0; index < 50; index++) {
    const { host, webview } = hostWithWebview();
    const cleanup = mount(harness, BRANCH, { item: { ...URL_ITEM, id: `item-${index}` }, urlSrc: URL_SRC }, host);
    assert.equal(
      win.listenerCount('leave-full-screen'),
      baseline + 1,
      `第 ${index} 次切项挂载后应恰好比基线多 1 个监听（不叠加）`
    );
    peak = Math.max(peak, win.listenerCount('leave-full-screen'));

    // 回调语义不变（补清理不得改行为）：主进程发 leave-full-screen 时仍退出网页全屏。
    win.emit('leave-full-screen');
    assert.deepEqual(webview.executed, ['document.exitFullscreen();'], `第 ${index} 次：回调语义不变`);

    cleanup();
    assert.equal(win.listenerCount('leave-full-screen'), baseline, `第 ${index} 次卸载后必须精确摘除本轮监听`);
  }

  assert.equal(peak, baseline + 1, '全程峰值不得随切项次数增长');
  assert.equal(win.listenerCount('leave-full-screen'), baseline, '只保留同窗口其它消费者');

  win.off('leave-full-screen', peer);
  assert.equal(win.listenerCount('leave-full-screen'), 0);
});

test('M4-C / leave-full-screen：卸载幂等，重复调用不得误摘其它监听', () => {
  const harness = loadShell();
  const win = harness.win;
  const peer = () => {};
  win.on('leave-full-screen', peer);

  const { host } = hostWithWebview();
  const cleanup = mount(harness, BRANCH, { item: URL_ITEM, urlSrc: URL_SRC }, host);
  assert.equal(win.listenerCount('leave-full-screen'), 2);

  cleanup();
  cleanup();
  cleanup();
  assert.equal(win.listenerCount('leave-full-screen'), 1, '重复卸载后仍只保留 peer');
  assert.deepEqual(win.listeners('leave-full-screen'), [peer], 'peer 回调实例未被误摘');
});

test('M4-C / leave-full-screen：仅暴露 off 的桥也必须能摘除', () => {
  const stillRegistered = [];
  const withOffOnly = {
    on(_event, handler) { stillRegistered.push(handler); },
    off(_event, handler) {
      const index = stillRegistered.indexOf(handler);
      assert.ok(index >= 0, 'off 必须能按回调身份摘除');
      stillRegistered.splice(index, 1);
    },
  };
  const harness = loadShell({ win: withOffOnly });
  const { host } = hostWithWebview();
  const cleanup = mount(harness, BRANCH, { item: URL_ITEM, urlSrc: URL_SRC }, host);
  assert.equal(stillRegistered.length, 1);
  cleanup();
  assert.equal(stillRegistered.length, 0, '仅暴露 off 的桥也必须被摘除');
});

test('M4-C / leave-full-screen：无窗口代理时不注册也不抛错', () => {
  const harness = loadShell({ win: null });
  const { host } = hostWithWebview();
  const cleanup = mount(harness, BRANCH, { item: URL_ITEM, urlSrc: URL_SRC }, host);
  assert.doesNotThrow(() => cleanup());
});

/* ================= 悬垂引用：plugin-view 的挂载期递延 ================= */

const PLUGIN_ITEM = { id: 'item-plugin-1', ext: 'sketch' };
const PLUGIN_URL = 'plugin://viewer/index.html';
const PLUGIN = 'PreviewPluginView';

test('M4-C / plugin-view：卸载取消 dom-ready 后的 plugin-create/plugin-run，不再对已销毁 webview 调 send', () => {
  const harness = loadShell();
  // plugin-view 用 document.createElement 自建 webview（与 web-view 分支不同），
  // host 只负责 appendChild 挂载 → 首挂时 host 内还没有 webview。
  const appended = [];
  const host = {
    innerHTML: '',
    querySelector: () => null,
    appendChild: (node) => appended.push(node),
  };

  const cleanup = mount(harness, PLUGIN, { item: PLUGIN_ITEM, url: PLUGIN_URL }, host);
  assert.equal(harness.createdWebviews.length, 1, '首次挂载应创建 plugin webview');
  const webview = harness.createdWebviews[0];
  assert.deepEqual(appended, [webview], '首次挂载应把 webview 挂到 host');

  const domReady = webview.listeners.get('dom-ready');
  assert.ok(domReady && domReady.length === 1, 'dom-ready 监听应注册');

  domReady[0](); // dom-ready 到达 → 排队 100ms 的 plugin-create/plugin-run
  assert.equal(harness.clock.pending(), 1, 'dom-ready 后应排一个 100ms 递延');
  assert.deepEqual(webview.sent, [], '100ms 未到之前不得发送');

  cleanup(); // 卸载发生在递延窗口内
  harness.clock.advance(1000);
  assert.deepEqual(webview.sent, [], '卸载后不得再对 webview 调 send（原实现在此处会打到已销毁的 guest）');
  assert.equal(harness.clock.pending(), 0, '卸载后不得残留挂载期定时器');

  // 原有 $destroy 语义保留：卸载仍清空插件 webview 的 src。
  assert.equal(webview.attributes.get('src'), '', '原 scope.$on($destroy) 的清空 src 语义不得丢失');
});

test('M4-C / plugin-view：复用分支的 50ms 重设 src 在卸载后不得盖回', () => {
  const harness = loadShell();

  // 第一次挂载走 init 路径，使模块级 previewPluginWebViewInitialized 置位。
  const first = hostWithWebview();
  const cleanupFirst = mount(harness, PLUGIN, { item: PLUGIN_ITEM, url: PLUGIN_URL }, first.host);
  cleanupFirst();

  // 第二次挂载走复用路径：setAttribute('src','') 后 50ms 再设回 url。
  const second = hostWithWebview();
  const cleanupSecond = mount(harness, PLUGIN, { item: { ...PLUGIN_ITEM, id: 'item-plugin-2' }, url: PLUGIN_URL }, second.host);
  assert.equal(harness.createdWebviews.length, 1, '复用分支不得重建 webview');
  assert.equal(harness.clock.pending(), 1, '复用分支应排一个 50ms 递延');

  cleanupSecond();
  assert.equal(harness.clock.pending(), 0, '卸载必须取消 50ms 递延');
  harness.clock.advance(1000);
  assert.equal(
    harness.createdWebviews[0].attributes.get('src'),
    '',
    '卸载后不得把 src 设回 url（原实现会让一个已脱离文档的 webview 重新开始加载）'
  );
  assert.equal(harness.clock.pending(), 0);
});
