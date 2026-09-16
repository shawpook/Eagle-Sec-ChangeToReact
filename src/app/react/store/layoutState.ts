import { create } from 'zustand';
import { migrateScopeFieldToStore } from '../core/scopeFieldBridge';

/**
 * b1-9bz-E2-2：布局尺寸真身 store（注册式双写）。
 *
 * `imageSize`(60，对象：height/zoomRatio/zoomRatioExp…) / `containerSize`（对象：sidebar/tagSidebar…）。
 * 二者都由 machinery 整体赋值（`machineryInfra.ts:1018 s.imageSize = {...}`、
 * `:579 s.containerSize = {...}`），未发现赋值前的原地字段写，故默认 `{}` 安全且优于 `null`
 * （读 `.height` 返回 undefined 而非抛错）。
 */
interface LayoutState {
  imageSize: any;
  containerSize: any;
}

export const useLayoutState = create<LayoutState>(() => ({
  imageSize: {},
  containerSize: {},
}));

const MIGRATED: ReadonlyArray<keyof LayoutState> = ['imageSize', 'containerSize'];
/** 单一守卫实现：注册表与 R4 的具体写点共用同一 writer（不得各留一套）。 */
const writers: Record<string, (value: any) => void> = {};
for (const fieldName of MIGRATED) {
  const key = fieldName as string;
  writers[key] = (value: any) => {
    if (useLayoutState.getState()[fieldName] !== value) {
      useLayoutState.setState({ [fieldName]: value } as Partial<LayoutState>);
    }
  };
  migrateScopeFieldToStore(key, () => useLayoutState.getState()[fieldName], writers[key]);
}

let bound = false;

export function unbindLayoutSync(): void {
  if (!bound) return;
  bound = false;
}

export function bindLayoutSync(): void {
  if (bound) return;
  bound = true;
  (window as any).__eagleLayoutState = useLayoutState;
}

// R4 写点：
/** R4 写点（取代字符串键 writeScopeField('<字段>', v)）。与注册表同一 writer。 */
export function writeContainerSize(value: any): void { writers.containerSize(value); }
export function writeImageSize(value: any): void { writers.imageSize(value); }
