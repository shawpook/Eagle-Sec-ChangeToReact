// b1-9be2 probe2: why didn't v4 lay out — react errors + grid instance internals
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-be2-p2-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });
const harnessPath = path.join(projectRoot, 'tests', 'react-cdp-harness.mjs').split(path.sep).join('/');
const { bootStack, stop } = await import('file:///' + harnessPath);
const watchdog = setTimeout(() => { console.log('WATCHDOG'); process.exit(2); }, 150000);
let stack;
try {
  stack = await bootStack({
    librariesRoot, stateFile, userDataDir,
    beforeElectron: async (apiPort) => {
      const post = async (route, body) => {
        const response = await fetch(`http://127.0.0.1:${apiPort}${route}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') throw new Error(`${route} failed`);
        return payload.data;
      };
      await post('/api/library/create', { name: 'BE2 P2', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 640, height: 400, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      for (let i = 0; i < 12; i++) {
        const tmp = path.join(librariesRoot, `be2-${i}.png`);
        fs.writeFileSync(tmp, png);
        await post('/api/item/addFromPath', { paths: [tmp] });
      }
    },
  });
  const { page } = stack;
  await page.send('Runtime.enable');
  const logs = [];
  page.on && page.on('Runtime.consoleAPICalled', (e) => {
    logs.push(String((e.text ?? '') + ' ' + (e.args || []).map(a => a.value ?? a.description ?? '').join(' ')).slice(0, 300));
  });
  page.on && page.on('Runtime.exceptionThrown', (e) => {
    const d = e.exceptionDetails || {};
    logs.push('EXC: ' + String((d.text || '') + ' ' + ((d.exception && (d.exception.description || d.exception.value)) || '')).slice(0, 500));
  });
  await new Promise((r) => setTimeout(r, 14000));
  const expr = `JSON.stringify({
    reactErr: window.__reactErr || null,
    boxCount: document.querySelectorAll('.box').length,
    boxListHTMLHead: (document.getElementById('box-list') || {}).innerHTML ? document.getElementById('box-list').innerHTML.slice(0, 200) : null,
    boxContainerOverflow: (() => { const c = document.getElementById('box-container'); const cs = getComputedStyle(c); return cs.overflow + '/' + cs.overflowY + '/' + cs.overflowX; })(),
    scrollH: document.getElementById('box-container').scrollHeight,
    clientH: document.getElementById('box-container').clientHeight,
    groupKeys: [...document.querySelectorAll('.box')].slice(0, 3).map(el => el.getAttribute('data-grid-groupkey')),
    igFacadeType: typeof window.ig,
  })`;
  const r = await page.send('Runtime.evaluate', { expression: expr, returnByValue: true });
  console.log('BE2P2', r.result.value);
  console.log('LOGS:', logs.filter(l => /error|Error|EXC|warn/i.test(l)).slice(0, 8).join(' || ') || '(none)');
} finally {
  clearTimeout(watchdog);
  try { await Promise.race([stop(stack), new Promise((r) => setTimeout(r, 8000))]); } catch (err) {}
}
process.exit(0);
