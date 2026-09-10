import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { bootStack, stop, waitFor } from '../tests/react-cdp-harness.mjs';
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bw-dbg-'));
const librariesRoot = path.join(tempRoot, 'libraries'); const stateFile = path.join(tempRoot, 'library-state.json'); const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });
let stack;
try {
  stack = await bootStack({ librariesRoot, stateFile, userDataDir, beforeElectron: async (apiPort) => {
    const r = await fetch('http://127.0.0.1:' + apiPort + '/api/library/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'DBG', savePath: librariesRoot }) }); await r.json();
  }});
  const { page } = stack;
  const evaluate = async (expression) => {
    const r = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return 'EVALERR ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || '').slice(0, 900);
    return r.result.value;
  };
  await page.send('Runtime.enable');
  await waitFor(async () => (await evaluate('document.readyState')) === 'complete', 'ready', 60000);
  await waitFor(async () => (await evaluate('!!window.$bodyScope')) === true, 'scope', 60000);
  const expr = "(() => { try { window.swal({ html: 'dbg' }); return 'OK modal=' + !!document.querySelector('.swal2-container .swal2-modal') + ' first120=' + (document.querySelector('.swal2-container') ? document.querySelector('.swal2-container').innerHTML.slice(0,120) : 'NULL'); } catch (err) { return 'THROW ' + err.message + ' AT ' + String(err.stack).split(String.fromCharCode(10)).slice(0,4).join(' || ')} })()";
  console.log(await evaluate(expr));
} finally {
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
