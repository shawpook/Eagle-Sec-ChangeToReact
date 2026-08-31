/**
 * React 化改造 —— 阶段7d-6c闭环测试（进度对话框族第三部分）。
 *
 * 运行：node tests/react-stage7d6c-smoke.mjs
 * 断言点：
 *  1. 壳：3 个 host 存在；旧 <webp-convert-progress>/<fixutil-clean-empty-folder-progress>/
 *     <fixutil-progress> 已删除；12 个 progress host 齐
 *  2. webp：WEBP_CONVERT_START 广播（3 图 2 webp）→ swal → confirm → queue=2 → open (0/2) →
 *     webp.converted ×1 → (1/2) 50% → ×2 → 双清空关闭；re-broadcast + confirm → cancel →
 *     关闭 + 'cancel.webp.convert' spy
 *  3. fixutil：body.fixUtils.isFixing=true + 3/10 → open (3/10) 30% → false 关闭；clean-empty-
 *     folder：isCleaningEmptyFolders=true + 2/4 → open (2/4) 50% → false 关闭；cancel 点击
 *     no-op（body.cancel 不存在，原版怪癖：对话框保持 open）
 *  4. 截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage7d6c-'));
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
      await post('/api/library/create', { name: 'React Stage7d6c Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#f59e0b' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's7d6c.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's7d6c.png')] });
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

  // ── 壳 ──
  await assertExpr('pd6c-hosts', `['eagle-webp-convert-progress-host','eagle-fixutil-clean-empty-folder-progress-host','eagle-fixutil-progress-host'].every(id => !!document.getElementById(id))`);
  await assertExpr(
    'pd6c-old-elements-gone',
    `!document.querySelector('webp-convert-progress') && !document.querySelector('fixutil-clean-empty-folder-progress') && !document.querySelector('fixutil-progress')`
  );
  await assertExpr(
    'pd6c-12-hosts',
    `document.querySelectorAll('div[id$="-progress-host"]').length === 12`
  );

  // ipc spy（cancel.webp.convert）
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.__ipcCalls = [];
      const ipc = window.__eagleIpc || window.electron.ipcRenderer;
      if (!window.__ipcSpyInstalled) {
        const orig = ipc.send.bind(ipc);
        ipc.send = function (channel, ...args) {
          if (['cancel.webp.convert'].indexOf(channel) > -1) {
            window.__ipcCalls.push({ channel, args: [...args] });
          }
          return orig(channel, ...args);
        };
        window.__ipcSpyInstalled = true;
      }
      return true;
    })()`,
    returnByValue: true,
  });

  // ── webp：广播 + swal 确认 + converted 队列 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.$bodyScope.$root.$broadcast('WEBP_CONVERT_START', {
        images: [{ ext: 'webp', id: 'w1' }, { ext: 'webp', id: 'w2' }, { ext: 'jpg', id: 'j1' }],
        format: 'webp',
      });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr('wc-swal-shown', `!!document.querySelector('.swal2-container .swal2-confirm')`, 10000);
  await page.send('Runtime.evaluate', {
    expression: `(() => { document.querySelector('.swal2-container .swal2-confirm').click(); return true; })()`,
    returnByValue: true,
  });
  await assertExpr(
    'wc-open-0-2',
    `(() => {
      const dlg = document.querySelector('#eagle-webp-convert-progress-host .progress-dialog');
      return dlg.classList.contains('open')
        && dlg.querySelector('.message .counter').textContent === '(0/2)'
        && dlg.querySelector('.progressbar .current').style.width === '0%';
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const ipc = window.__eagleIpc || window.electron.ipcRenderer;
      ipc.emit('webp.converted', { id: 'w1' });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'wc-progress-50',
    `(() => {
      const dlg = document.querySelector('#eagle-webp-convert-progress-host .progress-dialog');
      return dlg.querySelector('.message .counter').textContent === '(1/2)'
        && dlg.querySelector('.progressbar .current').style.width === '50%';
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const ipc = window.__eagleIpc || window.electron.ipcRenderer;
      ipc.emit('webp.converted', { id: 'w2' });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'wc-finish-closed',
    `(() => {
      const dlg = document.querySelector('#eagle-webp-convert-progress-host .progress-dialog');
      return !dlg.classList.contains('open') && !dlg.querySelector('.progress-dialog-content');
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.$bodyScope.$root.$broadcast('WEBP_CONVERT_START', {
        images: [{ ext: 'webp', id: 'w3' }],
        format: 'webp',
      });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr('wc-swal-reshown', `!!document.querySelector('.swal2-container .swal2-confirm')`, 10000);
  await page.send('Runtime.evaluate', {
    expression: `(() => { document.querySelector('.swal2-container .swal2-confirm').click(); return true; })()`,
    returnByValue: true,
  });
  await delay(100);
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('#eagle-webp-convert-progress-host .cancel-button').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'wc-cancel-closed',
    `(() => {
      const dlg = document.querySelector('#eagle-webp-convert-progress-host .progress-dialog');
      return !dlg.classList.contains('open') && !dlg.querySelector('.progress-dialog-content');
    })()`
  );
  await assertExpr(
    'wc-cancel-ipc',
    `(window.__ipcCalls || []).some(c => c.channel === 'cancel.webp.convert')`
  );

  // ── fixutil：body.fixUtils 桥接 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const body = window.$bodyScope;
      body.fixUtils.isFixing = true;
      body.fixUtils.fixingCurr = 3;
      body.fixUtils.fixingTotal = 10;
      body.$evalAsync();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'fx-open-3-10',
    `(() => {
      const dlg = document.querySelector('#eagle-fixutil-progress-host .progress-dialog');
      return !!dlg && dlg.classList.contains('open')
        && dlg.querySelector('.message .counter').textContent === '(3/10)'
        && dlg.querySelector('.progressbar .current').style.width === '30%';
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('#eagle-fixutil-progress-host .cancel-button');
      if (btn) btn.click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'fx-cancel-noop-still-open',
    `(() => {
      const dlg = document.querySelector('#eagle-fixutil-progress-host .progress-dialog');
      return !!dlg && dlg.classList.contains('open');
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const body = window.$bodyScope;
      body.fixUtils.isFixing = false;
      body.fixUtils.fixingCurr = 0;
      body.fixUtils.fixingTotal = 0;
      body.$evalAsync();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'fx-closed-dialog-gone',
    `(() => {
      const dlg = document.querySelector('#eagle-fixutil-progress-host .progress-dialog');
      return dlg === null;
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const body = window.$bodyScope;
      body.fixUtils.isCleaningEmptyFolders = true;
      body.fixUtils.currentEmptyfolderRemoved = 2;
      body.fixUtils.emptyFolderRemoved = 4;
      body.$evalAsync();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'fc-open-2-4',
    `(() => {
      const dlg = document.querySelector('#eagle-fixutil-clean-empty-folder-progress-host .progress-dialog');
      return !!dlg && dlg.classList.contains('open')
        && dlg.querySelector('.message .counter').textContent === ' (2/4)'
        && dlg.querySelector('.progressbar .current').style.width === '50%';
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const body = window.$bodyScope;
      body.fixUtils.isCleaningEmptyFolders = false;
      body.fixUtils.currentEmptyfolderRemoved = 0;
      body.fixUtils.emptyFolderRemoved = 0;
      body.$evalAsync();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'fc-closed-dialog-gone',
    `(() => {
      const dlg = document.querySelector('#eagle-fixutil-clean-empty-folder-progress-host .progress-dialog');
      return dlg === null;
    })()`
  );

  await delay(700);
  await screenshotTo('test-run/react-stage7d6c-progress-dialogs.png', 5000);

  if (failures.length > 0) {
    console.error(`\nSTAGE7D6C SMOKE FAILED: ${failures.length} assertion(s): ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nSTAGE7D6C SMOKE OK');
  }
} catch (err) {
  console.error('SMOKE ERROR:', err && err.stack || err);
  process.exitCode = 1;
} finally {
  await stop(stack).catch(() => {});
  try { process.exit(process.exitCode || 0); } catch (err) {}
}
