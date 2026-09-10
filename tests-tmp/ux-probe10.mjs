import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-ux-probe10-'));
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
const watchdog = setTimeout(() => { console.log('WATCHDOG'); process.exit(2); }, 360000);

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
      await post('/api/library/create', { name: 'UX Probe 10', savePath: librariesRoot });
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
    if (r.exceptionDetails) return { __evalError: (r.exceptionDetails.exception?.description || '').slice(0, 160) };
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
  report.mousetrapState = await evaluate(`(() => {
    const w = window, s = w.$bodyScope;
    return {
      Mousetrap: typeof w.Mousetrap,
      version: w.Mousetrap && w.Mousetrap.version,
      sMousetrapType: typeof s.mousetrap,
      keysCount: s.mousetrap ? Object.keys(s.mousetrap).length : -1,
      hasEnter: s.mousetrap ? 'enter' in s.mousetrap : false,
      enterHandlerType: s.mousetrap ? typeof s.mousetrap['enter'] : 'na',
      shimFlag: !!s.__eagleShim,
      throttle: typeof w.throttle,
    };
  })()`);
  console.log('[state] ' + JSON.stringify(report.mousetrapState));

  // 选中后直接调 toggleDetailMode（绕过键盘）
  report.directToggle = await evaluate(`(() => {
    const s = w = window.$bodyScope || window.$bodyScope; const ss = window.$bodyScope;
    try { ss.select(null, ss.raw[0]); } catch (err) { return { selErr: String(err).slice(0, 100) }; }
    try { ss.toggleDetailMode(null); return { isDetailMode: !!ss.isDetailMode, current: ss.current ? ss.current.name : null }; } catch (err) { return { err: String(err).slice(0, 150) }; }
  })()`);
  console.log('[direct-toggle] ' + JSON.stringify(report.directToggle));
  await evaluate(`(() => { const s = window.$bodyScope; if (s.isDetailMode) { window.postMessage('Exit', '*'); } return true; })()`);
  await delay(500);

  // Mousetrap.trigger('enter')（mousetrap 自带测试 API）
  report.triggerEnter = await evaluate(`(() => {
    const s = window.$bodyScope;
    try { window.Mousetrap.trigger('enter'); return { isDetailMode: !!s.isDetailMode }; } catch (err) { return { err: String(err).slice(0, 150) }; }
  })()`);
  console.log('[trigger-enter] ' + JSON.stringify(report.triggerEnter));

  report.manualInit = await evaluate(`(() => {
    const s = window.$bodyScope;
    try { return { keys: Object.keys(s.mousetrap || {}).length, hasEnter: s.mousetrap ? ('enter' in s.mousetrap) : false, bound: typeof s.mousetrap && s.mousetrap['enter'] ? 'fn' : 'na' }; } catch (err) { return { err: String(err.stack || err).slice(0, 400) }; }
  })()`);
  console.log('[manual-init] ' + JSON.stringify(report.manualInit));

  report.kbDebug = await evaluate(`window.__kbDebug || 'no-marker'`);
  report.proxyRoundtrip = await evaluate(`(() => {
    const s = window.$bodyScope;
    const probe = { k1: () => {}, k2: () => {} };
    s.mousetrap = probe;
    const readBack = s.mousetrap;
    return { sameRef: readBack === probe, keys: Object.keys(readBack || {}).length, json: JSON.stringify(readBack || {}).slice(0, 60), protoTag: Object.prototype.toString.call(readBack) };
  })()`);
  console.log('[roundtrip] ' + JSON.stringify(report.proxyRoundtrip));
  console.log('[kb-debug] ' + JSON.stringify(report.kbDebug));

  report.orderMenuChain = await evaluate(`(() => {
    const s = window.$bodyScope;
    window.__lp = false;
    s.$on('OPEN_LAYOUT_PANEL', () => { window.__lp = true; });
    let err = null;
    try { s.openOrderMenu(); } catch (e) { err = String(e.stack || e).slice(0, 200); }
    return { typeofOpenOrderMenu: typeof s.openOrderMenu, fired: window.__lp, err };
  })()`);
  console.log('[order-menu] ' + JSON.stringify(report.orderMenuChain));

  console.log('UX_PROBE10_REPORT ' + JSON.stringify(report, null, 1));
} catch (err) {
  failure = err;
  console.error(`UX_PROBE10_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
