/**
 * React 化改造 —— 阶段7d-1c-2收尾闭环测试（folderSelectPanel + foldersInput + NewSmartFolder）。
 *
 * 运行：node tests/react-stage7d1c2-smoke.mjs
 * 断言点：
 *  1. 壳：两个宿主存在；旧 NewSmartFolderController 块与 <folder-select-panel> 岛已删除；
 *     React 渲染 select-panel#folder-select-panel（常驻，open class 控制显隐）
 *  2. FolderSelectPanel：FOLDER.SELECT.PANEL.OPEN 广播 → open + 预选文件夹 selected 类；
 *     点击项翻转选中；Esc → onChanged 数据面（isDirty/deselectedFolderIds）
 *  3. 搜索建夹：输入关键字 → create 项 → 点击 → swal 输入 → body.createFolder →
 *     onCreatedFolder 重置 init 并选中
 *  4. NewSmartFolder：NEW.SMART.FOLDER 广播 → 弹窗开；property select → tags → 点击
 *     tags-input → 标签面板选中 → Esc 回写 rule.value → 预览计数（contentFilter 数据面）；
 *     命名 + create → smartFolders 数据面 + 弹窗关闭
 *  5. folders-input：property → folders → 点击 #folders-input → 文件夹面板选夹 → Esc 回写
 *     rule.value（label 渲染）
 *  6. EDIT.SMART.FOLDER：名称回填 + 改名 save → folder.name 数据面
 *  7. 截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage7d1c2-'));
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
      await post('/api/library/create', { name: 'React Stage7d1c2 Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's7d1c2.png'), png);
      await post('/api/folder/create', { name: '测试夹A' });
      await post('/api/folder/create', { name: '测试夹B' });
      await post('/api/tag/create', { name: '参考素材' });
      const item = await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's7d1c2.png')] });
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
  const pressPanelKey = async (keyCode, inputId = 'folder-select-panel-search-input') => {
    await page.send('Runtime.evaluate', {
      expression: `(() => {
        const input = document.getElementById(${JSON.stringify(inputId)});
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
    'fsp-hosts',
    `!!document.getElementById('eagle-smart-folder-host') && !!document.getElementById('eagle-folder-select-panel-host')`
  );
  await assertExpr(
    'fsp-old-blocks-gone',
    `!document.querySelector('[ng-controller="NewSmartFolderController"]') && !document.querySelector('folder-select-panel[theme]')`
  );
  await assertExpr(
    'fsp-root-rendered',
    `!!document.querySelector('#eagle-folder-select-panel-host select-panel#folder-select-panel.folder-select-panel')`
  );

  // ── FolderSelectPanel：广播打开（预选 测试夹A） ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.__folderPanelResult = null;
      const body = window.$bodyScope;
      const folders = body.folders.filter((f) => f.name === '测试夹A' || f.name === '测试夹B');
      const selected = {};
      selected[body.folders.find((f) => f.name === '测试夹A').id] = true;
      body.$root.$broadcast('FOLDER.SELECT.PANEL.OPEN', {
        folders,
        selectedIds: selected,
        onChanged: (r) => { window.__folderPanelResult = r; },
      });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'fsp-open',
    `document.querySelector('#eagle-folder-select-panel-host select-panel').classList.contains('open')`,
    15000
  );
  await assertExpr(
    'fsp-item-rendered-selected',
    `(() => {
      const names = Array.from(document.querySelectorAll('#eagle-folder-select-panel-host .list-item .name'));
      if (!names.some((n) => n.textContent.includes('测试夹A'))) return false;
      const target = names.find((n) => n.textContent.includes('测试夹A'));
      const item = target.closest('.select-panel-item');
      return item && item.querySelector('.list-item').classList.contains('selected');
    })()`
  );

  // ── 点击翻转选中 → Esc 关闭回调（数据面） ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const names = Array.from(document.querySelectorAll('#eagle-folder-select-panel-host .list-item .name'));
      const target = names.find((n) => n.textContent.includes('测试夹A'));
      target.closest('.select-panel-item').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'fsp-click-toggled-off',
    `(() => {
      const names = Array.from(document.querySelectorAll('#eagle-folder-select-panel-host .list-item .name'));
      const target = names.find((n) => n.textContent.includes('测试夹A'));
      const item = target && target.closest('.select-panel-item');
      return item && !item.querySelector('.list-item').classList.contains('selected');
    })()`
  );
  await pressPanelKey(27);
  await assertExpr(
    'fsp-esc-closed',
    `!document.querySelector('#eagle-folder-select-panel-host select-panel').classList.contains('open')`
  );
  await assertExpr(
    'fsp-onchanged-dataplane',
    `(() => {
      const r = window.__folderPanelResult;
      if (!r || r.isDirty !== true) return false;
      const aid = window.$bodyScope.folders.find((f) => f.name === '测试夹A').id;
      return r.deselectedFolderIds[aid] === true && !r.selectedFolderIds[aid];
    })()`
  );

  // ── 搜索建夹：关键字 → create 项 → swal 输入 → body.createFolder → onCreatedFolder ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.$bodyScope.$root.$broadcast('FOLDER.SELECT.PANEL.OPEN', {
        folders: window.$bodyScope.folders,
        selectedIds: {},
        onChanged: () => {},
      });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr('fsp-reopen', `document.querySelector('#eagle-folder-select-panel-host select-panel').classList.contains('open')`, 15000);
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.getElementById('folder-select-panel-search-input');
      input.value = '冒烟新建夹';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(200);
  await assertExpr(
    'fsp-create-item-shown',
    `(() => {
      const createItems = Array.from(document.querySelectorAll('#eagle-folder-select-panel-host .list-item'))
        .filter((li) => li.textContent.includes('selectFolderPanel.newFolderBtn') || li.querySelector('.checkbox img'));
      return createItems.length > 0;
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const createItem = Array.from(document.querySelectorAll('#eagle-folder-select-panel-host .select-panel-item'))
        .find((el) => el.querySelector('.list-item .checkbox img[src*="ic-folder-select-create"]'));
      if (!createItem) return false;
      createItem.click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr('fsp-swal-open', `!!document.querySelector('.swal2-popup.swal2-alert, .swal2-container .alert-box')`, 8000);
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('.swal2-input');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '冒烟新建夹');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('.swal2-confirm').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(600);
  await assertExpr(
    'fsp-created-dataplane',
    `window.$bodyScope.folders.some((f) => f.name === '冒烟新建夹')`
  );
  await assertExpr(
    'fsp-created-selected',
    `(() => {
      const fid = window.$bodyScope.folders.find((f) => f.name === '冒烟新建夹').id;
      return window.__eagleFolderSelectPanel && window.__eagleFolderSelectPanel.listData.selectedIds[fid] === true;
    })()`
  );
  await pressPanelKey(27);
  await assertExpr(
    'fsp-closed-after-create',
    `!document.querySelector('#eagle-folder-select-panel-host select-panel').classList.contains('open')`
  );

  // ── NewSmartFolder：NEW.SMART.FOLDER 广播 → 弹窗 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.$bodyScope.$root.$broadcast('NEW.SMART.FOLDER', { smartFolder: undefined, parent: undefined });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'nsm-open',
    `!!document.querySelector('#eagle-smart-folder-host .smart-folder-modal.open')`
  );
  await assertExpr(
    'nsm-create-mode-header',
    `(() => {
      const heads = Array.from(document.querySelectorAll('#eagle-smart-folder-host .modal-header .name'));
      return heads.length === 1;
    })()`
  );

  // property select → tags：changeProperty 后 rule.value 变 []，tags-input 渲染
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const select = document.querySelector('#eagle-smart-folder-host .rule select');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      setter.call(select, 'tags');
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'nsm-tags-input-shown',
    `!!document.querySelector('#eagle-smart-folder-host .rule-value #tags-input')`
  );

  // 点击 tags-input → GeneralTagSelectPanel 开 → 选中标签 → Esc 回写 rule.value
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('#eagle-smart-folder-host .rule-value #tags-input').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'gtp-open-via-nsm',
    `document.querySelector('#eagle-general-tag-select-panel-host .tag-select-panel').classList.contains('open')`
  );
  await delay(300); // 等 init（setTimeout 10ms）完成
  await pressPanelKey(40, 'tag-select-panel-search-input');
  await pressPanelKey(13, 'tag-select-panel-search-input');
  await pressPanelKey(27, 'tag-select-panel-search-input');
  await assertExpr(
    'nsm-tags-written-back',
    `(() => {
      const labels = Array.from(document.querySelectorAll('#eagle-smart-folder-host #tags-input .label-item-name')).map((n) => n.textContent);
      return labels.includes('参考素材');
    })()`
  );

  // 数据面：rule.value = ['参考素材'] → contentFilter 命中 1 张
  await assertExpr(
    'nsm-preview-count',
    `(() => {
      const preview = document.querySelector('#eagle-smart-folder-host .preview');
      return preview && preview.textContent.indexOf('1') !== -1;
    })()`
  );

  // property → folders：点击 #folders-input → 文件夹面板 → 选 测试夹B → Esc 回写
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const select = document.querySelector('#eagle-smart-folder-host .rule select');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      setter.call(select, 'folders');
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'nsm-folders-input-shown',
    `!!document.querySelector('#eagle-smart-folder-host .rule-value #folders-input')`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('#eagle-smart-folder-host .rule-value #folders-input').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'fsp-open-via-folders-input',
    `document.querySelector('#eagle-folder-select-panel-host select-panel').classList.contains('open')`,
    15000
  );
  await delay(200);
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const names = Array.from(document.querySelectorAll('#eagle-folder-select-panel-host .list-item .name'));
      const target = names.find((n) => n.textContent.includes('测试夹B'));
      target.closest('.select-panel-item').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await pressPanelKey(27);
  await assertExpr(
    'nsm-folders-written-back',
    `(() => {
      const labels = Array.from(document.querySelectorAll('#eagle-smart-folder-host #folders-input .label-item-name')).map((n) => n.textContent);
      return labels.includes('测试夹B');
    })()`
  );

  // 命名 + create → smartFolders 数据面
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.getElementById('smart-folder-name-input');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '冒烟智能夹');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(120);
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('#eagle-smart-folder-host .button-primary').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(500);
  await assertExpr(
    'nsm-closed',
    `!document.querySelector('#eagle-smart-folder-host .smart-folder-modal.open')`
  );
  await assertExpr(
    'nsm-save-dataplane',
    `(() => {
      const sf = window.$bodyScope.smartFolders.find((f) => f.name === '冒烟智能夹');
      if (!sf) return false;
      const rule = sf.conditions[0].rules[0];
      return rule.property === 'folders' && Array.isArray(rule.value) && rule.value.length === 1;
    })()`
  );

  // ── EDIT.SMART.FOLDER：回填 + 改名 save ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const sf = window.$bodyScope.smartFolders.find((f) => f.name === '冒烟智能夹');
      window.$bodyScope.$root.$broadcast('EDIT.SMART.FOLDER', sf);
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'nsm-edit-open',
    `!!document.querySelector('#eagle-smart-folder-host .smart-folder-modal.open')`
  );
  await assertExpr(
    'nsm-edit-name-filled',
    `document.getElementById('smart-folder-name-input').value === '冒烟智能夹'`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.getElementById('smart-folder-name-input');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, '冒烟智能夹改名');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(120);
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('#eagle-smart-folder-host .button-primary').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(500);
  await assertExpr(
    'nsm-edit-save-dataplane',
    `window.$bodyScope.smartFolders.some((f) => f.name === '冒烟智能夹改名')`
  );

  // ── 截图留档 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.$bodyScope.$root.$broadcast('FOLDER.SELECT.PANEL.OPEN', {
        folders: window.$bodyScope.folders,
        selectedIds: {},
        onChanged: () => {},
      });
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(600);
  await screenshotTo('test-run/react-stage7d1c2-panel.png', 5000);

  if (failures.length > 0) {
    console.error(`\nSTAGE7D1C2 SMOKE FAILED: ${failures.length} assertion(s): ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nSTAGE7D1C2 SMOKE OK');
  }
} finally {
  await stop(stack).catch(() => {});
  // undici keep-alive socket 会拖住事件循环，测试结果已输出，直接强退
  try { process.exit(process.exitCode || 0); } catch (err) {}
}
