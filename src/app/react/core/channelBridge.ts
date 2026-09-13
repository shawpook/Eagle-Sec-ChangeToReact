/**
 * P1 接缝：跨边界 IPC 总线的唯一取用口 + 通道路由。
 *
 * 现状（2026-09-14 清点，见 `docs/e5-5-ipc-inventory-2026-09-14.md`）：总线实体由
 * `frontend/public/shims.js` 以 `EventEmitter` 建立，并挂到 `window.$$electronIpc` /
 * `window.__eagleIpc` / `window.ipcRenderer`（另 `window.electron.ipcRenderer` 同源）。
 * 它同时是**路由表**（`shims.js` 的 `ipcRenderer.send` 覆写，71 个分支）与
 * **主进程回程扇入点**（`desktopApi.onIpc` → `mockEmit`）。故本模块不是简单取引用，而是接缝：
 *
 *   - **事件面**（`on/once/off/emit/…`）→ 前转到 shims 总线：React 监听的都是总线事件，
 *     shims 合成的 21 个事件（`image.changed`/`library:changed`/`thumbnail-generated`/…）与
 *     主进程回程都由此到达。
 *   - **发送面**（`send/sendTo`）→ 按通道二分：**纯原生直通**的少数频道走 preload 的通用
 *     `ipc` 桥（`electron/preload.cjs` 新增）直达主进程；**其余全部**仍走 shims 总线（其路由表
 *     负责 desktopApi 转发 / 浏览器 mock / 合成事件）。
 *
 * **不变量（单路由）**：任一频道在任一时刻只有一个落点 —— 走 preload 的频道**绝不**再交给
 * shims（否则双发），走 shims 的频道**绝不**走 preload。判据由 `isNativeSend` 唯一给出。
 *
 * P1 后续批次：把 shims 的路由表分支逐段迁入本模块（`routeSend`），直到 shims 只剩浏览器
 * mock 传输（经 `setIpcTransport` 注入），再删 `shims.js`。
 */

/** 纯原生直通频道：Electron 下 shims 对它只做 `nativeRequire('electron').ipcRenderer.send` 转发，
 *  main.cjs 有同名 `ipcMain.on` 处理器；浏览器态（无 desktopApi）不满足 `nativeIpc()` 条件，自动回落 shims。 */
const NATIVE_SEND_CHANNELS = new Set([
  'update-txt-item',
  'empty-trash',
  'cancel-empty-trash',
  'generate-hight-resolution-thumbnail',
  'duplicate-file',
  'copy-thumbnails',
]);

/** preload 暴露的通用 ipc 桥（`electron/preload.cjs` 的 `api.ipc`）；浏览器/测试态为 null。 */
function nativeIpc(): any {
  const d = (window as any).eagleDesktop;
  return d && d.ipc && typeof d.ipc.send === 'function' ? d.ipc : null;
}

/** shims 建的总线实体。 */
function rawBus(): any {
  const w = window as any;
  return w.$$electronIpc || w.__eagleIpc || w.ipcRenderer || (w.electron && w.electron.ipcRenderer) || null;
}

function isNativeSend(channel: any): boolean {
  if (typeof channel !== 'string') return false;
  return channel.indexOf('smoke:') === 0 || NATIVE_SEND_CHANNELS.has(channel);
}

/** 事件面方法：一律前转到 shims 总线（React 的监听必须与 shims 的 mockEmit / onIpc 扇出同一实体）。 */
const FORWARD_METHODS = [
  'on', 'once', 'addListener', 'prependListener', 'prependOnceListener',
  'off', 'removeListener', 'removeAllListeners', 'emit',
  'listeners', 'listenerCount', 'setMaxListeners', 'eventNames',
];

function createFacade(bus: any): any {
  const facade: any = {
    __eagleChannelBridge: true,
    send(channel: string, params?: any) {
      const n = nativeIpc();
      if (n && isNativeSend(channel)) return n.send(channel, params);
      return bus.send(channel, params);
    },
    // shims 的 sendTo 语义是「忽略 id、落到 send」（见 shims.js 的 sendTo 覆写），故原生分支同样
    // 直接 send —— 用 ipcRenderer.sendTo 会改变投递目标（发给某个 webContents 而非主进程）。
    sendTo(id: any, channel: string, params?: any) {
      const n = nativeIpc();
      if (n && isNativeSend(channel)) return n.send(channel, params);
      return typeof bus.sendTo === 'function' ? bus.sendTo(id, channel, params) : bus.send(channel, params);
    },
    // invoke 必须先走 shims：它覆写了 invoke 以承接 `nativeImage.createThumbnailFromPath` 等。
    invoke(channel: string, params?: any) {
      if (typeof bus.invoke === 'function') return bus.invoke(channel, params);
      const n = nativeIpc();
      return n && typeof n.invoke === 'function' ? n.invoke(channel, params) : undefined;
    },
    r2r(...args: any[]) {
      if (typeof bus.r2r === 'function') return bus.r2r(...args);
      const n = nativeIpc();
      return n && typeof n.r2r === 'function' ? n.r2r(...args) : undefined;
    },
    sendSync(channel: string, params?: any) {
      if (typeof bus.sendSync === 'function') return bus.sendSync(channel, params);
      const n = nativeIpc();
      return n && typeof n.sendSync === 'function' ? n.sendSync(channel, params) : undefined;
    },
  };
  for (const m of FORWARD_METHODS) {
    facade[m] = (...args: any[]) => (typeof bus[m] === 'function' ? bus[m](...args) : undefined);
  }
  return facade;
}

let facade: any = null;

/** 取当前窗口的 IPC 接缝（单例）。返回 null 表示总线尚未安装（早于 shims 的调用）。 */
export function getIpcBus(): any {
  const bus = rawBus();
  if (!bus) return null;
  if (!facade) {
    facade = createFacade(bus);
    // 诊断/观测口（与 `__eagleScopeRegistry` 同类，仅测试与排障读取；业务不依赖）。
    (window as any).__eagleIpcBridge = facade;
  }
  return facade;
}
