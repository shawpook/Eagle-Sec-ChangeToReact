/**
 * 隔离栈跑 api-smoke（boot backend/thumbnail/extension → EAGLE_*_URL 环境注入 → 运行）。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-api-smoke-'));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
env.EAGLE_API_PORT = '41801';
env.EAGLE_THUMBNAIL_PORT = '41802';
env.EAGLE_EXTENSION_PORT = '41803';
env.EAGLE_LIBRARY_STATE_FILE = path.join(tempRoot, 'library-state.json');
env.EAGLE_USER_DATA_DIR = path.join(tempRoot, 'user-data');
env.EAGLE_ELECTRON_USER_DATA_DIR = path.join(tempRoot, 'electron-user-data');
env.EAGLE_API_URL = 'http://127.0.0.1:41801';
env.EAGLE_THUMBNAIL_URL = 'http://127.0.0.1:41802';
env.EAGLE_EXTENSION_URL = 'http://127.0.0.1:41803';

const procs = [];
for (const script of ['backend/src/server.js']) {
  const p = spawn(process.execPath, [script], { cwd: process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe'] });
  procs.push(p);
}
let out = '';
procs[0].stdout.on('data', (c) => { out += c; });
procs[0].stderr.on('data', (c) => { out += c; });

const deadline = Date.now() + 30000;
let up = false;
while (Date.now() < deadline) {
  try {
    const r = await fetch('http://127.0.0.1:41801/api/library/info');
    if (r.ok) { up = true; break; }
  } catch {}
  await new Promise((r) => setTimeout(r, 100));
}
if (!up) {
  console.error('BACKEND FAILED TO START:', out.slice(-500));
  procs.forEach((p) => p.kill());
  process.exit(1);
}
console.log('BACKEND UP');

const { spawnSync } = await import('node:child_process');
const r = spawnSync(process.execPath, ['tests/api-smoke.mjs'], { encoding: 'utf8', env, timeout: 120000 });
console.log(r.stdout || '');
if (r.stderr) console.error(r.stderr.slice(0, 500));
procs.forEach((p) => p.kill());
process.exit(r.status || 0);
