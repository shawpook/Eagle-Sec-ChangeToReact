/**
 * R1-4 · 空 catch 棘轮门禁（纯 Node + typescript AST，无 Electron、秒级）。
 *
 * 背景：验收报告 R1-4 指出生产代码有数百处空 `catch`，其中一部分会让
 * 「操作实际失败、界面却毫无反应」。一次性清理几百处不现实，真正可持久的是
 * **不再新增**：本门禁做一把棘轮——
 *
 *   - 存量：登记在 `tests/fixtures/empty-catch-baseline.json`（按文件记录"未标注数量"上限）；
 *   - 新增：任何**未带 `@swallow:` 理由标记**的空 catch，只要超过该文件基线数量即判红；
 *   - 允许减少：存量被修掉后基线只会更宽松，棘轮不会倒转。
 *
 * 为什么是"按文件计数"而不是"逐条列举"：行号会随日常编辑漂移，逐条列举会产生
 * 大量与语义无关的基线 churn，最终导致没人维护而整体失效。
 *
 * 三条自保断言（防止门禁自己变成摆设）：
 *   1. 扫描结果不得异常偏少——若扫描器坏了返回 0，门禁必须红而不是"空洞地绿"；
 *   2. 基线文件必须存在且非空；
 *   3. 上报通道 `swallowReport.ts` 必须存在且零依赖（它是 R1-4 的 remediate 手段）。
 *
 * 用法：
 *   node --test tests/empty-catch-gate.mjs
 *   node tests/empty-catch-gate.mjs --update-baseline   # 重新生成基线（需人工复核 diff）
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { scan } from './empty-catch-scanner.mjs';

const BASELINE_PATH = 'tests/fixtures/empty-catch-baseline.json';
const REPORT_MODULE = 'src/app/react/core/swallowReport.ts';

/** 扫描结果少于这个数，判定为扫描器失效而非"真的清零了" */
const MIN_PLAUSIBLE_TOTAL = 300;

function loadBaseline() {
  const raw = fs.readFileSync(path.resolve(BASELINE_PATH), 'utf8');
  const parsed = JSON.parse(raw);
  assert.ok(parsed && typeof parsed === 'object', '基线必须是对象');
  assert.ok(parsed.files && typeof parsed.files === 'object', '基线缺少 files 字段');
  return parsed;
}

function currentSnapshot() {
  const { files, scannedFiles, total } = scan({ excludeTests: true });
  const byFile = new Map();
  for (const r of files) {
    const unmarked = r.items.filter((i) => !i.marked).length;
    byFile.set(r.rel, {
      total: r.items.length,
      marked: r.items.length - unmarked,
      unmarked,
      items: r.items,
    });
  }
  return { byFile, scannedFiles, total };
}

test('R1-4 棘轮门禁：扫描器结果不得异常偏少（防门禁空洞变绿）', () => {
  const { total, scannedFiles } = currentSnapshot();
  assert.ok(scannedFiles > 100, `受检文件数异常偏少（${scannedFiles}），扫描器可能失效`);
  assert.ok(
    total >= MIN_PLAUSIBLE_TOTAL,
    `空 catch 总数 ${total} 低于下限 ${MIN_PLAUSIBLE_TOTAL}——` +
      `若真的一次性清理到了这个量级，请同步下调下限并更新基线；否则说明扫描器坏了`
  );
});

test('R1-4 棘轮门禁：基线文件存在且可用', () => {
  const baseline = loadBaseline();
  assert.ok(Object.keys(baseline.files).length > 0, '基线不得为空');
  assert.ok(baseline.generatedAt, '基线应记录生成时间');
});

test('R1-4 棘轮门禁：未标注的空 catch 不得超过该文件基线（存量不增、新增必标注）', () => {
  const baseline = loadBaseline();
  const { byFile } = currentSnapshot();
  const violations = [];

  for (const [rel, info] of byFile) {
    const allowed = baseline.files[rel];
    if (allowed === undefined) {
      // 新文件：全部必须带 @swallow 标记
      if (info.unmarked > 0) {
        violations.push(
          `${rel}：新文件含 ${info.unmarked} 处未标注的空 catch（必须全部带 @swallow: 理由）`
        );
      }
      continue;
    }
    if (info.unmarked > allowed) {
      violations.push(
        `${rel}：未标注空 catch ${info.unmarked} 处，基线允许 ${allowed} 处` +
          `（新增 ${info.unmarked - allowed} 处未说明理由）`
      );
    }
  }

  assert.equal(
    violations.length,
    0,
    `以下文件新增了未说明理由的空 catch：\n  - ${violations.join('\n  - ')}\n` +
      `处理办法二选一：① 给它加 /* @swallow: 具体理由 */ 注释；② 改为上报 ` +
      `reportSwallowed('模块.函数.动作', err)。\n` +
      `确属一次性批量清理后需要收紧基线时，跑 node tests/empty-catch-gate.mjs --update-baseline。`
  );
});

test('R1-4 棘轮门禁：上报通道存在且零依赖', () => {
  const source = fs.readFileSync(path.resolve(REPORT_MODULE), 'utf8');
  assert.ok(source.length > 0, '上报通道不应为空');
  const imports = source.match(/^\s*import\s.+$/gm) || [];
  assert.equal(
    imports.length,
    0,
    `swallowReport.ts 必须零依赖（要在 renderer/worker/vm 任一上下文独立装载），发现：\n${imports.join('\n')}`
  );
  assert.match(source, /export function reportSwallowed/, '应导出 reportSwallowed');
});

// 基线的生成不放在本文件里：门禁文件应当是纯判据，且 `--update-baseline` 这类维护动作
// 一旦混进来，会在更新基线时顺带跑一遍测试并报红，语义混乱。
// 生成器见 outputs/update-empty-catch-baseline.mjs（一次性维护脚本，不进套件）。
