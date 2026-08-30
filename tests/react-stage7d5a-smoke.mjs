/**
 * React 化改造 —— 阶段7d-5a收尾闭环测试（pluginPanel + pluginCreator）。
 *
 * 运行：node tests/react-stage7d5a-smoke.mjs
 * 断言点：
 *  1. 壳：两个宿主存在；旧 <plugin-panel>/<plugin-creator> 已删除；React 常驻渲染
 *  2. OPEN_PLUGIN_PANEL 广播 → open + mock 环境空插件列表 + 空状态插画 + 功能列表
 *  3. Tab 切换（typeFilter 持久化 localStorage eagle.pluginPanel.type）
 *  4. Esc 关闭（搜索输入 keyup 委托）
 *  5. OPEN_PLUGIN_CREATOR 广播 → 弹窗开 + 名称聚焦 + 类型选择 + 关闭
 *  6. 截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage7d5a-'));
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
      await post('/api/library/create', { name: 'React Stage7d5a Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's7d5a.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's7d5a.png')] });
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

  const evalNow = async (expression) => (await waitExpr(expression)).result.value;

  // ── 壳 ──
  await assertExpr(
    'pf-hosts',
    `!!document.getElementById('eagle-plugin-panel-host') && !!document.getElementById('eagle-plugin-creator-host')`
  );
  await assertExpr(
    'pf-old-elements-gone',
    `!document.querySelector('plugin-panel[theme]') && !document.querySelector('plugin-creator[class]')`
  );
  await assertExpr(
    'pf-roots-rendered',
    `!!document.querySelector('#eagle-plugin-panel-host #plugin-panel.plugin-panel') && !document.querySelector('#eagle-plugin-panel-host #plugin-panel.open')`
  );

  // ── OPEN_PLUGIN_PANEL 广播 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.$bodyScope.$root.$broadcast('OPEN_PLUGIN_PANEL');
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr('pp-open', `document.querySelector('#eagle-plugin-panel-host #plugin-panel').classList.contains('open')`);
  // mock 环境无插件 → 空状态插画 + 功能列表（install/developer）
  await assertExpr(
    'pp-empty-state',
    `(() => {
      const panel = document.querySelector('#eagle-plugin-panel-host #plugin-panel');
      const empties = Array.from(panel.querySelectorAll('.plugin-container.empty .empty')).filter((el) => el.style.display !== 'none');
      return empties.length === 1 && empties[0].textContent.includes(window.__eagleI18nCheck || '');
    })() || (window.__eaglePluginPanel.listItems.length === 0 && !!document.querySelector('#eagle-plugin-panel-host .fucntion-list'))`
  );
  await assertExpr(
    'pp-function-list',
    `(() => {
      const panel = document.querySelector('#eagle-plugin-panel-host #plugin-panel');
      const items = panel.querySelectorAll('.fucntion-list .function-item');
      return items.length === 2;
    })()`
  );

  // ── Tab 切换（typeFilter 持久化） ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const tabs = document.querySelectorAll('#eagle-plugin-panel-host .tabs .tab');
      tabs[4].click();
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(150);
  await assertExpr(
    'pp-tab-switch',
    `(() => {
      const tabs = document.querySelectorAll('#eagle-plugin-panel-host .tabs .tab');
      return tabs[4].classList.contains('active') && window.__eaglePluginPanel.typeFilter === 'development' && localStorage.getItem('eagle.pluginPanel.type') === 'development';
    })()`
  );

  // ── Esc 关闭（搜索输入 keyup） ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.getElementById('plugin-panel-search');
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'x', keyCode: 27, which: 27, bubbles: true }));
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(200);
  await assertExpr('pp-esc-closed', `!document.querySelector('#eagle-plugin-panel-host #plugin-panel').classList.contains('open')`);

  // ── OPEN_PLUGIN_CREATOR ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.$bodyScope.$root.$broadcast('OPEN_PLUGIN_CREATOR');
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr('pc-open', `!!document.querySelector('#eagle-plugin-creator-host .plugin-creator.open')`);
  await assertExpr('pc-name-focused', `document.activeElement && document.activeElement.tagName === 'INPUT'`);
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const types = document.querySelectorAll('#eagle-plugin-creator-host .plugin-type');
      types[2].click();
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(150);
  await assertExpr(
    'pc-type-checked',
    `(() => {
      const types = document.querySelectorAll('#eagle-plugin-creator-host .plugin-type');
      return types[2].classList.contains('checked') && !types[0].classList.contains('checked');
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('#eagle-plugin-creator-host .textAlign-right .button-grey').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(200);
  await assertExpr('pc-closed', `!document.querySelector('#eagle-plugin-creator-host .plugin-creator.open')`);

  // ── 截图留档 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.$bodyScope.$root.$broadcast('OPEN_PLUGIN_PANEL');
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(500);
  await screenshotTo('test-run/react-stage7d5a-plugin-panel.png', 5000);

  if (failures.length > 0) {
    console.error(`\nSTAGE7D5A SMOKE FAILED: ${failures.length} assertion(s): ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nSTAGE7D5A SMOKE OK');
  }
} catch (err) {
  console.error('SMOKE ERROR:', err && err.stack || err);
  process.exitCode = 1;
} finally {
  await stop(stack).catch(() => {});
  // undici keep-alive socket 会拖住事件循环，测试结果已输出，直接强退
  try { process.exit(process.exitCode || 0); } catch (err) {}
}
