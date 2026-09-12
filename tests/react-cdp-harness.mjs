/**
 * React 化改造闭环测试助手 —— 复刻 source-mode-ui-closed-loop.mjs 的 CDP 连接范式。
 * 用法：生成一个自包含测试文件 import 它，或直接 `node` 运行为独立断言脚本。
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function freePort() {
  while (true) {
    const port = await new Promise((resolve, reject) => {
      const server = http.createServer();
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        server.close(() => resolve(address.port));
      });
    });
    if (port >= 12000 && port < 50000) return port;
  }
}

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitFor(check, label, timeout = 30000) {
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

export function spawnLogged(command, args, env) {
  const child = spawn(command, args, { cwd: projectRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  return { child, output: () => output };
}

async function stopChild(child) {
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
      try { process.kill(child.pid, 'SIGKILL'); } catch (err) {}
    }
    await delay(200);
  }
  // 释放 stdio 管道句柄（pipe 流在子进程被杀后仍可能挂着，导致测试进程不退出）
  try { child.stdout && child.stdout.destroy(); } catch (err) {}
  try { child.stderr && child.stderr.destroy(); } catch (err) {}
}

export async function stop(processInfo) {
  if (!processInfo) return;
  // bootStack 返回的栈对象：依次关闭 CDP websocket 与 electron/vite/backend
  if (processInfo.electron) {
    try { processInfo.page && processInfo.page.ws && processInfo.page.ws.close(); } catch (err) {}
    await stopChild(processInfo.electron);
    await stopChild(processInfo.vite);
    await stopChild(processInfo.backend);
    return;
  }
  await stopChild(processInfo.child || processInfo);
}

export async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const events = []; // CDP 事件缓冲（exceptionThrown/consoleAPICalled 等），滚动上限防泄漏
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) {
      events.push(message);
      if (events.length > 1000) events.splice(0, events.length - 1000);
      return;
    }
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
    events,
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const messageId = ++id;
        pending.set(messageId, { resolve, reject });
        ws.send(JSON.stringify({ id: messageId, method, params }));
      });
    },
  };
}

/**
 * 拉起完整 dev 栈 + Electron regression-host，返回页面对接对象。
 * params: { librariesRoot, stateFile, userDataDir }
 */
export async function bootStack({
  sourceFolderFixture,
  librariesRoot,
  stateFile,
  userDataDir,
  beforeElectron,
} = {}) {
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
    EAGLE_USER_DATA_DIR: userDataDir,
  };
  if (sourceFolderFixture) backendEnv.EAGLE_SOURCE_FOLDER_FIXTURE = sourceFolderFixture;
  const viteEnv = {
    ...baseEnv,
    EAGLE_API_URL: `http://localhost:${apiPort}`,
    EAGLE_THUMBNAIL_URL: `http://localhost:${thumbnailPort}`,
    EAGLE_EXTENSION_URL: `http://localhost:${extensionPort}`,
  };

  const backend = spawnLogged(process.execPath, ['backend/src/server.js'], backendEnv);
  const vite = spawnLogged(process.execPath, [
    'node_modules/vite/bin/vite.js', '--config', 'frontend/vite.preview.config.mjs',
    '--port', String(vitePort), '--strictPort',
  ], viteEnv);
  const electronExecutable = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');

  try {
    await waitFor(() => backend.output().includes(`localhost:${apiPort}`), 'backend startup');
    await waitFor(async () => (await fetch(`http://127.0.0.1:${vitePort}/src/app/index.html`)).ok, 'Vite main UI');
    if (beforeElectron) await beforeElectron(apiPort, thumbnailPort, extensionPort, vitePort);
    const electron = spawnLogged(electronExecutable, ['electron/main.cjs', '--regression-host'], {
      ...backendEnv,
      EAGLE_API_URL: `http://localhost:${apiPort}`,
      EAGLE_THUMBNAIL_URL: `http://localhost:${thumbnailPort}`,
      EAGLE_PREVIEW_URL: `http://127.0.0.1:${vitePort}/src/app/index.html`,
      EAGLE_DEBUG_PORT: String(debugPort),
      EAGLE_ELECTRON_USER_DATA_DIR: userDataDir,
    });
    await waitFor(async () => (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).ok, 'Electron CDP');
    await waitFor(() => electron.output().includes('REGRESSION_HOST_READY'), 'Electron host');
    // 连接竞态防护：窗口加载期 page target 可能被导航销毁——ws.onopen 永不触发。
    // 连接 6s 超时 + 重新拉取 target 重试（上限 15 次），探针/闭环测试均走此路径。
    let page = null;
    for (let attempt = 0; attempt < 15 && !page; attempt++) {
      const targetsNow = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      const target = targetsNow.find((entry) => entry.type === 'page' && entry.url.includes(String(vitePort)));
      if (!target) { await delay(500); continue; }
      try {
        page = await Promise.race([
          connect(target.webSocketDebuggerUrl),
          new Promise((resolve, reject) => setTimeout(() => reject(new Error('cdp connect timeout')), 6000)),
        ]);
      } catch (err) {
        page = null;
        await delay(500);
      }
    }
    if (!page) throw new Error('CDP page connect failed after retries');
    await page.send('Runtime.enable');
    await page.send('Page.enable');
    // b1-9bz-E5-3/E5-4：测试观测口 `window.__eagleProbe`（name→值 的 scope 外观，**仅测试期**）。
    // 应用自 E5-4 起不再暴露主窗 `window.$bodyScope`；本探针经 `__eagleScopeRegistry`（app 侧
    // 诊断口，注册表 + 面属性两级）读写，并补齐测试惯用的 `$evalAsync` no-op 钩子。
    // **必须按文档注入**（addScriptToEvaluateOnNewDocument）：启动期窗口会导航，页内一次性
    // 注入会被新文档清掉。注入的是**惰性访问器**——registry 由 main.tsx 稍后创建，读取时才构建。
    const probeSource = `(() => {
      try {
        if (window.__eagleProbeHooked) return true;
        window.__eagleProbeHooked = true;
        let cached = null;
        let built = false;
        const build = () => {
          if (built) return cached;
          const reg = window.__eagleScopeRegistry;
          if (!reg) return null;
          const noop = () => undefined;
          let probe = null;
          probe = new Proxy({}, {
            get: (_t, k) => {
              if (typeof k !== 'string') return undefined;
              if (k === '$evalAsync' || k === '$eval' || k === '$destroy') return noop;
              if (k === '$root' || k === '$parent') return probe;
              if (k === '__eagleShim') return true;
              return reg.read(k);
            },
            set: (_t, k, v) => { if (typeof k === 'string') reg.write(k, v); return true; },
            deleteProperty: (_t, k) => { if (typeof k === 'string') reg.write(k, undefined); return true; },
            has: (_t, k) => typeof k === 'string' && (reg.names().includes(k) || reg.read(k) !== undefined),
          });
          cached = probe;
          built = true;
          return probe;
        };
        Object.defineProperty(window, '$bodyScope', {
          configurable: true,
          get() { return cached || build() || undefined; },
          set(v) { cached = v; built = true; },
        });
        Object.defineProperty(window, '__eagleProbe', {
          configurable: true,
          get() { return cached || build() || undefined; },
        });
        return true;
      } catch (err) { window.__eagleProbeHooked = 'err:' + (err && err.message); return false; }
    })()`;
    try {
      await page.send('Page.addScriptToEvaluateOnNewDocument', { source: probeSource });
    } catch (err) { /* 老版本协议不支持时退化为当前文档注入 */ }
    await page.send('Runtime.evaluate', { expression: probeSource, returnByValue: true });
    return { apiPort, thumbnailPort, extensionPort, vitePort, debugPort, backend, vite, electron, page, targets: [] };
  } catch (err) {
    await stop(backend);
    await stop(vite);
    throw err;
  }
}

/** 统一的断言函数：写截图到 cwd/test-run/ 并返回布尔。 */
export async function assertDom(page, name, expression, { waitMs = 0, screenshot = true, invert = false } = {}) {
  if (waitMs) await delay(waitMs);
  const evalResult = await page.send('Runtime.evaluate', {
    expression: `Boolean((${expression})())`,
    returnByValue: true,
  });
  const ok = evalResult.result.value === true;
  const pass = invert ? !ok : ok;
  if (screenshot) {
    try {
      const shot = await page.send('Page.captureScreenshot', { format: 'png' });
      const dir = path.join(projectRoot, 'test-run');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${name}.png`), Buffer.from(shot.data, 'base64'));
    } catch (err) {}
  }
  return pass;
}
