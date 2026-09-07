/**
 * React 化改造 —— 阶段7a收尾闭环测试（contextMenu 右键菜单体系）。
 *
 * 运行：node tests/react-stage7a-smoke.mjs
 * 断言点：
 *  1. 壳：#eagle-context-menu-host 存在；旧 <context-menu> 元素已删除
 *  2. 真实链路：openItemContextMenu（控制器右键）→ .context-menu.open + 菜单项渲染 + 搜索框聚焦
 *  3. 自定义菜单广播（CONTEXTMENU.OPEN）→ 项目渲染 → 点击项回调触发 → 菜单关闭
 *  4. keepOpen + checked 项：点击后不关闭且 checked 翻转
 *  5. 子菜单：hoverItem/右方向键 → .context-menu.submenu.open 出现
 *  6. 搜索：showSearch 菜单输入关键字 → 过滤命中项
 *  7. overlay 点击关闭
 *  8. 截图留档 test-run/react-stage7a-menu.png
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage7a-'));
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
      await post('/api/library/create', { name: 'React Stage7a Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's7a.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's7a.png')] });
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

  // ── 壳 ──
  await assertExpr('cm-host', `document.getElementById('eagle-context-menu-host') !== null`);
  await assertExpr('cm-old-element-gone', `document.querySelector('context-menu') === null`);

  // ── 真实链路：控制器右键菜单（与真实右键一致：条目须在 selected 内） ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const box = document.querySelector('#box-list .box');
      const rect = box.getBoundingClientRect();
      window.$bodyScope.$apply(() => {
        window.$bodyScope.selected = [window.$bodyScope.allData[0]];
        window.$bodyScope.openItemContextMenu({
          pageX: rect.left + 40, pageY: rect.top + 40, clientX: rect.left + 40, clientY: rect.top + 40,
          target: box, preventDefault() {}, stopPropagation() {}, button: 2,
        }, window.$bodyScope.allData[0]);
      });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'cm-real-open',
    `(() => { const el = document.querySelector('#eagle-context-menu-host .context-menu'); return !!el && el.classList.contains('open'); })()`,
    15000
  );
  await assertExpr(
    'cm-real-items',
    `document.querySelectorAll('#eagle-context-menu-host .context-menu .context-menu-item').length > 0`
  );
  await assertExpr(
    'cm-real-search-focused',
    `(() => { const input = document.querySelector('#eagle-context-menu-host .context-menu input[type=search]'); return !!input && document.activeElement === input; })()`,
    15000
  );

  // ── 自定义菜单：点击回调 + 关闭 ──
  await page.send('Runtime.evaluate', {
    expression: `window.$bodyScope.$apply(() => {
      window.__cmClicked = 0;
      window.__eagleBus.emit('CONTEXTMENU.OPEN', {
        items: [
          { label: 'Stage7A Item', click: () => { window.__cmClicked++; } },
          { role: 'separator' },
          { label: 'Disabled Item', disabled: true },
        ],
        showSearch: true,
      });
    })`,
    returnByValue: true,
  });
  await assertExpr(
    'cm-custom-open',
    `(() => {
      const labels = [...document.querySelectorAll('#eagle-context-menu-host .context-menu .context-menu-item .label')];
      return labels.some((el) => el.textContent.includes('Stage7A Item')) && labels.some((el) => el.textContent.includes('Disabled Item'));
    })()`
  );
  await assertExpr(
    'cm-disabled-class',
    `(() => {
      const items = [...document.querySelectorAll('#eagle-context-menu-host .context-menu .context-menu-item')];
      const disabled = items.find((el) => el.textContent.includes('Disabled Item'));
      return !!disabled && disabled.classList.contains('disabled');
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const items = [...document.querySelectorAll('#eagle-context-menu-host .context-menu .context-menu-item')];
      items.find((el) => el.textContent.includes('Stage7A Item')).click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr('cm-click-callback', `window.__cmClicked === 1`);
  await assertExpr(
    'cm-closed-after-click',
    `(() => { const el = document.querySelector('#eagle-context-menu-host .context-menu'); return !el || !el.classList.contains('open'); })()`
  );

  // ── keepOpen + checked 翻转 ──
  await page.send('Runtime.evaluate', {
    expression: `window.$bodyScope.$apply(() => {
      window.__eagleBus.emit('CONTEXTMENU.OPEN', {
        items: [{ label: 'KeepOpen Item', keepOpen: true, checked: false, click: () => {} }],
        showSearch: true,
      });
    })`,
    returnByValue: true,
  });
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const items = [...document.querySelectorAll('#eagle-context-menu-host .context-menu .context-menu-item')];
      items.find((el) => el.textContent.includes('KeepOpen Item')).click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'cm-keepopen-checked-toggle',
    `(() => {
      const el = document.querySelector('#eagle-context-menu-host .context-menu');
      const item = [...document.querySelectorAll('#eagle-context-menu-host .context-menu .context-menu-item')].find((el2) => el2.textContent.includes('KeepOpen Item'));
      return item && item.classList.contains('checked') && el && el.classList.contains('open');
    })()`
  );

  // ── 子菜单（右方向键 → submenu.open） ──
  await page.send('Runtime.evaluate', {
    expression: `window.$bodyScope.$apply(() => {
      window.__eagleBus.emit('CONTEXTMENU.OPEN', {
        items: [
          {
            label: 'Parent Item',
            submenu: { items: [{ label: 'Child Item', click: () => {} }] },
          },
        ],
        showSearch: true,
      });
    })`,
    returnByValue: true,
  });
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('#eagle-context-menu-host .context-menu input[type=search]');
      const send = (code) => {
        const e = new KeyboardEvent('keydown', { bubbles: true });
        Object.defineProperty(e, 'keyCode', { value: code });
        input.dispatchEvent(e);
      };
      send(40); // down → currentIndex 0
      send(39); // right → open submenu
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'cm-submenu-open',
    `(() => {
      const sub = document.querySelector('#eagle-context-menu-host .context-menu.submenu.open');
      if (!sub) return false;
      const placeholder = document.querySelector('#eagle-context-menu-host .context-menu > .context-menu-items #submenu-placeholder');
      return !!placeholder && sub.textContent.includes('Child Item');
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('#eagle-context-menu-host .context-menu input[type=search]');
      const e = new KeyboardEvent('keydown', { bubbles: true });
      Object.defineProperty(e, 'keyCode', { value: 37 });
      input.dispatchEvent(e);
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'cm-submenu-closed',
    `!document.querySelector('#eagle-context-menu-host .context-menu.submenu.open')`
  );

  // ── 搜索过滤 ──
  await page.send('Runtime.evaluate', {
    expression: `window.$bodyScope.$apply(() => {
      window.__eagleBus.emit('CONTEXTMENU.OPEN', {
        items: [
          { label: 'Alpha Action', click: () => {} },
          { label: 'Beta Action', click: () => {} },
          { role: 'separator' },
          { label: 'Gamma Action', click: () => {} },
        ],
        showSearch: true,
      });
    })`,
    returnByValue: true,
  });
  await assertExpr(
    'cm-search-initial-count',
    `document.querySelectorAll('#eagle-context-menu-host .context-menu > .context-menu-items .context-menu-item').length === 3`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('#eagle-context-menu-host .context-menu input[type=search]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'Beta');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'cm-search-filtered',
    `(() => {
      const items = [...document.querySelectorAll('#eagle-context-menu-host .context-menu .context-menu-item')];
      return items.length === 1 && items[0].textContent.includes('Beta Action');
    })()`
  );

  // ── overlay 关闭 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('#eagle-context-menu-host .context-menu-overlay').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'cm-overlay-close',
    `(() => { const el = document.querySelector('#eagle-context-menu-host .context-menu'); return !el || !el.classList.contains('open'); })()`
  );

  // ── 截图留档（重新打开真实菜单） ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const box = document.querySelector('#box-list .box');
      const rect = box.getBoundingClientRect();
      window.$bodyScope.$apply(() => {
        window.$bodyScope.selected = [window.$bodyScope.allData[0]];
        window.$bodyScope.openItemContextMenu({
          pageX: rect.left + 40, pageY: rect.top + 40, clientX: rect.left + 40, clientY: rect.top + 40,
          target: box, preventDefault() {}, stopPropagation() {}, button: 2,
        }, window.$bodyScope.allData[0]);
      });
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(700);
  await screenshotTo('test-run/react-stage7a-menu.png', 10000);
  // 关闭菜单收尾（broadcast 返回事件对象，包一层避免 CDP 深序列化）
  await page.send('Runtime.evaluate', {
    expression: `(() => { window.__eagleBus.emit('CONTEXTMENU.CLOSE'); return true; })()`,
    returnByValue: true,
  });

  if (failures.length > 0) {
    console.error(`STAGE7A_SMOKE_FAILED ${JSON.stringify(failures)}`);
    process.exitCode = 1;
  } else {
    console.log('STAGE7A_SMOKE_OK');
  }
} finally {
  if (stack) {
    await stop(stack.electron);
    await stop(stack.vite);
    await stop(stack.backend);
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
