/**
 * R1-4 · 空 catch 扫描器（共享实现）。
 *
 * 单一事实源：门禁 `tests/empty-catch-gate.mjs` 与一次性诊断脚本
 * `outputs/scan-empty-catch.mjs` 都 import 本模块，避免两份实现漂移。
 *
 * 为什么用 TypeScript parser 走 AST 而不是正则：正则在嵌套花括号、字符串字面量、
 * 模板串里必然误判；而本仓存在逐帧渲染路径上的 catch，误判成本很高。
 *
 * 本模块只做"扫描与分类"，不含任何门禁判据（判据在 gate 里）。
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export const ROOT = process.cwd();

/** 第一方源码根（测试代码由调用方通过 excludeTests 决定是否排除） */
export const FIRST_PARTY_ROOTS = [
  'src/app',
  'src/my_modules',
  'src/i18n',
  'src/config.js',
  'electron',
  'frontend',
  'backend',
  'scripts',
  'plugins',
  'tests',
];

/**
 * vendored / 第三方：即使挂在 src/app 下也不算第一方。
 * 这一条很关键——本仓把依赖直接提交了（src/node_modules 8000+ 文件入库），
 * 不排除的话统计出来的数字没有意义。
 */
export const VENDOR_PATTERNS = [
  /(^|\/)node_modules\//,
  /(^|\/)pdf-viewer\//,
  // model-viewer 下 libs/ 是 Google model-viewer + pickr + web-ifc 的 min 化发行物
  /(^|\/)model-viewer\/libs\//,
  // src/app/js/vendors/：bignumber / libheif / libtga / sweetalert2 / tiny-pinyin / videojs / wavesurfer
  /(^|\/)vendors?\//,
  // Emscripten 编译产物（heif 解码器、dcraw RAW 解码器）
  /(^|\/)workers\/libheif\.js$/,
  /(^|\/)raw-parser\/dcraw\.js$/,
  /(^|\/)dist\//,
  /(^|\/)third[_-]?party\//,
  /\.min\.js$/,
];

export const EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);

/** 只要 try 里出现这些，就不是"纯日志/纯解析"这类无副作用操作 */
export const SIDE_EFFECT =
  /fs\.|readFileSync|writeFile|appendFile|unlink|mkdir|rmdir|rmSync|copyFile|fetch\(|ipcRenderer|ipcMain|executeJavaScript|localStorage\.setItem|sessionStorage\.setItem|execSync|spawn\(|\.send\(/;

/**
 * 分类规则。判据全部落在"被保护的 try 块到底在干什么"上，
 * 而不是凭 catch 里那句注释自证——注释可能是错的，try 块内容不会。
 */
export const RULES = [
  { cat: 'A0-空try块', risk: 'low', test: (t) => stripComments(t) === '' },
  {
    cat: 'A8-控制流跳出',
    risk: 'low',
    test: (t) => /throw\s+Break[A-Za-z]*|throw\s+StopIteration|BreakException/.test(t),
  },
  {
    cat: 'A2-清理释放',
    risk: 'low',
    test: (t) =>
      /clearTimeout|clearInterval|cancelAnimationFrame|removeEventListener|removeListener|\.off\(|unsubscribe|\.reset\(\)|deregister|dereg\(\)|\.destroy\(|\.dispose\(|\.close\(|\.stop\(|\.abort\(|\.unref\(|\.release\(|\.kill\(\)|\.unlink\(|\.pause\(\)|\.play\(\)|removeItem\(|localStorage\.remove/.test(
        t
      ),
  },
  {
    cat: 'A1-日志遥测',
    risk: 'low',
    test: (t) =>
      !SIDE_EFFECT.test(t) &&
      /electronLog|wElectronLog|ElectronLogInfo|console\.(log|warn|error|debug|info)|\blogger\.|reportError|telemetry/.test(
        t
      ),
  },
  {
    cat: 'A6-UI触发/样式',
    risk: 'low',
    test: (t) =>
      !SIDE_EFFECT.test(t) &&
      /\.click\(\)|\.focus\(\)|\.blur\(\)|scrollIntoView|classList\.|\.style\./.test(t),
  },
  {
    cat: 'A9-可选元数据读取',
    risk: 'low',
    test: (t) => !SIDE_EFFECT.test(t) && /fontMetas|rawMetas|palettes\[|tagMappings|postScriptName/.test(t),
  },
  {
    cat: 'A10-排序比较',
    risk: 'low',
    test: (t) => !SIDE_EFFECT.test(t) && /localeCompare|\.sort\(/.test(t),
  },
  {
    cat: 'A3-能力探测',
    risk: 'low',
    test: (t) =>
      !SIDE_EFFECT.test(t) &&
      /initLinkVars|typeof\s+\w+|['"]\w+['"]\s+in\s+\w+|tryGet|hasOwnProperty|\?\.\w+\(|&&\s*\(\w+\.\w+/.test(
        t
      ),
  },
  {
    cat: 'A4-纯解析/格式化',
    risk: 'low',
    test: (t) =>
      !SIDE_EFFECT.test(t) &&
      /JSON\.parse|Number\(|parseInt|parseFloat|new Date\(|decodeURI|\.toFixed\(|Intl\./.test(t),
  },
  // —— 高风险：失败会改变业务结果 ——
  {
    // 注意：不能只写一个裸 rename，日志文案里的 "Batch rename" 会造成假阳性
    cat: 'B1-写操作/IO',
    risk: 'high',
    test: (t) =>
      /fs\.|readFileSync|writeFile|appendFile|unlink|mkdir|rmdir|rmSync|copyFile|\brename(?:Sync|File)?\s*\(|localStorage\.setItem|sessionStorage\.setItem|execSync|spawn\(|exec\(/.test(
        t
      ),
  },
  {
    cat: 'B2-网络/IPC/数据库',
    risk: 'high',
    test: (t) =>
      /fetch\(|XMLHttpRequest|ipcRenderer|ipcMain|\.invoke\(|\.postMessage|\.execute\(|\.run\(|\.prepare\(|transaction\(|executeJavaScript/.test(
        t
      ),
  },
  { cat: 'B3-业务返回值', risk: 'high', test: (t) => /\breturn\s+\S/.test(t) },
  {
    cat: 'B4-状态写入',
    risk: 'high',
    test: (t) => /setState|\.set\(|getState\(\)\.\w+\s*=|\.value\s*=|\.emit\(|\.dispatch\(|store\./.test(t),
  },
];

function stripComments(text) {
  return text
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/[{}\s]/g, '');
}

export function isVendor(rel) {
  return VENDOR_PATTERNS.some((re) => re.test(rel));
}

export function classify(tryText, comment) {
  const hits = RULES.filter((r) => r.test(tryText));
  if (hits.length === 0) {
    return comment
      ? { cat: 'A5-无特征但有注释说明', risk: 'low' }
      : { cat: 'B5-无特征且无说明', risk: 'high' };
  }
  const high = hits.filter((h) => h.risk === 'high');
  return high.length ? high[0] : hits[0];
}

function scriptKindFor(file) {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.ts')) return ts.ScriptKind.TS;
  return ts.ScriptKind.JSX;
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    if (isVendor(rel)) continue;
    if (e.isDirectory()) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      walk(abs, out);
    } else if (e.isFile() && EXTS.has(path.extname(e.name))) {
      out.push(rel);
    }
  }
  return out;
}

export function collectFiles({ excludeTests = false } = {}) {
  const files = new Set();
  for (const root of FIRST_PARTY_ROOTS) {
    if (excludeTests && root === 'tests') continue;
    const abs = path.join(ROOT, root);
    const st = fs.existsSync(abs) ? fs.statSync(abs) : null;
    if (!st) continue;
    if (st.isFile()) {
      if (EXTS.has(path.extname(root)) && !isVendor(root)) files.add(root);
    } else {
      for (const f of walk(abs)) {
        if (excludeTests && f.startsWith('tests/')) continue;
        files.add(f);
      }
    }
  }
  return [...files].sort();
}

function enclosingContext(node, sourceFile) {
  let cur = node.parent;
  let depth = 0;
  while (cur && depth < 6) {
    if (ts.isFunctionDeclaration(cur) && cur.name) return `function ${cur.name.text}`;
    if (ts.isMethodDeclaration(cur) && cur.name) return `method ${cur.name.getText(sourceFile)}`;
    if (ts.isFunctionExpression(cur) && cur.name) return `fnExpr ${cur.name.text}`;
    if (ts.isVariableDeclaration(cur) && ts.isIdentifier(cur.name)) {
      const init = cur.initializer;
      if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
        return `const ${cur.name.text}`;
      }
    }
    if (ts.isClassDeclaration(cur) && cur.name) return `class ${cur.name.text}`;
    cur = cur.parent;
    depth += 1;
  }
  return '(顶层/匿名)';
}

/**
 * 扫描一个文件的空 catch。
 * @returns {{rel:string, diagCount:number, items:Array}}
 */
export function scanFile(rel) {
  let text;
  try {
    text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  } catch {
    return { rel, error: 'read-failed', items: [] };
  }

  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, scriptKindFor(rel));
  const diagCount = (sf.parseDiagnostics || []).length;
  const items = [];

  const visit = (node) => {
    if (ts.isCatchClause(node) && node.block.statements.length === 0) {
      const start = node.getStart(sf);
      const { line } = sf.getLineAndCharacterOfPosition(start);
      const raw = text.slice(start, node.getEnd());
      const bodyText = raw.slice(raw.indexOf('{') + 1, raw.lastIndexOf('}'));
      const commentText = (bodyText.match(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g) || [])
        .map((c) => c.replace(/^\s*\/\*+|\*+\/\s*$/g, '').replace(/^\s*\/\/\s*/, '').trim())
        .filter(Boolean)
        .join(' | ');
      const tryBlock = node.parent && node.parent.tryBlock;
      const tryText = tryBlock ? tryBlock.getText(sf) : '';
      const cls = classify(tryText, commentText);
      const param = node.variableDeclaration ? node.variableDeclaration.getText(sf) : '(无绑定参数)';

      items.push({
        line: line + 1,
        param,
        hasComment: Boolean(commentText),
        // 「已注明理由」标记：catch 体注释里带 `@swallow:` 即视为显式论证过的吞错。
        // 门禁据此放行——没这个标记的新增空 catch 一律判红。
        marked: /@swallow\b/.test(commentText),
        comment: commentText.slice(0, 200),
        context: enclosingContext(node, sf),
        tryText: tryText.replace(/\s+/g, ' ').slice(0, 300),
        snippet: raw.replace(/\s+/g, ' ').slice(0, 160),
        cat: cls.cat,
        risk: cls.risk,
        // 稳定的身份键：文件 + 行号 + 上下文。行号会随编辑漂移，故门禁另用"文件+上下文+snippet"兜底。
        key: `${rel}:${line + 1}`,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  return { rel, diagCount, items };
}

/** 全量扫描。 */
export function scan(options = {}) {
  const files = collectFiles(options);
  const results = [];
  let total = 0;
  let diagFiles = 0;
  for (const rel of files) {
    const r = scanFile(rel);
    if (r.error) continue;
    if (r.diagCount > 0) diagFiles += 1;
    if (r.items.length) {
      total += r.items.length;
      results.push(r);
    }
  }
  return { files: results, scannedFiles: files.length, total, diagFiles };
}
