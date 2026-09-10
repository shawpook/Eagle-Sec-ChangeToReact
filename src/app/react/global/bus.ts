/**
 * b1-9ba：类型化事件总线 —— $broadcast/$on（scopeShim.__bus）的最终替代物。
 *
 * 迁移期约定（REWRITE-PLAN v2 阶段 3）：
 * - 各竖切把某频道的收发双方迁到本总线后，该频道即从 scope 世界退役；
 *   频道名与 payload 形状沿用原广播契约，行为以回归套件为准。
 * - 处理器异常互相隔离（对齐 scopeShim.$broadcast 的 try/catch 语义），
 *   一个 handler 抛错不影响同频道其余 handler。
 * - defineChannel 给竖切提供按频道的类型化收发面：竖切落地时用 payload
 *   类型实例化，emit/on 的入参出参即获得静态检查。
 */

export type BusHandler = (payload?: any, ...rest: any[]) => void;

class EventBus {
  private channels = new Map<string, Set<BusHandler>>();

  /** 订阅；返回退订函数（幂等，重复调用安全）。 */
  on(channel: string, handler: BusHandler): () => void {
    let set = this.channels.get(channel);
    if (!set) {
      set = new Set();
      this.channels.set(channel, set);
    }
    set.add(handler);
    return () => {
      const s = this.channels.get(channel);
      if (!s) return;
      s.delete(handler);
      if (s.size === 0) this.channels.delete(channel);
    };
  }

  /** 单次订阅：触发一次后自动退订。 */
  once(channel: string, handler: BusHandler): () => void {
    const off = this.on(channel, (...args) => {
      off();
      handler(...args);
    });
    return off;
  }

  /** 派发；处理器按注册顺序同步执行，异常隔离。 */
  emit(channel: string, payload?: any, ...rest: any[]): void {
    const set = this.channels.get(channel);
    if (!set) return;
    for (const handler of Array.from(set)) {
      try {
        handler(payload, ...rest);
      } catch (err) {
        console.error(`[bus] handler for "${channel}" failed`, err);
      }
    }
  }

  /** 诊断/测试：某频道当前订阅数。 */
  listenerCount(channel: string): number {
    return this.channels.get(channel)?.size ?? 0;
  }

  /** 诊断/测试：当前活跃频道名。 */
  channelNames(): string[] {
    return Array.from(this.channels.keys());
  }
}

export const eagleBus = new EventBus();

// 闭环测试（CDP Runtime.evaluate）可直接访问总线，不参与业务逻辑。
(window as any).__eagleBus = eagleBus;

/**
 * 竖切用的类型化频道句柄：以 payload 类型实例化后，emit/on 获得静态检查。
 * 频道名集中在此处声明（或各竖切模块内声明后从模块导出），禁止散落字符串。
 */
export function defineChannel<P = void>(name: string) {
  return {
    name,
    emit: (payload: P) => eagleBus.emit(name, payload),
    on: (handler: (payload: P) => void) => eagleBus.on(name, handler as BusHandler),
  };
}

// ── b1-9bo：CONTEXTMENU 频道（首个 $broadcast → eagleBus 整频道切换）──
// 契约沿用原广播：OPEN 载荷 = ContextMenu.open(options) 的 descriptor 树
// （items/width/showSearch/persistents/onOpened/onClosed…）；CLOSE 无载荷。
export const contextMenuOpenChannel = defineChannel<any>('CONTEXTMENU.OPEN');
export const contextMenuCloseChannel = defineChannel<void>('CONTEXTMENU.CLOSE');

// ── b1-9bz-C-2：裁剪工具 / 文件夹密码 / 批量重命名的频道迁移 ──
// 载荷沿用原广播：MOVE/RESIZE-CROP-TOOL = { horizontal, vertical }；
// SET-FOLDER-PASSWORD = { folder, mode: 'new' | 'change' | 'reset' }；
// OPEN_RENAME = { type, images, ... }（原 $on 的 params）。
export const moveCropToolChannel = defineChannel<any>('MOVE-CROP-TOOL');
export const resizeCropToolChannel = defineChannel<any>('RESIZE-CROP-TOOL');
export const setFolderPasswordChannel = defineChannel<any>('SET-FOLDER-PASSWORD');
export const openRenameChannel = defineChannel<any>('OPEN_RENAME');
