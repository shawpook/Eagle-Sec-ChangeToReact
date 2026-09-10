// b1-9bn 探针3：照抄 ui-interactions boot 形态（带 fixture），诊断 openItemContextMenu
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bn-p3-'));
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
        const response = await fetch(`http://127.0.0.1:${apiPort}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
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
    if (r.exceptionDetails) throw new Error('eval: ' + r.exceptionDetails.exception?.description?.slice(0, 200));
    return r.result.value;
  };
  await new Promise((r) => setTimeout(r, 2500));
  const result = await evaluate(`(async function () {
    try {
      window.__bnErrors = [];
      window.addEventListener('unhandledrejection', (e) => { window.__bnErrors.push('rej: ' + String(e.reason).slice(0, 200)); });
      window.addEventListener('error', (e) => { window.__bnErrors.push('err: ' + String(e.message).slice(0, 200)); });
      const s = window.$bodyScope;
      const core = window.__eagleCoreFns;
      if (typeof core.openItemContextMenu !== 'function') return { ok: false, reason: 'shell missing' };
      const img = (s.images || [])[0] || s.current;
      if (!img) return { ok: false, reason: 'no image', imgCount: (s.images || []).length };
      if (s.selected && s.selected.indexOf(img) === -1) s.selected = [img];
      window.__bnPayload = null;
      s.$on('CONTEXTMENU.OPEN', (_e, opts) => { window.__bnPayload = { count: opts && opts.items ? opts.items.length : 0 }; });
      const p = core.openItemContextMenu({ stopPropagation() {}, target: { tagName: 'DIV' }, preventDefault() {} }, img);
      await new Promise((res) => setTimeout(res, 2000));
      return { ok: !!window.__bnPayload, payload: window.__bnPayload, errors: window.__bnErrors.slice(0, 6), isPromise: !!(p && p.then) };
    } catch (err) { return { ok: false, reason: 'throw: ' + err.message }; }
  })()`);
  console.log('PROBE3', JSON.stringify(result));
} finally {
  clearTimeout(watchdog);
  try { await stop(stack); } catch (err) {}
}
