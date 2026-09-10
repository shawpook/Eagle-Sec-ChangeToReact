// C-0 探针：复现 main-ui 的 "original main scope" 等待条件，抓真实异常。
// 检查 $bodyScope.raw 是否数组 + listDone 是否置位，并收集页面异常。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c0probe-'));
const stack = await bootStack({
  librariesRoot: (fs.mkdirSync(path.join(tmp, 'libraries'), { recursive: true }), path.join(tmp, 'libraries')),
  stateFile: path.join(tmp, 'state.json'),
  userDataDir: path.join(tmp, 'ud'),
  beforeElectron: async (apiPort) => {
    const post = async (route, body) => {
      const r = await fetch(`http://127.0.0.1:${apiPort}${route}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return (await r.json()).data;
    };
    await post('/api/library/create', { name: 'C0Probe', savePath: path.join(tmp, 'libraries') });
    const sharp = (await import('sharp')).default;
    for (const [i, c] of ['#38bdf8', '#f97316'].entries()) {
      const png = await sharp({ create: { width: 640, height: 400, channels: 4, background: c } }).png().toBuffer();
      const p = path.join(tmp, `p${i}.png`);
      fs.writeFileSync(p, png);
      await post('/api/item/addFromPath', { paths: [p] });
    }
  },
});

const errors = [];
let verdict = 'UNKNOWN';
try {
  const page = stack.page;
  if (typeof page.on === 'function') {
    try {
      await page.send('Runtime.enable');
    } catch (e) {}
    page.on('Runtime.exceptionThrown', (p) => {
      const d = p.exceptionDetails || {};
      errors.push('EXC: ' + String((d.exception && d.exception.description) || d.text || '').slice(0, 300));
    });
    page.on('Runtime.consoleAPICalled', (p) => {
      if (p.type === 'error') {
        errors.push('CONSOLE: ' + (p.args || []).map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300));
      }
    });
  }
  const ev = (e) => page.send('Runtime.evaluate', { expression: e, returnByValue: true });
  await waitFor(async () => (await ev('document.readyState')).result.value === 'complete', 'ready', 30000);
  await waitFor(async () => (await ev(`!!document.getElementById('main-app')`)).result.value, 'main-app', 45000);

  const snap = async () => {
    const r = await ev(`(() => {
      const s = window.$bodyScope;
      if (!s) return { none: true };
      return {
        rawIsArray: Array.isArray(s.raw),
        rawLen: Array.isArray(s.raw) ? s.raw.length : -1,
        listDone: !!s.listDone,
        allData: s.allData ? s.allData.length : -1,
        images: s.images ? s.images.length : -1,
      };
    })()`);
    return r.result.value;
  };

  let last = {};
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    last = await snap();
    if (last.rawIsArray && last.listDone) break;
    await delay(700);
  }
  const ms = Date.now() - t0;
  verdict = (last.rawIsArray && last.listDone) ? 'SCOPE_OK' : 'SCOPE_BROKEN';
  console.log(`PROBE_RESULT ${verdict} ${JSON.stringify(last)} waited=${ms}ms`);
  if (errors.length) {
    console.log('--- 页面异常 (前 12 条) ---');
    for (const e of errors.slice(0, 12)) console.log('  ' + e.replace(/\n/g, ' | '));
  } else {
    console.log('--- 未捕获到页面异常 ---');
  }
} catch (err) {
  console.log(`PROBE_RESULT HARNESS_ERR ${String(err && err.message).slice(0, 300)}`);
} finally {
  const guard = setTimeout(() => process.exit(0), 20000);
  try { await stop(stack); } catch (e) {}
  clearTimeout(guard);
  process.exit(verdict === 'SCOPE_OK' ? 0 : 2);
}
