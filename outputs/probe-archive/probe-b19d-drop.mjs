/**
 * 临时探针：复现 main-ui-workflow 的 text file drop 阶段，抓 onDropContainer 的真实报错。
 * 不提交。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-probe-drop-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });
const textSource = path.join(tempRoot, 'Dropped Text.txt');
fs.writeFileSync(textSource, 'Eagle reverse text drop audit\n', 'utf8');

const evalNow = async (page, expression) => {
  const r = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return r.result.value;
};

let stack;
try {
  stack = await bootStack({
    librariesRoot,
    stateFile,
    userDataDir,
    beforeElectron: async (apiPort) => {
      const post = async (route, body) => {
        const response = await fetch(`http://127.0.0.1:${apiPort}${route}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') throw new Error(`${route} failed: ${JSON.stringify(payload)}`);
        return payload.data;
      };
      await post('/api/library/create', { name: 'Probe Drop', savePath: librariesRoot });
      await post('/api/folder/create', { name: 'wf' });
    },
  });
  const { page } = stack;

  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__injected = true;
    window.__cerr = [];
    (function () {
      const oe = console.error.bind(console);
      console.error = function () {
        try { window.__cerr.push([].slice.call(arguments).map(function (a) { return String(a && a.stack ? a.stack : a); }).join(' | ').slice(0, 700)); } catch (e) {}
        try { oe.apply(null, arguments); } catch (e) {}
      };
    })();
    (function patchLog() {
      if (window.electronLog && window.electronLog.error && !window.electronLog.__spied) {
        const orig = window.electronLog.error.bind(window.electronLog);
        window.electronLog.error = function () {
          try { window.__cerr.push('electronLog: ' + [].slice.call(arguments).map(function (a) { return String(a && a.stack ? a.stack : a); }).join(' | ').slice(0, 700)); } catch (e) {}
          try { orig.apply(null, arguments); } catch (e) {}
        };
        window.electronLog.__spied = true;
        return;
      }
      setTimeout(patchLog, 10);
    })();
  ` });

  await waitFor(async () => (await evalNow(page, `document.readyState`)) === 'complete');
  await page.send('Page.reload', { ignoreCache: false });
  await new Promise((r) => setTimeout(r, 500));
  await waitFor(async () => (await evalNow(page, `document.readyState`)) === 'complete');

  // 等 listDone（空库路径已验证可置位）
  await waitFor(async () => {
    const v = await evalNow(page, `!!(window.$bodyScope && window.$bodyScope.listDone)`);
    return v === true;
  }, 'listDone', 40000).catch((err) => console.log('WAIT listDone FAILED:', String(err.message).slice(0, 120)));

  const pre = await evalNow(page, `JSON.stringify({
    injected: !!window.__injected,
    listDone: !!(window.$bodyScope && window.$bodyScope.listDone),
    wDrop: typeof window.onDropContainer,
    sDrop: typeof (window.$bodyScope && window.$bodyScope.onDropContainer),
    deps: {
      fs: typeof window.fs, getExt: typeof window.getExt, EagleConfig: typeof window.EagleConfig,
      IS_HIDDEN_FILE: typeof window.IS_HIDDEN_FILE, IS_DIRECTORY: typeof window.IS_DIRECTORY,
      walk: typeof window.walk, sortByAZ: typeof window.sortByAZ, is: typeof window.is,
      uploadFiles: typeof (window.$bodyScope && window.$bodyScope.uploadFiles),
      showUploadQueue: typeof (window.$bodyScope && window.$bodyScope.showUploadQueue),
      electronLog: typeof window.electronLog, i18n: typeof window.i18n, swal: typeof window.swal,
      jQuery: typeof window.jQuery, dragging: typeof window.dragging,
      require: typeof window.require,
    },
    probes: (function () {
      const w = window;
      const out = {};
      out.reqIsNative = /native code/.test(String(w.require));
      try { out.reqPath = typeof w.require('path'); out.reqPathKeys = w.require('path') ? Object.keys(w.require('path')).slice(0, 8) : null; } catch (e) { out.reqPath = 'THROW ' + e.message; }
      try { out.reqFs = typeof w.require('fs'); out.fsHasExistsSync = !!(w.fs && w.fs.existsSync); } catch (e) { out.reqFs = 'THROW ' + e.message; }
      out.wPath = typeof w.path;
      try { out.getExtCall = String(w.getExt({ path: 'C:/tmp/a.txt' })); } catch (e) { out.getExtCall = 'THROW ' + String(e && e.message).slice(0, 200); }
      out.getExtName = String(w.getExt && w.getExt.name);
      out.getExtSrc = String(w.getExt).slice(0, 220);
      try { out.IS_HIDDEN_FILE_check = String(w.IS_HIDDEN_FILE.check('C:/tmp/a.txt')); } catch (e) { out.IS_HIDDEN_FILE_check = 'THROW ' + String(e && e.message).slice(0, 160); }
      try { out.sortByAZCall = (function () { const a = [{ name: 'b' }, { name: 'a' }]; w.sortByAZ(a); return a.map((x) => x.name).join(','); })(); } catch (e) { out.sortByAZCall = 'THROW ' + String(e && e.message).slice(0, 160); }
      return out;
    })(),
  })`);
  console.log('DROP_PRE', pre);

  const callExpr = `(function () {
    const path = ${JSON.stringify(textSource)};
    const w = window;
    // 给 getExt 打桩：记录每次调用的实参 + 抛错时的完整堆栈
    w.__getExtLog = [];
    if (typeof w.getExt === 'function' && !w.getExt.__spied) {
      const orig = w.getExt;
      const spy = function (f) {
        const rec = { args: null, ret: null, err: null };
        try { rec.args = JSON.stringify(f && { path: f.path, name: f.name, type: f.type }); } catch (e) { rec.args = 'UNSERIALIZABLE'; }
        let thrown = null;
        try { rec.ret = String(orig.apply(this, arguments)); }
        catch (e) { rec.err = String(e && e.stack ? e.stack : e); thrown = e; }
        w.__getExtLog.push(rec);
        if (thrown) throw thrown;
        return rec.ret;
      };
      spy.__spied = true;
      spy.__orig = orig;
      w.getExt = spy;
    }
    w.__reqLog = [];
    if (typeof w.require === 'function' && !w.require.__spied) {
      const oreq = w.require;
      const rspy = function (n) {
        let r;
        try { r = oreq.apply(this, arguments); } catch (e) { w.__reqLog.push({ n: String(n), err: String(e && e.message) }); throw e; }
        w.__reqLog.push({ n: String(n), t: typeof r, keys: r && typeof r === 'object' ? Object.keys(r).slice(0, 6) : null });
        return r;
      };
      rspy.__spied = true;
      w.require = rspy;
    }
    window.onerror = function (m, s, l, c, err) { window.__onerr = String(m) + ' @@ ' + String(err && err.stack); };
    try {
      if (typeof window.onDropContainer !== 'function') return 'MISSING window.onDropContainer';
      window.onDropContainer({
        preventDefault: function () {},
        stopPropagation: function () {},
        dataTransfer: {
          files: [{ path: path, name: 'Dropped Text.txt', type: 'text/plain', size: 1, lastModified: Date.now() }],
          getData: function () { return ''; },
        },
      });
      return JSON.stringify({ ok: 'called', getExtLog: w.__getExtLog.slice(0, 12), reqLog: w.__reqLog.slice(0, 24), onerr: window.__onerr || null });
    } catch (err) {
      return JSON.stringify({ thr: String(err && err.stack ? err.stack : err).slice(0, 2500), ctor: String(err && err.constructor && err.constructor.name), getExtLog: w.__getExtLog.slice(0, 12), reqLog: w.__reqLog.slice(0, 24), onerr: window.__onerr || null });
    }
  })()`;
  console.log('DROP_CALL', await evalNow(page, callExpr));

  await new Promise((r) => setTimeout(r, 6000));
  const post = await evalNow(page, `JSON.stringify({
    rawLen: window.$bodyScope && window.$bodyScope.raw ? window.$bodyScope.raw.length : -1,
    found: !!(window.$bodyScope && window.$bodyScope.raw && window.$bodyScope.raw.find(function (e) { return e.name === 'Dropped Text'; })),
    uploadQueueLen: window.$bodyScope && window.$bodyScope.uploadQueue ? window.$bodyScope.uploadQueue.length : -1,
    cerr: (window.__cerr || []).slice(0, 6),
  })`);
  console.log('DROP_POST', post);
} finally {
  await stop(stack);
}
