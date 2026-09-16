/**
 * F06 第三批验收（前端）：格式分流的**唯一判定点** + 非 JPEG 的后端通路 + 解桩后的真实受理。
 *
 * 覆盖：
 *  (1) **唯一判定点**：`resolveImageTransformDispatch` 是全前端唯一按格式决定落点之处——
 *      同一入口（`item`）、不同扩展名 → 不同路由；主窗与预览窗不得自持格式知识。
 *  (2) **解桩后的真实受理**：用经 shim require 链**真实加载**出来的 `rotateImage.js`
 *      （产品原实现，非桩）驱动 `commitImageTransform`：受理、真实落盘、磁盘上的 EXIF
 *      Orientation 真的被改写——「不再拒绝」由**真实实现**断言，而不是断言桩的形态。
 *  (3) **后端一路**：非 JPEG 经预加载具名通道走后端；后端结构化错误码/消息
 *      （415 UNSUPPORTED_FORMAT / 403 PERMISSION_DENIED / 404 NOT_FOUND）**原样**到达渲染层，
 *      不被吞成泛化文案；失败回撤视觉且不派发缩略图；成功以后端事务的权威宽高定稿。
 *  (4) **明确失败而非静默**：非 electron 运行环境、预加载通道缺失，都必须拒绝而不是假成功。
 *  (5) **接线**：preload 具名方法的**行为**（频道与参数逐字）；main 侧 handler 的**信封契约**
 *      为结构断言——`electron/main.cjs` 依赖 Electron 运行时，无法在纯 Node 中行为化，
 *      这一点在交付汇报中已如实标注，不以「看着能跑」充当端到端验证。
 */
import assert from 'node:assert/strict';
import * as nodeFs from 'node:fs';
import {
  existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const WB_PATH = 'src/app/react/services/imageTransformWriteback.ts';
const ROUTE_PATH = 'src/app/react/services/imageTransformRoute.ts';
const MAIN_PATH = 'src/app/react/services/imageOpsService.ts';
const PREVIEW_PATH = 'src/app/react/preview-window/controller.ts';
const MAIN_CJS = 'electron/main.cjs';
const PRELOAD_CJS = 'electron/preload.cjs';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** 去掉注释后再做「不得出现某某标识」的结构断言——注释里提到 ≠ 代码里用了。 */
const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '');

/** Electron 渲染层的全局面：写回模块与其紧邻模块须在**同一环境事实**下求值，
 *  否则判定点的缺省环境判定会因 realm 不同而分叉。 */
const ELECTRON_RENDERER_PROCESS = { versions: { electron: '22.3.7', node: '22.0.0' } };

function transpile(p) {
  const { outputText, diagnostics } = ts.transpileModule(read(p), {
    fileName: p,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  assert.equal(diagnostics.length, 0, `${p} 转译应无诊断`);
  return outputText;
}

/** 紧邻模块（`imageTransformRoute.ts`）的内存转译装载：与写回模块共用同一 window / 环境。 */
function loadRoute(win, runtime = 'electron') {
  const exports = {};
  vm.runInNewContext(transpile(ROUTE_PATH), {
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
  const exports = {};
  vm.runInNewContext(transpile(WB_PATH), {
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

/** 预加载具名方法的**行为**测试宿主（与 `tests/preload-subscriptions.mjs` 同一加载口径）。 */
function loadPreload(invoke) {
  const window = {};
  const contextBridge = { exposeInMainWorld: (key, api) => { window[key] = api; } };
  // M6-3 起 `electron/preload.cjs` 在**模块作用域**多了三个 Node 内核模块的 require，
  // 并用 `__dirname` 把格式插件 preload 锚定到 <repo>/electron/../src/app/js/plugin/api-format-extension.js。
  // 白名单**穷尽列举**，且要求逐个都被请求到——依赖面一变就红，不是「允许任意模块」。
  const requested = [];
  const imports = {
    electron: { contextBridge, ipcRenderer: { invoke, on() {}, removeListener() {} } },
    'node:path': path,
    'node:fs': nodeFs,
    'node:url': { pathToFileURL },
  };
  vm.runInNewContext(read(PRELOAD_CJS), {
    window,
    process: { env: {} },
    __dirname: path.dirname(PRELOAD_CJS),
    require(name) {
      requested.push(name);
      assert.ok(Object.hasOwn(imports, name), `preload.cjs 不得加载白名单外的依赖：${name}`);
      return imports[name];
    },
  }, { filename: PRELOAD_CJS });
  assert.deepEqual(requested, ['electron', 'node:path', 'node:fs', 'node:url'],
    'preload.cjs 的依赖面须与白名单逐项一致（新增依赖必须是有意识的改动，并同步更新本断言）');
  return window.eagleDesktop;
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

/** 真实副作用落定的等待上限——**有界**：到点即失败，绝不无限等。 */
const REAL_EFFECT_TIMEOUT_MS = 10000;
/** 轮询间隔：真实等待，让 libuv 线程池里已完成的 fs 操作被投递回来。 */
const REAL_EFFECT_POLL_MS = 5;

/**
 * 有上限地等待**真实副作用**落定（通过与否只取决于「真的做完了没有」）。
 *
 * 为什么不能按「推进 N 轮」来等真实 IO：`commitImageTransform` 的落盘走的是**真实 `fs`**，
 * 其完成时机由 libuv 线程池决定，与假计时器队列**无关**——`flush()` + `setImmediate` 的一轮
 * 只是「一次事件循环 poll 访问」，整段 60 轮的墙钟成本实测仅 ~0.3ms。于是同一个 60 轮预算，
 * 机器空闲时 10 轮就够用，在并行 Worker 争用 / 杀毒扫描 / 线程池排队下却会在写盘落定前耗尽，
 * 断言读到尚未改写的文件（`磁盘文件的 Orientation 须被真实改写：undefined !== 8`）。
 * 实测：本机空闲 10/10 通过，12 进程并发时 12/12 复现该失败；给每个 fs 操作注入 +3ms 后，
 * 写盘落定要 67 轮、+10ms 要 228 轮——**轮数根本不是「完成」的度量**。
 *
 * 因此这里把「等完成」换成两件事：**推进假计时器**（去抖计时器是假的，不推进就永不触发落盘）
 * + **轮询真实条件**（磁盘/事件流中的真实结果），并以墙钟上限兜底。上限到了仍未落定即失败，
 * 不会无限等——所以这不是「多睡一会儿碰运气」，而是「等一个真实条件，且它必须有界」。
 */
async function waitForRealEffect(timers, predicate, options = {}) {
  const { label, timeoutMs = REAL_EFFECT_TIMEOUT_MS, diagnose } = options;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    timers.flush();
    if (predicate()) return;
    if (Date.now() >= deadline) {
      const scene = typeof diagnose === 'function' ? `\n落定时限已到时的现场：${diagnose()}` : '';
      assert.fail(`等待「${label}」超时（上限 ${timeoutMs}ms 已到，真实执行未落定）${scene}`);
    }
    await new Promise((resolve) => setTimeout(resolve, REAL_EFFECT_POLL_MS));
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
    all: (kind) => events.filter((entry) => entry[0] === kind),
    text: () => logs.map(([, message]) => String(message)).join('\n'),
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
    resetView: () => rec.events.push(['resetView']),
    checkWritable: () => null,
  };
}

/** 注入假后端通道：记录调用参数，按脚本回信封。 */
function backendWindow(script) {
  const calls = [];
  return {
    calls,
    window: {
      eagleDesktop: {
        item: {
          imageTransform(params) {
            calls.push(params);
            return Promise.resolve(script(params, calls.length));
          },
        },
      },
    },
  };
}

/** 「唯一元数据通道」的宿主：记录写入载荷，并可按需回执（或不回执）。
 *  仍按 `baseHooks` 的口径记事件，使「写了几次」的断言与其余用例同源。 */
function metaHooks(timers, rec, { receipt = null, written } = {}) {
  let handler = null;
  const hooks = baseHooks(timers, rec);
  hooks.onMetaReceipt = (fn) => { handler = fn; return () => { handler = null; }; };
  hooks.imagesChange = (items) => {
    rec.events.push(['imagesChange', items]);
    written?.push(items.map((entry) => ({ ...entry })));
    if (receipt) handler?.(receipt(items));
  };
  return hooks;
}

/** 回执载荷：把实际写出的宽高原样回带（模拟 `item:operation-result`）。 */
const echoReceipt = (id) => (items) => ({
  ok: true, action: 'images-change', items: [{ id, width: items[0].width, height: items[0].height }],
});

/** 跨 vm realm 的对象深比较：先归一化到本 realm 的普通对象（否则原型不同会误判不等）。 */
const plain = (value) => JSON.parse(JSON.stringify(value));

// ─────────────────── (1) 唯一判定点：同一入口、按格式分流 ───────────────────

test('(1) 唯一判定点：渲染层只认 JPEG，其余格式不在前端预判（后端为唯一权威）', () => {
  const route = loadRoute({}, 'electron');

  // 前端**只有**这一份格式知识：渲染层能无损处理的集合
  assert.deepEqual([...route.RENDERER_IMAGE_FORMATS].sort(), ['jpeg', 'jpg']);

  for (const name of ['a.jpg', 'a.JPEG', 'a.Jpeg']) {
    const dispatch = route.resolveImageTransformDispatch({ id: 'd', name });
    assert.equal(dispatch.supported, true);
    assert.equal(dispatch.ext, name.split('.').pop().toLowerCase());
    assert.equal(dispatch.route, 'renderer', `${name} 走渲染层原版实现（EXIF 无损）`);
  }
  // 支持与否由后端回答——前端不预判，故一律交后端（avif 也在此列，由后端给出 415）
  for (const name of ['a.png', 'a.webp', 'a.bmp', 'a.avif', 'a.tiff', 'noext']) {
    const dispatch = route.resolveImageTransformDispatch({ id: 'd', name });
    assert.equal(dispatch.supported, true);
    assert.equal(dispatch.route, 'backend', `${name} 交后端判定`);
  }

  // 同一个「入口」——同一个 item 只因扩展名不同而分流，不存在第二处判据
  assert.equal(route.resolveImageTransformDispatch({ id: 'SAME', name: 'x.jpg' }).route, 'renderer');
  assert.equal(route.resolveImageTransformDispatch({ id: 'SAME', name: 'x.png' }).route, 'backend');

  // `item.ext` 优先于 `item.name`（legacy 条目两者都在）
  assert.equal(route.resolveImageTransformDispatch({ id: 'e', ext: '.JPG', name: 'a.png' }).route, 'renderer');
  assert.equal(route.resolveImageTransformDispatch({ id: 'e', ext: 'png', name: 'a.jpg' }).route, 'backend');

  // 全前端只有「定义一处 + 调用一处」；主窗/预览窗只做调用点
  const files = readdirSync('src/app/react', { recursive: true })
    .map((entry) => String(entry).split('\\').join('/'))
    .filter((entry) => /\.(ts|tsx)$/.test(entry));
  const deciders = files.filter((entry) => /resolveImageTransformDispatch\s*\(/.test(read(`src/app/react/${entry}`)));
  assert.deepEqual(deciders.sort(), ['services/imageTransformRoute.ts', 'services/imageTransformWriteback.ts'],
    '按扩展名决定落点的地方必须且只能有一处（另一处是唯一调用点）');

  for (const [label, source] of [['主窗', read(MAIN_PATH)], ['预览窗', read(PREVIEW_PATH)]]) {
    assert.doesNotMatch(stripComments(source), /RENDERER_IMAGE_FORMATS|resolveImageTransformDispatch|imageTransformExtension/,
      `${label}不得自持分流判定（只能经 commitImageTransform 间接触达）`);
  }
});

// ─────────────────── (2) 解桩后：真实实现驱动 → 受理并真实落盘 ───────────────────

/**
 * `core/shim/moduleRegistry.ts` require 链中与本链路相关分支的**忠实复刻**：
 * 裸模块只把 `fs` / `path` 透传原生（其余落 mock）、`/app/js/**` 走 `loadJsModule`
 * （同步取源码 → `new Function` 求值）、`appRoot` 是全局自由变量。
 *
 * 复刻而非复用真实 `loadJsModule`：后者依赖渲染层的同步 XHR 取源码，本测试直接读盘
 * 提供等价字节。shim 自身的一致性由 `tests/shim-module-boundaries.mjs` 与
 * `tests/image-ops-writeback.mjs` 的 registry 形态断言守护。
 */
function createShimChain() {
  const cache = new Map();
  const appRoot = { path: '/src', toString: () => '/src' };
  const bare = { fs: nodeFs, path, 'app-root-path': appRoot };
  const ctx = vm.createContext({ appRoot, console, Buffer });
  const genericStub = () => function eagleGenericStub() { return undefined; };
  const syncText = (urlPath) => {
    try {
      return readFileSync(path.join(REPO_ROOT, urlPath.replace(/^\//, '')), 'utf8');
    } catch (err) {
      return null;
    }
  };
  function loadJsModule(urlPath) {
    if (cache.has(urlPath)) return cache.get(urlPath).exports;
    const source = syncText(urlPath);
    const module = { exports: {} };
    if (source === null) {
      module.exports = genericStub(urlPath);
    } else {
      const run = vm.runInContext(
        `(function (module, exports, require, process, global, Buffer, __filename, __dirname) {\n${source}\n})`,
        ctx,
        { filename: urlPath },
      );
      try {
        run(module, module.exports, requireModule, { platform: process.platform },
          ctx, Buffer, urlPath, path.posix.dirname(urlPath));
      } catch (err) {
        module.exports = genericStub(urlPath);
      }
    }
    cache.set(urlPath, module);
    return module.exports;
  }
  function requireModule(request) {
    const req = String(request || '').split('\\').join('/');
    if (Object.hasOwn(bare, req)) return bare[req];
    if (req.startsWith('/src/')) return loadJsModule(req);
    return genericStub(req);
  }
  return { load: loadJsModule };
}

/** 最小可解析 JPEG（SOI + JFIF + EOI）；piexif 的 load/insert 只需合法段结构。
 *  与可行性实测（`test-run/f06-feasibility-probe.mjs`）所用的字节完全一致。 */
const MINIMAL_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a'
  + 'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA'
  + 'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64',
);

test('(2) 解桩后不再拒绝：真实 rotateImage.js（经 shim require 链加载）受理并真实改写 EXIF', async () => {
  const chain = createShimChain();
  const rotateUtil = chain.load('/src/app/js/utils/rotateImage.js');
  const piexif = chain.load('/src/app/js/utils/piexif.js');

  // 解桩后必须是真实实现：可调用且元数 ≥2（与 resolveImageTransformCapability 的判据同源）
  assert.equal(typeof rotateUtil, 'function', '真实加载应得到函数而非空桩');
  assert.ok(rotateUtil.length >= 2, `真实实现元数应 ≥2（实为 ${rotateUtil.length}）`);
  assert.equal(typeof piexif.load, 'function', 'piexif 须真实求值（非 mock）');

  const dir = mkdtempSync(path.join(tmpdir(), 'f06-dispatch-'));
  const jpegPath = path.join(dir, 'sample.jpg');
  writeFileSync(jpegPath, MINIMAL_JPEG);
  try {
    const wb = loadWriteback({ window: {} });
    const timers = fakeTimers();
    const rec = recorder();
    const item = { id: 'R1', name: 'sample.jpg', width: 640, height: 480, orientation: 1 };
    const hooks = metaHooks(timers, rec, { receipt: echoReceipt('R1') });

    const acceptance = wb.commitImageTransform({
      kind: 'rotate', item, rawPath: jpegPath, degree: -90, mode: 'write',
      request: () => rotateUtil, appRootPath: '/src', hooks,
    });

    // 解桩前此处必然 accepted === false（IMAGE_TRANSFORM_UNAVAILABLE，空桩元数 0）
    assert.equal(acceptance.accepted, true, '真实实现就位后必须受理（不再拒绝）');
    assert.equal(acceptance.willWrite, true);
    assert.equal(acceptance.route, 'renderer', '.jpg 走渲染层');
    assert.equal(item.width, 480, '受理即交换宽高');

    // ── 确定性等待真实落盘 ──
    // 条件同时含「磁盘被真实改写且 .tmp 已清理」与「成功收尾已把宽高送进唯一元数据通道」：
    // 前者是「真的写完了」的外部证据，后者保证其后的读内存断言（orientation 已删除等）
    // 不再与写盘赛跑——`imagesChange` 严格晚于 `delete item.orientation`。
    // 等待必须有界；超时即失败并打印现场，不靠「多推进几轮」撞运气。
    const tmpPath = `${jpegPath}.tmp`;
    /** 读磁盘上的 Orientation：写盘途中可能读到半截文件，故容错。 */
    const diskOrientation = () => {
      try {
        return piexif.load(readFileSync(jpegPath).toString('binary'))['0th'][piexif.ImageIFD.Orientation];
      } catch (err) {
        return undefined;
      }
    };
    await waitForRealEffect(
      timers,
      () => diskOrientation() === 8
        && !existsSync(tmpPath)
        && rec.all('imagesChange').length === 1,
      {
        label: '真实落盘（磁盘 Orientation 改写 + .tmp 清理 + 宽高落库）',
        diagnose: () => `磁盘 Orientation=${String(diskOrientation())}；`
          + `${tmpPath} ${existsSync(tmpPath) ? '仍存在（写盘停在半途）' : '已清理'}；`
          + `已记录事件=${JSON.stringify(rec.events.map((entry) => entry[0]))}`,
      },
    );

    // 真实落盘：磁盘上的 EXIF Orientation 被改写（1 → 8，即逆时针 90°）
    const after = readFileSync(jpegPath).toString('binary');
    assert.equal(piexif.load(after)['0th'][piexif.ImageIFD.Orientation], 8,
      '磁盘文件的 Orientation 须被真实改写');
    assert.notEqual(after, MINIMAL_JPEG.toString('binary'),
      '磁盘字节须被真实改写，而不是「恰好读到旧内容也算过」');
    assert.equal(existsSync(`${jpegPath}.tmp`), false, '临时文件须已被清理');
    assert.equal(item.orientation, undefined, '真实落盘成功后才删除内存里的 orientation');
    assert.deepEqual(rec.all('showError'), [], '真实成功不得报错');
    assert.equal(rec.all('imagesChange').length, 1, '宽高经唯一元数据通道写入一次');
    assert.equal(rec.all('regenerate-thumbnail').length, 1, '渲染层一路需本窗派发缩略图任务');
    assert.equal(rec.all('isRotating').at(-1)?.[1], false,
      '成功收尾须复位 isRotating，不留悬挂态');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('(2) 真实执行 reject 时：明确失败，且 util 的真实原因原样透出（不得静默成功）', async () => {
  const chain = createShimChain();
  const rotateUtil = chain.load('/src/app/js/utils/rotateImage.js');
  const wb = loadWriteback({ window: {} });
  const timers = fakeTimers();
  const rec = recorder();
  const missing = path.join(tmpdir(), 'f06-never-exists.jpg');
  const item = { id: 'R2', name: 'f06-never-exists.jpg', width: 640, height: 480, orientation: 1 };

  const acceptance = wb.commitImageTransform({
    kind: 'rotate', item, rawPath: missing, degree: -90, mode: 'write',
    request: () => rotateUtil, appRootPath: '/src', hooks: baseHooks(timers, rec),
  });
  assert.equal(acceptance.accepted, true, '前端预检通过（路径非空且可写），真实失败交给真实执行');
  // 同样是真实 util：不按固定轮数推进，改为有上限地等待**失败收尾**这一真实结果落定。
  await waitForRealEffect(timers, () => rec.all('showError').length > 0, {
    label: '真实执行的失败收尾（showError 落定）',
    diagnose: () => `已记录事件=${JSON.stringify(rec.events.map((entry) => entry[0]))}`,
  });

  const shown = rec.all('showError');
  assert.equal(shown.length, 1, '真实失败必须显式报错，不得静默当作成功');
  assert.equal(shown[0][1], wb.IMAGE_TRANSFORM_WRITE_FAILED);
  assert.equal(shown[0][2], 'Source file does not exist',
    'util 的真实 reject 原因须原样透出（rotateImage.js:9 的字面量），不得改写成泛化文案');
  assert.equal(item.width, 640, '失败须回滚宽高');
  assert.equal(item.height, 480);
  assert.equal(item.orientation, 1, '失败不得删除 orientation');
  assert.equal(rec.all('regenerate-thumbnail').length, 0);
  assert.equal(rec.all('imagesChange').length, 0);
  assert.equal(rec.all('isRotating').at(-1)?.[1], false, '失败收尾同样不得留 isRotating 悬挂态');
});

// ─────────────────── (3) 后端一路：结构化错误码原样到达渲染层 ───────────────────

for (const [statusCode, code, message] of [
  [415, 'UNSUPPORTED_FORMAT', 'Format does not support writing'],
  [403, 'PERMISSION_DENIED', 'Unable to replace source file: EACCES'],
  [404, 'NOT_FOUND', 'Item not found'],
]) {
  test(`(3) 后端 ${statusCode} ${code}：错误码与消息原样到达渲染层，失败回撤且不派发缩略图`, async () => {
    const fake = backendWindow(() => ({ ok: false, code, message, statusCode }));
    const wb = loadWriteback({ window: fake.window });
    const timers = fakeTimers();
    const rec = recorder();
    const item = { id: 'B1', name: 'x.png', width: 640, height: 480, orientation: 6 };

    const acceptance = wb.commitImageTransform({
      kind: 'rotate', item, rawPath: 'C:/lib/x.png', degree: -90, mode: 'write',
      hooks: baseHooks(timers, rec),
    });
    assert.equal(acceptance.accepted, true);
    assert.equal(acceptance.route, 'backend', '.png 走后端');
    assert.equal(item.width, 480, '受理时已交换');

    await drain(timers);

    const shown = rec.all('showError');
    assert.equal(shown.length, 1, '后端失败必须显式报错');
    assert.equal(shown[0][1], code,
      '错误码须**原样**透出，不得吞成 IMAGE_TRANSFORM_WRITE_FAILED 这类泛化码');
    assert.equal(shown[0][2], message, '后端消息须原样透出，不得改写');
    assert.match(rec.text(), new RegExp(`HTTP ${statusCode}`), '日志中带 HTTP 状态，便于排障');

    assert.equal(item.width, 640, '失败须回滚宽高');
    assert.equal(item.height, 480);
    assert.equal(item.orientation, 6, '失败不得删除 orientation');
    assert.equal(rec.all('regenerate-thumbnail').length, 0, '后端失败不得派发缩略图任务');
    assert.equal(rec.all('imagesChange').length, 0, '失败不得写元数据');

    // 请求体：角度已归一化为后端可接受的 90/180/270
    // （前端 -90 = 逆时针 90° ≡ 后端 270 = 顺时针 270°；后端 ROTATE_DEGREES 只收 90/180/270）
    assert.deepEqual(plain(fake.calls), [{ id: 'B1', op: 'rotate', degree: 270 }]);
  });
}

test('(3) 后端成功：宽高以后端事务的权威值定稿，且不重复派发缩略图任务', async () => {
  const fake = backendWindow(() => ({
    ok: true,
    data: { id: 'B2', op: 'rotate', degree: 90, width: 480, height: 640, thumbnailTaskId: 'T1' },
  }));
  const wb = loadWriteback({ window: fake.window });
  const timers = fakeTimers();
  const rec = recorder();
  const written = [];
  const item = { id: 'B2', name: 'y.webp', width: 640, height: 480 };
  const hooks = metaHooks(timers, rec, { written, receipt: echoReceipt('B2') });

  const acceptance = wb.commitImageTransform({
    kind: 'rotate', item, rawPath: 'C:/lib/y.webp', degree: -270, mode: 'write', hooks,
  });
  assert.equal(acceptance.accepted, true);
  assert.equal(acceptance.route, 'backend');
  await drain(timers);

  assert.deepEqual(plain(fake.calls), [{ id: 'B2', op: 'rotate', degree: 90 }], '归一化到后端可接受的角度');
  assert.equal(item.width, 480, '以后端事务落库后的权威宽高定稿');
  assert.equal(item.height, 640);
  assert.equal(item.orientation, undefined);
  assert.equal(rec.all('regenerate-thumbnail').length, 0,
    '后端已在同一请求内跑完缩略图任务，前端不得再派发第二次');
  assert.equal(written.length, 1, '宽高仍只经唯一元数据通道写入一次');
  assert.deepEqual(plain(written[0]), [{ id: 'B2', name: 'y.webp', width: 480, height: 640 }]);
  assert.deepEqual(rec.all('showError'), []);
  assert.match(rec.text(), /宽高落库通道：images-change/, '须记录宽高由哪条通道落库');
});

test('(3) 后端成功但元数据通道未回执：由后端事务承接，不误报未落库', async () => {
  const fake = backendWindow(() => ({ ok: true, data: { id: 'B3', width: 480, height: 640 } }));
  const wb = loadWriteback({ window: fake.window });
  const timers = fakeTimers();
  const rec = recorder();
  const item = { id: 'B3', name: 'z.png', width: 640, height: 480 };
  const hooks = metaHooks(timers, rec); // 不回执

  wb.commitImageTransform({ kind: 'rotate', item, rawPath: 'C:/lib/z.png', degree: -90, mode: 'write', hooks });
  await drain(timers);

  assert.deepEqual(rec.all('showError'), [],
    '后端事务已落库宽高，不得因为前端通道没回执就误报 IMAGE_META_NOT_PERSISTED');
  assert.match(rec.text(), /宽高落库通道：backend-transform/,
    '须显式记明宽高是由后端事务承接，而非「未落库」');
  assert.equal(item.width, 480);
  assert.equal(item.height, 640);
});

test('(3) flip 走后端：请求体是 flipType（不是 degree），且不改变尺寸', async () => {
  const fake = backendWindow(() => ({ ok: true, data: { id: 'B4', width: 640, height: 480 } }));
  const wb = loadWriteback({ window: fake.window });
  const timers = fakeTimers();
  const rec = recorder();
  const item = { id: 'B4', name: 'f.webp', width: 640, height: 480 };
  const hooks = metaHooks(timers, rec);

  const acceptance = wb.commitImageTransform({
    kind: 'flip', item, rawPath: 'C:/lib/f.webp', flipType: 'horizontal',
    writeToFile: true, mode: 'write', hooks,
  });
  assert.equal(acceptance.accepted, true);
  assert.equal(acceptance.route, 'backend');
  await drain(timers);
  assert.deepEqual(plain(fake.calls), [{ id: 'B4', op: 'flip', flipType: 'horizontal' }]);
  assert.equal(item.width, 640, 'flip 不改变尺寸');
  assert.equal(item.height, 480);
});

test('(3) 后端一路不做前端代理判定：路径为空 / 不可写仍交后端（404/403 由后端权威给出）', async () => {
  const fake = backendWindow(() => ({ ok: false, code: 'NOT_FOUND', message: 'Item not found', statusCode: 404 }));
  const wb = loadWriteback({ window: fake.window });
  const timers = fakeTimers();
  const rec = recorder();
  const item = { id: 'B5', name: 'q.png', width: 640, height: 480 };
  const hooks = baseHooks(timers, rec);
  hooks.checkWritable = () => assert.fail('后端一路不得做前端可写性预检');

  const acceptance = wb.commitImageTransform({
    kind: 'rotate', item, rawPath: '', degree: -90, mode: 'write', hooks,
  });
  assert.equal(acceptance.accepted, true, '路径为空不构成后端一路的拒绝理由');
  await drain(timers);
  assert.equal(rec.all('showError')[0][1], 'NOT_FOUND');
  assert.deepEqual(plain(fake.calls), [{ id: 'B5', op: 'rotate', degree: 270 }]);
});

// ─────────────────── (4) 明确失败而非静默 ───────────────────

test('(4) 非 electron 运行环境：明确拒绝（本批只实现 electron 态，不替 M2 决定）', () => {
  const wb = loadWriteback({ window: {}, runtime: 'browser' });
  const timers = fakeTimers();
  const rec = recorder();
  const item = { id: 'E1', name: 'a.jpg', width: 640, height: 480, orientation: 1 };

  const acceptance = wb.commitImageTransform({
    kind: 'rotate', item, rawPath: 'C:/lib/a.jpg', degree: -90, mode: 'write',
    request: () => assert.fail('非 electron 态不得装载渲染层 util'),
    appRootPath: '/src', hooks: baseHooks(timers, rec),
  });

  assert.equal(acceptance.accepted, false, '未实现的环境必须明确拒绝，不得静默成功');
  assert.equal(acceptance.code, loadRoute({}, 'browser').IMAGE_TRANSFORM_RUNTIME_UNSUPPORTED);
  assert.equal(item.width, 640, '拒绝发生在交换宽高之前');
  assert.equal(timers.pending(), 0);
  assert.equal(rec.all('showError').length, 1, '拒绝须给出真实原因');
  assert.equal(rec.all('regenerate-thumbnail').length, 0);
  assert.equal(rec.all('imagesChange').length, 0);
});

test('(4) 后端通道缺失：非 JPEG 明确拒绝，且不得回落 shims 的假 invoke', () => {
  const wb = loadWriteback({ window: {} });
  const timers = fakeTimers();
  const rec = recorder();
  const item = { id: 'E2', name: 'a.png', width: 640, height: 480 };

  const acceptance = wb.commitImageTransform({
    kind: 'rotate', item, rawPath: 'C:/lib/a.png', degree: -90, mode: 'write',
    hooks: baseHooks(timers, rec),
  });
  assert.equal(acceptance.accepted, false, '通道缺失必须明确拒绝');
  assert.equal(acceptance.code, 'IMAGE_TRANSFORM_BACKEND_UNAVAILABLE');
  assert.equal(acceptance.route, 'backend');
  assert.equal(item.width, 640, '拒绝发生在交换宽高之前');
  assert.equal(timers.pending(), 0);
  assert.equal(rec.all('showError').length, 1);
  assert.equal(rec.all('imagesChange').length, 0);

  // shims 的 `ipcBus.invoke` 对未知频道一律 resolve `{ canceled:true, ok:true }`
  // （`core/shim/ipcBus.ts`）——若后端一路回落它，「根本没接上」就会被伪装成成功信封，
  // 正是本批次要消灭的静默假成功。客户端必须只认 preload 的具名方法。
  const code = stripComments(read(ROUTE_PATH));
  assert.doesNotMatch(code, /getIpcBus|ipcBus|channelBridge/,
    '后端客户端不得回落 shims 总线（它对未知频道的 invoke 会假成功）');
  assert.match(code, /window as unknown as \{\s*eagleDesktop\?/,
    '只认 window.eagleDesktop 具名方法');
});

test('(4) 后端信封解析：code 缺失时才用本层兜底码；非信封结果不得当作成功', async () => {
  const route = loadRoute({}, 'electron');

  const noCode = await route.invokeImageTransformBackend(
    { ok: true, invoke: () => Promise.resolve({ ok: false, message: 'backend said no' }) },
    { id: 'x', op: 'rotate', degree: 90 },
  );
  assert.equal(noCode.ok, false);
  assert.equal(noCode.code, 'IMAGE_TRANSFORM_BACKEND_FAILED', '后端没给码时才用兜底码');
  assert.equal(noCode.message, 'backend said no', '消息原样');

  const notEnvelope = await route.invokeImageTransformBackend(
    { ok: true, invoke: () => Promise.resolve('nope') },
    { id: 'x', op: 'flip', flipType: 'both' },
  );
  assert.equal(notEnvelope.ok, false, '非信封结果不得当作成功');
  assert.equal(notEnvelope.code, 'IMAGE_TRANSFORM_BACKEND_FAILED');

  const unavailable = await route.invokeImageTransformBackend(
    { ok: false, code: 'X', reason: 'r' },
    { id: 'x', op: 'flip', flipType: 'both' },
  );
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.code, 'X');
  assert.equal(unavailable.message, 'r');

  const threw = await route.invokeImageTransformBackend(
    { ok: true, invoke: () => Promise.reject(new Error('channel exploded')) },
    { id: 'x', op: 'flip', flipType: 'both' },
  );
  assert.equal(threw.ok, false);
  assert.equal(threw.code, 'IMAGE_TRANSFORM_BACKEND_FAILED');

  const okResult = await route.invokeImageTransformBackend(
    { ok: true, invoke: () => Promise.resolve({ ok: true, data: { width: 480, height: 640 } }) },
    { id: 'x', op: 'rotate', degree: 90 },
  );
  assert.deepEqual(plain(okResult), { ok: true, data: { width: 480, height: 640 } });
});

// ─────────────────── (5) 接线：preload 行为 + main 信封契约 ───────────────────

test('(5) preload：具名方法命中 item:image-transform 并原样透传参数与信封', async () => {
  const calls = [];
  const api = loadPreload((channel, params) => {
    calls.push([channel, params]);
    return Promise.resolve({ ok: false, code: 'UNSUPPORTED_FORMAT', message: 'm', statusCode: 415 });
  });
  assert.equal(typeof api.item.imageTransform, 'function', 'item 组须暴露具名方法');
  const envelope = await api.item.imageTransform({ id: 'P1', op: 'rotate', degree: 90 });
  assert.deepEqual(calls, [['item:image-transform', { id: 'P1', op: 'rotate', degree: 90 }]]);
  assert.deepEqual(envelope, { ok: false, code: 'UNSUPPORTED_FORMAT', message: 'm', statusCode: 415 },
    '信封须原样穿过 contextBridge（reject 会丢掉结构化 code）');
});

test('(5) main：handler 转调后端并回**信封**（不 throw，否则 code 会丢在边界上）', () => {
  const main = read(MAIN_CJS);
  assert.match(main, /ipcMain\.handle\('item:image-transform', async \(event, params = \{\}\) => \{/,
    '须注册与 preload 同名的 handler');
  assert.match(main, /apiRequestDetailed\('\/api\/item\/imageTransform', \{ method: 'POST', body: params \|\| \{\} \}\)/,
    '须转调后端既有端点（不得新增或改写后端实现）');
  assert.match(main, /return \{\s*ok: false,\s*code: result\.code \|\| null,\s*statusCode: result\.statusCode \|\| 0,\s*message: result\.message,\s*\};/,
    '失败信封须原样携带后端的 code / statusCode / message');
  assert.doesNotMatch(main, /ipcMain\.handle\('item:image-transform'[\s\S]{0,800}?throw /,
    'handler 不得以异常形式回传（invoke 的 reject 会丢掉结构化 code）');

  // 传输层单点：结构化版本保留后端码，`apiRequest` 在其之上维持既有抛错语义
  assert.match(main, /code: \(typeof payload\.code === 'string' && payload\.code\) \? payload\.code : null,/,
    '传输层须能从后端响应体取回结构化 code');
  assert.match(main, /async function apiRequest\(route, options = \{\}\) \{\s*const result = await apiRequestDetailed\(route, options\);\s*if \(!result\.ok\) throw new Error\(result\.message/,
    'apiRequest 仍须对其余调用方保持既有抛错语义');
  assert.match(main, /const apiBase = process\.env\.EAGLE_API_URL \|\| 'http:\/\/localhost:41695';/,
    '沿用既有 apiBase，不新增第二套地址来源');
});
