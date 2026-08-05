import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nodeExecutable = process.execPath;
const electronExecutable = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-browser-capture-ui-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
fs.mkdirSync(librariesRoot, { recursive: true });

const png = new PNG({ width: 16, height: 10 });
for (let index = 0; index < png.data.length; index += 4) {
  png.data[index] = 120;
  png.data[index + 1] = 80;
  png.data[index + 2] = 220;
  png.data[index + 3] = 255;
}
const pngBuffer = PNG.sync.write(png);

async function freePort() {
  while (true) {
    const port = await new Promise((resolve, reject) => {
      const server = http.createServer();
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        server.close(() => resolve(address.port));
      });
    });
    if (port >= 12000) return port;
  }
}

async function startFixture() {
  const fixture = http.createServer((req, res) => {
    if (req.url === '/capture.png') {
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': pngBuffer.length });
      res.end(pngBuffer);
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

function spawnLogged(command, args, env) {
  const child = spawn(command, args, { cwd: projectRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  return { child, output: () => output };
}

async function waitFor(check, label, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error(`${label} timeout`);
}

async function stop(processInfo) {
  if (!processInfo || processInfo.child.exitCode !== null) return;
  processInfo.child.kill();
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 3000);
    processInfo.child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}

const fixture = await startFixture();
const [apiPort, thumbnailPort, extensionPort, vitePort] = await Promise.all([freePort(), freePort(), freePort(), freePort()]);
const baseEnv = { ...process.env };
delete baseEnv.ELECTRON_RUN_AS_NODE;
if (baseEnv.NODE_OPTIONS) {
  baseEnv.NODE_OPTIONS = baseEnv.NODE_OPTIONS.replace(/(?:^|\s)--use-system-ca(?=\s|$)/g, ' ').trim();
  if (!baseEnv.NODE_OPTIONS) delete baseEnv.NODE_OPTIONS;
}
const backendEnv = {
  ...baseEnv,
  EAGLE_API_PORT: String(apiPort),
  EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
  EAGLE_EXTENSION_PORT: String(extensionPort),
  EAGLE_LIBRARY_STATE_FILE: stateFile,
  EAGLE_USER_DATA_DIR: path.join(tempRoot, 'user-data'),
  EAGLE_DOWNLOAD_ALLOW_HOSTS: '127.0.0.1',
};
const backend = spawnLogged(nodeExecutable, ['backend/src/server.js'], backendEnv);
const vite = spawnLogged(nodeExecutable, [
  'node_modules/vite/bin/vite.js',
  '--config',
  'frontend/vite.preview.config.mjs',
  '--port',
  String(vitePort),
  '--strictPort',
], {
  ...baseEnv,
  EAGLE_API_URL: `http://localhost:${apiPort}`,
  EAGLE_EXTENSION_URL: `http://localhost:${extensionPort}`,
  EAGLE_THUMBNAIL_URL: `http://localhost:${thumbnailPort}`,
});
let electron;
let restartedBackend;
try {
  await waitFor(() => backend.output().includes(`localhost:${apiPort}`), 'backend startup');
  await waitFor(async () => {
    try {
      return (await fetch(`http://127.0.0.1:${vitePort}/src/app/index.html`)).ok;
    } catch (err) {
      return false;
    }
  }, 'Vite startup');
  const inspectorResponse = await fetch(`http://127.0.0.1:${vitePort}/src/app/js/directives/inspector.html`);
  const inspectorHtml = await inspectorResponse.text();
  if (!inspectorResponse.ok || inspectorHtml.includes('palettes.length <= 1') || !inspectorHtml.includes('palettes.length === 0')) {
    throw new Error('Vite inspector response still hides valid single-color palettes');
  }

  const createResponse = await fetch(`http://127.0.0.1:${apiPort}/api/library/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Browser Capture UI', savePath: librariesRoot }),
  });
  const created = await createResponse.json();
  if (!createResponse.ok || created.status !== 'success') throw new Error(`Library create failed: ${JSON.stringify(created)}`);
  const folderResponse = await fetch(`http://127.0.0.1:${apiPort}/api/folder/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Captured UI' }),
  });
  const folder = await folderResponse.json();
  if (!folderResponse.ok || folder.status !== 'success') throw new Error(`Folder create failed: ${JSON.stringify(folder)}`);
  const startupSource = path.join(tempRoot, 'Startup Palette.png');
  fs.writeFileSync(startupSource, pngBuffer);
  const startupImportResponse = await fetch(`http://127.0.0.1:${apiPort}/api/item/addFromPath`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: startupSource }),
  });
  const startupImport = await startupImportResponse.json();
  if (!startupImportResponse.ok || startupImport.status !== 'success' || Array.isArray(startupImport.data.palettes)) {
    throw new Error(`Startup palette fixture import failed: ${JSON.stringify(startupImport)}`);
  }

  electron = spawnLogged(electronExecutable, ['electron/main.cjs', '--smoke-browser-capture-ui'], {
    ...baseEnv,
    EAGLE_API_URL: `http://localhost:${apiPort}`,
    EAGLE_THUMBNAIL_URL: `http://localhost:${thumbnailPort}`,
    EAGLE_EXTENSION_URL: `http://localhost:${extensionPort}`,
    EAGLE_PREVIEW_URL: `http://localhost:${vitePort}/src/app/index.html`,
    EAGLE_CAPTURE_IMAGE_URL: `http://127.0.0.1:${fixture.port}/capture.png`,
    EAGLE_CAPTURE_FOLDER_ID: folder.data.id,
    EAGLE_ELECTRON_USER_DATA_DIR: path.join(tempRoot, 'electron-user-data'),
  });
  const output = await waitFor(() => {
    const text = electron.output();
    if (text.includes('BROWSER_CAPTURE_UI_OK')) return text;
    if (text.includes('BROWSER_CAPTURE_UI_FAIL') || text.includes('BROWSER_CAPTURE_UI_ERROR') || text.includes('BROWSER_CAPTURE_UI_SMOKE_TIMEOUT') || electron.child.exitCode !== null) {
      throw new Error(`Browser capture UI smoke failed:\n${text}`);
    }
    return null;
  }, 'browser capture UI smoke', 80000);
  const line = output.match(/BROWSER_CAPTURE_UI_OK[^\r\n]*/)?.[0];
  if (!line) throw new Error(`Missing UI success output:\n${output}`);
  const result = JSON.parse(line.slice(line.indexOf('{')));
  console.log(line);
  await stop(electron);
  electron = null;

  const libraryPath = created.data.path;
  const infoDir = path.join(libraryPath, 'images', `${result.itemId}.info`);
  if (!fs.existsSync(path.join(infoDir, 'Browser Capture UI.png')) || !fs.existsSync(path.join(infoDir, 'Browser Capture UI_thumbnail.png')) || !fs.existsSync(path.join(infoDir, 'metadata.json'))) {
    throw new Error(`UI capture disk files incomplete: ${infoDir}`);
  }
  const analyzedItem = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${apiPort}/api/item/info?id=${encodeURIComponent(result.itemId)}`);
    const payload = await response.json();
    return response.ok && Array.isArray(payload.data?.palettes) && payload.data.palettes.length > 0 ? payload.data : null;
  }, 'captured item palette analysis');
  if (analyzedItem.palettes.length !== 1) throw new Error(`single-color palette mismatch: ${JSON.stringify(analyzedItem.palettes)}`);
  const startupAnalyzedItem = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${apiPort}/api/item/info?id=${encodeURIComponent(startupImport.data.id)}`);
    const payload = await response.json();
    return response.ok && Array.isArray(payload.data?.palettes) && payload.data.palettes.length > 0 ? payload.data : null;
  }, 'startup palette backfill');
  if (startupAnalyzedItem.palettes.length !== 1) throw new Error(`startup palette mismatch: ${JSON.stringify(startupAnalyzedItem.palettes)}`);
  const cache = fs.readFileSync(path.join(libraryPath, 'cache.json'), 'utf8');
  const searchIndex = JSON.parse(fs.readFileSync(path.join(libraryPath, 'search-index.json'), 'utf8'));
  if (!cache.includes(result.itemId) || !searchIndex.items.some((entry) => entry.id === result.itemId && entry.name === 'Browser Capture UI')) {
    throw new Error('UI capture cache/search index mismatch');
  }

  await stop(backend);
  restartedBackend = spawnLogged(nodeExecutable, ['backend/src/server.js'], backendEnv);
  await waitFor(() => restartedBackend.output().includes(`localhost:${apiPort}`), 'restarted backend');
  const restoredResponse = await fetch(`http://127.0.0.1:${apiPort}/api/library/current?includeItems=true`);
  const restored = await restoredResponse.json();
  if (!restoredResponse.ok || restored.status !== 'success') throw new Error(`Restart verification failed: ${JSON.stringify(restored)}`);
  const item = restored.data.items.find((entry) => entry.id === result.itemId);
  if (!item || item.name !== 'Browser Capture UI' || !item.tags.includes('capture-ui') || !item.folders.includes(folder.data.id)) {
    throw new Error(`Restarted UI capture item mismatch: ${JSON.stringify(item)}`);
  }
  console.log(`BROWSER_CAPTURE_UI_RESTART_OK ${JSON.stringify({ library: libraryPath, itemId: item.id })}`);
} finally {
  await stop(electron);
  await stop(restartedBackend);
  await stop(vite);
  await stop(backend);
  await new Promise((resolve) => fixture.fixture.close(resolve));
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
