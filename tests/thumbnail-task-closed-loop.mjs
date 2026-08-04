import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { PNG } from 'pngjs';
import { loadLibrary } from '../backend/src/library-store.js';
import { ThumbnailTaskService } from '../backend/src/thumbnail-task-service.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-thumbnail-task-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const sourcesRoot = path.join(tempRoot, 'sources');
const stateFile = path.join(tempRoot, 'library-state.json');
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

function hash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function startServer(extraEnv = {}) {
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
      ...extraEnv,
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
  if (server.child.exitCode !== null) return;
  server.child.kill();
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 3_000);
    server.child.once('exit', () => { clearTimeout(timeout); resolve(); });
  });
}

async function request(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, options);
  const body = await response.json();
  return { response, body };
}

function post(base, route, body) {
  return request(base, route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function waitForTask(base, taskId, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await request(base, `/api/item/thumbnailTask/status?taskId=${encodeURIComponent(taskId)}`);
    if (['complete', 'failed', 'cancelled'].includes(status.body.data.status)) return status.body.data;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`thumbnail task did not finish: ${taskId}`);
}

const basePng = path.join(sourcesRoot, 'base.png');
const webp = path.join(sourcesRoot, 'sample.webp');
const gif = path.join(sourcesRoot, 'sample.gif');
const tiff = path.join(sourcesRoot, 'sample.tiff');
const svg = path.join(sourcesRoot, 'sample.svg');
const pdf = path.join(sourcesRoot, 'sample.pdf');
const corruptSvg = path.join(sourcesRoot, 'corrupt.svg');
createPng(basePng, [30, 120, 220], 140, 90);
await sharp(basePng).webp().toFile(webp);
await sharp(basePng).gif().toFile(gif);
await sharp(basePng).tiff().toFile(tiff);
fs.writeFileSync(svg, '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect width="240" height="120" fill="#e53028"/><circle cx="180" cy="60" r="38" fill="#1a63d8"/></svg>');
fs.writeFileSync(corruptSvg, '<svg><script>alert(1)</script>');
fs.copyFileSync(path.join(projectRoot, 'frontend/public/mock-assets/sample.pdf'), pdf);

let server = await startServer();
const created = await post(server.base, '/api/library/create', { name: '统一缩略图任务', savePath: librariesRoot });
if (created.response.status !== 201) throw new Error(`library create failed: ${JSON.stringify(created.body)}`);
const libraryPath = created.body.data.path;
const imported = await post(server.base, '/api/item/addFromPaths', { paths: [svg, gif, webp, tiff, pdf, corruptSvg] });
if (imported.response.status !== 201 || imported.body.data.length !== 6) throw new Error(`fixture import failed: ${JSON.stringify(imported.body)}`);
const items = {};
for (const item of imported.body.data) items[item.ext] ||= item;
const corruptItem = imported.body.data.at(-1);
for (const ext of ['svg', 'gif', 'webp', 'tiff', 'pdf']) {
  const taskId = items[ext].thumbnailTask;
  if (!taskId) throw new Error(`${ext} import did not enqueue a thumbnail task`);
  const automatic = await waitForTask(server.base, taskId, ext === 'pdf' ? 30_000 : 15_000);
  if (automatic.status !== 'complete') throw new Error(`${ext} automatic thumbnail failed: ${JSON.stringify(automatic)}`);
}

const missingId = await post(server.base, '/api/item/thumbnailTask/start', {});
if (missingId.response.status !== 400 || missingId.body.code !== 'ITEM_ID_REQUIRED') throw new Error('missing thumbnail item id error mismatch');
const missingItem = await post(server.base, '/api/v2/item/thumbnailTask/start', { itemId: 'NOT-FOUND' });
if (missingItem.response.status !== 404 || missingItem.body.code !== 'ITEM_NOT_FOUND') throw new Error('missing thumbnail item error mismatch');

for (const ext of ['svg', 'gif', 'webp', 'tiff', 'pdf']) {
  const item = items[ext];
  const oldThumbnail = path.join(libraryPath, 'images', `${item.id}.info`, `${item.name}_thumbnail.png`);
  fs.rmSync(oldThumbnail, { force: true });
  const started = await post(server.base, ext === 'webp' ? '/api/v2/item/thumbnailTask/start' : '/api/item/thumbnailTask/start', { itemId: item.id });
  if (started.response.status !== 202 || !['queued', 'running'].includes(started.body.data.status)) throw new Error(`${ext} task did not queue: ${JSON.stringify(started.body)}`);
  const finished = await waitForTask(server.base, started.body.data.id, ext === 'pdf' ? 30_000 : 15_000);
  if (finished.status !== 'complete') throw new Error(`${ext} thumbnail failed: ${JSON.stringify(finished)}`);
  const thumbnail = path.join(libraryPath, 'images', `${item.id}.info`, `${item.name}_thumbnail.png`);
  const decoded = PNG.sync.read(fs.readFileSync(thumbnail));
  if (decoded.width <= 0 || decoded.height <= 0 || decoded.width > 480 || decoded.height > 480) throw new Error(`${ext} thumbnail dimensions invalid`);
  const metadata = JSON.parse(fs.readFileSync(path.join(libraryPath, 'images', `${item.id}.info`, 'metadata.json'), 'utf8'));
  if (metadata.noThumbnail || metadata.processingThumbnail || metadata.thumbnailTask || !Array.isArray(metadata.palettes)) {
    throw new Error(`${ext} thumbnail metadata is inconsistent`);
  }
  if (!metadata.width || !metadata.height) throw new Error(`${ext} original dimensions were not persisted`);
}

const corruptStarted = await post(server.base, '/api/item/thumbnailTask/start', { itemId: items.svg.id });
const conflict = await post(server.base, '/api/item/thumbnailTask/start', { itemId: items.svg.id });
if (conflict.response.status !== 409 || conflict.body.code !== 'THUMBNAIL_TASK_CONFLICT') throw new Error(`same-item conflict mismatch: ${JSON.stringify(conflict.body)}`);
await waitForTask(server.base, corruptStarted.body.data.id);

const automaticBad = await waitForTask(server.base, corruptItem.thumbnailTask);
if (automaticBad.status !== 'failed' || automaticBad.code !== 'THUMBNAIL_DECODE_FAILED') throw new Error('corrupt SVG automatic task did not fail safely');
const badStarted = await post(server.base, '/api/item/thumbnailTask/start', { itemId: corruptItem.id });
const badResult = await waitForTask(server.base, badStarted.body.data.id);
if (badResult.status !== 'failed' || badResult.code !== 'THUMBNAIL_DECODE_FAILED') throw new Error(`corrupt SVG error mismatch: ${JSON.stringify(badResult)}`);
const badMeta = JSON.parse(fs.readFileSync(path.join(libraryPath, 'images', `${corruptItem.id}.info`, 'metadata.json'), 'utf8'));
if (badMeta.processingThumbnail || badMeta.thumbnailTask || badMeta.thumbnailError !== 'THUMBNAIL_DECODE_FAILED') throw new Error('failed task state was not persisted cleanly');

await stopServer(server);
server = await startServer();
const restored = await request(server.base, '/api/library/current?includeItems=true');
for (const ext of ['svg', 'gif', 'webp', 'tiff', 'pdf']) {
  const item = restored.body.data.items.find((entry) => entry.id === items[ext].id);
  if (!item || item.noThumbnail || item.processingThumbnail || !Array.isArray(item.palettes)) throw new Error(`${ext} thumbnail state did not survive restart`);
}
await stopServer(server);

const directLibrary = loadLibrary(libraryPath);
const directItems = directLibrary.items.filter((item) => ['svg', 'gif', 'webp', 'tiff'].includes(item.ext));
let active = 0;
let maxActive = 0;
const directService = new ThumbnailTaskService({
  concurrency: 3,
  timeoutMs: 2_000,
  analyze: async () => [{ color: [1, 2, 3], ratio: 100 }],
  render: async ({ output }) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 80));
    createPng(output, [80, 100, 160], 20, 20);
    active -= 1;
    return { width: 20, height: 20 };
  },
});
const directTasks = directItems.map((item) => directService.enqueue(directLibrary, item.id));
await Promise.all(directTasks.map((task) => directService.wait(task.id)));
if (maxActive !== 3) throw new Error(`thumbnail concurrency mismatch: ${maxActive}`);

const cancelLibrary = loadLibrary(libraryPath);
const cancelService = new ThumbnailTaskService({
  concurrency: 1,
  timeoutMs: 2_000,
  analyze: async () => [{ color: [1, 2, 3], ratio: 100 }],
  render: async ({ output }) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    createPng(output, [50, 50, 50], 20, 20);
    return { width: 20, height: 20 };
  },
});
const first = cancelService.enqueue(cancelLibrary, directItems[0].id);
const second = cancelService.enqueue(cancelLibrary, directItems[1].id);
const existingSecondPath = path.join(libraryPath, 'images', `${directItems[1].id}.info`, `${directItems[1].name}_thumbnail.png`);
const existingSecondHash = hash(existingSecondPath);
cancelService.cancel(second.id);
let cancelError;
try { await cancelService.wait(second.id); } catch (err) { cancelError = err; }
if (cancelError?.code !== 'THUMBNAIL_CANCELLED' || hash(existingSecondPath) !== existingSecondHash) throw new Error('queued thumbnail cancellation changed the existing thumbnail');
await cancelService.wait(first.id);

const timeoutLibrary = loadLibrary(libraryPath);
const timeoutService = new ThumbnailTaskService({
  concurrency: 1,
  timeoutMs: 25,
  analyze: async () => [{ color: [1, 2, 3], ratio: 100 }],
  render: () => new Promise(() => {}),
});
const timeoutTask = timeoutService.enqueue(timeoutLibrary, directItems[2].id);
let timeoutError;
try { await timeoutService.wait(timeoutTask.id); } catch (err) { timeoutError = err; }
if (timeoutError?.code !== 'THUMBNAIL_TIMEOUT') throw new Error(`thumbnail timeout mismatch: ${timeoutError?.code}`);
const timeoutMeta = JSON.parse(fs.readFileSync(path.join(libraryPath, 'images', `${directItems[2].id}.info`, 'metadata.json'), 'utf8'));
if (timeoutMeta.processingThumbnail || timeoutMeta.thumbnailTask || timeoutMeta.thumbnailError !== 'THUMBNAIL_TIMEOUT') throw new Error('timeout state cleanup mismatch');

const interruptedLibrary = loadLibrary(libraryPath);
const interruptedItem = interruptedLibrary.items.find((item) => item.id === directItems[3].id);
interruptedItem.processingThumbnail = true;
interruptedItem.thumbnailTask = 'STALE-TASK';
const metadataPath = path.join(libraryPath, 'images', `${interruptedItem.id}.info`, 'metadata.json');
fs.writeFileSync(metadataPath, JSON.stringify(interruptedItem, null, 2));
const cachePath = path.join(libraryPath, 'cache.json');
fs.writeFileSync(cachePath, interruptedLibrary.items.map((item) => JSON.stringify(item)).join('\n') + '\n');
const recoveredLibrary = loadLibrary(libraryPath);
const recoveryService = new ThumbnailTaskService();
if (!recoveryService.recover(recoveredLibrary)) throw new Error('stale thumbnail task was not recovered');
const recovered = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
if (recovered.processingThumbnail || recovered.thumbnailTask || recovered.thumbnailError !== 'THUMBNAIL_TASK_INTERRUPTED') throw new Error('stale task recovery metadata mismatch');

console.log(`THUMBNAIL_TASK_CLOSED_LOOP_OK ${libraryPath}`);
