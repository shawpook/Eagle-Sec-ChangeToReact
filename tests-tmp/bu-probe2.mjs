import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// b1-9bu-B 探针：video/audio 悬停播放复活链。假媒体文件（无 ffmpeg、无尺寸元数据）在
// v4 网格布局下与相邻项重叠、真实鼠标无法命中（几何诊断实录，见 PROGRESS bu-B 节）——
// 依 b1-9ax ④ 合成事件先例改 jQuery trigger('mouseenter'/'mouseleave') 断言委托绑定链
// （enter 守卫 which===1/rectSelecting/hoverPlay + 250ms/500ms 定时 + 播放器元素建出 +
// leave 清理全链仍真）。
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bu2-probe-'));
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
const watchdog = setTimeout(() => { console.log('BU2_PROBE_WATCHDOG'); process.exit(2); }, 300000);

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
      await post('/api/library/create', { name: 'BU2 Probe', savePath: librariesRoot });
      const images = [];
      for (let i = 0; i < 2; i++) {
        const p = path.join(sourcesRoot, `Pad ${i + 1}.png`);
        createPng(p, [25, 60, 210]);
        images.push({ path: p, name: `Pad ${i + 1}` });
      }
      const fakeMp4 = path.join(sourcesRoot, 'Probe Video.mp4');
      fs.writeFileSync(fakeMp4, Buffer.alloc(4096, 7));
      images.push({ path: fakeMp4, name: 'Probe Video' });
      const fakeMp3 = path.join(sourcesRoot, 'Probe Audio.mp3');
      fs.writeFileSync(fakeMp3, Buffer.alloc(4096, 9));
      images.push({ path: fakeMp3, name: 'Probe Audio' });
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
    return typeof n === 'number' && n >= 4 ? n : null;
  }, 'boxes', 60000);

  // 假媒体被后端标 noPreview（真媒体无此标记）——解锁 handler 链（守卫本身逐字源码，不在断言面）
  await evaluate(`(() => { window.$bodyScope.allData.forEach((i) => { if (i.ext === 'mp4') i.noPreview = false; }); return true; })()`);
  await evaluate(`window.__probeMarker = 'bu2'; true`);

  const trigger = (sel, type) => `window.$('${sel}').trigger('${type}'); true`;

  // 瞬态记录器（50ms 采样——video 建出→error→mpv fallback 移除原生的瞬态必被错过）
  await evaluate(`(() => { window.__seen = { video: false, audio: false, mpv: false, vbar: false, abar: false, controls: false }; window.__seenTimer = setInterval(() => { if (document.querySelector('.box video')) window.__seen.video = true; if (document.querySelector('.box audio')) window.__seen.audio = true; if (document.querySelector('.box mpv-video')) window.__seen.mpv = true; if (document.querySelector('.box .video-progress-bar')) window.__seen.vbar = true; if (document.querySelector('.box .audio-progress-bar')) window.__seen.abar = true; if (document.querySelector('.box .controls')) window.__seen.controls = true; }, 50); return true; })()`);
  const guardDump = await evaluate(`(() => {
    const get = (sel) => { const b = document.querySelector(sel); if (!b) return null; const id = b.getAttribute('data-box-id'); const img = window.$bodyScope.itemMappings[id]; return { id, found: !!img, np: img ? !!img.noPreview : null, nt: img ? !!img.noThumbnail : null }; };
    return { mp4: get('.box.ext-mp4'), mp3: get('.box.ext-mp3'), hoverPlay: window.$bodyScope.preferences.video ? window.$bodyScope.preferences.video.hoverPlay : 'NOKEY' };
  })()`);
  console.log('GUARDDUMP ' + JSON.stringify(guardDump));

  // ① video：mouseenter → 250ms → 播放器元素 + 进度条建出
  const vc = await evaluate(`(() => { const b = document.querySelector('.box.ext-mp4'); return b ? b.getAttribute('data-box-id') : null; })()`);
  assert('mp4-box-rendered', !!vc, vc);
  await evaluate(trigger('.box.ext-mp4 .thumbnail', 'mouseenter'));
  let videoShown = null;
  try {
    videoShown = await waitFor(async () => {
      const r = await evaluate(`(() => { const seen = window.__seen; const v = document.querySelector('.box video'); const m = document.querySelector('.box mpv-video'); return (seen.video || seen.mpv || v || m) ? { has: true, live: !!(v || m), bar: !!document.querySelector('.box .video-progress-bar') || seen.vbar, via: seen.video ? 'video' : 'mpv' } : null; })()`);
      return r;
    }, 'video element on hover', 5000);
  } catch (err) { videoShown = null; }
  assert('video-hover-creates-player', !!videoShown && videoShown.has && videoShown.bar, videoShown);

  // ② mouseleave → 清理归零
  await evaluate(trigger('.box.ext-mp4 .thumbnail', 'mouseleave'));
  await delay(500);
  const videoGone = await evaluate(`(() => ({ v: document.querySelectorAll('.box video').length, active: document.querySelectorAll('.box.hover-active').length }))()`);
  assert('video-mouseleave-cleans', videoGone.v === 0 && videoGone.active === 0, videoGone);

  // ③ audio：mouseenter → 500ms → audio 元素 + 进度条 + playingAudiosElements 登记
  const ac = await evaluate(`(() => { const b = document.querySelector('.box.ext-mp3'); return b ? b.getAttribute('data-box-id') : null; })()`);
  assert('mp3-box-rendered', !!ac, ac);
  await evaluate(trigger('.box.ext-mp3 .thumbnail', 'mouseenter'));
  let audioShown = null;
  try {
    audioShown = await waitFor(async () => {
      const r = await evaluate(`(() => { const a = document.querySelector('.box audio'); return a ? { has: true, bar: !!document.querySelector('.box .audio-progress-bar'), playing: Array.isArray(window.playingAudiosElements) && window.playingAudiosElements.length > 0 } : null; })()`);
      return r;
    }, 'audio element on hover', 5000);
  } catch (err) { audioShown = null; }
    const audioControls = await evaluate(`!!document.querySelector('.box .controls')`);
  assert('audio-hover-creates-player', !!audioShown && audioShown.has && audioShown.playing && audioControls, { audioShown, audioControls });

  // ④ mouseleave → 清理归零
  await evaluate(trigger('.box.ext-mp3 .thumbnail', 'mouseleave'));
  await delay(500);
  const audioGone = await evaluate(`(() => ({ a: document.querySelectorAll('.box audio').length, active: document.querySelectorAll('.box.hover-active').length, pae: window.playingAudiosElements.length }))()`);
  assert('audio-mouseleave-cleans', audioGone.a === 0 && audioGone.active === 0 && audioGone.pae === 0, audioGone);

  // ⑤ 零 ReferenceError
  await delay(300);
  const marker = await evaluate(`window.__probeMarker || null`);
  if (marker !== 'bu2') console.log('WARN page context reset mid-probe (marker=' + marker + ')');
  const errs = await evaluate(`(window.__uxErrors || []).slice(0, 5)`);
  assert('hover-zero-reference-errors', errs.length === 0, errs);

  if (failure) throw failure;
  console.log('BU2_PROBE_OK');
} catch (err) {
  failure = err;
  console.error(`BU2_PROBE_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
