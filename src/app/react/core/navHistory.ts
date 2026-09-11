
import { openFolder } from '../services/folderCoreService';
import { q, qaVisible } from '../utils/domQuery';
import { machineryOpenTrash } from './libraryDomain';
import { openSmartFolder } from '../services/folderCoreService';
import { cgNotifyServiceCloseAll, machineryLeaveDetailMode } from './miscDomain';/**
 * b1-9bz-D-1 B-16：导航历史域（从 dataMachinery.ts 归位）。
 * 函数体逐字平移；依赖经 import 解析。
 */


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
/* back（bundle 30889-30896 逐字） */
export function machineryBack(s: any): void {
  if (!s.isDetailMode) {
    machineryPrevHistory(s);
  }
  else {
    machineryLeaveDetailMode(s);
  }
}

export function machineryNextHistory(s: any): void {
  const w = window as any;
  if (s.UrlStateService.canGoForward) {
    w.currentWindow.webContents.goForward();
  }
}

export function machineryOpenNextQuickAccess(s: any): void {
  var $quickAccessItems = qaVisible(".sidebar-quick-access-item");
  var $current = q(".sidebar-quick-access-item.active");
  var currentIndex = $current ? $quickAccessItems.indexOf($current) : -1;

  if (currentIndex + 1 < $quickAccessItems.length) {
    $quickAccessItems[currentIndex + 1].click();
  }
  else {
    var listItems = s.sidebarList;
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

export function machineryOpenPrevQuickAccess(s: any): void {
  var $quickAccessItems = qaVisible(".sidebar-quick-access-item");
  var $current = q(".sidebar-quick-access-item.active");
  var currentIndex = $current ? $quickAccessItems.indexOf($current) : -1;

  if (currentIndex - 1 >= 0) {
    $quickAccessItems[currentIndex - 1].click();
  }
  else {
    machineryOpenTrash(s);
  }
}

export function machineryPrevHistory(s: any): void {
  const w = window as any;
  if (s.UrlStateService.canGoBack) {
    w.currentWindow.webContents.goBack();
  }
}

export function machineryUndo(s: any): void {
  if (typeof s.$root.undo === 'function') s.$root.undo();
  if (typeof s.$root.closeAll === 'function') s.$root.closeAll();
  else cgNotifyServiceCloseAll();
}
