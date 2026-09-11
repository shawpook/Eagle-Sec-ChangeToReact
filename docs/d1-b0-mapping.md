# D-1 / Track B / B-0：dataMachinery.ts 映射表（自动生成）

> 生成器：`tests-tmp/bz-d1-b0-map.py`（只读分析）。施工前请人工复核域归属。

## 0. 总量

- 文件：`src/app/react/core/dataMachinery.ts`，**10912 行**
- 顶层声明：**275**（exported **207** / 私有 **68**）
- import 面：**38** 条
- 引用文件：**30**（`from .../dataMachinery`）

## 1. 域聚类（批次候选）

| 目标域 | 声明数 | 行数（含私有依赖） | 导出数 |
|---|---:|---:|---:|
| filterDomain | 27 | 1701 | 16 |
| itemDomain | 40 | 1520 | 29 |
| libraryDomain | 48 | 1494 | 38 |
| selectionViewDomain | 25 | 1111 | 21 |
| MOUNT-INFRA（最后一批/或留共享） | 9 | 1025 | 4 |
| tagManagerDomain | 21 | 817 | 14 |
| core/keymap | 20 | 627 | 20 |
| miscDomain | 21 | 419 | 13 |
| stage/grid | 23 | 397 | 20 |
| services/viewOpsService | 18 | 285 | 16 |
| services/uploadService | 1 | 219 | 1 |
| services/folderCoreService | 5 | 115 | 3 |
| services/imageOpsService | 7 | 86 | 7 |
| core/navHistory | 9 | 64 | 4 |
| services/batchOpsService | 1 | 24 | 1 |

### filterDomain（27 项 / 1701 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `filterCache` |  | 104-104 | 1 | - |
| `shimFilterInst` |  | 105-105 | 1 | - |
| `getFilter` | Y | 106-236 | 131 | `filterCache`, `shimFilterInst` |
| `machineryCalcuteFilterBadge` | Y | 703-812 | 110 | - |
| `getMatchFunctionTable` |  | 1519-1551 | 33 | - |
| `machineryIsMatchCondition` |  | 1554-1582 | 29 | `getMatchFunctionTable` |
| `machineryExistInSmartFilter` | Y | 1585-1608 | 24 | `machineryIsMatchCondition` |
| `semanticSearchController` |  | 1614-1614 | 1 | - |
| `machineryFilterDataPart1` |  | 1618-1925 | 308 | - |
| `machineryFilterDataPart2` |  | 1931-2165 | 235 | `getFilter`, `machineryColorFilter`, `machineryGrayColorFilter` |
| `machineryFilterDataPart3` |  | 2171-2487 | 317 | `imageSearchController`, `machinerySortData`, `semanticSearchController` |
| `machineryFilterData` | Y | 2490-2496 | 7 | `machineryFilterDataPart1`, `machineryFilterDataPart2`, `machineryFilterDataPart3` |
| `machineryCalcuteFilterResult` | Y | 2499-2517 | 19 | `machineryContentFilter`, `machineryFilterData` |
| `machineryContentFilter` | Y | 2612-2696 | 85 | `machineryExistInSmartFilter` |
| `calculateFilterCountsTimeout` |  | 3159-3159 | 1 | - |
| `machineryCalculateFilterCounts` | Y | 3160-3174 | 15 | `calculateFilterCountsTimeout`, `machineryUpdateFilterCounts` |
| `machinerySearchFilter` |  | 5981-6081 | 101 | `machineryConvertToRegexGroup`, `machineryMatchWithRegexGroup` |
| `machineryColorFilter` | Y | 6092-6183 | 92 | - |
| `machineryGrayColorFilter` | Y | 6186-6202 | 17 | - |
| `machineryFilterContent` | Y | 6207-6219 | 13 | `machineryCalls`, `machineryRebindRefresh` |
| `machineryUpdateFilterCounts` | Y | 7027-7128 | 102 | - |
| `FILTER_ID_MAP` |  | 8099-8119 | 21 | - |
| `machineryOpenFilter` | Y | 8121-8128 | 8 | `machineryUpdateContainerHieght` |
| `machineryToggleFilterByType` | Y | 8130-8147 | 18 | `FILTER_ID_MAP`, `machineryOpenFilter` |
| `machinerySearchInAll` | Y | 8219-8223 | 5 | `machineryFocusSeach`, `machineryOpenAll` |
| `machineryFocusSeach` | Y | 9285-9290 | 6 | - |
| `getToggleFilterByTypeFn` | Y | 9921-9921 | 1 | `machineryToggleFilterByType`, `scopeSingleton` |

### itemDomain（40 项 / 1520 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `calculateImageBindingTimeout` |  | 96-96 | 1 | - |
| `rebindRefreshLazyTimeout` |  | 100-100 | 1 | - |
| `prependImagesTimeout` |  | 102-102 | 1 | - |
| `machinerySortRawData` | Y | 310-408 | 99 | `getLanguageBCP` |
| `machineryCalculateImageBinding` | Y | 411-697 | 287 | `calculateImageBindingTimeout`, `getFilter`, `getTimeout`, `machineryGetExtendTags`, `machinerySortRawData` |
| `machineryFilterSidebarItem` | Y | 817-854 | 38 | - |
| `machineryRebindRefresh` | Y | 860-959 | 100 | `machineryCalcuteContainTags`, `machineryCalcuteFilterBadge`, `machineryCalcuteFilterResult`, `machineryCalls`, `machineryRefreshSubfolderList`, `machineryUpdateItemsView` |
| `machineryRebindRefreshLazy` | Y | 962-968 | 7 | `getTimeout`, `machineryRebindRefresh`, `rebindRefreshLazyTimeout` |
| `machineryUpdateItemsView` | Y | 1067-1074 | 8 | `machineryUpdateItemView` |
| `machineryResetImageData` |  | 1083-1089 | 7 | - |
| `machineryPrependImages` | Y | 1093-1106 | 14 | `machineryResetImageData`, `prependImagesTimeout` |
| `machineryReload` | Y | 1127-1172 | 46 | `machineryAdjustLayoutWidth`, `machineryAutoResizeTagFilter`, `machineryCalculateFilterCounts`, `machineryLeaveDetailMode`, `machineryRebindRefresh`, `machineryRelayout`, `machineryUpdateSelection`, `machineryUpdateSubFolderWidth` |
| `machineryUpdateItemView` | Y | 1230-1452 | 223 | `getFilter` |
| `imageSearchController` |  | 1613-1613 | 1 | - |
| `machineryCopyImages` | Y | 4644-4697 | 54 | `getFilter`, `machineryGetSelectedTags` |
| `machineryCreateTxtFileFromTemplate` | Y | 5553-5557 | 5 | `machineryNewFileFromTemplate` |
| `machineryGetItemByElement` | Y | 5766-5771 | 6 | - |
| `machineryNewFileFromTemplate` | Y | 6230-6266 | 37 | `machineryShowUploadQueue` |
| `checkListItemsLessThanContainerTimeout` |  | 6724-6724 | 1 | - |
| `machineryCheckListItemsLessThanContainer` | Y | 6729-6746 | 18 | `checkListItemsLessThanContainerTimeout` |
| `machineryScrollToCurrentItem` | Y | 6810-6822 | 13 | - |
| `machineryForceFitImageSize` | Y | 6826-6844 | 19 | - |
| `machinerySortData` | Y | 6869-6981 | 113 | - |
| `preloadImageTimeout` |  | 7166-7166 | 1 | - |
| `machineryPreloadImage` | Y | 7170-7200 | 31 | `machineryCurrentIndex`, `preloadImageTimeout` |
| `machineryToggleCommentMode` | Y | 7874-7878 | 5 | - |
| `machineryRemoveFromDuplicateMapping` | Y | 8229-8233 | 5 | - |
| `machineryEnlargeThumbnailsTimeout` |  | 8699-8699 | 1 | - |
| `machineryEnlargeThumbnails` | Y | 8700-8718 | 19 | `machineryEnlargeThumbnailsTimeout` |
| `machineryShrinkThumbnailsTimeout` |  | 8720-8720 | 1 | - |
| `machineryShrinkThumbnails` | Y | 8721-8738 | 18 | `machineryShrinkThumbnailsTimeout` |
| `machineryOnImageSizeHeightChanged` | Y | 8741-8751 | 11 | `machineryEnlargeThumbnails`, `machineryShrinkThumbnails`, `machineryUpdateListSlider`, `machineryUpdateSubFolderWidth` |
| `machineryChangeMetaItems` | Y | 8761-8768 | 8 | `machineryUpdateItemsView` |
| `addImageTimeLeftInterval` |  | 8776-8776 | 1 | - |
| `machineryCalcuteAddImageTimeLeft` |  | 8780-8795 | 16 | - |
| `machineryShowUploadQueue` | Y | 9030-9043 | 14 | `addImageTimeLeftInterval`, `machineryCalcuteAddImageTimeLeft` |
| `machineryHideUploadQueue` | Y | 9045-9052 | 8 | - |
| `machineryFindDupclipate` | Y | 9069-9232 | 164 | - |
| `machineryEnableImageNameEditable` | Y | 9364-9462 | 99 | - |
| `machineryRenameImages` | Y | 9567-9585 | 19 | `machineryEnableImageNameEditable` |

### libraryDomain（48 项 / 1494 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `updateSidebarListTimeout` |  | 99-99 | 1 | - |
| `machineryUpdateSidebarList` | Y | 973-1062 | 90 | `getTimeout`, `machineryFilterSidebarItem`, `machineryGetFolderList`, `machineryGetQuickAccessList`, `machineryGetSmartFolderList`, `updateSidebarListTimeout` |
| `machinerySmartFolderCount` | Y | 1208-1223 | 16 | `machineryExistInSmartFilter` |
| `buildRecentFileManager` |  | 2522-2608 | 87 | - |
| `machineryChangeSidebarIndex` | Y | 3096-3108 | 13 | `getTimeout` |
| `setLastFolderDebounced` |  | 3197-3197 | 1 | - |
| `machinerySetLastFolder` |  | 3198-3212 | 15 | `machinerySetViewMode`, `setLastFolderDebounced` |
| `lastMoveToTrashCheckbox` |  | 4348-4348 | 1 | - |
| `machineryOpenParentFolder` | Y | 5545-5549 | 5 | - |
| `machinerySetFolderCover` | Y | 5561-5575 | 15 | `getFilter` |
| `openUnfiledTimeout` |  | 6274-6274 | 1 | - |
| `openRecentTimeout` |  | 6276-6276 | 1 | - |
| `openTrashTimeout` |  | 6277-6277 | 1 | - |
| `machineryOpenUnfiled` | Y | 6328-6366 | 39 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `machinerySetLastFolder`, `machineryUpdateListHeight`, `openUnfiledTimeout` |
| `machineryOpenRecent` | Y | 6410-6448 | 39 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `machinerySetLastFolder`, `machineryUpdateListHeight`, `openRecentTimeout` |
| `machineryOpenTrash` | Y | 6506-6544 | 39 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `machinerySetLastFolder`, `machineryUpdateListHeight`, `openTrashTimeout` |
| `machineryOpenNextFolder` | Y | 6550-6563 | 14 | `machineryChangeSidebarIndex` |
| `machineryOpenPrevFolder` | Y | 6567-6600 | 34 | `machineryChangeSidebarIndex`, `machineryOpenTrash` |
| `machineryOpenNextSmartFolder` | Y | 6604-6625 | 22 | `machineryChangeSidebarIndex` |
| `machineryOpenPrevSmartFolder` | Y | 6629-6658 | 30 | `machineryChangeSidebarIndex`, `machineryOpenTrash` |
| `machineryGetQuickAccessList` | Y | 6712-6720 | 9 | - |
| `machineryAddToRecentFile` | Y | 7151-7163 | 13 | - |
| `machineryResetFolderCover` | Y | 7310-7317 | 8 | - |
| `machineryRemoveSmartFolder` | Y | 7353-7377 | 25 | `getFilter`, `machineryRemoveSmartFolderInner` |
| `machineryRemoveSmartFolderInner` |  | 7379-7462 | 84 | `getFilter`, `getTimeout`, `machineryOpenAll`, `machinerySaveFolderDebounce`, `machineryUpdateSidebarList` |
| `machineryRemoveFolder` | Y | 7466-7512 | 47 | `getFilter`, `machineryCheckOperationSafety2`, `machineryRemoveFolderInner` |
| `machineryRemoveFolderInner` |  | 7514-7664 | 151 | `getFilter`, `machineryCalculateImageBinding`, `machineryOpenAll`, `machineryRebindRefresh`, `machinerySaveFolderDebounce`, `machineryUpdateSidebarList` |
| `machineryRemoveFolderContents` | Y | 7745-7869 | 125 | `getFilter`, `getTimeout`, `machineryAutoScroll`, `machineryCalculateImageBinding`, `machineryForceFitImageSize`, `machineryGetSelectedItemElements`, `machineryGetSelection`, `machineryLeaveDetailMode` … |
| `machinerySaveFolderDebounce` | Y | 7897-7905 | 9 | - |
| `machineryMultipleOpenFolder` | Y | 8155-8196 | 42 | - |
| `machineryExpandFolder` | Y | 8202-8208 | 7 | `machineryUpdateSidebarList` |
| `machineryExpandSmartFolder` | Y | 8210-8216 | 7 | `machineryUpdateSidebarList` |
| `machineryToggleCurrentLevelSmartFoldersInner` | Y | 8240-8249 | 10 | `machineryUpdateSidebarList` |
| `machineryToggleAllSmartFoldersInner` | Y | 8251-8260 | 10 | `machineryUpdateSidebarList` |
| `machineryToggleCurrentLevelSmartFolders` | Y | 8272-8280 | 9 | `machineryToggleCurrentLevelSmartFoldersInner` |
| `machineryToggleAllSmartFolderExpand` | Y | 8282-8301 | 20 | `machineryChangeSidebarIndex`, `machineryToggleAllSmartFoldersInner`, `machineryUpdateSidebarList` |
| `machinerySetFolderOrder` | Y | 8305-8322 | 18 | - |
| `machinerySetSmartFolderOrder` | Y | 8324-8341 | 18 | - |
| `machineryQuickOpenFolder` | Y | 8356-8395 | 40 | `getTimeout`, `machineryAutoScroll`, `machineryChangeSidebarIndex`, `machineryOpenAll` |
| `machineryShowTutorial` | Y | 8406-8447 | 42 | `getFilter` |
| `machineryUnlockFolderWithTouchID` | Y | 8454-8496 | 43 | `machineryCalculateImageBinding`, `machineryUpdateSelection`, `machineryUpdateSidebarList` |
| `machineryGetSmartFolderList` | Y | 8503-8597 | 95 | - |
| `machineryGetFolderList` | Y | 8602-8687 | 86 | - |
| `machineryGetAllChildFolder` | Y | 9235-9243 | 9 | - |
| `machineryPrependFolder` | Y | 9297-9306 | 10 | `machineryCalculateImageBinding`, `machineryUpdateSidebarList` |
| `machineryRenameCurrentFolder` | Y | 9790-9862 | 73 | `getTimeout`, `machineryEditTag`, `machineryEnableSubFolderNameEditable`, `machineryGetSelectedTags`, `machineryRenameImages`, `machineryRenameTagGroup` |
| `machineryToggleAllFolders` | Y | 9885-9894 | 10 | `machineryUpdateSidebarList` |
| `machineryToggleCurrentLevelFolders` | Y | 9896-9905 | 10 | `machineryUpdateSidebarList` |

### selectionViewDomain（25 项 / 1111 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `updateSelectionTimeout` |  | 2810-2810 | 1 | - |
| `machineryUpdateSelection` | Y | 2812-3000 | 189 | `getFilter`, `getTimeout`, `machineryCalls`, `sortTagsForSelection`, `updateSelectionTimeout` |
| `sortTagsForSelection` |  | 3003-3036 | 34 | - |
| `machineryGetSelection` | Y | 3076-3093 | 18 | - |
| `cleanSelectedTimeout` |  | 4091-4091 | 1 | - |
| `machinerySelectAll` | Y | 4094-4114 | 21 | `cleanSelectedTimeout`, `getTimeout` |
| `machinerySelectNext` | Y | 4130-4187 | 58 | `getTimeout`, `machineryAddToRecentFile`, `machineryAutoScroll`, `machineryForceFitImageSize`, `machineryGetSelection`, `machineryLastZoom`, `machineryPreloadImage`, `machineryRememberScrollTops` … |
| `machinerySelectPrev` | Y | 4191-4257 | 67 | `getTimeout`, `machineryAddToRecentFile`, `machineryAutoScroll`, `machineryForceFitImageSize`, `machineryGetSelection`, `machineryLastZoom`, `machineryPreloadImage`, `machineryRememberScrollTops` … |
| `machineryMultipleSelectUp` | Y | 4262-4270 | 9 | `machineryMultipleSelectPrev` |
| `machineryMultipleSelectDown` | Y | 4273-4281 | 9 | `machineryMultipleSelectNext` |
| `machineryMultipleSelectNext` | Y | 4285-4312 | 28 | `machineryAutoScroll`, `machineryGetSelection` |
| `machineryMultipleSelectPrev` | Y | 4316-4343 | 28 | `machineryAutoScroll`, `machineryGetSelection` |
| `machineryRemoveSelected` | Y | 4355-4591 | 237 | `getFilter`, `getTimeout`, `lastMoveToTrashCheckbox`, `machineryAutoScroll`, `machineryCalculateImageBinding`, `machineryCheckOperationSafety`, `machineryCurrentIndex`, `machineryForceFitImageSize` … |
| `machinerySelectUp` | Y | 5294-5357 | 64 | `machineryAutoScroll`, `machineryForceFitImageSize`, `machineryGetItemByElement`, `machineryGetSelection`, `machineryLastZoom`, `machineryZoom` |
| `machinerySelectDown` | Y | 5359-5421 | 63 | `machineryAutoScroll`, `machineryForceFitImageSize`, `machineryGetArroundBox`, `machineryGetItemByElement`, `machineryGetSelection`, `machineryLastZoom`, `machineryZoom` |
| `machineryOpenInspectorTagSelectPanel` | Y | 5581-5584 | 4 | - |
| `machineryOpenInspectorFolderSelectPanel` | Y | 5596-5760 | 165 | `getFilter`, `machineryCalculateImageBinding`, `machineryCheckOperationSafety`, `machineryRebindRefresh`, `machineryUpdateFilterCounts`, `machineryUpdateSelection` |
| `machineryGetSelectedItems` | Y | 6679-6690 | 12 | - |
| `machineryGetSelectedItemElements` | Y | 6693-6703 | 11 | `machineryGetSelectedItems` |
| `machineryGetSelectedTags` | Y | 6706-6709 | 4 | - |
| `machineryRemoveSelectedFolders` | Y | 7668-7706 | 39 | `getFilter`, `machineryCheckOperationSafety2`, `machineryRemoveFolderInner` |
| `machineryRemoveSelectedSmartFolders` | Y | 7710-7737 | 28 | `getFilter`, `machineryRemoveSmartFolderInner` |
| `tagRectSelecting` |  | 7908-7908 | 1 | - |
| `machineryToggleSelectSmartFolder` | Y | 8265-8270 | 6 | `machineryToggleCurrentLevelSmartFoldersInner` |
| `machinerySelectFolder` | Y | 9344-9357 | 14 | `machineryUpdateSelection` |

### MOUNT-INFRA（最后一批/或留共享）（9 项 / 1025 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `timeoutCache` |  | 238-238 | 1 | - |
| `shimTimeoutInst` |  | 239-239 | 1 | - |
| `getTimeout` | Y | 241-275 | 35 | `shimTimeoutInst`, `timeoutCache` |
| `singletonByScope` |  | 9911-9911 | 1 | - |
| `scopeSingleton` |  | 9912-9917 | 6 | `singletonByScope` |
| `machineryCalls` | Y | 9926-9926 | 1 | - |
| `machinerySeedControllerState` | Y | 9931-10446 | 516 | - |
| `applied` |  | 10448-10448 | 1 | - |
| `applyDataMachineryScope` | Y | 10449-10911 | 463 | `applied`, `buildRecentFileManager`, `buildScrollbarSaver`, `getTimeout`, `machineryCalculateImageBinding`, `machineryCalcuteFilterResult`, `machineryCalls`, `machineryChangeStar` … |

### tagManagerDomain（21 项 / 817 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryGetExtendTags` | Y | 289-307 | 19 | - |
| `machineryAutoResizeTagFilter` |  | 1109-1121 | 13 | - |
| `machineryCalcuteContainTagsInner` |  | 2699-2760 | 62 | - |
| `machineryCalcuteContainTags` | Y | 2763-2804 | 42 | `machineryCalcuteContainTagsInner` |
| `machineryOpenPrevGroup` |  | 4906-4930 | 25 | `machineryOpenStarredGroup`, `machineryOpenTagAllGroup`, `machineryOpenTagGroup`, `machineryOpenUnfiledGroup` |
| `machineryOpenNextGroup` |  | 4932-4953 | 22 | `machineryOpenStarredGroup`, `machineryOpenTagGroup`, `machineryOpenUnfiledGroup` |
| `machineryConvertToRegexGroup` |  | 5847-5957 | 111 | - |
| `machineryMatchWithRegexGroup` |  | 5959-5979 | 21 | - |
| `openUntaggedTimeout` |  | 6275-6275 | 1 | - |
| `machineryOpenUntagged` | Y | 6369-6407 | 39 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `machinerySetLastFolder`, `machineryUpdateListHeight`, `openUntaggedTimeout` |
| `machineryOpenAllTags` | Y | 6479-6502 | 24 | `getTimeout`, `machineryRebindRefresh`, `machineryResetPage` |
| `machineryUpdateSubFolderWidth` | Y | 6750-6764 | 15 | - |
| `machineryOpenTagAllGroup` | Y | 7914-7928 | 15 | `tagRectSelecting` |
| `machineryOpenUnfiledGroup` | Y | 7930-7944 | 15 | `tagRectSelecting` |
| `machineryOpenStarredGroup` | Y | 7946-7960 | 15 | `tagRectSelecting` |
| `machineryOpenTagGroup` | Y | 7962-7978 | 17 | `tagRectSelecting` |
| `machineryRemoveTagGroup` | Y | 7982-8024 | 43 | `machineryOpenTagAllGroup` |
| `machineryRefreshSubfolderList` | Y | 9249-9282 | 34 | `machineryGetAllChildFolder` |
| `machineryEnableSubFolderNameEditable` | Y | 9467-9562 | 96 | `machinerySelectFolder` |
| `machineryRenameTagGroup` | Y | 9590-9605 | 16 | - |
| `machineryEditTag` | Y | 9612-9783 | 172 | `getFilter`, `machineryCalculateImageBinding`, `machineryRebindRefresh`, `machineryUpdateSelection` |

### core/keymap（20 项 / 627 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryBuildMousetrap` | Y | 3534-3672 | 139 | `getPageUpHandlerFn`, `machineryBack`, `machineryChangeTo1Star`, `machineryChangeTo2Star`, `machineryChangeTo3Star`, `machineryChangeTo4Star`, `machineryChangeTo5Star`, `machineryCopyImages` … |
| `machineryInitMousetrap` | Y | 3676-3697 | 22 | `machineryBuildMousetrap` |
| `machineryKeyCHandler` | Y | 4702-4707 | 6 | `machineryToggleCommentMode` |
| `machineryKeyPHandler` | Y | 4709-4711 | 3 | `machineryOpenPluginPanel` |
| `machineryKeyLeftHandler` | Y | 4716-4761 | 46 | `machinerySelectPrev`, `machineryUpdateSidebarList` |
| `machineryKeyRightHandler` | Y | 4765-4798 | 34 | `machinerySelectNext`, `machineryUpdateSidebarList` |
| `machineryModUpHandler` | Y | 4803-4815 | 13 | `machineryHomeHandler` |
| `machineryModDownHandler` | Y | 4817-4829 | 13 | `machineryEndHandler` |
| `machineryModLeftHandler` | Y | 4831-4845 | 15 | `machineryPrevHistory` |
| `machineryModRightHandler` | Y | 4847-4861 | 15 | `machineryNextHistory` |
| `machineryKeyUpHandler` | Y | 4961-5075 | 115 | `machineryOpenAll`, `machineryOpenAllTags`, `machineryOpenCommunity`, `machineryOpenPrevFolder`, `machineryOpenPrevGroup`, `machineryOpenPrevQuickAccess`, `machineryOpenPrevSmartFolder`, `machineryOpenRandom` … |
| `machineryKeyDownHandler` | Y | 5083-5216 | 134 | `machineryOpenAllTags`, `machineryOpenCommunity`, `machineryOpenNextFolder`, `machineryOpenNextGroup`, `machineryOpenNextQuickAccess`, `machineryOpenNextSmartFolder`, `machineryOpenRandom`, `machineryOpenRecent` … |
| `machineryPageDownHandler` | Y | 5256-5268 | 13 | `machineryScrollbarTo` |
| `machineryPageUpHandler` | Y | 5271-5288 | 18 | `machineryScrollbarTo` |
| `machineryNHandler` | Y | 5463-5474 | 12 | - |
| `machinerySaveHandler` | Y | 5532-5537 | 6 | - |
| `machineryHomeHandler` | Y | 7206-7215 | 10 | `machineryGotoTop` |
| `machineryEndHandler` | Y | 7219-7229 | 11 | `machineryGotoBottom` |
| `getPageUpHandlerFn` | Y | 9919-9919 | 1 | `machineryPageUpHandler`, `scopeSingleton` |
| `getPageDownHandlerFn` | Y | 9920-9920 | 1 | `machineryPageDownHandler`, `scopeSingleton` |

### miscDomain（21 项 / 419 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `getLanguageBCP` |  | 278-285 | 8 | - |
| `machineryToggleSlideshow` | Y | 1199-1205 | 7 | `machineryEnterSlideshowMode`, `machineryLeaveSlideshowMode` |
| `machineryCheckTouchIDSupport` | Y | 1457-1471 | 15 | - |
| `machineryEnterDetailMode` | Y | 3365-3459 | 95 | `getTimeout`, `machineryAddToRecentFile`, `machineryLastZoom`, `machineryPreloadImage`, `machineryZoom`, `zoomInitTimeout` |
| `machineryLeaveDetailMode` | Y | 3464-3521 | 58 | `getTimeout`, `machineryFadeOutDetailMode`, `machineryInitMousetrap`, `machineryRememberScrollTops`, `zoomInitTimeout` |
| `cgStack` |  | 3702-3702 | 1 | - |
| `cgScopes` |  | 3703-3703 | 1 | - |
| `CG_START_TOP` |  | 3704-3704 | 1 | - |
| `CG_SPACING` |  | 3705-3705 | 1 | - |
| `cgBuildTemplate` |  | 3710-3724 | 15 | - |
| `cgRestack` |  | 3727-3739 | 13 | `CG_SPACING`, `CG_START_TOP`, `cgStack` |
| `machineryNotify` | Y | 3745-3834 | 90 | `cgBuildTemplate`, `cgNotifyServiceCloseAll`, `cgRestack`, `cgStack`, `getFilter`, `getTimeout`, `undoTimeout` |
| `cgNotifyServiceCloseAll` |  | 3837-3841 | 5 | `cgStack` |
| `machineryToggleDetailMode` | Y | 4118-4120 | 3 | - |
| `machineryQuicklook` | Y | 4598-4640 | 43 | `getPageDownHandlerFn`, `machineryToggleDetailMode` |
| `machineryFadeOutDetailMode` | Y | 7881-7887 | 7 | - |
| `machineryOpenPluginPanel` | Y | 7890-7893 | 4 | - |
| `machineryEnterSlideshowMode` | Y | 8030-8047 | 18 | `getTimeout`, `machineryEnterDetailMode`, `machineryZoom` |
| `machineryLeaveSlideshowMode` | Y | 8050-8065 | 16 | `getTimeout`, `machineryZoom` |
| `machineryLockApp` | Y | 8070-8077 | 8 | `machineryFocusAppUnlockPassword` |
| `machineryFocusAppUnlockPassword` | Y | 8079-8088 | 10 | - |

### stage/grid（23 项 / 397 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machinerySwitchLayout` | Y | 1078-1080 | 3 | - |
| `machineryRelayout` | Y | 1475-1513 | 39 | - |
| `machinerySaveListHeight` | Y | 3059-3061 | 3 | - |
| `machineryAdjustLayoutWidth` | Y | 3064-3066 | 3 | - |
| `machineryResetPage` | Y | 3112-3155 | 44 | `machineryFindDupclipate` |
| `updateListHeightTimeout` |  | 3180-3180 | 1 | - |
| `machineryUpdateListHeight` | Y | 3215-3221 | 7 | `updateListHeightTimeout` |
| `buildScrollbarSaver` | Y | 3224-3302 | 79 | - |
| `machineryUpdateContainerHieght` | Y | 4018-4050 | 33 | - |
| `machineryGetArroundBox` | Y | 5221-5226 | 6 | - |
| `machineryScrollbarTo` |  | 5237-5252 | 16 | - |
| `machineryToggleAll` | Y | 5480-5519 | 40 | `getOffsetScrollbarFn`, `getTimeout`, `machineryRelayout`, `machineryZoomFitEdge` |
| `machineryAutoScroll` | Y | 6664-6669 | 6 | `getTimeout` |
| `machineryCurrentIndex` | Y | 6672-6675 | 4 | - |
| `changeListHeightTimeout` |  | 6725-6725 | 1 | - |
| `machineryChangeListHeight` | Y | 6770-6807 | 38 | `changeListHeightTimeout`, `machineryRelayout`, `machineryScrollToCurrentItem` |
| `machineryOffsetScrollbarImm` | Y | 6986-7013 | 28 | `machineryUpdateContainerHieght` |
| `machineryOffsetScrollbar` | Y | 7017-7022 | 6 | `machineryOffsetScrollbarImm` |
| `machineryRememberScrollTops` | Y | 7136-7145 | 10 | - |
| `machineryUpdateListSlider` | Y | 8692-8694 | 3 | - |
| `machineryGotoTop` | Y | 9311-9321 | 11 | - |
| `machineryGotoBottom` | Y | 9323-9337 | 15 | - |
| `getOffsetScrollbarFn` | Y | 9918-9918 | 1 | `machineryOffsetScrollbar`, `scopeSingleton` |

### services/viewOpsService（18 项 / 285 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryGetRatioExp` | Y | 1177-1182 | 6 | - |
| `machineryGetRatioNonExp` | Y | 1185-1190 | 6 | - |
| `machineryUpdateZoomRatio` | Y | 1194-1196 | 3 | - |
| `machineryZoom` | Y | 3039-3053 | 15 | `machinerySmartZoom`, `machineryZoomFit`, `machineryZoomFitEdge` |
| `machineryZoomFit` | Y | 3069-3071 | 3 | - |
| `setViewModeDebounced` |  | 3184-3184 | 1 | - |
| `machinerySetViewMode` | Y | 3185-3194 | 10 | `setViewModeDebounced` |
| `zoomInitTimeout` |  | 3359-3359 | 1 | - |
| `machineryLastZoom` | Y | 3846-3862 | 17 | `machineryGetRatioNonExp`, `machineryOnZoomRatioChanged` |
| `machinerySmartZoom` | Y | 3866-3868 | 3 | - |
| `machineryZoomActual` | Y | 3873-3912 | 40 | `machineryAdjustLayoutWidth`, `machineryChangeListHeight`, `machineryOnImageSizeHeightChanged`, `machineryOnZoomRatioChanged`, `machinerySaveListHeight`, `machineryUpdateZoomRatio` |
| `machineryToggleZoom` | Y | 3915-3945 | 31 | `machineryZoomActual`, `machineryZoomFit`, `machineryZoomFitEdge` |
| `machineryZoomFitEdge` | Y | 3948-4015 | 68 | `machineryGetRatioNonExp`, `machineryOnZoomRatioChanged` |
| `machineryZoomIn` | Y | 5523-5525 | 3 | - |
| `machineryZoomOut` | Y | 5527-5529 | 3 | - |
| `machineryCheckOperationSafety` | Y | 7235-7269 | 35 | `getFilter` |
| `machineryCheckOperationSafety2` | Y | 7272-7306 | 35 | `getFilter` |
| `machineryOnZoomRatioChanged` | Y | 8754-8758 | 5 | - |

### services/uploadService（1 项 / 219 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryOnDropContainer` | Y | 8806-9024 | 219 | `getFilter`, `machineryHideUploadQueue`, `machineryShowUploadQueue` |

### services/folderCoreService（5 项 / 115 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `openAllTimeout` |  | 3179-3179 | 1 | - |
| `machineryOpenAll` | Y | 3307-3354 | 48 | `getTimeout`, `machineryLeaveDetailMode`, `machineryOnImageSizeHeightChanged`, `machineryResetPage`, `machinerySetLastFolder`, `machineryUpdateListHeight`, `openAllTimeout` |
| `openRandomTimeout` |  | 6273-6273 | 1 | - |
| `machineryOpenRandom` | Y | 6283-6324 | 42 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `machinerySetLastFolder`, `openRandomTimeout` |
| `machineryOpenCommunity` | Y | 6452-6474 | 23 | `machineryLeaveDetailMode`, `machineryResetPage` |

### services/imageOpsService（7 项 / 86 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryChangeTo5Star` | Y | 5426-5429 | 4 | `machineryChangeStar` |
| `machineryRemoveStar` | Y | 5434-5436 | 3 | `machineryChangeStar` |
| `machineryChangeTo1Star` | Y | 5438-5441 | 4 | `machineryChangeStar` |
| `machineryChangeTo2Star` | Y | 5443-5446 | 4 | `machineryChangeStar` |
| `machineryChangeTo3Star` | Y | 5448-5451 | 4 | `machineryChangeStar` |
| `machineryChangeTo4Star` | Y | 5453-5456 | 4 | `machineryChangeStar` |
| `machineryChangeStar` | Y | 5777-5839 | 63 | `getFilter`, `machineryCheckOperationSafety`, `machineryUpdateItemsView` |

### core/navHistory（9 项 / 64 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `undoTimeout` |  | 3706-3706 | 1 | - |
| `machineryUndo` | Y | 4056-4060 | 5 | `cgNotifyServiceCloseAll` |
| `machineryNextHistory` | Y | 4064-4069 | 6 | - |
| `machineryPrevHistory` | Y | 4071-4076 | 6 | - |
| `machineryBack` | Y | 4079-4086 | 8 | `machineryLeaveDetailMode`, `machineryPrevHistory` |
| `nextTimeout` |  | 4125-4125 | 1 | - |
| `prevTimeout` |  | 4126-4126 | 1 | - |
| `machineryOpenPrevQuickAccess` |  | 4868-4879 | 12 | `machineryOpenTrash` |
| `machineryOpenNextQuickAccess` |  | 4881-4904 | 24 | - |

### services/batchOpsService（1 项 / 24 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryRemovePermanently` | Y | 7321-7344 | 24 | `machineryCalculateImageBinding`, `machineryGetSelectedItemElements`, `machineryRebindRefresh`, `machineryUpdateSelection` |

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
- `scopeSingleton`：core/keymap、filterDomain、stage/grid
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
| `./libraryDomain` | { machineryBatchRenameFolders, machineryBatchRenameSmartFolders, machineryGetAnc |

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

