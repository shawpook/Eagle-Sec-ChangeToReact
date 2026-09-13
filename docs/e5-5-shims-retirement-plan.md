# E5-5 / D-2 施工设计：`frontend/public/shims.js` 退役

> 立项文档（2026-09-13）。收官状态见 `docs/rewrite-closing-2026-09-13.md` §6.1。
> 本文把该四步分解落到**代码级可执行**：接缝 API、逐信道分类、第一步任务清单与门禁、风险与不变量。
> **状态：第一步未落地**（见文末「为何停在设计」）。

---

## 1. 现状量化（实测）

| 项 | 量 |
|---|---|
| `frontend/public/shims.js` | **4007 行**（IIFE，`window.__eagleBrowserShimLoaded` 幂等守卫） |
| `frontend/public/mock-data.js` | 453 行（17 条 mock 条目 fixture） |
| 注入点 | `frontend/vite.preview.config.mjs` **dev 与 build 双路径**（主 app head 一处 + 另一入口一处） |
| `ipcRenderer.send` 覆写 | **658 行 / 71 个 channel 分支** —— 即应用**整条渲染层→主进程 IPC 路由** |
| `desktopApi.onIpc` 回程桥 | 47 行 / 5 channel（`file-uploaded`、`thumbnail-generated`、`rebind-refresh`、`show-item-in-folder`、`close-export-task`）→ `mockEmit` 扇出 |
| 耦合计数（send 覆写体内） | `desktopApi` 126 · `mockEmit` 36 · `nativeRequire` 16 · `__mockLibraryCache` 8 · `previewCurrentItemId` 5 · `emitImportedItems` 3 · `trackLocalImport` 2 |

**关键事实**：shims 在 Electron 下**不是旁路 mock，而是 IPC 路由器**——它用 `new EventEmitter()`
建本地 `ipcRenderer` 并挂到 `window.$$electronIpc`（应用 `core/eagleGlobals.ts` 的 `ipcRenderer()`
即取到它），未识别/需直通的 channel 再由 `nativeRequire('electron').ipcRenderer.send` 转发到真 IPC。
因此退役 shims 必须**先把这条路由搬到 React 侧**，否则应用所有 ipc `send` 断链。

---

## 2. 目标架构与接缝

```
渲染层调用点 ──▶ core/channelBridge.ts ──▶ IpcTransport ──▶ main.cjs / backend
                      │                        ▲
                      │                        └── Electron：preload 的 ipcRenderer
                      │                            浏览器/冒烟：shims 提供的 mock transport
                      └──▶ dev-shims（仅 DEV/测试）：mock 库、fetch 改写、capture 轮询、viewer 逐页 mock
```

```ts
// core/channelBridge.ts（新增）
export interface IpcTransport {
  send(channel: string, params?: any): void;              // 渲染层 → 主进程
  sendTo?(id: number, channel: string, params?: any): void;
  on(channel: string, fn: (value: any) => void): void;    // 主进程 → 渲染层
}
export function setIpcTransport(t: IpcTransport | null): void;
/** 幂等安装路由；electronMain=真实桌面面（preload/desktopApi），浏览器下由 shims 注入 mock transport。 */
export function installChannelBridge(deps: { desktopApi: any }): void;
```

- **回程**（`desktopApi.onIpc` → 应用监听）：由 channelBridge 统一 `on()` 后扇出，
  应用侧监听口保持 `core/eagleGlobals.ts` 的 `ipcRenderer()` 不变（它改为指向 channelBridge 的 facade）。
- **`window.$$electronIpc`**：改由 channelBridge 暴露同一 facade（`native/entry.tsx` 的
  `parent.ipcRenderer.send` 依赖它）。

> **关键约束（实测）**：传输层的**获取**必须留在 shims —— shims 在 IIFE 顶部
> （`shims.js:14`）先捕获 `nativeRequire = window.require`，随后在 `shims.js:3099` 用
> `window.require = require` 把真 `require` stub 掉。React 模块由 vite 在 shims 之后加载，
> **无法再拿到真 `require`/`ipcRenderer`**。此外 `electron/preload.cjs` 经 contextBridge 只暴露
> 具名 API（`library.*`/`item.*`/`onIpc`/…），**没有通用 `ipc.send`**；而 `eagleGlobals.ts` 的
> `ipcRenderer()` = `eagleDesktop().ipc`（不存在）→ 回落 `window.$$electronIpc`，即 **shims 的 mock**。
> 结论：**Electron 下渲染层→主进程的 send 也由 shims 路由**（它再用 `nativeRequire('electron')
> .ipcRenderer.send` 转发真通道）。故第一步只搬**路由表**，传输仍由 shims 经
> `setIpcTransport(mockTransport)` 注入；等第 4 步（整体退役）时再把传输获取改为
> preload 直通（届时需给 preload 增加通用 `ipc.send`/`on` 桥）。

---

## 3. 逐信道分类（脚本按分支体是否引用 mock 符号自动切分）

### 3.1 A 类：传输无关 → 迁入 `core/channelBridge.ts`（16 段 / 19 信道）

`cancel-empty-trash`、`change-theme`、`change-zoom`、`check-for-update`、`chnage-preferences`、
`chnage-scrollBehavior`、`chnage-shortcut`、`copy-thumbnails`、`duplicate-file`、`empty-trash`、
`lock-now`、`open.preferences`、`regenerate-palette`、`update-main-window-id`、`update-preferences`、
`update-txt-item`、`upload-local-files`、`upload-url`、`upload-urls`

（判据：分支体内**不引用**任何 mock 符号——只做 `nativeRequire('electron').ipcRenderer.send`
直通，或 `desktopApi.*` 调用。）

### 3.2 B 类：与浏览器 mock 状态耦合 → 留在 dev-shims（13 段 / 24 信道）

`cancel.all`、`copy-images`、`create-library`、`export-as-folder`、`export-images`、`folders-change`、
`generate-hight-resolution-thumbnail`、`image-change`、`images-change`、`import-folders`、`ondragstart`、
`open-preview-window`、`open-with-default`、`paste-image`、`paste-paths`、`read-win-files`、
`regenerate-thumbnail`、`regenerate-video-thumbnail`、`set-custom-thumbnail`、`show-item-in-folder`、
`upload-local-files`、`upload-url`、`upload-urls`

> 注：`empty-trash`、`upload-local-files`、`upload-url(s)`、`open-with-default` 等**同时出现**在两侧——
> 因其有「原生直通」与「mock 分支」两条路径。迁移时按**分支**而非按信道切分：原生直通段迁走，
> mock 分支留在 dev-shims 并用 `setIpcTransport` 提供的 mock transport 兜底。
> `desktopSendChannels = {create-library, open-library, add-to-history-and-open}` 的**转发半段**
> 属 A 类（`desktopApi.library.create/switch`），**mock 半段**（写 `__mockLibrary`/`__mockLibraryCache`）属 B 类。

---

## 4. 第一步任务清单（`core/channelBridge.ts`，语义零变化）

1. 新增 `core/channelBridge.ts`：`IpcTransport` 接缝 + `installChannelBridge()`；把 §3.1 的 16 段
   原样搬入（注释、`console.warn` 文案保留，便于对照）。
2. `core/eagleGlobals.ts` 的 `ipcRenderer()` 改为返回 channelBridge 的 facade（`send`/`sendTo`/`on`/`once`/`off`）；
   `window.$$electronIpc` 同步。
3. `main.tsx` 启动期调用 `installChannelBridge({ desktopApi: window.eagleDesktop })`
   （须早于任何域接管与首帧渲染）。
4. `shims.js`：删除已迁走的 A 类分支；安装 mock transport 并 `setIpcTransport(...)`；
   保留 B 类与 mock 库/fetch/capture/viewer mock。
5. **门禁**（迁完立刻跑，全部须绿）：
   `channel-wiring`（duplicate-file/copy-thumbnails/thumbnail-generated 回程）、
   `library-switch-ui`（create-library/open-library）、`empty-trash`（empty-trash + remove-trash-item）、
   `txt-update`（update-txt-item）、`menu-popup`（smoke:* 直通）、`native-preview`
   （generate-hight-resolution-thumbnail）、`drag-start`（ondragstart）、`preview-delivery`
   （open-with-default/open-preview-window + preview:action-result）、`source-mode-ui`、
   `main-ui-workflow`（images-change→item.updateMany 全链）。
   另跑 `tests/full-regression-isolated.mjs` 之外的 65 套件一次。

### 后续步骤（沿用 `docs/rewrite-closing-2026-09-13.md` §6.1）
2. 详情原图交付门控（`enterDetailMode`/`leaveDetailMode` 包装 + `DetailWorker` + `waitForDetailOriginal`）
   落到 React detail 生命周期；`preview-delivery` + `d3-detail-mode` 定向。
3. 浏览器 mock（`__mockLibrary`/fetch 改写/desktopApi 内存实现/capture 轮询/viewer 逐页 mock）
   迁入仅 dev/测试模块；生产 build 不含 mock；`mock-data.js` 保留为 fixture。
4. 3 个直读 shims 源码字符串的测试（`empty-trash`/`txt-update`/`native-preview`）改**行为断言**；
   vite 配置摘除 shims 注入；删 `shims.js`。

---

## 5. 风险与不变量

- **不变量 1**：任一时刻「渲染层 `ipcRenderer.send` 的最终落点」必须唯一 —— 迁移期不得出现
  channelBridge 与 shims 双路由（会双发：`images-change` 双发正是 m1 历史 bug 的形态）。
  落地顺序固定为「先建 channelBridge → 再删 shims 对应分支 → 每次只删已确认接管的段」。
- **不变量 2**：`smoke:*` / `update-txt-item` / `empty-trash` / `duplicate-file` 等**原生直通**语义不变
  （menu-popup / channel-wiring / empty-trash / txt-update 四条闭环是这组信道的契约）。
- **不变量 3**：浏览器预览（无 Electron）必须仍能跑通 65 套件 —— mock transport 由 shims 注入，
  故 shims 在迁移期不能先整体删除。
- **风险**：`desktopApi` 在 A/B 两类中都被用到（126 处），切分时以「是否引用 mock 符号」为唯一判据，
  避免按信道整体搬迁造成 mock 分支丢失。
- **已知既有脆弱点**：`main-ui-workflow` 在 `images-change → item.updateMany`（后端 HTTP）路径上
  有负载 flake；迁移后若该测试失败，先单跑复判定，勿直接认定回归。

---

## 6. 为何停在设计（而非顺带落地）

第一步要动的正是 `main-ui-workflow` / `channel-wiring` / `empty-trash` / `txt-update` /
`preview-delivery` 的地基 —— 658 行路由里 13 段与 mock 状态交织，必须逐段迁移 + 每段跑门禁。
在收官会话尾部一次性落地会同时违反「不变量 1」（双路由风险）并让失败难以归因。
故本次只完成**接缝定义 + 逐信道分类 + 门禁清单**，交由独立批次按 §4 施工。
