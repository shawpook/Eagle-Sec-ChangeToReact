# D-1 / Track B / B-0：dataMachinery.ts 映射表（自动生成）

> 生成器：`tests-tmp/bz-d1-b0-map.py`（只读分析）。施工前请人工复核域归属。

## 0. 总量

- 文件：`src/app/react/core/dataMachinery.ts`，**10600 行**
- 顶层声明：**256**（exported **191** / 私有 **65**）
- import 面：**39** 条
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
| services/viewOpsService | 18 | 285 | 16 |
| services/uploadService | 1 | 219 | 1 |
| services/folderCoreService | 5 | 115 | 3 |
| stage/grid | 4 | 91 | 4 |
| services/imageOpsService | 7 | 86 | 7 |
| core/navHistory | 9 | 64 | 4 |
| services/batchOpsService | 1 | 24 | 1 |

### filterDomain（27 项 / 1701 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `filterCache` |  | 105-105 | 1 | - |
| `shimFilterInst` |  | 106-106 | 1 | - |
| `getFilter` | Y | 107-237 | 131 | `filterCache`, `shimFilterInst` |
| `machineryCalcuteFilterBadge` | Y | 704-813 | 110 | - |
| `getMatchFunctionTable` |  | 1478-1510 | 33 | - |
| `machineryIsMatchCondition` |  | 1513-1541 | 29 | `getMatchFunctionTable` |
| `machineryExistInSmartFilter` | Y | 1544-1567 | 24 | `machineryIsMatchCondition` |
| `semanticSearchController` |  | 1573-1573 | 1 | - |
| `machineryFilterDataPart1` |  | 1577-1884 | 308 | - |
| `machineryFilterDataPart2` |  | 1890-2124 | 235 | `getFilter`, `machineryColorFilter`, `machineryGrayColorFilter` |
| `machineryFilterDataPart3` |  | 2130-2446 | 317 | `imageSearchController`, `machinerySortData`, `semanticSearchController` |
| `machineryFilterData` | Y | 2449-2455 | 7 | `machineryFilterDataPart1`, `machineryFilterDataPart2`, `machineryFilterDataPart3` |
| `machineryCalcuteFilterResult` | Y | 2458-2476 | 19 | `machineryContentFilter`, `machineryFilterData` |
| `machineryContentFilter` | Y | 2571-2655 | 85 | `machineryExistInSmartFilter` |
| `calculateFilterCountsTimeout` |  | 3111-3111 | 1 | - |
| `machineryCalculateFilterCounts` | Y | 3112-3126 | 15 | `calculateFilterCountsTimeout`, `machineryUpdateFilterCounts` |
| `machinerySearchFilter` |  | 5787-5887 | 101 | `machineryConvertToRegexGroup`, `machineryMatchWithRegexGroup` |
| `machineryColorFilter` | Y | 5898-5989 | 92 | - |
| `machineryGrayColorFilter` | Y | 5992-6008 | 17 | - |
| `machineryFilterContent` | Y | 6013-6025 | 13 | `machineryCalls`, `machineryRebindRefresh` |
| `machineryUpdateFilterCounts` | Y | 6755-6856 | 102 | - |
| `FILTER_ID_MAP` |  | 7817-7837 | 21 | - |
| `machineryOpenFilter` | Y | 7839-7846 | 8 | - |
| `machineryToggleFilterByType` | Y | 7848-7865 | 18 | `FILTER_ID_MAP`, `machineryOpenFilter` |
| `machinerySearchInAll` | Y | 7937-7941 | 5 | `machineryFocusSeach`, `machineryOpenAll` |
| `machineryFocusSeach` | Y | 8999-9004 | 6 | - |
| `getToggleFilterByTypeFn` | Y | 9609-9609 | 1 | `machineryToggleFilterByType`, `scopeSingleton` |

### itemDomain（40 项 / 1520 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `calculateImageBindingTimeout` |  | 97-97 | 1 | - |
| `rebindRefreshLazyTimeout` |  | 101-101 | 1 | - |
| `prependImagesTimeout` |  | 103-103 | 1 | - |
| `machinerySortRawData` | Y | 311-409 | 99 | `getLanguageBCP` |
| `machineryCalculateImageBinding` | Y | 412-698 | 287 | `calculateImageBindingTimeout`, `getFilter`, `getTimeout`, `machineryGetExtendTags`, `machinerySortRawData` |
| `machineryFilterSidebarItem` | Y | 818-855 | 38 | - |
| `machineryRebindRefresh` | Y | 861-960 | 100 | `machineryCalcuteContainTags`, `machineryCalcuteFilterBadge`, `machineryCalcuteFilterResult`, `machineryCalls`, `machineryRefreshSubfolderList`, `machineryUpdateItemsView` |
| `machineryRebindRefreshLazy` | Y | 963-969 | 7 | `getTimeout`, `machineryRebindRefresh`, `rebindRefreshLazyTimeout` |
| `machineryUpdateItemsView` | Y | 1068-1075 | 8 | `machineryUpdateItemView` |
| `machineryResetImageData` |  | 1081-1087 | 7 | - |
| `machineryPrependImages` | Y | 1091-1104 | 14 | `machineryResetImageData`, `prependImagesTimeout` |
| `machineryReload` | Y | 1125-1170 | 46 | `machineryAutoResizeTagFilter`, `machineryCalculateFilterCounts`, `machineryLeaveDetailMode`, `machineryRebindRefresh`, `machineryUpdateSelection`, `machineryUpdateSubFolderWidth` |
| `machineryUpdateItemView` | Y | 1228-1450 | 223 | `getFilter` |
| `imageSearchController` |  | 1572-1572 | 1 | - |
| `machineryCopyImages` | Y | 4473-4526 | 54 | `getFilter`, `machineryGetSelectedTags` |
| `machineryCreateTxtFileFromTemplate` | Y | 5359-5363 | 5 | `machineryNewFileFromTemplate` |
| `machineryGetItemByElement` | Y | 5572-5577 | 6 | - |
| `machineryNewFileFromTemplate` | Y | 6036-6072 | 37 | `machineryShowUploadQueue` |
| `checkListItemsLessThanContainerTimeout` |  | 6525-6525 | 1 | - |
| `machineryCheckListItemsLessThanContainer` | Y | 6529-6546 | 18 | `checkListItemsLessThanContainerTimeout` |
| `machineryScrollToCurrentItem` | Y | 6572-6584 | 13 | - |
| `machineryForceFitImageSize` | Y | 6588-6606 | 19 | - |
| `machinerySortData` | Y | 6631-6743 | 113 | - |
| `preloadImageTimeout` |  | 6884-6884 | 1 | - |
| `machineryPreloadImage` | Y | 6888-6918 | 31 | `preloadImageTimeout` |
| `machineryToggleCommentMode` | Y | 7592-7596 | 5 | - |
| `machineryRemoveFromDuplicateMapping` | Y | 7947-7951 | 5 | - |
| `machineryEnlargeThumbnailsTimeout` |  | 8413-8413 | 1 | - |
| `machineryEnlargeThumbnails` | Y | 8414-8432 | 19 | `machineryEnlargeThumbnailsTimeout` |
| `machineryShrinkThumbnailsTimeout` |  | 8434-8434 | 1 | - |
| `machineryShrinkThumbnails` | Y | 8435-8452 | 18 | `machineryShrinkThumbnailsTimeout` |
| `machineryOnImageSizeHeightChanged` | Y | 8455-8465 | 11 | `machineryEnlargeThumbnails`, `machineryShrinkThumbnails`, `machineryUpdateSubFolderWidth` |
| `machineryChangeMetaItems` | Y | 8475-8482 | 8 | `machineryUpdateItemsView` |
| `addImageTimeLeftInterval` |  | 8490-8490 | 1 | - |
| `machineryCalcuteAddImageTimeLeft` |  | 8494-8509 | 16 | - |
| `machineryShowUploadQueue` | Y | 8744-8757 | 14 | `addImageTimeLeftInterval`, `machineryCalcuteAddImageTimeLeft` |
| `machineryHideUploadQueue` | Y | 8759-8766 | 8 | - |
| `machineryFindDupclipate` | Y | 8783-8946 | 164 | - |
| `machineryEnableImageNameEditable` | Y | 9052-9150 | 99 | - |
| `machineryRenameImages` | Y | 9255-9273 | 19 | `machineryEnableImageNameEditable` |

### libraryDomain（48 项 / 1494 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `updateSidebarListTimeout` |  | 100-100 | 1 | - |
| `machineryUpdateSidebarList` | Y | 974-1063 | 90 | `getTimeout`, `machineryFilterSidebarItem`, `machineryGetFolderList`, `machineryGetQuickAccessList`, `machineryGetSmartFolderList`, `updateSidebarListTimeout` |
| `machinerySmartFolderCount` | Y | 1206-1221 | 16 | `machineryExistInSmartFilter` |
| `buildRecentFileManager` |  | 2481-2567 | 87 | - |
| `machineryChangeSidebarIndex` | Y | 3048-3060 | 13 | `getTimeout` |
| `setLastFolderDebounced` |  | 3148-3148 | 1 | - |
| `machinerySetLastFolder` |  | 3149-3163 | 15 | `machinerySetViewMode`, `setLastFolderDebounced` |
| `lastMoveToTrashCheckbox` |  | 4177-4177 | 1 | - |
| `machineryOpenParentFolder` | Y | 5351-5355 | 5 | - |
| `machinerySetFolderCover` | Y | 5367-5381 | 15 | `getFilter` |
| `openUnfiledTimeout` |  | 6080-6080 | 1 | - |
| `openRecentTimeout` |  | 6082-6082 | 1 | - |
| `openTrashTimeout` |  | 6083-6083 | 1 | - |
| `machineryOpenUnfiled` | Y | 6134-6172 | 39 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `machinerySetLastFolder`, `openUnfiledTimeout` |
| `machineryOpenRecent` | Y | 6216-6254 | 39 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `machinerySetLastFolder`, `openRecentTimeout` |
| `machineryOpenTrash` | Y | 6312-6350 | 39 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `machinerySetLastFolder`, `openTrashTimeout` |
| `machineryOpenNextFolder` | Y | 6356-6369 | 14 | `machineryChangeSidebarIndex` |
| `machineryOpenPrevFolder` | Y | 6373-6406 | 34 | `machineryChangeSidebarIndex`, `machineryOpenTrash` |
| `machineryOpenNextSmartFolder` | Y | 6410-6431 | 22 | `machineryChangeSidebarIndex` |
| `machineryOpenPrevSmartFolder` | Y | 6435-6464 | 30 | `machineryChangeSidebarIndex`, `machineryOpenTrash` |
| `machineryGetQuickAccessList` | Y | 6513-6521 | 9 | - |
| `machineryAddToRecentFile` | Y | 6869-6881 | 13 | - |
| `machineryResetFolderCover` | Y | 7028-7035 | 8 | - |
| `machineryRemoveSmartFolder` | Y | 7071-7095 | 25 | `getFilter`, `machineryRemoveSmartFolderInner` |
| `machineryRemoveSmartFolderInner` |  | 7097-7180 | 84 | `getFilter`, `getTimeout`, `machineryOpenAll`, `machinerySaveFolderDebounce`, `machineryUpdateSidebarList` |
| `machineryRemoveFolder` | Y | 7184-7230 | 47 | `getFilter`, `machineryCheckOperationSafety2`, `machineryRemoveFolderInner` |
| `machineryRemoveFolderInner` |  | 7232-7382 | 151 | `getFilter`, `machineryCalculateImageBinding`, `machineryOpenAll`, `machineryRebindRefresh`, `machinerySaveFolderDebounce`, `machineryUpdateSidebarList` |
| `machineryRemoveFolderContents` | Y | 7463-7587 | 125 | `getFilter`, `getTimeout`, `machineryAutoScroll`, `machineryCalculateImageBinding`, `machineryForceFitImageSize`, `machineryGetSelectedItemElements`, `machineryGetSelection`, `machineryLeaveDetailMode` … |
| `machinerySaveFolderDebounce` | Y | 7615-7623 | 9 | - |
| `machineryMultipleOpenFolder` | Y | 7873-7914 | 42 | - |
| `machineryExpandFolder` | Y | 7920-7926 | 7 | `machineryUpdateSidebarList` |
| `machineryExpandSmartFolder` | Y | 7928-7934 | 7 | `machineryUpdateSidebarList` |
| `machineryToggleCurrentLevelSmartFoldersInner` | Y | 7958-7967 | 10 | `machineryUpdateSidebarList` |
| `machineryToggleAllSmartFoldersInner` | Y | 7969-7978 | 10 | `machineryUpdateSidebarList` |
| `machineryToggleCurrentLevelSmartFolders` | Y | 7990-7998 | 9 | `machineryToggleCurrentLevelSmartFoldersInner` |
| `machineryToggleAllSmartFolderExpand` | Y | 8000-8019 | 20 | `machineryChangeSidebarIndex`, `machineryToggleAllSmartFoldersInner`, `machineryUpdateSidebarList` |
| `machinerySetFolderOrder` | Y | 8023-8040 | 18 | - |
| `machinerySetSmartFolderOrder` | Y | 8042-8059 | 18 | - |
| `machineryQuickOpenFolder` | Y | 8074-8113 | 40 | `getTimeout`, `machineryAutoScroll`, `machineryChangeSidebarIndex`, `machineryOpenAll` |
| `machineryShowTutorial` | Y | 8124-8165 | 42 | `getFilter` |
| `machineryUnlockFolderWithTouchID` | Y | 8172-8214 | 43 | `machineryCalculateImageBinding`, `machineryUpdateSelection`, `machineryUpdateSidebarList` |
| `machineryGetSmartFolderList` | Y | 8221-8315 | 95 | - |
| `machineryGetFolderList` | Y | 8320-8405 | 86 | - |
| `machineryGetAllChildFolder` | Y | 8949-8957 | 9 | - |
| `machineryPrependFolder` | Y | 9011-9020 | 10 | `machineryCalculateImageBinding`, `machineryUpdateSidebarList` |
| `machineryRenameCurrentFolder` | Y | 9478-9550 | 73 | `getTimeout`, `machineryEditTag`, `machineryEnableSubFolderNameEditable`, `machineryGetSelectedTags`, `machineryRenameImages`, `machineryRenameTagGroup` |
| `machineryToggleAllFolders` | Y | 9573-9582 | 10 | `machineryUpdateSidebarList` |
| `machineryToggleCurrentLevelFolders` | Y | 9584-9593 | 10 | `machineryUpdateSidebarList` |

### selectionViewDomain（25 项 / 1111 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `updateSelectionTimeout` |  | 2769-2769 | 1 | - |
| `machineryUpdateSelection` | Y | 2771-2959 | 189 | `getFilter`, `getTimeout`, `machineryCalls`, `sortTagsForSelection`, `updateSelectionTimeout` |
| `sortTagsForSelection` |  | 2962-2995 | 34 | - |
| `machineryGetSelection` | Y | 3028-3045 | 18 | - |
| `cleanSelectedTimeout` |  | 3920-3920 | 1 | - |
| `machinerySelectAll` | Y | 3923-3943 | 21 | `cleanSelectedTimeout`, `getTimeout` |
| `machinerySelectNext` | Y | 3959-4016 | 58 | `getTimeout`, `machineryAddToRecentFile`, `machineryAutoScroll`, `machineryForceFitImageSize`, `machineryGetSelection`, `machineryLastZoom`, `machineryPreloadImage`, `machineryZoom` … |
| `machinerySelectPrev` | Y | 4020-4086 | 67 | `getTimeout`, `machineryAddToRecentFile`, `machineryAutoScroll`, `machineryForceFitImageSize`, `machineryGetSelection`, `machineryLastZoom`, `machineryPreloadImage`, `machineryZoom` … |
| `machineryMultipleSelectUp` | Y | 4091-4099 | 9 | `machineryMultipleSelectPrev` |
| `machineryMultipleSelectDown` | Y | 4102-4110 | 9 | `machineryMultipleSelectNext` |
| `machineryMultipleSelectNext` | Y | 4114-4141 | 28 | `machineryAutoScroll`, `machineryGetSelection` |
| `machineryMultipleSelectPrev` | Y | 4145-4172 | 28 | `machineryAutoScroll`, `machineryGetSelection` |
| `machineryRemoveSelected` | Y | 4184-4420 | 237 | `getFilter`, `getTimeout`, `lastMoveToTrashCheckbox`, `machineryAutoScroll`, `machineryCalculateImageBinding`, `machineryCheckOperationSafety`, `machineryForceFitImageSize`, `machineryGetSelectedItemElements` … |
| `machinerySelectUp` | Y | 5100-5163 | 64 | `machineryAutoScroll`, `machineryForceFitImageSize`, `machineryGetItemByElement`, `machineryGetSelection`, `machineryLastZoom`, `machineryZoom` |
| `machinerySelectDown` | Y | 5165-5227 | 63 | `machineryAutoScroll`, `machineryForceFitImageSize`, `machineryGetItemByElement`, `machineryGetSelection`, `machineryLastZoom`, `machineryZoom` |
| `machineryOpenInspectorTagSelectPanel` | Y | 5387-5390 | 4 | - |
| `machineryOpenInspectorFolderSelectPanel` | Y | 5402-5566 | 165 | `getFilter`, `machineryCalculateImageBinding`, `machineryCheckOperationSafety`, `machineryRebindRefresh`, `machineryUpdateFilterCounts`, `machineryUpdateSelection` |
| `machineryGetSelectedItems` | Y | 6480-6491 | 12 | - |
| `machineryGetSelectedItemElements` | Y | 6494-6504 | 11 | `machineryGetSelectedItems` |
| `machineryGetSelectedTags` | Y | 6507-6510 | 4 | - |
| `machineryRemoveSelectedFolders` | Y | 7386-7424 | 39 | `getFilter`, `machineryCheckOperationSafety2`, `machineryRemoveFolderInner` |
| `machineryRemoveSelectedSmartFolders` | Y | 7428-7455 | 28 | `getFilter`, `machineryRemoveSmartFolderInner` |
| `tagRectSelecting` |  | 7626-7626 | 1 | - |
| `machineryToggleSelectSmartFolder` | Y | 7983-7988 | 6 | `machineryToggleCurrentLevelSmartFoldersInner` |
| `machinerySelectFolder` | Y | 9032-9045 | 14 | `machineryUpdateSelection` |

### MOUNT-INFRA（最后一批/或留共享）（9 项 / 1025 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `timeoutCache` |  | 239-239 | 1 | - |
| `shimTimeoutInst` |  | 240-240 | 1 | - |
| `getTimeout` | Y | 242-276 | 35 | `shimTimeoutInst`, `timeoutCache` |
| `singletonByScope` |  | 9599-9599 | 1 | - |
| `scopeSingleton` |  | 9600-9605 | 6 | `singletonByScope` |
| `machineryCalls` | Y | 9614-9614 | 1 | - |
| `machinerySeedControllerState` | Y | 9619-10134 | 516 | - |
| `applied` |  | 10136-10136 | 1 | - |
| `applyDataMachineryScope` | Y | 10137-10599 | 463 | `applied`, `buildRecentFileManager`, `getTimeout`, `machineryCalculateImageBinding`, `machineryCalcuteFilterResult`, `machineryCalls`, `machineryChangeStar`, `machineryColorFilter` … |

### tagManagerDomain（21 项 / 817 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryGetExtendTags` | Y | 290-308 | 19 | - |
| `machineryAutoResizeTagFilter` |  | 1107-1119 | 13 | - |
| `machineryCalcuteContainTagsInner` |  | 2658-2719 | 62 | - |
| `machineryCalcuteContainTags` | Y | 2722-2763 | 42 | `machineryCalcuteContainTagsInner` |
| `machineryOpenPrevGroup` |  | 4735-4759 | 25 | `machineryOpenStarredGroup`, `machineryOpenTagAllGroup`, `machineryOpenTagGroup`, `machineryOpenUnfiledGroup` |
| `machineryOpenNextGroup` |  | 4761-4782 | 22 | `machineryOpenStarredGroup`, `machineryOpenTagGroup`, `machineryOpenUnfiledGroup` |
| `machineryConvertToRegexGroup` |  | 5653-5763 | 111 | - |
| `machineryMatchWithRegexGroup` |  | 5765-5785 | 21 | - |
| `openUntaggedTimeout` |  | 6081-6081 | 1 | - |
| `machineryOpenUntagged` | Y | 6175-6213 | 39 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `machinerySetLastFolder`, `openUntaggedTimeout` |
| `machineryOpenAllTags` | Y | 6285-6308 | 24 | `getTimeout`, `machineryRebindRefresh`, `machineryResetPage` |
| `machineryUpdateSubFolderWidth` | Y | 6550-6564 | 15 | - |
| `machineryOpenTagAllGroup` | Y | 7632-7646 | 15 | `tagRectSelecting` |
| `machineryOpenUnfiledGroup` | Y | 7648-7662 | 15 | `tagRectSelecting` |
| `machineryOpenStarredGroup` | Y | 7664-7678 | 15 | `tagRectSelecting` |
| `machineryOpenTagGroup` | Y | 7680-7696 | 17 | `tagRectSelecting` |
| `machineryRemoveTagGroup` | Y | 7700-7742 | 43 | `machineryOpenTagAllGroup` |
| `machineryRefreshSubfolderList` | Y | 8963-8996 | 34 | `machineryGetAllChildFolder` |
| `machineryEnableSubFolderNameEditable` | Y | 9155-9250 | 96 | `machinerySelectFolder` |
| `machineryRenameTagGroup` | Y | 9278-9293 | 16 | - |
| `machineryEditTag` | Y | 9300-9471 | 172 | `getFilter`, `machineryCalculateImageBinding`, `machineryRebindRefresh`, `machineryUpdateSelection` |

### core/keymap（20 项 / 627 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryBuildMousetrap` | Y | 3397-3535 | 139 | `getPageUpHandlerFn`, `machineryBack`, `machineryChangeTo1Star`, `machineryChangeTo2Star`, `machineryChangeTo3Star`, `machineryChangeTo4Star`, `machineryChangeTo5Star`, `machineryCopyImages` … |
| `machineryInitMousetrap` | Y | 3539-3560 | 22 | `machineryBuildMousetrap` |
| `machineryKeyCHandler` | Y | 4531-4536 | 6 | `machineryToggleCommentMode` |
| `machineryKeyPHandler` | Y | 4538-4540 | 3 | `machineryOpenPluginPanel` |
| `machineryKeyLeftHandler` | Y | 4545-4590 | 46 | `machinerySelectPrev`, `machineryUpdateSidebarList` |
| `machineryKeyRightHandler` | Y | 4594-4627 | 34 | `machinerySelectNext`, `machineryUpdateSidebarList` |
| `machineryModUpHandler` | Y | 4632-4644 | 13 | `machineryHomeHandler` |
| `machineryModDownHandler` | Y | 4646-4658 | 13 | `machineryEndHandler` |
| `machineryModLeftHandler` | Y | 4660-4674 | 15 | `machineryPrevHistory` |
| `machineryModRightHandler` | Y | 4676-4690 | 15 | `machineryNextHistory` |
| `machineryKeyUpHandler` | Y | 4790-4904 | 115 | `machineryOpenAll`, `machineryOpenAllTags`, `machineryOpenCommunity`, `machineryOpenPrevFolder`, `machineryOpenPrevGroup`, `machineryOpenPrevQuickAccess`, `machineryOpenPrevSmartFolder`, `machineryOpenRandom` … |
| `machineryKeyDownHandler` | Y | 4912-5045 | 134 | `machineryOpenAllTags`, `machineryOpenCommunity`, `machineryOpenNextFolder`, `machineryOpenNextGroup`, `machineryOpenNextQuickAccess`, `machineryOpenNextSmartFolder`, `machineryOpenRandom`, `machineryOpenRecent` … |
| `machineryPageDownHandler` | Y | 5062-5074 | 13 | - |
| `machineryPageUpHandler` | Y | 5077-5094 | 18 | - |
| `machineryNHandler` | Y | 5269-5280 | 12 | - |
| `machinerySaveHandler` | Y | 5338-5343 | 6 | - |
| `machineryHomeHandler` | Y | 6924-6933 | 10 | - |
| `machineryEndHandler` | Y | 6937-6947 | 11 | - |
| `getPageUpHandlerFn` | Y | 9607-9607 | 1 | `machineryPageUpHandler`, `scopeSingleton` |
| `getPageDownHandlerFn` | Y | 9608-9608 | 1 | `machineryPageDownHandler`, `scopeSingleton` |

### miscDomain（21 项 / 419 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `getLanguageBCP` |  | 279-286 | 8 | - |
| `machineryToggleSlideshow` | Y | 1197-1203 | 7 | `machineryEnterSlideshowMode`, `machineryLeaveSlideshowMode` |
| `machineryCheckTouchIDSupport` | Y | 1455-1469 | 15 | - |
| `machineryEnterDetailMode` | Y | 3228-3322 | 95 | `getTimeout`, `machineryAddToRecentFile`, `machineryLastZoom`, `machineryPreloadImage`, `machineryZoom`, `zoomInitTimeout` |
| `machineryLeaveDetailMode` | Y | 3327-3384 | 58 | `getTimeout`, `machineryFadeOutDetailMode`, `machineryInitMousetrap`, `zoomInitTimeout` |
| `cgStack` |  | 3565-3565 | 1 | - |
| `cgScopes` |  | 3566-3566 | 1 | - |
| `CG_START_TOP` |  | 3567-3567 | 1 | - |
| `CG_SPACING` |  | 3568-3568 | 1 | - |
| `cgBuildTemplate` |  | 3573-3587 | 15 | - |
| `cgRestack` |  | 3590-3602 | 13 | `CG_SPACING`, `CG_START_TOP`, `cgStack` |
| `machineryNotify` | Y | 3608-3697 | 90 | `cgBuildTemplate`, `cgNotifyServiceCloseAll`, `cgRestack`, `cgStack`, `getFilter`, `getTimeout`, `undoTimeout` |
| `cgNotifyServiceCloseAll` |  | 3700-3704 | 5 | `cgStack` |
| `machineryToggleDetailMode` | Y | 3947-3949 | 3 | - |
| `machineryQuicklook` | Y | 4427-4469 | 43 | `getPageDownHandlerFn`, `machineryToggleDetailMode` |
| `machineryFadeOutDetailMode` | Y | 7599-7605 | 7 | - |
| `machineryOpenPluginPanel` | Y | 7608-7611 | 4 | - |
| `machineryEnterSlideshowMode` | Y | 7748-7765 | 18 | `getTimeout`, `machineryEnterDetailMode`, `machineryZoom` |
| `machineryLeaveSlideshowMode` | Y | 7768-7783 | 16 | `getTimeout`, `machineryZoom` |
| `machineryLockApp` | Y | 7788-7795 | 8 | `machineryFocusAppUnlockPassword` |
| `machineryFocusAppUnlockPassword` | Y | 7797-7806 | 10 | - |

### services/viewOpsService（18 项 / 285 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryGetRatioExp` | Y | 1175-1180 | 6 | - |
| `machineryGetRatioNonExp` | Y | 1183-1188 | 6 | - |
| `machineryUpdateZoomRatio` | Y | 1192-1194 | 3 | - |
| `machineryZoom` | Y | 2998-3012 | 15 | `machinerySmartZoom`, `machineryZoomFit`, `machineryZoomFitEdge` |
| `machineryZoomFit` | Y | 3021-3023 | 3 | - |
| `setViewModeDebounced` |  | 3135-3135 | 1 | - |
| `machinerySetViewMode` | Y | 3136-3145 | 10 | `setViewModeDebounced` |
| `zoomInitTimeout` |  | 3222-3222 | 1 | - |
| `machineryLastZoom` | Y | 3709-3725 | 17 | `machineryGetRatioNonExp`, `machineryOnZoomRatioChanged` |
| `machinerySmartZoom` | Y | 3729-3731 | 3 | - |
| `machineryZoomActual` | Y | 3736-3775 | 40 | `machineryOnImageSizeHeightChanged`, `machineryOnZoomRatioChanged`, `machineryUpdateZoomRatio` |
| `machineryToggleZoom` | Y | 3778-3808 | 31 | `machineryZoomActual`, `machineryZoomFit`, `machineryZoomFitEdge` |
| `machineryZoomFitEdge` | Y | 3811-3878 | 68 | `machineryGetRatioNonExp`, `machineryOnZoomRatioChanged` |
| `machineryZoomIn` | Y | 5329-5331 | 3 | - |
| `machineryZoomOut` | Y | 5333-5335 | 3 | - |
| `machineryCheckOperationSafety` | Y | 6953-6987 | 35 | `getFilter` |
| `machineryCheckOperationSafety2` | Y | 6990-7024 | 35 | `getFilter` |
| `machineryOnZoomRatioChanged` | Y | 8468-8472 | 5 | - |

### services/uploadService（1 项 / 219 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryOnDropContainer` | Y | 8520-8738 | 219 | `getFilter`, `machineryHideUploadQueue`, `machineryShowUploadQueue` |

### services/folderCoreService（5 项 / 115 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `openAllTimeout` |  | 3131-3131 | 1 | - |
| `machineryOpenAll` | Y | 3170-3217 | 48 | `getTimeout`, `machineryLeaveDetailMode`, `machineryOnImageSizeHeightChanged`, `machineryResetPage`, `machinerySetLastFolder`, `openAllTimeout` |
| `openRandomTimeout` |  | 6079-6079 | 1 | - |
| `machineryOpenRandom` | Y | 6089-6130 | 42 | `getTimeout`, `machineryLeaveDetailMode`, `machineryResetPage`, `machinerySetLastFolder`, `openRandomTimeout` |
| `machineryOpenCommunity` | Y | 6258-6280 | 23 | `machineryLeaveDetailMode`, `machineryResetPage` |

### stage/grid（4 项 / 91 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryResetPage` | Y | 3064-3107 | 44 | `machineryFindDupclipate` |
| `machineryToggleAll` | Y | 5286-5325 | 40 | `getOffsetScrollbarFn`, `getTimeout`, `machineryZoomFitEdge` |
| `machineryAutoScroll` | Y | 6470-6475 | 6 | `getTimeout` |
| `getOffsetScrollbarFn` | Y | 9606-9606 | 1 | `scopeSingleton` |

### services/imageOpsService（7 项 / 86 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryChangeTo5Star` | Y | 5232-5235 | 4 | `machineryChangeStar` |
| `machineryRemoveStar` | Y | 5240-5242 | 3 | `machineryChangeStar` |
| `machineryChangeTo1Star` | Y | 5244-5247 | 4 | `machineryChangeStar` |
| `machineryChangeTo2Star` | Y | 5249-5252 | 4 | `machineryChangeStar` |
| `machineryChangeTo3Star` | Y | 5254-5257 | 4 | `machineryChangeStar` |
| `machineryChangeTo4Star` | Y | 5259-5262 | 4 | `machineryChangeStar` |
| `machineryChangeStar` | Y | 5583-5645 | 63 | `getFilter`, `machineryCheckOperationSafety`, `machineryUpdateItemsView` |

### core/navHistory（9 项 / 64 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `undoTimeout` |  | 3569-3569 | 1 | - |
| `machineryUndo` | Y | 3885-3889 | 5 | `cgNotifyServiceCloseAll` |
| `machineryNextHistory` | Y | 3893-3898 | 6 | - |
| `machineryPrevHistory` | Y | 3900-3905 | 6 | - |
| `machineryBack` | Y | 3908-3915 | 8 | `machineryLeaveDetailMode`, `machineryPrevHistory` |
| `nextTimeout` |  | 3954-3954 | 1 | - |
| `prevTimeout` |  | 3955-3955 | 1 | - |
| `machineryOpenPrevQuickAccess` |  | 4697-4708 | 12 | `machineryOpenTrash` |
| `machineryOpenNextQuickAccess` |  | 4710-4733 | 24 | - |

### services/batchOpsService（1 项 / 24 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryRemovePermanently` | Y | 7039-7062 | 24 | `machineryCalculateImageBinding`, `machineryGetSelectedItemElements`, `machineryRebindRefresh`, `machineryUpdateSelection` |

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
- `machineryZoomFitEdge`：services/viewOpsService、stage/grid
- `machineryOnImageSizeHeightChanged`：services/folderCoreService、services/viewOpsService
- `machineryAddToRecentFile`：miscDomain、selectionViewDomain
- `machineryLastZoom`：miscDomain、selectionViewDomain
- `machineryPreloadImage`：miscDomain、selectionViewDomain
- `machineryInitMousetrap`：MOUNT-INFRA（最后一批/或留共享）、miscDomain
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
- `machinerySelectPrev`：MOUNT-INFRA（最后一批/或留共享）、core/keymap
- `machinerySelectNext`：MOUNT-INFRA（最后一批/或留共享）、core/keymap
- `machineryChangeStar`：MOUNT-INFRA（最后一批/或留共享）、services/imageOpsService
- `machineryShowUploadQueue`：itemDomain、services/uploadService
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
| `../services/gridService` | { buildScrollbarSaver, machineryAdjustLayoutWidth, machineryChangeListHeight, ma |

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

