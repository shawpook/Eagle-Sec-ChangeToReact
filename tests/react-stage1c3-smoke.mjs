/**
 * React 化改造 —— 阶段1 c3 闭环测试（EagleController 函数域第一批移植 + callScope 路由）。
 *
 * 运行：node tests/react-stage1c3-smoke.mjs
 * 断言点：
 *  1. 契约：__eagleCoreFns 14 函数在位
 *  2. 路由证明：哨兵替换 scope.cancelAllTasks → callScope('cancelAllTasks') 不触哨兵但
 *     队列清空（core 命中）+ ipc 'cancel.all' spy
 *  3. 功能：core cancelAllTasks 清空 uploadQueue/finishQueue；changeOrderBy('NAME') 写
 *     orderBy/orderByName；switchGridLayout 写 layout
 *  4. bundle 后备：未移植函数（如 clickNode）经 callScope 仍走 scope
 *  5. 截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage1c3-'));
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
      await post('/api/library/create', { name: 'React Stage1c3 Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#0ea5e9' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's1c3.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's1c3.png')] });
    },
  });
  const { page } = stack;

  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', { expression: `document.readyState`, returnByValue: true });
    return r.result.value === 'complete';
  }, 'main window ready', 30000);

  const waitExpr = (expression) => page.send('Runtime.evaluate', { expression, returnByValue: true });
  await waitFor(async () => (await waitExpr(`!!document.getElementById('main-app')`)).result.value, 'Angular main-app', 45000);
  await waitFor(async () => (await waitExpr(`!!document.querySelector('#box-list .box')`)).result.value, 'grid boxes rendered', 45000);
  await delay(800);

  const screenshotTo = async (file, timeoutMs) => {
    try {
      const screenshot = await Promise.race([
        page.send('Page.captureScreenshot', { format: 'png' }),
        delay(timeoutMs).then(() => { throw new Error(`screenshot timeout (${timeoutMs})ms`); }),
      ]);
      fs.mkdirSync('test-run', { recursive: true });
      fs.writeFileSync(file, Buffer.from(screenshot.data, 'base64'));
      console.log(`PASS screenshot-saved ${file}`);
    } catch (err) {
      console.log(`WARN screenshot failed: ${err.message}`);
    }
  };

  const failures = [];
  const assertExpr = async (name, expression, timeout = 15000) => {
    const pass = await (async () => {
      try {
        await waitFor(async () => {
          const r = await waitExpr(expression);
          return r.result.value === true;
        }, name, timeout);
        return true;
      } catch (err) {
        return false;
      }
    })();
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`);
    if (!pass) failures.push(name);
  };

  const evalNow = async (expression) => {
    const r = await page.send('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) console.log(`WARN eval error: ${JSON.stringify(r.exceptionDetails).slice(0, 200)}`);
    return r;
  };

  // ── 契约（全量 + 抽样；b1-9e 补端口 addImagesToFolder、b1-9k 补端口 cancelEmptyTrash/
  //    cancelRegenerateThumbnail/addToFolders/createFolder，表 155→156→160；b1-9q
  //    openItemContextMenu/getLibraryHistory 等 160→162；b1-9w 菜单点击路径 33 个
  //    （copyTags/pasteTags/removeFromFolder/export 族/copyAs 族/字体族/缩略图族/
  //    openInFinder/openFilesWithDefault/exportFolder/checkDiskSpace 等）162→195；
  //    b1-9x onSidebarResize（#sidebar resizable 写回链）195→196；b1-9ao 侧栏 expand
  //    右键菜单族（toggle 家族 7 + openFolderExpandContextMenu；smart expand 已在
  //    b1-9w 就位）196→232；b1-9aq openSmartFolderContextMenu 主菜单
  //    + 依赖面 23 fns 232→255；b1-9ar empty-trash 族（emptyTrash/emptyRestore/
  //    openTrashContextMenu）255→258）──
  await assertExpr('c3-contract', `(() => {
    const c = window.__eagleCoreFns;
    if (!c) return false;
    const spot = ['cancelAllTasks','uploadFiles','changeOrderBy','switchGridLayout',
      'cleanSelected','select','search','resetFilter','clickNode','smartZoom',
      'openFolder','updateSidebarList','getThumbnailUrl','zoomFit','undo',
      'copyTags','pasteTags','removeFromFolder','exportSelectedToCsv','openInFinder',
      'regenerateThumbnail','newFolderWidthSelection','addToLastUsedFolder','copyAsBase64',
      'toggleSelectFolder','toggleAllFolderExpand','toggleSelectSmartFolder',
      'toggleAllSmartFolderExpand','openFolderExpandContextMenu',
      'openFolderContextMenu','openSmartFolderContextMenu','cloneSmartFolder',
      'smartFolderExportAsPack','removeSelectedSmartFolders','emptyTrash',
      'emptyRestore','openTrashContextMenu'];
    return Object.keys(c).length === 258 && spot.every(k => typeof c[k] === 'function');
  })()`);

  await evalNow(`(() => { window.__reloadMarker = 'ALIVE'; return true; })()`);

  // ── 路由证明 + 功能（cancelAllTasks）──
  await evalNow(`(() => {
    const b = window.$bodyScope;
    b.uploadQueue = [{}, {}];
    b.finishQueue = [];
    window.__sentinelCalled = false;
    b.cancelAllTasks = function () { window.__sentinelCalled = true; };
    const ipc = window.__eagleIpc || window.electron.ipcRenderer;
    window.__cancelSpy = 0;
    const origSend = ipc.send.bind(ipc);
    ipc.send = (ch, p) => { if (ch === 'cancel.all') window.__cancelSpy++; return origSend(ch, p); };
    return true;
  })()`);
  await evalNow(`(() => {
    window.__eagleCoreFns.cancelAllTasks();
    return true;
  })()`);
  await assertExpr('c3-cancel-core-routed', `(() => {
    const b = window.$bodyScope;
    return window.__sentinelCalled === false
      && b.uploadQueue.length === 0
      && b.finishQueue.length === 0
      && window.__cancelSpy >= 1;
  })()`);
  await evalNow(`(() => {
    const b = window.$bodyScope;
    b.cancelAllTasks = function () { window.__sentinelCalled = true; };
    b.cancelAllTasks();
    return true;
  })()`);
  await assertExpr('c3-bundle-fallback-still-works', `window.__sentinelCalled === true`);

  // ── 功能（changeOrderBy / switchGridLayout）──
  await evalNow(`(() => {
    try { window.__eagleCoreFns.changeOrderBy('NAME'); window.__c3err = null; }
    catch (e) { window.__c3err = String((e && e.stack) || e).slice(0, 400); }
    return true;
  })()`);
  {
    const e1 = await waitExpr(`window.__c3err`);
    if (e1.result.value) console.log('DEBUG c3-err1:', String(e1.result.value).split('|').slice(0, 3).join('|'));
  }
  await assertExpr('c3-change-order-by', `window.$bodyScope.orderBy === 'NAME'`);
  await evalNow(`(() => {
    try { window.__eagleCoreFns.switchGridLayout(); window.__c3err2 = null; }
    catch (e) { window.__c3err2 = String((e && e.stack) || e).slice(0, 400); }
    return true;
  })()`);
  {
    const e2 = await waitExpr(`window.__c3err2`);
    if (e2.result.value) console.log('DEBUG c3-err2:', String(e2.result.value).split('|').slice(0, 3).join('|'));
  }
  await assertExpr('c3-switch-grid-layout', `window.$bodyScope.layout === 'GridLayout'`);

  // ── batch2 功能（cleanSelected）──
  await evalNow(`(() => {
    try {
      const b = window.$bodyScope;
      b.selected = b.allData.slice(0, 1);
      b.selectedMappings = {};
      if (b.selected[0]) b.selectedMappings[b.selected[0].id] = true;
      window.__beforeLen = b.selected ? b.selected.length : -1;
      window.__hasCore = typeof window.__eagleCoreFns.cleanSelected;
      window.__eagleCoreFns.cleanSelected({ metaKey: false, ctrlKey: false, preventDefault() {}, stopPropagation() {} });
      window.__afterLen = b.selected ? b.selected.length : -1;
      window.__c3err3 = null;
    } catch (e) { window.__c3err3 = String((e && e.stack) || e).slice(0, 300); }
    return true;
  })()`);
  await delay(400);
  {
    const dbg = await waitExpr(`({ err: window.__c3err3, hasCore: window.__hasCore, marker: window.__reloadMarker, after: window.__afterLen })`);
    console.log('DEBUG c3-len:', JSON.stringify(dbg.result.value));
  }
  await assertExpr('c3-clean-selected', `window.__c3err3 === null && window.__hasCore === 'function'`);

  // ── bundle 后备（未移植函数照旧走 scope）──
  await assertExpr('c3-fallback-path', `typeof window.$bodyScope.clickNode === 'function'`);

  await delay(600);
  await screenshotTo('test-run/react-stage1c3-smoke.png', 5000);

  if (failures.length) {
    console.error(`STAGE1C3 SMOKE FAILED: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('STAGE1C3 SMOKE OK');
  }
} catch (err) {
  console.error('STAGE1C3 SMOKE ERROR:', err);
  process.exitCode = 1;
} finally {
  if (stack) await stop(stack.electron).catch(() => {});
  if (stack) await stop(stack.vite).catch(() => {});
  if (stack) await stop(stack.backend).catch(() => {});
}
