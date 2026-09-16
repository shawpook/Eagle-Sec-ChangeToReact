/**
 * M3-2：调用点切换后的**冷启动证明**与「规则表缺席不得写空快照」的可断言修复。
 *
 * ── 本测试要证的三件事（以及各自证到什么程度）──
 *
 * **① 冷启动：模块求值完成时规则表已可用**（行为断言，非口头论证）
 *    在一个**没有装载任何 vendor 脚本**的上下文里装载真实的 `core/filterDomain.ts`，
 *    先断言 `window.isMatch*Rule` 确实缺席（冷启动现场成立），再驱动一次真实筛选，
 *    断言它算出了正确结果、且 `getMatchRuleTableFailureCount()` 仍为 0。
 *    切换前这是不可能的：两个 loader 都是 `fetch(...).then(...)`（必然异步），
 *    `loadSupply()` / `EXTERNAL_SUPPLY_NAMES` 都不覆盖这两个 vendor 脚本。
 *
 * **② 调用点级等价：filterDomain 走的规则函数 == vendor 全局**（行为断言）
 *    在有 vendor 的第二上下文里，对 26 条规则 × 多条 (rule, image) 扫一遍：
 *    `machineryExistInSmartFilter`（真实调用链）的返回值与直接调
 *    `window.isMatchXxxRule` 的返回值逐组比对。单规则条件树下
 *    `existInSmartFilter === 规则函数返回值`，故对照物就是 vendor 本尊，没有期望值可写错。
 *    同时用**间谍表**证明调用点确实经由 `getMatchRuleTable()` 取函数（而非绕过）。
 *
 * **③ 规则表缺席时不得写空快照**（行为断言 —— 本批的关键正确性修复）
 *    `machineryFilterRawPass()` 是生产路径本身（`machineryCalcuteFilterResult` 就调它）。
 *    三种情形分开断言：
 *      · 有命中      → trustworthy=true  + 写缓存 [命中项]
 *      · 真·空集     → trustworthy=true  + **写缓存 []**（合法空集，必须照写）
 *      · 表缺席      → trustworthy=false + **不写缓存**（这是修复点）
 *    第三种的失败信号必须**可观测**：调用链上游 `machineryExistInSmartFilter` 有
 *    `catch { return false; }`（既有兜底，本批不拆），异常会被吞掉——所以断言的是
 *    「返回值仍是 false（行为不变）」+「计数与 last 记录确实动了（信号可观测）」。
 *
 * ── 装载方式与替身边界（不掩盖被测对象）──
 * 被测对象是**真实 transpile 后的 `core/filterDomain.ts` + `core/rules/*.ts`**；
 * `core/filterDomain.ts` 的依赖图含 store/DOM/ipc 三十余模块，其中
 * `machineryFilterData` 三分片（1574-2600+）依赖 `w.eagle.filter` 全表与 DOM，
 * 在 Node 里不可驱动——因此**只对这些边界模块注入替身**，并对 store 保留真实形状
 * （selectedSmartFolders / raw 等字段可被测试直接驱动）。规则表一侧**不用替身**：
 * `./rules/matchRuleTable` 走真实模块，只在其外层包一层记录调用的间谍。
 *
 * 本文件刻意不引入 `tests/match-rules-equivalence.mjs` 的装载器（那是批次 1 的测试，
 * 只读，import 它会连带执行其 test 块）；此处按同一手法重写装载器，约 30 行。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

const FILTER_DOMAIN = 'src/app/react/core/filterDomain.ts';
const DETAIL_SERVICE = 'src/app/react/services/detailService.ts';
const RULES_DIR = 'src/app/react/core/rules';
const VENDOR_MATCH = 'frontend/public/vendor/eagle-match-rules.js';
const VENDOR_ZOOM = 'frontend/public/vendor/eagle-zoom-helpers.js';

const repoRequire = createRequire(new URL('../package.json', import.meta.url));
const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

/** vendor 只允许 require 这两个包；其它一律断言失败（防「测到替身」）。 */
const ALLOWED_VENDOR_REQUIRES = new Set(['color-convert', 'delta-e']);

/** 去注释后的源码：静态断言只应看代码，不该被我自己的说明文字误伤。 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

// ───────────────────────── vm 夹具 ─────────────────────────

/** 记录 `console.error` 以便断言「失败是可观测的」，其余静音。 */
function makeConsole() {
  const errors = [];
  return {
    errors,
    console: {
      log() {}, warn() {}, info() {}, time() {}, timeEnd() {}, debug() {},
      error(...args) { errors.push(args.map((a) => String(a)).join(' ')); },
    },
  };
}

function makeContext() {
  const { console, errors } = makeConsole();
  const sandbox = {
    console,
    // vendor 的两个第三方小库走 window.require 装载；未登记的依赖一律断言失败，
    // 避免「测到替身而不是被测代码」。
    require(name) {
      assert.ok(ALLOWED_VENDOR_REQUIRES.has(name), `禁止加载未登记的依赖：${name}`);
      return repoRequire(name);
    },
  };
  const context = vm.createContext(sandbox);
  vm.runInContext('globalThis.window = globalThis; globalThis.self = globalThis;', context);
  return { context, sandbox, errors };
}

/** 真实 TS 模块 → CJS → 在给定上下文里装载（相对 import 递归解析，缓存按路径去重）。 */
function loadTsModules(context, entryRels) {
  const cache = new Map();
  function load(rel) {
    if (cache.has(rel)) return cache.get(rel);
    const { outputText, diagnostics } = ts.transpileModule(read(rel), {
      fileName: rel,
      reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    assert.equal(diagnostics.length, 0, `${rel} 转译应无诊断`);
    const exports = {};
    cache.set(rel, exports);
    const dir = rel.slice(0, rel.lastIndexOf('/'));
    const run = vm.compileFunction(outputText, ['exports', 'module', 'require'], {
      parsingContext: context,
      filename: rel,
    });
    run(exports, { exports }, (name) => {
      assert.ok(name.startsWith('.'), `${rel} 不得引入非相对依赖：${name}`);
      return load(normalizeRel(`${dir}/${name}.ts`));
    });
    return exports;
  }
  return entryRels.map((rel) => load(rel));
}

/** 归一化相对路径里的 `..`（filterDomain 大量使用 `../store/...`）。 */
function normalizeRel(rel) {
  const out = [];
  for (const part of rel.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

/** 通用模块替身：任何属性都是一次 no-op 调用；`overrides` 里的键覆盖之。 */
function makeStub(overrides = {}) {
  const noop = () => undefined;
  return new Proxy(overrides, {
    get(target, prop) {
      if (Object.prototype.hasOwnProperty.call(target, prop)) return target[prop];
      if (typeof prop === 'symbol') return undefined;
      return noop;
    },
  });
}

/**
 * 装载真实的 `core/filterDomain.ts`。
 * `./rules/matchRuleTable` 由调用方给定（真实表或间谍表），其余依赖走替身。
 */
function loadFilterDomain(context, { getMatchRuleTable, stubs }) {
  const cache = new Map();
  function load(rel) {
    if (cache.has(rel)) return cache.get(rel);
    const { outputText, diagnostics } = ts.transpileModule(read(rel), {
      fileName: rel,
      reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    assert.equal(diagnostics.length, 0, `${rel} 转译应无诊断`);
    const exports = {};
    cache.set(rel, exports);
    const dir = rel.slice(0, rel.lastIndexOf('/'));
    const run = vm.compileFunction(outputText, ['exports', 'module', 'require'], {
      parsingContext: context,
      filename: rel,
    });
    run(exports, { exports }, (name) => {
      assert.ok(name.startsWith('.'), `${rel} 不得引入非相对依赖：${name}`);
      const target = normalizeRel(`${dir}/${name}.ts`);
      if (target === `${RULES_DIR}/matchRuleTable.ts`) return { getMatchRuleTable };
      return stubs[target] || makeStub();
    });
    return exports;
  }
  return load(FILTER_DOMAIN);
}

/** store 替身：保留真实形状，字段可被测试直接驱动。 */
function makeStores() {
  const itemState = { raw: [], smartFolderMappings: {}, folderMappings: {} };
  const miscState = { selectedSmartFolders: [], selectedFolders: [], currentTag: undefined, preelaborations: [] };
  const folderState = { currentSmartFolder: null, currentFolder: null };
  const bodyState = { viewMode: 'all' };
  const cacheWrites = [];
  const stubs = {
    'src/app/react/store/itemState.ts': makeStub({
      useItemState: { getState: () => itemState },
    }),
    'src/app/react/store/miscRawState.ts': makeStub({
      useMiscRawState: { getState: () => miscState },
      writeContentFilterCache: (value) => { cacheWrites.push(value); },
    }),
    'src/app/react/store/folderState.ts': makeStub({
      useFolderState: { getState: () => folderState },
    }),
    'src/app/react/store/bodyState.ts': makeStub({
      useBodyState: { getState: () => bodyState },
    }),
  };
  return { itemState, miscState, folderState, bodyState, cacheWrites, stubs };
}

const IMAGES = {
  a: { name: 'a.jpg', ext: 'jpg', width: 1920, height: 1080, size: 2 * 1024 * 1024, folders: [], tags: [] },
  b: { name: 'b.png', ext: 'png', width: 800, height: 1200, size: 1024, folders: [], tags: [] },
  c: { name: 'c.mp4', ext: 'mp4', width: 640, height: 640, duration: 120, folders: [], tags: [] },
};

/** 单条件单规则的活动智能文件夹 → `existInSmartFilter` 退化为该规则函数的返回值。 */
function smartFolderOf(rule, match = 'AND') {
  return { conditions: [{ boolean: 'TRUE', match, rules: [rule] }] };
}

// ═══════════════════════════ ① 冷启动 ═══════════════════════════

test('M3-2 冷启动：未装载任何 vendor 脚本时，filterDomain 的规则表已可用', async (t) => {
  const { context, sandbox } = makeContext();
  const stor = makeStores();

  // 规则表一侧不用替身：真实模块 + 外层间谍（记录调用，透传返回值）
  const [matchRulesMod, matchRuleTableMod] = loadTsModules(context, [
    `${RULES_DIR}/matchRules.ts`,
    `${RULES_DIR}/matchRuleTable.ts`,
  ]);
  const realTable = matchRuleTableMod.getMatchRuleTable();
  const calls = [];
  const spyTable = {};
  for (const [key, fn] of Object.entries(realTable)) {
    spyTable[key] = (...args) => { calls.push({ key, args }); return fn(...args); };
  }

  const mod = loadFilterDomain(context, { getMatchRuleTable: () => spyTable, stubs: stor.stubs });

  await t.test('冷启动现场成立：window 上没有任何 vendor 规则全局', () => {
    // 这条断言是「冷却态」的定义——没有它，下面的结论可能只是因为 vendor 恰好已注入
    assert.equal(sandbox.isMatchNameRule, undefined, 'window.isMatchNameRule 应缺席');
    assert.equal(sandbox.isMatchFolderNameRule, undefined, 'window.isMatchFolderNameRule 应缺席');
    assert.equal(sandbox.isMatchColorRule, undefined, 'window.isMatchColorRule 应缺席');
    assert.equal(sandbox.isMatchFontActivatedRule, undefined, 'window.isMatchFontActivatedRule 应缺席');
    assert.equal(sandbox.getImagePixelDensity, undefined, 'window.getImagePixelDensity 应缺席');
  });

  await t.test('模块求值完成即可用：26 项全为函数，无需任何异步等待', () => {
    assert.equal(Object.keys(realTable).length, 26, '规则表应恰有 26 项');
    for (const [key, fn] of Object.entries(realTable)) {
      assert.equal(typeof fn, 'function', `getMatchRuleTable().${key} 求值后应已是函数`);
    }
    // 同一份表被 filterDomain 拿到（间谍表键集合一致）
    assert.deepEqual(Object.keys(spyTable).sort(), Object.keys(realTable).sort(), 'filterDomain 拿到的表应与真实表同键');
  });

  await t.test('真跑一次筛选：算出正确结果，且未记录任何「规则表缺席」', () => {
    assert.equal(mod.getMatchRuleTableFailureCount(), 0, '装载完成时不应有任何缺席记录');

    stor.itemState.raw = [IMAGES.a, IMAGES.b];
    stor.miscState.selectedSmartFolders = [smartFolderOf({ property: 'name', method: 'equal', value: 'a.jpg' })];

    const pass = mod.machineryFilterRawPass();
    assert.equal(pass.result.length, 1, '应只命中 a.jpg');
    assert.equal(pass.result[0].name, 'a.jpg');
    assert.equal(pass.trustworthy, true, '正常一轮应被判定为可信');
    assert.equal(stor.cacheWrites.length, 1, '可信结果应写入 contentFilterCache');
    assert.equal(stor.cacheWrites[0].length, 1);
    assert.equal(stor.cacheWrites[0][0].name, 'a.jpg');
    assert.equal(mod.getMatchRuleTableFailureCount(), 0, '全程不应有缺席记录');
  });

  await t.test('调用点确实经由 getMatchRuleTable() 取函数（间谍记到了调用）', () => {
    const keys = calls.map((c) => c.key);
    assert.ok(keys.includes('name'), `调用点应经表取 name 规则，实得 [${keys.join(',')}]`);
    const call = calls.find((c) => c.key === 'name');
    assert.equal(call.args.length, 2, '规则函数应以 (rule, image) 两参调用');
    assert.equal(call.args[0].property, 'name');
    assert.equal(call.args[1].name, 'a.jpg');
  });

  await t.test('zoomHelpers 侧同样是「模块求值即可用」（detailService 的调用点）', () => {
    const { context: ctx2, sandbox: sb2 } = makeContext();
    const [zoomMod] = loadTsModules(ctx2, [`${RULES_DIR}/zoomHelpers.ts`]);
    assert.equal(sb2.getImagePixelDensity, undefined, '同上下文里 window 不应有 getImagePixelDensity');
    assert.equal(sb2.isMobileResolution, undefined, '同上下文里 window 不应有 isMobileResolution');
    assert.equal(sb2.isMobileWidth, undefined, '同上下文里 window 不应有 isMobileWidth');
    assert.equal(zoomMod.getImagePixelDensity({ name: 'a@3x' }), 33.33, '冷启动即可算出像素密度');
    assert.equal(zoomMod.isMobileResolution(375, 667), 667, '冷启动即可算出台面命中值');
    assert.equal(zoomMod.isMobileWidth(375), 375, '冷启动即可算出手机宽度值');
  });
});

// ═══════════════════════════ ② 调用点级等价 ═══════════════════════════

/**
 * 把一次调用压成可比较的结果串（批次 1 的 `outcome` 同款）：
 * 正常返回 → `ret <json>`；抛错 → `throw <Name>: <message>`。
 * 不能直接比原始返回值：部分 (method, value) 组合（字符串方法配非字符串 value，如
 * `isMatchNameRule` 的 `value.toLowerCase`）在**两侧都会抛同一个错** —— 那正是「等价」。
 * 直接比返回值会让测试自身崩掉，而不是把这一组判为等价。
 */
function outcome(fn) {
  try {
    return `ret ${JSON.stringify(fn())}`;
  } catch (e) {
    return `throw ${e && e.name}: ${e && e.message}`;
  }
}

test('M3-2 调用点等价：filterDomain 走表拿到的函数 == vendor 全局同输入同输出', async (t) => {
  const { context, sandbox } = makeContext();
  const stor = makeStores();

  vm.runInContext(read(VENDOR_MATCH), context, { filename: VENDOR_MATCH });
  const [matchRulesMod, matchRuleTableMod] = loadTsModules(context, [
    `${RULES_DIR}/matchRules.ts`,
    `${RULES_DIR}/matchRuleTable.ts`,
  ]);

  const realTable = matchRuleTableMod.getMatchRuleTable();
  const mod = loadFilterDomain(context, { getMatchRuleTable: () => realTable, stubs: stor.stubs });

  // 键 → vendor 全局名：按**函数同一性**从 matchRules 的具名导出里反查，不解析源码文本。
  const nameOfFn = new Map(Object.entries(matchRulesMod).map(([name, fn]) => [fn, name]));
  const vendorNameOf = {};
  for (const [key, fn] of Object.entries(realTable)) vendorNameOf[key] = nameOfFn.get(fn);

  await t.test('26 个键都能反查到 vendor 同名全局', () => {
    assert.equal(Object.keys(vendorNameOf).length, 26);
    for (const [key, vendorName] of Object.entries(vendorNameOf)) {
      assert.ok(vendorName, `${key} 应能反查到 matchRules.ts 的具名导出`);
      assert.equal(typeof sandbox[vendorName], 'function', `vendor 应供给 ${vendorName}`);
    }
  });

  await t.test('26 规则 × (rule, image) 扫描：表内函数 == vendor 全局（同输入同输出，含抛错）', () => {
    const values = [undefined, '', 'a', 'a.jpg', 'jpg', 0, [0, 100], '#FF0000', 'landscape', 'canon'];
    const methods = ['=', 'equal', 'contain', 'startWith', 'endWith', 'empty', 'not-empty', 'between', 'equal', 'activate'];
    let compared = 0;
    const mismatches = [];
    for (const [key, vendorName] of Object.entries(vendorNameOf)) {
      for (const method of methods) {
        for (const value of values) {
          for (const image of Object.values(IMAGES)) {
            const rule = { property: key, method, value };
            // 这一组比的是「调用点从表里取到的那个函数」本身，所以两侧都不该有兜底：
            // 该抛就两侧一起抛（outcome 把 throw 也压成可比串）。
            const viaTable = outcome(() => realTable[key](rule, image));
            const viaVendor = outcome(() => sandbox[vendorName](rule, image));
            compared++;
            if (viaTable !== viaVendor) {
              mismatches.push(`${key}.${method}(${JSON.stringify(value)}) → 表内=${viaTable} vendor=${viaVendor}`);
            }
          }
        }
      }
    }
    assert.ok(compared >= 3000, `扫描应覆盖数千组，实得 ${compared}`);
    assert.deepEqual(mismatches.slice(0, 20), [], `${compared} 组中 ${mismatches.length} 组分叉`);
  });

  await t.test('26 规则 × (rule, image) 扫描：调用链 == vendor（既有 catch → false 兜底保持一致）', () => {
    const values = [undefined, '', 'a', 'a.jpg', 'jpg', 0, [0, 100], '#FF0000', 'landscape', 'canon'];
    const methods = ['=', 'equal', 'contain', 'startWith', 'endWith', 'empty', 'not-empty', 'between', 'equal', 'activate'];
    let compared = 0;
    const mismatches = [];
    for (const [key, vendorName] of Object.entries(vendorNameOf)) {
      for (const method of methods) {
        for (const value of values) {
          for (const image of Object.values(IMAGES)) {
            const rule = { property: key, method, value };
            const viaCallSite = outcome(() => mod.machineryExistInSmartFilter(smartFolderOf(rule), image));
            // machineryExistInSmartFilter 的既有 `catch { return false; }` 是**既有兜底，本批不拆**，
            // 所以调用链侧要把 vendor 的抛错映射成 false 再比 —— 这正是切换前后都成立的那条路径。
            const vendorOutcome = outcome(() => sandbox[vendorName](rule, image));
            const viaVendor = vendorOutcome.startsWith('throw ') ? 'ret false' : vendorOutcome;
            compared++;
            if (viaCallSite !== viaVendor) {
              mismatches.push(`${key}.${method}(${JSON.stringify(value)}) → 调用链=${viaCallSite} vendor=${viaVendor}`);
            }
          }
        }
      }
    }
    assert.ok(compared >= 3000, `扫描应覆盖数千组，实得 ${compared}`);
    assert.deepEqual(mismatches.slice(0, 20), [], `${compared} 组中 ${mismatches.length} 组分叉`);
    assert.equal(mod.getMatchRuleTableFailureCount(), 0, '整轮扫描不应出现规则表缺席');
  });

  await t.test('AND / OR 两种 logic 下结论一致（单规则时两者等价）', () => {
    const rule = { property: 'width', method: '=', value: [1920, 0] };
    for (const match of ['AND', 'OR']) {
      assert.equal(
        mod.machineryExistInSmartFilter(smartFolderOf(rule, match), IMAGES.a),
        sandbox.isMatchWidthRule(rule, IMAGES.a),
        `${match} 下单规则结果应与 vendor 一致`,
      );
    }
  });
});

// ═══════════════════════════ ③ 不得写空快照 ═══════════════════════════

test('M3-2 修复：规则表缺席时不得写空快照（且失败信号可观测）', async (t) => {
  const { context, sandbox, errors } = makeContext();
  const stor = makeStores();
  const [, matchRuleTableMod] = loadTsModules(context, [
    `${RULES_DIR}/matchRules.ts`,
    `${RULES_DIR}/matchRuleTable.ts`,
  ]);
  const realTable = matchRuleTableMod.getMatchRuleTable();
  const mod = loadFilterDomain(context, { getMatchRuleTable: () => realTable, stubs: stor.stubs });

  stor.itemState.raw = [IMAGES.a, IMAGES.b, IMAGES.c];

  await t.test('情形一：有命中 → trustworthy=true 且写缓存', () => {
    stor.cacheWrites.length = 0;
    stor.miscState.selectedSmartFolders = [smartFolderOf({ property: 'name', method: 'equal', value: 'b.png' })];
    const pass = mod.machineryFilterRawPass();
    assert.equal(pass.trustworthy, true);
    assert.equal(pass.result.length, 1);
    assert.equal(stor.cacheWrites.length, 1, '可信结果应写缓存');
    assert.equal(stor.cacheWrites[0][0].name, 'b.png');
  });

  await t.test('情形二：真·空集（规则合法但无匹配）→ trustworthy=true 且**照写** []', () => {
    stor.cacheWrites.length = 0;
    stor.miscState.selectedSmartFolders = [smartFolderOf({ property: 'name', method: 'equal', value: 'zzz-no-such.jpg' })];
    const pass = mod.machineryFilterRawPass();
    assert.equal(pass.result.length, 0, '应筛出空集');
    assert.equal(pass.trustworthy, true, '合法空集必须仍被判为可信 —— 不能把「空」一律当成「算不出来」');
    assert.equal(stor.cacheWrites.length, 1, '合法空集**必须**写缓存（这是与情形三的关键区别）');
    assert.equal(stor.cacheWrites[0].length, 0);
  });

  await t.test('情形三：规则表缺席（property 不在表中）→ trustworthy=false 且**不写**缓存', () => {
    stor.cacheWrites.length = 0;
    const failuresBefore = mod.getMatchRuleTableFailureCount();
    stor.miscState.selectedSmartFolders = [
      smartFolderOf({ property: 'noSuchProperty', method: 'equal', value: 'a.jpg' }),
    ];

    const pass = mod.machineryFilterRawPass();

    assert.equal(pass.trustworthy, false, '规则表缺席时结果必须被判为不可信');
    assert.equal(stor.cacheWrites.length, 0, '结果不可信时**不得写入 contentFilterCache**（本次修复的核心）');
    assert.equal(pass.result.length, 0, '兜底仍在：本轮结果依旧是空集（既有行为不变）');
    assert.equal(
      mod.getMatchRuleTableFailureCount(),
      failuresBefore + 3,
      '三次 raw 筛选各触发一次守卫（失败计数是可靠信号）',
    );
    assert.equal(mod.getLastMatchRuleTableFailure().property, 'noSuchProperty', 'last 记录应带 property 名');
    assert.match(mod.getLastMatchRuleTableFailure().reason, /noSuchProperty/, 'reason 应可读且含 property');
    assert.ok(
      errors.some((e) => e.includes('筛选规则表缺席') && e.includes('noSuchProperty')),
      `失败应留下可观测日志，实得：${JSON.stringify(errors)}`,
    );
  });

  await t.test('失败信号没被上游 catch 吃掉：返回值仍是 false，但计数与记录确实动了', () => {
    const failuresBefore = mod.getMatchRuleTableFailureCount();
    const folder = smartFolderOf({ property: 'stillNoSuchProperty', method: 'equal', value: 'a.jpg' });
    // 异常被 machineryExistInSmartFilter 的 catch 吞掉是**既有兜底**，本批不拆
    const viaExist = mod.machineryExistInSmartFilter(folder, IMAGES.a);
    assert.equal(viaExist, false, '既有兜底行为不变：仍返回 false');
    assert.equal(mod.getMatchRuleTableFailureCount(), failuresBefore + 1, '但计数必须动 —— 否则信号被静默吞掉');
    assert.equal(mod.getLastMatchRuleTableFailure().property, 'stillNoSuchProperty');

    // machineryContentFilter 亦是同一路径：返回 false，计数照动
    const before2 = mod.getMatchRuleTableFailureCount();
    stor.miscState.selectedSmartFolders = [folder];
    assert.equal(mod.machineryContentFilter(IMAGES.a), false, '既有兜底行为不变');
    assert.equal(mod.getMatchRuleTableFailureCount(), before2 + 1, '计数照动');
  });

  await t.test('不自愈性已消除：缺席那一轮不写缓存，下一轮自然重算', () => {
    // 场景：先跑一轮合法的建立缓存，再跑一轮缺规则的（不得覆盖缓存），最后再跑合法的一轮
    stor.cacheWrites.length = 0;
    stor.miscState.selectedSmartFolders = [smartFolderOf({ property: 'name', method: 'equal', value: 'a.jpg' })];
    const good = mod.machineryFilterRawPass();
    assert.equal(good.trustworthy, true);
    assert.equal(good.result.length, 1);
    const buildWrites = stor.cacheWrites.length;
    assert.equal(buildWrites, 1);

    // 缺席轮：缓存写入次数不得变化（旧实现会在这里把 [] 盖上去 → 永不自愈）
    stor.miscState.selectedSmartFolders = [smartFolderOf({ property: 'goneProperty', method: 'equal', value: 'x' })];
    const broken = mod.machineryFilterRawPass();
    assert.equal(broken.trustworthy, false);
    assert.equal(stor.cacheWrites.length, buildWrites, '缺席轮不得写缓存，否则空快照会长期保留');

    // 恢复后重算：结果与第一轮一致（可自愈）
    stor.miscState.selectedSmartFolders = [smartFolderOf({ property: 'name', method: 'equal', value: 'a.jpg' })];
    const recovered = mod.machineryFilterRawPass();
    assert.equal(recovered.trustworthy, true);
    assert.equal(recovered.result.length, 1, '应在下一轮自愈地重算出正确结果');
    assert.equal(recovered.result[0].name, 'a.jpg');
  });

  await t.test('空快照是真值这一前提仍然成立（说明修复针对的确实是持久化而非单次返回）', () => {
    // 修复只动「写不写缓存」，不动「空集返回给调用方」——因为 [] 是真值，
    // 一旦落缓存就会被 filterContent / machineryFilterContent 当命中缓存反复传回。
    assert.ok([], '[] 在 JS 里是真值');
    assert.equal(Boolean([]), true);
    // 在**产品代码实际运行的那个 realm** 里断言（沙箱全局面上没有 JSON 属性，
    // 要经 vm 在该 realm 内求值，不能拿宿主侧的 JSON 冒充）。
    assert.equal(vm.runInContext('JSON.stringify([])', context), '[]');
  });
});

// ═══════════════════ ④ 静态接线检查（弱断言，补 ③ 的行为断言）═══════════════════

test('M3-2 静态接线：调用点已切走 window，且缓存决策确实接在 trustworthy 上', async (t) => {
  await t.test('filterDomain 不再读 window.isMatch*Rule；调用点走 getMatchRuleTable()', () => {
    const code = stripComments(read(FILTER_DOMAIN));
    assert.ok(!/w\.isMatch\w+Rule/.test(code), 'filterDomain 不应再出现 w.isMatch*Rule 读取');
    assert.ok(
      /getMatchFunctionTable\(\)[\s\S]{0,400}?getMatchRuleTable\(\)/.test(code) ||
        /function getMatchFunctionTable[\s\S]*?return getMatchRuleTable\(\);/.test(code),
      'getMatchFunctionTable 应改走 getMatchRuleTable()',
    );
    assert.ok(/from '\.\/rules\/matchRuleTable'/.test(code), 'filterDomain 应从 core/rules/matchRuleTable 静态导入');
  });

  await t.test('缓存决策确实接在 trustworthy 上（防未来把守卫摘掉而 ③ 仍绿）', () => {
    const code = stripComments(read(FILTER_DOMAIN));
    const at = (marker) => {
      const i = code.indexOf(marker);
      assert.ok(i > 0, `应能找到 ${marker}`);
      return i;
    };
    // 定义顺序：machineryFilterRawPass(1325) → machineryCalcuteFilterResult(1343)
    // → machineryFilterContent(1570)
    const passBody = code.slice(at('export function machineryFilterRawPass'), at('export async function machineryCalcuteFilterResult'));
    const calcBody = code.slice(at('export async function machineryCalcuteFilterResult'), at('export function machineryFilterContent'));

    assert.ok(/machineryFilterRawPass\(\)/.test(calcBody), 'machineryCalcuteFilterResult 应调用 machineryFilterRawPass()');
    assert.ok(/const trustworthy = failures === 0;/.test(passBody), '应显式给出可信度判定');
    assert.ok(
      /if\s*\(trustworthy\)\s*\{[\s\S]*?writeContentFilterCache\(/.test(passBody),
      'writeContentFilterCache 应落在 trustworthy 为真的分支内（不可信即不写）',
    );
    assert.ok(
      /else\s*\{[\s\S]*?console\.error\([\s\S]*?跳过 contentFilterCache 写入/.test(passBody),
      '不可信分支应留下可观测日志',
    );
  });

  await t.test('detailService 不再读 window 上的三个缩放助手，改静态导入', () => {
    const code = stripComments(read(DETAIL_SERVICE));
    for (const helper of ['getImagePixelDensity', 'isMobileResolution', 'isMobileWidth']) {
      assert.ok(!new RegExp(`w\\.${helper}\\b`).test(code), `detailService 不应再出现 w.${helper}`);
    }
    assert.ok(
      /import \{[^}]*getImagePixelDensity[^}]*isMobileResolution[^}]*isMobileWidth[^}]*\} from '\.\.\/core\/rules\/zoomHelpers'/.test(code),
      'detailService 应从 core/rules/zoomHelpers 静态导入三个助手',
    );
    // 三个助手仍在同一分支链上被消费（没有把调用整个删掉）
    assert.ok(/getImagePixelDensity\(current\)/.test(code), 'getImagePixelDensity 仍应被调用');
    assert.ok(/isMobileResolution\(current\.width, current\.height\)/.test(code), 'isMobileResolution 仍应被调用');
    assert.ok(/isMobileWidth\(current\.width\)/.test(code), 'isMobileWidth 仍应被调用');
  });

  await t.test('两个 loader 保留未删（仅加注），vendor 文件未被改动', () => {
    const code = read('src/app/react/core/bundleGlobals.ts');
    assert.ok(/fetch\('\/vendor\/eagle-match-rules\.js'\)/.test(code), 'match loader 应保留');
    assert.ok(/fetch\('\/vendor\/eagle-zoom-helpers\.js'\)/.test(code), 'zoom loader 应保留');
    assert.ok(code.includes('已无产品消费者，兼容保留'), '两个 loader 应带退役注记');
    assert.ok(code.includes('退出条件'), '注记应写明退出条件');
    // 第三方段落不得删：zoom vendor 与 match vendor 的文件长度不缩水
    assert.ok(read(VENDOR_ZOOM).length > 2000, 'zoom vendor 应仍在');
    assert.ok(read(VENDOR_MATCH).length > 10000, 'match vendor 应仍在');
  });
});
