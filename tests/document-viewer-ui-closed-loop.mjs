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
/** 应用菜单弹窗捕获落盘位置（供断言「点击 hamburger 真的弹出 File/View/Help」）。 */
const menuCapturesFile = path.join(tempRoot, 'menu-popups.json');
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
  // F-DOC-3：第二个文档用于验证顶栏「上/下一篇」真的能切走。
  // 只有一个素材时 hasNext 恒为 false，导航缺陷会被掩盖。
  const secondSource = path.join(tempRoot, 'Viewer Sibling.md');
  const secondText = 'Viewer 兄弟文档 第二篇';
  fs.writeFileSync(secondSource, `# ${secondText}\n\n- 第二篇内容\n`, 'utf8');

  await postJson(apiBase, '/api/library/create', { name: 'Document Viewer UI', savePath: librariesRoot });
  const imported = await postJson(apiBase, '/api/item/addFromPaths', { paths: [markdownSource, secondSource] });
  const item = imported.find((entry) => entry && entry.id);
  const sibling = imported.find((entry) => entry && entry.id && entry.id !== item.id);

  electron = spawnLogged(electronExecutable, ['electron/main.cjs', '--smoke-document-viewer'], {
    ...baseEnv,
    EAGLE_API_URL: apiBase,
    EAGLE_THUMBNAIL_URL: thumbnailBase,
    EAGLE_PREVIEW_URL: previewUrl,
    EAGLE_DOCVIEWER_ITEM_ID: item.id,
    EAGLE_DOCVIEWER_EXPECTED_TEXT: expectedText,
    EAGLE_DOCVIEWER_SIBLING_ID: sibling ? sibling.id : '',
    EAGLE_DOCVIEWER_SIBLING_TEXT: secondText,
    EAGLE_ELECTRON_USER_DATA_DIR: path.join(tempRoot, 'electron-user-data'),
    // 应用菜单（hamburger）弹窗捕获：原生 popup 无法被 CDP 观察且会阻塞会话，
    // 故开启菜单冒烟模式，把模板序列化后回传断言（见 main.cjs smoke:menu-popup）。
    EAGLE_MENU_SMOKE: '1',
    EAGLE_MENU_SMOKE_OUT: menuCapturesFile,
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

  // ── 应用菜单（hamburger）端到端：文档态点击后必须真的弹出应用菜单 ──
  // 断言真实按钮点击 → main 侧序列化的菜单模板含 File / View（含子菜单）/ Help。
  // 这才是「挖出来的按钮真的能用」，而非仅仅「按钮存在且可见」。
  let appMenuCaptures = [];
  try {
    appMenuCaptures = JSON.parse(fs.readFileSync(menuCapturesFile, 'utf8'));
  } catch (err) {
    appMenuCaptures = [];
  }
  const appMenu = appMenuCaptures.find((entry) => entry && entry.site === 'application-menu');
  if (!appMenu) {
    throw new Error(`hamburger click did not open the application menu (no capture at ${menuCapturesFile})`);
  }
  const appLabels = (appMenu.items || []).map((it) => it.label);
  if (!appLabels.includes('File') || !appLabels.includes('View') || !appLabels.includes('Help')) {
    throw new Error(`application menu template incomplete: ${JSON.stringify(appLabels)}`);
  }
  const fileEntry = (appMenu.items || []).find((it) => it.label === 'File');
  if (!fileEntry || !fileEntry.submenu) {
    throw new Error(`File menu has no submenu: ${JSON.stringify(fileEntry)}`);
  }
  console.log(`DOC_APP_MENU_OK labels=${JSON.stringify(appLabels)} fileSubmenu=${fileEntry.submenu}`);

  await stop(electron);
} finally {
  await stop(electron);
  await stop(vite);
  await stop(backend);
  try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
}

console.log('DOCUMENT_VIEWER_UI_CLOSED_LOOP_OK');
