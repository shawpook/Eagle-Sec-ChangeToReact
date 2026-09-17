/**
 * b1-9ba：彻底化哨兵 —— Angular-ism / jQuery 胶水的单调递减门 + 死频道/死供应商
 * 复活哨兵（REWRITE-PLAN v2 阶段推进的回归护栏）。
 *
 * - metrics：src/app/react 内 Angular 语义调用点计数，对照
 *   tests/react-rewrite-sentinel-baseline.json —— 任何计数**超过基线即 FAIL**
 *   （防止倒退）；低于基线提示更新（竖切推进的正常结果，随批提交新基线）。
 * - dead channels：b1-9ba 处置的 5 条无接收广播 + 4 条无发送监听，禁止以
 *   broadcast/on 形式复活（注释提及不算）。
 * - vendor：index.html 禁止重新引入已退役供应商脚本；vendor script 标签计数
 *   入基线单调递减。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reactRoot = path.join(projectRoot, 'src', 'app', 'react');
const indexHtmlPath = path.join(projectRoot, 'src', 'app', 'index.html');
const baselinePath = path.join(projectRoot, 'tests', 'react-rewrite-sentinel-baseline.json');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(reactRoot).filter((f) => /\.(ts|tsx)$/.test(f));
const contents = files.map((f) => ({ file: f, text: fs.readFileSync(f, 'utf8') }));

// b1-9bz-E1c：Angular-ism 度量改为**注释感知**——只统计活代码。
// 实测原 raw 计数被注释严重灌水（如 watch 19 中 18 条是注释/文档），既掩盖真实面、
// 又使 DoD ②「计数归零」不可达。规则与 cForbidden 一致：整行以 // 、* 或 /* 开头即视为注释行。
// （不解析正则字面量，避免误判；行尾注释不计入，属已知上界。）
for (const entry of contents) {
  entry.code = entry.text
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join('\n');
}

// 死频道复活检查忽略行注释（'//' 之后的内容），块注释仍计入（块注释复活语义罕见）。
function hasLiveMatch(re) {
  for (const { text } of contents) {
    for (const line of text.split('\n')) {
      const m = line.match(re);
      if (m && line.slice(0, m.index).indexOf('//') === -1) return true;
    }
  }
  return false;
}

// b1-9bz-E0：度量校正——原正则只认 `$x(`，漏掉可选链 `$x?.(` 形态（实测 19 处
// `.$evalAsync?.()` + 1 处 `$watchCollection?.(` 长期不计入），是去 scope 面的盲区。
// 统一放宽为 `$x\s*(?.\\s*)?\(`；新增 scopeEvalAsync（357 处，E 阶段要清的主要包装）。
const metrics = {
  evalAsync: /\$evalAsync\s*(?:\?\.\s*)?\(/g,
  apply: /\$apply\s*(?:\?\.\s*)?\(/g,
  watch: /\$watch\s*(?:\?\.\s*)?\(/g,
  watchCollection: /\$watchCollection\s*(?:\?\.\s*)?\(/g,
  broadcast: /\$broadcast\s*(?:\?\.\s*)?\(/g,
  on: /\$on\s*(?:\?\.\s*)?\(/g,
  scopeApply: /\bscopeApply\(/g,
  scopeEvalAsync: /\bscopeEvalAsync\(/g,
  callScope: /\bcallScope\(/g,
  getBodyScope: /\bgetBodyScope\(/g,
  jQuery: /\bjQuery\(/g,
  rootAccess: /\$root\./g,
  coreState: /\bcoreState\b/g,
  // b1-9bc：lodash 退役度量——window 绑定调用 + 裸 _.method 调用（注释命中计入，
  // 基线为确定性上界；新注释勿用 _.method 形态措辞）
  lodashWindow: /(?:\bw|window|\(window as any\))\._\./g,
  // b1-9bj 补盲区：裸 lodash 绑定（const _ = w._ / w._; ）——bc 时 `!_` 守卫因 lodash
  // 卸载而静默失效的教训（无方法调用形态，lodashWindow/lodashBare 均不命中）
  lodashBind: /(?:\bw|window|\(window as any\))\._\s*(?:[;=,)\r\n]|$)/g,
  lodashBare: /(^|[^\w$.'"])_\.[a-z][a-zA-Z0-9]*\b/g,
};

// b1-9ba 处置面（PROGRESS b1-9ba 节）：禁止复活。
// 注：OPEN_NOTIFICATION / REFRESH_PLUGIN_CENTER 应用侧发送面虽死，但 7c/7d5b 契约
// 锁定监听——不入本清单；UPDATE_BOX_SCROLLBAR 本为注释不入。
const deadSenders = ['MOVE_TO_FOLDER', 'OPEN_IMAGE_FILTER', 'OPEN_LIBRARY_PANEL', 'RESET_PAGE', 'Update_Tags_Filter'];
const deadReceivers = ['INSPECTOR_SAVE_CHANGES', 'PLUGIN_UNINSTALL', 'UPDATE_PLUGIN_PANEL'];
const retiredVendorTags = ['jquery-long-click.js', 'jquery.bez.js'];

// 需求面移除（帮助菜单「隐私权政策 / Eagle API / Twitter - @eagle_app」三项按需求整体摘除）：
// 菜单项、store 槽位、图标、i18n 键四面一并不再存在，禁止复活。
// 为什么需要哨兵：本仓返工的主因是「照原 bundle 逐字复刻」——后续任何批次重移植该菜单，
// 这三个符号与两张图标会被静默带回来（旧 bundle 里它们就在 55323-55347，是最容易被抄回的形态）。
// 注：ic-developer.svg 不在清单内，它仍被插件面板与偏好设定「开发者」页使用。
const removedHelpMenuSurfaces = ['openPrivacy', 'openAPIDocument', 'openTwitter', 'ic-privacy\\.svg', 'ic-twitter\\.svg'];

const failures = [];
const decreases = [];

const counts = {};
for (const [name, re] of Object.entries(metrics)) {
  let n = 0;
  for (const { code } of contents) n += (code.match(re) || []).length;
  counts[name] = n;
}

const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
counts.vendorScriptTags = (indexHtml.match(/<script src="js\/vendors\//g) || []).length;

let baseline = null;
if (fs.existsSync(baselinePath)) {
  baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
}

console.log('=== Angular-ism / glue counts (src/app/react) ===');
for (const [name, n] of Object.entries(counts)) {
  const base = baseline ? baseline.counts[name] : null;
  const mark = base === null || base === undefined ? 'SEED' : n > base ? 'REGRESSED' : n < base ? 'decreased' : 'flat';
  console.log(`${String(n).padStart(5)}  (base ${String(base).padStart(5)})  ${mark.padStart(9)}  ${name}`);
  if (mark === 'REGRESSED') failures.push(`metric ${name}: ${n} > baseline ${base}`);
  if (mark === 'decreased') decreases.push(`${name}: ${base} -> ${n}`);
}

for (const ch of deadSenders) {
  const re = new RegExp(`broadcast\\(['"]${ch}['"]`);
  if (hasLiveMatch(re)) failures.push(`dead sender resurrected: ${ch}`);
}
for (const ch of deadReceivers) {
  const re = new RegExp(`\\$on\\(['"]${ch}['"]`);
  if (hasLiveMatch(re)) failures.push(`dead receiver resurrected: ${ch}`);
}
for (const tag of retiredVendorTags) {
  // 只认 script 标签形态——允许注释提及文件名。
  if (indexHtml.includes(`src="js/vendors/${tag}"`)) failures.push(`retired vendor script present in index.html: ${tag}`);
}
for (const surface of removedHelpMenuSurfaces) {
  // 注释行由 hasLiveMatch 自行排除（迁移说明必然要写出被删的名字）。
  if (hasLiveMatch(new RegExp(`\\b${surface}\\b`))) failures.push(`removed help-menu surface resurrected: ${surface}`);
}

// ── b1-9bz-C 永久禁项：全仓 scope 面 digest / 事件调用清零 ──
// C-2 把 $broadcast/$on 迁到 eagleBus，C-3 把 $evalAsync/$apply 改名为 scopeEvalAsync，
// C-4 把 $watch/$watchCollection 改为各域自建轮询。此后全仓不得再出现任何
// `X.$xxx()` 形态的调用。
// R5：**豁免面已全部撤除**（原 scopedOut：viewers / global/scopeShim.ts / preview-window /
// collect-window / preferences）——逐目录核实后确认：
//   · preferences：controllerScope 为普通对象，tippy/ShortcutManager 两处 classic script 已退役；
//   · collect-window：classic 侧仅剩 window.eagle 数据面，React 侧零 scope 面调用；
//   · preview-window：仅 2 处 `scope.$on('$destroy')` **注释**（哨兵按行跳过注释）；
//   · viewers：零命中；
//   · `global/scopeShim.ts` 该路径**已不存在**（早已随 E 批删除），原正则恒不匹配。
// 即 C-6 自此对全仓生效——这一项由「例外清单」变成「无例外」，是 R5 的收尾判据之一。
const cForbidden = [
  ['scope 面 $evalAsync', /\.\$evalAsync\s*\(/],
  ['scope 面 $apply', /\.\$apply\s*\(/],
  ['scope 面 $watch', /\.\$watch\s*\(/],
  ['scope 面 $watchCollection', /\.\$watchCollection\s*\(/],
  ['scope 面 $broadcast', /\.\$broadcast\s*\(/],
  ['scope 面 $on', /\.\$on\s*\(/],
];
// 已知遗留（行级白名单，均需后续批次处置）：
// 1) b1-9bz-E1b 已删 appCore.scopeApply 内部的 $apply 与 shim 的 $apply —— 原白名单项 1 移除，
//    主窗口 `.$apply(` 计数现为 0；
// 2) gridDirectives 的 scope.$on('$destroy') —— Angular 生命周期残留，无发送方（E1c 处置）；
// 3) FilterItemShell / Sidebar 的**动态事件名** $on（eventName / autoFocusEvent 变量），
//    非静态频道，无法用 defineChannel 迁移（E1c 处置）。
const cAllowed = [
  /\$on\('\$\w+',/,                    // 2（'$destroy' 等 Angular 内部事件名）
  /\$on\(\s*(eventName|autoFocusEvent)\b/, // 3
];
for (const [label, re] of cForbidden) {
  for (const { file, text } of contents) {
    for (const line of text.split('\n')) {
      const m = line.match(re);
      if (!m) continue;
      const trimmed = line.trim();
      // 块注释行（JSDoc）与行注释后的内容均不计入
      if (trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
      if (line.slice(0, m.index).indexOf('//') !== -1) continue;
      if (cAllowed.some((ok) => ok.test(line))) continue;
      failures.push(`C-6 禁项: ${label} @ ${path.relative(projectRoot, file)}: ${trimmed.slice(0, 70)}`);
    }
  }
}

if (!baseline) {
  fs.writeFileSync(baselinePath, JSON.stringify({ generated: 'b1-9ba', counts }, null, 2) + '\n');
  console.log('baseline missing — seeded tests/react-rewrite-sentinel-baseline.json (commit it)');
}
if (decreases.length > 0) {
  console.log(`DECREASED ${decreases.length}: ${decreases.join('; ')}`);
  console.log('→ update tests/react-rewrite-sentinel-baseline.json in this batch commit');
}

if (failures.length > 0) {
  console.log(`SENTINEL_REGRESSED ${JSON.stringify(failures)}`);
  process.exit(1);
}
console.log('SENTINEL_OK');
