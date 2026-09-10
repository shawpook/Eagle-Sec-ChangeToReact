// C-0：确认 externalSupply 注册是否完成
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c0sup-'));
const stack = await bootStack({
  librariesRoot: (fs.mkdirSync(path.join(tmp, 'libraries'), { recursive: true }), path.join(tmp, 'libraries')),
  stateFile: path.join(tmp, 'state.json'),
  userDataDir: path.join(tmp, 'ud'),
});
try {
  const page = stack.page;
  const ev = (e) => page.send('Runtime.evaluate', { expression: e, returnByValue: true });
  await waitFor(async () => (await ev('document.readyState')).result.value === 'complete', 'ready', 30000);
  await waitFor(async () => (await ev(`!!document.getElementById('main-app')`)).result.value, 'main-app', 45000);
  await delay(4000);
  const r = await ev(`(() => {
    const s = window.$bodyScope;
    return {
      bodyScope: !!s,
      supplyKeys: Object.keys(window.__eagleExternalSupply || {}).length,
      supplyState: window.__eagleSupplyState || 'none',
      addImagesToFolder: typeof (s && s.addImagesToFolder),
      changeStar: typeof (s && s.changeStar),
      tagManager: typeof (s && s.TagManager),
      addTags: typeof (s && s.TagManager && s.TagManager.addTags),
    };
  })()`);
  console.log('SUPPLY_RESULT ' + JSON.stringify(r.result.value));
} catch (e) {
  console.log('SUPPLY_ERR ' + String(e && e.message).slice(0, 200));
} finally {
  const g = setTimeout(() => process.exit(0), 15000);
  try { await stop(stack); } catch (e) {}
  clearTimeout(g);
  process.exit(0);
}
