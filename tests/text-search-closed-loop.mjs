import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-text-search-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const sourcesRoot = path.join(tempRoot, 'sources');
const stateFile = path.join(tempRoot, 'library-state.json');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourcesRoot, { recursive: true });

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
      EAGLE_THUMBNAIL_CONCURRENCY: '3',
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

const alphaTxt = path.join(sourcesRoot, 'alpha.txt');
const betaMd = path.join(sourcesRoot, 'beta.md');
const binaryTxt = path.join(sourcesRoot, 'binary.txt');
const longTxt = path.join(sourcesRoot, 'long.txt');
fs.writeFileSync(alphaTxt, 'needle phrase\nsecond line\n', 'utf8');
fs.writeFileSync(betaMd, '# Beta\n\nother keyword\n', 'utf8');
fs.writeFileSync(binaryTxt, Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(64, 0)]));
fs.writeFileSync(longTxt, `${'A'.repeat(30_000)}needle-tail`, 'utf8');

let server = await startServer();
try {
  const created = await post(server.base, '/api/library/create', { name: 'Text Search', savePath: librariesRoot });
  if (created.response.status !== 201) throw new Error(`library create failed: ${JSON.stringify(created.body)}`);
  const imported = await post(server.base, '/api/item/addFromPaths', { paths: [alphaTxt, betaMd, binaryTxt, longTxt] });
  if (imported.response.status !== 201 || imported.body.data.length !== 4) {
    throw new Error(`fixture import failed: ${JSON.stringify(imported.body)}`);
  }
  const items = new Map(imported.body.data.map((item) => [item.name, item]));

  const alphaSearch = await request(server.base, '/api/item/search?keyword=needle');
  if (!alphaSearch.body.data.some((item) => item.id === items.get('alpha').id)) {
    throw new Error('text keyword search did not find alpha');
  }

  const betaQuery = await post(server.base, '/api/v2/item/query', { keyword: 'other' });
  if (!betaQuery.body.data.data.some((item) => item.id === items.get('beta').id)) {
    throw new Error('v2 text keyword query did not find beta');
  }

  const binarySearch = await request(server.base, '/api/item/search?keyword=binary');
  if (!binarySearch.body.data.some((item) => item.id === items.get('binary').id)) {
    throw new Error('binary text item was not searchable by name');
  }

  const longSearch = await request(server.base, '/api/item/search?keyword=needle-tail');
  if (longSearch.body.data.some((item) => item.id === items.get('long').id)) {
    throw new Error('text search index exceeded the per-item character limit');
  }

  const indexResponse = await request(server.base, '/api/search/index');
  const index = indexResponse.body.data;
  if (index.version !== 2 || !Array.isArray(index.items)) throw new Error('search index version mismatch');
  const alphaEntry = index.items.find((entry) => entry.id === items.get('alpha').id);
  const binaryEntry = index.items.find((entry) => entry.id === items.get('binary').id);
  const longEntry = index.items.find((entry) => entry.id === items.get('long').id);
  if (!alphaEntry.textContent.includes('needle phrase') || binaryEntry.textContent !== '' || longEntry.textContent.length > 20_000) {
    throw new Error('search index text content mismatch');
  }

  const alphaDetail = (await request(server.base, `/api/v2/item/textDetail?id=${encodeURIComponent(items.get('alpha').id)}`)).body.data;
  await post(server.base, '/api/v2/item/textSave', {
    id: items.get('alpha').id,
    content: 'updated needle2\n',
    expectedMtimeMs: alphaDetail.mtimeMs,
  });
  const updatedSearch = await request(server.base, '/api/item/search?keyword=needle2');
  if (!updatedSearch.body.data.some((item) => item.id === items.get('alpha').id)) {
    throw new Error('text save did not update search index');
  }
  const oldSearch = await request(server.base, '/api/item/search?keyword=needle%20phrase');
  if (oldSearch.body.data.some((item) => item.id === items.get('alpha').id)) {
    throw new Error('stale text content remained searchable after save');
  }

  await post(server.base, '/api/v2/item/moveToTrash', { ids: [items.get('alpha').id] });
  const deletedQuery = await post(server.base, '/api/v2/item/query', { keyword: 'needle2', isDeleted: false });
  if (deletedQuery.body.data.data.some((item) => item.id === items.get('alpha').id)) {
    throw new Error('deleted text item remained searchable');
  }

  const rebuild = await post(server.base, '/api/v2/search/rebuild', {});
  if (rebuild.response.status !== 200 || rebuild.body.data.count !== 4) throw new Error('search rebuild failed');
  const indexFile = JSON.parse(fs.readFileSync(path.join(librariesRoot, 'Text Search.library', 'search-index.json'), 'utf8'));
  if (indexFile.version !== 2 || !indexFile.items.some((entry) => entry.id === items.get('beta').id && entry.textContent.includes('other keyword'))) {
    throw new Error('persisted search index content mismatch');
  }
} finally {
  await stopServer(server);
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log('TEXT_SEARCH_CLOSED_LOOP_OK');
