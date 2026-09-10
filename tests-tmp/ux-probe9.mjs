import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// UX 诊断探针 R9（不提交）：页面内事件日志 + enterDetailMode 包装追踪——定位 CDP 双击断点
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-ux-probe9-'));
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
const watchdog = setTimeout(() => { console.log('UX_PROBE9_WATCHDOG'); process.exit(2); }, 420000);

try {
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
      await post('/api/library/create', { name: 'UX Probe 9', savePath: librariesRoot });
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
    if (r.exceptionDetails) {
      const desc = r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails).slice(0, 160);
      return { __evalError: desc.slice(0, 160) };
    }
    return r.result.value;
  };
  await sendT('Runtime.enable');
  await waitFor(async () => (await evaluate(`document.readyState`)) === 'complete', 'ready', 60000);
  await waitFor(async () => (await evaluate(`!!window.$bodyScope`)) === true, 'scope', 60000);
  await waitFor(async () => {
    const n = await evaluate(`document.querySelectorAll('.box').length`);
    return typeof n === 'number' && n >= 3 ? n : null;
  }, 'boxes', 60000);

  // 事件日志 + enterDetailMode 包装
  await evaluate(`(() => {
    window.__ux = { events: [], calls: [], errors: [] };
    ['mousedown','mouseup','dblclick','click','contextmenu'].forEach((type) => {
      document.addEventListener(type, (e) => {
        window.__ux.events.push({ t: type, x: e.clientX, y: e.clientY, target: (e.target.className || '').toString().slice(0, 30), detail: e.detail });
      }, true);
    });
    window.addEventListener('error', (e) => { window.__ux.errors.push(e.message); });
    const s = window.$bodyScope;
    const orig = s.enterDetailMode.bind(s);
    s.enterDetailMode = (...a) => {
      window.__ux.calls.push({ fn: 'enterDetailMode', itemName: a[1] ? a[1].name : null, selectedLen: s.selected.length, before: s.isDetailMode });
      const r = orig(...a);
      window.__ux.calls.push({ fn: 'enterDetailMode:return', after: s.isDetailMode });
      return r;
    };
    return true;
  })()`);

  const report = {};

  // CDP 单击（选中）——定位用 .box 矩形中心（img 可能 0×0 懒加载未就绪）
  const thumb = await evaluate(`(() => { const box = document.querySelector('.box'); const r = box.getBoundingClientRect(); return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + Math.min(r.height/2, 60)), rect: { w: Math.round(r.width), h: Math.round(r.height) } }; })()`);
  await sendT('Input.dispatchMouseEvent', { type: 'mousePressed', x: thumb.x, y: thumb.y, button: 'left', clickCount: 1 });
  await sendT('Input.dispatchMouseEvent', { type: 'mouseReleased', x: thumb.x, y: thumb.y, button: 'left', clickCount: 1 });
  await delay(500);
  report.afterFirstClick = await evaluate(`(() => { const s = window.$bodyScope; return { selected: s.selected.length, events: window.__ux.events.slice() }; })()`);
  console.log('[click1] ' + JSON.stringify(report.afterFirstClick));

  // CDP 第二击（clickCount=2 → 应产生 dblclick）
  await sendT('Input.dispatchMouseEvent', { type: 'mousePressed', x: thumb.x, y: thumb.y, button: 'left', clickCount: 2 });
  await sendT('Input.dispatchMouseEvent', { type: 'mouseReleased', x: thumb.x, y: thumb.y, button: 'left', clickCount: 2 });
  await delay(1000);
  report.afterSecondClick = await evaluate(`(() => { const s = window.$bodyScope; return { isDetailMode: !!s.isDetailMode, events: window.__ux.events.slice(), calls: window.__ux.calls.slice(), errors: window.__ux.errors.slice(0, 5) }; })()`);
  console.log('[click2] ' + JSON.stringify(report.afterSecondClick, null, 1));

  console.log('UX_PROBE9_REPORT ' + JSON.stringify({ afterFirstClick: report.afterFirstClick, afterSecondClick: report.afterSecondClick }, null, 1));
} catch (err) {
  failure = err;
  console.error(`UX_PROBE9_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
