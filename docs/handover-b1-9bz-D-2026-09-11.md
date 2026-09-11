# 交接文档：Eagle React 化重写（b1-9bz 系列）— D 阶段

> 生成时间：2026-09-11
> 工作目录：`H:\dev\Eagle-Sec-development - 副本`
> 当前 HEAD：`aea43af`（D-1 收官现状）
> 本文写给**没有任何上下文的新会话**。按顺序读完即可开工。

---

## 一、核心板块

### 1. 项目核心目标

把 Eagle（图片资产管理桌面应用）从原 **Angular bundle** 的运行时语义，彻底改写为
**React + zustand store + 自建事件总线**，并让旧 Angular 兼容层（`scopeShim` / `coreState`）
最终消失。

具体到「退役四张面」：

| 面 | 含义 | 现状 |
|---|---|---|
| **事件面** | `$broadcast` / `$on` 频道 | ✅ C-2 完成（eagleBus 接管） |
| **digest 面** | `$evalAsync` / `$apply` | ✅ C-3 完成（主窗口） |
| **watcher 面** | `$watch` / `$watchCollection` | ✅ C-4 完成（14/14） |
| **函数面** | `s.xxx = () => machineryYyy(s, ...)` 挂载 | ⏳ **D-1 进行中（180/247）** |

React 侧代码全部在 `src/app/react/`（135 个 ts/tsx，98390 行）。
原 Angular 时代的静态资源在 `src/app/js/`、`frontend/public/`、`frontend/public/shims.js`
（**多数未被 index.html 引入**，但部分仍有对端在跑，见「关键规则」）。

### 2. 已完成进度

#### 2.1 阶段总览（本系列）

| 阶段 | 内容 | 状态 |
|---|---|---|
| A / B | 见 `src/app/react/PROGRESS.md`（更早会话完成，本文不重复） | ✅ |
| **C-0 ~ C-6** | digest/watcher/事件面退役 + 加载链修复 | ✅ 全部完成 |
| **D-1** | `dataMachinery.ts` 归位（函数面退役 + 文件消失） | ⏳ **180/247 挂载已消除** |
| D-2 | jQuery 清零（188 处）+ vendor 清零 + `shims.js` 退役 | 未开始 |
| D-3 | 测试套件 55 → 65+ | 未开始 |
| D-4 | 收官文档 + REWRITE-PLAN 归档 | 未开始 |

#### 2.2 C 阶段细节（本轮完成，提交见 2.4）

- **C-0**：修 B8 引入的启动加载链断裂。根因是 `dataMachinery.ts` 给 `copyAsPath/getRawPath/getRawUrl`
  写的 import 指向了错误模块（实际在 `core/itemDomain.ts`，却写成 `./miscDomain`）。
  解决：新增 `core/externalSupply.ts` + `core/externalSupplyRegistrar.ts`，把跨窗口/驱动脚本
  需要的 10 个 scope 面供给改为**延迟注册**（`main.tsx` 动态 import）。
- **C-1**：machinery 守卫补齐 15 处（`removeSound` 4 / `saveFolderDebounce` 4 / `notify` 4 /
  `subFolderSortableOptions` 3）；删除 B8 退役后已无调用方的 6 个 `install*Fns` 死代码 673 行。
- **C-2**：41 个 `$broadcast`/`$on` 频道 → `src/app/react/global/bus.ts` 的 `defineChannel`；
  后又补迁 4 个漏网频道（`gl:reset` / `gl:removeItems` / `gl:scrollToTop` /
  `$$rebind::refreshContainSize`）。全树 `$broadcast` 118 → 4。
- **C-3**：`X.$evalAsync(...)` / `X.$apply(...)` → `scopeEvalAsync(...)`（40 文件 392 处）。
  `scopeEvalAsync` 定义在 `global/scopeShim.ts`，语义逐字等价（执行 fn，原本还会 flushWatchers）。
- **C-4**：14 处 `$watch`/`$watchCollection` 全部消除，改为**各域/组件自建 200ms 轮询**或 store 订阅。
  全树 `$watch` 注册归零。
- **C-5**：三个独立窗口（`preview-window` / `collect-window` / `preferences`）的 33 处
  `X.$evalAsync()` → 各自的 `notifyController()`。
- **C-6**：永久哨兵扩面（`tests/react-rewrite-sentinel.mjs` 新增主窗口 scope 面禁项）+ 基线更新。

#### 2.3 本轮新增文件

| 文件 | 作用 |
|---|---|
| `src/app/react/core/selectionNotify.ts` | **零依赖叶子模块**：selected 变更订阅中心（自建 200ms 轮询 + 监听器集合） |
| `src/app/react/core/externalSupply.ts` | C-0 的延迟供给表（跨窗口 scope 面） |
| `src/app/react/core/externalSupplyRegistrar.ts` | 供给注册（`main.tsx` 动态 import） |
| `tests/react-rewrite-sentinel.mjs` | 反退化哨兵（**已扩面**，见下） |

#### 2.4 关键提交（最近 12 个，倒序）

```
aea43af docs(react): D-1 收官现状 —— 挂载面 180/247（73%），剩余四类阻塞与函数体归位的规模说明
2ba2c7f feat(react): b1-9bz-D-1 批次 3b — updateItemView / smartZoom / getItemByElement 直调化（16 处）
0b80fc5 feat(react): b1-9bz-D-1 批次 3 — 删 3 项 orphan 挂载（selectUp/selectDown/videoScreenShot）
8faf804 feat(react): b1-9bz-D-1 批次 2b — 6 个挂载名直调化（13 处调用点）
af0ba09 feat(react): b1-9bz-D-1 批次 2a — getSelection / editTag 两个挂载名直调化
d797e5e docs(react): D-1 批次 1 完成（150 项死挂载）+ 批次 2 路径验证
86d786f feat(react): b1-9bz-D-1 批次 1 — 删除 150 项死挂载
abf1985 docs(react): D-1 摸底结论 —— 247 导出全活/247 挂载项分类/契约锚定点
f03abed docs(react): C-6 记录 —— 补迁 gl:*、哨兵扩面
3a68168 feat(react): b1-9bz-C-6 — 补迁 gl:* 频道 + 永久哨兵扩面
6153df4 feat(react): b1-9bz-C-4 收官 — 最后 5 处 watcher 消除
81cf9c7 feat(react): b1-9bz-C-4 批次 6 — selected 2/3 消除
```

### 3. 当前状态与卡点

#### 3.1 当前状态（**开工前务必先复跑一次确认**）

- 全套 React 测试：**55/55 通过**（`node tests/run-react-suite.mjs` → `REACT SUITE ALL GREEN`）。
  注意：该套件内有 2 个已知抖动项（`react-stage8e2-smoke`、`react-stage7a-smoke`），
  套件内偶发失败但**单跑必过**，判定前先单跑确认。
- 哨兵：`SENTINEL_OK`。
- 工作树：干净（`git status` 无未提交改动）。
- `dataMachinery.ts`：**11673 行**（起始 11838），剩余**箭头挂载 67 个**（起始 247）。
- **工作树并非完全干净**：有 3 个删除项与 1 个修改项**非本轮改动**
  （`.claude/launch.json`、`.zcode/plans/plan-sess_*.md`、`docs/plan.md` 删除；
  `docs/handover-b1-9d-2026-09-04.md` 修改），另有 `docs/handover-*.md` 若干未跟踪文件。
  开工前如需干净基线，请先与用户确认这些文件的去留。

#### 3.2 卡点（D-1 剩余 67 个挂载，四类，每类都已实测撞过）

**① 契约锚定 ~19 个**
- `CONTRACT` 名单 16 个：`calculateImageBinding` `sortRawData` `rebindRefresh` `rebindRefreshLazy`
  `updateSidebarList` `updateItemsView` `switchLayout` `prependImages` `reload` `getRatioExp`
  `getRatioNonExp` `updateZoomRatio` `toggleSlideshow` `smartFolderCount` `getRecentFolders`
  `calcuteFilterResult` `filterData`
- **还有按别名检查的隐藏契约**（本轮踩到）：
  - `m1-A8-relayout-machinery`（对应 `s.relayout`）
  - `m1-A9-smart-filter`（对应 `s.existInSmartFilter`）
  - `stage5` 的 `detail-*` 系列（对应 `s.enterDetailMode`）
  - 改这 3 个名字后：1m1 挂 2 个、stage5 挂 8 个断言 → 已回退。
- 契约位置：
  - `tests/react-stage1m1-unified-smoke.mjs`
    - `m1-A3-c9-machinery`（约 176-187 行）：按 15 个名字查
      `window.__eagleDataMachinery[k] === 'machinery'` + `typeof s.xxx === 'function'`
    - `m1-D-rebind-broadcast`（约 445-452 行）：**直接 spy** `s.rebindRefresh`
      （`const orig = s.rebindRefresh; s.rebindRefresh = function(){n++; ...}`）——
      改直调后 spy 失效，必须改为效果断言。
  - **清这一类的第一步是重新设计这些断言**，不是改源码。

**② 字符串动态调用 ~26 个**
- 形态：`call('openPluginPanel')`、`callSeq([...], ['openUnfiled'])`、
  映射表 `{ open: 'openUnfiled', ... }`（`components/sidebar/Sidebar.tsx:600` 附近）。
- 这类**不经过** `s.xxx(...)`，所以静态扫描看不到；删挂载后运行时报「找不到符号」。
- 典型受害者（本轮已跳过）：`openUnfiled` `changeSidebarIndex` `openPluginPanel`
  `selectPrev` `selectNext`。
- 典型症状：`tests/react-stage-smoke.mjs:481`「click unfiled switches active state timeout」。
- **解法**：先改造 `call`/`callSeq` 机制，使其能接收**函数引用**而非字符串；
  或把这些调用点改为直调。相关代码在 `components/toolbar/Toolbar.tsx`、
  `components/sidebar/Sidebar.tsx`、`components/stage7/TagManager.tsx`。

**③ 裸引用 / 谓词传递 ~9 个**
- 形态：`keepItems.filter(getBodyScope().contentFilter)`（把 scope 函数当谓词传）、
  `s.zoomFit` 作为值传递等。
- 本轮试改 `contentFilter` + `calculateFilterCounts` → **LOAD_BROKEN（allData=0）**，已回退。
- 需逐个查清真实使用面再决定改法（谓词需包一层 `(x) => machineryXxx(s, x)`）。

**④ 单例 debounce 若干**
- 形态：`s.reload = machineryReload(s)` —— 右侧**会执行**（创建 debounce 实例），
  不是纯箭头。
- 直调化必须**先提取单例 getter**（例如 `getReloadFn(s)` 内部缓存），
  否则每次调用都新建 debounce → 防抖语义失效。
- 同类：`s.offsetScrollbar = machineryOffsetScrollbar(s)`。

#### 3.3 未开始的部分（**D-1 的另一半**）

PROGRESS 对 D-1 的定义是「**归位**：函数体按域迁回各 domain/service，**文件消失**」。
当前只做了「挂载面退役」，**11673 行的函数体一行都没搬**。

规模：247 个导出、被 47 个文件引用。目标文件举例：
`core/selectionViewDomain.ts`、`core/itemDomain.ts`、`core/tagManagerDomain.ts`、
`core/miscDomain.ts`、`core/libraryDomain.ts`、`services/*.ts`。

> **这是 D 阶段最大的单块工作。** 需按域拆成多批（每批一个函数簇 + 其依赖的内部辅助函数
> 与模块级变量一并搬运），不可一次性大挪。

### 4. 下一步行动（To-Do，按优先级）

1. **改造 `call` / `callSeq` 机制，支持函数引用**（解锁 ②类的 ~26 个）
   - 先读 `components/toolbar/Toolbar.tsx` 里 `call`/`callSeq` 的定义与 `runSeq` 机制，
     以及 `components/sidebar/Sidebar.tsx:600` 附近的映射表。
   - 目标：把 `call('openUnfiled')` 这类字符串解析，改为可传 `machineryOpenUnfiled` 这类函数引用。
   - 完成后可清：`openUnfiled` `changeSidebarIndex` `openPluginPanel` `selectPrev` `selectNext` 等。

2. **重新设计契约锚定断言**（解锁 ①类的 ~19 个）
   - 先处理 `m1-D-rebind-broadcast` 的 spy（改为效果断言：如 rebind 后数据面/快照变化）。
   - 再处理 `m1-A3-c9-machinery` 的名单与 `typeof s.xxx === 'function'` 断言
     （改为「已 import 直调」的断言，或干脆删除该项）。
   - 查找隐藏契约的方法：**改名前**先 `grep -rn "<挂载名>" tests/`，
     本轮 `m1-A8`/`m1-A9` 就是没查才踩的。

3. **逐个处理裸引用与单例**（③④）
   - 裸引用：`grep -rn "\.<name>\b"` 找出所有非调用形态，逐个判断。
   - 单例：为 `reload` / `offsetScrollbar` 提取 getter。

> 每批的节奏固定为：**改写 → `probe` → 定向测试 → （必要时）改契约 → 提交**。
> 不要攒批提交。

### 5. 关键规则与 SOP（**雷区，必读**）

#### 5.1 绝对不能踩

1. **不要机械改名 `X.$xxx()` 或 `X.<mount>()`** —— `X` 是哪个对象决定语义。
   本轮踩过三次同型坑：
   - `s.$root.$broadcast(` → 正则把 `$root` 当标识符，留下 `s.` 前缀 → 产出 `s.xxxChannel.emit()`（运行时 TypeError）
   - `s.$root.$evalAsync()` → 同上
   - **跨窗口同名不同源**：`preview-window` / `collect-window` / `preferences` / `viewers`
     各有**独立的 scope 实例**（有的是普通对象、有的有自己的 `$evalAsync` 门面），
     改成全局函数会丢语义。

2. **删挂载前必须查 5 类存活面**（否则 LOAD_BROKEN）：
   ① 外部 `s.xxx(` 调用 ②测试引用 ③同文件内部调用 ④动态下标 `s['xxx']`
   ⑤**裸引用** `s.xxx`（作值传递）⑥存在性检查 `if (s.xxx)` / `typeof s.xxx`
   ⑦**字符串动态调用**（`call('xxx')` 等）⑧HTML 引用

3. **目标函数必须是 `dataMachinery.ts` 的真实导出** —— 有些挂载指向未定义符号（死引用），
   盲目改成 `import` 会让 ESM 解析失败、**整条加载链断**（症状：`allData=-1`）。

4. **不要整体删除 `scopeShim` / `coreState`** —— 实测：它是 **178 个 scope 字段**的载体
   （属性访问器后端），需先把字段全部迁到 store 才能删。且单删其中的 watcher 机制会让
   1m1 的 `m1-A6-scope-shim`（检查 shim 形状）与 `m1-E-selected-watch` 一起挂。

5. **改写入点直调会破坏时机语义** —— 本轮 `finishQueue` 曾改「push 后直调」，
   触发时机与 flush 批量不一致 → 1m1 挂 7 个断言。**能改检测就不要改触发时机。**

6. **`$evalAsync` 的语义不是「无意义 digest」** —— `scopeShim` 里
   `$evalAsync(fn)` = 执行 fn + `flushWatchers()`；watcher 注册时还会启动 **200ms 定时轮询**。
   所以它是 load-bearing，删之前要看 watcher 是否已归零。

7. **⚠️ 项目级约束：markdown 组件不属于原框架 —— 隔离、不处理**
   （2026-09-04 用户裁定，权威表述见 `src/app/react/PROGRESS.md` 顶部同名节）
   - markdown 相关组件/断言**不是 Eagle 原框架（bundle）内的东西**，是后续叠加物。
   - 处理方式：**隔离 + 完全略过** —— 不修复、不补齐、不当回归查。
   - 依据：原框架 `SPECIAL_TYPES`（bundle 18994）不含 `md`/`markdown`。
   - 已执行的隔离：`tests/main-ui-workflow-closed-loop.mjs` 不建 markdown 样例、
     不传 `EAGLE_WORKFLOW_MARKDOWN_SOURCE`；`electron/main.cjs` 的 `markdownSource`
     恒置空 → 相关断言恒跳过。
   - **约束**：后续任何会话**不得**为了满足 markdown 断言而改业务代码。

#### 5.2 每批必跑的命令

```bash
# 1) 应用能否启动（最快判据，约 1.5 分钟）
cd "H:/dev/Eagle-Sec-development - 副本"
pkill -f vite; pkill -f electron; sleep 3
timeout 300 node tests-tmp/probe-b5-load.mjs 2>&1 | tail -1
#   期望：PROBE_RESULT LOAD_OK allData=1 images=0 waited=...ms
#   LOAD_BROKEN / allData=-1  → 加载链断（多半是 import 问题）
#   LOAD_BROKEN / allData=0   → 启动链没跑完

# 2) 语法与导入校验（改完立刻跑）
"C:/Users/Administrator/AppData/Local/Programs/Python/Python312/python.exe" tests-tmp/bz-export-check.py
#   期望：无问题   ← 会校验「命名导入是否真的存在」+「相对路径能否解析到文件」
"C:/Users/Administrator/AppData/Local/Programs/Python/Python312/python.exe" tests-tmp/bz-dup-import.py --fix

# 3) 定向测试（每批按影响面挑 2-4 个）
node tests/react-stage-smoke.mjs
node tests/react-stage1m1-unified-smoke.mjs
node tests/react-stage5-smoke.mjs

# 4) 收尾：全套 + 哨兵
node tests/run-react-suite.mjs          # 55 项，期望 REACT SUITE ALL GREEN
node tests/react-rewrite-sentinel.mjs   # 期望 SENTINEL_OK
```

#### 5.3 提交规范

- 每批一个提交，提交信息写清：**改了什么 / 踩了什么坑 / 校验结果**（本轮提交可作范例）。
- 提交前确认：`git status --short -- src/ tests/` 无意外改动。

---

## 二、最近修改内容（逐项）

### 2.1 文件级

| 文件 | 修改 | 目的 |
|---|---|---|
| `src/app/react/core/dataMachinery.ts` | **-165 行**（11838 → 11673）；删除 180 项 `s.xxx = (...) => machineryYyy(s, ...)` 挂载；新增 `machineryEnlargeThumbnails` / `machineryShrinkThumbnails` / `machineryOnImageSizeHeightChanged` / `machineryOnZoomRatioChanged` / `onSelectedChanged` / `machineryNotifySelectedChanged` | D-1 挂载面退役；C-4 把域私有函数迁入 |
| `src/app/react/global/bus.ts` | 新增 43 个 `defineChannel`；新增 `listenerCount(channel)` | C-2 事件面统一入口；`listenerCount` 供测试断言 |
| `src/app/react/global/scopeShim.ts` | 新增导出 `scopeEvalAsync` / `flushScopeWatchers` / `hasScopeWatchers`；`$evalAsync`/`$apply` 保留 | C-3 提供脱 scope 面的 flush 入口 |
| `src/app/react/core/selectionNotify.ts` | **新建**（57 行） | C-4 selected 变更订阅中心（零依赖叶子模块） |
| `src/app/react/core/appCore.ts` | `scopeApply` **保持原实现**（曾试直调化，实测失败已回退） | 见 5.1-6 |
| `src/app/react/core/externalSupply.ts` + `externalSupplyRegistrar.ts` | C-0 新建 | 延迟注册跨窗口 scope 面 |
| `src/app/react/store/bodyState.ts` | 新增 `isCleaningTrash` / `removeProgress` 字段并加入 `MIGRATED_SCOPE_FIELDS` | C-4 源翻转 |
| `tests/react-rewrite-sentinel.mjs` | 新增「主窗口 scope 面禁项」+ 行级白名单 | C-6 反退化 |
| `tests/react-rewrite-sentinel-baseline.json` | 基线更新为 `generated: "b1-9bz-C"` | 同上 |
| `tests/react-stage1m1-unified-smoke.mjs` | a4/a5 改查 `__eagleBus.listenerCount`；m1-D/m1-E 驱动改 `__eagleBus.emit` | C-2/C-3 契约同步 |
| `tests/react-stage7c-smoke.mjs`、`7d5b`、`6`、`7c2`、`7d1a/b/c1/c2`、`7d2`、`7d3a/b`、`7d6c`、`ui-interactions-closed-loop`、`probe-7d2` | 驱动从 `$broadcast` 改 `__eagleBus.emit`（含 `$on` 改 `bus.on`） | C-2 契约同步 |
| `src/app/react/components/stage7/ProgressDialogs.tsx` | 3 处 `$watch(read, sync)` → 组件内 200ms 轮询；`onStart` handler 签名 `(e, params)` → `(params)` | C-3/C-4 |
| `src/app/react/core/selectionViewDomain.ts` | `imageSize.height`/`zoomRatio`/`listMetaType`/`selected` watcher 退役；`domainEnlarge/ShrinkThumbnails` 迁出 | C-4 |
| `src/app/react/components/stage7/InspectorTagSelectPanel.tsx` | selected watcher → 组件内 200ms 轮询 | C-4 |
| `src/app/react/core/itemDomain.ts` | `finishQueue` watcher → 域内 200ms 轮询（handler 提取为模块级 `handleFinishQueueChanged`） | C-4 |
| `src/app/react/components/detail/detailHooks.ts` | `$watch('theme')` → `useBodyState.subscribe`；`$watch('current.id')` → `useDetailState.subscribe` | C-4 |
| `src/app/react/preview-window/controller.ts`、`detailHooks.ts`、`collect-window/selectPanelEngine.ts` | 33 处 `X.$evalAsync()` → 各自的 `notifyController()` | C-5 |

### 2.2 关键函数 / 组件

| 名称 | 位置 | 作用 / 变更 |
|---|---|---|
| `defineChannel<T>(name)` | `global/bus.ts` | 创建类型化频道，返回 `{ emit, on }`；`on` 返回退订函数 |
| `scopeEvalAsync(fn?)` | `global/scopeShim.ts` | 执行 `fn` + flush（当前 flush 已退化为 no-op，因 watcher 归零） |
| `machineryNotifySelectedChanged(s)` | `core/dataMachinery.ts` | selected 赋值点通知（**注意：当前 selected 走 `selectionNotify` 轮询，未使用此函数** —— 需确认） |
| `onSelectedChanged(fn)` | `core/selectionNotify.ts` | selected 订阅（自建 200ms 轮询驱动）；返回退订函数 |
| `handleFinishQueueChanged(s, newValue, oldValue)` | `core/itemDomain.ts` 文件末尾 | 原 `$watchCollection(finishQueue)` 的 handler，原样提取 |
| `machinerySeedControllerState` | `core/dataMachinery.ts`（约 :10686 起） | scope 函数挂载块所在函数（D-1 主战场） |
| `BodyBindings` | `components/shell/BodyBindings.tsx` | 订阅 `useBodyState` 直写 `document.body` 的 class/attr（theme 等） |

### 2.3 数据结构 / 状态

| 名称 | 位置 | 说明 |
|---|---|---|
| `coreState` | `core/appCore.ts` | `Record<string, any>`，scope 字段的**后端**（非 zustand，**不可订阅**） |
| `migratedFields` | `global/scopeShim.ts` | 字段源翻转注册表：`migrateScopeFieldToStore(name, read, write)` |
| `MIGRATED_SCOPE_FIELDS` | `store/bodyState.ts` | 22 个已源翻转字段（含本轮新增 `isCleaningTrash`/`removeProgress`） |
| 13 个 store | `src/app/react/store/*.ts` | appState / bodyState / detailState / filterState / inspectorState / listState / lockState / panelState / sidebarState / tagManagerState / toastState / toolbarState / uploadState |
| `window.__eagleDataMachinery` | 运行时 | 挂载标记表（`m[k] === 'machinery'`），**测试契约读取** |
| `window.__eagleBus` | 运行时 | 事件总线（测试驱动与断言用） |
| `window.__eagleBodyState` | 运行时 | bodyState store（测试直访） |
| `window.$bodyScope` | 运行时 | scope（shim 或真实对象，由 `getBodyScope()` 返回） |

### 2.4 配置

- `tests/react-rewrite-sentinel-baseline.json`：`generated` 更新为 `b1-9bz-C`，计数更新
  （`evalAsync: 6`、`apply: 2`、`watch: 19`、`watchCollection: 6`、`broadcast: 4`、`on: 26`、
  `getBodyScope: 795`、`rootAccess: 368`）。
- `.gitignore`：新增 `tests-tmp/`（临时工具目录，1336+ 文件，已移出版本控制，本地保留）。

### 2.5 UI

- `EmptyTrashProgress`（`components/stage7/ProgressDialogs.tsx`）：`isCleaning` / `removeProgress`
  从 `useState` + `$watch` 改为 `useBodyState` 订阅。
- 其余 UI 无结构性改动（C 阶段均为数据面/机制层）。

---

## 三、当前代码状态

### 3.1 架构分层

```
main.tsx  (React 入口；动态 import externalSupplyRegistrar)
  │
  ├── app/AppRoot.tsx          主题偏好 IPC（change.current.theme / update-preferences）
  ├── components/              各 UI 组件（stage7/ 为面板群、shell/ 为壳层绑定）
  ├── preview-window/          独立窗口（自己的 controllerScope，普通对象 + notifyController）
  ├── collect-window/          独立窗口（同上）
  ├── preferences/ viewers/    独立窗口
  │
  ├── core/                    域逻辑（selectionViewDomain / itemDomain / tagManagerDomain /
  │                            miscDomain / libraryDomain / filterDomain / apiServerDomain /
  │                            appCore / dataMachinery / bundleGlobals / externalSupply ...）
  ├── services/                服务层（folderMenuService / itemMenuService / batchOpsService ...）
  ├── store/                   zustand store（13 个）
  └── global/                  bus.ts（事件总线）/ scopeShim.ts（Angular 兼容层）/ eagleGlobals.ts
```

### 3.2 数据流（**当前真实链路**）

```
① 用户交互 → 组件回调
     ├── 直调：import { machineryXxx } from 'core/dataMachinery' → machineryXxx(s, ...)
     └── scopeApply(getBodyScope(), (s) => {...})   ← appCore 工具函数（内部仍走 scope.$apply）
                                                          ↓
② scope 字段写入  s.theme = 'light'
     ↓ （若字段已源翻转）
   scopeShim 的 Proxy setter → migrateScopeFieldToStore 的 write → zustand store.setState
     ↓
   React 组件（如 BodyBindings 用 useBodyState 订阅）重渲染 → 写 DOM

③ 某些字段仍是「快照链」：显式调用 syncXxxFromScope()
   （bodyState.syncBodyFromScope / detailState.syncDetailFromScope / sidebarState.syncSidebarFromScope ...）
   —— 由具体写点调用，**不依赖任何自动机制**

④ 跨组件事件：eagleBus  defineChannel('X').emit(payload)  →  订阅方 channel.on(handler)
     （handler 签名：只收 payload，**不再有 (event, params) 双参**）

⑤ 某些检测改用「自建 200ms 轮询」：
     - core/selectionNotify.ts（selected）
     - components/stage7/InspectorTagSelectPanel.tsx（selected）
     - components/stage7/ProgressDialogs.tsx（3 处队列/状态）
     - core/itemDomain.ts（finishQueue）
```

### 3.3 关键设计决策（**沿用，不要推翻**）

1. **`scopeShim` 是兼容层，不是待删垃圾** —— 它承载 178 个 scope 字段的读写；
   `getBodyScope()` 在无 `window.angular` 时创建 shim。`src/app/index.html` **已不引入
   `angular.min.js`**，所以 shim 是「Angular 语义」的唯一载体。
2. **事件统一走 `eagleBus`**，禁止新增 `$broadcast`/`$on`（哨兵会拦）。
3. **digest 面**：主窗口禁止新增 `X.$evalAsync(` / `X.$apply(` / `X.$watch(` /
   `X.$watchCollection(` / `X.$broadcast(` / `X.$on(`（哨兵会拦，三窗口与 `scopeShim` 例外）。
4. **store 是唯一状态源的目标**：新字段优先「源翻转」进 store，而不是继续放 `coreState`。
5. **跨窗口各自为政**：`preview-window` / `collect-window` / `preferences` / `viewers` 的
   `controllerScope` 是**各自的普通对象**，有自己的 `notifyController()` / `$evalAsync` 门面；
   不要用主窗口的机制去替换它们。
6. **不要依赖 `$watch` 的「立即触发一次」语义** —— 若删 watcher，需要显式补一次首次调用
   （本轮 `listMetaType` / `imageSize.height` 都是这么处理的，且用 `try/catch` 包住，
   因为接管时 scope 可能未就绪）。

### 3.4 测试体系

- 主套件：`tests/run-react-suite.mjs`（**55 项**，串行跑，约 12-17 分钟）。
  含 `react-rewrite-sentinel.mjs`（反退化哨兵）。
- 契约测试（D-1 主要影响面）：
  - `tests/react-stage1m1-unified-smoke.mjs` —— 域接管、契约锚定（**最重要**）
  - `tests/react-stage-smoke.mjs` —— 壳层/主题/交互闭环
  - `tests/react-stage5-smoke.mjs` —— 详情模式
  - `tests/react-stage7a-smoke.mjs`、`7c`、`7d*`、`9b1`/`9b2`、`11*` —— 各面板
- 已知抖动（**套件内失败但单跑通过**）：`react-stage8e2-smoke`、`react-stage7a-smoke`
  （`cm-overlay-close` 断言）。

### 3.5 有对端但「未引入」的旧代码（**判死前必查**）

`src/app/js/**`（原 Angular 目录，未被 index.html 引入）里仍有频道对端，例如：
- `js/plugin/index.js:151` 发送 `REFRESH_PLUGIN_CENTER`
- `js/directives/plugin-center.js:344`、`js/directives/notification-modal.js:28`、
  `js/controllers/tag-popup.js:120` 是接收端

**结论**：判「频道已死」必须全树 grep（含 `src/app/js`），只看 `src/app/react` 会误判
（本轮 `REFRESH_PLUGIN_CENTER` / `OPEN_NOTIFICATION` / `CLOSE-TAGS-POPUP` 就差点被误删）。

---

## 四、重要代码 / 命令

### 4.1 命令清单

```bash
# 环境
cd "H:/dev/Eagle-Sec-development - 副本"
python="C:/Users/Administrator/AppData/Local/Programs/Python/Python312/python.exe"

# 杀掉残留（每批测试前必做）
pkill -f vite; pkill -f electron; sleep 3

# 启动探针（最快判据）
timeout 300 node tests-tmp/probe-b5-load.mjs 2>&1 | tail -1

# 校验器
$python tests-tmp/bz-export-check.py        # 命名导入 + 相对路径解析（改完必跑）
$python tests-tmp/bz-dup-import.py --fix    # ESM 重复声明

# D-1 专用工具
$python tests-tmp/bz-d1-rest.py             # 剩余挂载分类统计
$python tests-tmp/bz-d1-m2.py name1 name2   # 多挂载名直调化（含 4 道检查）

# 测试
node tests/run-react-suite.mjs              # 全套 55 项
node tests/react-rewrite-sentinel.mjs       # 哨兵
node tests/react-stage1m1-unified-smoke.mjs # 契约（最常看）

# 开发
npm run dev            # vite（端口 5176）
npm run dev:electron   # vite + backend + electron
```

### 4.2 频道总线（`src/app/react/global/bus.ts`）用法

```ts
import { defineChannel } from '../global/bus';

export const openRenameChannel = defineChannel<{ id: string }>('OPEN_RENAME');

// 发送
openRenameChannel.emit({ id: 'abc' });

// 订阅（返回退订函数；handler 只收 payload）
const off = openRenameChannel.on((payload) => { /* ... */ });
off();

// 诊断（测试用）
openRenameChannel.listenerCount('OPEN_RENAME');
```

> 当前 `bus.ts` 有 **43 个 `defineChannel`**，34 个文件引用。

### 4.3 selected 订阅（`src/app/react/core/selectionNotify.ts`）

```ts
import { onSelectedChanged } from '../core/selectionNotify';

const off = onSelectedChanged((s, oldValue) => {
  // oldValue 由模块内自维护（首次 = 当前值，等价 Angular $watch 的 listener(val, val)）
});
```

实现要点：模块内 `setInterval(..., 200)` 比较 `selected` 数组的 **id 序列**；
零依赖（只 import `getBodyScope`），因此谁 import 都安全。

### 4.4 D-1 改写器（`tests-tmp/bz-d1-m2.py`）的四道检查

```python
# 1. 字符串动态调用：call('name') / callSeq([...], ['name']) / 映射表
if re.search(r"['\"]" + re.escape(name) + r"['\"]", _all_src): skip
# 2. 裸引用（s.xxx 后面不是 ( 也不是 =）+ 存在性检查（if/typeof）
# 3. 目标必须是 dataMachinery 的真实导出
# 4. 引号内（引号数奇偶）与注释行跳过
```

**import 路径层数规则**：`'../' * rel.count('/')`，例如
`core/x.ts` → 1 层 → `'../core/dataMachinery'`；
`components/stage7/x.tsx` → 2 层 → `'../../core/dataMachinery'`。
（**写成 `+1` 会多一层 → 模块解析失败 → LOAD_BROKEN**，本轮踩过。）

### 4.5 契约锚定点（改名前必查）

```bash
grep -rn "<挂载名>" tests/          # 先查测试
grep -rn "<挂载名>" src/app/react/  # 再查源码
```

已知锚定（`tests/react-stage1m1-unified-smoke.mjs`）：
- `m1-A3-c9-machinery`（约 :176-187）—— `window.__eagleDataMachinery[k] === 'machinery'` + `typeof s.xxx`
- `m1-A8-relayout-machinery` —— `s.relayout`
- `m1-A9-smart-filter` —— `s.existInSmartFilter`
- `m1-D-rebind-broadcast`（约 :445-452）—— **spy `s.rebindRefresh`**
- `m1-E-selected-watch` / `m1-E-update-selection-broadcast`
- `m1-A10-filter-engine` —— `typeof window.$bodyScope.calcuteFilterResult === 'function'`

---

## 五、重要要求（交接约束）

1. **不要编造不存在的信息**；不确定的标「未知 / 需确认」。
2. **优先引用实际代码与文件**，不要根据本文猜测。
3. **改动前先读**：`src/app/react/PROGRESS.md`（本系列主索引，很长但按批分段）、
   `src/app/react/REWRITE-PLAN.md`（原始规划）。
4. **每批必过 probe + 定向测试**；破坏性改动（删挂载、改契约）必须成对处理。
5. **提交粒度**：一批一提交，提交信息含「改了什么 / 踩了什么坑 / 校验结果」。
6. 若发现本文与代码冲突，**以代码为准**。

---

## 六、新窗口启动指令（可直接复制）

```
你是接手 Eagle React 化重写（b1-9bz 系列）D 阶段的全新会话，没有任何上下文。

工作目录：H:\dev\Eagle-Sec-development - 副本
交接文档：docs/handover-b1-9bz-D-2026-09-11.md  ← 先完整读一遍
主索引：src/app/react/PROGRESS.md（按批分段，检索关键词 "D-1" / "b1-9bz-C"）

请按以下顺序开工，不要跳步：

1) 先复跑基线，确认环境可用：
   cd "H:/dev/Eagle-Sec-development - 副本"
   pkill -f vite; pkill -f electron; sleep 3
   timeout 300 node tests-tmp/probe-b5-load.mjs 2>&1 | tail -1
   # 期望 PROBE_RESULT LOAD_OK allData=1
   然后跑 node tests/react-stage1m1-unified-smoke.mjs 确认契约全绿。

2) 读交接文档的「3.2 卡点」与「4. 下一步行动」，当前任务是结束 D-1：
   - 剩余 67 个 scope 挂载，分四类阻塞（契约锚定 / 字符串动态调用 / 裸引用 / 单例 debounce）
   - 建议第一批做「改造 call/callSeq 机制支持函数引用」，可一次解锁 ~26 个

3) 每批固定节奏：改写 → probe → 定向测试 →（必要时）改契约 → 提交。
   改写器：tests-tmp/bz-d1-m2.py name1 name2 ...（已含 4 道检查）

绝对禁止：
- 机械改名 X.$xxx() / X.<mount>()（接收者身份决定语义）
- 未查 8 类存活面就删挂载（会 LOAD_BROKEN）
- 整体删除 scopeShim / coreState（178 个字段的载体）
- 改写入点直调（破坏触发时机语义）
- 未经 probe + 测试就提交

先给我一份你对当前状态的理解摘要（不超过 15 行），确认无误后我们再开始改代码。
```

---

## 附：本文未覆盖 / 需确认的项

- **A / B 阶段的完整清单**：见 `src/app/react/PROGRESS.md` 与
  `docs/handover-b1-9bz-A-2026-09-07.md`、`docs/handover-b1-9d-2026-09-04.md` 等历史交接文档。
- **`machineryNotifySelectedChanged` 不存在**（已 grep 核实，0 命中）：它是 C-4 批次 6 尝试
  引入的方案（配 32 个赋值点插通知），实测失败后随改动一并回退；最终采用
  `core/selectionNotify.ts` 的 200ms 轮询方案。**无需处理。**
- **`scopeShim.hasScopeWatchers()` 当前无调用方**（仅定义在 `global/scopeShim.ts`），
  属 C-6 留存的诊断面，可清理但无紧迫性。
- **`docs/` 下的 handover 文档多数未入库**：`handover-2026-09-01.md`、
  `handover-b1-9bz-A-2026-09-07.md`、`handover-b1-9e-2026-09-04.md`、本文均为
  **未跟踪文件**（`??`）；`docs/handover-b1-9d-2026-09-04.md` 有未提交修改。
  工作树还残留 3 个删除项（`.claude/launch.json`、`.zcode/plans/*.md`、`docs/plan.md`）——
  **均非本轮改动**，属环境/历史遗留。开工前若需干净基线，先与用户确认这些文件的去留。
- **`scopeApply` 内部的 `scope.$apply`**：C-3 试过直调化，实测 `stage-smoke` 的
  「theme switch」稳定失败（原版在 scope 无 `$apply` 时抛错被 catch、fn 不执行；直调则执行了 fn）。
  **保留原实现**，待删 `scopeShim` 时统一处置。
- **D-2 / D-3 / D-4 的具体范围**：见 `src/app/react/PROGRESS.md` 的 D 阶段表格
  （jQuery 188 处里 175 处在 `dataMachinery.ts` 内；vendor 3 文件；套件 55 → 65+）。
