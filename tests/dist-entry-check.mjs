/**
 * R1：正式产物入口/资源检查。
 *
 * 断言 dist/frontend 中：
 *   1. 每个 React 交付页面的入口为打包后的 /assets/*.js，且不残留 /src/app/react/*.ts(x) 源码路径
 *      （开发态注入不得进产物）；
 *   2. 页面按相对/绝对路径引用的本地资源在产物中可解析；凡「源目录里存在、产物里缺失」判 FAIL
 *      （R1 交付缺口），凡「源目录里也不存在」判 WARN（既有源缺陷，dev 同样 404，归 R5/R6）；
 *   3. 开发/演示数据（mock-library、mock-assets）不在产物中。
 *
 * 用法：node tests/dist-entry-check.mjs（先 npm run build）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(projectRoot, 'dist', 'frontend');

const ENTRY_PAGES = [
  'src/app/index.html',
  'src/app/preferences.html',
  'src/app/preview-window.html',
  'src/app/collect-window/index.html',
  'src/app/exif-viewer/index.html',
  'src/app/raw-viewer/index.html',
  'src/app/native-viewer/index.html',
  'src/app/gif-viewer/index.html',
  'src/app/text-editor/text-editor.html',
  'src/app/font-viewer/font-viewer.html',
  'frontend/document-viewer/index.html',
];
// 静态页（无 React 入口）：只查存在性与资源解析。
const STATIC_PAGES = ['pages.html'];
// 专用引擎页（PDF.js / O3DV）：无 React 入口，按原样交付，只查存在性与资源解析。
const ENGINE_PAGES = [
  'src/app/pdf-viewer/web/viewer.html',
  'src/app/model-viewer/website/index.html',
  'src/app/model-viewer/website/embed.html',
];
// 开发/演示数据或被 publicDir 提供、不进静态产物的路由（有意排除）。
const EXCLUDED_ROUTES = ['/mock-library/', '/mock-assets/', '/src/app/registration.html', '/src/app/manage-device.html'];

const failures = [];
const warnings = [];
const fail = (msg) => { failures.push(msg); console.log(`FAIL ${msg}`); };
const warn = (msg) => { warnings.push(msg); console.log(`WARN ${msg}`); };
const pass = (msg) => console.log(`PASS ${msg}`);

if (!fs.existsSync(distRoot)) {
  console.error(`FAIL 产物不存在：${distRoot}（先运行 npm run build）`);
  process.exit(1);
}

const ATTR_RE = /(?:src|href)\s*=\s*"([^"]+)"/g;

function distPathFor(ref, pageRel) {
  const clean = ref.split('?')[0].split('#')[0];
  return clean.startsWith('/')
    ? path.join(distRoot, clean)
    : path.join(distRoot, path.dirname(pageRel), clean);
}

function srcPathFor(ref, pageRel) {
  const clean = ref.split('?')[0].split('#')[0];
  return clean.startsWith('/')
    ? path.join(projectRoot, clean)
    : path.join(projectRoot, path.dirname(pageRel), clean);
}

function checkResources(pageRel) {
  const filePath = path.join(distRoot, pageRel);
  const html = fs.readFileSync(filePath, 'utf8');
  for (const m of html.matchAll(ATTR_RE)) {
    const ref = m[1];
    if (/^(https?:|data:|mailto:|blob:|\/\/|#)/.test(ref) || ref.includes('${')) continue;
    if (EXCLUDED_ROUTES.some((p) => ref.startsWith(p))) { warn(`${pageRel} -> ${ref}（有意排除/演示路由）`); continue; }
    if (fs.existsSync(distPathFor(ref, pageRel))) continue;
    // 产物缺失：区分「R1 交付缺口」与「既有源缺陷」。
    if (fs.existsSync(srcPathFor(ref, pageRel))) fail(`${pageRel} 交付缺口：${ref} 在源码存在但产物缺失`);
    else warn(`${pageRel} 既有源缺陷：${ref} 源码与产物均缺失（归 R5/R6）`);
  }
}

for (const rel of ENTRY_PAGES) {
  const filePath = path.join(distRoot, rel);
  if (!fs.existsSync(filePath)) { fail(`缺少页面 ${rel}`); continue; }
  const html = fs.readFileSync(filePath, 'utf8');
  if (/\/src\/app\/react\//.test(html)) fail(`${rel} 残留 React 源码路径（开发态入口泄漏到产物）`);
  const moduleSrc = html.match(/<script type="module"[^>]*src="([^"]+)"/);
  if (!moduleSrc) fail(`${rel} 没有 module 入口脚本`);
  else if (!moduleSrc[1].startsWith('/assets/')) fail(`${rel} 入口未指向打包产物：${moduleSrc[1]}`);
  else pass(`${rel} 入口 ${moduleSrc[1]}`);
  checkResources(rel);
}

for (const rel of STATIC_PAGES) {
  if (!fs.existsSync(path.join(distRoot, rel))) { fail(`缺少页面 ${rel}`); continue; }
  pass(`${rel} 存在（静态页，无 React 入口）`);
  checkResources(rel);
}

for (const rel of ENGINE_PAGES) {
  if (!fs.existsSync(path.join(distRoot, rel))) { fail(`缺少引擎页 ${rel}`); continue; }
  pass(`${rel} 存在（专用引擎页，无 React 入口）`);
  checkResources(rel);
}

for (const devOnly of ['mock-library', 'mock-assets']) {
  if (fs.existsSync(path.join(distRoot, devOnly))) fail(`开发数据仍在产物中：${devOnly}`);
  else pass(`开发数据已排除：${devOnly}`);
}

console.log(`--- 汇总：FAIL ${failures.length}，WARN ${warnings.length} ---`);
if (failures.length > 0) {
  console.log(`DIST_ENTRY_CHECK_FAILED ${JSON.stringify(failures)}`);
  process.exit(1);
}
console.log('DIST_ENTRY_CHECK_OK');
