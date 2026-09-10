import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// 残余扫查 B4：决定性甄别。B3 结论：clickNode 已触发但 openFolder 链未走完（spy +
// folderMappings 检查定位断点）；toggleAll 置 isHideSidebar（spy + 状态/DOM 双观测）；
// J 键/评级键用带 text 的 CDP keyDown（产生 keypress——Mousetrap 字符键监听 keypress）。
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-sweepb4-'));
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
const watchdog = setTimeout(() => { console.log('SWEEP_B4_WATCHDOG'); process.exit(2); }, 480000);

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
      await post('/api/library/create', { name: 'SweepB4', savePath: librariesRoot });
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
      detail = { error: String(err.message).slice(0, 260) };
    }
    results.push({ name, outcome, detail: detail && detail.detail ? detail.detail : detail });
    console.log(`SWEEP_B4_STEP ${JSON.stringify({ name, outcome, detail: detail && detail.detail ? detail.detail : detail })}`);
    return { outcome, detail };
  };

  // U1 openFolder 链甄别：clickNode 间谍 + openFolder 间谍 + folderMappings/dragCheck 检查
  await step('U1-openfolder-chain', async () => {
    const pre = await evaluate(`(() => { const s = window.$bodyScope; return { hasOpenFolder: typeof s.openFolder, hasClickNode: typeof s.clickNode, dragCheck: typeof window.dragCheck !== 'undefined' ? window.dragCheck : 'undef-global', mappingsSample: s.folderMappings ? Object.keys(s.folderMappings).slice(0, 8) : null, mappingHasTarget: s.folderMappings ? Object.keys(s.folderMappings).filter((k) => k.indexOf('FGCWKCU3') !== -1 || s.folderMappings[k] && s.folderMappings[k].name === '设计参考') : null }; })()`);
    await evaluate(`(() => { window.__sp = { clickNode: [], openFolder: [], openFolderRet: [] }; const s = window.$bodyScope; const cn = s.clickNode; s.clickNode = function () { window.__sp.clickNode.push('called'); const r = cn.apply(this, arguments); window.__sp.clickNode.push('returned'); return r; }; const of2 = s.openFolder; s.openFolder = function (fd, ig, cid) { window.__sp.openFolder.push({ id: fd && fd.id, ignoreHistory: ig, currentId: cid }); const r = of2.apply(this, arguments); window.__sp.openFolderRet.push(String(r)); return r; }; return true; })()`);
    const row = await rectCenter(`(function () { const c = document.getElementById('sidebar-item-container'); if (!c) return null; const name = Array.from(c.querySelectorAll('.name')).filter(function (e) { return e.textContent.trim() === '设计参考'; })[0]; if (!name) return null; return name.closest('.item'); })()`);
    if (!row) return { pass: false, detail: { pre, note: 'row not found' } };
    await press(row.x, row.y, 'left', 1);
    await delay(3000);
    const after = await evaluate(`(() => ({ sp: window.__sp, hash: location.hash, boxes: document.querySelectorAll('.box').length, cf: window.$bodyScope.currentFolder ? window.$bodyScope.currentFolder.name : null, err: window.__uxErrors }))()`);
    return { pass: after.sp.openFolder.length > 0 && after.sp.openFolderRet[0] !== 'undefined', detail: { pre, after } };
  });

  // U2 toggleAll 甄别：间谍 + isHideSidebar + body/sidebar class 观测
  await step('U2-toggle-all-state', async () => {
    const pre = await evaluate(`(() => { const s = window.$bodyScope; return { has: typeof s.toggleAll, hide: s.isHideSidebar, bodyCls: document.body.className.slice(0, 160), sbCls: document.getElementById('sidebar').className.slice(0, 120) }; })()`);
    await evaluate(`(() => { window.__sp2 = []; const s = window.$bodyScope; const t = s.toggleAll; s.toggleAll = function () { window.__sp2.push('called'); const r = t.apply(this, arguments); window.__sp2.push('ret:' + String(r)); return r; }; return true; })()`);
    const center = await rectCenter(`document.querySelector('#eagle-toolbar-host #toggle-all-btn')`);
    if (!center) return { pass: false, detail: { pre, note: 'toolbar toggle-all-btn not found' } };
    await press(center.x, center.y, 'left', 1);
    await delay(1500);
    const post = await evaluate(`(() => { const s = window.$bodyScope; return { sp: window.__sp2, hide: s.isHideSidebar, bodyCls: document.body.className.slice(0, 160), sbCls: document.getElementById('sidebar').className.slice(0, 120), sbW: document.getElementById('sidebar').getBoundingClientRect().width, err: window.__uxErrors.length }; })()`);
    const center2 = await rectCenter(`document.querySelector('#eagle-toolbar-host #toggle-all-btn')`);
    if (center2) { await press(center2.x, center2.y, 'left', 1); await delay(1000); }
    const restored = await evaluate(`(() => ({ hide: window.$bodyScope.isHideSidebar, sbW: document.getElementById('sidebar').getBoundingClientRect().width }))()`);
    return { pass: post.sp.length > 0 && post.hide !== pre.hide, detail: { pre, post, restored } };
  });

  // U3 J 键（带 text → keypress）→ 快速搜索
  await step('U3-quicksearch-j-keypress', async () => {
    await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'j', code: 'KeyJ', windowsVirtualKeyCode: 74, text: 'j', unmodifiedText: 'j' });
    await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: 'j', code: 'KeyJ', windowsVirtualKeyCode: 74 });
    const opened = await waitFor(async () => {
      const r = await evaluate(`(() => { const e = document.getElementById('quick-search-panel'); return e ? { vis: e.getBoundingClientRect().height > 0, op: getComputedStyle(e).opacity, cls: String(e.className).slice(0, 80) } : null; })()`);
      return r && r.vis ? r : null;
    }, 'quick search', 8000).catch(() => null);
    if (opened) {
      const inp = await rectCenter(`document.getElementById('quick-search-input')`);
      if (inp) { await press(inp.x, inp.y, 'left', 1); await sendT('Input.insertText', { text: 'SweepB' }); await delay(1200); }
      const typed = await evaluate(`(() => { const e = document.getElementById('quick-search-input'); return { v: e ? e.value : null, results: document.querySelectorAll('#quick-search-panel .search-result').length, err: window.__uxErrors.length }; })()`);
      await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      return { pass: true, detail: { opened, typed } };
    }
    return { pass: false, detail: { note: 'panel never visible after J (with text)' } };
  });

  // U4 评级键（带 text）→ star
  await step('U4-rating-star-keypress', async () => {
    const c1 = await rectCenter(`document.querySelector('.box.ext-png')`);
    if (!c1) return { pass: false, detail: 'no box' };
    await press(c1.x, c1.y, 'left', 1);
    await delay(400);
    await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: '3', code: 'Digit3', windowsVirtualKeyCode: 51, text: '3', unmodifiedText: '3' });
    await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: '3', code: 'Digit3', windowsVirtualKeyCode: 51 });
    const st = await waitFor(async () => {
      const r = await evaluate(`(() => { const s = window.$bodyScope; const it = s.selected && s.selected[0]; return it ? it.star : null; })()`);
      return r === 3 ? r : null;
    }, 'star=3', 6000).catch(() => null);
    return { pass: st === 3, detail: { star: st } };
  });

  // U5 filter toolbar 可见性考据（host 与 items 的真实可见状态）
  await step('U5-filter-toolbar-visibility', async () => {
    const state = await evaluate(`(() => { const h = document.getElementById('eagle-filter-toolbar-host'); if (!h) return null; const items = Array.from(h.querySelectorAll('.filter-item')); return { hostCls: String(h.className), hostDisp: getComputedStyle(h).display, hostRect: (function (r) { return { w: Math.round(r.width), h: Math.round(r.height) }; })(h.getBoundingClientRect()), itemCount: items.length, visibleItems: items.filter(function (e) { return e.getBoundingClientRect().height > 0; }).length, itemNames: items.map(function (e) { var n = e.querySelector('.name'); return n ? n.textContent.trim().slice(0, 10) : '?'; }).slice(0, 10) }; })()`);
    return { pass: !!state, detail: state };
  });

  // U6 'r' refreshRandom（带 text 甄别键确实触发）
  await step('U6-r-key-refreshrandom', async () => {
    await evaluate(`(() => { window.__sp3 = []; const s = window.$bodyScope; const f = s.refreshRandom; if (typeof f === 'function') { s.refreshRandom = function () { window.__sp3.push('called'); return f.apply(this, arguments); }; } return typeof f; })()`);
    await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'r', code: 'KeyR', windowsVirtualKeyCode: 82, text: 'r', unmodifiedText: 'r' });
    await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: 'r', code: 'KeyR', windowsVirtualKeyCode: 82 });
    await delay(2000);
    const r = await evaluate(`(() => ({ sp: window.__sp3, err: window.__uxErrors.length, boxes: document.querySelectorAll('.box').length }))()`);
    return { pass: r.sp.length > 0, detail: r };
  });

  await delay(1000);
  console.log(`SWEEP_B4_ERRORS ${JSON.stringify(await evaluate(`window.__uxErrors.slice(0, 12)`))}`);
  const failed = results.filter((r) => r.outcome === 'FAIL');
  console.log(`SWEEP_B4_SUMMARY ${JSON.stringify({ steps: results.length, failed: failed.length, names: results.map((r) => r.name + ':' + r.outcome) })}`);
  fs.writeFileSync(path.join(projectRoot, 'tests-tmp', 'residue-sweep-b4-out.json'), JSON.stringify(results, null, 1));
}

try {
  await main();
  console.log(`SWEEP_B4_OK`);
} catch (err) {
  failure = err;
  console.error(`SWEEP_B4_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
