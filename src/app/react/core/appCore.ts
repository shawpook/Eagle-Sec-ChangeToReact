/**
 * cZ-1：数据面存储桥——AppCore 单例 + scope 字段访问器化。
 *
 * 机制：`bridgeScopeFields(scope, fields)` 把 $bodyScope 上的指定字段转为
 * getter/setter 访问器，后端为本模块的 coreState 对象。bundle 内一切读写
 * （ipc 处理器/watch/函数体）经属性访问透明落到 AppCore——**行为零改动、
 * Angular 世界与 React 世界共享同一存储**；React 的 startScopeSync 监听
 * （读 scope 字段）零改动自动生效。
 *
 * 桥接时机：Angular boot 完成后（scope 字段已有初值——桥接时把现值收编为
 * AppCore 初值，绝不丢状态）。通道截肢（amputateChannel）随各 cZ 域切片逐个
 * 执行；本模块仅提供基建。
 */

// AppCore 状态容器（普通对象——桥接访问器需要同步属性读写）
export const coreState: Record<string, any> = {};

const bridged = new Set<string>();

/**
 * 把 scope 上的字段转为访问器（现值收编进 coreState）。
 * 已桥接的字段跳过（幂等）。字段不存在时同样桥接（bundle 后续赋值会进 AppCore）。
 */
function findOwner(scope: any, name: string): any {
  // 沿原型链找到字段的拥有 scope（RootController/EagleController 分层写入的正确落点）
  let cur = scope;
  let hops = 0;
  while (cur && hops < 8) {
    if (Object.prototype.hasOwnProperty.call(cur, name)) return cur;
    cur = cur.$parent || null;
    hops++;
  }
  return scope;
}

export function bridgeScopeFields(scope: any, fields: string[]): void {
  if (!scope) return;
  for (const name of fields) {
    if (bridged.has(name)) continue;
    try {
      const owner = findOwner(scope, name);
      const current = owner[name];
      coreState[name] = current;
      Object.defineProperty(owner, name, {
        get() { return coreState[name]; },
        set(v: any) { coreState[name] = v; },
        configurable: true,
        enumerable: true,
      });
      bridged.add(name);
    } catch (err) {
      console.error('[app-core] bridge failed for ' + name, err);
    }
  }
}

export function isBridged(name: string): boolean {
  return bridged.has(name);
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
