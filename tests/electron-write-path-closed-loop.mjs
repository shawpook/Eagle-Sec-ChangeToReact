/**
 * P1-c-2 验证①：Electron 写路径测试（main→backend 边界替身）。
 *
 * 链路保持生产形态：真实 renderer（React + channelBridge/shims 路由）→ 真实 preload/IPC →
 * 真实 main.cjs 处理器；仅在 `ipcMain.handle('item:update-many') → apiRequest(/api/item/updateMany)`
 * 的边界注入可控替身（EAGLE_WRITE_STUB_DIR/control.json：delayMs / failNext），
 * 替身把每次写入快照追加到 requests.jsonl 并回显（等价真实后端 data）。其余请求全部真实转发。
 *
 * 断言（对照 stub 日志 + 渲染层报告，无自动重试）：
 *  - 单路由：每次编辑恰好 1 条 updateMany 请求（无双重路由/重复触发）；
 *  - 入队快照：快速连续改名时，请求 2 的快照仍为第一个名字（后续 live 变更不影响已排队请求）；
 *  - 写入顺序：请求 seq 递增且与编辑顺序一致；
 *  - 延迟响应：delayMs 生效且顺序保持；
 *  - 失败隔离：failNext 触发 ok:false 的 item:operation-result，随后写入仍成功；
 *  - 多选编辑：1 次 updateMany 携带 2 条快照、image.changed 各 2 条；
 *  - changeStar 同样只产生 1 次请求。
 *
 * 迁移前后各跑 3 次（基线先行），同一组断言验证迁移结果。
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nodeExecutable = process.execPath;
const electronExecutable = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-write-path-'));

function createPng(filePath, color, width = 96, height = 64) {
  const image = new PNG({ width, height });
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 4;
    image.data[offset] = color[0];
    image.data[offset + 1] = color[1];
    image.data[offset + 2] = color[2];
    image.data[offset + 3] = 255;
  }
  fs.writeFileSync(filePath, PNG.sync.write(image));
}

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
    let value;
    try { value = await check(); } catch (err) { value = null; }
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
    const timer = setTimeout(resolve, 3000);
    processInfo.child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}

let failure = null;
let backend = null;
let electron = null;
let vite = null;
try {
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
    EAGLE_LIBRARY_STATE_FILE: path.join(tempRoot, 'library-state.json'),
    EAGLE_USER_DATA_DIR: path.join(tempRoot, 'user-data'),
  };
  backend = spawnLogged(nodeExecutable, ['backend/src/server.js'], backendEnv);
  await waitFor(() => backend.output().includes(`localhost:${apiPort}`), 'backend startup');
  vite = spawnLogged(nodeExecutable, ['node_modules/vite/bin/vite.js', '--config', 'frontend/vite.preview.config.mjs', '--port', String(vitePort)], {
    ...baseEnv,
    EAGLE_API_URL: `http://localhost:${apiPort}`,
    EAGLE_THUMBNAIL_URL: `http://localhost:${thumbnailPort}`,
    EAGLE_EXTENSION_URL: `http://localhost:${extensionPort}`,
  });
  await waitFor(async () => (await fetch(`http://localhost:${vitePort}/src/app/index.html`)).ok, 'vite startup');

  // fixture 库 + 两条 PNG：保证 `library.current()` 种子确定性（不依赖内置 mock 种子竞态；
  // 持久化本体由替身取代，断言只针对路由/队列/事件）。
  fs.mkdirSync(path.join(tempRoot, 'libraries'), { recursive: true });
  const createResponse = await fetch(`http://127.0.0.1:${apiPort}/api/library/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Write Path Smoke', savePath: path.join(tempRoot, 'libraries') }),
  });
  const createBody = await createResponse.json();
  if (!createResponse.ok || createBody.status !== 'success') throw new Error(`Library create failed: ${JSON.stringify(createBody)}`);

  const sourceOne = path.join(tempRoot, 'wp-one.png');
  const sourceTwo = path.join(tempRoot, 'wp-two.png');
  createPng(sourceOne, [25, 60, 210]);
  createPng(sourceTwo, [30, 180, 90]);
  const importResponse = await fetch(`http://127.0.0.1:${apiPort}/api/item/addFromPaths`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images: [{ path: sourceOne, name: 'WP One' }, { path: sourceTwo, name: 'WP Two' }] }),
  });
  const importBody = await importResponse.json();
  if (!importResponse.ok || importBody.status !== 'success') throw new Error(`Fixture import failed: ${JSON.stringify(importBody)}`);

  const stubDir = path.join(tempRoot, 'write-stub');
  fs.mkdirSync(stubDir, { recursive: true });
  fs.writeFileSync(path.join(stubDir, 'control.json'), JSON.stringify({ failNext: 0, delayMs: 0 }));
  fs.writeFileSync(path.join(stubDir, 'requests.jsonl'), '');

  electron = spawnLogged(electronExecutable, ['electron/main.cjs', '--smoke-write-path'], {
    ...backendEnv,
    EAGLE_API_URL: `http://localhost:${apiPort}`,
    EAGLE_ELECTRON_USER_DATA_DIR: path.join(tempRoot, 'electron-user-data'),
    EAGLE_WRITE_STUB_DIR: stubDir,
    EAGLE_PREVIEW_URL: `http://localhost:${vitePort}/src/app/index.html`,
  });

  const output = await waitFor(() => {
    const text = electron.output();
    if (text.includes('WRITE_PATH_SMOKE_DONE') || text.includes('WRITE_PATH_SMOKE_ERROR') || text.includes('WRITE_PATH_SMOKE_TIMEOUT')) return text;
    return null;
  }, 'write path smoke', 150000);

  const doneMatch = output.match(/WRITE_PATH_SMOKE_DONE (.+)$/m);
  if (!doneMatch) throw new Error(`Write path smoke failed:\n${output.slice(-4000)}`);

  const { report, requests } = JSON.parse(doneMatch[1]);
  const fail = (msg) => { throw new Error('WRITE_PATH_CLOSED_LOOP FAIL: ' + msg + '\nreport=' + JSON.stringify(report) + '\nrequests=' + JSON.stringify(requests)); };

  if (report.error) fail('driver error: ' + report.error);
  const firstItemName = (op) => Array.isArray(op && op.items) && op.items[0] ? op.items[0].name : null;
  if (report.ops.length !== 8) fail('expected 8 ops, got ' + report.ops.length);
  if (!report.step1 || report.step1.ok !== true) fail('step1 not ok');
  if (firstItemName(report.step1) !== 'Rename-A') fail('step1 name mismatch: ' + firstItemName(report.step1));
  // 入队快照：快速连续改名，两次请求的名字必须分别是 Snap-A / Snap-B（顺序保持）
  if (firstItemName(report.step2a) !== 'Snap-A' || firstItemName(report.step2b) !== 'Snap-B') {
    fail('snapshot-at-enqueue broken: ' + firstItemName(report.step2a) + ' / ' + firstItemName(report.step2b));
  }
  if (!report.step3 || report.step3.ok !== true) fail('step3 not ok');
  if (report.step3Ms < 150) fail('delay not applied: ' + report.step3Ms + 'ms');
  if (report.step4 && report.step4.ok !== false) fail('step4 should be ok:false (forced failure), got ' + JSON.stringify(report.step4).slice(0, 200));
  if (report.step5 && report.step5.ok !== true) fail('step5 should recover ok:true');
  // 多选：1 次 updateMany 2 条快照；image.changed 各 2 条
  if (!report.step6 || report.step6.ok !== true) fail('step6 not ok');
  if (!Array.isArray(report.step6.items) || report.step6.items.length !== 2) fail('step6 should carry 2 items');
  const changedSet = (report.multiChanged || []).slice().sort().join(',');
  const idSet = (report.ops[6] && report.ops[6].items || []).map((it) => it.id).sort().join(',');
  if (changedSet !== idSet || !changedSet) fail('multi image.changed mismatch: ' + changedSet + ' vs ' + idSet);
  if (!report.step7 || report.step7.ok !== true) fail('step7 not ok');
  if (!report.step7.items || report.step7.items[0].star !== 3) fail('step7 star mismatch');

  // stub 日志：单路由 + 顺序 + 快照
  if (!Array.isArray(requests) || requests.length !== 8) fail('expected 8 updateMany requests, got ' + (requests && requests.length));
  requests.forEach((r, index) => {
    if (r.seq !== index + 1) fail('request order broken at index ' + index + ': seq=' + r.seq);
    if (!r.body || !Array.isArray(r.body.items)) fail('request without items at index ' + index);
  });
  const names = requests.map((r) => r.body.items[0] && r.body.items[0].name);
  if (names[0] !== 'Rename-A' || names[1] !== 'Snap-A' || names[2] !== 'Snap-B' || names[3] !== 'Delay-C' || names[4] !== 'Fail-D' || names[5] !== 'Fail-E' || names[6] !== 'Multi-X') {
    fail('request snapshot sequence mismatch: ' + JSON.stringify(names));
  }
  if (requests[6].body.items.length !== 2) fail('multi request should carry 2 items');
  if (requests[7].body.items[0].star !== 3) fail('star request mismatch');

  console.log(`WRITE_PATH_CLOSED_LOOP_OK ops=${report.ops.length} reqs=${requests.length} seq=${names.join('>')}`);
} catch (err) {
  failure = err;
} finally {
  await stop(electron);
  await stop(vite);
  await stop(backend);
  if (failure) {
    console.error(failure.message || String(failure));
    if (electron) console.error(electron.output().slice(-3000));
  }
}
if (failure) { console.log('WRITE_PATH_CLOSED_LOOP FAIL'); process.exit(1); }