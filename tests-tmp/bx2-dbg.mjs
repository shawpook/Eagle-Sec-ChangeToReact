import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { bootStack, stop, waitFor } from '../tests/react-cdp-harness.mjs';
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bx2-dbg-'));
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
    if (r.exceptionDetails) return 'EVALERR ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || '').slice(0, 700);
    return r.result.value;
  };
  await page.send('Runtime.enable');
  await waitFor(async () => (await evaluate('document.readyState')) === 'complete', 'ready', 60000);
  await waitFor(async () => (await evaluate('!!window.$bodyScope')) === true, 'scope', 60000);
  const expr = "(() => { try { const inp = document.createElement('input'); inp.style.cssText='position:fixed;left:50px;top:50px;width:120px;'; document.body.appendChild(inp); const inst = new window.FlatpickrInstance(inp, {locale:'zh', dateFormat:'Y-m-d'}); const focusLog = []; inp.addEventListener('focus', () => focusLog.push('focus-event')); inp.focus(); return JSON.stringify({ activeIsInput: document.activeElement === inp, focusLog, openNow: inst.isOpen, calCls: inst.calendarContainer.className }); } catch (err) { return 'THROW ' + err.message + ' AT ' + String(err.stack).split(String.fromCharCode(10)).slice(0,4).join(' || '); } })()";
  console.log(await evaluate(expr));
  const expr2 = "(() => { try { const d = new Date(); const inst2 = new window.FlatpickrInstance(document.createElement('input'), {locale:'zh', dateFormat:'Y-m-d'}); inst2.setDate([new Date(2024,0,1), new Date(2024,0,10)]); return 'setdate-ok ' + inst2._input.value; } catch (err) { return 'THROW2 ' + err.message + ' AT ' + String(err.stack).split(String.fromCharCode(10)).slice(0,4).join(' || '); } })()";
  console.log(await evaluate(expr2));
} finally {
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
