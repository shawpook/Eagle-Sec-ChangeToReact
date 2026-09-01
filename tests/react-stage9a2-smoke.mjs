/**
 * React 化改造 —— 阶段9a-2闭环测试（预览大窗：web-view 宿主 + cgNotify 等价层 + gif iframe 链路）。
 *
 * 运行：node tests/react-stage9a2-smoke.mjs
 * 断言点：
 *  1. 主窗口 eagleDesktop.preview.open({images:[{id}]}) → main.cjs openOriginalPreview →
 *     preview-window target 出现 → 连接（同时证明 shims real-path init 桥缓冲 + entry-ready 轮询）
 *  2. init 到达：__eaglePreviewController.current 就绪（runInitSequence 经 entry applyController）
 *  3. web-view 宿主（js/directives/webview.js 移植）：注入 url item → #webview-{id} > webview#url-viewer
 *     （useragent/httpreferrer/allowpopups 属性、src=item.url、wrapper .detail-wrap.full.url）
 *  4. cgNotify 等价层：scope.activateFont(fakeFont) → .cg-notify-message.cg-notify-message-center
 *     内 .cg-notify-message-template 文本含字体名 + .cg-notify-close 按钮；duration 1000 后自动消失
 *  5. gif iframe 链路：habits.gifViewer='on' → #gif-viewer iframe（src=gif-viewer/index.html?path=...）
 *     + .footbar .gif-toolbar.init 进度条态（isGifReady=false）；截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay, connect } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage9a2-'));
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
      await post('/api/library/create', { name: 'React Stage9a2 Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#6366f1' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's9a2.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's9a2.png')] });
    },
  });
  const { page, debugPort } = stack;

  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', { expression: `document.readyState`, returnByValue: true });
    return r.result.value === 'complete';
  }, 'main window ready', 30000);

  const waitExpr = (expression) => page.send('Runtime.evaluate', { expression, returnByValue: true });
  await waitFor(async () => (await waitExpr(`!!document.querySelector('#box-list .box')`)).result.value, 'grid boxes rendered', 45000);

  const failures = [];
  // 8c 教训：Runtime.evaluate 表达式 throw 不 reject（落 exceptionDetails）——必须检查，否则静默失败
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

  // ── 打开预览大窗 ──
  const itemId = (await waitExpr(`window.$bodyScope && window.$bodyScope.allData && window.$bodyScope.allData[0] && window.$bodyScope.allData[0].id`)).result.value;
  if (!itemId) throw new Error('No item id in main window');
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      window.eagleDesktop.preview.open({ images: [{ id: ${JSON.stringify(itemId)} }], show: true });
      return true;
    })()`,
    returnByValue: true,
  });

  // ── 等 preview-window target 并连接 ──
  let pw = null;
  await waitFor(async () => {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      const target = targets.find((t) => t.type === 'page' && String(t.url).includes('preview-window.html'));
      if (target && target.webSocketDebuggerUrl) {
        pw = await connect(target.webSocketDebuggerUrl);
        return true;
      }
    } catch (err) { /* retry */ }
    return false;
  }, 'preview window CDP target', 30000);

  await waitFor(async () => {
    const r = await pw.send('Runtime.evaluate', { expression: `document.readyState`, returnByValue: true });
    return r.result.value === 'complete';
  }, 'preview window ready', 30000);

  // 抓 renderer console error / 未捕获异常（React 树静默卸载的诊断通道，7d1c1 教训）
  const consoleLogs = [];
  const originalOnMessage = pw.ws.onmessage;
  pw.ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) {
        consoleLogs.push(`console.${message.params.type}: ` + message.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 400));
      }
      if (message.method === 'Runtime.exceptionThrown') {
        consoleLogs.push('EXCEPTION: ' + String((message.params.exceptionDetails.exception || {}).description || message.params.exceptionDetails.text).slice(0, 400));
      }
    } catch (err) {}
    originalOnMessage(event);
  };
  await pw.send('Runtime.enable');
  const dumpLogs = (label) => {
    console.log(`INFO ${label} console tail: ${consoleLogs.slice(-4).join(' | ') || '(none)'}`);
  };

  // ── 断言 1/2：接线 + init 序列 ──
  await assertExprOn(pw, 'pw2a-controller-contract', `(() => {
    return !!window.__eaglePreviewController && window.$bodyScope === window.__eaglePreviewController
      && !!document.getElementById('eagle-preview-react-host');
  })()`);
  await assertExprOn(pw, 'pw2a-init-arrived', `(() => {
    const s = window.__eaglePreviewController;
    return !!s && !!s.current && Array.isArray(s.images) && s.images.length > 0 && !!s.imagesDir;
  })()`);
  await assertExprOn(pw, 'pw2a-entry-ready-marker', `window.__eaglePreviewEntryReady === true`);
  await assertExprOn(pw, 'pw2a-initial-render', `(() => {
    return document.getElementById('eagle-preview-toolbar-anchor').children.length > 0
      && document.getElementById('detail-container').children.length > 0;
  })()`);
  dumpLogs('initial');

  // ── 断言 3：web-view 宿主（url 分支） ──
  await evalOn(pw, `(() => {
    window.__eagleErrLog = [];
    window.addEventListener('error', (e) => window.__eagleErrLog.push('error: ' + String((e.error && e.error.stack) || e.message).slice(0, 300)));
    window.addEventListener('unhandledrejection', (e) => window.__eagleErrLog.push('rejection: ' + String((e.reason && e.reason.stack) || e.reason).slice(0, 300)));
    const origError = console.error;
    console.error = (...args) => { window.__eagleErrLog.push('console.error: ' + args.map((a) => String((a && a.stack) || a)).join(' ').slice(0, 300)); origError.apply(console, args); };
    return true;
  })()`);
  const injectedUrl = await evalOn(pw, `(() => {
      const s = window.__eaglePreviewController;
      s.images = [{ id: 'pw2-url-1', name: 'Eagle Site', ext: 'url', url: 'https://www.eagle.cool', width: 800, height: 600 }];
      s.current = s.images[0];
      s.$evalAsync();
      return s.current && s.current.id;
    })()`);
  console.log(`INFO url-item injected: ${injectedUrl}`);
  await assertExprOn(pw, 'pw2a-webview-host', `(() => {
    const wrapper = document.querySelector('#webview-pw2-url-1');
    if (!wrapper) return false;
    const webview = wrapper.querySelector('webview#url-viewer');
    return !!webview
      && wrapper.closest('.detail-wrap') && wrapper.closest('.detail-wrap').classList.contains('full')
      && wrapper.closest('.detail-wrap').classList.contains('url')
      && webview.getAttribute('useragent') === window.EagleConfig.USER_AGENT
      && webview.getAttribute('allowpopups') !== null
      && webview.src === 'https://www.eagle.cool';
  })()`);
  await assertExprOn(pw, 'pw2a-webview-toolbar', `(() => {
    // url 工具列分支：webview-toolbar 存在（back/forward/refresh 控件由 React 接管）
    const toolbar = document.querySelector('#eagle-preview-toolbar-anchor .toolbar .left');
    return !!toolbar && !!toolbar.firstElementChild;
  })()`);
  // url 分支整段（含 WebviewToolbar 200ms 后 setControl 重渲染）不得产生任何未捕获错误
  await delay(600);
  await assertExprOn(pw, 'pw2a-no-uncaught-errors', `(window.__eagleErrLog || []).length === 0`);

  // ── 断言 4：cgNotify 等价层 ──
  await pw.send('Runtime.evaluate', {
    expression: `(() => {
      const s = window.__eaglePreviewController;
      s.activateFont({ id: 'pw2-font-1', name: 'PW2 Test', ext: 'ttf', fontMetas: { postScriptName: { k: 'PW2Test' } } }, { showNotify: true });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExprOn(pw, 'pw2a-notify-shown', `(() => {
    const el = document.querySelector('.cg-notify-message.cg-notify-message-center');
    if (!el) return false;
    const template = el.querySelector('.cg-notify-message-template');
    return !!template && template.textContent.indexOf('PW2 Test') > -1 && !!el.querySelector('.cg-notify-close');
  })()`);
  await delay(1800);
  await assertExprOn(pw, 'pw2a-notify-auto-dismiss', `!document.querySelector('.cg-notify-message')`);

  // ── 断言 5：gif iframe 链路 ──
  await pw.send('Runtime.evaluate', {
    expression: `(() => {
      const s = window.__eaglePreviewController;
      s.preferences.habits.gifViewer = 'on';
      s.images = [{ id: 'pw2-gif-1', name: 'sample', ext: 'gif', width: 100, height: 100 }];
      s.current = s.images[0];
      s.$evalAsync();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExprOn(pw, 'pw2a-gif-iframe', `(() => {
    const iframe = document.querySelector('#gif-viewer');
    if (!iframe) return false;
    return String(iframe.getAttribute('src')).indexOf('gif-viewer/index.html?path=') === 0
      && String(iframe.getAttribute('src')).indexOf('render=') > -1
      && document.body.classList.contains('gifviewer');
  })()`);
  await assertExprOn(pw, 'pw2a-gif-footbar-init', `(() => {
    const footbar = document.querySelector('#eagle-preview-footbar-anchor .footbar');
    return !!footbar
      && footbar.style.display !== 'none'
      && !!footbar.querySelector('.gif-toolbar.init')
      && !!footbar.querySelector('.gif-toolbar.in');
  })()`);

  await delay(700);
  try {
    const screenshot = await Promise.race([
      pw.send('Page.captureScreenshot', { format: 'png' }),
      delay(5000).then(() => { throw new Error('screenshot timeout'); }),
    ]);
    fs.mkdirSync('test-run', { recursive: true });
    fs.writeFileSync('test-run/react-stage9a2-preview.png', Buffer.from(screenshot.data, 'base64'));
    console.log('PASS screenshot-saved test-run/react-stage9a2-preview.png');
  } catch (err) {
    console.log(`WARN screenshot failed: ${err.message}`);
  }

  if (failures.length > 0) {
    console.error(`\nSTAGE9A2 SMOKE FAILED: ${failures.length} assertion(s): ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nSTAGE9A2 SMOKE OK');
  }
} catch (err) {
  console.error('SMOKE ERROR:', err && err.stack || err);
  process.exitCode = 1;
} finally {
  await stop(stack).catch(() => {});
  try { process.exit(process.exitCode || 0); } catch (err) {}
}
