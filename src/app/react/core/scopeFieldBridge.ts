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
 * 过去 `scope.X = v` 经 shim Proxy 落到「注册 writer + coreState 诊断镜像」。E3 把注册字段的
 * `scope.X = v` 改写为 `writeScopeField('X', v)`，写语义交给 store 的**带同值守卫** writer
 * （b1-9az 教训：无守卫会重渲染整写型 DOM 绑定组件）。
 *
 * **不再镜像 coreState**：注册字段的读取（含 shim Proxy get）一律走 store，coreState 仅是
 * `__eagleCoreState` 诊断面；测试对诊断面的写入/读取仍经 `$bodyScope` Proxy（该路径镜像保留）。
 * 这样 coreState 计数不因本批上升，且与 E4「删除 coreState」方向一致。
 */
export function writeScopeField(name: string, value: any): void {
  const migrated = migratedFields.get(name);
  if (migrated) {
    migrated.write(value);
    return;
  }
  // codemod 只对已注册字段生成本调用；未注册字段不应走到这里（显式告警而非静默丢弃）。
  console.warn('[scopeFieldBridge] writeScopeField on unregistered field:', name);
}
