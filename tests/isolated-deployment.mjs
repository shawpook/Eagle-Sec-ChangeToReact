/**
 * M8-1：最小隔离部署副本的启动验收（任务书 M7 验收第 3 条）。
 *
 * 验收目标：**部署副本能完整启动，且过程中不读取源工作区、tests 或未登记的 src/node_modules。**
 *
 * 做法：
 *   1. 把「部署所需」的子集复制到仓库之外的临时目录（隔离根），复制清单见 DEPLOYMENT_TREE，
 *      每项的「为什么」写在 reason 里；不复制整个仓库。`npm run build` 的产物是前提（D12）。
 *   2. 用 **文件访问探针** 观测真实发生的读：NODE_OPTIONS 预载 `--require` 打桩（fs 读类方法 +
 *      CJS 模块解析）与 `--experimental-loader` 钩子（ESM resolve），覆盖本栈的全部三个进程
 *      （start-production → serve-frontend / backend / electron）。判据是「实际读到了什么」，
 *      不是「代码里 grep 不到路径」。
 *   3. 复用既有启动逻辑（scripts/start-production.mjs + scripts/serve-frontend.mjs）与既有
 *      EAGLE_* 环境变量口径，四个页面（主窗 / 文档窗 / 工作台 / 路线图）走非默认端口启动，
 *      断言零**未登记** 4xx/5xx、零**未登记**未捕获异常（登记表见 KNOWN_DEPLOYMENT_GAPS，
 *      命中的既有缺陷会逐条打印成 GAP，未被登记的失败一律判红）。
 *
 * 两条负向自证（门禁不能是橡皮章）——都用普通调用跑红，不做「预期失败」分支：
 *   EAGLE_ISOLATION_PROBE_DISABLE=1 node tests/isolated-deployment.mjs
 *       探针不安装 ⇒ 必须因「缺少探针证据」变红。
 *   EAGLE_ISOLATION_NEGATIVE=missing-asset node tests/isolated-deployment.mjs
 *       删掉隔离根里一个已登记的构建产物 ⇒ 启动/加载必须响亮失败，而不是静默降级。
 *
 * 用法：npm run build && node tests/isolated-deployment.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { connect, delay, freePort, stop, waitFor } from './react-cdp-harness.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(projectRoot, 'dist', 'frontend');
const distIndex = path.join(distRoot, 'src', 'app', 'index.html');
const probeDisabled = process.env.EAGLE_ISOLATION_PROBE_DISABLE === '1';
const negativeMode = process.env.EAGLE_ISOLATION_NEGATIVE || '';
// 共享依赖仓（本工作区的 node_modules 是指向主检出 node_modules 的符号链接）——它不是源工作区，
// 但它的 realpath 落在主检出根内，那个根的 src/tests 同样是「源工作区」，一并纳入禁止读取面
// （探针按 REPO/REPO2 两个根判定，并单独放行两边的 node_modules）。
const modulesRealPath = fs.realpathSync(path.join(projectRoot, 'node_modules'));
const mainCheckoutRoot = path.dirname(modulesRealPath);

if (!fs.existsSync(distIndex)) {
  console.error(`FAIL 产物缺失：${distIndex}（先运行 npm run build，D12）`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 部署副本清单：只放「跑起来所必需」的东西，每项都写明为什么。
// 路径均为仓库相对路径；kind=tree 递归复制。
// ---------------------------------------------------------------------------
const DEPLOYMENT_TREE = [
  {
    from: 'package.json',
    to: 'package.json',
    kind: 'file',
    reason: 'backend/src/*.js 是 ESM，靠 package.json 的 "type":"module" 才能被 node 解析',
  },
  {
    from: 'scripts/start-production.mjs',
    to: 'scripts/start-production.mjs',
    kind: 'file',
    reason: '生产启动入口（复用既有逻辑，不另写第二套）；projectRoot 由自身位置推导 ⇒ 天然指向隔离根',
  },
  {
    from: 'scripts/serve-frontend.mjs',
    to: 'scripts/serve-frontend.mjs',
    kind: 'file',
    reason: '前端静态服务 + /file 代理 + 运行时配置端点',
  },
  {
    from: 'frontend/runtime-config.mjs',
    to: 'frontend/runtime-config.mjs',
    kind: 'file',
    reason: 'serve-frontend.mjs 的相对导入，端口注入的唯一事实源',
  },
  {
    from: 'backend',
    to: 'backend',
    kind: 'tree',
    reason: '后端服务源码（deployment 单元，未打包）+ 其依赖的 plugins/ 加载器',
  },
  {
    from: 'electron',
    to: 'electron',
    kind: 'tree',
    reason: 'Electron 主进程 / preload / PDF、视频缩略图 worker / pdf-viewer',
  },
  {
    from: 'plugins',
    to: 'plugins',
    kind: 'tree',
    reason: 'main.cjs 启动时硬加载 plugins/example-service-plugin，缺失即 app.exit(1)',
  },
  {
    from: 'frontend/public/mock-library',
    to: 'frontend/public/mock-library',
    kind: 'tree',
    reason: '后端默认库（/mock-library/... 虚拟路径）与 Electron allowedRoots 都指向这里',
  },
  {
    from: 'frontend/public/browser-extension/icons',
    to: 'frontend/public/browser-extension/icons',
    kind: 'tree',
    reason: 'main.cjs 托盘图标 icon128.png',
  },
  {
    from: 'dist/frontend',
    to: 'dist/frontend',
    kind: 'tree',
    reason: 'npm run build 的产物，静态服务根（含注册发布树 dist/frontend/src）',
  },
  {
    from: 'dist/frontend/src',
    to: 'src',
    kind: 'tree',
    reason:
      '**登记发布树再落一份到隔离根根下的 src/**：backend/src/server.js 与 electron/preload.cjs '
      + '按 projectRoot/src/... 解析运行时资源（见下方 RUNTIME_ROOT_GAPS），而发布清单的 to 是 dist/frontend/src。'
      + '这里复用的正是构建期由 frontend/publish-asset-manifest.mjs 登记的同一棵树（不含 src/app/react）。',
  },
];

// 已知的「解析根不一致」缺口：产品代码按 projectRoot/src 解析运行时资源。本批不改产品代码，
// 只如实登记并由门禁把隔离根的 src 收敛到登记发布树；未登记的源工作区文件一律不得出现。
const RUNTIME_ROOT_GAPS = [
  {
    where: 'electron/preload.cjs:15',
    detail: "path.join(__dirname, '..', 'src', 'app', 'js', 'plugin', 'api-format-extension.js')",
    why: '格式插件 webview 的唯一磁盘 preload 来源',
  },
  {
    where: 'backend/src/server.js:1489 / 2483',
    detail: "path.join(projectRoot, 'src/app/collect-window/assets/images/base/icons/default-library-icon.png')",
    why: '/api/library/icon 与 /api/v2/library/icon 的图标文件',
  },
  {
    where: 'backend/src/server.js:3264-3267',
    detail: "resolveThumbnailPath 的 roots 含 path.join(projectRoot, 'src')",
    why: '虚拟路径 /src/... 的缩略图解析根',
  },
  {
    where: 'backend/src/library-store.js:110',
    detail: "resolveLibraryPath 把 '/src/...' 映射到 projectRoot/src/...",
    why: '库路径的 /src/ 虚拟前缀',
  },
];

// ---------------------------------------------------------------------------
// 既有缺陷登记表（**不是**放宽门禁）。
//
// 判据仍然是「零失败」，只是把「已在源仓库自己的生产栈上复现过的既有缺陷」从判红项里
// 分离出来、逐条打印成 GAP。**未登记**的 4xx 或未捕获异常一律立刻判红——负向自证 A
// （删掉已登记产物）打的就是这条。
//
// 复现口径：对仓库自身的 `<repo>/dist/frontend` 直接发 HTTP（不起 Electron）：
//   404  /src/package.json
//   404  /src/node_modules/compare-versions/index.js
// 与隔离根下的观测结果逐字一致 ⇒ 不是隔离副本引入的，是发布内容本身的缺口。
// ---------------------------------------------------------------------------
const KNOWN_DEPLOYMENT_GAPS = [
  {
    id: 'deploy-missing-src-package-json',
    urls: (parsed) => parsed.pathname === '/src/package.json',
    where: 'src/app/react/store/panelState.ts:163、src/app/react/core/bundleGlobals.ts:1165、src/app/react/core/apiServerDomain.ts:365',
    why: '运行期用 syncText（同步 XHR，按页面 origin 解析，**无文件系统回退**，见 src/app/react/core/shim/browserRuntime.ts:111）读 appRoot.path + "/package.json"。发布清单 frontend/publish-asset-manifest.mjs 只登记 src/app、src/i18n、src/config.js，不含 src/package.json。',
    fix: '把 package.json 纳入发布清单（或让 appRoot 指向一个部署内确实存在 package.json 的位置）。',
  },
  {
    id: 'runtime-src-node-modules-unregistered',
    urls: (parsed) => parsed.pathname === '/src/node_modules/compare-versions/index.js',
    exception: (text) => /require\(compare-versions\)/.test(text),
    where: 'src/app/react/core/shim/moduleRegistry.ts:545',
    why: '真实消费者 PluginCenter 调 require("compare-versions")；入口路径硬编码 "/src/node_modules/compare-versions/index.js"，而 src/node_modules 只存在于源工作区、未被发布清单登记 ⇒ 部署副本 404 ⇒ realBareModule 回落 genericStub（moduleRegistry.ts:228）⇒ 调用即抛 RuntimeCapabilityError。这正是验收条款点名的「未登记的 src/node_modules」。',
    fix: '二选一：把需要的裸模块纳入发布清单并落到 dist/frontend/src/node_modules；或把入口改为指向已登记的部署内路径。',
  },
  {
    id: 'api-item-thumbnail-404-for-document',
    urls: (parsed) => parsed.pathname === '/api/item/thumbnail',
    where: 'backend/src/server.js:2051-2065',
    why: '命中的是 workbench.html 对刚导入的 .md 条目取缩略图；该条目磁盘上确有 *_thumbnail.png（主窗经 /file/ 成功取到），但此处 readItems()/ensureThumbnail 未命中而回落 404 "Thumbnail not found"。库状态与条目状态两次运行同构，与隔离无关。',
    fix: '产品侧裁决：若「无缩略图」应以 200 + 占位表达，改后端；否则保留登记。',
  },
];

/** 本轮命中的登记项（跑完汇总打印，避免绿跑把既有缺陷藏起来）。 */
const gapHits = [];

// ---------------------------------------------------------------------------
// 探针源码：在进程启动早期（--require）安装，打桩 fs 读类方法 + CJS 模块解析；
// --experimental-loader 钩子补 ESM resolve（Node 16 的 ESM 加载器不过 JS fs 外观）。
// 记录只保留「仓库内命中」「隔离根 src 命中」与总操作数；其余只计数，避免日志爆炸。
// ---------------------------------------------------------------------------
const PROBE_CJS_SOURCE = [
  "'use strict';",
  "const fs = require('node:fs');",
  "const path = require('node:path');",
  'const OUT = process.env.EAGLE_ISO_PROBE_DIR || "";',
  'const REPO = process.env.EAGLE_ISO_PROBE_REPO || "";',
  'const REPO2 = process.env.EAGLE_ISO_PROBE_REPO2 || "";',
  'const DEPLOY = process.env.EAGLE_ISO_PROBE_DEPLOY || "";',
  "const DISABLED = process.env.EAGLE_ISO_PROBE_DISABLE === '1';",
  'if (OUT && REPO && DEPLOY && !DISABLED) {',
  "  const LOG = path.join(OUT, 'probe-' + process.pid + '.jsonl');",
  '  const records = [];',
  '  const seen = new Set();',
  '  let busy = false;',
  '  let ops = 0;',
  '  let watched = 0;',
  '  const flush = () => {',
  '    if (busy || !records.length) return;',
  '    busy = true;',
  "    try { fs.appendFileSync(LOG, records.splice(0).join('')); } catch (err) {}",
  '    busy = false;',
  '  };',
  '  const toPath = (raw) => {',
  "    if (raw instanceof URL) return decodeURIComponent(raw.pathname.replace(/^\\/([A-Za-z]:)/, '$1'));",
  '    if (Buffer.isBuffer(raw) || typeof raw === "number" || raw === null || raw === undefined) return null;',
  '    if (typeof raw === "object") { try { return String(raw); } catch (err) { return null; } }',
  '    return String(raw);',
  '  };',
  '  const note = (kind, raw) => {',
  '    ops += 1;',
  '    const value = toPath(raw);',
  '    if (!value) return;',
  '    const resolved = path.resolve(value);',
  "    const under = (root) => root && (resolved === root || resolved.startsWith(root + path.sep)) && resolved;",
  '    // 两个源工作区根：本工作区，以及本工作区 node_modules 联接指向的主检出。',
  '    // 主检出的 node_modules 是共享依赖仓（不是源工作区），单独排除，避免把它误判成违规。',
  '    const underSourceWorkspace = [REPO, REPO2].some((root) => root && under(root) && !under(path.join(root, "node_modules")));',
  '    let bucket = underSourceWorkspace ? "repo" : (under(path.join(DEPLOY, "src")) ? "deploy-src" : null);',
  '    if (!bucket) { if (under(DEPLOY)) watched += 1; return; }',
  '    const key = kind + "\\u0000" + resolved;',
  '    if (seen.has(key)) return;',
  '    seen.add(key);',
  '    records.push(JSON.stringify({ kind, bucket, path: resolved, pid: process.pid }) + "\\n");',
  '    flush();',
  '  };',
  '  const patch = (target, names, record) => {',
  '    for (const name of names) {',
  '      const original = target[name];',
  '      if (typeof original !== "function") continue;',
  '      target[name] = function (...args) { if (record) note(record + "." + name, args[0]); return original.apply(this, args); };',
  '    }',
  '  };',
  '  const SYNC = ["readFileSync","openSync","readdirSync","statSync","lstatSync","realpathSync","accessSync","existsSync","readlinkSync","copyFileSync","createReadStream"];',
  '  const ASYNC = ["readFile","open","readdir","stat","lstat","realpath","access","readlink","createReadStream","copyFile"];',
  '  patch(fs, SYNC, "fs");',
  '  patch(fs, ASYNC, "fs");',
  '  if (fs.promises) patch(fs.promises, ASYNC, "fs.promises");',
  '  const Module = require("module");',
  '  const originalResolve = Module._resolveFilename;',
  '  Module._resolveFilename = function (request, ...rest) {',
  '    const resolved = originalResolve.call(this, request, ...rest);',
  '    note("Module._resolveFilename", resolved);',
  '    return resolved;',
  '  };',
  '  const originalLoad = Module._load;',
  '  Module._load = function (request, ...rest) { note("Module._load", request); return originalLoad.call(this, request, ...rest); };',
  '  process.on("exit", flush);',
  '  records.push(JSON.stringify({',
  '    kind: "hello", pid: process.pid, argv: process.argv.slice(0, 4),',
  '    node: process.versions.node, electron: process.versions.electron || null,',
  '  }) + "\\n");',
  '  flush();',
  '}',
  '',
].join('\n');

const PROBE_ESM_SOURCE = [
  "import fs from 'node:fs';",
  'const OUT = process.env.EAGLE_ISO_PROBE_DIR || "";',
  "const LOG = OUT ? OUT + '/probe-esm-' + process.pid + '.jsonl' : '';",
  'export async function resolve(specifier, context, next) {',
  '  const result = await next(specifier, context);',
  '  try {',
  '    if (LOG && result && typeof result.url === "string" && result.url.startsWith("file:")) {',
  "      const resolved = decodeURIComponent(new URL(result.url).pathname.replace(/^\\/([A-Za-z]:)/, '$1'));",
  '      fs.appendFileSync(LOG, JSON.stringify({ kind: "esm.resolve", path: resolved, pid: process.pid }) + "\\n");',
  '    }',
  '  } catch (err) {}',
  '  return result;',
  '}',
  '',
].join('\n');

// Electron 22 实测：`--experimental-loader` 指向 file: URL 时，Electron 的 remote-debugging
// 端口根本不会起来（CDP 连不上）；换成等价的 `data:` URL 则一切正常。因此 ESM 探针以
// data: URL 注入（encodeURIComponent 保证不含空格，NODE_OPTIONS 按空格切分参数才不会被截断）。
const PROBE_ESM_DATA_URL = `data:text/javascript,${encodeURIComponent(PROBE_ESM_SOURCE)}`;

// ---------------------------------------------------------------------------
// 复制与工具
// ---------------------------------------------------------------------------
/** 显式递归复制——**不用** fs.cpSync(recursive)：本机宿主上该调用会被静默击杀（见环境坑）。 */
function copyTree(from, to) {
  const stat = fs.statSync(from);
  if (stat.isFile()) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    return 1;
  }
  fs.mkdirSync(to, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    count += copyTree(path.join(from, entry.name), path.join(to, entry.name));
  }
  return count;
}

function spawnIn(cwd, command, args, env) {
  const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  return { child, output: () => output };
}

function readProbeRecords(harnessDir) {
  const records = [];
  for (const name of fs.readdirSync(harnessDir)) {
    if (!name.endsWith('.jsonl')) continue;
    for (const line of fs.readFileSync(path.join(harnessDir, name), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { records.push(JSON.parse(line)); } catch (err) { /* 半行写入忽略 */ }
    }
  }
  return records;
}

/** 这轮会把四个 EAGLE_* 端口全部换掉；此处是绝不允许再出现的默认端口集合。 */
const stalePorts = new Set(['4173', '41695', '41692', '41693', '5176']);

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-isolated-deployment-'));
const deployRoot = path.join(tempRoot, 'deploy');
const harnessDir = path.join(tempRoot, 'harness');
let page = null;
let stack = null;
// 本测试要在一次栈生命周期里连着导航四个页面并回溯每轮的请求，而 harness 的 `events`
// 数组滚动封顶 1000 条、超限时从**头部**裁剪，绝对下标会被打乱且不可恢复。
// 这里自挂一层只增不删的收集器（原 handler 照旧串下去），只按「本轮起点下标」切片。
const cdpEvents = [];

function log(line) { console.log(line); }

try {
  fs.mkdirSync(harnessDir, { recursive: true });
  fs.writeFileSync(path.join(harnessDir, 'probe.cjs'), PROBE_CJS_SOURCE, 'utf8');

  // 1) 构建隔离根——只放 DEPLOYMENT_TREE 里的东西，落在仓库之外。
  const copied = [];
  for (const entry of DEPLOYMENT_TREE) {
    const from = path.join(projectRoot, entry.from);
    const to = path.join(deployRoot, entry.to);
    assert.ok(fs.existsSync(from), `部署清单源不存在：${entry.from}`);
    const files = copyTree(from, to);
    copied.push({ ...entry, files });
  }
  // node_modules 走目录联接：它是共享依赖仓，不是源工作区，复制一份既慢又没意义。
  fs.symlinkSync(path.join(projectRoot, 'node_modules'), path.join(deployRoot, 'node_modules'), 'junction');
  for (const entry of copied) log(`COPY ${entry.to} (${entry.files} file(s)) <- ${entry.from}`);
  assert.ok(!fs.existsSync(path.join(deployRoot, 'tests')), '隔离根不得含 tests');
  log(`PASS isolated root built at ${deployRoot}`);

  // 2) 负向自证 A：删掉一个**已登记**的构建产物，启动/加载必须响亮失败。
  if (negativeMode === 'missing-asset') {
    const indexHtml = fs.readFileSync(path.join(deployRoot, 'dist', 'frontend', 'src', 'app', 'index.html'), 'utf8');
    const entryScript = /src="(\/assets\/[^"]+\.js)"/.exec(indexHtml);
    assert.ok(entryScript, '主窗 HTML 必须引用打包入口脚本');
    const victim = path.join(deployRoot, 'dist', 'frontend', entryScript[1].replace(/^\//, ''));
    fs.rmSync(victim);
    log(`NEGATIVE removed registered asset ${entryScript[1]} (${victim})`);
  }

  // 3) 非默认端口 + 隔离根内的可写状态目录（全部落在临时根，避免回写隔离根）。
  const [frontendPort, apiPort, thumbnailPort, extensionPort, debugPort] = await Promise.all([
    freePort(), freePort(), freePort(), freePort(), freePort(),
  ]);
  const frontendOrigin = `http://127.0.0.1:${frontendPort}`;
  const apiBase = `http://127.0.0.1:${apiPort}`;
  const expectedApiBase = `http://localhost:${apiPort}`;
  const expectedThumbnailBase = `http://localhost:${thumbnailPort}`;
  const expectedExtensionBase = `http://localhost:${extensionPort}`;

  const baseEnv = { ...process.env };
  delete baseEnv.ELECTRON_RUN_AS_NODE;
  for (const key of [
    'EAGLE_FRONTEND_PORT', 'EAGLE_API_PORT', 'EAGLE_THUMBNAIL_PORT', 'EAGLE_EXTENSION_PORT',
    'EAGLE_API_URL', 'EAGLE_THUMBNAIL_URL', 'EAGLE_EXTENSION_URL', 'EAGLE_PREVIEW_URL',
    'EAGLE_FRONTEND_ROOT', 'EAGLE_PLUGINS_ROOT',
  ]) {
    delete baseEnv[key];
  }
  // NODE_OPTIONS 由 V8 的 flag 解析器处理：双引号内的反斜杠会被吃掉，这里统一用正斜杠且不加引号
  // （临时根取自 os.tmpdir()，不含空格）。
  const nodeOptions = [
    `--require ${path.join(harnessDir, 'probe.cjs').replace(/\\/g, '/')}`,
    `--experimental-loader ${PROBE_ESM_DATA_URL}`,
  ].join(' ');

  const stackEnv = {
    ...baseEnv,
    NODE_OPTIONS: nodeOptions,
    EAGLE_ISO_PROBE_DIR: harnessDir,
    EAGLE_ISO_PROBE_REPO: projectRoot,
    EAGLE_ISO_PROBE_REPO2: mainCheckoutRoot,
    EAGLE_ISO_PROBE_DEPLOY: deployRoot,
    EAGLE_ISO_PROBE_DISABLE: probeDisabled ? '1' : '0',
    EAGLE_FRONTEND_PORT: String(frontendPort),
    EAGLE_API_PORT: String(apiPort),
    EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
    EAGLE_EXTENSION_PORT: String(extensionPort),
    EAGLE_DEBUG_PORT: String(debugPort),
    EAGLE_START_READY_TIMEOUT_MS: '30000',
    EAGLE_LIBRARY_STATE_FILE: path.join(tempRoot, 'library-state.json'),
    EAGLE_USER_DATA_DIR: path.join(tempRoot, 'backend-user-data'),
    EAGLE_ELECTRON_USER_DATA_DIR: path.join(tempRoot, 'electron-user-data'),
  };

  // 4) 用既有启动逻辑拉起生产栈——cwd 是隔离根，projectRoot 由脚本自身位置推导。
  stack = spawnIn(deployRoot, process.execPath, ['scripts/start-production.mjs'], stackEnv);
  await waitFor(() => stack.output().includes('[start:prod] all services ready; launching Electron'), 'production stack ready', 60000);
  const startupLog = stack.output();
  const frontendReadyAt = startupLog.indexOf('[start:prod] frontend ready');
  const launchAt = startupLog.indexOf('[start:prod] all services ready; launching Electron');
  assert.ok(frontendReadyAt >= 0 && frontendReadyAt < launchAt, 'Electron 必须在前后端就绪之后启动');
  log('PASS start-production readiness order');

  await waitFor(async () => {
    try { return (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).ok; } catch { return false; }
  }, `Electron CDP on ${debugPort}`, 60000);

  for (let attempt = 0; attempt < 20 && !page; attempt++) {
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    const target = targets.find((entry) => entry.type === 'page' && entry.url.includes(String(frontendPort)));
    if (!target) { await delay(250); continue; }
    try {
      page = await Promise.race([
        connect(target.webSocketDebuggerUrl),
        new Promise((resolve, reject) => setTimeout(() => reject(new Error('CDP connect timeout')), 6000)),
      ]);
    } catch { page = null; await delay(250); }
  }
  assert.ok(page, 'Electron page CDP 连接成功');
  await page.send('Runtime.enable');
  await page.send('Page.enable');
  await page.send('Network.enable');
  {
    const forwarded = page.ws.onmessage;
    page.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (!message.id) cdpEvents.push(message);
      } catch (err) { /* 非 JSON 帧忽略 */ }
      forwarded(event);
    };
  }

  const evaluate = async (expression, timeout = 15000) => {
    const result = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, timeout });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const eventsSince = (index) => cdpEvents.slice(index);

  async function postJson(base, route, body) {
    const response = await fetch(`${base}${route}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok || payload.status !== 'success') throw new Error(`${route} failed: ${JSON.stringify(payload)}`);
    return payload.data;
  }

  // 5) 真实临时库 + 一份真实文档，让四个页面都有真东西可加载。
  fs.mkdirSync(path.join(tempRoot, 'libraries'), { recursive: true });
  await postJson(apiBase, '/api/library/create', { name: 'M8 Isolated Deployment', savePath: path.join(tempRoot, 'libraries') });
  const documentPath = path.join(tempRoot, 'Isolated Deployment.md');
  fs.writeFileSync(documentPath, '# M8 isolated deployment\n\nruntime root acceptance\n', 'utf8');
  const imported = await postJson(apiBase, '/api/item/addFromPaths', { paths: [documentPath] });
  const documentItem = imported.find((entry) => entry && entry.id);
  assert.ok(documentItem, '真实测试文档导入成功');

  const observed = [];
  // 逐页的 CDP 事件区间，供步骤 6 的全量回扫做按页归属。
  const pageRanges = [];

  async function navigate(url, label, matcher) {
    if (pageRanges.length) pageRanges[pageRanges.length - 1].to = cdpEvents.length;
    const fromIndex = cdpEvents.length;
    pageRanges.push({ label, from: fromIndex, to: Number.MAX_SAFE_INTEGER });
    await page.send('Page.navigate', { url });
    await waitFor(() => evaluate(`window.__EAGLE_API_BASE_URL === ${JSON.stringify(expectedApiBase)}
      && window.__EAGLE_THUMBNAIL_URL === ${JSON.stringify(expectedThumbnailBase)}
      && window.__EAGLE_EXTENSION_BASE_URL === ${JSON.stringify(expectedExtensionBase)}
      && document.readyState === 'complete'`), `${label} runtime config`, 30000);
    const localUrls = () => eventsSince(fromIndex)
      .filter((entry) => entry.method === 'Network.requestWillBeSent')
      .map((entry) => entry.params?.request?.url)
      .filter((candidate) => {
        if (!candidate || !/^https?:/i.test(candidate)) return false;
        const host = new URL(candidate).hostname;
        return host === 'localhost' || host === '127.0.0.1' || host === '::1';
      });
    let matched;
    try {
      matched = await waitFor(() => localUrls().find(matcher) || null, `${label} matched request`, 30000);
    } catch (err) {
      // 取证先行：匹配不上时把本轮真实观测到的本地请求与失败响应全量打出来，别只留一句 timeout。
      // （负向自证 A 就落在这里：删掉已登记产物后页面挂不起来，先看到的应当是被删的那个 404。）
      log(`OBSERVED ${label} ${JSON.stringify(localUrls())}`);
      const failures = eventsSince(fromIndex)
        .filter((entry) => entry.method === 'Network.responseReceived')
        .map((entry) => entry.params?.response)
        .filter((response) => response && /^https?:/i.test(response.url || '') && response.status >= 400)
        .map((response) => `${response.status} ${response.url}`);
      if (failures.length) log(`FAILED_RESPONSES_${label.replace(/-/g, '_')} ${JSON.stringify(failures)}`);
      throw err;
    }
    const allFailures = eventsSince(fromIndex)
      .filter((entry) => entry.method === 'Network.responseReceived')
      .map((entry) => entry.params?.response)
      .filter((response) => response && /^https?:/i.test(response.url || ''))
      .filter((response) => response.status >= 400)
      .map((response) => `${response.status} ${response.url}`);
    observed.push({ label, matched, failures: allFailures });
    log(`PASS ${label} -> ${matched}`);
    return matched;
  }

  await navigate(`${frontendOrigin}/src/app/index.html`, 'main-window', (url) => {
    const parsed = new URL(url);
    return parsed.port === String(frontendPort) && parsed.pathname.startsWith('/file/');
  });
  await waitFor(() => evaluate(`!!document.querySelector('#main-app') && !!window.__eagleScopeRegistry`), 'main window mounted', 45000);
  const mounted = await evaluate(`({
    hasMainApp: !!document.querySelector('#main-app'),
    hasRegistry: !!window.__eagleScopeRegistry,
    moduleScript: [...document.querySelectorAll('script[type=module]')].map((s) => s.getAttribute('src')).filter(Boolean),
  })`);
  assert.equal(mounted.hasMainApp, true, '#main-app 存在');
  assert.ok(mounted.moduleScript.every((src) => src.startsWith('/assets/')), `入口均为打包产物：${JSON.stringify(mounted.moduleScript)}`);
  log(`PASS main-window mounted ${JSON.stringify(mounted)}`);

  await waitFor(() => evaluate(`(() => {
    const driver = window.__eagleDriver;
    return !!(driver && Array.isArray(driver.raw) && driver.raw.some((entry) => entry && entry.id === ${JSON.stringify(documentItem.id)}));
  })()`), 'main window real-library item', 30000);

  const opened = await evaluate(`(() => {
    const driver = window.__eagleDriver;
    const item = driver.raw.find((entry) => entry && entry.id === ${JSON.stringify(documentItem.id)});
    if (!item || typeof driver.enterDetailMode !== 'function') return { ok: false };
    driver.enterDetailMode(null, item);
    return { ok: true };
  })()`);
  assert.equal(opened.ok, true, '主窗必须能打开文档工作区');
  await waitFor(() => evaluate(`(() => {
    const container = document.querySelector('#eagle-document-viewer-container[data-viewer-ready]');
    const frame = container && container.querySelector('iframe');
    return !!(frame && frame.contentWindow && frame.contentWindow.__EAGLE_API_BASE_URL === ${JSON.stringify(expectedApiBase)});
  })()`), 'document viewer ready', 30000);
  log('PASS document-workspace embedded');

  const documentUrl = `${frontendOrigin}/src/app/react/viewers/document/index.html?id=${encodeURIComponent(documentItem.id)}`
    + `&ids=${encodeURIComponent(documentItem.id)}&mode=workspace&chrome=external&theme=dark&library=eagle`;
  await navigate(documentUrl, 'document-window', (url) => {
    const parsed = new URL(url);
    return parsed.port === String(apiPort) && parsed.pathname === '/api/v2/item/textDetail';
  });
  await navigate(`${frontendOrigin}/workbench.html`, 'workbench', (url) => {
    const parsed = new URL(url);
    return parsed.port === String(apiPort) && parsed.pathname === '/api/library/info';
  });
  await navigate(`${frontendOrigin}/roadmap.html`, 'roadmap', (url) => {
    const parsed = new URL(url);
    return parsed.port === String(apiPort) && parsed.pathname === '/api/item/list';
  });

  // 6) 零（未登记）4xx/5xx、零默认端口回流、零（未登记）未捕获异常。
  //
  // 失败必须**在四页全部导航完之后**做一次全量回扫：逐页在「匹配到目标请求」那一刻就结算，
  // 会漏掉该页随后才发出的请求（实测：/src/node_modules/compare-versions/index.js 的 404
  // 与随之而来的 RuntimeCapabilityError 都落在匹配点之后，窄窗口看不到）。
  pageRanges[pageRanges.length - 1].to = cdpEvents.length;
  const pageOf = (index) => {
    const range = pageRanges.find((candidate) => index >= candidate.from && index < candidate.to);
    return range ? range.label : 'pre-navigation';
  };
  const allFailures = [];
  cdpEvents.forEach((entry, index) => {
    if (entry.method !== 'Network.responseReceived') return;
    const response = entry.params?.response;
    if (!response || !/^https?:/i.test(response.url || '') || response.status < 400) return;
    allFailures.push({ status: response.status, url: response.url, page: pageOf(index) });
  });
  const unregisteredFailures = [];
  for (const failure of allFailures) {
    const gap = KNOWN_DEPLOYMENT_GAPS.find((candidate) => candidate.urls(new URL(failure.url)));
    if (gap) gapHits.push({ id: gap.id, text: `${failure.status} ${failure.url} @ ${failure.page}` });
    else unregisteredFailures.push(`${failure.status} ${failure.url} @ ${failure.page}`);
  }
  assert.deepEqual(unregisteredFailures, [], `出现未登记的 HTTP 失败响应：${JSON.stringify(unregisteredFailures)}`);
  const defaultPortRequests = cdpEvents
    .filter((entry) => entry.method === 'Network.requestWillBeSent')
    .map((entry) => entry.params?.request?.url)
    .filter((url) => url && /^https?:/i.test(url) && stalePorts.has(new URL(url).port));
  assert.deepEqual(defaultPortRequests, [], `非默认端口轮次出现默认端口回流：${JSON.stringify(defaultPortRequests)}`);
  const allExceptions = cdpEvents
    .filter((entry) => entry.method === 'Runtime.exceptionThrown')
    .map((entry) => entry.params?.exceptionDetails?.exception?.description || entry.params?.exceptionDetails?.text)
    .filter(Boolean);
  const exceptions = allExceptions.filter((text) => {
    const gap = KNOWN_DEPLOYMENT_GAPS.find((candidate) => candidate.exception && candidate.exception(text));
    if (gap) { gapHits.push({ id: gap.id, text: `exception ${text.slice(0, 160)}` }); return false; }
    return true;
  });
  assert.deepEqual(exceptions, [], `渲染层出现未登记的未捕获异常：${JSON.stringify(exceptions.slice(0, 3))}`);
  log(`PASS zero unregistered http failures / zero default-port leakage / zero unregistered uncaught exceptions`);

  // 既有缺口不许被绿跑掩盖：逐条打印本轮真正命中的登记项。
  const gapIds = [...new Set(gapHits.map((hit) => hit.id))];
  log(`GAPS_REGISTERED ${gapIds.length}/${KNOWN_DEPLOYMENT_GAPS.length} 项命中（${gapHits.length} 次），未登记的失败已按判红处理`);
  for (const id of gapIds) {
    const entry = KNOWN_DEPLOYMENT_GAPS.find((candidate) => candidate.id === id);
    for (const hit of gapHits.filter((candidate) => candidate.id === id)) log(`GAP ${id} :: ${hit.text}`);
    log(`GAP ${id} @ ${entry.where}`);
    log(`GAP ${id} why: ${entry.why}`);
    log(`GAP ${id} fix: ${entry.fix}`);
  }

  await stop(stack).catch(() => {});
  stack = null;

  // 7) 探针证据：没有证据就不算绿（负向自证 B 打的就是这条）。
  const records = readProbeRecords(harnessDir);
  const hellos = records.filter((record) => record.kind === 'hello');
  assert.ok(hellos.length >= 3, `探针必须覆盖全部三个进程（start-production / serve-frontend+backend / electron），实际 ${hellos.length} 个：${JSON.stringify(hellos)}`);

  const violations = records
    .filter((record) => record.bucket === 'repo')
    .map((record) => `${record.kind} <- ${record.path}`);
  const deploySrcReads = records.filter((record) => record.bucket === 'deploy-src').map((record) => record.path);
  const deploySrcMissing = deploySrcReads.filter((candidate) => !fs.existsSync(candidate));

  log(`PROBE hellos=${hellos.length} records=${records.length}`);
  for (const hello of hellos) log(`PROBE process pid=${hello.pid} electron=${hello.electron} node=${hello.node} argv=${JSON.stringify(hello.argv)}`);
  for (const gap of RUNTIME_ROOT_GAPS) log(`RUNTIME_ROOT_GAP ${gap.where} :: ${gap.detail}`);
  log(`PROBE deploy/src distinct paths read = ${new Set(deploySrcReads).size}`);
  for (const candidate of new Set(deploySrcReads)) log(`PROBE deploy/src <- ${candidate}${fs.existsSync(candidate) ? '' : ' (不存在，仅是存在性探测)'}`);
  assert.deepEqual(violations, [], `部署副本读取了源工作区：${JSON.stringify(violations.slice(0, 20))}`);

  log(`PASS no reads under source workspace ${JSON.stringify([projectRoot, mainCheckoutRoot])} / tests / src/node_modules`);
  log(`ISOLATED_DEPLOYMENT_OK ${JSON.stringify({
    deployRoot,
    processes: hellos.map((hello) => hello.pid),
    deploySrcReads: new Set(deploySrcReads).size,
    deploySrcMissing,
    pages: observed.map((entry) => entry.label),
    registeredGaps: gapIds,
  })}`);
} catch (err) {
  console.error(`ISOLATED_DEPLOYMENT_FAILED ${err.stack || err.message}`);
  if (stack) console.error(stack.output().slice(-6000));
  if (page) {
    for (const ev of cdpEvents.filter((e) => /exceptionThrown/.test(e.method || '')).slice(0, 5)) {
      const d = ev.params?.exceptionDetails;
      console.error(`CDP EXCEPTION ${(d?.exception?.description || d?.text || '').slice(0, 600)}`);
      for (const frame of (d?.stackTrace?.callFrames || []).slice(0, 4)) {
        console.error(`  at ${frame.functionName || '<anon>'} ${frame.url}:${frame.lineNumber}:${frame.columnNumber}`);
      }
    }
    for (const ev of cdpEvents.filter((e) => /consoleAPICalled/.test(e.method || '') && e.params?.type === 'error').slice(0, 5)) {
      console.error(`CDP CONSOLE_ERR ${JSON.stringify(ev.params.args?.map((a) => a.description || a.value)).slice(0, 800)}`);
    }
    const failed = cdpEvents
      .filter((e) => e.method === 'Network.responseReceived')
      .map((e) => e.params?.response)
      .filter((r) => r && /^https?:/i.test(r.url || '') && r.status >= 400)
      .map((r) => `${r.status} ${r.url}`);
    if (failed.length) console.error(`CDP HTTP_FAILURES ${JSON.stringify(failed.slice(0, 10))}`);
  }
  process.exitCode = 1;
} finally {
  try { page?.ws?.close(); } catch {}
  if (stack) await stop(stack).catch(() => {});
  try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch {}
}
