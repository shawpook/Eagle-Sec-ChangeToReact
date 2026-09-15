/**
 * F09（m1-f08f09-actions）：视图切换动作的**单一具名定义点**。
 *
 * 为什么单独成模块：这 8 个「打开某个平铺视图」的动作（全部 / 未分类 / 未加标签 / 最近 /
 * 随机 / 社群 / 全部标签 / 回收站）此前在 Sidebar 与 Toolbar 各有一份**字符串派发**：
 *   · `Sidebar.tsx` 的 `SIMPLE_OPEN_DIRECT` 表（已直调化）与兜底 `s[meta.open] && s[meta.open]()`；
 *   · `Toolbar.tsx` 的 `callSeq([…], ['openUntagged'])` 等 —— 目标名**在 scope 面上从未挂载**
 *     （只登记在已退役的字符串路由表里），`typeof target !== 'function'` 静默 `continue`
 *     → 「未加标签 / 最近 / 回收站」等页签点击后除 URL 外无任何反应（调研报告 §A-2）。
 *
 * 本模块把这些动作的**唯一实现**集中成具名函数：调用方 `import { openView }` 直调，
 * 不再经 `scope[name]` 二次解析。这符合 F09「应用内部一律直 import 具名 action，
 * 需要跨边界的才走受检 registry」——视图切换是**同一 ESM 图内的伪边界**，故不进 registry。
 *
 * 未知名字**不静默**：抛 `UnmigratedViewActionError`（带动作名与可用名单），
 * 对应「缺必需动作时必须显式失败」。
 */

import { machineryOpenRecent, machineryOpenTrash, machineryOpenUnfiled } from './libraryDomain';
import { machineryOpenAllTags, machineryOpenUntagged } from './tagManagerDomain';
import { machineryOpenAll, machineryOpenCommunity, machineryOpenRandom } from '../services/folderCoreService';

/** `SIMPLE_META[*].open` 使用的稳定动作名（与 `store/sidebarState` 的 vstype 一一对应）。 */
export const VIEW_OPEN_ACTIONS = {
  openAll: () => machineryOpenAll(undefined, undefined),
  openUnfiled: () => machineryOpenUnfiled(undefined),
  openUntagged: () => machineryOpenUntagged(undefined),
  openRecent: () => machineryOpenRecent(undefined),
  openRandom: () => machineryOpenRandom(undefined, undefined),
  openCommunity: () => machineryOpenCommunity(undefined),
  openAllTags: () => machineryOpenAllTags(undefined),
  openTrash: () => machineryOpenTrash(undefined),
} as const;

export type ViewOpenName = keyof typeof VIEW_OPEN_ACTIONS;

/** 视图切换动作名不匹配任何已迁移实现时的显式失败（前缀稳定，可直接 grep）。 */
export class UnmigratedViewActionError extends Error {
  readonly action: string;

  constructor(action: string) {
    super(`[view-open-action] 未迁移的视图切换动作：${action}`
      + `（已迁移：${Object.keys(VIEW_OPEN_ACTIONS).join(', ')}）`);
    this.name = 'UnmigratedViewActionError';
    this.action = action;
  }
}

/** 具名调用入口——唯一的视图切换派发点（替代 `scope[fn]` 动态下标）。 */
export function openView(name: ViewOpenName): void {
  const action = VIEW_OPEN_ACTIONS[name] as (() => void) | undefined;
  if (typeof action !== 'function') throw new UnmigratedViewActionError(String(name));
  action();
}
