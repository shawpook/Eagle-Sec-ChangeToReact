/**
 * M3-3 —— 经典 Worker「自有协议」的**双向字面量契约测试**。
 *
 * ## 它解决什么问题
 * `src/app/react/core/workers/protocol.ts` 是自有协议（信封字段 / 通道名 / 错误文案 /
 * 超时 / 全局名）的唯一事实源。主线程侧能 import 它，**worker 侧不能**——
 * `bitmapWorker.js` / `tifWorker.js` / `calHammingDistance.js` 必须保持经典 script worker
 * （`new Worker(url)`，无 `type: 'module'`），因为 `bitmapWorker.js:393-397`、`:457-462` 与
 * `tifWorker.js:2-6` 用 `importScripts()` 装载第三方 UMD 引擎（libheif.js / UTIF.js / UDOC.js）。
 * 装 TS 编译产物或改成 ESM 都会改变 UMD 的全局安装行为，并让 `tests/dist-entry-check.mjs`
 * 的产物闭包走查**静默**漏掉引擎文件。
 *
 * ## 为什么选「构建期契约测试」而不是「worker 顶部运行时断言」
 * 任务给了两条路，本批选前者的理由：
 *  - worker 本体（尤其 `bitmapWorker.js`，1500 行）是**高频执行**的热路径，每次冷启动都跑一遍
 *    自检属于把 CI 的活摊到用户机器上；
 *  - 运行时断言只能自证「我认识的常量没变」，管不住**逆向**（worker 新增了通道名 / 改了错误
 *    文案而 protocol.ts 没跟上）——那正是最容易出的漂移；
 *  - 契约测试能同时管两个方向（见下），且不向第三方引擎宿主文件里注入任何我方代码。
 * **代价**（明写）：漂移在 `node tests/worker-protocol-contract.mjs` 变红时才被发现，而不是
 * 在运行时；因此该测试**必须**挂在验收链路上，否则契约形同虚设。
 *
 * ## 双向是什么意思
 * 每个协议面都同时断言：
 *  - **正向**：protocol.ts 声明的每个常量/字段，worker 源码里**真的**逐字出现；
 *  - **逆向**：worker 源码里出现的每个同类字面量，都**已被** protocol.ts 登记。
 * 逆向那半才是漂移防线：worker 侧单方面改名，正向会过、逆向必红。
 * 断言不写死拷贝：接口字段名从 protocol.ts 的 AST 现读，常量值从转译后的运行期对象现读，
 * 所以「改一端忘另一端」永远以字面量不等的形式暴露，而不是以「测试里也手抄了一份旧值」的形式。
 *
 * ## 局限（明写）
 *  - 这是**静态**契约：只证明两端字面量一致，不证明运行期消息真的按这个信封收发；
 *  - 真正跑通位图/HEIC/TIF 解码的端到端验证不在本文件范围内。
 *
 * 运行：node tests/worker-protocol-contract.mjs
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const ROOT = new URL('..', import.meta.url);
const PROTOCOL_REL = 'src/app/react/core/workers/protocol.ts';
const WORKERS_DIR_REL = 'src/app/js/workers';
const REACT_DIR_REL = 'src/app/react';

/**
 * 参与自有协议的 worker（都必须带 `@protocol-version` 头）。
 * 逆向检查：本目录下任何 `.js` 要么在此列，要么在下面的第三方白名单里——新增 worker
 * 不登记就直接红，逼一次「它是不是自有协议的一部分」的判断。
 */
const FIRST_PARTY_WORKERS = [
  'src/app/js/workers/bitmapWorker.js',
  'src/app/js/workers/tifWorker.js',
  'src/app/js/workers/calHammingDistance.js',
  'src/app/js/workers/heic2bitmap-worker.js',
];

/** 第三方引擎宿主文件：不加我方契约头（也不得改动）。 */
const THIRD_PARTY_WORKERS = ['src/app/js/workers/libheif.js'];

const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8');

/* ================================================================ */
/* protocol.ts：运行期常量 + 类型面（接口字段名 / 类型别名形参名）      */
/* ================================================================ */

function loadProtocolConstants() {
  const { outputText, diagnostics } = ts.transpileModule(read(PROTOCOL_REL), {
    fileName: PROTOCOL_REL,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  assert.equal(diagnostics.length, 0, `${PROTOCOL_REL} 转译应无诊断`);
  const exports = {};
  vm.runInNewContext(outputText, { exports, module: { exports } }, { filename: PROTOCOL_REL });
  return exports;
}

function loadProtocolTypes() {
  const source = ts.createSourceFile(PROTOCOL_REL, read(PROTOCOL_REL), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const interfaces = new Map();
  const functionTypeParams = new Map();
  const walk = (node) => {
    if (ts.isInterfaceDeclaration(node)) {
      interfaces.set(node.name.text, node.members.map((member) => member.name.getText()));
    }
    if (ts.isTypeAliasDeclaration(node) && ts.isFunctionTypeNode(node.type)) {
      functionTypeParams.set(node.name.text, node.type.parameters.map((parameter) => parameter.name.getText()));
    }
    node.forEachChild(walk);
  };
  walk(source);
  return { interfaces, functionTypeParams };
}

const constants = loadProtocolConstants();
const { interfaces, functionTypeParams } = loadProtocolTypes();

/** 从 protocol.ts 现读接口字段名——绝不在本文件里手抄一份。 */
function fieldsOf(interfaceName) {
  const fields = interfaces.get(interfaceName);
  assert.ok(fields, `${PROTOCOL_REL} 应声明接口 ${interfaceName}`);
  return [...fields].sort();
}

const sortedValues = (record) => Object.values(record).sort();

/* ================================================================ */
/* worker 源码的 AST 事实提取                                        */
/* ================================================================ */

function analyzeWorker(rel) {
  const source = ts.createSourceFile(rel, read(rel), ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const facts = {
    strings: new Set(),
    /** `self.<name> = ...` 左值名（协议标志、全局函数安装点）。 */
    selfAssigned: new Set(),
    /** `self.<name> = (a, b) => ...` 的形参名表。 */
    selfFunctionParams: new Map(),
    /** 每条 `postMessage({...})` 的键（已排序）。 */
    postMessageKeyGroups: [],
    /** `postMessage({ error: '...' })` 的文案。 */
    postMessageErrorLiterals: [],
    /** `postMessage({ type: '...' })` 的信封判别式。 */
    postMessageTypeLiterals: [],
    /** `const { ... } = <...>.data` 的解构键（已排序）。 */
    dataDestructures: [],
    /** `<target>.push({...})` 的键（已排序）。 */
    pushKeyGroups: [],
    /** `resolve({...})` 的键（已排序）。 */
    resolveKeyGroups: [],
    /** `item.<prop>` 读取的属性名。 */
    itemPropertyReads: new Set(),
    /** `setTimeout(fn, <n>)` 的延时毫秒数。 */
    setTimeoutDelays: new Set(),
  };

  const walk = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) facts.strings.add(node.text);

    if (
      ts.isPropertyAccessExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === 'item'
    ) {
      facts.itemPropertyReads.add(node.name.getText());
    }

    if (
      ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isPropertyAccessExpression(node.left)
      && ts.isIdentifier(node.left.expression)
      && node.left.expression.text === 'self'
    ) {
      const name = node.left.name.getText();
      facts.selfAssigned.add(name);
      if (ts.isArrowFunction(node.right) || ts.isFunctionExpression(node.right)) {
        facts.selfFunctionParams.set(name, node.right.parameters.map((parameter) => parameter.name.getText()));
      }
    }

    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer) {
      if (/(?:^|\.)data$/.test(node.initializer.getText())) {
        facts.dataDestructures.push(node.name.elements.map((element) => element.name.getText()).sort());
      }
    }

    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const calleeName = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee) ? callee.name.getText() : '';
      const first = node.arguments[0];
      const objectArgument = first && ts.isObjectLiteralExpression(first) ? first : null;
      const keysOf = (literal) => literal.properties.map((property) => property.name.getText()).sort();

      if (calleeName === 'postMessage' && objectArgument) {
        facts.postMessageKeyGroups.push(keysOf(objectArgument));
        for (const property of objectArgument.properties) {
          if (!ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.initializer)) continue;
          const key = property.name.getText();
          if (key === 'error') facts.postMessageErrorLiterals.push(property.initializer.text);
          if (key === 'type') facts.postMessageTypeLiterals.push(property.initializer.text);
        }
      }
      if (calleeName === 'push' && objectArgument && ts.isPropertyAccessExpression(callee)) {
        facts.pushKeyGroups.push({ target: callee.expression.getText(), keys: keysOf(objectArgument) });
      }
      if (calleeName === 'resolve' && objectArgument) {
        facts.resolveKeyGroups.push(keysOf(objectArgument));
      }
      if (calleeName === 'setTimeout') {
        const delay = node.arguments[node.arguments.length - 1];
        if (delay && ts.isNumericLiteral(delay)) facts.setTimeoutDelays.add(Number(delay.text));
      }
    }

    node.forEachChild(walk);
  };
  walk(source);
  return facts;
}

const workers = new Map(FIRST_PARTY_WORKERS.map((rel) => [rel, analyzeWorker(rel)]));
const workerFacts = (rel) => {
  const facts = workers.get(rel);
  assert.ok(facts, `未分析 ${rel}`);
  return facts;
};

/**
 * `postMessage({...})` 里出现过的全部键的并集，**剔除** P2 反向请求的那条信封
 * （`{ type, data }`）——它不属于 P1 的位图三信封。
 */
function postMessageFieldUnion(rel) {
  const union = new Set();
  for (const group of workerFacts(rel).postMessageKeyGroups) {
    if (group.length === 2 && group[0] === 'data' && group[1] === 'type') continue;
    for (const key of group) union.add(key);
  }
  return [...union].sort();
}

/** worker 头部的 `@protocol-version` / `@protocol-module`。 */
function protocolHeader(rel) {
  const text = read(rel);
  const version = text.match(/@protocol-version\s+(\d+)/);
  const module = text.match(/@protocol-module\s+(\S+)/);
  return { version: version ? Number(version[1]) : null, module: module ? module[1] : null };
}

/* ================================================================ */
/* 0. 版本头：新增 worker 必须表态                                    */
/* ================================================================ */

test('M3-3 / 协议契约：每个自有 worker 都声明了与 protocol.ts 一致的协议版本', () => {
  for (const rel of FIRST_PARTY_WORKERS) {
    const header = protocolHeader(rel);
    assert.equal(header.version, constants.WORKER_PROTOCOL_VERSION, `${rel} 的 @protocol-version 应对齐 WORKER_PROTOCOL_VERSION`);
    assert.equal(header.module, PROTOCOL_REL, `${rel} 的 @protocol-module 应指向唯一事实源`);
    assert.ok(existsSync(new URL(PROTOCOL_REL, ROOT)), '@protocol-module 指向的文件应存在');
  }
});

test('M3-3 / 协议契约：workers 目录不出现未表态的脚本（逆向）', () => {
  const directory = new URL(`${WORKERS_DIR_REL}/`, ROOT);
  const scripts = readdirSync(directory)
    .filter((name) => name.endsWith('.js'))
    .map((name) => `${WORKERS_DIR_REL}/${name}`)
    .sort();
  const registered = [...FIRST_PARTY_WORKERS, ...THIRD_PARTY_WORKERS].sort();
  assert.deepEqual(
    scripts, registered,
    '新增/删除 worker 必须显式登记：自有协议 worker 加 @protocol-version 头并进 FIRST_PARTY_WORKERS，'
    + '第三方引擎宿主加进 THIRD_PARTY_WORKERS',
  );
  for (const rel of FIRST_PARTY_WORKERS) assert.ok(statSync(new URL(rel, ROOT)).isFile(), `${rel} 应存在`);
});

/* ================================================================ */
/* P2：原生 HEIC 反向请求——通道名                                     */
/* ================================================================ */

/**
 * worker 里「含下划线的大写常量式字符串」——即通道名族。
 * 之所以加下划线这一条：bitmapWorker 里还有一批**格式**常量是无下划线的大写
 * （IEND / GPS / II / MM / S / W …，PNG 块名与 TIFF 字节序标记），它们不属于消息协议。
 * 这条过滤是**有意**的：只要新增的通道名走 SCREAMING_SNAKE 命名，逆向检查就能抓住它。
 */
function channelFamily(rel) {
  return [...workerFacts(rel).strings]
    .filter((value) => /^[A-Z][A-Z0-9]*_[A-Z0-9_]*$/.test(value))
    .sort();
}

test('M3-3 / 协议契约：P2 原生 HEIC 通道名双向一致', () => {
  const declared = sortedValues(constants.NATIVE_HEIC_CHANNEL);
  const used = channelFamily('src/app/js/workers/bitmapWorker.js');
  assert.deepEqual(used, declared, 'worker 侧出现的每个通道名都必须在 protocol.ts 登记，且每个登记项都必须被 worker 真正用到');

  const bitmap = workerFacts('src/app/js/workers/bitmapWorker.js');
  for (const literal of bitmap.postMessageTypeLiterals) {
    assert.ok(declared.includes(literal), `postMessage 的 type 字面量 ${literal} 未在 NATIVE_HEIC_CHANNEL 登记`);
  }
  assert.deepEqual(
    [...bitmap.postMessageTypeLiterals], [constants.NATIVE_HEIC_CHANNEL.REQUEST],
    'worker 只发出一条 P2 请求',
  );
});

test('M3-3 / 协议契约：P2 可用性标志名与 protocol.ts 一致', () => {
  const bitmap = workerFacts('src/app/js/workers/bitmapWorker.js');
  assert.ok(
    bitmap.selfAssigned.has(constants.NATIVE_HEIC_AVAILABLE_FLAG),
    `bitmapWorker 应在 self.${constants.NATIVE_HEIC_AVAILABLE_FLAG} 上维护可用性标志`,
  );
  const flagLike = [...bitmap.selfAssigned].filter((name) => /[Pp]arser[Aa]vailable/.test(name)).sort();
  assert.deepEqual(flagLike, [constants.NATIVE_HEIC_AVAILABLE_FLAG], '可用性标志只能有一个');
});

/* ================================================================ */
/* P1：bitmapWorker 位图三信封                                        */
/* ================================================================ */

test('M3-3 / 协议契约：P1 响应信封字段与 worker 实际投递逐字一致', () => {
  const rel = 'src/app/js/workers/bitmapWorker.js';
  assert.deepEqual(
    postMessageFieldUnion(rel), fieldsOf('BitmapWorkerResponse'),
    'BitmapWorkerResponse 的字段集必须与 worker 三条 postMessage 实际投递的键集完全一致（双向）',
  );
  const P2_ENVELOPES = workerFacts(rel).postMessageKeyGroups.filter((group) => group.length === 2 && group[0] === 'data' && group[1] === 'type');
  assert.equal(P2_ENVELOPES.length, 1, '除 P1 三信封外只允许一条 { type, data } 的 P2 反向请求');
});

test('M3-3 / 协议契约：P1 请求信封与 worker 解构出的字段一致', () => {
  const bitmap = workerFacts('src/app/js/workers/bitmapWorker.js');
  assert.deepEqual(
    bitmap.dataDestructures.map((group) => group.join(',')).sort(),
    [fieldsOf('BitmapWorkerRequest').join(','), ['data', 'type'].join(',')].sort(),
    'worker 从 e.data 解构出的字段必须与 BitmapWorkerRequest 一致（另一组是 P2 的 { type, data }）',
  );
});

test('M3-3 / 协议契约：P1 条目引用与 tile 字段一致', () => {
  const bitmap = workerFacts('src/app/js/workers/bitmapWorker.js');
  const reads = [...bitmap.itemPropertyReads].sort();
  assert.deepEqual(reads, ['animated', 'ext'], 'worker 只读 item 的这两个面；读到别的字段即协议变更，必须登记进 BitmapWorkerItemRef');
  for (const read of reads) {
    assert.ok(fieldsOf('BitmapWorkerItemRef').includes(read), `item.${read} 未在 BitmapWorkerItemRef 登记`);
  }

  const tileGroups = bitmap.pushKeyGroups.filter((group) => group.target === 'tiles');
  assert.equal(tileGroups.length, 1, 'tile 数组只有一处 push');
  assert.deepEqual(tileGroups[0].keys, fieldsOf('BitmapWorkerTile'), 'BitmapWorkerTile 的字段必须与 tiles.push 的对象键一致');
});

/* ================================================================ */
/* P1/P2：错误文案与超时                                              */
/* ================================================================ */

test('M3-3 / 协议契约：错误文案双向一致', () => {
  const bitmap = workerFacts('src/app/js/workers/bitmapWorker.js');
  assert.deepEqual(
    [...bitmap.postMessageErrorLiterals].sort(), sortedValues(constants.BITMAP_WORKER_ERROR_MESSAGES),
    'bitmapWorker 三条 catch 的文案必须与 BITMAP_WORKER_ERROR_MESSAGES 完全一致（双向）',
  );
  const tif = workerFacts('src/app/js/workers/tifWorker.js');
  assert.deepEqual([...tif.postMessageErrorLiterals].sort(), [constants.TIF_WORKER_ERROR_MESSAGE], 'tifWorker 的失败文案必须与 TIF_WORKER_ERROR_MESSAGE 一致');
});

test('M3-3 / 协议契约：P2 解析超时与 protocol.ts 一致', () => {
  const bitmap = workerFacts('src/app/js/workers/bitmapWorker.js');
  assert.deepEqual([...bitmap.setTimeoutDelays], [constants.NATIVE_HEIC_PARSE_TIMEOUT_MS], 'bitmapWorker 只允许一个超时，且必须等于 NATIVE_HEIC_PARSE_TIMEOUT_MS');
});

/* ================================================================ */
/* P3：tifWorker                                                     */
/* ================================================================ */

test('M3-3 / 协议契约：P3 tifWorker 请求与响应字段一致', () => {
  const tif = workerFacts('src/app/js/workers/tifWorker.js');
  assert.deepEqual(tif.dataDestructures, [fieldsOf('TifWorkerRequest')], 'TifWorkerRequest 的字段必须与 worker 解构一致（双向）');

  const groups = tif.postMessageKeyGroups.map((group) => group.join(','));
  assert.equal(groups.length, 2, 'tifWorker 只有成功/失败两条投递');
  assert.deepEqual(
    groups.slice().sort(), [fieldsOf('TifWorkerSuccessResponse').join(','), ['error'].join(',')].sort(),
    'TifWorkerSuccessResponse 的字段必须与成功投递的对象键一致',
  );
});

/* ================================================================ */
/* P4：calHammingDistance                                            */
/* ================================================================ */

test('M3-3 / 协议契约：P4 hamming 请求与分组字段一致', () => {
  const hamming = workerFacts('src/app/js/workers/calHammingDistance.js');
  assert.deepEqual(hamming.dataDestructures, [fieldsOf('HammingWorkerRequest')], 'HammingWorkerRequest 的字段必须与 worker 解构一致（双向）');

  const groupPushes = hamming.pushKeyGroups.filter((group) => group.target === 'result');
  assert.equal(groupPushes.length, 1, '分组结果只有一处 push');
  assert.deepEqual(groupPushes[0].keys, fieldsOf('HammingWorkerGroup'), 'HammingWorkerGroup 的字段必须与 result.push 的对象键一致');
});

/* ================================================================ */
/* P5：heic2bitmap（同 Realm 函数，不是消息协议）                      */
/* ================================================================ */

test('M3-3 / 协议契约：P5 全局名 / 形参 / WASM 路径 / 返回形状一致', () => {
  const rel = 'src/app/js/workers/heic2bitmap-worker.js';
  const heic = workerFacts(rel);

  assert.ok(heic.selfAssigned.has(constants.HEIC2BITMAP_GLOBAL), `应安装 self.${constants.HEIC2BITMAP_GLOBAL}`);
  const globalLike = [...heic.selfAssigned].filter((name) => name !== 'onmessage').sort();
  assert.deepEqual(globalLike, [constants.HEIC2BITMAP_GLOBAL], '该文件只允许安装一个自有全局');

  const params = heic.selfFunctionParams.get(constants.HEIC2BITMAP_GLOBAL);
  assert.ok(params, `${constants.HEIC2BITMAP_GLOBAL} 应以箭头/函数表达式安装`);
  assert.deepEqual(params, functionTypeParams.get('Heic2BitmapFn'), '形参名与顺序必须与 protocol.ts 的 Heic2BitmapFn 一致');

  const wasmLiterals = [...heic.strings].filter((value) => value.endsWith('.wasm')).sort();
  assert.deepEqual(wasmLiterals, [constants.HEIC2BITMAP_DEFAULT_WASM_PATH], '唯一的 .wasm 字面量必须是登记的缺省路径');

  assert.equal(heic.resolveKeyGroups.length, 1, 'heic2bitmap 只有一个 resolve');
  assert.deepEqual(heic.resolveKeyGroups[0], fieldsOf('Heic2BitmapResult'), 'Heic2BitmapResult 的字段必须与 resolve 的对象键一致');
});

/* ================================================================ */
/* 主线程侧：不得绕过常量写裸字面量                                    */
/* ================================================================ */

/** 只统计活代码——整行以 // 、* 或 /* 开头即视为注释行（与 react-rewrite-sentinel 同口径）。 */
function liveCode(text) {
  return text.split('\n').filter((line) => {
    const trimmed = line.trim();
    return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
  }).join('\n');
}

function reactSources(dir = new URL(`${REACT_DIR_REL}/`, ROOT), out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) reactSources(child, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(child);
  }
  return out;
}

test('M3-3 / 协议契约：主线程侧只经常量引用协议字面量（逆向）', () => {
  const protocolUrl = new URL(PROTOCOL_REL, ROOT).href;
  const rootPath = fileURLToPath(new URL('.', ROOT));
  const offenders = [];
  for (const url of reactSources()) {
    if (url.href === protocolUrl) continue;
    const code = liveCode(readFileSync(url, 'utf8'));
    for (const literal of [...sortedValues(constants.NATIVE_HEIC_CHANNEL), ...sortedValues(constants.BITMAP_WORKER_ERROR_MESSAGES)]) {
      if (code.includes(`'${literal}'`) || code.includes(`"${literal}"`)) {
        offenders.push(`${path.relative(rootPath, fileURLToPath(url))} 裸写了 ${literal}`);
      }
    }
  }
  assert.deepEqual(offenders, [], '主线程侧必须从 core/workers/protocol.ts 引用通道名与错误文案，不得散落字面量');
});
