/**
 * R1：Electron 正式启动冒烟——不启动 Vite dev，改由 scripts/serve-frontend.mjs 提供
 * dist/frontend，验证「仅本地服务 + Electron」即可启动主窗口。
 *
 * 与开发态测试的区别：EAGLE_PREVIEW_URL 指向本地静态产物服务，且断言不依赖
 * /src/app/react/*.ts 源码导入或 React Refresh。
 *
 * 用法：node tests/production-smoke.mjs（先 npm run build）
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, delay, freePort, spawnLogged, stop, waitFor } from './react-cdp-harness.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(projectRoot, 'dist', 'frontend');

if (!fs.existsSync(path.join(distRoot, 'src', 'app', 'index.html'))) {
  console.error(`FAIL 产物缺失：${distRoot}（先运行 npm run build）`);
  process.exit(1);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-production-smoke-'));
const backend = { proc: null };
let serve = null;
let electron = null;
let page = null;

try {
  const [apiPort, thumbnailPort, extensionPort, frontendPort, debugPort] = await Promise.all([
    freePort(), freePort(), freePort(), freePort(), freePort(),
  ]);
  const baseEnv = { ...process.env };
  delete baseEnv.ELECTRON_RUN_AS_NODE;

  const backendEnv = {
    ...baseEnv,
    EAGLE_API_PORT: String(apiPort),
    EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
    EAGLE_EXTENSION_PORT: String(extensionPort),
    EAGLE_LIBRARY_STATE_FILE: path.join(root, 'state.json'),
    EAGLE_USER_DATA_DIR: path.join(root, 'user'),
  };

  backend.proc = spawnLogged(process.execPath, ['backend/src/server.js'], backendEnv);
  serve = spawnLogged(process.execPath, ['scripts/serve-frontend.mjs'], {
    ...baseEnv,
    EAGLE_FRONTEND_PORT: String(frontendPort),
    EAGLE_FRONTEND_ROOT: distRoot,
    EAGLE_THUMBNAIL_URL: `http://localhost:${thumbnailPort}`,
  });

  await waitFor(() => backend.proc.output().includes(`localhost:${apiPort}`), 'backend startup');
  await waitFor(async () => (await fetch(`http://127.0.0.1:${frontendPort}/src/app/index.html`)).ok, 'production static server');
  console.log(`PASS 静态产物服务已就绪：http://127.0.0.1:${frontendPort}`);

  const electronExecutable = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
  electron = spawnLogged(electronExecutable, ['electron/main.cjs', '--regression-host'], {
    ...backendEnv,
    EAGLE_API_URL: `http://localhost:${apiPort}`,
    EAGLE_THUMBNAIL_URL: `http://localhost:${thumbnailPort}`,
    EAGLE_PREVIEW_URL: `http://127.0.0.1:${frontendPort}/src/app/index.html`,
    EAGLE_DEBUG_PORT: String(debugPort),
    EAGLE_ELECTRON_USER_DATA_DIR: path.join(root, 'user'),
  });

  await waitFor(() => electron.output().includes('REGRESSION_HOST_READY'), 'Electron host ready');
  await waitFor(async () => (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).ok, 'Electron CDP');

  for (let attempt = 0; attempt < 15 && !page; attempt++) {
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    const target = targets.find((entry) => entry.type === 'page' && entry.url.includes(String(frontendPort)));
    if (!target) { await delay(500); continue; }
    try {
      page = await Promise.race([
        connect(target.webSocketDebuggerUrl),
        new Promise((resolve, reject) => setTimeout(() => reject(new Error('cdp connect timeout')), 6000)),
      ]);
    } catch { page = null; await delay(500); }
  }
  assert.ok(page, 'CDP page 连接成功');
  await page.send('Runtime.enable');

  const evaluate = async (expression) => {
    const result = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, timeout: 15000 });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };

  // 主窗口在正式产物下完成 React 挂载（__eagleScopeRegistry 由 main.tsx 创建）。
  await waitFor(async () => evaluate(`!!document.querySelector('#main-app') && !!window.__eagleScopeRegistry`), 'React main window mounted', 45000);
  const mounted = await evaluate(`({
    hasMainApp: !!document.querySelector('#main-app'),
    hasRegistry: !!window.__eagleScopeRegistry,
    hasBoxContainer: !!document.getElementById('box-container'),
    hasDriver: !!window.__eagleDriver,
    moduleScript: [...document.querySelectorAll('script[type=module]')].map(s => s.getAttribute('src')).filter(Boolean),
  })`);
  assert.equal(mounted.hasMainApp, true, '#main-app 存在');
  assert.equal(mounted.hasRegistry, true, 'React 主窗已挂载（__eagleScopeRegistry）');
  assert.equal(mounted.hasBoxContainer, true, '#box-container 存在');
  assert.ok(mounted.moduleScript.every((src) => src.startsWith('/assets/')), `入口均为打包产物：${JSON.stringify(mounted.moduleScript)}`);
  console.log(`PASS 主窗口正式产物挂载 ${JSON.stringify(mounted)}`);

  console.log('PRODUCTION_SMOKE_OK');
} catch (err) {
  console.error(`PRODUCTION_SMOKE_FAILED ${err.message}`);
  if (page) {
    for (const ev of page.events.filter((e) => /exceptionThrown/.test(e.method || '')).slice(0, 5)) {
      const d = ev.params?.exceptionDetails;
      console.error(`CDP EXCEPTION ${d?.exception?.description || d?.text}`.slice(0, 400));
      const frames = d?.stackTrace?.callFrames || [];
      for (const f of frames.slice(0, 6)) console.error(`  at ${f.functionName || '<anon>'} ${f.url}:${f.lineNumber}:${f.columnNumber}`);
    }
    for (const ev of page.events.filter((e) => /consoleAPICalled/.test(e.method || '') && e.params?.type === 'error').slice(0, 5)) {
      console.error(`CDP CONSOLE_ERR ${JSON.stringify(ev.params.args?.map((a) => a.description || a.value)).slice(0, 1200)}`);
    }
    try {
      const diag = await page.send('Runtime.evaluate', {
        expression: `({ title: document.title, ready: document.readyState, bodyLen: document.body ? document.body.innerHTML.length : -1,
          mainApp: !!document.querySelector('#main-app'), registry: !!window.__eagleScopeRegistry,
          driver: !!window.__eagleDriver, bootError: window.__eagleBootError || null,
          processType: typeof process, electronVersion: (typeof process !== 'undefined' && process.versions && process.versions.electron) || null,
          hasEagleDesktop: !!window.eagleDesktop, browserShimLoaded: !!window.__eagleBrowserShimLoaded,
          mockLibrary: !!window.__mockLibrary, nodeRequire: typeof window.require,
          appRoot: window.appRoot || null, hasEagleConfig: !!window.EagleConfig,
          videoFormats: (window.EagleConfig && window.EagleConfig.VIDEO_FORMATS) || null,
          supplyState: window.__eagleSupplyState || null })`,
        returnByValue: true,
      });
      console.error(`DIAG ${JSON.stringify(diag.result.value)}`);
    } catch { /* ignore */ }
  }
  if (electron) console.error(electron.output().slice(-2000));
  if (serve) console.error(serve.output().slice(-1000));
  process.exitCode = 1;
} finally {
  try { if (page) page.ws.close(); } catch {}
  for (const proc of [electron, serve, backend.proc]) if (proc) await stop(proc).catch(() => {});
  try { fs.rmSync(root, { recursive: true, force: true }); } catch {}
}
