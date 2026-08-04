import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-item-api-compat-'));
const stateFile = path.join(tempRoot, 'library-state.json');
let backend;

async function freePort() {
  while (true) {
    const port = await new Promise((resolve, reject) => {
      const server = http.createServer();
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const value = server.address().port;
        server.close(() => resolve(value));
      });
    });
    if (port >= 12_000) return port;
  }
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

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 3000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function startBackend(env) {
  const child = spawn(process.execPath, ['backend/src/server.js'], {
    cwd: projectRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  return { child, output: () => output };
}

async function rawRequest(base, route, body) {
  const response = await fetch(`${base}${route}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, payload: await response.json() };
}

async function request(base, route, body) {
  const { response, payload } = await rawRequest(base, route, body);
  if (!response.ok || payload.status !== 'success') {
    throw new Error(`${route}: HTTP ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload.data;
}

try {
  const [apiPort, thumbnailPort, extensionPort] = await Promise.all([freePort(), freePort(), freePort()]);
  const env = {
    ...process.env,
    EAGLE_API_PORT: String(apiPort),
    EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
    EAGLE_EXTENSION_PORT: String(extensionPort),
    EAGLE_LIBRARY_STATE_FILE: stateFile,
    EAGLE_USER_DATA_DIR: path.join(tempRoot, 'user-data'),
  };
  let server = startBackend(env);
  backend = server.child;
  await waitFor(() => server.output().includes(`localhost:${apiPort}`), 'backend startup');

  const base = `http://127.0.0.1:${apiPort}`;
  const librariesRoot = path.join(tempRoot, 'libraries');
  fs.mkdirSync(librariesRoot, { recursive: true });
  const fixture = path.join(tempRoot, 'fixture.png');
  fs.copyFileSync(path.join(projectRoot, 'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png'), fixture);

  const library = await request(base, '/api/library/create', { name: 'Item API Compatibility', savePath: librariesRoot });
  const imported = await request(base, '/api/item/addFromPaths', {
    images: [
      { path: fixture, name: 'Target A' },
      { path: fixture, name: 'Target B' },
    ],
  });
  if (!Array.isArray(imported) || imported.length !== 2) throw new Error(`fixture import failed: ${JSON.stringify(imported)}`);
  const [targetA, targetB] = imported;

  await request(base, '/api/item/batchUpdate', {
    ids: [targetA.id],
    patch: { id: targetB.id, itemID: targetB.id, annotation: 'only-target-a' },
  });
  let items = await request(base, '/api/item/list');
  const afterBatchA = items.find((item) => item.id === targetA.id);
  const afterBatchB = items.find((item) => item.id === targetB.id);
  if (afterBatchA?.annotation !== 'only-target-a' || afterBatchB?.annotation === 'only-target-a') {
    throw new Error(`batchUpdate target isolation failed: ${JSON.stringify({ afterBatchA, afterBatchB })}`);
  }

  const trashResult = await request(base, '/api/item/moveToTrash', { itemIds: [targetA.id, targetB.id] });
  if (trashResult !== true) throw new Error(`V1 trash response compatibility failed: ${JSON.stringify(trashResult)}`);
  items = await request(base, '/api/item/list');
  if (![targetA.id, targetB.id].every((id) => items.find((item) => item.id === id)?.isDeleted)) {
    throw new Error('itemIds trash compatibility failed');
  }
  const restoreResult = await request(base, '/api/item/restore', { itemIds: [targetA.id, targetB.id] });
  if (restoreResult !== true) throw new Error(`V1 restore response compatibility failed: ${JSON.stringify(restoreResult)}`);

  const oldOriginal = path.join(library.path, 'images', `${targetA.id}.info`, `${targetA.name}.${targetA.ext}`);
  const newOriginal = path.join(library.path, 'images', `${targetA.id}.info`, `${targetA.name}.webp`);
  if (!fs.existsSync(oldOriginal)) throw new Error(`original fixture missing: ${oldOriginal}`);
  const missingExtensionTarget = await rawRequest(base, '/api/v2/item/update', { id: targetA.id, ext: 'webp' });
  if (missingExtensionTarget.response.status !== 409 || missingExtensionTarget.payload.code !== 'ITEM_EXTENSION_TARGET_MISSING' || !fs.existsSync(oldOriginal)) {
    throw new Error(`missing extension target boundary failed: ${JSON.stringify(missingExtensionTarget.payload)}`);
  }
  fs.renameSync(oldOriginal, newOriginal);
  const v2Updated = await request(base, '/api/v2/item/update', {
    id: targetA.id,
    ext: 'webp',
    width: 801,
    height: 602,
    noThumbnail: true,
    noPreview: true,
  });
  if (v2Updated.ext !== 'webp' || v2Updated.width !== 801 || v2Updated.height !== 602 || !v2Updated.noThumbnail || !v2Updated.noPreview) {
    throw new Error(`V2 item update contract failed: ${JSON.stringify(v2Updated)}`);
  }
  if (fs.existsSync(oldOriginal) || !fs.existsSync(newOriginal)) throw new Error('V2 extension update did not preserve the prepared physical original');

  const typeMismatch = await request(base, '/api/v2/item/update', {
    id: targetA.id,
    width: '999',
    height: '998',
    noThumbnail: 'false',
    noPreview: 0,
  });
  if (typeMismatch.width !== 801 || typeMismatch.height !== 602 || !typeMismatch.noThumbnail || !typeMismatch.noPreview) {
    throw new Error(`V2 type mismatch should be ignored: ${JSON.stringify(typeMismatch)}`);
  }

  const invalidExtension = await rawRequest(base, '/api/v2/item/update', { id: targetA.id, ext: '../png' });
  if (invalidExtension.response.status !== 400 || invalidExtension.payload.code !== 'INVALID_ITEM_EXTENSION' || !fs.existsSync(newOriginal)) {
    throw new Error(`invalid extension boundary failed: ${JSON.stringify(invalidExtension.payload)}`);
  }
  const conflictPath = path.join(library.path, 'images', `${targetA.id}.info`, `${targetA.name}.gif`);
  fs.writeFileSync(conflictPath, Buffer.from('conflict'));
  const extensionConflict = await rawRequest(base, '/api/v2/item/update', { id: targetA.id, ext: 'gif' });
  if (extensionConflict.response.status !== 409 || extensionConflict.payload.code !== 'ITEM_RENAME_CONFLICT' || !fs.existsSync(newOriginal)) {
    throw new Error(`extension conflict rollback failed: ${JSON.stringify(extensionConflict.payload)}`);
  }

  const v1Updated = await request(base, '/api/item/update', {
    id: targetB.id,
    ext: 'gif',
    width: 999,
    height: 998,
    noThumbnail: true,
    noPreview: true,
    annotation: 'v1-safe-field',
  });
  if (v1Updated.ext !== targetB.ext || v1Updated.width !== targetB.width || v1Updated.height !== targetB.height || v1Updated.annotation !== 'v1-safe-field') {
    throw new Error(`V1 field boundary changed unexpectedly: ${JSON.stringify(v1Updated)}`);
  }

  await stop(backend);
  server = startBackend(env);
  backend = server.child;
  await waitFor(() => server.output().includes(`localhost:${apiPort}`), 'restarted backend');
  const restoredLibrary = await request(base, '/api/library/current?includeItems=true');
  const restoredA = restoredLibrary.items.find((item) => item.id === targetA.id);
  const restoredB = restoredLibrary.items.find((item) => item.id === targetB.id);
  const restartedMetadata = JSON.parse(fs.readFileSync(path.join(library.path, 'images', `${targetA.id}.info`, 'metadata.json'), 'utf8'));
  const cacheText = fs.readFileSync(path.join(library.path, 'cache.json'), 'utf8');
  const searchIndex = JSON.parse(fs.readFileSync(path.join(library.path, 'search-index.json'), 'utf8'));
  if (restoredA?.ext !== 'webp' || restoredA.width !== 801 || restoredA.height !== 602 || restoredA.isDeleted || restoredB?.annotation !== 'v1-safe-field') {
    throw new Error(`restart compatibility state failed: ${JSON.stringify({ restoredA, restoredB })}`);
  }
  if (restartedMetadata.ext !== 'webp' || !cacheText.includes('"ext":"webp"') || !searchIndex.items.some((item) => item.id === targetA.id)) {
    throw new Error('V2 compatibility update was not persisted consistently');
  }

  console.log(`ITEM_API_COMPATIBILITY_OK ${JSON.stringify({ targetA: targetA.id, targetB: targetB.id, v2Ext: v2Updated.ext })}`);
} finally {
  await stop(backend);
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
