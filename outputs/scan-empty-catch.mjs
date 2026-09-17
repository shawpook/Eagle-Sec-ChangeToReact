/**
 * R1-4 一次性诊断：统计"空 catch"（catch 块体不含任何语句，可含注释）并生成清单数据。
 *
 * 定位：一次性诊断脚本，**不是门禁**。按 §6 定下的规矩放在 outputs/，不进 tests/。
 * 扫描与分类的实现在 `tests/empty-catch-scanner.mjs`（单一事实源），本文件只是 CLI 外壳，
 * 避免诊断脚本与门禁各写一份而漂移。
 *
 * 用法：
 *   node outputs/scan-empty-catch.mjs --json <outFile> [--exclude-tests]
 */

import fs from 'node:fs';
import { scan } from '../tests/empty-catch-scanner.mjs';

const excludeTests = process.argv.includes('--exclude-tests');
const { files, scannedFiles, total, diagFiles } = scan({ excludeTests });

const byDir = {};
const byCat = {};
const byCatProd = {};
const prodCount = files
  .filter((r) => !r.rel.startsWith('tests/'))
  .reduce((s, r) => s + r.items.length, 0);
const testCount = total - prodCount;

for (const r of files) {
  const top = r.rel.split('/').slice(0, 2).join('/');
  byDir[top] = (byDir[top] || 0) + r.items.length;
  for (const i of r.items) {
    byCat[i.cat] = (byCat[i.cat] || 0) + 1;
    if (!r.rel.startsWith('tests/')) byCatProd[i.cat] = (byCatProd[i.cat] || 0) + 1;
  }
}

const summary = {
  scannedFiles,
  filesWithEmptyCatch: files.length,
  totalEmptyCatch: total,
  prodEmptyCatch: prodCount,
  testEmptyCatch: testCount,
  parseDiagFiles: diagFiles,
  byCat: Object.fromEntries(Object.entries(byCat).sort((a, b) => b[1] - a[1])),
  byCatProd: Object.fromEntries(Object.entries(byCatProd).sort((a, b) => b[1] - a[1])),
  byDir: Object.fromEntries(Object.entries(byDir).sort((a, b) => b[1] - a[1])),
  topFiles: files
    .slice()
    .sort((a, b) => b.items.length - a.items.length)
    .slice(0, 25)
    .map((r) => ({ file: r.rel, count: r.items.length })),
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

const jsonIdx = process.argv.indexOf('--json');
if (jsonIdx !== -1 && process.argv[jsonIdx + 1]) {
  fs.writeFileSync(
    process.argv[jsonIdx + 1],
    JSON.stringify({ summary, files }, null, 2),
    'utf8'
  );
  process.stdout.write(`明细已写入 ${process.argv[jsonIdx + 1]}\n`);
}
