import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronExecutable = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const extensionPath = path.join(projectRoot, 'tests', 'fixtures', 'browser-extension-mv2');
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
    const server = http.createServer();
    server.once('error', () => resolve(true));
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(false));
    });
  });
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const entry = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? entry.reject(new Error(JSON.stringify(msg.error))) : entry.resolve(msg.result);
    }
  };
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  return {
    ws,
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const msgId = ++id;
        pending.set(msgId, { resolve, reject });
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    },
  };
}

const fixture = await startFixture();
if (await portInUse(41593)) {
  console.log('BROWSER_CAPTURE_EXTENSION_E2E_BLOCKED original port 41593 is occupied');
  await new Promise((resolve) => fixture.fixture.close(resolve));
  fs.rmSync(tempRoot, { recursive: true, force: true });
  process.exit(0);
}
const [apiPort, thumbnailPort, debugPort] = await Promise.all([freePort(), freePort(), freePort()]);
const backendEnv = {
  ...process.env,
  EAGLE_API_PORT: String(apiPort),
  EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
  EAGLE_EXTENSION_PORT: '41593',
  EAGLE_LIBRARY_STATE_FILE: stateFile,
  EAGLE_USER_DATA_DIR: path.join(tempRoot, 'user-data'),
  EAGLE_DOWNLOAD_ALLOW_HOSTS: '127.0.0.1',
};
const backend = spawnLogged(process.execPath, ['backend/src/server.js'], backendEnv);
let electron;
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

  const capture = async (type) => {
    const result = await page.send('Runtime.evaluate', {
      expression: `(async () => {
        document.documentElement.removeAttribute('data-eagle-reverse-response');
        window.postMessage({ channel: 'eagle-reverse-collect', request: { type: ${JSON.stringify(type)} } }, '*');
        const deadline = Date.now() + 15000;
        while (!document.documentElement.getAttribute('data-eagle-reverse-response')) {
          if (Date.now() > deadline) throw new Error('capture response timeout');
          await new Promise((resolve) => setTimeout(resolve, 75));
        }
        return JSON.parse(document.documentElement.getAttribute('data-eagle-reverse-response'));
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      const attrs = await page.send('Runtime.evaluate', {
        expression: `JSON.stringify({
          received: document.documentElement.getAttribute('data-eagle-reverse-message-received'),
          response: document.documentElement.getAttribute('data-eagle-reverse-send-response'),
        })`,
        returnByValue: true,
      });
      throw new Error(JSON.stringify({ exception: result.exceptionDetails, attrs: attrs.result.value }));
    }
    const response = result.result.value;
    if (!response || response.ok !== true) throw new Error(`Extension capture failed: ${JSON.stringify(response)}`);
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
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
