// b1-9bo probe6: folder CRUD runtime drive (installFolderMenuFns registerd fns)
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bo-p6-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
const sourcesRoot = path.join(tempRoot, 'sources');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourcesRoot, { recursive: true });
fs.writeFileSync(stateFile, JSON.stringify({ libraries: [] }));
const harnessPath = path.join(projectRoot, 'tests', 'react-cdp-harness.mjs').split(path.sep).join('/');
const { bootStack, stop } = await import('file:///' + harnessPath);
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
      await post('/api/library/create', { name: 'BO Probe', savePath: librariesRoot });
      await post('/api/folder/create', { name: 'F1', images: [] });
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
  const result = await evaluate(`(async function () {
    try {
      const core = window.__eagleCoreFns;
      const s = window.$bodyScope;
      const need = ['openFolderContextMenu', 'openSmartFolderContextMenu', 'openNewSmartFolderContextMenu', 'renameFolder', 'cloneFolder', 'removeFolder', 'newSmartFolder', 'setFoldersOrder', 'lockFolder', 'changeFolderColor'];
      const missing = need.filter((k) => typeof core[k] !== 'function');
      if (missing.length) return { ok: false, reason: 'missing: ' + missing.join(',') };
      const folder = (s.folders || [])[0];
      if (!folder) return { ok: false, reason: 'no folder', folders: (s.folders || []).length };
      window.__boPayload = null;
      window.__eagleBus.on('CONTEXTMENU.OPEN', (options) => { window.__boPayload = { count: options && options.items ? options.items.length : 0 }; });
      core.openFolderContextMenu({ stopPropagation() {}, preventDefault() {}, target: { tagName: 'DIV' }, currentTarget: null }, folder);
      await new Promise((res) => setTimeout(res, 1500));
      return { ok: !!window.__boPayload && window.__boPayload.count >= 10, menu: window.__boPayload, fnCount: Object.keys(core).length };
    } catch (err) { return { ok: false, reason: 'throw: ' + err.message }; }
  })()`);
  console.log('PROBE6', JSON.stringify(result));
} finally {
  clearTimeout(watchdog);
  try { await stop(stack); } catch (err) {}
}
