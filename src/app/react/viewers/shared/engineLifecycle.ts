/**
 * M4-D —— 第三方引擎「**挂载 → 就绪 → 卸载**」生命周期适配器（viewer 岛专用）。
 *
 * ## 形状的来源（不是新立的契约，是从本仓既有正确实现归纳出来的）
 * | 既有实现 | 归纳出的性质 |
 * |---|---|
 * | `preview-window/entry.tsx` 的 `let active = true` + `if (!active) return` | 卸载幂等 + 晚到回调早退 |
 * | 同处 `subscription() / ipc.off / ipc.removeListener` 三路退订 | 退订面按桥的能力自适应 |
 * | `viewers/raw/entry.tsx` 的「每资源一个句柄 → `clearTimeout` + `cancelAnimationFrame`」 | 句柄集中释放 |
 * | `viewers/media/audio/AudioViewer.tsx` 的 `let cancelled = false` | 异步链在卸载后不再回写 |
 * | `preview-window/entry.tsx` 的 `__eaglePreviewEntryReady` 置位/复位 | 就绪标记与卸载成对 |
 *
 * 归纳出的**共同不变量**（本模块存在的理由就是把它变成结构，而不是每次靠记性）：
 *  1. 挂载期取得的**一切**（监听、定时器、rAF、DOM/播放器实例、object URL、自定义释放）
 *     一律登记到**同一个释放点**；
 *  2. 卸载时按登记**逆序**执行，且**恰好一次**（`dispose` 幂等）；
 *  3. 卸载**之后**才到达的异步取得（fetch/字体加载/子进程回调）**就地释放**，绝不挂到
 *     已死的生命周期上——这是「反复挂载/卸载后资源不增长」的根本保证；
 *  4. 「就绪」是形状里的一个显式相（`markReady`），不是散落各处的 body class / 全局旗标。
 *
 * ## 边界（明写）
 * - 本模块**不**改任何算法：不碰缩放、指针坐标、连续网格，也不接管引擎自身的内部状态，
 *   只接管「谁在什么时候把它放掉」。
 * - `pending` 是诊断面（当前未释放登记数），不是业务状态，不要用它做控制流。
 */
import { useEffect, useRef, type DependencyList, type RefObject } from 'react';

/** 释放动作。 */
export type EngineDisposer = () => void;

/**
 * IPC 桥的最小面：`ipcRenderer` 在本仓有三代形态（返回退订函数的 / 暴露 `off` 的 /
 * 只暴露 `removeListener` 的），`subscribe` 按能力自适应。
 */
export interface EngineBridge {
  on?(channel: string, listener: (...args: unknown[]) => void): unknown;
  off?(channel: string, listener: (...args: unknown[]) => void): void;
  addListener?(channel: string, listener: (...args: unknown[]) => void): void;
  removeListener?(channel: string, listener: (...args: unknown[]) => void): void;
}

/** 一次挂载的资源生命周期。由 `createEngineLifecycle()` 建立，`dispose()` 释放。 */
export class EngineLifecycle {
  private _disposed = false;
  private _ready = false;
  private _disposers: EngineDisposer[] = [];

  /** 是否已卸载。晚到回调据此早退（等价 `preview-window/entry.tsx` 的 `active` 标志）。 */
  get disposed(): boolean {
    return this._disposed;
  }

  /** 是否已就绪（`markReady()` 置位后、卸载前为 true）。 */
  get ready(): boolean {
    return this._ready;
  }

  /** 当前未释放的登记数。诊断用；不增长即「没有泄漏」。 */
  get pending(): number {
    return this._disposers.length;
  }

  /** 标记就绪。幂等；已卸载时无效（就绪与卸载成对，见文件头不变量 4）。 */
  markReady(): void {
    if (this._disposed) return;
    this._ready = true;
  }

  /** 登记一个自定义释放动作。已卸载时**立即就地执行**（不变量 3）。 */
  onDispose(disposer: EngineDisposer): void {
    if (this._disposed) {
      runDisposer(disposer);
      return;
    }
    this._disposers.push(disposer);
  }

  /** 接管一个外部实例：`dispose` 时以 `dispose(value)` 释放它（如 `AudioContext`、`SuperGif`）。 */
  own<T>(value: T, dispose: (value: T) => void): T {
    this.onDispose(() => { dispose(value); });
    return value;
  }

  /** `setTimeout` + 自动清理。已卸载时**不排程**并返回 0。 */
  timeout(fn: () => void, ms: number): number {
    if (this._disposed) return 0;
    const id = setTimeout(fn, ms) as unknown as number;
    this.onDispose(() => { clearTimeout(id); });
    return id;
  }

  /** `setInterval` + 自动清理。已卸载时不排程并返回 0。 */
  interval(fn: () => void, ms: number): number {
    if (this._disposed) return 0;
    const id = setInterval(fn, ms) as unknown as number;
    this.onDispose(() => { clearInterval(id); });
    return id;
  }

  /** `requestAnimationFrame` + 自动取消。已卸载时不排程并返回 0。 */
  raf(cb: FrameRequestCallback): number {
    if (this._disposed) return 0;
    const id = requestAnimationFrame(cb);
    this.onDispose(() => { cancelAnimationFrame(id); });
    return id;
  }

  /** `addEventListener` + 自动摘除（`window` / `document` / `document.body` / 任意 EventTarget）。 */
  listen(
    target: EventTarget | null | undefined,
    type: string,
    handler: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean
  ): void {
    if (this._disposed || !target) return;
    target.addEventListener(type, handler, options);
    this.onDispose(() => { target.removeEventListener(type, handler, options); });
  }

  /** IPC 订阅 + 自动退订。桥缺失或能力不足时静默不订（与既有实现同语义）。 */
  subscribe(
    bridge: EngineBridge | null | undefined,
    channel: string,
    handler: (...args: unknown[]) => void
  ): void {
    if (this._disposed || !bridge) return;
    let unsubscribe: EngineDisposer | null = null;
    if (typeof bridge.on === 'function') {
      const returned: unknown = bridge.on(channel, handler);
      if (typeof returned === 'function') unsubscribe = returned as EngineDisposer;
      else if (typeof bridge.off === 'function') unsubscribe = () => { bridge.off?.(channel, handler); };
      else if (typeof bridge.removeListener === 'function') unsubscribe = () => { bridge.removeListener?.(channel, handler); };
    } else if (typeof bridge.addListener === 'function') {
      bridge.addListener(channel, handler);
      if (typeof bridge.off === 'function') unsubscribe = () => { bridge.off?.(channel, handler); };
      else if (typeof bridge.removeListener === 'function') unsubscribe = () => { bridge.removeListener?.(channel, handler); };
    }
    if (unsubscribe) this.onDispose(unsubscribe);
  }

  /**
   * `URL.createObjectURL` + 自动 `revokeObjectURL`（如 `viewers/raw` 的内嵌缩略图）。
   * 已卸载时返回空串——调用方此时本就该放弃这次绘制。
   */
  objectUrl(blob: Blob): string {
    if (this._disposed) return '';
    const url = URL.createObjectURL(blob);
    this.onDispose(() => { URL.revokeObjectURL(url); });
    return url;
  }

  /**
   * 卸载：按登记**逆序**释放，恰好一次（幂等）。
   * 单个释放动作抛错**不**阻断其余释放——否则一个坏引擎会拖垮同一挂载期的其它资源。
   */
  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this._ready = false;
    const disposers = this._disposers.splice(0).reverse();
    for (const disposer of disposers) runDisposer(disposer);
  }
}

function runDisposer(disposer: EngineDisposer): void {
  try {
    disposer();
  } catch (err) {
    console.error('[engineLifecycle] 释放动作抛错，已跳过并继续释放其余资源', err);
  }
}

/** 建立一次挂载的生命周期。 */
export function createEngineLifecycle(): EngineLifecycle {
  return new EngineLifecycle();
}

/**
 * React 侧入口：把一次 effect 挂载绑定到一个 `EngineLifecycle`，卸载时自动 `dispose`。
 *
 * 返回的是 **ref**（而非对象本身）：viewer 的事件处理器（`handleImageError` 之类）在渲染
 * 作用域里定义、在挂载期任意时刻被调用，与 `errorTimeoutRef` / `canvasRef` 等既有句柄同构。
 * 卸载后 `ref.current` 归 null，处理器里的 `lc?.timeout(...)` 自然成为 no-op。
 */
export function useEngineLifecycle(
  setup: (lifecycle: EngineLifecycle) => void,
  deps: DependencyList = []
): RefObject<EngineLifecycle | null> {
  const ref = useRef<EngineLifecycle | null>(null);
  useEffect(() => {
    const lifecycle = createEngineLifecycle();
    ref.current = lifecycle;
    setup(lifecycle);
    return () => {
      ref.current = null;
      lifecycle.dispose();
    };
    // setup 由调用方按 deps 语义负责（与 useEffect 同构）；此处透传即可。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}
