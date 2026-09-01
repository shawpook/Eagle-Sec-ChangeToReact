/**
 * React 化改造 —— 阶段9b-1闭环测试（采集窗：接线 + CollectController + 左列 + FolderSelectPanel）。
 *
 * 运行：node tests/react-stage9b1-smoke.mjs
 * 断言点：
 *  1. init 序列：__eagleCollectController + folders 就绪（eagle api 走 shims 重写→真后端）+ isReady
 *     + .collect-window.open + thumbnail src（get-collect-window-data → Welcome Library.png）
 *  2. FolderSelectPanel：.select-panel-item ≥5（screenshot-regression 同门槛）+ open class + 搜索框
 *  3. 星等：click star4 → star=4；再点同星 → 删除
 *  4. 标签：get-collect-window-data mock tags 渲染 label-item + removeTag 收缩
 *  5. 标题 contenteditable：原生 setter + input 事件 → collectItem.title 回写
 *  6. save 数据面：spy eagle.item.addFile + window.close → folderIDs/tags/star 透传
 *  7. 搜索：input 关键字 → 过滤 + create 行出现；清空恢复
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay, connect } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage9b1-'));
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
      await post('/api/library/create', { name: 'React Stage9b1 Library', savePath: librariesRoot });
      // 面板门槛（screenshot-regression 同款 .select-panel-item ≥5）：建 4 个资料夹 → items = all + 4
      for (const name of ['Collected', 'Screenshots', 'References', 'Archive']) {
        await post('/api/folder/create', { name });
      }
      // 9b-2c：60 个 Bulk 资料夹 → 面板 61 项 > 视口 + excess 30 → vs-repeat 切片生效
      for (let i = 1; i <= 60; i++) {
        await post('/api/folder/create', { name: `Bulk-${String(i).padStart(2, '0')}` });
      }
    },
  });
  const { vitePort, debugPort } = stack;

  const failures = [];
  const evalOn = async (pageRef, expression) => {
    const r = await pageRef.send('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) {
      console.log(`WARN eval threw: ${r.exceptionDetails.text} ${JSON.stringify(r.exceptionDetails.exception || {}).slice(0, 200)}`);
      return undefined;
    }
    return r.result.value;
  };
  const assertExprOn = async (pageRef, name, expression, timeout = 20000) => {
    const pass = await (async () => {
      try {
        await waitFor(async () => {
          const r = await pageRef.send('Runtime.evaluate', { expression, returnByValue: true });
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

  // ── 主窗口导航到 collect-window（单页冒烟；Electron browser-ws 的 Target.createTarget 不支持） ──
  const pw = stack.page;
  await pw.send('Runtime.enable');
  await pw.send('Page.enable');
  await pw.send('Page.navigate', { url: `http://127.0.0.1:${vitePort}/src/app/collect-window/index.html` });
  await pw.send('Runtime.enable');
  await pw.send('Page.enable');
  await pw.send('Page.navigate', { url: `http://127.0.0.1:${vitePort}/src/app/collect-window/index.html` });
  await waitFor(async () => {
    const r = await pw.send('Runtime.evaluate', { expression: `document.readyState`, returnByValue: true });
    return r.result.value === 'complete';
  }, 'collect window ready', 30000);

  // ── 断言 1：init 序列 ──
  await assertExprOn(pw, 'pw4a-controller-init', `(() => {
    const s = window.__eagleCollectController;
    return !!s && Array.isArray(s.folders) && s.folders.length > 0 && s.isReady === true && !!s.collectItem;
  })()`);
  await assertExprOn(pw, 'pw4a-shell-open', `(() => {
    const win = document.querySelector('.collect-window');
    return !!win && win.classList.contains('open') && !!document.getElementById('eagle-collect-react-host');
  })()`);
  await assertExprOn(pw, 'pw4a-thumbnail-src', `(() => {
    const img = document.querySelector('.thumbnail img');
    const src = String((img && img.getAttribute('src')) || '');
    // shims 的 pathToFileURL → /file/<encoded>（空格编码为 %20）
    return src.indexOf('Welcome Library.png') > -1 || src.indexOf('Welcome%20Library.png') > -1;
  })()`);

  // ── 断言 2：FolderSelectPanel 渲染 ──
  await assertExprOn(pw, 'pw4a-folder-panel-items', `(() => {
    const items = document.querySelectorAll('.select-panel-item');
    const panel = document.querySelector('#folder-select-panel');
    return items.length >= 5 && !!panel && panel.classList.contains('open') && panel.classList.contains('folder-select-panel');
  })()`);
  await assertExprOn(pw, 'pw4a-folder-panel-search', `!!document.getElementById('folder-select-panel-search-input')`);

  // ── 断言 3：星等 ──
  await evalOn(pw, `(() => {
    const stars = document.querySelectorAll('.rating-container > div');
    stars[3].click();
    return true;
  })()`);
  await assertExprOn(pw, 'pw4a-star-set', `window.__eagleCollectController.collectItem.star === 4`);
  await evalOn(pw, `(() => {
    document.querySelectorAll('.rating-container > div')[3].click();
    return true;
  })()`);
  await assertExprOn(pw, 'pw4a-star-removed', `window.__eagleCollectController.collectItem.star === undefined`);

  // ── 断言 4：标签渲染 + 移除 ──
  await assertExprOn(pw, 'pw4a-tags-rendered', `document.querySelectorAll('.label-container .label-item').length === 3`);
  await evalOn(pw, `(() => {
    document.querySelector('.label-item-remove-btn').click();
    return true;
  })()`);
  await assertExprOn(pw, 'pw4a-tag-removed', `window.__eagleCollectController.collectItem.tags.length === 2`);

  // ── 断言 5：标题 contenteditable ──
  await evalOn(pw, `(() => {
    const el = document.querySelector('[data-placeholder]');
    el.textContent = 'PW4 Title';
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    return true;
  })()`);
  await assertExprOn(pw, 'pw4a-title-bound', `window.__eagleCollectController.collectItem.title === 'PW4 Title'`);

  // ── 断言 6：save 数据面（spy addFile + close） ──
  await evalOn(pw, `(() => {
    window.__eagleAddFileCalls = [];
    window.__eagleCloseCalled = 0;
    const eagle = window.eagle;
    const origAddFile = eagle.item.addFile.bind(eagle.item);
    eagle.item.addFile = async (params) => { window.__eagleAddFileCalls.push(params); return origAddFile(params).catch(() => ({})); };
    window.close = () => { window.__eagleCloseCalled++; };
    return true;
  })()`);
  await evalOn(pw, `(() => {
    const s = window.__eagleCollectController;
    s.collectItem.title = 'PW4 Save';
    s.save({ title: 'PW4 Save', annotation: 'ann', tags: ['t1'], folderIDs: ['F1'], star: 4 });
    return true;
  })()`);
  await assertExprOn(pw, 'pw4a-save-data', `(() => {
    const calls = window.__eagleAddFileCalls || [];
    if (calls.length !== 1) return false;
    const p = calls[0];
    return typeof p.src === 'string' && p.src.indexOf('data:image') === 0
      && p.title === 'PW4 Save' && p.annotation === 'ann'
      && JSON.stringify(p.tags) === JSON.stringify(['t1'])
      && JSON.stringify(p.folderIDs) === JSON.stringify(['F1'])
      && p.star === 4;
  })()`);
  await assertExprOn(pw, 'pw4a-save-close', `window.__eagleCloseCalled === 1`);

  // ── 断言 7：搜索过滤 + create 行 ──
  await evalOn(pw, `(() => {
    const input = document.getElementById('folder-select-panel-search-input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'Welcome');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await assertExprOn(pw, 'pw4a-search-create-row', `(() => {
    const items = Array.from(document.querySelectorAll('.select-panel-item .name'));
    return items.some((el) => el.textContent.indexOf('create') > -1 || el.textContent.indexOf('新建') > -1 || el.textContent.indexOf('"') > -1);
  })()`);
  await evalOn(pw, `(() => {
    const input = document.getElementById('folder-select-panel-search-input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await assertExprOn(pw, 'pw4a-search-cleared', `document.querySelectorAll('.select-panel-item').length >= 5`);

  // ── 9b-2a：folder 行右键 → DOM 右键菜单 ──
  await evalOn(pw, `(() => {
    const rows = Array.from(document.querySelectorAll('.select-panel-item .list-item.has-icon'));
    const target = rows.find((r) => !r.closest('.select-panel-item').querySelector('.history-badge'));
    if (!target) return false;
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    target.dispatchEvent(ev);
    return true;
  })()`);
  await assertExprOn(pw, 'pw4b-contextmenu-open', `(() => {
    const menu = document.querySelector('.context-menu');
    return !!menu && menu.classList.contains('open')
      && document.querySelectorAll('.context-menu .context-menu-item').length >= 2
      && !!document.querySelector('.context-menu-overlay');
  })()`);
  // 右键 openMore → more 分支不存在（无 more）→ 菜单保持
  const cmState = await evalOn(pw, `(() => {
    const labels = Array.from(document.querySelectorAll('.context-menu .context-menu-item .label')).map((el) => el.textContent.trim());
    return labels;
  })()`);
  console.log(`INFO menu labels: ${JSON.stringify(cmState)}`);
  // overlay 点击关闭
  await evalOn(pw, `(() => {
    document.querySelector('.context-menu-overlay').click();
    return true;
  })()`);
  await assertExprOn(pw, 'pw4b-contextmenu-overlay-close', `(() => {
    const menu = document.querySelector('.context-menu');
    return !!menu && !menu.classList.contains('open');
  })()`);

  // ── 9b-2a：library-switcher ──
  await assertExprOn(pw, 'pw4b-switcher-name', `(() => {
    const name = document.querySelector('.library-switcher .switcher-name');
    return !!name && name.textContent.trim().length > 0;
  })()`);
  await evalOn(pw, `(() => {
    document.querySelector('.library-switcher').click();
    return true;
  })()`);
  await assertExprOn(pw, 'pw4b-switcher-menu-open', `(() => {
    const menu = document.querySelector('.context-menu');
    return !!menu && menu.classList.contains('open') && !!menu.querySelector('input[type=search]');
  })()`);
  const swItems = await evalOn(pw, `document.querySelectorAll('.context-menu .context-menu-item').length`);
  console.log(`INFO switcher menu items: ${swItems}`);
  // 关闭（Esc → search keyup 27）
  await evalOn(pw, `(() => {
    const input = document.querySelector('.context-menu input[type=search]');
    input.dispatchEvent(new KeyboardEvent('keyup', { keyCode: 27, bubbles: true }));
    return true;
  })()`);
  await assertExprOn(pw, 'pw4b-switcher-menu-esc-close', `(() => {
    const menu = document.querySelector('.context-menu');
    return !!menu && !menu.classList.contains('open');
  })()`);

  // ── 9b-2b：TagSelectPanel ──
  await evalOn(pw, `(() => {
    const btn = document.querySelector('.label-container .create-label-btn:not(.full-width)');
    if (!btn) return 'no-btn';
    btn.click();
    return true;
  })()`);
  await assertExprOn(pw, 'pw4c-tagpanel-open', `(() => {
    const panel = document.querySelector('.tag-select-panel');
    return !!panel && panel.classList.contains('open')
      && !!document.getElementById('tag-select-panel-search-input');
  })()`);
  await assertExprOn(pw, 'pw4c-tagpanel-groups', `(() => {
    const labels = document.querySelectorAll('.tag-select-panel .group-label');
    const items = document.querySelectorAll('.tag-select-panel .select-panel-item');
    return labels.length >= 1 && items.length >= 2;
  })()`);
  await assertExprOn(pw, 'pw4c-tagpanel-checked', `document.querySelectorAll('.tag-select-panel .select-panel-item.checked').length >= 2`);
  // toggle 第一个 checked 项 → selectedTags 移除
  await evalOn(pw, `(() => {
    const item = document.querySelector('.tag-select-panel .select-panel-item.checked .list-item');
    if (!item) return false;
    item.click();
    return true;
  })()`);
  // Esc 关闭 → onChanged → collectItem.tags 更新
  await evalOn(pw, `(() => {
    const input = document.getElementById('tag-select-panel-search-input');
    input.dispatchEvent(new KeyboardEvent('keyup', { keyCode: 27, bubbles: true }));
    return true;
  })()`);
  await assertExprOn(pw, 'pw4c-tagpanel-close-sync', `window.__eagleCollectController.collectItem.tags.length === 2`);
  // 再开 → 搜索 NewTag → create 行 → enter 建立 → close 后 tags 含 NewTag
  await evalOn(pw, `(() => {
    document.querySelector('.label-container .create-label-btn:not(.full-width)').click();
    return true;
  })()`);
  await assertExprOn(pw, 'pw4c-tagpanel-reopen', `document.querySelector('.tag-select-panel').classList.contains('open')`);
  // open(0ms) 先于 init(10ms)：等 init 的 reset 完成再输入，否则输入被清
  await delay(150);
  await evalOn(pw, `(() => {
    const input = document.getElementById('tag-select-panel-search-input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'NewTag');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await delay(150);
  await assertExprOn(pw, 'pw4c-tagpanel-create-row', `(() => {
    const rows = Array.from(document.querySelectorAll('.tag-select-panel .list-item.create .name'));
    return rows.some((el) => el.textContent.indexOf('NewTag') > -1);
  })()`);
  console.log('INFO pre-enter ' + JSON.stringify(await evalOn(pw, `(() => {
    const p = window.__eagleCollectTagPanel;
    return { cur: p.listData.currentItem && p.listData.currentItem.name, idx: p.listData.currentIndex, kw: p.listData.searchKeyword, groups: p.listData.groups.map(g => g.id + ':' + g.items.length).join(',') };
  })()`)));
  await evalOn(pw, `(() => {
    const input = document.getElementById('tag-select-panel-search-input');
    input.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 13, bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { keyCode: 13, bubbles: true }));
    return true;
  })()`);
  await evalOn(pw, `(() => {
    const input = document.getElementById('tag-select-panel-search-input');
    input.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 27, bubbles: true, cancelable: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { keyCode: 27, bubbles: true }));
    return true;
  })()`);
  console.log('INFO created-dump ' + JSON.stringify(await evalOn(pw, `(() => {
    const p = window.__eagleCollectTagPanel;
    return {
      tags: window.__eagleCollectController.collectItem.tags,
      selected: p ? Object.keys(p.listData.selectedTags || {}) : null,
      search: p ? p.listData.searchKeyword : null,
      kw: p ? p.listData.currentItem && p.listData.currentItem.name : null,
    };
  })()`)));
  await assertExprOn(pw, 'pw4c-tagpanel-created', `(() => {
    const tags = window.__eagleCollectController.collectItem.tags;
    return tags.indexOf('NewTag') > -1;
  })()`);

  // ── 9b-2c：vs-repeat 切片 ──
  await assertExprOn(pw, 'pw4d-vr-sliced', `(() => {
    const p = window.__eagleCollectTagPanel;
    const fp = window.__eagleCollectFolderPanel;
    if (!fp) return false;
    const total = fp.listData.items.length;
    const rendered = document.querySelectorAll('.select-panel-item').length;
    const spacers = Array.from(document.querySelectorAll('select-panel-list > div'))
      .map((el) => el.getBoundingClientRect().height)
      .filter((h) => h > 0);
    return total > 50 && rendered < total && spacers.length >= 1;
  })()`);
  // 滚到底 → 最后一项（Bulk-60）进入窗口
  await evalOn(pw, `(() => {
    const list = document.querySelector('select-panel-list');
    if (!list) return false;
    list.scrollTop = list.scrollHeight;
    list.dispatchEvent(new Event('scroll'));
    return true;
  })()`);
  await delay(400);
  await assertExprOn(pw, 'pw4d-vr-scroll-bottom', `(() => {
    const items = Array.from(document.querySelectorAll('.select-panel-item .name'));
    return items.some((el) => el.textContent.indexOf('Bulk-60') > -1);
  })()`);

  await delay(600);
  try {
    const screenshot = await Promise.race([
      pw.send('Page.captureScreenshot', { format: 'png' }),
      delay(5000).then(() => { throw new Error('screenshot timeout'); }),
    ]);
    fs.mkdirSync('test-run', { recursive: true });
    fs.writeFileSync('test-run/react-stage9b1-collect.png', Buffer.from(screenshot.data, 'base64'));
    console.log('PASS screenshot-saved test-run/react-stage9b1-collect.png');
  } catch (err) {
    console.log(`WARN screenshot failed: ${err.message}`);
  }

  if (failures.length > 0) {
    console.error(`\nSTAGE9B1 SMOKE FAILED: ${failures.length} assertion(s): ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nSTAGE9B1 SMOKE OK');
  }
} catch (err) {
  console.error('SMOKE ERROR:', err && err.stack || err);
  process.exitCode = 1;
} finally {
  await stop(stack).catch(() => {});
  try { process.exit(process.exitCode || 0); } catch (err) {}
}
