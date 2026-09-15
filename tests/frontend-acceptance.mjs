/**
 * R7 / M0：统一前端验收入口。
 * static（受检范围类型门禁 + 架构守卫 + 隔离单测）、build、artifact、regression 为默认四段。
 * artifact 必须有本次先行通过的 build；单独的产物静态检查不能代表完整验收。
 * backend 保持显式选做；覆盖登记不等于本次已经执行，未执行、失败和阻断分别报告。
 *
 * node tests/frontend-acceptance.mjs
 * node tests/frontend-acceptance.mjs --stages=static
 * node tests/frontend-acceptance.mjs --stages=all
 * node tests/frontend-acceptance.mjs --list
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
import { GATE_UNIT_TEST } from './frontend-gate-manifest.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCli = process.env.EAGLE_NPM_CLI
  || process.env.npm_execpath
  || path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const DEFAULT_STAGES = ['static', 'build', 'artifact', 'regression'];
const STAGES = [...DEFAULT_STAGES, 'backend'];

// 注入步骤执行器，使前置阻断与汇总可在无 build、GUI、真实库的单测中验证。
export function runAcceptanceStages(requested, definitions, runStep) {
  const results = [];
  const stageStatus = {};
  for (const stage of requested) {
    const def = definitions[stage];
    const blockedBy = def.dependsOn.filter((dependency) => stageStatus[dependency]?.status !== 'PASS');
    console.log(`\n${'='.repeat(78)}\n[${stage}] ${def.title}\n${'='.repeat(78)}`);
    if (blockedBy.length > 0) {
      const status = `BLOCKED (前置未执行或未通过：${blockedBy.join(', ')})`;
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
      if (res.exit !== 0) { stageFailed = true; break; }
    }
    const status = stageFailed ? 'FAIL' : 'PASS';
    stageStatus[stage] = { status, steps: stepResults };
    results.push({ stage, status, steps: stepResults });
  }
  return results;
}

export function summarizeAcceptance(requested, results) {
  const failedStages = results.filter((result) => result.status !== 'PASS').map((result) => result.stage);
  const notRun = DEFAULT_STAGES.filter((stage) => !results.some((result) => result.stage === stage));
  const missingResults = requested.filter((stage) => !results.some((result) => result.stage === stage));
  const failed = failedStages.length > 0 || missingResults.length > 0;
  const complete = !failed && notRun.length === 0;
  const conclusion = failed ? 'FRONTEND_ACCEPTANCE_FAILED'
    : complete ? 'FRONTEND_ACCEPTANCE_ALL_GREEN' : 'FRONTEND_ACCEPTANCE_PARTIAL_OK';
  return { failedStages, notRun, missingResults, complete, conclusion, exitCode: failed ? 1 : 0 };
}

export function acceptanceMain(argv = process.argv.slice(2)) {
  const flag = (name, fallback = null) => {
    const hit = argv.find((arg) => arg.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : fallback;
  };
  const has = (name) => argv.includes(`--${name}`);
  const requestedRaw = flag('stages', DEFAULT_STAGES.join(','));
  const requested = [...new Set((requestedRaw === 'all' ? STAGES : requestedRaw.split(','))
    .map((stage) => stage.trim()).filter(Boolean))];
  const unknown = requested.filter((stage) => !STAGES.includes(stage));
  if (unknown.length > 0 || requested.length === 0) {
    console.error(`未知或空分段：${unknown.join(', ')}（可选：${STAGES.join(', ')}，或 all）`);
    return 2;
  }
  const jsonPath = path.resolve(projectRoot, flag('json', '.tmp/r7/acceptance-latest.json'));

  // 覆盖面守卫只证明测试已登记可执行，不宣称本次已全部执行。
  const scriptsText = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')).scripts?.test || '';
  const npmTestSet = new Set([...scriptsText.matchAll(/(tests\/[\w.-]+\.mjs)/g)].map((match) => match[1]));
  const executableSet = new Set([...REACT_SUITE, ...ARTIFACT_TESTS, ...EXTRA_REGRESSION, ...npmTestSet, GATE_UNIT_TEST]);
  const requiredTests = [...REQUIRED_TESTS, GATE_UNIT_TEST];
  const allKnown = new Set([...REACT_SUITE, ...ARTIFACT_TESTS, ...EXTRA_REGRESSION, ...Object.keys(TEST_CLASSES), GATE_UNIT_TEST]);
  const missingOnDisk = [...allKnown].filter((file) => !fs.existsSync(path.join(projectRoot, file)));
  const unexecuted = requiredTests.filter((file) => !executableSet.has(file));
  const undocked = requiredTests.filter((file) => !fs.existsSync(path.join(projectRoot, file)));
  const problems = [
    ...missingOnDisk.map((file) => `登记但文件不存在：${file}`),
    ...unexecuted.map((file) => `验收必需项不被任何命令执行：${file}`),
    ...undocked.map((file) => `验收必需项文件缺失：${file}`),
  ];
  if (has('list')) {
    const byClass = { static: [], 'dev-probe': [], artifact: [] };
    for (const file of REACT_SUITE) byClass[classOf(file)].push(file);
    console.log(`React 套件 ${REACT_SUITE.length} 项：static ${byClass.static.length} / dev-probe ${byClass['dev-probe'].length}`);
    console.log(`M0 隔离门禁单测：${GATE_UNIT_TEST}（接入 static）`);
    console.log(`产物门禁/行为测试 ${ARTIFACT_TESTS.length} 项：${ARTIFACT_TESTS.join(', ')}`);
    console.log(`套件外关键回归 ${EXTRA_REGRESSION.length} 项：${EXTRA_REGRESSION.join(', ')}`);
    console.log(`npm test 登记 ${npmTestSet.size} 项（后端业务链）`);
    console.log(`验收必需项 ${requiredTests.length} 项；源码文本探针 ${Object.keys(SOURCE_TEXT_PROBE_SEGMENTS).length} 处`);
    const notes = {
      static: '受检范围类型门禁 + 隔离单测 + 架构哨兵 + shim 边界 + scope 收敛（无 Electron）',
      build: '正式多页构建',
      artifact: '产物入口/资源 + Electron 正式启动冒烟（依赖本次先行通过的 build；standalone 记 BLOCKED）',
      regression: `React 全量套件 ${REACT_SUITE.length} 项 + 套件外闭环 ${EXTRA_REGRESSION.length} 项`,
      backend: '隔离端口全量回归（宿主相关，默认不执行）',
    };
    for (const stage of STAGES) console.log(`  [${DEFAULT_STAGES.includes(stage) ? '默认' : '选做'}] ${stage.padEnd(10)} ${notes[stage]}`);
    console.log(problems.length === 0
      ? 'COVERAGE_OK：必需项齐备且已登记执行入口；不代表本次已执行'
      : `COVERAGE_FAIL：\n  ${problems.join('\n  ')}`);
    return problems.length === 0 ? 0 : 1;
  }
  if (problems.length > 0) {
    console.error('ACCEPTANCE_COVERAGE_FAIL：');
    for (const problem of problems) console.error(`  ${problem}`);
    console.error('覆盖面守卫失败时不执行任何分段；覆盖不足不是测试通过。');
    return 1;
  }

  const node = (test) => ({ label: test, cmd: process.execPath, args: [test] });
  const npmRun = (script) => ({ label: `npm run ${script}`, cmd: process.execPath, args: [npmCli, 'run', script] });
  const definitions = {
    static: {
      title: '静态门禁 / 架构检查（无 Electron）',
      steps: [
        node(GATE_UNIT_TEST),
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
      steps: [node('tests/run-react-suite.mjs'), ...EXTRA_REGRESSION.map(node)],
      dependsOn: [],
    },
    backend: {
      title: '隔离端口全量回归（后端业务链，宿主相关）',
      steps: [node('tests/full-regression-isolated.mjs')],
      dependsOn: [],
    },
  };
  function runStep(step) {
    const started = Date.now();
    console.log(`\n[执行] ${step.label}`);
    const result = spawnSync(step.cmd, step.args, {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env, EAGLE_ACCEPTANCE: '1' },
    });
    const ms = Date.now() - started;
    const status = result.status === 0 ? 'PASS' : `FAIL (exit=${result.status}${result.signal ? `, signal=${result.signal}` : ''}${result.error ? `, ${result.error.message}` : ''})`;
    console.log(`[结果] ${step.label} → ${status} [${(ms / 1000).toFixed(1)}s]`);
    return { label: step.label, status, exit: result.status, ms };
  }

  const startedAt = new Date().toISOString();
  const results = runAcceptanceStages(requested, definitions, runStep);
  const summary = summarizeAcceptance(requested, results);
  console.log(`\n${'='.repeat(78)}\n前端验收汇总（${startedAt}）\n${'='.repeat(78)}`);
  for (const result of results) console.log(`  ${result.status.padEnd(34)} ${result.stage}  ${result.steps.map((step) => `${path.basename(step.label)}=${step.status}`).join(' ')}`);
  if (summary.notRun.length > 0) console.log(`  未执行分段：${summary.notRun.join(', ')}`);
  if (!requested.includes('backend')) console.log('  backend 未执行（保持显式选做）；本次未验证既有宿主缺陷是否仍存在，也不声称后端通过。');

  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify({
    startedAt, requested, results, ...summary,
    coverage: { required: requiredTests.length, suite: REACT_SUITE.length },
  }, null, 2));
  console.log(`证据 JSON：${path.relative(projectRoot, jsonPath).replace(/\\/g, '/')}`);
  if (summary.complete) console.log(summary.conclusion);
  else if (summary.exitCode === 0) console.log(`${summary.conclusion}（未覆盖：${summary.notRun.join(', ')}——不得据此判定整体验收通过）`);
  else console.log(`${summary.conclusion}：${[...summary.failedStages, ...summary.missingResults].join(', ')}`);
  return summary.exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = acceptanceMain();
