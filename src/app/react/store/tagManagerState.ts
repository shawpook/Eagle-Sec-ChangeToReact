import { create } from 'zustand';
import { getBodyScope } from '../global/scopeBridge';
import { useBodyState } from './bodyState';
import { useListState } from './listState';

/**
 * 阶段7b：标签管理（tag-manager 指令 + TagManager 服务渲染结果）状态快照。
 * DOM 规范 = js/directives/tag-manager.html；渲染行由 TagManager.renderTagsResult() 产出。
 */

export interface TagGroupSnapshot {
  id: string;
  name: string;
  color?: string;
  editable?: boolean;
  tagsCount: number;
}

export interface TagDisplayRow {
  type: 'group' | 'starred' | 'row' | 'separator';
  name?: string;
  count?: number;
  tags?: string[];
  size: number;
  y: number;
}

export interface TagManagerSnapshot {
  ready: boolean;
  theme: string;
  viewMode: string;
  isDetailMode: boolean;
  tagViewMode: string;
  tagViewModeName: string;
  tagViewLayoutMode: string;
  keyword: string;
  newGroupName: string;
  currentTagGroup: { id: string; name: string; description?: string; editable?: boolean; color?: string } | null;
  selectedTags: Record<string, boolean>;
  selectingTags: Record<string, boolean>;
  groups: TagGroupSnapshot[];
  allTagsCount: number;
  unfiledTagsCount: number;
  starredTagsCount: number;
  rawdataCount: number;
  tagsResultTags: string[];
  display: TagDisplayRow[];
  tagMappings: Record<string, { name?: string; color?: string; imageCount?: number }>;
  tagSidebarWidth: number;
}

const EMPTY: TagManagerSnapshot = {
  ready: false,
  theme: 'gray',
  viewMode: 'all',
  isDetailMode: false,
  tagViewMode: 'ALL',
  tagViewModeName: '',
  tagViewLayoutMode: 'INLINE',
  keyword: '',
  newGroupName: '',
  currentTagGroup: null,
  selectedTags: {},
  selectingTags: {},
  groups: [],
  allTagsCount: 0,
  unfiledTagsCount: 0,
  starredTagsCount: 0,
  rawdataCount: 0,
  tagsResultTags: [],
  display: [],
  tagMappings: {},
  tagSidebarWidth: 200,
};

export const useTagManagerState = create<{ snapshot: TagManagerSnapshot }>(() => ({ snapshot: EMPTY }));

const setSnapshot = (snapshot: TagManagerSnapshot) => useTagManagerState.setState({ snapshot });

// b1-9by-B：快照深比较守卫（scopeBridge startScopeSync 同款语义）。
function shallowEqTm(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k] === b[k]);
}

let lastTmSnapshot: any = null;

/**
 * b1-9by-B：tagManager 快照直写收敛——TagManager.*（标签域）/selectedTags/selectingTags/
 * currentTagGroup/newGroupName/tagViewMode 族/containerSize 写入点直调；viewMode/
 * isDetailMode/keyword/theme 委托字段经 useBodyState/useListState 订阅触发 re-sync。
 * 原 startScopeSync 200ms 轮询退役。
 */
export function syncTagManagerFromScope(): void {
  const scope: any = getBodyScope();
  if (!scope) return;
  const next = buildTmSnapshot(scope);
  if (lastTmSnapshot !== null && shallowEqTm(next, lastTmSnapshot)) return;
  lastTmSnapshot = next;
  setSnapshot(next);
}

export function bindTagManagerSync(): void {
  // 供闭环测试直写 scope 后手动驱动（原 $evalAsync 触发快照链的等价物）。
  (window as any).__eagleTagManagerSync = syncTagManagerFromScope;
  // 委托字段（bodyState/listState 源翻转）变化 → re-sync。
  useBodyState.subscribe(() => syncTagManagerFromScope());
  useListState.subscribe(() => syncTagManagerFromScope());
  // 启动期一次性对齐。
  syncTagManagerFromScope();
}

function buildTmSnapshot(scope: any): TagManagerSnapshot {
      const tm = scope.TagManager || {};
      const groups = Array.isArray(tm.groups) ? tm.groups : [];
      const tagMappings: Record<string, { name?: string; color?: string; imageCount?: number }> = {};
      const mappings = tm.tagMappings || {};
      for (const key of Object.keys(mappings)) {
        const m = mappings[key];
        tagMappings[key] = { name: m?.name, color: m?.color, imageCount: m?.imageCount };
      }
      const tagsResult = tm.tagsResult || {};
      const currentTagGroup = scope.currentTagGroup || null;

      return {
        ready: true,
        theme: scope.theme || 'gray',
        viewMode: scope.viewMode,
        isDetailMode: !!scope.isDetailMode,
        tagViewMode: scope.tagViewMode || 'ALL',
        tagViewModeName: scope.tagViewModeName || '',
        tagViewLayoutMode: scope.tagViewLayoutMode || 'INLINE',
        keyword: scope.keyword || '',
        newGroupName: scope.newGroupName || '',
        currentTagGroup: currentTagGroup
          ? {
              id: currentTagGroup.id,
              name: currentTagGroup.name,
              description: currentTagGroup.description,
              editable: !!currentTagGroup.editable,
              color: currentTagGroup.color,
            }
          : null,
        selectedTags: scope.selectedTags ? JSON.parse(JSON.stringify(scope.selectedTags)) : {},
        selectingTags: scope.selectingTags ? JSON.parse(JSON.stringify(scope.selectingTags)) : {},
        groups: groups.map((g: any) => ({
          id: g.id,
          name: g.name,
          color: g.color,
          editable: !!g.editable,
          tagsCount: Array.isArray(g.tags) ? g.tags.length : 0,
        })),
        allTagsCount: Array.isArray(tm.allTags) ? tm.allTags.length : 0,
        unfiledTagsCount: Array.isArray(tm.unfiledTags) ? tm.unfiledTags.length : 0,
        starredTagsCount: Array.isArray(tm.starredTags) ? tm.starredTags.length : 0,
        rawdataCount: Array.isArray(tm.rawdata) ? tm.rawdata.length : 0,
        tagsResultTags: Array.isArray(tagsResult.tags) ? [...tagsResult.tags] : [],
        display: Array.isArray(tagsResult.display)
          ? tagsResult.display.map((row: any) => ({ ...row, tags: Array.isArray(row.tags) ? [...row.tags] : undefined }))
          : [],
        tagMappings,
        tagSidebarWidth: scope.containerSize?.tagSidebar || 200,
  };
}
