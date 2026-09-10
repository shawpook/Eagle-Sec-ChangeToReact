/**
 * 7d-2 排查探针：OPEN_RENAME 广播后抓取 React 错误与弹窗状态。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-probe-7d2-'));
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
      await post('/api/library/create', { name: 'Probe 7d2', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 'probe.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 'probe.png')] });
    },
  });
  const { page } = stack;
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source:
      "window.__errors = []; const __ce = console.error; console.error = function(...a) { try { window.__errors.push(String((a[0] && a[0].stack) || a[0]).slice(0, 400)); } catch (e) {} __ce.apply(console, a); };",
  });
  const ev = async (expression) => (await page.send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
  await waitFor(async () => (await ev(`document.readyState`)) === 'complete', 'ready', 30000);
  await waitFor(async () => (await ev(`!!document.getElementById('main-app')`)), 'main-app', 45000);
  await waitFor(async () => (await ev(`!!document.querySelector('#box-list .box')`)), 'boxes', 45000);
  await delay(500);

  console.log('reactErr-before:', await ev(`window.__reactErr || 'none'`));
  console.log('isLib:', await ev(`typeof window.is, window.is && typeof window.is.number`));
  console.log('moment:', await ev(`(() => { try { const m = window.require('moment'); return typeof m; } catch (e) { return 'ERR: ' + e.message; } })()`));
  console.log('sanitize:', await ev(`typeof window.sanitize`));
  console.log('FileUrlHelper:', await ev(`typeof window.FileUrlHelper`));
  console.log('numberFixedLen-on-window:', await ev(`typeof window.numberFixedLen`));

  console.log('artstation-global:', await ev(`(() => { try { return typeof window.Artstation + ':' + typeof window.Artstation.isValidUrl; } catch (e) { return 'ERR ' + e.message; } })()`));
  console.log('art-open:', await ev(`(() => {
    try {
      window.$bodyScope.$root.$broadcast('IMPORT_ARTSTATION');
      return 'ok';
    } catch (e) { return 'ERR: ' + e.message; }
  })()`));
  await delay(900);
  console.log('art-modal:', await ev(`!!document.querySelector('#eagle-artstation-import-host .import-modal.open')`));
  console.log('art-set-url:', await ev(`(() => {
    const input = document.getElementById('artstation-url');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'https://example.com/not-artstation');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return document.activeElement && document.activeElement.id;
  })()`));
  console.log('art-input-keys:', await ev(`(() => {
    const input = document.getElementById('artstation-url');
    const keys = Object.keys(input).filter((k) => k.startsWith('__react'));
    return JSON.stringify(keys.map((k) => ({ k, hasOnChange: !!(input[k] && input[k].onChange) })));
  })()`));
  console.log('art-native-unique:', await ev(`(() => {
    const input = document.getElementById('artstation-url');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'https://unique-native-check.com/x');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return 'dispatched';
  })()`));
  await delay(250);
  console.log('art-pageUrl-unique:', await ev(`window.__eagleArtstation.pageUrl`));
  console.log('art-direct-onchange:', await ev(`(() => {
    const input = document.getElementById('artstation-url');
    const propsKey = Object.keys(input).find((k) => k.startsWith('__reactProps$'));
    if (!propsKey || !input[propsKey].onChange) return 'no-onchange';
    input[propsKey].onChange({ target: input });
    return 'called';
  })()`));
  await delay(200);
  console.log('art-native-input-check:', await ev(`(() => {
    const input = document.getElementById('artstation-url');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'https://example.com/not-artstation');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return 'dispatched';
  })()`));
  await delay(250);
  console.log('art-pageUrl-after-native:', await ev(`window.__eagleArtstation ? window.__eagleArtstation.pageUrl : 'no-contract'`));
  console.log('art-props-check:', await ev(`(() => {
    const input = document.getElementById('artstation-url');
    const propsKey = Object.keys(input).find((k) => k.startsWith('__reactProps$'));
    const props = input[propsKey] || {};
    return JSON.stringify({ onBlur: typeof props.onBlur, onKeyDown: typeof props.onKeyDown, onChange: typeof props.onChange });
  })()`));
  console.log('art-focusout-dispatch:', await ev(`(() => {
    const input = document.getElementById('artstation-url');
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    return 'dispatched';
  })()`));
  await delay(250);
  console.log('art-urlError-after-focusout:', await ev(`window.__eagleArtstation.urlError`));
  console.log('art-blur:', await ev(`(() => {
    const input = document.getElementById('artstation-url');
    input.blur();
    return 'blurred';
  })()`));
  await delay(300);
  console.log('art-contract:', await ev(`(() => {
    const c = window.__eagleArtstation;
    if (!c) return 'missing';
    const r = c.vaildateUrl();
    return JSON.stringify({ ret: r, urlError: c.urlError, pageUrl: c.pageUrl });
  })()`));
  await delay(200);
  console.log('art-error-state:', await ev(`(() => {
    const msg = document.querySelector('#eagle-artstation-import-host .error-message');
    const input = document.getElementById('artstation-url');
    return JSON.stringify({ hasMsg: !!msg, display: msg ? msg.style.display : null, text: msg ? msg.textContent : null, cls: input ? input.className : null });
  })()`));
  console.log('consoleErrors:', JSON.stringify(await ev(`(window.__errors || []).slice(0, 4)`)));
  console.log('art-close:', await ev(`(() => {
    const input = document.getElementById('artstation-url');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', keyCode: 27, which: 27, bubbles: true }));
    return 'esc';
  })()`));
  await delay(300);
  console.log('art-closed:', await ev(`!document.querySelector('#eagle-artstation-import-host .import-modal.open')`));

  // ── 7d-3a 探查 ──
  console.log('itp-select:', await ev(`(() => {
    const body = window.$bodyScope;
    body.selected = [body.raw[0]];
    return JSON.stringify({ selected: body.selected.length, tags: body.raw[0].tags });
  })()`));
  console.log('itp-suggest:', await ev(`(() => {
    const body = window.$bodyScope;
    body.TagManager.getSuggestTags(body.selected);
    return JSON.stringify({ newTags: window.eagle.inspector.newTags, tagManagerType: typeof body.TagManager });
  })()`));
  console.log('itp-open:', await ev(`(() => { window.$bodyScope.$broadcast('INSPECTOR.TAG.SELECT.PANEL.OPEN'); return 'ok'; })()`));
  await delay(700);
  console.log('itp-state:', await ev(`(() => {
    const p = window.__eagleInspectorTagSelectPanel;
    if (!p) return 'missing';
    return JSON.stringify({ groups: p.listData.groups && p.listData.groups.length, items: p.listData.items && p.listData.items.length, newTags: window.eagle.inspector.newTags, selectedTags: p.listData.selectedTags, isInit: p.isInit });
  })()`));
  console.log('itp-dom:', await ev(`(() => {
    const items = Array.from(document.querySelectorAll('inspector-tag-select-panel .grid-item .list-item .name')).map((n) => n.textContent);
    return JSON.stringify(items.slice(0, 5));
  })()`));
  console.log('itp-tm:', await ev(`(() => {
    const body = window.$bodyScope;
    const tm = body.TagManager;
    return JSON.stringify({ suggest: typeof tm.getSuggestTags, tagsLen: tm.tags && tm.tags.length, tags: (tm.tags || []).map((t) => t.name).slice(0, 5), groups: tm.groups && tm.groups.length });
  })()`));
  console.log('itp-errors:', await ev(`(window.__errors || []).slice(0, 5)`));


  console.log('reactErr-after:', await ev(`window.__reactErr || 'none'`));
  console.log('consoleErrors:', JSON.stringify(await ev(`(window.__errors || []).slice(0, 6)`)));
  console.log('modalExists:', await ev(`!!document.querySelector('.batch-rename-modal')`));
  console.log('modalClass:', await ev(`(() => { const el = document.querySelector('.batch-rename-modal'); return el ? el.className : 'missing'; })()`));
  console.log('hostHtmlLen:', await ev(`document.getElementById('eagle-batch-rename-host') ? document.getElementById('eagle-batch-rename-host').innerHTML.length : -1`));
  console.log('headerName:', await ev(`(() => { const el = document.querySelector('#eagle-batch-rename-host .modal-header .name'); return el ? el.textContent : 'missing'; })()`));
  console.log('contract:', await ev(`(() => { const c = window.__eagleBatchRename; return c ? JSON.stringify({ isOpen: c.isOpen, previews: c.previews.length, items: c.items && c.items.length }) : 'missing'; })()`));
} finally {
  await stop(stack).catch(() => {});
  try { process.exit(0); } catch (err) {}
}
