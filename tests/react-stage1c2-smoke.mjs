/**
 * React 化改造 —— 阶段1 c2 闭环测试（eagle 对象族移植）。
 *
 * 运行：node tests/react-stage1c2-smoke.mjs
 * 断言点：
 *  1. core eagle 装配完成：__eagleCoreEagle 上 inspector/filter/duplicateChecker/
 *     reverseImageSearch/aiSearch/customExport/combineImages/action 九实例在位
 *  2. ItemFilter：filterBadge 数值 + resetFilterRules/isOpen 方法在位；isOpen getter
 *  3. Inspector：width 数值（containerSize.inspector localStorage 派生）+ isHideInspector
 *     读写往返
 *  4. 与 bundle window.eagle 并存：window.eagle.filter 为 bundle 实例（filterBadge 同为
 *     数值），core 实例独立（未覆写）
 *  5. TreeUtil.walk 遍历 + urlEnlargerRemote.load 方法在位
 *  6. 截图留档
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage1c2-'));
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
      await post('/api/library/create', { name: 'React Stage1c2 Library', savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#0ea5e9' } }).png().toBuffer();
      fs.writeFileSync(path.join(librariesRoot, 's1c2.png'), png);
      await post('/api/item/addFromPath', { paths: [path.join(librariesRoot, 's1c2.png')] });
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
  await delay(800);

  const screenshotTo = async (file, timeoutMs) => {
    try {
      const screenshot = await Promise.race([
        page.send('Page.captureScreenshot', { format: 'png' }),
        delay(timeoutMs).then(() => { throw new Error(`screenshot timeout (${timeoutMs})ms`); }),
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

  const evalNow = async (expression) => {
    const r = await page.send('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) console.log(`WARN eval error: ${JSON.stringify(r.exceptionDetails).slice(0, 200)}`);
    return r;
  };

  // ── 装配 ──
  await assertExpr('c2-nine-instances', `(() => {
    const e = window.__eagleCoreEagle;
    if (!e) return false;
    return ['inspector','filter','duplicateChecker','reverseImageSearch','aiSearch','customExport','combineImages','action'].every(k => !!e[k])
      && !!e.utils.tree;
  })()`);

  // ── ItemFilter ──
  await assertExpr('c2-filter-methods', `(() => {
    const f = window.__eagleCoreEagle.filter;
    return typeof f.resetFilterRules === 'function' && typeof f.resetFilterCounts === 'function'
      && typeof f.isOpen === 'boolean' && typeof f.filterBadge === 'number';
  })()`);

  // ── Inspector ──
  await assertExpr('c2-inspector-width', `(() => {
    const ins = window.__eagleCoreEagle.inspector;
    return typeof ins.width === 'number' && ins.width > 0;
  })()`);
  await evalNow(`(() => {
    const ins = window.__eagleCoreEagle.inspector;
    const before = ins.isHideInspector;
    ins.isHideInspector = !before;
    window.__c2往返 = ins.isHideInspector === !before;
    ins.isHideInspector = before;
    return true;
  })()`);
  await assertExpr('c2-inspector-hide-roundtrip', `window.__c2往返 === true`);

  // ── 单一世界契约（b1-9o：bundle 摘除后 window.eagle 即 React coreEagle（bundleGlobals
  //    `w.eagle = coreEagle`），「bundle eagle 与 core 实例并存且独立」按设计消失）──
  await assertExpr('c2-bundle-eagle-untouched', `(() => {
    const be = window.eagle;
    const ce = window.__eagleCoreEagle;
    return !!be && !!ce && be.filter === ce.filter
      && typeof be.filter.filterBadge === 'number'
      && typeof ce.filter.filterBadge === 'number';
  })()`);

  // ── TreeUtil / urlEnlargerRemote ──
  await assertExpr('c2-treeutil-walk', `(() => {
    const tree = window.__eagleCoreEagle.utils.tree;
    const hits = [];
    tree.walk({ id: 'r', children: [{ id: 'a' }, { id: 'b' }] }, 'children', (n) => hits.push(n.id));
    return hits.join(',') === 'r,a,b';
  })()`);
  await assertExpr('c2-url-enlarger', `typeof window.__eagleCoreEagle.urlEnlargerRemote.load === 'function'`);

  await delay(600);
  await screenshotTo('test-run/react-stage1c2-smoke.png', 5000);

  if (failures.length) {
    console.error(`STAGE1C2 SMOKE FAILED: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('STAGE1C2 SMOKE OK');
  }
} catch (err) {
  console.error('STAGE1C2 SMOKE ERROR:', err);
  process.exitCode = 1;
} finally {
  if (stack) await stop(stack.electron).catch(() => {});
  if (stack) await stop(stack.vite).catch(() => {});
  if (stack) await stop(stack.backend).catch(() => {});
}
