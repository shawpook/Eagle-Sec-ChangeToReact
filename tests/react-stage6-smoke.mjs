/**
 * React 化改造 —— 阶段6收尾闭环测试（检查器）。
 *
 * 运行：node tests/react-stage6-smoke.mjs
 * 断言点：
 *  1. 壳：#eagle-inspector-host 存在；旧 <inspector> 元素已删除
 *  2. .inspector 由 React 渲染（宽度样式来自快照、header 内 corner-btns）
 *  3. SIDEBAR 页签：分类名 contenteditable 渲染（viewMode=all → 「inspector.names.all」）
 *  4. 选择条目 → activeTab=ITEM，#inspector-name 内容 = 条目名；tags/folders/information 区块渲染
 *  5. 星级点击 → changeStar(1) → item.star === 1（数据面一致）
 *  6. 重命名闭环：#inspector-name blur 写回 → imagesChange → selected[0].name 变更
 *  7. 多选 → selected-count 显示 2
 *  8. 截图留档 test-run/react-stage6-list.png / -inspector.png
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage6-'));
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
      await post('/api/library/create', { name: 'React Stage6 Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      const tmp1 = path.join(librariesRoot, 'stage6-a.png');
      const tmp2 = path.join(librariesRoot, 'stage6-b.png');
      fs.writeFileSync(tmp1, png);
      fs.writeFileSync(tmp2, png);
      await post('/api/item/addFromPath', { paths: [tmp1] });
      await post('/api/item/addFromPath', { paths: [tmp2] });
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

  await screenshotTo('test-run/react-stage6-list.png', 10000);

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
  await assertExpr('inspector-host', `document.getElementById('eagle-inspector-host') !== null`);
  await assertExpr('inspector-old-element-gone', `document.querySelector('inspector') === null`);

  // ── React 渲染 .inspector ──
  await assertExpr(
    'inspector-rendered',
    `(() => { const host = document.getElementById('eagle-inspector-host'); return !!host && !!host.querySelector('.inspector'); })()`
  );
  await assertExpr(
    'inspector-width-style',
    `(() => { const el = document.querySelector('#eagle-inspector-host .inspector'); return !!el && /px/.test(el.style.width) && parseInt(el.style.width) >= 200; })()`
  );
  await assertExpr(
    'inspector-corner-btns',
    `(() => { return !!document.querySelector('#eagle-inspector-host .inspector-header .corner-btns'); })()`
  );

  // ── SIDEBAR 页签（无选中 → activeTab SIDEBAR，分类名 contenteditable 有值） ──
  await assertExpr(
    'inspector-sidebar-tab',
    `(() => { const contents = document.querySelectorAll('#eagle-inspector-host .inspector-content'); return contents.length >= 2; })()`
  );
  await assertExpr(
    'inspector-category-contenteditable',
    `(() => { const f = document.querySelector('#eagle-inspector-host .inspector-content form.properties-form [contenteditable]'); return !!f && f.textContent.length > 0; })()`
  );

  // ── 选择条目 → ITEM 页签 ──
  await page.send('Runtime.evaluate', {
    expression: `window.$bodyScope.$apply(() => { window.$bodyScope.selected = [window.$bodyScope.allData[0]]; window.__eagleBus.emit('UPDATE_INSPECTOR'); })`,
    returnByValue: true,
  });
  await assertExpr(
    'inspector-item-tab-name',
    `(() => { const name = document.getElementById('inspector-name'); return !!name && name.textContent.trim() === (window.$bodyScope.selected[0].name || ''); })()`,
    15000
  );
  await assertExpr(
    'inspector-sections-rendered',
    `(() => { const host = document.getElementById('eagle-inspector-host'); const sections = host.querySelectorAll('.info-section'); return sections.length >= 2; })()`
  );

  // ── 星级点击（数据面一致） ──
  await page.send('Runtime.evaluate', {
    expression: `(() => { const stars = document.querySelectorAll('#eagle-inspector-host .rating-container div'); stars[0].click(); return true; })()`,
    returnByValue: true,
  });
  await assertExpr(`inspector-star-changed`, `window.$bodyScope.selected[0] && window.$bodyScope.selected[0].star === 1`, 15000);

  // ── 重命名闭环（contenteditable blur → imagesChange → item 更新） ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const name = document.getElementById('inspector-name');
      name.textContent = 'Stage6 Renamed';
      name.dispatchEvent(new Event('blur'));
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr('inspector-rename-applied', `window.$bodyScope.selected[0] && window.$bodyScope.selected[0].name === 'Stage6 Renamed'`, 20000);

  // ── 多选 → selected-count ──
  await page.send('Runtime.evaluate', {
    expression: `window.$bodyScope.$apply(() => { window.$bodyScope.selected = [...window.$bodyScope.allData]; window.__eagleBus.emit('UPDATE_INSPECTOR'); })`,
    returnByValue: true,
  });
  await assertExpr(
    'inspector-selected-count',
    `(() => { const el = document.querySelector('#eagle-inspector-host .selected-count .count'); return !!el && el.textContent.trim() === '2'; })()`,
    15000
  );

  await screenshotTo('test-run/react-stage6-inspector.png', 10000);

  if (failures.length > 0) {
    console.error(`STAGE6_SMOKE_FAILED ${JSON.stringify(failures)}`);
    process.exitCode = 1;
  } else {
    console.log('STAGE6_SMOKE_OK');
  }
} finally {
  if (stack) {
    await stop(stack.electron);
    await stop(stack.vite);
    await stop(stack.backend);
  }
  try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
}
