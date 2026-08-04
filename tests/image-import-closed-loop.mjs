import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-image-import-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const sourceRoot = path.join(tempRoot, 'sources');
const stateFile = path.join(tempRoot, 'library-state.json');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourceRoot, { recursive: true });

const pngPath = path.join(sourceRoot, 'Actual PNG.data');
const png = new PNG({ width: 11, height: 7 });
for (let index = 0; index < png.data.length; index += 4) {
  png.data[index] = 220;
  png.data[index + 1] = 40;
  png.data[index + 2] = 30;
  png.data[index + 3] = 255;
}
fs.writeFileSync(pngPath, PNG.sync.write(png));

const jpgPath = path.join(sourceRoot, 'Photo Sample.jpg');
const jpgData = Buffer.alloc(13 * 9 * 4, 255);
for (let index = 0; index < jpgData.length; index += 4) {
  jpgData[index] = 20;
  jpgData[index + 1] = 90;
  jpgData[index + 2] = 180;
  jpgData[index + 3] = 255;
}
fs.writeFileSync(jpgPath, jpeg.encode({ data: jpgData, width: 13, height: 9 }, 90).data);

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
  const deadline = Date.now() + 10000;
  while (!output.includes(`localhost:${apiPort}`)) {
    if (child.exitCode !== null) throw new Error(`server exited: ${output}`);
    if (Date.now() > deadline) throw new Error(`server startup timeout: ${output}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return { child, base: `http://localhost:${apiPort}` };
}

async function stopServer(server) {
  if (server.child.exitCode !== null) return;
  server.child.kill();
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 3000);
    server.child.once('exit', () => { clearTimeout(timeout); resolve(); });
  });
}

async function json(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, options);
  const body = await response.json();
  return { response, body };
}

let server = await startServer();
const create = await json(server.base, '/api/library/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: '图片导入闭环', savePath: librariesRoot }),
});
if (create.response.status !== 201 || create.body.status !== 'success') throw new Error('failed to create import test library');
const libraryPath = create.body.data.path;

const pathImport = await json(server.base, '/api/item/addFromPaths', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ paths: [pngPath, jpgPath] }),
});
if (pathImport.response.status !== 201 || pathImport.body.data.length !== 2) throw new Error('path import failed');
const [pngItem, jpgItem] = pathImport.body.data;
if (pngItem.ext !== 'png' || pngItem.mime !== 'image/png' || pngItem.width !== 11 || pngItem.height !== 7) {
  throw new Error(`PNG metadata mismatch: ${JSON.stringify(pngItem)}`);
}
if (jpgItem.ext !== 'jpg' || jpgItem.mime !== 'image/jpeg' || jpgItem.width !== 13 || jpgItem.height !== 9) {
  throw new Error(`JPG metadata mismatch: ${JSON.stringify(jpgItem)}`);
}

const missing = await json(server.base, '/api/item/addFromPaths', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ paths: [path.join(sourceRoot, 'missing.png')] }),
});
if (missing.response.status !== 400 || missing.body.status !== 'error') throw new Error('missing source must not return success');

const uploadForm = new FormData();
uploadForm.append('file', new Blob([fs.readFileSync(pngPath)], { type: 'application/octet-stream' }), 'Uploaded Probe.png');
const upload = await json(server.base, '/api/item/upload', { method: 'POST', body: uploadForm });
if (upload.response.status !== 201 || upload.body.data.name !== 'Uploaded Probe' || upload.body.data.ext !== 'png' || upload.body.data.mime !== 'image/png') {
  throw new Error(`upload metadata mismatch: ${JSON.stringify(upload.body)}`);
}

const apiExportDir = path.join(tempRoot, 'api-export');
const apiExport = await json(server.base, '/api/export/images', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ savePath: apiExportDir, images: [pngItem, jpgItem] }),
});
if (apiExport.response.status !== 200 || apiExport.body.data.count !== 2) throw new Error('export images API failed');
const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if (digest(apiExport.body.data.paths[0]) !== digest(pngPath) || digest(apiExport.body.data.paths[1]) !== digest(jpgPath)) {
  throw new Error('export images API hash mismatch');
}

for (const item of [...pathImport.body.data, upload.body.data]) {
  const infoDir = path.join(libraryPath, 'images', `${item.id}.info`);
  const original = path.join(infoDir, `${item.name}.${item.ext}`);
  const thumbnail = path.join(infoDir, `${item.name}_thumbnail.png`);
  const metadata = path.join(infoDir, 'metadata.json');
  if (!fs.existsSync(original) || !fs.existsSync(thumbnail) || !fs.existsSync(metadata)) throw new Error(`incomplete item files for ${item.id}`);
  const stored = JSON.parse(fs.readFileSync(metadata, 'utf8'));
  if (stored.ext !== item.ext || stored.width !== item.width || stored.height !== item.height) throw new Error(`stored metadata mismatch for ${item.id}`);
}

await stopServer(server);
server = await startServer();
const restored = await json(server.base, '/api/library/current?includeItems=true');
if (restored.body.status !== 'success' || restored.body.data.path !== libraryPath || restored.body.data.items.length !== 3) {
  throw new Error('imported items did not survive backend restart');
}
await stopServer(server);

console.log(`IMAGE_IMPORT_CLOSED_LOOP_OK ${libraryPath}`);
