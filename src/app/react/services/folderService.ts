import { getBodyScope } from '../core/appCore';

import { machinerySaveFolder } from '../core/libraryDomain';
/**
 * b1-9bb：文件夹服务 —— saveFolder 热点收编。
 *
 * 实现体仍在 machinery（dataMachinery.machinerySaveFolder：cloneTree 克隆 s.folders，
 * 对 folders/smartFolders/TagManager.groups/quickAccess 白名单字段投影 + 日文浊音
 * NFC 正规化，经 ipc 'folders-change' 持久化整库；另有 saveFolderDebounce 1s 防抖
 * 包装仍在 scope 侧）；本模块是**组件侧唯一入口**（此前 15 处直呼 scope 属性）。
 * 纯 I/O 边界、无 s.* 写——S5 菜单/CRUD 竖切把实现体迁入本模块并退役 scope 挂载。
 */

export function saveFolder(): void {
  const s = getBodyScope();
  if (s && typeof s.saveFolder === 'function') machinerySaveFolder();
}
