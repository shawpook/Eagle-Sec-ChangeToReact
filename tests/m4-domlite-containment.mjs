/**
 * M4-D —— domLite 收口：`components/sidebar/Sidebar.tsx` 的普通 UI 迁出，受控引擎岛保留。
 *
 * ## 这次迁移唯一的真实风险
 * `dom('.check-item').has(el)` 被换成 `qaHasEl('.check-item', el)`。两者都是「命中集合中
 * 包住 node 的那个元素」，但**不是完全等价**：jQuery 的 `.has()` 会剔除自身（`el !== node`），
 * `qaHasEl` 不剔除。所以这里不用「看起来一样」结案，而是：
 *   1. **动态装载两个真实模块**（domLite + domQuery 都经 `ts.transpileModule` + `vm`
 *      在原生的假 DOM 树上跑），把「本调用点会出现的形状」逐一对照，证明命中同一元素；
 *   2. 把**已知分歧**（node 自身即 `.check-item`）也写成一条断言钉住——它在本调用点不可达
 *      （node 是 `.library-icon`，与选择器不同类），但写下来，免得后人以为两者可互替。
 *
 * ## 局限（明写）
 * 1. 假 DOM 只实现本测试用到的面（`querySelectorAll` / `contains` / `classList`），
 *    **不是**真实浏览器 DOM；选择器匹配也只支持 `.class` 单类。
 * 2. scroll-to-top 去抖定时器的卸载释放点是**源码级断言**，不是行为验证——把
 *    `onListScroll` 从组件里抽出来跑需要 React 渲染器，超出本测试的装载能力。
 *    这一条在下方测试里单独标注为 [静态]。
 * 3. 「外观与交互不变」未在真机核对（见报告）。
 *
 * 运行：node tests/m4-domlite-containment.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const SIDEBAR = 'src/app/react/components/sidebar/Sidebar.tsx';
const DOM_QUERY = 'src/app/react/utils/domQuery.ts';
const DOM_LITE = 'src/app/react/utils/domLite.ts';
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function transpile(path) {
  const { outputText, diagnostics } = ts.transpileModule(read(path), {
    fileName: path,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  assert.equal(diagnostics.length, 0, `${path} 转译应无诊断`);
  return outputText;
}

/* ================= 最小假 DOM ================= */

const roots = [];

/** 选择器只支持 `.class`（本测试与调用点都只用这一类）。 */
const matches = (el, sel) => sel.startsWith('.') && el._cls.has(sel.slice(1));

function walk(el, out) {
  out.push(el);
  for (const child of el.children) walk(child, out);
  return out;
}

function selectAll(sel) {
  const out = [];
  for (const root of roots) for (const el of walk(root, [])) if (matches(el, sel)) out.push(el);
  return out;
}

function createEl(className) {
  const el = {
    nodeType: 1,
    children: [],
    _cls: new Set(className ? className.split(/\s+/) : []),
    textContent: '',
    innerHTML: '',
    style: {},
  };
  el.classList = {
    add: (...names) => names.forEach((name) => el._cls.add(name)),
    remove: (...names) => names.forEach((name) => el._cls.delete(name)),
    contains: (name) => el._cls.has(name),
  };
  el.querySelectorAll = (sel) => walk(el, []).filter((node) => node !== el && matches(node, sel));
  el.querySelector = (sel) => el.querySelectorAll(sel)[0] || null;
  el.contains = (node) => walk(el, []).includes(node);
  el.getAttribute = () => null;
  el.setAttribute = () => {};
  return el;
}

function attach(parent, child) {
  parent.children.push(child);
  return child;
}

const fakeDocument = {
  querySelectorAll: (sel) => selectAll(sel),
  querySelector: (sel) => selectAll(sel)[0] || null,
  createElement: () => createEl(''),
  createTextNode: () => ({ nodeType: 3 }),
  body: createEl('body'),
};

/** 装载真实的 domQuery + domLite（domLite 内部 `require('./domQuery')` 接真实模块）。 */
function loadDomUtils() {
  const sandbox = {
    module: { exports: {} },
    exports: {},
    require(name) {
      if (name === './domQuery') return sandbox.__domQuery;
      throw new Error(`测试未桩接的模块：${name}`);
    },
    console,
    document: fakeDocument,
    window: {},
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    getComputedStyle: () => ({ getPropertyValue: () => '', width: '0px', height: '0px' }),
    navigator: { userAgent: 'test' },
  };
  sandbox.module.exports = sandbox.exports;
  vm.runInNewContext(transpile(DOM_QUERY), sandbox, { filename: DOM_QUERY });
  sandbox.__domQuery = sandbox.module.exports;

  const liteSandbox = {
    ...sandbox,
    module: { exports: {} },
    exports: {},
    require: sandbox.require,
    __domQuery: sandbox.__domQuery,
  };
  liteSandbox.module.exports = liteSandbox.exports;
  vm.runInNewContext(transpile(DOM_LITE), liteSandbox, { filename: DOM_LITE });
  const lite = liteSandbox.module.exports;
  assert.equal(typeof lite.dom, 'function', 'domLite 应导出 dom 工厂');
  return { ...sandbox.__domQuery, ...lite };
}

/**
 * 只保留**代码行**（丢掉整行注释）：源码里的说明文字会提到被替换掉的旧写法与 domLite，
 * 这不代表它还在用。注释是行级的剔除，不做字符串内 `//` 的判别——本文件与 Sidebar 的
 * 新增说明都是整行 `//` 或 ` * ` 形式，够用且不误伤（局限见文件头）。
 */
function codeLines(source) {
  return source.split('\n')
    .filter((line) => {
      const t = line.trim();
      return t && !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
    })
    .join('\n');
}

/** domLite 的 `dom(sel).has(node)` 结果（宿主 Array；沙箱内的 Array 原型不同，deepEqual 会比原型）。 */
const liteHas = (dom, sel, node) => Array.from(dom(sel).has(node).els);

/* ================= 测试 ================= */

test('M4-D/K1 等价：本调用点的形状下，qaHasEl 与 dom(sel).has(el) 命中同一元素', () => {
  const { dom, qaHasEl } = loadDomUtils();
  // 形状取自 libraryIcon：两个 .check-item，各含一个 .library-icon
  const itemA = createEl('check-item');
  const iconA = attach(itemA, createEl('library-icon'));
  const itemB = createEl('check-item');
  const iconB = attach(itemB, createEl('library-icon'));
  const detached = createEl('library-icon');
  attach(fakeDocument.body, itemA);
  attach(fakeDocument.body, itemB);
  roots.push(itemA, itemB, detached);
  try {
    // 空洞防护：选择器与子节点都得真的被假 DOM 看见，否则下面的「相等」是 0 === 0
    assert.equal(selectAll('.check-item').length, 2, '假 DOM 应能选出两个 .check-item');
    assert.equal(selectAll('.library-icon').length, 3, '假 DOM 应能选出三个 .library-icon');

    assert.deepEqual(liteHas(dom, '.check-item', iconA), [itemA], 'domLite 命中外层 itemA');
    assert.equal(qaHasEl('.check-item', iconA), itemA, 'qaHasEl 命中外层 itemA');

    assert.deepEqual(liteHas(dom, '.check-item', iconB), [itemB], 'domLite 命中外层 itemB');
    assert.equal(qaHasEl('.check-item', iconB), itemB, 'qaHasEl 命中外层 itemB');

    assert.deepEqual(liteHas(dom, '.check-item', detached), [], '游离节点：domLite 不命中');
    assert.equal(qaHasEl('.check-item', detached), null, '游离节点：qaHasEl 返回 null');

    assert.deepEqual(liteHas(dom, '.check-item', null), [], 'null：domLite 不命中');
    assert.equal(qaHasEl('.check-item', null), null, 'null：qaHasEl 返回 null');
  } finally {
    roots.length = 0;
  }
});

test('M4-D/K2 已钉住的分歧：node 自身即匹配元素时，jQuery 剔除自身、qaHasEl 不剔除', () => {
  const { dom, qaHasEl } = loadDomUtils();
  const item = createEl('check-item');
  attach(fakeDocument.body, item);
  roots.push(item);
  try {
    // 这是两者**唯一**的语义差。它在本调用点不可达（node 是 .library-icon，选择器是
    // .check-item，不同类），但必须钉住，免得后人把两者当可互替品。
    assert.deepEqual(liteHas(dom, '.check-item', item), [], 'domLite/jQuery 剔除自身');
    assert.equal(qaHasEl('.check-item', item), item, 'qaHasEl 不剔除自身');
  } finally {
    roots.length = 0;
  }
});

test('M4-D/K3 替换后的类名写入真实生效，且 item 为 null 时不抛', () => {
  const { dom, qaHasEl, addClassEl, removeClassEl } = loadDomUtils();
  const item = createEl('check-item');
  const icon = attach(item, createEl('library-icon'));
  attach(fakeDocument.body, item);
  roots.push(item);
  try {
    // 与 domLite 的写法对照：同一条路径下类名状态应一致
    const viaLite = dom('.check-item').has(icon);
    viaLite.addClass('missing');
    assert.equal(item.classList.contains('missing'), true, 'domLite 路径应加上 missing');

    const viaNative = qaHasEl('.check-item', icon);
    removeClassEl(viaNative, 'missing');
    assert.equal(item.classList.contains('missing'), false, 'removeClassEl 应摘掉 missing');
    assert.equal(viaNative, viaLite.els[0], '两条路径应指向同一个 DOM 元素');

    addClassEl(viaNative, 'missing');
    assert.equal(item.classList.contains('missing'), true, 'addClassEl 应加上 missing');

    // 命中不到时（qaHasEl 返回 null）不得抛——原 domLite 空集合的 addClass 也是 no-op
    removeClassEl(null, 'missing');
    addClassEl(null, 'missing');
    assert.doesNotThrow(() => addClassEl(qaHasEl('.not-there', icon), 'missing'));
  } finally {
    roots.length = 0;
  }
});

test('M4-D/K4 Sidebar 已脱离 domLite，而 domLite 的受控引擎岛消费者仍在', () => {
  const sidebar = codeLines(read(SIDEBAR));
  assert.equal(sidebar.includes('domLite'), false, 'Sidebar 的代码不应再引用 domLite');
  // 独立标识符的调用（排除 react-dom / arrow function 等误伤）
  const bareDomCalls = sidebar.split('\n')
    .map((line, index) => ({ line: line.trim(), no: index + 1 }))
    .filter(({ line }) => /(^|[^.\w'"`-])dom\s*\(/.test(line));
  assert.deepEqual(bareDomCalls, [], `Sidebar 不应再有裸 dom(...) 调用：${JSON.stringify(bareDomCalls)}`);

  // 反向：domLite 不能被当死代码删——三个受控引擎岛仍在消费它
  const consumers = [
    'src/app/react/preview-window/controller.ts',
    'src/app/react/core/smoothZoomEngine.ts',
    'src/app/react/core/hoverPreview.ts',
  ];
  for (const rel of consumers) {
    assert.ok(read(rel).includes("utils/domLite'"), `${rel} 仍应是 domLite 的消费者`);
  }
  // 且 domLite 本体仍在（未被删除、仍导出 dom / DomSet）
  const lite = read(DOM_LITE);
  assert.ok(lite.includes('export class DomSet'), 'domLite 应仍导出 DomSet');
  assert.ok(lite.includes('export function dom(') || lite.includes('export const dom'), 'domLite 应仍导出 dom');
});

test('M4-D/K5 libraryIcon 的替换逐点对应（不是删掉而是换成了原生助手）', () => {
  const sidebar = codeLines(read(SIDEBAR));
  const required = [
    "import { qaHasEl, addClassEl, removeClassEl } from '../../utils/domQuery';",
    "const item = qaHasEl('.check-item', el);",
    "addClassEl(item, 'missing');",
    "removeClassEl(item, 'missing');",
  ];
  for (const needle of required) {
    assert.ok(sidebar.includes(needle), `Sidebar 应包含：${needle}`);
  }
  // 反向：被替换掉的写法一处都不许留
  for (const gone of ['$item', "dom(`.check-item`)", "dom('.check-item')"]) {
    assert.equal(sidebar.includes(gone), false, `Sidebar 不应再出现：${gone}`);
  }
  // 分歧不可达的依据：本调用点的 node 是 .library-icon，选择器是 .check-item
  assert.ok(sidebar.includes('className="library-icon"'), 'libraryIcon 的节点应为 .library-icon');
  assert.ok(sidebar.includes('libraryPath'), 'libraryIcon 的入参仍在');
});

test('M4-D/K6 [静态] scroll-to-top 去抖定时器在卸载时有释放点', () => {
  const sidebar = codeLines(read(SIDEBAR));
  // 释放点必须与去抖用同一个 ref
  assert.ok(sidebar.includes('scrollTopTimeout.current = setTimeout('), '去抖定时器仍写进该 ref');
  const clears = sidebar.split('clearTimeout(scrollTopTimeout.current)').length - 1;
  assert.equal(clears, 2, `该 ref 应有且仅有两处取消（去抖内 + 卸载清理），实测 ${clears} 处`);
  // 卸载清理：与 onListScroll 同文件、无依赖数组、cleanup 即取消
  assert.match(
    sidebar,
    /useEffect\(\(\) => \(\) => \{ clearTimeout\(scrollTopTimeout\.current\); \}, \[\]\);/,
    '应有一处无依赖的卸载清理取消该定时器'
  );
  // 声明与使用顺序：ref 定义在清理之前（文本顺序即源码顺序）
  assert.ok(
    sidebar.indexOf('const scrollTopTimeout = useRef') < sidebar.indexOf('clearTimeout(scrollTopTimeout.current)'),
    '释放点应在 ref 定义之后'
  );
});
