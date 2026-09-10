/** bz-A 侧栏 DnD 探针 v2：HTMLElement.draggable setter 打点 + 时间采样，定位 effect cleanup 触发者 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';

const TRAP = [
  '(function(){',
  '  window.__D = [];',
  '  var desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "draggable");',
  '  if (desc && desc.set) {',
  '    Object.defineProperty(HTMLElement.prototype, "draggable", {',
  '      configurable: true,',
  '      get: function(){ return desc.get.call(this); },',
  '      set: function(v){',
  '        if (v === false && this.getAttribute && this.getAttribute("data-sidebar-kind")) {',
  '          window.__D.push({ id: this.id || "(no-id)", kind: this.getAttribute("data-sidebar-kind"), t: Date.now(), stack: String(new Error().stack).slice(0, 900) });',
  '        }',
  '        return desc.set.call(this, v);',
  '      }',
  '    });',
  '  }',
  '  window.__T0 = Date.now();',
  '})();',
].join('\n');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bzdnd2-'));
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
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: TRAP });
  await page.send('Page.reload', { ignoreCache: true });
  await delay(1200);
  await page.send('Runtime.enable');
  const evaluate = async (expression) => {
    const r = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.exception?.description?.slice(0, 300)}`);
    return r.result.value;
  };
  await waitFor(async () => (await evaluate(`document.readyState`)) === 'complete', 'ready', 60000);
  await waitFor(async () => (await evaluate(`!!window.$bodyScope`)) === true, 'scope', 60000);
  const tNodes = Date.now();
  await waitFor(async () => {
    const n = await evaluate(`document.querySelectorAll('[data-sidebar-kind="folder"]').length`);
    return typeof n === 'number' && n >= 3 ? n : null;
  }, 'sidebar nodes', 60000);

  for (const ms of [0, 300, 1000, 3000, 6000]) {
    if (ms) await delay(ms - (Date.now() - tNodes) > 0 ? ms : 0);
    const snap = await evaluate(`JSON.stringify({
      t: Date.now() - window.__T0,
      draggable: Array.from(document.querySelectorAll('[data-sidebar-kind="folder"]')).map(n => n.draggable),
      dragInit: Array.from(document.querySelectorAll('[data-sidebar-kind="folder"]')).map(n => !!n.__eagleDragInit),
      sidebarListLen: (window.$bodyScope && window.$bodyScope.sidebarList) ? window.$bodyScope.sidebarList.length : -1,
      listDone: !!(window.$bodyScope && window.$bodyScope.listDone),
    })`);
    console.log('SAMPLE@' + ms + ':', snap);
  }
  const d = await evaluate(`JSON.stringify((window.__D || []).map(x => ({ t: x.t - window.__T0, id: x.id, kind: x.kind, stack: x.stack })))`);
  console.log('DRAGGABLE_FALSE_EVENTS:', d);
} catch (err) {
  console.log('PROBE-FAIL:', err.message);
} finally {
  await stop(stack);
}
