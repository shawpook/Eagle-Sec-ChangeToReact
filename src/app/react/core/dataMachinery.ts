/**
 * c9 数据机器域——EagleController 内部机器移植（scope 函数替换绞杀）。
 *
 * - **sortRawData（bundle 21621-21708 逐字）**：raw 排序 + updateCurrentOrderAndIncrease。
 *   排序语言依赖 languageBCP → root.language 重算（bundle 20053：`languageBCP = $scope.language.replace("_", "-")`，
 *   初值 "en"（19053）。
 * - **getAncestorFolders（bundle 42508 逐字）/ getExtendTags（32028 逐字）**：controller 闭包函数 → 域内移植。
 *
 * - **c9b rebindRefresh 域**：
 *   - rebindRefresh（27366-27454 逐字；async）：calcuteFilterResult 置顶排序 allData/filtereds
 *     重建 + refreshSubfolderList + keywordDebounce 梯度 + updateItemsView + 网格重置 +
 *     HoverPreview 隐藏。calcuteFilterResult/calcuteContainTags/refreshSubfolderList/
 *     updateItemsView 仍由 bundle 承载（经 scope 解析，后续片接管）；resetNgGridLayoutData
 *     为 ngGridLayout 指令 66970 隐式全局（window.*）；calcuteFilterBadge 为域内移植版。
 *   - calcuteFilterBadge（27522-27633 逐字；controller 闭包函数）：纯 eagle.filter.filterBadge
 *     计数（标签/颜色/类型/相机/星等/字体/时间/BPM/标注/网址/以图找图/语义）。
 *   - filterSidebarItem（37967-38001 逐字；controller 闭包函数）：chineseConvert/cartesianProduct/
 *     pinyinlite（re-require 十行成员）+ _.uniq/_.max + String.prototype.score（bundle 2621）。
 *   - rebindRefreshLazy（27007-27013 逐字；1000ms 防抖）/ updateSidebarList（42545-42617 逐字；
 *     20ms 防抖）——rebindRefreshLazyTimeout/updateSidebarListTimeout 域内自管。
 *
 * - **c9c 视图/加载域**：updateItemsView（35065-35072 逐字）、switchLayout（33790-33846 逐字；
 *   relayout/offsetScrollbar/initMenu 经 scope 解析）、prependImages（30524-30538 逐字）+
 *   resetImageData（30540-30548 闭包函数；prependImagesTimeout 域内自管）、reload（42867-42918
 *   逐字；_.debounce(fn,100,true) leading-edge，实例一次性创建）+ autoResizeTagFilter（43119-43128
 *   闭包函数）。
 *
 * - **c9d 缩放/放映/计数/最近文件夹**：getRatioExp（31336）/ getRatioNonExp（31343）纯函数、
 *   updateZoomRatio（31391-31418 逐字；smoothZoom vendor 插件、updateZoomRatioTimeout 域内
 *   自管）、toggleSlideshow（23816）、smartFolderCount（46646；existInSmartFilter/lockImageFilter
 *   经 scope 解析）、getRecentFolders（31969；localStorage recentMoveFolders 逐字键）。
 *   注：unlockPassword 为 scope 字段（非函数），React 侧 5 处读写经桥接/字段解析，无需移植。
 *
 * - **c9e 单条目视图机**：updateItemView（34847-35063 逐字；updateItemsView 循环体）——
 *   metas 十分支（RESOLUTION/FILESIZE/TYPE/MTIME/BTIME/TAGS/RATING）+ 选中/标记/旋转类/
 *   字体激活状态 DOM 更新；依赖 window.* 全局（fileSize/fontFolder/sanitize/installedFonts/
 *   i18n/VIDEO_TYPES 等）+ $filter 经 injector + fs 经 window.require('fs')。checkTouchIDSupport
 *   （29002-29010 逐字）一并替换（React lockState 与 bundle 29014/29109 调用点共用）。
 *
 * - **calculateImageBinding（bundle 28684-28965 逐字）**：核心重建机——duration 1/50 退避逻辑
 *   （重入时退避 50ms）、TagManager.azGroups → $timeout.cancel、$timeout(work,duration)、
 *   work = raw 检查 + sortRawData + 全部 resets + 三次 tree.walk（folderMappings/folderList/pinyin/
 *   tagsSuggestion/ancestorsCache、extendTags/covers、smartFolderMappings）+ raw 循环（itemMappings/
 *   trash/all/exts/untaggedCount/unfiledCount/folders 修复/lockedImages/tags 计数/封面 default map）+
 *   extList→eagle.filter.filterTypes + covers 补全 walk + TagManager.rawdata/pinyinCache/calculateTags +
 *   s.tags + timeEnd + callback + catch）。pinyinCache/calculateImageBindingTimeout 原为 controller
 *   闭包变量 → 域内自管。**scope 函数替换后**，bundle 侧 muteCalcuteImageBinding 等全部
 *   `$scope.calculateImageBinding(...)` 调用面即走本实现（绞杀内部机器）。
 *
 * - **有意略去（无副作用，注释标注）**：`var path = require('path');`（原文内从未使用）。
 *
 * 外部依赖经 window.* live binding（eagle/tinyPinyin/_/FileUrlHelper/AUDIO_TYPES/electronLog），
 * TagManager 经 scope 字段（bundle 48351 `$scope.TagManager = TagManager`）；updateCurrentOrderAndIncrease
 * 复用 controllerFns 移植版（getBodyScope 后端）；$filter/$timeout 经 injector 注入（Angular digest 语义不变）。
 */

import { detailZoom, ensureDetailZoom } from './smoothZoomEngine';
import { machineryBuildTagManager } from './tagManagerDomain';
import { FolderSelectPanel } from '../components/stage7/selectPanelEngine';
import { updateCurrentOrderAndIncrease } from './miscDomain';
import { isInFolder } from './itemDomain';
import { gridSaveListHeight, gridAdjustLayoutWidth, gridZoomFit, gridZoomIn, gridZoomOut, gridSwitchLayout } from '../services/gridService';
import { detailUpdateZoomRatio, detailSmartZoom, detailToggleDetailMode, beginZoomingTransition } from '../services/detailService';
import { machineryAddVideoComment, machineryNextGifFrame, machineryPrevGifFrame, machineryRememberVideoCurrentTime, toggleGifPlay } from '../services/mediaService';
import { debounce, throttle } from '../utils/func';
import { get, isString, max, uniq, unescape, isNumeric } from '../utils/lang';
import { q, qa, qaVisible, widthOf, heightOf, addClass, removeClass, setAttr, cssSet, hide, show, setHtml, hasClass, setHtmlEl, textEl, triggerEl, selectText, onEl, offEl, trigger, clickEl, focusEl, blurEl, selectEl, scrollTopValue, setScrollTop, setScrollLeft, offsetOf, offsetTopOf, outerHeightOf, getAttr, setAttrEl, addClassEl, removeClassEl } from '../utils/domQuery';
import { syncFolderLock } from '../store/lockState';
import { syncUploadFromScope } from '../store/uploadState';
import { syncListFromScope } from '../store/listState';
import { syncPanelFromScope } from '../store/panelState';
import { syncSidebarFromScope } from '../store/sidebarState';
import { syncTagManagerFromScope } from '../store/tagManagerState';
import { syncFilterFromScope } from '../store/filterState';
import { syncBodyFromScope } from '../store/bodyState';
import { syncDetailFromScope } from '../store/detailState';
import { syncInspectorFromScope } from '../store/inspectorState';
import { syncToolbarFromScope } from '../store/toolbarState';
import { getBodyScope } from './appCore';
import { callExternal } from './externalSupply';
import { openFolder, openSmartFolder } from '../services/folderCoreService';
import { select } from '../services/selectionService';
import { uploadFiles } from '../services/uploadService';
import { getRatioExp } from '../services/viewOpsService';
import { resetFilter } from './filterDomain';
import { addToRecentFolders } from '../services/batchOpsService';
import { saveCrop } from '../services/imageOpsService';
import { moveCropToolChannel, openRenameChannel, resizeCropToolChannel } from './../global/bus';
import { autoscrollChannel, calculateImageBindingChannel, glRemoveitemsChannel, importArtstationChannel, inspectorTagSelectPanelOpenChannel, newSmartFolderChannel, openDuplicateScanPanelChannel, openMousewheelPreferenceWindowChannel, openPluginPanelChannel, openUrlInPanelChannel, rebindRefreshChannel, updateInspectorChannel, updateSelectionChannel } from '../global/bus';
import { scopeEvalAsync } from '../global/scopeShim';
import { emojiRegex, escapeRegex, getRemainingFilenameLength, getSanitize, pinyinCache } from '../utils/normalize';
import { machineryColorSimilarityDistance, machineryRgbToHex } from '../utils/color';
import { machineryCloseWindowHandler, machineryDestoryMousetrap, machineryMHandler, machineryModShiftDownHandler, machineryModShiftLeftHandler, machineryModShiftRightHandler, machineryModShiftUpHandler, machineryOpenActionsPanel, machineryOpenQuickSearch } from './keymapActions';
import { machineryBatchRenameFolders, machineryBatchRenameSmartFolders, machineryGetAncestorFolders, machineryGetChildFoldersMaps, machineryGetFolderImages, machineryGetRecentFolders, machineryRefreshRandom, machineryRenameFolder, machineryRenameSmartFolder, machinerySaveFolder } from './libraryDomain';
import { buildScrollbarSaver, machineryAdjustLayoutWidth, machineryChangeListHeight, machineryCurrentIndex, machineryGetArroundBox, machineryGotoBottom, machineryGotoTop, machineryOffsetScrollbar, machineryRelayout, machineryRememberScrollTops, machinerySaveListHeight, machineryScrollbarTo, machinerySwitchLayout, machineryUpdateContainerHieght, machineryUpdateListHeight, machineryUpdateListSlider } from '../services/gridService';
import { machineryCheckOperationSafety, machineryCheckOperationSafety2, machineryGetRatioExp, machineryGetRatioNonExp, machineryLastZoom, machinerySetViewMode, machineryToggleZoom, machineryUpdateZoomRatio, machineryZoom, machineryZoomFitEdge, machineryZoomIn, machineryZoomOut } from '../services/viewOpsService';
import { buildRecentFileManager, machineryAddToRecentFile, machineryGetAllChildFolder, machineryOpenNextFolder, machineryOpenNextSmartFolder, machineryOpenParentFolder, machineryOpenPrevFolder, machineryOpenPrevSmartFolder, machineryOpenRecent, machineryOpenTrash, machineryOpenUnfiled, machineryRemoveFolder, machineryRemoveFolderContents, machineryRemoveFolderInner, machineryRemoveSmartFolder, machineryRemoveSmartFolderInner, machineryResetFolderCover, machinerySetFolderCover, machinerySetLastFolder, machinerySmartFolderCount, machineryToggleAllFolders, machineryToggleCurrentLevelSmartFoldersInner, machineryUpdateSidebarList, openRecentTimeout, openTrashTimeout, openUnfiledTimeout, updateSidebarListTimeout } from './libraryDomain';

import { calculateImageBindingTimeout, machineryCalculateImageBinding, machineryCopyImages, machineryCreateTxtFileFromTemplate, machineryFindDupclipate, machineryForceFitImageSize, machineryGetItemByElement, machineryHideUploadQueue, machineryOnImageSizeHeightChanged, machineryPreloadImage, machineryPrependImages, machineryRebindRefresh, machineryRebindRefreshLazy, machineryShowUploadQueue, machinerySortData, machineryToggleCommentMode, machineryUpdateItemsView, prependImagesTimeout, rebindRefreshLazyTimeout } from './itemDomain';

import { FILTER_ID_MAP, calculateFilterCountsTimeout, getFilter, machineryCalculateFilterCounts, machineryCalcuteFilterBadge, machineryCalcuteFilterResult, machineryColorFilter, machineryContentFilter, machineryExistInSmartFilter, machineryFilterContent, machineryFilterData, machineryGrayColorFilter, machineryToggleFilterByType, machineryUpdateFilterCounts } from './filterDomain';
import { machineryAutoResizeTagFilter, machineryConvertToRegexGroup, machineryMatchWithRegexGroup, machineryOpenAllTags, machineryOpenNextGroup, machineryOpenPrevGroup, machineryOpenUntagged, machineryRefreshSubfolderList, machineryRemoveTagGroup, machineryUpdateSubFolderWidth, openUntaggedTimeout, tagRectSelecting } from './tagManagerDomain';
import { machineryGetSelectedItemElements, machineryMultipleSelectDown, machineryMultipleSelectNext, machineryMultipleSelectPrev, machineryMultipleSelectUp, machineryOpenInspectorFolderSelectPanel, machineryOpenInspectorTagSelectPanel, machineryRemoveSelected, machinerySelectAll, machinerySelectDown, machinerySelectNext, machinerySelectPrev, machinerySelectUp, machineryUpdateSelection } from './selectionViewDomain';
import { machineryOpenAll, machineryOpenCommunity, machineryOpenRandom, openAllTimeout } from '../services/folderCoreService';
import { machineryChangeStar, machineryChangeTo1Star, machineryChangeTo2Star, machineryChangeTo3Star, machineryChangeTo4Star, machineryChangeTo5Star, machineryRemoveStar } from '../services/imageOpsService';
import { machineryOnDropContainer } from '../services/uploadService';
import { cgNotifyServiceCloseAll, getLanguageBCP, machineryEnterDetailMode, machineryLeaveDetailMode, machineryNotify, machineryOpenPluginPanel, machineryQuicklook, machineryToggleDetailMode, machineryToggleSlideshow } from './miscDomain';
import { machineryReload, machinerySortRawData } from './itemDomain';
import { machineryBack, machineryNextHistory, machineryOpenNextQuickAccess, machineryOpenPrevQuickAccess, machineryPrevHistory, machineryUndo } from './navHistory';
import { getOffsetScrollbarFn, machineryToggleAll } from '../services/gridService';






import { applyDataMachineryScope } from './machineryInfra';
/* ── c9b：rebindRefresh 域 ───────────────────────────────────────────── */

/* calcuteFilterBadge（bundle 27522-27633 逐字；controller 闭包函数 → 域内移植。
   纯 eagle.filter.* 读写，无 scope 依赖） */

/* filterSidebarItem（bundle 37967-38001 逐字；controller 闭包函数 → 域内移植。
   依赖 chineseConvert/cartesianProduct/pinyinlite（re-require 十行成员，window.* live binding）、
   _.uniq/_.max（vendor 全局）、String.prototype.score（bundle 2621 原型扩展）） */

/* rebindRefresh（bundle 27366-27454 逐字；async。calcuteFilterResult/calcuteContainTags/
   refreshSubfolderList/updateItemsView/getFolderList 等仍由 bundle 承载，经 scope 解析；
   resetNgGridLayoutData = ngGridLayout 指令 66970 隐式全局赋值（window.*）；HoverPreview
   顶层 var（51689）→ window.*；calcuteFilterBadge 为域内移植版） */


/* updateSidebarList（bundle 42545-42617 逐字；20ms 防抖，updateSidebarListTimeout 域内自管。
   getFolderList/getSmartFolderList/getQuickAccessList 仍由 bundle 承载经 scope 解析；
   filterSidebarItem 为域内移植版） */

/* ── c9c：视图/加载域 ───────────────────────────────────────────────── */


/* b1-9be：switchLayout 实现体归位 services/gridService.ts（body class 四分支 +
   relayout/offsetScrollbar/initMenu 仍经 scope 解析） */


/* prependImages（bundle 30524-30538 逐字；prependImagesTimeout 域内自管。
   原码 updateView 参数未使用，逐字保留签名） */


/* reload（bundle 42867-42918 逐字；_.debounce(fn, 100, true) leading-edge 防抖原样复刻，
   防抖实例在 applyDataMachineryScope 时一次性创建（与 bundle controller init 同语义）。
   leaveDetailMode/relayout/updateSelection/calculateFilterCounts/updateSubFolderWidth/
   adjustLayoutWidth 仍由 bundle 承载经 scope 解析；rebindRefresh 已是移植版（scope 解析即达）） */

/* ── c9d：缩放/放映/计数/最近文件夹 ──────────────────────────────────── */



/* updateZoomRatio（bundle 31391-31418 逐字；smoothZoom = vendor jQuery 插件；
   updateZoomRatioTimeout 域内自管） */




/* updateItemView（bundle 34847-35063 逐字；单条目 DOM 更新机——updateItemsView 循环体。
   依赖：window.* 全局（$/FileUrlHelper/fileSize/fontFolder/sanitize/installedFonts/i18n/
   VIDEO_TYPES/AUDIO_TYPES/FONT_TYPES/SPECIAL_TYPES）、$filter 经 injector（duration/domainName/
   date）、fs 经 window.require('fs')、TagManager/listMetaType 经 scope 字段） */

/* checkTouchIDSupport（bundle 29002-29010 逐字；systemPreferences 经 @electron/remote。
   原码 quirk 逐字保留：非 darwin 平台不写 canUseTouchID（无 else 分支）。bundle 29014/29109
   调用点与 React lockState 流共用本实现） */

/* relayout（bundle 27329-27364 逐字；be2 起 ig = window.ig facade（v4 引擎），布局选项
   经 setLayout(label, opts) 通知 facade——v4 sizeRange/gap 由 BoxList 渲染时从 scope 派生） */

/* ── c14：智能文件夹规则匹配域 ───────────────────────────────────────── */

/* MATCH_FUNCTION 表（bundle 32117-32143 逐字；26 规则函数经 window 解析——bundle 8369-9418
   顶层函数（b1 后由 public/vendor/eagle-match-rules.js script 注入供给）） */



/* ── c14b：筛选引擎（filterData 27654-28504 逐字分片）────────────────── */


/* filterData 分片 1：import 月份/时间、mtime、类型含排、档案大小、长度、BPM、解析度、
   标注、注释（27654-27960 逐字） */

// ── APPEND:c14b-2 ──

/* filterData 分片 2：注释/网址/方向/星等/字体/相机/颜色/关键字/已删排序/random 预筛
   （27960-28170 逐字） */

// ── APPEND:c14b-3 ──

/* filterData 分片 3：标签 OR/AND/EQUAL、文件夹 OR/AND/EQUAL、lockedImages、排序、
   以图找图/语义搜索、recent 排序（28170-28504 逐字） */



/* ── c14c：contentFilter / calcuteContainTags / RecentFileManager ───────── */


/* contentFilter（bundle 31804-31896 逐字；isInFolder 复用 controllerFns 移植版，
   RecentFileManager 经 window 解析） */



/* ── c15：选择广播 + 缩放分发 ────────────────────────────────────────── */





/* ── c15b：列表高度/缩放适配 ─────────────────────────────────────────── */

/* b1-9bd：saveListHeight 实现体归位 services/gridService.ts——此处仅存委托壳
   （machinery 内部其余 2 处直调点与 scope 挂载面不变）。 */



/* ── c15c：选择定位/侧栏索引/页面重置/筛选计数 ───────────────────────── */



/* resetPage（bundle 36668-36700 逐字；resetFilter/findDupclipate 经 scope 解析，
   eagle.inspector.reset 经 c12 挂载面，ig.clear 经 window） */

/* calculateFilterCounts（bundle 42929-42944 逐字；calculateFilterCountsTimeout 域内自管，
   updateFilterCounts 经 scope 解析） */

/* ── c15d：openAll 及支撑链 ──────────────────────────────────────────── */


/* setViewMode（bundle 38475-38479 逐字；_.debounce 500——防抖实例为模块级单例，与 bundle
   controller init 同语义） */




/* openAll（bundle 36702-36733 逐字；openAllTimeout 域内自管；UrlStateService 经 scope
   解析（bundle 20208 $scope 赋值）——post-b1 Angular $location 缺席为诚实缺口，该服务
   移植随 c16 详情族定 $location shim 方案） */

/* ── c16a：详情模式进出 ──────────────────────────────────────────────── */


/* enterDetailMode（bundle 31587-31664 逐字；smoothZoom = vendor jQuery 插件；
   lastZoom/preloadImage/addToRecentFile 经 scope 解析；removePlayingAudios/HoverPreview
   经 window（bundle 顶层——b1 后随 hover-preview 字节提取片供给）；initDetailMode/
   smoothZoomDone 为 scope 字段） */

/* leaveDetailMode（bundle 31680-31726 逐字；rememberScrollTops/rememberVideoCurrentTime/
   fadeOutDetailMode/initMousetrap 经 window/scope 解析——initMousetrap 归键盘域后续片；
   gifUpadteInterval 原码 typo 逐字保留） */

/* ── c16c：saveFolder ────────────────────────────────────────────────── */

/* saveFolder（bundle 42399-42467 逐字；cloneTree 经 window（c10a-2）、IPCHelper 经
   window（shims 顶层词法上 window，libraryDomain 同一消费模式）、appRoot.path = app-root-path
   模块的 path 属性、TagManager 经 scope） */

/* ── c16d：键盘域（buildMousetrap/destoryMousetrap/initMousetrap）──────── */

/* buildMousetrap（bundle 49177-49314 逐字；handlers 全部 $scope.* → s.*；preferences 经
   window（var live binding）、ShortcutManager/Mousetrap 为 vendor script（b1 存活）。
   返回 bindings 映射——由 mgo-mousetrap 指令消费绑定，与 bundle 同语义） */


/* ── c17b：notify（cgNotify 服务等价移植）────────────────────────────── */

/* undoTimeout 已于 B-15 随 machineryNotify 归位 miscDomain（唯一写方） */

/* angular-notify.html 模板（bundle 16724 templateCache 逐字；ng-class/ng-style/ng-show/
   ng-click 以具体值物化） */


/* notify（$rootScope.notify 20157-20191 + cgNotify 服务核心 16724 等价移植。
   ng-click="closeAll();undo();" 以委托 click 复刻（undo = $rootScope.undo 桩，duration+5000
   后置空，undoTimeout 域内自管）；templateUrl '' → bundle 走 $http 缓存缺省模板，本移植直接
   物化同一模板 DOM） */


/* ── c18a：smartZoom/lastZoom（详情智能缩放）──────────────────────────── */


/* smartZoom（bundle 31209-31334 逐字；devicesMetrics/isMobileResolution/getImagePixelDensity/
   isMobileWidth 经 window（c18a 供给），zoomRatio 换算走 machinery 版） */

/* ── c18b：详情缩放余部（zoomActual/toggleZoom/zoomFitEdge/updateContainerHieght）── */





/* ── c18c：历史导航/撤销 ─────────────────────────────────────────────── */

/* undo（bundle 26999-27002 逐字；$rootScope.undo 桩 + closeAll——root 上无 closeAll 时
   走 cg 栈清屏等价） */

/* nextHistory/prevHistory（bundle 38566-38577 逐字；UrlStateService.canGo* 方法存在性
   判定原样保留，goForward/goBack 经 currentWindow） */



/* ── c18d：全选/详情切换 ─────────────────────────────────────────────── */



/* toggleDetailMode（bundle 31005-31029 逐字；saveCrop/renameCurrentFolder/openFolder
   经 scope 解析） */

/* ── c18e-1：选择导航（selectNext/selectPrev）────────────────────────── */


/* selectNext（bundle 36382-36444 逐字；getSelection/lastZoom 已 machinery 版经 scope 解析，
   autoScroll/forceFitImageSize/preloadImage/addToRecentFile 为 bundle scope 函数经 scope 解析） */

/* selectPrev（bundle 36502-36552 逐字；首项 is-first-item 提示 + allData 空守卫 +
   详情模式 cleanBitmapViewer + start-1 越界回落 allData[0]） */

/* ── c18e-2：多选系（multipleSelect 四件套）──────────────────────────── */



/* multipleSelectNext（bundle 36559-36585 逐字：sidebar 焦点守卫 + 详情模式跳过 +
   start < lastSelectedIndex 时收缩选区否则扩展 + autoScroll 经 scope） */

/* multipleSelectPrev（bundle 36586-36613 逐字：end > lastSelectedIndex 时收缩否则
   向 start-1 扩展） */

/* ── c18e-2b：removeSelected（46118-46343）───────────────────────────── */


/* removeSelected（bundle 46119-46343 逐字；removeSelectedFolders/removeFolder/
   removeFolderContents/checkOperationSafety/removePermanently/resetFolderCover/
   updateFilterCounts/getSelectedItemElements/updateSelection 等 bundle scope 函数经
   scope 解析；TagManager 经 scope 字段（48351）；$filter('i18n') 走 getFilter()；
   swal/i18n/ScrollbarSaver/ayncsImagesChange/hiddenByCurrentFilter/electronLog 经 window） */

/* ── c18e-3：quicklook/copyImages ───────────────────────────────────── */

/* quicklook（bundle 33542-33580 逐字；toggleGifPlay/toggleDetailMode/pageDownHandler 经
   scope 解析；IPCHelper 为脚本级词法绑定（c17a if-absent 接装）经 window；analytics 顶层
   var（105501）/process/swal 容器经 window） */

/* copyImages（bundle 31747-31795 逐字；clipboard 为 renderer 全局（controllerFns 同款裸引）；
   ipcRenderer 统一表达式；RecentFileManager if-absent 接装经 window；notify 走 machinery 版） */

/* ── c18e-4：方向键/修饰键 handler 族（第一批）───────────────────────── */



/* keyLeftHandler（bundle 35107-35146 逐字：swal 容器守卫 + content→selectPrev(machinery 版) +
   tags→焦点回落 sidebar + sidebar 文件夹/smart 文件夹折叠（多选折叠与单选展开-折叠分叉），
   localStorage 键逐字） */

/* keyRightHandler（bundle 35148-35189 逐字：content→selectNext + sidebar 多选展开/单选展开 +
   alltags→焦点 tags，localStorage 键逐字） */

/* mod 八件套（bundle 35343-35438 逐字：crop 模式→RESIZE-CROP-TOOL 广播（mod 上下 1/
   shift 上下左右 10），否则 mod 上/下委派 homeHandler/endHandler（scope 函数 35636/35650）、
   mod 左/右详情外委派 prevHistory/nextHistory（machinery 版）、modShift 纯 crop 广播） */




/* ── c18e-5：keyUp/keyDown handler 族（含侧栏导航闭包）───────────────── */

/* 域内闭包移植（原 controller 内 function 声明，非 scope 成员）：
   openPrevQuickAccess（35287-35302）/ openNextQuickAccess（35304-35341）/
   openPrevGroup（35704-35725）/ openNextGroup（35730-35752） */




/* keyUpHandler（bundle 35191-35285 逐字：content→crop 广播/moveY -150/selectUp +
   sidebar 清空选择后按 viewMode 七级回落（all 分支为空体、unfiled→openAll、untagged→
   unfiled/all、recent→untagged/unfiled/all、random→recent/untagged/unfiled/all、
   community→random/recent/untagged/unfiled/all、alltags→community/random/recent/untagged/
   unfiled/all 偏好门控、trash→openAllTags）+ currentId 三分（smart-folder/quick/folder，
   注意含 currentId 真值守卫）+ tags→openPrevGroup） */

/* keyDownHandler（bundle 35440-35610 逐字：content→crop 广播/moveY 150/selectDown +
   sidebar 清空选择后按 viewMode 七级回落（all→unfiled/untagged/recent/random/community/
   allTags、unfiled→untagged/recent/random/community/allTags、untagged→recent/random/
   community/allTags、recent→random/community/allTags、random→community/allTags、
   community→allTags 偏好门控、alltags→openTrash、trash→quickAccess→smartFolders→folders）
   + currentId 三分（**无 currentId 真值守卫，bundle 原样**）+ tags→openNextGroup） */

/* ── c18e-6：selectUp/Down + pageUp/pageDownHandler（滚动翻页面）──────── */


/* scrollbarTo（bundle 35612-35635 逐字）+ Math.easeInOutQuad（35638-35643 逐字；bundle 于
   controller init 补丁全局 Math，此处同体幂等补丁） */
(Math as any).easeInOutQuad = function (t: any, b: any, c: any, d: any) {
  t /= d / 2;
  if (t < 1) return c / 2 * t * t + b;
  t--;
  return -c / 2 * (t * (t - 2) - 1) + b;
};


/* pageDownHandler（bundle 35680-35689 逐字）——_.throttle 实例 apply 时一次性创建
   （与 bundle controller init 同语义），shift+space 绑定消费 */


/* selectUp（bundle 35840-35906 逐字：GridLayout 同列最近上方盒 / 其他布局上方 20px 外
   最近距离盒，selected 首盒为锚点）+ selectDown（35908-35962 逐字：getArroundBox(end) 邻域 +
   selected 末盒为锚点；**autoScroll(target) 传元素非索引，bundle 怪癖逐字保留**；
   getItemByElement 经 scope 解析） */


/* ── c18f-1：小 handler 批（评分/视频键/侧栏开关/缩放步进/保存/随机刷新）── */


/* removeStar/changeTo1Star…changeTo4Star（bundle 30292-30314 逐字补齐——b1-9ay：c18f-1 批
   此前仅落了 changeTo5Star，mousetrap '0'-'4' 五键绑定期读到 undefined，按键即
   TypeError: func is not a function（sweep B5/B6 实锤）） */





/* closeWindowHandler（bundle 30802-30812 逐字；**bundle 原版怪癖：参数名为 $event 但体内
   引用全局 event——ESM 经 w.event 复刻同语义**（mousetrap 派发期内 window.event 即键盘事件）；
   IPCHelper 脚本级词法绑定（c17a 接装）经 window） */
/* nHandler（bundle 30813-30824 逐字：详情内视频/音频添加视频评论；VIDEO_TYPES/AUDIO_TYPES
   经 window（Tier-1 TYPES 契约），addVideoComment 经 scope 解析） */

/* toggleAll（bundle 30968-31003 逐字：侧栏+检查器联动开合（eagle.inspector.isHideInspector
   双写）+ lastItemStates 清空 + orientationchange + boxContianerWidth/Height 快照 + relayout/
   offsetScrollbar + 详情 edge 模式 zoomFitEdge（**裸 event 怪癖：$timeout 回调期 window.event
   为 null，以 w.event 复刻**）+ isHideSidebar localStorage 键逐字 + electronLog 双分支） */

/* b1-9bd：zoomIn/zoomOut 实现体归位 services/gridService.ts（详情分支的 ratio 梯度
   仍经 scope 解析 getRatioExp/getRatioNonExp/updateZoomRatio，S4 详情竖切归位） */



/* refreshRandom（bundle 42824-42837 逐字：random 视图/RANDOM 排序守卫 + shuffle 清空 +
   refresh-random active 闪烁 50ms + reload（machinery 版经 scope）） */

/* ── c18f-2：openParentFolder/createTxtFileFromTemplate/setFolderCover ── */


/* createTxtFileFromTemplate（bundle 37329-37334 逐字；newFileFromTemplate 为 bundle scope
   函数经 scope 解析——文件创建域后续独立切片） */

/* setFolderCover（bundle 41438-41454 逐字；FileUrlHelper 经 window、getFilter() 复刻
   $filter('i18n')、notify/saveFolder 走 machinery 版） */

/* ── c18f-3：inspector 面板/快捷搜索打开器（D-1 B-3 已归位 core/keymapActions.ts）── */

/* openInspectorTagSelectPanel（bundle 43283-43287 逐字；body scope 生效版——54887 系为
   其他 controller 的 $bodyScope 委派壳） */

/* openInspectorFolderSelectPanel（bundle 43288-43448 逐字：FolderSelectPanel.open 参数组
   （ folders/selectedIds/onChanged：checkOperationSafety 包装 → selectedFolderIds/deselected
   FolderIds 分拣 → addToRecentFolders → origin 四联快照 → eagle.utils.tree.walk 添加/删除
   双分支（extendTags 传染、ig.remove + imagesMappings、updateFilterCounts）→ ayncsImagesChange/
   hiddenByCurrentFilter → unfiled 分支 gl:removeItems → calculateImageBinding/rebindRefresh/
   updateSelection → i18n 单复数两形态（复数走 getFilter()，单数逐字 angular.injector 链）→
   notify undo 四字段回滚 → electronLog + analytics 'File','Categorize','QuickCategorize'）。
   FolderSelectPanel 为 bundle 顶层 class（55801，词法绑定不上 window）→ 直连 React 移植版
   selectPanelEngine 的 static open（同 rootScope $broadcast 语义，bundle 在世/缺席双期兼容）；
   体内 $bodyScope.* 引用逐字保留（= 真身 body scope，w.$bodyScope）。 */

/* ── c18g-1：getItemByElement/changeStar/gif 帧步进/addVideoComment/newFileFromTemplate ── */

/* getItemByElement（bundle 21834-21839 逐字：data-box-id 属性 → itemMappings；含
   element.id.replace("box-") 旧实现注释逐字保留） */

/* changeStar（bundle 30320-30381 逐字：空选守卫 + 零星单选无星守卫 + checkOperationSafety
   包装两分支——刪除星星（filterCounts rating 0/原星数增减 + delete image.star）与设置星星
   （原星数减/new 星数增/rating 0 减 + eagle.inspector.star 记录）+ i18n 通知 + analytics +
   updateItemsView（machinery 版）+ ayncsImagesChange/hiddenByCurrentFilter） */

// ── b1-9ab：searchFilter 管线移植（bundle 29211-29346 + 32182-32283 逐字）──
// 此前 s.searchFilter 无定义：machineryFilterContent 的 `data.filter(s.searchFilter)`
// 在非空关键词时抛 TypeError，被 $timeout shim 的 try 吞掉 → 关键词搜索静默失效
// （11a49 的非空用例期望空结果，崩了也空，断言空洞通过）。scopeShim get 无 fns 回退，
// 故走 machinery 赋值面（colorFilter/grayColorFilter 同类缺口另批处理）。




// ── b1-9ad：颜色筛选管线移植（bundle 32688-32813 逐字；$scope→s）──
// 此前 s.colorFilter/s.grayColorFilter 无定义：machineryFilterContent 的
// `data.filter(s.colorFilter)` 在开启颜色筛选时抛 TypeError 被吞、黑白筛选同理，
// 且 colorDistancesMap 排序比较器恒空。
// D-1 B-2：machineryColorSimilarityDistance / machineryRgbToHex 已归位 utils/color.ts
// （color-convert/delta-e 依赖随之迁出）。




/* filterContent（bundle 32583-32589 逐字；$scope→s。b1-9p 补端口——重新计算画面图片
   列表的统一入口：keyword watcher / eagle.filter 规则 watcher / 显示隐藏切换都汇聚到它，
   本体只是「清 shuffle + rebindRefresh(contentFilterCache) + 滚动归零」的编排） */

/* nextGifFrame/prevGifFrame（bundle 32838-32863 逐字：gifPlayer/gifViewer 经 scope 解析；
   **next 帧越界上界为 total-1、prev 下界 0——bundle 原样**） */
/* addVideoComment（bundle 21182-21237 逐字：swal textarea（i18n 经 window）→ guid（Tier-2）
   构造 comment（duration/annotation）→ current.comments 插入 + duration 升序排序 →
   REFRESH_VIDEO_COMMENTS 广播 + updateItemView（scope 解析）+ ipcRenderer 统一表达式
   send('image-change')） */
/* newFileFromTemplate（bundle 37336-37374 逐字：resourcesPath/EAGLE_THUMBNAIL_TEMP_PATH 为
   bundle 顶层 var 经 window、fs/path 经 window.require、i18n/FileUrlHelper 经 window、
   uploadFiles/showUploadQueue 经 scope 解析、electronLog 兜底 catch） */

/* ── c18g-2：视图开启器族（random/unfiled/untagged/recent/community/allTags/trash）── */


/* openRandom（bundle 36740-36770 逐字：同视图+有色规则外早退（callback/leaveDetailMode）+
   resetPage + image-drop-area 隐藏 + 50ms timeout（UrlStateService setState + random 专用
   thumbSize 键 + setLastFolder/updateListHeight **不调** + scrollTop 0 + reload + callback +
   screenView）——**本开启器无 ScrollbarSaver 存取，bundle 原样**） */

/* openUnfiled（bundle 36774-36802 逐字：早退 + ScrollbarSaver 存取 + unfiled thumbSize 键 +
   updateListHeight + restoreScrollPosition + screenView） */



/* openCommunity（bundle 36866-36888 逐字：community 面板 iframe 化——images 清空 + 详情退出 +
   lng2locale 三语映射 + OPEN_URL_IN_PANEL 广播 + leaveDetailMode（经 $bodyScope 逐字）） */

/* openAllTags（bundle 36889-36911 逐字：同视图有色早退 + ScrollbarSaver 存 + rebindRefresh +
   TagManager.renderTagsResult（scope 字段 TagManager，48351）50ms 延迟——**无 imageSize/
   reload 面，bundle 原样**） */

/* openTrash（bundle 36969-36996 逐字：早退 + ScrollbarSaver 存取 + trash thumbSize 键 +
   updateListHeight + screenView） */

/* ── b1-3：侧栏 prev/next 导航（folder/smartFolder 四向）──────────────── */

/* openNextFolder（bundle 35689-35701 逐字：sidebarList folder 过滤 → 当前索引 +1 →
   openFolder + changeSidebarIndex（machinery 版）） */

/* openPrevFolder（bundle 35806-35835 逐字：folder -1；越界回落 smartFolders 末项 →
   quickAccess 末项（#quick-access-{id} click）→ openTrash） */

/* openNextSmartFolder（bundle 35755-35774 逐字：smartFolder(smartFolderGroup 含) 当前 +1 →
   越界回落 folders 首项） */

/* openPrevSmartFolder（bundle 35775-35804 逐字：smartFolder -1 → 越界按
   preferences.sidebar.quickAccess 门控走 quickAccess 末项或 openTrash） */

/* ── b1-4a：滚动/列表辅助族（第一批）─────────────────────────────────── */

/* autoScroll（bundle 35086-35091 逐字：AutoScroll 广播 50ms 延迟；**注意 54389 系
   $bodyScope 委派壳属子 scope controller，body scope 生效版即本闭包**） */


/* getSelectedItems（bundle 21852-21862 逐字：ig.getItems(true) × selectedMappings 过滤，
   含旧实现注释逐字保留） */





/* checkListItemsLessThanContainer（bundle 33658-33674 逐字：<180 项时 500ms 后量
   box-list 高度不足一屏则 ig.trigger("append") 一次載入兩頁） */

/* updateSubFolderWidth（bundle 33676-33688 逐字：容器宽 → 列数 → 38+10col 修正 →
   5 取整 → 下限 90 → MAX_LIST_WIDTH 封顶 → imageSize.subfolderWidth） */


/* changeListHeight（bundle 33746-33785 逐字：5 取整 + lastImageHeight 留档 + 500ms 后
   thumbSize 键持久化（currentFolder/smartFolder/tag/viewMode 九分支键逐字）+ 即时
   box-size 属性 + relayout + scrollToCurrentItem（machinery 版）） */


/* forceFitImageSize（bundle 36481-36497 逐字：详情模式限定 + detail-image 尺寸直设 +
   usingThumbnail 分支（animated/orientation → getRawUrl，否则 thumbnail URL）） */

/* ── b1-4b：sortData/offsetScrollbar/updateFilterCounts ──────────────── */

/* Array.prototype.shuffle（bundle 2594-2605 逐字；global.js 不在 index.html，b1 后原型
   扩展随 bundle 死亡——machinery 同体幂等补丁接装，bundle 在世时为惰性重定义） */
if (!(Array.prototype as any).shuffle) {
  (Array.prototype as any).shuffle = function () {
    var tmp, current, top = this.length;

    if (top) while (--top) {
      current = Math.floor(Math.random() * (top + 1));
      tmp = this[current];
      this[current] = this[top];
      this[top] = tmp;
    }

    return this;
  };
}

/* sortData（bundle 21710-21833 逐字：NAME/EXT（Intl.Collator 20x 优化注释）/RESOLUTION/
   FILESIZE/RATING/DURATION/MANUAL（orderMappings 预登记 20x 优化 + folderId 取
   currentFolder.id）/BTIME/MTIME（降序无相等分支）/RANDOM（shuffle 原型扩展）/TAGS
   （首标签 collator）/default modificationTime 降序；languageBCP 经 window） */

/* offsetScrollbarImm（bundle 34140-34166 逐字：delay||1 后 selected 末盒居中 scrollTo；
   无选中时防越界（末盒 transform Y 与 scrollTop 比较）+ updateContainerHieght（machinery
   版经 scope）） */

/* offsetScrollbar（bundle 34168-34170 逐字）——_.debounce(100, leading) 实例 apply 时
   一次性创建（与 bundle controller init 同语义） */

/* updateFilterCounts（bundle 42946-43040 逐字：type/camera（filterCamerasMapping 联动）/
   fontActivated（installedFonts 键）/star（0 归档）/shape（横竖比 2.5 与 4:3、3:4、16:9、
   9:16 五档）——AUDIO_TYPES/FONT_TYPES/installedFonts 经 window，全程 try 静默） */

/* ── b1-5：记忆/预载族（rememberScrollTops/rememberVideoCurrentTime/addToRecentFile/
   preloadImage + getVideoPlayer 域内闭包）──────────────────────────────── */

/* getVideoPlayer（bundle 36159-36164 逐字，controller 闭包：mpv 优先 native 次之） */
/* rememberScrollTops（bundle 31142-31150 逐字：inline/edge 模式跳过 + smoothZoom
   getChangedData 快照入 lastItemStates） */

/* rememberVideoCurrentTime（bundle 31726-31736 逐字：视频类 → getVideoPlayer().el.currentTime
   → eagle.videoPlayer.currentTime.{id} 键） */
/* addToRecentFile（bundle 36435-36443 逐字：1s 后 current 换人则不记（已換人 console）→
   RecentFileManager.addFile（c14c 版经 window if-absent）） */


/* preloadImage（bundle 36449-36481 逐字：supportFoamts **typo 逐字保留** + currentIndex()
   + next 为 idx / prev 为 idx-2 + smoothZoom('preload') 100ms 防抖） */

/* ── b1-5b：homeHandler/endHandler（mod 上下委派目标）─────────────────── */

/* homeHandler（bundle 35636-35648 逐字：详情 goToY 40（zooming 类 300ms 护栏，复用 c9d
   updateZoomRatioTimeout 域内变量）+ 列表 gotoTop（fns 桥覆盖经 scope）） */

/* endHandler（bundle 35650-35664 逐字：详情 goToY -99999999 + moveY -outerHeight+60 +
   列表 gotoBottom） */

/* ── b1-6a：删除族第一批（checkOperationSafety 双件/resetFolderCover/removePermanently）── */

/* checkOperationSafety（bundle 26789-26817 逐字：selected ≥ amount 时 BulkAction 确认框
   （swal + i18n），否则/catch 直通 callback） */


/* resetFolderCover（bundle 41454-41461 逐字：getAncestorFolders（c9b machinery 版）+
   covers 清空） */

/* removePermanently（bundle 37074-37094 逐字：trash 视图限定 + raw splice 移除 +
   ayncsImagesRemove（49709 顶层 function 经 window）+ gl:removeItems + 清选 + 重建绑定） */

/* ── b1-6b：删除族第二批（removeSmartFolder/removeFolder 双层 + 多选删除）── */

/* removeSmartFolder wrapper（bundle 41831-41849 逐字：100ms 延迟确认框）+ 内部闭包
   removeSmartFolder（41851-41933 逐字：parent/顶层 children 定位 + splice + mappings 删除
   + QuickAccessManager.remove（19061 顶层 var 经 window）+ idx===0/else 双分支续开 +
   音效 + updateSidebarList + saveFolderDebounce 1s + notify undo（origin 回填 + 树重索引
   + openSmartFolder）） */


/* removeFolder wrapper（bundle 41935-41980 逐字：密码锁守卫 + 有图/有子夹时 100ms 后
   checkbox 确认框（isDeleteImages=result==1）+ checkOperationSafety2(50)） */


/* removeSelectedFolders（bundle 41981-42019 逐字：多选文件夹 checkbox 确认 + 
   checkOperationSafety2(count, 1) + 逐夹 removeFolder（ignoreRestore）） */

/* removeSelectedSmartFolders（bundle 42021-42058 逐字：多选智能文件夹确认 + 逐个
   removeSmartFolderInner（ignoreRestore）+ 清多选） */

/* ── b1-6c：removeFolderContents（bundle 46345-46457 逐字）────────────── */

/* removeFolderContents（清空当前文件夹内容：isForceToTrash 分流（多夹图仅摘索引 vs
   isDeleted）+ 父夹/子夹 imagesMappings 同步 + 音效 + notify undo（isDeleted/folders 回滚）
   + 自动选下一张 + gl:removeItems + RANDOM 视图跳过 rebindRefresh 分支 + electronLog 双
   分支；autoScroll/updateFilterCounts/forceFitImageSize/ScrollbarSaver 均 machinery 版） */

/* ── b1-7a：小件批（注释模式/详情淡出/插件面板/存库防抖/标签群组四向/删群组）── */




/* saveFolderDebounce（bundle 42390-42396 逐字：isLibrarySaving 指示 + saveFolder 防抖 1s；
   timeout 存 scope 字段（bundle 原样 $scope.saveFolderDebounceTimeout）） */


/* 标签群组四向（bundle 48363-48416 逐字：ALL/UNFILED/STARRED 三向同构（同视图早退 +
   tagRectSelecting 复位 + keyword 清空 + tagViewMode(Name) + 焦点 tags + 清 currentTagGroup/
   selectedTags + TagManager.renderTagsResult）+ GROUP 向（blur 焦点输入 + currentTagGroup ===
   group 早退在清空之后——bundle 原样）） */




/* removeTagGroup（bundle 48620-48661 逐字：有标签确认框 → remove 内嵌闭包（TagManager
   removeGroup + 兄弟/前项续开，皆亡 openTagAllGroup）） */

/* ── b1-7b：幻灯片对/锁屏/调色板/布局/过滤入口/多开 ──────────────────── */

/* enterSlideshowMode（bundle 23824-23839 逐字：**!selected.length === 0 双重否定怪癖
   逐字保留**（实际效果为空选才能进入）+ 全屏 + enterDetailMode + 700/300ms 双层延迟缩放） */


/* rgbToHex（bundle 28976-28981 逐字）—— D-1 B-2 已归位 utils/color.ts */



/* pausePalette/resumePalette（bundle 37201/37207 逐字；change-palette-pause 通道 typo
   原样；IPCHelper c17a 接装经 window） */




/* openFilter（bundle 30173-30178 逐字）+ FILTER_ID_MAP（30204 前注释映射表逐字）+
   toggleFilterByType（30204-30216 逐字：_.throttle(300) 实例 apply 时一次性创建 +
   eagle.aiSearch 守卫） */



/* getChildFoldersMaps/Map（bundle 31890/31901 逐字，controller 闭包——供 multipleOpenFolder
   与 fns 表裸引用后备） */


/* multipleOpenFolder（bundle 38128-38162 逐字：resetFilter + 多选态切换（indexOf 增删 +
   needReload reload）+ currentFolderChildren getChildFoldersMaps） */

/* ── b1-7c：展开族/重复图/排序/搜索全览 ──────────────────────────────── */

/* expandFolder/expandSmartFolder（bundle 38054/38061 逐字：isExpand + updateSidebarList +
   localStorage 键逐字） */



/* isDuplicateImage/addToDuplicateMapping/removeFromDuplicateMapping（bundle 30572/30585/
   30591 逐字：svg/tif/tiff 排除 + getHashID（Tier-2）+ 垃圾桶排除） */



/* openDuplicate（bundle 36944-36974 逐字：selected/currentPage/all 三档
   OPEN_DUPLICATE_SCAN_PANEL 广播，selected 档含合并回调过滤 isDeleted） */

/* toggleCurrentLevelSmartFolders 内嵌闭包（38841 逐字）+ toggleAllSmartFolders 内嵌闭包
   （38831 逐字：tree.walk 全展开/收起）——localStorage 键逐字 */


/* toggleSelectSmartFolder/toggleCurrentLevelSmartFolders/toggleAllSmartFolderExpand
   （bundle 38786/38793/38803 逐字：smartFolder ±1 展开反转 / 当前层级反转 /
   全体反转（含 selectedSmartFolder 父级取向 + sidebarIndex=0）） */



/* setFolderOrder/setSmartFolderOrder（bundle 41360/41404 逐字：orderBy 清除/设置 +
   sortIncrease 默认 true + reload（当前匹配时）+ saveFolder（machinery 版经 scope）） */


/* updateTxtItem（bundle 34478-34489 逐字：txt 盒内容 HTML 重绘 + **selected.length === 0
   且 selected[0] === item 的矛盾守卫——bundle 原样（实际恒 false 不生效）**） */

/* ── b1-7d-1：外部站点 opener 族/教程/试用/多开/重命名入口/TouchID ────── */

/* openPinterest（bundle 26859-26871 逐字三语）+ openHuaban（26873）+ openArtstation
   （26877 广播）；shell 经 w.electron.shell（19019 解构同源） */



/* quickOpenFolder（bundle 44900-44936 逐字：openFolder(ignoreReload=true)/openAll 分流 +
   changeSidebarIndex 200ms + 自动定位（60/页倒序扫 allData → startCursor + 藏容器 reload +
   500ms select(undefined,target)+autoScroll+显容器）） */

/* multipleOpenSmartFolder（bundle 38172-38197 逐字：与 multipleOpenFolder 对称
   （smartFolder 多选态切换，currentFolder 清空）） */

/* renameFolder/renameSmartFolder（bundle 38163 邻域/38168 邻域逐字：editable + newFolderName
   + 双 100/200ms focus select——bundle 原样双写） */


/* showTutorial（bundle 37xxx 逐字：空库+单历史+无文件夹 && 教程未看过守卫 + themePath
   filter（getFilter()）+ swal 四语 open 文档跳转） */


/* unlockFolderWithTouchID（bundle 37xxx 逐字 async：canUseTouchID 守卫 + remote
   systemPreferences promptTouchID（@electron/remote 为 bundle 19020 词法绑定 →
   window.require('@electron/remote') 惰性取——nodeIntegration 两期可达）+ 解锁链 +
   失败 shake 动画 500ms + 焦点回密碼框） */

/* ── b1-7d-2：getSmartFolderList/getFolderList（侧栏树渲染核心）───────── */

/* getSmartFolderList（bundle 42644-42737 逐字：tree.walk 全树 → guidelines 色谱继承 +
   parent 指针维护（;;双分号原样）+ smartFolderList/mappings 双登记 + depth/size/vstype/
   styles 首尾位标注 + isVisible 三态 + 根层/过滤期/父可见三档入列） */

/* getFolderList（bundle 42738-42823 逐字：与 Smart 版同构 + 密码夹可见性三态
   （parent.password → isExpand && parent.isVisible && !!parent.isUnLock）+ 无
   smartFolderList/mappings 登记面——bundle 原样） */

/* ── b1-7d-3：列表滑条/元信息/移入文件夹/上传队列/链接导入 ───────────── */


/* ── b1-9bz-C-4：缩略图放大/还原（自 selectionViewDomain 迁入；原 domainEnlarge/ShrinkThumbnails
   随 imageSize.height watcher 退役改为写入点直调，故实现迁到本模块 —— 本模块不能被域反向
   import（循环），而域可以 import 本模块） ── */





/* moveToFolders（bundle 43242-43251 逐字：MOVE_TO_FOLDER 广播（folderList 活对象））
   b1-9ba：该频道全树无 $on 接收者（原接收者随 bundle 摘除退役，js/directives 侧文件
   从未挂载）——广播体移除，函数保形（快捷键 'move-to-folders' 入口与 s.moveToFolders
   挂载面不变；移动到文件夹竖切时按 React 语义归位）。 */


/* calcuteAddImageTimeLeft（bundle 45326-45338 逐字闭包：**is.number——is.min.js 为孤儿
   文件（index.html 未加载），bundle 同引用同样潜在崩——w.is 镜像同语义**） */

/* onDropContainer（bundle 52717-52928 逐字；controller 顶层函数 → 域内移植）
   裸标识符 → window：dragging（bundle 顶层 var，读写均落 window live binding）/
   require('path')/require('electron')/jQuery/$/fs/getExt/EagleConfig/IS_HIDDEN_FILE/
   IS_DIRECTORY/walk/swal/i18n/electronLog/process/sortByAZ；$scope → s（bodyScope）；
   $filter('i18n') 走 getFilter()（shim 版见 getFilter，bundle 在世走 injector 同语义）。
   TS 唯一适配：三个独占 return 分支内 bundle 重复声明 file（第 2 分支为 let）→ 统一 var
   （无行为差异）。
   诚实缺口（与既有 w.is 消费面 8744 同状态，不在 b1-9 装载链上）：dragUrl 分支的
   w.is（my_modules 无 is_js 包）与 s.uploadUrl（单数版，React 侧仅 uploadUrls）。 */

/* showUploadQueue（bundle 45313-45324 逐字：addImageStartTime 立时 + 上传队列面板 +
   1s 剩余时间轮询）+ hideUploadQueue（45343-45351 逐字：空队列收面板 +
   updateWindowProgressBar（bundle 49810 **顶层 var throttle 单例 → window 可达**，w.* 直连
   保留原节流实例语义）） */


/* importLinks（bundle 26906-26994 逐字：剪贴板 http 预读（**clipboard 裸引 →
   w.electron.clipboard**；is.url → w.is 镜像）+ textarea 校验 swal → 逐链 HEAD 探测分流
   （image → upload-url 通道 / 其他 → 书签 url-from-extension）+ uploadQueue 占位） */

/* videoScreenShot（bundle 33233-33288 逐字 async：mpv screenshot API / native drawImage
   双路 → copyMode 剪贴板（electron.nativeImage）或 screencapture-from-extension 上送
   （guid + currentTime.toFixed(2) 命名）） */
/* getFolderImages（bundle 42841-42865 逐字：倒序扫描 raw + folders 归属判定；
   includeSubFolder 时 eagle.utils.tree.walk 子树命中即含（回调 return 原样）；
   try/catch 吞错原样） */

/* findDupclipate（bundle 28507-28868 逐字，typo 唯一：全局查重主表 + filterExtensions/
   filterCameras 建表副产物（currentFolder 空分支）+ duplicateGroupings 主动扫描（hasColorInfo
   才分组、>1 才成组）；getHashID 为 bundle 2127 顶层函数（w.* 直连，双参）；第二段循环
   var rindex/image/hashID 与首段同名 → *2 后缀（TS 语义同 var 重声明）） */


/* refreshSubfolderList（bundle 27462-27492 逐字：showSubfolderContent 分流 subFolders +
   keyword 过滤（**filter 回调非命中路径无 return——undefined 隐式剔除怪癖原样**）；
   subFolderSortableOptions.disabled 开关为 bundle 38947 controller init 种子对象
   （applyDataMachineryScope if-absent 补种）） */


/* newSmartFolder（bundle 39944-39946 逐字：$rootScope.$broadcast → s.$root（shim $root
   同体语义）） */

/* prependFolder（bundle 39968-39979 逐字：unshift + folderMappings 登记 + updateSidebarList
   + 1s 后 calculateImageBinding→saveFolder） */

/* gotoTop/gotoBottom（bundle 21886-21916 逐字：resetNgGridLayoutData 为 ngGridLayout 指令
   66970 隐式全局赋值（window 可达，w.* 直连——同 764/944 先例；post-b1 由 grid 域供给）；
   gotoBottomTimeout 存 scope 字段原样；gotoBottom else 分支 offset 死变量原样保留） */


/* ── b1-8 rename 域 ──
   emojiRegex / remainingFilenameLength / sanitize / escapeRegex / pinyinCache 已随
   D-1 B-1 归位 `utils/normalize.ts`（本域仅剩业务函数）。 */


/* enableImageNameEditable（bundle 21975-22075 逐字；controller 闭包函数）：contenteditable
   行内重命名 + exitEditable 内嵌闭包 + blur debounce（bundle 80222 顶层 var debounce →
   w.debounce 直连，200ms immediate）；blur 内 angular.element("body").scope() → getBodyScope()
   （同双轨解析）；重命名数据面 ayncsImagesChange/hiddenByCurrentFilter 为 bundle 顶层函数
   （49667/49600）→ w.* 直连（b1 终审 vendor 提取清单登记）。 */

/* enableSubFolderNameEditable（bundle 22077-22175 逐字）：子文件夹行内重命名——keydown 27
   还原**无 span 包裹**（与图片版差异原样）+ blur debounce 500ms immediate + selectFolder
   经 scope 解析（machinery 版）；exitEditable 内嵌闭包。 */

/* renameImages（bundle 41480-41496 逐字；controller 闭包函数）：多选 OPEN_RENAME 广播 /
   单选 50ms 后 enableImageNameEditable——**bundle 裸 event 引用（41492）→ w.event**
   （$timeout/setTimeout 回调期 window.event，同 bundle 语义） */




/* editTag（bundle 45532-45700 逐字）：swal 单标签重命名 + raw 倒序 tags 替换（ayncsImagesChange/
   hiddenByCurrentFilter w.* 直连）+ TagManager 群组/historyTags 更新（**45615
   angular.copy(originHistoryTags) 自复制 undefined 怪癖原样**）+ folders/smartFolders.conditions
   树替换 + tagsSuggestion 补录 + saveFolder + calculateImageBinding→rebindRefresh +
   $filter('i18n') 经 injector（getFilter）+ $rootScope.notify → s.$root.notify */

/* renameCurrentFolder（bundle 41498-41569 逐字）：F2 重命名五路分流路由——图片
   （多选 renameImages / 详情 inspector-name selectAll）→ 子文件夹（jQuery.Event 合成 +
   enableSubFolderNameEditable）→ 侧栏文件夹（batch/renameFolder）→ 智能文件夹
   （batch/renameSmartFolder）→ 标签（单 editTag / 多 OPEN_RENAME / 空 renameTagGroup
   50ms $timeout） */

/* ── b1-8 fns 表裸引用审计修复：controller 闭包裸调的 machinery 供给面（export 供
   controllerFns fns 表直调——经 ESM 循环依赖，函数声明提升运行时安全；同时接装
   非碰撞 scope 面）── */

/* getAncestorSmartFolders（bundle 42527-42542 逐字：smartFolderMappings 祖先链 +
   electronLog catch 原样） */

/* calcuteContainFolders 闭包版（bundle 27283-27325 逐字：倒序 folders 计数 +
   foldersMappings 建表（isSelected=filterRules.folder.includes）+ filter 剔 null +
   {containFoldersMappings, containFolders, noFoldersCount} 返回——**与 $scope 版
   （27259，含 containFolders 落 scope）不同体，scope 面不可接装（同名碰撞）**） */


/* calcRotateDegree（bundle 36170-36180 逐字：click 分支 shift ±90 / 其余 -90 + 360 归一；
   纯函数无 scope 依赖） */
/* getArroundBox（bundle 35094-35099 逐字：index ±20 窗口 .box 切片）——既有移植版
   5180 行（bundle 35091-35097 锚）承担，此处不再重复 */

/* toggleAllFolders / toggleCurrentLevelFolders（bundle 38730-38748 逐字：树全层 / 当前层
   isExpand 反转 + localStorage eagle.sidebar.folder.expand.* 键逐字 + updateSidebarList；
   与 smart Inners（8006/8017）同构镜像） */


/* D-1 A-4：单例 debounce/throttle 工厂缓存。
   reload/offsetScrollbar/pageUpDownHandler/toggleFilterByType 的右侧是**调用**（返回 debounce/
   throttle 实例），原挂在 scope 上按 seed 时机创建一次。直调化后改用本缓存按 scope 取用，
   保证「每 scope 一个实例」——否则每次调用新建实例会丢掉防抖/节流状态。 */


/* controller init 状态面（bundle 21242-21619 逐字——$scope→s / $rootScope→s.$root 机械替换；
   initEvent/var allTags/var updateTimer 略去：React 组件自有事件面 + 闭包死变量；
   仅 shim 世界调用（bundle 在世时状态由 controller init 填充，零调用零改变）） */

