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
  selectedFoldersMappings: any;
  selectedSmartFoldersMappings: any;
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
  uploadUrl: any;
  filterWithTags: any;
  openGifContextMenu: any;
  getExifPath: any;
  clearAllTags: any;
  openHelpCenter: any;
  openGetStarted: any;
  openPrivacy: any;
  openAPIDocument: any;
  openTwitter: any;
  whenLayoutChange: any;
  removeRecentFolder: any;
  updateItemListView: any;
  preventMiddleClick: any;
  changeFolderName: any;
  saveFolder: any;
  openLibrary: any;
  getRecentFoldersForAPI: any;
  toggleFullScreen: any;
  searchFilter: any;
  lockImageFilter: any;
  $$listeners: any;
  $$watchers: any;
  saveFolderDebounce: any;
  tagsSuggestionResult: any;
  // ── b1-9bz-E3-11：函数面挂载字段源翻转（值是函数的状态字段；scope.X = fn 写、scope.X() 读）──
  undo: any;
  closeAll: any;
  initMenu: any;
  notify: any;
  reload: any;
  toggleFilter: any;
  updateSelection: any;
  zoom: any;
  changeStar: any;
  removeSelected: any;
  toggleAll: any;
  selectNext: any;
  selectPrev: any;
  enterDetailMode: any;
  leaveDetailMode: any;
  onDropContainer: any;
  activateFont: any;
  deactivateFont: any;
  escHandler: any;
  copyAsPath: any;
  getRawPath: any;
  getRawUrl: any;
  select: any;
  addImagesToFolder: any;
  selectTag: any;
  createTagGroup: any;
  openTagAllGroup: any;
  openUnfiledGroup: any;
  openStarredGroup: any;
  openTagGroup: any;
  addStarredTags: any;
  addGroupTags: any;
  openTagGroupContextMenu: any;
  renameTagGroup: any;
  changeTagGroupColor: any;
  removeTagGroup: any;
  renameTagGroupBlur: any;
  renameTagGroupKeyup: any;
  tagGroupDescriptionChange: any;
  tagGroupDescriptionFocus: any;
  tagGroupDescriptionBlur: any;
  // ── b1-9bz-E3-5 增补：machinery 函数体内仍以 `s.X` 访问的其余状态字段（恒为状态值，
  //    无函数面成员；函数面（notify/reload/... ）留待 E3-7 直调化，不在此注册）。──
  gifViewer: any;
  gifPlayer: any;
  selectedTags: any;
  removeSound: any;
  lastIndex: any;
  isGifReady: any;
  orderBy: any;
  currentId: any;
  duplicateGroupings: any;
  tagViewModeName: any;
  colorDistancesMap: any;
  folderKeyword: any;
  listMetaType: any;
  isSearchScopeFolderName: any;
  isSearchScopeFolderDesc: any;
  preelaborations: any;
  paletteQueuePaused: any;
  addImageStartTime: any;
  availableHistoryTags: any;
  lastSelectedTag: any;
  gifUpadteInterval: any;
  sidebarIndex: any;
  canUseTouchID: any;
  unlockPassword: any;
  historySearchKeywords: any;
  boxContianerWidth: any;
  isSearchScopeName: any;
  isSearchScopeExt: any;
  isSearchScopeTag: any;
  isSearchScopeUrl: any;
  isSearchScopeAnnotation: any;
  isSearchScopeNote: any;
  keywordDebounce: any;
  MAX_LIST_WIDTH: any;
  contentFilterCache: any;
  isExpandQuickAccess: any;
  isExpandSmartFolder: any;
  isExpandFolder: any;
  commentRect: any;
  duplicateTarget: any;
  showName: any;
  showMetas: any;
  searchRegexGroup: any;
  addImageTimeLeftInSeconds: any;
  sliderZoomRatio: any;
  newGroupName: any;
  usingGifPlayer: any;
  paletteQueueDelay: any;
  lastProcessCount: any;
  isLibrarySaving: any;
  saveFolderDebounceTimeout: any;
  libraryHistory: any;
  isEnglish: any;
  initDetailMode: any;
  untagged: any;
  lastImageHeight: any;
  gotoBottomTimeout: any;
  isOpenWebpagePanel: any;
  boxContianerHeight: any;
  isHideMainNav: any;
  page: any;
  len: any;
  showOriginalImageWhenLarge: any;
  showAnnotation: any;
  showFileExtension: any;
  showFileExtensionLabel: any;
  duplicates: any;
  showLargeImage: any;
  usingCache: any;
  winMenu: any;
  selectingTags: any;
  libraryLoadedProgress: any;
  paletteQueueLength: any;
  metadataQueueLength: any;
  downloadQueueLength: any;
  MAX_DIMENSION: any;
  duplicateSound: any;
  errorSound: any;
  orderByName: any;
  folderIcons: any;
  hexColor: any;
  loadMoreDisable: any;
  // ── b1-9bz-E4-1 增补：E4 字段面扫描余量（详情/面板/筛选/工具栏/检查器状态）──
  appVersion: any;
  buildVersion: any;
  buildNumber: any;
  tagViewLayoutMode: any;
  currentFolderPath: any;
  useMpvPlayer: any;
  supportRotate: any;
  supportCrop: any;
  ratio: any;
  inspectorFolder: any;
  currentUrl: any;
  selectedFolder: any;
  isAlwaysOnTop: any;
  keywords: any;
  keywords_cn: any;
  keywords_tw: any;
  // bundle 时代由 controller 挂到 scope 的类型表（b1 后 `scope.X` 恒 undefined；注册以保留
  // 「falsy」真值语义，供详情快照 buildDetailSnapshot 去参数化——窗口全局 `window.X` 不变）。
  VIDEO_TYPES: any;
  AUDIO_TYPES: any;
  FONT_TYPES: any;
  URL_TYPES: any;
  MODEL_TYPES: any;
  DISABLE_ZOOM_TYPES: any;
  SUPPORT_FORMATS: any;
  // E4：键盘绑定表（原 shim target 种子 `{}`；注册后真身在 store，m1-A6 的 `!!shim.mousetrap`
  // 契约由 store 默认 `{}` 继续满足）。
  mousetrap: any;
  isImporting: any;
  openWithInfo: any;
  lastestAddItem: any;
  email: any;
  fontFolder: any;
  draggedFolders: any;
  draggedSmartFolders: any;
  draggedQuickAccess: any;
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
  selectedFoldersMappings: null,
  selectedSmartFoldersMappings: null,
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
  uploadUrl: null,
  filterWithTags: null,
  openGifContextMenu: null,
  getExifPath: null,
  clearAllTags: null,
  openHelpCenter: null,
  openGetStarted: null,
  openPrivacy: null,
  openAPIDocument: null,
  openTwitter: null,
  whenLayoutChange: null,
  removeRecentFolder: null,
  updateItemListView: null,
  preventMiddleClick: null,
  changeFolderName: null,
  saveFolder: null,
  openLibrary: null,
  getRecentFoldersForAPI: null,
  toggleFullScreen: null,
  searchFilter: null,
  lockImageFilter: null,
  $$listeners: null,
  $$watchers: null,
  saveFolderDebounce: null,
  tagsSuggestionResult: null,
  undo: null,
  closeAll: null,
  initMenu: null,
  notify: null,
  reload: null,
  toggleFilter: null,
  updateSelection: null,
  zoom: null,
  changeStar: null,
  removeSelected: null,
  toggleAll: null,
  selectNext: null,
  selectPrev: null,
  enterDetailMode: null,
  leaveDetailMode: null,
  onDropContainer: null,
  activateFont: null,
  deactivateFont: null,
  escHandler: null,
  copyAsPath: null,
  getRawPath: null,
  getRawUrl: null,
  select: null,
  addImagesToFolder: null,
  selectTag: null,
  createTagGroup: null,
  openTagAllGroup: null,
  openUnfiledGroup: null,
  openStarredGroup: null,
  openTagGroup: null,
  addStarredTags: null,
  addGroupTags: null,
  openTagGroupContextMenu: null,
  renameTagGroup: null,
  changeTagGroupColor: null,
  removeTagGroup: null,
  renameTagGroupBlur: null,
  renameTagGroupKeyup: null,
  tagGroupDescriptionChange: null,
  tagGroupDescriptionFocus: null,
  tagGroupDescriptionBlur: null,
  gifViewer: null,
  gifPlayer: null,
  selectedTags: null,
  removeSound: null,
  lastIndex: null,
  isGifReady: null,
  orderBy: null,
  currentId: null,
  duplicateGroupings: null,
  tagViewModeName: null,
  colorDistancesMap: null,
  folderKeyword: null,
  listMetaType: null,
  isSearchScopeFolderName: null,
  isSearchScopeFolderDesc: null,
  preelaborations: null,
  paletteQueuePaused: null,
  addImageStartTime: null,
  availableHistoryTags: null,
  lastSelectedTag: null,
  gifUpadteInterval: null,
  sidebarIndex: null,
  canUseTouchID: null,
  unlockPassword: null,
  historySearchKeywords: null,
  boxContianerWidth: null,
  isSearchScopeName: null,
  isSearchScopeExt: null,
  isSearchScopeTag: null,
  isSearchScopeUrl: null,
  isSearchScopeAnnotation: null,
  isSearchScopeNote: null,
  keywordDebounce: null,
  MAX_LIST_WIDTH: null,
  contentFilterCache: null,
  isExpandQuickAccess: null,
  isExpandSmartFolder: null,
  isExpandFolder: null,
  commentRect: null,
  duplicateTarget: null,
  showName: null,
  showMetas: null,
  searchRegexGroup: null,
  addImageTimeLeftInSeconds: null,
  sliderZoomRatio: null,
  newGroupName: null,
  usingGifPlayer: null,
  paletteQueueDelay: null,
  lastProcessCount: null,
  isLibrarySaving: null,
  saveFolderDebounceTimeout: null,
  libraryHistory: null,
  isEnglish: null,
  initDetailMode: null,
  untagged: null,
  lastImageHeight: null,
  gotoBottomTimeout: null,
  isOpenWebpagePanel: null,
  boxContianerHeight: null,
  isHideMainNav: null,
  page: null,
  len: null,
  showOriginalImageWhenLarge: null,
  showAnnotation: null,
  showFileExtension: null,
  showFileExtensionLabel: null,
  duplicates: null,
  showLargeImage: null,
  usingCache: null,
  winMenu: null,
  selectingTags: null,
  libraryLoadedProgress: null,
  paletteQueueLength: null,
  metadataQueueLength: null,
  downloadQueueLength: null,
  MAX_DIMENSION: null,
  duplicateSound: null,
  errorSound: null,
  orderByName: null,
  folderIcons: null,
  hexColor: null,
  loadMoreDisable: null,
  appVersion: null,
  buildVersion: null,
  buildNumber: null,
  tagViewLayoutMode: null,
  currentFolderPath: null,
  useMpvPlayer: null,
  supportRotate: null,
  supportCrop: null,
  ratio: null,
  inspectorFolder: null,
  currentUrl: null,
  selectedFolder: null,
  isAlwaysOnTop: null,
  keywords: null,
  keywords_cn: null,
  keywords_tw: null,
  VIDEO_TYPES: null,
  AUDIO_TYPES: null,
  FONT_TYPES: null,
  URL_TYPES: null,
  MODEL_TYPES: null,
  DISABLE_ZOOM_TYPES: null,
  SUPPORT_FORMATS: null,
  mousetrap: {},
  isImporting: null,
  openWithInfo: null,
  lastestAddItem: null,
  email: null,
  fontFolder: null,
  draggedFolders: [],
  draggedSmartFolders: [],
  draggedQuickAccess: null,
}));

const MIGRATED: ReadonlyArray<keyof MiscRawState> = [
  'TagManager', 'pluginModule', 'installedPluginMaps', 'needUpdatePluginMaps', 'eagle', 'SavedFilter',
  'currentTagGroup', 'tagViewMode', 'keywordSuggestions', 'globalKeywords', 'showSuggestions', 'tagKeyword',
  'containFolders', 'containTags', 'filterImportDateMonths',
  'rootDir', 'libraryPath', 'libraryName', 'imagesDir', 'libraryImagesPath', 'libraryModificationTime',
  'searchIndex', 'isRotating', 'isUILoaded', 'showDetailImage', 'subFolders', 'currentProcessCount',
  'showNTFSWarning',
  'inspector', 'listLayoutSettings', 'selectedFolders', 'selectedSmartFolders', 'selectedFoldersMappings', 'selectedSmartFoldersMappings',
  'uploadQueue', 'finishQueue', 'duplicateQueue', 'regenerateThumbnailQueue', 'finishGenerateQueue',
  'subFolderSortableOptions', 'UrlStateService', 'errorList', 'sidebarList', 'quickAccess', 'smartFolderList',
  'isPreviewing', 'filtereds', 'currentComment', 'zoomFitSize', 'lastZoomMode', 'options', 'lazyLoadManager',
  'debugReportStatus', 'fixUtils', 'trashRemoved', 'currentTrashRemoved', 'sortIncrease', 'isContainAlphabet',
  'keyword_cn', 'keyword_tw', 'isKeywordTW', 'isKeywordCN', 'tagsSuggestion', 'showSlowNotify',
  'isItemBindCalculated', 'currentTag', 'progress', 'hsks', 'Registration', 'AnalyticsHelper',
  'uploadUrl', 'filterWithTags', 'openGifContextMenu', 'getExifPath', 'clearAllTags', 'openHelpCenter', 'openGetStarted', 'openPrivacy', 'openAPIDocument', 'openTwitter', 'whenLayoutChange', 'removeRecentFolder', 'updateItemListView', 'preventMiddleClick', 'changeFolderName', 'saveFolder', 'openLibrary', 'getRecentFoldersForAPI', 'toggleFullScreen',
  'searchFilter', 'lockImageFilter', '$$listeners', '$$watchers', 'saveFolderDebounce', 'tagsSuggestionResult',
  'undo', 'closeAll', 'initMenu', 'notify', 'reload', 'toggleFilter', 'updateSelection', 'zoom', 'changeStar', 'removeSelected', 'toggleAll', 'selectNext', 'selectPrev', 'enterDetailMode', 'leaveDetailMode', 'onDropContainer', 'activateFont', 'deactivateFont', 'escHandler', 'copyAsPath', 'getRawPath', 'getRawUrl', 'select', 'addImagesToFolder', 'selectTag', 'createTagGroup', 'openTagAllGroup', 'openUnfiledGroup', 'openStarredGroup', 'openTagGroup', 'addStarredTags', 'addGroupTags', 'openTagGroupContextMenu', 'renameTagGroup', 'changeTagGroupColor', 'removeTagGroup', 'renameTagGroupBlur', 'renameTagGroupKeyup', 'tagGroupDescriptionChange', 'tagGroupDescriptionFocus', 'tagGroupDescriptionBlur',
  'gifViewer', 'gifPlayer', 'selectedTags', 'removeSound', 'lastIndex', 'isGifReady', 'orderBy', 'currentId', 'duplicateGroupings', 'tagViewModeName', 'colorDistancesMap', 'folderKeyword', 'listMetaType', 'isSearchScopeFolderName', 'isSearchScopeFolderDesc', 'preelaborations', 'paletteQueuePaused', 'addImageStartTime', 'availableHistoryTags', 'lastSelectedTag', 'gifUpadteInterval', 'sidebarIndex', 'canUseTouchID', 'unlockPassword', 'historySearchKeywords', 'boxContianerWidth', 'isSearchScopeName', 'isSearchScopeExt', 'isSearchScopeTag', 'isSearchScopeUrl', 'isSearchScopeAnnotation', 'isSearchScopeNote', 'keywordDebounce', 'MAX_LIST_WIDTH', 'contentFilterCache', 'isExpandQuickAccess', 'isExpandSmartFolder', 'isExpandFolder', 'commentRect', 'duplicateTarget', 'showName', 'showMetas', 'searchRegexGroup', 'addImageTimeLeftInSeconds', 'sliderZoomRatio', 'newGroupName', 'usingGifPlayer', 'paletteQueueDelay', 'lastProcessCount', 'isLibrarySaving', 'saveFolderDebounceTimeout', 'libraryHistory', 'isEnglish', 'initDetailMode', 'untagged', 'lastImageHeight', 'gotoBottomTimeout', 'isOpenWebpagePanel', 'boxContianerHeight', 'isHideMainNav', 'page', 'len', 'showOriginalImageWhenLarge', 'showAnnotation', 'showFileExtension', 'showFileExtensionLabel', 'duplicates', 'showLargeImage', 'usingCache', 'winMenu', 'selectingTags', 'libraryLoadedProgress', 'paletteQueueLength', 'metadataQueueLength', 'downloadQueueLength', 'MAX_DIMENSION', 'duplicateSound', 'errorSound', 'orderByName', 'folderIcons', 'hexColor', 'loadMoreDisable',
  'appVersion', 'buildVersion', 'buildNumber', 'tagViewLayoutMode', 'currentFolderPath', 'useMpvPlayer',
  'supportRotate', 'supportCrop', 'ratio', 'inspectorFolder', 'currentUrl', 'selectedFolder', 'isAlwaysOnTop',
  'keywords', 'keywords_cn', 'keywords_tw',
  'VIDEO_TYPES', 'AUDIO_TYPES', 'FONT_TYPES', 'URL_TYPES', 'MODEL_TYPES', 'DISABLE_ZOOM_TYPES', 'SUPPORT_FORMATS',
  'mousetrap', 'isImporting', 'openWithInfo', 'lastestAddItem', 'email', 'fontFolder', 'draggedFolders', 'draggedSmartFolders', 'draggedQuickAccess',
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
