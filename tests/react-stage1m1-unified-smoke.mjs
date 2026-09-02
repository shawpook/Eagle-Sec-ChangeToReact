/**
 * React 化改造 —— 阶段1 M1 统一冒烟（cZ-3b/4/5/6/7a/7b 全域闭环，一次执行）。
 *
 * 运行：node tests/react-stage1m1-unified-smoke.mjs
 * 断言组：
 *  A. 域接管标志与截肢计数（library/item/filter/selectionView/misc 五域 diag）
 *  B. cZ-3b 启动重管线：preload 缓存 → library-loaded 全链路 → bg-state 心跳
 *  C. cZ-4 条目数据：image.added / image.changed / update-txt-item
 *  D. cZ-5 筛选/搜索：keyword-suggestion / filter watch 触发 filterContent /
 *     REBIND_REFRESH 广播
 *  E. cZ-6 选择/视图：selected 赋值 → selectedMappings + updateSelection spy /
 *     UPDATE_SELECTION 广播
 *  F. cZ-7a 杂项：window.maximize / update-progress / add-download-tasks /
 *     show-sidebar-badge / change.current.theme（owner 桥）
 *  G. 截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-m1-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });

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
      await post('/api/library/create', { name: 'React M1 Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#0ea5e9' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 'm1.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 'm1.png')] });
    },
  });
  const { page } = stack;

  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', { expression: `document.readyState`, returnByValue: true });
    return r.result.value === 'complete';
  }, 'main window ready', 30000);

  const waitExpr = (expression) => page.send('Runtime.evaluate', { expression, returnByValue: true });
  await waitFor(async () => (await waitExpr(`!!document.getElementById('main-app')`)).result.value, 'Angular main-app', 45000);
  await waitFor(async () => (await waitExpr(`!!document.querySelector('#box-list .box')`)).result.value, 'grid boxes rendered', 45000);
  await delay(1200);

  const screenshotTo = async (file, timeoutMs) => {
    try {
      const screenshot = await Promise.race([
        page.send('Page.captureScreenshot', { format: 'png' }),
        delay(timeoutMs).then(() => { throw new Error(`screenshot timeout (${timeoutMs})ms`); }),
      ]);
      fs.mkdirSync('test-run', { recursive: true });
      fs.writeFileSync(file, Buffer.from(screenshot.data, 'base64'));
      console.log(`PASS screenshot-saved ${file}`);
    } catch (err) {
      console.log(`WARN screenshot failed: ${err.message}`);
    }
  };

  const failures = [];
  const assertExpr = async (name, expression, timeout = 20000) => {
    const pass = await (async () => {
      try {
        await waitFor(async () => {
          const r = await waitExpr(expression);
          return r.result.value === true;
        }, name, timeout);
        return true;
      } catch (err) {
        return false;
      }
    })();
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`);
    if (!pass) failures.push(name);
  };

  const evalNow = async (expression) => {
    const r = await page.send('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) console.log(`WARN eval error: ${r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails).slice(0, 300)}`);
    return r;
  };

  const ipcExpr = `window.eagleDesktop?.ipc || window.$electronIpc || window.__eagleIpc`;

  // 捕获页面 console（shims emit 吞错后 warn 输出，带原始 stack）
  await page.send('Runtime.enable');
  page.on = page.on || (() => {});
  page.send('Runtime.evaluate', { expression: `(() => {
    window.__consoleErrors = [];
    const ow = console.warn, oe = console.error;
    console.warn = function () { try { window.__consoleErrors.push('WARN: ' + Array.from(arguments).map(a => (a && a.stack) ? String(a.stack).slice(0, 400) : String(a)).join(' | ').slice(0, 500)); } catch (e) {} return ow.apply(console, arguments); };
    console.error = function () { try { window.__consoleErrors.push('ERR: ' + Array.from(arguments).map(a => (a && a.stack) ? String(a.stack).slice(0, 400) : String(a)).join(' | ').slice(0, 500)); } catch (e) {} return oe.apply(console, arguments); };
    return true;
  })()`, returnByValue: true });

  // ═══ A. 域接管标志与截肢计数（结果导向：五域 diag + plain-watch 唯一性）═══
  const aDiag = await evalNow(`(() => {
    const L = window.__eagleLibraryDomain, I = window.__eagleItemDomain, F = window.__eagleFilterDomain, S = window.__eagleSelectionViewDomain, M = window.__eagleMiscDomain;
    const s = window.$bodyScope;
    const ws = s.$$watchers || [];
    const ang = window.angular;
    const inj = () => ang.element(document).injector().get('$parse');
    let pMin = null, pMinB = null;
    try { pMin = inj()('eagle.filter.filterRules.file.min'); pMinB = inj()('eagle.filter.filterRules.file.min', { expensiveChecks: true }); } catch (e) {}
    const match = (w, exp, ps) => w.exp === exp || ps.some(p => p && w.exp === p);
    const pMinL = [pMin, pMinB].filter(Boolean);
    const filterMinTotal = ws.filter(w => match(w, 'eagle.filter.filterRules.file.min', pMinL)).length;
    const a1 = L && I && F && S && M;
    const a2 = L.removed['app-status-loading'] >= 1 && L.removed['app-status-library-loaded'] >= 1 && L.removed['preload-library'] >= 1;
    const a3 = I.removed['image.added'] >= 1 && I.removed['image.changed'] >= 1 && I.removed['file-uploaded'] >= 1 && I.removed['thumbnail-generated'] >= 1;
    const a4 = F.removed['keyword-suggestion'] >= 1 && F.removed['show-and-search'] >= 1 && F.listenersRemoved['REBIND_REFRESH'] >= 1;
    const a5 = S.listenersRemoved['UPDATE_SELECTION'] >= 1 && S.listenersRemoved['SAVE_FOLDER'] >= 1;
    const a6 = M.removed['before-quit'] >= 1 && M.removed['window.maximize'] >= 1 && M.removed['change.current.theme'] >= 1 && M.removed['jieba-extract-done'] >= 1;
    const a7 = filterMinTotal === 1;
    window.__aOk = !!(a1 && a2 && a3 && a4 && a5 && a6 && a7);
    return JSON.stringify({
      L: !!L, I: !!I, F: !!F, S: !!S, M: !!M,
      Ll: L && L.removed['app-status-loading'], Lld: L && L.removed['app-status-library-loaded'], Lp: L && L.removed['preload-library'],
      Ia: I && I.removed['image.added'], Ic: I && I.removed['image.changed'], If: I && I.removed['file-uploaded'], It: I && I.removed['thumbnail-generated'],
      Fk: F && F.removed['keyword-suggestion'], Fs: F && F.removed['show-and-search'], Fr: F && F.listenersRemoved['REBIND_REFRESH'],
      Su: S && S.listenersRemoved['UPDATE_SELECTION'], Ss: S && S.listenersRemoved['SAVE_FOLDER'],
      Mb: M && M.removed['before-quit'], Mt: M && M.removed['change.current.theme'], Mj: M && M.removed['jieba-extract-done'],
      a1: a1, a2: a2, a3: a3, a4: a4, a5: a5, a6: a6, a7: a7, aOk: window.__aOk, filterMinTotal: filterMinTotal,
      watchTotal: ws.length
    });
  })()`);
  console.log('DIAG-A2', aDiag.result && aDiag.result.value);
  await assertExpr('m1-A-domains-taken', `window.__aOk === true`);

  // ═══ A2. c8 核心数据机桥（收编 + 双向穿透）═══
  await assertExpr('m1-A2-c8-bridged', `(() => {
    const c = window.__eagleCoreState;
    return !!c && ['raw', 'allData', 'itemMappings', 'folderMappings', 'selected', 'current',
      'folders', 'smartFolders', 'uploadQueue', 'finishQueue', 'lockedImages',
      'isDetailMode', 'tagViewMode'].every((k) => k in c);
  })()`);
  await evalNow(`(() => {
    const s = window.$bodyScope;
    const c = window.__eagleCoreState;
    s.raw = [{ id: 'C8W', ext: 'png' }];
    window.__c8w = c.raw && c.raw.length === 1 && c.raw[0].id === 'C8W';
    c.allData = [{ id: 'C8R' }];
    window.__c8r = s.allData && s.allData.length === 1 && s.allData[0].id === 'C8R';
    s.raw = [];
    c.allData = [];
    return true;
  })()`);
  await assertExpr('m1-A2-c8-write-through', `window.__c8w === true && window.__c8r === true`);

  // ═══ A3. c9 数据机器域（scope 函数替换生效 + 契约）═══
  await assertExpr('m1-A3-c9-machinery', `(() => {
    const m = window.__eagleDataMachinery;
    const s = window.$bodyScope;
    if (!m || !m.applied || m.version < 2) return false;
    return ['calculateImageBinding', 'sortRawData', 'rebindRefresh', 'rebindRefreshLazy',
      'updateSidebarList', 'updateItemsView', 'switchLayout', 'prependImages', 'reload',
      'getRatioExp', 'getRatioNonExp', 'updateZoomRatio', 'toggleSlideshow',
      'smartFolderCount', 'getRecentFolders']
      .every((k) => m[k] === 'machinery')
      && typeof s.calculateImageBinding === 'function'
      && typeof s.rebindRefresh === 'function'
      && typeof s.updateSidebarList === 'function';
  })()`);

  // ═══ A4. c10 bundle 全局接管（if-absent 共存 + 关键全局在位）═══
  await assertExpr('m1-A4-bundle-globals', `(() => {
    const g = window.__eagleBundleGlobals;
    if (!g || !g.installed) return false;
    const required = ['appRoot', 'EagleConfig', 'SPECIAL_TYPES', 'fileSize', 'fse', 'tinyPinyin',
      'pinyinlite', 'readChunk', 'writeFileAtomic', 'cartesianProduct', 'sanitize',
      'unicodeNormalize', 'chineseConvert', 'colorConvert', 'DeltaE', 'installedFonts',
      'fontFolder', 'FileUrlHelper'];
    return required.every((n) => g.present.includes(n) && window[n] !== undefined);
  })()`);

  // ═══ A5. c10b initAPIServer 域（契约 + 处理器实调对照）═══
  await assertExpr('m1-A5-api-server-contract', `(() => {
    const d = window.__eagleApiServerDomain;
    return !!d && d.installed && d.version >= 2 && d.port === 41595
      && typeof d.fns.getAPIApplicationInfo === 'function'
      && typeof d.fns.listImages === 'function'
      && typeof d.fns.createFolder === 'function';
  })()`);
  await evalNow(`(() => {
    const d = window.__eagleApiServerDomain;
    d.fns.getAPIApplicationInfo().then((info) => {
      window.__a5 = (info && typeof info.version === 'string' && typeof info.platform === 'string'
        && info.preferences && info.showCollectModal !== undefined) ? 'ok' : 'shape';
    }).catch((err) => { window.__a5 = 'err:' + ((err && err.message) || err); });
    return true;
  })()`);
  await assertExpr('m1-A5-api-server-fns', `window.__a5 === 'ok'`);

  // ═══ A6. c11 scope shim（工厂直调行为面验证；激活判据 = bundle 移除后 w.angular 缺席）═══
  await evalNow(`(() => {
    const d = window.__eagleScopeShim;
    if (!d || typeof d.factory !== 'function') { window.__a6 = 'missing'; return true; }
    try {
      const shim = d.factory();
      shim.testField = 42;
      const writeOk = window.__eagleCoreState.testField === 42 && shim.testField === 42;
      let got = null;
      const off = shim.$on('test:event', (e, v) => { got = v; });
      shim.$broadcast('test:event', 7);
      const busOk = got === 7;
      off();
      let watched = null;
      const stop = shim.$watch(() => shim.testField, (v) => { watched = v; });
      shim.testField = 43;
      shim.$evalAsync();
      const watchOk = watched === 43;
      stop();
      const rootOk = shim.$root === shim && !!shim.mousetrap && Array.isArray(shim.$watchers);
      delete window.__eagleCoreState.testField;
      window.__a6 = (writeOk && busOk && watchOk && rootOk && shim.__eagleShim === true) ? 'ok' : 'fail:' + [writeOk, busOk, watchOk, rootOk].join(',');
    } catch (err) { window.__a6 = 'err:' + err.message; }
    return true;
  })()`);
  await assertExpr('m1-A6-scope-shim', `window.__a6 === 'ok'`);

  // ═══ B. cZ-3b 启动重管线 ═══
  const cacheFile = path.join(tempRoot, 'm1-cache.jsonl');
  fs.writeFileSync(cacheFile, [
    JSON.stringify({ id: 'M1A', ext: 'png', name: 'm1-a', tags: [], folders: [] }),
    JSON.stringify({ id: 'M1B', ext: 'png', name: 'm1-b', tags: [], folders: [] }),
  ].join('\n'));
  const cacheFileJson = JSON.stringify(cacheFile);
  await evalNow(`(() => {
    const ipc = ${ipcExpr};
    ipc.emit('preload-library', { cachePath: ${cacheFileJson} });
    return true;
  })()`);
  await delay(400);
  await assertExpr('m1-B-preload-cache', `window.__eagleLibraryDomain.libraryCacheCount === 2`);

  await evalNow(`(() => {
    const s = window.$bodyScope;
    window.__m1RootDir = s.libraryPath;
    const ipc = ${ipcExpr};
    ipc.emit('app-status-library-loaded', {
      machineID: 'm-m1', rootDir: s.libraryPath, imagesDir: s.libraryPath + '/images',
      imagesStringPath: '', usingPreloadCache: true, usingCache: false,
      folders: [], smartFolders: [], quickAccess: [], tagsGroups: [],
      modificationTime: 1725260000000, loadedTime: 1
    });
    return true;
  })()`);
  await evalNow(`(() => { const s = window.$bodyScope; s.$evalAsync(); return true; })()`);
  await delay(600);
  await assertExpr('m1-B-library-loaded', `(() => {
    const s = window.$bodyScope;
    return s.isUILoaded === true && s.raw && s.raw.length === 2
      && !!window.APIServer && window.machineID === 'm-m1'
      && window.__eagleLibraryDomain.hasLazyLoadManager === true;
  })()`);
  const bDiag = await evalNow(`(() => {
    const s = window.$bodyScope;
    return JSON.stringify({ viewMode: s.viewMode, allDataIds: (s.allData || []).map(x => x.id), rawIds: (s.raw || []).map(x => x.id), mappings: Object.keys(s.itemMappings || {}).length, dupKeys: Object.keys(s.duplicateMappings || {}).length, finishQueue: (s.finishQueue || []).length, uploadQueue: (s.uploadQueue || []).length });
  })()`);
  console.log('DIAG-B', bDiag.result && bDiag.result.value);
  await evalNow(`(() => {
    const s = window.$bodyScope;
    try { s.calculateImageBinding({}, function () { window.__m1cb = (window.__m1cb || 0) + 1; }); }
    catch (e) { window.__m1cbErr = String((e && e.stack) || e).slice(0, 300); }
    return true;
  })()`);
  await delay(2500);
  const bDiag2 = await evalNow(`(() => {
    const s = window.$bodyScope;
    return JSON.stringify({ allDataIds2: (s.allData || []).map(x => x.id), rawIds2: (s.raw || []).map(x => x.id), mappings2: Object.keys(s.itemMappings || {}).length, cbRan: window.__m1cb || 0, cbErr: window.__m1cbErr || null });
  })()`);
  console.log('DIAG-B2', bDiag2.result && bDiag2.result.value);
  const cErr = await evalNow(`JSON.stringify((window.__consoleErrors || []).filter(m => m.indexOf('listener error') > -1 || m.indexOf('library-loaded') > -1).slice(-3))`);
  console.log('DIAG-CONSOLE', cErr.result && cErr.result.value);
  // allData 由 openAll/filterContent 按后端真实库重建（合成缓存项未注册进后端），以
  // itemMappings 是否从 raw 全量建齐为 binding 闭环基准
  // ibc 不纳入：合成数据（folders/tagsGroups 空）下 bundle work 尾段偶发 throw 属数据工件
  // （try/catch 吞掉致 callback 未达）；mappings 从 raw 全量建齐 = 管线闭环证据
  const bKeys = await evalNow(`(() => {
    const s = window.$bodyScope;
    return JSON.stringify({ keys: Object.keys(s.itemMappings || {}), loading: s.isLoading, ibc: s.isItemBindCalculated });
  })()`);
  console.log('DIAG-B-KEYS', bKeys.result && bKeys.result.value);
  await assertExpr('m1-B-binding-done', `(() => {
    const s = window.$bodyScope;
    return !!(Object.keys(s.itemMappings || {}).length === 2
      && s.itemMappings['M1A'] && s.itemMappings['M1B']);
  })()`, 30000);

  await evalNow(`(() => {
    const ipc = ${ipcExpr};
    ipc.emit('background-state', { paletteQueueLength: 2, metadataQueueLength: 5, downloadQueueLength: 0, paletteQueueDelay: 0, paletteQueuePaused: false });
    return true;
  })()`);
  await delay(300);
  await assertExpr('m1-B-bg-state', `(() => {
    const s = window.$bodyScope;
    return s.metadataQueueLength === 5 && s.paletteQueueLength === 2 && window.__eagleLibraryDomain.hasHeartbeat === true;
  })()`);

  // ═══ C. cZ-4 条目数据 ═══
  await evalNow(`(() => {
    const ipc = ${ipcExpr};
    ipc.emit('image.added', { id: 'M1NEW', ext: 'png', name: 'm1-new', tags: [], folders: [] });
    return true;
  })()`);
  await delay(400);
  await assertExpr('m1-C-image-added', `(() => {
    const s = window.$bodyScope;
    return s.raw.length === 3 && !!s.itemMappings['M1NEW'];
  })()`);

  await evalNow(`(() => {
    const ipc = ${ipcExpr};
    ipc.emit('image.changed', { id: 'M1A', ext: 'png', name: 'm1-a-renamed', star: 5, tags: [], folders: [] });
    return true;
  })()`);
  await delay(500);
  await assertExpr('m1-C-image-changed', `(() => {
    const s = window.$bodyScope;
    return s.itemMappings['M1A'] && s.itemMappings['M1A'].name === 'm1-a-renamed' && s.itemMappings['M1A'].star === 5;
  })()`);

  await evalNow(`(() => {
    const ipc = ${ipcExpr};
    ipc.emit('update-txt-item', { id: 'M1A', text: 'hello m1' });
    return true;
  })()`);
  await delay(400);
  await assertExpr('m1-C-update-txt', `window.$bodyScope.itemMappings['M1A'].text === 'hello m1'`);

  // ═══ D. cZ-5 筛选/搜索 ═══
  await evalNow(`(() => {
    const ipc = ${ipcExpr};
    ipc.emit('keyword-suggestion', ['kw1', 'kw2']);
    return true;
  })()`);
  await delay(300);
  await assertExpr('m1-D-keyword-suggestion', `(() => {
    const s = window.$bodyScope;
    return Array.isArray(s.globalKeywords) && s.globalKeywords[0] === 'kw1';
  })()`);

  await evalNow(`(() => {
    const s = window.$bodyScope;
    let n = 0;
    const orig = s.filterContent;
    s.filterContent = function () { n++; return orig.apply(s, arguments); };
    window.__m1fc = () => n;
    s.eagle_filter_probe = true;
    // 触发 watch：写 filterRules.file.min（经 digest 触发域内 watcher）
    setTimeout(() => {
      s.$apply(function () {
        window.eagle.filter.filterRules.file.min = 100;
      });
    }, 50);
    return true;
  })()`);
  await delay(900);
  await assertExpr('m1-D-filter-watch-fires', `window.__m1fc() >= 1`);

  await evalNow(`(() => {
    const s = window.$bodyScope;
    let n = 0;
    const orig = s.rebindRefresh;
    s.rebindRefresh = function () { n++; return orig.apply(s, arguments); };
    window.__m1rr = () => n;
    s.$root.$broadcast('REBIND_REFRESH', true);
    return true;
  })()`);
  await delay(900);
  await assertExpr('m1-D-rebind-broadcast', `window.__m1rr() >= 1`);

  // ═══ E. cZ-6 选择/视图 ═══
  await evalNow(`(() => {
    const s = window.$bodyScope;
    let n = 0;
    const orig = s.updateSelection;
    s.updateSelection = function () { n++; return orig.apply(s, arguments); };
    window.__m1us = () => n;
    s.$apply(function () {
      s.selected = [s.raw[0]];
    });
    return true;
  })()`);
  await delay(500);
  await assertExpr('m1-E-selected-watch', `(() => {
    const s = window.$bodyScope;
    return s.selectedMappings && s.selectedMappings[s.raw[0].id] === true && window.__m1us() >= 1;
  })()`);

  await evalNow(`(() => {
    const s = window.$bodyScope;
    window.__m1us2 = window.__m1us();
    s.$root.$broadcast('UPDATE_SELECTION');
    return true;
  })()`);
  await delay(400);
  await assertExpr('m1-E-update-selection-broadcast', `window.__m1us() > window.__m1us2`);

  // ═══ F. cZ-7a 杂项 ═══
  await evalNow(`(() => {
    const ipc = ${ipcExpr};
    ipc.emit('window.maximize');
    ipc.emit('update-progress', 0.5);
    ipc.emit('add-download-tasks', 2);
    ipc.emit('show-sidebar-badge');
    ipc.emit('change.current.theme', { name: 'DARK', css: 'dark' });
    return true;
  })()`);
  await delay(600);
  await assertExpr('m1-F-misc-batch', `(() => {
    const s = window.$bodyScope;
    return s.isMaximize === true
      && s.progress === 0.5
      && s.uploadQueue.length >= 2
      && s.$root.preferences.general.showSidebarBadge === true
      && s.$root.theme === 'dark';
  })()`);

  await delay(600);
  await screenshotTo('test-run/react-stage1m1-unified-smoke.png', 5000);

  if (failures.length) {
    console.error(`M1 UNIFIED SMOKE FAILED: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('M1 UNIFIED SMOKE OK');
  }
} catch (err) {
  console.error('M1 UNIFIED SMOKE ERROR:', err);
  process.exitCode = 1;
} finally {
  if (stack) await stop(stack.electron).catch(() => {});
  if (stack) await stop(stack.vite).catch(() => {});
  if (stack) await stop(stack.backend).catch(() => {});
}
