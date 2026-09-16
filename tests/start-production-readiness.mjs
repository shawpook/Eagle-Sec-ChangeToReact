/**
 * M5-2（F22）：生产启动失败必须在开窗前可观测。
 *
 * 占住 API 端口，强制 backend 子进程提前失败；断言 start-production：
 *   - 非零退出；
 *   - 输出明确的 readiness FAIL；
 *   - 不出现 “launching Electron”，调试端口也不会出现。
 *
 * 用法：npm run build && node tests/start-production-readiness.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { delay, freePort, waitFor } from './react-cdp-harness.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distIndex = path.join(projectRoot, 'dist', 'frontend', 'src', 'app', 'index.html');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-production-fail-'));

if (!fs.existsSync(distIndex)) {
  console.error(`FAIL 产物缺失：${distIndex}（先运行 npm run build）`);
  process.exit(1);
}

function spawnLogged(command, args, env) {
  const child = spawn(command, args, { cwd: projectRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  return { child, output: () => output };
}

async function listenOn(port) {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return server;
}

async function closeServer(server) {
  if (!server) return;
  server.closeAllConnections?.();
  await Promise.race([
    new Promise((resolve) => server.close(resolve)),
    delay(1000),
  ]);
}

let occupied = null;
let stack = null;

try {
  const [frontendPort, apiPort, thumbnailPort, extensionPort, debugPort] = await Promise.all([
    freePort(), freePort(), freePort(), freePort(), freePort(),
  ]);
  occupied = await listenOn(apiPort);

  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  for (const key of [
    'EAGLE_FRONTEND_PORT', 'EAGLE_API_PORT', 'EAGLE_THUMBNAIL_PORT', 'EAGLE_EXTENSION_PORT',
    'EAGLE_API_URL', 'EAGLE_THUMBNAIL_URL', 'EAGLE_EXTENSION_URL', 'EAGLE_PREVIEW_URL',
  ]) {
    delete env[key];
  }

  stack = spawnLogged(process.execPath, ['scripts/start-production.mjs'], {
    ...env,
    EAGLE_FRONTEND_PORT: String(frontendPort),
    EAGLE_API_PORT: String(apiPort),
    EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
    EAGLE_EXTENSION_PORT: String(extensionPort),
    EAGLE_DEBUG_PORT: String(debugPort),
    EAGLE_START_READY_TIMEOUT_MS: '3000',
    EAGLE_LIBRARY_STATE_FILE: path.join(tempRoot, 'library-state.json'),
    EAGLE_USER_DATA_DIR: path.join(tempRoot, 'backend-user-data'),
    EAGLE_ELECTRON_USER_DATA_DIR: path.join(tempRoot, 'electron-user-data'),
  });

  const exit = await waitFor(() => {
    if (stack.child.exitCode !== null) return { code: stack.child.exitCode, signal: stack.child.signalCode };
    return null;
  }, 'start-production failure exit', 15000);

  const output = stack.output();
  assert.notEqual(exit.code, 0, `start-production 必须在就绪失败时非零退出：${JSON.stringify(exit)}`);
  assert.match(output, /\[start:prod\] FAIL /, `缺少可观测 FAIL：\n${output}`);
  assert.match(output, /backend.*(?:提前退出|无法启动)|backend-api.*未就绪/s, `缺少 backend 就绪失败原因：\n${output}`);
  assert.ok(!output.includes('all services ready; launching Electron'), '就绪失败时不得拉起 Electron');

  await delay(300);
  let debugEndpointAbsent = false;
  try {
    await fetch(`http://127.0.0.1:${debugPort}/json/list`, { signal: AbortSignal.timeout(500) });
  } catch {
    debugEndpointAbsent = true;
  }
  assert.equal(debugEndpointAbsent, true, `就绪失败后 Electron 调试端口仍存在：${debugPort}`);

  const failLine = output.split(/\r?\n/).find((line) => line.includes('[start:prod] FAIL '));
  console.log(`PASS start-production fail-fast ${JSON.stringify({ exit, failLine })}`);
  console.log('START_PRODUCTION_READINESS_FAILURE_OK');
} catch (err) {
  console.error(`START_PRODUCTION_READINESS_FAILURE_FAILED ${err.stack || err.message}`);
  if (stack) console.error(stack.output().slice(-8000));
  process.exitCode = 1;
} finally {
  try { stack?.child.kill(); } catch {}
  await closeServer(occupied);
  try {
    fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch {}
}
