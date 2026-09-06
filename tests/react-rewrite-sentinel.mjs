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

const metrics = {
  evalAsync: /\$evalAsync\(/g,
  apply: /\$apply\(/g,
  watch: /\$watch\(/g,
  watchCollection: /\$watchCollection\(/g,
  broadcast: /\$broadcast\(/g,
  on: /\$on\(/g,
  scopeApply: /\bscopeApply\(/g,
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

const failures = [];
const decreases = [];

const counts = {};
for (const [name, re] of Object.entries(metrics)) {
  let n = 0;
  for (const { text } of contents) n += (text.match(re) || []).length;
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
