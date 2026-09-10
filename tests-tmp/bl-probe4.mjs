// b1-9bl probe4: read vite-error-overlay + resource failures inside the page
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bl-p4-'));
const harnessPath = path.join(projectRoot, 'tests', 'react-cdp-harness.mjs').split(path.sep).join('/');
const { bootStack, stop } = await import('file:///' + harnessPath);
const watchdog = setTimeout(() => { console.log('WATCHDOG'); process.exit(2); }, 150000);
let stack;
try {
  stack = await bootStack({
    librariesRoot: path.join(tempRoot, 'libraries'),
    stateFile: path.join(tempRoot, 'library-state.json'),
    userDataDir: path.join(tempRoot, 'user-data'),
  });
  const { page } = stack;
  await new Promise((r) => setTimeout(r, 12000));
  const expr = `(() => {
    const ov = document.querySelector('vite-error-overlay');
    const msg = ov && ov.shadowRoot ? ov.shadowRoot.textContent : null;
    return JSON.stringify({
      overlay: msg ? msg.slice(0, 1500) : null,
      scripts: [...document.querySelectorAll('script[type=module]')].map(s => s.src).slice(0, 3),
    });
  })()`;
  const r = await page.send('Runtime.evaluate', { expression: expr, returnByValue: true });
  console.log('PAGE', r.result.value);
  // 主窗模块请求重放：看转换器对链上模块的响应码
  const vitePort = stack.vitePort;
  for (const m of ['/src/app/react/main.tsx', '/src/app/react/global/scopeBridge.ts', '/src/app/react/core/dataMachinery.ts']) {
    try {
      const res = await fetch(`http://127.0.0.1:${vitePort}${m}`);
      console.log(res.status, m);
      if (!res.ok) console.log((await res.text()).slice(0, 500));
    } catch (e) { console.log('FAIL', m, String(e).slice(0, 100)); }
  }
} finally {
  clearTimeout(watchdog);
  try { await Promise.race([stop(stack), new Promise((r) => setTimeout(r, 8000))]); } catch (err) {}
}
process.exit(0);
