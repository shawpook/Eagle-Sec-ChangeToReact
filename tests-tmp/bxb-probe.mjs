import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// b1-9bx-B 探针：audioPlugin（$.playSound debounce 500 immediate + $.stopSound）+
// Artstation 移植面（isValidUrl/getUserNameFromUrl 纯函数 + getUserInfo 非法 url 路径
// 哑雷拆除验证——callback 收 {msg} 而非 ReferenceError，不触网）。
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bxb-probe-'));
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
const watchdog = setTimeout(() => { console.log('BXB_PROBE_WATCHDOG'); process.exit(2); }, 300000);

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
      await post('/api/library/create', { name: 'BXB Probe', savePath: librariesRoot });
      const colors = [[25, 60, 210], [30, 180, 90], [200, 120, 30]];
      const images = [];
      for (let i = 0; i < 3; i++) {
        const p = path.join(sourcesRoot, `Probe ${i + 1}.png`);
        createPng(p, colors[i]);
        images.push({ path: p, name: `Probe ${i + 1}` });
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
    const r = await sendT('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.exception?.description?.slice(0, 200)}`);
    return r.result.value;
  };
  const assert = (name, pass, detail) => {
    console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass ? '' : ' — ' + JSON.stringify(detail)}`);
    if (!pass) failure = failure || new Error(name);
  };

  await sendT('Runtime.enable');
  await waitFor(async () => (await evaluate(`document.readyState`)) === 'complete', 'ready', 60000);
  await waitFor(async () => (await evaluate(`!!window.$bodyScope`)) === true, 'scope', 60000);

  await evaluate(`(() => {
    window.__uxErrors = [];
    window.addEventListener('error', (e) => { window.__uxErrors.push(String(e.message).slice(0, 160)); });
    window.addEventListener('unhandledrejection', (e) => { window.__uxErrors.push('REJ: ' + String(e.reason).slice(0, 160)); });
    return true;
  })()`);

  await waitFor(async () => {
    const n = await evaluate(`document.querySelectorAll('.box').length`);
    return typeof n === 'number' && n >= 3 ? n : null;
  }, 'boxes', 60000);

  // ① facade
  const facade = await evaluate(`(() => ({
    play: typeof window.$.playSound === 'function',
    stop: typeof window.$.stopSound === 'function',
    artstation: typeof window.Artstation === 'object',
    isValidUrl: typeof window.Artstation?.isValidUrl === 'function',
  }))()`);
  assert('bxb-facade-surface', facade.play && facade.stop && facade.artstation && facade.isValidUrl, facade);

  // ② playSound 建 .sound-player（首触发 immediate）+ debounce 窗口内不重复 + stopSound 清零
  const sound = await evaluate(`(() => new Promise((outer) => {
    window.$.playSound('sounds/remove.wav');
    window.$.playSound('sounds/duplicate.wav');
    setTimeout(() => {
      const players = document.querySelectorAll('.sound-player');
      const first = players[0];
      window.$.stopSound();
      const cleared = document.querySelectorAll('.sound-player').length;
      outer({ count: players.length, src: first && first.querySelector('source').getAttribute('src'), cleared });
    }, 80);
  }))()`);
  assert('playsound-debounce-immediate', sound.count === 1 && sound.src === 'sounds/remove.wav', sound);
  assert('stopsound-clears', sound.cleared === 0, sound);

  // ③ Artstation 纯函数面
  const pure = await evaluate(`(() => ({
    valid: window.Artstation.isValidUrl('https://www.artstation.com/minskuju?a=1'),
    invalid: window.Artstation.isValidUrl('https://example.com/x'),
    name: window.Artstation.getUserNameFromUrl('https://www.artstation.com/minskuju?a=123', 'https://www.artstation.com/'),
  }))()`);
  assert('artstation-pure-functions', pure.valid === true && pure.invalid === false && pure.name === 'minskuju', pure);

  // ④ getUserInfo 非法 url：callback 收 {msg}（哑雷拆除——不再 finishCallback ReferenceError）
  const invalidUrl = await evaluate(`(() => new Promise((outer) => {
    let settled = false;
    window.Artstation.getUserInfo('https://example.com/x', (err, result) => {
      settled = true;
      outer({ err: err && err.msg, result });
    });
    setTimeout(() => { if (!settled) outer({ timeout: true }); }, 2000);
  }))()`);
  assert('artstation-invalid-url-path', invalidUrl.err === '网址格式错误' && invalidUrl.result === null, invalidUrl);

  // ⑤ getUserInfo 空 userName：callback 收 {msg} 且提前 return（不触网）
  const emptyName = await evaluate(`(() => new Promise((outer) => {
    let settled = false;
    window.Artstation.getUserInfo('https://www.artstation.com/', (err, result) => {
      settled = true;
      outer({ err: err && err.msg, result });
    });
    setTimeout(() => { if (!settled) outer({ timeout: true }); }, 2000);
  }))()`);
  assert('artstation-empty-name-early-return', emptyName.err === '用户名称错误' && emptyName.result === undefined, emptyName);

  // ⑥ 零 ReferenceError
  const errs = await evaluate(`window.__uxErrors.slice(0, 6)`);
  assert('bxb-zero-reference-errors', errs.length === 0, errs);

  if (failure) throw failure;
  console.log('BXB_PROBE_OK');
} catch (err) {
  failure = err;
  console.error(`BXB_PROBE_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
