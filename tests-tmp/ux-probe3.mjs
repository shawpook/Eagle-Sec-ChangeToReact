import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// UX 诊断探针 R3（不提交）：全 CDP 调用 12s 超时护栏 + 每步进度打点 + 6min 总看门狗
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-ux-probe3-'));
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
// 总看门狗：6 分钟强打报告退出（防再挂死无产出）
const watchdog = setTimeout(() => {
  console.log('UX_PROBE3_WATCHDOG fired — partial results above');
  process.exit(2);
}, 360000);

try {
  console.log('[step] bootStack starting');
  stack = await bootStack({
    librariesRoot,
    stateFile,
    userDataDir,
    beforeElectron: async (apiPort) => {
      const post = async (route, body) => {
        const response = await Promise.race([
          fetch(`http://127.0.0.1:${apiPort}${route}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('fixture fetch timeout')), 15000)),
        ]);
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') throw new Error(`${route} failed: ${JSON.stringify(payload)}`);
        return payload.data;
      };
      await post('/api/library/create', { name: 'UX Probe 3', savePath: librariesRoot });
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
  console.log('[step] bootStack done');
  const { page } = stack;

  const sendT = async (method, params, ms = 12000) => {
    const r = await Promise.race([
      page.send(method, params),
      new Promise((resolve) => setTimeout(() => resolve({ __timeout: method }), ms)),
    ]);
    if (r && r.__timeout) throw new Error(`CDP send timeout: ${method}`);
    return r;
  };

  const evaluate = async (expression) => {
    const r = await sendT('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) {
      const desc = r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails).slice(0, 200);
      evalErrors.push(desc.slice(0, 200));
      return { __evalError: desc.slice(0, 200) };
    }
    return r.result.value;
  };

  await sendT('Runtime.enable');
  await sendT('Page.enable');

  await waitFor(async () => (await evaluate(`document.readyState`)) === 'complete', 'main window ready', 60000);
  console.log('[step] window ready');
  await waitFor(async () => (await evaluate(`!!window.$bodyScope`)) === true, 'app scope', 60000);
  console.log('[step] app scope');

  // console/异常捕获
  await evaluate(`(() => {
    window.__ux = { errors: [], warns: [] };
    const ow = console.error, owarn = console.warn;
    console.error = function () { try { window.__ux.errors.push(Array.from(arguments).map(a => (a && a.stack) ? String(a.stack).slice(0, 250) : String(a)).join(' ').slice(0, 350)); } catch (e) {} return ow.apply(console, arguments); };
    console.warn = function () { try { window.__ux.warns.push(Array.from(arguments).map(String).join(' ').slice(0, 180)); } catch (e) {} return owarn.apply(console, arguments); };
    window.addEventListener('error', (e) => { window.__ux.errors.push('UNCAUGHT: ' + e.message + ' @ ' + (e.filename || '') + ':' + e.lineno); });
    window.addEventListener('unhandledrejection', (e) => { window.__ux.errors.push('REJECTION: ' + (e.reason && e.reason.stack ? String(e.reason.stack).slice(0, 250) : String(e.reason))); });
    return true;
  })()`);

  await waitFor(async () => {
    const n = await evaluate(`document.querySelectorAll('.box').length`);
    return typeof n === 'number' && n >= 3 ? n : null;
  }, 'grid boxes render', 60000);
  console.log('[step] grid rendered');

  const report = {};

  // 截图：初始态
  try {
    const shot1 = await sendT('Page.captureScreenshot', { format: 'png' }, 15000);
    fs.mkdirSync(path.join(projectRoot, 'test-run'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'test-run', 'ux-probe3-boot.png'), Buffer.from(shot1.data, 'base64'));
    console.log('[step] boot screenshot saved');
  } catch (err) { evalErrors.push('shot1: ' + err.message); }

  report.scopeFns = await evaluate(`(() => {
    const s = window.$bodyScope;
    const names = ['select','cleanSelected','enterDetailMode','leaveDetailMode','openItemContextMenu','openFileListContextMenu','openFolderContextMenu','updateSelection','changeOrderBy','switchGridLayout','zoomIn','zoomOut','toggleAll'];
    const out = {};
    for (const n of names) out[n] = typeof s[n];
    out.fnsRouted = !!window.__eagleCoreFns;
    return out;
  })()`);
  console.log('[step] scope fns probed');

  report.toolbarProbe = await evaluate(`(() => {
    const out = {};
    const sels = ['#topbar', '.topbar', '#eagle-toolbar-host', '.toolbar', '#searchbar', '.searchbar'];
    for (const sel of sels) {
      const el = document.querySelector(sel);
      out[sel] = el ? { cls: String(el.className).slice(0, 40), children: el.children.length, w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) } : null;
    }
    const all = Array.from(document.querySelectorAll('[class*="btn"], [class*="button"], .ic-btn')).filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    out.allVisibleButtons = all.length;
    out.buttonSample = all.slice(0, 14).map((el) => ({ cls: String(el.className).slice(0, 44), id: el.id || '', x: Math.round(el.getBoundingClientRect().x), y: Math.round(el.getBoundingClientRect().y) }));
    return out;
  })()`);
  console.log('[step] toolbar probed');

  // 双击缩略图
  const boxRect = await evaluate(`(() => {
    const box = document.querySelector('.box');
    if (!box) return null;
    const r = box.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`);
  if (boxRect) {
    for (let i = 0; i < 2; i++) {
      await sendT('Input.dispatchMouseEvent', { type: 'mousePressed', x: boxRect.x, y: boxRect.y, button: 'left', clickCount: i + 1 });
      await sendT('Input.dispatchMouseEvent', { type: 'mouseReleased', x: boxRect.x, y: boxRect.y, button: 'left', clickCount: i + 1 });
      await delay(120);
    }
    await delay(1500);
    report.afterDblClick = await evaluate(`(() => {
      const s = window.$bodyScope;
      return { isDetailMode: !!(s && s.isDetailMode), bodyCls: document.body.className.slice(0, 90) };
    })()`);
    console.log('[step] dblclick done: ' + JSON.stringify(report.afterDblClick));
    try {
      const shot2 = await sendT('Page.captureScreenshot', { format: 'png' }, 15000);
      fs.writeFileSync(path.join(projectRoot, 'test-run', 'ux-probe3-after-dblclick.png'), Buffer.from(shot2.data, 'base64'));
    } catch (err) { evalErrors.push('shot2: ' + err.message); }

    // 右键缩略图
    await sendT('Input.dispatchMouseEvent', { type: 'mousePressed', x: boxRect.x, y: boxRect.y, button: 'right', clickCount: 1 });
    await sendT('Input.dispatchMouseEvent', { type: 'mouseReleased', x: boxRect.x, y: boxRect.y, button: 'right', clickCount: 1 });
    await delay(1000);
    report.afterRightClick = await evaluate(`(() => {
      const s = window.$bodyScope;
      const menu = document.querySelector('.context-menu, #context-menu, [class*="context-menu"]');
      return {
        activeMenuType: s && s.activeMenu ? (s.activeMenu.items ? 'items:' + s.activeMenu.items.length : 'obj') : 'none',
        menuDom: !!menu,
        menuSample: menu ? (menu.textContent || '').replace(/\\s+/g, ' ').slice(0, 100) : '',
      };
    })()`);
    console.log('[step] rightclick done: ' + JSON.stringify(report.afterRightClick));
    try {
      const shot3 = await sendT('Page.captureScreenshot', { format: 'png' }, 15000);
      fs.writeFileSync(path.join(projectRoot, 'test-run', 'ux-probe3-after-rightclick.png'), Buffer.from(shot3.data, 'base64'));
    } catch (err) { evalErrors.push('shot3: ' + err.message); }

    await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await delay(300);
  }

  report.errors = await evaluate(`JSON.stringify(window.__ux.errors.slice(0, 25))`);
  report.warnCount = await evaluate(`window.__ux.warns.length`);
  report.warnSample = await evaluate(`JSON.stringify(window.__ux.warns.slice(0, 8))`);

  console.log('UX_PROBE3_REPORT ' + JSON.stringify(report, null, 1));
  if (evalErrors.length) console.log('PROBE_EVAL_ERRORS ' + JSON.stringify(evalErrors.slice(0, 12)));
} catch (err) {
  failure = err;
  console.error(`UX_PROBE3_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) {
    await stop(stack.electron);
    await stop(stack.vite);
    await stop(stack.backend);
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
