/**
 * b1 桥：bundle 缺席（scope shim 生效）时，把 c3 fns 表（controllerFns 逐字移植的
 * controller 函数，此前仅经 callScope 消费）if-absent 挂上 shim——machinery/React 域的
 * s.X() 调用面即时可得（shim get 代理对未知属性返回 undefined，缺口即崩）。
 * bundle 在世时不调用：scope 函数面由 bundle 原版供给，本桥零迁移期行为变化。
 * fns 工厂以 getScope 闭包取 scope——传 shim 本体（proxy），函数内 const s = getScope()
 * 即 shim。机械契约：仅补 typeof !== 'function' 的缺口，machinery apply 后写的版本
 * （同轮更晚）照旧覆盖。
 */
import { makeControllerFns } from './controllerFns';

export function attachCoreFnsToShim(shim: any): number {
  const core = makeControllerFns(() => shim);
  let attached = 0;
  for (const key of Object.keys(core)) {
    if (typeof core[key] !== 'function') continue;
    if (typeof shim[key] === 'function') continue;
    shim[key] = core[key];
    attached += 1;
  }
  (window as any).__eagleShimFnsBridge = { attached };
  return attached;
}
