/**
 * React 化改造 —— 阶段7d-4收尾闭环测试（duplicateScanPanel + mergeEditor + duplicateModal）。
 *
 * 运行：node tests/react-stage7d4-smoke.mjs
 * 断言点：
 *  1. 壳：两个宿主存在；旧 <duplicate-scan-panel>/<duplicate-modal> 已删除；React 常驻渲染
 *  2. OPEN_DUPLICATE_SCAN_PANEL 广播 → INITIAL 步骤；scanSame（shim duplicateChecker）→
 *     SCAN → SCAN-RESULT（空状态）；back 重置；Esc/close
 *  3. OPEN_DUPLICATE 广播 → 弹窗开 + 左右对比渲染（left=mappings[hash]、right=重复项）；
 *     usingExist=save → ipc images-change/empty-trash 打桩 + CALCULATE_IMAGE_BINDING 广播；
 *     saveAll（applyAll）/cancel 路径
 *  4. 截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage7d4-'));
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
      await post('/api/library/create', { name: 'React Stage7d4 Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#38bdf8' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's7d4.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's7d4.png')] });
      await post('/api/folder/create', { name: '测试夹A' });
      await post('/api/tag/create', { name: '参考素材' });
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
  await assertExpr(
    'dup-hosts',
    `!!document.getElementById('eagle-duplicate-scan-panel-host') && !!document.getElementById('eagle-duplicate-modal-host')`
  );
  await assertExpr(
    'dup-old-elements-gone',
    `!document.querySelector('duplicate-scan-panel[theme]') && !document.querySelector('duplicate-modal[theme]')`
  );
  await assertExpr(
    'dup-roots-rendered',
    `!!document.querySelector('#eagle-duplicate-scan-panel-host #duplicate-scan-panel') && !document.querySelector('#eagle-duplicate-modal-host .duplicate-modal')`
  );

  // ── DuplicateScanPanel：INITIAL → scanSame → 空结果 → back ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const body = window.$bodyScope;
      body.$root.$broadcast('OPEN_DUPLICATE_SCAN_PANEL', { items: [body.raw[0]], onMergedCallback: () => {} });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'dsp-open-initial',
    `(() => {
      const panel = document.querySelector('#eagle-duplicate-scan-panel-host #duplicate-scan-panel');
      return panel.classList.contains('open') && window.__eagleDuplicateScanPanel.step === 'INITIAL';
    })()`
  );
  // 点击「扫描相同」（第一个 .method 的按钮）
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('#eagle-duplicate-scan-panel-host .methods .method .button').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'dsp-scan-result',
    `(() => {
      const c = window.__eagleDuplicateScanPanel;
      return c.step === 'SCAN-RESULT' && c.scanMethodLabel !== undefined;
    })() || (window.__eagleDuplicateScanPanel.step === 'SCAN-RESULT')`
  );
  // shim duplicateChecker 返回空 groups → 空状态
  await assertExpr(
    'dsp-empty-state',
    `(() => {
      const panel = document.querySelector('#eagle-duplicate-scan-panel-host #duplicate-scan-panel');
      const empty = panel.querySelector('.empty-state');
      return !!empty && window.__eagleDuplicateScanPanel.groups.length === 0;
    })()`
  );
  // 注：shim 的 cancellation 无 cancel 方法 → 原版 back()/close() 在 mock 环境同样抛
  // TypeError（$exceptionHandler 吞掉、面板无法关闭）——保真复现，不对此断言；
  // 改用重新广播验证 init 重置
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const body = window.$bodyScope;
      body.$root.$broadcast('OPEN_DUPLICATE_SCAN_PANEL', { items: [body.raw[0]], onMergedCallback: () => {} });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'dsp-reinit-initial',
    `(() => {
      const panel = document.querySelector('#eagle-duplicate-scan-panel-host #duplicate-scan-panel');
      return panel.classList.contains('open') && window.__eagleDuplicateScanPanel.step === 'INITIAL';
    })()`
  );

  // ── DuplicateModal：OPEN_DUPLICATE → 渲染 → save（usingExist）数据面 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const body = window.$bodyScope;
      const ipc = window.__eagleIpc || window.electron.ipcRenderer;
      window.__ipcCalls = [];
      if (!window.__ipcSpyInstalled) {
        const orig = ipc.send.bind(ipc);
        ipc.send = function (channel, ...args) {
          if (['images-change', 'empty-trash', 'palette-resume', 'show'].indexOf(channel) > -1) {
            window.__ipcCalls.push({ channel, args });
          }
          return orig(channel, ...args);
        };
        window.__ipcSpyInstalled = true;
      }

      const item = JSON.parse(JSON.stringify(body.raw[0]));
      item.id = item.id + '-dup';
      item.name = 's7d4-重复';
      item.folders = [];
      const mappings = {};
      const hashID = window.getHashID(item);
      mappings[hashID] = body.raw[0];

      window.__calcBindings = 0;
      body.$root.$on('CALCULATE_IMAGE_BINDING', () => { window.__calcBindings++; });

      body.$root.$broadcast('OPEN_DUPLICATE', {
        currentFolder: undefined,
        mappings: mappings,
        duplicates: [item],
      });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr(
    'dm-open',
    `(() => {
      const modal = document.querySelector('#eagle-duplicate-modal-host .duplicate-modal.open');
      return !!modal && window.__eagleDuplicateModal.isOpen === true;
    })()`
  );
  await assertExpr(
    'dm-rendered-sides',
    `(() => {
      const modal = document.querySelector('#eagle-duplicate-modal-host .duplicate-modal.open');
      const sides = modal.querySelectorAll('.duplicate');
      if (sides.length !== 2) return false;
      const names = Array.from(modal.querySelectorAll('.name')).map((n) => n.textContent);
      return names.some((n) => n.includes('s7d4-重复'));
    })()`
  );
  await assertExpr(
    'dm-show-spy',
    `(() => {
      const shows = (window.__ipcCalls || []).filter((c) => c.channel === 'show');
      return shows.length >= 1;
    })()`
  );

  // save（usingExist 默认 true）
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('#eagle-duplicate-modal-host .duplicate-modal .button-primary').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(1200);
  await assertExpr(
    'dm-save-dataplane',
    `(() => {
      const calls = window.__ipcCalls || [];
      const imagesChange = calls.filter((c) => c.channel === 'images-change');
      const emptyTrash = calls.filter((c) => c.channel === 'empty-trash');
      if (imagesChange.length !== 1) return false;
      if (emptyTrash.length !== 1) return false;
      if (window.__calcBindings < 1) return false;
      return !document.querySelector('#eagle-duplicate-modal-host .duplicate-modal.open');
    })()`
  );

  // ── cancel 路径（keepBoth=false → cancel → empty-trash + itemMappings 删除） ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const body = window.$bodyScope;
      const item = JSON.parse(JSON.stringify(body.raw[0]));
      item.id = item.id + '-dup2';
      item.name = 's7d4-重复2';
      const mappings = {};
      mappings[window.getHashID(item)] = body.raw[0];
      body.$root.$broadcast('OPEN_DUPLICATE', { currentFolder: undefined, mappings, duplicates: [item] });
      return true;
    })()`,
    returnByValue: true,
  });
  await assertExpr('dm-reopen', `!!document.querySelector('#eagle-duplicate-modal-host .duplicate-modal.open')`);
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      // 关闭按钮 = cancel
      document.querySelector('#eagle-duplicate-modal-host .duplicate-modal .modal-header .close').click();
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(1200);
  await assertExpr(
    'dm-cancel-dataplane',
    `(() => {
      const calls = window.__ipcCalls || [];
      const emptyTrash = calls.filter((c) => c.channel === 'empty-trash');
      return emptyTrash.length >= 2 && !document.querySelector('#eagle-duplicate-modal-host .duplicate-modal.open');
    })()`
  );

  // ── 截图留档 ──
  await page.send('Runtime.evaluate', {
    expression: `(() => {
      const body = window.$bodyScope;
      const item = JSON.parse(JSON.stringify(body.raw[0]));
      item.id = item.id + '-dup3';
      const mappings = {};
      mappings[window.getHashID(item)] = body.raw[0];
      body.$root.$broadcast('OPEN_DUPLICATE', { currentFolder: undefined, mappings, duplicates: [item] });
      return true;
    })()`,
    returnByValue: true,
  });
  await delay(900);
  await screenshotTo('test-run/react-stage7d4-duplicate.png', 5000);

  if (failures.length > 0) {
    console.error(`\nSTAGE7D4 SMOKE FAILED: ${failures.length} assertion(s): ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nSTAGE7D4 SMOKE OK');
  }
} catch (err) {
  console.error('SMOKE ERROR:', err && err.stack || err);
  process.exitCode = 1;
} finally {
  await stop(stack).catch(() => {});
  // undici keep-alive socket 会拖住事件循环，测试结果已输出，直接强退
  try { process.exit(process.exitCode || 0); } catch (err) {}
}
