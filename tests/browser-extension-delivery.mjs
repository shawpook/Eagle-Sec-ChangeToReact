/**
 * M6-1 交付契约门禁：浏览器扩展的**静态**契约（不需要任何服务在跑）。
 *
 * 这里断言的是「扩展被交付成什么样」，与 tests/browser-extension.mjs（需要活的
 * 后端与前端服务的行为冒烟）互补；两者都会在合并时登记进测试清单。
 *
 * 覆盖四件事：
 *   1. 端口/地址单一来源——扩展侧只有 background.js 一处声明，默认值**等于生产默认**，
 *      且 popup 侧不复制任何地址常量；
 *   2. 权限面——host_permissions 收敛在 loopback 且不含端口，逐条与真实连接目标闭合；
 *   3. popup 的两种加载环境——磁盘副本（扩展本体）与 HTTP 演示副本的差别显式化；
 *   4. 交付物与源码一致——产物里的扩展目录是 public 目录的逐字副本。
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { RUNTIME_CONFIG_PATH, injectRuntimeConfigTag, resolveRuntimeConfig } from '../frontend/runtime-config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const extensionRoot = path.join(projectRoot, 'frontend/public/browser-extension');
const distRoot = path.join(projectRoot, 'dist/frontend/browser-extension');

const read = (rel) => fs.readFileSync(path.join(extensionRoot, rel), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const background = read('background.js');
const popupJs = read('popup.js');
const popupHtml = read('popup.html');

// ── 1. 端口/地址单一来源 ────────────────────────────────────────────────────

assert.equal(manifest.manifest_version, 3, '交付对象必须是 MV3');

/** 去掉注释后再做字面量断言，避免注释里的示例地址把断言带偏。 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

const backgroundCode = stripComments(background);
const popupCode = stripComments(popupJs);

/** 从 background.js 里**按源码文本**读出声明值，避免测试自己复制一份常量。 */
function declaredValue(key) {
  const match = backgroundCode.match(new RegExp(`${key}:\\s*'([^']*)'`));
  assert.ok(match, `background.js 的 DEFAULT_RUNTIME 未声明 ${key}`);
  return match[1];
}

/** 从 scripts/start-production.mjs 读出生产默认端口，作为漂移基准。 */
function productionDefaultPort(varName, envName) {
  const source = fs.readFileSync(path.join(projectRoot, 'scripts/start-production.mjs'), 'utf8');
  const match = source.match(new RegExp(`const ${varName} = process\\.env\\.${envName} \\|\\| '(\\d+)';`));
  assert.ok(match, `scripts/start-production.mjs 未找到 ${varName} 的默认值`);
  return match[1];
}

const declaredApi = declaredValue('apiBaseUrl');
const declaredWorkbench = declaredValue('workbenchUrl');
const productionExtensionPort = productionDefaultPort('extensionPort', 'EAGLE_EXTENSION_PORT');
const productionFrontendPort = productionDefaultPort('frontendPort', 'EAGLE_FRONTEND_PORT');

assert.equal(
  declaredApi,
  `http://localhost:${productionExtensionPort}`,
  `扩展默认 API 地址与生产默认端口漂移：声明 ${declaredApi}，生产 EAGLE_EXTENSION_PORT=${productionExtensionPort}`,
);
assert.equal(
  new URL(declaredWorkbench).port,
  productionFrontendPort,
  `扩展默认工作台端口与生产默认漂移：声明 ${declaredWorkbench}，生产 EAGLE_FRONTEND_PORT=${productionFrontendPort}`,
);
assert.equal(new URL(declaredWorkbench).pathname, '/workbench.html', '工作台路径必须是 RELOCATED_PAGES 复位后的旧 public 路径');

// 与 M5-1 的唯一地址来源同源：frontend/runtime-config.mjs 的 extensionBaseUrl 默认值。
// 传 `{}` 而非 process.env，避免外部 EAGLE_* 变量让断言失去确定性。
assert.equal(
  resolveRuntimeConfig({}).extensionBaseUrl,
  declaredApi,
  '扩展默认 API 地址与 frontend/runtime-config.mjs 的 extensionBaseUrl 默认值不一致',
);

// popup 侧不得复制地址常量：它只能从 background.js 取。
assert.ok(
  !/https?:\/\//.test(popupCode),
  'popup.js 出现了地址字面量——地址必须只由 background.js 声明并经 get-runtime 下发',
);
assert.ok(popupJs.includes("'get-runtime'"), 'popup.js 未通过 get-runtime 消费地址');

// 已下线的旧端口不得以任何形式残留在扩展目录（41593 是 M6 前的扩展端口，5176 是 dev 前端端口）。
for (const file of fs.readdirSync(extensionRoot)) {
  const full = path.join(extensionRoot, file);
  if (!fs.statSync(full).isFile() || !/\.(?:js|json|html|md)$/.test(file)) continue;
  const text = fs.readFileSync(full, 'utf8');
  for (const stale of ['41593', '5176', '41595']) {
    assert.ok(!text.includes(stale), `${file} 仍残留旧端口 ${stale}`);
  }
}

// ── 2. 权限面 ──────────────────────────────────────────────────────────────

const REVIEWED_PERMISSIONS = ['activeTab', 'storage', 'tabs'];
assert.deepEqual(
  [...manifest.permissions].sort(),
  [...REVIEWED_PERMISSIONS].sort(),
  'permissions 与经审计的集合不符：新增权限须先证明有真实消费者并同步 README.md',
);

const hostPermissions = manifest.host_permissions;
assert.ok(Array.isArray(hostPermissions) && hostPermissions.length > 0, 'host_permissions 不得为空');
assert.deepEqual(
  [...hostPermissions].sort(),
  ['http://127.0.0.1/*', 'http://localhost/*'],
  'host_permissions 必须收敛在 loopback 全端口；任何外部主机或通配 scheme 都不得出现',
);
for (const pattern of hostPermissions) {
  assert.ok(!/:\d/.test(pattern), `host_permissions 不应写死端口（MV3 匹配模式忽略端口）：${pattern}`);
}

/** MV3 匹配模式语义：scheme + host 相等，**端口不参与匹配**，path 作前缀匹配。 */
function matchesHostPattern(pattern, url) {
  const parsed = new URL(url);
  const match = pattern.match(/^(\*|https?):\/\/([^/]+)(\/.*)$/);
  if (!match) return false;
  const [, scheme, host, prefix] = match;
  if (scheme !== '*' && scheme !== parsed.protocol.replace(':', '')) return false;
  if (host !== parsed.hostname) return false;
  const pathPrefix = prefix.replace(/\*$/, '');
  return parsed.pathname.startsWith(pathPrefix);
}

// 闭合性：扩展在默认部署与非默认端口部署下**实际会请求的**地址，都必须被权限面覆盖。
const coveredTargets = [
  `${declaredApi}/api/collect`,
  `http://127.0.0.1:${productionExtensionPort}/api/collect`,
  `http://localhost:41888/api/collect`,
];
for (const target of coveredTargets) {
  assert.ok(
    hostPermissions.some((pattern) => matchesHostPattern(pattern, target)),
    `权限面未覆盖扩展的真实连接目标：${target}`,
  );
}

// content_scripts 的匹配面是扩展的核心用途本身（采集任意页面），须保留且显式。
assert.deepEqual(manifest.content_scripts?.[0]?.matches, ['<all_urls>'], 'content_scripts 匹配面必须是 <all_urls>');

// ── 3. popup 的两种加载环境 ────────────────────────────────────────────────

assert.ok(
  !popupHtml.includes(RUNTIME_CONFIG_PATH),
  '扩展本体的 popup.html 不得含运行时配置标签——它是从磁盘加载的，注入只属于 HTTP 演示副本',
);
assert.ok(
  injectRuntimeConfigTag(popupHtml).includes(RUNTIME_CONFIG_PATH),
  '演示副本必须能被打上运行时配置标签，否则 HTTP 路径与扩展路径就没有差别可言',
);
assert.ok(
  popupJs.includes('chrome.runtime && chrome.runtime.id'),
  'popup.js 必须显式判定扩展环境，避免演示态抛出无从追查的 TypeError',
);

// ── 4. 对照物仍在，且确实不是同一个东西 ────────────────────────────────────
//
// `tests/fixtures/browser-extension-mv2` 是 MV2 对照物：它证明「MV3 交付物」与「旧 fixture」
// 的差别是真实的（实测中它也是 electron 宿主里唯一能回包的扩展）。删掉它，这条对照就没了。
const mv2Root = path.join(projectRoot, 'tests/fixtures/browser-extension-mv2');
assert.ok(fs.existsSync(mv2Root), 'MV2 对照物缺失：它必须保留，否则无法证明 MV2 与 MV3 交付物不同');
const mv2Manifest = JSON.parse(fs.readFileSync(path.join(mv2Root, 'manifest.json'), 'utf8'));
assert.equal(mv2Manifest.manifest_version, 2, '对照物必须仍是 MV2');
assert.equal(manifest.manifest_version, 3, '交付物必须仍是 MV3');
const mv2Content = fs.readFileSync(path.join(mv2Root, 'content.js'), 'utf8');
// 两者的真实差别不在「写哪个属性名」——对照物**两个都写**（MV2 时代契约是在属性里带完整响应体，
// 后来被补上了 MV3 的属性名）。差别是 MV3 交付物只在属性里放一个存在标记，响应体只经
// `window.postMessage` 回页面；e2e 因此必须从 postMessage 通道取响应，而不是 JSON.parse 属性。
assert.ok(
  mv2Content.includes('data-eagle-reverse-response') && mv2Content.includes('data-eagle-reverse-send-response'),
  '对照物应同时写两个属性名，以保留「属性里带响应体」这一 MV2 时代契约',
);
const mv3Content = read('content.js');
assert.ok(mv3Content.includes('data-eagle-reverse-send-response'), 'MV3 交付物应写 data-eagle-reverse-send-response');
assert.ok(
  !mv3Content.includes('data-eagle-reverse-response'),
  'MV3 交付物不应再写 MV2 时代的 data-eagle-reverse-response（响应体只走 window.postMessage）',
);

// ── 5. 交付物与源码一致 ────────────────────────────────────────────────────

/** 递归列出扩展目录下的相对文件路径（icons/ 等子目录也要比对）。 */
function listFiles(root, prefix = '') {
  const found = [];
  for (const entry of fs.readdirSync(path.join(root, prefix), { withFileTypes: true })) {
    const rel = prefix ? path.join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) found.push(...listFiles(root, rel));
    else found.push(rel);
  }
  return found.sort();
}

const sourceFiles = listFiles(extensionRoot);
if (fs.existsSync(distRoot)) {
  for (const file of sourceFiles) {
    const delivered = path.join(distRoot, file);
    assert.ok(fs.existsSync(delivered), `产物缺少扩展文件：${file}（请先 npm run build）`);
    assert.ok(
      fs.readFileSync(path.join(extensionRoot, file)).equals(fs.readFileSync(delivered)),
      `产物中的 ${file} 与源码不一致——扩展是按逐字副本交付的，产物不等于源码即交付物不是被测对象`,
    );
  }
  console.log(`Browser extension delivery contract passed（含产物逐字比对：${sourceFiles.length} 个文件）`);
} else {
  console.log('Browser extension delivery contract passed（产物目录不存在，已跳过逐字比对；先 npm run build 可启用）');
}
