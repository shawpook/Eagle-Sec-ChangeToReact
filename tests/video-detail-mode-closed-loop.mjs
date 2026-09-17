import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fork, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nodeExecutable = process.execPath;
const electronExecutable = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-video-detail-'));
const stateFile = path.join(tempRoot, 'library-state.json');
const librariesRoot = path.join(tempRoot, 'libraries');
const sourcesRoot = path.join(tempRoot, 'sources');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourcesRoot, { recursive: true });

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

async function createVideoFixture(output, env) {
  return new Promise((resolve, reject) => {
    const child = fork(path.join(projectRoot, 'tests', 'video-fixture-worker.cjs'), [], {
      execPath: electronExecutable,
      cwd: projectRoot,
      env: { ...env, EAGLE_VIDEO_FIXTURE_OUTPUT: output },
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.once('message', (message) => {
      if (message && message.ok) resolve(output);
      else reject(new Error(message && message.error || stderr || 'Video fixture generation failed'));
    });
    child.once('error', reject);
  });
}

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
  EAGLE_LIBRARY_STATE_FILE: stateFile,
  EAGLE_USER_DATA_DIR: path.join(tempRoot, 'user-data'),
};
const backend = spawnLogged(nodeExecutable, ['backend/src/server.js'], backendEnv);
const vite = spawnLogged(nodeExecutable, [
  'node_modules/vite/bin/vite.js',
  '--config',
  'frontend/vite.preview.config.mjs',
  '--port',
  String(vitePort),
  '--strictPort',
], {
  ...baseEnv,
  EAGLE_THUMBNAIL_URL: `http://127.0.0.1:${thumbnailPort}`,
});
let electron;

try {
  await waitFor(() => backend.output().includes(`localhost:${apiPort}`), 'backend startup');
  await waitFor(async () => {
    try {
      return (await fetch(`http://127.0.0.1:${vitePort}/src/app/index.html`)).ok;
    } catch (err) {
      return false;
    }
  }, 'Vite startup');
  const createResponse = await fetch(`http://127.0.0.1:${apiPort}/api/library/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Video Detail Mode', savePath: librariesRoot }),
  });
  const createBody = await createResponse.json();
  if (!createResponse.ok || createBody.status !== 'success') throw new Error(`Library create failed: ${JSON.stringify(createBody)}`);
  const videoSource = path.join(sourcesRoot, 'Detail Video.webm');
  await createVideoFixture(videoSource, baseEnv);
  const importResponse = await fetch(`http://127.0.0.1:${apiPort}/api/item/addFromPaths`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images: [{ path: videoSource, name: 'Detail Video' }] }),
  });
  const importBody = await importResponse.json();
  if (!importResponse.ok || importBody.status !== 'success') throw new Error(`Video import failed: ${JSON.stringify(importBody)}`);

  electron = spawnLogged(electronExecutable, ['electron/main.cjs', '--smoke-video-detail'], {
    ...baseEnv,
    EAGLE_API_URL: `http://127.0.0.1:${apiPort}`,
    EAGLE_THUMBNAIL_URL: `http://127.0.0.1:${thumbnailPort}`,
    EAGLE_PREVIEW_URL: `http://127.0.0.1:${vitePort}/src/app/index.html`,
    EAGLE_ELECTRON_USER_DATA_DIR: path.join(tempRoot, 'electron-user-data'),
  });
  const output = await waitFor(() => {
    const text = electron.output();
    if (text.includes('VIDEO_DETAIL_SMOKE_OK')) return text;
    if (text.includes('VIDEO_DETAIL_SMOKE_FAIL') || text.includes('VIDEO_DETAIL_SMOKE_ERROR') || electron.child.exitCode !== null) {
      throw new Error(`Video detail smoke failed:\n${text}`);
    }
    return null;
  }, 'video detail smoke', 90000);
  const line = output.match(/VIDEO_DETAIL_SMOKE_OK[^\r\n]*/)?.[0];
  if (!line) throw new Error(`Missing video detail success output:\n${output}`);
  const result = JSON.parse(line.slice('VIDEO_DETAIL_SMOKE_OK '.length));
  if (!result.detailMode || !result.player || result.player.error || result.player.videoWidth <= 0 || !result.interaction) {
    throw new Error(`Video detail mode was not proven: ${JSON.stringify(result)}`);
  }
  // F-VP-1（2026-09-17）：video.js 引擎接线与播放器 UI 的独立判据。
  // 背景：迁移后主窗只保留了 video-js.css，`window.videojs` 恒 undefined，useMediaElement
  // 首次 loadedmetadata 执行 videojs()(video, {...}) 抛 TypeError，自动播放/控件条/字幕/
  // 批注全部中断 —— 用户可感知为「视频素材点开无法播放」。而仅断言 videoWidth>0 无法覆盖
  // 该缺陷（原生 <video> 无 videojs 亦能解码），故此处把引擎与控件条升为硬性判据。
  const engine = result.videojsEngine || {};
  if (engine.type !== 'function' || engine.hasGetComponent !== true) {
    throw new Error(`video.js engine not wired into main window: ${JSON.stringify(engine)}`);
  }
  if (!Array.isArray(engine.scriptTags) || !engine.scriptTags.some((src) => /vendors\/videojs\/video\.js/.test(String(src)))) {
    throw new Error(`video.js vendor script tag missing from main window: ${JSON.stringify(engine)}`);
  }
  const controlBar = result.controlBar || {};
  if (controlBar.missing || !(controlBar.controlBars > 0) || !(controlBar.techEls > 0)) {
    throw new Error(`video.js player UI not initialized (controls not mounted): ${JSON.stringify(controlBar)}`);
  }
  // F-VP-1c（2026-09-17）：控件条「DOM 在场」不等于「可见」。
  // `#detail-container` 默认带 `width: 20000px`（图片缩放虚拟画布），必须由
  // `is-video` 类经 `.is-video { width: 100% !important }` 覆盖回视口宽；一旦该类型类
  // 因类型表取值断链而缺席，容器撑到 20000px、控件条随之溢出视口 —— 用户可感知为
  // 「视频能播放但没有控件条 / 右键扩展菜单唤不出」。仅断言控件条存在无法发现该缺陷。
  const detail = result.controlBarDetail || {};
  const cls = String(detail.detailContainerClass || '');
  if (!/\bis-video\b/.test(cls)) {
    throw new Error(`#detail-container missing 'is-video' class (type table lookup broken): ${JSON.stringify(detail)}`);
  }
  const containerWidth = Number(detail.detailContainerWidth);
  if (!Number.isFinite(containerWidth) || containerWidth <= 0 || containerWidth > 4000) {
    throw new Error(`#detail-container width is not constrained to viewport (control bar would overflow): ${JSON.stringify(detail)}`);
  }
  if (!detail.hasPlayerInstance) {
    throw new Error(`videojs player instance not attached to .video-js element: ${JSON.stringify(detail)}`);
  }
  for (const btn of ['loopBtn', 'forwardBtn', 'backwardBtn']) {
    if (!(detail[btn] > 0)) {
      throw new Error(`videojs custom control button missing (${btn}): ${JSON.stringify(detail)}`);
    }
  }
  // F-CTX-1（2026-09-17）：详情页右键菜单链路。
  // 背景：`useMouseGesture` 的 effect 依赖是常量 `['.noSel']`，仅在挂载时执行一次，而那一刻
  // `ref.current` 尚为 null（`{smoothZoomDone && <div ref={gestureRef} />}` 条件渲染）⇒ 提前
  // return，此后 effect 不再跑 ⇒ `onMouseDown` 从未绑定。绑定在容器层、与素材类型无关，故
  // 图像与视频表现一致（用户报「右击无反应，视频和图像都是」）。仅断言播放器可用无法覆盖。
  // 取证校正：`.noSel` 是 smoothZoom 加在 `#detail-container` 上的类（容器自身），
  // 并非 gestureRef 空 div 的后代 —— 故命中点取容器内层真实元素。
  const ctx = result.contextMenuProbe || {};
  if (ctx.containerPresent !== true) {
    throw new Error(`#detail-container missing for context-menu probe: ${JSON.stringify(ctx)}`);
  }
  if (ctx.mousedownDefaultPrevented !== true) {
    throw new Error(`detail context-menu handler not bound (right-click mousedown not intercepted): ${JSON.stringify(ctx)}`);
  }
  if (ctx.menuOpen !== true) {
    throw new Error(`detail context menu did not open on right-click: ${JSON.stringify(ctx)}`);
  }
  if (!(ctx.itemCount > 0)) {
    throw new Error(`detail context menu rendered no items (contextMenuOpenChannel likely unbound): ${JSON.stringify(ctx)}`);
  }
  console.log(`VIDEO_DETAIL_CLOSED_LOOP_OK ${JSON.stringify({
    library: createBody.data.path,
    item: { id: result.videoItemId, ext: result.videoExt },
    videojsEngine: { version: engine.version, scriptTags: engine.scriptTags },
    controlBar: { controlBars: controlBar.controlBars, techEls: controlBar.techEls },
    // F-VP-1b/1c：控件条可用性取证面（容器类名/容器宽度/按钮装配）。
    controlBarDetail: result.controlBarDetail || null,
    // F-CTX-1：详情页右键菜单链路取证面。
    contextMenuProbe: {
      containerClass: ctx.containerClass,
      hitTargetClass: ctx.hitTargetClass,
      mousedownDefaultPrevented: ctx.mousedownDefaultPrevented,
      menuOpen: ctx.menuOpen,
      itemCount: ctx.itemCount,
      rootClassAfter: ctx.after && ctx.after.rootClass,
    },
    player: result.player,
    interaction: result.interaction,
  })}`);
  await stop(electron);
} finally {
  await stop(electron);
  await stop(vite);
  await stop(backend);
  try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
}
