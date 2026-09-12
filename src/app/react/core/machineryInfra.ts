import { machineryInitMousetrap } from './keymap';
import { scopeEvalAsync } from './scopeRuntime';
import { buildScrollbarSaver, machineryRelayout, machinerySwitchLayout, machineryToggleAll } from '../services/gridService';
import { machineryChangeStar } from '../services/imageOpsService';
import { machineryOnDropContainer } from '../services/uploadService';
import { machineryGetRatioExp, machineryGetRatioNonExp, machineryUpdateZoomRatio, machineryZoom } from '../services/viewOpsService';
import { syncBodyFromScope } from '../store/bodyState';
import { syncDetailFromScope } from '../store/detailState';
import { syncFilterFromScope } from '../store/filterState';
import { syncInspectorFromScope } from '../store/inspectorState';
import { syncListFromScope } from '../store/listState';
import { syncPanelFromScope } from '../store/panelState';
import { syncSidebarFromScope } from '../store/sidebarState';
import { syncTagManagerFromScope } from '../store/tagManagerState';
import { syncToolbarFromScope } from '../store/toolbarState';
import { syncUploadFromScope } from '../store/uploadState';
import { addClass, removeClass } from '../utils/domQuery';
import { getBodyScope } from './appCore';
import { callExternal } from './externalSupply';
import { machineryCalcuteFilterResult, machineryColorFilter, machineryContentFilter, machineryExistInSmartFilter, machineryFilterContent, machineryFilterData, machineryGrayColorFilter } from './filterDomain';
import { machineryCalculateImageBinding, machineryPrependImages, machineryRebindRefresh, machineryRebindRefreshLazy, machineryReload, machinerySortRawData, machineryUpdateItemsView } from './itemDomain';
import { buildRecentFileManager, machineryGetRecentFolders, machinerySaveFolder, machinerySmartFolderCount, machineryUpdateSidebarList } from './libraryDomain';
import { machineryEnterDetailMode, machineryLeaveDetailMode, machineryNotify, machineryToggleSlideshow } from './miscDomain';
import { machineryRemoveSelected, machinerySelectNext, machinerySelectPrev, machineryUpdateSelection } from './selectionViewDomain';
import { machineryBuildTagManager } from './tagManagerDomain';

/**
 * b1-9bz-D-1 B-17：dataMachinery 收尾——挂载基础设施域（scope 面供给层）。
 * applyDataMachineryScope / machinerySeedControllerState / getTimeout / scopeSingleton 等逐字平移。
 */


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
let applied = false;

export function applyDataMachineryScope(): void {
  if (applied) return;
  applied = true;
  const s = getBodyScope();
  if (!s) return;

  // b1-9d：controller init 状态面种子（仅 shim 世界——bundle 在世时由 controller init
  // 填充同名默认值，此处调用为恒等幂等）
  if (s.__eagleShim) {
    machinerySeedControllerState(s);
  }

  // b1-9d：TagManager 供给（bundle 48351 $scope.TagManager = TagManager 的 shim 等价；
  // bundle 在世时 s.TagManager 已存在，零调用）
  if (s.__eagleShim && !s.TagManager) {
    const w = window as any;
    w.TagManager = machineryBuildTagManager(s);
    syncFilterFromScope();
    syncTagManagerFromScope();
    s.TagManager = w.TagManager;
    syncFilterFromScope();
    syncTagManagerFromScope();
  }

  // b1-9d：controller init 注入面补种（bundle 20055 `$rootScope.preferences = preferences` /
  // 20208 `$scope.UrlStateService = UrlStateService`；种子区间 21242-21619 之外的同批 DI 本地）
  // ——shim 世界无 Angular DI，同名本地改由窗口单例供给：
  //   · s.UrlStateService：dataMachinery 逐字端口按 scope 解析（openAll/nextHistory/prevHistory、
  //     toolbarState 消费），缺失时 openAll 的 $timeout 回调首行即抛，reload/listDone 永不置位；
  //   · s.preferences：shim 的 $root 即 scope 自身，故 s.preferences 同时覆盖
  //     s.$root.preferences（updateSidebarList 消费 .sidebar.*）。
  // if-absent + shim-only：bundle 在世时两处均由 controller init 赋值，零调用零改变。
  if (s.__eagleShim) {
    const w = window as any;
    if (!s.preferences && w.preferences) s.preferences = w.preferences;
    if (!s.UrlStateService && w.UrlStateService) s.UrlStateService = w.UrlStateService;
  }

  // b1-7e：subFolderSortableOptions（bundle 38947 controller init 种子逐字——React 侧写方
  // machineryRefreshSubfolderList 开关 .disabled；ListRegion ui-sortable 消费原对象
  // {...options}，update 回调 $timeout 经 injector（getTimeout，缺 Angular 时跳过））
  if (!s.subFolderSortableOptions) {
    s.subFolderSortableOptions = {
      distance: 10,
      disabled: false,
      tolerance: "pointer",
      helper: 'clone',
      update: function (e: any, ui: any) {
        machineryUpdateSidebarList(s);
        const $timeout = getTimeout();
        $timeout && $timeout(function () {
          machinerySaveFolder(s);
        }, 500);
      },
    };
  }

  // scope 函数替换：此后 bundle 侧全部 $scope.calculateImageBinding 调用面（muteCalcuteImageBinding/
  // library.changed 等）即走移植实现（绞杀内部机器）。c9b：rebindRefresh/rebindRefreshLazy/
  // updateSidebarList 一并替换（React 域 10+ 处调用面 + bundle 18203/18438/$broadcast 路径）。
  // D-1 A-2：rebindRefresh/filterContent 挂载已退役——filterDomain 域内监听 / filterService
  // 写入点 / 各组件均已 import 直调；调用观测改用 __eagleMachinery.calls 计数。
  // c9c：updateItemsView/switchLayout/prependImages/reload（reload = 一次性创建的 leading-edge
  // 防抖实例，与 bundle controller init 同语义）
  s.reload = machineryReload(s);
  // c9d：缩放/放映/计数/最近文件夹（getRatioExp/getRatioNonExp 纯函数被 updateZoomRatio
  // 与 React 域 24 处调用面共用）
  // D-1 A-2：toggleSlideshow 挂载已退役（DetailViewer/miscDomain/itemMenuService/mediaService 均 import 直调）
  // c9e：updateItemView（updateItemsView 循环体；bundle 侧 $bodyScope.updateItemView 19688-19751
  // 与 ipc 路径 21234/23632+ 全部改走移植版）
  // c13：relayout（ig/eg 经 window 解析）
  // c14：existInSmartFilter（26 规则函数经 window + MATCH_FUNCTION 表）
  // c14b：筛选引擎（filterData/calcuteFilterResult scope 替换——rebindRefresh 的
  // await s.calcuteFilterResult 即走移植实现）
  // c14c：contentFilter/calcuteContainTags + RecentFileManager（if-absent）
  // D-1 A-2：contentFilter 挂载已退役（FolderModals/bundleGlobals/FolderSelectPanels 谓词位置改直调包装）
  const w2 = window as any;
  if (!w2.RecentFileManager) w2.RecentFileManager = buildRecentFileManager();
  // c15：updateSelection/zoom
  // D-1 A-2 误判修正（2026-09-11 全量套件实测）：`electron/main.cjs` 工作流驱动脚本经 scope 面
  // 直调 updateSelection（:1858，**无 typeof 守卫**）与 zoom（:2932/3015，try 包裹）——脚本
  // 无法 import ESM，必须以 scope 面供给（同 B-8 跨边界清单）。此前「主窗口无消费面」结论
  // 只扫了 React 树，漏掉 main.cjs；缺 updateSelection 会使 m1 selectItems 直接 TypeError。
  s.updateSelection = () => machineryUpdateSelection(s);
  s.zoom = () => machineryZoom(s);
  // 同因：main.cjs 主窗工作流还直调 changeStar（:2058/2083）、removeSelected（:2192）、
  // toggleAll（:2319/2325）、addImagesToFolder（:2057）；selectNext/selectPrev 为详情导航
  // 的 bundle scope 面（DetailViewer 以 typeof 守卫消费），一并恢复以保 parity。
  s.changeStar = (...a: any[]) => (machineryChangeStar as any)(s, ...a);
  s.removeSelected = (...a: any[]) => (machineryRemoveSelected as any)(s, ...a);
  s.toggleAll = (...a: any[]) => (machineryToggleAll as any)(s, ...a);
  s.selectNext = (...a: any[]) => (machinerySelectNext as any)(s, ...a);
  s.selectPrev = (...a: any[]) => (machinerySelectPrev as any)(s, ...a);
  // c15b：adjustLayoutWidth/zoomFit
  // c15c：getSelection/changeSidebarIndex/resetPage/calculateFilterCounts
  // c15d：openAll + ScrollbarSaver（if-absent；bundle 在世沿用其隐式全局绑定）
  if (!w2.ScrollbarSaver) w2.ScrollbarSaver = buildScrollbarSaver();
  // c16a：enterDetailMode/leaveDetailMode（**保留挂载**：frontend/public/shims.js 以 25ms 轮询
  // 包装 scope.enterDetailMode/leaveDetailMode 实现详情原图交付门控——属全局消费面，
  // D-2 退役 shims.js 前不可删；应用内真实入口已走 import 直调。）
  s.enterDetailMode = ($event: any, image: any) => machineryEnterDetailMode(s, $event, image);
  s.leaveDetailMode = () => machineryLeaveDetailMode(s);
  // c16c：saveFolder
  // c17b：notify（root scope 函数——bundle $rootScope.notify 20157 的等价实现，root/body
  // 双写保证 $rootScope.notify 直调与 s.notify 原型链解析都走移植版）
  const notifyFn = (params: any, restoreCallbackk: any) => machineryNotify(s, params, restoreCallbackk);
  s.$root.notify = notifyFn;
  s.notify = notifyFn;
  // c18a：smartZoom/lastZoom
  // c18b：zoomActual/toggleZoom/zoomFitEdge/updateContainerHieght
  // c18c：undo/nextHistory/prevHistory/back
  // c18d：selectAll/toggleDetailMode
  // c18e-1：selectNext/selectPrev
  // c18e-2：multipleSelect 四件套
  // c18e-2b：removeSelected
  // c18e-3：quicklook/copyImages
  // c18e-4：方向键/修饰键 handler 族（第一批）
  // c18e-5：keyUp/keyDown（侧栏导航级联 + QuickAccess/Group 闭包域内移植）
  // c18e-6：selectUp/Down + pageUp/pageDown（throttle 实例经 getPage*HandlerFn 单例缓存）
  // c18f-1：小 handler 批
  // b1-9ay：评级键族补齐（mousetrap '0'-'5' 六键的 handler 此前仅 changeTo5Star 在册）
  // c18f-2：openParentFolder/createTxtFileFromTemplate/setFolderCover
  // c18f-3：inspector 面板/快捷搜索打开器
  // c18g-1：getItemByElement/changeStar/gif 帧步进/addVideoComment/newFileFromTemplate
  // c18g-2：视图开启器族
  // b1-3：侧栏 prev/next 导航四向
  // b1-4a：滚动/列表辅助族第一批
  // D-1 A-2：currentIndex 挂载已退役（imageOpsService/detailState/域内均 import 直调）
  // b1-4b：sortData/offsetScrollbar/updateFilterCounts（offsetScrollbar 实例经 getOffsetScrollbarFn 单例缓存）
  // b1-5：记忆/预载族
  // b1-5b：homeHandler/endHandler
  // b1-6a：删除族第一批
  // b1-6b：删除族第二批
  // b1-6c：removeFolderContents
  // b1-7a：小件批
  // b1-7b：幻灯片/锁屏/调色板/布局/过滤入口/多开
  // b1-7c：展开族/重复图/排序/搜索全览
  // b1-7d-1：外部站点/教程/试用/多开/重命名入口/TouchID
  // D-1 A-2：quickOpenFolder 挂载已退役（Inspector/DuplicateFamily import 直调）
  // b1-7d-2：侧栏树渲染核心
  // b1-7d-3：列表滑条/元信息/移入文件夹/上传队列/链接导入/截屏
  // D-1 A-2：showUploadQueue 挂载已退役（apiServerDomain import 直调）
  // b1-9d 收口：onDropContainer（bundle 顶层 function → 同 window live binding 语义）。
  // 三处消费面都要命中：① smoke/CDP 直接调全局 onDropContainer(...)；② ListRegion
  // scopeFn('onDropContainer') 只在 scope 上找；③ callScope 先查 fns 表再查 scope
  // ——两者均不回落 window，故 window 与 scope 都要挂。bundle 在世时 window 已有绑定，
  // if-absent 零改变。
  s.onDropContainer = (event: any) => machineryOnDropContainer(s, event);
  if (s.__eagleShim && !(window as any).onDropContainer) (window as any).onDropContainer = s.onDropContainer;
  // b1-7e：全局查重（getFolderImages/findDupclipate）+ 子文件夹列表 + 搜索聚焦 +
  // 新建智能文件夹/前置插入 + 列表滚顶/滚底
  // b1-8：rename 域（路由 + 图片/子文件夹行内编辑 + 批量 + 标签/群组 + selectFolder）
  // b1-8 裸引用审计修复：controllerFns fns 表内闭包裸调改走 scope 解析——闭包三件
  // （getExtendTags/getChildFoldersMaps/getChildFoldersMap）+ setViewMode 闭包 debounce
  // 经 apply 接装后可解析（machinery 版本均已存在；setViewMode 现为 export 直调）
  // b1-8 续：闭包供给面的非碰撞 scope 接装（calcuteContainFolders/toggleCurrentLevel{Folders,
  // SmartFolders} 与 bundle $scope 同名——**不可接装**，controllerFns 经 import 直调）

  // b1-9bz-B-8：**子窗口**（viewers/font、viewers/text-editor）经  驱动的
  // 名字 —— 跨窗口无法直 import，必须由 scope 面供给。原先依赖 controllerFns fns 表的
  // if-absent 挂载（表退役后即 undefined），故在此**显式挂载**（本块就是 scope 面供给层）。
  // 清单来自 tests-tmp/bz-b8-viewers.py 的枚举（子窗引用 ∩ 表供给且未挂载）。
  s.activateFont = (...args: any[]) => callExternal('activateFont', ...args);
  s.deactivateFont = (...args: any[]) => callExternal('deactivateFont', ...args);
  s.escHandler = (...args: any[]) => callExternal('escHandler', ...args);

  // b1-9bz-B-8：原版主 UI 工作流驱动脚本（electron/main.cjs 的 selectItems / 等）经 scope
  // 面调用的名字 —— 与子窗口同款需求（脚本在页面主世界驱动 scope，无法直 import）。
  // 原由 fns 表 if-absent 供给，表退役后改为显式挂载。
  s.copyAsPath = (...args: any[]) => callExternal('copyAsPath', ...args);
  s.getRawPath = (...args: any[]) => callExternal('getRawPath', ...args);
  s.getRawUrl = (...args: any[]) => callExternal('getRawUrl', ...args);
  s.select = (...args: any[]) => callExternal('select', ...args);
  // D-1 A-2 误判修正：addImagesToFolder 已在 externalSupplyRegistrar 注册，却漏了 scope 面挂载，
  // main.cjs:2057 直调 scope.addImagesToFolder 即 TypeError（m1 实测）。
  s.addImagesToFolder = (...args: any[]) => callExternal('addImagesToFolder', ...args);

  // b1-9av：启动期键盘绑定。原链 = update-menu/update-preferences IPC → initMousetrap
  // （bundle 22399/22408），该两通道 React 世界无发送方无桥（PROGRESS 曾登记"暂留"）——
  // 键盘层自启动起全死（Enter/方向键/Del/星标/undo/quicklook 等 ~50 键）。
  // 直接调模块函数（initMousetrap/buildMousetrap/destoryMousetrap 三者从未装配到 scope，
  // s.initMousetrap 恒 undefined——route 表只是标记）；initMousetrap = destory+rebuild+
  // rebind 幂等（controller 种子的 s.mousetrap = {} 不可作 if-absent 判据），无条件执行。
  try {
    const wm = window as any;
    if (s.__eagleShim && wm.Mousetrap) {
      machineryInitMousetrap(s);
    }
  } catch (err: any) {
    console.error('[data-machinery] keyboard init failed', err);
  }

  // D-1 A-2：测试诊断面 —— 把契约需要的 machinery 函数挂到 window，供测试从「scope 挂载
  // 存在性」改为「machinery 导出已就位」。代码内部一律 import 直调，本表不做运行时分发。
  (window as any).__eagleMachinery = {
    colorFilter: machineryColorFilter,
    grayColorFilter: machineryGrayColorFilter,
    calculateImageBinding: machineryCalculateImageBinding,
    sortRawData: machinerySortRawData,
    rebindRefresh: machineryRebindRefresh,
    rebindRefreshLazy: machineryRebindRefreshLazy,
    updateSidebarList: machineryUpdateSidebarList,
    updateItemsView: machineryUpdateItemsView,
    switchLayout: machinerySwitchLayout,
    prependImages: machineryPrependImages,
    getRatioExp: machineryGetRatioExp,
    getRatioNonExp: machineryGetRatioNonExp,
    updateZoomRatio: machineryUpdateZoomRatio,
    toggleSlideshow: machineryToggleSlideshow,
    smartFolderCount: machinerySmartFolderCount,
    getRecentFolders: machineryGetRecentFolders,
    filterData: machineryFilterData,
    calcuteFilterResult: machineryCalcuteFilterResult,
    relayout: machineryRelayout,
    existInSmartFilter: machineryExistInSmartFilter,
    contentFilter: machineryContentFilter,
    updateSelection: machineryUpdateSelection,
    filterContent: machineryFilterContent,
    enterDetailMode: machineryEnterDetailMode,
    leaveDetailMode: machineryLeaveDetailMode,
    toggleAll: machineryToggleAll,
    calls: machineryCalls,
  };

  (window as any).__eagleDataMachinery = {
    version: 50,
    applied: true,
    sortRawData: 'machinery',
    calculateImageBinding: 'machinery',
    getAncestorFolders: 'machinery',
    getExtendTags: 'machinery',
    rebindRefresh: 'machinery',
    rebindRefreshLazy: 'machinery',
    updateSidebarList: 'machinery',
    calcuteFilterBadge: 'machinery',
    filterSidebarItem: 'machinery',
    updateItemsView: 'machinery',
    switchLayout: 'machinery',
    prependImages: 'machinery',
    reload: 'machinery',
    autoResizeTagFilter: 'machinery',
    resetImageData: 'machinery',
    getRatioExp: 'machinery',
    getRatioNonExp: 'machinery',
    updateZoomRatio: 'machinery',
    toggleSlideshow: 'machinery',
    smartFolderCount: 'machinery',
    getRecentFolders: 'machinery',
    updateItemView: 'machinery',
    checkTouchIDSupport: 'machinery',
    relayout: 'machinery',
    existInSmartFilter: 'machinery',
    isMatchCondition: 'machinery',
    filterData: 'machinery',
    calcuteFilterResult: 'machinery',
    contentFilter: 'machinery',
    calcuteContainTags: 'machinery',
    updateSelection: 'machinery',
    zoom: 'machinery',
    adjustLayoutWidth: 'machinery',
    zoomFit: 'machinery',
    saveListHeight: 'machinery',
    getSelection: 'machinery',
    changeSidebarIndex: 'machinery',
    resetPage: 'machinery',
    calculateFilterCounts: 'machinery',
    openAll: 'machinery',
    updateListHeight: 'machinery',
    setLastFolder: 'machinery',
    setViewMode: 'machinery',
    enterDetailMode: 'machinery',
    leaveDetailMode: 'machinery',
    saveFolder: 'machinery',
    buildMousetrap: 'machinery',
    destoryMousetrap: 'machinery',
    initMousetrap: 'machinery',
    notify: 'machinery',
    smartZoom: 'machinery',
    lastZoom: 'machinery',
    zoomActual: 'machinery',
    toggleZoom: 'machinery',
    zoomFitEdge: 'machinery',
    updateContainerHieght: 'machinery',
    undo: 'machinery',
    nextHistory: 'machinery',
    prevHistory: 'machinery',
    back: 'machinery',
    selectAll: 'machinery',
    toggleDetailMode: 'machinery',
    multipleSelectUp: 'machinery',
    multipleSelectDown: 'machinery',
    multipleSelectNext: 'machinery',
    multipleSelectPrev: 'machinery',
    removeSelected: 'machinery',
    quicklook: 'machinery',
    copyImages: 'machinery',
    keyCHandler: 'machinery',
    keyPHandler: 'machinery',
    keyLeftHandler: 'machinery',
    keyRightHandler: 'machinery',
    modUpHandler: 'machinery',
    modDownHandler: 'machinery',
    modLeftHandler: 'machinery',
    modRightHandler: 'machinery',
    modShiftUpHandler: 'machinery',
    modShiftDownHandler: 'machinery',
    modShiftLeftHandler: 'machinery',
    modShiftRightHandler: 'machinery',
    keyUpHandler: 'machinery',
    keyDownHandler: 'machinery',
    selectUp: 'machinery',
    selectDown: 'machinery',
    pageDownHandler: 'machinery',
    pageUpHandler: 'machinery',
    changeTo5Star: 'machinery',
    removeStar: 'machinery',
    changeTo1Star: 'machinery',
    changeTo2Star: 'machinery',
    changeTo3Star: 'machinery',
    changeTo4Star: 'machinery',
    closeWindowHandler: 'machinery',
    nHandler: 'machinery',
    mHandler: 'machinery',
    toggleAll: 'machinery',
    zoomIn: 'machinery',
    zoomOut: 'machinery',
    saveHandler: 'machinery',
    refreshRandom: 'machinery',
    openParentFolder: 'machinery',
    createTxtFileFromTemplate: 'machinery',
    setFolderCover: 'machinery',
    openQuickSearch: 'machinery',
    openActionsPanel: 'machinery',
    openInspectorTagSelectPanel: 'machinery',
    openInspectorFolderSelectPanel: 'machinery',
    getItemByElement: 'machinery',
    changeStar: 'machinery',
    nextGifFrame: 'machinery',
    prevGifFrame: 'machinery',
    addVideoComment: 'machinery',
    newFileFromTemplate: 'machinery',
    openRandom: 'machinery',
    openUnfiled: 'machinery',
    openUntagged: 'machinery',
    openRecent: 'machinery',
    openCommunity: 'machinery',
    openAllTags: 'machinery',
    openTrash: 'machinery',
    openNextFolder: 'machinery',
    openPrevFolder: 'machinery',
    openNextSmartFolder: 'machinery',
    openPrevSmartFolder: 'machinery',
    autoScroll: 'machinery',
    currentIndex: 'machinery',
    getSelectedItems: 'machinery',
    getSelectedItemElements: 'machinery',
    getSelectedTags: 'machinery',
    getQuickAccessList: 'machinery',
    checkListItemsLessThanContainer: 'machinery',
    updateSubFolderWidth: 'machinery',
    updateSliderPosition: 'machinery',
    changeListHeight: 'machinery',
    scrollToCurrentItem: 'machinery',
    forceFitImageSize: 'machinery',
    sortData: 'machinery',
    offsetScrollbar: 'machinery',
    updateFilterCounts: 'machinery',
    rememberScrollTops: 'machinery',
    rememberVideoCurrentTime: 'machinery',
    addToRecentFile: 'machinery',
    preloadImage: 'machinery',
    homeHandler: 'machinery',
    endHandler: 'machinery',
    checkOperationSafety: 'machinery',
    checkOperationSafety2: 'machinery',
    resetFolderCover: 'machinery',
    removePermanently: 'machinery',
    removeSmartFolder: 'machinery',
    removeFolder: 'machinery',
    removeSelectedFolders: 'machinery',
    removeSelectedSmartFolders: 'machinery',
    removeFolderContents: 'machinery',
    toggleCommentMode: 'machinery',
    fadeOutDetailMode: 'machinery',
    openPluginPanel: 'machinery',
    saveFolderDebounce: 'machinery',
    openTagAllGroup: 'machinery',
    openUnfiledGroup: 'machinery',
    openStarredGroup: 'machinery',
    openTagGroup: 'machinery',
    removeTagGroup: 'machinery',
    enterSlideshowMode: 'machinery',
    leaveSlideshowMode: 'machinery',
    rgbToHex: 'machinery',
    lockApp: 'machinery',
    focusAppUnlockPassword: 'machinery',
    pausePalette: 'machinery',
    resumePalette: 'machinery',
    saveLayout: 'machinery',
    cancelCrop: 'machinery',
    openFilter: 'machinery',
    toggleFilterByType: 'machinery',
    multipleOpenFolder: 'machinery',
    expandFolder: 'machinery',
    expandSmartFolder: 'machinery',
    searchInAll: 'machinery',
    isDuplicateImage: 'machinery',
    addToDuplicateMapping: 'machinery',
    removeFromDuplicateMapping: 'machinery',
    openDuplicate: 'machinery',
    toggleSelectSmartFolder: 'machinery',
    toggleCurrentLevelSmartFolders: 'machinery',
    toggleAllSmartFolderExpand: 'machinery',
    setFolderOrder: 'machinery',
    setSmartFolderOrder: 'machinery',
    updateTxtItem: 'machinery',
    openPinterest: 'machinery',
    openHuaban: 'machinery',
    openArtstation: 'machinery',
    quickOpenFolder: 'machinery',
    multipleOpenSmartFolder: 'machinery',
    renameFolder: 'machinery',
    renameSmartFolder: 'machinery',
    showTutorial: 'machinery',
    openTrialModal: 'machinery',
    unlockFolderWithTouchID: 'machinery',
    getSmartFolderList: 'machinery',
    getFolderList: 'machinery',
    updateListSlider: 'machinery',
    changeMetaItems: 'machinery',
    moveToFolders: 'machinery',
    showUploadQueue: 'machinery',
    hideUploadQueue: 'machinery',
    importLinks: 'machinery',
    videoScreenShot: 'machinery',
    selectNext: 'machinery',
    selectPrev: 'machinery',
    getFolderImages: 'machinery',
    findDupclipate: 'machinery',
    refreshSubfolderList: 'machinery',
    focusSeach: 'machinery',
    newSmartFolder: 'machinery',
    prependFolder: 'machinery',
    gotoTop: 'machinery',
    gotoBottom: 'machinery',
    selectFolder: 'machinery',
    enableSubFolderNameEditable: 'machinery',
    batchRenameFolders: 'machinery',
    batchRenameSmartFolders: 'machinery',
    renameTagGroup: 'machinery',
    editTag: 'machinery',
    renameCurrentFolder: 'machinery',
    getChildFoldersMaps: 'machinery',
    getChildFoldersMap: 'machinery',
    getVideoPlayer: 'machinery',
    getFolderParentChilder: 'machinery',
    calcRotateDegree: 'machinery',
    getArroundBox: 'machinery',
    getAncestorSmartFolders: 'machinery',
    toggleAllFolders: 'machinery',
    toggleAllSmartFolders: 'machinery',
  };
}

// b1-9k 导出：tagManagerDomain 的裸 getTimeout（1307/1379/1654/1670）此前是死标识符
export function getTimeout(): any {
  if (timeoutCache) return timeoutCache;
  try {
    const ang = (window as any).angular;
    if (ang && ang.element && ang.element(document).injector) {
      timeoutCache = ang.element(document).injector().get('$timeout');
    }
  } catch (err) { /* noop */ }
  // b1-9d：Angular 缺席（shim 世界）→ $timeout 等价物（延时执行 + $evalAsync digest；
  // cancel 句柄表——updateSidebarListTimeout/calculateImageBindingTimeout 等域内自管
  // var 的 cancel 调用面语义不变）
  if (!timeoutCache) {
    if (!shimTimeoutInst) {
      const timers: any = {};
      let seq = 0;
      shimTimeoutInst = function (fn: any, ms?: number) {
        const id = ++seq;
        timers[id] = setTimeout(function () {
          delete timers[id];
          try { if (typeof fn === 'function') fn(); } catch (err) { console.error('[shimTimeout] fn failed', err); }
          try {
            const s = getBodyScope();
            if (s && typeof s.$evalAsync === 'function') scopeEvalAsync();
          } catch (err) { /* noop */ }
        }, ms || 0);
        return id;
      };
      shimTimeoutInst.cancel = function (id: any) {
        if (id != null && timers[id]) { clearTimeout(timers[id]); delete timers[id]; }
      };
    }
    timeoutCache = shimTimeoutInst;
  }
  return timeoutCache;
}

/* D-1 A-2：测试诊断计数（`window.__eagleMachinery.calls`）——替代 scope 挂载 spy
 * （m1-D-filter-watch / m1-D-rebind-broadcast / m1-E-selected-watch）。
 * 仅在函数入口自增，无任何行为影响。 */
export const machineryCalls: Record<string, number> = { rebindRefresh: 0, updateSelection: 0, filterContent: 0 };

export function machinerySeedControllerState(s: any): void {
  const w = window as any;
        s.libraryHistory = [];  // bundle 20535（seed 区间外的 controller init 字段——showTutorial 等消费）
        s.MAX_LIST_WIDTH = 900;
        syncToolbarFromScope();
        s.MAX_DIMENSION = 120000000;
        s.isHideMainNav = true;	// 3.0 侧栏
        s.isHideSidebar = false;
        s.isHideSubFolder = true;
        s.isHideNavigator = false;
        s.unlockPassword = "";
        // 音效三件套（bundle 20238-20254 逐字；$.playSound 由 js/vendors/jquery-audio.js 提供，
        // 该插件原内联在 app.bundle.js 内，b1-9d 后由 index.html 独立引入）
        s.removeSound = {
            play: function () {
                w.__eagleAudio.playSound('sounds/remove.wav');
            }
        };
        s.duplicateSound = {
            play: function () {
                w.__eagleAudio.playSound('sounds/duplicate.wav');
            }
        };
        s.errorSound = {
            play: function () {
                w.__eagleAudio.playSound('sounds/error.wav');
            }
        };
        // b1-9l：controller init 接线补种三件（b1-9g 台账根因 5 + fx/fc 补种）
        // platform（bundle 20066 `$scope.platform = process.platform`——BodyBindings 的
        // data-platform 属性唯一数据源，shim 世界此前无人写入）
        s.platform = w.process && w.process.platform ? w.process.platform : undefined;
        // containerSize（bundle 21095-21121 逐字；React 侧 bodyState:159 直接消费
        // scope.containerSize.sidebar、BodyBindings 面板 left = sidebarWidth+1——bundle 默认
        // 240 与 React 旧兜底 220 不一致，以 bundle 为准。$$rebind::refreshContainSize 广播
        // 为 Angular rebind 系统工件，shim 世界由 bodyState 的 watch 自动跟随；
        // #sidebar 的 resizable 指令（index.html:34）b1 后失效，拖拽写回链待办）
        s.containerSize = { sidebar: 240 };
        syncSidebarFromScope();
        syncTagManagerFromScope();
        const sidebarSizeRaw = localStorage.getItem("eagle.containerSize.sidebar");
        if (sidebarSizeRaw) {
            s.containerSize.sidebar = parseInt(sidebarSizeRaw);
            syncBodyFromScope();
            syncSidebarFromScope();
            syncTagManagerFromScope();
            if (s.containerSize.sidebar < 200) s.containerSize.sidebar = 200;
            syncBodyFromScope();
            syncSidebarFromScope();
            syncTagManagerFromScope();
        }
        const tagSidebarRaw = localStorage.getItem("eagle.containerSize.tagSidebar");
        if (tagSidebarRaw) {
            s.containerSize.tagSidebar = parseInt(tagSidebarRaw);
            syncBodyFromScope();
            syncSidebarFromScope();
            syncTagManagerFromScope();
        }
        const tagFilterRaw = localStorage.getItem("eagle.containerSize.tagFilter");
        if (tagFilterRaw) {
            s.containerSize.tagFilter = parseInt(tagFilterRaw);
            syncBodyFromScope();
            syncSidebarFromScope();
            syncTagManagerFromScope();
        }
        // fixUtils（bundle 20513 `$scope.fixUtils = {}`——fixutil 进度对话框开合状态载体；
        // 缺席时 body.fixUtils.isFixing 赋值直接 TypeError、7d6c 的 fx/fc 对话框永不出现）
        s.fixUtils = {};
        // containTags（bundle 20533 `$scope.containTags = []`——updateSuggestions/
        // machineryCalcuteFilterBadge 读取；缺席时 search 链在 updateSuggestions 处
        // TypeError 断链、filterContent 永不执行（b1-9o 探针实证））
        s.containTags = [];
        syncFilterFromScope();
        // page（bundle 21062 `$scope.page = 1`——rebindRefresh 的
        // `s.filtereds = s.allData.slice(0, s.len * s.page)` 乘数；缺席时 NaN →
        // filtereds 恒空数组（b1-9o 探针实证 a4 空态无法闭合））
        s.page = 1;
        // historySearchKeywords（bundle 21097-21103 逐字——updateSuggestions 首行读取，
        // 缺席时 search 防抖体 TypeError 断链、filterContent 永不执行（b1-9o 计数探针实证））
        var historySearchKeywords = localStorage.getItem("historySearchKeywords");
        if (historySearchKeywords) {
            try {
                s.historySearchKeywords = JSON.parse(historySearchKeywords);
            }
            catch (err) {
                s.historySearchKeywords = [];
            }
        }
        else {
            s.historySearchKeywords = [];
        }
        // initPlugins（bundle 20028 RootController init 调用——scope.inspector.inspectorItems
        // 只由它填充，stage6 的 tags/folders/annotations/information 分区渲染数据源；
        // eagleClasses 在 main.tsx 侧副作用安装，先于域接管；pluginModule 经 b1-9j 桥接）
        if (w.eagle && w.eagle.inspector && typeof w.eagle.inspector.initPlugins === 'function') {
            w.eagle.inspector.initPlugins();
        }
        // eagle（b1-9p：bundle $rootScope.eagle 的 shim 等价——scope 链上 'eagle.filter...'
        // 字符串 watcher（evalPath 经 coreState 解析）与 toolbarState 等快照的数据源；
        // 缺席时 watcher 读取抛 TypeError 被 flushWatchers 吞掉、listener 永不触发）
        s.eagle = w.eagle;
        // inspector.width（b1-9o：bundle 由 inspector 面板 resize 维护——React ResizeObserver 前
        // 对齐 inspectorState store 的兜底默认 300（ProgressBars/面板 right = width+1）；
        // s.inspector 即 w.eagle.inspector（bundle 21615 同引用）
        if (w.eagle && w.eagle.inspector && w.eagle.inspector.width === undefined) {
            w.eagle.inspector.width = 300;
        }
        s.len = 100;
        s.sidebarList = [];
        syncSidebarFromScope();
        s.sidebarIndex;
        s.all = [];
        syncSidebarFromScope();
        s.trash = [];
        syncSidebarFromScope();
        syncListFromScope();
        s.untaggedCount = 0;
        s.unfiledCount = 0;
        s.images = [];
        s.selected = [];
        syncInspectorFromScope();
        s.selectedMappings = {};
        s.lockedImages = {};
        s.filtereds = [];
        syncListFromScope();
        s.allData = [];
        syncListFromScope();
        s.shuffle = [];
        s.$root.selectedFolders = [];
        syncListFromScope();
        s.$root.selectedFoldersMappings = {};
        s.$root.selectedSmartFolders = [];
        s.$root.selectedSmartFoldersMappings = {};
        s.folderMappings = {};
        s.smartFolderMappings = {};
        s.uploadQueue = [];
        syncUploadFromScope();
        s.finishQueue = [];
        syncUploadFromScope();
        s.finishGenerateQueue = [];
        s.regenerateThumbnailQueue = [];
        
        s.duplicateQueue = [];
        s.$root.currentFocus = "sidebar";
        s.showSubfolderContent = false;
        s.showOriginalImageWhenLarge = localStorage.getItem("eagle.list.show.originalImageWhenLarge") !== 'false'
        syncPanelFromScope();
        s.showName = false;
        syncPanelFromScope();
        s.showMetas = false;
        syncPanelFromScope();
        s.showAnnotation = true;
        syncPanelFromScope();
        s.showFileExtension = true;
        syncPanelFromScope();
        s.showFileExtensionLabel = true;
        syncPanelFromScope();
        s.orderBy = localStorage.getItem("eagle.list.orderBy") || "IMPORT";
        syncBodyFromScope();
        s.orderByName = w.i18n.__(`context.order.orderBy>${s.orderBy.toLowerCase()}`);
        s.isSearchScopeName = true;
        s.isSearchScopeFolderName = true;
        s.isSearchScopeFolderDesc = true;
        s.isSearchScopeExt = true;
        s.isSearchScopeTag = true;
        s.isSearchScopeUrl = true;
        s.isSearchScopeAnnotation = true;
        s.isSearchScopeNote = true;
        s.listMetaType = localStorage.getItem("eagle.list.meta.type") || "RESOLUTION";
        syncPanelFromScope();
        s.sortIncrease = true;
        s.layout = "";
        s.layoutOptions = localStorage["eagle.list.layout.options"] || "Fit";
        syncPanelFromScope();
        s.paletteQueuePaused = false;
        syncSidebarFromScope();
        s.paletteQueueDelay = 20;
        
        // Grid Layout 相关
        s.itemMappings = {};
        s.modifiedMappings = {};
        s.options = {
            page: 60,           // 每页数量
            preload: 1,         // 预先载入页次，如果填写 3 表示载入 page x 3 个内容
            align: "left"     // 瀑布流排版对其方式
        };

        s.folderIcons = [

            // 集合、多媒体、工具
            { type: 'icon' },
            { type: 'icon', icon: 'library' },
            { type: 'icon', icon: 'box' },
            { type: 'icon', icon: 'grid' },
            { type: 'icon', icon: 'layer' },
            { type: 'icon', icon: 'briefcase' },
            { type: 'icon', icon: 'photo' },
            { type: 'icon', icon: 'photos' },
            { type: 'icon', icon: 'video' },
            { type: 'icon', icon: 'film' },
            { type: 'icon', icon: 'film2' },
            { type: 'icon', icon: 'film3' },
            { type: 'icon', icon: 'music' },
            { type: 'icon', icon: 'book' },
            { type: 'icon', icon: 'book2' },
            { type: 'icon', icon: 'bookshelf' },
            { type: 'icon', icon: 'keynote' },
            { type: 'icon', icon: 'camera' },
            { type: 'icon', icon: 'aperture' },
            { type: 'icon', icon: 'attachment' },
            { type: 'icon', icon: 'scissors' },
            { type: 'icon', icon: 'palette' },
            { type: 'icon', icon: 'wrench' },
            { type: 'icon', icon: 'helmet' },
            { type: 'icon', icon: 'life-buoy' },
            { type: 'icon', icon: 'graph' },
            { type: 'icon', icon: 'graph2' },
            { type: 'icon', icon: 'tableware' },
            { type: 'icon', icon: 'cog' },
            { type: 'icon', icon: 'bachelor-cap' },
            { type: 'icon', icon: 'cones' },
            { type: 'icon', icon: 'dribbble' },
            { type: 'icon', icon: 'email' },
            { type: 'icon', icon: 'business-card' },
            { type: 'icon', icon: 'coffee' },
            { type: 'icon', icon: 'cart' },
            { type: 'icon', icon: 'lightbulb' },
            { type: 'icon', icon: 'inspiration' },
            
            // { type: 'separator' },

            // 评价、符号、钱、时间
            { type: 'icon', icon: 'thumb-up' },
            { type: 'icon', icon: 'thumb-down' },
            { type: 'icon', icon: 'like' },
            { type: 'icon', icon: 'unlike' },
            { type: 'icon', icon: 'star' },
            { type: 'icon', icon: 'hot' },
            { type: 'icon', icon: 'upload' },
            { type: 'icon', icon: 'download' },
            { type: 'icon', icon: 'paid' },
            { type: 'icon', icon: 'free' },
            { type: 'icon', icon: 'medical' },
            { type: 'icon', icon: 'shield' },
            { type: 'icon', icon: 'search' },
            { type: 'icon', icon: 'shortcuts' },
            { type: 'icon', icon: 'recycle' },
            { type: 'icon', icon: 'excalmation' },
            { type: 'icon', icon: 'question' },
            { type: 'icon', icon: 'coin1' },
            { type: 'icon', icon: 'coin2' },
            { type: 'icon', icon: 'coin3' },
            { type: 'icon', icon: 'coin4' },
            { type: 'icon', icon: 'wallet' },
            { type: 'icon', icon: 'watch' },
            { type: 'icon', icon: 'clock' },
            { type: 'icon', icon: 'calendar-week' },
            { type: 'icon', icon: 'calendar-month' },

            { type: 'separator' },

            // 设备、图表、设计类型、字体
            { type: 'icon', icon: 'website' },
            { type: 'icon', icon: 'phone' },
            { type: 'icon', icon: 'tablet' },
            { type: 'icon', icon: 'desktop' },
            { type: 'icon', icon: 'tv' },
            { type: 'icon', icon: 'cpu' },
            { type: 'icon', icon: 'safari' },
            { type: 'icon', icon: 'chrome' },
            { type: 'icon', icon: 'pie' },
            { type: 'icon', icon: 'bar-chart' },
            { type: 'icon', icon: 'line-chart' },
            { type: 'icon', icon: '2d' },
            { type: 'icon', icon: '3d' },
            { type: 'icon', icon: 'contrast' },
            { type: 'icon', icon: 'texture' },
            { type: 'icon', icon: 'transition' },
            { type: 'icon', icon: 'animation' },
            { type: 'icon', icon: 'spectrogram' },
            { type: 'icon', icon: 'font-sans' },
            { type: 'icon', icon: 'font-sans-serif' },
            { type: 'icon', icon: 'font-handwritten' },

            // { type: 'separator' },

            { type: 'icon', icon: 'flag' },
            { type: 'icon', icon: 'earth' },
            { type: 'icon', icon: 'pin' },
            { type: 'icon', icon: 'pin-check' },
            { type: 'icon', icon: 'map' },
            { type: 'icon', icon: 'road' },
            { type: 'icon', icon: 'motor' },
            { type: 'icon', icon: 'rocket' },
            { type: 'icon', icon: 'airplan' },
            { type: 'icon', icon: 'ship' },
            { type: 'icon', icon: 'train' },
            { type: 'icon', icon: 'car' },
            { type: 'icon', icon: 'truck' },
            { type: 'icon', icon: 'water-drop' },
            { type: 'icon', icon: 'sun' },
            { type: 'icon', icon: 'moon' },
            { type: 'icon', icon: 'tree' },
            { type: 'icon', icon: 'mountain' },
            { type: 'icon', icon: 'cloud' },

            // { type: 'separator' },

            // 建筑、家俱、游戏、成就
            { type: 'icon', icon: 'bathtub' },
            { type: 'icon', icon: 'door' },
            { type: 'icon', icon: 'bed' },
            { type: 'icon', icon: 'cabinet' },
            { type: 'icon', icon: 'sofa' },
            { type: 'icon', icon: 'home' },
            { type: 'icon', icon: 'store' },
            { type: 'icon', icon: 'house' },
            { type: 'icon', icon: 'game' },
            { type: 'icon', icon: 'weapon' },
            { type: 'icon', icon: 'armor' },
            { type: 'icon', icon: 'award2' },
            { type: 'icon', icon: 'award' },
            { type: 'icon', icon: 'award3' },
            { type: 'icon', icon: 'crown' },
            { type: 'icon', icon: 'rophy' },
            { type: 'icon', icon: 'gift' },
            { type: 'icon', icon: 'facebook' },
            { type: 'icon', icon: 'twitter' },
            { type: 'icon', icon: 'instagram' },

            { type: 'separator' },

            // 人、動物、神、魔
            { type: 'icon', icon: 'eye' },
            { type: 'icon', icon: 'bear' },
            { type: 'icon', icon: 'dog' },
            { type: 'icon', icon: 'cat' },
            { type: 'icon', icon: 'man' },
            { type: 'icon', icon: 'woman' },
            { type: 'icon', icon: 'group' },
            { type: 'icon', icon: 'smile' },
            { type: 'icon', icon: 'meh' },
            { type: 'icon', icon: 'frown' },
            { type: 'icon', icon: 'die' },
            { type: 'icon', icon: 'baby' },
            { type: 'icon', icon: 'kid' },
            { type: 'icon', icon: 'angel' },
            { type: 'icon', icon: 'demon' },
            { type: 'icon', icon: 'hand' },
            { type: 'icon', icon: 'brain' },

            { type: 'separator' },

            // 数字
            { type: 'icon', icon: 'number0' },
            { type: 'icon', icon: 'number1' },
            { type: 'icon', icon: 'number2' },
            { type: 'icon', icon: 'number3' },
            { type: 'icon', icon: 'number4' },
            { type: 'icon', icon: 'number5' },
            { type: 'icon', icon: 'number6' },
            { type: 'icon', icon: 'number7' },
            { type: 'icon', icon: 'number8' },
            { type: 'icon', icon: 'number9' },
            { type: 'icon', icon: 'number10' },
            { type: 'icon', icon: 'number11' },
            { type: 'icon', icon: 'number12' },
            { type: 'icon', icon: 'number13' },
            { type: 'icon', icon: 'number14' },
            { type: 'icon', icon: 'number15' },
            { type: 'icon', icon: 'number16' },
            { type: 'icon', icon: 'number17' },
            { type: 'icon', icon: 'number18' },
            { type: 'icon', icon: 'number19' },
            { type: 'icon', icon: 'number20' },
        ];

        if (localStorage.getItem("isHideMainNav") == 'true') {
            s.isHideMainNav = true;
        }

        if (localStorage.getItem("isHideSidebar") == 'true') {
            s.isHideSidebar = true;
        }

        if (localStorage.getItem("isHideSubFolder") == 'false') {
            s.isHideSubFolder = false;
        }

        if (localStorage.getItem("eagle.list.sortIncrease") == 'false') {
            s.sortIncrease = false;
        }

        if (localStorage.getItem("isHideNavigator") == 'true') {
            s.isHideNavigator = true;
        }

        if (localStorage.getItem("eagle.search.scope.name") === 'false') { s.isSearchScopeName = false; }
        if (localStorage.getItem("eagle.search.scope.folderName") === 'false') { s.isSearchScopeFolderName = false; }
        if (localStorage.getItem("eagle.search.scope.folderDesc") === 'false') { s.isSearchScopeFolderDesc = false; }
        if (localStorage.getItem("eagle.search.scope.ext") === 'false') { s.isSearchScopeExt = false; }
        if (localStorage.getItem("eagle.search.scope.tag") === 'false') { s.isSearchScopeTag = false; }
        if (localStorage.getItem("eagle.search.scope.url") === 'false') { s.isSearchScopeUrl = false; }
        if (localStorage.getItem("eagle.search.scope.annotation") === 'false') { s.isSearchScopeAnnotation = false; }
        if (localStorage.getItem("eagle.search.scope.note") === 'false') { s.isSearchScopeNote = false; }
        // b1-9ab：searchFilter 管线（bundle 32182 逐字；machineryFilterContent 的
        // `data.filter(s.searchFilter)` 消费面——此前无定义、非空关键词 TypeError 被吞）
        // b1-9ad：颜色/黑白筛选（bundle 32689/32797 逐字；machineryFilterContent 的
        // data.filter(...) 消费面已改直调 machineryColorFilter/machineryGrayColorFilter）
        w.preferences = (w.electronSettings && w.electronSettings.getPreferences) ? w.electronSettings.getPreferences() : (w.preferences || {});
        s.showSubfolderContent = w.preferences.showSubfolderContent;

        if (localStorage.getItem("eagle.list.show.name") == 'false') {
            s.showName = false;
            syncPanelFromScope();
            addClass("#box-container", "hide-box-name");
        }
        else {
            s.showName = true;
            syncPanelFromScope();
            removeClass("#box-container", "hide-box-name");
        }

        if (localStorage.getItem("eagle.list.show.meta") == 'false') {
            s.showMetas = false;
            syncPanelFromScope();
            addClass("#box-container", "hide-box-metas");
        }
        else {
            s.showMetas = true;
            syncPanelFromScope();
            removeClass("#box-container", "hide-box-metas");
        }

        if (localStorage.getItem("eagle.list.show.annotation") == 'false') {
            s.showAnnotation = false;
            syncPanelFromScope();
            addClass("#box-container", "hide-box-annotation");
        }

        if (localStorage.getItem("eagle.list.show.extension") == 'false') {
            s.showFileExtension = false;
            syncPanelFromScope();
            addClass("#box-container", "hide-box-extension");
        }

        if (localStorage.getItem("eagle.list.show.extension_LABEL") == 'false') {
            s.showFileExtensionLabel = false;
            syncPanelFromScope();
            addClass("#box-container", "hide-box-extension-label");
        }

        let defaultListLayoutSettings = {
            props: {
                resolution: true,
                fileSize: true,
                dateImported: true,
                tags: false,
                extension: true,
                rating: false
            }
        };
        if (localStorage["eagle.list.layout.settings"]) {
            try {
                s.listLayoutSettings = JSON.parse(localStorage["eagle.list.layout.settings"]);
                syncBodyFromScope();
            } catch (err) {
                s.listLayoutSettings = defaultListLayoutSettings;
                syncBodyFromScope();
            }
        }
        else {
            s.listLayoutSettings = defaultListLayoutSettings;
            syncBodyFromScope();
        }

        s.imageSize = {
            height: 150,
            zoomRatio: 100,
            subfolderWidth: 150
        };
        syncToolbarFromScope();
        syncBodyFromScope();
        syncDetailFromScope();
        syncInspectorFromScope();
        s.sliderZoomRatio = 100;
        syncDetailFromScope();
        s.lastZoomMode = localStorage["eagle.viewer.lastZoomMode"] || "fit";
        syncDetailFromScope();
        s.tagsSuggestion = [];
        s.folders = [];
        s.smartFolders = [];
        s.quickAccess = [];
        syncSidebarFromScope();
        s.isExpandFolder = true;
        syncSidebarFromScope();
        s.isExpandSmartFolder = true;
        syncSidebarFromScope();
        s.isExpandQuickAccess = true;
        syncSidebarFromScope();

        if (localStorage.getItem("eagle.sidebar.folder.expand") == 'false') {
            s.isExpandFolder = false;
            syncSidebarFromScope();
        }
        if (localStorage.getItem("eagle.sidebar.smartFolder.expand") == 'false') {
            s.isExpandSmartFolder = false;
            syncSidebarFromScope();
        }
        if (localStorage.getItem("eagle.sidebar.quickAccess.expand") == 'false') {
            s.isExpandQuickAccess = false;
            syncSidebarFromScope();
        }

        s.inspector = w.eagle.inspector;
}

export function scopeSingleton<T>(s: any, key: string, make: () => T): T {
  let m = singletonByScope.get(s);
  if (!m) { m = new Map(); singletonByScope.set(s, m); }
  if (!m.has(key)) m.set(key, make());
  return m.get(key) as T;
}

let shimTimeoutInst: any = null;

const singletonByScope = new WeakMap<object, Map<string, any>>();

let timeoutCache: any = null;
