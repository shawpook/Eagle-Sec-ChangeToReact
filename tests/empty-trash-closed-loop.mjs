import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { bootStack, stop, waitFor } from './react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// b1-9ar：empty-trash 通道闭环——渲染层 send（shim 路由直通，DuplicateFamily/ayncsImagesRemove
// 生产发送面）→ main 逐 id 走 backend /api/item/emptyTrash {ids:[id], force:true} 物理删除 →
// 每项回发 remove-trash-item → shim onIpc 桥 → shim 总线（miscDomain:892 进度监听）。
// 断言：backend 条目消失 + .info 目录物理消失 + 回程事件逐项 ≥N；cancel-empty-trash 静态审计。
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-empty-trash-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const sourcesRoot = path.join(tempRoot, 'sources');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourcesRoot, { recursive: true });

function createPng(filePath, color, width = 96, height = 64) {
  const image = new PNG({ width, height });
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 4;
    image.data[offset] = color[0];
    image.data[offset + 1] = color[1];
    image.data[offset + 2] = color[2];
    image.data[offset + 3] = 255;
  }
  fs.writeFileSync(filePath, PNG.sync.write(image));
}

let stack;
let importedIds = null;
let failure = null;
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
      await post('/api/library/create', { name: 'Empty Trash Smoke', savePath: librariesRoot });
      const sourceOne = path.join(sourcesRoot, 'Trash One.png');
      const sourceTwo = path.join(sourcesRoot, 'Trash Two.png');
      createPng(sourceOne, [25, 60, 210]);
      createPng(sourceTwo, [30, 180, 90]);
      const imported = await post('/api/item/addFromPaths', {
        images: [{ path: sourceOne, name: 'Trash One' }, { path: sourceTwo, name: 'Trash Two' }],
      });
      if (!Array.isArray(imported) || imported.length !== 2) throw new Error(`fixture import failed: ${JSON.stringify(imported)}`);
      importedIds = imported.map((item) => item.id);
    },
  });
  const { page } = stack;
  const itemIds = importedIds;

  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
    return r.result.value === 'complete';
  }, 'main window ready', 45000);
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', { expression: `!!window.__eagleBrowserShimLoaded && !!window.__eagleIpc`, returnByValue: true });
    return r.result.value === true;
  }, 'shims loaded', 45000);

  if (!Array.isArray(itemIds) || itemIds.length !== 2) throw new Error(`item ids unavailable: ${JSON.stringify(itemIds)}`);
  const [idOne, idTwo] = itemIds;
  const lib = await (await fetch(`http://127.0.0.1:${stack.apiPort}/api/library/current?includeItems=true`)).json();
  const rootDir = lib?.data?.rootDir || lib?.rootDir;
  if (!rootDir) throw new Error(`rootDir unavailable: ${JSON.stringify(lib).slice(0, 200)}`);

  // 回程捕获：shim 总线（miscDomain remove-trash-item 生产接收路径）
  await page.send('Runtime.evaluate', { expression: `(() => {
    window.__b1_9ar = { removeEvents: 0 };
    window.__eagleIpc.on('remove-trash-item', () => { window.__b1_9ar.removeEvents += 1; });
    return true;
  })()`, returnByValue: true });

  // 生产发送路径：ayncsImagesRemove/DuplicateFamily → shim send 直通（含尾逗号分批原样）
  await page.send('Runtime.evaluate', {
    expression: `require('electron').ipcRenderer.send('empty-trash', ${JSON.stringify(`${idOne},${idTwo},`)}); true`,
    returnByValue: true,
  });

  // 数据面：backend 条目消失 + .info 目录物理消失
  await waitFor(async () => {
    const now = await (await fetch(`http://127.0.0.1:${stack.apiPort}/api/library/current?includeItems=true`)).json();
    const items = (now?.data?.items || now?.items || []);
    return items.every((item) => item.id !== idOne && item.id !== idTwo) ? true : null;
  }, 'backend items removed', 30000);
  await waitFor(async () => {
    const goneOne = !fs.existsSync(path.join(rootDir, 'images', `${idOne}.info`));
    const goneTwo = !fs.existsSync(path.join(rootDir, 'images', `${idTwo}.info`));
    return goneOne && goneTwo ? true : null;
  }, '.info dirs physically removed', 30000);

  // 回程节奏：每项恰好一次 remove-trash-item
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', { expression: 'window.__b1_9ar.removeEvents', returnByValue: true });
    return r.result.value >= 2 ? r.result.value : null;
  }, 'remove-trash-item events', 30000);

  // 静态接线审计：main 侧双 handler + shim 直通 + 桥登记
  const mainSource = fs.readFileSync(path.join(projectRoot, 'electron', 'main.cjs'), 'utf8');
  if (!mainSource.includes("ipcMain.on('empty-trash'")) throw new Error('empty-trash handler not registered in main.cjs');
  if (!mainSource.includes("ipcMain.on('cancel-empty-trash'")) throw new Error('cancel-empty-trash handler not registered in main.cjs');
  if (!mainSource.includes('/api/item/emptyTrash')) throw new Error('empty-trash handler does not call /api/item/emptyTrash');
  const shimSource = fs.readFileSync(path.join(projectRoot, 'frontend', 'public', 'shims.js'), 'utf8');
  if (!shimSource.includes("channel === 'empty-trash'")) throw new Error('empty-trash send passthrough missing in shims.js');
  if (!shimSource.includes("'remove-trash-item',")) throw new Error('remove-trash-item onIpc bridge missing in shims.js');

  console.log(`EMPTY_TRASH_CLOSED_LOOP_OK ${JSON.stringify({ itemIds })}`);
} catch (err) {
  failure = err;
  console.error(`EMPTY_TRASH_CLOSED_LOOP_FAIL ${err.message}`);
} finally {
  if (stack) {
    await stop(stack.electron);
    await stop(stack.vite);
    await stop(stack.backend);
  }
  try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
}
process.exit(failure ? 1 : 0);
