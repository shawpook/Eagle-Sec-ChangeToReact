/**
 * React 化改造 —— 阶段11-pre a1 闭环测试（upload-queue-progress + saving-progress-bar 接管）。
 *
 * 运行：node tests/react-stage11a1-smoke.mjs
 * 断言点：
 *  1. 壳：#eagle-progress-bars-host 在 #list-content-panel 内；旧 id（#saving-progress-bar/
 *     #upload-queue-progress）已不存在；.saving-progress-bar/.upload-progress-bar 由 React 渲染
 *  2. saving 条：初始关闭 → ipc 'background-state' metadataQueueLength=5 → open + 文案含计数 →
 *     =2 → 关闭（bundle 23386-23396 分支等价）
 *  3. upload 条：scope.uploadQueue 2 项 + $evalAsync → open + percentage 0/2 + left/right 内联
 *     （containerSize.sidebar+1 / inspector.width+1）→ finishQueue 1 项 → 1/2 + 50%
 *  4. 单文件分支：uploadQueue 1 项 + progress=0.42 → .current 42%
 *  5. ETA：addImageTimeLeftInSeconds=3725 → remain 1:02:05（second2time）
 *  6. ng-hide：isDetailMode=true → display:none（复位 false）
 *  7. cancel 点击 → cancelAllTasks → 队列清空 + 条关闭
 *  8. 截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage11a1-'));
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
      await post('/api/library/create', { name: 'React Stage11a1 Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#0ea5e9' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's11a1.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's11a1.png')] });
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
        delay(timeoutMs).then(() => { throw new Error(`screenshot timeout (${timeoutMs})ms`); }),
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

  const evalNow = async (expression) => {
    await page.send('Runtime.evaluate', { expression, returnByValue: true });
  };

  // ── 壳 ──
  await assertExpr('a1-host-in-panel', `(() => {
    const panel = document.getElementById('list-content-panel');
    const host = document.getElementById('eagle-progress-bars-host');
    return !!(panel && host && panel.contains(host));
  })()`);
  await assertExpr('a1-old-ids-gone-react-rendered', `(() => {
    return !document.getElementById('saving-progress-bar')
      && !document.getElementById('upload-queue-progress')
      && !!document.querySelector('#eagle-progress-bars-host .saving-progress-bar')
      && !!document.querySelector('#eagle-progress-bars-host .upload-progress-bar');
  })()`);

  // ── saving 条：background-state ipc ──
  await assertExpr('a1-saving-closed-initially', `!document.querySelector('.saving-progress-bar').classList.contains('open')`);
  await evalNow(`(() => {
    const ipc = window.__eagleIpc || window.electron.ipcRenderer;
    ipc.emit('background-state', { metadataQueueLength: 5 });
    return true;
  })()`);
  await assertExpr('a1-saving-open-count', `(() => {
    const bar = document.querySelector('.saving-progress-bar');
    return bar.classList.contains('open') && bar.querySelector('.message').textContent.indexOf('5') > -1;
  })()`);
  await evalNow(`(() => {
    const ipc = window.__eagleIpc || window.electron.ipcRenderer;
    ipc.emit('background-state', { metadataQueueLength: 2 });
    return true;
  })()`);
  await assertExpr('a1-saving-closed-after', `!document.querySelector('.saving-progress-bar').classList.contains('open')`);

  // ── upload 条：scope 队列快照 ──
  await evalNow(`(() => {
    const b = window.$bodyScope;
    b.uploadQueue = [{}, {}];
    b.finishQueue = [];
    b.$evalAsync();
    return true;
  })()`);
  await assertExpr('a1-upload-open-counter', `(() => {
    const bar = document.querySelector('.upload-progress-bar');
    return bar.classList.contains('open')
      && bar.querySelector('.message .percentage').textContent === '0/2'
      && !!bar.querySelector('.progressbar .current');
  })()`);
  await assertExpr('a1-upload-position', `(() => {
    const b = window.$bodyScope;
    const bar = document.querySelector('.upload-progress-bar');
    return bar.style.left === (b.containerSize.sidebar + 1) + 'px'
      && bar.style.right === (b.inspector.width + 1) + 'px';
  })()`);
  await evalNow(`(() => {
    const b = window.$bodyScope;
    b.finishQueue = [{}];
    b.$evalAsync();
    return true;
  })()`);
  await assertExpr('a1-upload-finish-half', `(() => {
    const bar = document.querySelector('.upload-progress-bar');
    return bar.querySelector('.message .percentage').textContent === '1/2'
      && bar.querySelector('.progressbar .current').style.width === '50%';
  })()`);

  // 单文件分支：progress*100%
  await evalNow(`(() => {
    const b = window.$bodyScope;
    b.uploadQueue = [{}];
    b.finishQueue = [];
    b.progress = 0.42;
    b.$evalAsync();
    return true;
  })()`);
  await assertExpr('a1-upload-single-progress', `(() => {
    const currents = document.querySelectorAll('.upload-progress-bar .progressbar .current');
    return currents.length === 1 && currents[0].style.width === '42%';
  })()`);

  // ETA（second2time）
  await evalNow(`(() => {
    const b = window.$bodyScope;
    b.addImageTimeLeftInSeconds = 3725;
    b.$evalAsync();
    return true;
  })()`);
  await assertExpr('a1-upload-timeleft', `(() => {
    const remain = document.querySelector('.upload-progress-bar .counter.remain');
    return !!remain && remain.textContent.indexOf('1:02:05') > -1;
  })()`);

  // ng-hide isDetailMode
  await evalNow(`(() => {
    const b = window.$bodyScope;
    b.isDetailMode = true;
    b.$evalAsync();
    return true;
  })()`);
  await assertExpr('a1-upload-detail-hidden', `document.querySelector('.upload-progress-bar').style.display === 'none'`);
  await evalNow(`(() => {
    const b = window.$bodyScope;
    b.isDetailMode = false;
    b.$evalAsync();
    return true;
  })()`);
  await assertExpr('a1-upload-detail-restored', `document.querySelector('.upload-progress-bar').style.display !== 'none'`);

  // cancel 点击 → cancelAllTasks → 队列清空 + 关闭
  await evalNow(`(() => {
    document.querySelector('.upload-progress-bar .ic-btn.cancel').click();
    return true;
  })()`);
  await assertExpr('a1-cancel-closed', `(() => {
    const b = window.$bodyScope;
    const bar = document.querySelector('.upload-progress-bar');
    return b.uploadQueue.length === 0 && b.finishQueue.length === 0 && !bar.classList.contains('open');
  })()`);

  await delay(600);
  await screenshotTo('test-run/react-stage11a1-smoke.png', 5000);

  if (failures.length) {
    console.error(`STAGE11A1 SMOKE FAILED: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('STAGE11A1 SMOKE OK');
  }
} catch (err) {
  console.error('STAGE11A1 SMOKE ERROR:', err);
  process.exitCode = 1;
} finally {
  if (stack) await stop(stack.electron).catch(() => {});
  if (stack) await stop(stack.vite).catch(() => {});
  if (stack) await stop(stack.backend).catch(() => {});
}
