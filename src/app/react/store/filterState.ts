import { create } from 'zustand';
import { startScopeSync } from '../global/scopeBridge';

/**
 * 阶段3b：筛选面板状态 —— 快照自 EagleController scope + eagle.filter（bundle:312-606 ItemFilter）。
 * filterRules 的变更由各 item 的 click 序列产生（改规则 → page=1 → filterContent → digest → 深比较触发同步）。
 */

export interface FilterFolderItem {
  id: string;
  name: string;
  imageCount: number;
  isSelected?: boolean;
}

export interface FilterTagItem {
  name: string;
  imageCount: number;
  isSelected?: boolean;
  isExcluded?: boolean;
  groupColor?: string;
}

export interface FilterSnapshot {
  ready: boolean;
  // 工具列容器
  filterIsOpen: boolean;
  filterBadge: number;
  isLock: boolean;
  toolbarTypes: string[];
  pinned: Record<string, boolean>;
  savedFilterCount: number;
  savedFilterIsOpen: boolean;
  keyword: string;
  filteredsCount: number;
  theme: string;
  keybinds: Record<string, string>;
  // 规则（渲染用投影；点击直接写活对象）
  rules: any;
  counts: any;
  // 列表族数据
  filterCameras: string[];
  filterTypes: string[];
  tagFilterLogic: string;
  folderFilterLogic: string;
  filterFolderKeyword: string;
  tagKeyword: string;
  containFolders: FilterFolderItem[];
  containTags: FilterTagItem[];
  tagGroups: Array<{ id: string; name: string; tags: string[] }>;
  filterImportDateMonths: Array<{ key: string; value: number }>;
}

const EMPTY: FilterSnapshot = {
  ready: false,
  filterIsOpen: false,
  filterBadge: 0,
  isLock: false,
  toolbarTypes: [],
  pinned: {},
  savedFilterCount: 0,
  savedFilterIsOpen: false,
  keyword: '',
  filteredsCount: 0,
  theme: 'gray',
  keybinds: {},
  rules: {},
  counts: {},
  filterCameras: [],
  filterTypes: [],
  tagFilterLogic: 'OR',
  folderFilterLogic: 'OR',
  filterFolderKeyword: '',
  tagKeyword: '',
  containFolders: [],
  containTags: [],
  tagGroups: [],
  filterImportDateMonths: [],
};

export const useFilterState = create<{ snapshot: FilterSnapshot }>(() => ({ snapshot: EMPTY }));

const setSnapshot = (snapshot: FilterSnapshot) => useFilterState.setState({ snapshot });

export function bindFilterSync(): () => void {
  return startScopeSync({
    watch: [
      'eagle.filter.isOpen',
      'eagle.filter.filterBadge',
      'eagle.filter.isLock',
      'eagle.filter.toolbar',
      'eagle.filter.pinned',
      'eagle.filter.filterRules',
      'eagle.filter.filterCounts',
      'eagle.filter.filterCameras',
      'eagle.filter.filterTypes',
      'eagle.filter.tagFilterLogic',
      'eagle.filter.folderFilterLogic',
      'eagle.filter.filterFolderKeyword',
      'tagKeyword',
      'containFolders',
      'containTags',
      'TagManager.groups',
      'SavedFilter.filters.length',
      'SavedFilter.isOpen',
      'filtereds.length',
      'keyword',
      'theme',
      'filterImportDateMonths',
    ],
    build: (scope) => buildSnapshot(scope),
    apply: (snapshot) => setSnapshot(snapshot as FilterSnapshot),
  });
}

function buildSnapshot(scope: any): FilterSnapshot {
  const filter = scope.eagle?.filter || {};
  const preferences = scope.preferences || {};
  const containFolders = Array.isArray(scope.containFolders) ? scope.containFolders : [];
  const containTags = Array.isArray(scope.containTags) ? scope.containTags : [];
  const groups = Array.isArray(scope.TagManager?.groups) ? scope.TagManager.groups : [];
  return {
    ready: true,
    filterIsOpen: !!filter.isOpen,
    filterBadge: filter.filterBadge || 0,
    isLock: !!filter.isLock,
    toolbarTypes: Array.isArray(filter.toolbar) ? filter.toolbar.map((t: any) => t.type) : [],
    pinned: JSON.parse(JSON.stringify(filter.pinned || {})),
    savedFilterCount: Array.isArray(scope.SavedFilter?.filters) ? scope.SavedFilter.filters.length : 0,
    savedFilterIsOpen: !!scope.SavedFilter?.isOpen,
    keyword: scope.keyword || '',
    filteredsCount: Array.isArray(scope.filtereds) ? scope.filtereds.length : 0,
    theme: scope.theme || 'gray',
    keybinds: (preferences.shortcuts && preferences.shortcuts.keybinds) || {},
    // 深拷贝：filterRules/counts 由 Angular 原地修改，React 的 useMemo 按引用缓存，
    // 必须换新引用才能让派生值（isEnabled/displayName）重算。
    rules: JSON.parse(JSON.stringify(filter.filterRules || {})),
    counts: JSON.parse(JSON.stringify(filter.filterCounts || {})),
    filterCameras: Array.isArray(filter.filterCameras) ? filter.filterCameras.slice() : [],
    filterTypes: Array.isArray(filter.filterTypes) ? filter.filterTypes.slice() : [],
    tagFilterLogic: filter.tagFilterLogic || 'OR',
    folderFilterLogic: filter.folderFilterLogic || 'OR',
    filterFolderKeyword: filter.filterFolderKeyword || '',
    tagKeyword: scope.tagKeyword || '',
    containFolders: containFolders
      .filter((f: any) => !!f)
      .map((f: any) => ({ id: f.id, name: f.name, imageCount: f.imageCount || 0, isSelected: !!f.isSelected })),
    containTags: containTags
      .filter((tg: any) => !!tg)
      .map((tg: any) => ({
        name: tg.name,
        imageCount: tg.imageCount || 0,
        isSelected: !!tg.isSelected,
        isExcluded: !!tg.isExcluded,
        groupColor: tg.group && tg.group.color,
      })),
    tagGroups: groups.map((g: any) => ({ id: g.id, name: g.name, tags: Array.isArray(g.tags) ? g.tags.slice() : [] })),
    filterImportDateMonths: Array.isArray(scope.filterImportDateMonths)
      ? scope.filterImportDateMonths.map((o: any) => ({ key: o.key, value: o.value }))
      : [],
  };
}
