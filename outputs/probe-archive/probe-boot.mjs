/** 最小启动探针：抓取 React 挂载期错误。 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-probe-boot-'));
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
      await post('/api/library/create', { name: 'Probe Boot', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 'probe.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 'probe.png')] });
    },
  });
  const { page } = stack;
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: "window.__errors = []; const __ce = console.error; console.error = function(...a) { try { window.__errors.push(String((a[0] && a[0].stack) || a[0]).slice(0, 500)); } catch (e) {} __ce.apply(console, a); };",
  });
  const ev = async (expression) => (await page.send('Runtime.evaluate', { expression, returnByValue: true })).result.value;
  await waitFor(async () => (await ev(`document.readyState`)) === 'complete', 'ready', 30000);
  await waitFor(async () => (await ev(`!!document.getElementById('main-app')`)), 'main-app', 45000);
  await delay(3000);

  console.log('reactErr:', await ev(`window.__reactErr || 'none'`));
  console.log('errors:', JSON.stringify(await ev(`(window.__errors || []).slice(0, 6)`)));
  console.log('boxes:', await ev(`document.querySelectorAll('#box-list .box').length`));
  console.log('hosts:', await ev(`JSON.stringify(['eagle-duplicate-scan-panel-host','eagle-duplicate-modal-host'].map((id) => { const el = document.getElementById(id); return el ? el.innerHTML.length : -1; }))`));
} catch (err) {
  console.error('PROBE ERROR:', err && err.stack || err);
  process.exitCode = 1;
} finally {
  await stop(stack).catch(() => {});
  try { process.exit(process.exitCode || 0); } catch (err) {}
}
