/**
 * R0-2（2026-09-17 验收整改 §3.1）——把 `electron/**` 纳入静态门禁视野。
 *
 * ## 缺口
 * 验收报告：「一个全绿的验收，和『用户打开软件能看到窗口』之间还隔着一层。」
 * 根因是主进程（`electron/**`，`.cjs`）**不在任何静态门禁的扫描对象里**：
 * tsconfig 只 include `src/app/react`；`react-rewrite-sentinel` 只扫 TS/TSX；
 * scope 收敛等全工作区扫描不覆盖 `.cjs`。于是「把窗口几何的可见性校验删掉」不会让任何门禁变红。
 *
 * 本文件补三道**静态**闸（行为面由 `tests/electron-window-geometry.mjs`（纯函数）与
 * `tests/electron-window-bounds.mjs`（实机）覆盖，三者互为补充）：
 *   1. 落盘窗口几何必须经可见性对账后才可用于创建窗口；
 *   2. 主进程/预加载脚本的**依赖面快照**——新增或删除 require/import 必须显式更新基线；
 *   3. 生产可达代码里不得残留 `/mock-` 伪造路径常量（R1-2 的回归闸）。
 * 另附 webPreferences 安全面快照（变更需显式登记，见 R4-4）。
 *
 * 运行：node tests/electron-main-gates.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let passed = 0;
function check(label, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${label}`);
}

/** 计量前剥注释：文档里出现 `require('electron')` 是说明文字，不是依赖。 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // `electron/pdf-viewer/build` 是第三方 pdf.js 构建产物，不属本仓维护面。
      if (entry.name === 'node_modules' || entry.name === 'build') continue;
      walk(path.join(dir, entry.name), out);
      continue;
    }
    if (/\.(cjs|js|mjs)$/.test(entry.name)) out.push(path.join(dir, entry.name).split(path.sep).join('/'));
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('1. 窗口几何保护（落盘几何不得无对账地用于创建窗口）');
// ═══════════════════════════════════════════════════════════════════════════

const mainSource = read('electron/main.cjs');
const mainCode = stripComments(mainSource);

check('window-state.json 的读取只有 loadWindowState 一处', () => {
  const reads = mainCode.split('\n')
    .map((line, index) => ({ line: line.trim(), index: index + 1 }))
    .filter((entry) => entry.line.includes('windowStateFile()') && entry.line.includes('readFileSync'));
  assert.equal(reads.length, 1, `期望恰好一处读取，实际 ${reads.length} 处：${JSON.stringify(reads)}`);
  assert.ok(/function loadWindowState\(\)/.test(mainCode), '该读取必须位于 loadWindowState 内');
});

check('createWindow 的几何入口必须过 clampWindowState', () => {
  assert.ok(/clampWindowState\(loadWindowState\(\)\)/.test(mainCode),
    'createWindow 必须把落盘几何先过一遍可见性对账');
});

check('不得把 saved.x / saved.y 直接写进 BrowserWindow 选项', () => {
  const offenders = mainCode.split('\n')
    .filter((line) => /x:\s*saved\.x|y:\s*saved\.y/.test(line));
  assert.deepEqual(offenders, [], `落盘坐标必须经校验后再使用：${offenders.join(' | ')}`);
});

check('几何判定的**实现**不得在 main.cjs 里再写一份（允许薄封装）', () => {
  // 薄封装（取当前显示器后转发）是必要的；禁止的是把交叠算法/阈值抄回主进程。
  assert.equal(/overlapWidth/.test(mainCode), false, '交叠计算应在 window-geometry.cjs');
  // 允许 smoke 载荷把 workArea 原样吐出（供实机测试判定），但不得就地做交叠运算。
  const judgingLines = mainCode.split('\n').filter((line) => line.includes('workArea') && line.includes('Math.min'));
  assert.deepEqual(judgingLines, [], `主进程不得自行计算交叠：${judgingLines.join(' | ')}`);
  assert.equal(/const MIN_VISIBLE_WINDOW_PX/.test(mainCode), false, '阈值常量不得重复定义');
  const thinWrappers = mainCode.match(/function (boundsVisibleEnough|clampWindowState)\(/g) || [];
  assert.equal(thinWrappers.length, 2, 'main.cjs 只应保留两个薄封装（各一个）');
});

check('window-geometry.cjs 自身不得依赖 electron（否则纯 Node 测不了）', () => {
  const geometrySource = stripComments(read('electron/window-geometry.cjs'));
  assert.equal(/require\(['"]electron['"]\)/.test(geometrySource), false,
    '一旦 require electron，纯函数门禁就失去意义');
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('2. 主进程依赖面快照（增删改 require/import 必须显式更新本基线）');
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 依赖面基线（2026-09-17 实测）。变更判据：
 *  - 新增一条依赖 → 在本表登记并写明 reason（新能力 / 新接线）；
 *  - 删除一条依赖 → 同步确认没有调用点残留（否则就是运行期 ReferenceError）。
 * 之所以要做成快照：`electron/**` 不在 tsconfig 内，删掉一个 require 不会有任何类型报错，
 * 而历史上 M6-3 改 preload 依赖面就打断过 3 个沙箱加载器（验收 §3.4 第 3 起回归）。
 */
const DEPENDENCY_BASELINE = {
  'electron/main.cjs': [
    '../backend/src/export-service.js', '../backend/src/library-store.js', '../backend/src/plugin-runtime.js',
    './window-geometry.cjs', '/src/my_modules/url',
    'electron', 'node:child_process', 'node:fs', 'node:http', 'node:https', 'node:os', 'node:path',
  ],
  'electron/preload.cjs': ['electron', 'node:fs', 'node:path', 'node:url'],
  'electron/pdf-thumbnail-worker.cjs': ['electron', 'node:fs', 'node:path'],
  'electron/video-thumbnail-worker.cjs': ['electron', 'node:fs', 'node:path'],
  'electron/window-geometry.cjs': [],
  'electron/smoke/persistence-driver.js': [],
  'electron/smoke/write-path-driver.js': [],
};

function dependenciesOf(file) {
  const source = stripComments(read(file));
  const specs = [
    ...[...source.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]),
    ...[...source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]),
  ];
  return [...new Set(specs)].sort();
}

check('依赖面与基线一致（变化即红，须同步更新 DEPENDENCY_BASELINE 并写明理由）', () => {
  for (const [file, baseline] of Object.entries(DEPENDENCY_BASELINE)) {
    assert.deepEqual(dependenciesOf(file), [...baseline].sort(),
      `${file} 的依赖面发生变化；若确属预期，请更新 tests/electron-main-gates.mjs 的 DEPENDENCY_BASELINE`);
  }
});

check('electron 目录没有基线外的脚本（新文件必须登记）', () => {
  const files = walk('electron').sort();
  const known = Object.keys(DEPENDENCY_BASELINE).sort();
  assert.deepEqual(files, known, `electron/ 下出现未登记脚本：${files.filter((f) => !known.includes(f)).join(', ')}`);
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('3. 生产可达代码不得残留伪造路径常量（R1-2 回归闸）');
// ═══════════════════════════════════════════════════════════════════════════

const FORBIDDEN_PATH_CONSTANTS = ['/mock-user-data', '/mock-tmp'];

function scanShimTree() {
  const results = [];
  const walkDir = (dir) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = path.join(dir, entry.name).split(path.sep).join('/');
      if (entry.isDirectory()) { walkDir(rel); continue; }
      if (!/\.(ts|tsx|cjs|js)$/.test(entry.name)) continue;
      const code = stripComments(read(rel));
      for (const constant of FORBIDDEN_PATH_CONSTANTS) {
        if (code.includes(constant)) results.push(`${rel} → ${constant}`);
      }
    }
  };
  walkDir('electron');
  walkDir('src/app/react/core/shim');
  return results;
}

check('electron/** 与 shim/** 的代码里不再出现 /mock-user-data、/mock-tmp', () => {
  const offenders = scanShimTree();
  assert.deepEqual(offenders, [],
    `伪造路径会让派生路径（如缩略图临时目录）指向不存在的目录却看起来正常：${offenders.join(' | ')}`);
});

check('shim 侧仍保留「能力缺口即登记」的显式降级（不是静默返回真值）', () => {
  const desktop = read('src/app/react/core/shim/desktopCapability.ts');
  assert.ok(/appPathGap\(/.test(desktop), '取不到真值时必须登记能力缺口');
  assert.ok(/return '';/.test(stripComments(desktop)), '真值不可得时返回空串，而不是伪造路径');
  const registry = read('src/app/react/core/shim/moduleRegistry.ts');
  assert.ok(/checkPathWritable/.test(registry), '权限判定必须走真实实现');
});

// ═══════════════════════════════════════════════════════════════════════════
console.log('4. webPreferences 安全面快照（变更需显式登记，见 R4-4）');
// ═══════════════════════════════════════════════════════════════════════════

const WEB_PREFERENCES_BASELINE = {
  nodeIntegration: true,
  contextIsolation: false,
  sandbox: false,
  webviewTag: true,
};

check('webPreferences 与基线一致（收敛路线见 R4-4，变更需在此登记理由）', () => {
  const block = mainCode.slice(mainCode.indexOf('webPreferences: {'), mainCode.indexOf('webPreferences: {') + 400);
  for (const [key, expected] of Object.entries(WEB_PREFERENCES_BASELINE)) {
    const match = block.match(new RegExp(`${key}:\\s*(true|false)`));
    assert.ok(match, `webPreferences 里找不到 ${key}`);
    assert.equal(match[1], String(expected),
      `${key} 变化为 ${match[1]}（基线 ${expected}）；这直接影响 <webview> guest 的隔离强度，须显式登记`);
  }
});

console.log(`PASS electron-main-gates: ${passed} 项断言通过`);
