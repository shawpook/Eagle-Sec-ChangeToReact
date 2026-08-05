import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nodeExecutable = process.execPath;
const electronExecutable = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-main-ui-workflow-'));
const stateFile = path.join(tempRoot, 'library-state.json');

async function freePort() {
  while (true) {
    const port = await new Promise((resolve, reject) => {
      const server = http.createServer();
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const available = server.address().port;
        server.close(() => resolve(available));
      });
    });
    if (port >= 12_000) return port;
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

async function createLibrary(apiPort, root) {
  const response = await fetch(`http://localhost:${apiPort}/api/library/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Original Main Workflow', savePath: root }),
  });
  const payload = await response.json();
  if (!response.ok || payload.status !== 'success') throw new Error(`Library create failed: ${JSON.stringify(payload)}`);
  return payload.data;
}

async function createFolder(apiPort, name) {
  const response = await fetch(`http://localhost:${apiPort}/api/folder/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const payload = await response.json();
  if (!response.ok || payload.status !== 'success') throw new Error(`Folder create failed: ${JSON.stringify(payload)}`);
  return payload.data;
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
const vite = spawnLogged(nodeExecutable, ['node_modules/vite/bin/vite.js', '--config', 'frontend/vite.preview.config.mjs', '--port', String(vitePort)], {
  ...baseEnv,
  EAGLE_THUMBNAIL_URL: `http://127.0.0.1:${thumbnailPort}`,
});
let electron;

try {
  await waitFor(() => backend.output().includes(`localhost:${apiPort}`), 'backend startup');
  await waitFor(async () => {
    try {
      const response = await fetch(`http://localhost:${vitePort}/src/app/index.html`);
      return response.ok;
    } catch (err) {
      return false;
    }
  }, 'Vite startup');

  const librariesRoot = path.join(tempRoot, 'libraries');
  const folderSource = path.join(tempRoot, 'folder-source');
  fs.mkdirSync(librariesRoot, { recursive: true });
  fs.mkdirSync(folderSource, { recursive: true });
  const fixture = path.join(projectRoot, 'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png');
  const fileDropSource = path.join(tempRoot, 'Dropped Main.png');
  const clipboardPathSource = path.join(tempRoot, 'Clipboard Path.png');
  fs.copyFileSync(fixture, fileDropSource);
  fs.copyFileSync(fixture, clipboardPathSource);
  fs.copyFileSync(fixture, path.join(folderSource, 'Folder Item One.png'));
  fs.copyFileSync(fixture, path.join(folderSource, 'Folder Item Two.png'));

  const library = await createLibrary(apiPort, librariesRoot);
  const workflowFolder = await createFolder(apiPort, '主界面闭环文件夹');
  electron = spawnLogged(electronExecutable, ['electron/main.cjs', '--smoke-main-workflow'], {
    ...baseEnv,
    EAGLE_API_URL: `http://localhost:${apiPort}`,
    EAGLE_THUMBNAIL_URL: `http://localhost:${thumbnailPort}`,
    EAGLE_PREVIEW_URL: `http://localhost:${vitePort}/src/app/index.html`,
    EAGLE_WORKFLOW_FILE_SOURCE: fileDropSource,
    EAGLE_WORKFLOW_FOLDER_SOURCE: folderSource,
    EAGLE_WORKFLOW_CLIPBOARD_SOURCE: clipboardPathSource,
    EAGLE_WORKFLOW_CLIPBOARD_IMAGE_SOURCE: fixture,
    EAGLE_WORKFLOW_FOLDER_ID: workflowFolder.id,
    EAGLE_ELECTRON_USER_DATA_DIR: path.join(tempRoot, 'electron-user-data'),
  });

  const output = await waitFor(() => {
    const text = electron.output();
    if (text.includes('MAIN_WORKFLOW_SMOKE_OK')) return text;
    if (text.includes('MAIN_WORKFLOW_SMOKE_FAIL') || text.includes('MAIN_WORKFLOW_SMOKE_ERROR') || electron.child.exitCode !== null) {
      throw new Error(`Original main UI workflow failed:\n${text}`);
    }
    return null;
  }, 'original main UI workflow', 80000);
  const line = output.match(/MAIN_WORKFLOW_SMOKE_OK[^\r\n]*/)?.[0];
  if (!line) throw new Error(`Missing workflow success output:\n${output}`);
  console.log(line);
  await stop(electron);

  await stop(backend);
  const restartedBackend = spawnLogged(nodeExecutable, ['backend/src/server.js'], backendEnv);
  try {
    await waitFor(() => restartedBackend.output().includes(`localhost:${apiPort}`), 'restarted backend');
    const response = await fetch(`http://localhost:${apiPort}/api/library/current?includeItems=true`);
    const payload = await response.json();
    if (!response.ok || payload.status !== 'success') throw new Error(`Restart verification failed: ${JSON.stringify(payload)}`);
    const restored = payload.data.items.find((item) => item.name === 'Inspector Renamed');
    if (!restored || restored.isDeleted || restored.annotation !== '多选备注持久化' || restored.star !== 3 || !restored.tags.includes('batch-ui')) {
      throw new Error(`Restarted library did not restore the workflow item: ${JSON.stringify(restored)}`);
    }
    const cacheText = fs.readFileSync(path.join(library.path, 'cache.json'), 'utf8');
    const searchIndex = JSON.parse(fs.readFileSync(path.join(library.path, 'search-index.json'), 'utf8'));
    const tags = JSON.parse(fs.readFileSync(path.join(library.path, 'tags.json'), 'utf8'));
    if (!cacheText.includes(restored.id) || !searchIndex.items.some((item) => item.id === restored.id && item.name === restored.name)) {
      throw new Error('Cache or search index did not preserve the workflow item');
    }
    if (!tags.historyTags.includes('main-ui') || !tags.historyTags.includes('batch-ui')) {
      throw new Error(`Tag history was not persisted: ${JSON.stringify(tags)}`);
    }
    console.log(`MAIN_UI_RESTART_OK ${JSON.stringify({ library: library.path, itemId: restored.id, itemCount: payload.data.items.length })}`);
  } finally {
    await stop(restartedBackend);
  }
} finally {
  await stop(electron);
  await stop(vite);
  await stop(backend);
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
