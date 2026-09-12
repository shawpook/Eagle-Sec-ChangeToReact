# D 阶段收官文档（b1-9bz-D，2026-09-11）

> 工作目录：`H:\dev\Eagle-Sec-development - 副本`　分支：`react-in-place`
> 本文件是 D 阶段（D-1 ~ D-4）的收官记录：目标、成果、DoD 六项实况、行为差异、遗留与验证方法。
> 相关：`src/app/react/PROGRESS.md`（逐批记录）、`src/app/react/REWRITE-PLAN.md`（总计划，本阶段后可归档）、
> `docs/handover-b1-9bz-D-2026-09-11.md`（D 阶段开工交接）。

---

## 1. 阶段目标与结论

| 阶段 | 目标 | 结论 |
|---|---|---|
| **D-1** | `dataMachinery.ts` 归位（Track A 挂载面清零 + Track B 函数体按域搬迁，文件消失） | ✅ **完成**：`dataMachinery.ts` 已删除；306 声明 / 11509 行拆入 16 个域/服务模块 |
| **D-2** | jQuery 清零 + index.html vendor 清零（含 `frontend/public/shims.js` 退役） | 🟡 **部分**：主窗 jQuery 0、vendor 0；`shims.js`（3996 行）仍存（阻塞于 DoD ①） |
| **D-3** | 套件 55 → 65+ 全绿 | ✅ **完成**：65 项（新增 10 项状态→渲染闭环） |
| **D-4** | 收官文档 + REWRITE-PLAN 归档 + DoD 六项核对 | ✅ 本文件 |

**D-1 体量**：`dataMachinery.ts` **11509 行 / 306 顶层声明 → 0**（删除）。
拆入落点：`core/libraryDomain`、`filterDomain`、`itemDomain`、`selectionViewDomain`、
`tagManagerDomain`、`miscDomain`、`keymap`、`keymapActions`、`navHistory`、**`machineryInfra`（新建）**，
`services/gridService`、`viewOpsService`、`mediaService`、`imageOpsService`、`folderCoreService`、
`uploadService`、`batchOpsService`，以及 `utils/normalize`、`utils/color`。

**流程口径**：每批 = 改写 → `bz-export-check` + `tsc` 零新增 + `bz-free-check` + `probe-b5-load`
`LOAD_OK` + 哨兵 `SENTINEL_OK` + 定向闭环 → 提交；整个大项完成后跑全量套件 + 哨兵收口
（用户指令：非必要不每批全套）。

---

## 2. 架构前后对照

| 面 | 迁移前 | 迁移后 |
|---|---|---|
| **函数/数据机器** | 单文件 `core/dataMachinery.ts`（11509 行，全树依赖汇点，47+ 文件 import） | 按域拆入 16 个模块；跨模块环依赖均为函数声明提升（运行时安全） |
| **挂载/供给层** | `dataMachinery.applyDataMachineryScope` 挂 `$bodyScope` 方法面 | `core/machineryInfra.applyDataMachineryScope`；跨边界供给仍走 `externalSupply` 延迟注册 |
| **jQuery** | 主窗 188 处（175 处在 dataMachinery）+ 3 vendor 脚本 | 主窗 0；`utils/domQuery`（元素级）+ `utils/domLite`（集合级，自研）承载 |
| **事件面** | Angular `$emit/$broadcast/$on` + jQuery 事件 | `eagleBus`（自研总线）+ 原生 DOM 事件；跨窗 `eagleDesktop.onIpc` |
| **规格测试** | 55 项（41 stage smoke + 14 闭环） | **65 项**（+10 项 D-3 状态→渲染闭环） |

---

## 3. DoD 六项核对（`REWRITE-PLAN.md` §四）

| # | 判据 | 实况 | 证据 |
|---|---|---|---|
| ① | 六项删除 grep-zero：`scopeShim`/`scopeBridge`/`shimFnsBridge`/`controllerFns`/`dataMachinery`/`appCore.coreState` | ❌ **未达**：`dataMachinery` ✅ 文件已删、引用 0；`scopeBridge`/`shimFnsBridge`/`controllerFns` ✅ 文件已删（仅余注释提及）；**`global/scopeShim.ts` 仍存（42 文件引用）**、**`appCore.coreState` 仍存**（scope 字段的访问器后端） | `tests-tmp/dod0-grep-zero.py` |
| ② | 永久哨兵：无 Angular 语义 + jQuery；`eagleBus` 唯一通道 | ❌ **未达**：`jQuery 0` ✅，但 Angular-ism 计数仍非零（`scopeApply 200`、`getBodyScope 794`、`watch 19`、`on 26`、`broadcast 4`、`$apply/$emit/$watch` 等 shim 面） | `tests/react-rewrite-sentinel.mjs` |
| ③ | `index.html` vendor 清零 | ✅ **已达**：`vendorScriptTags 0`；jQuery 家族/lodash/mousetrap/tippy/sweetalert2/colorpicker/flatpickr 主窗已退役；网格 = `@egjs/react-infinitegrid` | 哨兵 + `src/app/index.html` |
| ④ | 套件 53 → 65+ 全绿 | ✅ **已达**：65 项（D-3 新增 10 项）；`node tests/run-react-suite.mjs` 全绿 | suite log |
| ⑤ | 收官文档 + REWRITE-PLAN 归档 | ✅ 本文件；`PROGRESS.md` 终章 | — |

### ① 为何未达 + 剩余路线

`scopeShim.ts` 提供 `createBodyScopeShim()`（`$bodyScope` 的 Proxy 实现，后端为
`appCore.coreState`）、`scopeEvalAsync()`（digest 等价 flush：读 scope 字段 → 写 zustand store，
驱动 React 重渲染）、`migrateScopeFieldToStore` 等。全树仍有 **794 处 `getBodyScope()`** 读取、
**200 处 `scopeApply`**、**26 处 `on`** 依赖这套 scope 对象。

要达成 DoD ① 需完成「digest 面 / watcher 面 / scope 面」的最终退役，即：

1. 把剩余 scope 字段的读写点逐个迁到 zustand store（`getBodyScope().X` → `useXState.getState().X` /
   `setState`），消除 `coreState` 访问器后端；
2. 用 store 订阅 / React effect 取代 `scopeEvalAsync()` 的 flush 语义；
3. 删除 `createBodyScopeShim` 与 `scopeShim.ts`，`$bodyScope` 不再作为运行时对象存在；
4. 随之退役 `frontend/public/shims.js`（3996 行，DoD ②/D-2 遗留）。

这是一次跨 40+ 文件的架构变更（非机械搬迁），建议单独立项（记作 **E 阶段**）分竖切推进，
与新套件 65 项配合逐竖切回归。**施工图已产出：`docs/e-phase-plan-2026-09-12.md`**
（字段面清单、源翻转/调用点改写双轨批次 S-1~S-7 / C-1~C-7 + 收口批、每批门禁、风险不变量）。

### ② 未达原因

Angular-ism 计数的来源与 ① 同源：`scopeApply`/`on`/`watch` 等仍由 `$bodyScope` 的 shim 面承载；
① 完成后 ② 自然趋零，再固化哨兵阈值。

---

## 4. 已知行为差异 / 风险清单

1. **ESM 环依赖**：搬迁后 `machineryInfra` 成为新的依赖汇点，与各域互成环。环内两侧均为
   函数声明（提升），运行时安全；已由 `probe-b5-load` + 65 项套件验证启动链完好。
   **若后续在 `machineryInfra` 顶层引入 `const`/`class` 并被环内模块在模块求值期调用，
   会触发 TDZ——新增顶层求值语句前须评估。**
2. **`main-ui-workflow-closed-loop` flake 已定位并加固**：表现为 `inspector operation result
   timeout` / `annotation persistence timeout`。根因**非代码**——是「父进程被强杀后 Electron 子进程
   成为孤儿、后续 spawn 争用/失联」的环境级污染（实测：每次跑前清理本仓 Electron，连跑 3/3 全过）。
   三处加固：① `tests/run-react-suite.mjs` 每项前清理本仓残留 Electron；② 回归驱动
   （`electron/main.cjs`，仅 `--regression-host` 路径）的 inspector 结果等待改为「触发+等待最多 5 轮」
   且单轮 8s，丢弃轮次重新触发，超时错误附带 `last={reason:'no-event'|'no-target-id', value}`
   （D-4c，把 shim 侧失败原因带出）；③ 套件失败重跑一次，通过记 `OK (retry)`，真回归连败两次才计入。
   实测（2026-09-12）：清场后单独连跑 4/4 全过、判别序列（stage-smoke → main-ui-workflow）1/1 过。
3. **`tagRectSelecting` 双实现**：`tagManagerDomain`（`export let`，真实体）与
   `TagManager.tsx`（`window.tagRectSelecting`）各一份；B-12 已随簇归位，去重留 E 阶段。
4. **`collect-window` 独立 jQuery/API 层**：自带 `js/vendors/jquery-1.8.0.min.js` +
   `js/lib/api/{env,swal-dialog}.js`，与主窗路径无关，随采集窗 API 迁移另行推进。
5. **既有 `tsc` 存量错误 508**：全部为 bundle 逐字移植遗留的类型宽松（`any`/arity），
   非本轮引入；D-1 期间从 788 → 508（净修未声明全局等）。
6. **`scopeApply` 内部 `$apply` 语义**：C-3 曾试直调化导致 `stage-smoke` 主题切换失败，
   已保留原实现，待 E 阶段统一处置。

---

## 5. 验证方法（照抄可用）

```bash
# 快速门禁（每批）
python tests-tmp/bz-export-check.py                 # 具名导入存在性 + 相对路径可达
npx tsc --noEmit                                    # 与基线 508 比较（零新增）
node tests-tmp/probe-b5-load.mjs                    # 期望 PROBE_RESULT LOAD_OK allData=1
node tests/react-rewrite-sentinel.mjs               # SENTINEL_OK（jQuery 0 / vendorScriptTags 0）

# D-1 专项
python tests-tmp/dod0-grep-zero.py                  # DoD ① 六项核对
python tests-tmp/bz-d1-b0-map.py                    # 重新生成 docs/d1-b0-mapping.md（若 dataMachinery 尚存）

# 全量套件（大项收官）
node tests/run-react-suite.mjs                      # 期望 REACT SUITE ALL GREEN（65/65）
```

---

## 6. 交付物清单（D 阶段提交）

- D-1 Track B：B-1 ~ B-17 + B-final（`dataMachinery.ts` 删除）。
- D-3：`tests/closed-loop-common.mjs` + 10 项 `tests/d3-*-closed-loop.mjs` + 套件列表 55→65。
- 文档：`src/app/react/PROGRESS.md` 逐批记录 + 本收官文档 + `docs/d1-b0-mapping.md` 映射表。
- 工具（`tests-tmp/`，本地不入库）：`bz-b5-move.py`（搬迁）、`bz-fix-imports.py`（缺失符号补装）、
  `bz-free-check.py`（@ts-nocheck 目标静态兜底）、`bz-state-check.py`（模块级状态写入安全）、
  `bz-repoint-getfilter.py`、`dod0-grep-zero.py`、`d3-gen.py`/`d3-diag.mjs`。
