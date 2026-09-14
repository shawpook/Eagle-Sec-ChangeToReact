/**
 * R0：前端类型诊断基线门禁（防倒退）。
 *
 * 语义与 tests/react-rewrite-sentinel.mjs 一致：出现新诊断键、或同一键的条数上升即 FAIL（exit 1）；
 * 条数下降只提示随批更新基线，不阻塞；基线缺失则播种。
 *
 * 诊断键刻意去掉行列号，归一化为 `路径::TSxxxx::消息`。
 * 依据：历史日志对比显示两次检查同为 492 条但 md5 不同，差异全部是行/列偏移
 * （.tmp/continuous-grid-tsc-{before,final,precommit}.log）。带行列号的严格 diff 会把
 * 无关改动的行位移误判为“新增诊断”。
 *
 * 用法：
 *   node tests/typecheck-baseline.mjs            对照基线检查
 *   node tests/typecheck-baseline.mjs --update   重新播种基线（仅在有意消除/新增诊断后使用）
 *
 * 注意：本脚本目前不是“类型验收”。tsc 真实退出码仍为 2（492 条存量诊断）；
 * 最终 0 诊断验收在 R3 完成，届时本脚本改为零容忍。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = path.join(projectRoot, 'tests', 'tsc-baseline.json');
const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
const tscEntry = path.join(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc');
const update = process.argv.includes('--update') || process.argv.includes('--seed');

// `src/app/react/services/gridService.ts(125,5): error TS2554: Expected 1 arguments, but got 0.`
const KEY_RE = /^([^(]+)\(\d+,\d+\): error (TS\d+): (.*)$/;

function readTsconfigScope() {
  const raw = fs.readFileSync(tsconfigPath, 'utf8');
  const config = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, ''));
  return { include: config.include ?? [], exclude: config.exclude ?? [] };
}

function readTypescriptVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(projectRoot, 'node_modules', 'typescript', 'package.json'), 'utf8')).version;
  } catch {
    return 'unknown';
  }
}

function collectDiagnostics() {
  const result = spawnSync(process.execPath, [tscEntry, '--noEmit', '--pretty', 'false', '-p', 'tsconfig.json'], {
    cwd: projectRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const keys = new Map();
  for (const line of output.split(/\r?\n/)) {
    const match = KEY_RE.exec(line);
    if (!match) continue;
    const key = `${match[1]}::${match[2]}::${match[3]}`;
    keys.set(key, (keys.get(key) || 0) + 1);
  }
  return { exitCode: result.status, keys };
}

function loadBaseline() {
  if (!fs.existsSync(baselinePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  } catch (err) {
    console.error(`FAIL 基线文件无法解析：${baselinePath}（${err.message}）`);
    process.exit(1);
  }
}

const scope = readTsconfigScope();
const typescriptVersion = readTypescriptVersion();
const { exitCode, keys } = collectDiagnostics();
const total = [...keys.values()].reduce((sum, n) => sum + n, 0);
const baseline = loadBaseline();

if (!baseline || update) {
  const payload = {
    generated: 'R0',
    typescriptVersion,
    tscExitCode: exitCode,
    include: scope.include,
    exclude: scope.exclude,
    diagnosticCount: total,
    uniqueKeys: keys.size,
    keys: Object.fromEntries([...keys.entries()].sort(([a], [b]) => (a < b ? -1 : 1))),
  };
  fs.writeFileSync(baselinePath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`基线${baseline ? '已更新' : '已播种'}：${path.relative(projectRoot, baselinePath)}`);
  console.log(`tsc 退出码 ${exitCode}；诊断 ${total} 条 / ${keys.size} 个唯一键；TypeScript ${typescriptVersion}`);
  console.log(update ? 'TYPECHECK_BASELINE_UPDATED' : 'TYPECHECK_BASELINE_SEEDED');
  process.exit(0);
}

if (JSON.stringify(baseline.include) !== JSON.stringify(scope.include) ||
    JSON.stringify(baseline.exclude) !== JSON.stringify(scope.exclude)) {
  console.log('SCOPE_CHANGED：tsconfig 检查范围与基线记录不一致（R3 纳入新目录时需要重新播种）。');
  console.log(`  基线 include: ${JSON.stringify(baseline.include)}  exclude: ${JSON.stringify(baseline.exclude)}`);
  console.log(`  当前 include: ${JSON.stringify(scope.include)}  exclude: ${JSON.stringify(scope.exclude)}`);
}

const baseKeys = baseline.keys || {};
const failures = [];
const increases = [];
const decreases = [];

for (const [key, count] of keys) {
  const base = baseKeys[key];
  if (base === undefined) failures.push(`新增诊断：${key}`);
  else if (count > base) { failures.push(`诊断增多 ${base} -> ${count}：${key}`); increases.push(key); }
}

for (const [key, base] of Object.entries(baseKeys)) {
  const count = keys.get(key);
  if (count === undefined) decreases.push(`${base} -> 0：${key}`);
  else if (count < base) decreases.push(`${base} -> ${count}：${key}`);
}

console.log(`tsc 退出码 ${exitCode}（TypeScript ${typescriptVersion}）`);
console.log(`诊断 ${total} 条 / ${keys.size} 个唯一键（基线 ${baseline.diagnosticCount} 条 / ${baseline.uniqueKeys} 个唯一键）`);

if (decreases.length > 0) {
  console.log(`DECREASED ${decreases.length}：基线仍偏大，请在本批提交中运行 \`node tests/typecheck-baseline.mjs --update\` 随批更新。`);
  for (const item of decreases.slice(0, 10)) console.log(`  - ${item}`);
  if (decreases.length > 10) console.log(`  ... 另有 ${decreases.length - 10} 项`);
}

if (failures.length > 0) {
  console.log(`新增/增多 ${failures.length} 项：`);
  for (const item of failures.slice(0, 20)) console.log(`  - ${item}`);
  if (failures.length > 20) console.log(`  ... 另有 ${failures.length - 20} 项`);
  console.log(`TYPECHECK_REGRESSED ${JSON.stringify(failures.slice(0, 20))}`);
  process.exit(1);
}

// 反向断言：R0 修复的缺失导入不得回归。
const REGRESSION_GUARDS = [
  { pattern: /gridService\.ts::TS2304::Cannot find name 'autoscrollChannel'/, label: 'gridService autoscrollChannel 缺失导入' },
];
const guardHits = REGRESSION_GUARDS.filter((guard) => [...keys.keys()].some((key) => guard.pattern.test(key)));
if (guardHits.length > 0) {
  console.log(`TYPECHECK_REGRESSED ${JSON.stringify(guardHits.map((g) => g.label))}`);
  process.exit(1);
}

console.log('TYPECHECK_OK');
process.exit(0);
