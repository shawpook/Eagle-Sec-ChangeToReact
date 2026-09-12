import { create } from 'zustand';
import { useBodyState } from './bodyState';
import { useListState } from './listState';
import { getBodyScope } from '../core/appCore';
import { usePreferencesState } from './preferencesState';
import { useMiscRawState } from './miscRawState';
import { useFolderState } from './folderState';

/**
 * 阶段7c-1：小弹窗族（layout-panel / notification / new-version / folder-password /
 * mousewheel-setting / about / welcome）所需 body scope 字段快照。
 * 弹窗开合状态由各组件本地持有（原 isolate scope isOpen），触发通道不变。
 */

export interface PanelSnapshot {
  ready: boolean;
  theme: string;
  platform: string;
  language: string;
  appVersion: string;
  buildVersion: string;
  buildNumber: number;
  // layout-panel
  layout: string;
  layoutOptions: string;
  showOriginalImageWhenLarge: boolean;
  currentOrderBy: string;
  currentSortIncrease: boolean;
  showName: boolean;
  showMetas: boolean;
  listMetaType: string;
  showFileExtension: boolean;
  showFileExtensionLabel: boolean;
  showAnnotation: boolean;
  showSubfolderContent: boolean;
  isHideSidebar: boolean;
  inspectorHide: boolean;
  currentFolder: { id?: string; orderBy?: string } | null;
  currentSmartFolder: { id?: string; orderBy?: string } | null;
}

const EMPTY: PanelSnapshot = {
  ready: false,
  theme: 'gray',
  platform: 'win32',
  language: 'en',
  appVersion: '',
  buildVersion: '',
  buildNumber: 0,
  layout: 'JustifiedLayout',
  layoutOptions: 'Fit',
  showOriginalImageWhenLarge: false,
  currentOrderBy: 'IMPORT',
  currentSortIncrease: true,
  showName: true,
  showMetas: true,
  listMetaType: 'RESOLUTION',
  showFileExtension: true,
  showFileExtensionLabel: false,
  showAnnotation: false,
  showSubfolderContent: false,
  isHideSidebar: false,
  inspectorHide: false,
  currentFolder: null,
  currentSmartFolder: null,
};

export const usePanelState = create<{ snapshot: PanelSnapshot }>(() => ({ snapshot: EMPTY }));

const setSnapshot = (snapshot: PanelSnapshot) => usePanelState.setState({ snapshot });

// b1-9by-B：快照深比较守卫（scopeBridge startScopeSync 同款语义）。
function shallowEq(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k] === b[k]);
}

let lastSnapshot: any = null;

/** b1-9by-B：原 startScopeSync 内联 build 平移（逐字）。 */
function buildPanelSnapshot(): PanelSnapshot {
  const preferences = usePreferencesState.getState().preferences || (window as any).preferences || {};
  const pjson = (window as any).__eaglePjson || null;
  return {
    ready: true,
    theme: useBodyState.getState().theme || 'gray',
    platform: useBodyState.getState().platform || 'win32',
    language: preferences?.general?.language || 'en',
    appVersion: useMiscRawState.getState().appVersion || pjson?.version || '',
    buildVersion: useMiscRawState.getState().buildVersion || pjson?.buildVersion || '',
    buildNumber: useMiscRawState.getState().buildNumber ?? pjson?.buildNumber ?? 0,
    layout: useBodyState.getState().layout || 'JustifiedLayout',
    layoutOptions: useBodyState.getState().layoutOptions || 'Fit',
    showOriginalImageWhenLarge: !!useMiscRawState.getState().showOriginalImageWhenLarge,
    currentOrderBy: useListState.getState().currentOrderBy || 'IMPORT',
    currentSortIncrease: useListState.getState().currentSortIncrease !== false,
    showName: !!useMiscRawState.getState().showName,
    showMetas: !!useMiscRawState.getState().showMetas,
    listMetaType: useMiscRawState.getState().listMetaType || 'RESOLUTION',
    showFileExtension: !!useMiscRawState.getState().showFileExtension,
    showFileExtensionLabel: !!useMiscRawState.getState().showFileExtensionLabel,
    showAnnotation: !!useMiscRawState.getState().showAnnotation,
    showSubfolderContent: !!useListState.getState().showSubfolderContent,
    isHideSidebar: !!useBodyState.getState().isHideSidebar,
    inspectorHide: !!(useMiscRawState.getState().inspector && useMiscRawState.getState().inspector.isHideInspector),
    currentFolder: useFolderState.getState().currentFolder ? { id: useFolderState.getState().currentFolder.id, orderBy: useFolderState.getState().currentFolder.orderBy } : null,
    currentSmartFolder: useFolderState.getState().currentSmartFolder ? { id: useFolderState.getState().currentSmartFolder.id, orderBy: useFolderState.getState().currentSmartFolder.orderBy } : null,
  } as PanelSnapshot;
}

/**
 * b1-9by-B：panel 快照直写收敛——panel 自有字段（layoutOptions/show* 族/listMetaType）
 * 写入点与 currentFolder/currentSmartFolder 写入点直调；theme/platform/layout/
 * currentOrderBy/currentSortIncrease/isHideSidebar/showSubfolderContent 等委托字段
 * 经 useBodyState/useListState 订阅触发 re-sync（bindPanelSync）。
 * 原 startScopeSync 200ms 轮询退役。
 */
export function syncPanelFromScope(): void {
  const scope: any = getBodyScope();
  if (!scope) return;
  const next = buildPanelSnapshot();
  if (lastSnapshot !== null && shallowEq(next, lastSnapshot)) return;
  lastSnapshot = next;
  setSnapshot(next);
}

export function bindPanelSync(): void {
  // 供闭环测试直写 scope 后手动驱动（原 $evalAsync 触发快照链的等价物）。
  (window as any).__eaglePanelSync = syncPanelFromScope;
  // 委托字段（bodyState/listState 源翻转）变化 → re-sync panel 快照。
  useBodyState.subscribe(() => syncPanelFromScope());
  useListState.subscribe(() => syncPanelFromScope());
  // 启动期一次性对齐。
  syncPanelFromScope();
}

/** package.json 只读一次（bundle 里的 const pjson 闭包内不可达）。 */
export async function loadPjson() {
  if ((window as any).__eaglePjson) return (window as any).__eaglePjson;
  try {
    const appRoot = (window as any).appRoot;
    const req = (window as any).require;
    if (appRoot && req) {
      const pjson = req(appRoot.path + '/package.json');
      (window as any).__eaglePjson = pjson;
      return pjson;
    }
  } catch (err) {}
  return null;
}
