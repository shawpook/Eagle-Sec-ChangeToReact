import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// UX 诊断探针 R8（不提交）：三层隔离——served 源码 / 合成事件 / 直调 fns
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-ux-probe8-'));
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
const watchdog = setTimeout(() => { console.log('UX_PROBE8_WATCHDOG'); process.exit(2); }, 420000);

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
      await post('/api/library/create', { name: 'UX Probe 8', savePath: librariesRoot });
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

  const report = {};

  // ① served 源码含新代码？
  report.servedHasMarker = await evaluate(`fetch('/src/app/react/components/grid/BoxList.tsx').then((r) => r.text()).then((t) => ({ hasDbl: t.includes('onBoxListDblClick'), hasCallScope: t.includes('callScope'), len: t.length }))`);
  console.log('[1 served] ' + JSON.stringify(report.servedHasMarker));

  // ② fns 表直查
  report.fnsPresence = await evaluate(`(() => { const c = window.__eagleCoreFns || {}; return { dbl: typeof c.onBoxListDblClick, mouseup: typeof c.onBoxMouseup, listMenu: typeof c.openFileListContextMenu, orderMenu: typeof c.openOrderMenu, fileDefault: typeof c.openFileWithDefault, sDbl: typeof window.$bodyScope.onBoxListDblClick }; })()`);
  console.log('[2 fns] ' + JSON.stringify(report.fnsPresence));

  // ③ 合成 dblclick（bubbles，走真实监听路径）
  report.syntheticDbl = await evaluate(`(() => {
    const s = window.$bodyScope;
    const box = document.querySelector('.box');
    if (!box) return { error: 'no box' };
    const img = box.querySelector('img') || box.querySelector('.thumbnail') || box;
    img.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    return { isDetailMode: !!s.isDetailMode };
  })()`);
  await delay(800);
  report.syntheticDblAfter = await evaluate(`(() => { const s = window.$bodyScope; return { isDetailMode: !!s.isDetailMode, current: s.current ? s.current.name : null }; })()`);
  console.log('[3 synth-dbl] ' + JSON.stringify(report.syntheticDblAfter));

  // Esc 退出
  await evaluate(`(() => { const s = window.$bodyScope; if (s.isDetailMode) s.leaveDetailMode(); return true; })()`);
  await delay(400);

  // ④ 直调 fns.onBoxListDblClick
  report.directFn = await evaluate(`(() => {
    const s = window.$bodyScope;
    const c = window.__eagleCoreFns;
    if (typeof c.onBoxListDblClick !== 'function') return { error: 'fns missing' };
    const box = document.querySelector('.box');
    const id = box.getAttribute('data-box-id');
    const item = s.itemMappings[id];
    const evt = new MouseEvent('dblclick', { bubbles: true });
    try { c.onBoxListDblClick(evt, item, false, null); } catch (err) { return { error: String(err).slice(0, 150) }; }
    return { isDetailMode: !!s.isDetailMode, current: s.current ? s.current.name : null };
  })()`);
  console.log('[4 direct-fn] ' + JSON.stringify(report.directFn));
  await evaluate(`(() => { const s = window.$bodyScope; if (s.isDetailMode) s.leaveDetailMode(); return true; })()`);
  await delay(300);

  // ⑤ 直调 openItemContextMenu（条目右键菜单本体）
  report.directItemMenu = await evaluate(`(() => {
    const s = window.$bodyScope;
    const c = window.__eagleCoreFns;
    const box = document.querySelector('.box');
    const id = box.getAttribute('data-box-id');
    const item = s.itemMappings[id];
    const evt = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    try { s.openItemContextMenu(evt, item); } catch (err) { return { viaScopeError: String(err).slice(0, 150) }; }
    return { activeMenuLen: s.activeMenu && s.activeMenu.items ? s.activeMenu.items.length : 0 };
  })()`);
  await delay(500);
  report.directItemMenuDom = await evaluate(`(() => { const menu = document.querySelector('.context-menu, [class*="context-menu"]'); return { menuDom: !!menu, sample: menu ? (menu.textContent || '').replace(/\\s+/g, ' ').slice(0, 80) : '' }; })()`);
  console.log('[5 item-menu] ' + JSON.stringify(report.directItemMenu) + ' ' + JSON.stringify(report.directItemMenuDom));

  console.log('UX_PROBE8_REPORT ' + JSON.stringify(report, null, 1));
} catch (err) {
  failure = err;
  console.error(`UX_PROBE8_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
