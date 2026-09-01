import { create } from 'zustand';
import { startScopeSync } from '../global/scopeBridge';

/**
 * 11-pre a4/a5/a6/a9：文件列表区域（drop-areas / sub-folder 列表 / 列表列头 /
 * scroll-to-top / 面板拖放浮层）状态源。全部为 body scope 的 digest 驱动状态，
 * startScopeSync 快照与原 ng-if/ng-show/ng-class 同源同语义。
 */

interface ListState {
  viewMode: string;
  isLoading: boolean;
  filteredsCount: number;
  allDataCount: number;
  keyword: string;
  hasSmartFolder: boolean;
  filterBadge: number;
  folderChildrenCount: number;
  folderLocked: boolean;
  unfiledCount: number;
  untaggedCount: number;
  trashCount: number;
  rawCount: number;
  subFoldersCount: number;
  listDone: boolean;
  isHideSubFolder: boolean;
  showSubfolderContent: boolean;
  noSelectedFolders: boolean;
  subFolders: any[];
  selectedFolderMappings: Record<string, boolean>;
  layout: string;
  currentOrderBy: string;
  currentSortIncrease: boolean;
}

export const useListState = create<ListState>(() => ({
  viewMode: 'all',
  isLoading: true,
  filteredsCount: 0,
  allDataCount: 0,
  keyword: '',
  hasSmartFolder: false,
  filterBadge: 0,
  folderChildrenCount: 0,
  folderLocked: false,
  unfiledCount: 0,
  untaggedCount: 0,
  trashCount: 0,
  rawCount: 0,
  subFoldersCount: 0,
  listDone: false,
  isHideSubFolder: false,
  showSubfolderContent: false,
  noSelectedFolders: true,
  subFolders: [],
  selectedFolderMappings: {},
  layout: '',
  currentOrderBy: '',
  currentSortIncrease: true,
}));

let bound = false;

export function bindListSync(): void {
  if (bound) return;
  bound = true;

  // 供闭环测试（CDP Runtime.evaluate）直接访问 React 全局状态，不参与业务逻辑。
  (window as any).__eagleListState = useListState;

  startScopeSync({
    watch: [
      'viewMode', 'isLoading', 'filtereds.length', 'allData.length', 'keyword',
      'currentSmartFolder', 'eagle.filter.filterBadge', 'currentFolder.children.length',
      'currentFolder.password', 'currentFolder.isUnLock', 'unfiledCount', 'untaggedCount',
      'trash.length', 'raw.length', 'subFolders.length', 'listDone', 'isHideSubFolder',
      'showSubfolderContent', '$root.selectedFolders.length', 'subFolders',
      'selectedFolderMappings', 'layout', 'currentOrderBy', 'currentSortIncrease',
    ],
    build: (scope) => ({
      viewMode: scope.viewMode,
      isLoading: !!scope.isLoading,
      filteredsCount: (scope.filtereds && scope.filtereds.length) || 0,
      allDataCount: (scope.allData && scope.allData.length) || 0,
      keyword: scope.keyword || '',
      hasSmartFolder: !!scope.currentSmartFolder,
      filterBadge: (scope.eagle && scope.eagle.filter && scope.eagle.filter.filterBadge) || 0,
      folderChildrenCount: (scope.currentFolder && scope.currentFolder.children && scope.currentFolder.children.length) || 0,
      folderLocked: !!(scope.currentFolder && scope.currentFolder.password && !scope.currentFolder.isUnLock),
      unfiledCount: scope.unfiledCount || 0,
      untaggedCount: scope.untaggedCount || 0,
      trashCount: (scope.trash && scope.trash.length) || 0,
      rawCount: (scope.raw && scope.raw.length) || 0,
      subFoldersCount: (scope.subFolders && scope.subFolders.length) || 0,
      listDone: !!scope.listDone,
      isHideSubFolder: !!scope.isHideSubFolder,
      showSubfolderContent: !!scope.showSubfolderContent,
      noSelectedFolders: !(scope.$root && scope.$root.selectedFolders && scope.$root.selectedFolders.length > 0),
      subFolders: scope.subFolders ? scope.subFolders.slice() : [],
      selectedFolderMappings: { ...(scope.selectedFolderMappings || {}) },
      layout: scope.layout || '',
      currentOrderBy: scope.currentOrderBy || '',
      currentSortIncrease: scope.currentSortIncrease !== false,
    }),
    apply: (snapshot) => useListState.setState(snapshot as ListState),
  });
}
