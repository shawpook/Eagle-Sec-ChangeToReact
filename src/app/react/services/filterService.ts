

import { machineryFilterContent } from '../core/filterDomain';
/**
 * b1-9bi：筛选服务 —— filterRules 数值规则写面 + 订阅中心。
 *
 * 替代 filterDomain 的 12 个 `eagle.filter.*` 字符串 watcher（scopeShim 轮询式变更探测
 * → 显式订阅）。setFilterRule 是被 watch 的 12 条数值路径（file/duration/bpm 的 min/max、
 * shape 的 width/height、resolution 的 minW/maxW/minH/maxH）的**唯一写路径**：
 * 镜像写 eagle.filter.filterRules[group][key]（scope 世界读者不变）+ 通知订阅者；
 * filterDomain 订阅后转 filterContent（shape 组保留 width&&height 双条件原语义）。
 * 其他规则（color/tag/folder/type 的点击序列）不经此——它们自带 filterContent 触发链。
 */

export type FilterRuleListener = (group: string, key: string) => void;

const listeners = new Set<FilterRuleListener>();

/** 订阅规则变更（返回退订函数）。 */
export function onFilterRuleChange(listener: FilterRuleListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 写数值规则并通知（scope 侧 eagle.filter.filterRules 同步镜像，读者零改动）。 */
export function setFilterRule(group: string, key: string, value: any): void {
  const w = window as any;
  const f = w.eagle && w.eagle.filter;
  if (!f || !f.filterRules) return;
  if (!f.filterRules[group]) f.filterRules[group] = {};
  f.filterRules[group][key] = value;
  for (const listener of Array.from(listeners)) {
    try {
      listener(group, key);
    } catch (err) {
      console.error('[filterService] rule listener failed', err);
    }
  }
}

/** React 直调便捷面：写规则后触发一次 filterContent（无订阅依赖的独立调用面）。 */
export function setFilterRuleAndApply(group: string, key: string, value: any): void {
  setFilterRule(group, key, value);
  machineryFilterContent();
}

// 闭环测试（CDP Runtime.evaluate）可直接访问（b1-9bi 起 setFilterRule 是 12 条数值
// 路径的唯一写路径，测试经此触发订阅链），不参与业务逻辑。
(window as any).__eagleFilterService = { setFilterRule, onFilterRuleChange, listenerCount: () => listeners.size };
