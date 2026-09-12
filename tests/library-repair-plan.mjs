import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadLibrary } from '../backend/src/library-store.js';
import { importFile } from '../backend/src/importer.js';
import { thumbnailPath } from '../backend/src/thumbnailer.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-repair-plan-'));
const libraryPath = path.join(tempRoot, 'repair.library');
const stateFile = path.join(tempRoot, 'library-state.json');

fs.mkdirSync(libraryPath, { recursive: true });
fs.writeFileSync(path.join(libraryPath, 'metadata.json'), JSON.stringify({
  applicationVersion: '4.0.0',
  folders: [],
  smartFolders: [],
  quickAccess: [],
  tagsGroups: [],
  modificationTime: Date.now(),
}), 'utf8');
fs.writeFileSync(path.join(libraryPath, 'tags.json'), JSON.stringify({ historyTags: [], starredTags: [] }), 'utf8');
fs.writeFileSync(path.join(libraryPath, 'saved-filters.json'), '[]', 'utf8');
const library = loadLibrary(libraryPath);
const source = path.join(projectRoot, 'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png');
const imported = importFile(library, source, { name: 'Repair Item' });
const thumb = thumbnailPath(library, imported);
fs.rmSync(thumb, { force: true });

async function freePort() {
  while (true) {
    const port = await new Promise((resolve, reject) => {
      const server = http.createServer();
      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        server.close(() => resolve(address.port));
      });
    });
    if (port >= 12_000) return port;
  }
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
  const deadline = Date.now() + 10_000;
  while (!output.includes(`localhost:${apiPort}`)) {
    if (child.exitCode !== null) throw new Error(`server exited: ${output}`);
    if (Date.now() > deadline) throw new Error(`server startup timeout: ${output}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return { child, apiBase: `http://127.0.0.1:${apiPort}` };
}

async function stopServer(server) {
  if (!server || server.child.exitCode !== null) return;
  server.child.kill();
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 3_000);
    server.child.once('exit', () => { clearTimeout(timeout); resolve(); });
  });
}

async function json(apiBase, method, route, body) {
  const response = await fetch(`${apiBase}${route}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${method} ${route} HTTP ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

async function waitForJob(apiBase, jobId) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const job = await json(apiBase, 'GET', `/api/library/consistency/jobs/${jobId}`);
    if (job.data.status === 'complete') return job.data.result;
    if (job.data.status === 'error') throw new Error(`scan failed: ${JSON.stringify(job.data)}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('consistency scan timed out');
}

const server = await startServer();
try {
  await json(server.apiBase, 'POST', '/api/library/switch', { libraryPath });
  const scanStart = await json(server.apiBase, 'POST', '/api/library/consistency/scan');
  const report = await waitForJob(server.apiBase, scanStart.data.id);
  assert.ok(report.issues.some((entry) => entry.code === 'MISSING_THUMBNAIL'), 'scan did not report missing thumbnail');
  const planned = await json(server.apiBase, 'POST', '/api/library/repair/plan', {
    report: { reportDigest: report.reportDigest, generation: report.generation },
  });
  assert.ok(planned.data.recoveryPoint.id, 'repair plan did not create a recovery point');
  assert.ok(fs.existsSync(thumb), 'repair plan did not recreate the thumbnail');
  const backups = await json(server.apiBase, 'GET', '/api/library/backups');
  assert.ok(backups.data.some((entry) => entry.id === planned.data.recoveryPoint.id), 'repair recovery point was not listed');
} finally {
  await stopServer(server);
}

try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
console.log('LIBRARY_REPAIR_PLAN_OK');
