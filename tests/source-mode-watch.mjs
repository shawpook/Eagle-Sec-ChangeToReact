import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-source-mode-watch-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const sourceRoot = path.join(tempRoot, 'sources');
const stateFile = path.join(tempRoot, 'library-state.json');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourceRoot, { recursive: true });

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

async function waitFor(check, label, timeout = 20000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
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
  if (child.exitCode === null && process.platform === 'win32') {
    await Promise.race([
      new Promise((resolve) => {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        killer.once('exit', resolve);
        killer.once('error', resolve);
      }),
      delay(1000),
    ]);
  }
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
    create: { width: 10, height: 10, channels: 4, background: '#22c55e' },
  }).png().toBuffer();
  fs.writeFileSync(path.join(sourceRoot, 'initial.png'), png);

  await post('/api/library/create', { name: 'Source Mode Watch', savePath: librariesRoot });
  const added = await post('/api/source-roots/addPath', { paths: [sourceRoot] });
  const rootId = Array.isArray(added) ? added[0].id : added.id;
  await post('/api/source-roots/rescan', { id: rootId });

  await waitFor(async () => {
    const roots = await get('/api/source-roots');
    const root = roots.find((entry) => entry.id === rootId);
    return root && root.assetCount === 1;
  }, 'initial index');

  fs.writeFileSync(path.join(sourceRoot, 'added.png'), png);
  await waitFor(async () => {
    const roots = await get('/api/source-roots');
    const root = roots.find((entry) => entry.id === rootId);
    return root && root.assetCount === 2;
  }, 'watcher picks up added file');

  fs.unlinkSync(path.join(sourceRoot, 'added.png'));
  await waitFor(async () => {
    const roots = await get('/api/source-roots');
    const root = roots.find((entry) => entry.id === rootId);
    return root && root.missingCount === 1;
  }, 'watcher marks deleted file missing');

  console.log(`SOURCE_MODE_WATCH_OK ${JSON.stringify({ rootId, sourceRoot, assetCount: 2, missingCount: 1 })}`);
} finally {
  await stop(backend);
  await delay(300);
  try {
    fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch (err) {
    console.warn(`SOURCE_MODE_WATCH_CLEANUP_WARNING ${err.message}`);
  }
}
