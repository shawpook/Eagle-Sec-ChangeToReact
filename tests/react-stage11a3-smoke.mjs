/**
 * React 化改造 —— 阶段11-pre a3 闭环测试（lock-screen 双块接管）。
 *
 * 运行：node tests/react-stage11a3-smoke.mjs
 * 断言点：
 *  1. 壳：#eagle-folder-lock-host（列表容器内）+ #eagle-app-lock-host（body 级）存在；
 *     初始无 .lock-screen
 *  2. 文件夹锁：scope.currentFolder 置密码夹 → 显示（标题 + 密码提示）；TouchID 按钮缺位
 *     （win32 canUseTouchID=false）；输入经 onInput 同步 scope.unlockPassword；错误密码
 *     Enter → shake class（同步读取）；正确密码 Enter → isUnLock=true + 锁屏隐藏
 *  3. 应用锁：savePreferences(enable/password/passwordTips) + refreshFromGlobals + scope
 *     侧同置 → isAppLocked=true 显示（apptitle + 提示 + corner-btns）；输入框自动聚焦
 *     （挂载兜底 + always-focus 轮询）；错误密码 Enter → shake（$timeout 10ms 后异步加类，
 *     60ms 后读标志）；正确密码 Enter → isAppLocked=false + 隐藏
 *  4. 截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage11a3-'));
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
      await post('/api/library/create', { name: 'React Stage11a3 Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#0ea5e9' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's11a3.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's11a3.png')] });
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
  await delay(500);

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
    await page.send('Runtime.evaluate', { expression, returnByValue: true });
  };
  const dispatchEnter = (selector) => `(() => {
    const input = document.querySelector('${selector}');
    const e = new KeyboardEvent('keyup', { bubbles: true });
    Object.defineProperty(e, 'keyCode', { value: 13 });
    input.dispatchEvent(e);
    return true;
  })()`;
  const setInputValue = (selector, value) => `(() => {
    const input = document.querySelector('${selector}');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, '${value}');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`;

  // ── 壳 ──
  await assertExpr('a3-hosts', `(() => {
    const folderHost = document.getElementById('eagle-folder-lock-host');
    const appHost = document.getElementById('eagle-app-lock-host');
    return !!(folderHost && appHost && folderHost.closest('#list-content-panel'));
  })()`);
  await assertExpr('a3-initial-hidden', `document.querySelectorAll('.lock-screen').length === 0`);

  // ── 文件夹锁 ──
  await evalNow(`(() => {
    const b = window.$bodyScope;
    b.currentFolder = { id: 'FOLDER-LOCK-TEST', name: 'Locked Folder', password: window.btoa('123456'), passwordTips: 'hint-tips', isUnLock: false };
    b.$evalAsync();
    return true;
  })()`);
  await assertExpr('a3-folder-lock-visible', `(() => {
    const lock = document.querySelector('.lock-screen');
    return !!lock && !lock.classList.contains('app-lock-screen')
      && lock.querySelector('h4').textContent.length > 0
      && lock.textContent.indexOf('hint-tips') > -1;
  })()`);
  await assertExpr('a3-folder-touchid-absent', `!document.querySelector('.lock-screen .touchid-btn-inline')`);
  await evalNow(setInputValue('#lock-password-input', 'wrong'));
  await assertExpr('a3-folder-model-synced', `window.$bodyScope.unlockPassword === 'wrong'`);
  await evalNow(`(() => {
    const input = document.querySelector('#lock-password-input');
    const e = new KeyboardEvent('keyup', { bubbles: true });
    Object.defineProperty(e, 'keyCode', { value: 13 });
    input.dispatchEvent(e);
    window.__folderShake = input.classList.contains('animation--shake-horizontal');
    return true;
  })()`);
  await assertExpr('a3-folder-wrong-shake', `window.__folderShake === true`);
  await evalNow(setInputValue('#lock-password-input', '123456'));
  await evalNow(dispatchEnter('#lock-password-input'));
  await assertExpr('a3-folder-unlocked', `(() => {
    const b = window.$bodyScope;
    return b.currentFolder.isUnLock === true && !document.querySelector('.lock-screen');
  })()`);

  // ── 应用锁 ──
  // savePreferences 为 shims 内部函数；公开 API 是 electron-settings v4 的 setSync + 缓存强制重载
  await evalNow(`(() => {
    try {
      const prefs = JSON.parse(JSON.stringify(window.electronSettings.getPreferences()));
      prefs.privacy = { enable: 'true', password: window.btoa('654321'), passwordTips: 'app-hint' };
      window.electronSettings.setSync('preferences', prefs);
      window.electronSettings.getPreferences(true);
      window.__eagleReactStore.getState().refreshFromGlobals();
      const b = window.$bodyScope;
      b.$root.preferences.privacy = prefs.privacy;
      b.$root.isAppLocked = true;
      b.$evalAsync();
      return true;
    } catch (err) {
      window.__a3err = String(err && err.stack || err);
      return false;
    }
  })()`);
  await assertExpr('a3-app-prefs-applied', `!window.__a3err`);
  await assertExpr('a3-app-lock-visible', `(() => {
    const lock = document.querySelector('.lock-screen.app-lock-screen');
    return !!lock && lock.querySelector('h4').textContent.length > 0 && lock.textContent.indexOf('app-hint') > -1;
  })()`);
  await assertExpr('a3-app-corner-btns', `!!document.querySelector('.lock-screen.app-lock-screen .corner-btns')`);
  await assertExpr('a3-app-touchid-absent', `!document.querySelector('.app-lock-screen .touchid-btn-inline')`);
  await delay(400);
  await assertExpr('a3-app-focus', `document.activeElement && document.activeElement.id === 'app-lock-password-input'`);
  await evalNow(setInputValue('#app-lock-password-input', 'bad'));
  await evalNow(`(() => {
    const input = document.querySelector('#app-lock-password-input');
    const e = new KeyboardEvent('keyup', { bubbles: true });
    Object.defineProperty(e, 'keyCode', { value: 13 });
    input.dispatchEvent(e);
    setTimeout(() => { window.__appShake = input.classList.contains('animation--shake-horizontal'); }, 60);
    return true;
  })()`);
  await assertExpr('a3-app-wrong-shake', `window.__appShake === true`);
  await evalNow(setInputValue('#app-lock-password-input', '654321'));
  await evalNow(dispatchEnter('#app-lock-password-input'));
  await assertExpr('a3-app-unlocked', `(() => {
    const b = window.$bodyScope;
    return b.$root.isAppLocked === false && !document.querySelector('.lock-screen.app-lock-screen');
  })()`);

  await delay(600);
  await screenshotTo('test-run/react-stage11a3-smoke.png', 5000);

  if (failures.length) {
    console.error(`STAGE11A3 SMOKE FAILED: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('STAGE11A3 SMOKE OK');
  }
} catch (err) {
  console.error('STAGE11A3 SMOKE ERROR:', err);
  process.exitCode = 1;
} finally {
  if (stack) await stop(stack.electron).catch(() => {});
  if (stack) await stop(stack.vite).catch(() => {});
  if (stack) await stop(stack.backend).catch(() => {});
}
