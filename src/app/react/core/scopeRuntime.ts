/**
 * b1-9bz-E1a：scope digest/flush 运行时（自 `global/scopeShim.ts` 迁出的中立模块）。
 *
 * `scopeEvalAsync` 是 b1-9bz-C-3 暴露的「脱 scope 面 flush 入口」：执行 fn（若有）后
 * flush watcher。当前全树已无 `$watch`/`$watchCollection` 注册，`flushScopeWatchers`
 * 因此恒为 no-op；E1c/E3 逐批把调用点收敛为直调后本模块退役。
 */
let bodyFlushWatchers: (() => void) | null = null;

/** 由 scopeShim 创建 watcher 数组时注入（E4 删 shim 后此注入消失）。 */
export function setBodyFlushWatchers(fn: (() => void) | null): void {
  bodyFlushWatchers = fn;
}

export function flushScopeWatchers(): void {
  if (bodyFlushWatchers) bodyFlushWatchers();
}

export function scopeEvalAsync(fn?: any): void {
  try {
    if (typeof fn === 'function') fn();
  } catch (err) {
    console.error('[scopeRuntime] scopeEvalAsync fn failed', err);
  }
  flushScopeWatchers();
}

/** 是否有 watcher 在用（诊断：watcher 归零后 flush 即 no-op）。 */
export function hasScopeWatchers(): boolean {
  return bodyFlushWatchers !== null;
}
