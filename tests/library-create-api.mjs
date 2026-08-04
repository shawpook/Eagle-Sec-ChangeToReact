import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-library-api-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'state', 'library-state.json');
fs.mkdirSync(librariesRoot, { recursive: true });

async function getFreePort() {
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
  const [apiPort, thumbnailPort, extensionPort] = await Promise.all([getFreePort(), getFreePort(), getFreePort()]);
  const env = {
    ...process.env,
    EAGLE_API_PORT: String(apiPort),
    EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
    EAGLE_EXTENSION_PORT: String(extensionPort),
    EAGLE_LIBRARY_STATE_FILE: stateFile,
  };
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

async function waitForPort(server) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const match = server.output().match(/Eagle Reverse API listening at http:\/\/localhost:(\d+)/);
    if (match) return Number(match[1]);
    if (server.child.exitCode !== null) throw new Error(`server exited early: ${server.output()}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`server startup timeout: ${server.output()}`);
}

async function stopServer(server) {
  if (server.child.exitCode !== null) return;
  server.child.kill();
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 3000);
    server.child.once('exit', () => { clearTimeout(timeout); resolve(); });
  });
}

async function request(base, route, options = {}) {
  const target = new URL(`${base}${route}`);
  const bodyText = options.body || '';
  const result = await new Promise((resolve, reject) => {
    const req = http.request(target, {
      method: options.method || 'GET',
      headers: {
        ...(options.headers || {}),
        ...(bodyText ? { 'Content-Length': Buffer.byteLength(bodyText) } : {}),
      },
      localAddress: '127.0.0.1',
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode || 0, data }));
    });
    req.on('error', reject);
    if (bodyText) req.write(bodyText);
    req.end();
  });
  const body = JSON.parse(result.data);
  if (result.statusCode < 200 || result.statusCode >= 300 || body.status !== 'success') {
    throw new Error(`${route} failed: HTTP ${result.statusCode} ${JSON.stringify(body)}`);
  }
  return body.data;
}

let server = await startServer();
let port = await waitForPort(server);
let base = `http://localhost:${port}`;
const created = await request(base, '/api/library/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'API闭环测试库', savePath: librariesRoot }),
});
const libraryPath = path.join(librariesRoot, 'API闭环测试库.library');
if (created.path !== libraryPath || created.itemCount !== 0) throw new Error('create API response mismatch');
if (!created.createdFiles.includes('cache.json') || !created.createdFiles.includes('images')) throw new Error('create API artifact report incomplete');

const current = await request(base, '/api/library/current?includeItems=true');
if (current.path !== libraryPath || current.items.length !== 0) throw new Error('current API mismatch after create');
await stopServer(server);

server = await startServer();
port = await waitForPort(server);
base = `http://localhost:${port}`;
const restored = await request(base, '/api/library/current?includeItems=true');
if (restored.path !== libraryPath || restored.items.length !== 0) throw new Error('backend restart did not restore current library');
const history = await request(base, '/api/library/history');
if (!history.includes(libraryPath)) throw new Error('backend restart did not restore history');
await stopServer(server);

console.log(`LIBRARY_API_CREATE_RESTART_OK ${libraryPath}`);
