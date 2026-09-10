/**
 * b1-9bz-B-8：测试观测钩子。
 *
 * 背景：`controllerFns` 的 fns 表（236 项指针注册表）与 `shimFnsBridge`
 * （`attachCoreFnsToShim`，bundle 缺席时把表 if-absent 挂上 shim）在 B8 一并退役——
 * B4/B5/B6 之后消费面已全部直 import，表仅剩「测试契约」一个用途。
 *
 * 本模块把测试需要的落点导出**显式**暴露到 `window.__eaglePorts`，替代原先
 * 借道 fns 表的 `window.__eagleCoreFns`：
 *   · 每个名字都是模块级 export 的**同对象引用**（与组件侧 import 的完全一致）；
 *   · **不含任何运行期供给语义** —— 应用代码不读取本表，也不参与 scope 挂载；
 *   · 口径刻意收窄到「测试实际断言/驱动的名字」，不再是 236 项全量镜像。
 *
 * 覆盖两类用途：
 *   ① 功能断言：stage1c3 的 cancelAllTasks / changeOrderBy / switchGridLayout / cleanSelected；
 *   ② 面板/菜单驱动入口：stage7a（openItemContextMenu）、stage7d1a（addToFolders）、
 *      menu-popup-closed-loop（四个 open*ContextMenu）—— 这些测试原以 `$bodyScope.X()`
 *      作为驱动入口，B8 后 scope 面不再供给 TABLE-only 名，故改走本钩子。
 *
 * 退役条件：相关测试改为纯 DOM 闭环断言后，本模块随之删除。
 */
import { cancelAllTasks } from '../services/uploadService';
import { addToFolders, cleanSelected } from '../services/batchOpsService';
import { changeOrderBy } from './miscDomain';
import { switchGridLayout } from '../services/viewOpsService';
import { openItemContextMenu } from '../services/itemMenuService';
import { openApplicationContextMenu } from '../services/miscMenuService';
import { openFolderContextMenu, openSmartFolderContextMenu } from '../services/folderMenuService';
import { openFolderExpandContextMenu } from '../services/sidebarService';

export function installPortsProbe(): void {
  (window as any).__eaglePorts = {
    cancelAllTasks,
    changeOrderBy,
    switchGridLayout,
    cleanSelected,
    openItemContextMenu,
    addToFolders,
    openApplicationContextMenu,
    openFolderContextMenu,
    openFolderExpandContextMenu,
    openSmartFolderContextMenu,
  };
}
