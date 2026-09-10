// B5 二分定位快速探针：只验 allData/images 是否在启动后自动加载。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'b5probe-'));
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
    await post('/api/library/create', { name: 'B5Probe', savePath: path.join(tmp, 'libraries') });
    const sharp = (await import('sharp')).default;
    const png = await sharp({ create: { width: 640, height: 400, channels: 4, background: '#38bdf8' } }).png().toBuffer();
    const a = path.join(tmp, 'a.png');
    fs.writeFileSync(a, png);
    await post('/api/item/addFromPath', { paths: [a] });
  },
});

let verdict = 'UNKNOWN';
try {
  const page = stack.page;
  const ev = (e) => page.send('Runtime.evaluate', { expression: e, returnByValue: true });
  await waitFor(async () => (await ev('document.readyState')).result.value === 'complete', 'ready', 30000);
  await waitFor(async () => (await ev(`!!document.getElementById('main-app')`)).result.value, 'main-app', 45000);

  // 健康态：启动后 allData 自动加载到 1（fixture 1 张图）
  let all = -1;
  const t0 = Date.now();
  while (Date.now() - t0 < 25000) {
    const r = await ev(`(() => { const s = window.$bodyScope; if (!s || !s.allData) return -1; return s.allData.length; })()`);
    all = r.result.value;
    if (all > 0) break;
    await delay(500);
  }
  const img = (await ev(`(() => { const s = window.$bodyScope; return s && s.images ? s.images.length : -1; })()`)).result.value;
  const ms = Date.now() - t0;
  verdict = all > 0 ? 'LOAD_OK' : 'LOAD_BROKEN';
  console.log(`PROBE_RESULT ${verdict} allData=${all} images=${img} waited=${ms}ms`);
} catch (err) {
  console.log(`PROBE_RESULT HARNESS_ERR ${String(err && err.message).slice(0, 200)}`);
} finally {
  const guard = setTimeout(() => process.exit(verdict === 'LOAD_OK' ? 0 : 2), 20000);
  try { await stop(stack); } catch (e) {}
  clearTimeout(guard);
  process.exit(verdict === 'LOAD_OK' ? 0 : 2);
}
