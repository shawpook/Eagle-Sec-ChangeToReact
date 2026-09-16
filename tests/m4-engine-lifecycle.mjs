/**
 * M4-D —— 第三方引擎生命周期适配器（`viewers/shared/engineLifecycle.ts`）与六个 viewer 的收口验证。
 *
 * ## 判据不是「源码里看起来登记了」，而是两类可观测事实
 *
 * **一半：适配器本身在假环境下真实装载、真实驱动。**
 * `engineLifecycle.ts` 经 `ts.transpileModule` + `vm.runInNewContext` 装载（只桩掉 `react`
 * 与全局定时器/`URL`），用一个**记账假环境**观测存活集：定时器表、rAF 表、事件监听表、
 * object URL 表、桥订阅表。断言的是「卸载后这些表归零」，而不是「代码里有 clearXxx」。
 *
 * **另一半：六个 viewer 的取得点账本。** 逐个文件扫描「裸取得」调用
 * （裸 `setTimeout` / `setInterval` / `requestAnimationFrame` / `addEventListener` /
 * `createObjectURL` / `new AudioContext` / `xxx.on(`）：每一处要么带登记标记
 * （`lc.` / `lcRef.current` / `useEngineLifecycle`），要么在**逐字白名单**里并写明理由。
 * 白名单条目按出现次数对账——行文本一改就对不上，强制重新审计，不会静默失效。
 *
 * ## 空洞防护
 * 每条「归零」断言之前，都先断言该资源**确实被取得过**（存活集非空、`pending > 0`）。
 * 否则「没取得所以没泄漏」也会让测试变绿。
 *
 * ## 局限（明写，不掩饰）
 * 1. `useEngineLifecycle` 的挂钩测试用的是**自制 React 桩**（只实现 `useEffect` / `useRef`），
 *    断言的是「hook 的接线合同」：建立 → setup → 卸载时 dispose、卸载后 `ref.current` 归 null。
 *    **不是**活的 React 渲染器（无并发、无 StrictMode 双调用、无 deps 变化重跑）。
 * 2. 本测试不驱动任何真实引擎（SuperGif / MediumEditor / FontFace / dcraw / AudioContext）。
 *    「引擎自身的内部状态被清干净」不在覆盖范围内——只有**它被登记并调用了释放**在范围内。
 * 3. `pending` 是「已登记的释放动作数」的上界：对「取消上一轮再排下一轮」的节流写法
 *    （font 的 scrollTop 写盘），已 clear 的空壳仍留在登记里，故 `pending` 可大于存活定时器数。
 *    真正的不变量是**存活集为 0**，由假环境的表断言；`pending` 只作辅助。
 * 4. 六个 viewer 均为「整页渲染一次」的岛（`createRoot(...).render(...)` 在模块求值期），
 *    **生产路径上不会发生卸载**。这里的价值是把生命周期变成结构、把遗留接上释放点，
 *    使其在将来被嵌入可反复挂载的宿主时不泄漏；**真机反复挂载/卸载未做实测**。
 *
 * 运行：node tests/m4-engine-lifecycle.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const ADAPTER_PATH = 'src/app/react/viewers/shared/engineLifecycle.ts';
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function transpile(path) {
  const { outputText, diagnostics } = ts.transpileModule(read(path), {
    fileName: path,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  assert.equal(diagnostics.length, 0, `${path} 转译应无诊断`);
  return outputText;
}

/* ================= 记账假环境 ================= */

/** 假时钟 + 假 object URL：按 id 记名，卸载后应一个不剩。 */
function createFakeEnv() {
  const timers = new Map();
  const urls = new Map();
  let seq = 0;
  let urlSeq = 0;
  return {
    timers,
    urls,
    setTimeout: (fn, ms) => { const id = ++seq; timers.set(id, { kind: 'timeout', ms: Number(ms) || 0, fn }); return id; },
    clearTimeout: (id) => { timers.delete(id); },
    setInterval: (fn, ms) => { const id = ++seq; timers.set(id, { kind: 'interval', ms: Number(ms) || 0, fn }); return id; },
    clearInterval: (id) => { timers.delete(id); },
    requestAnimationFrame: (cb) => { const id = ++seq; timers.set(id, { kind: 'raf', fn: cb }); return id; },
    cancelAnimationFrame: (id) => { timers.delete(id); },
    URL: {
      createObjectURL: (blob) => { const url = `blob:fake/${++urlSeq}`; urls.set(url, blob); return url; },
      revokeObjectURL: (url) => { urls.delete(url); },
    },
    liveTimers: () => timers.size,
    liveUrls: () => urls.size,
    /** 当前挂着的计时器种类（用于证明确实排过，避免空洞通过）。 */
    kinds: () => [...timers.values()].map((timer) => timer.kind).sort(),
    /** 触发一个已排程的计时器（触发前先摘除，等价于真实一次性触发）。 */
    fire: (id) => { const timer = timers.get(id); if (!timer) return false; timers.delete(id); timer.fn(); return true; },
  };
}

/** 最小 EventTarget：只记账 add/remove，不派发。 */
function createFakeTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      const set = listeners.get(type);
      if (set) set.delete(handler);
    },
    count: () => { let n = 0; for (const set of listeners.values()) n += set.size; return n; },
  };
}

/** 假 IPC 桥：按「本仓 ipcRenderer 的三代形态」逐一路径构造，并记账退订是否被调。 */
function createFakeBridge(mode) {
  const state = { subscribed: 0, unsubscribed: 0, channels: [] };
  const bridge = {
    on(channel, handler) {
      state.subscribed++;
      state.channels.push(channel);
      if (mode === 'returns-unsubscribe') return () => { state.unsubscribed++; };
      return undefined;
    },
    off(channel) { state.unsubscribed++; },
    removeListener(channel) { state.unsubscribed++; },
    addListener(channel) { state.subscribed++; state.channels.push(channel); },
    state,
  };
  if (mode === 'on-only') { delete bridge.off; delete bridge.removeListener; }
  if (mode === 'on-off') { delete bridge.removeListener; }
  if (mode === 'on-removeListener') { delete bridge.off; }
  if (mode === 'addListener-removeListener') { delete bridge.on; delete bridge.off; }
  if (mode === 'inert') { delete bridge.on; delete bridge.off; delete bridge.removeListener; delete bridge.addListener; }
  return bridge;
}

/**
 * React 桩：只保留 `useEngineLifecycle` 用到的两个 hook，并把 effect 排进队列由测试驱动。
 * 用闭包而非 `this`：TS 的 CJS 输出把导入的调用编成 `(0, react_1.useEffect)(...)`，
 * `this` 是 undefined。
 */
function createReactStub() {
  const effects = [];
  return {
    effects,
    useEffect(fn) { effects.push(fn); },
    useRef(value) { return { current: value }; },
  };
}

/** 在每个测试内新建沙箱并装载真实适配器源码。 */
function loadAdapter() {
  const env = createFakeEnv();
  const reactStub = createReactStub();
  const errors = [];
  const sandbox = {
    module: { exports: {} },
    exports: {},
    require(name) {
      if (name === 'react') return reactStub;
      throw new Error(`测试未桩接的模块：${name}`);
    },
    console: { error: (...args) => { errors.push(args); }, log: () => {}, warn: () => {} },
    setTimeout: env.setTimeout,
    clearTimeout: env.clearTimeout,
    setInterval: env.setInterval,
    clearInterval: env.clearInterval,
    requestAnimationFrame: env.requestAnimationFrame,
    cancelAnimationFrame: env.cancelAnimationFrame,
    URL: env.URL,
  };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(transpile(ADAPTER_PATH), sandbox, { filename: ADAPTER_PATH });
  const exports = sandbox.module.exports;
  assert.equal(typeof exports.EngineLifecycle, 'function', '适配器应导出 EngineLifecycle');
  assert.equal(typeof exports.createEngineLifecycle, 'function', '适配器应导出 createEngineLifecycle');
  assert.equal(typeof exports.useEngineLifecycle, 'function', '适配器应导出 useEngineLifecycle');
  return { env, reactStub, errors, ...exports };
}

const noop = () => {};
const BLOB = { size: 1 };

/* ================= A. 适配器：挂载期取得 → 卸载后归零 ================= */

test('M4-D/L1 适配器：五类取得全部进同一个释放点，dispose 后存活集归零', () => {
  const { env, createEngineLifecycle } = loadAdapter();
  const lc = createEngineLifecycle();
  const target = createFakeTarget();
  const bridge = createFakeBridge('returns-unsubscribe');
  const released = [];

  lc.timeout(noop, 10);
  lc.interval(noop, 20);
  lc.raf(noop);
  lc.listen(target, 'wheel', noop, { passive: false });
  lc.subscribe(bridge, 'native-preview-failed', noop);
  lc.objectUrl(BLOB);
  lc.own({ id: 'engine' }, (value) => { released.push(`own:${value.id}`); });
  lc.onDispose(() => { released.push('custom'); });

  // 空洞防护：先证明确实取得了，否则下面的「归零」是空洞通过
  assert.equal(env.liveTimers(), 3, 'timeout + interval + raf 都应真实排程');
  assert.deepEqual(env.kinds(), ['interval', 'raf', 'timeout']);
  assert.equal(env.liveUrls(), 1, 'object URL 应真实创建');
  assert.equal(target.count(), 1, '监听应真实挂上');
  assert.equal(bridge.state.subscribed, 1, '桥订阅应真实建立');
  assert.equal(lc.pending, 8, '八项登记应都在册');

  lc.dispose();

  assert.equal(env.liveTimers(), 0, '卸载后不得残留定时器/rAF');
  assert.equal(env.liveUrls(), 0, '卸载后不得残留 object URL（原 raw 实现漏 revoke）');
  assert.equal(target.count(), 0, '卸载后不得残留监听');
  assert.equal(bridge.state.unsubscribed, 1, '卸载后桥订阅必须退订');
  assert.equal(lc.pending, 0, '登记表应清空');
  assert.deepEqual(released.sort(), ['custom', 'own:engine'], '自有释放动作应被调用');
  assert.equal(lc.disposed, true);
});

test('M4-D/L2 适配器：dispose 幂等——重复调用不重放释放动作', () => {
  const { env, createEngineLifecycle } = loadAdapter();
  const lc = createEngineLifecycle();
  const target = createFakeTarget();
  let calls = 0;
  lc.timeout(noop, 1);
  lc.listen(target, 'x', noop);
  lc.onDispose(() => { calls++; });

  lc.dispose();
  lc.dispose();
  lc.dispose();

  assert.equal(calls, 1, '释放动作必须恰好执行一次');
  assert.equal(env.liveTimers(), 0);
  assert.equal(target.count(), 0);
});

test('M4-D/L3 适配器：释放按登记逆序（后取得先释放）', () => {
  const { createEngineLifecycle } = loadAdapter();
  const lc = createEngineLifecycle();
  const order = [];
  lc.onDispose(() => order.push('first-acquired'));
  lc.onDispose(() => order.push('second-acquired'));
  lc.onDispose(() => order.push('third-acquired'));
  lc.dispose();
  assert.deepEqual(order, ['third-acquired', 'second-acquired', 'first-acquired']);
});

test('M4-D/L4 适配器：卸载之后到达的取得就地释放，不挂到已死的生命周期上', () => {
  const { env, createEngineLifecycle } = loadAdapter();
  const lc = createEngineLifecycle();
  const target = createFakeTarget();
  const bridge = createFakeBridge('on-off');
  const stamp = [];
  lc.dispose();

  assert.equal(lc.timeout(() => stamp.push('late-timeout'), 5), 0, 'disposed 后不得排程，返回 0');
  assert.equal(lc.interval(() => stamp.push('late-interval'), 5), 0);
  assert.equal(lc.raf(() => stamp.push('late-raf')), 0);
  assert.equal(lc.objectUrl(BLOB), '', 'disposed 后不得创建 object URL');
  lc.listen(target, 'x', noop);
  lc.subscribe(bridge, 'ch', noop);
  lc.own({ id: 'late' }, (value) => { stamp.push(`late-own:${value.id}`); });
  lc.onDispose(() => { stamp.push('late-custom'); });

  assert.equal(env.liveTimers(), 0, '晚到的定时器/rAF 一律不得排程');
  assert.equal(env.liveUrls(), 0, '晚到的 object URL 一律不得创建');
  assert.equal(target.count(), 0, '晚到的监听不得挂上');
  assert.equal(bridge.state.subscribed, 0, '晚到的桥订阅不得建立');
  assert.deepEqual(stamp, ['late-own:late', 'late-custom'], '晚到取得的释放动作必须就地执行');
  assert.equal(lc.pending, 0, '就地释放不进登记表');
});

test('M4-D/L5 适配器：单个释放动作抛错不阻断其余（否则一个坏引擎拖垮同挂载期）', () => {
  const { env, errors, createEngineLifecycle } = loadAdapter();
  const lc = createEngineLifecycle();
  const target = createFakeTarget();
  let after = 0;
  lc.onDispose(() => { throw new Error('引擎释放失败'); });
  lc.listen(target, 'x', noop);
  lc.timeout(noop, 1);
  lc.onDispose(() => { after++; });

  lc.dispose();

  assert.equal(after, 1, '抛错之后的释放动作仍须执行');
  assert.equal(target.count(), 0);
  assert.equal(env.liveTimers(), 0);
  assert.equal(lc.pending, 0);
  assert.equal(errors.length, 1, '抛错应被记录而非吞掉');
  assert.match(String(errors[0][0]), /engineLifecycle/);
});

test('M4-D/L6 适配器：subscribe 覆盖桥的三代形态，且能力不足时静默不订', () => {
  const { createEngineLifecycle } = loadAdapter();
  const cases = [
    ['returns-unsubscribe', 1],
    ['on-off', 1],
    ['on-removeListener', 1],
    ['addListener-removeListener', 1],
    ['on-only', 1],
    ['inert', 0],
  ];
  for (const [mode, expectSubscribed] of cases) {
    const lc = createEngineLifecycle();
    const bridge = createFakeBridge(mode);
    lc.subscribe(bridge, 'ch', noop);
    assert.equal(bridge.state.subscribed, expectSubscribed, `${mode}: 订阅数`);
    lc.dispose();
    if (expectSubscribed === 1 && mode !== 'on-only') {
      assert.equal(bridge.state.unsubscribed, 1, `${mode}: 退订数`);
    }
  }
  // 桥缺失（原 native 的 `if (ipcRendererRef && ...)` 分支）不得抛错
  const lc = createEngineLifecycle();
  assert.doesNotThrow(() => lc.subscribe(null, 'ch', noop));
  assert.doesNotThrow(() => lc.subscribe(undefined, 'ch', noop));
  lc.dispose();
});

test('M4-D/L7 适配器：就绪是形状里的一相，与卸载成对', () => {
  const { createEngineLifecycle } = loadAdapter();
  const lc = createEngineLifecycle();
  assert.equal(lc.ready, false, '未 markReady 前不就绪');
  lc.markReady();
  lc.markReady();
  assert.equal(lc.ready, true, 'markReady 幂等');
  lc.dispose();
  assert.equal(lc.ready, false, '卸载后必须不再就绪（原实现 body.ready 类会残留）');
  lc.markReady();
  assert.equal(lc.ready, false, '卸载后的 markReady 是 no-op');
});

test('M4-D/L8 适配器：pending 是上界——取消重排的节流不会让存活定时器滞留', () => {
  const { env, createEngineLifecycle } = loadAdapter();
  const lc = createEngineLifecycle();
  // 复刻 font 的 scrollTop 写盘：每来一次事件就取消上一轮、再排下一轮。
  // 这里的 clearTimeout 必须是**假环境**的——否则取消的是真实 timer，假时钟里五轮全存活，
  // 测试会以「泄漏」的假象失败（这一处本身就是「假环境必须接管全部取得与释放」的样本）。
  let scrollTimer = 0;
  for (let i = 0; i < 5; i++) {
    env.clearTimeout(scrollTimer);
    scrollTimer = lc.timeout(noop, 500);
  }
  assert.equal(env.liveTimers(), 1, '只有最后一轮是活的');
  assert.equal(lc.pending, 5, 'pending 是登记数（上界），不是存活数');
  lc.dispose();
  assert.equal(env.liveTimers(), 0, '不变量是存活集归零');
  assert.equal(lc.pending, 0, 'dispose 后登记表清空');
});

/* ================= B. hook 接线合同 ================= */

test('M4-D/L9 useEngineLifecycle：反复挂载/卸载后存活集恒为 0（含空洞防护）', () => {
  const { env, reactStub, useEngineLifecycle } = loadAdapter();
  const target = createFakeTarget();
  const bridge = createFakeBridge('returns-unsubscribe');

  for (let cycle = 1; cycle <= 5; cycle++) {
    let sawLifecycle = null;
    const ref = useEngineLifecycle((lc) => {
      sawLifecycle = lc;
      lc.timeout(noop, 30);
      lc.raf(noop);
      lc.listen(target, 'keydown', noop);
      lc.subscribe(bridge, 'ch', noop);
      lc.objectUrl(BLOB);
      lc.markReady();
    }, []);

    assert.equal(reactStub.effects.length, 1, `第 ${cycle} 轮：hook 应恰好登记一个 effect`);
    const effect = reactStub.effects.shift();
    // 挂载之前 ref 应为空（effect 还没跑）
    assert.equal(ref.current, null, `第 ${cycle} 轮：effect 执行前 ref 应为空`);
    const cleanup = effect();

    // 空洞防护：这一轮必须真的取得了资源
    assert.equal(ref.current, sawLifecycle, `第 ${cycle} 轮：挂载期内 ref 应指向本周期生命周期`);
    assert.equal(ref.current.ready, true);
    assert.ok(ref.current.pending >= 5, `第 ${cycle} 轮：登记数应 >= 5，实际 ${ref.current.pending}`);
    assert.equal(env.liveTimers(), 2, `第 ${cycle} 轮：timeout + raf 应为活`);
    assert.equal(env.liveUrls(), 1);
    assert.equal(target.count(), 1);
    assert.equal(bridge.state.subscribed, cycle, `第 ${cycle} 轮：累计订阅数应等于轮数`);

    cleanup();

    assert.equal(ref.current, null, `第 ${cycle} 轮：卸载后 ref 应归空`);
    assert.equal(env.liveTimers(), 0, `第 ${cycle} 轮：卸载后不得残留定时器/rAF`);
    assert.equal(env.liveUrls(), 0, `第 ${cycle} 轮：卸载后不得残留 object URL`);
    assert.equal(target.count(), 0, `第 ${cycle} 轮：卸载后不得残留监听`);
    assert.equal(bridge.state.unsubscribed, cycle, `第 ${cycle} 轮：退订数应与轮数同步增长`);
  }

  assert.equal(env.liveTimers(), 0, '五轮之后存活定时器仍应为 0（未随轮数增长）');
  assert.equal(target.count(), 0, '五轮之后监听数仍应为 0（未随轮数增长）');
  assert.equal(env.liveUrls(), 0, '五轮之后 object URL 仍应为 0（未随轮数增长）');
});

/* ================= C. 六个 viewer 的取得点账本 ================= */

/** 登记标记：出现任一即视为已交由释放点管理。 */
const REGISTRATION_MARKERS = ['lc.', 'lcRef.current', 'useEngineLifecycle'];

/** 「裸取得」模式：命中即需登记，否则必须在白名单里。 */
const ACQUISITION_PATTERNS = [
  ['裸 setTimeout', /(?:^|[^.\w$])(?:window\.)?setTimeout\s*\(/],
  ['裸 setInterval', /(?:^|[^.\w$])(?:window\.)?setInterval\s*\(/],
  ['裸 requestAnimationFrame', /(?:^|[^.\w$])(?:window\.)?requestAnimationFrame\s*\(/],
  ['裸 addEventListener', /addEventListener\s*\(/],
  ['裸 createObjectURL', /createObjectURL\s*\(/],
  ['裸 AudioContext', /new\s+AudioContext\s*\(/],
  ['裸 Emitter.on', /\b\w+\.on\s*\(/],
];

/**
 * 每个文件的逐字白名单（trim 后整行文本 → 出现次数）与理由。
 * 条目按文本钉死：改了行文本就对不上，测试失败并强制重新审计。
 */
const VIEWER_LEDGER = {
  'src/app/react/viewers/raw/entry.tsx': { clean: true, allow: {} },
  'src/app/react/viewers/gif/entry.tsx': { clean: true, allow: {} },
  'src/app/react/viewers/media/audio/AudioViewer.tsx': { clean: true, allow: {} },
  'src/app/react/viewers/native/entry.tsx': {
    clean: false,
    allow: {
      "task.on('close', onClose);": {
        count: 1,
        reason: 'qlmanage 子进程的 close 监听：紧随其后由 lc.onDispose(removeListener) 回收；'
          + '子进程自身不 kill（kill 会改变产物语义，见该文件头「未接管项」）。',
      },
    },
  },
  'src/app/react/viewers/text-editor/entry.tsx': {
    clean: false,
    allow: {
      'timeout = setTimeout(later, wait);': {
        count: 1,
        reason: '文件内联 debounce 的内部 timer——逐字移植的算法本体（本文件头即以此为据），M4-D 不改其实现。',
      },
      'timer = setTimeout(exec, delay);': {
        count: 1,
        reason: '文件内联 throttle 的内部 timer——同上，逐字移植的算法本体。',
      },
      'timer = setTimeout(exec, -diff);': {
        count: 1,
        reason: '文件内联 throttle 的 immediate 分支——同上，逐字移植的算法本体。',
      },
      "tempWStream.on('error', function (err: any) {": {
        count: 1,
        reason: '每次保存即建即用的写流：流由 tempWStream.end() 自行收尾，不跨挂载周期存活。',
      },
      "tempWStream.on('finish', function () {": {
        count: 1,
        reason: '同上，写流 finish 回调。',
      },
      'window.setTimeout(function () {': {
        count: 1,
        reason: 'selectAllContent 的 1ms 递延选区：整段（含递延）是模板 selectall 指令的单次用户动作，'
          + '不跨挂载周期取得资源。',
      },
    },
  },
  'src/app/react/viewers/font/entry.tsx': {
    clean: false,
    allow: {
      'timer = setTimeout(exec, delay);': {
        count: 1,
        reason: '文件内联 throttle 的内部 timer——逐字移植的算法本体，M4-D 不改其实现。',
      },
      'timer = setTimeout(exec, -diff);': {
        count: 1,
        reason: '文件内联 throttle 的 immediate 分支——同上。',
      },
      'window.setTimeout(function () {': {
        count: 1,
        reason: 'selectContents 的 1ms 递延选区：模板 selectall 指令的单次用户动作，不跨挂载周期取得资源。',
      },
    },
  },
};

const VIEWER_FILES = Object.keys(VIEWER_LEDGER);

test('M4-D/L10 账本：六个 viewer 都接上了适配器，且没有绕过它的裸取得', () => {
  const problems = [];
  const observedTotals = {};

  for (const rel of VIEWER_FILES) {
    const source = read(rel);
    const allow = VIEWER_LEDGER[rel].allow;
    const observed = new Map();

    source.split('\n').forEach((rawLine, index) => {
      const line = rawLine.trim();
      if (!line) return;
      if (REGISTRATION_MARKERS.some((marker) => line.includes(marker))) return;
      const hit = ACQUISITION_PATTERNS.find(([, pattern]) => pattern.test(line));
      if (!hit) return;
      if (Object.prototype.hasOwnProperty.call(allow, line)) {
        observed.set(line, (observed.get(line) || 0) + 1);
        return;
      }
      problems.push(`${rel}:${index + 1} 【${hit[0]}】${line}`);
    });

    observedTotals[rel] = observed;

    // 白名单对账：声明的条目必须都出现，且次数一致
    for (const [line, entry] of Object.entries(allow)) {
      const actual = observed.get(line) || 0;
      assert.equal(actual, entry.count,
        `${rel} 白名单条目与实测不符：\n  行：${line}\n  声明 ${entry.count} 次，实测 ${actual} 次\n  理由：${entry.reason}`);
    }
  }

  assert.deepEqual(problems, [],
    `以下取得点既未登记到释放点、也不在白名单里：\n${problems.join('\n')}`);

  // 反向对照：三个声明 clean 的文件确实一处白名单都没有（否则 clean 是假的）
  for (const rel of VIEWER_FILES) {
    if (!VIEWER_LEDGER[rel].clean) continue;
    assert.deepEqual(Object.keys(VIEWER_LEDGER[rel].allow), [], `${rel} 若声称 clean 就不该有白名单`);
  }
});

test('M4-D/L11 账本：六个 viewer 都从 shared/engineLifecycle 取用（路径逐一核对）', () => {
  const expectedSpecifier = {
    'src/app/react/viewers/raw/entry.tsx': ["'../shared/engineLifecycle';"],
    'src/app/react/viewers/gif/entry.tsx': ["'../shared/engineLifecycle';"],
    'src/app/react/viewers/native/entry.tsx': ["'../shared/engineLifecycle';"],
    'src/app/react/viewers/text-editor/entry.tsx': ["'../shared/engineLifecycle';"],
    'src/app/react/viewers/font/entry.tsx': ["'../shared/engineLifecycle';"],
    // AudioViewer.tsx 沿用该文件既有的「无分号」风格，故 import 行逐字无分号。
    'src/app/react/viewers/media/audio/AudioViewer.tsx': ["'../../shared/engineLifecycle'"],
  };
  for (const [rel, specifiers] of Object.entries(expectedSpecifier)) {
    const source = read(rel);
    for (const specifier of specifiers) {
      const line = `import { useEngineLifecycle } from ${specifier}`;
      assert.ok(source.includes(line), `${rel} 应逐字包含：${line}`);
    }
  }
});

test('M4-D/L12 账本：已迁移的取得点确实是「登记态」而非只是删掉', () => {
  // 名称逐一钉死，防止「把裸调用删了但也没登记」这种假通过。
  const required = {
    'src/app/react/viewers/raw/entry.tsx': [
      'lc.raf(', 'lc.timeout(', 'lc.objectUrl(', 'lc.disposed',
    ],
    'src/app/react/viewers/gif/entry.tsx': [
      'lc.onDispose(', 'lc.own(', 'lc.timeout(', 'lc.disposed',
    ],
    'src/app/react/viewers/native/entry.tsx': [
      'lcRef.current', 'lc.timeout(', 'lc.subscribe(', 'lc.onDispose(', 'lc.disposed',
    ],
    'src/app/react/viewers/text-editor/entry.tsx': [
      'lcRef.current?.listen(', 'lcRef.current?.timeout(', 'lcRef.current?.',
    ],
    'src/app/react/viewers/font/entry.tsx': [
      // font 的两处 effect 各自取 `const lc = lcRef.current` 后使用局部 `lc`，
      // 渲染作用域的回调（changeFontName）则走 `lcRef.current?.timeout(`。
      'const lc = lcRef.current;', 'lcRef.current?.timeout(', 'lc.listen(',
      'lc.timeout(', 'lc.own(', 'lc.onDispose(', 'lc.disposed',
    ],
    'src/app/react/viewers/media/audio/AudioViewer.tsx': [
      'lc.own(new AudioContext()', 'lc.onDispose(', 'lc.disposed',
    ],
  };
  for (const [file, needles] of Object.entries(required)) {
    const source = read(file);
    for (const needle of needles) {
      assert.ok(source.includes(needle), `${file} 应包含登记调用 ${needle}`);
    }
  }
  // 三处「只加不减」的 DOM 类/字体集副作用都必须成对回退
  assert.ok(read('src/app/react/viewers/gif/entry.tsx').includes("document.body.classList.remove(renderClass)"),
    'gif 的 body render-* 类必须回退');
  assert.ok(read('src/app/react/viewers/native/entry.tsx').includes("document.body.classList.remove('ready')"),
    'native 的 body.ready 类必须回退');
  assert.ok(read('src/app/react/viewers/font/entry.tsx').includes('document.fonts.delete(font)'),
    'font 的 FontFace 必须从 document.fonts 摘除');
  // 反向：三处该回退但原先没有的 remove 不得凭空出现在别处
  assert.equal(read('src/app/react/viewers/native/entry.tsx').split("classList.remove('ready')").length - 1, 1,
    'native 的 ready 类回退应恰好一处');
});
