/**
 * M4-E / F11 —— 「建面之后才注册的字段」可达性（运行期探针 + 回归 + 不触发不变量）。
 *
 * 背景（M4-R 的静态判定）：`core/scopeFace.ts` 无 Proxy，字段描述符只在**建面那一刻**
 * 按注册表枚举声明；`core/scopeFieldBridge.ts` 的 `migrateScopeFieldToStore` 此前不回连
 * `define()`。两者叠加的后果是：面已存在时再注册的字段，在面上**没有描述符**——直读恒
 * `undefined`、直写落 `plain` 自有属性（不落 store），注册表说它归 store、面说它归 plain，
 * 两边永久分歧且静默无报错。原注释（`scopeFace.ts` 首屏）却写「晚注册由 getter/setter 动态
 * 查表兜住」，与代码不符。
 *
 * 本文件用 `ts.transpileModule` + `vm` 加载**真实模块**（两个文件互相 require，按调用期解析
 * 接线），把三件事钉成可执行断言：
 *  1. 修复目标：晚注册字段在既有面上可达（读走 store、写落 store），且描述符是动态访问器；
 *  2. 负向自证：把「晚注册钩子」换成 no-op（= F11 未修复时的唯一差别），同一段断言必须失败
 *     —— 证明断言确实在测「钩子补挂描述符」这条路径，而不是被别的机制顺手满足；
 *  3. 为什么不触发：生产时序（store 模块顶层注册 → 之后才建面）下注册表在装面时已完整。
 *     该理由用 TypeScript AST 钉死（注册调用不在任何函数体内；建面调用都在函数体内），
 *     并在沙箱里复刻时序跑一遍。
 *
 * 局限（明写，避免读者高估覆盖）：
 *  - 「不触发」是**时序不变量**，不是编译期保证：若将来有人把注册挪进函数体（懒注册），
 *    本文件第 3 组会失败——这是刻意的，那时 F11 就不是潜伏缺陷而是真缺陷了。
 *  - AST 断言只看 `migrateScopeFieldToStore` 的直接调用点；经别名/`eval`/`new Function`
 *    的迂回注册不在覆盖内（本仓无此写法）。
 *  - 本文件不跑真实主窗（无 DOM/Electron）；它是模块级运行期探针，不替代冒烟。
 *
 * 运行：node tests/f11-scope-face-late-registration.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const REACT_ROOT = path.join(PROJECT_ROOT, 'src/app/react');
const FACE = 'src/app/react/core/scopeFace.ts';
const BRIDGE = 'src/app/react/core/scopeFieldBridge.ts';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function transpile(p) {
  const { outputText, diagnostics } = ts.transpileModule(read(p), {
    fileName: p,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  assert.equal(diagnostics.length, 0, `${p} 转译应无诊断：${JSON.stringify(diagnostics)}`);
  return outputText;
}

/**
 * 加载真实的 scopeFace + scopeFieldBridge 到一个共享沙箱。
 * 两模块循环 import，故 bridge 侧的 `require('./scopeFace')` 先给空壳、face 求值后再回填
 * （bridge 只在**调用期**取 `getWindowScope`，与 ESM 活绑定语义等价）。
 * 每次调用返回**全新模块实例**，故各 test 之间互不污染（面是模块级单例）。
 */
function loadScopeModules() {
  const bridgeExports = {};
  const faceExports = {};
  const faceModuleRef = {};

  const bridgeCtx = {
    exports: bridgeExports,
    module: { exports: bridgeExports },
    console,
    window: {},
    require(name) {
      if (name === './scopeFace') return faceModuleRef;
      throw new Error(`测试未桩接的模块：${name}`);
    },
  };
  bridgeCtx.module.exports = bridgeExports;
  vm.runInNewContext(transpile(BRIDGE), bridgeCtx, { filename: BRIDGE });

  const faceCtx = {
    exports: faceExports,
    module: { exports: faceExports },
    console,
    window: {},
    require(name) {
      if (name === './scopeFieldBridge') return bridgeExports;
      throw new Error(`测试未桩接的模块：${name}`);
    },
  };
  faceCtx.module.exports = faceExports;
  vm.runInNewContext(transpile(FACE), faceCtx, { filename: FACE });

  Object.assign(faceModuleRef, faceExports);
  return { bridge: bridgeExports, scope: faceExports };
}

/** 造一个 store 后端（read/write 直连一个可观测的槽）。 */
function makeBackend(initial) {
  const box = { value: initial, writes: [] };
  return {
    box,
    read: () => box.value,
    write: (v) => { box.writes.push(v); box.value = v; },
  };
}

/* ========================================================================= */
/* 1. 修复目标：面创建之后注册的字段必须可达                                   */
/* ========================================================================= */

test('F11 / 晚注册字段在既有面上可达（读走 store、写落 store）', () => {
  const { bridge, scope } = loadScopeModules();

  // 先把面建出来——此刻注册表为空，面里没有任何字段描述符。
  const face = scope.getScopeFace();
  const namesAtCreation = bridge.getMigratedScopeFieldNames();
  assert.equal(typeof face.$eval, 'function', '面已建（方法面在位）');

  // 空洞防护：断言此刻面上确实没有任何已注册字段（否则「可达」可能是建面枚举的功劳）。
  // 注意 `namesAtCreation` 出自 vm realm，跨 realm 数组原型不同，故只断长度不断深等。
  assert.equal(namesAtCreation.length, 0, `建面时注册表应为空，实得 ${JSON.stringify(namesAtCreation)}`);

  // ── 场景：建面之后才注册 ────────────────────────────────────────────────
  const backend = makeBackend('L0');
  bridge.migrateScopeFieldToStore('lateField', backend.read, backend.write);

  // 空洞防护：确认这确实是「晚」注册——建面时的清单里没有它。
  assert.ok(!namesAtCreation.includes('lateField'), 'lateField 必须是建面之后才注册的');

  // 正向断言：面属性可达，且读到的是**注册时** store 的值（不是 undefined）。
  assert.ok('lateField' in face, '晚注册字段必须出现在面上');
  assert.equal(face.lateField, 'L0', '面直读应走 store 的 read()');

  // 描述符必须是 `define()` 挂的动态访问器（不是快照值、不是普通 data 属性）。
  const desc = Object.getOwnPropertyDescriptor(face, 'lateField');
  assert.ok(desc && typeof desc.get === 'function' && typeof desc.set === 'function',
    '晚注册字段应挂 getter/setter 描述符');
  assert.equal(desc.enumerable, true, '字段描述符应可枚举');

  // 动态性：store 侧变化后，面读必须跟着变（证明读到的是活引用而非快照）。
  backend.box.value = 'L1';
  assert.equal(face.lateField, 'L1', '面读必须动态反映 store 变化');

  // 写面必须落 store（修复前会落 `plain` 自有属性，store 永远收不到）。
  face.lateField = 'L2';
  assert.equal(backend.box.value, 'L2', '写面必须落 store 的 write()');
  assert.deepEqual(backend.box.writes, ['L2'], '写应恰好经 store 一次');

  // 反向：经 writeScopeField 写入后，面读同样可见（两条路径收敛到同一处）。
  bridge.writeScopeField('lateField', 'L3');
  assert.equal(face.lateField, 'L3', 'writeScopeField 与面读应收敛到同一 store');
  assert.deepEqual(backend.box.writes, ['L2', 'L3']);

  // configurable:false 契约（cz2）不得因补挂而放松。
  assert.equal(desc.configurable, false, '注册字段仍是 store 的稳定视图（configurable:false）');
});

test('F11 / 负向自证：撤掉晚注册钩子，同一断言必须失败', () => {
  const { bridge, scope } = loadScopeModules();
  const face = scope.getScopeFace();

  // 把晚注册钩子换成 no-op —— 这正是 F11 未修复时面侧的**唯一差别**（注册表照旧登记，
  // 只是没人回调 define）。若下面的断言仍然通过，说明上一组测试是空泛的。
  bridge.installScopeFieldLateRegistrationHook(() => {});

  const backend = makeBackend('N0');
  bridge.migrateScopeFieldToStore('lateFieldNoHook', backend.read, backend.write);

  // 注册表确实登记了（不是「注册失败所以没属性」）。
  assert.ok(bridge.getMigratedScopeFieldNames().includes('lateFieldNoHook'),
    '注册表应登记该字段');
  assert.ok(bridge.getMigratedScopeField('lateFieldNoHook'), '注册表查询应命中');

  // 但因为钩子缺席，面拿不到属性 —— 与修复前的观测逐字一致。
  assert.ok(!('lateFieldNoHook' in face), '钩子缺席时面上不应有该属性');
  assert.equal(face.lateFieldNoHook, undefined, '钩子缺席时面直读应为 undefined');
  assert.equal(Object.getOwnPropertyDescriptor(face, 'lateFieldNoHook'), undefined,
    '钩子缺席时不应有自有描述符');

  // 且写面不落 store（落到面自己的普通属性上）—— 缺陷的另一半。
  face.lateFieldNoHook = 'N1';
  assert.equal(backend.box.value, 'N0', '钩子缺席时写面不落 store');
  assert.deepEqual(backend.box.writes, [], '钩子缺席时 store 不应收到任何写入');
  assert.equal(face.lateFieldNoHook, 'N1', '写面落到了面自身的普通属性');

  // 反面：同一实例上，注册表路径（writeScopeField）**仍然**是通的——
  // 证明缺陷只出在「直接面属性访问」这一条路上，与 M4-R 的爆炸半径判定一致。
  bridge.writeScopeField('lateFieldNoHook', 'N2');
  assert.equal(backend.box.value, 'N2', 'writeScopeField 走注册表，钩子缺席也照常落 store');
});

/* ========================================================================= */
/* 2. 回归：既有时序与语义逐字不变                                            */
/* ========================================================================= */

test('F11 回归 / 建面枚举、plain 写穿、保留名、幂等注册', () => {
  const { bridge, scope } = loadScopeModules();

  // (a) 早注册（生产实际时序）：建面时枚举即可达，无需钩子参与。
  const early = makeBackend('E0');
  bridge.migrateScopeFieldToStore('earlyField', early.read, early.write);
  const face = scope.getScopeFace();
  assert.equal(face.earlyField, 'E0', '早注册字段建面即可读');
  face.earlyField = 'E1';
  assert.equal(early.box.value, 'E1', '早注册字段写面落 store');
  assert.equal(Object.getOwnPropertyDescriptor(face, 'earlyField').configurable, false);

  // (b) 未注册名：仍是 plain 稀疏写穿（data 属性），不改语义。
  face.ghost = 'G';
  const ghostDesc = Object.getOwnPropertyDescriptor(face, 'ghost');
  assert.ok(ghostDesc && !ghostDesc.get, '未注册名应落普通 data 属性（plain 写穿）');
  assert.equal(face.ghost, 'G');
  assert.ok(!bridge.getMigratedScopeFieldNames().includes('ghost'), 'ghost 不应进入注册表');

  // (c) 保留名：注册表里出现也不得覆盖方法面。
  bridge.migrateScopeFieldToStore('$eval', () => 'HIJACK', () => {});
  assert.equal(typeof face.$eval, 'function', '$eval 必须仍是方法面，不被字段描述符覆盖');
  assert.equal(face.$eval(() => 'ok'), 'ok', '$eval 仍可执行传入函数');
  assert.equal(face.__eagleShim, true, '__eagleShim 标记位不得被覆盖');
  assert.equal(face.$root, face, '$root 自指不得被覆盖');
  assert.equal(face.$parent, face, '$parent 自指不得被覆盖');

  // (d) 幂等：重复注册不抛（configurable:false 下重定义会抛 TypeError），且后注册的
  //     read/write 会被既有的动态 getter/setter 立刻采纳。
  const second = makeBackend('R0');
  assert.doesNotThrow(() => {
    bridge.migrateScopeFieldToStore('earlyField', second.read, second.write);
  }, '重复注册不得因 configurable:false 重定义而抛错');
  assert.equal(face.earlyField, 'R0', '重复注册后应读到新的 read()');
  face.earlyField = 'R1';
  assert.equal(second.box.value, 'R1', '重复注册后写应落新的 write()');
  assert.equal(Object.getOwnPropertyDescriptor(face, 'earlyField').configurable, false,
    '重复注册不得改变描述符契约');

  // (e) 晚注册到「未注册期已被直写过」的名字上：面必须收敛到 store，
  //     而不是永远返回那个陈旧 plain 值（注册表优先是全仓既有口径）。
  face.stale = 'PLAIN';
  const stale = makeBackend('STORE');
  bridge.migrateScopeFieldToStore('stale', stale.read, stale.write);
  assert.equal(face.stale, 'STORE', '注册后应收敛到 store，而非沿用 plain 陈旧值');
  face.stale = 'WRITTEN';
  assert.equal(stale.box.value, 'WRITTEN', '注册后写面应落 store');
});

/* ========================================================================= */
/* 3. 为什么不触发：生产时序下注册表在装面时已完整（可执行断言）                */
/* ========================================================================= */

/** 取调用表达式的「被调名」：`f(...)` → f；`a.f(...)` → f；其它 → null。 */
function calleeName(node) {
  const expr = node.expression;
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name)) return expr.name.text;
  return null;
}

/** 收集某文件里名为 name 的调用点，并标注是否落在函数体内。 */
function collectCalls(filePath, names) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(PROJECT_ROOT, filePath);
  const source = ts.createSourceFile(abs, readFileSync(abs, 'utf8'), ts.ScriptTarget.ES2022, true,
    abs.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const rel = path.relative(PROJECT_ROOT, abs).replace(/\\/g, '/');
  const hits = [];
  (function walk(node) {
    if (ts.isCallExpression(node)) {
      const name = calleeName(node);
      if (names.includes(name)) {
        hits.push({
          file: rel,
          name,
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          inFunction: Boolean(ts.findAncestor(node, (n) => ts.isFunctionLike(n))),
        });
      }
    }
    ts.forEachChild(node, walk);
  })(source);
  return hits;
}

function listSources(dir) {
  const out = [];
  (function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
  })(dir);
  return out;
}

test('F11 不变量 / 注册发生在模块求值期，建面发生在运行期（故生产不触发）', () => {
  const sources = listSources(REACT_ROOT);

  // (a) 所有 `migrateScopeFieldToStore(...)` 调用都**不在任何函数体内**
  //     ⇒ 注册在 store 模块求值期就已完成，不依赖任何运行期入口。
  const registrations = sources.flatMap((f) => collectCalls(f, ['migrateScopeFieldToStore']));
  assert.ok(registrations.length >= 10,
    `注册点应至少覆盖 10 个 store（实得 ${registrations.length}）`);
  const lazyRegistrations = registrations.filter((h) => h.inFunction);
  assert.equal(lazyRegistrations.length, 0,
    '存在函数体内的（懒）注册：这会让 F11 从「潜伏」变成「真触发」，须重新评估并补测：'
    + JSON.stringify(lazyRegistrations));
  // 空洞防护：注册点必须分布在多个 store 模块，而不是同一处的重复。
  const registrationFiles = new Set(registrations.map((h) => h.file));
  assert.ok(registrationFiles.size >= 10,
    `注册点应分布在 10 个 store 模块（实得 ${registrationFiles.size}）`);

  // (b) 所有建面/装注册表的调用都在**函数体内** ⇒ 面只会在启动运行期创建，
  //     而那一刻（静态 import 全部求值完毕）注册表已满。
  const faceCalls = sources.flatMap((f) =>
    collectCalls(f, ['createBodyScopeFace', 'getScopeFace', 'installScopeRegistry']));
  assert.ok(faceCalls.length > 0, '应能找到建面调用点（否则本断言空转）');
  const topLevelFaceCalls = faceCalls.filter((h) => !h.inFunction);
  assert.equal(topLevelFaceCalls.length, 0,
    '存在模块顶层的建面调用：模块求值顺序将决定面里有哪些字段，F11 会真触发：'
    + JSON.stringify(topLevelFaceCalls));
});

test('F11 不变量 / 复刻生产时序：先满注册表、后建面，字段一次到位', () => {
  const { bridge, scope } = loadScopeModules();

  // 复刻真实启动序：10 个 store 模块顶层注册（此处以直调模拟）→ 之后才首次建面。
  const backends = Array.from({ length: 10 }, (_, i) => makeBackend(`V${i}`));
  backends.forEach((b, i) => bridge.migrateScopeFieldToStore(`storeField${i}`, b.read, b.write));

  const face = scope.getScopeFace();
  const missing = [];
  backends.forEach((b, i) => {
    const name = `storeField${i}`;
    if (face[name] !== `V${i}`) missing.push(name);
  });
  assert.deepEqual(missing, [], '生产时序下 10 个字段建面即可达（无需晚注册钩子参与）');

  // 且这批字段确实是建面枚举出来的（描述符此刻已在位上）。
  assert.equal(Object.getOwnPropertyDescriptor(face, 'storeField0')?.configurable, false);
});
