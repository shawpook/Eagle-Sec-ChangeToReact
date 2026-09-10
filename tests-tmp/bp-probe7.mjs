// b1-9bp probe7: miscMenu builders runtime drive
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bp-p7-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.writeFileSync(stateFile, JSON.stringify({ libraries: [] }));
const harnessPath = path.join(projectRoot, 'tests', 'react-cdp-harness.mjs').split(path.sep).join('/');
const { bootStack, stop } = await import('file:///' + harnessPath);
let stack;
const watchdog = setTimeout(() => { console.log('WATCHDOG'); process.exit(2); }, 150000);
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
      await post('/api/library/create', { name: 'BP Probe', savePath: librariesRoot });
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
    throw new Error('waitFor: ' + label);
  };
  await waitFor(async () => evaluate('!!window.$bodyScope'), 'scope');
  await waitFor(async () => evaluate('!!window.__eagleCoreFns'), 'core-fns');
  const result = await evaluate(`(async function () {
    try {
      const core = window.__eagleCoreFns;
      const s = window.$bodyScope;
      const need = ['openTrashContextMenu', 'openFileListContextMenu', 'openOrderMenu', 'openApplicationContextMenu', 'openFilterAddContextMenu', 'openNewContextMenu', 'openQuickAccessContextMenu', 'openRatioContextMenu', 'openSidebarVisibleContextMenu', 'openSmartFolderExpandContextMenu'];
      const missing = need.filter((k) => typeof core[k] !== 'function');
      if (missing.length) return { ok: false, reason: 'missing: ' + missing.join(',') };
      window.__bpPayload = null;
      window.__bpOrder = false;
      window.__eagleBus.on('CONTEXTMENU.OPEN', (options) => { window.__bpPayload = { count: options && options.items ? options.items.length : 0 }; });
      s.$on('OPEN_LAYOUT_PANEL', () => { window.__bpOrder = true; });
      core.openOrderMenu({ stopPropagation() {}, preventDefault() {} });
      await new Promise((res) => setTimeout(res, 800));
      core.openTrashContextMenu({ stopPropagation() {}, preventDefault() {}, target: { tagName: 'DIV' } });
      await new Promise((res) => setTimeout(res, 800));
      return { ok: window.__bpOrder === true && !!window.__bpPayload && window.__bpPayload.count > 0, orderPanel: window.__bpOrder, trashMenu: window.__bpPayload, fnCount: Object.keys(core).length };
    } catch (err) { return { ok: false, reason: 'throw: ' + err.message }; }
  })()`);
  console.log('PROBE7', JSON.stringify(result));
} finally {
  clearTimeout(watchdog);
  try { await stop(stack); } catch (err) {}
}
