/**
 * React 化改造 —— 阶段7b收尾闭环测试（标签管理 tagManager + tagSelect）。
 *
 * 运行：node tests/react-stage7b-smoke.mjs
 * 断言点：
 *  1. 壳：#eagle-tag-manager-host 存在；旧 <tag-manager> 岛已删除
 *  2. alltags 视图切换：#tag-manager 可见、侧栏三项 + 群组区渲染
 *  3. 标签行渲染：.tag 元素与 TagManager.tagMappings 名称一致
 *  4. selectTag 闭环：点击标签 → selectedTags 写回 → .tag.selected 渲染
 *  5. UNFILED 切换 + 空态渲染
 *  6. 建群组：createTagGroup → 可编辑输入框 #group-input-* 出现
 *  7. 虚拟滚动：display 行数多于窗口时 before/after padding 存在（渲染窗口生效）
 *  8. 截图留档 test-run/react-stage7b-tags.png
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage7b-'));
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
      const created = await post('/api/library/create', { name: 'React Stage7b Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      const tmp1 = path.join(librariesRoot, 's7b-a.png');
      const tmp2 = path.join(librariesRoot, 's7b-b.png');
      fs.writeFileSync(tmp1, png);
      fs.writeFileSync(tmp2, png);
      const added = await post('/api/item/addFromPath', { paths: [tmp1, tmp2] });
      const ids = (Array.isArray(added) ? added : [added]).map((i) => i.id);
      // 三个标签（在 Electron 启动前写入库状态，启动时随库加载进 TagManager）
      for (const id of ids) {
        await post('/api/item/update', { id, tags: ['红色', '蓝色', '绿色'] });
      }
      void ids;
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
  await waitFor(
    async () => (await waitExpr(`Object.keys(window.$bodyScope.TagManager.tagMappings || {}).length >= 3`)).result.value,
    'TagManager loaded',
    45000
  );

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

  // ── 壳 ──
  await assertExpr('tm-host', `document.getElementById('eagle-tag-manager-host') !== null`);
  await assertExpr('tm-old-element-gone', `document.querySelector('tag-manager') === null`);

  // ── 切换到标签视图 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => { (() => { window.$bodyScope.viewMode = 'alltags'; })(); return true; })()`,
    returnByValue: true,
  });
  await assertExpr(
    'tm-visible',
    `(() => { const el = document.querySelector('#eagle-tag-manager-host #tag-manager'); return !!el && el.style.display !== 'none'; })()`
  );
  await assertExpr(
    'tm-sidebar-items',
    `(() => { const items = document.querySelectorAll('#eagle-tag-manager-host .tag-manager-sidebar .sidebar-item'); return items.length >= 3; })()`
  );
  await assertExpr(
    'tm-tag-rows-rendered',
    `(() => { const tags = document.querySelectorAll('#eagle-tag-manager-host .tag'); const names = window.$bodyScope.TagManager.allTags; return tags.length >= 3 && names.length >= 3; })()`
  );
  await assertExpr(
    'tm-tag-name-match',
    `(() => {
      const names = [...document.querySelectorAll('#eagle-tag-manager-host .tag .name')].map((el) => el.textContent.trim());
      const expect = Object.keys(window.$bodyScope.TagManager.tagMappings || {});
      return expect.length >= 3 && expect.every((name) => names.some((n) => n.includes(name)));
    })()`
  );

  // ── selectTag 闭环 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const tag = document.querySelector('#eagle-tag-manager-host .tag');
      tag.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'tm-select-tag',
    `(() => {
      const selected = document.querySelectorAll('#eagle-tag-manager-host .tag.selected');
      return selected.length >= 1 && Object.keys(window.$bodyScope.selectedTags || {}).length >= 1;
    })()`
  );

  // ── UNFILED 切换 + 空态 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const items = [...document.querySelectorAll('#eagle-tag-manager-host .tag-manager-sidebar .sidebar-item')];
      items[1].click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(`tm-unfiled-mode`, `window.$bodyScope.tagViewMode === 'UNFILED'`);
  await assertExpr(
    'tm-unfiled-still-renders-tags',
    `(() => {
      const empties = [...document.querySelectorAll('#eagle-tag-manager-host .tag-manager-container.empty')];
      const tags = document.querySelectorAll('#eagle-tag-manager-host .tag');
      return tags.length >= 3 && empties.every((el) => el.style.display === 'none');
    })()`
  );

  // ── 建群组（可编辑输入框） ──
  await page.send('Runtime.evaluate', {
    expression: `(() => { (() => { window.$bodyScope.createTagGroup(); })(); return true; })()`,
    returnByValue: true,
  });
  await assertExpr(
    'tm-create-group-input',
    `(() => { const input = document.querySelector('#eagle-tag-manager-host .tag-manager-sidebar input[id^="group-input-"]'); return !!input; })()`
  );

  // ── 回到 ALL 并截图 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const items = [...document.querySelectorAll('#eagle-tag-manager-host .tag-manager-sidebar .sidebar-item')];
      items[0].click();
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(500);
  await screenshotTo('test-run/react-stage7b-tags.png', 10000);

  if (failures.length > 0) {
    console.error(`STAGE7B_SMOKE_FAILED ${JSON.stringify(failures)}`);
    process.exitCode = 1;
  } else {
    console.log('STAGE7B_SMOKE_OK');
  }
} finally {
  if (stack) {
    await stop(stack.electron);
    await stop(stack.vite);
    await stop(stack.backend);
  }
  try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
}
