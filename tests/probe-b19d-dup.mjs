/**
 * 临时探针：定位 m1 `folder drop import inserted duplicate item IDs`。
 * 判断重复项是「同一对象被 unshift 两次」还是「两个不同对象同 id」。不提交。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-probe-dup-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
const folderSource = path.join(tempRoot, 'Dropped Folder');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(folderSource, { recursive: true });
const fixture = path.join(process.cwd(), 'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png');
fs.copyFileSync(fixture, path.join(folderSource, 'Folder Item One.png'));
fs.copyFileSync(fixture, path.join(folderSource, 'Folder Item Two.png'));

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
      await post('/api/library/create', { name: 'Probe Dup', savePath: librariesRoot });
      await post('/api/folder/create', { name: 'wf' });
    },
  });
  const { page } = stack;
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__cerr = [];
    (function () {
      const oe = console.error.bind(console);
      console.error = function () {
        try { window.__cerr.push([].slice.call(arguments).map(function (a) { return String(a && a.stack ? a.stack : a); }).join(' | ').slice(0, 600)); } catch (e) {}
        try { oe.apply(null, arguments); } catch (e) {}
      };
    })();
    // file-uploaded 触发计数（额外监听器，不影响业务）
    window.__fu = [];
    (function hook() {
      const s = window.$bodyScope;
      const ipc = (window.eagleDesktop && window.eagleDesktop.ipc) || window.$$electronIpc || window.__eagleIpc || (window.electron && window.electron.ipcRenderer);
      if (s && ipc && typeof ipc.on === 'function' && !window.__fuHooked) {
        window.__fuHooked = true;
        ipc.on('file-uploaded', function (_e, img) {
          try { window.__fu.push({ id: img && img.id, name: img && img.name, t: Date.now() }); } catch (err) {}
        });
        return;
      }
      setTimeout(hook, 50);
    })();
  ` });

  await waitFor(async () => (await evalNow(page, `document.readyState`)) === 'complete');
  await page.send('Page.reload', { ignoreCache: false });
  await new Promise((r) => setTimeout(r, 500));
  await waitFor(async () => (await evalNow(page, `document.readyState`)) === 'complete');
  await waitFor(async () => (await evalNow(page, `!!(window.$bodyScope && window.$bodyScope.listDone)`)) === true, 'listDone', 40000)
    .catch((err) => console.log('WAIT listDone FAILED:', String(err.message).slice(0, 120)));

  console.log('DUP_HOOKED', await evalNow(page, `JSON.stringify(!!window.__fuHooked)`));
  console.log('DUP_DROP', await evalNow(page, `(function () {
    try {
      window.onDropContainer({
        preventDefault: function () {}, stopPropagation: function () {},
        dataTransfer: { files: [{ path: ${JSON.stringify(folderSource)}, name: 'Dropped Folder' }], getData: function () { return ''; } },
      });
      return 'called';
    } catch (err) { return 'THROW ' + String(err && err.stack ? err.stack : err).slice(0, 700); }
  })()`));
  await waitFor(async () => (await evalNow(page, `!!(window.$bodyScope.raw || []).some(function (e) { return String(e.name).indexOf('Folder Item') === 0; })`)) === true, 'folder import', 25000)
    .catch((err) => console.log('FOLDER IMPORT FAILED:', String(err.message).slice(0, 120)));
  await new Promise((r) => setTimeout(r, 3000));

  console.log('DUP_DUMP', await evalNow(page, `JSON.stringify((function () {
    const raw = window.$bodyScope.raw || [];
    const seen = {};
    raw.forEach(function (e, i) { (seen[e.id] = seen[e.id] || []).push(i); });
    const dups = Object.keys(seen).filter(function (k) { return seen[k].length > 1; });
    return {
      rawLen: raw.length,
      dupIds: dups.map(function (k) { return { id: k, idx: seen[k], sameRef: raw[seen[k][0]] === raw[seen[k][1]], names: seen[k].map(function (i) { return raw[i].name; }) }; }),
      fuCount: (window.__fu || []).length,
      fu: (window.__fu || []).slice(0, 8),
      duplicateQueueLen: (window.$bodyScope.duplicateQueue || []).length,
      uploadQueueLen: (window.$bodyScope.uploadQueue || []).length,
      finishQueueLen: (window.$bodyScope.finishQueue || []).length,
      items: raw.map(function (e, i) { return i + ':' + e.name; }),
    };
  })())`));
  console.log('DUP_CERR', await evalNow(page, `JSON.stringify((window.__cerr || []).slice(0, 5))`));
} finally {
  await stop(stack);
}
