import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-browser-capture-download-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
fs.mkdirSync(librariesRoot, { recursive: true });

const png = new PNG({ width: 10, height: 7 });
for (let index = 0; index < png.data.length; index += 4) {
  png.data[index] = 40;
  png.data[index + 1] = 160;
  png.data[index + 2] = 90;
  png.data[index + 3] = 255;
}
const pngBuffer = PNG.sync.write(png);

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

async function startFixture() {
  const fixture = http.createServer((req, res) => {
    if (req.url === '/ok.png') {
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': pngBuffer.length });
      res.end(pngBuffer);
      return;
    }
    if (req.url === '/sample.mp4') {
      const video = Buffer.concat([
        Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]),
        Buffer.from('isom'),
        Buffer.alloc(1024, 0),
      ]);
      res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': video.length });
      res.end(video);
      return;
    }
    if (req.url === '/redirect') {
      res.writeHead(302, { Location: '/ok.png' });
      res.end();
      return;
    }
    if (req.url === '/referer') {
      if (req.headers.referer === 'https://page.test/') {
        res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': pngBuffer.length });
        res.end(pngBuffer);
      } else {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('forbidden');
      }
      return;
    }
    if (req.url === '/html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!doctype html><html><body>fake image</body></html>');
      return;
    }
    if (req.url === '/403') {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('forbidden');
      return;
    }
    if (req.url === '/404') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
      return;
    }
    if (req.url === '/large') {
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      res.write(Buffer.alloc(8192, 1));
      setTimeout(() => res.end(), 20);
      return;
    }
    if (req.url === '/slow') {
      // Intentionally never respond; the controlled downloader timeout must abort this.
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });
  const port = await new Promise((resolve, reject) => {
    fixture.once('error', reject);
    fixture.listen(0, '127.0.0.1', () => resolve(fixture.address().port));
  });
  return { fixture, port };
}

async function startServer(fixturePort) {
  const [apiPort, thumbnailPort, extensionPort] = await Promise.all([freePort(), freePort(), freePort()]);
  const child = spawn(process.execPath, ['backend/src/server.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      EAGLE_API_PORT: String(apiPort),
      EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
      EAGLE_EXTENSION_PORT: String(extensionPort),
      EAGLE_LIBRARY_STATE_FILE: stateFile,
      EAGLE_USER_DATA_DIR: path.join(tempRoot, 'user-data'),
      EAGLE_DOWNLOAD_ALLOW_HOSTS: '127.0.0.1',
      EAGLE_DOWNLOAD_TIMEOUT_MS: '200',
      EAGLE_DOWNLOAD_MAX_BYTES: '4096',
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
  return {
    child,
    api: `http://127.0.0.1:${apiPort}`,
    extension: `http://127.0.0.1:${extensionPort}`,
  };
}

async function stopServer(server) {
  if (!server) return;
  if (server.child.exitCode === null) {
    server.child.kill();
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 3000);
      server.child.once('exit', () => { clearTimeout(timer); resolve(); });
    });
  }
}

function itemDirs(libraryPath) {
  const imagesDir = path.join(libraryPath, 'images');
  if (!fs.existsSync(imagesDir)) return [];
  return fs.readdirSync(imagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('.info'))
    .map((entry) => entry.name);
}

async function postCapture(extension, url, options = {}) {
  const form = new URLSearchParams({
    type: 'image',
    title: options.title || 'Download Capture',
    src: url,
    url,
    website: options.website || 'https://page.test/',
    ...(options.referer ? { referer: options.referer } : {}),
  });
  const response = await fetch(`${extension}/api/item/addURL`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const payload = await response.json();
  return { response, payload };
}

const fixture = await startFixture();
const server = await startServer(fixture.port);
try {
  const created = await (await fetch(`${server.api}/api/library/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Browser Capture Download', savePath: librariesRoot }),
  })).json();
  if (created.status !== 'success') throw new Error(`Library create failed: ${JSON.stringify(created)}`);
  const libraryPath = created.data.path;
  const base = `http://127.0.0.1:${fixture.port}`;

  const ok = await postCapture(server.extension, `${base}/ok.png`, { title: 'OK Download' });
  if (ok.response.status !== 201 || ok.payload.data.ext !== 'png' || ok.payload.data.width !== 10) {
    throw new Error(`OK download failed: ${JSON.stringify(ok.payload)}`);
  }

  const redirect = await postCapture(server.extension, `${base}/redirect`, { title: 'Redirect Download' });
  if (redirect.response.status !== 201 || redirect.payload.data.ext !== 'png') {
    throw new Error(`Redirect download failed: ${JSON.stringify(redirect.payload)}`);
  }

  const referer = await postCapture(server.extension, `${base}/referer`, { title: 'Referer Download', referer: 'https://page.test/' });
  if (referer.response.status !== 201 || referer.payload.data.ext !== 'png') {
    throw new Error(`Referer download failed: ${JSON.stringify(referer.payload)}`);
  }

  const video = await postCapture(server.extension, `${base}/sample.mp4`, { title: 'Video Download' });
  if (video.response.status !== 201 || video.payload.data.ext !== 'mp4' || video.payload.data.mime !== 'video/mp4') {
    throw new Error(`Video download failed: ${JSON.stringify(video.payload)}`);
  }

  const cases = [
    ['/403', 'DOWNLOAD_HTTP_ERROR'],
    ['/404', 'DOWNLOAD_HTTP_ERROR'],
    ['/html', 'CONTENT_TYPE_BLOCKED'],
    ['/large', 'FILE_TOO_LARGE'],
    ['/slow', 'NETWORK_TIMEOUT'],
  ];
  for (const [route, code] of cases) {
    const before = itemDirs(libraryPath).length;
    const result = await postCapture(server.extension, `${base}${route}`, { title: `Failure ${route}` });
    if (result.response.ok || result.payload.code !== code) {
      throw new Error(`Expected ${code} for ${route}: HTTP ${result.response.status} ${JSON.stringify(result.payload)}`);
    }
    if (itemDirs(libraryPath).length !== before) {
      throw new Error(`Failed capture ${route} left an item directory behind`);
    }
  }

  const credentialUrl = `http://user:pass@127.0.0.1:${fixture.port}/ok.png`;
  const credential = await postCapture(server.extension, credentialUrl, { title: 'Credential URL' });
  if (credential.response.ok || credential.payload.code !== 'URL_CREDENTIALS_BLOCKED') {
    throw new Error(`Credential URL was not blocked: HTTP ${credential.response.status} ${JSON.stringify(credential.payload)}`);
  }

  const cache = fs.readFileSync(path.join(libraryPath, 'cache.json'), 'utf8');
  const searchIndex = JSON.parse(fs.readFileSync(path.join(libraryPath, 'search-index.json'), 'utf8'));
  for (const item of [ok.payload.data, redirect.payload.data, referer.payload.data, video.payload.data]) {
    if (!cache.includes(item.id) || !searchIndex.items.some((entry) => entry.id === item.id)) {
      throw new Error(`Cache/search index missing for ${item.id}`);
    }
  }
  console.log(`BROWSER_CAPTURE_DOWNLOAD_OK ${libraryPath}`);
} finally {
  await stopServer(server);
  await new Promise((resolve) => fixture.fixture.close(resolve));
  try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
}
