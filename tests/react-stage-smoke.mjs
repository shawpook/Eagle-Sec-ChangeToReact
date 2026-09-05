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

  // b1-9af：exif-viewer React 接管闭环——主窗内挂真实 iframe 走 vite 中间件链
  // （壳 + shims 注入 + react/viewers/exif entry），验证参数→方向/适配类 + src 面契约
  await page.send('Runtime.evaluate', {
    expression: `(function () {
      window.__b1_9af = { done: false, ok: false };
      const f = document.createElement('iframe');
      f.style.display = 'none';
      f.src = '/src/app/exif-viewer/index.html?orientation=6&path=' + encodeURIComponent('/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png') + '&width=100&height=50';
      f.onload = function () {
        setTimeout(function () {
          try {
            const img = f.contentDocument.getElementById('main-image');
            window.__b1_9af.ok = !!img
              && img.className.indexOf('r6') > -1
              && img.className.indexOf('fit-height2') > -1
              && img.className.indexOf('show') > -1
              && (img.getAttribute('src') || '').indexOf('Welcome Library.png') > -1;
          } catch (err) { window.__b1_9af.ok = false; }
          window.__b1_9af.done = true;
          try { f.remove(); } catch (err2) {}
        }, 400);
      };
      document.body.appendChild(f);
      setTimeout(function () { window.__b1_9af.done = true; }, 12000);
    })()`,
    returnByValue: true,
  });
  await waitFor(async () => (await waitExpr(`window.__b1_9af && window.__b1_9af.done === true`)).result.value, 'b1-9af exif iframe', 15000);

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
    // b1-9z：flatpickr 供给链——flatpickr.min.js（v3.0.6 经典脚本原生暴露
    // window.FlatpickrInstance/window.flatpickr）+ zh l10n；构造契约 = new FP(input, opts)
    // 返回实例（_input 指回、destroy/setDate 可调用）
    ['b1-9z-flatpickr-supply', `(() => {
      if (typeof window.flatpickr !== 'function' || typeof window.FlatpickrInstance !== 'function') return false;
      if (!window.flatpickr.l10ns || !window.flatpickr.l10ns.zh) return false;
      try {
        const inp = document.createElement('input');
        const inst = new window.FlatpickrInstance(inp, { locale: 'zh', dateFormat: 'Y-m-d' });
        const ok = !!(inst && inst._input === inp && typeof inst.destroy === 'function' && inst.setDate instanceof Function);
        inst.destroy();
        return ok;
      } catch (err) { return false; }
    })()`],
    // b1-9ad：颜色筛选管线——s.colorFilter/s.grayColorFilter 已由 dataMachinery seeds 赋值；
    // 正向断言覆盖精确命中（colorDistancesMap=0.01）/ DeltaE 距离命中 / 不命中 / 黑白四态，
    // 规则值先存后还（纯函数调用不过 filterContent，无 rebindRefresh 副作用）
    ['b1-9ad-colorfilter-pipeline', `(() => {
      try {
        const s = window.$bodyScope;
        if (!s || typeof s.colorFilter !== 'function' || typeof s.grayColorFilter !== 'function') return false;
        const rules = window.eagle.filter.filterRules.color;
        const prevValue = rules.value, prevAcc = rules.accuracy;
        try {
          rules.value = [255, 0, 0];
          if (rules.accuracy == null) rules.accuracy = 20;
          const imgExact = { id: 'b1-9ad-match', palettes: [{ ratio: 40, color: [255, 0, 0] }] };
          const imgNear = { id: 'b1-9ad-dist', palettes: [{ ratio: 40, color: [250, 10, 10] }] };
          const imgFar = { id: 'b1-9ad-miss', palettes: [{ ratio: 40, color: [0, 0, 255] }] };
          const t1 = s.colorFilter(imgExact) === true && s.colorDistancesMap['b1-9ad-match'] === 0.01;
          const t2 = s.colorFilter(imgNear) === true && typeof s.colorDistancesMap['b1-9ad-dist'] === 'number';
          const t3 = s.colorFilter(imgFar) === false;
          const g1 = s.grayColorFilter({ id: 'g1', palettes: [{ ratio: 0.5, color: [100, 100, 100] }] }) === true;
          const g2 = s.grayColorFilter({ id: 'g2', palettes: [{ ratio: 0.5, color: [200, 100, 100] }] }) === false;
          const g3 = s.grayColorFilter({ id: 'g3' }) === false;
          return t1 && t2 && t3 && g1 && g2 && g3;
        } finally {
          rules.value = prevValue; rules.accuracy = prevAcc;
          delete s.colorDistancesMap['b1-9ad-match'];
          delete s.colorDistancesMap['b1-9ad-dist'];
          delete s.colorDistancesMap['b1-9ad-miss'];
        }
      } catch (err) { return false; }
    })()`],
    ['b1-9af-exif-viewer-react', `window.__b1_9af && window.__b1_9af.ok === true`],
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
      expression: `(() => { const s = window.$bodyScope; return {
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

  // ---- 阶段3a：工具栏 React 接管闭环 ----
  const stage3a = [
    ['stage3a-toolbar-host-rendered', `document.querySelectorAll('#eagle-toolbar-host .breadcrumbs li').length > 0`],
    ['stage3a-breadcrumb-all-active', `(() => { const li = Array.from(document.querySelectorAll('#eagle-toolbar-host .breadcrumbs li')).find(e => e.textContent.trim() === '全部'); return !!li && li.style.display !== 'none'; })()`],
    ['stage3a-prev-next-btns', `!!document.querySelector('#eagle-toolbar-host .ic-btn.prev') && !!document.querySelector('#eagle-toolbar-host .ic-btn.next')`],
    ['stage3a-zoom-slider', `(() => { const input = document.querySelector('#box-list-slider input.range'); return !!input && Number(input.min) === 75 && Number(input.value) > 75; })()`],
    ['stage3a-zoom-progressbar-width', `(() => { const cur = document.querySelector('#box-list-slider .range-progressbar .current'); return !!cur && cur.style.width.includes('%'); })()`],
    ['stage3a-search-input', `(() => { const input = document.querySelector('#search'); return !!input && input.placeholder.length > 0; })()`],
    ['stage3a-filter-btn-with-badge-slot', `(() => { const btns = document.querySelectorAll('#eagle-toolbar-host .ic-btn.filter-btn'); return btns.length >= 2; })()`],
    ['stage3a-corner-window-btns-hidden-by-default', `document.querySelectorAll('#eagle-toolbar-host .corner-btns .windows-btn').length === 0`],
    ['stage3a-toolbar-visible', `getComputedStyle(document.getElementById('eagle-toolbar-host')).display !== 'none'`],
  ];
  for (const [name, expression] of stage3a) {
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

  // 交互闭环 A：点筛选按钮 → eagle.filter.isOpen 翻转 → React 按钮获得 .active
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('#eagle-toolbar-host .right .ic-btn.filter-btn'));
      const filterBtn = btns.find((b) => b.querySelector('img[src*="ic-toolbar-filter.svg"]'));
      filterBtn && filterBtn.click();
    })()`,
    returnByValue: true,
  });
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('#eagle-toolbar-host .right .ic-btn.filter-btn'));
        const filterBtn = btns.find((b) => b.querySelector('img[src*="ic-toolbar-filter.svg"]'));
        return !!filterBtn && filterBtn.className.includes('active');
      })()`,
      returnByValue: true,
    });
    return r.result.value === true;
  }, 'filter button toggles active', 15000);
  console.log('PASS stage3a-filter-toggle-active');
  // 还原：再点一次关掉筛选面板
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('#eagle-toolbar-host .right .ic-btn.filter-btn'));
      const filterBtn = btns.find((b) => b.querySelector('img[src*="ic-toolbar-filter.svg"]'));
      filterBtn && filterBtn.click();
    })()`,
    returnByValue: true,
  });
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', {
      expression: `(() => { const s = window.$bodyScope; return !s.eagle.filter.isOpen; })()`,
      returnByValue: true,
    });
    return r.result.value === true;
  }, 'filter closed restored', 15000);
  console.log('PASS stage3a-filter-toggle-restored');

  // 交互闭环 B'：隐藏检查器 → corner-btns（窗口按钮）出现 → 恢复检查器
  try {
    await page.send('Runtime.evaluate', {
      expression: `(() => { const s = window.$bodyScope; s.inspector.toggle(); s.$evalAsync(); })()`,
      returnByValue: true,
    });
    await waitFor(async () => {
      const r = await page.send('Runtime.evaluate', {
        expression: `(() => {
          const close = document.querySelector('#eagle-toolbar-host #close-btn');
          return !!close && (close.style.backgroundImage || '').includes('ic-windows-close')
            && document.querySelectorAll('#eagle-toolbar-host .corner-btns').length === 2 && document.querySelectorAll('#eagle-toolbar-host .corner-btns .windows-btn').length === 8;
        })()`,
        returnByValue: true,
      });
      return r.result.value === true;
    }, 'corner window buttons appear when inspector hidden', 15000);
    console.log('PASS stage3a-corner-btns-when-inspector-hidden');
  } catch (err) {
    const diag = await page.send('Runtime.evaluate', {
      expression: `(() => { const s = window.$bodyScope; return {
        isHideInspector: s.inspector && s.inspector.isHideInspector,
        snapshotInspectorHide: window.__eagleReactStore && document.querySelectorAll('#eagle-toolbar-host .corner-btns').length,
        cornerInDom: document.querySelectorAll('#eagle-toolbar-host .corner-btns').length,
        windowsBtns: document.querySelectorAll('#eagle-toolbar-host .windows-btn').length,
        closeBtn: !!document.querySelector('#eagle-toolbar-host #close-btn'),
      }; })()`,
      returnByValue: true,
    });
    console.error('CORNER DIAG:', JSON.stringify(diag.result.value));
    throw err;
  }
  await page.send('Runtime.evaluate', {
    expression: `(() => { const s = window.$bodyScope; s.inspector.toggle(); s.$evalAsync(); })()`,
    returnByValue: true,
  });
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', {
      expression: `document.querySelectorAll('#eagle-toolbar-host .corner-btns').length === 0 && document.querySelectorAll('#eagle-toolbar-host .windows-btn').length === 0`,
      returnByValue: true,
    });
    return r.result.value === true;
  }, 'corner window buttons restored', 15000);
  console.log('PASS stage3a-corner-btns-restored');

  // 交互闭环 B：搜索输入 → keyword 写回 scope → 面包屑出现「搜索结果」条目
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('#search');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'stage-a');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    })()`,
    returnByValue: true,
  });
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', {
      expression: `(() => {
        const s = window.$bodyScope;
        const hasBreadcrumb = Array.from(document.querySelectorAll('#eagle-toolbar-host .breadcrumbs li')).some((li) => li.textContent.includes('搜索结果'));
        return s && s.keyword === 'stage-a' && hasBreadcrumb;
      })()`,
      returnByValue: true,
    });
    return r.result.value === true;
  }, 'keyword roundtrip + search result breadcrumb', 20000);
  console.log('PASS stage3a-search-keyword-roundtrip');
  // 还原 keyword
  await page.send('Runtime.evaluate', {
    expression: `(() => { const s = window.$bodyScope; s.keyword = ''; s.filterContent && s.filterContent(); s.$evalAsync(); })()`,
    returnByValue: true,
  });
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', {
      expression: `(() => { const s = window.$bodyScope; return !s.keyword; })()`,
      returnByValue: true,
    });
    return r.result.value === true;
  }, 'keyword restored', 15000);
  console.log('PASS stage3a-keyword-restored');

  // ---- 阶段3b：筛选面板 React 接管闭环 ----
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', {
      expression: `document.querySelectorAll('#eagle-filter-toolbar-host .filter-item').length >= 17`,
      returnByValue: true,
    });
    return r.result.value === true;
  }, 'filter items rendered', 30000);
  console.log('PASS stage3b-17-items-rendered');

  const stage3bStatic = [
    ['stage3b-filter-items-hidden-by-default', `(() => { const inner = document.querySelector('#eagle-filter-toolbar-host .filter-items > div'); return !!inner && getComputedStyle(inner).display === 'none'; })()`],
    ['stage3b-overlay-persists', `!!document.getElementById('filter-toolbar-overlay')`],
  ];
  for (const [name, expression] of stage3bStatic) {
    const r = await page.send('Runtime.evaluate', { expression, returnByValue: true });
    const pass = r.result.value === true;
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`);
    if (!pass) failures.push(name);
  }

  // 打开筛选面板（点工具栏筛选按钮）→ 17 个 .filter-item 可见 → 点「类型」筛选器展开菜单
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('#eagle-toolbar-host .right .ic-btn.filter-btn'));
      const filterBtn = btns.find((b) => b.querySelector('img[src*="ic-toolbar-filter.svg"]'));
      filterBtn && filterBtn.click();
    })()`,
    returnByValue: true,
  });
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', {
      expression: `(() => {
        const host = document.getElementById('eagle-filter-toolbar-host');
        const items = host.querySelectorAll('.filter-item');
        const visible = Array.from(items).some((el) => el.offsetParent !== null);
        return getComputedStyle(host).display !== 'none' && items.length >= 17 && visible;
      })()`,
      returnByValue: true,
    });
    return r.result.value === true;
  }, 'filter panel open with items', 20000);
  console.log('PASS stage3b-panel-opens');

  // 点击「格式」(types) 筛选器 → .open 菜单展开 → check-item 列表渲染 → 互斥（只有一个 open）
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const item = document.getElementById('types-filter-item');
      item && item.querySelector('.name').click();
    })()`,
    returnByValue: true,
  });
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', {
      expression: `(() => {
        const item = document.getElementById('types-filter-item');
        if (!item || !item.classList.contains('open')) return false;
        const openCount = document.querySelectorAll('[filter-item].open').length;
        const checks = item.querySelectorAll('.check-item').length;
        return openCount === 1 && checks > 0;
      })()`,
      returnByValue: true,
    });
    return r.result.value === true;
  }, 'types filter opens exclusively', 15000);
  console.log('PASS stage3b-types-open-exclusive');

  // 勾选第一个格式 → filterRules.type.includes 写入 → 面包屑出现「搜索结果」 + .active
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const item = document.getElementById('types-filter-item');
      const check = item.querySelector('.check-item');
      check && check.click();
    })()`,
    returnByValue: true,
  });
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', {
      expression: `(() => {
        const s = window.$bodyScope;
        const rules = s.eagle.filter.filterRules.type.includes;
        const activeCount = Object.values(rules).filter(Boolean).length;
        const item = document.getElementById('types-filter-item');
        const breadcrumb = Array.from(document.querySelectorAll('#eagle-toolbar-host .breadcrumbs li')).some((li) => li.textContent.includes('搜索结果'));
        return activeCount > 0 && item.className.includes('active') && breadcrumb && s.eagle.filter.filterBadge > 0;
      })()`,
      returnByValue: true,
    });
    return r.result.value === true;
  }, 'type check drives rules + badge + breadcrumb', 20000);
  console.log('PASS stage3b-type-check-loop');

  // 重置按钮 → filterRules 清空 + filterBadge 归零 + active 消失
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const host = document.getElementById('eagle-filter-toolbar-host');
      const btns = Array.from(host.querySelectorAll('.filter-right .ic-btn'));
      const reset = btns.find((b) => b.querySelector('img[src*="ic-filter-reset.svg"]'));
      reset && reset.click();
    })()`,
    returnByValue: true,
  });
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', {
      expression: `(() => {
        const s = window.$bodyScope;
        const item = document.getElementById('types-filter-item');
        return s.eagle.filter.filterBadge === 0 && !item.className.includes('active');
      })()`,
      returnByValue: true,
    });
    return r.result.value === true;
  }, 'reset clears badge + active', 20000);
  console.log('PASS stage3b-reset-clears');

  // 关闭筛选面板还原
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('#eagle-toolbar-host .right .ic-btn.filter-btn'));
      const filterBtn = btns.find((b) => b.querySelector('img[src*="ic-toolbar-filter.svg"]'));
      filterBtn && filterBtn.click();
    })()`,
    returnByValue: true,
  });
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', {
      expression: `(() => { const s = window.$bodyScope; return !s.eagle.filter.isOpen; })()`,
      returnByValue: true,
    });
    return r.result.value === true;
  }, 'filter panel closed restored', 15000);
  console.log('PASS stage3b-panel-closed-restored');

  // ---- 阶段4：内容网格 React 接管闭环 ----
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', {
      expression: `document.querySelectorAll('#box-list .box').length > 0 && typeof window.ig !== 'undefined' && typeof window.resetNgGridLayoutData === 'function'`,
      returnByValue: true,
    });
    return r.result.value === true;
  }, 'boxes rendered via react engine', 45000);
  console.log('PASS stage4-boxes-rendered');

  const stage4Static = [
    ['stage4-box-structure', `(() => { const box = document.querySelector('#box-list .box'); return Boolean(box && box.querySelector('.thumbnail') && box.querySelector('.name') && box.getAttribute('data-box-id')); })()`],
    ['stage4-box-thumbnail-img', `!!document.querySelector('#box-list .box .thumbnail img')`],
    ['stage4-type-label', `(() => { const label = document.querySelector('#box-list .box .type-label'); return !!label; })()`],
    ['stage4-global-ig-exposed', `typeof window.ig !== 'undefined' && typeof window.ig.getGroupKeys === 'function'`],
    ['stage4-container-layout-class', `(() => { const s = window.$bodyScope; const cls = document.getElementById('box-container').className; const expected = (s.layout === 'GridLayout' || s.layout === 'SquareLayout') ? 'grid-layout' : s.layout === 'ListLayout' ? 'list-layout' : 'justified-layout'; return cls.includes(expected); })()`],
  ];
  for (const [name, expression] of stage4Static) {
    const r = await page.send('Runtime.evaluate', { expression, returnByValue: true });
    const pass = r.result.value === true;
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`);
    if (!pass) failures.push(name);
  }

  // 交互闭环：点击第一个 box → .selected 类 + scope.selectedMappings 记录
  await page.send('Runtime.evaluate', {
    expression: `(() => { const thumb = document.querySelector('#box-list .box .thumbnail'); thumb.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); thumb.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); })()`,
    returnByValue: true,
  });
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', {
      expression: `(() => {
        const s = window.$bodyScope;
        const box = document.querySelector('#box-list .box.selected') || document.querySelector('#box-list .box');
        const id = box && box.getAttribute('data-box-id');
        return !!(id && s.selectedMappings && s.selectedMappings[id]) && box.className.includes('selected');
      })()`,
      returnByValue: true,
    });
    return r.result.value === true;
  }, 'box selection loop', 20000);
  console.log('PASS stage4-box-select');



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
