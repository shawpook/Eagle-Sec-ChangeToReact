/**
 * 临时探针：复现 main-ui-workflow 的「空库」启动条件（createLibrary 后不添加任何 item），
 * 判定 b1-9d 去 Angular 后 listDone 是否仍置位。不提交。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-probe-b19de-'));
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
      await post('/api/library/create', { name: 'Probe Empty', savePath: librariesRoot });
      await post('/api/folder/create', { name: 'wf' });
    },
  });
  const { page } = stack;

  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__injected = true;
    window.__rej = []; window.__spy = []; window.__cerr = []; window.__natSteps = [];
    (function () {
      const oe = console.error.bind(console);
      console.error = function () {
        try { window.__cerr.push([].slice.call(arguments).map(function (a) { return String(a && a.stack ? a.stack : a); }).join(' | ').slice(0, 1400)); } catch (e) {}
        try { oe.apply(null, arguments); } catch (e) {}
      };
    })();
    window.addEventListener('unhandledrejection', function (e) { window.__rej.push(String(e.reason && (e.reason.stack || e.reason.message || e.reason)).slice(0, 400)); });
    window.addEventListener('error', function (e) { window.__rej.push('ERR:' + String(e.message).slice(0, 200)); });
    (function patchLog() {
      if (window.electronLog && window.electronLog.error && !window.electronLog.__spied) {
        const orig = window.electronLog.error.bind(window.electronLog);
        window.electronLog.error = function () {
          try { window.__cerr.push('electronLog: ' + [].slice.call(arguments).map(function (a) { return String(a && a.stack ? a.stack : a); }).join(' | ').slice(0, 500)); } catch (e) {}
          try { orig.apply(null, arguments); } catch (e) {}
        };
        window.electronLog.__spied = true;
        return;
      }
      setTimeout(patchLog, 10);
    })();
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
      } else { setTimeout(patch, 10); }
    })();
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
      } else { window.__natSteps.push('missing:calculateImageBinding'); }
      ['openAll', 'openFolder', 'openSmartFolder', 'reload', 'changeSidebarIndex', 'rebindRefresh', 'relayout', 'contentFilter', 'resetImageData'].forEach(function (name) {
        const orig = s[name];
        if (typeof orig !== 'function') { window.__natSteps.push('missingFn:' + name); return; }
        s[name] = function () {
          window.__natSteps.push('call:' + name + snap());
          try { return orig.apply(this, arguments); }
          catch (e) { window.__natSteps.push('throw:' + name + ':' + String(e && e.stack ? e.stack : e).slice(0, 400)); }
        };
      });
      let lastSig = '';
      window.__natTick = setInterval(function () {
        const s2 = window.$bodyScope;
        if (!s2) return;
        const sig = 'allData=' + (s2.allData ? s2.allData.length : -1) + ',isIBC=' + !!s2.isItemBindCalculated + ',raw=' + (s2.raw ? s2.raw.length : -1) + ',listDone=' + !!s2.listDone;
        if (sig !== lastSig) { lastSig = sig; window.__natSteps.push('TICK' + snap()); }
      }, 50);
    }, 10);
  ` });

  await waitFor(async () => {
    const ready = await evalNow(page, `document.readyState`);
    return ready === 'complete';
  });

  // 文档已先于 addScriptToEvaluateOnNewDocument 创建 → 主动 reload 让注入生效
  await page.send('Page.reload', { ignoreCache: false });
  await new Promise((r) => setTimeout(r, 500));
  await waitFor(async () => {
    const ready = await evalNow(page, `document.readyState`);
    return ready === 'complete';
  });

  for (const ms of [3000, 5000, 8000, 12000]) {
    await new Promise((r) => setTimeout(r, ms));
    const snap = await evalNow(page, `JSON.stringify({
      injected: !!window.__injected,
      angular: typeof window.angular,
      shim: !!(window.$bodyScope && window.$bodyScope.__eagleShim),
      hasIpc: typeof window.ipcRenderer,
      mockCache: Array.isArray(window.__mockLibraryCache) ? window.__mockLibraryCache.length : 'none',
      listDone: !!(window.$bodyScope && window.$bodyScope.listDone),
      rawIsArray: !!(window.$bodyScope && Array.isArray(window.$bodyScope.raw)),
      rawLen: window.$bodyScope && window.$bodyScope.raw ? window.$bodyScope.raw.length : -1,
      isIBC: !!(window.$bodyScope && window.$bodyScope.isItemBindCalculated),
      viewMode: window.$bodyScope && window.$bodyScope.viewMode,
      spy: (window.__spy || []).slice(0, 8),
      nat: (window.__natSteps || []).slice(0, 30),
      cerr: (window.__cerr || []).slice(0, 6),
      rej: (window.__rej || []).slice(0, 4),
      tree: (function () {
        const s = window.$bodyScope || {};
        const f = s.folders || [];
        const describe = (x) => {
          if (!x) return String(x);
          return {
            id: x.id, name: x.name,
            childType: typeof x.children,
            childIsArr: Array.isArray(x.children),
            childLen: Array.isArray(x.children) ? x.children.length : -1,
            childName: (typeof x.children === 'function') ? (x.children.name || '(anon)') : null,
            childStr: (typeof x.children === 'function') ? String(x.children).slice(0, 160) : null,
            keys: Object.keys(x).slice(0, 24),
            parent: x.parent,
          };
        };
        return {
          foldersIsArr: Array.isArray(s.folders),
          foldersLen: f.length,
          f0: f[0] ? describe(f[0]) : null,
          f0c0: (f[0] && Array.isArray(f[0].children) && f[0].children[0]) ? describe(f[0].children[0]) : null,
          smartLen: Array.isArray(s.smartFolders) ? s.smartFolders.length : -1,
          folderListLen: Array.isArray(s.folderList) ? s.folderList.length : -1,
          mappings: Object.keys(s.folderMappings || {}).length,
        };
      })(),
    })`);
    console.log('EMPTY@' + ms, snap);
  }
} finally {
  await stop(stack);
}
