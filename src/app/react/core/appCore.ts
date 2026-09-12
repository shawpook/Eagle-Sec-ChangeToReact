/**
 * cZ-1 → b1-9bz-E4-5：scope 面供给与运行时小工具（原 AppCore + scopeBridge 收口）。
 *
 * E4-5 起：`coreState` 与 `bridgeScopeFields`（Angular 时代的 scope 访问器后端）已删除——
 * scope 面由 `core/scopeFace.ts` 的显式 describeProperty 实现（注册字段直连 store），
 * 本模块只保留 `getBodyScope`/`getRootScope` 取用与 watcher 清扫等运行时工具。
 */

/* ── scope watcher 接管工具（cZ-5/6/4 遗留；bundle 桥已删，本组仅供残留诊断/清扫调用）──
 * $watch(string) 的 watcher.exp 是字符串；$watchCollection 的 exp 是 $parse 实例
 * （可能带 expensiveChecks interceptor）——依次按 字符串/实例/生成源码串 匹配 */

/* 注意：不做生成源码串等价——$parse 的 expensiveChecks 包装器对一切表达式共享同一源码 */
export function matchWatchExp(wch: any, exp: string, parsedList: any[]): boolean {
  if (!wch) return false;
  if (wch.exp === exp) return true;
  if (typeof wch.exp === 'function') {
    for (const p of parsedList) {
      if (p && wch.exp === p) return true;
    }
  }
  return false;
}

function getParseVariants(exp: string): any[] {
  const out: any[] = [];
  try {
    const ang = (window as any).angular;
    if (ang && ang.element && ang.element(document).injector) {
      const $parse = ang.element(document).injector().get('$parse');
      out.push($parse(exp));
      try { out.push($parse(exp, { expensiveChecks: true })); } catch (err) { /* noop */ }
    }
  } catch (err) { /* noop */ }
  return out;
}

/** 持续清扫：100ms × 150 次（15s）幂等复扫，覆盖 bundle watcher 晚注册的竞态窗口 */
export function persistSweep(s: any, exp: string, mine: any[], fnSignature?: string, mineSrcMarkers?: string[], diag?: any): void {
  let ticks = 0;
  const iv = setInterval(() => {
    ticks++;
    if (diag) { diag.sweepTicks = (diag.sweepTicks || 0) + 1; }
    try {
      const n = sweepForeignWatchers(s, exp, mine, fnSignature, mineSrcMarkers);
      if (diag && n) { diag.sweepRemoved = (diag.sweepRemoved || 0) + n; }
    } catch (err) { /* noop */ }
    if (ticks >= 150) clearInterval(iv);
  }, 100);
}

/** 注册后清扫：移除 scope 上匹配 exp/fnSignature 且不属于 mine（本域句柄或监听函数）的
 *  watcher，返回移除数。fnSignature = bundle 监听函数源码特征串（$watchCollection 的
 *  exp 是 $parse 包装器实例，无法按表达式识别，只能按监听函数源码识别）。 */
export function sweepForeignWatchers(s: any, exp: string, mine: any[], fnSignature?: string, mineSrcMarkers?: string[]): number {
  let removed = 0;
  try {
    const watchers = s.$$watchers;
    if (!Array.isArray(watchers)) return 0;
    const parsedList = getParseVariants(exp);
    // $watch 返回的是注销函数而非 watcher 对象——mine 可含两种形态；
    // $watchCollection 会包装 listener（fn !== 原函数），故另按 mineSrcMarkers 源码标记排除己方
    const mineSet = new Set(mine);
    for (let i = watchers.length - 1; i >= 0; i--) {
      const wch = watchers[i];
      if (!wch || mineSet.has(wch) || (wch.fn && mineSet.has(wch.fn))) continue;
      const wfnSrc = wch.fn && typeof wch.fn.toString === 'function' ? String(wch.fn) : '';
      if (mineSrcMarkers && mineSrcMarkers.some((m) => wfnSrc.indexOf(m) !== -1)) continue;
      if (matchWatchExp(wch, exp, parsedList)
        || (fnSignature && wfnSrc.indexOf(fnSignature) !== -1)) {
        watchers.splice(i, 1);
        removed++;
      }
    }
  } catch (err) { /* noop */ }
  return removed;
}

/**
 * 通道截肢：移除某通道上的全部监听（bundle 原处理器消亡），返回重挂函数供
 * React 处理器注册（含自愈场景重挂）。
 */
export function amputateChannel(ipc: any, channel: string): ((handler: any) => void) | null {
  if (!ipc || typeof ipc.removeAllListeners !== 'function') return null;
  ipc.removeAllListeners(channel);
  return (handler: any) => {
    if (typeof ipc.on === 'function') ipc.on(channel, handler);
  };
}

/**
 * 源码签名选择性截肢：只移除通道上函数源码命中任一签名的监听（bundle 原处理器），
 * 保留 React 组件自给监听（SmallPanels/ProgressDialogs/uploadState 等与 bundle 共用通道）。
 * 与 removeAllListeners 的差别：多消费方通道不能整体截肢，只能精准摘除 bundle 处理器。
 */
export function removeChannelListenersBySource(ipc: any, channel: string, signatures: string[]): number {
  if (!ipc) return 0;
  let removed = 0;
  try {
    let list: any[] = [];
    // node EventEmitter 形态（_events 对象）
    const raw = (ipc as any)._events ? (ipc as any)._events[channel] : undefined;
    if (Array.isArray(raw)) list = raw.slice();
    else if (raw) list = [raw];
    // shims EventEmitter 形态（listeners Map）
    if (!list.length && (ipc as any).listeners instanceof Map) {
      const mapped = (ipc as any).listeners.get(channel);
      if (Array.isArray(mapped)) list = mapped.slice();
    }
    const removeFn = typeof ipc.removeListener === 'function' ? ipc.removeListener.bind(ipc)
      : typeof ipc.off === 'function' ? ipc.off.bind(ipc) : null;
    if (!removeFn) return 0;
    for (const fn of list) {
      if (typeof fn !== 'function') continue;
      let src = '';
      try { src = fn.toString(); } catch (err) { continue; }
      if (signatures.some((sig) => src.indexOf(sig) !== -1)) {
        try { removeFn(channel, fn); removed++; } catch (err) { /* noop */ }
      }
    }
  } catch (err) { /* noop */ }
  return removed;
}

// ── b1-9by-D → E4-5：scope 面（scopeFace）惰性创建，环安全 ──
import { createBodyScopeFace } from './scopeFace';

export function getBodyScope(): any {
  const w = window as any;
  if (w.$bodyScope) return w.$bodyScope;
  const angular = w.angular;
  if (angular && angular.element) {
    const scope = angular.element(document.body).scope();
    if (scope) return scope;
  }
  // b1 后 Angular 缺席（angular 由 app.bundle.js 内联定义，无独立 script 标签）→
  // 显式 scope 面（store 后端；无 Proxy/coreState）。bundle 在世时此分支不可达。
  if (!angular) {
    const face = createBodyScopeFace();
    if (w.__eagleScopeShim) w.__eagleScopeShim.active = true;
    return face;
  }
  return null;
}

export function getRootScope(): any {
  const scope = getBodyScope();
  return scope ? scope.$root : null;
}

/** D-1 A-1：动态分发点传「需要 body scope 作首参」的 handler 时的标记。
 *
 * call/callSeq/scopeFn 等 helper 内部已持有 scope，见到本标记即以 scope 为首参调用；
 * 这样把 machinery 函数（签名 (s, ...args)）当引用传递时，无需在各调用点新增 scope 取用。
 * 待 scopeShim 退役时随 helper 一并收敛。 */
export const SCOPED_HANDLER = Symbol('eagleScopedHandler');

export function scoped<A extends any[], R>(fn: (s: any, ...args: A) => R): (...args: A) => R {
  const wrapped = (...args: A): R => (fn as any)(...args);
  (wrapped as any)[SCOPED_HANDLER] = true;
  return wrapped;
}

/**
 * b1-9bz-E1b：在 body scope 上下文中执行回调（取代原 `scopeApply(scope, fn)`）。
 *
 * 原实现经 shim 的 `$apply` 包装（Angular digest）。实测 shim 世界 `$$phase` 恒 undefined，
 * 该包装等价于「执行 fn + flushWatchers（全树已无 watcher，恒 no-op）」并吞掉 fn 抛错。
 * 新实现保留同语义：取不到 scope 则不执行；fn 抛错 catch + log；不向调用方上抛。
 * C-3 记录的行为差异（原版在 scope 无 `$apply` 时抛错被 catch、fn 不执行）在 shim 世界不成立
 * （`$apply` 恒存在），故直调化安全。
 */
export function runInBodyScope<T = void>(fn: (scope: any) => T): T | undefined {
  const scope = getBodyScope();
  if (!scope) return undefined;
  try {
    return fn(scope);
  } catch (err) {
    console.error('[react-scope-bridge]', err);
    return undefined;
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
