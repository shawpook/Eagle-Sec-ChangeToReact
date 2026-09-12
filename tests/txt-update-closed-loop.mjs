import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { bootStack, stop, waitFor } from './react-cdp-harness.mjs';

// b1-9as：update-txt-item 通道闭环——text-editor 保存 → 渲染层 send（shim 路由直通）→
// main 回发各渲染窗 → shim onIpc 桥 → shim 总线（itemDomain 生产接收路径）。
// 双捕获断言往返：shimBus（生产链）+ native（preload 桥原始交付）。
// 用 bootStack 全栈（vite 页面加载 shims.js——裸 regression-host 窗口无 shims，
// require 走 nodeIntegration 原生通道，测不到 shim 路由）。
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-txt-update-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });

let stack;
let failure = null;
try {
  stack = await bootStack({ librariesRoot, stateFile, userDataDir });
  const { page } = stack;

  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
    return r.result.value === 'complete';
  }, 'main window ready', 45000);
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', { expression: `!!window.__eagleBrowserShimLoaded && !!window.__eagleIpc`, returnByValue: true });
    return r.result.value === true;
  }, 'shims loaded', 45000);

  // 双捕获：shim 总线（itemDomain 生产接收路径，两参签名——shim emit 前置 {} 事件参）
  // + 原生 onIpc（preload 桥原始交付）
  await page.send('Runtime.evaluate', { expression: `(() => {
    window.__b1_9as = { shimBus: null, native: null };
    window.__eagleIpc.on('update-txt-item', (_e, params) => { window.__b1_9as.shimBus = params; });
    if (window.eagleDesktop && typeof window.eagleDesktop.onIpc === 'function') {
      window.eagleDesktop.onIpc('update-txt-item', (value) => { window.__b1_9as.native = value; });
    }
    return true;
  })()`, returnByValue: true });

  // 生产发送路径：text-editor entry.tsx 保存 → parent.require('electron').ipcRenderer.send
  // （shim require → shim send 路由 → native 直通）
  await page.send('Runtime.evaluate', {
    expression: `require('electron').ipcRenderer.send('update-txt-item', { id: 'TXT1', text: 'NEW' }); true`,
    returnByValue: true,
  });

  const result = await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', { expression: 'JSON.stringify(window.__b1_9as || {})', returnByValue: true });
    const parsed = JSON.parse(r.result.value || '{}');
    const shimBus = !!(parsed.shimBus && parsed.shimBus.id === 'TXT1' && parsed.shimBus.text === 'NEW');
    const native = !!(parsed.native && parsed.native.id === 'TXT1' && parsed.native.text === 'NEW');
    return shimBus && native ? { shimBus, native } : null;
  }, 'round-trip capture', 20000);

  // 静态接线审计：main 侧监听 + shim 直通 + 桥登记三处齐全
  const mainSource = fs.readFileSync(path.join(projectRoot, 'electron', 'main.cjs'), 'utf8');
  if (!mainSource.includes("ipcMain.on('update-txt-item'")) throw new Error('update-txt-item handler not registered in main.cjs');
  const shimSource = fs.readFileSync(path.join(projectRoot, 'frontend', 'public', 'shims.js'), 'utf8');
  if (!shimSource.includes("channel === 'update-txt-item'")) throw new Error('update-txt-item send passthrough missing in shims.js');
  if (!shimSource.includes("'update-txt-item',")) throw new Error('update-txt-item onIpc bridge missing in shims.js');

  console.log(`TXT_UPDATE_CLOSED_LOOP_OK ${JSON.stringify(result)}`);
} catch (err) {
  failure = err;
  console.error(`TXT_UPDATE_CLOSED_LOOP_FAIL ${err.message}`);
} finally {
  if (stack) {
    await stop(stack.electron);
    await stop(stack.vite);
    await stop(stack.backend);
  }
  try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
}
process.exit(failure ? 1 : 0);
