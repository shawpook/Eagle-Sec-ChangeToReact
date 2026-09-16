/**
 * M8-5：`GET /api/item/thumbnail` 行为门禁。
 *
 * 背景：提交 8cf92c55 把 server.js 的 thumbnailer 导入收窄成只留 thumbnailPath，
 * 漏改了 :2056 的 ensureThumbnail 调用点 —— 悬空标识符抛 ReferenceError，
 * 被该行自己的 catch 吞成空串，导致该路由对所有条目恒 404。
 *
 * 本门禁断言的是**真实 HTTP 行为**，不是源码文本：
 *   1. 确有缩略图的条目 → 200 + 非空 PNG 字节（magic bytes + 尺寸）；
 *   2. 未知 id → 仍 404（空态契约不变，本次修复不得把它改成 200）。
 *
 * 选 PNG 图像条目作正例的理由：`ensureThumbnail` → `generateThumbnail` 对 png/jpg
 * 是**同步**可渲染的，因此断言不依赖后台 ThumbnailTaskService 的完成时序；
 * 且 PNG 有明确的 magic bytes 可判。
 * 为进一步排掉"只是把既有文件端出来"的可能，正例在请求前**删掉**磁盘上的缩略图，
 * 迫使该路由自行按需重建 —— 200 因此证明 :2056 那次调用真的跑通了。
 *
 * 隔离做法（隔离库 + 临时端口）复用 tests/text-thumbnail-closed-loop.mjs 的既有骨架。
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-item-thumbnail-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const sourcesRoot = path.join(tempRoot, 'sources');
const stateFile = path.join(tempRoot, 'library-state.json');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourcesRoot, { recursive: true });

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const THUMBNAIL_MAX_SIZE = 320;

function createPng(filePath, color, width, height) {
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

async function freePort() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const port = await new Promise((resolve, reject) => {
      const server = http.createServer();
      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        server.close(() => resolve(address && typeof address === 'object' ? address.port : null));
      });
    });
    if (Number.isInteger(port) && port > 0 && port < 65536) return port;
  }
  throw new Error('could not allocate a free TCP port');
}

async function startServer() {
  const [apiPort, thumbnailPort, extensionPort] = await Promise.all([freePort(), freePort(), freePort()]);
  const child = spawn(process.execPath, ['backend/src/server.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      EAGLE_API_PORT: String(apiPort),
      EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
      EAGLE_EXTENSION_PORT: String(extensionPort),
      EAGLE_LIBRARY_STATE_FILE: stateFile,
      EAGLE_THUMBNAIL_CONCURRENCY: '3',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const deadline = Date.now() + 15_000;
  while (!output.includes(`localhost:${apiPort}`)) {
    if (child.exitCode !== null) throw new Error(`server exited: ${output}`);
    if (Date.now() > deadline) throw new Error(`server startup timeout: ${output}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return { child, base: `http://127.0.0.1:${apiPort}`, output: () => output };
}

async function stopServer(server) {
  if (!server || server.child.exitCode !== null) return;
  server.child.kill();
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 3_000);
    server.child.once('exit', () => { clearTimeout(timeout); resolve(); });
  });
}

async function requestJson(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, options);
  const body = await response.json();
  return { response, body };
}

function post(base, route, body) {
  return requestJson(base, route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function waitForTask(base, taskId, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await requestJson(base, `/api/item/thumbnailTask/status?taskId=${encodeURIComponent(taskId)}`);
    if (['complete', 'failed', 'cancelled'].includes(status.body.data.status)) return status.body.data;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`thumbnail task did not finish: ${taskId}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function fail(message) {
  console.error(`ITEM_THUMBNAIL_ENDPOINT_FAIL ${message}`);
  process.exit(1);
}

// 源图 640x400 > 320，故按需重建时必然走 resizeRgbaSync：640 长边 → 320，等比 → 320x200。
const sourceImage = path.join(sourcesRoot, 'cover.png');
createPng(sourceImage, [40, 110, 210], 640, 400);

let server;
try {
  server = await startServer();

  const created = await post(server.base, '/api/library/create', { name: '端点封面', savePath: librariesRoot });
  assert(created.response.status === 201, `library create failed: ${JSON.stringify(created.body)}`);

  const imported = await post(server.base, '/api/item/addFromPaths', { paths: [sourceImage] });
  assert(imported.response.status === 201 && imported.body.data.length === 1, `fixture import failed: ${JSON.stringify(imported.body)}`);
  const item = imported.body.data[0];

  // 等后台缩略图任务尘埃落定，避免与"删除 + 按需重建"抢文件。
  if (item.thumbnailTask) {
    const settled = await waitForTask(server.base, item.thumbnailTask);
    assert(settled.status === 'complete', `fixture thumbnail task did not complete: ${JSON.stringify(settled)}`);
  }

  const libraryPath = created.body.data.path;
  const thumbnailFile = path.join(libraryPath, 'images', `${item.id}.info`, `${item.name}_thumbnail.png`);
  assert(fs.existsSync(thumbnailFile), `fixture thumbnail was never generated on disk: ${thumbnailFile}`);

  // 拆掉磁盘上的副本，迫使路由自行按需重建 —— 这样 200 才证明 :2056 真的调通了。
  fs.rmSync(thumbnailFile, { force: true });
  assert(!fs.existsSync(thumbnailFile), 'failed to remove the fixture thumbnail before the request');

  // ---- 正例：确有缩略图的条目 → 200 + 真实 PNG 字节 ----
  const route = `/api/item/thumbnail?id=${encodeURIComponent(item.id)}`;
  const raw = await fetch(`${server.base}${route}`);
  const bytes = Buffer.from(await raw.arrayBuffer());

  assert(raw.status === 200, `expected 200 for an item with a thumbnail, got ${raw.status}: ${bytes.toString('utf8')}`);
  assert(bytes.length > 0, 'thumbnail response was empty');
  assert(bytes.subarray(0, 8).equals(PNG_MAGIC), `thumbnail bytes are not a PNG: ${bytes.subarray(0, 8).toString('hex')}`);

  const contentType = String(raw.headers.get('content-type') || '');
  assert(contentType.includes('image/png'), `unexpected content-type: ${contentType}`);

  const decoded = PNG.sync.read(bytes);
  assert(decoded.width === THUMBNAIL_MAX_SIZE && decoded.height === 200, `unexpected thumbnail dimensions: ${decoded.width}x${decoded.height}`);

  // 按需重建是"写回磁盘"的语义，不是只回一次流。
  assert(fs.existsSync(thumbnailFile), 'the on-demand thumbnail was not written back to disk');
  const onDisk = fs.readFileSync(thumbnailFile);
  assert(onDisk.equals(bytes), 'the served bytes differ from the regenerated thumbnail on disk');

  // ---- 反例：未知 id → 仍 404，空态契约不变 ----
  const missing = await requestJson(server.base, '/api/item/thumbnail?id=no-such-item-id');
  assert(missing.response.status === 404, `expected 404 for an unknown item id, got ${missing.response.status}`);
  assert(missing.body.status === 'error' && missing.body.message === 'Thumbnail not found',
    `unexpected 404 body: ${JSON.stringify(missing.body)}`);

  // ---- 反例：id 缺失 → 仍 404 ----
  const noId = await requestJson(server.base, '/api/item/thumbnail');
  assert(noId.response.status === 404, `expected 404 without an id, got ${noId.response.status}`);
} catch (err) {
  await stopServer(server);
  fail(err && err.message ? err.message : String(err));
}

await stopServer(server);
try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
console.log('ITEM_THUMBNAIL_ENDPOINT_OK');
