import { create } from 'zustand';
import { migrateScopeFieldToStore } from '../core/scopeFieldBridge';

/**
 * b1-9bz-E2-1：条目/映射真身 store（注册式双写第一批）。
 *
 * 覆盖 E1 字段映射表头部：`allData`(63) / `folderMappings`(101) / `raw`(30) / `itemMappings`(31) /
 * `smartFolderMappings`(23) / `trash`(21) / `selectedMappings`(11) / `selectedFolderMappings`(8) /
 * `modifiedMappings`(9) / `lockedImages`(11) / `images` / `all` / `shuffle` / `duplicateMappings` /
 * `lastItemStates`。机制与同值守卫见 `selectionState.ts` 头注。
 *
 * 注意：字段多于 UI 快照所需——`syncXFromScope()` 仍按原路径读 `scope.X`（注册后即读本 store），
 * E3 再逐域把读点改为 `useItemState.getState()`。
 */
interface ItemState {
  raw: any;
  allData: any;
  images: any;
  all: any;
  shuffle: any;
  trash: any;
  itemMappings: any;
  folderMappings: any;
  smartFolderMappings: any;
  selectedMappings: any;
  selectedFolderMappings: any;
  modifiedMappings: any;
  duplicateMappings: any;
  lockedImages: any;
  lastItemStates: any;
}

export const useItemState = create<ItemState>(() => ({
  raw: [],
  allData: [],
  images: [],
  all: [],
  shuffle: [],
  trash: [],
  itemMappings: {},
  folderMappings: {},
  smartFolderMappings: {},
  selectedMappings: {},
  selectedFolderMappings: {},
  modifiedMappings: {},
  duplicateMappings: {},
  lockedImages: {},
  lastItemStates: {},
}));

const MIGRATED: ReadonlyArray<keyof ItemState> = [
  'raw', 'allData', 'images', 'all', 'shuffle', 'trash',
  'itemMappings', 'folderMappings', 'smartFolderMappings',
  'selectedMappings', 'selectedFolderMappings', 'modifiedMappings',
  'duplicateMappings', 'lockedImages', 'lastItemStates',
];
/** 单一守卫实现：注册表与 R4 的具体写点共用同一 writer（不得各留一套）。 */
const writers: Record<string, (value: any) => void> = {};
for (const fieldName of MIGRATED) {
  const key = fieldName as string;
  writers[key] = (value: any) => {
    if (useItemState.getState()[fieldName] !== value) {
      useItemState.setState({ [fieldName]: value } as Partial<ItemState>);
    }
  };
  migrateScopeFieldToStore(key, () => useItemState.getState()[fieldName], writers[key]);
}

/** R4 条目域写点（取代字符串键 writeScopeField('<字段>', v)）。与注册表同一 writer。 */
export function writeRaw(value: any): void { writers.raw(value); }
export function writeShuffle(value: any): void { writers.shuffle(value); }
export function writeTrash(value: any): void { writers.trash(value); }
export function writeSelectedMappings(value: any): void { writers.selectedMappings(value); }
export function writeSelectedFolderMappings(value: any): void { writers.selectedFolderMappings(value); }

let bound = false;

export function bindItemSync(): void {
  if (bound) return;
  bound = true;
  (window as any).__eagleItemState = useItemState;
}

// R4 写点：
/** R4 itemState 域长尾写点（取代字符串键 writeScopeField('<字段>', v)）。与注册表同一 writer。 */
export function writeLastItemStates(value: any): void { writers.lastItemStates(value); }
export function writeImages(value: any): void { writers.images(value); }
export function writeAllData(value: any): void { writers.allData(value); }
export function writeAll(value: any): void { writers.all(value); }
export function writeFolderMappings(value: any): void { writers.folderMappings(value); }
export function writeLockedImages(value: any): void { writers.lockedImages(value); }
export function writeDuplicateMappings(value: any): void { writers.duplicateMappings(value); }
export function writeItemMappings(value: any): void { writers.itemMappings(value); }
export function writeSmartFolderMappings(value: any): void { writers.smartFolderMappings(value); }
export function writeModifiedMappings(value: any): void { writers.modifiedMappings(value); }
