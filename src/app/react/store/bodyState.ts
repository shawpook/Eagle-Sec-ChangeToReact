import { create } from 'zustand';
import { usePanelState } from './panelState';
import { useFilterState } from './filterState';
import { migrateScopeFieldToStore } from '../core/scopeFieldBridge';
;
import { usePreferencesState } from './preferencesState';
import { useFolderState } from './folderState';
import { useMiscRawState } from './miscRawState';
import { useLayoutState } from './layoutState';
import { useListState } from './listState';

/**
 * 11-pre a8：body 绑定层状态源（body ng-class 28 项 + class 插值 + theme/platform/vibrancy
 * attrs + link#app-style ng-href + #main-app ui-ready + #list-content-panel ng-class/style +
 * #box-container ng-show/ng-class）。快照由 BodyBindings 组件直写 DOM（C 模式，元素为
 * 静态壳节点），字段与原模板绑定逐一对应。
 */

interface BodyState {
  theme: string;
  platform: string;
  language: string;
  currentFocus: string;
  viewMode: string;
  isLoading: boolean;
  layoutOptions: string;
  isWin11: boolean;
  isDetailMode: boolean;
  isInlineMode: boolean;
  isCommentMode: boolean;
  isGrayscaleMode: boolean;
  isHideNavigator: boolean;
  smoothZoomDone: boolean;
  imageHeight: number;
  layout: string;
  listPropResolution: boolean;
  listPropDateImported: boolean;
  listPropTags: boolean;
  listPropRating: boolean;
  listPropExtension: boolean;
  listPropFileSize: boolean;
  boxSortable: boolean;
  isCropMode: boolean;
  isMaximize: boolean;
  isHideSidebar: boolean;
  isHideInspector: boolean;
  filterOpen: boolean;
  isSlideshowMode: boolean;
  hideBadge: boolean;
  hideZoomBtn: boolean;
  showTransparentGrid: boolean;
  hasCurrentComment: boolean;
  vibrancyEnabled: boolean;
  sidebarWidth: number;
  inspectorWidth: number;
  isCleaningTrash: boolean;
  removeProgress: number;
}

export const useBodyState = create<BodyState>(() => ({
  theme: 'dark',
  isLoading: false,
  platform: '',
  language: '',
  currentFocus: '',
  viewMode: 'all',
  layoutOptions: '',
  isWin11: false,
  isDetailMode: false,
  isInlineMode: false,
  isCommentMode: false,
  isGrayscaleMode: false,
  isHideNavigator: false,
  smoothZoomDone: true,
  imageHeight: 0,
  layout: '',
  listPropResolution: false,
  listPropDateImported: false,
  listPropTags: false,
  listPropRating: false,
  listPropExtension: false,
  listPropFileSize: false,
  boxSortable: false,
  isCropMode: false,
  isMaximize: false,
  isHideSidebar: false,
  isHideInspector: false,
  filterOpen: false,
  isSlideshowMode: false,
  hideBadge: false,
  hideZoomBtn: false,
  showTransparentGrid: false,
  hasCurrentComment: false,
  vibrancyEnabled: false,
  sidebarWidth: 220,
  inspectorWidth: 300,
  isCleaningTrash: false,
  removeProgress: 0,
}));

// b1-9az：彻底化 R1 首批源翻转——bodyState 20 个顶层同名字段以本 store 为唯一状态源
// （scopeShim get/set 委托，startScopeSync 对这些字段退化为无害回声）。派生字段
// （imageHeight/listProp*/boxSortable/hideBadge 等）与嵌套路径（inspector.*、
// preferences.*、containerSize.*、currentFolder.*）暂留快照链，后续批次按同机制
// 逐组迁移（REWRITE-PLAN.md 阶段 1）。
const MIGRATED_SCOPE_FIELDS: ReadonlyArray<keyof BodyState> = [
  'theme', 'platform', 'language', 'currentFocus', 'viewMode', 'isLoading', 'layoutOptions',
  'isWin11', 'isDetailMode', 'isInlineMode', 'isCommentMode', 'isGrayscaleMode',
  'isHideNavigator', 'smoothZoomDone', 'layout', 'isCropMode', 'isMaximize',
  'isHideSidebar', 'isSlideshowMode', 'vibrancyEnabled',
  'isCleaningTrash', 'removeProgress',
];
for (const fieldName of MIGRATED_SCOPE_FIELDS) {
  migrateScopeFieldToStore(
    fieldName,
    () => useBodyState.getState()[fieldName],
    // b1-9az：同值守卫——scope 侧 watcher 在每次 $evalAsync flush 都会回写同值字段
    // （libraryDomain 注册信息链，7c welcome-open 实锚），无守卫则每次 flush 都 setState
    // → BodyBindings（整写 body.className）重渲染抹掉外部命令式 class（is-welcome-page）
    (value: any) => {
      if (useBodyState.getState()[fieldName] !== value) useBodyState.setState({ [fieldName]: value } as Partial<BodyState>);
    },
  );
}

let bound = false;

function buildBodySnapshot(): Partial<BodyState> {
      const currentFolderOrderBy = useFolderState.getState().currentFolder && useFolderState.getState().currentFolder.orderBy;
      const filterBadge = (useMiscRawState.getState().eagle && useMiscRawState.getState().eagle.filter && useMiscRawState.getState().eagle.filter.filterBadge) || 0;
      const general = (usePreferencesState.getState().preferences && usePreferencesState.getState().preferences.general) || {};
      const habits = (usePreferencesState.getState().preferences && usePreferencesState.getState().preferences.habits) || {};
      const props = (useMiscRawState.getState().listLayoutSettings && useMiscRawState.getState().listLayoutSettings.props) || {};
      return {
        imageHeight: (useLayoutState.getState().imageSize && useLayoutState.getState().imageSize.height) || 0,
        listPropResolution: !!props.resolution,
        listPropDateImported: !!props.dateImported,
        listPropTags: !!props.tags,
        listPropRating: !!props.rating,
        listPropExtension: !!props.extension,
        listPropFileSize: !!props.fileSize,
        boxSortable: !!(
          useFolderState.getState().currentFolder
          && ((currentFolderOrderBy === 'MANUAL' || currentFolderOrderBy === 'IMPORT')
            || (!currentFolderOrderBy && useMiscRawState.getState().orderBy === 'IMPORT'))
          && !filterBadge
          && !useListState.getState().keyword
        ),
        isHideInspector: !!(useMiscRawState.getState().inspector && useMiscRawState.getState().inspector.isHideInspector),
        filterOpen: !!(useMiscRawState.getState().eagle && useMiscRawState.getState().eagle.filter && useMiscRawState.getState().eagle.filter.isOpen),
        hideBadge: general.showSidebarBadge == 'false',
        hideZoomBtn: habits.hoverZoom == 'off',
        showTransparentGrid: habits.transparency == 'show',
        hasCurrentComment: !!useMiscRawState.getState().currentComment,
        sidebarWidth: (useLayoutState.getState().containerSize && useLayoutState.getState().containerSize.sidebar) || 220,
        inspectorWidth: (useMiscRawState.getState().inspector && useMiscRawState.getState().inspector.width) || 300,
      } as Partial<BodyState>;
}

// b1-9by-C：快照深比较守卫（scopeBridge startScopeSync 同款语义）。
function shallowEqBody(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k] === b[k]);
}

let lastBodySnapshot: any = null;

/** b1-9by-C：快照直写收敛——原 startScopeSync 200ms 轮询退役。 */
export function syncBodyFromScope(): void {
  const next = buildBodySnapshot();
  if (lastBodySnapshot !== null && shallowEqBody(next, lastBodySnapshot)) return;
  lastBodySnapshot = next;
  useBodyState.setState(next as any);
}

export function bindBodySync(): void {
  // 供闭环测试直写 scope 后手动驱动（原 $evalAsync 触发快照链的等价物）。
  (window as any).__eagleBodySync = syncBodyFromScope;
  // 供闭环测试（CDP Runtime.evaluate）直接访问 React 全局状态，不参与业务逻辑。
  (window as any).__eagleBodyState = useBodyState;
  useFilterState.subscribe(() => syncBodyFromScope());
  usePanelState.subscribe(() => syncBodyFromScope());
  // 启动期一次性对齐。
  syncBodyFromScope();
}
