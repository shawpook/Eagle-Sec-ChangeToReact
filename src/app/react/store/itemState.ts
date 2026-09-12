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
  raw: any[];
  allData: any[];
  images: any[];
  all: any[];
  shuffle: any[];
  trash: any[];
  itemMappings: Record<string, any>;
  folderMappings: Record<string, any>;
  smartFolderMappings: Record<string, any>;
  selectedMappings: Record<string, boolean>;
  selectedFolderMappings: Record<string, boolean>;
  modifiedMappings: Record<string, any>;
  duplicateMappings: Record<string, any>;
  lockedImages: Record<string, any>;
  lastItemStates: Record<string, any>;
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
for (const fieldName of MIGRATED) {
  migrateScopeFieldToStore(
    fieldName as string,
    () => useItemState.getState()[fieldName],
    (value: any) => {
      if (useItemState.getState()[fieldName] !== value) {
        useItemState.setState({ [fieldName]: value } as Partial<ItemState>);
      }
    },
  );
}

let bound = false;

export function bindItemSync(): void {
  if (bound) return;
  bound = true;
  (window as any).__eagleItemState = useItemState;
}
