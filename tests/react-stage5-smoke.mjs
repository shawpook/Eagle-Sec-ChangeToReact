/**
 * React 化改造 —— 阶段5收尾闭环测试（详情模式与查看器）。
 *
 * 运行：node tests/react-stage5-smoke.mjs
 * 断言点：
 *  1. 静态壳：#eagle-detail-host / #detail-container / #eagle-detail-cropsize-host 存在
 *  2. 进入详情：body.is-detail-mode + React 渲染详情工具列 + image 分支 detail-wrap
 *  3. smoothZoom 包裹关系保持（#detail-container 被 .smooth_zoom_preloader 包裹，元素身份未重建）
 *  4. shims detail-delivery 门控释放（__eagleDetailDeliveryState.releasedAt > 0）
 *  5. 缩放滑条快照联动（scope.sliderZoomRatio → React range/进度条）
 *  6. 退出详情（leaveDetailMode → 状态复位）
 *  7. 截图留档 test-run/react-stage5-detail.png
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage5-'));
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
      await post('/api/library/create', { name: 'React Stage5 Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 640, height: 400, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      const tmp1 = path.join(librariesRoot, 'stage5-a.png');
      const tmp2 = path.join(librariesRoot, 'stage5-b.png');
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

  // 截图辅助：详情模式下 Page.captureScreenshot 在本环境会长时间挂起（旧版 Angular 模板同样，
  // 见 test-run/probe-shot-old.log —— 既有合成器怪癖，非阶段5回归），因此列表模式留存 +
  // 详情模式限时尝试降级为 WARN。
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

  // 列表模式截图留档
  await screenshotTo('test-run/react-stage5-list.png', 10000);

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

  // ── 阶段5：静态壳 ─────────────────────────────────────────────
  await assertExpr('shell-detail-host', `document.getElementById('eagle-detail-host') !== null`);
  await assertExpr(
    'shell-detail-container-plain',
    `(() => { const el = document.getElementById('detail-container'); return !!el && el.classList.contains('detail-container'); })()`
  );
  await assertExpr('shell-cropsize-host', `document.getElementById('eagle-detail-cropsize-host') !== null`);
  await assertExpr(
    'shell-no-ng-attrs-on-detail-container',
    `!document.getElementById('detail-container').hasAttribute('ng-click') && !document.getElementById('detail-container').hasAttribute('ng-switch')`
  );

  // ── 进入详情（走 shims 包裹后的 enterDetailMode；真实路径先点选再双击，等价于 selected=[item]） ──
  await page.send('Runtime.evaluate', {
    expression: `window.$bodyScope.$apply(() => {
      window.$bodyScope.selected = [window.$bodyScope.allData[0]];
      window.$bodyScope.enterDetailMode(null, window.$bodyScope.allData[0]);
    })`,
    returnByValue: true,
  });

  await assertExpr('detail-body-class', `document.body.classList.contains('is-detail-mode')`);
  await assertExpr(
    'detail-toolbar-rendered',
    `(() => { const t = document.querySelector('#eagle-detail-host .toolbar.has-border'); return !!t && !!t.querySelector('.breadcrumbs'); })()`
  );
  await assertExpr(
    'detail-toolbar-counter',
    `document.querySelector('#eagle-detail-host .breadcrumbs .counter') !== null && /1 \\/ 2/.test(document.querySelector('#eagle-detail-host .breadcrumbs .counter').textContent)`
  );
  await assertExpr(
    'detail-toolbar-exit-btn',
    `(() => { const btns = document.querySelectorAll('#eagle-detail-host .breadcrumbs .ic-btn'); return btns.length >= 2; })()`
  );
  await assertExpr(
    'detail-image-branch-rendered',
    `(() => { const c = document.getElementById('detail-container'); return !!c.querySelector('.detail-wrap') && !!c.querySelector('img#detail-image'); })()`
  );
  await assertExpr(
    'detail-comment-blur-input',
    `!!document.getElementById('detail-container').querySelector('#comment-blur')`
  );
  await assertExpr(
    'detail-placeholder-img',
    `document.getElementById('detail-container').querySelectorAll('img[style*="opacity"]').length >= 1`
  );
  await assertExpr(
    'detail-store-snapshot-current',
    `(() => { const d = window.__eagleDetailState && window.__eagleDetailState.getState && window.__eagleDetailState.getState(); return !!(d && d.snapshot && d.snapshot.current && d.snapshot.current.ext === 'png'); })()`
  );

  // ── smoothZoom 包裹关系保持（元素身份未被 React 重建） ──
  await assertExpr(
    'detail-smoothzoom-wrap-preserved',
    `(() => { const c = document.getElementById('detail-container'); return !!c && !!c.closest('.smooth_zoom_preloader'); })()`,
    20000
  );

  // ── shims detail-delivery 门控释放 ──
  await assertExpr(
    'detail-delivery-released',
    `window.__eagleDetailDeliveryState && window.__eagleDetailDeliveryState.releasedAt > 0 && !document.body.classList.contains('eagle-detail-awaiting-original')`,
    20000
  );

  // ── 缩放滑条快照联动 ──
  await page.send('Runtime.evaluate', {
    expression: `window.$bodyScope.sliderZoomRatio = 150; window.$bodyScope.$apply();`,
    returnByValue: true,
  });
  await assertExpr(
    'detail-slider-sync',
    `(() => { const input = document.getElementById('detail-slider-ratio'); return input && input.value === '150'; })()`
  );
  await assertExpr(
    'detail-slider-progressbar-sync',
    `(() => { const bar = document.querySelector('#detail-slider-ratio')?.closest('.range-wrap')?.querySelector('.range-progressbar .current'); return bar && bar.style.width !== ''; })()`
  );
  await page.send('Runtime.evaluate', {
    expression: `window.$bodyScope.sliderZoomRatio = 100; window.$bodyScope.$apply();`,
    returnByValue: true,
  });

  // 详情工具列按钮回调链路：点击 prev（disabled 断言不点），改用 toggle zoom 类按钮的存在性 + tippy 初始化
  await assertExpr(
    'detail-toolbar-tippy-attached',
    `document.querySelectorAll('#eagle-detail-host [tippy][data-tippy-root], #eagle-detail-host [tippy]').length > 0`
  );

  // ── 截图留档（详情模式，限时） ──
  await delay(300);
  await screenshotTo('test-run/react-stage5-detail.png', 10000);

  // ── 退出详情（ng-click 语义=在 $apply 内调用） ──
  await page.send('Runtime.evaluate', {
    expression: `window.$bodyScope.$apply(() => window.$bodyScope.leaveDetailMode())`,
    returnByValue: true,
  });
  await assertExpr('detail-exit-body-class', `!document.body.classList.contains('is-detail-mode')`);
  await assertExpr(
    'detail-exit-branch-cleared',
    `(() => { const c = document.getElementById('detail-container'); return !c.querySelector('.detail-wrap'); })()`
  );
  await assertExpr(
    'detail-container-survives-exit',
    `document.getElementById('detail-container') !== null`
  );

  if (failures.length > 0) {
    console.error(`STAGE5_SMOKE_FAILED ${JSON.stringify(failures)}`);
    process.exitCode = 1;
  } else {
    console.log('STAGE5_SMOKE_OK');
  }
} finally {
  if (stack) {
    await stop(stack.electron);
    await stop(stack.vite);
    await stop(stack.backend);
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
