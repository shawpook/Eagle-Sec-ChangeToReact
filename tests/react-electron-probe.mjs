/**
 * Electron regression-host 专用探针：抓 page URL + console/error 事件 + 关键全局状态。
 */
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { bootStack, stop, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-probe-'));
let stack;
try {
  stack = await bootStack({
    librariesRoot: path.join(tempRoot, 'libraries'),
    stateFile: path.join(tempRoot, 'library-state.json'),
    userDataDir: path.join(tempRoot, 'user-data'),
  });
  const { page } = stack;

  const events = [];
  page.ws.addEventListener('message', (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const args = (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
        events.push(`[console.${msg.params.type}] ${args}`);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        events.push(`[exception] ${d.text} ${d.exception?.description || ''} @${d.url || ''}:${d.lineNumber}`);
      } else if (msg.method === 'Log.entryAdded') {
        events.push(`[log.${msg.params.entry.level}] ${msg.params.entry.text} ${msg.params.entry.url || ''}`);
      }
    } catch {}
  });

  await delay(8000);

  const probe = await page.send('Runtime.evaluate', {
    expression: `(() => ({
      url: location.href,
      reactHost: !!document.getElementById('eagle-react-host'),
      store: typeof window.__eagleReactStore,
      eagle: typeof window.eagle,
      eagleInspector: typeof window.eagle?.inspector,
      i18n: typeof window.i18n,
      electronSettings: typeof window.electronSettings,
      eagleDesktop: typeof window.eagleDesktop,
      require: typeof window.require,
      bodyScope: typeof window.$bodyScope,
      mainApp: !!document.getElementById('main-app'),
      bodyClass: document.body.className,
      bodyTheme: document.body.getAttribute('theme'),
    }))()`,
    returnByValue: true,
  });
  console.log('PROBE:', JSON.stringify(probe.result.value, null, 2));
  console.log('--- events (last 40) ---');
  for (const line of events.slice(-40)) console.log(line);
} finally {
  if (stack) {
    await stop(stack.electron);
    await stop(stack.vite);
    await stop(stack.backend);
  }
  try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
}
