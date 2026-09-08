import { FileUrlHelper } from '../core/fileUrlHelper';
import { create } from 'zustand';
import { usePanelState } from './panelState';
import { useFilterState } from './filterState';
import { useListState } from './listState';
import { useBodyState } from './bodyState';
import { getBodyScope } from '../global/scopeBridge';

/**
 * 阶段6：检查器状态 —— 快照自 EagleController scope + eagle.inspector 全局对象。
 *
 * DOM 规范 = src/app/js/directives/inspector.html（+ inspector-tags/folders/annotations/
 * information/plugin.html）。派生逻辑（updateSelection/imagesChange/...）的转写在
 * components/inspector/inspectorActions.ts，本 store 只做「读」。
 */

export interface SelectedItemSnapshot {
  id: string;
  name: string;
  ext: string;
  width?: number;
  height?: number;
  resolutionWidth?: number;
  resolutionHeight?: number;
  duration?: number;
  bpm?: number;
  size?: number;
  star?: number;
  url?: string;
  annotation?: string;
  tags?: string[];
  folders?: string[];
  background?: string;
  noPreview?: boolean;
  noThumbnail?: boolean;
  disable?: boolean;
  processingPalette?: boolean;
  palettes?: any[];
  comments?: any[];
  text?: string;
  orientation?: number;
  rawMetas?: any;
  modificationTime?: number;
  btime?: number;
  mtime?: number;
  lastThumbnailUrl: string;
  thumbnailUrl: string;
  exifPath: string;
}

export interface InspectorItemSnapshot {
  id: string;
  type: string;
  plugin?: { id?: string; name?: string; path?: string; manifest?: any };
  visible?: boolean;
}

export interface InspectorSnapshot {
  ready: boolean;
  theme: string;
  viewMode: string;
  trialRemain: number;
  width: number;
  activeTab: string;
  isRenaming: boolean;
  showProperties: boolean;
  showTags: boolean;
  showFolders: boolean;
  showComments: boolean;
  newName: string;
  newNamePlaceholder: string;
  newUrl: string;
  newUrlPlaceholder: string;
  newAnnotation: string;
  newTags: string[];
  folders: string[];
  star: number;
  size: number;
  category: {
    newName?: string;
    newDescription?: string;
    createDate?: number;
    imageCount?: number;
    fileSize?: number;
    exportable?: boolean;
    editable?: boolean;
  } | null;
  inspectorFolder: {
    id?: string;
    name?: string;
    password?: string;
    isUnLock?: boolean;
    imageCount?: number;
  } | null;
  selectedFolderCount: number;
  selectedFoldersFirstId: string;
  items: InspectorItemSnapshot[];
  // 選中預覽（selected-preview 區塊）
  selectedWindow: SelectedItemSnapshot[];
  selectedIndexMappings: Record<string, number>;
  selectedCount: number;
  selectedFirst: SelectedItemSnapshot | null;
  // 標籤/資料夾渲染輔助
  tagColor: Record<string, string>;
  folderName: Record<string, string>;
  folderColor: Record<string, string>;
  folderFullPath: Record<string, string>;
  isDetailMode: boolean;
  currentExt: string;
}

const EMPTY: InspectorSnapshot = {
  ready: false,
  theme: 'gray',
  viewMode: 'all',
  trialRemain: 0,
  width: 300,
  activeTab: 'SIDEBAR',
  isRenaming: false,
  showProperties: false,
  showTags: false,
  showFolders: false,
  showComments: false,
  newName: '',
  newNamePlaceholder: '',
  newUrl: '',
  newUrlPlaceholder: 'http://',
  newAnnotation: '',
  newTags: [],
  folders: [],
  star: 0,
  size: 0,
  category: null,
  inspectorFolder: null,
  selectedFolderCount: 0,
  selectedFoldersFirstId: '',
  items: [],
  selectedWindow: [],
  selectedIndexMappings: {},
  selectedCount: 0,
  selectedFirst: null,
  tagColor: {},
  folderName: {},
  folderColor: {},
  folderFullPath: {},
  isDetailMode: false,
  currentExt: '',
};

export const useInspectorState = create<{ snapshot: InspectorSnapshot }>(() => ({ snapshot: EMPTY }));

const setSnapshot = (snapshot: InspectorSnapshot) => useInspectorState.setState({ snapshot });

function snapshotItem(item: any): SelectedItemSnapshot {
  const helper = FileUrlHelper;
  let lastThumbnailUrl = '';
  let thumbnailUrl = '';
  try { lastThumbnailUrl = helper?.getLastestThumbnailUrl?.(item) || ''; } catch (err) {}
  try { thumbnailUrl = helper?.getThumbnailUrl?.(item) || ''; } catch (err) {}
  let exifPath = '';
  if (item) {
    try {
      exifPath = `./exif-viewer/index.html?orientation=${item.orientation}&path=${encodeURIComponent(
        helper.getLastestThumbnailUrl(item)
      )}&width=${item.width}&height=${item.height}`;
    } catch (err) {}
  }
  return {
    id: item.id,
    name: item.name,
    ext: item.ext,
    width: item.width,
    height: item.height,
    resolutionWidth: item.resolutionWidth,
    resolutionHeight: item.resolutionHeight,
    duration: item.duration,
    bpm: item.bpm,
    size: item.size,
    star: item.star,
    url: item.url,
    annotation: item.annotation,
    tags: Array.isArray(item.tags) ? [...item.tags] : [],
    folders: Array.isArray(item.folders) ? [...item.folders] : [],
    background: item.background,
    noPreview: !!item.noPreview,
    noThumbnail: !!item.noThumbnail,
    disable: !!item.disable,
    processingPalette: !!item.processingPalette,
    palettes: Array.isArray(item.palettes) ? JSON.parse(JSON.stringify(item.palettes)) : [],
    comments: Array.isArray(item.comments) ? JSON.parse(JSON.stringify(item.comments)) : [],
    text: item.text,
    orientation: item.orientation,
    rawMetas: item.rawMetas,
    modificationTime: item.modificationTime,
    btime: item.btime,
    mtime: item.mtime,
    lastThumbnailUrl,
    thumbnailUrl,
    exifPath,
  };
}

function buildInspectorSnapshot(scope: any): InspectorSnapshot {
      const ins = scope.inspector || {};
      const selected = Array.isArray(scope.selected) ? scope.selected : [];
      const tagMappings = scope.TagManager?.tagMappings || {};
      const tagColor: Record<string, string> = {};
      for (const tag of Object.keys(tagMappings)) {
        tagColor[tag] = tagMappings[tag]?.color;
      }
      const folderMappings = scope.folderMappings || {};
      const folderName: Record<string, string> = {};
      const folderColor: Record<string, string> = {};
      const folderFullPath: Record<string, string> = {};
      for (const id of Object.keys(folderMappings)) {
        folderName[id] = folderMappings[id]?.name;
        folderColor[id] = folderMappings[id]?.iconColor;
        try {
          folderFullPath[id] = typeof scope.getFolderFullPath === 'function' ? String(scope.getFolderFullPath(folderMappings[id]) || '') : '';
        } catch (err) {
          folderFullPath[id] = '';
        }
      }

      // 原 link $watchCollection("selected")：計算預覽窗口與 activeTab 副作用
      let previewStart = selected.length - 5;
      if (previewStart < 0) previewStart = 0;
      const selectedIndexMappings: Record<string, number> = {};
      selected.forEach((image: any, index: number) => {
        selectedIndexMappings[image.id] = index;
      });

      let items: InspectorItemSnapshot[] = [];
      if (Array.isArray(ins.inspectorItems)) {
        items = ins.inspectorItems.map((inspectorItem: any) => {
          const copy: InspectorItemSnapshot = {
            id: inspectorItem.id,
            type: inspectorItem.type,
          };
          if (inspectorItem.type === 'plugin' && inspectorItem.plugin) {
            copy.plugin = {
              id: inspectorItem.plugin?.manifest?.id,
              name: inspectorItem.plugin?.manifest?.name,
              path: inspectorItem.plugin?.path,
              manifest: inspectorItem.plugin?.manifest,
            };
            copy.visible = (() => {
              // 原 hasInspectorPlugin（bundle:54366-54383）
              try {
                const pluginModule = (scope as any).pluginModule;
                let foundPlugins: any[] = [];
                if (selected.length === 1) {
                  const item = selected[0];
                  foundPlugins = pluginModule?.previewExtension?.inspectorPluginsMap?.[item.ext] ?? [];
                } else if (selected.length > 1) {
                  foundPlugins = pluginModule?.previewExtension?.getMultiSelectInspectorPlugin?.(selected[0].ext) ?? [];
                }
                foundPlugins = foundPlugins.filter((p: any) => pluginModule?.installedPluginMaps?.[p?.manifest?.id]);
                if (foundPlugins.length === 0) return false;
                return foundPlugins.map((p: any) => p?.manifest?.id).includes(inspectorItem.plugin?.manifest?.id);
              } catch (err) {
                return false;
              }
            })();
          }
          return copy;
        });
      }

      const inspectorFolder = ins.inspectorFolder || null;
      const category = ins.category ? JSON.parse(JSON.stringify(ins.category)) : null;

      return {
        ready: true,
        theme: scope.theme || 'gray',
        viewMode: scope.viewMode,
        trialRemain: scope.trialRemain || 0,
        width: ins.width || 300,
        activeTab: ins.activeTab || 'SIDEBAR',
        isRenaming: !!ins.isRenaming,
        showProperties: !!ins.showProperties,
        showTags: !!ins.showTags,
        showFolders: !!ins.showFolders,
        showComments: !!ins.showComments,
        newName: ins.newName || '',
        newNamePlaceholder: ins.newNamePlaceholder || '',
        newUrl: ins.newUrl || '',
        newUrlPlaceholder: ins.newUrlPlaceholder || '',
        newAnnotation: ins.newAnnotation || '',
        newTags: Array.isArray(ins.newTags) ? [...ins.newTags] : [],
        folders: Array.isArray(ins.folders) ? [...ins.folders] : [],
        star: ins.star || 0,
        size: ins.size || 0,
        category,
        inspectorFolder: inspectorFolder
          ? {
              id: inspectorFolder.id,
              name: inspectorFolder.name,
              password: inspectorFolder.password,
              isUnLock: inspectorFolder.isUnLock,
              imageCount: inspectorFolder.imageCount,
            }
          : null,
        selectedFolderCount: Array.isArray(scope.$root.selectedFolders) ? scope.$root.selectedFolders.length : 0,
        selectedFoldersFirstId: Object.keys(scope.selectedFolderMappings || {})[0] || '',
        items,
        selectedWindow: selected.slice(previewStart, previewStart + 5).map(snapshotItem),
        selectedIndexMappings,
        selectedCount: selected.length,
        selectedFirst: selected.length > 0 && selected[0] ? snapshotItem(selected[0]) : null,
        tagColor,
        folderName,
        folderColor,
        folderFullPath,
        isDetailMode: !!scope.isDetailMode,
        currentExt: scope.current?.ext || '',
      } as InspectorSnapshot;
}

// b1-9by-C：快照深比较守卫（scopeBridge startScopeSync 同款语义）。
function shallowEqInspector(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k] === b[k]);
}

let lastInspectorSnapshot: any = null;

/** b1-9by-C：快照直写收敛——原 startScopeSync 200ms 轮询退役。 */
export function syncInspectorFromScope(): void {
  const scope: any = getBodyScope();
  if (!scope) return;
  const next = buildInspectorSnapshot(scope);
  if (lastInspectorSnapshot !== null && shallowEqInspector(next, lastInspectorSnapshot)) return;
  lastInspectorSnapshot = next;
  useInspectorState.setState({ snapshot: next as InspectorSnapshot });
}

export function bindInspectorSync(): void {
  // 供闭环测试直写 scope 后手动驱动（原 $evalAsync 触发快照链的等价物）。
  (window as any).__eagleInspectorSync = syncInspectorFromScope;
  // 供闭环测试（CDP Runtime.evaluate）直接访问 React 全局状态，不参与业务逻辑。
  (window as any).__eagleInspectorState = useInspectorState;
  useBodyState.subscribe(() => syncInspectorFromScope());
  useListState.subscribe(() => syncInspectorFromScope());
  useFilterState.subscribe(() => syncInspectorFromScope());
  usePanelState.subscribe(() => syncInspectorFromScope());
  // 启动期一次性对齐。
  syncInspectorFromScope();
}
