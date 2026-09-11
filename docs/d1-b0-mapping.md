# D-1 / Track B / B-0：dataMachinery.ts 映射表（自动生成）

> 生成器：`tests-tmp/bz-d1-b0-map.py`（只读分析）。施工前请人工复核域归属。

## 0. 总量

- 文件：`src/app/react/core/dataMachinery.ts`，**2588 行**
- 顶层声明：**29**（exported **25** / 私有 **4**）
- import 面：**52** 条
- 引用文件：**30**（`from .../dataMachinery`）

## 1. 域聚类（批次候选）

| 目标域 | 声明数 | 行数（含私有依赖） | 导出数 |
|---|---:|---:|---:|
| MOUNT-INFRA（最后一批/或留共享） | 9 | 1025 | 5 |
| core/keymap | 20 | 627 | 20 |

### MOUNT-INFRA（最后一批/或留共享）（9 项 / 1025 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `timeoutCache` |  | 111-111 | 1 | - |
| `shimTimeoutInst` |  | 112-112 | 1 | - |
| `getTimeout` | Y | 114-148 | 35 | `shimTimeoutInst`, `timeoutCache` |
| `singletonByScope` |  | 1589-1589 | 1 | - |
| `scopeSingleton` | Y | 1590-1595 | 6 | `singletonByScope` |
| `machineryCalls` | Y | 1602-1602 | 1 | - |
| `machinerySeedControllerState` | Y | 1607-2122 | 516 | - |
| `applied` |  | 2124-2124 | 1 | - |
| `applyDataMachineryScope` | Y | 2125-2587 | 463 | `applied`, `getTimeout`, `machineryCalls`, `machineryInitMousetrap`, `machinerySeedControllerState` |

### core/keymap（20 项 / 627 行）

| 名称 | exp | 行区间 | 行数 | 同文件依赖 |
|---|---|---:|---:|---|
| `machineryBuildMousetrap` | Y | 304-442 | 139 | `getPageUpHandlerFn`, `machineryKeyCHandler`, `machineryKeyDownHandler`, `machineryKeyLeftHandler`, `machineryKeyPHandler`, `machineryKeyRightHandler`, `machineryKeyUpHandler`, `machineryModDownHandler` … |
| `machineryInitMousetrap` | Y | 446-467 | 22 | `machineryBuildMousetrap` |
| `machineryKeyCHandler` | Y | 552-557 | 6 | - |
| `machineryKeyPHandler` | Y | 559-561 | 3 | - |
| `machineryKeyLeftHandler` | Y | 566-611 | 46 | - |
| `machineryKeyRightHandler` | Y | 615-648 | 34 | - |
| `machineryModUpHandler` | Y | 653-665 | 13 | `machineryHomeHandler` |
| `machineryModDownHandler` | Y | 667-679 | 13 | `machineryEndHandler` |
| `machineryModLeftHandler` | Y | 681-695 | 15 | - |
| `machineryModRightHandler` | Y | 697-711 | 15 | - |
| `machineryKeyUpHandler` | Y | 728-842 | 115 | - |
| `machineryKeyDownHandler` | Y | 850-983 | 134 | - |
| `machineryPageDownHandler` | Y | 1000-1012 | 13 | - |
| `machineryPageUpHandler` | Y | 1015-1032 | 18 | - |
| `machineryNHandler` | Y | 1056-1067 | 12 | - |
| `machinerySaveHandler` | Y | 1079-1084 | 6 | - |
| `machineryHomeHandler` | Y | 1277-1286 | 10 | - |
| `machineryEndHandler` | Y | 1290-1300 | 11 | - |
| `getPageUpHandlerFn` | Y | 1596-1596 | 1 | `machineryPageUpHandler`, `scopeSingleton` |
| `getPageDownHandlerFn` | Y | 1597-1597 | 1 | `machineryPageDownHandler`, `scopeSingleton` |

## 2. 跨域共享顶层名（≥2 域引用 —— 最后搬或抽共享模块）

（无）

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
| `./itemDomain` | { machineryReload, machinerySortRawData } |
| `./navHistory` | { machineryBack, machineryNextHistory, machineryOpenNextQuickAccess, machineryOp |
| `../services/gridService` | { getOffsetScrollbarFn, machineryToggleAll } |

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

