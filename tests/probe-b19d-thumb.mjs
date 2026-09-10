/**
 * 临时探针：复现 m1 的 markdown thumbnail 阶段——观察 thumbnail-generated 事件为何
 * 只对 txt 触发、不对 md 触发。同时观察 refreshImportedThumbnails 的输入/快照字段。
 * 不提交。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-probe-thumb-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });
const mdSource = path.join(tempRoot, 'Dropped Markdown.md');
const txtSource = path.join(tempRoot, 'Dropped Text.txt');
fs.writeFileSync(mdSource, '# Dropped Markdown\n\nEagle reverse markdown drop audit\n', 'utf8');
fs.writeFileSync(txtSource, 'Eagle reverse text drop audit\n', 'utf8');

const evalNow = async (page, expression) => {
  const r = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return r.result.value;
};

const drop = async (page, filePath, name, type) => evalNow(page, `(function () {
  try {
    window.onDropContainer({
      preventDefault: function () {}, stopPropagation: function () {},
      dataTransfer: { files: [{ path: ${JSON.stringify(filePath)}, name: ${JSON.stringify(name)}, type: ${JSON.stringify(type)}, size: 1, lastModified: Date.now() }], getData: function () { return ''; } },
    });
    return 'called';
  } catch (err) { return 'THROW: ' + String(err && err.stack ? err.stack : err).slice(0, 900); }
})()`);

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
      await post('/api/library/create', { name: 'Probe Thumb', savePath: librariesRoot });
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
      console.error = function () { try { window.__cerr.push([].slice.call(arguments).map(String).join(' | ').slice(0, 400)); } catch (e) {} try { oe.apply(null, arguments); } catch (e) {} };
      const ow = console.warn.bind(console);
      console.warn = function () { try { window.__cerr.push('WARN ' + [].slice.call(arguments).map(String).join(' | ').slice(0, 400)); } catch (e) {} try { ow.apply(null, arguments); } catch (e) {} };
    })();
    window.addEventListener('load', function () {
      try {
        const ipc = window.require('electron').ipcRenderer;
        window.__tg = [];
        ipc.on('thumbnail-generated', function (e, item) { try { window.__tg.push({ id: item && item.id, name: item && item.name, ext: item && item.ext, w: item && item.width, h: item && item.height, proc: !!(item && item.processingThumbnail), task: item && item.thumbnailTask }); } catch (err) {} });
        window.__tgReady = true;
      } catch (err) { window.__tgErr = String(err && err.stack ? err.stack : err).slice(0, 400); }
    });
  ` });

  await waitFor(async () => (await evalNow(page, `document.readyState`)) === 'complete');
  await page.send('Page.reload', { ignoreCache: false });
  await new Promise((r) => setTimeout(r, 500));
  await waitFor(async () => (await evalNow(page, `document.readyState`)) === 'complete');
  await waitFor(async () => (await evalNow(page, `!!(window.$bodyScope && window.$bodyScope.listDone)`)) === true, 'listDone', 40000)
    .catch((err) => console.log('WAIT listDone FAILED:', String(err.message).slice(0, 120)));

  console.log('TH_TG_READY', await evalNow(page, `JSON.stringify({ ready: !!window.__tgReady, err: window.__tgErr || null, desktopApi: typeof window.eagleDesktop })`));

  console.log('TH_TXT_DROP', await drop(page, txtSource, 'Dropped Text.txt', 'text/plain'));
  await waitFor(async () => (await evalNow(page, `!!(window.$bodyScope.raw || []).find(function (e) { return e.name === 'Dropped Text'; })`)) === true, 'txt import', 25000)
    .catch((err) => console.log('TXT IMPORT FAILED:', String(err.message).slice(0, 120)));
  await new Promise((r) => setTimeout(r, 4000));
  console.log('TH_AFTER_TXT', await evalNow(page, `JSON.stringify({ tg: window.__tg || [] })`));

  console.log('TH_MD_DROP', await drop(page, mdSource, 'Dropped Markdown.md', 'text/markdown'));
  await waitFor(async () => (await evalNow(page, `!!(window.$bodyScope.raw || []).find(function (e) { return e.name === 'Dropped Markdown'; })`)) === true, 'md import', 25000)
    .catch((err) => console.log('MD IMPORT FAILED:', String(err.message).slice(0, 120)));
  await new Promise((r) => setTimeout(r, 8000));

  console.log('TH_AFTER_MD', await evalNow(page, `JSON.stringify({ tg: window.__tg || [] })`));
  console.log('TH_SNAPSHOT', await evalNow(page, `(async function () {
    try {
      const lib = await window.eagleDesktop.library.current();
      const items = (lib && lib.items) || [];
      return JSON.stringify(items.slice(0, 6).map(function (e) {
        return { name: e.name, ext: e.ext, w: e.width, h: e.height, thumbnailTask: e.thumbnailTask, processingThumbnail: !!e.processingThumbnail, noThumbnail: !!e.noThumbnail, noPreview: !!e.noPreview };
      }));
    } catch (err) { return 'THROW ' + String(err && err.stack ? err.stack : err).slice(0, 600); }
  })()`));
  console.log('TH_CERR', await evalNow(page, `JSON.stringify((window.__cerr || []).slice(0, 10))`));
} finally {
  await stop(stack);
}
