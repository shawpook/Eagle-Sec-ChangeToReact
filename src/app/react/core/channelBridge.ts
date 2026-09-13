import { getIpcWriteState } from './ipcWriteState';

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

/** preload 的具名桌面 API（`window.eagleDesktop`）；浏览器/测试态为 null。 */
function desktopApi(): any {
  const d = (window as any).eagleDesktop;
  return d && typeof d === 'object' ? d : null;
}

function clone<T>(v: T): T {
  return typeof (globalThis as any).structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));
}

/**
 * 已迁入接缝的 desktopApi 路由频道（P1-c-1）。
 *
 * 判据：仅当 `eagleDesktop` 存在且具备对应子 API 时才接管（Electron 态）；否则返回 false 回落
 * shims 总线（浏览器 mock / fetch 兜底）。**接管即不再交 shims**（单路由不变量）。
 * 语义逐字对齐 `shims.js` 的对应分支（含 `.catch` 与合成事件）。
 */
function routeDesktop(bus: any, channel: string, params: any): boolean {
  const d = desktopApi();
  if (!d) return false;

  // P1-c-2：item 持久化路径（用户决策：与 shims 消费方共享同一写队列/发布器）——
  // 语义逐字对齐 shims 原分支：入队时保存快照（clone，后续 live 变更不改已排队请求）；
  // 串行写（enqueueWrite 与 capture 轮询/缩略图回填 await 的是同一队列）；updateMany 返回体
  // 逐条回发 image.changed（itemDomain 合并回 itemMappings 的**唯一**改名回写路径）；isDeleted
  // 触发 duplicates.merge；item:operation-result 成败各一；失败不断链（后续写入照常）。
  //
  // b1-9bz-E7 修复（main-ui-workflow 定位）：回执改为**相对发送快照的差分**。写队列串行，
  // 但用户在等待窗口内的本地编辑（如注解）会在下一条写发出后仍留在 live 对象上；旧实现整条
  // 回发 → itemDomain 的 Object.assign 把「上一条写的后端快照」覆盖到在飞编辑上，
  // 表现为 updateMany 载荷偶发回退成导入初值（基线亦失败族）。差分 = 本条写相对入队快照真正
  // 改变的字段，应用时不会动更晚的本地编辑。
  if (channel === 'images-change' || channel === 'image-change') {
    if (!d.item || typeof d.item.updateMany !== 'function') return false;
    const items = channel === 'images-change' ? params : [params];
    const snapshots = (Array.isArray(items) ? items : []).filter((item: any) => item && item.id).map((item: any) => clone(item));
    const state = getIpcWriteState();
    state.enqueueWrite(() =>
      Promise.resolve(d.item.updateMany(snapshots))
        .then((updated: any) => {
          state.mergeCachedItems(updated);
          (Array.isArray(updated) ? updated : [updated]).forEach((item: any) => {
            if (!item || !item.id) return;
            const snapshot = snapshots.find((entry: any) => entry.id === item.id);
            let echo: any = item;
            if (snapshot) {
              echo = { id: item.id };
              let changed = false;
              for (const key of Object.keys(item)) {
                if (key === 'id' || key === 'lastModified' || key === 'modificationTime') continue;
                if (snapshot[key] !== item[key]) { echo[key] = item[key]; changed = true; }
              }
              if (!changed) return;
            }
            state.emitEvent('image.changed', echo);
          });
          const keep = snapshots.find((item: any) => !item.isDeleted);
          const trash = snapshots.filter((item: any) => item.isDeleted);
          if (keep && trash.length > 0 && d.duplicates) {
            Promise.resolve(d.duplicates.merge({
              keepId: keep.id,
              removeIds: trash.map((item: any) => item.id),
              keep,
            })).catch((err: any) => state.emitEvent('duplicate-merge-error', { error: err && err.message }));
          }
          state.emitEvent('item:operation-result', { ok: true, action: channel, items: updated });
          return updated;
        })
        .catch((err: any) => {
          state.emitEvent('item:operation-result', { ok: false, action: channel, error: err && err.message });
          return [];
        })
    );
    return true;
  }

  if (channel === 'folders-change') {
    if (!d.library || typeof d.library.updateStructure !== 'function') return false;
    Promise.resolve(d.library.updateStructure(params || {})).then((library: any) => {
      if (library) {
        const w = window as any;
        w.__mockLibrary = { ...(w.__mockLibrary || {}), ...library };
        if (Array.isArray(library.items)) w.__mockLibraryCache = library.items.slice();
      }
    }).catch((err: any) => {
      bus.emit('library:operation-result', { ok: false, action: channel, error: err && err.message });
    });
    return true;
  }

  if (channel === 'open-preview-window') {
    if (!d.preview || typeof d.preview.open !== 'function') return false;
    const images = Array.isArray(params && params.images)
      ? params.images.filter((item: any) => item && item.id).map((item: any) => clone(item))
      : [];
    Promise.resolve(d.preview.open({ images })).then((result: any) => {
      bus.emit('preview:operation-result', { ok: true, result });
    }).catch((err: any) => bus.emit('preview:operation-result', { ok: false, error: err && err.message }));
    return true;
  }

  if (channel === 'export-images' || channel === 'export-as-folder' || channel === 'cancel.all') {
    if (!d.export) return false;
    if (channel === 'export-images') {
      const exportParams = params || {};
      if (String(exportParams.savePath || '').toLowerCase().endsWith('.eaglepack')) {
        if (typeof d.export.eaglepack !== 'function') return false;
        Promise.resolve(d.export.eaglepack(exportParams)).catch(() => {});
      } else {
        if (typeof d.export.images !== 'function') return false;
        Promise.resolve(d.export.images(exportParams)).catch(() => {});
      }
      return true;
    }
    if (channel === 'export-as-folder') {
      if (typeof d.export.asFolder !== 'function') return false;
      Promise.resolve(d.export.asFolder(params || {})).catch(() => {});
      return true;
    }
    if (typeof d.export.cancel !== 'function') return false;
    Promise.resolve(d.export.cancel()).catch(() => {});
    return true;
  }

  return false;
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
      if (routeDesktop(bus, channel, params)) return;
      return bus.send(channel, params);
    },
    // shims 的 sendTo 语义是「忽略 id、落到 send」（见 shims.js 的 sendTo 覆写），故原生分支同样
    // 直接 send —— 用 ipcRenderer.sendTo 会改变投递目标（发给某个 webContents 而非主进程）。
    sendTo(id: any, channel: string, params?: any) {
      const n = nativeIpc();
      if (n && isNativeSend(channel)) return n.send(channel, params);
      if (routeDesktop(bus, channel, params)) return;
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
