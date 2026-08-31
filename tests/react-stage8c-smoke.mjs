/**
 * React 化改造 —— 阶段8c闭环测试（偏好窗口 control + habits 面板接管）。
 *
 * 运行：node tests/react-stage8c-smoke.mjs
 * 断言点：
 *  1. control 面板（sidebar-item[2]）：React 渲染 2 panel-block / 13 radio；默认选中
 *     （scrollBehavior=scroll、hoverZoom=on、doubleclick=internal、middleBtn=openNewWindow、
 *     keyspaces=preview）；keyspace preview-native 行 ng-show darwin 等价 display:none（win32）
 *  2. radio 数据面：scrollBehavior→paging、middleBtn→openPluginPanel、keyspace→scroll
 *  3. habits 面板（sidebar-item[3]）：4 panel-block / 3 hover-tip（img src 走 themeAttr+themePath
 *     → /dark/）；默认选中（renderBehavior=non-pixelated、rememberLastZoom=on、defaultRatio=auto、
 *     imageRotateMode=write、transparency=hide、video.hoverPlay/autoPlay/rememberPosition/
 *     loopShortVideo=true、zoomFill=false、gif 两项=off、font.autoTag=true）
 *  4. habits 数据面：renderBehavior→pixelated、gifViewer off→on（ng-true/false-value 'on'/'off'
 *     语义）、video.zoomFill false→true
 *  5. 搜索闭环：keyword 'video' → video 块显示/control 块隐藏；'gif' → gif 块显示/video 块隐藏；
 *     清空 → 回 habits；{keyword:'gif'} 重开（loadURL 重载）→ 过滤 + 截图
 *  6. 旧 Angular 块已删（.content 直接子级无 .panel-content）
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay, connect } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage8c-'));
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
      await post('/api/library/create', { name: 'React Stage8c Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#10b981' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's8c.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's8c.png')] });
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
        return false; // 重载期 evaluate 暂时失败：waitFor 重试
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

  // ── 开窗 → 切 control 面板 ──
  let prefPage = await openPreferences();
  await assertExprOn(prefPage, 'pf8c-controller-ready', `(() => {
    const scope = window.__eagleControllerScope;
    return !!scope && !!scope.preferences && scope.currentPanel.name === 'general';
  })()`);
  await assertExprOn(prefPage, 'pf8c-old-blocks-removed', `(() => {
    const content = document.querySelector('.content');
    return !!content && content.querySelectorAll(':scope > .panel-content').length === 0;
  })()`);

  await evalOn(prefPage, `(() => {
    document.querySelectorAll('.sidebar-items .sidebar-item')[2].click();
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8c-control-panel-switch', `(() => {
    const scope = window.__eagleControllerScope;
    return scope.currentPanel.name === 'control';
  })()`);
  await assertExprOn(prefPage, 'pf8c-control-react-rendered', `(() => {
    const anchor = document.querySelector('${PANELS}');
    const panels = anchor.querySelectorAll(':scope > .panel-content');
    const blocks = anchor.querySelectorAll(':scope > .panel-content > .panel-block');
    const radios = anchor.querySelectorAll('input[type=radio]');
    const checked = (sel) => { const el = anchor.querySelector(sel); return !!el && el.checked; };
    return panels.length === 1 && blocks.length === 2 && radios.length === 13
      && checked('input[name=radio-scroll][value=scroll]')
      && checked('input[name=radio-hoverZoom][value=on]')
      && checked('input[name=radio-doubleclick][value=internal]')
      && checked('input[name=radio-middleBtn][value=openNewWindow]')
      && checked('input[name=radio-keyspace][value=preview]');
  })()`);
  await assertExprOn(prefPage, 'pf8c-keyspace-native-hidden', `(() => {
    // ng-show="platform === 'darwin'"（win32）→ 标签在 DOM 但 display:none
    const item = document.querySelector('${PANELS} input[name=radio-keyspace][value=preview-native]');
    if (!item) return false;
    return item.closest('label').style.display === 'none';
  })()`);

  await evalOn(prefPage, `(() => {
    document.querySelector('${PANELS} input[name=radio-scroll][value=paging]').click();
    document.querySelector('${PANELS} input[name=radio-middleBtn][value=openPluginPanel]').click();
    document.querySelector('${PANELS} input[name=radio-keyspace][value=scroll]').click();
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8c-control-radio-dataplane', `(() => {
    const scope = window.__eagleControllerScope;
    const h = scope.preferences.habits;
    return h.scrollBehavior === 'paging' && h.middleBtn === 'openPluginPanel' && h.keyspace === 'scroll';
  })()`);

  // ── 切 habits 面板 ──
  await evalOn(prefPage, `(() => {
    document.querySelectorAll('.sidebar-items .sidebar-item')[3].click();
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8c-habits-panel-switch', `(() => {
    const scope = window.__eagleControllerScope;
    return scope.currentPanel.name === 'habits';
  })()`);
  await assertExprOn(prefPage, 'pf8c-habits-react-rendered', `(() => {
    const anchor = document.querySelector('${PANELS}');
    const panels = anchor.querySelectorAll(':scope > .panel-content');
    const blocks = anchor.querySelectorAll(':scope > .panel-content > .panel-block');
    const checked = (sel) => { const el = anchor.querySelector(sel); return !!el && el.checked; };
    const blockInputs = (pfx) => [...anchor.querySelectorAll('.panel-block[search-keywords^="' + pfx + '"] .checkbox-item input[type=checkbox]')];
    const video = blockInputs('video movie');
    const gif = blockInputs('gif webp');
    return panels.length === 1 && blocks.length === 4
      && checked('input[name=radio-zoom][value=non-pixelated]')
      && checked('input[name=radio-rememberLastZoom][value=on]')
      && checked('input[name=radio-ratio][value=auto]')
      && checked('input[name=radio-imageRotateMode][value=write]')
      && checked('input[name=radio-transparency][value=hide]')
      && checked('input[name=radio-scroll][value=progress]')
      && video.length === 5 && video[0].checked && !video[1].checked && video[2].checked
      && video[3].checked && video[4].checked
      && gif.length === 2 && !gif[0].checked && !gif[1].checked
      && checked('.panel-block[search-keywords^="font"] input');
  })()`);
  await assertExprOn(prefPage, 'pf8c-hover-tips', `(() => {
    const anchor = document.querySelector('${PANELS}');
    const tips = anchor.querySelectorAll('.hover-tip');
    const icon = anchor.querySelector('.hover-tip > img');
    const thumb = anchor.querySelector('.hover-tip .thumb img');
    const titles = anchor.querySelectorAll('.hover-tip .title');
    return tips.length === 3 && titles.length === 3
      && String(icon.getAttribute('src')).includes('/dark/icons/preferences/ic-hover-tip.svg')
      && String(thumb.getAttribute('src')).includes('/dark/illustrations/preferences/illustration-pixelate.png');
  })()`);

  await evalOn(prefPage, `(() => {
    document.querySelector('${PANELS} input[name=radio-zoom][value=pixelated]').click();
    const gif = document.querySelectorAll('${PANELS} .panel-block[search-keywords^="gif webp"] .checkbox-item input[type=checkbox]');
    gif[1].click();
    const video = document.querySelectorAll('${PANELS} .panel-block[search-keywords^="video movie"] .checkbox-item input[type=checkbox]');
    video[1].click();
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8c-habits-dataplane', `(() => {
    const scope = window.__eagleControllerScope;
    const p = scope.preferences;
    return p.habits.renderBehavior === 'pixelated'
      && p.habits.gifViewer === 'on'
      && p.video.zoomFill === 'true';
  })()`);

  await delay(500);
  try {
    const screenshot = await Promise.race([
      prefPage.send('Page.captureScreenshot', { format: 'png' }),
      delay(5000).then(() => { throw new Error('screenshot timeout'); }),
    ]);
    fs.mkdirSync('test-run', { recursive: true });
    fs.writeFileSync('test-run/react-stage8c-habits.png', Buffer.from(screenshot.data, 'base64'));
    console.log('PASS screenshot-saved test-run/react-stage8c-habits.png');
  } catch (err) {
    console.log(`WARN screenshot failed: ${err.message}`);
  }

  // ── 窗内搜索闭环 ──
  await evalOn(prefPage, `(() => {
    const input = document.getElementById('sidebar-search');
    input.focus();
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'video');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8c-search-video-filter', `(() => {
    const scope = window.__eagleControllerScope;
    const byKw = (pfx) => document.querySelector('${PANELS} .panel-block[search-keywords^="' + pfx + '"]');
    return scope.currentPanel.name === 'search'
      && byKw('video movie').style.display === 'block'
      && byKw('control mouse').style.display === 'none'
      && byKw('view viewer').style.display === 'none'
      && byKw('gif webp').style.display === 'none';
  })()`);

  await evalOn(prefPage, `(() => {
    const input = document.getElementById('sidebar-search');
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'gif');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8c-search-gif-filter', `(() => {
    const byKw = (pfx) => document.querySelector('${PANELS} .panel-block[search-keywords^="' + pfx + '"]');
    return byKw('gif webp').style.display === 'block'
      && byKw('video movie').style.display === 'none'
      && byKw('control keyboard').style.display === 'none';
  })()`);

  await evalOn(prefPage, `(() => {
    const input = document.getElementById('sidebar-search');
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8c-search-exit-to-habits', `(() => {
    const scope = window.__eagleControllerScope;
    const blocks = document.querySelectorAll('${PANELS} .panel-block');
    const noInline = [...blocks].every((el) => el.style.display === '');
    return scope.currentPanel.name === 'habits' && noInline;
  })()`);

  // ── 带 keyword 重开（loadURL 重载）→ search 过滤 ──
  prefPage = await openPreferences({ keyword: 'gif' });
  await assertExprOn(prefPage, 'pf8c-reopen-search-gif', `(() => {
    const scope = window.__eagleControllerScope;
    const byKw = (pfx) => document.querySelector('${PANELS} .panel-block[search-keywords^="' + pfx + '"]');
    const input = document.getElementById('sidebar-search');
    return !!scope && scope.currentPanel.name === 'search' && scope.keyword === 'gif'
      && input.value === 'gif'
      && byKw('gif webp').style.display === 'block'
      && byKw('video movie').style.display === 'none';
  })()`);

  await delay(500);
  try {
    const screenshot = await Promise.race([
      prefPage.send('Page.captureScreenshot', { format: 'png' }),
      delay(5000).then(() => { throw new Error('screenshot timeout'); }),
    ]);
    fs.mkdirSync('test-run', { recursive: true });
    fs.writeFileSync('test-run/react-stage8c-search.png', Buffer.from(screenshot.data, 'base64'));
    console.log('PASS screenshot-saved test-run/react-stage8c-search.png');
  } catch (err) {
    console.log(`WARN screenshot failed: ${err.message}`);
  }

  if (failures.length > 0) {
    console.error(`\nSTAGE8C SMOKE FAILED: ${failures.length} assertion(s): ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nSTAGE8C SMOKE OK');
  }
} catch (err) {
  console.error('SMOKE ERROR:', err && err.stack || err);
  process.exitCode = 1;
} finally {
  await stop(stack).catch(() => {});
  try { process.exit(process.exitCode || 0); } catch (err) {}
}
