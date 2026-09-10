/**
 * 临时探针：定位 shim 世界网格为空（allData=0 / boxCount=0）的根因。
 * 直接调用 rebindRefresh 并捕获其 async 异常。不提交。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-probe-grid-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });
const mdSource = path.join(tempRoot, 'Dropped Markdown.md');
fs.writeFileSync(mdSource, '# Dropped Markdown\n\nEagle reverse markdown drop audit\n', 'utf8');

const evalNow = async (page, expression) => {
  const r = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return r.result.value;
};

const snap = (page, tag) => evalNow(page, `JSON.stringify({
  tag: ${JSON.stringify(tag)},
  listDone: !!(window.$bodyScope && window.$bodyScope.listDone),
  isItemBindCalculated: !!(window.$bodyScope && window.$bodyScope.isItemBindCalculated),
  rawLen: window.$bodyScope && window.$bodyScope.raw ? window.$bodyScope.raw.length : -1,
  allLen: window.$bodyScope && window.$bodyScope.all ? window.$bodyScope.all.length : -1,
  allDataLen: window.$bodyScope && window.$bodyScope.allData ? window.$bodyScope.allData.length : -1,
  filteredsLen: window.$bodyScope && window.$bodyScope.filtereds ? window.$bodyScope.filtereds.length : -1,
  boxCount: document.querySelectorAll('.box').length,
})`);

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
      await post('/api/library/create', { name: 'Probe Grid', savePath: librariesRoot });
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
        try { window.__cerr.push([].slice.call(arguments).map(function (a) { return String(a && a.stack ? a.stack : a); }).join(' | ').slice(0, 500)); } catch (e) {}
        try { oe.apply(null, arguments); } catch (e) {}
      };
    })();
    window.addEventListener('unhandledrejection', function (e) {
      try { (window.__cerr = window.__cerr || []).push('UNHANDLED: ' + String(e.reason && e.reason.stack ? e.reason.stack : e.reason).slice(0, 900)); } catch (err) {}
    });
  ` });

  await waitFor(async () => (await evalNow(page, `document.readyState`)) === 'complete');
  await page.send('Page.reload', { ignoreCache: false });
  await new Promise((r) => setTimeout(r, 500));
  await waitFor(async () => (await evalNow(page, `document.readyState`)) === 'complete');
  await waitFor(async () => (await evalNow(page, `!!(window.$bodyScope && window.$bodyScope.listDone)`)) === true, 'listDone', 40000)
    .catch((err) => console.log('WAIT listDone FAILED:', String(err.message).slice(0, 120)));

  console.log('GRID_BEFORE_DROP', await snap(page, 'before-drop'));

  // 直接触发一次 rebindRefresh，捕获 async 异常
  await evalNow(page, `(function () {
    window.__rrErr = null;
    try {
      const r = window.$bodyScope.rebindRefresh();
      if (r && typeof r.then === 'function') r.catch(function (e) { window.__rrErr = String(e && e.stack ? e.stack : e).slice(0, 1200); });
    } catch (e) { window.__rrErr = 'SYNC ' + String(e && e.stack ? e.stack : e).slice(0, 1200); }
    return 1;
  })()`);
  await new Promise((r) => setTimeout(r, 3000));
  console.log('GRID_AFTER_RR', await snap(page, 'after-rr'));
  console.log('GRID_RR_ERR', await evalNow(page, `JSON.stringify(window.__rrErr)`));

  // 再 drop 一个 md，看导入后是否有变化
  console.log('GRID_DROP', await evalNow(page, `(function () {
    try {
      window.onDropContainer({
        preventDefault: function () {}, stopPropagation: function () {},
        dataTransfer: { files: [{ path: ${JSON.stringify(mdSource)}, name: 'Dropped Markdown.md', type: 'text/markdown', size: 1, lastModified: Date.now() }], getData: function () { return ''; } },
      });
      return 'called';
    } catch (err) { return 'THROW: ' + String(err && err.stack ? err.stack : err).slice(0, 900); }
  })()`));
  await waitFor(async () => (await evalNow(page, `!!(window.$bodyScope.raw || []).find(function (e) { return e.name === 'Dropped Markdown'; })`)) === true, 'md import', 25000)
    .catch((err) => console.log('MD IMPORT FAILED:', String(err.message).slice(0, 120)));
  await new Promise((r) => setTimeout(r, 3000));
  console.log('GRID_AFTER_DROP', await snap(page, 'after-drop'));

  // 再手动 rebindRefresh 一次
  await evalNow(page, `(function () {
    window.__rrErr2 = null;
    try {
      const r = window.$bodyScope.rebindRefresh();
      if (r && typeof r.then === 'function') r.catch(function (e) { window.__rrErr2 = String(e && e.stack ? e.stack : e).slice(0, 1200); });
    } catch (e) { window.__rrErr2 = 'SYNC ' + String(e && e.stack ? e.stack : e).slice(0, 1200); }
    return 1;
  })()`);
  await new Promise((r) => setTimeout(r, 3000));
  console.log('GRID_AFTER_DROP_RR', await snap(page, 'after-drop-rr'));
  console.log('GRID_RR_ERR2', await evalNow(page, `JSON.stringify(window.__rrErr2)`));
  console.log('GRID_CERR', await evalNow(page, `JSON.stringify((window.__cerr || []).slice(0, 8))`));
} finally {
  await stop(stack);
}
