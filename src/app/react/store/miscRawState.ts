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
  // ── b1-9bz-E3-3 增补：其余常在读的状态字段（含 `$root.*` 面；均为 object/array/scalar 状态，
  //    不含函数面）。默认 `null` 以尽量贴近 coreState 时代「未赋值即 undefined」的真值语义。──
  inspector: any;
  listLayoutSettings: any;
  selectedFolders: any;
  selectedSmartFolders: any;
  uploadQueue: any;
  finishQueue: any;
  duplicateQueue: any;
  regenerateThumbnailQueue: any;
  finishGenerateQueue: any;
  subFolderSortableOptions: any;
  UrlStateService: any;
  errorList: any;
  sidebarList: any;
  quickAccess: any;
  smartFolderList: any;
  isPreviewing: any;
  filtereds: any;
  currentComment: any;
  zoomFitSize: any;
  lastZoomMode: any;
  options: any;
  lazyLoadManager: any;
  debugReportStatus: any;
  fixUtils: any;
  trashRemoved: any;
  currentTrashRemoved: any;
  sortIncrease: any;
  isContainAlphabet: any;
  keyword_cn: any;
  keyword_tw: any;
  isKeywordTW: any;
  isKeywordCN: any;
  tagsSuggestion: any;
  showSlowNotify: any;
  isItemBindCalculated: any;
  currentTag: any;
  progress: any;
  hsks: any;
  Registration: any;
  AnalyticsHelper: any;
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
  inspector: null,
  listLayoutSettings: null,
  selectedFolders: null,
  selectedSmartFolders: null,
  uploadQueue: null,
  finishQueue: null,
  duplicateQueue: null,
  regenerateThumbnailQueue: null,
  finishGenerateQueue: null,
  subFolderSortableOptions: null,
  UrlStateService: null,
  errorList: null,
  sidebarList: null,
  quickAccess: null,
  smartFolderList: null,
  isPreviewing: false,
  filtereds: null,
  currentComment: null,
  zoomFitSize: null,
  lastZoomMode: null,
  options: null,
  lazyLoadManager: null,
  debugReportStatus: null,
  fixUtils: null,
  trashRemoved: null,
  currentTrashRemoved: null,
  sortIncrease: null,
  isContainAlphabet: null,
  keyword_cn: null,
  keyword_tw: null,
  isKeywordTW: null,
  isKeywordCN: null,
  tagsSuggestion: null,
  showSlowNotify: null,
  isItemBindCalculated: null,
  currentTag: null,
  progress: null,
  hsks: null,
  Registration: null,
  AnalyticsHelper: null,
}));

const MIGRATED: ReadonlyArray<keyof MiscRawState> = [
  'TagManager', 'pluginModule', 'installedPluginMaps', 'needUpdatePluginMaps', 'eagle', 'SavedFilter',
  'currentTagGroup', 'tagViewMode', 'keywordSuggestions', 'globalKeywords', 'showSuggestions', 'tagKeyword',
  'containFolders', 'containTags', 'filterImportDateMonths',
  'rootDir', 'libraryPath', 'libraryName', 'imagesDir', 'libraryImagesPath', 'libraryModificationTime',
  'searchIndex', 'isRotating', 'isUILoaded', 'showDetailImage', 'subFolders', 'currentProcessCount',
  'showNTFSWarning',
  'inspector', 'listLayoutSettings', 'selectedFolders', 'selectedSmartFolders',
  'uploadQueue', 'finishQueue', 'duplicateQueue', 'regenerateThumbnailQueue', 'finishGenerateQueue',
  'subFolderSortableOptions', 'UrlStateService', 'errorList', 'sidebarList', 'quickAccess', 'smartFolderList',
  'isPreviewing', 'filtereds', 'currentComment', 'zoomFitSize', 'lastZoomMode', 'options', 'lazyLoadManager',
  'debugReportStatus', 'fixUtils', 'trashRemoved', 'currentTrashRemoved', 'sortIncrease', 'isContainAlphabet',
  'keyword_cn', 'keyword_tw', 'isKeywordTW', 'isKeywordCN', 'tagsSuggestion', 'showSlowNotify',
  'isItemBindCalculated', 'currentTag', 'progress', 'hsks', 'Registration', 'AnalyticsHelper',
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
