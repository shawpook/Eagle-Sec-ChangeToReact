# Eagle 前端迁移最终验收记录（R7）

日期：2026-09-14/15 ｜ 工作区：`H:/dev/Eagle-Sec-development - 副本` ｜ 分支：`react-in-place`
验收入口：`npm run test:acceptance`（`node tests/frontend-acceptance.mjs`）
对照报告：`docs/2026-09-14_frontend-migration-remaining-report.md` §6 验收矩阵
批次计划：`docs/frontend-batch-plan-R0-R7-2026-09-14.md`

本文件是 R7 的交付物：把 R0–R6 的全部改动放回报告 §6 的验收矩阵逐项核对，**明确标注未通过项与未覆盖项**，
并把宿主环境问题单列。结论不引用套件数量、源码后缀或单次构建成功作为替代证据。

---

## 1. 统一前端验收入口

单一命令、四段（默认）+ 一段（选做），逐段留证：

| 段 | 覆盖 | 默认 | 依赖 |
|---|---|---|---|
| `static` | 类型门禁（0 诊断 + 范围守卫 + `@ts-nocheck` 台账）、架构哨兵、shim 模块边界、scope 字段收敛台账 | 是 | — |
| `build` | 正式多页构建 `vite build` | 是 | — |
| `artifact` | 产物入口/资源检查 + Electron 正式启动冒烟（不依赖 Vite dev） | 是 | `build` |
| `regression` | React 全量套件 71 项 + 套件外关键闭环 6 项 | 是 | — |
| `backend` | 隔离端口全量回归 `full-regression-isolated`（后端业务链） | **否**（宿主相关，见 §7） | — |

```powershell
npm run test:acceptance            # 四段（前端验收结论以此为准）
npm run test:static                # 只跑静态门禁（秒~分钟级，日常批次用）
npm run test:artifact              # build + 产物检查/冒烟
node tests/frontend-acceptance.mjs --stages=all     # 含 backend 段
node tests/frontend-acceptance.mjs --list           # 覆盖面 + 分类 + 分段说明（不执行）
```

证据落盘：`.tmp/r7/acceptance-latest.json`（分段/步骤/退出码/耗时；`.tmp/` 为本地临时证据，不入库）。

**覆盖面守卫（防「删测试得绿色」）**：执行前先校验——登记项文件必须存在；`REQUIRED_TESTS`（24 项）必须被
本入口的某个步骤真正执行（套件 / 产物段 / 套件外闭环 / `npm test` 现读清单，四者取并集）。
守卫失败时不执行任何分段，直接 `ACCEPTANCE_COVERAGE_FAIL`。R7 首次运行该守卫即发现 2 个**孤立测试**
（见 §6.1）。

**失败口径**：某步失败记 FAIL；因前置失败而无法执行的面记 BLOCKED（不是通过）；未请求的默认段在汇总里
明示 `FRONTEND_ACCEPTANCE_PARTIAL_OK（不得据此判定整体验收通过）`。部分段运行时**不会**打印
`FRONTEND_ACCEPTANCE_ALL_GREEN`。

---

## 2. 验证面分类（开发态探针与产物行为测试分开维护）

分类是**单一事实来源** `tests/react-suite-manifest.mjs`：套件清单、分类、产物测试、套件外闭环、
验收必需项都只在那里写一遍，`tests/run-react-suite.mjs`（执行）与 `tests/frontend-acceptance.mjs`
（验收 + 覆盖面守卫）共同 import，任一方单独改动另一方即报错。

| 类 | 数量 | 内容 | 判据来源 |
|---|---|---|---|
| 静态门禁（`static`） | 7 | `typecheck` / `react-rewrite-sentinel` / `shim-module-boundaries` / `scope-field-convergence` / `react-utils-native` / `react-ipc-bridge-routing` / `continuous-grid-layout` | 读源码、内存转译或 `tsc`，**不驱动浏览器** |
| 开发态行为探针（`dev-probe`） | 64 | 套件内其余项：起 Vite dev（URL 为 `/src/app/...` 源码路径），经 CDP/Electron 驱动真实行为 | 套件执行 |
| 产物行为测试（`artifact`） | 2 | `dist-entry-check`（产物入口/资源）、`production-smoke`（Electron 加载 `dist/frontend`，关闭 Vite dev） | 只针对 `dist/frontend` |
| 套件外关键闭环 | 6 | `item-persistence`、`electron-write-path`、`document-viewer-ui`、`video-detail-mode`、`browser-capture-ui`、`export-progress` | 验收入口 `regression` 段逐个执行 |
| 附着式（Chrome 无头，非套件） | 2 | `screenshot-regression`（17 页，1 页按理由 SKIP）、`workbench-interactions` | `npm run test:attached`（自建隔离栈） |
| 后端业务链 | 45 | `npm test`：API/资源库/导入导出/一致性/恢复/迁移 | `backend` 段（宿主相关） |

**源码文本探针单独登记**（`SOURCE_TEXT_PROBE_SEGMENTS`，当前 1 处）：
`tests/browser-capture-ui-closed-loop.mjs` 里对 `Inspector.tsx` 的「单色面板」守卫是 fetch 转译后 TSX
比对字面量——它守护的是一个**没有稳定行为夹具**的既有修复（需要「恰好一个调色板」的素材，现有夹具
无法稳定产出）。该测试其余部分仍是真实 Electron 冒烟。**不得把这一条当行为验证**，故显式登记而非默认归类。

---

## 3. 报告 §6 验收矩阵逐项结论

| # | 验收面 | 最终要求 | 覆盖命令 | 结论 | 证据 |
|---|---|---|---|---|---|
| 1 | 构建与启动 | 所有交付入口有产物；关闭 Vite dev 后可启动；无源码 URL/开发刷新依赖 | `npm run build` + `artifact` 段 | 见 §4 | 产物入口清单 11 页 + 引擎页；`dist-entry-check` FAIL 0 / WARN 2（两条均为 `pages.html` 指向**有意排除**的演示路由）；`production-smoke` 在无 Vite 环境下启动主窗并断言入口指向 `/assets/*.js` |
| 2 | 类型 | 全部自有前端覆盖，strict 0 诊断，无业务文件 nocheck | `static` 段 `typecheck` | **通过** | `TYPECHECK_OK: 0 诊断`；范围守卫断言 `include` 覆盖 `src/app/react/**`；`@ts-nocheck` 台账仅剩 8 个 `core/shim/*`（R2 整段搬移的启动层，由 `shim-module-boundaries` 精确守卫），业务文件 0 豁免 |
| 3 | 框架与依赖 | 无 Angular 启动；已迁域无 scope/digest 兼容业务；旧 UI 胶水无生产消费者 | `static` 段 `react-rewrite-sentinel` + `scope-field-convergence` | **通过** | `SENTINEL_OK`；scope 面（`$apply/$watch/$broadcast/$on`…）**已无目录级豁免**（R5 撤除 scopedOut），仅剩 2 条行级白名单（Angular 生命周期 `$destroy`、动态事件名 `$on`）；199 字段/10 域具名写点，未分类字符串键写入 0 |
| 4 | 连续列表 | 全列表单一高度；滚轮/滑块方向一致；停住不回跳；图片加载不改变坐标 | 套件 `continuous-grid-layout` + `continuous-grid-scroll` | **通过**（1 项低频 flake 已归因并加固） | 见 §4；四布局 10,000 条总高度/坐标/可见窗口/锚点还原；600 条实图库 + AutoScroll 频道到离屏选中项。`continuous-grid-scroll` 在本次运行中首跑失败、重跑通过 → 归因为固定等待窗口过窄（§5.4），已改为有上限轮询且判据不变，修复后隔离复跑 4/4 |
| 5 | 大列表与布局 | 四种布局、缩放/变宽、名称/信息显隐、首末项、稀疏/空目录均正确；后续增加 10,000 条**实际库**压力验证并记录耗时/内存 | 套件 grid 两项 + d3 系列 | **部分（有明确未覆盖项）** | 四布局/缩放/变宽的几何断言通过；**10,000 条真实素材库的耗时/内存压力验证未做**——报告 §7 明示「本次没有对这些场景声称通过」，R7 亦未虚构该数据，列为未覆盖项（§8） |
| 6 | 选择与列表更新 | 离屏定位、范围选择、筛选/排序、批量移除、目录恢复不重建分页 | 套件 `d3-selection` / `d3-focus` / `d3-alltags-view` + stage 系列 | 见 §4 | 离屏定位与键盘导航、范围选择、全标签视图、连续列表下不按页替换列表 |
| 7 | 编辑与持久化 | 在飞编辑不被旧回执覆盖；重启读回一致；错误可见且不重复写入 | `main-ui-workflow`、`electron-write-path`、`item-persistence`、`txt-update` | **通过（含 1 项已归因低频 flake）** | `electron-write-path`：单路由/入队快照/写入顺序/延迟响应/失败隔离/多选 8 项断言 OK；`item-persistence`：6 步编辑经真实后端落盘 + 重启读回 OK；`txt-update` OK；`main-ui-workflow` 的 `inspector no-event` 为**既有低频**，复现矩阵与机制见 §5.2 |
| 8 | 导入导出与库切换 | 进度/取消/失败路径正确；无重复导入或串库 | `export-progress`、`library-switch-ui`、`source-mode-ui`、`image/folder-import` | **部分（后端链宿主阻断，见 §7）** | 前端侧：`export-progress`（进度/取消闭环）、`library-switch-ui`、`source-mode-ui` 见 §4；后端侧 `image/folder-import` 属 `npm test`，其执行结果受 §7 宿主缺陷影响，单列 |
| 9 | 独立窗口与媒体 | 本窗状态、焦点、主题、播放/切图、关闭释放和跨窗同步正确 | 套件 `preview-delivery` / `native-preview` + `document-viewer-ui` / `video-detail-mode` / stage8-9 | 见 §4 | 预览投递、native 预览、文档查看器、视频详情、采集窗与偏好窗口（stage9b1/stage8e2）、查看器父窗具名通道（R5） |
| 10 | UI 生命周期 | 弹窗、菜单、拖动、编辑器反复挂载后仍只有预期监听；React 与引擎不争写同一节点 | 套件 `menu-popup` / `ui-interactions` / `drag-start` / `residue` / `sidebar-dnd` | 见 §4 | 含 R5 收敛的 `preview-window` watcher 面（`menu-popup`、`ui-interactions`）；`sidebar-dnd` 的偶发首败见 §5.1 |
| 11 | 文档与交接 | README、入口表、保留依赖和测试记录与当前代码一致 | README + 入口台账 + 本文件 | **通过** | README「当前状态/启动/校验命令/目录/文档索引」按 R6 重写并补 R7 验收入口；`docs/frontend-entry-ledger-2026-09-14.md` 含交付入口登记、R6 保留清单（逐路径消费者）与 R7 验收命令 |

---

## 4. 本次验收运行结果（默认四段）

命令：`npm run test:acceptance` ｜ 结果：**`FRONTEND_ACCEPTANCE_ALL_GREEN`**（exit 0）
日志：`.tmp/r7/acceptance-final.log`、证据 JSON `.tmp/r7/acceptance-latest.json`
（`.tmp/` 为本地临时证据，不入库；命令可复现）

| 段 | 步骤 | 结果 | 耗时 |
|---|---|---|---|
| `static` | `typecheck` | PASS（`TYPECHECK_OK: 0 诊断`） | 15.5s |
| | `react-rewrite-sentinel` | PASS（`SENTINEL_OK`） | 0.4s |
| | `shim-module-boundaries` | PASS（8 模块无缺失 import） | 1.2s |
| | `scope-field-convergence` | PASS（199 字段/10 域，无未分类字符串键） | 0.2s |
| `build` | `vite build` → `dist/frontend` | PASS（vite 自报 `built in 21.74s`） | 33.3s |
| `artifact` | `dist-entry-check` | PASS（11 入口页产物 + 引擎页 + 开发数据已排除；**FAIL 0 / WARN 2**） | 0.2s |
| | `production-smoke`（无 Vite dev） | PASS（`hasMainApp/hasRegistry/hasBoxContainer/hasDriver` 均真，入口 `/assets/index-*.js`） | 7.7s |
| `regression` | `run-react-suite`（71 项） | PASS（**OK 69 + retry-OK 2**：`main-ui-workflow`、`react-s2-sidebar-dnd`，两者均为 §5 记录的既有低频项） | 2518.6s |
| | `item-persistence-closed-loop` | PASS（`edit=6steps`，重启读回一致） | 37.2s |
| | `electron-write-path-closed-loop` | PASS（`ops=8 reqs=8`，单路由 + 入队快照 + 失败隔离） | 29.7s |
| | `document-viewer-ui-closed-loop` | PASS | 28.7s |
| | `video-detail-mode-closed-loop` | PASS | 29.6s |
| | `browser-capture-ui-closed-loop` | PASS（含 `BROWSER_CAPTURE_UI_RESTART_OK`） | 28.4s |
| | `export-progress-closed-loop` | PASS（进度/取消/并发拒绝/源库不变） | 34.9s |

> 同日另有一次运行（在 `continuous-grid-scroll` 的等待窗口加固**之前**）：同样 `ALL GREEN`，
> 套件 `71 项：OK 70 + retry-OK 1`（retry 项为 `continuous-grid-scroll`，即 §5.4 的首次观测）。
> 两次运行的差异正是该处加固的效果：加固后该测试首跑即过，而 §5.1/§5.2 两个既有低频项照旧偶发。
>
> `dist-entry-check` 的 2 条 WARN 均为 `pages.html` 指向 `registration` / `manage-device` 两个
> **有意排除**（由开发中间件直出）的演示路由，非交付缺口。

---

## 5. 历史低频失败核验

### 5.1 `tests/react-s2-sidebar-dnd-closed-loop.mjs`（侧栏文件夹原生 DnD）

| 观测 | 结果 |
|---|---|
| R6 全量套件（71 项）内 | 首跑 `FAIL (exit=1)` → 套件内建重跑一次 → `OK (retry)`；套件仍判 ALL GREEN |
| R7 隔离复跑（同一机、逐次清场、串行 6 次） | **6/6 PASS**，耗时 11.3–14.6s（`REPRO ... 6 runs, 0 fail`） |
| **R7 最终验收运行**（加固后的套件） | 首跑 `FAIL (exit=1)` → `OK (retry)`；**首败断言名已留证**：`SIDEBAR_DND_CLOSED_LOOP_FAIL dragend cleanup timeout` |

**判定**：**长套件下的环境级偶发**，且失败点已定位到 `dragend` 清理段（`helper` 移除 + `dragCheck`
50ms 复位，测试以 5s 轮询上限等待）——即「拖拽结束后清理未在窗口内完成」，**不是**拖拽语义
（`folderMappings[].parent` 等 scope 信号断言）失败。单独运行与套件内运行的差别是进程序列 / 负载 /
临时目录与端口复用历史。

**处置**（不改断言）：① 套件保留「失败重跑一次」；② **R7 新增：首败即打印断言尾部**——
R6 那次首败的具体断言名没有留下、事后无法归因，正是本次补上的可诊断性缺口（本轮立刻见效：
立刻拿到上面那条 `dragend cleanup timeout`）。（本项未再做等待窗口加固：该断言本就是有上限的轮询，
且它在隔离串行 6/6 通过，说明并非「窗口过窄」型，故先保留证据观察。）

### 5.2 `tests/main-ui-workflow-closed-loop.mjs`（inspector `no-event`）

R7 复跑矩阵（同一机、逐次清场、串行 4 次）：

| 轮次 | 结果 | 耗时 |
|---|---|---|
| 1 | PASS | 31.0s |
| 2 | PASS | 31.1s |
| 3 | **FAIL** | 57.4s |
| 4 | **FAIL** | 60.8s |

失败签名逐字相同：`MAIN_WORKFLOW_SMOKE_ERROR Error: inspector operation result timeout for ITEM-… last={"reason":"no-event"}`。

**机制**（锚点 `electron/main.cjs:2102-2132`）：烟测在渲染层注册 `item:operation-result` 监听，触发
`inspectorActions.imagesChange()` 后等结果，最多 5 轮 × 8s；`last={"reason":"no-event"}` 表示**整段窗口期内
一个结果事件都没到**。该处源码注释已自述成因：`imagesChange` 若读到空名会**早退不发**（`main.cjs:1907`），
即触发条件 = 「驱动侧刚写入字段」与「渲染侧读取」之间的时序竞争，在负载下失败率上升（失败耗时约 2 倍，
走的正是超时路径）。

**判定**：**既有低频 flake，与本轮迁移无关**。依据有三：① R5 的对照实验（同机、逐次杀干净 electron）显示
**R5 之前的状态**（`git show 2683656b:` 取回 index.html/bundleGlobals/shortcut-manager.js）同样复现
`OK, FAIL, FAIL`，签名逐字相同，且与 classic shortcut-manager 标签无关；② R7 在当前树复现同一签名；
③ **R7 最终验收运行中它再一次首跑失败、重跑通过**（`OK 69 + retry-OK 2` 之一）。
**处置**：保留套件内建重跑 + 首败留证（§5.1 同一处改动），**未修改任何断言**。

### 5.3 附着式截图回归的 5 项红（R5 记为「既有失败集」，R7 逐项归因并处置）

`npm run test:attached`（自建隔离栈：自有端口的 backend + Vite + 本机 Chrome 无头）在 R5 时给出
`screenshot-regression 13/17` + `workbench-interactions FAIL`。R7 做了**端口对照实验**（同一测试、同一代码，
只把栈从随机端口换成默认端口 api=41695 / vite=5176）：

| 项 | 随机端口栈 | 默认端口栈 | 归因 | 处置 |
|---|---|---|---|---|
| `workbench` | FAIL | **PASS** | `frontend/public/workbench.html:397` 硬编码 `http://127.0.0.1:41695`，随机端口栈下取不到数据 | 页面改读注入基址（保留 41695 兜底）+ dev 中间件为 public HTML 补同一注入面 → 随机端口下 PASS |
| `plugin` | FAIL | **PASS** | `screenshot-regression.mjs` 硬编码 `http://127.0.0.1:41695/plugins/...` | 改用 `EAGLE_API_URL`（兜底 41695）→ 随机端口下 PASS |
| `workbench-interactions` | FAIL | **PASS** | 同上（workbench 页无数据 → 无 `.item-card` → inspector 无内容） | 随 workbench 一并修复 → PASS |
| `model` | FAIL | FAIL | 页面初始化即抛异常，与端口无关（见下） | 修页面判空 → PASS |
| `gif` | FAIL | FAIL | 架构上不适用于顶层直连（见下） | 改为显式 SKIP + 指向真实上下文覆盖 |

**`model` 根因**（真实缺陷，已修）：`src/app/model-viewer/website/index.html:103` 无条件读
`window.frameElement.getAttribute("callback")`——该页是 **iframe 内嵌**引擎页，顶层直接打开时
`frameElement` 为 `null`，首个 engine 事件即抛
`TypeError: Cannot read properties of null (reading 'getAttribute')`，其后的
`body.classList.add('show')` 永不执行 → **整页空白**（Chrome 直连实测：`body.innerText` 为空、
异常锚点即该行）。加判空后：顶层可正常渲染（实测 `#main_file_name === "box.glb"`），iframe 内
`frameElement` 非空、行为逐字不变。

**`gif` 判定**（不适用，非缺陷）：查看器是 iframe 子窗，粘合层经 `parent.require` 取 Node 侧
`my_modules/url`（`viewers/gif/entry.tsx:32-37`）并回调父窗驱动面（`gifViewer.onFinished/onProgress`）。
纯浏览器顶层直连没有 Node 通道，本页在该场景下**不可能**被驱动——原断言不成立。故在
`screenshot-regression.mjs` 里把它改成**显式 SKIP 并打印理由**（不截图、不计入通过），
真实上下文的覆盖在套件项 `tests/react-stage-smoke.mjs` 的 `b1-9ah`（Electron 主窗内挂真实 iframe →
Vite 中间件链 → 真实 SuperGif 引擎 → `onFinished` 回程），R7 核对该项在套件内为绿。

**R7 处置后实测**：`ATTACHED_NONSUITE OK`——`screenshot-regression 16/16（SKIP gif）` +
`workbench-interactions PASS`。5 项红全部消除（4 项转 PASS、1 项转有理由的 SKIP）。

### 5.4 `tests/continuous-grid-scroll.mjs`（末端反向滚轮）

R7 在**验收全量运行**中首次观察到它：套件内 `FAIL (exit=1) → RETRY → OK`（R6 的那次全量运行未出现）。
隔离复跑矩阵（串行 4 次）：

| 轮次 | 结果 | 耗时 |
|---|---|---|
| 1 | PASS | 120.2s |
| 2 | PASS | 142.2s |
| 3 | **FAIL** | 81.8s |
| 4 | PASS | 167.9s |

失败断言（`tests/continuous-grid-scroll.mjs:180`）：
`AssertionError [ERR_ASSERTION]: wheel reverses immediately at list end`。

**触发条件（失败轮次的现场状态即证据）**：断言前是「`machineryGotoBottom()` 到列表末端 → 等 350ms →
派发向上滚轮 → **等固定 400ms** → 断言位移 > 100px」。失败时 GRID STATE 显示：
`total:600, boxes:44, loaded:6`，`lazyState.queue` 仍有 6 个 id、`pending` 仍有 17 个 box，
图片 `complete:true` 但 `naturalWidth:0`（尚未解码）——即**尾部懒加载仍在飞**，反向位移在 400ms
窗口内未达阈值。

**判定**：**负载相关的固定等待窗口过窄**，非产品语义缺陷——同一断言在同一机器上 3/4 通过、套件内重跑
即过、R6 全量运行首跑通过。

**处置**（同仓先例：sidebar-dnd 的 dragend 清理由固定 150ms 改为轮询上限 5s）：把「固定 400ms」改为
**上限 2000ms 的轮询**，**判据与断言文本不变**（`top < height - viewport - 100`，即尾部向上滚轮必须
反向移动 > 100px）；超时仍以同一条断言失败，故「永不反向」的真缺陷不会被放过。修复后复跑矩阵见下。

| 修复后（串行 4 次） | 结果 |
|---|---|
| `REPRO tests/continuous-grid-scroll.mjs` | 4/4 PASS（见 §9 证据文件 `repro-grid-scroll-fixed/`） |

---

## 6. R7 期间发现并修正的缺陷（覆盖缺口与端口硬编码）

### 6.1 两个关键闭环测试此前**不被任何命令执行**（覆盖缺口）

覆盖面守卫首次运行即报：`验收必需项不被任何命令执行：tests/export-progress-closed-loop.mjs`；
按报告 §6「编辑与持久化」行逐项核对又发现 `item-persistence-closed-loop` 与
`electron-write-path-closed-loop` 在 `package.json` 与 `run-react-suite.mjs` 中**零引用**——
而报告正是把它们列为该验收面的验证手段。即：这两条长期没跑过。

处置（**不改任何断言**，先单独实跑确认通过再接入）：

| 测试 | 实跑 | 接入 |
|---|---|---|
| `item-persistence-closed-loop` | `ITEM_PERSISTENCE_CLOSED_LOOP_OK edit=6steps` | `npm run test:persistence` + 验收 `regression` 段 |
| `electron-write-path-closed-loop` | `WRITE_PATH_CLOSED_LOOP_OK ops=8 reqs=8 seq=…` | 同上 |
| `export-progress-closed-loop` | 由验收 `regression` 段执行 | 之前只在 `npm run test:full` 的 `test:export-progress` 里 |
| `run-attached-nonsuite.mjs` | `ATTACHED_NONSUITE OK` | 新增 `npm run test:attached`（此前只在注释里说明用法，未在 package.json 登记） |

### 6.2 端口硬编码（三处）

| 位置 | 原状 | 风险 | 处置 |
|---|---|---|---|
| `frontend/public/workbench.html:397` | `const API = 'http://127.0.0.1:41695'` | 非默认端口的栈（隔离回归、多实例开发）下整页无数据 | 改读 `window.__EAGLE_API_BASE_URL`，保留 41695 兜底 |
| `frontend/vite.preview.config.mjs` 开发中间件 | public 目录的静态页**不经注入**直出 | 上一条改了也拿不到基址 | 为 `frontend/public/**/*.html` 补 `injectPreviewScripts`（与 `/src/app` 页同一注入面；路径限定在 publicDir 内） |
| `tests/screenshot-regression.mjs`（plugin 页） | 硬编码 `http://127.0.0.1:41695/plugins/...` | 隔离栈恒红，且与页面行为无关 | 改用 `EAGLE_API_URL`（兜底 41695） |
| `electron/main.cjs:3528`（插件烟测窗） | 硬编码 `http://localhost:41695/plugins/...` | `EAGLE_API_URL/EAGLE_API_PORT` 换端口时插件窗指向死地址 | 改用同文件第 9 行已定义的 `apiBase` |

### 6.3 其它

- `src/app/model-viewer/website/index.html:103`：`window.frameElement` 判空（§5.3）。
- `tests/run-react-suite.mjs`：失败**首跑**即打印断言尾部；过滤后无匹配行时**回落到原始尾部**
  （首例正是 §5.4：`continuous-grid-scroll` 首败的输出不含 `FAIL/Error:` 形态的行，过滤结果为空）。
- `tests/continuous-grid-scroll.mjs:177-186`：末端反向滚轮的固定 400ms → 上限 2s 轮询（判据不变，§5.4）。
- `tests/react-suite-manifest.mjs`（新增）：套件清单与分类的单一事实来源 + 覆盖面守卫数据。
- `tests/frontend-acceptance.mjs`（新增）：统一验收入口。
- `tests/screenshot-regression.mjs`：SKIP 语义（显式、带理由、不计入通过）。

---

## 7. 宿主环境问题单列（不写成通过）

### 7.1 `fs.cpSync` 在本机硬崩（Node exit 127）

最小复现（本机 Node v22.23.0，6 行）：

```js
const fs = require('fs'), os = require('os'), path = require('path');
const src = path.join(process.cwd(), 'frontend/public/mock-library/Eagle Reverse Demo.library');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cptest-'));
fs.cpSync(src, path.join(tmp, 'x.library'), { recursive: true });
```

实测：进程**无任何输出**直接退出，`NODE_EXIT=127`。排查确认**不是**符号链接（0 个）、不是超长路径
（最深 111 字符）、不是大目录（22 目录 / 58 文件）。结论：本机 `fs.cpSync(recursive)` 层面的宿主缺陷
（既有登记：PROGRESS 第 41 行「宿主 cpSync 缺陷绕过」；R1 交付资产时同样因此改用手工遍历）。

**影响面**：

- `tests/roadmap-panels.mjs:139`（`npm test` 第 36 项）→ 该测试在本机单独跑即 exit 127。
- `backend/src/{importer.js:364, library-migration.js:55, library-backup-service.js:147}` 仍用 `cpSync`
  （`backend/src/server.js:1957` 已手工遍历绕行）→ `npm test` 中经过这些路径的用例在本机会失败。
- 既有政策：`test:isolated` 需入树临时补丁（4 个文件）才绿，且**该补丁规定不入库**。

**实测（default 分段之外的单跑，两次对照）**：

| 运行 | 命令 | 结果 |
|---|---|---|
| 无补丁 | `node tests/frontend-acceptance.mjs --stages=backend` | **FAIL**（103.3s）：前 **34/45 项全绿**（含 `api-smoke`、`validate-library`、`plugin-smoke`、库创建、`image-import`、`folder-import`、`collect-save`、`image-export`、`color-palette`、各缩略图/文本/视频闭环、`item-workflow`、导入导出迁移等），在 **`tests/library-migration.mjs`** 处 `fetch failed / ECONNRESET` —— 即 backend 进程在处理 `/api/library/migrate` 时**死亡**（该路径命中 `library-migration.js:55` 的 `fs.cpSync`）。 |
| 加 4 文件临时补丁（cpSync → 等价手工递归拷贝，**用完已 `git checkout --` 还原**） | 同上 | **PASS**（119.5s）：`FULL_REGRESSION_ISOLATED_OK`，**45/45 全绿**（含 `library-migration`、`security`、`roadmap-panels`、`library-backup-restore`、`source-mode-*`）。 |

**结论**：阻断点**确为宿主 `fs.cpSync` 缺陷**，与前端迁移无关——同一套代码，仅把 4 处 `cpSync` 换成
等价手工拷贝，后端业务链即 45/45 全绿；`backend` 段在默认状态下失败是**环境问题**，不是迁移回归。

**处置（R7）**：把 `backend` 段从默认分段中**移出**，并在入口与文档两处写明原因；其执行结果单列，
**不并入前端验收结论**，也**不写成通过**。前端验收的验收面（类型/入口/构建/产物/关键业务回归）不受该缺陷影响。
（**未采纳**「把绕行补丁入库」：与本仓既定政策冲突——该补丁登记为「终审后回退、不入库」；
`backend/src` 不在本次前端迁移的改动面内。）

### 7.2 未在本机复跑的项

- `npm run start:prod`（本地静态服务 + 后端 + Electron 的**真实使用**路径）：属人工交互路径，
  机器自动化只覆盖到 `production-smoke`（Electron 加载 `dist/frontend`）。**未声称**通过人工使用验证。
- 10,000 条**真实素材库**的耗时/内存压力：未做（报告 §7 已声明未声称）。

---

## 8. 未通过 / 未覆盖项汇总（明确标注）

| 项 | 状态 | 说明 |
|---|---|---|
| `backend` 段（`full-regression-isolated` → `npm test` 45 项） | **宿主阻断（非通过）** | §7.1；加 4 文件临时补丁后 45/45 全绿，证明阻断点是宿主 `fs.cpSync` 而非迁移回归 |
| 10,000 条真实素材库性能（耗时/内存） | **未覆盖** | 报告 §7 明示未声称；R7 不虚构数据 |
| `npm run start:prod` 人工使用路径 | **未覆盖** | 自动化止于 `production-smoke` |
| `gif` 查看器（附着截图面） | **SKIP（不适用）** | 顶层直连无 Node 通道；真实上下文覆盖见 `react-stage-smoke` b1-9ah |
| 3D 查看器（`model-viewer`）行为测试 | **仅直连导航级** | 修复判空后在截图回归中可驱动并断言（`#main_file_name`）；**无** Electron 内嵌上下文的行为断言（R5 登记的「引擎页原样交付」），列为未覆盖 |
| `src/app/js` 保留项的运行时验证 | 按消费者清单保留 | 见入口台账 §8（每个路径都有具名消费者/理由；未逐项做运行期冒烟） |
| 57 个 `LEGACY_SCOPE_SLOTS` 挂载槽 | **未退役** | R4 登记的「R6 退役面」未在 R6/R7 处理（R6 五项工作项未含此项）；`scope-field-convergence` 以台账形式守卫其不可增长 |
| `continuous-grid-scroll` / `sidebar-dnd` / `main-ui-workflow` | **低频 flake（已归因）** | §5.1/§5.2/§5.4；套件内建「失败重跑一次」，R7 起首败即打印断言尾部 |

---

## 9. 原始证据摘录（关键行）

来自 `.tmp/r7/acceptance-final.log`（默认四段，最终树）、`.tmp/r7/acceptance-full.log`（同日、加固前）、
`.tmp/r7/acceptance-backend.log`（backend 无补丁）、`.tmp/r7/acceptance-backend-patched.log`（backend 加临时补丁）、
`.tmp/r7/attached-after-fix.out`（附着式）。

```
TYPECHECK_OK: 0 诊断（范围 = src/app/react，含 viewers/document 文档查看器）；@ts-nocheck 台账 8 个文件（待撤销 0）
SENTINEL_OK
SHIM_BOUNDARY_OK: 8 个 shim 模块跨模块标识符完整（无缺失 import）
SCOPE_CONVERGENCE_OK：已收敛 199 个字段 / 10 个域，挂载槽 57 个（R6 退役面），无未分类字符串键写入
✓ built in 11.06s                      ← vite build（含产物资产交付）
--- 汇总：FAIL 0，WARN 2 ---            ← dist-entry-check（2 条均为「有意排除」演示路由）
DIST_ENTRY_CHECK_OK
PRODUCTION_SMOKE_OK                    ← 无 Vite dev 下 Electron 加载 dist/frontend
REACT SUITE ALL GREEN （71 项：OK 70 + retry-OK 1）        ← 加固前那一次
注意：以下项首跑失败、重跑通过（低频/环境相关，证据见上）：tests/continuous-grid-scroll.mjs
REACT SUITE ALL GREEN （71 项：OK 69 + retry-OK 2）        ← 最终树
注意：以下项首跑失败、重跑通过（低频/环境相关，证据见上）：tests/main-ui-workflow-closed-loop.mjs, tests/react-s2-sidebar-dnd-closed-loop.mjs
  [first-failure] SIDEBAR_DND_CLOSED_LOOP_FAIL dragend cleanup timeout   ← R7 新增的首败留证
ITEM_PERSISTENCE_CLOSED_LOOP_OK edit=6steps …
WRITE_PATH_CLOSED_LOOP_OK ops=8 reqs=8 …
BROWSER_CAPTURE_UI_OK … / BROWSER_CAPTURE_UI_RESTART_OK …
EXPORT_PROGRESS_CLOSED_LOOP_OK {"…","concurrentRejected":true,"sourceLibraryUnchanged":true}
FRONTEND_ACCEPTANCE_ALL_GREEN          ← exit 0

# backend 段（宿主相关，单列）
[无补丁]  … 34 项 OK … → tests/library-migration.mjs: fetch failed / ECONNRESET  → FAIL (103.3s)
[加补丁]  FULL_REGRESSION_ISOLATED_OK {"apiPort":12000,…}                        → PASS (119.5s)

# 附着式（Chrome 无头）
ATTACHED_STACK api=8262 vite=8269 cdp=8270
screenshot regression passed: 16/16（SKIP gif）
Workbench interactions test passed
ATTACHED_NONSUITE OK
```

**文件清单**（均为本地临时证据，`.tmp/` 不入库；命令见 §10）：

| 文件 | 内容 |
|---|---|
| `.tmp/r7/acceptance-final.log` / `acceptance-latest.json` | 默认四段完整日志（**最终树**）与结构化结果 |
| `.tmp/r7/acceptance-full.log` | 同日另一次默认四段运行（`continuous-grid-scroll` 等待窗口加固**之前**） |
| `.tmp/r7/acceptance-backend.log` / `acceptance-backend-patched.log` | backend 段两次对照（§7.1） |
| `.tmp/r7/attached-after-fix.out`、`attached-default.out`、`attached-random-ports.out` | 附着式端口对照实验（§5.3） |
| `.tmp/r7/repro-main-ui-workflow/` | `main-ui-workflow` 4 轮复现矩阵（§5.2） |
| `.tmp/r7/repro-grid-scroll/`、`repro-grid-scroll-fixed/` | 网格滚动加固前后各 4 轮（§5.4） |
| `.tmp/r7/repro-react-s2-sidebar-dnd/` | 侧栏 DnD 隔离复跑 6 轮（§5.1） |
| `.tmp/r7/probe-model.mjs` | model-viewer 引擎页异常锚点探针（§5.3） |
| `.tmp/r7/cp-workaround-apply.mjs` | §7.1 临时绕行补丁的应用脚本（**不入库**；补丁本身已 `git checkout --` 还原） |

---

## 10. 复核命令

```powershell
Set-Location -LiteralPath 'H:/dev/Eagle-Sec-development - 副本'

npm run test:acceptance                 # 统一前端验收（static/build/artifact/regression）
node tests/frontend-acceptance.mjs --list   # 覆盖面 + 分类 + 分段（不执行）
npm run test:attached                   # 附着式（Chrome 无头）：screenshot 17 页 + workbench
npm run test:persistence                # 落盘读回 + 写路径单路由（R7 新接入）

# 宿主相关（单列，见 §7）
node tests/frontend-acceptance.mjs --stages=backend

# 历史低频失败复现（§5）
node tests/react-s2-sidebar-dnd-closed-loop.mjs      # 串行复跑观察
node tests/main-ui-workflow-closed-loop.mjs          # 串行复跑观察 no-event
```
