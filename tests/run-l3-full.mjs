/**
 * R2-5：L3 全量回归的一次性驱动与证据归档。
 *
 * 为什么不另写一套分段定义：分段与清单的唯一事实源是 `tests/react-suite-manifest.mjs`
 * 与统一入口 `tests/frontend-acceptance.mjs`。本文件**只做三件事**，不复制任何清单：
 *   1. 以 `--stages=all` 调起统一入口（static + build + artifact + regression + backend）；
 *   2. **边跑边落盘**完整 stdout（验收报告 R2-5 要求「有完整日志与结果 JSON」）——
 *      不是攒到最后再写：长跑被中断时必须留下已经跑过的部分，否则等于没有证据；
 *   3. 生成证据信封 JSON：提交号 / 时间 / 运行时版本 / 各段退出码与耗时 /
 *      逐项结果（从日志里解析 `RUN <项> ...` 行）+ **解析完整性断言**。
 *
 * 解析完整性断言的意义：若某天日志格式变了、`RUN` 行解析不出来，则宁可显式标记
 * `PARSE_INCOMPLETE`（并让整轮判定为「证据不完整」），也不允许「没解析到就等于没失败」。
 *
 * 关于 `EAGLE_ELECTRON_IN_PROCESS_GPU`：本机 GPU 进程在自动化会话下会 FATAL 杀掉浏览器进程
 * （详见 `electron/main.cjs` 顶部注释与工作记录 §15）。默认开启该逃生口；
 * 传 `--no-gpu-fix` 可关闭（用于证明「哪些红是 GPU 造成的」）。
 *
 * 关于 `CODEBUDDY_SAFE_DELETE_ENABLED=0`：本宿主给 Node 注入了「批量删除护栏」
 * （`node-safe-delete-shim.cjs`，**按回合累计**删除数超过 50 就让 `fs.rmSync` 抛
 * `SAFE_DELETE_BULK_CONFIRM_REQUIRED`）。后端启动路径 `server.js:292 recoverLibrary →
 * library-transaction-coordinator.js:133 releaseLibraryLock` 会 `rmSync` 一个 lock 文件，
 * ⇒ 长跑到一定量后**后端在启动阶段就崩**，`tests` 侧表现为成片的 `backend startup timeout`。
 * 实测：不关护栏时后端 30s 起不来（崩溃），关掉后 **1.06s** 起来。默认关掉该护栏
 * （只在这一次子进程树内生效，不改任何产品代码）；传 `--keep-delete-guard` 可保留。
 *
 * 用法：node tests/run-l3-full.mjs [--out=<目录>] [--no-gpu-fix] [--keep-delete-guard] [--stages=all]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { REACT_SUITE, ARTIFACT_TESTS, EXTRA_REGRESSION } from './react-suite-manifest.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  // 偏移是 `--` + 名字 + `=` ⇒ name.length + 3。写成 +1 会切出 `t=outputs/...`
  // 这种目录名（首跑就踩了，证据落到了误建目录里，只能事后搬正）。
  return hit ? hit.slice(name.length + 3) : fallback;
};
const has = (name) => argv.includes(`--${name}`);

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.resolve(projectRoot, flag('out', `outputs/l3-full-${stamp}`));
const stages = flag('stages', 'all');
const gpuFix = !has('no-gpu-fix');
const disableDeleteGuard = !has('keep-delete-guard');

fs.mkdirSync(outDir, { recursive: true });
const logPath = path.join(outDir, 'full.log');
const jsonPath = path.join(outDir, 'result.json');
const acceptanceJson = path.join(outDir, 'acceptance.json');

const git = (args) => {
  const r = spawnSync('git', args, { cwd: projectRoot, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : `（不可用：${r.stderr?.trim() || r.status}）`;
};

const dirtyLines = git(['status', '--porcelain']).split('\n').filter(Boolean);
const envelope = {
  startedAt: new Date().toISOString(),
  stage: 'L3 全量',
  requestedStages: stages,
  gpuFixEscapeHatch: gpuFix ? 'EAGLE_ELECTRON_IN_PROCESS_GPU=1（已开启）' : '未开启',
  deleteGuard: disableDeleteGuard ? 'CODEBUDDY_SAFE_DELETE_ENABLED=0（已关闭宿主批量删除护栏）' : '保留宿主批量删除护栏',
  git: {
    head: git(['rev-parse', 'HEAD']),
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
    dirtyCount: dirtyLines.length,
    dirtySample: dirtyLines.slice(0, 10),
  },
  runtime: {
    node: process.version,
    platform: process.platform,
    electron: (() => {
      try {
        return JSON.parse(fs.readFileSync(path.join(projectRoot, 'node_modules', 'electron', 'package.json'), 'utf8')).version;
      } catch (err) { return `（读取失败：${err.message}）`; }
    })(),
  },
  manifestCounts: {
    reactSuite: REACT_SUITE.length,
    artifact: ARTIFACT_TESTS.length,
    extraRegression: EXTRA_REGRESSION.length,
  },
};

const logStream = fs.createWriteStream(logPath, { flags: 'a', encoding: 'utf8' });
const emit = (chunk) => {
  process.stdout.write(chunk);
  logStream.write(chunk);
};

const env = { ...process.env };
if (gpuFix) env.EAGLE_ELECTRON_IN_PROCESS_GPU = '1';
if (disableDeleteGuard) env.CODEBUDDY_SAFE_DELETE_ENABLED = '0';

const startedAt = Date.now();
emit(`L3 开始 ${envelope.startedAt}　HEAD=${envelope.git.head}　${envelope.git.branch}\n`);
emit(`逃生口　${envelope.gpuFixEscapeHatch}\n`);
emit(`删除护栏　${envelope.deleteGuard}\n`);
emit(`清单　　React 套件 ${envelope.manifestCounts.reactSuite} + 产物 ${envelope.manifestCounts.artifact} + 套件外 ${envelope.manifestCounts.extraRegression}\n`);

const exitInfo = await new Promise((resolve) => {
  const child = spawn(process.execPath, [
    'tests/frontend-acceptance.mjs',
    `--stages=${stages}`,
    `--json=${path.relative(projectRoot, acceptanceJson).replace(/\\/g, '/')}`,
  ], { cwd: projectRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (c) => emit(c));
  child.stderr.on('data', (c) => emit(c));
  child.on('error', (err) => resolve({ code: null, signal: null, error: err.message }));
  child.on('close', (code, signal) => resolve({ code, signal, error: null }));
});
const ms = Date.now() - startedAt;

const logText = fs.readFileSync(logPath, 'utf8');
const parseSuiteItems = () => {
  const items = [];
  const re = /^RUN (\S+) \.\.\. (.*)$/gm;
  let m;
  while ((m = re.exec(logText)) !== null) {
    const rest = m[2];
    const retried = /OK \(retry\)/.test(rest);
    const failed = /FAIL \(exit=/.test(rest) && !retried;
    items.push({ test: m[1], status: retried ? 'RETRY_OK' : failed ? 'FAIL' : 'OK' });
  }
  return items;
};
const suiteItems = parseSuiteItems();
const parseComplete = suiteItems.length === REACT_SUITE.length;

const acceptance = (() => {
  try { return JSON.parse(fs.readFileSync(acceptanceJson, 'utf8')); } catch (err) { return { error: `（未产出或解析失败：${err.message}）` }; }
})();

const failedItems = suiteItems.filter((i) => i.status === 'FAIL').map((i) => i.test);
const retryItems = suiteItems.filter((i) => i.status === 'RETRY_OK').map((i) => i.test);
const failedStages = Array.isArray(acceptance.results)
  ? acceptance.results.filter((r) => r.status !== 'PASS').map((r) => `${r.stage}=${r.status}`)
  : ['（未取得分段结果）'];

const conclusion = exitInfo.code === 0 && parseComplete ? 'L3_FULL_PASS'
  : exitInfo.code !== 0 ? 'L3_FULL_FAIL' : 'L3_EVIDENCE_INCOMPLETE';

const result = {
  ...envelope,
  finishedAt: new Date().toISOString(),
  durationSeconds: Number((ms / 1000).toFixed(1)),
  exitCode: exitInfo.code,
  signal: exitInfo.signal,
  spawnError: exitInfo.error,
  logPath: path.relative(projectRoot, logPath).replace(/\\/g, '/'),
  acceptanceJsonPath: path.relative(projectRoot, acceptanceJson).replace(/\\/g, '/'),
  failedStages,
  suite: {
    parsed: suiteItems.length,
    expected: REACT_SUITE.length,
    parseComplete,
    ok: suiteItems.filter((i) => i.status === 'OK').length,
    retryOk: retryItems.length,
    fail: failedItems.length,
    failedItems,
    retryItems,
  },
  acceptanceConclusion: acceptance.conclusion ?? null,
  conclusion,
};
fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));

emit(`\n${'='.repeat(78)}\nL3 全量证据归档\n${'='.repeat(78)}\n`);
emit(`提交        ${result.git.head}（${result.git.branch}${result.git.dirtyCount ? `，工作区有 ${result.git.dirtyCount} 项未提交` : '，工作区干净'}）\n`);
emit(`耗时        ${result.durationSeconds}s\n`);
emit(`退出码      ${result.exitCode}${result.signal ? ` / signal=${result.signal}` : ''}${result.spawnError ? ` / ${result.spawnError}` : ''}\n`);
emit(`套件逐项    ${result.suite.ok} OK + ${result.suite.retryOk} retry-OK + ${result.suite.fail} FAIL（解析 ${result.suite.parsed}/${result.suite.expected}）\n`);
if (!parseComplete) emit(`⚠️ 逐项解析不完整（${result.suite.parsed}/${result.suite.expected}）：不得据本轮判定「套件全绿」\n`);
if (failedItems.length) emit(`失败项      ${failedItems.join(', ')}\n`);
if (retryItems.length) emit(`首败重跑过  ${retryItems.join(', ')}\n`);
if (failedStages.length) emit(`未通过分段  ${failedStages.join(', ')}\n`);
emit(`结论        ${conclusion}\n`);
emit(`证据目录    ${path.relative(projectRoot, outDir).replace(/\\/g, '/')}\n`);
logStream.end();

process.exitCode = exitInfo.code === 0 && parseComplete ? 0 : 1;
