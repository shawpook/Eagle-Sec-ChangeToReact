import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronExecutable = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-library-switch-ui-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
fs.mkdirSync(librariesRoot, { recursive: true });

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

function spawnLogged(command, args, env) {
  const child = spawn(command, args, { cwd: projectRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  return { child, output: () => output };
}

async function waitFor(check, label, timeout = 30000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${label} timeout${lastError ? `: ${lastError.message}` : ''}`);
}

async function stop(processInfo) {
  if (!processInfo || processInfo.child.exitCode !== null) return;
  processInfo.child.kill();
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 3000);
    processInfo.child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const entry = pending.get(message.id);
      pending.delete(message.id);
      message.error ? entry.reject(new Error(JSON.stringify(message.error))) : entry.resolve(message.result);
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
        const messageId = ++id;
        pending.set(messageId, { resolve, reject });
        ws.send(JSON.stringify({ id: messageId, method, params }));
      });
    },
  };
}

const [apiPort, thumbnailPort, extensionPort, vitePort, debugPort] = await Promise.all([freePort(), freePort(), freePort(), freePort(), freePort()]);
const baseEnv = { ...process.env };
delete baseEnv.ELECTRON_RUN_AS_NODE;
if (baseEnv.NODE_OPTIONS) {
  baseEnv.NODE_OPTIONS = baseEnv.NODE_OPTIONS.replace(/(?:^|\s)--use-system-ca(?=\s|$)/g, ' ').trim();
  if (!baseEnv.NODE_OPTIONS) delete baseEnv.NODE_OPTIONS;
}
const backendEnv = {
  ...baseEnv,
  EAGLE_API_PORT: String(apiPort),
  EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
  EAGLE_EXTENSION_PORT: String(extensionPort),
  EAGLE_LIBRARY_STATE_FILE: stateFile,
  EAGLE_USER_DATA_DIR: path.join(tempRoot, 'user-data'),
};
const backend = spawnLogged(process.execPath, ['backend/src/server.js'], backendEnv);
const vite = spawnLogged(process.execPath, [
  'node_modules/vite/bin/vite.js',
  '--config',
  'frontend/vite.preview.config.mjs',
  '--port',
  String(vitePort),
  '--strictPort',
], {
  ...baseEnv,
  EAGLE_API_URL: `http://localhost:${apiPort}`,
  EAGLE_EXTENSION_URL: `http://localhost:${extensionPort}`,
  EAGLE_THUMBNAIL_URL: `http://localhost:${thumbnailPort}`,
});
let electron;
try {
  await waitFor(() => backend.output().includes(`localhost:${apiPort}`), 'backend startup');
  await waitFor(async () => (await fetch(`http://127.0.0.1:${vitePort}/src/app/index.html`)).ok, 'Vite startup');

  const post = async (route, body) => {
    const response = await fetch(`http://127.0.0.1:${apiPort}${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok || payload.status !== 'success') throw new Error(`${route} failed: ${JSON.stringify(payload)}`);
    return payload.data;
  };
  const first = await post('/api/library/create', { name: 'Switch UI A', savePath: librariesRoot });
  const second = await post('/api/library/create', { name: 'Switch UI B', savePath: librariesRoot });

  electron = spawnLogged(electronExecutable, ['electron/main.cjs', '--regression-host'], {
    ...backendEnv,
    EAGLE_API_URL: `http://localhost:${apiPort}`,
    EAGLE_THUMBNAIL_URL: `http://localhost:${thumbnailPort}`,
    EAGLE_PREVIEW_URL: `http://127.0.0.1:${vitePort}/src/app/index.html`,
    EAGLE_DEBUG_PORT: String(debugPort),
    EAGLE_ELECTRON_USER_DATA_DIR: path.join(tempRoot, 'electron-user-data'),
  });
  await waitFor(async () => {
    try {
      return (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).ok;
    } catch (err) {
      return false;
    }
  }, 'Electron CDP');
  await waitFor(() => electron.output().includes('REGRESSION_HOST_READY'), 'Electron host');

  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const target = targets.find((entry) => entry.type === 'page' && entry.url.includes(String(vitePort)));
  if (!target) throw new Error(`Main UI page target not found: ${JSON.stringify(targets)}`);
  const page = await connect(target.webSocketDebuggerUrl);
  await page.send('Runtime.enable');

  const switchViaOriginalEvent = async (libraryPath) => {
    await page.send('Runtime.evaluate', {
      expression: `require('electron').ipcRenderer.send('add-to-history-and-open', ${JSON.stringify(libraryPath)}); true`,
      returnByValue: true,
    });
    await waitFor(async () => {
      const payload = await (await fetch(`http://127.0.0.1:${apiPort}/api/library/current`)).json();
      return payload.data.path === libraryPath;
    }, `switch to ${libraryPath}`);
  };

  await switchViaOriginalEvent(second.path);
  await switchViaOriginalEvent(first.path);
  page.ws.close();
  console.log(`LIBRARY_SWITCH_UI_OK ${JSON.stringify({ first: first.path, second: second.path })}`);
} finally {
  await stop(electron);
  await stop(vite);
  await stop(backend);
  try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
}
