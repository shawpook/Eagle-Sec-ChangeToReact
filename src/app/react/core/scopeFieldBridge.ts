/**
 * b1-9bz-E1a：scope 字段 → store 注册表（自 `global/scopeShim.ts` 迁出的中立模块）。
 *
 * 登记某字段后，body scope 的 get/set 委托到对应 store：读走 `read()`，写走 `write(v)`
 * （由注册方提供**同值守卫**——b1-9az 教训：无守卫会让整写型 DOM 绑定组件被无谓重渲染）。
 *
 * 生命周期：E2 起大批字段注册本表（store 成为真身）；E3 逐域改写读点；E4 删 `scopeShim`
 * 与写点直调后，本模块随之退役。
 */
import { getWindowScope } from './scopeFace';

const migratedFields = new Map<string, { read: () => any; write: (v: any) => void }>();

/**
 * F11：**面创建之后**才注册的字段通知口（单槽——面是单例，只有一个订阅方）。
 *
 * 为什么需要它：`scopeFace` 无 Proxy，字段描述符只在建面那一刻按注册表枚举声明；面已建时
 * 再注册，该名字在面上**没有描述符**，于是直读恒 `undefined`、直写落 `plain` 自有属性
 * （不落 store）——注册表说它归 store、面说它归 plain，两边永久分歧且静默无报错。
 *
 * 钩子由 `createBodyScopeFace()` 在建面时注入（那一刻两侧模块必已求值完毕，故不存在
 * 循环 import 的 TDZ 风险）；未注入时（面尚未创建，或测试桩接本模块）注册行为与从前
 * 逐字一致——面未建，建面时的枚举自然覆盖得到。
 */
let lateRegistrationHook: ((name: string) => void) | null = null;

export function installScopeFieldLateRegistrationHook(hook: (name: string) => void): void {
  lateRegistrationHook = hook;
}

export function migrateScopeFieldToStore(name: string, read: () => any, write: (v: any) => void): void {
  migratedFields.set(name, { read, write });
  if (lateRegistrationHook) lateRegistrationHook(name);
}

/** 诊断/测试契约：已源翻转字段清单。 */
export function getMigratedScopeFieldNames(): string[] {
  return Array.from(migratedFields.keys());
}

/** 注册表查询（供 scopeShim 的 proxy get/set 使用）。 */
export function getMigratedScopeField(name: string): { read: () => any; write: (v: any) => void } | undefined {
  return migratedFields.get(name);
}

/**
 * b1-9bz-E3：写入点直调化的等价入口。
 *
 * 等价于原 `scope.X = v`：**经 shim Proxy 写入**（注册字段走 store 的带同值守卫 writer
 * + coreState 诊断镜像；未注册字段落 coreState）。直接 `migrated.write(value)` 会丢掉
 * coreState 镜像——cz1 等烟雾测试以镜像为契约（`__eagleCoreState`），故仍走 Proxy。
 * Proxy 缺席（bundle 世界 / 子窗口自有 scope）时退化为直接写注册表。
 */
/**
 * b1-9bz-E3 → E5-3：写入点直调化的等价入口。
 *
 * 注册字段走 store 的带同值守卫 writer（**不再经 window.$bodyScope**——主窗别名 E5-4 退役）；
 * 未注册字段落「本窗 scope 面」的 plain 槽（主窗 = scopeFace，子窗 = 本窗 controllerScope）。
 */
export function writeScopeField(name: string, value: any): void {
  const migrated = migratedFields.get(name);
  if (migrated) {
    migrated.write(value);
    return;
  }
  const scope = getWindowScope();
  if (scope) {
    scope[name] = value;
    return;
  }
  console.warn('[scopeFieldBridge] writeScopeField on unregistered field (no scope face):', name);
}
