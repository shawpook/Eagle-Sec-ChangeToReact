/* ==========================================================================
   Tab Bar 闭环 UI 测试 — 浏览器/Figma 风格标签栏
   验证：
   1. 标签栏注入到主界面最顶层（Eagle 原生工具栏之上），布局整体下推 34px
   2. 初始标签存在且带标签文案
   3. 点击侧栏文件夹 → 活动标签文案跟随更新
   4. + 新增标签 → 新标签导航到「全部图片」视图
   5. 点击切换 → 文件夹视图被恢复
   6. 滚动位置在切换往返后恢复
   7. 关闭标签 → 剩余标签自动激活
   8. Ctrl+T 新增标签
   9. 双击重命名标签
   10. 刷新后标签列表从 localStorage 恢复
   ========================================================================== */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronExecutable = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-tabbar-ui-'));
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
let page;

try {
  await waitFor(() => backend.output().includes(`localhost:${apiPort}`), 'backend startup');
  await waitFor(async () => (await fetch(`http://127.0.0.1:${vitePort}/src/app/index.html`)).ok, 'Vite main UI');

  /* 准备一个有内容的资源库：建库 + 生成并导入 20 张图片，让网格可滚动 */
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
  await post('/api/library/create', { name: 'Tab Bar UI', savePath: librariesRoot });
  const imagePaths = [];
  for (let i = 0; i < 20; i += 1) {
    const width = 420 + ((i * 131) % 640);
    const height = 360 + ((i * 89) % 520);
    const file = path.join(imagesRoot, `tabbar-sample-${String(i).padStart(2, '0')}.png`);
    await sharp({
      create: { width, height, channels: 4, background: { r: (i * 40) % 256, g: (i * 90) % 256, b: (i * 160) % 256, alpha: 1 } },
    }).png().toFile(file);
    imagePaths.push(file);
  }
  const imported = await post('/api/item/addFromPaths', { paths: imagePaths });
  if (!Array.isArray(imported) || imported.length !== imagePaths.length) throw new Error('image import failed');
  // 建两个文件夹，并把图片全部移入第一个文件夹（保证文件夹视图也有内容、可滚动）
  const folderOne = await post('/api/folder/create', { name: '设计参考' });
  await post('/api/folder/create', { name: '欢迎素材' });
  for (const item of imported) {
    await post('/api/item/update', { id: item.id, folders: [folderOne.id] });
  }

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
  page = await connect(target.webSocketDebuggerUrl);
  await page.send('Runtime.enable');

  async function evaluate(expression) {
    const result = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) {
      throw new Error(`evaluate failed: ${JSON.stringify(result.exceptionDetails)}`);
    }
    return result.result && result.result.value;
  }

  /* ---- 1. 标签栏注入 + 初始标签 ---- */
  await waitFor(() => evaluate(`document.querySelectorAll('#eagle-tab-bar .eagle-tab').length >= 1`), 'tab bar rendered');
  const initialLabel = await evaluate(`document.querySelector('#eagle-tab-bar .eagle-tab-label').textContent`);
  if (!initialLabel || !initialLabel.trim()) throw new Error('initial tab label is empty');
  console.log(`[tab-bar] initial label: ${initialLabel}`);

  /* ---- 2. 布局下推：Eagle 原生顶部空间下沉 34px ---- */
  const sidebarTop = await evaluate(`(function(){ const el = document.querySelector('#sidebar'); return el ? getComputedStyle(el).top : null; })()`);
  if (sidebarTop !== '34px') throw new Error(`sidebar top should be pushed to 34px, got ${sidebarTop}`);
  const tabBarTop = await evaluate(`getComputedStyle(document.querySelector('#eagle-tab-bar')).top`);
  if (tabBarTop !== '0px') throw new Error(`tab bar top should be 0px, got ${tabBarTop}`);
  console.log('[tab-bar] layout pushed down: sidebar top =', sidebarTop);

  /* ---- 3. 点击侧栏文件夹 → 活动标签文案跟随更新 ---- */
  const folderName = await evaluate(`
    (function(){
      const item = document.querySelector('.sidebar-folder-item');
      if (!item) return null;
      const name = (item.querySelector('.name') || {}).textContent.trim();
      item.click();
      return name;
    })()
  `);
  if (!folderName) throw new Error('no sidebar folder item found');
  await waitFor(() => evaluate(`
    (function(){
      const s = window.angular ? angular.element(document.body).scope() : null;
      return Boolean(s && s.currentFolder && s.currentFolder.name === ${JSON.stringify(folderName)});
    })()
  `), 'folder opened');
  await waitFor(() => evaluate(`
    document.querySelector('#eagle-tab-bar .eagle-tab.active .eagle-tab-label').textContent === ${JSON.stringify(folderName)}
  `), 'active tab label follows folder');
  console.log(`[tab-bar] folder opened: ${folderName}, tab label synced`);

  /* ---- 4. + 新增标签 → 新标签导航到「全部图片」 ---- */
  await evaluate(`document.querySelector('#eagle-tab-bar .eagle-tab-add').click(); true`);
  await waitFor(() => evaluate(`document.querySelectorAll('#eagle-tab-bar .eagle-tab').length === 2`), 'two tabs after add');
  await waitFor(() => evaluate(`
    (function(){
      const s = window.angular ? angular.element(document.body).scope() : null;
      return Boolean(s && s.viewMode === 'all' && !s.currentFolder);
    })()
  `), 'new tab at All view');
  const activeTabIndex = await evaluate(`
    Array.from(document.querySelectorAll('#eagle-tab-bar .eagle-tab')).findIndex(function(el){ return el.classList.contains('active'); })
  `);
  if (activeTabIndex !== 1) throw new Error(`new tab should be active, active index = ${activeTabIndex}`);
  console.log('[tab-bar] + added new tab at All view');

  /* ---- 5. 点击切换 → 文件夹视图恢复 ---- */
  await evaluate(`document.querySelectorAll('#eagle-tab-bar .eagle-tab')[0].click(); true`);
  await waitFor(() => evaluate(`
    (function(){
      const s = window.angular ? angular.element(document.body).scope() : null;
      return Boolean(s && s.currentFolder && s.currentFolder.name === ${JSON.stringify(folderName)});
    })()
  `), 'tab 1 folder restored');
  console.log('[tab-bar] switch back restored folder view');

  /* ---- 6. 滚动位置恢复 ---- */
  // 等待网格真实渲染出条目
  await waitFor(() => evaluate(`
    (function(){
      const list = document.querySelector('#box-container .box-list');
      return Boolean(list && list.children.length > 0);
    })()
  `), 'grid items rendered');
  // 若默认尺寸下网格不可滚动，通过工具栏放大按钮（真实用户路径：zoomIn → adjustLayoutWidth）放大
  const scrollableCheck = `
    (function(){
      const c = document.querySelector('#box-container');
      return Boolean(c && c.scrollHeight > c.clientHeight);
    })()
  `;
  for (let i = 0; i < 8 && !(await evaluate(scrollableCheck)); i += 1) {
    await evaluate(`
      (function(){
        const buttons = Array.from(document.querySelectorAll('#box-list-slider .zoom-btn'));
        const zoomIn = buttons.find(function(b){ return b.querySelector('img[src*="ic-toolbar-zoom-in"]'); });
        if (!zoomIn) return false;
        zoomIn.click();
        return true;
      })()
    `);
    await delay(250);
  }
  if (!(await evaluate(scrollableCheck))) throw new Error('grid not scrollable after zoom');
  await evaluate(`
    (function(){
      const c = document.querySelector('#box-container');
      c.scrollTop = 400;
      return c.scrollTop;
    })()
  `);
  await delay(500); // 等待采集轮询记录滚动位置
  await evaluate(`document.querySelectorAll('#eagle-tab-bar .eagle-tab')[1].click(); true`);
  await delay(700);
  await evaluate(`document.querySelectorAll('#eagle-tab-bar .eagle-tab')[0].click(); true`);
  await waitFor(() => evaluate(`
    (function(){
      const c = document.querySelector('#box-container');
      return Boolean(c && c.scrollTop >= 300);
    })()
  `), 'scroll position restored');
  console.log('[tab-bar] scroll position restored after tab round-trip');

  /* ---- 7. 关闭活动标签 → 剩余标签激活 ---- */
  await evaluate(`document.querySelector('#eagle-tab-bar .eagle-tab.active .eagle-tab-close').click(); true`);
  await waitFor(() => evaluate(`document.querySelectorAll('#eagle-tab-bar .eagle-tab').length === 1`), 'tab closed');
  await waitFor(() => evaluate(`
    (function(){
      const s = window.angular ? angular.element(document.body).scope() : null;
      return Boolean(s && s.viewMode === 'all' && !s.currentFolder);
    })()
  `), 'remaining tab (All view) active after close');
  console.log('[tab-bar] close tab ok, remaining tab activated');

  /* ---- 8. Ctrl+T 新增标签 ---- */
  await evaluate(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 't', ctrlKey: true, bubbles: true, cancelable: true })); true`);
  await waitFor(() => evaluate(`document.querySelectorAll('#eagle-tab-bar .eagle-tab').length === 2`), 'ctrl+t adds tab');
  console.log('[tab-bar] ctrl+t adds tab');

  /* ---- 9. 双击重命名 ---- */
  await evaluate(`
    (function(){
      const label = document.querySelector('#eagle-tab-bar .eagle-tab.active .eagle-tab-label');
      label.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      return true;
    })()
  `);
  await waitFor(() => evaluate(`Boolean(document.querySelector('#eagle-tab-bar .eagle-tab-rename'))`), 'rename input shown');
  await evaluate(`
    (function(){
      const input = document.querySelector('#eagle-tab-bar .eagle-tab-rename');
      input.value = '我的标签';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      return true;
    })()
  `);
  await waitFor(() => evaluate(`
    document.querySelector('#eagle-tab-bar .eagle-tab.active .eagle-tab-label').textContent === '我的标签'
  `), 'tab renamed');
  console.log('[tab-bar] rename ok');

  /* ---- 10. 刷新后标签列表恢复 ---- */
  await page.send('Page.enable');
  await page.send('Page.reload');
  await waitFor(() => evaluate(`document.querySelectorAll('#eagle-tab-bar .eagle-tab').length === 2`), 'tabs restored after reload');
  const renamedRestored = await evaluate(`
    (function(){
      return Array.from(document.querySelectorAll('#eagle-tab-bar .eagle-tab-label'))
        .some(function(label){ return label.textContent === '我的标签'; });
    })()
  `);
  if (!renamedRestored) throw new Error('renamed tab not restored after reload');
  console.log('[tab-bar] tabs persisted across reload');

  page.ws.close();
  console.log('TAB_BAR_UI_OK');
} finally {
  if (page && page.ws && page.ws.readyState === WebSocket.OPEN) page.ws.close();
  await stop(electron);
  await stop(vite);
  await stop(backend);
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch (err) { /* best effort */ }
}
