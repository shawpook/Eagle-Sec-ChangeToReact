/**
 * React 化改造 —— 阶段7d-6b闭环测试（进度对话框族第二部分）。
 *
 * 运行：node tests/react-stage7d6b-smoke.mjs
 * 断言点：
 *  1. 壳：4 个 host 存在；旧 <file-thumbnail-progress>/<file-export-progress>/
 *     <file-add-library-progress>/<debug-report-progress> 已删除
 *  2. file-thumbnail：body scope 队列桥接（2 项 → open + counter (0/2) + 0% → finish 1 项 →
 *     50% + (1/2)）→ cancel → cancelRegenerateThumbnail → 关闭
 *  3. debug-report：body.debugReportStatus 桥接（isExporting=true + progress=40 → open + 40%）
 *     → 复位关闭；取消按钮无 onClick（原版装饰）
 *  4. file-export：show-export-task(2) → open 0% → finish → 50% → finish 关闭；re-show(1) +
 *     finish(dir) → 'show-item-in-folder' spy + 关闭；close-export-task → 关闭（shim poke
 *     语义合并）；re-show + cancel → 关闭 + 'cancel.all' spy
 *  5. add-library：ADD_TO_LIBRARY 单项（库不存在）→ open + counter (0/1) + msg 含库名 →
 *     cancel 关闭 + 'electron-info' spy；多项 → swal BulkAction → confirm → open → cancel 关闭
 *  6. 截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage7d6b-'));
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
      await post('/api/library/create', { name: 'React Stage7d6b Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#0ea5e9' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's7d6b.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's7d6b.png')] });
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
  await assertExpr('pd6b-hosts', `['eagle-file-thumbnail-progress-host','eagle-file-export-progress-host','eagle-file-add-library-progress-host','eagle-debug-report-progress-host'].every(id => !!document.getElementById(id))`);
  await assertExpr(
    'pd6b-old-elements-gone',
    `!document.querySelector('file-thumbnail-progress') && !document.querySelector('file-export-progress') && !document.querySelector('file-add-library-progress') && !document.querySelector('debug-report-progress')`
  );

  // ipc spy（cancel.all / show-item-in-folder / electron-info / show-error-box）
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.__ipcCalls = [];
      const ipc = window.__eagleIpc || window.electron.ipcRenderer;
      if (!window.__ipcSpyInstalled) {
        const orig = ipc.send.bind(ipc);
        ipc.send = function (channel, ...args) {
          if (['cancel.all', 'show-item-in-folder', 'electron-info', 'show-error-box'].indexOf(channel) > -1) {
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

  // ── file-thumbnail：body scope 队列桥接 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const body = window.$bodyScope;
      body.regenerateThumbnailQueue = [{}, {}];
      body.finishGenerateQueue = [];
      body.$evalAsync();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'ft-open-counter-0-2',
    `(() => {
      const dlg = document.querySelector('#eagle-file-thumbnail-progress-host .progress-dialog');
      return dlg.classList.contains('open')
        && dlg.querySelector('.message .counter').textContent === '(0/2)'
        && dlg.querySelector('.progressbar .current').style.width === '0%';
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const body = window.$bodyScope;
      body.finishGenerateQueue = [{}];
      body.$evalAsync();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'ft-progress-50',
    `(() => {
      const dlg = document.querySelector('#eagle-file-thumbnail-progress-host .progress-dialog');
      return dlg.querySelector('.message .counter').textContent === '(1/2)'
        && dlg.querySelector('.progressbar .current').style.width === '50%';
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('#eagle-file-thumbnail-progress-host .cancel-button').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'ft-cancel-closed',
    `(() => {
      const dlg = document.querySelector('#eagle-file-thumbnail-progress-host .progress-dialog');
      return !dlg.classList.contains('open') && !dlg.querySelector('.progress-dialog-content');
    })()`
  );

  // ── debug-report：body.debugReportStatus 桥接 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const body = window.$bodyScope;
      // 原版 debugReportStatus 仅在导出调试报告 swal 确认回调里初始化（bundle 106539），
      // 冒烟先等价初始化再置值
      if (!body.debugReportStatus) body.debugReportStatus = { isExporting: false, progress: 0 };
      body.debugReportStatus.isExporting = true;
      body.debugReportStatus.progress = 40;
      body.$evalAsync();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'dr-open-40',
    `(() => {
      const dlg = document.querySelector('#eagle-debug-report-progress-host #export-debug-report-dialog');
      return dlg.classList.contains('open')
        && !!dlg.querySelector('.message')
        && dlg.querySelector('.progressbar .current').style.width === '40%';
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const body = window.$bodyScope;
      body.debugReportStatus.isExporting = false;
      body.debugReportStatus.progress = 0;
      body.$evalAsync();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'dr-closed',
    `(() => {
      const dlg = document.querySelector('#eagle-debug-report-progress-host #export-debug-report-dialog');
      return !dlg.classList.contains('open') && !dlg.querySelector('.progress-dialog-content');
    })()`
  );

  // ── file-export：ipc 三通道 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const ipc = window.__eagleIpc || window.electron.ipcRenderer;
      ipc.emit('show-export-task', 2);
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'fe-open-0',
    `(() => {
      const dlg = document.querySelector('#eagle-file-export-progress-host .progress-dialog');
      return dlg.classList.contains('open') && dlg.querySelector('.progressbar .current').style.width === '0%';
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const ipc = window.__eagleIpc || window.electron.ipcRenderer;
      ipc.emit('finish-export-task');
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'fe-progress-50',
    `document.querySelector('#eagle-file-export-progress-host .progressbar .current').style.width === '50%'`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const ipc = window.__eagleIpc || window.electron.ipcRenderer;
      ipc.emit('finish-export-task');
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'fe-finish-closed',
    `(() => {
      const dlg = document.querySelector('#eagle-file-export-progress-host .progress-dialog');
      return !dlg.classList.contains('open') && !dlg.querySelector('.progress-dialog-content');
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const ipc = window.__eagleIpc || window.electron.ipcRenderer;
      ipc.emit('show-export-task', 1);
      ipc.emit('finish-export-task', '/tmp/exported-dir');
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'fe-finish-dir-closed',
    `(() => {
      const dlg = document.querySelector('#eagle-file-export-progress-host .progress-dialog');
      return !dlg.classList.contains('open') && !dlg.querySelector('.progress-dialog-content');
    })()`
  );
  await assertExpr(
    'fe-show-item-in-folder',
    `(window.__ipcCalls || []).some(c => c.channel === 'show-item-in-folder' && c.args[0] === '/tmp/exported-dir')`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const ipc = window.__eagleIpc || window.electron.ipcRenderer;
      ipc.emit('show-export-task', 3);
      ipc.emit('close-export-task');
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'fe-close-export-closed',
    `(() => {
      const dlg = document.querySelector('#eagle-file-export-progress-host .progress-dialog');
      return !dlg.classList.contains('open') && !dlg.querySelector('.progress-dialog-content');
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const ipc = window.__eagleIpc || window.electron.ipcRenderer;
      ipc.emit('show-export-task', 1);
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(100);
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('#eagle-file-export-progress-host .cancel-button').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'fe-cancel-closed',
    `(() => {
      const dlg = document.querySelector('#eagle-file-export-progress-host .progress-dialog');
      return !dlg.classList.contains('open') && !dlg.querySelector('.progress-dialog-content');
    })()`
  );
  await assertExpr(
    'fe-cancel-ipc',
    `(window.__ipcCalls || []).some(c => c.channel === 'cancel.all')`
  );

  // ── add-library：ADD_TO_LIBRARY 单项（库不存在 → error-box，弹窗保持 open） ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.__eagleBus.emit('ADD_TO_LIBRARY', {
        library: { name: 'DemoLib', path: '/nonexistent-lib-path' },
        items: [{}],
      });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'al-open-0-1',
    `(() => {
      const dlg = document.querySelector('#eagle-file-add-library-progress-host #add-to-library-progress');
      return dlg.classList.contains('open')
        && dlg.querySelector('.message .counter').textContent === '(0/1)'
        && dlg.querySelector('.message').textContent.indexOf('DemoLib') > -1;
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('#eagle-file-add-library-progress-host .cancel-button').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'al-cancel-closed',
    `(() => {
      const dlg = document.querySelector('#eagle-file-add-library-progress-host #add-to-library-progress');
      return !dlg.classList.contains('open') && !dlg.querySelector('.progress-dialog-content');
    })()`
  );
  await assertExpr(
    'al-electron-info-ipc',
    `(window.__ipcCalls || []).some(c => c.channel === 'electron-info' && String(c.args[0]).indexOf('User interrupt') > -1)`
  );
  // 多项 → swal BulkAction 确认 → addToLibrary
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.__eagleBus.emit('ADD_TO_LIBRARY', {
        library: { name: 'DemoLib2', path: '/nonexistent-lib-path' },
        items: [{}, {}],
      });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr('al-swal-shown', `!!document.querySelector('.swal2-container .swal2-confirm')`, 10000);
  await page.send('Runtime.evaluate', {
    expression: `(() => { document.querySelector('.swal2-container .swal2-confirm').click(); return true; })()`,
    returnByValue: true,
  });
  await assertExpr(
    'al-multi-open-0-2',
    `(() => {
      const dlg = document.querySelector('#eagle-file-add-library-progress-host #add-to-library-progress');
      return dlg.classList.contains('open')
        && dlg.querySelector('.message .counter').textContent === '(0/2)'
        && dlg.querySelector('.message').textContent.indexOf('DemoLib2') > -1;
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('#eagle-file-add-library-progress-host .cancel-button').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'al-multi-cancel-closed',
    `(() => {
      const dlg = document.querySelector('#eagle-file-add-library-progress-host #add-to-library-progress');
      return !dlg.classList.contains('open') && !dlg.querySelector('.progress-dialog-content');
    })()`
  );

  await delay(700);
  await screenshotTo('test-run/react-stage7d6b-progress-dialogs.png', 5000);

  if (failures.length > 0) {
    console.error(`\nSTAGE7D6B SMOKE FAILED: ${failures.length} assertion(s): ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nSTAGE7D6B SMOKE OK');
  }
} catch (err) {
  console.error('SMOKE ERROR:', err && err.stack || err);
  process.exitCode = 1;
} finally {
  await stop(stack).catch(() => {});
  try { process.exit(process.exitCode || 0); } catch (err) {}
}
