# D-1 / Track B / B-0：dataMachinery.ts 映射表（自动生成）

> 生成器：`tests-tmp/bz-d1-b0-map.py`（只读分析）。施工前请人工复核域归属。

## 0. 总量

- 文件：`src/app/react/core/dataMachinery.ts`，**11152 行**
- 顶层声明：**285**（exported **217** / 私有 **68**）
- import 面：**37** 条
- 引用文件：**30**（`from .../dataMachinery`）

## 1. 域聚类（批次候选）

| 目标域 | 声明数 | 行数（含私有依赖） | 导出数 |
|---|---:|---:|---:|
| filterDomain | 27 | 1701 | 16 |
| libraryDomain | 56 | 1689 | 46 |
| itemDomain | 41 | 1546 | 30 |
| selectionViewDomain | 25 | 1111 | 21 |
| MOUNT-INFRA（最后一批/或留共享） | 9 | 1025 | 4 |
| tagManagerDomain | 21 | 817 | 14 |
| core/keymap | 20 | 627 | 20 |
| miscDomain | 21 | 419 | 13 |
| stage/grid | 23 | 397 | 20 |
| services/viewOpsService | 18 | 285 | 16 |
| services/uploadService | 1 | 219 | 1 |
| services/folderCoreService | 6 | 132 | 4 |
| services/imageOpsService | 7 | 86 | 7 |
| core/navHistory | 9 | 64 | 4 |
| services/batchOpsService | 1 | 24 | 1 |

### filterDomain（27 项 / 1701 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `filterCache` |  | 103-103 | 1 | - |
| `shimFilterInst` |  | 104-104 | 1 | - |
| `getFilter` | Y | 105-235 | 131 | `filterCache`, `shimFilterInst` |
| `machineryCalcuteFilterBadge` | Y | 721-830 | 110 | - |
| `getMatchFunctionTable` |  | 1561-1593 | 33 | - |
| `machineryIsMatchCondition` |  | 1596-1624 | 29 | `getMatchFunctionTable` |
| `machineryExistInSmartFilter` | Y | 1627-1650 | 24 | `machineryIsMatchCondition` |
| `semanticSearchController` |  | 1656-1656 | 1 | - |
| `machineryFilterDataPart1` |  | 1660-1967 | 308 | - |
| `machineryFilterDataPart2` |  | 1973-2207 | 235 | `getFilter`, `machineryColorFilter`, `machineryGrayColorFilter` |
| `machineryFilterDataPart3` |  | 2213-2529 | 317 | `imageSearchController`, `machinerySortData`, `semanticSearchController` |
| `machineryFilterData` | Y | 2532-2538 | 7 | `machineryFilterDataPart1`, `machineryFilterDataPart2`, `machineryFilterDataPart3` |
| `machineryCalcuteFilterResult` | Y | 2541-2559 | 19 | `machineryContentFilter`, `machineryFilterData` |
| `machineryContentFilter` | Y | 2654-2738 | 85 | `machineryExistInSmartFilter` |
| `calculateFilterCountsTimeout` |  | 3201-3201 | 1 | - |
| `machineryCalculateFilterCounts` | Y | 3202-3216 | 15 | `calculateFilterCountsTimeout`, `machineryUpdateFilterCounts` |
| `machinerySearchFilter` |  | 6129-6229 | 101 | `machineryConvertToRegexGroup`, `machineryMatchWithRegexGroup` |
| `machineryColorFilter` | Y | 6240-6331 | 92 | - |
| `machineryGrayColorFilter` | Y | 6334-6350 | 17 | - |
| `machineryFilterContent` | Y | 6355-6367 | 13 | `machineryCalls`, `machineryRebindRefresh` |
| `machineryUpdateFilterCounts` | Y | 7175-7276 | 102 | - |
| `FILTER_ID_MAP` |  | 8247-8267 | 21 | - |
| `machineryOpenFilter` | Y | 8269-8276 | 8 | `machineryUpdateContainerHieght` |
| `machineryToggleFilterByType` | Y | 8278-8295 | 18 | `FILTER_ID_MAP`, `machineryOpenFilter` |
| `machinerySearchInAll` | Y | 8378-8382 | 5 | `machineryFocusSeach`, `machineryOpenAll` |
| `machineryFocusSeach` | Y | 9506-9511 | 6 | - |
| `getToggleFilterByTypeFn` | Y | 10161-10161 | 1 | `machineryToggleFilterByType`, `scopeSingleton` |

### libraryDomain（56 项 / 1689 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `updateSidebarListTimeout` |  | 98-98 | 1 | - |
| `machineryGetAncestorFolders` | Y | 287-304 | 18 | - |
| `machineryUpdateSidebarList` | Y | 991-1080 | 90 | `getTimeout`, `machineryFilterSidebarItem`, `machineryGetFolderList`, `machineryGetQuickAccessList`, `machineryGetSmartFolderList`, `updateSidebarListTimeout` |
| `machinerySmartFolderCount` | Y | 1226-1241 | 16 | `machineryExistInSmartFilter` |
| `machineryGetRecentFolders` | Y | 1244-1266 | 23 | - |
| `buildRecentFileManager` |  | 2564-2650 | 87 | - |
| `machineryChangeSidebarIndex` | Y | 3138-3150 | 13 | `getTimeout` |
| `setLastFolderDebounced` |  | 3239-3239 | 1 | - |
| `machinerySetLastFolder` |  | 3240-3254 | 15 | `machinerySetViewMode`, `setLastFolderDebounced` |
| `machinerySaveFolder` | Y | 3570-3658 | 89 | - |
| `lastMoveToTrashCheckbox` |  | 4479-4479 | 1 | - |
| `machineryOpenParentFolder` | Y | 5693-5697 | 5 | - |
| `machinerySetFolderCover` | Y | 5709-5723 | 15 | `getFilter`, `machinerySaveFolder` |
| `openUnfiledTimeout` |  | 6422-6422 | 1 | - |
| `openRecentTimeout` |  | 6424-6424 | 1 | - |
| `openTrashTimeout` |  | 6425-6425 | 1 | - |
| `machineryOpenUnfiled` | Y | 6476-6514 | 39 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `machinerySetLastFolder`, `machineryUpdateListHeight`, `openUnfiledTimeout` |
| `machineryOpenRecent` | Y | 6558-6596 | 39 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `machinerySetLastFolder`, `machineryUpdateListHeight`, `openRecentTimeout` |
| `machineryOpenTrash` | Y | 6654-6692 | 39 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `machinerySetLastFolder`, `machineryUpdateListHeight`, `openTrashTimeout` |
| `machineryOpenNextFolder` | Y | 6698-6711 | 14 | `machineryChangeSidebarIndex` |
| `machineryOpenPrevFolder` | Y | 6715-6748 | 34 | `machineryChangeSidebarIndex`, `machineryOpenTrash` |
| `machineryOpenNextSmartFolder` | Y | 6752-6773 | 22 | `machineryChangeSidebarIndex` |
| `machineryOpenPrevSmartFolder` | Y | 6777-6806 | 30 | `machineryChangeSidebarIndex`, `machineryOpenTrash` |
| `machineryGetQuickAccessList` | Y | 6860-6868 | 9 | - |
| `machineryAddToRecentFile` | Y | 7299-7311 | 13 | - |
| `machineryResetFolderCover` | Y | 7458-7465 | 8 | `machineryGetAncestorFolders` |
| `machineryRemoveSmartFolder` | Y | 7501-7525 | 25 | `getFilter`, `machineryRemoveSmartFolderInner` |
| `machineryRemoveSmartFolderInner` |  | 7527-7610 | 84 | `getFilter`, `getTimeout`, `machineryOpenAll`, `machinerySaveFolderDebounce`, `machineryUpdateSidebarList` |
| `machineryRemoveFolder` | Y | 7614-7660 | 47 | `getFilter`, `machineryCheckOperationSafety2`, `machineryRemoveFolderInner` |
| `machineryRemoveFolderInner` |  | 7662-7812 | 151 | `getFilter`, `machineryCalculateImageBinding`, `machineryOpenAll`, `machineryRebindRefresh`, `machinerySaveFolderDebounce`, `machineryUpdateSidebarList` |
| `machineryRemoveFolderContents` | Y | 7893-8017 | 125 | `getFilter`, `getTimeout`, `machineryAutoScroll`, `machineryCalculateImageBinding`, `machineryForceFitImageSize`, `machineryGetSelectedItemElements`, `machineryGetSelection`, `machineryLeaveDetailMode` … |
| `machinerySaveFolderDebounce` | Y | 8045-8053 | 9 | `machinerySaveFolder` |
| `machineryGetChildFoldersMaps` | Y | 8299-8309 | 11 | - |
| `machineryMultipleOpenFolder` | Y | 8314-8355 | 42 | `machineryGetChildFoldersMaps` |
| `machineryExpandFolder` | Y | 8361-8367 | 7 | `machineryUpdateSidebarList` |
| `machineryExpandSmartFolder` | Y | 8369-8375 | 7 | `machineryUpdateSidebarList` |
| `machineryToggleCurrentLevelSmartFoldersInner` | Y | 8399-8408 | 10 | `machineryUpdateSidebarList` |
| `machineryToggleAllSmartFoldersInner` | Y | 8410-8419 | 10 | `machineryUpdateSidebarList` |
| `machineryToggleCurrentLevelSmartFolders` | Y | 8431-8439 | 9 | `machineryToggleCurrentLevelSmartFoldersInner` |
| `machineryToggleAllSmartFolderExpand` | Y | 8441-8460 | 20 | `machineryChangeSidebarIndex`, `machineryToggleAllSmartFoldersInner`, `machineryUpdateSidebarList` |
| `machinerySetFolderOrder` | Y | 8464-8481 | 18 | `machinerySaveFolder` |
| `machinerySetSmartFolderOrder` | Y | 8483-8500 | 18 | `machinerySaveFolder` |
| `machineryQuickOpenFolder` | Y | 8515-8554 | 40 | `getTimeout`, `machineryAutoScroll`, `machineryChangeSidebarIndex`, `machineryOpenAll` |
| `machineryRenameFolder` | Y | 8561-8579 | 19 | - |
| `machineryRenameSmartFolder` | Y | 8581-8597 | 17 | - |
| `machineryShowTutorial` | Y | 8601-8642 | 42 | `getFilter` |
| `machineryUnlockFolderWithTouchID` | Y | 8649-8691 | 43 | `machineryCalculateImageBinding`, `machineryUpdateSelection`, `machineryUpdateSidebarList` |
| `machineryGetSmartFolderList` | Y | 8698-8792 | 95 | - |
| `machineryGetFolderList` | Y | 8797-8882 | 86 | - |
| `machineryGetAllChildFolder` | Y | 9456-9464 | 9 | - |
| `machineryPrependFolder` | Y | 9518-9527 | 10 | `machineryCalculateImageBinding`, `machinerySaveFolder`, `machineryUpdateSidebarList` |
| `machineryBatchRenameFolders` | Y | 9809-9817 | 9 | - |
| `machineryBatchRenameSmartFolders` | Y | 9819-9827 | 9 | - |
| `machineryRenameCurrentFolder` | Y | 10030-10102 | 73 | `getTimeout`, `machineryBatchRenameFolders`, `machineryBatchRenameSmartFolders`, `machineryEditTag`, `machineryEnableSubFolderNameEditable`, `machineryGetSelectedTags`, `machineryRenameFolder`, `machineryRenameImages` … |
| `machineryToggleAllFolders` | Y | 10125-10134 | 10 | `machineryUpdateSidebarList` |
| `machineryToggleCurrentLevelFolders` | Y | 10136-10145 | 10 | `machineryUpdateSidebarList` |

### itemDomain（41 项 / 1546 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `calculateImageBindingTimeout` |  | 95-95 | 1 | - |
| `rebindRefreshLazyTimeout` |  | 99-99 | 1 | - |
| `prependImagesTimeout` |  | 101-101 | 1 | - |
| `machinerySortRawData` | Y | 328-426 | 99 | `getLanguageBCP` |
| `machineryCalculateImageBinding` | Y | 429-715 | 287 | `calculateImageBindingTimeout`, `getFilter`, `getTimeout`, `machineryGetAncestorFolders`, `machineryGetExtendTags`, `machinerySortRawData` |
| `machineryFilterSidebarItem` | Y | 835-872 | 38 | - |
| `machineryRebindRefresh` | Y | 878-977 | 100 | `machineryCalcuteContainTags`, `machineryCalcuteFilterBadge`, `machineryCalcuteFilterResult`, `machineryCalls`, `machineryRefreshSubfolderList`, `machineryUpdateItemsView` |
| `machineryRebindRefreshLazy` | Y | 980-986 | 7 | `getTimeout`, `machineryRebindRefresh`, `rebindRefreshLazyTimeout` |
| `machineryUpdateItemsView` | Y | 1085-1092 | 8 | `machineryUpdateItemView` |
| `machineryResetImageData` |  | 1101-1107 | 7 | - |
| `machineryPrependImages` | Y | 1111-1124 | 14 | `machineryResetImageData`, `prependImagesTimeout` |
| `machineryReload` | Y | 1145-1190 | 46 | `machineryAdjustLayoutWidth`, `machineryAutoResizeTagFilter`, `machineryCalculateFilterCounts`, `machineryLeaveDetailMode`, `machineryRebindRefresh`, `machineryRelayout`, `machineryUpdateSelection`, `machineryUpdateSubFolderWidth` |
| `machineryUpdateItemView` | Y | 1272-1494 | 223 | `getFilter` |
| `imageSearchController` |  | 1655-1655 | 1 | - |
| `machineryCopyImages` | Y | 4775-4828 | 54 | `getFilter`, `machineryGetSelectedTags` |
| `machineryCreateTxtFileFromTemplate` | Y | 5701-5705 | 5 | `machineryNewFileFromTemplate` |
| `machineryGetItemByElement` | Y | 5914-5919 | 6 | - |
| `machineryNewFileFromTemplate` | Y | 6378-6414 | 37 | `machineryShowUploadQueue` |
| `checkListItemsLessThanContainerTimeout` |  | 6872-6872 | 1 | - |
| `machineryCheckListItemsLessThanContainer` | Y | 6877-6894 | 18 | `checkListItemsLessThanContainerTimeout` |
| `machineryScrollToCurrentItem` | Y | 6958-6970 | 13 | - |
| `machineryForceFitImageSize` | Y | 6974-6992 | 19 | - |
| `machinerySortData` | Y | 7017-7129 | 113 | - |
| `preloadImageTimeout` |  | 7314-7314 | 1 | - |
| `machineryPreloadImage` | Y | 7318-7348 | 31 | `machineryCurrentIndex`, `preloadImageTimeout` |
| `machineryToggleCommentMode` | Y | 8022-8026 | 5 | - |
| `machineryRemoveFromDuplicateMapping` | Y | 8388-8392 | 5 | - |
| `machineryEnlargeThumbnailsTimeout` |  | 8894-8894 | 1 | - |
| `machineryEnlargeThumbnails` | Y | 8895-8913 | 19 | `machineryEnlargeThumbnailsTimeout` |
| `machineryShrinkThumbnailsTimeout` |  | 8915-8915 | 1 | - |
| `machineryShrinkThumbnails` | Y | 8916-8933 | 18 | `machineryShrinkThumbnailsTimeout` |
| `machineryOnImageSizeHeightChanged` | Y | 8936-8946 | 11 | `machineryEnlargeThumbnails`, `machineryShrinkThumbnails`, `machineryUpdateListSlider`, `machineryUpdateSubFolderWidth` |
| `machineryChangeMetaItems` | Y | 8956-8963 | 8 | `machineryUpdateItemsView` |
| `addImageTimeLeftInterval` |  | 8971-8971 | 1 | - |
| `machineryCalcuteAddImageTimeLeft` |  | 8975-8990 | 16 | - |
| `machineryShowUploadQueue` | Y | 9225-9238 | 14 | `addImageTimeLeftInterval`, `machineryCalcuteAddImageTimeLeft` |
| `machineryHideUploadQueue` | Y | 9240-9247 | 8 | - |
| `machineryGetFolderImages` | Y | 9259-9284 | 26 | - |
| `machineryFindDupclipate` | Y | 9290-9453 | 164 | `machineryGetFolderImages` |
| `machineryEnableImageNameEditable` | Y | 9585-9683 | 99 | - |
| `machineryRenameImages` | Y | 9788-9806 | 19 | `machineryEnableImageNameEditable` |

### selectionViewDomain（25 项 / 1111 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `updateSelectionTimeout` |  | 2852-2852 | 1 | - |
| `machineryUpdateSelection` | Y | 2854-3042 | 189 | `getFilter`, `getTimeout`, `machineryCalls`, `sortTagsForSelection`, `updateSelectionTimeout` |
| `sortTagsForSelection` |  | 3045-3078 | 34 | - |
| `machineryGetSelection` | Y | 3118-3135 | 18 | - |
| `cleanSelectedTimeout` |  | 4222-4222 | 1 | - |
| `machinerySelectAll` | Y | 4225-4245 | 21 | `cleanSelectedTimeout`, `getTimeout` |
| `machinerySelectNext` | Y | 4261-4318 | 58 | `getTimeout`, `machineryAddToRecentFile`, `machineryAutoScroll`, `machineryForceFitImageSize`, `machineryGetSelection`, `machineryLastZoom`, `machineryPreloadImage`, `machineryRememberScrollTops` … |
| `machinerySelectPrev` | Y | 4322-4388 | 67 | `getTimeout`, `machineryAddToRecentFile`, `machineryAutoScroll`, `machineryForceFitImageSize`, `machineryGetSelection`, `machineryLastZoom`, `machineryPreloadImage`, `machineryRememberScrollTops` … |
| `machineryMultipleSelectUp` | Y | 4393-4401 | 9 | `machineryMultipleSelectPrev` |
| `machineryMultipleSelectDown` | Y | 4404-4412 | 9 | `machineryMultipleSelectNext` |
| `machineryMultipleSelectNext` | Y | 4416-4443 | 28 | `machineryAutoScroll`, `machineryGetSelection` |
| `machineryMultipleSelectPrev` | Y | 4447-4474 | 28 | `machineryAutoScroll`, `machineryGetSelection` |
| `machineryRemoveSelected` | Y | 4486-4722 | 237 | `getFilter`, `getTimeout`, `lastMoveToTrashCheckbox`, `machineryAutoScroll`, `machineryCalculateImageBinding`, `machineryCheckOperationSafety`, `machineryCurrentIndex`, `machineryForceFitImageSize` … |
| `machinerySelectUp` | Y | 5425-5488 | 64 | `machineryAutoScroll`, `machineryForceFitImageSize`, `machineryGetItemByElement`, `machineryGetSelection`, `machineryLastZoom`, `machineryZoom` |
| `machinerySelectDown` | Y | 5490-5552 | 63 | `machineryAutoScroll`, `machineryForceFitImageSize`, `machineryGetArroundBox`, `machineryGetItemByElement`, `machineryGetSelection`, `machineryLastZoom`, `machineryZoom` |
| `machineryOpenInspectorTagSelectPanel` | Y | 5729-5732 | 4 | - |
| `machineryOpenInspectorFolderSelectPanel` | Y | 5744-5908 | 165 | `getFilter`, `machineryCalculateImageBinding`, `machineryCheckOperationSafety`, `machineryRebindRefresh`, `machineryUpdateFilterCounts`, `machineryUpdateSelection` |
| `machineryGetSelectedItems` | Y | 6827-6838 | 12 | - |
| `machineryGetSelectedItemElements` | Y | 6841-6851 | 11 | `machineryGetSelectedItems` |
| `machineryGetSelectedTags` | Y | 6854-6857 | 4 | - |
| `machineryRemoveSelectedFolders` | Y | 7816-7854 | 39 | `getFilter`, `machineryCheckOperationSafety2`, `machineryRemoveFolderInner` |
| `machineryRemoveSelectedSmartFolders` | Y | 7858-7885 | 28 | `getFilter`, `machineryRemoveSmartFolderInner` |
| `tagRectSelecting` |  | 8056-8056 | 1 | - |
| `machineryToggleSelectSmartFolder` | Y | 8424-8429 | 6 | `machineryToggleCurrentLevelSmartFoldersInner` |
| `machinerySelectFolder` | Y | 9565-9578 | 14 | `machineryUpdateSelection` |

### MOUNT-INFRA（最后一批/或留共享）（9 项 / 1025 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `timeoutCache` |  | 237-237 | 1 | - |
| `shimTimeoutInst` |  | 238-238 | 1 | - |
| `getTimeout` | Y | 240-274 | 35 | `shimTimeoutInst`, `timeoutCache` |
| `singletonByScope` |  | 10151-10151 | 1 | - |
| `scopeSingleton` |  | 10152-10157 | 6 | `singletonByScope` |
| `machineryCalls` | Y | 10166-10166 | 1 | - |
| `machinerySeedControllerState` | Y | 10171-10686 | 516 | - |
| `applied` |  | 10688-10688 | 1 | - |
| `applyDataMachineryScope` | Y | 10689-11151 | 463 | `applied`, `buildRecentFileManager`, `buildScrollbarSaver`, `getTimeout`, `machineryCalculateImageBinding`, `machineryCalcuteFilterResult`, `machineryCalls`, `machineryChangeStar` … |

### tagManagerDomain（21 项 / 817 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryGetExtendTags` | Y | 307-325 | 19 | - |
| `machineryAutoResizeTagFilter` |  | 1127-1139 | 13 | - |
| `machineryCalcuteContainTagsInner` |  | 2741-2802 | 62 | - |
| `machineryCalcuteContainTags` | Y | 2805-2846 | 42 | `machineryCalcuteContainTagsInner` |
| `machineryOpenPrevGroup` |  | 5037-5061 | 25 | `machineryOpenStarredGroup`, `machineryOpenTagAllGroup`, `machineryOpenTagGroup`, `machineryOpenUnfiledGroup` |
| `machineryOpenNextGroup` |  | 5063-5084 | 22 | `machineryOpenStarredGroup`, `machineryOpenTagGroup`, `machineryOpenUnfiledGroup` |
| `machineryConvertToRegexGroup` |  | 5995-6105 | 111 | - |
| `machineryMatchWithRegexGroup` |  | 6107-6127 | 21 | - |
| `openUntaggedTimeout` |  | 6423-6423 | 1 | - |
| `machineryOpenUntagged` | Y | 6517-6555 | 39 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `machinerySetLastFolder`, `machineryUpdateListHeight`, `openUntaggedTimeout` |
| `machineryOpenAllTags` | Y | 6627-6650 | 24 | `getTimeout`, `machineryRebindRefresh`, `machineryResetPage` |
| `machineryUpdateSubFolderWidth` | Y | 6898-6912 | 15 | - |
| `machineryOpenTagAllGroup` | Y | 8062-8076 | 15 | `tagRectSelecting` |
| `machineryOpenUnfiledGroup` | Y | 8078-8092 | 15 | `tagRectSelecting` |
| `machineryOpenStarredGroup` | Y | 8094-8108 | 15 | `tagRectSelecting` |
| `machineryOpenTagGroup` | Y | 8110-8126 | 17 | `tagRectSelecting` |
| `machineryRemoveTagGroup` | Y | 8130-8172 | 43 | `machineryOpenTagAllGroup` |
| `machineryRefreshSubfolderList` | Y | 9470-9503 | 34 | `machineryGetAllChildFolder` |
| `machineryEnableSubFolderNameEditable` | Y | 9688-9783 | 96 | `machinerySelectFolder` |
| `machineryRenameTagGroup` | Y | 9830-9845 | 16 | - |
| `machineryEditTag` | Y | 9852-10023 | 172 | `getFilter`, `machineryCalculateImageBinding`, `machineryRebindRefresh`, `machinerySaveFolder`, `machineryUpdateSelection` |

### core/keymap（20 项 / 627 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryBuildMousetrap` | Y | 3665-3803 | 139 | `getPageUpHandlerFn`, `machineryBack`, `machineryChangeTo1Star`, `machineryChangeTo2Star`, `machineryChangeTo3Star`, `machineryChangeTo4Star`, `machineryChangeTo5Star`, `machineryCopyImages` … |
| `machineryInitMousetrap` | Y | 3807-3828 | 22 | `machineryBuildMousetrap` |
| `machineryKeyCHandler` | Y | 4833-4838 | 6 | `machineryToggleCommentMode` |
| `machineryKeyPHandler` | Y | 4840-4842 | 3 | `machineryOpenPluginPanel` |
| `machineryKeyLeftHandler` | Y | 4847-4892 | 46 | `machinerySelectPrev`, `machineryUpdateSidebarList` |
| `machineryKeyRightHandler` | Y | 4896-4929 | 34 | `machinerySelectNext`, `machineryUpdateSidebarList` |
| `machineryModUpHandler` | Y | 4934-4946 | 13 | `machineryHomeHandler` |
| `machineryModDownHandler` | Y | 4948-4960 | 13 | `machineryEndHandler` |
| `machineryModLeftHandler` | Y | 4962-4976 | 15 | `machineryPrevHistory` |
| `machineryModRightHandler` | Y | 4978-4992 | 15 | `machineryNextHistory` |
| `machineryKeyUpHandler` | Y | 5092-5206 | 115 | `machineryOpenAll`, `machineryOpenAllTags`, `machineryOpenCommunity`, `machineryOpenPrevFolder`, `machineryOpenPrevGroup`, `machineryOpenPrevQuickAccess`, `machineryOpenPrevSmartFolder`, `machineryOpenRandom` … |
| `machineryKeyDownHandler` | Y | 5214-5347 | 134 | `machineryOpenAllTags`, `machineryOpenCommunity`, `machineryOpenNextFolder`, `machineryOpenNextGroup`, `machineryOpenNextQuickAccess`, `machineryOpenNextSmartFolder`, `machineryOpenRandom`, `machineryOpenRecent` … |
| `machineryPageDownHandler` | Y | 5387-5399 | 13 | `machineryScrollbarTo` |
| `machineryPageUpHandler` | Y | 5402-5419 | 18 | `machineryScrollbarTo` |
| `machineryNHandler` | Y | 5594-5605 | 12 | - |
| `machinerySaveHandler` | Y | 5663-5668 | 6 | - |
| `machineryHomeHandler` | Y | 7354-7363 | 10 | `machineryGotoTop` |
| `machineryEndHandler` | Y | 7367-7377 | 11 | `machineryGotoBottom` |
| `getPageUpHandlerFn` | Y | 10159-10159 | 1 | `machineryPageUpHandler`, `scopeSingleton` |
| `getPageDownHandlerFn` | Y | 10160-10160 | 1 | `machineryPageDownHandler`, `scopeSingleton` |

### miscDomain（21 项 / 419 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `getLanguageBCP` |  | 277-284 | 8 | - |
| `machineryToggleSlideshow` | Y | 1217-1223 | 7 | `machineryEnterSlideshowMode`, `machineryLeaveSlideshowMode` |
| `machineryCheckTouchIDSupport` | Y | 1499-1513 | 15 | - |
| `machineryEnterDetailMode` | Y | 3407-3501 | 95 | `getTimeout`, `machineryAddToRecentFile`, `machineryLastZoom`, `machineryPreloadImage`, `machineryZoom`, `zoomInitTimeout` |
| `machineryLeaveDetailMode` | Y | 3506-3563 | 58 | `getTimeout`, `machineryFadeOutDetailMode`, `machineryInitMousetrap`, `machineryRememberScrollTops`, `zoomInitTimeout` |
| `cgStack` |  | 3833-3833 | 1 | - |
| `cgScopes` |  | 3834-3834 | 1 | - |
| `CG_START_TOP` |  | 3835-3835 | 1 | - |
| `CG_SPACING` |  | 3836-3836 | 1 | - |
| `cgBuildTemplate` |  | 3841-3855 | 15 | - |
| `cgRestack` |  | 3858-3870 | 13 | `CG_SPACING`, `CG_START_TOP`, `cgStack` |
| `machineryNotify` | Y | 3876-3965 | 90 | `cgBuildTemplate`, `cgNotifyServiceCloseAll`, `cgRestack`, `cgStack`, `getFilter`, `getTimeout`, `undoTimeout` |
| `cgNotifyServiceCloseAll` |  | 3968-3972 | 5 | `cgStack` |
| `machineryToggleDetailMode` | Y | 4249-4251 | 3 | - |
| `machineryQuicklook` | Y | 4729-4771 | 43 | `getPageDownHandlerFn`, `machineryToggleDetailMode` |
| `machineryFadeOutDetailMode` | Y | 8029-8035 | 7 | - |
| `machineryOpenPluginPanel` | Y | 8038-8041 | 4 | - |
| `machineryEnterSlideshowMode` | Y | 8178-8195 | 18 | `getTimeout`, `machineryEnterDetailMode`, `machineryZoom` |
| `machineryLeaveSlideshowMode` | Y | 8198-8213 | 16 | `getTimeout`, `machineryZoom` |
| `machineryLockApp` | Y | 8218-8225 | 8 | `machineryFocusAppUnlockPassword` |
| `machineryFocusAppUnlockPassword` | Y | 8227-8236 | 10 | - |

### stage/grid（23 项 / 397 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machinerySwitchLayout` | Y | 1096-1098 | 3 | - |
| `machineryRelayout` | Y | 1517-1555 | 39 | - |
| `machinerySaveListHeight` | Y | 3101-3103 | 3 | - |
| `machineryAdjustLayoutWidth` | Y | 3106-3108 | 3 | - |
| `machineryResetPage` | Y | 3154-3197 | 44 | `machineryFindDupclipate` |
| `updateListHeightTimeout` |  | 3222-3222 | 1 | - |
| `machineryUpdateListHeight` | Y | 3257-3263 | 7 | `updateListHeightTimeout` |
| `buildScrollbarSaver` | Y | 3266-3344 | 79 | - |
| `machineryUpdateContainerHieght` | Y | 4149-4181 | 33 | - |
| `machineryGetArroundBox` | Y | 5352-5357 | 6 | - |
| `machineryScrollbarTo` |  | 5368-5383 | 16 | - |
| `machineryToggleAll` | Y | 5611-5650 | 40 | `getOffsetScrollbarFn`, `getTimeout`, `machineryRelayout`, `machineryZoomFitEdge` |
| `machineryAutoScroll` | Y | 6812-6817 | 6 | `getTimeout` |
| `machineryCurrentIndex` | Y | 6820-6823 | 4 | - |
| `changeListHeightTimeout` |  | 6873-6873 | 1 | - |
| `machineryChangeListHeight` | Y | 6918-6955 | 38 | `changeListHeightTimeout`, `machineryRelayout`, `machineryScrollToCurrentItem` |
| `machineryOffsetScrollbarImm` | Y | 7134-7161 | 28 | `machineryUpdateContainerHieght` |
| `machineryOffsetScrollbar` | Y | 7165-7170 | 6 | `machineryOffsetScrollbarImm` |
| `machineryRememberScrollTops` | Y | 7284-7293 | 10 | - |
| `machineryUpdateListSlider` | Y | 8887-8889 | 3 | - |
| `machineryGotoTop` | Y | 9532-9542 | 11 | - |
| `machineryGotoBottom` | Y | 9544-9558 | 15 | - |
| `getOffsetScrollbarFn` | Y | 10158-10158 | 1 | `machineryOffsetScrollbar`, `scopeSingleton` |

### services/viewOpsService（18 项 / 285 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryGetRatioExp` | Y | 1195-1200 | 6 | - |
| `machineryGetRatioNonExp` | Y | 1203-1208 | 6 | - |
| `machineryUpdateZoomRatio` | Y | 1212-1214 | 3 | - |
| `machineryZoom` | Y | 3081-3095 | 15 | `machinerySmartZoom`, `machineryZoomFit`, `machineryZoomFitEdge` |
| `machineryZoomFit` | Y | 3111-3113 | 3 | - |
| `setViewModeDebounced` |  | 3226-3226 | 1 | - |
| `machinerySetViewMode` | Y | 3227-3236 | 10 | `setViewModeDebounced` |
| `zoomInitTimeout` |  | 3401-3401 | 1 | - |
| `machineryLastZoom` | Y | 3977-3993 | 17 | `machineryGetRatioNonExp`, `machineryOnZoomRatioChanged` |
| `machinerySmartZoom` | Y | 3997-3999 | 3 | - |
| `machineryZoomActual` | Y | 4004-4043 | 40 | `machineryAdjustLayoutWidth`, `machineryChangeListHeight`, `machineryOnImageSizeHeightChanged`, `machineryOnZoomRatioChanged`, `machinerySaveListHeight`, `machineryUpdateZoomRatio` |
| `machineryToggleZoom` | Y | 4046-4076 | 31 | `machineryZoomActual`, `machineryZoomFit`, `machineryZoomFitEdge` |
| `machineryZoomFitEdge` | Y | 4079-4146 | 68 | `machineryGetRatioNonExp`, `machineryOnZoomRatioChanged` |
| `machineryZoomIn` | Y | 5654-5656 | 3 | - |
| `machineryZoomOut` | Y | 5658-5660 | 3 | - |
| `machineryCheckOperationSafety` | Y | 7383-7417 | 35 | `getFilter` |
| `machineryCheckOperationSafety2` | Y | 7420-7454 | 35 | `getFilter` |
| `machineryOnZoomRatioChanged` | Y | 8949-8953 | 5 | - |

### services/uploadService（1 项 / 219 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryOnDropContainer` | Y | 9001-9219 | 219 | `getFilter`, `machineryHideUploadQueue`, `machineryShowUploadQueue` |

### services/folderCoreService（6 项 / 132 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `openAllTimeout` |  | 3221-3221 | 1 | - |
| `machineryOpenAll` | Y | 3349-3396 | 48 | `getTimeout`, `machineryLeaveDetailMode`, `machineryOnImageSizeHeightChanged`, `machineryResetPage`, `machinerySetLastFolder`, `machineryUpdateListHeight`, `openAllTimeout` |
| `machineryRefreshRandom` | Y | 5672-5688 | 17 | - |
| `openRandomTimeout` |  | 6421-6421 | 1 | - |
| `machineryOpenRandom` | Y | 6431-6472 | 42 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `machinerySetLastFolder`, `openRandomTimeout` |
| `machineryOpenCommunity` | Y | 6600-6622 | 23 | `machineryLeaveDetailMode`, `machineryResetPage` |

### services/imageOpsService（7 项 / 86 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryChangeTo5Star` | Y | 5557-5560 | 4 | `machineryChangeStar` |
| `machineryRemoveStar` | Y | 5565-5567 | 3 | `machineryChangeStar` |
| `machineryChangeTo1Star` | Y | 5569-5572 | 4 | `machineryChangeStar` |
| `machineryChangeTo2Star` | Y | 5574-5577 | 4 | `machineryChangeStar` |
| `machineryChangeTo3Star` | Y | 5579-5582 | 4 | `machineryChangeStar` |
| `machineryChangeTo4Star` | Y | 5584-5587 | 4 | `machineryChangeStar` |
| `machineryChangeStar` | Y | 5925-5987 | 63 | `getFilter`, `machineryCheckOperationSafety`, `machineryUpdateItemsView` |

### core/navHistory（9 项 / 64 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `undoTimeout` |  | 3837-3837 | 1 | - |
| `machineryUndo` | Y | 4187-4191 | 5 | `cgNotifyServiceCloseAll` |
| `machineryNextHistory` | Y | 4195-4200 | 6 | - |
| `machineryPrevHistory` | Y | 4202-4207 | 6 | - |
| `machineryBack` | Y | 4210-4217 | 8 | `machineryLeaveDetailMode`, `machineryPrevHistory` |
| `nextTimeout` |  | 4256-4256 | 1 | - |
| `prevTimeout` |  | 4257-4257 | 1 | - |
| `machineryOpenPrevQuickAccess` |  | 4999-5010 | 12 | `machineryOpenTrash` |
| `machineryOpenNextQuickAccess` |  | 5012-5035 | 24 | - |

### services/batchOpsService（1 项 / 24 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryRemovePermanently` | Y | 7469-7492 | 24 | `machineryCalculateImageBinding`, `machineryGetSelectedItemElements`, `machineryRebindRefresh`, `machineryUpdateSelection` |

## 2. 跨域共享顶层名（≥2 域引用 —— 最后搬或抽共享模块）

- `getFilter`：filterDomain、itemDomain、libraryDomain、miscDomain、selectionViewDomain、services/imageOpsService、services/uploadService、services/viewOpsService、tagManagerDomain
- `getTimeout`：MOUNT-INFRA（最后一批/或留共享）、itemDomain、libraryDomain、miscDomain、selectionViewDomain、services/folderCoreService、stage/grid、tagManagerDomain
- `machineryRebindRefresh`：MOUNT-INFRA（最后一批/或留共享）、filterDomain、itemDomain、libraryDomain、selectionViewDomain、services/batchOpsService、tagManagerDomain
- `machineryLeaveDetailMode`：MOUNT-INFRA（最后一批/或留共享）、core/navHistory、itemDomain、libraryDomain、selectionViewDomain、services/folderCoreService、tagManagerDomain
- `machineryUpdateSelection`：MOUNT-INFRA（最后一批/或留共享）、itemDomain、libraryDomain、selectionViewDomain、services/batchOpsService、tagManagerDomain
- `machineryCalculateImageBinding`：MOUNT-INFRA（最后一批/或留共享）、libraryDomain、selectionViewDomain、services/batchOpsService、tagManagerDomain
- `machineryCalls`：MOUNT-INFRA（最后一批/或留共享）、filterDomain、itemDomain、selectionViewDomain
- `machineryZoom`：MOUNT-INFRA（最后一批/或留共享）、libraryDomain、miscDomain、selectionViewDomain
- `machineryUpdateItemsView`：MOUNT-INFRA（最后一批/或留共享）、itemDomain、services/imageOpsService
- `machineryRelayout`：MOUNT-INFRA（最后一批/或留共享）、itemDomain、stage/grid
- `machineryExistInSmartFilter`：MOUNT-INFRA（最后一批/或留共享）、filterDomain、libraryDomain
- `machineryUpdateFilterCounts`：filterDomain、libraryDomain、selectionViewDomain
- `machineryResetPage`：libraryDomain、services/folderCoreService、tagManagerDomain
- `machinerySetLastFolder`：libraryDomain、services/folderCoreService、tagManagerDomain
- `machineryUpdateListHeight`：libraryDomain、services/folderCoreService、tagManagerDomain
- `machineryGetSelectedItemElements`：libraryDomain、selectionViewDomain、services/batchOpsService
- `machineryGetSelectedTags`：itemDomain、libraryDomain、selectionViewDomain
- `machineryUpdateSidebarList`：MOUNT-INFRA（最后一批/或留共享）、core/keymap、libraryDomain
- `machineryOpenTrash`：core/keymap、core/navHistory、libraryDomain
- `machineryOpenAll`：core/keymap、filterDomain、libraryDomain
- `machinerySaveFolder`：MOUNT-INFRA（最后一批/或留共享）、libraryDomain、tagManagerDomain
- `scopeSingleton`：core/keymap、filterDomain、stage/grid
- `machineryGetAncestorFolders`：itemDomain、libraryDomain
- `machinerySortRawData`：MOUNT-INFRA（最后一批/或留共享）、itemDomain
- `machineryCalcuteFilterResult`：MOUNT-INFRA（最后一批/或留共享）、itemDomain
- `machineryAdjustLayoutWidth`：itemDomain、services/viewOpsService
- `machineryColorFilter`：MOUNT-INFRA（最后一批/或留共享）、filterDomain
- `machineryGrayColorFilter`：MOUNT-INFRA（最后一批/或留共享）、filterDomain
- `machineryContentFilter`：MOUNT-INFRA（最后一批/或留共享）、filterDomain
- `machineryFilterData`：MOUNT-INFRA（最后一批/或留共享）、filterDomain
- `machineryZoomFitEdge`：services/viewOpsService、stage/grid
- `machineryOnImageSizeHeightChanged`：services/folderCoreService、services/viewOpsService
- `machineryAddToRecentFile`：miscDomain、selectionViewDomain
- `machineryLastZoom`：miscDomain、selectionViewDomain
- `machineryPreloadImage`：miscDomain、selectionViewDomain
- `machineryInitMousetrap`：MOUNT-INFRA（最后一批/或留共享）、miscDomain
- `machineryRememberScrollTops`：miscDomain、selectionViewDomain
- `machineryMultipleSelectNext`：core/keymap、selectionViewDomain
- `machineryMultipleSelectPrev`：core/keymap、selectionViewDomain
- `machineryPrevHistory`：core/keymap、core/navHistory
- `machineryRemoveSelected`：MOUNT-INFRA（最后一批/或留共享）、core/keymap
- `machineryToggleAll`：MOUNT-INFRA（最后一批/或留共享）、core/keymap
- `machineryToggleDetailMode`：core/keymap、miscDomain
- `cgNotifyServiceCloseAll`：core/navHistory、miscDomain
- `machineryGetRatioNonExp`：MOUNT-INFRA（最后一批/或留共享）、services/viewOpsService
- `machineryUpdateZoomRatio`：MOUNT-INFRA（最后一批/或留共享）、services/viewOpsService
- `machineryAutoScroll`：libraryDomain、selectionViewDomain
- `machineryForceFitImageSize`：libraryDomain、selectionViewDomain
- `machineryGetSelection`：libraryDomain、selectionViewDomain
- `machineryCheckOperationSafety`：selectionViewDomain、services/imageOpsService
- `machineryCurrentIndex`：itemDomain、selectionViewDomain
- `machinerySelectPrev`：MOUNT-INFRA（最后一批/或留共享）、core/keymap
- `machinerySelectNext`：MOUNT-INFRA（最后一批/或留共享）、core/keymap
- `machineryChangeStar`：MOUNT-INFRA（最后一批/或留共享）、services/imageOpsService
- `machineryShowUploadQueue`：itemDomain、services/uploadService
- `machineryUpdateContainerHieght`：filterDomain、stage/grid
- `machineryRemoveSmartFolderInner`：libraryDomain、selectionViewDomain
- `machineryCheckOperationSafety2`：libraryDomain、selectionViewDomain
- `machineryRemoveFolderInner`：libraryDomain、selectionViewDomain
- `machineryEnterDetailMode`：MOUNT-INFRA（最后一批/或留共享）、miscDomain
- `machineryToggleCurrentLevelSmartFoldersInner`：libraryDomain、selectionViewDomain

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

