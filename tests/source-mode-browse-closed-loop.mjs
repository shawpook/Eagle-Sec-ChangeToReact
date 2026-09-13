/**
 * P3-b 收口验收：来源文件夹模式的真实点击 UI 闭环（Electron 实机页面 + 真实后端）。
 *
 * 场景：3 个来源根（A 含嵌套 subA/deep、B 含 subB、C 单文件）+ 资源库 2 个条目。
 * 覆盖（用户决策 P3-b）：
 *  - 点击来源根 → 网格显示该根全部已索引素材（**含子目录**，getVirtualLibrary 混排时真正过滤）；
 *  - 点击子目录 → 该目录及其子目录素材；清除跨目录选区；展开箭头只动树不动网格；
 *  - 重扫：保留已有内容 + 状态防重复触发；新增文件 +1、删除 -1、当前目录保留；
 *    当前目录消失 → 回到来源根；来源目录整体删除 → 失败提示 + 保留上次成功数据；
 *  - 移除：非当前保持视图；当前 → 按侧栏顺序选第一个剩余来源；最后一个 → 空状态；
 *  - 退出来源模式 → 恢复资源库视图（网格回库内条目、keyword 复原）；
 *  - 目录导航 (sourceRootId, relativePath) 经 React/store 网格更新。
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronExecutable = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-source-browse-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const sourceA = path.join(tempRoot, 'source-a');
const sourceB = path.join(tempRoot, 'source-b');
const sourceC = path.join(tempRoot, 'source-c');
const stateFile = path.join(tempRoot, 'library-state.json');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(path.join(sourceA, 'subA', 'deep'), { recursive: true });
fs.mkdirSync(path.join(sourceB, 'subB'), { recursive: true });
fs.mkdirSync(sourceC, { recursive: true });

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
    } catch (err) { lastError = err; }
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
      try { process.kill(child.pid, 'SIGKILL'); } catch (err) { /* already exited */ }
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

let failure = null;
let backend = null;
let vite = null;
let electron = null;
let page = null;
try {
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
    // 测试旋钮：仅 source-b 的重扫强制失败（验证失败提示 + 保留上次成功数据）
    EAGLE_SOURCE_RESCAN_FAIL: 'source-b',
  };
  const viteEnv = {
    ...baseEnv,
    EAGLE_API_URL: `http://localhost:${apiPort}`,
    EAGLE_THUMBNAIL_URL: `http://localhost:${thumbnailPort}`,
    EAGLE_EXTENSION_URL: `http://localhost:${extensionPort}`,
  };

  backend = spawnLogged(process.execPath, ['backend/src/server.js'], backendEnv);
  vite = spawnLogged(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'frontend/vite.preview.config.mjs', '--port', String(vitePort), '--strictPort'], viteEnv);
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

  const png = (color) => sharp({ create: { width: 16, height: 10, channels: 4, background: color } }).png().toBuffer();
  // 来源素材（A 含嵌套）
  fs.writeFileSync(path.join(sourceA, 'a1.png'), await png('#38bdf8'));
  fs.writeFileSync(path.join(sourceA, 'subA', 'b1.png'), await png('#f87171'));
  fs.writeFileSync(path.join(sourceA, 'subA', 'deep', 'c1.png'), await png('#34d399'));
  fs.writeFileSync(path.join(sourceB, 'x1.png'), await png('#a78bfa'));
  fs.writeFileSync(path.join(sourceB, 'subB', 'y1.png'), await png('#fbbf24'));
  fs.writeFileSync(path.join(sourceC, 'z1.png'), await png('#22d3ee'));
  // 资源库条目（退出后应还原回网格）
  const libPng = await png('#94a3b8');
  fs.writeFileSync(path.join(tempRoot, 'lib1.png'), libPng);
  fs.writeFileSync(path.join(tempRoot, 'lib2.png'), libPng);

  await post('/api/library/create', { name: 'Source Browse', savePath: librariesRoot });
  const libImport = await post('/api/item/addFromPaths', {
    images: [{ path: path.join(tempRoot, 'lib1.png'), name: 'lib-1' }, { path: path.join(tempRoot, 'lib2.png'), name: 'lib-2' }],
  });
  if (!Array.isArray(libImport) || libImport.length !== 2) throw new Error('library import failed: ' + JSON.stringify(libImport));

  // 预建 3 个来源根并等待索引
  await post('/api/source-roots/addPath', { path: sourceA });
  await post('/api/source-roots/addPath', { path: sourceB });
  await post('/api/source-roots/addPath', { path: sourceC });
  await waitFor(async () => {
    const roots = await get('/api/source-roots');
    const has = (name) => roots.some((r) => r.name === name || (r.path && r.path.endsWith(name)));
    const byName = (name) => roots.find((r) => r.name === name || (r.path && r.path.endsWith(name)));
    const a = byName('source-a'); const b = byName('source-b'); const c = byName('source-c');
    return a && b && c && a.assetCount === 3 && b.assetCount === 2 && c.assetCount === 1 ? { a, b, c } : null;
  }, 'sources indexed');

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

  const ev = async (expression) => {
    const result = await page.send('Runtime.evaluate', { expression, returnByValue: true });
    if (result.exceptionDetails) throw new Error('page eval error: ' + JSON.stringify(result.exceptionDetails));
    return result.result && result.result.value;
  };
  const gridCount = () => ev(`document.querySelectorAll('#box-container .box').length`);
  const gridText = () => ev(`document.body.innerText`);
  const clickBy = async (jsExpr) => {
    const ok = await ev(`(() => { const el = ${jsExpr}; if (!el) return false; el.click(); return true; })()`);
    if (!ok) throw new Error('click target missing: ' + jsExpr);
  };
  const assert = (cond, label) => { if (!cond) throw new Error('ASSERT FAIL: ' + label); };

  // ── 0. 基线：资源库网格 ──
  await waitFor(async () => (await gridCount()) >= 2, 'library grid');
  assert((await gridText()).includes('lib-1'), 'library grid shows lib-1');

  // 进入来源模式前设一个 keyword（退出后应复原）
  await ev(`(() => { window.__eagleListState.setState({ keyword: 'lib-2' }); return true; })()`);

  // ── 1. 打开来源模式 → 默认第一个根 A，网格显示 A 全部（含子目录嵌套）──
  await clickBy(`Array.from(document.querySelectorAll('.sidebar-toolbar .icon-btn')).find((e) => e.querySelector('img[src*="ic_switch.svg"]'))`);
  await waitFor(async () => ev(`Boolean(document.querySelector('#eagle-source-mode-sidebar'))`), 'source-mode sidebar open');
  await waitFor(async () => {
    const n = await gridCount();
    const text = await gridText();
    return n === 3 && text.includes('a1') && text.includes('b1') && text.includes('c1');
  }, 'root A grid shows all nested assets');

  // ── 2. 点击子目录 subA → 该目录+子目录（b1,c1），无 a1 ──
  await clickBy(`document.querySelector('#eagle-source-mode-sidebar .source-directory-row[data-source-relative-path="subA"]')`);
  await waitFor(async () => {
    const n = await gridCount();
    const text = await gridText();
    return n === 2 && text.includes('b1') && text.includes('c1') && !text.includes('a1');
  }, 'subA grid');

  // 选一个 box 后切 deep → 跨目录选区清除
  await ev(`(() => { const b = document.querySelector('#box-container .box'); if (b) b.click(); return true; })()`);
  await clickBy(`document.querySelector('#eagle-source-mode-sidebar .source-directory-row[data-source-relative-path="subA/deep"]')`);
  await waitFor(async () => (await gridCount()) === 1, 'deep grid');
  await delay(300);
  assert((await ev(`document.querySelectorAll('#box-container .box.selected').length`)) === 0, 'cross-dir selection cleared');

  // ── 3. 展开箭头只动树不动网格 ──
  const gridBeforeToggle = await gridCount();
  await clickBy(`document.querySelector('#eagle-source-mode-sidebar .source-root-header[data-source-root]')`);
  await delay(200);
  assert((await ev(`document.querySelectorAll('#eagle-source-mode-sidebar .source-directory-row').length`)) === 0, 'tree collapsed');
  assert((await gridCount()) === gridBeforeToggle, 'grid unchanged by expand toggle');
  await clickBy(`document.querySelector('#eagle-source-mode-sidebar .source-root-header[data-source-root]')`);
  await delay(200);

  // ── 4. 点击「全部素材」回根 → 3 ──
  await clickBy(`Array.from(document.querySelectorAll('#eagle-source-mode-sidebar .source-directory-row')).find((e) => e.getAttribute('data-source-relative-path') === '.')`);
  await waitFor(async () => (await gridCount()) === 3, 'root A all assets again');

  // ── 5. 重扫：新增文件 +1、删除 -1、当前目录保留；目录消失回根；失败提示 ──
  await clickBy(`document.querySelector('#eagle-source-mode-sidebar .source-mode-tab[data-source-view="manage"]')`);
  fs.writeFileSync(path.join(sourceA, 'subA', 'new1.png'), await png('#e879f9'));
  await clickBy(`document.querySelector('#eagle-source-mode-sidebar [data-source-rescan]')`);
  await waitFor(async () => (await gridText()).includes('new1'), 'rescan added file indexed');
  await waitFor(async () => (await gridCount()) === 4, 'grid keeps content and grows to 4');
  assert((await gridText()).includes('new1'), 'new file visible in grid');

  fs.unlinkSync(path.join(sourceA, 'subA', 'new1.png'));
  await clickBy(`document.querySelector('#eagle-source-mode-sidebar [data-source-rescan]')`);
  await waitFor(async () => !(await gridText()).includes('new1'), 'rescan removed file indexed');
  await waitFor(async () => (await gridCount()) === 3, 'grid back to 3');

  // 当前目录消失 → 回来源根：删除整个 subA 后重扫 A
  fs.rmSync(path.join(sourceA, 'subA'), { recursive: true, force: true });
  await clickBy(`document.querySelector('#eagle-source-mode-sidebar [data-source-rescan]')`);
  await waitFor(async () => (await gridCount()) === 1, 'rescan after dir removed');
  // 回到目录页签后再断言「回来源根」
  await clickBy(`document.querySelector('#eagle-source-mode-sidebar .source-mode-tab[data-source-view="tree"]')`);
  await waitFor(async () => {
    const sel = await ev(`(() => {
      const rows = Array.from(document.querySelectorAll('#eagle-source-mode-sidebar .source-directory-row'));
      const selected = rows.find((r) => r.classList.contains('selected'));
      return selected ? selected.getAttribute('data-source-relative-path') : null;
    })()`);
    const n = await gridCount();
    return sel === '.' && n === 1;
  }, 'current dir gone → back to root with 1 asset');

  // 失败提示：删除整个 B 根后重扫 → 错误横幅 + 网格与计数保留（按钮在管理页签）
  fs.rmSync(sourceB, { recursive: true, force: true });
  await clickBy(`document.querySelector('#eagle-source-mode-sidebar .source-mode-tab[data-source-view="manage"]')`);
  // 直接按 B 的 id 点击：先从 API 拿 id
  const rootsNow = await get('/api/source-roots');
  const rootBId = rootsNow.find((r) => r.path && r.path.endsWith('source-b')) && rootsNow.find((r) => r.path && r.path.endsWith('source-b')).id;
  const rootAId = rootsNow.find((r) => r.path && r.path.endsWith('source-a')).id;
  await ev(`(() => { const el = document.querySelector('#eagle-source-mode-sidebar [data-source-rescan="${rootBId}"]'); if (el) el.click(); return true; })()`);
  await waitFor(async () => ev(`Boolean(document.querySelector('#eagle-source-mode-sidebar .source-mode-error'))`), 'rescan failure hint');
  const gridAfterFail = await gridCount();
  assert(gridAfterFail === 1, 'grid keeps last good data after failure: ' + gridAfterFail);

  // ── 6. 移除：非当前保持视图；当前 → 第一个剩余；最后一个 → 空状态 ──
  // B 为非当前（当前 A）→ 移除后视图不变
  await ev(`(() => { const el = document.querySelector('#eagle-source-mode-sidebar [data-source-remove="${rootBId}"]'); if (el) el.click(); return true; })()`);
  await waitFor(async () => {
    const roots = await get('/api/source-roots');
    return !roots.some((r) => r.id === rootBId);
  }, 'root B removed from backend');
  await delay(400);
  assert((await gridCount()) === 1, 'non-current removal keeps current view');

  // A 为当前 → 移除后选中第一个剩余（C）
  await ev(`(() => { const el = document.querySelector('#eagle-source-mode-sidebar [data-source-remove="${rootAId}"]'); if (el) el.click(); return true; })()`);
  await waitFor(async () => {
    const roots = await get('/api/source-roots');
    return !roots.some((r) => r.id === rootAId);
  }, 'root A removed from backend');
  await waitFor(async () => {
    const n = await gridCount();
    const text = await gridText();
    return n === 1 && text.includes('z1');
  }, 'current removal selects first remaining root (C)');
  const rootsAfter = await get('/api/source-roots');
  const rootCId = rootsAfter[0].id;
  // 最后一个来源 → 空状态
  await ev(`(() => { const el = document.querySelector('#eagle-source-mode-sidebar [data-source-remove="${rootCId}"]'); if (el) el.click(); return true; })()`);
  await waitFor(async () => {
    const empty = await ev(`Boolean(document.querySelector('#eagle-source-mode-sidebar .source-mode-empty'))`);
    const n = await gridCount();
    return empty && n === 0;
  }, 'last source removed → empty state');

  // ── 7. 退出来源模式 → 资源库视图还原（网格回库条目、keyword 复原）──
  await clickBy(`Array.from(document.querySelectorAll('#eagle-source-mode-sidebar button')).find((e) => e.textContent.includes('返回资源库'))`);
  await waitFor(async () => !(await ev(`Boolean(document.querySelector('#eagle-source-mode-sidebar'))`)), 'source mode closed');
  await waitFor(async () => {
    const n = await gridCount();
    const text = await gridText();
    return n >= 2 && text.includes('lib-1') && !text.includes('z1');
  }, 'library view restored');
  // keyword 复原为异步快照重放（种子落定后 450/1200ms 双次）——waitFor 到复原完成
  await waitFor(async () => (await ev(`window.__eagleListState.getState().keyword`)) === 'lib-2', 'keyword restored after exit', 4000);

  console.log('SOURCE_MODE_BROWSE_CLOSED_LOOP_OK');
} catch (err) {
  failure = err;
} finally {
  await stop(electron);
  await stop(vite);
  await stop(backend);
  if (page && page.ws) { try { page.ws.close(); } catch (e) { /* ignore */ } }
  if (failure) {
    console.error(failure.message || String(failure));
  }
}
if (failure) { console.log('SOURCE_MODE_BROWSE_CLOSED_LOOP FAIL'); process.exit(1); }