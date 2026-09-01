import { create } from 'zustand';
import { startScopeSync } from '../global/scopeBridge';

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

let bound = false;

export function bindBodySync(): void {
  if (bound) return;
  bound = true;

  // 供闭环测试（CDP Runtime.evaluate）直接访问 React 全局状态，不参与业务逻辑。
  (window as any).__eagleBodyState = useBodyState;

  startScopeSync({
    watch: [
      'theme', 'platform', 'language', 'currentFocus', 'viewMode', 'isLoading', 'layoutOptions',
      'isWin11', 'isDetailMode', 'isInlineMode', 'isCommentMode', 'isGrayscaleMode',
      'isHideNavigator', 'smoothZoomDone', 'imageSize.height', 'layout',
      'listLayoutSettings.props.resolution', 'listLayoutSettings.props.dateImported',
      'listLayoutSettings.props.tags', 'listLayoutSettings.props.rating',
      'listLayoutSettings.props.extension', 'listLayoutSettings.props.fileSize',
      'currentFolder.orderBy', 'orderBy', 'eagle.filter.filterBadge', 'keyword',
      'isCropMode', 'isMaximize', 'isHideSidebar', 'inspector.isHideInspector',
      'eagle.filter.isOpen', 'isSlideshowMode', '$root.preferences.general.showSidebarBadge',
      '$root.preferences.habits.hoverZoom', '$root.preferences.habits.transparency',
      'currentComment', 'vibrancyEnabled', 'containerSize.sidebar', 'inspector.width',
    ],
    build: (scope) => {
      const currentFolderOrderBy = scope.currentFolder && scope.currentFolder.orderBy;
      const filterBadge = (scope.eagle && scope.eagle.filter && scope.eagle.filter.filterBadge) || 0;
      const general = (scope.$root && scope.$root.preferences && scope.$root.preferences.general) || {};
      const habits = (scope.$root && scope.$root.preferences && scope.$root.preferences.habits) || {};
      const props = (scope.listLayoutSettings && scope.listLayoutSettings.props) || {};
      return {
        theme: scope.theme || 'dark',
        platform: scope.platform || '',
        language: scope.language || '',
        currentFocus: scope.currentFocus || '',
        viewMode: scope.viewMode || 'all',
        isLoading: !!scope.isLoading,
        layoutOptions: scope.layoutOptions || '',
        isWin11: !!scope.isWin11,
        isDetailMode: !!scope.isDetailMode,
        isInlineMode: !!scope.isInlineMode,
        isCommentMode: !!scope.isCommentMode,
        isGrayscaleMode: !!scope.isGrayscaleMode,
        isHideNavigator: !!scope.isHideNavigator,
        smoothZoomDone: scope.smoothZoomDone !== false,
        imageHeight: (scope.imageSize && scope.imageSize.height) || 0,
        layout: scope.layout || '',
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
        isCropMode: !!scope.isCropMode,
        isMaximize: !!scope.isMaximize,
        isHideSidebar: !!scope.isHideSidebar,
        isHideInspector: !!(scope.inspector && scope.inspector.isHideInspector),
        filterOpen: !!(scope.eagle && scope.eagle.filter && scope.eagle.filter.isOpen),
        isSlideshowMode: !!scope.isSlideshowMode,
        hideBadge: general.showSidebarBadge == 'false',
        hideZoomBtn: habits.hoverZoom == 'off',
        showTransparentGrid: habits.transparency == 'show',
        hasCurrentComment: !!scope.currentComment,
        vibrancyEnabled: !!scope.vibrancyEnabled,
        sidebarWidth: (scope.containerSize && scope.containerSize.sidebar) || 220,
        inspectorWidth: (scope.inspector && scope.inspector.width) || 300,
      } as BodyState;
    },
    apply: (snapshot) => useBodyState.setState(snapshot as BodyState),
  });
}
