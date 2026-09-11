# D-1 / Track B / B-0：dataMachinery.ts 映射表（自动生成）

> 生成器：`tests-tmp/bz-d1-b0-map.py`（只读分析）。施工前请人工复核域归属。

## 0. 总量

- 文件：`src/app/react/core/dataMachinery.ts`，**3735 行**
- 顶层声明：**69**（exported **49** / 私有 **20**）
- import 面：**48** 条
- 引用文件：**30**（`from .../dataMachinery`）

## 1. 域聚类（批次候选）

| 目标域 | 声明数 | 行数（含私有依赖） | 导出数 |
|---|---:|---:|---:|
| MOUNT-INFRA（最后一批/或留共享） | 9 | 1025 | 4 |
| core/keymap | 20 | 627 | 20 |
| filterDomain | 4 | 420 | 2 |
| miscDomain | 21 | 419 | 13 |
| itemDomain | 3 | 146 | 2 |
| stage/grid | 4 | 91 | 4 |
| core/navHistory | 7 | 62 | 4 |
| services/viewOpsService | 1 | 1 | 0 |

### MOUNT-INFRA（最后一批/或留共享）（9 项 / 1025 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `timeoutCache` |  | 107-107 | 1 | - |
| `shimTimeoutInst` |  | 108-108 | 1 | - |
| `getTimeout` | Y | 110-144 | 35 | `shimTimeoutInst`, `timeoutCache` |
| `singletonByScope` |  | 2734-2734 | 1 | - |
| `scopeSingleton` |  | 2735-2740 | 6 | `singletonByScope` |
| `machineryCalls` | Y | 2749-2749 | 1 | - |
| `machinerySeedControllerState` | Y | 2754-3269 | 516 | - |
| `applied` |  | 3271-3271 | 1 | - |
| `applyDataMachineryScope` | Y | 3272-3734 | 463 | `applied`, `getTimeout`, `machineryCalls`, `machineryEnterDetailMode`, `machineryInitMousetrap`, `machineryLeaveDetailMode`, `machineryNotify`, `machineryReload` … |

### core/keymap（20 项 / 627 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryBuildMousetrap` | Y | 997-1135 | 139 | `getPageUpHandlerFn`, `machineryBack`, `machineryKeyCHandler`, `machineryKeyDownHandler`, `machineryKeyLeftHandler`, `machineryKeyPHandler`, `machineryKeyRightHandler`, `machineryKeyUpHandler` … |
| `machineryInitMousetrap` | Y | 1139-1160 | 22 | `machineryBuildMousetrap` |
| `machineryKeyCHandler` | Y | 1447-1452 | 6 | - |
| `machineryKeyPHandler` | Y | 1454-1456 | 3 | `machineryOpenPluginPanel` |
| `machineryKeyLeftHandler` | Y | 1461-1506 | 46 | - |
| `machineryKeyRightHandler` | Y | 1510-1543 | 34 | - |
| `machineryModUpHandler` | Y | 1548-1560 | 13 | `machineryHomeHandler` |
| `machineryModDownHandler` | Y | 1562-1574 | 13 | `machineryEndHandler` |
| `machineryModLeftHandler` | Y | 1576-1590 | 15 | `machineryPrevHistory` |
| `machineryModRightHandler` | Y | 1592-1606 | 15 | `machineryNextHistory` |
| `machineryKeyUpHandler` | Y | 1659-1773 | 115 | `machineryOpenPrevQuickAccess` |
| `machineryKeyDownHandler` | Y | 1781-1914 | 134 | `machineryOpenNextQuickAccess` |
| `machineryPageDownHandler` | Y | 1931-1943 | 13 | - |
| `machineryPageUpHandler` | Y | 1946-1963 | 18 | - |
| `machineryNHandler` | Y | 1987-1998 | 12 | - |
| `machinerySaveHandler` | Y | 2050-2055 | 6 | - |
| `machineryHomeHandler` | Y | 2355-2364 | 10 | - |
| `machineryEndHandler` | Y | 2368-2378 | 11 | - |
| `getPageUpHandlerFn` | Y | 2742-2742 | 1 | `machineryPageUpHandler`, `scopeSingleton` |
| `getPageDownHandlerFn` | Y | 2743-2743 | 1 | `machineryPageDownHandler`, `scopeSingleton` |

### filterDomain（4 项 / 420 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `semanticSearchController` |  | 397-397 | 1 | - |
| `machineryFilterDataPart3` | Y | 411-727 | 317 | `imageSearchController`, `semanticSearchController` |
| `machinerySearchFilter` |  | 2103-2203 | 101 | - |
| `getToggleFilterByTypeFn` | Y | 2744-2744 | 1 | `scopeSingleton` |

### miscDomain（21 项 / 419 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `getLanguageBCP` |  | 147-154 | 8 | - |
| `machineryToggleSlideshow` | Y | 349-355 | 7 | `machineryEnterSlideshowMode`, `machineryLeaveSlideshowMode` |
| `machineryCheckTouchIDSupport` | Y | 367-381 | 15 | - |
| `machineryEnterDetailMode` | Y | 828-922 | 95 | `getTimeout`, `zoomInitTimeout` |
| `machineryLeaveDetailMode` | Y | 927-984 | 58 | `getTimeout`, `machineryFadeOutDetailMode`, `machineryInitMousetrap`, `zoomInitTimeout` |
| `cgStack` |  | 1165-1165 | 1 | - |
| `cgScopes` |  | 1166-1166 | 1 | - |
| `CG_START_TOP` |  | 1167-1167 | 1 | - |
| `CG_SPACING` |  | 1168-1168 | 1 | - |
| `cgBuildTemplate` |  | 1173-1187 | 15 | - |
| `cgRestack` |  | 1190-1202 | 13 | `CG_SPACING`, `CG_START_TOP`, `cgStack` |
| `machineryNotify` | Y | 1208-1297 | 90 | `cgBuildTemplate`, `cgNotifyServiceCloseAll`, `cgRestack`, `cgStack`, `getTimeout`, `undoTimeout` |
| `cgNotifyServiceCloseAll` |  | 1300-1304 | 5 | `cgStack` |
| `machineryToggleDetailMode` | Y | 1360-1362 | 3 | - |
| `machineryQuicklook` | Y | 1397-1439 | 43 | `getPageDownHandlerFn`, `machineryToggleDetailMode` |
| `machineryFadeOutDetailMode` | Y | 2422-2428 | 7 | - |
| `machineryOpenPluginPanel` | Y | 2431-2434 | 4 | - |
| `machineryEnterSlideshowMode` | Y | 2455-2472 | 18 | `getTimeout`, `machineryEnterDetailMode` |
| `machineryLeaveSlideshowMode` | Y | 2475-2490 | 16 | `getTimeout` |
| `machineryLockApp` | Y | 2495-2502 | 8 | `machineryFocusAppUnlockPassword` |
| `machineryFocusAppUnlockPassword` | Y | 2504-2513 | 10 | - |

### itemDomain（3 项 / 146 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machinerySortRawData` | Y | 159-257 | 99 | `getLanguageBCP` |
| `machineryReload` | Y | 294-339 | 46 | `machineryLeaveDetailMode` |
| `imageSearchController` |  | 396-396 | 1 | - |

### stage/grid（4 项 / 91 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryResetPage` | Y | 758-801 | 44 | - |
| `machineryToggleAll` | Y | 2004-2043 | 40 | `getOffsetScrollbarFn`, `getTimeout` |
| `machineryAutoScroll` | Y | 2270-2275 | 6 | `getTimeout` |
| `getOffsetScrollbarFn` | Y | 2741-2741 | 1 | `scopeSingleton` |

### core/navHistory（7 项 / 62 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `undoTimeout` |  | 1169-1169 | 1 | - |
| `machineryUndo` | Y | 1322-1326 | 5 | `cgNotifyServiceCloseAll` |
| `machineryNextHistory` | Y | 1330-1335 | 6 | - |
| `machineryPrevHistory` | Y | 1337-1342 | 6 | - |
| `machineryBack` | Y | 1345-1352 | 8 | `machineryLeaveDetailMode`, `machineryPrevHistory` |
| `machineryOpenPrevQuickAccess` |  | 1613-1624 | 12 | - |
| `machineryOpenNextQuickAccess` |  | 1626-1649 | 24 | - |

### services/viewOpsService（1 项 / 1 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `zoomInitTimeout` |  | 822-822 | 1 | - |

## 2. 跨域共享顶层名（≥2 域引用 —— 最后搬或抽共享模块）

- `machineryLeaveDetailMode`：MOUNT-INFRA（最后一批/或留共享）、core/navHistory、itemDomain
- `getTimeout`：MOUNT-INFRA（最后一批/或留共享）、miscDomain、stage/grid
- `scopeSingleton`：core/keymap、filterDomain、stage/grid
- `machineryInitMousetrap`：MOUNT-INFRA（最后一批/或留共享）、miscDomain
- `machineryPrevHistory`：core/keymap、core/navHistory
- `machineryToggleAll`：MOUNT-INFRA（最后一批/或留共享）、core/keymap
- `machineryToggleDetailMode`：core/keymap、miscDomain
- `cgNotifyServiceCloseAll`：core/navHistory、miscDomain
- `machineryEnterDetailMode`：MOUNT-INFRA（最后一批/或留共享）、miscDomain

## 3. import 依赖面

| 来源 | 具名 |
|---|---|
| `./smoothZoomEngine` | { detailZoom, ensureDetailZoom } |
| `./tagManagerDomain` | { machineryBuildTagManager } |
| `../components/stage7/selectPanelEngine` | { FolderSelectPanel } |
| `./miscDomain` | { updateCurrentOrderAndIncrease } |
| `./itemDomain` | { isInFolder } |
| `../services/gridService` | { gridSaveListHeight, gridAdjustLayoutWidth, gridZoomFit, gridZoomIn, gridZoomOu |
| `../services/detailService` | { detailUpdateZoomRatio, detailSmartZoom, detailToggleDetailMode, beginZoomingTr |
| `../services/mediaService` | { machineryAddVideoComment, machineryNextGifFrame, machineryPrevGifFrame, machin |
| `../utils/func` | { debounce, throttle } |
| `../utils/lang` | { get, isString, max, uniq, unescape, isNumeric } |
| `../utils/domQuery` | { q, qa, qaVisible, widthOf, heightOf, addClass, removeClass, setAttr, cssSet, h |
| `../store/lockState` | { syncFolderLock } |
| `../store/uploadState` | { syncUploadFromScope } |
| `../store/listState` | { syncListFromScope } |
| `../store/panelState` | { syncPanelFromScope } |
| `../store/sidebarState` | { syncSidebarFromScope } |
| `../store/tagManagerState` | { syncTagManagerFromScope } |
| `../store/filterState` | { syncFilterFromScope } |
| `../store/bodyState` | { syncBodyFromScope } |
| `../store/detailState` | { syncDetailFromScope } |
| `../store/inspectorState` | { syncInspectorFromScope } |
| `../store/toolbarState` | { syncToolbarFromScope } |
| `./appCore` | { getBodyScope } |
| `./externalSupply` | { callExternal } |
| `../services/folderCoreService` | { openFolder, openSmartFolder } |
| `../services/selectionService` | { select } |
| `../services/uploadService` | { uploadFiles } |
| `../services/viewOpsService` | { getRatioExp } |
| `./filterDomain` | { resetFilter } |
| `../services/batchOpsService` | { addToRecentFolders } |
| `../services/imageOpsService` | { saveCrop } |
| `./../global/bus` | { moveCropToolChannel, openRenameChannel, resizeCropToolChannel } |
| `../global/bus` | { autoscrollChannel, calculateImageBindingChannel, glRemoveitemsChannel, importA |
| `../global/scopeShim` | { scopeEvalAsync } |
| `../utils/normalize` | { emojiRegex, escapeRegex, getRemainingFilenameLength, getSanitize, pinyinCache  |
| `../utils/color` | { machineryColorSimilarityDistance, machineryRgbToHex } |
| `./keymapActions` | { machineryCloseWindowHandler, machineryDestoryMousetrap, machineryMHandler, mac |
| `./libraryDomain` | { machineryBatchRenameFolders, machineryBatchRenameSmartFolders, machineryGetAnc |
| `../services/gridService` | { buildScrollbarSaver, machineryAdjustLayoutWidth, machineryChangeListHeight, ma |
| `../services/viewOpsService` | { machineryCheckOperationSafety, machineryCheckOperationSafety2, machineryGetRat |
| `./libraryDomain` | { buildRecentFileManager, machineryAddToRecentFile, machineryGetAllChildFolder,  |
| `./itemDomain` | { calculateImageBindingTimeout, machineryCalculateImageBinding, machineryCopyIma |
| `./filterDomain` | { FILTER_ID_MAP, calculateFilterCountsTimeout, getFilter, machineryCalculateFilt |
| `./tagManagerDomain` | { machineryAutoResizeTagFilter, machineryConvertToRegexGroup, machineryMatchWith |
| `./selectionViewDomain` | { machineryGetSelectedItemElements, machineryMultipleSelectDown, machineryMultip |
| `../services/folderCoreService` | { machineryOpenAll, machineryOpenCommunity, machineryOpenRandom, openAllTimeout  |
| `../services/imageOpsService` | { machineryChangeStar, machineryChangeTo1Star, machineryChangeTo2Star, machinery |
| `../services/uploadService` | { machineryOnDropContainer } |

## 4. 建议批次顺序（按依赖自底向上）

1. **低耦合域优先**：`core/navHistory`、`core/keymap`、`utils`、`stage/grid`、
   `services/viewOpsService`、`services/mediaService`、`services/imageOpsService`、
   `services/batchOpsService`、`services/folderCoreService`、`services/uploadService`。
2. **中耦合域**：`selectionViewDomain` → `itemDomain` → `tagManagerDomain` →
   `filterDomain` → `libraryDomain` → `miscDomain`。
3. **MOUNT-INFRA 最后**：`applyDataMachineryScope` / `machineryCalls` / singleton
   基础设施与跨域共享 helper，待各域搬完后再收口，避免 ESM 求值顺序变化
   （见 `externalSupply.ts` 头注：dataMachinery 是全树依赖汇点）。
4. **每批节奏**：改写 → `probe-b5-load` → 定向测试 → 改 30 个引用文件的 import →
   删 dataMachinery 内对应导出 → 提交（≤30 导出 / ≤1500 行）。
5. **自动分类仅供起手**：`## 2` 的共享名与 UNCLASSIFIED 需人工复核（本表由关键字
   规则生成，域归属以语义为准）。

