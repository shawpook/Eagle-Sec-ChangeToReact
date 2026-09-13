/**
 * P1-c-2 验证②：真实持久化测试（独立临时库 + 真实后端，编辑 → 保存 → 重启读回）。
 *
 * 不绑定整套导入/剪贴板工作流：fixture 仅经后端 API 直灌两条 PNG；编辑用真实入口
 * （inspectorActions.imagesChange / annotationChange、scope.TagManager.addTags /
 * scope.addImagesToFolder / scope.changeStar），每次编辑后经 window.eagleDesktop.library.current()
 * （真实后端）轮询到落库；随后重启同一库同一 user-data 再做读回断言。
 *
 * 覆盖：改名+URL、注释、标签、评分、文件夹归属、多选评分。
 * （替身测试通过 ≠ 落盘正确——本测试是落盘的直接证据。）
 * 迁移前后各跑 3 次（基线先行）。
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
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-item-persist-'));

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

  // fixture 库 + 文件夹 + 两条 PNG（不经 UI 导入，聚焦编辑/保存/重启读回）
  const createResponse = await fetch(`http://127.0.0.1:${apiPort}/api/library/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Item Persist Smoke', savePath: fs.mkdirSync(path.join(tempRoot, 'libraries'), { recursive: true }) }),
  });
  const createBody = await createResponse.json();
  if (!createResponse.ok || createBody.status !== 'success') throw new Error(`Library create failed: ${JSON.stringify(createBody)}`);

  const folderResponse = await fetch(`http://127.0.0.1:${apiPort}/api/folder/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '持续化目标文件夹' }),
  });
  const folderBody = await folderResponse.json();
  if (!folderResponse.ok || folderBody.status !== 'success') throw new Error(`Folder create failed: ${JSON.stringify(folderBody)}`);
  const folderId = folderBody.data && (folderBody.data.id || (folderBody.data.folder && folderBody.data.folder.id)) || (folderBody.data && folderBody.data.folders && folderBody.data.folders[0] && folderBody.data.folders[0].id) || '';

  const sourceOne = path.join(tempRoot, 'ps-one.png');
  const sourceTwo = path.join(tempRoot, 'ps-two.png');
  createPng(sourceOne, [25, 60, 210]);
  createPng(sourceTwo, [220, 30, 90]);
  const importResponse = await fetch(`http://127.0.0.1:${apiPort}/api/item/addFromPaths`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images: [{ path: sourceOne, name: 'PS One' }, { path: sourceTwo, name: 'PS Two' }] }),
  });
  const importBody = await importResponse.json();
  if (!importResponse.ok || importBody.status !== 'success') throw new Error(`Fixture import failed: ${JSON.stringify(importBody)}`);
  const itemIds = (importBody.data || []).map((item) => item && item.id).filter(Boolean);
  if (itemIds.length < 2) throw new Error(`Fixture import returned <2 items: ${JSON.stringify(importBody)}`);

  const electronEnv = {
    ...backendEnv,
    EAGLE_API_URL: `http://localhost:${apiPort}`,
    EAGLE_ELECTRON_USER_DATA_DIR: path.join(tempRoot, 'electron-user-data'),
    EAGLE_PERSISTENCE_FOLDER_ID: folderId,
    EAGLE_PERSISTENCE_IDS: itemIds.join(','),
    EAGLE_PREVIEW_URL: `http://localhost:${vitePort}/src/app/index.html`,
  };
  const runPhase = async (phase) => {
    electron = spawnLogged(electronExecutable, ['electron/main.cjs', '--smoke-persistence'], {
      ...electronEnv,
      EAGLE_PERSISTENCE_PHASE: phase,
    });
    const output = await waitFor(() => {
      const text = electron.output();
      if (text.includes('PERSIST_SMOKE_DONE') || text.includes('PERSIST_SMOKE_ERROR') || text.includes('PERSIST_SMOKE_TIMEOUT')) return text;
      return null;
    }, `persistence ${phase}`, 150000);
    const doneMatch = output.match(/PERSIST_SMOKE_DONE (.+)$/m);
    if (!doneMatch) throw new Error(`Persistence ${phase} smoke failed:\n${output.slice(-4000)}`);
    await stop(electron);
    electron = null;
    return JSON.parse(doneMatch[1]);
  };

  const editReport = await runPhase('edit');
  if (editReport.error) throw new Error('edit driver error: ' + editReport.error);
  const requiredSteps = ['stepRename', 'stepAnnotation', 'stepTags', 'stepStar', 'stepFolder', 'stepMultiStar'];
  for (const step of requiredSteps) {
    if (!editReport[step]) throw new Error('edit step missing ' + step + ': ' + JSON.stringify(editReport).slice(0, 800));
  }

  // 重启同一库同一 user-data → 读回断言
  const checkReport = await runPhase('check');
  if (checkReport.error) throw new Error('check driver error: ' + checkReport.error);
  if (!checkReport.ok) throw new Error('persistence check failed: ' + JSON.stringify(checkReport.check));
  const a = checkReport.check.id1;
  if (!a || a.name !== 'Persist-Renamed' || a.url !== 'https://persist.test/url' || a.annotation !== 'Persist-Anno'
    || a.star !== 3 || !a.tags.includes('persist-tag-a') || !a.tags.includes('persist-tag-b') || !a.folders.includes(folderId)) {
    throw new Error('persisted field mismatch: ' + JSON.stringify(a));
  }
  if (!checkReport.check.id2 || checkReport.check.id2.star !== 3) {
    throw new Error('persisted multi star mismatch: ' + JSON.stringify(checkReport.check.id2));
  }

  console.log(`ITEM_PERSISTENCE_CLOSED_LOOP_OK edit=${requiredSteps.length}steps check=${JSON.stringify(checkReport.check)}`);
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
if (failure) { console.log('ITEM_PERSISTENCE_CLOSED_LOOP FAIL'); process.exit(1); }