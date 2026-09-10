/**
 * 临时探针（不提交）：判定 m1 `* drop import inserted duplicate item IDs` 的真源头。
 * 复刻 m1 前三段（text drop → 单文件 drop → 文件夹 drop，全部同一 PNG 拷贝 = md5 互为重复），
 * 记录：① mock 总线上 file-uploaded 的 emit 次数（__emits，含调用栈与当时监听器数）
 *       ② 独立探针监听器收到的次数（__fu；一次 emit → 一条，用于区分「双 emit」与「双注册」）
 *       ③ 每段结束后 raw 的重复 id（含 sameRef）与 duplicateQueue / 通知偏好分支值。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-probe-dup2-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
const folderSource = path.join(tempRoot, 'folder-source');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(folderSource, { recursive: true });
const fixture = path.join(process.cwd(), 'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png');
const textSource = path.join(tempRoot, 'Dropped Text.txt');
const fileSource = path.join(tempRoot, 'Dropped Main.png');
fs.writeFileSync(textSource, 'Eagle reverse text drop audit\n', 'utf8');
fs.copyFileSync(fixture, fileSource);
fs.copyFileSync(fixture, path.join(folderSource, 'Folder Item One.png'));
fs.copyFileSync(fixture, path.join(folderSource, 'Folder Item Two.png'));

const evalNow = async (page, expression) => {
  const r = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) return `EVAL_THROW ${JSON.stringify(r.exceptionDetails.exception && r.exceptionDetails.exception.description || '').slice(0, 400)}`;
  return r.result.value;
};

const drop = (page, sourcePath, name) => evalNow(page, `(function () {
  try {
    window.onDropContainer({
      preventDefault: function () {}, stopPropagation: function () {},
      dataTransfer: { files: [{ path: ${JSON.stringify(sourcePath)}, name: ${JSON.stringify(name)}, type: '', size: 1, lastModified: Date.now() }], getData: function () { return ''; } },
    });
    return 'called';
  } catch (err) { return 'THROW ' + String(err && err.stack ? err.stack : err).slice(0, 500); }
})()`);

const dump = (page, label) => evalNow(page, `JSON.stringify((function () {
  const s = window.$bodyScope || {};
  const raw = s.raw || [];
  const bus = window.$$electronIpc || window.__eagleIpc;
  const seen = {};
  raw.forEach(function (e, i) { if (e && e.id) (seen[e.id] = seen[e.id] || []).push(i); });
  const dupIds = Object.keys(seen).filter(function (k) { return seen[k].length > 1; });
  return {
    label: ${JSON.stringify(label)},
    rawNames: raw.map(function (e) { return e && e.name; }),
    dupIds: dupIds.map(function (k) { return { id: k, idx: seen[k], name: raw[seen[k][0]].name, sameRef: raw[seen[k][0]] === raw[seen[k][1]] }; }),
    emits: (window.__emits || []).map(function (e) { return e.ch + ':' + (e.name || e.id || '') + '@' + e.t + '/ln' + e.ln; }),
    fu: (window.__fu || []).map(function (e) { return (e.name || e.id) + '@' + e.t; }),
    listenerCount: bus && bus.listeners ? (bus.listeners.get('file-uploaded') || []).length : -1,
    duplicateQueueLen: (s.duplicateQueue || []).length,
    itemMappingsLen: Object.keys(s.itemMappings || {}).length,
  };
})())`);

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
      await post('/api/library/create', { name: 'Probe Dup2', savePath: librariesRoot });
      await post('/api/folder/create', { name: 'wf' });
    },
  });
  const { page } = stack;
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__emits = [];
    window.__fu = [];
    (function patch() {
      const bus = window.$$electronIpc || window.__eagleIpc;
      if (bus && typeof bus.emit === 'function' && !window.__emitPatched) {
        window.__emitPatched = true;
        const orig = bus.emit.bind(bus);
        bus.emit = function (ch) {
          const args = [].slice.call(arguments, 1);
          if (ch === 'file-uploaded' || ch === 'file-uploaded-end' || ch === 'import:operation-result') {
            try {
              window.__emits.push({
                ch: ch, id: args[0] && args[0].id, name: args[0] && args[0].name, t: Date.now(),
                ln: (bus.listeners.get('file-uploaded') || []).length,
                st: String(new Error().stack || '').split('\\n').slice(1, 6).join(' <- ').slice(0, 400),
              });
            } catch (e) {}
          }
          return orig.apply(null, arguments);
        };
        bus.on('file-uploaded', function (_e, img) {
          try { window.__fu.push({ id: img && img.id, name: img && img.name, t: Date.now() }); } catch (e) {}
        });
        return;
      }
      setTimeout(patch, 20);
    })();
  ` });

  await waitFor(async () => (await evalNow(page, `document.readyState`)) === 'complete');
  await page.send('Page.reload', { ignoreCache: false });
  await new Promise((r) => setTimeout(r, 500));
  await waitFor(async () => (await evalNow(page, `document.readyState`)) === 'complete');
  await waitFor(async () => (await evalNow(page, `!!(window.$bodyScope && window.$bodyScope.listDone)`)) === true, 'listDone', 40000)
    .catch((err) => console.log('WAIT listDone FAILED:', String(err.message).slice(0, 120)));
  console.log('PATCHED', await evalNow(page, `JSON.stringify({ emit: !!window.__emitPatched })`));
  console.log('PREFS', await evalNow(page, `JSON.stringify((window.$bodyScope.$root.preferences || {}).notification || null)`));

  console.log('DROP_TEXT', await drop(page, textSource, 'Dropped Text.txt'));
  await waitFor(async () => (await evalNow(page, `(window.$bodyScope.raw || []).some(function (e) { return e.name === 'Dropped Text'; })`)) === true, 'text import', 25000)
    .catch((err) => console.log('TEXT IMPORT FAILED:', String(err.message).slice(0, 160)));
  await new Promise((r) => setTimeout(r, 1500));
  console.log('DUMP_A', await dump(page, 'after-text'));

  console.log('DROP_FILE', await drop(page, fileSource, 'Dropped Main.png'));
  await waitFor(async () => (await evalNow(page, `(window.$bodyScope.raw || []).some(function (e) { return e.name === 'Dropped Main'; })`)) === true, 'file import', 25000)
    .catch((err) => console.log('FILE IMPORT FAILED:', String(err.message).slice(0, 160)));
  await new Promise((r) => setTimeout(r, 1500));
  console.log('DUMP_B', await dump(page, 'after-file'));

  console.log('DROP_FOLDER', await drop(page, folderSource, 'Dropped Folder'));
  await waitFor(async () => (await evalNow(page, `(window.$bodyScope.raw || []).some(function (e) { return String(e.name).indexOf('Folder Item') === 0; })`)) === true, 'folder import', 25000)
    .catch((err) => console.log('FOLDER IMPORT FAILED:', String(err.message).slice(0, 160)));
  await new Promise((r) => setTimeout(r, 2500));
  console.log('DUMP_C', await dump(page, 'after-folder'));
  console.log('EMIT_STACKS', await evalNow(page, `JSON.stringify((window.__emits || []).filter(function (e) { return e.ch === 'file-uploaded'; }).map(function (e) { return (e.name || e.id) + ' :: ' + e.st; }), null, 1)`));
} finally {
  await stop(stack);
}
