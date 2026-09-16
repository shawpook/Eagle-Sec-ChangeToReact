/**
 * Electron 宿主里的扩展端到端。
 *
 * M6-1 起，交付对象是 **MV3** 扩展（`tests/fixtures/browser-extension-mv2` 只是对照物，
 * 不能替代交付对象）。本文件因此：
 *   - 加载 `frontend/public/browser-extension`（或构建产物 `dist/frontend/browser-extension`），
 *     并在开头打印被测对象与 manifest_version；
 *   - 按 MV3 的真实契约等待 `data-eagle-reverse-send-response`；
 *   - 加载后先做一次**宿主消息桥能力探测**：项目钉住的 Electron 22（Chromium 108）能加载 MV3、
 *     能起 service worker，但 content script 的 `chrome.runtime.sendMessage` 送不到该 worker
 *     （实测：8s 超时，SW 侧计数为 0；同宿主的 MV2 扩展页正常回包）。此时按本文件既有约定
 *     打印 `BROWSER_CAPTURE_EXTENSION_E2E_BLOCKED <原因>` 并以 0 退出，不把宿主缺陷伪装成
 *     产品缺陷，也不用 MV2 的结果冒充 MV3 的结论。
 *
 * MV3 交付对象的真实端到端由 `tests/browser-extension-mv3-e2e.mjs` 在真实 Chromium 宿主里执行。
 */
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronExecutable = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const sourceExtension = path.join(projectRoot, 'frontend', 'public', 'browser-extension');
const builtExtension = path.join(projectRoot, 'dist', 'frontend', 'browser-extension');
const extensionPath = process.env.EAGLE_EXTENSION_PATH
  || (fs.existsSync(path.join(builtExtension, 'manifest.json')) ? builtExtension : sourceExtension);
const extensionManifest = JSON.parse(fs.readFileSync(path.join(extensionPath, 'manifest.json'), 'utf8'));
/** 扩展的默认扩展服务端口，取自 background.js 的唯一声明处；与 backend 的 EAGLE_EXTENSION_PORT 同义。 */
const extensionPort = Number(fs.readFileSync(path.join(extensionPath, 'background.js'), 'utf8').match(/apiBaseUrl:\s*'http:\/\/localhost:(\d+)'/)[1]);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-electron-extension-e2e-'));
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

async function startFixture() {
  const fixture = http.createServer((req, res) => {
    if (req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><html><head><title>Capture Fixture</title></head><body><img src="/one.png"><img src="/two.png"></body></html>');
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
    fixture.once('error', reject);
    fixture.listen(0, '127.0.0.1', () => resolve(fixture.address().port));
  });
  return { fixture, port };
}

function spawnLogged(command, args, env) {
  const child = spawn(command, args, { cwd: projectRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  return { child, output: () => output };
}

async function waitFor(check, label, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${label} timeout`);
}

async function stop(processInfo) {
  if (!processInfo || processInfo.child.exitCode !== null) return;
  processInfo.child.kill();
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 3000);
    processInfo.child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}

async function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const contexts = [];
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const entry = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? entry.reject(new Error(JSON.stringify(msg.error))) : entry.resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.executionContextCreated') contexts.push(msg.params.context);
  };
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  return {
    ws,
    contexts,
    close() { ws.close(); },
    async evaluate(expression, options = {}) {
      const result = await this.send('Runtime.evaluate', {
        expression,
        awaitPromise: options.awaitPromise === true,
        returnByValue: true,
        ...(options.contextId ? { contextId: options.contextId } : {}),
      });
      if (result.exceptionDetails) throw new Error(`${options.label || 'evaluate'} threw: ${JSON.stringify(result.exceptionDetails)}`);
      return result.result.value;
    },
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const msgId = ++id;
        pending.set(msgId, { resolve, reject });
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    },
  };
}

/** 内容脚本所在的隔离世界（一个扩展在一个页面里可能有多个）。 */
const isolatedWorlds = (client) => client.contexts.filter(
  (context) => context.auxData && context.auxData.isDefault === false && context.origin.startsWith('chrome-extension://'),
);

let electron;

/**
 * 宿主能力不足时按本仓既有约定退出：打印可检索的 BLOCKED 行 + 实测证据，以 0 退出。
 * 这里只在「被测对象正确、但宿主跑不了」时使用；产品缺陷一律走 throw。
 */
async function blockedAndExit(reason) {
  console.log(`BROWSER_CAPTURE_EXTENSION_E2E_BLOCKED ${reason}`);
  try { await stop(electron); } catch (error) { /* 尚未启动 */ }
  await new Promise((resolve) => fixture.fixture.close(resolve));
  try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
  process.exit(0);
}

const fixture = await startFixture();
console.log(`[subject] extension=${path.relative(projectRoot, extensionPath)} manifest_version=${extensionManifest.manifest_version} extension_port=${extensionPort}`);
if (extensionManifest.manifest_version !== 3) throw new Error('被测对象不是 MV3 交付物');
if (await portInUse(extensionPort)) {
  await blockedAndExit(`extension default port ${extensionPort} is occupied`);
}
const [apiPort, thumbnailPort, debugPort] = await Promise.all([freePort(), freePort(), freePort()]);
const backendEnv = {
  ...process.env,
  EAGLE_API_PORT: String(apiPort),
  EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
  EAGLE_EXTENSION_PORT: String(extensionPort),
  EAGLE_LIBRARY_STATE_FILE: stateFile,
  EAGLE_USER_DATA_DIR: path.join(tempRoot, 'user-data'),
  EAGLE_DOWNLOAD_ALLOW_HOSTS: '127.0.0.1',
};
const backend = spawnLogged(process.execPath, ['backend/src/server.js'], backendEnv);
try {
  await waitFor(() => backend.output().includes(`localhost:${apiPort}`), 'backend startup');
  const createdResponse = await fetch(`http://127.0.0.1:${apiPort}/api/library/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Electron Extension E2E', savePath: librariesRoot }),
  });
  const created = await createdResponse.json();
  if (!createdResponse.ok || created.status !== 'success') throw new Error(`Library create failed: ${JSON.stringify(created)}`);

  const fixtureUrl = `http://127.0.0.1:${fixture.port}/index.html`;
  electron = spawnLogged(electronExecutable, ['tests/browser-capture-extension-host.cjs'], {
    ...process.env,
    EAGLE_EXTENSION_PATH: extensionPath,
    EAGLE_FIXTURE_URL: fixtureUrl,
    EAGLE_DEBUG_PORT: String(debugPort),
    EAGLE_ELECTRON_USER_DATA_DIR: path.join(tempRoot, 'electron-user-data'),
  });
  await waitFor(() => electron.output().includes('EXTENSION_LOADED'), 'extension loaded');
  await waitFor(() => electron.output().includes('FIXTURE_READY'), 'fixture ready');
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const pageTarget = targets.find((target) => target.type === 'page' && target.url.includes(`127.0.0.1:${fixture.port}`));
  if (!pageTarget) throw new Error(`Fixture page target not found: ${JSON.stringify(targets)}`);
  const page = await connect(pageTarget.webSocketDebuggerUrl);
  await page.send('Runtime.enable');
  const contentReady = await page.send('Runtime.evaluate', {
    expression: "document.documentElement.getAttribute('data-eagle-reverse-content')",
    returnByValue: true,
  });
  if (contentReady.result.value !== '1') throw new Error(`Extension content script was not injected: ${JSON.stringify(contentReady)}`);

  // ── 宿主消息桥能力探测（结论基于实测，不基于版本号） ──────────────────────
  // MV3 的 content script 与 service worker 之间的消息桥是本宿主能否承载交付对象的前提。
  // 项目钉住的 Electron 22（Chromium 108）实测：SW 目标存在且可求值、manifest 读得到，
  // 但 content script 的 sendMessage 8s 超时、SW 侧计数为 0；同一宿主的 MV2 扩展页正常回包。
  // 探针用未知 type，既能验证往返又不产生任何采集副作用。
  const serviceWorkerTarget = targets.find((target) => target.type === 'service_worker'
    && target.url.endsWith(`/${extensionManifest.background.service_worker}`));
  if (!serviceWorkerTarget) {
    await blockedAndExit(`electron host did not start the MV3 service worker (${extensionManifest.background.service_worker})`);
  }
  await waitFor(() => (isolatedWorlds(page).length ? true : null), 'content script isolated world').catch(() => null);
  const worlds = isolatedWorlds(page);
  const worker = await connect(serviceWorkerTarget.webSocketDebuggerUrl);
  await worker.send('Runtime.enable');
  await worker.evaluate(`(() => {
    self.__e2eMessageCount = 0;
    chrome.runtime.onMessage.addListener(() => { self.__e2eMessageCount += 1; return false; });
    return 'listener-installed';
  })()`, { label: 'sw probe listener' });
  const bridge = worlds.length
    ? JSON.parse(await page.evaluate(`(async () => {
        const outcome = await new Promise((resolve) => {
          let settled = false;
          const timer = setTimeout(() => { if (!settled) { settled = true; resolve({ timedOut: true }); } }, 8000);
          chrome.runtime.sendMessage({ type: 'e2e-bridge-probe' }, (response) => {
            if (settled) return; settled = true; clearTimeout(timer);
            resolve({ response, lastError: chrome.runtime.lastError ? chrome.runtime.lastError.message : null });
          });
        });
        return JSON.stringify(outcome);
      })()`, { awaitPromise: true, contextId: worlds[0].id, label: 'bridge probe' }))
    : { timedOut: true, noIsolatedWorld: true };
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const swReceived = await worker.evaluate('self.__e2eMessageCount', { label: 'sw message count' });
  worker.close();
  const electronVersion = JSON.parse(fs.readFileSync(path.join(projectRoot, 'node_modules', 'electron', 'package.json'), 'utf8')).version;
  console.log(`[host-bridge-probe] ${JSON.stringify({ electron: electronVersion, isolatedWorlds: worlds.length, swTarget: true, swReceived, bridge })}`);
  if (bridge.timedOut && !swReceived) {
    await blockedAndExit(`mv3-message-bridge-unavailable-in-electron-host (electron ${electronVersion}: content script sendMessage timed out and the service worker received 0 messages; 用 tests/browser-extension-mv3-e2e.mjs 覆盖真实 MV3 端到端)`);
  }

  // 采集响应契约：MV3 的 content.js 写 `data-eagle-reverse-send-response`，响应体经
  // window.postMessage 回到页面主世界，这里顺手把它接住以保留原有的 response.ok 断言。
  await page.evaluate(`(() => {
    if (window.__eagleCollectInstalled) return 'already';
    window.__eagleCollectResponse = [];
    window.addEventListener('message', (event) => {
      const data = event.data || {};
      if (data.channel === 'eagle-reverse-collect-response') window.__eagleCollectResponse.push(data.response);
    });
    window.__eagleCollectInstalled = true;
    return 'installed';
  })()`, { label: 'install response capture' });

  const capture = async (type) => {
    const raw = await page.evaluate(`(async () => {
      window.__eagleCollectResponse = [];
      document.documentElement.removeAttribute('data-eagle-reverse-send-response');
      window.postMessage({ channel: 'eagle-reverse-collect', request: { type: ${JSON.stringify(type)} } }, '*');
      const deadline = Date.now() + 15000;
      while (!document.documentElement.getAttribute('data-eagle-reverse-send-response')) {
        if (Date.now() > deadline) {
          return JSON.stringify({
            timeout: true,
            received: document.documentElement.getAttribute('data-eagle-reverse-message-received'),
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 75));
      }
      return JSON.stringify({ timeout: false, responses: window.__eagleCollectResponse });
    })()`, { awaitPromise: true, label: `capture:${type}` });
    const outcome = JSON.parse(raw);
    if (outcome.timeout) throw new Error(`Extension capture timeout（等待 data-eagle-reverse-send-response）: ${raw}`);
    const response = outcome.responses[outcome.responses.length - 1];
    if (!response || response.ok !== true) throw new Error(`Extension capture failed: ${raw}`);
    return response;
  };

  await capture('collect-image');
  await waitFor(async () => {
    const current = await (await fetch(`http://127.0.0.1:${apiPort}/api/library/current?includeItems=true`)).json();
    return current.data.items.length === 1 ? current.data.items[0] : null;
  }, 'single image capture');

  await capture('collect-page');
  await waitFor(async () => {
    const current = await (await fetch(`http://127.0.0.1:${apiPort}/api/library/current?includeItems=true`)).json();
    return current.data.items.length === 3 ? current.data.items : null;
  }, 'page multi image capture');

  const current = await (await fetch(`http://127.0.0.1:${apiPort}/api/library/current?includeItems=true`)).json();
  for (const item of current.data.items) {
    const infoDir = path.join(created.data.path, 'images', `${item.id}.info`);
    if (!fs.existsSync(path.join(infoDir, `${item.name}.png`)) || !fs.existsSync(path.join(infoDir, 'metadata.json'))) {
      throw new Error(`Electron extension item files missing: ${item.id}`);
    }
  }
  page.ws.close();
  await stop(electron);
  electron = null;

  await stop(backend);
  const restarted = spawnLogged(process.execPath, ['backend/src/server.js'], backendEnv);
  await waitFor(() => restarted.output().includes(`localhost:${apiPort}`), 'restarted backend');
  const restored = await (await fetch(`http://127.0.0.1:${apiPort}/api/library/current?includeItems=true`)).json();
  if (restored.status !== 'success' || restored.data.items.length !== 3) {
    throw new Error(`Electron extension items did not survive restart: ${JSON.stringify(restored)}`);
  }
  await stop(restarted);
  console.log(`ELECTRON_EXTENSION_E2E_OK ${JSON.stringify({ library: created.data.path, count: restored.data.items.length })}`);
} finally {
  await stop(electron);
  await stop(backend);
  await new Promise((resolve) => fixture.fixture.close(resolve));
  try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
}
