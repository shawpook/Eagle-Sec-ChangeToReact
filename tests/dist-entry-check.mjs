/** M0：只读产物闭包门禁。缺失一律失败，不回退源码、不豁免旧路由。
 * 唯一的降级通道是 policy.knownMissing（tests/frontend-gate-manifest.mjs 的
 * KNOWN_MISSING_ASSETS）：逐条登记、要求非空理由/消费者/退出条件，且条目失效会被反向校验。
 * node tests/dist-entry-check.mjs [--root=<隔离产物根>]
 * import checkDist() 不执行 CLI；可注入只读文件系统做内存负向测试。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { DIST_POLICY, GATE_LIMITS } from './frontend-gate-manifest.mjs';

// 复用 sanitize-html / Vite 已安装的解析器，不新增包或修改 package.json。
const require = createRequire(import.meta.url);
const { Parser } = createRequire(require.resolve('sanitize-html'))('htmlparser2');
const postcss = createRequire(require.resolve('vite'))('postcss');
const projectRoot = path.resolve(import.meta.dirname, '..');
const ORIGIN = 'https://artifact.invalid';
const isExternal = (ref) => /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(ref);

export function parseHtml(html) {
  const tags = [];
  const scripts = [];
  const styles = [];
  let raw = null;
  const parser = new Parser({
    onopentag(name, attrs) {
      tags.push({ name, attrs });
      if (name === 'script' || name === 'style') raw = { name, attrs, text: '' };
    },
    ontext(text) { if (raw) raw.text += text; },
    onclosetag(name) {
      if (raw?.name !== name) return;
      if (name === 'script' && !raw.attrs.src && (!raw.attrs.type || /^(module|(?:text|application)\/javascript)$/i.test(raw.attrs.type))) scripts.push(raw.text);
      if (name === 'style') styles.push(raw.text);
      raw = null;
    },
  }, { decodeEntities: true });
  parser.end(html);
  return { tags, scripts, styles };
}

export function jsReferences(text, file = 'asset.js') {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const refs = [];
  const literal = (node) => node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;
  const add = (node, base, kind) => {
    const ref = literal(node);
    if (ref !== null) refs.push({ ref, base, kind });
  };
  const constructorName = (node) => ts.isIdentifier(node.expression) ? node.expression.text : ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : '';
  const isWorker = (node) => node && ts.isNewExpression(node) && ['Worker', 'SharedWorker'].includes(constructorName(node));
  const isModuleUrl = (node) => node && ts.isNewExpression(node) && constructorName(node) === 'URL' && node.arguments?.[1]?.getText(source) === 'import.meta.url';
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(node.moduleSpecifier, 'module', 'import');
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) add(node.arguments[0], 'module', 'import');
      const name = ts.isIdentifier(node.expression) ? node.expression.text : ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : '';
      if (name === 'importScripts') for (const arg of node.arguments) add(arg, 'module', 'worker-import');
    }
    if (isWorker(node)) {
      const target = node.arguments?.[0];
      if (isModuleUrl(target)) add(target.arguments[0], 'module', 'worker');
      else add(target, 'document', 'worker');
    }
    // URL 形式的 Worker 也必须切换到 worker 自己的上下文，不能再按页面上下文遍历一次。
    if (isModuleUrl(node) && !(isWorker(node.parent) && node.parent.arguments?.[0] === node)) add(node.arguments[0], 'module', 'url');
    // Vite 的预加载依赖数组（__vite__mapDeps）不表现为 import 声明。
    const value = literal(node);
    if (value && /^\/?assets\/[^?#]+\.(?:m?js|css|wasm|woff2?|ttf|otf)(?:[?#].*)?$/i.test(value)) refs.push({ ref: `/${value.replace(/^\//, '')}`, base: 'module', kind: 'generated' });
    ts.forEachChild(node, visit);
  }
  visit(source);
  return refs;
}

export function cssReferences(text) {
  const refs = [];
  const root = postcss.parse(text);
  const urls = (value) => {
    // 先消费普通字符串，避免 content: "url(missing)" 被当成请求。
    const tokens = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|url\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^)]*?))\s*\)/gi;
    for (const match of value.matchAll(tokens)) {
      if (match[0].toLowerCase().startsWith('url(')) refs.push(match[1] ?? match[2] ?? match[3]);
    }
  };
  root.walkDecls((decl) => urls(decl.value));
  root.walkAtRules((rule) => {
    if (rule.name.toLowerCase() === 'import') {
      const quoted = rule.params.match(/^\s*(["'])(.*?)\1/);
      if (quoted) refs.push(quoted[2]);
    }
    urls(rule.params);
  });
  return refs.map((ref) => ref.replace(/\\([\da-f]{1,6})\s?|\\([^\r\n])/gi, (_, hex, escaped) => hex ? String.fromCodePoint(parseInt(hex, 16)) : escaped));
}

export function checkDist({ root = path.join(projectRoot, 'dist/frontend'), policy = DIST_POLICY, io = fs } = {}) {
  root = path.resolve(root);
  const failures = new Set();
  const notes = new Set();
  const visited = new Set();
  const parsedJs = new Map();
  const parsedHtml = new Map();
  const files = new Set();
  const fail = (message) => failures.add(message);
  const isFile = (rel) => { try { return io.statSync(path.join(root, rel)).isFile(); } catch { return false; } };
  const exists = (rel) => { try { io.statSync(path.join(root, rel)); return true; } catch { return false; } };
  const read = (rel) => io.readFileSync(path.join(root, rel), 'utf8');

  // 已知缺失登记表：逐条精确登记（reason/consumer/exit 均非空），用于「刻意可选依赖」与
  // 「无现代消费者的 vendor 遗留分支」。它不是普遍豁免——未登记路径一律照旧 FAIL，
  // 且已存在 / 未被命中的条目会被反向校验出来（见函数末尾）。
  const knownMissing = new Map();
  const knownMissingHit = new Set();
  const registry = policy.knownMissing ?? [];
  if (!Array.isArray(registry)) fail('已知缺失登记表：必须是数组');
  for (const [index, entry] of (Array.isArray(registry) ? registry : []).entries()) {
    const label = `已知缺失登记表[${index}]`;
    const missing = typeof entry?.missing === 'string' ? entry.missing.trim().replace(/^\/+/, '') : '';
    if (!missing) { fail(`${label}：缺少 missing 路径`); continue; }
    const blank = ['reason', 'consumer', 'exit'].filter((field) => typeof entry?.[field] !== 'string' || !entry[field].trim());
    if (blank.length) { fail(`${label}（${missing}）：reason/consumer/exit 必须非空，缺 ${blank.join('/')}`); continue; }
    if (knownMissing.has(missing)) { fail(`${label}：重复登记 ${missing}`); continue; }
    knownMissing.set(missing, entry);
  }
  const localPath = (ref, from) => {
    ref = ref.trim();
    if (!ref || ref.startsWith('#')) return null;
    if (isExternal(ref)) { notes.add('外部协议/远程 URL 不做联网验证'); return null; }
    try {
      const url = new URL(ref, new URL(from, `${ORIGIN}/`));
      if (url.origin !== ORIGIN) { notes.add('外部 base URL 不做联网验证'); return null; }
      const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const full = path.resolve(root, rel);
      const relative = path.relative(root, full);
      if (relative.startsWith('..') || path.isAbsolute(relative) || rel.includes('\\') || rel.includes('\0')) throw new Error('非法产物路径');
      return rel;
    } catch (error) { fail(`${from} -> ${ref}：无法解析本地资源（${error.message}）`); return null; }
  };
  function follow(ref, from, document, kind = 'resource') {
    if (kind === 'import' && !isExternal(ref) && !/^(?:\.?\.?\/)/.test(ref)) {
      fail(`${from} -> ${ref}：产物中残留未解析的裸模块导入`);
      return;
    }
    const rel = localPath(ref, from);
    if (rel !== null) visit(rel, kind === 'worker' ? rel : document, `${from} -> ${ref}`);
  }
  function scanJs(text, rel, document) {
    if (!parsedJs.has(rel)) parsedJs.set(rel, jsReferences(text, rel));
    for (const { ref, base, kind } of parsedJs.get(rel)) follow(ref, base === 'document' ? document : rel, document, kind);
  }
  function scanCss(text, rel, document) {
    for (const ref of cssReferences(text)) follow(ref, rel, document, 'css');
  }
  function scanHtml(rel) {
    const html = parseHtml(read(rel));
    const baseHref = html.tags.find(({ name, attrs }) => name === 'base' && attrs.href)?.attrs.href;
    const document = baseHref ? new URL(baseHref, `${ORIGIN}/${rel}`).href : rel;
    parsedHtml.set(rel, { ...html, document });
    for (const { name, attrs } of html.tags) {
      if (name === 'base') continue;
      for (const attr of ['src', 'href', 'poster', 'data', 'xlink:href']) {
        if (attrs[attr] !== undefined && (attr !== 'data' || name === 'object')) follow(attrs[attr], document, document);
      }
      if (attrs.srcset) {
        // URL token 后可带 1x/2x/宽度描述符；data: URL 中的逗号不拆分。
        for (const match of attrs.srcset.matchAll(/(?:^|\s*,\s*)(data:\S+|[^\s,]+)(?:\s+[^,]+)?/g)) follow(match[1], document, document);
      }
      if (attrs.style) scanCss(`x{${attrs.style}}`, document, document);
    }
    html.scripts.forEach((script, index) => {
      for (const { ref, kind } of jsReferences(script, `${rel}#inline-${index}`)) follow(ref, document, document, kind);
    });
    for (const style of html.styles) scanCss(style, document, document);
  }
  function visit(rel, document = rel, via = '必需资源') {
    if (!isFile(rel)) {
      const registered = knownMissing.get(rel);
      if (registered) {
        knownMissingHit.add(rel);
        notes.add(`已知缺失（已逐条登记并降级为范围说明）：${via} -> ${rel}；退出条件 ${registered.exit}`);
      } else fail(`${via}：产物缺失 ${rel}`);
      return;
    }
    files.add(rel);
    const key = `${rel}\0${document}`;
    if (visited.has(key)) return;
    visited.add(key);
    try {
      if (/\.html?$/i.test(rel)) scanHtml(rel);
      else if (/\.(?:m?js|cjs)$/i.test(rel)) scanJs(read(rel), rel, document);
      else if (/\.css$/i.test(rel)) scanCss(read(rel), rel, document);
    } catch (error) { fail(`${rel}：资源解析失败（${error.message}）`); }
  }
  function manifest(rel, kind) {
    visit(rel);
    if (!isFile(rel)) return;
    try {
      const data = JSON.parse(read(rel));
      const followManifest = (ref) => {
        if (typeof ref !== 'string' || !ref || isExternal(ref)) { fail(`${rel}：manifest 必需资产不是本地路径 ${JSON.stringify(ref)}`); return; }
        follow(ref, rel, rel);
      };
      if (kind === 'extension') {
        if (data.manifest_version !== 3) fail(`${rel}：要求真实 MV3 扩展产物`);
        followManifest(data.background?.service_worker);
        followManifest(data.action?.default_popup);
        for (const ref of Object.values(data.icons || {})) followManifest(ref);
        const icon = data.action?.default_icon;
        for (const ref of typeof icon === 'string' ? [icon] : Object.values(icon || {})) followManifest(ref);
        for (const script of data.content_scripts || []) for (const ref of [...(script.js || []), ...(script.css || [])]) followManifest(ref);
        for (const ref of [data.options_page, data.options_ui?.page, data.devtools_page, ...Object.values(data.chrome_url_overrides || {})].filter(Boolean)) followManifest(ref);
        for (const group of data.web_accessible_resources || []) for (const ref of group.resources || []) {
          if (ref.includes('*')) fail(`${rel}：web_accessible_resources 通配符需展开登记 ${ref}`);
          else followManifest(ref);
        }
      } else if (kind === 'plugin') {
        followManifest(data.main?.url);
        // 插件 manifest 的 /logo.png 相对插件根，而不是宿主站点根。
        if (data.logo) followManifest(data.logo.replace(/^\//, ''));
      } else {
        for (const [key, entry] of Object.entries(data)) {
          followManifest(`/${entry.file}`);
          for (const ref of [...(entry.css || []), ...(entry.assets || [])]) followManifest(`/${ref}`);
          for (const dep of [...(entry.imports || []), ...(entry.dynamicImports || [])]) if (!data[dep]) fail(`${rel}：${key} 缺少 manifest 依赖键 ${dep}`);
        }
      }
    } catch (error) { fail(`${rel}：manifest 解析失败（${error.message}）`); }
  }

  for (const rel of [...policy.reactPages, ...policy.pages]) visit(rel);
  for (const rel of policy.reactPages) {
    const html = parsedHtml.get(rel);
    if (!html) continue;
    const modules = html.tags.filter(({ name, attrs }) => name === 'script' && attrs.type?.toLowerCase() === 'module' && attrs.src);
    if (!modules.length) fail(`${rel}：没有 module 入口脚本`);
    for (const { attrs } of modules) {
      const target = localPath(attrs.src, html.document);
      if (!target || !/^assets\/[^?#]+\.m?js$/i.test(target)) fail(`${rel}：入口未指向打包 JS ${attrs.src}`);
    }
    if (html.tags.some(({ attrs }) => [attrs.src, attrs.href].some((ref) => ref && /\/src\/app\/react\/.*\.tsx?(?:[?#]|$)/i.test(ref)))) fail(`${rel}：残留 React 源码入口`);
  }
  for (const { file, owner } of policy.dynamicAssets) visit(file, file, `动态清单 ${owner}`);
  for (const rel of policy.extensionManifests) manifest(rel, 'extension');
  for (const rel of policy.pluginManifests) manifest(rel, 'plugin');
  let manifestFound = false;
  for (const rel of ['.vite/manifest.json', 'manifest.json']) {
    if (isFile(rel)) { manifestFound = true; manifest(rel, 'vite'); }
  }
  if (!manifestFound) notes.add('未生成 Vite manifest：使用 HTML/JS/CSS 引用闭包及显式动态清单，不能证明构建图完整');
  for (const rel of policy.forbidden) if (exists(rel)) fail(`开发数据仍在产物中：${rel}`);
  // 登记表反向校验：条目一旦不再成立（文件已存在）或不再被任何引用命中，都必须暴露出来，
  // 否则本表会退化成长期垃圾清单。已存在 = FAIL（必须删条目）；未被命中 = 范围说明（提示复核）。
  for (const [rel, entry] of knownMissing) {
    if (exists(rel)) fail(`已知缺失登记表已失效：${rel} 在产物中已存在，必须删除该条目（登记消费者：${entry.consumer}）`);
    else if (!knownMissingHit.has(rel)) notes.add(`已知缺失登记表条目本轮未被任何引用命中，请复核：${rel}（登记消费者：${entry.consumer}）`);
  }
  return { ok: failures.size === 0, failures: [...failures], notes: [...notes], checkedFiles: [...files].sort() };
}

export function distMain(argv = process.argv.slice(2)) {
  const unknown = argv.filter((arg) => !arg.startsWith('--root='));
  if (unknown.length) { console.error(`未知参数：${unknown.join(', ')}`); return 2; }
  const root = argv.find((arg) => arg.startsWith('--root='))?.slice(7);
  const result = checkDist({ ...(root ? { root } : {}) });
  for (const failure of result.failures) console.error(`FAIL ${failure}`);
  for (const note of [...result.notes, ...GATE_LIMITS.slice(1)]) console.log(`范围说明：${note}`);
  console.log(`--- 汇总：FAIL ${result.failures.length}；已检查文件 ${result.checkedFiles.length} ---`);
  console.log(result.ok ? 'DIST_ENTRY_CHECK_OK（仅静态产物检查，不授予 release 资格）' : 'DIST_ENTRY_CHECK_FAILED');
  return result.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = distMain();
