import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-collect-save-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
fs.mkdirSync(librariesRoot, { recursive: true });

const image = new PNG({ width: 12, height: 8 });
for (let index = 0; index < image.data.length; index += 4) {
  image.data[index] = 44;
  image.data[index + 1] = 130;
  image.data[index + 2] = 220;
  image.data[index + 3] = 255;
}
const dataUri = `data:image/png;base64,${PNG.sync.write(image).toString('base64')}`;

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
    env: { ...process.env, EAGLE_API_PORT: String(apiPort), EAGLE_THUMBNAIL_PORT: String(thumbnailPort), EAGLE_EXTENSION_PORT: String(extensionPort), EAGLE_LIBRARY_STATE_FILE: stateFile },
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
  return { child, api: `http://localhost:${apiPort}`, extension: `http://localhost:${extensionPort}` };
}
async function stopServer(server) {
  if (server.child.exitCode !== null) return;
  server.child.kill();
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 3000);
    server.child.once('exit', () => { clearTimeout(timeout); resolve(); });
  });
}
async function json(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok || body.status !== 'success') throw new Error(`${url}: HTTP ${response.status} ${JSON.stringify(body)}`);
  return body.data;
}

let server = await startServer();
const created = await json(`${server.api}/api/library/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Collect Save', savePath: librariesRoot }) });
const folder = await json(`${server.api}/api/folder/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Collected' }) });
const form = new URLSearchParams();
form.set('type', 'image');
form.set('version', 'eagle-collect-window');
form.set('src', dataUri);
form.set('title', 'Collected Probe');
form.set('annotation', 'saved by collect window');
form.set('url', 'https://example.com/probe');
form.set('tags[0]', 'collect');
form.set('tags[1]', 'probe');
form.set('folderIDs[0]', folder.id);
form.set('star', '4');
const item = await json(`${server.extension}/api/item/addFile`, { method: 'POST', body: form });
if (item.name !== 'Collected Probe' || item.ext !== 'png' || item.width !== 12 || item.height !== 8 || item.star !== 4) throw new Error(`collect metadata mismatch: ${JSON.stringify(item)}`);
if (!item.tags.includes('collect') || !item.folders.includes(folder.id)) throw new Error('collect tags/folders mismatch');
const infoDir = path.join(created.path, 'images', `${item.id}.info`);
if (!fs.existsSync(path.join(infoDir, 'Collected Probe.png')) || !fs.existsSync(path.join(infoDir, 'Collected Probe_thumbnail.png')) || !fs.existsSync(path.join(infoDir, 'metadata.json'))) throw new Error('collect files are incomplete');

const bookmarkForm = new URLSearchParams();
bookmarkForm.set('type', 'save-url');
bookmarkForm.set('url', 'https://example.com/bookmark');
bookmarkForm.set('title', 'Collected Bookmark');
bookmarkForm.set('annotation', 'saved bookmark');
bookmarkForm.set('tags[0]', 'bookmark');
bookmarkForm.set('folderIDs[0]', folder.id);
const bookmark = await json(`${server.extension}/api/item/addURL`, { method: 'POST', body: bookmarkForm });
if (bookmark.name !== 'Collected Bookmark' || bookmark.ext !== 'url' || bookmark.url !== 'https://example.com/bookmark') throw new Error(`bookmark metadata mismatch: ${JSON.stringify(bookmark)}`);
const bookmarkFile = path.join(created.path, 'images', `${bookmark.id}.info`, 'Collected Bookmark.url');
if (!fs.existsSync(bookmarkFile) || !fs.readFileSync(bookmarkFile, 'utf8').includes('URL=https://example.com/bookmark')) throw new Error('bookmark file is incomplete');
await stopServer(server);

server = await startServer();
const restored = await json(`${server.api}/api/library/current?includeItems=true`);
const restoredItem = restored.items.find((entry) => entry.id === item.id);
if (!restoredItem || restoredItem.annotation !== 'saved by collect window' || !restoredItem.folders.includes(folder.id)) throw new Error('collect item did not survive restart');
const restoredBookmark = restored.items.find((entry) => entry.id === bookmark.id);
if (!restoredBookmark || restoredBookmark.annotation !== 'saved bookmark' || !restoredBookmark.folders.includes(folder.id)) throw new Error('bookmark did not survive restart');
await stopServer(server);

console.log(`COLLECT_SAVE_CLOSED_LOOP_OK ${created.path}`);
