/**
 * 临时探针：定位 m1 `original inspector timeout` —— #eagle-inspector-host .inspector 不存在。
 * 不提交。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-probe-insp-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });

const evalNow = async (page, expression) => {
  const r = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return r.result.value;
};

let stack;
try {
  stack = await bootStack({
    librariesRoot, stateFile, userDataDir,
    beforeElectron: async (apiPort) => {
      const post = async (route, body) => {
        const response = await fetch(`http://127.0.0.1:${apiPort}${route}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') throw new Error(`${route} failed: ${JSON.stringify(payload)}`);
        return payload.data;
      };
      await post('/api/library/create', { name: 'Probe Insp', savePath: librariesRoot });
      await post('/api/folder/create', { name: 'wf' });
    },
  });
  const { page } = stack;
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__cerr = []; window.__werr = [];
    (function () {
      const oe = console.error.bind(console);
      console.error = function () {
        try { window.__cerr.push([].slice.call(arguments).map(function (a) { return String(a && a.stack ? a.stack : a); }).join(' | ').slice(0, 700)); } catch (e) {}
        try { oe.apply(null, arguments); } catch (e) {}
      };
      window.addEventListener('error', function (e) {
        try { window.__werr.push(String((e.error && e.error.stack) || e.message).slice(0, 700)); } catch (err) {}
      });
      window.addEventListener('unhandledrejection', function (e) {
        try { window.__werr.push('REJ ' + String((e.reason && e.reason.stack) || e.reason).slice(0, 700)); } catch (err) {}
      });
    })();
  ` });

  await waitFor(async () => (await evalNow(page, `document.readyState`)) === 'complete');
  await page.send('Page.reload', { ignoreCache: false });
  await new Promise((r) => setTimeout(r, 500));
  await waitFor(async () => (await evalNow(page, `document.readyState`)) === 'complete');
  await waitFor(async () => (await evalNow(page, `!!(window.$bodyScope && window.$bodyScope.listDone)`)) === true, 'listDone', 40000)
    .catch((err) => console.log('WAIT listDone FAILED:', String(err.message).slice(0, 120)));

  await new Promise((r) => setTimeout(r, 1500));
  const dump = await evalNow(page, `JSON.stringify({
    hostExists: !!document.getElementById('eagle-inspector-host'),
    hostChildren: document.getElementById('eagle-inspector-host') ? document.getElementById('eagle-inspector-host').childElementCount : -1,
    hostHTML: (document.getElementById('eagle-inspector-host') || {}).innerHTML ? document.getElementById('eagle-inspector-host').innerHTML.slice(0, 200) : null,
    inspectorEl: !!document.querySelector('#eagle-inspector-host .inspector'),
    actions: typeof window.__eagleInspectorActions,
    reactHostChildren: (function () { var h = document.getElementById('eagle-react-host'); return h ? h.childElementCount : -1; })(),
    reactErr: window.__reactErr || null,
    viewMode: window.$bodyScope && window.$bodyScope.viewMode,
    selectedLen: window.$bodyScope && window.$bodyScope.selected ? window.$bodyScope.selected.length : -1,
  })`);
  console.log('INSP_DUMP', dump);
  console.log('INSP_WERR', await evalNow(page, `JSON.stringify((window.__werr || []).slice(0, 8))`));
  console.log('INSP_CERR', await evalNow(page, `JSON.stringify((window.__cerr || []).slice(0, 8))`));
} finally {
  await stop(stack);
}
