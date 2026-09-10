// b1-9bl probe2: fetch Vite-transformed module URLs to find the chain breaker
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bl-p2-'));
const harnessPath = path.join(projectRoot, 'tests', 'react-cdp-harness.mjs').split(path.sep).join('/');
const { bootStack, stop } = await import('file:///' + harnessPath);
let stack;
const watchdog = setTimeout(() => { console.log('WATCHDOG'); process.exit(2); }, 120000);
try {
  stack = await bootStack({
    librariesRoot: path.join(tempRoot, 'libraries'),
    stateFile: path.join(tempRoot, 'library-state.json'),
    userDataDir: path.join(tempRoot, 'user-data'),
  });
  const vitePort = stack.vitePort || (stack.info && stack.info.vitePort);
  console.log('VITE_PORT', vitePort);
  const mods = [
    '/src/app/react/main.tsx',
    '/src/app/react/core/smoothZoomEngine.ts',
    '/src/app/react/core/bitmapViewer.ts',
    '/src/app/react/core/dataMachinery.ts',
    '/src/app/react/core/controllerFns.ts',
  ];
  for (const m of mods) {
    try {
      const res = await fetch(`http://127.0.0.1:${vitePort}${m}`);
      const body = await res.text();
      console.log(res.status, m, 'len=' + body.length, body.slice(0, 120).replace(/\n/g, '⏎'));
    } catch (err) {
      console.log('FETCH_FAIL', m, String(err).slice(0, 120));
    }
  }
} finally {
  clearTimeout(watchdog);
  try { await stop(stack); } catch (err) {}
}
