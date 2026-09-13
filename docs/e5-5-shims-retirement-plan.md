# E5-5 / D-2 施工设计：`frontend/public/shims.js` 退役

> 立项文档（2026-09-13）。收官状态见 `docs/rewrite-closing-2026-09-13.md` §6.1。
> 本文把该四步分解落到**代码级可执行**：接缝 API、逐信道分类、第一步任务清单与门禁、风险与不变量。
> **状态：第一步未落地**（见文末「为何停在设计」）。

---

## 0. 施工现状与分类更正（2026-09-14）

**本会话已落地（收尾批 E6-1，提交 `bb538f9e`）**：P0 基线（哨兵 / tsc 492 / 附着实测 runner
`tests/run-attached-nonsuite.mjs` 入树）；P6 scope 残留清扫（`scopeEvalAsync 355 → 0`、删
`core/scopeRuntime.ts`、退役 `window.__eagleDataMachinery`）。门禁 10 项套件全绿。

**§3 分类更正（重要，勿按原 §3.1 施工）**：§3.1 的「A 类 = 分支体不引用 mock 符号」是按 §1 那
**7 个符号**（`desktopApi` / `mockEmit` / `nativeRequire` / `__mockLibraryCache` /
`previewCurrentItemId` / `emitImportedItems` / `trackLocalImport`）自动切分的，**漏掉了 shims 本地
helper**（`savePreferences` / `applyPreferencesToCurrentDocument` / `broadcastIpc` /
`analyzeItemPalette` / `scheduleMissingPaletteAnalysis` / `browserImport*` / `bodyScope` /
`isCurrentPreviewRawPath` / `dragStartItemIds` / `runPreviewAction` / `mergeCachedItems`）。逐分支
复核 `ipcRenderer.send`（`shims.js:1376-1792`）后，真正**纯原生直通**的只有 8 段：

| 分支 | 行 | 备注 |
|---|---|---|
| `smoke:*` | 1379-1386 | 纯 native send |
| `update-txt-item` | 1389-1396 | 纯 native send |
| `empty-trash` / `cancel-empty-trash` | 1401-1408 | 纯 native send |
| `generate-hight-resolution-thumbnail` | 1413-1420 | 纯 native send |
| `open-with-default`（string 参数且非预览窗） | 1425-1432 | 纯 native send（同频道另有预览窗分支 → 频道级 MIXED） |
| `duplicate-file` / `copy-thumbnails` | 1436-1443 | 纯 native send |
| `open.preferences`（native 半段） | 1489-1497 | native send，失败回落 `window.open` |
| `update-main-window-id` / `check-for-update` | 1790 | 空操作直通 |

其余原列 A 类频道**均引用 shims 本地 helper**，不能只搬路由：`regenerate-palette`→`analyzeItemPalette`；
`chnage-preferences` / `change-theme` / `change-zoom` / `chnage-shortcut` / `chnage-scrollBehavior`
→`savePreferences`+`applyPreferencesToCurrentDocument`；`lock-now`→`broadcastIpc`；
`update-preferences`→`applyPreferencesToCurrentDocument`；`create-library` / `open-library` /
`add-to-history-and-open` / `folders-change`→写 `__mockLibrary(Cache)`；`upload-*`→`browserImport*`
（browser）/ `trackLocalImport`+`emitImportedItems`（desktop）；`empty-trash`（desktop 半段）→`desktopApi.duplicates`。

**消费面实测（决定 P1 规模）**：React 侧**约 40 个文件**经 `window.__eagleIpc` / `$$electronIpc` /
`window.ipcRenderer`（三者均为 shims 建的本地 EventEmitter 总线）发消息，另有 13 处以
`eagleGlobals.ipcRenderer()` 取用；`eagleGlobals.ipcRenderer()` 因 preload 无 `ipc` 键而**必然回落到
shims 总线**。且 Electron 恒经 `main.cjs:8` 加载 vite 预览服（`http://localhost:5176`），故 **shims 在
Electron 生产路径同样是承重件**，不是可选 mock。因此 P1 的前提不是「搬 16 段路由」，而是
**先给 `preload.cjs` 加通用 `ipc` 桥 + 把总线/回程（`desktopApi.onIpc` 扇出）整体迁到 React**，
再把 shims 降级为仅浏览器 mock 传输。

**仍未落地**：P1（通道桥）、P2（详情原图交付门控）、P3（source-mode UI）、P4（浏览器 mock 隔离）、
P5（删 shims.js）。详见 `docs/rewrite-closing-2026-09-13.md` §6.1 的「后续三步」。

### 0.1 P2 实测更正：门控在 React UI 路径下**当前不生效**（2026-09-14 探针实证）

原 §「后续步骤 2」把 P2 当作「把门控搬到 React detail 生命周期」的中性搬迁。实测否定了这个前提：

- 门控包装的是 `bodyScope()`＝`window.__eagleDriver` 的 `enterDetailMode`。该名在
  `driverApi.ACTION_FIELDS` 白名单内，且 `enterDetailMode` 已被 `miscRawState` 注册为 store 字段，
  故包装写入的是 **store 侧那个箭头挂载**（`machineryInfra.ts:139` 的 `s.enterDetailMode = ($e,img) => machineryEnterDetailMode(...)`）。
- 但 **React UI 的所有入口都直接调用 import 的 `machineryEnterDetailMode`**，不经 scope 面：
  `selectionService.ts:200`（网格双击）、`inspectorActions.ts:521/585/604`、`miscDomain.ts:537/1594`、
  `detailService.ts:233`。`window.__eagleMachinery.enterDetailMode`（= 该导入函数）与驱动面那个
  **不是同一函数对象**。
- 探针 `tests/probe-detail-gate-reachability.mjs`（隔离栈 + CDP，实跑）：
  `{sameObject:false, machineryHasGateFlag:false, driverHasGateFlag:true}`
  Path A（machinery 导出＝UI 用面）→ `{itemId:'', mode:'', lockedAt:0}`（门控未跑）；
  Path B（driver API＝main.cjs 驱动脚本用面）→ `{itemId:'ITEM-…', mode:'waiting', lockedAt:5572.9}`（门控生效）。
- 连带结论：`openDocumentViewer` 只被门控包装体调用，故**应用内 document workspace 在 React UI 下同样不可达**；
  React 侧全仓无 `document-viewer` 引用（图片/文档走各自 viewer）。

**故 P2 不是搬迁，而是「行为接线决策」**，需在二者间选一：

1. **恢复门控（计划原意）**：把交付门控（`shims.js:56-232` 的 `detailRenderState`/`DetailWorker`/canvas 签名/
   `waitForDetailOriginal`）移入 React，并在 `machineryEnterDetailMode`/`machineryLeaveDetailMode`
   内部调用（而非包 scope 面），再删 shims 包装体。**注意这是可见行为变化**（详情页先隐原图到画布稳定；
   主窗/预览窗的 `enterDetailMode` 语义都会变），需实机走查确认。
2. **判死删除**：承认该门控与 document viewer 属已失效遗留，直接从 shims 删除（但 main.cjs
   `:2146/2302/2767` 的驱动脚本仍走 driver 面，删除前需确认其不依赖门控行为）。

> document viewer 分支此前有意与「原版详情流」并存；React 已有自己的 pdf/office viewer 路由，
> 恢复前需先确认不会与 React 侧路由重复。建议此项先做一轮**实机走查**再定。

### 0.2 P2 已落地（2026-09-14，选项 ①）

经确认采用**恢复接线**。实际落地（提交见收官文档 §6.1）：

- **新增 `src/app/react/core/detailDeliveryGate.ts`**：`detailRenderState` / `detailPreparedTiles` /
  `detailCanvasSignature` / `releaseDetailImage` / `waitForDetailOriginal` / `DetailWorker` 包装 +
  门控样式，全部自 shims 逐字迁入；对外只三个口：`installDetailDeliveryGate()`（启动期装样式与
  Worker 探针）、`onDetailEnter(target)`（位图类条目加 `eagle-detail-awaiting-original` + 15s 超时）、
  `onDetailLeave()`（解除）。读面用 `getDriverApi()`（与 shims `bodyScope()` 原解析一致）。
- **挂钩点**：`miscDomain.machineryEnterDetailMode` 在**选区守卫之前**调 `onDetailEnter(image || 选区末项)`
  （与 shims 原包装体同序：显式传 item 时即便无选区也先置门控）；`machineryLeaveDetailMode` 首行
  `onDetailLeave()`。**不再轮询、不再包 scope 面**。
- **`main.tsx`** 启动期 `installDetailDeliveryGate()`；**shims.js 删 177 行**（原门控 + 25ms 包装体）。
- **document 分支保持原样（未接 React）**：`shims.js` 保留 `document viewer` 全段，并补了一个
  **仅驱动面**的 `documentViewerHookTimer`（25ms，`__eagleDocumentEntry` 守卫）——驱动面调
  `scope.enterDetailMode` 时对文档扩展名开工作区；UI 面点击文档仍走各自 viewer 路由（与迁移前
  逐字一致，未新增接线）。**若整体删掉该分支，`--smoke-document-viewer` 会因找不到
  `#eagle-document-viewer-container` 而超时**——这是它与本批绑定的唯一原因。
- **验证**：`tests/probe-detail-gate-reachability.mjs` 现 pathA（UI 用面）与 pathB（驱动面）
  都写入门控状态；`preview-delivery` / `d3-detail-mode` / `main-ui-workflow` / `ui-interactions` /
  `document-viewer-ui` 全绿；哨兵 `SENTINEL_OK`、tsc 492 零新增键。
- **遗留**：门控重新生效属**可见行为变化**（详情页先隐原图至画布稳定 3 帧 / 原图 URL 一致），
  需实机走查确认观感符合原版。

### 0.3 P3 实测更正：source-mode UI 是**功能补建**，不是搬迁

> **P3-b 已落地（2026-09-14）**：功能补建 + 迁移完成（React/store 实现 + `tests/source-mode-browse-closed-loop.mjs`
> 收口验收 3/3 绿；shims source-mode 块约 500 行删除）。**不再按本节「本批已做安全切片」理解**——
> 已从切片推进到全量实现，详见 `docs/rewrite-closing-2026-09-13.md` §6.1 P3 行。

`shims.js` 的 source-mode 块（现约 `3311-3856`，594 行）在 React 下**部分可用**：
`installModeSwitch`（靠 `Sidebar.tsx:699` 有意保留的 `ng-click` 钩子识别切换按钮）可开/关，
`#source-mode-add-folder` → `handleSourceAdd` 可加来源。

但实测：`renderSourceModeSidebar` 渲染的交互属性
—— 目录行 `data-source-folder` / `data-source-relative-path`、`data-source-action="toggle-root"`、
`data-source-rescan`、`data-source-remove` —— **全仓无任何监听器**（shims 内没有，React 侧
`grep data-source` 零命中）；而唯一意图实现这些交互的 `handleSourceSelectFolder` /
`handleRescanRoot` / `handleRemoveRoot`（+ 它们调用的 `openSourceFolderInAngular`，其内部还依赖
已死的 `window.angular`）**零调用点**。

结论：source-mode 的「浏览来源素材 / 重扫 / 移除」从未接线。因此 P3 落地前需先定这几个交互的
语义（点目录行应如何把来源素材投到网格？重扫/移除后 UI 如何刷新？与 `desktopApi.sourceMode` 的
`rescan/remove/pickAndAdd` 契约如何对应？）——属**功能设计**，非机械搬迁。

本批已做安全切片：删除上述 4 个不可达函数（-83 行，`node --check` 通过、`source-mode-ui-closed-loop`
复跑绿）。块本体迁移与交互补建留待独立批次。

### 0.4 E7 / E6-9 进度更正（2026-09-14，本会话）

> 本节为**当前实测**，覆盖 §0 开头「仍未落地」列表的相应项。

**① E7（批次 0，提交 `5a3a98be` + `dad7b24e` + `e0019925`）**：把 `main-ui-workflow` 的
「基线亦失败、根因待定位」转为**已定位并修复**。定位手段：渲染层 `send`/`sendTo` 载荷探针（每轮失败
时最后一次 `updateMany` 载荷陈旧即停）+ live 对象 `annotation` 属性 setter 抓栈。四个根因：
- 回归 A（`919d7ef5`）：shims 剪贴板分支 `writeState().writeState()` TypeError；
- 根因 C（既有）：`mergeCachedItems` 的 `Object.assign` 写到 live 对象本体（React 下 cache 条目与
  live store 同引用），导入期调度的调色板分析携带导入初值合并把在飞编辑打回 →
  cache 一律存副本 + 调色板分析限定字段域 + 接缝回执改「相对入队快照的差分」（itemDomain 以
  live+差分合并视图渲染）；
- 根因 D（既有）：capture 轮询跨 tick 落定的导入双发 `file-uploaded` + 消费者无幂等 → 重复 id；
- 回归 B：driver restore 直发 shims 总线（P1-c-2 删分支后落黑洞）→ 改走接缝。
验证：连续 6 轮 **4 绿**（改前 0 绿）。**剩余**：`no-target-id` identity 变体（m1 族，6 轮 1 次）留档。

**② E6-9（批次 1，提交 `2d61c1a8`，P1-c-3）**：设置族（`core/settings.ts` 新增）、
`regenerate-palette`、库族、缩略图族、剪贴板导入族、导入族共 **21 个频道**迁入 `routeDesktop`，
语义逐字对齐 shims（含 `.catch`/合成事件/失败分支）。`tests/react-ipc-bridge-routing` 扩展为
断言这 21 频道「走接缝、不泄漏回 shims 总线」并校验合成事件；`react-stage8e-smoke` 绿。

**③ 仍未落地（本会话预算不足以安全完成，按工程风险延后）**：
- **P1-c-4（回程扇出 + 总线实体 React 化）**：`desktopApi.onIpc` 的 5 频道 + 9 频道循环 +
  export/import/library/item 回程 + `onRebindRefresh` + `preview.onInit` 缓冲（`shims.js:1622-1735`）
  未迁。**迁移即删**（否则与 shims 双发），而 React 安装晚于 shims 加载会丢冷启动主进程事件，
  需配套缓冲兜底与全量回程测试——属结构性交接，非机械搬迁。
  **施工切线（已定，可直接执行）**：
  1. 新增 `core/returnBridge.ts` → `installReturnBridge()`：端口逐字搬 `shims.js:1622-1735`
     （`show-item-in-folder` 带 `__lastExportJobId` 的特殊分支、`close-export-task` 的 angular
     面板复位（React 下 angular 恒缺席→保留 mockEmit 即可）、9 频道循环、`file-uploaded` 先并
     cache 再过总线、`thumbnail-generated`/`rebind-refresh`、export/import/library/item 的
     `onX`、`onRebindRefresh`（bodyScope→`getWindowScope()`+`__eagleMachinery.rebindRefresh`）、
     `preview.onInit` 缓冲轮询）。事件一律 `getIpcBus().emit`（= shims 总线，React 监听同实体）。
  2. `main.tsx` 在 `installDriverApi()` 之前调用 `installReturnBridge()`，并置
     `window.__eagleReturnBridgeInstalled = true`。
  3. shims 侧把 `if (desktopApi && typeof desktopApi.onIpc === 'function') { … }` 的注册体改为
     `setTimeout(() => { if (window.__eagleReturnBridgeInstalled) return; …原注册体… }, 0)`。
     时序论证：shims 同步解析期 schedule 的 0ms timer 属宏任务，DCL 前的 deferred module
     （React 入口）先执行 → React 先注册、shims timer 到点后跳过；preload 队列的主进程事件在
     DCL 完成后才可派发（早于 shims timer 派发且晚于 React 安装的概率窗口由 preview.onInit
     式缓冲兜底——若实测存在，可把 shims timer 提到 25ms 并在 timer 内补派发挂起事件）。
  4. 验证：`tests/react-ipc-bridge-routing`（假 desktopApi 走 onIpc 面）、main-ui-workflow、
     thumbnail/custom-thumbnail/library-switch 族；哨兵 + tsc。
- **P4（browser arms 隔离）/ P5（删 `shims.js` + `mock-data.js`、`runtimeGlobals` 启动契约、
  3 个源码字符串测试改写）**：依赖 P1-c-4。
- shims 对应分支**暂留**：浏览器态（无 `desktopApi`）与 preferences 窗内 `req('electron')` 直发仍
  依赖之；删除随 P4/P5 落地。





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
