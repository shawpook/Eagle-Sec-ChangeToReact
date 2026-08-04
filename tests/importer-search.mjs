import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadLibrary } from '../backend/src/library-store.js';
import { exportItem, importFile } from '../backend/src/importer.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-importer-search-'));
const tempLib = path.join(tempRoot, 'importer-test.library');
const tempExport = path.join(tempRoot, 'importer-export');
const stateFile = path.join(tempRoot, 'library-state.json');
const sourceFile = path.join(
  projectRoot,
  'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png'
);

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
    env: {
      ...process.env,
      EAGLE_API_PORT: String(apiPort),
      EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
      EAGLE_EXTENSION_PORT: String(extensionPort),
      EAGLE_LIBRARY_STATE_FILE: stateFile,
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

fs.mkdirSync(tempLib, { recursive: true });
fs.writeFileSync(
  path.join(tempLib, 'metadata.json'),
  JSON.stringify({ applicationVersion: '4.0.0', folders: [], smartFolders: [], quickAccess: [], tagsGroups: [], modificationTime: Date.now() }),
  'utf8'
);
fs.writeFileSync(path.join(tempLib, 'tags.json'), JSON.stringify({ historyTags: [], starredTags: [] }), 'utf8');
fs.writeFileSync(path.join(tempLib, 'saved-filters.json'), '[]', 'utf8');

const library = loadLibrary(tempLib);
const item = importFile(library, sourceFile, { name: 'Imported Welcome', tags: ['imported'], star: 5 });

if (!item.id || !item.name || item.ext !== 'png') throw new Error('importFile returned invalid item');
if (!fs.existsSync(path.join(tempLib, 'images', `${item.id}.info`, `${item.name}.png`))) {
  throw new Error('imported original file missing');
}
if (!fs.existsSync(path.join(tempLib, 'images', `${item.id}.info`, `${item.name}_thumbnail.png`))) {
  throw new Error('imported thumbnail missing');
}

const exported = exportItem(library, item, tempExport);
if (!exported || !fs.existsSync(exported)) throw new Error('exported file missing');

let server;
const configuredApiBase = process.env.EAGLE_API_URL;
try {
  server = configuredApiBase ? null : await startServer();
  const apiBase = configuredApiBase || server.base;
  const searchRes = await fetch(`${apiBase}/api/item/search?keyword=Welcome`);
  if (!searchRes.ok) throw new Error(`search HTTP ${searchRes.status}`);
  const searchBody = await searchRes.json();
  if (searchBody.status !== 'success' || searchBody.data.length === 0) throw new Error('search returned no items');

  const v2Res = await fetch(`${apiBase}/api/v2/item/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags: ['UI'], limit: 5 }),
  });
  const v2Body = await v2Res.json();
  if (v2Body.status !== 'success' || !Array.isArray(v2Body.data.data)) throw new Error('v2 query filter failed');
  console.log(`Importer/search passed: imported ${item.name}, search ${searchBody.data.length} items`);
} finally {
  if (server) await stopServer(server);
}
