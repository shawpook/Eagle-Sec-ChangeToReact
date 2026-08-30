/**
 * React 化改造 —— 阶段7d-3b收尾闭环测试（batchSavePanel + batchRectSelect）。
 *
 * 运行：node tests/react-stage7d3b-smoke.mjs
 * 断言点：
 *  1. 壳：宿主存在；旧 <batch-save-panel> 已删除；React 常驻渲染（closed）
 *  2. IMPORT_IMAGES 广播 → open + data URL 图片项渲染（BatchSaver 离线加载路径）
 *  3. 点击项选中 → 头部计数；搜索关键字过滤 displayed
 *  4. 文件夹选择 → FolderSelectPanel 选夹回写 label
 *  5. 全选 → import → uploadUrls 数据面（打桩）+ uploadQueue + 面板关闭
 *  6. Esc 关闭
 *  7. 截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage7d3b-'));
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
      await post('/api/library/create', { name: 'React Stage7d3b Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's7d3b.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's7d3b.png')] });
      await post('/api/folder/create', { name: '测试夹A' });
      await post('/api/folder/create', { name: '测试夹B' });
      await post('/api/tag/create', { name: '参考素材' });
      // 供冒烟广播使用的 data URL（320x200 png → 走 data:image 离线加载路径；两张不同 src 避免去重）
      const b64a = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      const b64b = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#f59e0b' } }).png().toBuffer();
      globalThis.__s7d3bDataUrlA = `data:image/png;base64,${b64a.toString('base64')}`;
      globalThis.__s7d3bDataUrlB = `data:image/png;base64,${b64b.toString('base64')}`;
    },
  });
  const { page } = stack;
  const dataUrl = globalThis.__s7d3bDataUrlA;
  const dataUrlB = globalThis.__s7d3bDataUrlB;

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

  const evalNow = async (expression) => (await waitExpr(expression)).result.value;

  // ── 壳 ──
  await assertExpr('bsp-host', `!!document.getElementById('eagle-batch-save-panel-host')`);
  await assertExpr('bsp-old-element-gone', `!document.querySelector('batch-save-panel[theme]') && !document.querySelector('batch-save-panel[folders]')`);
  await assertExpr(
    'bsp-root-rendered-closed',
    `!!document.querySelector('#eagle-batch-save-panel-host #batch-save-panel.batch-save-panel') && !document.querySelector('#eagle-batch-save-panel-host #batch-save-panel.open')`
  );

  // ── IMPORT_IMAGES 广播 → open + 渲染 ──
  const imagesJson = JSON.stringify([
    { title: 'Alpha', src: dataUrl, url: 'https://example.com/a', type: 'image', width: 320, height: 200 },
    { title: 'Beta', src: dataUrlB, url: 'https://example.com/b', type: 'image', width: 320, height: 200 },
  ]);
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.$bodyScope.$root.$broadcast('IMPORT_IMAGES', {
        title: '冒烟收集',
        url: 'https://example.com/gallery',
        images: ${imagesJson},
        importFolders: [],
      });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr('bsp-open', `document.querySelector('#eagle-batch-save-panel-host #batch-save-panel').classList.contains('open')`);
  await delay(800);
  await assertExpr(
    'bsp-items-rendered',
    `(() => {
      const items = document.querySelectorAll('#eagle-batch-save-panel-host .gallery .item');
      return items.length === 2;
    })()`
  );
  await assertExpr(
    'bsp-thumbnails-loaded',
    `(() => {
      const imgs = document.querySelectorAll('#eagle-batch-save-panel-host .gallery .item .thumbnail img');
      if (imgs.length !== 2) return false;
      return Array.from(imgs).every((img) => img.src.startsWith('data:image/png'));
    })()`
  );

  // ── 点击选中 → 计数 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const item = document.querySelectorAll('#eagle-batch-save-panel-host .gallery .item')[0];
      item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, which: 1 }));
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(200);
  await assertExpr(
    'bsp-item-selected',
    `(() => {
      const item = document.querySelectorAll('#eagle-batch-save-panel-host .gallery .item')[0];
      return item.classList.contains('selected') && window.__eagleBatchSavePanel.selected.length === 1;
    })()`
  );

  // ── 搜索关键字过滤 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.getElementById('batch-save-panel-search');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'Alpha');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(500);
  await assertExpr(
    'bsp-keyword-filter',
    `window.__eagleBatchSavePanel.displayed.length === 1 && window.__eagleBatchSavePanel.displayed[0].title === 'Alpha'`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.getElementById('batch-save-panel-search');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(500);

  // ── 文件夹选择 → FolderSelectPanel 回写 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('#eagle-batch-save-panel-host .create-label-btn');
      btn.click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'bsp-folder-panel-open',
    `document.querySelector('#eagle-folder-select-panel-host select-panel').classList.contains('open')`,
    15000
  );
  await delay(200);
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const names = Array.from(document.querySelectorAll('#eagle-folder-select-panel-host .list-item .name'));
      const target = names.find((n) => n.textContent.includes('测试夹A'));
      target.closest('.select-panel-item').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.getElementById('folder-select-panel-search-input');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', keyCode: 27, which: 27, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'x', keyCode: 27, which: 27, bubbles: true }));
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'bsp-folder-label-written',
    `(() => {
      const labels = Array.from(document.querySelectorAll('#eagle-batch-save-panel-host .label-item-name')).map((n) => n.textContent);
      return labels.includes('测试夹A');
    })()`
  );

  // ── 全选 + import 数据面（uploadUrls 打桩） ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const body = window.$bodyScope;
      window.__uploadCalls = [];
      const orig = body.uploadUrls;
      body.uploadUrls = function (...args) {
        window.__uploadCalls.push(args);
        return orig && orig.apply(body, args);
      };
      window.__queueLenBefore = body.uploadQueue.length;
      // 全选 → import
      document.querySelector('#eagle-batch-save-panel-host .modal-header .ic-btns .ic-btn').click();
      document.querySelector('#eagle-batch-save-panel-host .gallery-controls .button-primary').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(600);
  await assertExpr('bsp-closed-after-import', `!document.querySelector('#eagle-batch-save-panel-host #batch-save-panel').classList.contains('open')`);
  await assertExpr(
    'bsp-import-dataplane',
    `(() => {
      const calls = window.__uploadCalls;
      if (!calls || calls.length !== 1) return false;
      const [imageUrls, folderIds, opts] = calls[0];
      if (imageUrls.length !== 2) return false;
      if (!imageUrls.every((u) => String(u).startsWith('data:image/png'))) return false;
      if (window.__eagleBatchSavePanel.importFolders.length !== 1) return false;
      const fid = window.$bodyScope.folders.find((f) => f.name === '测试夹A').id;
      if (JSON.stringify(folderIds) !== JSON.stringify([fid])) return false;
      if (window.$bodyScope.uploadQueue.length < window.__queueLenBefore + 2) return false;
      return true;
    })()`
  );

  // ── 再次打开 → Esc 关闭 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.$bodyScope.$root.$broadcast('IMPORT_IMAGES', {
        title: '冒烟收集2',
        url: 'https://example.com/gallery2',
        images: ${imagesJson},
        importFolders: [],
      });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr('bsp-reopen', `document.querySelector('#eagle-batch-save-panel-host #batch-save-panel').classList.contains('open')`);
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.getElementById('batch-save-panel-input');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', keyCode: 27, which: 27, bubbles: true }));
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(200);
  await assertExpr('bsp-esc-closed', `!document.querySelector('#eagle-batch-save-panel-host #batch-save-panel').classList.contains('open')`);

  // ── 截图留档 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.$bodyScope.$root.$broadcast('IMPORT_IMAGES', {
        title: '冒烟收集3',
        url: 'https://example.com/gallery3',
        images: ${imagesJson},
        importFolders: [],
      });
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(700);
  await screenshotTo('test-run/react-stage7d3b-batch-save.png', 5000);

  if (failures.length > 0) {
    console.error(`\nSTAGE7D3B SMOKE FAILED: ${failures.length} assertion(s): ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nSTAGE7D3B SMOKE OK');
  }
} finally {
  await stop(stack).catch(() => {});
  // undici keep-alive socket 会拖住事件循环，测试结果已输出，直接强退
  try { process.exit(process.exitCode || 0); } catch (err) {}
}
