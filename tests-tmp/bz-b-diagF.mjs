// B5 诊断：复现 stage-smoke 的 types filter 失败并抓运行时异常。
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bzdiagF-'));
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
    await post('/api/library/create', { name: 'DiagF', savePath: path.join(tmp, 'libraries') });
    const sharp = (await import('sharp')).default;
    const png = await sharp({ create: { width: 640, height: 400, channels: 4, background: '#38bdf8' } }).png().toBuffer();
    const a = path.join(tmp, 'a.png');
    const b = path.join(tmp, 'b.png');
    fs.writeFileSync(a, png); fs.writeFileSync(b, png);
    await post('/api/item/addFromPath', { paths: [a] });
    await post('/api/item/addFromPath', { paths: [b] });
  },
});
const page = stack.page;
const ev = (e) => page.send('Runtime.evaluate', { expression: e, returnByValue: true });
const show = async (label, expr) => {
  const r = await ev(expr);
  console.log('%-32s => %s', label, JSON.stringify(r.result && r.result.value));
};

try {
  await waitFor(async () => (await ev(`document.readyState`)).result.value === 'complete', 'ready', 30000);
  await waitFor(async () => (await ev(`!!document.getElementById('main-app')`)).result.value, 'main-app', 45000);
  await waitFor(async () =>
    (await ev(`document.querySelectorAll('#eagle-filter-toolbar-host .filter-item').length >= 17`)).result.value,
    '17 items', 45000);

  // 打开面板
  await ev(`(() => {
    const btns = Array.from(document.querySelectorAll('#eagle-toolbar-host .right .ic-btn.filter-btn'));
    const b = btns.find((x) => x.querySelector('img[src*="ic-toolbar-filter.svg"]'));
    b && b.click(); return true;
  })()`);
  await delay(1500);
  await show('panel visible', `(() => { const h=document.getElementById('eagle-filter-toolbar-host');
    return getComputedStyle(h).display !== 'none' && Array.from(h.querySelectorAll('.filter-item')).some(e=>e.offsetParent!==null); })()`);

  const r1 = await ev(`(() => {
    try {
      const item = document.getElementById('types-filter-item');
      if (!item) return 'no item';
      const n = item.querySelector('.name');
      if (!n) return 'no .name';
      n.click();
      return 'clicked';
    } catch (e) { return 'THROW ' + String(e && (e.stack || e.message)); }
  })()`);
  console.log('click =>', JSON.stringify(r1.result && r1.result.value));
  await delay(2500);

  await show('allData.length', `window.$bodyScope.allData.length`);
  await show('images.length', `window.$bodyScope.images.length`);
  await show('filtereds.length', `(() => { const s = window.$bodyScope; return s.filtereds ? s.filtereds.length : -1; })()`);
  // 手动触发一次 rebindRefresh，判别是「触发链没跑」还是「函数本身坏」
  const rr = await ev(`(() => {
    try { const s = window.$bodyScope; s.$apply(() => { s.rebindRefresh(); }); return 'called'; }
    catch (e) { return 'THROW ' + String(e && (e.stack || e.message)).slice(0, 300); }
  })()`);
  console.log('manual rebindRefresh =>', JSON.stringify(rr.result && rr.result.value));
  await delay(2500);
  await show('allData after rebind', `window.$bodyScope.allData.length`);

  await show('filterCounts keys', `JSON.stringify(Object.keys((window.eagle && window.eagle.filter && window.eagle.filter.filterCounts) || {}))`);
  await show('filterCounts.type', `JSON.stringify((window.eagle && window.eagle.filter && window.eagle.filter.filterCounts && window.eagle.filter.filterCounts.type) || null)`);
  await show('filteredsCount', `(() => { const s=window.$bodyScope; return s ? s.filteredsCount : -1; })()`);
  await show('snapshot.counts.type', `JSON.stringify((window.__eagleFilterState && window.__eagleFilterState.getState ? window.__eagleFilterState.getState().counts : null) || null)`);
  await show('types .open', `!!(document.getElementById('types-filter-item')||{classList:{contains:()=>false}}).classList.contains('open')`);
  await show('openCount', `document.querySelectorAll('[filter-item].open').length`);
  await show('check-items', `document.querySelectorAll('#types-filter-item .check-item').length`);
  await show('types innerHTML len', `(() => { const i=document.getElementById('types-filter-item'); return i ? i.innerHTML.length : -1; })()`);

  const dump = [];
  for (const e of page.events || []) {
    if (e.method === 'Runtime.exceptionThrown') {
      const d = e.params.exceptionDetails || {};
      dump.push('EXCEPTION: ' + String((d.exception && d.exception.description) || d.text || '').slice(0, 700));
    } else if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') {
      dump.push('CONSOLE.ERROR: ' + (e.params.args || []).map((a) => a.description || a.value || '').join(' ').slice(0, 500));
    }
  }
  console.log('\n=== 异常 %d 条 ===', dump.length);
  const seen = new Set();
  for (const line of dump) {
    const k = line.slice(0, 100);
    if (seen.has(k)) continue;
    seen.add(k);
    console.log('---\n' + line);
  }
} finally {
  await stop(stack);
}
