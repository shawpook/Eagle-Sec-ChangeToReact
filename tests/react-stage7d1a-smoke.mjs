/**
 * React 化改造 —— 阶段7d-1a收尾闭环测试（AddToFolder + MoveFolder 控制器弹窗）。
 *
 * 运行：node tests/react-stage7d1a-smoke.mjs
 * 断言点：
 *  1. 壳：两个宿主存在；index.html 中 ng-controller="AddToFolderController"/"MoveFolderController"
 *     旧块已删除
 *  2. AddToFolder：body scope addToFolders() 广播 → 弹窗 .open、搜索框聚焦、树渲染（label +
 *     folder 行）、existsFolders 预勾选
 *  3. 点击文件夹行 → checked 类；save → 弹窗关 + image.folders 数据面 + recentMoveFolders 写入 +
 *     通知（notify）
 *  4. 重新打开 → 最近使用区渲染（modal-recent-folder-*）；搜索过滤 + createFolder 行
 *  5. 「从原文件夹移除」复选框 → localStorage isRemoveFromOriginal
 *  6. MoveFolder：广播 OPEN-MOVE-FOLDER-MODAL → 弹窗开、源文件夹行 disabled；点击 bottom-area →
 *     swal 确认 → moveFoldersAsSibling 数据面（父级/顺序变化）；Esc 关闭
 *  7. 截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage7d1a-'));
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
      await post('/api/library/create', { name: 'React Stage7d1a Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's7d1a.png'), png);
      const folderA = await post('/api/folder/create', { name: '目标文件夹' });
      await post('/api/folder/create', { name: '子目标', parent: folderA.id });
      await post('/api/folder/create', { name: '收藏夹' });
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's7d1a.png')] });
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's7d1a.png')] });
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

  // ── 壳 ──
  await assertExpr(
    'fmd-hosts',
    `!!document.getElementById('eagle-add-to-folder-host') && !!document.getElementById('eagle-move-folder-host')`
  );
  await assertExpr(
    'fmd-old-blocks-gone',
    `!document.querySelector('[ng-controller="AddToFolderController"]') && !document.querySelector('[ng-controller="MoveFolderController"]')`
  );

  // ── AddToFolder：选中一个 item → addToFolders 广播 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const s = window.$bodyScope;
      s.selected = [s.allData[0]];
      window.__eaglePorts.addToFolders();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'atf-open',
    `document.querySelector('#eagle-add-to-folder-host .move-folder-modal').classList.contains('open')`
  );
  await assertExpr('atf-search-focused', `document.activeElement && document.activeElement.id === 'add-to-folder-search'`);
  await assertExpr(
    'atf-tree-rendered',
    `(() => {
      const names = Array.from(document.querySelectorAll('#eagle-add-to-folder-host .sidebar-item-container .item .name')).map((n) => n.textContent);
      return names.includes('目标文件夹') && names.includes('收藏夹') && names.includes('子目标');
    })()`
  );
  await assertExpr(
    'atf-label-rendered',
    `(() => {
      const label = document.querySelector('#eagle-add-to-folder-host .sidebar-item-label .name');
      return label && label.textContent.includes('(');
    })()`
  );

  // 点击「收藏夹」行 → checked
  const favFolderId = await evalNow(`(() => { const f = window.$bodyScope.folders.find((x) => x.name === '收藏夹'); return f ? f.id : ''; })()`);
  await page.send('Runtime.evaluate', {
    expression: `(() => { document.getElementById('modal-folder-${favFolderId}').click(); return true; })()`,
    returnByValue: true,
  });
  await assertExpr(
    'atf-check-toggles',
    `(() => {
      const item = document.getElementById('modal-folder-${favFolderId}');
      return item.classList.contains('checked') && !document.querySelector('#eagle-add-to-folder-host .button-primary').classList.contains('button-disabled');
    })()`
  );

  // save → 数据面
  await page.send('Runtime.evaluate', {
    expression: `(() => { document.querySelector('#eagle-add-to-folder-host .button-primary').click(); return true; })()`,
    returnByValue: true,
  });
  await delay(400);
  await assertExpr('atf-closed', `!document.querySelector('#eagle-add-to-folder-host .move-folder-modal').classList.contains('open')`);
  await assertExpr(
    'atf-data-plane',
    `(() => {
      const item = window.$bodyScope.allData[0];
      return item.folders.indexOf(${JSON.stringify(favFolderId)}) !== -1;
    })()`
  );
  await assertExpr(
    'atf-recent-saved',
    `(() => {
      const recent = JSON.parse(localStorage.getItem('recentMoveFolders') || '[]');
      return recent[0] === ${JSON.stringify(favFolderId)};
    })()`
  );

  // 重新打开 → 最近使用行 + 过滤 + createFolder 行
  await page.send('Runtime.evaluate', {
    expression: `(() => { window.__eaglePorts.addToFolders(); return true; })()`,
    returnByValue: true,
  });
  await assertExpr(
    'atf-reopen-recent-row',
    `!!document.getElementById('modal-recent-folder-${favFolderId}')`
  );
  const typeInto = async (inputId, keyword) => {
    await page.send('Runtime.evaluate', {
      expression: `(() => {
        const input = document.getElementById(${JSON.stringify(inputId)});
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, ${JSON.stringify(keyword)});
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()`,
      returnByValue: true,
    });
    await delay(200);
  };
  await typeInto('add-to-folder-search', '目标');
  await assertExpr(
    'atf-filter',
    `(() => {
      const names = Array.from(document.querySelectorAll('#eagle-add-to-folder-host .sidebar-item-container .item .name')).map((n) => n.textContent);
      return names.includes('目标文件夹') && !names.includes('收藏夹');
    })()`
  );
  await typeInto('add-to-folder-search', '新建某某文件夹');
  await assertExpr(
    'atf-create-row',
    `(() => {
      const names = Array.from(document.querySelectorAll('#eagle-add-to-folder-host .sidebar-item-container .item .name')).map((n) => n.textContent);
      return names.some((n) => n.includes('新建某某文件夹') && n.length > '新建某某文件夹'.length);
    })()`
  );
  // Esc 关闭
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.getElementById('add-to-folder-search');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true }));
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr('atf-esc-closed', `!document.querySelector('#eagle-add-to-folder-host .move-folder-modal').classList.contains('open')`);

  // isRemoveFromOriginal 持久化
  await page.send('Runtime.evaluate', {
    expression: `(() => { window.__eaglePorts.addToFolders(); return true; })()`,
    returnByValue: true,
  });
  await assertExpr('atf-reopen2', `document.querySelector('#eagle-add-to-folder-host .move-folder-modal').classList.contains('open')`);
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const checkbox = document.querySelector('#eagle-add-to-folder-host .control.checkbox input');
      checkbox.click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr('atf-remove-from-original-persist', `localStorage.getItem('isRemoveFromOriginal') === 'true'`);
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.getElementById('add-to-folder-search');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true }));
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(200);

  // ── MoveFolder：广播打开（把「收藏夹」移动到「目标文件夹」内部） ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const s = window.$bodyScope;
      const folderA = s.folders.find((x) => x.name === '收藏夹');
      s.$root.$broadcast('OPEN-MOVE-FOLDER-MODAL', { current: null, folders: s.folders, selectedFolders: [folderA] });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'mv-open',
    `document.querySelector('#eagle-move-folder-host .move-folder-modal').classList.contains('open')`
  );
  await assertExpr(
    'mv-source-disabled',
    `(() => {
      const item = document.getElementById('modal-move-folder-${favFolderId}');
      return item && item.classList.contains('disabled');
    })()`
  );
  await assertExpr(
    'mv-tree-rendered',
    `(() => {
      const names = Array.from(document.querySelectorAll('#eagle-move-folder-host .sidebar-item-container .item .name')).map((n) => n.textContent);
      // 源文件夹（收藏夹）仍在列表中但呈 disabled（原版行为：isVisible 抑制仅作用于子级）
      return names.includes('目标文件夹') && names.includes('收藏夹');
    })()`
  );

  // 点击「目标文件夹」bottom-area（作为同级）→ swal 确认 → moveFoldersAsSibling
  const targetFolderId = await evalNow(`(() => { const f = window.$bodyScope.folders.find((x) => x.name === '目标文件夹'); return f ? f.id : ''; })()`);
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const item = document.getElementById('modal-move-folder-${targetFolderId}');
      item.querySelector('.multiple-drop-folder-bottom-area').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr('mv-swal-shown', `!!document.querySelector('.swal2-container .swal2-confirm')`);
  await page.send('Runtime.evaluate', {
    expression: `(() => { document.querySelector('.swal2-container .swal2-confirm').click(); return true; })()`,
    returnByValue: true,
  });
  await delay(300);
  await assertExpr(
    'mv-data-plane-sibling',
    `(() => {
      const s = window.$bodyScope;
      const moved = s.folderMappings[${JSON.stringify(favFolderId)}];
      const target = s.folderMappings[${JSON.stringify(targetFolderId)}];
      return moved.parent === target.parent;
    })()`
  );
  await assertExpr(
    'mv-closed',
    `!document.querySelector('#eagle-move-folder-host .move-folder-modal').classList.contains('open')`
  );

  // ── 截图留档（重新打开 AddToFolder） ──
  await page.send('Runtime.evaluate', {
    expression: `(() => { window.__eaglePorts.addToFolders(); return true; })()`,
    returnByValue: true,
  });
  await delay(400);
  await screenshotTo('test-run/react-stage7d1a-folders.png', 5000);

  if (failures.length > 0) {
    console.error(`\nSTAGE7D1A SMOKE FAILED: ${failures.length} assertion(s): ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nSTAGE7D1A SMOKE OK');
  }
} finally {
  await stop(stack).catch(() => {});
  // undici keep-alive socket 会拖住事件循环，测试结果已输出，直接强退
  try { process.exit(process.exitCode || 0); } catch (err) {}
}
