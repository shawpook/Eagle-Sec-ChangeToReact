/** by-A 调试探针：boot + 抓异常/console + dump 状态面 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bydbg-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });

let stack;
try {
  console.log('STEP boot-start');
  stack = await bootStack({
    librariesRoot, stateFile, userDataDir,
    beforeElectron: async (apiPort) => {
      const post = async (route, body) => {
        const response = await fetch(`http://127.0.0.1:${apiPort}${route}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') throw new Error(`${route} failed: ${JSON.stringify(payload)}`);
        return payload.data;
      };
      await post('/api/library/create', { name: 'ByDbg Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      const tmp1 = path.join(librariesRoot, 'a.png');
      fs.writeFileSync(tmp1, png);
      await post('/api/item/addFromPaths', { paths: [tmp1] });
    },
  });
  console.log('STEP boot-done');
  const { page } = stack;
  const events = page.events;

  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', { expression: `document.readyState`, returnByValue: true });
    return r.result.value === 'complete';
  }, 'main window ready', 30000);
  console.log('STEP main-ready');
  await delay(20000);
  console.log('STEP delay-done');

  // 抓异常与错误 console
  const errors = events.filter(e =>
    (e.method === 'Runtime.exceptionThrown') ||
    (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') ||
    (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'));
  console.log('=== exceptions/errors:', errors.length);
  for (const e of errors.slice(0, 12)) {
    if (e.method === 'Runtime.exceptionThrown') {
      const d = e.params.exceptionDetails;
      console.log('EXC:', (d.exception && (d.exception.description || d.exception.value)) || d.text, '@', d.url, ':', d.lineNumber);
    } else if (e.method === 'Log.entryAdded') {
      console.log('LOG-ERR:', e.params.entry.text, '@', e.params.entry.url);
    } else {
      console.log('CONSOLE-ERR:', (e.params.args || []).map(a => a.value !== undefined ? a.value : (a.description || a.type)).join(' | '));
    }
  }

  const dump = async (label, expr) => {
    try {
      const r = await page.send('Runtime.evaluate', { expression: expr, returnByValue: true });
      console.log(label, JSON.stringify(r.result.value));
    } catch (err) { console.log(label, 'EVAL-ERR', err.message); }
  };
  console.log('STEP dump-start');
  // 实测链：模拟点击条目 → detail 快照应更新
  await dump('detailSync-manual:', `(() => { try { if (!window.__eagleDetailSync) return 'NO-FN'; const r = window.__eagleDetailSync(); const st = window.__eagleDetailState.getState(); return { ok: true, ready: st.snapshot ? st.snapshot.ready : 'FLAT-' + st.ready }; } catch (err) { return 'THROW: ' + (err && err.message); } })()`);
  await dump('toolbarSync-manual:', `(() => { try { if (!window.__eagleToolbarSync) return 'NO-FN'; window.__eagleToolbarSync(); const st = window.__eagleToolbarState.getState(); return 'ok-' + (st.snapshot ? st.snapshot.ready : 'flat'); } catch (err) { return 'THROW: ' + (err && err.message); } })()`);
  await dump('openItem:', `(() => { const s = window.$bodyScope; const img = (s.allData && s.allData[0]) || (s.raw && s.raw[0]); if (img) { s.openItem && s.openItem(img); } return !!img; })()`);
  await delay(1500);
  await dump('detailState:', `(() => { const s = window.__eagleDetailState && window.__eagleDetailState.getState(); return s ? { ready: s.snapshot && s.snapshot.ready, currentId: s.snapshot && s.snapshot.id, isDetailMode: s.snapshot && s.snapshot.isDetailMode, bodyIsDetail: window.__eagleBodyState.getState().isDetailMode } : 'NO'; })()`);
  await dump('scope-current:', `(() => { const s = window.$bodyScope; return { cur: s.current && s.current.id, isDetailMode: s.isDetailMode }; })()`);
  await dump('main-app:', `!!document.getElementById('main-app')`);
  await dump('boxes:', `document.querySelectorAll('#box-list .box').length`);
  await dump('listState:', `(() => { const s = window.__eagleListState && window.__eagleListState.getState(); return s ? { viewMode: s.viewMode, isLoading: s.isLoading, filteredsCount: s.filteredsCount, allDataCount: s.allDataCount, rawCount: s.rawCount, listDone: s.listDone, keyword: s.keyword } : 'NO-STORE'; })()`);
  await dump('bodyState:', `(() => { const s = window.__eagleBodyState && window.__eagleBodyState.getState(); return s ? { viewMode: s.viewMode, isLoading: s.isLoading, listDone: s.listDone, isDetailMode: s.isDetailMode } : 'NO-STORE'; })()`);
  await dump('scopeList:', `(() => { const s = window.$bodyScope; return s ? { raw: (s.raw||[]).length, allData: (s.allData||[]).length, filtereds: (s.filtereds||[]).length, viewMode: s.viewMode, isLoading: s.isLoading } : 'NO-SCOPE'; })()`);
} finally {
  await stop(stack);
}
