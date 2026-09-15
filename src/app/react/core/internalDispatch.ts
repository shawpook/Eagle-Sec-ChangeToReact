/**
 * F09（m1-f08f09-actions）：主窗内部字符串派发的**非静默**失败面。
 *
 * 背景：App 内多处遗留 `scope[fn]` / `call('name')` 式派发。凡目标名**已被迁移为具名函数**的，
 * 一律改为直 import（见 `core/viewOpenActions.ts` 与各组件改动）；但调研报告 §A-2 里另有
 * 一批名字**在全树根本没有实现**（未移植，而非未挂载）——`resetKeyword`、`toggleTagLayout`、
 * `seachKeyup` 族、`onDropFolder` 族等。
 *
 * 这些占位调用原先一律 `if (typeof target !== 'function') return/continue;` **静默通过**，
 * 使得「未移植」与「已实现只是没挂上」在运行期无法区分——正是 F08 那类缺陷得以长期潜伏的机制。
 *
 * 现策略：保留调用点（删除会丢失迁移线索），但命中缺失时调用本模块上报 ——
 *   ① `console.error('[internal-dispatch] unmigrated action:', name, site)`，稳定前缀可 grep；
 *   ② 计入 `window.__eagleUnmigratedActions`（`{name, site, at}`），供冒烟/诊断断言。
 *
 * 每个「动作名 @ 调用点」只上报一次，避免事件回调刷屏。
 */

const reported = new Set<string>();

/** 记录一次「字符串派发命中未迁移动作」。返回 true 表示这是首次上报（调用方可据此决定是否继续）。 */
export function reportUnmigratedAction(name: string, site: string): boolean {
  const key = `${name}@${site}`;
  if (reported.has(key)) return false;
  reported.add(key);
  const w = typeof window !== 'undefined' ? (window as any) : undefined;
  if (w) {
    const list = w.__eagleUnmigratedActions || (w.__eagleUnmigratedActions = []);
    list.push({ name, site, at: Date.now(), bootState: w.__eagleBootState ?? null });
  }
  console.error('[internal-dispatch] unmigrated action:', name, `（调用点 ${site}；该动作在全树无具名实现，属未移植项）`);
  return true;
}

/** 当前已上报的未迁移动作快照（冒烟/测试用；不触发上报）。 */
export function unmigratedActions(): Array<{ name: string; site: string; at: number }> {
  const w = typeof window !== 'undefined' ? (window as any) : undefined;
  return w && Array.isArray(w.__eagleUnmigratedActions) ? w.__eagleUnmigratedActions.slice() : [];
}
