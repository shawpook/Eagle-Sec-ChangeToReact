/**
 * React 化改造 —— 阶段收尾闭环测试（可复用骨架）。
 *
 * 每阶段收尾跑：`node tests/react-stage-smoke.mjs`
 * 断言点（当前=阶段1 构建接线+壳/全局状态）：
 *  1. React mount 成功（#eagle-react-host 出现，由 src/app/react/main.tsx 挂载）
 *  2. 迁移期共存：Angular 主界面仍可用（#main-app、#sidebar、#box-container 渲染）
 *  3. 全局桥未被破坏：window.eagle / window.i18n / window.electronSettings 可用
 *  4. 截图留档到 test-run/react-stage-*.png
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage-'));
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
    // 与现有闭环测试一致：Electron 启动前经 REST 建好资料库与侧栏内容（folder/智能文件夹/标签/快速访问）。
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
      await post('/api/library/create', { name: 'React Stage Library', savePath: librariesRoot });
      const folderA = await post('/api/folder/create', { name: '设计参考' });
      const folderB = await post('/api/folder/create', { name: '子文件夹', parent: folderA.id });
      await post('/api/v2/smartFolder/create', {
        name: '五星精选',
        conditions: [
          { rules: [{ property: 'rating', method: 'equal', value: '5' }] },
        ],
        description: '',
      });
      // 导入两张图：一张入「全部」，一张加入「设计参考」保证文件夹徽标非空
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 16, height: 10, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      const tmp1 = path.join(librariesRoot, 'stage-a.png');
      const tmp2 = path.join(librariesRoot, 'stage-b.png');
      fs.writeFileSync(tmp1, png);
      fs.writeFileSync(tmp2, png);
      const addedA = await post('/api/item/addFromPath', { paths: [tmp1] });
      const addedB = await post('/api/item/addFromPath', { paths: [tmp2] });
      const ids = [addedA, addedB].flatMap((r) => (Array.isArray(r) ? r : [r])).map((i) => i.id);
      await post('/api/item/addToFolder', { ids, folderID: folderA.id });
      return { folderA, folderB };
    },
  });
  const { page } = stack;

  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', {
      expression: `document.readyState`,
      returnByValue: true,
    });
    return r.result.value === 'complete';
  }, 'main window ready', 30000);

  // 逐项等待而非固定延时：全新 vite 实例冷启动会重新 pre-bundle 依赖，模块服务可能滞后。
  const waitExpr = (expression) => page.send('Runtime.evaluate', { expression, returnByValue: true });
  await waitFor(async () => (await waitExpr(`!!document.getElementById('main-app')`)).result.value, 'Angular main-app', 45000);
  await waitFor(async () => (await waitExpr(`typeof window.eagle !== 'undefined' && typeof window.eagle.inspector !== 'undefined'`)).result.value, 'window.eagle', 45000);
  await waitFor(async () => (await waitExpr(`!!document.getElementById('eagle-react-host')`)).result.value, 'React mount host', 45000);

  const assertions = [
    ['react-mount', `document.getElementById('eagle-react-host') !== null`],
    ['angular-main-app', `document.getElementById('main-app') !== null`],
    ['angular-sidebar', `document.getElementById('sidebar') !== null`],
    ['angular-box-container', `document.getElementById('box-container') !== null`],
    ['global-eagle', `typeof window.eagle !== 'undefined' && typeof window.eagle.inspector !== 'undefined'`],
    ['global-i18n', `typeof window.i18n !== 'undefined'`],
    ['global-settings', `typeof window.electronSettings !== 'undefined'`],
    ['react-store-exposed', `typeof window.__eagleReactStore !== 'undefined' && typeof window.__eagleReactStore.getState === 'function'`],
    ['react-store-theme', `(window.__eagleReactStore && (typeof window.__eagleReactStore.getState().theme === 'string'))`],
    // 阶段1：React 全局状态层与真实数据面同步 —— 初始态 body@theme 与 store.theme 一致
    ['stage1-theme-sync-initial', `window.__eagleReactStore.getState().theme === (document.body.getAttribute('theme') || 'gray')`],
    ['stage1-preferences-key-shared', `window.__eagleReactStore.getState().preferences !== null && typeof window.__eagleReactStore.getState().preferences.general.language === 'string'`],
    ['stage1-actions-exposed', `typeof window.__eagleReactStore.getState().applyThemePreference === 'function' && typeof window.__eagleReactStore.getState().openRegisterModal === 'function'`],
  ];

  const failures = [];
  for (const [name, expression] of assertions) {
    const pass = await (async () => {
      const r = await page.send('Runtime.evaluate', { expression, returnByValue: true });
      return r.result.value === true;
    })();
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`);
    if (!pass) failures.push(name);
  }

  // 阶段1核心闭环：写同一个 electron-settings「preferences」键 → shims 广播 change.current.theme
  // → Angular RootController 更新 body@theme；React store 监听同一事件同步 theme。
  // 数据面零改动断言：写入用的是与 RootController 相同的键与事件通道。
  const before = await page.send('Runtime.evaluate', {
    expression: `document.body.getAttribute('theme')`,
    returnByValue: true,
  });
  const beforeTheme = before.result.value || 'gray';
  const nextTheme = beforeTheme === 'light' ? 'gray' : 'light';

  await page.send('Runtime.evaluate', {
    expression: `window.electronSettings.setSync('preferences', { theme: { name: ${JSON.stringify(nextTheme.toUpperCase())}, css: ${JSON.stringify(nextTheme)} } })`,
    returnByValue: true,
  });
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', {
      expression: `(document.body.getAttribute('theme') === ${JSON.stringify(nextTheme)}) && (window.__eagleReactStore.getState().theme === ${JSON.stringify(nextTheme)})`,
      returnByValue: true,
    });
    return r.result.value === true;
  }, `theme switch to ${nextTheme} reflected on both Angular body and React store`, 15000);

  const appStyleHref = await page.send('Runtime.evaluate', {
    expression: `document.getElementById('app-style').getAttribute('href') || document.getElementById('app-style').href`,
    returnByValue: true,
  });
  const styleOk = String(appStyleHref.result.value).includes(`style_${nextTheme}.css`);
  console.log(`${styleOk ? 'PASS' : 'FAIL'} stage1-app-style-follows-theme (${appStyleHref.result.value})`);
  if (!styleOk) failures.push('stage1-app-style-follows-theme');

  // 还原主题，避免污染其它断言
  await page.send('Runtime.evaluate', {
    expression: `window.electronSettings.setSync('preferences', { theme: { name: ${JSON.stringify(beforeTheme.toUpperCase())}, css: ${JSON.stringify(beforeTheme)} } })`,
    returnByValue: true,
  });
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', {
      expression: `window.__eagleReactStore.getState().theme === ${JSON.stringify(beforeTheme)}`,
      returnByValue: true,
    });
    return r.result.value === true;
  }, `theme restored to ${beforeTheme}`, 15000);
  console.log(`PASS stage1-theme-restore (${beforeTheme})`);

  // ---- 阶段2：侧栏 React 接管闭环 ----
  // 等待资料库真正加载完成（folder item 渲染），避免与库加载时序竞态。
  try {
    await waitFor(async () => {
      const r = await page.send('Runtime.evaluate', {
        expression: `!!document.querySelector('#sidebar .sidebar-folder-item[data-sidebar-node-id]') && !!document.querySelector('#sidebar .library-switch-btn .library-name')`,
        returnByValue: true,
      });
      return r.result.value === true;
    }, 'library loaded in sidebar', 45000);
    console.log('PASS stage2-library-loaded');
  } catch (err) {
    const diag = await page.send('Runtime.evaluate', {
      expression: `(() => { const s = angular.element(document.body).scope(); return {
        libraryName: s && s.libraryName, isUILoaded: s && s.isUILoaded,
        vstypes: s && Array.isArray(s.sidebarList) ? s.sidebarList.map(n => n.vstype).join(',') : '-',
        sidebarHtml: document.getElementById('sidebar') ? document.getElementById('sidebar').innerHTML.slice(0, 200) : 'NO-SIDEBAR',
        folderItemInDom: !!document.querySelector('#sidebar .sidebar-folder-item'),
        libBtnInDom: !!document.querySelector('#sidebar .library-switch-btn'),
      }; })()`,
      returnByValue: true,
    });
    console.error('DIAG:', JSON.stringify(diag.result.value, null, 2));
    throw err;
  }
  const stage2 = [
    ['stage2-sidebar-list-rendered', `document.querySelectorAll('#sidebar-item-container > div').length > 3`],
    ['stage2-all-item-active', `(() => { const el = Array.from(document.querySelectorAll('#sidebar .item.depth-0')).find(e => e.textContent.includes('全部')); return !!el && el.className.includes('active'); })()`],
    ['stage2-folder-item-classes', `(() => { const el = document.querySelector('#sidebar .sidebar-folder-item[data-sidebar-node-id]'); return !!el && /depth-\\d/.test(el.className) && /icon-/.test(el.className); })()`],
    ['stage2-folder-badge-counts', `(() => { const el = Array.from(document.querySelectorAll('#sidebar .sidebar-folder-item')).find(e => e.querySelector('.badge.self') && e.querySelector('.badge.self').textContent.trim() !== ''); return !!el; })()`],
    ['stage2-labels-present', `['智能文件夹','文件夹'].every(label => Array.from(document.querySelectorAll('#sidebar .sidebar-item-label .name')).some(e => e.textContent.includes(label)))`],
    ['stage2-footer-search', `!!document.getElementById('folder-search')`],
    ['stage2-droparea', `!!document.querySelector('#sidebar .sidebar-droparea .tips')`],
    ['stage2-vs-spacers', `!!document.querySelector('#sidebar-item-container .vs-repeat-before-content') && !!document.querySelector('#sidebar-item-container .vs-repeat-after-content')`],
    ['stage2-header-library-btn', `!!document.querySelector('#sidebar .library-switch-btn .library-name') && document.querySelector('#sidebar .library-switch-btn .library-name').textContent.includes('React Stage Library')`],
    ['stage2-sidebar-width-set', `document.getElementById('sidebar').style.width.endsWith('px') && parseInt(document.getElementById('sidebar').style.width) > 100`],
    ['stage2-all-badge-visible', `(() => { const el = Array.from(document.querySelectorAll('#sidebar .item.depth-0')).find(e => e.textContent.includes('全部')); return !!el && el.querySelector('.badge') && el.querySelector('.badge').textContent.trim() !== ''; })()`],
  ];
  for (const [name, expression] of stage2) {
    let pass = false;
    try {
      await waitFor(async () => {
        const r = await page.send('Runtime.evaluate', { expression, returnByValue: true });
        return r.result.value === true;
      }, name, 15000);
      pass = true;
    } catch (err) { pass = false; }
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`);
    if (!pass) failures.push(name);
  }

  // 交互闭环：点击「未分类」→ Angular openUnfiled() → viewMode 切换 → React 快照同步 → active 类迁移
  await page.send('Runtime.evaluate', {
    expression: `(() => { const el = Array.from(document.querySelectorAll('#sidebar .item.depth-0')).find(e => e.textContent.includes('未分类')); el && el.click(); })()`,
    returnByValue: true,
  });
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', {
      expression: `(() => { const el = Array.from(document.querySelectorAll('#sidebar .item.depth-0')).find(e => e.textContent.includes('未分类')); return !!el && el.className.includes('active') && !Array.from(document.querySelectorAll('#sidebar .item.depth-0')).find(e => e.textContent.includes('全部')).className.includes('active'); })()`,
      returnByValue: true,
    });
    return r.result.value === true;
  }, 'click unfiled switches active state', 15000);
  console.log('PASS stage2-click-unfiled-activates');

  // 还原到「全部」
  await page.send('Runtime.evaluate', {
    expression: `(() => { const el = Array.from(document.querySelectorAll('#sidebar .item.depth-0')).find(e => e.textContent.includes('全部')); el && el.click(); })()`,
    returnByValue: true,
  });
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', {
      expression: `(() => { const el = Array.from(document.querySelectorAll('#sidebar .item.depth-0')).find(e => e.textContent.includes('全部')); return !!el && el.className.includes('active'); })()`,
      returnByValue: true,
    });
    return r.result.value === true;
  }, 'back to all', 15000);
  console.log('PASS stage2-click-all-restores');

  const shot = await page.send('Page.captureScreenshot', { format: 'png' });
  const dir = path.join(process.cwd(), 'test-run');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'react-stage-smoke.png'), Buffer.from(shot.data, 'base64'));
  console.log(`screenshot -> test-run/react-stage-smoke.png`);

  if (failures.length > 0) {
    console.error(`react-stage-smoke failed: ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log('react-stage-smoke passed');
} finally {
  if (stack) {
    await stop(stack.electron);
    await stop(stack.vite);
    await stop(stack.backend);
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
