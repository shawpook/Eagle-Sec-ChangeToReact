/**
 * b1-9bz-E4-5：body scope 面（`scopeShim.ts` 的 Proxy-over-coreState 退役后的显式实现）。
 *
 * 与旧 shim 的差别（DoD ①）：
 *  - **无 `coreState` 后端**：注册字段经 `Object.defineProperty` 直连 store（读 `read()`、
 *    写 `write(v)`）；未注册字段落本模块的普通对象 `plain`（等价旧 coreState 的稀疏写穿）。
 *  - **无 Proxy**：字段描述符在建面时按注册表枚举声明；**面创建之后**才注册的字段由
 *    `scopeFieldBridge` 的晚注册钩子回调同一个 `define()` 补挂（语义与建面时逐字一致）。
 *    ⚠ F11 订正：本行原写「晚注册（面创建后）由 getter/setter 动态查表兜住」——getter/setter
 *    确实动态查表，但**晚注册名在面上根本没有描述符**，压根走不到 getter/setter：直读恒
 *    `undefined`、直写落 `plain` 自有属性而不落 store（运行期探针 `tests/f11-scope-face-
 *    late-registration.mjs` 实测坐实）。原注释描述的是「描述符已建」时的行为，不是晚注册
 *    的行为，故此处据实改写。
 *  - 函数面（machinery 挂载、跨窗/驱动供给）不变：`machineryInfra.applyDataMachineryScope`
 *    等直接写本面属性。
 *
 * 保留的最小面：`__eagleShim`（shim-only 分支判据）、`$root`/`$parent` 自指、`$eval`、`$destroy`。
 *  诊断出口仍名 `__eagleScopeShim`（冒烟 A6/cz1 契约）。
 *
 * **E5-4 起主窗不再暴露 `window.$bodyScope`**：跨边界消费走 `core/driverApi.ts` 的显式
 * `window.__eagleDriver`（main.cjs / shims.js / viewer iframe）与 `window.__eagleScopeRegistry`
 * （诊断/测试按名读写）；测试观测口 `__eagleProbe` 由 `tests/react-cdp-harness.mjs` 安装
 * （自带 `$evalAsync` no-op，故本面不再保留该提交钩子）。子窗（preview-window / viewers）
 * 仍以 `window.$bodyScope` 承载**本窗** controllerScope（`preview-window/controller.ts:2425`），
 * 共享 `core/*` 模块必须经 `getWindowScope()` 取「本窗 scope」，否则会建出空的 store 面并
 * **覆盖子窗自有 scope**。
 */
import { getMigratedScopeField, getMigratedScopeFieldNames, installScopeFieldLateRegistrationHook } from './scopeFieldBridge';

/** 面自身的保留名（方法面 / Angular 同形标记位）：字段描述符不得覆盖它们。 */
const RESERVED_FACE_NAMES = new Set(['__eagleShim', '$root', '$parent', '$$phase', '$eval', '$destroy']);

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
    $destroy(): void { /* noop */ },
  };
  face.$root = face;
  face.$parent = face;

  // 已挂描述符的名字：registration 可能重复（HMR / 模块重求值），而 configurable:false 下
  // 重定义会抛 TypeError，故此处幂等短路。getter/setter 本身是动态查表的，重复注册后读到的
  // 仍是注册表里最新的 read/write，无需重建描述符。
  const definedFields = new Set<string>();
  const define = (name: string): void => {
    if (definedFields.has(name)) return;
    definedFields.add(name);
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

  // F11：面创建**之后**才注册的字段同样要拿到面属性——注册表变化时回调本面的 define（同一个
  // 闭包，语义与上面建面枚举逐字一致）。
  // 与建面枚举用 `name in face` 判重不同，这里只认保留名：此时面上多出来的自有属性只可能是
  // 「未注册期直写落下的 plain 值」，而注册表已声明该名字归 store —— 按全仓既有口径
  // （`writeScopeField` / `driverApi` / `__eagleScopeRegistry` 一律注册表优先），该描述符必须
  // 补挂以收敛到 store，否则面会永远返回那个陈旧值。
  installScopeFieldLateRegistrationHook((name: string) => {
    if (RESERVED_FACE_NAMES.has(name)) return;
    define(name);
  });

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
