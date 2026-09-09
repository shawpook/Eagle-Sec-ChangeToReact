/**
 * c3：EagleController 函数域逐字移植（React 调用面全量 155 函数）。提取自 bundle
 * EagleController link 体（brace 精确扫描），机械替换：$scope → s（makeControllerFns
 * (getScope) 注入，闭包变量不占实参位）、$rootScope → s.$root。
 * link 级共享 var 声明提升至闭包顶层（__lv_ 前缀防与 shim 重名；代码上下文感知改名）、
 * 初始化惰性首调执行；link 级辅助函数逐字导出。callScope 路由优先命中本表（hooks.ts），
 * bundle 同名函数退为后备。cZ 时随状态一并迁入 AppCore。
 */
// @ts-nocheck
// b1-9bz-A：148 表体归位 11 落点（services/* + core/*）——本文件缩为指针注册表：
// fns["NAME"] = 落点导出指针（callScope/scope 函数面零行为变化）；27 死壳删除。
// bz-B 摘 callScope/attach 双面后本文件退役（bz-C 删除）。

import { calculateDateFilter, calcuteContainFolders, closeQuickSearch, contentFilter, excludeWithFolder, filterContent, filterWithColor, filterWithFolder, filterWithHexColor, getDateFilterCountsArray, hexToRGB, openQuickSearch, resetFilter, search, searchFocus, toggleExtFilter, toggleExtFilterExclude, updateFilterCounts } from '../core/filterDomain';
import { copyAsBase64, copyAsFolderPath, copyAsLink, copyAsPath, copyAsProperity, copyAsThumbnail, getFolderFullPath, getGIFPath, getModelPath, getNativeViewerPath, getPDFPath, getRawPath, getRawUrl, getRawViewerPath, getTxtPath, getURLSrc, openFileWithDefault, openFilesWithDefault, openInFinder, openInPreviewWindow, openItemLocation, openWithOther } from '../core/itemDomain';
import { changeOrderBy, cleanLibraryPathPermissionError, cleanLocalhostError, contentFocus, dblclickContentPanel, escHandler, leaveDetailMode, maximize, openErrorModal, toggleFolderVisible, togglePaletteProcessing, toggleQuickAccessVisible, toggleSmartFolderVisible, undo } from '../core/miscDomain';
import { checkDiskSpace, duplicateItem, exportFolder, getLibraryHistory, openFolder, openSmartFolder, openUnfiled, smartFolderCount, switchLibrary } from '../services/folderCoreService';
import { changeImagesBackground, flipHandler, resetCustomThumbnail, rotateHandler, setCustomThumbnail, setCustomThumbnailFromClipboard } from '../services/imageOpsService';
import { openItemContextMenu } from '../services/itemMenuService';
import { focusAppUnlockPassword, focusUnlockPassword, unlockAppPasswordKeydown, unlockAppPasswordKeyup, unlockPasswordKeyup } from '../services/lockService';
import { flipVideo, loadSubtitles, rotateVideo, setAsVideoThumbnail, toggleGifPlay, toggleSlideshow } from '../services/mediaService';
import { onBoxListDblClick, onBoxMouseup, onDetailClick, select } from '../services/selectionService';
import { changeSidebarIndex, clickNode, dblclickSidebarSmartFolderGroup, getNodeClass, getQuickAccessClass, getSmartFolderClass, hoverHideSidebar, hoverShowSidebar, onSidebarResize, openFolderExpandContextMenu, sidebarFocus, toggleAllFolderExpand, toggleAllSmartFolderExpand, toggleCurrentLevelFolders, toggleFolderExpand, toggleSelectFolder, toggleSelectSmartFolder, toggleSmartFolderExpand, updateSidebarList } from '../services/sidebarService';
import { cancelAllTasks, importFolders, uploadFiles, uploadUrls } from '../services/uploadService';
import { getNext, getRatioExp, getRatioNonExp, lastZoom, smartZoom, switchGridLayout, switchJustifiedLayout, switchListLayout, switchSquareLayout, updateZoomRatio, zoom, zoomFit, zoomIn } from '../services/viewOpsService';
import { installFolderMenuFns } from '../services/folderMenuService';
import { installMiscMenuFns } from '../services/miscMenuService';
import { installBatchOpsFns } from '../services/batchOpsService';
import { installFolderCoreFns } from '../services/folderCoreService';
import { installImageOpsFns } from '../services/imageOpsService';
import { installFontTagFns } from '../services/fontTagService';

export function makeControllerFns(getScope: () => any) {
  const fns: Record<string, any> = {};

  // core/filterDomain.ts
  fns["calculateDateFilter"] = calculateDateFilter;
  fns["calcuteContainFolders"] = calcuteContainFolders;
  fns["closeQuickSearch"] = closeQuickSearch;
  fns["contentFilter"] = contentFilter;
  fns["excludeWithFolder"] = excludeWithFolder;
  fns["filterContent"] = filterContent;
  fns["filterWithColor"] = filterWithColor;
  fns["filterWithFolder"] = filterWithFolder;
  fns["filterWithHexColor"] = filterWithHexColor;
  fns["getDateFilterCountsArray"] = getDateFilterCountsArray;
  fns["hexToRGB"] = hexToRGB;
  fns["openQuickSearch"] = openQuickSearch;
  fns["resetFilter"] = resetFilter;
  fns["search"] = search;
  fns["searchFocus"] = searchFocus;
  fns["toggleExtFilter"] = toggleExtFilter;
  fns["toggleExtFilterExclude"] = toggleExtFilterExclude;
  fns["updateFilterCounts"] = updateFilterCounts;
  // core/itemDomain.ts
  fns["copyAsBase64"] = copyAsBase64;
  fns["copyAsFolderPath"] = copyAsFolderPath;
  fns["copyAsLink"] = copyAsLink;
  fns["copyAsPath"] = copyAsPath;
  fns["copyAsProperity"] = copyAsProperity;
  fns["copyAsThumbnail"] = copyAsThumbnail;
  fns["getFolderFullPath"] = getFolderFullPath;
  fns["getGIFPath"] = getGIFPath;
  fns["getModelPath"] = getModelPath;
  fns["getNativeViewerPath"] = getNativeViewerPath;
  fns["getPDFPath"] = getPDFPath;
  fns["getRawPath"] = getRawPath;
  fns["getRawUrl"] = getRawUrl;
  fns["getRawViewerPath"] = getRawViewerPath;
  fns["getTxtPath"] = getTxtPath;
  fns["getURLSrc"] = getURLSrc;
  fns["openFileWithDefault"] = openFileWithDefault;
  fns["openFilesWithDefault"] = openFilesWithDefault;
  fns["openInFinder"] = openInFinder;
  fns["openInPreviewWindow"] = openInPreviewWindow;
  fns["openItemLocation"] = openItemLocation;
  fns["openWithOther"] = openWithOther;
  // core/miscDomain.ts
  fns["changeOrderBy"] = changeOrderBy;
  fns["cleanLibraryPathPermissionError"] = cleanLibraryPathPermissionError;
  fns["cleanLocalhostError"] = cleanLocalhostError;
  fns["contentFocus"] = contentFocus;
  fns["dblclickContentPanel"] = dblclickContentPanel;
  fns["escHandler"] = escHandler;
  fns["leaveDetailMode"] = leaveDetailMode;
  fns["maximize"] = maximize;
  fns["openErrorModal"] = openErrorModal;
  fns["toggleFolderVisible"] = toggleFolderVisible;
  fns["togglePaletteProcessing"] = togglePaletteProcessing;
  fns["toggleQuickAccessVisible"] = toggleQuickAccessVisible;
  fns["toggleSmartFolderVisible"] = toggleSmartFolderVisible;
  fns["undo"] = undo;
  // services/folderCoreService.ts
  fns["checkDiskSpace"] = checkDiskSpace;
  fns["duplicateItem"] = duplicateItem;
  fns["exportFolder"] = exportFolder;
  fns["getLibraryHistory"] = getLibraryHistory;
  fns["openFolder"] = openFolder;
  fns["openSmartFolder"] = openSmartFolder;
  fns["openUnfiled"] = openUnfiled;
  fns["smartFolderCount"] = smartFolderCount;
  fns["switchLibrary"] = switchLibrary;
  // services/imageOpsService.ts
  fns["changeImagesBackground"] = changeImagesBackground;
  fns["flipHandler"] = flipHandler;
  fns["resetCustomThumbnail"] = resetCustomThumbnail;
  fns["rotateHandler"] = rotateHandler;
  fns["setCustomThumbnail"] = setCustomThumbnail;
  fns["setCustomThumbnailFromClipboard"] = setCustomThumbnailFromClipboard;
  // services/itemMenuService.ts
  fns["openItemContextMenu"] = openItemContextMenu;
  // services/lockService.ts
  fns["focusAppUnlockPassword"] = focusAppUnlockPassword;
  fns["focusUnlockPassword"] = focusUnlockPassword;
  fns["unlockAppPasswordKeydown"] = unlockAppPasswordKeydown;
  fns["unlockAppPasswordKeyup"] = unlockAppPasswordKeyup;
  fns["unlockPasswordKeyup"] = unlockPasswordKeyup;
  // services/mediaService.ts
  fns["flipVideo"] = flipVideo;
  fns["loadSubtitles"] = loadSubtitles;
  fns["rotateVideo"] = rotateVideo;
  fns["setAsVideoThumbnail"] = setAsVideoThumbnail;
  fns["toggleGifPlay"] = toggleGifPlay;
  fns["toggleSlideshow"] = toggleSlideshow;
  // services/selectionService.ts
  fns["onBoxListDblClick"] = onBoxListDblClick;
  fns["onBoxMouseup"] = onBoxMouseup;
  fns["onDetailClick"] = onDetailClick;
  fns["select"] = select;
  // services/sidebarService.ts
  fns["changeSidebarIndex"] = changeSidebarIndex;
  fns["clickNode"] = clickNode;
  fns["dblclickSidebarSmartFolderGroup"] = dblclickSidebarSmartFolderGroup;
  fns["getNodeClass"] = getNodeClass;
  fns["getQuickAccessClass"] = getQuickAccessClass;
  fns["getSmartFolderClass"] = getSmartFolderClass;
  fns["hoverHideSidebar"] = hoverHideSidebar;
  fns["hoverShowSidebar"] = hoverShowSidebar;
  fns["onSidebarResize"] = onSidebarResize;
  fns["openFolderExpandContextMenu"] = openFolderExpandContextMenu;
  fns["sidebarFocus"] = sidebarFocus;
  fns["toggleAllFolderExpand"] = toggleAllFolderExpand;
  fns["toggleAllSmartFolderExpand"] = toggleAllSmartFolderExpand;
  fns["toggleCurrentLevelFolders"] = toggleCurrentLevelFolders;
  fns["toggleFolderExpand"] = toggleFolderExpand;
  fns["toggleSelectFolder"] = toggleSelectFolder;
  fns["toggleSelectSmartFolder"] = toggleSelectSmartFolder;
  fns["toggleSmartFolderExpand"] = toggleSmartFolderExpand;
  fns["updateSidebarList"] = updateSidebarList;
  // services/uploadService.ts
  fns["cancelAllTasks"] = cancelAllTasks;
  fns["importFolders"] = importFolders;
  fns["uploadFiles"] = uploadFiles;
  fns["uploadUrls"] = uploadUrls;
  // services/viewOpsService.ts
  fns["getNext"] = getNext;
  fns["getRatioExp"] = getRatioExp;
  fns["getRatioNonExp"] = getRatioNonExp;
  fns["lastZoom"] = lastZoom;
  fns["smartZoom"] = smartZoom;
  fns["switchGridLayout"] = switchGridLayout;
  fns["switchJustifiedLayout"] = switchJustifiedLayout;
  fns["switchListLayout"] = switchListLayout;
  fns["switchSquareLayout"] = switchSquareLayout;
  fns["updateZoomRatio"] = updateZoomRatio;
  fns["zoom"] = zoom;
  fns["zoomFit"] = zoomFit;
  fns["zoomIn"] = zoomIn;

  // b1-9bn..bt 菜单/批量/文件夹核心/图像操作/字体族 install 注册面（条目名零改动）
  installFolderMenuFns(fns, getScope);
  installMiscMenuFns(fns, getScope);
  installBatchOpsFns(fns, getScope);
  installFolderCoreFns(fns, getScope);
  installImageOpsFns(fns, getScope);
  installFontTagFns(fns, getScope);
  return fns;
}
