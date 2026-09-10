// b1-9bl probe3: fixture boot + full console/exception capture + module markers
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bl-p3-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });
const harnessPath = path.join(projectRoot, 'tests', 'react-cdp-harness.mjs').split(path.sep).join('/');
const { bootStack, stop } = await import('file:///' + harnessPath);
let stack;
const watchdog = setTimeout(() => { console.log('WATCHDOG'); process.exit(2); }, 150000);
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
      await post('/api/library/create', { name: 'BL Probe', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 640, height: 400, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      const tmp1 = path.join(librariesRoot, 'bl-a.png');
      const tmp2 = path.join(librariesRoot, 'bl-b.png');
      fs.writeFileSync(tmp1, png);
      fs.writeFileSync(tmp2, png);
      await post('/api/item/addFromPath', { paths: [tmp1] });
      await post('/api/item/addFromPath', { paths: [tmp2] });
    },
  });
  const { page } = stack;
  await page.send('Runtime.enable');
  const logs = [];
  page.on && page.on('Runtime.consoleAPICalled', (e) => {
    logs.push(String((e.text ?? '') + ' ' + (e.args || []).map(a => a.value ?? a.description ?? '').join(' ')).slice(0, 400));
  });
  page.on && page.on('Runtime.exceptionThrown', (e) => {
    const d = e.exceptionDetails || {};
    logs.push('EXC: ' + String((d.text || '') + ' ' + ((d.exception && (d.exception.description || d.exception.value)) || '')).slice(0, 600));
  });
  await new Promise((r) => setTimeout(r, 20000));
  const expr = `JSON.stringify({
    scope: typeof window.$bodyScope,
    bus: typeof window.__eagleBus,
    boxes: document.querySelectorAll('.box').length,
    hosts: !!document.getElementById('root'),
    engines: typeof window.ensureDetailZoom,
  })`;
  const state = await page.send('Runtime.evaluate', { expression: expr, returnByValue: true });
  console.log('STATE', state.result.value);
  console.log('LOGS_COUNT', logs.length);
  logs.slice(0, 14).forEach((l) => console.log('LOG:', l));
} finally {
  clearTimeout(watchdog);
  try { await stop(stack); } catch (err) {}
}
