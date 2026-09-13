/**
 * P1：IPC 接缝（`core/channelBridge.ts`）路由与事件前转的单元闭环。
 *
 * 断言「单路由不变量」：
 *  - P1-b 纯原生直通频道（update-txt-item / empty-trash / smoke:* / duplicate-file …）→ 走注入的
 *    `eagleDesktop.ipc`（Electron 下即 preload 通用桥），**不**再交给 shims 总线；
 *  - P1-c-1 已迁入接缝的 desktopApi 频道（folders-change / open-preview-window / export-images /
 *    export-as-folder / cancel.all）→ 走注入的 `eagleDesktop.*`，**不**再交给 shims；
 *  - 其余频道（images-change / image-change …）→ 仍走 shims 总线（其路由表负责 mock 与
 *    desktopApi 转发）；
 *  - 事件面（on/emit）前转到 shims 总线（React 监听必须与 shims 的 mockEmit 同一实体）。
 *
 * 位置：浏览器 harness 注入假 `eagleDesktop`（bridge 惰性读取，故支持运行期注入）；无需 Electron。
 * 背景与逐频道分类见 `docs/e5-5-ipc-inventory-2026-09-14.md` 与 `docs/e5-5-shims-retirement-plan.md`。
 */
import { bootWithItem, finish } from './closed-loop-common.mjs';

let ctx;
let extra = {};
let failure = null;
try {
  ctx = await bootWithItem('ipcbridge');
  const { ev, delay } = ctx;

  // ── 阶段 1：纯原生直通 + shims 回落 + 事件前转 ──
  const res = await ev(`(() => {
    const bridge = window.__eagleIpcBridge;
    const bus = window.__eagleIpc;
    if (!bridge || !bus) return { err: 'missing bridge or bus', hasBridge: !!bridge, hasBus: !!bus };

    window.__ipcProbe = { nativeSent: [], busSent: [], emitted: [] };
    const probe = window.__ipcProbe;
    const origSend = bus.send.bind(bus);
    bus.send = function (channel, params) { probe.busSent.push(channel); return origSend(channel, params); };
    const origEmit = bus.emit.bind(bus);
    bus.emit = function (channel, ...args) { probe.emitted.push(channel); return origEmit(channel, ...args); };

    window.__ipcHadDesktop = Object.prototype.hasOwnProperty.call(window, 'eagleDesktop');
    window.__ipcPrevDesktop = window.eagleDesktop;
    window.eagleDesktop = {
      ipc: { send: (channel) => { probe.nativeSent.push(channel); } },
      library: { updateStructure: () => Promise.resolve({ rootDir: '/tmp/lib' }) },
      preview: { open: () => Promise.resolve({ ok: 1 }) },
      export: {
        images: () => Promise.resolve({}), eaglepack: () => Promise.resolve({}),
        asFolder: () => Promise.resolve({}), cancel: () => Promise.resolve({}),
      },
    };

    bridge.send('update-txt-item', { id: 'x' });
    bridge.send('empty-trash', 'ITEM-1');
    bridge.send('smoke:menu-popup', {});
    bridge.sendTo(4242, 'duplicate-file', 'ITEM-1');
    bridge.send('images-change', [{ id: 'y' }]);
    bridge.send('image-change', { id: 'y' });
    bridge.send('folders-change', { folders: [] });
    bridge.send('open-preview-window', { images: [{ id: 'p1' }, {}] });
    bridge.send('export-images', { savePath: 'a.eaglepack' });
    bridge.send('export-images', { savePath: 'a' });
    bridge.send('export-as-folder', {});
    bridge.send('cancel.all', 0);

    let eventHit = 0;
    bridge.on('probe:bridge-event', () => { eventHit += 1; });
    bus.emit('probe:bridge-event', 1);

    return { nativeSent: probe.nativeSent, busSent: probe.busSent, eventHit, invokeDelegated: typeof bus.invoke === 'function' };
  })()`);
  extra.phase1 = res;
  if (res.err) throw new Error(res.err);

  // ── 阶段 2：上次 desktop 路由（Promise 链）期间发出的合成事件 ──
  await delay(250);
  const p2 = await ev(`(() => {
    const probe = window.__ipcProbe;
    const emitted = probe.emitted.slice();
    window.__ipcProbe = null;
    if (window.__ipcHadDesktop) window.eagleDesktop = window.__ipcPrevDesktop; else delete window.eagleDesktop;
    return { emitted };
  })()`);
  extra.phase2 = p2;

  const nativeExpect = ['update-txt-item', 'empty-trash', 'smoke:menu-popup', 'duplicate-file'];
  const busExpect = ['images-change', 'image-change'];
  const desktopExpect = ['folders-change', 'open-preview-window', 'export-images', 'export-as-folder', 'cancel.all'];
  const missingNative = nativeExpect.filter((c) => !res.nativeSent.includes(c));
  const missingBus = busExpect.filter((c) => !res.busSent.includes(c));
  const leakedToBus = desktopExpect.filter((c) => res.busSent.includes(c));
  const doubled = res.nativeSent.filter((c) => busExpect.includes(c));
  if (missingNative.length) throw new Error('native routing missing: ' + JSON.stringify(missingNative));
  if (missingBus.length) throw new Error('shims routing missing: ' + JSON.stringify(missingBus));
  if (leakedToBus.length) throw new Error('desktop channels leaked to shims (single-route violated): ' + JSON.stringify(leakedToBus));
  if (doubled.length) throw new Error('double routing (both native and shims): ' + JSON.stringify(doubled));
  if (res.eventHit !== 1) throw new Error('event forwarding broken: hit=' + res.eventHit);
  if (!res.invokeDelegated) throw new Error('invoke not delegating to shims bus');
  // open-preview-window 的 desktop 分支应合成 preview:operation-result
  if (!(p2.emitted || []).includes('preview:operation-result')) {
    throw new Error('synthetic preview:operation-result missing: ' + JSON.stringify(p2));
  }
} catch (err) {
  failure = err;
}
await finish(ctx, failure, 'IPC_BRIDGE_ROUTING_OK', extra);
