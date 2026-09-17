/**
 * 临时探针：b1-9d 去 Angular 后主窗口启动诊断。
 * 检查：window.angular 缺席、$bodyScope shim 激活、raw/listDone 填充、
 * bundleGlobals/fnsBridge/dataMachinery 装载、body display、React 宿主与 console 错误。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-probe-b19d-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });

const evalNow = async (page, expression) => {
  const r = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return r.result.value;
};

const consoleErrors = [];
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
      await post('/api/library/create', { name: 'Probe B19D', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 640, height: 400, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      const tmp1 = path.join(librariesRoot, 'probe-b19d.png');
      fs.writeFileSync(tmp1, png);
      await post('/api/item/addFromPath', { paths: [tmp1] });
    },
  });
  const { page } = stack;

  // new-document 注入：捕获 unhandledrejection + 间谍 ipcRenderer.emit
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__rej = []; window.__spy = []; window.__cerr = [];
    (function () {
      const oe = console.error.bind(console);
      console.error = function () {
        try {
          window.__cerr.push([].slice.call(arguments).map(function (a) {
            return String(a && a.stack ? a.stack : a);
          }).join(' | ').slice(0, 600));
        } catch (e) {}
        try { oe.apply(null, arguments); } catch (e) {}
      };
    })();
    window.addEventListener('unhandledrejection', function (e) {
      window.__rej.push(String(e.reason && (e.reason.stack || e.reason.message || e.reason)).slice(0, 400));
    });
    window.addEventListener('error', function (e) {
      window.__rej.push('ERR:' + String(e.message).slice(0, 120) + ' @' + String(e.filename || '').slice(-60) + ':' + e.lineno + ':' + e.colno + ' STACK:' + String(e.error && e.error.stack || '').slice(0, 500));
    });
    (function patch() {
      const target = window.ipcRenderer;
      if (target && target.emit && !target.__spied) {
        const orig = target.emit.bind(target);
        target.emit = function (ch, p) {
          window.__spy.push(ch + (p && p.imagesStringPath ? '|' + String(p.imagesStringPath).slice(-40) : ''));
          try { return orig(ch, p); } catch (e) { window.__spy.push('THROW:' + ch + ':' + String(e && e.message).slice(0, 200)); throw e; }
        };
        target.__spied = true;
        setTimeout(patch, 500);
      } else {
        setTimeout(patch, 10);
      }
    })();
    // 早期轮询包装器：scope 出现后包装自然流程关键调用，抓分支段中途异常
    window.__natSteps = [];
    const snap = function () {
      const s0 = window.$bodyScope || {};
      return '{allData=' + (s0.allData ? s0.allData.length : -1) + ',isIBC=' + !!s0.isItemBindCalculated + ',raw=' + (s0.raw ? s0.raw.length : -1) + ',listDone=' + !!s0.listDone + '}';
    };
    window.__natTimer = setInterval(function () {
      const s = window.$bodyScope;
      if (!s || s.__natWrapped) return;
      s.__natWrapped = true;
      clearInterval(window.__natTimer);
      window.__natSteps.push('scopeReady' + snap());
      const origCib = s.calculateImageBinding;
      if (typeof origCib === 'function') {
        s.calculateImageBinding = function () {
          const args = [].slice.call(arguments);
          const last = args.length - 1;
          if (typeof args[last] === 'function') {
            const cb = args[last];
            args[last] = function () {
              window.__natSteps.push('natCbStart');
              try { cb.apply(null, arguments); window.__natSteps.push('natCbDone'); }
              catch (e) { window.__natSteps.push('natCbThrow:' + String(e && e.stack ? e.stack : e).slice(0, 500)); }
            };
          }
          window.__natSteps.push('cibCall');
          return origCib.apply(this, args);
        };
      } else {
        window.__natSteps.push('missing:calculateImageBinding');
      }
      ['openAll', 'openFolder', 'openSmartFolder', 'reload', 'changeSidebarIndex', 'rebindRefresh', 'relayout', 'contentFilter', 'resetImageData'].forEach(function (name) {
        const orig = s[name];
        if (typeof orig !== 'function') { window.__natSteps.push('missingFn:' + name); return; }
        s[name] = function () {
          window.__natSteps.push('call:' + name + snap());
          try { return orig.apply(this, arguments); }
          catch (e) { window.__natSteps.push('throw:' + name + ':' + String(e && e.stack ? e.stack : e).slice(0, 400)); }
        };
      });
      // allData/isIBC/listDone 状态变迁采样（50ms）——捕获绕过包装器的写入
      let lastSig = '';
      window.__natTick = setInterval(function () {
        const s2 = window.$bodyScope;
        if (!s2) return;
        const sig = 'allData=' + (s2.allData ? s2.allData.length : -1) + ',isIBC=' + !!s2.isItemBindCalculated + ',raw=' + (s2.raw ? s2.raw.length : -1) + ',listDone=' + !!s2.listDone;
        if (sig !== lastSig) { lastSig = sig; window.__natSteps.push('TICK' + snap()); }
      }, 50);
    }, 10);
    setTimeout(function () { /* 停止 30s 后的补丁循环 */ }, 0);
  ` });

  await waitFor(async () => {
    const ready = await evalNow(page, `document.readyState`);
    return ready === 'complete';
  });

  await new Promise((r) => setTimeout(r, 12000));

  const diag = await evalNow(page, `JSON.stringify({
    angular: typeof window.angular,
    bodyScopePresent: !!window.$bodyScope,
    shim: !!(window.$bodyScope && window.$bodyScope.__eagleShim),
    rawIsArray: !!(window.$bodyScope && Array.isArray(window.$bodyScope.raw)),
    rawLen: window.$bodyScope && window.$bodyScope.raw ? window.$bodyScope.raw.length : -1,
    listDone: !!(window.$bodyScope && window.$bodyScope.listDone),
    allCount: window.$bodyScope && window.$bodyScope.all ? window.$bodyScope.all.length : -1,
    bundleGlobalsN: window.__eagleBundleGlobals ? (window.__eagleBundleGlobals.present || []).length : -1,
    fnsBridge: window.__eagleShimFnsBridge ? window.__eagleShimFnsBridge.attached : null,
    machineryV: window.__eagleDataMachinery ? window.__eagleDataMachinery.version : -1,
    hostCount: document.querySelectorAll('[id$="-host"]').length,
    bodyDisplay: getComputedStyle(document.body).display,
    title: document.title,
  })`);
  console.log('B19D_DIAG', diag);

  const ipcDiag = await evalNow(page, `JSON.stringify({
    sameIpc: window.__eagleIpc === window.ipcRenderer,
    hasRealSend: !!(window.ipcRenderer && typeof window.ipcRenderer.send === 'function'),
    libDomain: window.__eagleLibraryDomain ? Object.keys(window.__eagleLibraryDomain).join(',') : 'missing',
    countReal: (function () { try { return require('electron').ipcRenderer.listenerCount('app-status-library-loaded'); } catch (e) { return 'ERR'; } })(),
    countShim: window.__eagleIpc && window.__eagleIpc.listenerCount ? window.__eagleIpc.listenerCount('app-status-library-loaded') : 'none',
    countWin: window.ipcRenderer && window.ipcRenderer.listenerCount ? window.ipcRenderer.listenerCount('app-status-library-loaded') : 'none',
    mockCache: Array.isArray(window.__mockLibraryCache) ? window.__mockLibraryCache.length : 'none',
  })`);
  console.log('B19D_IPC', ipcDiag);

  // 读取证：真实引导流的 emit 间谍 + 未处理拒绝 + scope 状态
  await new Promise((r) => setTimeout(r, 3000));
  const after = await evalNow(page, `JSON.stringify({
    rawLen: window.$bodyScope && window.$bodyScope.raw ? window.$bodyScope.raw.length : -1,
    listDone: !!(window.$bodyScope && window.$bodyScope.listDone),
    allCount: window.$bodyScope && window.$bodyScope.all ? window.$bodyScope.all.length : -1,
    isUILoaded: !!(window.$bodyScope && window.$bodyScope.isUILoaded),
    spy: (window.__spy || []).slice(0, 10),
    rej: (window.__rej || []).slice(0, 6),
  })`);
  console.log('B19D_AFTER', after);
  console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors.slice(0, 12)));

  // 二次采样：判定 listDone 是从未置位还是被晚到的 loading/reset 清掉
  await new Promise((r) => setTimeout(r, 8000));
  const late = await evalNow(page, `JSON.stringify({
    listDone: !!(window.$bodyScope && window.$bodyScope.listDone),
    allCount: window.$bodyScope && window.$bodyScope.all ? window.$bodyScope.all.length : -1,
    allDataLen: window.$bodyScope && window.$bodyScope.allData ? window.$bodyScope.allData.length : -1,
    rawLen: window.$bodyScope && window.$bodyScope.raw ? window.$bodyScope.raw.length : -1,
    isItemBindCalculated: !!(window.$bodyScope && window.$bodyScope.isItemBindCalculated),
    rej: (window.__rej || []).slice(0, 6),
    spy: (window.__spy || []).length,
    cerr: (window.__cerr || []).slice(0, 8),
    wUSS: typeof window.UrlStateService,
    sUSS: typeof (window.$bodyScope && window.$bodyScope.UrlStateService),
    sPref: typeof (window.$bodyScope && window.$bodyScope.preferences),
    wPrefSidebar: typeof (window.preferences && window.preferences.sidebar),
    wSS: typeof window.ScrollbarSaver,
    wAnalytics: typeof window.analytics,
  })`);
  console.log('B19D_LATE', late);
  const nat = await evalNow(page, `JSON.stringify({
    natSteps: (window.__natSteps || []).slice(0, 60),
  })`);
  console.log('B19D_NAT', nat);

  // 第三段：钩 electronLog.error 后手动重跑绑定——抓 calculateImageBinding 被吞异常
  await evalNow(page, `(function () {
    window.__errs2 = [];
    if (window.electronLog && window.electronLog.error) {
      const orig = window.electronLog.error.bind(window.electronLog);
      window.electronLog.error = function () {
        window.__errs2.push([].slice.call(arguments).map(String).join(' ').slice(0, 500));
        try { orig.apply(null, arguments); } catch (e) {}
      };
    }
    const s = window.$bodyScope;
    s.isItemBindCalculated = false;
    window.__bindingDone = false;
    s.calculateImageBinding({}, function () { window.__bindingDone = true; });
  })()`);
  await new Promise((r) => setTimeout(r, 5000));
  const bind = await evalNow(page, `JSON.stringify({
    bindingDone: window.__bindingDone === true,
    isItemBindCalculated: !!(window.$bodyScope && window.$bodyScope.isItemBindCalculated),
    errs2: (window.__errs2 || []).slice(0, 6),
  })`);
  console.log('B19D_BIND', bind);

  // 第四段：手动走 openAll → reload——抓 listDone 置位前的中途异常
  await evalNow(page, `(function () {
    const s = window.$bodyScope;
    window.__errs3 = [];
    window.__steps = [];
    const step = (n) => window.__steps.push(n);
    window.__openAllDone = false;
    try {
      step('openAll.type=' + typeof s.openAll + ' reload.type=' + typeof s.reload);
      s.openAll(undefined, function () { step('openAllCb'); window.__openAllDone = true; });
      step('openAllReturned');
    } catch (err) { step('openAllThrow:' + (err && err.stack ? String(err.stack).slice(0, 400) : err)); }
  })()`);
  await new Promise((r) => setTimeout(r, 3000));
  const oa = await evalNow(page, `(function () {
    const s = window.$bodyScope;
    try {
      window.__steps.push('reload.type=' + typeof s.reload);
      s.reload();
      window.__steps.push('reloadReturned');
    } catch (err) { window.__steps.push('reloadThrow:' + (err && err.stack ? String(err.stack).slice(0, 400) : err)); }
    return JSON.stringify({
      listDone: !!s.listDone,
      allCount: s.all ? s.all.length : -1,
      steps: (window.__steps || []).slice(0, 8),
      errs3: (window.__errs3 || []).slice(0, 6),
      errs2: (window.__errs2 || []).slice(0, 6),
    });
  })()`);
  await new Promise((r) => setTimeout(r, 2000));
  const oa2 = await evalNow(page, `JSON.stringify({
    listDone: !!(window.$bodyScope && window.$bodyScope.listDone),
    allCount: window.$bodyScope && window.$bodyScope.all ? window.$bodyScope.all.length : -1,
    steps: (window.__steps || []).slice(0, 10),
    errs3: (window.__errs3 || []).slice(0, 6),
  })`);
  console.log('B19D_OPENALL', oa);
  console.log('B19D_OPENALL2', oa2);
} finally {
  await stop(stack);
}
