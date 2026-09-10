import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// 残余扫查 B6：clickNode 断点铁证轮。
// X1 编译产物考据：vite transformed controllerFns 中 dragCheck 的编译形态
// X2 间谍实时捕获 window.dragCheck @clickNode 调用时
// X3 干净事件对象直调 clickNode（隔离 handler vs 事件）
// X4 盖住 toggle-all 的无类名 DIV 祖先链（用户也点不到 → 真 bug 定位）
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-sweepb6-'));
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
const results = [];
const watchdog = setTimeout(() => { console.log('SWEEP_B6_WATCHDOG'); process.exit(2); }, 480000);

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
      await post('/api/library/create', { name: 'SweepB6', savePath: librariesRoot });
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
  const { page, vitePort } = stack;
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
    const r = await evaluate(`(() => { const e = (${expression}); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }; })()`);
    return r || null;
  };

  await sendT('Runtime.enable');
  await waitFor(async () => (await evaluate(`document.readyState`)) === 'complete', 'ready', 60000);
  await waitFor(async () => (await evaluate(`!!window.$bodyScope`)) === true, 'scope', 60000);
  await waitFor(async () => {
    const n = await evaluate(`document.querySelectorAll('.box').length`);
    return typeof n === 'number' && n >= 3 ? n : null;
  }, 'boxes', 60000);
  await evaluate(`(() => {
    window.__uxErrors = [];
    window.addEventListener('error', (e) => { window.__uxErrors.push(String(e.message).slice(0, 200)); });
    window.addEventListener('unhandledrejection', (e) => { window.__uxErrors.push('rejection: ' + String(e.reason && e.reason.message || e.reason).slice(0, 200)); });
    return true;
  })()`);
  await delay(1200);

  const step = async (name, fn) => {
    let outcome = 'PASS', detail = null;
    try {
      detail = await fn();
      if (detail && detail.pass === false) outcome = 'FAIL';
    } catch (err) {
      outcome = 'FAIL';
      detail = { error: String(err.message).slice(0, 300) };
    }
    results.push({ name, outcome, detail: detail && detail.detail ? detail.detail : detail });
    console.log(`SWEEP_B6_STEP ${JSON.stringify({ name, outcome, detail: detail && detail.detail ? detail.detail : detail })}`);
    return { outcome, detail };
  };

  // X1 编译产物中 dragCheck 形态
  await step('X1-compiled-dragcheck', async () => {
    const resp = await fetch(`http://127.0.0.1:${vitePort}/src/app/react/core/controllerFns.ts`);
    const text = await resp.text();
    const idxs = [];
    let i = text.indexOf('dragCheck');
    while (i !== -1 && idxs.length < 8) { idxs.push(i); i = text.indexOf('dragCheck', i + 1); }
    const contexts = idxs.map((idx) => text.slice(Math.max(0, idx - 120), idx + 80).replace(/\n/g, '⏎'));
    const globalRefs = [];
    let j = text.indexOf('window.dragCheck');
    while (j !== -1 && globalRefs.length < 5) { globalRefs.push(text.slice(Math.max(0, j - 60), j + 40).replace(/\n/g, '⏎')); j = text.indexOf('window.dragCheck', j + 1); }
    return { pass: contexts.length > 0, detail: { count: idxs.length, contexts, globalRefs } };
  });

  // X2 clickNode 调用时实时 dragCheck + X3 干净事件直调
  await step('X2-X3-clicknode-direct', async () => {
    await evaluate(`(() => {
      window.__x = { calls: [], openFolder: 0, dragAtCall: [] };
      const s = window.$bodyScope;
      const cn = s.clickNode;
      s.clickNode = function (event, folder) {
        window.__x.dragAtCall.push(typeof window.dragCheck !== 'undefined' ? window.dragCheck : 'undef');
        window.__x.calls.push('in');
        const r = cn.apply(this, arguments);
        window.__x.calls.push('out:' + String(r));
        return r;
      };
      const ofn = s.openFolder;
      s.openFolder = function () { window.__x.openFolder += 1; return ofn.apply(this, arguments); };
      return true;
    })()`);
    // 真实点击（保留基线行为）
    const row = await rectCenter(`(function () { const c = document.getElementById('sidebar-item-container'); if (!c) return null; const name = Array.from(c.querySelectorAll('.name')).filter(function (e) { return e.textContent.trim() === '设计参考'; })[0]; return name ? name.closest('.item') : null; })()`);
    if (row) { await press(row.x, row.y, 'left', 1); await delay(2000); }
    const afterReal = await evaluate(`(() => ({ x: window.__x, hash: location.hash, cf: window.$bodyScope.currentFolder ? window.$bodyScope.currentFolder.name : null }))()`);
    // 干净事件直调
    const direct = await evaluate(`(() => {
      const s = window.$bodyScope;
      const live = s.sidebarList.filter(function (n) { return n && n.name === '设计参考'; })[0];
      if (!live) return { err: 'no live node', list: s.sidebarList.slice(0, 12).map((n) => n && n.name) };
      const before = window.__x.openFolder;
      try {
        s.clickNode({ type: 'click', which: 1, button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, stopPropagation: function () {} }, live);
      } catch (err) { return { err: String(err && err.message || err).slice(0, 200) }; }
      return { openFolderFired: window.__x.openFolder > before, dragAtCall: window.__x.dragAtCall };
    })()`);
    await delay(2500);
    const afterDirect = await evaluate(`(() => ({ x: window.__x, hash: location.hash, cf: window.$bodyScope.currentFolder ? window.$bodyScope.currentFolder.name : null, boxes: document.querySelectorAll('.box').length, err: window.__uxErrors }))()`);
    return { pass: true, detail: { afterReal, direct, afterDirect } };
  });

  // X4 toggle-all 遮挡物祖先链
  await step('X4-toggle-all-cover', async () => {
    const info = await evaluate(`(() => {
      const b = document.querySelector('#eagle-toolbar-host #toggle-all-btn');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      if (!el) return { none: true };
      const chain = [];
      let e = el;
      while (e && chain.length < 8) {
        const st = getComputedStyle(e);
        chain.push({ tag: e.tagName.toLowerCase() + (e.id ? '#' + e.id : ''), cls: String(e.className).slice(0, 50), pe: st.pointerEvents, pos: st.position, z: st.zIndex, rect: (function (q) { return { x: Math.round(q.x), y: Math.round(q.y), w: Math.round(q.width), h: Math.round(q.height) }; })(e.getBoundingClientRect()) });
        e = e.parentElement;
      }
      return { hit: el.tagName + '.' + String(el.className).slice(0, 40), chain, btnRect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
    })()`);
    return { pass: !!info, detail: info };
  });

  await delay(800);
  console.log(`SWEEP_B6_ERRORS ${JSON.stringify(await evaluate(`window.__uxErrors.slice(0, 10)`))}`);
  const failed = results.filter((r) => r.outcome === 'FAIL');
  console.log(`SWEEP_B6_SUMMARY ${JSON.stringify({ steps: results.length, failed: failed.length, names: results.map((r) => r.name + ':' + r.outcome) })}`);
  fs.writeFileSync(path.join(projectRoot, 'tests-tmp', 'residue-sweep-b6-out.json'), JSON.stringify(results, null, 1));
}

try {
  await main();
  console.log(`SWEEP_B6_OK`);
} catch (err) {
  failure = err;
  console.error(`SWEEP_B6_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
