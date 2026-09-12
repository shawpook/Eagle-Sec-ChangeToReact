/**
 * c11：scope shim（coreState 后端）——b1 去 Angular 后 getBodyScope() 的回退实现。
 *
 * - **激活判据**：window.angular 由 app.bundle.js 内联定义（无独立 script 标签）——
 *   b1 移除 bundle 后 w.angular 不复存在，getBodyScope() 在此条件下创建 shim 并回填
 *   window.$bodyScope。bundle 在世时永不触发。
 * - **属性面**：get/set 全量代理到 coreState（已注册字段委托对应 store）；未初始化字段由
 *   同一批写入方（machinery/域处理器）按原路径填充。
 * - **函数面**：machinery/域函数在该面接管时写入 coreState（经 Proxy set 落 coreState），
 *   shim 天然解析；bundle 独占函数 post-b1 缺席 = 诚实失败。
 *
 * b1-9bz-E1 收口：Angular 方法面已退役——
 *   E1b 删 `$apply`（`scopeApply` → `runInBodyScope`）；E1c 删 `$watch`/`$watchCollection`/
 *   watcher 定时器/`$on`/`$broadcast`/`$emit`/`__bus`（全树已无调用方：最后一个 watcher 由
 *   `selectionNotify` 承接，两个 `$on` 接收方无发送者，已删除/改 eagleBus）。
 *   `$evalAsync` 保留为**测试/驱动用 no-op 提交钩子**（生产 src 无调用点），E5 随驱动迁移删除。
 *   现仅剩属性 Proxy + `$eval`/`$evalAsync` 与少量占位键，E4 随 coreState 一起删除。
 */

import { coreState } from '../core/appCore';
import { getMigratedScopeField, getMigratedScopeFieldNames } from '../core/scopeFieldBridge';

export function createBodyScopeShim(): any {
  // 数据面字段都在 coreState、只经 proxy 可达；字符串型 $eval 必须走 proxy 解析，
  // 否则对着裸 shim 取值恒为 undefined。
  let selfProxy: any = null;
  const evalPath = (expr: string): any => expr
    .split('.')
    .reduce((o: any, k: string) => (o == null ? undefined : o[k]), (selfProxy || shim) as any);

  const shim: any = {
    __eagleShim: true,
    $root: null,
    $parent: null,
    $$phase: undefined,
    // b1-9bz-E4：`mousetrap` 就绪门桩种子已删除——真身改由 miscRawState 持有（默认 `{}`，
    // m1-A6 的 `!!shim.mousetrap` 契约不变），避免 `prop in target` 遮蔽迁移委托的读写分裂。

    $eval(expr: any): any {
      if (typeof expr === 'function') return expr(selfProxy || shim);
      if (typeof expr === 'string') return evalPath(expr);
      return undefined;
    },
    // b1-9bz-E1c：保留为**测试/驱动用 no-op 提交钩子**——全树已无 watcher，故本方法不再有
    // 生产调用点（sentinel：src 内 `.$evalAsync(` 调用计数为 0，仅本定义计入）。测试驱动
    // （tests/*.mjs、electron/main.cjs 烟测脚本）以 `s.$evalAsync()` 表达"提交"，E5 迁移
    // 驱动到 store hook 后随之删除。
    $evalAsync(fn?: any): any {
      if (typeof fn === 'function') {
        try { fn(); } catch (err) { console.error('[scopeShim] $evalAsync fn failed', err); }
      }
      return undefined;
    },
    $destroy(): void { /* noop */ },
  };
  shim.$root = shim;
  shim.$parent = shim;

  // 属性面：全量代理到 coreState（已注册字段优先命中 store 委托）
  const proxy = new Proxy(shim, {
    get(target: any, prop: string) {
      if (prop in target) return target[prop];
      const migrated = getMigratedScopeField(prop);
      if (migrated) return migrated.read();
      return coreState[prop];
    },
    set(target: any, prop: string, value: any) {
      const migrated = getMigratedScopeField(prop);
      if (migrated) {
        migrated.write(value);
        // 迁移期镜像：__eagleCoreState 诊断面与未迁移读取方不失真
        coreState[prop] = value;
        return true;
      }
      coreState[prop] = value;
      // b1-9av：target 预置字段双写——get 优先读 target（prop in target），只写 coreState
      // 会造成读写分裂（实锚：mousetrap 种子 {} 恒读旧值，键盘 bindings map 写入即丢）
      if (prop in target) target[prop] = value;
      return true;
    },
    has(target: any, prop: string) {
      return prop in target || prop in coreState;
    },
  });
  // 自引用必须指向 proxy（消费侧 `scope.$root === scope` 等恒等比较经由 proxy）
  shim.$root = proxy;
  shim.$parent = proxy;
  selfProxy = proxy;
  return proxy;
}

/** 诊断契约（冒烟 A6 用）：工厂直曝 + 状态。 */
export function exposeScopeShimDiagnostics(): void {
  (window as any).__eagleScopeShim = {
    factory: createBodyScopeShim,
    active: false,
    migratedFieldNames: getMigratedScopeFieldNames,
  };
}
