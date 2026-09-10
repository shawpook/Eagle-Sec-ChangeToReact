import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';

// 7c welcome-open 失败诊断：R1 后 emit app-status-welcome 的三个断言条件逐项检查
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-welcome-diag-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });

let stack;
let failure = null;
const watchdog = setTimeout(() => { console.log('DIAG_WATCHDOG'); process.exit(2); }, 240000);

try {
  stack = await bootStack({
    librariesRoot, stateFile, userDataDir,
    beforeElectron: async (apiPort) => {
      const response = await fetch(`http://127.0.0.1:${apiPort}/api/library/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Diag', savePath: librariesRoot }) });
      await response.json();
    },
  });
  const { page } = stack;
  const sendT = async (method, params, ms = 12000) => {
    const r = await Promise.race([
      page.send(method, params),
      new Promise((resolve) => setTimeout(() => resolve({ __timeout: method }), ms)),
    ]);
    if (r && r.__timeout) throw new Error(`CDP timeout: ${method}`);
    return r;
  };
  const evaluate = async (expression) => {
    const r = await sendT('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) return { __evalError: r.exceptionDetails.exception?.description?.slice(0, 200) };
    return r.result.value;
  };
  await sendT('Runtime.enable');
  await waitFor(async () => (await evaluate(`document.readyState`)) === 'complete', 'ready', 60000);
  await waitFor(async () => (await evaluate(`!!window.$bodyScope`)) === true, 'scope', 60000);
  await delay(2500);

  console.log('DIAG_PRE', JSON.stringify(await evaluate(`(() => ({
    eagleIpc: typeof window.__eagleIpc,
    hasHost: !!document.getElementById('eagle-welcome-host'),
    welcomePage: !!document.getElementById('welcome-page'),
    bodyCls: document.body.className.slice(0, 120),
  }))()`)));

  const emitResult = await evaluate(`(() => {
    try {
      window.__diag = { adds: [], removes: [], busFired: false, sets: [] };
      const origAdd = document.body.classList.add.bind(document.body.classList);
      document.body.classList.add = function (...a) { window.__diag.adds.push(a.join(' ')); return origAdd(...a); };
      const origRemove = document.body.classList.remove.bind(document.body.classList);
      document.body.classList.remove = function (...a) { window.__diag.removes.push(a.join(' ')); return origRemove(...a); };
      window.__eagleIpc.on('app-status-welcome', () => { window.__diag.busFired = true; });
      window.__eagleBodyState.subscribe((st, prev) => {
        const changed = Object.keys(st).filter((k) => st[k] !== prev[k]);
        window.__diag.sets.push({ at: Date.now() % 100000, changed: changed.slice(0, 6) });
      });
      const origSet = window.__eagleBodyState.setState.bind(window.__eagleBodyState);
      window.__eagleBodyState.setState = function (...a) {
        window.__diag.stacks = window.__diag.stacks || [];
        if (window.__diag.stacks.length < 3) window.__diag.stacks.push(new Error().stack.split(String.fromCharCode(10)).slice(2, 6).join(' ~ ').slice(0, 420));
        return origSet(...a);
      };
      window.__eagleIpc.emit('app-status-welcome', {});
      return 'emitted';
    } catch (err) { return 'emit-error: ' + String(err && err.message).slice(0, 120); }
  })()`);
  console.log('DIAG_EMIT', emitResult);
  await delay(1200);

  console.log('DIAG_POST', JSON.stringify(await evaluate(`(() => ({
    diag: window.__diag,
    welcomePage: !!document.getElementById('welcome-page'),
    display: document.getElementById('welcome-page') ? document.getElementById('welcome-page').style.display : null,
    cls: document.body.classList.contains('is-welcome-page'),
    viewMode: window.$bodyScope.viewMode,
    storeViewMode: window.__eagleBodyState ? window.__eagleBodyState.getState().viewMode : 'no-store',
  }))()`)));
  console.log('DIAG_OK');
} catch (err) {
  failure = err;
  console.error(`DIAG_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
