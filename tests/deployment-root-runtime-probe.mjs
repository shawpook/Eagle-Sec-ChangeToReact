/**
 * R2-3 —— 部署根四处耦合点的**运行期**探针。
 *
 * 背景（独立验收报告 docs/audit-verification-2026-09-17.md §R2-3）：
 *   `tests/isolated-deployment.mjs` 对四处「解析根不一致」耦合点只有**静态存在性断言**
 *   （在部署根内 `path.join` 出一个路径，然后 `existsSync` 它）。它证明的是
 *   「把路径拼出来时存在」，不是「运行期真的解析到了部署根里那一份」——
 *   `projectRoot` 若哪天被指回源工作区，静态断言照样绿。
 *
 * 本探针补的就是那一层：**在真实部署根里起真实后端进程，发真实 HTTP 请求**，
 * 断言每一条耦合点在**运行期**解析出来的绝对路径落在部署根内、且读到的是**部署根里那一份**。
 *
 * 被覆盖的四条（与 docs/deployment-layout.md、tests/deployment-root.mjs 的 RUNTIME_ROOT_GAPS 同源）：
 *   ① preload-format-extension   electron/preload.cjs:14-16  锚点 `__dirname`（不是 projectRoot）
 *   ② library-default-icon       backend/src/server.js:1489/2483
 *   ③ thumbnail-resolve-roots    backend/src/server.js:3264-3267
 *   ④ library-store-src-mapping  backend/src/library-store.js:110
 *
 * 「读到的是部署根里那一份」怎么证：四处**全部**先写**哨兵内容**进部署根
 * （把图标换成一张只有部署根才有的 1×1 PNG、在 `src/__probe__/` 放一个只有部署根才有的
 * 库与缩略图），再断言**服务端吐回来的字节/路径与哨兵一致**。
 * 若解析根退回源工作区，源工作区里没有这些哨兵 ⇒ 404 或字节不符 ⇒ 立刻判红。
 *
 * 负向自证（门禁不能是橡皮章）——都必须把本脚本**跑红**，不是「预期失败」分支：
 *   EAGLE_DEPLOY_PROBE_NEGATIVE=missing-src  node tests/deployment-root-runtime-probe.mjs
 *       把部署根的 src/ 段挪走 ⇒ 四条**全部**必须失败（少一条失败即判红）。
 *   EAGLE_DEPLOY_PROBE_NEGATIVE=anchor-source node tests/deployment-root-runtime-probe.mjs
 *       后端改在**源工作区**启动（projectRoot 指向源工作区）⇒ ②③④ 必须失败（哨兵只在部署根），
 *       而 ① 必须**仍然通过**——它的锚点是 `__dirname`，本就不该随 cwd 漂移。
 *       这条自证同时说明：① 与 ②③④ 的锚点性质不同，不是同一类断言。
 *
 * 用法：npm run build && node tests/deployment-root-runtime-probe.mjs
 * （**单独跑**：本测试会自起后端，与其它自起后端的测试串行/并发会争端口。）
 */
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';
import { RUNTIME_ROOT_GAPS, buildDeploymentRoot } from './deployment-root.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const negative = process.env.EAGLE_DEPLOY_PROBE_NEGATIVE || '';
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-deploy-runtime-probe-'));
const deployRoot = path.join(tempRoot, 'deploy');
const stateDir = path.join(tempRoot, 'state');

/** 探针结果（按耦合点 id 归档；`null` = 未覆盖，最终会判红）。 */
const results = new Map(RUNTIME_ROOT_GAPS.map((gap) => [gap.id, null]));

function log(line) { console.log(line); }

/** 部署根内路径（所有「必须落在部署根内」的断言都过这个函数，避免各写一份 startsWith）。 */
function under(root, candidate) {
  const resolved = path.resolve(candidate);
  const base = path.resolve(root);
  return resolved === base || resolved.startsWith(base + path.sep);
}

function createSentinelPng(rgb) {
  const image = new PNG({ width: 1, height: 1 });
  image.data[0] = rgb[0];
  image.data[1] = rgb[1];
  image.data[2] = rgb[2];
  image.data[3] = 255;
  return PNG.sync.write(image);
}

async function freePort() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const port = await new Promise((resolve, reject) => {
      const server = net.createServer();
      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        server.close(() => resolve(address && typeof address === 'object' ? address.port : null));
      });
    });
    if (Number.isInteger(port) && port > 0 && port < 65536) return port;
  }
  throw new Error('could not allocate a free TCP port');
}

async function startServer(cwd) {
  const [apiPort, thumbnailPort, extensionPort] = await Promise.all([freePort(), freePort(), freePort()]);
  const child = spawn(process.execPath, ['backend/src/server.js'], {
    cwd,
    env: {
      ...process.env,
      EAGLE_API_PORT: String(apiPort),
      EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
      EAGLE_EXTENSION_PORT: String(extensionPort),
      EAGLE_LIBRARY_STATE_FILE: path.join(stateDir, 'library-state.json'),
      EAGLE_USER_DATA_DIR: path.join(stateDir, 'user-data'),
      EAGLE_THUMBNAIL_CONCURRENCY: '2',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const deadline = Date.now() + 30_000;
  while (!output.includes(`localhost:${apiPort}`)) {
    if (child.exitCode !== null) throw new Error(`server exited (${child.exitCode}): ${output.slice(-2000)}`);
    if (Date.now() > deadline) throw new Error(`server startup timeout: ${output.slice(-2000)}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return {
    child,
    apiBase: `http://127.0.0.1:${apiPort}`,
    thumbnailBase: `http://127.0.0.1:${thumbnailPort}`,
    output: () => output,
  };
}

async function stopServer(server) {
  if (!server || server.child.exitCode !== null) return;
  server.child.kill();
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 3_000);
    server.child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}

async function postJson(base, route, body) {
  const response = await fetch(`${base}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

/** 把「目录挪走」当成删除用：本机宿主对批量 rmSync 有拦截，rename 是瞬时且等价的破坏。 */
function disableDirectory(absolute) {
  if (!fs.existsSync(absolute)) return;
  const parked = `${absolute}.disabled`;
  try {
    fs.renameSync(absolute, parked);
  } catch (err) {
    fs.rmSync(absolute, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

// ---------------------------------------------------------------------------
// 四条探针
// ---------------------------------------------------------------------------

/** ② /api/library/icon + /api/v2/library/icon：服务的是**部署根里那一份**图标。 */
async function probeLibraryDefaultIcon(server, sentinel) {
  const expected = path.join(
    deployRoot, 'src', 'app', 'collect-window', 'assets', 'images', 'base', 'icons', 'default-library-icon.png',
  );
  const seen = [];
  for (const route of ['/api/library/icon', '/api/v2/library/icon']) {
    const response = await fetch(`${server.apiBase}${route}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (response.status !== 200) {
      throw new Error(`${route} → HTTP ${response.status}（期望 200；源工作区没有本探针的哨兵图标）`);
    }
    const contentType = String(response.headers.get('content-type') || '');
    if (!contentType.includes('image/png')) throw new Error(`${route} content-type=${contentType}`);
    if (!bytes.equals(sentinel)) {
      throw new Error(`${route} 返回的 ${bytes.length} 字节与部署根哨兵（${sentinel.length} 字节）不一致`
        + ` ⇒ 图标读的不是部署根 ${expected}`);
    }
    seen.push(`${route} ${bytes.length}B`);
  }
  if (!under(deployRoot, expected)) throw new Error(`图标路径不在部署根内：${expected}`);
  return `served ${seen.join(' / ')} == 部署根哨兵`;
}

/**
 * ③ resolveThumbnailPath 的两个 root：roots[0]=<root>/frontend/public、roots[1]=<root>/src。
 *
 * roots 在运行期有**两个**作用，都锚在部署根上，本探针两个都覆盖：
 *   (a) 虚拟前缀解析基：`/mock-library/...` → roots[0]（唯一还在生效的虚拟前缀，见 DORMANT_BRANCHES）；
 *   (b) 绝对路径白名单：`/^[a-zA-Z]:[\/]/` 的候选必须落在 [currentLibrary.rootDir, ...roots] 之内
 *       （server.js:3280-3285）——**这才是现网真正走的那条**：缩略图 URL 由
 *       FileUrlHelper.getThumbnailUrl 产成库内绝对路径（preload.cjs 的 thumbnailUrl →
 *       `<thumbnailBase>/file/<encodeURIComponent(绝对路径)>`）。
 *
 * 因此三条用例里有一条是**负向**：白名单外的绝对路径必须 404，否则「200」说明的不是
 * 「解析根在部署根」，而是「什么都往外端」。
 */
async function probeThumbnailResolveRoots(server, sentinels) {
  const cases = [
    {
      label: '(a) 虚拟前缀 /mock-library/... → roots[0]',
      filePath: '/mock-library/__probe__/probe-public.png',
      bytes: sentinels.public,
      expect: 200,
    },
    {
      label: '(b) 绝对路径白名单：部署根 src/ 下',
      filePath: sentinels.absPath,
      bytes: sentinels.abs,
      expect: 200,
    },
    {
      label: '(b) 绝对路径白名单：部署根之外',
      filePath: sentinels.outsidePath,
      bytes: null,
      expect: 404,
    },
  ];
  const seen = [];
  for (const item of cases) {
    const response = await fetch(`${server.thumbnailBase}/file/${encodeURIComponent(item.filePath)}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (response.status !== item.expect) {
      throw new Error(`${item.label} → HTTP ${response.status}（期望 ${item.expect}）：`
        + `${bytes.toString('utf8').slice(0, 200)}`);
    }
    if (item.bytes) {
      if (!bytes.equals(item.bytes)) {
        throw new Error(`${item.label} 返回的 ${bytes.length} 字节与部署根哨兵不一致 ⇒ 解析根不在部署根`);
      }
      seen.push(`${item.label} ${bytes.length}B`);
    } else {
      seen.push(`${item.label} 拒收`);
    }
  }

  // 休眠缺陷的**现状断言**：登记在案 ⇒ 行为与登记不符时立刻红（防「修好了也没人知道」）。
  for (const branch of DORMANT_BRANCHES) {
    const response = await fetch(`${server.thumbnailBase}/file/${encodeURIComponent(branch.filePath)}`);
    if (response.status !== branch.expectStatus) {
      throw new Error(`休眠分支 ${branch.id} 的行为变了（现 HTTP ${response.status}，登记 ${branch.expectStatus}）`
        + ` ⇒ 若已修复，请更新本表与 docs/remediation-log 的对应条目`);
    }
    log(`FINDING ${branch.id} :: 已登记休眠缺陷（现状 HTTP ${response.status}，符合登记）@ ${branch.where}`);
  }

  for (const root of [path.join(deployRoot, 'frontend', 'public'), path.join(deployRoot, 'src')]) {
    if (!fs.existsSync(root)) throw new Error(`解析根不存在：${root}`);
  }
  return `${seen.join(' / ')} == 部署根哨兵`;
}

// ---------------------------------------------------------------------------
// 运行期探针挖出来的**休眠缺陷**：行为确凿不对，但现网没有调用方，故不改产品代码（D34 口径：
// 部署根这一片本批零产品代码改动），只在这里把**现状**钉住并登记。
//
// 反向校验（同 D4 口径）：登记了却与实测不符 ⇒ 判红，逼人回来更新——
// 既防「改坏了没人知道」，也防「修好了也没人知道」。
// ---------------------------------------------------------------------------
const DORMANT_BRANCHES = [
  {
    id: 'thumbnail-src-virtual-prefix',
    where: 'backend/src/server.js:3264-3270',
    why: "'/src/...' 走 slice(1) 得 'src/...'，再与 roots[1]=<root>/src 拼接 ⇒ 实际找的是 "
      + '<root>/src/src/...，恒不命中（roots[0] 侧同理为 <root>/frontend/public/src/...）。'
      + '现网无调用方：缩略图 URL 由 FileUrlHelper.getThumbnailUrl 产成库内绝对路径，走 :3280 的白名单分支。'
      + '故该缺陷休眠；若哪天出现 /src/ 调用方，或决定修，改这里 + docs/remediation-log-2026-09-17.md §13。',
    filePath: '/src/__probe__/probe-src.png',
    expectStatus: 404,
  },
];

/** ④ resolveLibraryPath 的 /src/ 虚拟前缀：切到「只有部署根才有」的哨兵库。 */
async function probeLibraryStoreSrcMapping(server, libraryRel) {
  const expected = path.join(deployRoot, libraryRel);
  const { status, body } = await postJson(server.apiBase, '/api/library/switch', {
    libraryPath: `/${libraryRel.split(path.sep).join('/')}`,
  });
  if (status !== 200 || body.status !== 'success') {
    throw new Error(`/api/library/switch → HTTP ${status} ${JSON.stringify(body).slice(0, 300)}`
      + `（哨兵库只存在于部署根，源工作区里没有 ⇒ 解析根错了才会走到这里）`);
  }
  const actual = path.resolve(body.data.path || body.data.rootDir || '');
  if (actual !== path.resolve(expected)) {
    throw new Error(`切换后的库路径是 ${actual}，期望 ${path.resolve(expected)}`);
  }
  if (!under(deployRoot, actual)) throw new Error(`库路径不在部署根内：${actual}`);
  return `switched to ${actual}`;
}

/**
 * ① preload 的磁盘锚点：`__dirname/../src/...`。
 *
 * 这条**不经过 HTTP**（它是 Electron preload 内部的路径解析，没有 HTTP 入口），
 * 改为在 `vm` 里**真实执行** `<部署根>/electron/preload.cjs`，再**真实调用**生产供给面
 * `formatExtensionPreload()`，断言它自己算出来的 `diskPath` 就是部署根里那一份。
 * 装载骨架沿用 tests/plugin-format-preload.mjs（桩掉 electron 桥，注入真实 __dirname）。
 */
function probePreloadFormatExtension() {
  const preloadAbs = path.join(deployRoot, 'electron', 'preload.cjs');
  const expected = path.join(deployRoot, 'src', 'app', 'js', 'plugin', 'api-format-extension.js');
  if (!fs.existsSync(preloadAbs)) throw new Error(`部署根缺少 ${preloadAbs}`);
  const require_ = createRequire(preloadAbs);
  let exposed = null;
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require: (id) => {
      if (id === 'electron') {
        return {
          contextBridge: { exposeInMainWorld: (name, api) => { exposed = { name, api }; } },
          ipcRenderer: {},
        };
      }
      return require_(id);
    },
    __dirname: path.dirname(preloadAbs),
    __filename: preloadAbs,
    process,
    window: {},
    console: { warn: () => {}, log: () => {} },
  };
  vm.runInNewContext(fs.readFileSync(preloadAbs, 'utf8'), sandbox, { filename: preloadAbs });

  if (!exposed) throw new Error('electron/preload.cjs 未暴露桌面桥');
  if (typeof exposed.api.formatExtensionPreload !== 'function') throw new Error('缺少 formatExtensionPreload 供给面');
  const result = exposed.api.formatExtensionPreload();
  if (result.ok !== true) throw new Error(`formatExtensionPreload 返回不可用：${JSON.stringify(result)}`);
  const actual = path.resolve(result.diskPath);
  if (actual !== path.resolve(expected)) {
    throw new Error(`preload 解析到 ${actual}，期望 ${path.resolve(expected)}`);
  }
  if (!under(deployRoot, actual)) throw new Error(`preload 路径不在部署根内：${actual}`);
  if (!fs.existsSync(actual)) throw new Error(`preload 路径不存在：${actual}`);
  if (!/^file:\/\//i.test(result.url)) throw new Error(`preload url 应为 file://，实得 ${result.url}`);
  return `diskPath ${actual}`;
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
let server = null;
let fatal = null;

try {
  fs.mkdirSync(stateDir, { recursive: true });

  // 1) 按共享清单构造部署根（与 tests/isolated-deployment.mjs 同一份 DEPLOYMENT_TREE）。
  const { copied } = buildDeploymentRoot(projectRoot, deployRoot);
  for (const entry of copied) log(`COPY ${entry.to} (${entry.files} file(s)) <- ${entry.from}`);
  log(`PASS deployment root built at ${deployRoot}（${copied.reduce((sum, e) => sum + e.files, 0)} file(s)）`);

  // 2) 写哨兵：下面四处断言「读到的是部署根里那一份」，靠的就是这些只存在于部署根的内容。
  const sentinelIcon = createSentinelPng([7, 213, 99]);
  const sentinelSrcThumb = createSentinelPng([213, 33, 77]);
  const sentinelPublicThumb = createSentinelPng([33, 77, 213]);
  const sentinelAbsThumb = createSentinelPng([240, 160, 20]);
  const iconRel = path.join('src', 'app', 'collect-window', 'assets', 'images', 'base', 'icons', 'default-library-icon.png');
  fs.writeFileSync(path.join(deployRoot, iconRel), sentinelIcon);
  fs.mkdirSync(path.join(deployRoot, 'src', '__probe__'), { recursive: true });
  fs.writeFileSync(path.join(deployRoot, 'src', '__probe__', 'probe-src.png'), sentinelSrcThumb);
  // (b) 白名单用：部署根 src/ 下的绝对路径；以及在**部署根之外**的对照文件（必须被拒收）。
  const absThumbPath = path.join(deployRoot, 'src', '__probe__', 'probe-abs.png');
  fs.writeFileSync(absThumbPath, sentinelAbsThumb);
  const outsideThumbPath = path.join(tempRoot, 'outside.png');
  fs.writeFileSync(outsideThumbPath, sentinelAbsThumb);
  fs.mkdirSync(path.join(deployRoot, 'frontend', 'public', 'mock-library', '__probe__'), { recursive: true });
  fs.writeFileSync(
    path.join(deployRoot, 'frontend', 'public', 'mock-library', '__probe__', 'probe-public.png'),
    sentinelPublicThumb,
  );
  const libraryRel = path.join('src', '__probe__', 'DeployRootProbe.library');
  fs.mkdirSync(path.join(deployRoot, libraryRel), { recursive: true });
  fs.writeFileSync(
    path.join(deployRoot, libraryRel, 'metadata.json'),
    JSON.stringify({
      applicationVersion: '4.0.0',
      folders: [],
      smartFolders: [],
      quickAccess: [],
      tagsGroups: [],
      modificationTime: Date.now(),
    }, null, 2),
    'utf8',
  );
  log('PASS sentinels written into the deployment root');

  // 3) 负向自证：破坏部署根 / 把 projectRoot 锚回源工作区。
  if (negative === 'missing-src') {
    disableDirectory(path.join(deployRoot, 'src'));
    log('NEGATIVE removed the src/ segment of the deployment root');
  }

  // projectRoot = path.resolve(<backend/src>, '../..') ⇒ cwd 决定它指向哪。
  const backendCwd = negative === 'anchor-source' ? projectRoot : deployRoot;
  if (negative === 'anchor-source') log(`NEGATIVE backend anchored at the source workspace (${backendCwd})`);

  server = await startServer(backendCwd);
  log(`PASS backend up (cwd=${backendCwd})`);

  // 4) 逐条跑探针；单条失败不中断，好让「覆盖了几条」有完整报告。
  const plans = [
    ['library-default-icon', () => probeLibraryDefaultIcon(server, sentinelIcon)],
    ['thumbnail-resolve-roots', () => probeThumbnailResolveRoots(server, {
      public: sentinelPublicThumb,
      abs: sentinelAbsThumb,
      absPath: absThumbPath,
      outsidePath: outsideThumbPath,
    })],
    ['library-store-src-mapping', () => probeLibraryStoreSrcMapping(server, libraryRel)],
    ['preload-format-extension', () => probePreloadFormatExtension()],
  ];
  for (const [id, run] of plans) {
    try {
      results.set(id, { ok: true, detail: await run() });
      log(`PROBE ${id} PASS :: ${results.get(id).detail}`);
    } catch (err) {
      results.set(id, { ok: false, detail: err.message });
      log(`PROBE ${id} FAIL :: ${err.message}`);
    }
  }
} catch (err) {
  fatal = err;
} finally {
  await stopServer(server);
}

// ---------------------------------------------------------------------------
// 判红 / 判绿
// ---------------------------------------------------------------------------
const registered = RUNTIME_ROOT_GAPS.map((gap) => gap.id);
const covered = [...results.entries()].filter(([, value]) => value !== null).map(([id]) => id);
const passed = [...results.entries()].filter(([, value]) => value && value.ok).map(([id]) => id);
const failed = [...results.entries()].filter(([, value]) => value && !value.ok).map(([id]) => id);

/** 覆盖完整性：登记表里多出一条而探针没跟上 ⇒ 立刻判红（不能靠「没报错」假装覆盖）。 */
const missingCoverage = registered.filter((id) => !covered.includes(id));
const unknownCoverage = covered.filter((id) => !registered.includes(id));

function bail(message) {
  console.error(`DEPLOY_ROOT_RUNTIME_PROBE_FAILED ${message}`);
  if (fatal) console.error(fatal.stack || fatal.message);
  process.exit(1);
}

if (fatal) bail(`探针自身异常：${fatal.message}`);
if (unknownCoverage.length) bail(`探针覆盖了登记表里不存在的耦合点：${JSON.stringify(unknownCoverage)}`);
if (missingCoverage.length) bail(`RUNTIME_ROOT_GAPS 里有 ${missingCoverage.length} 条没有运行期探针覆盖：${JSON.stringify(missingCoverage)}`);

const summary = {
  deployRoot,
  negative: negative || null,
  covered: `${covered.length}/${registered.length}`,
  passed,
  failed,
};

if (negative === 'missing-src') {
  // src/ 段是整个布局的承重墙：挪走后四条必须**全部**失败——任何一条还绿，
  // 说明它压根没在验证「解析到部署根里」，而只是在验证「某处存在同名的东西」。
  if (failed.length !== registered.length) {
    bail(`负向自证 missing-src 失效：src/ 段已挪走，但仍有 ${registered.length - failed.length} 条通过`
      + `（${JSON.stringify(passed)}）⇒ 这些探针没有真正锚在部署根上`);
  }
  log(`NEGATIVE_OK missing-src :: 四条全部判红 ${JSON.stringify(failed)}`);
} else if (negative === 'anchor-source') {
  // 锚点性质自证：②③④ 由 projectRoot 派生，projectRoot 指回源工作区 ⇒ 必须红；
  // ① 由 __dirname 派生，与 cwd 无关 ⇒ 必须仍然绿。两边都对，才说明这四条不是同一类断言。
  const mustFail = ['library-default-icon', 'thumbnail-resolve-roots', 'library-store-src-mapping'];
  const mustPass = ['preload-format-extension'];
  const notFailed = mustFail.filter((id) => !failed.includes(id));
  const notPassed = mustPass.filter((id) => !passed.includes(id));
  if (notFailed.length) {
    bail(`负向自证 anchor-source 失效：projectRoot 已指回源工作区，但 ${JSON.stringify(notFailed)} 仍通过`
      + ` ⇒ 这些探针没有真正读到部署根里的哨兵`);
  }
  if (notPassed.length) {
    bail(`负向自证 anchor-source 失效：preload 的锚点是 __dirname（与 cwd 无关），`
      + `${JSON.stringify(notPassed)} 不应随之后端启动位置变化而失败`);
  }
  log(`NEGATIVE_OK anchor-source :: ②③④ 判红 ${JSON.stringify(failed)} / ① 仍通过`);
} else if (failed.length) {
  bail(`${failed.length} 条耦合点在运行期没有解析到部署根：${JSON.stringify(
    failed.map((id) => ({ id, why: results.get(id).detail })),
  )}`);
} else {
  log(`DEPLOY_ROOT_RUNTIME_PROBE_OK ${JSON.stringify(summary)}`);
}

try {
  fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
} catch (err) {
  log(`WARN 临时根清理失败（不影响结论）：${tempRoot}`);
}
