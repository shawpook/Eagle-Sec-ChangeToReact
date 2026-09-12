/**
 * b1-9bz-E1a：scope 字段 → store 注册表（自 `global/scopeShim.ts` 迁出的中立模块）。
 *
 * 登记某字段后，body scope 的 get/set 委托到对应 store：读走 `read()`，写走 `write(v)`
 * （由注册方提供**同值守卫**——b1-9az 教训：无守卫会让整写型 DOM 绑定组件被无谓重渲染）。
 *
 * 生命周期：E2 起大批字段注册本表（store 成为真身）；E3 逐域改写读点；E4 删 `scopeShim`
 * 与写点直调后，本模块随之退役。
 */
const migratedFields = new Map<string, { read: () => any; write: (v: any) => void }>();

export function migrateScopeFieldToStore(name: string, read: () => any, write: (v: any) => void): void {
  migratedFields.set(name, { read, write });
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
export function writeScopeField(name: string, value: any): void {
  const w = window as any;
  const scope = w.$bodyScope;
  if (scope && scope.__eagleShim) {
    scope[name] = value;
    return;
  }
  const migrated = migratedFields.get(name);
  if (migrated) {
    migrated.write(value);
    return;
  }
  console.warn('[scopeFieldBridge] writeScopeField on unregistered field (no shim):', name);
}
