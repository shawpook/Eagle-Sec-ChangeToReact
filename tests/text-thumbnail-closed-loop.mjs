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
import { readTextSnippet } from '../backend/src/text-document-support.js';
import { extractTextPreviewLines, renderTextThumbnail } from '../backend/src/text-thumbnail-renderer.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-text-thumbnail-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const sourcesRoot = path.join(tempRoot, 'sources');
const stateFile = path.join(tempRoot, 'library-state.json');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourcesRoot, { recursive: true });

function createPng(filePath, color, width = 24, height = 24) {
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

function utf16leBuffer(value) {
  const bytes = [0xff, 0xfe];
  for (const char of value) {
    const code = char.codePointAt(0);
    bytes.push(code & 0xff, (code >> 8) & 0xff);
  }
  return Buffer.from(bytes);
}

function pngStats(filePath) {
  const png = PNG.sync.read(fs.readFileSync(filePath));
  const colors = new Set();
  for (let pixel = 0; pixel < png.width * png.height; pixel += 1) {
    const offset = pixel * 4;
    if (png.data[offset + 3] < 200) continue;
    colors.add(`${png.data[offset]},${png.data[offset + 1]},${png.data[offset + 2]}`);
  }
  return { width: png.width, height: png.height, colorCount: colors.size };
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
  if (![apiPort, thumbnailPort, extensionPort].every((port) => Number.isInteger(port) && port > 0 && port < 65536)) {
    throw new Error('invalid free port allocation');
  }
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

async function waitForTask(base, taskId, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await request(base, `/api/item/thumbnailTask/status?taskId=${encodeURIComponent(taskId)}`);
    if (['complete', 'failed', 'cancelled'].includes(status.body.data.status)) return status.body.data;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`thumbnail task did not finish: ${taskId}`);
}

const gbkBytes = Buffer.from('d6d0cec4'.repeat(20) + '0a', 'hex');
const utf8Path = path.join(sourcesRoot, 'utf8.txt');
const bomPath = path.join(sourcesRoot, 'bom.txt');
const gbkPath = path.join(sourcesRoot, 'gbk.txt');
const utf16Path = path.join(sourcesRoot, 'utf16.txt');
const emptyPath = path.join(sourcesRoot, 'empty.txt');
const longPath = path.join(sourcesRoot, 'long.txt');
const binaryPath = path.join(sourcesRoot, 'binary.txt');
const brokenPath = path.join(sourcesRoot, 'broken.txt');
const sampleMd = path.join(sourcesRoot, 'sample.md');
const notesMarkdown = path.join(sourcesRoot, 'notes.markdown');
const dataJson = path.join(sourcesRoot, 'json-data.json');
const configYaml = path.join(sourcesRoot, 'config.yaml');
const settingsYml = path.join(sourcesRoot, 'settings.yml');
const dataXml = path.join(sourcesRoot, 'xml-data.xml');
const plainLog = path.join(sourcesRoot, 'plain.log');
const docRst = path.join(sourcesRoot, 'doc.rst');
const tableCsv = path.join(sourcesRoot, 'csv-table.csv');
const tableTsv = path.join(sourcesRoot, 'tsv-table.tsv');

fs.writeFileSync(utf8Path, 'UTF-8 normal text\nsecond line\n', 'utf8');
fs.writeFileSync(bomPath, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('中文 BOM 文本', 'utf8')]));
fs.writeFileSync(gbkPath, gbkBytes);
fs.writeFileSync(utf16Path, utf16leBuffer('中文 UTF-16 封面'));
fs.writeFileSync(emptyPath, '');
fs.writeFileSync(longPath, `${'x'.repeat(140_000)}\nshort tail`, 'utf8');
fs.writeFileSync(binaryPath, Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(64, 0)]));
fs.writeFileSync(brokenPath, Buffer.from('e4bda0e4bd'.repeat(40), 'hex'));
fs.writeFileSync(sampleMd, [
  '# Markdown Title',
  '',
  'Intro paragraph.',
  '',
  '- first item',
  '- [x] completed task',
  '- [ ] pending task',
  '',
  '> quoted line',
  '',
  '```js',
  'console.log("cover");',
  '```',
  '',
  '| Name | Value |',
  '| --- | --- |',
  '| alpha | 1 |',
].join('\n'), 'utf8');
fs.writeFileSync(notesMarkdown, '## Notes\n\nPlain markdown notes.', 'utf8');
fs.writeFileSync(dataJson, JSON.stringify({ name: 'cover', enabled: true, nested: { value: 3 } }, null, 2), 'utf8');
fs.writeFileSync(configYaml, 'name: cover\nenabled: true\nitems:\n  - one\n  - two\n', 'utf8');
fs.writeFileSync(settingsYml, 'theme: light\nwidth: 480\n', 'utf8');
fs.writeFileSync(dataXml, '<root name="cover">&amp;<child>text</child></root>', 'utf8');
fs.writeFileSync(plainLog, '2026-08-05 INFO cover renderer started\n2026-08-05 INFO queue accepted\n', 'utf8');
fs.writeFileSync(docRst, 'Cover Title\n===========\n\nBody paragraph.', 'utf8');
fs.writeFileSync(tableCsv, 'name,value\ncover,3\nqueue,2\n', 'utf8');
fs.writeFileSync(tableTsv, 'name\tvalue\ncover\t3\nqueue\t2\n', 'utf8');

const utf8Snippet = readTextSnippet(utf8Path);
if (!utf8Snippet.content.includes('UTF-8 normal text')) throw new Error('UTF-8 snippet decode failed');
const bomSnippet = readTextSnippet(bomPath);
if (bomSnippet.encoding !== 'utf-8' || !bomSnippet.content.includes('中文') || bomSnippet.content.charCodeAt(0) === 0xfeff) {
  throw new Error('UTF-8 BOM snippet decode failed');
}
const gbkSnippet = readTextSnippet(gbkPath);
if (gbkSnippet.encoding !== 'gb18030' || !gbkSnippet.content.includes('中文')) throw new Error('GBK/GB18030 snippet decode failed');
const utf16Snippet = readTextSnippet(utf16Path);
if (!utf16Snippet.content.includes('中文') || !utf16Snippet.content.includes('UTF-16') || utf16Snippet.content.charCodeAt(0) === 0xfeff) {
  throw new Error('UTF-16LE snippet decode failed');
}
const longSnippet = readTextSnippet(longPath);
if (!longSnippet.truncated || longSnippet.bytesRead > 128 * 1024) throw new Error('long text snippet was not limited to 128 KiB');

const mdLines = extractTextPreviewLines(fs.readFileSync(sampleMd, 'utf8'), 'md');
const mdKinds = new Set(mdLines.map((line) => line.kind));
for (const kind of ['heading1', 'bullet', 'task', 'quote', 'code', 'table']) {
  if (!mdKinds.has(kind)) throw new Error(`markdown preview missing ${kind}`);
}

const specialSource = path.join(sourcesRoot, 'special.xml');
const specialOutput = path.join(sourcesRoot, 'special.png');
fs.writeFileSync(specialSource, '<root attr="x">&amp;<child>a< b > c</child></root>', 'utf8');
await renderTextThumbnail({
  source: specialSource,
  output: specialOutput,
  maxSize: 480,
  extension: 'xml',
  item: { name: 'special.xml' },
});
if (!fs.existsSync(specialOutput)) throw new Error('XML special character thumbnail was not generated');

let server = await startServer();
const created = await post(server.base, '/api/library/create', { name: '文本封面', savePath: librariesRoot });
if (created.response.status !== 201) throw new Error(`library create failed: ${JSON.stringify(created.body)}`);
const libraryPath = created.body.data.path;
const sources = [
  utf8Path, bomPath, gbkPath, utf16Path, emptyPath, longPath, binaryPath, brokenPath,
  sampleMd, notesMarkdown, dataJson, configYaml, settingsYml, dataXml, plainLog, docRst, tableCsv, tableTsv,
];
const imported = await post(server.base, '/api/item/addFromPaths', { paths: sources });
if (imported.response.status !== 201 || imported.body.data.length !== sources.length) {
  throw new Error(`fixture import failed: ${JSON.stringify(imported.body)}`);
}
const itemsByName = new Map(imported.body.data.map((item) => [item.name, item]));
const successNames = [
  'utf8', 'bom', 'gbk', 'utf16', 'empty', 'long', 'broken', 'sample',
  'notes', 'json-data', 'config', 'settings', 'xml-data', 'plain', 'doc', 'csv-table', 'tsv-table',
];

for (const name of successNames) {
  const item = itemsByName.get(name);
  if (!item) throw new Error(`missing imported text item ${name}`);
  if (!item.thumbnailTask && !item.processingThumbnail) throw new Error(`${name} did not enqueue a thumbnail task`);
}

for (const name of successNames) {
  const item = itemsByName.get(name);
  const finished = await waitForTask(server.base, item.thumbnailTask);
  if (finished.status !== 'complete') throw new Error(`${name} thumbnail failed: ${JSON.stringify(finished)}`);
  const thumb = path.join(libraryPath, 'images', `${item.id}.info`, `${item.name}_thumbnail.png`);
  if (!fs.existsSync(thumb)) throw new Error(`${name} thumbnail file missing`);
  const stats = pngStats(thumb);
  if (stats.width <= 0 || stats.width > 480 || stats.height <= 0 || stats.height > 480) {
    throw new Error(`${name} thumbnail dimensions invalid: ${JSON.stringify(stats)}`);
  }
  if (stats.colorCount < 2) throw new Error(`${name} thumbnail is blank`);
  const metadata = JSON.parse(fs.readFileSync(path.join(libraryPath, 'images', `${item.id}.info`, 'metadata.json'), 'utf8'));
  if (metadata.noThumbnail || metadata.processingThumbnail || metadata.thumbnailTask || metadata.thumbnailError || !Array.isArray(metadata.palettes)) {
    throw new Error(`${name} thumbnail metadata is inconsistent`);
  }
  if (Number(metadata.width) !== 0 || Number(metadata.height) !== 0) {
    throw new Error(`${name} text thumbnail overwrote original dimensions`);
  }
}

const binaryItem = itemsByName.get('binary');
const binaryResult = await waitForTask(server.base, binaryItem.thumbnailTask);
if (binaryResult.status !== 'failed' || binaryResult.code !== 'TEXT_SOURCE_BINARY') {
  throw new Error(`binary disguised text did not fail as expected: ${JSON.stringify(binaryResult)}`);
}

await stopServer(server);
server = await startServer();
const restored = await request(server.base, '/api/library/current?includeItems=true');
for (const name of successNames) {
  const item = restored.body.data.items.find((entry) => entry.name === name);
  if (!item || item.noThumbnail || item.processingThumbnail || item.thumbnailTask) {
    throw new Error(`${name} thumbnail state did not survive restart`);
  }
  const thumb = path.join(libraryPath, 'images', `${item.id}.info`, `${item.name}_thumbnail.png`);
  if (!fs.existsSync(thumb)) throw new Error(`${name} thumbnail did not survive restart`);
}

for (const ext of ['txt', 'md']) {
  const item = restored.body.data.items.find((entry) => entry.ext === ext && successNames.includes(entry.name));
  if (!item) continue;
  const thumb = path.join(libraryPath, 'images', `${item.id}.info`, `${item.name}_thumbnail.png`);
  fs.rmSync(thumb, { force: true });
  if (ext === 'txt') {
    const refreshed = await post(server.base, '/api/item/refreshThumbnail', { id: item.id });
    if (refreshed.response.status !== 200 || !fs.existsSync(thumb)) throw new Error('txt refreshThumbnail API failed');
  } else {
    const started = await post(server.base, '/api/item/thumbnailTask/start', { itemId: item.id });
    if (started.response.status !== 202) throw new Error(`${ext} refresh did not enqueue`);
    const finished = await waitForTask(server.base, started.body.data.id);
    if (finished.status !== 'complete' || !fs.existsSync(thumb)) throw new Error(`${ext} refresh thumbnail failed`);
  }
}

await stopServer(server);

const directLibrary = loadLibrary(libraryPath);
const directItems = directLibrary.items.filter((item) => ['txt', 'md', 'json', 'csv'].includes(item.ext)).slice(0, 6);
let active = 0;
let maxActive = 0;
const concurrencyService = new ThumbnailTaskService({
  concurrency: 3,
  timeoutMs: 2_000,
  analyze: async () => [{ color: [1, 2, 3], ratio: 100 }],
  render: async ({ output }) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 80));
    createPng(output, [80, 100, 160]);
    active -= 1;
    return { width: 24, height: 24 };
  },
});
const concurrencyTasks = directItems.map((item) => concurrencyService.enqueue(directLibrary, item.id));
await Promise.all(concurrencyTasks.map((task) => concurrencyService.wait(task.id)));
if (maxActive !== 3) throw new Error(`text thumbnail concurrency mismatch: ${maxActive}`);

const boundedLibrary = loadLibrary(libraryPath);
const boundedItems = boundedLibrary.items.filter((item) => ['txt', 'md', 'json'].includes(item.ext)).slice(0, 3);
const boundedService = new ThumbnailTaskService({
  concurrency: 1,
  timeoutMs: 2_000,
  maxPending: 1,
  analyze: async () => [{ color: [1, 2, 3], ratio: 100 }],
  render: async ({ output }) => {
    await new Promise((resolve) => setTimeout(resolve, 80));
    createPng(output, [70, 90, 130]);
    return { width: 24, height: 24 };
  },
});
if (boundedService.status().maxPending !== 1) throw new Error('thumbnail queue maxPending is not configurable');
const firstBounded = boundedService.enqueue(boundedLibrary, boundedItems[0].id);
const secondBounded = boundedService.enqueue(boundedLibrary, boundedItems[1].id);
let queueFullError;
try { boundedService.enqueue(boundedLibrary, boundedItems[2].id); } catch (err) { queueFullError = err; }
if (queueFullError?.code !== 'THUMBNAIL_QUEUE_FULL' || queueFullError.statusCode !== 429) {
  throw new Error(`thumbnail queue full mismatch: ${JSON.stringify(queueFullError)}`);
}
await Promise.all([boundedService.wait(firstBounded.id), boundedService.wait(secondBounded.id)]);

const cancelLibrary = loadLibrary(libraryPath);
const cancelItems = cancelLibrary.items.filter((item) => ['txt', 'md'].includes(item.ext)).slice(0, 2);
const cancelService = new ThumbnailTaskService({
  concurrency: 1,
  timeoutMs: 2_000,
  analyze: async () => [{ color: [1, 2, 3], ratio: 100 }],
  render: async ({ output }) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    createPng(output, [50, 50, 50]);
    return { width: 24, height: 24 };
  },
});
const runningTask = cancelService.enqueue(cancelLibrary, cancelItems[0].id);
const queuedTask = cancelService.enqueue(cancelLibrary, cancelItems[1].id);
const queuedThumb = path.join(libraryPath, 'images', `${cancelItems[1].id}.info`, `${cancelItems[1].name}_thumbnail.png`);
const queuedHash = hash(queuedThumb);
cancelService.cancel(queuedTask.id);
let cancelError;
try { await cancelService.wait(queuedTask.id); } catch (err) { cancelError = err; }
if (cancelError?.code !== 'THUMBNAIL_CANCELLED' || hash(queuedThumb) !== queuedHash) {
  throw new Error('queued text thumbnail cancellation changed the existing thumbnail');
}
await cancelService.wait(runningTask.id);

fs.rmSync(tempRoot, { recursive: true, force: true });
console.log('TEXT_THUMBNAIL_CLOSED_LOOP_OK');
