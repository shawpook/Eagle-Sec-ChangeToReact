# D-1 / Track B / B-0：dataMachinery.ts 映射表（自动生成）

> 生成器：`tests-tmp/bz-d1-b0-map.py`（只读分析）。施工前请人工复核域归属。

## 0. 总量

- 文件：`src/app/react/core/dataMachinery.ts`，**5306 行**
- 顶层声明：**110**（exported **82** / 私有 **28**）
- import 面：**44** 条
- 引用文件：**30**（`from .../dataMachinery`）

## 1. 域聚类（批次候选）

| 目标域 | 声明数 | 行数（含私有依赖） | 导出数 |
|---|---:|---:|---:|
| selectionViewDomain | 24 | 1110 | 21 |
| MOUNT-INFRA（最后一批/或留共享） | 9 | 1025 | 4 |
| core/keymap | 20 | 627 | 20 |
| filterDomain | 4 | 420 | 2 |
| miscDomain | 21 | 419 | 13 |
| services/uploadService | 1 | 219 | 1 |
| itemDomain | 3 | 146 | 2 |
| services/folderCoreService | 5 | 115 | 3 |
| stage/grid | 4 | 91 | 4 |
| services/imageOpsService | 7 | 86 | 7 |
| core/navHistory | 9 | 64 | 4 |
| services/batchOpsService | 1 | 24 | 1 |
| services/viewOpsService | 1 | 1 | 0 |
| libraryDomain | 1 | 1 | 0 |

### selectionViewDomain（24 项 / 1110 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `updateSelectionTimeout` |  | 739-739 | 1 | - |
| `machineryUpdateSelection` | Y | 741-929 | 189 | `getTimeout`, `machineryCalls`, `sortTagsForSelection`, `updateSelectionTimeout` |
| `sortTagsForSelection` |  | 932-965 | 34 | - |
| `machineryGetSelection` | Y | 978-995 | 18 | - |
| `cleanSelectedTimeout` |  | 1649-1649 | 1 | - |
| `machinerySelectAll` | Y | 1652-1672 | 21 | `cleanSelectedTimeout`, `getTimeout` |
| `machinerySelectNext` | Y | 1688-1745 | 58 | `getTimeout`, `machineryAutoScroll`, `machineryGetSelection`, `nextTimeout` |
| `machinerySelectPrev` | Y | 1749-1815 | 67 | `getTimeout`, `machineryAutoScroll`, `machineryGetSelection`, `prevTimeout` |
| `machineryMultipleSelectUp` | Y | 1820-1828 | 9 | `machineryMultipleSelectPrev` |
| `machineryMultipleSelectDown` | Y | 1831-1839 | 9 | `machineryMultipleSelectNext` |
| `machineryMultipleSelectNext` | Y | 1843-1870 | 28 | `machineryAutoScroll`, `machineryGetSelection` |
| `machineryMultipleSelectPrev` | Y | 1874-1901 | 28 | `machineryAutoScroll`, `machineryGetSelection` |
| `machineryRemoveSelected` | Y | 1913-2149 | 237 | `getTimeout`, `lastMoveToTrashCheckbox`, `machineryAutoScroll`, `machineryGetSelectedItemElements`, `machineryGetSelectedTags`, `machineryGetSelection`, `machineryLeaveDetailMode`, `machineryRemovePermanently` … |
| `machinerySelectUp` | Y | 2728-2791 | 64 | `machineryAutoScroll`, `machineryGetSelection` |
| `machinerySelectDown` | Y | 2793-2855 | 63 | `machineryAutoScroll`, `machineryGetSelection` |
| `machineryOpenInspectorTagSelectPanel` | Y | 2983-2986 | 4 | - |
| `machineryOpenInspectorFolderSelectPanel` | Y | 2998-3162 | 165 | `machineryUpdateSelection` |
| `machineryGetSelectedItems` | Y | 3491-3502 | 12 | - |
| `machineryGetSelectedItemElements` | Y | 3505-3515 | 11 | `machineryGetSelectedItems` |
| `machineryGetSelectedTags` | Y | 3518-3521 | 4 | - |
| `machineryRemoveSelectedFolders` | Y | 3671-3709 | 39 | - |
| `machineryRemoveSelectedSmartFolders` | Y | 3713-3740 | 28 | - |
| `machineryToggleSelectSmartFolder` | Y | 3887-3892 | 6 | - |
| `machinerySelectFolder` | Y | 4234-4247 | 14 | `machineryUpdateSelection` |

### MOUNT-INFRA（最后一批/或留共享）（9 项 / 1025 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `timeoutCache` |  | 103-103 | 1 | - |
| `shimTimeoutInst` |  | 104-104 | 1 | - |
| `getTimeout` | Y | 106-140 | 35 | `shimTimeoutInst`, `timeoutCache` |
| `singletonByScope` |  | 4305-4305 | 1 | - |
| `scopeSingleton` |  | 4306-4311 | 6 | `singletonByScope` |
| `machineryCalls` | Y | 4320-4320 | 1 | - |
| `machinerySeedControllerState` | Y | 4325-4840 | 516 | - |
| `applied` |  | 4842-4842 | 1 | - |
| `applyDataMachineryScope` | Y | 4843-5305 | 463 | `applied`, `getTimeout`, `machineryCalls`, `machineryChangeStar`, `machineryEnterDetailMode`, `machineryInitMousetrap`, `machineryLeaveDetailMode`, `machineryNotify` … |

### core/keymap（20 项 / 627 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryBuildMousetrap` | Y | 1289-1427 | 139 | `getPageUpHandlerFn`, `machineryBack`, `machineryChangeTo1Star`, `machineryChangeTo2Star`, `machineryChangeTo3Star`, `machineryChangeTo4Star`, `machineryChangeTo5Star`, `machineryKeyCHandler` … |
| `machineryInitMousetrap` | Y | 1431-1452 | 22 | `machineryBuildMousetrap` |
| `machineryKeyCHandler` | Y | 2206-2211 | 6 | - |
| `machineryKeyPHandler` | Y | 2213-2215 | 3 | `machineryOpenPluginPanel` |
| `machineryKeyLeftHandler` | Y | 2220-2265 | 46 | `machinerySelectPrev` |
| `machineryKeyRightHandler` | Y | 2269-2302 | 34 | `machinerySelectNext` |
| `machineryModUpHandler` | Y | 2307-2319 | 13 | `machineryHomeHandler` |
| `machineryModDownHandler` | Y | 2321-2333 | 13 | `machineryEndHandler` |
| `machineryModLeftHandler` | Y | 2335-2349 | 15 | `machineryPrevHistory` |
| `machineryModRightHandler` | Y | 2351-2365 | 15 | `machineryNextHistory` |
| `machineryKeyUpHandler` | Y | 2418-2532 | 115 | `machineryOpenAll`, `machineryOpenCommunity`, `machineryOpenPrevQuickAccess`, `machineryOpenRandom`, `machinerySelectUp` |
| `machineryKeyDownHandler` | Y | 2540-2673 | 134 | `machineryOpenCommunity`, `machineryOpenNextQuickAccess`, `machineryOpenRandom`, `machinerySelectDown` |
| `machineryPageDownHandler` | Y | 2690-2702 | 13 | - |
| `machineryPageUpHandler` | Y | 2705-2722 | 18 | - |
| `machineryNHandler` | Y | 2897-2908 | 12 | - |
| `machinerySaveHandler` | Y | 2960-2965 | 6 | - |
| `machineryHomeHandler` | Y | 3595-3604 | 10 | - |
| `machineryEndHandler` | Y | 3608-3618 | 11 | - |
| `getPageUpHandlerFn` | Y | 4313-4313 | 1 | `machineryPageUpHandler`, `scopeSingleton` |
| `getPageDownHandlerFn` | Y | 4314-4314 | 1 | `machineryPageDownHandler`, `scopeSingleton` |

### filterDomain（4 项 / 420 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `semanticSearchController` |  | 393-393 | 1 | - |
| `machineryFilterDataPart3` | Y | 407-723 | 317 | `imageSearchController`, `semanticSearchController` |
| `machinerySearchFilter` |  | 3245-3345 | 101 | - |
| `getToggleFilterByTypeFn` | Y | 4315-4315 | 1 | `scopeSingleton` |

### miscDomain（21 项 / 419 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `getLanguageBCP` |  | 143-150 | 8 | - |
| `machineryToggleSlideshow` | Y | 345-351 | 7 | `machineryEnterSlideshowMode`, `machineryLeaveSlideshowMode` |
| `machineryCheckTouchIDSupport` | Y | 363-377 | 15 | - |
| `machineryEnterDetailMode` | Y | 1120-1214 | 95 | `getTimeout`, `zoomInitTimeout` |
| `machineryLeaveDetailMode` | Y | 1219-1276 | 58 | `getTimeout`, `machineryFadeOutDetailMode`, `machineryInitMousetrap`, `zoomInitTimeout` |
| `cgStack` |  | 1457-1457 | 1 | - |
| `cgScopes` |  | 1458-1458 | 1 | - |
| `CG_START_TOP` |  | 1459-1459 | 1 | - |
| `CG_SPACING` |  | 1460-1460 | 1 | - |
| `cgBuildTemplate` |  | 1465-1479 | 15 | - |
| `cgRestack` |  | 1482-1494 | 13 | `CG_SPACING`, `CG_START_TOP`, `cgStack` |
| `machineryNotify` | Y | 1500-1589 | 90 | `cgBuildTemplate`, `cgNotifyServiceCloseAll`, `cgRestack`, `cgStack`, `getTimeout`, `undoTimeout` |
| `cgNotifyServiceCloseAll` |  | 1592-1596 | 5 | `cgStack` |
| `machineryToggleDetailMode` | Y | 1676-1678 | 3 | - |
| `machineryQuicklook` | Y | 2156-2198 | 43 | `getPageDownHandlerFn`, `machineryToggleDetailMode` |
| `machineryFadeOutDetailMode` | Y | 3753-3759 | 7 | - |
| `machineryOpenPluginPanel` | Y | 3762-3765 | 4 | - |
| `machineryEnterSlideshowMode` | Y | 3786-3803 | 18 | `getTimeout`, `machineryEnterDetailMode` |
| `machineryLeaveSlideshowMode` | Y | 3806-3821 | 16 | `getTimeout` |
| `machineryLockApp` | Y | 3826-3833 | 8 | `machineryFocusAppUnlockPassword` |
| `machineryFocusAppUnlockPassword` | Y | 3835-3844 | 10 | - |

### services/uploadService（1 项 / 219 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryOnDropContainer` | Y | 3969-4187 | 219 | - |

### itemDomain（3 项 / 146 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machinerySortRawData` | Y | 155-253 | 99 | `getLanguageBCP` |
| `machineryReload` | Y | 290-335 | 46 | `machineryLeaveDetailMode`, `machineryUpdateSelection` |
| `imageSearchController` |  | 392-392 | 1 | - |

### services/folderCoreService（5 项 / 115 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `openAllTimeout` |  | 1051-1051 | 1 | - |
| `machineryOpenAll` | Y | 1062-1109 | 48 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `openAllTimeout` |
| `openRandomTimeout` |  | 3376-3376 | 1 | - |
| `machineryOpenRandom` | Y | 3382-3423 | 42 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `openRandomTimeout` |
| `machineryOpenCommunity` | Y | 3432-3454 | 23 | `machineryLeaveDetailMode`, `machineryResetPage` |

### stage/grid（4 项 / 91 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryResetPage` | Y | 1000-1043 | 44 | - |
| `machineryToggleAll` | Y | 2914-2953 | 40 | `getOffsetScrollbarFn`, `getTimeout` |
| `machineryAutoScroll` | Y | 3481-3486 | 6 | `getTimeout` |
| `getOffsetScrollbarFn` | Y | 4312-4312 | 1 | `scopeSingleton` |

### services/imageOpsService（7 项 / 86 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryChangeTo5Star` | Y | 2860-2863 | 4 | `machineryChangeStar` |
| `machineryRemoveStar` | Y | 2868-2870 | 3 | `machineryChangeStar` |
| `machineryChangeTo1Star` | Y | 2872-2875 | 4 | `machineryChangeStar` |
| `machineryChangeTo2Star` | Y | 2877-2880 | 4 | `machineryChangeStar` |
| `machineryChangeTo3Star` | Y | 2882-2885 | 4 | `machineryChangeStar` |
| `machineryChangeTo4Star` | Y | 2887-2890 | 4 | `machineryChangeStar` |
| `machineryChangeStar` | Y | 3173-3235 | 63 | - |

### core/navHistory（9 项 / 64 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `undoTimeout` |  | 1461-1461 | 1 | - |
| `machineryUndo` | Y | 1614-1618 | 5 | `cgNotifyServiceCloseAll` |
| `machineryNextHistory` | Y | 1622-1627 | 6 | - |
| `machineryPrevHistory` | Y | 1629-1634 | 6 | - |
| `machineryBack` | Y | 1637-1644 | 8 | `machineryLeaveDetailMode`, `machineryPrevHistory` |
| `nextTimeout` |  | 1683-1683 | 1 | - |
| `prevTimeout` |  | 1684-1684 | 1 | - |
| `machineryOpenPrevQuickAccess` |  | 2372-2383 | 12 | - |
| `machineryOpenNextQuickAccess` |  | 2385-2408 | 24 | - |

### services/batchOpsService（1 项 / 24 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryRemovePermanently` | Y | 3631-3654 | 24 | `machineryGetSelectedItemElements`, `machineryUpdateSelection` |

### services/viewOpsService（1 项 / 1 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `zoomInitTimeout` |  | 1114-1114 | 1 | - |

### libraryDomain（1 项 / 1 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `lastMoveToTrashCheckbox` |  | 1906-1906 | 1 | - |

## 2. 跨域共享顶层名（≥2 域引用 —— 最后搬或抽共享模块）

- `machineryLeaveDetailMode`：MOUNT-INFRA（最后一批/或留共享）、core/navHistory、itemDomain、selectionViewDomain、services/folderCoreService
- `getTimeout`：MOUNT-INFRA（最后一批/或留共享）、miscDomain、selectionViewDomain、services/folderCoreService、stage/grid
- `machineryUpdateSelection`：MOUNT-INFRA（最后一批/或留共享）、itemDomain、selectionViewDomain、services/batchOpsService
- `scopeSingleton`：core/keymap、filterDomain、stage/grid
- `machineryCalls`：MOUNT-INFRA（最后一批/或留共享）、selectionViewDomain
- `machineryInitMousetrap`：MOUNT-INFRA（最后一批/或留共享）、miscDomain
- `machineryMultipleSelectNext`：core/keymap、selectionViewDomain
- `machineryMultipleSelectPrev`：core/keymap、selectionViewDomain
- `machineryPrevHistory`：core/keymap、core/navHistory
- `machineryRemoveSelected`：MOUNT-INFRA（最后一批/或留共享）、core/keymap
- `machineryToggleAll`：MOUNT-INFRA（最后一批/或留共享）、core/keymap
- `machineryToggleDetailMode`：core/keymap、miscDomain
- `cgNotifyServiceCloseAll`：core/navHistory、miscDomain
- `machineryGetSelectedItemElements`：selectionViewDomain、services/batchOpsService
- `machinerySelectPrev`：MOUNT-INFRA（最后一批/或留共享）、core/keymap
- `machinerySelectNext`：MOUNT-INFRA（最后一批/或留共享）、core/keymap
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

