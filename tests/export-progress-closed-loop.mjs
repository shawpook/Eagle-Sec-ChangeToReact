import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nodeExecutable = process.execPath;
const electronExecutable = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-export-progress-'));
const stateFile = path.join(tempRoot, 'library-state.json');
const librariesRoot = path.join(tempRoot, 'libraries');
const sourcesRoot = path.join(tempRoot, 'sources');
const exportDir = path.join(tempRoot, 'exports');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourcesRoot, { recursive: true });
fs.mkdirSync(exportDir, { recursive: true });

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
], baseEnv);
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
    body: JSON.stringify({ name: 'Export Progress', savePath: librariesRoot }),
  });
  const createBody = await createResponse.json();
  if (!createResponse.ok || createBody.status !== 'success') throw new Error(`Library create failed: ${JSON.stringify(createBody)}`);

  const sourceA = path.join(sourcesRoot, 'Progress Export A.png');
  const sourceB = path.join(sourcesRoot, 'Progress Export B.png');
  fs.copyFileSync(
    path.join(projectRoot, 'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png'),
    sourceA
  );
  fs.copyFileSync(sourceA, sourceB);
  const importResponse = await fetch(`http://127.0.0.1:${apiPort}/api/item/addFromPaths`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images: [{ path: sourceA }, { path: sourceB }] }),
  });
  const importBody = await importResponse.json();
  if (!importResponse.ok || importBody.status !== 'success') throw new Error(`Fixture import failed: ${JSON.stringify(importBody)}`);

  electron = spawnLogged(electronExecutable, ['electron/main.cjs', '--smoke-export-progress'], {
    ...baseEnv,
    EAGLE_API_URL: `http://127.0.0.1:${apiPort}`,
    EAGLE_THUMBNAIL_URL: `http://127.0.0.1:${thumbnailPort}`,
    EAGLE_PREVIEW_URL: `http://127.0.0.1:${vitePort}/src/app/index.html`,
    EAGLE_ELECTRON_USER_DATA_DIR: path.join(tempRoot, 'electron-user-data'),
    EAGLE_EXPORT_PROGRESS_DIR: exportDir,
  });
  const output = await waitFor(() => {
    const text = electron.output();
    if (text.includes('EXPORT_PROGRESS_SMOKE_OK')) return text;
    if (text.includes('EXPORT_PROGRESS_SMOKE_FAIL') || text.includes('EXPORT_PROGRESS_SMOKE_ERROR') || electron.child.exitCode !== null) {
      throw new Error(`Export progress smoke failed:\n${text}`);
    }
    return null;
  }, 'export progress smoke', 90000);
  const line = output.match(/EXPORT_PROGRESS_SMOKE_OK[^\r\n]*/)?.[0];
  if (!line) throw new Error(`Missing export progress success output:\n${output}`);
  const result = JSON.parse(line.slice('EXPORT_PROGRESS_SMOKE_OK '.length));

  const flatFiles = fs.readdirSync(result.flatSave).filter((name) => name.endsWith('.png'));
  if (flatFiles.length !== 2) throw new Error(`Flat export file count mismatch: ${JSON.stringify(flatFiles)}`);
  const exportedA = path.join(result.flatSave, 'Progress Export A.png');
  const exportedB = path.join(result.flatSave, 'Progress Export B.png');
  if (!fs.existsSync(exportedA) || !fs.existsSync(exportedB)) {
    throw new Error(`Flat export names mismatch: ${JSON.stringify(flatFiles)}`);
  }
  const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (hash(exportedA) !== hash(sourceA) || hash(exportedB) !== hash(sourceB)) {
    throw new Error('Flat export hash mismatch');
  }

  const Zip = AdmZip.default || AdmZip;
  const zip = new Zip(result.packSave);
  const packEntry = zip.getEntry('pack.json');
  if (!packEntry) throw new Error('Eaglepack pack.json is missing');
  const pack = JSON.parse(packEntry.getData().toString('utf8'));
  if (!Array.isArray(pack.images) || pack.images.length !== 2) {
    throw new Error(`Eaglepack images mismatch: ${JSON.stringify(pack.images && pack.images.length)}`);
  }
  const infoEntries = pack.images.map((item) => `${item.id}.info/`);
  if (!infoEntries.every((entryName) => zip.getEntry(entryName))) {
    throw new Error(`Eaglepack item directories are missing: ${JSON.stringify(infoEntries)}`);
  }
  if (!result.revealOk) throw new Error('Original progress directives did not reveal exported targets');

  console.log(`EXPORT_PROGRESS_CLOSED_LOOP_OK ${JSON.stringify({
    library: createBody.data.path,
    flatFiles,
    packImages: pack.images.length,
    fileScope: result.fileScope,
    archiveScope: result.archiveScope,
  })}`);
  await stop(electron);
} finally {
  await stop(electron);
  await stop(vite);
  await stop(backend);
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
