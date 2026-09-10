import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// UX 诊断探针 R7（不提交）：b1-9au 修复验证——双击开图/条目右键/排序右键/Ctrl 滚轮
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-ux-probe7-'));
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

const evalErrors = [];
let stack;
let failure = null;
const watchdog = setTimeout(() => { console.log('UX_PROBE7_WATCHDOG'); process.exit(2); }, 420000);

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
      await post('/api/library/create', { name: 'UX Probe 7', savePath: librariesRoot });
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
    if (r.exceptionDetails) {
      const desc = r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails).slice(0, 160);
      evalErrors.push(desc.slice(0, 160));
      return { __evalError: desc.slice(0, 160) };
    }
    return r.result.value;
  };
  const click = async (x, y, button = 'left', count = 1) => {
    await sendT('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, clickCount: count });
    await sendT('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, clickCount: count });
  };
  await sendT('Runtime.enable');
  await sendT('Page.enable');
  await waitFor(async () => (await evaluate(`document.readyState`)) === 'complete', 'ready', 60000);
  await waitFor(async () => (await evaluate(`!!window.$bodyScope`)) === true, 'scope', 60000);
  await evaluate(`(() => { window.__ux = { errors: [] }; window.addEventListener('error', (e) => { window.__ux.errors.push(e.message + ' @ ' + e.lineno); }); return true; })()`);
  await waitFor(async () => {
    const n = await evaluate(`document.querySelectorAll('.box').length`);
    return typeof n === 'number' && n >= 3 ? n : null;
  }, 'boxes', 60000);

  const report = {};

  // ① 双击缩略图 → 详情
  const thumb = await evaluate(`(() => { const box = document.querySelector('.box'); const img = box.querySelector('img') || box.querySelector('.thumbnail'); const r = (img || box).getBoundingClientRect(); return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), boxCls: box.className.slice(0, 40) }; })()`);
  await click(thumb.x, thumb.y, 'left', 1); await delay(80);
  await click(thumb.x, thumb.y, 'left', 2); await delay(1200);
  report.dblclickOpen = await evaluate(`(() => { const s = window.$bodyScope; return { isDetailMode: !!s.isDetailMode, current: s.current ? s.current.name : null, detailCls: document.body.className.includes('is-detail-mode') }; })()`);
  console.log('[1 dblclick] ' + JSON.stringify(report.dblclickOpen));

  // ② Esc 退出详情 → 列表空白处右键 → 排序面板（OPEN_LAYOUT_PANEL）
  await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await delay(600);
  const blank = await evaluate(`(() => { const c = document.getElementById('box-container'); const r = c.getBoundingClientRect(); return { x: Math.round(r.x + 100), y: Math.round(r.y + r.height - 40) }; })()`);
  await click(blank.x, blank.y, 'right'); await delay(900);
  report.listRightClick = await evaluate(`(() => {
    const panel = document.querySelector('[class*="layout-panel"], [id*="layout-panel"], .order-menu, [class*="order"]');
    const s = window.$bodyScope;
    return { layoutPanelOpen: !!panel && panel.getBoundingClientRect().width > 0, panelSample: panel ? (panel.textContent || '').replace(/\\s+/g, ' ').slice(0, 60) : '', menuDom: !!document.querySelector('.context-menu, [class*="context-menu"]') };
  })()`);
  console.log('[2 list-right] ' + JSON.stringify(report.listRightClick));
  await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await delay(400);

  // ③ 条目右键 → openItemContextMenu（菜单应有条目项：打开/外部打开/复制等）
  await click(thumb.x, thumb.y, 'right'); await delay(900);
  report.itemRightClick = await evaluate(`(() => {
    const menu = document.querySelector('.context-menu, [class*="context-menu"]');
    const s = window.$bodyScope;
    return {
      activeMenuLen: s && s.activeMenu && s.activeMenu.items ? s.activeMenu.items.length : 0,
      menuSample: menu ? (menu.textContent || '').replace(/\\s+/g, ' ').slice(0, 100) : '',
    };
  })()`);
  console.log('[3 item-right] ' + JSON.stringify(report.itemRightClick));
  await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await delay(400);

  // ④ Ctrl+滚轮 → 网格尺寸变化
  const sizeBefore = await evaluate(`(() => { const s = window.$bodyScope; return { h: s.imageSize ? s.imageSize.height : null, thumbH: Math.round(document.querySelector('.box').getBoundingClientRect().height) }; })()`);
  await sendT('Input.dispatchMouseEvent', { type: 'mouseWheel', x: thumb.x, y: thumb.y, deltaX: 0, deltaY: -240, modifiers: ['control'] });
  await delay(700);
  const sizeAfter = await evaluate(`(() => { const s = window.$bodyScope; return { h: s.imageSize ? s.imageSize.height : null, thumbH: Math.round(document.querySelector('.box').getBoundingClientRect().height) }; })()`);
  report.ctrlWheelZoom = { before: sizeBefore, after: sizeAfter, changed: JSON.stringify(sizeBefore) !== JSON.stringify(sizeAfter) };
  console.log('[4 wheel] ' + JSON.stringify(report.ctrlWheelZoom));

  // ⑤ 错误汇总（悬停零 ReferenceError 验证——鼠标移过各 box）
  const boxes = await evaluate(`(() => { return Array.from(document.querySelectorAll('.box')).slice(0, 3).map((b) => { const r = b.getBoundingClientRect(); return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) }; }); })()`);
  for (const b of boxes) {
    await sendT('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y });
    await delay(350);
  }
  await delay(600);
  report.hoverErrors = await evaluate(`JSON.stringify(window.__ux.errors.slice(0, 10))`);

  console.log('UX_PROBE7_REPORT ' + JSON.stringify(report, null, 1));
  if (evalErrors.length) console.log('PROBE_EVAL_ERRORS ' + JSON.stringify(evalErrors.slice(0, 10)));
} catch (err) {
  failure = err;
  console.error(`UX_PROBE7_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
