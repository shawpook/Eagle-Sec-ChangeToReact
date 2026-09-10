import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// b1-9bv-A 探针：自研 keymap 机制专项（mousetrap v1.6.3 契约面）——
// global keypress 字符键 / special keydown / 修饰组合精确匹配 / unbind / rebind 覆盖 /
// 输入框 stopCallback 拦截 + 'mousetrap' class 豁免 / 元素实例 D 放行 + reset /
// handler 返回 false → preventDefault / 零 ReferenceError。
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bv-probe-'));
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
const watchdog = setTimeout(() => { console.log('BV_PROBE_WATCHDOG'); process.exit(2); }, 300000);

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
      await post('/api/library/create', { name: 'BV Probe', savePath: librariesRoot });
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
    const r = await sendT('Runtime.evaluate', { expression, returnByValue: true });
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

  // ① facade 面：window.Mousetrap 构造器 + statics
  const facade = await evaluate(`(() => ({
    ctor: typeof window.Mousetrap === 'function',
    bind: typeof window.Mousetrap?.bind === 'function',
    unbind: typeof window.Mousetrap?.unbind === 'function',
    reset: typeof window.Mousetrap?.reset === 'function',
    stop: typeof window.Mousetrap?.stopCallback === 'function',
  }))()`);
  assert('keymap-facade-surface', facade.ctor && facade.bind && facade.unbind && facade.reset && facade.stop, facade);

  // ② 绑定装填 + fixture DOM（计数器制）
  await evaluate(`(() => {
    window.__bv = { f: { q: 0, q2: 0, f9: 0, csk: 0, trapModA: 0, pd: 0, exempt: 0 } };
    const M = window.Mousetrap;
    M.bind('q', () => { window.__bv.f.q += 1; });
    M.bind('f9', () => { window.__bv.f.f9 += 1; });
    M.bind('mod+shift+k', () => { window.__bv.f.csk += 1; });
    M.bind('f10', () => false);
    document.addEventListener('keydown', (e) => { if (e.key === 'F10') window.__bv.f.pd = e.defaultPrevented ? 1 : 2; });
    const input1 = document.createElement('input');
    input1.id = 'bv-input'; document.body.appendChild(input1);
    const input2 = document.createElement('input');
    input2.id = 'bv-input2'; document.body.appendChild(input2);
    const trap = new M(input2);
    window.__bv.trap = trap;
    trap.bind('mod+a', () => { window.__bv.f.trapModA += 1; });
    const input3 = document.createElement('input');
    input3.id = 'bv-input3'; input3.className = 'mousetrap'; document.body.appendChild(input3);
    // class 豁免链路：global 'q' 在 .mousetrap 输入框内也放行
    document.addEventListener('keypress', (e) => { if (e.which === 113 && e.target === input3) window.__bv.f.exempt = 1; });
    return true;
  })()`);

  const blurFocus = `(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); return true; })()`;
  const pressQ = async () => {
    // CDP 无 keyPress 类型：keyDown 带 text 即触发 keydown+keypress 双事件
    await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'q', code: 'KeyQ', windowsVirtualKeyCode: 81, text: 'q' });
    await delay(120);
  };

  // ③ 全局字符键 keypress 触发；keydown 不触发（action 区分）
  await evaluate(blurFocus);
  await pressQ();
  let f = await evaluate(`window.__bv.f`);
  assert('global-char-keypress-fires', f.q === 1 && f.q2 === 0, f);
  await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'q', code: 'KeyQ', windowsVirtualKeyCode: 81 });
  await delay(120);
  f = await evaluate(`window.__bv.f`);
  assert('global-char-keydown-silent', f.q === 1, f);

  // ④ special 键 keydown：f9
  await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'F9', code: 'F9', windowsVirtualKeyCode: 120 });
  await delay(120);
  f = await evaluate(`window.__bv.f`);
  assert('global-special-keydown-fires', f.f9 === 1, f);

  // ⑤ 修饰组合精确匹配：mod+shift+k 触发；mod+k（缺 shift）不触发（CDP modifiers 位掩码：ctrl=2 shift=8）
  await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'k', code: 'KeyK', windowsVirtualKeyCode: 75, modifiers: 10 });
  await delay(120);
  f = await evaluate(`window.__bv.f`);
  assert('global-mod-combo-fires', f.csk === 1, f);
  await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'k', code: 'KeyK', windowsVirtualKeyCode: 75, modifiers: 2 });
  await delay(120);
  f = await evaluate(`window.__bv.f`);
  assert('global-mod-combo-exact-match', f.csk === 1, f);

  // ⑥ 输入框 stopCallback 拦截：focus input → keypress q 不触发；blur 后触发
  await evaluate(`document.getElementById('bv-input').focus(); true`);
  await pressQ();
  f = await evaluate(`window.__bv.f`);
  assert('input-stopcallback-blocks', f.q === 1, f);
  await evaluate(blurFocus);
  await pressQ();
  f = await evaluate(`window.__bv.f`);
  assert('blur-after-input-fires', f.q === 2, f);

  // ⑦ 'mousetrap' class 豁免：.mousetrap 输入框内 keypress q 照常触发
  await evaluate(`document.getElementById('bv-input3').focus(); true`);
  await pressQ();
  f = await evaluate(`window.__bv.f`);
  assert('mousetrap-class-exempt', f.q === 3 && f.exempt === 1, f);
  await evaluate(blurFocus);

  // ⑧ 元素实例：input2 内 mod+a 由 trap 接（D 放行）；global mod+a 被拦截；reset 后归零
  await evaluate(`document.getElementById('bv-input2').focus(); true`);
  await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
  await delay(120);
  f = await evaluate(`window.__bv.f`);
  assert('element-trap-fires-in-input', f.trapModA === 1, f);
  await evaluate(`window.__bv.trap.reset(); true`);
  await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
  await delay(120);
  f = await evaluate(`window.__bv.f`);
  assert('element-trap-reset-unbinds', f.trapModA === 1, f);
  await evaluate(blurFocus);

  // ⑨ handler 返回 false → preventDefault
  await sendT('Input.dispatchKeyEvent', { type: 'keyDown', key: 'F10', code: 'F10', windowsVirtualKeyCode: 121 });
  await delay(120);
  f = await evaluate(`window.__bv.f`);
  assert('handler-false-prevents-default', f.pd === 1, f);

  // ⑩ unbind / rebind 覆盖
  await evaluate(`(() => { const M = window.Mousetrap; M.bind('q', () => { window.__bv.f.q2 += 1; }); return true; })()`);
  await pressQ();
  f = await evaluate(`window.__bv.f`);
  assert('rebind-overwrites', f.q === 3 && f.q2 === 1, f);
  await evaluate(`window.Mousetrap.unbind('q'); true`);
  await pressQ();
  f = await evaluate(`window.__bv.f`);
  assert('unbind-stops', f.q === 3 && f.q2 === 1, f);

  // ⑪ 零 ReferenceError
  const errs = await evaluate(`window.__uxErrors.slice(0, 5)`);
  assert('keymap-zero-reference-errors', errs.length === 0, errs);

  if (failure) throw failure;
  console.log('BV_PROBE1_OK');
} catch (err) {
  failure = err;
  console.error(`BV_PROBE1_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
