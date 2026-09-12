
import { openFolder } from '../services/folderCoreService';
import { q, qaVisible } from '../utils/domQuery';
import { machineryOpenTrash } from './libraryDomain';
import { openSmartFolder } from '../services/folderCoreService';
import { cgNotifyServiceCloseAll, machineryLeaveDetailMode } from './miscDomain';
import { useMiscRawState } from '../store/miscRawState';
import { useBodyState } from '../store/bodyState';/**
 * b1-9bz-D-1 B-16：导航历史域（从 dataMachinery.ts 归位）。
 * 函数体逐字平移；依赖经 import 解析。
 */


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
/* back（bundle 30889-30896 逐字） */
export function machineryBack(): void {
  if (!useBodyState.getState().isDetailMode) {
    machineryPrevHistory();
  }
  else {
    machineryLeaveDetailMode();
  }
}

export function machineryNextHistory(): void {
  const w = window as any;
  if (useMiscRawState.getState().UrlStateService.canGoForward) {
    w.currentWindow.webContents.goForward();
  }
}

export function machineryOpenNextQuickAccess(): void {
  var $quickAccessItems = qaVisible(".sidebar-quick-access-item");
  var $current = q(".sidebar-quick-access-item.active");
  var currentIndex = $current ? $quickAccessItems.indexOf($current) : -1;

  if (currentIndex + 1 < $quickAccessItems.length) {
    $quickAccessItems[currentIndex + 1].click();
  }
  else {
    var listItems = useMiscRawState.getState().sidebarList;
    var folders = listItems.filter(function (item: any) {
      return item.vstype === 'folder';
    });
    var smartFolders = listItems.filter(function (item: any) {
      return item.vstype === 'smartFolder' || item.vstype === 'smartFolderGroup';
    });
    if (smartFolders.length > 0 && smartFolders[0]) {
      openSmartFolder(smartFolders[0]);
    }
    else if (folders.length > 0 && folders[0]) {
      openFolder(folders[0]);
    }
  }
}

export function machineryOpenPrevQuickAccess(): void {
  var $quickAccessItems = qaVisible(".sidebar-quick-access-item");
  var $current = q(".sidebar-quick-access-item.active");
  var currentIndex = $current ? $quickAccessItems.indexOf($current) : -1;

  if (currentIndex - 1 >= 0) {
    $quickAccessItems[currentIndex - 1].click();
  }
  else {
    machineryOpenTrash();
  }
}

export function machineryPrevHistory(): void {
  const w = window as any;
  if (useMiscRawState.getState().UrlStateService.canGoBack) {
    w.currentWindow.webContents.goBack();
  }
}

export function machineryUndo(): void {
  if (typeof useMiscRawState.getState().undo === 'function') useMiscRawState.getState().undo();
  if (typeof useMiscRawState.getState().closeAll === 'function') useMiscRawState.getState().closeAll();
  else cgNotifyServiceCloseAll();
}
