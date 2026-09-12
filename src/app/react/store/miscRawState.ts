import { create } from 'zustand';
import { migrateScopeFieldToStore } from '../core/scopeFieldBridge';

/**
 * b1-9bz-E2-3：标签/过滤/库/插件等余量真身 store（注册式双写）。
 *
 * 覆盖 E1 映射表里其余头部字段：`TagManager`(74) / `pluginModule`(36) / `eagle`(10) /
 * `SavedFilter`(8) / `libraryPath`(21) / `rootDir`(17) / `currentTagGroup` / `tagViewMode` /
 * `keywordSuggestions` / `globalKeywords` / `showSuggestions` / `searchIndex` / `isUILoaded` /
 * `showDetailImage` / `subFolders` / `imagesDir` / `libraryImagesPath` 等。
 *
 * 默认值口径同 E2-2：对象（TagManager/pluginModule/eagle/SavedFilter）用 `null` 以保留
 * `s.X && s.X.method()` 的守卫语义；数组 `[]`、字符串 `''`、布尔 `false`、数字 `0`。
 * 机制/同值守卫见 `selectionState.ts`；**勿与本表重复注册已由 bodyState/listState/lockState/
 * toastState/preferencesState 持有的字段**（重复注册会覆盖前一个 store 的委托）。
 */
interface MiscRawState {
  TagManager: any;
  pluginModule: any;
  installedPluginMaps: any;
  needUpdatePluginMaps: any;
  eagle: any;
  SavedFilter: any;
  currentTagGroup: any;
  tagViewMode: any;
  keywordSuggestions: any;
  globalKeywords: any;
  showSuggestions: any;
  tagKeyword: any;
  containFolders: any;
  containTags: any;
  filterImportDateMonths: any;
  rootDir: any;
  libraryPath: any;
  libraryName: any;
  imagesDir: any;
  libraryImagesPath: any;
  libraryModificationTime: any;
  searchIndex: any;
  isRotating: any;
  isUILoaded: any;
  showDetailImage: any;
  subFolders: any;
  currentProcessCount: any;
  showNTFSWarning: any;
}

export const useMiscRawState = create<MiscRawState>(() => ({
  TagManager: null,
  pluginModule: null,
  installedPluginMaps: null,
  needUpdatePluginMaps: null,
  eagle: null,
  SavedFilter: null,
  currentTagGroup: null,
  tagViewMode: '',
  keywordSuggestions: [],
  globalKeywords: [],
  showSuggestions: false,
  tagKeyword: '',
  containFolders: null,
  containTags: null,
  filterImportDateMonths: null,
  rootDir: '',
  libraryPath: '',
  libraryName: '',
  imagesDir: '',
  libraryImagesPath: '',
  libraryModificationTime: 0,
  searchIndex: null,
  isRotating: false,
  isUILoaded: false,
  showDetailImage: false,
  subFolders: [],
  currentProcessCount: 0,
  showNTFSWarning: false,
}));

const MIGRATED: ReadonlyArray<keyof MiscRawState> = [
  'TagManager', 'pluginModule', 'installedPluginMaps', 'needUpdatePluginMaps', 'eagle', 'SavedFilter',
  'currentTagGroup', 'tagViewMode', 'keywordSuggestions', 'globalKeywords', 'showSuggestions', 'tagKeyword',
  'containFolders', 'containTags', 'filterImportDateMonths',
  'rootDir', 'libraryPath', 'libraryName', 'imagesDir', 'libraryImagesPath', 'libraryModificationTime',
  'searchIndex', 'isRotating', 'isUILoaded', 'showDetailImage', 'subFolders', 'currentProcessCount',
  'showNTFSWarning',
];
for (const fieldName of MIGRATED) {
  migrateScopeFieldToStore(
    fieldName as string,
    () => useMiscRawState.getState()[fieldName],
    (value: any) => {
      if (useMiscRawState.getState()[fieldName] !== value) {
        useMiscRawState.setState({ [fieldName]: value } as Partial<MiscRawState>);
      }
    },
  );
}

let bound = false;

export function bindMiscRawSync(): void {
  if (bound) return;
  bound = true;
  (window as any).__eagleMiscRawState = useMiscRawState;
}
