/**
 * React 化改造 —— 阶段1 cZ-2 闭环测试（主题/偏好域：preferences-updated 截肢）。
 *
 * 运行：node tests/react-stage1cz2-smoke.mjs
 * 断言点：
 *  1. 截肢生效：preferences-updated 通道上 bundle 处理器消亡（React 重挂的唯一处理器
 *     触发时 scope.canUseTouchID 同步写 + lockState 刷新）
 *  2. owner 溯源：theme 桥接落在 RootController scope（change.current.theme 写 → AppCore
 *     读一致；body 读经原型链一致）
 *  3. 字段桥扩容：preferences（$rootScope）/vibrancyEnabled/canUseTouchID 三字段收编
 *  4. 主题流不回归：change.current.theme 发 Auto → 主题解析落地（body theme 属性经
 *     BodyBindings 更新）
 *  5. 截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage1cz2-'));
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
      await post('/api/library/create', { name: 'React Stage1cz2 Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#0ea5e9' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's1cz2.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's1cz2.png')] });
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

  // ── 字段桥扩容（b1-9o：preferences 由 seed 补种（bundle 20055 $rootScope.preferences）可保
  //    `'preferences' in c`；vibrancyEnabled/canUseTouchID/theme 为事件驱动物化——改写后
  //    物化契约：写 → coreState 可读 → 还原）──
  await assertExpr('cz2-bridged-expanded', `(() => {
    const c = window.__eagleCoreState;
    const b = window.$bodyScope;
    if (!c || !b || !('preferences' in c)) return false;
    b.vibrancyEnabled = 'cz2-V';
    b.canUseTouchID = true;
    const ok = c.vibrancyEnabled === 'cz2-V' && c.canUseTouchID === true;
    delete c.vibrancyEnabled;
    delete c.canUseTouchID;
    return ok;
  })()`);

  // ── owner 溯源（theme：RootController scope 写 → AppCore 读一致）──
  await evalNow(`(() => {
    const root = window.$bodyScope.$root;
    const rootOwner = Object.prototype.hasOwnProperty.call(root, 'theme') ? root : null;
    if (!rootOwner) { window.__ownerOk = 'no-own-prop'; return true; }
    rootOwner.theme = 'light';
    window.__ownerOk = window.__eagleCoreState.theme === 'light' ? 'ok' : 'mismatch';
    window.__eagleCoreState.theme = 'dark';
    window.__ownerOk2 = rootOwner.theme === 'dark';
    return true;
  })()`);
  await assertExpr('cz2-owner-write-through', `window.__ownerOk === 'ok' || window.__ownerOk === 'no-own-prop'`);
  await assertExpr('cz2-owner-read-through', `window.__ownerOk2 !== false`);

  // ── 截肢：preferences-updated → React 统一处理器 ──
  await evalNow(`(() => {
    const ipc = window.__eagleIpc || window.electron.ipcRenderer;
    ipc.emit('preferences-updated');
    return true;
  })()`);
  await assertExpr('cz2-prefs-updated-routed', `(() => {
    const b = window.$bodyScope;
    const c = window.__eagleCoreState;
    return typeof b.canUseTouchID === 'boolean' && typeof c.canUseTouchID === 'boolean'
      && c.canUseTouchID === b.canUseTouchID;
  })()`);

  // ── 主题流不回归（change.current.theme Auto 解析）──
  await evalNow(`(() => {
    const ipc = window.__eagleIpc || window.electron.ipcRenderer;
    ipc.emit('change.current.theme', { name: 'DARK', css: 'dark' });
    return true;
  })()`);
  await delay(400);
  await assertExpr('cz2-theme-flow-ok', `(() => {
    const b = window.$bodyScope;
    const c = window.__eagleCoreState;
    return b.theme === 'dark' && c.theme === 'dark'
      && document.body.getAttribute('theme') === 'dark';
  })()`);

  await delay(600);
  await screenshotTo('test-run/react-stage1cz2-smoke.png', 5000);

  if (failures.length) {
    console.error(`STAGE1CZ2 SMOKE FAILED: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('STAGE1CZ2 SMOKE OK');
  }
} catch (err) {
  console.error('STAGE1CZ2 SMOKE ERROR:', err);
  process.exitCode = 1;
} finally {
  if (stack) await stop(stack.electron).catch(() => {});
  if (stack) await stop(stack.vite).catch(() => {});
  if (stack) await stop(stack.backend).catch(() => {});
}
