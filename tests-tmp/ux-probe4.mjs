import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// UX 诊断探针 R4（不提交）：工具栏/侧栏逐按钮真实点击验证死活
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-ux-probe4-'));
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
const watchdog = setTimeout(() => { console.log('UX_PROBE4_WATCHDOG'); process.exit(2); }, 420000);

try {
  console.log('[step] boot');
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
      await post('/api/library/create', { name: 'UX Probe 4', savePath: librariesRoot });
      const colors = [[25, 60, 210], [30, 180, 90], [200, 120, 30], [160, 40, 140]];
      const images = [];
      for (let i = 0; i < 4; i++) {
        const p = path.join(sourcesRoot, `Probe ${i + 1}.png`);
        createPng(p, colors[i]);
        images.push({ path: p, name: `Probe ${i + 1}` });
      }
      await post('/api/item/addFromPaths', { images });
    },
  });
  const { page } = stack;
  console.log('[step] booted');

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
  const click = async (x, y, button = 'left') => {
    await sendT('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, clickCount: 1 });
    await sendT('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, clickCount: 1 });
  };

  await sendT('Runtime.enable');
  await sendT('Page.enable');
  await waitFor(async () => (await evaluate(`document.readyState`)) === 'complete', 'ready', 60000);
  await waitFor(async () => (await evaluate(`!!window.$bodyScope`)) === true, 'scope', 60000);
  await evaluate(`(() => {
    window.__ux = { errors: [] };
    window.addEventListener('error', (e) => { window.__ux.errors.push(e.message + ' @ ' + e.lineno); });
    window.addEventListener('unhandledrejection', (e) => { window.__ux.errors.push('REJ: ' + String(e.reason).slice(0, 120)); });
    return true;
  })()`);
  await waitFor(async () => {
    const n = await evaluate(`document.querySelectorAll('.box').length`);
    return typeof n === 'number' && n >= 4 ? n : null;
  }, 'boxes', 60000);
  console.log('[step] grid ready');

  const report = { clicks: {} };

  // 逐按钮点击验证。定位 → 记录点击前状态 → 点击 → 观察状态变化/错误
  const probeClick = async (label, locatorExpr, effectExpr) => {
    const loc = await evaluate(locatorExpr);
    if (!loc || loc.__evalError || (typeof loc.x === 'number' && (loc.x <= 0 || loc.y <= 0))) {
      report.clicks[label] = { skipped: 'no-target', loc };
      return;
    }
    const before = await evaluate(effectExpr);
    await click(loc.x, loc.y);
    await delay(900);
    const after = await evaluate(effectExpr);
    report.clicks[label] = { before, after, changed: JSON.stringify(before) !== JSON.stringify(after) };
  };

  // 1) 缩放 +（网格放大）
  await probeClick('toolbar-zoom-in',
    `(() => { const el = document.querySelector('.ic-btn.zoom-btn:last-of-type, .ic-btn.zoom-btn:nth-of-type(2)') || Array.from(document.querySelectorAll('.ic-btn.zoom-btn')).pop(); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) }; })()`,
    `(() => { const s = window.$bodyScope; const el = document.querySelector('#box-list-slider'); return { zoom: s ? s.currentZoomLevel : null, slider: el ? el.value || el.style.width : null, thumbH: Math.round((document.querySelector('.box') || {}).getBoundingClientRect?.().height || 0) }; })()`);

  // 2) 滤镜按钮（右端 filter-btn）
  await probeClick('toolbar-filter-btn',
    `(() => { const el = document.querySelector('.ic-btn.filter-btn'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) }; })()`,
    `(() => { const el = document.querySelector('#filter-panel, .filter-panel, #filter, .filter'); return { filterVisible: el ? getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0 : false, bodyCls: document.body.className.includes('filter') }; })()`);

  // 3) 应用菜单按钮（左上 icon-btn）
  await probeClick('toolbar-app-menu',
    `(() => { const el = document.querySelector('.toolbar .icon-btn'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) }; })()`,
    `(() => { const s = window.$bodyScope; const menu = document.querySelector('.context-menu, [class*="context-menu"]'); return { activeMenu: s && s.activeMenu ? 'open' : 'none', menuDom: !!menu, sample: menu ? (menu.textContent || '').replace(/\\s+/g, ' ').slice(0, 60) : '' }; })()`);
  await evaluate(`(() => { const s = window.$bodyScope; if (s && s.closeContextMenu) s.closeContextMenu(); document.body.click(); return true; })()`);
  await delay(400);

  // 4) 侧栏：回收站
  await probeClick('sidebar-trash',
    `(() => { const els = Array.from(document.querySelectorAll('#sidebar li, .sidebar-item, [class*="sidebar"] li')); const el = els.find((e) => (e.textContent || '').includes('回收站')); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) }; })()`,
    `(() => { const s = window.$bodyScope; return { viewMode: s ? s.viewMode : null, current: s && s.current ? s.current.name : null }; })()`);

  // 5) 侧栏：全部（回默认）
  await probeClick('sidebar-all',
    `(() => { const els = Array.from(document.querySelectorAll('#sidebar li, .sidebar-item, [class*="sidebar"] li')); const el = els.find((e) => (e.textContent || '').trim().startsWith('全部')); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) }; })()`,
    `(() => { const s = window.$bodyScope; return { viewMode: s ? s.viewMode : null, current: s && s.current ? s.current.name : null }; })()`);

  // 6) 布局切换（网格尺寸滑杆旁 list/grid 切换——找 .layout 或 view 切换按钮）
  report.layoutButtons = await evaluate(`(() => {
    const cands = Array.from(document.querySelectorAll('.toolbar [class*="layout"], .toolbar [class*="view"], .toolbar [id*="layout"]'));
    return cands.map((el) => ({ cls: String(el.className).slice(0, 50), id: el.id, r: (() => { const b = el.getBoundingClientRect(); return { x: Math.round(b.x + b.width/2), y: Math.round(b.y + b.height/2) }; })() }));
  })()`);

  // 7) 搜索框聚焦输入
  await probeClick('search-input',
    `(() => { const el = document.querySelector('#search-input, .search input, input[type="text"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) }; })()`,
    `(() => { const el = document.activeElement; return { focused: el ? el.tagName + '.' + String(el.className).slice(0, 30) : 'none' }; })()`);

  // 8) 缩略图双击再确认（独立复测 + 直接调 enterDetailMode 对照）
  const boxRect = await evaluate(`(() => { const box = document.querySelector('.box'); const r = box.getBoundingClientRect(); return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) }; })()`);
  await click(boxRect.x, boxRect.y); await delay(150); await click(boxRect.x, boxRect.y); await delay(1200);
  report.dblclickRetry = await evaluate(`(() => { const s = window.$bodyScope; return { isDetailMode: !!(s && s.isDetailMode) }; })()`);
  report.enterDetailDirectCall = await evaluate(`(() => { try { const s = window.$bodyScope; const img = s.raw[0]; s.enterDetailMode(null, img); return { called: true, isDetailMode: !!s.isDetailMode }; } catch (err) { return { called: true, error: String(err).slice(0, 120) }; } })()`);
  await delay(800);
  report.detailAfterDirectCall = await evaluate(`(() => { const s = window.$bodyScope; return { isDetailMode: !!s.isDetailMode, bodyCls: document.body.className.slice(0, 60), current: s && s.current ? s.current.name : null }; })()`);
  try {
    const shot = await sendT('Page.captureScreenshot', { format: 'png' }, 15000);
    fs.mkdirSync(path.join(projectRoot, 'test-run'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'test-run', 'ux-probe4-detail-direct.png'), Buffer.from(shot.data, 'base64'));
  } catch (err) { evalErrors.push('shot: ' + err.message); }
  // Esc 退出详情
  await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await delay(600);
  report.afterEscFromDetail = await evaluate(`(() => { const s = window.$bodyScope; return { isDetailMode: !!s.isDetailMode }; })()`);

  report.runtimeErrors = await evaluate(`JSON.stringify(window.__ux.errors.slice(0, 20))`);
  console.log('UX_PROBE4_REPORT ' + JSON.stringify(report, null, 1));
  if (evalErrors.length) console.log('PROBE_EVAL_ERRORS ' + JSON.stringify(evalErrors.slice(0, 10)));
} catch (err) {
  failure = err;
  console.error(`UX_PROBE4_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
