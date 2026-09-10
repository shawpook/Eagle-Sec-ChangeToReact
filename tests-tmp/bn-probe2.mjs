// b1-9bn 探针2：BoxList 真实右键链路诊断（错误哨兵 + promise 状态）
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bn-p2-'));
fs.mkdirSync(path.join(tempRoot, 'libraries'), { recursive: true });
fs.writeFileSync(path.join(tempRoot, 'library-state.json'), JSON.stringify({ libraries: [] }));
process.env.EAGLE_MENU_SMOKE = '1';
const harnessPath = path.join(projectRoot, 'tests', 'react-cdp-harness.mjs').split(path.sep).join('/');
const { bootStack, stop } = await import('file:///' + harnessPath);
let stack;
try {
  const librariesRoot = path.join(tempRoot, 'libraries');
  const stateFile = path.join(tempRoot, 'library-state.json');
  const userDataDir = path.join(tempRoot, 'user-data');
  fs.mkdirSync(userDataDir, { recursive: true });
  stack = await bootStack({ librariesRoot, stateFile, userDataDir });
  const page = stack.page;
  await page.send('Runtime.enable');
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  await delay(3000);
  const r = await page.send('Runtime.evaluate', { expression: `(async function () {
    try {
      window.__bnErrors = [];
      window.addEventListener('unhandledrejection', (e) => { window.__bnErrors.push('rej: ' + String(e.reason).slice(0, 150)); });
      window.addEventListener('error', (e) => { window.__bnErrors.push('err: ' + String(e.message).slice(0, 150)); });
      const s = window.$bodyScope;
      const core = window.__eagleCoreFns;
      const img = (s.images || [])[0] || s.current;
      if (!img) return { ok: false, reason: 'no image' };
      // 单击选中（守卫要求 selected 含 target）
      if (typeof s.select === 'function') { try { s.select(img, { stopPropagation() {}, ctrlKey: false }); } catch (e2) {} }
      if (s.selected && s.selected.indexOf(img) === -1) s.selected = [img];
      window.__bnPayload = null;
      s.$on('CONTEXTMENU.OPEN', (_e, opts) => { window.__bnPayload = { count: opts && opts.items ? opts.items.length : 0 }; });
      const p = core.openItemContextMenu({ stopPropagation() {}, target: { tagName: 'DIV' }, preventDefault() {} }, img);
      await new Promise((res) => setTimeout(res, 2500));
      return {
        ok: !!window.__bnPayload,
        payload: window.__bnPayload,
        errors: window.__bnErrors.slice(0, 5),
        isPromise: !!p && typeof p.then === 'function',
        selIdx: s.selected.indexOf(img),
      };
    } catch (err) { return { ok: false, reason: 'throw: ' + (err && err.message), stack: String(err && err.stack).slice(0, 300) }; }
  })()`, returnByValue: true, awaitPromise: true });
  console.log('PROBE2', JSON.stringify(r.result.value, null, 1));
} finally { try { await stop(stack); } catch (err) {} }
