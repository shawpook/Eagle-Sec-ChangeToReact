/**
 * b1-9bc：自研计时工具——替代 lodash 的 debounce/throttle（vendor lodash.js 退役路径）。
 *
 * 语义对照 vendored lodash 4.x 实测（非注释口径）：
 * - debounce(func, wait, true)：lodash 4 对非对象第三参 isObject 判 false → **trailing
 *   edge**（bundle 注释里的 "leading" 口径与实际运行时不符，按运行时复刻）。本实现
 *   保留第三参为 legacy 占位，行为 = trailing。
 * - throttle(func, wait[, true])：lodash 4 默认 leading + trailing 双缘。本实现同。
 * - 两者都提供 cancel/flush（与 lodash 实例方法对齐；当前树内无调用点，为将来留位）。
 */

export interface Debounced<ArgsT extends any[]> {
  (...args: ArgsT): void;
  cancel(): void;
  flush(): void;
}

/** trailing-edge 防抖：等待窗内最后一次调用胜出。
 *  `_legacyImmediate`：bundle 老签名第三参占位（lodash 4 对非对象第三参不生效），
 *  保留调用点形态不变，运行时恒为 trailing。 */
export function debounce<ArgsT extends any[]>(fn: (...args: ArgsT) => void, wait: number, _legacyImmediate?: boolean): Debounced<ArgsT> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: ArgsT | null = null;
  const debounced = ((...args: ArgsT) => {
    lastArgs = args;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const a = lastArgs;
      lastArgs = null;
      if (a) fn(...a);
    }, wait);
  }) as Debounced<ArgsT>;
  debounced.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };
  debounced.flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
      const a = lastArgs;
      lastArgs = null;
      if (a) fn(...a);
    }
  };
  return debounced;
}

export interface Throttled<ArgsT extends any[]> {
  (...args: ArgsT): void;
  cancel(): void;
  flush(): void;
}

/** leading + trailing 双缘节流（lodash 4 默认）：窗首立即执行，窗尾补发最后一次调用。
 *  `_legacyImmediate`：bundle 老签名第三参占位，lodash 4 非对象第三参走默认双缘。 */
export function throttle<ArgsT extends any[]>(fn: (...args: ArgsT) => void, wait: number, _legacyImmediate?: boolean): Throttled<ArgsT> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let previous: number | null = null;
  let pendingArgs: ArgsT | null = null;
  const throttled = ((...args: ArgsT) => {
    const now = Date.now();
    if (previous === null || now - previous >= wait) {
      // 窗外（首调或窗口已过）：leading 立即执行，撤销未决 trailing
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      pendingArgs = null;
      previous = now;
      fn(...args);
      return;
    }
    // 窗内：记录最后一次入参，确保窗尾补发一次
    pendingArgs = args;
    if (timer === null) {
      const remaining = wait - (now - previous);
      timer = setTimeout(() => {
        timer = null;
        previous = Date.now();
        const a = pendingArgs;
        pendingArgs = null;
        if (a) fn(...a);
      }, remaining);
    }
  }) as Throttled<ArgsT>;
  throttled.cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    previous = null;
    pendingArgs = null;
  };
  throttled.flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
      previous = Date.now();
      const a = pendingArgs;
      pendingArgs = null;
      if (a) fn(...a);
    }
  };
  return throttled;
}
