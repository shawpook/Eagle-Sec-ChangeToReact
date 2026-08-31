/**
 * React 化改造 —— 阶段7d-6a闭环测试（进度对话框族第一部分）。
 *
 * 运行：node tests/react-stage7d6a-smoke.mjs
 * 断言点：
 *  1. 壳：5 个 host 存在；旧 <empty-trash-progress>/<library-load-progress>/
 *     <library-merge-progress>/<eaglepack-import-progress>/<eaglepack-export-progress> 已删除
 *  2. empty-trash：body scope 桥接（isCleaningTrash=true → open + counter 37.5% + 进度条宽
 *     37.5%）；cancel → body.cancelEmptyTrash() → 关闭
 *  3. library-load：boot 后关闭态；handler 钩子驱动 app-status-loading → open(library-loading)
 *     → dirs-loaded(100) → metadata-loading×3 → 进度 41% → metadata-loaded → 95% →
 *     library-loaded → 50ms 后关闭
 *  4. library-merge：show-import-library-task(5) → open 0/5 → finish×2 → 2/5 → cancel 关闭 +
 *     ipc 'cancel.all'；close-import-library → 关闭 + swal mergeLibraryDone → confirm → ipc
 *     'reload-app'
 *  5. eaglepack-import：show-extract-task → startMsg（total==0）→ add×3 → doningMsg →
 *     finish×3 → 关闭；re-show + cancel → 关闭 + 'cancel.all'
 *  6. eaglepack-export：show-archive-task → add×2 → update-archive-percent(40) → 进度条 40% →
 *     finish-archive-task → abort → 关闭；re-show + cancel → 'cancel.all'
 *  7. 截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage7d6a-'));
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
      await post('/api/library/create', { name: 'React Stage7d6a Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#7c3aed' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's7d6a.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's7d6a.png')] });
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

  const evalNow = async (expression) => (await waitExpr(expression)).result.value;

  // ── 壳 ──
  await assertExpr('pd-hosts', `['eagle-empty-trash-progress-host','eagle-library-load-progress-host','eagle-library-merge-progress-host','eagle-eaglepack-import-progress-host','eagle-eaglepack-export-progress-host'].every(id => !!document.getElementById(id))`);
  await assertExpr(
    'pd-old-elements-gone',
    `!document.querySelector('empty-trash-progress') && !document.querySelector('library-load-progress') && !document.querySelector('library-merge-progress') && !document.querySelector('eaglepack-import-progress') && !document.querySelector('eaglepack-export-progress')`
  );

  // ── empty-trash：body scope 桥接 ──
  await assertExpr(
    'et-closed-initial',
    `(() => {
      const dlg = document.querySelector('#eagle-empty-trash-progress-host .progress-dialog.library-loading-dialog');
      return !!dlg && !dlg.classList.contains('open') && !dlg.querySelector('.progress-dialog-content');
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const body = window.$bodyScope;
      body.isCleaningTrash = true;
      body.removeProgress = 37.5;
      body.$evalAsync();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr('et-open', `document.querySelector('#eagle-empty-trash-progress-host .progress-dialog.library-loading-dialog').classList.contains('open')`);
  await assertExpr(
    'et-counter',
    `document.querySelector('#eagle-empty-trash-progress-host .message .counter').textContent === '(37.5%)'`
  );
  await assertExpr(
    'et-progressbar-width',
    `document.querySelector('#eagle-empty-trash-progress-host .progressbar .current').style.width === '37.5%'`
  );
  await assertExpr(
    'et-cancel-button',
    `(() => {
      const btn = document.querySelector('#eagle-empty-trash-progress-host .cancel-button.cancel');
      return !!btn && btn.textContent.length > 0;
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.__ipcCalls = [];
      const ipc = window.__eagleIpc || window.electron.ipcRenderer;
      if (!window.__ipcSpyInstalled) {
        const orig = ipc.send.bind(ipc);
        ipc.send = function (channel, ...args) {
          if (['cancel.all', 'reload-app', 'palette-resume'].indexOf(channel) > -1) {
            window.__ipcCalls.push({ channel });
          }
          return orig(channel, ...args);
        };
        window.__ipcSpyInstalled = true;
      }
      document.querySelector('#eagle-empty-trash-progress-host .cancel-button.cancel').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'et-cancel-closed',
    `(() => {
      const dlg = document.querySelector('#eagle-empty-trash-progress-host .progress-dialog.library-loading-dialog');
      return !dlg.classList.contains('open') && !dlg.querySelector('.progress-dialog-content');
    })()`
  );
  await assertExpr(
    'et-cancel-palette-resume',
    `(window.__ipcCalls || []).some(c => c.channel === 'palette-resume')`
  );

  // ── library-load：handler 钩子驱动状态机 ──
  await assertExpr(
    'll-closed-after-boot',
    `(() => {
      const dlg = document.querySelector('#eagle-library-load-progress-host .progress-dialog.library-loading-dialog');
      return !!dlg && !dlg.classList.contains('open') && !dlg.querySelector('.progress-dialog-content');
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => { window.__eagleLibraryLoad['app-status-loading']({}, {}); return true; })()`,
    returnByValue: true,
  });
  await assertExpr(
    'll-open-library-loading',
    `(() => {
      const dlg = document.querySelector('#eagle-library-load-progress-host .progress-dialog.library-loading-dialog');
      return dlg.classList.contains('open') && !!dlg.querySelector('.progress-dialog-content .message');
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => { window.__eagleLibraryLoad['app-status-library-dirs-loaded']({}, 100); return true; })()`,
    returnByValue: true,
  });
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const h = window.__eagleLibraryLoad;
      h['app-status-library-metadata-loading']({}, {});
      h['app-status-library-metadata-loading']({}, {});
      h['app-status-library-metadata-loading']({}, {});
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'll-metadata-progress-41',
    `document.querySelector('#eagle-library-load-progress-host .progressbar .current').style.width === '41%'`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => { window.__eagleLibraryLoad['app-status-library-metadata-loaded']({}, {}); return true; })()`,
    returnByValue: true,
  });
  await assertExpr(
    'll-metadata-progress-95',
    `document.querySelector('#eagle-library-load-progress-host .progressbar .current').style.width === '95%'`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => { window.__eagleLibraryLoad['app-status-library-loaded']({}, {}); return true; })()`,
    returnByValue: true,
  });
  await delay(300);
  await assertExpr(
    'll-closed-after-loaded',
    `(() => {
      const dlg = document.querySelector('#eagle-library-load-progress-host .progress-dialog.library-loading-dialog');
      return !dlg.classList.contains('open') && !dlg.querySelector('.progress-dialog-content');
    })()`
  );

  // ── library-merge：ipc 驱动 + cancel/close-import-library ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const ipc = window.__eagleIpc || window.electron.ipcRenderer;
      ipc.emit('show-import-library-task', 5);
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr('lm-open', `document.querySelector('#eagle-library-merge-progress-host .progress-dialog').classList.contains('open')`);
  await assertExpr(
    'lm-counter-0-5',
    `document.querySelector('#eagle-library-merge-progress-host .message .counter').textContent === '0/5'`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const ipc = window.__eagleIpc || window.electron.ipcRenderer;
      ipc.emit('finish-import-library-task');
      ipc.emit('finish-import-library-task');
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'lm-counter-2-5',
    `document.querySelector('#eagle-library-merge-progress-host .message .counter').textContent === '2/5'`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('#eagle-library-merge-progress-host .cancel-button').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'lm-cancel-closed',
    `(() => {
      const dlg = document.querySelector('#eagle-library-merge-progress-host .progress-dialog');
      return !dlg.classList.contains('open') && !dlg.querySelector('.progress-dialog-content');
    })()`
  );
  await assertExpr(
    'lm-cancel-ipc',
    `(window.__ipcCalls || []).some(c => c.channel === 'cancel.all')`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const ipc = window.__eagleIpc || window.electron.ipcRenderer;
      ipc.emit('show-import-library-task', 5);
      ipc.emit('close-import-library');
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'lm-close-import-closed',
    `(() => {
      const dlg = document.querySelector('#eagle-library-merge-progress-host .progress-dialog');
      return !dlg.classList.contains('open');
    })()`
  );
  await assertExpr('lm-swal-shown', `!!document.querySelector('.swal2-container .swal2-confirm')`, 10000);
  await page.send('Runtime.evaluate', {
    expression: `(() => { document.querySelector('.swal2-container .swal2-confirm').click(); return true; })()`,
    returnByValue: true,
  });
  await assertExpr(
    'lm-reload-app-ipc',
    `(window.__ipcCalls || []).some(c => c.channel === 'reload-app')`
  );

  // ── eaglepack-import ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const ipc = window.__eagleIpc || window.electron.ipcRenderer;
      ipc.emit('show-extract-task');
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'ei-open-startmsg',
    `(() => {
      const dlg = document.querySelector('#eagle-eaglepack-import-progress-host #extract-eaglepack-progress');
      const msgs = dlg.querySelectorAll('.message');
      return dlg.classList.contains('open')
        && msgs[0].style.display !== 'none'
        && msgs[1].style.display === 'none';
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const ipc = window.__eagleIpc || window.electron.ipcRenderer;
      ipc.emit('add-extract-task');
      ipc.emit('add-extract-task');
      ipc.emit('add-extract-task');
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'ei-doningmsg',
    `(() => {
      const msgs = document.querySelectorAll('#eagle-eaglepack-import-progress-host .message');
      return msgs[0].style.display === 'none' && msgs[1].style.display !== 'none';
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const ipc = window.__eagleIpc || window.electron.ipcRenderer;
      ipc.emit('finish-extract-task');
      ipc.emit('finish-extract-task');
      ipc.emit('finish-extract-task');
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'ei-finish-closed',
    `(() => {
      const dlg = document.querySelector('#eagle-eaglepack-import-progress-host #extract-eaglepack-progress');
      return !dlg.classList.contains('open') && !dlg.querySelector('.progress-dialog-content');
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const ipc = window.__eagleIpc || window.electron.ipcRenderer;
      ipc.emit('show-extract-task');
      return true;
    })()`,
    returnByValue: true,
  });
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('#eagle-eaglepack-import-progress-host .cancel-button').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'ei-cancel-closed',
    `(() => {
      const dlg = document.querySelector('#eagle-eaglepack-import-progress-host #extract-eaglepack-progress');
      return !dlg.classList.contains('open') && !dlg.querySelector('.progress-dialog-content');
    })()`
  );

  // ── eaglepack-export ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const ipc = window.__eagleIpc || window.electron.ipcRenderer;
      ipc.emit('show-archive-task');
      ipc.emit('add-archive-task');
      ipc.emit('add-archive-task');
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'ee-open-doningmsg',
    `(() => {
      const dlg = document.querySelector('#eagle-eaglepack-export-progress-host .progress-dialog');
      const msgs = dlg.querySelectorAll('.message');
      return dlg.classList.contains('open') && msgs[0].style.display === 'none' && msgs[1].style.display !== 'none';
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const ipc = window.__eagleIpc || window.electron.ipcRenderer;
      ipc.emit('update-archive-percent', 40);
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'ee-percent-width',
    `document.querySelector('#eagle-eaglepack-export-progress-host .progressbar .current').style.width === '40%'`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const ipc = window.__eagleIpc || window.electron.ipcRenderer;
      ipc.emit('finish-archive-task');
      ipc.emit('abort-archive-task');
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'ee-abort-closed',
    `(() => {
      const dlg = document.querySelector('#eagle-eaglepack-export-progress-host .progress-dialog');
      return !dlg.classList.contains('open') && !dlg.querySelector('.progress-dialog-content');
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const ipc = window.__eagleIpc || window.electron.ipcRenderer;
      ipc.emit('show-archive-task');
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(100);
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('#eagle-eaglepack-export-progress-host .cancel-button').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'ee-cancel-closed',
    `(() => {
      const dlg = document.querySelector('#eagle-eaglepack-export-progress-host .progress-dialog');
      return !dlg.classList.contains('open') && !dlg.querySelector('.progress-dialog-content');
    })()`
  );

  await delay(700);
  await screenshotTo('test-run/react-stage7d6a-progress-dialogs.png', 5000);

  if (failures.length > 0) {
    console.error(`\nSTAGE7D6A SMOKE FAILED: ${failures.length} assertion(s): ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nSTAGE7D6A SMOKE OK');
  }
} catch (err) {
  console.error('SMOKE ERROR:', err && err.stack || err);
  process.exitCode = 1;
} finally {
  await stop(stack).catch(() => {});
  // undici keep-alive socket 会拖住事件循环，测试结果已输出，直接强退
  try { process.exit(process.exitCode || 0); } catch (err) {}
}
