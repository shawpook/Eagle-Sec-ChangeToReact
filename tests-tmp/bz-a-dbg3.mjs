/** bz-A 判别探针 v3：新文档注入错误陷阱 → Page.reload 复刻 boot → 抓 openAll/reload/setState 调用与异常 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bzdbg3-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });

const TRAP = [
  "(function(){",
  "  var T = window.__T = { errs: [], timeoutErrs: [], openAllCalls: 0, reloadCalls: 0, setStateCalls: 0 };",
  "  window.addEventListener('error', function(e){ T.errs.push('onerror: ' + (e.error && e.error.stack || e.message)); });",
  "  window.addEventListener('unhandledrejection', function(e){ var r=e.reason; T.errs.push('unhandledrejection: ' + (r && r.stack || String(r))); });",
  "  var ost = window.setTimeout;",
  "  window.setTimeout = function(fn, d){",
  "    if (typeof fn === 'function') {",
  "      var w = function(){ try { return fn.apply(this, arguments); } catch(err){ T.timeoutErrs.push(String(err && err.stack || err).slice(0,600)); throw err; } };",
  "      return ost.call(window, w, d);",
  "    }",
  "    return ost.apply(window, arguments);",
  "  };",
  "  var oraf = window.requestAnimationFrame;",
  "  window.requestAnimationFrame = function(fn){",
  "    if (typeof fn === 'function') {",
  "      return oraf.call(window, function(t){ try { return fn(t); } catch(err){ T.timeoutErrs.push('raf: ' + String(err && err.stack || err).slice(0,600)); throw err; } });",
  "    }",
  "    return oraf.apply(window, arguments);",
  "  };",
  "  var t0 = Date.now();",
  "  (function tick(){",
  "    var s = window.$bodyScope;",
  "    if (s && typeof s.openAll === 'function' && !s.__trapped) {",
  "      s.__trapped = true;",
  "      T.scopeSeenAt = Date.now() - t0;",
  "      T.atWrap = { viewMode: s.viewMode, allData: typeof s.allData, allDataLen: (s.allData && s.allData.length),",
  "                   resetPage: typeof s.resetPage, reload: typeof s.reload, root: typeof s.$root,",
  "                   scrollbarSaver: typeof (window.ScrollbarSaver && window.ScrollbarSaver.saveScrollPosition),",
  "                   listDone: !!s.listDone };",
  "      var oa = s.openAll;",
  "      s.openAll = function(ih, cb){",
  "        T.openAllCalls++; T.openAllLastArg0 = String(ih);",
  "        T.atCall = { viewMode: s.viewMode, allDataLen: (s.allData && s.allData.length),",
  "                     colorVal: (function(){ try { return JSON.stringify(window.eagle.filter.filterRules.color.value); } catch(e){ return 'ERR:'+e.message; } })(),",
  "                     allData: typeof s.allData };",
  "        try { var r = oa.apply(this, arguments); T.openAllLastResult = 'ok'; return r; }",
  "        catch(err){ T.openAllLastResult = 'THROW ' + String(err && err.stack || err).slice(0,600); throw err; }",
  "      };",
  "      var orl = s.reload;",
  "      s.reload = function(){ T.reloadCalls++; try { var r = orl.apply(this, arguments); T.reloadLast='ok'; return r; } catch(err){ T.reloadLast='THROW '+String(err && err.stack||err).slice(0,600); throw err; } };",
  "      return;",
  "    }",
  "    ost.call(window, tick, 100);",
  "  })();",
  "})();",
].join('\n');

let stack;
try {
  stack = await bootStack({
    librariesRoot, stateFile, userDataDir,
    beforeElectron: async (apiPort) => {
      const post = async (route, body) => {
        const response = await fetch(`http://127.0.0.1:${apiPort}${route}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') throw new Error(`${route} failed: ${JSON.stringify(payload)}`);
        return payload.data;
      };
      await post('/api/library/create', { name: 'BzDbg3 Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      const tmp1 = path.join(librariesRoot, 'a.png');
      fs.writeFileSync(tmp1, png);
      await post('/api/item/addFromPaths', { paths: [tmp1] });
    },
  });
  const { page } = stack;

  // 注入陷阱 → reload 复刻一次完整 boot
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: TRAP });
  await page.send('Page.reload', { ignoreCache: true });
  await delay(1500);
  await page.send('Runtime.enable');
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', { expression: `document.readyState`, returnByValue: true });
    return r.result.value === 'complete';
  }, 'reloaded window ready', 30000);
  await delay(14000);

  const r1 = await page.send('Runtime.evaluate', {
    expression: `(function(){
      var s = window.$bodyScope, T = window.__T || {};
      return JSON.stringify({
        bootPhase: {
          listDone: !!s.listDone,
          isItemBindCalculated: !!s.isItemBindCalculated,
          colorDistancesMap: typeof s.colorDistancesMap,
          rawLen: s.raw ? s.raw.length : -1,
          boxes: document.querySelectorAll('#box-list .box').length,
        },
        trap: {
          scopeSeenAt: T.scopeSeenAt, openAllCalls: T.openAllCalls, reloadCalls: T.reloadCalls,
          openAllLastArg0: T.openAllLastArg0, openAllLastResult: T.openAllLastResult,
          reloadLast: T.reloadLast, atWrap: T.atWrap, atCall: T.atCall,
          errs: (T.errs||[]).slice(0,12), timeoutErrs: (T.timeoutErrs||[]).slice(0,12),
        }
      });
    })()`, returnByValue: true,
  });
  console.log('PHASE1:', r1.result.value);

  // 阶段 2：复刻 boot 形态 openAll(undefined, callback) vs 手动 openAll(true)
  const r2 = await page.send('Runtime.evaluate', {
    expression: `(async () => {
      const s = window.$bodyScope, T = window.__T;
      const out = {};
      const oSet = s.UrlStateService && s.UrlStateService.setState;
      try { oSet.call(s.UrlStateService, { view:'all', folder:null, smartfolder:null, tag:null, color:null }); out.setStateDirect='ok'; }
      catch(e){ out.setStateDirect='THROW ' + String(e && e.stack || e).slice(0,400); }
      out.preListDone = !!s.listDone;
      T.reloadCalls = 0; T.openAllCalls = 0;
      try { s.openAll(undefined, null); out.bootShape='ok'; }
      catch(e){ out.bootShape='THROW ' + String(e && e.stack || e).slice(0,400); }
      await new Promise(res => setTimeout(res, 1500));
      out.bootShape_openAllCalls = T.openAllCalls;
      out.bootShape_reloadCalls = T.reloadCalls;
      out.bootShape_reloadLast = T.reloadLast;
      out.bootShape_listDone = !!s.listDone;
      out.bootShape_colorMap = typeof s.colorDistancesMap;
      return JSON.stringify(out);
    })()`, returnByValue: true, awaitPromise: true,
  });
  console.log('PHASE2:', r2.result.value);

  // 阶段 3：手动 openAll(true) 对照
  const r3 = await page.send('Runtime.evaluate', {
    expression: `(async () => {
      const s = window.$bodyScope, T = window.__T;
      const out = {};
      T.reloadCalls = 0; T.openAllCalls = 0;
      try { s.openAll(true); out.manual='ok'; }
      catch(e){ out.manual='THROW ' + String(e && e.stack || e).slice(0,400); }
      await new Promise(res => setTimeout(res, 1500));
      out.manual_openAllCalls = T.openAllCalls;
      out.manual_reloadCalls = T.reloadCalls;
      out.manual_reloadLast = T.reloadLast;
      out.manual_listDone = !!s.listDone;
      out.manual_colorMap = typeof s.colorDistancesMap;
      out.manual_boxes = document.querySelectorAll('#box-list .box').length;
      out.finalErrs = (T.errs||[]).length;
      out.finalTimeoutErrs = (T.timeoutErrs||[]).slice(0,6);
      return JSON.stringify(out);
    })()`, returnByValue: true, awaitPromise: true,
  });
  console.log('PHASE3:', r3.result.value);

  const ev = (stack.page.events || []).filter((m) => m.method === 'Runtime.exceptionThrown' || m.method === 'Runtime.consoleAPICalled' && m.params && m.params.type === 'error');
  console.log('EVENTS:', JSON.stringify(ev.slice(-25).map((m) => m.method === 'Runtime.exceptionThrown'
    ? 'EXC ' + JSON.stringify(m.params.exceptionDetails && (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text)).slice(0, 400)
    : 'ERR ' + JSON.stringify(m.params.args && m.params.args[0] && (m.params.args[0].description || m.params.args[0].value)).slice(0, 300))));
} catch (err) {
  console.log('PROBE-FAIL:', err.message);
} finally {
  await stop(stack);
}
