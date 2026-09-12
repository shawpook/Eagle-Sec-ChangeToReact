import { create } from 'zustand';
import { migrateScopeFieldToStore } from '../core/scopeFieldBridge';
import { useBodyState } from './bodyState';
;
import { useItemState } from './itemState';
import { useFolderState } from './folderState';
import { useMiscRawState } from './miscRawState';

/**
 * 11-pre a4/a5/a6/a9：文件列表区域（drop-areas / sub-folder 列表 / 列表列头 /
 * scroll-to-top / 面板拖放浮层）状态源。
 *
 * b1-9by-A：startScopeSync 退役——13 个快照字段改写入点直调 syncListFromScope
 * （数组变异/对象替换/过滤器徽标各写入方）；viewMode/isLoading/layout 镜像改由
 * useBodyState 订阅供给（bodyState 源翻转字段，同一状态源不再走 scope 快照回声）。
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

// b1-9az R1-batch2：恒等字段源翻转第二批（listState 8 个）。keyword/listDone/
// isHideSubFolder/showSubfolderContent/currentOrderBy/currentSortIncrease/unfiledCount/
// untaggedCount 已源翻转——scope 读写经委托落本 store，不参与快照同步。
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

// b1-9by-A：快照深比较守卫（scopeBridge startScopeSync 同款语义——subFolders slice()
// 逐元素引用比较，元素相同则不触发 setState，整写型组件不被无谓重渲染）。
function shallowEq(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k] === b[k]);
}

let lastSnapshot: any = null;

/**
 * b1-9by-A：13 个列表快照字段直写收敛——写入点（raw/trash/allData/filtereds/subFolders
 * 数组变异、currentFolder/currentSmartFolder/selectedFolders/selectedFolderMappings 写、
 * eagle.filter.filterBadge 写）调用。原 startScopeSync 200ms 轮询退役。
 * viewMode/isLoading/layout 不在此列（useBodyState 镜像，见 bindListSync）。
 */
export function syncListFromScope(): void {
  const next = {
    filteredsCount: (useMiscRawState.getState().filtereds && useMiscRawState.getState().filtereds.length) || 0,
    allDataCount: (useItemState.getState().allData && useItemState.getState().allData.length) || 0,
    hasSmartFolder: !!useFolderState.getState().currentSmartFolder,
    filterBadge: (useMiscRawState.getState().eagle && useMiscRawState.getState().eagle.filter && useMiscRawState.getState().eagle.filter.filterBadge) || 0,
    folderChildrenCount: (useFolderState.getState().currentFolder && useFolderState.getState().currentFolder.children && useFolderState.getState().currentFolder.children.length) || 0,
    folderLocked: !!(useFolderState.getState().currentFolder && useFolderState.getState().currentFolder.password && !useFolderState.getState().currentFolder.isUnLock),
    trashCount: (useItemState.getState().trash && useItemState.getState().trash.length) || 0,
    rawCount: (useItemState.getState().raw && useItemState.getState().raw.length) || 0,
    subFoldersCount: (useMiscRawState.getState().subFolders && useMiscRawState.getState().subFolders.length) || 0,
    noSelectedFolders: !(useMiscRawState.getState().selectedFolders && useMiscRawState.getState().selectedFolders.length > 0),
    subFolders: useMiscRawState.getState().subFolders ? useMiscRawState.getState().subFolders.slice() : [],
    selectedFolderMappings: { ...(useItemState.getState().selectedFolderMappings || {}) },
  };
  if (lastSnapshot !== null && shallowEq(next, lastSnapshot)) return;
  lastSnapshot = next;
  useListState.setState(next as Partial<ListState>);
}

let bound = false;

export function bindListSync(): void {
  if (bound) return;
  bound = true;

  // 供闭环测试（CDP Runtime.evaluate）直接访问 React 全局状态，不参与业务逻辑。
  (window as any).__eagleListState = useListState;
  // 供闭环测试直写 scope 后手动驱动（原 $evalAsync 触发快照链的等价物）。
  (window as any).__eagleListSync = syncListFromScope;

  // b1-9by-A：viewMode/isLoading/layout 镜像改由 bodyState 订阅供给（原 scope 快照
  // 镜像退役；isLoading 沿原 build 的 !! 强转语义，viewMode/layout 原样）。
  const mirror = (st: any) => {
    const cur = useListState.getState();
    const next: Partial<ListState> = {};
    if (cur.viewMode !== st.viewMode) next.viewMode = st.viewMode;
    if (cur.isLoading !== !!st.isLoading) next.isLoading = !!st.isLoading;
    if (cur.layout !== st.layout) next.layout = st.layout;
    if (Object.keys(next).length) useListState.setState(next);
  };
  mirror(useBodyState.getState());
  useBodyState.subscribe(mirror);

  // b1-9by-A：startScopeSync 退役——保留一次性对齐，后续由写入点直调驱动。
  syncListFromScope();
}
