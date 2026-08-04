import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const managedNode = 'C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2/node.exe';
const npmCli = 'C:/Users/Administrator/.workbuddy/binaries/node/versions/22.22.2/node_modules/npm/bin/npm-cli.js';
const electronExecutable = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-full-regression-'));
const stateFile = path.join(tempRoot, 'library-state.json');

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
    if (port >= 12_000) return port;
  }
}

function spawnLogged(command, args, env) {
  const child = spawn(command, args, { cwd: projectRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  return { child, output: () => output };
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

async function stop(processInfo) {
  if (!processInfo || processInfo.child.exitCode !== null) return;
  processInfo.child.kill();
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 3000);
    processInfo.child.once('exit', () => { clearTimeout(timeout); resolve(); });
  });
}

const [apiPort, thumbnailPort, extensionPort, vitePort, debugPort] = await Promise.all([
  freePort(),
  freePort(),
  freePort(),
  freePort(),
  freePort(),
]);
const previewOrigin = `http://127.0.0.1:${vitePort}`;
const baseEnv = { ...process.env };
delete baseEnv.ELECTRON_RUN_AS_NODE;
if (baseEnv.NODE_OPTIONS) {
  baseEnv.NODE_OPTIONS = baseEnv.NODE_OPTIONS.replace(/(?:^|\s)--use-system-ca(?=\s|$)/g, ' ').trim();
  if (!baseEnv.NODE_OPTIONS) delete baseEnv.NODE_OPTIONS;
}
const env = {
  ...baseEnv,
  EAGLE_API_PORT: String(apiPort),
  EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
  EAGLE_EXTENSION_PORT: String(extensionPort),
  EAGLE_LIBRARY_STATE_FILE: stateFile,
  EAGLE_USER_DATA_DIR: path.join(tempRoot, 'user-data'),
  EAGLE_ELECTRON_USER_DATA_DIR: path.join(tempRoot, 'electron-user-data'),
  EAGLE_API_URL: `http://127.0.0.1:${apiPort}`,
  EAGLE_THUMBNAIL_URL: `http://127.0.0.1:${thumbnailPort}`,
  EAGLE_EXTENSION_URL: `http://127.0.0.1:${extensionPort}`,
  EAGLE_PREVIEW_ORIGIN: previewOrigin,
  EAGLE_PREVIEW_URL: `${previewOrigin}/roadmap.html`,
  EAGLE_DEBUG_PORT: String(debugPort),
};
const backend = spawnLogged(managedNode, ['backend/src/server.js'], env);
const vite = spawnLogged(managedNode, [
  'node_modules/vite/bin/vite.js',
  '--config',
  'frontend/vite.preview.config.mjs',
  '--host',
  '127.0.0.1',
  '--port',
  String(vitePort),
  '--strictPort',
], env);
let regressionHost;
try {
  await waitFor(() => backend.output().includes(`localhost:${apiPort}`), 'isolated backend startup');
  await waitFor(async () => {
    try {
      return (await fetch(`${previewOrigin}/roadmap.html`)).ok;
    } catch {
      return false;
    }
  }, 'isolated Vite startup');
  regressionHost = spawnLogged(electronExecutable, ['electron/main.cjs', '--regression-host'], env);
  await waitFor(async () => {
    if (regressionHost.child.exitCode !== null) {
      throw new Error(`Isolated regression host exited:\n${regressionHost.output()}`);
    }
    try {
      return (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok;
    } catch {
      return false;
    }
  }, 'isolated Electron debug host');

  const tests = spawnLogged(managedNode, [npmCli, 'test'], env);
  const code = await new Promise((resolve) => tests.child.once('exit', resolve));
  process.stdout.write(tests.output());
  if (code !== 0) throw new Error(`Isolated full regression failed with exit code ${code}`);
  console.log(`FULL_REGRESSION_ISOLATED_OK ${JSON.stringify({ apiPort, thumbnailPort, extensionPort, vitePort, debugPort })}`);
} finally {
  await stop(regressionHost);
  await stop(vite);
  await stop(backend);
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
