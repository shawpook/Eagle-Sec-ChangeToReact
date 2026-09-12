import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { bootStack, stop, waitFor } from './react-cdp-harness.mjs';

// b1-9at：native-viewer 主侧引擎闭环（残余台账⑦）——viewer 生产发送面
// parent.ipcRenderer.send('generate-hight-resolution-thumbnail')（shim 供给 + 直通）→
// main → backend /api/item/nativePreview：
//   ① ext:'ai'（PDF-compatible，手造最小 PDF）→ pdf.js worker 真渲 → finalFile PNG 字节
//   ② ext:'psd'（本环境无引擎——sharp 无 psdload 实锚）→ NATIVE_PREVIEW_UNSUPPORTED →
//      native-preview-failed 回程 → shim 桥 → shim 总线（viewer 停轮询 + ready 契约）
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-native-preview-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
const sourcesRoot = path.join(tempRoot, 'sources');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourcesRoot, { recursive: true });

function buildMinimalPdf(outPath) {
  const objects = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  objects.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << >> >>\nendobj\n');
  const stream = '1 0 0 RG 1 1 1 rg 0 0 200 200 re f 0 0 1 rg 20 20 160 160 re f\n';
  objects.push(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`);
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += obj;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  fs.writeFileSync(outPath, pdf, 'binary');
}

let stack;
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
      await post('/api/library/create', { name: 'Native Preview Smoke', savePath: librariesRoot });
    },
  });
  const { page } = stack;

  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
    return r.result.value === 'complete';
  }, 'main window ready', 45000);
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', {
      expression: `!!window.__eagleBrowserShimLoaded && !!window.ipcRenderer && typeof window.ipcRenderer.send === 'function'`,
      returnByValue: true,
    });
    return r.result.value === true;
  }, 'shims + window.ipcRenderer ready', 45000);

  // 生产发送面契约：window.ipcRenderer 即 shim 总线（viewer iframe 的 parent.ipcRenderer 同源）
  await page.send('Runtime.evaluate', { expression: `(() => {
    window.__b1_9at = { failedEvents: [], windowIpcIsShimBus: window.ipcRenderer === window.__eagleIpc };
    window.ipcRenderer.on('native-preview-failed', (_e, params) => { window.__b1_9at.failedEvents.push(params); });
    return true;
  })()`, returnByValue: true });
  const shape = await page.send('Runtime.evaluate', { expression: 'window.__b1_9at.windowIpcIsShimBus', returnByValue: true });
  if (shape.result.value !== true) throw new Error('window.ipcRenderer is not the shim bus');

  // ① ai 真渲：finalFile PNG 落盘
  const aiSource = path.join(sourcesRoot, 'fixture.ai');
  buildMinimalPdf(aiSource);
  const previewDir = path.join(tempRoot, 'eagle-temp', 'preview');
  fs.mkdirSync(previewDir, { recursive: true });
  const aiFinal = path.join(previewDir, 'ITEM-AI.png');
  await page.send('Runtime.evaluate', {
    expression: `window.ipcRenderer.send('generate-hight-resolution-thumbnail', ${JSON.stringify({
      filePath: aiSource,
      tempFile: path.join(previewDir, 'fixture.ai.png.tmp'),
      finalFile: aiFinal,
      size: 800,
      ext: 'ai',
    })}); true`,
    returnByValue: true,
  });
  await waitFor(async () => {
    if (!fs.existsSync(aiFinal)) return null;
    const head = fs.readFileSync(aiFinal).subarray(0, 8);
    return head.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? true : null;
  }, 'ai finalFile PNG written', 60000);

  // ② psd 无引擎：NATIVE_PREVIEW_UNSUPPORTED → native-preview-failed 回程
  const psdSource = path.join(sourcesRoot, 'fixture.psd');
  buildMinimalPdf(psdSource);
  const psdFinal = path.join(previewDir, 'ITEM-PSD.png');
  await page.send('Runtime.evaluate', {
    expression: `window.ipcRenderer.send('generate-hight-resolution-thumbnail', ${JSON.stringify({
      filePath: psdSource,
      tempFile: path.join(previewDir, 'fixture.psd.png.tmp'),
      finalFile: psdFinal,
      size: 800,
      ext: 'psd',
    })}); true`,
    returnByValue: true,
  });
  await waitFor(async () => {
    const r = await page.send('Runtime.evaluate', { expression: 'JSON.stringify(window.__b1_9at.failedEvents)', returnByValue: true });
    const events = JSON.parse(r.result.value || '[]');
    return events.some((e) => e && e.ext === 'psd') ? events : null;
  }, 'native-preview-failed (psd) event', 30000);
  await new Promise((resolve) => setTimeout(resolve, 800));
  if (fs.existsSync(psdFinal)) throw new Error('psd path should not produce finalFile');

  // 静态接线审计：main 双 handler + shim 直通/桥/window.ipcRenderer + backend 端点
  const mainSource = fs.readFileSync(path.join(projectRoot, 'electron', 'main.cjs'), 'utf8');
  if (!mainSource.includes("ipcMain.on('generate-hight-resolution-thumbnail'")) throw new Error('generate-hight-resolution-thumbnail handler not registered');
  if (!mainSource.includes("ipcMain.handle('nativeImage.createThumbnailFromPath'")) throw new Error('nativeImage.createThumbnailFromPath handler not registered');
  const shimSource = fs.readFileSync(path.join(projectRoot, 'frontend', 'public', 'shims.js'), 'utf8');
  if (!shimSource.includes("channel === 'generate-hight-resolution-thumbnail'")) throw new Error('generate-hight-resolution-thumbnail send passthrough missing');
  if (!shimSource.includes("'native-preview-failed',")) throw new Error('native-preview-failed onIpc bridge missing');
  const backendSource = fs.readFileSync(path.join(projectRoot, 'backend', 'src', 'server.js'), 'utf8');
  if (!backendSource.includes("app.post('/api/item/nativePreview'")) throw new Error('nativePreview endpoint missing');

  console.log(`NATIVE_PREVIEW_CLOSED_LOOP_OK ${JSON.stringify({ aiFinal: path.basename(aiFinal), failedExt: 'psd' })}`);
} catch (err) {
  failure = err;
  console.error(`NATIVE_PREVIEW_CLOSED_LOOP_FAIL ${err.message}`);
} finally {
  if (stack) {
    await stop(stack.electron);
    await stop(stack.vite);
    await stop(stack.backend);
  }
  try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
}
process.exit(failure ? 1 : 0);
