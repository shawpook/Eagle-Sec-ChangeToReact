import { create } from 'zustand';
import { startScopeSync } from '../global/scopeBridge';

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

export function bindPanelSync(): () => void {
  return startScopeSync({
    watch: [
      'theme',
      'platform',
      'layout',
      'layoutOptions',
      'showOriginalImageWhenLarge',
      'currentOrderBy',
      'currentSortIncrease',
      'showName',
      'showMetas',
      'listMetaType',
      'showFileExtension',
      'showFileExtensionLabel',
      'showAnnotation',
      'showSubfolderContent',
      'isHideSidebar',
      'inspector.isHideInspector',
      'currentFolder',
      'currentSmartFolder',
    ],
    build: (scope) => {
      const preferences = scope.preferences || (window as any).preferences || {};
      const pjson = (window as any).__eaglePjson || null;
      return {
        ready: true,
        theme: scope.theme || 'gray',
        platform: scope.platform || 'win32',
        language: preferences?.general?.language || 'en',
        appVersion: scope.appVersion || pjson?.version || '',
        buildVersion: scope.buildVersion || pjson?.buildVersion || '',
        buildNumber: scope.buildNumber ?? pjson?.buildNumber ?? 0,
        layout: scope.layout || 'JustifiedLayout',
        layoutOptions: scope.layoutOptions || 'Fit',
        showOriginalImageWhenLarge: !!scope.showOriginalImageWhenLarge,
        currentOrderBy: scope.currentOrderBy || 'IMPORT',
        currentSortIncrease: scope.currentSortIncrease !== false,
        showName: !!scope.showName,
        showMetas: !!scope.showMetas,
        listMetaType: scope.listMetaType || 'RESOLUTION',
        showFileExtension: !!scope.showFileExtension,
        showFileExtensionLabel: !!scope.showFileExtensionLabel,
        showAnnotation: !!scope.showAnnotation,
        showSubfolderContent: !!scope.showSubfolderContent,
        isHideSidebar: !!scope.isHideSidebar,
        inspectorHide: !!(scope.inspector && scope.inspector.isHideInspector),
        currentFolder: scope.currentFolder ? { id: scope.currentFolder.id, orderBy: scope.currentFolder.orderBy } : null,
        currentSmartFolder: scope.currentSmartFolder ? { id: scope.currentSmartFolder.id, orderBy: scope.currentSmartFolder.orderBy } : null,
      } as PanelSnapshot;
    },
    apply: (snapshot) => setSnapshot(snapshot as PanelSnapshot),
  });
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
