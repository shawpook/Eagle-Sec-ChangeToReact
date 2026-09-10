import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// 残余扫查 B5：定论轮。
// W1 哑键全量枚举（mousetrap 绑定值 typeof 非 function 的键——U6 实锤类）
// W2 clickNode 事件属性捕获（which/ctrl/meta/shift + 多分支间谍：openFolder/multipleOpenFolder/reload）
// W3 toggle-all：elementFromPoint 遮挡甄别 + 合成 click 兜底
// W4 评级键隔离重测
// W5 toggleFilter 开关驱动（filterIsOpen → items 可见）
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-sweepb5-'));
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
const watchdog = setTimeout(() => { console.log('SWEEP_B5_WATCHDOG'); process.exit(2); }, 480000);

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
      await post('/api/library/create', { name: 'SweepB5', savePath: librariesRoot });
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
    console.log(`SWEEP_B5_STEP ${JSON.stringify({ name, outcome, detail: detail && detail.detail ? detail.detail : detail })}`);
    return { outcome, detail };
  };

  // W1 哑键全量枚举
  await step('W1-mousetrap-dead-keys', async () => {
    const r = await evaluate(`(() => { const s = window.$bodyScope; if (!s.mousetrap) return { noMap: true }; const dead = []; const alive = []; for (const k of Object.keys(s.mousetrap)) { const v = s.mousetrap[k]; if (typeof v !== 'function') dead.push(k + ':' + String(v).slice(0, 30)); else alive.push(k); } return { total: Object.keys(s.mousetrap).length, dead, aliveCount: alive.length }; })()`);
    return { pass: !r.noMap && r.dead.length === 0, detail: r };
  });

  // W2 clickNode 事件属性 + 三分支间谍
  await step('W2-clicknode-event-props', async () => {
    await evaluate(`(() => {
      window.__w2 = { clickNode: [], openFolder: 0, multipleOpenFolder: 0, reload: 0 };
      const s = window.$bodyScope;
      const cn = s.clickNode;
      s.clickNode = function (event, folder) {
        window.__w2.clickNode.push({ which: event && event.which, btn: event && event.button, ctrl: !!(event && (event.ctrlKey || event.metaKey)), shift: !!(event && event.shiftKey), type: event && event.type, folderId: folder && folder.id });
        return cn.apply(this, arguments);
      };
      for (const [name, key] of [['openFolder', 'of'], ['multipleOpenFolder', 'mo'], ['reload', 'rl']]) {
        const orig = s[name];
        if (typeof orig === 'function') { s[name] = function () { window.__w2[name === 'openFolder' ? 'openFolder' : name === 'multipleOpenFolder' ? 'multipleOpenFolder' : 'reload'] += 1; return orig.apply(this, arguments); }; }
      }
      return true;
    })()`);
    const row = await rectCenter(`(function () { const c = document.getElementById('sidebar-item-container'); if (!c) return null; const name = Array.from(c.querySelectorAll('.name')).filter(function (e) { return e.textContent.trim() === '设计参考'; })[0]; return name ? name.closest('.item') : null; })()`);
    if (!row) return { pass: false, detail: 'row not found' };
    await press(row.x, row.y, 'left', 1);
    await delay(2500);
    const after = await evaluate(`(() => ({ w2: window.__w2, hash: location.hash, boxes: document.querySelectorAll('.box').length, cf: window.$bodyScope.currentFolder ? window.$bodyScope.currentFolder.name : null, selFolders: window.$bodyScope.$root && window.$bodyScope.$root.selectedFolders ? window.$bodyScope.$root.selectedFolders.length : 'n/a', err: window.__uxErrors }))()`);
    const ok = after.w2.clickNode.length > 0 && (after.w2.openFolder > 0 || after.w2.multipleOpenFolder > 0) && (after.cf === '设计参考' || after.hash.includes('folder'));
    return { pass: ok, detail: after };
  });

  // W3 toggle-all：遮挡甄别 + 合成兜底
  await step('W3-toggle-all-hit-test', async () => {
    const center = await rectCenter(`document.querySelector('#eagle-toolbar-host #toggle-all-btn')`);
    if (!center) return { pass: false, detail: 'btn not found' };
    const hit = await evaluate(`(() => { const b = document.querySelector('#eagle-toolbar-host #toggle-all-btn'); const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { target: el ? el.tagName + '.' + String(el.className).slice(0, 40) + (el.id ? '#' + el.id : '') : null, isSelfOrChild: el ? (el === b || b.contains(el) || el.contains(b)) : false }; })()`);
    await evaluate(`(() => { window.__w3 = []; const s = window.$bodyScope; const t = s.toggleAll; s.toggleAll = function () { window.__w3.push('called'); return t.apply(this, arguments); }; return true; })()`);
    await press(center.x, center.y, 'left', 1);
    await delay(900);
    const viaCdp = await evaluate(`window.__w3.length`);
    if (viaCdp === 0) {
      await evaluate(`(() => { const b = document.querySelector('#eagle-toolbar-host #toggle-all-btn'); b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); return true; })()`);
      await delay(900);
    }
    const post = await evaluate(`(() => ({ calls: window.__w3, hide: window.$bodyScope.isHideSidebar, err: window.__uxErrors.length }))()`);
    await press(center.x, center.y, 'left', 1);
    await delay(700);
    const restored = await evaluate(`(() => window.$bodyScope.isHideSidebar)()`);
    return { pass: post.calls.length > 0, detail: { hit, viaCdp, post, restored } };
  });

  // W4 评级键隔离重测
  await step('W4-rating-isolated', async () => {
    const c1 = await rectCenter(`document.querySelector('.box.ext-png')`);
    if (!c1) return { pass: false, detail: 'no box' };
    await press(c1.x, c1.y, 'left', 1);
    await delay(500);
    const before = await evaluate(`(() => { const s = window.$bodyScope; const it = s.selected && s.selected[0]; return it ? { name: it.name, star: it.star, hasFn: typeof s.changeTo3Star } : { sel: s.selected ? s.selected.length : 'n/a' }; })()`);
    await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: '3', code: 'Digit3', windowsVirtualKeyCode: 51, text: '3', unmodifiedText: '3' });
    await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: '3', code: 'Digit3', windowsVirtualKeyCode: 51 });
    const after = await waitFor(async () => {
      const r = await evaluate(`(() => { const s = window.$bodyScope; const it = s.selected && s.selected[0]; return it ? it.star : null; })()`);
      return r === 3 ? r : null;
    }, 'star 3', 6000).catch(() => null);
    const errNow = await evaluate(`window.__uxErrors.slice(0, 4)`);
    return { pass: after === 3, detail: { before, starAfter: after, errNow } };
  });

  // W5 toggleFilter 驱动
  await step('W5-toggle-filter', async () => {
    const btns = await evaluate(`(() => Array.from(document.querySelectorAll('#eagle-toolbar-host .filter-btn')).map((b) => ({ cls: String(b.className).slice(0, 60), r: (function (q) { const b = q.getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2), w: Math.round(b.width) }; })(b) })).filter((b) => b.r.w > 0))()`);
    const visBefore = await evaluate(`(() => { const h = document.getElementById('eagle-filter-toolbar-host'); const items = h.querySelectorAll('.filter-item'); return Array.from(items).filter((e) => e.getBoundingClientRect().height > 0).length; })()`);
    let clicked = null;
    for (const b of btns) {
      await press(b.r.x, b.r.y, 'left', 1);
      await delay(800);
      const visAfter = await evaluate(`(() => { const h = document.getElementById('eagle-filter-toolbar-host'); const items = h.querySelectorAll('.filter-item'); return Array.from(items).filter((e) => e.getBoundingClientRect().height > 0).length; })()`);
      if (visAfter > visBefore) { clicked = { btn: b, visBefore, visAfter }; break; }
    }
    // 收尾：若打开则关闭
    const active = await evaluate(`(() => { const b = document.querySelector('#eagle-toolbar-host .filter-btn.active'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
    if (active) { await press(active.x, active.y, 'left', 1); await delay(600); }
    return { pass: !!clicked, detail: { btnCount: btns.length, visBefore, clicked } };
  });

  await delay(1000);
  console.log(`SWEEP_B5_ERRORS ${JSON.stringify(await evaluate(`window.__uxErrors.slice(0, 12)`))}`);
  const failed = results.filter((r) => r.outcome === 'FAIL');
  console.log(`SWEEP_B5_SUMMARY ${JSON.stringify({ steps: results.length, failed: failed.length, names: results.map((r) => r.name + ':' + r.outcome) })}`);
  fs.writeFileSync(path.join(projectRoot, 'tests-tmp', 'residue-sweep-b5-out.json'), JSON.stringify(results, null, 1));
}

try {
  await main();
  console.log(`SWEEP_B5_OK`);
} catch (err) {
  failure = err;
  console.error(`SWEEP_B5_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
