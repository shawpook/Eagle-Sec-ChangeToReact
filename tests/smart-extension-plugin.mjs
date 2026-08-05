import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-smart-extension-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const stateFile = path.join(tempRoot, 'library-state.json');
const sourceFile = path.join(
  projectRoot,
  'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png'
);
fs.mkdirSync(librariesRoot, { recursive: true });
const dataUri = `data:image/png;base64,${fs.readFileSync(sourceFile).toString('base64')}`;

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
  const deadline = Date.now() + 10000;
  while (!output.includes(`localhost:${apiPort}`)) {
    if (child.exitCode !== null) throw new Error(`server exited: ${output}`);
    if (Date.now() > deadline) throw new Error(`server timeout: ${output}`);
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  return {
    child,
    apiBase: `http://127.0.0.1:${apiPort}`,
    extensionBase: `http://127.0.0.1:${extensionPort}`,
  };
}

async function stopServer(server) {
  if (server.child.exitCode !== null) return;
  server.child.kill();
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 3000);
    server.child.once('exit', () => { clearTimeout(timeout); resolve(); });
  });
}

async function json(method, url, body, headers) {
  const response = await fetch(url, {
    method,
    headers: headers || (body ? { 'Content-Type': 'application/json' } : undefined),
    body: body ? (headers ? body : JSON.stringify(body)) : undefined,
  });
  const result = await response.json();
  if (!response.ok || result.status !== 'success') {
    throw new Error(`${method} ${url} HTTP ${response.status}: ${JSON.stringify(result)}`);
  }
  return result;
}

const server = await startServer();
try {
  const created = await json('POST', `${server.apiBase}/api/library/create`, {
    name: 'Smart Extension Plugin',
    savePath: librariesRoot,
  });
  const libraryPath = created.data.path;

  await json('POST', `${server.apiBase}/api/item/addFromPath`, { path: sourceFile, name: 'Star Five', star: 5, tags: ['UI'] });
  await json('POST', `${server.apiBase}/api/item/addFromPath`, { path: sourceFile, name: 'Star One', star: 1, tags: ['Other'] });

  const smart = await json('POST', `${server.apiBase}/api/v2/smartFolder/create`, {
    name: 'Five Star Only',
    conditions: [{ rules: [{ property: 'rating', method: 'equal', value: '5' }] }],
  });
  const smartItems = await json('GET', `${server.apiBase}/api/v2/smartFolder/getItems?id=${encodeURIComponent(smart.data.id)}`);
  if (smartItems.data.length !== 1 || smartItems.data[0].name !== 'Star Five') {
    throw new Error('smart folder rule engine returned wrong items');
  }

  const extensionItems = [];
  for (const route of ['/api/item/addFile', '/api/item/import-images', '/api/collect']) {
    const form = new URLSearchParams({
      type: 'image',
      src: dataUri,
      title: `Extension Save ${extensionItems.length + 1}`,
      'tags[0]': 'extension',
    });
    const result = await json('POST', `${server.extensionBase}${route}`, form, {
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    extensionItems.push(result.data);
  }
  if (new Set(extensionItems.map((item) => item.id)).size !== extensionItems.length) {
    throw new Error('extension routes returned duplicate item IDs');
  }
  for (const item of extensionItems) {
    const infoDir = path.join(libraryPath, 'images', `${item.id}.info`);
    if (!fs.existsSync(path.join(infoDir, `${item.name}.png`)) || !fs.existsSync(path.join(infoDir, 'metadata.json'))) {
      throw new Error(`extension item did not persist: ${item.id}`);
    }
  }

  const open = await json('POST', `${server.apiBase}/api/plugins/open`, { id: 'eagle-reverse-example-service' });
  const pluginHtml = await (await fetch(open.data.url)).text();
  if (!pluginHtml.includes('/plugin-shim.js') || !pluginHtml.includes('Eagle Reverse Example Service')) {
    throw new Error('plugin page shim or content missing');
  }

  console.log(`SMART_EXTENSION_PLUGIN_OK ${libraryPath}`);
} finally {
  await stopServer(server);
}
