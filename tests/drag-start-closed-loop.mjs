import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nodeExecutable = process.execPath;
const electronExecutable = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-drag-start-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
fs.mkdirSync(librariesRoot, { recursive: true });

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

async function waitFor(check, label, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    let value;
    try {
      value = await check();
    } catch (err) {
      value = null;
    }
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error(`${label} timeout`);
}

function spawnLogged(command, args, env) {
  const child = spawn(command, args, { cwd: projectRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  return { child, output: () => output };
}

async function stop(processInfo) {
  if (!processInfo || processInfo.child.exitCode !== null) return;
  processInfo.child.kill();
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 3000);
    processInfo.child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}

const [apiPort, thumbnailPort, extensionPort] = await Promise.all([freePort(), freePort(), freePort()]);
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
};
let backend = spawnLogged(nodeExecutable, ['backend/src/server.js'], backendEnv);
let electron;
try {
  await waitFor(() => backend.output().includes(`localhost:${apiPort}`), 'backend startup');

  const createResponse = await fetch(`http://127.0.0.1:${apiPort}/api/library/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Drag Start Smoke', savePath: librariesRoot }),
  });
  const createBody = await createResponse.json();
  if (!createResponse.ok || createBody.status !== 'success') {
    throw new Error(`Library create failed: ${JSON.stringify(createBody)}`);
  }

  const fixture = path.join(projectRoot, 'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png');
  const sourceOne = path.join(tempRoot, 'Drag Start One.png');
  const sourceTwo = path.join(tempRoot, 'Drag Start Two.png');
  fs.copyFileSync(fixture, sourceOne);
  fs.copyFileSync(fixture, sourceTwo);
  const importResponse = await fetch(`http://127.0.0.1:${apiPort}/api/item/addFromPaths`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images: [{ path: sourceOne, name: 'Drag Start One' }, { path: sourceTwo, name: 'Drag Start Two' }] }),
  });
  const importBody = await importResponse.json();
  if (!importResponse.ok || importBody.status !== 'success') {
    throw new Error(`Fixture import failed: ${JSON.stringify(importBody)}`);
  }
  const itemIds = importBody.data.map((item) => item.id);

  electron = spawnLogged(electronExecutable, ['electron/main.cjs', '--smoke-drag'], {
    ...baseEnv,
    EAGLE_API_URL: `http://127.0.0.1:${apiPort}`,
    EAGLE_THUMBNAIL_URL: `http://127.0.0.1:${thumbnailPort}`,
    EAGLE_ELECTRON_USER_DATA_DIR: path.join(tempRoot, 'electron-user-data'),
  });

  const output = await waitFor(() => {
    const text = electron.output();
    if (text.includes('DRAG_SMOKE_OK')) return text;
    if (text.includes('DRAG_SMOKE_ERROR') || text.includes('DRAG_SMOKE_TIMEOUT') || electron.child.exitCode !== null) {
      throw new Error(`Drag start smoke failed:\n${text}`);
    }
    return null;
  }, 'drag start smoke', 30000);

  const line = output.match(/DRAG_SMOKE_OK[^\r\n]*/)?.[0];
  if (!line) throw new Error(`Missing drag start smoke result:\n${output}`);
  const result = JSON.parse(line.slice('DRAG_SMOKE_OK '.length));
  if (!result.ok || !result.sync || !result.recorded || result.callCount !== 1) {
    throw new Error(`Drag start smoke assertions failed: ${JSON.stringify(result)}`);
  }
  if (result.fileCount !== 2 || !Array.isArray(result.paths) || result.paths.length !== 2) {
    throw new Error(`Multi-select drag start did not resolve two files: ${JSON.stringify(result)}`);
  }
  if (result.paths.some((filePath) => !fs.existsSync(filePath))) {
    throw new Error(`Drag start smoke resolved missing files: ${JSON.stringify(result)}`);
  }
  console.log(`DRAG_START_CLOSED_LOOP_OK ${JSON.stringify({ itemIds, ...result })}`);
} finally {
  await stop(electron);
  await stop(backend);
  try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
}
