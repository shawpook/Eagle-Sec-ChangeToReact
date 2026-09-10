/**
 * React 化改造 —— 阶段7d-1b收尾闭环测试（ErrorModal + WebsitePanel）。
 *
 * 运行：node tests/react-stage7d1b-smoke.mjs
 * 断言点：
 *  1. 壳：两个宿主存在；旧 ng-controller 块已删除
 *  2. ErrorModal：OPEN_ERROR 广播 → 模态渲染（ng-if）+ 两种错误行结构；remove 移除行；
 *     EDIT_ERROR 的 retryAll → itemMappings 原地合并（数据面）+ 清空关闭；
 *     CLEAN_ALL_ERROR → swal 确认后清空关闭
 *  3. WebsitePanel：viewMode='community' → 面板显示（left=sidebarWidth+1）+ webview 与
 *     控制条渲染；OPEN_URL_IN_PANEL → webview src 设置 + isOpenWebpagePanel=true；
 *     viewMode 复位 → 面板隐藏
 *  4. 截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage7d1b-'));
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
      await post('/api/library/create', { name: 'React Stage7d1b Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's7d1b.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's7d1b.png')] });
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
    'cm-hosts',
    `!!document.getElementById('eagle-error-modal-host') && !!document.getElementById('eagle-website-panel-host')`
  );
  await assertExpr(
    'cm-old-blocks-gone',
    `!document.querySelector('[ng-controller="ErrorModalController"]') && !document.querySelector('[ng-controller="WebsitePanelController"]')`
  );

  // ── ErrorModal：OPEN_ERROR ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.__eagleBus.emit('OPEN_ERROR', {
        errorList: [
          { type: 'DOWNLOAD_ERROR', reason: 'BASE64_ERROR', object: { name: 'Net One', url: '', website: 'https://example.com/a' } },
          { type: 'ADD_ERROR', reason: 'FORMAT_NOT_SUPPORTED', object: { name: 'Local One', path: 'C:/tmp/local-one.txt' } },
        ],
      });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr('em-open', `!!document.querySelector('#eagle-error-modal-host .error-modal')`);
  await assertExpr(
    'em-rows-structure',
    `(() => {
      const rows = document.querySelectorAll('#eagle-error-modal-host .error-list .tr');
      if (rows.length !== 2) return false;
      const name0 = rows[0].querySelector('.td.name a');
      const origin1 = rows[1].querySelector('.td.origin a');
      return name0 && name0.textContent === 'Net One' && origin1 && origin1.textContent === 'C:/tmp/local-one.txt';
    })()`
  );
  await assertExpr(
    'em-header',
    `(() => {
      const header = document.querySelector('#eagle-error-modal-host .error-modal tr.header');
      return !!(header && header.querySelector('td.name'));
    })()`
  );

  // remove 第一行
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const row = document.querySelector('#eagle-error-modal-host .error-list .tr');
      row.querySelector('.td.icon.remove').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'em-remove-row',
    `document.querySelectorAll('#eagle-error-modal-host .error-list .tr').length === 1`
  );

  // retryAll（EDIT_ERROR → itemMappings 合并）
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const s = window.$bodyScope;
      s.itemMappings['FAKE-ITEM-1'] = { id: 'FAKE-ITEM-1', name: 'old-name', tags: [] };
      window.__eagleBus.emit('OPEN_ERROR', {
        errorList: [
          { type: 'EDIT_ERROR', reason: 'SAVE_FAILED', object: { name: 'old-name', path: 'C:/tmp/x.png' }, modifiedData: { id: 'FAKE-ITEM-1', name: 'new-name' } },
        ],
      });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr('em-reopen', `!!document.querySelector('#eagle-error-modal-host .error-modal')`);
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('#eagle-error-modal-host .button-primary').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(400);
  await assertExpr(
    'em-retry-edit-dataplane',
    `window.$bodyScope.itemMappings['FAKE-ITEM-1'] && window.$bodyScope.itemMappings['FAKE-ITEM-1'].name === 'new-name'`
  );
  await assertExpr('em-retry-closes', `!document.querySelector('#eagle-error-modal-host .error-modal')`);

  // CLEAN_ALL_ERROR → swal 确认
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.__eagleBus.emit('OPEN_ERROR', {
        errorList: [
          { type: 'ADD_ERROR', reason: 'X', object: { name: 'a', path: 'C:/a' } },
        ],
      });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr('em-clean-reopen', `!!document.querySelector('#eagle-error-modal-host .error-modal')`);
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.__eagleBus.emit('CLEAN_ALL_ERROR', { errorList: window.__emProbeList || [] });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr('em-swal-shown', `!!document.querySelector('.swal2-container .swal2-confirm')`);
  await page.send('Runtime.evaluate', {
    expression: `(() => { document.querySelector('.swal2-container .swal2-confirm').click(); return true; })()`,
    returnByValue: true,
  });
  await delay(300);
  await assertExpr('em-clean-closes', `!document.querySelector('#eagle-error-modal-host .error-modal')`);

  // ── WebsitePanel ──
  await assertExpr(
    'wp-shell-rendered',
    `!!document.querySelector('#eagle-website-panel-host #website-panel.website-panel')`
  );
  await assertExpr(
    'wp-hidden-initially',
    `(() => {
      const panel = document.querySelector('#eagle-website-panel-host #website-panel');
      return getComputedStyle(panel).display === 'none';
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const s = window.$bodyScope;
      s.viewMode = 'community';
      s.$evalAsync();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'wp-visible-community',
    `(() => {
      const panel = document.querySelector('#eagle-website-panel-host #website-panel');
      if (getComputedStyle(panel).display === 'none') return false;
      const webview = panel.querySelector('webview#website-panel-webview');
      const back = panel.querySelector('#website-panel-webview-go-back');
      const fwd = panel.querySelector('#website-panel-webview-go-forward');
      const title = panel.querySelector('#website-panel-webview-title');
      return !!webview && !!back && !!fwd && !!title;
    })()`
  );
  await assertExpr(
    'wp-left-offset',
    `(() => {
      const panel = document.querySelector('#eagle-website-panel-host #website-panel');
      return panel.style.left === (window.$bodyScope.containerSize.sidebar + 1) + 'px';
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.__eagleBus.emit('OPEN_URL_IN_PANEL', 'about:blank?eagle-test=1');
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'wp-url-in-panel',
    `(() => {
      const webview = document.querySelector('#eagle-website-panel-host webview#website-panel-webview');
      return webview && webview.getAttribute('src') === 'about:blank?eagle-test=1' && window.$bodyScope.isOpenWebpagePanel === true;
    })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const s = window.$bodyScope;
      s.viewMode = 'all';
      s.$evalAsync();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'wp-hidden-again',
    `getComputedStyle(document.querySelector('#eagle-website-panel-host #website-panel')).display === 'none'`
  );

  // ── 截图留档（ErrorModal 打开态） ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.__eagleBus.emit('OPEN_ERROR', {
        errorList: [
          { type: 'DOWNLOAD_ERROR', reason: 'HTTP_ERROR', detail: '403', object: { name: 'Shot A', url: 'https://example.com/x.png', website: 'https://example.com/x' } },
        ],
      });
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(400);
  await screenshotTo('test-run/react-stage7d1b-modals.png', 5000);

  if (failures.length > 0) {
    console.error(`\nSTAGE7D1B SMOKE FAILED: ${failures.length} assertion(s): ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nSTAGE7D1B SMOKE OK');
  }
} finally {
  await stop(stack).catch(() => {});
  // undici keep-alive socket 会拖住事件循环，测试结果已输出，直接强退
  try { process.exit(process.exitCode || 0); } catch (err) {}
}
