import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-custom-thumbnail-'));
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
  const deadline = Date.now() + 10_000;
  while (!output.includes(`localhost:${apiPort}`)) {
    if (child.exitCode !== null) throw new Error(`server exited: ${output}`);
    if (Date.now() > deadline) throw new Error(`server startup timeout: ${output}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return { child, base: `http://127.0.0.1:${apiPort}` };
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

const originalSource = path.join(sourcesRoot, 'original.png');
const redSource = path.join(sourcesRoot, 'red.png');
const greenSource = path.join(sourcesRoot, 'green.png');
const corruptSource = path.join(sourcesRoot, 'corrupt.png');
const oversizedSource = path.join(sourcesRoot, 'oversized.png');
createPng(originalSource, [25, 60, 210], 120, 80);
createPng(redSource, [230, 25, 20], 75, 45);
createPng(greenSource, [20, 220, 40], 55, 85);
fs.writeFileSync(corruptSource, Buffer.from('not-an-image'));
const oversizedHandle = fs.openSync(oversizedSource, 'w');
fs.ftruncateSync(oversizedHandle, 10_000_001);
fs.closeSync(oversizedHandle);

let server = await startServer();
const created = await post(server.base, '/api/library/create', { name: '自定义缩略图闭环', savePath: librariesRoot });
if (created.response.status !== 201) throw new Error(`library create failed: ${JSON.stringify(created.body)}`);
const libraryPath = created.body.data.path;
const imported = await post(server.base, '/api/item/addFromPaths', { paths: [originalSource] });
if (imported.response.status !== 201 || imported.body.data.length !== 1) throw new Error('thumbnail fixture import failed');
const item = imported.body.data[0];
const itemDir = path.join(libraryPath, 'images', `${item.id}.info`);
const thumbnailPath = path.join(itemDir, `${item.name}_thumbnail.png`);
const metadataPath = path.join(itemDir, 'metadata.json');
const originalThumbnailHash = hash(thumbnailPath);

const missingId = await post(server.base, '/api/item/setCustomThumbnail', { filePath: redSource });
if (missingId.response.status !== 400 || missingId.body.code !== 'ITEM_ID_REQUIRED') throw new Error(`missing id mismatch: ${JSON.stringify(missingId.body)}`);
const missingPath = await post(server.base, '/api/item/setCustomThumbnail', { itemId: item.id });
if (missingPath.response.status !== 400 || missingPath.body.code !== 'INVALID_THUMBNAIL_PATH') throw new Error(`missing path mismatch: ${JSON.stringify(missingPath.body)}`);
const missingItem = await post(server.base, '/api/v2/item/setCustomThumbnail', { itemId: 'ITEM-NOT-FOUND', filePath: redSource });
if (missingItem.response.status !== 404 || missingItem.body.code !== 'ITEM_NOT_FOUND') throw new Error(`missing item mismatch: ${JSON.stringify(missingItem.body)}`);
const relativePath = await post(server.base, '/api/item/setCustomThumbnail', { itemId: item.id, filePath: 'relative.png' });
if (relativePath.response.status !== 400 || relativePath.body.code !== 'INVALID_THUMBNAIL_PATH') throw new Error(`relative path mismatch: ${JSON.stringify(relativePath.body)}`);
const directoryPath = await post(server.base, '/api/item/setCustomThumbnail', { itemId: item.id, filePath: sourcesRoot });
if (directoryPath.response.status !== 400 || directoryPath.body.code !== 'INVALID_THUMBNAIL_PATH') throw new Error(`directory path mismatch: ${JSON.stringify(directoryPath.body)}`);
const oversized = await post(server.base, '/api/item/setCustomThumbnail', { itemId: item.id, filePath: oversizedSource });
if (oversized.response.status !== 413 || oversized.body.code !== 'THUMBNAIL_SOURCE_TOO_LARGE') throw new Error(`oversized source mismatch: ${JSON.stringify(oversized.body)}`);

const setV2 = await post(server.base, '/api/v2/item/setCustomThumbnail', {
  itemId: item.id,
  filePath: redSource,
  width: 640,
  height: 480,
});
if (setV2.response.status !== 200 || !setV2.body.data.item.customThumbnail) throw new Error(`V2 set custom thumbnail failed: ${JSON.stringify(setV2.body)}`);
if (setV2.body.data.item.width !== 640 || setV2.body.data.item.height !== 480) throw new Error('explicit custom dimensions were not preserved');
if (!Array.isArray(setV2.body.data.item.palettes) || setV2.body.data.item.palettes.length === 0) throw new Error('custom thumbnail palettes are missing');
const redThumbnailHash = hash(thumbnailPath);
if (redThumbnailHash === originalThumbnailHash) throw new Error('custom thumbnail did not replace the generated thumbnail');
const redDecoded = PNG.sync.read(fs.readFileSync(thumbnailPath));
if (redDecoded.width !== 75 || redDecoded.height !== 45 || redDecoded.data[0] < 200) throw new Error('custom thumbnail file content mismatch');

const beforeCorruptMetadata = fs.readFileSync(metadataPath, 'utf8');
const corrupt = await post(server.base, '/api/item/setCustomThumbnail', { itemId: item.id, filePath: corruptSource });
if (corrupt.response.status !== 422 || corrupt.body.code !== 'THUMBNAIL_DECODE_FAILED') throw new Error(`corrupt source mismatch: ${JSON.stringify(corrupt.body)}`);
if (hash(thumbnailPath) !== redThumbnailHash || fs.readFileSync(metadataPath, 'utf8') !== beforeCorruptMetadata) {
  throw new Error('failed custom thumbnail update changed the previous file or metadata');
}

const concurrentRed = post(server.base, '/api/item/setCustomThumbnail', { itemId: item.id, filePath: redSource });
const concurrentGreen = post(server.base, '/api/item/setCustomThumbnail', { itemId: item.id, filePath: greenSource });
const concurrentResults = await Promise.all([concurrentRed, concurrentGreen]);
if (concurrentResults.some((result) => result.response.status !== 200)) throw new Error('concurrent custom thumbnail update failed');
const greenDecoded = PNG.sync.read(fs.readFileSync(thumbnailPath));
if (greenDecoded.width !== 55 || greenDecoded.height !== 85 || greenDecoded.data[1] < 190) {
  throw new Error('same-item updates were not committed in request order');
}
const concurrentMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
if (!concurrentMetadata.customThumbnail || concurrentMetadata.width !== 55 || concurrentMetadata.height !== 85) {
  throw new Error('concurrent custom thumbnail metadata mismatch');
}

await stopServer(server);
server = await startServer();
const restored = await request(server.base, '/api/library/current?includeItems=true');
const restoredItem = restored.body.data.items.find((entry) => entry.id === item.id);
if (!restoredItem?.customThumbnail || restoredItem.width !== 55 || restoredItem.height !== 85 || !Array.isArray(restoredItem.palettes)) {
  throw new Error('custom thumbnail metadata did not survive backend restart');
}
const persistedCustomHash = hash(thumbnailPath);

const refresh = await post(server.base, '/api/item/refreshThumbnail', { itemId: item.id });
if (refresh.response.status !== 200 || !refresh.body.data.preservedCustomThumbnail || hash(thumbnailPath) !== persistedCustomHash) {
  throw new Error(`refresh overwrote a custom thumbnail: ${JSON.stringify(refresh.body)}`);
}

const reset = await post(server.base, '/api/v2/item/resetCustomThumbnail', { itemId: item.id });
if (reset.response.status !== 200 || reset.body.data.item.customThumbnail) throw new Error(`custom thumbnail reset failed: ${JSON.stringify(reset.body)}`);
const resetDecoded = PNG.sync.read(fs.readFileSync(thumbnailPath));
if (resetDecoded.width !== 120 || resetDecoded.height !== 80 || resetDecoded.data[2] < 180) throw new Error('reset did not regenerate the original thumbnail');
const resetMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
if (resetMetadata.customThumbnail || resetMetadata.noThumbnail || resetMetadata.noPreview || !Array.isArray(resetMetadata.palettes)) {
  throw new Error('reset metadata is inconsistent');
}

await stopServer(server);
server = await startServer();
const resetRestored = await request(server.base, '/api/library/current?includeItems=true');
const resetRestoredItem = resetRestored.body.data.items.find((entry) => entry.id === item.id);
if (!resetRestoredItem || resetRestoredItem.customThumbnail || resetRestoredItem.width !== 120 || resetRestoredItem.height !== 80) {
  throw new Error('reset state did not survive backend restart');
}
await stopServer(server);

console.log(`CUSTOM_THUMBNAIL_CLOSED_LOOP_OK ${libraryPath}`);
