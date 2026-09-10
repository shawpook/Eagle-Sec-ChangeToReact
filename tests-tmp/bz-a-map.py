# -*- coding: utf-8 -*-
"""b1-9bz-A 共享映射表（分析器与 apply 脚本共用；被 exec 注入）"""

TARGET = {}
def assign(path, names):
    for nm in names:
        assert nm not in TARGET, 'dup ' + nm
        TARGET[nm] = path

assign('services/sidebarService.ts', [
    'clickNode', 'toggleFolderExpand', 'toggleSmartFolderExpand', 'toggleAllFolderExpand',
    'toggleAllSmartFolderExpand', 'toggleCurrentLevelFolders', 'hoverShowSidebar', 'hoverHideSidebar',
    'sidebarFocus', 'onSidebarResize', 'openFolderExpandContextMenu', 'getNodeClass',
    'getSmartFolderClass', 'getQuickAccessClass', 'changeSidebarIndex', 'toggleSelectFolder',
    'toggleSelectSmartFolder', 'dblclickSidebarSmartFolderGroup', 'updateSidebarList'])
assign('services/selectionService.ts', ['select', 'onBoxMouseup', 'onBoxListDblClick', 'onDetailClick'])
assign('core/filterDomain.ts', [
    'filterWithColor', 'filterWithFolder', 'filterWithHexColor', 'excludeWithFolder', 'toggleExtFilter',
    'toggleExtFilterExclude', 'resetFilter', 'calculateDateFilter', 'getDateFilterCountsArray',
    'updateFilterCounts', 'hexToRGB', 'openQuickSearch', 'closeQuickSearch', 'search', 'searchFocus',
    'contentFilter', 'filterContent', 'calcuteContainFolders'])
assign('services/mediaService.ts', [
    'toggleGifPlay', 'rotateVideo', 'flipVideo', 'loadSubtitles', 'setAsVideoThumbnail', 'toggleSlideshow'])
assign('services/uploadService.ts', ['uploadFiles', 'uploadUrls', 'importFolders', 'cancelAllTasks'])
assign('core/itemDomain.ts', [
    'copyAsBase64', 'copyAsFolderPath', 'copyAsLink', 'copyAsPath', 'copyAsProperity', 'copyAsThumbnail',
    'getGIFPath', 'getModelPath', 'getNativeViewerPath', 'getPDFPath', 'getRawPath', 'getRawUrl',
    'getRawViewerPath', 'getTxtPath', 'getURLSrc', 'getFolderFullPath', 'openInFinder', 'openItemLocation',
    'openFileWithDefault', 'openFilesWithDefault', 'openWithOther', 'openInPreviewWindow'])
assign('services/itemMenuService.ts', ['openItemContextMenu'])
assign('services/folderCoreService.ts', [
    'openFolder', 'openSmartFolder', 'openUnfiled', 'switchLibrary', 'exportFolder', 'duplicateItem',
    'getLibraryHistory', 'checkDiskSpace', 'smartFolderCount'])
assign('services/viewOpsService.ts', [
    'zoom', 'zoomIn', 'zoomFit', 'smartZoom', 'lastZoom', 'updateZoomRatio', 'getNext', 'getRatioExp',
    'getRatioNonExp', 'switchGridLayout', 'switchJustifiedLayout', 'switchListLayout', 'switchSquareLayout'])
assign('core/miscDomain.ts', [
    'maximize', 'togglePaletteProcessing', 'toggleQuickAccessVisible', 'toggleFolderVisible',
    'toggleSmartFolderVisible', 'changeOrderBy', 'undo', 'escHandler', 'contentFocus',
    'dblclickContentPanel', 'openErrorModal', 'cleanLocalhostError',
    'cleanLibraryPathPermissionError', 'leaveDetailMode'])
assign('services/lockService.ts', [
    'focusUnlockPassword', 'focusAppUnlockPassword', 'unlockPasswordKeyup',
    'unlockAppPasswordKeydown', 'unlockAppPasswordKeyup'])
assign('services/imageOpsService.ts', [
    'flipHandler', 'rotateHandler', 'changeImagesBackground', 'setCustomThumbnail',
    'setCustomThumbnailFromClipboard', 'resetCustomThumbnail'])

DEL_SET = {
    'clickSmartNode',
    'calculateFilterCounts', 'endHandler', 'getSelection', 'gotoBottom', 'homeHandler', 'mHandler',
    'nextGifFrame', 'prevGifFrame', 'saveFolder', 'selectDown', 'selectNext', 'selectPrev', 'selectUp',
    'toggleAll', 'toggleAllFolders', 'toggleCurrentLevelSmartFolders', 'toggleZoom',
    'updateContainerHieght', 'zoomActual', 'zoomFitEdge', 'zoomOut',
    'dblclickSidebarFolder', 'getExifRawPath', 'preventMiddleClick', 'toggleGifPlayerMode',
    'toggleRatioContextMenu',
}

STANDALONE = {
    'updateCurrentOrderAndIncrease': 'core/miscDomain.ts',
    'isInFolder': 'core/itemDomain.ts',
    'updateSuggestions': 'core/miscDomain.ts',
    'parseKeywordsWithOR': 'core/filterDomain.ts',
}

SYNC_MAP = {
    'syncFolderLock': 'store/lockState', 'syncUploadFromScope': 'store/uploadState',
    'syncListFromScope': 'store/listState', 'syncPanelFromScope': 'store/panelState',
    'syncSidebarFromScope': 'store/sidebarState', 'syncTagManagerFromScope': 'store/tagManagerState',
    'syncFilterFromScope': 'store/filterState', 'syncBodyFromScope': 'store/bodyState',
    'syncDetailFromScope': 'store/detailState', 'syncInspectorFromScope': 'store/inspectorState',
    'syncToolbarFromScope': 'store/toolbarState',
}
APP = {'getBodyScope': 'core/appCore', 'getRootScope': 'core/appCore', 'scopeApply': 'core/appCore',
       'findLiveNode': 'core/appCore', 'classObjectToString': 'core/appCore'}
UTILS = {'debounce': 'utils/func', 'throttle': 'utils/func', 'get': 'utils/lang', 'isString': 'utils/lang',
         'unescape': 'utils/lang'}
OTHERS = {'ContextMenu': 'core/contextMenuDomain', 'renameImages': 'core/contextMenuDomain',
          'contextMenuOpenChannel': 'global/bus', 'itemMenuOpenItemContextMenu': 'services/itemMenuService',
          'IPCHelper': 'core/ipcHelper', 'detailZoom': 'core/smoothZoomEngine',
          'ensureDetailZoom': 'core/smoothZoomEngine'}
KNOWN = {}
KNOWN.update(SYNC_MAP); KNOWN.update(APP); KNOWN.update(UTILS); KNOWN.update(OTHERS)
STANDALONE_ID = {'updateCurrentOrderAndIncrease': 'core/miscDomain', 'isInFolder': 'core/itemDomain',
                 'updateSuggestions': 'core/miscDomain'}

CONST_NAMES = {'VIDEO_TYPES', 'AUDIO_TYPES', 'FONT_TYPES', 'SPECIAL_TYPES',
               'NOT_SUPPORT_CUSTEOM_THUMBNAIL_TYPES', 'emojiRegex', 'EagleConfig', '_req', 'fs',
               'DATE_1_DAY', 'DATE_2_DAY', 'DATE_7_DAY', 'DATE_30_DAY', 'DATE_90_DAY', 'DATE_365_DAY'}

GLOBALS = set('''window document localStorage navigator location setTimeout setInterval
clearInterval Date Math JSON Object Array String Number Boolean Promise RegExp parseInt parseFloat
isNaN encodeURIComponent decodeURIComponent console process require globalThis Infinity NaN undefined
arguments this $ jQuery eagle alert confirm requestAnimationFrame cancelAnimationFrame
chineseConvert pinyinlite cartesianProduct TagManager i18n fuzzy_match'''.split())

LV_CHUNK_VARS = ['__lv_path', '__lv_updateListHeight', '__lv_saveListHeight', '__lv_setLastFolder']

def rel_import(target_path, module):
    tdir = os.path.dirname(target_path).replace('\\', '/')
    if tdir in ('', '.'):
        return './' + module
    if '/' in tdir:
        return '../../' + module
    return '../' + module

import os

# 落点已有同名导出（machinery 背书 wrapper）——c3 体不迁，表项指向既有导出
POINTER_EXISTING = {'clickNode', 'toggleFolderExpand', 'toggleSmartFolderExpand', 'updateSidebarList'}
