import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-text-detail-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const sourcesRoot = path.join(tempRoot, 'sources');
const stateFile = path.join(tempRoot, 'library-state.json');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourcesRoot, { recursive: true });

function utf16leBuffer(value) {
  const bytes = [0xff, 0xfe];
  for (const char of value) {
    const code = char.codePointAt(0);
    bytes.push(code & 0xff, (code >> 8) & 0xff);
  }
  return Buffer.from(bytes);
}

async function freePort() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const port = await new Promise((resolve, reject) => {
      const server = http.createServer();
      server.on('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        server.close(() => resolve(address && typeof address === 'object' ? address.port : null));
      });
    });
    if (Number.isInteger(port) && port > 0 && port < 65536) return port;
  }
  throw new Error('could not allocate a free TCP port');
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
      EAGLE_THUMBNAIL_CONCURRENCY: '3',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  const deadline = Date.now() + 15_000;
  while (!output.includes(`localhost:${apiPort}`)) {
    if (child.exitCode !== null) throw new Error(`server exited: ${output}`);
    if (Date.now() > deadline) throw new Error(`server startup timeout: ${output}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return { child, base: `http://127.0.0.1:${apiPort}` };
}

async function stopServer(server) {
  if (server.child.exitCode !== null) return;
  server.child.kill();
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 3_000);
    server.child.once('exit', () => { clearTimeout(timeout); resolve(); });
  });
}

async function request(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function post(base, route, body) {
  return request(base, route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const normalMd = path.join(sourcesRoot, 'normal.md');
const chineseTxt = path.join(sourcesRoot, 'chinese.txt');
const gbkTxt = path.join(sourcesRoot, 'gbk.txt');
const utf16Txt = path.join(sourcesRoot, 'utf16.txt');
const emptyTxt = path.join(sourcesRoot, 'empty.txt');
const binaryTxt = path.join(sourcesRoot, 'binary.txt');
const largeTxt = path.join(sourcesRoot, 'large.txt');
const notTextPng = path.join(projectRoot, 'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png');

fs.writeFileSync(normalMd, '# Markdown Detail\n\n- one\n- two\n\n> quote\n', 'utf8');
fs.writeFileSync(chineseTxt, '中文详情文本\n第二行', 'utf8');
fs.writeFileSync(gbkTxt, Buffer.from('d6d0cec4'.repeat(20) + '0a', 'hex'));
fs.writeFileSync(utf16Txt, utf16leBuffer('中文 UTF-16 详情'));
fs.writeFileSync(emptyTxt, '');
fs.writeFileSync(binaryTxt, Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(64, 0)]));
fs.writeFileSync(largeTxt, 'L'.repeat(2 * 1024 * 1024), 'utf8');

let server = await startServer();
try {
  const created = await post(server.base, '/api/library/create', { name: 'Text Detail', savePath: librariesRoot });
  if (created.response.status !== 201) throw new Error(`library create failed: ${JSON.stringify(created.body)}`);
  const imported = await post(server.base, '/api/item/addFromPaths', {
    paths: [normalMd, chineseTxt, gbkTxt, utf16Txt, emptyTxt, binaryTxt, largeTxt, notTextPng],
  });
  if (imported.response.status !== 201 || imported.body.data.length !== 8) {
    throw new Error(`fixture import failed: ${JSON.stringify(imported.body)}`);
  }
  const items = new Map(imported.body.data.map((item) => [item.name, item]));

  const missing = await request(server.base, '/api/v2/item/textDetail');
  if (missing.response.status !== 400 || missing.body.code !== 'ITEM_ID_REQUIRED') {
    throw new Error(`missing id mismatch: ${JSON.stringify(missing.body)}`);
  }
  const notFound = await request(server.base, '/api/v2/item/textDetail?id=NOT-FOUND');
  if (notFound.response.status !== 404 || notFound.body.code !== 'ITEM_NOT_FOUND') {
    throw new Error(`not found mismatch: ${JSON.stringify(notFound.body)}`);
  }

  const normal = await request(server.base, `/api/v2/item/textDetail?id=${encodeURIComponent(items.get('normal').id)}`);
  if (normal.response.status !== 200 || !normal.body.data.content.includes('Markdown Detail')) {
    throw new Error(`markdown detail failed: ${JSON.stringify(normal.body)}`);
  }
  if (normal.body.data.mimeType !== 'text/markdown' || normal.body.data.encoding !== 'utf-8') {
    throw new Error(`markdown metadata mismatch: ${JSON.stringify(normal.body.data)}`);
  }

  const chinese = await request(server.base, `/api/v2/item/textDetail?id=${encodeURIComponent(items.get('chinese').id)}`);
  if (!chinese.body.data.content.includes('中文详情文本')) throw new Error('UTF-8 Chinese detail failed');

  const gbk = await request(server.base, `/api/v2/item/textDetail?id=${encodeURIComponent(items.get('gbk').id)}`);
  if (!gbk.body.data.content.includes('中文')) throw new Error(`GBK detail failed: ${JSON.stringify(gbk.body.data)}`);

  const utf16 = await request(server.base, `/api/v2/item/textDetail?id=${encodeURIComponent(items.get('utf16').id)}`);
  if (!utf16.body.data.content.includes('中文') || !utf16.body.data.content.includes('UTF-16')) {
    throw new Error(`UTF-16 detail failed: ${JSON.stringify(utf16.body.data)}`);
  }

  const empty = await request(server.base, `/api/v2/item/textDetail?id=${encodeURIComponent(items.get('empty').id)}`);
  if (empty.body.data.content !== '' || empty.body.data.size !== 0) throw new Error('empty text detail failed');

  const binary = await request(server.base, `/api/v2/item/textDetail?id=${encodeURIComponent(items.get('binary').id)}`);
  if (binary.response.status !== 422 || binary.body.code !== 'TEXT_SOURCE_BINARY') {
    throw new Error(`binary detail mismatch: ${JSON.stringify(binary.body)}`);
  }

  const unsupported = await request(server.base, `/api/v2/item/textDetail?id=${encodeURIComponent(items.get('Welcome Library').id)}`);
  if (unsupported.response.status !== 415 || unsupported.body.code !== 'TEXT_FORMAT_UNSUPPORTED') {
    throw new Error(`unsupported detail mismatch: ${JSON.stringify(unsupported.body)}`);
  }

  const large = await request(server.base, `/api/v2/item/textDetail?id=${encodeURIComponent(items.get('large').id)}`);
  if (!large.body.data.truncated || !large.body.data.hasMore || large.body.data.endOffset > 1024 * 1024) {
    throw new Error(`large text first page mismatch: ${JSON.stringify(large.body.data)}`);
  }
  const largeNext = await request(server.base, `/api/v2/item/textDetail?id=${encodeURIComponent(items.get('large').id)}&offset=${large.body.data.endOffset}`);
  if (largeNext.response.status !== 200 || largeNext.body.data.content.length === 0 || largeNext.body.data.hasMore) {
    throw new Error(`large text second page mismatch: ${JSON.stringify(largeNext.body)}`);
  }

  const v1 = await request(server.base, `/api/item/textDetail?id=${encodeURIComponent(items.get('normal').id)}`);
  if (v1.response.status !== 200 || v1.body.data.content !== normal.body.data.content) {
    throw new Error('v1 text detail mismatch');
  }
} finally {
  await stopServer(server);
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log('TEXT_DETAIL_CLOSED_LOOP_OK');
