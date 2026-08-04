import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-folder-import-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const sourceRoot = path.join(tempRoot, 'Reference Pack');
const nestedRoot = path.join(sourceRoot, 'Nested 02');
const ignoredLibrary = path.join(sourceRoot, 'Ignored.library');
const stateFile = path.join(tempRoot, 'library-state.json');
const cancelRoot = path.join(tempRoot, 'Cancel Pack');
for (const directory of [librariesRoot, nestedRoot, ignoredLibrary, cancelRoot]) fs.mkdirSync(directory, { recursive: true });

function writePng(file, red) {
  const image = new PNG({ width: 9, height: 5 });
  for (let index = 0; index < image.data.length; index += 4) {
    image.data[index] = red;
    image.data[index + 1] = 40;
    image.data[index + 2] = 120;
    image.data[index + 3] = 255;
  }
  fs.writeFileSync(file, PNG.sync.write(image));
}
writePng(path.join(sourceRoot, 'Root Image.png'), 70);
writePng(path.join(nestedRoot, 'Nested Image.png'), 170);
writePng(path.join(ignoredLibrary, 'Must Not Import.png'), 240);
fs.writeFileSync(path.join(sourceRoot, 'Broken.data'), 'not an image');
for (let index = 0; index < 40; index += 1) writePng(path.join(cancelRoot, `Cancel ${String(index).padStart(2, '0')}.png`), index);

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
    if (Date.now() > deadline) throw new Error(`server timeout: ${output}`);
    await new Promise((resolve) => setTimeout(resolve, 40));
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
  if (!response.ok || body.status !== 'success') throw new Error(`${route}: HTTP ${response.status} ${JSON.stringify(body)}`);
  return body.data;
}
async function waitJob(base, jobId) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const job = await json(base, `/api/jobs/${jobId}`);
    if (['complete', 'cancelled', 'error'].includes(job.status)) return job;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error('folder import job timeout');
}

let server = await startServer();
const created = await json(server.base, '/api/library/create', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Folder Import', savePath: librariesRoot }),
});
const started = await json(server.base, '/api/item/importFolder/start', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folderPath: sourceRoot }),
});
const job = await waitJob(server.base, started.job.id);
if (job.status !== 'complete' || job.progress !== 100) throw new Error(`folder job failed: ${JSON.stringify(job)}`);
if (job.result.count !== 3 || job.result.total !== 3) throw new Error(`folder import count mismatch: ${JSON.stringify(job.result)}`);
if (!job.result.errors.some((entry) => entry.path.endsWith('Ignored.library'))) throw new Error('nested .library skip was not reported');

const current = await json(server.base, '/api/library/current?includeItems=true');
if (current.folders.length !== 1 || current.folders[0].name !== 'Reference Pack') throw new Error('root folder mapping failed');
if (current.folders[0].children.length !== 1 || current.folders[0].children[0].name !== 'Nested 02') throw new Error('nested folder mapping failed');
const rootID = current.folders[0].id;
const nestedID = current.folders[0].children[0].id;
const rootImage = current.items.find((item) => item.name === 'Root Image');
const nestedImage = current.items.find((item) => item.name === 'Nested Image');
const broken = current.items.find((item) => item.name === 'Broken');
if (!rootImage.folders.includes(rootID) || !nestedImage.folders.includes(nestedID) || !broken.folders.includes(rootID)) throw new Error('item direct folder mapping failed');
if (current.items.some((item) => item.name === 'Must Not Import')) throw new Error('nested .library content was imported');
if (!broken.noThumbnail || broken.ext !== 'data') throw new Error('unsupported file error isolation failed');
for (const item of [rootImage, nestedImage]) {
  const info = path.join(created.path, 'images', `${item.id}.info`);
  if (!fs.existsSync(path.join(info, `${item.name}.${item.ext}`)) || !fs.existsSync(path.join(info, `${item.name}_thumbnail.png`))) throw new Error(`item files incomplete: ${item.id}`);
}

const cancelStarted = await json(server.base, '/api/item/importFolder/start', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folderPath: cancelRoot }),
});
let cancelRequested = false;
const cancelDeadline = Date.now() + 15000;
let cancelledJob;
while (Date.now() < cancelDeadline) {
  const state = await json(server.base, `/api/jobs/${cancelStarted.job.id}`);
  if (!cancelRequested && state.status === 'running' && state.progress > 0) {
    await json(server.base, `/api/jobs/${cancelStarted.job.id}/cancel`, { method: 'POST' });
    cancelRequested = true;
  }
  if (['complete', 'cancelled', 'error'].includes(state.status)) {
    cancelledJob = state;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 5));
}
if (!cancelRequested || !cancelledJob || cancelledJob.status !== 'cancelled') throw new Error(`folder cancellation failed: ${JSON.stringify(cancelledJob)}`);
if (cancelledJob.result.count <= 0 || cancelledJob.result.count >= cancelledJob.result.total) throw new Error('folder cancellation did not stop a partial import');
await stopServer(server);

server = await startServer();
const restored = await json(server.base, '/api/library/current?includeItems=true');
if (restored.path !== created.path || restored.items.length !== 3 + cancelledJob.result.count || restored.folders[0].children.length !== 1) throw new Error('folder import did not survive restart');
if (!restored.folders.some((folder) => folder.name === 'Cancel Pack')) throw new Error('cancelled folder tree did not persist partial import');
await stopServer(server);

console.log(`FOLDER_IMPORT_CLOSED_LOOP_OK ${created.path}`);
