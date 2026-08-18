/* 临时：抓取浏览器预览（mock 路径）的真实控制台错误 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronExecutable = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-tabbar-console-'));

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
  while (Date.now() < deadline) {
    try { const v = await check(); if (v) return v; } catch (err) { /* retry */ }
    await delay(100);
  }
  throw new Error(`${label} timeout`);
}
async function stop(processInfo) {
  const child = processInfo && processInfo.child;
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill();
  await Promise.race([exited, delay(1000)]);
  if (child.exitCode === null) {
    const killed = new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      killer.once('exit', resolve);
      killer.once('error', resolve);
    });
    await Promise.race([killed, delay(1000)]);
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
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
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

const [vitePort, debugPort, deadApiPort] = await Promise.all([freePort(), freePort(), freePort()]);
const baseEnv = { ...process.env };
delete baseEnv.ELECTRON_RUN_AS_NODE;
const viteEnv = {
  ...baseEnv,
  EAGLE_API_URL: `http://localhost:${deadApiPort}`, // 死端口 → desktopApi 失败 → 走 mock 路径
  EAGLE_THUMBNAIL_URL: `http://localhost:${deadApiPort}`,
  EAGLE_EXTENSION_URL: `http://localhost:${deadApiPort}`,
};
const vite = spawnLogged(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'frontend/vite.preview.config.mjs', '--port', String(vitePort), '--strictPort'], viteEnv);
let electron;
let page;

try {
  await waitFor(async () => (await fetch(`http://127.0.0.1:${vitePort}/src/app/index.html`)).ok, 'Vite main UI');
  electron = spawnLogged(electronExecutable, ['electron/main.cjs', '--regression-host'], {
    ...baseEnv,
    EAGLE_API_URL: `http://localhost:${deadApiPort}`,
    EAGLE_THUMBNAIL_URL: `http://localhost:${deadApiPort}`,
    EAGLE_PREVIEW_URL: `http://127.0.0.1:${vitePort}/src/app/index.html`,
    EAGLE_DEBUG_PORT: String(debugPort),
    EAGLE_ELECTRON_USER_DATA_DIR: path.join(tempRoot, 'user-data'),
  });
  await waitFor(async () => (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).ok, 'Electron CDP');
  await waitFor(() => electron.output().includes('REGRESSION_HOST_READY'), 'Electron host');
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const target = targets.find((entry) => entry.type === 'page' && entry.url.includes(String(vitePort)));
  page = await connect(target.webSocketDebuggerUrl);
  await page.send('Runtime.enable');
  await page.send('Log.enable');

  const errors = [];
  const exceptions = [];
  // 包装原有 onmessage 处理器（不能覆盖，否则 pending map 失效导致 send 挂起）
  const originalOnMessage = page.ws.onmessage;
  page.ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) {
        errors.push(message.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 300));
      }
      if (message.method === 'Runtime.exceptionThrown') {
        exceptions.push((message.params.exceptionDetails && (message.params.exceptionDetails.text || (message.params.exceptionDetails.exception && message.params.exceptionDetails.exception.description))) || '');
      }
      if (message.method === 'Log.entryAdded') {
        const e = message.params.entry;
        if (e.level === 'error' || e.level === 'warning') errors.push(`[log.${e.level}] ${e.text}`.slice(0, 300));
      }
    } catch (err) { /* ignore */ }
    if (typeof originalOnMessage === 'function') originalOnMessage(event);
  };

  await page.send('Page.enable');
  await delay(6000);

  async function evaluate(expression) {
    const result = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) return { evalError: result.exceptionDetails.text };
    return result.result && result.result.value;
  }
  const state = await evaluate(`
    (function(){
      const s = window.angular ? angular.element(document.body).scope() : null;
      return {
        isUILoaded: s && s.isUILoaded,
        isLoading: s && s.isLoading,
        raw: s && Array.isArray(s.raw) ? s.raw.length : null,
        allData: s && Array.isArray(s.allData) ? s.allData.length : null,
        folderMappings: s && s.folderMappings ? Object.keys(s.folderMappings).length : null,
        mockCache: window.__mockLibraryCache ? window.__mockLibraryCache.length : null,
        folderItems: document.querySelectorAll('.sidebar-folder-item').length,
        boxCount: document.querySelectorAll('#box-container .box').length,
        tabBar: document.querySelectorAll('#eagle-tab-bar .eagle-tab').length,
      };
    })()
  `);
  console.log('STATE:', JSON.stringify(state, null, 2));
  console.log('CONSOLE ERRORS (' + errors.length + '):');
  errors.slice(0, 20).forEach((e) => console.log('  -', e));
  console.log('EXCEPTIONS (' + exceptions.length + '):');
  exceptions.slice(0, 10).forEach((e) => console.log('  -', e.slice(0, 300)));
  page.ws.close();
} finally {
  if (page && page.ws && page.ws.readyState === WebSocket.OPEN) page.ws.close();
  await stop(electron);
  await stop(vite);
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch (err) { /* best effort */ }
}
