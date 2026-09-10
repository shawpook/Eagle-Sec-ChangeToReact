import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// UX 诊断探针 R6（不提交）：选中→enterDetailMode 同步分步验证 + 滤镜面板真 host 检查
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-ux-probe6-'));
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
const watchdog = setTimeout(() => { console.log('UX_PROBE6_WATCHDOG'); process.exit(2); }, 420000);

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
      await post('/api/library/create', { name: 'UX Probe 6', savePath: librariesRoot });
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
  await sendT('Runtime.enable');
  await sendT('Page.enable');
  await waitFor(async () => (await evaluate(`document.readyState`)) === 'complete', 'ready', 60000);
  await waitFor(async () => (await evaluate(`!!window.$bodyScope`)) === true, 'scope', 60000);
  await waitFor(async () => {
    const n = await evaluate(`document.querySelectorAll('.box').length`);
    return typeof n === 'number' && n >= 3 ? n : null;
  }, 'boxes', 60000);

  const report = {};

  // 选中
  report.select = await evaluate(`(() => { const s = window.$bodyScope; try { s.select(null, s.raw[0]); return { selected: s.selected.length }; } catch (err) { return { error: String(err).slice(0, 150) }; } })()`);
  await delay(300);
  // 进详情
  report.enter = await evaluate(`(() => { const s = window.$bodyScope; try { s.enterDetailMode(null, s.raw[0]); return { isDetailMode: !!s.isDetailMode, current: s.current ? s.current.name : null }; } catch (err) { return { error: String(err).slice(0, 150) }; } })()`);
  await delay(1200);
  report.detailState = await evaluate(`(() => { const s = window.$bodyScope; return { isDetailMode: !!s.isDetailMode, bodyDetailCls: document.body.className.includes('is-detail-mode'), current: s.current ? s.current.name : null, showDetailImage: !!s.showDetailImage, detailOpacity: (() => { const el = document.querySelector('#detail-container'); return el ? getComputedStyle(el).opacity : 'none'; })(), imgSrc: (() => { const el = document.querySelector('#detail-image, #bitmap-viewer img, #detail-container img'); return el ? String(el.src).slice(-60) : 'none'; })() }; })()`);
  try {
    const shot = await sendT('Page.captureScreenshot', { format: 'png' }, 15000);
    fs.mkdirSync(path.join(projectRoot, 'test-run'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'test-run', 'ux-probe6-detail.png'), Buffer.from(shot.data, 'base64'));
  } catch (err) { evalErrors.push('shot: ' + err.message); }

  // 滤镜真 host
  report.filterHost = await evaluate(`(() => { const el = document.getElementById('eagle-filter-toolbar-host'); return el ? { children: el.children.length, w: Math.round(el.getBoundingClientRect().width), sample: (el.textContent || '').replace(/\\s+/g, ' ').slice(0, 80) } : null; })()`);

  // 滤镜按钮点击 → host/overlay 变化
  const filterBtn = await evaluate(`(() => { const el = document.querySelector('.ic-btn.filter-btn'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) }; })()`);
  if (filterBtn) {
    await sendT('Input.dispatchMouseEvent', { type: 'mousePressed', x: filterBtn.x, y: filterBtn.y, button: 'left', clickCount: 1 });
    await sendT('Input.dispatchMouseEvent', { type: 'mouseReleased', x: filterBtn.x, y: filterBtn.y, button: 'left', clickCount: 1 });
    await delay(900);
    report.filterAfterClick = await evaluate(`(() => {
      const host = document.getElementById('eagle-filter-toolbar-host');
      const overlay = document.getElementById('filter-toolbar-overlay');
      const s = window.$bodyScope;
      return {
        hostChildren: host ? host.children.length : -1,
        hostW: host ? Math.round(host.getBoundingClientRect().width) : -1,
        overlayDisplay: overlay ? getComputedStyle(overlay).display : 'none',
        bodyClsHasFilter: document.body.className.includes('filter'),
        sample: host ? (host.textContent || '').replace(/\\s+/g, ' ').slice(0, 80) : '',
      };
    })()`);
    try {
      const shot2 = await sendT('Page.captureScreenshot', { format: 'png' }, 15000);
      fs.writeFileSync(path.join(projectRoot, 'test-run', 'ux-probe6-filter.png'), Buffer.from(shot2.data, 'base64'));
    } catch (err) { evalErrors.push('shot2: ' + err.message); }
  }

  console.log('UX_PROBE6_REPORT ' + JSON.stringify(report, null, 1));
  if (evalErrors.length) console.log('PROBE_EVAL_ERRORS ' + JSON.stringify(evalErrors.slice(0, 10)));
} catch (err) {
  failure = err;
  console.error(`UX_PROBE6_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
