# D-1 / Track B / B-0：dataMachinery.ts 映射表（自动生成）

> 生成器：`tests-tmp/bz-d1-b0-map.py`（只读分析）。施工前请人工复核域归属。

## 0. 总量

- 文件：`src/app/react/core/dataMachinery.ts`，**8805 行**
- 顶层声明：**192**（exported **137** / 私有 **55**）
- import 面：**41** 条
- 引用文件：**30**（`from .../dataMachinery`）

## 1. 域聚类（批次候选）

| 目标域 | 声明数 | 行数（含私有依赖） | 导出数 |
|---|---:|---:|---:|
| filterDomain | 27 | 1701 | 16 |
| itemDomain | 40 | 1520 | 29 |
| selectionViewDomain | 25 | 1111 | 21 |
| MOUNT-INFRA（最后一批/或留共享） | 9 | 1025 | 4 |
| tagManagerDomain | 21 | 817 | 14 |
| core/keymap | 20 | 627 | 20 |
| miscDomain | 21 | 419 | 13 |
| services/uploadService | 1 | 219 | 1 |
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
| `filterCache` |  | 104-104 | 1 | - |
| `shimFilterInst` |  | 105-105 | 1 | - |
| `getFilter` | Y | 106-236 | 131 | `filterCache`, `shimFilterInst` |
| `machineryCalcuteFilterBadge` | Y | 703-812 | 110 | - |
| `getMatchFunctionTable` |  | 1353-1385 | 33 | - |
| `machineryIsMatchCondition` |  | 1388-1416 | 29 | `getMatchFunctionTable` |
| `machineryExistInSmartFilter` | Y | 1419-1442 | 24 | `machineryIsMatchCondition` |
| `semanticSearchController` |  | 1448-1448 | 1 | - |
| `machineryFilterDataPart1` |  | 1452-1759 | 308 | - |
| `machineryFilterDataPart2` |  | 1765-1999 | 235 | `getFilter`, `machineryColorFilter`, `machineryGrayColorFilter` |
| `machineryFilterDataPart3` |  | 2005-2321 | 317 | `imageSearchController`, `machinerySortData`, `semanticSearchController` |
| `machineryFilterData` | Y | 2324-2330 | 7 | `machineryFilterDataPart1`, `machineryFilterDataPart2`, `machineryFilterDataPart3` |
| `machineryCalcuteFilterResult` | Y | 2333-2351 | 19 | `machineryContentFilter`, `machineryFilterData` |
| `machineryContentFilter` | Y | 2358-2442 | 85 | `machineryExistInSmartFilter` |
| `calculateFilterCountsTimeout` |  | 2864-2864 | 1 | - |
| `machineryCalculateFilterCounts` | Y | 2865-2879 | 15 | `calculateFilterCountsTimeout`, `machineryUpdateFilterCounts` |
| `machinerySearchFilter` |  | 5322-5422 | 101 | `machineryConvertToRegexGroup`, `machineryMatchWithRegexGroup` |
| `machineryColorFilter` | Y | 5433-5524 | 92 | - |
| `machineryGrayColorFilter` | Y | 5527-5543 | 17 | - |
| `machineryFilterContent` | Y | 5548-5560 | 13 | `machineryCalls`, `machineryRebindRefresh` |
| `machineryUpdateFilterCounts` | Y | 6059-6160 | 102 | - |
| `FILTER_ID_MAP` |  | 6588-6608 | 21 | - |
| `machineryOpenFilter` | Y | 6610-6617 | 8 | - |
| `machineryToggleFilterByType` | Y | 6619-6636 | 18 | `FILTER_ID_MAP`, `machineryOpenFilter` |
| `machinerySearchInAll` | Y | 6652-6656 | 5 | `machineryFocusSeach`, `machineryOpenAll` |
| `machineryFocusSeach` | Y | 7307-7312 | 6 | - |
| `getToggleFilterByTypeFn` | Y | 7814-7814 | 1 | `machineryToggleFilterByType`, `scopeSingleton` |

### itemDomain（40 项 / 1520 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `calculateImageBindingTimeout` |  | 99-99 | 1 | - |
| `rebindRefreshLazyTimeout` |  | 100-100 | 1 | - |
| `prependImagesTimeout` |  | 102-102 | 1 | - |
| `machinerySortRawData` | Y | 310-408 | 99 | `getLanguageBCP` |
| `machineryCalculateImageBinding` | Y | 411-697 | 287 | `calculateImageBindingTimeout`, `getFilter`, `getTimeout`, `machineryGetExtendTags`, `machinerySortRawData` |
| `machineryFilterSidebarItem` | Y | 817-854 | 38 | - |
| `machineryRebindRefresh` | Y | 860-959 | 100 | `machineryCalcuteContainTags`, `machineryCalcuteFilterBadge`, `machineryCalcuteFilterResult`, `machineryCalls`, `machineryRefreshSubfolderList`, `machineryUpdateItemsView` |
| `machineryRebindRefreshLazy` | Y | 962-968 | 7 | `getTimeout`, `machineryRebindRefresh`, `rebindRefreshLazyTimeout` |
| `machineryUpdateItemsView` | Y | 977-984 | 8 | `machineryUpdateItemView` |
| `machineryResetImageData` |  | 990-996 | 7 | - |
| `machineryPrependImages` | Y | 1000-1013 | 14 | `machineryResetImageData`, `prependImagesTimeout` |
| `machineryReload` | Y | 1034-1079 | 46 | `machineryAutoResizeTagFilter`, `machineryCalculateFilterCounts`, `machineryLeaveDetailMode`, `machineryRebindRefresh`, `machineryUpdateSelection`, `machineryUpdateSubFolderWidth` |
| `machineryUpdateItemView` | Y | 1103-1325 | 223 | `getFilter` |
| `imageSearchController` |  | 1447-1447 | 1 | - |
| `machineryCopyImages` | Y | 4035-4088 | 54 | `getFilter`, `machineryGetSelectedTags` |
| `machineryCreateTxtFileFromTemplate` | Y | 4909-4913 | 5 | `machineryNewFileFromTemplate` |
| `machineryGetItemByElement` | Y | 5107-5112 | 6 | - |
| `machineryNewFileFromTemplate` | Y | 5571-5607 | 37 | `machineryShowUploadQueue` |
| `checkListItemsLessThanContainerTimeout` |  | 5829-5829 | 1 | - |
| `machineryCheckListItemsLessThanContainer` | Y | 5833-5850 | 18 | `checkListItemsLessThanContainerTimeout` |
| `machineryScrollToCurrentItem` | Y | 5876-5888 | 13 | - |
| `machineryForceFitImageSize` | Y | 5892-5910 | 19 | - |
| `machinerySortData` | Y | 5935-6047 | 113 | - |
| `preloadImageTimeout` |  | 6175-6175 | 1 | - |
| `machineryPreloadImage` | Y | 6179-6209 | 31 | `preloadImageTimeout` |
| `machineryToggleCommentMode` | Y | 6372-6376 | 5 | - |
| `machineryRemoveFromDuplicateMapping` | Y | 6662-6666 | 5 | - |
| `machineryEnlargeThumbnailsTimeout` |  | 6737-6737 | 1 | - |
| `machineryEnlargeThumbnails` | Y | 6738-6756 | 19 | `machineryEnlargeThumbnailsTimeout` |
| `machineryShrinkThumbnailsTimeout` |  | 6758-6758 | 1 | - |
| `machineryShrinkThumbnails` | Y | 6759-6776 | 18 | `machineryShrinkThumbnailsTimeout` |
| `machineryOnImageSizeHeightChanged` | Y | 6779-6789 | 11 | `machineryEnlargeThumbnails`, `machineryShrinkThumbnails`, `machineryUpdateSubFolderWidth` |
| `machineryChangeMetaItems` | Y | 6793-6800 | 8 | `machineryUpdateItemsView` |
| `addImageTimeLeftInterval` |  | 6808-6808 | 1 | - |
| `machineryCalcuteAddImageTimeLeft` |  | 6812-6827 | 16 | - |
| `machineryShowUploadQueue` | Y | 7062-7075 | 14 | `addImageTimeLeftInterval`, `machineryCalcuteAddImageTimeLeft` |
| `machineryHideUploadQueue` | Y | 7077-7084 | 8 | - |
| `machineryFindDupclipate` | Y | 7101-7264 | 164 | - |
| `machineryEnableImageNameEditable` | Y | 7350-7448 | 99 | - |
| `machineryRenameImages` | Y | 7553-7571 | 19 | `machineryEnableImageNameEditable` |

### selectionViewDomain（25 项 / 1111 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `updateSelectionTimeout` |  | 2556-2556 | 1 | - |
| `machineryUpdateSelection` | Y | 2558-2746 | 189 | `getFilter`, `getTimeout`, `machineryCalls`, `sortTagsForSelection`, `updateSelectionTimeout` |
| `sortTagsForSelection` |  | 2749-2782 | 34 | - |
| `machineryGetSelection` | Y | 2795-2812 | 18 | - |
| `cleanSelectedTimeout` |  | 3482-3482 | 1 | - |
| `machinerySelectAll` | Y | 3485-3505 | 21 | `cleanSelectedTimeout`, `getTimeout` |
| `machinerySelectNext` | Y | 3521-3578 | 58 | `getTimeout`, `machineryAutoScroll`, `machineryForceFitImageSize`, `machineryGetSelection`, `machineryPreloadImage`, `nextTimeout` |
| `machinerySelectPrev` | Y | 3582-3648 | 67 | `getTimeout`, `machineryAutoScroll`, `machineryForceFitImageSize`, `machineryGetSelection`, `machineryPreloadImage`, `prevTimeout` |
| `machineryMultipleSelectUp` | Y | 3653-3661 | 9 | `machineryMultipleSelectPrev` |
| `machineryMultipleSelectDown` | Y | 3664-3672 | 9 | `machineryMultipleSelectNext` |
| `machineryMultipleSelectNext` | Y | 3676-3703 | 28 | `machineryAutoScroll`, `machineryGetSelection` |
| `machineryMultipleSelectPrev` | Y | 3707-3734 | 28 | `machineryAutoScroll`, `machineryGetSelection` |
| `machineryRemoveSelected` | Y | 3746-3982 | 237 | `getFilter`, `getTimeout`, `lastMoveToTrashCheckbox`, `machineryAutoScroll`, `machineryCalculateImageBinding`, `machineryForceFitImageSize`, `machineryGetSelectedItemElements`, `machineryGetSelectedTags` … |
| `machinerySelectUp` | Y | 4662-4725 | 64 | `machineryAutoScroll`, `machineryForceFitImageSize`, `machineryGetItemByElement`, `machineryGetSelection` |
| `machinerySelectDown` | Y | 4727-4789 | 63 | `machineryAutoScroll`, `machineryForceFitImageSize`, `machineryGetItemByElement`, `machineryGetSelection` |
| `machineryOpenInspectorTagSelectPanel` | Y | 4922-4925 | 4 | - |
| `machineryOpenInspectorFolderSelectPanel` | Y | 4937-5101 | 165 | `getFilter`, `machineryCalculateImageBinding`, `machineryRebindRefresh`, `machineryUpdateFilterCounts`, `machineryUpdateSelection` |
| `machineryGetSelectedItems` | Y | 5794-5805 | 12 | - |
| `machineryGetSelectedItemElements` | Y | 5808-5818 | 11 | `machineryGetSelectedItems` |
| `machineryGetSelectedTags` | Y | 5821-5824 | 4 | - |
| `machineryRemoveSelectedFolders` | Y | 6291-6329 | 39 | `getFilter` |
| `machineryRemoveSelectedSmartFolders` | Y | 6333-6360 | 28 | `getFilter` |
| `tagRectSelecting` |  | 6397-6397 | 1 | - |
| `machineryToggleSelectSmartFolder` | Y | 6678-6683 | 6 | - |
| `machinerySelectFolder` | Y | 7330-7343 | 14 | `machineryUpdateSelection` |

### MOUNT-INFRA（最后一批/或留共享）（9 项 / 1025 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `timeoutCache` |  | 238-238 | 1 | - |
| `shimTimeoutInst` |  | 239-239 | 1 | - |
| `getTimeout` | Y | 241-275 | 35 | `shimTimeoutInst`, `timeoutCache` |
| `singletonByScope` |  | 7804-7804 | 1 | - |
| `scopeSingleton` |  | 7805-7810 | 6 | `singletonByScope` |
| `machineryCalls` | Y | 7819-7819 | 1 | - |
| `machinerySeedControllerState` | Y | 7824-8339 | 516 | - |
| `applied` |  | 8341-8341 | 1 | - |
| `applyDataMachineryScope` | Y | 8342-8804 | 463 | `applied`, `getTimeout`, `machineryCalculateImageBinding`, `machineryCalcuteFilterResult`, `machineryCalls`, `machineryChangeStar`, `machineryColorFilter`, `machineryContentFilter` … |

### tagManagerDomain（21 项 / 817 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryGetExtendTags` | Y | 289-307 | 19 | - |
| `machineryAutoResizeTagFilter` |  | 1016-1028 | 13 | - |
| `machineryCalcuteContainTagsInner` |  | 2445-2506 | 62 | - |
| `machineryCalcuteContainTags` | Y | 2509-2550 | 42 | `machineryCalcuteContainTagsInner` |
| `machineryOpenPrevGroup` |  | 4297-4321 | 25 | `machineryOpenStarredGroup`, `machineryOpenTagAllGroup`, `machineryOpenTagGroup`, `machineryOpenUnfiledGroup` |
| `machineryOpenNextGroup` |  | 4323-4344 | 22 | `machineryOpenStarredGroup`, `machineryOpenTagGroup`, `machineryOpenUnfiledGroup` |
| `machineryConvertToRegexGroup` |  | 5188-5298 | 111 | - |
| `machineryMatchWithRegexGroup` |  | 5300-5320 | 21 | - |
| `openUntaggedTimeout` |  | 5615-5615 | 1 | - |
| `machineryOpenUntagged` | Y | 5668-5706 | 39 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `openUntaggedTimeout` |
| `machineryOpenAllTags` | Y | 5738-5761 | 24 | `getTimeout`, `machineryRebindRefresh`, `machineryResetPage` |
| `machineryUpdateSubFolderWidth` | Y | 5854-5868 | 15 | - |
| `machineryOpenTagAllGroup` | Y | 6403-6417 | 15 | `tagRectSelecting` |
| `machineryOpenUnfiledGroup` | Y | 6419-6433 | 15 | `tagRectSelecting` |
| `machineryOpenStarredGroup` | Y | 6435-6449 | 15 | `tagRectSelecting` |
| `machineryOpenTagGroup` | Y | 6451-6467 | 17 | `tagRectSelecting` |
| `machineryRemoveTagGroup` | Y | 6471-6513 | 43 | `machineryOpenTagAllGroup` |
| `machineryRefreshSubfolderList` | Y | 7271-7304 | 34 | - |
| `machineryEnableSubFolderNameEditable` | Y | 7453-7548 | 96 | `machinerySelectFolder` |
| `machineryRenameTagGroup` | Y | 7576-7591 | 16 | - |
| `machineryEditTag` | Y | 7598-7769 | 172 | `getFilter`, `machineryCalculateImageBinding`, `machineryRebindRefresh`, `machineryUpdateSelection` |

### core/keymap（20 项 / 627 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryBuildMousetrap` | Y | 3122-3260 | 139 | `getPageUpHandlerFn`, `machineryBack`, `machineryChangeTo1Star`, `machineryChangeTo2Star`, `machineryChangeTo3Star`, `machineryChangeTo4Star`, `machineryChangeTo5Star`, `machineryCopyImages` … |
| `machineryInitMousetrap` | Y | 3264-3285 | 22 | `machineryBuildMousetrap` |
| `machineryKeyCHandler` | Y | 4093-4098 | 6 | `machineryToggleCommentMode` |
| `machineryKeyPHandler` | Y | 4100-4102 | 3 | `machineryOpenPluginPanel` |
| `machineryKeyLeftHandler` | Y | 4107-4152 | 46 | `machinerySelectPrev` |
| `machineryKeyRightHandler` | Y | 4156-4189 | 34 | `machinerySelectNext` |
| `machineryModUpHandler` | Y | 4194-4206 | 13 | `machineryHomeHandler` |
| `machineryModDownHandler` | Y | 4208-4220 | 13 | `machineryEndHandler` |
| `machineryModLeftHandler` | Y | 4222-4236 | 15 | `machineryPrevHistory` |
| `machineryModRightHandler` | Y | 4238-4252 | 15 | `machineryNextHistory` |
| `machineryKeyUpHandler` | Y | 4352-4466 | 115 | `machineryOpenAll`, `machineryOpenAllTags`, `machineryOpenCommunity`, `machineryOpenPrevGroup`, `machineryOpenPrevQuickAccess`, `machineryOpenRandom`, `machineryOpenUntagged`, `machinerySelectUp` |
| `machineryKeyDownHandler` | Y | 4474-4607 | 134 | `machineryOpenAllTags`, `machineryOpenCommunity`, `machineryOpenNextGroup`, `machineryOpenNextQuickAccess`, `machineryOpenRandom`, `machineryOpenUntagged`, `machinerySelectDown` |
| `machineryPageDownHandler` | Y | 4624-4636 | 13 | - |
| `machineryPageUpHandler` | Y | 4639-4656 | 18 | - |
| `machineryNHandler` | Y | 4831-4842 | 12 | - |
| `machinerySaveHandler` | Y | 4894-4899 | 6 | - |
| `machineryHomeHandler` | Y | 6215-6224 | 10 | - |
| `machineryEndHandler` | Y | 6228-6238 | 11 | - |
| `getPageUpHandlerFn` | Y | 7812-7812 | 1 | `machineryPageUpHandler`, `scopeSingleton` |
| `getPageDownHandlerFn` | Y | 7813-7813 | 1 | `machineryPageDownHandler`, `scopeSingleton` |

### miscDomain（21 项 / 419 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `getLanguageBCP` |  | 278-285 | 8 | - |
| `machineryToggleSlideshow` | Y | 1089-1095 | 7 | `machineryEnterSlideshowMode`, `machineryLeaveSlideshowMode` |
| `machineryCheckTouchIDSupport` | Y | 1330-1344 | 15 | - |
| `machineryEnterDetailMode` | Y | 2953-3047 | 95 | `getTimeout`, `machineryPreloadImage`, `zoomInitTimeout` |
| `machineryLeaveDetailMode` | Y | 3052-3109 | 58 | `getTimeout`, `machineryFadeOutDetailMode`, `machineryInitMousetrap`, `zoomInitTimeout` |
| `cgStack` |  | 3290-3290 | 1 | - |
| `cgScopes` |  | 3291-3291 | 1 | - |
| `CG_START_TOP` |  | 3292-3292 | 1 | - |
| `CG_SPACING` |  | 3293-3293 | 1 | - |
| `cgBuildTemplate` |  | 3298-3312 | 15 | - |
| `cgRestack` |  | 3315-3327 | 13 | `CG_SPACING`, `CG_START_TOP`, `cgStack` |
| `machineryNotify` | Y | 3333-3422 | 90 | `cgBuildTemplate`, `cgNotifyServiceCloseAll`, `cgRestack`, `cgStack`, `getFilter`, `getTimeout`, `undoTimeout` |
| `cgNotifyServiceCloseAll` |  | 3425-3429 | 5 | `cgStack` |
| `machineryToggleDetailMode` | Y | 3509-3511 | 3 | - |
| `machineryQuicklook` | Y | 3989-4031 | 43 | `getPageDownHandlerFn`, `machineryToggleDetailMode` |
| `machineryFadeOutDetailMode` | Y | 6379-6385 | 7 | - |
| `machineryOpenPluginPanel` | Y | 6388-6391 | 4 | - |
| `machineryEnterSlideshowMode` | Y | 6519-6536 | 18 | `getTimeout`, `machineryEnterDetailMode` |
| `machineryLeaveSlideshowMode` | Y | 6539-6554 | 16 | `getTimeout` |
| `machineryLockApp` | Y | 6559-6566 | 8 | `machineryFocusAppUnlockPassword` |
| `machineryFocusAppUnlockPassword` | Y | 6568-6577 | 10 | - |

### services/uploadService（1 项 / 219 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryOnDropContainer` | Y | 6838-7056 | 219 | `getFilter`, `machineryHideUploadQueue`, `machineryShowUploadQueue` |

### services/folderCoreService（5 项 / 115 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `openAllTimeout` |  | 2884-2884 | 1 | - |
| `machineryOpenAll` | Y | 2895-2942 | 48 | `getTimeout`, `machineryLeaveDetailMode`, `machineryOnImageSizeHeightChanged`, `machineryResetPage`, `openAllTimeout` |
| `openRandomTimeout` |  | 5614-5614 | 1 | - |
| `machineryOpenRandom` | Y | 5621-5662 | 42 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `openRandomTimeout` |
| `machineryOpenCommunity` | Y | 5711-5733 | 23 | `machineryLeaveDetailMode`, `machineryResetPage` |

### stage/grid（4 项 / 91 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryResetPage` | Y | 2817-2860 | 44 | `machineryFindDupclipate` |
| `machineryToggleAll` | Y | 4848-4887 | 40 | `getOffsetScrollbarFn`, `getTimeout` |
| `machineryAutoScroll` | Y | 5784-5789 | 6 | `getTimeout` |
| `getOffsetScrollbarFn` | Y | 7811-7811 | 1 | `scopeSingleton` |

### services/imageOpsService（7 项 / 86 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryChangeTo5Star` | Y | 4794-4797 | 4 | `machineryChangeStar` |
| `machineryRemoveStar` | Y | 4802-4804 | 3 | `machineryChangeStar` |
| `machineryChangeTo1Star` | Y | 4806-4809 | 4 | `machineryChangeStar` |
| `machineryChangeTo2Star` | Y | 4811-4814 | 4 | `machineryChangeStar` |
| `machineryChangeTo3Star` | Y | 4816-4819 | 4 | `machineryChangeStar` |
| `machineryChangeTo4Star` | Y | 4821-4824 | 4 | `machineryChangeStar` |
| `machineryChangeStar` | Y | 5118-5180 | 63 | `getFilter`, `machineryUpdateItemsView` |

### core/navHistory（9 项 / 64 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `undoTimeout` |  | 3294-3294 | 1 | - |
| `machineryUndo` | Y | 3447-3451 | 5 | `cgNotifyServiceCloseAll` |
| `machineryNextHistory` | Y | 3455-3460 | 6 | - |
| `machineryPrevHistory` | Y | 3462-3467 | 6 | - |
| `machineryBack` | Y | 3470-3477 | 8 | `machineryLeaveDetailMode`, `machineryPrevHistory` |
| `nextTimeout` |  | 3516-3516 | 1 | - |
| `prevTimeout` |  | 3517-3517 | 1 | - |
| `machineryOpenPrevQuickAccess` |  | 4259-4270 | 12 | - |
| `machineryOpenNextQuickAccess` |  | 4272-4295 | 24 | - |

### services/batchOpsService（1 项 / 24 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryRemovePermanently` | Y | 6251-6274 | 24 | `machineryCalculateImageBinding`, `machineryGetSelectedItemElements`, `machineryRebindRefresh`, `machineryUpdateSelection` |

### services/viewOpsService（1 项 / 1 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `zoomInitTimeout` |  | 2947-2947 | 1 | - |

### libraryDomain（1 项 / 1 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `lastMoveToTrashCheckbox` |  | 3739-3739 | 1 | - |

## 2. 跨域共享顶层名（≥2 域引用 —— 最后搬或抽共享模块）

- `getFilter`：filterDomain、itemDomain、miscDomain、selectionViewDomain、services/imageOpsService、services/uploadService、tagManagerDomain
- `getTimeout`：MOUNT-INFRA（最后一批/或留共享）、itemDomain、miscDomain、selectionViewDomain、services/folderCoreService、stage/grid、tagManagerDomain
- `machineryRebindRefresh`：MOUNT-INFRA（最后一批/或留共享）、filterDomain、itemDomain、selectionViewDomain、services/batchOpsService、tagManagerDomain
- `machineryLeaveDetailMode`：MOUNT-INFRA（最后一批/或留共享）、core/navHistory、itemDomain、selectionViewDomain、services/folderCoreService、tagManagerDomain
- `machineryUpdateSelection`：MOUNT-INFRA（最后一批/或留共享）、itemDomain、selectionViewDomain、services/batchOpsService、tagManagerDomain
- `machineryCalls`：MOUNT-INFRA（最后一批/或留共享）、filterDomain、itemDomain、selectionViewDomain
- `machineryCalculateImageBinding`：MOUNT-INFRA（最后一批/或留共享）、selectionViewDomain、services/batchOpsService、tagManagerDomain
- `machineryUpdateItemsView`：MOUNT-INFRA（最后一批/或留共享）、itemDomain、services/imageOpsService
- `scopeSingleton`：core/keymap、filterDomain、stage/grid
- `machinerySortRawData`：MOUNT-INFRA（最后一批/或留共享）、itemDomain
- `machineryCalcuteFilterResult`：MOUNT-INFRA（最后一批/或留共享）、itemDomain
- `machineryColorFilter`：MOUNT-INFRA（最后一批/或留共享）、filterDomain
- `machineryGrayColorFilter`：MOUNT-INFRA（最后一批/或留共享）、filterDomain
- `machineryContentFilter`：MOUNT-INFRA（最后一批/或留共享）、filterDomain
- `machineryFilterData`：MOUNT-INFRA（最后一批/或留共享）、filterDomain
- `machineryExistInSmartFilter`：MOUNT-INFRA（最后一批/或留共享）、filterDomain
- `machineryUpdateFilterCounts`：filterDomain、selectionViewDomain
- `machineryResetPage`：services/folderCoreService、tagManagerDomain
- `machineryPreloadImage`：miscDomain、selectionViewDomain
- `machineryInitMousetrap`：MOUNT-INFRA（最后一批/或留共享）、miscDomain
- `machineryMultipleSelectNext`：core/keymap、selectionViewDomain
- `machineryMultipleSelectPrev`：core/keymap、selectionViewDomain
- `machineryPrevHistory`：core/keymap、core/navHistory
- `machineryRemoveSelected`：MOUNT-INFRA（最后一批/或留共享）、core/keymap
- `machineryToggleAll`：MOUNT-INFRA（最后一批/或留共享）、core/keymap
- `machineryToggleDetailMode`：core/keymap、miscDomain
- `cgNotifyServiceCloseAll`：core/navHistory、miscDomain
- `machineryGetSelectedItemElements`：selectionViewDomain、services/batchOpsService
- `machineryGetSelectedTags`：itemDomain、selectionViewDomain
- `machinerySelectPrev`：MOUNT-INFRA（最后一批/或留共享）、core/keymap
- `machinerySelectNext`：MOUNT-INFRA（最后一批/或留共享）、core/keymap
- `machineryOpenAll`：core/keymap、filterDomain
- `machineryChangeStar`：MOUNT-INFRA（最后一批/或留共享）、services/imageOpsService
- `machineryShowUploadQueue`：itemDomain、services/uploadService
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

