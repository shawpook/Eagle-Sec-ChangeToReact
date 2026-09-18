/**
 * 右上角窗口控件闭环回归 —— F-WIN-1。
 *
 * 保护的是这个具体缺陷：**四个控件点了没反应，且不留任何痕迹**。
 * 根因：`window.require('electron').remote.getCurrentWindow()` 在本仓是死路——
 * `window.require` 已被 shim 接管（`core/shim/install.ts:152`），替身对象上 `.remote`
 * 恒为 undefined（`desktopCapability.ts:699` 已登记该缺口），于是 `win?.minimize?.()`
 * 一路静默空转：不抛错、不打日志、不报未迁移——最隐蔽的一类失效。
 *
 * 核心断言（按重要性）：
 * 1. **死路必须保持死**：`window.require('electron').remote` 仍为 undefined。
 *    若哪天 shim 补上了 remote，本测试会失败并提示「可简化调用点」——这是有意的信号。
 * 2. **桥必须可用**：`window.eagleDesktop.window` 上 minimize/maximize/close/setAlwaysOnTop 齐备。
 * 3. **点击必须真的落到桥上**（本测试的主断言）：点最小化/最大化/关闭/置顶后，
 *    桥方法被调用 —— 这才能区分「接线正确」与「静默空转」。
 * 4. 最大化后按钮应切到 restore（状态回写链路通）。
 */
import { bootWithItem, finish } from './closed-loop-common.mjs';

/** 必须齐备的桥方法（缺一即为接线缺口）。 */
const REQUIRED_BRIDGE_METHODS = ['minimize', 'maximize', 'unmaximize', 'close', 'setAlwaysOnTop', 'setFullScreen'];

let ctx;
let extra = {};
let failure = null;

try {
  ctx = await bootWithItem('winctrl');
  const { ev, waitFor, delay } = ctx;

  await waitFor(async () => await ev(`!!document.querySelector('.corner-btns')`), 'corner-btns mounted', 20000);

  /* 1. 死路保持死 —— 这是本缺陷的根因，必须被显式记录 */
  const remoteIsUndefined = await ev(
    `(() => { try { return window.require('electron').remote === undefined; } catch (e) { return true; } })()`,
  );
  extra.remoteUndefined = remoteIsUndefined;
  if (!remoteIsUndefined) {
    throw new Error(
      'shim 的 electron 替身现在有 .remote 了——Toolbar/appState 的调用点可改回 remote，请复核两处注释',
    );
  }

  /* 2. 桥齐备 */
  const methods = await ev(`(() => {
    const w = window.eagleDesktop?.window;
    if (!w) return null;
    const out = {};
    for (const k of ${JSON.stringify(REQUIRED_BRIDGE_METHODS)}) out[k] = typeof w[k];
    return out;
  })()`);
  extra.bridgeMethods = methods;
  if (!methods) throw new Error('window.eagleDesktop.window 不存在（preload 未暴露窗口桥）');
  const missing = REQUIRED_BRIDGE_METHODS.filter((k) => methods[k] !== 'function');
  if (missing.length) throw new Error(`窗口桥缺方法：${missing.join(', ')}`);

  /* 3. 主断言：点击必须真的落到桥上 */
  await ev(`(() => {
    window.__winCalls = [];
    const w = window.eagleDesktop.window;
    for (const k of ${JSON.stringify(REQUIRED_BRIDGE_METHODS)}) {
      const orig = w[k];
      if (typeof orig === 'function') w[k] = (...a) => { window.__winCalls.push(k); return orig(...a); };
    }
    return true;
  })()`);

  const fire = async (selector, label) => {
    await ev(`window.__winCalls = []; true`);
    const found = await ev(`(() => {
      const b = document.querySelector(${JSON.stringify(selector)});
      if (!b) return false;
      b.click();
      return true;
    })()`);
    await delay(600);
    const calls = await ev(`window.__winCalls`);
    return { label, found, calls };
  };

  // 注意顺序：**关闭必须放最后**——它会真的销毁被测窗口，之后任何 CDP 命令都会挂死
  // （首次实现把 close 夹在中间，导致测试卡住 9 分钟无输出）。最大化也放在关闭之前，
  // 以便顺带验证 restore 图标切换。
  const results = [];
  results.push(await fire('.corner-btns .ic-btn', '置顶'));
  results.push(await fire('[data-click="minimize()"]', '最小化'));
  results.push(await fire('[data-click="maximize()"]', '最大化'));
  extra.clicks = results;

  for (const r of results) {
    if (!r.found) throw new Error(`找不到「${r.label}」控件（选择器失效，DOM 结构可能已变）`);
    if (!Array.isArray(r.calls) || r.calls.length === 0) {
      throw new Error(`「${r.label}」点击后桥上零调用 —— 仍是静默空转（接线未生效）`);
    }
  }

  /* 置顶应发出 setAlwaysOnTop */
  const pinCalls = results[0].calls;
  if (!pinCalls.includes('setAlwaysOnTop')) {
    throw new Error(`置顶控件未调用 setAlwaysOnTop，实际调用：${JSON.stringify(pinCalls)}`);
  }

  /* 4. 最大化状态回写：maximize 后应切到 restore */
  await delay(1200);
  const visual = await ev(`(() => {
    const maxBtn = document.querySelector('[data-click="maximize()"]');
    const resBtn = document.querySelector('[data-click="restore()"]');
    const vis = (el) => !!el && el.style.display !== 'none';
    return { maximizeVisible: vis(maxBtn), restoreVisible: vis(resBtn) };
  })()`);
  extra.afterMaximize = visual;
  if (!visual.restoreVisible) {
    throw new Error(
      `最大化后 restore 按钮未出现（isMaximize 未回写）—— 事件链 window:state-changed → shim → miscDomain 可能断了。实际：${JSON.stringify(visual)}`,
    );
  }

  /* 5. 关闭：**放最后且不等待回读**。
     点击后窗口会被真的销毁，任何后续 CDP 命令都会挂死（首次实现即卡在此处 5 分钟）。
     故只「发起点击」并断言调用已记录在页内数组里——该数组在窗口销毁前同步写入，
     不等 IPC 往返。 */
  const closeDispatched = await ev(`(() => {
    window.__winCalls = [];
    const b = document.querySelector('[data-click="close()"]');
    if (!b) return { found: false };
    b.click();
    return { found: true, calls: window.__winCalls };
  })()`);
  extra.closeClick = closeDispatched;
  if (!closeDispatched.found) throw new Error('找不到「关闭」控件');
  if (!Array.isArray(closeDispatched.calls) || closeDispatched.calls.length === 0) {
    throw new Error('「关闭」点击后桥上零调用 —— 仍是静默空转（接线未生效）');
  }
} catch (err) {
  failure = err;
}

await finish(ctx, failure, 'WINDOW_CTRL_OK', extra);
