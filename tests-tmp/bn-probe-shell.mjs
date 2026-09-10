// b1-9bn 探针：fns 壳 → itemMenuOpenItemContextMenu 直连验证
const { bootStack, stop } = await import('../tests/react-cdp-harness.mjs');
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const projectRoot = path.resolve('..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bn-probe-'));
fs.mkdirSync(path.join(tempRoot, 'libraries'), { recursive: true });
fs.writeFileSync(path.join(tempRoot, 'library-state.json'), JSON.stringify({ libraries: [] }));
process.env.EAGLE_MENU_SMOKE = '1';
let stack;
try {
  stack = await bootStack({ projectRoot, tempRoot });
  const page = stack.page;
  const r = await page.send('Runtime.evaluate', { expression: `(function () {
    try {
      const s = window.$bodyScope;
      const core = window.__eagleCoreFns;
      if (typeof core.openItemContextMenu !== 'function') return { ok: false, reason: 'fns shell missing' };
      let captured = null;
      const off = s.$on('CONTEXTMENU.OPEN', (ev, opts) => { captured = opts; });
      const p = core.openItemContextMenu({ stopPropagation() {}, target: { tagName: 'DIV' } }, s.current || (s.images || [])[0]);
      off();
      if (!captured) return { ok: false, reason: 'no broadcast (async builder?)', hasPromise: !!p && typeof p.then === 'function' };
      return { ok: true, count: (captured.items || []).length, showSearch: captured.showSearch };
    } catch (err) { return { ok: false, reason: 'throw: ' + err.message }; }
  })()`, returnByValue: true });
  console.log('PROBE', JSON.stringify(r.result.value));
} finally { try { await stop(stack); } catch (err) {} }
