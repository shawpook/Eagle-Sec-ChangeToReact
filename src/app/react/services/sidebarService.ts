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

import { syncListFromScope } from '../store/listState';
import { syncSidebarFromScope } from '../store/sidebarState';
import { getBodyScope } from '../core/appCore';
import { contextMenuOpenChannel, rebindRefreshcontainsizeChannel } from '../global/bus';
import { syncBodyFromScope } from '../store/bodyState';
import { syncTagManagerFromScope } from '../store/tagManagerState';
import { openFolder, openSmartFolder } from './folderCoreService';
import { scopeEvalAsync } from '../global/scopeShim';
import { q, hasClass, addClass, removeClass } from '../utils/domQuery';

import { machineryMultipleOpenSmartFolder } from '../core/libraryDomain';
import { machineryUpdateSliderPosition } from './gridService';
import { machineryGetChildFoldersMaps, machineryRenameFolder, machineryRenameSmartFolder } from '../core/libraryDomain';
import { machineryRelayout } from './gridService';
import { machineryChangeSidebarIndex, machineryMultipleOpenFolder, machineryToggleAllFolders, machineryToggleAllSmartFolderExpand, machineryToggleAllSmartFoldersInner, machineryToggleCurrentLevelFolders, machineryToggleCurrentLevelSmartFoldersInner, machineryUpdateSidebarList } from '../core/libraryDomain';
import { machineryToggleSelectSmartFolder } from '../core/selectionViewDomain';
import { getOffsetScrollbarFn } from './gridService';
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
        syncListFromScope();
      }
      s.$root.selectedFoldersMappings[s.currentFolder.id] = s.currentFolder;
    }
    machineryMultipleOpenFolder(s, folder, true);
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
          syncListFromScope();
          s.$root.selectedFoldersMappings[item.id] = item;
        }
      }
    }
    s.currentFolderChildren = machineryGetChildFoldersMaps(s, s.$root.selectedFolders);
    s.reload();
  }
  else {
    openFolder(folder, false, 'folder-' + folder.id);
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
    machineryMultipleOpenSmartFolder(s, smartFolder, true);
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
    openSmartFolder(smartFolder, false, 'smart-folder-' + smartFolder.id);
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
  machineryUpdateSidebarList(s);
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

  machineryUpdateSidebarList(s);
}

/* dblclickSidebarFolder（bundle 23420 邻域逐字：偏好分流 collapse / rename） */
export function sidebarDblclickFolder(s: any, event: any, folder: any): void {
  if (s.$root.preferences.habits.dblclickSidebarItem === 'collapse') {
    toggleFolderExpand(event, folder);
  }
  else {
    machineryRenameFolder(s, event, folder);
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
  if (s) machineryUpdateSidebarList(s);
}

/* ── React 直调便捷面（无 scope 参数版本）——Sidebar.tsx 事件处理直调不绕 scopeApply。 */
export function clickNode(event: any, folder: any): void {
  const s = getBodyScope();
  if (s) sidebarClickNode(s, event, folder);
  // b1-9by-B：isSelected/currentId 等节点变异后直推快照（原 200ms 轮询退役）
  syncSidebarFromScope();
}

export function clickSmartNode(event: any, smartFolder: any): void {
  const s = getBodyScope();
  if (s) sidebarClickSmartNode(s, event, smartFolder);
  syncSidebarFromScope();
}

export function toggleFolderExpand(event: any, folder: any): void {
  const s = getBodyScope();
  if (s) sidebarToggleFolderExpand(s, event, folder);
  syncSidebarFromScope();
}

export function toggleSmartFolderExpand(event: any, smartFolder: any): void {
  const s = getBodyScope();
  if (s) sidebarToggleSmartFolderExpand(s, event, smartFolder);
  syncSidebarFromScope();
}

export function dblclickSidebarFolder(event: any, folder: any): void {
  const s = getBodyScope();
  if (s) sidebarDblclickFolder(s, event, folder);
  syncSidebarFromScope();
}

export function preventMiddleClick(event: any): void {
  sidebarPreventMiddleClick(event);
}

// ═══ b1-9bz-A：controllerFns 表体归位（逐字平移；getScope()→getBodyScope()；表项指针化）═══
// —— controllerFns 模块级声明随迁（verbatim；按原声明顺序防 TDZ）——
const electronSettings: any = (window as any).electronSettings;

let preferences: any = (window as any).electronSettings?.getPreferences?.() || {};

const $timeout: any = (fn: any, ms?: number) => setTimeout(() => {
  try { if (typeof fn === 'function') fn(); } finally { try { scopeEvalAsync(); } catch (err) { /* noop */ } }
}, ms || 0);
// b1-9bz-A 收口：`$timeout.cancel(timer)` 是 Angular 注入服务的第二形态（详见 filterDomain
// 同款注释）——本落点当前无 cancel 消费面，但移植体与社会面共享同一 shim 语义，补平以防后续
// 归位体踩同类坑（`$timeout.cancel is not a function` 会被 electronLog 缺席的 catch 静默吞掉）。
$timeout.cancel = function (timer: any): boolean {
  if (timer === null || timer === undefined) return false;
  try { clearTimeout(timer); } catch (err) { /* noop */ }
  return true;
};

// —— link 级共享态（原 makeControllerFns 闭包声明）——
var __lv_onSidebarResizeTimeout: any;
var __lv_updateSidebarListTimeout: any;

let lvInited = false;
const initLinkVars = () => {
  if (lvInited) return;
  lvInited = true;
};

const getScope = getBodyScope;  // b1-9bz-A：原 makeControllerFns(getScope) 注入的等价别名

export function changeSidebarIndex(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版逐行等价（仅 $timeout 取法与
  // 局部变量名不同），统一转发消除重复实现。
    const s = getBodyScope();
  if (!s) return;   // 原 c3 体的 scope 守卫，逐字保留
  machineryChangeSidebarIndex(s, args[0]);
}

export function dblclickSidebarSmartFolderGroup(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (event, folder) {
        	if (s.$root.preferences.habits.dblclickSidebarItem === 'collapse') {
        		toggleSmartFolderExpand(event, folder);
        	}
        	else {
        		machineryRenameSmartFolder(s, event, folder);
        	}
        }).apply(null, args);
  }

export function getNodeClass(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (node) {
            var __lv_result = {
                'active active-item': (s.$root.selectedFolders.length === 0 && s.currentId == 'folder-' + node.id) || s.$root.selectedFoldersMappings[node.id],
                'locked': node.password && !node.isUnLock,
                'collapsed': !node.isExpand && !s.folderKeyword.length,
                'editable': node.editable,
                'selected': node.isSelected,
                'editable': node.editable,
                'empty-node': node.children && node.children.length == 0,
                'show-badge': node.imageCount > 0,
                'close': node.children && node.children.length <= 0 && node.isExpand,
                'show-lock-icon': node.password && !node.isUnLock,
                'show-unlock-icon': node.password && node.isUnLock,
                'has-childred': node.children && node.children.length > 0,
                'first': node.styles && node.styles.first,
                'last': node.styles && node.styles.last,
            }
            __lv_result[`depth-${node.styles.depth}`] = true;
            __lv_result[`icon-${node.icon}`] = true;
            __lv_result[`color-${node.iconColor}`] = true;
			let parent = s.folderMappings[node.parent];
			if (parent) {
				__lv_result[`parent-color-${parent?.iconColor}`] = true;
			}
            return __lv_result;
        }).apply(null, args);
  }

export function getQuickAccessClass(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (item) {
            var node;
            if (item.type === 'folder') {
                node = s.folderMappings[item.id];
            }
            else {
                node = s.smartFolderMappings[item.id];
            }
            
            if (!node) return;

            var __lv_result = {
                'active active-item': s.currentId === ('quickaccess-' + node.id),
                'locked': node.password && !node.isUnLock,
                'collapsed': !node.isExpand && !s.folderKeyword.length,
                'selected': node.isSelected,
                'editable': node.editable,
                'empty-node': node.children && node.children.length == 0,
                'color-red': node.iconColor == 'red',
                'color-orange': node.iconColor == 'orange',
                'color-yellow': node.iconColor == 'yellow',
                'color-green': node.iconColor == 'green',
                'color-aqua': node.iconColor == 'aqua',
                'color-blue': node.iconColor == 'blue',
                'color-purple': node.iconColor == 'purple',
                'color-pink': node.iconColor == 'pink',
                'show-badge': node.imageCount > 0,
                'close': node.children && node.children.length <= 0 && node.isExpand,
                'show-lock-icon': node.password && !node.isUnLock,
                'show-unlock-icon': node.password && node.isUnLock,
                'has-childred': node.children && node.children.length > 0,
            }
            __lv_result['icon-' + node.icon] = true;
            return __lv_result;
        }).apply(null, args);
  }

export function getSmartFolderClass(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (smartFolder) {
            
            var __lv_result = {
                'editable': smartFolder.editable,
                'selected': smartFolder.isSelected,
                'collapsed': !smartFolder.isExpand && !s.folderKeyword.length,
                'active active-item': (s.$root.selectedSmartFolders.length === 0 && s.currentId == 'smart-folder-' + smartFolder.id) || s.$root.selectedSmartFoldersMappings[smartFolder.id],
                'color-red': smartFolder.iconColor == 'red',
                'color-orange': smartFolder.iconColor == 'orange',
                'color-yellow': smartFolder.iconColor == 'yellow',
                'color-green': smartFolder.iconColor == 'green',
                'color-aqua': smartFolder.iconColor == 'aqua',
                'color-blue': smartFolder.iconColor == 'blue',
                'color-purple': smartFolder.iconColor == 'purple',
                'color-pink': smartFolder.iconColor == 'pink',
                'has-childred': smartFolder.children && smartFolder.children.length > 0,
                'empty-node': !smartFolder.children || smartFolder.children.length == 0,
                'first': smartFolder.styles && smartFolder.styles.first,
                'last': smartFolder.styles && smartFolder.styles.last,
            };
            __lv_result['icon-' + smartFolder.icon] = true;
			let parent = s.smartFolderMappings[smartFolder.parent];
			if (parent) {
				__lv_result[`parent-color-${parent?.iconColor}`] = true;
			}
            return __lv_result;
        }).apply(null, args);
  }

export function hoverHideSidebar(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function ($event) {
            $event && $event.stopPropagation();
            if (hasClass(q("#sidebar"), "hover-show")) {
                removeClass("#sidebar", "hover-show");
                setTimeout(() => {
                    removeClass("#sidebar", "slide-in");
                }, 300);
            }
        }).apply(null, args);
  }

export function hoverShowSidebar(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function ($event) {
            $event && $event.stopPropagation();
            if (s.isHideSidebar) {
                if (!hasClass(q("#sidebar"), "hover-show")) {
                    addClass("#sidebar", "slide-in");
                    addClass("#sidebar", "hover-show");
                }
            }
        }).apply(null, args);
  }

export function sidebarFocus(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function($event) {
            $event && $event.stopPropagation();
            s.$root.currentFocus = "sidebar";
        }).apply(null, args);
  }

export function onSidebarResize(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function(e, ui) {
        if (ui && ui.size.width >= 200) {
            s.containerSize.sidebar = ui.size.width;
            syncBodyFromScope();
            syncSidebarFromScope();
            syncTagManagerFromScope();
            rebindRefreshcontainsizeChannel.emit();
            machineryUpdateSliderPosition(s);
            clearTimeout(__lv_onSidebarResizeTimeout);
            __lv_onSidebarResizeTimeout = setTimeout(function () {
                machineryRelayout(s);
                getOffsetScrollbarFn(s)(30);
                localStorage.setItem("eagle.containerSize.sidebar", ui.size.width);
            }, 500);
        }
    }).apply(null, args);
  }

export function toggleSelectFolder(...args: any[]) {
    const s2 = getScope();
    if (!s2) return;
    return (function (event, folderArg) {
      var expand = !folderArg.isExpand;
      var folders = folderArg.children;
      folderArg.isExpand = expand;
      toggleCurrentLevelFolders(folders, expand);
    }).apply(null, args);
  }

export function toggleCurrentLevelFolders(...args: any[]) {
    const s2 = getScope();
    if (!s2) return;
    return (function (event, folderArg) {
      var expand = !folderArg.isExpand;
      var parent = s2.folderMappings[folderArg.parent];
      var folders = s2.folders;
      if (parent && parent.children) {
        folders = parent.children;
      }
      toggleCurrentLevelFolders(folders, expand);
    }).apply(null, args);
  }

export function toggleAllFolderExpand(...args: any[]) {
    const s2 = getScope();
    if (!s2) return;
    return (function (event, folderArg) {
      var folder = folderArg || s2.currentFolder;
      if (s2.folders && s2.folders.length > 0) {
        var expand = !s2.folders[0].isExpand;
        if (folder) {
          setTimeout(function () { machineryChangeSidebarIndex(s2, folder); scopeEvalAsync(); }, 100);
          if (folder.parent) {
            var parent = s2.folderMappings[folder.parent];
            if (parent) {
              expand = !parent.isExpand;
            }
          }
        }
        if (!expand) s2.sidebarIndex = 0;
        toggleAllFolders(s2.folders, expand);
        machineryUpdateSidebarList(s2);
      }
    }).apply(null, args);
  }

export function toggleSelectSmartFolder(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版等价，统一转发消除重复实现。
  const s = getBodyScope();
  if (!s) return;   // 原 c3 体的 scope 守卫，逐字保留
  machineryToggleSelectSmartFolder(s, args[0], args[1]);
}

export function toggleAllSmartFolderExpand(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 收敛到 machinery（c3 体调了未定义的 toggleAllSmartFolders）。
  const s = getBodyScope();
  if (!s) return;   // 原 c3 体的 scope 守卫，逐字保留
  machineryToggleAllSmartFolderExpand(s, args[0], args[1]);
}

export function openFolderExpandContextMenu(...args: any[]) {
    const s2 = getScope();
    if (!s2) return;
    return (function (eventArg, folderArg) {
      eventArg.stopPropagation();
      const folderEl = eventArg && eventArg.currentTarget;
      contextMenuOpenChannel.emit({
        items: [
          {
            label: i18n.__('Context.Expand.Folder'),
            icon: 'ic-expand.svg',
            click: () => {
              toggleSelectFolder(eventArg, folderArg);
              scopeEvalAsync();
            }
          },
          {
            label: i18n.__('Context.Expand.SameLevel.Folders'),
            icon: 'ic-expand-same.svg',
            click: () => {
              toggleCurrentLevelFolders(eventArg, folderArg);
              scopeEvalAsync();
            }
          },
          {
            label: i18n.__('Context.Expand.All.Folders'),
            icon: 'ic-expand-all.svg',
            click: () => {
              toggleAllFolderExpand(eventArg, folderArg);
              scopeEvalAsync();
            }
          },
        ],
        showSearch: false,
        onOpened: () => {
          folderArg.isSelected = true;
          try { folderEl && folderEl.classList && folderEl.classList.add('context-activate'); } catch (err) { /* 委托元素缺席不阻塞 */ }
          scopeEvalAsync();
        },
        onClosed: () => {
          folderArg.isSelected = false;
          try { folderEl && folderEl.classList && folderEl.classList.remove('context-activate'); } catch (err2) { /* 同上 */ }
          scopeEvalAsync();
        }
      });
    }).apply(null, args);
  }
