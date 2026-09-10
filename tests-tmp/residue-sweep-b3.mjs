import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// 残余扫查 B3：甄别轮。B/B2 的 FAIL 已考据为探针信号错误（toggle-all=侧栏开关、
// 快速搜索=J 键非 Ctrl+F、评级字段=star 非 rating）。本轮用正确信号重测 +
// 侧栏文件夹点击带 clickNode 间谍甄别真伪。
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-sweepb3-'));
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
const watchdog = setTimeout(() => { console.log('SWEEP_B3_WATCHDOG'); process.exit(2); }, 480000);

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
      await post('/api/library/create', { name: 'SweepB3', savePath: librariesRoot });
      const colors = [[25, 60, 210], [30, 180, 90], [200, 120, 30]];
      const images = [];
      for (let i = 0; i < 3; i++) {
        const p = path.join(sourcesRoot, `SweepB ${i + 1}.png`);
        createPng(p, colors[i]);
        images.push({ path: p, name: `SweepB ${i + 1}` });
      }
      await post('/api/item/addFromPaths', { images });
      const folderA = await post('/api/folder/create', { name: '设计参考' });
      const sub = await post('/api/folder/create', { name: '子文件夹', parent: folderA.id });
      // 给文件夹放一张图，切进去 boxes 应为 1——切换成功的强信号
      await post('/api/item/addFromPaths', { images: [{ path: images[0].path.replace(sourcesRoot, sourcesRoot + '/copy-src').replace(/copy-src/, sourcesRoot), name: 'x' }] }).catch(() => null);
      await post('/api/item/moveToFolder', { ids: [], folderId: folderA.id }).catch(() => null);
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
    window.addEventListener('error', (e) => { window.__uxErrors.push(String(e.message).slice(0, 160)); });
    window.addEventListener('unhandledrejection', (e) => { window.__uxErrors.push('rejection: ' + String(e.reason && e.reason.message || e.reason).slice(0, 160)); });
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
    console.log(`SWEEP_B3_STEP ${JSON.stringify({ name, outcome, detail: detail && detail.detail ? detail.detail : detail })}`);
    return { outcome, detail };
  };

  // T1 侧栏文件夹点击（带 clickNode 间谍 + 行结构 dump）
  await step('T1-folder-click-spy', async () => {
    const found = await evaluate(`(() => {
      const c = document.getElementById('sidebar-item-container');
      if (!c) return null;
      const name = Array.from(c.querySelectorAll('.name')).filter((e) => e.textContent.trim() === '设计参考')[0];
      if (!name) return { missing: true };
      const row = name.closest('.item');
      return { rowCls: String(row.className), rowRect: (function (r) { return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })(row.getBoundingClientRect()), path: (function (e) { const a = []; while (e && a.length < 6) { a.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + '.' + String(e.className).split(' ').slice(0, 2).join('.')); e = e.parentElement; } return a.join(' < '); })(row) };
    })()`);
    if (!found || found.missing) return { pass: false, detail: { found } };
    await evaluate(`(() => { window.__clickNodeCalls = []; const s = window.$bodyScope; const orig = s.clickNode; if (typeof orig === 'function') { s.clickNode = function () { window.__clickNodeCalls.push(Array.from(arguments).map((a) => a && a.id ? a.id : typeof a)); return orig.apply(this, arguments); }; } return typeof orig; })()`);
    await press(found.rowRect.x, found.rowRect.y, 'left', 1);
    await delay(2500);
    const after = await evaluate(`(() => ({ hash: location.hash, boxes: document.querySelectorAll('.box').length, calls: window.__clickNodeCalls, err: window.__uxErrors.length }))()`);
    return { pass: after.hash !== '#!/\\?view=all' && after.hash !== '#!/?view=all', detail: { found, after } };
  });

  // T2 toggle-all → 侧栏开合（真实信号）
  await step('T2-toggle-all-sidebar', async () => {
    const before = await evaluate(`(() => { const sb = document.getElementById('sidebar'); return { w: sb.getBoundingClientRect().width, disp: getComputedStyle(sb).display }; })()`);
    const center = await rectCenter(`document.getElementById('toggle-all-btn')`);
    if (!center) return { pass: false, detail: 'btn missing' };
    await press(center.x, center.y, 'left', 1);
    await delay(900);
    const after = await evaluate(`(() => { const sb = document.getElementById('sidebar'); return { w: sb.getBoundingClientRect().width, disp: getComputedStyle(sb).display }; })()`);
    await press(center.x, center.y, 'left', 1); // 复原
    await delay(600);
    return { pass: before.w !== after.w, detail: { before, after } };
  });

  // T3 颜色 filter-item 点击 → 菜单展开
  await step('T3-color-filter-item', async () => {
    const item = await evaluate(`(() => { const items = Array.from(document.querySelectorAll('#eagle-filter-toolbar-host .filter-item')).filter((e) => getComputedStyle(e).display !== 'none' && e.offsetParent !== null); const names = items.map((e) => (e.querySelector('.name') || {}).textContent); return { count: items.length, names: names.slice(0, 8) }; })()`);
    const center = await rectCenter(`(function () { const items = Array.from(document.querySelectorAll('#eagle-filter-toolbar-host .filter-item')).filter(function (e) { return getComputedStyle(e).display !== 'none' && e.offsetParent !== null; }); const el = items[0]; return el ? (el.querySelector('.name') || el) : null; })()`);
    if (!center) return { pass: false, detail: { item, note: 'no visible filter-item' } };
    await press(center.x, center.y, 'left', 1);
    await delay(900);
    const menu = await evaluate(`(() => { const e = document.querySelector('#eagle-filter-toolbar-host .filter-item .menu-wrap'); return e ? { disp: getComputedStyle(e).display, vis: e.getBoundingClientRect().height > 0 } : null; })()`);
    await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    return { pass: !!(menu && menu.vis), detail: { item, menu } };
  });

  // T4 J 键 → 快速搜索面板（正确绑定键）
  await step('T4-quicksearch-j-key', async () => {
    await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'j', code: 'KeyJ', windowsVirtualKeyCode: 74 });
    await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: 'j', code: 'KeyJ', windowsVirtualKeyCode: 74 });
    const opened = await waitFor(async () => {
      const r = await evaluate(`(() => { const e = document.getElementById('quick-search-panel'); return e ? { disp: getComputedStyle(e).display, op: getComputedStyle(e).opacity, vis: e.getBoundingClientRect().height > 0 } : null; })()`);
      return r && r.vis ? r : null;
    }, 'quick search open', 8000).catch(() => null);
    let typed = null;
    if (opened) {
      const inp = await rectCenter(`document.getElementById('quick-search-input')`);
      if (inp) { await press(inp.x, inp.y, 'left', 1); await sendT('Input.insertText', { text: 'SweepB' }); await delay(1200); }
      typed = await evaluate(`(() => { const e = document.getElementById('quick-search-input'); return { v: e ? e.value : null, results: document.querySelectorAll('#quick-search-panel .search-result').length }; })()`);
      await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    }
    return { pass: !!opened, detail: { opened, typed } };
  });

  // T5 评级键（0-5 → star 字段）
  await step('T5-rating-star-keys', async () => {
    const c1 = await rectCenter(`document.querySelector('.box.ext-png')`);
    if (!c1) return { pass: false, detail: 'no box' };
    await press(c1.x, c1.y, 'left', 1);
    await delay(400);
    const selBefore = await evaluate(`(() => { const s = window.$bodyScope; const it = s.selected && s.selected[0]; return it ? { name: it.name, star: it.star } : null; })()`);
    await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: '3', code: 'Digit3', windowsVirtualKeyCode: 51 });
    await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: '3', code: 'Digit3', windowsVirtualKeyCode: 51 });
    await delay(1200);
    const selAfter = await evaluate(`(() => { const s = window.$bodyScope; const it = s.selected && s.selected[0]; return it ? { name: it.name, star: it.star } : null; })()`);
    await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: '0', code: 'Digit0', windowsVirtualKeyCode: 48 });
    await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: '0', code: 'Digit0', windowsVirtualKeyCode: 48 });
    await delay(800);
    const selReset = await evaluate(`(() => { const s = window.$bodyScope; const it = s.selected && s.selected[0]; return it ? { star: it.star } : null; })()`);
    return { pass: !!(selAfter && selAfter.star === 3), detail: { selBefore, selAfter, selReset } };
  });

  // T6 mod+a 全选（键盘层 selectAll）
  await step('T6-mod-a-select-all', async () => {
    await sendT('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 2, key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65 });
    await sendT('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 2, key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65 });
    const sel = await waitFor(async () => {
      const r = await evaluate(`(() => { const s = window.$bodyScope; return s.selected ? s.selected.length : -1; })()`);
      return r >= 3 ? r : null;
    }, 'select all', 6000).catch(() => null);
    return { pass: !!sel, detail: { selected: sel } };
  });

  // T7 'r' 随机刷新（refreshRandom 键盘链）
  await step('T7-r-refresh', async () => {
    const before = await evaluate(`document.querySelectorAll('.box').length`);
    await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'r', code: 'KeyR', windowsVirtualKeyCode: 82 });
    await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: 'r', code: 'KeyR', windowsVirtualKeyCode: 82 });
    await delay(2500);
    const after = await evaluate(`(() => ({ boxes: document.querySelectorAll('.box').length, err: window.__uxErrors.length }))()`);
    return { pass: after.err === 0, detail: { before, after } };
  });

  await delay(1000);
  console.log(`SWEEP_B3_ERRORS ${JSON.stringify(await evaluate(`window.__uxErrors.slice(0, 12)`))}`);
  const failed = results.filter((r) => r.outcome === 'FAIL');
  console.log(`SWEEP_B3_SUMMARY ${JSON.stringify({ steps: results.length, failed: failed.length, names: results.map((r) => r.name + ':' + r.outcome) })}`);
  fs.writeFileSync(path.join(projectRoot, 'tests-tmp', 'residue-sweep-b3-out.json'), JSON.stringify(results, null, 1));
}

try {
  await main();
  console.log(`SWEEP_B3_OK`);
} catch (err) {
  failure = err;
  console.error(`SWEEP_B3_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
