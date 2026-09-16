
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

export function machineryNextHistory(event?: any): void {
  const w = window as any;
  // M4-A：原写法 `if (…UrlStateService.canGoForward)` 读的是**函数对象**——恒 truthy，
  // guard 恒真 ≡ 无条件 `goForward()`。改为与 store/toolbarState.ts:107-112 同一口径：
  // **真正调用**（带括号）+ try/catch 兜住「服务未就绪」。
  let canGoForward = false;
  try { canGoForward = !!useMiscRawState.getState().UrlStateService.canGoForward(); } catch (err) { canGoForward = false; }
  if (canGoForward) {
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

export function machineryPrevHistory(event?: any): void {
  const w = window as any;
  // M4-A：同上（原 `if (…UrlStateService.canGoBack)` 恒真 ≡ 无条件 `goBack()`）。
  let canGoBack = false;
  try { canGoBack = !!useMiscRawState.getState().UrlStateService.canGoBack(); } catch (err) { canGoBack = false; }
  if (canGoBack) {
    w.currentWindow.webContents.goBack();
  }
}

export function machineryUndo(): void {
  if (typeof useMiscRawState.getState().undo === 'function') useMiscRawState.getState().undo();
  if (typeof useMiscRawState.getState().closeAll === 'function') useMiscRawState.getState().closeAll();
  else cgNotifyServiceCloseAll();
}
