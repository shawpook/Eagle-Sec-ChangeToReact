/**
 * React 化改造 —— 阶段11 b0 闭环测试（网格容器 Angular 指令清理 + 剩余指令 React 移植）。
 *
 * 运行：node tests/react-stage11b0-smoke.mjs
 * 断言点：
 *  1. 初始化零错误（__eagleGridDirectiveErrors 不存在）
 *  2. rectSelect：既有 React 移植（detailHooks.useRectSelect）在 mousedown 显示 .rect /
 *     mouseup 隐藏；Angular 指令已移除 → .rect 恒为 1（无双绑）
 *  3. autoScroll：AutoScroll 广播不抛错
 *  4. boxContainerScrollbar：thumb will-change 已设；UPDATE_BOX_SCROLLBAR 触发后
 *     单项库走 switchNormalMode（滚动条隐藏）
 *  5. scrollToTopSentinel：初始化样式已写（height 1px + opacity 0）
 *  6. index.html 四指令属性已移除（Angular 编译面清零）
 *  7. 截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage11b0-'));
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
      await post('/api/library/create', { name: 'React Stage11b0 Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#0ea5e9' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's11b0.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's11b0.png')] });
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
  await delay(800);

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
    const r = await page.send('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) console.log(`WARN eval error: ${JSON.stringify(r.exceptionDetails).slice(0, 200)}`);
    return r;
  };

  // ── 初始化 ──
  await assertExpr('b0-init-no-errors', `!window.__eagleGridDirectiveErrors`);

  // ── rectSelect（既有 React 移植 useRectSelect——DetailPanel 挂载；Angular 指令已移除，无双绑） ──
  await evalNow(`(() => {
    const box = document.getElementById('box-container');
    box.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    return true;
  })()`);
  await assertExpr('b0-rectselect-rect-shown', `(() => {
    const rects = document.querySelectorAll('#box-container .rect');
    return rects.length === 1 && getComputedStyle(rects[0]).display !== 'none';
  })()`);
  await evalNow(`(() => {
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
    return true;
  })()`);
  await assertExpr('b0-rectselect-rect-hidden', `(() => {
    const rects = document.querySelectorAll('#box-container .rect');
    return rects.length === 1 && getComputedStyle(rects[0]).display === 'none';
  })()`);

  // ── autoScroll 广播 ──
  await evalNow(`(() => {
    window.__eagleBus.emit('AutoScroll', 0);
    return true;
  })()`);
  await assertExpr('b0-autoscroll-broadcast-ok', `!window.__eagleGridDirectiveErrors`);

  // ── boxContainerScrollbar ──
  await assertExpr('b0-scrollbar-thumb-style', `(() => {
    const thumb = document.querySelector('#box-container-scrollbar .box-container-scrollbar-thumb');
    return !!thumb && getComputedStyle(thumb).willChange === 'transform';
  })()`);
  await evalNow(`(() => {
    const bar = document.getElementById('box-container-scrollbar');
    if (bar) bar.dispatchEvent(new CustomEvent('UPDATE_BOX_SCROLLBAR'));
    return true;
  })()`);
  await assertExpr('b0-scrollbar-normal-mode', `(() => {
    const bar = document.getElementById('box-container-scrollbar');
    return !!bar && getComputedStyle(bar).display === 'none';
  })()`);

  // ── scrollToTopSentinel 初始化样式 ──
  await assertExpr('b0-sentinel-init', `(() => {
    const el = document.getElementById('scroll-to-top-sentinel');
    return !!el && el.style.height === '1px' && el.style.opacity === '0';
  })()`);

  // ── 属性移除核验 ──
  await assertExpr('b0-directive-attrs-gone', `(() => {
    const box = document.getElementById('box-container');
    const bar = document.getElementById('box-container-scrollbar');
    return !box.hasAttribute('auto-scroll') && !box.hasAttribute('rect-select')
      && !bar.hasAttribute('box-container-scrollbar')
      && !document.getElementById('scroll-to-top-sentinel').hasAttribute('scroll-to-top-sentinel');
  })()`);

  await delay(600);
  await screenshotTo('test-run/react-stage11b0-smoke.png', 5000);

  if (failures.length) {
    console.error(`STAGE11B0 SMOKE FAILED: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('STAGE11B0 SMOKE OK');
  }
} catch (err) {
  console.error('STAGE11B0 SMOKE ERROR:', err);
  process.exitCode = 1;
} finally {
  if (stack) await stop(stack.electron).catch(() => {});
  if (stack) await stop(stack.vite).catch(() => {});
  if (stack) await stop(stack.backend).catch(() => {});
}
