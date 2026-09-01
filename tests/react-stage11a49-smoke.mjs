/**
 * React 化改造 —— 阶段11-pre a4-a9 统一闭环测试。
 *
 * 运行：node tests/react-stage11a4to9-smoke.mjs
 * 断言点：
 *  1. 壳：9 个新 host 存在；旧模板位（#image-drop-area 等）不在 index 壳层
 *  2. a4：app-menu-btn（isLoading 开关）；trash 空状态；keyword 空结果状态；
 *     box-container 'empty' class
 *  3. a5：sub-folder 列表渲染（items/name/locked class/排序初始化）
 *  4. a6：ListLayout 列头渲染 + active 列 + 方向 class
 *  5. a8：body class 插值 + ng-class 开关（is-grayscale-mode）/theme attr/app-style
 *     href/main-app ui-ready/list-content-panel 定位/详情包裹层（display + hosts 在位）
 *  6. a7：colors-picker（React 渲染，id 保留）/annotation 容器（isDetailMode 条件渲染）
 *  7. a9：box-container 无 ng-* 残留
 *  8. 截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage11a49-'));
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
      await post('/api/library/create', { name: 'React Stage11a49 Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#0ea5e9' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's11a49.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's11a49.png')] });
      for (const name of ['SubA', 'SubB']) {
        await post('/api/folder/create', { name });
      }
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

  // ── 壳 ──
  await assertExpr('a49-hosts', `[
    'eagle-drop-areas-host','eagle-scroll-top-host','eagle-app-menu-host','eagle-sub-folder-host',
    'eagle-list-header-host','eagle-panel-droparea-host','eagle-detail-wrapper-host',
    'eagle-colors-picker-host','eagle-annotation-preview-host'
  ].every(id => !!document.getElementById(id))`);

  // ── a4：app-menu-btn（经 store 驱动——scope.isLoading 由 app 自身异步复位，避免竞态） ──
  await evalNow(`(() => { window.__eagleBodyState.setState({ isLoading: true }); return true; })()`);
  await assertExpr('a4-app-menu-shown', `!!document.querySelector('#eagle-app-menu-host .application-menu-btn')`);
  await evalNow(`(() => { window.__eagleBodyState.setState({ isLoading: false }); return true; })()`);
  await assertExpr('a4-app-menu-hidden', `!document.querySelector('#eagle-app-menu-host .application-menu-btn')`);

  // ── a4：trash 空状态 ──
  await evalNow(`(() => { const b = window.$bodyScope; b.viewMode = 'trash'; b.trash = []; b.$evalAsync(); return true; })()`);
  await assertExpr('a4-trash-empty', `(() => {
    const areas = document.querySelectorAll('#eagle-drop-areas-host .drop-area');
    return areas.length === 1 && !!areas[0].querySelector('img[src*="empty-trash"]');
  })()`);
  await evalNow(`(() => { const b = window.$bodyScope; b.viewMode = 'all'; b.$evalAsync(); return true; })()`);
  await assertExpr('a4-trash-empty-closed', `document.querySelectorAll('#eagle-drop-areas-host .drop-area').length === 0`);

  // ── a4：keyword 空结果 + box-container empty class ──
  await evalNow(`(() => { const b = window.$bodyScope; b.keyword = 'zzz-no-hit'; b.filtereds = []; b.$evalAsync(); return true; })()`);
  await assertExpr('a4-search-none', `(() => {
    const box = document.getElementById('box-container');
    const areas = document.querySelectorAll('#eagle-drop-areas-host .drop-area');
    return box.classList.contains('empty') && areas.length === 1;
  })()`);
  await evalNow(`(() => { const b = window.$bodyScope; b.keyword = ''; b.$evalAsync(); return true; })()`);
  await assertExpr('a4-search-none-closed', `(() => {
    const box = document.getElementById('box-container');
    return !box.classList.contains('empty') && document.querySelectorAll('#eagle-drop-areas-host .drop-area').length === 0;
  })()`);

  // ── a8：body 绑定层 ──
  await assertExpr('a8-body-class-base', `(() => {
    const cls = document.body.className;
    return cls.indexOf('-view') > -1 && cls.indexOf('current-focus-') > -1;
  })()`);
  await assertExpr('a8-body-attrs', `document.body.getAttribute('theme') === 'dark' && !!document.body.getAttribute('platform')`);
  await assertExpr('a8-app-style-href', `document.getElementById('app-style').href.indexOf('css/style_dark.css') > -1`);
  await assertExpr('a8-main-app-ready-cleared', `document.getElementById('main-app').className.indexOf('ui-ready') === -1`);
  await evalNow(`(() => { const b = window.$bodyScope; b.isGrayscaleMode = true; b.$evalAsync(); return true; })()`);
  await assertExpr('a8-grayscale-class', `document.body.classList.contains('is-grayscale-mode')`);
  await evalNow(`(() => { const b = window.$bodyScope; b.isGrayscaleMode = false; b.$evalAsync(); return true; })()`);
  await assertExpr('a8-grayscale-cleared', `!document.body.classList.contains('is-grayscale-mode')`);
  await assertExpr('a8-panel-position', `(() => {
    const b = window.$bodyScope;
    const panel = document.getElementById('list-content-panel');
    return panel.style.left === (b.containerSize.sidebar + 1) + 'px'
      && panel.style.right === (b.inspector.width + 1) + 'px';
  })()`);

  // ── a8/a7：详情模式（包裹层 + annotation 容器 + scroll-to-top 隐藏） ──
  await evalNow(`(() => { const b = window.$bodyScope; b.isDetailMode = true; b.$evalAsync(); return true; })()`);
  await assertExpr('a8-detail-wrapper-shown', `(() => {
    const w = document.getElementById('eagle-detail-wrapper');
    return !!w && w.style.display !== 'none' && !!w.querySelector('#eagle-detail-host') && !!w.querySelector('#detail-container');
  })()`);
  await assertExpr('a4-scroll-top-hidden-detail', `document.getElementById('scroll-to-top').style.display === 'none'`);
  await assertExpr('a7-annotation-container-shown', `!!document.querySelector('#eagle-annotation-preview-host #annotation-preview-container .annotation-box')`);
  await evalNow(`(() => { const b = window.$bodyScope; b.isDetailMode = false; b.$evalAsync(); return true; })()`);
  await assertExpr('a8-detail-wrapper-hidden', `document.getElementById('eagle-detail-wrapper').style.display === 'none'`);
  await assertExpr('a7-annotation-container-removed', `!document.querySelector('#eagle-annotation-preview-host #annotation-preview-container')`);

  // ── a7：colors-picker（React 渲染，id 保留） ──
  await assertExpr('a7-colors-picker', `(() => {
    const input = document.querySelector('#eagle-colors-picker-host #colors-picker');
    return !!input && input.type === 'color' && input.value === '#ff0000';
  })()`);

  // ── a5：sub-folder 列表 ──
  await evalNow(`(() => {
    const b = window.$bodyScope;
    b.selectedFolders = [];
    b.currentFolder = Object.assign({}, b.currentFolder || {}, { children: [{ id: 'C1' }, { id: 'C2' }] });
    b.subFolders = [
      { id: 'SF1', name: 'SubA', imageCount: 3, children: [], covers: [] },
      { id: 'SF2', name: 'SubB', imageCount: 0, children: [{ id: 'X' }], covers: [], password: 'abc' },
    ];
    b.listDone = true;
    b.isHideSubFolder = true;
    b.$evalAsync();
    return true;
  })()`);
  await assertExpr('a5-subfolder-visible', `(() => {
    const sec = document.querySelector('#eagle-sub-folder-host #sub-folder-container');
    return !!sec && sec.style.display !== 'none';
  })()`);
  await assertExpr('a5-subfolder-items', `(() => {
    const items = document.querySelectorAll('#eagle-sub-folder-host .sub-folder');
    if (items.length !== 2) return false;
    const first = items[0];
    const second = items[1];
    return first.querySelector('.name').textContent === 'SubA'
      && first.textContent.indexOf('3') > -1
      && second.classList.contains('locked')
      && second.querySelector('.metas').textContent.indexOf('1') > -1;
  })()`);
  await assertExpr('a5-subfolder-sortable-init', `(() => {
    const $ = window.jQuery;
    const list = document.querySelector('#eagle-sub-folder-host .sub-folder-list');
    return !!list && !!$(list).data('ui-sortable');
  })()`);
  await evalNow(`(() => { const b = window.$bodyScope; b.isHideSubFolder = false; b.$evalAsync(); return true; })()`);
  await assertExpr('a5-subfolder-collapsed', `!document.querySelector('#eagle-sub-folder-host .sub-folder-list')`);

  // ── a6：ListLayout 列头 ──
  await evalNow(`(() => { const b = window.$bodyScope; b.layout = 'ListLayout'; b.currentOrderBy = 'NAME'; b.$evalAsync(); return true; })()`);
  await assertExpr('a6-list-header-shown', `(() => {
    const header = document.querySelector('#eagle-list-header-host #list-layout-header');
    return !!header && header.querySelectorAll('.prop').length === 8;
  })()`);
  await assertExpr('a6-list-header-active', `(() => {
    const header = document.querySelector('#eagle-list-header-host #list-layout-header');
    const nameProp = header.querySelector('.prop.name');
    return nameProp.classList.contains('active') && !!header.querySelector('.icon img.up');
  })()`);
  await evalNow(`(() => { const b = window.$bodyScope; b.layout = 'GridLayout'; b.$evalAsync(); return true; })()`);
  await assertExpr('a6-list-header-removed', `!document.querySelector('#eagle-list-header-host #list-layout-header')`);

  // ── a9：box-container 无 ng-* 残留 + 面板拖放浮层 ──
  await assertExpr('a9-box-no-ng', `(() => {
    const box = document.getElementById('box-container');
    return !box.getAttribute('ng-show') && !box.getAttribute('ng-class')
      && !box.getAttribute('ng-right-click') && !box.getAttribute('ondragenter')
      && !box.getAttribute('ondrop') && !box.getAttribute('ondragover');
  })()`);
  await assertExpr('a9-panel-droparea', `(() => {
    const area = document.querySelector('#eagle-panel-droparea-host .box-container-droparea');
    return !!area && area.querySelector('.tips').textContent.length > 0;
  })()`);

  await delay(600);
  await screenshotTo('test-run/react-stage11a49-smoke.png', 5000);

  if (failures.length) {
    console.error(`STAGE11A49 SMOKE FAILED: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('STAGE11A49 SMOKE OK');
  }
} catch (err) {
  console.error('STAGE11A49 SMOKE ERROR:', err);
  process.exitCode = 1;
} finally {
  if (stack) await stop(stack.electron).catch(() => {});
  if (stack) await stop(stack.vite).catch(() => {});
  if (stack) await stop(stack.backend).catch(() => {});
}
