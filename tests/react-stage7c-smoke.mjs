/**
 * React 化改造 —— 阶段7c-1收尾闭环测试（小弹窗族）。
 *
 * 运行：node tests/react-stage7c-smoke.mjs
 * 断言点：
 *  1. 壳：七个宿主存在；旧 <layout-panel>/<notification-modal>/<folder-password-modal>/
 *     <mousewheel-setting-modal>/<welcome-page>/<new-version-notification-modal>/<about-panel> 岛已删除
 *  2. about：OPEN_ABOUT_PANEL 广播 → #about-panel.open；点击 OK 关闭
 *  3. mousewheel：OPEN_MOUSEWHEEL_PREFERENCE_WINDOW → 弹窗开；选 paging + 保存 →
 *     $root.preferences.habits.scrollBehavior === 'paging' 且 scrollBehaviorTour === true（数据面）
 *  4. folder password：SET-FOLDER-PASSWORD 广播 → change 模式开；旧密码+新密码保存 →
 *     folder.password 变为 btoa(新密码)（数据面）
 *  5. layout panel：OPEN_LAYOUT_PANEL → #layout-panel.open；Esc 关闭
 *  6. notification：OPEN_NOTIFICATION → 弹窗开；overlay 关闭
 *  7. welcome：ipc app-status-welcome → 开；library-dirs-loaded → 关 + body class 清除
 *  8. 截图留档 test-run/react-stage7c-about.png
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage7c-'));
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
      await post('/api/library/create', { name: 'React Stage7c Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's7c.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's7c.png')] });
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

  const screenshotTo = async (file, timeoutMs) => {
    try {
      const screenshot = await Promise.race([
        page.send('Page.captureScreenshot', { format: 'png' }),
        delay(timeoutMs).then(() => { throw new Error(`screenshot timeout (${timeoutMs}ms)`); }),
      ]);
      fs.mkdirSync('test-run', { recursive: true });
      fs.writeFileSync(file, Buffer.from(screenshot.data, 'base64'));
      console.log(`PASS screenshot-saved ${file}`);
    } catch (err) {
      console.log(`WARN screenshot failed: ${err.message}`);
    }
  };

  const failures = [];
  const assertExpr = async (name, expression, timeout = 12000) => {
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

  // ── 壳 ──
  await assertExpr(
    'panels-hosts',
    `['eagle-layout-panel-host','eagle-notification-host','eagle-newversion-host','eagle-folder-password-host','eagle-mousewheel-modal-host','eagle-about-host','eagle-welcome-host'].every((id) => !!document.getElementById(id))`
  );
  await assertExpr(
    'panels-old-islands-gone',
    `!document.querySelector('layout-panel') && !document.querySelector('notification-modal') && !document.querySelector('folder-password-modal') && !document.querySelector('mousewheel-setting-modal') && !document.querySelector('welcome-page') && !document.querySelector('new-version-notification-modal') && !document.querySelector('about-panel')`
  );

  // ── about panel ──
  await page.send('Runtime.evaluate', {
    expression: `(() => { window.$bodyScope.$root.$broadcast('OPEN_ABOUT_PANEL'); return true; })()`,
    returnByValue: true,
  });
  await assertExpr(`about-open`, `document.getElementById('about-panel').classList.contains('open')`);
  await page.send('Runtime.evaluate', {
    expression: `(() => { document.querySelector('#about-panel .button-primary').click(); return true; })()`,
    returnByValue: true,
  });
  await assertExpr(`about-closed`, `!document.getElementById('about-panel').classList.contains('open')`);

  // ── mousewheel modal（数据面） ──
  await page.send('Runtime.evaluate', {
    expression: `(() => { window.$bodyScope.$root.$broadcast('OPEN_MOUSEWHEEL_PREFERENCE_WINDOW'); return true; })()`,
    returnByValue: true,
  });
  await assertExpr(
    'mousewheel-open',
    `(() => { const el = document.querySelector('#eagle-mousewheel-modal-host .mousewheel-setting-modal'); return !!el && el.classList.contains('open'); })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const items = [...document.querySelectorAll('#eagle-mousewheel-modal-host .mousewheel-setting-modal .item')];
      items[2].click();
      return true;
    })()`,
    returnByValue: true,
  });
  await page.send('Runtime.evaluate', {
    expression: `(() => { document.querySelector('#eagle-mousewheel-modal-host .mousewheel-setting-modal .button-primary').click(); return true; })()`,
    returnByValue: true,
  });
  await assertExpr(
    'mousewheel-saved',
    `window.$bodyScope.$root.preferences.habits.scrollBehavior === 'paging' && window.$bodyScope.$root.preferences.habits.scrollBehaviorTour === true`
  );
  await assertExpr(
    'mousewheel-closed',
    `(() => { const el = document.querySelector('#eagle-mousewheel-modal-host .mousewheel-setting-modal'); return !el.classList.contains('open'); })()`
  );

  // ── folder password modal（数据面） ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.__fpFolder = { id: 'FOLDER-TEST', name: 'Secret', password: window.btoa('oldpass'), isUnlock: false };
      window.__eagleBus.emit('SET-FOLDER-PASSWORD', { folder: window.__fpFolder, mode: 'change' });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'fp-open',
    `(() => { const el = document.querySelector('#eagle-folder-password-host .folder-password-modal'); return !!el && el.classList.contains('open'); })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const setValue = (el, value) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const visible = [...document.querySelectorAll('#eagle-folder-password-host .folder-password-modal input')].filter((el) => el.offsetParent !== null);
      setValue(visible[0], 'oldpass');
      setValue(visible[1], 'newpass');
      setValue(visible[2], 'newpass');
      document.querySelector('#eagle-folder-password-host .folder-password-modal .button-primary').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'fp-saved',
    `window.__fpFolder.password === window.btoa('newpass')`
  );
  await assertExpr(
    'fp-closed',
    `(() => { const el = document.querySelector('#eagle-folder-password-host .folder-password-modal'); return !el.classList.contains('open'); })()`
  );

  // ── layout panel ──
  await page.send('Runtime.evaluate', {
    expression: `(() => { window.$bodyScope.$root.$broadcast('OPEN_LAYOUT_PANEL'); return true; })()`,
    returnByValue: true,
  });
  await assertExpr(`layout-open`, `document.getElementById('layout-panel').classList.contains('open')`);
  await assertExpr(
    'layout-select-value',
    `(() => { const select = document.querySelector('#layout-panel select'); return !!select && select.value === (window.$bodyScope.layout || 'JustifiedLayout'); })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.getElementById('layout-panel-search');
      const e = new KeyboardEvent('keyup', { bubbles: true });
      Object.defineProperty(e, 'keyCode', { value: 27 });
      input.dispatchEvent(e);
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(`layout-closed`, `!document.getElementById('layout-panel').classList.contains('open')`);

  // ── notification modal ──
  await page.send('Runtime.evaluate', {
    expression: `(() => { window.$bodyScope.$root.$broadcast('OPEN_NOTIFICATION'); return true; })()`,
    returnByValue: true,
  });
  await assertExpr(
    'notification-open',
    `(() => { const el = document.querySelector('#eagle-notification-host .notification-modal'); return !!el && el.classList.contains('open'); })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => { document.querySelector('#eagle-notification-host .notification-modal-overlay').click(); return true; })()`,
    returnByValue: true,
  });
  await assertExpr(
    'notification-closed',
    `(() => { const el = document.querySelector('#eagle-notification-host .notification-modal'); return !el.classList.contains('open'); })()`
  );

  // ── welcome page（本地 emit ipc 事件） ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.__eagleIpc.emit('app-status-welcome', {});
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'welcome-open',
    `(() => { const el = document.getElementById('welcome-page'); return !!el && el.style.display !== 'none' && document.body.classList.contains('is-welcome-page'); })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.__eagleIpc.emit('app-status-library-dirs-loaded', 1);
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'welcome-closed',
    `(() => { const el = document.getElementById('welcome-page'); return el.style.display === 'none' && !document.body.classList.contains('is-welcome-page'); })()`
  );

  // ── 截图（about 打开状态） ──
  await page.send('Runtime.evaluate', {
    expression: `(() => { window.$bodyScope.$root.$broadcast('OPEN_ABOUT_PANEL'); return true; })()`,
    returnByValue: true,
  });
  await delay(400);
  await screenshotTo('test-run/react-stage7c-about.png', 10000);
  await page.send('Runtime.evaluate', {
    expression: `(() => { document.querySelector('#about-panel .button-primary').click(); return true; })()`,
    returnByValue: true,
  });

  if (failures.length > 0) {
    console.error(`STAGE7C_SMOKE_FAILED ${JSON.stringify(failures)}`);
    process.exitCode = 1;
  } else {
    console.log('STAGE7C_SMOKE_OK');
  }
} finally {
  if (stack) {
    await stop(stack.electron);
    await stop(stack.vite);
    await stop(stack.backend);
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
