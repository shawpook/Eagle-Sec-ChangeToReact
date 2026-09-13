# P1 前置：React ↔ shims IPC 总线现有面清点（2026-09-14）

> 用途：`core/channelBridge.ts`（P1）施工前的**实测地图**。本文由只读侦察产出（2026-09-14），
> 与 `docs/e5-5-shims-retirement-plan.md` §0 互补：§0 更正了逐信道分类，本文给出**消费面**规模。
> 结论先行：**P1 不是「搬 16 段路由」，而是把整条总线 + 21 个合成事件 + 回程扇出 + 约 20 个 legacy
> 脚本的依赖一起迁走**，属独立会话级工作量。

---

## 1. 总线实体（现状）

| 事实 | 位置 |
|---|---|
| shims 建单个 `EventEmitter` 作为 `ipcRenderer` | `frontend/public/shims.js:917`（局部变量），事件封装 `:835-876` |
| 暴露为三个全局 + `electron.ipcRenderer` | `window.ipcRenderer` `:3105`、`window.$$electronIpc` `:3106`、`window.__eagleIpc` `:3107`；`electron.ipcRenderer` `:2309-2310` |
| `send` 覆写（路由表） | `:1376-1792` |
| `invoke` / `r2r` 覆写 | `:1793-1822` / `:1823-1828` |
| 主进程→渲染层回程扇入总线 | `desktopApi.onIpc` 等 `:1830-1943`，统一走 `mockEmit`（`= ipcRenderer.emit.bind`，`:918`） |
| `eagleGlobals.ipcRenderer()` 取值顺序 | `desktop.ipc`（preload **无此键**）→ `window.$$electronIpc` → `window.__eagleIpc`，即**必落 shims 总线**（`src/app/react/global/eagleGlobals.ts:41-45`） |

**故 Electron 生产路径下 shims 是承重件**（`electron/main.cjs:8` 恒加载 vite 预览服，shims 随 index.html 注入）。

---

## 2. 获取总线的表达式（P1 第一步的改造面）

React 侧按表达式分组（`file:line` 省略，均为实测）：

| # | 表达式 | 处数 |
|---|---|---|
| 1 | `(window as any).__eagleIpc \|\| (window as any).electron?.ipcRenderer` | 12 |
| 2 | `w.__eagleIpc \|\| (w.electron && w.electron.ipcRenderer)` | 11 |
| 3 | `w.__eagleIpc \|\| w.ipcRenderer` | 1 |
| 4 | `w.__eagleIpc \|\| (w.electron && w.electron.ipcRenderer)` 的闭包形态 `const ipcRef = () => …` | 1 |
| 5 | `(window as any).$$electronIpc \|\| (window as any).__eagleIpc`（`app/AppRoot.tsx:25`） | 1 |
| 6 | `w.$$electronIpc \|\| w.__eagleIpc`（`core/selectionViewDomain.ts:163`） | 1 |
| 7 | 官方 helper `ipcRenderer()`（`eagleGlobals.ts:41`）的调用点 | 12 |
| 8 | `req('electron')?.ipcRenderer` / `req('electron').ipcRenderer`（含 preferences/controller、preview-window、collect-window、viewers entry） | 19 |
| 9 | `parent.ipcRenderer`（viewer iframe 面） | 5 |
| 10 | `w.require('electron').ipcRenderer`（`services/uploadService.ts:490`） | 1 |
| 11 | `getIpc()`（`components/detail/detailHooks.ts:53`，`req('electron')?.ipcRenderer \|\| ipcRenderer()`）在 14 文件 40 处调用 | 40 |
| 12 | `IPCHelper` 单例（`core/ipcHelper.ts:9` 模块加载期取一次），约 30 处 send/sendTo | ~30 |
| 13 | `apiIpc()`（`core/apiServerDomain.ts:185-187`），10 处调用 | 10 |

> 改造目标：全部收敛到 `getIpcBus()`（新接缝）。注意 #8/#9/#10/#12 是 **模块加载期取引用**，
> 换成函数调用更稳（总线在 shims 之后、React 之前已就绪，行为等价）。

---

## 3. 合成事件（shims 本地 `mockEmit` 造，迁桥必须保留）

静态 channel 字面量（`shims.js` 行号）：

| channel | 行 |
|---|---|
| `file-uploaded-end` | 1008, 1070, 1614 |
| `import:operation-result` | 1009, 1069, 1613, 1758 |
| `thumbnail-generated` | 1183, 1668, 1698, 1719, 1876 |
| `image.palette.updated` | 1311 |
| `preview:action-result` | 1362-1363 |
| `library:changed` | 1517, 1548, 1754, 1901, 3226 |
| `library:operation-result` | 1518, 1520, 1549, 1551, 1561, 1904 |
| `item:operation-result` | 1569, 1600, 1604, 1908 |
| `image.changed` | 1587 |
| `duplicate-merge-error` | 1597 |
| `preview:operation-result` | 1623-1624 |
| `thumbnail-operation-error` | 1670, 1700, 1721 |
| `close-export-task` | 1848 |
| `file-uploaded` | 1872 |
| `rebind-refresh` | 1877 |
| `import-file-progress` | 1893 |
| `import-folder-progress` | 1896 |
| `init` | 1933, 1939 |
| `update-preferences` / `change.current.theme` / `change.zoom` | 2660-2662 |

动态 `mockEmit`：
- `:1865` 循环转发 `['show-export-task','finish-export-task','show-archive-task','add-archive-task','update-archive-percent','finish-archive-task','abort-archive-task','update-txt-item','remove-trash-item','native-preview-failed']`；
- `:2682` `broadcastIpc` 未知频道；`:2700` 跨窗 storage-relay。

**副作用（迁桥时必须一并搬）**：
- `:1870-1873` `file-uploaded` 先 `mergeCachedItems(item)` 再 emit；
- `:1836-1849` `close-export-task` 先复位 legacy `file-export-progress` scope 再 emit；
- `:920-943` `ipcRenderer.emit` 包装：`file-uploaded` 去重（依赖 `__eagleScopeRegistry.read('raw')`）、
  `library:changed`/`preload-library`/`app-status-library-loaded` 顺带 `closeDocumentViewer()`。

---

## 4. 频道交叉（决定桥的职责边界）

**React 产 → React 消（双端都在 React，可纯 React 承接）**：
`toggle-slideshow`、`leave-slideshow`、`activate-font`、`deactivate-font`、`reveal-in-eagle`、
`update-txt-item`、`lock-now`、`get-recent-folders`。

**React 产 → 无 React 消（去向主进程/其它窗/后台，需真 IPC）**：约 55 个频道，含
`image-change`/`images-change`/`empty-trash`/`folders-change`/`set-custom-thumbnail`/
`regenerate-*`/`export-*`/`upload-*`/`open-preview-window`/`open-with-default`/`show-item-in-folder`/
`quicklook`/`chnage-preferences`/`change-theme`/`change-zoom`/`cancel.*`/`save-cache-file`/
`open-trial-modal`/`remove-registration`/`ondragstart`/`smoke:menu-popup` 等。

**React 消 → 无 React 产（主进程回程 / shims 合成，桥必须喂）**：约 90 个频道，含
`app-status-*` 家族、`analytics.*`、`window.maximize/unmaximize`、`background-state`、
`preferences-updated`、`before-quit`、`power-suspend/resume`、`open-item`、`go-folder`、
`go-smart-folder`、`add-history-tag(s)`、`image.added/removed/changed/palette.updated`、
`show/finish/close-*task` 家族、`thumbnail-generated`、`rebind-refresh`、`library.changed`、
`preload-library`、`init`、`update-preferences`、`change.current.theme`、`change.zoom` 等。

> 异常项：`PluginCenter.tsx:701-702` 注册 `ipc.off('install-plugin')`/`off('open-plugin-center-and-search')`
> 但无对应 `on`——疑似悬空，可在 P1 顺带核查。

---

## 5. 同总线的 legacy 脚本（P1/P5 的另一半）

`src/app/js/**` 约 20 个 classic 脚本用 `require('electron').ipcRenderer`（= shims 总线）收发。
生产者代表频道：`add-download-task-end`、`cancel.all`、`change-theme`、`chnage-scrollBehavior`、
`copy-paths-to-clipboard`、`empty-trash`、`image-change`/`images-change`、`notification`、
`open-with-default`、`open.preferences`、`palette-resume`、`plugin.loaded`、`regenerate-thumbnail`、
`set-custom-thumbnail`、`show-item-in-folder`、`show-swal`、`toggle-slideshow`、`upload-urls`、
`url-from-extension`、`webp-convert`、`create-context-menu` 等；消费者含
`update-preferences`、`image.changed`、`plugin-installed/uninstalled`、`app-status-*`、
`thumbnail-generated`、`webp.converted`、`open-batch-save-panel` 等。
另有 `plugin/*`（`plugin/ipc.js:30`、`plugin/handlers.js:21`）走**动态 `on(name)` / `once(params.channel)`**。

> 含义：删 shims 前必须让这些 classic 脚本要么迁 React、要么改走新桥；否则它们的 IPC 会断。

---

## 6. 建议的 P1 拆批（每批独立绿）

1. **P1-a 接缝收敛**：新增 `core/channelBridge.ts` 暴露 `getIpcBus()`（暂**委托现有 shims 总线**，
   零行为变化）；把 §2 的 13 组取用点全部改走该接缝。改动机械、tsc 可验。
2. **P1-b preload 通用 ipc**：`electron/preload.cjs` 增 `ipc: { send, sendTo, on, once, off, invoke, sendSync }`；
   `channelBridge` 的 `send` 对「纯原生直通」8 段改走 `eagleDesktop.ipc`（§0 表），其余仍走 shims。
3. **P1-c 合成/回程迁 React**：§3 的 21 个合成事件 + 副作用 + `desktopApi.onIpc` 扇出搬入 `channelBridge`，
   shims 侧对应块删除；`file-uploaded` 去重与 `closeDocumentViewer` 钩子一并搬。
4. **P1-d mock 传输**：shims 余下 mock 分支实现为一个 `IpcTransport`，经 `setIpcTransport()` 注入
   （浏览器/测试态）。
5. **P1-e legacy 脚本**：§5 的 classic 脚本改走新桥（或确认其已不加载）。
6. **P5**：摘 vite 注入、删 `shims.js`、3 个源码字符串断言改指新接缝。

**每批门禁**：哨兵 + tsc 零新增键 + §0 的定向套件（channel-wiring / library-switch-ui /
empty-trash / txt-update / menu-popup / native-preview / drag-start / preview-delivery /
source-mode-ui / main-ui-workflow）。
