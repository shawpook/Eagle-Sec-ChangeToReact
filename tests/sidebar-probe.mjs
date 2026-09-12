/** 一次性诊断：#sidebar 内部结构 + React 侧栏快照 + 运行时错误。 */
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { bootStack, stop, delay, waitFor } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-sidebar-probe-'));
fs.mkdirSync(path.join(tempRoot, 'libraries'), { recursive: true });
let stack;
try {
  stack = await bootStack({
    librariesRoot: path.join(tempRoot, 'libraries'),
    stateFile: path.join(tempRoot, 'library-state.json'),
    userDataDir: path.join(tempRoot, 'user-data'),
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
      await post('/api/library/create', { name: 'React Stage Library', savePath: path.join(tempRoot, 'libraries') });
      await post('/api/folder/create', { name: '设计参考' });
      await post('/api/v2/smartFolder/create', {
        name: '五星精选',
        conditions: [{ rules: [{ property: 'rating', method: 'equal', value: '5' }] }],
        description: '',
      });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 16, height: 10, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      const tmp1 = path.join(tempRoot, 'libraries', 'stage-a.png');
      fs.writeFileSync(tmp1, png);
      await post('/api/item/addFromPath', { paths: [tmp1] });
    },
  });
  const { page } = stack;
  const events = [];
  page.ws.addEventListener('message', (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        events.push(`[exception] ${d.text} ${d.exception?.description || ''}`.slice(0, 500));
      }
    } catch {}
  });

  await delay(1000);
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', {
      expression: `!!document.getElementById('main-app') && typeof window.eagle !== 'undefined' && !!document.getElementById('sidebar-item-container')`,
      returnByValue: true,
    });
    return r.result.value === true;
  }, 'app + sidebar boot', 60000);
  await delay(2000);
  const probe = await page.send('Runtime.evaluate', {
    expression: `(() => {
      const sidebar = document.getElementById('sidebar');
      const list = document.getElementById('sidebar-item-container');
      const snap = window.__eagleReactStore;
      return {
        sidebarExists: !!sidebar,
        sidebarChildren: sidebar ? sidebar.childElementCount : -1,
        sidebarHtmlHead: sidebar ? sidebar.innerHTML.slice(0, 300) : '',
        listExists: !!list,
        listChildren: list ? list.childElementCount : -1,
        sidebarWidth: sidebar ? sidebar.style.width : '',
        storeOk: typeof snap,
        bodyScope: typeof window.$bodyScope,
        angularScope: (() => { try { return typeof angular.element(document.body).scope(); } catch (e) { return 'ERR ' + e.message; } })(),
        sidebarListLen: (() => { try { const s = angular.element(document.body).scope(); return s && Array.isArray(s.sidebarList) ? s.sidebarList.length : 'no-list'; } catch (e) { return 'ERR'; } })(),
        libraryName: (() => { try { const s = angular.element(document.body).scope(); return s ? s.libraryName : null; } catch (e) { return 'ERR'; } })(),
        libraryPath: (() => { try { const s = angular.element(document.body).scope(); return s ? s.libraryPath : null; } catch (e) { return 'ERR'; } })(),
        vstypes: (() => { try { const s = angular.element(document.body).scope(); return s && Array.isArray(s.sidebarList) ? s.sidebarList.map(n => n.vstype).join(',') : '-'; } catch (e) { return 'ERR'; } })(),
        allCount: (() => { try { const s = angular.element(document.body).scope(); return s && Array.isArray(s.all) ? s.all.length : '-'; } catch (e) { return 'ERR'; } })(),
        folderListLen: (() => { try { const s = angular.element(document.body).scope(); return s && Array.isArray(s.folderList) ? s.folderList.length : '-'; } catch (e) { return 'ERR'; } })(),
        isUILoaded: (() => { try { const s = angular.element(document.body).scope(); return s ? !!s.isUILoaded : '-'; } catch (e) { return 'ERR'; } })(),
      };
    })()`,
    returnByValue: true,
  });
  console.log(JSON.stringify(probe.result.value, null, 2));
  console.log('--- exceptions ---');
  events.slice(-15).forEach((e) => console.log(e));
} finally {
  if (stack) {
    await stop(stack.electron);
    await stop(stack.vite);
    await stop(stack.backend);
  }
  try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
}
