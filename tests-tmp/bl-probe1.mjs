// b1-9bl probe1: grid-render timeout diagnosis (console capture before scope)
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bl-p1-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.writeFileSync(stateFile, JSON.stringify({ libraries: [] }));
const harnessPath = path.join(projectRoot, 'tests', 'react-cdp-harness.mjs').split(path.sep).join('/');
const { bootStack, stop } = await import('file:///' + harnessPath);
let stack;
const watchdog = setTimeout(() => { console.log('WATCHDOG'); process.exit(2); }, 120000);
try {
  stack = await bootStack({ librariesRoot, stateFile, userDataDir });
  const { page } = stack;
  await page.send('Runtime.enable');
  await page.send('Log.enable').catch(() => {});
  const logs = [];
  const collect = (e) => { logs.push(String((e.text ?? '') + ' ' + (e.args || []).map(a => a.value ?? a.description ?? '').join(' ')).slice(0, 400)); };
  page.on && page.on('Runtime.consoleAPICalled', collect);
  page.on && page.on('Runtime.exceptionThrown', (e) => logs.push('EXC: ' + JSON.stringify(e.exceptionDetails).slice(0, 600)));
  await new Promise((r) => setTimeout(r, 15000));
  const state = await page.send('Runtime.evaluate', { expression: 'JSON.stringify({scope: typeof window.$bodyScope, core: typeof window.__eagleCoreFns, ready: document.readyState})', returnByValue: true });
  console.log('STATE', state.result.value);
  console.log('LOGS_COUNT', logs.length);
  logs.filter((l) => /error|Error|EXC|fail|Cannot|not defined|undefined/i.test(l)).slice(0, 12).forEach((l) => console.log('LOG:', l));
} finally {
  clearTimeout(watchdog);
  try { await stop(stack); } catch (err) {}
}
