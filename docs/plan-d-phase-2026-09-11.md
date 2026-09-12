# D 阶段任务规划（D-1 ~ D-4）

> 生成时间：2026-09-11
> 工作目录：`H:\dev\Eagle-Sec-development - 副本`
> 当前 HEAD：`aea43af`
> 依据：`docs/handover-b1-9bz-D-2026-09-11.md`、`src/app/react/PROGRESS.md`（D-1/D 排期）、
> `src/app/react/REWRITE-PLAN.md` 四、收尾 DoD（实测数字以代码为准，见各节「现状核数」）。

---

## 0. 总览与执行原则

| 阶段 | 目标 | 依赖 | 预估会话数 | 收官判据 |
|---|---|---|---|---|
| **D-1** | `dataMachinery.ts` 归位（挂载面清零 + 函数体按域搬回、文件消失） | C-0~C-6 | **多会话**（见 1.3 拆分） | `dataMachinery.ts` 删除 + `grep-zero` |
| **D-2** | jQuery 清零 + vendor 清零（含 `frontend/public/shims.js` 退役） | D-1（jQuery 主战场在 dataMachinery） | 1 | 全树无 `$(` / `w.$(`；jQuery vendor 脚本与 css 摘除 |
| **D-3** | 测试套件 55 → **65+** 全绿 | 可与 D-1/D-2 并行 | 1 | `run-react-suite` ≥65 全绿 |
| **D-4** | 收官文档 + REWRITE-PLAN 归档 + DoD 六项核对 | D-1~D-3 全部 | 1 | DoD 逐条打勾 |

**执行原则**
1. **每次会话解决一个「阶段」**；D-1 体量过大（11673 行 / 247 导出），内部再切成
   **工作单元**，每个工作单元 = 一次会话，一次会话内可含多个提交（一批一提交）。
2. 每批固定节奏：**改写 → `probe-b5-load` → 定向测试 →（必要时）改契约 → 提交**。
3. 门禁：`PROBE_RESULT LOAD_OK allData=1` + 定向测试全绿 + `bz-export-check.py` 无问题；
   收官批 + 危险批跑全量套件 + 哨兵。
4. 雷区沿用交接文档 5.1：不机械改名、删挂载前查 8 类存活面、不动 `scopeShim`/`coreState`、
   不改写入点直调、改名前先 `grep -rn "<名>" tests/`。
5. 环境注意：本机 Git Bash **无 `pkill`**，清理残留改用 Windows 命令（`taskkill //F //IM node.exe`
   或按 PID）；不要盲目全杀，先确认无用户进程。

---

## 1. D-1：dataMachinery 归位

### 1.1 目标拆成两半

| half | 内容 | 现状核数 |
|---|---|---|
| **A 挂载面退役** | 消除 `s.xxx = (...) => machineryYyy(s, ...)` 与 `s.xxx = machineryYyy(s)` | 实测 **67** 个（`grep` 逐个数出，与交接文档一致） |
| **B 函数体归位** | 247 个导出按域搬回 `core/*Domain.ts` / `services/*.ts`，`dataMachinery.ts` 消失 | **未开始**；文件 **11672 行**，被 47 文件引用 |

> 注：`tests-tmp/bz-d1-rest.py` 报「剩余挂载 411」含 344 个 `single`（`s.raw.sort(...)`、
> `s.all = []` 等普通赋值），**非** D-1 目标；D-1 目标就是那 67 个箭头/调用式 machinery 挂载。

### 1.2 Track A：挂载面清零（5 个工作单元，每个 = 一次会话）

| 单元 | 内容 | 解锁量 | 关键文件 / 坑 |
|---|---|---|---|
| **A-1** | `call`/`callSeq` 支持**函数引用** | ~26（字符串动态调用类） | `Toolbar.tsx:33/40` **已支持** `typeof fn==='function'`；缺口在 `Sidebar.tsx:39/46/52` 的 `call`/`callWithNode`/`stopAndCall`（纯字符串）。扩这三个 helper → 调用点改 `call('openUnfiled')` 为 `call(machineryOpenUnfiled)` → 删挂载 |
| **A-2** | 重新设计**契约锚定**断言 | ~19 | `m1-D-rebind-broadcast` 的 **spy `s.rebindRefresh`** 改效果断言；`m1-A3-c9-machinery`（:176-187）15 名字名单 + `typeof s.*` 改「已 import 直调」断言；隐藏别名 `m1-A8-relayout` / `m1-A9-smart-filter` / stage5 `detail-*`。**先改测试，再改源码** |
| **A-3** | **裸引用 / 谓词传递** | ~9 | 如 `keepItems.filter(getBodyScope().contentFilter)`（谓词需包 `(x) => machineryContentFilter(s, x)`）、`s.zoomFit` 作值传递。试改 `contentFilter`+`calculateFilterCounts` 曾 LOAD_BROKEN，须逐名查清真实使用面 |
| **A-4** | **单例 debounce** 提取 getter | 2+ | `s.reload = machineryReload(s)` / `s.offsetScrollbar = machineryOffsetScrollbar(s)` 右侧**会执行**；直调前先做 `getReloadFn(s)` 内部缓存，否则防抖失效 |
| **A-5** | 挂载面**收尾审计** | 余量 | 确认 67→0；`grep` 八类存活面复查；`probe` + 全量套件 + 哨兵 |

> 各单元阻塞有交叠（一个挂载可同时是 `str-dyn`+`contract`+`ext-call`），按「先解锁机制、
> 再清名」推进；A-1 完成后复跑 `bz-d1-rest.py` 重算余量，动态调整后续单元。

### 1.3 Track B：函数体归位（1 个分析单元 + N 个域批次）

| 单元 | 内容 | 产出 |
|---|---|---|
| **B-0** | 建**映射表**：247 导出 → 目标域/文件（`selectionViewDomain` / `itemDomain` / `tagManagerDomain` / `miscDomain` / `libraryDomain` / `filterDomain` / `services/*`）+ 每个函数的依赖闭包（私有 helper、模块级变量） | `docs/` 映射表文档（后续批次的施工图），**不改代码** |
| **B-1 … B-k** | 每批搬**一个域簇**（函数体 + 其内部 helper + 模块级变量），改写 47 个引用文件的 import，删 `dataMachinery` 内对应导出；行数递减 | 每批一个提交 |
| **B-final** | `dataMachinery.ts` 删除 + `grep-zero` + 哨兵扩面（禁 `dataMachinery` 引用） | 阶段收官 |

**排序建议**（按依赖自底向上，避免循环）：
`selectionViewDomain` → `itemDomain` → `tagManagerDomain` → `filterDomain` → `libraryDomain`
→ `miscDomain` → `services/*` → 尾部落单函数。
> 具体切分以 B-0 映射表为准；单批不宜过大（经验：≤ ~30 个导出 / ≤ ~1500 行），
> 且每批必须 probe + 定向测试。

---

## 2. D-2：jQuery + vendor + shims 清零

**现状核数（实测）**
- `w.$(...)` 调用点 **283** 处：`dataMachinery.ts` 172、`tagManagerDomain.ts` 60、
  `gridService.ts` 15、`bundleGlobals.ts` 13、`detailService.ts` 11、`selectionViewDomain.ts` 6 …。
  （D-1 Track B 完成后，最大头 172 处随 dataMachinery 一并消失。）
- `index.html` 仍加载：`js/vendors/jquery-1.8.0.min.js`、`js/vendors/jquery-ui.min.js`，
  及 `<link>` `css/jquery-ui.min.css`。
- `frontend/public/shims.js`（159656 字节）仍在。

**任务**
1. 逐文件把 `w.$(...)` 迁移到原生 DOM / React ref / 自研服务（按 D-1 Track B 的域批次顺带做，
   或 D-2 集中做，取更省的那条）。
2. 摘除 `index.html` 的 jQuery 家族 script + `jquery-ui.min.css`；`git rm` 对应 vendor 文件。
3. 退役 `frontend/public/shims.js`（先全树 grep 其供给面，确认无对端）。
4. 评估 DoD 3 名单中仍有对端者（lodash 等），留任必须在 PROGRESS 记录理由。
5. 门禁：全树 `$(`/`w.$(` grep-zero（哨兵白名单外）+ `run-react-suite` 全绿 + 哨兵。

---

## 3. D-3：套件 55 → 65+

**现状核数**：`tests/run-react-suite.mjs` = **55** 项（实测）。目标 **≥65**，差 **+10**。

**任务**
1. 盘点 55 项覆盖矩阵，找出未覆盖的竖切关键交互（对照 REWRITE-PLAN 四、DoD 4「每竖切 ≥1 闭环项」）。
2. 补 10 个 UI 闭环项（形式沿用 `tests/*-closed-loop.mjs`：真实点击/输入/断言 + 截图）。
3. 每加 1 项即纳入套件并跑绿；避免长时间不跑导致套件漂移。
4. 门禁：`REACT SUITE ALL GREEN` 且项数 ≥65。

---

## 4. D-4：收官文档 + 归档

**任务**
1. `PROGRESS.md` 终章：架构前后对照（Angular bundle → React+zustand+eagleBus）+ **已知行为差异清单**。
2. `REWRITE-PLAN.md` 归档（标注已达成 / 留任项及其理由）。
3. 对照 DoD 六项逐条核对并打勾：
   ① 六项删除 grep-zero（scopeShim/scopeBridge/shimFnsBridge/controllerFns/dataMachinery/appCore.coreState）
   ② 永久哨兵（无 Angular 语义与 jQuery；eagleBus 唯一事件通道）
   ③ index.html vendor 清零
   ④ 套件 ≥65 全绿
   ⑤ 收官文档
4. 门禁：全套 + 哨兵 + `grep-zero` 复核。

---

## 5. 建议启动顺序

```
D-1/A-1（call 机制函数引用化）→ A-2 → A-3 → A-4 → A-5
   ↓（挂载面归零后）
D-1/B-0（映射表）→ B-1 … B-k → B-final
   ↓
D-2 → D-3 → D-4
```
> D-3 可与 D-1/D-2 并行；若严格「一会话一阶段」，则按上序串行。
> 下一步建议：**D-1 / Track A / 单元 A-1**。
