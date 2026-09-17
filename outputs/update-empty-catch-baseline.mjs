/**
 * R1-4 一次性维护脚本：重新生成空 catch 棘轮门禁的基线。
 *
 * 定位：维护工具，**不是门禁也不进套件**（按 §6 的规矩放 outputs/）。
 * 门禁文件 `tests/empty-catch-gate.mjs` 只做判据，不兼职 CLI——
 * 否则更新基线时会顺带跑一遍测试并报红，语义混乱。
 *
 * 用法：node outputs/update-empty-catch-baseline.mjs
 *
 * 注意：生成后**必须人工复核 diff**。基线是"允许存在的未标注空 catch 数量"，
 * 无脑重跑会把新引入的吞错也一并洗白。
 */
import fs from 'node:fs';
import path from 'node:path';

import { scan } from '../tests/empty-catch-scanner.mjs';

const BASELINE_PATH = 'tests/fixtures/empty-catch-baseline.json';

const { files, scannedFiles, total } = scan({ excludeTests: true });

const byFile = {};
let totalUnmarked = 0;
for (const r of [...files].sort((a, b) => a.rel.localeCompare(b.rel))) {
  const unmarked = r.items.filter((i) => !i.marked).length;
  byFile[r.rel] = unmarked;
  totalUnmarked += unmarked;
}

const payload = {
  generatedAt: new Date().toISOString(),
  scope: '生产代码（排除 tests/ 与 vendored 第三方）',
  rule: '按文件记录【未带 @swallow 标记】的空 catch 数量上限；新增未标注者判红',
  scannedFiles,
  totalEmptyCatch: total,
  totalUnmarked,
  files: byFile,
};

fs.writeFileSync(path.resolve(BASELINE_PATH), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

process.stdout.write(
  `基线已写入 ${BASELINE_PATH}\n` +
    `  受检文件 ${scannedFiles}\n` +
    `  空 catch 合计 ${total}\n` +
    `  未标注（受基线约束）${totalUnmarked}\n` +
    `  已带 @swallow 标记 ${total - totalUnmarked}\n` +
    `\n请人工复核 diff：基线变松只应来自"存量被修掉"，不应来自新增吞错。\n`
);
