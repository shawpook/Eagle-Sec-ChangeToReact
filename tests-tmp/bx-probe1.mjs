import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// b1-9bx-A 探针：自研 tippyLite 契约专项——
// useTippy 同构流程（[tippy] 元素 + scale/arrow:false/placement/allowHTML）/
// DOM 结构（data-tippy-root 落 body + .tippy-box data-placement^=X + .tippy-content）/
// show/hide 状态机 + 四向定位 sanity/arrow 默认存在 vs false 不建/destroy 全清/
// 单例幂等（font-viewer 重复调用收敛）/零 ReferenceError。
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bx-probe-'));
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
const watchdog = setTimeout(() => { console.log('BX_PROBE_WATCHDOG'); process.exit(2); }, 300000);

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
      await post('/api/library/create', { name: 'BX Probe', savePath: librariesRoot });
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

  // ① facade + css 注入
  const facade = await evaluate(`(() => ({
    fn: typeof window.tippy === 'function',
    css: !!document.getElementById('eagle-tippy-css'),
  }))()`);
  assert('tippy-facade-surface', facade.fn === true && facade.css === true, facade);

  // ② useTippy 同构流程：建 [tippy] 元素 → tippy(el, opts) → DOM 结构 + show/hide
  const flow = await evaluate(`(() => {
    const host = document.createElement('div');
    host.id = 'bx-tippy-host';
    document.body.appendChild(host);
    const el = document.createElement('button');
    el.style.cssText = 'position:fixed;left:100px;top:100px;width:80px;height:30px;';
    el.setAttribute('tippy', '');
    el.setAttribute('tippy-content', 'hello <key>Shift</key><key>T</key>');
    el.setAttribute('tippy-placement', 'bottom');
    host.appendChild(el);
    const instance = window.tippy(el, {
      animation: 'scale', arrow: false,
      content: el.getAttribute('tippy-content') || '',
      placement: el.getAttribute('tippy-placement') || 'right',
      allowHTML: true,
    });
    window.__bxInst = instance;
    const popper = instance.popper;
    const box = popper.querySelector('.tippy-box');
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    const shown = { state: box.getAttribute('data-state'), vis: popper.style.visibility, below: parseFloat(popper.style.top) >= r.bottom };
    el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
    const hidden = { state: box.getAttribute('data-state'), vis: popper.style.visibility };
    return {
      inBody: popper.parentNode === document.body,
      root: popper.hasAttribute('data-tippy-root'),
      placement: box.getAttribute('data-placement'),
      animation: box.getAttribute('data-animation'),
      arrow: !!popper.querySelector('.tippy-arrow'),
      contentHTML: popper.querySelector('.tippy-content').innerHTML,
      keyTag: !!popper.querySelector('.tippy-content key'),
      shown, hidden,
      bottomY: popper.style.top, bottomX: popper.style.left,
    };
  })()`);
  assert('tippy-dom-structure', flow.inBody && flow.root && flow.placement === 'bottom' && flow.animation === 'scale' && flow.arrow === false && flow.keyTag, flow);
  assert('tippy-show-hide-states', flow.shown.state === 'visible' && flow.shown.vis === '' && flow.shown.below === true && flow.hidden.state === 'hidden' && flow.hidden.vis === 'hidden', flow);

  // ③ 四向定位 sanity（left：popper 右缘 <= rect 左缘 + 10 容差前不越界；top：上方）
  const dirs = await evaluate(`(() => {
    const out = {};
    for (const placement of ['top', 'left', 'right']) {
      const el = document.createElement('button');
      el.style.cssText = 'position:fixed;left:300px;top:300px;width:80px;height:30px;';
      document.body.appendChild(el);
      const inst = window.tippy(el, { content: 'tip', placement, arrow: false });
      const p = inst.popper;
      el.dispatchEvent(new MouseEvent('mouseenter'));
      const r = el.getBoundingClientRect();
      out[placement] = {
        left: parseFloat(p.style.left),
        top: parseFloat(p.style.top),
        pw: p.offsetWidth,
        rectLeft: r.left, rectTop: r.top, rectRight: r.right,
      };
      inst.destroy();
      el.remove();
    }
    return out;
  })()`);
  const topOk = dirs.top.top + dirs.top.pw <= dirs.top.rectTop + 1 && dirs.top.left >= dirs.top.rectLeft - 60 && dirs.top.left <= dirs.top.rectLeft + 60;
  const leftOk = dirs.left.left + dirs.left.pw <= dirs.left.rectLeft + 1;
  const rightOk = dirs.right.left >= dirs.right.rectRight - 1;
  assert('tippy-placement-geometry', topOk && leftOk && rightOk, dirs);

  // ④ arrow 默认存在（font-viewer 简参路径）
  const arrowDefault = await evaluate(`(() => {
    const el = document.createElement('button');
    document.body.appendChild(el);
    const inst = window.tippy(el, { content: 'x', placement: 'right' });
    const has = !!inst.popper.querySelector('.tippy-arrow');
    inst.destroy();
    el.remove();
    return has;
  })()`);
  assert('tippy-arrow-default-present', arrowDefault === true, arrowDefault);

  // ⑤ destroy 全清：popper 移除 + 再 hover 不复活
  const destroyCheck = await evaluate(`(() => {
    const el = document.createElement('button');
    document.body.appendChild(el);
    const inst = window.tippy(el, { content: 'd', placement: 'top', arrow: false });
    const popper = inst.popper;
    inst.destroy();
    const removed = !popper.parentNode;
    el.dispatchEvent(new MouseEvent('mouseenter'));
    const staysGone = !document.body.contains(popper);
    el.remove();
    return { removed, staysGone };
  })()`);
  assert('tippy-destroys-clean', destroyCheck.removed && destroyCheck.staysGone, destroyCheck);

  // ⑥ 单例幂等：同元素重复 tippy() 只留一个 popper（font-viewer 重复调用收敛）
  const singleton = await evaluate(`(() => {
    const el = document.createElement('button');
    el.style.cssText = 'position:fixed;left:100px;top:100px;';
    document.body.appendChild(el);
    window.tippy(el, { content: 'v1', placement: 'top', arrow: false });
    window.tippy(el, { content: 'v2', placement: 'top', arrow: false });
    // 现网 useTippy 亦挂 popper——只数本测试产生的（内容 v1/v2）
    const mine = () => Array.from(document.querySelectorAll('[data-tippy-root]'))
      .filter((p) => { const c = p.querySelector('.tippy-content'); return c && (c.textContent === 'v1' || c.textContent === 'v2'); }).length;
    const roots = mine();
    const inst = el._tippy;
    const content = inst.popper.querySelector('.tippy-content').textContent;
    inst.destroy();
    const allGone = mine() === 0;
    el.remove();
    return { roots, content, allGone };
  })()`);
  assert('tippy-singleton-idempotent', singleton.roots === 1 && singleton.content === 'v2' && singleton.allGone, singleton);

  // ⑦ 现网 useTippy 面仍活：主窗工具列 [tippy] 元素 hover 建出 tooltip
  const liveUseTippy = await evaluate(`(() => {
    const refs = document.querySelectorAll('[tippy][tippy-content]');
    return { count: refs.length };
  })()`);
  assert('live-tippy-references-present', liveUseTippy.count > 0, liveUseTippy);

  // ⑧ 零 ReferenceError
  const errs = await evaluate(`window.__uxErrors.slice(0, 6)`);
  assert('tippy-zero-reference-errors', errs.length === 0, errs);

  if (failure) throw failure;
  console.log('BX_PROBE1_OK');
} catch (err) {
  failure = err;
  console.error(`BX_PROBE1_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
