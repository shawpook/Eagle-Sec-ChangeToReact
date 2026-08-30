/**
 * React 化改造 —— 阶段7d-1c-1收尾闭环测试（tagsInput + GeneralTagSelectPanel + AutoTagging）。
 *
 * 运行：node tests/react-stage7d1c1-smoke.mjs
 * 断言点：
 *  1. 壳：两个宿主存在；旧 AutoTaggingController 块与 <general-tag-select-panel> 岛已删除
 *  2. GeneralTagSelectPanel：GENERAL.TAG.SELECT.PANEL.OPEN 广播 → select-panel.open +
 *     标签网格渲染（预选标签 selected 类）；键盘 ↓→Enter 翻转选中；Esc → onChanged
 *     数据面（isDirty/deselectedTags）+ 面板关闭
 *  3. AutoTagging：FOLDER_SETTINGS 广播 → 弹窗开 + 名称回填；点击 tags-input → 标签面板开 →
 *     键盘选中标签 → Esc 回写 folderTags（label 渲染）；改名 + save → folder.name/tags 数据面
 *     + 弹窗关闭
 *  4. 截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage7d1c1-'));
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
      await post('/api/library/create', { name: 'React Stage7d1c1 Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's7d1c1.png'), png);
      await post('/api/folder/create', { name: '自动标签夹' });
      await post('/api/tag/create', { name: '参考素材' });
      const item = await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's7d1c1.png')] });
      const itemId = Array.isArray(item) ? item[0].id : item.id;
      await post('/api/item/update', { id: itemId, tags: ['参考素材'] });
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

  // 面板搜索输入的键盘事件（jQuery 绑定，原生 dispatch）
  const pressPanelKey = async (keyCode) => {
    await page.send('Runtime.evaluate', {
      expression: `(() => {
        const input = document.getElementById('tag-select-panel-search-input');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', keyCode: ${keyCode}, which: ${keyCode}, bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'x', keyCode: ${keyCode}, which: ${keyCode}, bubbles: true }));
        return true;
      })()`,
      returnByValue: true,
    });
    await delay(120);
  };

  // ── 壳 ──
  await assertExpr(
    'sp-hosts',
    `!!document.getElementById('eagle-general-tag-select-panel-host') && !!document.getElementById('eagle-auto-tagging-host')`
  );
  await assertExpr(
    'sp-old-blocks-gone',
    `!document.querySelector('[ng-controller="AutoTaggingController"]') && !document.querySelector('general-tag-select-panel[theme]')`
  );
  await assertExpr(
    'sp-root-rendered',
    `!!document.querySelector('#eagle-general-tag-select-panel-host general-tag-select-panel > select-panel.tag-select-panel')`
  );

  // ── GeneralTagSelectPanel：广播打开（预选 参考素材） ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.__tagPanelResult = null;
      window.$bodyScope.$root.$broadcast('GENERAL.TAG.SELECT.PANEL.OPEN', {
        tagManager: window.$bodyScope.TagManager,
        selectedTags: { '参考素材': true },
        onChanged: (r) => { window.__tagPanelResult = r; },
      });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'gtp-open',
    `document.querySelector('general-tag-select-panel .tag-select-panel').classList.contains('open')`
  );
  await assertExpr(
    'gtp-tag-rendered-selected',
    `(() => {
      const items = Array.from(document.querySelectorAll('general-tag-select-panel .grid-item .list-item .name'));
      if (!items.some((n) => n.textContent.includes('参考素材'))) return false;
      const target = items.find((n) => n.textContent.includes('参考素材'));
      const item = target.closest('.select-panel-item');
      return item && item.querySelector('.list-item').classList.contains('selected');
    })()`
  );

  // ── 键盘：↓ 选中第一项 → Enter 翻转 → Esc 关闭回调 ──
  await pressPanelKey(40);
  await assertExpr(
    'gtp-active-item',
    `(() => {
      const active = document.querySelector('general-tag-select-panel .grid-item .select-panel-item .list-item.active');
      return active && active.querySelector('.name').textContent.includes('参考素材');
    })()`
  );
  await pressPanelKey(13);
  await assertExpr(
    'gtp-enter-toggled-off',
    `(() => {
      const target = Array.from(document.querySelectorAll('general-tag-select-panel .grid-item .list-item .name'))
        .find((n) => n.textContent.includes('参考素材'));
      const item = target && target.closest('.select-panel-item');
      return item && !item.querySelector('.list-item').classList.contains('selected');
    })()`
  );
  await pressPanelKey(27);
  await assertExpr('gtp-esc-closed', `!document.querySelector('general-tag-select-panel .tag-select-panel').classList.contains('open')`);
  await assertExpr(
    'gtp-onchanged-dataplane',
    `window.__tagPanelResult && window.__tagPanelResult.isDirty === true && window.__tagPanelResult.deselectedTags['参考素材'] === true`
  );

  // ── AutoTagging：FOLDER_SETTINGS → 弹窗 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const s = window.$bodyScope;
      s.$root.$broadcast('FOLDER_SETTINGS', s.folders.find((f) => f.name === '自动标签夹'));
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'at-modal-open',
    `document.querySelector('#eagle-auto-tagging-host .auto-tagging-modal').classList.contains('open')`
  );
  await assertExpr(
    'at-name-filled',
    `document.getElementById('auto-tagging-name-input').value === '自动标签夹'`
  );

  // 点击 tags-input → 标签面板开 → 键盘选中标签 → Esc 回写
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('#eagle-auto-tagging-host #tags-input').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr('gtp-reopen', `document.querySelector('general-tag-select-panel .tag-select-panel').classList.contains('open')`);
  await delay(300); // 等 init（setTimeout 10ms）完成

  // 键盘选中标签 → Esc 关闭 → onChanged 回写 folderTags
  await pressPanelKey(40);
  await pressPanelKey(13);
  await pressPanelKey(27);
  await assertExpr('gtp-closed-again', `!document.querySelector('general-tag-select-panel .tag-select-panel').classList.contains('open')`);
  await assertExpr(
    'at-tags-written-back',
    `(() => {
      const labels = Array.from(document.querySelectorAll('#eagle-auto-tagging-host .label-item-name')).map((n) => n.textContent);
      return labels.includes('参考素材');
    })()`
  );

  // 改名 + save → 数据面
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.getElementById('auto-tagging-name-input');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '自动标签夹改名');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(120);
  const folderId = await evalNow(`(() => { const f = window.$bodyScope.folders.find((x) => x.name === '自动标签夹'); return f ? f.id : ''; })()`);
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('#eagle-auto-tagging-host .button-primary').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(400);
  await assertExpr('at-closed', `!document.querySelector('#eagle-auto-tagging-host .auto-tagging-modal').classList.contains('open')`);
  await assertExpr(
    'at-save-dataplane',
    `(() => {
      const f = window.$bodyScope.folderMappings[${JSON.stringify(folderId)}];
      return f && f.name === '自动标签夹改名' && f.tags.indexOf('参考素材') !== -1;
    })()`
  );

  // ── 截图留档（面板打开态） ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.$bodyScope.$root.$broadcast('GENERAL.TAG.SELECT.PANEL.OPEN', {
        tagManager: window.$bodyScope.TagManager,
        selectedTags: {},
        onChanged: () => {},
      });
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(400);
  await screenshotTo('test-run/react-stage7d1c1-panel.png', 5000);

  if (failures.length > 0) {
    console.error(`\nSTAGE7D1C1 SMOKE FAILED: ${failures.length} assertion(s): ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nSTAGE7D1C1 SMOKE OK');
  }
} finally {
  await stop(stack).catch(() => {});
  // undici keep-alive socket 会拖住事件循环，测试结果已输出，直接强退
  try { process.exit(process.exitCode || 0); } catch (err) {}
}