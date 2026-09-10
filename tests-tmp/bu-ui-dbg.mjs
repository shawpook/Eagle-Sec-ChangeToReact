import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// b1-9ax：UI 交互闭环（b1-9au/aw 回归网）——50 项套件此前的盲区：通道闭环验证数据面、
// 本测试验证真实鼠标交互面。断言全部用 scope/状态信号（视觉类不可靠，误报史见
// PROGRESS b1-9au 节）：双击开图、Esc 退详情、条目右键菜单项数、列表右键排序面板广播、
// Ctrl+滚轮网格缩放、悬停零 ReferenceError（hover-preview 提取片声明回归哨兵）。
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-ui-interactions-'));
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
const watchdog = setTimeout(() => { console.log('UI_INTERACTIONS_WATCHDOG'); process.exit(2); }, 420000);

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
      await post('/api/library/create', { name: 'UI Interactions', savePath: librariesRoot });
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
    if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.exception?.description?.slice(0, 160)}`);
    return r.result.value;
  };
  const press = async (x, y, button, count) => {
    await sendT('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, clickCount: count });
    await sendT('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, clickCount: count });
  };
  const assert = (name, pass, detail) => {
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass ? '' : ' — ' + JSON.stringify(detail)}`);
    if (!pass) failures.push(name);
  };

  await sendT('Runtime.enable');
  await waitFor(async () => (await evaluate(`document.readyState`)) === 'complete', 'ready', 60000);
  await waitFor(async () => (await evaluate(`!!window.$bodyScope`)) === true, 'scope', 60000);

  // 错误哨兵（悬停零 ReferenceError 断言的数据源）
  await evaluate(`(() => {
    window.__uxErrors = [];
    window.addEventListener('error', (e) => { window.__uxErrors.push(String(e.message).slice(0, 120)); });
    return true;
  })()`);

  await waitFor(async () => {
    const n = await evaluate(`document.querySelectorAll('.box').length`);
    return typeof n === 'number' && n >= 3 ? n : null;
  }, 'boxes', 60000);

  // 定位一律用 .box 矩形（img 懒加载可能 0×0——b1-9au 误诊教训）
  const boxCenter = async () => evaluate(`(() => { const b = document.querySelector('.box'); const r = b.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + Math.min(r.height / 2, 60)) }; })()`);

  // ① 双击缩略图 → 详情
  const c1 = await boxCenter();
  await press(c1.x, c1.y, 'left', 1);
  await delay(120);
  await press(c1.x, c1.y, 'left', 2);
  const dblOpened = await waitFor(async () => {
    const r = await evaluate(`(() => { const s = window.$bodyScope; return { d: !!s.isDetailMode, name: s.current ? s.current.name : null }; })()`);
    return r.d ? r : null;
  }, 'dblclick opens detail', 15000);
  assert('dblclick-opens-detail', dblOpened.d && !!dblOpened.name, dblOpened);

  // ② 详情退出走原版链路：viewer 'Exit' postMessage（DetailViewer 既有监听）——
  //    原版主窗 Esc 无直接绑定（b1-9av 考据），不在此断言
  await evaluate(`window.postMessage('Exit', '*'); true`);
  const exitClosed = await waitFor(async () => {
    const r = await evaluate(`(() => { const s = window.$bodyScope; return { d: !!s.isDetailMode }; })()`);
    return !r.d ? r : null;
  }, 'Exit message leaves detail', 15000);
  assert('exit-message-leaves-detail', exitClosed.d === false, exitClosed);

  // ②b 键盘层全链（b1-9av mousetrap 绑定消费端）：Enter → toggleDetailMode 进详情
  await press(c1.x, c1.y, 'left', 1);
  await delay(400);
  await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  const enterOpened = await waitFor(async () => {
    const r = await evaluate(`(() => { const s = window.$bodyScope; return { d: !!s.isDetailMode, name: s.current ? s.current.name : null }; })()`);
    return r.d ? r : null;
  }, 'Enter opens detail (keyboard layer)', 15000);
  assert('enter-key-opens-detail', enterOpened.d && !!enterOpened.name, enterOpened);
  await evaluate(`window.postMessage('Exit', '*'); true`);
  await delay(600);

  // ③ 条目右键 → openItemContextMenu 构建（先单击选中——守卫要求）。断言信号 =
  //    CONTEXTMENU.OPEN 广播 payload（ContextMenuPanel 是 React state 驱动，
  //    s.activeMenu 为旧服务字段不可靠）
  await evaluate(`(() => { window.__ctxMenuPayload = null; window.__eagleBus.on('CONTEXTMENU.OPEN', (opts) => { window.__ctxMenuPayload = { count: opts && opts.items ? opts.items.length : 0 }; }); return true; })()`);
  await press(c1.x, c1.y, 'left', 1);
  await delay(300);
  await press(c1.x, c1.y, 'right', 1);
  const itemMenu = await waitFor(async () => {
    const r = await evaluate(`window.__ctxMenuPayload`);
    return r && r.count > 0 ? r : null;
  }, 'item context menu broadcast', 15000);
  assert('item-context-menu-nonempty', itemMenu.count > 0, itemMenu);
  await evaluate(`(() => { window.__eagleBus.emit('CONTEXTMENU.CLOSE'); return true; })()`);
  await delay(400);

  // ④ 列表空白右键 → OPEN_LAYOUT_PANEL 广播（排序面板；用 $on 间谍断言，面板 DOM 形态不稳）。
  //    合成 contextmenu 直接派发在 #box-list（真实右键在同一监听链上，去 CDP 坐标/覆盖层
  //    脆弱性——R9 教训：监听链一致即可，命中测试交给 boxFrom 分支）
  await evaluate(`(() => { window.__layoutPanelFired = false; window.$bodyScope.$on('OPEN_LAYOUT_PANEL', () => { window.__layoutPanelFired = true; }); return true; })()`);
  await evaluate(`(() => {
    const host = document.getElementById('box-list');
    host.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 350, clientY: 500 }));
    return true;
  })()`);
  const layoutFired = await waitFor(async () => {
    const r = await evaluate(`window.__layoutPanelFired === true`);
    return r ? { fired: true } : null;
  }, 'list context menu layout broadcast', 15000);
  assert('list-contextmenu-opens-order-panel', layoutFired.fired === true, layoutFired);
  await evaluate(`(() => { window.__eagleBus.emit('CONTEXTMENU.CLOSE'); return true; })()`);
  await delay(400);

  // ⑤ Ctrl+滚轮 → 网格尺寸变化（CDP modifiers 位掩码：2 = Ctrl）
  const sizeBefore = await evaluate(`(() => { const s = window.$bodyScope; return { h: s.imageSize ? s.imageSize.height : null }; })()`);
  await sendT('Input.dispatchMouseEvent', { type: 'mouseWheel', x: c1.x, y: c1.y, deltaX: 0, deltaY: -240, modifiers: 2 });
  const zoomChanged = await waitFor(async () => {
    const r = await evaluate(`(() => { const s = window.$bodyScope; return { h: s.imageSize ? s.imageSize.height : null, err: window.__uxErrors.length }; })()`);
    return r.h !== sizeBefore.h ? r : null;
  }, 'ctrl-wheel zoom', 15000);
  assert('ctrl-wheel-zoom-changes-grid-size', zoomChanged.h !== sizeBefore.h && zoomChanged.err === 0, { before: sizeBefore, after: zoomChanged });

  // ⑥ 悬停零 ReferenceError（b1-9aw 回归哨兵：mousemove 扫过全部 box）
  const centers = await evaluate(`(() => Array.from(document.querySelectorAll('.box')).map((b) => { const r = b.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + Math.min(r.height / 2, 60)) }; }))()`);
  for (const c of centers) {
    await sendT('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y });
    await delay(250);
  }
  await delay(600);
  const hoverErrors = await evaluate(`window.__uxErrors.slice(0, 5)`);
  assert('hover-zero-reference-errors', hoverErrors.length === 0, hoverErrors);

  // ⑦ Z 键悬停预览全链（b1-9bu-A 复活实锚：b1-9am 提取片缺 keydown/keyup 段，
  //    b1-9aw 仅回填声明、绑定从未到位——本断言锁住 mouseover→lastElem→Z→show→keyup→hide）
  await sendT('Input.dispatchMouseEvent', { type: 'mouseMoved', x: centers[0].x, y: centers[0].y });
  await delay(300);
  await evaluate(`(() => {
    const ae = document.activeElement;
    window.__zdiag1 = {
      aeTag: ae ? ae.tagName : null,
      aeId: ae ? ae.id : null,
      ce: ae ? !!ae.isContentEditable : null,
      detail: !!window.$bodyScope.isDetailMode,
      lastElem: !!window.HoverPreview.lastElem,
      isShow: window.HoverPreview.isShow,
      kd0: window.HoverPreviewKeydown,
      inputFocus: document.querySelectorAll('input:focus,textarea:focus,select:focus').length,
    };
    window.__zkey = null;
    window.addEventListener('keydown', (e) => { window.__zkey = { kc: e.keyCode, ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey }; });
    return true;
  })()`);
  const d1 = await evaluate(`window.__zdiag1`);
  console.log('ZDIAG1 ' + JSON.stringify(d1));
  await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90 });
  await delay(250);
  const zkeyRaw = await evaluate(`window.__zkey`);
  console.log('ZKEY ' + JSON.stringify(zkeyRaw));
  const zShow = await evaluate(`(() => ({ show: window.HoverPreview.isShow, kd: window.HoverPreviewKeydown }))()`);
  assert('z-key-shows-hover-preview', zShow.show === true && zShow.kd === true, zShow);
  await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90 });
  await delay(250);
  const zHide = await evaluate(`(() => ({ show: window.HoverPreview.isShow, kd: window.HoverPreviewKeydown, err: window.__uxErrors.length }))()`);
  assert('z-keyup-hides-hover-preview', zHide.show === false && zHide.kd === false && zHide.err === 0, zHide);

  if (failures.length > 0) throw new Error(`UI interaction assertions failed: ${failures.join(', ')}`);
  console.log(`UI_INTERACTIONS_CLOSED_LOOP_OK ${JSON.stringify({ checks: 9 })}`);
} catch (err) {
  failure = err;
  console.error(`UI_INTERACTIONS_CLOSED_LOOP_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
