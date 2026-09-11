/**
 * D-3：UI 闭环测试共用引导（库 + 1 张图 fixture + CDP evaluate/waitFor 封装）。
 * 用法：
 *   import { bootWithItem, finish } from './closed-loop-common.mjs';
 *   const ctx = await bootWithItem('name');
 *   await ctx.waitFor(() => ctx.ev('...'), 'label', 20000);
 *   ... ; await finish(ctx, ok, 'MY_OK', {extra});
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { bootStack, stop, waitFor, delay } from './react-cdp-harness.mjs';

export async function bootWithItem(tag, { items = 1, beforeElectron } = {}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `eagle-${tag}-`));
  const librariesRoot = path.join(tempRoot, 'libraries');
  const stateFile = path.join(tempRoot, 'library-state.json');
  const userDataDir = path.join(tempRoot, 'user-data');
  fs.mkdirSync(librariesRoot, { recursive: true });
  const stack = await bootStack({
    librariesRoot, stateFile, userDataDir,
    beforeElectron: async (apiPort, thumbnailPort, extensionPort, vitePort) => {
      const post = async (route, body) => {
        const r = await fetch(`http://127.0.0.1:${apiPort}${route}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        return (await r.json()).data;
      };
      await post('/api/library/create', { name: `${tag} Library`, savePath: librariesRoot });
      const sharp = (await import('sharp')).default;
      const paths = [];
      for (let i = 0; i < items; i++) {
        const png = await sharp({ create: { width: 320, height: 200, channels: 4, background: i % 2 ? '#f472b6' : '#38bdf8' } }).png().toBuffer();
        const p = path.join(librariesRoot, `${tag}-${i}.png`);
        fs.writeFileSync(p, png);
        paths.push(p);
      }
      await post('/api/item/addFromPath', { paths });
      if (beforeElectron) await beforeElectron(apiPort, post);
    },
  });
  const { page } = stack;
  const ev = async (expr, awaitPromise = false) => {
    const r = await page.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise });
    return r.result ? r.result.value : undefined;
  };
  const ok = await waitFor(async () => (await ev('document.readyState')) === 'complete', 'ready', 45000).then(() => true).catch(() => false);
  if (!ok) throw new Error('page did not become ready');
  await waitFor(async () => await ev(`!!document.getElementById('main-app')`), 'main-app', 45000);
  await waitFor(async () => (await ev(`document.querySelectorAll('#box-list .box').length`)) > 0, 'grid boxes', 45000);
  return { stack, page, ev, waitFor, delay, tempRoot, librariesRoot };
}

export async function finish(ctx, failure, okTag, extra) {
  if (failure) console.error(`${okTag.replace(/_OK$/, '_FAIL')} ${failure.message}`);
  else console.log(`${okTag} ${JSON.stringify(extra || {})}`);
  try {
    if (ctx) {
      await stop(ctx.stack.electron);
      await stop(ctx.stack.vite);
      await stop(ctx.stack.backend);
    }
  } catch (e) { /* noop */ }
  try { if (ctx) fs.rmSync(ctx.tempRoot, { recursive: true, force: true }); } catch (e) { /* noop */ }
  process.exit(failure ? 1 : 0);
}
