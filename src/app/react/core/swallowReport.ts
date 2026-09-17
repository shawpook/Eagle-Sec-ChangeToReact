/**
 * R1-4 · 被吞掉的错误集中上报通道。
 *
 * 背景：2026-09-17 验收报告 R1-4 指出仓内生产代码存在 545 处空 `catch`。
 * 分类后绝大多数是「顶层兜底」（资源清理、日志、可选能力探测），失败不影响业务结果；
 * 但有一批会让「操作实际失败了、界面却毫无反应」——这一批必须可观测。
 *
 * 本模块提供统一的、自身绝不抛错的上报通道。三条硬约束：
 *
 *   1. **零 import**。必须能在 renderer / worker 任一上下文转译后独立运行，
 *      也才能被测试用 `vm` 完全隔离地装载（见 tests/swallow-report.mjs）。
 *   2. **自身永不抛错**。上报失败绝不能反过来影响业务——内部每一步都包了 try。
 *   3. **必须限流**。仓内存在逐帧渲染路径上的 catch（如 GIF 逐帧绘制），
 *      无脑上报等于制造日志洪水。故同一 key 默认只真上报前 3 次，之后仅累加计数；
 *      全局真上报总数亦有上限。所有被吞错误仍完整进入环形缓冲，可被查询。
 */

export interface SwallowRecord {
  key: string;
  message: string;
  count: number;
  firstAt: number;
  lastAt: number;
}

/** 同一个 key 最多真上报几次（超出后只计数，不再打日志） */
const PER_KEY_REPORT_LIMIT = 3;
/** 全局真上报总数上限，兜住 worst case */
const TOTAL_REPORT_LIMIT = 200;
/** 环形缓冲容量：保留最近 N 个不同 key 的记录 */
const RING_CAPACITY = 100;

const counts = new Map<string, number>();
const ring: SwallowRecord[] = [];
let totalReported = 0;

function now(): number {
  try {
    return Date.now();
  } catch {
    return 0;
  }
}

function safeStringify(value: unknown): string {
  try {
    return String(JSON.stringify(value)).slice(0, 200);
  } catch {
    return '(不可序列化)';
  }
}

function describe(err: unknown): string {
  try {
    if (typeof err === 'string') return err;
    if (err === undefined || err === null) return '(无错误对象)';
    // 先按鸭子类型取 message，再退回 instanceof。
    // 原因：跨 realm（vm 沙箱、iframe、worker）里 `err instanceof Error` 会因
    // 构造函数不同而为 false，导致错误信息丢失——这里绝不能依赖 instanceof。
    const maybe = err as { message?: unknown; name?: unknown };
    if (typeof maybe.message === 'string' && maybe.message) return maybe.message;
    if (err instanceof Error) return err.name || 'Error';
    if (typeof maybe.name === 'string' && maybe.name) return maybe.name;
    const text = String(err);
    return text === '[object Object]' ? safeStringify(err) : text;
  } catch {
    return '(错误信息不可读)';
  }
}

function emit(key: string, message: string): void {
  const line = `[swallowed] ${key}: ${message}`;
  try {
    const g: any = typeof globalThis !== 'undefined' ? (globalThis as any) : undefined;
    const win = g && g.window;
    const log = win && (win.electronLog || win.__electronLog);
    if (log && typeof log.warn === 'function') {
      log.warn(line);
      return;
    }
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn(line);
    }
  } catch {
    /* @swallow: 上报通道自身失败必须静默——否则"上报"这件事会反过来搞挂业务，
       这正是本模块存在的意义。此处吞错是该模块契约的一部分，不是遗漏。 */
  }
}

/**
 * 上报一个被吞掉的错误。
 *
 * @param key 稳定标识，建议用 `模块名.函数名.动作`，例如 `fileUrlHelper.getThumbnailUrl`。
 *            必须是稳定字面量，不要拼接运行期变量，否则限流与去重会失效。
 * @param err 原始错误对象，可省略。
 */
export function reportSwallowed(key: string, err?: unknown): void {
  try {
    const next = (counts.get(key) || 0) + 1;
    counts.set(key, next);

    const stamp = now();
    const message = describe(err);
    let record: SwallowRecord | undefined;
    for (let i = 0; i < ring.length; i += 1) {
      if (ring[i].key === key) {
        record = ring[i];
        break;
      }
    }
    if (!record) {
      record = { key, message, count: 0, firstAt: stamp, lastAt: stamp };
      ring.push(record);
      if (ring.length > RING_CAPACITY) ring.shift();
    }
    record.count = next;
    record.lastAt = stamp;
    record.message = message;

    if (next <= PER_KEY_REPORT_LIMIT && totalReported < TOTAL_REPORT_LIMIT) {
      totalReported += 1;
      emit(key, message);
    }
  } catch {
    /* @swallow: 同 emit——上报逻辑绝不允许向外抛异常，否则被调用方捕获后
       会改变业务控制流。这条 try 就是本模块"自身永不抛错"契约的兜底。 */
  }
}

/** 供测试与诊断查询：被吞错误的总次数、真上报次数、以及各 key 的明细。 */
export function getSwallowedStats(): {
  total: number;
  reported: number;
  records: SwallowRecord[];
} {
  try {
    let total = 0;
    counts.forEach((value) => {
      total += value;
    });
    return { total, reported: totalReported, records: ring.map((r) => ({ ...r })) };
  } catch {
    return { total: 0, reported: 0, records: [] };
  }
}

/** 仅用于测试：清空计数与缓冲。 */
export function resetSwallowedStats(): void {
  try {
    counts.clear();
    ring.length = 0;
    totalReported = 0;
  } catch {
    /* @swallow: 仅供测试使用的清零，失败无影响（下一次调用仍会重新建立状态）。 */
  }
}

// 挂在全局，供遗留 `src/app/js/**`（非 ESM，无法 import）以守卫式调用。
// 遗留层调用形如：`window.__eagleReportSwallowed && window.__eagleReportSwallowed(key, err)`
try {
  (globalThis as any).__eagleReportSwallowed = reportSwallowed;
  } catch {
    /* @swallow: 极老沙箱无 globalThis，挂不上就算了；遗留层调用点本身是守卫式的，
       不会因此报错，只是降级为不上报。 */
  }
