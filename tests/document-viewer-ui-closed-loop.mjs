import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nodeExecutable = process.execPath;
const electronExecutable = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-doc-viewer-ui-'));
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

async function postJson(base, route, body) {
  const response = await fetch(`${base}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok || payload.status !== 'success') {
    throw new Error(`${route} failed: ${JSON.stringify(payload)}`);
  }
  return payload.data;
}

const [apiPort, thumbnailPort, extensionPort, vitePort] = await Promise.all([freePort(), freePort(), freePort(), freePort()]);
const baseEnv = { ...process.env };
delete baseEnv.ELECTRON_RUN_AS_NODE;
if (baseEnv.NODE_OPTIONS) {
  baseEnv.NODE_OPTIONS = baseEnv.NODE_OPTIONS.replace(/(?:^|\s)--use-system-ca(?=\s|$)/g, ' ').trim();
  if (!baseEnv.NODE_OPTIONS) delete baseEnv.NODE_OPTIONS;
}

const apiBase = `http://127.0.0.1:${apiPort}`;
const thumbnailBase = `http://127.0.0.1:${thumbnailPort}`;
const previewUrl = `http://localhost:${vitePort}/src/app/index.html`;

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
  EAGLE_THUMBNAIL_URL: thumbnailBase,
  EAGLE_API_URL: apiBase,
});
let electron;

try {
  await waitFor(() => backend.output().includes(`localhost:${apiPort}`), 'backend startup');
  await waitFor(async () => {
    try {
      const response = await fetch(`${previewUrl}`);
      return response.ok;
    } catch (err) {
      return false;
    }
  }, 'Vite startup');

  const librariesRoot = path.join(tempRoot, 'libraries');
  fs.mkdirSync(librariesRoot, { recursive: true });
  const markdownSource = path.join(tempRoot, 'Viewer Sample.md');
  const expectedText = 'Viewer E2E 中文标题';
  fs.writeFileSync(markdownSource, `# ${expectedText}\n\n- 列表一\n- 列表二\n\n\`\`\`js\nconst a = 1\n\`\`\`\n`, 'utf8');

  await postJson(apiBase, '/api/library/create', { name: 'Document Viewer UI', savePath: librariesRoot });
  const imported = await postJson(apiBase, '/api/item/addFromPaths', { paths: [markdownSource] });
  const item = imported.find((entry) => entry && entry.id);

  electron = spawnLogged(electronExecutable, ['electron/main.cjs', '--smoke-document-viewer'], {
    ...baseEnv,
    EAGLE_API_URL: apiBase,
    EAGLE_THUMBNAIL_URL: thumbnailBase,
    EAGLE_PREVIEW_URL: previewUrl,
    EAGLE_DOCVIEWER_ITEM_ID: item.id,
    EAGLE_DOCVIEWER_EXPECTED_TEXT: expectedText,
    EAGLE_ELECTRON_USER_DATA_DIR: path.join(tempRoot, 'electron-user-data'),
  });

  const output = await waitFor(() => {
    const text = electron.output();
    if (text.includes('DOCUMENT_VIEWER_SMOKE_OK')) return text;
    if (text.includes('DOCUMENT_VIEWER_SMOKE_FAIL') || text.includes('DOCUMENT_VIEWER_SMOKE_ERROR') || electron.child.exitCode !== null) {
      throw new Error(`Document viewer UI workflow failed:\n${text}`);
    }
    return null;
  }, 'document viewer UI workflow', 90000);
  const line = output.match(/DOCUMENT_VIEWER_SMOKE_OK[^\r\n]*/)?.[0];
  if (!line) throw new Error(`Missing viewer success output:\n${output}`);
  console.log(line);
  await stop(electron);
} finally {
  await stop(electron);
  await stop(vite);
  await stop(backend);
  try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
}

console.log('DOCUMENT_VIEWER_UI_CLOSED_LOOP_OK');
