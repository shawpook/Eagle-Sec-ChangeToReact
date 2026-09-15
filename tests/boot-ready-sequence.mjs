/**
 * F10（m1-f10-bootready）：跨窗供给的**启动就绪**单测。
 *
 * 修前病灶：`main.tsx` 的 `void import('./core/externalSupplyRegistrar')` 从未被 await，
 * 就绪门只看 `mousetrap` 一个字段，于是「machinery 已挂载供给包装 → 供给尚未注册」的窗口
 * 真实存在：子窗口（viewers/font、viewers/text-editor）与主 UI 驱动脚本（electron/main.cjs）
 * 经 `callExternal` 拿到 `undefined`，静默失败。
 *
 * 验证手段：不起浏览器/Electron，用 typescript 内存转译 + `node:vm` 隔离加载**真实模块**
 * （`core/externalSupply.ts` 零依赖、`core/bootSequence.ts` 零依赖），依赖经 vm 的 require
 * 闸门显式注入 —— 未登记的依赖直接断言失败，避免「测到替身而不是被测代码」。
 *
 * 覆盖：契约面语义 / 未就绪可观测失败 / 人为延迟窗口 / 装配顺序与同步前缀不变量 / 幂等 /
 *       门判据 / 静态接线。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const SUPPLY_PATH = 'src/app/react/core/externalSupply.ts';
const BOOT_PATH = 'src/app/react/core/bootSequence.ts';
const REGISTRAR_PATH = 'src/app/react/core/externalSupplyRegistrar.ts';
const MAIN_PATH = 'src/app/react/main.tsx';

function read(rel) {
  return fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
}

/** 与 tests/preview-entry-subscriptions.mjs 同款：转译为 CJS 后在隔离 vm 中执行。 */
function loadModule(rel, imports = {}, globals = {}, source = read(rel)) {
  const { outputText, diagnostics } = ts.transpileModule(source, {
    fileName: rel,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  assert.equal(diagnostics.length, 0, `${rel} 转译应无诊断`);
  const exports = {};
  vm.runInNewContext(outputText, {
    ...globals,
    exports,
    module: { exports },
    require(name) {
      assert.ok(Object.hasOwn(imports, name), `禁止加载未隔离的依赖：${name}`);
      return imports[name];
    },
  }, { filename: rel });
  return exports;
}

/** vm 内构造的数组/对象跨 realm 比较会因原型不同而失败，统一在本 realm 重建。 */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const quietConsole = { log() {}, warn() {}, error() {} };
const TAKEOVER_NAMES = ['preferences', 'library', 'item', 'filter', 'selectionView', 'misc'];
/** machineryInfra 中经 callExternal 挂到 scope 面的供给名（与本测试的挂载替身一致）。 */
const MOUNTED_NAMES = [
  'activateFont', 'deactivateFont', 'escHandler', 'copyAsPath', 'getRawPath', 'getRawUrl',
  'select', 'addImagesToFolder',
];

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** 排空微任务 + 宏任务，使序列器推进到下一个 await 点。 */
async function flush(rounds = 3) {
  for (let index = 0; index < rounds; index += 1) {
    await new Promise((resolve) => { setImmediate(resolve); });
  }
}

/**
 * 装配一个「真实模块 + 假依赖」的启动环境。
 * 驱动面替身复刻 driverApi 的结构：白名单字段经 getter 回落 scope 面（`face`）。
 */
function createHarness(overrides = {}) {
  const env = {}; // 兼作 window
  const supply = loadModule(SUPPLY_PATH, {}, { window: env, console: quietConsole });
  const boot = loadModule(BOOT_PATH, {}, { window: env, console: quietConsole });
  const names = [...supply.EXTERNAL_SUPPLY_NAMES];
  const registered = () => plain(supply.registeredExternalSupplyNames());

  const log = {
    installs: 0, imports: 0, takeovers: [], observations: [],
    registeredAtDriverInstall: null, installsAtSupply: null, takeoversAtSupply: null,
    stepsAtSupply: null,
  };
  const face = {};
  const api = { __eagleDriver: true };
  // 白名单字段（供给名 + 门判据字段 mousetrap）经 getter 回落 scope 面，与 driverApi 同构。
  for (const name of [...names, 'mousetrap']) {
    Object.defineProperty(api, name, {
      configurable: true,
      enumerable: true,
      get: () => face[name],
      set: (value) => { face[name] = value; },
    });
  }
  if (overrides.mousetrap !== false) face.mousetrap = { bind() {} };

  const mountWrappers = () => {
    for (const name of MOUNTED_NAMES) face[name] = (...args) => supply.callExternal(name, ...args);
  };
  /** 跨窗调用点的最小复刻：挂载包装（子窗 parentCall / main.cjs scope.X 的落地形态）。 */
  const wrapperFor = (name) => (...args) => supply.callExternal(name, ...args);

  const registerAll = (factory = (name) => () => `${name}-result`) => {
    const map = {};
    for (const name of names) map[name] = factory(name);
    supply.registerExternalSupply(map);
    return map;
  };

  const observe = (step) => log.observations.push({
    step,
    driverInstalled: env.__eagleDriver === api,
    registered: supply.registeredExternalSupplyNames().length,
  });

  const bootOptions = (extra = {}) => ({
    environment: env,
    installDriverApi: () => {
      log.installs += 1;
      log.registeredAtDriverInstall = supply.registeredExternalSupplyNames().length;
      env.__eagleDriver = api;
      return api;
    },
    installScopeRegistry: () => { env.__eagleScopeRegistry = { installed: true }; },
    getDriverApi: () => api,
    getScopeFace: () => face,
    // 与 main.tsx 同构：装载走 externalSupply 的单一记忆化 Promise（幂等亦由此承载）。
    loadSupply: () => supply.loadExternalSupply(async () => {
      log.imports += 1;
      log.installsAtSupply = log.installs;
      log.takeoversAtSupply = log.takeovers.length;
      log.stepsAtSupply = log.observations.length;
      if (extra.gate) await extra.gate.promise;
      if (extra.register === false) return;
      registerAll(extra.factory);
    }),
    supplyNames: names,
    registeredSupplyNames: () => supply.registeredExternalSupplyNames(),
    mountSteps: [
      { name: 'portsProbe', run: () => observe('portsProbe') },
      {
        name: 'scopeFaceAlias',
        run: () => {
          if (overrides.coreState !== false) env.__eagleCoreState = face;
          observe('scopeFaceAlias');
        },
      },
      { name: 'machineryScope', run: () => { mountWrappers(); observe('machineryScope'); } },
    ],
    takeoverSteps: TAKEOVER_NAMES.map((name) => ({
      name,
      run: () => { log.takeovers.push(name); observe(`takeover:${name}`); },
    })),
    schedule: (run) => run(), // 同步调度：就绪门轮询不真实等待
    ...extra.options,
  });

  const diagnostics = () => plain(boot.bootDiagnostics());

  return {
    env, face, api, supply, boot, names, log, diagnostics,
    bootOptions, registerAll, mountWrappers, wrapperFor, registered, flush,
  };
}

/** 提取 `registerExternalSupply({...})` 的对象字面量键名（名单一致性静态检查）。 */
function registrarKeys(source = read(REGISTRAR_PATH)) {
  const file = ts.createSourceFile(REGISTRAR_PATH, source, ts.ScriptTarget.Latest, true);
  let keys = null;
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
      && node.expression.text === 'registerExternalSupply') {
      const [argument] = node.arguments;
      assert.ok(argument && ts.isObjectLiteralExpression(argument), 'registerExternalSupply 实参必须是对象字面量');
      keys = argument.properties.map((property) => {
        if (ts.isShorthandPropertyAssignment(property)) return property.name.text;
        if (ts.isPropertyAssignment(property)) return property.name.text;
        assert.fail(`不支持的注册项写法：${ts.SyntaxKind[property.kind]}`);
        return null;
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.ok(keys, '未找到 registerExternalSupply 调用');
  return keys;
}

test('externalSupply：契约名单全项（F08 后 17 项），未注册的契约内调用抛可观测错误而非 undefined', () => {
  const h = createHarness();
  assert.equal(h.names.length, 17);
  assert.deepEqual(plain(h.supply.missingExternalSupplyNames()), h.names);
  assert.deepEqual(h.registered(), []);
  assert.equal(typeof h.env.__eagleExternalSupply, 'object', 'window.__eagleExternalSupply 诊断口保留');

  // 契约外名字维持旧语义（未供给即 undefined），不在本次收敛范围
  assert.equal(h.supply.callExternal('_notInContract', 1), undefined);

  assert.throws(() => h.supply.callExternal('activateFont', { id: 'a' }), (error) => {
    assert.equal(error.name, 'ExternalSupplyNotReadyError');
    assert.equal(error.supplyName, 'activateFont');
    assert.equal(error.missing.length, 17);
    assert.match(error.message, /跨窗供给未就绪：activateFont 尚未注册/);
    assert.match(error.message, /__eagleSupplyState=/, '错误信息带启动状态，便于定位');
    return true;
  });
  assert.equal(h.env.__eagleSupplyFailures.length, 1, '失败必须留痕');
  assert.equal(h.env.__eagleSupplyFailures[0].name, 'activateFont');

  // 注册后：参数与返回值原样透传，缺失清单清空
  const calls = [];
  h.registerAll((name) => (...args) => { calls.push([name, args]); return `${name}:ok`; });
  assert.deepEqual(plain(h.supply.missingExternalSupplyNames()), []);
  assert.equal(h.supply.callExternal('select', undefined, { id: 7 }), 'select:ok');
  assert.deepEqual(plain(calls[0]), ['select', [null, { id: 7 }]]);
  assert.equal(h.env.__eagleSupplyFailures.length, 1, '就绪后不再新增失败');
});

test('externalSupply：重复注册与重复装载不产生重复注册，import 只发生一次', async () => {
  const h = createHarness();
  const invoked = [];
  const map = {};
  for (const name of h.names) map[name] = () => { invoked.push(name); return name; };
  h.supply.registerExternalSupply(map);
  h.supply.registerExternalSupply(map);
  assert.deepEqual(h.registered(), h.names, '重复注册不产生重复项');
  h.supply.callExternal('select');
  h.supply.callExternal('select');
  assert.deepEqual(invoked, ['select', 'select'], '重复注册不叠加调用');

  let imports = 0;
  const registrar = () => { imports += 1; h.registerAll(); };
  await h.supply.loadExternalSupply(registrar);
  await h.supply.loadExternalSupply(registrar);
  assert.equal(imports, 1, '单一装载 Promise：重复调用只 import 一次');
  assert.equal(h.env.__eagleSupplyState, 'ok');
  assert.deepEqual(Object.keys(h.env.__eagleExternalSupply).sort(), [...h.names].sort(), '注册表键不重复');
});

test('externalSupply：import 失败与注册不完整都记为 err 并 reject', async () => {
  const broken = createHarness();
  await assert.rejects(() => broken.supply.loadExternalSupply(async () => { throw new Error('chunk 404'); }),
    /chunk 404/);
  assert.equal(broken.env.__eagleSupplyState, 'err:chunk 404');
  // 失败被记忆化：重复装载观察同一失败，不重试（避免「重试成功」掩盖真实失败）
  await assert.rejects(() => broken.supply.loadExternalSupply(async () => { throw new Error('again'); }),
    /chunk 404/);

  const partial = createHarness();
  await assert.rejects(() => partial.supply.loadExternalSupply(async () => {
    partial.supply.registerExternalSupply({ activateFont: () => 'only-one' });
  }), /跨窗供给注册不完整，缺少：/);
  assert.match(partial.env.__eagleSupplyState, /^err:跨窗供给注册不完整/);
  assert.equal(partial.supply.missingExternalSupplyNames().length, 16, '缺失清单可观测（契约 17 项，只注册了 1 项）');
});

test('F10-a：人为延迟供给注册期间，跨窗动作显式失败并留痕，注册完成后同一入口正常返回', async () => {
  const h = createHarness();
  const gate = deferred();
  const bootPromise = h.boot.startBoot(h.bootOptions({ gate }));
  await flush();

  // 窗口期：同步前缀（驱动面安装 / 挂载 / 六域接管）已完成，序列器停在供给阶段 ——
  // machinery 的 callExternal 包装已挂到 scope 面与驱动面，而供给尚未注册。
  // 这正是修前的静默失败窗口（修前该窗口内 callExternal 返回 undefined）。
  assert.equal(h.diagnostics().phase, 'supply');
  assert.equal(h.env.__eagleBootState, 'booting');
  assert.equal(h.env.__eagleSupplyState, 'pending');
  assert.deepEqual(h.registered(), []);
  assert.deepEqual(h.log.takeovers, TAKEOVER_NAMES, '六域接管在同步前缀内完成（一次性启动事件）');
  assert.equal(h.log.stepsAtSupply, 9, '装载供给时挂载+接管 9 步已全部执行');

  // ① 供给直调点（core/itemDomain.ts / core/libraryDomain.ts 的 callExternal 直调）
  assert.throws(() => h.supply.callExternal('getRawUrl', { id: 'x' }), /跨窗供给未就绪/);
  // ② 挂载包装调用点 —— 修前静默返回 undefined，调用方（子窗 parentCall）以为动作已执行
  assert.throws(() => h.wrapperFor('copyAsPath')(), /跨窗供给未就绪：copyAsPath/);
  // ③ 驱动面字段调用点 —— main.cjs / 子窗经 window.__eagleDriver 走同一挂载包装
  assert.throws(() => h.api.activateFont({ id: 'a' }), /跨窗供给未就绪：activateFont/);
  assert.equal(h.env.__eagleSupplyFailures.length, 3, '窗口期失败必须留痕');
  assert.equal(h.env.__eagleSupplyFailures[0].bootState, 'booting');
  assert.equal(h.env.__eagleSupplyFailures[0].supplyState, 'pending');
  assert.notEqual(h.env.__eagleBootState, 'ready', '窗口期内不得宣告就绪');
  assert.equal(h.env.__eagleBootReady, undefined, '就绪标记不得先行置位');

  // 注册完成
  gate.resolve();
  await bootPromise;
  assert.equal(h.env.__eagleBootState, 'ready');
  assert.equal(h.env.__eagleBootReady, true);
  assert.equal(h.env.__eagleSupplyState, 'ok');
  assert.equal(h.registered().length, 17);
  assert.equal(h.api.activateFont({ id: 'a' }), 'activateFont-result', '就绪后挂载包装正常派发');
  assert.equal(h.supply.callExternal('getRawUrl', {}), 'getRawUrl-result');
  assert.equal(h.env.__eagleSupplyFailures.length, 3, '就绪后不再新增失败');
});

test('F10 同步前缀不变量：装载供给前，挂载与六域接管必须已全部完成（中间不得有 await）', async () => {
  // 实测（三组 A/B，见 core/bootSequence.ts 头部）：把挂载或六域接管中的任一侧推迟到动态
  // import 之后，都会让主进程的一次性启动事件（app-status-library-loaded）永久丢失 →
  // raw 恒空 → allData=0 / listDone 恒 false → D3 闭环 FAIL。故本用例把「同处一个同步
  // 前缀」钉成不变量：若将来有人把 mountSteps/takeoverSteps 挪到 await loadSupply 之后，
  // 此处即红。
  const h = createHarness();
  const gate = deferred();
  const bootPromise = h.boot.startBoot(h.bootOptions({ gate }));
  await flush(); // 供给装载走 Promise.resolve().then(...)，注册体在微任务中开始
  assert.equal(h.log.imports, 1);
  assert.equal(h.log.takeoversAtSupply, TAKEOVER_NAMES.length, '装载前六域各接管一次');
  assert.equal(h.log.stepsAtSupply, 9, '装载前挂载+接管共 9 步已完成');
  assert.equal(h.log.takeovers.length, TAKEOVER_NAMES.length);
  gate.resolve();
  await bootPromise;
});

test('F10-b：装配顺序 driverApi → 门 → 挂载 → 六域接管 → 供给注册 → ready', async () => {
  const h = createHarness();
  await h.boot.startBoot(h.bootOptions());

  const diagnostics = h.diagnostics();
  assert.deepEqual(diagnostics.order, [
    'driverApi', 'gate',
    'mount:portsProbe', 'mount:scopeFaceAlias', 'mount:machineryScope',
    ...TAKEOVER_NAMES.map((name) => `takeover:${name}`),
    'supply', 'ready',
  ]);
  assert.equal(diagnostics.phase, 'ready');
  assert.equal(diagnostics.attempts, 1, '首次判定即通过时不再轮询');
  assert.equal(diagnostics.counts.mount, 3);
  assert.equal(diagnostics.counts.takeover, 6);
  assert.equal(diagnostics.missing.driver.length, 0);
  assert.equal(diagnostics.missing.supply.length, 0);
  assert.notEqual(diagnostics.readyAt, null);

  // 顺序不靠 order 数组自证：记录各阶段执行「当时」的前置状态
  assert.equal(h.log.registeredAtDriverInstall, 0, '驱动面安装时供给尚未注册');
  assert.equal(h.log.installsAtSupply, 1, '供给装载时驱动面已安装');
  assert.equal(h.log.takeoversAtSupply, 6, '供给装载时六域接管已完成（同步前缀，见不变量用例）');
  assert.equal(h.log.imports, 1);
  assert.deepEqual(h.log.observations.map((row) => row.step), [
    'portsProbe', 'scopeFaceAlias', 'machineryScope',
    ...TAKEOVER_NAMES.map((name) => `takeover:${name}`),
  ]);
  for (const observation of h.log.observations) {
    assert.equal(observation.driverInstalled, true, `${observation.step} 执行时驱动面必须已安装`);
    // 挂载/接管与驱动面安装同处同步前缀，执行时供给必然尚未注册 —— 这正是 F10 窗口；
    // 窗口内的跨窗调用可观测（F10-a），故「先注册后接管」的字面顺序被本次取证推翻。
    assert.equal(observation.registered, 0, `${observation.step} 执行时供给尚未注册`);
  }
  assert.equal(h.registered().length, 17, '就绪时供给必须契约全量（17/17）注册');
  assert.equal(h.env.__eagleBootState, 'ready');
  assert.deepEqual(h.env.__eagleSupplyFailures, undefined, '正常装配全程无未就绪失败');
});

test('F10-b：就绪门判据不止 mousetrap——mousetrap 缺失时门不通过且不进入供给/接管', async () => {
  const h = createHarness({ mousetrap: false });
  await assert.rejects(h.boot.startBoot(h.bootOptions({ options: { maxAttempts: 4 } })), (error) => {
    assert.equal(error.name, 'BootNotReadyError');
    assert.match(error.message, /驱动面判据超时未满足：mousetrap/);
    return true;
  });
  const diagnostics = h.diagnostics();
  assert.equal(diagnostics.attempts, 5);
  assert.deepEqual(diagnostics.missing.driver, ['mousetrap']);
  assert.equal(diagnostics.order.includes('supply'), false, '门未通过不得装载供给');
  assert.equal(h.log.imports, 0);
  assert.deepEqual(h.log.takeovers, []);
  assert.match(h.env.__eagleBootState, /^err:/);
  assert.equal(h.env.__eagleBootFailures.length, 1);
});

test('F10-b：driver 面身份是独立判据——api 未挂到 window 即视为未就绪', async () => {
  const h = createHarness();
  await assert.rejects(h.boot.startBoot(h.bootOptions({
    options: {
      maxAttempts: 2,
      // 只构建 api，不写 window.__eagleDriver：mousetrap 齐备也不得放行
      installDriverApi: () => { h.log.installs += 1; return h.api; },
    },
  })), /驱动面判据超时未满足：window\.__eagleDriver/);
  assert.deepEqual(h.diagnostics().missing.driver, ['window.__eagleDriver']);
  assert.match(h.env.__eagleBootState, /^err:/);
  assert.deepEqual(h.log.takeovers, []);
  assert.equal(h.log.imports, 0);
});

test('F10-b：scope 面存在是独立判据——mousetrap 齐备但 scope 面缺失也不放行', async () => {
  const h = createHarness();
  await assert.rejects(h.boot.startBoot(h.bootOptions({
    options: { maxAttempts: 2, getScopeFace: () => null },
  })), /驱动面判据超时未满足：scopeFace/);
  assert.deepEqual(h.diagnostics().missing.driver, ['scopeFace']);
  assert.match(h.env.__eagleBootState, /^err:/);
  assert.equal(h.log.imports, 0, '门未通过不得装载供给');
  assert.deepEqual(h.log.takeovers, []);
});

test('F10-b：装载失败与注册不完整都中止在供给阶段（不宣告就绪、留痕）', async () => {
  // 注意：同步前缀（挂载 + 六域接管）在供给装载之前已执行且**不可回退** —— 它们是主进程
  // 一次性启动事件的唯一注册点（见 bootSequence 头部实测）。故「中止」的语义是：不宣告
  // 就绪、状态留 err:*、失败可观测；窗口期内跨窗调用按 F10-a 抛错而非静默。
  const incomplete = createHarness();
  await assert.rejects(incomplete.boot.startBoot(incomplete.bootOptions({ register: false })), (error) => {
    assert.equal(error.name, 'BootNotReadyError');
    assert.match(error.message, /跨窗供给装载失败：跨窗供给注册不完整/);
    return true;
  });
  const incompleteDiagnostics = incomplete.diagnostics();
  assert.equal(incompleteDiagnostics.phase, 'error');
  assert.deepEqual(incompleteDiagnostics.order, [
    'driverApi', 'gate',
    'mount:portsProbe', 'mount:scopeFaceAlias', 'mount:machineryScope',
    ...TAKEOVER_NAMES.map((name) => `takeover:${name}`),
    'error',
  ]);
  assert.deepEqual(incomplete.log.takeovers, TAKEOVER_NAMES, '六域接管在同步前缀内已完成');
  assert.notEqual(incomplete.env.__eagleBootState, 'ready');
  assert.match(incomplete.env.__eagleBootState, /^err:跨窗供给装载失败：跨窗供给注册不完整/);
  assert.equal(incomplete.env.__eagleBootReady, undefined);
  assert.equal(incomplete.env.__eagleBootFailures.length, 1);

  // 装载「成功但不含注册」：由序列器自身的完整性判据兜底
  const silent = createHarness();
  await assert.rejects(silent.boot.startBoot(silent.bootOptions({
    options: { loadSupply: async () => { silent.log.imports += 1; } },
  })), (error) => {
    assert.equal(error.name, 'BootNotReadyError');
    assert.match(error.message, /跨窗供给注册不完整：/);
    return true;
  });
  const silentDiagnostics = silent.diagnostics();
  assert.equal(silentDiagnostics.missing.supply.length, 17, '缺失清单必须落进诊断');
  // order 里的 'supply' 表示「供给阶段完成」：未完成即未登记（两种情况用 missing.supply 区分）
  assert.deepEqual(silentDiagnostics.order, [
    'driverApi', 'gate',
    'mount:portsProbe', 'mount:scopeFaceAlias', 'mount:machineryScope',
    ...TAKEOVER_NAMES.map((name) => `takeover:${name}`),
    'error',
  ]);
  assert.match(silentDiagnostics.error, /^跨窗供给注册不完整：/);
  assert.deepEqual(incompleteDiagnostics.missing.supply, [], '装载即失败时尚未走到完整性判据');
  assert.equal(silent.env.__eagleBootReady, undefined);
});

test('F10-b：终检判据——核心诊断口缺失时不宣告就绪', async () => {
  const h = createHarness({ coreState: false });
  await assert.rejects(h.boot.startBoot(h.bootOptions()),
    /宣告就绪前判据未满足：window\.__eagleCoreState/);
  assert.match(h.env.__eagleBootState, /^err:/);
  assert.equal(h.env.__eagleBootReady, undefined);
  assert.equal(h.env.__eagleBootFailures.length, 1);
});

test('F10-c：重复 startBoot 只跑一次（安装/导入/接管各一次）', async () => {
  const h = createHarness();
  const first = h.boot.startBoot(h.bootOptions());
  const second = h.boot.startBoot(h.bootOptions());
  assert.equal(first, second, '重复调用返回同一启动 Promise');
  await first;
  await h.boot.startBoot(h.bootOptions());
  const diagnostics = h.diagnostics();
  assert.equal(h.log.installs, 1);
  assert.equal(h.log.imports, 1);
  assert.deepEqual(h.log.takeovers, TAKEOVER_NAMES, '六域各接管一次，不重复');
  assert.equal(diagnostics.counts.takeover, 6);
  assert.equal(diagnostics.counts.mount, 3);
  assert.equal(diagnostics.order.filter((entry) => entry === 'supply').length, 1);
  assert.equal(diagnostics.order.filter((entry) => entry === 'ready').length, 1);
});

test('F10-c：启动失败后重复调用观察同一失败，不重跑', async () => {
  const h = createHarness({ mousetrap: false });
  const options = () => h.bootOptions({ options: { maxAttempts: 1 } });
  await assert.rejects(h.boot.startBoot(options()), /mousetrap/);
  await assert.rejects(h.boot.startBoot(options()), /mousetrap/);
  assert.equal(h.log.installs, 1, '失败后的重复调用不得重跑启动');
  assert.equal(h.log.imports, 0);
  assert.equal(h.env.__eagleBootFailures.length, 1, '失败只留痕一次');
});

test('F10 静态接线：main.tsx 保留动态 import 但真正 await，六域接管在序列器内', () => {
  const source = read(MAIN_PATH);
  assert.equal(/^\s*void import\(/m.test(source), false, '不得再以 void import 发起供给装载');
  assert.equal(/function bridgeWhenReady/.test(source), false, '轮询式 bridgeWhenReady 已被单一启动序列取代');
  assert.match(source, /loadExternalSupply\(\(\) => import\('\.\/core\/externalSupplyRegistrar'\)\)/,
    '动态 import 保留（静态 import 会打断 ESM 求值顺序、启动加载链）');
  assert.match(source, /import \{ startBoot \} from '\.\/core\/bootSequence'/);
  assert.match(source, /loadSupply: \(\) => supplyLoad/, '供给 Promise 必须交给启动序列 await');
  assert.match(source, /supplyNames: EXTERNAL_SUPPLY_NAMES/);
  assert.match(source, /registeredSupplyNames: registeredExternalSupplyNames/);
  for (const [step, fn] of [
    ['preferences', 'takeoverPreferencesDomain'], ['library', 'takeoverLibraryDomain'],
    ['item', 'takeoverItemDomain'], ['filter', 'takeoverFilterDomain'],
    ['selectionView', 'takeoverSelectionViewDomain'], ['misc', 'takeoverMiscDomain'],
  ]) {
    assert.match(source, new RegExp(`\\{ name: '${step}', run: ${fn} \\}`), `六域接管缺 ${step}`);
  }
  for (const [step, fn] of [
    ['portsProbe', 'installPortsProbe'], ['machineryScope', 'applyDataMachineryScope'],
  ]) {
    assert.match(source, new RegExp(`\\{ name: '${step}', run: ${fn} \\}`), `挂载步骤缺 ${step}`);
  }
  // 挂载步骤名不得落地成裸词 'coreState'：哨兵以 `/\bcoreState\b/` 统计**非注释行**做 scope
  // 字符串键收敛台账，裸词步骤名会被误计为回退项（实测 SENTINEL_REGRESSED
  // `metric coreState: 1 > baseline 0`）。`__eagleCoreState` 因前缀相连不命中。
  assert.equal(/\{ name: 'coreState', run:/.test(source), false, '步骤名不得命中哨兵 coreState 度量');
  assert.match(source, /__eagleCoreState = getScopeFace\(\)/, '核心诊断口仍须挂载');
});

test('F10 名单一致性：注册端、契约名单与驱动动作白名单三处同源', () => {
  const names = [...loadModule(SUPPLY_PATH, {}, { window: {}, console: quietConsole }).EXTERNAL_SUPPLY_NAMES];
  assert.deepEqual([...registrarKeys()].sort(), [...names].sort(),
    'externalSupplyRegistrar 的注册项必须与契约名单一致');
  const driver = read('src/app/react/core/driverApi.ts');
  for (const name of names) {
    assert.match(driver, new RegExp(`'${name}'`), `driverApi 动作白名单缺 ${name}`);
  }
});
