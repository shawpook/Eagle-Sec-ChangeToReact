// R6：必须最先求值——eagle 基座（原 js/lib/eagle-api.js + js/lib/api/url-enlarger.js 两个
// 独立脚本 + 内联 urlEnlargerRemote.load 调用）。shimsLegacy 的演示态种子在模块求值期即读
// window.eagle，ESM 按源码顺序求值 import，故次序即契约。见 core/eagleBase.ts。
import './core/eagleBase';
import './core/shimsLegacy';
import { createRoot } from 'react-dom/client';
import { AppRoot } from './app/AppRoot';
import { SavingProgressBar, UploadQueueProgressBar } from './components/shell/ProgressBars';
import { ToastAlerts } from './components/shell/ToastAlerts';
import { FolderLockScreen, AppLockScreen } from './components/shell/LockScreens';
import { BodyBindings, BoxContainerBindings, AppMenuButton, HoverShowSidebar, SidebarResizable, DetailWrapper } from './components/shell/BodyBindings';
import { DropAreas, ScrollToTop, SubFolderSection, ListLayoutHeader, PanelDropArea, BoxContainerListeners, GridDirectivesBinding } from './components/shell/ListRegion';
import { ColorsPicker, AnnotationPreviewContainer } from './components/shell/MiscContainers';
import { Sidebar } from './components/sidebar/Sidebar';
import { Toolbar, SearchSuggestions } from './components/toolbar/Toolbar';
import { FilterPanel } from './components/filter/FilterItems2';
import { BoxList } from './components/grid/BoxList';
import { DetailPanel } from './components/detail/DetailPanel';
import { InspectorPanel } from './components/inspector/Inspector';
import { ContextMenuPanel } from './components/stage7/ContextMenu';
import { TagManagerPanel } from './components/stage7/TagManager';
import { LayoutPanel, NotificationModal, NewVersionModal, FolderPasswordModal, MousewheelModal, AboutPanel, WelcomePage } from './components/stage7/SmallPanels';
import { QuickSearchModal } from './components/stage7/QuickSearchModal';
import { ErrorModal, WebsitePanel } from './components/stage7/ControllerModals';
import { GeneralTagSelectPanel, AutoTaggingModal } from './components/stage7/SelectPanels';
import { FolderSelectPanelHost, NewSmartFolderModal } from './components/stage7/FolderSelectPanels';
import { BatchRenameModal, ArtstationImportModal } from './components/stage7/BatchRenameArtstationModals';
import { InspectorTagSelectPanel } from './components/stage7/InspectorTagSelectPanel';
import { BatchSavePanel } from './components/stage7/BatchSavePanel';
import { DuplicateScanPanel, DuplicateModal } from './components/stage7/DuplicateFamily';
import { PluginPanel, PluginCreator } from './components/stage7/PluginFamily';
import { PluginCenter } from './components/stage7/PluginCenter';
import { EmptyTrashProgress, LibraryLoadProgress, LibraryMergeProgress, EaglepackImportProgress, EaglepackExportProgress, FileThumbnailProgress, FileExportProgress, FileAddLibraryProgress, DebugReportProgress, WebpConvertProgress, FixutilCleanEmptyFolderProgress, FixutilProgress } from './components/stage7/ProgressDialogs';
import { AddToFolderModal, MoveFolderModal } from './components/stage7/FolderModals';
import { useAppState } from './store/appState';
import { bindSidebarSync } from './store/sidebarState';
import { bindToolbarSync } from './store/toolbarState';
import { bindFilterSync } from './store/filterState';
import { bindDetailSync, useDetailState } from './store/detailState';
import { bindInspectorSync } from './store/inspectorState';
import { bindTagManagerSync } from './store/tagManagerState';
import { bindPanelSync } from './store/panelState';
import { bindUploadSync } from './store/uploadState';
import { bindToastSync } from './store/toastState';
import { bindLockSync } from './store/lockState';
import { eagle as coreEagle } from './core/eagleApi';
import { getDriverApi, installDriverApi } from './core/driverApi';
import { exposeScopeFaceDiagnostics, getScopeFace, installScopeRegistry } from './core/scopeFace';
// F10：跨窗供给名单/装载 Promise（零依赖模块，注册端仍走动态 import）与启动就绪序列。
import { EXTERNAL_SUPPLY_NAMES, loadExternalSupply, registeredExternalSupplyNames } from './core/externalSupply';
import { startBoot } from './core/bootSequence';
import { installDetailDeliveryGate } from './core/detailDeliveryGate';
import { installIpcWriteState } from './core/ipcWriteState';
import { installReturnBridge } from './core/returnBridge';
import { installDocumentViewer } from './core/documentViewer';
import { takeoverPreferencesDomain } from './core/preferencesDomain';

import { installPortsProbe } from './core/portsProbe';
import { installBundleGlobals } from './core/bundleGlobals';
import { installApiServerGlobals, installInitAPIServer } from './core/apiServerDomain';
import { takeoverLibraryDomain } from './core/libraryDomain';
import { takeoverItemDomain } from './core/itemDomain';
import { takeoverFilterDomain } from './core/filterDomain';
import { takeoverSelectionViewDomain } from './core/selectionViewDomain';
import { takeoverMiscDomain } from './core/miscDomain';
import './core/eagleClasses';
import { bindListSync } from './store/listState';
import { bindBodySync } from './store/bodyState';
import { bindSelectionSync } from './store/selectionState';
import { bindItemSync } from './store/itemState';
import { bindFolderSync } from './store/folderState';
import { bindLayoutSync } from './store/layoutState';
import { bindPreferencesSync } from './store/preferencesState';
import { bindMiscRawSync } from './store/miscRawState';

import { applyDataMachineryScope } from './core/machineryInfra';
/**
 * React 入口（Eagle React 化改造）。
 *
 * 接线原则：
 * - 入口仍是 src/app/index.html；本模块由 vite 以 `<script type="module">` 注入依赖。
 * - 改造是「逐步替换」：Angular 壳在迁移完成前保留，React 层通过宿主容器逐块接管。
 * - 尚未接管的区域仍由 Angular 渲染，避免同节点双渲染冲突。
 * - window.i18n / window.eagle / window.eagleDesktop / window.electronSettings 等全局由
 *   frontend/public/shims.js 或 preload.cjs 建好，React 层直接读取，不复制逻辑。
 */

// 全局共享状态的类型声明（数据面通过全局对象读取，零复制）。
declare global {
  interface Window {
    i18n: any;
    eagle: any;
    eagleDesktop: any;
    electronSettings: any;
    $bodyScope?: any;
    module?: any;
    __mockLibrary?: any;
  }
}

function pickMountHost(): HTMLElement {
  // 优先使用专用宿主，若不存在则回退到 body 末尾追加（避免抢占 Angular 容器）。
  let host = document.getElementById('eagle-react-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'eagle-react-host';
    host.style.cssText = 'position: relative; z-index: 0;';
    document.body.appendChild(host);
  }
  return host;
}

const host = pickMountHost();
const root = createRoot(host, {
  onUncaughtError: (error: any) => {
    (window as any).__reactErr = 'UNCAUGHT: ' + String((error && error.stack) || error).slice(0, 800);
  },
  onCaughtError: (error: any) => {
    (window as any).__reactErr = 'CAUGHT: ' + String((error && error.stack) || error).slice(0, 800);
  },
} as any);
root.render(
  <>
    <AppRoot />
    <BodyBindings />
    <BoxContainerBindings />
    <BoxContainerListeners />
    <GridDirectivesBinding />
    <AppMenuButton />
    <HoverShowSidebar />
    <SidebarResizable />
    <DetailWrapper />
    <SavingProgressBar />
    <UploadQueueProgressBar />
    <ToastAlerts />
    <FolderLockScreen />
    <AppLockScreen />
    <DropAreas />
    <ScrollToTop />
    <SubFolderSection />
    <ListLayoutHeader />
    <PanelDropArea />
    <ColorsPicker />
    <AnnotationPreviewContainer />
    <Sidebar />
    <Toolbar />
    <SearchSuggestions />
    <FilterPanel />
    <BoxList />
    <DetailPanel />
    <InspectorPanel />
    <ContextMenuPanel />
    <TagManagerPanel />
    <QuickSearchModal />
    <AddToFolderModal />
    <MoveFolderModal />
    <ErrorModal />
    <WebsitePanel />
    <GeneralTagSelectPanel />
    <AutoTaggingModal />
    <FolderSelectPanelHost />
    <NewSmartFolderModal />
    <BatchRenameModal />
    <ArtstationImportModal />
    <InspectorTagSelectPanel />
    <BatchSavePanel />
    <DuplicateScanPanel />
    <DuplicateModal />
    <PluginPanel />
    <PluginCreator />
    <PluginCenter />
    <EmptyTrashProgress />
    <LibraryLoadProgress />
    <LibraryMergeProgress />
    <EaglepackImportProgress />
    <EaglepackExportProgress />
    <FileThumbnailProgress />
    <FileExportProgress />
    <FileAddLibraryProgress />
    <DebugReportProgress />
    <WebpConvertProgress />
    <FixutilCleanEmptyFolderProgress />
    <FixutilProgress />
    <LayoutPanel />
    <NotificationModal />
    <NewVersionModal />
    <FolderPasswordModal />
    <MousewheelModal />
    <AboutPanel />
    <WelcomePage />
  </>
);

// 阶段2/3：scope → React 快照同步（Angular digest 驱动）。
bindSidebarSync();
bindToolbarSync();
bindFilterSync();
bindDetailSync();
bindInspectorSync();
bindTagManagerSync();
bindPanelSync();
bindUploadSync();
bindToastSync();
bindLockSync();
bindListSync();
bindBodySync();
// b1-9bz-E2-1：选区/条目真身 store（注册式双写；字段读写仍走 scope，E3 再改读点）
bindSelectionSync();
bindItemSync();
bindFolderSync();
bindLayoutSync();
bindPreferencesSync();
bindMiscRawSync();

// 供闭环测试（CDP Runtime.evaluate）直接访问 React 全局状态，不参与业务逻辑。
(window as any).__eagleReactStore = useAppState;
// c2：React 侧 eagle 对象族（bundle 实例仍为权威态，随 c 域切片逐步切换消费方）。
(window as any).__eagleCoreEagle = coreEagle;

// cZ-1 → b1-9bz-E5-2：Angular body-scope 与字段访问器桥均退役。
//  - 应用内部书写 → `core/scopeFace.getScopeFace()`（store 后端）；
//  - 跨边界消费（main.cjs / shims.js / 子窗口）→ `core/driverApi` 的 `window.__eagleDriver`
//    + `__eagleScopeRegistry`（测试诊断口）。
//  - 过渡态：`window.$bodyScope` / `__eagleCoreState` 仍是同一 store 后端面（E5-3 迁测试
//    观测口、E5-4 删除），故本批测试与驱动零改动。
// F10（m1-f10-bootready）：启动收敛为**单一就绪 Promise**（core/bootSequence）。
//
// 修前：`void import('./core/externalSupplyRegistrar')` 从未被 await，`bridgeWhenReady`
// 的就绪判据只有 `!!getDriverApi().mousetrap` 一项，紧接着就执行六域接管 —— 子窗口
// （viewers/font、viewers/text-editor）与主 UI 驱动脚本（electron/main.cjs）可能在跨窗
// 供给注册完成前调用，经 callExternal 拿到 undefined 并**静默失败**。
//
// 修后依赖顺序：驱动面安装 → 就绪门判据（driver 面身份 + scope 面 + mousetrap）→
// 挂载 + 六域接管（**同一同步前缀**）→ 跨窗供给注册（动态 import 真正 await + 10/10 校验）→
// 终检 → 宣告 `__eagleBootState = 'ready'`。
//
// 「挂载 + 六域接管」为何在供给注册之前：六域接管处即注册主进程的**一次性**启动事件
// 监听（`ipc.on('app-status-library-loaded')` 等），回调体又依赖 machinery 挂载面
// （`w.ScrollbarSaver` / `scope.reload`）。把任一侧推迟到动态 import 之后即永久丢事件、
// 库数据不落 raw（实测 D3 闭环 FAIL；三组 A/B 与根因见 core/bootSequence.ts 头部）。
// 即「先注册供给、再域接管」的字面顺序在本架构下不可实现；其实质目的仍满足：供给注册被
// 真正 await 且先于就绪宣告，未就绪窗口内的跨窗调用按「明确失败」策略可观测
// （抛 ExternalSupplyNotReadyError + 留痕，不再静默返回 undefined）。
//
// 动态 import **保留**（静态 import 会改变 ESM 求值顺序、打断启动加载链，见
// core/externalSupply.ts 顶部说明），但「立即发起」与「等待完成」被拆开：
// 这里照旧在模块求值期发起（不进入静态依赖图，与改造前同刻），装载 Promise 由
// `loadExternalSupply` 记忆化 —— 序列器 await 它，重复调用只装载/注册一次。
(window as any).__eagleSupplyState = 'pending';
const supplyLoad = loadExternalSupply(() => import('./core/externalSupplyRegistrar'));
// 失败由启动序列的 await 与 `__eagleSupplyState`/`__eagleBootState` 承接，此处仅避免未处理拒绝。
supplyLoad.catch(() => undefined);

installBundleGlobals();
installApiServerGlobals();
installInitAPIServer();
exposeScopeFaceDiagnostics();
// P2：详情原图交付门控。原先由 shims 以 25ms 轮询包装 scope 面 → React UI 各入口直调
// machineryEnterDetailMode（非同一函数对象）故不生效；现由 React 直接挂钩 enter/leave。
installDetailDeliveryGate();
// P1-c-2：写路径共享状态唯一实例（shims 消费方经 window.__eagleIpcWriteState 取同一
// 队列/计数器/发布器；channelBridge 的 images-change 分支亦用此实例）。
installIpcWriteState();
// P1-c-4：主进程回程扇出迁入 React（置 __eagleReturnBridgeInstalled；shims 同块的
// 0ms 延迟注册检测该标记后跳过，保证单注册）。须早于 shims 的 timer 派发。
installReturnBridge();
// P4：documentViewer 编排自 shims 迁入（驱动面 enterDetailMode 文档扩展名挂钩 + 工作区容器）。
installDocumentViewer();
// F10：单一启动就绪序列。`__eagleBootState` 在全部判据满足后才会是 'ready'；
// 域接管须在任何子窗口 / 驱动调用前完成（判据与执行序见 core/bootSequence.ts）。
startBoot({
  environment: window,
  installDriverApi,
  installScopeRegistry,
  getDriverApi,
  getScopeFace,
  loadSupply: () => supplyLoad,
  supplyNames: EXTERNAL_SUPPLY_NAMES,
  registeredSupplyNames: registeredExternalSupplyNames,
  // 挂载：诊断口 → 核心状态诊断口 → machinery 的 scope 面挂载（与六域接管同处同步前缀）。
  mountSteps: [
    { name: 'portsProbe', run: installPortsProbe },
    // cz1/cz2/m1 诊断契约：字段读写经 scope 面/store 注册表（`__eagleCoreState` 即面本体）。
    // 步骤名不叫 'coreState'：哨兵以 `/\bcoreState\b/` 统计非注释行做 scope 字符串键收敛
    // 台账，裸词会把它误计为回退项（实测 SENTINEL_REGRESSED metric coreState: 1 > baseline 0）。
    { name: 'scopeFaceAlias', run: () => { (window as any).__eagleCoreState = getScopeFace(); } },
    { name: 'machineryScope', run: applyDataMachineryScope },
  ],
  // 六域接管：与挂载同在同步前缀内完成（见上方一次性启动事件说明）。
  takeoverSteps: [
    { name: 'preferences', run: takeoverPreferencesDomain },
    { name: 'library', run: takeoverLibraryDomain },
    { name: 'item', run: takeoverItemDomain },
    { name: 'filter', run: takeoverFilterDomain },
    { name: 'selectionView', run: takeoverSelectionViewDomain },
    { name: 'misc', run: takeoverMiscDomain },
  ],
}).catch((error) => {
  // 未就绪即 reject：失败已由 __eagleBootState / __eagleBootFailures 留痕，此处只避免未处理拒绝。
  console.error('[boot] 启动未就绪', error);
});
(window as any).__eagleDetailState = useDetailState;
