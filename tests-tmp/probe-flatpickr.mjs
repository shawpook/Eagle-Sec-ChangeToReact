import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { bootStack, stop } from '../tests/react-cdp-harness.mjs';
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-probe-fp-'));
let stack;
try {
  stack = await bootStack({
    librariesRoot: path.join(tempRoot, 'libraries'),
    stateFile: path.join(tempRoot, 'library-state.json'),
    userDataDir: path.join(tempRoot, 'user-data'),
  });
  await new Promise(r => setTimeout(r, 12000));
  const { page } = stack;
  const ev = async (expr) => (await page.send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
  console.log('typeof flatpickr:', await ev(`typeof window.flatpickr`));
  console.log('typeof FlatpickrInstance:', await ev(`typeof window.FlatpickrInstance`));
  console.log('l10ns.zh:', await ev(`!!(window.flatpickr && window.flatpickr.l10ns && window.flatpickr.l10ns.zh)`));
  console.log('script tags:', await ev(`Array.from(document.scripts).map(s=>s.getAttribute('src')).filter(s=>s&&s.indexOf('flatpickr')>-1).join('|')`));
  console.log('new native:', await ev(`(() => { try { const inp = document.createElement('input'); const inst = new window.FlatpickrInstance(inp, {}); return JSON.stringify({ok: !!inst, isInput: inst && inst._input === inp, hasDestroy: inst && typeof inst.destroy}); } catch (err) { return 'THROW: ' + err.message; } })()`));
  console.log('new bridge:', await ev(`(() => { try { const inp = document.createElement('input'); const inst = new window.FlatpickrInstance(inp, { locale: 'zh' }); const r = { ok: !!inst, isInput: inst && inst._input === inp, hasDestroy: inst && typeof inst.destroy }; try { inst.destroy(); r.destroyOk = true; } catch (e) { r.destroyErr = e.message; } return JSON.stringify(r); } catch (err) { return 'THROW: ' + err.message; } })()`));
} finally { await stop(stack).catch(() => {}); }
