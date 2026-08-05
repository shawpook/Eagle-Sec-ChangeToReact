import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fork, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nodeExecutable = process.execPath;
const electronExecutable = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-video-detail-'));
const stateFile = path.join(tempRoot, 'library-state.json');
const librariesRoot = path.join(tempRoot, 'libraries');
const sourcesRoot = path.join(tempRoot, 'sources');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourcesRoot, { recursive: true });

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

async function stop(processInfo) {
  if (!processInfo || processInfo.child.exitCode !== null) return;
  processInfo.child.kill();
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 3000);
    processInfo.child.once('exit', () => { clearTimeout(timeout); resolve(); });
  });
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
      if (message && message.ok) resolve(output);
      else reject(new Error(message && message.error || stderr || 'Video fixture generation failed'));
    });
    child.once('error', reject);
  });
}

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
  EAGLE_THUMBNAIL_URL: `http://127.0.0.1:${thumbnailPort}`,
});
let electron;

try {
  await waitFor(() => backend.output().includes(`localhost:${apiPort}`), 'backend startup');
  await waitFor(async () => {
    try {
      return (await fetch(`http://127.0.0.1:${vitePort}/src/app/index.html`)).ok;
    } catch (err) {
      return false;
    }
  }, 'Vite startup');
  const createResponse = await fetch(`http://127.0.0.1:${apiPort}/api/library/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Video Detail Mode', savePath: librariesRoot }),
  });
  const createBody = await createResponse.json();
  if (!createResponse.ok || createBody.status !== 'success') throw new Error(`Library create failed: ${JSON.stringify(createBody)}`);
  const videoSource = path.join(sourcesRoot, 'Detail Video.webm');
  await createVideoFixture(videoSource, baseEnv);
  const importResponse = await fetch(`http://127.0.0.1:${apiPort}/api/item/addFromPaths`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images: [{ path: videoSource, name: 'Detail Video' }] }),
  });
  const importBody = await importResponse.json();
  if (!importResponse.ok || importBody.status !== 'success') throw new Error(`Video import failed: ${JSON.stringify(importBody)}`);

  electron = spawnLogged(electronExecutable, ['electron/main.cjs', '--smoke-video-detail'], {
    ...baseEnv,
    EAGLE_API_URL: `http://127.0.0.1:${apiPort}`,
    EAGLE_THUMBNAIL_URL: `http://127.0.0.1:${thumbnailPort}`,
    EAGLE_PREVIEW_URL: `http://127.0.0.1:${vitePort}/src/app/index.html`,
    EAGLE_ELECTRON_USER_DATA_DIR: path.join(tempRoot, 'electron-user-data'),
  });
  const output = await waitFor(() => {
    const text = electron.output();
    if (text.includes('VIDEO_DETAIL_SMOKE_OK')) return text;
    if (text.includes('VIDEO_DETAIL_SMOKE_FAIL') || text.includes('VIDEO_DETAIL_SMOKE_ERROR') || electron.child.exitCode !== null) {
      throw new Error(`Video detail smoke failed:\n${text}`);
    }
    return null;
  }, 'video detail smoke', 90000);
  const line = output.match(/VIDEO_DETAIL_SMOKE_OK[^\r\n]*/)?.[0];
  if (!line) throw new Error(`Missing video detail success output:\n${output}`);
  const result = JSON.parse(line.slice('VIDEO_DETAIL_SMOKE_OK '.length));
  if (!result.detailMode || !result.player || result.player.error || result.player.videoWidth <= 0 || !result.interaction) {
    throw new Error(`Video detail mode was not proven: ${JSON.stringify(result)}`);
  }
  console.log(`VIDEO_DETAIL_CLOSED_LOOP_OK ${JSON.stringify({
    library: createBody.data.path,
    item: { id: result.videoItemId, ext: result.videoExt },
    player: result.player,
    interaction: result.interaction,
  })}`);
  await stop(electron);
} finally {
  await stop(electron);
  await stop(vite);
  await stop(backend);
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
