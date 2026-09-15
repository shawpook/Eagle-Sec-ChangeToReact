// b1-9bz-C-0：跨窗口 / 驱动脚本所需的 scope 面供给，改用**延迟注册**而非静态 import。
//
// 背景：b1-9bz-B-8 退役 fns 表后，子窗口（viewers/font、viewers/text-editor）经
// `parent.$bodyScope.X()` 驱动父窗、主 UI 驱动脚本（electron/main.cjs）经 `scope.X()`
// 驱动，这两处跨边界调用无法直 import，必须由 scope 面供给。B8 当时在
// `applyDataMachineryScope` 里直接静态 import 这些 service —— 但当时的 dataMachinery 是全树
// 依赖汇点，新增 import 边会改变 ESM 求值顺序（service 模块体在 dataMachinery 完成前
// 执行，其顶层读到的 dataMachinery 导出为 undefined），导致启动加载链断裂：
// allData 不填充、listDone 不置位。
//
// 解法：供给方只依赖本模块（零依赖、无副作用），真正的函数由入口在启动后注册进来。
// 挂载点改为运行期查表，语义不变。
// 注（b1-9bz-D-1 B-final，2026-09-11）：`dataMachinery.ts` 已删除，职责拆入各域模块；
// 新的汇点/挂载入口为 `core/machineryInfra.ts`（applyDataMachineryScope 等），
// 本模块的延迟注册契约不变。
// 注（F10，m1-f10-bootready）：本模块**零 import**（原文件顶部那条
// `import { applyDataMachineryScope } from './machineryInfra'` 从未被本文件使用，且与
// machineryInfra → externalSupply 形成无意义环，一并删除）——零依赖使本模块可被启动序列
// 与 node 侧隔离单测直接加载（tests/boot-ready-sequence.mjs）。

/**
 * 跨窗 / 驱动脚本依赖的供给名单 —— **单一事实来源**。
 *
 * 三处共用同一份：① 注册端 `externalSupplyRegistrar`；② 启动就绪判据
 * （`core/bootSequence` 的供给完整性检查）；③ 隔离单测。任一处漏改都会让另两处报错。
 */
export const EXTERNAL_SUPPLY_NAMES = [
  // 子窗口（viewers/font、viewers/text-editor）经 parent 驱动面调用
  'activateFont', 'deactivateFont', 'isFontActivate', 'escHandler',
  // 主 UI 驱动脚本（electron/main.cjs）经 scope 调用
  'addImagesToFolder', 'copyAsPath', 'getRawPath', 'getRawUrl', 'select', 'startDrag',
] as const;

export type ExternalSupplyName = (typeof EXTERNAL_SUPPLY_NAMES)[number];

type AnyFn = (...args: any[]) => any;

const supply: Record<string, AnyFn> = {};

/** 由入口（main.tsx → externalSupplyRegistrar）在启动后调用一次。 */
export function registerExternalSupply(map: Record<string, AnyFn>): void {
  for (const k of Object.keys(map)) {
    if (typeof map[k] === 'function') supply[k] = map[k];
  }
}

/** 契约内尚未注册的供给名（空数组 = 供给面完整）。 */
export function missingExternalSupplyNames(): ExternalSupplyName[] {
  return EXTERNAL_SUPPLY_NAMES.filter((name) => typeof supply[name] !== 'function');
}

/** 契约内已注册的供给名（单一事实来源的顺序，供诊断/测试比对）。 */
export function registeredExternalSupplyNames(): ExternalSupplyName[] {
  return EXTERNAL_SUPPLY_NAMES.filter((name) => typeof supply[name] === 'function');
}

/**
 * F10：供给未就绪时的**可观测**失败。
 *
 * 旧行为（未注册即 `undefined`）让调用方把「父窗还没就绪」当成「动作已执行且无返回值」：
 * 子窗 `parentCall` 的 `typeof === 'function'` 守卫、`main.cjs` 的 `scope.copyAsPath()` 都会
 * 静默通过。现改为显式抛出，并在 `window.__eagleSupplyFailures` 留痕（调用方即使吞掉异常，
 * 冒烟/诊断仍能观测到）。
 */
export class ExternalSupplyNotReadyError extends Error {
  readonly supplyName: string;
  readonly missing: ExternalSupplyName[];

  constructor(name: string, missing: ExternalSupplyName[], context: string) {
    super(`跨窗供给未就绪：${name} 尚未注册（缺失 ${missing.length}/${EXTERNAL_SUPPLY_NAMES.length}：`
      + `${missing.join(', ')}；${context}）`);
    this.name = 'ExternalSupplyNotReadyError';
    this.supplyName = name;
    this.missing = missing;
  }
}

function supplyContext(): string {
  const w = typeof window !== 'undefined' ? (window as any) : undefined;
  if (!w) return '无 window 环境';
  return `__eagleBootState=${w.__eagleBootState ?? '未设置'}，__eagleSupplyState=${w.__eagleSupplyState ?? '未设置'}`;
}

function failNotReady(name: string): never {
  const missing = missingExternalSupplyNames();
  const error = new ExternalSupplyNotReadyError(name, missing, supplyContext());
  const w = typeof window !== 'undefined' ? (window as any) : undefined;
  if (w) {
    const failures = w.__eagleSupplyFailures || (w.__eagleSupplyFailures = []);
    failures.push({
      name, at: Date.now(), missing,
      bootState: w.__eagleBootState ?? null,
      supplyState: w.__eagleSupplyState ?? null,
    });
    // 稳定前缀，便于从 Electron/CDP 冒烟的 console 输出里直接 grep。
    console.error('[external-supply] not-ready', name, error.message);
  }
  throw error;
}

/**
 * 挂载点使用：已注册 → 直调；**契约内名字**未注册 → 抛 `ExternalSupplyNotReadyError`。
 *
 * 契约外名字维持旧语义（返回 undefined）—— 它们不属于跨窗供给面，拼写/装配错误由各自
 * 消费侧自证，不在本次收敛范围。
 */
export function callExternal(name: string, ...args: any[]): any {
  const fn = supply[name];
  if (typeof fn === 'function') return fn(...args);
  if ((EXTERNAL_SUPPLY_NAMES as readonly string[]).includes(name)) failNotReady(name);
  return undefined;
}

export function hasExternalSupply(name: string): boolean {
  return typeof supply[name] === 'function';
}

/**
 * F10：**单一**供给装载 Promise。
 *
 * 动态 import 必须保留（静态 import 会改变 ESM 求值顺序、打断启动链），但必须**真正被
 * await**：本函数把它记忆化成唯一 Promise，重复调用只装载/注册一次（ESM 模块缓存之外的
 * 第二道幂等闸）；装载完成且 10/10 注册齐全才把 `__eagleSupplyState` 置 'ok'。
 *
 * 取值扩展（原只有 'ok' / 'err:*'）：'pending'（已发起）→ 'ok'（10/10 注册完成）
 * / 'err:<message>'（import 失败或注册不完整）。
 */
let supplyLoad: Promise<void> | null = null;

export function loadExternalSupply(importRegistrar: () => Promise<unknown>): Promise<void> {
  if (supplyLoad) return supplyLoad;
  const w = typeof window !== 'undefined' ? (window as any) : undefined;
  if (w) w.__eagleSupplyState = 'pending';
  supplyLoad = Promise.resolve()
    .then(() => importRegistrar())
    .then(() => {
      const missing = missingExternalSupplyNames();
      if (missing.length) throw new Error(`跨窗供给注册不完整，缺少：${missing.join(', ')}`);
      if (w) w.__eagleSupplyState = 'ok';
    })
    .catch((error: any) => {
      if (w) w.__eagleSupplyState = 'err:' + String((error && error.message) || error);
      throw error;
    });
  return supplyLoad;
}

// 诊断面：与 window.__eaglePorts 同类的观测出口，便于冒烟直接确认注册是否完成。
if (typeof window !== 'undefined') {
  (window as any).__eagleExternalSupply = supply;
}
