/**
 * React 化改造 —— 阶段8a闭环测试（偏好窗口入口接线 + 壳）。
 *
 * 运行：node tests/react-stage8a-smoke.mjs
 * 断言点：
 *  1. 主窗口 ready 后 send 'open.preferences' {panel:'shortcuts', keyword:'theme'} →
 *     main.cjs 开偏好窗口（vite /src/app/preferences.html）
 *  2. CDP /json/list 出现 preferences target → 连接
 *  3. 偏好窗口内：React host 存在 + entry 挂载标记 + init 通道数据（panel/keyword 透传、ready）
 *  4. Angular 壳同步：PreferencesController 收到 init（sidebarPanels 就绪、currentPanel 切至
 *     shortcuts、keyword 应用）
 *  5. 截图留档（第二窗口）
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay, connect } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage8a-'));
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
      await post('/api/library/create', { name: 'React Stage8a Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#10b981' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's8a.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's8a.png')] });
    },
  });
  const { page, debugPort } = stack;

  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', { expression: `document.readyState`, returnByValue: true });
    return r.result.value === 'complete';
  }, 'main window ready', 30000);

  const waitExpr = (expression) => page.send('Runtime.evaluate', { expression, returnByValue: true });
  await waitFor(async () => (await waitExpr(`!!document.getElementById('main-app')`)).result.value, 'Angular main-app', 45000);
  await waitFor(async () => (await waitExpr(`!!document.querySelector('#box-list .box')`)).result.value, 'grid boxes rendered', 45000);

  const failures = [];
  const assertExprOn = async (pageRef, name, expression, timeout = 20000) => {
    const pass = await (async () => {
      try {
        await waitFor(async () => {
          const r = await pageRef.send('Runtime.evaluate', { expression, returnByValue: true });
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

  // ── 打开偏好窗口（panel/keyword 透传） ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.electron.ipcRenderer.send('open.preferences', { panel: 'shortcuts', keyword: 'theme' });
      return true;
    })()`,
    returnByValue: true,
  });

  // ── 等 preferences target 出现并连接 ──
  let prefPage = null;
  await waitFor(async () => {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      const pref = targets.find((t) => t.type === 'page' && String(t.url).includes('preferences.html'));
      if (pref && pref.webSocketDebuggerUrl) {
        prefPage = await connect(pref.webSocketDebuggerUrl);
        return true;
      }
    } catch (err) { /* retry */ }
    return false;
  }, 'preferences CDP target', 30000);

  await waitFor(async () => {
    const r = await prefPage.send('Runtime.evaluate', { expression: `document.readyState`, returnByValue: true });
    return r.result.value === 'complete';
  }, 'preferences window ready', 30000);

  // ── 断言：壳接线 ──
  await assertExprOn(prefPage, 'pf8a-host', `!!document.getElementById('eagle-preferences-react-host')`);
  await assertExprOn(prefPage, 'pf8a-react-mounted', `(() => {
    const host = document.getElementById('eagle-preferences-react-host');
    return !!host && Object.keys(host).some(k => String(k).indexOf('__reactContainer') === 0);
  })()`);
  await assertExprOn(prefPage, 'pf8a-init-state', `(() => {
    const s = window.__eaglePreferencesState;
    return !!s && s.ready === true && s.panel === 'shortcuts' && s.keyword === 'theme' && !!s.registration;
  })()`);
  await assertExprOn(prefPage, 'pf8a-controller-shell-synced', `(() => {
    const scope = window.__eagleControllerScope;
    // keyword 非空 → 原版 onKeywordChange 切到 search 搜索结果面板（preferences.js 1069）
    return !!scope
      && Array.isArray(scope.sidebarPanels) && scope.sidebarPanels.length > 0
      && scope.currentPanel && scope.currentPanel.name === 'search'
      && scope.keyword === 'theme'
      && !!scope.preferences;
  })()`);

  await delay(700);
  try {
    const screenshot = await Promise.race([
      prefPage.send('Page.captureScreenshot', { format: 'png' }),
      delay(5000).then(() => { throw new Error('screenshot timeout'); }),
    ]);
    fs.mkdirSync('test-run', { recursive: true });
    fs.writeFileSync('test-run/react-stage8a-preferences.png', Buffer.from(screenshot.data, 'base64'));
    console.log('PASS screenshot-saved test-run/react-stage8a-preferences.png');
  } catch (err) {
    console.log(`WARN screenshot failed: ${err.message}`);
  }

  if (failures.length > 0) {
    console.error(`\nSTAGE8A SMOKE FAILED: ${failures.length} assertion(s): ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nSTAGE8A SMOKE OK');
  }
} catch (err) {
  console.error('SMOKE ERROR:', err && err.stack || err);
  process.exitCode = 1;
} finally {
  await stop(stack).catch(() => {});
  try { process.exit(process.exitCode || 0); } catch (err) {}
}
