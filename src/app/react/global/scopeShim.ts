/**
 * c11：scope shim（coreState 后端）——b1 去 Angular 后 getBodyScope() 的回退实现。
 *
 * - **激活判据**：window.angular 由 app.bundle.js 内联定义（无独立 script 标签）——
 *   b1 移除 bundle 后 w.angular 不复存在，getBodyScope() 在此条件下创建 shim 并回填
 *   window.$bodyScope。bundle 在世时永不触发（classic script 先于 React module 执行，
 *   无启动窗口期误激活）。
 * - **属性面**：get/set 全量代理到 coreState（c8 起 scope 桥接字段本就以 coreState 为
 *   读写后端——shim 即该语义的直接化）；未初始化字段由同一批写入方（machinery/域处理器）
 *   按原路径填充，无快照需求。
 * - **函数面**：machinery 24 函数 + 域函数由 dataMachinery scope 替换面在接管时写入
 *   coreState（s.calculateImageBinding = ... 经 Proxy set 落 coreState），shim 天然解析。
 *   bundle 独占函数（relayout/filterContent/zoom 等）post-b1 缺席 = 诚实失败（b1 前必须
 *   完成各自 c 域移植）。
 * - **生命周期面**：$evalAsync/$apply（直调 + watcher flush）、$watch/$watchCollection
 *   （函数型 watcher 轮询 + 深比较——startScopeSync 兼容语义）、$on/$broadcast/$emit
 *   （shim 内事件总线——域处理器 $on 注册与 misc $broadcast 路径）、mousetrap 桩
 *   （bridgeWhenReady 强就绪门 b1 后放行）、$watchers = []（sweep 幂等 no-op）。
 *   $root/$parent = 自身（root 字段 theme/preferences 已在 coreState）。
 */

import { coreState } from '../core/appCore';

// b1-9az：字段迁移注册表（彻底化 R1——状态单源机制，REWRITE-PLAN.md 阶段 1）。
// 注册字段以 zustand store 为唯一状态源：get 委托 store、set 写 store（coreState 保留
// 镜像供 __eagleCoreState 诊断面）；未注册字段行为不变。注册由各 store 模块完成
// （bodyState 首批 20 字段）。scopeShim 由此逐批从"状态真身"降级为适配器，待全部
// 字段迁完、fns/machinery 归位后整个删除。
const migratedFields = new Map<string, { read: () => any; write: (v: any) => void }>();

export function migrateScopeFieldToStore(name: string, read: () => any, write: (v: any) => void): void {
  migratedFields.set(name, { read, write });
}

/** 诊断/测试契约：已源翻转字段清单（cz1 等机制测试动态选未迁移字段用）。 */
export function getMigratedScopeFieldNames(): string[] {
  return Array.from(migratedFields.keys());
}

export function createBodyScopeShim(): any {
  const watchers: any[] = [];
  let flushTimer: any = null;

  function jsonEq(a: any, b: any): boolean {
    if (a === b) return true;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch (err) {
      return false;
    }
  }

  function flushWatchers(): void {
    for (const entry of watchers.slice()) {
      let val: any;
      try {
        val = typeof entry.watcher === 'function' ? entry.watcher() : undefined;
      } catch (err) {
        continue;
      }
      if (entry.last === SHIM_UNSET || !jsonEq(val, entry.last)) {
        const old = entry.last === SHIM_UNSET ? undefined : entry.last;
        entry.last = val;
        try {
          entry.listener && entry.listener(val, old);
        } catch (err) {
          console.error('[scopeShim] watcher listener failed', err);
        }
      }
    }
  }

  function ensureFlushTimer(): void {
    if (flushTimer || watchers.length === 0) return;
    flushTimer = setInterval(() => {
      if (watchers.length === 0) {
        clearInterval(flushTimer);
        flushTimer = null;
        return;
      }
      flushWatchers();
    }, 200);
  }

  const SHIM_UNSET = Symbol('shim-unset');

  // 数据面字段都在 coreState、只经 proxy 可达；$eval / 字符串型 $watch 必须走 proxy 解析，
  // 否则对着裸 shim 取值恒为 undefined（startScopeSync 的 12 个域快照会永久停在初值——
  // body 的 is-detail-mode 等类名因此不跟随 scope，详情面板无尺寸、原图闸门超时）。
  let selfProxy: any = null;
  const evalPath = (expr: string): any => expr
    .split('.')
    .reduce((o: any, k: string) => (o == null ? undefined : o[k]), (selfProxy || shim) as any);

  const shim: any = {
    __eagleShim: true,
    $root: null,
    $parent: null,
    $$phase: undefined,
    // bridgeWhenReady 强就绪门桩（bundle initMousetrap 的 b1 后等价物；域接管只需存在性）
    mousetrap: {},
    // b1-9o：$watchers 别名指向真实 watcher 数组（此前是永空的死数组——flushWatchers 走
    // 闭包 watchers，诊断/清点方（1m1-A、filterDomain sweep diag）读 $watchers 恒 0）
    $watchers: watchers,

    $evalAsync(fn?: any): any {
      try {
        if (typeof fn === 'function') fn();
      } catch (err) {
        console.error('[scopeShim] $evalAsync fn failed', err);
      }
      flushWatchers();
    },
    $apply(fn?: any): any {
      try {
        if (typeof fn === 'function') fn();
      } catch (err) {
        console.error('[scopeShim] $apply fn failed', err);
      }
      flushWatchers();
    },
    $eval(expr: any): any {
      if (typeof expr === 'function') return expr(selfProxy || shim);
      if (typeof expr === 'string') return evalPath(expr);
      return undefined;
    },
    $on(name: string, fn: any): () => void {
      const arr = (shim.__bus[name] = shim.__bus[name] || []);
      arr.push(fn);
      return () => {
        const a = shim.__bus[name] || [];
        const i = a.indexOf(fn);
        if (i >= 0) a.splice(i, 1);
      };
    },
    $broadcast(name: string, ...args: any[]): any {
      const arr = shim.__bus[name] || [];
      arr.slice().forEach((fn: any) => {
        try {
          fn({ name, preventDefault() { /* noop */ }, defaultPrevented: false }, ...args);
        } catch (err) {
          console.error('[scopeShim] broadcast handler failed', err);
        }
      });
      return shim;
    },
    $emit(name: string, ...args: any[]): any {
      return shim.$broadcast(name, ...args);
    },
    $watch(watcher: any, listener?: any, _deep?: any): () => void {
      // Angular 支持字符串表达式型 watcher（域处理器有此用法）——归一成函数，经 proxy 取值
      const fn = typeof watcher === 'string' ? () => evalPath(watcher) : watcher;
      // b1-9o：exp 为诊断元数据（字符串 watcher 保留原表达式，函数 watcher 为 undefined）——
      // 供 1m1-A 域接管断言按表达式清点（bundle $$watchers.exp 的 shim 等价物），无行为作用
      const entry = { watcher: fn, listener, last: SHIM_UNSET as any, exp: typeof watcher === 'string' ? watcher : undefined };
      watchers.push(entry);
      ensureFlushTimer();
      // Angular 语义：listener 立即以 (当前值, 当前值) 触发一次
      try {
        const val = typeof fn === 'function' ? fn() : undefined;
        entry.last = val;
        listener && listener(val, val);
      } catch (err) {
        console.error('[scopeShim] initial watcher failed', err);
      }
      return () => {
        const i = watchers.indexOf(entry);
        if (i >= 0) watchers.splice(i, 1);
      };
    },
    $watchCollection(watcher: any, listener: any): () => void {
      return shim.$watch(watcher, listener, true);
    },
    $destroy(): void { /* noop */ },

    __bus: {} as Record<string, Function[]>,
  };
  shim.$root = shim;
  shim.$parent = shim;

  // 属性面：全量代理到 coreState（函数面字段在 shim 自身，优先命中）
  const proxy = new Proxy(shim, {
    get(target: any, prop: string) {
      if (prop in target) return target[prop];
      const migrated = migratedFields.get(prop);
      if (migrated) return migrated.read();
      return coreState[prop];
    },
    set(target: any, prop: string, value: any) {
      const migrated = migratedFields.get(prop);
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
    // b1-9az 批 2：已源翻转字段清单（cz1 等机制测试动态选未迁移字段——静态字段名
    // 会随迁移批次推进而失效，keyword 即被批 2 迁移后踩中）
    migratedFieldNames: getMigratedScopeFieldNames,
  };
}
