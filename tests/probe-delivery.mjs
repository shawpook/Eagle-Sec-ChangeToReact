/**
 * 临时探针：诊断 detail-delivery 门控未释放。
 * 检查：scope.enterDetailMode 现在是谁（shims wrapper / machinery / bundle 原版）、
 * 门控状态字段、canvas/img 释放条件。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-probe-delivery-'));
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
      await post('/api/library/create', { name: 'Probe Delivery', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 640, height: 400, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      const tmp1 = path.join(librariesRoot, 'probe-a.png');
      fs.writeFileSync(tmp1, png);
      await post('/api/item/addFromPath', { paths: [tmp1] });
    },
  });
  const { page } = stack;

  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', { expression: `document.readyState`, returnByValue: true });
    return r.result.value === 'complete';
  }, 'main window ready', 30000);
  await waitFor(async () => (await evalNow(page, `!!document.getElementById('main-app')`)), 'Angular main-app', 45000);
  await waitFor(async () => (await evalNow(page, `!!document.querySelector('#box-list .box')`)), 'grid boxes', 45000);

  // ── 进入详情前的静态检查 ──
  console.log('PRE enterDetailMode.src =', JSON.stringify((await evalNow(page,
    `window.$bodyScope && typeof $bodyScope.enterDetailMode === 'function' ? $bodyScope.enterDetailMode.toString().slice(0, 160) : 'MISSING'`))));
  console.log('PRE __eagleOriginalGate =', await evalNow(page, `String(window.$bodyScope && $bodyScope.enterDetailMode && $bodyScope.enterDetailMode.__eagleOriginalGate)`));
  console.log('PRE machinery.version =', await evalNow(page, `window.__eagleDataMachinery ? window.__eagleDataMachinery.version : 'none'`));

  // 复刻 stage5 时序：grid 渲染后先有 ~9s 间隔再进详情
  await delay(9000);
  console.log('ZOOMHELP =', JSON.stringify(await evalNow(page, `(() => {
    const w = window;
    return {
      helpers: typeof w.getImagePixelDensity + '/' + typeof w.isMobileResolution + '/' + typeof w.isMobileWidth,
      devicesMetrics: Array.isArray(w.devicesMetrics) ? w.devicesMetrics.length : String(w.devicesMetrics),
      zoomHelpersLoaded: Boolean(w.__eagleBundleGlobals && w.__eagleBundleGlobals.zoomHelpersLoaded),
      smartZoomIsMachinery: String(w.$bodyScope.smartZoom || '').includes('getImagePixelDensity'),
      lastZoomIsMachinery: String(w.$bodyScope.lastZoom || '').includes('lastZoomMode'),
      lastItemStates: w.$bodyScope.lastItemStates ? Object.keys(w.$bodyScope.lastItemStates).length : 'MISSING',
      lastZoomMode: String(w.$bodyScope.lastZoomMode),
      defaultRatio: w.$bodyScope.$root && w.$bodyScope.$root.preferences ? String(w.$bodyScope.$root.preferences.habits.defaultRatio) : 'NO-PREF',
    };
  })()`)));
  await evalNow(page, `window.__errLog = []; window.addEventListener('error', (e) => { window.__errLog.push(String(e.message).slice(0, 200)); });`);
  console.log('ENTER result =', JSON.stringify(await evalNow(page, `(() => {
    try {
      (() => {
        window.$bodyScope.selected = [window.$bodyScope.allData[0]];
        window.$bodyScope.enterDetailMode(null, window.$bodyScope.allData[0]);
      })();
      return 'OK';
    }
    catch (e) { return 'THROW: ' + (e && e.message) + ' | ' + String(e && e.stack).slice(0, 300); }
  })()`)));
  await delay(4000);

  console.log('POST enterDetailMode.src =', JSON.stringify((await evalNow(page,
    `$bodyScope.enterDetailMode.toString().slice(0, 160)`))));
  console.log('POST __eagleOriginalGate =', await evalNow(page, `String($bodyScope.enterDetailMode.__eagleOriginalGate)`));
  console.log('POST deliveryState =', JSON.stringify(await evalNow(page, `JSON.stringify(window.__eagleDetailDeliveryState)`)));
  console.log('POST errLog =', JSON.stringify(await evalNow(page, `JSON.stringify((window.__errLog || []).slice(0, 8))`)));
  console.log('POST bodyClass =', JSON.stringify(await evalNow(page, `document.body.className`)));
  console.log('POST isDetailMode =', await evalNow(page, `String($bodyScope.isDetailMode)`));
  console.log('POST currentId =', JSON.stringify(await evalNow(page, `JSON.stringify($bodyScope.current && $bodyScope.current.id)`)));
  console.log('POST itemIdMatch =', await evalNow(page, `JSON.stringify(window.__eagleDetailDeliveryState.itemId === ($bodyScope.current && $bodyScope.current.id))`));

  // canvas / img 释放条件逐项
  console.log('POST canvas =', JSON.stringify(await evalNow(page, `(() => {
    const c = document.querySelector('#bitmap-viewer canvas');
    if (!c) return 'NO-CANVAS';
    let px = 0;
    try { px = c.getContext('2d').getImageData(1, 1, 1, 1).data[3]; } catch (e) { return 'CTX-ERR'; }
    return c.width + 'x' + c.height + ' alpha(1,1)=' + px;
  })()`)));
  console.log('POST img =', JSON.stringify(await evalNow(page, `(() => {
    const i = document.querySelector('#detail-image');
    if (!i) return 'NO-IMG';
    return 'complete=' + i.complete + ' nw=' + i.naturalWidth + ' src=' + String(i.currentSrc || i.src || '').slice(0, 120);
  })()`)));
  console.log('POST rawUrl =', JSON.stringify(await evalNow(page,
    `typeof $bodyScope.getRawUrl === 'function' ? String($bodyScope.getRawUrl($bodyScope.current) || '').slice(0, 120) : 'NO-FN'`)));

  // b1-9d 追加：链条上游静态量（URL_MODULE / imagesDir / smoothZoom vendor / 容器结构）
  console.log('POST upstream =', JSON.stringify(await evalNow(page, `JSON.stringify({
    urlModuleGlobal: typeof window.URL_MODULE,
    urlModuleRequire: (function () { try { return typeof window.require('url').pathToFileURL; } catch (e) { return 'THROW ' + e.message; } })(),
    appRoot: String(window.appRoot && (window.appRoot.path || window.appRoot) || ''),
    imagesDir: String($bodyScope.imagesDir || ''),
    libraryImagesPath: String($bodyScope.libraryImagesPath || ''),
    rawPath: (function () { try { return String(window.FileUrlHelper && window.FileUrlHelper.getRawPath ? window.FileUrlHelper.getRawPath($bodyScope.current) : 'NO-HELPER'); } catch (e) { return 'THROW ' + e.message; } })(),
    smoothZoomFn: typeof (window.$ && window.$.fn && window.$.fn.smoothZoom),
    detailContainer: (function () { const c = document.querySelector('#detail-container'); return c ? { childCount: c.childElementCount, html: c.innerHTML.slice(0, 200) } : 'NONE'; })(),
    bitmapViewer: document.querySelector('#bitmap-viewer') ? 'PRESENT' : 'NONE',
    initDetailMode: String($bodyScope.initDetailMode),
    smoothZoomDone: String($bodyScope.smoothZoomDone),
    showDetailImage: String($bodyScope.showDetailImage),
    currentExt: String($bodyScope.current && $bodyScope.current.ext),
  })`)));

  // 等到超时路径（15s）后再看一次
  await delay(13000);
  console.log('LATE deliveryState =', JSON.stringify(await evalNow(page, `JSON.stringify(window.__eagleDetailDeliveryState)`)));
  console.log('LATE bodyClass =', JSON.stringify(await evalNow(page, `document.body.className`)));

  // worker 探针是否装上、瓦片是否有记录
  console.log('LATE workerProbe =', await evalNow(page, `String(window.__eagleDetailWorkerProbeInstalled)`));
  console.log('LATE tilesPrepared =', await evalNow(page, `JSON.stringify(window.__eagleDetailDeliveryState.tilesPrepared)`));
} catch (err) {
  console.log('PROBE_ERROR', err && err.message);
} finally {
  await stop(stack).catch(() => {});
}
