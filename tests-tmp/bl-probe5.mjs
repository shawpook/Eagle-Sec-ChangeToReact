// b1-9bl probe5: dynamic-import each link module inside the live page to catch eval errors
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bl-p5-'));
const harnessPath = path.join(projectRoot, 'tests', 'react-cdp-harness.mjs').split(path.sep).join('/');
const { bootStack, stop } = await import('file:///' + harnessPath);
const watchdog = setTimeout(() => { console.log('WATCHDOG'); process.exit(2); }, 150000);
let stack;
try {
  stack = await bootStack({
    librariesRoot: path.join(tempRoot, 'libraries'),
    stateFile: path.join(tempRoot, 'library-state.json'),
    userDataDir: path.join(tempRoot, 'user-data'),
  });
  const { page } = stack;
  await new Promise((r) => setTimeout(r, 8000));
  const expr = `(async () => {
    const mods = [
      '/src/app/react/core/smoothZoomEngine.ts',
      '/src/app/react/core/controllerFns.ts',
      '/src/app/react/core/dataMachinery.ts',
      '/src/app/react/services/itemMenuService.ts',
      '/src/app/react/main.tsx',
    ];
    const out = [];
    for (const m of mods) {
      try {
        await import(m + '?t=' + Date.now());
        out.push('OK ' + m);
      } catch (err) {
        out.push('FAIL ' + m + ' :: ' + String(err && (err.message || err)).slice(0, 300));
      }
    }
    return out.join('\\n');
  })()`;
  const r = await page.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  console.log(r.result.value || JSON.stringify(r.result));
} finally {
  clearTimeout(watchdog);
  try { await Promise.race([stop(stack), new Promise((r) => setTimeout(r, 8000))]); } catch (err) {}
}
process.exit(0);
