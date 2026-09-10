// b1-9bn probe4: capture [core-fns] init failed detail
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bn-p4-'));
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
      await post('/api/library/create', { name: 'BN Probe', savePath: librariesRoot });
      createPng(path.join(sourcesRoot, 'P1.png'), [25, 60, 210]);
      await post('/api/item/addFromPaths', { images: [{ path: path.join(sourcesRoot, 'P1.png'), name: 'P1' }] });
    },
  });
  const { page } = stack;
  const evaluate = async (expression) => {
    const r = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('eval: ' + r.exceptionDetails.exception?.description?.slice(0, 250));
    return r.result.value;
  };
  await new Promise((r) => setTimeout(r, 2500));
  const result = await evaluate('(function () { const core = window.__eagleCoreFns; return { coreType: typeof core, keys: core ? Object.keys(core).length : 0, hasOICM: !!(core && typeof core.openItemContextMenu === "function"), s: typeof window.$bodyScope }; })()');
  console.log('PROBE4 core:', JSON.stringify(result));
} finally {
  clearTimeout(watchdog);
  try { await stop(stack); } catch (err) {}
}
