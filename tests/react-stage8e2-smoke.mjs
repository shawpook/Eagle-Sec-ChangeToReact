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
  const { page, debugPort, vitePort } = stack;

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

  // R5：页面引用的每个 script/link 都必须真实可达。偏好窗的 tippy 曾因「文件已随退役批删除、
  // 脚本标签漏摘」而静默失效（window.tippy 恒 undefined、主题气泡全无），本项即该缺陷类的守卫。
  const assertScriptTagsResolve = async (pageRef, name) => {
    const refs = (await evalOn(pageRef, `(() => {
      return [...document.querySelectorAll('script[src]')].map((el) => el.getAttribute('src'))
        .concat([...document.querySelectorAll('link[href]')].map((el) => el.getAttribute('href')));
    })()`)) || [];
    const base = `http://127.0.0.1:${vitePort}/src/app/preferences.html`;
    const unresolved = [];
    for (const ref of refs) {
      try {
        const response = await fetch(new URL(ref, base).href);
        if (!response.ok) unresolved.push(`${ref} → HTTP ${response.status}`);
      } catch (err) {
        unresolved.push(`${ref} → ${err.message}`);
      }
    }
    const pass = refs.length > 0 && unresolved.length === 0;
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass ? '' : ` (${unresolved.join('; ')})`}`);
    if (!pass) failures.push(name);
    return pass;
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

  // ── 气泡（tippy 供给面行为契约：hover 出现 / 离开隐藏，内容=tippy-content）──
  // R5 纪律：断言**行为等价**而非实现细节——vendor tippy 与自研 tippyLite 均应通过，
  // 替换前后各跑一次即构成「零行为变化」证据。
  await assertScriptTagsResolve(prefPage, 'pf8e2-resources-resolve');
  await assertExprOn(prefPage, 'pf8e2-tippy-provided', `(() => typeof window.tippy === 'function')()`);
  // R5 替换证据：磁盘已无 vendors/tippy.js（b1-9bx-A），标签漏摘曾使上面三项恒 FAIL；
  // 现由 entry 的 installTippy() 供给——#eagle-tippy-css 是 tippyLite 的运行时安装标记。
  await assertExprOn(prefPage, 'pf8e2-tippy-vendor-tag-gone', `(() => {
    return !document.querySelector('script[src*="vendors/tippy"]')
      && !!document.getElementById('eagle-tippy-css');
  })()`);
  await evalOn(prefPage, `(() => {
    const el = document.querySelector('${PANELS} .themes-picker .theme[tippy]');
    window.__tippyTarget = el;
    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8e2-tippy-show', `(() => {
    const el = window.__tippyTarget;
    const box = document.querySelector('body > [data-tippy-root] .tippy-box');
    const content = box && box.querySelector('.tippy-content');
    if (!el || !box || !content) return false;
    return box.getAttribute('data-state') === 'visible'
      && box.getAttribute('data-placement') === 'top'
      && content.innerHTML.length > 0
      && content.innerHTML === el.getAttribute('tippy-content');
  })()`);
  // R5 缺陷回归锚：面板切走再切回后，实例必须绑在**当前**节点上且无 popper 泄漏
  // （修复前该断言与 pf8e2-tippy-show 同因失败：实例挂在已卸载节点、roots 只增不减）。
  await assertExprOn(prefPage, 'pf8e2-tippy-bound-live', `(() => {
    const targets = [...document.querySelectorAll('${PANELS} [tippy][tippy-content]')];
    const roots = document.querySelectorAll('body > [data-tippy-root]');
    return targets.length > 0
      && roots.length === targets.length
      && targets.every((el) => !!el._tippy);
  })()`);
  await evalOn(prefPage, `(() => {
    window.__tippyTarget.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8e2-tippy-hide', `(() => {
    const box = document.querySelector('body > [data-tippy-root] .tippy-box');
    return !!box && box.getAttribute('data-state') === 'hidden';
  })()`);

  // ── 快捷键面板：管理器 API 面 + 编辑写回 + 冲突不写回（ShortcutManager 移植锚）──
  await evalOn(prefPage, `(() => {
    document.querySelectorAll('.sidebar-items .sidebar-item')[5].click();
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8e2-shortcuts-panel', `(() => {
    const scope = window.__eagleControllerScope;
    return scope.currentPanel.name === 'shortcuts'
      && document.querySelectorAll('${PANELS} .shortcut-input').length > 0;
  })()`);
  await assertExprOn(prefPage, 'pf8e2-shortcut-manager-api', `(() => {
    const m = window.ShortcutManager;
    if (!m) return false;
    return m.electronToMousetrap('Ctrl + A') === 'ctrl+a'
      && m.electronToMousetrap('Command + Shift + Z') === 'mod+shift+z'
      && m.validateShortcut('Ctrl + K').valid === true
      && m.validateShortcut('Bogus + K').valid === false
      && m.validateShortcut('Ctrl + F12').valid === true
      && m.formatForDisplay('Ctrl + K') === 'Ctrl + K'
      && Array.isArray(m.getConflicts('Ctrl + K', 'x'));
  })()`);

  const dispatchShortcutKey = `(() => {
    const input = document.querySelector('${PANELS} .shortcut-input');
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'k', code: 'KeyK', ctrlKey: true, bubbles: true, cancelable: true,
    }));
    window.__shortcutInput = input;
    return true;
  })()`;

  // 无冲突分支：写回 preferences.shortcuts.keybinds 并格式化输入框
  await evalOn(prefPage, `(() => {
    const m = window.ShortcutManager;
    window.__origGetConflicts = m.getConflicts;
    m.getConflicts = () => [];
    window.__keybindsBefore = JSON.stringify(window.__eagleControllerScope.preferences.shortcuts.keybinds);
    return true;
  })()`);
  await evalOn(prefPage, dispatchShortcutKey);
  await assertExprOn(prefPage, 'pf8e2-shortcut-writeback', `(() => {
    const keybinds = window.__eagleControllerScope.preferences.shortcuts.keybinds;
    const before = JSON.parse(window.__keybindsBefore);
    const changed = Object.keys(keybinds).filter((k) => keybinds[k] !== before[k]);
    const input = window.__shortcutInput;
    return changed.length === 1
      && keybinds[changed[0]] === 'Ctrl + K'
      && input.value === 'Ctrl + K'
      && input.classList.contains('shortcut-valid');
  })()`);

  // 冲突分支：保持原值、加冲突样式与提示、不写回
  await evalOn(prefPage, `(() => {
    window.ShortcutManager.getConflicts = () => ['edit.remove'];
    window.__keybindsBefore = JSON.stringify(window.__eagleControllerScope.preferences.shortcuts.keybinds);
    return true;
  })()`);
  await evalOn(prefPage, dispatchShortcutKey);
  await assertExprOn(prefPage, 'pf8e2-shortcut-conflict-held', `(() => {
    const keybinds = window.__eagleControllerScope.preferences.shortcuts.keybinds;
    const before = JSON.parse(window.__keybindsBefore);
    const changed = Object.keys(keybinds).filter((k) => keybinds[k] !== before[k]);
    const input = window.__shortcutInput;
    const conflictTip = input.closest('.shortcut-input-container').querySelector('.shortcut-conflict-tip');
    return changed.length === 0
      && input.classList.contains('shortcut-conflict')
      && conflictTip.style.display !== 'none'
      && conflictTip.textContent.length > 0;
  })()`);
  await evalOn(prefPage, `(() => {
    window.ShortcutManager.getConflicts = window.__origGetConflicts;
    return true;
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
