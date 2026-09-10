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
    if (r.exceptionDetails) return 'EVALERR ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || '').slice(0, 600);
    return r.result.value;
  };
  await page.send('Runtime.enable');
  await waitFor(async () => (await evaluate('document.readyState')) === 'complete', 'ready', 60000);
  await waitFor(async () => (await evaluate('!!window.$bodyScope')) === true, 'scope', 60000);
  const expr = "(() => { const out={}; const tpl = window.__bwDbg || ''; out.hasTpl = 'n/a'; try { const d = document.createElement('div'); d.innerHTML = window.__bwModalTemplate || 'TEMPLATE-NOT-EXPOSED'; out.probe1 = d.querySelector('.swal2-modal') ? 'modal-found' : 'modal-null'; } catch(e) { out.probe1 = 'ERR ' + e.message; } out.child = 'skip'; return JSON.stringify(out); })()";
  console.log(await evaluate(expr));
  // 直接复现 buildContainer 核心：innerHTML 注入后 querySelector
  const expr2 = "(() => { try { const c = document.createElement('div'); c.className='swal2-container'; c.innerHTML = (window.__eagleDialogTemplate || null) ? window.__eagleDialogTemplate : 'NO-TEMPLATE-EXPOSED'; const m = c.querySelector('.swal2-modal'); return 'query=' + (m ? 'OK children=' + m.childNodes.length : 'NULL') + '; first100=' + c.innerHTML.slice(0,100); } catch (e) { return 'ERR ' + e.message; } })()";
  console.log(await evaluate(expr2));
  // 从已创建的 container（若存在）看真实 DOM
  const expr3 = "(() => { try { window.swal({html:'x'}); return 'no-throw'; } catch (e) { return 'throw=' + e.message; } })()";
  console.log(await evaluate(expr3));
  const expr4 = "(() => { const c = document.querySelector('.swal2-container'); if (!c) return 'no-container'; const m = c.querySelector('.swal2-modal'); return 'modal=' + !!m + ' innerHTML=' + (c.innerHTML||'').slice(0,200); })()";
  console.log(await evaluate(expr4));
} finally {
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
