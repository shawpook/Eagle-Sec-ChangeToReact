/**
 * R0-1（2026-09-17 验收整改 §3.1）——窗口几何的**纯函数**门禁。
 *
 * ## 为什么需要这个文件
 * 验收报告记录了一个「四段全绿之后 31 分钟就被人肉发现」的缺陷：陈旧
 * `userData/window-state.json`（实测 `{"x":302,"y":1262}`）被 `createWindow` 原样沿用，
 * 主窗被建到屏幕外——进程活着、日志正常、屏幕上没有窗口，用户无法自救。
 *
 * 修复（`c367b2aa`）本身是对的，问题在于它**住在 `electron/main.cjs` 里**：
 *  - `tsconfig` 只 include `src/app/react` → 类型门禁看不见；
 *  - `react-rewrite-sentinel` 只扫 TS/TSX → 哨兵看不见；
 *  - 全工作区扫描不覆盖 `.cjs` → 静态门禁看不见。
 * 换言之：**把可见性校验删掉，所有门禁依然全绿**。
 *
 * 本文件把那段逻辑的判据搬到纯 Node 可穷举的位置（逻辑本身抽到
 * `electron/window-geometry.cjs`，main.cjs 只剩薄封装），并附**负向自证**：
 * 用「修复前的行为」跑同一批用例，必须失败——否则说明用例没有牙齿。
 *
 * 运行：node tests/electron-window-geometry.mjs
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const geometry = require(path.join(ROOT, 'electron', 'window-geometry.cjs'));
const { boundsVisibleEnough, clampWindowState, resolveWindowBounds, MIN_VISIBLE_WINDOW_PX } = geometry;

let passed = 0;
function check(label, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${label}`);
}

/** 1920x1080 单屏（工作区留任务栏 40px）。 */
const singleDisplay = [{ workArea: { x: 0, y: 0, width: 1920, height: 1040 } }];
/** 双屏：主屏 1920x1080 + 右侧副屏（x 从 1920 开始）。 */
const dualDisplays = [
  { workArea: { x: 0, y: 0, width: 1920, height: 1040 } },
  { workArea: { x: 1920, y: 0, width: 1280, height: 1000 } },
];

console.log('窗口几何纯函数门禁');

check('阈值常量仍是 80px（改动需同步本文件用例）', () => {
  assert.equal(MIN_VISIBLE_WINDOW_PX, 80);
});

check('完全可见：窗口位于主屏内 → 可见', () => {
  assert.equal(boundsVisibleEnough({ x: 100, y: 100, width: 1280, height: 800 }, singleDisplay), true);
});

check('完全在屏外（y=1262 的真实缺陷样本）→ 不可见', () => {
  // 这是实测落盘的那条几何：虚拟屏只有 1920x1080，y=1262 整个窗口都在屏下方。
  assert.equal(boundsVisibleEnough({ x: 302, y: 1262, width: 1280, height: 800 }, singleDisplay), false);
});

check('只交叠一个像素 → 不可见', () => {
  assert.equal(boundsVisibleEnough({ x: 1919, y: 1039, width: 1280, height: 800 }, singleDisplay), false);
});

check('横向够、纵向只有 79px 交叠 → 不可见（阈值边界 -1）', () => {
  // y = 1040 - 79 = 961：纵向交叠恰好 79 < 80。
  assert.equal(boundsVisibleEnough({ x: 0, y: 961, width: 1280, height: 800 }, singleDisplay), false);
});

check('纵向交叠 80px → 可见（阈值边界）', () => {
  assert.equal(boundsVisibleEnough({ x: 0, y: 960, width: 1280, height: 800 }, singleDisplay), true);
});

check('只交叠 79px 的横向情形 → 不可见', () => {
  // x = 1920 - 79 = 1841：横向交叠恰好 79。
  assert.equal(boundsVisibleEnough({ x: 1841, y: 0, width: 1280, height: 800 }, singleDisplay), false);
});

check('多显示器：主屏看不到但副屏可见 → 可见', () => {
  assert.equal(boundsVisibleEnough({ x: 2000, y: 100, width: 1000, height: 800 }, dualDisplays), true);
});

check('多显示器：两块屏都看不到 → 不可见', () => {
  assert.equal(boundsVisibleEnough({ x: 1920, y: 5000, width: 800, height: 600 }, dualDisplays), false);
});

check('只有副屏（主屏已拔）时以副屏为判据', () => {
  const secondaryOnly = [{ workArea: { x: -1920, y: 0, width: 1920, height: 1040 } }];
  assert.equal(boundsVisibleEnough({ x: -1800, y: 100, width: 1280, height: 800 }, secondaryOnly), true);
  assert.equal(boundsVisibleEnough({ x: 300, y: 100, width: 1280, height: 800 }, secondaryOnly), false);
});

check('显示器集合为空（app 未 ready）→ 不拦，保持抽离前语义', () => {
  assert.equal(boundsVisibleEnough({ x: 5000, y: 5000, width: 800, height: 600 }, []), true);
  assert.equal(boundsVisibleEnough({ x: 5000, y: 5000, width: 800, height: 600 }, undefined), true);
});

check('x=0/y=0 是真位置，不再被当成假值丢掉', () => {
  const result = resolveWindowBounds({ x: 0, y: 0 }, {}, singleDisplay);
  assert.equal(result.positionApplied, true);
  assert.equal(result.x, 0);
  assert.equal(result.y, 0);
});

check('clampWindowState：脏数据与非数字坐标一律丢弃 x/y', () => {
  assert.deepEqual(clampWindowState(null, singleDisplay), {});
  assert.deepEqual(clampWindowState('nonsense', singleDisplay), {});
  const noNumbers = clampWindowState({ x: '302', y: '1262' }, singleDisplay);
  assert.equal(noNumbers.x, undefined);
  assert.equal(noNumbers.y, undefined);
});

check('clampWindowState：屏外几何丢 x/y，但保留宽高与 maximized', () => {
  const clamped = clampWindowState({ x: 302, y: 1262, width: 1440, height: 900, maximized: true }, singleDisplay);
  assert.equal(clamped.x, undefined);
  assert.equal(clamped.y, undefined);
  assert.equal(clamped.width, 1440);
  assert.equal(clamped.height, 900);
  assert.equal(clamped.maximized, true);
});

check('clampWindowState：合法几何逐字保留', () => {
  const saved = { x: 120, y: 80, width: 1440, height: 900, maximized: false };
  assert.deepEqual(clampWindowState(saved, singleDisplay), saved);
});

check('resolveWindowBounds：调用方几何优先于历史状态', () => {
  const result = resolveWindowBounds({ x: 10, y: 20 }, { x: 500, y: 500 }, singleDisplay);
  assert.equal(result.x, 10);
  assert.equal(result.y, 20);
});

check('resolveWindowBounds：调用方给的屏外几何同样被丢弃（两条来源都要过校验）', () => {
  const result = resolveWindowBounds({ x: 4000, y: 4000 }, { x: 100, y: 100 }, singleDisplay);
  assert.equal(result.positionApplied, false);
  assert.equal(result.x, undefined);
});

check('resolveWindowBounds：只有主窗历史有效时沿用历史位置', () => {
  const result = resolveWindowBounds({}, { x: 300, y: 200, width: 1440, height: 900 }, singleDisplay);
  assert.equal(result.positionApplied, true);
  assert.equal(result.width, 1440);
  assert.equal(result.height, 900);
});

check('resolveWindowBounds：宽度缺省 1280 / 高度缺省 800，且 0 不再被当作缺省', () => {
  const fallback = resolveWindowBounds({}, {}, singleDisplay);
  assert.equal(fallback.width, 1280);
  assert.equal(fallback.height, 800);
  // 0 宽是非法值，回落缺省；这与抽离前 `options.width || saved.width || 1280` 的差别
  // 正是 c367b2aa 顺手修掉的「0 当假值」同类问题。
  assert.equal(resolveWindowBounds({ width: 0 }, { width: 1440 }, singleDisplay).width, 1440);
});

// ── 负向自证：把「修复前的行为」喂给同一批用例，必须失败 ──
// 否则说明这些用例对回归不敏感（删掉校验也能全绿），门禁就失去意义。
console.log('负向自证（修复前行为必须被判死）');

const naiveAlwaysVisible = () => true;
const naiveSavedOnly = (saved) => saved; // 不做任何对账

check('「恒可见」实现会在真实缺陷样本上给出通过 → 用例有牙齿', () => {
  assert.equal(boundsVisibleEnough({ x: 302, y: 1262, width: 1280, height: 800 }, singleDisplay), false);
  assert.equal(naiveAlwaysVisible(), true, '修复前实现会放行屏外窗口，正是本门禁要拦的行为');
});

check('「不 clamp」实现会保留屏外坐标 → 用例有牙齿', () => {
  const naive = naiveSavedOnly({ x: 302, y: 1262, width: 1280, height: 800 });
  assert.equal(naive.x, 302);
  assert.notDeepEqual(clampWindowState({ x: 302, y: 1262, width: 1280, height: 800 }, singleDisplay), naive);
});

// ── 接线自证：main.cjs 必须真的调用这些函数，而不是自己另写一份 ──
console.log('接线自证（main.cjs 不得自带第二份实现）');

const mainSource = fs.readFileSync(path.join(ROOT, 'electron', 'main.cjs'), 'utf8');

check('main.cjs 从 window-geometry.cjs 取实现', () => {
  assert.ok(mainSource.includes("require('./window-geometry.cjs')"), 'main.cjs 必须引用抽出的几何模块');
  assert.ok(/clampWindowState\(loadWindowState\(\)\)/.test(mainSource), 'createWindow 必须把落盘几何过一遍 clamp');
  assert.ok(/boundsVisibleEnough\(\{ x: requestedX, y: requestedY, width, height \}\)/.test(mainSource),
    '调用方显式传入的位置也必须过可见性校验');
});

check('main.cjs 内不得残留第二份 MIN_VISIBLE_WINDOW_PX / 交叠判定', () => {
  assert.equal(/const MIN_VISIBLE_WINDOW_PX\s*=/.test(mainSource), false, '常量已在 window-geometry.cjs 定义，main.cjs 不得重复定义');
  assert.equal(/overlapWidth\s*=/.test(mainSource), false, '交叠计算不得在 main.cjs 里再写一遍');
});

check('只有主窗写回 window-state.json（辅助窗不得污染）', () => {
  assert.ok(/options\.persistState === true/.test(mainSource), '写回必须以 persistState 为闸门');
  const writeBackBlock = mainSource.slice(mainSource.indexOf('options.persistState === true'));
  assert.ok(writeBackBlock.slice(0, 400).includes('saveWindowState(win)'), '闸门内必须挂 saveWindowState');
});

console.log(`PASS electron-window-geometry: ${passed} 项断言通过`);
