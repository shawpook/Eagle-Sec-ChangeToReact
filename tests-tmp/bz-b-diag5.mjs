// 复现 stage5 的 detail-toolbar-counter 场景，读出 counter 实际数值。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bzdiag5-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });

let stack;
try {
  stack = await bootStack({
    librariesRoot, stateFile, userDataDir,
    beforeElectron: async (apiPort) => {
      const post = async (route, body) => {
        const r = await fetch(`http://127.0.0.1:${apiPort}${route}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        return (await r.json()).data;
      };
      await post('/api/library/create', { name: 'Diag5', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 640, height: 400, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      const a = path.join(librariesRoot, 'a.png');
      const b = path.join(librariesRoot, 'b.png');
      fs.writeFileSync(a, png); fs.writeFileSync(b, png);
      await post('/api/item/addFromPath', { paths: [a] });
      await post('/api/item/addFromPath', { paths: [b] });
    },
  });
  const page = stack.page;
  const ev = (e) => page.send('Runtime.evaluate', { expression: e, returnByValue: true });
  const show = async (label, expr) => {
    const r = await ev(expr);
    console.log('%-30s => %s', label, JSON.stringify(r.result && r.result.value));
  };

  await waitFor(async () => (await ev(`document.readyState`)).result.value === 'complete', 'ready', 30000);
  await waitFor(async () => (await ev(`!!document.getElementById('main-app')`)).result.value, 'main-app', 45000);
  await waitFor(async () => (await ev(`!!document.querySelector('#box-list .box')`)).result.value, 'boxes', 45000);

  await show('allData.length', `window.$bodyScope.allData.length`);
  await show('images.length', `window.$bodyScope.images.length`);
  await ev(`window.$bodyScope.$apply(() => {
    window.$bodyScope.selected = [window.$bodyScope.allData[0]];
    window.$bodyScope.enterDetailMode(null, window.$bodyScope.allData[0]);
  })`);
  await delay(1500);
  await show('selected.length', `window.$bodyScope.selected.length`);
  await show('currentIndex()', `(() => { try { return window.$bodyScope.currentIndex(); } catch(e){ return 'ERR '+e.message; } })()`);
  await show('counter text', `(() => { const c = document.querySelector('#eagle-detail-host .breadcrumbs .counter'); return c ? c.textContent.trim() : 'NO ELEMENT'; })()`);
  await show('detail host exists', `!!document.getElementById('eagle-detail-host')`);
  await show('snapshot currentIndex', `(() => { const s = window.__eagleDetailState && window.__eagleDetailState.getState && window.__eagleDetailState.getState(); return s ? JSON.stringify({ci: s.currentIndex, adc: s.allDataCount}) : 'n/a'; })()`);
} finally {
  await stop(stack);
}
