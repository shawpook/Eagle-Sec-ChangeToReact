import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { bootStack, stop, waitFor } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// UX 诊断探针 R2（不提交）：console 捕获前置 + 截图 + 工具栏枚举 + 双击/右键行为验证
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-ux-probe2-'));
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
try {
  stack = await bootStack({
    librariesRoot,
    stateFile,
    userDataDir,
    beforeElectron: async (apiPort) => {
      const post = async (route, body) => {
        const response = await fetch(`http://127.0.0.1:${apiPort}${route}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') throw new Error(`${route} failed: ${JSON.stringify(payload)}`);
        return payload.data;
      };
      await post('/api/library/create', { name: 'UX Probe 2', savePath: librariesRoot });
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

  await page.send('Runtime.enable');
  await page.send('Page.enable');

  const evaluate = async (expression) => {
    const r = await Promise.race([
      page.send('Runtime.evaluate', { expression, returnByValue: true }),
      new Promise((resolve) => setTimeout(() => resolve({ __timeout: true }), 12000)),
    ]);
    if (r.__timeout) {
      evalErrors.push('TIMEOUT: ' + expression.slice(0, 60));
      return { __evalError: 'timeout' };
    }
    if (r.exceptionDetails) {
      const desc = r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails).slice(0, 200);
      evalErrors.push(desc.slice(0, 200));
      return { __evalError: desc.slice(0, 200) };
    }
    return r.result.value;
  };

  await waitFor(async () => {
    const r = await evaluate(`document.readyState`);
    return r === 'complete';
  }, 'main window ready', 45000);
  await waitFor(async () => {
    const r = await evaluate(`!!window.$bodyScope`);
    return r === true;
  }, 'app scope', 45000);

  // console/异常捕获最前置（页面 ready 后立刻装，先于任何其他 evaluate）
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
  }, 'grid boxes render', 45000);

  const report = {};

  // 截图：启动初始态
  const shot1 = await page.send('Page.captureScreenshot', { format: 'png' });
  fs.mkdirSync(path.join(projectRoot, 'test-run'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'test-run', 'ux-probe2-boot.png'), Buffer.from(shot1.data, 'base64'));

  // scope 函数在位性
  report.scopeFns = await evaluate(`(() => {
    const s = window.$bodyScope;
    const names = ['select','cleanSelected','enterDetailMode','leaveDetailMode','openItemContextMenu','openFileListContextMenu','openFolderContextMenu','updateSelection','changeOrderBy','switchGridLayout','setViewMode','zoomActual','toggle inspector'.replace(' ','')];
    const out = {};
    for (const n of names) out[n] = typeof s[n];
    return out;
  })()`);

  // 工具栏真实结构枚举
  report.toolbarProbe = await evaluate(`(() => {
    const out = {};
    const sels = ['#topbar', '.topbar', '#toolbar', '.toolbar', '.tool-options', '#content-toolbar', '.content-toolbar', '#searchbar', '.searchbar', '.layout-mode', '#layout-mode'];
    for (const sel of sels) {
      const el = document.querySelector(sel);
      out[sel] = el ? { cls: String(el.className).slice(0, 60), children: el.children.length, w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height), buttons: Array.from(el.querySelectorAll('.button, [class*="button"]')).length } : null;
    }
    // 全页面 button 类元素普查
    const all = Array.from(document.querySelectorAll('[class*="button"]')).filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    out.allVisibleButtons = all.length;
    out.buttonSample = all.slice(0, 12).map((el) => ({ cls: String(el.className).slice(0, 50), text: (el.textContent || '').trim().slice(0, 16), x: Math.round(el.getBoundingClientRect().x), y: Math.round(el.getBoundingClientRect().y) }));
    return out;
  })()`);

  // 双击缩略图 → 详情？
  const boxRect = await evaluate(`(() => {
    const box = document.querySelector('.box');
    const r = box.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  })()`);
  for (let i = 0; i < 2; i++) {
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: boxRect.x, y: boxRect.y, button: 'left', clickCount: i + 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: boxRect.x, y: boxRect.y, button: 'left', clickCount: i + 1 });
    await new Promise((r) => setTimeout(r, 120));
  }
  await new Promise((r) => setTimeout(r, 1500));
  report.afterDblClick = await evaluate(`(() => {
    const s = window.$bodyScope;
    return { isDetailMode: !!(s && s.isDetailMode), bodyCls: document.body.className.slice(0, 80) };
  })()`);
  const shot2 = await page.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(projectRoot, 'test-run', 'ux-probe2-after-dblclick.png'), Buffer.from(shot2.data, 'base64'));

  // 右键缩略图 → 条目菜单 or 列表菜单？
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: boxRect.x, y: boxRect.y, button: 'right', clickCount: 1 });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: boxRect.x, y: boxRect.y, button: 'right', clickCount: 1 });
  await new Promise((r) => setTimeout(r, 1000));
  report.afterRightClick = await evaluate(`(() => {
    const s = window.$bodyScope;
    const menu = document.querySelector('.context-menu, #context-menu, [class*="context-menu"]');
    return {
      activeMenuLen: s && s.activeMenu ? (s.activeMenu.items ? s.activeMenu.items.length : 'obj') : 0,
      menuDom: !!menu,
      menuSample: menu ? (menu.textContent || '').replace(/\\s+/g, ' ').slice(0, 80) : '',
    };
  })()`);
  const shot3 = await page.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(projectRoot, 'test-run', 'ux-probe2-after-rightclick.png'), Buffer.from(shot3.data, 'base64'));

  // Esc 关菜单 + 试点一个真实按钮（第一个可见 button 类元素）
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await new Promise((r) => setTimeout(r, 400));

  // 错误汇总
  report.errors = await evaluate(`JSON.stringify(window.__ux.errors.slice(0, 25))`);
  report.warnCount = await evaluate(`window.__ux.warns.length`);
  report.warnSample = await evaluate(`JSON.stringify(window.__ux.warns.slice(0, 8))`);

  console.log('UX_PROBE2_REPORT ' + JSON.stringify(report, null, 1));
  if (evalErrors.length) console.log('PROBE_EVAL_ERRORS ' + JSON.stringify(evalErrors.slice(0, 10)));
} catch (err) {
  failure = err;
  console.error(`UX_PROBE2_FAIL ${err.message}`);
} finally {
  if (stack) {
    await stop(stack.electron);
    await stop(stack.vite);
    await stop(stack.backend);
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
