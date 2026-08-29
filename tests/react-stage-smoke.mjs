/**
 * React 化改造 —— 阶段收尾闭环测试（可复用骨架）。
 *
 * 每阶段收尾跑：`node tests/react-stage-smoke.mjs`
 * 断言点（当前=阶段1 构建接线+壳/全局状态）：
 *  1. React mount 成功（#eagle-react-host 出现，由 src/app/react/main.tsx 挂载）
 *  2. 迁移期共存：Angular 主界面仍可用（#main-app、#sidebar、#box-container 渲染）
 *  3. 全局桥未被破坏：window.eagle / window.i18n / window.electronSettings 可用
 *  4. 截图留档到 test-run/react-stage-*.png
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-react-stage-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });

let stack;
try {
  stack = await bootStack({ librariesRoot, stateFile, userDataDir });
  const { page } = stack;

  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', {
      expression: `document.readyState`,
      returnByValue: true,
    });
    return r.result.value === 'complete';
  }, 'main window ready', 30000);

  // 逐项等待而非固定延时：全新 vite 实例冷启动会重新 pre-bundle 依赖，模块服务可能滞后。
  const waitExpr = (expression) => page.send('Runtime.evaluate', { expression, returnByValue: true });
  await waitFor(async () => (await waitExpr(`!!document.getElementById('main-app')`)).result.value, 'Angular main-app', 45000);
  await waitFor(async () => (await waitExpr(`typeof window.eagle !== 'undefined' && typeof window.eagle.inspector !== 'undefined'`)).result.value, 'window.eagle', 45000);
  await waitFor(async () => (await waitExpr(`!!document.getElementById('eagle-react-host')`)).result.value, 'React mount host', 45000);

  const assertions = [
    ['react-mount', `document.getElementById('eagle-react-host') !== null`],
    ['angular-main-app', `document.getElementById('main-app') !== null`],
    ['angular-sidebar', `document.getElementById('sidebar') !== null`],
    ['angular-box-container', `document.getElementById('box-container') !== null`],
    ['global-eagle', `typeof window.eagle !== 'undefined' && typeof window.eagle.inspector !== 'undefined'`],
    ['global-i18n', `typeof window.i18n !== 'undefined'`],
    ['global-settings', `typeof window.electronSettings !== 'undefined'`],
    ['react-store-exposed', `typeof window.__eagleReactStore !== 'undefined' && typeof window.__eagleReactStore.getState === 'function'`],
    ['react-store-theme', `(window.__eagleReactStore && (typeof window.__eagleReactStore.getState().theme === 'string'))`],
    // 阶段1：React 全局状态层与真实数据面同步 —— 初始态 body@theme 与 store.theme 一致
    ['stage1-theme-sync-initial', `window.__eagleReactStore.getState().theme === (document.body.getAttribute('theme') || 'gray')`],
    ['stage1-preferences-key-shared', `window.__eagleReactStore.getState().preferences !== null && typeof window.__eagleReactStore.getState().preferences.general.language === 'string'`],
    ['stage1-actions-exposed', `typeof window.__eagleReactStore.getState().applyThemePreference === 'function' && typeof window.__eagleReactStore.getState().openRegisterModal === 'function'`],
  ];

  const failures = [];
  for (const [name, expression] of assertions) {
    const pass = await (async () => {
      const r = await page.send('Runtime.evaluate', { expression, returnByValue: true });
      return r.result.value === true;
    })();
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`);
    if (!pass) failures.push(name);
  }

  // 阶段1核心闭环：写同一个 electron-settings「preferences」键 → shims 广播 change.current.theme
  // → Angular RootController 更新 body@theme；React store 监听同一事件同步 theme。
  // 数据面零改动断言：写入用的是与 RootController 相同的键与事件通道。
  const before = await page.send('Runtime.evaluate', {
    expression: `document.body.getAttribute('theme')`,
    returnByValue: true,
  });
  const beforeTheme = before.result.value || 'gray';
  const nextTheme = beforeTheme === 'light' ? 'gray' : 'light';

  await page.send('Runtime.evaluate', {
    expression: `window.electronSettings.setSync('preferences', { theme: { name: ${JSON.stringify(nextTheme.toUpperCase())}, css: ${JSON.stringify(nextTheme)} } })`,
    returnByValue: true,
  });
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', {
      expression: `(document.body.getAttribute('theme') === ${JSON.stringify(nextTheme)}) && (window.__eagleReactStore.getState().theme === ${JSON.stringify(nextTheme)})`,
      returnByValue: true,
    });
    return r.result.value === true;
  }, `theme switch to ${nextTheme} reflected on both Angular body and React store`, 15000);

  const appStyleHref = await page.send('Runtime.evaluate', {
    expression: `document.getElementById('app-style').getAttribute('href') || document.getElementById('app-style').href`,
    returnByValue: true,
  });
  const styleOk = String(appStyleHref.result.value).includes(`style_${nextTheme}.css`);
  console.log(`${styleOk ? 'PASS' : 'FAIL'} stage1-app-style-follows-theme (${appStyleHref.result.value})`);
  if (!styleOk) failures.push('stage1-app-style-follows-theme');

  // 还原主题，避免污染其它断言
  await page.send('Runtime.evaluate', {
    expression: `window.electronSettings.setSync('preferences', { theme: { name: ${JSON.stringify(beforeTheme.toUpperCase())}, css: ${JSON.stringify(beforeTheme)} } })`,
    returnByValue: true,
  });
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', {
      expression: `window.__eagleReactStore.getState().theme === ${JSON.stringify(beforeTheme)}`,
      returnByValue: true,
    });
    return r.result.value === true;
  }, `theme restored to ${beforeTheme}`, 15000);
  console.log(`PASS stage1-theme-restore (${beforeTheme})`);

  const shot = await page.send('Page.captureScreenshot', { format: 'png' });
  const dir = path.join(process.cwd(), 'test-run');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'react-stage-smoke.png'), Buffer.from(shot.data, 'base64'));
  console.log(`screenshot -> test-run/react-stage-smoke.png`);

  if (failures.length > 0) {
    console.error(`react-stage-smoke failed: ${failures.join(', ')}`);
    process.exit(1);
  }
  console.log('react-stage-smoke passed');
} finally {
  if (stack) {
    await stop(stack.electron);
    await stop(stack.vite);
    await stop(stack.backend);
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
