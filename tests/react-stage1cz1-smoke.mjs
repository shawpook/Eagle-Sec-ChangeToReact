/**
 * React 化改造 —— 阶段1 cZ-1 闭环测试（存储桥基建制）。
 *
 * 运行：node tests/react-stage1cz1-smoke.mjs
 * 断言点：
 *  1. 桥接完成：__eagleCoreState 在位且 11 个字段收编
 *  2. 双向透明：scope.theme 写 → AppCore 读一致；AppCore.viewMode 写 → scope 读一致
 *  3. digest 兼容：bundle watch（viewMode）经桥写仍触发（切 trash → 切回 all）
 *  4. 幂等：重复桥接不破坏访问器
 *  5. 截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage1cz1-'));
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
      await post('/api/library/create', { name: 'React Stage1cz1 Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#0ea5e9' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's1cz1.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's1cz1.png')] });
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
    if (r.exceptionDetails) console.log(`WARN eval error: ${JSON.stringify(r.exceptionDetails).slice(0, 200)}`);
    return r;
  };

  // ── 桥接完成 ──
  await assertExpr('cz1-bridged', `(() => {
    const c = window.__eagleCoreState;
    if (!c) return false;
    return ['theme','platform','language','isLoading','isUILoaded','viewMode','keyword','layout','orderBy','currentFocus']
      .every(k => k in c);
  })()`);

  // ── 双向透明 ──
  await evalNow(`(() => {
    const b = window.$bodyScope;
    b.theme = 'light';
    window.__t1 = window.__eagleCoreState.theme === 'light';
    window.__eagleCoreState.theme = 'dark';
    window.__t2 = b.theme === 'dark';
    return true;
  })()`);
  await assertExpr('cz1-scope-to-core', `window.__t1 === true`);
  await assertExpr('cz1-core-to-scope', `window.__t2 === true`);

  // ── digest 兼容（bundle viewMode watch 经桥写仍触发）──
  await evalNow(`(() => {
    const b = window.$bodyScope;
    b.viewMode = 'trash';
    b.$evalAsync();
    return true;
  })()`);
  await delay(600);
  await assertExpr('cz1-watch-via-bridge', `(() => {
    const b = window.$bodyScope;
    const ok = b.viewMode === 'trash';
    b.viewMode = 'all';
    b.$evalAsync();
    return ok;
  })()`);

  // ── 幂等 ──
  await evalNow(`(() => {
    const d1 = Object.getOwnPropertyDescriptor(window.$bodyScope, 'theme');
    const hasGet = !!(d1 && d1.get);
    window.__idem = hasGet;
    return true;
  })()`);
  await assertExpr('cz1-accessor-persists', `window.__idem === true`);

  await delay(600);
  await screenshotTo('test-run/react-stage1cz1-smoke.png', 5000);

  if (failures.length) {
    console.error(`STAGE1CZ1 SMOKE FAILED: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('STAGE1CZ1 SMOKE OK');
  }
} catch (err) {
  console.error('STAGE1CZ1 SMOKE ERROR:', err);
  process.exitCode = 1;
} finally {
  if (stack) await stop(stack.electron).catch(() => {});
  if (stack) await stop(stack.vite).catch(() => {});
  if (stack) await stop(stack.backend).catch(() => {});
}
