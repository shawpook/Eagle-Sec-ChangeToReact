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
for (const fieldName of MIGRATED) {
  migrateScopeFieldToStore(
    fieldName as string,
    () => useLayoutState.getState()[fieldName],
    (value: any) => {
      if (useLayoutState.getState()[fieldName] !== value) {
        useLayoutState.setState({ [fieldName]: value } as Partial<LayoutState>);
      }
    },
  );
}

let bound = false;

export function bindLayoutSync(): void {
  if (bound) return;
  bound = true;
  (window as any).__eagleLayoutState = useLayoutState;
}
