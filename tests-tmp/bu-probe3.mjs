import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// b1-9bu-C 探针：youtube/vimeo iframe 悬停预览复活链。URL item 无法经 API 造假
// （addFromURL 会真下载）——注入合成盒（.box.url.youtube DOM + itemMappings 登记）
// 断言委托 handler 全链：enter → 200ms → iframe-wrap/embed src → leave → 清理 + 状态停用。
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bu3-probe-'));
const librariesRoot = path.join(tempRoot, 'libraries');
const sourcesRoot = path.join(tempRoot, 'sources');
const stateFile = path.join(tempRoot, 'library-state.json');
const userDataDir = path.join(tempRoot, 'user-data');
fs.mkdirSync(librariesRoot, { recursive: true });
fs.mkdirSync(sourcesRoot, { recursive: true });

function createPng(filePath, color, width = 640, height = 480) {
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

let stack;
let failure = null;
const watchdog = setTimeout(() => { console.log('BU3_PROBE_WATCHDOG'); process.exit(2); }, 300000);

try {
  stack = await bootStack({
    librariesRoot, stateFile, userDataDir,
    beforeElectron: async (apiPort) => {
      const post = async (route, body) => {
        const response = await Promise.race([
          fetch(`http://127.0.0.1:${apiPort}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('fixture timeout')), 15000)),
        ]);
        const payload = await response.json();
        if (!response.ok || payload.status !== 'success') throw new Error(`${route}: ${JSON.stringify(payload)}`);
        return payload.data;
      };
      await post('/api/library/create', { name: 'BU3 Probe', savePath: librariesRoot });
      const images = [];
      for (let i = 0; i < 2; i++) {
        const p = path.join(sourcesRoot, `Pad ${i + 1}.png`);
        createPng(p, [25, 60, 210]);
        images.push({ path: p, name: `Pad ${i + 1}` });
      }
      await post('/api/item/addFromPaths', { images });
    },
  });
  const { page } = stack;
  const sendT = async (method, params, ms = 12000) => {
    const r = await Promise.race([
      page.send(method, params),
      new Promise((resolve) => setTimeout(() => resolve({ __timeout: method }), ms)),
    ]);
    if (r && r.__timeout) throw new Error(`CDP timeout: ${method}`);
    return r;
  };
  const evaluate = async (expression) => {
    const r = await sendT('Runtime.evaluate', { expression, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.exception?.description?.slice(0, 200)}`);
    return r.result.value;
  };
  const assert = (name, pass, detail) => {
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass ? '' : ' — ' + JSON.stringify(detail)}`);
    if (!pass) failure = failure || new Error(name);
  };

  await sendT('Runtime.enable');
  await sendT('Runtime.evaluate', { expression: `(() => { window.__uxErrors = []; window.addEventListener('error', (e) => { window.__uxErrors.push(String(e.message).slice(0, 200)); }); window.addEventListener('unhandledrejection', (e) => { window.__uxErrors.push('REJ: ' + String(e.reason).slice(0, 200)); }); return true; })()`, returnByValue: true });
  await waitFor(async () => (await evaluate(`document.readyState`)) === 'complete', 'ready', 60000);
  await waitFor(async () => (await evaluate(`!!window.$bodyScope`)) === true, 'scope', 60000);
  await waitFor(async () => {
    const n = await evaluate(`document.querySelectorAll('.box').length`);
    return typeof n === 'number' && n >= 2 ? n : null;
  }, 'boxes', 60000);

  // 注入合成盒（youtube + vimeo）——委托 handler 的 DOM/item fixture
  const injected = await evaluate(`(() => {
    const host = document.getElementById('box-container');
    if (!host) return null;
    const mk = (id, site, videoID) => {
      const box = document.createElement('div');
      box.className = 'box url ' + site + ' ext-url url';
      box.setAttribute('data-box-id', id);
      box.innerHTML = '<div class="thumbnail"><img></div>';
      host.appendChild(box);
      window.$bodyScope.itemMappings[id] = { id, ext: 'url', name: 'Probe ' + site, videoID, noPreview: false, width: 640, height: 480 };
      return id;
    };
    return { yt: mk('ITEM-PROBE-YT-1', 'youtube', 'dQw4w9WgXcQ'), vm: mk('ITEM-PROBE-VM-1', 'vimeo', '76979871') };
  })()`);
  assert('synthetic-boxes-injected', !!injected && injected.yt && injected.vm, injected);

  const trigger = (sel, type) => `window.$('${sel}').trigger('${type}'); true`;

  // ① youtube：mouseenter → 200ms → iframe-wrap + embed src
  await evaluate(trigger('.box.url.youtube .thumbnail', 'mouseenter'));
  let ytShown = null;
  try {
    ytShown = await waitFor(async () => {
      const r = await evaluate(`(() => { const f = document.querySelector('.box.url.youtube .iframe-wrap iframe'); return f ? { has: true, src: (f.getAttribute('src') || '').slice(0, 80) } : null; })()`);
      return r;
    }, 'youtube iframe', 5000);
  } catch (err) { ytShown = null; }
  assert('youtube-hover-creates-iframe', !!ytShown && ytShown.has && ytShown.src.indexOf('youtube-nocookie.com/embed/dQw4w9WgXcQ') > -1, ytShown);

  // ② youtube：mouseleave → 清理
  await evaluate(trigger('.box.url.youtube .thumbnail', 'mouseleave'));
  await delay(400);
  const ytGone = await evaluate(`(() => ({ f: document.querySelectorAll('.box.url.youtube .iframe-wrap').length, s: document.querySelectorAll('.box.url.youtube .video-loading-spinner').length }))()`);
  assert('youtube-mouseleave-cleans', ytGone.f === 0 && ytGone.s === 0, ytGone);

  // ③ vimeo：mouseenter → 200ms → iframe-wrap + player src
  await evaluate(trigger('.box.url.vimeo .thumbnail', 'mouseenter'));
  let vmShown = null;
  try {
    vmShown = await waitFor(async () => {
      const r = await evaluate(`(() => { const f = document.querySelector('.box.url.vimeo .iframe-wrap iframe'); return f ? { has: true, src: (f.getAttribute('src') || '').slice(0, 80) } : null; })()`);
      return r;
    }, 'vimeo iframe', 5000);
  } catch (err) { vmShown = null; }
  assert('vimeo-hover-creates-iframe', !!vmShown && vmShown.has && vmShown.src.indexOf('player.vimeo.com/video/76979871') > -1, vmShown);

  // ④ vimeo：mouseleave → 清理
  await evaluate(trigger('.box.url.vimeo .thumbnail', 'mouseleave'));
  await delay(400);
  const vmGone = await evaluate(`(() => ({ f: document.querySelectorAll('.box.url.vimeo .iframe-wrap').length, s: document.querySelectorAll('.box.url.vimeo .video-loading-spinner').length }))()`);
  assert('vimeo-mouseleave-cleans', vmGone.f === 0 && vmGone.s === 0, vmGone);

  // ⑤ 零 ReferenceError
  await delay(300);
  const errs = await evaluate(`(window.__uxErrors || []).slice(0, 5)`);
  assert('hover-zero-reference-errors', errs.length === 0, errs);

  if (failure) throw failure;
  console.log('BU3_PROBE_OK');
} catch (err) {
  failure = err;
  console.error(`BU3_PROBE_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
