/**
 * 临时探针：复现 main-ui-workflow 的 markdown meta 阶段，dump box HTML 与 listMetaType。
 * 不提交。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-probe-md-'));
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
  const p = ${JSON.stringify(filePath)};
  try {
    window.onDropContainer({
      preventDefault: function () {}, stopPropagation: function () {},
      dataTransfer: { files: [{ path: p, name: ${JSON.stringify(name)}, type: ${JSON.stringify(type)}, size: 1, lastModified: Date.now() }], getData: function () { return ''; } },
    });
    return 'called';
  } catch (err) { return 'THROW: ' + String(err && err.stack ? err.stack : err).slice(0, 900); }
})()`);

let stack;
try {
  stack = await bootStack({
    librariesRoot,
    stateFile,
    userDataDir,
    beforeElectron: async (apiPort) => {
      const post = async (route, body) => {
        const response = await fetch(`http://127.0.0.1:${apiPort}${route}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') throw new Error(`${route} failed: ${JSON.stringify(payload)}`);
        return payload.data;
      };
      await post('/api/library/create', { name: 'Probe Md', savePath: librariesRoot });
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
        try { window.__cerr.push([].slice.call(arguments).map(function (a) { return String(a && a.stack ? a.stack : a); }).join(' | ').slice(0, 400)); } catch (e) {}
        try { oe.apply(null, arguments); } catch (e) {}
      };
    })();
  ` });

  await waitFor(async () => (await evalNow(page, `document.readyState`)) === 'complete');
  await page.send('Page.reload', { ignoreCache: false });
  await new Promise((r) => setTimeout(r, 500));
  await waitFor(async () => (await evalNow(page, `document.readyState`)) === 'complete');
  await waitFor(async () => (await evalNow(page, `!!(window.$bodyScope && window.$bodyScope.listDone)`)) === true, 'listDone', 40000)
    .catch((err) => console.log('WAIT listDone FAILED:', String(err.message).slice(0, 120)));

  console.log('MD_DROP', await drop(page, mdSource, 'Dropped Markdown.md', 'text/markdown'));
  await waitFor(async () => (await evalNow(page, `!!(window.$bodyScope.raw || []).find(function (e) { return e.name === 'Dropped Markdown'; })`)) === true, 'md import', 20000)
    .catch((err) => console.log('MD IMPORT FAILED:', String(err.message).slice(0, 120)));
  console.log('TXT_DROP', await drop(page, txtSource, 'Dropped Text.txt', 'text/plain'));
  await waitFor(async () => (await evalNow(page, `!!(window.$bodyScope.raw || []).find(function (e) { return e.name === 'Dropped Text'; })`)) === true, 'txt import', 20000)
    .catch((err) => console.log('TXT IMPORT FAILED:', String(err.message).slice(0, 120)));

  // 等缩略图（最多 20s）
  await waitFor(async () => (await evalNow(page, `!!(window.$bodyScope.raw || []).find(function (e) { return e.name === 'Dropped Markdown' && !e.thumbnailTask; })`)) === true, 'md thumbnail', 25000)
    .catch((err) => console.log('MD THUMBNAIL WAIT:', String(err.message).slice(0, 120)));

  await new Promise((r) => setTimeout(r, 2500));

  const dump = await evalNow(page, `JSON.stringify({
    listMetaType: window.$bodyScope && window.$bodyScope.listMetaType,
    wSpecial: typeof window.SPECIAL_TYPES,
    wSpecialMd: window.SPECIAL_TYPES ? !!window.SPECIAL_TYPES.md : null,
    rnl: typeof window.resetNgGridLayoutData,
    eg: typeof window.eg,
    ig: typeof window.ig,
    boxContainer: !!document.getElementById('box-container'),
    boxList: (function () { var el = document.querySelector('#box-container .box-list'); return el ? { w: el.clientWidth, h: el.clientHeight, children: el.childElementCount } : null; })(),
    allDataLen: window.$bodyScope && window.$bodyScope.allData ? window.$bodyScope.allData.length : -1,
    listDone: !!(window.$bodyScope && window.$bodyScope.listDone),
    viewMode: window.$bodyScope && window.$bodyScope.viewMode,
    boxCount: document.querySelectorAll('.box').length,
    items: (window.$bodyScope.raw || []).slice(0, 6).map(function (e) {
      var el = document.querySelector('#box-' + e.id + ' .metas');
      return {
        name: e.name, ext: e.ext, w: e.width, h: e.height, size: e.size,
        noPreview: !!e.noPreview, noThumbnail: !!e.noThumbnail, thumbnailTask: e.thumbnailTask || null,
        boxExists: !!document.getElementById('box-' + e.id),
        metasText: el ? el.textContent.trim() : null,
        metasHTML: el ? el.innerHTML.slice(0, 120) : null,
      };
    }),
    cerr: (window.__cerr || []).slice(0, 5),
  })`);
  console.log('MD_DUMP', dump);

  // 手动触发一次网格渲染，区分「未调用」与「渲染断链」
  const manual = await evalNow(page, `(function () {
    if (typeof window.resetNgGridLayoutData !== 'function') return 'no resetNgGridLayoutData';
    try { window.resetNgGridLayoutData(window.$bodyScope.allData, 0); } catch (err) { return 'THROW ' + String(err && err.stack ? err.stack : err).slice(0, 800); }
    return 'manual called';
  })()`);
  console.log('MD_MANUAL', manual);
  await new Promise((r) => setTimeout(r, 2500));
  console.log('MD_AFTER', await evalNow(page, `JSON.stringify({
    boxCount: document.querySelectorAll('.box').length,
    boxList: (function () { var el = document.querySelector('#box-container .box-list'); return el ? { w: el.clientWidth, children: el.childElementCount } : null; })(),
    ig: typeof window.ig,
    items: (window.$bodyScope.raw || []).slice(0, 4).map(function (e) {
      var el = document.querySelector('#box-' + e.id + ' .metas');
      return { name: e.name, ext: e.ext, boxExists: !!document.getElementById('box-' + e.id), metasText: el ? el.textContent.trim() : null };
    }),
  })`));
} finally {
  await stop(stack);
}
