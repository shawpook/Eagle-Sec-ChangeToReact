# E1 字段映射表（`$bodyScope` 访问面 → store 归属）

> 生成时间：2026-09-12　工具：`tests-tmp/e1-scope-access.py`（别名感知，启发式）
> 配套：`docs/e-phase-plan-2026-09-12.md`（§3.1/§3.1b/§7）
> 状态：**初版（启发式，有假阳性）**——切批次前需升级为 AST 精确版（见 §4）。

---

## 1. 方法与口径

`getBodyScope()` 全树 **793** 处。直链 `getBodyScope().X` 仅 ~60 名；其余经别名访问：

- `const s = getBodyScope()` **182** 处、`const body =…` **69**、`const scope =…` **28**、
  `const bodyScope =…` **13**、`pluginModule/item/live/current/b/…` 等零散；
- `scopeApply(getBodyScope(), (s) => …)` 的回调首参即 scope（**200** 处 `scopeApply`）。

工具按「别名赋值 + `scopeApply` 回调参数 + 直接链」追踪 `alias.<prop>`，汇总字段面。
**归类访问 2599 处；未归类（作实参/解构/二级别名）≈ 62 处。**

⚠️ **假阳性**：`s`/`scope`/`body` 等别名在嵌套 lambda 中会被同名参数遮蔽
（`arr.map(item => item.id)` 的 `item`、分页 `page`、`raw`、`id`、`width`、`options`、`snapshot`、
`target`、`image` 等明显混入）。下表只列**语义明确**的字段；带 ⚠️ 者为高疑似。

---

## 2. 主字段表（按访问量，语义明确者）

| 字段 | 计数 | 文件 | 类别 | 当前后端 | 目标 store / 处置 |
|---|---:|---:|---|---|---|
| `$root` | 181 | 24 | state | shim `$root` 自指 → coreState | preferences/lock 等；**C-7 `rootAccess` 专批** |
| `selected` | 158 | 20 | state | coreState | 选区 store（`selectionViewDomain` 真身）；快照 store 需转真身 |
| `current` | 116 | 14 | state | coreState | 当前详情项 → `detailState`/`inspectorState` |
| `imageSize` | 96 | 10 | state | coreState | 布局尺寸 → `panelState`/新 `layoutState` |
| `currentSmartFolder` | 90 | 13 | state | coreState | `sidebarState`/`filterState` |
| `folderMappings` | 87 | 18 | state | coreState（镜像缓存） | **新 `itemCacheStore`** |
| `currentFolder` | 85 | 14 | state | coreState | `appState`（当前库/夹） |
| `allData` | 78 | 13 | state | coreState（镜像缓存） | **新 `itemCacheStore`** |
| `TagManager` | 53 | 12 | state | coreState | `tagManagerState`（现为快照 store，需转真身/拆平） |
| `viewMode` | 50 | 10 | state | ✅ 已注册（bodyState） | 保持 |
| `isDetailMode` | 48 | 13 | state | ✅ 已注册（bodyState） | 保持 |
| `folders` | 43 | 13 | state | coreState | `sidebarState` |
| `theme` | 41 | 10 | state | ✅ 已注册（bodyState） | 保持 |
| `pluginModule` | 30 | 6 | state | coreState | 插件 store |
| `inspector` | 27 | 3 | state（嵌套） | coreState | `inspectorState`（§3.2 拆平试点） |
| `reload` | 24 | 7 | **function** | machinery 挂载面 | 函数面直调（`SCOPED_HANDLER` 收敛） |
| `gifViewer` | 24 | 4 | **function** | coreState/machinery | 函数面直调 |
| `smartFolderMappings` | 21 | 9 | state | coreState（镜像缓存） | `itemCacheStore` |
| `layout` | 21 | 7 | state | ✅ 已注册（bodyState） | 保持 |
| `keyword` | 21 | 6 | state | ✅ 已注册（listState） | 保持 |
| `$evalAsync` | 21 | 12 | **Angular-ism** | shim 方法 | **收口批 E-apply** |
| `itemMappings` | 21 | 10 | state | coreState（镜像缓存） | `itemCacheStore` |
| `selectedMappings` | 20 | 4 | state | coreState | 选区 store |
| `notify` | 18 | 11 | **function** | machinery 挂载面 | 函数面直调 |
| `libraryPath` | 14 | 9 | state | coreState | `appState` |
| `orderBy` | 14 | 5 | state | coreState（注意与 `currentOrderBy` 区分） | `listState` |
| `eagle` | 14 | 3 | state（嵌套） | coreState | `filterState`（`eagle.filter.*` 拆平） |
| `$on` | 14 | 6 | **Angular-ism** | shim `__bus` | **收口批 E-bus** |
| `isInlineMode`/`isCropMode` | 13/13 | — | state | ✅ 已注册（bodyState） | 保持 |
| `gifPlayer` | 13 | 2 | **function** | coreState/machinery | 函数面直调 |
| `currentId` | 12 | 3 | state | coreState | 选区/详情 |
| `currentTag` | 11 | 3 | state | coreState | `filterState`/`tagManagerState` |
| `modifiedMappings` | 10 | 3 | state | coreState（镜像缓存） | `itemCacheStore` |
| `lockedImages` | 10 | 4 | state | coreState | lockState 扩展 |
| `sidebarList` | 10 | 3 | state | coreState | `sidebarState` |
| `uploadQueue` | 9 | 5 | state | coreState | ✅ `uploadState`（queueLength 等） |
| `showSubfolderContent` | 9 | 3 | state | ✅ 已注册（listState） | 保持 |
| `regenerateThumbnailQueue` | 9 | 3 | state | coreState | 新队列 store |

**高疑似假阳性（不下批次，AST 版复核）**：`page(39)`、`item(65)`、`raw(23)`、`ext(15)`、
`snapshot(12)`、`id(12)`、`comments(11)`、`options(9)`、`width(8)`、`lastIndex(9)`、
`hexColor(10)`、`commentRect(10)`、`startCursor(21)`、`rawMetas(18)` 等——多来自
`s`/`item` 等通用名遮蔽。

---

## 3. store 形态与处置（对应计划 §3.1b）

| store 形态 | store | 字段处置 |
|---|---|---|
| **扁平标量** | `bodyState`(22)、`listState`(8)、`lockState`(1)、`toastState`(2)、`uploadState`、`appState` | 可用 `migrateScopeFieldToStore` 逐字段注册式源翻转（现共 33） |
| **快照** | `inspectorState`/`detailState`/`filterState`/`panelState`/`sidebarState`/`tagManagerState`/`toolbarState`（均 `{snapshot:X}`） | **不能直接注册**：要么把标量子字段拆平为新扁平 store，要么改快照为写入真身并改写全部写入点 |
| **新建** | `itemCacheStore`（`allData`/`folderMappings`/`smartFolderMappings`/`itemMappings`/`modifiedMappings`）、`layoutState`（`imageSize`/`containerSize.*`） | 按 §3.1 归属表落位 |

---

## 4. 下一步（工具精确化）

当前启发式无法区分别名遮蔽，**不足以直接切 C 批**。下一步（E1-tool）：

1. 用 TypeScript Compiler API（项目已有 `typescript`）替换启发式：以
   `checker.getSymbolAtLocation` 解析符号，`getBodyScope()` 调用点 → 绑定符号 → 该符号的
   全部 `PropertyAccessExpression`；二级别名、解构、跨函数传递一并覆盖。
2. 产出**精确**「字段 → (文件, 行)」清单，落回本文件并标注可信度。
3. 据此重排计划 §4 的 S/C 批次（尤其 `selected`/`current`/`allData` 三大头与其依赖 store 的设计）。
