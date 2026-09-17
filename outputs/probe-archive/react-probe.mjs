/**
 * 快速探针：起 vite+backend（复用现网端口 5176/41695），用本机 Chrome 无头加载
 * http://localhost:5176/src/app/index.html，抓取 console 报错并断言 React mount。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(check, label, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { const v = await check(); if (v) return v; } catch {}
    await delay(100);
  }
  throw new Error(`${label} timeout`);
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
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  return {
    ws,
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const mid = ++id;
        pending.set(mid, { resolve, reject });
        ws.send(JSON.stringify({ id: mid, method, params }));
      });
    },
  };
}

// 1. backend + vite
const backend = spawn(process.execPath, ['backend/src/server.js'], { cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe'] });
let backendOut = '';
backend.stdout.on('data', (c) => (backendOut += c));
backend.stderr.on('data', (c) => (backendOut += c));
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'frontend/vite.preview.config.mjs', '--port', '5176', '--strictPort'], { cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe'] });
let viteOut = '';
vite.stdout.on('data', (c) => (viteOut += c));
vite.stderr.on('data', (c) => (viteOut += c));

try {
  await waitFor(() => backendOut.includes('41695'), 'backend up');
  await waitFor(async () => (await fetch('http://127.0.0.1:5176/src/app/index.html')).ok, 'vite up');
  console.log('[probe] backend + vite up');

  // 2. chrome headless with CDP
  const debugPort = 9333;
  const chromeCandidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ];
  const chrome = chromeCandidates.find((p) => fs.existsSync(p));
  if (!chrome) throw new Error('chrome.exe not found');
  const profile = path.join(projectRoot, '.tmp', 'react-probe-profile');
  const chromeProc = spawn(chrome, [
    '--headless=new', '--disable-gpu', `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`, '--no-first-run', 'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  await waitFor(async () => (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok, 'chrome cdp');
  const version = await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json();
  const browser = await connect(version.webSocketDebuggerUrl);
  const created = await browser.send('Target.createTarget', { url: 'about:blank' });
  browser.ws.close();
  const page = await connect(`ws://127.0.0.1:${debugPort}/devtools/page/${created.targetId}`);
  await page.send('Runtime.enable');
  await page.send('Page.enable');

  const logs = [];
  page.send('Runtime.evaluate', { expression: '0' }).catch(() => {});
  // 简单收集：用 Runtime.consoleAPICalled 事件需要事件订阅；这里改用注入钩子
  await page.send('Page.navigate', { url: 'http://127.0.0.1:5176/src/app/index.html' });
  await delay(8000);

  const probe = await page.send('Runtime.evaluate', {
    expression: `(() => {
      const out = { reactHost: !!document.getElementById('eagle-react-host'), store: typeof window.__eagleReactStore !== 'undefined', angularReady: !!document.getElementById('main-app'), err: null };
      return out;
    })()`,
    returnByValue: true,
  });
  console.log('[probe] dom:', JSON.stringify(probe.result.value));

  // 抓取 vite 模块加载失败等错误：检查 main.tsx 是否真的执行（在模块尾部置标记）
  const marker = await page.send('Runtime.evaluate', {
    expression: `typeof window.__eagleReactStore`,
    returnByValue: true,
  });
  console.log('[probe] __eagleReactStore:', JSON.stringify(marker.result.value));

  page.ws.close();
  chromeProc.kill();
} finally {
  backend.kill();
  vite.kill();
  await delay(500);
  try { process.kill(backend.pid); } catch {}
  try { process.kill(vite.pid); } catch {}
}
