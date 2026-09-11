import { applyDataMachineryScope } from './machineryInfra';
// b1-9bz-C-0：跨窗口 / 驱动脚本所需的 scope 面供给，改用**延迟注册**而非静态 import。
//
// 背景：b1-9bz-B-8 退役 fns 表后，子窗口（viewers/font、viewers/text-editor）经
// `parent.$bodyScope.X()` 驱动父窗、主 UI 驱动脚本（electron/main.cjs）经 `scope.X()`
// 驱动，这两处跨边界调用无法直 import，必须由 scope 面供给。B8 当时在
// `applyDataMachineryScope` 里直接静态 import 这些 service —— 但 dataMachinery 是全树
// 依赖汇点，新增 import 边会改变 ESM 求值顺序（service 模块体在 dataMachinery 完成前
// 执行，其顶层读到的 dataMachinery 导出为 undefined），导致启动加载链断裂：
// allData 不填充、listDone 不置位。
//
// 解法：dataMachinery 只依赖本模块（零依赖、无副作用），真正的函数由入口在启动后
// 注册进来。挂载点改为运行期查表，语义不变，依赖图保持 B8 前的形状。

type AnyFn = (...args: any[]) => any;

const supply: Record<string, AnyFn> = {};

/** 由入口（main.tsx → externalSupplyRegistrar）在启动后调用一次。 */
export function registerExternalSupply(map: Record<string, AnyFn>): void {
  for (const k of Object.keys(map)) {
    if (typeof map[k] === 'function') supply[k] = map[k];
  }
}

/** 挂载点使用：未注册时返回 undefined（与 B8 前「表无此项」的行为一致）。 */
export function callExternal(name: string, ...args: any[]): any {
  const fn = supply[name];
  return typeof fn === 'function' ? fn(...args) : undefined;
}

export function hasExternalSupply(name: string): boolean {
  return typeof supply[name] === 'function';
}

// 诊断面：与 window.__eaglePorts 同类的观测出口，便于冒烟直接确认注册是否完成。
if (typeof window !== 'undefined') {
  (window as any).__eagleExternalSupply = supply;
}
