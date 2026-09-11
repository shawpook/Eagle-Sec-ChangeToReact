# D-1 / Track B / B-0：dataMachinery.ts 映射表（自动生成）

> 生成器：`tests-tmp/bz-d1-b0-map.py`（只读分析）。施工前请人工复核域归属。

## 0. 总量

- 文件：`src/app/react/core/dataMachinery.ts`，**3306 行**
- 顶层声明：**47**（exported **37** / 私有 **10**）
- import 面：**49** 条
- 引用文件：**30**（`from .../dataMachinery`）

## 1. 域聚类（批次候选）

| 目标域 | 声明数 | 行数（含私有依赖） | 导出数 |
|---|---:|---:|---:|
| MOUNT-INFRA（最后一批/或留共享） | 9 | 1025 | 4 |
| core/keymap | 20 | 627 | 20 |
| filterDomain | 4 | 420 | 2 |
| itemDomain | 3 | 146 | 2 |
| stage/grid | 4 | 91 | 4 |
| core/navHistory | 7 | 62 | 5 |

### MOUNT-INFRA（最后一批/或留共享）（9 项 / 1025 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `timeoutCache` |  | 108-108 | 1 | - |
| `shimTimeoutInst` |  | 109-109 | 1 | - |
| `getTimeout` | Y | 111-145 | 35 | `shimTimeoutInst`, `timeoutCache` |
| `singletonByScope` |  | 2305-2305 | 1 | - |
| `scopeSingleton` |  | 2306-2311 | 6 | `singletonByScope` |
| `machineryCalls` | Y | 2320-2320 | 1 | - |
| `machinerySeedControllerState` | Y | 2325-2840 | 516 | - |
| `applied` |  | 2842-2842 | 1 | - |
| `applyDataMachineryScope` | Y | 2843-3305 | 463 | `applied`, `getTimeout`, `machineryCalls`, `machineryInitMousetrap`, `machineryReload`, `machinerySeedControllerState`, `machinerySortRawData`, `machineryToggleAll` |

### core/keymap（20 项 / 627 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryBuildMousetrap` | Y | 811-949 | 139 | `getPageUpHandlerFn`, `machineryBack`, `machineryKeyCHandler`, `machineryKeyDownHandler`, `machineryKeyLeftHandler`, `machineryKeyPHandler`, `machineryKeyRightHandler`, `machineryKeyUpHandler` … |
| `machineryInitMousetrap` | Y | 953-974 | 22 | `machineryBuildMousetrap` |
| `machineryKeyCHandler` | Y | 1085-1090 | 6 | - |
| `machineryKeyPHandler` | Y | 1092-1094 | 3 | - |
| `machineryKeyLeftHandler` | Y | 1099-1144 | 46 | - |
| `machineryKeyRightHandler` | Y | 1148-1181 | 34 | - |
| `machineryModUpHandler` | Y | 1186-1198 | 13 | `machineryHomeHandler` |
| `machineryModDownHandler` | Y | 1200-1212 | 13 | `machineryEndHandler` |
| `machineryModLeftHandler` | Y | 1214-1228 | 15 | `machineryPrevHistory` |
| `machineryModRightHandler` | Y | 1230-1244 | 15 | `machineryNextHistory` |
| `machineryKeyUpHandler` | Y | 1297-1411 | 115 | `machineryOpenPrevQuickAccess` |
| `machineryKeyDownHandler` | Y | 1419-1552 | 134 | `machineryOpenNextQuickAccess` |
| `machineryPageDownHandler` | Y | 1569-1581 | 13 | - |
| `machineryPageUpHandler` | Y | 1584-1601 | 18 | - |
| `machineryNHandler` | Y | 1625-1636 | 12 | - |
| `machinerySaveHandler` | Y | 1688-1693 | 6 | - |
| `machineryHomeHandler` | Y | 1993-2002 | 10 | - |
| `machineryEndHandler` | Y | 2006-2016 | 11 | - |
| `getPageUpHandlerFn` | Y | 2313-2313 | 1 | `machineryPageUpHandler`, `scopeSingleton` |
| `getPageDownHandlerFn` | Y | 2314-2314 | 1 | `machineryPageDownHandler`, `scopeSingleton` |

### filterDomain（4 项 / 420 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `semanticSearchController` |  | 366-366 | 1 | - |
| `machineryFilterDataPart3` | Y | 380-696 | 317 | `imageSearchController`, `semanticSearchController` |
| `machinerySearchFilter` |  | 1741-1841 | 101 | - |
| `getToggleFilterByTypeFn` | Y | 2315-2315 | 1 | `scopeSingleton` |

### itemDomain（3 项 / 146 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machinerySortRawData` | Y | 151-249 | 99 | - |
| `machineryReload` | Y | 286-331 | 46 | - |
| `imageSearchController` |  | 365-365 | 1 | - |

### stage/grid（4 项 / 91 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryResetPage` | Y | 727-770 | 44 | - |
| `machineryToggleAll` | Y | 1642-1681 | 40 | `getOffsetScrollbarFn`, `getTimeout` |
| `machineryAutoScroll` | Y | 1908-1913 | 6 | `getTimeout` |
| `getOffsetScrollbarFn` | Y | 2312-2312 | 1 | `scopeSingleton` |

### core/navHistory（7 项 / 62 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `undoTimeout` | Y | 978-978 | 1 | - |
| `machineryUndo` | Y | 1006-1010 | 5 | - |
| `machineryNextHistory` | Y | 1014-1019 | 6 | - |
| `machineryPrevHistory` | Y | 1021-1026 | 6 | - |
| `machineryBack` | Y | 1029-1036 | 8 | `machineryPrevHistory` |
| `machineryOpenPrevQuickAccess` |  | 1251-1262 | 12 | - |
| `machineryOpenNextQuickAccess` |  | 1264-1287 | 24 | - |

## 2. 跨域共享顶层名（≥2 域引用 —— 最后搬或抽共享模块）

- `scopeSingleton`：core/keymap、filterDomain、stage/grid
- `machineryPrevHistory`：core/keymap、core/navHistory
- `machineryToggleAll`：MOUNT-INFRA（最后一批/或留共享）、core/keymap
- `getTimeout`：MOUNT-INFRA（最后一批/或留共享）、stage/grid

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
| `../services/folderCoreService` | { machineryOpenAll, machineryOpenCommunity, machineryOpenRandom, openAllTimeout  |
| `../services/imageOpsService` | { machineryChangeStar, machineryChangeTo1Star, machineryChangeTo2Star, machinery |
| `../services/uploadService` | { machineryOnDropContainer } |
| `./miscDomain` | { cgNotifyServiceCloseAll, getLanguageBCP, machineryEnterDetailMode, machineryLe |

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

