import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

// b1-9ae：后台窗通道族闭环——真实渲染层 ipcRenderer.send → main.cjs b1-9aa handler →
// backend 数据面。六通道逐一驱动并断言数据面效果；open-with-dialog 为静态接线审计
// （真弹 rundll32 对话框会挂测试机，故只验证 handler 注册存在）。
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nodeExecutable = process.execPath;
const electronExecutable = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-channel-wiring-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const sourcesRoot = path.join(tempRoot, 'sources');
const smokeOut = path.join(tempRoot, 'out');
const stateFile = path.join(tempRoot, 'library-state.json');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourcesRoot, { recursive: true });
fs.mkdirSync(smokeOut, { recursive: true });

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
    try {
      value = await check();
    } catch (err) {
      value = null;
    }
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

const [apiPort, thumbnailPort, extensionPort] = await Promise.all([freePort(), freePort(), freePort()]);
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
let backend = spawnLogged(nodeExecutable, ['backend/src/server.js'], backendEnv);
let electron;
try {
  await waitFor(() => backend.output().includes(`localhost:${apiPort}`), 'backend startup');

  const createResponse = await fetch(`http://127.0.0.1:${apiPort}/api/library/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Channel Wiring Smoke', savePath: librariesRoot }),
  });
  const createBody = await createResponse.json();
  if (!createResponse.ok || createBody.status !== 'success') {
    throw new Error(`Library create failed: ${JSON.stringify(createBody)}`);
  }

  const sourceOne = path.join(sourcesRoot, 'Channels One.png');
  const sourceTwo = path.join(sourcesRoot, 'Channels Two.png');
  const redSource = path.join(sourcesRoot, 'custom-thumb-red.png');
  createPng(sourceOne, [25, 60, 210]);
  createPng(sourceTwo, [30, 180, 90]);
  createPng(redSource, [230, 25, 20], 75, 45);
  const importResponse = await fetch(`http://127.0.0.1:${apiPort}/api/item/addFromPaths`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images: [{ path: sourceOne, name: 'Channels One' }, { path: sourceTwo, name: 'Channels Two' }] }),
  });
  const importBody = await importResponse.json();
  if (!importResponse.ok || importBody.status !== 'success') {
    throw new Error(`Fixture import failed: ${JSON.stringify(importBody)}`);
  }
  const itemIds = importBody.data.map((item) => item.id);

  electron = spawnLogged(electronExecutable, ['electron/main.cjs', '--smoke-channels'], {
    ...baseEnv,
    EAGLE_API_URL: `http://127.0.0.1:${apiPort}`,
    EAGLE_THUMBNAIL_URL: `http://127.0.0.1:${thumbnailPort}`,
    EAGLE_ELECTRON_USER_DATA_DIR: path.join(tempRoot, 'electron-user-data'),
    EAGLE_CHANNELS_SMOKE_OUT: smokeOut,
    EAGLE_CHANNELS_SMOKE_THUMB: redSource,
  });

  const output = await waitFor(() => {
    const text = electron.output();
    if (text.includes('CHANNELS_SMOKE_OK')) return text;
    if (text.includes('CHANNELS_SMOKE_ERROR') || text.includes('CHANNELS_SMOKE_TIMEOUT') || electron.child.exitCode !== null) {
      throw new Error(`Channels smoke failed:\n${text}`);
    }
    return null;
  }, 'channels smoke', 120000);

  const line = output.match(/CHANNELS_SMOKE_OK[^\r\n]*/)?.[0];
  if (!line) throw new Error(`Missing channels smoke result:\n${output}`);
  const result = JSON.parse(line.slice('CHANNELS_SMOKE_OK '.length));

  // 六通道数据面断言（copyThumbnails 在 OS 剪贴板楔死时为 'skipped-clipboard-wedged'，
  // driver 自检探针决定——响亮跳过而非静默放水）
  const required = ['duplicateFile', 'exportAsFolder', 'exportImages', 'regenerateThumbnail', 'setCustomThumbnail', 'thumbnailGeneratedEcho'];
  const failed = required.filter((key) => result[key] !== true);
  if (result.copyThumbnails === true) {
    console.log('CHANNELS copy-thumbnails asserted');
  } else if (result.copyThumbnails === 'skipped-clipboard-wedged') {
    console.log('CHANNELS copy-thumbnails SKIPPED (OS clipboard wedged — Set-Clipboard/OpenClipboard fail machine-wide)');
  } else {
    failed.push('copyThumbnails');
  }
  if (failed.length > 0) {
    throw new Error(`Channel wiring assertions failed for: ${failed.join(', ')} — ${JSON.stringify(result)}`);
  }

  // 独立 fs 复核：as-folder 产物 + .eaglepack 落盘
  const asFolderDir = path.join(smokeOut, 'as-folder');
  const exported = fs.readdirSync(asFolderDir);
  if (exported.length === 0) throw new Error('export-as-folder produced no files (fs recheck)');
  if (!fs.existsSync(path.join(smokeOut, 'Export.eaglepack'))) throw new Error('export-images produced no .eaglepack (fs recheck)');

  // open-with-dialog 静态接线审计（handler 注册 + rundll32 调用形状；不真弹窗）
  const mainSource = fs.readFileSync(path.join(projectRoot, 'electron', 'main.cjs'), 'utf8');
  if (!mainSource.includes("ipcMain.on('open-with-dialog'")) throw new Error('open-with-dialog handler not registered in main.cjs');
  if (!mainSource.includes('OpenAs_RunDLLW')) throw new Error('open-with-dialog rundll32 invocation missing');

  console.log(`CHANNEL_WIRING_CLOSED_LOOP_OK ${JSON.stringify({ itemIds, result, exportedCount: exported.length })}`);
} finally {
  await stop(electron);
  await stop(backend);
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
