# D-1 / Track B / B-0：dataMachinery.ts 映射表（自动生成）

> 生成器：`tests-tmp/bz-d1-b0-map.py`（只读分析）。施工前请人工复核域归属。

## 0. 总量

- 文件：`src/app/react/core/dataMachinery.ts`，**7418 行**
- 顶层声明：**155**（exported **110** / 私有 **45**）
- import 面：**42** 条
- 引用文件：**30**（`from .../dataMachinery`）

## 1. 域聚类（批次候选）

| 目标域 | 声明数 | 行数（含私有依赖） | 导出数 |
|---|---:|---:|---:|
| filterDomain | 27 | 1701 | 16 |
| selectionViewDomain | 25 | 1111 | 21 |
| MOUNT-INFRA（最后一批/或留共享） | 9 | 1025 | 4 |
| tagManagerDomain | 21 | 817 | 14 |
| core/keymap | 20 | 627 | 20 |
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

### filterDomain（27 项 / 1701 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `filterCache` |  | 100-100 | 1 | - |
| `shimFilterInst` |  | 101-101 | 1 | - |
| `getFilter` | Y | 102-232 | 131 | `filterCache`, `shimFilterInst` |
| `machineryCalcuteFilterBadge` | Y | 411-520 | 110 | - |
| `getMatchFunctionTable` |  | 661-693 | 33 | - |
| `machineryIsMatchCondition` |  | 696-724 | 29 | `getMatchFunctionTable` |
| `machineryExistInSmartFilter` | Y | 727-750 | 24 | `machineryIsMatchCondition` |
| `semanticSearchController` |  | 756-756 | 1 | - |
| `machineryFilterDataPart1` |  | 760-1067 | 308 | - |
| `machineryFilterDataPart2` |  | 1073-1307 | 235 | `getFilter`, `machineryColorFilter`, `machineryGrayColorFilter` |
| `machineryFilterDataPart3` |  | 1313-1629 | 317 | `imageSearchController`, `semanticSearchController` |
| `machineryFilterData` | Y | 1632-1638 | 7 | `machineryFilterDataPart1`, `machineryFilterDataPart2`, `machineryFilterDataPart3` |
| `machineryCalcuteFilterResult` | Y | 1641-1659 | 19 | `machineryContentFilter`, `machineryFilterData` |
| `machineryContentFilter` | Y | 1666-1750 | 85 | `machineryExistInSmartFilter` |
| `calculateFilterCountsTimeout` |  | 2172-2172 | 1 | - |
| `machineryCalculateFilterCounts` | Y | 2173-2187 | 15 | `calculateFilterCountsTimeout`, `machineryUpdateFilterCounts` |
| `machinerySearchFilter` |  | 4565-4665 | 101 | `machineryConvertToRegexGroup`, `machineryMatchWithRegexGroup` |
| `machineryColorFilter` | Y | 4676-4767 | 92 | - |
| `machineryGrayColorFilter` | Y | 4770-4786 | 17 | - |
| `machineryFilterContent` | Y | 4791-4803 | 13 | `machineryCalls` |
| `machineryUpdateFilterCounts` | Y | 5098-5199 | 102 | - |
| `FILTER_ID_MAP` |  | 5588-5608 | 21 | - |
| `machineryOpenFilter` | Y | 5610-5617 | 8 | - |
| `machineryToggleFilterByType` | Y | 5619-5636 | 18 | `FILTER_ID_MAP`, `machineryOpenFilter` |
| `machinerySearchInAll` | Y | 5652-5656 | 5 | `machineryFocusSeach`, `machineryOpenAll` |
| `machineryFocusSeach` | Y | 6038-6043 | 6 | - |
| `getToggleFilterByTypeFn` | Y | 6427-6427 | 1 | `machineryToggleFilterByType`, `scopeSingleton` |

### selectionViewDomain（25 项 / 1111 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `updateSelectionTimeout` |  | 1864-1864 | 1 | - |
| `machineryUpdateSelection` | Y | 1866-2054 | 189 | `getFilter`, `getTimeout`, `machineryCalls`, `sortTagsForSelection`, `updateSelectionTimeout` |
| `sortTagsForSelection` |  | 2057-2090 | 34 | - |
| `machineryGetSelection` | Y | 2103-2120 | 18 | - |
| `cleanSelectedTimeout` |  | 2790-2790 | 1 | - |
| `machinerySelectAll` | Y | 2793-2813 | 21 | `cleanSelectedTimeout`, `getTimeout` |
| `machinerySelectNext` | Y | 2829-2886 | 58 | `getTimeout`, `machineryAutoScroll`, `machineryGetSelection`, `nextTimeout` |
| `machinerySelectPrev` | Y | 2890-2956 | 67 | `getTimeout`, `machineryAutoScroll`, `machineryGetSelection`, `prevTimeout` |
| `machineryMultipleSelectUp` | Y | 2961-2969 | 9 | `machineryMultipleSelectPrev` |
| `machineryMultipleSelectDown` | Y | 2972-2980 | 9 | `machineryMultipleSelectNext` |
| `machineryMultipleSelectNext` | Y | 2984-3011 | 28 | `machineryAutoScroll`, `machineryGetSelection` |
| `machineryMultipleSelectPrev` | Y | 3015-3042 | 28 | `machineryAutoScroll`, `machineryGetSelection` |
| `machineryRemoveSelected` | Y | 3054-3290 | 237 | `getFilter`, `getTimeout`, `lastMoveToTrashCheckbox`, `machineryAutoScroll`, `machineryGetSelectedItemElements`, `machineryGetSelectedTags`, `machineryGetSelection`, `machineryLeaveDetailMode` … |
| `machinerySelectUp` | Y | 3916-3979 | 64 | `machineryAutoScroll`, `machineryGetSelection` |
| `machinerySelectDown` | Y | 3981-4043 | 63 | `machineryAutoScroll`, `machineryGetSelection` |
| `machineryOpenInspectorTagSelectPanel` | Y | 4171-4174 | 4 | - |
| `machineryOpenInspectorFolderSelectPanel` | Y | 4186-4350 | 165 | `getFilter`, `machineryUpdateFilterCounts`, `machineryUpdateSelection` |
| `machineryGetSelectedItems` | Y | 5000-5011 | 12 | - |
| `machineryGetSelectedItemElements` | Y | 5014-5024 | 11 | `machineryGetSelectedItems` |
| `machineryGetSelectedTags` | Y | 5027-5030 | 4 | - |
| `machineryRemoveSelectedFolders` | Y | 5297-5335 | 39 | `getFilter` |
| `machineryRemoveSelectedSmartFolders` | Y | 5339-5366 | 28 | `getFilter` |
| `tagRectSelecting` |  | 5397-5397 | 1 | - |
| `machineryToggleSelectSmartFolder` | Y | 5673-5678 | 6 | - |
| `machinerySelectFolder` | Y | 6061-6074 | 14 | `machineryUpdateSelection` |

### MOUNT-INFRA（最后一批/或留共享）（9 项 / 1025 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `timeoutCache` |  | 234-234 | 1 | - |
| `shimTimeoutInst` |  | 235-235 | 1 | - |
| `getTimeout` | Y | 237-271 | 35 | `shimTimeoutInst`, `timeoutCache` |
| `singletonByScope` |  | 6417-6417 | 1 | - |
| `scopeSingleton` |  | 6418-6423 | 6 | `singletonByScope` |
| `machineryCalls` | Y | 6432-6432 | 1 | - |
| `machinerySeedControllerState` | Y | 6437-6952 | 516 | - |
| `applied` |  | 6954-6954 | 1 | - |
| `applyDataMachineryScope` | Y | 6955-7417 | 463 | `applied`, `getTimeout`, `machineryCalcuteFilterResult`, `machineryCalls`, `machineryChangeStar`, `machineryColorFilter`, `machineryContentFilter`, `machineryEnterDetailMode` … |

### tagManagerDomain（21 项 / 817 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryGetExtendTags` | Y | 285-303 | 19 | - |
| `machineryAutoResizeTagFilter` |  | 547-559 | 13 | - |
| `machineryCalcuteContainTagsInner` |  | 1753-1814 | 62 | - |
| `machineryCalcuteContainTags` | Y | 1817-1858 | 42 | `machineryCalcuteContainTagsInner` |
| `machineryOpenPrevGroup` |  | 3551-3575 | 25 | `machineryOpenStarredGroup`, `machineryOpenTagAllGroup`, `machineryOpenTagGroup`, `machineryOpenUnfiledGroup` |
| `machineryOpenNextGroup` |  | 3577-3598 | 22 | `machineryOpenStarredGroup`, `machineryOpenTagGroup`, `machineryOpenUnfiledGroup` |
| `machineryConvertToRegexGroup` |  | 4431-4541 | 111 | - |
| `machineryMatchWithRegexGroup` |  | 4543-4563 | 21 | - |
| `openUntaggedTimeout` |  | 4821-4821 | 1 | - |
| `machineryOpenUntagged` | Y | 4874-4912 | 39 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `openUntaggedTimeout` |
| `machineryOpenAllTags` | Y | 4944-4967 | 24 | `getTimeout`, `machineryResetPage` |
| `machineryUpdateSubFolderWidth` | Y | 5039-5053 | 15 | - |
| `machineryOpenTagAllGroup` | Y | 5403-5417 | 15 | `tagRectSelecting` |
| `machineryOpenUnfiledGroup` | Y | 5419-5433 | 15 | `tagRectSelecting` |
| `machineryOpenStarredGroup` | Y | 5435-5449 | 15 | `tagRectSelecting` |
| `machineryOpenTagGroup` | Y | 5451-5467 | 17 | `tagRectSelecting` |
| `machineryRemoveTagGroup` | Y | 5471-5513 | 43 | `machineryOpenTagAllGroup` |
| `machineryRefreshSubfolderList` | Y | 6002-6035 | 34 | - |
| `machineryEnableSubFolderNameEditable` | Y | 6085-6180 | 96 | `machinerySelectFolder` |
| `machineryRenameTagGroup` | Y | 6189-6204 | 16 | - |
| `machineryEditTag` | Y | 6211-6382 | 172 | `getFilter`, `machineryUpdateSelection` |

### core/keymap（20 项 / 627 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryBuildMousetrap` | Y | 2430-2568 | 139 | `getPageUpHandlerFn`, `machineryBack`, `machineryChangeTo1Star`, `machineryChangeTo2Star`, `machineryChangeTo3Star`, `machineryChangeTo4Star`, `machineryChangeTo5Star`, `machineryKeyCHandler` … |
| `machineryInitMousetrap` | Y | 2572-2593 | 22 | `machineryBuildMousetrap` |
| `machineryKeyCHandler` | Y | 3347-3352 | 6 | - |
| `machineryKeyPHandler` | Y | 3354-3356 | 3 | `machineryOpenPluginPanel` |
| `machineryKeyLeftHandler` | Y | 3361-3406 | 46 | `machinerySelectPrev` |
| `machineryKeyRightHandler` | Y | 3410-3443 | 34 | `machinerySelectNext` |
| `machineryModUpHandler` | Y | 3448-3460 | 13 | `machineryHomeHandler` |
| `machineryModDownHandler` | Y | 3462-3474 | 13 | `machineryEndHandler` |
| `machineryModLeftHandler` | Y | 3476-3490 | 15 | `machineryPrevHistory` |
| `machineryModRightHandler` | Y | 3492-3506 | 15 | `machineryNextHistory` |
| `machineryKeyUpHandler` | Y | 3606-3720 | 115 | `machineryOpenAll`, `machineryOpenAllTags`, `machineryOpenCommunity`, `machineryOpenPrevGroup`, `machineryOpenPrevQuickAccess`, `machineryOpenRandom`, `machineryOpenUntagged`, `machinerySelectUp` |
| `machineryKeyDownHandler` | Y | 3728-3861 | 134 | `machineryOpenAllTags`, `machineryOpenCommunity`, `machineryOpenNextGroup`, `machineryOpenNextQuickAccess`, `machineryOpenRandom`, `machineryOpenUntagged`, `machinerySelectDown` |
| `machineryPageDownHandler` | Y | 3878-3890 | 13 | - |
| `machineryPageUpHandler` | Y | 3893-3910 | 18 | - |
| `machineryNHandler` | Y | 4085-4096 | 12 | - |
| `machinerySaveHandler` | Y | 4148-4153 | 6 | - |
| `machineryHomeHandler` | Y | 5221-5230 | 10 | - |
| `machineryEndHandler` | Y | 5234-5244 | 11 | - |
| `getPageUpHandlerFn` | Y | 6425-6425 | 1 | `machineryPageUpHandler`, `scopeSingleton` |
| `getPageDownHandlerFn` | Y | 6426-6426 | 1 | `machineryPageDownHandler`, `scopeSingleton` |

### miscDomain（21 项 / 419 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `getLanguageBCP` |  | 274-281 | 8 | - |
| `machineryToggleSlideshow` | Y | 620-626 | 7 | `machineryEnterSlideshowMode`, `machineryLeaveSlideshowMode` |
| `machineryCheckTouchIDSupport` | Y | 638-652 | 15 | - |
| `machineryEnterDetailMode` | Y | 2261-2355 | 95 | `getTimeout`, `zoomInitTimeout` |
| `machineryLeaveDetailMode` | Y | 2360-2417 | 58 | `getTimeout`, `machineryFadeOutDetailMode`, `machineryInitMousetrap`, `zoomInitTimeout` |
| `cgStack` |  | 2598-2598 | 1 | - |
| `cgScopes` |  | 2599-2599 | 1 | - |
| `CG_START_TOP` |  | 2600-2600 | 1 | - |
| `CG_SPACING` |  | 2601-2601 | 1 | - |
| `cgBuildTemplate` |  | 2606-2620 | 15 | - |
| `cgRestack` |  | 2623-2635 | 13 | `CG_SPACING`, `CG_START_TOP`, `cgStack` |
| `machineryNotify` | Y | 2641-2730 | 90 | `cgBuildTemplate`, `cgNotifyServiceCloseAll`, `cgRestack`, `cgStack`, `getFilter`, `getTimeout`, `undoTimeout` |
| `cgNotifyServiceCloseAll` |  | 2733-2737 | 5 | `cgStack` |
| `machineryToggleDetailMode` | Y | 2817-2819 | 3 | - |
| `machineryQuicklook` | Y | 3297-3339 | 43 | `getPageDownHandlerFn`, `machineryToggleDetailMode` |
| `machineryFadeOutDetailMode` | Y | 5379-5385 | 7 | - |
| `machineryOpenPluginPanel` | Y | 5388-5391 | 4 | - |
| `machineryEnterSlideshowMode` | Y | 5519-5536 | 18 | `getTimeout`, `machineryEnterDetailMode` |
| `machineryLeaveSlideshowMode` | Y | 5539-5554 | 16 | `getTimeout` |
| `machineryLockApp` | Y | 5559-5566 | 8 | `machineryFocusAppUnlockPassword` |
| `machineryFocusAppUnlockPassword` | Y | 5568-5577 | 10 | - |

### services/uploadService（1 项 / 219 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryOnDropContainer` | Y | 5755-5973 | 219 | `getFilter` |

### itemDomain（3 项 / 146 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machinerySortRawData` | Y | 306-404 | 99 | `getLanguageBCP` |
| `machineryReload` | Y | 565-610 | 46 | `machineryAutoResizeTagFilter`, `machineryCalculateFilterCounts`, `machineryLeaveDetailMode`, `machineryUpdateSelection`, `machineryUpdateSubFolderWidth` |
| `imageSearchController` |  | 755-755 | 1 | - |

### services/folderCoreService（5 项 / 115 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `openAllTimeout` |  | 2192-2192 | 1 | - |
| `machineryOpenAll` | Y | 2203-2250 | 48 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `openAllTimeout` |
| `openRandomTimeout` |  | 4820-4820 | 1 | - |
| `machineryOpenRandom` | Y | 4827-4868 | 42 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `openRandomTimeout` |
| `machineryOpenCommunity` | Y | 4917-4939 | 23 | `machineryLeaveDetailMode`, `machineryResetPage` |

### stage/grid（4 项 / 91 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryResetPage` | Y | 2125-2168 | 44 | - |
| `machineryToggleAll` | Y | 4102-4141 | 40 | `getOffsetScrollbarFn`, `getTimeout` |
| `machineryAutoScroll` | Y | 4990-4995 | 6 | `getTimeout` |
| `getOffsetScrollbarFn` | Y | 6424-6424 | 1 | `scopeSingleton` |

### services/imageOpsService（7 项 / 86 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryChangeTo5Star` | Y | 4048-4051 | 4 | `machineryChangeStar` |
| `machineryRemoveStar` | Y | 4056-4058 | 3 | `machineryChangeStar` |
| `machineryChangeTo1Star` | Y | 4060-4063 | 4 | `machineryChangeStar` |
| `machineryChangeTo2Star` | Y | 4065-4068 | 4 | `machineryChangeStar` |
| `machineryChangeTo3Star` | Y | 4070-4073 | 4 | `machineryChangeStar` |
| `machineryChangeTo4Star` | Y | 4075-4078 | 4 | `machineryChangeStar` |
| `machineryChangeStar` | Y | 4361-4423 | 63 | `getFilter` |

### core/navHistory（9 项 / 64 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `undoTimeout` |  | 2602-2602 | 1 | - |
| `machineryUndo` | Y | 2755-2759 | 5 | `cgNotifyServiceCloseAll` |
| `machineryNextHistory` | Y | 2763-2768 | 6 | - |
| `machineryPrevHistory` | Y | 2770-2775 | 6 | - |
| `machineryBack` | Y | 2778-2785 | 8 | `machineryLeaveDetailMode`, `machineryPrevHistory` |
| `nextTimeout` |  | 2824-2824 | 1 | - |
| `prevTimeout` |  | 2825-2825 | 1 | - |
| `machineryOpenPrevQuickAccess` |  | 3513-3524 | 12 | - |
| `machineryOpenNextQuickAccess` |  | 3526-3549 | 24 | - |

### services/batchOpsService（1 项 / 24 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryRemovePermanently` | Y | 5257-5280 | 24 | `machineryGetSelectedItemElements`, `machineryUpdateSelection` |

### services/viewOpsService（1 项 / 1 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `zoomInitTimeout` |  | 2255-2255 | 1 | - |

### libraryDomain（1 项 / 1 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `lastMoveToTrashCheckbox` |  | 3047-3047 | 1 | - |

## 2. 跨域共享顶层名（≥2 域引用 —— 最后搬或抽共享模块）

- `machineryLeaveDetailMode`：MOUNT-INFRA（最后一批/或留共享）、core/navHistory、itemDomain、selectionViewDomain、services/folderCoreService、tagManagerDomain
- `getFilter`：filterDomain、miscDomain、selectionViewDomain、services/imageOpsService、services/uploadService、tagManagerDomain
- `getTimeout`：MOUNT-INFRA（最后一批/或留共享）、miscDomain、selectionViewDomain、services/folderCoreService、stage/grid、tagManagerDomain
- `machineryUpdateSelection`：MOUNT-INFRA（最后一批/或留共享）、itemDomain、selectionViewDomain、services/batchOpsService、tagManagerDomain
- `machineryCalls`：MOUNT-INFRA（最后一批/或留共享）、filterDomain、selectionViewDomain
- `scopeSingleton`：core/keymap、filterDomain、stage/grid
- `machineryColorFilter`：MOUNT-INFRA（最后一批/或留共享）、filterDomain
- `machineryGrayColorFilter`：MOUNT-INFRA（最后一批/或留共享）、filterDomain
- `machineryContentFilter`：MOUNT-INFRA（最后一批/或留共享）、filterDomain
- `machineryFilterData`：MOUNT-INFRA（最后一批/或留共享）、filterDomain
- `machineryExistInSmartFilter`：MOUNT-INFRA（最后一批/或留共享）、filterDomain
- `machineryUpdateFilterCounts`：filterDomain、selectionViewDomain
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
- `machineryOpenAll`：core/keymap、filterDomain
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

