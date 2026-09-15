/**
 * F06 验收（前端）：旋转/翻转写回。
 *
 * 覆盖三组断言：
 *  (a) 能力不可用时 rotate/flip **明确失败**——不抛错（含原 `undefined.then` 的 TypeError）、
 *      不改成功状态、不更新视图、不发成功事件、不派发 `regenerate-thumbnail`、不写元数据；
 *  (b) 宽高写入走**支持宽高的路由**（渲染层唯一元数据通道 `images-change`，其载荷即
 *      `item.updateMany` 的快照）且**只写一次**，并以 `item:operation-result` 回执校验是否落库；
 *  (c) 预览窗与主窗调用**同一个**写回函数（单一实现），且解桩后 moduleRegistry 走真实加载。
 *
 * 第三批变更（本文件被授权的改动，全部为**收紧**而非放宽）：
 *  1. `moduleRegistry.ts` 的 rotateImage/flipImage 两行空桩已解为 `loadJsModule(req)`。
 *     原 (c) 中「仍返回空桩」的形态断言若留在原处即为**错的守护**，故**替换**为
 *     「不得再无条件返回空桩 + 必须走 loadJsModule」；能力判据（空桩/非函数 → 明确失败）
 *     本身与解桩无关，**逐字保留**。
 *  2. 引入格式分流后，落点由扩展名决定（.jpg/.jpeg → 渲染层，其余 → 后端）。本文件原有的
 *     渲染层路由断言（(a) 的能力/路径/可写性、真实写入失败）此前用 `.png` 条目做夹具——
 *     那些夹具早于分流，语义上是在测**渲染层一路**，故其扩展名改为 `.jpg` 以继续落在同一
 *     分支；断言语句本身一条未改。后端一路的覆盖见 `tests/image-transform-dispatch.mjs`。
 *  3. vm 上下文补 `process.versions.electron`：本模块的目标运行环境就是 Electron 渲染层，
 *     缺省环境判定（与 `core/shim/environment.ts:18-20` 同源）据此判为 electron；
 *     非 electron 态的明确失败由 `tests/image-transform-dispatch.mjs` 显式覆盖。
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const WB_PATH = 'src/app/react/services/imageTransformWriteback.ts';
const ROUTE_PATH = 'src/app/react/services/imageTransformRoute.ts';
const MAIN_PATH = 'src/app/react/services/imageOpsService.ts';
const PREVIEW_PATH = 'src/app/react/preview-window/controller.ts';
const REGISTRY_PATH = 'src/app/react/core/shim/moduleRegistry.ts';
const CHANNEL_BRIDGE_PATH = 'src/app/react/core/channelBridge.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/** `core/shim/moduleRegistry.ts:106-107` **解桩前**的空桩形态。
 *  第三批已解桩，此常量保留用于守护判据本身（空桩/非函数必须被判为能力不可用）。 */
const EMPTY_STUB = () => {};

/** Electron 渲染层的全局面：写回模块与其紧邻模块须在**同一环境事实**下求值，
 *  否则 `resolveImageTransformDispatch` 的缺省环境判定会因 realm 不同而分叉。 */
const ELECTRON_RENDERER_PROCESS = { versions: { electron: '22.3.7', node: '22.0.0' } };

/** 紧邻模块（`imageTransformRoute.ts`）的内存转译装载：与写回模块共用同一 window / 环境。 */
function loadRoute(win, runtime) {
  const { outputText, diagnostics } = ts.transpileModule(read(ROUTE_PATH), {
    fileName: ROUTE_PATH,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  assert.equal(diagnostics.length, 0, `${ROUTE_PATH} 转译应无诊断`);
  const exports = {};
  vm.runInNewContext(outputText, {
    console,
    exports,
    window: win,
    ...(runtime === 'electron' ? { process: ELECTRON_RENDERER_PROCESS } : {}),
    require(name) {
      assert.fail(`紧邻模块 ${ROUTE_PATH} 不得有未隔离的依赖：${name}`);
    },
  }, { filename: ROUTE_PATH });
  return exports;
}

function loadWriteback({ window: win = {}, getIpcBus = () => null, runtime = 'electron' } = {}) {
  const imports = {
    '../core/channelBridge': { getIpcBus },
    './imageTransformRoute': loadRoute(win, runtime),
  };
  const { outputText, diagnostics } = ts.transpileModule(read(WB_PATH), {
    fileName: WB_PATH,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  assert.equal(diagnostics.length, 0, `${WB_PATH} 转译应无诊断`);
  const exports = {};
  vm.runInNewContext(outputText, {
    console,
    exports,
    window: win,
    ...(runtime === 'electron' ? { process: ELECTRON_RENDERER_PROCESS } : {}),
    require(name) {
      assert.ok(Object.hasOwn(imports, name), `禁止加载未隔离的依赖：${name}`);
      return imports[name];
    },
  }, { filename: WB_PATH });
  return exports;
}

/** 确定性计时器：去抖与回执超时都进同一队列，由测试显式推进。 */
function fakeTimers() {
  const queue = [];
  const schedule = (fn) => { queue.push(fn); return fn; };
  return {
    schedule,
    setTimer: schedule,
    cancel: (fn) => { const index = queue.indexOf(fn); if (index >= 0) queue.splice(index, 1); },
    pending: () => queue.length,
    flush: () => { queue.splice(0, queue.length).forEach((fn) => fn()); },
  };
}

async function drain(timers, rounds = 8) {
  for (let i = 0; i < rounds; i += 1) {
    timers.flush();
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function recorder() {
  const events = [];
  const logs = [];
  return {
    events,
    logs,
    log: {
      info: (message) => { logs.push(['info', message]); events.push(['info', message]); },
      warn: (message) => { logs.push(['warn', message]); events.push(['warn', message]); },
      error: (message, detail) => { logs.push(['error', message]); events.push(['error', message, detail]); },
    },
    kinds: () => events.map((entry) => entry[0]),
    all: (kind) => events.filter((entry) => entry[0] === kind),
  };
}

function baseHooks(timers, rec) {
  return {
    schedule: timers.schedule,
    cancel: timers.cancel,
    setTimer: timers.setTimer,
    log: rec.log,
    setIsRotating: (value) => rec.events.push(['isRotating', value]),
    updateItemView: () => rec.events.push(['updateItemView']),
    relayout: () => rec.events.push(['relayout']),
    regenerateThumbnail: () => rec.events.push(['regenerate-thumbnail']),
    imagesChange: () => rec.events.push(['imagesChange']),
    showError: (code, reason) => rec.events.push(['showError', code, reason]),
    checkWritable: () => null,
  };
}

// ───────────────────────────── (a) 能力不可用 → 明确失败 ─────────────────────────────

for (const [kind, extra] of [['rotate', { degree: -90 }], ['flip', { flipType: 'horizontal', writeToFile: true }]]) {
  test(`(a) ${kind}：能力未接线时空桩必须被拒——不抛错、不改状态、不更新视图、不发成功事件、不重生成缩略图`, () => {
    const wb = loadWriteback();
    const timers = fakeTimers();
    const rec = recorder();
    const item = { id: 'I1', name: 'a.jpg', width: 800, height: 600, orientation: 6 };
    const snapshot = { width: item.width, height: item.height, orientation: item.orientation };

    let acceptance;
    assert.doesNotThrow(() => {
      acceptance = wb.commitImageTransform({
        kind,
        item,
        rawPath: 'C:/lib/a.jpg',
        mode: 'write',
        request: () => EMPTY_STUB,
        appRootPath: '/src',
        hooks: baseHooks(timers, rec),
        ...extra,
      });
    }, '能力不可用不得以异常形式逃逸（原 flip 的 undefined.then TypeError 即此类）');

    assert.equal(acceptance.accepted, false);
    assert.equal(acceptance.code, wb.IMAGE_TRANSFORM_UNAVAILABLE);
    assert.equal(acceptance.willWrite, true);

    // 成功状态零变更
    assert.equal(item.width, snapshot.width, '宽高不得被交换');
    assert.equal(item.height, snapshot.height);
    assert.equal(item.orientation, snapshot.orientation, 'orientation 只在真实落盘成功后才删除');

    // 成功路径副作用零发生
    for (const forbidden of ['isRotating', 'updateItemView', 'relayout', 'regenerate-thumbnail', 'imagesChange']) {
      assert.equal(rec.all(forbidden).length, 0, `能力不可用时不得触发 ${forbidden}`);
    }
    assert.equal(timers.pending(), 0, '不得排期任何落盘');

    // 明确失败：真实原因进 UI 与日志
    const shown = rec.all('showError');
    assert.equal(shown.length, 1);
    assert.equal(shown[0][1], wb.IMAGE_TRANSFORM_UNAVAILABLE);
    assert.match(String(shown[0][2]), /空桩/, '原因须说明是空桩（能力未接线），而非笼统的加载失败');

    // 误导日志已消失：不得再把与 TypeError 无关的措辞当成原因
    const text = rec.logs.map(([, message]) => String(message)).join('\n');
    assert.doesNotMatch(text, /加载模块失败|Failed to load (rotate|flip)Image module/);
  });
}

test('(a) 非 write 模式（preview）不得探测能力、不得拒绝，也不得交换宽高', () => {
  const wb = loadWriteback();
  const timers = fakeTimers();
  const rec = recorder();
  const item = { id: 'I2', name: 'b.png', width: 800, height: 600, orientation: 6 };

  const acceptance = wb.commitImageTransform({
    kind: 'rotate',
    item,
    rawPath: '', // preview 模式不落盘，路径可有可无
    degree: -90,
    mode: 'preview',
    request: () => assert.fail('preview 模式不得探测图像变换能力'),
    hooks: baseHooks(timers, rec),
  });

  assert.equal(acceptance.accepted, true);
  assert.equal(acceptance.willWrite, false);
  assert.equal(item.width, 800, 'preview 模式不落盘，交换宽高会让内存模型与磁盘文件不符');
  assert.equal(item.height, 600);
  assert.equal(timers.pending(), 0);
  assert.equal(rec.events.length, 0, 'preview 模式为纯视觉，写回层不得有任何副作用');
});

test('(a) 取不到磁盘路径 / 目标不可写 → 明确拒绝而非静默无事发生', () => {
  const wb = loadWriteback();
  const realUtil = function (src, degree) { return Promise.resolve({ width: 1, height: 1 }); };

  const noPath = fakeTimers();
  const recA = recorder();
  const itemA = { id: 'I3', name: 'z.jpg', width: 10, height: 20 };
  const a = wb.commitImageTransform({
    kind: 'rotate', item: itemA, rawPath: '', degree: -90, mode: 'write',
    request: () => realUtil, appRootPath: '/src', hooks: baseHooks(noPath, recA),
  });
  assert.equal(a.accepted, false);
  assert.equal(a.code, wb.IMAGE_TRANSFORM_NO_RAW_PATH);
  assert.equal(itemA.width, 10);
  assert.equal(recA.all('regenerate-thumbnail').length, 0);

  // 缺省可写性预检 = fs.accessSync(path, fs.W_OK)（主窗原判据）
  const deniedWin = {
    require: (name) => (name === 'fs'
      ? { W_OK: 2, accessSync() { const err = new Error('EACCES: permission denied'); throw err; } }
      : undefined),
  };
  const wbDenied = loadWriteback({ window: deniedWin });
  const denied = fakeTimers();
  const recB = recorder();
  const itemB = { id: 'I4', name: 'ro.jpg', width: 10, height: 20 };
  const hooks = baseHooks(denied, recB);
  delete hooks.checkWritable; // 走缺省实现
  const b = wbDenied.commitImageTransform({
    kind: 'rotate', item: itemB, rawPath: 'C:/lib/ro.jpg', degree: -90, mode: 'write',
    request: () => realUtil, appRootPath: '/src', hooks,
  });
  assert.equal(b.accepted, false);
  assert.equal(b.code, wbDenied.IMAGE_TRANSFORM_WRITE_DENIED);
  assert.match(String(b.reason), /EACCES/);
  assert.equal(itemB.width, 10, '预检失败发生在交换宽高之前，内存模型无需回滚');
  assert.equal(denied.pending(), 0);
});

test('(a) 真实写入抛错 → 真实原因透出并回撤视觉，不伪装成功', async () => {
  const wb = loadWriteback();
  const timers = fakeTimers();
  const rec = recorder();
  const item = { id: 'I5', name: 'c.jpg', width: 800, height: 600, orientation: 6 };
  const boom = function (src, degree) { return Promise.reject(new Error('ENOSPC: no space left')); };

  const acceptance = wb.commitImageTransform({
    kind: 'rotate', item, rawPath: 'C:/lib/c.jpg', degree: -90, mode: 'write',
    request: () => boom, appRootPath: '/src', hooks: baseHooks(timers, rec),
  });
  assert.equal(acceptance.accepted, true);
  assert.equal(item.width, 600, '受理时已交换');

  await drain(timers);

  assert.equal(item.width, 800, '写入失败须回滚宽高');
  assert.equal(item.height, 600);
  assert.equal(item.orientation, 6, '失败不得删除 orientation');
  assert.equal(rec.all('regenerate-thumbnail').length, 0);
  assert.equal(rec.all('imagesChange').length, 0, '失败不得写元数据');
  assert.ok(rec.all('resetView').length === 0, 'resetView 为宿主钩子，此处未注入');
  const failure = rec.all('showError');
  assert.equal(failure.length, 1);
  assert.equal(failure[0][1], wb.IMAGE_TRANSFORM_WRITE_FAILED);
  assert.match(String(failure[0][2]), /ENOSPC/);
});

// ───────────────────── (b) 宽高经支持宽高的路由落库 + 回执校验 ─────────────────────

test('(b) write 模式：宽高经唯一元数据通道写入一次，并以回执确认落库', async () => {
  const wb = loadWriteback();
  assert.equal(wb.IMAGE_META_CHANNEL, 'images-change');

  const timers = fakeTimers();
  const rec = recorder();
  const written = [];
  const item = { id: 'I7', name: 'r.jpg', width: 640, height: 480, orientation: 6 };
  // 真实 util 契约形态：元数 ≥2（空桩元数为 0，据此区分）
  const realUtil = function (src, degree, options) {
    if (options && options.onSuccess) options.onSuccess(480, 640);
    return Promise.resolve({ width: 480, height: 640 });
  };

  let receipt = null;
  const hooks = baseHooks(timers, rec);
  hooks.onMetaReceipt = (handler) => { receipt = handler; return () => { receipt = null; }; };
  hooks.imagesChange = (items) => {
    written.push(items.map((entry) => ({ ...entry })));
    // 后端回执：宽高确实落库
    assert.ok(receipt, '写入前必须先完成回执订阅');
    receipt({ ok: true, action: wb.IMAGE_META_CHANNEL, items: [{ id: 'I7', width: 480, height: 640 }] });
  };

  const acceptance = wb.commitImageTransform({
    kind: 'rotate', item, rawPath: 'C:/lib/r.jpg', degree: -90, mode: 'write',
    request: () => realUtil, appRootPath: '/src', hooks,
  });
  assert.equal(acceptance.accepted, true);
  assert.equal(item.width, 480);
  assert.equal(item.height, 640);
  assert.equal(timers.pending(), 1, '落盘经去抖排期');

  await drain(timers);

  assert.equal(written.length, 1, '元数据只写一次——不得存在第二条写入调用');
  assert.equal(written[0][0].id, 'I7');
  assert.equal(written[0][0].width, 480, '写入载荷须携带宽高（v1 白名单之外的字段由通道契约承接）');
  assert.equal(written[0][0].height, 640);
  assert.equal(item.width, 480, '以 util 回传的真实尺寸定稿');
  assert.equal(item.height, 640);
  assert.equal(item.orientation, undefined, '真实落盘成功后才删除 orientation');
  assert.equal(rec.all('regenerate-thumbnail').length, 1);

  const text = rec.logs.map(([, message]) => String(message)).join('\n');
  assert.match(text, /宽高落库通道：images-change/, '须记录宽高实际由哪条通道落库');
  assert.equal(timers.pending(), 0);
});

test('(b) 通道回执未确认宽高且未派发缩略图任务 → IMAGE_META_NOT_PERSISTED', async () => {
  const wb = loadWriteback();
  const timers = fakeTimers();
  const rec = recorder();
  const item = { id: 'I8', name: 's.jpg', width: 640, height: 480 };
  const realUtil = function (src, degree) { return Promise.resolve({ width: 480, height: 640 }); };

  let receipt = null;
  const hooks = baseHooks(timers, rec);
  hooks.onMetaReceipt = (handler) => { receipt = handler; return undefined; };
  hooks.imagesChange = () => {
    // 回执带回来的是**旧**宽高：说明该通道没有把新宽高写下去
    receipt({ ok: true, action: wb.IMAGE_META_CHANNEL, items: [{ id: 'I8', width: 640, height: 480 }] });
  };
  hooks.regenerateThumbnail = undefined; // 未派发缩略图任务（该通道亦会写宽高）

  wb.commitImageTransform({
    kind: 'rotate', item, rawPath: 'C:/lib/s.jpg', degree: -90, mode: 'write',
    request: () => realUtil, appRootPath: '/src', hooks,
  });
  await drain(timers);

  const shown = rec.all('showError');
  assert.equal(shown.length, 1, '未落库必须显式报错，不得静默当成成功');
  assert.equal(shown[0][1], wb.IMAGE_META_NOT_PERSISTED);
  assert.match(String(shown[0][2]), /未携带新宽高/);
});

test('(b) 缩略图通道已派发时宽高由其后端提交承接，不额外新增第二次写入', async () => {
  const wb = loadWriteback();
  const timers = fakeTimers();
  const rec = recorder();
  const item = { id: 'I9', name: 't.jpg', width: 640, height: 480 };
  const realUtil = function (src, degree) { return Promise.resolve({ width: 480, height: 640 }); };

  let writes = 0;
  const hooks = baseHooks(timers, rec);
  hooks.onMetaReceipt = () => () => {};
  hooks.imagesChange = () => { writes += 1; }; // 不回执
  hooks.regenerateThumbnail = () => rec.events.push(['regenerate-thumbnail']);

  wb.commitImageTransform({
    kind: 'rotate', item, rawPath: 'C:/lib/t.jpg', degree: -90, mode: 'write',
    request: () => realUtil, appRootPath: '/src', hooks,
  });
  await drain(timers);

  assert.equal(writes, 1, '不得为兜底再写一次元数据');
  assert.equal(rec.all('regenerate-thumbnail').length, 1);
  assert.equal(rec.all('showError').length, 0, '缩略图通道会写宽高，此处不应报错');
  const text = rec.logs.map(([, message]) => String(message)).join('\n');
  assert.match(text, /宽高落库通道：regenerate-thumbnail/);
});

test('(b) 去抖：同一 item 连续点击只落盘一次，且取最终角度', async () => {
  const wb = loadWriteback();
  const timers = fakeTimers();
  const rec = recorder();
  const item = { id: 'IA', name: 'u.jpg', width: 800, height: 600 };
  const calls = [];
  const realUtil = function (src, degree) { calls.push(degree); return Promise.resolve(undefined); };

  const hooks = baseHooks(timers, rec);
  hooks.onMetaReceipt = () => () => {};
  hooks.imagesChange = () => {};

  for (const degree of [-90, -180, -270]) {
    wb.commitImageTransform({
      kind: 'rotate', item, rawPath: 'C:/lib/u.jpg', degree, mode: 'write',
      request: () => realUtil, appRootPath: '/src', hooks,
    });
  }
  assert.equal(wb.pendingImageTransformWrites(), 1);
  await drain(timers);

  assert.deepEqual(calls, [-270], '去抖后只以最终累计角度落盘一次');
  assert.equal(item.width, 600, '三次点击 = 三次交换（奇数次），与 270° 对齐');
  assert.equal(item.height, 800);
});

// ─────────────────────── (c) 预览窗与主窗共用单一写回实现 ───────────────────────

test('(c) 预览窗与主窗调用同一个写回函数（单一实现、无分叉副本）', () => {
  const main = read(MAIN_PATH);
  const preview = read(PREVIEW_PATH);
  const wb = read(WB_PATH);

  // 两侧都从同一模块导入同一符号
  assert.match(main, /import\s*\{\s*commitImageTransform\s*\}\s*from\s*'\.\/imageTransformWriteback'/);
  assert.match(preview, /import\s*\{\s*commitImageTransform\s*\}\s*from\s*'\.\.\/services\/imageTransformWriteback'/);

  // 全库只有一个实现
  const files = readdirSync(fileURLToPath(new URL('../src/app/react', import.meta.url)), { recursive: true })
    .map((name) => String(name).replace(/\\/g, '/')).filter((name) => /\.(ts|tsx)$/.test(name));
  const implementations = files.filter((name) => /export function commitImageTransform\b/.test(read(`src/app/react/${name}`)));
  assert.deepEqual(implementations, ['services/imageTransformWriteback.ts'], '写回实现必须唯一');
  assert.match(wb, /export function commitImageTransform/);

  // 四个调用点全部指向该函数（主窗 rotate/flip、预览窗 rotate/flip）
  const count = (source) => (source.match(/commitImageTransform\(\{/g) || []).length;
  assert.equal(count(main), 2, '主窗 rotate/flip 各一处');
  assert.equal(count(preview), 2, '预览窗 rotate/flip 各一处');

  // 调用方不得再自持一份 util 加载 + 写回逻辑
  for (const [label, source] of [['主窗', main], ['预览窗', preview]]) {
    assert.doesNotMatch(source, /\/app\/js\/utils\/(rotate|flip)Image\.js/, `${label}不得再直接加载 util`);
    assert.doesNotMatch(source, /Failed to load (rotate|flip)Image module/, `${label}的误导日志必须删除`);
    assert.doesNotMatch(source, /rotateImageUtil|flipImageUtil/, `${label}不得残留分叉副本`);
  }

  // 预览窗原有的无条件宽高交换必须消失（写回层已收敛到 write 模式门控）
  assert.doesNotMatch(preview, /\[rotatedImage\.width,\s*rotatedImage\.height\]\s*=\s*\[originalHeight,\s*originalWidth\]/);
});

test('(c) 已解桩：moduleRegistry 对两个 util 走真实加载，且空桩形态仍被判为能力不可用', () => {
  const registry = read(REGISTRY_PATH);
  // 演进说明：第三批之前，这两行**无条件**返回 `() => {}` 空桩，是「静默假成功」的直接来源；
  // 本批次把它们改为与同文件其余 `/app/js/**` 模块**同一出口**的 `loadJsModule(req)`。
  // 因此旧断言「仍返回空桩」必须被**替换**（只删断言等于放弃守护），换成对解桩后形态的断言：
  assert.doesNotMatch(
    registry,
    /endsWith\('\/app\/js\/utils\/flipImage\.js'\)\)\s*return\s*\(\)\s*=>\s*\{\};/,
    'flipImage 不得再无条件返回空桩',
  );
  assert.doesNotMatch(
    registry,
    /endsWith\('\/app\/js\/utils\/rotateImage\.js'\)\)\s*return\s*\(\)\s*=>\s*\{\};/,
    'rotateImage 不得再无条件返回空桩',
  );
  assert.match(
    registry,
    /endsWith\('\/app\/js\/utils\/flipImage\.js'\)\)\s*return\s+loadJsModule\(req\);/,
    'flipImage 必须走同文件既有的 loadJsModule 真实加载',
  );
  assert.match(
    registry,
    /endsWith\('\/app\/js\/utils\/rotateImage\.js'\)\)\s*return\s+loadJsModule\(req\);/,
    'rotateImage 必须走同文件既有的 loadJsModule 真实加载',
  );
  // 解桩范围必须被限定在这两行：同组其余替身项不得被顺手放开。
  assert.match(
    registry,
    /endsWith\('\/app\/js\/utils\/unorm\.js'\)\)\s*return\s*\{/,
    '同组其余替身项形态不得变化（只放开这两个模块）',
  );
  assert.match(
    registry,
    /endsWith\('\/my_modules\/get-drive-type'\)\)\s*return\s*\(\)\s*=>\s*'local';/,
    '同组其余替身项形态不得变化（只放开这两个模块）',
  );

  // 能力判据本身**逐字保留**：它守护的是「空桩 / 非函数 → 明确失败」这条不变量，
  // 与是否解桩无关——解桩后真实实现的元数为 2，该判据自动放行（无需改动判据）。
  const wb = loadWriteback();
  const capability = wb.resolveImageTransformCapability('rotate', () => EMPTY_STUB, '/src');
  assert.equal(capability.ok, false);
  assert.equal(capability.code, wb.IMAGE_TRANSFORM_UNAVAILABLE);
  assert.match(String(capability.reason), /空桩/);

  const real = function (src, degree, options) { return Promise.resolve(undefined); };
  assert.equal(wb.resolveImageTransformCapability('rotate', () => real, '/src').ok, true);
  assert.equal(wb.resolveImageTransformCapability('flip', () => real, '/src').ok, true);
});

test('(c) 解桩后分流判定点已就位：同一入口、按扩展名给出不同落点', () => {
  const wb = loadWriteback();
  const route = loadRoute({}, 'electron');

  // .jpg/.jpeg → 渲染层原版实现（EXIF 无损改写）；其余 → 后端端点。
  for (const name of ['a.jpg', 'a.JPG', 'a.jpeg']) {
    const decision = route.resolveImageTransformDispatch({ id: 'd1', name });
    assert.equal(decision.supported, true, `${name} 应有落点`);
    assert.equal(decision.route, 'renderer', `${name} 应走渲染层`);
  }
  for (const name of ['a.png', 'a.webp', 'a.bmp', 'a.avif']) {
    const decision = route.resolveImageTransformDispatch({ id: 'd2', name });
    assert.equal(decision.supported, true, `${name} 应有落点`);
    assert.equal(decision.route, 'backend', `${name} 应走后端（前端不再抄一份支持格式清单）`);
  }
  // `item.ext` 优先于 `item.name`
  assert.equal(
    route.resolveImageTransformDispatch({ id: 'd3', name: 'a.png', ext: 'jpg' }).route, 'renderer',
  );

  // 唯一判定点由写回层**唯一**调用；调用方（主窗/预览窗）不得自持格式知识。
  const files = readdirSync(fileURLToPath(new URL('../src/app/react', import.meta.url)), { recursive: true })
    .map((name) => String(name).replace(/\\/g, '/')).filter((name) => /\.(ts|tsx)$/.test(name));
  const deciders = files.filter((name) => /resolveImageTransformDispatch\s*\(/.test(read(`src/app/react/${name}`)));
  assert.deepEqual(deciders.sort(), [
    'services/imageTransformRoute.ts', // 定义处
    'services/imageTransformWriteback.ts', // 唯一调用处
  ], '分流判定必须只有一个定义点与一个调用点');
  for (const [label, source] of [['主窗', read(MAIN_PATH)], ['预览窗', read(PREVIEW_PATH)]]) {
    assert.doesNotMatch(source, /RENDERER_IMAGE_FORMATS|resolveImageTransformDispatch/,
      `${label}不得自持分流判定`);
  }
  assert.equal(loadWriteback().IMAGE_META_CHANNEL, wb.IMAGE_META_CHANNEL);
  assert.equal(route.IMAGE_TRANSFORM_BACKEND_CHANNEL, 'item:image-transform');
});

test('(c) 宽高路由确为携带 width/height 的写入（images-change → item.updateMany）', () => {
  const bridge = read(CHANNEL_BRIDGE_PATH);
  assert.match(bridge, /channel === 'images-change'/, 'images-change 分支存在');
  assert.match(bridge, /d\.item\.updateMany\(snapshots\)/, '该分支以完整条目快照调用 updateMany');
  assert.match(bridge, /emitEvent\('item:operation-result'/, '写后发回执，供落库校验');
  assert.doesNotMatch(bridge, /contract:\s*'v1'|ALLOWED_FIELDS/, '不得在前端另行裁剪字段');
});
