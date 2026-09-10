import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// b1-9bu-A 探针：Z 键悬停预览复活全链（mouseover 置 lastElem → keydown Z → isShow → keyup 归零）
// + hover 零 ReferenceError + facade 面。
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bu-probe-'));
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
const watchdog = setTimeout(() => { console.log('BU_PROBE_WATCHDOG'); process.exit(2); }, 300000);

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
      await post('/api/library/create', { name: 'BU Probe', savePath: librariesRoot });
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
    if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.exception?.description?.slice(0, 200)}`);
    return r.result.value;
  };
  const assert = (name, pass, detail) => {
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass ? '' : ' — ' + JSON.stringify(detail)}`);
    if (!pass) failure = failure || new Error(name);
  };

  await sendT('Runtime.enable');
  await waitFor(async () => (await evaluate(`document.readyState`)) === 'complete', 'ready', 60000);
  await waitFor(async () => (await evaluate(`!!window.$bodyScope`)) === true, 'scope', 60000);

  await evaluate(`(() => {
    window.__uxErrors = [];
    window.addEventListener('error', (e) => { window.__uxErrors.push(String(e.message).slice(0, 160)); });
    window.addEventListener('unhandledrejection', (e) => { window.__uxErrors.push('REJ: ' + String(e.reason).slice(0, 160)); });
    return true;
  })()`);

  await waitFor(async () => {
    const n = await evaluate(`document.querySelectorAll('.box').length`);
    return typeof n === 'number' && n >= 3 ? n : null;
  }, 'boxes', 60000);

  // ① facade 面与 install 标记
  const facade = await evaluate(`(() => ({
    hp: typeof window.HoverPreview === 'object',
    show: typeof window.HoverPreview?.show === 'function',
    hide: typeof window.HoverPreview?.hide === 'function',
    cleanup: typeof window.cleanupBoxHoverPreview === 'function',
    watch: typeof window.startHoverPreviewWatch === 'function',
    rpa: typeof window.removePlayingAudios === 'function',
    rbap: typeof window.removeBoxAudioPlayer === 'function',
    pae: Array.isArray(window.playingAudiosElements),
    loaded: window.__eagleBundleGlobals ? window.__eagleBundleGlobals.hoverPreviewLoaded === true : null,
    container: !!document.getElementById('hover-preview-container'),
  }))()`);
  assert('facade-surface', facade.hp && facade.show && facade.hide && facade.cleanup && facade.watch && facade.rpa && facade.rbap && facade.pae && facade.loaded === true && facade.container, facade);

  // ② Z 键全链：mouseover 置 lastElem → keydown Z → isShow → keyup 归零
  const c1 = await evaluate(`(() => { const b = document.querySelector('.box'); const r = b.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + Math.min(r.height / 2, 60)) }; })()`);
  await sendT('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c1.x, y: c1.y });
  await delay(300);
  const lastElemSet = await evaluate(`(() => ({ le: !!window.HoverPreview.lastElem, show: window.HoverPreview.isShow }))()`);
  assert('mouseover-sets-lastElem', lastElemSet.le === true && lastElemSet.show === false, lastElemSet);

  await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90 });
  await delay(250);
  const zDown = await evaluate(`(() => ({ show: window.HoverPreview.isShow, kd: window.HoverPreviewKeydown, cls: document.getElementById('hover-preview-container').className }))()`);
  assert('z-key-shows-preview', zDown.show === true && zDown.kd === true && String(zDown.cls).indexOf('show') > -1, zDown);

  await sendT('Input.dispatchKeyEvent', { type: 'keyUp', key: 'z', code: 'KeyZ', windowsVirtualKeyCode: 90 });
  await delay(250);
  const zUp = await evaluate(`(() => ({ show: window.HoverPreview.isShow, kd: window.HoverPreviewKeydown }))()`);
  assert('z-keyup-hides-preview', zUp.show === false && zUp.kd === false, zUp);

  // ③ 悬停零 ReferenceError（bu 期回归）
  await delay(400);
  const errs = await evaluate(`window.__uxErrors.slice(0, 5)`);
  assert('hover-zero-reference-errors', errs.length === 0, errs);

  if (failure) throw failure;
  console.log('BU_PROBE1_OK');
} catch (err) {
  failure = err;
  console.error(`BU_PROBE1_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
