import { create } from 'zustand';
import { migrateScopeFieldToStore } from '../core/scopeFieldBridge';

/**
 * b1-9bz-E2-1：选区真身 store（注册式双写第一批，对应 E1 字段映射表头部字段）。
 *
 * 机制（与 b1-9az R1 同款）：`migrateScopeFieldToStore(name, read, write)` 让 body scope 的
 * get/set 委托本 store——`scope.selected` 读 store、`scope.selected = [...]` 写 store（同时
 * 镜像 coreState 供 `__eagleCoreState` 诊断面）。**同值守卫**必不可少（b1-9az 教训：无守卫会
 * 让整写型 DOM 绑定组件被无谓重渲染）。
 *
 * 过渡语义：读写两侧调用点暂不改写（E3 逐域改）；本批只把「真身」从 coreState 换到 store。
 */
interface SelectionState {
  selected: any[];
  current: any;
  lastSelectedIndex: number;
}

export const useSelectionState = create<SelectionState>(() => ({
  selected: [],
  current: null,
  lastSelectedIndex: -1,
}));

const MIGRATED: ReadonlyArray<keyof SelectionState> = ['selected', 'current', 'lastSelectedIndex'];
for (const fieldName of MIGRATED) {
  migrateScopeFieldToStore(
    fieldName as string,
    () => useSelectionState.getState()[fieldName],
    (value: any) => {
      if (useSelectionState.getState()[fieldName] !== value) {
        useSelectionState.setState({ [fieldName]: value } as Partial<SelectionState>);
      }
    },
  );
}

let bound = false;

export function bindSelectionSync(): void {
  if (bound) return;
  bound = true;
  // 供闭环测试（CDP Runtime.evaluate）直接访问 React 全局状态，不参与业务逻辑。
  (window as any).__eagleSelectionState = useSelectionState;
}
