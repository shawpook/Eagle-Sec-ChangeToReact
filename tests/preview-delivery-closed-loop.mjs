import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fork, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import jpeg from 'jpeg-js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nodeExecutable = process.execPath;
const electronExecutable = path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-preview-delivery-'));
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
let backend = spawnLogged(nodeExecutable, ['backend/src/server.js'], backendEnv);
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
    body: JSON.stringify({ name: 'Preview Delivery', savePath: librariesRoot }),
  });
  const createBody = await createResponse.json();
  if (!createResponse.ok || createBody.status !== 'success') {
    throw new Error(`Library create failed: ${JSON.stringify(createBody)}`);
  }

  const pngSource = path.join(sourcesRoot, 'Preview PNG.png');
  const jpgSource = path.join(sourcesRoot, 'Preview JPEG.jpg');
  const svgSource = path.join(sourcesRoot, 'Preview SVG.svg');
  const gifSource = path.join(sourcesRoot, 'Preview GIF.gif');
  const pdfSource = path.join(sourcesRoot, 'Preview PDF.pdf');
  const videoSource = path.join(sourcesRoot, 'Preview Video.webm');
  const badVideoSource = path.join(sourcesRoot, 'Bad Video.mp4');
  fs.copyFileSync(
    path.join(projectRoot, 'frontend/public/mock-library/Eagle Reverse Demo.library/images/MOCK0001.info/Welcome Library.png'),
    pngSource
  );
  fs.copyFileSync(path.join(projectRoot, 'frontend/public/mock-assets/sample.gif'), gifSource);
  fs.copyFileSync(path.join(projectRoot, 'frontend/public/mock-assets/sample.pdf'), pdfSource);
  fs.writeFileSync(svgSource, '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48"><rect width="64" height="48" fill="#2f80ed"/></svg>', 'utf8');
  const jpegWidth = 8;
  const jpegHeight = 6;
  const jpegData = Buffer.alloc(jpegWidth * jpegHeight * 4);
  for (let index = 0; index < jpegData.length; index += 4) {
    jpegData[index] = 220;
    jpegData[index + 1] = 70;
    jpegData[index + 2] = 40;
    jpegData[index + 3] = 255;
  }
  fs.writeFileSync(jpgSource, jpeg.encode({ data: jpegData, width: jpegWidth, height: jpegHeight }, 95).data);
  fs.writeFileSync(badVideoSource, 'not a real mp4 video', 'utf8');
  await createVideoFixture(videoSource, baseEnv);

  const importResponse = await fetch(`http://127.0.0.1:${apiPort}/api/item/addFromPaths`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      images: [
        { path: pngSource, name: 'Preview PNG' },
        { path: jpgSource, name: 'Preview JPEG' },
        { path: svgSource, name: 'Preview SVG' },
        { path: gifSource, name: 'Preview GIF' },
        { path: pdfSource, name: 'Preview PDF' },
        { path: videoSource, name: 'Preview Video' },
        { path: badVideoSource, name: 'Bad Video', ext: 'mp4' },
      ],
    }),
  });
  const importBody = await importResponse.json();
  if (!importResponse.ok || importBody.status !== 'success') {
    throw new Error(`Fixture import failed: ${JSON.stringify(importBody)}`);
  }
  const currentResponse = await fetch(`http://127.0.0.1:${apiPort}/api/library/current?includeItems=true`);
  const currentBody = await currentResponse.json();
  if (!currentResponse.ok || currentBody.status !== 'success') {
    throw new Error(`Current library failed: ${JSON.stringify(currentBody)}`);
  }
  const currentItems = currentBody.data.items || [];
  const findItem = (ext) => currentItems.find((item) => item.ext === ext);
  const selected = [findItem('png'), findItem('jpg'), findItem('svg'), findItem('gif'), findItem('pdf'), findItem('webm'), findItem('mp4')].filter(Boolean);
  if (selected.length < 3) throw new Error(`Not enough preview fixtures imported: ${JSON.stringify(selected.map((item) => item && item.ext))}`);

  const previewEnv = {
    ...baseEnv,
    EAGLE_API_URL: `http://127.0.0.1:${apiPort}`,
    EAGLE_THUMBNAIL_URL: `http://127.0.0.1:${thumbnailPort}`,
    EAGLE_PREVIEW_URL: `http://127.0.0.1:${vitePort}/src/app/index.html`,
    EAGLE_ELECTRON_USER_DATA_DIR: path.join(tempRoot, 'electron-user-data'),
    EAGLE_PREVIEW_IDS: selected.map((item) => item.id).join(','),
  };
  const assertRound = (result, round) => {
    if (!result.imageLoaded || !result.video || result.video.readyState < 1) {
      throw new Error(`Preview matrix was not proven: ${JSON.stringify({ imageLoaded: result.imageLoaded, video: result.video })}`);
    }
    if (!result.svg || !result.svg.width || !result.gif || !result.gif.mode || !result.pdf || !result.pdf.page) {
      throw new Error(`Viewer matrix was not proven: ${JSON.stringify({ svg: result.svg, gif: result.gif, pdf: result.pdf })}`);
    }
    if (!result.jpg || !result.jpg.width) {
      throw new Error(`JPEG viewer was not proven: ${JSON.stringify(result.jpg)}`);
    }
    if (!result.badVideo || !result.badVideo.unsupported) {
      throw new Error(`Unsupported video was not reported: ${JSON.stringify(result.badVideo)}`);
    }
    if (!result.videoInteraction || Math.abs(result.videoInteraction.volume - 0.5) >= 0.01 || result.videoInteraction.currentTime <= 0.05) {
      throw new Error(`Video interaction was not proven: ${JSON.stringify(result.videoInteraction)}`);
    }
    if (result.fakeOpen.ok || result.fakeCopy.ok || result.fakeReveal.ok || result.fakeDrag.ok) {
      throw new Error(`Fake item IDs were not rejected: ${JSON.stringify({ fakeOpen: result.fakeOpen, fakeCopy: result.fakeCopy, fakeReveal: result.fakeReveal, fakeDrag: result.fakeDrag })}`);
    }
    if (round === 2 && (!result.trashRejected || !result.missingRejected)) {
      throw new Error(`Trash/missing preview paths were not rejected: ${JSON.stringify({ trashRejected: result.trashRejected, missingRejected: result.missingRejected })}`);
    }
    if (!result.renamedResult || result.renamedResult.name !== 'Preview Renamed PNG' || !decodeURIComponent(result.renamedResult.rawPath).endsWith('Preview Renamed PNG.png')) {
      throw new Error(`Renamed preview path was not resolved: ${JSON.stringify(result.renamedResult)}`);
    }
    if (!result.openDefault.ok || !result.reveal.ok || !result.copyPath.ok || !result.copyImage.ok || !result.drag.ok) {
      throw new Error(`Controlled preview actions failed: ${JSON.stringify(result)}`);
    }
  };
  const runRound = async (round) => {
    electron = spawnLogged(electronExecutable, ['electron/main.cjs', '--smoke-preview-delivery'], {
      ...previewEnv,
      EAGLE_PREVIEW_RUN_NEGATIVES: round === 2 ? '1' : '0',
    });
    const output = await waitFor(() => {
      const text = electron.output();
      if (text.includes('PREVIEW_DELIVERY_SMOKE_OK')) return text;
      if (text.includes('PREVIEW_DELIVERY_SMOKE_FAIL') || text.includes('PREVIEW_DELIVERY_SMOKE_ERROR') || electron.child.exitCode !== null) {
        throw new Error(`Preview delivery smoke failed:\n${text}`);
      }
      return null;
    }, `preview delivery smoke round ${round}`, 90000);
    const line = output.match(/PREVIEW_DELIVERY_SMOKE_OK[^\r\n]*/)?.[0];
    if (!line) throw new Error(`Missing preview delivery success output:\n${output}`);
    const result = JSON.parse(line.slice('PREVIEW_DELIVERY_SMOKE_OK '.length));
    assertRound(result, round);
    await stop(electron);
    electron = null;
    return result;
  };
  const first = await runRound(1);
  await stop(backend);
  backend = spawnLogged(nodeExecutable, ['backend/src/server.js'], backendEnv);
  await waitFor(() => backend.output().includes(`localhost:${apiPort}`), 'restarted backend');
  const second = await runRound(2);
  console.log(`PREVIEW_DELIVERY_CLOSED_LOOP_OK ${JSON.stringify({
    library: createBody.data.path,
    selected: selected.map((item) => ({ id: item.id, ext: item.ext })),
    preview: {
      imageLoaded: second.imageLoaded,
      jpg: second.jpg,
      svg: second.svg,
      gif: second.gif,
      pdf: second.pdf,
      video: second.video,
      badVideo: second.badVideo,
      videoInteraction: second.videoInteraction,
      renamed: second.renamedResult,
      trashRejected: second.trashRejected,
      missingRejected: second.missingRejected,
      nextId: second.nextId,
      prevId: second.prevId,
    },
    rounds: { first: first.initialId, second: second.initialId },
    actions: ['open-default', 'reveal', 'copy-path', 'copy-image', 'drag'],
  })}`);
} finally {
  await stop(electron);
  await stop(vite);
  await stop(backend);
  try { fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (err) { /* Windows 文件锁：清理失败不影响测试结果 */ }
}
