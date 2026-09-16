/**
 * R1：生产态一键启动——本地静态服务（dist/frontend）+ 后端 + Electron。
 * 与开发态的差别：不启动 Vite，Electron 的 EAGLE_PREVIEW_URL 指向 dist 静态服务。
 *
 * 环境变量可覆盖：EAGLE_FRONTEND_PORT(4173)、EAGLE_API_PORT、EAGLE_THUMBNAIL_PORT、EAGLE_EXTENSION_PORT。
 * M5-2（F22）：Electron 只在静态服务与后端三个监听口均通过 HTTP 就绪探测后启动。
 * 用法：npm run start:prod（先 npm run build）
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(projectRoot, 'dist', 'frontend');
if (!fs.existsSync(path.join(distRoot, 'src', 'app', 'index.html'))) {
  console.error(`FAIL 产物缺失：${distRoot}（先运行 npm run build）`);
  process.exit(1);
}

const frontendPort = process.env.EAGLE_FRONTEND_PORT || '4173';
const apiPort = process.env.EAGLE_API_PORT || '41695';
const thumbnailPort = process.env.EAGLE_THUMBNAIL_PORT || '41692';
const extensionPort = process.env.EAGLE_EXTENSION_PORT || '41693';
const electronExecutable = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const readinessTimeoutMs = (() => {
  const configured = Number(process.env.EAGLE_START_READY_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 30000;
})();

const env = {
  ...process.env,
  EAGLE_FRONTEND_PORT: frontendPort,
  EAGLE_FRONTEND_ROOT: distRoot,
  EAGLE_THUMBNAIL_URL: `http://localhost:${thumbnailPort}`,
  EAGLE_API_PORT: apiPort,
  EAGLE_THUMBNAIL_PORT: thumbnailPort,
  EAGLE_EXTENSION_PORT: extensionPort,
};

const children = [];
let shuttingDown = false;
let earlyExit = null;

function run(command, args, childEnv, label) {
  const child = spawn(command, args, { cwd: projectRoot, env: childEnv, stdio: 'inherit' });
  child.on('error', (err) => {
    earlyExit ||= new Error(`${label} 无法启动：${err.message}`);
    if (!shuttingDown) console.error(`[start:prod] ${label} 无法启动：${err.message}`);
  });
  child.on('exit', (code, signal) => {
    if (!shuttingDown && code) console.error(`[start:prod] ${label} exited ${code}${signal ? ` (${signal})` : ''}`);
    if (!shuttingDown && code !== 0) {
      earlyExit ||= new Error(`${label} 提前退出（code=${code ?? 'null'}${signal ? `, signal=${signal}` : ''}）`);
    }
  });
  children.push(child);
  return child;
}

function stopChildren() {
  shuttingDown = true;
  for (const child of children) {
    try { child.kill(); } catch {}
  }
}

async function waitForHttp(label, url, validate) {
  const deadline = Date.now() + readinessTimeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    if (earlyExit) throw earlyExit;
    const remaining = deadline - Date.now();
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(Math.min(1000, Math.max(100, remaining))),
      });
      const detail = await validate(response);
      if (detail) {
        console.log(`[start:prod] ${label} ready -> ${url}`);
        return;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  const suffix = lastError ? `（最后错误：${lastError.message}）` : '';
  throw new Error(`${label} 在 ${readinessTimeoutMs}ms 内未就绪：${url}${suffix}`);
}

async function waitForProductionServices() {
  await waitForHttp('frontend', `http://127.0.0.1:${frontendPort}/src/app/index.html`, (response) => response.ok);
  await waitForHttp('runtime-config', `http://127.0.0.1:${frontendPort}/eagle-runtime-config.js`, async (response) => {
    if (!response.ok) return false;
    const body = await response.text();
    return body.includes(`window.__EAGLE_API_BASE_URL=${JSON.stringify(`http://localhost:${apiPort}`)}`)
      && body.includes(`window.__EAGLE_THUMBNAIL_URL=${JSON.stringify(`http://localhost:${thumbnailPort}`)}`)
      && body.includes(`window.__EAGLE_EXTENSION_BASE_URL=${JSON.stringify(`http://localhost:${extensionPort}`)}`);
  });
  await waitForHttp('backend-api', `http://127.0.0.1:${apiPort}/api/application/info`, async (response) => {
    if (!response.ok) return false;
    const body = await response.json();
    return body && body.status === 'success';
  });
  await waitForHttp('thumbnail-service', `http://127.0.0.1:${thumbnailPort}/file/__production_ready__`, (response) => response.status === 404 || response.ok);
  await waitForHttp('extension-service', `http://127.0.0.1:${extensionPort}/api/version`, async (response) => {
    if (!response.ok) return false;
    const body = await response.json();
    return body && body.status === 'success';
  });
}

async function main() {
  try {
    run(process.execPath, ['scripts/serve-frontend.mjs'], env, 'serve-frontend');
    run(process.execPath, ['backend/src/server.js'], env, 'backend');
    await waitForProductionServices();
    if (earlyExit) throw earlyExit;
    console.log('[start:prod] all services ready; launching Electron');
    run(electronExecutable, ['electron/main.cjs'], {
      ...env,
      EAGLE_API_URL: `http://localhost:${apiPort}`,
      EAGLE_PREVIEW_URL: `http://127.0.0.1:${frontendPort}/src/app/index.html`,
    }, 'electron');
  } catch (err) {
    console.error(`[start:prod] FAIL ${err.message}`);
    stopChildren();
    process.exitCode = 1;
  }
}

void main();

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { stopChildren(); process.exit(0); });
}
