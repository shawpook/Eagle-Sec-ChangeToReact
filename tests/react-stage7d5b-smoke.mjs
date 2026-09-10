/**
 * React 化改造 —— 阶段7d-5b收尾闭环测试（pluginCenter）。
 *
 * 运行：node tests/react-stage7d5b-smoke.mjs
 * 断言点：
 *  1. 壳：宿主存在；旧 <plugin-center> 已删除；React 常驻渲染
 *  2. OPEN_PLUGIN_CENTER 广播 → open + isLoading + init（mock 远程加载失败 → 空数据）→
 *     分类 [all, update] + reload 空状态
 *  3. 排序下拉开合；关闭
 *  4. REFRESH_PLUGIN_CENTER 不崩
 *  5. 截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage7d5b-'));
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
      await post('/api/library/create', { name: 'React Stage7d5b Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's7d5b.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's7d5b.png')] });
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
  await assertExpr('pc-host', `!!document.getElementById('eagle-plugin-center-host')`);
  await assertExpr('pc-old-element-gone', `!document.querySelector('plugin-center[class]')`);
  await assertExpr(
    'pc-root-rendered-closed',
    `!!document.querySelector('#eagle-plugin-center-host .modal.plugin-center') && !document.querySelector('#eagle-plugin-center-host .modal.plugin-center.open')`
  );

  // ── OPEN_PLUGIN_CENTER 广播 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.__eagleBus.emit('OPEN_PLUGIN_CENTER');
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr('pc-open', `document.querySelector('#eagle-plugin-center-host .modal.plugin-center').classList.contains('open')`);
  await assertExpr(
    'pc-categories',
    `(() => {
      const c = window.__eaglePluginCenter;
      return c && c.categories.length === 2 && c.categories[0].slug === 'all' && c.categories[1].slug === 'update';
    })()`
  );
  await assertExpr(
    'pc-empty-reload-state',
    `(() => {
      const modal = document.querySelector('#eagle-plugin-center-host .modal.plugin-center');
      const reloadBtn = modal.querySelector('.page.list .empty-state a.button');
      return !!reloadBtn && window.__eaglePluginCenter.resultList.length === 0;
    })()`
  );

  // ── 排序下拉开合 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('#eagle-plugin-center-host .sort-button').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'pc-sort-dropdown-open',
    `(() => {
      const dd = document.querySelector('#eagle-plugin-center-host .sort-dropdown');
      return dd && dd.style.display !== 'none' && dd.querySelectorAll('.sort-option').length === 4;
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      document.body.click();
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(200);
  await assertExpr(
    'pc-sort-dropdown-closed',
    `(() => {
      const dd = document.querySelector('#eagle-plugin-center-host .sort-dropdown');
      return dd && dd.style.display === 'none';
    })()`
  );

  // ── REFRESH_PLUGIN_CENTER 不崩 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.$bodyScope.$root.$broadcast('REFRESH_PLUGIN_CENTER');
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(300);
  await assertExpr('pc-refresh-ok', `!!document.querySelector('#eagle-plugin-center-host .modal.plugin-center.open')`);

  // ── close ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('#eagle-plugin-center-host .right-panel .panel-header .close').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(200);
  await assertExpr('pc-closed', `!document.querySelector('#eagle-plugin-center-host .modal.plugin-center.open')`);

  // ── 截图留档（重新打开） ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.__eagleBus.emit('OPEN_PLUGIN_CENTER');
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(700);
  await screenshotTo('test-run/react-stage7d5b-plugin-center.png', 5000);

  if (failures.length > 0) {
    console.error(`\nSTAGE7D5B SMOKE FAILED: ${failures.length} assertion(s): ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nSTAGE7D5B SMOKE OK');
  }
} catch (err) {
  console.error('SMOKE ERROR:', err && err.stack || err);
  process.exitCode = 1;
} finally {
  await stop(stack).catch(() => {});
  // undici keep-alive socket 会拖住事件循环，测试结果已输出，直接强退
  try { process.exit(process.exitCode || 0); } catch (err) {}
}
