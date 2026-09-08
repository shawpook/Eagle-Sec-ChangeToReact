import { getBodyScope } from '../core/appCore';
/**
 * b1-9bb：选中集服务 —— updateSelection 热点收编。
 *
 * 实现体仍在 machinery（dataMachinery.machineryUpdateSelection，30ms 防抖派生
 * inspector 面板全部字段后广播 UPDATE_INSPECTOR）；本模块是**组件侧唯一入口**
 * （此前 3 处直呼 scope 属性）。注意同名不同义：components/inspector/inspectorActions.ts
 * 的本地 updateSelection 是 React 镜像版（不走 scope），互不相干。S7 inspector 竖切
 * 把实现体迁入本模块并退役 scope 挂载。
 */

export function updateSelection(): void {
  const s = getBodyScope();
  if (s && typeof s.updateSelection === 'function') s.updateSelection();
}
