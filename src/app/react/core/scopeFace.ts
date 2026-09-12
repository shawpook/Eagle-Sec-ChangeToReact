/**
 * b1-9bz-E4-5：body scope 面（`scopeShim.ts` 的 Proxy-over-coreState 退役后的显式实现）。
 *
 * 与旧 shim 的差别（DoD ①）：
 *  - **无 `coreState` 后端**：注册字段经 `Object.defineProperty` 直连 store（读 `read()`、
 *    写 `write(v)`）；未注册字段落本模块的普通对象 `plain`（等价旧 coreState 的稀疏写穿）。
 *  - **无 Proxy**：字段描述符在建面时按注册表枚举声明；晚注册（面创建后）由 getter/setter
 *    动态查表兜住（`plain` 承接未注册值）。
 *  - 函数面（machinery 挂载、跨窗/驱动供给）不变：`machineryInfra.applyDataMachineryScope`
 *    等直接写本面属性。
 *
 * 保留的最小 Angular 面（测试/驱动契约，E5 随驱动迁移删除）：
 *  `__eagleShim`（shim-only 分支判据）、`$root`/`$parent` 自指、`$eval`、`$evalAsync`、
 *  `$destroy`。诊断出口仍名 `__eagleScopeShim`（冒烟 A6/cz1 契约）。
 */
import { getMigratedScopeField, getMigratedScopeFieldNames } from './scopeFieldBridge';

export function createBodyScopeFace(): any {
  // 单例：已达则直接返回（`__eagleScopeShim.factory()` 冒烟直调与 getBodyScope 共享同一面）。
  const existing = (window as any).$bodyScope;
  if (existing) return existing;
  const plain: Record<string, any> = {};
  const face: any = {
    __eagleShim: true,
    $root: null,
    $parent: null,
    $$phase: undefined,
    $eval(expr: any): any {
      if (typeof expr === 'function') return expr(face);
      return undefined;
    },
    // 测试/驱动用 no-op 提交钩子（E5 随驱动迁移删除；preview-delivery 依赖其存在性）。
    $evalAsync(fn?: any): any {
      if (typeof fn === 'function') {
        try { fn(); } catch (err) { console.error('[scopeFace] $evalAsync fn failed', err); }
      }
      return undefined;
    },
    $destroy(): void { /* noop */ },
  };
  face.$root = face;
  face.$parent = face;

  const define = (name: string): void => {
    Object.defineProperty(face, name, {
      configurable: true,
      enumerable: true,
      get() { const m = getMigratedScopeField(name); return m ? m.read() : plain[name]; },
      set(v: any) {
        const m = getMigratedScopeField(name);
        if (m) m.write(v);
        else plain[name] = v;
      },
    });
  };
  for (const name of getMigratedScopeFieldNames()) {
    if (name in face) continue; // 保留方法面（$eval 等）不被字段描述符覆盖
    define(name);
  }

  (window as any).$bodyScope = face;
  return face;
}

/** 诊断契约（冒烟 A6/cz1 用）：工厂直曝 + 状态。 */
export function exposeScopeFaceDiagnostics(): void {
  (window as any).__eagleScopeShim = {
    factory: createBodyScopeFace,
    active: false,
    migratedFieldNames: getMigratedScopeFieldNames,
  };
}
