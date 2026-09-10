import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { bootStack, stop, waitFor } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// UX 诊断探针（不提交）——真机复现"按钮点不了/图像点不开"：
// bootStack 全栈 + CDP Input 真实鼠标事件驱动 + console 错误全程捕获
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-ux-probe-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const sourcesRoot = path.join(tempRoot, 'sources');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourcesRoot, { recursive: true });

function createPng(filePath, color, width = 640, height = 480) {
  const image = new PNG({ width, height });
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 4;
    image.data[offset] = color[0];
    image.data[offset + 1] = color[1];
    image.data[offset + 2] = color[2];
    image.data[offset + 3] = 255;
  }
  fs.writeFileSync(filePath, PNG.sync.write(image));
}

// console/exception 全程捕获
const consoleLog = [];
let stack;
let failure = null;
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
      await post('/api/library/create', { name: 'UX Probe', savePath: librariesRoot });
      const colors = [[25, 60, 210], [30, 180, 90], [200, 120, 30]];
      const images = [];
      for (let i = 0; i < 3; i++) {
        const p = path.join(sourcesRoot, `Probe ${i + 1}.png`);
        createPng(p, colors[i]);
        images.push({ path: p, name: `Probe ${i + 1}` });
      }
      await post('/api/item/addFromPaths', { images });
    },
  });
  const { page } = stack;

  await page.send('Runtime.enable');
  await page.send('Page.enable');
  // console 捕获
  page.on = page.on || (() => {});
  const wsSend = page.send;
  page.send = async function (method, params) {
    return wsSend.call(this, method, params);
  };
  // 用事件轮询方式抓 console（bootStack 的 connect 未暴露事件订阅，改用注入 hook）
  await page.send('Runtime.evaluate', { expression: `(() => {
    window.__uxProbe = { errors: [], warns: [], clickLog: [] };
    const ow = console.error, owarn = console.warn;
    console.error = function () { try { window.__uxProbe.errors.push(Array.from(arguments).map(a => (a && a.stack) ? String(a.stack).slice(0, 300) : String(a)).join(' ').slice(0, 400)); } catch (e) {} return ow.apply(console, arguments); };
    console.warn = function () { try { window.__uxProbe.warns.push(Array.from(arguments).map(String).join(' ').slice(0, 200)); } catch (e) {} return owarn.apply(console, arguments); };
    window.addEventListener('error', (e) => { window.__uxProbe.errors.push('UNCAUGHT: ' + e.message + ' @ ' + (e.filename || '') + ':' + e.lineno); });
    window.addEventListener('unhandledrejection', (e) => { window.__uxProbe.errors.push('REJECTION: ' + (e.reason && e.reason.stack ? String(e.reason.stack).slice(0, 300) : String(e.reason))); });
    return true;
  })()`, returnByValue: true });

  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
    return r.result.value === 'complete';
  }, 'main window ready', 45000);
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', { expression: `!!window.$bodyScope`, returnByValue: true });
    return r.result.value === true;
  }, 'app scope', 45000);

  const evaluate = async (expression) => {
    const r = await page.send('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) {
      consoleLog.push(`EVAL-ERROR: ${JSON.stringify(r.exceptionDetails).slice(0, 300)}`);
      return { __evalError: JSON.stringify(r.exceptionDetails).slice(0, 300) };
    }
    return r.result.value;
  };

  // 等网格渲染
  await waitFor(async () => {
    const n = await evaluate(`document.querySelectorAll('#content-panel .box, .content-panel .box, .box').length`);
    return typeof n === 'number' && n >= 3 ? n : null;
  }, 'grid boxes render', 45000);

  const report = {};
  report.boxes = await evaluate(`document.querySelectorAll('.box').length`);

  // ── 探针 1：真实鼠标点击第一张缩略图 → 是否进入详情 ──
  const boxRect = await evaluate(`(() => {
    const box = document.querySelector('.box');
    if (!box) return null;
    const r = box.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
  })()`);
  report.boxRect = boxRect;
  if (boxRect && boxRect.x > 0) {
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: Math.round(boxRect.x), y: Math.round(boxRect.y), button: 'left', clickCount: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: Math.round(boxRect.x), y: Math.round(boxRect.y), button: 'left', clickCount: 1 });
    await new Promise((r) => setTimeout(r, 1500));
    report.afterBoxClick = await evaluate(`(() => {
      const s = window.$bodyScope;
      return {
        isDetailMode: !!(s && s.isDetailMode),
        bodyHasDetail: document.body.className.includes('detail'),
        detailContainer: !!document.querySelector('#detail-container'),
        detailVisible: (() => { const el = document.querySelector('#detail-container'); return el ? getComputedStyle(el).display !== 'none' : false; })(),
        selectedLen: s && s.selected ? s.selected.length : -1,
      };
    })()`);
  }

  // ── 探针 2： Esc 退出详情 + 侧栏/工具栏按钮可点击性盘点 ──
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await new Promise((r) => setTimeout(r, 800));
  report.afterEsc = await evaluate(`(() => {
    const s = window.$bodyScope;
    return { isDetailMode: !!(s && s.isDetailMode) };
  })()`);

  report.buttons = await evaluate(`(() => {
    const sels = ['.toolbar .button', '.topbar .button', '#toolbar .button', '.tool-options .button', '.searchbar .button', '.sidebar .folder-item', '.sidebar-item', '.nav-button'];
    const out = {};
    for (const sel of sels) {
      const els = Array.from(document.querySelectorAll(sel)).slice(0, 8);
      out[sel] = els.map((el) => ({
        text: (el.textContent || '').trim().slice(0, 24),
        cls: el.className.slice ? String(el.className).slice(0, 60) : '',
        disabled: el.disabled === true || String(el.className).includes('disabled'),
        rect: (() => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
      })).filter(e => e.rect.w > 0 && e.rect.h > 0);
    }
    return out;
  })()`);

  // ── 探针 3：真实点击一个可见工具栏按钮看反应 ──
  const toolbarBtn = await evaluate(`(() => {
    const cands = Array.from(document.querySelectorAll('.toolbar .button, .topbar .button, #toolbar .button'))
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    if (!cands.length) return null;
    const el = cands[0];
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), text: (el.textContent || '').trim().slice(0, 30), cls: String(el.className).slice(0, 60) };
  })()`);
  report.toolbarBtn = toolbarBtn;
  if (toolbarBtn) {
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: toolbarBtn.x, y: toolbarBtn.y, button: 'left', clickCount: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: toolbarBtn.x, y: toolbarBtn.y, button: 'left', clickCount: 1 });
    await new Promise((r) => setTimeout(r, 1200));
  }

  report.errors = await evaluate(`JSON.stringify(window.__uxProbe.errors.slice(0, 30))`);
  report.warnsCount = await evaluate(`window.__uxProbe.warns.length`);
  report.warnSample = await evaluate(`JSON.stringify(window.__uxProbe.warns.slice(0, 10))`);

  console.log('UX_PROBE_REPORT ' + JSON.stringify(report, null, 1));
} catch (err) {
  failure = err;
  console.error(`UX_PROBE_FAIL ${err.message}`);
} finally {
  if (stack) {
    await stop(stack.electron);
    await stop(stack.vite);
    await stop(stack.backend);
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
