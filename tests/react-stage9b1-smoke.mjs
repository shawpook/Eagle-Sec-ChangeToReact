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
