# E1 字段映射表 v2（AST 精确版：`$bodyScope` 访问面 → store 归属）

> 生成时间：2026-09-12　工具：`tests-tmp/e1-scope-access.mjs`（TypeScript Compiler API，符号级）
> 配套：`docs/e-phase-plan-2026-09-12.md`
> **v2 说明**：v1 是启发式（正则 + 别名猜测，假阳性多）；v2 用 AST + `checker.getSymbolAtLocation`
> 做符号绑定，覆盖别名赋值、解构、`scopeApply`/`runInBodyScope` 回调首参、可选链 `?.`、
> `$root` 嵌套链，并区分「读」与「调用」。**本表为 E2/E3 的施工依据。**

---

## 1. 总量（2026-09-12 实测）

| 指标 | 值 |
|---|---|
| `getBodyScope()` 调用点（AST） | **764** |
| 绑定到的 scope 符号 | **518**（别名 182×`s`、69×`body`、28×`scope`、13×`bodyScope`、`sc`/`b`/…） |
| 直接链 `getBodyScope().X` | **197** |
| 顶层字段 | **209 个**，访问 **1974** 次 |
| 叶子名（含嵌套） | 318 |
| unclassified（作实参传给 machinery 等） | **31**（均非字段读，属函数面传参） |

> 顶层字段虽 209 个，但**头部集中**：前 20 个覆盖 ~1400 次访问。E2/E3 按头部优先切批。

---

## 2. 顶层字段 → 归属 store（前 60，按访问量）

| 读 | 调 | 文件 | 字段 | 归属 store | 备注 |
|---:|---:|---:|---|---|---|
| 302 | 13 | 20 | `$root` | 见 §3 | `$root` 即 proxy 自身，嵌套见 §3 |
| 130 | 10 | 18 | `selected` | **selectionState**（新） | 选区数组 |
| 101 | 0 | 15 | `folderMappings` | **itemState**（新） | 镜像缓存 |
| 74 | 13 | 14 | `TagManager` | tagManagerState（扩真身） | 现为快照 store |
| 72 | 0 | 11 | `current` | **selectionState** | 当前详情项 |
| 68 | 0 | 13 | `currentFolder` | **folderState**（新） | |
| 63 | 1 | 8 | `allData` | **itemState** | 全量镜像 |
| 60 | 0 | 5 | `imageSize` | **layoutState**（新） | `imageSize.height/zoomRatioExp` |
| 47 | 9 | 11 | `folders` | **folderState** | `folders.forEach/push/...` |
| 49 | 1 | 2 | `inspector` | inspectorState（拆平） | E2 试点嵌套组 |
| 46 | 0 | 12 | `currentSmartFolder` | **folderState** | |
| 36 | 8 | 6 | `pluginModule` | **pluginState**（新） | 含方法调用 |
| 30 | 3 | 9 | `raw` | **itemState** | 原始列表 |
| 31 | 0 | 8 | `itemMappings` | **itemState** | |
| 31 | 0 | 7 | `theme` | bodyState ✅已注册 | |
| 29 | 0 | 3 | `preferences` | **preferencesState**（新） | `$root.preferences.*` 拆平 |
| 27 | 0 | 7 | `viewMode` | bodyState ✅ | |
| 21 | 3 | 6 | `trash` | **itemState** | |
| 23 | 0 | 7 | `smartFolderMappings` | **itemState** | |
| 21 | 0 | 11 | `libraryPath` | appState | |
| 20 | 0 | 6 | `isDetailMode` | bodyState ✅ | |
| 19 | 0 | 4 | `startCursor` | **navState**（新） | |
| 9 | 10 | 5 | `$evalAsync` | — | **E1c 清盲区** |
| 17 | 0 | 4 | `rootDir` | appState | |
| 14 | 3 | 5 | `keyword` | listState ✅ | |
| 1 | 12 | 1 | `notify` | — | 函数面（已挂载） |
| 8 | 4 | 6 | `uploadQueue` | uploadState | |
| 12 | 0 | 3 | `subFolderSortableOptions` | layoutState / misc | 对象面 |
| 10 | 2 | 2 | `subFolders` | folderState | |
| 9 | 3 | 2 | `gifViewer` | — | 函数/对象面 |
| 10 | 1 | 5 | `all` | **itemState** | |
| 11 | 0 | 3 | `lockedImages` | **itemState** | |
| 11 | 0 | 4 | `selectedMappings` | **itemState** | |
| 9 | 2 | 2 | `regenerateThumbnailQueue` | **queueState**（新）/misc | |
| 8 | 2 | 1 | `SavedFilter` | filterState | |
| 9 | 1 | 4 | `folderList` | **folderState** | |
| 10 | 0 | 3 | `eagle` | filterState | `eagle.filter.*` |
| 9 | 0 | 2 | `modifiedMappings` | **itemState** | |
| 9 | 0 | 2 | `lastIndex` | **selectionState** | |
| 8 | 1 | 5 | `smartFolders` | **folderState** | |
| 7 | 2 | 2 | `UrlStateService` | misc | |
| 8 | 0 | 4 | `selectedFolderMappings` | **itemState** | |
| 8 | 0 | 4 | `unfiledCount` | listState ✅ | |
| 7 | 0 | 1 | `trialRemain` | **preferencesState** | |
| 7 | 0 | 2 | `isLoading` | bodyState ✅ | |
| 7 | 0 | 4 | `imagesDir` | appState | |
| 7 | 0 | 2 | `showSubfolderContent` | listState ✅ | |
| 6 | 0 | 2 | `isCropMode` | bodyState ✅ | |
| 6 | 0 | 4 | `orderBy` | listState（≠`currentOrderBy`） | 需确认归属 |
| 6 | 0 | 1 | `isRotating` | misc/detailState | |
| 6 | 0 | 2 | `__eagleShim` | — | shim 自身，E4 随壳删 |
| 6 | 0 | 1 | `finishGenerateQueue` | queueState | |
| 5 | 0 | 3 | `lazyLoadManager` | misc | |
| 5 | 0 | 4 | `untaggedCount` | listState ✅ | |
| 5 | 0 | 3 | `tags` | folderState/tagManagerState | |
| 5 | 1 | 1 | `keywordSuggestions` | filterState | |
| 5 | 0 | 2 | `globalKeywords` | filterState | |
| 5 | 0 | 1 | `useMpvPlayer` | detailState | |
| 5 | 0 | 1 | `commentRect` | detailState | |
| 5 | 0 | 1 | `isCommentMode` | bodyState ✅ | |

其余 ~149 个字段各 ≤4 次，见 `node tests-tmp/e1-scope-access.mjs` 输出。

---

## 3. `$root` 面（302 次，最重）

`$root` 是 proxy 自身（`scopeShim.ts:203/233`），故 `$root.X` ≡ body scope 的 X。嵌套路径实测：

| 路径 | 次数 | 归属 |
|---|---:|---|
| `$root.preferences` | 54 | **preferencesState**（`preferences.general/habits/notification/shortcuts.*` 拆平） |
| `$root.preferences.sidebar` | 22 | preferencesState |
| `$root.selectedFolders` | 13 | **selectionState** |
| `$root.selectedSmartFolders` | 7 | selectionState |
| `$root.notify` | 12（调） | 函数面（`machineryInfra.ts:141-143` 挂载） |
| `$root.currentFocus` / `isAppLocked` / `language` / `imagesDir` / `currentColor` | 余量 | selectionState / lockState / bodyState / appState |
| `$root.undo` / `closeAll` / `initMenu` / `toggleFullScreen` / `removeComment` | 少量 | 函数面，多数**未挂载**（诚实失败/死码） |

→ E3-7 专批：把 `$root.` 全部改写为归属 store；`rootAccess 367 → 0`。

---

## 4. 别名与 unclassified

- 主要别名：`s`(182)、`body`(69)、`scope`(28)、`bodyScope`(13)、`pluginModule`(由 `const pluginModule = getBodyScope()` 得名，易误判)、`sc`(20)、`b`(16)。
- `scopeApply(getBodyScope(), (s) => …)` 的回调首参已计入（E1b 后改为 `runInBodyScope((s) => …)`，需同步更新提取器识别 `runInBodyScope`，已内置）。
- **unclassified 31 处**全部是 `getBodyScope()` 作首参传给 `machinery*`（如 `inspectorActions.ts:281 machineryUpdateItemView`、`folderCoreService.ts:745 machinerySetViewMode`、`FolderModals.tsx:155 machineryFilterData`）——属**函数面传参**，不是字段读；E3-8（字符串分发/直调化）时一并处理。

---

## 5. 给 E2/E3 的结论

1. **E2 建 store 的字段优先级**：`selected / folderMappings / current / currentFolder / allData / imageSize / folders / TagManager / currentSmartFolder / raw / itemMappings / trash / smartFolderMappings / all / lockedImages / selectedMappings / modifiedMappings / lastIndex / startCursor / preferences / pluginModule / folderList / smartFolders` + `$root.*` 面。
2. **E2 试点**：`inspector.*` 嵌套拆平（49 次、仅 2 文件），验证嵌套成本后再铺开。
3. **E3 切片**：按 §2 文件数列与本地图 `--field <name>` 明细切；头部 6 个字段（`$root/selected/folderMappings/TagManager/current/currentFolder`）覆盖 ~700 次访问，应优先。
4. **哨兵可判**：`getBodyScope 793 → 0`、`rootAccess 367 → 0`、`scopeEvalAsync 357 → 0`、`scopeApply 200 → 0` 即 DoD ② 的机器判据。
