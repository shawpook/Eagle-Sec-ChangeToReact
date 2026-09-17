/**
 * R1-4 · `swallowReport.ts` 契约测试（纯 Node + typescript 内存转译，无 Electron、秒级）。
 *
 * 守护的是 R1-4 引入的集中上报通道。这个模块一旦坏，等于「所有被吞的错误重新变得
 * 不可观测」，而且是**静默地**重新不可观测——所以它自己必须有门禁。
 *
 * 覆盖：
 *  1. 转译无诊断、零依赖（require 一律拒绝）——保证可在任意上下文独立装载；
 *  2. 基本上报落到统计与环形缓冲；
 *  3. **限流**：同一 key 前 3 次真上报，第 4 次起只累加计数（防逐帧 catch 打爆日志）；
 *  4. **自身绝不抛错**：日志通道抛错、错误对象循环引用、err 为 undefined，均不得外溢；
 *  5. 跨 realm 的 Error 仍能取到 message（不依赖 instanceof）；
 *  6. `resetSwallowedStats()` 清空、`getSwallowedStats()` 返回副本而非内部引用。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const MODULE_PATH = 'src/app/react/core/swallowReport.ts';

function read(rel) {
  return fs.readFileSync(path.resolve(rel), 'utf8');
}

/**
 * 在隔离 vm 中装载模块；warn 用于捕获真上报，可注入会抛错的日志通道。
 *
 * `overrides` 用来替换沙箱内的全局（如 Map）。这是让「自身绝不抛错」这条性质
 * **真正有牙齿**的关键：emit 与 describe 各自都有内部 try，光让日志通道抛错
 * 根本传不到外层保护——必须在外层保护之外（如 counts.get）注入故障才测得到。
 */
function loadModule({ onWarn, overrides } = {}) {
  const source = read(MODULE_PATH);
  const { outputText, diagnostics } = ts.transpileModule(source, {
    fileName: MODULE_PATH,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  assert.equal(diagnostics.length, 0, `${MODULE_PATH} 转译应无诊断`);

  const warnings = [];
  const warnImpl =
    onWarn ||
    ((line) => {
      warnings.push(line);
    });
  const sandbox = {
    console: { warn: warnImpl, log: () => {}, error: () => {} },
    exports: {},
    Date,
    JSON,
    String,
    Error,
    Map,
    window: { electronLog: { warn: warnImpl } },
    require(name) {
      assert.fail(`${MODULE_PATH} 必须零依赖，禁止 require：${name}`);
    },
    ...(overrides || {}),
  };
  vm.runInNewContext(outputText, sandbox, { filename: MODULE_PATH });
  return { mod: sandbox.exports, warnings, sandbox };
}

test('R1-4 上报通道：转译无诊断且零依赖', () => {
  const { mod } = loadModule();
  assert.equal(typeof mod.reportSwallowed, 'function', '应导出 reportSwallowed');
  assert.equal(typeof mod.getSwallowedStats, 'function', '应导出 getSwallowedStats');
  assert.equal(typeof mod.resetSwallowedStats, 'function', '应导出 resetSwallowedStats');
});

test('R1-4 上报通道：基本上报落到统计与环形缓冲', () => {
  const { mod, warnings } = loadModule();
  mod.resetSwallowedStats();
  mod.reportSwallowed('demo.key', new Error('boom'));

  const stats = mod.getSwallowedStats();
  assert.equal(stats.total, 1, '总次数应为 1');
  assert.equal(stats.reported, 1, '应真上报 1 次');
  assert.equal(stats.records.length, 1);
  assert.equal(stats.records[0].key, 'demo.key');
  assert.match(stats.records[0].message, /boom/, '应保留错误 message');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /\[swallowed\] demo\.key: boom/);
});

test('R1-4 上报通道：同一 key 超过 3 次后只计数不再刷日志（限流）', () => {
  const { mod, warnings } = loadModule();
  mod.resetSwallowedStats();
  for (let i = 0; i < 10; i += 1) mod.reportSwallowed('hot.key', new Error(`e${i}`));

  assert.equal(warnings.length, 3, '同一 key 最多真上报 3 次，防止日志洪水');
  const stats = mod.getSwallowedStats();
  assert.equal(stats.total, 10, '但总次数必须完整累加，不能丢观测');
  assert.equal(stats.records[0].count, 10);
});

test('R1-4 上报通道：不同 key 各自独立限流', () => {
  const { mod, warnings } = loadModule();
  mod.resetSwallowedStats();
  mod.reportSwallowed('a', 'x');
  mod.reportSwallowed('b', 'y');
  mod.reportSwallowed('a', 'x');
  assert.equal(warnings.length, 3, 'a 两次、b 一次，均在上限内');
  assert.equal(mod.getSwallowedStats().total, 3);
});

test('R1-4 上报通道：日志通道自身抛错也不得外溢', () => {
  const { mod } = loadModule({
    onWarn() {
      throw new Error('日志通道炸了');
    },
  });
  mod.resetSwallowedStats();
  // 若 reportSwallowed 未兜住，这里会抛
  assert.doesNotThrow(() => mod.reportSwallowed('boom.key', new Error('x')));
  // 且统计仍然正确——上报失败不能带走观测数据
  assert.equal(mod.getSwallowedStats().total, 1);
});

test('R1-4 上报通道：怪异错误对象与缺失 err 均不得抛错', () => {
  const { mod } = loadModule();
  mod.resetSwallowedStats();
  assert.doesNotThrow(() => mod.reportSwallowed('no.err'));
  assert.doesNotThrow(() => mod.reportSwallowed('undefined.err', undefined));
  assert.doesNotThrow(() => mod.reportSwallowed('null.err', null));
  assert.doesNotThrow(() => mod.reportSwallowed('number.err', 42));
  const cyclic = { name: 'cyclic' };
  cyclic.self = cyclic;
  assert.doesNotThrow(() => mod.reportSwallowed('cyclic.err', cyclic));
  assert.doesNotThrow(() => mod.reportSwallowed('plain.err', { a: 1 }));
  assert.equal(mod.getSwallowedStats().total, 6, '六次调用都应被计入');
});

test('R1-4 上报通道：跨 realm 错误对象仍能取到 message（不依赖 instanceof）', () => {
  const { mod, warnings } = loadModule();
  mod.resetSwallowedStats();
  // 宿主 realm 的 Error 传进 vm 沙箱：沙箱内 `err instanceof Error` 为 false。
  // 若实现只依赖 instanceof，message 会退化成 "Error: boom"（少了语义），这里要求精确取到。
  const hostError = new Error('cross-realm-boom');
  mod.reportSwallowed('cross.realm', hostError);
  const stats = mod.getSwallowedStats();
  assert.equal(stats.records[0].message, 'cross-realm-boom');
  assert.match(warnings[0], /cross-realm-boom/);
});

test('R1-4 上报通道：reset 清空、getSwallowedStats 返回副本', () => {
  const { mod } = loadModule();
  mod.reportSwallowed('k1', 'x');
  mod.resetSwallowedStats();
  assert.equal(mod.getSwallowedStats().total, 0, 'reset 后应清零');
  assert.equal(mod.getSwallowedStats().records.length, 0);

  mod.reportSwallowed('k2', 'y');
  const first = mod.getSwallowedStats();
  first.records[0].count = 999;
  assert.equal(mod.getSwallowedStats().records[0].count, 1, '返回副本，外部改写不得污染内部状态');
});

test('R1-4 上报通道：内部存储故障时仍不得外溢（外层保护必须有牙齿）', () => {
  // 注入一个会抛错的 Map：故障点在 emit / describe 的内部 try **之外**，
  // 只有 reportSwallowed 自己的外层 try 能兜住。
  // 若哪天有人删掉那层 try，这个用例必须变红。
  class HostileMap {
    get() {
      throw new Error('存储层炸了');
    }
    set() {
      throw new Error('存储层炸了');
    }
    clear() {
      throw new Error('存储层炸了');
    }
    forEach() {
      throw new Error('存储层炸了');
    }
  }
  const { mod } = loadModule({ overrides: { Map: HostileMap } });
  assert.doesNotThrow(
    () => mod.reportSwallowed('hostile.key', new Error('x')),
    '内部存储故障不得外溢——上报绝不能反过来搞挂业务'
  );
  // 连查询也不能炸
  assert.doesNotThrow(() => mod.getSwallowedStats());
  assert.doesNotThrow(() => mod.resetSwallowedStats());
});

test('R1-4 上报通道：挂载到 globalThis 供遗留层守卫式调用', () => {
  const { sandbox } = loadModule();
  assert.equal(
    typeof sandbox.__eagleReportSwallowed,
    'function',
    '遗留 src/app/js/** 非 ESM，只能经全局守卫式调用'
  );
});

test('R1-4 上报通道：环形缓冲有上限，不得无限增长', () => {
  const { mod } = loadModule();
  mod.resetSwallowedStats();
  for (let i = 0; i < 500; i += 1) mod.reportSwallowed(`key.${i}`, 'x');
  const stats = mod.getSwallowedStats();
  assert.ok(stats.records.length <= 100, `环形缓冲应 ≤100，实际 ${stats.records.length}`);
  assert.equal(stats.total, 500, '总次数不受缓冲上限影响');
});
