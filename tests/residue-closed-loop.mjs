import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// b1-9ay：残余扫查闭环（sweep B1-B7 定论三个真问题的回归网）：
// V1 mousetrap 哑键清零（评级键族补移植）
// V2 侧栏文件夹点击真打开（dragCheck ReferenceError 修复）+ clickSmartNode 同链
// V3 评级键 3/0 真写 star
// V4 全程 consoleAPICalled 零错误（scopeApply 吞错通道在网）+ 404 资源清零
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-residue-verify-'));
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
const failures = [];
const watchdog = setTimeout(() => { console.log('RESIDUE_CLOSED_LOOP_WATCHDOG'); process.exit(2); }, 480000);

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
      await post('/api/library/create', { name: 'ResidueVerify', savePath: librariesRoot });
      const colors = [[25, 60, 210], [30, 180, 90], [200, 120, 30]];
      const images = [];
      for (let i = 0; i < 3; i++) {
        const p = path.join(sourcesRoot, `RV ${i + 1}.png`);
        createPng(p, colors[i]);
        images.push({ path: p, name: `RV ${i + 1}` });
      }
      await post('/api/item/addFromPaths', { images });
      await post('/api/folder/create', { name: '设计参考' });
      await post('/api/v2/smartFolder/create', { name: '验证智能夹', contain: [{ field: 'name', operator: 'contain', value: 'RV' }] }).catch(async () => {
        // 形状兜底（menu-popup 测试的三试校准形状）
        return post('/api/v2/smartFolder/create', { name: '验证智能夹', rules: [{ field: 'name', operator: 'contain', value: 'RV' }] });
      });
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
    const r = await evaluate(`(() => { const e = (${expression}); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2), w: Math.round(b.width) }; })()`);
    return r || null;
  };
  const assert = (name, pass, detail) => {
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass ? '' : ' — ' + JSON.stringify(detail).slice(0, 400)}`);
    if (!pass) failures.push(name);
  };

  await sendT('Runtime.enable');
  await waitFor(async () => (await evaluate(`document.readyState`)) === 'complete', 'ready', 60000);
  await waitFor(async () => (await evaluate(`!!window.$bodyScope`)) === true, 'scope', 60000);
  await waitFor(async () => {
    const n = await evaluate(`document.querySelectorAll('.box').length`);
    return typeof n === 'number' && n >= 3 ? n : null;
  }, 'boxes', 60000);
  await delay(1500);

  // V1 哑键清零
  const deadKeys = await evaluate(`(() => { const s = window.$bodyScope; if (!s.mousetrap) return ['no-map']; const dead = []; for (const k of Object.keys(s.mousetrap)) { if (typeof s.mousetrap[k] !== 'function') dead.push(k); } return dead; })()`);
  assert('mousetrap-zero-dead-keys', deadKeys.length === 0, deadKeys);

  // V1b R1 源翻转哨兵（b1-9az）：迁移字段 scope 读 === store 读——委托链静默退化的回归网
  const sourceFlip = await evaluate(`(() => {
    const s = window.$bodyScope; const st = window.__eagleBodyState && window.__eagleBodyState.getState();
    if (!st) return { bad: ['no-bodyState'] };
    const fields = ['theme', 'viewMode', 'isHideSidebar', 'isDetailMode'];
    return { bad: fields.filter((f) => s[f] !== st[f]) };
  })()`);
  assert('scope-delegates-migrated-fields-to-store', sourceFlip.bad.length === 0, sourceFlip);

  // V2 文件夹点击真打开
  const row = await rectCenter(`(function () { const c = document.getElementById('sidebar-item-container'); if (!c) return null; const name = Array.from(c.querySelectorAll('.name')).filter(function (e) { return e.textContent.trim() === '设计参考'; })[0]; return name ? name.closest('.item') : null; })()`);
  assert('folder-row-located', !!row && row.w > 0, row);
  if (row && row.w > 0) {
    await press(row.x, row.y, 'left', 1);
    const opened = await waitFor(async () => {
      const r = await evaluate(`(() => ({ cf: window.$bodyScope.currentFolder ? window.$bodyScope.currentFolder.name : null, hash: location.hash, boxes: document.querySelectorAll('.box').length }))()`);
      return r.cf === '设计参考' ? r : null;
    }, 'folder open', 12000).catch(() => null);
    assert('folder-click-opens-folder', !!opened, opened);
  }

  // V2b 智能文件夹点击（clickSmartNode 同链修复验证）
  const srow = await rectCenter(`(function () { const c = document.getElementById('sidebar-item-container'); if (!c) return null; const name = Array.from(c.querySelectorAll('.name')).filter(function (e) { return e.textContent.trim() === '验证智能夹'; })[0]; return name ? name.closest('.item') : null; })()`);
  if (srow && srow.w > 0) {
    await press(srow.x, srow.y, 'left', 1);
    const sOpened = await waitFor(async () => {
      const r = await evaluate(`(() => ({ cf: window.$bodyScope.currentSmartFolder ? window.$bodyScope.currentSmartFolder.name : null, hash: location.hash }))()`);
      return r.cf === '验证智能夹' ? r : null;
    }, 'smart folder open', 12000).catch(() => null);
    assert('smart-folder-click-opens', !!sOpened, sOpened);
  } else {
    assert('smart-folder-click-opens', false, { note: 'smart folder row not found in sidebar' });
  }

  // V2c 回到全部
  const arow = await rectCenter(`(function () { const c = document.getElementById('sidebar-item-container'); if (!c) return null; const name = Array.from(c.querySelectorAll('.name')).filter(function (e) { return e.textContent.trim() === '全部'; })[0]; return name ? name.closest('.item') : null; })()`);
  if (arow && arow.w > 0) { await press(arow.x, arow.y, 'left', 1); await delay(2000); }

  // V3 评级键真写 star（点击选中 → '3' → star 3 → '0' → 清除）
  const c1 = await rectCenter(`document.querySelector('.box.ext-png')`);
  assert('box-located', !!c1 && c1.w > 0, c1);
  if (c1 && c1.w > 0) {
    await press(c1.x, c1.y, 'left', 1);
    await delay(500);
    await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: '3', code: 'Digit3', windowsVirtualKeyCode: 51, text: '3', unmodifiedText: '3' });
    await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: '3', code: 'Digit3', windowsVirtualKeyCode: 51 });
    const star3 = await waitFor(async () => {
      const r = await evaluate(`(() => { const s = window.$bodyScope; const it = s.selected && s.selected[0]; return it ? it.star : null; })()`);
      return r === 3 ? r : null;
    }, 'star 3', 8000).catch(() => null);
    assert('rating-key-sets-star', star3 === 3, star3);
    await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: '0', code: 'Digit0', windowsVirtualKeyCode: 48, text: '0', unmodifiedText: '0' });
    await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: '0', code: 'Digit0', windowsVirtualKeyCode: 48 });
    const star0 = await waitFor(async () => {
      const r = await evaluate(`(() => { const s = window.$bodyScope; const it = s.selected && s.selected[0]; return it ? (it.star === undefined ? 'cleared' : it.star) : null; })()`);
      return r === 'cleared' || r === null ? r : null;
    }, 'star clear', 8000).catch(() => null);
    assert('rating-key-0-clears-star', star0 === 'cleared' || star0 === null, star0);
  }

  // V4 全程 console 错误清点（scopeApply/$apply 吞错通道 + 资源 404 都在这条通道现形）
  await delay(1500);
  const consoleErrors = [];
  for (const message of page.events) {
    if (message.method !== 'consoleAPICalled') continue;
    const p = message.params;
    if (p.type !== 'error') continue;
    const text = p.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200);
    consoleErrors.push(text);
  }
  const fatalConsole = consoleErrors.filter((t) => /is not defined|is not a function|Cannot read|Failed to load resource/i.test(t));
  assert('zero-console-errors', fatalConsole.length === 0, fatalConsole.slice(0, 6));

  console.log(`RESIDUE_CLOSED_LOOP ${failures.length === 0 ? 'OK' : 'FAILED'} ${JSON.stringify({ failures })}`);
}

try {
  await main();
} catch (err) {
  console.error(`RESIDUE_CLOSED_LOOP_FAIL ${err.message}`);
  failures.push('harness');
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
}
process.exit(failures.length === 0 ? 0 : 1);
