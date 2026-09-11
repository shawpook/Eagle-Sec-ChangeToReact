import { create } from 'zustand';
import { useBodyState } from './bodyState';
import { useListState } from './listState';
import { getBodyScope } from '../core/appCore';

import { machineryFilterContent } from '../core/filterDomain';
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

// b1-9by-B：快照深比较守卫（scopeBridge startScopeSync 同款语义）。
function shallowEqFilter(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k] === b[k]);
}

let lastFilterSnapshot: any = null;

/**
 * b1-9by-B：filter 快照直写收敛——eagle.filter 规则流汇聚点 machineryFilterContent
 * 函数体首 + eagle.filter/containFolders/containTags/tagKeyword/filterImportDateMonths
 * 写入点直调；keyword/theme/filteredsCount 委托字段经 useBodyState/useListState 订阅
 * 触发 re-sync。原 startScopeSync 200ms 轮询退役。
 */
export function syncFilterFromScope(): void {
  const scope: any = getBodyScope();
  if (!scope) return;
  const next = buildSnapshot(scope);
  if (lastFilterSnapshot !== null && shallowEqFilter(next, lastFilterSnapshot)) return;
  lastFilterSnapshot = next;
  setSnapshot(next);
}

export function bindFilterSync(): void {
  // 供闭环测试直写 scope 后手动驱动（原 $evalAsync 触发快照链的等价物）。
  (window as any).__eagleFilterSync = syncFilterFromScope;
  // 委托字段（bodyState/listState 源翻转）变化 → re-sync。
  useBodyState.subscribe(() => syncFilterFromScope());
  useListState.subscribe(() => syncFilterFromScope());
  // 启动期一次性对齐。
  syncFilterFromScope();
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
