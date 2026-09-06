import { create } from 'zustand';
import { startScopeSync } from '../global/scopeBridge';
import { migrateScopeFieldToStore } from '../global/scopeShim';

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

// b1-9az R1-batch2：恒等字段源翻转第二批（listState 8 个）。viewMode/isLoading/layout
// 已由 bodyState 源翻转——此处保留为快照镜像（scope 读经委托取 bodyState 值，回写本
// store 仅镜像），不重复注册（注册表同名覆盖）。派生/嵌套字段（counts/folderLocked/
// subFolders 等）留快照链，随阶段 2 竖切归位。
const MIGRATED_LIST_FIELDS: ReadonlyArray<keyof ListState> = [
  'keyword', 'listDone', 'isHideSubFolder', 'showSubfolderContent',
  'currentOrderBy', 'currentSortIncrease', 'unfiledCount', 'untaggedCount',
];
for (const fieldName of MIGRATED_LIST_FIELDS) {
  migrateScopeFieldToStore(
    fieldName,
    () => useListState.getState()[fieldName],
    // 同值守卫（b1-9az 批 1 教训）：scope watcher 每次 flush 回写同值字段时不得触发
    // setState（否则整写型 DOM 绑定组件被无谓重渲染）
    (value: any) => {
      if (useListState.getState()[fieldName] !== value) useListState.setState({ [fieldName]: value } as Partial<ListState>);
    },
  );
}

export function bindListSync(): void {
  if (bound) return;
  bound = true;

  // 供闭环测试（CDP Runtime.evaluate）直接访问 React 全局状态，不参与业务逻辑。
  (window as any).__eagleListState = useListState;

  startScopeSync({
    // b1-9az R1-batch2：MIGRATED_LIST_FIELDS 已源翻转，不入快照（回声强转篡源教训，
    // 见 bodyState 批 1）。viewMode/isLoading/layout 为 bodyState 已迁字段的镜像副本。
    watch: [
      'viewMode', 'isLoading', 'layout', 'filtereds.length', 'allData.length',
      'currentSmartFolder', 'eagle.filter.filterBadge', 'currentFolder.children.length',
      'currentFolder.password', 'currentFolder.isUnLock', 'trash.length', 'raw.length',
      'subFolders.length', '$root.selectedFolders.length', 'subFolders',
      'selectedFolderMappings',
    ],
    build: (scope) => ({
      viewMode: scope.viewMode,
      isLoading: !!scope.isLoading,
      layout: scope.layout,
      filteredsCount: (scope.filtereds && scope.filtereds.length) || 0,
      allDataCount: (scope.allData && scope.allData.length) || 0,
      hasSmartFolder: !!scope.currentSmartFolder,
      filterBadge: (scope.eagle && scope.eagle.filter && scope.eagle.filter.filterBadge) || 0,
      folderChildrenCount: (scope.currentFolder && scope.currentFolder.children && scope.currentFolder.children.length) || 0,
      folderLocked: !!(scope.currentFolder && scope.currentFolder.password && !scope.currentFolder.isUnLock),
      trashCount: (scope.trash && scope.trash.length) || 0,
      rawCount: (scope.raw && scope.raw.length) || 0,
      subFoldersCount: (scope.subFolders && scope.subFolders.length) || 0,
      noSelectedFolders: !(scope.$root && scope.$root.selectedFolders && scope.$root.selectedFolders.length > 0),
      subFolders: scope.subFolders ? scope.subFolders.slice() : [],
      selectedFolderMappings: { ...(scope.selectedFolderMappings || {}) },
    } as Partial<ListState>),
    apply: (snapshot) => useListState.setState(snapshot as Partial<ListState>),
  });
}
