/**
 * M5-2（F22）：非默认端口生产验收。
 *
 * 本测试不另起一套“近似生产”脚本，而是直接运行 `scripts/start-production.mjs`：
 *   - 四个 EAGLE_*_PORT 全部换成动态端口；
 *   - 使用既有 dist 产物，验证前后产物摘要不变；
 *   - 通过 Electron CDP 观测主窗、文档工作区、工作台、路线图的真实请求 URL；
 *   - 断言所有 loopback 请求只命中覆盖后的端口，默认端口不得回流。
 *
 * 用法：npm run build && node tests/production-runtime-ports.mjs
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { delay, freePort, stop, waitFor } from './react-cdp-harness.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(projectRoot, 'dist', 'frontend');
const distIndex = path.join(distRoot, 'src', 'app', 'index.html');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-production-ports-'));
const stalePorts = new Set(['4173', '41695', '41692', '41693', '5176']);

if (!fs.existsSync(distIndex)) {
  console.error(`FAIL 产物缺失：${distIndex}（先运行 npm run build）`);
  process.exit(1);
}

function digestTree(root) {
  const hash = crypto.createHash('sha256');
  const walk = (dir, prefix = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = prefix ? path.join(prefix, entry.name) : entry.name;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, rel);
      } else if (entry.isFile()) {
        const stat = fs.statSync(full);
        hash.update(rel.replaceAll(path.sep, '/'));
        hash.update('\0');
        hash.update(String(stat.size));
        hash.update('\0');
        hash.update(fs.readFileSync(full));
        hash.update('\0');
      }
    }
  };
  walk(root);
  return hash.digest('hex');
}

function spawnLogged(command, args, env) {
  const child = spawn(command, args, { cwd: projectRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  return { child, output: () => output };
}

async function connectCollector(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const events = [];
  let nextId = 0;
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      message.error ? entry.reject(new Error(JSON.stringify(message.error))) : entry.resolve(message.result);
      return;
    }
    events.push(message);
  };
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  return {
    ws,
    events,
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

async function postJson(base, route, body) {
  const response = await fetch(`${base}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok || payload.status !== 'success') {
    throw new Error(`${route} failed: ${JSON.stringify(payload)}`);
  }
  return payload.data;
}

const distDigestBefore = digestTree(distRoot);
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
]) {
  delete baseEnv[key];
}

const stack = spawnLogged(process.execPath, ['scripts/start-production.mjs'], {
  ...baseEnv,
  EAGLE_FRONTEND_PORT: String(frontendPort),
  EAGLE_API_PORT: String(apiPort),
  EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
  EAGLE_EXTENSION_PORT: String(extensionPort),
  EAGLE_DEBUG_PORT: String(debugPort),
  EAGLE_START_READY_TIMEOUT_MS: '30000',
  EAGLE_LIBRARY_STATE_FILE: path.join(tempRoot, 'library-state.json'),
  EAGLE_USER_DATA_DIR: path.join(tempRoot, 'backend-user-data'),
  EAGLE_ELECTRON_USER_DATA_DIR: path.join(tempRoot, 'electron-user-data'),
});

let page = null;

function localRequestUrls(fromIndex = 0) {
  if (!page) return [];
  return page.events
    .slice(fromIndex)
    .filter((entry) => entry.method === 'Network.requestWillBeSent')
    .map((entry) => entry.params?.request?.url)
    .filter((url) => {
      if (!url || !/^https?:/i.test(url)) return false;
      const parsed = new URL(url);
      return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1';
    });
}

function assertOnlyExpectedPorts(urls, label) {
  const unexpected = urls.filter((url) => {
    const port = new URL(url).port;
    return !port || stalePorts.has(port) || !new Set([String(frontendPort), String(apiPort), String(thumbnailPort), String(extensionPort)]).has(port);
  });
  assert.deepEqual(unexpected, [], `${label} 命中了非覆盖端口或默认端口：${JSON.stringify(unexpected)}`);
}

async function evaluate(expression, timeout = 15000) {
  const result = await page.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    timeout,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

async function waitForRequest(urlsFrom, predicate, label, timeout = 30000) {
  return waitFor(() => {
    const urls = localRequestUrls(urlsFrom);
    return urls.find(predicate) || null;
  }, label, timeout);
}

async function waitForRuntimeConfig(label) {
  await waitFor(async () => evaluate(`window.__EAGLE_API_BASE_URL === ${JSON.stringify(expectedApiBase)}
    && window.__EAGLE_THUMBNAIL_URL === ${JSON.stringify(expectedThumbnailBase)}
    && window.__EAGLE_EXTENSION_BASE_URL === ${JSON.stringify(expectedExtensionBase)}
    && document.readyState === 'complete'`), `${label} runtime config`, 30000);
}

async function navigateProductionPage(url, label, requestMatcher) {
  const fromIndex = page.events.length;
  await page.send('Page.navigate', { url });
  await waitForRuntimeConfig(label);
  const urls = localRequestUrls(fromIndex);
  let matched;
  try {
    matched = await waitForRequest(fromIndex, requestMatcher, `${label} matched request`);
  } catch (err) {
    console.error(`OBSERVED ${label} ${JSON.stringify(urls)}`);
    throw err;
  }
  assertOnlyExpectedPorts(urls, label);
  console.log(`PASS ${label} request -> ${matched}`);
  console.log(`REQUESTS ${label} ${JSON.stringify(urls)}`);
  return { fromIndex, urls, matched };
}

try {
  await waitFor(() => stack.output().includes('[start:prod] all services ready; launching Electron'), 'production services ready', 45000);
  const startupLog = stack.output();
  const frontendReadyAt = startupLog.indexOf('[start:prod] frontend ready');
  const backendReadyAt = startupLog.indexOf('[start:prod] backend-api ready');
  const launchAt = startupLog.indexOf('[start:prod] all services ready; launching Electron');
  assert.ok(frontendReadyAt >= 0, '启动日志必须记录 frontend ready');
  assert.ok(backendReadyAt >= 0, '启动日志必须记录 backend-api ready');
  assert.ok(frontendReadyAt < launchAt && backendReadyAt < launchAt, 'Electron 必须在前后端就绪日志之后启动');
  console.log(`PASS start-production readiness order ${JSON.stringify({ frontendReadyAt, backendReadyAt, launchAt })}`);

  await waitFor(async () => {
    try {
      return (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).ok;
    } catch {
      return false;
    }
  }, 'Electron CDP', 30000);

  for (let attempt = 0; attempt < 20 && !page; attempt++) {
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    const target = targets.find((entry) => entry.type === 'page' && entry.url.includes(String(frontendPort)));
    if (!target) {
      await delay(250);
      continue;
    }
    try {
      page = await Promise.race([
        connectCollector(target.webSocketDebuggerUrl),
        new Promise((resolve, reject) => setTimeout(() => reject(new Error('CDP connect timeout')), 6000)),
      ]);
    } catch {
      page = null;
      await delay(250);
    }
  }
  assert.ok(page, 'Electron page CDP 连接成功');
  await page.send('Runtime.enable');
  await page.send('Page.enable');
  await page.send('Network.enable');

  fs.mkdirSync(path.join(tempRoot, 'libraries'), { recursive: true });
  await postJson(apiBase, '/api/library/create', {
    name: 'M5 Production Ports',
    savePath: path.join(tempRoot, 'libraries'),
  });
  const documentPath = path.join(tempRoot, 'Port Acceptance.md');
  fs.writeFileSync(documentPath, '# M5 non-default port acceptance\n\nproduction runtime config\n', 'utf8');
  const imported = await postJson(apiBase, '/api/item/addFromPaths', { paths: [documentPath] });
  const documentItem = imported.find((entry) => entry && entry.id);
  assert.ok(documentItem, '真实测试文档导入成功');

  const mainResult = await navigateProductionPage(`${frontendOrigin}/src/app/index.html`, 'main-window', (requestUrl) => {
    const parsed = new URL(requestUrl);
    return parsed.port === String(frontendPort) && parsed.pathname.startsWith('/file/');
  });
  await waitFor(() => evaluate(`!!document.querySelector('#main-app') && !!window.__eagleDriver`), 'main window mounted', 45000);
  await waitFor(() => evaluate(`(() => {
    const driver = window.__eagleDriver;
    return !!(driver && Array.isArray(driver.raw)
      && driver.raw.some((entry) => entry && entry.id === ${JSON.stringify(documentItem.id)}));
  })()`), 'main window real-library item', 30000);
  const mainConfig = await evaluate(`({
    api: window.__EAGLE_API_BASE_URL,
    thumbnail: window.__EAGLE_THUMBNAIL_URL,
    extension: window.__EAGLE_EXTENSION_BASE_URL,
    origin: location.origin,
    libraryItemCount: window.__eagleDriver.raw.length,
    importedItemVisible: window.__eagleDriver.raw.some((entry) => entry && entry.id === ${JSON.stringify(documentItem.id)})
  })`);
  assert.deepEqual({
    api: mainConfig.api,
    thumbnail: mainConfig.thumbnail,
    extension: mainConfig.extension,
    origin: mainConfig.origin,
  }, {
    api: expectedApiBase,
    thumbnail: expectedThumbnailBase,
    extension: expectedExtensionBase,
    origin: frontendOrigin,
  });
  assert.equal(mainConfig.importedItemVisible, true, '主窗必须载入真实临时库条目');
  console.log(`PASS main-window runtime config ${JSON.stringify(mainConfig)}`);

  const opened = await evaluate(`(() => {
    const driver = window.__eagleDriver;
    const item = driver && Array.isArray(driver.raw)
      ? driver.raw.find((entry) => entry && entry.id === ${JSON.stringify(documentItem.id)})
      : null;
    if (!driver || !item || typeof driver.enterDetailMode !== 'function') {
      return { ok: false, hasDriver: !!driver, hasItem: !!item };
    }
    driver.enterDetailMode(null, item);
    return { ok: true, id: item.id };
  })()`);
  assert.equal(opened.ok, true, `主窗无法打开文档工作区：${JSON.stringify(opened)}`);
  await waitFor(() => evaluate(`(() => {
    const container = document.querySelector('#eagle-document-viewer-container[data-viewer-ready]');
    const frame = container && container.querySelector('iframe');
    return !!(frame && frame.contentWindow
      && frame.contentWindow.__EAGLE_API_BASE_URL === ${JSON.stringify(expectedApiBase)});
  })()`), 'document viewer ready', 30000);
  const embeddedDocument = await evaluate(`(() => {
    const frame = document.querySelector('#eagle-document-viewer-container[data-viewer-ready] iframe');
    return {
      src: frame && frame.src,
      api: frame && frame.contentWindow && frame.contentWindow.__EAGLE_API_BASE_URL
    };
  })()`);
  assert.equal(embeddedDocument.api, expectedApiBase);
  assert.ok(embeddedDocument.src.includes('/src/app/react/viewers/document/index.html'), `文档工作区 URL 异常：${embeddedDocument.src}`);
  console.log(`PASS document-workspace embedded ${JSON.stringify(embeddedDocument)}`);

  const documentPageUrl = `${frontendOrigin}/src/app/react/viewers/document/index.html?id=${encodeURIComponent(documentItem.id)}`
    + `&ids=${encodeURIComponent(documentItem.id)}&mode=workspace&chrome=external&theme=dark&library=eagle`;
  const documentPage = await navigateProductionPage(documentPageUrl, 'document-window', (requestUrl) => {
    const parsed = new URL(requestUrl);
    return parsed.port === String(apiPort) && parsed.pathname === '/api/v2/item/textDetail';
  });
  console.log(`PASS document-window /api/v2/item/textDetail -> ${documentPage.matched}`);
  console.log(`REQUESTS document-window ${JSON.stringify(documentPage.urls)}`);

  await navigateProductionPage(`${frontendOrigin}/workbench.html`, 'workbench', (requestUrl) => {
    const parsed = new URL(requestUrl);
    return parsed.port === String(apiPort) && parsed.pathname === '/api/library/info';
  });
  await navigateProductionPage(`${frontendOrigin}/roadmap.html`, 'roadmap', (requestUrl) => {
    const parsed = new URL(requestUrl);
    return parsed.port === String(apiPort) && parsed.pathname === '/api/item/list';
  });

  const allObserved = localRequestUrls(0);
  const defaultPortRequests = allObserved.filter((url) => stalePorts.has(new URL(url).port));
  assert.deepEqual(defaultPortRequests, [], `观察到默认端口请求回流：${JSON.stringify(defaultPortRequests)}`);

  const distDigestAfter = digestTree(distRoot);
  assert.equal(distDigestAfter, distDigestBefore, '同一产物验收期间 dist 摘要发生变化（疑似重新构建）');
  console.log(`PASS artifact unchanged ${distDigestAfter}`);
  console.log(`PRODUCTION_RUNTIME_PORTS_OK ${JSON.stringify({
    ports: { frontendPort, apiPort, thumbnailPort, extensionPort },
    pages: {
      main: mainResult.urls,
      document: documentPage.urls,
    },
    artifactDigest: distDigestAfter,
  })}`);
} catch (err) {
  console.error(`PRODUCTION_RUNTIME_PORTS_FAILED ${err.stack || err.message}`);
  console.error(stack.output().slice(-12000));
  process.exitCode = 1;
} finally {
  try { page?.ws?.close(); } catch {}
  await stop(stack).catch(() => {});
  try {
    fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch {}
}
