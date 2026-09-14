/**
 * R1：生产态一键启动——本地静态服务（dist/frontend）+ 后端 + Electron。
 * 与开发态的差别：不启动 Vite，Electron 的 EAGLE_PREVIEW_URL 指向 dist 静态服务。
 *
 * 环境变量可覆盖：EAGLE_FRONTEND_PORT(4173)、EAGLE_API_PORT、EAGLE_THUMBNAIL_PORT、EAGLE_EXTENSION_PORT。
 * 用法：npm run start:prod（先 npm run build）
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(projectRoot, 'dist', 'frontend');
if (!fs.existsSync(path.join(distRoot, 'src', 'app', 'index.html'))) {
  console.error(`FAIL 产物缺失：${distRoot}（先运行 npm run build）`);
  process.exit(1);
}

const frontendPort = process.env.EAGLE_FRONTEND_PORT || '4173';
const apiPort = process.env.EAGLE_API_PORT || '41695';
const thumbnailPort = process.env.EAGLE_THUMBNAIL_PORT || '41692';
const extensionPort = process.env.EAGLE_EXTENSION_PORT || '41693';
const electronExecutable = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');

const env = {
  ...process.env,
  EAGLE_FRONTEND_PORT: frontendPort,
  EAGLE_FRONTEND_ROOT: distRoot,
  EAGLE_THUMBNAIL_URL: `http://localhost:${thumbnailPort}`,
  EAGLE_API_PORT: apiPort,
  EAGLE_THUMBNAIL_PORT: thumbnailPort,
  EAGLE_EXTENSION_PORT: extensionPort,
};

const children = [];
function run(command, args, childEnv, label) {
  const child = spawn(command, args, { cwd: projectRoot, env: childEnv, stdio: 'inherit' });
  child.on('exit', (code) => { if (code) console.error(`[start:prod] ${label} exited ${code}`); });
  children.push(child);
  return child;
}

run(process.execPath, ['scripts/serve-frontend.mjs'], env, 'serve-frontend');
run(process.execPath, ['backend/src/server.js'], env, 'backend');
run(electronExecutable, ['electron/main.cjs'], {
  ...env,
  EAGLE_API_URL: `http://localhost:${apiPort}`,
  EAGLE_PREVIEW_URL: `http://127.0.0.1:${frontendPort}/src/app/index.html`,
}, 'electron');

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { for (const child of children) { try { child.kill(); } catch {} } process.exit(0); });
}
