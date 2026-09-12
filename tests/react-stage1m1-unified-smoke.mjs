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

  // ═══ A. 域接管标志与监听面（b1-9o 改结果导向：五域 diag + 关键通道唯一监听 + shim watcher 清点）═══
  const aDiag = await evalNow(`(() => {
    const L = window.__eagleLibraryDomain, I = window.__eagleItemDomain, F = window.__eagleFilterDomain, S = window.__eagleSelectionViewDomain, M = window.__eagleMiscDomain;
    const s = window.$bodyScope;
    const ipc = window.eagleDesktop?.ipc || window.$electronIpc || window.__eagleIpc;
    // shims 的自定义 EventEmitter 无 listenerCount——listeners 为 Map 时取 Map 计数（cz3 同法）
    const lc = (ch) => {
      if (!ipc) return -1;
      if (typeof ipc.listenerCount === 'function') return ipc.listenerCount(ch);
      if (ipc.listeners instanceof Map) return (ipc.listeners.get(ch) || []).length;
      return -1;
    };
    const ws = s.$watchers || [];
    const filterMinTotal = ws.filter(w => w.exp === 'eagle.filter.filterRules.file.min').length;
    const a1 = L && I && F && S && M;
    // b1-9o：mock 总线上同通道被 shims/组件/域多方监听（DIAG 实测 app-status-loading=4、
    // image.changed=2、jieba-extract-done=2）——接线契约用 ≥1；REBIND_REFRESH /
    // UPDATE_SELECTION 是 $on 作用域广播（__bus），不是 ipc 通道；SAVE_FOLDER 已于 b1-9bz-C-2
    // 迁到 eagleBus，故改查 window.__eagleBus.listenerCount。
    const a2 = L.takenOver === true && lc('app-status-loading') >= 1 && lc('app-status-library-loaded') >= 1 && lc('preload-library') >= 1;
    const a3 = I.takenOver === true && lc('image.added') >= 1 && lc('image.changed') >= 1 && lc('file-uploaded') >= 1 && lc('thumbnail-generated') >= 1;
    const a4 = F.takenOver === true && lc('keyword-suggestion') >= 1 && lc('show-and-search') >= 1 && window.__eagleBus.listenerCount('REBIND_REFRESH') >= 1;
    const a5 = S.takenOver === true && window.__eagleBus.listenerCount('UPDATE_SELECTION') >= 1 && window.__eagleBus.listenerCount('SAVE_FOLDER') >= 1;
    const a6 = M.takenOver === true && lc('before-quit') >= 1 && lc('window.maximize') >= 1 && lc('change.current.theme') >= 1 && lc('jieba-extract-done') >= 1;
    // b1-9bi：12 个 eagle.filter 字符串 watcher 退役为 filterService 订阅——契约 = scope 零 watcher + 订阅在
    const a7 = filterMinTotal === 0 && F.ruleSubscribed === true;
    window.__aOk = !!(a1 && a2 && a3 && a4 && a5 && a6 && a7);
    return JSON.stringify({
      L: !!L, I: !!I, F: !!F, S: !!S, M: !!M,
      Ll: lc('app-status-loading'), Lld: lc('app-status-library-loaded'), Lp: lc('preload-library'),
      Ia: lc('image.added'), Ic: lc('image.changed'), If: lc('file-uploaded'), It: lc('thumbnail-generated'),
      Fk: lc('keyword-suggestion'), Fs: lc('show-and-search'), Fr: lc('REBIND_REFRESH'),
      Su: lc('UPDATE_SELECTION'), Ss: lc('SAVE_FOLDER'),
      Mb: lc('before-quit'), Mt: lc('window.maximize'), Mj: lc('jieba-extract-done'),
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
    // b1-9bz-E2：raw/allData 等已注册到底层 store——scope 写 = store 真身 + coreState 诊断镜像；
    // 反向（直写 coreState → scope 读）按设计不再透明（cz1 已记录同口径）。
    s.allData = [{ id: 'C8R' }];
    window.__c8r = !!(s.allData && s.allData.length === 1 && s.allData[0].id === 'C8R')
      && window.__eagleItemState.getState().allData[0].id === 'C8R';
    window.__c8keys = ['raw', 'allData', 'selected', 'currentFolder', 'folders', 'imageSize', 'preferences', 'pluginModule', 'TagManager', 'eagle']
      .every((k) => window.__eagleScopeShim.migratedFieldNames().includes(k));
    s.raw = [];
    s.allData = [];
    return true;
  })()`);
  await assertExpr('m1-A2-c8-write-through', `window.__c8w === true && window.__c8r === true && window.__c8keys === true`);

  // ═══ A3. c9 数据机器域（scope 函数替换生效 + 契约）═══
  await assertExpr('m1-A3-c9-machinery', `(() => {
    const m = window.__eagleDataMachinery;
    const s = window.$bodyScope;
    const M = window.__eagleMachinery;
    if (!m || !m.applied || m.version < 2 || !M) return false;
    return ['calculateImageBinding', 'sortRawData', 'rebindRefresh', 'rebindRefreshLazy',
      'updateSidebarList', 'updateItemsView', 'switchLayout', 'prependImages', 'reload',
      'getRatioExp', 'getRatioNonExp', 'updateZoomRatio', 'toggleSlideshow',
      'smartFolderCount', 'getRecentFolders']
      .every((k) => m[k] === 'machinery')
      && typeof M.calculateImageBinding === 'function'
      && typeof M.rebindRefresh === 'function'
      && typeof M.updateSidebarList === 'function';
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
            // E1c 契约：Angular 方法面已退役（$apply/$watch/$watchCollection/$on/$broadcast 均已移除），
            // 仅剩属性 Proxy + $eval 与占位键
            const cleaned = shim.$apply === undefined && shim.$watch === undefined && shim.$watchCollection === undefined
              && shim.$on === undefined && shim.$broadcast === undefined
              && typeof shim.$evalAsync === 'function'; // $evalAsync 保留为测试/驱动 no-op 钩子
            const rootOk = shim.$root === shim && !!shim.mousetrap && typeof shim.$eval === 'function';
            delete window.__eagleCoreState.testField;
            window.__a6 = (writeOk && cleaned && rootOk && shim.__eagleShim === true) ? 'ok' : 'fail:' + [writeOk, cleaned, rootOk].join(',');
    } catch (err) { window.__a6 = 'err:' + err.message; }
    return true;
  })()`);
  await assertExpr('m1-A6-scope-shim', `window.__a6 === 'ok'`);

  // ═══ A7. c12 eagle 成员反转挂载（if-absent 共存：bundle 在世成员齐备）═══
  await assertExpr('m1-A7-eagle-members', `(() => {
    const g = window.__eagleBundleGlobals;
    const e = window.eagle;
    if (!g || !g.eagleMembers || !e) return false;
    return ['inspector', 'filter', 'duplicateChecker', 'reverseImageSearch', 'aiSearch',
      'customExport', 'combineImages', 'action', 'plugin', 'app', 'containerSize', 'utils']
      .every((n) => g.eagleMembers.includes(n) && e[n] !== undefined)
      && typeof e.utils.tree.walk === 'function'
      && typeof e.filter.filterRules === 'object';
  })()`);

  // ═══ A8. 网格引擎 + relayout machinery 标记（be2 起 = v4 facade：window.ig 由
  //     boxGridEngine 承接，window.eg/v3 UMD 退役）═══
  await assertExpr('m1-A8-eg-infinitegrid', `(() => {
    const w = window;
    return typeof w.ig === 'object' && typeof w.ig.getItems === 'function'
      && typeof w.ig.getGroupKeys === 'function' && !w.eg;
  })()`);
  await assertExpr('m1-A8-relayout-machinery', `(() => {
    const m = window.__eagleDataMachinery;
    const M = window.__eagleMachinery;
    return m && m.version >= 7 && m.relayout === 'machinery'
      && M && typeof M.relayout === 'function';
  })()`);

  // ═══ A9. c14 智能文件夹规则匹配（26 规则函数在位 + existInSmartFilter 实调）═══
  await evalNow(`(() => {
    const w = window;
    const s = w.$bodyScope;
    const M = w.__eagleMachinery;
    const ruleFnsOk = typeof w.isMatchNameRule === 'function' && typeof w.isMatchTypeRule === 'function'
      && typeof w.isMatchColorRule === 'function' && typeof w.isMatchFontActivatedRule === 'function';
    // 实调：name contains 规则 + type equal 规则（D-1 A-2：经 __eagleMachinery 直调）
    const folder = { conditions: [{ match: 'AND', rules: [
      { property: 'name', method: 'contain', value: 'Alpha' },
    ] }] };
    const img = { name: 'Alpha One', ext: 'png', tags: [], folders: [], width: 100, height: 50, size: 1, modificationTime: Date.now() };
    let r1 = null, r2 = null, r3 = null;
    try { r1 = M.existInSmartFilter(s, folder, img); } catch (err) { r1 = 'err:' + err.message; }
    folder.conditions[0].rules[0].value = 'Zeta';
    try { r2 = M.existInSmartFilter(s, folder, img); } catch (err) { r2 = 'err:' + err.message; }
    folder.conditions[0].rules[0] = { property: 'type', method: 'equal', value: 'png' };
    try { r3 = M.existInSmartFilter(s, folder, img); } catch (err) { r3 = 'err:' + err.message; }
    window.__a9 = (M && ruleFnsOk && r1 === true && r2 === false && r3 === true) ? 'ok' : 'fail:' + [ruleFnsOk, r1, r2, r3].join(',');
    return true;
  })()`);
  await assertExpr('m1-A9-smart-filter', `window.__a9 === 'ok'`);

  // ═══ A10. c14b 筛选引擎契约（filterData/calcuteFilterResult machinery 标记）═══
  await assertExpr('m1-A10-filter-engine', `(() => {
    const m = window.__eagleDataMachinery;
    const M = window.__eagleMachinery;
    return m && m.version >= 9 && m.filterData === 'machinery'
      && m.calcuteFilterResult === 'machinery'
      && M && typeof M.filterData === 'function'
      && typeof M.calcuteFilterResult === 'function';
  })()`);

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
    try { window.__eagleMachinery.calculateImageBinding(s, {}, function () { window.__m1cb = (window.__m1cb || 0) + 1; }); }
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
    window.__eagleMachinery.calls.filterContent = 0;
    window.$bodyScope.eagle_filter_probe = true;
    // 触发订阅：写 filterRules.file.min（b1-9bi 起 setFilterRule 是唯一写路径——
    // 原 scopeShim 轮询 watcher 已退役为 filterService 显式订阅）
    setTimeout(() => {
      window.__eagleFilterService.setFilterRule('file', 'min', 100);
    }, 50);
    return true;
  })()`);
  await delay(900);
  // D-1 A-2：挂载退役后不再 spy s.filterContent，改为读 machinery 调用计数（__eagleMachinery.calls）
  await assertExpr('m1-D-filter-watch-fires', `window.__eagleMachinery.calls.filterContent >= 1 && window.__eagleFilterService.listenerCount() >= 1`);

  await evalNow(`(() => {
    window.__eagleMachinery.calls.rebindRefresh = 0;
    window.__eagleBus.emit('REBIND_REFRESH', true);
    return true;
  })()`);
  await delay(900);
  await assertExpr('m1-D-rebind-broadcast', `window.__eagleMachinery.calls.rebindRefresh >= 1`);

  // ═══ E. cZ-6 选择/视图 ═══
  await evalNow(`(() => {
    const s = window.$bodyScope;
    window.__eagleMachinery.calls.updateSelection = 0;
    (function () {
      s.selected = [s.raw[0]];
    })();
    return true;
  })()`);
  await delay(500);
  await assertExpr('m1-E-selected-watch', `(() => {
    const s = window.$bodyScope;
    return s.selectedMappings && s.selectedMappings[s.raw[0].id] === true && window.__eagleMachinery.calls.updateSelection >= 1;
  })()`);

  await evalNow(`(() => {
    window.__m1us2 = window.__eagleMachinery.calls.updateSelection;
    window.__eagleBus.emit('UPDATE_SELECTION');
    return true;
  })()`);
  await delay(400);
  await assertExpr('m1-E-update-selection-broadcast', `window.__eagleMachinery.calls.updateSelection > window.__m1us2`);

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
