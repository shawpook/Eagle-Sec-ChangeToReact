/**
 * React 化改造 —— 阶段11-pre a2 闭环测试（toast-alert 三块接管）。
 *
 * 运行：node tests/react-stage11a2-smoke.mjs
 * 断言点：
 *  1. 壳：#eagle-toast-alerts-host 在 #list-content-panel 内；初始无 .toast-alert；
 *     旧模板位无残留（host 外无 toast-alert 元素）
 *  2. 失败重试提示：scope.errorList 1 项 → 显示 + 文案含 '1'（errorMsg1）；2 项 → '2'
 *     （errorMsg2 分支）
 *  3. 点击 toast 主体 → openErrorModal 广播 → React ErrorModal（.modal.error-modal）打开
 *  4. 点击 clean-btn → cleanAllError（stopPropagation 不开弹窗）→ CLEAN_ALL_ERROR →
 *     ErrorModal swal 确认框 → 确认 → 清空 errorList（引用同一数组）→ toast 隐藏 + 弹窗关闭
 *  5. localhostError：scope 置真 → warning toast 显示且 message 含 <a>（ng-bind-html 等价）；
 *     cleanLocalhostError → 隐藏
 *  6. libraryPathPermissionError：同 5
 *  7. 截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage11a2-'));
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
      await post('/api/library/create', { name: 'React Stage11a2 Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#0ea5e9' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's11a2.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's11a2.png')] });
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
  await assertExpr('a2-host-in-panel', `(() => {
    const panel = document.getElementById('list-content-panel');
    const host = document.getElementById('eagle-toast-alerts-host');
    return !!(panel && host && panel.contains(host));
  })()`);
  // 测试环境（bootStack 端口映射）无 41593 监听 → initial 健康检查置 localhostError=true
  // （toast 为正确应用行为，c9-c15 启动时序变化使其稳定渲染）。显式清除该环境源，使后续
  // 断言测量组件对各错误源的响应性；localhost 场景在其后独立触发（a2-localhost-toast）。
  await evalNow(`(() => {
    const b = window.$bodyScope;
    b.localhostError = false;
    b.$evalAsync();
    return true;
  })()`);
  await assertExpr('a2-initial-empty', `document.querySelectorAll('.toast-alert').length === 0`);

  // ── 失败重试提示 ──
  await evalNow(`(() => {
    const b = window.$bodyScope;
    b.errorList = [{}];
    b.$evalAsync();
    return true;
  })()`);
  await assertExpr('a2-error-toast-1', `(() => {
    const toast = document.querySelector('.toast-alert');
    return !!toast && toast.querySelector('.message').textContent.indexOf('1') > -1;
  })()`);
  await evalNow(`(() => {
    const b = window.$bodyScope;
    b.errorList = [{}, {}];
    b.$evalAsync();
    return true;
  })()`);
  await assertExpr('a2-error-toast-2', `(() => {
    const toast = document.querySelector('.toast-alert');
    return !!toast && toast.querySelector('.message').textContent.indexOf('2') > -1;
  })()`);

  // 点击主体 → openErrorModal → React ErrorModal
  await evalNow(`(() => {
    document.querySelector('.toast-alert').click();
    return true;
  })()`);
  await assertExpr('a2-error-modal-open', `!!document.querySelector('#eagle-error-modal-host .modal.error-modal')`);

  // clean-btn → cleanAllError（stopPropagation）→ CLEAN_ALL_ERROR → swal 确认框 →
  // 确认后清空引用数组（ErrorModal then 内 body.$evalAsync 驱动 digest）→ toast 隐藏 + 弹窗关闭
  await evalNow(`(() => {
    document.querySelector('.toast-alert .ic-btn.clean-btn').click();
    return true;
  })()`);
  await assertExpr('a2-clean-swal', `!!document.querySelector('.swal2-container .swal2-confirm')`);
  await evalNow(`(() => {
    const btn = document.querySelector('.swal2-container .swal2-confirm');
    if (btn) btn.click();
    return true;
  })()`);
  await assertExpr('a2-clean-cleared', `(() => {
    const b = window.$bodyScope;
    return b.errorList.length === 0
      && document.querySelectorAll('.toast-alert').length === 0
      && !document.querySelector('#eagle-error-modal-host .modal.error-modal');
  })()`);

  // ── localhostError ──
  await evalNow(`(() => {
    const b = window.$bodyScope;
    b.localhostError = true;
    b.$evalAsync();
    return true;
  })()`);
  await assertExpr('a2-localhost-toast', `(() => {
    const toast = document.querySelector('.toast-alert.warning.bottom');
    return !!toast && !!toast.querySelector('.message a');
  })()`);
  await evalNow(`(() => {
    document.querySelector('.toast-alert.warning.bottom .ic-btn.clean-btn').click();
    return true;
  })()`);
  await assertExpr('a2-localhost-cleaned', `!document.querySelector('.toast-alert.warning.bottom')`);

  // ── libraryPathPermissionError ──
  await evalNow(`(() => {
    const b = window.$bodyScope;
    b.libraryPathPermissionError = true;
    b.$evalAsync();
    return true;
  })()`);
  await assertExpr('a2-library-perm-toast', `(() => {
    const toast = document.querySelector('.toast-alert.warning.bottom');
    return !!toast && !!toast.querySelector('.message a');
  })()`);
  await evalNow(`(() => {
    document.querySelector('.toast-alert.warning.bottom .ic-btn.clean-btn').click();
    return true;
  })()`);
  await assertExpr('a2-library-perm-cleaned', `!document.querySelector('.toast-alert.warning.bottom')`);

  await delay(600);
  await screenshotTo('test-run/react-stage11a2-smoke.png', 5000);

  if (failures.length) {
    console.error(`STAGE11A2 SMOKE FAILED: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('STAGE11A2 SMOKE OK');
  }
} catch (err) {
  console.error('STAGE11A2 SMOKE ERROR:', err);
  process.exitCode = 1;
} finally {
  if (stack) await stop(stack.electron).catch(() => {});
  if (stack) await stop(stack.vite).catch(() => {});
  if (stack) await stop(stack.backend).catch(() => {});
}
