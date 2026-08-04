import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { ColorAnalyzerService } from '../backend/src/color-analyzer.js';
import { loadLibrary } from '../backend/src/library-store.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-color-palette-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const sourcesRoot = path.join(tempRoot, 'sources');
const stateFile = path.join(tempRoot, 'library-state.json');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourcesRoot, { recursive: true });

function createPng(filePath, left, right) {
  const image = new PNG({ width: 96, height: 64 });
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const color = x < image.width / 2 ? left : right;
      const offset = (y * image.width + x) * 4;
      image.data[offset] = color[0];
      image.data[offset + 1] = color[1];
      image.data[offset + 2] = color[2];
      image.data[offset + 3] = 255;
    }
  }
  fs.writeFileSync(filePath, PNG.sync.write(image));
}

const normalSource = path.join(sourcesRoot, 'normal.png');
const corruptSource = path.join(sourcesRoot, 'corrupt.png');
createPng(normalSource, [230, 35, 25], [20, 70, 220]);
fs.writeFileSync(corruptSource, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]));

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
      EAGLE_PALETTE_DELAY_MS: '150',
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

let server = await startServer();
const create = await post(server.base, '/api/library/create', { name: '颜色分析闭环', savePath: librariesRoot });
if (create.response.status !== 201) throw new Error(`library create failed: ${JSON.stringify(create.body)}`);
const libraryPath = create.body.data.path;

const imported = await post(server.base, '/api/item/addFromPaths', { paths: [normalSource, corruptSource] });
if (imported.response.status !== 201 || imported.body.data.length !== 2) throw new Error('palette fixture import failed');
const [normalItem, corruptItem] = imported.body.data;

const normal = await post(server.base, '/api/item/refreshPalette', { id: normalItem.id });
if (normal.response.status !== 200 || normal.body.status !== 'success') throw new Error(`normal palette failed: ${JSON.stringify(normal.body)}`);
const normalPalettes = normal.body.data.palettes;
if (!Array.isArray(normalPalettes) || normalPalettes.length < 2) throw new Error(`normal palette is incomplete: ${JSON.stringify(normalPalettes)}`);
if (!normalPalettes.every((entry) => Array.isArray(entry.color) && entry.color.length === 3 && Number.isFinite(entry.ratio))) {
  throw new Error(`normal palette shape mismatch: ${JSON.stringify(normalPalettes)}`);
}
const dominant = normalPalettes.slice(0, 2).map((entry) => entry.color);
if (!dominant.some(([red, green, blue]) => red > 180 && green < 80 && blue < 80)) throw new Error('red dominant color not detected');
if (!dominant.some(([red, green, blue]) => red < 80 && green < 120 && blue > 160)) throw new Error('blue dominant color not detected');

const missing = await post(server.base, '/api/item/refreshPalette', { id: 'ITEM-DOES-NOT-EXIST' });
if (missing.response.status !== 404 || missing.body.code !== 'ITEM_NOT_FOUND') throw new Error(`missing item error mismatch: ${JSON.stringify(missing.body)}`);

const corrupt = await post(server.base, '/api/item/refreshPalette', { id: corruptItem.id });
if (corrupt.response.status !== 422 || corrupt.body.code !== 'IMAGE_DECODE_FAILED') throw new Error(`corrupt image error mismatch: ${JSON.stringify(corrupt.body)}`);
let storedCorrupt = JSON.parse(fs.readFileSync(path.join(libraryPath, 'images', `${corruptItem.id}.info`, 'metadata.json'), 'utf8'));
if (storedCorrupt.processingPalette || storedCorrupt.palettes) throw new Error('corrupt image left a persisted processing state or fake palette');

const concurrentSources = [];
for (let index = 0; index < 7; index += 1) {
  const source = path.join(sourcesRoot, `concurrent-${index}.png`);
  createPng(source, [30 + index * 15, 120, 210], [220, 180 - index * 10, 35]);
  concurrentSources.push(source);
}
const concurrentImport = await post(server.base, '/api/item/addFromPaths', { paths: concurrentSources });
if (concurrentImport.response.status !== 201 || concurrentImport.body.data.length !== 7) throw new Error('concurrent palette fixtures failed to import');
const requests = concurrentImport.body.data.map((item) => post(server.base, '/api/item/refreshPalette', { id: item.id }));
let observedPending = false;
let maxActive = 0;
const observeDeadline = Date.now() + 3_000;
while (Date.now() < observeDeadline) {
  const queue = await request(server.base, '/api/item/paletteQueue');
  maxActive = Math.max(maxActive, queue.body.data.active);
  observedPending ||= queue.body.data.pending > 0;
  if (observedPending && maxActive === 3) break;
  await new Promise((resolve) => setTimeout(resolve, 10));
}
const concurrentResults = await Promise.all(requests);
if (concurrentResults.some((result) => result.response.status !== 200)) throw new Error('a concurrent palette request failed');
if (!observedPending || maxActive !== 3) throw new Error(`queue concurrency was not observed: pending=${observedPending}, maxActive=${maxActive}`);
const drained = await request(server.base, '/api/item/paletteQueue');
if (drained.body.data.active !== 0 || drained.body.data.pending !== 0) throw new Error('palette queue did not drain');

await stopServer(server);
server = await startServer();
const restored = await request(server.base, '/api/library/current?includeItems=true');
if (restored.response.status !== 200 || restored.body.data.path !== libraryPath) throw new Error('palette library was not restored after restart');
const restoredNormal = restored.body.data.items.find((item) => item.id === normalItem.id);
if (!restoredNormal || JSON.stringify(restoredNormal.palettes) !== JSON.stringify(normalPalettes) || restoredNormal.processingPalette) {
  throw new Error('palettes did not survive backend restart');
}
await stopServer(server);

const directLibrary = loadLibrary(libraryPath);
let activeAnalyses = 0;
let directMaxActive = 0;
const service = new ColorAnalyzerService({
  concurrency: 3,
  timeoutMs: 1_000,
  delayMs: 0,
  analyze: async () => {
    activeAnalyses += 1;
    directMaxActive = Math.max(directMaxActive, activeAnalyses);
    await new Promise((resolve) => setTimeout(resolve, 40));
    activeAnalyses -= 1;
    return [{ color: [1, 2, 3], ratio: 100 }];
  },
});
await Promise.all(concurrentImport.body.data.map((item) => service.enqueue(directLibrary, item.id)));
if (directMaxActive !== 3) throw new Error(`service concurrency contract mismatch: ${directMaxActive}`);

const timeoutLibrary = loadLibrary(libraryPath);
const timeoutItem = timeoutLibrary.items.find((item) => item.id === normalItem.id);
const timeoutService = new ColorAnalyzerService({
  concurrency: 3,
  timeoutMs: 25,
  delayMs: 0,
  analyze: () => new Promise(() => {}),
});
let timeoutError;
try {
  await timeoutService.enqueue(timeoutLibrary, timeoutItem.id);
} catch (err) {
  timeoutError = err;
}
if (timeoutError?.code !== 'PALETTE_TIMEOUT') throw new Error(`timeout contract mismatch: ${timeoutError?.code}`);
const timeoutStored = JSON.parse(fs.readFileSync(path.join(libraryPath, 'images', `${timeoutItem.id}.info`, 'metadata.json'), 'utf8'));
if (timeoutStored.processingPalette || timeoutStored.palettes) throw new Error('timed out analysis left a processing state or fake palette');

const pausedLibrary = loadLibrary(libraryPath);
const pausedItem = pausedLibrary.items.find((item) => item.id === normalItem.id);
const pausedService = new ColorAnalyzerService({
  concurrency: 3,
  timeoutMs: 1_000,
  delayMs: 0,
  analyze: async () => [{ color: [9, 8, 7], ratio: 100 }],
});
pausedService.pause();
const pausedRequest = pausedService.enqueue(pausedLibrary, pausedItem.id);
await new Promise((resolve) => setTimeout(resolve, 20));
if (!pausedService.status().paused || pausedService.status().pending !== 1 || pausedService.status().active !== 0) {
  throw new Error(`pause contract mismatch: ${JSON.stringify(pausedService.status())}`);
}
pausedService.resume();
await pausedRequest;
if (pausedService.status().length !== 0) throw new Error('resumed queue did not drain');

console.log(`COLOR_PALETTE_CLOSED_LOOP_OK ${libraryPath}`);
