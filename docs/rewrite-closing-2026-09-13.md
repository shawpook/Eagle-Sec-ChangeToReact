# React 化改写收官文档（2026-09-13）

> 工作目录：`H:\dev\Eagle-Sec-development - 副本`　分支：`react-in-place`（上游 `origin/main`）
> 本文是整个 Angular→React 绞杀者改写的**最终收官/审计记录**：目标、DoD 五项实况、架构前后对照、
> 批次与提交链、实机 QA 阶段、已知行为差异、遗留清单与验证方法。
> 相关：`src/app/react/PROGRESS.md`（逐批权威记录）、`docs/e-phase-plan-2026-09-12.md`（E 阶段规划）、
> `docs/d-phase-closing-2026-09-11.md`（D 阶段收官）、`docs/manual-qa-2026-09-13.md`（实机走查）、
> `src/app/react/REWRITE-PLAN.md`（已归档总计划）。

---

## 1. 阶段结论

| 阶段 | 目标 | 结论 |
|---|---|---|
| **P0–P3**（b1-9ba…b1-9by） | 基建 / 竖切 / 独立窗口 / UI 原语自研 | ✅ 完成（历史记录见 PROGRESS） |
| **D-1** | `dataMachinery.ts` 归位（挂载面清零 + 函数体按域搬迁） | ✅ 完成：11509 行 / 306 声明 → 0（拆入 16 模块） |
| **D-2** | jQuery 清零 + index.html vendor 清零（含 `shims.js` 退役） | 🟡 部分：**主窗 jQuery 0、index.html vendor 0**；`frontend/public/shims.js` 仍存（见 §6.1） |
| **D-3** | 套件 55 → 65+ 全绿 | ✅ 完成：**65 项 ALL GREEN** |
| **D-4** | 收官文档 + 归档 | ✅ 完成（`docs/d-phase-closing-2026-09-11.md`） |
| **E**（E5-1…E5-4） | `$bodyScope` / `scopeShim` / `coreState` / digest 面退役（DoD ①、②） | ✅ 完成：**DoD ①、② 均达标**（见 §2） |
| **QA**（实机走查） | 实机交互循环发现并修复真实缺陷 | ✅ 完成 19 项发现 / 17 项修复（`docs/manual-qa-2026-09-13.md`） |

**一句话**：Angular 运行时与 scope 面已从主窗彻底消失（哨兵 Angular-ism/jQuery 计数全零），
React 单源状态 + 自研总线承担全部 UI；主窗不再存在 `window.$bodyScope`，跨边界改走显式
`window.__eagleDriver`。唯一未收口的是 **D-2 的 `shims.js` 退役**（已给出四步分解，见 §6.1）。

---

## 2. DoD 五项核对（`REWRITE-PLAN.md` §四）

| # | 判据 | 实况 | 证据 |
|---|---|---|---|
| ① | 六项删除 grep-zero：`scopeShim` / `scopeBridge` / `shimFnsBridge` / `controllerFns` / `dataMachinery` / `appCore.coreState` | ✅ **已达**：六项文件均已删除，**活代码引用 0**（按注释感知重扫，残余提及仅在块注释说明文字内） | `tests-tmp/dod0-grep-zero.py` + 注释感知复核 |
| ② | 永久哨兵：无 Angular 语义 + jQuery；`eagleBus` 唯一跨组件通道 | ✅ **已达**：见下表全零；主窗 scope 面 digest/事件调用由 `cForbidden` 硬门禁；子窗自有 controllerScope 按 `scopedOut` 设计豁免 | `tests/react-rewrite-sentinel.mjs` |
| ③ | `index.html` vendor 清零 | ✅ **已达**：`vendorScriptTags 0`；jQuery 家族 / lodash / mousetrap / tippy / sweetalert2 / colorpicker / flatpickr / jquery-audio 主窗退役；网格 = `@egjs/react-infinitegrid` | 哨兵 + `src/app/index.html` |
| ④ | 套件 53 → 65+ 全绿 | ✅ **已达**：65 项，末行 `REACT SUITE ALL GREEN` | `tests/run-react-suite.mjs` |
| ⑤ | 收官文档 + REWRITE-PLAN 归档 | ✅ 本文件 + PROGRESS 终章 + 规划文档 banner 更新；`REWRITE-PLAN.md` 已归档标注 | — |

### 哨兵终值（`node tests/react-rewrite-sentinel.mjs` → `SENTINEL_OK`）

| 指标 | E4 末 | 终值 | 基线 |
|---|---|---|---|
| `getBodyScope` | 15 | **0** | 0 |
| `evalAsync` | 4 | **0** | 0 |
| `apply` / `watch` / `watchCollection` / `broadcast` / `on` | 0 | **0** | 0 |
| `scopeApply` / `rootAccess` / `coreState` | 0 / 1 / 0 | **0 / 0 / 0** | 0 |
| `callScope` / `jQuery` / `lodashWindow` / `lodashBind` / `lodashBare` / `vendorScriptTags` | 0 | **0** | 0 |
| `scopeEvalAsync`（脱 scope 面 flush 包装，非 DoD 项） | 355 | **355** | 355 |

`tsc --noEmit`：**492**（E4 初 508 → 零新增错误键）。`getBodyScope` 自 793 起，累计 -100%。

---

## 3. 架构前后对照

| 面 | 改写前 | 终态 |
|---|---|---|
| 应用框架 | AngularJS 1.x（`app.bundle.js` 内联）+ 指令/控制器 | React + zustand；`index.html` 无 angular、无 bundle |
| 状态单一来源 | `$scope` 字段 + `coreState` 访问器后端（`scopeShim.ts` 的 Proxy） | zustand store 为真身；`core/scopeFace.ts` 是**显式 store 视图**（`Object.defineProperty` 直连 store，无 Proxy、无 coreState） |
| 跨边界供给 | `window.$bodyScope`（开放 scope 对象） | `window.__eagleDriver`（**显式白名单**：DATA 50 + ACTION 29；store 注册表 + 面属性两级后端）；诊断口 `window.__eagleScopeRegistry` |
| 主窗 scope 全局 | `window.$bodyScope` 存在 | **不存在**（E5-4 删除）；应用内跨窗共享模块经 `getWindowScope()` 取「本窗面」 |
| 子窗 | 自带 controllerScope + Angular 门面 | 同（有意保留：`preview-window` / `collect-window` / `preferences` / `viewers` 各自持有本窗 `$bodyScope`＝本窗 controllerScope） |
| digest / watcher | `$apply` / `$watch` / `$evalAsync` | 全部退役（哨兵 0）；store 订阅即时生效。`core/scopeRuntime.ts` 的 `scopeEvalAsync` 仅剩 355 处 no-op 包装（`flushScopeWatchers` 自 E4 起无注入者），属可继续清理的残留 |
| 事件通道 | `$emit/$broadcast/$on` + jQuery 事件 | `eagleBus`（自研）+ 原生 DOM 事件 + `eagleDesktop.onIpc` 跨窗 |
| 机器函数挂载 | `dataMachinery.applyDataMachineryScope` 写 `$bodyScope` 方法面 | `core/machineryInfra.applyDataMachineryScope` 写 `getDriverApi()`（未注册名回落 scopeFace 的 plain 槽） |
| jQuery | 主窗 188 处 + 3 vendor 脚本 | 主窗 0；`utils/domQuery`（元素级）+ `utils/domLite`（集合级自研） |
| 测试观测 | `window.$bodyScope.*` | 不变（harness 按文档惰性注入 `__eagleProbe`，52 个测试零改动）；诊断面 `window.__eagleCoreState` = scopeFace 本体 |

---

## 4. E 阶段批次与提交链

| 批次 | 内容 | 提交 |
|---|---|---|
| E5-0 | `$bodyScope` 消费面侦察（52 测试 / main.cjs / shims.js / 子窗三合一）+ 四步分解 | `b5db0d76` |
| E5-1 | `runInBodyScope` 回调去 scope 化（115 处）+ `scopeApply`/`rootAccess`/`evalAsync` 归零 | `57b4bac6` |
| E5-2 | 生产侧：新增 `core/driverApi.ts` + 注册表诊断口；删 `getBodyScope/getRootScope`（15→0）；`main.cjs` 就绪探针改驱动面 | `57fd1b6d` |
| E5-3 | src 残余裸 `$bodyScope` 读点迁移（bundleGlobals / itemDomain / hoverPreview / smoothZoomEngine / miscDomain / tagManagerDomain / selectionViewDomain / itemMenuService / 三个 viewer entry）；shims 注入 `bodyScope()` 访问器；harness 安装 `__eagleProbe` | `8b68a3f9` |
| E5-4 | 删主窗 `window.$bodyScope` 别名 + `$evalAsync` → **DoD ② 达标**；遗留 classic script 迁移（`lazy-load-manager.js`、`vendor/eagle-match-rules.js`） | `b0df529d` |
| 收尾 | `export-progress` 冒烟观测口改 React 活引用 + E5 收官记录/E5-5 评估 | `df82265c` |
| 仓库卫生 | 清工作树遗留（工具状态三删除项）+ 补入未跟踪交接文档 + `.workbuddy/` 忽略 | `b9d56f2e` |
| 实机 QA | F1–F14 / Q1–Q19 实机走查修复 + QA 总记录 | `1227ab18` |
| 收尾 | 删 QA 引入的 2 处 no-op `scopeEvalAsync`（恢复哨兵单调门） | `098c9aa0` |
| 收尾 | `--smoke-desktop` 去 Angular 遗留；`screenshot-regression` main 页就绪预算 | `920c247f` |

**关键设计决策**（施工中定死，后人勿重走）：
1. **面创建与 window 暴露解耦**：`getScopeFace()` 不写 window（否则子窗会被主窗空面覆盖——
   preview-delivery 的 `selectNext reading 'height'` 即此坑）；跨窗共享模块用 `getWindowScope()`。
2. **注册字段描述符 `configurable:false`**：scopeFace 是 store 的稳定视图，`delete scope.X`
   不得摘掉访问器（cz2 的清理动作踩中过）。
3. **`writeScopeField` 注册字段直写 store**，未注册回落「本窗面」plain 槽。
4. **测试观测与生产供给分离**：生产只有 `__eagleDriver`/`__eagleScopeRegistry`；`__eagleProbe`
   由 `tests/react-cdp-harness.mjs` 经 `Page.addScriptToEvaluateOnNewDocument` **按文档惰性注入**
   （一次性 `Runtime.evaluate` 会被启动期导航清掉）。
5. **`$evalAsync` 之谜结论**：E1b 记录的「有则过、无则败」指**预览窗 controllerScope** 的
   `$evalAsync`（实现调 `notify()` 触发预览窗重渲染），不是主窗 no-op 钩子。

---

## 5. 实机 QA 阶段（2026-09-13，提交 `1227ab18`）

实机交互循环（Electron + CDP，默认库 `D:\饼.library`）发现 19 项、修复 17 项。详见
`docs/manual-qa-2026-09-13.md`。**共性教训（对后续维护最重要）**：

1. **「异步链吞错」型静默失效**（Q3/Q5/Q11）：原版 scope 面函数 / 全局 / polyfill 在移植中缺失，
   TypeError 被 promise/异步回调吞掉，用户侧表现为「按钮没反应」。→ 建议给 `runInBodyScope`、
   `rebindRefresh`、portal 回调的 `console.error` 接统一开发期告警。
2. **「注册了但没人赋值」型死守卫**（Q16/Q19）：`store.saveFolder` / `TagManager.filterWithTags`
   等字段在 store 注册表中存在（于是 `&&` 守卫静默通过判定为 function 检查失败），但迁移后无人挂载
   → 组件侧唯一持久化入口 no-op。→ 建议对「字符串路由表 / `s[name]` 动态派发」做全仓审计。
3. **eagleBus 单 payload 语义 vs Angular `$on` 双参签名**（Q10/Q12）：handler 写成 `(_e, items)`
   会收到 undefined。→ 全仓审计 `Channel.on((_e` 形态。

---

## 6. 遗留清单

### 6.1 【唯一未收口的代码项】`frontend/public/shims.js` 退役（D-2 剩余）

4007 行 + `mock-data.js` 453 行，由 `frontend/vite.preview.config.mjs` 在 **dev 与 build 双路径**注入。
它不是残留代码，而是同时承担：① 生产 Electron 的**通道桥**（`images-change → item.updateMany`、
`library.create/switch`、`folders-change`、`empty-trash`、`clipboard.import`、`open-preview-window` …）；
② **详情原图交付门控**（25ms 轮询包装 `enterDetailMode`/`leaveDetailMode` + `DetailWorker`）；
③ 浏览器预览 mock（`__mockLibrary` / fetch 改写 / desktopApi 缺席时的内存实现 / capture 轮询）；
④ viewer 页 `$bodyScope` 逐页 mock；⑤ document viewer（OrcaBox workspace）。

**建议四步（每步独立提交 + 定向回归）**：
1. ① 通道桥抽 `core/channelBridge.ts`（React 静态 import，语义零变化）。
2. ② 详情交付门控落到 React detail 生命周期（`preview-delivery` 定向验证）。
3. ③④ 迁入仅 dev/测试模块（`import.meta.env.DEV` 或独立 `dev-shims`）；生产 build 不含 mock；
   `mock-data.js` 作为 fixture 保留。
4. 3 个直读 shims 源码字符串的测试（`empty-trash` / `txt-update` / `native-preview`）改**行为断言**；
   vite 配置摘除注入；删 `shims.js`。

**风险**：①② 是全套件（含非 65 项）地基，误删会以「看起来无关」的方式大面积回归；
`main-ui-workflow` 在 `updateMany` 后端路径上本就有负载 flake，正是该路径的既有脆弱点。

**施工进度（2026-09-14 续：收尾批 E6-1，提交 `bb538f9e`）**

| 项 | 状态 |
|---|---|
| P0 预置 | ✅ 基线（哨兵 `SENTINEL_OK` / tsc 492 / 附着实测 runner 入树） |
| P6 scope 残留 | ✅ `scopeEvalAsync 355 → 0`、删 `core/scopeRuntime.ts`、退役 `window.__eagleDataMachinery`（m1 契约同步改写）、`docs/plan.md` 悬挂引用改指 git 历史 |
| P1 通道桥 | ⬜ 未落地 —— **前提已更正**：React 约 40 文件经 shims 总线发消息、`eagleGlobals.ipcRenderer()` 必落 shims；须先给 `preload.cjs` 加通用 `ipc` 桥并把总线 + 回程（`desktopApi.onIpc` 扇出）整体迁 React，而非「搬 16 段路由」。逐分支复核结论见 `docs/e5-5-shims-retirement-plan.md` §0 |
| P2 详情门控 | ⬜ `shims.js:56-555`（门控 56-232 + document viewer 234-555）为自洽簇，依赖 `bodyScope()`/`__mockLibraryCache`/DOM；可整体迁 React 模块 |
| P3 source-mode UI | ⬜ `shims.js:3450-4041`。注意：**该块在 React 下是活的** —— `Sidebar.tsx:699` 有意保留 `ng-click` 兼容钩子供 `installModeSwitch`（`:4023`）识别；但 `openSourceFolderInAngular` 依赖已死的 `window.angular`，`handleSourceSelect/Rescan/Remove` 无调用点（半失效态） |
| P4 浏览器 mock 隔离 | ⬜ 未落地 |
| P5 删 shims.js | ⬜ 未落地；3 个读 shims 源码字符串的测试（`empty-trash`/`txt-update`/`native-preview`）其断言**只能在 P1 产出 channelBridge 后**改指新接缝，故 P5-pre 不能在 P1 前完成 |

### 6.2 其它有意保留 / 可继续清理

| 项 | 说明 |
|---|---|
| `scopeEvalAsync` 355 处 | no-op flush 包装（`core/scopeRuntime.ts` 的 `flushScopeWatchers` 自 E4 起无注入者）；可随调用点收敛后整体删除该模块。**收尾已删掉 2 处 QA 新引入的**（`098c9aa0`） |
| 子窗 controllerScope 的 Angular 门面 | `preview-window`/`collect-window`/`preferences`/`viewers` 各自普通对象上的 `$watch`/`$on`/`$apply`/`$evalAsync`；哨兵按 `scopedOut` 设计豁免（非主窗 scope 调用点）。子窗 `window.$bodyScope` 保留 |
| `window.__eagleCoreState` | = scopeFace 本体，仅诊断契约（cz1/cz2/m1） |
| `getWindowScope()` | 跨窗共享模块的「本窗面」取用口（主窗回落 `getScopeFace()`） |

### 6.3 未决策项 / 宿主限制（移植面之外）

| 项 | 状态 |
|---|---|
| `docs/plan.md` 已删，但 `docs/EAGLE_ORCABOX_MODE_EXECUTION.md` 仍引用其路径 | 内容在 git 历史（`git show <删除前提交>:docs/plan.md`）；建议改引或恢复 |
| `npm test`（47 项后端/渲染面）与 `test:isolated` | **本宿主不可绿**：`tests/roadmap-panels.mjs` 崩于 `fs.cpSync(recursive)`（PROGRESS 第 41 行登记的宿主缺陷；`test:isolated` 需入树临时补丁，且该补丁规定不入库）。本次未跑 |
| `browser-capture-electron-extension-e2e` | 需 41593 端口空闲；本次因本机 dev 栈在跑而 **BLOCKED**（测试自身按 skip 处理，exit 0） |
| QA 观察项 Q9 / Q15 | 导入后 store 条目 size 偶发 `0.00 bytes`（重启自愈）；偏好窗 X 按钮命中区偏小（手测正常）。均未定位到代码缺陷 |
| DOM 卫生 | `#tag-select-panel-search-input` 在 general 与 inspector 两个 select-panel 间重复 id（引擎用作用域选择器规避，无运行时影响） |
| 测试遗留物 | 默认库 `D:\饼.library` 内有 40 个 `qa*` 条目 + 3 个 `manual-qa-assets*` 文件夹；1 个真实条目上有测试标签 `qa标签A` + 4 星。清理方式见 `docs/manual-qa-2026-09-13.md` 「测试遗留物」 |

---

## 7. 验证方法与本次实跑结果

**React 全量套件**：`node tests/run-react-suite.mjs` → `REACT SUITE ALL GREEN`（65/65；
`main-ui-workflow` 走既有一次重试，属其自陈的 `updateMany` 后端负载 flake）。

**非套件部分**（`test:full` 中 65 套件以外的项，本次逐项实跑）：

| 组 | 项 | 结果 |
|---|---|---|
| Electron smoke | `tests/electron-smoke.cjs` | `ELECTRON_SMOKE_OK` |
| | `electron/main.cjs --smoke` | exit 0（该模式仅启动即退出，无 marker） |
| | `electron/main.cjs --smoke-plugin` | `PLUGIN_WINDOW_OK` |
| | `electron/main.cjs --smoke-desktop` | `DESKTOP_SMOKE_OK`（**本次修复**，见 `920c247f`） |
| | `tests/electron-library-bridge.mjs` | `LIBRARY_SMOKE_OK` |
| Source Mode | `source-mode-api` / `-thumbnails` / `-watch` / `-ui-closed-loop` | 全 `_OK` |
| Document viewer | `document-viewer-api-smoke` / `document-viewer-ui-closed-loop` | 全 `_OK` |
| Browser capture | `browser-capture-protocol` / `-download` / `-ui-closed-loop` | 全 `_OK` |
| | `browser-capture-electron-extension-e2e` | **BLOCKED**（41593 被本机 dev 栈占用；测试按 skip，exit 0） |
| 截图回归 | `tests/screenshot-regression.mjs` | **17/17 PASS**（隔离栈 + Chrome 无头；**本次修复** main 页就绪预算，见 `920c247f`） |
| 工作台 | `tests/workbench-interactions.mjs` | `Workbench interactions test passed` |
| 导出进度 | `export-progress-closed-loop` | `_OK`（**E5 收尾修复**，见 `df82265c`） |
| 其余（已在 65 套件内复跑） | main-ui-workflow / preview-delivery / drag-start / video-detail / library-switch-ui / menu-popup / txt-update / empty-trash / native-preview / channel-wiring / ui-interactions / residue / sidebar-dnd / d3×10 … | 全绿 |
| 后端 | `npm test` / `test:isolated` | **未跑**（见 §6.3 宿主限制） |

> 「附着式」测试（screenshot/workbench/roadmap）用**浏览器级 CDP** `Target.createTarget/closeTarget`，
> Electron CDP 不支持，且会关闭所有 page target —— 必须对着**隔离栈**跑，绝不可指向正在使用的实例。
> 本次用 `tests-tmp/run-attached-nonsuite.mjs`（临时工具，gitignored）拉起自有端口的
> backend + vite + Chrome 无头，全部与用户 dev 栈隔离。

**每批门禁（沿用全程口径）**：改写 → 哨兵 `SENTINEL_OK` + `tsc` 零新增错误键 +
`probe-b5-load` `LOAD_OK` + 定向闭环 → 提交；阶段末跑全量套件（用户指令：非必要不每批全套）。
