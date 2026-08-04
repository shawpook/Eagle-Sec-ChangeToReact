import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fork, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronExecutable = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-electron-library-'));
const stateFile = path.join(tempRoot, 'library-state.json');
const smokeDownloadSource = fs.readFileSync(path.join(projectRoot, 'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png'));
const smokeDownloadServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': smokeDownloadSource.length });
  res.end(smokeDownloadSource);
});
await new Promise((resolve, reject) => {
  smokeDownloadServer.once('error', reject);
  smokeDownloadServer.listen(0, '127.0.0.1', resolve);
});
const smokeDownloadUrl = `http://127.0.0.1:${smokeDownloadServer.address().port}/image.png`;

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

async function waitFor(check, label, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await check();
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

async function createVideoFixture(output, env) {
  return new Promise((resolve, reject) => {
    const child = fork(path.join(projectRoot, 'tests', 'video-fixture-worker.cjs'), [], {
      execPath: electronExecutable,
      cwd: projectRoot,
      env: { ...env, EAGLE_VIDEO_FIXTURE_OUTPUT: output },
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.once('message', (message) => {
      if (message?.ok) resolve(output);
      else reject(new Error(message?.error || stderr || 'Electron video fixture generation failed'));
    });
    child.once('error', reject);
  });
}

async function stop(processInfo) {
  if (!processInfo || processInfo.child.exitCode !== null) return;
  processInfo.child.kill();
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 3000);
    processInfo.child.once('exit', () => { clearTimeout(timeout); resolve(); });
  });
}

const [apiPort, thumbnailPort, extensionPort, vitePort] = await Promise.all([freePort(), freePort(), freePort(), freePort()]);
const baseEnv = { ...process.env };
delete baseEnv.ELECTRON_RUN_AS_NODE;
if (baseEnv.NODE_OPTIONS) {
  baseEnv.NODE_OPTIONS = baseEnv.NODE_OPTIONS.replace(/(?:^|\s)--use-system-ca(?=\s|$)/g, ' ').trim();
  if (!baseEnv.NODE_OPTIONS) delete baseEnv.NODE_OPTIONS;
}
const backend = spawnLogged(process.execPath, ['backend/src/server.js'], {
  ...baseEnv,
  EAGLE_API_PORT: String(apiPort),
  EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
  EAGLE_EXTENSION_PORT: String(extensionPort),
  EAGLE_LIBRARY_STATE_FILE: stateFile,
  EAGLE_DOWNLOAD_ALLOW_HOSTS: '127.0.0.1',
});
const vite = spawnLogged(process.execPath, ['node_modules/vite/bin/vite.js', '--config', 'frontend/vite.preview.config.mjs', '--port', String(vitePort)], baseEnv);

try {
  await waitFor(async () => backend.output().includes(`localhost:${apiPort}`), 'backend startup');
  await waitFor(async () => {
    try {
      const response = await fetch(`http://localhost:${vitePort}/src/app/index.html`);
      return response.ok;
    } catch (err) {
      return false;
    }
  }, 'Vite startup');

  const smokeLibraries = path.join(tempRoot, 'libraries');
  const smokeExport = path.join(tempRoot, 'export');
  const smokeVideo = path.join(tempRoot, 'smoke.webm');
  fs.mkdirSync(smokeLibraries, { recursive: true });
  fs.mkdirSync(smokeExport, { recursive: true });
  await createVideoFixture(smokeVideo, baseEnv);
  const createResponse = await fetch(`http://localhost:${apiPort}/api/library/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Electron Bridge Library', savePath: smokeLibraries }),
  });
  const createBody = await createResponse.json();
  if (!createResponse.ok || createBody.status !== 'success') throw new Error(`Electron smoke library create failed: ${JSON.stringify(createBody)}`);

  const electron = spawnLogged(electronExecutable, ['electron/main.cjs', '--smoke-library'], {
    ...baseEnv,
    EAGLE_API_URL: `http://localhost:${apiPort}`,
    EAGLE_THUMBNAIL_URL: `http://localhost:${thumbnailPort}`,
    EAGLE_PREVIEW_URL: `http://localhost:${vitePort}/src/app/index.html`,
    EAGLE_SMOKE_IMPORT_SOURCE: path.join(projectRoot, 'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png'),
    EAGLE_SMOKE_VIDEO_SOURCE: smokeVideo,
    EAGLE_SMOKE_EXPORT_DIR: smokeExport,
    EAGLE_SMOKE_DOWNLOAD_URL: smokeDownloadUrl,
  });
  const result = await waitFor(async () => {
    const output = electron.output();
    if (output.includes('LIBRARY_SMOKE_OK')) return output;
    if (output.includes('LIBRARY_SMOKE_FAIL') || output.includes('LIBRARY_SMOKE_ERROR') || electron.child.exitCode !== null) {
      throw new Error(`Electron library bridge failed:\n${output}`);
    }
    return null;
  }, 'Electron library bridge', 60000);
  console.log(result.match(/LIBRARY_SMOKE_OK[^\r\n]*/)[0]);
  await stop(electron);
} finally {
  await stop(vite);
  await stop(backend);
  await new Promise((resolve) => smokeDownloadServer.close(resolve));
}
