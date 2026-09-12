/**
 * 临时探针（不提交）：详情交付链下一段——body 类 `is-detail-mode` 未跟随 scope.isDetailMode，
 * 导致详情面板无布局尺寸、BitmapViewer 只出 100x100 空画布。
 * 判定：① store 同步管线是否活着（改 isCropMode 看快照/类名跟不跟）② 进详情后快照/类名/
 * 各容器尺寸 ③ #bitmap-viewer 下的 canvas 清单。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-probe-bodysync-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });

const evalNow = async (page, expression) => {
  const r = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) return `EVAL_THROW ${String(r.exceptionDetails.exception && r.exceptionDetails.exception.description || '').slice(0, 300)}`;
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
      await post('/api/library/create', { name: 'Probe BodySync', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 640, height: 400, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      const tmp = path.join(librariesRoot, 'probe-a.png');
      fs.writeFileSync(tmp, png);
      await post('/api/item/addFromPath', { paths: [tmp] });
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
      window.addEventListener('error', function (e) { try { window.__cerr.push('ONERROR ' + String(e.message).slice(0, 300)); } catch (err) {} });
      window.addEventListener('unhandledrejection', function (e) { try { window.__cerr.push('REJECT ' + String(e.reason && e.reason.message || e.reason).slice(0, 300)); } catch (err) {} });
    })();
  ` });
  await waitFor(async () => (await evalNow(page, `document.readyState`)) === 'complete', 'ready', 30000);
  await page.send('Page.reload', { ignoreCache: false });
  await new Promise((r) => setTimeout(r, 600));
  await waitFor(async () => (await evalNow(page, `document.readyState`)) === 'complete', 'ready2', 30000);
  await waitFor(async () => (await evalNow(page, `!!document.querySelector('#box-list .box')`)), 'grid boxes', 45000);
  await delay(3000);

  console.log('SYNC_ALIVE_PRE', await evalNow(page, `JSON.stringify({
    shimScope: !!(window.$bodyScope && window.$bodyScope.__eagleShim),
    watchers: (window.$bodyScope && window.$bodyScope.$watchers || []).length,
    storeBound: typeof window.__eagleBodyState,
    angularType: typeof window.angular,
    scopeShimDiag: JSON.stringify(window.__eagleScopeShim || null).slice(0, 200),
    listStoreKeyword: window.__eagleListState ? String(window.__eagleListState.getState().keyword) : 'NO-LIST-STORE',
    snapIsCrop: window.__eagleBodyState ? JSON.stringify(Object.keys(window.__eagleBodyState.getState()).slice(0, 40)) : 'NO-STORE',
    snapIsDetail: window.__eagleBodyState ? String(window.__eagleBodyState.getState().isDetailMode) : 'NO-STORE',
    bodyClass: document.body.className,
  })`));

  // ① shim watcher 机制本身是否活着（自注册一个 watcher 看会不会回调）
  await evalNow(page, `window.__probeWatchFired = 0; window.__probeUnwatch = window.$bodyScope.$watch(
    function () { return window.$bodyScope.isCropMode; },
    function () { window.__probeWatchFired += 1; }
  );`);
  await evalNow(page, `window.$bodyScope.isCropMode = true;`);
  await delay(1200);
  console.log('SYNC_ALIVE_POST', await evalNow(page, `JSON.stringify({
    scopeIsCrop: !!window.$bodyScope.isCropMode,
    probeWatchFired: window.__probeWatchFired,
    snapIsCrop: String(window.__eagleBodyState.getState().isCropMode),
    bodyHasCrop: document.body.classList.contains('is-crop-mode'),
    shimActive: window.__eagleScopeShim ? String(window.__eagleScopeShim.active) : 'NO-DIAG',
  })`));
  // ①b 其它域的 scope→store 同步是否也死了（keyword 走 listState/appState）
  await evalNow(page, `window.$bodyScope.keyword = 'probe-kw'; `);
  await delay(1000);
  console.log('OTHER_SYNC', await evalNow(page, `JSON.stringify({
    scopeKeyword: String(window.$bodyScope.keyword),
    appStoreKeyword: window.__eagleReactStore ? String(window.__eagleReactStore.getState().keyword) : 'NO-APP-STORE',
    bodyStoreViewMode: String(window.__eagleBodyState.getState().viewMode),
  })`));
  await evalNow(page, `window.$bodyScope.keyword = '';`);

  // ② store → 组件订阅是否活着（直接 setState 看 body 类）
  await evalNow(page, `window.__eagleBodyState.setState({ isCropMode: true });`);
  await delay(600);
  console.log('STORE_DIRECT', await evalNow(page, `JSON.stringify({
    snapIsCrop: String(window.__eagleBodyState.getState().isCropMode),
    bodyHasCrop: document.body.classList.contains('is-crop-mode'),
  })`));
  await evalNow(page, `window.__eagleBodyState.setState({ isCropMode: false });`);
  await evalNow(page, `window.$bodyScope.isCropMode = false;`);
  await delay(600);

  console.log('ENTER', await evalNow(page, `(function () {
    try {
      window.$(function () {bodyScope
        window.$bodyScope.selected = [window.$bodyScope.allData[0]];
        window.$bodyScope.enterDetailMode(null, window.$bodyScope.allData[0]);
      })();
      return 'OK';
    } catch (e) { return 'THROW ' + String(e && e.stack || e).slice(0, 300); }
  })()`));
  await delay(6000);

  console.log('AFTER_ENTER', await evalNow(page, `JSON.stringify((function () {
    const rect = (sel) => { const el = document.querySelector(sel); if (!el) return 'NONE'; const r = el.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); };
    const canvases = Array.from(document.querySelectorAll('#bitmap-viewer canvas')).map((c) => c.width + 'x' + c.height + '/css' + Math.round(c.getBoundingClientRect().width) + 'x' + Math.round(c.getBoundingClientRect().height));
    return {
      scopeIsDetail: !!window.$bodyScope.isDetailMode,
      snapIsDetail: String(window.__eagleBodyState.getState().isDetailMode),
      bodyClass: document.body.className,
      watchers: (window.$bodyScope.$watchers || []).length,
      rects: {
        contentPanel: rect('.content-panel'),
        detailWrapperHost: rect('#eagle-detail-wrapper-host'),
        detailContainer: rect('#detail-container'),
        preloader: rect('.smooth_zoom_preloader'),
        bitmapViewer: rect('#bitmap-viewer'),
      },
      containerParent: (function () { const el = document.querySelector('#detail-container'); return el && el.parentElement ? el.parentElement.id + '.' + el.parentElement.className : 'NONE'; })(),
      canvases: canvases,
      delivery: window.__eagleDetailDeliveryState,
    };
  })())`));
  console.log('REACT_ALIVE', await evalNow(page, `JSON.stringify({
    reactHost: (function () { const el = document.querySelector('#eagle-react-host'); return el ? el.childElementCount : 'NONE'; })(),
    inspectorHost: (function () { const el = document.querySelector('#eagle-inspector-host'); return el ? el.childElementCount : 'NONE'; })(),
    toolbarHost: (function () { const el = document.querySelector('#eagle-toolbar-host'); return el ? el.childElementCount : 'NONE'; })(),
    detailWrapperHostChildren: (function () { const el = document.querySelector('#eagle-detail-wrapper-host'); return el ? el.childElementCount : 'NONE'; })(),
    dupModules: performance.getEntriesByType('resource').map(function (e) { return e.name; })
      .filter(function (n) { return /bodyState|scopeShim|scopeBridge|main\.tsx/.test(n); }),
  })`));
  console.log('CERR', await evalNow(page, `JSON.stringify((window.__cerr || []).slice(0, 12))`));
} finally {
  await stop(stack);
}
