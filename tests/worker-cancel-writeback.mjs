/**
 * M3-3 —— 「取消任务不回写已关闭窗口」的回归网（W-3：`commentHooks.ts` 的 `useTifImage`）。
 *
 * ## 缺陷（只读审计确认，本文件把它变成可断言判据）
 * 原实现里 `onmessage` 的 `resolve()` 之后紧跟**裸 DOM 写入**（`$parent.appendChild(cnv)`、
 * `setCssEl(q('#detail-image'), …)`），而 effect cleanup 只做 `worker?.terminate()`：
 * `terminate()` 拦得住 onmessage 的**后续**投递，拦不住**已经 resolve** 的 Promise 的
 * `await` 续体——续体必然在微任务里跑完，于是关窗/换图之后照样往已脱离的树上写 canvas，
 * 甚至把 `#detail-image`（按 id **全局**查询）设成 `opacity: 0`，把新视图的图片弄透明。
 * 原 `:1122` 的「陈旧判定」拿 `e.data.url` 比本次入参 `url`——onmessage 注册在本次新建的
 * worker 上，回显值恒等于入参，该判定对任何陈旧响应都为假，是无效代码。
 *
 * ## 判据不是「源码里看起来加了 if」
 * 在 `node:vm` 里**真实装载** `commentHooks.ts`（只桩掉模块外依赖），用**假 Worker** 精确
 * 控制事件到达顺序，按**可观测计数**判定：`document.createElement` / `parentNode.appendChild`
 * / `setCssEl` 的调用次数。核心时序正是缺陷报告描述的那一瞬间：
 *
 *     onmessage 同步到达 → resolve() → **cleanup()** → 微任务续体才跑
 *
 * 每条断言都配「空洞防护」：先证明**不卸载时这些写入确实发生**，否则「卸载后没有写入」
 * 可能只是因为写入路径根本没被走到。
 *
 * ## 局限（明写）
 *  - 本文件用假 Worker 代表真实 worker 线程，断言的是**事件时序契约**（resolve 与
 *    terminate 的相对次序、微任务边界），**不是**活的 worker 线程；
 *  - `#detail-image` 的「关窗后 id 已属新视图」这一条**未被本测试覆盖**——它需要真实的
 *    详情窗重挂载，属实机路径。本测试只断言「卸载后根本不再写」这一更强的性质。
 *  - 未做 HEIC / TIF 的实机解码验证（见任务汇报的遗留项）。
 *
 * 运行：node tests/worker-cancel-writeback.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const HOOK_PATH = 'src/app/react/components/detail/commentHooks.ts';

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

const noop = () => undefined;

/* ---------------- 假 Worker：实例可被测试直接驱动 ---------------- */

class FakeWorker {
  constructor(url) {
    this.url = url;
    this.posted = [];
    this.terminateCount = 0;
    this.onmessage = null;
    this.onerror = null;
    FakeWorker.created.push(this);
  }
  postMessage(message) { this.posted.push(message); }
  terminate() { this.terminateCount++; }
  /** 同步投递一条响应——与真实 worker 一样，onmessage 在**当前**任务里跑完。 */
  emit(data) { this.onmessage({ data }); }
}
FakeWorker.created = [];

/* ---------------- commentHooks.ts 装载 ---------------- */

/** 每次装载独立 vm 上下文，模块级单例不在测试间串味。 */
function loadHookHarness({ current = { id: 'item-1', ext: 'tif' } } = {}) {
  FakeWorker.created = [];

  const effects = [];
  const refs = [];

  /* 可观测计数：这三样正是缺陷里「裸 DOM 写入」的全部出口。 */
  const domWrites = { createElement: 0, appendChild: 0, setCssEl: [] };

  const detailImageEl = { id: 'detail-image' };
  const fakeCanvas = () => ({
    width: 0,
    height: 0,
    setAttribute: noop,
    remove: noop,
    getContext: () => ({
      createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
      putImageData: noop,
    }),
  });

  const $parent = {
    // 首挂时没有遗留 canvas —— 走缺陷里那条「await 之后才写」的路径。
    querySelector: () => null,
    appendChild: () => { domWrites.appendChild++; },
  };
  const img = { parentNode: $parent, getAttribute: () => null };

  const windowStub = { appRoot: { path: '/app' }, electronLog: { info: noop } };
  windowStub.window = windowStub;

  const modules = {
    '../../core/fileUrlHelper': {
      FileUrlHelper: { getRawUrl: (item) => `file:///library/${item.id}.tif` },
    },
    react: {
      useEffect: (effect) => { effects.push(effect); },
      useRef: (initial) => { const ref = { current: initial }; refs.push(ref); return ref; },
      default: {},
    },
    '../../global/eagleGlobals': { t: (key) => key },
    './detailHooks': { safeZoomData: noop, getIpc: () => ({ send: noop }), req: () => undefined },
    '../../utils/domQuery': {
      q: () => detailImageEl, qa: () => [],
      widthOf: () => 0, heightOf: () => 0, offsetOf: () => ({ top: 0, left: 0 }),
      outerWidthOf: () => 0, outerHeightOf: () => 0, cssGet: () => '',
      setCssEl: (el, styles) => { domWrites.setCssEl.push({ el, styles }); },
      setHtmlEl: noop, focusEl: noop, blurEl: noop, onEl: noop, offEl: noop,
    },
    '../../store/detailState': { syncDetailFromScope: noop },
    '../../core/appCore': { runInBodyScope: (fn) => fn() },
    '../../services/imageOpsService': { saveCrop: noop },
    '../../core/itemDomain': { getRawPath: () => '' },
    '../../global/bus': {
      moveCropToolChannel: { emit: noop },
      rebindRefreshChannel: { emit: noop },
      resizeCropToolChannel: { emit: noop },
    },
    '../interactions/resizable': { makeResizable: noop },
    '../../store/selectionState': { useSelectionState: { getState: () => ({ current, selected: [] }) } },
    '../../store/bodyState': { useBodyState: { getState: () => ({}) } },
    '../../store/miscRawState': { useMiscRawState: { getState: () => ({}) }, writeRatio: noop },
  };

  const exported = {};
  vm.runInNewContext(transpile(HOOK_PATH), {
    console,
    Worker: FakeWorker,
    window: windowStub,
    document: {
      createElement: () => { domWrites.createElement++; return fakeCanvas(); },
      getElementById: () => null,
      querySelector: () => null,
    },
    exports: exported,
    require(name) {
      assert.ok(Object.hasOwn(modules, name), `${HOOK_PATH} 不得加载未隔离的依赖：${name}`);
      return modules[name];
    },
  }, { filename: HOOK_PATH });

  return { exported, effects, refs, domWrites, img, detailImageEl };
}

/**
 * React effect 语义的最小驱动：调用组件 → 把 `useRef` 的当前值补成夹具 →
 * 执行本次提交的 effect 并返回其 cleanup。
 */
function mountTifHook(harness, currentId) {
  const effectIndex = harness.effects.length;
  const refIndex = harness.refs.length;
  const imgRef = { current: harness.img };
  const element = harness.exported.useTifImage(imgRef, currentId);
  assert.equal(element, undefined, 'useTifImage 是 hook，不返回元素');
  for (let index = refIndex; index < harness.refs.length; index++) harness.refs[index].current = harness.img;
  assert.equal(harness.effects.length, effectIndex + 1, 'useTifImage 应提交恰好一个 effect');
  const cleanup = harness.effects[effectIndex]();
  assert.equal(typeof cleanup, 'function', 'useTifImage 的 effect 必须返回 cleanup');
  return cleanup;
}

/** 让在飞 Promise 的续体全部跑完（微任务边界）。 */
async function flushMicrotasks() {
  for (let index = 0; index < 20; index++) await Promise.resolve();
}

const TIF_PAYLOAD = { rgba: new Uint8Array(4), width: 1, height: 1, url: 'file:///library/item-1.tif' };

/* ================= 空洞防护：不卸载时写回**确实发生** ================= */

test('M3-3 / 对照：未卸载时 tif 结果照常写回（证明下面的「无写入」不是空洞通过）', async () => {
  const harness = loadHookHarness();
  const cleanup = mountTifHook(harness, 'item-1');

  const worker = FakeWorker.created[0];
  assert.ok(worker, '应创建一个 tifWorker');
  assert.equal(worker.url, '/src/app/js/workers/tifWorker.js', 'worker URL 字面量不得改动');
  // 信封来自 vm 上下文，其原型与本上下文不同 —— 只逐字段比对，不用 deepStrictEqual。
  assert.equal(worker.posted.length, 1, '一次请求只投递一条消息');
  assert.deepEqual(Object.keys(worker.posted[0]), ['url'], 'P3 请求信封只带 url，不多带字段');
  assert.equal(worker.posted[0].url, 'file:///library/item-1.tif', 'P3 请求信封不变');

  // await 之前已发生的同步写入：`#detail-image` 复位为不透明。基线计 1 次。
  assert.equal(harness.domWrites.setCssEl.length, 1, 'await 之前应有 1 次 setCssEl（复位 #detail-image）');
  assert.equal(harness.domWrites.createElement, 0, 'await 之前不得建 canvas');

  worker.emit(TIF_PAYLOAD);
  await flushMicrotasks();

  assert.equal(harness.domWrites.createElement, 1, '未卸载时 resume 后应建 canvas（写回路径确实可达）');
  assert.equal(harness.domWrites.appendChild, 1, '未卸载时应把 canvas 挂到宿主');
  assert.equal(harness.domWrites.setCssEl.length, 4, '未卸载时应有 4 次 setCssEl（1 基线 + cnv + img + #detail-image）');
  assert.ok(worker.terminateCount >= 1, '拿到响应后必须 terminate');

  cleanup();
});

/* ================= 缺陷回归：resolve 之后、写入之前卸载 ================= */

test('M3-3 / 取消写回：onmessage 已 resolve、DOM 写入之前卸载 → 卸载后零 DOM 写入', async () => {
  const harness = loadHookHarness();
  const cleanup = mountTifHook(harness, 'item-1');
  const worker = FakeWorker.created[0];

  const baselineSetCss = harness.domWrites.setCssEl.length; // = 1（await 之前的复位）
  assert.equal(baselineSetCss, 1);

  // ① worker 响应同步到达 → Promise 已 resolve（致命点：resolve 之后拦不住了）
  worker.emit(TIF_PAYLOAD);
  // ② 续体还排在微任务队列里，此刻卸载（关窗/换图都会走到这里）
  cleanup();
  // ③ 微任务这才开始跑
  await flushMicrotasks();

  assert.equal(
    harness.domWrites.createElement, 0,
    '卸载后不得再 createElement：await 续体一定会在微任务里跑完，只有 await 之后的闸门拦得住'
  );
  assert.equal(harness.domWrites.appendChild, 0, '卸载后不得再把 canvas 挂进已关闭的窗口');
  assert.equal(
    harness.domWrites.setCssEl.length, baselineSetCss,
    '卸载后不得再有任何 setCssEl（原实现会把 #detail-image 设成 opacity:0，弄透明新视图）'
  );
  assert.ok(
    harness.domWrites.setCssEl.every((call) => call.styles.opacity !== 0),
    '尤其不得出现 opacity:0 的全局写（#detail-image 是按 id 全局查询）'
  );
});

/* ================= 更早的时序：onmessage 到达前就卸载 ================= */

test('M3-3 / 取消写回：卸载发生在 onmessage 之前 → 迟到的响应同样不得写回', async () => {
  const harness = loadHookHarness();
  const cleanup = mountTifHook(harness, 'item-1');
  const worker = FakeWorker.created[0];

  cleanup();
  // 卸载之后 worker 才回消息（真实场景：terminate 前已 in-flight 的那条仍会排队）
  worker.emit(TIF_PAYLOAD);
  await flushMicrotasks();

  assert.equal(harness.domWrites.createElement, 0, '卸载后到达的响应不得写回');
  assert.equal(harness.domWrites.appendChild, 0, '卸载后到达的响应不得写回');
  assert.equal(harness.domWrites.setCssEl.length, 1, '只保留 await 之前的那一次复位写入');
});

test('M3-3 / 取消写回：卸载后的失败响应同样不得抛出未处理拒绝', async () => {
  const harness = loadHookHarness();
  const cleanup = mountTifHook(harness, 'item-1');
  const worker = FakeWorker.created[0];

  cleanup();
  assert.doesNotThrow(() => worker.emit({ error: 'Failed to load or process image' }));
  assert.doesNotThrow(() => worker.onerror(new Error('worker died')));
  await flushMicrotasks();

  assert.equal(harness.domWrites.createElement, 0);
  assert.equal(harness.domWrites.appendChild, 0);
});

/* ================= 换图（currentId 变化）：旧请求不得污染新视图 ================= */

test('M3-3 / 取消写回：换图后旧请求的响应不得写回新视图', async () => {
  const harness = loadHookHarness();
  const cleanupFirst = mountTifHook(harness, 'item-1');
  const firstWorker = FakeWorker.created[0];

  // 换图：React 先跑上一次 effect 的 cleanup，再跑新的 effect。
  cleanupFirst();
  const cleanupSecond = mountTifHook(harness, 'item-2');
  const secondWorker = FakeWorker.created[1];
  assert.notEqual(firstWorker, secondWorker, '换图应新建 worker');

  // 旧请求的响应姗姗来迟（它已经 resolve 过 Promise，续体还在微任务队列里）。
  firstWorker.emit(TIF_PAYLOAD);
  await flushMicrotasks();
  assert.equal(harness.domWrites.createElement, 0, '旧请求的响应不得在新视图上建 canvas');

  // 新请求照常写回——取消逻辑不得把正常路径一起掐掉。
  secondWorker.emit(TIF_PAYLOAD);
  await flushMicrotasks();
  assert.equal(harness.domWrites.createElement, 1, '新请求仍必须正常写回');

  cleanupSecond();
});
