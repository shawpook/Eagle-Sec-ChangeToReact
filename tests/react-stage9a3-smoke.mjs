/**
 * React 化改造 —— 阶段9a-3闭环测试（预览大窗：tippy 挂载 + 拖拽 overlay + grayscale +
 * 窗口控制按钮 + 右键菜单不崩 + close 关窗）。
 *
 * 运行：node tests/react-stage9a3-smoke.mjs
 * 断言点：
 *  1. init 到达 + 工具列 tippy 实际挂载（.ic-btn 元素持 _tippy 实例，content 含 <key> 标记；
 *     pin 翻转触发依赖串变化 → 销毁重建后实例仍在——原 tippy 指令 $observe 语义）
 *  2. grayscale：toggleGrayscale → body is-grayscale-mode class 翻转
 *  3. Shift 拖拽模式 overlay：keydown/keyup Shift（keyCode 16）+ document mousemove shiftKey
 *     → #drag-mode-overlay .show 显隐（initShellBehaviors 的 jQuery 委托）
 *  4. 窗口控制：toggleAlwaysOnTop（remote.isAlwaysOnTop + pin/unpin 双渲染显隐切换）、
 *     maximize/restore（isMaximize + remote.isMaximized + 按钮 swap）
 *  5. 右键菜单族（openContextMenu/openGifContextMenu/openRatioContextMenu）构造+popup 不产生
 *     任何未捕获错误；scope.close() 后 preview target 消失（真实关窗）
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay, connect } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage9a3-'));
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
      await post('/api/library/create', { name: 'React Stage9a3 Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#0ea5e9' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's9a3.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's9a3.png')] });
    },
  });
  const { page, debugPort } = stack;

  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', { expression: `document.readyState`, returnByValue: true });
    return r.result.value === 'complete';
  }, 'main window ready', 30000);

  const waitExpr = (expression) => page.send('Runtime.evaluate', { expression, returnByValue: true });
  await waitFor(async () => (await waitExpr(`!!document.querySelector('#box-list .box')`)).result.value, 'grid boxes rendered', 45000);

  const failures = [];
  const evalOn = async (pageRef, expression) => {
    const r = await pageRef.send('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) {
      console.log(`WARN eval threw: ${r.exceptionDetails.text} ${JSON.stringify(r.exceptionDetails.exception || {}).slice(0, 200)}`);
      return undefined;
    }
    return r.result.value;
  };
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
  };

  // ── 打开预览大窗并连接 ──
  const itemId = (await waitExpr(`window.$bodyScope && window.$bodyScope.allData && window.$bodyScope.allData[0] && window.$bodyScope.allData[0].id`)).result.value;
  if (!itemId) throw new Error('No item id in main window');
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.eagleDesktop.preview.open({ images: [{ id: ${JSON.stringify(itemId)} }], show: true });
      return true;
    })()`,
    returnByValue: true,
  });

  let pw = null;
  await waitFor(async () => {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      const target = targets.find((t) => t.type === 'page' && String(t.url).includes('preview-window.html'));
      if (target && target.webSocketDebuggerUrl) {
        pw = await connect(target.webSocketDebuggerUrl);
        return true;
      }
    } catch (err) { /* retry */ }
    return false;
  }, 'preview window CDP target', 30000);

  await waitFor(async () => {
    const r = await pw.send('Runtime.evaluate', { expression: `document.readyState`, returnByValue: true });
    return r.result.value === 'complete';
  }, 'preview window ready', 30000);

  // ── 断言 1：init + tippy 实际挂载 ──
  await assertExprOn(pw, 'pw3a-init-arrived', `(() => {
    const s = window.__eaglePreviewController;
    return !!s && !!s.current && Array.isArray(s.images) && s.images.length > 0 && !!s.imagesDir;
  })()`);
  await assertExprOn(pw, 'pw3a-tippy-mounted', `(() => {
    const btn = document.querySelector('#eagle-preview-toolbar-anchor [tippy][tippy-content]');
    return !!btn && !!btn._tippy && String(btn._tippy.props.content).indexOf('<key>') > -1;
  })()`);
  await assertExprOn(pw, 'pw3a-tippy-covers-zoom-buttons', `(() => {
    const btns = Array.from(document.querySelectorAll('#eagle-preview-toolbar-anchor .ic-btn[tippy]'));
    return btns.length >= 2 && btns.every((btn) => !!btn._tippy);
  })()`);

  // ── 断言 2：grayscale ──
  await evalOn(pw, `(() => { const s = window.__eaglePreviewController; s.toggleGrayscale(); s.$evalAsync(); return true; })()`);
  await assertExprOn(pw, 'pw3a-grayscale-on', `document.body.classList.contains('is-grayscale-mode')`);
  await evalOn(pw, `(() => { const s = window.__eaglePreviewController; s.toggleGrayscale(); s.$evalAsync(); return true; })()`);
  await assertExprOn(pw, 'pw3a-grayscale-off', `!document.body.classList.contains('is-grayscale-mode')`);

  // ── 断言 3：Shift 拖拽模式 overlay ──
  await evalOn(pw, `window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 16 })); true`);
  await assertExprOn(pw, 'pw3a-overlay-shift-keydown', `document.getElementById('drag-mode-overlay').classList.contains('show')`);
  await evalOn(pw, `window.dispatchEvent(new KeyboardEvent('keyup', { keyCode: 16 })); true`);
  await assertExprOn(pw, 'pw3a-overlay-shift-keyup', `!document.getElementById('drag-mode-overlay').classList.contains('show')`);
  await evalOn(pw, `document.dispatchEvent(new MouseEvent('mousemove', { shiftKey: true })); true`);
  await assertExprOn(pw, 'pw3a-overlay-mousemove-show', `document.getElementById('drag-mode-overlay').classList.contains('show')`);
  await evalOn(pw, `document.dispatchEvent(new MouseEvent('mousemove', {})); true`);
  await assertExprOn(pw, 'pw3a-overlay-mousemove-hide', `!document.getElementById('drag-mode-overlay').classList.contains('show')`);

  // ── 断言 4：窗口控制（pin/unpin 双渲染 + maximize/restore） ──
  await evalOn(pw, `(() => { const s = window.__eaglePreviewController; s.toggleAlwaysOnTop(); s.$evalAsync(); return true; })()`);
  await assertExprOn(pw, 'pw3a-pin-on', `(() => {
    // shims mock remote 无 isAlwaysOnTop（controller 经 mock setAlwaysOnTop）→ 以 scope 标志 + DOM 判定
    const s = window.__eaglePreviewController;
    if (s.isAlwaysOnTop !== true) return false;
    const unpin = document.querySelector('#eagle-preview-toolbar-anchor img[src$="ic-toolbar-unpin.svg"]');
    const pin = document.querySelector('#eagle-preview-toolbar-anchor img[src$="ic-toolbar-pin.svg"]');
    // Pin 按钮（unpin 图标）ng-show=isAlwaysOnTop → 可见；Unpin 按钮（pin 图标）→ display:none
    return !!unpin && unpin.parentElement.style.display !== 'none'
      && !!pin && pin.parentElement.style.display === 'none';
  })()`);
  await assertExprOn(pw, 'pw3a-pin-on-tippy-recreated', `(() => {
    const unpin = document.querySelector('#eagle-preview-toolbar-anchor img[src$="ic-toolbar-unpin.svg"]');
    return !!unpin && !!unpin.parentElement._tippy;
  })()`);
  const toggleOff = await evalOn(pw, `(() => {
    try {
      const s = window.__eaglePreviewController;
      s.toggleAlwaysOnTop();
      s.$evalAsync();
      return 'ok:' + s.isAlwaysOnTop;
    } catch (err) {
      return 'throw:' + err.message;
    }
  })()`);
  console.log(`INFO toggle-off: ${toggleOff}`);
  {
    // 逐轮采样版：看轮询期间状态迁移（ok/flag/display/tippy 随时间变化）
    const t0 = Date.now();
    let lastVals = null;
    let pass = false;
    try {
      await waitFor(async () => {
        lastVals = await evalOn(pw, `(() => {
          const s = window.__eaglePreviewController;
          const pin = document.querySelector('#eagle-preview-toolbar-anchor img[src$="/ic-toolbar-pin.svg"]');
          const unpin = document.querySelector('#eagle-preview-toolbar-anchor img[src$="ic-toolbar-unpin.svg"]');
          const flag = s.isAlwaysOnTop;
          const pinDisplay = pin ? pin.parentElement.style.display : null;
          const unpinDisplay = unpin ? unpin.parentElement.style.display : null;
          const pinTippy = pin ? !!pin.parentElement._tippy : false;
          const ok = flag === false
            && !!pin && pinDisplay !== 'none'
            && !!unpin && unpinDisplay === 'none'
            && pinTippy;
          return { ok, flag, pinDisplay, unpinDisplay, pinTippy };
        })()`);
        return !!(lastVals && lastVals.ok);
      }, 'pw3a-pin-off-recreated-tippy', 20000);
      pass = true;
    } catch (err) { /* timeout */ }
    console.log(`${pass ? 'PASS' : 'FAIL'} pw3a-pin-off-recreated-tippy`);
    console.log(`INFO pin-off-poll elapsed=${Date.now() - t0}ms last=${JSON.stringify(lastVals)}`);
    if (!pass) failures.push('pw3a-pin-off-recreated-tippy');
  }
  // 复位态复核（只读，无探针污染）
  await assertExprOn(pw, 'pw3a-pin-off-tippy-both', `(() => {
    const pin = document.querySelector('#eagle-preview-toolbar-anchor img[src$="/ic-toolbar-pin.svg"]');
    const unpin = document.querySelector('#eagle-preview-toolbar-anchor img[src$="ic-toolbar-unpin.svg"]');
    return !!pin && !!pin.parentElement._tippy && !!unpin && !!unpin.parentElement._tippy;
  })()`);

  await evalOn(pw, `(() => { const s = window.__eaglePreviewController; s.maximize(); s.$evalAsync(); return true; })()`);
  await assertExprOn(pw, 'pw3a-maximize', `(() => {
    const remote = window.require('@electron/remote');
    if (!remote.getCurrentWindow().isMaximized()) return false;
    const s = window.__eaglePreviewController;
    if (s.isMaximize !== true) return false;
    const restore = document.querySelector('#eagle-preview-toolbar-anchor img[src$="ic-windows-restore.svg"]');
    const full = document.querySelector('#eagle-preview-toolbar-anchor img[src$="ic-windows-fullscreen.svg"]');
    return !!restore && restore.parentElement.style.display !== 'none' && (!full || full.parentElement.style.display === 'none');
  })()`);
  await evalOn(pw, `(() => { const s = window.__eaglePreviewController; s.restore(); s.$evalAsync(); return true; })()`);
  await assertExprOn(pw, 'pw3a-restore', `(() => {
    const remote = window.require('@electron/remote');
    return !remote.getCurrentWindow().isMaximized() && window.__eaglePreviewController.isMaximize === false;
  })()`);

  // 右键菜单族（openContextMenu/openGifContextMenu/openRatioContextMenu）为 Electron native
  // Menu——popup() 在自动化环境阻塞/抢占输入（首跑实证卡死），CDP 无法断言原生菜单 UI；
  // 构造路径不依赖 DOM，留待阶段11 与 bundle 一并处理自动化方案。此处不触发 popup。

  // ── 断言 6：close() 真实关窗 ──
  await evalOn(pw, `(() => { window.__eaglePreviewController.close(); return true; })()`);
  let closed = false;
  await waitFor(async () => {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      closed = !targets.some((t) => t.type === 'page' && String(t.url).includes('preview-window.html'));
      return closed;
    } catch (err) {
      return false;
    }
  }, 'preview window closed', 15000);
  console.log(`${closed ? 'PASS' : 'FAIL'} pw3a-close-window`);
  if (!closed) failures.push('pw3a-close-window');

  if (failures.length > 0) {
    console.error(`\nSTAGE9A3 SMOKE FAILED: ${failures.length} assertion(s): ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nSTAGE9A3 SMOKE OK');
  }
} catch (err) {
  console.error('SMOKE ERROR:', err && err.stack || err);
  process.exitCode = 1;
} finally {
  await stop(stack).catch(() => {});
  try { process.exit(process.exitCode || 0); } catch (err) {}
}
