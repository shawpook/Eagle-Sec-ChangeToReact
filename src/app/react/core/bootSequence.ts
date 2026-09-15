/**
 * F10（m1-f10-bootready）：**单一启动就绪序列**。
 *
 * 背景（修前实测）：`main.tsx` 用
 *   `void import('./core/externalSupplyRegistrar').then(() => { window.__eagleSupplyState = 'ok'; })`
 * 发起跨窗供给注册 —— 动态 import 是解开 ESM 循环的必要手段（不能改回静态 import），
 * 但这个 Promise **从未被 await**；紧随其后的 `bridgeWhenReady()` 就绪判据又只有
 * `!!getDriverApi().mousetrap` 一个字段，与供给注册无关，随后立即执行六域接管。
 * 于是子窗口（viewers/font、viewers/text-editor）与主 UI 驱动脚本（electron/main.cjs）
 * 可能在供给注册完成前调用 `parent.$bodyScope.activateFont` / `scope.copyAsPath`，
 * 经 `callExternal` 拿到 undefined 且**静默失败**（调用方以为动作已执行）。
 *
 * 本模块把启动收敛成唯一 Promise，按依赖顺序执行：
 *   ① 驱动面安装（installDriverApi / installScopeRegistry）
 *   ② 就绪门判据（driver 面身份 + scope 面存在 + driverConditionNames 全部可解析）
 *   ③ 挂载步骤（诊断口 / machinery scope 挂载）+ 六域接管 —— **同步前缀内完成**
 *   ④ 跨窗供给注册（**真正 await** 动态 import，并校验 10/10 注册齐全）
 *   ⑤ 宣告就绪前的终检（driver 面身份未变 / 注册表 / 核心诊断口 / 供给完整性）
 * 全部满足才置 `window.__eagleBootState = 'ready'`；任一环节失败则置 `err:<原因>`、
 * 追加 `window.__eagleBootFailures`、console.error 并 **reject**（不静默降级）。
 *
 * ── 为什么 ③ 在 ④ 之前（与派单要求的「供给注册 → 域接管」字面顺序不同）──
 * 实测（m1-f10-bootready，三组 A/B/D3 闭环）：
 *   · ③④ 都在同步前缀 → `D3_BOOT_RENDER_OK {"boxes":2,"all":2,"cnt":2}`
 *   · 仅 ③ 提前、④ 推迟 → `D3_BOOT_RENDER_FAIL grid boxes timeout`
 *   · 仅 ④ 提前、③ 推迟 → `D3_BOOT_RENDER_FAIL grid boxes timeout`
 * 即启动数据链是「`takeoverLibraryDomain` 内 `ipc.on('app-status-library-loaded')` 注册的
 * **一次性**主进程事件 → 回调体依赖 `applyDataMachineryScope` 挂载的 `w.ScrollbarSaver` /
 * `scope.reload`」。任一侧被推迟到动态 import 之后（实测窗口 300–435ms），事件即永久丢失：
 * `raw` 恒空 → `allData = 0` → `listDone` 恒 false → 网格空。主进程只发一次、不会重放，
 * 故「先 await 供给、再接管」在本架构下不可实现。
 * ①的实质目的仍然满足：供给注册被**真正 await**、先于就绪宣告完成；未就绪窗口内的跨窗
 * 调用按「明确失败」策略可观测（外部供给调用抛 `ExternalSupplyNotReadyError` + 留痕，
 * 不再静默返回 undefined）。代价见 `core/externalSupply.ts` 的失败策略说明。
 *
 * 零 import：node 侧隔离单测用 transpile + vm 加载本模块并以假依赖驱动全部路径
 * （tests/boot-ready-sequence.mjs），故依赖一律经 `BootOptions` 注入。
 */

export type BootPhase = 'idle' | 'gate' | 'domains' | 'supply' | 'ready' | 'error';

export interface BootStep {
  /** 诊断用的步骤名（进入 `BootDiagnostics.order`，形如 `takeover:preferences`）。 */
  name: string;
  run(): any;
}

export interface BootOptions {
  /** 运行环境（浏览器 window）；缺省取全局 window。 */
  environment?: any;
  /** ① 驱动面安装（`core/driverApi` 的 installDriverApi / `core/scopeFace` 的 installScopeRegistry）。 */
  installDriverApi(): any;
  installScopeRegistry(): any;
  /** 判据读取端：同一实例在接管前后都会被再次读取（身份即判据之一）。 */
  getDriverApi(): any;
  getScopeFace(): any;
  /** ④ 跨窗供给：发起（并等待）动态 import + 注册；幂等由 `core/externalSupply` 的单一 Promise 保证。 */
  loadSupply(): Promise<void>;
  /** 契约名单与已注册名单（`EXTERNAL_SUPPLY_NAMES` / `registeredExternalSupplyNames`）。 */
  supplyNames: readonly string[];
  registeredSupplyNames(): string[];
  /** ③ 挂载（诊断口 / machinery scope 挂载）——须与域接管同在同步前缀内，见头部说明。 */
  mountSteps: readonly BootStep[];
  /** ③ 域接管（六域）。 */
  takeoverSteps: readonly BootStep[];
  /** ②/⑤ 驱动面必备字段（默认 `['mousetrap']`）；字段值为假即视为未就绪。 */
  driverConditionNames?: readonly string[];
  /** 轮询调度（默认 setTimeout）；测试注入同步调度器。 */
  schedule?(run: () => void, ms: number): any;
  /** 就绪门最大轮询次数（默认 100）与间隔（默认 200ms），与改造前的 bridgeWhenReady 一致。 */
  maxAttempts?: number;
  intervalMs?: number;
}

export interface BootDiagnostics {
  phase: BootPhase;
  /** 就绪门轮询次数（1 = 首次判定即通过）。 */
  attempts: number;
  startedAt: number;
  readyAt: number | null;
  error: string | null;
  /** 实际执行序：driverApi / gate / mount:<name> / takeover:<name> / supply / ready|error。 */
  order: string[];
  missing: { driver: string[]; supply: string[] };
  counts: { mount: number; takeover: number };
}

/** 启动未就绪（门超时 / 供给不完整 / 终检不通过）——与「代码抛错」区分开的显式原因。 */
export class BootNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BootNotReadyError';
  }
}

let bootPromise: Promise<void> | null = null;
let diagnostics: BootDiagnostics = createDiagnostics();

function createDiagnostics(): BootDiagnostics {
  return {
    phase: 'idle', attempts: 0, startedAt: 0, readyAt: null, error: null,
    order: [], missing: { driver: [], supply: [] }, counts: { mount: 0, takeover: 0 },
  };
}

/** 诊断快照（深拷贝，调用方改动不影响内部状态）。 */
export function bootDiagnostics(): BootDiagnostics {
  return {
    ...diagnostics,
    order: [...diagnostics.order],
    missing: { driver: [...diagnostics.missing.driver], supply: [...diagnostics.missing.supply] },
    counts: { ...diagnostics.counts },
  };
}

/** 取错误信息：不依赖 `instanceof Error` —— 跨 realm（iframe / contextBridge / 单测 vm）的
 *  Error 不会被本 realm 的 instanceof 认领，若回落到 String() 会把 'Error: ' 前缀带进诊断文案。 */
function messageOf(error: unknown): string {
  const message = (error as any)?.message;
  if (typeof message === 'string' && message) return message;
  return String(error);
}

function logError(...args: any[]): void {
  if (typeof console !== 'undefined' && typeof console.error === 'function') console.error(...args);
}

/**
 * 启动就绪 Promise（**唯一**）：重复调用返回同一个 Promise，不重复安装/注册/接管。
 * 失败时 reject；重复调用观察同一失败，不重跑（避免「重试成功」掩盖真实失败）。
 */
export function startBoot(options: BootOptions): Promise<void> {
  if (!bootPromise) bootPromise = runBoot(options);
  return bootPromise;
}

function setBootState(env: any, value: string): void {
  if (env) env.__eagleBootState = value;
}

function recordFailure(env: any, message: string): void {
  if (!env) return;
  const failures = env.__eagleBootFailures || (env.__eagleBootFailures = []);
  failures.push({ at: Date.now(), message, order: [...diagnostics.order] });
}

/** ② 门判据：驱动面身份 + scope 面存在 + 必备字段可解析（不止 mousetrap 一项）。 */
function missingDriverConditions(env: any, options: BootOptions, names: readonly string[]): string[] {
  const missing: string[] = [];
  const api = options.getDriverApi();
  if (!api || api.__eagleDriver !== true) missing.push('driverApi');
  if (env && env.__eagleDriver !== api) missing.push('window.__eagleDriver');
  if (!options.getScopeFace()) missing.push('scopeFace');
  for (const name of names) {
    if (api && !api[name]) missing.push(name);
  }
  return missing;
}

/** ⑤ 终检判据：接管完成后不得被改写，且供给面仍然完整。 */
function missingFinalConditions(env: any, options: BootOptions): string[] {
  const missing: string[] = [];
  const api = options.getDriverApi();
  if (!api || api.__eagleDriver !== true) missing.push('driverApi');
  if (env && env.__eagleDriver !== api) missing.push('window.__eagleDriver:identity');
  if (env && !env.__eagleScopeRegistry) missing.push('window.__eagleScopeRegistry');
  if (env) {
    if (!env.__eagleCoreState) missing.push('window.__eagleCoreState');
    else if (env.__eagleCoreState !== options.getScopeFace()) missing.push('window.__eagleCoreState:identity');
  }
  if (!options.getScopeFace()) missing.push('scopeFace');
  for (const name of options.supplyNames) {
    if (!options.registeredSupplyNames().includes(name)) missing.push(`supply:${name}`);
  }
  return missing;
}

async function runBoot(options: BootOptions): Promise<void> {
  const env: any = options.environment || (typeof window !== 'undefined' ? window : undefined);
  const schedule = options.schedule || ((run: () => void, ms: number) => setTimeout(run, ms));
  const conditionNames = options.driverConditionNames || ['mousetrap'];
  const maxAttempts = options.maxAttempts ?? 100;
  const intervalMs = options.intervalMs ?? 200;

  diagnostics.startedAt = Date.now();
  setBootState(env, 'booting');
  if (env) env.__eagleBootDiagnostics = bootDiagnostics;
  try {
    // ① 驱动面安装（同步前缀，与改造前 bridgeWhenReady 的调用位置语义一致）
    options.installDriverApi();
    options.installScopeRegistry();
    diagnostics.order.push('driverApi');

    // ② 就绪门：判据全部满足才继续（原实现只看 mousetrap，现为显式判据表）
    diagnostics.phase = 'gate';
    for (let attempt = 0; ; attempt += 1) {
      diagnostics.attempts = attempt + 1;
      diagnostics.missing.driver = missingDriverConditions(env, options, conditionNames);
      if (diagnostics.missing.driver.length === 0) break;
      if (attempt >= maxAttempts) {
        throw new BootNotReadyError(`驱动面判据超时未满足：${diagnostics.missing.driver.join(', ')}`);
      }
      await new Promise<void>((resolve) => { schedule(resolve, intervalMs); });
    }
    diagnostics.order.push('gate');

    // ③ 挂载 + 域接管：**必须与驱动面安装同处一个同步前缀**（中间不得有 await）。
    //    六域接管在注册处即挂上主进程的一次性启动事件监听（app-status-library-loaded 等），
    //    推迟到动态 import 之后就永久收不到 → 库数据不落 raw（见头部实测说明）。
    //    实测真实栈 attempts===1（mousetrap 由 miscRawState 默认面供给），故本前缀与
    //    main.tsx 的尾部求值处在同一 tick；若门被迫轮询（异常装配），风险与改造前的
    //    bridgeWhenReady 同源，且此时 `__eagleBootState` 停在 'booting' 供诊断，不静默。
    diagnostics.phase = 'domains';
    for (const step of options.mountSteps) {
      step.run();
      diagnostics.counts.mount += 1;
      diagnostics.order.push(`mount:${step.name}`);
    }
    for (const step of options.takeoverSteps) {
      step.run();
      diagnostics.counts.takeover += 1;
      diagnostics.order.push(`takeover:${step.name}`);
    }

    // ④ 跨窗供给：动态 import **真正被 await** —— 子窗口/驱动脚本可用的前提。
    //    import 由 main.tsx 在模块求值期（与本前缀同刻）发起，此处 await 的是同一 Promise。
    diagnostics.phase = 'supply';
    try {
      await options.loadSupply();
    } catch (error) {
      // 装载失败（chunk 拉取失败 / 注册不完整）统一收敛为「未就绪」这一类原因。
      throw new BootNotReadyError(`跨窗供给装载失败：${messageOf(error)}`);
    }
    diagnostics.missing.supply = options.supplyNames.filter(
      (name) => !options.registeredSupplyNames().includes(name),
    );
    if (diagnostics.missing.supply.length) {
      throw new BootNotReadyError(`跨窗供给注册不完整：${diagnostics.missing.supply.join(', ')}`);
    }
    diagnostics.order.push('supply');

    // ⑤ 宣告就绪前的终检
    const unmet = missingFinalConditions(env, options);
    if (unmet.length) throw new BootNotReadyError(`宣告就绪前判据未满足：${unmet.join(', ')}`);

    diagnostics.phase = 'ready';
    diagnostics.readyAt = Date.now();
    diagnostics.order.push('ready');
    setBootState(env, 'ready');
    if (env) env.__eagleBootReady = true;
  } catch (error) {
    const message = messageOf(error);
    diagnostics.phase = 'error';
    diagnostics.error = message;
    diagnostics.order.push('error');
    setBootState(env, `err:${message}`);
    recordFailure(env, message);
    logError('[boot] 启动就绪失败：' + message, error);
    throw error instanceof Error ? error : new BootNotReadyError(message);
  }
}
