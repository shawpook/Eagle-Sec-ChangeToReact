/**
 * b1-9bb：侧栏服务 —— updateSidebarList 热点收编。
 *
 * 实现体仍在 machinery（dataMachinery.machineryUpdateSidebarList，20ms 防抖重建
 * s.sidebarList 扁平节点表）；本模块是**组件侧唯一入口**（此前 8 处直呼 scope 属性）。
 * S2 侧栏竖切把实现体迁入本模块（连 getFolderList/getSmartFolderList/getQuickAccessList
 * 三个派生函数）并退役 scope 挂载。
 */
import { getBodyScope } from '../global/scopeBridge';

export function updateSidebarList(): void {
  const s = getBodyScope();
  if (s && typeof s.updateSidebarList === 'function') s.updateSidebarList();
}
