import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bootStack, stop, waitFor, delay, connect } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// 残余扫查 B：逐面真机走查。安全边界（menu-popup-closed-loop 教训）：
// 原生 Menu.popup 会阻塞 CDP 会话——应用菜单/文件夹右键/侧栏添加等原生菜单面
// 一律不真点（内容断言已由 menu-popup 套件 main 侧捕获覆盖）；本扫查只驱动
// DOM 交互面 + 偏好设置窗（ipc 'open.preferences' → 独立 BrowserWindow target）。
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-residue-sweepb-'));
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
const fatalPatterns = /ReferenceError|TypeError|SyntaxError|is not a function|is not defined|Cannot read|Cannot access|Cannot convert|undefined is not|null is not/i;
const watchdog = setTimeout(() => { console.log('SWEEP_B_WATCHDOG'); process.exit(2); }, 480000);

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
      await post('/api/library/create', { name: 'SweepB', savePath: librariesRoot });
      const colors = [[25, 60, 210], [30, 180, 90], [200, 120, 30]];
      const images = [];
      for (let i = 0; i < 3; i++) {
        const p = path.join(sourcesRoot, `SweepB ${i + 1}.png`);
        createPng(p, colors[i]);
        images.push({ path: p, name: `SweepB ${i + 1}` });
      }
      const txtPath = path.join(sourcesRoot, 'notes.txt');
      fs.writeFileSync(txtPath, 'sweep b fixture text\n');
      images.push({ path: txtPath, name: 'notes' });
      await post('/api/item/addFromPaths', { images });
      const folderA = await post('/api/folder/create', { name: '设计参考' });
      await post('/api/folder/create', { name: '子文件夹', parent: folderA.id });
      await post('/api/tag/create', { name: 'sweep-tag' });
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
  const errCount = async () => evaluate(`window.__uxErrors ? window.__uxErrors.length : -1`);
  const fatalCount = async () => evaluate(`window.__uxErrors ? window.__uxErrors.filter((m) => /ReferenceError|TypeError|SyntaxError|is not a function|is not defined|Cannot read|Cannot access|Cannot convert|undefined is not|null is not/i.test(m)).length : -1`);

  await sendT('Runtime.enable');
  await waitFor(async () => (await evaluate(`document.readyState`)) === 'complete', 'ready', 60000);
  await waitFor(async () => (await evaluate(`!!window.$bodyScope`)) === true, 'scope', 60000);
  await waitFor(async () => {
    const n = await evaluate(`document.querySelectorAll('.box').length`);
    return typeof n === 'number' && n >= 4 ? n : null;
  }, 'boxes', 60000);
  await evaluate(`(() => {
    window.__uxErrors = [];
    window.addEventListener('error', (e) => { window.__uxErrors.push(String(e.message).slice(0, 160)); });
    window.addEventListener('unhandledrejection', (e) => { window.__uxErrors.push('rejection: ' + String(e.reason && e.reason.message || e.reason).slice(0, 160)); });
    return true;
  })()`);
  await delay(1200);

  const step = async (name, fn) => {
    const before = await errCount();
    let outcome = 'PASS', detail = null;
    try {
      detail = await fn();
      if (detail && detail.pass === false) outcome = 'FAIL';
    } catch (err) {
      outcome = 'FAIL';
      detail = { error: String(err.message).slice(0, 220) };
    }
    await delay(500);
    const after = await errCount();
    const fatal = await fatalCount();
    const errDelta = (typeof after === 'number' && typeof before === 'number') ? after - before : 'unknown';
    const row = { name, outcome, errDelta, fatalErrors: fatal, detail: detail && detail.detail ? detail.detail : detail };
    results.push(row);
    console.log(`SWEEP_B_STEP ${JSON.stringify(row)}`);
    return row;
  };

  // ── 信号名探针（s 全量枚举受限，直接读候选字段）──
  await step('signal-probe', async () => {
    const sig = await evaluate(`(() => { const s = window.$bodyScope; const keys = ['viewType','currentFolderID','currentFolder','isDetailMode','imageSize','selected','current','searchFilter','isSearching','filterToolbar','orderBy','orderIncrease','items','library','rating']; const out = {}; for (const k of keys) { const v = s[k]; out[k] = v === undefined ? 'undef' : Array.isArray(v) ? ('arr:' + v.length) : typeof v === 'object' && v ? ('obj:' + Object.keys(v).slice(0, 4).join(',')) : String(v).slice(0, 40); } return out; })()`);
    return { pass: true, detail: sig };
  });

  // S1 侧栏文件夹切换（plain click 安全）
  await step('S1-sidebar-folder-switch', async () => {
    const before = await evaluate(`(() => { const s = window.$bodyScope; return { folder: s.currentFolder ? s.currentFolder.name : null, boxes: document.querySelectorAll('.box').length }; })()`);
    const center = await rectCenter(`(function () { const c = document.getElementById('sidebar-item-container'); if (!c) return null; const els = Array.from(c.querySelectorAll('*')).filter((e) => e.childElementCount === 0 && e.textContent.trim() === '设计参考'); const el = els[0]; if (!el) return null; return el.closest('[class*="item"]') || el; })()`);
    if (!center) return { pass: false, detail: 'sidebar folder element not found' };
    await press(center.x, center.y, 'left', 1);
    const after = await waitFor(async () => {
      const r = await evaluate(`(() => { const s = window.$bodyScope; return { folder: s.currentFolder ? s.currentFolder.name : null, boxes: document.querySelectorAll('.box').length }; })()`);
      return (r.folder === '设计参考' || (r.boxes === 0 && before.folder !== '设计参考')) ? r : null;
    }, 'folder switch', 12000).catch(() => null);
    return { pass: !!after, detail: { before, after } };
  });

  // S1b 回到全部（侧栏 all 项）——恢复后续步骤的网格环境
  await step('S1b-sidebar-back-to-all', async () => {
    const center = await rectCenter(`(function () { const c = document.getElementById('sidebar-item-container'); if (!c) return null; const els = Array.from(c.querySelectorAll('*')).filter((e) => e.childElementCount === 0 && /^(全部|All)$/i.test(e.textContent.trim())); const el = els[0]; if (!el) return null; return el.closest('[class*="item"]') || el; })()`);
    if (!center) return { pass: false, detail: 'all item not found' };
    await press(center.x, center.y, 'left', 1);
    const restored = await waitFor(async () => {
      const n = await evaluate(`document.querySelectorAll('.box').length`);
      return n >= 4 ? n : null;
    }, 'back to all', 12000).catch(() => null);
    return { pass: !!restored, detail: { boxes: restored } };
  });

  // S2 全选按钮
  await step('S2-toggle-all-select', async () => {
    const center = await rectCenter(`document.getElementById('toggle-all-btn')`);
    if (!center) return { pass: false, detail: 'toggle-all-btn not found' };
    await press(center.x, center.y, 'left', 1);
    const sel = await waitFor(async () => {
      const r = await evaluate(`(() => { const s = window.$bodyScope; return { n: s.selected ? s.selected.length : -1 }; })()`);
      return r.n >= 4 ? r : null;
    }, 'select all', 8000).catch(() => null);
    await press(center.x, center.y, 'left', 1); // 复位（可能两态）
    return { pass: !!sel, detail: sel || { note: 'selected length never reached 4' } };
  });

  // S3 缩放滑杆（sliders-bar 结构探查 + 按钮驱动）
  await step('S3-zoom-slider', async () => {
    const html = await evaluate(`(() => { const e = document.getElementById('box-list-slider'); return e ? e.outerHTML.slice(0, 800) : null; })()`);
    const before = await evaluate(`(() => { const s = window.$bodyScope; return s.imageSize ? s.imageSize.height : null; })()`);
    const btns = await evaluate(`(() => { const e = document.getElementById('box-list-slider'); if (!e) return []; return Array.from(e.querySelectorAll('.ic-btn, button, .btn')).map((b, i) => ({ i, cls: String(b.className).slice(0, 60), r: (function (q) { const b = q.getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }; })(b) })); })()`);
    let changed = null;
    for (const b of btns) {
      await press(b.r.x, b.r.y, 'left', 1);
      await delay(400);
      const now = await evaluate(`(() => { const s = window.$bodyScope; return s.imageSize ? s.imageSize.height : null; })()`);
      if (now !== null && before !== null && now !== before) { changed = { btn: b.i, cls: b.cls, before, after: now }; break; }
    }
    return { pass: !!changed, detail: { changed, btnCount: btns.length } };
  });

  // S4 过滤按钮（filter-toolbar 开合）
  await step('S4-filter-toolbar', async () => {
    const btn = await rectCenter(`(function () { const b = document.querySelector('#eagle-filter-toolbar-host ~ * .filter-btn, .filter-btn'); return b; })()`);
    if (!btn) return { pass: false, detail: 'filter-btn not found' };
    const visBefore = await evaluate(`(() => { const e = document.getElementById('eagle-filter-toolbar-host'); return e ? e.className + '|' + getComputedStyle(e).display : null; })()`);
    await press(btn.x, btn.y, 'left', 1);
    await delay(700);
    const visAfter = await evaluate(`(() => { const e = document.getElementById('eagle-filter-toolbar-host'); return e ? e.className + '|' + getComputedStyle(e).display : null; })()`);
    await press(btn.x, btn.y, 'left', 1); // 复位
    return { pass: visBefore !== visAfter, detail: { before: String(visBefore).slice(0, 100), after: String(visAfter).slice(0, 100) } };
  });

  // S5 搜索框输入
  await step('S5-search-input', async () => {
    const input = await evaluate(`(() => { const e = document.querySelector('.search-wrap input.search, .search-wrap input'); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }; })()`);
    if (!input) return { pass: false, detail: 'search input not found' };
    await press(input.x, input.y, 'left', 1);
    await sendT('Input.insertText', { text: 'SweepB' });
    await delay(1200);
    const state = await evaluate(`(() => { const s = window.$bodyScope; return { searchFilter: typeof s.searchFilter, boxes: document.querySelectorAll('.box').length, searching: s.isSearching === true }; })()`);
    await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    const cleared = await evaluate(`(() => { const e = document.querySelector('.search-wrap input'); return e ? e.value : null; })()`);
    return { pass: true, detail: { state, cleared } };
  });

  // S6 详情模式内部控制（旋转/前后导航/星级/退出）
  await step('S6-detail-controls', async () => {
    const c1 = await rectCenter(`(function () { const b = document.querySelector('.box.ext-png'); if (!b) return null; const r = b.getBoundingClientRect(); return b; })()`);
    if (!c1) return { pass: false, detail: 'no png box' };
    await press(c1.x, c1.y, 'left', 1);
    await delay(150);
    await press(c1.x, c1.y, 'left', 2);
    const opened = await waitFor(async () => {
      const r = await evaluate(`(() => { const s = window.$bodyScope; return { d: !!s.isDetailMode, name: s.current ? s.current.name : null }; })()`);
      return r.d ? r : null;
    }, 'detail open', 15000).catch(() => null);
    if (!opened) return { pass: false, detail: 'detail did not open' };
    const toolbar = await evaluate(`(() => { const w = document.getElementById('eagle-detail-wrapper'); if (!w) return null; const t = w.querySelector('.toolbar'); return t ? t.outerHTML.slice(0, 1200) : null; })()`);
    // 前后导航：真实按键 ArrowRight（键盘层）
    const nameBefore = opened.name;
    await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
    const next = await waitFor(async () => {
      const r = await evaluate(`(() => { const s = window.$bodyScope; return { name: s.current ? s.current.name : null }; })()`);
      return r.name && r.name !== nameBefore ? r : null;
    }, 'next item', 8000).catch(() => null);
    // 星级：数字键 3（mousetrap detail 层）
    await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: '3', code: 'Digit3', windowsVirtualKeyCode: 51 });
    await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: '3', code: 'Digit3', windowsVirtualKeyCode: 51 });
    await delay(900);
    const rating = await evaluate(`(() => { const s = window.$bodyScope; const c = s.current || {}; return { rating: c.rating ?? c.stars ?? null, name: c.name }; })()`);
    await evaluate(`window.postMessage('Exit', '*'); true`);
    const closed = await waitFor(async () => {
      const r = await evaluate(`(() => { const s = window.$bodyScope; return { d: !!s.isDetailMode }; })()`);
      return !r.d ? r : null;
    }, 'detail exit', 10000).catch(() => null);
    return { pass: !!next && !!closed, detail: { opened, next: next || null, rating, closed: !!closed, toolbarLen: toolbar ? toolbar.length : 0 } };
  });

  // S7 快速搜索面板（Ctrl+F）
  await step('S7-quick-search', async () => {
    await sendT('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: [2], key: 'f', code: 'KeyF', windowsVirtualKeyCode: 70 });
    await sendT('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: [2], key: 'f', code: 'KeyF', windowsVirtualKeyCode: 70 });
    await delay(800);
    const panel = await evaluate(`(() => { const e = document.getElementById('quick-search-panel'); return e ? { cls: e.className.slice(0, 80), vis: getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden', opacity: getComputedStyle(e).opacity } : null; })()`);
    let typed = null;
    if (panel && panel.vis) {
      await press(400, 300, 'left', 1);
      await sendT('Input.insertText', { text: 'SweepB 1' });
      await delay(1200);
      typed = await evaluate(`(() => { const e = document.getElementById('quick-search-input'); return { v: e ? e.value : null, results: Array.from(document.querySelectorAll('#quick-search-panel .search-result')).length }; })()`);
      await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    }
    return { pass: !!(panel && panel.vis), detail: { panel, typed } };
  });

  // S8 条目 DOM 右键菜单（ContextMenuPanel 是 DOM，安全）+ 批量重命名入口
  await step('S8-item-contextmenu-and-batch-rename', async () => {
    const c1 = await rectCenter(`(function () { const b = document.querySelector('.box.ext-png'); return b; })()`);
    if (!c1) return { pass: false, detail: 'no box' };
    await press(c1.x, c1.y, 'left', 1);
    await delay(250);
    await evaluate(`(() => { window.__ctxMenuPayload = null; window.$bodyScope.$on('CONTEXTMENU.OPEN', (_e, opts) => { window.__ctxMenuPayload = { count: opts && opts.items ? opts.items.length : 0 }; }); return true; })()`);
    await press(c1.x, c1.y, 'right', 1);
    const menu = await waitFor(async () => {
      const r = await evaluate(`window.__ctxMenuPayload`);
      return r && r.count > 0 ? r : null;
    }, 'ctx menu', 8000).catch(() => null);
    const menuTexts = await evaluate(`(() => { const hosts = document.querySelectorAll('#eagle-app-menu-host, [class*="context-menu"], [class*="contextmenu"]'); const texts = []; hosts.forEach((h) => { h.querySelectorAll('*').forEach((e) => { if (e.childElementCount === 0 && e.textContent.trim().length > 0 && e.textContent.trim().length < 24) texts.push(e.textContent.trim()); }); }); return Array.from(new Set(texts)).slice(0, 40); })()`);
    // 找批量重命名入口（文本匹配）
    const renameBtn = await rectCenter(`(function () { const all = Array.from(document.querySelectorAll('#eagle-app-menu-host *, [class*="context-menu"] *, [class*="contextmenu"] *')); const el = all.filter((e) => e.childElementCount === 0 && /批量重命名|batch rename/i.test(e.textContent))[0]; if (!el) return null; return el.closest('li, [class*="item"], [class*="option"]') || el; })()`);
    let renameOpened = null;
    if (renameBtn) {
      await press(renameBtn.x, renameBtn.y, 'left', 1);
      await delay(1000);
      renameOpened = await evaluate(`(() => { const h = document.getElementById('eagle-batch-rename-host'); if (!h) return null; const win = h.querySelector('.modal, [class*="window"], [class*="rename"]'); return { hostCls: h.className.slice(0, 80), vis: getComputedStyle(h).display !== 'none', inner: win ? win.className.slice(0, 60) : null }; })()`);
      await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    }
    await evaluate(`(() => { const s = window.$bodyScope; if (typeof s.$broadcast === 'function') s.$broadcast('CONTEXTMENU.CLOSE'); return true; })()`);
    return { pass: !!menu, detail: { menu, menuTexts, renameOpened } };
  });

  // S9 偏好设置窗（ipc 'open.preferences' → 独立窗口 target 健康普查）
  await step('S9-preferences-window', async () => {
    const sent = await evaluate(`(() => { if (window.ipcRenderer && typeof window.ipcRenderer.send === 'function') { window.ipcRenderer.send('open.preferences', {}); return 'sent'; } return 'no-ipcRenderer'; })()`);
    if (sent !== 'sent') return { pass: false, detail: { sent } };
    let prefTarget = null;
    for (let i = 0; i < 20 && !prefTarget; i++) {
      await delay(500);
      const targets = await (await fetch(`http://127.0.0.1:${stack.debugPort}/json/list`)).json();
      prefTarget = targets.find((t) => t.type === 'page' && t.url.includes('preferences.html')) || null;
    }
    if (!prefTarget) return { pass: false, detail: { sent, note: 'preferences window target never appeared' } };
    const prefPage = await connect(prefTarget.webSocketDebuggerUrl);
    await prefPage.send('Runtime.enable');
    await prefPage.send('Log.enable');
    await prefPage.send('Page.enable');
    await prefPage.send('Runtime.evaluate', { expression: `(() => { window.__prefErrors = []; window.addEventListener('error', (e) => window.__prefErrors.push(String(e.message).slice(0, 160))); return true; })()`, returnByValue: true });
    await waitFor(async () => {
      const r = await prefPage.send('Runtime.evaluate', { expression: `document.readyState`, returnByValue: true });
      return r.result.value === 'complete';
    }, 'pref ready', 30000).catch(() => null);
    await delay(2000);
    const prefState = await prefPage.send('Runtime.evaluate', {
      expression: `(() => ({ ready: document.readyState, scope: !!window.$bodyScope, title: document.title, panels: document.querySelectorAll('.preferences-panel, [class*="preferences"]').length, errors: window.__prefErrors }))()`,
      returnByValue: true,
    });
    const fatal = (prefState.result.value.errors || []).filter((m) => fatalPatterns.test(m));
    try { await prefPage.send('Runtime.evaluate', { expression: `window.close(); true`, returnByValue: true }); } catch (err) {}
    try { prefPage.ws.close(); } catch (err) {}
    return { pass: fatal.length === 0, detail: { url: prefTarget.url.slice(0, 90), state: prefState.result.value, fatal } };
  });

  await delay(1500);
  const totalErrors = await errCount();
  const allFatal = await fatalCount();
  console.log(`SWEEP_B_ERRORS ${JSON.stringify({ total: totalErrors, fatal: allFatal, list: await evaluate(`window.__uxErrors.slice(0, 12)`) })}`);
  const failed = results.filter((r) => r.outcome === 'FAIL' || (typeof r.fatalErrors === 'number' && r.fatalErrors > 0));
  console.log(`SWEEP_B_SUMMARY ${JSON.stringify({ steps: results.length, failed: failed.length, names: results.map((r) => r.name + ':' + r.outcome) })}`);
  fs.writeFileSync(path.join(projectRoot, 'tests-tmp', 'residue-sweep-b-out.json'), JSON.stringify(results, null, 1));
}

try {
  await main();
  console.log(`SWEEP_B_OK`);
} catch (err) {
  failure = err;
  console.error(`SWEEP_B_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
