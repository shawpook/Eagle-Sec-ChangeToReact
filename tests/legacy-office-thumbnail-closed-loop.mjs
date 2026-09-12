import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  LEGACY_OFFICE_EXTENSIONS,
  __test_resetSofficePathCache,
  renderLegacyOfficeThumbnail,
} from '../backend/src/legacy-office-thumbnail-renderer.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-legacy-office-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const sourcesRoot = path.join(tempRoot, 'sources');
const stateFile = path.join(tempRoot, 'library-state.json');
const samplePdf = path.join(projectRoot, 'frontend/public/mock-assets/sample.pdf');
const samplePng = path.join(projectRoot, 'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library_thumbnail.png');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourcesRoot, { recursive: true });

const fakeSoffice = path.join(tempRoot, 'fake-soffice.js');
fs.writeFileSync(fakeSoffice, `
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
const outdir = args[args.indexOf('--outdir') + 1];
const source = args.at(-1);
const sleep = Number(process.env.FAKE_SOFFICE_SLEEP_MS || 0);
if (sleep > 0) {
  const deadline = Date.now() + sleep;
  while (Date.now() < deadline) { /* fake converter work */ }
}
const output = path.join(outdir, path.basename(source, path.extname(source)) + '.pdf');
fs.copyFileSync(process.env.FAKE_SOFFICE_PDF || ${JSON.stringify(samplePdf)}, output);
`, 'utf8');

const legacySource = path.join(sourcesRoot, 'legacy.doc');
fs.writeFileSync(legacySource, 'legacy office payload', 'utf8');

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
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function post(base, route, body) {
  return request(base, route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function waitForTask(base, taskId, timeoutMs = 40_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await request(base, `/api/item/thumbnailTask/status?taskId=${encodeURIComponent(taskId)}`);
    if (['complete', 'failed', 'cancelled'].includes(status.body.data.status)) return status.body.data;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`thumbnail task did not finish: ${taskId}`);
}

const fakeRenderPdf = async (pdfPath, output) => {
  if (!fs.existsSync(pdfPath)) throw new Error('pdf path missing');
  fs.copyFileSync(samplePng, output);
  return { width: 480, height: 480, pages: 1 };
};

process.env.EAGLE_SOFFICE_PATH = fakeSoffice;
__test_resetSofficePathCache();
const directOutput = path.join(sourcesRoot, 'legacy-direct.png');
const direct = await renderLegacyOfficeThumbnail({
  source: legacySource,
  output: directOutput,
  maxSize: 480,
  extension: 'doc',
  item: { name: 'legacy' },
  renderPdf: fakeRenderPdf,
});
if (direct.converter !== 'libreoffice' || !fs.existsSync(directOutput)) throw new Error('fake LibreOffice conversion failed');

process.env.FAKE_SOFFICE_SLEEP_MS = '120';
__test_resetSofficePathCache();
const timeoutOutput = path.join(sourcesRoot, 'legacy-timeout.png');
const timedOut = await renderLegacyOfficeThumbnail({
  source: legacySource,
  output: timeoutOutput,
  maxSize: 480,
  extension: 'doc',
  item: { name: 'legacy' },
  renderPdf: fakeRenderPdf,
  timeoutMs: 10,
});
if (timedOut.placeholder !== 'OFFICE_CONVERT_TIMEOUT' || !fs.existsSync(timeoutOutput)) {
  throw new Error(`fake converter timeout mismatch: ${JSON.stringify(timedOut)}`);
}
delete process.env.FAKE_SOFFICE_SLEEP_MS;

process.env.EAGLE_SOFFICE_PATH = path.join(tempRoot, 'missing-soffice.exe');
__test_resetSofficePathCache();
const unavailableOutput = path.join(sourcesRoot, 'legacy-unavailable.png');
const unavailable = await renderLegacyOfficeThumbnail({
  source: legacySource,
  output: unavailableOutput,
  maxSize: 480,
  extension: 'doc',
  item: { name: 'legacy' },
  renderPdf: fakeRenderPdf,
});
if (unavailable.placeholder !== 'OFFICE_CONVERTER_UNAVAILABLE' || !fs.existsSync(unavailableOutput)) {
  throw new Error(`converter unavailable mismatch: ${JSON.stringify(unavailable)}`);
}

if (!LEGACY_OFFICE_EXTENSIONS.has('doc') || !LEGACY_OFFICE_EXTENSIONS.has('odt')) {
  throw new Error('legacy office extension set is incomplete');
}

process.env.EAGLE_SOFFICE_PATH = fakeSoffice;
__test_resetSofficePathCache();
let server = await startServer({ EAGLE_SOFFICE_PATH: fakeSoffice });
try {
  const created = await post(server.base, '/api/library/create', { name: 'Legacy Office', savePath: librariesRoot });
  if (created.response.status !== 201) throw new Error(`library create failed: ${JSON.stringify(created.body)}`);
  const imported = await post(server.base, '/api/item/addFromPaths', { paths: [legacySource] });
  if (imported.response.status !== 201 || imported.body.data.length !== 1) {
    throw new Error(`legacy import failed: ${JSON.stringify(imported.body)}`);
  }
  const item = imported.body.data[0];
  if (!item.thumbnailTask) throw new Error('legacy office did not enqueue a thumbnail task');
  const finished = await waitForTask(server.base, item.thumbnailTask);
  if (finished.status !== 'complete') throw new Error(`legacy office task failed: ${JSON.stringify(finished)}`);
  const thumb = path.join(librariesRoot, 'Legacy Office.library', 'images', `${item.id}.info`, `${item.name}_thumbnail.png`);
  if (!fs.existsSync(thumb)) throw new Error('legacy office thumbnail missing');
  const metadata = JSON.parse(fs.readFileSync(path.join(librariesRoot, 'Legacy Office.library', 'images', `${item.id}.info`, 'metadata.json'), 'utf8'));
  if (metadata.noThumbnail || metadata.processingThumbnail || metadata.thumbnailTask || metadata.thumbnailError) {
    throw new Error('legacy office metadata inconsistent');
  }
} finally {
  await stopServer(server);
  try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
}

console.log('LEGACY_OFFICE_THUMBNAIL_CLOSED_LOOP_OK');
