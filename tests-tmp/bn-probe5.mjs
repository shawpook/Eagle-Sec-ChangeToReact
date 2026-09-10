// b1-9bn probe5: waitFor-ready + direct drive of fns["openItemContextMenu"]
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bn-p5-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
const sourcesRoot = path.join(tempRoot, 'sources');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourcesRoot, { recursive: true });
fs.writeFileSync(stateFile, JSON.stringify({ libraries: [] }));
const harnessPath = path.join(projectRoot, 'tests', 'react-cdp-harness.mjs').split(path.sep).join('/');
const { bootStack, stop } = await import('file:///' + harnessPath);
function createPng(filePath, color) {
  const png = new PNG({ width: 40, height: 30 });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = color[0]; png.data[i + 1] = color[1]; png.data[i + 2] = color[2]; png.data[i + 3] = 255;
  }
  fs.writeFileSync(filePath, PNG.sync.write(png));
}
let stack;
const watchdog = setTimeout(() => { console.log('WATCHDOG'); process.exit(2); }, 180000);
try {
  stack = await bootStack({
    librariesRoot, stateFile, userDataDir,
    beforeElectron: async (apiPort) => {
      const post = async (route, body) => {
        const response = await fetch('http://127.0.0.1:' + apiPort + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') throw new Error(route);
        return payload.data;
      };
      await post('/api/library/create', { name: 'BN Probe', savePath: librariesRoot });
      createPng(path.join(sourcesRoot, 'P1.png'), [25, 60, 210]);
      await post('/api/item/addFromPaths', { images: [{ path: path.join(sourcesRoot, 'P1.png'), name: 'P1' }] });
    },
  });
  const { page } = stack;
  const evaluate = async (expression) => {
    const r = await Promise.race([
      page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }),
      new Promise((resolve) => setTimeout(() => resolve({ __timeout: true }), 20000)),
    ]);
    if (r && r.__timeout) throw new Error('CDP timeout');
    if (r.exceptionDetails) throw new Error('eval: ' + r.exceptionDetails.exception?.description?.slice(0, 300));
    return r.result.value;
  };
  const waitFor = async (fn, label, ms) => {
    const t0 = Date.now();
    while (Date.now() - t0 < (ms || 60000)) {
      try { const r = await fn(); if (r) return r; } catch (err) {}
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error('waitFor timeout: ' + label);
  };
  await waitFor(async () => evaluate('!!window.$bodyScope'), 'scope');
  await waitFor(async () => evaluate('!!window.__eagleCoreFns'), 'core-fns');
  await waitFor(async () => evaluate('(window.$bodyScope && (window.$bodyScope.raw || window.$bodyScope.images || []).length) > 0'), 'images');
  const result = await evaluate(`(async function () {
    try {
      window.__bnRej = [];
      window.addEventListener('unhandledrejection', (e) => { window.__bnRej.push(String(e.reason && (e.reason.stack || e.reason.message) || e.reason).slice(0, 400)); });
      const s = window.$bodyScope;
      const core = window.__eagleCoreFns;
      const img = (s.images || [])[0] || s.current || (s.raw || [])[0] || (s.allImages || [])[0];
      if (!img) return { ok: false, reason: 'no image', coreKeys: Object.keys(core).length };
      if (s.selected && s.selected.indexOf(img) === -1) s.selected = [img];
      window.__bnPayload = null;
      s.$on('CONTEXTMENU.OPEN', (_e, opts) => { window.__bnPayload = { count: opts && opts.items ? opts.items.length : 0 }; });
      const p = core.openItemContextMenu({ stopPropagation() {}, preventDefault() {}, target: { tagName: 'DIV' } }, img);
      await new Promise((res) => setTimeout(res, 2000));
      return { ok: !!window.__bnPayload, payload: window.__bnPayload, rejections: window.__bnRej.slice(0, 3), coreKeys: Object.keys(core).length };
    } catch (err) { return { ok: false, reason: 'throw: ' + err.message, stack: String(err.stack).slice(0, 300) }; }
  })()`);
  console.log('PROBE5', JSON.stringify(result, null, 1));
} finally {
  clearTimeout(watchdog);
  try { await stop(stack); } catch (err) {}
}
