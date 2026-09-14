/**
 * R2 守卫：`core/shim/*` 模块的**跨模块标识符完整性**检查。
 *
 * 背景：shimsLegacy.ts（原 3401 行单 IIFE）在 R2 被拆为 7 个 ESM 模块。这类「整段搬移」
 * 最危险的失败模式不是类型错误，而是**某个标识符留在了别的模块、此处既未声明也未 import**
 * —— 它会被当作全局变量在运行期抛 ReferenceError（而 `// @ts-nocheck` 与打包器都不会报）。
 *
 * 做法：把 `@ts-nocheck` 视作不存在（用 CompilerHost 覆写在内存里剥离该行，**不改磁盘文件**），
 * 以宽松选项做一次类型检查，只收集 TS2304 / TS2552 / TS2451（Cannot find name 族）——
 * 它们精确对应「未解析的裸标识符」。strict 关闭可避免隐式 any 噪声。
 *
 * 约定：`angular` / `ContextMenu` 等**应用运行期存在的全局**（由 bundleGlobals 安装、
 * 且使用处均有 typeof / window 守卫）在 ALLOWED_GLOBALS 登记豁免。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const projectRoot = path.resolve(import.meta.dirname, '..');
const shimDir = path.join(projectRoot, 'src/app/react/core/shim');

// 运行期由其它 bundle 段安装、且使用处已守卫的全局（非模块解析问题）。
const ALLOWED_GLOBALS = new Set(['angular', 'ContextMenu']);
const NAME_ERROR_CODES = new Set([2304, 2552, 2451, 2305, 2459]);

if (!fs.existsSync(shimDir)) {
  console.error(`SHIM_BOUNDARY_FAIL: 缺少 ${path.relative(projectRoot, shimDir)}`);
  process.exit(1);
}

const files = fs.readdirSync(shimDir).filter((f) => f.endsWith('.ts')).map((f) => path.join(shimDir, f));
if (files.length === 0) {
  console.error('SHIM_BOUNDARY_FAIL: shim/ 下没有 .ts 文件');
  process.exit(1);
}

const options = {
  target: ts.ScriptTarget.ES2022,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: false,
  noImplicitAny: false,
  skipLibCheck: true,
  noEmit: true,
  allowJs: false,
  esModuleInterop: true,
  allowSyntheticDefaultImports: true,
  types: [],
};

const host = ts.createCompilerHost(options);
const originalGetSourceFile = host.getSourceFile.bind(host);
host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) => {
  const sourceFile = originalGetSourceFile(fileName, languageVersion, onError, shouldCreate);
  if (!sourceFile) return sourceFile;
  const normalized = fileName.replace(/\\/g, '/');
  if (!normalized.includes('/core/shim/')) return sourceFile;
  if (!/^\/\/\s*@ts-nocheck/m.test(sourceFile.text)) return sourceFile;
  const stripped = sourceFile.text.replace(/^\/\/\s*@ts-nocheck[^\n]*\n/, '');
  return ts.createSourceFile(fileName, stripped, languageVersion, true, sourceFile.scriptKind);
};

const program = ts.createProgram(files, options, host);
const diagnostics = ts.getPreEmitDiagnostics(program);
const findings = [];

for (const diagnostic of diagnostics) {
  if (!NAME_ERROR_CODES.has(diagnostic.code)) continue;
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
  const match = /Cannot find name '([^']+)'/.exec(message);
  const name = match ? match[1] : null;
  if (name && ALLOWED_GLOBALS.has(name)) continue;
  const file = diagnostic.file ? path.relative(projectRoot, diagnostic.file.fileName).replace(/\\/g, '/') : '(unknown)';
  const { line, character } = diagnostic.file && diagnostic.start != null
    ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
    : { line: 0, character: 0 };
  findings.push(`${file}:${line + 1}:${character + 1} TS${diagnostic.code} ${message}`);
}

if (findings.length > 0) {
  console.error('SHIM_BOUNDARY_FAIL: shim 模块存在未解析标识符（缺 import 或拼写错误）');
  for (const finding of findings.slice(0, 60)) console.error(`  ${finding}`);
  if (findings.length > 60) console.error(`  ... 共 ${findings.length} 条`);
  process.exit(1);
}

console.log(`SHIM_BOUNDARY_OK: ${files.length} 个 shim 模块跨模块标识符完整（无缺失 import）`);
