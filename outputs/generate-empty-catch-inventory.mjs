/**
 * R1-4 一次性：生成《空 catch 清单》文档。
 *
 * 定位：一次性文档生成脚本（放 outputs/，不进 tests/）。
 * 数据来自 `tests/empty-catch-scanner.mjs`（单一事实源），保证可复现。
 *
 * 用法：node outputs/generate-empty-catch-inventory.mjs [outFile]
 */
import fs from 'node:fs';

import { scan } from '../tests/empty-catch-scanner.mjs';

const OUT = process.argv[2] || 'docs/r1-4-empty-catch-inventory.md';

const { files, scannedFiles, total, diagFiles } = scan({ excludeTests: true });

/**
 * 人工分流结论（本会话逐条看过 try 块内容后得出，写死在此以保证文档可复现）。
 * 未列出的文件走 `defaultByRisk`。
 */
const ADJUDICATION = [
  {
    match: /^src\/app\/react\/core\/fileUrlHelper\.ts$/,
    disposition: '已上报',
    reason:
      'URL 计算失败会返回空串 → 图片/缩略图加载失败且无任何提示。本模块历史上已真实发生过此类事故（URL_MODULE 绑定消失被吞），本次 6 处全部改为 reportSwallowed。',
  },
  {
    match: /^src\/app\/react\/core\/ipcHelper\.ts$/,
    disposition: '已上报',
    reason: 'IPC 发送失败被完全吞掉，表现为「点了没反应」且无线索。本次 2 处改为 reportSwallowed。',
  },
  {
    match: /^src\/app\/react\/components\/stage7\/PluginCenter\.tsx$/,
    disposition: '已上报',
    reason: 'openPluginById 失败被吞 → 用户点「安装/打开插件」毫无反应。本次 2 处改为 reportSwallowed。',
  },
  {
    match: /^src\/app\/react\/components\/inspector\/Inspector\.tsx$/,
    disposition: '部分已上报',
    reason:
      '格式插件 webview 的 plugin-create / plugin-run 发送失败被吞 → 插件面板永远空白，本次已上报该处；其余为 UI 装饰与可选读取。',
  },
  {
    match: /^src\/app\/react\/core\/hoverPreview\.ts$/,
    disposition: '注明理由（不加观测）',
    reason:
      '全部为 video/iframe 的 pause、src 复位、容器移除等资源释放动作，失败无用户可见影响；且位于悬停预览的高频路径上，加观测得不偿失。',
  },
  {
    match: /^src\/app\/react\/services\/folderMenuService\.ts$/,
    disposition: '注明理由（不加观测）',
    reason: '命中项为日志打点、classList 装饰、以及文件夹遍历中的单条目兜底，失败均不改变数据。',
  },
  {
    match: /^src\/app\/react\/core\/bundleGlobals\.ts$/,
    disposition: '注明理由（不加观测）',
    reason: 'bundle 全局能力探测，失败有后备路径，属设计内的可选能力降级。',
  },
  {
    match: /^src\/app\/react\/(core\/filterDomain|core\/tagManagerDomain|components\/grid\/boxItem|components\/stage7\/QuickSearchModal)\./,
    disposition: '注明理由（不加观测）',
    reason: '读取 fontMetas / rawMetas / palettes / tagMappings 等可选元数据，缺失只影响展示的一项，不影响主流程。',
  },
  {
    match: /^src\/app\/react\/components\/stage7\//,
    disposition: '注明理由（不加观测）',
    reason: '以 el.click() 等 UI 触发与样式装饰为主，元素可能已卸载，触发不到不算业务失败。',
  },
  {
    match: /^scripts\//,
    disposition: '注明理由（不加观测）',
    reason: '开发/运维脚本（清端口、启动生产），不在产品运行路径上，失败由脚本自身退出码体现。',
  },
  {
    match: /^src\/app\/gif-viewer\//,
    disposition: '注明理由（不加观测）',
    reason: 'GIF 逐帧绘制循环内的兜底，逐帧上报会造成日志洪水，且单帧失败无用户可感知后果。',
  },
  {
    match: /^src\/app\/js\/workers\//,
    disposition: '注明理由（不加观测）',
    reason: '解码 worker 内的可选步骤（HEIF/TIF 方向信息处理等），失败退化为不处理该特性。',
  },
  {
    match: /^src\/app\/js\/global\.js$/,
    disposition: '待接线（遗留层）',
    reason:
      '与 fileUrlHelper 同族：路径/URL 计算失败静默返回空串，会让图片加载失败且无提示。属遗留全局脚本层（非 ESM，无法 import React 侧模块），需经 globalThis 守卫式调用，列为后续。',
  },
  {
    match: /^src\/app\/js\/plugin\//,
    disposition: '待接线（遗留层）',
    reason:
      'localStorage 写入插件 pinned 状态失败被吞 → 用户固定插件后重启即丢；读取 metadata.json 失败被吞 → 资料库状态静默错误。同属遗留层，列为后续。',
  },
  {
    match: /^src\/my_modules\/raw-parser\//,
    disposition: '待接线（遗留层）',
    reason: 'RAW 解码读取失败静默 → 用户看到空白预览而无任何提示。列为后续。',
  },
  {
    match: /^src\/app\/react\/(services\/imageOpsService|services\/itemMenuService|core\/libraryDomain|preferences\/controller|store\/)/,
    disposition: '待逐项裁决',
    reason:
      '散落着若干「用户操作后无反应」的吞错（如打开方式列表为空、IPC 广播失败、偏好项写入），也混着可选读取。需逐处确认是否有后备路径后再决定上报或注明，列为后续。',
  },
];

const DEFAULT_BY_RISK = {
  high: {
    disposition: '待逐项裁决',
    reason: '规则判定为高风险且未标注，尚未逐处人工确认，登记在案待处理。',
  },
  low: {
    disposition: '注明理由（不加观测）',
    reason: '规则判定为低风险（清理/日志/UI 装饰/可选读取/纯解析），失败不改变业务结果。',
  },
};

function adjudicate(rel, risk) {
  for (const a of ADJUDICATION) {
    if (a.match.test(rel)) return a;
  }
  return DEFAULT_BY_RISK[risk];
}

const all = files.flatMap((f) => f.items.map((i) => ({ ...i, file: f.rel })));
const highUnmarked = all
  .filter((i) => i.risk === 'high' && !i.marked)
  .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

const byCat = {};
for (const i of all) byCat[i.cat] = (byCat[i.cat] || 0) + 1;

// 已接线的点位（本次实际改代码加了 reportSwallowed 的）
const WIRED = [
  ['src/app/react/core/fileUrlHelper.ts', '6 处', 'FileUrlHelper 六个 URL/路径 getter'],
  ['src/app/react/core/ipcHelper.ts', '2 处', 'IPCHelper.send / sendTo'],
  ['src/app/react/components/stage7/PluginCenter.tsx', '2 处', 'openPluginById（安装 / 打开详情）'],
  ['src/app/react/components/inspector/Inspector.tsx', '1 处', '格式插件 webview plugin-create / plugin-run'],
];

const lines = [];
const p = (s = '') => lines.push(s);

p('# R1-4 · 空 catch 清单与分类');
p();
p('> 验收报告原文：*「对 680 处 `catch (err) { /* 注释 */ }` 做分类（顶层兜底 / 真实吞错），');
p('> 把『吞错且影响业务结果』的挑出来加观测」*，验收标准：**形成清单，逐条要么上报要么注明理由**。');
p();
p(`本文由 \`outputs/generate-empty-catch-inventory.mjs\` 生成，数据源 \`tests/empty-catch-scanner.mjs\`，`);
p(`生成时间 ${new Date().toISOString()}。改动代码后重跑该脚本即可刷新。`);
p();

p('## 1. 结论摘要');
p();
p('| 项 | 值 |');
p('|---|---|');
p(`| 受检文件数 | ${scannedFiles} |`);
p(`| 空 catch 总数（生产代码） | **${total}** |`);
p(`| 高风险（规则判定会改变业务结果） | ${all.filter((i) => i.risk === 'high').length} |`);
p(`| 低风险（清理/日志/UI/可选读取/纯解析） | ${all.filter((i) => i.risk === 'low').length} |`);
p(`| 高风险且未标注理由 | ${highUnmarked.length} |`);
p(`| 本次已改为上报 | 11 处（4 个文件） |`);
p(`| 解析告警文件数 | ${diagFiles} |`);
p();
p('**与验收报告「680 处」的差异**：报告的数字未区分第一方与 vendored。本仓把依赖直接提交了');
p('（`src/node_modules` 8000+ 文件入库，`src/app/js/vendors`、`pdf-viewer`、`model-viewer/libs`、');
p('`dcraw`/`libheif` 均为第三方），排除后第一方生产代码为 **' + total + ' 处**——量级一致，口径更严。');
p();

p('## 2. 扫描口径');
p();
p('- **范围**：`src/app`、`src/my_modules`、`src/i18n`、`electron`、`frontend`、`backend`、`scripts`、`plugins`，**排除 `tests/`**。');
p('- **排除的 vendored**：`node_modules/`、`pdf-viewer/`、`model-viewer/libs/`、`vendors/`、`workers/libheif.js`、');
p('  `raw-parser/dcraw.js`、`dist/`、`third_party/`、`*.min.js`。');
p('- **方法**：TypeScript parser 走 AST（`CatchClause` 且 `block.statements.length === 0`），');
p('  **不用正则**——正则在嵌套花括号、字符串与模板串里必然误判。');
p('- **判据落在 try 块内容上，不落在 catch 的注释上**：注释可能写错，try 块在保护什么不会。');
p();

p('## 3. 分类规则');
p();
p('| 分类 | 风险 | 判据（看 try 块） |');
p('|---|---|---|');
p('| A0-空try块 | 低 | 剥掉注释后什么都不做 |');
p('| A8-控制流跳出 | 低 | `throw BreakException` 之类故意抛异常跳出 |');
p('| A2-清理释放 | 低 | clearTimeout / removeListener / reset / pause / dispose / unlink 等 |');
p('| A1-日志遥测 | 低 | 仅打日志且无副作用 |');
p('| A6-UI触发/样式 | 低 | `el.click()` / classList / style |');
p('| A9-可选元数据读取 | 低 | fontMetas / rawMetas / palettes / tagMappings |');
p('| A10-排序比较 | 低 | localeCompare / sort |');
p('| A3-能力探测 | 低 | typeof / in / tryGet 等有后备的探测 |');
p('| A4-纯解析/格式化 | 低 | JSON.parse / Number / new Date 等 |');
p('| A5-无特征但有注释说明 | 低 | 无规则命中，但已有注释说明理由 |');
p('| **B1-写操作/IO** | **高** | fs / localStorage.setItem / exec 等 |');
p('| **B2-网络/IPC/数据库** | **高** | fetch / ipcRenderer / postMessage / executeJavaScript |');
p('| **B3-业务返回值** | **高** | try 内有 `return`（失败会返回 undefined/空串） |');
p('| **B4-状态写入** | **高** | setState / store / emit |');
p('| **B5-无特征且无说明** | **高** | 无规则命中且无注释——最可疑，需人工看 |');
p();
p('> 规则修过两轮：初版把 `pause()`/`removeListener()` 判成高风险、把日志文案里含 "rename"');
p('> 三个字母的判成写操作。抽样复核后修正——**分类器的作用是分流，不是终审**。');
p();

p('## 4. 分类结果分布');
p();
p('| 分类 | 数量 |');
p('|---|---|');
for (const [k, v] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
  p(`| ${k} | ${v} |`);
}
p();

p('## 5. 本次已改为上报的点位');
p();
p('上报通道：`src/app/react/core/swallowReport.ts`（零依赖、自身永不抛错、同 key 前 3 次真上报后只计数，');
p('防止逐帧 catch 打爆日志）。');
p();
p('| 文件 | 处数 | 说明 |');
p('|---|---|---|');
for (const [f, n, d] of WIRED) p(`| \`${f}\` | ${n} | ${d} |`);
p();
p('其中最关键的是 `fileUrlHelper.ts`——该模块注释里就记录了一起由空 catch 造成的真实故障：');
p();
p('> URL_MODULE 绑定消失 → 裸引用抛 ReferenceError → **被下方各 try/catch 吞掉** →');
p('> 所有 raw/thumbnail URL 静默变空串 → 详情原图无 URL → smoothZoom 不装载 → 交付闸门永不释放。');
p();

p(`## 6. 高风险且未标注的逐条处置（${highUnmarked.length} 条）`);
p();
p('> 分流结论来自本会话逐条查看 try 块实际内容，非规则自动生成。');
p('> 「待接线 / 待逐项裁决」表示**尚未**满足「上报」要求，已如实登记，不伪装成已完成。');
p();

let lastFile = '';
let groupReason = null;
for (const i of highUnmarked) {
  if (i.file !== lastFile) {
    lastFile = i.file;
    groupReason = adjudicate(i.file, i.risk);
    p();
    p(`### \`${i.file}\`（本文件 ${all.filter((x) => x.file === i.file).length} 处空 catch）`);
    p();
    p(`- **处置**：${groupReason.disposition}`);
    p(`- **理由**：${groupReason.reason}`);
    p();
    p('| 行 | 分类 | 上下文 | try 块在保护什么 |');
    p('|---|---|---|---|');
  }
  const cell = (s) => String(s).replace(/\|/g, '\\|').slice(0, 150);
  p(`| ${i.line} | ${i.cat} | \`${cell(i.context)}\` | \`${cell(i.tryText || '(空 try)')}\` |`);
}
p();

p('## 7. 全量按文件清单');
p();
p('| 文件 | 空 catch | 高风险 | 低风险 | 已标注 | 处置 |');
p('|---|---|---|---|---|---|');
for (const f of [...files].sort((a, b) => b.items.length - a.items.length || a.rel.localeCompare(b.rel))) {
  const hi = f.items.filter((i) => i.risk === 'high').length;
  const lo = f.items.length - hi;
  const mk = f.items.filter((i) => i.marked).length;
  const d = adjudicate(f.rel, hi > 0 ? 'high' : 'low');
  p(
    `| \`${f.rel}\` | ${f.items.length} | ${hi} | ${lo} | ${mk} | ${d.disposition} |`
  );
}
p();

p('## 8. 棘轮门禁（防止继续新增）');
p();
p('一次性清理数百处不现实，可持久的是**不再新增**：');
p();
p('- 门禁：`tests/empty-catch-gate.mjs`（已登记进套件，`static` 分类）；');
p('- 基线：`tests/fixtures/empty-catch-baseline.json`，按文件记录**未标注**空 catch 的数量上限；');
p('- 规则：新增的空 catch 若未写 `/* @swallow: 具体理由 */`，超过该文件基线即判红；');
p('  存量被修掉后基线只会更宽松，棘轮不倒转；');
p('- 自保：扫描器若失效导致数量异常偏少，门禁判**红**而不是空洞变绿；');
p('- 变异自证：注入未标注空 catch → 红；加 `@swallow` 标记 → 绿。');
p();
p('新增空 catch 时二选一：');
p();
p('```ts');
p("try { ... } catch (err) { /* @swallow: 具体理由——为什么失败无需处理 */ }");
p('// 或');
p("try { ... } catch (err) { reportSwallowed('模块.函数.动作', err); }");
p('```');
p();

p('## 9. 已知局限');
p();
p('1. **遗留层未接线**：`src/app/js/**` 是非 ESM 全局脚本，无法 import React 侧模块；');
p('   上报通道已挂 `globalThis.__eagleReportSwallowed`，但遗留层调用点尚未改，列为本清单「待接线」。');
p('2. **规则是启发式**：分类用于分流，不是终审。A/B 误判仍可能存在，');
p('   「待逐项裁决」的部分需要结合具体调用点确认是否有后备路径。');
p('3. **只查空 catch**：`catch { console.log(err) }` 这类「打了日志但没处理」不在本次范围内。');
p(`4. **测试代码未纳入**：\`tests/\` 另有 100+ 处空 catch，多为 teardown 兜底，未纳入本清单与门禁。`);
p();

fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
process.stdout.write(`清单已写入 ${OUT}（${lines.length} 行）\n`);
