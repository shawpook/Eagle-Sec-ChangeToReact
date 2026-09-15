/**
 * R3 类型门禁：**零容忍**（取代 R0 的「基线 diff」）。
 *
 * R0–R2 期存量为 492 条诊断，故当时以「基线 + 防倒退」形式接入；R3 已将检查范围内
 * 诊断清零（492 → 0），因此门禁升级为「出现任何一条即失败」。
 *
 * 同时断言**检查范围**（scope guard）：`include` 必须覆盖 `src/app/react`（R5 起文档查看器
 * 亦在其内：frontend/document-viewer → src/app/react/viewers/document），`exclude` 不得排除
 * `frontend` 或 `src/app/react/viewers/document`——防止后续通过缩小范围来「清零」。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const tsconfigPath = path.join(projectRoot, 'tsconfig.json');

// ── 范围守卫 ────────────────────────────────────────────────────────────────
const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
const include = (tsconfig.include || []).map(String);
const exclude = (tsconfig.exclude || []).map(String);
const REQUIRED_INCLUDE = ['src/app/react/**/*.ts', 'src/app/react/**/*.tsx'];
const missing = REQUIRED_INCLUDE.filter((entry) => !include.includes(entry));
if (missing.length > 0) {
  console.error('TYPECHECK_SCOPE_ERROR: tsconfig.include 缺少必需范围（不得缩小检查面）：');
  for (const entry of missing) console.error(`  - ${entry}`);
  process.exit(1);
}
// R5：文档查看器由 frontend/document-viewer 迁入 src/app/react/viewers/document —— 原独立
// include 条目（frontend/document-viewer/src/**）已并入 src/app/react/** 两个 glob，故 REQ 清单
// 随之收敛；「不得把它排除在检查面外」的意图保留并**加强**：同时禁止排除 frontend 与新的
// viewers/document 路径。
const FORBIDDEN_EXCLUDE = ['frontend', 'frontend/', 'src/app/react/viewers/document', 'src/app/react/viewers/document/'];
const badExclude = exclude.find((entry) => FORBIDDEN_EXCLUDE.includes(entry));
if (badExclude) {
  console.error(`TYPECHECK_SCOPE_ERROR: tsconfig.exclude 不得排除 ${badExclude}（文档查看器必须在检查范围内）`);
  process.exit(1);
}

// ── @ts-nocheck 面守卫 ──────────────────────────────────────────────────────
// 零容忍门禁有一个漏洞：`// @ts-nocheck` 能让任意文件整体退出检查，且 tsc 不会报。
// 故把仍带 @ts-nocheck 的文件**显式登记**（R3 的撤销进度台账），并双向校验：
// 未登记的文件新加 nocheck → 失败；已登记的文件撤销后未从台账移除（僵尸项）→ 失败。
// 台账只允许单向缩短。
const NOCHECK_LEDGER = [
  // ── core/shim/*：R2 整段搬移的启动层（各模块已由 shim-module-boundaries 精确守卫）──
  'src/app/react/core/shim/browserRuntime.ts',
  'src/app/react/core/shim/demoSeed.ts',
  'src/app/react/core/shim/desktopCapability.ts',
  'src/app/react/core/shim/environment.ts',
  'src/app/react/core/shim/install.ts',
  'src/app/react/core/shim/ipcBus.ts',
  'src/app/react/core/shim/moduleRegistry.ts',
  'src/app/react/core/shim/settingsI18n.ts',
];

function collectNoCheckFiles() {
  const found = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      const text = fs.readFileSync(full, 'utf8');
      // 只认文件头注释区（前 40 行）的 @ts-nocheck——TS 亦只认首个注释块。
      const head = text.split('\n').slice(0, 40).join('\n');
      if (/^\s*\/\/\s*@ts-nocheck\s*$/m.test(head)) {
        found.push(path.relative(projectRoot, full).replace(/\\/g, '/'));
      }
    }
  })(path.join(projectRoot, 'src/app/react'));
  return found.sort();
}

const noCheckFiles = collectNoCheckFiles();
const ledgerSet = new Set(NOCHECK_LEDGER);
const unlisted = noCheckFiles.filter((f) => !ledgerSet.has(f));
const stale = NOCHECK_LEDGER.filter((f) => !noCheckFiles.includes(f));
if (unlisted.length > 0 || stale.length > 0) {
  console.error('TYPECHECK_NOCHECK_ERROR: @ts-nocheck 台账与实际不符（台账只允许单向缩短）');
  for (const f of unlisted) console.error(`  未登记却带 @ts-nocheck：${f}`);
  for (const f of stale) console.error(`  已撤销却仍在台账（请移除）：${f}`);
  process.exit(1);
}

// ── 类型检查 ────────────────────────────────────────────────────────────────
const result = spawnSync(
  process.execPath,
  [path.join('node_modules', 'typescript', 'bin', 'tsc'), '--noEmit', '--pretty', 'false', '-p', 'tsconfig.json'],
  { cwd: projectRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);
const output = `${result.stdout || ''}${result.stderr || ''}`;
const diagnostics = output.split(/\r?\n/).filter((line) => /: error TS\d+:/.test(line));

if (diagnostics.length > 0) {
  console.error(`TYPECHECK_FAILED: ${diagnostics.length} 条诊断（要求 0 条）`);
  for (const line of diagnostics.slice(0, 40)) console.error(`  ${line}`);
  if (diagnostics.length > 40) console.error(`  ... 共 ${diagnostics.length} 条`);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`TYPECHECK_FAILED: tsc 退出码 ${result.status}`);
  console.error(output.slice(0, 4000));
  process.exit(1);
}

console.log(
  `TYPECHECK_OK: 0 诊断（范围 = src/app/react，含 viewers/document 文档查看器）；`
  + `@ts-nocheck 台账 ${NOCHECK_LEDGER.length} 个文件（待撤销 ${NOCHECK_LEDGER.filter((f) => !f.includes('/shim/')).length}）`,
);
