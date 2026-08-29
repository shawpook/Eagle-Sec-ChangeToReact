import { create } from 'zustand';
import { startScopeSync } from '../global/scopeBridge';

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

export function bindToolbarSync(): () => void {
  return startScopeSync({
    watch: [
      'viewMode',
      'keyword',
      'allData.length',
      'currentFolder',
      'currentFolderPath',
      'currentSmartFolder',
      'selectedFolders.length',
      'selectedSmartFolders.length',
      'currentTag',
      'tags.length',
      'isDetailMode',
      'isInlineMode',
      'isHideSidebar',
      'isMaximize',
      'isAlwaysOnTop',
      'inspector.isHideInspector',
      'imageSize.height',
      'MAX_LIST_WIDTH',
      'eagle.filter.isOpen',
      'eagle.filter.filterBadge',
      'tagViewLayoutMode',
      'pluginModule.pinnedPlugins',
      'pluginModule.needUpdatePluginCount',
      'theme',
      'showSuggestions',
      'keywordSuggestions',
      'hsks',
      'searchIndex',
    ],
    build: (scope) => {
      const preferences = scope.preferences || {};
      const currentFolder = scope.currentFolder || null;
      const currentSmartFolder = scope.currentSmartFolder || null;
      let selectedTagsCount = 0;
      try { selectedTagsCount = (scope.getSelectedTags() || []).length; } catch (err) { selectedTagsCount = 0; }
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
        selectedFoldersCount: Array.isArray(scope.$root.selectedFolders) ? scope.$root.selectedFolders.length : 0,
        selectedSmartFoldersCount: Array.isArray(scope.$root.selectedSmartFolders) ? scope.$root.selectedSmartFolders.length : 0,
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
    },
    apply: (snapshot) => setSnapshot(snapshot as ToolbarSnapshot),
  });
}
