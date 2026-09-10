// bz-B 诊断：起栈后动态 import 各入口，拿到真实加载错误 + 页面异常。
import { bootStack, stop, delay } from '../tests/react-cdp-harness.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bzdiag-'));
const stack = await bootStack({
  stateFile: path.join(tmp, 'state.json'),
  userDataDir: path.join(tmp, 'ud'),
});
const page = stack.page;
const ev = (expression) =>
  page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });

const MODULES = [
  '/src/app/react/main.tsx',
  '/src/app/react/core/dataMachinery.ts',
  '/src/app/react/core/filterDomain.ts',
  '/src/app/react/core/itemDomain.ts',
  '/src/app/react/core/miscDomain.ts',
  '/src/app/react/core/libraryDomain.ts',
  '/src/app/react/services/folderMenuService.ts',
  '/src/app/react/services/folderCoreService.ts',
  '/src/app/react/services/batchOpsService.ts',
  '/src/app/react/services/itemMenuService.ts',
  '/src/app/react/services/miscMenuService.ts',
  '/src/app/react/components/sidebar/Sidebar.tsx',
  '/src/app/react/components/filter/FilterItems2.tsx',
  '/src/app/react/hooks.ts',
];

try {
  await delay(9000);
  for (const mod of MODULES) {
    try {
      const r = await ev(
        `(async () => { try { const m = await import(${JSON.stringify(mod)});
            return 'OK keys=' + Object.keys(m).length; }
            catch (e) { return 'ERR ' + String((e && (e.stack || e.message)) || e); } })()`
      );
      const v = String((r.result && r.result.value) || (r.exceptionDetails && r.exceptionDetails.text) || r);
      console.log('%-46s %s', mod.replace('/src/app/react/', ''), v.slice(0, 300).replace(/\n/g, ' | '));
    } catch (e) {
      console.log('%-46s EVAL-FAIL %s', mod.replace('/src/app/react/', ''), e.message.slice(0, 120));
    }
  }
  console.log('\n=== 页面状态 ===');
  for (const expr of ['document.readyState', 'typeof window.eagle',
    "!!document.getElementById('eagle-react-host')",
    'JSON.stringify(Object.keys(window.eagle||{}).slice(0,10))']) {
    try {
      const r = await ev(expr);
      console.log('  %s => %s', expr.padEnd(44), JSON.stringify(r.result && r.result.value));
    } catch (e) { console.log('  %s => ERR', expr); }
  }
  const dump = [];
  for (const e of page.events || []) {
    if (e.method === 'Runtime.exceptionThrown') {
      const d = e.params.exceptionDetails || {};
      dump.push('EXCEPTION: ' + String((d.exception && d.exception.description) || d.text || '').slice(0, 800));
    } else if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') {
      dump.push('CONSOLE.ERROR: ' + (e.params.args || []).map((a) => a.description || a.value || '').join(' ').slice(0, 500));
    }
  }
  console.log('\n=== 异常 %d 条 ===', dump.length);
  const seen = new Set();
  for (const line of dump) {
    const k = line.slice(0, 100);
    if (seen.has(k)) continue;
    seen.add(k);
    console.log('---\n' + line);
  }
} finally {
  await stop(stack);
}
