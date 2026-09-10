// B8 诊断：复现 stage5 的 detail-delivery-released 并拆解门控状态。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'b8diag-'));
const stack = await bootStack({
  librariesRoot: (fs.mkdirSync(path.join(tmp, 'libraries'), { recursive: true }), path.join(tmp, 'libraries')),
  stateFile: path.join(tmp, 'state.json'),
  userDataDir: path.join(tmp, 'ud'),
  beforeElectron: async (apiPort) => {
    const post = async (route, body) => {
      const r = await fetch(`http://127.0.0.1:${apiPort}${route}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      return (await r.json()).data;
    };
    await post('/api/library/create', { name: 'B8Diag', savePath: path.join(tmp, 'libraries') });
    const sharp = (await import('sharp')).default;
    const png = await sharp({ create: { width: 640, height: 400, channels: 4, background: '#38bdf8' } }).png().toBuffer();
    const a = path.join(tmp, 'a.png'); const b = path.join(tmp, 'b.png');
    fs.writeFileSync(a, png); fs.writeFileSync(b, png);
    await post('/api/item/addFromPath', { paths: [a] });
    await post('/api/item/addFromPath', { paths: [b] });
  },
});
const page = stack.page;
const ev = (e) => page.send('Runtime.evaluate', { expression: e, returnByValue: true });
const show = async (label, expr) => {
  const r = await ev(expr);
  if (r.exceptionDetails) { console.log('%-30s => THROW %s', label, String(r.exceptionDetails.exception && r.exceptionDetails.exception.description).slice(0, 160)); return; }
  console.log('%-30s => %s', label, JSON.stringify(r.result && r.result.value));
};
try {
  await waitFor(async () => (await ev('document.readyState')).result.value === 'complete', 'ready', 30000);
  await waitFor(async () => (await ev(`!!document.getElementById('main-app')`)).result.value, 'main-app', 45000);
  await waitFor(async () => (await ev(`Array.isArray(window.$bodyScope?.allData) && window.$bodyScope.allData.length >= 2`)).result.value, 'allData 2', 30000);

  await show('worker probe installed', `!!window.__eagleDetailWorkerProbeInstalled`);
  await show('enterDetailMode gate marker', `!!(window.$bodyScope.enterDetailMode && window.$bodyScope.enterDetailMode.__eagleOriginalGate)`);

  await ev(`window.$bodyScope.$apply(() => {
    window.$bodyScope.selected = [window.$bodyScope.allData[0]];
    window.$bodyScope.enterDetailMode(null, window.$bodyScope.allData[0]);
  })`);
  await delay(6000);

  await show('body class', `document.body.className`);
  await show('delivery state', `JSON.stringify(window.__eagleDetailDeliveryState)`);
  await show('current id', `window.$bodyScope.current && window.$bodyScope.current.id`);
  await show('bitmap-viewer exists', `!!document.getElementById('bitmap-viewer')`);
  await show('bitmap canvas count', `document.querySelectorAll('#bitmap-viewer canvas').length`);
  await show('bitmap canvas size', `(() => { const c = document.querySelector('#bitmap-viewer canvas'); return c ? (c.width + 'x' + c.height) : 'none'; })()`);
  await show('detail-img src len', `(() => { const i = document.getElementById('detail-image'); return i ? String(i.getAttribute('src') || '').length : -1; })()`);
  await show('snapshot rawUrl len', `(() => { const d = window.__eagleDetailState.getState(); return ((d.snapshot.rawUrl||'') + '|' + (d.snapshot.thumbnailUrl||'')).length; })()`);

  const dump = [];
  for (const e of page.events || []) {
    if (e.method === 'Runtime.exceptionThrown') {
      const d = e.params.exceptionDetails || {};
      dump.push('EXCEPTION: ' + String((d.exception && d.exception.description) || d.text || '').slice(0, 300));
    }
  }
  console.log('\n=== 异常 %d 条 ===', dump.length);
  const seen = new Set();
  for (const l of dump) { const k = l.slice(0, 80); if (seen.has(k)) continue; seen.add(k); console.log('---\n' + l); }
} finally {
  const guard = setTimeout(() => process.exit(0), 15000);
  try { await stop(stack); } catch (e) {}
  clearTimeout(guard);
  process.exit(0);
}
