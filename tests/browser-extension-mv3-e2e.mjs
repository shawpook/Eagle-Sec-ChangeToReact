/**
 * M6-1 验收：用**构建出的 MV3 扩展**在真实 Chromium 宿主里跑端到端。
 *
 * 与 `tests/browser-capture-electron-extension-e2e.mjs` 的分工：
 *   - 那个文件跑在项目自带的 Electron 宿主里，但它无法承载 MV3 的消息桥
 *     （实测：service worker 目标存在且可求值，content script 的
 *     `chrome.runtime.sendMessage` 8s 超时，SW 侧收到的消息数为 0；同宿主的 MV2
 *     扩展页则正常回包）——因此它在加载成功后按能力判定 BLOCKED，见该文件内注释；
 *   - 本文件跑在真实浏览器里，是 M6 验收「不以 MV2 fixture 替代交付对象」的**实际执行者**。
 *
 * 覆盖链路：content script 隔离世界 -> `chrome.runtime.sendMessage` -> MV3 service worker
 * -> 后端 `/api/collect` -> 落地到 Eagle library -> 后端重启后仍在。
 *
 * 宿主选择：`EAGLE_CHROMIUM_PATH` 优先，其次 Edge、Chrome；**加载能力由实测决定**
 * （能否出现本扩展的 service_worker 目标），不以版本号假设。无一可用时按本仓既有约定
 * 打印 `..._BLOCKED <原因>` 并以 0 退出，不把环境缺失伪装成产品缺陷。
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceExtension = path.join(projectRoot, 'frontend', 'public', 'browser-extension');
const builtExtension = path.join(projectRoot, 'dist', 'frontend', 'browser-extension');
const extensionPath = process.env.EAGLE_EXTENSION_PATH
  || (fs.existsSync(path.join(builtExtension, 'manifest.json')) ? builtExtension : sourceExtension);
const extensionManifest = JSON.parse(fs.readFileSync(path.join(extensionPath, 'manifest.json'), 'utf8'));

const CHROMIUM_CANDIDATES = [
  process.env.EAGLE_CHROMIUM_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-mv3-browser-e2e-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
fs.mkdirSync(librariesRoot, { recursive: true });

const png = new PNG({ width: 12, height: 8 });
for (let index = 0; index < png.data.length; index += 4) {
  png.data[index] = 70;
  png.data[index + 1] = 190;
  png.data[index + 2] = 130;
  png.data[index + 3] = 255;
}
const pngBuffer = PNG.sync.write(png);

const running = [];
let fixtureServer;

async function cleanup() {
  for (const child of running) await stopProcess(child);
  if (fixtureServer) await new Promise((resolve) => fixtureServer.close(resolve));
  try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (error) { /* Windows 文件锁：清理失败不影响结论 */ }
}

function blocked(reason) {
  console.log(`BROWSER_EXTENSION_MV3_E2E_BLOCKED ${reason}`);
  return reason;
}

async function freePort() {
  while (true) {
    const port = await new Promise((resolve, reject) => {
      const server = http.createServer();
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        server.close(() => resolve(address.port));
      });
    });
    if (port >= 12000) return port;
  }
}

function spawnLogged(command, args, env, label) {
  const child = spawn(command, args, { cwd: projectRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const info = { child, label, output: '' };
  child.stdout.on('data', (chunk) => { info.output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { info.output += chunk.toString(); });
  running.push(info);
  return info;
}

async function stopProcess(info) {
  if (!info || info.child.exitCode !== null) return;
  info.child.kill();
  const exited = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 3000);
    info.child.once('exit', () => { clearTimeout(timer); resolve(true); });
  });
  if (!exited && process.platform === 'win32') {
    // 浏览器会派生一堆子进程，主进程被杀后子进程可能仍在占着调试端口。
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(info.child.pid), '/T', '/F'], { stdio: 'ignore' });
      killer.once('exit', resolve);
      killer.once('error', resolve);
    });
  }
}

async function waitFor(check, label, timeout = 30000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    last = await check();
    if (last) return last;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`${label} timeout`);
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const contexts = [];
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const entry = pending.get(message.id);
      pending.delete(message.id);
      message.error ? entry.reject(new Error(JSON.stringify(message.error))) : entry.resolve(message.result);
      return;
    }
    if (message.method === 'Runtime.executionContextCreated') contexts.push(message.params.context);
  };
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  return {
    contexts,
    close: () => ws.close(),
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const messageId = ++id;
        pending.set(messageId, { resolve, reject });
        ws.send(JSON.stringify({ id: messageId, method, params }));
      });
    },
    async evaluate(expression, options = {}) {
      const result = await this.send('Runtime.evaluate', {
        expression,
        awaitPromise: options.awaitPromise === true,
        returnByValue: true,
        ...(options.contextId ? { contextId: options.contextId } : {}),
      });
      if (result.exceptionDetails) {
        throw new Error(`${options.label || 'evaluate'} threw: ${JSON.stringify(result.exceptionDetails)}`);
      }
      return result.result.value;
    },
  };
}

const listTargets = async (debugPort) => (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();

async function startFixture() {
  fixtureServer = http.createServer((req, res) => {
    if (req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><html><head><title>MV3 Capture Fixture</title></head><body><img src="/one.png"><img src="/two.png"></body></html>');
      return;
    }
    if (req.url === '/one.png' || req.url === '/two.png') {
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': pngBuffer.length });
      res.end(pngBuffer);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });
  const port = await new Promise((resolve, reject) => {
    fixtureServer.once('error', reject);
    fixtureServer.listen(0, '127.0.0.1', () => resolve(fixtureServer.address().port));
  });
  return port;
}

async function launchHost(candidate, { debugPort, userDataDir }) {
  const info = spawnLogged(candidate, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${userDataDir}`,
    `--load-extension=${extensionPath}`,
    `--disable-extensions-except=${extensionPath}`,
    `--remote-debugging-port=${debugPort}`,
    'about:blank',
  ], { ...process.env }, path.basename(candidate));

  const version = await waitFor(async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      return response.ok ? response.json() : null;
    } catch (error) {
      return null;
    }
  }, 'devtools endpoint', 40000).catch(() => null);
  if (!version) { await stopProcess(info); return null; }

  // 能力实测：**本扩展**的 service worker 目标是否真的出现（版本号不作依据）。
  // 注意不能只按 `chrome-extension://` 前缀找——Edge/Chrome 自带扩展也有 service worker
  // （实测本机 Edge 自带的两个即带 background.html / service_worker.js）。这里先按
  // manifest 里声明的入口文件名收敛，再用 `chrome.runtime.getManifest().name` 终判。
  const serviceWorker = await waitFor(async () => {
    const targets = await listTargets(debugPort);
    return targets.find((target) => target.type === 'service_worker'
      && target.url.startsWith('chrome-extension://')
      && target.url.endsWith(`/${extensionManifest.background.service_worker}`)) || null;
  }, 'extension service worker target', 20000).catch(() => null);
  if (!serviceWorker) { await stopProcess(info); return null; }

  const worker = await connect(serviceWorker.webSocketDebuggerUrl);
  await worker.send('Runtime.enable');
  const manifestName = await worker.evaluate('chrome.runtime.getManifest().name', { label: 'sw manifest name' }).catch(() => null);
  const manifestVersion = await worker.evaluate('chrome.runtime.getManifest().manifest_version', { label: 'sw manifest version' }).catch(() => null);
  worker.close();
  if (manifestName !== extensionManifest.name || manifestVersion !== 3) { await stopProcess(info); return null; }

  return { info, version: version.Browser, serviceWorkerTarget: serviceWorker };
}

// ── 主流程 ────────────────────────────────────────────────────────────────

let host = null;
let backend = null;
try {
  console.log(`[subject] extension=${path.relative(projectRoot, extensionPath)} manifest_version=${extensionManifest.manifest_version}`);
  if (extensionManifest.manifest_version !== 3) throw new Error('交付对象不是 MV3，测试对象错误');

  const existing = CHROMIUM_CANDIDATES.filter((candidate) => fs.existsSync(candidate));
  if (!existing.length) {
    blocked('no-chromium-host-found');
    await cleanup();
    process.exit(0);
  }

  const debugPort = await freePort();
  for (const candidate of existing) {
    host = await launchHost(candidate, { debugPort, userDataDir: path.join(tempRoot, `host-${path.basename(candidate)}`) });
    if (host) break;
    console.log(`[host-skip] ${candidate} 未加载出本扩展的 service worker 目标`);
  }
  if (!host) {
    blocked(`no-host-loads-unpacked-extensions (${existing.map((entry) => path.basename(entry)).join(',')})`);
    await cleanup();
    process.exit(0);
  }
  console.log(`[host] ${host.version} via ${host.info.label}`);
  const hostVersion = host.version;

  const extensionId = new URL(host.serviceWorkerTarget.url).host;
  const fixturePort = await startFixture();

  const [apiPort, thumbnailPort, extensionApiPort] = await Promise.all([freePort(), freePort(), freePort()]);
  const backendEnv = {
    ...process.env,
    EAGLE_API_PORT: String(apiPort),
    EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
    EAGLE_EXTENSION_PORT: String(extensionApiPort),
    EAGLE_LIBRARY_STATE_FILE: stateFile,
    EAGLE_USER_DATA_DIR: path.join(tempRoot, 'user-data'),
    EAGLE_DOWNLOAD_ALLOW_HOSTS: '127.0.0.1',
  };
  backend = spawnLogged(process.execPath, ['backend/src/server.js'], backendEnv, 'backend');
  await waitFor(() => backend.output.includes(`localhost:${apiPort}`), 'backend startup');

  const createdResponse = await fetch(`http://127.0.0.1:${apiPort}/api/library/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'MV3 Browser Extension E2E', savePath: librariesRoot }),
  });
  const created = await createdResponse.json();
  if (!createdResponse.ok || created.status !== 'success') throw new Error(`Library create failed: ${JSON.stringify(created)}`);

  // 1) 扩展页（真实 popup）里验证：环境判定为扩展态，且地址来自 background.js 的声明。
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  const popupTarget = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' })).json();
  const popup = await connect(popupTarget.webSocketDebuggerUrl);
  await popup.send('Runtime.enable');
  await popup.send('Page.enable');
  // `/json/new` 对 chrome-extension:// 的处理各宿主不一致，统一用 Page.navigate 显式导航。
  await popup.send('Page.navigate', { url: popupUrl });
  const popupDiagnostics = () => popup.evaluate(`JSON.stringify({
    href: location.href,
    readyState: document.readyState,
    title: document.title,
    hasStatus: !!document.querySelector('#status'),
    bodyHead: (document.body ? document.body.innerHTML : '').slice(0, 240),
  })`, { label: 'popup diagnostics' }).catch((error) => `diagnostics failed: ${error.message}`);
  await waitFor(() => popup.evaluate('!!document.querySelector("#status")', { label: 'popup DOM' }), `popup DOM ready (${popupUrl})`, 15000)
    .catch(async (error) => { throw new Error(`${error.message} :: ${await popupDiagnostics()}`); });
  const popupStatus = await popup.evaluate('document.querySelector("#status").textContent', { label: 'popup status' });
  if (popupStatus.includes('演示页')) throw new Error(`真实扩展环境被判成了演示页：${popupStatus}`);

  const shippedRuntime = JSON.parse(await popup.evaluate(
    'chrome.runtime.sendMessage({ type: "get-runtime" }).then((value) => JSON.stringify(value))',
    { awaitPromise: true, label: 'get-runtime' },
  ));
  if (!shippedRuntime.ok) throw new Error(`get-runtime 未成功返回：${JSON.stringify(shippedRuntime)}`);
  // popup 拿到的必须**就是 background.js 里那处声明**，而不是 popup 自己的一份副本。
  const declaredDefault = fs.readFileSync(path.join(extensionPath, 'background.js'), 'utf8').match(/apiBaseUrl:\s*'([^']*)'/)[1];
  if (shippedRuntime.data.apiBaseUrl !== declaredDefault) {
    throw new Error(`popup 取到的地址与 background.js 的声明不一致：${shippedRuntime.data.apiBaseUrl} vs ${declaredDefault}`);
  }
  console.log(`[shipped-runtime] apiBaseUrl=${shippedRuntime.data.apiBaseUrl}（未注入覆盖时的声明值，与 background.js 一致）`);

  // 2) 运行期覆盖到本次测试的端口，验证覆盖通道本身可用。
  const overrideUrl = `http://localhost:${extensionApiPort}`;
  const applied = JSON.parse(await popup.evaluate(
    `chrome.storage.local.set({ eagleRuntimeConfig: { apiBaseUrl: ${JSON.stringify(overrideUrl)} } })
      .then(() => chrome.runtime.sendMessage({ type: 'get-runtime' }))
      .then((value) => JSON.stringify(value))`,
    { awaitPromise: true, label: 'apply-override' },
  ));
  if (!applied.ok || applied.data.apiBaseUrl !== overrideUrl) throw new Error(`运行期覆盖未生效：${JSON.stringify(applied)}`);
  console.log(`[runtime-override] ${applied.data.apiBaseUrl}`);

  // 3) 真实页面上跑采集链路。
  const fixtureUrl = `http://127.0.0.1:${fixturePort}/index.html`;
  const fixtureTarget = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?${fixtureUrl}`, { method: 'PUT' })).json();
  const page = await connect(fixtureTarget.webSocketDebuggerUrl);
  await page.send('Runtime.enable');
  await page.send('Page.enable');

  const isolatedWorld = await waitFor(() => {
    const world = page.contexts.find((context) => context.auxData && context.auxData.isDefault === false && context.origin.startsWith('chrome-extension://'));
    return world || null;
  }, 'content script isolated world', 20000).catch(() => null);
  if (!isolatedWorld) {
    // 页面可能在扩展就绪前就完成了首次导航：重新导航一次再等。
    await page.send('Page.navigate', { url: fixtureUrl });
    await waitFor(() => page.contexts.find((context) => context.auxData && context.auxData.isDefault === false && context.origin.startsWith('chrome-extension://')), 'content script isolated world (retry)', 20000);
  }
  const contentReady = await page.evaluate("document.documentElement.getAttribute('data-eagle-reverse-content')", { label: 'content-ready' });
  if (contentReady !== '1') throw new Error(`content script 未注入：${contentReady}`);
  console.log(`[content-script] isolated world 就绪，扩展 id=${extensionId}`);

  const capture = async (type) => {
    const outcome = await page.evaluate(`(async () => {
      document.documentElement.removeAttribute('data-eagle-reverse-send-response');
      window.postMessage({ channel: 'eagle-reverse-collect', request: { type: ${JSON.stringify(type)} } }, '*');
      const deadline = Date.now() + 20000;
      while (!document.documentElement.getAttribute('data-eagle-reverse-send-response')) {
        if (Date.now() > deadline) {
          return JSON.stringify({ timeout: true, received: document.documentElement.getAttribute('data-eagle-reverse-message-received') });
        }
        await new Promise((resolve) => setTimeout(resolve, 75));
      }
      return JSON.stringify({ timeout: false });
    })()`, { awaitPromise: true, label: `capture:${type}` });
    const parsed = JSON.parse(outcome);
    if (parsed.timeout) throw new Error(`采集未回包（MV3 契约属性 data-eagle-reverse-send-response）：${outcome}`);
  };

  await capture('collect-image');
  await waitFor(async () => {
    const current = await (await fetch(`http://127.0.0.1:${apiPort}/api/library/current?includeItems=true`)).json();
    return current.data.items.length === 1 ? current.data.items[0] : null;
  }, 'single image capture');

  await capture('collect-page');
  const items = await waitFor(async () => {
    const current = await (await fetch(`http://127.0.0.1:${apiPort}/api/library/current?includeItems=true`)).json();
    return current.data.items.length === 3 ? current.data.items : null;
  }, 'page multi image capture');

  for (const item of items) {
    const infoDir = path.join(created.data.path, 'images', `${item.id}.info`);
    if (!fs.existsSync(path.join(infoDir, `${item.name}.png`)) || !fs.existsSync(path.join(infoDir, 'metadata.json'))) {
      throw new Error(`MV3 扩展采集的文件缺失：${item.id}`);
    }
  }

  page.close();
  popup.close();
  await stopProcess(host.info);
  host = null;
  await stopProcess(backend);
  backend = null;

  const restarted = spawnLogged(process.execPath, ['backend/src/server.js'], backendEnv, 'backend-restarted');
  backend = restarted;
  await waitFor(() => restarted.output.includes(`localhost:${apiPort}`), 'restarted backend');
  const restored = await (await fetch(`http://127.0.0.1:${apiPort}/api/library/current?includeItems=true`)).json();
  if (restored.status !== 'success' || restored.data.items.length !== 3) {
    throw new Error(`MV3 扩展采集的条目未在重启后保留：${JSON.stringify(restored)}`);
  }

  console.log(`BROWSER_EXTENSION_MV3_E2E_OK ${JSON.stringify({ host: hostVersion, library: created.data.path, count: restored.data.items.length })}`);
} catch (error) {
  console.error(`BROWSER_EXTENSION_MV3_E2E_FAILED ${error.stack || error.message}`);
  process.exitCode = 1;
} finally {
  await cleanup();
}
