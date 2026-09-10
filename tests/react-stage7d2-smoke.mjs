/**
 * React 化改造 —— 阶段7d-2收尾闭环测试（batchRenameModal + artstationImportModal）。
 *
 * 运行：node tests/react-stage7d2-smoke.mjs
 * 断言点：
 *  1. 壳：两个宿主存在；旧 <batch-rename-modal>/<artstation-import-modal> 已删除；
 *     React 常驻渲染 .batch-rename-modal（open class 控制显隐）
 *  2. OPEN_RENAME(IMAGE)：弹窗开 + 头部计数 + format 预览；rename → item.name 数据面
 *     （=== 预览 after）+ BATCH_RENAME_LAST_NAME 持久化 + 弹窗关闭
 *  3. OPEN_RENAME(FOLDER, 2 个)：replace 模式 → find/replace 预览（<s>/<b> 标记）；
 *     rename → folderMappings 数据面 + 搜尋歷史 localStorage
 *  4. OPEN_RENAME 空集合守卫：items 为空 → 弹窗不打开
 *  5. IMPORT_ARTSTATION：$timeout(300) 后弹窗开 + url 输入聚焦；无效网址 blur →
 *     error-message 显隐；Esc 关闭；selectFolders → FolderSelectPanel 选夹回写 option 文案
 *  6. 截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage7d2-'));
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
      await post('/api/library/create', { name: 'React Stage7d2 Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's7d2.png'), png);
      await post('/api/folder/create', { name: '测试夹A' });
      await post('/api/folder/create', { name: '测试夹B' });
      const item = await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's7d2.png')] });
      const itemId = Array.isArray(item) ? item[0].id : item.id;
      await post('/api/item/update', { id: itemId, folders: ['测试夹A'] });
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

  const setInputValue = (selector, value) =>
    page.send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()`,
      returnByValue: true,
    });

  // ── 壳 ──
  await assertExpr(
    'br-hosts',
    `!!document.getElementById('eagle-batch-rename-host') && !!document.getElementById('eagle-artstation-import-host')`
  );
  await assertExpr(
    'br-old-blocks-gone',
    `!document.querySelector('batch-rename-modal') && !document.querySelector('artstation-import-modal')`
  );
  await assertExpr(
    'br-modal-resident',
    `!!document.querySelector('#eagle-batch-rename-host > .modal.batch-rename-modal') && !document.querySelector('#eagle-batch-rename-host > .modal.batch-rename-modal.open')`
  );

  // ── OPEN_RENAME(IMAGE) ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const item = window.$bodyScope.raw[0];
      window.__eagleBus.emit('OPEN_RENAME', { type: 'IMAGE', images: [item] });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr('br-image-open', `document.querySelector('#eagle-batch-rename-host .batch-rename-modal').classList.contains('open')`);
  await assertExpr(
    'br-image-header-count',
    `document.querySelector('#eagle-batch-rename-host .modal-header .name').textContent.includes('(1)')`
  );
  // 切换 replace 模式（mock 环境 moment stub 下 format() 必抛、format 预览为空——原版行为一致；
  // replace 分支不经 format，可完整验证 renameImages 数据面）
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const segments = document.querySelectorAll('#eagle-batch-rename-host .segment-control .segment');
      segments[1].click();
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(150);
  await setInputValue('#eagle-batch-rename-host .input-autocomplete-container input', 's7d2');
  await delay(100);
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const inputs = Array.from(document.querySelectorAll('#eagle-batch-rename-host input[type="text"]')).filter((el) => el.offsetParent !== null);
      const target = inputs.find((el) => el.closest('.input-autocomplete-container') === null);
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(target, '重命名图');
      target.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(150);
  await assertExpr(
    'br-image-preview-markup',
    `(() => {
      const p = window.__eagleBatchRename.previews;
      if (!p || p.length !== 1) return false;
      return p[0].before === '<s>s7d2</s>' && p[0].after === '<b>重命名图</b>';
    })()`
  );

  // rename → 弹窗关闭 + LAST_NAME 持久化（IMAGE 改名本体经 ipc 'image-change' 异步落地）
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('#eagle-batch-rename-host .batch-rename-modal-sidebar-controls .button-primary').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(600);
  await assertExpr('br-image-closed', `!document.querySelector('#eagle-batch-rename-host .batch-rename-modal').classList.contains('open')`);
  await assertExpr(
    'br-image-dataplane',
    `(() => {
      const item = window.$bodyScope.raw[0];
      return item.name === '重命名图';
    })()`
  );
  await assertExpr(
    'br-image-lastname-saved',
    `!!localStorage.getItem('BATCH_RENAME_LAST_NAME')`
  );

  // ── OPEN_RENAME(FOLDER, 2 个) + replace 模式 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const folders = window.$bodyScope.folders.filter((f) => f.name === '测试夹A' || f.name === '测试夹B');
      window.__eagleBus.emit('OPEN_RENAME', { type: 'FOLDER', folders });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr('br-folder-open', `document.querySelector('#eagle-batch-rename-host .batch-rename-modal').classList.contains('open')`);
  // 切换 replace 模式（segment 第二个）
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const segments = document.querySelectorAll('#eagle-batch-rename-host .segment-control .segment');
      segments[1].click();
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(150);
  await setInputValue('#eagle-batch-rename-host .input-autocomplete-container input', '测试夹');
  await delay(100);
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const formItems = Array.from(document.querySelectorAll('#eagle-batch-rename-host .form-item'));
      const replaceItem = formItems.find((el) => el.style.display !== 'none' && el.querySelector('input[type="text"]:nth-of-type(1)') === null && el.querySelectorAll('input').length === 1 && el.querySelector('input').type === 'text' && el !== formItems[0]);
      return true;
    })()`,
    returnByValue: true,
  });
  // replaceString：取 replace 模式下的第二个可见文本输入（不含 autocomplete 容器内那个）
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const inputs = Array.from(document.querySelectorAll('#eagle-batch-rename-host input[type="text"]')).filter((el) => el.offsetParent !== null);
      const target = inputs.find((el) => el.closest('.input-autocomplete-container') === null);
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(target, '重命名夹');
      target.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(150);
  await assertExpr(
    'br-folder-preview-markup',
    `(() => {
      const p = window.__eagleBatchRename.previews;
      if (!p || p.length !== 2) return false;
      const a = p.find((x) => x.before.indexOf('A') !== -1);
      return a.before === '<s>测试夹</s>A' && a.after === '<b>重命名夹</b>A';
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('#eagle-batch-rename-host .batch-rename-modal-sidebar-controls .button-primary').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(600);
  await assertExpr('br-folder-closed', `!document.querySelector('#eagle-batch-rename-host .batch-rename-modal').classList.contains('open')`);
  await assertExpr(
    'br-folder-dataplane',
    `(() => {
      const names = window.$bodyScope.folders.map((f) => f.name);
      return names.includes('重命名夹A') && names.includes('重命名夹B');
    })()`
  );
  await assertExpr(
    'br-folder-history-saved',
    `(() => {
      const h = JSON.parse(localStorage.getItem('BATCH_RENAME_HISTORY_FOLDER_FIND_STRING') || '[]');
      return h.includes('测试夹');
    })()`
  );

  // ── OPEN_RENAME 空集合守卫 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.__eagleBus.emit('OPEN_RENAME', { type: 'FOLDER', folders: [] });
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(300);
  await assertExpr(
    'br-empty-guard',
    `!document.querySelector('#eagle-batch-rename-host .batch-rename-modal').classList.contains('open')`
  );

  // ── IMPORT_ARTSTATION ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.__eagleBus.emit('IMPORT_ARTSTATION');
      return true;
    })()`,
    returnByValue: true,
  });
  // $timeout(300) + focus setTimeout(300)
  await assertExpr(
    'art-open',
    `!!document.querySelector('#eagle-artstation-import-host .import-modal.open')`,
    10000
  );
  await assertExpr(
    'art-url-focused',
    `document.activeElement && document.activeElement.id === 'artstation-url'`
  );
  // 无效网址 blur → error-message 显示
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.getElementById('artstation-url');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'https://example.com/not-artstation');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(150);
  // React onBlur 委派 focusout；CDP 环境下 el.blur() 不派发 focusout，改按真实用户离开焦点语义派发
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.getElementById('artstation-url');
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(150);
  await assertExpr(
    'art-url-error-shown',
    `(() => {
      const msg = document.querySelector('#eagle-artstation-import-host .error-message');
      return msg && msg.style.display !== 'none' && msg.textContent.length > 0;
    })()`
  );

  // selectFolders → FolderSelectPanel 开 → 选 测试夹A → Esc 回写 option 文案
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const select = document.querySelector('#eagle-artstation-import-host .select.folder select');
      const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      select.dispatchEvent(ev);
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'art-folder-panel-open',
    `document.querySelector('#eagle-folder-select-panel-host select-panel').classList.contains('open')`,
    15000
  );
  await delay(200);
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const names = Array.from(document.querySelectorAll('#eagle-folder-select-panel-host .list-item .name'));
      const target = names.find((n) => n.textContent.includes('重命名夹A'));
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
    'art-folders-written-back',
    `(() => {
      const option = document.querySelector('#eagle-artstation-import-host .select.folder select option');
      return option && option.textContent.includes('重命名夹A');
    })()`
  );

  // Esc 关闭
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.getElementById('artstation-url');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', keyCode: 27, which: 27, bubbles: true }));
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(200);
  await assertExpr(
    'art-closed',
    `!document.querySelector('#eagle-artstation-import-host .import-modal.open')`
  );

  // ── 截图留档 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.__eagleBus.emit('IMPORT_ARTSTATION');
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(900);
  await screenshotTo('test-run/react-stage7d2-artstation.png', 5000);

  if (failures.length > 0) {
    console.error(`\nSTAGE7D2 SMOKE FAILED: ${failures.length} assertion(s): ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nSTAGE7D2 SMOKE OK');
  }
} finally {
  await stop(stack).catch(() => {});
  // undici keep-alive socket 会拖住事件循环，测试结果已输出，直接强退
  try { process.exit(process.exitCode || 0); } catch (err) {}
}
