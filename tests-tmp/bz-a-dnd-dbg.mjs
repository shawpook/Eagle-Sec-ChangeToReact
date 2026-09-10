/** bz-A 侧栏 DnD 探针：复刻 react-s2-sidebar-dnd 起点 + 异常捕获，定位 dragstart 未生效 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bzdnd-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });

let stack;
let folderIds = {};
try {
  stack = await bootStack({
    librariesRoot, stateFile, userDataDir,
    beforeElectron: async (apiPort) => {
      const post = async (route, body) => {
        const response = await fetch(`http://127.0.0.1:${apiPort}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') throw new Error(`${route}: ${JSON.stringify(payload)}`);
        return payload.data;
      };
      await post('/api/library/create', { name: 'Sidebar DnD', savePath: librariesRoot });
      const folderId = async (name) => {
        const data = await post('/api/folder/create', { name });
        return (data && data.id) || (data && data.folder && data.folder.id) || data;
      };
      folderIds.alpha = await folderId('DnD Alpha');
      folderIds.beta = await folderId('DnD Beta');
      folderIds.gamma = await folderId('DnD Gamma');
    },
  });
  const { page } = stack;
  const evaluate = async (expression) => {
    const r = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.exception?.description?.slice(0, 300)}`);
    return r.result.value;
  };
  await waitFor(async () => (await evaluate(`document.readyState`)) === 'complete', 'ready', 60000);
  await waitFor(async () => (await evaluate(`!!window.$bodyScope`)) === true, 'scope', 60000);
  await waitFor(async () => {
    const n = await evaluate(`document.querySelectorAll('[data-sidebar-kind="folder"]').length`);
    return typeof n === 'number' && n >= 3 ? n : null;
  }, 'sidebar nodes', 60000);
  await delay(2000);

  // 装错误捕获
  await evaluate(`(() => {
    window.__E = [];
    window.addEventListener('error', (e) => window.__E.push('onerror: ' + (e.error && e.error.stack || e.message)), true);
    window.addEventListener('unhandledrejection', (e) => window.__E.push('rej: ' + (e.reason && e.reason.stack || String(e.reason))));
    const oe = console.error;
    console.error = function (...a) { window.__E.push('console: ' + String(a[0] && a[0].stack || a[0]).slice(0, 400)); oe.apply(console, a); };
    return 'ok';
  })()`);

  const info = await evaluate(`(() => {
    const nodes = Array.from(document.querySelectorAll('[data-sidebar-kind="folder"]'));
    const out = { nodeCount: nodes.length, dragInit: nodes.map(n => !!n.__eagleDragInit), draggable: nodes.map(n => n.draggable) };
    const el = document.getElementById('folder-${folderIds.alpha}');
    out.targetFound = !!el;
    if (el) {
      out.targetIsNode = el.hasAttribute('data-sidebar-kind');
      out.targetKind = el.getAttribute('data-sidebar-kind');
      out.targetId = el.id;
      out.parentChain = (function () {
        const chain = []; let p = el;
        while (p && chain.length < 6) { chain.push((p.tagName || '') + (p.id ? '#' + p.id : '') + (p.hasAttribute && p.hasAttribute('data-sidebar-kind') ? '[kind=' + p.getAttribute('data-sidebar-kind') + ']' : '')); p = p.parentElement; }
        return chain;
      })();
    }
    out.bodyScope = !!window.$bodyScope;
    return JSON.stringify(out);
  })()`);
  console.log('INFO:', info);

  // 直接调用 onDragStart 的等价路径：手动派发事件并抓异常
  const res = await evaluate(`(async () => {
    const out = {};
    const el = document.getElementById('folder-${folderIds.alpha}');
    if (!el) { out.err = 'no target'; return JSON.stringify(out); }
    let fired = false;
    const probe = (ev) => { fired = true; };
    el.addEventListener('dragstart', probe, true);
    try {
      el.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }));
      out.dispatched = 'ok';
    } catch (e) { out.dispatched = 'THROW ' + String(e && e.stack || e).slice(0, 500); }
    await new Promise(r => setTimeout(r, 400));
    out.listenerFired = fired;
    out.dragCheck = window.dragCheck;
    out.helper = !!document.querySelector('body > .multiple-drag-folder-helper');
    const s = window.$bodyScope;
    out.dragged = s && s.$root && s.$root.draggedFolders ? s.$root.draggedFolders.map(f => f && f.id) : 'none';
    out.findLive = (function () { try { return typeof window.__findLiveNode; } catch (e) { return 'err'; } })();
    out.errs = (window.__E || []).slice(0, 10);
    return JSON.stringify(out);
  })()`);
  console.log('DRAG:', res);

  const ev = (stack.page.events || []).filter((m) => m.method === 'Runtime.exceptionThrown' || (m.method === 'Runtime.consoleAPICalled' && m.params && m.params.type === 'error'));
  console.log('EVENTS:', JSON.stringify(ev.slice(-20).map((m) => m.method === 'Runtime.exceptionThrown'
    ? 'EXC ' + JSON.stringify(m.params.exceptionDetails && (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text)).slice(0, 400)
    : 'ERR ' + JSON.stringify(m.params.args && m.params.args[0] && (m.params.args[0].description || m.params.args[0].value)).slice(0, 300))));
} catch (err) {
  console.log('PROBE-FAIL:', err.message);
} finally {
  await stop(stack);
}
