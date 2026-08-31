/**
 * React 化改造 —— 阶段8b闭环测试（偏好窗口 general + sidebar 面板接管）。
 *
 * 运行：node tests/react-stage8b-smoke.mjs
 * 断言点：
 *  1. open.preferences（无参）→ general 默认面板：React 面板渲染于 .content 顶部锚点
 *     （旧 Angular 块已删：.content 直接子级无 .panel-content；footer 仍在面板块之后）
 *  2. i18n 通道 pfT：block-title 为译文（非 key）；themes-picker 7 主题 + currentTheme active
 *  3. 交互闭环（数据面）：theme 点击 → scope.currentTheme/preferences.theme + active class；
 *     checkbox → scope.preferences.general.*；launchAtLogin 翻转；language/zoom select →
 *     模型写入 + changes.language 字面量怪癖
 *  4. 窗内搜索闭环：#sidebar-search（React 接管）输入 keyword → currentPanel='search' +
 *     search-show 过滤（appearance block 显示/其余 none）→ 无结果态 Angular panel-empty 出现
 *     （跨系统：showSearchEmpty 统计 .content 内 .panel-content :visible，React 块必须被数到）
 *     → 清空 → 回 general + 复位
 *  5. sidebar 面板：switchPanel 点击 → radio dblclickSidebarItem / sidebar.* checkbox 数据面
 *  6. open.preferences {keyword:'theme'} 重开（loadURL 重载）→ init 透传 + search 过滤 +
 *     输入框 value 同步；截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay, connect } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage8b-'));
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
      await post('/api/library/create', { name: 'React Stage8b Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#10b981' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's8b.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's8b.png')] });
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

  // ── 第一次开窗：无参 → general 默认面板 ──
  let prefPage = await openPreferences();

  await assertExprOn(prefPage, 'pf8b-host', `!!document.getElementById('eagle-preferences-react-host')`);
  await assertExprOn(prefPage, 'pf8b-init-state', `(() => {
    const s = window.__eaglePreferencesState;
    return !!s && s.ready === true && !!s.registration;
  })()`);
  await assertExprOn(prefPage, 'pf8b-angular-general-panel', `(() => {
    const scope = window.angular.element(document.body).scope();
    return !!scope && !!scope.preferences && scope.currentPanel && scope.currentPanel.name === 'general';
  })()`);

  // 旧 Angular 块已删：.content 直接子级无 .panel-content
  await assertExprOn(prefPage, 'pf8b-old-blocks-removed', `(() => {
    const content = document.querySelector('.content');
    return !!content && content.querySelectorAll(':scope > .panel-content').length === 0;
  })()`);
  // React 面板渲染于 .content 顶部锚点（DOM 顺序：锚点面板在 footer 之前）
  await assertExprOn(prefPage, 'pf8b-react-panels-rendered', `(() => {
    const content = document.querySelector('.content');
    const anchor = content && content.querySelector('[data-eagle-react-panels="panels"]');
    if (!anchor) return false;
    const panels = anchor.querySelectorAll(':scope > .panel-content');
    const footer = content.querySelector('.footer');
    if (panels.length !== 1 || !footer) return false;
    // 顺序：锚点（含面板）必须在 footer 之前
    return !!(anchor.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING);
  })()`);
  await assertExprOn(prefPage, 'pf8b-themes-picker', `(() => {
    const anchor = document.querySelector('[data-eagle-react-panels="panels"]');
    const picker = anchor && anchor.querySelector('.themes-picker');
    const active = anchor && anchor.querySelector('.theme.dark.active');
    return !!picker && picker.querySelectorAll('.theme').length === 7 && !!active;
  })()`);
  await assertExprOn(prefPage, 'pf8b-i18n-translated', `(() => {
    const title = document.querySelector('[data-eagle-react-panels="panels"] .block-title');
    const text = title && title.textContent;
    return !!text && text.length > 0 && text !== 'preferencesWindow.general.appearance';
  })()`);

  // ── general 交互闭环（React setState 同任务异步冲刷 → 拆 eval） ──
  await evalOn(prefPage, `(() => {
    document.querySelector('[data-eagle-react-panels="panels"] .theme.blue').click();
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8b-theme-click-dataplane', `(() => {
    const scope = window.angular.element(document.body).scope();
    const active = document.querySelector('[data-eagle-react-panels="panels"] .theme.blue.active');
    return !!scope && scope.currentTheme && scope.currentTheme.name === 'BLUE'
      && scope.preferences.theme && scope.preferences.theme.name === 'BLUE' && !!active;
  })()`);

  await evalOn(prefPage, `(() => {
    const blocks = document.querySelectorAll('[data-eagle-react-panels="panels"] .panel-block');
    blocks[0].querySelector('.checkbox-item input[type=checkbox]').click();
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8b-checkbox-toggle-dataplane', `(() => {
    const scope = window.angular.element(document.body).scope();
    return scope.preferences.general.enableVibrancy === 'false';
  })()`);

  await evalOn(prefPage, `(() => {
    const blocks = document.querySelectorAll('[data-eagle-react-panels="panels"] .panel-block');
    blocks[1].querySelector('.checkbox-item input[type=checkbox]').click();
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8b-launchatlogin-dataplane', `(() => {
    const scope = window.angular.element(document.body).scope();
    return scope.launchAtLogin === 'true';
  })()`);

  await evalOn(prefPage, `(() => {
    const selects = document.querySelectorAll('[data-eagle-react-panels="panels"] select');
    selects[0].value = 'zh_TW';
    selects[0].dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8b-language-dataplane', `(() => {
    const scope = window.angular.element(document.body).scope();
    return scope.preferences.general.language === 'zh_TW'
      && scope.changes.language === 'preferences.general.language';
  })()`);

  await evalOn(prefPage, `(() => {
    const selects = document.querySelectorAll('[data-eagle-react-panels="panels"] select');
    selects[1].value = '150';
    selects[1].dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8b-zoom-dataplane', `(() => {
    const scope = window.angular.element(document.body).scope();
    return scope.preferences.general.zoom === '150';
  })()`);

  await delay(500);
  try {
    const screenshot = await Promise.race([
      prefPage.send('Page.captureScreenshot', { format: 'png' }),
      delay(5000).then(() => { throw new Error('screenshot timeout'); }),
    ]);
    fs.mkdirSync('test-run', { recursive: true });
    fs.writeFileSync('test-run/react-stage8b-general.png', Buffer.from(screenshot.data, 'base64'));
    console.log('PASS screenshot-saved test-run/react-stage8b-general.png');
  } catch (err) {
    console.log(`WARN screenshot failed: ${err.message}`);
  }

  // ── 窗内搜索闭环（#sidebar-search 由 React 接管） ──
  await evalOn(prefPage, `(() => {
    const input = document.getElementById('sidebar-search');
    input.focus();
    input.value = 'theme';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8b-search-switch', `(() => {
    const scope = window.angular.element(document.body).scope();
    return scope.currentPanel.name === 'search' && scope.keyword === 'theme';
  })()`);
  await assertExprOn(prefPage, 'pf8b-search-show-filter', `(() => {
    const byKw = (pfx) => document.querySelector('[data-eagle-react-panels="panels"] .panel-block[search-keywords^="' + pfx + '"]');
    const display = (el) => (el ? el.style.display : null);
    // appearance（keywords 含 theme）显示；launch/collect/sidebar×2 隐藏
    // （按 search-keywords 定位：后续阶段会向搜索模式追加更多面板块，不锁总数）
    return display(byKw('general badge')) === 'block' && display(byKw('general launch')) === 'none'
      && display(byKw('general auto')) === 'none' && display(byKw('sidebar rename')) === 'none'
      && display(byKw('sidebar smart')) === 'none';
  })()`);

  await evalOn(prefPage, `(() => {
    const input = document.getElementById('sidebar-search');
    input.value = 'zzzqqq-no-match';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8b-search-empty-state', `(() => {
    const blocks = document.querySelectorAll('[data-eagle-react-panels="panels"] .panel-block');
    const allHidden = [...blocks].every((el) => el.style.display === 'none');
    // 跨系统数据面：Angular showSearchEmpty 统计 .content .panel-content :visible（含 React 块）
    const empty = document.querySelector('.content .panel-empty');
    return allHidden && !!empty;
  })()`, 25000);

  await evalOn(prefPage, `(() => {
    const input = document.getElementById('sidebar-search');
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8b-search-exit-to-general', `(() => {
    const scope = window.angular.element(document.body).scope();
    const blocks = document.querySelectorAll('[data-eagle-react-panels="panels"] .panel-block');
    const noInline = [...blocks].every((el) => el.style.display === '');
    const empty = document.querySelector('.content .panel-empty');
    return scope.currentPanel.name === 'general' && noInline && !empty;
  })()`);

  // ── sidebar 面板（switchPanel 点击） ──
  await evalOn(prefPage, `(() => {
    const items = document.querySelectorAll('.sidebar-items .sidebar-item');
    items[1].click();
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8b-sidebar-panel-switch', `(() => {
    const scope = window.angular.element(document.body).scope();
    return scope.currentPanel.name === 'sidebar';
  })()`);
  await assertExprOn(prefPage, 'pf8b-sidebar-react-rendered', `(() => {
    const anchor = document.querySelector('[data-eagle-react-panels="panels"]');
    const panels = anchor.querySelectorAll(':scope > .panel-content');
    const radios = anchor.querySelectorAll('input[type=radio]');
    const collapse = anchor.querySelector('input[type=radio][value=collapse]');
    const disabled = anchor.querySelectorAll('.control.checkbox.disable input[checked]');
    return panels.length === 1 && radios.length === 2 && !!collapse && collapse.checked && disabled.length === 3;
  })()`);

  await evalOn(prefPage, `(() => {
    document.querySelector('[data-eagle-react-panels="panels"] input[type=radio][value=rename]').click();
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8b-sidebar-radio-dataplane', `(() => {
    const scope = window.angular.element(document.body).scope();
    const rename = document.querySelector('[data-eagle-react-panels="panels"] input[type=radio][value=rename]');
    return scope.preferences.habits.dblclickSidebarItem === 'rename' && rename.checked;
  })()`);

  await evalOn(prefPage, `(() => {
    const checkboxes = document.querySelectorAll('[data-eagle-react-panels="panels"] .checkbox-item input[type=checkbox]');
    // 第 0/6/7 为静态 disable 项；第 1 个为 unfiled
    checkboxes[1].click();
    return true;
  })()`);
  await assertExprOn(prefPage, 'pf8b-sidebar-unfiled-dataplane', `(() => {
    const scope = window.angular.element(document.body).scope();
    return scope.preferences.sidebar.unfiled === 'false';
  })()`);

  // ── 带keyword重开（loadURL 重载）→ search 过滤 + 输入框 value 同步 ──
  prefPage = await openPreferences({ keyword: 'theme' });
  await assertExprOn(prefPage, 'pf8b-reopen-search-init', `(() => {
    const scope = window.angular.element(document.body).scope();
    const s = window.__eaglePreferencesState;
    return !!scope && scope.currentPanel.name === 'search' && scope.keyword === 'theme'
      && !!s && s.ready === true && s.keyword === 'theme';
  })()`);
  await assertExprOn(prefPage, 'pf8b-reopen-filter-and-input-sync', `(() => {
    const input = document.getElementById('sidebar-search');
    const appearance = document.querySelector('[data-eagle-react-panels="panels"] .panel-block[search-keywords^="general badge"]');
    return input.value === 'theme' && !!appearance && appearance.style.display === 'block';
  })()`);

  await delay(500);
  try {
    const screenshot = await Promise.race([
      prefPage.send('Page.captureScreenshot', { format: 'png' }),
      delay(5000).then(() => { throw new Error('screenshot timeout'); }),
    ]);
    fs.mkdirSync('test-run', { recursive: true });
    fs.writeFileSync('test-run/react-stage8b-search.png', Buffer.from(screenshot.data, 'base64'));
    console.log('PASS screenshot-saved test-run/react-stage8b-search.png');
  } catch (err) {
    console.log(`WARN screenshot failed: ${err.message}`);
  }

  if (failures.length > 0) {
    console.error(`\nSTAGE8B SMOKE FAILED: ${failures.length} assertion(s): ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nSTAGE8B SMOKE OK');
  }
} catch (err) {
  console.error('SMOKE ERROR:', err && err.stack || err);
  process.exitCode = 1;
} finally {
  await stop(stack).catch(() => {});
  try { process.exit(process.exitCode || 0); } catch (err) {}
}
