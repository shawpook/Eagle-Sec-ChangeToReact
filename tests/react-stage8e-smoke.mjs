/**
 * React 化改造 —— 阶段8e闭环测试（偏好窗口最后五面板接管）。
 *
 * 运行：node tests/react-stage8e-smoke.mjs
 * 断言点：
 *  1. notification：2 块 + toggle 开关（'true'/'false' 字符串）；音效区块 ng-if 显隐随开关；
 *     弹窗区块反式 ng-if（!== 'false'）逐字；子 checkbox 数据面
 *  2. screencapture：format webp → 品质行/分隔线出现（ng-show）；quality 80 数据面；
 *     shortcutsEnable 关 → 表格隐藏 + 3 个 capture ShortcutInput disabled；
 *     global.capture.window 键入捕获（Ctrl + Alt + W 无冲突）
 *  3. privacy：enable false → disable class；toggle → 模型 'true' + Angular 密码弹窗出现
 *     （SET-APP-PASSWORD 跨系统）+ enable 区块（change/lock 行）出现；弹窗 cancel → 'false' 复原
 *  4. autoImport：disable class；数据面直写 enable+path → choose/reveal 行出现 + tippy 属性带 path
 *  5. developer：regenerateApiToken → token 非空 + 链接 href 同步；copy 接线 spy
 *  6. {keyword:'screenshot'} 重开 → screencapture 块显示/notification 等块隐藏；旧块已删；截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay, connect } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage8e-'));
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
      await post('/api/library/create', { name: 'React Stage8e Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#10b981' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's8e.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's8e.png')] });
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

  // ── notification ──
  let prefPage = await openPreferences({ panel: 'notification' });
  await assertExprOn(prefPage, 'pf8e-notification-rendered', `(() => {
    const scope = window.angular.element(document.body).scope();
    const anchor = document.querySelector('${PANELS}');
    const blocks = anchor.querySelectorAll(':scope > .panel-content > .panel-block');
    const toggles = anchor.querySelectorAll('label.toggle input[type=checkbox]');
    return !!scope && !!scope.preferences && scope.currentPanel.name === 'notification'
      && anchor.querySelectorAll(':scope > .panel-content').length === 1 && blocks.length === 2
      && toggles.length === 2 && toggles[0].checked && toggles[1].checked;
  })()`);
  await assertExprOn(prefPage, 'pf8e-notification-ngif-sections', `(() => {
    const anchor = document.querySelector('${PANELS}');
    const style = document.querySelector('${PANELS} .block-content');
    const subItems = anchor.querySelectorAll('.checkbox-items .checkbox-item input');
    const popupItems = [...anchor.querySelectorAll('.block-content')][1].querySelectorAll('.checkbox-item input');
    return style && !style.matches('.disable')
      && subItems.length === 4 && subItems[0].checked
      && popupItems.length === 4 && popupItems[2].checked;
  })()`);

  await evalOn(prefPage, `(() => {
    document.querySelector('${PANELS} label.toggle input').click();
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8e-notification-toggle-dataplane', `(() => {
    const scope = window.angular.element(document.body).scope();
    const anchor = document.querySelector('${PANELS}');
    const firstBlock = anchor.querySelector('.block-content');
    const toggle = firstBlock.querySelector('label.toggle input');
    // ng-if：音效关闭 → 子区块从 DOM 消失
    return scope.preferences.notification.soundEffect.enable === 'false'
      && !toggle.checked && firstBlock.querySelectorAll('.checkbox-items').length === 0;
  })()`);

  // ── screencapture ──
  prefPage = await openPreferences({ panel: 'screencapture' });
  await assertExprOn(prefPage, 'pf8e-screencapture-rendered', `(() => {
    const scope = window.angular.element(document.body).scope();
    const anchor = document.querySelector('${PANELS}');
    const blocks = anchor.querySelectorAll(':scope > .panel-content > .panel-block');
    const qualityRow = anchor.querySelector('input[name=radio-quality]').closest('.label-item');
    const qualityRowHidden = qualityRow && qualityRow.style.display === 'none';
    return !!scope && scope.currentPanel.name === 'screencapture' && blocks.length === 3
      && qualityRowHidden
      && anchor.querySelector('input[name=radio-scroll][value=png]').checked;
  })()`);

  await evalOn(prefPage, `(() => {
    document.querySelector('${PANELS} input[name=radio-scroll][value=webp]').click();
    document.querySelector('${PANELS} input[name=radio-quality][value="80"]').click();
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8e-format-quality-dataplane', `(() => {
    const scope = window.angular.element(document.body).scope();
    const anchor = document.querySelector('${PANELS}');
    const qualityRow = anchor.querySelector('input[name=radio-quality]').closest('.label-item');
    return scope.preferences.screencapture.format === 'webp'
      && scope.preferences.screencapture.quality === '80'
      && !!qualityRow && qualityRow.style.display !== 'none'
      && anchor.querySelector('input[name=radio-quality][value="80"]').checked;
  })()`);

  await evalOn(prefPage, `(() => {
    const anchor = document.querySelector('${PANELS}');
    const input = [...anchor.querySelectorAll('input.shortcut-input')].find((el) => el.value === '');
    if (!input) return 'no-input';
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code: 'KeyW', ctrlKey: true, altKey: true }));
    return 'ok';
  })()`);
  await assertExprOn(prefPage, 'pf8e-capture-window-dataplane', `(() => {
    const scope = window.angular.element(document.body).scope();
    return scope.preferences.shortcuts.keybinds['global.capture.window'] === 'Ctrl + Alt + W';
  })()`);

  await evalOn(prefPage, `(() => {
    document.querySelector('${PANELS} label.toggle input').click();
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8e-capture-disable', `(() => {
    const scope = window.angular.element(document.body).scope();
    const anchor = document.querySelector('${PANELS}');
    const table = anchor.querySelector('.shortcut-table');
    const disabledInputs = [...anchor.querySelectorAll('input.shortcut-input')].filter((el) => el.disabled);
    return scope.preferences.screencapture.shortcutsEnable === 'false'
      && table.style.display === 'none' && disabledInputs.length === 3;
  })()`);

  // ── privacy（含跨系统密码弹窗） ──
  prefPage = await openPreferences({ panel: 'privacy' });
  await assertExprOn(prefPage, 'pf8e-privacy-initial', `(() => {
    const scope = window.angular.element(document.body).scope();
    const anchor = document.querySelector('${PANELS}');
    const blockContent = anchor.querySelector('.block-content');
    return !!scope && scope.currentPanel.name === 'privacy'
      && scope.preferences.privacy.enable === 'false'
      && blockContent.classList.contains('disable')
      && blockContent.querySelectorAll('.list-item').length === 0;
  })()`);

  await evalOn(prefPage, `(() => {
    document.querySelector('${PANELS} label.toggle input').click();
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8e-privacy-toggle-no-modal', `(() => {
    const scope = window.angular.element(document.body).scope();
    const anchor = document.querySelector('${PANELS}');
    const blockContent = anchor.querySelector('.block-content');
    const modal = document.querySelector('.folder-password-modal');
    // 原版怪癖：ng-click 先于 ng-model change 触发 → 首次切换时 enable 仍为 'false'，
    // openPasswordModal 走 chnage-preferences 分支，不弹窗；模型随后写 'true'
    return scope.preferences.privacy.enable === 'true'
      && !blockContent.classList.contains('disable')
      && blockContent.querySelectorAll('.list-item').length === 2
      && !modal;
  })()`);

  await evalOn(prefPage, `(() => {
    const rows = document.querySelectorAll('${PANELS} .list-item');
    rows[0].click();
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8e-privacy-change-modal', `(() => {
    const modal = document.querySelector('.folder-password-modal');
    const changePwdInput = document.getElementById('change-folder-password-input');
    // change 行 → SET-APP-PASSWORD 广播 → Angular PasswordController 弹窗（mode=change）
    return !!modal && modal.classList.contains('open') && !!changePwdInput;
  })()`);

  await evalOn(prefPage, `(() => {
    const close = document.querySelector('.folder-password-modal .close');
    close.click();
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8e-privacy-modal-close', `(() => {
    const scope = window.angular.element(document.body).scope();
    const modal = document.querySelector('.folder-password-modal');
    // change 模式 cancel 不回写 enable
    return scope.preferences.privacy.enable === 'true' && !modal;
  })()`);

  // ── autoImport（数据面直写驱动渲染） ──
  prefPage = await openPreferences({ panel: 'autoImport' });
  await assertExprOn(prefPage, 'pf8e-autoimport-initial', `(() => {
    const scope = window.angular.element(document.body).scope();
    const anchor = document.querySelector('${PANELS}');
    const blockContent = anchor.querySelector('.block-content');
    return !!scope && scope.currentPanel.name === 'autoImport'
      && scope.preferences.autoImport.enable === 'false'
      && blockContent.classList.contains('disable');
  })()`);

  await evalOn(prefPage, `(() => {
    const s = window.angular.element(document.body).scope();
    s.$apply(() => {
      s.preferences.autoImport.enable = 'true';
      s.preferences.autoImport.path = 'C:/watch-folder';
    });
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8e-autoimport-section', `(() => {
    const anchor = document.querySelector('${PANELS}');
    const blockContent = anchor.querySelector('.block-content');
    const items = blockContent.querySelectorAll('.list-item');
    const value = blockContent.querySelector('.list-item .right .value');
    const right = blockContent.querySelector('.list-item .right');
    return !blockContent.classList.contains('disable') && items.length === 2
      && value.textContent === 'C:/watch-folder'
      && right.getAttribute('tippy-content') === 'C:/watch-folder';
  })()`);

  // ── developer（轮询断言内带守卫点击：等 React 渲染后再点） ──
  prefPage = await openPreferences({ panel: 'developer' });
  await assertExprOn(prefPage, 'pf8e-developer-regenerate', `(() => {
    const btn = document.querySelector('${PANELS} .api-token-block .button');
    if (!btn) return false;
    if (!window.__regenClicked) {
      window.__regenClicked = true;
      btn.click();
    }
    const scope = window.angular.element(document.body).scope();
    const token = scope.preferences.developer.apiToken;
    const link = document.querySelector('${PANELS} .api-token-url a');
    return typeof token === 'string' && token.length > 0
      && link.getAttribute('href') === 'http://localhost:41595/?token=' + token
      && link.textContent === 'http://localhost:41595/?token=' + token;
  })()`);
  // copy 接线 + 嵌套 ng-click 双触发：轮询式断言（安装 spy 后点击，copyApiToken 应同步调用 2 次）
  await assertExprOn(prefPage, 'pf8e-developer-copy-wiring', `(() => {
    const btn = document.querySelector('${PANELS} .api-token-block .copy-btn');
    if (!btn) return false;
    const scope = window.angular.element(document.body).scope();
    if (!window.__copySpyInstalled) {
      window.__copySpyInstalled = true;
      window.__copySpy = 0;
      const orig = scope.copyApiToken;
      scope.copyApiToken = function () {
        window.__copySpy++;
        return orig.apply(this, arguments);
      };
      btn.click();
    }
    return window.__copySpy === 2;
  })()`, 8000);

  // ── 搜索过滤 + 截图 ──
  prefPage = await openPreferences({ keyword: 'screenshot' });
  await assertExprOn(prefPage, 'pf8e-search-filter', `(() => {
    const scope = window.angular.element(document.body).scope();
    const byKw = (pfx) => document.querySelector('${PANELS} .panel-block[search-keywords^="' + pfx + '"]');
    return !!scope && scope.currentPanel.name === 'search' && scope.keyword === 'screenshot'
      && byKw('screencapture screenshot').style.display === 'block'
      && byKw('notification sound').style.display === 'none'
      && byKw('app lock').style.display === 'none'
      && byKw('auto import').style.display === 'none'
      && byKw('developer development').style.display === 'none';
  })()`);
  await assertExprOn(prefPage, 'pf8e-all-old-blocks-removed', `(() => {
    const content = document.querySelector('.content');
    return !!content && content.querySelectorAll(':scope > .panel-content').length === 0;
  })()`);

  await delay(500);
  try {
    const screenshot = await Promise.race([
      prefPage.send('Page.captureScreenshot', { format: 'png' }),
      delay(5000).then(() => { throw new Error('screenshot timeout'); }),
    ]);
    fs.mkdirSync('test-run', { recursive: true });
    fs.writeFileSync('test-run/react-stage8e-search.png', Buffer.from(screenshot.data, 'base64'));
    console.log('PASS screenshot-saved test-run/react-stage8e-search.png');
  } catch (err) {
    console.log(`WARN screenshot failed: ${err.message}`);
  }

  if (failures.length > 0) {
    console.error(`\nSTAGE8E SMOKE FAILED: ${failures.length} assertion(s): ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nSTAGE8E SMOKE OK');
  }
} catch (err) {
  console.error('SMOKE ERROR:', err && err.stack || err);
  process.exitCode = 1;
} finally {
  await stop(stack).catch(() => {});
  try { process.exit(process.exitCode || 0); } catch (err) {}
}
