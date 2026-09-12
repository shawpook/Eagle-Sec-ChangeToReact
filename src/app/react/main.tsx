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
// 此处仅保留「就绪门 + 域接管」排序（域接管须在任何子窗口/驱动调用前完成）。
function bridgeWhenReady(attempt = 0): void {
  installDriverApi();
  installScopeRegistry();
  // 强就绪门：域接管前置条件是清单/供给面可用（mousetrap 由 miscRawState 默认 {} 供给）。
  const ready = !!getDriverApi().mousetrap;
  if (ready) {
    installPortsProbe();
    // cz1/cz2/m1 诊断契约：字段读写经 scope 面/store 注册表（`__eagleCoreState` 即面本体）。
    (window as any).__eagleCoreState = getScopeFace();
    applyDataMachineryScope();
    takeoverPreferencesDomain();
    takeoverLibraryDomain();
    takeoverItemDomain();
    takeoverFilterDomain();
    takeoverSelectionViewDomain();
    takeoverMiscDomain();
    return;
  }
  if (attempt < 100) setTimeout(() => bridgeWhenReady(attempt + 1), 200);
}
// b1-9bz-C-0：跨窗口 / 驱动脚本的 scope 面供给走**延迟注册**。
// 静态 import 会让这些 service 在 dataMachinery 完成求值前执行（见 core/externalSupply.ts
// 的说明），打断启动加载链；这里立即发起动态 import（不进入静态依赖图），bridge 成功时
// 再 await 就绪，保证挂载点在任何子窗口 / 驱动调用前可用。
void import('./core/externalSupplyRegistrar')
  .then(() => { (window as any).__eagleSupplyState = 'ok'; })
  .catch((e: any) => { (window as any).__eagleSupplyState = 'err:' + String(e && e.message); });

installBundleGlobals();
installApiServerGlobals();
installInitAPIServer();
exposeScopeFaceDiagnostics();
bridgeWhenReady();
(window as any).__eagleDetailState = useDetailState;
