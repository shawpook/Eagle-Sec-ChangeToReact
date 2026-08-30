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
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    const target = targets.find((entry) => entry.type === 'page' && entry.url.includes(String(vitePort)));
    if (!target) throw new Error(`Main page target not found: ${JSON.stringify(targets)}`);
    const page = await connect(target.webSocketDebuggerUrl);
    await page.send('Runtime.enable');
    await page.send('Page.enable');
    return { apiPort, thumbnailPort, extensionPort, vitePort, debugPort, backend, vite, electron, page, targets };
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
