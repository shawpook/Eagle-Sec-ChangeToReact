import { create } from 'zustand';
import { startScopeSync } from '../global/scopeBridge';
import { migrateScopeFieldToStore } from '../global/scopeShim';

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

export function bindBodySync(): void {
  if (bound) return;
  bound = true;

  // 供闭环测试（CDP Runtime.evaluate）直接访问 React 全局状态，不参与业务逻辑。
  (window as any).__eagleBodyState = useBodyState;

  startScopeSync({
    // b1-9az：MIGRATED_SCOPE_FIELDS 已源翻转（store 为源）——不再入快照。若留在 build 里，
    // 强转快照（如 viewMode undefined → 'all'）会经 apply 写回 store，篡改源值
    // （openFolder 写 undefined、200ms 内被回声改写 'all'，破坏 `!s.viewMode` 守卫——
    // suite 7c/1cz1/residue 三红实锚）。裸值语义 = 原 coreState 语义；展示级默认
    // （viewMode || 'all'）由消费点负责。
    watch: [
      'imageSize.height',
      'listLayoutSettings.props.resolution', 'listLayoutSettings.props.dateImported',
      'listLayoutSettings.props.tags', 'listLayoutSettings.props.rating',
      'listLayoutSettings.props.extension', 'listLayoutSettings.props.fileSize',
      'currentFolder.orderBy', 'orderBy', 'eagle.filter.filterBadge', 'keyword',
      'inspector.isHideInspector', 'eagle.filter.isOpen',
      '$root.preferences.general.showSidebarBadge',
      '$root.preferences.habits.hoverZoom', '$root.preferences.habits.transparency',
      'currentComment', 'containerSize.sidebar', 'inspector.width',
    ],
    build: (scope) => {
      const currentFolderOrderBy = scope.currentFolder && scope.currentFolder.orderBy;
      const filterBadge = (scope.eagle && scope.eagle.filter && scope.eagle.filter.filterBadge) || 0;
      const general = (scope.$root && scope.$root.preferences && scope.$root.preferences.general) || {};
      const habits = (scope.$root && scope.$root.preferences && scope.$root.preferences.habits) || {};
      const props = (scope.listLayoutSettings && scope.listLayoutSettings.props) || {};
      return {
        imageHeight: (scope.imageSize && scope.imageSize.height) || 0,
        listPropResolution: !!props.resolution,
        listPropDateImported: !!props.dateImported,
        listPropTags: !!props.tags,
        listPropRating: !!props.rating,
        listPropExtension: !!props.extension,
        listPropFileSize: !!props.fileSize,
        boxSortable: !!(
          scope.currentFolder
          && ((currentFolderOrderBy === 'MANUAL' || currentFolderOrderBy === 'IMPORT')
            || (!currentFolderOrderBy && scope.orderBy === 'IMPORT'))
          && !filterBadge
          && !scope.keyword
        ),
        isHideInspector: !!(scope.inspector && scope.inspector.isHideInspector),
        filterOpen: !!(scope.eagle && scope.eagle.filter && scope.eagle.filter.isOpen),
        hideBadge: general.showSidebarBadge == 'false',
        hideZoomBtn: habits.hoverZoom == 'off',
        showTransparentGrid: habits.transparency == 'show',
        hasCurrentComment: !!scope.currentComment,
        sidebarWidth: (scope.containerSize && scope.containerSize.sidebar) || 220,
        inspectorWidth: (scope.inspector && scope.inspector.width) || 300,
      } as Partial<BodyState>;
    },
    apply: (snapshot) => useBodyState.setState(snapshot as Partial<BodyState>),
  });
}
