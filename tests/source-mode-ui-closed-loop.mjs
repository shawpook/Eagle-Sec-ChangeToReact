import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronExecutable = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-source-mode-ui-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const sourceRoot = path.join(tempRoot, 'sources');
const stateFile = path.join(tempRoot, 'library-state.json');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourceRoot, { recursive: true });

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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    await delay(100);
  }
  throw new Error(`${label} timeout${lastError ? `: ${lastError.message}` : ''}`);
}

async function stop(processInfo) {
  const child = processInfo && processInfo.child;
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill();
  await Promise.race([exited, delay(1000)]);
  if (child.exitCode === null) {
    if (process.platform === 'win32') {
      const killed = new Promise((resolve) => {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        killer.once('exit', resolve);
        killer.once('error', resolve);
      });
      await Promise.race([killed, delay(1000)]);
    } else {
      try {
        process.kill(child.pid, 'SIGKILL');
      } catch (err) {
        // Already exited.
      }
    }
    await delay(200);
  }
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

const [apiPort, thumbnailPort, extensionPort, vitePort, debugPort] = await Promise.all([
  freePort(), freePort(), freePort(), freePort(), freePort(),
]);
const baseEnv = { ...process.env };
delete baseEnv.ELECTRON_RUN_AS_NODE;
const backendEnv = {
  ...baseEnv,
  EAGLE_API_PORT: String(apiPort),
  EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
  EAGLE_EXTENSION_PORT: String(extensionPort),
  EAGLE_LIBRARY_STATE_FILE: stateFile,
  EAGLE_USER_DATA_DIR: path.join(tempRoot, 'user-data'),
  EAGLE_SOURCE_FOLDER_FIXTURE: sourceRoot,
};
const viteEnv = {
  ...baseEnv,
  EAGLE_API_URL: `http://localhost:${apiPort}`,
  EAGLE_THUMBNAIL_URL: `http://localhost:${thumbnailPort}`,
  EAGLE_EXTENSION_URL: `http://localhost:${extensionPort}`,
};

const backend = spawnLogged(process.execPath, ['backend/src/server.js'], backendEnv);
const vite = spawnLogged(process.execPath, [
  'node_modules/vite/bin/vite.js',
  '--config',
  'frontend/vite.preview.config.mjs',
  '--port',
  String(vitePort),
  '--strictPort',
], viteEnv);
let electron;

try {
  await waitFor(() => backend.output().includes(`localhost:${apiPort}`), 'backend startup');
  await waitFor(async () => (await fetch(`http://127.0.0.1:${vitePort}/src/app/index.html`)).ok, 'Vite main UI');

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
  const get = async (route) => {
    const response = await fetch(`http://127.0.0.1:${apiPort}${route}`);
    const payload = await response.json();
    if (!response.ok || payload.status !== 'success') throw new Error(`${route} failed: ${JSON.stringify(payload)}`);
    return payload.data;
  };

  const png = await sharp({
    create: { width: 16, height: 10, channels: 4, background: '#38bdf8' },
  }).png().toBuffer();
  fs.writeFileSync(path.join(sourceRoot, 'ui-sample.png'), png);

  await post('/api/library/create', { name: 'Source Mode UI', savePath: librariesRoot });

  electron = spawnLogged(electronExecutable, ['electron/main.cjs', '--regression-host'], {
    ...backendEnv,
    EAGLE_API_URL: `http://localhost:${apiPort}`,
    EAGLE_THUMBNAIL_URL: `http://localhost:${thumbnailPort}`,
    EAGLE_PREVIEW_URL: `http://127.0.0.1:${vitePort}/src/app/index.html`,
    EAGLE_DEBUG_PORT: String(debugPort),
    EAGLE_ELECTRON_USER_DATA_DIR: path.join(tempRoot, 'electron-user-data'),
  });
  await waitFor(async () => (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).ok, 'Electron CDP');
  await waitFor(() => electron.output().includes('REGRESSION_HOST_READY'), 'Electron host');

  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const target = targets.find((entry) => entry.type === 'page' && entry.url.includes(String(vitePort)));
  if (!target) throw new Error(`Main page target not found: ${JSON.stringify(targets)}`);
  const page = await connect(target.webSocketDebuggerUrl);
  await page.send('Runtime.enable');

  await waitFor(async () => {
    const result = await page.send('Runtime.evaluate', {
      expression: `
        Boolean(Array.from(document.querySelectorAll('.sidebar-toolbar .icon-btn'))
          .find((entry) => entry.querySelector('img[src*="ic_switch.svg"]')))
      `,
      returnByValue: true,
    });
    return result.result && result.result.value;
  }, 'switch folder button');

  await page.send('Runtime.evaluate', {
    expression: `
      (() => {
        const button = Array.from(document.querySelectorAll('.sidebar-toolbar .icon-btn'))
          .find((entry) => entry.querySelector('img[src*="ic_switch.svg"]'));
        if (!button) return false;
        button.click();
        return true;
      })()
    `,
    returnByValue: true,
  });

  await waitFor(async () => {
    const result = await page.send('Runtime.evaluate', {
      expression: `Boolean(document.querySelector('#source-mode-add-folder'))`,
      returnByValue: true,
    });
    return result.result && result.result.value;
  }, 'source mode add button');

  await page.send('Runtime.evaluate', {
    expression: `
      (() => {
        const button = document.querySelector('#source-mode-add-folder');
        if (!button) return false;
        button.click();
        return true;
      })()
    `,
    returnByValue: true,
  });

  await waitFor(async () => {
    const state = await get('/api/source-roots');
    return state.some((root) => root.path === sourceRoot && root.assetCount === 1);
  }, 'source root indexed');

  await waitFor(async () => {
    const result = await page.send('Runtime.evaluate', {
      expression: `
        (() => {
          return document.body.innerText.includes('ui-sample');
        })()
      `,
      returnByValue: true,
    });
    return result.result && result.result.value;
  }, 'source asset rendered in original Eagle grid');

  await page.send('Runtime.evaluate', {
    expression: `
      (() => {
        const button = Array.from(document.querySelectorAll('.sidebar-toolbar .icon-btn'))
          .find((entry) => entry.querySelector('img[src*="ic_switch.svg"]'));
        if (!button) return false;
        button.click();
        return true;
      })()
    `,
    returnByValue: true,
  });

  await waitFor(async () => {
    const result = await page.send('Runtime.evaluate', {
      expression: `!document.querySelector('#eagle-source-mode-sidebar') && !document.querySelector('#source-mode-add-folder')`,
      returnByValue: true,
    });
    return result.result && result.result.value;
  }, 'source mode closed');

  page.ws.close();
  console.log('SOURCE_MODE_UI_OK');
} finally {
  await stop(electron);
  await stop(vite);
  await stop(backend);
  try {
    fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch (err) {
    console.warn(`SOURCE_MODE_UI_CLEANUP_WARNING ${err.message}`);
  }
}
