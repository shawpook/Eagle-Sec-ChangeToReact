/**
 * M4-D —— `ng-click` → `data-click` **成对替换**的验证。
 *
 * ## 为什么必须成对
 * Angular 退役后，`ng-*` 属性不再有任何运行时语义，但**四条活着的 CSS 属性选择器**仍然
 * 按 `[ng-click]` 匹配（只读审计 `outputs/research-m4-windows-scope-2026-09-16.md` §C.4.2）：
 *
 *   | 选择器（替换前）                                                        | 作用                          |
 *   |-------------------------------------------------------------------------|-------------------------------|
 *   | `.cg-notify-message .cg-notify-message-template a[ng-click]`             | 通知动作链接左间距 12px        |
 *   | `.modal .modal-header [ng-click]`                                        | 无边框窗口拖拽区排除           |
 *   | `_modal.scss` 内同名嵌套规则（编译进上一条）                              | 同上                          |
 *   | `_toast.scss` 内 `&[ng-click]` 嵌套规则（编译进第一条）                    | 同上                          |
 *
 * 于是「删掉 JSX 里的 `ng-click`」而不动 CSS，会在**未来**某个元素落进这两个上下文时静默
 * 改变拖拽区/间距；「删掉 CSS」而不动 JSX 则当场失去保护。两者必须同一时刻、同一 token 换。
 *
 * ## 本测试如何证明「命中对象不变」（而不是只宣称）
 * 对同一份 DOM，选择器命中集 = 选择器形状 × 带属性的元素集。本测试分别锁死这两个因子：
 *  - **形状**：CSS 侧断言 `[ng-click]` 为 0，且 `[data-click]` 恰好 4 条、分布为
 *    base.css×2 / _modal.scss×1 / _toast.scss×1，并把两条编译产物规则的**字面文本**钉死
 *    （含 `.modal .modal-header` / `.cg-notify-message .cg-notify-message-template a` 前缀与
 *    声明体）——即「除 token 外逐字同形」。
 *  - **载体集**：JSX 侧断言 `data-click=` 恰好 25 个、**全部**在 Toolbar.tsx，且
 *    `src/app/react/**` 其余文件 0 个（没有把载体摊到新的元素上）。
 *
 * ## 诚实结论（实测，与审计报告不同处）
 * 1. 替换**前后命中集都是空集**：25 个载体全部位于 `#eagle-toolbar-host` 子树（index.html:49），
 *    既不在 `.modal .modal-header` 内，也不是通知模板里的 `<a>`；通知里的 undo 链接用的是
 *    `data-cg-undo` + 事件委托、预览窗用的是 `addEventListener`（见 miscDomain.ts /
 *    preview-window/controller.ts），从不产生 `ng-click`。所以本次替换**零运行时外观变化**，
 *    它的价值是把契约从「已死的 Angular 属性」搬到「活着的 React 属性」并为将来兜底。
 * 2. 审计报告 §C.4.2 提到的 `ng-shadow` / `ng-color` / `ng-glow` / `ng-primary`
 *    「UI 库工具类」**在该名称下并不存在**：`viewers/document/src/styles/orcabox-compiled-tailwind.css`
 *    里零个 `ng-*` token，那 213/104/26/22 是子串误命中（`--tw-ring-shadow`、`--tw-ring-color`、
 *    `.searchbar-typing-glow` 等）。本测试改为断言「禁改子树内不含 `data-click`」，并把该发现
 *    记录在此以免后续又被误当契约。
 *
 * ## 局限（明写）
 * 本测试是**静态配对性**验证：它证明「选择器形状一致 + 载体集一致」，不驱动真实渲染。
 * 替换后的**真机外观**（无边框窗拖拽区、通知链接间距）未在本文件覆盖，见 worker 报告。
 *
 * 运行：node tests/m4-ng-click-pairing.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

/**
 * 计量样式/标记时先剥注释：说明性注释里出现 `[ng-click]` 是**文档**而不是**选择器**，
 * 本测试只对活着的选择器计数。base.css 是压缩产物、本无注释，剥离对其是恒等。
 */
function stripComments(text, rel) {
  let out = text.replace(/\/\*[\s\S]*?\*\//g, ' ');
  if (rel && rel.endsWith('.html')) out = out.replace(/<!--[\s\S]*?-->/g, ' ');
  return out;
}

/** 读样式/标记文件并剥注释后的可计量文本。 */
const readStyle = (rel) => stripComments(read(rel), rel);

const TOOLBAR = 'src/app/react/components/toolbar/Toolbar.tsx';
const BASE_CSS = 'src/app/css/base.css';
const BASE_SCSS = 'src/app/style/base.scss';
const MODAL_SCSS = 'src/app/style/components/_modal.scss';
const TOAST_SCSS = 'src/app/style/components/_toast.scss';
const INDEX_HTML = 'src/app/index.html';

/** 走 src/app 全树，收集 .css/.scss/.html 文件（选择器面）。 */
function styleAndMarkupFiles() {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (/\.(css|scss|html)$/.test(entry.name)) out.push(path.relative(ROOT, abs).split(path.sep).join('/'));
    }
  };
  walk(path.join(ROOT, 'src/app'));
  return out.sort();
}

/** 走 src/app/react 全树，收集 .ts/.tsx（JSX 属性面）。 */
function reactSourceFiles() {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (/\.tsx?$/.test(entry.name)) out.push(path.relative(ROOT, abs).split(path.sep).join('/'));
    }
  };
  walk(path.join(ROOT, 'src/app/react'));
  return out.sort();
}

const occurrences = (text, needle) => text.split(needle).length - 1;

/* 替换前的载体表达式多重集（逐字，来自 M4-D 改动前的 Toolbar.tsx）。
 * 若将来有人改这些表达式，测试会失败并强制重新对账 —— 这正是配对性的意义。 */
const EXPECTED_EXPRESSIONS = new Map(Object.entries({
  'minimize()': 1,
  'maximize()': 1,
  'restore()': 1,
  'close()': 1,
  'openSearchScopeMenu($event)': 1,
  'openApplicationContextMenu($event)': 1,
  'toggleAll($event)': 1,
  'prevHistory($event)': 1,
  'nextHistory($event)': 1,
  'openAllTags()': 1,
  'openFolder(currentFolder)': 1,
  'openSmartFolder(currentSmartFolder)': 1,
  'zoomOut($event);': 1,
  'zoomIn($event);': 1,
  'pluginModule.open(plugin)': 1,
  'openPluginPanel($event)': 1,
  'refreshRandom()': 2,
  'openActionsPanel($event)': 1,
  'openOrderMenu($event)': 1,
  'toggleFilter()': 2,
  'toggleTagLayout()': 2,
  'openTagGroupListContextMenu($event)': 1,
}));

const EXPECTED_TOTAL = [...EXPECTED_EXPRESSIONS.values()].reduce((a, b) => a + b, 0);

/* ================= 1. CSS 侧：旧选择器清零、新选择器数量与原数量相等 ================= */

test('M4-D / CSS：src/app 全树零个 [ng-click] 选择器', () => {
  const hits = styleAndMarkupFiles()
    .map((rel) => [rel, occurrences(readStyle(rel), '[ng-click]')])
    .filter(([, n]) => n > 0);
  assert.deepEqual(hits, [], `不得残留 [ng-click] 选择器，实际：${JSON.stringify(hits)}`);
  // 反向对照：必须确实扫到了文件，否则上面的「空」是空洞通过。
  assert.ok(styleAndMarkupFiles().length > 10, '样式/标记扫描面不该为空');
});

test('M4-D / CSS：恰好 4 条 [data-click]，分布与替换前逐条对应（base.css 2 / _modal 1 / _toast 1）', () => {
  const byFile = new Map(
    [BASE_CSS, MODAL_SCSS, TOAST_SCSS].map((rel) => [rel, occurrences(readStyle(rel), '[data-click]')])
  );
  assert.deepEqual(Object.fromEntries(byFile), {
    [BASE_CSS]: 2,
    [MODAL_SCSS]: 1,
    [TOAST_SCSS]: 1,
  }, '新选择器数量必须等于原有的 4 条，且按文件一一对应');

  // 全树总计仍为 4（没有多出来的第五处）。
  const total = styleAndMarkupFiles().reduce((sum, rel) => sum + occurrences(readStyle(rel), '[data-click]'), 0);
  assert.equal(total, 4, 'src/app 全树 [data-click] 总数应为 4');
});

test('M4-D / CSS：两条编译产物规则「除 token 外逐字同形」', () => {
  const css = read(BASE_CSS);
  // 声明体与祖先链逐字锁定：改掉 .modal .modal-header / .cg-notify-message-template a 前缀
  // 或改掉声明值都会失败。
  assert.ok(
    css.includes('.cg-notify-message .cg-notify-message-template a[data-click]{margin-left:12px !important}'),
    '通知动作链接间距规则必须原样存在（仅 token 更名）'
  );
  assert.ok(
    css.includes('.modal .modal-header [data-click]{-webkit-app-region:no-drag}'),
    '无边框窗拖拽区排除规则必须原样存在（仅 token 更名）'
  );
  // 关键声明不得丢失：两条规则的完整字面文本已被上面的 includes 钉死（含声明体），
  // 此处只需再确认属性值本身未被换成别的写法。
  assert.ok(css.includes('no-drag'), '拖拽区排除声明仍应存在');
});

test('M4-D / SCSS 源：两条规则同步更名，且改的确实是 base.css 的上游', () => {
  const baseScss = read(BASE_SCSS);
  assert.ok(/@import\s+"components\/_toast"/.test(baseScss), 'base.scss 必须 import _toast（证明确是 base.css 的上游）');
  assert.ok(/@import\s+"components\/_modal"/.test(baseScss), 'base.scss 必须 import _modal');

  const modal = readStyle(MODAL_SCSS);
  assert.ok(/\[data-click\]\s*\{[\s\S]*?-webkit-app-region:\s*no-drag;/.test(modal), '_modal.scss 的 [data-click] 必须仍是 no-drag');
  assert.equal(occurrences(modal, '[ng-click]'), 0);

  const toast = readStyle(TOAST_SCSS);
  assert.ok(/&\[data-click\]\s*\{[\s\S]*?margin-left:\s*12px\s*!important;/.test(toast), '_toast.scss 的 &[data-click] 必须仍是 12px 间距');
  assert.equal(occurrences(toast, '[ng-click]'), 0);
});

/* ================= 2. JSX 侧：属性数量相等、载体集不扩散 ================= */

test('M4-D / JSX：Toolbar.tsx 零个 ng-click 绑定，恰好 25 个 data-click 绑定', () => {
  const tsx = read(TOOLBAR);
  assert.equal(occurrences(tsx, 'ng-click='), 0, 'Toolbar.tsx 不得残留 ng-click 属性绑定');
  assert.equal(occurrences(tsx, 'data-click='), EXPECTED_TOTAL, `data-click 绑定数应为 ${EXPECTED_TOTAL}`);
  assert.equal(EXPECTED_TOTAL, 25, '夹具自检：替换前 ng-click 绑定数为 25');
});

test('M4-D / JSX：data-click 载体不得扩散到 Toolbar.tsx 之外的任何 React 文件', () => {
  const carriers = reactSourceFiles()
    .map((rel) => [rel, occurrences(read(rel), 'data-click=')])
    .filter(([, n]) => n > 0);
  assert.deepEqual(carriers, [[TOOLBAR, EXPECTED_TOTAL]],
    '载体集必须与替换前完全相同（只在 Toolbar.tsx），否则命中集可能变化');
});

test('M4-D / 配对性：每个载体的表达式取值多重集与替换前逐字相同', () => {
  const tsx = read(TOOLBAR);
  const actual = new Map();
  for (const match of tsx.matchAll(/data-click="([^"]*)"/g)) {
    actual.set(match[1], (actual.get(match[1]) || 0) + 1);
  }
  assert.deepEqual(
    Object.fromEntries([...actual.entries()].sort()),
    Object.fromEntries([...EXPECTED_EXPRESSIONS.entries()].sort()),
    '表达式必须逐字保留（本次替换是纯 token 更名，语义面零改动）'
  );
});

test('M4-D / 配对性：本次替换只动 ng-click —— 其余 ng-* 绑定原样冻结', () => {
  const tsx = read(TOOLBAR);
  // 范围外但必须冻结的存量 Angular 绑定（M4-D 的任务面只有 ng-click，这些留给后续窗口）。
  // 数量漂移即说明有人在没对账的情况下动了 Toolbar 的 Angular 残留。
  const inventory = {};
  for (const match of tsx.matchAll(/\bng-[a-z-]+=/g)) {
    inventory[match[0]] = (inventory[match[0]] || 0) + 1;
  }
  assert.deepEqual(inventory, {
    'ng-change=': 1,
    'ng-dblclick=': 1,
    'ng-show=': 1,
  }, 'ng-click 之外的存量 ng-* 绑定应原样保留，不得在本次改动中增减');
  assert.equal(inventory['ng-click='], undefined, 'ng-click 绑定必须已清零');
});

/* ================= 3. 命中集不变：两条规则对 React 输出的匹配面都是空 ================= */

test('M4-D / 命中集：载体宿主 #eagle-toolbar-host 不含 modal-header / 通知模板祖先', () => {
  // 25 个载体都在 Toolbar 渲染的 #eagle-toolbar-host 子树里。
  assert.ok(read(TOOLBAR).includes("document.getElementById('eagle-toolbar-host')"),
    'Toolbar 必须挂到 #eagle-toolbar-host');

  const html = read(INDEX_HTML);
  assert.ok(html.includes('id="eagle-toolbar-host"'), '#eagle-toolbar-host 必须存在于 index.html');
  // 宿主所在文档里没有这两类祖先 → 两条规则都命中不到这些载体。
  assert.equal(occurrences(html, 'modal-header'), 0, 'index.html 不得含 modal-header（否则需重新核算命中集）');
  assert.equal(occurrences(html, 'cg-notify-message-template'), 0, 'index.html 不得含通知模板容器');
  // 通知模板里的链接由 miscDomain / preview-window controller 生成，一律不带该载体。
  assert.equal(occurrences(read('src/app/react/core/miscDomain.ts'), 'data-click'), 0,
    '通知模板生成面不得引入 data-click 载体');
});

/* ================= 4. 禁改子树未被误伤 ================= */

test('M4-D / 禁改区：viewers/document 子树（含 tailwind 编译产物）零改动痕迹', () => {
  const docRoot = path.join(ROOT, 'src/app/react/viewers/document');
  const offenders = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(abs); continue; }
      if (!/\.(css|scss|ts|tsx)$/.test(entry.name)) continue;
      if (occurrences(readFileSync(abs, 'utf8'), 'data-click') > 0) {
        offenders.push(path.relative(ROOT, abs).split(path.sep).join('/'));
      }
    }
  };
  walk(docRoot);
  assert.deepEqual(offenders, [], 'viewers/document 是并行 Worker 独占区，不得出现本次替换的痕迹');

  const tailwind = 'src/app/react/viewers/document/src/styles/orcabox-compiled-tailwind.css';
  assert.ok(statSync(path.join(ROOT, tailwind)).size > 100000, 'tailwind 编译产物应仍是完整的大文件');
  // 审计报告点名的「UI 库工具类」实为子串误命中，此处留证。
  assert.equal(occurrences(read(tailwind), '[data-click]'), 0);
  assert.equal(occurrences(read(tailwind), 'ng-click'), 0);
});
