/**
 * P1 接缝：跨边界 IPC 总线的唯一取用口。
 *
 * 现状（2026-09-14 清点，见 `docs/e5-5-ipc-inventory-2026-09-14.md`）：总线实体由
 * `frontend/public/shims.js` 以 `EventEmitter` 建立，并挂到 `window.$$electronIpc` /
 * `window.__eagleIpc` / `window.ipcRenderer`（另 `window.electron.ipcRenderer` 同源）。
 * 主窗 React 侧此前有 13 组散落的「直接取总线」表达式；本模块把这层收敛为一个函数，
 * 后续批次（P1-b…P1-e）会：
 *   - 让总线与本模块的路由成为主实体（preload 增通用 `ipc` 桥）；
 *   - 把 shims 降级为仅浏览器/测试态的 mock `IpcTransport`（经 `setIpcTransport` 注入）。
 *
 * **本批次只做「取引用」收敛，行为零变化**：`getIpcBus()` 与原先各处的
 * `__eagleIpc || electron.ipcRenderer` 解析到同一对象。
 */

/** 取当前窗口的 IPC 总线（shims 建）。返回 null 表示尚未安装（早于 shims 的调用）。 */
export function getIpcBus(): any {
  const w = window as any;
  return w.$$electronIpc || w.__eagleIpc || w.ipcRenderer || (w.electron && w.electron.ipcRenderer) || null;
}
