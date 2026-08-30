import { createRoot } from 'react-dom/client';
import { AppRoot } from './app/AppRoot';
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
import { AddToFolderModal, MoveFolderModal } from './components/stage7/FolderModals';
import { useAppState } from './store/appState';
import { bindSidebarSync } from './store/sidebarState';
import { bindToolbarSync } from './store/toolbarState';
import { bindFilterSync } from './store/filterState';
import { bindDetailSync, useDetailState } from './store/detailState';
import { bindInspectorSync } from './store/inspectorState';
import { bindTagManagerSync } from './store/tagManagerState';
import { bindPanelSync } from './store/panelState';

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
const root = createRoot(host);
root.render(
  <>
    <AppRoot />
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

// 供闭环测试（CDP Runtime.evaluate）直接访问 React 全局状态，不参与业务逻辑。
(window as any).__eagleReactStore = useAppState;
(window as any).__eagleDetailState = useDetailState;
