# D-1 / Track B / B-0：dataMachinery.ts 映射表（自动生成）

> 生成器：`tests-tmp/bz-d1-b0-map.py`（只读分析）。施工前请人工复核域归属。

## 0. 总量

- 文件：`src/app/react/core/dataMachinery.ts`，**6130 行**
- 顶层声明：**132**（exported **96** / 私有 **36**）
- import 面：**43** 条
- 引用文件：**30**（`from .../dataMachinery`）

## 1. 域聚类（批次候选）

| 目标域 | 声明数 | 行数（含私有依赖） | 导出数 |
|---|---:|---:|---:|
| selectionViewDomain | 25 | 1111 | 21 |
| MOUNT-INFRA（最后一批/或留共享） | 9 | 1025 | 4 |
| tagManagerDomain | 21 | 817 | 14 |
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

### selectionViewDomain（25 项 / 1111 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `updateSelectionTimeout` |  | 878-878 | 1 | - |
| `machineryUpdateSelection` | Y | 880-1068 | 189 | `getTimeout`, `machineryCalls`, `sortTagsForSelection`, `updateSelectionTimeout` |
| `sortTagsForSelection` |  | 1071-1104 | 34 | - |
| `machineryGetSelection` | Y | 1117-1134 | 18 | - |
| `cleanSelectedTimeout` |  | 1788-1788 | 1 | - |
| `machinerySelectAll` | Y | 1791-1811 | 21 | `cleanSelectedTimeout`, `getTimeout` |
| `machinerySelectNext` | Y | 1827-1884 | 58 | `getTimeout`, `machineryAutoScroll`, `machineryGetSelection`, `nextTimeout` |
| `machinerySelectPrev` | Y | 1888-1954 | 67 | `getTimeout`, `machineryAutoScroll`, `machineryGetSelection`, `prevTimeout` |
| `machineryMultipleSelectUp` | Y | 1959-1967 | 9 | `machineryMultipleSelectPrev` |
| `machineryMultipleSelectDown` | Y | 1970-1978 | 9 | `machineryMultipleSelectNext` |
| `machineryMultipleSelectNext` | Y | 1982-2009 | 28 | `machineryAutoScroll`, `machineryGetSelection` |
| `machineryMultipleSelectPrev` | Y | 2013-2040 | 28 | `machineryAutoScroll`, `machineryGetSelection` |
| `machineryRemoveSelected` | Y | 2052-2288 | 237 | `getTimeout`, `lastMoveToTrashCheckbox`, `machineryAutoScroll`, `machineryGetSelectedItemElements`, `machineryGetSelectedTags`, `machineryGetSelection`, `machineryLeaveDetailMode`, `machineryRemovePermanently` … |
| `machinerySelectUp` | Y | 2914-2977 | 64 | `machineryAutoScroll`, `machineryGetSelection` |
| `machinerySelectDown` | Y | 2979-3041 | 63 | `machineryAutoScroll`, `machineryGetSelection` |
| `machineryOpenInspectorTagSelectPanel` | Y | 3169-3172 | 4 | - |
| `machineryOpenInspectorFolderSelectPanel` | Y | 3184-3348 | 165 | `machineryUpdateSelection` |
| `machineryGetSelectedItems` | Y | 3874-3885 | 12 | - |
| `machineryGetSelectedItemElements` | Y | 3888-3898 | 11 | `machineryGetSelectedItems` |
| `machineryGetSelectedTags` | Y | 3901-3904 | 4 | - |
| `machineryRemoveSelectedFolders` | Y | 4069-4107 | 39 | - |
| `machineryRemoveSelectedSmartFolders` | Y | 4111-4138 | 28 | - |
| `tagRectSelecting` |  | 4169-4169 | 1 | - |
| `machineryToggleSelectSmartFolder` | Y | 4392-4397 | 6 | - |
| `machinerySelectFolder` | Y | 4773-4786 | 14 | `machineryUpdateSelection` |

### MOUNT-INFRA（最后一批/或留共享）（9 项 / 1025 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `timeoutCache` |  | 102-102 | 1 | - |
| `shimTimeoutInst` |  | 103-103 | 1 | - |
| `getTimeout` | Y | 105-139 | 35 | `shimTimeoutInst`, `timeoutCache` |
| `singletonByScope` |  | 5129-5129 | 1 | - |
| `scopeSingleton` |  | 5130-5135 | 6 | `singletonByScope` |
| `machineryCalls` | Y | 5144-5144 | 1 | - |
| `machinerySeedControllerState` | Y | 5149-5664 | 516 | - |
| `applied` |  | 5666-5666 | 1 | - |
| `applyDataMachineryScope` | Y | 5667-6129 | 463 | `applied`, `getTimeout`, `machineryCalls`, `machineryChangeStar`, `machineryEnterDetailMode`, `machineryInitMousetrap`, `machineryLeaveDetailMode`, `machineryNotify` … |

### tagManagerDomain（21 项 / 817 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryGetExtendTags` | Y | 153-171 | 19 | - |
| `machineryAutoResizeTagFilter` |  | 305-317 | 13 | - |
| `machineryCalcuteContainTagsInner` |  | 767-828 | 62 | - |
| `machineryCalcuteContainTags` | Y | 831-872 | 42 | `machineryCalcuteContainTagsInner` |
| `machineryOpenPrevGroup` |  | 2549-2573 | 25 | `machineryOpenStarredGroup`, `machineryOpenTagAllGroup`, `machineryOpenTagGroup`, `machineryOpenUnfiledGroup` |
| `machineryOpenNextGroup` |  | 2575-2596 | 22 | `machineryOpenStarredGroup`, `machineryOpenTagGroup`, `machineryOpenUnfiledGroup` |
| `machineryConvertToRegexGroup` |  | 3429-3539 | 111 | - |
| `machineryMatchWithRegexGroup` |  | 3541-3561 | 21 | - |
| `openUntaggedTimeout` |  | 3695-3695 | 1 | - |
| `machineryOpenUntagged` | Y | 3748-3786 | 39 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `openUntaggedTimeout` |
| `machineryOpenAllTags` | Y | 3818-3841 | 24 | `getTimeout`, `machineryResetPage` |
| `machineryUpdateSubFolderWidth` | Y | 3913-3927 | 15 | - |
| `machineryOpenTagAllGroup` | Y | 4175-4189 | 15 | `tagRectSelecting` |
| `machineryOpenUnfiledGroup` | Y | 4191-4205 | 15 | `tagRectSelecting` |
| `machineryOpenStarredGroup` | Y | 4207-4221 | 15 | `tagRectSelecting` |
| `machineryOpenTagGroup` | Y | 4223-4239 | 17 | `tagRectSelecting` |
| `machineryRemoveTagGroup` | Y | 4243-4285 | 43 | `machineryOpenTagAllGroup` |
| `machineryRefreshSubfolderList` | Y | 4721-4754 | 34 | - |
| `machineryEnableSubFolderNameEditable` | Y | 4797-4892 | 96 | `machinerySelectFolder` |
| `machineryRenameTagGroup` | Y | 4901-4916 | 16 | - |
| `machineryEditTag` | Y | 4923-5094 | 172 | `machineryUpdateSelection` |

### core/keymap（20 项 / 627 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryBuildMousetrap` | Y | 1428-1566 | 139 | `getPageUpHandlerFn`, `machineryBack`, `machineryChangeTo1Star`, `machineryChangeTo2Star`, `machineryChangeTo3Star`, `machineryChangeTo4Star`, `machineryChangeTo5Star`, `machineryKeyCHandler` … |
| `machineryInitMousetrap` | Y | 1570-1591 | 22 | `machineryBuildMousetrap` |
| `machineryKeyCHandler` | Y | 2345-2350 | 6 | - |
| `machineryKeyPHandler` | Y | 2352-2354 | 3 | `machineryOpenPluginPanel` |
| `machineryKeyLeftHandler` | Y | 2359-2404 | 46 | `machinerySelectPrev` |
| `machineryKeyRightHandler` | Y | 2408-2441 | 34 | `machinerySelectNext` |
| `machineryModUpHandler` | Y | 2446-2458 | 13 | `machineryHomeHandler` |
| `machineryModDownHandler` | Y | 2460-2472 | 13 | `machineryEndHandler` |
| `machineryModLeftHandler` | Y | 2474-2488 | 15 | `machineryPrevHistory` |
| `machineryModRightHandler` | Y | 2490-2504 | 15 | `machineryNextHistory` |
| `machineryKeyUpHandler` | Y | 2604-2718 | 115 | `machineryOpenAll`, `machineryOpenAllTags`, `machineryOpenCommunity`, `machineryOpenPrevGroup`, `machineryOpenPrevQuickAccess`, `machineryOpenRandom`, `machineryOpenUntagged`, `machinerySelectUp` |
| `machineryKeyDownHandler` | Y | 2726-2859 | 134 | `machineryOpenAllTags`, `machineryOpenCommunity`, `machineryOpenNextGroup`, `machineryOpenNextQuickAccess`, `machineryOpenRandom`, `machineryOpenUntagged`, `machinerySelectDown` |
| `machineryPageDownHandler` | Y | 2876-2888 | 13 | - |
| `machineryPageUpHandler` | Y | 2891-2908 | 18 | - |
| `machineryNHandler` | Y | 3083-3094 | 12 | - |
| `machinerySaveHandler` | Y | 3146-3151 | 6 | - |
| `machineryHomeHandler` | Y | 3993-4002 | 10 | - |
| `machineryEndHandler` | Y | 4006-4016 | 11 | - |
| `getPageUpHandlerFn` | Y | 5137-5137 | 1 | `machineryPageUpHandler`, `scopeSingleton` |
| `getPageDownHandlerFn` | Y | 5138-5138 | 1 | `machineryPageDownHandler`, `scopeSingleton` |

### filterDomain（4 项 / 420 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `semanticSearchController` |  | 426-426 | 1 | - |
| `machineryFilterDataPart3` | Y | 440-756 | 317 | `imageSearchController`, `semanticSearchController` |
| `machinerySearchFilter` |  | 3563-3663 | 101 | `machineryConvertToRegexGroup`, `machineryMatchWithRegexGroup` |
| `getToggleFilterByTypeFn` | Y | 5139-5139 | 1 | `scopeSingleton` |

### miscDomain（21 项 / 419 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `getLanguageBCP` |  | 142-149 | 8 | - |
| `machineryToggleSlideshow` | Y | 378-384 | 7 | `machineryEnterSlideshowMode`, `machineryLeaveSlideshowMode` |
| `machineryCheckTouchIDSupport` | Y | 396-410 | 15 | - |
| `machineryEnterDetailMode` | Y | 1259-1353 | 95 | `getTimeout`, `zoomInitTimeout` |
| `machineryLeaveDetailMode` | Y | 1358-1415 | 58 | `getTimeout`, `machineryFadeOutDetailMode`, `machineryInitMousetrap`, `zoomInitTimeout` |
| `cgStack` |  | 1596-1596 | 1 | - |
| `cgScopes` |  | 1597-1597 | 1 | - |
| `CG_START_TOP` |  | 1598-1598 | 1 | - |
| `CG_SPACING` |  | 1599-1599 | 1 | - |
| `cgBuildTemplate` |  | 1604-1618 | 15 | - |
| `cgRestack` |  | 1621-1633 | 13 | `CG_SPACING`, `CG_START_TOP`, `cgStack` |
| `machineryNotify` | Y | 1639-1728 | 90 | `cgBuildTemplate`, `cgNotifyServiceCloseAll`, `cgRestack`, `cgStack`, `getTimeout`, `undoTimeout` |
| `cgNotifyServiceCloseAll` |  | 1731-1735 | 5 | `cgStack` |
| `machineryToggleDetailMode` | Y | 1815-1817 | 3 | - |
| `machineryQuicklook` | Y | 2295-2337 | 43 | `getPageDownHandlerFn`, `machineryToggleDetailMode` |
| `machineryFadeOutDetailMode` | Y | 4151-4157 | 7 | - |
| `machineryOpenPluginPanel` | Y | 4160-4163 | 4 | - |
| `machineryEnterSlideshowMode` | Y | 4291-4308 | 18 | `getTimeout`, `machineryEnterDetailMode` |
| `machineryLeaveSlideshowMode` | Y | 4311-4326 | 16 | `getTimeout` |
| `machineryLockApp` | Y | 4331-4338 | 8 | `machineryFocusAppUnlockPassword` |
| `machineryFocusAppUnlockPassword` | Y | 4340-4349 | 10 | - |

### services/uploadService（1 项 / 219 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryOnDropContainer` | Y | 4474-4692 | 219 | - |

### itemDomain（3 项 / 146 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machinerySortRawData` | Y | 174-272 | 99 | `getLanguageBCP` |
| `machineryReload` | Y | 323-368 | 46 | `machineryAutoResizeTagFilter`, `machineryLeaveDetailMode`, `machineryUpdateSelection`, `machineryUpdateSubFolderWidth` |
| `imageSearchController` |  | 425-425 | 1 | - |

### services/folderCoreService（5 项 / 115 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `openAllTimeout` |  | 1190-1190 | 1 | - |
| `machineryOpenAll` | Y | 1201-1248 | 48 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `openAllTimeout` |
| `openRandomTimeout` |  | 3694-3694 | 1 | - |
| `machineryOpenRandom` | Y | 3701-3742 | 42 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `openRandomTimeout` |
| `machineryOpenCommunity` | Y | 3791-3813 | 23 | `machineryLeaveDetailMode`, `machineryResetPage` |

### stage/grid（4 项 / 91 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryResetPage` | Y | 1139-1182 | 44 | - |
| `machineryToggleAll` | Y | 3100-3139 | 40 | `getOffsetScrollbarFn`, `getTimeout` |
| `machineryAutoScroll` | Y | 3864-3869 | 6 | `getTimeout` |
| `getOffsetScrollbarFn` | Y | 5136-5136 | 1 | `scopeSingleton` |

### services/imageOpsService（7 项 / 86 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryChangeTo5Star` | Y | 3046-3049 | 4 | `machineryChangeStar` |
| `machineryRemoveStar` | Y | 3054-3056 | 3 | `machineryChangeStar` |
| `machineryChangeTo1Star` | Y | 3058-3061 | 4 | `machineryChangeStar` |
| `machineryChangeTo2Star` | Y | 3063-3066 | 4 | `machineryChangeStar` |
| `machineryChangeTo3Star` | Y | 3068-3071 | 4 | `machineryChangeStar` |
| `machineryChangeTo4Star` | Y | 3073-3076 | 4 | `machineryChangeStar` |
| `machineryChangeStar` | Y | 3359-3421 | 63 | - |

### core/navHistory（9 项 / 64 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `undoTimeout` |  | 1600-1600 | 1 | - |
| `machineryUndo` | Y | 1753-1757 | 5 | `cgNotifyServiceCloseAll` |
| `machineryNextHistory` | Y | 1761-1766 | 6 | - |
| `machineryPrevHistory` | Y | 1768-1773 | 6 | - |
| `machineryBack` | Y | 1776-1783 | 8 | `machineryLeaveDetailMode`, `machineryPrevHistory` |
| `nextTimeout` |  | 1822-1822 | 1 | - |
| `prevTimeout` |  | 1823-1823 | 1 | - |
| `machineryOpenPrevQuickAccess` |  | 2511-2522 | 12 | - |
| `machineryOpenNextQuickAccess` |  | 2524-2547 | 24 | - |

### services/batchOpsService（1 项 / 24 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryRemovePermanently` | Y | 4029-4052 | 24 | `machineryGetSelectedItemElements`, `machineryUpdateSelection` |

### services/viewOpsService（1 项 / 1 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `zoomInitTimeout` |  | 1253-1253 | 1 | - |

### libraryDomain（1 项 / 1 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `lastMoveToTrashCheckbox` |  | 2045-2045 | 1 | - |

## 2. 跨域共享顶层名（≥2 域引用 —— 最后搬或抽共享模块）

- `machineryLeaveDetailMode`：MOUNT-INFRA（最后一批/或留共享）、core/navHistory、itemDomain、selectionViewDomain、services/folderCoreService、tagManagerDomain
- `getTimeout`：MOUNT-INFRA（最后一批/或留共享）、miscDomain、selectionViewDomain、services/folderCoreService、stage/grid、tagManagerDomain
- `machineryUpdateSelection`：MOUNT-INFRA（最后一批/或留共享）、itemDomain、selectionViewDomain、services/batchOpsService、tagManagerDomain
- `scopeSingleton`：core/keymap、filterDomain、stage/grid
- `machineryCalls`：MOUNT-INFRA（最后一批/或留共享）、selectionViewDomain
- `machineryResetPage`：services/folderCoreService、tagManagerDomain
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

