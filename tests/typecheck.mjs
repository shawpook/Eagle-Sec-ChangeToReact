/** M0 类型门禁：检查范围内零诊断不等于全工作区无类型债。
 * 保留现有 8 项整文件免检，完整扫描注释指令并显式报告类别和未覆盖范围。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { parseHtml } from './dist-entry-check.mjs';
import {
  SCRIPT_INVENTORY_ROOTS, FIRST_PARTY_SCRIPTS, ENGINE_SCRIPTS, STATIC_PAGES, GATE_LIMITS,
} from './frontend-gate-manifest.mjs';

const projectRoot = path.resolve(import.meta.dirname, '..');
export const NOCHECK_LEDGER = [
  { file: 'src/app/react/core/shim/demoSeed.ts', category: '演示数据' },
  { file: 'src/app/react/core/shim/ipcBus.ts', category: 'IPC 总线' },
];

export function scanTypeDirectives(text, file = 'source.ts') {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const comments = new Map();
  const rangesAt = (pos) => {
    for (const range of [...(ts.getLeadingCommentRanges(text, pos) || []), ...(ts.getTrailingCommentRanges(text, pos) || [])]) comments.set(range.pos, range);
  };
  // 使用语法树 token 边界取注释，避免把字符串、正则、模板正文当成指令。
  function visit(node) {
    rangesAt(node.pos);
    rangesAt(node.end);
    for (const child of node.getChildren(source)) visit(child);
  }
  visit(source);
  const directives = [];
  for (const { pos, end } of comments.values()) {
    const comment = text.slice(pos, end);
    for (const match of comment.matchAll(/(?:^|\n)[\t ]*(?:\/\/\/?|\/\*+|\*+)?[\t ]*@ts-(nocheck|check|ignore|expect-error)\b/g)) {
      const offset = pos + match.index + match[0].indexOf('@ts-');
      // TypeScript 只将有效的文件头行注释作为整文件开关；说明性块注释不算免检。
      const effective = source.checkJsDirective?.pos === pos
        && match[1] === (source.checkJsDirective.enabled ? 'check' : 'nocheck');
      directives.push({ kind: match[1], line: source.getLineAndCharacterOfPosition(offset).line + 1, offset, effective });
    }
  }
  return directives.sort((a, b) => a.offset - b.offset);
}

export function auditNoCheck(records, ledger = NOCHECK_LEDGER) {
  const found = new Set(records.filter((record) => record.kind === 'nocheck' && record.effective).map((record) => record.file));
  const listed = new Set(ledger.map((entry) => entry.file));
  return {
    files: [...found].sort(),
    unlisted: [...found].filter((file) => !listed.has(file)).sort(),
    stale: [...listed].filter((file) => !found.has(file)).sort(),
  };
}

export function auditScriptInventory(files, firstParty = FIRST_PARTY_SCRIPTS, engines = ENGINE_SCRIPTS) {
  const registered = [...firstParty, ...engines.map(([file]) => file)];
  const actual = new Set(files);
  return {
    unlisted: files.filter((file) => !registered.includes(file)),
    stale: registered.filter((file) => !actual.has(file)),
    duplicate: registered.filter((file, index) => registered.indexOf(file) !== index),
  };
}

function walk(root, rel, pattern) {
  const files = [];
  for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const file = `${rel}/${entry.name}`;
    if (entry.isDirectory()) files.push(...walk(root, file, pattern));
    else if (entry.isFile() && pattern.test(file)) files.push(file);
  }
  return files.sort();
}

export function inspectTypeScope(root = projectRoot) {
  const errors = [];
  const configPath = path.join(root, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  for (const error of parsed.errors) errors.push(ts.flattenDiagnosticMessageText(error.messageText, '\n'));
  const include = config.config.include || [];
  for (const entry of ['src/app/react/**/*.ts', 'src/app/react/**/*.tsx']) if (!include.includes(entry)) errors.push(`tsconfig.include 缺少 ${entry}`);
  if (parsed.options.noCheck || parsed.options.strict !== true) errors.push('不得启用 noCheck 或关闭 strict 来制造零诊断');
  const reactFiles = walk(root, 'src/app/react', /\.tsx?$/);
  const included = new Set(parsed.fileNames.map((file) => path.resolve(file).toLowerCase()));
  for (const file of reactFiles) if (!included.has(path.resolve(root, file).toLowerCase())) errors.push(`类型范围被排除：${file}`);
  for (const entry of config.config.exclude || []) if (['frontend', 'frontend/'].includes(entry)) errors.push(`不得排除 ${entry}`);

  const scripts = SCRIPT_INVENTORY_ROOTS.flatMap((rel) => walk(root, rel, /\.(?:[cm]?js|tsx?)$/));
  const inventory = auditScriptInventory(scripts);
  for (const file of inventory.unlisted) errors.push(`图外运行脚本未登记：${file}`);
  for (const file of inventory.stale) errors.push(`运行脚本登记已失效：${file}`);
  for (const file of inventory.duplicate) errors.push(`运行脚本重复分类：${file}`);
  const publicHtml = walk(root, 'frontend/public', /\.html?$/);
  const registeredHtml = new Set(STATIC_PAGES.map((file) => `frontend/public/${file}`));
  for (const file of publicHtml) if (!registeredHtml.has(file)) errors.push(`外围页面未登记（含内联运行脚本）：${file}`);

  const records = [];
  for (const file of [...reactFiles, ...FIRST_PARTY_SCRIPTS]) {
    if (!fs.existsSync(path.join(root, file))) continue;
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    for (const directive of scanTypeDirectives(text, file)) records.push({ file, ...directive });
  }
  for (const file of publicHtml) {
    const { scripts: inlineScripts } = parseHtml(fs.readFileSync(path.join(root, file), 'utf8'));
    inlineScripts.forEach((script, index) => {
      for (const directive of scanTypeDirectives(script, 'inline.js')) records.push({ ...directive, file, inlineScript: index + 1 });
    });
  }
  const nocheck = auditNoCheck(records);
  for (const file of nocheck.unlisted) errors.push(`未登记却带 @ts-nocheck：${file}`);
  for (const file of nocheck.stale) errors.push(`已撤销却仍在 nocheck 台账（请移除）：${file}`);
  return { errors, records, nocheck, reactFiles, scripts, publicHtml, rootFiles: parsed.fileNames.length };
}

export function typecheckMain() {
  let scope;
  try { scope = inspectTypeScope(); }
  catch (error) { console.error(`TYPECHECK_SCOPE_ERROR: ${error.message}`); return 1; }
  console.log(`TYPECHECK_SCOPE: tsconfig 根文件 ${scope.rootFiles}；React 文件 ${scope.reactFiles.length}；图外脚本登记 ${scope.scripts.length}；外围 HTML ${scope.publicHtml.length}`);
  console.log(`TYPECHECK_EXEMPTIONS: 整文件 @ts-nocheck ${scope.nocheck.files.length}，待撤销 ${scope.nocheck.files.length}（全部计入类型债，不因属于 shim 而减去）`);
  for (const file of scope.nocheck.files) {
    const category = NOCHECK_LEDGER.find((entry) => entry.file === file)?.category || '未登记';
    console.log(`  [整文件免检/${category}] ${file}`);
  }
  for (const kind of ['nocheck', 'check', 'ignore', 'expect-error']) {
    const rows = scope.records.filter((record) => record.kind === kind);
    console.log(`  注释指令 @ts-${kind}：${rows.length} 处 / ${new Set(rows.map((row) => row.file)).size} 文件（全文扫描，含位置上可能不生效的指令）`);
  }
  console.log(`TYPECHECK_OUTSIDE_SEMANTICS: 自有图外 JS ${FIRST_PARTY_SCRIPTS.length}，第三方/引擎 ${ENGINE_SCRIPTS.length}，外围 HTML ${scope.publicHtml.length}；均不能算作 tsc 语义通过`);
  for (const limit of GATE_LIMITS) console.log(`范围说明：${limit}`);
  if (scope.errors.length) {
    console.error('TYPECHECK_SCOPE_OR_NOCHECK_ERROR:');
    for (const error of scope.errors) console.error(`  ${error}`);
    return 1;
  }
  const result = spawnSync(process.execPath, [
    path.join(projectRoot, 'node_modules/typescript/bin/tsc'), '--noEmit', '--pretty', 'false', '-p', 'tsconfig.json',
  ], { cwd: projectRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  const diagnostics = output.split(/\r?\n/).filter((line) => /\berror TS\d+:/.test(line));
  if (result.error || result.status !== 0 || diagnostics.length) {
    console.error(`TYPECHECK_FAILED: ${diagnostics.length} 条诊断；tsc 退出码 ${result.status}${result.error ? `；${result.error.message}` : ''}`);
    console.error(output);
    return 1;
  }
  console.log(`TYPECHECK_OK: 受检范围 0 诊断；整文件免检 ${scope.nocheck.files.length}，待撤销 ${scope.nocheck.files.length}；不代表全工作区类型通过`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = typecheckMain();
