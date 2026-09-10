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
    if (r.exceptionDetails) return 'EVALERR ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || '').slice(0, 900);
    return r.result.value;
  };
  await page.send('Runtime.enable');
  await waitFor(async () => (await evaluate('document.readyState')) === 'complete', 'ready', 60000);
  await waitFor(async () => (await evaluate('!!window.$bodyScope')) === true, 'scope', 60000);
  const expr = "(() => { try { const errors = []; window.addEventListener('error', (e) => errors.push(String(e.error && e.error.stack || e.message).split(String.fromCharCode(10)).slice(0, 6).join(' | '))); const inp = document.createElement('input'); document.body.appendChild(inp); const inst = new window.FlatpickrInstance(inp, { locale: 'zh', dateFormat: 'Y-m-d', mode: 'range' }); const fired = []; inst.config.onChange = (sd) => fired.push(sd.length); inst._input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); const cal = inst.calendarContainer; const days = Array.from(cal.querySelectorAll('.dayContainer .flatpickr-day')); const dayA = days.find((d) => !d.classList.contains('prevMonthDay') && !d.classList.contains('nextMonthDay')); dayA.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); const afterFirst = { fired: fired.slice(), sel: inst.selectedDates.length }; const dayB = days[days.indexOf(dayA) + 5]; dayB.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); return JSON.stringify({ afterFirst, fired: fired.slice(), errors, value: inst._input.value }); } catch (err) { return 'THROW ' + err.message + ' AT ' + String(err.stack).split(String.fromCharCode(10)).slice(0, 5).join(' || '); } })()";
  console.log(await evaluate(expr));
} finally {
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
