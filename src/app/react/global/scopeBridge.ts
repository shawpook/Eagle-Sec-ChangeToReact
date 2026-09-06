/**
 * 迁移期 scope 桥：把 Angular $bodyScope 的状态快照同步进 zustand。
 *
 * 规范来源 = app.bundle.js 的 EagleController scope。快照只做「读」，事件回调仍调用
 * $bodyScope 上的同名函数（clickNode/openAll/...），保证迁移期行为与旧版逐字一致。
 * 对应的旧实现将在「阶段11 清理」时随 angular 一起移除，逻辑届时已由 React 侧接管。
 */

import { createBodyScopeShim } from './scopeShim';

export function getBodyScope(): any {
  const w = window as any;
  if (w.$bodyScope) return w.$bodyScope;
  const angular = w.angular;
  if (angular && angular.element) {
    const scope = angular.element(document.body).scope();
    if (scope) return scope;
  }
  // c11：b1 后 Angular 缺席（angular 由 app.bundle.js 内联定义，无独立 script 标签）→
  // scope shim（coreState 后端）。bundle 在世时此分支不可达——classic script 先于 React
  // module 执行，w.angular 必然已定义。
  if (!angular) {
    const shim = createBodyScopeShim();
    w.$bodyScope = shim;
    if (w.__eagleScopeShim) w.__eagleScopeShim.active = true;
    return shim;
  }
  return null;
}

export function getRootScope(): any {
  const scope = getBodyScope();
  return scope ? scope.$root : null;
}

/** 在 Angular 作用域上下文中执行表达式（等价 ng-click 的 $apply 语义，digest 期内安全跳过）。 */
export function scopeApply(scope: any, fn: (scope: any) => void): void {
  if (!scope) return;
  if (scope.$$phase || scope.$root.$$phase) {
    try {
      fn(scope);
    } catch (err) {
      console.error('[react-scope-bridge]', err);
    }
    return;
  }
  try {
    scope.$apply(fn.bind(null, scope));
  } catch (err) {
    console.error('[react-scope-bridge]', err);
  }
}

/** 依据 node id 从活的 sidebarList 中取回 node 实例（事件回调必须传活对象）。 */
export function findLiveNode(nodeId: string): any {
  const scope = getBodyScope();
  if (!scope || !Array.isArray(scope.sidebarList)) return null;
  return scope.sidebarList.find((node: any) => node && node.id === nodeId) || null;
}

/** 把 Angular ng-class 风格的对象序列化为 class 字符串（保持 key 插入顺序）。 */
export function classObjectToString(map: Record<string, unknown> | undefined | null): string {
  if (!map) return '';
  return Object.keys(map)
    .filter((key) => map[key])
    .join(' ');
}

export interface ScopeSyncOptions {
  /** 监听的 scope 表达式列表（$watchCollection 语义）。 */
  watch: string[];
  /** 变化时构建快照；在 Angular 上下文外运行，读取 scope 请自行容错。 */
  build: (scope: any) => unknown;
  /** 应用快照（一般落到 zustand set）。 */
  apply: (snapshot: unknown) => void;
}

export function startScopeSync({ watch, build, apply }: ScopeSyncOptions): () => void {
  const scope = getBodyScope();
  if (!scope) {
    // Angular 尚未就绪：等就绪后再挂（React 侧在 effect 中重试）。
    const retry = setInterval(() => {
      if (getBodyScope()) {
        clearInterval(retry);
        startScopeSync({ watch, build, apply });
      }
    }, 200);
    return () => clearInterval(retry);
  }
  let applying = false;
  let lastSnapshot: unknown = null;
  // b1-9az：no-op 快照跳过——监听值变化但 build 输出未变时（如 orderBy 换名而 boxSortable
  // 不变），setState 仍生成新对象触发全量订阅者重渲染；BodyBindings 对 body.className
  // 是整写语义，会把外部命令式 classList.add 的类抹掉（7c welcome-open 实锚）。
  const shallowEq = (a: any, b: any): boolean => {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    const ka = Object.keys(a);
    if (ka.length !== Object.keys(b).length) return false;
    return ka.every((k) => a[k] === b[k]);
  };
  const push = () => {
    if (applying) return;
    applying = true;
    try {
      const next = build(scope);
      if (lastSnapshot !== null && shallowEq(next, lastSnapshot)) return;
      lastSnapshot = next;
      apply(next);
    } catch (err) {
      console.error('[react-scope-bridge] snapshot build failed', err);
    } finally {
      applying = false;
    }
  };
  // $parse 不接受 JS 数组（会得到 noop），必须用函数型 watcher + 深比较：
  // 侧栏节点会被 Angular 原地改（isExpand/editable/isSelected），浅引用比较会漏更新。
  const watcher = () => watch.map((expr) => {
    try {
      return scope.$eval(expr);
    } catch (err) {
      return undefined;
    }
  });
  scope.$watch(watcher, push, true);
  // 首次快照
  setTimeout(push, 0);
  return () => {};
}
