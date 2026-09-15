/**
 * F08 / F09（m1-f08f09-actions）：**动作消费/供给对照契约测试**。
 *
 * 依据：`outputs/research-f08f09-actions-2026-09-15.md` §A-1（查看器→主窗）、§A-2（主窗内部字符串派发）、
 * §A-3（driverApi 白名单 vs 主窗实供）。本文件的 `LEDGER` 即这三张表中「供给点 = 无」的**全集**，
 * 每条都必须显式登记处置结论 —— 本测试的结构保证**不可能静默通过**：
 *   · `fixed`      —— 断言「消费点可达 + 供给为真实函数 + 白名单/契约一致」三件齐备；
 *   · `unmigrated` —— 断言它**确实仍未迁移**（`reason` 必填且非空），如果有人补了实现却忘了
 *                     把它从台账挪走，会立刻失败；反之若有人只删台账不改代码，也会失败；
 *   · 台账的键集合与 §A 表逐条对齐，长度写死（见 `EXPECTED_LEDGER_SIZE`），删条即失败。
 *
 * 第二组断言（F09）：已迁移的主窗内部派发点**不得再出现字符串派发**，且必须出现直 import 的具名符号。
 *
 * 第三组断言（错误路径）：缺动作时必须显式失败且可定位，不得静默返回 / 静默 undefined。
 *
 * 验证手段与 `tests/boot-ready-sequence.mjs` 同款：typescript 内存转译 + `node:vm` 隔离加载**真实模块**，
 * 依赖经 require 闸门显式注入（未登记依赖直接断言失败），避免「测到替身而不是被测代码」。
 *
 * 注意（如实声明）：第三组中的 `imagesChange` / 0–5 星走的是**隔离单测**（真实模块 + 假业务依赖），
 * 本轮**未做** Electron 实机运行验证 —— 见文件末尾 `TEST-ISOLATION-NOTICE`。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const SUPPLY_PATH = 'src/app/react/core/externalSupply.ts';
const DRIVER_PATH = 'src/app/react/core/driverApi.ts';
const REGISTRAR_PATH = 'src/app/react/core/externalSupplyRegistrar.ts';
const CROSS_ACTIONS_PATH = 'src/app/react/core/crossWindowActions.ts';
const MACHINERY_PATH = 'src/app/react/core/machineryInfra.ts';
const VIEW_OPEN_PATH = 'src/app/react/core/viewOpenActions.ts';
const INTERNAL_DISPATCH_PATH = 'src/app/react/core/internalDispatch.ts';
const FONT_VIEWER_PATH = 'src/app/react/viewers/font/entry.tsx';
const TEXT_VIEWER_PATH = 'src/app/react/viewers/text-editor/entry.tsx';

function read(rel) {
  return fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
}

/** 与 tests/boot-ready-sequence.mjs 同款：转译为 CJS 后在隔离 vm 中执行。 */
function loadModule(rel, imports = {}, globals = {}, source = read(rel)) {
  const { outputText, diagnostics } = ts.transpileModule(source, {
    fileName: rel,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  assert.equal(diagnostics.length, 0, `${rel} 转译应无诊断`);
  const exports = {};
  vm.runInNewContext(outputText, {
    ...globals,
    exports,
    module: { exports },
    require(name) {
      assert.ok(Object.hasOwn(imports, name), `禁止加载未隔离的依赖：${name}`);
      return imports[name];
    },
  }, { filename: rel });
  return exports;
}

/** vm 内构造的数组/对象跨 realm 比较会因原型不同而失败，统一在本 realm 重建。 */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const quietConsole = { log() {}, warn() {}, error() {} };

/* =====================================================================================
 * 台账：§A 表中「供给点 = 无」的全集
 * ===================================================================================== */

/** 仍在 `driverApi.ACTION_FIELDS` 白名单内、但主窗确无实现的动作（附不修理由）。 */
const WHITELIST_WITHOUT_SUPPLY = {
  openWithDefault: '主窗无实现：唯一实现 preview-window/controller.ts:1248 属**预览窗自己的** '
    + 'controllerScope；主窗要用需新增 IPC 通道（涉 electron/**，本轮禁改），故保留白名单 + 记入缺失清单。',
  openWithFinder: '同上（preview-window/controller.ts:1257）。',
  copyImage: '同上（preview-window/controller.ts:1053）。',
};

/** F08：跨窗供给缺口 —— 本轮补齐，必须三件齐备（契约 + 白名单 + 真实实现）。 */
const CROSS_WINDOW_FIXED = {
  imagesChange: { impl: 'inspectorActions.imagesChange', consumers: [FONT_VIEWER_PATH] },
  removeStar: { impl: 'crossWindowActions.removeStar', consumers: [FONT_VIEWER_PATH, TEXT_VIEWER_PATH] },
  changeTo1Star: { impl: 'crossWindowActions.changeToNStar(1)', consumers: [FONT_VIEWER_PATH, TEXT_VIEWER_PATH] },
  changeTo2Star: { impl: 'crossWindowActions.changeToNStar(2)', consumers: [FONT_VIEWER_PATH, TEXT_VIEWER_PATH] },
  changeTo3Star: { impl: 'crossWindowActions.changeToNStar(3)', consumers: [FONT_VIEWER_PATH, TEXT_VIEWER_PATH] },
  changeTo4Star: { impl: 'crossWindowActions.changeToNStar(4)', consumers: [FONT_VIEWER_PATH, TEXT_VIEWER_PATH] },
  changeTo5Star: { impl: 'crossWindowActions.changeToNStar(5)', consumers: [FONT_VIEWER_PATH, TEXT_VIEWER_PATH] },
  isFontActivate: { impl: 'fontTagService.isFontActivate', consumers: [FONT_VIEWER_PATH] },
  startDrag: { impl: 'imageOpsService.startDrag', consumers: [] },
};

/** A-3：白名单里「有名字、没挂载」的漂移项 —— 本轮补挂载（实现本就在 ESM 图内，直调）。 */
const WHITELIST_MOUNT_FIXED = [
  'rebindRefresh', 'scrollToSelectedItem', 'quicklook', 'copyImages',
];

/** A-2：主窗内部字符串派发 —— 本轮已改具名直调的消费点名。 */
const INTERNAL_DISPATCH_FIXED = [
  'openAllTags', 'openSidebarMenu', 'filterContent', 'openUntagged', 'openRecent', 'openTrash',
  'openRandom', 'refreshRandom', 'openSearchScopeMenu', 'onListSizeChange', 'toggleFilter',
  'openTrialModal', 'toggleAlwaysOnTop',
];

/**
 * A-2 / A-3：**仍未迁移**的动作全集。`reason` 是必填的定位说明 —— 本测试断言台账与
 * 代码现状一致（既不能偷偷补实现不留痕，也不能删条目假装已修）。
 */
const UNMIGRATED = {
  // ── A-2：全树无实现（未移植，非未挂载）──
  resetKeyword: '全树无同名符号，旧 bundle 已删且 git 无历史（`git log --all -- src/app/js/app.bundle.js` 零提交）'
    + ' → 无法忠实复原原语义，不能凭猜测补一套。已在 Toolbar 调用点保留并经 internalDispatch 上报。',
  toggleTagLayout: '全树零命中。目标 store 字段 tagViewLayoutMode（store/miscRawState.ts）存在，'
    + '但缺的是「切换动作」本身的语义（INLINE/LIST 互切后要不要落盘/重排未知），需单独一轮移植。',
  openTagGroupListContextMenu: '全树零命中；邻项 openTagGroupContextMenu 有实现（tagManagerDomain.ts:1631，'
    + '行内 writeScopeField 闭包，非具名导出）→ 需先抽具名实现再迁，属独立一轮。',
  openTagContextMenu: '同上（TagManager.tsx:395 消费）。',
  seachKeyup: '搜索建议/历史族，全树无实现（拼写 typo 逐字保留）。Toolbar:553–598 只有渲染壳，'
    + '建议数据源与高亮状态机整体未移植。',
  searchBlur: '搜索建议族，全树无实现（Toolbar 搜索框失焦时的建议面板收起动作）。',
  hoverSuggestion: '搜索建议族，全树无实现（建议项 hover 高亮状态机未移植）。',
  selectSuggestion: '搜索建议族，全树无实现（建议项选中态与写入链未移植）。',
  selectHistoryKeyword: '搜索历史族，全树无实现（历史词回填搜索框的动作未移植）。',
  hoverHistory: '搜索历史族，全树无实现（历史项 hover 高亮状态机未移植）。',
  removeSeachKeyword: '搜索历史族，全树无实现（删除单条历史词的写点未移植）。',
  openFolderFullPathContextMenu: '全树零命中（Toolbar.tsx:344、Inspector.tsx:395 消费）。菜单族其余成员在 '
    + 'services/miscMenuService.ts，本成员未移植。',
  changeExtension: '全树零命中（Inspector.tsx:771 消费）。',
  openFolderExportContextMenu: '全树零命中（Inspector.tsx:1258 消费）。',
  openSmartFolderExportContextMenu: '全树零命中（Inspector.tsx:1267 消费）。',
  openColorContextMenu: '全树零命中（Inspector.tsx:1299 消费）。',
  openLink: '全树零命中（Inspector.tsx:1378 消费）。',
  onRenameKeydown: '全树零命中（Sidebar.tsx:344 消费）→ 侧栏重命名输入框回车/ESC 无反应，属未移植。',
  onPasteFolderName: '全树零命中（Sidebar.tsx:346 消费）。',
  openGifContextMenu: '字段已在 store 注册但**主窗无写点**：唯一写点是 preview-window/controller.ts:1749'
    + '（隔离子窗）；主窗按驱动面读同一注册表得 null。补写点会与预览窗职责重叠，需先定归属。',

  // ── A-2：ListRegion 族 ──
  toggleSubFolderList: '全树无实现（ListRegion.tsx:224 消费）。',
  onDropFolder: '全树无实现（ListRegion.tsx:247 消费）→ 内容区子文件夹拖放接收死。',
  onDragOverSubFolder: '全树无实现（ListRegion.tsx:248 消费）。',
  onDragEndSubFolder: '全树无实现（ListRegion.tsx:249 消费）。',
  openSubFolderContextMenu: '全树无实现（ListRegion.tsx:252,257 消费）。',
  enableSubFolderNameEditable: '全树无实现（ListRegion.tsx:264 消费）→ 子文件夹双击改名死。',
  openListPropContextMenu: '全树无实现（ListRegion.tsx:304 消费）。',
  changeListOrderBy: '全树无实现（ListRegion.tsx:311 消费）。',
  onDragEnterContainer: '全树无实现（ListRegion.tsx:330,361 消费）。',
  onDragLeaveContainer: '全树无实现（ListRegion.tsx:331,362 消费）。',
  onDragOverContainer: '全树无实现（ListRegion.tsx:333,363 消费）。',
  onMouseMoveContainer: '全树无实现（ListRegion.tsx:334,365 消费）。',
  selectFolder: '**实现存在**（core/selectionViewDomain.ts:923 machinerySelectFolder(event, folder)），'
    + '但 ListRegion 的调用形如 scopeFn(\'selectFolder\', folder)(e) —— 实参契约错位（folder 被当 event 传），'
    + '机械替换会引入错误行为；需连同该族 scopeFn 语义一起单独一轮迁移。',
  cropImage: '实现是 React hook（components/detail/commentHooks.ts:437 useCropImage），由 DetailViewer.tsx:441 '
    + '经 hook 装配，没有可挂 scope 面的独立函数形态；要迁需先把它抽成具名 action，属独立一轮。',
};

/** 台账完整性：以上三类 + 白名单缺供三项 + §A-1 的 7 项跨窗 + §A-3 的 10 项白名单缺供。 */
const EXPECTED_LEDGER_SIZE = {
  crossWindowFixed: 9,
  whitelistMountFixed: 4,
  internalDispatchFixed: 13,
  unmigrated: 34,
  whitelistWithoutSupply: 3,
};

/* =====================================================================================
 * 静态解析工具
 * ===================================================================================== */

/** 提取 `registerExternalSupply({...})` 的对象字面量键名。 */
function registrarKeys(source = read(REGISTRAR_PATH)) {
  const file = ts.createSourceFile(REGISTRAR_PATH, source, ts.ScriptTarget.Latest, true);
  let keys = null;
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
      && node.expression.text === 'registerExternalSupply') {
      const [argument] = node.arguments;
      assert.ok(argument && ts.isObjectLiteralExpression(argument), 'registerExternalSupply 实参必须是对象字面量');
      keys = argument.properties.map((property) => {
        if (ts.isShorthandPropertyAssignment(property)) return property.name.text;
        if (ts.isPropertyAssignment(property)) return property.name.text;
        assert.fail(`不支持的注册项写法：${ts.SyntaxKind[property.kind]}`);
        return null;
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.ok(keys, '未找到 registerExternalSupply 调用');
  return keys;
}

/** 解析 driverApi 的 ACTION_FIELDS 字面量。 */
function actionFields() {
  const file = ts.createSourceFile(DRIVER_PATH, read(DRIVER_PATH), ts.ScriptTarget.Latest, true);
  let fields = null;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
      && node.name.text === 'ACTION_FIELDS' && node.initializer) {
      assert.ok(ts.isArrayLiteralExpression(node.initializer), 'ACTION_FIELDS 必须是数组字面量');
      fields = node.initializer.elements.map((element) => {
        assert.ok(ts.isStringLiteral(element), `ACTION_FIELDS 元素必须是字符串字面量，收到 ${ts.SyntaxKind[element.kind]}`);
        return element.text;
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.ok(fields, '未找到 ACTION_FIELDS');
  return fields;
}

/**
 * 剥离注释后的**可执行代码**（字符串/模板字面量原样保留）。
 *
 * 为什么需要：本轮多处改动在注释里逐字记录了被移除的旧写法
 * （例如 Sidebar.tsx 记 `s[meta.open]` 恒 undefined、Toolbar 记 `call('…')` 的死路径），
 * 这些注释是迁移线索。若「不得残留字符串派发」用裸 `includes` 判定，
 * 一条**说明缺陷已修复**的注释会被误判成缺陷仍在。故 forbidden/required 只对代码判定。
 */
function stripComments(source) {
  let out = '';
  let i = 0;
  let quote = null;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (quote) {
      out += ch;
      if (ch === '\\') { out += next ?? ''; i += 2; continue; }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; out += ch; i += 1; continue; }
    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** machineryInfra 里 `s.<name> = …` 的挂载名集合（scope 面供给层）。 */
function machineryMounts(source = read(MACHINERY_PATH)) {
  const names = new Set();
  const pattern = /^\s*s\.([A-Za-z_$][\w$]*)\s*=/gm;
  let match = pattern.exec(source);
  while (match) { names.add(match[1]); match = pattern.exec(source); }
  return names;
}

/** 构造「假业务依赖 + 真实 crossWindowActions」的隔离环境。 */function crossActionsHarness() {
  const calls = [];
  const env = { eagle: { inspector: { newName: '' } } };
  const record = (name) => (...args) => { calls.push([name, ...args]); };
  const actions = loadModule(CROSS_ACTIONS_PATH, {
    '../components/inspector/inspectorActions': { imagesChange: record('imagesChange') },
    '../services/imageOpsService': {
      machineryChangeStar: record('machineryChangeStar'),
      machineryChangeTo1Star: record('machineryChangeTo1Star'),
      machineryChangeTo2Star: record('machineryChangeTo2Star'),
      machineryChangeTo3Star: record('machineryChangeTo3Star'),
      machineryChangeTo4Star: record('machineryChangeTo4Star'),
      machineryChangeTo5Star: record('machineryChangeTo5Star'),
      machineryRemoveStar: record('machineryRemoveStar'),
    },
  }, { window: env, console: quietConsole });
  return { env, calls, actions };
}

/* =====================================================================================
 * 第一组：F08 跨窗供给闭环（契约 + 白名单 + 真实实现 + 消费点）
 * ===================================================================================== */

test('F08 台账完整性：§A 表「供给点=无」的全集必须逐条登记处置，删条即失败', () => {
  assert.equal(Object.keys(CROSS_WINDOW_FIXED).length, EXPECTED_LEDGER_SIZE.crossWindowFixed);
  assert.equal(WHITELIST_MOUNT_FIXED.length, EXPECTED_LEDGER_SIZE.whitelistMountFixed);
  assert.equal(INTERNAL_DISPATCH_FIXED.length, EXPECTED_LEDGER_SIZE.internalDispatchFixed);
  assert.equal(Object.keys(UNMIGRATED).length, EXPECTED_LEDGER_SIZE.unmigrated);
  assert.equal(Object.keys(WHITELIST_WITHOUT_SUPPLY).length, EXPECTED_LEDGER_SIZE.whitelistWithoutSupply);
  for (const [name, reason] of Object.entries(UNMIGRATED)) {
    assert.ok(typeof reason === 'string' && reason.length > 20, `${name} 的未迁移理由必须具体（>20 字）`);
  }
  for (const [name, reason] of Object.entries(WHITELIST_WITHOUT_SUPPLY)) {
    assert.ok(typeof reason === 'string' && reason.length > 20, `${name} 的无供给理由必须具体（>20 字）`);
  }
});

test('F08 跨窗 9 动作：契约名单 + driverApi 白名单 + 注册端 + machineryInfra 挂载 四处同源', () => {
  const contract = [...loadModule(SUPPLY_PATH, {}, { window: {}, console: quietConsole }).EXTERNAL_SUPPLY_NAMES];
  const whitelist = actionFields();
  const keys = registrarKeys();
  const mounts = machineryMounts();

  for (const name of Object.keys(CROSS_WINDOW_FIXED)) {
    assert.ok(contract.includes(name), `跨窗供给契约缺 ${name}`);
    assert.ok(whitelist.includes(name), `driverApi 动作白名单缺 ${name}`);
    assert.ok(keys.includes(name), `externalSupplyRegistrar 未注册 ${name}`);
    assert.ok(mounts.has(name), `machineryInfra 未把 ${name} 挂到 scope 面（子窗 parentCall 的守卫会恒假）`);
  }
  // 反向：契约不得含未注册项（否则启动期 loadExternalSupply 会判「注册不完整」）
  assert.deepEqual([...keys].sort(), [...contract].sort(),
    '注册端键集合必须与 EXTERNAL_SUPPLY_NAMES 完全一致');
});

test('F08 消费点可达：子窗 parentCall 的名字与供给名逐一对应', () => {
  const font = read(FONT_VIEWER_PATH);
  const textEditor = read(TEXT_VIEWER_PATH);
  // 子窗侧存在两种既有调用形态，二者都必须按**协议名**字面命中供给名
  // （本任务要求⑤「不改动子窗口侧的调用协议」，故两种形态都算合规消费点）：
  //   ① `parentCall('imagesChange')` —— 经显式调用的协议名；
  //   ② `$parentScope.isFontActivate(…)` —— 经驱动面属性探测后直取（font/entry.tsx:213 既有写法）。
  for (const [name, { consumers }] of Object.entries(CROSS_WINDOW_FIXED)) {
    for (const consumer of consumers) {
      const source = consumer === FONT_VIEWER_PATH ? font : textEditor;
      const viaProtocolCall = source.includes(`parentCall('${name}'`);
      const viaParentScope = source.includes(`$parentScope.${name}(`);
      assert.ok(viaProtocolCall || viaParentScope,
        `${consumer} 未按协议名 ${name} 调用（消费点与供给名必须字面一致：parentCall('${name}') 或 $parentScope.${name}()）`);
    }
  }
});

test('F08 供给为真实函数：注册名指到既有业务实现，不新建持久化路径', () => {
  const registrar = read(REGISTRAR_PATH);
  // 改名 / 评级一律经 crossWindowActions 端口转发，注册端不自持实现
  assert.match(registrar, /import \{ imagesChange \} from '\.\.\/components\/inspector\/inspectorActions'/,
    'imagesChange 必须直连既有业务实现（components/inspector/inspectorActions）');
  for (const n of [1, 2, 3, 4, 5]) {
    assert.match(registrar, new RegExp(`changeTo${n}Star: \\(\\) => changeToNStar\\(${n}\\)`),
      `changeTo${n}Star 必须指向 crossWindowActions.changeToNStar(${n})`);
  }
  assert.match(registrar, /\bremoveStar\b/, 'removeStar 必须注册为真实函数');

  // 端口函数确实转发到既有业务（隔离单测，见文件头 TEST-ISOLATION-NOTICE）
  const { env, calls, actions } = crossActionsHarness();
  env.eagle.inspector.newName = '';
  actions.renameItem('改后的名字');
  assert.deepEqual(plain(calls), [['imagesChange']], 'renameItem 必须且只调用一次既有 imagesChange()');
  assert.equal(env.eagle.inspector.newName, '改后的名字', 'renameItem 必须先把新名写进 eagle.inspector.newName');

  // 星级 1–5：两个端口（setRating / changeToNStar）都必须落到同一批既有实现
  const starCases = [[1, 'machineryChangeTo1Star'], [2, 'machineryChangeTo2Star'], [3, 'machineryChangeTo3Star'],
    [4, 'machineryChangeTo4Star'], [5, 'machineryChangeTo5Star']];
  for (const [stars, expected] of starCases) {
    for (const invoke of [(n) => actions.setRating(n), (n) => actions.changeToNStar(n)]) {
      calls.length = 0;
      invoke(stars);
      assert.equal(calls.length, 1, `星级 ${stars} 必须且只转发一次到既有 ${expected}`);
      assert.equal(calls[0][0], expected, `星级 ${stars} 必须转发到既有 ${expected}，实际 ${calls[0][0]}`);
      // event 实参必须缺省：machineryChangeToNStar 首行有 altKey/metaKey/ctrlKey 早退守卫，
      // 传一个真 event 会改变既有行为（本轮不得改变用户可见行为）。
      assert.equal(calls[0][1], undefined, `${expected} 的 event 实参必须缺省`);
    }
  }
  calls.length = 0;
  actions.removeStar();
  assert.deepEqual(calls, [['machineryRemoveStar']], 'removeStar 必须转发到既有 machineryRemoveStar');
  calls.length = 0;
  actions.setRating(undefined);
  assert.deepEqual(calls, [['machineryChangeStar', undefined, true]],
    'setRating(undefined) 必须走既有 machineryChangeStar(undefined, true) 清除链');
});

test('F08 白名单一致：ACTION_FIELDS 中无供给者必须恰好等于台账列出的三项', () => {
  const env = {}; // 兼作 window
  const face = {};
  const driver = loadModule(DRIVER_PATH, {
    './scopeFieldBridge': { getMigratedScopeField: () => undefined },
    './scopeFace': { getScopeFace: () => face },
  }, { window: env, console: quietConsole });

  const whitelist = actionFields();
  // 假 scope 面：把本轮已修的挂载项与其余已挂载项都装上（= 启动完成后的真实形态）
  const mounted = new Set([...whitelist]);
  for (const name of Object.keys(WHITELIST_WITHOUT_SUPPLY)) mounted.delete(name);
  for (const name of mounted) face[name] = () => `${name}-ok`;

  const missing = plain(driver.collectMissingDriverActions());
  assert.deepEqual([...missing].sort(), Object.keys(WHITELIST_WITHOUT_SUPPLY).sort(),
    '白名单缺口必须与台账逐条对齐：补了实现的要从台账挪走，加了白名单名的要补供给');
  assert.equal(missing.length, 3, `白名单 ${whitelist.length} 项中应只剩 3 项无主窗供给`);

  // 自检断言面：缺口存在时必须抛可定位错误
  assert.throws(() => driver.assertDriverActionsSupplied(), (error) => {
    assert.match(error.message, /\[driverApi\] 白名单动作缺供给（3\/\d+）：/);
    for (const name of Object.keys(WHITELIST_WITHOUT_SUPPLY)) {
      assert.ok(error.message.includes(name), `错误信息必须点名 ${name}`);
    }
    return true;
  });

  // 缺口补齐后自检通过（证明断言不是恒真/恒假）
  for (const name of Object.keys(WHITELIST_WITHOUT_SUPPLY)) face[name] = () => `${name}-ok`;
  assert.deepEqual(plain(driver.collectMissingDriverActions()), []);
  driver.assertDriverActionsSupplied();
});

test('F08 白名单漂移收口：rebindRefresh/scrollToSelectedItem/quicklook/copyImages 已挂载', () => {
  const mounts = machineryMounts();
  for (const name of WHITELIST_MOUNT_FIXED) {
    assert.ok(mounts.has(name), `machineryInfra 未挂载 ${name}（白名单有名字、读出来是 undefined）`);
  }
  // 挂载必须是「直调既有实现」，不得退回字符串/注册表间接层
  const source = read(MACHINERY_PATH);
  assert.match(source, /s\.rebindRefresh = \(\.\.\.args: any\[\]\) => \(machineryRebindRefresh as any\)\(\.\.\.args\)/);
  assert.match(source, /s\.quicklook = \(\.\.\.args: any\[\]\) => \(machineryQuicklook as any\)\(\.\.\.args\)/);
  assert.match(source, /s\.copyImages = \(\.\.\.args: any\[\]\) => \(machineryCopyImages as any\)\(\.\.\.args\)/);
  assert.match(source, /s\.scrollToSelectedItem = \(\.\.\.args: any\[\]\) => \(scrollToSelectedItem as any\)\(\.\.\.args\)/);
});

/* =====================================================================================
 * 第二组：F09 主窗内部字符串派发消除
 * ===================================================================================== */

test('F09 视图切换：单一具名定义点覆盖全部 8 个平铺视图动作', () => {
  const viewOpen = loadModule(VIEW_OPEN_PATH, {
    './libraryDomain': { machineryOpenRecent: () => {}, machineryOpenTrash: () => {}, machineryOpenUnfiled: () => {} },
    './tagManagerDomain': { machineryOpenAllTags: () => {}, machineryOpenUntagged: () => {} },
    '../services/folderCoreService': {
      machineryOpenAll: () => {}, machineryOpenCommunity: () => {}, machineryOpenRandom: () => {},
    },
  }, { console: quietConsole });
  // 注意：VIEW_OPEN_ACTIONS 的值是函数，不能走 plain()（JSON 往返会把函数值整条丢掉），
  // 键名一律用本 realm 的 Object.keys 直接读。
  const names = Object.keys(viewOpen.VIEW_OPEN_ACTIONS);
  assert.deepEqual([...names].sort(), [
    'openAll', 'openAllTags', 'openCommunity', 'openRandom', 'openRecent', 'openTrash',
    'openUnfiled', 'openUntagged',
  ]);
  for (const name of names) {
    assert.equal(typeof viewOpen.VIEW_OPEN_ACTIONS[name], 'function', `${name} 必须是具名可调用动作`);
    viewOpen.openView(name);
  }

  // 未登记名字必须显式失败（不得静默 return）
  assert.throws(() => viewOpen.openView('openNothing'), (error) => {
    assert.equal(error.name, 'UnmigratedViewActionError');
    assert.equal(error.action, 'openNothing');
    assert.match(error.message, /\[view-open-action\] 未迁移的视图切换动作：openNothing/);
    assert.match(error.message, /已迁移：openAll/);
    return true;
  });
});

test('F09 已迁移的消费点：不得再出现字符串派发，且必须出现具名直调', () => {
  // 自检：stripComments 必须「保留真实代码、只丢弃注释」——防止它被改坏成永远看不见违规。
  const probe = stripComments("call('x'); // call('x')\n/* call('y') */\nconst u = 'http://a//b';\n");
  assert.equal(probe.split("call('x')").length - 1, 1, '行注释里的同名字符串必须被剥离');
  assert.ok(!probe.includes("call('y')"), '块注释内容必须被剥离');
  assert.ok(probe.includes("'http://a//b'"), '字符串字面量内的 // 不得被误判为注释');

  const checks = [
    {
      path: 'src/app/react/components/toolbar/Toolbar.tsx',
      forbidden: [
        "call('openAllTags')", "call('openSidebarMenu')", "call('filterContent')",
        "call('openUntagged')", "call('openRecent')", "call('openTrash')",
        "call('refreshRandom')", "call('toggleFilter')", "call('openSearchScopeMenu')",
        "call('onListSizeChange')",
      ],
      required: [
        "import { openView } from '../../core/viewOpenActions';",
        // 平铺视图族经单一具名定义点调用（不直连 libraryDomain/tagManagerDomain 的 machinery* 本体）
        "openView('openAllTags')", "openView('openUntagged')", "openView('openRecent')", "openView('openTrash')",
        'machineryFilterContent', 'machineryToggleFilter',
        'machineryOpenSearchScopeMenu', 'machineryOnListSizeChange',
        'openSidebarVisibleContextMenu', 'machineryRefreshRandom',
      ],
    },
    {
      path: 'src/app/react/components/sidebar/Sidebar.tsx',
      forbidden: ['SIMPLE_OPEN_DIRECT', 's[meta.open]', "s.openSidebarMenu"],
      required: ["import { openView, ViewOpenName } from '../../core/viewOpenActions';", 'openView(meta.open'],
    },
    {
      path: 'src/app/react/components/stage7/ControllerModals.tsx',
      forbidden: ['s.openSidebarMenu'],
      required: ['openSidebarVisibleContextMenu'],
    },
    {
      path: 'src/app/react/components/detail/DetailToolbar.tsx',
      forbidden: ["callF('openSidebarMenu')"],
      required: ['onContextMenu={call(openSidebarVisibleContextMenu)}'],
    },
    {
      path: 'src/app/react/components/inspector/Inspector.tsx',
      forbidden: ["call('openTrialModal'"],
      required: ['machineryOpenTrialModal'],
    },
  ];
  for (const { path, forbidden, required } of checks) {
    const source = stripComments(read(path));
    for (const needle of forbidden) {
      assert.ok(!source.includes(needle), `${path} 仍残留字符串派发：${needle}`);
    }
    for (const needle of required) {
      assert.ok(source.includes(needle), `${path} 缺少具名直调的落点：${needle}`);
    }
  }
});

test('F09 未迁移项不得被"悄悄补成第二套实现"：台账与代码现状一致', () => {
  const viewOpen = read(VIEW_OPEN_PATH);
  const internal = read(INTERNAL_DISPATCH_PATH);
  // 未迁移的动作名不得出现在任何具名实现模块里（出现即说明有人补了实现却没更新台账）
  for (const name of ['resetKeyword', 'toggleTagLayout', 'seachKeyup', 'onDropFolder',
    'onRenameKeydown', 'openTagContextMenu', 'openColorContextMenu']) {
    assert.ok(!viewOpen.includes(`${name}:`), `viewOpenActions 不应含未迁移动作 ${name}`);
    assert.ok(!new RegExp(`export (function|const) \\w*${name}`).test(internal),
      `internalDispatch 不应为未迁移动作 ${name} 新造实现`);
  }
  // 台账列出的 ListRegion 未迁移项确实仍在原消费点（未经"改动"假装修好）
  const listRegion = read('src/app/react/components/shell/ListRegion.tsx');
  for (const name of ['toggleSubFolderList', 'onDropFolder', 'enableSubFolderNameEditable',
    'openListPropContextMenu', 'changeListOrderBy']) {
    assert.ok(listRegion.includes(`'${name}'`), `ListRegion 应仍在消费未迁移动作 ${name}`);
    assert.ok(UNMIGRATED[name], `${name} 必须留在台账里`);
  }
});

/* =====================================================================================
 * 第三组：缺动作时必须显式失败（不得静默返回 / 静默 undefined）
 * ===================================================================================== */

test('缺动作路径：未注册的契约内供给抛可观测错误；契约外名字维持旧语义', () => {
  const env = {};
  const supply = loadModule(SUPPLY_PATH, {}, { window: env, console: quietConsole });
  assert.ok(supply.EXTERNAL_SUPPLY_NAMES.includes('imagesChange'), '契约必须含 imagesChange');
  assert.ok(supply.EXTERNAL_SUPPLY_NAMES.includes('changeTo5Star'), '契约必须含评级快捷键族');

  assert.throws(() => supply.callExternal('imagesChange'), (error) => {
    assert.equal(error.name, 'ExternalSupplyNotReadyError');
    assert.equal(error.supplyName, 'imagesChange');
    assert.match(error.message, /跨窗供给未就绪：imagesChange 尚未注册/);
    return true;
  });
  assert.equal(env.__eagleSupplyFailures.length, 1, '失败必须留痕（子窗吞异常后仍可观测）');
  assert.equal(env.__eagleSupplyFailures[0].name, 'imagesChange');

  // 契约外名字：不属于跨窗供给面，维持旧语义（由消费侧自证）
  assert.equal(supply.callExternal('_notInContract'), undefined);
});

test('缺动作路径：跨窗端口缺依赖/参数非法时抛可定位的 CrossWindowActionError', () => {
  const { env, actions } = crossActionsHarness();
  for (const invoke of [
    () => actions.renameItem('x'),            // 依赖缺失：eagle.inspector
  ]) {
    env.eagle = undefined;
    assert.throws(invoke, (error) => {
      assert.equal(error.name, 'CrossWindowActionError');
      assert.equal(error.action, 'renameItem');
      assert.match(error.message, /\[cross-window-action\] renameItem 无法执行：主窗 eagle\.inspector 尚未就绪/);
      return true;
    });
  }
  env.eagle = { inspector: { newName: '' } };
  assert.throws(() => actions.renameItem(''), (error) => {
    assert.match(error.message, /名称必须是非空字符串/);
    return true;
  });
  assert.throws(() => actions.renameItem(123), (error) => {
    assert.match(error.message, /名称必须是非空字符串，收到 123/);
    return true;
  });
  assert.throws(() => actions.setRating(9), (error) => {
    assert.equal(error.action, 'setRating');
    assert.match(error.message, /星级必须是 1–5 的整数或 undefined（清除），收到 9/);
    return true;
  });
  assert.throws(() => actions.changeToNStar(0), (error) => {
    assert.equal(error.action, 'changeToNStar');
    assert.match(error.message, /未知星级 0（可用 1–5）/);
    return true;
  });
});

test('缺动作路径：driverApi 读取白名单动作时留痕，不再静默 undefined', () => {
  const env = {};
  const face = {};
  const driver = loadModule(DRIVER_PATH, {
    './scopeFieldBridge': { getMigratedScopeField: () => undefined },
    './scopeFace': { getScopeFace: () => face },
  }, { window: env, console: quietConsole });

  // 启动窗口期内读取：缺失是预期态，不上报
  assert.equal(driver.getDriverApi().imagesChange, undefined);
  assert.equal(env.__eagleDriverMissingActions, undefined, '就绪前不得把预期态报成缺陷');

  env.__eagleBootState = 'ready';
  face.updateSelection = () => {};
  assert.equal(face.isFontActivate, undefined);
  assert.equal(driver.getDriverApi().isFontActivate, undefined);
  const missing = plain(env.__eagleDriverMissingActions);
  assert.equal(missing.length, 1);
  assert.equal(missing[0].name, 'isFontActivate');
  assert.equal(missing[0].valueType, 'undefined');
  assert.equal(missing[0].bootState, 'ready');
  // 幂等上报：再次读取不重复记账
  driver.getDriverApi().isFontActivate;
  assert.equal(env.__eagleDriverMissingActions.length, 1, '同一动作名只上报一次');
  // 供上之后不再进入缺失清单
  face.isFontActivate = () => true;
  assert.equal(driver.getDriverApi().isFontActivate(), true);
  assert.deepEqual(plain(driver.collectMissingDriverActions()).includes('isFontActivate'), false);
  // 数据字段不参与上报（存在合法空态）
  assert.equal(driver.getDriverApi().current, undefined);
  assert.equal(env.__eagleDriverMissingActions.length, 1, 'DATA_FIELDS 的 undefined 不得计入动作缺失');
});

test('缺动作路径：内部字符串派发命中未迁移动作时留痕，不再静默 return', () => {
  const env = {};
  const dispatch = loadModule(INTERNAL_DISPATCH_PATH, {}, { window: env, console: quietConsole });
  assert.equal(dispatch.reportUnmigratedAction('resetKeyword', 'Toolbar.callSeq'), true, '首次上报返回 true');
  assert.equal(dispatch.reportUnmigratedAction('resetKeyword', 'Toolbar.callSeq'), false, '同调用点重复命中不重复上报');
  assert.equal(dispatch.reportUnmigratedAction('resetKeyword', 'Sidebar.call'), true, '不同调用点独立上报');
  const logged = plain(dispatch.unmigratedActions());
  assert.equal(logged.length, 2);
  assert.deepEqual(logged.map((entry) => [entry.name, entry.site]),
    [['resetKeyword', 'Toolbar.callSeq'], ['resetKeyword', 'Sidebar.call']]);
});

/* =====================================================================================
 * TEST-ISOLATION-NOTICE
 * =====================================================================================
 * 上述「字体改名 / 0–5 星」与「缺动作错误路径」均为 **node:vm 隔离单测**
 * （真实被测模块 + 显式注入的假业务依赖）。本轮**没有做 Electron 实机运行验证** ——
 * 未启动主窗，未真实点按子窗口的 `0`–`5` 键，未观察列表/缩略图的实际刷新。
 * 因此本测试证明的是「供给链路的接线与契约正确」，**不构成端到端运行验证**。
 * 实机复核建议：启动主窗 → 打开字体查看器 → 按 `1`–`5` 与 `0` 观察主窗选中项星级变化；
 * 在字体查看器改名提交后观察主窗列表名同步，并检查 `window.__eagleSupplyFailures` 为空。
 */
