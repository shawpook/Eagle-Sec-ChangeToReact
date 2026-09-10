import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// 残余扫查 B7：控制台错误全捕轮（scopeApply 吞错走 console.error——B1-B6 的盲区）+
// toggle-all 0×0 布局塌陷根因（display/尺寸/img 状态/祖先链）。
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-sweepb7-'));
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

let stack;
let failure = null;
const watchdog = setTimeout(() => { console.log('SWEEP_B7_WATCHDOG'); process.exit(2); }, 480000);

async function main() {
  stack = await bootStack({
    librariesRoot, stateFile, userDataDir,
    beforeElectron: async (apiPort) => {
      const post = async (route, body) => {
        const response = await Promise.race([
          fetch(`http://127.0.0.1:${apiPort}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('fixture timeout')), 15000)),
        ]);
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') throw new Error(`${route}: ${JSON.stringify(payload)}`);
        return payload.data;
      };
      await post('/api/library/create', { name: 'SweepB7', savePath: librariesRoot });
      const colors = [[25, 60, 210], [30, 180, 90], [200, 120, 30]];
      const images = [];
      for (let i = 0; i < 3; i++) {
        const p = path.join(sourcesRoot, `SweepB ${i + 1}.png`);
        createPng(p, colors[i]);
        images.push({ path: p, name: `SweepB ${i + 1}` });
      }
      await post('/api/item/addFromPaths', { images });
      await post('/api/folder/create', { name: '设计参考' });
    },
  });
  const { page } = stack;
  const sendT = async (method, params, ms = 12000) => {
    const r = await Promise.race([
      page.send(method, params),
      new Promise((resolve) => setTimeout(() => resolve({ __timeout: method }), ms)),
    ]);
    if (r && r.__timeout) throw new Error(`CDP timeout: ${method}`);
    return r;
  };
  const evaluate = async (expression) => {
    const r = await sendT('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.exception?.description?.slice(0, 220)}`);
    return r.result.value;
  };
  const press = async (x, y, button, count) => {
    await sendT('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, clickCount: count });
    await sendT('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, clickCount: count });
  };
  const rectCenter = async (expression) => {
    const r = await evaluate(`(() => { const e = (${expression}); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2), w: Math.round(b.width), h: Math.round(b.height) }; })()`);
    return r || null;
  };

  // 控制台错误捕获必须先于一切交互
  await sendT('Runtime.enable');
  await waitFor(async () => (await evaluate(`document.readyState`)) === 'complete', 'ready', 60000);
  await waitFor(async () => (await evaluate(`!!window.$bodyScope`)) === true, 'scope', 60000);
  await waitFor(async () => {
    const n = await evaluate(`document.querySelectorAll('.box').length`);
    return typeof n === 'number' && n >= 3 ? n : null;
  }, 'boxes', 60000);
  await delay(1500);

  const consoleErrors = [];
  const collectConsole = () => {
    for (const message of page.events) {
      if (message.method !== 'consoleAPICalled') continue;
      const p = message.params;
      if (p.type !== 'error') continue;
      const text = p.args.map((a) => a.value ?? a.description ?? a.preview?.description ?? '').join(' ').slice(0, 260);
      const key = text.slice(0, 160);
      const found = consoleErrors.find((e) => e.key === key);
      if (found) found.count += 1;
      else consoleErrors.push({ key, text, count: 1 });
    }
  };

  // Y1 toggle-all 布局塌陷根因
  const y1 = await (async () => {
    const info = await evaluate(`(() => {
      const b = document.querySelector('#eagle-toolbar-host #toggle-all-btn');
      if (!b) return { missing: true };
      const chain = [];
      let e = b;
      while (e && chain.length < 6) {
        const st = getComputedStyle(e);
        chain.push({ tag: e.tagName.toLowerCase() + (e.id ? '#' + e.id : ''), cls: String(e.className).slice(0, 40), disp: st.display, w: st.width, h: st.height, vis: st.visibility, overflow: st.overflow });
        e = e.parentElement;
      }
      const img = b.querySelector('img');
      return { chain, btnRect: (function (r) { return { x: r.x, y: r.y, w: r.width, h: r.height }; })(b.getBoundingClientRect()), img: img ? { complete: img.complete, nw: img.naturalWidth, src: img.src.slice(-50) } : null };
    })()`);
    console.log(`SWEEP_B7_Y1 ${JSON.stringify(info)}`);
    return info;
  })();

  // Y2 交互全扫（console.error 全捕）
  const press2 = async (label, expression) => {
    const c = await rectCenter(expression);
    if (!c || !c.w) { console.log(`SWEEP_B7_SKIP ${label} (no size/no element)`); return; }
    await press(c.x, c.y, 'left', 1);
    await delay(900);
    collectConsole();
    console.log(`SWEEP_B7_CLICKED ${label} @${c.x},${c.y}`);
  };

  await press2('toggle-all-toolbar', `document.querySelector('#eagle-toolbar-host #toggle-all-btn')`);
  await press2('openOrderMenu-btn', `(function () { const els = Array.from(document.querySelectorAll('#eagle-toolbar-host .ic-btn')); return els.filter(function (e) { return String(e.getAttribute('ng-click') || '').indexOf('openOrderMenu') !== -1; })[0]; })()`);
  await press2('toggleFilter-btn', `(function () { const els = Array.from(document.querySelectorAll('#eagle-toolbar-host .filter-btn')); return els.filter(function (e) { return String(e.getAttribute('ng-click') || '').indexOf('toggleFilter') !== -1; })[0]; })()`);
  await press2('zoomOut-btn', `document.querySelector('#eagle-toolbar-host .zoom-btn')`);
  await press2('refresh-random', `document.getElementById('refresh-random')`);
  await press2('folder-row', `(function () { const c = document.getElementById('sidebar-item-container'); if (!c) return null; const name = Array.from(c.querySelectorAll('.name')).filter(function (e) { return e.textContent.trim() === '设计参考'; })[0]; return name ? name.closest('.item') : null; })()`);
  await press2('smart-node-if-any', `(function () { const c = document.getElementById('sidebar-item-container'); const name = c && Array.from(c.querySelectorAll('.name')).filter(function (e) { return /智能|smart/i.test(e.textContent); })[0]; return name ? name.closest('.item') : null; })()`);
  // 详情内 rotate 按钮
  const c1 = await rectCenter(`document.querySelector('.box.ext-png')`);
  if (c1) { await press(c1.x, c1.y, 'left', 1); await delay(150); await press(c1.x, c1.y, 'left', 2); await delay(1500); collectConsole(); }
  await press2('detail-rotate', `(function () { const w = document.getElementById('eagle-detail-wrapper'); if (!w) return null; const btns = w.querySelectorAll('.toolbar .ic-btn, .toolbar img'); return btns[0] ? btns[0].closest('.ic-btn') || btns[0] : null; })()`);
  await evaluate(`window.postMessage('Exit', '*'); true`);
  await delay(800);
  collectConsole();

  console.log(`SWEEP_B7_CONSOLE_ERRORS ${JSON.stringify({ total: consoleErrors.length, list: consoleErrors.slice(0, 20) })}`);
  const failed = results2Failed(y1, consoleErrors);
  function results2Failed(y1c, errs) {
    return errs.filter((e) => /react-scope-bridge|is not defined|is not a function|Cannot read/i.test(e.key)).length;
  }
  console.log(`SWEEP_B7_SUMMARY ${JSON.stringify({ toggleAllCollapapsed: y1 && y1.btnRect && y1.btnRect.w === 0, swallowedFatal: failed })}`);
}

try {
  await main();
  console.log(`SWEEP_B7_OK`);
} catch (err) {
  failure = err;
  console.error(`SWEEP_B7_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
