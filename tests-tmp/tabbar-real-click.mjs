/* 临时：真实鼠标点击测试 —— 用 CDP Input.dispatchMouseEvent 走 OS 命中测试 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronExecutable = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-tabbar-realclick-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const imagesRoot = path.join(tempRoot, 'images');
const stateFile = path.join(tempRoot, 'library-state.json');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(imagesRoot, { recursive: true });

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

const [apiPort, thumbnailPort, extensionPort, vitePort, debugPort] = await Promise.all([freePort(), freePort(), freePort(), freePort(), freePort()]);
const baseEnv = { ...process.env };
delete baseEnv.ELECTRON_RUN_AS_NODE;
const backendEnv = {
  ...baseEnv,
  EAGLE_API_PORT: String(apiPort),
  EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
  EAGLE_EXTENSION_PORT: String(extensionPort),
  EAGLE_LIBRARY_STATE_FILE: stateFile,
  EAGLE_USER_DATA_DIR: path.join(tempRoot, 'user-data'),
};
const viteEnv = {
  ...baseEnv,
  EAGLE_API_URL: `http://localhost:${apiPort}`,
  EAGLE_THUMBNAIL_URL: `http://localhost:${thumbnailPort}`,
  EAGLE_EXTENSION_URL: `http://localhost:${extensionPort}`,
};
const backend = spawnLogged(process.execPath, ['backend/src/server.js'], backendEnv);
const vite = spawnLogged(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'frontend/vite.preview.config.mjs', '--port', String(vitePort), '--strictPort'], viteEnv);
let electron;
let page;

try {
  await waitFor(() => backend.output().includes(`localhost:${apiPort}`), 'backend startup');
  await waitFor(async () => (await fetch(`http://127.0.0.1:${vitePort}/src/app/index.html`)).ok, 'Vite main UI');
  const post = async (route, body) => {
    const response = await fetch(`http://127.0.0.1:${apiPort}${route}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok || payload.status !== 'success') throw new Error(`${route} failed: ${JSON.stringify(payload)}`);
    return payload.data;
  };
  await post('/api/library/create', { name: 'Real Click', savePath: librariesRoot });
  const imagePaths = [];
  for (let i = 0; i < 8; i += 1) {
    const file = path.join(imagesRoot, `rc-${i}.png`);
    await sharp({ create: { width: 400 + i * 40, height: 300 + i * 30, channels: 4, background: { r: i * 30, g: 100, b: 200, alpha: 1 } } }).png().toFile(file);
    imagePaths.push(file);
  }
  const imported = await post('/api/item/addFromPaths', { paths: imagePaths });
  const folder = await post('/api/folder/create', { name: '真实点击测试' });
  for (const item of imported) await post('/api/item/update', { id: item.id, folders: [folder.id] });

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
  page = await connect(target.webSocketDebuggerUrl);
  await page.send('Runtime.enable');
  await page.send('Page.enable');

  async function evaluate(expression) {
    const result = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error('evaluate failed: ' + JSON.stringify(result.exceptionDetails));
    return result.result && result.result.value;
  }

  await waitFor(() => evaluate(`document.querySelectorAll('#eagle-tab-bar .eagle-tab').length >= 1`), 'tab bar rendered');

  // 获取 + 按钮的真实坐标
  const addRect = await evaluate(`
    (function(){
      const el = document.querySelector('#eagle-tab-bar .eagle-tab-add');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()
  `);
  console.log('[real-click] add button center:', JSON.stringify(addRect));

  // 用 Input.dispatchMouseEvent 发送真实鼠标点击（走 OS 命中测试）
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: addRect.x, y: addRect.y, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: addRect.x, y: addRect.y, button: 'left', clickCount: 1 });

  await waitFor(() => evaluate(`document.querySelectorAll('#eagle-tab-bar .eagle-tab').length === 2`), 'real click on + added a tab');
  console.log('[real-click] + button REAL mouse click works (2 tabs)');

  // 打开文件夹（真实点击侧栏文件夹）
  const folderRect = await evaluate(`
    (function(){
      const el = document.querySelector('.sidebar-folder-item');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()
  `);
  if (folderRect) {
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: folderRect.x, y: folderRect.y, button: 'left', clickCount: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: folderRect.x, y: folderRect.y, button: 'left', clickCount: 1 });
    await delay(1500);
  }

  // 现在点第一个标签（真实点击）→ 应切回全部页
  const tab1Rect = await evaluate(`
    (function(){
      const el = document.querySelectorAll('#eagle-tab-bar .eagle-tab')[0];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + 20, y: r.y + r.height / 2 };
    })()
  `);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: tab1Rect.x, y: tab1Rect.y, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: tab1Rect.x, y: tab1Rect.y, button: 'left', clickCount: 1 });

  await waitFor(() => evaluate(`
    (function(){
      const s = window.angular ? angular.element(document.body).scope() : null;
      return Boolean(s && !s.currentFolder && s.viewMode === 'all');
    })()
  `), 'real click on tab 1 switched to All view');
  console.log('[real-click] tab 1 REAL mouse click switched page');

  // 注入页面级点击监听（capture），记录每个 click 的目标
  await evaluate(`
    (function(){
      window.__clickLog = [];
      document.addEventListener('click', function(e){
        var tabEl = e.target && e.target.closest ? e.target.closest('.eagle-tab') : null;
        var addEl = e.target && e.target.closest ? e.target.closest('.eagle-tab-add') : null;
        window.__clickLog.push({
          t: Date.now(),
          tag: e.target ? e.target.tagName : null,
          cls: e.target && e.target.className ? (typeof e.target.className === 'string' ? e.target.className : '') : null,
          tabId: tabEl ? tabEl.dataset.id : null,
          add: Boolean(addEl),
          x: e.clientX, y: e.clientY,
        });
      }, true);
      return true;
    })()
  `);
  // 真实点击第二个标签 → 切回文件夹
  const diagBefore = await evaluate(`
    (function(){
      const s = window.angular ? angular.element(document.body).scope() : null;
      let stored = null;
      try { stored = JSON.parse(localStorage.getItem('eagle.tab-bar.v1')); } catch (e) {}
      return {
        activeLabel: document.querySelector('#eagle-tab-bar .eagle-tab.active .eagle-tab-label') && document.querySelector('#eagle-tab-bar .eagle-tab.active .eagle-tab-label').textContent,
        tabCount: document.querySelectorAll('#eagle-tab-bar .eagle-tab').length,
        currentFolder: s && s.currentFolder ? s.currentFolder.name : null,
        viewMode: s && s.viewMode,
        storedTabs: stored ? stored.tabs.map(function(t){ return { label: t.label, state: t.state }; }) : null,
        storedActive: stored ? stored.activeId : null,
      };
    })()
  `);
  console.log('[real-click] BEFORE tab2 click:', JSON.stringify(diagBefore));

  const tab2Rect = await evaluate(`
    (function(){
      const el = document.querySelectorAll('#eagle-tab-bar .eagle-tab')[1];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + 20, r.y + r.height / 2);
      return {
        x: r.x + 20, y: r.y + r.height / 2,
        rect: { x: r.x, y: r.y, w: r.width, h: r.height },
        hitTag: hit ? hit.tagName : null,
        hitClass: hit ? hit.className : null,
        allTabs: Array.from(document.querySelectorAll('#eagle-tab-bar .eagle-tab')).map(function(t){ return { label: t.textContent, cls: t.className }; }),
      };
    })()
  `);
  console.log('[real-click] tab2 rect/hit:', JSON.stringify(tab2Rect));
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: tab2Rect.x, y: tab2Rect.y, button: 'left', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: tab2Rect.x, y: tab2Rect.y, button: 'left', clickCount: 1 });
  await delay(1200);
  const diagAfter = await evaluate(`
    (function(){
      const s = window.angular ? angular.element(document.body).scope() : null;
      return {
        activeLabel: document.querySelector('#eagle-tab-bar .eagle-tab.active .eagle-tab-label') && document.querySelector('#eagle-tab-bar .eagle-tab.active .eagle-tab-label').textContent,
        currentFolder: s && s.currentFolder ? s.currentFolder.name : null,
        viewMode: s && s.viewMode,
      };
    })()
  `);
  console.log('[real-click] AFTER tab2 click:', JSON.stringify(diagAfter));
  const clickLog = await evaluate(`(function(){ return window.__clickLog || []; })()`);
  console.log('[real-click] click log:', JSON.stringify(clickLog));
  const dbgLog = await evaluate(`(function(){ return (window.__tabBarDbg && window.__tabBarDbg.log) || []; })()`);
  console.log('[real-click] tabBarDbg:', JSON.stringify(dbgLog));
  await waitFor(() => evaluate(`
    (function(){
      const s = window.angular ? angular.element(document.body).scope() : null;
      return Boolean(s && s.currentFolder && s.currentFolder.name === '真实点击测试');
    })()
  `), 'real click on tab 2 restored folder view');
  console.log('[real-click] tab 2 REAL mouse click restored folder');

  console.log('REAL_CLICK_OK');
  page.ws.close();
} finally {
  if (page && page.ws && page.ws.readyState === WebSocket.OPEN) page.ws.close();
  await stop(electron);
  await stop(vite);
  await stop(backend);
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch (err) { /* best effort */ }
}
