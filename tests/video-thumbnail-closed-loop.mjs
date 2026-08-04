import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fork, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronBinary = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-video-thumbnail-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const sourcesRoot = path.join(tempRoot, 'sources');
const stateFile = path.join(tempRoot, 'library-state.json');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourcesRoot, { recursive: true });

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

async function createFixture(output) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, EAGLE_VIDEO_FIXTURE_OUTPUT: output };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    const child = fork(path.join(projectRoot, 'tests', 'video-fixture-worker.cjs'), [], {
      execPath: electronBinary,
      cwd: projectRoot,
      env,
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.once('message', (message) => {
      if (message?.ok) resolve(output);
      else reject(new Error(message?.error || stderr || 'Fixture generation failed'));
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code !== 0 && !fs.existsSync(output)) reject(new Error(`Fixture process exited ${code}: ${stderr}`));
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
  const deadline = Date.now() + 15000;
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
    const timeout = setTimeout(resolve, 3000);
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

async function waitForTask(base, taskId, timeoutMs = 40000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await request(base, `/api/item/thumbnailTask/status?taskId=${encodeURIComponent(taskId)}`);
    if (['complete', 'failed', 'cancelled'].includes(status.body.data.status)) return status.body.data;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`video thumbnail task did not finish: ${taskId}`);
}

function readMetadata(libraryPath, item) {
  return JSON.parse(fs.readFileSync(path.join(libraryPath, 'images', `${item.id}.info`, 'metadata.json'), 'utf8'));
}

const webm = path.join(sourcesRoot, 'sample.webm');
const corruptWebm = path.join(sourcesRoot, 'corrupt.webm');
const headerOnlyMp4 = path.join(sourcesRoot, 'header-only.mp4');
await createFixture(webm);
fs.writeFileSync(corruptWebm, Buffer.from('not-a-video'));
fs.writeFileSync(headerOnlyMp4, Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00]));
if (!fs.statSync(webm).size) throw new Error('WebM fixture is empty');

let server = await startServer();
const created = await post(server.base, '/api/library/create', { name: '视频缩略图闭环', savePath: librariesRoot });
if (created.response.status !== 201) throw new Error(`library create failed: ${JSON.stringify(created.body)}`);
const libraryPath = created.body.data.path;
const imported = await post(server.base, '/api/item/addFromPaths', { paths: [webm, corruptWebm, headerOnlyMp4] });
if (imported.response.status !== 201 || imported.body.data.length !== 3) throw new Error(`video import failed: ${JSON.stringify(imported.body)}`);
const videoItem = imported.body.data.find((item) => item.name === 'sample');
const corruptItem = imported.body.data.find((item) => item.name === 'corrupt');
const headerOnlyItem = imported.body.data.find((item) => item.name === 'header-only');
if (!videoItem || !corruptItem || !headerOnlyItem) throw new Error('imported video fixtures were not returned');
if (headerOnlyItem.ext !== 'mp4' || headerOnlyItem.mime !== 'video/mp4') throw new Error(`MP4 header detection mismatch: ${JSON.stringify(headerOnlyItem)}`);
if (videoItem.ext !== 'webm' || videoItem.mime !== 'video/webm') throw new Error(`WebM type detection mismatch: ${JSON.stringify(videoItem)}`);
if (!videoItem.thumbnailTask) throw new Error('WebM import did not enqueue a thumbnail task');
const automatic = await waitForTask(server.base, videoItem.thumbnailTask);
if (automatic.status !== 'complete') throw new Error(`automatic WebM thumbnail failed: ${JSON.stringify(automatic)}`);
const automaticMeta = readMetadata(libraryPath, videoItem);
if (automaticMeta.width !== 160 || automaticMeta.height !== 90 || automaticMeta.resolutionWidth !== 160 || automaticMeta.resolutionHeight !== 90) {
  throw new Error(`video dimensions mismatch: ${JSON.stringify(automaticMeta)}`);
}
if (!(automaticMeta.duration > 0) || !(automaticMeta.thumbnailAt >= 0)) throw new Error('video duration/startAt were not persisted');
if (!Array.isArray(automaticMeta.palettes) || automaticMeta.noThumbnail || automaticMeta.processingThumbnail || automaticMeta.thumbnailTask) {
  throw new Error('automatic video metadata state is inconsistent');
}
const thumbnailPath = path.join(libraryPath, 'images', `${videoItem.id}.info`, `${videoItem.name}_thumbnail.png`);
const automaticImage = PNG.sync.read(fs.readFileSync(thumbnailPath));
if (automaticImage.width !== 160 || automaticImage.height !== 90) throw new Error('automatic video thumbnail dimensions mismatch');
const automaticHash = hash(thumbnailPath);

const explicit = await post(server.base, '/api/v2/item/refreshThumbnail', { itemId: videoItem.id, startAt: 0.9 });
if (explicit.response.status !== 200 || !explicit.body.data.task) throw new Error(`explicit video refresh did not finish: ${JSON.stringify(explicit.body)}`);
const explicitMeta = readMetadata(libraryPath, videoItem);
if (Math.abs(explicitMeta.thumbnailAt - 0.9) > 0.05) throw new Error(`explicit startAt mismatch: ${explicitMeta.thumbnailAt}`);
const explicitHash = hash(thumbnailPath);
if (explicitHash === automaticHash) throw new Error('explicit video frame did not change the thumbnail');

const cancellable = await post(server.base, '/api/item/thumbnailTask/start', { itemId: videoItem.id, startAt: 0.8 });
if (cancellable.response.status !== 202) throw new Error('running cancellation task did not start');
const cancelled = await post(server.base, '/api/item/thumbnailTask/cancel', { taskId: cancellable.body.data.id });
if (!['queued', 'running', 'cancelled'].includes(cancelled.body.data.status)) throw new Error('video cancellation response mismatch');
const cancelledResult = await waitForTask(server.base, cancellable.body.data.id);
if (cancelledResult.status !== 'cancelled' || cancelledResult.code !== 'THUMBNAIL_CANCELLED') throw new Error(`video cancellation mismatch: ${JSON.stringify(cancelledResult)}`);
if (hash(thumbnailPath) !== explicitHash) throw new Error('cancelled video task replaced the existing thumbnail');

const invalidStart = await post(server.base, '/api/item/thumbnailTask/start', { itemId: videoItem.id, startAt: -1 });
if (invalidStart.response.status !== 202) throw new Error('invalid startAt task did not enter controlled renderer');
const invalidResult = await waitForTask(server.base, invalidStart.body.data.id);
if (invalidResult.status !== 'failed' || invalidResult.code !== 'VIDEO_START_AT_INVALID') throw new Error(`invalid startAt error mismatch: ${JSON.stringify(invalidResult)}`);
if (hash(thumbnailPath) !== explicitHash) throw new Error('invalid startAt replaced the existing thumbnail');

const corruptResult = await waitForTask(server.base, corruptItem.thumbnailTask);
if (corruptResult.status !== 'failed' || !['VIDEO_CODEC_UNSUPPORTED', 'VIDEO_RENDER_FAILED'].includes(corruptResult.code)) {
  throw new Error(`corrupt video error mismatch: ${JSON.stringify(corruptResult)}`);
}
const headerOnlyResult = await waitForTask(server.base, headerOnlyItem.thumbnailTask);
if (headerOnlyResult.status !== 'failed' || !['VIDEO_CODEC_UNSUPPORTED', 'VIDEO_METADATA_INVALID', 'VIDEO_RENDER_FAILED'].includes(headerOnlyResult.code)) {
  throw new Error(`header-only MP4 error mismatch: ${JSON.stringify(headerOnlyResult)}`);
}
const corruptMeta = readMetadata(libraryPath, corruptItem);
if (corruptMeta.processingThumbnail || corruptMeta.thumbnailTask || !corruptMeta.thumbnailError) throw new Error('corrupt video state was not cleaned up');

await stopServer(server);
server = await startServer({ EAGLE_THUMBNAIL_TIMEOUT_MS: '1' });
const timed = await post(server.base, '/api/item/thumbnailTask/start', { itemId: videoItem.id, startAt: 0.5 });
const timedResult = await waitForTask(server.base, timed.body.data.id);
if (timedResult.status !== 'failed' || timedResult.code !== 'THUMBNAIL_TIMEOUT') throw new Error(`video worker timeout mismatch: ${JSON.stringify(timedResult)}`);
if (hash(thumbnailPath) !== explicitHash) throw new Error('timed out video task replaced the existing thumbnail');
await stopServer(server);

server = await startServer();
const restored = await request(server.base, '/api/library/current?includeItems=true');
const restoredVideo = restored.body.data.items.find((item) => item.id === videoItem.id);
if (!restoredVideo || restoredVideo.noThumbnail || restoredVideo.duration <= 0 || restoredVideo.thumbnailAt !== explicitMeta.thumbnailAt) {
  throw new Error('video metadata did not survive backend restart');
}
if (restoredVideo.processingThumbnail || restoredVideo.thumbnailTask) throw new Error('video task state leaked across restart');
await stopServer(server);

console.log(`VIDEO_THUMBNAIL_CLOSED_LOOP_OK ${libraryPath}`);
