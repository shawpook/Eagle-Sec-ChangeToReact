import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-source-mode-api-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const sourceRoot = path.join(tempRoot, 'sources');
const stateFile = path.join(tempRoot, 'library-state.json');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(path.join(sourceRoot, 'nested'), { recursive: true });

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

function spawnLogged(command, args, env) {
  const child = spawn(command, args, { cwd: projectRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  return { child, output: () => output };
}

async function waitFor(check, label, timeout = 30000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${label} timeout${lastError ? `: ${lastError.message}` : ''}`);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function stop(processInfo) {
  const child = processInfo && processInfo.child;
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill();
  await Promise.race([exited, delay(1000)]);
  if (child.exitCode === null) {
    if (process.platform === 'win32') {
      const killed = new Promise((resolve) => {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        killer.once('exit', resolve);
        killer.once('error', resolve);
      });
      await Promise.race([killed, delay(1000)]);
    } else {
      try {
        process.kill(child.pid, 'SIGKILL');
      } catch (err) {
        // Process may have exited between the check and the signal.
      }
    }
    await delay(200);
  }
}

async function forceKill(processInfo) {
  const child = processInfo && processInfo.child;
  if (!child || !child.pid) return;
  try {
    child.kill();
  } catch (err) {
    // Already exited.
  }
  if (process.platform !== 'win32') return;
  await Promise.race([
    new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      killer.once('exit', resolve);
      killer.once('error', resolve);
    }),
    delay(1000),
  ]);
}

async function request(port, route, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (err) {
    payload = { status: 'error', message: text };
  }
  return { response, payload };
}

const [apiPort, thumbnailPort, extensionPort] = await Promise.all([freePort(), freePort(), freePort()]);
const env = {
  ...process.env,
  EAGLE_API_PORT: String(apiPort),
  EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
  EAGLE_EXTENSION_PORT: String(extensionPort),
  EAGLE_LIBRARY_STATE_FILE: stateFile,
  EAGLE_USER_DATA_DIR: path.join(tempRoot, 'user-data'),
};

const backend = spawnLogged(process.execPath, ['backend/src/server.js'], env);

try {
  await waitFor(() => backend.output().includes(`localhost:${apiPort}`), 'backend startup');

  const post = async (route, body) => {
    const { response, payload } = await request(apiPort, route, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!response.ok || payload.status !== 'success') {
      throw new Error(`${route} failed: ${JSON.stringify(payload)}`);
    }
    return payload.data;
  };
  const get = async (route) => {
    const { response, payload } = await request(apiPort, route);
    if (!response.ok || payload.status !== 'success') {
      throw new Error(`${route} failed: ${JSON.stringify(payload)}`);
    }
    return payload.data;
  };

  const png = await sharp({
    create: { width: 12, height: 8, channels: 4, background: '#d34f7a' },
  }).png().toBuffer();
  fs.writeFileSync(path.join(sourceRoot, 'sample.png'), png);
  fs.writeFileSync(path.join(sourceRoot, 'notes.txt'), 'source mode smoke');
  fs.writeFileSync(path.join(sourceRoot, 'nested', 'nested.png'), png);

  const library = await post('/api/library/create', { name: 'Source Mode API', savePath: librariesRoot });
  const added = await post('/api/source-roots/addPath', { paths: [sourceRoot] });
  const rootId = Array.isArray(added) ? added[0].id : added.id;
  await post('/api/source-roots/rescan', { id: rootId });

  const roots = await get('/api/source-roots');
  const root = roots.find((entry) => entry.id === rootId);
  if (!root || root.assetCount !== 3) {
    throw new Error(`Unexpected source root state: ${JSON.stringify(root)}`);
  }
  if (!root.directories.some((dir) => dir.relativePath === 'nested')) {
    throw new Error(`nested directory missing: ${JSON.stringify(root.directories)}`);
  }

  const assets = await get(`/api/source-assets?sourceRootId=${encodeURIComponent(rootId)}&relativePath=.`);
  if (assets.total !== 2) {
    throw new Error(`Expected 2 direct assets, got ${assets.total}`);
  }
  const image = assets.items.find((entry) => entry.ext === 'png');
  if (!image) throw new Error('PNG asset missing');

  const virtual = await get(`/api/source-mode/virtual-library?sourceRootId=${encodeURIComponent(rootId)}`);
  if (virtual.items.length !== 3 || virtual.folders.length !== 1) {
    throw new Error(`Unexpected virtual library: ${JSON.stringify({ items: virtual.items.length, folders: virtual.folders.length })}`);
  }
  if (!fs.existsSync(virtual.cachePath)) {
    throw new Error('Virtual library cache file missing');
  }

  const thumbnailResponse = await fetch(`http://127.0.0.1:${apiPort}/api/source-assets/${image.id}/thumbnail`);
  if (!thumbnailResponse.ok) {
    throw new Error(`Thumbnail failed: HTTP ${thumbnailResponse.status}`);
  }
  const thumbnailType = thumbnailResponse.headers.get('content-type') || '';
  if (!thumbnailType.includes('image/png')) {
    throw new Error(`Thumbnail content type mismatch: ${thumbnailType}`);
  }

  await post('/api/source-mode/state', {
    mode: 'source',
    selectedSourceRootId: rootId,
    selectedRelativePath: 'nested',
  });
  const state = await get('/api/source-mode/state');
  if (state.mode !== 'source' || state.selectedSourceRootId !== rootId || state.selectedRelativePath !== 'nested') {
    throw new Error(`Unexpected state: ${JSON.stringify(state)}`);
  }

  const removed = await post('/api/source-roots/remove', { id: rootId });
  if (!removed.removed) throw new Error('remove source root returned false');
  const afterRemove = await get('/api/source-roots');
  if (afterRemove.some((entry) => entry.id === rootId)) {
    throw new Error('source root still present after remove');
  }

  console.log(`SOURCE_MODE_API_OK ${JSON.stringify({ library: library.path, sourceRoot, assets: assets.total })}`);
} finally {
  await stop(backend);
  await forceKill(backend);
  await delay(500);
  try {
    fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch (err) {
    console.warn(`SOURCE_MODE_CLEANUP_WARNING ${err.message}`);
  }
}
