/**
 * 附着式（attached）非套件测试 runner：为 `screenshot-regression` 与
 * `workbench-interactions` 拉起**隔离**栈 —— 自有端口的 backend + vite + 本机 Chrome 无头。
 *
 * 为何必须隔离：这两个测试用浏览器级 CDP 的 `Target.createTarget/closeTarget`（Electron CDP 不支持），
 * 且会关闭**所有** page target，绝不能对着用户正在跑的 dev 实例执行。故本 runner 自建栈、
 * 经 `EAGLE_DEBUG_PORT` / `EAGLE_PREVIEW_URL` 注入后逐个执行，最后收栈。
 *
 * 不列入 `roadmap-panels.mjs`：该测试在本宿主崩于 `fs.cpSync(recursive)`（PROGRESS 第 41 行登记的
 * 宿主缺陷，`test:isolated` 需入树临时补丁才绿且该补丁规定不入库）。
 *
 * 用法：node tests/run-attached-nonsuite.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const nodeBin = fs.existsSync(process.execPath) ? process.execPath : 'node';

async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const p = srv.address().port;
      srv.close(() => resolve(p));
    });
  });
}

async function waitFor(check, label, timeout = 60000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { const v = await check(); if (v) return v; } catch (err) { /* retry */ }
    await delay(200);
  }
  throw new Error(`${label} timeout`);
}

const children = [];
function launch(cmd, args, env) {
  const child = spawn(cmd, args, { cwd: projectRoot, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (c) => { out += c.toString(); });
  child.stderr.on('data', (c) => { out += c.toString(); });
  child.output = () => out;
  children.push(child);
  return child;
}

async function teardown() {
  for (const c of children) {
    try { if (c.exitCode === null) c.kill(); } catch (err) { /* noop */ }
  }
  await delay(500);
  if (process.platform === 'win32') {
    for (const c of children) {
      if (c.exitCode === null) {
        try { spawn('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (err) { /* noop */ }
      }
    }
  }
  await delay(300);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-attached-'));
const [apiPort, thumbnailPort, extensionPort, vitePort, debugPort] = await Promise.all(
  Array.from({ length: 5 }, () => freePort()),
);

let failed = false;
try {
  const backend = launch(nodeBin, ['backend/src/server.js'], {
    EAGLE_API_PORT: String(apiPort),
    EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
    EAGLE_EXTENSION_PORT: String(extensionPort),
    EAGLE_LIBRARY_STATE_FILE: path.join(tmp, 'state.json'),
    EAGLE_USER_DATA_DIR: path.join(tmp, 'ud'),
  });
  launch(nodeBin, ['node_modules/vite/bin/vite.js', '--config', 'frontend/vite.preview.config.mjs',
    '--port', String(vitePort), '--strictPort'], {
    EAGLE_API_URL: `http://localhost:${apiPort}`,
    EAGLE_THUMBNAIL_URL: `http://localhost:${thumbnailPort}`,
    EAGLE_EXTENSION_URL: `http://localhost:${extensionPort}`,
  });
  await waitFor(() => backend.output().includes(`localhost:${apiPort}`), 'backend');
  await waitFor(async () => (await fetch(`http://127.0.0.1:${vitePort}/src/app/index.html`)).ok, 'vite');

  const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p));
  if (!chrome) throw new Error('chrome.exe not found');
  launch(chrome, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${path.join(tmp, 'chrome-profile')}`, '--no-first-run',
    '--window-size=1600,1000', 'about:blank'], {});
  await waitFor(async () => (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok, 'chrome cdp');

  console.log(`ATTACHED_STACK api=${apiPort} vite=${vitePort} cdp=${debugPort}`);
  for (const t of ['tests/screenshot-regression.mjs', 'tests/workbench-interactions.mjs']) {
    const r = await new Promise((resolve) => {
      const c = spawn(nodeBin, [t], {
        cwd: projectRoot,
        env: { ...process.env, EAGLE_DEBUG_PORT: String(debugPort), EAGLE_PREVIEW_URL: `http://127.0.0.1:${vitePort}`, EAGLE_API_URL: `http://127.0.0.1:${apiPort}` },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let out = '';
      c.stdout.on('data', (d) => { out += d.toString(); });
      c.stderr.on('data', (d) => { out += d.toString(); });
      c.on('exit', (code) => resolve({ code, out }));
    });
    const lines = r.out.split('\n').filter(Boolean);
    console.log(`[${path.basename(t)}] exit=${r.code}`);
    console.log(lines.slice(-4).join('\n'));
    if (r.code !== 0) { failed = true; console.log('--- full ---\n' + r.out); }
  }
} catch (err) {
  failed = true;
  console.log('ATTACHED_STACK_ERROR ' + (err && err.message));
} finally {
  await teardown();
}
console.log(failed ? 'ATTACHED_NONSUITE FAILED' : 'ATTACHED_NONSUITE OK');
process.exit(failed ? 1 : 0);
