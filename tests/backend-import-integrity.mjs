/**
 * M8-5：backend/src 的**悬空标识符**类别门禁。
 *
 * 起因：提交 8cf92c55 把 server.js 的 thumbnailer 导入收窄成只留 thumbnailPath，
 * 漏改了 :2056 的 `ensureThumbnail(currentLibrary, item)` 调用点。该标识符既没有
 * 本地定义、也没有导入 —— 抛 ReferenceError，被同一行的 catch 吞掉，于是
 * `GET /api/item/thumbnail` 对**所有**条目恒 404，而 eslint/grep 都不会叫。
 *
 * 本门禁用仓内既有的 typescript 编译器解析 backend/src 下每个 .js：
 *   1. 建作用域链（SourceFile / 函数 / 块 / catch / for 头 各自的绑定）；
 *   2. 收集 import 绑定、本地 function/const/let/var/class 声明、参数、catch 形参；
 *   3. 报告「被当作函数或构造器调用、但在作用域链上查无此名、也不在已知全局白名单里」
 *      的标识符。
 *
 * 只报"被调用/被 new"的标识符 —— 单看 `foo` 的引用无法与拼写无关的自由变量区分，
 * 而"调用一个不存在的东西"必然抛异常，是零假阳性的判据面。
 *
 * 白名单是显式的、可审阅的、写在下面 —— 宁可严，不要宽：往里加名字应当是一个
 * 需要解释的决定，而不是让门禁闭嘴的开关。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(projectRoot, 'backend', 'src');

/**
 * Node.js / ECMAScript 标准全局，以及本仓 backend 运行时确实存在的自由变量。
 * 每一条都要能说出"它从哪来"。加进来必须写清楚理由。
 */
const KNOWN_GLOBALS = new Set([
  // --- Node.js 全局对象 ---
  'globalThis', 'global', 'process', 'Buffer', 'console', 'require', 'module', 'exports',
  '__dirname', '__filename',
  // --- Node.js 计时器 / 微任务 ---
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate',
  'queueMicrotask',
  // --- Node.js / Web 共有的编解码与 URL ---
  'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI', 'escape', 'unescape',
  'atob', 'btoa', 'URL', 'URLSearchParams', 'TextEncoder', 'TextDecoder', 'structuredClone',
  // --- fetch 栈 ---
  'fetch', 'Headers', 'Request', 'Response', 'FormData', 'Blob', 'File', 'AbortController',
  'AbortSignal',
  // --- Node.js 全局 crypto / 性能 ---
  'crypto', 'performance', 'navigator',
  // --- 语言内建 ---
  'Object', 'Function', 'Boolean', 'Symbol', 'Error', 'EvalError', 'RangeError', 'ReferenceError',
  'SyntaxError', 'TypeError', 'URIError', 'AggregateError', 'Number', 'BigInt', 'Math', 'Date',
  'String', 'RegExp', 'Array', 'Map', 'Set', 'WeakMap', 'WeakSet', 'WeakRef', 'Promise', 'Proxy',
  'Reflect', 'Intl', 'JSON', 'ArrayBuffer', 'SharedArrayBuffer', 'DataView', 'Atomics',
  'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array',
  'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'Iterator', 'AsyncIterator', 'FinalizationRegistry',
  // --- 隐式形参 ---
  'arguments',
]);

function isFunctionLike(node) {
  return ts.isFunctionDeclaration(node)
    || ts.isFunctionExpression(node)
    || ts.isArrowFunction(node)
    || ts.isMethodDeclaration(node)
    || ts.isConstructorDeclaration(node)
    || ts.isGetAccessorDeclaration(node)
    || ts.isSetAccessorDeclaration(node);
}

/** 把一个绑定名节点（含解构、含默认值、含 rest）里的所有标识符名收集出来。 */
function collectBindingNames(name, out) {
  if (!name) return;
  if (ts.isIdentifier(name)) {
    out.add(name.text);
    return;
  }
  if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) collectBindingNames(element.name, out);
      // OmittedExpression（数组洞）没有可绑定的名字
    }
  }
}

/** 收集某个语句列表里**直接**声明的名字（不下降进嵌套函数/块 —— 那是它们自己的作用域）。 */
function collectHoistedNames(statements, out) {
  for (const statement of statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) collectBindingNames(declaration.name, out);
      continue;
    }
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      if (statement.name) out.add(statement.name.text);
    }
  }
}

function rootStatementsOf(node) {
  if (ts.isSourceFile(node)) return node.statements;
  if (isFunctionLike(node)) return node.body && ts.isBlock(node.body) ? node.body.statements : [];
  return [];
}

/**
 * 为一个会引入作用域的节点建立它的绑定集合。
 * 返回 null 表示这个节点不引入作用域。
 */
function bindingsFor(node) {
  if (ts.isSourceFile(node)) {
    const names = new Set();
    collectHoistedNames(node.statements, names);
    for (const statement of node.statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      const clause = statement.importClause;
      if (!clause) continue; // 副作用导入：`import './x.js'`
      if (clause.name) names.add(clause.name.text);
      const bindings = clause.namedBindings;
      if (bindings) {
        if (ts.isNamespaceImport(bindings)) names.add(bindings.name.text);
        else for (const specifier of bindings.elements) names.add(specifier.name.text);
      }
    }
    return names;
  }
  if (isFunctionLike(node)) {
    const names = new Set();
    if (node.name && ts.isIdentifier(node.name)) names.add(node.name.text);
    for (const parameter of node.parameters) collectBindingNames(parameter.name, names);
    collectHoistedNames(rootStatementsOf(node), names);
    return names;
  }
  if (ts.isBlock(node) || ts.isModuleBlock(node)) {
    const names = new Set();
    collectHoistedNames(node.statements, names);
    return names;
  }
  if (ts.isCatchClause(node)) {
    const names = new Set();
    if (node.variableDeclaration) collectBindingNames(node.variableDeclaration.name, names);
    return names;
  }
  if (ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node)) {
    const names = new Set();
    const initializer = ts.isForStatement(node) ? node.initializer : node.initializer;
    if (initializer && ts.isVariableDeclarationList(initializer)) {
      for (const declaration of initializer.declarations) collectBindingNames(declaration.name, names);
    }
    return names;
  }
  if (ts.isCaseBlock(node)) {
    // switch 的每个 case 子句共享一个块级作用域
    const names = new Set();
    for (const clause of [...node.clauses]) collectHoistedNames(clause.statements, names);
    return names;
  }
  if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
    const names = new Set();
    if (node.name) names.add(node.name.text);
    return names;
  }
  return null;
}

function resolve(name, scopes) {
  for (let index = scopes.length - 1; index >= 0; index -= 1) {
    if (scopes[index].has(name)) return true;
  }
  return KNOWN_GLOBALS.has(name);
}

export function inspectFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(path.basename(filePath), text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const findings = [];
  // 被检查过的调用点/构造点计数。全 0 意味着门禁退化成空转（例如编译器 API 变了），
  // 那种"全绿"比没有门禁更危险 —— 下面的 vacuity 护栏就吃这个数。
  let callSites = 0;

  const report = (identifier) => {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(identifier.getStart(sourceFile));
    findings.push({
      name: identifier.text,
      line: line + 1,
      column: character + 1,
    });
  };

  const walk = (node, scopes) => {
    const bindings = bindingsFor(node);
    const nextScopes = bindings ? [...scopes, bindings] : scopes;

    // 调用点：`foo(...)` / `foo?.(...)` / `new Foo(...)`
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      callSites += 1;
      if (!resolve(node.expression.text, nextScopes)) report(node.expression);
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
      callSites += 1;
      if (!resolve(node.expression.text, nextScopes)) report(node.expression);
    }

    ts.forEachChild(node, (child) => walk(child, nextScopes));
  };

  walk(sourceFile, []);
  return { findings, callSites };
}

function listSourceFiles(dir) {
  const collected = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collected.push(...listSourceFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.js')) collected.push(full);
  }
  return collected.sort();
}

const files = listSourceFiles(sourceRoot);
if (files.length === 0) {
  console.error('BACKEND_IMPORT_INTEGRITY_FAIL no source files found under backend/src');
  process.exit(1);
}

const violations = [];
let totalCallSites = 0;
for (const file of files) {
  const { findings, callSites } = inspectFile(file);
  totalCallSites += callSites;
  for (const finding of findings) {
    violations.push({ file: path.relative(projectRoot, file).split(path.sep).join('/'), ...finding });
  }
}

if (violations.length > 0) {
  console.error(`BACKEND_IMPORT_INTEGRITY_FAIL ${violations.length} dangling call target(s):`);
  for (const violation of violations) {
    console.error(`  ${violation.file}:${violation.line}:${violation.column}  ${violation.name} is called but is neither declared nor imported`);
  }
  process.exit(1);
}

// 空转护栏：门禁必须真的解析了成规模的调用点。实测 backend/src 约 2000 个，
// 取一个宽松下界即可 —— 它只在解析整体失效时触发，正常演进不会碰到。
const MIN_CALL_SITES = 500;
if (totalCallSites < MIN_CALL_SITES) {
  console.error(`BACKEND_IMPORT_INTEGRITY_FAIL vacuity guard: only ${totalCallSites} call sites were inspected (expected >= ${MIN_CALL_SITES}); the analyzer is no longer looking at real code`);
  process.exit(1);
}

console.log(`BACKEND_IMPORT_INTEGRITY_OK ${files.length} files, ${totalCallSites} call sites inspected, 0 dangling call targets`);
