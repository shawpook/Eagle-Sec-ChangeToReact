import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ControlledDownloadService, DownloadError, isBlockedAddress, sanitizeDownloadHeaders } from '../backend/src/controlled-downloader.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-controlled-download-'));
const stateFile = path.join(tempRoot, 'library-state.json');
const libraryParent = path.join(tempRoot, 'libraries');
fs.mkdirSync(libraryParent, { recursive: true });
const fixture = fs.readFileSync(path.join(projectRoot, 'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png'));
const html = Buffer.from('<!doctype html><html><body>blocked</body></html>');
const brokenImage = Buffer.from('not-an-image');
let activeRequests = 0;
let maxActiveRequests = 0;

function jsonHeaders(request) {
  return {
    referer: request.headers.referer || '',
    userAgent: request.headers['user-agent'] || '',
    authorization: request.headers.authorization || '',
    cookie: request.headers.cookie || '',
  };
}

const remote = http.createServer((req, res) => {
  activeRequests += 1;
  maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
  const finish = () => { activeRequests -= 1; };
  res.once('finish', finish);
  res.once('close', () => {
    if (!res.writableEnded) finish();
  });
  if (req.url === '/image.png') {
    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': fixture.length, 'Content-Disposition': 'attachment; filename="remote.png"' });
    res.end(fixture);
    return;
  }
  if (req.url === '/redirect') {
    res.writeHead(302, { Location: '/image.png' });
    res.end();
    return;
  }
  if (req.url === '/redirect-private') {
    res.writeHead(302, { Location: `http://localhost:${remote.address().port}/image.png` });
    res.end();
    return;
  }
  if (req.url === '/headers') {
    const body = Buffer.from(JSON.stringify(jsonHeaders(req)));
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': body.length });
    res.end(body);
    return;
  }
  if (req.url === '/html') {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Length': html.length });
    res.end(html);
    return;
  }
  if (req.url === '/fake-image') {
    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': brokenImage.length });
    res.end(brokenImage);
    return;
  }
  if (req.url === '/fake-binary') {
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': brokenImage.length });
    res.end(brokenImage);
    return;
  }
  if (req.url === '/declared-large') {
    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': fixture.length + 999999 });
    res.end(fixture);
    return;
  }
  if (req.url === '/stream-large') {
    res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
    res.end(Buffer.alloc(fixture.length + 2048, 1));
    return;
  }
  if (req.url === '/interrupt') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.write(fixture.subarray(0, 20));
    res.destroy();
    return;
  }
  if (req.url?.startsWith('/delay')) {
    setTimeout(() => {
      if (!res.destroyed) {
        res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': fixture.length });
        res.end(fixture);
      }
    }, 220);
    return;
  }
  if (req.url === '/hang') return;
  res.writeHead(404);
  res.end('missing');
});

await new Promise((resolve, reject) => {
  remote.once('error', reject);
  remote.listen(0, '127.0.0.1', resolve);
});
const remotePort = remote.address().port;
const safeBase = `http://safe.test:${remotePort}`;
const localBase = `http://127.0.0.1:${remotePort}`;
const lookup = async () => [{ address: '127.0.0.1', family: 4 }];

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectDownloadError(action, code) {
  try {
    await action();
  } catch (err) {
    expect(err instanceof DownloadError, `expected DownloadError, received ${err}`);
    expect(err.code === code, `expected ${code}, received ${err.code}: ${err.message}`);
    return err;
  }
  throw new Error(`expected ${code} failure`);
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitFor(check, label, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`${label} timeout`);
}

function spawnBackend(apiPort, thumbnailPort, extensionPort) {
  const child = spawn(process.execPath, ['backend/src/server.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      EAGLE_API_PORT: String(apiPort),
      EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
      EAGLE_EXTENSION_PORT: String(extensionPort),
      EAGLE_LIBRARY_STATE_FILE: stateFile,
      EAGLE_DOWNLOAD_ALLOW_HOSTS: '127.0.0.1',
      EAGLE_DOWNLOAD_TIMEOUT_MS: '1000',
      EAGLE_DOWNLOAD_MAX_BYTES: String(fixture.length + 1024),
      EAGLE_DOWNLOAD_LEASE_MS: '60000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  return { child, output: () => output };
}

async function stopBackend(info) {
  if (!info || info.child.exitCode !== null) return;
  info.child.kill();
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 3000);
    info.child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}

async function api(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const body = await response.json();
  return { response, body };
}

const baselineTempDownloads = new Set(fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('eagle-download-')));
const staleTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-download-'));
fs.writeFileSync(path.join(staleTempDir, 'lease.json'), JSON.stringify({ pid: 2147483647, expiresAt: Date.now() - 1000 }), 'utf8');
const service = new ControlledDownloadService({
  concurrency: 5,
  timeoutMs: 500,
  maxBytes: fixture.length + 1024,
  maxRedirects: 3,
  leaseMs: 60_000,
  allowedHosts: new Set(['safe.test']),
  lookup,
});

try {
  expect(!fs.existsSync(staleTempDir), 'stale leased download directory should be removed on service start');
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '192.168.1.1', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '::127.0.0.1', '64:ff9b::7f00:1']) {
    expect(isBlockedAddress(address), `private address should be blocked: ${address}`);
  }
  expect(!isBlockedAddress('93.184.216.34'), 'public address should remain allowed');
  expect(!isBlockedAddress('2606:2800:220:1:248:1893:25c8:1946'), 'public IPv6 should remain allowed');

  const filtered = sanitizeDownloadHeaders({ headers: { Authorization: 'secret', Cookie: 'x=1', Accept: 'image/png' }, referer: 'https://example.com/', userAgent: 'Unit Test' });
  expect(filtered.authorization === undefined && filtered.cookie === undefined, 'sensitive headers must be removed');
  expect(filtered.referer === 'https://example.com/' && filtered['user-agent'] === 'Unit Test', 'allowed headers should remain');

  const blockedService = new ControlledDownloadService({ timeoutMs: 100 });
  await expectDownloadError(() => blockedService.download({ url: `${localBase}/image.png` }), 'SSRF_BLOCKED');
  await expectDownloadError(() => blockedService.download({ url: `http://[::1]:${remotePort}/image.png` }), 'SSRF_BLOCKED');
  blockedService.close();

  const downloaded = await service.download({ url: `${safeBase}/redirect`, validateImage: true });
  expect(fs.existsSync(downloaded.path), 'redirect download should create a temporary file');
  expect(downloaded.redirects === 1 && downloaded.originalName === 'remote.png', 'redirect metadata or filename mismatch');
  service.release(downloaded.taskId);
  expect(!fs.existsSync(downloaded.path), 'released download should be removed');

  await expectDownloadError(() => service.download({ url: `${safeBase}/redirect-private`, validateImage: true }), 'SSRF_BLOCKED');
  const headerDownload = await service.download({
    url: `${safeBase}/headers`,
    headers: { Authorization: 'secret', Cookie: 'x=1', 'X-Test': 'blocked' },
    referer: 'https://example.com/source',
    userAgent: 'Controlled Test Agent',
  });
  const receivedHeaders = JSON.parse(fs.readFileSync(headerDownload.path, 'utf8'));
  expect(receivedHeaders.authorization === '' && receivedHeaders.cookie === '', 'sensitive request headers reached the remote server');
  expect(receivedHeaders.referer === 'https://example.com/source' && receivedHeaders.userAgent === 'Controlled Test Agent', 'allowed request headers were not forwarded');
  service.release(headerDownload.taskId);
  await expectDownloadError(() => service.download({ url: `${safeBase}/html`, validateImage: true }), 'CONTENT_TYPE_BLOCKED');
  await expectDownloadError(() => service.download({ url: `${safeBase}/fake-image`, validateImage: true }), 'IMAGE_DECODE_FAILED');
  await expectDownloadError(() => service.download({ url: `${safeBase}/fake-binary`, validateImage: true }), 'IMAGE_DECODE_FAILED');
  const dnsFailureService = new ControlledDownloadService({ lookup: async () => { throw new Error('NXDOMAIN'); } });
  await expectDownloadError(() => dnsFailureService.download({ url: 'https://missing.test/image.png' }), 'DNS_FAILED');
  dnsFailureService.close();
  await expectDownloadError(() => service.download({ url: `${safeBase}/declared-large` }), 'FILE_TOO_LARGE');
  await expectDownloadError(() => service.download({ url: `${safeBase}/stream-large` }), 'FILE_TOO_LARGE');
  await expectDownloadError(() => service.download({ url: `${safeBase}/interrupt`, validateImage: true }), 'DOWNLOAD_FAILED');

  const timeoutService = new ControlledDownloadService({ timeoutMs: 80, maxBytes: 4096, allowedHosts: new Set(['safe.test']), lookup });
  await expectDownloadError(() => timeoutService.download({ url: `${safeBase}/hang` }), 'NETWORK_TIMEOUT');
  timeoutService.close();

  maxActiveRequests = 0;
  const concurrent = Array.from({ length: 9 }, (_, index) => service.download({ url: `${safeBase}/delay?index=${index}`, validateImage: true }));
  await waitFor(() => service.status().active === 5 && service.status().pending === 4, 'download queue saturation');
  const concurrentResults = await Promise.all(concurrent);
  expect(service.status().maxObservedActive === 5 && maxActiveRequests === 5, `download concurrency mismatch: service=${service.status().maxObservedActive}, remote=${maxActiveRequests}`);
  concurrentResults.forEach((result) => service.release(result.taskId));

  const cancelling = service.start({ url: `${safeBase}/delay?cancel=1`, validateImage: true });
  await waitFor(() => service.task(cancelling.id)?.status === 'running', 'download cancellation start');
  expect(service.cancel(cancelling.id), 'active download cancellation should be accepted');
  await expectDownloadError(() => cancelling.promise, 'TASK_CANCEL');
  expect(service.task(cancelling.id)?.status === 'cancelled', 'cancelled task status mismatch');

  const queueCancelService = new ControlledDownloadService({ concurrency: 1, timeoutMs: 1000, maxBytes: fixture.length + 1024, allowedHosts: new Set(['safe.test']), lookup });
  const queueBlocker = queueCancelService.start({ url: `${safeBase}/delay?queue-blocker=1`, validateImage: true });
  const queuedCancellation = queueCancelService.start({ url: `${safeBase}/delay?queued-cancel=1`, validateImage: true });
  await waitFor(() => queueCancelService.task(queuedCancellation.id)?.status === 'queued', 'queued cancellation setup');
  expect(queueCancelService.cancel(queuedCancellation.id), 'queued download cancellation should be accepted');
  await expectDownloadError(() => queuedCancellation.promise, 'TASK_CANCEL');
  expect(queueCancelService.task(queuedCancellation.id)?.status === 'cancelled', 'queued cancellation status mismatch');
  const queueBlockerResult = await queueBlocker.promise;
  queueCancelService.release(queueBlockerResult.taskId);
  queueCancelService.close();

  const [apiPort, thumbnailPort, extensionPort] = await Promise.all([freePort(), freePort(), freePort()]);
  let backend = spawnBackend(apiPort, thumbnailPort, extensionPort);
  const apiBase = `http://127.0.0.1:${apiPort}`;
  await waitFor(() => backend.output().includes(`localhost:${apiPort}`), 'backend startup');

  const created = await api(apiBase, '/api/library/create', { method: 'POST', body: { name: 'Controlled Download Library', savePath: libraryParent } });
  expect(created.response.status === 201 && created.body.status === 'success', `library create failed: ${JSON.stringify(created.body)}`);
  const libraryPath = created.body.data.path;

  const imported = await api(apiBase, '/api/item/addFromURL', {
    method: 'POST',
    body: {
      url: `${localBase}/image.png`,
      name: 'Remote Import',
      headers: { Authorization: 'must-not-pass', Cookie: 'must-not-pass' },
      referer: 'https://example.com/source',
      userAgent: 'Eagle Controlled Download Test',
    },
  });
  expect(imported.response.status === 201 && imported.body.data.ext === 'png', `URL import failed: ${JSON.stringify(imported.body)}`);
  const itemId = imported.body.data.id;

  const batch = await api(apiBase, '/api/item/addFromURLs', {
    method: 'POST',
    body: { images: Array.from({ length: 7 }, (_, index) => ({ url: `${localBase}/delay?batch=${index}`, name: `Batch ${index}` })) },
  });
  expect(batch.response.status === 201 && batch.body.data.length === 7, `batch URL import failed: ${JSON.stringify(batch.body)}`);
  const queueStatus = await api(apiBase, '/api/download/status');
  expect(queueStatus.body.data.concurrency === 5 && queueStatus.body.data.maxObservedActive === 5, 'backend download queue contract mismatch');

  const direct = await api(apiBase, '/api/download/direct', { method: 'POST', body: { url: `${localBase}/image.png`, validateImage: true } });
  expect(direct.response.status === 201 && fs.existsSync(direct.body.data.path), `direct download failed: ${JSON.stringify(direct.body)}`);
  const directPath = direct.body.data.path;
  const released = await api(apiBase, '/api/download/release', { method: 'POST', body: { path: directPath } });
  expect(released.body.data.released && !fs.existsSync(directPath), 'direct download release should remove temporary file');

  const started = await api(apiBase, '/api/download/start', { method: 'POST', body: { url: `${localBase}/delay?api-cancel=1`, validateImage: true } });
  expect(started.response.status === 202, `download start failed: ${JSON.stringify(started.body)}`);
  const downloadId = started.body.data.task.id;
  await waitFor(async () => (await api(apiBase, `/api/download/${downloadId}`)).body.data.status === 'running', 'API download task running');
  const cancelled = await api(apiBase, `/api/download/${downloadId}/cancel`, { method: 'POST', body: {} });
  expect(cancelled.body.data.cancelled, 'API cancellation should be accepted');
  await waitFor(async () => (await api(apiBase, `/api/download/${downloadId}`)).body.data.status === 'cancelled', 'API download task cancelled');

  const blocked = await api(apiBase, '/api/item/addFromURL', { method: 'POST', body: { url: `http://localhost:${remotePort}/image.png` } });
  expect(blocked.response.status === 403 && blocked.body.code === 'SSRF_BLOCKED', `localhost should be blocked: ${JSON.stringify(blocked.body)}`);
  const fake = await api(apiBase, '/api/item/addFromURL', { method: 'POST', body: { url: `${localBase}/fake-image` } });
  expect(fake.response.status === 422 && fake.body.code === 'IMAGE_DECODE_FAILED', `broken image error mismatch: ${JSON.stringify(fake.body)}`);
  const tooLarge = await api(apiBase, '/api/item/addFromURL', { method: 'POST', body: { url: `${localBase}/declared-large` } });
  expect(tooLarge.response.status === 413 && tooLarge.body.code === 'FILE_TOO_LARGE', `large file error mismatch: ${JSON.stringify(tooLarge.body)}`);

  await stopBackend(backend);
  backend = spawnBackend(apiPort, thumbnailPort, extensionPort);
  await waitFor(() => backend.output().includes(`localhost:${apiPort}`), 'backend restart');
  const reopened = await api(apiBase, '/api/library/current?includeItems=true');
  expect(reopened.body.status === 'success' && reopened.body.data.path === libraryPath, 'library path did not persist across restart');
  const persisted = reopened.body.data.items.find((item) => item.id === itemId);
  expect(persisted && persisted.ext === 'png' && persisted.size === fixture.length, 'URL-imported item did not persist across restart');
  const originalPath = path.join(libraryPath, 'images', `${itemId}.info`, `${persisted.name}.${persisted.ext}`);
  expect(fs.existsSync(originalPath) && fs.readFileSync(originalPath).equals(fixture), 'persisted remote source file mismatch');
  await stopBackend(backend);

  await waitFor(() => activeRequests === 0, 'remote request cleanup');
  const remainingTempDownloads = fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('eagle-download-') && !baselineTempDownloads.has(name));
  expect(remainingTempDownloads.length === 0, `download temporary directories leaked: ${remainingTempDownloads.join(', ')}`);
  console.log(`CONTROLLED_DOWNLOAD_CLOSED_LOOP_OK ${libraryPath}`);
} finally {
  service.close();
  await new Promise((resolve) => remote.close(resolve));
}
