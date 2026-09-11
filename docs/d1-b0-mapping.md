# D-1 / Track B / B-0：dataMachinery.ts 映射表（自动生成）

> 生成器：`tests-tmp/bz-d1-b0-map.py`（只读分析）。施工前请人工复核域归属。

## 0. 总量

- 文件：`src/app/react/core/dataMachinery.ts`，**11679 行**
- 顶层声明：**331**（exported **255** / 私有 **76**）
- import 面：**36** 条
- 引用文件：**30**（`from .../dataMachinery`）

## 1. 域聚类（批次候选）

| 目标域 | 声明数 | 行数（含私有依赖） | 导出数 |
|---|---:|---:|---:|
| libraryDomain | 67 | 1931 | 57 |
| filterDomain | 27 | 1701 | 16 |
| itemDomain | 47 | 1616 | 36 |
| selectionViewDomain | 25 | 1111 | 21 |
| MOUNT-INFRA（最后一批/或留共享） | 9 | 1009 | 4 |
| tagManagerDomain | 21 | 817 | 14 |
| core/keymap | 29 | 703 | 29 |
| miscDomain | 22 | 426 | 14 |
| stage/grid | 25 | 426 | 22 |
| services/viewOpsService | 18 | 285 | 16 |
| services/uploadService | 1 | 219 | 1 |
| services/folderCoreService | 6 | 132 | 4 |
| services/imageOpsService | 8 | 90 | 8 |
| core/navHistory | 9 | 64 | 4 |
| services/mediaService | 7 | 49 | 7 |
| utils（跨域纯函数） | 9 | 39 | 1 |
| services/batchOpsService | 1 | 24 | 1 |

### libraryDomain（67 项 / 1931 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `updateSidebarListTimeout` |  | 99-99 | 1 | - |
| `machineryGetAncestorFolders` | Y | 288-305 | 18 | - |
| `machineryUpdateSidebarList` | Y | 992-1081 | 90 | `getTimeout`, `machineryFilterSidebarItem`, `machineryGetFolderList`, `machineryGetQuickAccessList`, `machineryGetSmartFolderList`, `updateSidebarListTimeout` |
| `machinerySmartFolderCount` | Y | 1227-1242 | 16 | `machineryExistInSmartFilter` |
| `machineryGetRecentFolders` | Y | 1245-1267 | 23 | - |
| `buildRecentFileManager` |  | 2565-2651 | 87 | - |
| `machineryChangeSidebarIndex` | Y | 3139-3151 | 13 | `getTimeout` |
| `setLastFolderDebounced` |  | 3240-3240 | 1 | - |
| `machinerySetLastFolder` |  | 3241-3255 | 15 | `machinerySetViewMode`, `setLastFolderDebounced` |
| `machinerySaveFolder` | Y | 3571-3659 | 89 | - |
| `lastMoveToTrashCheckbox` |  | 4491-4491 | 1 | - |
| `machineryOpenParentFolder` | Y | 5772-5776 | 5 | - |
| `machinerySetFolderCover` | Y | 5788-5802 | 15 | `getFilter`, `machinerySaveFolder` |
| `openUnfiledTimeout` |  | 6558-6558 | 1 | - |
| `openRecentTimeout` |  | 6560-6560 | 1 | - |
| `openTrashTimeout` |  | 6561-6561 | 1 | - |
| `machineryOpenUnfiled` | Y | 6612-6650 | 39 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `machinerySetLastFolder`, `machineryUpdateListHeight`, `openUnfiledTimeout` |
| `machineryOpenRecent` | Y | 6694-6732 | 39 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `machinerySetLastFolder`, `machineryUpdateListHeight`, `openRecentTimeout` |
| `machineryOpenTrash` | Y | 6790-6828 | 39 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `machinerySetLastFolder`, `machineryUpdateListHeight`, `openTrashTimeout` |
| `machineryOpenNextFolder` | Y | 6834-6847 | 14 | `machineryChangeSidebarIndex` |
| `machineryOpenPrevFolder` | Y | 6851-6884 | 34 | `machineryChangeSidebarIndex`, `machineryOpenTrash` |
| `machineryOpenNextSmartFolder` | Y | 6888-6909 | 22 | `machineryChangeSidebarIndex` |
| `machineryOpenPrevSmartFolder` | Y | 6913-6942 | 30 | `machineryChangeSidebarIndex`, `machineryOpenTrash` |
| `machineryGetQuickAccessList` | Y | 6996-7004 | 9 | - |
| `machineryAddToRecentFile` | Y | 7464-7476 | 13 | - |
| `machineryResetFolderCover` | Y | 7623-7630 | 8 | `machineryGetAncestorFolders` |
| `machineryRemoveSmartFolder` | Y | 7666-7690 | 25 | `getFilter`, `machineryRemoveSmartFolderInner` |
| `machineryRemoveSmartFolderInner` |  | 7692-7775 | 84 | `getFilter`, `getTimeout`, `machineryOpenAll`, `machinerySaveFolderDebounce`, `machineryUpdateSidebarList` |
| `machineryRemoveFolder` | Y | 7779-7825 | 47 | `getFilter`, `machineryCheckOperationSafety2`, `machineryRemoveFolderInner` |
| `machineryRemoveFolderInner` |  | 7827-7977 | 151 | `getFilter`, `machineryCalculateImageBinding`, `machineryOpenAll`, `machineryRebindRefresh`, `machinerySaveFolderDebounce`, `machineryUpdateSidebarList` |
| `machineryRemoveFolderContents` | Y | 8058-8182 | 125 | `getFilter`, `getTimeout`, `machineryAutoScroll`, `machineryCalculateImageBinding`, `machineryForceFitImageSize`, `machineryGetSelectedItemElements`, `machineryGetSelection`, `machineryLeaveDetailMode` … |
| `machinerySaveFolderDebounce` | Y | 8210-8218 | 9 | `machinerySaveFolder` |
| `machineryGetChildFoldersMaps` | Y | 8499-8509 | 11 | - |
| `machineryGetChildFoldersMap` | Y | 8511-8518 | 8 | - |
| `machineryMultipleOpenFolder` | Y | 8522-8563 | 42 | `machineryGetChildFoldersMaps` |
| `machineryExpandFolder` | Y | 8569-8575 | 7 | `machineryUpdateSidebarList` |
| `machineryExpandSmartFolder` | Y | 8577-8583 | 7 | `machineryUpdateSidebarList` |
| `machineryToggleCurrentLevelSmartFoldersInner` | Y | 8650-8659 | 10 | `machineryUpdateSidebarList` |
| `machineryToggleAllSmartFoldersInner` | Y | 8661-8670 | 10 | `machineryUpdateSidebarList` |
| `machineryToggleCurrentLevelSmartFolders` | Y | 8682-8690 | 9 | `machineryToggleCurrentLevelSmartFoldersInner` |
| `machineryToggleAllSmartFolderExpand` | Y | 8692-8711 | 20 | `machineryChangeSidebarIndex`, `machineryToggleAllSmartFoldersInner`, `machineryUpdateSidebarList` |
| `machinerySetFolderOrder` | Y | 8715-8732 | 18 | `machinerySaveFolder` |
| `machinerySetSmartFolderOrder` | Y | 8734-8751 | 18 | `machinerySaveFolder` |
| `machineryOpenPinterest` | Y | 8773-8786 | 14 | - |
| `machineryOpenHuaban` | Y | 8788-8791 | 4 | - |
| `machineryOpenArtstation` | Y | 8793-8795 | 3 | - |
| `machineryQuickOpenFolder` | Y | 8800-8839 | 40 | `getTimeout`, `machineryAutoScroll`, `machineryChangeSidebarIndex`, `machineryOpenAll` |
| `machineryMultipleOpenSmartFolder` | Y | 8843-8882 | 40 | - |
| `machineryRenameFolder` | Y | 8886-8904 | 19 | - |
| `machineryRenameSmartFolder` | Y | 8906-8922 | 17 | - |
| `machineryShowTutorial` | Y | 8926-8967 | 42 | `getFilter` |
| `machineryUnlockFolderWithTouchID` | Y | 8982-9024 | 43 | `machineryCalculateImageBinding`, `machineryUpdateSelection`, `machineryUpdateSidebarList` |
| `machineryGetSmartFolderList` | Y | 9031-9125 | 95 | - |
| `machineryGetFolderList` | Y | 9130-9215 | 86 | - |
| `machineryMoveToFolders` | Y | 9302-9302 | 1 | - |
| `machineryImportLinks` | Y | 9586-9684 | 99 | - |
| `machineryGetAllChildFolder` | Y | 9893-9901 | 9 | - |
| `machineryNewSmartFolder` | Y | 9952-9954 | 3 | - |
| `machineryPrependFolder` | Y | 9958-9967 | 10 | `machineryCalculateImageBinding`, `machinerySaveFolder`, `machineryUpdateSidebarList` |
| `machineryBatchRenameFolders` | Y | 10268-10276 | 9 | - |
| `machineryBatchRenameSmartFolders` | Y | 10278-10286 | 9 | - |
| `machineryRenameCurrentFolder` | Y | 10489-10561 | 73 | `getTimeout`, `machineryBatchRenameFolders`, `machineryBatchRenameSmartFolders`, `machineryEditTag`, `machineryEnableSubFolderNameEditable`, `machineryGetSelectedTags`, `machineryRenameFolder`, `machineryRenameImages` … |
| `machineryGetAncestorSmartFolders` | Y | 10569-10585 | 17 | - |
| `machineryCalcuteContainFolders` | Y | 10591-10635 | 45 | - |
| `machineryGetFolderParentChilder` | Y | 10638-10645 | 8 | - |
| `machineryToggleAllFolders` | Y | 10668-10677 | 10 | `machineryUpdateSidebarList` |
| `machineryToggleCurrentLevelFolders` | Y | 10679-10688 | 10 | `machineryUpdateSidebarList` |

### filterDomain（27 项 / 1701 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `filterCache` |  | 104-104 | 1 | - |
| `shimFilterInst` |  | 105-105 | 1 | - |
| `getFilter` | Y | 106-236 | 131 | `filterCache`, `shimFilterInst` |
| `machineryCalcuteFilterBadge` | Y | 722-831 | 110 | - |
| `getMatchFunctionTable` |  | 1562-1594 | 33 | - |
| `machineryIsMatchCondition` |  | 1597-1625 | 29 | `getMatchFunctionTable` |
| `machineryExistInSmartFilter` | Y | 1628-1651 | 24 | `machineryIsMatchCondition` |
| `semanticSearchController` |  | 1657-1657 | 1 | - |
| `machineryFilterDataPart1` |  | 1661-1968 | 308 | - |
| `machineryFilterDataPart2` |  | 1974-2208 | 235 | `getFilter`, `machineryColorFilter`, `machineryGrayColorFilter` |
| `machineryFilterDataPart3` |  | 2214-2530 | 317 | `imageSearchController`, `machinerySortData`, `semanticSearchController` |
| `machineryFilterData` | Y | 2533-2539 | 7 | `machineryFilterDataPart1`, `machineryFilterDataPart2`, `machineryFilterDataPart3` |
| `machineryCalcuteFilterResult` | Y | 2542-2560 | 19 | `machineryContentFilter`, `machineryFilterData` |
| `machineryContentFilter` | Y | 2655-2739 | 85 | `machineryExistInSmartFilter` |
| `calculateFilterCountsTimeout` |  | 3202-3202 | 1 | - |
| `machineryCalculateFilterCounts` | Y | 3203-3217 | 15 | `calculateFilterCountsTimeout`, `machineryUpdateFilterCounts` |
| `machinerySearchFilter` |  | 6221-6321 | 101 | `machineryConvertToRegexGroup`, `machineryMatchWithRegexGroup` |
| `machineryColorFilter` | Y | 6345-6436 | 92 | `machineryColorSimilarityDistance` |
| `machineryGrayColorFilter` | Y | 6439-6455 | 17 | - |
| `machineryFilterContent` | Y | 6460-6472 | 13 | `machineryCalls`, `machineryRebindRefresh` |
| `machineryUpdateFilterCounts` | Y | 7332-7433 | 102 | - |
| `FILTER_ID_MAP` |  | 8447-8467 | 21 | - |
| `machineryOpenFilter` | Y | 8469-8476 | 8 | `machineryUpdateContainerHieght` |
| `machineryToggleFilterByType` | Y | 8478-8495 | 18 | `FILTER_ID_MAP`, `machineryOpenFilter` |
| `machinerySearchInAll` | Y | 8586-8590 | 5 | `machineryFocusSeach`, `machineryOpenAll` |
| `machineryFocusSeach` | Y | 9943-9948 | 6 | - |
| `getToggleFilterByTypeFn` | Y | 10704-10704 | 1 | `machineryToggleFilterByType`, `scopeSingleton` |

### itemDomain（47 项 / 1616 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `calculateImageBindingTimeout` |  | 96-96 | 1 | - |
| `rebindRefreshLazyTimeout` |  | 100-100 | 1 | - |
| `prependImagesTimeout` |  | 102-102 | 1 | - |
| `machinerySortRawData` | Y | 329-427 | 99 | `getLanguageBCP` |
| `machineryCalculateImageBinding` | Y | 430-716 | 287 | `calculateImageBindingTimeout`, `getFilter`, `getTimeout`, `machineryGetAncestorFolders`, `machineryGetExtendTags`, `machinerySortRawData`, `pinyinCache` |
| `machineryFilterSidebarItem` | Y | 836-873 | 38 | - |
| `machineryRebindRefresh` | Y | 879-978 | 100 | `machineryCalcuteContainTags`, `machineryCalcuteFilterBadge`, `machineryCalcuteFilterResult`, `machineryCalls`, `machineryRefreshSubfolderList`, `machineryUpdateItemsView` |
| `machineryRebindRefreshLazy` | Y | 981-987 | 7 | `getTimeout`, `machineryRebindRefresh`, `rebindRefreshLazyTimeout` |
| `machineryUpdateItemsView` | Y | 1086-1093 | 8 | `machineryUpdateItemView` |
| `machineryResetImageData` |  | 1102-1108 | 7 | - |
| `machineryPrependImages` | Y | 1112-1125 | 14 | `machineryResetImageData`, `prependImagesTimeout` |
| `machineryReload` | Y | 1146-1191 | 46 | `machineryAdjustLayoutWidth`, `machineryAutoResizeTagFilter`, `machineryCalculateFilterCounts`, `machineryLeaveDetailMode`, `machineryRebindRefresh`, `machineryRelayout`, `machineryUpdateSelection`, `machineryUpdateSubFolderWidth` |
| `machineryUpdateItemView` | Y | 1273-1495 | 223 | `getFilter` |
| `imageSearchController` |  | 1656-1656 | 1 | - |
| `machineryCopyImages` | Y | 4787-4840 | 54 | `getFilter`, `machineryGetSelectedTags` |
| `machineryCreateTxtFileFromTemplate` | Y | 5780-5784 | 5 | `machineryNewFileFromTemplate` |
| `machineryGetItemByElement` | Y | 6003-6008 | 6 | - |
| `machineryNewFileFromTemplate` | Y | 6514-6550 | 37 | `machineryShowUploadQueue` |
| `checkListItemsLessThanContainerTimeout` |  | 7008-7008 | 1 | - |
| `machineryCheckListItemsLessThanContainer` | Y | 7013-7030 | 18 | `checkListItemsLessThanContainerTimeout` |
| `machineryScrollToCurrentItem` | Y | 7115-7127 | 13 | - |
| `machineryForceFitImageSize` | Y | 7131-7149 | 19 | - |
| `machinerySortData` | Y | 7174-7286 | 113 | - |
| `preloadImageTimeout` |  | 7479-7479 | 1 | - |
| `machineryPreloadImage` | Y | 7483-7513 | 31 | `machineryCurrentIndex`, `preloadImageTimeout` |
| `machineryToggleCommentMode` | Y | 8187-8191 | 5 | - |
| `machineryPausePalette` | Y | 8411-8417 | 7 | - |
| `machineryResumePalette` | Y | 8419-8425 | 7 | - |
| `machineryIsDuplicateImage` | Y | 8594-8606 | 13 | - |
| `machineryAddToDuplicateMapping` | Y | 8608-8613 | 6 | - |
| `machineryRemoveFromDuplicateMapping` | Y | 8615-8619 | 5 | - |
| `machineryOpenDuplicate` | Y | 8623-8646 | 24 | - |
| `machineryUpdateTxtItem` | Y | 8755-8767 | 13 | - |
| `machineryEnlargeThumbnailsTimeout` |  | 9227-9227 | 1 | - |
| `machineryEnlargeThumbnails` | Y | 9228-9246 | 19 | `machineryEnlargeThumbnailsTimeout` |
| `machineryShrinkThumbnailsTimeout` |  | 9248-9248 | 1 | - |
| `machineryShrinkThumbnails` | Y | 9249-9266 | 18 | `machineryShrinkThumbnailsTimeout` |
| `machineryOnImageSizeHeightChanged` | Y | 9269-9279 | 11 | `machineryEnlargeThumbnails`, `machineryShrinkThumbnails`, `machineryUpdateListSlider`, `machineryUpdateSubFolderWidth` |
| `machineryChangeMetaItems` | Y | 9289-9296 | 8 | `machineryUpdateItemsView` |
| `addImageTimeLeftInterval` |  | 9305-9305 | 1 | - |
| `machineryCalcuteAddImageTimeLeft` |  | 9309-9324 | 16 | - |
| `machineryShowUploadQueue` | Y | 9559-9572 | 14 | `addImageTimeLeftInterval`, `machineryCalcuteAddImageTimeLeft` |
| `machineryHideUploadQueue` | Y | 9574-9581 | 8 | - |
| `machineryGetFolderImages` | Y | 9696-9721 | 26 | - |
| `machineryFindDupclipate` | Y | 9727-9890 | 164 | `machineryGetFolderImages` |
| `machineryEnableImageNameEditable` | Y | 10044-10142 | 99 | `emojiRegex`, `getRemainingFilenameLength`, `getSanitize` |
| `machineryRenameImages` | Y | 10247-10265 | 19 | `machineryEnableImageNameEditable` |

### selectionViewDomain（25 项 / 1111 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `updateSelectionTimeout` |  | 2853-2853 | 1 | - |
| `machineryUpdateSelection` | Y | 2855-3043 | 189 | `getFilter`, `getTimeout`, `machineryCalls`, `sortTagsForSelection`, `updateSelectionTimeout` |
| `sortTagsForSelection` |  | 3046-3079 | 34 | - |
| `machineryGetSelection` | Y | 3119-3136 | 18 | - |
| `cleanSelectedTimeout` |  | 4234-4234 | 1 | - |
| `machinerySelectAll` | Y | 4237-4257 | 21 | `cleanSelectedTimeout`, `getTimeout` |
| `machinerySelectNext` | Y | 4273-4330 | 58 | `getTimeout`, `machineryAddToRecentFile`, `machineryAutoScroll`, `machineryForceFitImageSize`, `machineryGetSelection`, `machineryLastZoom`, `machineryPreloadImage`, `machineryRememberScrollTops` … |
| `machinerySelectPrev` | Y | 4334-4400 | 67 | `getTimeout`, `machineryAddToRecentFile`, `machineryAutoScroll`, `machineryForceFitImageSize`, `machineryGetSelection`, `machineryLastZoom`, `machineryPreloadImage`, `machineryRememberScrollTops` … |
| `machineryMultipleSelectUp` | Y | 4405-4413 | 9 | `machineryMultipleSelectPrev` |
| `machineryMultipleSelectDown` | Y | 4416-4424 | 9 | `machineryMultipleSelectNext` |
| `machineryMultipleSelectNext` | Y | 4428-4455 | 28 | `machineryAutoScroll`, `machineryGetSelection` |
| `machineryMultipleSelectPrev` | Y | 4459-4486 | 28 | `machineryAutoScroll`, `machineryGetSelection` |
| `machineryRemoveSelected` | Y | 4498-4734 | 237 | `getFilter`, `getTimeout`, `lastMoveToTrashCheckbox`, `machineryAutoScroll`, `machineryCalculateImageBinding`, `machineryCheckOperationSafety`, `machineryCurrentIndex`, `machineryForceFitImageSize` … |
| `machinerySelectUp` | Y | 5481-5544 | 64 | `machineryAutoScroll`, `machineryForceFitImageSize`, `machineryGetItemByElement`, `machineryGetSelection`, `machineryLastZoom`, `machineryZoom` |
| `machinerySelectDown` | Y | 5546-5608 | 63 | `machineryAutoScroll`, `machineryForceFitImageSize`, `machineryGetArroundBox`, `machineryGetItemByElement`, `machineryGetSelection`, `machineryLastZoom`, `machineryZoom` |
| `machineryOpenInspectorTagSelectPanel` | Y | 5818-5821 | 4 | - |
| `machineryOpenInspectorFolderSelectPanel` | Y | 5833-5997 | 165 | `getFilter`, `machineryCalculateImageBinding`, `machineryCheckOperationSafety`, `machineryRebindRefresh`, `machineryUpdateFilterCounts`, `machineryUpdateSelection` |
| `machineryGetSelectedItems` | Y | 6963-6974 | 12 | - |
| `machineryGetSelectedItemElements` | Y | 6977-6987 | 11 | `machineryGetSelectedItems` |
| `machineryGetSelectedTags` | Y | 6990-6993 | 4 | - |
| `machineryRemoveSelectedFolders` | Y | 7981-8019 | 39 | `getFilter`, `machineryCheckOperationSafety2`, `machineryRemoveFolderInner` |
| `machineryRemoveSelectedSmartFolders` | Y | 8023-8050 | 28 | `getFilter`, `machineryRemoveSmartFolderInner` |
| `tagRectSelecting` |  | 8221-8221 | 1 | - |
| `machineryToggleSelectSmartFolder` | Y | 8675-8680 | 6 | `machineryToggleCurrentLevelSmartFoldersInner` |
| `machinerySelectFolder` | Y | 10024-10037 | 14 | `machineryUpdateSelection` |

### MOUNT-INFRA（最后一批/或留共享）（9 项 / 1009 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `timeoutCache` |  | 238-238 | 1 | - |
| `shimTimeoutInst` |  | 239-239 | 1 | - |
| `getTimeout` | Y | 241-275 | 35 | `shimTimeoutInst`, `timeoutCache` |
| `singletonByScope` |  | 10694-10694 | 1 | - |
| `scopeSingleton` |  | 10695-10700 | 6 | `singletonByScope` |
| `machineryCalls` | Y | 10709-10709 | 1 | - |
| `machinerySeedControllerState` | Y | 10714-11229 | 516 | - |
| `applied` |  | 11231-11231 | 1 | - |
| `applyDataMachineryScope` | Y | 11232-11678 | 447 | `applied`, `buildRecentFileManager`, `buildScrollbarSaver`, `getTimeout`, `machineryCalculateImageBinding`, `machineryCalcuteFilterResult`, `machineryCalls`, `machineryColorFilter` … |

### tagManagerDomain（21 项 / 817 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryGetExtendTags` | Y | 308-326 | 19 | - |
| `machineryAutoResizeTagFilter` |  | 1128-1140 | 13 | - |
| `machineryCalcuteContainTagsInner` |  | 2742-2803 | 62 | - |
| `machineryCalcuteContainTags` | Y | 2806-2847 | 42 | `machineryCalcuteContainTagsInner` |
| `machineryOpenPrevGroup` |  | 5093-5117 | 25 | `machineryOpenStarredGroup`, `machineryOpenTagAllGroup`, `machineryOpenTagGroup`, `machineryOpenUnfiledGroup` |
| `machineryOpenNextGroup` |  | 5119-5140 | 22 | `machineryOpenStarredGroup`, `machineryOpenTagGroup`, `machineryOpenUnfiledGroup` |
| `machineryConvertToRegexGroup` |  | 6087-6197 | 111 | `escapeRegex` |
| `machineryMatchWithRegexGroup` |  | 6199-6219 | 21 | - |
| `openUntaggedTimeout` |  | 6559-6559 | 1 | - |
| `machineryOpenUntagged` | Y | 6653-6691 | 39 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `machinerySetLastFolder`, `machineryUpdateListHeight`, `openUntaggedTimeout` |
| `machineryOpenAllTags` | Y | 6763-6786 | 24 | `getTimeout`, `machineryRebindRefresh`, `machineryResetPage` |
| `machineryUpdateSubFolderWidth` | Y | 7034-7048 | 15 | - |
| `machineryOpenTagAllGroup` | Y | 8227-8241 | 15 | `tagRectSelecting` |
| `machineryOpenUnfiledGroup` | Y | 8243-8257 | 15 | `tagRectSelecting` |
| `machineryOpenStarredGroup` | Y | 8259-8273 | 15 | `tagRectSelecting` |
| `machineryOpenTagGroup` | Y | 8275-8291 | 17 | `tagRectSelecting` |
| `machineryRemoveTagGroup` | Y | 8295-8337 | 43 | `machineryOpenTagAllGroup` |
| `machineryRefreshSubfolderList` | Y | 9907-9940 | 34 | `machineryGetAllChildFolder` |
| `machineryEnableSubFolderNameEditable` | Y | 10147-10242 | 96 | `emojiRegex`, `getRemainingFilenameLength`, `getSanitize`, `machinerySelectFolder` |
| `machineryRenameTagGroup` | Y | 10289-10304 | 16 | - |
| `machineryEditTag` | Y | 10311-10482 | 172 | `getFilter`, `machineryCalculateImageBinding`, `machineryRebindRefresh`, `machinerySaveFolder`, `machineryUpdateSelection` |

### core/keymap（29 项 / 703 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryBuildMousetrap` | Y | 3666-3804 | 139 | `getPageUpHandlerFn`, `machineryBack`, `machineryChangeTo1Star`, `machineryChangeTo2Star`, `machineryChangeTo3Star`, `machineryChangeTo4Star`, `machineryChangeTo5Star`, `machineryCloseWindowHandler` … |
| `machineryDestoryMousetrap` | Y | 3807-3816 | 10 | - |
| `machineryInitMousetrap` | Y | 3819-3840 | 22 | `machineryBuildMousetrap`, `machineryDestoryMousetrap` |
| `machineryKeyCHandler` | Y | 4845-4850 | 6 | `machineryToggleCommentMode` |
| `machineryKeyPHandler` | Y | 4852-4854 | 3 | `machineryOpenPluginPanel` |
| `machineryKeyLeftHandler` | Y | 4859-4904 | 46 | `machinerySelectPrev`, `machineryUpdateSidebarList` |
| `machineryKeyRightHandler` | Y | 4908-4941 | 34 | `machinerySelectNext`, `machineryUpdateSidebarList` |
| `machineryModUpHandler` | Y | 4946-4958 | 13 | `machineryHomeHandler` |
| `machineryModDownHandler` | Y | 4960-4972 | 13 | `machineryEndHandler` |
| `machineryModLeftHandler` | Y | 4974-4988 | 15 | `machineryPrevHistory` |
| `machineryModRightHandler` | Y | 4990-5004 | 15 | `machineryNextHistory` |
| `machineryModShiftUpHandler` | Y | 5006-5015 | 10 | - |
| `machineryModShiftDownHandler` | Y | 5017-5026 | 10 | - |
| `machineryModShiftLeftHandler` | Y | 5028-5037 | 10 | - |
| `machineryModShiftRightHandler` | Y | 5039-5048 | 10 | - |
| `machineryKeyUpHandler` | Y | 5148-5262 | 115 | `machineryOpenAll`, `machineryOpenAllTags`, `machineryOpenCommunity`, `machineryOpenPrevFolder`, `machineryOpenPrevGroup`, `machineryOpenPrevQuickAccess`, `machineryOpenPrevSmartFolder`, `machineryOpenRandom` … |
| `machineryKeyDownHandler` | Y | 5270-5403 | 134 | `machineryOpenAllTags`, `machineryOpenCommunity`, `machineryOpenNextFolder`, `machineryOpenNextGroup`, `machineryOpenNextQuickAccess`, `machineryOpenNextSmartFolder`, `machineryOpenRandom`, `machineryOpenRecent` … |
| `machineryPageDownHandler` | Y | 5443-5455 | 13 | `machineryScrollbarTo` |
| `machineryPageUpHandler` | Y | 5458-5475 | 18 | `machineryScrollbarTo` |
| `machineryCloseWindowHandler` | Y | 5648-5658 | 11 | - |
| `machineryNHandler` | Y | 5662-5673 | 12 | `machineryAddVideoComment` |
| `machineryMHandler` | Y | 5676-5684 | 9 | - |
| `machinerySaveHandler` | Y | 5742-5747 | 6 | - |
| `machineryOpenQuickSearch` | Y | 5807-5809 | 3 | - |
| `machineryOpenActionsPanel` | Y | 5812-5814 | 3 | - |
| `machineryHomeHandler` | Y | 7519-7528 | 10 | `machineryGotoTop` |
| `machineryEndHandler` | Y | 7532-7542 | 11 | `machineryGotoBottom` |
| `getPageUpHandlerFn` | Y | 10702-10702 | 1 | `machineryPageUpHandler`, `scopeSingleton` |
| `getPageDownHandlerFn` | Y | 10703-10703 | 1 | `machineryPageDownHandler`, `scopeSingleton` |

### miscDomain（22 项 / 426 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `getLanguageBCP` |  | 278-285 | 8 | - |
| `machineryToggleSlideshow` | Y | 1218-1224 | 7 | `machineryEnterSlideshowMode`, `machineryLeaveSlideshowMode` |
| `machineryCheckTouchIDSupport` | Y | 1500-1514 | 15 | - |
| `machineryEnterDetailMode` | Y | 3408-3502 | 95 | `getTimeout`, `machineryAddToRecentFile`, `machineryLastZoom`, `machineryPreloadImage`, `machineryZoom`, `zoomInitTimeout` |
| `machineryLeaveDetailMode` | Y | 3507-3564 | 58 | `getTimeout`, `machineryFadeOutDetailMode`, `machineryInitMousetrap`, `machineryRememberScrollTops`, `machineryRememberVideoCurrentTime`, `zoomInitTimeout` |
| `cgStack` |  | 3845-3845 | 1 | - |
| `cgScopes` |  | 3846-3846 | 1 | - |
| `CG_START_TOP` |  | 3847-3847 | 1 | - |
| `CG_SPACING` |  | 3848-3848 | 1 | - |
| `cgBuildTemplate` |  | 3853-3867 | 15 | - |
| `cgRestack` |  | 3870-3882 | 13 | `CG_SPACING`, `CG_START_TOP`, `cgStack` |
| `machineryNotify` | Y | 3888-3977 | 90 | `cgBuildTemplate`, `cgNotifyServiceCloseAll`, `cgRestack`, `cgStack`, `getFilter`, `getTimeout`, `undoTimeout` |
| `cgNotifyServiceCloseAll` |  | 3980-3984 | 5 | `cgStack` |
| `machineryToggleDetailMode` | Y | 4261-4263 | 3 | - |
| `machineryQuicklook` | Y | 4741-4783 | 43 | `getPageDownHandlerFn`, `machineryToggleDetailMode` |
| `machineryFadeOutDetailMode` | Y | 8194-8200 | 7 | - |
| `machineryOpenPluginPanel` | Y | 8203-8206 | 4 | - |
| `machineryEnterSlideshowMode` | Y | 8343-8360 | 18 | `getTimeout`, `machineryEnterDetailMode`, `machineryZoom` |
| `machineryLeaveSlideshowMode` | Y | 8363-8378 | 16 | `getTimeout`, `machineryZoom` |
| `machineryLockApp` | Y | 8389-8396 | 8 | `machineryFocusAppUnlockPassword` |
| `machineryFocusAppUnlockPassword` | Y | 8398-8407 | 10 | - |
| `machineryOpenTrialModal` | Y | 8970-8976 | 7 | - |

### stage/grid（25 项 / 426 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machinerySwitchLayout` | Y | 1097-1099 | 3 | - |
| `machineryRelayout` | Y | 1518-1556 | 39 | - |
| `machinerySaveListHeight` | Y | 3102-3104 | 3 | - |
| `machineryAdjustLayoutWidth` | Y | 3107-3109 | 3 | - |
| `machineryResetPage` | Y | 3155-3198 | 44 | `machineryFindDupclipate` |
| `updateListHeightTimeout` |  | 3223-3223 | 1 | - |
| `machineryUpdateListHeight` | Y | 3258-3264 | 7 | `updateListHeightTimeout` |
| `buildScrollbarSaver` | Y | 3267-3345 | 79 | - |
| `machineryUpdateContainerHieght` | Y | 4161-4193 | 33 | - |
| `machineryGetArroundBox` | Y | 5408-5413 | 6 | - |
| `machineryScrollbarTo` |  | 5424-5439 | 16 | - |
| `machineryToggleAll` | Y | 5690-5729 | 40 | `getOffsetScrollbarFn`, `getTimeout`, `machineryRelayout`, `machineryZoomFitEdge` |
| `machineryAutoScroll` | Y | 6948-6953 | 6 | `getTimeout` |
| `machineryCurrentIndex` | Y | 6956-6959 | 4 | - |
| `changeListHeightTimeout` |  | 7009-7009 | 1 | - |
| `machineryUpdateSliderPosition` | Y | 7051-7070 | 20 | - |
| `machineryChangeListHeight` | Y | 7075-7112 | 38 | `changeListHeightTimeout`, `machineryRelayout`, `machineryScrollToCurrentItem` |
| `machineryOffsetScrollbarImm` | Y | 7291-7318 | 28 | `machineryUpdateContainerHieght` |
| `machineryOffsetScrollbar` | Y | 7322-7327 | 6 | `machineryOffsetScrollbarImm` |
| `machineryRememberScrollTops` | Y | 7445-7454 | 10 | - |
| `machinerySaveLayout` | Y | 8428-8436 | 9 | - |
| `machineryUpdateListSlider` | Y | 9220-9222 | 3 | - |
| `machineryGotoTop` | Y | 9972-9982 | 11 | - |
| `machineryGotoBottom` | Y | 9984-9998 | 15 | - |
| `getOffsetScrollbarFn` | Y | 10701-10701 | 1 | `machineryOffsetScrollbar`, `scopeSingleton` |

### services/viewOpsService（18 项 / 285 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryGetRatioExp` | Y | 1196-1201 | 6 | - |
| `machineryGetRatioNonExp` | Y | 1204-1209 | 6 | - |
| `machineryUpdateZoomRatio` | Y | 1213-1215 | 3 | - |
| `machineryZoom` | Y | 3082-3096 | 15 | `machinerySmartZoom`, `machineryZoomFit`, `machineryZoomFitEdge` |
| `machineryZoomFit` | Y | 3112-3114 | 3 | - |
| `setViewModeDebounced` |  | 3227-3227 | 1 | - |
| `machinerySetViewMode` | Y | 3228-3237 | 10 | `setViewModeDebounced` |
| `zoomInitTimeout` |  | 3402-3402 | 1 | - |
| `machineryLastZoom` | Y | 3989-4005 | 17 | `machineryGetRatioNonExp`, `machineryOnZoomRatioChanged` |
| `machinerySmartZoom` | Y | 4009-4011 | 3 | - |
| `machineryZoomActual` | Y | 4016-4055 | 40 | `machineryAdjustLayoutWidth`, `machineryChangeListHeight`, `machineryOnImageSizeHeightChanged`, `machineryOnZoomRatioChanged`, `machinerySaveListHeight`, `machineryUpdateZoomRatio` |
| `machineryToggleZoom` | Y | 4058-4088 | 31 | `machineryZoomActual`, `machineryZoomFit`, `machineryZoomFitEdge` |
| `machineryZoomFitEdge` | Y | 4091-4158 | 68 | `machineryGetRatioNonExp`, `machineryOnZoomRatioChanged` |
| `machineryZoomIn` | Y | 5733-5735 | 3 | - |
| `machineryZoomOut` | Y | 5737-5739 | 3 | - |
| `machineryCheckOperationSafety` | Y | 7548-7582 | 35 | `getFilter` |
| `machineryCheckOperationSafety2` | Y | 7585-7619 | 35 | `getFilter` |
| `machineryOnZoomRatioChanged` | Y | 9282-9286 | 5 | - |

### services/uploadService（1 项 / 219 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryOnDropContainer` | Y | 9335-9553 | 219 | `getFilter`, `machineryHideUploadQueue`, `machineryShowUploadQueue` |

### services/folderCoreService（6 项 / 132 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `openAllTimeout` |  | 3222-3222 | 1 | - |
| `machineryOpenAll` | Y | 3350-3397 | 48 | `getTimeout`, `machineryLeaveDetailMode`, `machineryOnImageSizeHeightChanged`, `machineryResetPage`, `machinerySetLastFolder`, `machineryUpdateListHeight`, `openAllTimeout` |
| `machineryRefreshRandom` | Y | 5751-5767 | 17 | - |
| `openRandomTimeout` |  | 6557-6557 | 1 | - |
| `machineryOpenRandom` | Y | 6567-6608 | 42 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `machinerySetLastFolder`, `openRandomTimeout` |
| `machineryOpenCommunity` | Y | 6736-6758 | 23 | `machineryLeaveDetailMode`, `machineryResetPage` |

### services/imageOpsService（8 项 / 90 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryChangeTo5Star` | Y | 5613-5616 | 4 | `machineryChangeStar` |
| `machineryRemoveStar` | Y | 5621-5623 | 3 | `machineryChangeStar` |
| `machineryChangeTo1Star` | Y | 5625-5628 | 4 | `machineryChangeStar` |
| `machineryChangeTo2Star` | Y | 5630-5633 | 4 | `machineryChangeStar` |
| `machineryChangeTo3Star` | Y | 5635-5638 | 4 | `machineryChangeStar` |
| `machineryChangeTo4Star` | Y | 5640-5643 | 4 | `machineryChangeStar` |
| `machineryChangeStar` | Y | 6014-6076 | 63 | `getFilter`, `machineryCheckOperationSafety`, `machineryUpdateItemsView` |
| `machineryCancelCrop` | Y | 8439-8442 | 4 | - |

### core/navHistory（9 项 / 64 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `undoTimeout` |  | 3849-3849 | 1 | - |
| `machineryUndo` | Y | 4199-4203 | 5 | `cgNotifyServiceCloseAll` |
| `machineryNextHistory` | Y | 4207-4212 | 6 | - |
| `machineryPrevHistory` | Y | 4214-4219 | 6 | - |
| `machineryBack` | Y | 4222-4229 | 8 | `machineryLeaveDetailMode`, `machineryPrevHistory` |
| `nextTimeout` |  | 4268-4268 | 1 | - |
| `prevTimeout` |  | 4269-4269 | 1 | - |
| `machineryOpenPrevQuickAccess` |  | 5055-5066 | 12 | `machineryOpenTrash` |
| `machineryOpenNextQuickAccess` |  | 5068-5091 | 24 | - |

### services/mediaService（7 项 / 49 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryNextGifFrame` | Y | 6476-6488 | 13 | - |
| `machineryPrevGifFrame` | Y | 6490-6501 | 12 | - |
| `machineryAddVideoComment` | Y | 6507-6509 | 3 | - |
| `machineryGetVideoPlayer` | Y | 7439-7441 | 3 | - |
| `machineryRememberVideoCurrentTime` | Y | 7458-7460 | 3 | - |
| `machineryVideoScreenShot` | Y | 9689-9691 | 3 | - |
| `machineryCalcRotateDegree` | Y | 10649-10660 | 12 | - |

### utils（跨域纯函数）（9 项 / 39 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `pinyinCache` |  | 95-95 | 1 | - |
| `escapeRegex` |  | 6083-6085 | 3 | - |
| `machineryColorSimilarityDistance` |  | 6331-6342 | 12 | - |
| `machineryRgbToHex` | Y | 8381-8386 | 6 | - |
| `emojiRegex` |  | 10005-10005 | 1 | - |
| `remainingFilenameLengthCache` |  | 10006-10006 | 1 | - |
| `getRemainingFilenameLength` |  | 10007-10013 | 7 | `remainingFilenameLengthCache` |
| `sanitizeCache` |  | 10014-10014 | 1 | - |
| `getSanitize` |  | 10015-10021 | 7 | `sanitizeCache` |

### services/batchOpsService（1 项 / 24 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryRemovePermanently` | Y | 7634-7657 | 24 | `machineryCalculateImageBinding`, `machineryGetSelectedItemElements`, `machineryRebindRefresh`, `machineryUpdateSelection` |

## 2. 跨域共享顶层名（≥2 域引用 —— 最后搬或抽共享模块）

- `getFilter`：filterDomain、itemDomain、libraryDomain、miscDomain、selectionViewDomain、services/imageOpsService、services/uploadService、services/viewOpsService、tagManagerDomain
- `getTimeout`：MOUNT-INFRA（最后一批/或留共享）、itemDomain、libraryDomain、miscDomain、selectionViewDomain、services/folderCoreService、stage/grid、tagManagerDomain
- `machineryRebindRefresh`：MOUNT-INFRA（最后一批/或留共享）、filterDomain、itemDomain、libraryDomain、selectionViewDomain、services/batchOpsService、tagManagerDomain
- `machineryLeaveDetailMode`：MOUNT-INFRA（最后一批/或留共享）、core/navHistory、itemDomain、libraryDomain、selectionViewDomain、services/folderCoreService、tagManagerDomain
- `machineryUpdateSelection`：MOUNT-INFRA（最后一批/或留共享）、itemDomain、libraryDomain、selectionViewDomain、services/batchOpsService、tagManagerDomain
- `machineryCalculateImageBinding`：MOUNT-INFRA（最后一批/或留共享）、libraryDomain、selectionViewDomain、services/batchOpsService、tagManagerDomain
- `machineryCalls`：MOUNT-INFRA（最后一批/或留共享）、filterDomain、itemDomain、selectionViewDomain
- `machineryUpdateItemsView`：MOUNT-INFRA（最后一批/或留共享）、itemDomain、services/imageOpsService
- `machineryRelayout`：MOUNT-INFRA（最后一批/或留共享）、itemDomain、stage/grid
- `machineryExistInSmartFilter`：MOUNT-INFRA（最后一批/或留共享）、filterDomain、libraryDomain
- `machineryUpdateFilterCounts`：filterDomain、libraryDomain、selectionViewDomain
- `machineryResetPage`：libraryDomain、services/folderCoreService、tagManagerDomain
- `machinerySetLastFolder`：libraryDomain、services/folderCoreService、tagManagerDomain
- `machineryUpdateListHeight`：libraryDomain、services/folderCoreService、tagManagerDomain
- `machineryZoom`：libraryDomain、miscDomain、selectionViewDomain
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
- `machineryShowUploadQueue`：itemDomain、services/uploadService
- `machineryUpdateContainerHieght`：filterDomain、stage/grid
- `machineryRemoveSmartFolderInner`：libraryDomain、selectionViewDomain
- `machineryCheckOperationSafety2`：libraryDomain、selectionViewDomain
- `machineryRemoveFolderInner`：libraryDomain、selectionViewDomain
- `machineryEnterDetailMode`：MOUNT-INFRA（最后一批/或留共享）、miscDomain
- `machineryToggleCurrentLevelSmartFoldersInner`：libraryDomain、selectionViewDomain
- `emojiRegex`：itemDomain、tagManagerDomain
- `getRemainingFilenameLength`：itemDomain、tagManagerDomain
- `getSanitize`：itemDomain、tagManagerDomain

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
| `../services/mediaService` | { mediaAddVideoComment, mediaGetVideoPlayer, mediaRememberVideoCurrentTime, medi |
| `color-convert` | colorConvert |
| `delta-e` | DeltaE |
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

