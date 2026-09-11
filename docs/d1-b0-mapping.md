# D-1 / Track B / B-0：dataMachinery.ts 映射表（自动生成）

> 生成器：`tests-tmp/bz-d1-b0-map.py`（只读分析）。施工前请人工复核域归属。

## 0. 总量

- 文件：`src/app/react/core/dataMachinery.ts`，**4181 行**
- 顶层声明：**83**（exported **61** / 私有 **22**）
- import 面：**45** 条
- 引用文件：**30**（`from .../dataMachinery`）

## 1. 域聚类（批次候选）

| 目标域 | 声明数 | 行数（含私有依赖） | 导出数 |
|---|---:|---:|---:|
| MOUNT-INFRA（最后一批/或留共享） | 9 | 1025 | 4 |
| core/keymap | 20 | 627 | 20 |
| filterDomain | 4 | 420 | 2 |
| miscDomain | 21 | 419 | 13 |
| services/uploadService | 1 | 219 | 1 |
| itemDomain | 3 | 146 | 2 |
| services/folderCoreService | 5 | 115 | 3 |
| stage/grid | 4 | 91 | 4 |
| services/imageOpsService | 7 | 86 | 7 |
| core/navHistory | 7 | 62 | 4 |
| services/batchOpsService | 1 | 24 | 1 |
| services/viewOpsService | 1 | 1 | 0 |

### MOUNT-INFRA（最后一批/或留共享）（9 项 / 1025 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `timeoutCache` |  | 104-104 | 1 | - |
| `shimTimeoutInst` |  | 105-105 | 1 | - |
| `getTimeout` | Y | 107-141 | 35 | `shimTimeoutInst`, `timeoutCache` |
| `singletonByScope` |  | 3180-3180 | 1 | - |
| `scopeSingleton` |  | 3181-3186 | 6 | `singletonByScope` |
| `machineryCalls` | Y | 3195-3195 | 1 | - |
| `machinerySeedControllerState` | Y | 3200-3715 | 516 | - |
| `applied` |  | 3717-3717 | 1 | - |
| `applyDataMachineryScope` | Y | 3718-4180 | 463 | `applied`, `getTimeout`, `machineryCalls`, `machineryChangeStar`, `machineryEnterDetailMode`, `machineryInitMousetrap`, `machineryLeaveDetailMode`, `machineryNotify` … |

### core/keymap（20 项 / 627 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryBuildMousetrap` | Y | 1044-1182 | 139 | `getPageUpHandlerFn`, `machineryBack`, `machineryChangeTo1Star`, `machineryChangeTo2Star`, `machineryChangeTo3Star`, `machineryChangeTo4Star`, `machineryChangeTo5Star`, `machineryKeyCHandler` … |
| `machineryInitMousetrap` | Y | 1186-1207 | 22 | `machineryBuildMousetrap` |
| `machineryKeyCHandler` | Y | 1494-1499 | 6 | - |
| `machineryKeyPHandler` | Y | 1501-1503 | 3 | `machineryOpenPluginPanel` |
| `machineryKeyLeftHandler` | Y | 1508-1553 | 46 | - |
| `machineryKeyRightHandler` | Y | 1557-1590 | 34 | - |
| `machineryModUpHandler` | Y | 1595-1607 | 13 | `machineryHomeHandler` |
| `machineryModDownHandler` | Y | 1609-1621 | 13 | `machineryEndHandler` |
| `machineryModLeftHandler` | Y | 1623-1637 | 15 | `machineryPrevHistory` |
| `machineryModRightHandler` | Y | 1639-1653 | 15 | `machineryNextHistory` |
| `machineryKeyUpHandler` | Y | 1706-1820 | 115 | `machineryOpenAll`, `machineryOpenCommunity`, `machineryOpenPrevQuickAccess`, `machineryOpenRandom` |
| `machineryKeyDownHandler` | Y | 1828-1961 | 134 | `machineryOpenCommunity`, `machineryOpenNextQuickAccess`, `machineryOpenRandom` |
| `machineryPageDownHandler` | Y | 1978-1990 | 13 | - |
| `machineryPageUpHandler` | Y | 1993-2010 | 18 | - |
| `machineryNHandler` | Y | 2058-2069 | 12 | - |
| `machinerySaveHandler` | Y | 2121-2126 | 6 | - |
| `machineryHomeHandler` | Y | 2558-2567 | 10 | - |
| `machineryEndHandler` | Y | 2571-2581 | 11 | - |
| `getPageUpHandlerFn` | Y | 3188-3188 | 1 | `machineryPageUpHandler`, `scopeSingleton` |
| `getPageDownHandlerFn` | Y | 3189-3189 | 1 | `machineryPageDownHandler`, `scopeSingleton` |

### filterDomain（4 项 / 420 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `semanticSearchController` |  | 394-394 | 1 | - |
| `machineryFilterDataPart3` | Y | 408-724 | 317 | `imageSearchController`, `semanticSearchController` |
| `machinerySearchFilter` |  | 2237-2337 | 101 | - |
| `getToggleFilterByTypeFn` | Y | 3190-3190 | 1 | `scopeSingleton` |

### miscDomain（21 项 / 419 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `getLanguageBCP` |  | 144-151 | 8 | - |
| `machineryToggleSlideshow` | Y | 346-352 | 7 | `machineryEnterSlideshowMode`, `machineryLeaveSlideshowMode` |
| `machineryCheckTouchIDSupport` | Y | 364-378 | 15 | - |
| `machineryEnterDetailMode` | Y | 875-969 | 95 | `getTimeout`, `zoomInitTimeout` |
| `machineryLeaveDetailMode` | Y | 974-1031 | 58 | `getTimeout`, `machineryFadeOutDetailMode`, `machineryInitMousetrap`, `zoomInitTimeout` |
| `cgStack` |  | 1212-1212 | 1 | - |
| `cgScopes` |  | 1213-1213 | 1 | - |
| `CG_START_TOP` |  | 1214-1214 | 1 | - |
| `CG_SPACING` |  | 1215-1215 | 1 | - |
| `cgBuildTemplate` |  | 1220-1234 | 15 | - |
| `cgRestack` |  | 1237-1249 | 13 | `CG_SPACING`, `CG_START_TOP`, `cgStack` |
| `machineryNotify` | Y | 1255-1344 | 90 | `cgBuildTemplate`, `cgNotifyServiceCloseAll`, `cgRestack`, `cgStack`, `getTimeout`, `undoTimeout` |
| `cgNotifyServiceCloseAll` |  | 1347-1351 | 5 | `cgStack` |
| `machineryToggleDetailMode` | Y | 1407-1409 | 3 | - |
| `machineryQuicklook` | Y | 1444-1486 | 43 | `getPageDownHandlerFn`, `machineryToggleDetailMode` |
| `machineryFadeOutDetailMode` | Y | 2649-2655 | 7 | - |
| `machineryOpenPluginPanel` | Y | 2658-2661 | 4 | - |
| `machineryEnterSlideshowMode` | Y | 2682-2699 | 18 | `getTimeout`, `machineryEnterDetailMode` |
| `machineryLeaveSlideshowMode` | Y | 2702-2717 | 16 | `getTimeout` |
| `machineryLockApp` | Y | 2722-2729 | 8 | `machineryFocusAppUnlockPassword` |
| `machineryFocusAppUnlockPassword` | Y | 2731-2740 | 10 | - |

### services/uploadService（1 项 / 219 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryOnDropContainer` | Y | 2859-3077 | 219 | - |

### itemDomain（3 项 / 146 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machinerySortRawData` | Y | 156-254 | 99 | `getLanguageBCP` |
| `machineryReload` | Y | 291-336 | 46 | `machineryLeaveDetailMode` |
| `imageSearchController` |  | 393-393 | 1 | - |

### services/folderCoreService（5 项 / 115 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `openAllTimeout` |  | 806-806 | 1 | - |
| `machineryOpenAll` | Y | 817-864 | 48 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `openAllTimeout` |
| `openRandomTimeout` |  | 2368-2368 | 1 | - |
| `machineryOpenRandom` | Y | 2374-2415 | 42 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `openRandomTimeout` |
| `machineryOpenCommunity` | Y | 2424-2446 | 23 | `machineryLeaveDetailMode`, `machineryResetPage` |

### stage/grid（4 项 / 91 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryResetPage` | Y | 755-798 | 44 | - |
| `machineryToggleAll` | Y | 2075-2114 | 40 | `getOffsetScrollbarFn`, `getTimeout` |
| `machineryAutoScroll` | Y | 2473-2478 | 6 | `getTimeout` |
| `getOffsetScrollbarFn` | Y | 3187-3187 | 1 | `scopeSingleton` |

### services/imageOpsService（7 项 / 86 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryChangeTo5Star` | Y | 2021-2024 | 4 | `machineryChangeStar` |
| `machineryRemoveStar` | Y | 2029-2031 | 3 | `machineryChangeStar` |
| `machineryChangeTo1Star` | Y | 2033-2036 | 4 | `machineryChangeStar` |
| `machineryChangeTo2Star` | Y | 2038-2041 | 4 | `machineryChangeStar` |
| `machineryChangeTo3Star` | Y | 2043-2046 | 4 | `machineryChangeStar` |
| `machineryChangeTo4Star` | Y | 2048-2051 | 4 | `machineryChangeStar` |
| `machineryChangeStar` | Y | 2165-2227 | 63 | - |

### core/navHistory（7 项 / 62 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `undoTimeout` |  | 1216-1216 | 1 | - |
| `machineryUndo` | Y | 1369-1373 | 5 | `cgNotifyServiceCloseAll` |
| `machineryNextHistory` | Y | 1377-1382 | 6 | - |
| `machineryPrevHistory` | Y | 1384-1389 | 6 | - |
| `machineryBack` | Y | 1392-1399 | 8 | `machineryLeaveDetailMode`, `machineryPrevHistory` |
| `machineryOpenPrevQuickAccess` |  | 1660-1671 | 12 | - |
| `machineryOpenNextQuickAccess` |  | 1673-1696 | 24 | - |

### services/batchOpsService（1 项 / 24 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryRemovePermanently` | Y | 2594-2617 | 24 | - |

### services/viewOpsService（1 项 / 1 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `zoomInitTimeout` |  | 869-869 | 1 | - |

## 2. 跨域共享顶层名（≥2 域引用 —— 最后搬或抽共享模块）

- `machineryLeaveDetailMode`：MOUNT-INFRA（最后一批/或留共享）、core/navHistory、itemDomain、services/folderCoreService
- `getTimeout`：MOUNT-INFRA（最后一批/或留共享）、miscDomain、services/folderCoreService、stage/grid
- `scopeSingleton`：core/keymap、filterDomain、stage/grid
- `machineryInitMousetrap`：MOUNT-INFRA（最后一批/或留共享）、miscDomain
- `machineryPrevHistory`：core/keymap、core/navHistory
- `machineryToggleAll`：MOUNT-INFRA（最后一批/或留共享）、core/keymap
- `machineryToggleDetailMode`：core/keymap、miscDomain
- `cgNotifyServiceCloseAll`：core/navHistory、miscDomain
- `machineryChangeStar`：MOUNT-INFRA（最后一批/或留共享）、services/imageOpsService
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

