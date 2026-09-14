/**
 * R3 类型门禁：**零容忍**（取代 R0 的「基线 diff」）。
 *
 * R0–R2 期存量为 492 条诊断，故当时以「基线 + 防倒退」形式接入；R3 已将检查范围内
 * 诊断清零（492 → 0），因此门禁升级为「出现任何一条即失败」。
 *
 * 同时断言**检查范围**（scope guard）：`include` 必须覆盖主应用与
 * `frontend/document-viewer`，`exclude` 不得把 `frontend` 整体排除——防止后续
 * 通过缩小范围来「清零」。
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
const REQUIRED_INCLUDE = ['src/app/react/**/*.ts', 'src/app/react/**/*.tsx', 'frontend/document-viewer/src/**/*.ts'];
const missing = REQUIRED_INCLUDE.filter((entry) => !include.includes(entry));
if (missing.length > 0) {
  console.error('TYPECHECK_SCOPE_ERROR: tsconfig.include 缺少必需范围（不得缩小检查面）：');
  for (const entry of missing) console.error(`  - ${entry}`);
  process.exit(1);
}
if (exclude.some((entry) => entry === 'frontend' || entry === 'frontend/')) {
  console.error('TYPECHECK_SCOPE_ERROR: tsconfig.exclude 不得整体排除 frontend（document-viewer 必须在检查范围内）');
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

console.log('TYPECHECK_OK: 0 诊断（范围 = src/app/react + frontend/document-viewer）');
