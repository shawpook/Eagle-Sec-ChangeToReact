/**
 * React 化改造 —— 阶段8d闭环测试（偏好窗口 shortcuts 面板接管）。
 *
 * 运行：node tests/react-stage8d-smoke.mjs
 * 断言点：
 *  1. open.preferences {panel:'shortcuts'} → React 渲染分组表（7 组 keybindGroups）+ 插件块隐藏
 *     （mock pluginModule.plugins 空）+ restore 区可见；旧 Angular 块已删
 *  2. 快捷键输入框等价（shortcutInput 指令）：初始值格式化显示（CmdOrCtrl→Ctrl 由原版
 *     formatShortcut 完成）+ shortcut-valid class + shortcut-error/conflict-tip 兄弟元素
 *  3. 键入捕获数据面：file.create.new 上 ctrl+shift+R → keybinds 写 'Ctrl + Shift + R'
 *  4. 冲突路径：ctrl+alt+E（撞 global.capture.area，同为 'all' 冲突组）→ 模型不变 + 冲突提示
 *     显示（shortcuts.conflict.usedBy 译文）→ 1.5s 后复位
 *  5. restore 按钮接线（scope.restoreDefaultShortcuts spy；mock 确认框固定 response 0 → 不重置）
 *  6. #shortcut-input 接管：'capture' 过滤分组（updateKeybinds 等价）/'zzzz' → 0 组 + restore 区
 *     隐藏/清空恢复；截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay, connect } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage8d-'));
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
      await post('/api/library/create', { name: 'React Stage8d Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#10b981' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's8d.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's8d.png')] });
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

  // ── 开窗（panel=shortcuts 直达） ──
  let prefPage = await openPreferences({ panel: 'shortcuts' });
  await assertExprOn(prefPage, 'pf8d-shortcuts-panel-init', `(() => {
    const scope = window.angular.element(document.body).scope();
    return !!scope && !!scope.preferences && scope.currentPanel.name === 'shortcuts'
      && !!window.ShortcutManager && Array.isArray(scope.keybindGroups);
  })()`);
  await assertExprOn(prefPage, 'pf8d-old-blocks-removed', `(() => {
    const content = document.querySelector('.content');
    return !!content && content.querySelectorAll(':scope > .panel-content').length === 0;
  })()`);
  await assertExprOn(prefPage, 'pf8d-groups-rendered', `(() => {
    const anchor = document.querySelector('${PANELS}');
    const panels = anchor.querySelectorAll(':scope > .panel-content');
    const blocks = anchor.querySelectorAll(':scope > .panel-content > .panel-block');
    const inputs = anchor.querySelectorAll('input.shortcut-input');
    const restore = anchor.querySelector('.restore-defaults-section');
    const pluginBlock = [...anchor.querySelectorAll('.panel-block')]
      .find((el) => el.getAttribute('search-keywords') === 'shortcuts plugin');
    return panels.length === 1 && blocks.length === 11 && inputs.length > 40
      && !!restore && pluginBlock && pluginBlock.style.display === 'none';
  })()`);
  await assertExprOn(prefPage, 'pf8d-known-row-value', `(() => {
    const anchor = document.querySelector('${PANELS}');
    // global.capture.area 默认 'CmdOrCtrl + Alt + E' → 原版 formatShortcut（win32 → 'Ctrl + Alt + E'）
    const input = [...anchor.querySelectorAll('input.shortcut-input')]
      .find((el) => el.value === 'Ctrl + Alt + E');
    return !!input && input.classList.contains('shortcut-valid')
      && !!input.closest('.shortcut-input-container').querySelector('.shortcut-error')
      && !!input.closest('.shortcut-input-container').querySelector('.shortcut-conflict-tip');
  })()`);

  // ── 键入捕获：file.create.new（默认 Ctrl + N）→ ctrl+shift+R ──
  await evalOn(prefPage, `(() => {
    const anchor = document.querySelector('${PANELS}');
    const input = [...anchor.querySelectorAll('input.shortcut-input')]
      .find((el) => el.value === 'Ctrl + N');
    if (!input) return 'no-input';
    input.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true, cancelable: true, code: 'KeyA', ctrlKey: true, shiftKey: true,
    }));
    return 'ok';
  })()`);
  await assertExprOn(prefPage, 'pf8d-key-capture-dataplane', `(() => {
    const scope = window.angular.element(document.body).scope();
    const anchor = document.querySelector('${PANELS}');
    const input = [...anchor.querySelectorAll('input.shortcut-input')]
      .find((el) => el.value === 'Ctrl + Shift + A');
    return scope.preferences.shortcuts.keybinds['file.create.new'] === 'Ctrl + Shift + A' && !!input;
  })()`);

  // ── 冲突路径：ctrl+alt+E 撞 global.capture.area（'Ctrl + Alt + E'，同 'all' 冲突组） ──
  await evalOn(prefPage, `(() => {
    const anchor = document.querySelector('${PANELS}');
    const input = [...anchor.querySelectorAll('input.shortcut-input')]
      .find((el) => el.value === 'Ctrl + Shift + A');
    if (!input) return 'no-input';
    input.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true, cancelable: true, code: 'KeyE', ctrlKey: true, altKey: true,
    }));
    return 'ok';
  })()`);
  await assertExprOn(prefPage, 'pf8d-conflict-keeps-model', `(() => {
    const scope = window.angular.element(document.body).scope();
    const anchor = document.querySelector('${PANELS}');
    const input = [...anchor.querySelectorAll('input.shortcut-input')]
      .find((el) => el.value === 'Ctrl + Shift + A');
    const tip = input && input.closest('.shortcut-input-container').querySelector('.shortcut-conflict-tip');
    return scope.preferences.shortcuts.keybinds['file.create.new'] === 'Ctrl + Shift + A'
      && !!tip && tip.style.display !== 'none' && tip.textContent.length > 0
      && input.classList.contains('shortcut-conflict');
  })()`);
  await assertExprOn(prefPage, 'pf8d-conflict-auto-clear', `(() => {
    const anchor = document.querySelector('${PANELS}');
    const input = [...anchor.querySelectorAll('input.shortcut-input')]
      .find((el) => el.value === 'Ctrl + Shift + A');
    const tip = input && input.closest('.shortcut-input-container').querySelector('.shortcut-conflict-tip');
    return !!tip && tip.style.display === 'none' && input.classList.contains('shortcut-valid');
  })()`, 8000);

  // ── restore 按钮接线（mock 确认框 response 0 → 不重置，仅验证 ng-click 等价） ──
  await evalOn(prefPage, `(() => {
    const scope = window.angular.element(document.body).scope();
    window.__restoreSpy = { called: 0 };
    const orig = scope.restoreDefaultShortcuts;
    scope.restoreDefaultShortcuts = function () {
      window.__restoreSpy.called++;
      return orig.apply(this, arguments);
    };
    document.querySelector('${PANELS} .restore-defaults-section .button').click();
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8d-restore-wiring', `window.__restoreSpy && window.__restoreSpy.called === 1`);

  // ── #shortcut-input 搜索过滤（updateKeybinds 等价） ──
  await evalOn(prefPage, `(() => {
    const input = document.getElementById('shortcut-input');
    input.value = 'capture';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8d-search-filters-groups', `(() => {
    const anchor = document.querySelector('${PANELS}');
    const blocks = anchor.querySelectorAll(':scope > .panel-content > .panel-block');
    const restore = anchor.querySelector('.restore-defaults-section');
    return blocks.length < 10 && blocks.length > 0 && !!restore
      && [...anchor.querySelectorAll('input.shortcut-input')].some((el) => el.value === 'Ctrl + Alt + E');
  })()`);

  await evalOn(prefPage, `(() => {
    const input = document.getElementById('shortcut-input');
    input.value = 'zzzzqqq';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8d-search-empty-hides-restore', `(() => {
    const anchor = document.querySelector('${PANELS}');
    const blocks = anchor.querySelectorAll(':scope > .panel-content > .panel-block');
    const restore = anchor.querySelector('.restore-defaults-section');
    const pluginBlock = [...blocks].find((el) => el.getAttribute('search-keywords') === 'shortcuts plugin');
    return blocks.length === 1 && !!pluginBlock && pluginBlock.style.display === 'none'
      && !!restore && restore.style.display === 'none';
  })()`);

  await evalOn(prefPage, `(() => {
    const input = document.getElementById('shortcut-input');
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8d-search-clear-restores', `(() => {
    const anchor = document.querySelector('${PANELS}');
    const blocks = anchor.querySelectorAll(':scope > .panel-content > .panel-block');
    return blocks.length === 11 && !!anchor.querySelector('.restore-defaults-section');
  })()`);

  await delay(500);
  try {
    const screenshot = await Promise.race([
      prefPage.send('Page.captureScreenshot', { format: 'png' }),
      delay(5000).then(() => { throw new Error('screenshot timeout'); }),
    ]);
    fs.mkdirSync('test-run', { recursive: true });
    fs.writeFileSync('test-run/react-stage8d-shortcuts.png', Buffer.from(screenshot.data, 'base64'));
    console.log('PASS screenshot-saved test-run/react-stage8d-shortcuts.png');
  } catch (err) {
    console.log(`WARN screenshot failed: ${err.message}`);
  }

  if (failures.length > 0) {
    console.error(`\nSTAGE8D SMOKE FAILED: ${failures.length} assertion(s): ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nSTAGE8D SMOKE OK');
  }
} catch (err) {
  console.error('SMOKE ERROR:', err && err.stack || err);
  process.exitCode = 1;
} finally {
  await stop(stack).catch(() => {});
  try { process.exit(process.exitCode || 0); } catch (err) {}
}
