import { create } from 'zustand';
import { startScopeSync } from '../global/scopeBridge';

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

export function bindTagManagerSync(): () => void {
  return startScopeSync({
    watch: [
      'viewMode',
      'isDetailMode',
      'tagViewMode',
      'tagViewModeName',
      'tagViewLayoutMode',
      'keyword',
      'newGroupName',
      'currentTagGroup',
      'selectedTags',
      'selectingTags',
      'TagManager.groups',
      'TagManager.allTags.length',
      'TagManager.unfiledTags.length',
      'TagManager.starredTags.length',
      'TagManager.rawdata.length',
      'TagManager.tagsResult',
      'TagManager.tagMappings',
      'containerSize.tagSidebar',
      'theme',
    ],
    build: (scope) => {
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
      } as TagManagerSnapshot;
    },
    apply: (snapshot) => setSnapshot(snapshot as TagManagerSnapshot),
  });
}
