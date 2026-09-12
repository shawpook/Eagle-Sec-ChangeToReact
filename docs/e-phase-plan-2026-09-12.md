# E 阶段规划：`$bodyScope` / `scopeShim` / `coreState` 退役（DoD ①、②）

> **E4 收官更新（2026-09-12 夜）**：**DoD ① 已达标** —— `global/scopeShim.ts` 已删除、
> `appCore.coreState` 已删除（哨兵 `coreState 13 → 0`）。scope 面改为 `core/scopeFace.ts`
> 的**显式 store 后端**（注册字段 `Object.defineProperty` 直连 store；无 Proxy、无 coreState）。
> 哨兵：`getBodyScope 793 → 15`（-98%）、`rootAccess 367 → 1`、`coreState 0`、
> `watch/watchCollection/on/broadcast/apply = 0`、`jQuery/vendorScriptTags = 0`。
> 剩余 15 处 `getBodyScope()` 与逐条原因见 `src/app/react/PROGRESS.md`《E4：删壳》节——
> 全部为 **E5 前置**（`appCore` 定义处、`fileUrlHelper` 子窗硬排除、`machineryInfra` 跨窗/驱动
> 供给、`main.tsx` 就绪门、`boxGridEngine` 的 `window.$bodyScope` 兜底、`preview-window`
> 自有面）。**下一步 E5**：迁移 `electron/main.cjs`、`frontend/public/shims.js` 与
> `$evalAsync` 提交钩子 → `$bodyScope` 不再作为运行时对象存在（DoD ② 收口）。

> 生成时间：2026-09-12　工作目录：`H:\dev\Eagle-Sec-development - 副本`　分支：`react-in-place`
> 起点 HEAD：`aa173cb`（D 阶段收官，全套 65/65 `REACT SUITE ALL GREEN`）
> 依据：`docs/d-phase-closing-2026-09-11.md` §3「① 为何未达 + 剩余路线」、`src/app/react/PROGRESS.md` 终章、
> `src/app/react/REWRITE-PLAN.md`（归档横幅）、`tests/react-rewrite-sentinel.mjs` 基线。
>
> **本文件是设计/施工图，不改变代码。** 执行按 §5 竖切批次推进，每批一次提交。
>
> **E3 收官更新（2026-09-12 晚，HEAD `507df65b`）**：§0 判据表的「现状」列已被 E3 批次大幅推进 ——
> `getBodyScope 793 → 79`（-90%）、`rootAccess 367 → 7`（-98%）、`scopeApply 200 → 16`、
> `watch/on/broadcast/apply = 0`、`jQuery/vendorScriptTags = 0`、`coreState 13`。
> E3 的 11 个批次（E3-4…E3-14）与剩余 79 处的逐条阻塞原因见
> `src/app/react/PROGRESS.md`《E3-4…E3-14 收官》节。剩余项均为 **E4/E5 前置**
> （`main.cjs`/`shims.js` 的 scope 面消费、`mousetrap` 门桩种子、`fileUrlHelper` 子窗硬排除、
> `appCore` 定义处、动态元素访问/`$root` 作值），不再是「读点改写」能消的。

---

## 0. 目标与判据

| 判据 | 现状 | 目标 |
|---|---|---|
| DoD ① 六项删除 grep-zero | `scopeShim.ts` 文件仍存（51 文件 import）、`appCore.coreState` 仍存 | 两文件面归零（文件不存在 / 无引用） |
| DoD ② 哨兵 Angular-ism 归零 | `getBodyScope 793`、`scopeApply 200`、`watch 19`、`on 26`、`broadcast 4`、`evalAsync 6`、`apply 2`、`watchCollection 6`、`rootAccess 367`、`coreState 31`；`jQuery 0`✅、`vendorScriptTags 0`✅ | 上列全部 → 0，基线棘轮锁定 |
| D-2 遗留 | `frontend/public/shims.js`（3996 行）仍存 | 随 ① 退役并删除 |

**总原则**（沿用项目级雷区）：**不整体删除** `scopeShim`/`coreState`；不机械改名 `X.$xxx()`；
每批必须 `tsc` 零新增 + `probe` + 定向闭环 + 哨兵不增；大项收官才跑全套。
`scopeApply` 的 `$$phase` 分叉有 C-3 实测行为约束（见 §4.4），不得直调化糊过去。

---

## 1. 现状核数（2026-09-12，sentinel 实测）

```
evalAsync          6        getBodyScope     793
apply              2        jQuery             0
watch             19        rootAccess       367
watchCollection    6        coreState         31
broadcast          4        lodashBare        10
on                26        vendorScriptTags   0
scopeApply       200        callScope          0
```

`getBodyScope()` 调用点按文件（前 15）：

| 文件 | 处数 | | 文件 | 处数 |
|---|---:|---|---|---:|
| `components/inspector/inspectorActions.ts` | 53 | | `core/selectionViewDomain.ts` | 26 |
| `components/detail/detailHooks.ts` | 47 | | `components/detail/commentHooks.ts` | 24 |
| `services/folderMenuService.ts` | 45 | | `services/batchOpsService.ts` | 22 |
| `core/miscDomain.ts` | 42 | | `services/imageOpsService.ts` | 21 |
| `components/sidebar/Sidebar.tsx` | 41 | | `services/viewOpsService.ts` | 19 |
| `core/apiServerDomain.ts` | 36 | | `components/toolbar/Toolbar.tsx` | 16 |
| `components/inspector/Inspector.tsx` | 34 | | `services/fontTagService.ts` | 14 |
| | | | `core/filterDomain.ts` | 14 |

**顶层属性访问面**（`getBodyScope().X` 静态提取，去重后 <100 个名字，头部集中）：
`current(19)`、`selected(15)`、`pluginModule(15)`、`currentSmartFolder(14)`、`allData(14)`、
`modifiedMappings(9)`、`currentFolder(7)`、`viewMode(6)`、`$root(6)`、`isDetailMode(5)`、
`folderMappings(5)`、`TagManager(5)`、`keywordSuggestions(4)`、`sortIncrease(3)`、
`libraryImagesPath(3)`、`keyword*`(≈12)、`globalKeywords(3)`、`currentTag(2)`、`eagle(2)`……
→ 字段面是**可枚举的有限集**，不是开放面；这是 E 阶段可行的关键前提。

**已有状态基建**：`src/app/react/store/` 13 个 zustand store
（`body/list/filter/inspector/detail/lock/toast/panel/sidebar/tagManager/toolbar/upload/appState`）。
其中**仅 4 个**已做「源翻转」注册（`migrateScopeFieldToStore`）：`bodyState`（22 字段）、
`listState`、`lockState`（`isAppLocked`）、`toastState`。其余 store 由快照组件
（`startScopeSync`/`BodyBindings` 等）单向填充，scope 仍是真身。

---

## 2. 目标架构（终态）

| 面 | 现状（过渡态） | 终态 |
|---|---|---|
| **状态真身** | `coreState`（`Record<string,any>`）+ shim Proxy | 各 zustand store；scope 对象不存在 |
| **读取** | `getBodyScope().X`（793 处） | `useXState.getState().X` / React 选择器 |
| **写入** | `scope.X = v`（经 shim Proxy set → coreState） | `useXState.setState({X:v})` |
| **变更通知** | `$evalAsync/$apply` → flushWatchers + 200ms 轮询 | store 订阅触发 React 重渲染 |
| **函数面** | `getBodyScope().fn(...)` | 直接 `import { fn }` 调用 |
| **事件** | `$on/$broadcast/$emit`（shim `__bus`）+ `eagleBus` 并存 | `eagleBus` 唯一通道 |
| **`$root.*`** | shim `$root` 自指 → coreState 的 `preferences.*` 等 | `usePreferencesStore` 等 |

---

## 3. 关键设计决策（施工前必须定死）

### 3.1 字段 → store 归属表
以 §1 顶层名清单为准，逐名指定：`字段 → store.字段`；无归属者新建 store 或并入既有
（如 `pluginModule`、`currentSmartFolder`、`allData`、`folderMappings`、`modifiedMappings`
需先定归属——这批是 `itemDomain`/`libraryDomain` 的镜像缓存，倾向新建 `itemCacheStore`）。
**产出物**：`docs/e1-scope-field-map.md`（对应 D-1 的 `d1-b0-mapping.md`）。

> ⚠️ **别名障碍（2026-09-12 实测，施工前必读）**：`getBodyScope().X` 直链只暴露 **60 个**
> 顶层名，但 `getBodyScope()` 共 **793** 处——多数是「取回 scope 存进变量再访问」
> （`const s = getBodyScope(); s.current…` / `const scope = …; scope.selected…`）或作首参传递。
> 因此**直接名清单 ≠ 真实访问面**。施工前必须先做**别名感知的访问面提取器**
> （对应 D-1 的 `bz-d1-rest.py`/B-0 映射工具）：定位所有 `getBodyScope()` 的赋值目标
> （`const/let/var X = …`、函数首参、解构）→ 追踪其后 `X.<prop>` 访问 → 汇总真实字段面与
> 调用点清单。**没有这张真实清单，§4 的 S/C 批次切不准。**

### 3.1b store 形态分两类（决定字段能否「注册式源翻转」）
- **扁平标量 store**：`bodyState/listState/lockState/toastState/uploadState/appState`（顶层平铺字段）
  —— 可用既有 `migrateScopeFieldToStore` 逐字段源翻转（现共注册 **33** 个字段）。
- **快照 store**：`inspector/detail/filter/panel/sidebar/tagManager/toolbar` 均为
  `create<{ snapshot: XSnapshot }>` —— 只服务 React 只读消费，scope 仍是写入真身，
  由同步函数产快照。这类字段（`inspector.*`、`TagManager`、`eagle.*` 等）**不能直接注册**：
  要么把标量子字段拆成扁平 store（§3.2(a)），要么改快照为真身并改写全部写入点。
  → §4 批次必须按 store 形态分别设计，S-1 不能照搬 bodyState 模式。

### 3.2 嵌套路径（`inspector.*` / `preferences.*` / `containerSize.*` / `currentFolder.*`）
`migrateScopeFieldToStore` 只拦顶层 get/set；两段式访问 `scope.inspector.newName` 需
**store 持有稳定对象引用**（对象原地 mutate → 但 zustand 要求不可变更新触发订阅，二者冲突）。
决策二选一，按组评估：
- **(a) 拆平**：`inspector.newName` → `inspectorState.newName`（推荐，与 bodyState 既有模式一致，
  订阅可靠）；读写点机械映射。
- **(b) 子 store + 代理对象**：store 值是 Proxy，写入走 `setState`（复杂，仅当拆平会爆炸时用）。
> `inspector.*` 是首个嵌套组，用它验证 (a) 的改写成本；若可控则全线 (a)。

### 3.3 「源翻转」与「调用点改写」是两件事
- **源翻转**（`migrateScopeFieldToStore`）：让 store 成为真身，但 `getBodyScope().X` 调用点**不变**
  → **不减少哨兵计数**，只是把 shim 内部后端从 coreState 换成 store。
- **调用点改写**：`getBodyScope().X` → `useX.getState().X` → **直接减少 `getBodyScope` 计数**。
- 退役 shim 要求两者都完成（全部字段翻转 + 全部调用点改写）。
**排序**：先按组源翻转（低风险、打地基）→ 再按文件改写调用点（见 §5 两条轨道）。

### 3.4 函数面与 `SCOPED_HANDLER`
`core/appCore.ts` 的 `SCOPED_HANDLER`/`scoped()`（D-1 A-1 引入，供动态分发传 `(s, ...)` handler）
在 shim 退役后失去意义；函数面改写批次负责收敛该符号与 `call/callSeq/scopeFn` 的 scope 首参逻辑。

### 3.5 `scopeApply` 的 `$$phase` 语义（勿糊）
`core/appCore.ts:221`：C-3 实测「去掉 `$$phase` 分叉与 `$apply` 间接 → stage-smoke theme switch
稳定失败」，原因是原版在 `scope` 无 `$apply` 时**抛错被 catch、`fn` 不执行**，直调则执行。
终态处置：把 200 个调用点按「其实需要执行 fn」的语义逐个确认，改成
`flushScopeWatchers()` + 直调（或 store 订阅），**并同步更新/替换 stage-smoke 的 theme switch 断言**，
不能用一个 polyfill 掩盖行为差异。

---

## 4. 竖切批次（轨道 S：状态翻转 / 轨道 C：调用点改写）

> 每批 ≤ ~30 文件，独立提交。轨 S 与轨 C 可交错，但同一字段组「先 S 后 C」。

### 轨道 S（源翻转，打地基；不改哨兵计数但为 C 铺路）
| 批 | 字段组 | 落点 | 验证 |
|---|---|---|---|
| **S-1** | **（已排除为 no-op，见 §7；改为）**真实被 scope 访问的标量字段首批：`role/scalars in body/list/filter` 中经 §3.1 提取器确认有 `scope.X` 读写的那些（如 `sortIncrease`/`orderBy`/`isEnglish`/`hsks`/`libraryImagesPath`/`rootDir`/`libraryPath`/`searchIndex`/`isContainAlphabet`/`historySearchKeywords`/`uploadQueue`） | 归属扁平 store / 新建 `appState` 扩展 | 哨兵不增；`probe` + 对应闭环 |
| **S-2** | `inspector.*` 拆平（§3.2(a) 试点） | `store/inspectorState.ts` | `main-ui-workflow` + `d3-selection` |
| **S-3** | `listState` 余量（`current/selected/allData/orderBy/sortIncrease`） | `store/listState.ts` | `d3-selection`/`d3-focus` |
| **S-4** | `filterState`（`keyword*/isKeyword*/globalKeywords/showSuggestions/keywordSuggestions`） | `store/filterState.ts` | `menu-popup`/`d3-search-empty` |
| **S-5** | `detailState`（`isDetailMode` 已迁；`isCommentMode` 等余量） | `store/detailState.ts` | `d3-detail-mode` |
| **S-6** | `currentFolder.*` / `containerSize.*` / `preferences.*` | 新 `folderState`/`layoutState` + 既有 preferences | `d3-*-view` 全组 |
| **S-7** | `eagle.*` / `TagManager` / `pluginModule` / `currentSmartFolder` / `folderMappings` / `modifiedMappings` | 归属表定（§3.1） | 采集/插件/标签闭环 |

### 轨道 C（调用点改写，直接压哨兵计数；按文件自上而下）
| 批 | 文件（按 §1 密集度） | 手法 |
|---|---|---|
| **C-1** | `inspectorActions.ts`(53) `detailHooks.ts`(47) | `getBodyScope().X` → store；函数面 → import |
| **C-2** | `folderMenuService.ts`(45) `miscDomain.ts`(42) `Sidebar.tsx`(41) | 同上 |
| **C-3** | `apiServerDomain.ts`(36) `Inspector.tsx`(34) `selectionViewDomain.ts`(26) | 同上 |
| **C-4** | `commentHooks.ts`(24) `batchOpsService.ts`(22) `imageOpsService.ts`(21) | 同上 |
| **C-5** | `viewOpsService.ts`(19) `Toolbar.tsx`(16) `ProgressDialogs.tsx`(15) `fontTagService.ts`(14) `folderCoreService.ts`(14) `filterDomain.ts`(14) | 同上 |
| **C-6** | 余下 20+ 文件（各 ≤13） | 同上 |
| **C-7** | `$root`/`rootAccess` 专批：`getRootScope().preferences.*` → preferences store | 压 `rootAccess 367→0` |

### 收口批
| 批 | 内容 |
|---|---|
| **E-watcher** | 消 `watch 19 / watchCollection 6 / evalAsync 6 / apply 2`：域处理器 `$watch` → store 订阅/effect |
| **E-bus** | 消 `on 26 / broadcast 4`：shim `__bus` → `eagleBus` |
| **E-apply** | 消 `scopeApply 200`（按 §3.5 逐点确认语义） |
| **E-final** | 删 `createBodyScopeShim` + `scopeShim.ts` + `coreState`；退役 `frontend/public/shims.js`；哨兵基线归零锁定 |

---

## 5. 门禁（每批）

```bash
npx tsc --noEmit                                # 与基线 508 比较，零新增
python tests-tmp/bz-export-check.py             # 具名导入存在性 + 相对路径可达
python tests-tmp/bz-free-check.py <dest>        # @ts-nocheck 目标静态兜底（S 轨改 store 后必跑）
node tests-tmp/probe-b5-load.mjs                # PROBE_RESULT LOAD_OK allData=1
node tests/react-rewrite-sentinel.mjs           # SENTINEL_OK，且本批计数 ≤ 基线
node tests/<定向>-closed-loop.mjs               # 该字段组对应闭环
```
- **轨 S** 应保持哨兵计数**不变**（只换后端）——若某计数上升，视为回归。
- **轨 C** 每批哨兵计数必须**下降**，并在同批提交里棘轮下调
  `tests/react-rewrite-sentinel-baseline.json`。
- **大项收官**（E-final 前）跑全套 `node tests/run-react-suite.mjs`（65/65）。

---

## 6. 风险与不变量

1. **行为差异放大器**：shim 的 `$apply` 当前会**吞掉** `fn` 抛错且按 `$$phase` 跳过执行（§3.5）。
   调用点改写时若默认「fn 一定执行」，会把原被吞的错误变成真错误 —— 必须以 stage-smoke 等
   既有闭环逐批回归。
2. **订阅 vs 快照**：zustand 不可变更新与「原地 mutate scope 子对象」冲突（§3.2）；拆平是主路。
3. **同值守卫纪律**（b1-9az 教训）：任何 `migrateScopeFieldToStore` 的 write 必须带同值守卫，
   否则整写型 DOM 绑定组件（`BodyBindings` 整写 `body.className`）会被无谓重渲染、抹掉
   外部命令式 class（`is-welcome-page`）。
4. **`machineryInfra` TDZ**：新增顶层 `const`/`class` 求值语句前评估环依赖（D-1 遗留不变量）。
5. **函数面与 `SCOPED_HANDLER` 收敛**（§3.4）必须在删 shim 前完成，否则动态分发会拿到 undefined。
6. **`shims.js` 不能先删**：它是 `desktopApi` mock 与 `image.changed` 回声的唯一生产者
   （`main-ui-workflow` 依赖），必须在 DoD ① 完成后单独评估退役面。

---

## 7. 建议下一步

1. 立项确认本规划（尤其是 §3.1 字段归属表、§3.1b store 形态分类、§3.2 嵌套拆平决策）。
2. **先做工具**：写别名感知的 scope 访问提取器（§3.1 ⚠️），产出真实「字段面 + 每字段调用点」
   清单 → 落 `docs/e1-scope-field-map.md`。这是 D-1 `bz-d1-b0-map.py` 的对应物，没有它批次切不准。
3. 依清单切批次：**扁平 store 字段**走注册式源翻转（低风险，先做）；**快照 store 字段**
   （`inspector.*` / `TagManager` / `eagle.*` / `current` / `selected` / `allData` …）需先定
   「拆平 vs 快照转真身」再动（§3.1b）。
4. 轨 C 与轨 S 交错；密集度最高、压计数最快的 **C-1（`inspectorActions.ts` 53 / `detailHooks.ts` 47）**
   可作为首个「看得见进度」的批次，但须在轨 S 把其依赖字段源翻转之后。

### 已排除的伪批次（2026-09-12 实测，避免重走）
- **「bodyState 派生字段源翻转」是 no-op**：`imageHeight/listProp*/boxSortable/hideBadge/hideZoomBtn/
  showTransparentGrid/hasCurrentComment/sidebarWidth/inspectorWidth/filterOpen` 经 grep 全树
  **0 处 `scope.X` 读、0 处写**（纯由 `syncBodyFromScope` 快照进 store、React 直接消费），
  注册进 shim 不改变任何计数、不退役 coreState 任何真实用途。原 S-1 应删除或改述。
