/**
 * M8-4：工作台列表的**缩略图缺图呈现**闭环（`/workbench.html`）。
 *
 * 覆盖前端新增的两条占位来源，并各自给出「不该占位」的反证：
 *   A. 元数据分支 —— 条目带 `noThumbnail`（`/api/item/list` 原样透传），直接占位、不发请求；
 *   B. onError 分支 —— `noThumbnail` 为假但 `/api/item/thumbnail` 取不到，图片加载失败后切占位；
 *   C. 控制组 —— 缩略图**能取到**的条目必须仍然是 `<img>`，不得被占位覆盖。
 *
 * 关于控制组的实现方式（重要，勿误读）：
 *   `backend/src/server.js:2056` 调用的 `ensureThumbnail` 在 server.js 内**没有绑定**
 *   （第 26 行只导入了 `thumbnailPath`），调用即 ReferenceError，又被该路由自己的
 *   `catch (err) { thumbPath = '' }` 吞掉 —— 因此该路由当前对**任何**条目都返回 404，
 *   无法从真实后端产出「缩略图 200」的阳性样本。控制组改用 CDP `Fetch.fulfillRequest`
 *   对上屏请求直接作答 200 + 一张真 PNG：它验证的是**本页渲染逻辑的判别力**
 *   （能取到就不占位），不是后端取图能力。
 *
 * 条目 B 同时把原件与缩略图从磁盘删掉，使它的 404 与后端那个缺陷无关 ——
 * 后端修好后本用例依旧成立。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function fail(message) {
  console.error(`WORKBENCH_THUMB_PLACEHOLDER_FAIL: ${message}`);
  process.exit(1);
}

async function waitFor(check, label, timeout = 30000) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try { const v = await check(); if (v) return v; } catch (err) { lastError = err; }
    await delay(100);
  }
  throw new Error(`${label} timeout${lastError ? `: ${lastError.message}` : ''}`);
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const handlers = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const entry = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? entry.reject(new Error(JSON.stringify(msg.error))) : entry.resolve(msg.result);
      return;
    }
    if (msg.method && handlers.has(msg.method)) {
      for (const handler of handlers.get(msg.method)) handler(msg.params);
    } else if (msg.method && process.env.EAGLE_M8_4_DEBUG) {
      console.log(`[cdp] unhandled ${msg.method}`);
    }
  };
  return new Promise((resolve, reject) => {
    ws.onopen = () => resolve({
      ws,
      on(method, handler) {
        if (!handlers.has(method)) handlers.set(method, []);
        handlers.get(method).push(handler);
      },
      send(method, params = {}) {
        return new Promise((res, rej) => {
          const mid = ++id;
          pending.set(mid, { resolve: res, reject: rej });
          ws.send(JSON.stringify({ id: mid, method, params }));
        });
      },
    });
    ws.onerror = reject;
  });
}

const CHROME_CANDIDATES = [
  process.env.EAGLE_CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-m8-4-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const userDataDir = path.join(tempRoot, 'user-data');
const profileDir = path.join(tempRoot, 'browser-profile');
for (const dir of [librariesRoot, userDataDir, profileDir]) fs.mkdirSync(dir, { recursive: true });

const [apiPort, thumbnailPort, extensionPort, vitePort, debugPort] = await Promise.all([
  freePort(), freePort(), freePort(), freePort(), freePort(),
]);

const children = [];
function spawnLogged(command, args, env) {
  const child = spawn(command, args, { cwd: projectRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (c) => (output += c));
  child.stderr.on('data', (c) => (output += c));
  children.push(child);
  return { child, output: () => output };
}

function cleanup() {
  for (const child of children) {
    try { child.kill(); } catch {}
  }
  setTimeout(() => {
    for (const child of children) {
      try { process.kill(child.pid); } catch {}
    }
    try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
  }, 400).unref();
}

const baseEnv = { ...process.env };
delete baseEnv.ELECTRON_RUN_AS_NODE;
const backendEnv = {
  ...baseEnv,
  EAGLE_API_PORT: String(apiPort),
  EAGLE_THUMBNAIL_PORT: String(thumbnailPort),
  EAGLE_EXTENSION_PORT: String(extensionPort),
  EAGLE_LIBRARY_STATE_FILE: path.join(tempRoot, 'library-state.json'),
  EAGLE_USER_DATA_DIR: userDataDir,
};
const viteEnv = {
  ...baseEnv,
  EAGLE_API_URL: `http://localhost:${apiPort}`,
  EAGLE_THUMBNAIL_URL: `http://localhost:${thumbnailPort}`,
  EAGLE_EXTENSION_URL: `http://localhost:${extensionPort}`,
};

const backend = spawnLogged(process.execPath, ['backend/src/server.js'], backendEnv);
const vite = spawnLogged(process.execPath, [
  'node_modules/vite/bin/vite.js', '--config', 'frontend/vite.preview.config.mjs',
  '--port', String(vitePort), '--strictPort',
], viteEnv);

let browser = null;
try {
  const api = `http://127.0.0.1:${apiPort}`;
  const post = async (route, body) => {
    const response = await fetch(api + route, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return (await response.json()).data;
  };

  await waitFor(() => backend.output().includes(`localhost:${apiPort}`), 'backend startup');
  await waitFor(async () => (await fetch(`http://127.0.0.1:${vitePort}/workbench.html`)).ok, 'vite workbench shell');

  await post('/api/library/create', { name: 'M8-4 Library', savePath: librariesRoot });

  const sharp = (await import('sharp')).default;
  const controlPng = await sharp({ create: { width: 320, height: 200, channels: 4, background: '#38bdf8' } })
    .png().toBuffer();
  const srcDir = path.join(tempRoot, 'src');
  fs.mkdirSync(srcDir);
  fs.writeFileSync(path.join(srcDir, 'ctl.png'), controlPng);
  fs.writeFileSync(path.join(srcDir, 'gone.png'), controlPng);
  fs.writeFileSync(path.join(srcDir, 'raw.zip'), Buffer.from('not a thumbnailable payload\n'));

  // 注意：`/api/item/addFromPath` 只回第一个条目（server.js 的 `ok(addMockItems(...)[0])`），
  // 一次导三条必须走 `addFromPaths`。
  const added = await post('/api/item/addFromPaths', {
    paths: ['ctl.png', 'gone.png', 'raw.zip'].map((name) => path.join(srcDir, name)),
  });
  if (!Array.isArray(added) || added.length !== 3) fail(`addFromPaths did not return 3 items: ${JSON.stringify(added)}`);
  const byExt = Object.fromEntries(added.map((item) => [`${item.name}.${item.ext}`, item]));
  const control = byExt['ctl.png'];
  const orphan = byExt['gone.png'];
  const noThumb = byExt['raw.zip'];
  if (!control || !orphan || !noThumb) fail(`unexpected import result: ${JSON.stringify(added)}`);

  // 前置取证：三个条目在元数据层的真实形态 + 该路由的真实响应码。
  const listed = await (await fetch(`${api}/api/item/list`)).json();
  const listedById = Object.fromEntries(listed.data.map((item) => [item.id, item]));
  for (const [label, item] of [['control', control], ['orphan', orphan], ['noThumbnail', noThumb]]) {
    const response = await fetch(`${api}/api/item/thumbnail?id=${encodeURIComponent(item.id)}`);
    console.log(`[m8-4] ${label}: noThumbnail=${JSON.stringify(listedById[item.id].noThumbnail)} `
      + `-> GET /api/item/thumbnail HTTP ${response.status}`);
  }
  if (listedById[orphan.id].noThumbnail === true) {
    fail('orphan fixture is meant to keep noThumbnail falsy (onError path), but the backend set it true');
  }
  if (listedById[noThumb.id].noThumbnail !== true) {
    fail(`noThumbnail fixture expected noThumbnail=true, got ${JSON.stringify(listedById[noThumb.id].noThumbnail)}`);
  }

  // orphan：把原件与缩略图一并从磁盘抹掉 —— 它的 404 与后端 ensureThumbnail 缺陷无关。
  const infoDir = path.join(librariesRoot, 'M8-4 Library.library', 'images', `${orphan.id}.info`);
  await waitFor(() => fs.existsSync(infoDir), 'orphan item dir');
  for (const entry of fs.readdirSync(infoDir)) {
    if (entry.endsWith('.png')) fs.rmSync(path.join(infoDir, entry), { force: true });
  }

  const chromePath = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!chromePath) fail(`no Chrome/Edge executable found among ${CHROME_CANDIDATES.join(', ')}`);
  const browserProc = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    // 工作台是 290px | 1fr | 280px 三栏；窄视口会退化成单栏，把 #itemGrid 推到折叠线以下，
    // 而缩略图是 loading="lazy" —— 那样图片根本不会发起请求（测试会假失败）。
    '--window-size=1600,1200',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profileDir}`, 'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(browserProc);

  await waitFor(async () => (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok, 'browser cdp');
  const version = await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json();
  browser = await connect(version.webSocketDebuggerUrl);
  const created = await browser.send('Target.createTarget', { url: 'about:blank' });
  browser.ws.close();
  const page = await connect(`ws://127.0.0.1:${debugPort}/devtools/page/${created.targetId}`);
  await page.send('Runtime.enable');
  await page.send('Page.enable');

  // 控制组的 200：只对 control 条目的缩略图请求作答，其余一律放行给真实后端。
  const controlBody = controlPng.toString('base64');
  let fulfilled = 0;
  let passedThrough = 0;
  page.on('Fetch.requestPaused', async (params) => {
    try {
      if (params.request.url.includes(encodeURIComponent(control.id)) || params.request.url.includes(control.id)) {
        fulfilled += 1;
        await page.send('Fetch.fulfillRequest', {
          requestId: params.requestId,
          responseCode: 200,
          responseHeaders: [{ name: 'Content-Type', value: 'image/png' }],
          body: controlBody,
        });
        return;
      }
      passedThrough += 1;
      await page.send('Fetch.continueRequest', { requestId: params.requestId });
    } catch (err) {
      console.error(`[m8-4] intercept error: ${err.message}`);
    }
  });
  await page.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/item/thumbnail*' }] });

  await page.send('Page.navigate', { url: `http://127.0.0.1:${vitePort}/workbench.html` });

  const evalValue = async (expression) => {
    const result = await page.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };

  const dumpCards = () => evalValue(`JSON.stringify([...document.querySelectorAll('#itemGrid .item-card')].map((c) => ({
    id: c.dataset.id,
    img: c.querySelector('img') ? { src: c.querySelector('img').getAttribute('src'), complete: c.querySelector('img').complete, nw: c.querySelector('img').naturalWidth } : null,
    placeholder: !!c.querySelector('.thumb-placeholder'),
  })))`);

  try {
    await waitFor(async () => evalValue(`document.querySelectorAll('#itemGrid .item-card').length >= 3`),
      'workbench item cards');
    // 缩略图是 loading="lazy"：显式把网格滚进视口，让三个条目都真的发起请求。
    await evalValue(`document.querySelector('#itemGrid').scrollIntoView({ block: 'start' }); true`);
    // 等两张 404 的图片把 onError 走完（占位出现即收敛）。
    await waitFor(async () => evalValue(
      `document.querySelectorAll('#itemGrid .thumb-placeholder').length >= 2`), 'placeholder for both missing items');
  } catch (err) {
    fail(`${err.message}; cards=${await dumpCards()}`);
  }

  const snapshot = JSON.parse(await evalValue(`(() => {
    const read = (id) => {
      const card = document.querySelector(\`#itemGrid .item-card[data-id="\${id}"]\`);
      if (!card) return null;
      const img = card.querySelector('img');
      const ph = card.querySelector('.thumb-placeholder');
      const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
      return {
        hasImg: !!img,
        imgComplete: img ? img.complete : null,
        imgNaturalWidth: img ? img.naturalWidth : null,
        hasPlaceholder: !!ph,
        placeholderText: ph ? ph.textContent.trim() : null,
        imgBox: box(img),
        placeholderBox: box(ph),
      };
    };
    return JSON.stringify({
      control: read(${JSON.stringify(control.id)}),
      orphan: read(${JSON.stringify(orphan.id)}),
      noThumbnail: read(${JSON.stringify(noThumb.id)}),
      cards: document.querySelectorAll('#itemGrid .item-card').length,
      placeholders: document.querySelectorAll('#itemGrid .thumb-placeholder').length,
    });
  })()`));

  console.log(`[m8-4] intercepted: fulfilled=${fulfilled} passedThrough=${passedThrough}`);
  console.log(`[m8-4] dom snapshot: ${JSON.stringify(snapshot)}`);

  const problems = [];
  if (fulfilled < 1) problems.push('control thumbnail request was never intercepted/fulfilled');
  if (passedThrough < 1) problems.push(`the 404 item never reached the real route, passedThrough=${passedThrough}`);

  // 控制组：取得到就是 <img>，且不得出现占位。
  if (!snapshot.control?.hasImg) problems.push('control card lost its <img> — placeholder applied to a servable thumbnail');
  if (snapshot.control?.hasPlaceholder) problems.push('control card rendered a placeholder');
  if (snapshot.control && snapshot.control.imgNaturalWidth <= 0) {
    problems.push(`control thumbnail did not render (naturalWidth=${snapshot.control.imgNaturalWidth})`);
  }

  // A：noThumbnail 分支。
  if (!snapshot.noThumbnail?.hasPlaceholder) problems.push('noThumbnail item did not render a placeholder');
  if (snapshot.noThumbnail?.hasImg) problems.push('noThumbnail item still rendered an <img>');
  if (snapshot.noThumbnail?.placeholderText !== 'Other') {
    problems.push(`noThumbnail placeholder label expected "Other" (mediaLabel of .zip), got ${JSON.stringify(snapshot.noThumbnail?.placeholderText)}`);
  }

  // B：onError 分支。
  if (!snapshot.orphan?.hasPlaceholder) problems.push('404 thumbnail did not switch to a placeholder (onError path)');
  if (snapshot.orphan?.hasImg) problems.push('404 thumbnail left a broken <img> in the DOM');

  // 占位与被替换的图片同盒（沿用既有 .item-card img 的 4/3 盒子，网格几何不塌）。
  const { imgBox, placeholderBox } = snapshot.control ?? {};
  if (imgBox && snapshot.orphan?.placeholderBox) {
    if (imgBox.w !== snapshot.orphan.placeholderBox.w || imgBox.h !== snapshot.orphan.placeholderBox.h) {
      problems.push(`placeholder box ${JSON.stringify(snapshot.orphan.placeholderBox)} `
        + `does not match the image box ${JSON.stringify(imgBox)}`);
    }
  } else {
    problems.push('could not compare placeholder box against the image box');
  }

  if (problems.length > 0) fail(problems.join('; '));
  console.log('WORKBENCH_THUMB_PLACEHOLDER_OK');
  cleanup();
  process.exit(0);
} catch (err) {
  cleanup();
  fail(err.message);
}
