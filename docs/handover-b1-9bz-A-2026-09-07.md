# 交接文档：b1-9bz-A —— fns 表 148 表体归位手术（进行中，卡在 boot 链最后一个断点）

> 写给全新 AI 会话。目标：读完即可继续 bz-A 的收尾（定位并修复 boot 链断点 → 全套件 ALL GREEN → 正式收官提交 → 进入 bz-B）。
> 所有行号、探针输出、git 状态均为实测锚定（行号/数据截至 2026-09-07，**git 状态已更新至 2026-09-09 交接快照提交**）。
>
> **交接快照提交：`540fa6c` "b1-9bz-A 卡住交接-9.9日下午"（19 文件，+4440/-5454）** —— bz-A 手术全部改动（含 PROGRESS.md 快照状态块、stage1c3 计数、哨兵基线）已入库；下一会话从该提交之上继续。

---

## 一、核心板块

### 1. 项目核心目标

Eagle 桌面应用（Angular1 → React in-place 迁移，分支 `react-in-place`，仓库 `H:\dev\Eagle-Sec-development - 副本`，Windows 11 + Git Bash）。当前在 P4 终审阶段，批 26 = **b1-9bz：fns 表清零**。bz 分四笔：

- **bz-A（本交接的主角，进行中）**：controllerFns.ts 的 148 个 `fns["name"] = function(...)` 表体全部归位到 11 个真实模块（services/* + core/*），controllerFns.ts 缩为**指针注册表**（121 指针 + 6 个 install 调用，约 200 行）。27 个死壳删除。
- bz-B（未开始）：双面消费方直调化——callScope 27 点 + panels8e 本地 10 点 + BoxList callFn 4 名 + scopeFace ~584 行改为直接 import；hooks 的 callScope/coreFnsCache/__eagleCoreFns 摘除；shimFnsBridge/main.tsx attach 摘除；stage1c3/probe-filter-toggle 契约改写；43 双键单源化。
- bz-C（未开始）：dataMachinery.ts 的 241 个 machinery 导出按族迁 services；applyDataMachineryScope 的状态种子抽 `core/shimSeeds.ts`（保留到 ca）；controllerFns.ts / dataMachinery.ts / shimFnsBridge.ts 三文件删除，grep-zero 验证；哨兵吸收 + 全量门禁。
- P4-ca（批 27，未开始）：scopeShim/coreState 删除 + 永久哨兵扩面（react+collect-window+preview-window+viewers 全禁 $evalAsync/$apply/$watch/$broadcast/$on/jQuery/$(/callScope/scopeApply/getBodyScope，bus.ts 白名单）+ 收官审计。

### 2. 已完成进度

**已提交（git log 顶端）**：
- `540fa6c` **b1-9bz-A 卡住交接-9.9日下午** —— 交接快照（19 文件 +4440/-5454）：bz-A 手术全量 + PROGRESS.md 快照状态块 + stage1c3 计数 263→236 + 哨兵基线。**手术态已入库，下一会话直接在此之上修 boot 链。**
- `9cde463` docs(react): b1-9bz 考据定案——fns 表清零+三文件删除（148 壳/43 双键/241 导出实锚 + 双面双体定性 + 四笔拆分）。考据数据全部存档在 `tests-tmp/bz-inventory.json`。
- `2f51c5c` feat(react): b1-9by-D —— 前一批（by）已收官，套件 ALL GREEN。

**bz-A 手术改动已全部随交接快照 `540fa6c` 入库**（含 3 个新落点文件），手术已完成的部分：

- `src/app/react/core/controllerFns.ts`：已重写为指针注册表（5593 行 → 约 200 行）。121 个 `fns["NAME"] = 落点导出;` 指针 + 尾部 6 个 `installXxxFns(fns, getScope)` 调用（folderMenu/miscMenu/batchOps/folderCore/imageOps/fontTag 六族，这些是 b1-9bn..bt 时代就有的注册面，条目名零改动）。
- 11 个落点接收了 121 个函数体（git diff 行数）：filterDomain(+858)、itemDomain(+567)、miscDomain(+469)、folderCoreService(+397)、selectionService(+359)、sidebarService(+356)、mediaService(+228)、imageOpsService(+188)、itemMenuService(+9)；**新建 3 个 untracked 落点**：`services/lockService.ts`、`services/uploadService.ts`、`services/viewOpsService.ts`。
- `dataMachinery.ts` 的 diff 只剩 2 行合法 import 改写：`updateCurrentOrderAndIncrease` 改从 `./miscDomain` 导入、`isInFolder` 改从 `./itemDomain` 导入（原都从 controllerFns 导入）。
- `libraryDomain.ts` 的 diff 只剩 1 行：`isInFolder` 改从 `./itemDomain` 导入。
- `miscMenuService.ts`、`folderCoreService.ts` 等 2 行小改（同一批 import 改写）。
- `tests/react-stage1c3-smoke.mjs`：计数断言 263 → 236（121 指针 + 115 install 条目）。
- `tests/react-rewrite-sentinel-baseline.json`：已吸收 bz-A 基线（evalAsync 385 / apply 16 / broadcast 122 / rootAccess 464 / getBodyScope 708 / lodashBare 20）。

**手术脚本（全在 tests-tmp/，可从 HEAD-clean 重放，历史教训齐全）**：
- `bz-a-map.py`：处置映射。TARGET 121 名 → 11 落点；DEL_SET 27（clickSmartNode + 21 双键死体 + 5 净死壳 dblclickSidebarFolder/getExifRawPath/preventMiddleClick/toggleGifPlayerMode/toggleRatioContextMenu）；POINTER_EXISTING 4（clickNode/toggleFolderExpand/toggleSmartFolderExpand/updateSidebarList——落点 sidebarService 已有同名 machinery 背书导出，c3 体不迁、表项直接指既有导出，零行为变化）。
- `bz-a-surgery.py`：预分析器（模块作用域求交口径）→ `bz-a-need.json`。
- `bz-a-apply.py`：手术主体（内含全部已修好的雷，见「五、关键规则」）。
- `bz-a-audit.py`：标识符 DELTA 审计——`new_uncovered ⊆ old_uncovered` 口径，已 PASS（117 移动体）。

**已通过的闸门（bz-A 手术本身是健康的）**：
- esbuild 双入口 0 错（vite dev 下双 entry：main.tsx / angular 侧入口）。
- DELTA 审计 PASS。
- 哨兵 SENTINEL_OK（基线已吸收）。
- boot 探针（`tests-tmp/bz-a-dbg.mjs` → out5/6/7/9）：`shimFnsBridge attached=236`、`coreFnsKeys=236`、fnFace 14 个抽查（colorFilter/grayColorFilter/searchFilter/rebindRefresh/select/clickNode/calculateImageBinding/updateSidebarList/filterContent/openItemContextMenu/cancelAllTasks/contentFocus/zoomFit/changeOrderBy）全 function，boot 期无未处理异常。

### 3. 当前状态与卡点

**当前唯一卡点：全套件 35/55 挂（最近一次完整跑 `tests-tmp/bz-a-suite2.log`），全部失败测试共享同一根因——boot 链后 `listDone=false`、`s.colorDistancesMap=undefined` → `#box-list .box` 网格不渲染。**

失败列表（35 个）：react-stage-smoke（b1-9ad-colorfilter-pipeline 单项断言挂）、stage5/6/7a/7b/7c/7d4/7d5a/7d5b/7d6a/7d6b/7d6c/8a/8b/8c/8d/8e/8e2/9a2/9a3/11a1/11a2/11a3/11a49/11b0/1c2/1c3/1cz1/1cz2/1cz3/1m1、main-ui-workflow、s2-sidebar-dnd、ui-interactions、residue-closed-loop。其余 20 个 OK（stage7c2/7d1a..7d3b/9b1、source-mode/library-switch/drag-start/preview-delivery/channel-wiring/menu-popup/txt-update/empty-trash/native-preview 等 closed-loop 全绿——它们不依赖网格渲染）。

**根因链已 80% 收敛（干净树探针铁证 `tests-tmp/bz-a-dbg2-out5.txt`，2026-09-07 最新一次跑）**：

```json
{"pipeline":{"colorDistancesMap":"undefined","isItemBindCalculated":true,"listDone":false,"rawLen":1,
"wUrlState":"object","sUrlState":"object","openAll":"function","reload":"function","viewMode":"all"},
"openAllCall":"ok","listDoneAfterOpenAll":true,"step_relayout":"ok","step_updateSelection":"ok",
"step_calculateFilterCounts":"ok","step_updateSubFolderWidth":"ok","step_rebindRefresh":"ok",
"listDoneAfter":true,"colorMapAfter":"object","colorFilterResult":true,"dist":0.01,"grayResult":true,"swallowed":[]}
```

解读（这是新 AI 的推理起点，全部实锚）：
1. boot 后：`isItemBindCalculated=true`（libraryDomain.ts:762 `s.calculateImageBinding({}, cb)` 的回调**已执行**、764 已置位）但 `listDone=false`、`colorDistancesMap=undefined`。
2. 回调里 viewMode=="all" 分支：全新临时库无 lastFolder/lastSmartFolder → 走 else 分支 `libraryDomain.ts:807 s.openAll(undefined, cb)`。**openAll/reload 函数面都在（typeof function），UrlStateService 双面都在。**
3. **手动 `s.openAll(true)` 一调就通**：`listDoneAfterOpenAll=true`、`colorMapAfter="object"`、`colorFilterResult=true`、`dist=0.01`——**管线本身完全没坏**，只是 boot 期那一次 `s.openAll(...)` 调用**从未发生或静默早退**。
4. boot 期无任何 console.error/异常（dbg out5/6/7 只有 2 条无关噪音：BatchRenameArtstationModals.tsx:831 的 reading 'number' TypeError + React 的 `<%s>` tag warning）。shim $timeout（dataMachinery.ts:246-257）有异常会打 `[shimTimeout] fn failed`——没出现，说明**不是"回调炸了被吞"，而是调用根本没发生**。

**待排查的断点区间（下一步的全部工作就在这）**：libraryDomain.ts 762 `s.calculateImageBinding({}, function(){...})` 回调体内，764（isItemBindCalculated=true 已过）→ 807 `s.openAll(...)` 之间。762 回调的完整结构（已通读，行号实测）：

- 763 `s.viewMode = localStorage.getItem(...) || "all"` —— viewMode 实测 "all"，**已过**
- 765 `if (s.viewMode == "all")` —— **已进**
- 766-770 lastFolderId/lastItem/lastItemTime/lastFolder/lastSmartFolder 读（全新库全 undefined/null，不炸）
- 772 `if (lastFolder && ...)` false → 790 `else if (lastSmartFolder)` false → 806 `else { s.openAll(undefined, function(){...}) }` —— **嫌疑区间**
- 另一个可能性（已排除）：762 的回调**本身没被调**。已核实 isItemBindCalculated 的写点全 src 只有两处：`libraryDomain.ts:425`（写 false，重载起点）和 `libraryDomain.ts:764`（写 true）——out5 里它为 true ⇒ **764 已执行 ⇒ 回调确实跑了**。

**为什么 openAll 没能置位 listDone——嫌疑按优先级重排（2026-09-07 晚间更新，含新发现）**：

1. **【新发现·头号嫌疑】`machineryOpenAll` 的快路径早退**（dataMachinery.ts:3339-3347，已通读原文）：
   ```ts
   export function machineryOpenAll(s: any, ignoreHistory: any, callback: any): void {
     const w = window as any;
     const $timeout = getTimeout();
     if (s.viewMode === 'all' && s.allData.length > 0 && w.eagle.filter.filterRules.color.value == undefined) {
       if (callback) { callback(); }
       if (s.isDetailMode) { s.leaveDetailMode(); }
       return;                                    // ← 提前返回：不走 $timeout → 不调 s.reload() → listDone 永不置位！
     }
     w.ScrollbarSaver.saveScrollPosition();
     s.viewMode = 'all'; s.$root.currentFocus = "sidebar"; s.resetPage();
     $timeout.cancel(openAllTimeout);
     openAllTimeout = $timeout(function () { ... s.reload(); ... }, 50);
   }
   ```
   boot 场景：763 刚设 viewMode='all'、`s.allData` 若已被填（>0）、新库 color.value==undefined → 三条件全中 → **callback 照常调（cb2 的 selected 恢复逻辑跑）但 reload 永不执行** → listDone=false + colorDistancesMap=undefined + 零异常，**与全部证据吻合**。此快路径来自 c15d 移植（`git log -S` 实锚：314c688 stage-1.5 c15d）。
   **反证待解释**：out5 手动 `s.openAll(true)` 后 listDone=true——说明手动调用**没走快路径**。三条件中唯一可能随时变化的 = `s.allData.length`（快路径要求 >0；若 boot 期 807 时 allData 已有数据而手动时刻反而空，或反过来）与 `color.value`（若 boot 期 color.value 非 undefined 则快路径不中，$timeout 路径照走）。**下一步第一件事就是实测这两个值。**
   注意 `s.allData` 的填充者 `machineryRebindRefresh` 是 **async**（869 行 `export async function`，916 行 `s.allData = data` 在 async 体内）——boot 期 807 调用时 allData 是否已填充取决于前序 async 链是否 resolve，这是典型竞速温床。
2. **openAll 的 $timeout 回调静默死亡（真 Angular $timeout 吞 rejection）**：`getTimeout`（dataMachinery.ts:231-238）**优先返回真 Angular $timeout**（`ang.element(document).injector().get('$timeout')`）——而本应用旧 bundle 是活的（套件 angular-main-app PASS，window.angular 存在）。真 $timeout 的回调异常变成 rejected promise，**静默吞掉、无 console.error**——完美解释"boot 期零异常却链死"。快路径不中时，回调首行 `if (!ignoreHistory) s.UrlStateService.setState(...)`（3357-3359）是 boot 独有路径（手动调用传 true 跳过）——setState 若抛错即在此静默消失。
3. **（降级）$timeout 句柄竞速 / itemMappings 时序 / openAll 挂载时序**：out5 显示函数面全在、无 TypeError、isItemBindCalculated=true（回调已跑），这三条的原始形态基本被证据压制，仅在 1/2 都排除后再回头查。

**调试历史教训（新 AI 必读，避免重蹈）**：上一轮在 dataMachinery.ts 打了 8 处 `[BZDBG]` console.error 埋点，其中 reload 埋点误用了内层 debounce 函数的参数名 `keepDetailMode`（外层不存在）→ boot 期 applyDataMachineryScope 直接 ReferenceError 炸死全链 → 探针看到"零 BZDBG 行"曾误判为 vite 缓存问题。**埋点已全部摘除，树已干净**（`grep -c BZDBG src/app/react/core/dataMachinery.ts` = 0）。**不要再往源码里打埋点**——用非侵入式探针（CDP Runtime.evaluate）从外部驱动和观察。

### 4. 下一步行动（To-Do，按顺序）

1. **定位 boot 链断点（当前唯一任务）**。头号嫌疑 = machineryOpenAll:3339 快路径早退 + 真 $timeout 静默吞异常（见「当前状态与卡点」）。**判别性探针**（非侵入、不碰源码，模板 tests-tmp/bz-a-dbg2.mjs 改造，输出重定向 tests-tmp/*.txt 再 cat）：
   ```js
   // readyState complete + 12s 后：
   const s = window.$bodyScope;
   const t = window.__t = { angular: typeof window.angular,          // 确认真 $timeout 路径
     allDataLen: s.allData ? s.allData.length : 'undefined',          // 快路径条件 2
     colorVal: window.eagle.filter.filterRules.color.value,           // 快路径条件 3
     viewMode: s.viewMode, listDone0: !!s.listDone };
   const oReload = s.reload.bind(s); s.reload = (...a) => { t.reloadCalled = true; return oReload(...a); };
   const oSet = s.UrlStateService.setState.bind(s.UrlStateService);
   s.UrlStateService.setState = (...a) => { t.setStateCalled = true;
     try { return oSet(...a); } catch(e){ t.setStateThrow = String(e && e.stack || e).slice(0,400); throw e; } };
   // 复刻 boot 调用形态（ignoreHistory=undefined，与手动 s.openAll(true) 差分）：
   try { s.openAll(undefined, null); t.bootShape = 'ok'; } catch(e){ t.bootShape = 'THROW ' + String(e).slice(0,300); }
   // 等 1.2s 后读 t：bootShape / setStateCalled / setStateThrow / reloadCalled / listDone
   ```
   判读：`bootShape='ok'` 但 `reloadCalled=false` 且 `listDone` 不变 → **快路径命中**（对照 t 里三条件实测值定位是哪条命中）；`setStateThrow` 有值 → setState 抛错被真 $timeout 吞；`reloadCalled=true` 但 listDone 仍 false → reload 体内部断（再包一层 try 抓栈）。
   - 若确认快路径早退是根因：对照 HEAD（b1-9e 全绿基线）确认该快路径在 bz-A 前的触发条件差异（`git show 9cde463:src/app/react/core/dataMachinery.ts` 对比 3339 区域 + 检查 bz-A 迁走的函数里有没有 boot 期曾填充 allData/color.value 的那一个——**重点怀疑：121 迁移体里有一个 boot 期本来会跑、现在没跑/晚跑的函数**）。
   - 或者对比法：`git stash`（保住当前 bz-A 树）→ 对比 HEAD 同探针 → `git stash pop` 恢复。**注意**：stash/checkout 只对 tracked 文件生效，3 个新落点（lockService/uploadService/viewOpsService）是 untracked，不受影响；更简单的替代：`git diff > tests-tmp/bz-a-tree.patch` 存档后 reset，测完 `git apply` 恢复。
2. **修好后全套件 ALL GREEN**（`node tests/run-react-suite.mjs`，串行跑约 10 分钟，输出重定向到文件再看——直接 `| tail` 会被缓冲吞中间输出）。
3. **正式收官提交（快照已在库）**：交接快照 `540fa6c` 已含手术全量 + PROGRESS.md 快照状态块（插在 bz 定案块之后）。boot 链修复 + 全套件 ALL GREEN 后，**在其之上另起正式收官提交**：`feat(react): b1-9bz-A — <中文摘要>`（格式必须 `feat(react): b1-9X — <中文摘要>`），并先更新 PROGRESS.md bz-A 小节（记录根因与修复）。
4. **开 bz-B**（scopeFace/callScope 直调化）。

### 5. 关键规则与 SOP（雷区，绝对不能踩）

- **不 push / 不 pull / 不 merge**。
- **markdown 段恒跳过，不得为其改业务代码**。
- **禁提交**：tests/probe-*、tests-tmp/、docs/handover-*、.workbuddy/、mock-library、backend 临时补丁。已列 tests/probe-7d2.mjs 为 M 状态——**不要动它**（工作树既有 D/M 文件都不碰：.claude/launch.json、.zcode/plans/plan-sess_*.md、docs/plan.md、tests/probe-7d2.mjs、docs/handover-b1-9d-2026-09-04.md）。
- **提交信息格式**：`feat(react): b1-9X — <中文摘要>`；每提交更新 PROGRESS.md。
- **套件/探针严格串行**——并行抢 CPU 双双挂死的历史教训。
- **探针/长命令输出必须重定向到 tests-tmp/*.txt 再 cat**——`| tail` 管道缓冲会吞掉中间输出，后台任务看不到实时流。
- **改脚本一律用 Edit/Write 工具**——Git Bash heredoc 转义不可靠（`\\` 塌缩、`\n` 变真换行，历史连环坑）。
- **git checkout 不清 untracked**：重放 bz-a-apply.py 前**必须先 rm 三个新落点文件**（lockService/uploadService/viewOpsService），否则上次输出残留在新文件里，top_decls 去重会把它们剥空。
- **dataMachinery.ts 的 import 改写（updateCurrentOrderAndIncrease ← miscDomain、isInFolder ← itemDomain）是 bz-A 合法手术的一部分，不能还原**——不要对 dataMachinery.ts 做 `git checkout --`，会连合法改写一起还原弄坏构建。
- **不要再往源码里打 console 埋点**（BZDBG 教训：埋点本身炸 boot 链且难察觉）；用 CDP Runtime.evaluate 非侵入式观察。
- **探针环境**：`bootStack`（tests/react-cdp-harness.mjs）会起 vite + backend + electron，产物：`stack.page.events` 数组缓冲 Runtime 事件（exceptionThrown/consoleAPICalled/Log.entryAdded）——探针末尾要过滤打印。临时库环境 `fs.mkdtempSync` 全新库、1 张图片（320x200 蓝色 PNG），无 lastFolder → openAll 走 else 分支是正常路径。
- **哨兵基线机制**：`tests/react-rewrite-sentinel.mjs` 对照 `tests/react-rewrite-sentinel-baseline.json`；REGRESSED 致命、DECREASED 提示。bz-A 已吸收新基线。

---

## 二、最近修改内容

| 文件 | 修改 | 目的 |
|---|---|---|
| `src/app/react/core/controllerFns.ts` | 5593 行 → 约 200 行指针注册表：121 个 `fns["NAME"] = 既有落点导出;` 指针 + 6 个 installXxxFns 调用 | bz-A 核心：148 表体归位，callScope/scope 函数面零行为变化；bz-B 摘双面后本文件退役，bz-C 删除 |
| `src/app/react/core/filterDomain.ts` (+858)、`itemDomain.ts` (+567)、`miscDomain.ts` (+469) | 接收归位函数体（export function NAME(...args) 形态） | 表体迁入 core 域 |
| `src/app/react/services/folderCoreService.ts` (+397)、`selectionService.ts` (+359)、`sidebarService.ts` (+356)、`mediaService.ts` (+228)、`imageOpsService.ts` (+188)、`itemMenuService.ts` (+9) | 同上，迁入 services 域 | 表体迁入 services 域 |
| `src/app/react/services/lockService.ts`、`uploadService.ts`、`viewOpsService.ts`（**新建，untracked**） | 新落点，接收 lock/upload/viewOps 族函数体 | bz-a-map.py 的落点规划 |
| `src/app/react/core/dataMachinery.ts` | 仅 2 行 import 改写：`updateCurrentOrderAndIncrease` ← `./miscDomain`、`isInFolder` ← `./itemDomain` | 摘除对 controllerFns 的函数体依赖（表体已迁走） |
| `src/app/react/core/libraryDomain.ts` | 仅 1 行 import 改写：`isInFolder` ← `./itemDomain` | 同上 |
| `tests/react-stage1c3-smoke.mjs` | 计数断言 263 → 236 | 指针表后 makeControllerFns 返回 236 键 |
| `tests/react-rewrite-sentinel-baseline.json` | 基线吸收（evalAsync 385/apply 16/broadcast 122/rootAccess 464/getBodyScope 708/lodashBare 20） | bz-A 机械改名（getScope→别名等）带来的合法增长 |

归位形态（重要）：表体统一改写为 `export function NAME(...args: any[]) { try { initLinkVars(); } catch (err) {} const s = getScope(); if (!s) return; return (function(REAL_PARAMS){...}).apply(null, args); }`——头行从 `fns["name"] = function (` 改 `export function NAME(...args: any[]) {`、尾 `};` 改 `}`；getScope 保留（每个落点头部补 `const getScope = getBodyScope;` 别名 + import），函数体内部零改写。

27 个删除项（DEL_SET）名单见 `tests-tmp/bz-a-map.py`：clickSmartNode + 21 双键死体（calculateFilterCounts/endHandler/getSelection/gotoBottom/homeHandler/mHandler/nextGifFrame/prevGifFrame/saveFolder/selectDown/selectNext/selectPrev/selectUp/toggleAll/toggleAllFolders/toggleCurrentLevelSmartFolders/toggleZoom/updateContainerHieght/zoomActual/zoomFitEdge/zoomOut——machinery 版本覆盖 scope 面，表体是死代码）+ 5 净死壳（dblclickSidebarFolder/getExifRawPath/preventMiddleClick/toggleGifPlayerMode/toggleRatioContextMenu——全树无调用面）。

POINTER_EXISTING 4 个（clickNode/toggleFolderExpand/toggleSmartFolderExpand/updateSidebarList）：sidebarService 已有同名 machinery 背书导出 → c3 体不迁，表项直接指既有导出（machinery 版本本就覆盖 scope 面，零行为变化）。

---

## 三、当前代码状态（架构与数据流）

### boot 链（理解卡点的核心）

`main.tsx`（bridgeWhenReady，main.tsx:225-250）：
```
installBundleGlobals()          ← bundleGlobals.ts（w.eagle 工具面、w.UrlStateService@1482-1513、w.preferences 等）
installApiServerGlobals()
exposeScopeShimDiagnostics()
bridgeWhenReady()
  └ scope 就绪后：
     attachCoreFnsToShim(scope)   ← shimFnsBridge：controllerFns 指针表 if-absent 上 shim（bundle 缺席时的函数面供给第一层）
     applyDataMachineryScope()    ← dataMachinery:11126——双面双体的 machinery 面：machinerySeedControllerState（状态种子，10783 s.itemMappings={} 等）+ s.calculateImageBinding/s.reload(=machineryReload(s) 防抖实例)/s.openAll/s.resetPage 等 230+ 挂载（**覆盖** attachCoreFnsToShim 挂的同名表项——43 双键单源化是 bz-B/C 的事）
     takeoverLibraryDomain()      ← libraryDomain.ts——库装载（library.load → s.raw 填充 → syncListFromScope）→ 762 s.calculateImageBinding({}, cb) → cb 内 viewMode 分支 → 807 s.openAll → openAll 内 $timeout(fn, 50) → s.reload() → reload 防抖体（1166 行）`s.listDone = true` → 网格渲染
     takeoverItemDomain/FilterDomain/SelectionViewDomain/MiscDomain()
```

**断点症状**：takeoverLibraryDomain 的 calculateImageBinding 回调里 `isItemBindCalculated=true`（764 已过）但 `listDone=false`——中间 807 `s.openAll(...)` 没生效。手动补一调 `s.openAll(true)` 全链恢复（out5 铁证）。

### 双面双体（bz 批要消灭的架构）

- **表体面**（controllerFns 指针表 → bz-A 后只剩指针）：callScope 路由（hooks.ts）优先命中本表。
- **machinery 面**（dataMachinery 241 导出）：applyDataMachineryScope 挂到 scope，**后挂覆盖先挂**——43 个双键（既在表又在 machinery）实际 scope 面用的是 machinery 版本。
- boot 顺序 attachCoreFnsToShim 先挂表 → applyDataMachineryScope 后挂 machinery wrapper 覆盖双键。
- bz-B 摘 callScope/attach 双面 + 43 双键单源化；bz-C machinery 241 导出归位并删 dataMachinery。

### 归位后的函数形态（bz-A 的手术产物）

每个迁入落点的函数都是自足的：头部 `const getScope = getBodyScope;`（别名，体零改写）+ `try { initLinkVars(); } catch {}` 守卫 + `const s = getScope(); if (!s) return;` + 原体 `.apply(null, args)`。跨函数共享的防抖句柄/initLinkVars 变量随族迁移（debounce/setLastFolder chunk 由 bz-a-apply.py 保证依赖完整）。

### listDone 数据流（卡点核心链）

```
libraryDomain.ts:762  s.calculateImageBinding({}, cb)
  └ machineryCalculateImageBinding (dataMachinery.ts:420)
      └ $timeout(fn, duration)  duration=1 或 50（句柄竞速逻辑 422-427）
          └ fn 末尾 ~705: if (callback) callback()
              └ cb: 763 viewMode 设置 → 764 isItemBindCalculated=true
                  └ viewMode=="all" → 807 s.openAll(undefined, cb2)
                      └ machineryOpenAll (dataMachinery.ts:3335)
                          ├ 【快路径 3339-3347】viewMode=='all' && allData.length>0 && color.value==undefined
                          │    → callback() 后 return —— 不调 reload！listDone 永不置位（头号嫌疑）
                          └ 【常规路径】s.resetPage() (3353) → $timeout(fn, 50) (3356)
                              └ fn: UrlStateService.setState (3358, 仅 !ignoreHistory) + s.reload() (3374)
                                  └ machineryReload 防抖实例 (11200 挂载, 1135 定义)
                                      └ reload 体 1166: s.listDone = true
                                          └ → 网格渲染 #box-list .box
```

关键供给（全部已实锚存在）：
- `s.openAll` 挂载：dataMachinery.ts:11238（applyDataMachineryScope 内）
- `s.resetPage` 挂载：dataMachinery.ts:11235
- `s.reload = machineryReload(s)`（防抖实例）：dataMachinery.ts:11200
- `w.UrlStateService`：bundleGlobals.ts:1513（main.tsx:246 installBundleGlobals 在 bridgeWhenReady 之前）
- `s.preferences`/`s.UrlStateService`：applyDataMachineryScope 内 if-absent 补种（11158-11162）
- shim $timeout：dataMachinery.ts:231-265（getTimeout——Angular 缺席时返回 shimTimeoutInst，**有 try/catch 会打 `[shimTimeout] fn failed`**）

### 测试基建

- 套件跑法：`node tests/run-react-suite.mjs`（55 项，串行，约 10 分钟）。
- 探针模板：`tests-tmp/bz-a-dbg.mjs`（boot + 事件缓冲异常收集 + fnFace dump）、`tests-tmp/bz-a-dbg2.mjs`（boot + pipeline 状态 + 手动 openAll 驱动 + 分步链测试）。
- 关键单测断言：`tests/react-stage-smoke.mjs:336` b1-9ad-colorfilter-pipeline（colorDistancesMap['b1-9ad-match'] === 0.01 等四态断言——依赖 boot 期 colorDistancesMap 已播种，播种在 machineryCalcuteFilterResult dataMachinery.ts:2529 `s.colorDistancesMap = {}`，由 reload → rebindRefresh 链触发）。
- 哨兵：`tests/react-rewrite-sentinel.mjs` + `tests/react-rewrite-sentinel-baseline.json`。

---

## 四、重要代码 / 命令

```bash
# 全套件（串行！输出重定向到文件再看）
node tests/run-react-suite.mjs > tests-tmp/<name>.log 2>&1

# boot 探针（函数面健康检查）
node tests-tmp/bz-a-dbg.mjs > tests-tmp/bz-a-dbg-out10.txt 2>&1

# colorFilter/链路探针（含手动 openAll 驱动）——当前最有用的探针
node tests-tmp/bz-a-dbg2.mjs > tests-tmp/bz-a-dbg2-out6.txt 2>&1

# 哨兵
node tests/react-rewrite-sentinel.mjs

# 快速语法/绑定检查（vite dev 下用 esbuild 检查双入口）
# 注意：直接 esbuild main.tsx 会因 node 内建模块报错（app-root-path 需要 --platform=node），
# 历史上"双入口 0 错"用的是 vite dev 环境的实际编译；跑 bz-a-apply.py 内置检查或起 vite 看编译日志
```

探针数据文件（已存在的实测输出，直接读）：
- `tests-tmp/bz-a-suite2.log` —— 最近一次全套件 35/55 失败的完整列表
- `tests-tmp/bz-a-dbg2-out5.txt` —— **最关键的干净树探针**（手动 openAll 恢复全链的铁证）
- `tests-tmp/bz-a-dbg-out5/6/7/9.txt` —— boot 健康探针系列（out9 含 keepDetailMode 炸链的现场，历史教训存档）
- `tests-tmp/bz-inventory.json` —— bz 考据全图谱（148 壳/43 双键/241 导出/消费面）

工作树（git status，**提交后状态**）：
- tracked 的 bz-A 文件全部 clean（手术态已随 `540fa6c` 入库）；boot 链修复改动的文件会重新出现为 M
- 既有 D/M（.claude/launch.json、.zcode/plans/plan-sess_*.md、docs/plan.md、docs/handover-b1-9d-2026-09-04.md、tests/probe-7d2.mjs）——**不碰、不提交**
- untracked docs/handover-*.md（**含本交接文档**）、.workbuddy/、tests-tmp/、tests/probe-* ——**不提交**

手术脚本重放（仅当需要从 9cde463 重来时；一般不需要——快照 `540fa6c` 已保存手术态，`git checkout 540fa6c -- src/app/react/` 即可恢复）：
```bash
git checkout 9cde463 -- src/app/react/ && git clean -f src/app/react/services/lockService.ts src/app/react/services/uploadService.ts src/app/react/services/viewOpsService.ts
python tests-tmp/bz-a-surgery.py   # 预分析 → bz-a-need.json
python tests-tmp/bz-a-apply.py     # 手术主体（自带 NEW_FILES 处理）
python tests-tmp/bz-a-audit.py     # DELTA 审计
```
（注意：bz-a-map.py / bz-a-surgery.py / bz-a-apply.py 当前内容即对应快照提交中的手术状态，无需重跑除非重放。）

---

## 五、重要要求（自检清单）

- 本文档所有行号、探针输出、挂测名单均为实测（行号/数据基于 9cde463 + bz-A 手术态 = 快照 `540fa6c` 内容；git 状态部分已更新至提交后）。
- **未定论项已明确标注**：两个头号嫌疑——①machineryOpenAll:3339 快路径早退（三条件全中则 return，reload 永不执行；**未证实**，判别探针见「下一步行动」1）；②真 Angular $timeout 静默吞 rejection（boot 期零异常的解释通道）。新 AI 的第一件事就是用判别探针证实或排除。
- 已排除项（不要重查）：vite 缓存（BZDBG 消失的真正原因是埋点自身 ReferenceError）；openAll/reload/colorFilter/UrlStateService 函数面缺失（out5 全 function）；b1-9ad 管线坏（手动 openAll 后 0.01 命中）；"回调 762 没跑"（isItemBindCalculated=true，写点全 src 只有 libraryDomain:425=false / 764=true 两处，764 已执行）。
- 唯一未完成的工作 = 定位并修复 boot 链断点 → 全套件 ALL GREEN → 正式收官提交（快照 `540fa6c` 之上）→ 开 bz-B。
- 冲突信息处理：以本文件 + 最新探针数据（bz-a-dbg2-out5.txt）为准。
```

（文档完）
