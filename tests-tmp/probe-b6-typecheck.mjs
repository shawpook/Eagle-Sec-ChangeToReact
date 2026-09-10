// B6 诊断：复现 stage-smoke 的「type check drives rules + badge + breadcrumb」断言并拆解 4 个子条件。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'b6diag-'));
const stack = await bootStack({
  librariesRoot: (fs.mkdirSync(path.join(tmp, 'libraries'), { recursive: true }), path.join(tmp, 'libraries')),
  stateFile: path.join(tmp, 'state.json'),
  userDataDir: path.join(tmp, 'ud'),
  beforeElectron: async (apiPort) => {
    const post = async (route, body) => {
      const r = await fetch(`http://127.0.0.1:${apiPort}${route}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return (await r.json()).data;
    };
    await post('/api/library/create', { name: 'B6Diag', savePath: path.join(tmp, 'libraries') });
    const sharp = (await import('sharp')).default;
    const png = await sharp({ create: { width: 640, height: 400, channels: 4, background: '#38bdf8' } }).png().toBuffer();
    const a = path.join(tmp, 'a.png');
    fs.writeFileSync(a, png);
    await post('/api/item/addFromPath', { paths: [a] });
  },
});
const page = stack.page;
const ev = (e) => page.send('Runtime.evaluate', { expression: e, returnByValue: true });
const show = async (label, expr) => {
  const r = await ev(expr);
  if (r.exceptionDetails) { console.log('%-30s => EVAL_THROW %s', label, String(r.exceptionDetails.exception && r.exceptionDetails.exception.description).slice(0, 200)); return; }
  console.log('%-30s => %s', label, JSON.stringify(r.result && r.result.value));
};
try {
  await waitFor(async () => (await ev('document.readyState')).result.value === 'complete', 'ready', 30000);
  await waitFor(async () => (await ev(`!!document.getElementById('main-app')`)).result.value, 'main-app', 45000);
  await waitFor(async () => (await ev(`document.querySelectorAll('#eagle-filter-toolbar-host .filter-item').length >= 17`)).result.value, '17 items', 45000);

  await ev(`(() => {
    const btns = Array.from(document.querySelectorAll('#eagle-toolbar-host .right .ic-btn.filter-btn'));
    const b = btns.find((x) => x.querySelector('img[src*="ic-toolbar-filter.svg"]'));
    b && b.click(); return true;
  })()`);
  await delay(1200);
  await ev(`(() => { const it = document.getElementById('types-filter-item'); it && it.querySelector('.name') && it.querySelector('.name').click(); return true; })()`);
  await delay(1200);
  await show('check-item count', `document.querySelectorAll('#types-filter-item .check-item').length`);
  await show('clicked', `(() => { const it = document.getElementById('types-filter-item'); const c = it && it.querySelector('.check-item'); if (!c) return 'no check'; c.click(); return 'ok'; })()`);
  await delay(2000);
  await show('activeCount', `(() => { const s = window.$bodyScope; const r = s.eagle.filter.filterRules.type.includes; return Object.values(r).filter(Boolean).length; })()`);
  await show('item.active', `(document.getElementById('types-filter-item')||{className:''}).className.includes('active')`);
  await show('breadcrumb', `Array.from(document.querySelectorAll('#eagle-toolbar-host .breadcrumbs li')).map(li=>li.textContent.trim())`);
  await show('filterBadge', `window.$bodyScope.eagle.filter.filterBadge`);
  await show('filterCounts.type', `JSON.stringify((window.eagle && window.eagle.filter && window.eagle.filter.filterCounts && window.eagle.filter.filterCounts.type) || null)`);
  // 手动直调 filterContent 看是否能推动
  await show('manual filterContent', `(() => { try { const s = window.$bodyScope; s.$apply(() => { s.filterContent(); }); return 'called'; } catch(e){ return 'THROW '+String(e&&e.message).slice(0,200); } })()`);
  await delay(1500);
  await show('after manual: badge', `window.$bodyScope.eagle.filter.filterBadge`);
  await show('after manual: item.active', `(document.getElementById('types-filter-item')||{className:''}).className.includes('active')`);

  const dump = [];
  for (const e of page.events || []) {
    if (e.method === 'Runtime.exceptionThrown') {
      const d = e.params.exceptionDetails || {};
      dump.push('EXCEPTION: ' + String((d.exception && d.exception.description) || d.text || '').slice(0, 400));
    }
  }
  console.log('\n=== 异常 %d 条 ===', dump.length);
  const seen = new Set();
  for (const line of dump) { const k = line.slice(0, 90); if (seen.has(k)) continue; seen.add(k); console.log('---\n' + line); }
} finally {
  const guard = setTimeout(() => process.exit(0), 15000);
  try { await stop(stack); } catch (e) {}
  clearTimeout(guard);
  process.exit(0);
}
