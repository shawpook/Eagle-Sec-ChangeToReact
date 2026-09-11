import { getBodyScope } from '../core/appCore';

import { machineryCalculateImageBinding } from '../core/itemDomain';
/**
 * b1-9bb：网格索引绑定服务 —— calculateImageBinding 热点收编。
 *
 * 实现体仍在 machinery（dataMachinery.machineryCalculateImageBinding，1/50ms 双时长
 * 防抖退避后从 s.raw 全量重算 all/untagged/trash/folderMappings/itemMappings 等
 * 12 个索引字段并调 callback）；本模块是**组件侧唯一入口**（此前 8 处直呼 scope
 * 属性）。数据底座级耦合（sortRawData/TagManager/pinyinCache/getFilter）——实现体
 * 随 S1 网格竖切评估迁入或保留至 P4 终审。
 */

export function calculateImageBinding(params?: any, callback?: () => void): void {
  const s = getBodyScope();
  if (s) machineryCalculateImageBinding(s, params, callback);
}
