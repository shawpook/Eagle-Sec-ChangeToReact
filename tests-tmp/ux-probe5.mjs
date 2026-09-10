import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// UX 诊断探针 R5（不提交）：终判三项——选中后 enterDetailMode、zoomIn 状态变化、滤镜面板 host
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-ux-probe5-'));
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
const watchdog = setTimeout(() => { console.log('UX_PROBE5_WATCHDOG'); process.exit(2); }, 420000);

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
      await post('/api/library/create', { name: 'UX Probe 5', savePath: librariesRoot });
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

  // A. 选中后直调 enterDetailMode
  report.A_selectThenEnter = await evaluate(`(async () => {
    const s = window.$bodyScope;
    const img = s.raw && s.raw[0];
    if (!img) return { error: 'no raw item' };
    s.select(null, img);
    await new Promise((r) => setTimeout(r, 300));
    const selectedOk = s.selected.length > 0;
    let enterError = null;
    try { s.enterDetailMode(null, img); } catch (err) { enterError = String(err).slice(0, 150); }
    await new Promise((r) => setTimeout(r, 600));
    return {
      selectedOk,
      enterError,
      isDetailMode: !!s.isDetailMode,
      currentName: s.current ? s.current.name : null,
      bodyHasDetailCls: document.body.className.includes('is-detail-mode'),
      detailContainerOpacity: (() => { const el = document.querySelector('#detail-container'); return el ? getComputedStyle(el).opacity : 'none'; })(),
    };
  })()`);
  console.log('[A] ' + JSON.stringify(report.A_selectThenEnter));
  try {
    const shot = await sendT('Page.captureScreenshot', { format: 'png' }, 15000);
    fs.mkdirSync(path.join(projectRoot, 'test-run'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'test-run', 'ux-probe5-detail.png'), Buffer.from(shot.data, 'base64'));
  } catch (err) { evalErrors.push('shot: ' + err.message); }

  // Esc 退出
  await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await delay(500);

  // B. zoomIn 真实状态（imageSize.height / slider）
  report.B_before = await evaluate(`(() => { const s = window.$bodyScope; return { h: s.imageSize && s.imageSize.height, layout: s.layout, sliderVal: (() => { const el = document.querySelector('#box-list-slider input, #box-list-slider'); return el ? (el.value || el.style.width || 'n/a').toString().slice(0, 30) : 'no-slider'; })() }; })()`);
  // 点 + 按钮（zoom-btn 第二个）与直接调 fns 对照
  report.B_callZoomIn = await evaluate(`(() => { try { const s = window.$bodyScope; s.adjustLayoutWidth(-1); return { ok: true, h: s.imageSize && s.imageSize.height }; } catch (err) { return { error: String(err).slice(0, 150) }; } })()`);
  await delay(600);
  report.B_after = await evaluate(`(() => { const s = window.$bodyScope; return { h: s.imageSize && s.imageSize.height, thumbH: Math.round((document.querySelector('.box') || { getBoundingClientRect: () => ({ height: 0 }) }).getBoundingClientRect().height) }; })()`);

  // C. 滤镜面板 host 与开关
  report.C_filterHosts = await evaluate(`(() => {
    const hosts = ['eagle-filter-host', 'filter-panel', 'filter', 'eagle-filter-region-host'];
    const out = {};
    for (const id of hosts) {
      const el = document.getElementById(id) || document.querySelector('.' + id);
      out[id] = el ? { w: Math.round(el.getBoundingClientRect().width), display: getComputedStyle(el).display, children: el.children.length } : null;
    }
    const s = window.$bodyScope;
    out.scopeFilterFields = s ? Object.keys(s).filter((k) => /filter/i.test(k)).slice(0, 12) : [];
    return out;
  })()`);

  console.log('UX_PROBE5_REPORT ' + JSON.stringify(report, null, 1));
  if (evalErrors.length) console.log('PROBE_EVAL_ERRORS ' + JSON.stringify(evalErrors.slice(0, 10)));
} catch (err) {
  failure = err;
  console.error(`UX_PROBE5_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
