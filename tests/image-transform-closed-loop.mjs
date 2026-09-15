/**
 * F06 闭环：后端图像变换端点（POST /api/item/imageTransform）。
 *
 * 覆盖：
 *   a. 非对称图片（8x4）旋转 90/180/270 后**读回像素**验证尺寸与方向（独立解码器 pngjs + sharp raw）
 *   b. 翻转 horizontal / vertical / both 后读回像素验证方向
 *   c. metadata.json 的 width/height 正确（90/270 互换，180/翻转不变）
 *   d. 失败分支错误码：INVALID_ARGUMENT / NOT_FOUND / UNSUPPORTED_FORMAT
 *   e. 失败时不写盘：注入型失败（regen 抛错）与库锁占用型失败，源文件字节与 metadata 均不变
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { PNG } from 'pngjs';
import { ImageTransformService } from '../backend/src/image-transform-service.js';
import { loadLibrary } from '../backend/src/library-store.js';
import { ThumbnailTaskService } from '../backend/src/thumbnail-task-service.js';
import { transactionDirectory } from '../backend/src/library-strict.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-image-transform-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const sourcesRoot = path.join(tempRoot, 'sources');
const stateFile = path.join(tempRoot, 'library-state.json');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourcesRoot, { recursive: true });
process.once('exit', () => {
  try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁 */ }
});

// ---------------------------------------------------------------- 像素夹具

const SRC_WIDTH = 8;
const SRC_HEIGHT = 4;
const TEMP_MARK = 'imageops-';

/** 每个像素的 (R,G) 唯一编码 (x,y)，使任何方向变化都可被逐像素还原。 */
function pixelAt(x, y) {
  return [20 + x * 25, 30 + y * 50, 90, 255];
}

function buildRawSource() {
  const raw = Buffer.alloc(SRC_WIDTH * SRC_HEIGHT * 4);
  for (let y = 0; y < SRC_HEIGHT; y += 1) {
    for (let x = 0; x < SRC_WIDTH; x += 1) {
      const offset = (y * SRC_WIDTH + x) * 4;
      const [r, g, b, a] = pixelAt(x, y);
      raw[offset] = r; raw[offset + 1] = g; raw[offset + 2] = b; raw[offset + 3] = a;
    }
  }
  return raw;
}

function readPixelsWithPngjs(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  return {
    width: png.width,
    height: png.height,
    px(x, y) {
      const offset = (y * png.width + x) * 4;
      return [png.data[offset], png.data[offset + 1], png.data[offset + 2], png.data[offset + 3]];
    },
  };
}

async function readPixelsWithSharp(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    px(x, y) {
      const offset = (y * info.width + x) * info.channels;
      return [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]];
    },
  };
}

// 期望的方向映射：dst(x,y) = src(mapX(x,y), mapY(x,y))，以及 dst 尺寸。
const OPS = [
  { label: 'rotate90', body: { op: 'rotate', degree: 90 }, outWidth: SRC_HEIGHT, outHeight: SRC_WIDTH, map: (x, y) => [y, SRC_HEIGHT - 1 - x] },
  { label: 'rotate180', body: { op: 'rotate', degree: 180 }, outWidth: SRC_WIDTH, outHeight: SRC_HEIGHT, map: (x, y) => [SRC_WIDTH - 1 - x, SRC_HEIGHT - 1 - y] },
  { label: 'rotate270', body: { op: 'rotate', degree: 270 }, outWidth: SRC_HEIGHT, outHeight: SRC_WIDTH, map: (x, y) => [SRC_WIDTH - 1 - y, x] },
  { label: 'flipHorizontal', body: { op: 'flip', flipType: 'horizontal' }, outWidth: SRC_WIDTH, outHeight: SRC_HEIGHT, map: (x, y) => [SRC_WIDTH - 1 - x, y] },
  { label: 'flipVertical', body: { op: 'flip', flipType: 'vertical' }, outWidth: SRC_WIDTH, outHeight: SRC_HEIGHT, map: (x, y) => [x, SRC_HEIGHT - 1 - y] },
  { label: 'flipBoth', body: { op: 'flip', flipType: 'both' }, outWidth: SRC_WIDTH, outHeight: SRC_HEIGHT, map: (x, y) => [SRC_WIDTH - 1 - x, SRC_HEIGHT - 1 - y] },
];

function assertDirection(actual, spec, label) {
  assert.equal(actual.width, spec.outWidth, `${label}: read-back width mismatch`);
  assert.equal(actual.height, spec.outHeight, `${label}: read-back height mismatch`);
  for (let y = 0; y < spec.outHeight; y += 1) {
    for (let x = 0; x < spec.outWidth; x += 1) {
      const [sx, sy] = spec.map(x, y);
      assert.deepEqual(
        actual.px(x, y),
        pixelAt(sx, sy),
        `${label}: pixel (${x},${y}) should come from source (${sx},${sy})`
      );
    }
  }
}

// ---------------------------------------------------------------- 测试基建

function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function infoDirOf(libraryPath, item) {
  return path.join(libraryPath, 'images', `${item.id}.info`);
}

function originalFileOf(libraryPath, item) {
  return path.join(infoDirOf(libraryPath, item), `${item.name}.${item.ext}`);
}

function metadataFileOf(libraryPath, item) {
  return path.join(infoDirOf(libraryPath, item), 'metadata.json');
}

function thumbnailFileOf(libraryPath, item) {
  return path.join(infoDirOf(libraryPath, item), `${item.name}_thumbnail.png`);
}

function tempLeftovers(item) {
  return fs.readdirSync(infoDirOf(libraryPath, item)).filter((entry) => entry.includes(TEMP_MARK));
}

function assertNoTempLeftovers(item, label) {
  assert.deepEqual(tempLeftovers(item), [], `${label}: transform left temp files behind`);
}

function snapshotState(item) {
  return {
    sourceHash: hash(originalFileOf(libraryPath, item)),
    thumbnailHash: hash(thumbnailFileOf(libraryPath, item)),
    metadata: readJson(metadataFileOf(libraryPath, item)),
  };
}

function assertStateUnchanged(item, before, label) {
  assert.equal(hash(originalFileOf(libraryPath, item)), before.sourceHash, `${label}: source bytes changed`);
  assert.equal(hash(thumbnailFileOf(libraryPath, item)), before.thumbnailHash, `${label}: thumbnail changed`);
  const after = readJson(metadataFileOf(libraryPath, item));
  assert.deepEqual(after, before.metadata, `${label}: metadata.json content changed`);
  assertNoTempLeftovers(item, label);
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
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const deadline = Date.now() + 20_000;
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

async function request(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, options);
  return { response, body: await response.json() };
}

function post(base, route, body) {
  return request(base, route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function expectTransformError(base, payload, expectedStatus, expectedCode, label) {
  const { response, body } = await post(base, '/api/item/imageTransform', payload);
  assert.equal(response.status, expectedStatus, `${label}: unexpected HTTP status (${JSON.stringify(body)})`);
  assert.equal(body.status, 'error', `${label}: expected error envelope`);
  assert.equal(body.code, expectedCode, `${label}: unexpected error code (${JSON.stringify(body)})`);
  return body;
}

// ---------------------------------------------------------------- 夹具落盘

const rawSource = buildRawSource();
const pngSource = path.join(sourcesRoot, 'asymmetric.png');
await sharp(rawSource, { raw: { width: SRC_WIDTH, height: SRC_HEIGHT, channels: 4 } }).png().toFile(pngSource);

const webpSource = path.join(sourcesRoot, 'asymmetric.webp');
await sharp(pngSource).webp({ lossless: true }).toFile(webpSource);
const jpegSource = path.join(sourcesRoot, 'asymmetric.jpg');
await sharp(pngSource).jpeg({ quality: 95 }).toFile(jpegSource);
const avifSource = path.join(sourcesRoot, 'asymmetric.avif');
await sharp(pngSource).avif().toFile(avifSource);
const gifSource = path.join(sourcesRoot, 'asymmetric.gif');
await sharp(pngSource).gif().toFile(gifSource);
// 专供 PERMISSION_DENIED 用例：单独一份，免得把主用条目 chmod 成只读。
const readonlySource = path.join(sourcesRoot, 'readonly.png');
fs.copyFileSync(pngSource, readonlySource);

// ---------------------------------------------------------------- 起服务 + 导入

let server = await startServer();
const created = await post(server.base, '/api/library/create', { name: '图像变换闭环', savePath: librariesRoot });
assert.equal(created.response.status, 201, `library create failed: ${JSON.stringify(created.body)}`);
const libraryPath = created.body.data.path;

const imported = await post(server.base, '/api/item/addFromPaths', {
  paths: [pngSource, webpSource, jpegSource, avifSource, gifSource, readonlySource],
});
assert.equal(imported.response.status, 201, `fixture import failed: ${JSON.stringify(imported.body)}`);
const byExt = new Map();
for (const item of imported.body.data) if (!byExt.has(item.ext)) byExt.set(item.ext, item);
const pngItem = byExt.get('png');
const webpItem = byExt.get('webp');
const jpegItem = byExt.get('jpg') || byExt.get('jpeg');
const avifItem = byExt.get('avif');
const gifItem = byExt.get('gif');
// byExt 按扩展名去重，只读夹具与主 PNG 同扩展名，故按名字单独取。
const readonlyItem = imported.body.data.find((entry) => entry.name === 'readonly');
assert.ok(readonlyItem, 'fixture import did not yield the readonly item');
assert.notEqual(readonlyItem.id, pngItem.id, 'readonly fixture must be its own item');
for (const [name, item] of [['png', pngItem], ['webp', webpItem], ['jpg', jpegItem], ['avif', avifItem], ['gif', gifItem]]) {
  assert.ok(item, `fixture import did not yield a ${name} item`);
}

// 非 PNG 的条目由导入器排入异步缩略图任务，变换前必须等它落定，否则会撞 409 冲突。
async function waitForImportTasks() {
  const current = await request(server.base, '/api/library/current?includeItems=true');
  const pending = current.body.data.items.filter((item) => item.thumbnailTask);
  for (const item of pending) {
    const deadline = Date.now() + 20_000;
    let done = false;
    while (Date.now() < deadline) {
      const status = await request(server.base, `/api/item/thumbnailTask/status?taskId=${encodeURIComponent(item.thumbnailTask)}`);
      if (['complete', 'failed', 'cancelled'].includes(status.body.data.status)) { done = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.ok(done, `import thumbnail task did not settle for ${item.id}`);
  }
}
await waitForImportTasks();

// ---------------------------------------------------- a/b/c 成功路径：逐像素验证

// 每个 op 用一张独立的 PNG 副本，避免互相污染。
const pngCaseItems = [];
for (const spec of OPS) {
  const source = path.join(sourcesRoot, `case-${spec.label}.png`);
  fs.copyFileSync(pngSource, source);
  const added = await post(server.base, '/api/item/addFromPath', { paths: [source] });
  assert.equal(added.response.status, 201, `case import failed: ${JSON.stringify(added.body)}`);
  pngCaseItems.push({ spec, item: added.body.data });
}

for (const { spec, item } of pngCaseItems) {
  const before = readPixelsWithPngjs(originalFileOf(libraryPath, item));
  assert.equal(before.width, SRC_WIDTH, `${spec.label}: fixture width`);
  assert.equal(before.height, SRC_HEIGHT, `${spec.label}: fixture height`);
  const sourceHashBefore = hash(originalFileOf(libraryPath, item));

  const { response, body } = await post(server.base, '/api/item/imageTransform', { id: item.id, ...spec.body });
  assert.equal(response.status, 200, `${spec.label}: transform failed (${JSON.stringify(body)})`);
  assert.equal(body.status, 'success', `${spec.label}: expected success envelope`);
  assert.equal(body.data.width, spec.outWidth, `${spec.label}: reported width`);
  assert.equal(body.data.height, spec.outHeight, `${spec.label}: reported height`);
  assert.equal(body.data.op, spec.body.op, `${spec.label}: reported op`);

  // a/b：读回真实像素（独立解码器 pngjs），验证尺寸与方向。
  const after = readPixelsWithPngjs(originalFileOf(libraryPath, item));
  assertDirection(after, spec, spec.label);

  // 「返回值必须与磁盘一致」——成功响应不得与未写盘共存。
  assert.notEqual(hash(originalFileOf(libraryPath, item)), sourceHashBefore, `${spec.label}: source file was not rewritten`);

  // c：metadata.json 的 width/height 必须更新。
  const metadata = readJson(metadataFileOf(libraryPath, item));
  assert.equal(metadata.width, spec.outWidth, `${spec.label}: metadata width`);
  assert.equal(metadata.height, spec.outHeight, `${spec.label}: metadata height`);
  assert.equal(metadata.id, item.id, `${spec.label}: metadata identity drifted`);
  assert.equal(metadata.name, item.name, `${spec.label}: metadata name drifted`);

  // 缩略图必须是新图（旧缩略图是 8x4 的原始方向）。
  const thumbnail = readPixelsWithPngjs(thumbnailFileOf(libraryPath, item));
  assert.equal(thumbnail.width, spec.outWidth, `${spec.label}: thumbnail width`);
  assert.equal(thumbnail.height, spec.outHeight, `${spec.label}: thumbnail height`);
  assert.equal(
    thumbnail.px(0, 0).join(),
    pixelAt(...spec.map(0, 0)).join(),
    `${spec.label}: thumbnail orientation`
  );

  assertNoTempLeftovers(item, spec.label);
}

// 无损性佐证：连转 4 次 90° 回到原像素。
{
  const source = path.join(sourcesRoot, 'case-four-rotations.png');
  fs.copyFileSync(pngSource, source);
  const added = await post(server.base, '/api/item/addFromPath', { paths: [source] });
  const item = added.body.data;
  for (let i = 0; i < 4; i += 1) {
    const { response, body } = await post(server.base, '/api/item/imageTransform', { id: item.id, op: 'rotate', degree: 90 });
    assert.equal(response.status, 200, `four-rotations step ${i}: ${JSON.stringify(body)}`);
  }
  const back = readPixelsWithPngjs(originalFileOf(libraryPath, item));
  assert.equal(back.width, SRC_WIDTH, 'four-rotations: width');
  assert.equal(back.height, SRC_HEIGHT, 'four-rotations: height');
  for (let y = 0; y < SRC_HEIGHT; y += 1) {
    for (let x = 0; x < SRC_WIDTH; x += 1) {
      assert.deepEqual(back.px(x, y), pixelAt(x, y), `four-rotations: pixel (${x},${y})`);
    }
  }
}

// WebP：第二支持格式，走 v2 镜像路由，同样读回像素。
{
  const { response, body } = await post(server.base, '/api/v2/item/imageTransform', { itemId: webpItem.id, op: 'rotate', degree: 90 });
  assert.equal(response.status, 200, `webp rotate failed (${JSON.stringify(body)})`);
  assert.equal(body.data.width, SRC_HEIGHT, 'webp: reported width');
  assert.equal(body.data.height, SRC_WIDTH, 'webp: reported height');
  const after = await readPixelsWithSharp(originalFileOf(libraryPath, webpItem));
  assertDirection(after, OPS[0], 'webp rotate90');
  const metadata = readJson(metadataFileOf(libraryPath, webpItem));
  assert.equal(metadata.width, SRC_HEIGHT, 'webp: metadata width');
  assert.equal(metadata.height, SRC_WIDTH, 'webp: metadata height');
}

// ---------------------------------------------------------------- d 失败分支

await expectTransformError(server.base, { op: 'rotate', degree: 90 }, 400, 'INVALID_ARGUMENT', 'missing id');
await expectTransformError(server.base, { id: '', op: 'rotate', degree: 90 }, 400, 'INVALID_ARGUMENT', 'empty id');
await expectTransformError(server.base, { id: pngItem.id }, 400, 'INVALID_ARGUMENT', 'missing op');
await expectTransformError(server.base, { id: pngItem.id, op: 'spin', degree: 90 }, 400, 'INVALID_ARGUMENT', 'unknown op');
await expectTransformError(server.base, { id: pngItem.id, op: 'rotate' }, 400, 'INVALID_ARGUMENT', 'rotate without degree');
await expectTransformError(server.base, { id: pngItem.id, op: 'rotate', degree: 45 }, 400, 'INVALID_ARGUMENT', 'unsupported degree 45');
await expectTransformError(server.base, { id: pngItem.id, op: 'rotate', degree: 0 }, 400, 'INVALID_ARGUMENT', 'degree 0');
await expectTransformError(server.base, { id: pngItem.id, op: 'rotate', degree: 'ninety' }, 400, 'INVALID_ARGUMENT', 'non-numeric degree');
await expectTransformError(server.base, { id: pngItem.id, op: 'flip' }, 400, 'INVALID_ARGUMENT', 'flip without type');
await expectTransformError(server.base, { id: pngItem.id, op: 'flip', flipType: 'diagonal' }, 400, 'INVALID_ARGUMENT', 'unknown flip type');
await expectTransformError(server.base, { id: 'ITEM-DOES-NOT-EXIST', op: 'rotate', degree: 90 }, 404, 'NOT_FOUND', 'unknown item id');
await expectTransformError(server.base, { id: jpegItem.id, op: 'rotate', degree: 90 }, 415, 'UNSUPPORTED_FORMAT', 'jpeg is renderer-owned');
await expectTransformError(server.base, { id: avifItem.id, op: 'flip', flipType: 'vertical' }, 415, 'UNSUPPORTED_FORMAT', 'avif refuses writes');
await expectTransformError(server.base, { id: gifItem.id, op: 'rotate', degree: 180 }, 415, 'UNSUPPORTED_FORMAT', 'gif is not writable here');

// 失败分支同样不得写盘。
{
  const before = snapshotState(pngItem);
  await expectTransformError(server.base, { id: pngItem.id, op: 'rotate', degree: 45 }, 400, 'INVALID_ARGUMENT', 'no-write on invalid argument');
  assertStateUnchanged(pngItem, before, 'invalid argument');
}
{
  const before = snapshotState(jpegItem);
  await expectTransformError(server.base, { id: jpegItem.id, op: 'rotate', degree: 90 }, 415, 'UNSUPPORTED_FORMAT', 'no-write on jpeg');
  assertStateUnchanged(jpegItem, before, 'jpeg rejection');
}
// PERMISSION_DENIED：只读源文件在写权限预检就被挡住，且一个字节都不许改。
{
  const before = snapshotState(readonlyItem);
  const readonlyFile = originalFileOf(libraryPath, readonlyItem);
  fs.chmodSync(readonlyFile, 0o444);
  try {
    await expectTransformError(server.base, { id: readonlyItem.id, op: 'rotate', degree: 90 }, 403, 'PERMISSION_DENIED', 'read-only source');
  } finally {
    fs.chmodSync(readonlyFile, 0o666);
  }
  assertStateUnchanged(readonlyItem, before, 'read-only source');
}

// ------------------------------------------- e 失败时回滚：库锁占用（HTTP 真实请求）

const lockPath = path.join(transactionDirectory(libraryPath), 'lock.json');
{
  const before = snapshotState(pngItem);

  // 由本进程持有一个「新鲜且存活」的写锁，使缩略图事务的 saveItems 必然失败。
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, JSON.stringify({
    version: 1,
    token: 'image-transform-test-holder',
    owner: 'image-transform-closed-loop',
    pid: process.pid,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    heartbeatMs: 60_000,
  }), 'utf8');

  let body = null;
  try {
    const result = await post(server.base, '/api/item/imageTransform', { id: pngItem.id, op: 'rotate', degree: 90 });
    assert.equal(result.response.status, 500, `locked transform: expected 500 (${JSON.stringify(result.body)})`);
    body = result.body;
  } finally {
    fs.rmSync(lockPath, { force: true });
  }
  assert.equal(body.status, 'error', 'locked transform: expected error envelope');
  assert.equal(body.code, 'WRITE_FAILED', `locked transform: unexpected code (${JSON.stringify(body)})`);

  // 源文件在失败前已被换入，回滚必须把它按字节还原。
  assertStateUnchanged(pngItem, before, 'library lock held');

  // 锁释放后同一请求应当能正常完成，证明失败只是被锁挡住、不是能力缺失。
  const retry = await post(server.base, '/api/item/imageTransform', { id: pngItem.id, op: 'rotate', degree: 90 });
  assert.equal(retry.response.status, 200, `post-unlock retry failed (${JSON.stringify(retry.body)})`);
  assert.equal(retry.body.data.width, SRC_HEIGHT, 'post-unlock retry width');
  assert.equal(retry.body.data.height, SRC_WIDTH, 'post-unlock retry height');
}

// ------------------------------------------------- 持久化：重启后宽高仍然是新的

await stopServer(server);
server = await startServer();
{
  const current = await request(server.base, '/api/library/current?includeItems=true');
  const reloaded = current.body.data.items.find((entry) => entry.id === pngItem.id);
  assert.ok(reloaded, 'rotated item disappeared after restart');
  assert.equal(reloaded.width, SRC_HEIGHT, 'restart: item width did not persist');
  assert.equal(reloaded.height, SRC_WIDTH, 'restart: item height did not persist');
  const onDisk = readJson(metadataFileOf(libraryPath, pngItem));
  assert.equal(onDisk.width, SRC_HEIGHT, 'restart: metadata.json width did not persist');
  assert.equal(onDisk.height, SRC_WIDTH, 'restart: metadata.json height did not persist');
  const pixels = readPixelsWithPngjs(originalFileOf(libraryPath, pngItem));
  assert.equal(pixels.width, SRC_HEIGHT, 'restart: pixels width');
  assert.equal(pixels.height, SRC_WIDTH, 'restart: pixels height');
}
await stopServer(server);

// ------------------------------------- e 失败时回滚：注入缩略图失败（直连服务）

{
  const directPng = path.join(sourcesRoot, 'direct-injected-failure.png');
  fs.copyFileSync(pngSource, directPng);
  const infoDir = path.join(libraryPath, 'images', 'ITEM-DIRECT-1.info');
  fs.mkdirSync(infoDir, { recursive: true });
  fs.copyFileSync(directPng, path.join(infoDir, 'Injected.png'));
  const now = Date.now();
  fs.writeFileSync(path.join(infoDir, 'metadata.json'), JSON.stringify({
    id: 'ITEM-DIRECT-1',
    name: 'Injected',
    ext: 'png',
    width: SRC_WIDTH,
    height: SRC_HEIGHT,
    size: fs.statSync(directPng).size,
    tags: [],
    folders: [],
    star: 0,
    isDeleted: false,
    noThumbnail: false,
    comments: [],
    modificationTime: now,
    lastModified: now,
  }, null, 2), 'utf8');
  // cache.json 优先于扫描 info 目录，手工夹具必须同时登记进缓存行，否则 loadLibrary 看不到它。
  const cacheFile = path.join(libraryPath, 'cache.json');
  const cacheLines = fs.existsSync(cacheFile)
    ? fs.readFileSync(cacheFile, 'utf8').split('\n').filter((line) => line.trim() !== '')
    : [];
  cacheLines.push(JSON.stringify(readJson(path.join(infoDir, 'metadata.json'))));
  fs.writeFileSync(cacheFile, `${cacheLines.join('\n')}\n`, 'utf8');
  const directLibrary = loadLibrary(libraryPath);
  const directItem = directLibrary.items.find((entry) => entry.id === 'ITEM-DIRECT-1');
  assert.ok(directItem, 'direct fixture item was not loaded');
  assert.equal(directItem.width, SRC_WIDTH, 'direct fixture width');
  assert.equal(directItem.height, SRC_HEIGHT, 'direct fixture height');

  const sourceFile = originalFileOf(libraryPath, directItem);
  const metadataFile = metadataFileOf(libraryPath, directItem);
  const sourceHashBefore = hash(sourceFile);
  const metadataBefore = readJson(metadataFile);

  const failing = new ImageTransformService({
    regenerate: async () => { throw new Error('injected thumbnail failure'); },
  });
  let error = null;
  try {
    await failing.transform(directLibrary, { id: directItem.id, op: 'rotate', degree: 90 });
  } catch (err) {
    error = err;
  }
  assert.ok(error, 'injected failure did not reject');
  assert.equal(error.code, 'WRITE_FAILED', `injected failure: unexpected code ${error.code}`);
  assert.match(error.message, /injected thumbnail failure/, 'injected failure: cause was not surfaced');

  // 源文件必须按字节回到原样；条目内存状态与磁盘 metadata 也必须回到原样。
  assert.equal(hash(sourceFile), sourceHashBefore, 'injected failure: source bytes changed');
  assert.deepEqual(readJson(metadataFile), metadataBefore, 'injected failure: metadata.json changed');
  assert.equal(directItem.width, SRC_WIDTH, 'injected failure: in-memory width not restored');
  assert.equal(directItem.height, SRC_HEIGHT, 'injected failure: in-memory height not restored');
  assert.equal(directItem.processingThumbnail, undefined, 'injected failure: processingThumbnail leaked');
  assert.equal(directItem.thumbnailTask, undefined, 'injected failure: thumbnailTask leaked');
  assert.equal(directItem.thumbnailError, undefined, 'injected failure: thumbnailError leaked');
  assert.deepEqual(
    fs.readdirSync(infoDir).filter((entry) => entry.includes(TEMP_MARK)),
    [],
    'injected failure: temp files left behind'
  );

  // 同一 service 在注入解除后应当成功 —— 失败来自注入，不来自夹具或服务本身。
  const working = new ImageTransformService({
    regenerate: (libraryRef, itemId) => new ThumbnailTaskService({ concurrency: 1, timeoutMs: 60_000 }).generate(libraryRef, itemId),
  });
  const result = await working.transform(loadLibrary(libraryPath), { id: directItem.id, op: 'rotate', degree: 90 });
  assert.equal(result.width, SRC_HEIGHT, 'recovered transform: width');
  assert.equal(result.height, SRC_WIDTH, 'recovered transform: height');
  assert.equal(result.previousWidth, SRC_WIDTH, 'recovered transform: previousWidth');
  assert.equal(result.previousHeight, SRC_HEIGHT, 'recovered transform: previousHeight');
  assert.equal(result.degree, 90, 'recovered transform: degree');
  const recovered = readPixelsWithPngjs(sourceFile);
  assertDirection(recovered, OPS[0], 'recovered transform rotate90');
  const recoveredMetadata = readJson(metadataFile);
  assert.equal(recoveredMetadata.width, SRC_HEIGHT, 'recovered transform: metadata width');
  assert.equal(recoveredMetadata.height, SRC_WIDTH, 'recovered transform: metadata height');
  assert.deepEqual(
    fs.readdirSync(infoDir).filter((entry) => entry.includes(TEMP_MARK)),
    [],
    'recovered transform: temp files left behind'
  );
}

console.log(`IMAGE_TRANSFORM_CLOSED_LOOP_OK ${libraryPath}`);
