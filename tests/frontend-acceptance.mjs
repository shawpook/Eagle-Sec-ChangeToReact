/**
 * R7：统一前端验收入口。
 *
 * 一个命令覆盖报告 §6 验收矩阵的五个面，分阶段执行、逐段留证：
 *
 *   1. `static`     —— 全范围类型检查（0 诊断 + 范围守卫 + @ts-nocheck 台账）、
 *                      框架/架构哨兵（无 Angular 启动、已迁域无 scope/digest 兼容业务）、
 *                      启动层跨模块标识符完整性、scope 字段收敛台账。无 Electron。
 *   2. `build`      —— 正式多页构建（`vite build`）。
 *   3. `artifact`   —— 产物入口/资源检查 + Electron 正式启动冒烟（不依赖 Vite dev）。
 *   4. `regression` —— 关键业务回归：React 全量套件（连续列表、选择/定位、编辑持久化、
 *                      独立窗口与媒体、UI 生命周期）+ 矩阵要求但不在套件内的闭环项
 *                      + 隔离端口后端业务回归（`npm test`：导入导出、库一致性/恢复/迁移）。
 *
 * 口径（对应 R7 工作项 3、4）：
 *   - 失败不隐瞒：某步失败即记 FAIL；因前置失败而无法执行的面记 BLOCKED（**不是**通过）。
 *   - 覆盖面守卫：先校验「必需测试存在且确实被某个命令执行」，防止通过删测试制造绿色。
 *   - 分类登记：静态门禁 / 开发态行为探针 / 产物行为测试分开维护，见 `react-suite-manifest.mjs`
 *     与 `docs/frontend-acceptance-*.md`；源码文本探针单独标注，不当作行为验证。
 *   - 宿主环境问题单列：本机 `fs.cpSync` 缺陷（Node 进程 exit 127 硬崩、无输出）阻断 `npm test`
 *     中的库迁移/备份恢复类用例，故 `backend` 段（`full-regression-isolated`）**默认不执行**，
 *     需显式 `--stages=backend` 或 `--stages=all`；其失败按宿主环境单列，不计入前端验收结论。
 *
 * 用法：
 *   node tests/frontend-acceptance.mjs                     # 前端验收四段（static/build/artifact/regression）
 *   node tests/frontend-acceptance.mjs --stages=static     # 只跑静态门禁
 *   node tests/frontend-acceptance.mjs --stages=all        # 含 backend 段（隔离全量回归）
 *   node tests/frontend-acceptance.mjs --list              # 只打印覆盖面与分类
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REACT_SUITE,
  TEST_CLASSES,
  ARTIFACT_TESTS,
  EXTRA_REGRESSION,
  SOURCE_TEXT_PROBE_SEGMENTS,
  REQUIRED_TESTS,
  classOf,
} from './react-suite-manifest.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCli = process.env.EAGLE_NPM_CLI
  || process.env.npm_execpath
  || path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');

// ── 参数 ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const has = (name) => argv.includes(`--${name}`);
const DEFAULT_STAGES = ['static', 'build', 'artifact', 'regression'];
const STAGES = [...DEFAULT_STAGES, 'backend'];
const requestedRaw = flag('stages', DEFAULT_STAGES.join(','));
const requested = (requestedRaw === 'all' ? STAGES : requestedRaw.split(','))
  .map((s) => s.trim()).filter(Boolean);
const unknown = requested.filter((s) => !STAGES.includes(s));
if (unknown.length > 0) {
  console.error(`未知分段：${unknown.join(', ')}（可选：${STAGES.join(', ')}，或 all）`);
  process.exit(2);
}
const jsonPath = path.resolve(projectRoot, flag('json', '.tmp/r7/acceptance-latest.json'));

// ── 覆盖面守卫（先于执行；防止「删测试得绿色」）────────────────────────────
const suiteSet = new Set(REACT_SUITE);
const artifactSet = new Set(ARTIFACT_TESTS);
const extraSet = new Set(EXTRA_REGRESSION);

/** `npm test` 执行的测试（从 package.json 现读，避免再抄一份清单）。 */
function testsFromNpmTestScript() {
  const scriptsText = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')).scripts?.test || '';
  return [...scriptsText.matchAll(/(tests\/[\w.-]+\.mjs)/g)].map((m) => m[1]);
}
const npmTestSet = new Set(testsFromNpmTestScript());

/** 本入口实际会执行的测试文件。 */
const executedSet = new Set([...suiteSet, ...artifactSet, ...extraSet, ...npmTestSet]);

function coverageReport() {
  const problems = [];
  const allKnown = new Set([...REACT_SUITE, ...ARTIFACT_TESTS, ...EXTRA_REGRESSION, ...Object.keys(TEST_CLASSES)]);
  const missingOnDisk = [...allKnown].filter((t) => !fs.existsSync(path.join(projectRoot, t)));
  for (const t of missingOnDisk) problems.push(`登记但文件不存在：${t}`);
  const unexecuted = REQUIRED_TESTS.filter((t) => !executedSet.has(t));
  for (const t of unexecuted) problems.push(`验收必需项不被任何命令执行：${t}`);
  const undocked = REQUIRED_TESTS.filter((t) => !fs.existsSync(path.join(projectRoot, t)));
  for (const t of undocked) problems.push(`验收必需项文件缺失：${t}`);
  return { problems, missingOnDisk, unexecuted };
}

const coverage = coverageReport();
if (has('list')) {
  const byClass = { static: [], 'dev-probe': [], artifact: [] };
  for (const t of REACT_SUITE) byClass[classOf(t)].push(t);
  console.log(`React 套件 ${REACT_SUITE.length} 项：static ${byClass.static.length} / dev-probe ${byClass['dev-probe'].length}`);
  console.log(`产物行为测试 ${ARTIFACT_TESTS.length} 项：${ARTIFACT_TESTS.join(', ')}`);
  console.log(`套件外关键回归 ${EXTRA_REGRESSION.length} 项：${EXTRA_REGRESSION.join(', ')}`);
  console.log(`npm test 覆盖 ${npmTestSet.size} 项（后端业务链）`);
  console.log(`验收必需项 ${REQUIRED_TESTS.length} 项；源码文本探针 ${Object.keys(SOURCE_TEXT_PROBE_SEGMENTS).length} 处`);
  console.log('分段：');
  const STAGE_NOTES = {
    static: '类型门禁 + 架构哨兵 + shim 边界 + scope 收敛（无 Electron）',
    build: '正式多页构建',
    artifact: '产物入口/资源 + Electron 正式启动冒烟（依赖 build）',
    regression: `React 全量套件 ${REACT_SUITE.length} 项 + 套件外闭环 ${EXTRA_REGRESSION.length} 项`,
    backend: '隔离端口全量回归（宿主相关，默认不执行）',
  };
  for (const s of STAGES) {
    const mark = DEFAULT_STAGES.includes(s) ? '默认' : '选做';
    console.log(`  [${mark}] ${s.padEnd(10)} ${STAGE_NOTES[s]}`);
  }
  console.log(coverage.problems.length === 0
    ? 'COVERAGE_OK：必需项齐备且均被某命令执行'
    : `COVERAGE_FAIL：\n  ${coverage.problems.join('\n  ')}`);
  process.exit(coverage.problems.length === 0 ? 0 : 1);
}
if (coverage.problems.length > 0) {
  console.error('ACCEPTANCE_COVERAGE_FAIL：');
  for (const p of coverage.problems) console.error(`  ${p}`);
  console.error('（覆盖面守卫失败时不执行任何分段——这是「覆盖不足」而非「测试通过」。）');
  process.exit(1);
}

// ── 分段定义 ────────────────────────────────────────────────────────────────
const node = (test) => ({ label: test, cmd: process.execPath, args: [test] });
const npmRun = (script) => ({ label: `npm run ${script}`, cmd: process.execPath, args: [npmCli, 'run', script] });

const STAGE_DEFS = {
  static: {
    title: '静态门禁 / 架构检查（无 Electron）',
    steps: [
      node('tests/typecheck.mjs'),
      node('tests/react-rewrite-sentinel.mjs'),
      node('tests/shim-module-boundaries.mjs'),
      node('tests/scope-field-convergence.mjs'),
    ],
    dependsOn: [],
  },
  build: {
    title: '正式多页构建',
    steps: [npmRun('build')],
    dependsOn: [],
  },
  artifact: {
    title: '正式产物入口/资源 + Electron 正式启动冒烟',
    steps: ARTIFACT_TESTS.map(node),
    dependsOn: ['build'],
  },
  regression: {
    title: '关键业务回归（React 全量套件 + 套件外闭环）',
    steps: [
      node('tests/run-react-suite.mjs'),
      ...EXTRA_REGRESSION.map(node),
    ],
    dependsOn: [],
  },
  // 宿主相关段：默认不执行（见文件头「宿主环境问题单列」）。
  backend: {
    title: '隔离端口全量回归（后端业务链，宿主相关）',
    steps: [node('tests/full-regression-isolated.mjs')],
    dependsOn: [],
  },
};

const results = [];
function runStep(step) {
  const started = Date.now();
  process.stdout.write(`\n▶ ${step.label}\n`);
  const r = spawnSync(step.cmd, step.args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, EAGLE_ACCEPTANCE: '1' },
  });
  const ms = Date.now() - started;
  const status = r.status === 0 ? 'PASS' : `FAIL (exit=${r.status}${r.signal ? `, signal=${r.signal}` : ''})`;
  console.log(`◀ ${step.label} → ${status} [${(ms / 1000).toFixed(1)}s]`);
  return { label: step.label, status, exit: r.status, ms };
}

const startedAt = new Date().toISOString();
const stageStatus = {};
for (const stage of requested) {
  const def = STAGE_DEFS[stage];
  const blockedBy = def.dependsOn.filter((d) => stageStatus[d] && stageStatus[d].status !== 'PASS');
  console.log(`\n${'='.repeat(78)}\n[${stage}] ${def.title}\n${'='.repeat(78)}`);
  if (blockedBy.length > 0) {
    const status = `BLOCKED (前置未通过：${blockedBy.join(', ')})`;
    console.log(`[${stage}] ${status}`);
    stageStatus[stage] = { status, steps: [] };
    results.push({ stage, status, steps: [] });
    continue;
  }
  const stepResults = [];
  let stageFailed = false;
  for (const step of def.steps) {
    const res = runStep(step);
    stepResults.push(res);
    if (res.exit !== 0) { stageFailed = true; break; } // 段内失败即止：后续步骤依赖前一步
  }
  const status = stageFailed ? 'FAIL' : 'PASS';
  stageStatus[stage] = { status, steps: stepResults };
  results.push({ stage, status, steps: stepResults });
}

// ── 汇总 ────────────────────────────────────────────────────────────────────
const failedStages = results.filter((r) => r.status !== 'PASS');
console.log(`\n${'='.repeat(78)}\n前端验收汇总（${startedAt}）\n${'='.repeat(78)}`);
for (const r of results) {
  console.log(`  ${r.status.padEnd(34)} ${r.stage}  ${r.steps.map((s) => `${path.basename(s.label)}=${s.status}`).join(' ')}`);
}
const notRun = DEFAULT_STAGES.filter((s) => !requested.includes(s));
if (notRun.length > 0) console.log(`  未执行分段（本次未请求）：${notRun.join(', ')}`);
if (!requested.includes('backend')) {
  console.log('  backend 段（隔离全量回归）默认不执行：本机 fs.cpSync 宿主缺陷阻断 npm test 的库迁移/备份类用例，');
  console.log('  需显式 `--stages=backend` 或 `--stages=all`；其结果按宿主环境单列，不并入前端验收结论。');
}

fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.writeFileSync(jsonPath, JSON.stringify({
  startedAt, requested, results, coverage: { required: REQUIRED_TESTS.length, suite: REACT_SUITE.length },
}, null, 2));
console.log(`证据 JSON：${path.relative(projectRoot, jsonPath).replace(/\\/g, '/')}`);

if (failedStages.length === 0 && notRun.length === 0) {
  console.log('FRONTEND_ACCEPTANCE_ALL_GREEN');
  process.exit(0);
}
if (failedStages.length === 0) {
  console.log(`FRONTEND_ACCEPTANCE_PARTIAL_OK（未覆盖：${notRun.join(', ')}——不得据此判定整体验收通过）`);
  process.exit(0);
}
console.log(`FRONTEND_ACCEPTANCE_FAILED：${failedStages.map((r) => r.stage).join(', ')}`);
process.exit(1);
