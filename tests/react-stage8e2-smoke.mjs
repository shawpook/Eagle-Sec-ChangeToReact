/**
 * React 化改造 —— 阶段8e-2闭环测试（偏好窗口 Angular 壳移除，React 全接管）。
 *
 * 运行：node tests/react-stage8e2-smoke.mjs
 * 断言点：
 *  1. 无 Angular（angular.min.js 已删）：window.angular 未定义；shell 渲染 sidebar（10 项 +
 *     3 分隔）/header/footer；body 属性（theme/platform/class）
 *  2. React sidebar 切换：active class 迁移 + panel-title 译文 + localStorage lastPanel
 *  3. 窗内搜索（shell 渲染的 #sidebar-search）：keyword → search 面板 + search-show 过滤 +
 *     无结果态 panel-empty（showSearchEmpty 100ms 统计）→ 清空回 lastPanel
 *  4. 主题点击 → body theme attr 联动（'blue'）+ preferences.theme 数据面
 *  5. {keyword:'theme'} 重开 → search 面板 + init focusSearch（activeElement）+ 输入框 value 同步
 *  6. privacy 开关（原版 ng-click 先于 change 的时序）+ change 行 → React 密码弹窗打开 +
 *     auto-focus 生效（activeElement）+ 关闭
 *  7. apply 数据面（ipc 'chnage-preferences' spy）；Esc（w-mousetrap 等价）→ cancel → 窗口关闭
 *     （CDP target 消失）；旧 Angular 块/脚本区已删；截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay, connect } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage8e2-'));
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
      await post('/api/library/create', { name: 'React Stage8e2 Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#10b981' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's8e2.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's8e2.png')] });
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
    return pass;
  };

  const evalOn = async (pageRef, expression) => {
    const r = await pageRef.send('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) {
      throw new Error(`evaluate failed: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    }
    return r.result.value;
  };

  const preferencesTargetGone = async () => {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      return !targets.some((t) => t.type === 'page' && String(t.url).includes('preferences.html'));
    } catch (err) {
      return false;
    }
  };

  const connectPreferences = async () => {
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
      try {
        const r = await prefPage.send('Runtime.evaluate', { expression: `document.readyState`, returnByValue: true });
        return r.result.value === 'complete';
      } catch (err) {
        return false;
      }
    }, 'preferences window ready', 30000);
    return prefPage;
  };

  const openPreferences = async (params = {}) => {
    await page.send('Runtime.evaluate', {
      expression: `window.electron.ipcRenderer.send('open.preferences', ${JSON.stringify(params)}); true`,
      returnByValue: true,
    });
    return connectPreferences();
  };

  const PANELS = '[data-eagle-react-panels="panels"]';

  // ── 开窗（无参 → general 默认面板） ──
  let prefPage = await openPreferences();
  await assertExprOn(prefPage, 'pf8e2-no-angular', `!window.angular`);
  await assertExprOn(prefPage, 'pf8e2-shell-rendered', `(() => {
    const layout = document.querySelector('.preferences-layout');
    const items = document.querySelectorAll('.sidebar-items .sidebar-item');
    const separators = document.querySelectorAll('.sidebar-items .separator');
    const header = document.querySelector('.container .header .panel-title');
    const footer = document.querySelector('.content .footer .button-primary');
    return !!layout && items.length === 10 && separators.length === 3
      && !!header && !!footer && header.textContent.length > 0
      && header.textContent !== 'preferencesWindow.sidebar.general';
  })()`);
  await assertExprOn(prefPage, 'pf8e2-init-state', `(() => {
    const s = window.__eaglePreferencesState;
    return !!s && s.ready === true && !!s.registration;
  })()`);
  await assertExprOn(prefPage, 'pf8e2-body-attrs', `(() => {
    const scope = window.__eagleControllerScope;
    return document.body.getAttribute('theme') === 'dark'
      && document.body.getAttribute('platform') === 'win32'
      && document.body.className.includes('theme-DARK')
      && document.body.className.includes('win32');
  })()`);
  await assertExprOn(prefPage, 'pf8e2-general-active', `(() => {
    const items = document.querySelectorAll('.sidebar-items .sidebar-item');
    return items[0].classList.contains('active')
      && !items[2].classList.contains('active')
      && !!document.querySelector('${PANELS} .panel-content');
  })()`);

  // ── React sidebar 切换 ──
  await evalOn(prefPage, `(() => {
    document.querySelectorAll('.sidebar-items .sidebar-item')[2].click();
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8e2-switch-panel', `(() => {
    const scope = window.__eagleControllerScope;
    const items = document.querySelectorAll('.sidebar-items .sidebar-item');
    const title = document.querySelector('.container .header .panel-title');
    return scope.currentPanel.name === 'control'
      && items[2].classList.contains('active') && !items[0].classList.contains('active')
      && localStorage['eagle.preference.lastPanel'] === 'control'
      && title.textContent === scope.currentPanel.i18n;
  })()`);

  // ── 窗内搜索（shell 渲染的 #sidebar-search） ──
  await evalOn(prefPage, `(() => {
    const input = document.getElementById('sidebar-search');
    input.focus();
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'theme');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8e2-search-switch-filter', `(() => {
    const scope = window.__eagleControllerScope;
    const byKw = (pfx) => document.querySelector('${PANELS} .panel-block[search-keywords^="' + pfx + '"]');
    return scope.currentPanel.name === 'search' && scope.keyword === 'theme'
      && byKw('general badge').style.display === 'block'
      && byKw('control mouse').style.display === 'none';
  })()`);

  await evalOn(prefPage, `(() => {
    const input = document.getElementById('sidebar-search');
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'zzzqqq');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8e2-search-empty-state', `(() => {
    const scope = window.__eagleControllerScope;
    const empty = document.querySelector('.content .panel-empty');
    const blocks = document.querySelectorAll('${PANELS} .panel-block');
    const allHidden = [...blocks].every((el) => el.style.display === 'none');
    return scope.showSearchEmpty === true && !!empty && allHidden;
  })()`);

  await evalOn(prefPage, `(() => {
    const input = document.getElementById('sidebar-search');
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8e2-search-exit-to-lastpanel', `(() => {
    const scope = window.__eagleControllerScope;
    const empty = document.querySelector('.content .panel-empty');
    return scope.currentPanel.name === 'control' && !empty && !scope.showSearchEmpty;
  })()`);

  // ── 主题点击 → body 联动 ──
  await evalOn(prefPage, `(() => {
    document.querySelectorAll('.sidebar-items .sidebar-item')[0].click();
    return true;
  })()`);
  await evalOn(prefPage, `(() => {
    document.querySelector('${PANELS} .theme.blue').click();
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8e2-theme-body-link', `(() => {
    const scope = window.__eagleControllerScope;
    return scope.preferences.theme.name === 'BLUE'
      && scope.currentTheme.name === 'BLUE'
      && document.body.getAttribute('theme') === 'blue';
  })()`);

  await delay(500);
  try {
    const screenshot = await Promise.race([
      prefPage.send('Page.captureScreenshot', { format: 'png' }),
      delay(5000).then(() => { throw new Error('screenshot timeout'); }),
    ]);
    fs.mkdirSync('test-run', { recursive: true });
    fs.writeFileSync('test-run/react-stage8e2-shell.png', Buffer.from(screenshot.data, 'base64'));
    console.log('PASS screenshot-saved test-run/react-stage8e2-shell.png');
  } catch (err) {
    console.log(`WARN screenshot failed: ${err.message}`);
  }

  // ── {keyword:'theme'} 重开 → init focusSearch + 输入框 value 同步 ──
  prefPage = await openPreferences({ keyword: 'theme' });
  await assertExprOn(prefPage, 'pf8e2-reopen-search-focus', `(() => {
    const scope = window.__eagleControllerScope;
    const input = document.getElementById('sidebar-search');
    return scope.currentPanel.name === 'search' && scope.keyword === 'theme'
      && input.value === 'theme'
      && document.activeElement && document.activeElement.id === 'sidebar-search';
  })()`);

  // ── privacy 开关时序 + React 密码弹窗 ──
  prefPage = await openPreferences({ panel: 'privacy' });
  await assertExprOn(prefPage, 'pf8e2-privacy-initial', `(() => {
    const scope = window.__eagleControllerScope;
    const blockContent = document.querySelector('${PANELS} .block-content');
    return scope.currentPanel.name === 'privacy'
      && scope.preferences.privacy.enable === 'false'
      && blockContent.classList.contains('disable');
  })()`);

  await evalOn(prefPage, `(() => {
    document.querySelector('${PANELS} label.toggle input').click();
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8e2-privacy-toggle-no-modal', `(() => {
    const scope = window.__eagleControllerScope;
    // 原版怪癖：ng-click 先于 ng-model change → 首次切换不弹窗
    return scope.preferences.privacy.enable === 'true' && !scope.password.isOpen
      && !document.querySelector('.folder-password-modal');
  })()`);

  await evalOn(prefPage, `(() => {
    document.querySelectorAll('${PANELS} .list-item')[0].click();
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8e2-password-modal-focus', `(() => {
    const scope = window.__eagleControllerScope;
    const modal = document.querySelector('.folder-password-modal');
    return scope.password.isOpen && scope.password.mode === 'change'
      && !!modal && modal.classList.contains('open')
      && document.activeElement && document.activeElement.id === 'change-folder-password-input';
  })()`);

  await evalOn(prefPage, `(() => {
    document.querySelector('.folder-password-modal .close').click();
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8e2-password-modal-close', `(() => {
    const scope = window.__eagleControllerScope;
    return !scope.password.isOpen && !document.querySelector('.folder-password-modal');
  })()`);

  // ── apply 数据面（ipc spy） ──
  await evalOn(prefPage, `(() => {
    window.__prefsSent = [];
    const ipc = window.electron.ipcRenderer;
    const orig = ipc.send;
    ipc.send = function (channel) {
      window.__prefsSent.push(channel);
      return orig.apply(this, arguments);
    };
    [...document.querySelectorAll('.content .footer .button')].find((el) => el.textContent !== document.querySelector('.content .footer .button-primary').textContent).click();
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8e2-apply-dataplane', `(() => {
    return window.__prefsSent.includes('chnage-preferences') && window.__prefsSent.includes('electron-info');
  })()`);

  // ── Esc（w-mousetrap 等价）→ cancel → 窗口关闭 ──
  await evalOn(prefPage, `(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return true;
  })()`);
  await waitFor(async () => await preferencesTargetGone(), 'preferences closed by Esc', 15000).then(
    () => console.log('PASS pf8e2-esc-closes-window'),
    () => {
      console.log('FAIL pf8e2-esc-closes-window');
      failures.push('pf8e2-esc-closes-window');
    }
  );

  if (failures.length > 0) {
    console.error(`\nSTAGE8E2 SMOKE FAILED: ${failures.length} assertion(s): ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nSTAGE8E2 SMOKE OK');
  }
} catch (err) {
  console.error('SMOKE ERROR:', err && err.stack || err);
  process.exitCode = 1;
} finally {
  await stop(stack).catch(() => {});
  try { process.exit(process.exitCode || 0); } catch (err) {}
}
