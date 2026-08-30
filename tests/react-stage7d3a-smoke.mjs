/**
 * React 化改造 —— 阶段7d-3a收尾闭环测试（inspectorTagSelectPanel）。
 *
 * 运行：node tests/react-stage7d3a-smoke.mjs
 * 断言点：
 *  1. 壳：宿主存在；旧 <inspector-tag-select-panel> 岛已删除；React 渲染面板根元素
 *  2. INSPECTOR.TAG.SELECT.PANEL.OPEN 广播 → open + 预选标签 selected 类
 *  3. 置顶按钮 → isPined + pinned class + overlay 隐藏
 *  4. 键盘 ↓→Enter 翻转预选标签（onRemove 数据面 → selectedTags 更新）
 *  5. Esc 关闭；watchCollection selected（pinned 时）不崩
 *  6. 截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage7d3a-'));
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
      await post('/api/library/create', { name: 'React Stage7d3a Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's7d3a.png'), png);
      await post('/api/tag/create', { name: '参考素材' });
      const item = await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's7d3a.png')] });
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

  // inspector 面板搜索输入的键盘事件（元素级选择器：与 general 面板 id 重复，不能用 getElementById）
  const pressPanelKey = async (keyCode) => {
    await page.send('Runtime.evaluate', {
      expression: `(() => {
        const input = document.querySelector('inspector-tag-select-panel .panel-header input');
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
    'itp-host',
    `!!document.getElementById('eagle-inspector-tag-select-panel-host')`
  );
  await assertExpr(
    'itp-old-island-gone',
    `!document.querySelector('inspector-tag-select-panel[theme]')`
  );
  await assertExpr(
    'itp-root-rendered',
    `!!document.querySelector('#eagle-inspector-tag-select-panel-host inspector-tag-select-panel > select-panel.tag-select-panel')`
  );

  // ── 选中图片 → 广播打开（预选 参考素材） ──
  // 注：mock 环境 /api/item/update 不回写本地模型 item.tags，测试直接设模型（模拟带标签选中项）；
  // 原版时序：选区变化 → inspector 控制器 30ms 防抖写 eagle.inspector.newTags → 之后广播才有预选
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const body = window.$bodyScope;
      body.raw[0].tags = ['参考素材'];
      body.selected = [body.raw[0]];
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(600);
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.$bodyScope.$broadcast('INSPECTOR.TAG.SELECT.PANEL.OPEN');
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'itp-open',
    `document.querySelector('inspector-tag-select-panel .tag-select-panel').classList.contains('open')`
  );
  await assertExpr(
    'itp-tag-rendered-selected',
    `(() => {
      const items = Array.from(document.querySelectorAll('inspector-tag-select-panel .grid-item .list-item .name'));
      if (!items.some((n) => n.textContent.includes('参考素材'))) return false;
      const target = items.find((n) => n.textContent.includes('参考素材'));
      const item = target.closest('.select-panel-item');
      return item && item.querySelector('.list-item').classList.contains('selected');
    })()`
  );

  // ── 置顶：isPined + pinned class + overlay 隐藏 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const pinBtn = document.querySelector('inspector-tag-select-panel .panel-header .ic-btn img[src*="ic-window-pin"]');
      pinBtn.closest('.ic-btn').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(150);
  await assertExpr(
    'itp-pinned',
    `(() => {
      const sp = document.querySelector('inspector-tag-select-panel .tag-select-panel');
      return sp.classList.contains('pinned') && window.__eagleInspectorTagSelectPanel.isPined === true;
    })()`
  );
  await assertExpr(
    'itp-overlay-hidden-when-pinned',
    `document.querySelector('inspector-tag-select-panel select-panel-overlay').style.display === 'none'`
  );

  // ── 键盘 ↓→Enter 翻转预选标签（数据面：onRemove → selectedTags） ──
  await pressPanelKey(40);
  await pressPanelKey(13);
  await assertExpr(
    'itp-enter-toggled-off',
    `(() => {
      const target = Array.from(document.querySelectorAll('inspector-tag-select-panel .grid-item .list-item .name'))
        .find((n) => n.textContent.includes('参考素材'));
      const item = target && target.closest('.select-panel-item');
      return item && !item.querySelector('.list-item').classList.contains('selected');
    })()`
  );
  await assertExpr(
    'itp-onremove-dataplane',
    `(() => {
      const selectedTags = window.__eagleInspectorTagSelectPanel.listData.selectedTags;
      return selectedTags['参考素材'] !== true;
    })()`
  );

  // ── Esc 关闭（pinned 态下 close 仍移除 open） ──
  await pressPanelKey(27);
  await assertExpr(
    'itp-esc-closed',
    `!document.querySelector('inspector-tag-select-panel .tag-select-panel').classList.contains('open')`
  );

  // ── 截图留档（重新打开） ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.$bodyScope.$broadcast('INSPECTOR.TAG.SELECT.PANEL.OPEN');
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(500);
  await screenshotTo('test-run/react-stage7d3a-inspector-panel.png', 5000);

  if (failures.length > 0) {
    console.error(`\nSTAGE7D3A SMOKE FAILED: ${failures.length} assertion(s): ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nSTAGE7D3A SMOKE OK');
  }
} finally {
  await stop(stack).catch(() => {});
  // undici keep-alive socket 会拖住事件循环，测试结果已输出，直接强退
  try { process.exit(process.exitCode || 0); } catch (err) {}
}
