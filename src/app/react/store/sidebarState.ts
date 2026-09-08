import { create } from 'zustand';
import { classObjectToString, getBodyScope } from '../global/scopeBridge';
import { useBodyState } from './bodyState';
import { useListState } from './listState';

/**
 * 阶段2：侧栏状态 —— 快照自 EagleController scope（规范 app.bundle.js:20197+）。
 * 渲染字段全部来自快照；事件通过 scopeBridge 调回同名 scope 函数。
 */

export interface SidebarNodeSnapshot {
  id: string;
  vstype: string;
  type?: string;
  name?: string;
  index: number;
  size: number;
  depth?: number;
  parent?: string;
  icon?: string;
  iconColor?: string;
  password?: boolean;
  isUnLock?: boolean;
  isExpand?: boolean;
  editable?: boolean;
  isSelected?: boolean;
  imageCount?: number;
  descendantImageCount?: number;
  guidelines?: string[];
  styles?: { depth?: number; first?: boolean; last?: boolean };
  children?: any[];
  /** React 侧预解析的展示数据（folder/smartFolder/quickAccess 映射解析结果）。 */
  cls: string;
  resolvedName?: string;
  resolvedCount?: number;
  resolvedTitle?: string;
  [key: string]: any;
}

export interface SidebarSnapshot {
  ready: boolean;
  nodes: SidebarNodeSnapshot[];
  viewMode: string;
  currentId: string;
  folderKeyword: string;
  isCleaningTrash: boolean;
  isUILoaded: boolean;
  isLoading: boolean;
  isExpandFolder: boolean;
  isExpandSmartFolder: boolean;
  isExpandQuickAccess: boolean;
  sidebarWidth: number;
  libraryPath: string;
  libraryName: string;
  showSlowNotify: boolean;
  showNTFSWarning: boolean;
  paletteQueuePaused: boolean;
  currentProcessCount: number;
  sidebarIndex: number;
  theme: string;
  counts: {
    all: number;
    unfiled: number;
    untagged: number;
    tags: number;
    trash: number;
    quickAccess: number;
    smartFolders: number;
    folders: number;
  };
  keybinds: Record<string, string>;
}

const EMPTY: SidebarSnapshot = {
  ready: false,
  nodes: [],
  viewMode: 'all',
  currentId: '',
  folderKeyword: '',
  isCleaningTrash: false,
  isUILoaded: false,
  isLoading: true,
  isExpandFolder: true,
  isExpandSmartFolder: true,
  isExpandQuickAccess: true,
  sidebarWidth: 220,
  libraryPath: '',
  libraryName: '',
  showSlowNotify: false,
  showNTFSWarning: false,
  paletteQueuePaused: false,
  currentProcessCount: 0,
  sidebarIndex: -1,
  theme: 'gray',
  counts: { all: 0, unfiled: 0, untagged: 0, tags: 0, trash: 0, quickAccess: 0, smartFolders: 0, folders: 0 },
  keybinds: {},
};

export const useSidebarState = create<{ snapshot: SidebarSnapshot }>(() => ({ snapshot: EMPTY }));

export const setSidebarSnapshot = (snapshot: SidebarSnapshot) =>
  useSidebarState.setState({ snapshot });

/** 接入 Angular scope → React 快照同步（AppRoot 挂载时调用一次）。 */
// b1-9by-B：快照深比较守卫（scopeBridge startScopeSync 同款语义）。
function shallowEqSidebar(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k] === b[k]);
}

let lastSidebarSnapshot: any = null;

/**
 * b1-9by-B：sidebar 快照直写收敛——变异流汇聚点 updateSidebarList（machinery 重建体尾，
 * 76 调用方）+ sidebarService 点击/展开四包装 + 顶层标量/数组写点直调；viewMode/isLoading/
 * theme/unfiledCount/untaggedCount 等委托字段经 useBodyState/useListState 订阅触发
 * re-sync。原 startScopeSync 200ms 轮询退役。
 */
export function syncSidebarFromScope(): void {
  const scope: any = getBodyScope();
  if (!scope) return;
  const next = buildSnapshot(scope);
  if (lastSidebarSnapshot !== null && shallowEqSidebar(next, lastSidebarSnapshot)) return;
  lastSidebarSnapshot = next;
  setSidebarSnapshot(next);
}

export function bindSidebarSync(): void {
  // 供闭环测试直写 scope 后手动驱动（原 $evalAsync 触发快照链的等价物）。
  (window as any).__eagleSidebarSync = syncSidebarFromScope;
  // 委托字段（bodyState/listState 源翻转）变化 → re-sync。
  useBodyState.subscribe(() => syncSidebarFromScope());
  useListState.subscribe(() => syncSidebarFromScope());
  // 启动期一次性对齐。
  syncSidebarFromScope();
}

const themePath = (theme: string) => (theme === 'light' || theme === 'lightgray' ? 'light' : 'dark');

function buildSnapshot(scope: any): SidebarSnapshot {
  const list = Array.isArray(scope.sidebarList) ? scope.sidebarList : [];
  const folderMappings = scope.folderMappings || {};
  const smartFolderMappings = scope.smartFolderMappings || {};
  const nodes: SidebarNodeSnapshot[] = list.map((raw: any) => {
    const node: SidebarNodeSnapshot = {
      id: raw.id,
      vstype: raw.vstype,
      type: raw.type,
      name: raw.name,
      index: raw.index,
      size: raw.size,
      parent: raw.parent,
      icon: raw.icon,
      iconColor: raw.iconColor,
      password: raw.password,
      isUnLock: raw.isUnLock,
      isExpand: raw.isExpand,
      editable: raw.editable,
      isSelected: raw.isSelected,
      imageCount: raw.imageCount,
      descendantImageCount: raw.descendantImageCount,
      guidelines: raw.guidelines,
      styles: raw.styles,
      children: raw.children,
      newFolderName: raw.newFolderName,
      cls: '',
    };
    // 类名走 scope 原函数，保证与旧版逐字一致（bundle:38244/38271/38307）。
    try {
      if (raw.vstype === 'folder') node.cls = classObjectToString(scope.getNodeClass(raw));
      else if (raw.vstype === 'smartFolder') node.cls = classObjectToString(scope.getSmartFolderClass(raw));
      else if (raw.vstype === 'quickAccess' && raw.type === 'folder')
        node.cls = classObjectToString(scope.getQuickAccessClass(raw) || {});
      else if (raw.vstype === 'quickAccess' && raw.type === 'smartFolder')
        node.cls = classObjectToString(scope.getQuickAccessClass(raw) || {});
    } catch (err) {
      node.cls = '';
    }
    // quickAccess 展示字段来自映射（模板读 folderMappings[node.id].name 等）。
    if (raw.vstype === 'quickAccess') {
      const mapped = raw.type === 'folder' ? folderMappings[raw.id] : smartFolderMappings[raw.id];
      node.resolvedName = mapped && mapped.name;
      node.resolvedCount = mapped && mapped.imageCount;
      node.resolvedTitle = mapped && mapped.name;
    }
    return node;
  });

  const prefs = scope.preferences || {};
  const shortcuts = prefs.shortcuts || {};
  return {
    ready: true,
    nodes,
    viewMode: scope.viewMode,
    currentId: scope.currentId,
    folderKeyword: scope.folderKeyword || '',
    isCleaningTrash: !!scope.isCleaningTrash,
    isUILoaded: !!scope.isUILoaded,
    isLoading: !!scope.isLoading,
    isExpandFolder: scope.isExpandFolder !== false,
    isExpandSmartFolder: scope.isExpandSmartFolder !== false,
    isExpandQuickAccess: scope.isExpandQuickAccess !== false,
    sidebarWidth: (scope.containerSize && scope.containerSize.sidebar) || 220,
    libraryPath: scope.libraryPath || '',
    libraryName: scope.libraryName || '',
    showSlowNotify: !!scope.showSlowNotify,
    showNTFSWarning: !!scope.showNTFSWarning,
    paletteQueuePaused: !!scope.paletteQueuePaused,
    currentProcessCount: scope.currentProcessCount || 0,
    sidebarIndex: typeof scope.sidebarIndex === 'number' ? scope.sidebarIndex : -1,
    theme: scope.theme || 'gray',
    counts: {
      all: Array.isArray(scope.all) ? scope.all.length : 0,
      unfiled: scope.unfiledCount || 0,
      untagged: scope.untaggedCount || 0,
      tags: Array.isArray(scope.tags) ? scope.tags.length : 0,
      trash: Array.isArray(scope.trash) ? scope.trash.length : 0,
      quickAccess: Array.isArray(scope.quickAccess) ? scope.quickAccess.length : 0,
      smartFolders: Array.isArray(scope.smartFolderList) ? scope.smartFolderList.length : 0,
      folders: Array.isArray(scope.folderList) ? scope.folderList.length : 0,
    },
    keybinds: shortcuts.keybinds || {},
  };
}

export { themePath };
