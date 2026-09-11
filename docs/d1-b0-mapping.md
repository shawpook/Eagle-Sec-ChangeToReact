# D-1 / Track B / B-0：dataMachinery.ts 映射表（自动生成）

> 生成器：`tests-tmp/bz-d1-b0-map.py`（只读分析）。施工前请人工复核域归属。

## 0. 总量

- 文件：`src/app/react/core/dataMachinery.ts`，**10307 行**
- 顶层声明：**239**（exported **175** / 私有 **64**）
- import 面：**40** 条
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
| services/uploadService | 1 | 219 | 1 |
| services/folderCoreService | 5 | 115 | 3 |
| stage/grid | 4 | 91 | 4 |
| services/imageOpsService | 7 | 86 | 7 |
| core/navHistory | 9 | 64 | 4 |
| services/batchOpsService | 1 | 24 | 1 |
| services/viewOpsService | 1 | 1 | 0 |

### filterDomain（27 项 / 1701 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `filterCache` |  | 106-106 | 1 | - |
| `shimFilterInst` |  | 107-107 | 1 | - |
| `getFilter` | Y | 108-238 | 131 | `filterCache`, `shimFilterInst` |
| `machineryCalcuteFilterBadge` | Y | 705-814 | 110 | - |
| `getMatchFunctionTable` |  | 1462-1494 | 33 | - |
| `machineryIsMatchCondition` |  | 1497-1525 | 29 | `getMatchFunctionTable` |
| `machineryExistInSmartFilter` | Y | 1528-1551 | 24 | `machineryIsMatchCondition` |
| `semanticSearchController` |  | 1557-1557 | 1 | - |
| `machineryFilterDataPart1` |  | 1561-1868 | 308 | - |
| `machineryFilterDataPart2` |  | 1874-2108 | 235 | `getFilter`, `machineryColorFilter`, `machineryGrayColorFilter` |
| `machineryFilterDataPart3` |  | 2114-2430 | 317 | `imageSearchController`, `machinerySortData`, `semanticSearchController` |
| `machineryFilterData` | Y | 2433-2439 | 7 | `machineryFilterDataPart1`, `machineryFilterDataPart2`, `machineryFilterDataPart3` |
| `machineryCalcuteFilterResult` | Y | 2442-2460 | 19 | `machineryContentFilter`, `machineryFilterData` |
| `machineryContentFilter` | Y | 2555-2639 | 85 | `machineryExistInSmartFilter` |
| `calculateFilterCountsTimeout` |  | 3075-3075 | 1 | - |
| `machineryCalculateFilterCounts` | Y | 3076-3090 | 15 | `calculateFilterCountsTimeout`, `machineryUpdateFilterCounts` |
| `machinerySearchFilter` |  | 5571-5671 | 101 | `machineryConvertToRegexGroup`, `machineryMatchWithRegexGroup` |
| `machineryColorFilter` | Y | 5682-5773 | 92 | - |
| `machineryGrayColorFilter` | Y | 5776-5792 | 17 | - |
| `machineryFilterContent` | Y | 5797-5809 | 13 | `machineryCalls`, `machineryRebindRefresh` |
| `machineryUpdateFilterCounts` | Y | 6539-6640 | 102 | - |
| `FILTER_ID_MAP` |  | 7530-7550 | 21 | - |
| `machineryOpenFilter` | Y | 7552-7559 | 8 | - |
| `machineryToggleFilterByType` | Y | 7561-7578 | 18 | `FILTER_ID_MAP`, `machineryOpenFilter` |
| `machinerySearchInAll` | Y | 7650-7654 | 5 | `machineryFocusSeach`, `machineryOpenAll` |
| `machineryFocusSeach` | Y | 8706-8711 | 6 | - |
| `getToggleFilterByTypeFn` | Y | 9316-9316 | 1 | `machineryToggleFilterByType`, `scopeSingleton` |

### itemDomain（40 项 / 1520 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `calculateImageBindingTimeout` |  | 98-98 | 1 | - |
| `rebindRefreshLazyTimeout` |  | 102-102 | 1 | - |
| `prependImagesTimeout` |  | 104-104 | 1 | - |
| `machinerySortRawData` | Y | 312-410 | 99 | `getLanguageBCP` |
| `machineryCalculateImageBinding` | Y | 413-699 | 287 | `calculateImageBindingTimeout`, `getFilter`, `getTimeout`, `machineryGetExtendTags`, `machinerySortRawData` |
| `machineryFilterSidebarItem` | Y | 819-856 | 38 | - |
| `machineryRebindRefresh` | Y | 862-961 | 100 | `machineryCalcuteContainTags`, `machineryCalcuteFilterBadge`, `machineryCalcuteFilterResult`, `machineryCalls`, `machineryRefreshSubfolderList`, `machineryUpdateItemsView` |
| `machineryRebindRefreshLazy` | Y | 964-970 | 7 | `getTimeout`, `machineryRebindRefresh`, `rebindRefreshLazyTimeout` |
| `machineryUpdateItemsView` | Y | 1069-1076 | 8 | `machineryUpdateItemView` |
| `machineryResetImageData` |  | 1082-1088 | 7 | - |
| `machineryPrependImages` | Y | 1092-1105 | 14 | `machineryResetImageData`, `prependImagesTimeout` |
| `machineryReload` | Y | 1126-1171 | 46 | `machineryAutoResizeTagFilter`, `machineryCalculateFilterCounts`, `machineryLeaveDetailMode`, `machineryRebindRefresh`, `machineryUpdateSelection`, `machineryUpdateSubFolderWidth` |
| `machineryUpdateItemView` | Y | 1212-1434 | 223 | `getFilter` |
| `imageSearchController` |  | 1556-1556 | 1 | - |
| `machineryCopyImages` | Y | 4263-4316 | 54 | `getFilter`, `machineryGetSelectedTags` |
| `machineryCreateTxtFileFromTemplate` | Y | 5143-5147 | 5 | `machineryNewFileFromTemplate` |
| `machineryGetItemByElement` | Y | 5356-5361 | 6 | - |
| `machineryNewFileFromTemplate` | Y | 5820-5856 | 37 | `machineryShowUploadQueue` |
| `checkListItemsLessThanContainerTimeout` |  | 6309-6309 | 1 | - |
| `machineryCheckListItemsLessThanContainer` | Y | 6313-6330 | 18 | `checkListItemsLessThanContainerTimeout` |
| `machineryScrollToCurrentItem` | Y | 6356-6368 | 13 | - |
| `machineryForceFitImageSize` | Y | 6372-6390 | 19 | - |
| `machinerySortData` | Y | 6415-6527 | 113 | - |
| `preloadImageTimeout` |  | 6668-6668 | 1 | - |
| `machineryPreloadImage` | Y | 6672-6702 | 31 | `preloadImageTimeout` |
| `machineryToggleCommentMode` | Y | 7305-7309 | 5 | - |
| `machineryRemoveFromDuplicateMapping` | Y | 7660-7664 | 5 | - |
| `machineryEnlargeThumbnailsTimeout` |  | 8126-8126 | 1 | - |
| `machineryEnlargeThumbnails` | Y | 8127-8145 | 19 | `machineryEnlargeThumbnailsTimeout` |
| `machineryShrinkThumbnailsTimeout` |  | 8147-8147 | 1 | - |
| `machineryShrinkThumbnails` | Y | 8148-8165 | 18 | `machineryShrinkThumbnailsTimeout` |
| `machineryOnImageSizeHeightChanged` | Y | 8168-8178 | 11 | `machineryEnlargeThumbnails`, `machineryShrinkThumbnails`, `machineryUpdateSubFolderWidth` |
| `machineryChangeMetaItems` | Y | 8182-8189 | 8 | `machineryUpdateItemsView` |
| `addImageTimeLeftInterval` |  | 8197-8197 | 1 | - |
| `machineryCalcuteAddImageTimeLeft` |  | 8201-8216 | 16 | - |
| `machineryShowUploadQueue` | Y | 8451-8464 | 14 | `addImageTimeLeftInterval`, `machineryCalcuteAddImageTimeLeft` |
| `machineryHideUploadQueue` | Y | 8466-8473 | 8 | - |
| `machineryFindDupclipate` | Y | 8490-8653 | 164 | - |
| `machineryEnableImageNameEditable` | Y | 8759-8857 | 99 | - |
| `machineryRenameImages` | Y | 8962-8980 | 19 | `machineryEnableImageNameEditable` |

### libraryDomain（48 项 / 1494 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `updateSidebarListTimeout` |  | 101-101 | 1 | - |
| `machineryUpdateSidebarList` | Y | 975-1064 | 90 | `getTimeout`, `machineryFilterSidebarItem`, `machineryGetFolderList`, `machineryGetQuickAccessList`, `machineryGetSmartFolderList`, `updateSidebarListTimeout` |
| `machinerySmartFolderCount` | Y | 1190-1205 | 16 | `machineryExistInSmartFilter` |
| `buildRecentFileManager` |  | 2465-2551 | 87 | - |
| `machineryChangeSidebarIndex` | Y | 3012-3024 | 13 | `getTimeout` |
| `setLastFolderDebounced` |  | 3101-3101 | 1 | - |
| `machinerySetLastFolder` |  | 3102-3116 | 15 | `setLastFolderDebounced` |
| `lastMoveToTrashCheckbox` |  | 3967-3967 | 1 | - |
| `machineryOpenParentFolder` | Y | 5135-5139 | 5 | - |
| `machinerySetFolderCover` | Y | 5151-5165 | 15 | `getFilter` |
| `openUnfiledTimeout` |  | 5864-5864 | 1 | - |
| `openRecentTimeout` |  | 5866-5866 | 1 | - |
| `openTrashTimeout` |  | 5867-5867 | 1 | - |
| `machineryOpenUnfiled` | Y | 5918-5956 | 39 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `machinerySetLastFolder`, `openUnfiledTimeout` |
| `machineryOpenRecent` | Y | 6000-6038 | 39 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `machinerySetLastFolder`, `openRecentTimeout` |
| `machineryOpenTrash` | Y | 6096-6134 | 39 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `machinerySetLastFolder`, `openTrashTimeout` |
| `machineryOpenNextFolder` | Y | 6140-6153 | 14 | `machineryChangeSidebarIndex` |
| `machineryOpenPrevFolder` | Y | 6157-6190 | 34 | `machineryChangeSidebarIndex`, `machineryOpenTrash` |
| `machineryOpenNextSmartFolder` | Y | 6194-6215 | 22 | `machineryChangeSidebarIndex` |
| `machineryOpenPrevSmartFolder` | Y | 6219-6248 | 30 | `machineryChangeSidebarIndex`, `machineryOpenTrash` |
| `machineryGetQuickAccessList` | Y | 6297-6305 | 9 | - |
| `machineryAddToRecentFile` | Y | 6653-6665 | 13 | - |
| `machineryResetFolderCover` | Y | 6741-6748 | 8 | - |
| `machineryRemoveSmartFolder` | Y | 6784-6808 | 25 | `getFilter`, `machineryRemoveSmartFolderInner` |
| `machineryRemoveSmartFolderInner` |  | 6810-6893 | 84 | `getFilter`, `getTimeout`, `machineryOpenAll`, `machinerySaveFolderDebounce`, `machineryUpdateSidebarList` |
| `machineryRemoveFolder` | Y | 6897-6943 | 47 | `getFilter`, `machineryRemoveFolderInner` |
| `machineryRemoveFolderInner` |  | 6945-7095 | 151 | `getFilter`, `machineryCalculateImageBinding`, `machineryOpenAll`, `machineryRebindRefresh`, `machinerySaveFolderDebounce`, `machineryUpdateSidebarList` |
| `machineryRemoveFolderContents` | Y | 7176-7300 | 125 | `getFilter`, `getTimeout`, `machineryAutoScroll`, `machineryCalculateImageBinding`, `machineryForceFitImageSize`, `machineryGetSelectedItemElements`, `machineryGetSelection`, `machineryLeaveDetailMode` … |
| `machinerySaveFolderDebounce` | Y | 7328-7336 | 9 | - |
| `machineryMultipleOpenFolder` | Y | 7586-7627 | 42 | - |
| `machineryExpandFolder` | Y | 7633-7639 | 7 | `machineryUpdateSidebarList` |
| `machineryExpandSmartFolder` | Y | 7641-7647 | 7 | `machineryUpdateSidebarList` |
| `machineryToggleCurrentLevelSmartFoldersInner` | Y | 7671-7680 | 10 | `machineryUpdateSidebarList` |
| `machineryToggleAllSmartFoldersInner` | Y | 7682-7691 | 10 | `machineryUpdateSidebarList` |
| `machineryToggleCurrentLevelSmartFolders` | Y | 7703-7711 | 9 | `machineryToggleCurrentLevelSmartFoldersInner` |
| `machineryToggleAllSmartFolderExpand` | Y | 7713-7732 | 20 | `machineryChangeSidebarIndex`, `machineryToggleAllSmartFoldersInner`, `machineryUpdateSidebarList` |
| `machinerySetFolderOrder` | Y | 7736-7753 | 18 | - |
| `machinerySetSmartFolderOrder` | Y | 7755-7772 | 18 | - |
| `machineryQuickOpenFolder` | Y | 7787-7826 | 40 | `getTimeout`, `machineryAutoScroll`, `machineryChangeSidebarIndex`, `machineryOpenAll` |
| `machineryShowTutorial` | Y | 7837-7878 | 42 | `getFilter` |
| `machineryUnlockFolderWithTouchID` | Y | 7885-7927 | 43 | `machineryCalculateImageBinding`, `machineryUpdateSelection`, `machineryUpdateSidebarList` |
| `machineryGetSmartFolderList` | Y | 7934-8028 | 95 | - |
| `machineryGetFolderList` | Y | 8033-8118 | 86 | - |
| `machineryGetAllChildFolder` | Y | 8656-8664 | 9 | - |
| `machineryPrependFolder` | Y | 8718-8727 | 10 | `machineryCalculateImageBinding`, `machineryUpdateSidebarList` |
| `machineryRenameCurrentFolder` | Y | 9185-9257 | 73 | `getTimeout`, `machineryEditTag`, `machineryEnableSubFolderNameEditable`, `machineryGetSelectedTags`, `machineryRenameImages`, `machineryRenameTagGroup` |
| `machineryToggleAllFolders` | Y | 9280-9289 | 10 | `machineryUpdateSidebarList` |
| `machineryToggleCurrentLevelFolders` | Y | 9291-9300 | 10 | `machineryUpdateSidebarList` |

### selectionViewDomain（25 项 / 1111 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `updateSelectionTimeout` |  | 2753-2753 | 1 | - |
| `machineryUpdateSelection` | Y | 2755-2943 | 189 | `getFilter`, `getTimeout`, `machineryCalls`, `sortTagsForSelection`, `updateSelectionTimeout` |
| `sortTagsForSelection` |  | 2946-2979 | 34 | - |
| `machineryGetSelection` | Y | 2992-3009 | 18 | - |
| `cleanSelectedTimeout` |  | 3710-3710 | 1 | - |
| `machinerySelectAll` | Y | 3713-3733 | 21 | `cleanSelectedTimeout`, `getTimeout` |
| `machinerySelectNext` | Y | 3749-3806 | 58 | `getTimeout`, `machineryAddToRecentFile`, `machineryAutoScroll`, `machineryForceFitImageSize`, `machineryGetSelection`, `machineryPreloadImage`, `nextTimeout` |
| `machinerySelectPrev` | Y | 3810-3876 | 67 | `getTimeout`, `machineryAddToRecentFile`, `machineryAutoScroll`, `machineryForceFitImageSize`, `machineryGetSelection`, `machineryPreloadImage`, `prevTimeout` |
| `machineryMultipleSelectUp` | Y | 3881-3889 | 9 | `machineryMultipleSelectPrev` |
| `machineryMultipleSelectDown` | Y | 3892-3900 | 9 | `machineryMultipleSelectNext` |
| `machineryMultipleSelectNext` | Y | 3904-3931 | 28 | `machineryAutoScroll`, `machineryGetSelection` |
| `machineryMultipleSelectPrev` | Y | 3935-3962 | 28 | `machineryAutoScroll`, `machineryGetSelection` |
| `machineryRemoveSelected` | Y | 3974-4210 | 237 | `getFilter`, `getTimeout`, `lastMoveToTrashCheckbox`, `machineryAutoScroll`, `machineryCalculateImageBinding`, `machineryForceFitImageSize`, `machineryGetSelectedItemElements`, `machineryGetSelectedTags` … |
| `machinerySelectUp` | Y | 4890-4953 | 64 | `machineryAutoScroll`, `machineryForceFitImageSize`, `machineryGetItemByElement`, `machineryGetSelection` |
| `machinerySelectDown` | Y | 4955-5017 | 63 | `machineryAutoScroll`, `machineryForceFitImageSize`, `machineryGetItemByElement`, `machineryGetSelection` |
| `machineryOpenInspectorTagSelectPanel` | Y | 5171-5174 | 4 | - |
| `machineryOpenInspectorFolderSelectPanel` | Y | 5186-5350 | 165 | `getFilter`, `machineryCalculateImageBinding`, `machineryRebindRefresh`, `machineryUpdateFilterCounts`, `machineryUpdateSelection` |
| `machineryGetSelectedItems` | Y | 6264-6275 | 12 | - |
| `machineryGetSelectedItemElements` | Y | 6278-6288 | 11 | `machineryGetSelectedItems` |
| `machineryGetSelectedTags` | Y | 6291-6294 | 4 | - |
| `machineryRemoveSelectedFolders` | Y | 7099-7137 | 39 | `getFilter`, `machineryRemoveFolderInner` |
| `machineryRemoveSelectedSmartFolders` | Y | 7141-7168 | 28 | `getFilter`, `machineryRemoveSmartFolderInner` |
| `tagRectSelecting` |  | 7339-7339 | 1 | - |
| `machineryToggleSelectSmartFolder` | Y | 7696-7701 | 6 | `machineryToggleCurrentLevelSmartFoldersInner` |
| `machinerySelectFolder` | Y | 8739-8752 | 14 | `machineryUpdateSelection` |

### MOUNT-INFRA（最后一批/或留共享）（9 项 / 1025 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `timeoutCache` |  | 240-240 | 1 | - |
| `shimTimeoutInst` |  | 241-241 | 1 | - |
| `getTimeout` | Y | 243-277 | 35 | `shimTimeoutInst`, `timeoutCache` |
| `singletonByScope` |  | 9306-9306 | 1 | - |
| `scopeSingleton` |  | 9307-9312 | 6 | `singletonByScope` |
| `machineryCalls` | Y | 9321-9321 | 1 | - |
| `machinerySeedControllerState` | Y | 9326-9841 | 516 | - |
| `applied` |  | 9843-9843 | 1 | - |
| `applyDataMachineryScope` | Y | 9844-10306 | 463 | `applied`, `buildRecentFileManager`, `getTimeout`, `machineryCalculateImageBinding`, `machineryCalcuteFilterResult`, `machineryCalls`, `machineryChangeStar`, `machineryColorFilter` … |

### tagManagerDomain（21 项 / 817 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryGetExtendTags` | Y | 291-309 | 19 | - |
| `machineryAutoResizeTagFilter` |  | 1108-1120 | 13 | - |
| `machineryCalcuteContainTagsInner` |  | 2642-2703 | 62 | - |
| `machineryCalcuteContainTags` | Y | 2706-2747 | 42 | `machineryCalcuteContainTagsInner` |
| `machineryOpenPrevGroup` |  | 4525-4549 | 25 | `machineryOpenStarredGroup`, `machineryOpenTagAllGroup`, `machineryOpenTagGroup`, `machineryOpenUnfiledGroup` |
| `machineryOpenNextGroup` |  | 4551-4572 | 22 | `machineryOpenStarredGroup`, `machineryOpenTagGroup`, `machineryOpenUnfiledGroup` |
| `machineryConvertToRegexGroup` |  | 5437-5547 | 111 | - |
| `machineryMatchWithRegexGroup` |  | 5549-5569 | 21 | - |
| `openUntaggedTimeout` |  | 5865-5865 | 1 | - |
| `machineryOpenUntagged` | Y | 5959-5997 | 39 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `machinerySetLastFolder`, `openUntaggedTimeout` |
| `machineryOpenAllTags` | Y | 6069-6092 | 24 | `getTimeout`, `machineryRebindRefresh`, `machineryResetPage` |
| `machineryUpdateSubFolderWidth` | Y | 6334-6348 | 15 | - |
| `machineryOpenTagAllGroup` | Y | 7345-7359 | 15 | `tagRectSelecting` |
| `machineryOpenUnfiledGroup` | Y | 7361-7375 | 15 | `tagRectSelecting` |
| `machineryOpenStarredGroup` | Y | 7377-7391 | 15 | `tagRectSelecting` |
| `machineryOpenTagGroup` | Y | 7393-7409 | 17 | `tagRectSelecting` |
| `machineryRemoveTagGroup` | Y | 7413-7455 | 43 | `machineryOpenTagAllGroup` |
| `machineryRefreshSubfolderList` | Y | 8670-8703 | 34 | `machineryGetAllChildFolder` |
| `machineryEnableSubFolderNameEditable` | Y | 8862-8957 | 96 | `machinerySelectFolder` |
| `machineryRenameTagGroup` | Y | 8985-9000 | 16 | - |
| `machineryEditTag` | Y | 9007-9178 | 172 | `getFilter`, `machineryCalculateImageBinding`, `machineryRebindRefresh`, `machineryUpdateSelection` |

### core/keymap（20 项 / 627 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryBuildMousetrap` | Y | 3350-3488 | 139 | `getPageUpHandlerFn`, `machineryBack`, `machineryChangeTo1Star`, `machineryChangeTo2Star`, `machineryChangeTo3Star`, `machineryChangeTo4Star`, `machineryChangeTo5Star`, `machineryCopyImages` … |
| `machineryInitMousetrap` | Y | 3492-3513 | 22 | `machineryBuildMousetrap` |
| `machineryKeyCHandler` | Y | 4321-4326 | 6 | `machineryToggleCommentMode` |
| `machineryKeyPHandler` | Y | 4328-4330 | 3 | `machineryOpenPluginPanel` |
| `machineryKeyLeftHandler` | Y | 4335-4380 | 46 | `machinerySelectPrev`, `machineryUpdateSidebarList` |
| `machineryKeyRightHandler` | Y | 4384-4417 | 34 | `machinerySelectNext`, `machineryUpdateSidebarList` |
| `machineryModUpHandler` | Y | 4422-4434 | 13 | `machineryHomeHandler` |
| `machineryModDownHandler` | Y | 4436-4448 | 13 | `machineryEndHandler` |
| `machineryModLeftHandler` | Y | 4450-4464 | 15 | `machineryPrevHistory` |
| `machineryModRightHandler` | Y | 4466-4480 | 15 | `machineryNextHistory` |
| `machineryKeyUpHandler` | Y | 4580-4694 | 115 | `machineryOpenAll`, `machineryOpenAllTags`, `machineryOpenCommunity`, `machineryOpenPrevFolder`, `machineryOpenPrevGroup`, `machineryOpenPrevQuickAccess`, `machineryOpenPrevSmartFolder`, `machineryOpenRandom` … |
| `machineryKeyDownHandler` | Y | 4702-4835 | 134 | `machineryOpenAllTags`, `machineryOpenCommunity`, `machineryOpenNextFolder`, `machineryOpenNextGroup`, `machineryOpenNextQuickAccess`, `machineryOpenNextSmartFolder`, `machineryOpenRandom`, `machineryOpenRecent` … |
| `machineryPageDownHandler` | Y | 4852-4864 | 13 | - |
| `machineryPageUpHandler` | Y | 4867-4884 | 18 | - |
| `machineryNHandler` | Y | 5059-5070 | 12 | - |
| `machinerySaveHandler` | Y | 5122-5127 | 6 | - |
| `machineryHomeHandler` | Y | 6708-6717 | 10 | - |
| `machineryEndHandler` | Y | 6721-6731 | 11 | - |
| `getPageUpHandlerFn` | Y | 9314-9314 | 1 | `machineryPageUpHandler`, `scopeSingleton` |
| `getPageDownHandlerFn` | Y | 9315-9315 | 1 | `machineryPageDownHandler`, `scopeSingleton` |

### miscDomain（21 项 / 419 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `getLanguageBCP` |  | 280-287 | 8 | - |
| `machineryToggleSlideshow` | Y | 1181-1187 | 7 | `machineryEnterSlideshowMode`, `machineryLeaveSlideshowMode` |
| `machineryCheckTouchIDSupport` | Y | 1439-1453 | 15 | - |
| `machineryEnterDetailMode` | Y | 3181-3275 | 95 | `getTimeout`, `machineryAddToRecentFile`, `machineryPreloadImage`, `zoomInitTimeout` |
| `machineryLeaveDetailMode` | Y | 3280-3337 | 58 | `getTimeout`, `machineryFadeOutDetailMode`, `machineryInitMousetrap`, `zoomInitTimeout` |
| `cgStack` |  | 3518-3518 | 1 | - |
| `cgScopes` |  | 3519-3519 | 1 | - |
| `CG_START_TOP` |  | 3520-3520 | 1 | - |
| `CG_SPACING` |  | 3521-3521 | 1 | - |
| `cgBuildTemplate` |  | 3526-3540 | 15 | - |
| `cgRestack` |  | 3543-3555 | 13 | `CG_SPACING`, `CG_START_TOP`, `cgStack` |
| `machineryNotify` | Y | 3561-3650 | 90 | `cgBuildTemplate`, `cgNotifyServiceCloseAll`, `cgRestack`, `cgStack`, `getFilter`, `getTimeout`, `undoTimeout` |
| `cgNotifyServiceCloseAll` |  | 3653-3657 | 5 | `cgStack` |
| `machineryToggleDetailMode` | Y | 3737-3739 | 3 | - |
| `machineryQuicklook` | Y | 4217-4259 | 43 | `getPageDownHandlerFn`, `machineryToggleDetailMode` |
| `machineryFadeOutDetailMode` | Y | 7312-7318 | 7 | - |
| `machineryOpenPluginPanel` | Y | 7321-7324 | 4 | - |
| `machineryEnterSlideshowMode` | Y | 7461-7478 | 18 | `getTimeout`, `machineryEnterDetailMode` |
| `machineryLeaveSlideshowMode` | Y | 7481-7496 | 16 | `getTimeout` |
| `machineryLockApp` | Y | 7501-7508 | 8 | `machineryFocusAppUnlockPassword` |
| `machineryFocusAppUnlockPassword` | Y | 7510-7519 | 10 | - |

### services/uploadService（1 项 / 219 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryOnDropContainer` | Y | 8227-8445 | 219 | `getFilter`, `machineryHideUploadQueue`, `machineryShowUploadQueue` |

### services/folderCoreService（5 项 / 115 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `openAllTimeout` |  | 3095-3095 | 1 | - |
| `machineryOpenAll` | Y | 3123-3170 | 48 | `getTimeout`, `machineryLeaveDetailMode`, `machineryOnImageSizeHeightChanged`, `machineryResetPage`, `machinerySetLastFolder`, `openAllTimeout` |
| `openRandomTimeout` |  | 5863-5863 | 1 | - |
| `machineryOpenRandom` | Y | 5873-5914 | 42 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `machinerySetLastFolder`, `openRandomTimeout` |
| `machineryOpenCommunity` | Y | 6042-6064 | 23 | `machineryLeaveDetailMode`, `machineryResetPage` |

### stage/grid（4 项 / 91 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryResetPage` | Y | 3028-3071 | 44 | `machineryFindDupclipate` |
| `machineryToggleAll` | Y | 5076-5115 | 40 | `getOffsetScrollbarFn`, `getTimeout` |
| `machineryAutoScroll` | Y | 6254-6259 | 6 | `getTimeout` |
| `getOffsetScrollbarFn` | Y | 9313-9313 | 1 | `scopeSingleton` |

### services/imageOpsService（7 项 / 86 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryChangeTo5Star` | Y | 5022-5025 | 4 | `machineryChangeStar` |
| `machineryRemoveStar` | Y | 5030-5032 | 3 | `machineryChangeStar` |
| `machineryChangeTo1Star` | Y | 5034-5037 | 4 | `machineryChangeStar` |
| `machineryChangeTo2Star` | Y | 5039-5042 | 4 | `machineryChangeStar` |
| `machineryChangeTo3Star` | Y | 5044-5047 | 4 | `machineryChangeStar` |
| `machineryChangeTo4Star` | Y | 5049-5052 | 4 | `machineryChangeStar` |
| `machineryChangeStar` | Y | 5367-5429 | 63 | `getFilter`, `machineryUpdateItemsView` |

### core/navHistory（9 项 / 64 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `undoTimeout` |  | 3522-3522 | 1 | - |
| `machineryUndo` | Y | 3675-3679 | 5 | `cgNotifyServiceCloseAll` |
| `machineryNextHistory` | Y | 3683-3688 | 6 | - |
| `machineryPrevHistory` | Y | 3690-3695 | 6 | - |
| `machineryBack` | Y | 3698-3705 | 8 | `machineryLeaveDetailMode`, `machineryPrevHistory` |
| `nextTimeout` |  | 3744-3744 | 1 | - |
| `prevTimeout` |  | 3745-3745 | 1 | - |
| `machineryOpenPrevQuickAccess` |  | 4487-4498 | 12 | `machineryOpenTrash` |
| `machineryOpenNextQuickAccess` |  | 4500-4523 | 24 | - |

### services/batchOpsService（1 项 / 24 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryRemovePermanently` | Y | 6752-6775 | 24 | `machineryCalculateImageBinding`, `machineryGetSelectedItemElements`, `machineryRebindRefresh`, `machineryUpdateSelection` |

### services/viewOpsService（1 项 / 1 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `zoomInitTimeout` |  | 3175-3175 | 1 | - |

## 2. 跨域共享顶层名（≥2 域引用 —— 最后搬或抽共享模块）

- `getFilter`：filterDomain、itemDomain、libraryDomain、miscDomain、selectionViewDomain、services/imageOpsService、services/uploadService、tagManagerDomain
- `getTimeout`：MOUNT-INFRA（最后一批/或留共享）、itemDomain、libraryDomain、miscDomain、selectionViewDomain、services/folderCoreService、stage/grid、tagManagerDomain
- `machineryRebindRefresh`：MOUNT-INFRA（最后一批/或留共享）、filterDomain、itemDomain、libraryDomain、selectionViewDomain、services/batchOpsService、tagManagerDomain
- `machineryLeaveDetailMode`：MOUNT-INFRA（最后一批/或留共享）、core/navHistory、itemDomain、libraryDomain、selectionViewDomain、services/folderCoreService、tagManagerDomain
- `machineryUpdateSelection`：MOUNT-INFRA（最后一批/或留共享）、itemDomain、libraryDomain、selectionViewDomain、services/batchOpsService、tagManagerDomain
- `machineryCalculateImageBinding`：MOUNT-INFRA（最后一批/或留共享）、libraryDomain、selectionViewDomain、services/batchOpsService、tagManagerDomain
- `machineryCalls`：MOUNT-INFRA（最后一批/或留共享）、filterDomain、itemDomain、selectionViewDomain
- `machineryUpdateItemsView`：MOUNT-INFRA（最后一批/或留共享）、itemDomain、services/imageOpsService
- `machineryExistInSmartFilter`：MOUNT-INFRA（最后一批/或留共享）、filterDomain、libraryDomain
- `machineryUpdateFilterCounts`：filterDomain、libraryDomain、selectionViewDomain
- `machineryResetPage`：libraryDomain、services/folderCoreService、tagManagerDomain
- `machinerySetLastFolder`：libraryDomain、services/folderCoreService、tagManagerDomain
- `machineryGetSelectedItemElements`：libraryDomain、selectionViewDomain、services/batchOpsService
- `machineryGetSelectedTags`：itemDomain、libraryDomain、selectionViewDomain
- `machineryUpdateSidebarList`：MOUNT-INFRA（最后一批/或留共享）、core/keymap、libraryDomain
- `machineryOpenTrash`：core/keymap、core/navHistory、libraryDomain
- `machineryOpenAll`：core/keymap、filterDomain、libraryDomain
- `scopeSingleton`：core/keymap、filterDomain、stage/grid
- `machinerySortRawData`：MOUNT-INFRA（最后一批/或留共享）、itemDomain
- `machineryCalcuteFilterResult`：MOUNT-INFRA（最后一批/或留共享）、itemDomain
- `machineryColorFilter`：MOUNT-INFRA（最后一批/或留共享）、filterDomain
- `machineryGrayColorFilter`：MOUNT-INFRA（最后一批/或留共享）、filterDomain
- `machineryContentFilter`：MOUNT-INFRA（最后一批/或留共享）、filterDomain
- `machineryFilterData`：MOUNT-INFRA（最后一批/或留共享）、filterDomain
- `machineryAddToRecentFile`：miscDomain、selectionViewDomain
- `machineryPreloadImage`：miscDomain、selectionViewDomain
- `machineryInitMousetrap`：MOUNT-INFRA（最后一批/或留共享）、miscDomain
- `machineryMultipleSelectNext`：core/keymap、selectionViewDomain
- `machineryMultipleSelectPrev`：core/keymap、selectionViewDomain
- `machineryPrevHistory`：core/keymap、core/navHistory
- `machineryRemoveSelected`：MOUNT-INFRA（最后一批/或留共享）、core/keymap
- `machineryToggleAll`：MOUNT-INFRA（最后一批/或留共享）、core/keymap
- `machineryToggleDetailMode`：core/keymap、miscDomain
- `cgNotifyServiceCloseAll`：core/navHistory、miscDomain
- `machineryAutoScroll`：libraryDomain、selectionViewDomain
- `machineryForceFitImageSize`：libraryDomain、selectionViewDomain
- `machineryGetSelection`：libraryDomain、selectionViewDomain
- `machinerySelectPrev`：MOUNT-INFRA（最后一批/或留共享）、core/keymap
- `machinerySelectNext`：MOUNT-INFRA（最后一批/或留共享）、core/keymap
- `machineryChangeStar`：MOUNT-INFRA（最后一批/或留共享）、services/imageOpsService
- `machineryShowUploadQueue`：itemDomain、services/uploadService
- `machineryRemoveSmartFolderInner`：libraryDomain、selectionViewDomain
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
| `../services/gridService` | { buildScrollbarSaver, machineryAdjustLayoutWidth, machineryChangeListHeight, ma |
| `../services/viewOpsService` | { machineryCheckOperationSafety, machineryCheckOperationSafety2, machineryGetRat |

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

