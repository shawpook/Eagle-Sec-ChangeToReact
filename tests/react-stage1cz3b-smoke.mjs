/**
 * React 化改造 —— 阶段1 cZ-3b 闭环测试（启动重管线：app-status-loading /
 * app-status-library-loaded / preload-library 三通道签名截肢 + bg-state 生命周期）。
 *
 * 运行：node tests/react-stage1cz3b-smoke.mjs
 * 断言点：
 *  1. 域接管：三通道各摘除 ≥1 个 bundle 处理器
 *  2. preload-library 域内缓存：emit（真实 JSONL 文件）→ libraryCacheCount === 2
 *  3. app-status-library-loaded 重挂：emit（usingPreloadCache）→ s.raw === 2 条目 /
 *     isUILoaded / libraryName / APIServer 启动 / LazyLoadManager 初始化 /
 *     calculateImageBinding 完成后 isLoading === false
 *  4. background-state 域内注册：emit → metadataQueueLength 落地 + 域内心跳启动
 *  5. app-status-loading 清理：emit → isUILoaded=false / allData 清空 / 心跳停止 /
 *     bg 监听清零
 *  6. 恢复：重放 preload + library-loaded，回到可用态；截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage1cz3b-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });

let stack;
try {
  stack = await bootStack({
    librariesRoot,
    stateFile,
    userDataDir,
    beforeElectron: async (apiPort) => {
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
      await post('/api/library/create', { name: 'React Stage1cz3b Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#0ea5e9' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's1cz3b.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's1cz3b.png')] });
    },
  });
  const { page } = stack;

  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', { expression: `document.readyState`, returnByValue: true });
    return r.result.value === 'complete';
  }, 'main window ready', 30000);

  const waitExpr = (expression) => page.send('Runtime.evaluate', { expression, returnByValue: true });
  await waitFor(async () => (await waitExpr(`!!document.getElementById('main-app')`)).result.value, 'Angular main-app', 45000);
  await waitFor(async () => (await waitExpr(`!!document.querySelector('#box-list .box')`)).result.value, 'grid boxes rendered', 45000);
  await delay(1200);

  const screenshotTo = async (file, timeoutMs) => {
    try {
      const screenshot = await Promise.race([
        page.send('Page.captureScreenshot', { format: 'png' }),
        delay(timeoutMs).then(() => { throw new Error(`screenshot timeout (${timeoutMs})ms`); }),
      ]);
      fs.mkdirSync('test-run', { recursive: true });
      fs.writeFileSync(file, Buffer.from(screenshot.data, 'base64'));
      console.log(`PASS screenshot-saved ${file}`);
    } catch (err) {
      console.log(`WARN screenshot failed: ${err.message}`);
    }
  };

  const failures = [];
  const assertExpr = async (name, expression, timeout = 20000) => {
    const pass = await (async () => {
      try {
        await waitFor(async () => {
          const r = await waitExpr(expression);
          return r.result.value === true;
        }, name, timeout);
        return true;
      } catch (err) {
        return false;
      }
    })();
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`);
    if (!pass) failures.push(name);
  };

  const evalNow = async (expression) => {
    const r = await page.send('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) console.log(`WARN eval error: ${r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails).slice(0, 300)}`);
    return r;
  };

  const ipcExpr = `window.eagleDesktop?.ipc || window.$$electronIpc || window.__eagleIpc`;

  // ── 1. 域接管 ──
  await assertExpr('cz3b-taken-over', `(() => {
    const d = window.__eagleLibraryDomain;
    return !!d && d.takenOver === true
      && d.removed['app-status-loading'] >= 1
      && d.removed['app-status-library-loaded'] >= 1
      && d.removed['preload-library'] >= 1;
  })()`);

  // ── 2. preload-library 域内缓存 ──
  const cacheFile = path.join(tempRoot, 'cz3b-cache.jsonl');
  fs.writeFileSync(cacheFile, [
    JSON.stringify({ id: 'CZ3B1', ext: 'png', name: 'cz3b-a', tags: [], folders: [] }),
    JSON.stringify({ id: 'CZ3B2', ext: 'png', name: 'cz3b-b', tags: [], folders: [] }),
  ].join('\n'));
  const cacheFileJson = JSON.stringify(cacheFile).replace(/\\\\/g, '\\\\\\\\');
  await evalNow(`(() => {
    const ipc = ${ipcExpr};
    ipc.emit('preload-library', { cachePath: ${cacheFileJson} });
    return true;
  })()`);
  await delay(400);
  await assertExpr('cz3b-preload-cache', `window.__eagleLibraryDomain.libraryCacheCount === 2`);

  // ── 3. app-status-library-loaded 重挂（用 preload 缓存载入）──
  await evalNow(`(() => {
    const s = window.$bodyScope;
    window.__cz3bRootDir = s.libraryPath;
    const ipc = ${ipcExpr};
    ipc.emit('app-status-library-loaded', {
      machineID: 'm-cz3b',
      rootDir: s.libraryPath,
      imagesDir: s.libraryPath + '/images',
      imagesStringPath: '',
      usingPreloadCache: true,
      usingCache: false,
      folders: [],
      smartFolders: [],
      quickAccess: [],
      tagsGroups: [],
      modificationTime: 1725260000000,
      loadedTime: 1,
      backgroundWindowID: undefined
    });
    return true;
  })()`);
  await assertExpr('cz3b-library-loaded-raw', `window.$bodyScope.raw && window.$bodyScope.raw.length === 2`);
  await assertExpr('cz3b-library-loaded-state', `(() => {
    const s = window.$bodyScope;
    return s.isUILoaded === true
      && typeof s.libraryName === 'string' && s.libraryName.length > 0
      && !!window.APIServer
      && !!window.machineID && window.machineID === 'm-cz3b'
      && window.__eagleLibraryDomain.hasLazyLoadManager === true;
  })()`);
  await assertExpr('cz3b-library-loaded-binding-done', `(() => {
    const s = window.$bodyScope;
    return s.isLoading === false && s.isItemBindCalculated === true && Array.isArray(s.allData) && s.allData.length === 2;
  })()`, 30000);

  // ── 4. background-state 域内注册 ──
  await evalNow(`(() => {
    const ipc = ${ipcExpr};
    ipc.emit('background-state', {
      paletteQueueLength: 1,
      metadataQueueLength: 5,
      downloadQueueLength: 0,
      paletteQueueDelay: 0,
      paletteQueuePaused: false
    });
    return true;
  })()`);
  await delay(300);
  await assertExpr('cz3b-bg-state-routed', `(() => {
    const s = window.$bodyScope;
    return s.metadataQueueLength === 5 && s.paletteQueueLength === 1
      && window.__eagleLibraryDomain.hasHeartbeat === true;
  })()`);

  // ── 5. app-status-loading 清理 ──
  await evalNow(`(() => {
    const ipc = ${ipcExpr};
    window.__cz3bBgCount = (ipc.listeners instanceof Map) ? (ipc.listeners.get('background-state') || []).length : -1;
    ipc.emit('app-status-loading');
    return true;
  })()`);
  await delay(400);
  await assertExpr('cz3b-loading-teardown', `(() => {
    const s = window.$bodyScope;
    const ipc = ${ipcExpr};
    const bgCount = (ipc.listeners instanceof Map) ? (ipc.listeners.get('background-state') || []).length : -1;
    return s.isUILoaded === false && Array.isArray(s.allData) && s.allData.length === 0
      && window.__eagleLibraryDomain.hasHeartbeat === false
      && bgCount === 0;
  })()`);

  // ── 6. 恢复库载入（回到可用态）──
  await evalNow(`(() => {
    const ipc = ${ipcExpr};
    ipc.emit('preload-library', { cachePath: ${cacheFileJson} });
    ipc.emit('app-status-library-loaded', {
      machineID: 'm-cz3b',
      rootDir: window.__cz3bRootDir,
      imagesDir: window.__cz3bRootDir + '/images',
      imagesStringPath: '',
      usingPreloadCache: true,
      usingCache: false,
      folders: [],
      smartFolders: [],
      quickAccess: [],
      tagsGroups: [],
      modificationTime: 1725260000000,
      loadedTime: 1
    });
    return true;
  })()`);
  await assertExpr('cz3b-restored', `(() => {
    const s = window.$bodyScope;
    return s.isUILoaded === true && s.raw && s.raw.length === 2;
  })()`, 30000);

  await delay(800);
  await screenshotTo('test-run/react-stage1cz3b-smoke.png', 5000);

  if (failures.length) {
    console.error(`STAGE1CZ3B SMOKE FAILED: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('STAGE1CZ3B SMOKE OK');
  }
} catch (err) {
  console.error('STAGE1CZ3B SMOKE ERROR:', err);
  process.exitCode = 1;
} finally {
  if (stack) await stop(stack.electron).catch(() => {});
  if (stack) await stop(stack.vite).catch(() => {});
  if (stack) await stop(stack.backend).catch(() => {});
}
