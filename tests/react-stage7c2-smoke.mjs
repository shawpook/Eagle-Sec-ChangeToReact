/**
 * React 化改造 —— 阶段7c-2收尾闭环测试（quickSearchModal）。
 *
 * 运行：node tests/react-stage7c2-smoke.mjs
 * 断言点：
 *  1. 壳：#eagle-quick-search-host + #quick-search-panel 存在；旧 <quick-search-modal> 岛已删除
 *  2. OPEN_QUICK_SEARCH_MODAL 广播 → #quick-search-panel.open + 输入框聚焦 + body scope keyword 清空
 *  3. FOLDERS 默认模式：结果=文件夹树扁平列表；tabs 计数 span 保持 isolate-scope 隐藏形态
 *  4. ↓/↑ 移动 active-item；输入关键词 → 拼音/模糊过滤首个结果
 *  5. Enter → openFolder 数据面（currentFolder 切换）+ 关闭 + localStorage
 *     eagle.quickSearch.history / eagle.quickSearch.folder.history 写入
 *  6. Tab 循环模式（searchMode 跨打开持久，与原版一致）：TAGS（标签结果 + Enter → openTag
 *     数据面 viewMode=''）、SMARTFOLDERS（空库空态）、ITEMS（.search-result-item.large + 缩略图）
 *  7. Esc → 关闭 + $root.currentFocus='content'；overlay 点击 → closeQuickSearch 广播关闭
 *  8. 截图留档 test-run/react-stage7c2-quicksearch.png
 * 注：FOLDERS/SMARTFOLDERS 的「最近使用」分支要求 folderList>15 且有历史，本库规模不满足，
 *     该分支逻辑为逐字移植，由代码评审覆盖。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage7c2-'));
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
      await post('/api/library/create', { name: 'React Stage7c2 Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's7c2.png'), png);
      const folderA = await post('/api/folder/create', { name: '设计参考' });
      await post('/api/folder/create', { name: '子文件夹', parent: folderA.id });
      await post('/api/folder/create', { name: '灵感收集' });
      await post('/api/tag/create', { name: '参考素材' });
      const item = await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's7c2.png')] });
      const itemId = Array.isArray(item) ? item[0].id : item.id;
      await post('/api/item/update', { id: itemId, tags: ['参考素材'] });
      await post('/api/item/addToFolder', { ids: [itemId], folderID: folderA.id });
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

  const screenshotTo = async (file, timeoutMs) => {
    try {
      const screenshot = await Promise.race([
        page.send('Page.captureScreenshot', { format: 'png' }),
        delay(timeoutMs).then(() => { throw new Error(`screenshot timeout (${timeoutMs}ms)`); }),
      ]);
      fs.mkdirSync('test-run', { recursive: true });
      fs.writeFileSync(file, Buffer.from(screenshot.data, 'base64'));
      console.log(`PASS screenshot-saved ${file}`);
    } catch (err) {
      console.log(`WARN screenshot failed: ${err.message}`);
    }
  };

  const failures = [];
  const assertExpr = async (name, expression, timeout = 12000) => {
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

  const evalNow = async (expression) => (await waitExpr(expression)).result.value;

  const openQuickSearch = async () => {
    await page.send('Runtime.evaluate', {
      expression: `(() => { window.$bodyScope.$root.$broadcast('OPEN_QUICK_SEARCH_MODAL'); return true; })()`,
      returnByValue: true,
    });
    await waitFor(async () => (await waitExpr(`document.getElementById('quick-search-panel').classList.contains('open')`)).result.value, 'quick-search open', 8000);
    // searchMode 与 keyword 跨打开持久（与原版 isolate scope 行为一致）——统一清空再操作
    await typeKeyword('');
  };

  const typeKeyword = async (keyword) => {
    await page.send('Runtime.evaluate', {
      expression: `(() => {
        const input = document.getElementById('quick-search-input');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, ${JSON.stringify(keyword)});
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()`,
      returnByValue: true,
    });
    await delay(180); // ng-model debounce 50ms + 计算
  };

  const pressKey = async (keyCode, key) => {
    await page.send('Runtime.evaluate', {
      expression: `(() => {
        const input = document.getElementById('quick-search-input');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, keyCode: ${keyCode}, which: ${keyCode}, bubbles: true }));
        return true;
      })()`,
      returnByValue: true,
    });
    await delay(60);
  };

  // Tab 循环切到目标 tab（searchMode 持久）
  const cycleToTab = async (targetIdx) => {
    for (let i = 0; i < 5; i++) {
      const cur = await evalNow(
        `Array.from(document.querySelectorAll('#quick-search-panel .tabs .tab')).findIndex((t) => t.classList.contains('active'))`
      );
      if (cur === targetIdx) return true;
      await pressKey(9, 'Tab');
    }
    return false;
  };

  // ── 壳 ──
  await assertExpr(
    'qs-host-and-panel',
    `!!document.getElementById('eagle-quick-search-host') && !!document.querySelector('#eagle-quick-search-host #quick-search-panel.quick-search') && !!document.querySelector('#eagle-quick-search-host .quick-search-overlay')`
  );
  await assertExpr('qs-old-island-gone', `!document.querySelector('quick-search-modal')`);
  await assertExpr(
    'qs-closed-initially',
    `!document.getElementById('quick-search-panel').classList.contains('open')`
  );

  // ── 打开（广播通道 + 自动聚焦） ──
  await openQuickSearch();
  await assertExpr('qs-open-focused', `document.activeElement && document.activeElement.id === 'quick-search-input'`);
  await assertExpr('qs-body-keyword-cleared', `window.$bodyScope.keyword === ''`);
  await assertExpr(
    'qs-folders-default-mode',
    `document.querySelectorAll('#folder-search-result-container .search-result-item').length >= 3`
  );
  await assertExpr(
    'qs-tab-count-spans-hidden',
    `Array.from(document.querySelectorAll('#quick-search-panel .tabs .tab span')).every((s) => getComputedStyle(s).display === 'none')`
  );
  await assertExpr(
    'qs-tabs-order',
    `(() => {
      const tabs = Array.from(document.querySelectorAll('#quick-search-panel .tabs .tab'));
      return tabs.length === 4 && tabs[0].classList.contains('active');
    })()`
  );

  // ── ↓/↑ 移动 active ──
  await pressKey(40, 'ArrowDown');
  await assertExpr(
    'qs-arrow-down-active',
    `(() => {
      const items = document.querySelectorAll('#folder-search-result-container .search-result-item');
      return items.length >= 2 && items[1].classList.contains('active-item') && !items[0].classList.contains('active-item');
    })()`
  );
  await pressKey(38, 'ArrowUp');

  // ── 输入过滤（拼音/模糊） ──
  await typeKeyword('设计参考');
  await assertExpr(
    'qs-filter-first-result',
    `(() => {
      const first = document.querySelector('#folder-search-result-container .search-result-item .name');
      return first && first.textContent.includes('设计参考');
    })()`
  );
  await assertExpr(
    'qs-filter-first-active',
    `(() => {
      const items = document.querySelectorAll('#folder-search-result-container .search-result-item');
      return items.length >= 1 && items[0].classList.contains('active-item') && items[0].classList.contains('search-mode');
    })()`
  );

  // ── Enter → openFolder 数据面 + 历史 ──
  const targetFolderId = await evalNow(
    `(() => { const f = window.$bodyScope.folders.find((x) => x.name === '设计参考'); return f ? f.id : ''; })()`
  );
  await pressKey(13, 'Enter');
  await assertExpr('qs-enter-closes', `!document.getElementById('quick-search-panel').classList.contains('open')`);
  await assertExpr('qs-enter-current-folder', `window.$bodyScope.currentFolder && window.$bodyScope.currentFolder.id === ${JSON.stringify(targetFolderId)}`);
  await assertExpr(
    'qs-history-saved',
    `(() => {
      const h = JSON.parse(localStorage.getItem('eagle.quickSearch.history') || '[]');
      const fh = JSON.parse(localStorage.getItem('eagle.quickSearch.folder.history') || '[]');
      return h[0] === '设计参考' && fh[0] === ${JSON.stringify(targetFolderId)};
    })()`
  );

  // ── Tab → TAGS ──
  await openQuickSearch();
  await cycleToTab(1);
  await assertExpr(
    'qs-tab-tags-active',
    `(() => {
      const tabs = Array.from(document.querySelectorAll('#quick-search-panel .tabs .tab'));
      return tabs[1].classList.contains('active') && !tabs[0].classList.contains('active');
    })()`
  );
  await assertExpr(
    'qs-tags-rendered',
    `(() => {
      const names = Array.from(document.querySelectorAll('#tags-search-result-container .search-result-item .name')).map((n) => n.textContent);
      return names.includes('参考素材');
    })()`
  );
  await assertExpr(
    'qs-tags-ungrouped-no-parent',
    `(() => {
      const item = Array.from(document.querySelectorAll('#tags-search-result-container .search-result-item'))
        .find((el) => el.querySelector('.name') && el.querySelector('.name').textContent === '参考素材');
      return item && item.querySelector('.parent-name') === null;
    })()`
  );
  await typeKeyword('参考素材');
  await pressKey(13, 'Enter');
  // openTag → TagManager.filterWithTags → viewMode='' + openAll → 最终 viewMode='all'（原版同路径）
  await assertExpr(
    'qs-tag-open-viewmode',
    `window.$bodyScope.viewMode === 'all' && window.$bodyScope.currentFolder === undefined`
  );
  await assertExpr('qs-tag-open-closed', `!document.getElementById('quick-search-panel').classList.contains('open')`);

  // ── Tab → ITEMS ──
  await openQuickSearch();
  await cycleToTab(3);
  await assertExpr(
    'qs-items-active',
    `(() => {
      const tabs = Array.from(document.querySelectorAll('#quick-search-panel .tabs .tab'));
      return tabs[3].classList.contains('active');
    })()`
  );
  await assertExpr(
    'qs-items-rendered',
    `(() => {
      const items = document.querySelectorAll('#items-search-result-container .search-result-item.large');
      return !!(items.length === 1 && items[0].querySelector('img') && items[0].querySelector('img').getAttribute('src'));
    })()`
  );
  await assertExpr(
    'qs-items-meta-folder-link',
    `(() => {
      const meta = document.querySelector('#items-search-result-container .search-result-item .meta');
      return meta && meta.querySelector('span.parent') !== null && meta.textContent.includes('设计参考');
    })()`
  );

  // ── Esc → 关闭 + currentFocus ──
  await pressKey(27, 'Escape');
  await assertExpr(
    'qs-esc-closes-focus-content',
    `!document.getElementById('quick-search-panel').classList.contains('open') && window.$bodyScope.$root.currentFocus === 'content'`
  );

  // ── overlay 点击 → closeQuickSearch 广播 ──
  await openQuickSearch();
  await page.send('Runtime.evaluate', {
    expression: `(() => { document.querySelector('#eagle-quick-search-host .quick-search-overlay').click(); return true; })()`,
    returnByValue: true,
  });
  await assertExpr('qs-overlay-closes', `!document.getElementById('quick-search-panel').classList.contains('open')`);

  // ── SMARTFOLDERS（空库 → 空态） ──
  await openQuickSearch();
  await cycleToTab(2);
  await assertExpr(
    'qs-smartfolder-tab',
    `(() => {
      const tabs = Array.from(document.querySelectorAll('#quick-search-panel .tabs .tab'));
      return tabs[2].classList.contains('active');
    })()`
  );
  await assertExpr(
    'qs-smartfolder-empty-state',
    `(() => {
      const section = Array.from(document.querySelectorAll('#quick-search-panel .search-result')).find((el) => el.querySelector('#smartfolder-search-result-container'));
      const empty = section.querySelector('.empty');
      return empty && getComputedStyle(empty).display !== 'none';
    })()`
  );
  await pressKey(27, 'Escape');

  // ── 截图留档 ──
  await openQuickSearch();
  await cycleToTab(0);
  await typeKeyword('设计');
  await screenshotTo('test-run/react-stage7c2-quicksearch.png', 5000);
  await pressKey(27, 'Escape');

  if (failures.length > 0) {
    console.error(`\nSTAGE7C2 SMOKE FAILED: ${failures.length} assertion(s): ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nSTAGE7C2 SMOKE OK');
  }
} finally {
  await stop(stack).catch(() => {});
}
