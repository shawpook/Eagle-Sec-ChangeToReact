import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-browser-capture-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
fs.mkdirSync(librariesRoot, { recursive: true });

const image = new PNG({ width: 8, height: 6 });
for (let index = 0; index < image.data.length; index += 4) {
  image.data[index] = 90;
  image.data[index + 1] = 140;
  image.data[index + 2] = 230;
  image.data[index + 3] = 255;
}
const smallPng = PNG.sync.write(image);
const smallDataUri = `data:image/png;base64,${smallPng.toString('base64')}`;
const largeDataUri = `data:image/png;base64,${Buffer.alloc(6000, 97).toString('base64')}`;

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

async function startServer() {
  const [apiPort, thumbnailPort, extensionPort, fixturePort] = await Promise.all([freePort(), freePort(), freePort(), freePort()]);
  const fixture = http.createServer((req, res) => {
    if (req.url === '/ok.png') {
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': smallPng.length });
      res.end(smallPng);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  });
  await new Promise((resolve) => fixture.listen(fixturePort, '127.0.0.1', resolve));
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
      EAGLE_CAPTURE_SCREENSHOT_BYTES: '4096',
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
    fixtureUrl: `http://127.0.0.1:${fixturePort}`,
    fixture,
  };
}

async function stopServer(server) {
  if (server.fixture) await new Promise((resolve) => server.fixture.close(resolve));
  if (server.child.exitCode === null) {
    server.child.kill();
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 3000);
      server.child.once('exit', () => { clearTimeout(timer); resolve(); });
    });
  }
}

async function raw(method, url, body, headers = {}) {
  return fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/x-www-form-urlencoded', ...headers } : headers,
    body: body instanceof URLSearchParams ? body : body ? JSON.stringify(body) : undefined,
  });
}

async function successJson(response) {
  const payload = await response.json();
  if (!response.ok || payload.status !== 'success') throw new Error(`HTTP ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

let server = await startServer();
try {
  const root = await successJson(await fetch(`${server.api}/`));
  if (root.data.version !== '4.0.0' || !root.data.buildVersion || root.data.platform !== 'win32') {
    throw new Error(`API root app info mismatch: ${JSON.stringify(root.data)}`);
  }
  const extensionRoot = await (await fetch(`${server.extension}/`)).json();
  if (extensionRoot.showCollectModal !== false || extensionRoot.version !== '4.0.0') {
    throw new Error(`Extension root app info mismatch: ${JSON.stringify(extensionRoot)}`);
  }

  const created = await successJson(await fetch(`${server.api}/api/library/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Browser Capture Protocol', savePath: librariesRoot }),
  }));
  const folder = await successJson(await fetch(`${server.api}/api/folder/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Captured' }),
  }));

  const imageForm = new URLSearchParams({
    type: 'image',
    title: 'Protocol Image',
    src: smallDataUri,
    url: 'https://example.test/protocol-image',
    website: 'https://example.test/protocol-page',
    annotation: 'protocol image annotation',
    star: '4',
    'tags[0]': 'protocol',
    'folderIDs[0]': folder.data.id,
  });
  const image = await successJson(await raw('POST', `${server.extension}/api/item/addFile`, imageForm));
  if (image.data.name !== 'Protocol Image' || image.data.star !== 4 || !image.data.tags.includes('protocol') || !image.data.folders.includes(folder.data.id)) {
    throw new Error(`Protocol image metadata mismatch: ${JSON.stringify(image.data)}`);
  }

  const remoteForm = new URLSearchParams({
    type: 'image',
    title: 'Remote Protocol Image',
    src: `${server.fixtureUrl}/ok.png`,
    url: `${server.fixtureUrl}/ok.png`,
    website: 'https://example.test/remote-page',
    'tags[0]': 'remote',
  });
  const remote = await successJson(await raw('POST', `${server.extension}/api/item/addURL`, remoteForm));
  if (remote.data.ext !== 'png' || remote.data.width !== 8 || remote.data.height !== 6) {
    throw new Error(`Remote protocol image mismatch: ${JSON.stringify(remote.data)}`);
  }

  const bookmarkForm = new URLSearchParams({
    type: 'save-url',
    title: 'Protocol Bookmark',
    url: 'https://example.test/bookmark',
    website: 'https://example.test/page',
    annotation: 'protocol bookmark annotation',
    'tags[0]': 'bookmark',
  });
  const bookmark = await successJson(await raw('POST', `${server.extension}/api/item/addURL`, bookmarkForm));
  if (bookmark.data.ext !== 'url' || bookmark.data.url !== 'https://example.test/bookmark') {
    throw new Error(`Protocol bookmark mismatch: ${JSON.stringify(bookmark.data)}`);
  }

  const videoBookmarkForm = new URLSearchParams({
    type: 'save-url',
    title: 'Protocol Video Bookmark',
    url: 'https://www.youtube.com/watch?v=abc123',
    src: 'https://www.youtube.com/watch?v=abc123',
    medium: 'youtube',
    videoID: 'abc123',
    videoEmbed: 'https://www.youtube-nocookie.com/embed/abc123',
    videoDuration: '123',
    website: 'https://www.youtube.com/',
  });
  const videoBookmark = await successJson(await raw('POST', `${server.extension}/api/item/addURL`, videoBookmarkForm));
  if (
    videoBookmark.data.ext !== 'url' ||
    videoBookmark.data.medium !== 'youtube' ||
    videoBookmark.data.videoID !== 'abc123' ||
    videoBookmark.data.videoEmbed !== 'https://www.youtube-nocookie.com/embed/abc123' ||
    Number(videoBookmark.data.duration) !== 123
  ) {
    throw new Error(`Protocol video bookmark mismatch: ${JSON.stringify(videoBookmark.data)}`);
  }

  const batchForm = new URLSearchParams({
    type: 'import-images',
    title: 'Batch Page',
    url: 'https://example.test/batch-page',
    images: JSON.stringify([
      { src: `${server.fixtureUrl}/ok.png`, title: 'Batch One', tags: ['batch'] },
      { src: `${server.fixtureUrl}/missing.png`, title: 'Batch Two' },
    ]),
  });
  const batch = await successJson(await raw('POST', `${server.extension}/api/item/import-images?sync=true`, batchForm));
  if (batch.data.status !== 'partial' || batch.data.items.length !== 1 || batch.data.errors.length !== 1) {
    throw new Error(`Protocol batch result mismatch: ${JSON.stringify(batch.data)}`);
  }

  const localPathForm = new URLSearchParams({
    type: 'image',
    title: 'Local Path',
    src: 'C:\\Users\\someone\\image.png',
  });
  const localPath = await raw('POST', `${server.extension}/api/item/addFile`, localPathForm);
  const localPathBody = await localPath.json();
  if (localPath.status !== 400 || localPathBody.code !== 'INVALID_CAPTURE_REQUEST') {
    throw new Error(`Local path was not rejected: ${JSON.stringify(localPathBody)}`);
  }

  const screenshotForm = new URLSearchParams({
    type: 'screencapture',
    title: 'Oversized Screenshot',
    src: largeDataUri,
  });
  const screenshot = await raw('POST', `${server.extension}/api/item/addFile`, screenshotForm);
  const screenshotBody = await screenshot.json();
  if (screenshot.status !== 413 || screenshotBody.code !== 'REQUEST_TOO_LARGE') {
    throw new Error(`Screenshot size limit was not enforced: ${JSON.stringify(screenshotBody)}`);
  }

  const disallowedOrigin = await raw('POST', `${server.extension}/api/collect`, new URLSearchParams({ type: 'image', src: smallDataUri, title: 'Origin Test' }), {
    Origin: 'http://evil.example',
  });
  if (disallowedOrigin.status !== 403) {
    throw new Error(`Disallowed extension origin was accepted: HTTP ${disallowedOrigin.status}`);
  }
  const allowedOrigin = await raw('POST', `${server.extension}/api/collect`, new URLSearchParams({ type: 'image', src: smallDataUri, title: 'Chrome Origin' }), {
    Origin: 'chrome-extension://test-extension-id',
  });
  if (allowedOrigin.status !== 201) {
    throw new Error(`Chrome extension origin was rejected: HTTP ${allowedOrigin.status}`);
  }

  const libraryPath = created.data.path;
  for (const item of [image.data, remote.data, bookmark.data, videoBookmark.data, batch.data.items[0]]) {
    const infoDir = path.join(libraryPath, 'images', `${item.id}.info`);
    if (!fs.existsSync(path.join(infoDir, 'metadata.json'))) throw new Error(`Missing metadata for ${item.id}`);
    if (!fs.existsSync(path.join(infoDir, `${item.name}.${item.ext}`))) throw new Error(`Missing original for ${item.id}`);
  }
  const cache = fs.readFileSync(path.join(libraryPath, 'cache.json'), 'utf8');
  const searchIndex = JSON.parse(fs.readFileSync(path.join(libraryPath, 'search-index.json'), 'utf8'));
  for (const item of [image.data, remote.data, bookmark.data, videoBookmark.data, batch.data.items[0]]) {
    if (!cache.includes(item.id)) throw new Error(`Cache missing ${item.id}`);
    if (!searchIndex.items.some((entry) => entry.id === item.id)) throw new Error(`Search index missing ${item.id}`);
  }

  await stopServer(server);
  server = await startServer();
  const restored = await successJson(await fetch(`${server.api}/api/library/current?includeItems=true`));
  const restoredItems = restored.data.items;
  for (const expected of [image.data, remote.data, bookmark.data, batch.data.items[0]]) {
    const found = restoredItems.find((entry) => entry.id === expected.id);
    if (!found || found.annotation !== expected.annotation || found.url !== expected.url) {
      throw new Error(`Restart did not preserve ${expected.id}: ${JSON.stringify(found)}`);
    }
  }
  console.log(`BROWSER_CAPTURE_PROTOCOL_OK ${libraryPath}`);
} finally {
  await stopServer(server);
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
