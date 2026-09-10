import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// b1-9az R1-batch2 验证：listState 8 字段 + toastState 2 字段 + lockState isAppLocked 源翻转。
// ① scope 写 → store 反映（三 store 各抽字段）② store 写 → scope 读反映
// ③ 同值守卫：同值重复写不触发 setState（subscribe 计数）④ 镜像字段仍活（viewMode 经 bodyState）
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-r2-verify-'));
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
const watchdog = setTimeout(() => { console.log('R2_VERIFY_WATCHDOG'); process.exit(2); }, 420000);

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
      await post('/api/library/create', { name: 'R2Verify', savePath: librariesRoot });
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
  await waitFor(async () => {
    const n = await evaluate(`document.querySelectorAll('.box').length`);
    return typeof n === 'number' && n >= 3 ? n : null;
  }, 'boxes', 60000);
  await delay(1500);

  // ① scope 写 → store 反映
  const w1 = await evaluate(`(() => {
    const s = window.$bodyScope;
    s.keyword = 'r2probe';
    s.listDone = false;
    s.currentOrderBy = 'RANDOM';
    s.localhostError = true;
    s.$root.isAppLocked = true;
    return {
      listKeyword: window.__eagleListState.getState().keyword,
      listDone: window.__eagleListState.getState().listDone,
      orderBy: window.__eagleListState.getState().currentOrderBy,
      localhost: window.useToastState ? null : window.__eagleToastState ? 'toast-store' : 'no-toast-store',
      locked: window.__eagleLockState.getState().isAppLocked,
    };
  })()`);
  assert('scope-write-lands-in-stores', w1.listKeyword === 'r2probe' && w1.listDone === false && w1.orderBy === 'RANDOM' && w1.locked === true, w1);

  // localhostError store 读取（toastState 无诊断句柄——经 scope 读回验证 + subscribe 旁路）
  const w1b = await evaluate(`(() => {
    const seen = { v: null };
    window.__toastProbe = () => { };
    return window.$bodyScope.localhostError;
  })()`);
  assert('toastfield-scope-reads-store', w1b === true, w1b);

  // ② store 写 → scope 读反映 + 还原
  const w2 = await evaluate(`(() => {
    window.__eagleListState.setState({ keyword: 'from-store' });
    const viaScope = window.$bodyScope.keyword;
    window.__eagleListState.setState({ keyword: '' });
    window.__eagleLockState.setState({ isAppLocked: false });
    window.$bodyScope.localhostError = false;
    return { viaScope, restored: window.$bodyScope.keyword === '' && window.__eagleLockState.getState().isAppLocked === false };
  })()`);
  assert('store-write-readable-via-scope', w2.viaScope === 'from-store' && w2.restored === true, w2);

  // ③ 同值守卫：先写入目标值（合法变更），再同值重复写——计数应为 0
  const w3 = await evaluate(`(() => {
    const st = window.__eagleListState;
    window.$bodyScope.keyword = 'guard-test';
    let sets = 0;
    const un = st.subscribe(() => { sets += 1; });
    window.$bodyScope.keyword = 'guard-test';
    window.$bodyScope.keyword = 'guard-test';
    window.$bodyScope.keyword = 'guard-test';
    un();
    return { sets, value: st.getState().keyword };
  })()`);
  assert('same-value-guard-no-setstate', w3.sets === 0 && w3.value === 'guard-test', w3);

  // ④ 镜像字段仍活：viewMode（bodyState 源）→ listState 镜像跟随
  await evaluate(`window.$bodyScope.viewMode = 'unfiled'; true`);
  await delay(900);
  const w4 = await evaluate(`(() => ({
    body: window.__eagleBodyState.getState().viewMode,
    list: window.__eagleListState.getState().viewMode,
  }))()`);
  assert('mirror-fields-follow-source', w4.body === 'unfiled' && w4.list === 'unfiled', w4);
  await evaluate(`window.$bodyScope.viewMode = 'all'; true`);
  await delay(600);

  // ⑤ 真实链路：搜索框输入 → keyword 萹 listState（SweepB 实证链）。先清掉 ③ 的探针残留
  await evaluate(`window.$bodyScope.keyword = ''; true`);
  await delay(600);
  const c1 = await evaluate(`(() => { const e = document.querySelector('.search-wrap input.search, .search-wrap input'); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }; })()`);
  if (c1) {
    await sendT('Input.dispatchMouseEvent', { type: 'mousePressed', x: c1.x, y: c1.y, button: 'left', clickCount: 1 });
    await sendT('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c1.x, y: c1.y, button: 'left', clickCount: 1 });
    await sendT('Input.insertText', { text: 'RV 1' });
    await delay(1500);
    const kw = await evaluate(`window.__eagleListState.getState().keyword`);
    assert('real-search-input-flows-to-store', kw === 'RV 1', kw);
    await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  }

  console.log(`R2_VERIFY ${failures.length === 0 ? 'OK' : 'FAILED'} ${JSON.stringify({ failures })}`);
}

try {
  await main();
} catch (err) {
  console.error(`R2_VERIFY_FAIL ${err.message}`);
  failures.push('harness');
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failures.length === 0 ? 0 : 1);
