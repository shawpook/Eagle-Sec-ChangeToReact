import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// 残余扫查 B2：B 轮 4 个 FAIL 的甄别轮（探针信号修正 + 结构发现）。
// S1 侧栏切文件夹 / S2 toggle-all / S4 filter-toolbar / S7 quick-search(modifiers 修正)
// + 评级键缺口考据 + 工具栏视图切换按钮发现。全零未捕获错误基线下甄别真 bug。
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-sweepb2-'));
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
const watchdog = setTimeout(() => { console.log('SWEEP_B2_WATCHDOG'); process.exit(2); }, 480000);

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
      await post('/api/library/create', { name: 'SweepB2', savePath: librariesRoot });
      const colors = [[25, 60, 210], [30, 180, 90], [200, 120, 30]];
      const images = [];
      for (let i = 0; i < 3; i++) {
        const p = path.join(sourcesRoot, `SweepB ${i + 1}.png`);
        createPng(p, colors[i]);
        images.push({ path: p, name: `SweepB ${i + 1}` });
      }
      await post('/api/item/addFromPaths', { images });
      const folderA = await post('/api/folder/create', { name: '设计参考' });
      await post('/api/folder/create', { name: '子文件夹', parent: folderA.id });
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
    if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.exception?.description?.slice(0, 200)}`);
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
    console.log(`SWEEP_B2_STEP ${JSON.stringify({ name, outcome, detail: detail && detail.detail ? detail.detail : detail })}`);
    return { outcome, detail };
  };

  // D1 侧栏结构发现
  await step('D1-sidebar-structure', async () => {
    const html = await evaluate(`(() => { const c = document.getElementById('sidebar-item-container'); return c ? c.innerHTML.replace(/<svg[\\s\\S]*?<\\/svg>/g, '[svg]').slice(0, 2600) : null; })()`);
    return { pass: !!html, detail: { html } };
  });

  // D2 侧栏文件夹点击 → URL hash 变化甄别（folder id 路由信号，绕开 scope 字段名不确定）
  await step('D2-folder-click-hash', async () => {
    const hashBefore = await evaluate(`location.hash`);
    const center = await rectCenter(`(function () { const c = document.getElementById('sidebar-item-container'); if (!c) return null; const el = Array.from(c.querySelectorAll('*')).filter((e) => e.childElementCount === 0 && e.textContent.trim() === '设计参考')[0]; if (!el) return null; return el.closest('li') || el.closest('[class*="item"]') || el; })()`);
    if (!center) return { pass: false, detail: 'folder row not located' };
    await press(center.x, center.y, 'left', 1);
    await delay(2000);
    const hashAfter = await evaluate(`location.hash`);
    const boxes = await evaluate(`document.querySelectorAll('.box').length`);
    const state = await evaluate(`(() => { const s = window.$bodyScope; return { cfid: s.currentFolderID, cf: s.currentFolder, parent: s.parentFolderID, searchFilter: typeof s.searchFilter }; })()`);
    return { pass: hashBefore !== hashAfter, detail: { hashBefore, hashAfter, boxes, state } };
  });

  // D3 toggle-all 按钮考据（outerHTML + 点击前后 selected/hash）
  await step('D3-toggle-all-probe', async () => {
    const html = await evaluate(`(() => { const e = document.getElementById('toggle-all-btn'); return e ? { outer: e.outerHTML.slice(0, 300), parentCls: e.parentElement ? e.parentElement.className : null, parentOuter: e.parentElement ? e.parentElement.outerHTML.slice(0, 600) : null } : null; })()`);
    const before = await evaluate(`(() => { const s = window.$bodyScope; return { sel: s.selected ? s.selected.length : -1, hash: location.hash }; })()`);
    const center = await rectCenter(`document.getElementById('toggle-all-btn')`);
    if (center) { await press(center.x, center.y, 'left', 1); await delay(900); }
    const after = await evaluate(`(() => { const s = window.$bodyScope; return { sel: s.selected ? s.selected.length : -1, hash: location.hash, boxes: document.querySelectorAll('.box').length }; })()`);
    return { pass: true, detail: { html, before, after } };
  });

  // D4 filter-btn 考据（按钮类 + host 内容前后）
  await step('D4-filter-btn-probe', async () => {
    const btnInfo = await evaluate(`(() => { const b = document.querySelector('.filter-btn'); if (!b) return null; return { outer: b.outerHTML.slice(0, 240), parentCls: b.parentElement ? String(b.parentElement.className).slice(0, 80) : null }; })()`);
    const hostBefore = await evaluate(`(() => { const e = document.getElementById('eagle-filter-toolbar-host'); return e ? { cls: e.className, itemsHtml: (e.querySelector('.filter-items') || e).innerHTML.replace(/<svg[\\s\\S]*?<\\/svg>/g, '[svg]').slice(0, 900) } : null; })()`);
    const center = await rectCenter(`document.querySelector('.filter-btn')`);
    if (center) { await press(center.x, center.y, 'left', 1); await delay(900); }
    const hostAfter = await evaluate(`(() => { const e = document.getElementById('eagle-filter-toolbar-host'); return e ? { cls: e.className, itemsHtml: (e.querySelector('.filter-items') || e).innerHTML.replace(/<svg[\\s\\S]*?<\\/svg>/g, '[svg]').slice(0, 900) } : null; })()`);
    const btnClsAfter = await evaluate(`(() => { const b = document.querySelector('.filter-btn'); return b ? String(b.className) : null; })()`);
    return { pass: true, detail: { btnInfo, btnClsAfter, hostBefore: hostBefore && hostBefore.itemsHtml, hostAfter: hostAfter && hostAfter.itemsHtml, clsChanged: hostBefore && hostAfter && hostBefore.cls !== hostAfter.cls } };
  });

  // D5 工具栏右区（视图切换按钮发现：filter-right .ic-btns）
  await step('D5-toolbar-right-view-buttons', async () => {
    const html = await evaluate(`(() => { const e = document.querySelector('#eagle-filter-toolbar-host .filter-right'); return e ? e.outerHTML.replace(/<svg[\\s\\S]*?<\\/svg>/g, '[svg]').slice(0, 1600) : null; })()`);
    const hostHtml = await evaluate(`(() => { const e = document.getElementById('eagle-toolbar-host'); return e ? e.outerHTML.replace(/<svg[\\s\\S]*?<\\/svg>/g, '[svg]').slice(0, 1400) : null; })()`);
    return { pass: !!html || !!hostHtml, detail: { filterRight: html, toolbarHost: hostHtml } };
  });

  // S7r quick search（modifiers 整数位掩码修正）
  await step('S7r-quick-search-fixed', async () => {
    await sendT('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 2, key: 'f', code: 'KeyF', windowsVirtualKeyCode: 70 });
    await sendT('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 2, key: 'f', code: 'KeyF', windowsVirtualKeyCode: 70 });
    await delay(800);
    const panel = await evaluate(`(() => { const e = document.getElementById('quick-search-panel'); return e ? { cls: String(e.className).slice(0, 100), disp: getComputedStyle(e).display, vis: getComputedStyle(e).visibility, op: getComputedStyle(e).opacity } : null; })()`);
    let typed = null;
    if (panel) {
      const inp = await rectCenter(`document.getElementById('quick-search-input')`);
      if (inp) {
        await press(inp.x, inp.y, 'left', 1);
        await sendT('Input.insertText', { text: 'SweepB' });
        await delay(1200);
        typed = await evaluate(`(() => { const e = document.getElementById('quick-search-input'); return { v: e ? e.value : null, results: document.querySelectorAll('#quick-search-panel .search-result').length }; })()`);
      }
      await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    }
    return { pass: !!(panel && (panel.disp !== 'none' || panel.op !== '0')), detail: { panel, typed } };
  });

  // D6 评级链考据：详情模式数字键 + current 字段结构 + inspector 星级 DOM
  await step('D6-rating-chain-probe', async () => {
    const c1 = await rectCenter(`document.querySelector('.box.ext-png')`);
    if (!c1) return { pass: false, detail: 'no box' };
    await press(c1.x, c1.y, 'left', 1);
    await delay(150);
    await press(c1.x, c1.y, 'left', 2);
    const opened = await waitFor(async () => {
      const r = await evaluate(`(() => { const s = window.$bodyScope; return !!s.isDetailMode; })()`);
      return r ? r : null;
    }, 'detail', 12000).catch(() => null);
    if (!opened) return { pass: false, detail: 'detail not opened' };
    const curKeys = await evaluate(`(() => { const s = window.$bodyScope; return s.current ? Object.keys(s.current).slice(0, 60) : null; })()`);
    const stars = await evaluate(`(() => { const w = document.getElementById('eagle-detail-wrapper'); if (!w) return null; const els = w.querySelectorAll('[class*="star"], [class*="rating"], [class*="rate"]'); return Array.from(els).slice(0, 6).map((e) => ({ cls: String(e.className).slice(0, 70), kids: e.childElementCount })); })()`);
    await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: '3', code: 'Digit3', windowsVirtualKeyCode: 51 });
    await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: '3', code: 'Digit3', windowsVirtualKeyCode: 51 });
    await delay(1000);
    const rating = await evaluate(`(() => { const s = window.$bodyScope; const c = s.current || {}; return { rating: c.rating, name: c.name, selected0: s.selected && s.selected[0] ? s.selected[0].rating : null }; })()`);
    await evaluate(`window.postMessage('Exit', '*'); true`);
    await delay(800);
    return { pass: true, detail: { curKeys, stars, rating } };
  });

  await delay(1200);
  console.log(`SWEEP_B2_ERRORS ${JSON.stringify(await evaluate(`window.__uxErrors.slice(0, 12)`))}`);
  const failed = results.filter((r) => r.outcome === 'FAIL');
  console.log(`SWEEP_B2_SUMMARY ${JSON.stringify({ steps: results.length, failed: failed.length, names: results.map((r) => r.name + ':' + r.outcome) })}`);
  fs.writeFileSync(path.join(projectRoot, 'tests-tmp', 'residue-sweep-b2-out.json'), JSON.stringify(results, null, 1));
}

try {
  await main();
  console.log(`SWEEP_B2_OK`);
} catch (err) {
  failure = err;
  console.error(`SWEEP_B2_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
