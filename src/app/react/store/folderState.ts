import { create } from 'zustand';
import { migrateScopeFieldToStore } from '../core/scopeFieldBridge';

/**
 * b1-9bz-E2-2：文件夹/库视图真身 store（注册式双写）。
 *
 * 覆盖 `currentFolder`(68) / `currentSmartFolder`(46) / `folders`(47) / `smartFolders`(8) /
 * `folderList`(9) / `tags`(5) / `currentFolderChildren`(3) 与导航历史
 * `navigationHistory` / `navigationHistoryIndex` / `startCursor`(19)。
 *
 * 默认值口径：对象字段用 `null`（保留代码里 `if (!s.currentFolder)` / `!s.preferences` 之类
 * 的「未就绪」判据语义——若用 `{}` 会误真）；数组用 `[]`。机制/同值守卫见 `selectionState.ts`。
 */
interface FolderState {
  currentFolder: any;
  currentSmartFolder: any;
  folders: any;
  smartFolders: any;
  folderList: any;
  tags: any;
  currentFolderChildren: any;
  navigationHistory: any;
  navigationHistoryIndex: any;
  startCursor: any;
}

export const useFolderState = create<FolderState>(() => ({
  currentFolder: null,
  currentSmartFolder: null,
  folders: [],
  smartFolders: [],
  folderList: [],
  tags: [],
  currentFolderChildren: [],
  navigationHistory: [],
  navigationHistoryIndex: -1,
  startCursor: 0,
}));

const MIGRATED: ReadonlyArray<keyof FolderState> = [
  'currentFolder', 'currentSmartFolder', 'folders', 'smartFolders', 'folderList', 'tags',
  'currentFolderChildren', 'navigationHistory', 'navigationHistoryIndex', 'startCursor',
];
/** 单一守卫实现：注册表与 R4 的具体写点共用同一 writer（不得各留一套）。 */
const writers: Record<string, (value: any) => void> = {};
for (const fieldName of MIGRATED) {
  const key = fieldName as string;
  writers[key] = (value: any) => {
    if (useFolderState.getState()[fieldName] !== value) {
      useFolderState.setState({ [fieldName]: value } as Partial<FolderState>);
    }
  };
  migrateScopeFieldToStore(key, () => useFolderState.getState()[fieldName], writers[key]);
}

/**
 * R4 文件夹/导航域写点（取代字符串键 `writeScopeField('<字段>', v)`）。
 * 与注册表同一 writer（同值守卫一致），不再走通用对象回退。
 */
export function writeCurrentFolder(value: any): void {
  writers.currentFolder(value);
}

export function writeCurrentSmartFolder(value: any): void {
  writers.currentSmartFolder(value);
}

export function writeStartCursor(value: any): void {
  writers.startCursor(value);
}

let bound = false;

export function bindFolderSync(): void {
  if (bound) return;
  bound = true;
  (window as any).__eagleFolderState = useFolderState;
}
