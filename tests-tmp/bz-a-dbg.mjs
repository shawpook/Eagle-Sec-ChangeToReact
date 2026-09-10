/** bz-A 调试探针：boot + 抓异常/console（定位归位手术 boot 破口） */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bzdbg-'));
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
      await post('/api/library/create', { name: 'BzDbg Library', savePath: librariesRoot });
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
  await delay(15000);
  console.log('STEP delay-done');

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
      const parts = (e.params.args || []).map(a => (a.value !== undefined ? String(a.value) : (a.description || '')));
      console.log('CONSOLE-ERR:', parts.join(' ').slice(0, 300), '@', e.params.stackTrace && e.params.stackTrace.callFrames[0] && e.params.stackTrace.callFrames[0].url);
    }
  }
  const state = await page.send('Runtime.evaluate', {
    expression: `JSON.stringify({
      eagle: typeof window.eagle,
      eagleShim: typeof (window.$bodyScope && window.$bodyScope.__eagleShim),
      coreFns: typeof window.__eagleCoreFns,
      coreState: typeof window.__eagleCoreState,
      shimFnsBridge: JSON.stringify(window.__eagleShimFnsBridge || null),
      fnFace: ['colorFilter','grayColorFilter','searchFilter','rebindRefresh','select','clickNode',
               'calculateImageBinding','updateSidebarList','filterContent','openItemContextMenu',
               'cancelAllTasks','contentFocus','zoomFit','changeOrderBy'].map(k => k + '=' + typeof (window.$bodyScope || {})[k]).join(','),
      coreFnsKeys: window.__eagleCoreFns ? Object.keys(window.__eagleCoreFns).length : -1,
    })`, returnByValue: true,
  });
  console.log('STATE:', state.result.value);
} catch (err) {
  console.log('PROBE-FAIL:', err.message);
  const events = stack && stack.page && stack.page.events;
  if (events) {
    const errors = events.filter(e =>
      (e.method === 'Runtime.exceptionThrown') ||
      (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') ||
      (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error'));
    console.log('=== late exceptions/errors:', errors.length);
    for (const e of errors.slice(0, 10)) {
      if (e.method === 'Runtime.exceptionThrown') {
        const d = e.params.exceptionDetails;
        console.log('EXC:', (d.exception && (d.exception.description || d.exception.value)) || d.text, '@', d.url, ':', d.lineNumber);
      } else if (e.method === 'Log.entryAdded') {
        console.log('LOG-ERR:', e.params.entry.text, '@', e.params.entry.url);
      } else {
        const parts = (e.params.args || []).map(a => (a.value !== undefined ? String(a.value) : (a.description || '')));
        console.log('CONSOLE-ERR:', parts.join(' ').slice(0, 300));
      }
    }
  }
} finally {
  await stop(stack);
}
