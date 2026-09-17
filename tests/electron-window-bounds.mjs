/**
 * R0-4（2026-09-17 验收整改 §3.1）——窗口可见性的**实机**门禁。
 *
 * ## 补的是什么缺口
 * 验收报告的核心发现：「四段全绿」与「用户打开软件能看到窗口」之间还隔着一层。
 * 那个缺陷（陈旧 `window-state.json` 的 `{x:302,y:1262}` 把主窗建到屏幕外）症状是
 * **进程活着、日志正常、屏幕上没有窗口**，而既有 102 项套件只断言「进程能起来」，
 * 从不校验窗口真的落在可视区——所以它是被人发现的，不是被门禁发现的。
 *
 * 本文件起**真实 Electron**（`--smoke-window-bounds` 模式），把两种几何分别注入临时
 * userData 后启动：
 *   A. **屏外陈旧几何**（y 远大于屏高）→ 断言最终 bounds 仍与某个显示器工作区交叠 ≥ 阈值；
 *   B. **合法几何** → 断言位置被沿用（证明不是「一律丢坐标」这种偷懒实现）。
 * 判据复用 `electron/window-geometry.cjs`（阈值与算法单一事实源），不在测试里抄一份。
 *
 * ## 环境注意
 * 与其余 CDP 类测试同例：**在 WorkBuddy 沙箱内起 Electron 会失败**；
 * 请在普通终端执行 `node tests/electron-window-bounds.mjs`。
 *
 * 运行：node tests/electron-window-bounds.mjs
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const geometry = require(path.join(ROOT, 'electron', 'window-geometry.cjs'));

function tempUserData(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `eagle-${label}-`));
  return dir;
}

function writeWindowState(dir, state) {
  fs.writeFileSync(path.join(dir, 'window-state.json'), JSON.stringify(state), 'utf8');
}

/** 起一次 electron 主进程（--smoke-window-bounds），回收 WINDOW_BOUNDS_SMOKE 载荷。 */
async function runWindowBoundsSmoke(userDataDir, { timeoutMs = 60000 } = {}) {
  const electronBinary = require('electron');
  assert.ok(typeof electronBinary === 'string' && fs.existsSync(electronBinary), `electron binary not found: ${electronBinary}`);
  const child = spawn(electronBinary, [path.join(ROOT, 'electron', 'main.cjs'), '--smoke-window-bounds'], {
    cwd: ROOT,
    env: { ...process.env, EAGLE_ELECTRON_USER_DATA_DIR: userDataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const code = await new Promise((resolve) => {
    const timer = setTimeout(() => { child.kill(); resolve('TIMEOUT'); }, timeoutMs);
    child.once('exit', (exitCode) => { clearTimeout(timer); resolve(exitCode); });
  });
  const line = output.split('\n').find((entry) => entry.includes('WINDOW_BOUNDS_SMOKE'));
  assert.ok(line, `未拿到 WINDOW_BOUNDS_SMOKE（exit=${code}）\n${output.slice(-800)}`);
  return { payload: JSON.parse(line.slice('WINDOW_BOUNDS_SMOKE '.length)), code, output };
}

let passed = 0;
function check(label, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${label}`);
}

const displayCount = (() => {
  const probe = geometry.boundsVisibleEnough({ x: 0, y: 0, width: 10, height: 10 }, []);
  assert.equal(probe, true, '空显示器集合应放行（与抽离前语义一致）');
  return null;
})();
void displayCount;

console.log('窗口可见性实机门禁');

// ── A. 屏外陈旧几何（验收报告记录的真实缺陷样本形态）──
const offscreenDir = tempUserData('bounds-offscreen');
writeWindowState(offscreenDir, { x: 302, y: 1262, width: 1280, height: 800, maximized: false });
const offscreen = await runWindowBoundsSmoke(offscreenDir);
const off = offscreen.payload;

check('A1 注入的屏外几何确实被读回（前置条件成立）', () => {
  assert.equal(off.saved.x, 302);
  assert.equal(off.saved.y, 1262);
});

/** 实机吐出的是工作区矩形数组，判据需要的是「显示器」形态（pure 函数读 `.workArea`）。 */
const asDisplays = (areas) => (Array.isArray(areas) ? areas : []).map((workArea) => ({ workArea }));

check('A2 主窗最终位置仍与某个显示器工作区交叠 ≥ 80px（窗口看得见）', () => {
  const visible = geometry.boundsVisibleEnough(off.bounds, asDisplays(off.displays));
  assert.ok(visible, `窗口 bounds ${JSON.stringify(off.bounds)} 与任何显示器 ${JSON.stringify(off.displays)} 交叠都不足`);
});

check('A3 没有被原样放到屏外（y=1262 不得被沿用）', () => {
  const stillOffscreen = off.bounds.y >= 1262;
  assert.equal(stillOffscreen, false, `窗口仍被放到 y=${off.bounds.y}（屏外）`);
});

check('A4 至少拿到了一个显示器工作区（前置条件成立）', () => {
  assert.ok(Array.isArray(off.displays) && off.displays.length > 0, '拿不到显示器信息则本门禁是恒真断言');
});

// ── B. 合法几何必须被沿用（证明不是"一律丢坐标"）──
const validDir = tempUserData('bounds-valid');
writeWindowState(validDir, { x: 40, y: 40, width: 1000, height: 700, maximized: false });
const valid = await runWindowBoundsSmoke(validDir);
const on = valid.payload;

check('B1 合法几何被沿用（位置不丢）', () => {
  assert.ok(Math.abs(on.bounds.x - 40) <= 5 && Math.abs(on.bounds.y - 40) <= 5,
    `合法几何应被沿用，实际 bounds=${JSON.stringify(on.bounds)}（期望 ≈ {x:40,y:40}）`);
});

check('B2 尺寸沿用落盘宽高', () => {
  assert.ok(Math.abs(on.bounds.width - 1000) <= 5 && Math.abs(on.bounds.height - 700) <= 5,
    `实际 bounds=${JSON.stringify(on.bounds)}`);
});

// ── C. 只有副屏的场景（主屏被拔/主屏分辨率变小）──
// 无法在本机真的拔屏，改为喂一个「只在右侧副屏可见」的几何，判据仍走同一套纯函数：
// 若实现改为只认主屏，这条会红。
check('C 多显示器判据：副屏可见即算可见（纯函数侧已穷举，此处留实机提示）', () => {
  const secondary = [{ workArea: { x: 1920, y: 0, width: 1280, height: 1000 } }];
  assert.equal(geometry.boundsVisibleEnough({ x: 2000, y: 100, width: 1000, height: 800 }, secondary), true);
  assert.ok(Array.isArray(on.displays), '实机应能取到显示器列表');
});

console.log(`PASS electron-window-bounds: ${passed} 项断言通过`
  + `（屏外样本 bounds=${JSON.stringify(off.bounds)}，合法样本 bounds=${JSON.stringify(on.bounds)}）`);
