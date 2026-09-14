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
  selected: any;
  current: any;
  lastSelectedIndex: any;
}

export const useSelectionState = create<SelectionState>(() => ({
  selected: [],
  current: null,
  lastSelectedIndex: -1,
}));

const MIGRATED: ReadonlyArray<keyof SelectionState> = ['selected', 'current', 'lastSelectedIndex'];

/** 单一守卫实现：注册表与 R4 的具体写点共用同一 writer（不得各留一套）。 */
const writers: Record<string, (value: any) => void> = {};
for (const fieldName of MIGRATED) {
  const key = fieldName as string;
  writers[key] = (value: any) => {
    if (useSelectionState.getState()[fieldName] !== value) {
      useSelectionState.setState({ [fieldName]: value } as Partial<SelectionState>);
    }
  };
  migrateScopeFieldToStore(key, () => useSelectionState.getState()[fieldName], writers[key]);
}

/**
 * R4 选区域写点（取代字符串键 `writeScopeField('selected'|'current'|'lastSelectedIndex', v)`）。
 *
 * 语义等价：与注册表同一个 writer（同值守卫），且同样只走 store——不再是通用对象回退。
 * 字符串键的拼写错误从此是编译错误，而不是静默落到 scope 面 plain 槽。
 */
export function writeSelected(value: any): void {
  writers.selected(value);
}

export function writeCurrent(value: any): void {
  writers.current(value);
}

export function writeLastSelectedIndex(value: any): void {
  writers.lastSelectedIndex(value);
}

let bound = false;

export function bindSelectionSync(): void {
  if (bound) return;
  bound = true;
  // 供闭环测试（CDP Runtime.evaluate）直接访问 React 全局状态，不参与业务逻辑。
  (window as any).__eagleSelectionState = useSelectionState;
}
