import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-text-save-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const sourcesRoot = path.join(tempRoot, 'sources');
const stateFile = path.join(tempRoot, 'library-state.json');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourcesRoot, { recursive: true });

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

async function waitForTask(base, taskId, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await request(base, `/api/item/thumbnailTask/status?taskId=${encodeURIComponent(taskId)}`);
    if (['complete', 'failed', 'cancelled'].includes(status.body.data.status)) return status.body.data;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`thumbnail task did not finish: ${taskId}`);
}

const editMd = path.join(sourcesRoot, 'edit.md');
const gbkTxt = path.join(sourcesRoot, 'gbk.txt');
const emptyTxt = path.join(sourcesRoot, 'empty.txt');
const surrogateTxt = path.join(sourcesRoot, 'surrogate.txt');
const notTextPng = path.join(projectRoot, 'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png');

fs.writeFileSync(editMd, '# Original\n\noriginal line\n', 'utf8');
fs.writeFileSync(gbkTxt, Buffer.from('d6d0cec4'.repeat(20) + '0a', 'hex'));
fs.writeFileSync(emptyTxt, '');
fs.writeFileSync(surrogateTxt, 'ok\n', 'utf8');

let server = await startServer();
try {
  const created = await post(server.base, '/api/library/create', { name: 'Text Save', savePath: librariesRoot });
  if (created.response.status !== 201) throw new Error(`library create failed: ${JSON.stringify(created.body)}`);
  const imported = await post(server.base, '/api/item/addFromPaths', {
    paths: [editMd, gbkTxt, emptyTxt, surrogateTxt, notTextPng],
  });
  if (imported.response.status !== 201 || imported.body.data.length !== 5) {
    throw new Error(`fixture import failed: ${JSON.stringify(imported.body)}`);
  }
  const items = new Map(imported.body.data.map((item) => [item.name, item]));
  for (const name of ['edit', 'gbk', 'empty', 'surrogate']) {
    const item = items.get(name);
    if (item.thumbnailTask) await waitForTask(server.base, item.thumbnailTask);
  }

  const missingId = await post(server.base, '/api/v2/item/textSave', { content: 'x', expectedMtimeMs: 1 });
  if (missingId.response.status !== 400 || missingId.body.code !== 'ITEM_ID_REQUIRED') {
    throw new Error(`missing id mismatch: ${JSON.stringify(missingId.body)}`);
  }
  const notFound = await post(server.base, '/api/v2/item/textSave', { id: 'NOT-FOUND', content: 'x', expectedMtimeMs: 1 });
  if (notFound.response.status !== 404 || notFound.body.code !== 'ITEM_NOT_FOUND') {
    throw new Error(`not found mismatch: ${JSON.stringify(notFound.body)}`);
  }
  const unsupported = await post(server.base, '/api/v2/item/textSave', {
    id: items.get('Welcome Library').id,
    content: 'x',
    expectedMtimeMs: 1,
  });
  if (unsupported.response.status !== 415 || unsupported.body.code !== 'TEXT_FORMAT_UNSUPPORTED') {
    throw new Error(`unsupported mismatch: ${JSON.stringify(unsupported.body)}`);
  }

  const editItem = items.get('edit');
  const editDetail = (await request(server.base, `/api/v2/item/textDetail?id=${encodeURIComponent(editItem.id)}`)).body.data;
  const noMtime = await post(server.base, '/api/v2/item/textSave', { id: editItem.id, content: 'x' });
  if (noMtime.response.status !== 400 || noMtime.body.code !== 'TEXT_SAVE_MTIME_REQUIRED') {
    throw new Error(`mtime required mismatch: ${JSON.stringify(noMtime.body)}`);
  }
  const conflict = await post(server.base, '/api/v2/item/textSave', {
    id: editItem.id,
    content: 'should not persist',
    expectedMtimeMs: editDetail.mtimeMs - 10_000,
  });
  if (conflict.response.status !== 409 || conflict.body.code !== 'TEXT_SAVE_CONFLICT') {
    throw new Error(`conflict mismatch: ${JSON.stringify(conflict.body)}`);
  }
  if (!fs.readFileSync(path.join(librariesRoot, 'Text Save.library', 'images', `${editItem.id}.info`, `${editItem.name}.md`), 'utf8').includes('Original')) {
    throw new Error('conflict save changed the original file');
  }

  const gbkItem = items.get('gbk');
  const gbkDetail = (await request(server.base, `/api/v2/item/textDetail?id=${encodeURIComponent(gbkItem.id)}`)).body.data;
  const gbkSaved = await post(server.base, '/api/v2/item/textSave', {
    id: gbkItem.id,
    content: gbkDetail.content,
    expectedMtimeMs: gbkDetail.mtimeMs,
  });
  if (gbkSaved.response.status !== 200 || gbkSaved.body.data.encoding !== 'gb18030') {
    throw new Error(`GBK encoding preservation failed: ${JSON.stringify(gbkSaved.body)}`);
  }
  const gbkAfter = (await request(server.base, `/api/v2/item/textDetail?id=${encodeURIComponent(gbkItem.id)}`)).body.data;
  if (!gbkAfter.content.includes('中文') || gbkAfter.encoding !== 'gb18030') {
    throw new Error(`GBK saved content mismatch: ${JSON.stringify(gbkAfter)}`);
  }

  const surrogateItem = items.get('surrogate');
  const surrogateDetail = (await request(server.base, `/api/v2/item/textDetail?id=${encodeURIComponent(surrogateItem.id)}`)).body.data;
  const unsupportedEncoding = await post(server.base, '/api/v2/item/textSave', {
    id: surrogateItem.id,
    content: '\ud800',
    expectedMtimeMs: surrogateDetail.mtimeMs,
  });
  if (unsupportedEncoding.response.status !== 422 || unsupportedEncoding.body.code !== 'TEXT_ENCODING_UNSUPPORTED') {
    throw new Error(`unsupported encoding mismatch: ${JSON.stringify(unsupportedEncoding.body)}`);
  }
  const surrogatePath = path.join(librariesRoot, 'Text Save.library', 'images', `${surrogateItem.id}.info`, `${surrogateItem.name}.txt`);
  if (fs.readFileSync(surrogatePath, 'utf8') !== 'ok\n') {
    throw new Error('unsupported encoding save changed the original file');
  }

  const saved = await post(server.base, '/api/v2/item/textSave', {
    id: editItem.id,
    content: '# Changed\n\nchanged line\n',
    expectedMtimeMs: editDetail.mtimeMs,
  });
  if (saved.response.status !== 200 || saved.body.data.size <= 0) {
    throw new Error(`save failed: ${JSON.stringify(saved.body)}`);
  }
  if (saved.body.data.thumbnailTask) await waitForTask(server.base, saved.body.data.thumbnailTask);
  const changedDetail = (await request(server.base, `/api/v2/item/textDetail?id=${encodeURIComponent(editItem.id)}`)).body.data;
  if (!changedDetail.content.includes('# Changed') || !changedDetail.content.includes('changed line')) {
    throw new Error(`saved content mismatch: ${JSON.stringify(changedDetail)}`);
  }
  const editInfoDir = path.join(librariesRoot, 'Text Save.library', 'images', `${editItem.id}.info`);
  if (!fs.existsSync(path.join(editInfoDir, `${editItem.name}_thumbnail.png`))) {
    throw new Error('saved text thumbnail was not rebuilt');
  }

  const undo = await post(server.base, '/api/v2/item/textUndo', { id: editItem.id });
  if (undo.response.status !== 200 || undo.body.data.size <= 0) {
    throw new Error(`undo failed: ${JSON.stringify(undo.body)}`);
  }
  if (undo.body.data.thumbnailTask) await waitForTask(server.base, undo.body.data.thumbnailTask);
  const undoneDetail = (await request(server.base, `/api/v2/item/textDetail?id=${encodeURIComponent(editItem.id)}`)).body.data;
  if (!undoneDetail.content.includes('# Original') || !undoneDetail.content.includes('original line')) {
    throw new Error(`undo content mismatch: ${JSON.stringify(undoneDetail)}`);
  }
  const secondUndo = await post(server.base, '/api/v2/item/textUndo', { id: editItem.id });
  if (secondUndo.response.status !== 404 || secondUndo.body.code !== 'TEXT_UNDO_UNAVAILABLE') {
    throw new Error(`second undo mismatch: ${JSON.stringify(secondUndo.body)}`);
  }

  const emptyItem = items.get('empty');
  const emptyDetail = (await request(server.base, `/api/v2/item/textDetail?id=${encodeURIComponent(emptyItem.id)}`)).body.data;
  const emptySaved = await post(server.base, '/api/v2/item/textSave', {
    id: emptyItem.id,
    content: 'hello',
    expectedMtimeMs: emptyDetail.mtimeMs,
  });
  if (emptySaved.response.status !== 200) throw new Error(`empty save failed: ${JSON.stringify(emptySaved.body)}`);
  const emptyAfter = (await request(server.base, `/api/v2/item/textDetail?id=${encodeURIComponent(emptyItem.id)}`)).body.data;
  if (emptyAfter.content !== 'hello') throw new Error('empty file save content mismatch');
} finally {
  await stopServer(server);
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log('TEXT_SAVE_CLOSED_LOOP_OK');
