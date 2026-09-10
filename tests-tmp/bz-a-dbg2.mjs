/** bz-A 微探针：直接执行 colorFilter/grayColorFilter 抓真实异常 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bzdbg2-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });

let stack;
try {
  stack = await bootStack({
    librariesRoot, stateFile, userDataDir,
    beforeElectron: async (apiPort) => {
      const post = async (route, body) => {
        const response = await fetch(`http://127.0.0.1:${apiPort}${route}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') throw new Error(`${route} failed: ${JSON.stringify(payload)}`);
        return payload.data;
      };
      await post('/api/library/create', { name: 'BzDbg2 Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      const tmp1 = path.join(librariesRoot, 'a.png');
      fs.writeFileSync(tmp1, png);
      await post('/api/item/addFromPaths', { paths: [tmp1] });
    },
  });
  const { page } = stack;
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', { expression: `document.readyState`, returnByValue: true });
    return r.result.value === 'complete';
  }, 'main window ready', 30000);
  await delay(12000);

  const r = await page.send('Runtime.evaluate', {
    expression: `(async () => {
      const s = window.$bodyScope;
      const out = {};
      out.pipeline = {
        colorDistancesMap: typeof s.colorDistancesMap,
        isItemBindCalculated: !!s.isItemBindCalculated,
        listDone: !!s.listDone,
        rawLen: s.raw ? s.raw.length : -1,
        wUrlState: typeof window.UrlStateService,
        sUrlState: typeof s.UrlStateService,
        openAll: typeof s.openAll,
        reload: typeof s.reload,
        viewMode: s.viewMode,
        currentFolderId: s.currentFolder && s.currentFolder.id,
      };
      // 手动驱动 openAll —— 验证 reload 链是否可达
      try { s.openAll(true); out.openAllCall = 'ok'; }
      catch (e) { out.openAllCall = 'THROW: ' + String(e && e.stack || e).slice(0, 300); }
      await new Promise(res => setTimeout(res, 1200));
      out.listDoneAfterOpenAll = !!s.listDone;
      window.electronLog = console;
      window.__errs = [];
      const origErr = console.error;
      console.error = function (...a) { window.__errs.push(String(a[0] && a[0].stack || a[0]).slice(0, 400)); origErr.apply(console, a); };
      // 逐步骤链测试
      for (const step of ['relayout', 'updateSelection', 'calculateFilterCounts', 'updateSubFolderWidth']) {
        try { s[step] && s[step](); out['step_' + step] = 'ok'; }
        catch (e) { out['step_' + step] = 'THROW: ' + String(e && e.stack || e).slice(0, 260); }
        await new Promise(res => setTimeout(res, 300));
      }
      try { await s.rebindRefresh(); out.step_rebindRefresh = 'ok'; }
      catch (e) { out.step_rebindRefresh = 'THROW: ' + String(e && e.stack || e).slice(0, 260); }
      await new Promise(res => setTimeout(res, 800));
      out.listDoneAfter = !!s.listDone;
      out.colorMapAfter = typeof s.colorDistancesMap;
      await 0;
      try {
        const rules = window.eagle.filter.filterRules.color;
        const prevValue = rules.value, prevAcc = rules.accuracy;
        rules.value = [255, 0, 0];
        if (rules.accuracy == null) rules.accuracy = 20;
        const img = { id: 'x1', palettes: [{ ratio: 40, color: [255, 0, 0] }] };
        try {
          out.colorFilterResult = s.colorFilter(img);
          out.dist = s.colorDistancesMap && s.colorDistancesMap['x1'];
        } catch (e) { out.colorFilterErr = String(e && e.stack || e).slice(0, 500); }
        try {
          out.grayResult = s.grayColorFilter({ id: 'g1', palettes: [{ ratio: 0.5, color: [100, 100, 100] }] });
        } catch (e) { out.grayErr = String(e && e.stack || e).slice(0, 500); }
        rules.value = prevValue; rules.accuracy = prevAcc;
        out.colorMapAfter = typeof s.colorDistancesMap;
      } catch (e) { out.outerErr = String(e && e.stack || e).slice(0, 300); }
      out.swallowed = window.__errs;
      return JSON.stringify(out);
    })()`, returnByValue: true, awaitPromise: true,
  });
  console.log('RESULT:', r.result.value);
} catch (err) {
  console.log('PROBE-FAIL:', err.message);
} finally {
  await stop(stack);
}
