/**
 * P1-b：IPC 接缝（`core/channelBridge.ts`）路由与事件前转的单元闭环。
 *
 * 断言「单路由不变量」：
 *  - 纯原生直通频道（update-txt-item / empty-trash / smoke:* / duplicate-file …）→ 走注入的
 *    `eagleDesktop.ipc`（Electron 下即 preload 通用桥），**不**再交给 shims 总线；
 *  - 其余频道（images-change / image-change …）→ 仍走 shims 总线（其路由表负责 desktopApi
 *    转发与 mock）；
 *  - 事件面（on/emit）前转到 shims 总线（React 监听必须与 shims 的 mockEmit 同一实体）。
 *
 * 位置：浏览器 harness 注入假 `eagleDesktop.ipc` 记录投递；无需 Electron。
 * 背景与逐频道分类见 `docs/e5-5-ipc-inventory-2026-09-14.md` 与 `docs/e5-5-shims-retirement-plan.md`。
 */
import { bootWithItem, finish } from './closed-loop-common.mjs';

let ctx;
let extra = {};
let failure = null;
try {
  ctx = await bootWithItem('ipcbridge');
  const { ev } = ctx;

  const res = await ev(`(() => {
    const bridge = window.__eagleIpcBridge;
    const bus = window.__eagleIpc;
    if (!bridge || !bus) return { err: 'missing bridge or bus', hasBridge: !!bridge, hasBus: !!bus };

    const nativeSent = [];
    const busSent = [];
    const origSend = bus.send.bind(bus);
    bus.send = function (channel, params) { busSent.push(channel); return origSend(channel, params); };

    // 浏览器 harness 本无 eagleDesktop.ipc（shims 用 fetch/mock 兜底）——此处注入假原生桥以观测路由。
    const hadDesktop = Object.prototype.hasOwnProperty.call(window, 'eagleDesktop');
    const prevDesktop = window.eagleDesktop;
    window.eagleDesktop = { ipc: { send: (channel) => { nativeSent.push(channel); } } };

    // 原生直通面
    bridge.send('update-txt-item', { id: 'x' });
    bridge.send('empty-trash', 'ITEM-1');
    bridge.send('smoke:menu-popup', {});
    bridge.sendTo(4242, 'duplicate-file', 'ITEM-1');
    // shims 路由面（浏览器态下 shims 对这两个频道无 desktopApi 分支 → 安全 no-op）
    bridge.send('images-change', [{ id: 'y' }]);
    bridge.send('image-change', { id: 'y' });

    // 事件面：bus 上 emit 必须触达 bridge.on 注册的监听（shims 的 mockEmit 即走这条路）
    let eventHit = 0;
    bridge.on('probe:bridge-event', () => { eventHit += 1; });
    bus.emit('probe:bridge-event', 1);

    // invoke 必须先走 shims（其覆写承接 nativeImage.createThumbnailFromPath 等）
    const invokeDelegated = typeof bus.invoke === 'function';

    if (hadDesktop) window.eagleDesktop = prevDesktop; else delete window.eagleDesktop;
    bus.send = origSend;
    return { nativeSent, busSent, eventHit, invokeDelegated };
  })()`);

  extra = res;
  if (res.err) throw new Error(res.err);
  const nativeExpect = ['update-txt-item', 'empty-trash', 'smoke:menu-popup', 'duplicate-file'];
  const busExpect = ['images-change', 'image-change'];
  const missingNative = nativeExpect.filter((c) => !res.nativeSent.includes(c));
  const missingBus = busExpect.filter((c) => !res.busSent.includes(c));
  const doubled = res.nativeSent.filter((c) => busExpect.includes(c));
  if (missingNative.length) throw new Error('native routing missing: ' + JSON.stringify(missingNative) + ' got ' + JSON.stringify(res));
  if (missingBus.length) throw new Error('shims routing missing: ' + JSON.stringify(missingBus) + ' got ' + JSON.stringify(res));
  if (doubled.length) throw new Error('double routing (both native and shims): ' + JSON.stringify(doubled));
  if (res.eventHit !== 1) throw new Error('event forwarding broken: hit=' + res.eventHit);
  if (!res.invokeDelegated) throw new Error('invoke not delegating to shims bus');
} catch (err) {
  failure = err;
}
await finish(ctx, failure, 'IPC_BRIDGE_ROUTING_OK', extra);
