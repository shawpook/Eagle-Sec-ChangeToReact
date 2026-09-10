/**
 * 临时探针（b1-9o）：诊断 filter 按钮点击链断点。
 * 检查：scope.toggleFilter 归属、portsProbe 观测钩子（b1-9bz-B-8 起替代 __eagleCoreFns）、filterDomain diag、
 * 点击前后 eagle.filter.isOpen 与按钮 active 类。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-probe-filter-'));
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
      await post('/api/library/create', { name: 'Probe Filter', savePath: librariesRoot });
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
  await waitFor(async () => (await evalNow(page, `!!document.getElementById('main-app')`)), 'main-app', 45000);
  await waitFor(async () => (await evalNow(page, `!!document.querySelector('#box-list .box')`)), 'grid boxes', 45000);
  await delay(800);

  console.log('scope.toggleFilter =', await evalNow(page,
    `typeof window.$bodyScope?.toggleFilter + ' | ' + (window.$bodyScope && window.$bodyScope.toggleFilter ? String(window.$bodyScope.toggleFilter).slice(0, 80) : 'MISSING')`));
  console.log('portsProbe present =', await evalNow(page, `!!window.__eaglePorts`));
  console.log('filterDomain diag =', JSON.stringify(await evalNow(page, `window.__eagleFilterDomain`)));
  console.log('isOpen before =', await evalNow(page, `String(window.eagle && window.eagle.filter && window.eagle.filter.isOpen)`));
  console.log('scope.eagle === window.eagle =', await evalNow(page, `String(window.$bodyScope && window.$bodyScope.eagle === window.eagle)`));

  const clickResult = await evalNow(page, `(() => {
    const btns = Array.from(document.querySelectorAll('#eagle-toolbar-host .right .ic-btn.filter-btn'));
    const filterBtn = btns.find((b) => b.querySelector('img[src*="ic-toolbar-filter.svg"]'));
    if (!filterBtn) return 'BTN-NOT-FOUND';
    filterBtn.click();
    return 'clicked, class=' + filterBtn.className;
  })()`);
  console.log('click =', clickResult);
  await delay(400);
  console.log('isOpen after =', await evalNow(page, `String(window.eagle && window.eagle.filter && window.eagle.filter.isOpen)`));
  console.log('btn active after =', await evalNow(page, `(() => {
    const btns = Array.from(document.querySelectorAll('#eagle-toolbar-host .right .ic-btn.filter-btn'));
    const filterBtn = btns.find((b) => b.querySelector('img[src*="ic-toolbar-filter.svg"]'));
    return filterBtn ? filterBtn.className.includes('active') : 'BTN-GONE';
  })()`));
  console.log('direct toggleFilter() =', await evalNow(page, `(() => {
    try { window.$bodyScope.toggleFilter(); return 'called, isOpen=' + window.eagle.filter.isOpen; }
    catch (err) { return 'THROW: ' + String(err && err.message).slice(0, 200); }
  })()`));

  // ── box 选中链诊断 ──
  await evalNow(page, `(() => {
    window.__consoleErrors = [];
    const ow = console.warn, oe = console.error;
    console.warn = function () { try { window.__consoleErrors.push('WARN: ' + String(Array.from(arguments)[0]).slice(0, 300)); } catch (e) {} return ow.apply(console, arguments); };
    console.error = function () { try { window.__consoleErrors.push('ERR: ' + String(Array.from(arguments)[0]).slice(0, 300)); } catch (e) {} return oe.apply(console, arguments); };
    return true;
  })()`);
  const boxClick = await evalNow(page, `(() => {
    const thumb = document.querySelector('#box-list .box .thumbnail');
    if (!thumb) return 'NO-THUMB';
    thumb.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    thumb.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return 'clicked';
  })()`);
  console.log('boxClick =', boxClick);
  await delay(600);
  console.log('selection after =', JSON.stringify(await evalNow(page, `(() => {
    const s = window.$bodyScope;
    const box = document.querySelector('#box-list .box.selected') || document.querySelector('#box-list .box');
    return {
      boxId: box && box.getAttribute('data-box-id'),
      selectedLen: s.selected ? s.selected.length : 'no-selected',
      mappingsKeys: s.selectedMappings ? Object.keys(s.selectedMappings) : 'no-mappings',
      boxSelectedClass: box ? box.className.includes('selected') : null,
    };
  })()`)));
  console.log('consoleErrors =', JSON.stringify(await evalNow(page, `(window.__consoleErrors || []).slice(-6)`)));
  console.log('cz3 listenerCounts =', JSON.stringify(await evalNow(page, `(() => {
    try {
      const ipc = window.__eagleIpc;
      return {
        ipcType: ipc ? ipc.constructor && ipc.constructor.name : String(ipc),
        hasListenerCount: ipc ? typeof ipc.listenerCount : 'no-ipc',
        initial: ipc.listenerCount('initial'),
        welcome: ipc.listenerCount('app-status-welcome'),
        dirs: ipc.listenerCount('app-status-library-dirs-loaded'),
        cache: ipc.listenerCount('app-status-library-cache-loaded'),
        libChanged: ipc.listenerCount('library.changed'),
      };
    } catch (e) { return { error: String(e).slice(0, 200) }; }
  })()`)));

  // ── openItemContextMenu 诊断（b1-9q）──
  await evalNow(page, `(() => {
    window.__cmOpens = [];
    window.$bodyScope.$on('CONTEXTMENU.OPEN', (e, options) => {
      window.__cmOpens.push({ items: options && options.items ? options.items.length : -1, visible: options && options.items ? options.items.filter(i => i && i.visible !== false).length : -1 });
    });
    return true;
  })()`);
  console.log('oicm =', JSON.stringify(await evalNow(page, `(() => {
    const s = window.$bodyScope;
    const box = document.querySelector('#box-list .box');
    const item = s.allData[0];
    s.selected = [item];
    const event = {
      pageX: 100, pageY: 100, clientX: 100, clientY: 100,
      target: box, preventDefault() {}, stopPropagation() {}, button: 2,
    };
    const guard = {
      tagName: event.target && event.target.tagName,
      selIdx: s.selected.indexOf(item),
      selLen: s.selected.length,
      itemIdx: s.allData.indexOf(item),
      viewMode: s.viewMode,
    };
    return s.openItemContextMenu(event, item).then(() => ({
      guard,
      trace: window.__oicmT || null,
      ok: true,
      cmOpens: window.__cmOpens,
      menuOpen: !!document.querySelector('#eagle-context-menu-host .context-menu.open'),
      items: document.querySelectorAll('#eagle-context-menu-host .context-menu .context-menu-item').length,
    })).catch((err) => ({ guard, throw: String(err && (err.stack || err)).slice(0, 700) }));
  })()`)));

  // ── a4 流程诊断（11a49 keyword 空态闭合）──
  console.log('a4 step1 =', JSON.stringify(await evalNow(page, `(() => {
    try {
      window.__uncaught = null;
      window.addEventListener('unhandledrejection', function (ev) {
        window.__unhandledRej = String((ev.reason && (ev.reason.stack || ev.reason.message)) || ev.reason).slice(0, 500);
      });
      window.onerror = function (msg, src, line, col, err) { if (!window.__uncaught) window.__uncaught = String(msg).slice(0, 200) + ' @ ' + String(err && err.stack ? err.stack.split('\n').slice(0, 4).join(' | ') : (src + ':' + line)).slice(0, 400); };
      const s = window.$bodyScope;
      s.search = (function (orig) { return function (v) { window.__searchCalls = (window.__searchCalls || 0) + 1; return orig.call(s, v); }; })(s.search);
      s.filterContent = (function (orig) { return function (v) { window.__fcCalls = (window.__fcCalls || 0) + 1; return orig.call(s, v); }; })(s.filterContent);
      s.keyword = 'zzz-no-hit'; s.filtereds = []; s.$evalAsync();
      return { isBind: !!s.isItemBindCalculated, hasSearch: typeof s.search, hasFc: typeof s.filterContent };
    } catch (e) { return { error: String(e).slice(0, 200) }; }
  })()`)));
  await delay(400);
  await evalNow(page, `(() => { const s = window.$bodyScope; s.keyword = ''; s.$evalAsync(); return true; })()`);
  await delay(800);
  console.log('a4 rejections =', JSON.stringify(await evalNow(page, `window.__unhandledRej || null`)));
  console.log('a4 direct fc =', JSON.stringify(await evalNow(page, `(() => {
    const s = window.$bodyScope;
    try { s.filterContent(); return { ok: true, filteredsLen: (s.filtereds || []).length }; }
    catch (err) { return { throw: String(err && (err.stack || err)).slice(0, 600) }; }
  })()`)));
  await delay(500);
  console.log('a4 rejections2 =', JSON.stringify(await evalNow(page, `window.__unhandledRej || null`)));
  console.log('a4 after =', JSON.stringify(await evalNow(page, `(() => {
    const s = window.$bodyScope;
    const box = document.getElementById('box-container');
    return {
      searchCalls: window.__searchCalls || 0,
      fcCalls: window.__fcCalls || 0,
      keyword: s.keyword,
      filteredsLen: s.filtereds ? s.filtereds.length : 'none',
      allDataLen: s.allData ? s.allData.length : 'none',
      emptyClass: box ? box.classList.contains('empty') : null,
      filterBadge: window.eagle && window.eagle.filter ? window.eagle.filter.filterBadge : 'no-filter',
      dropAreas: document.querySelectorAll('#eagle-drop-areas-host .drop-area').length,
      viewMode: s.viewMode,
      watchTotal: (s.$watchers || []).length,
      kwWatchers: (s.$watchers || []).filter(w => w.exp === 'keyword').length,
    };
  })()`)));
} catch (err) {
  console.error('PROBE ERROR:', err);
} finally {
  if (stack) await stop(stack.electron).catch(() => {});
  if (stack) await stop(stack.vite).catch(() => {});
  if (stack) await stop(stack.backend).catch(() => {});
}
