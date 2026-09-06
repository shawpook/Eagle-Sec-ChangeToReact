/**
 * b1-9bg：侧栏服务 —— 树函数族归位（自 controllerFns fns 表逐字搬移）。
 *
 * 覆盖：clickNode / clickSmartNode（单击打开 + meta/shift 多选链）、toggleFolderExpand /
 * toggleSmartFolderExpand（展开收起四分支：⌘+alt 全层级 / ⌘ 第一层 / alt 子层 / 普通）、
 * dblclickSidebarFolder（偏好分流 collapse/rename）、preventMiddleClick。
 *
 * 约定：函数显式收 `s`（body scope）；machinery 树形开关（toggleAllFolders 等）仍由
 * dataMachinery 承载经导入直调。b1-9ay 的 window.dragCheck 守卫逐字保留（Sidebar
 * draggable 中转标志）。fns 表同名条目保留（shim if-absent 桥，P4 随 fns 表退役）；
 * 本模块是**组件侧唯一入口**（Sidebar.tsx 此前 ~30 处 scopeApply 绕道）。
 * 菜单族（openFolderContextMenu 等）归 S5 菜单竖切；DnD（onDropFolder 族）归 bh。
 */
import { getBodyScope } from '../global/scopeBridge';
import {
  machineryToggleAllFolders,
  machineryToggleCurrentLevelFolders,
  machineryToggleAllSmartFoldersInner,
  machineryToggleCurrentLevelSmartFoldersInner,
} from '../core/dataMachinery';

/* clickNode（bundle 21890 逐字：中键/dragCheck 守卫 + meta 多选 + shift 区间选择 +
   普通单击 openFolder） */
export function sidebarClickNode(s: any, event: any, folder: any): void {
  // b1-9ay：dragCheck 原 bundle 闭包 var，逐字移植丢声明后裸引用在首次拖拽前
  // 是未声明全局——每个侧栏文件夹点击即 ReferenceError 且被 $apply 吞
  // （sweep B6 直调实锤）。Sidebar draggable 经 window.dragCheck 中转。
  if (event.which == 2 || (window as any).dragCheck) {
    event.stopPropagation();
    return;
  }
  if (event.metaKey || event.ctrlKey) {
    if (s.currentFolder) {
      if (s.$root.selectedFolders.indexOf(s.currentFolder) === -1) {
        s.$root.selectedFolders.push(s.currentFolder);
      }
      s.$root.selectedFoldersMappings[s.currentFolder.id] = s.currentFolder;
    }
    s.multipleOpenFolder(folder, true);
  }
  else if (event.shiftKey) {

    if (!s.currentId) return;

    var id = s.currentId;
    var curarentFolderId = id.replace("folder-", "");
    var currentFolder = s.folderMappings[curarentFolderId];
    var fidx = s.sidebarList.indexOf(currentFolder);
    var tidx = s.sidebarList.indexOf(folder);

    if (fidx === -1 || tidx === -1) return;
    if (fidx > tidx) {
      [fidx, tidx] = [tidx, fidx];
    }

    for (var i = fidx; i <= tidx; i++) {
      var item = s.sidebarList[i];
      if (item.vstype === "folder") {
        var __lv_idx = s.$root.selectedFolders.indexOf(item);
        if (__lv_idx === -1) {
          s.$root.selectedFolders.push(item);
          s.$root.selectedFoldersMappings[item.id] = item;
        }
      }
    }
    s.currentFolderChildren = s.getChildFoldersMaps(s.$root.selectedFolders);
    s.reload();
  }
  else {
    s.openFolder(folder, false, 'folder-' + folder.id);
  }
}

/* clickSmartNode（bundle 22036 邻域逐字：clickNode 的 smartFolder 对称版） */
export function sidebarClickSmartNode(s: any, event: any, smartFolder: any): void {
  // b1-9ay：同 clickNode——dragCheck 经 window 中转（原 bundle 闭包 var）
  if (event.which == 2 || (window as any).dragCheck) {
    event.stopPropagation();
    return;
  }
  if (event.metaKey || event.ctrlKey) {
    if (s.currentSmartFolder) {
      if (s.$root.selectedSmartFolders.indexOf(s.currentSmartFolder) === -1) {
        s.$root.selectedSmartFolders.push(s.currentSmartFolder);
      }
      s.$root.selectedSmartFoldersMappings[s.currentSmartFolder.id] = s.currentSmartFolder;
    }
    s.multipleOpenSmartFolder(smartFolder, true);
  }
  else if (event.shiftKey) {

    if (!s.currentId) return;

    var id = s.currentId;
    var curarentSmartFolderId = id.replace("smart-folder-", "");
    var currentSmartFolder = s.smartFolderMappings[curarentSmartFolderId];
    var fidx = s.sidebarList.indexOf(currentSmartFolder);
    var tidx = s.sidebarList.indexOf(smartFolder);

    if (fidx === -1 || tidx === -1) return;
    if (fidx > tidx) {
      [fidx, tidx] = [tidx, fidx];
    }

    for (var i = fidx; i <= tidx; i++) {
      var item = s.sidebarList[i];
      var __lv_idx = s.$root.selectedSmartFolders.indexOf(item);
      if (__lv_idx === -1) {
        s.$root.selectedSmartFolders.push(item);
        s.$root.selectedSmartFoldersMappings[item.id] = item;
      }
    }
    s.reload();
  }
  else {
    s.openSmartFolder(smartFolder, false, 'smart-folder-' + smartFolder.id);
  }
}

/* toggleFolderExpand（bundle 42210 邻域逐字：展开收起四分支 + per-node localStorage） */
export function sidebarToggleFolderExpand(s: any, event: any, folder: any): void {
  event.stopPropagation();

  if (!folder.children || folder.children.length == 0) return;

  // 如果用户点击了 ⌘ + alt，展开/收起所有层级
  if (event.altKey && (event.metaKey || event.ctrlKey)) {
    var expand = !folder.isExpand;
    machineryToggleAllFolders(s, s.folders, expand);
  }
  // 如果用户点击 ⌘，展开/收起第一层
  else if (event.metaKey || event.ctrlKey) {
    var expand = !folder.isExpand;
    var parent = s.folderMappings[folder.parent];
    var folders = s.folders;
    if (parent && parent.children) {
      folders = parent.children;
    }
    machineryToggleCurrentLevelFolders(s, folders, expand);
  }
  else if (event.altKey) {
    var expand = !folder.isExpand;
    var folders = folder.children;
    folder.isExpand = expand;
    machineryToggleCurrentLevelFolders(s, folders, expand);
  }
  else {
    folder.isExpand = !folder.isExpand;
    localStorage.setItem("eagle.sidebar.folder.expand." + folder.id, folder.isExpand);
  }
  s.updateSidebarList();
}

/* toggleSmartFolderExpand（bundle 42270 邻域逐字：toggleFolderExpand 的 smartFolder 对称版） */
export function sidebarToggleSmartFolderExpand(s: any, event: any, smartFolder: any): void {
  event.stopPropagation();

  if (!smartFolder.children || smartFolder.children.length == 0) return;

  // 如果用户点击了 ⌘ + alt，展开/收起所有层级
  if (event.altKey && (event.metaKey || event.ctrlKey)) {
    var expand = !smartFolder.isExpand;
    machineryToggleAllSmartFoldersInner(s, s.smartFolders, expand);
  }
  // 如果用户点击 ⌘，展开/收起第一层
  else if (event.metaKey || event.ctrlKey) {
    var expand = !smartFolder.isExpand;
    var parent = s.smartFolderMappings[smartFolder.parent];
    var smartFolders = s.smartFolders;
    if (parent && parent.children) {
      smartFolders = parent.children;
    }
    machineryToggleCurrentLevelSmartFoldersInner(s, smartFolders, expand);
  }
  else if (event.altKey) {
    var expand = !smartFolder.isExpand;
    var smartFolders = smartFolder.children;
    smartFolder.isExpand = expand;
    machineryToggleCurrentLevelSmartFoldersInner(s, smartFolders, expand);
  }
  else {
    smartFolder.isExpand = !smartFolder.isExpand;
    localStorage.setItem("eagle.sidebar.smartFolder.expand." + smartFolder.id, smartFolder.isExpand);
  }

  s.updateSidebarList();
}

/* dblclickSidebarFolder（bundle 23420 邻域逐字：偏好分流 collapse / rename） */
export function sidebarDblclickFolder(s: any, event: any, folder: any): void {
  if (s.$root.preferences.habits.dblclickSidebarItem === 'collapse') {
    s.toggleFolderExpand(event, folder);
  }
  else {
    s.renameFolder(event, folder);
  }
}

/* preventMiddleClick（bundle 顶层逐字） */
export function sidebarPreventMiddleClick(event: any): void {
  if (event.which == 2) {
    event.stopPropagation();
  }
}

/* ── b1-9bb 承接：updateSidebarList 组件侧桥（实现体仍在 machinery，20ms 防抖重建
   s.sidebarList；S2-bh/bf 评估把主体迁入）── */
export function updateSidebarList(): void {
  const s = getBodyScope();
  if (s && typeof s.updateSidebarList === 'function') s.updateSidebarList();
}

/* ── React 直调便捷面（无 scope 参数版本）——Sidebar.tsx 事件处理直调不绕 scopeApply。 */
export function clickNode(event: any, folder: any): void {
  const s = getBodyScope();
  if (s) sidebarClickNode(s, event, folder);
}

export function clickSmartNode(event: any, smartFolder: any): void {
  const s = getBodyScope();
  if (s) sidebarClickSmartNode(s, event, smartFolder);
}

export function toggleFolderExpand(event: any, folder: any): void {
  const s = getBodyScope();
  if (s) sidebarToggleFolderExpand(s, event, folder);
}

export function toggleSmartFolderExpand(event: any, smartFolder: any): void {
  const s = getBodyScope();
  if (s) sidebarToggleSmartFolderExpand(s, event, smartFolder);
}

export function dblclickSidebarFolder(event: any, folder: any): void {
  const s = getBodyScope();
  if (s) sidebarDblclickFolder(s, event, folder);
}

export function preventMiddleClick(event: any): void {
  sidebarPreventMiddleClick(event);
}
