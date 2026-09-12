import { create } from 'zustand';
import { useSidebarState } from './sidebarState';
import { usePanelState } from './panelState';
import { useFilterState } from './filterState';
import { useListState } from './listState';
import { useBodyState } from './bodyState';
import { getBodyScope } from '../core/appCore';


import { machineryGetSelectedTags } from '../core/selectionViewDomain';
import { useMiscRawState } from './miscRawState';
/**
 * 阶段3a：工具栏状态 —— 快照自 EagleController scope（规范 index.html:141-273 模板所需字段）。
 */

export interface ToolbarSnapshot {
  ready: boolean;
  viewMode: string;
  keyword: string;
  allDataCount: number;
  currentFolder: { name?: string; parent?: string; orderBy?: string } | null;
  currentFolderPath: string;
  currentSmartFolder: { name?: string; orderBy?: string } | null;
  selectedFoldersCount: number;
  selectedSmartFoldersCount: number;
  selectedTagsCount: number;
  tagsCount: number;
  hasCurrentTag: boolean;
  isDetailMode: boolean;
  isInlineMode: boolean;
  isHideSidebar: boolean;
  isMaximize: boolean;
  isAlwaysOnTop: boolean;
  inspectorHide: boolean;
  imageSizeHeight: number;
  maxListWidth: number;
  filterIsOpen: boolean;
  filterBadge: number;
  tagViewLayoutMode: string;
  pinnedPlugins: Array<{ name?: string; icon?: string }>;
  needUpdatePluginCount: number;
  theme: string;
  platform: string;
  canGoBack: boolean;
  canGoForward: boolean;
  randomOrderBy: boolean;
  // 搜寻自动提示（index.html:130-139）
  showSuggestions: boolean;
  keywordSuggestions: Array<{ word?: string }>;
  hsks: string[];
  searchIndex: number;
  keybinds: Record<string, string>;
}

const EMPTY: ToolbarSnapshot = {
  ready: false,
  viewMode: 'all',
  keyword: '',
  allDataCount: 0,
  currentFolder: null,
  currentFolderPath: '',
  currentSmartFolder: null,
  selectedFoldersCount: 0,
  selectedSmartFoldersCount: 0,
  selectedTagsCount: 0,
  tagsCount: 0,
  hasCurrentTag: false,
  isDetailMode: false,
  isInlineMode: false,
  isHideSidebar: false,
  isMaximize: false,
  isAlwaysOnTop: false,
  inspectorHide: false,
  imageSizeHeight: 200,
  maxListWidth: 300,
  filterIsOpen: false,
  filterBadge: 0,
  tagViewLayoutMode: 'INLINE',
  pinnedPlugins: [],
  needUpdatePluginCount: 0,
  theme: 'gray',
  platform: 'win32',
  canGoBack: false,
  canGoForward: false,
  randomOrderBy: false,
  showSuggestions: false,
  keywordSuggestions: [],
  hsks: [],
  searchIndex: -1,
  keybinds: {},
};

export const useToolbarState = create<{ snapshot: ToolbarSnapshot }>(() => ({ snapshot: EMPTY }));

const setSnapshot = (snapshot: ToolbarSnapshot) => useToolbarState.setState({ snapshot });

function buildToolbarSnapshot(scope: any): ToolbarSnapshot {
      const preferences = scope.preferences || {};
      const currentFolder = scope.currentFolder || null;
      const currentSmartFolder = scope.currentSmartFolder || null;
      let selectedTagsCount = 0;
      try { selectedTagsCount = (machineryGetSelectedTags() || []).length; } catch (err) { selectedTagsCount = 0; }
      let canGoBack = false;
      let canGoForward = false;
      try {
        canGoBack = !!scope.UrlStateService.canGoBack();
        canGoForward = !!scope.UrlStateService.canGoForward();
      } catch (err) { /* UrlStateService 未就绪 */ }
      const pinned = Array.isArray(scope.pluginModule?.pinnedPlugins) ? scope.pluginModule.pinnedPlugins : [];
      return {
        ready: true,
        viewMode: scope.viewMode,
        keyword: scope.keyword || '',
        allDataCount: Array.isArray(scope.allData) ? scope.allData.length : 0,
        currentFolder: currentFolder ? { name: currentFolder.name, parent: currentFolder.parent, orderBy: currentFolder.orderBy } : null,
        currentFolderPath: scope.currentFolderPath || '',
        currentSmartFolder: currentSmartFolder ? { name: currentSmartFolder.name, orderBy: currentSmartFolder.orderBy } : null,
        selectedFoldersCount: Array.isArray(useMiscRawState.getState().selectedFolders) ? useMiscRawState.getState().selectedFolders.length : 0,
        selectedSmartFoldersCount: Array.isArray(useMiscRawState.getState().selectedSmartFolders) ? useMiscRawState.getState().selectedSmartFolders.length : 0,
        selectedTagsCount,
        tagsCount: Array.isArray(scope.tags) ? scope.tags.length : 0,
        hasCurrentTag: !!scope.currentTag,
        isDetailMode: !!scope.isDetailMode,
        isInlineMode: !!scope.isInlineMode,
        isHideSidebar: !!scope.isHideSidebar,
        isMaximize: !!scope.isMaximize,
        isAlwaysOnTop: !!scope.isAlwaysOnTop,
        inspectorHide: !!(scope.inspector && scope.inspector.isHideInspector),
        imageSizeHeight: (scope.imageSize && scope.imageSize.height) || 200,
        maxListWidth: scope.MAX_LIST_WIDTH || 300,
        filterIsOpen: !!(scope.eagle && scope.eagle.filter && scope.eagle.filter.isOpen),
        filterBadge: (scope.eagle && scope.eagle.filter && scope.eagle.filter.filterBadge) || 0,
        tagViewLayoutMode: scope.tagViewLayoutMode || 'INLINE',
        pinnedPlugins: pinned.map((p: any) => ({ name: p?.manifest?.name, icon: p?.icon })),
        needUpdatePluginCount: scope.pluginModule?.needUpdatePluginCount || 0,
        theme: scope.theme || 'gray',
        platform: scope.platform || 'win32',
        canGoBack,
        canGoForward,
        randomOrderBy: !!(currentFolder && currentFolder.orderBy === 'RANDOM') || !!(currentSmartFolder && currentSmartFolder.orderBy === 'RANDOM'),
        showSuggestions: !!scope.showSuggestions,
        keywordSuggestions: Array.isArray(scope.keywordSuggestions) ? scope.keywordSuggestions : [],
        hsks: Array.isArray(scope.hsks) ? scope.hsks : [],
        searchIndex: typeof scope.searchIndex === 'number' ? scope.searchIndex : -1,
        keybinds: (preferences.shortcuts && preferences.shortcuts.keybinds) || {},
      } as ToolbarSnapshot;
}

// b1-9by-C：快照深比较守卫（scopeBridge startScopeSync 同款语义）。
function shallowEqToolbar(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k] === b[k]);
}

let lastToolbarSnapshot: any = null;

/** b1-9by-C：快照直写收敛——原 startScopeSync 200ms 轮询退役。 */
export function syncToolbarFromScope(): void {
  const scope: any = getBodyScope();
  if (!scope) return;
  const next = buildToolbarSnapshot(scope);
  if (lastToolbarSnapshot !== null && shallowEqToolbar(next, lastToolbarSnapshot)) return;
  lastToolbarSnapshot = next;
  useToolbarState.setState({ snapshot: next as ToolbarSnapshot });
}

export function bindToolbarSync(): void {
  // 供闭环测试直写 scope 后手动驱动（原 $evalAsync 触发快照链的等价物）。
  (window as any).__eagleToolbarSync = syncToolbarFromScope;
  // 供闭环测试（CDP Runtime.evaluate）直接访问 React 全局状态，不参与业务逻辑。
  (window as any).__eagleToolbarState = useToolbarState;
  useBodyState.subscribe(() => syncToolbarFromScope());
  useListState.subscribe(() => syncToolbarFromScope());
  useFilterState.subscribe(() => syncToolbarFromScope());
  usePanelState.subscribe(() => syncToolbarFromScope());
  useSidebarState.subscribe(() => syncToolbarFromScope());
  // 启动期一次性对齐。
  syncToolbarFromScope();
}
