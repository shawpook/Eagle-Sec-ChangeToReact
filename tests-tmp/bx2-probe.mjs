import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { bootStack, stop, waitFor, delay } from '../tests/react-cdp-harness.mjs';
import { PNG } from 'pngjs';

// b1-9bx2 探针：自研 flatpickrLite 契约专项——
// 供给链契约（stage-smoke b1-9z 同款断言）/zh l10n（weekday 周日开局+cur-month 中文月）/
// 日历 DOM（42 格+monthNav）/open（focus）→ 选日（single onChange+Y-m-d 值+closeOnSelect）/
// range 双选（' 至 ' 分隔）/setDate 预填（不触发 Change）/外点关闭+range 单选清空/destroy 还原/
// 零 ReferenceError。
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-bx2-probe-'));
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
const watchdog = setTimeout(() => { console.log('BX2_PROBE_WATCHDOG'); process.exit(2); }, 300000);

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
      await post('/api/library/create', { name: 'BX2 Probe', savePath: librariesRoot });
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
    window.addEventListener('error', (e) => { window.__uxErrors.push(String(e.message).slice(0, 120) + ' @ ' + String(e.error && e.error.stack || '').split(String.fromCharCode(10))[1]).slice(0, 200); });
    window.addEventListener('unhandledrejection', (e) => { window.__uxErrors.push('REJ: ' + String(e.reason).slice(0, 160)); });
    return true;
  })()`);

  await waitFor(async () => {
    const n = await evaluate(`document.querySelectorAll('.box').length`);
    return typeof n === 'number' && n >= 3 ? n : null;
  }, 'boxes', 60000);

  // ① 供给链契约（stage-smoke b1-9z 同款）
  const supply = await evaluate(`(() => {
    if (typeof window.flatpickr !== 'function' || typeof window.FlatpickrInstance !== 'function') return { pass: false };
    if (!window.flatpickr.l10ns || !window.flatpickr.l10ns.zh) return { pass: false };
    try {
      const inp = document.createElement('input');
      const inst = new window.FlatpickrInstance(inp, { locale: 'zh', dateFormat: 'Y-m-d' });
      const ok = !!(inst && inst._input === inp && typeof inst.destroy === 'function' && inst.setDate instanceof Function);
      inst.destroy();
      return { pass: ok };
    } catch (err) { return { pass: false, err: String(err).slice(0, 120) }; }
  })()`);
  assert('flatpickr-supply-chain', supply.pass === true, supply);

  // ② zh 日历 DOM：42 格 + 周日开局 weekday + cur-month 中文月名
  const dom = await evaluate(`(() => {
    const host = document.createElement('div');
    host.id = 'bx2-host';
    document.body.appendChild(host);
    const inp = document.createElement('input');
    inp.style.cssText = 'position:fixed;left:100px;top:100px;width:120px;';
    host.appendChild(inp);
    const inst = new window.FlatpickrInstance(inp, { locale: 'zh', dateFormat: 'Y-m-d' });
    window.__bx2Inst = inst;
    const cal = document.querySelector('.flatpickr-calendar');
    const days = cal.querySelectorAll('.dayContainer .flatpickr-day');
    const weekdays = Array.from(cal.querySelectorAll('.flatpickr-weekday')).map((w) => w.textContent.trim());
    return {
      calInBody: cal && cal.parentNode === document.body,
      dayCount: days.length,
      weekdays,
      curMonth: cal.querySelector('.cur-month').textContent.trim(),
      firstCellCls: days[0].className,
      prevSvg: cal.querySelector('.flatpickr-prev-month').innerHTML.indexOf('<svg') > -1,
    };
  })()`);
  assert('flatpickr-dom-structure', dom.calInBody && dom.dayCount === 42 && dom.weekdays.length === 7 && dom.weekdays[0] === '周日' && dom.weekdays[6] === '周六' && dom.curMonth.indexOf('月') > -1 && dom.firstCellCls.indexOf('prevMonthDay') > -1 && dom.prevSvg, dom);

  // ③ open（focus）→ 选日 single：onChange + Y-m-d 值 + closeOnSelect
  const single = await evaluate(`(() => new Promise((outer) => {
    const inst = window.__bx2Inst;
    const fired = [];
    inst.config.onChange = (selectedDates, dateStr, fp) => fired.push(selectedDates.length);
    inst._input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    const cal = document.querySelector('.flatpickr-calendar');
    const opened = cal.classList.contains('open');
    const today = cal.querySelector('.flatpickr-day.today') || cal.querySelectorAll('.flatpickr-day')[10];
    today.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    setTimeout(() => {
      outer({
        opened,
        fired,
        value: inst._input.value,
        closed: !cal.classList.contains('open'),
        valueMatch: /^\\d{4}-\\d{2}-\\d{2}$/.test(inst._input.value),
      });
    }, 60);
  }))()`);
  assert('flatpickr-single-select', single.opened === true && single.fired.length === 1 && single.valueMatch && single.closed === true, single);

  // ④ range 双选：' 至 ' 分隔 + closeOnSelect 选满 2 关
  const range = await evaluate(`(() => new Promise((outer) => {
    const host = document.getElementById('bx2-host');
    const inp2 = document.createElement('input');
    inp2.style.cssText = 'position:fixed;left:100px;top:200px;width:160px;';
    host.appendChild(inp2);
    const inst = new window.FlatpickrInstance(inp2, { locale: 'zh', dateFormat: 'Y-m-d', mode: 'range' });
    const fired = [];
    inst.config.onChange = (selectedDates) => fired.push(selectedDates.length);
    inst._input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    const cal = inst.calendarContainer;
    const days = Array.from(cal.querySelectorAll('.dayContainer .flatpickr-day'));
    const dayA = days.find((d) => !d.classList.contains('prevMonthDay') && !d.classList.contains('nextMonthDay'));
    dayA.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    const openAfterFirst = cal.classList.contains('open');
    setTimeout(() => {
      // 首击会重建 days DOM——二击须用重建后的活节点
      const fresh = Array.from(cal.querySelectorAll('.dayContainer .flatpickr-day'));
      const dayB = fresh[fresh.indexOf(fresh.find((d) => d.classList.contains('selected'))) + 5];
      dayB.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      setTimeout(() => {
        outer({
          openAfterFirst,
          fired,
          value: inst._input.value,
          closed: !cal.classList.contains('open'),
          sepOk: inst._input.value.indexOf(' 至 ') > -1,
        });
      }, 60);
    }, 60);
  }))()`);
  assert('flatpickr-range-select', range.openAfterFirst === true && range.fired.length === 2 && range.sepOk && range.closed === true, range);

  // ⑤ setDate 预填（不触发 Change）+ selectedDates 装载
  const prefill = await evaluate(`(() => {
    const inst = window.__bx2Inst;
    let fired = 0;
    inst.config.onChange = () => fired++;
    inst.setDate(new Date(2024, 5, 15));
    return { value: inst._input.value, fired, selected: inst.selectedDates.length };
  })()`);
  assert('flatpickr-setdate-prefill', prefill.value === '2024-06-15' && prefill.fired === 0 && prefill.selected === 1, prefill);

  // ⑥ 外点关闭 + range 单选态清空
  const outside = await evaluate(`(() => new Promise((outer) => {
    const inst = window.__bx2Inst;
    inst.clear(false);
    inst._input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    const openNow = inst.isOpen;
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    setTimeout(() => {
      outer({ openNow, closedAfter: !inst.isOpen, cleared: inst.selectedDates.length === 0, value: inst._input.value });
    }, 60);
  }))()`);
  assert('flatpickr-outside-close', outside.openNow === true && outside.closedAfter === true && outside.cleared === true, outside);

  // ⑦ destroy 还原
  const destroyed = await evaluate(`(() => {
    const inst = window.__bx2Inst;
    const cal = inst.calendarContainer;
    const hadReadonly = inst._input.hasAttribute('readonly');
    inst.destroy();
    return {
      calGone: !cal.parentNode,
      readonlyRestored: !inst._input.hasAttribute('readonly'),
      hadReadonly,
      flatpickrInputClsGone: !inst._input.classList.contains('flatpickr-input'),
    };
  })()`);
  assert('flatpickr-destroy-restores', destroyed.calGone && destroyed.readonlyRestored && destroyed.hadReadonly && destroyed.flatpickrInputClsGone, destroyed);

  // ⑧ 零 ReferenceError
  const errs = await evaluate(`window.__uxErrors.slice(0, 6)`);
  assert('flatpickr-zero-reference-errors', errs.length === 0, errs);

  if (failure) throw failure;
  console.log('BX2_PROBE_OK');
} catch (err) {
  failure = err;
  console.error(`BX2_PROBE_FAIL ${err.message}`);
} finally {
  clearTimeout(watchdog);
  if (stack) { await stop(stack.electron); await stop(stack.vite); await stop(stack.backend); }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(failure ? 1 : 0);
