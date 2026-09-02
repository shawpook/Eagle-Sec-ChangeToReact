/**
 * React 化改造 —— 阶段1 cZ-3a 闭环测试（库加载域轻量五通道：源码签名选择性截肢）。
 *
 * 运行：node tests/react-stage1cz3-smoke.mjs
 * 断言点：
 *  1. 域接管生效：__eagleLibraryDomain.takenOver === true，五个通道均摘除 ≥1 个 bundle 处理器
 *  2. initial 重挂：emit → scope.trialRemain / scope.Registration / window.Registration /
 *     window.machineID 落地；通道仅剩 React 处理器（listenerCount === 1）
 *  3. app-status-welcome 重挂：emit → scope.libraryPath === '' && scope.isLoading === false；
 *     React 自给组件监听存活（listenerCount ≥ 2）
 *  4. dirs-loaded / cache-loaded 重挂：emit → scope.isLoading === true，组件监听存活
 *  5. library.changed 重挂：emit → scope.folders / folderMappings / smartFolderMappings /
 *     libraryModificationTime 落地；逐字保留原码 parent（= window.parent）行为（folder.parent === undefined）
 *  6. 截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage1cz3-'));
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
      await post('/api/library/create', { name: 'React Stage1cz3 Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#0ea5e9' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's1cz3.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's1cz3.png')] });
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
  const assertExpr = async (name, expression, timeout = 15000) => {
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

  // ── 0. 环境探针（ipc 全局名 / 域接管标记 / 移除计数）──
  await evalNow(`(() => {
    window.__cz3lc = (ipc, ch) => {
      if (typeof ipc.listenerCount === 'function') return ipc.listenerCount(ch);
      if (ipc.listeners instanceof Map) return (ipc.listeners.get(ch) || []).length;
      return -1;
    };
    return true;
  })()`);
  const diag = await evalNow(`(() => {
    const w = window;
    return JSON.stringify({
      hasEagleIpc: '__eagleIpc' in w,
      hasDollarDollar: '$$electronIpc' in w,
      hasElectron: 'electron' in w,
      hasDesktop: 'eagleDesktop' in w,
      desktopIpcType: w.eagleDesktop && w.eagleDesktop.ipc ? typeof w.eagleDesktop.ipc : null,
      hasShimsMarker: '__eagleSyncText' in w,
      domain: !!w.__eagleLibraryDomain,
      domainRemoved: w.__eagleLibraryDomain ? JSON.stringify(w.__eagleLibraryDomain.removed) : null,
      ipcOf: (w.eagleDesktop && w.eagleDesktop.ipc) ? 'desktop.ipc' : ('$$electronIpc' in w ? '$$electronIpc' : ('__eagleIpc' in w ? '__eagleIpc' : 'none')),
    });
  })()`);
  console.log(`DIAG ${diag.result?.value}`);

  // ── 1. 域接管生效 ──
  await assertExpr('cz3-taken-over', `(() => {
    const d = window.__eagleLibraryDomain;
    return !!d && d.takenOver === true
      && d.removed['initial'] >= 1
      && d.removed['app-status-welcome'] >= 1
      && d.removed['app-status-library-dirs-loaded'] >= 1
      && d.removed['app-status-library-cache-loaded'] >= 1
      && d.removed['library.changed'] >= 1;
  })()`);

  // ── 2. initial 重挂（trialRemain 用 999 避开试用弹窗分支）──
  await evalNow(`(() => {
    const ipc = window.eagleDesktop?.ipc || window.$$electronIpc || window.__eagleIpc;
    window.__cz3InitialCount = window.__cz3lc(ipc, 'initial');
    ipc.emit('initial', { trialRemain: 999, Registration: { activated: true, machineID: 'm-cz3' }, machineID: 'm-cz3', errorMsg: '' });
    return true;
  })()`);
  await assertExpr('cz3-initial-single-listener', `window.__cz3InitialCount === 1`);
  await assertExpr('cz3-initial-routed', `(() => {
    const s = window.$bodyScope;
    return s.trialRemain === 999
      && !!s.Registration && s.Registration.activated === true
      && !!window.Registration && window.Registration.machineID === 'm-cz3'
      && window.machineID === 'm-cz3';
  })()`);

  // ── 3. app-status-welcome 重挂 ──
  await evalNow(`(() => {
    const ipc = window.eagleDesktop?.ipc || window.$$electronIpc || window.__eagleIpc;
    window.__cz3WelcomeCount = window.__cz3lc(ipc, 'app-status-welcome');
    ipc.emit('app-status-welcome', {});
    return true;
  })()`);
  await assertExpr('cz3-welcome-listeners', `window.__cz3WelcomeCount >= 2`);
  await assertExpr('cz3-welcome-routed', `(() => {
    const s = window.$bodyScope;
    return s.libraryPath === '' && s.isLoading === false;
  })()`);

  // ── 4. dirs-loaded / cache-loaded 重挂 ──
  await evalNow(`(() => {
    const ipc = window.eagleDesktop?.ipc || window.$$electronIpc || window.__eagleIpc;
    window.__cz3DirsCount = window.__cz3lc(ipc, 'app-status-library-dirs-loaded');
    window.__cz3CacheCount = window.__cz3lc(ipc, 'app-status-library-cache-loaded');
    ipc.emit('app-status-library-dirs-loaded', 3);
    ipc.emit('app-status-library-cache-loaded');
    return true;
  })()`);
  await assertExpr('cz3-dirs-listeners', `window.__cz3DirsCount >= 2`);
  await assertExpr('cz3-cache-listeners', `window.__cz3CacheCount >= 2`);
  await assertExpr('cz3-loading-flag', `window.$bodyScope.isLoading === true`);

  // ── 5. library.changed 重挂（逐字 parent 行为：folder.parent === undefined）──
  await evalNow(`(() => {
    const ipc = window.eagleDesktop?.ipc || window.$$electronIpc || window.__eagleIpc;
    ipc.emit('library.changed', {
      folders: [{ id: 'cz3-folder', name: 'CZ3 Test' }],
      smartFolders: [{ id: 'cz3-smart', name: 'CZ3 Smart' }],
      modificationTime: 1725168000000
    });
    return true;
  })()`);
  await delay(600);
  await assertExpr('cz3-library-changed-routed', `(() => {
    const s = window.$bodyScope;
    const f = s.folderMappings && s.folderMappings['cz3-folder'];
    const sf = s.smartFolderMappings && s.smartFolderMappings['cz3-smart'];
    return !!f && f.name === 'CZ3 Test' && Array.isArray(f.children) && f.children.length === 0
      && f.parent === undefined
      && !!sf && sf.parent === undefined
      && Array.isArray(s.folders) && s.folders.length === 1
      && s.libraryModificationTime === 1725168000000;
  })()`);

  await delay(600);
  await screenshotTo('test-run/react-stage1cz3-smoke.png', 5000);

  if (failures.length) {
    console.error(`STAGE1CZ3 SMOKE FAILED: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('STAGE1CZ3 SMOKE OK');
  }
} catch (err) {
  console.error('STAGE1CZ3 SMOKE ERROR:', err);
  process.exitCode = 1;
} finally {
  if (stack) await stop(stack.electron).catch(() => {});
  if (stack) await stop(stack.vite).catch(() => {});
  if (stack) await stop(stack.backend).catch(() => {});
}
