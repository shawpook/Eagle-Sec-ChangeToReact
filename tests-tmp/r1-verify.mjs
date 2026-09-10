import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// b1-9az R1-batch1 验证：bodyState 20 字段源翻转。
// ① scope 写 → store 反映（machinery 链：Tab 键 toggleAll → s.isHideSidebar）
// ② store 写 → scope 读反映（setState 直写）
// ③ body class 双向跟随（BodyBindings 读 store）
// ④ isDetailMode（Enter 键）scope 写 → store 反映
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-r1-verify-'));
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
const watchdog = setTimeout(() => { console.log('R1_VERIFY_WATCHDOG'); process.exit(2); }, 420000);

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
      await post('/api/library/create', { name: 'R1Verify', savePath: librariesRoot });
      const colors = [[25, 60, 210], [30, 180, 90], [200, 120, 30]];
      const images = [];
      for (let i = 0; i < 3; i++) {
        const p = path.join(sourcesRoot, `RV ${i + 1}.png`);
        createPng(p, colors[i]);
        images.push({ path: p, name: `RV ${i + 1}` });
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
    if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.exception?.description?.slice(0, 220)}`);
    return r.result.value;
  };
  const assert = (name, pass, detail) => {
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass ? '' : ' — ' + JSON.stringify(detail).slice(0, 300)}`);
    if (!pass) failures.push(name);
  };

  await sendT('Runtime.enable');
  await waitFor(async () => (await evaluate(`document.readyState`)) === 'complete', 'ready', 60000);
  await waitFor(async () => (await evaluate(`!!window.$bodyScope`)) === true, 'scope', 60000);
  await waitFor(async () => (await evaluate(`!!(window.__eagleBodyState && window.__eagleBodyState.getState)`)) === true, 'bodyState', 60000);
  await waitFor(async () => {
    const n = await evaluate(`document.querySelectorAll('.box').length`);
    return typeof n === 'number' && n >= 3 ? n : null;
  }, 'boxes', 60000);
  await delay(1500);

  // 0 机制在位：迁移字段 scope 读 === store 读（抽 3 个字段）
  const probe0 = await evaluate(`(() => {
    const s = window.$bodyScope; const st = window.__eagleBodyState.getState();
    return { theme: [s.theme, st.theme], isHideSidebar: [s.isHideSidebar, st.isHideSidebar], viewMode: [s.viewMode, st.viewMode] };
  })()`);
  assert('scope-reads-store', probe0.theme[0] === probe0.theme[1] && probe0.isHideSidebar[0] === probe0.isHideSidebar[1] && probe0.viewMode[0] === probe0.viewMode[1], probe0);

  // ① scope 写 → store 反映（Tab 键：mousetrap 'tab' → s.toggleAll → s.isHideSidebar=true）
  await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  const hidden = await waitFor(async () => {
    const r = await evaluate(`(() => ({ store: window.__eagleBodyState.getState().isHideSidebar, scope: window.$bodyScope.isHideSidebar, cls: document.body.className.includes('hide-sidebar') }))()`);
    return r.store === true && r.scope === true ? r : null;
  }, 'tab hides sidebar', 10000).catch(() => null);
  assert('scope-write-lands-in-store', !!hidden, hidden);

  // ② store 写 → scope 读反映（setState 直写恢复可见）
  await evaluate(`window.__eagleBodyState.setState({ isHideSidebar: false }); true`);
  const shown = await waitFor(async () => {
    const r = await evaluate(`(() => ({ store: window.__eagleBodyState.getState().isHideSidebar, scope: window.$bodyScope.isHideSidebar }))()`);
    return r.store === false && r.scope === false ? r : null;
  }, 'store write', 8000).catch(() => null);
  assert('store-write-readable-via-scope', !!shown, shown);

  // ③ body class 双向（BodyBindings 读 store——隐藏态 class 再现）
  await evaluate(`window.__eagleBodyState.setState({ isHideSidebar: true }); true`);
  const clsOn = await waitFor(async () => {
    const r = await evaluate(`document.body.className.includes('hide-sidebar')`);
    return r ? r : null;
  }, 'class on', 8000).catch(() => null);
  await evaluate(`window.__eagleBodyState.setState({ isHideSidebar: false }); true`);
  assert('body-class-follows-store', clsOn === true, clsOn);

  // ④ isDetailMode：Enter（键盘层）→ scope 写 → store 反映 → Exit 回 false
  const c1 = await evaluate(`(() => { const b = document.querySelector('.box'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + Math.min(r.height / 2, 60)) }; })()`);
  if (c1) {
    await sendT('Input.dispatchMouseEvent', { type: 'mousePressed', x: c1.x, y: c1.y, button: 'left', clickCount: 1 });
    await sendT('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c1.x, y: c1.y, button: 'left', clickCount: 1 });
    await delay(400);
    await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    const detail = await waitFor(async () => {
      const r = await evaluate(`(() => ({ store: window.__eagleBodyState.getState().isDetailMode, scope: window.$bodyScope.isDetailMode }))()`);
      return r.store === true && r.scope === true ? r : null;
    }, 'detail mode', 12000).catch(() => null);
    assert('detailmode-scope-write-in-store', !!detail, detail);
    await evaluate(`window.postMessage('Exit', '*'); true`);
    await delay(800);
  } else {
    assert('detailmode-scope-write-in-store', false, { note: 'no box' });
  }

  console.log(`R1_VERIFY ${failures.length === 0 ? 'OK' : 'FAILED'} ${JSON.stringify({ failures })}`);
}

try {
  await main();
} catch (err) {
  console.error(`R1_VERIFY_FAIL ${err.message}`);
  failures.push('harness');
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failures.length === 0 ? 0 : 1);
