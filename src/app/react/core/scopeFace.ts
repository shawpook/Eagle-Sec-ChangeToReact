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
 * 保留的最小面：`__eagleShim`（shim-only 分支判据）、`$root`/`$parent` 自指、`$eval`、
 *  `$evalAsync`、`$destroy`。诊断出口仍名 `__eagleScopeShim`（冒烟 A6/cz1 契约）。
 *
 * **E5-2 过渡态**：跨边界消费（main.cjs / shims.js / 子窗口 / 52 个冒烟）改走
 * `core/driverApi.ts` 的显式 `window.__eagleDriver` 与 `window.__eagleScopeRegistry`
 * （store 注册表诊断口）已就位；但 src 侧一次性切换会同时打断 52 个测试与跨窗驱动，
 * 故本批**由主窗入口显式安装 `window.$bodyScope = face` 过渡别名**（E5-3 迁测试观测口、
 * E5-4 删除）。别名安装**只在主窗**（`main.tsx` → `installScopeAlias()`）：子窗
 * （preview-window / viewers）以 `window.$bodyScope` 承载**本窗** controllerScope
 * （`preview-window/controller.ts:2425`），共享 `core/*` 模块必须经 `getWindowScope()`
 * 取「本窗 scope」，否则会建出空的 store 面并**覆盖子窗自有 scope**。
 */
import { getMigratedScopeField, getMigratedScopeFieldNames } from './scopeFieldBridge';

export function createBodyScopeFace(): any {
  // 单例：内部面已达则直接返回（`__eagleScopeShim.factory()` 冒烟直调与 getScopeFace 共享同一面）。
  if (internalFace) return internalFace;
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
      // configurable:false：注册字段是 store 的**稳定视图**，不可 delete/redefine——
      // 否则 `delete scope.X` 会摘掉访问器，使该字段此后从面读取恒 undefined（cz2 契约测试
      // 的 `delete __eagleCoreState.canUseTouchID` 清理动作即踩中此点）。
      configurable: false,
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

  internalFace = face;
  return face;
}

let internalFace: any = null;

/** 应用内部 scope 面（单例；store 后端，**不写 window**——子窗安全性靠此保证）。 */
export function getScopeFace(): any {
  if (!internalFace) createBodyScopeFace();
  return internalFace;
}

/** 本窗作用域：子窗（`window.$bodyScope` 由本窗 controller 赋值）优先，缺省回落内部面。
 *  共享 `core/*` 模块（`fileUrlHelper` 等）在子窗执行时必须走此口，不得直用 `getScopeFace()`。 */
export function getWindowScope(): any {
  return (window as any).$bodyScope || getScopeFace();
}

/** **仅主窗入口调用**：安装过渡别名 `window.$bodyScope = face`（E5-4 删除）。 */
export function installScopeAlias(): void {
  (window as any).$bodyScope = getScopeFace();
}

/** store 注册表诊断口（测试/驱动按名读写字段；非 scope 对象，但读不到注册字段时回落面属性）。 */
export function installScopeRegistry(): void {
  (window as any).__eagleScopeRegistry = {
    read: (name: string) => { const m = getMigratedScopeField(name); return m ? m.read() : getScopeFace()[name]; },
    write: (name: string, value: any) => {
      const m = getMigratedScopeField(name);
      if (m) m.write(value);
      else getScopeFace()[name] = value;
    },
    names: () => getMigratedScopeFieldNames(),
  };
}

/** 诊断契约（冒烟 A6/cz1 用）：工厂直曝 + 状态。 */
export function exposeScopeFaceDiagnostics(): void {
  (window as any).__eagleScopeShim = {
    factory: createBodyScopeFace,
    active: false,
    migratedFieldNames: getMigratedScopeFieldNames,
  };
}
