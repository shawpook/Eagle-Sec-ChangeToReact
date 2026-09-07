/**
 * b1-9bn：contextMenuDomain —— 菜单族共享域（controllerFns b1-9q 段整迁）。
 *
 * 居民（全部逐字，仅 export 化）：
 * - URL_MODULE：bundle 顶层 const（fileUrlHelper 同款惰性解析）
 * - getContextMenu()：原模块常量 ContextMenu（bundle 15836-15843；angular.element("html")
 *   .scope() → scope 桥（正文同形）—— 根 scope 广播 CONTEXTMENU.OPEN/CLOSE，React
 *   ContextMenuPanel $on 消费）。bo 批该频道切 eagleBus 时，发射端在此集中切换。
 * - renameImages：bundle 41480-41495（bare event 为 bundle window.event 怪癖逐字保留）
 * - openWithApplicationPath：bundleGlobals 若缺的等价兜底（正常路径 window 供给）
 */
// @ts-nocheck
import { getBodyScope } from '../global/scopeBridge';

// URL_MODULE（bundle 顶层 const；fileUrlHelper.ts 同款惰性解析）
export const URL_MODULE: any = (() => {
  const req = (window as any).require;
  if (typeof req !== 'function') return (window as any).URL_MODULE;
  const appRoot = (window as any).appRoot;
  const rootPath = appRoot && (appRoot.path || appRoot);
  if (rootPath) { try { return req(`${rootPath}/my_modules/url`); } catch (err) {} }
  try { return req('url'); } catch (err) { return (window as any).URL_MODULE; }
})();

// ContextMenu（bundle 15836-15843 逐字；angular.element("html").scope() → scope 桥——
// 根 scope 广播，React ContextMenuPanel 经 $on('CONTEXTMENU.OPEN') 消费）
const _legacyContextMenu: any = {
  open(options: any) {
    const root: any = getBodyScope();
    root && root.$broadcast && root.$broadcast('CONTEXTMENU.OPEN', options);
  },
  close() {
    const root: any = getBodyScope();
    root && root.$broadcast && root.$broadcast('CONTEXTMENU.CLOSE');
  },
};

// renameImages（bundle 41480-41495 逐字；$scope→scope 桥。bare event 为 bundle
// window.event 怪癖逐字保留——Chromium 下 bare 标识符经全局回退读到 window.event）
export function renameImages() {
  const s: any = getBodyScope();
  if (!s) return;
  if (s.selected.length > 1) {
    s.$root.$broadcast('OPEN_RENAME', {
      type: 'IMAGE',
      images: s.selected,
    });
  }
  else {
    var imageId = s.selected[0].id;
    var $box = $(`#box-${imageId}`);
    if ($box.length > 0) {
      setTimeout(() => {
        enableImageNameEditable(event, $box.find('.name'));
      }, 50);
    }
  }
}

/* ContextMenu（bundle 15836-15843 逐字；export 化）——bo 批频道切 eagleBus 时发射端集中在此 */
export const ContextMenu: any = _legacyContextMenu;
export function getContextMenu(): any { return ContextMenu; }

/** openWithApplicationPath（bundleGlobals w.openWithApplicationPath 的模块直取面） */
export function openWithApplicationPath(appPath: any, filePath: any, image: any): void {
  const w: any = window as any;
  if (typeof w.openWithApplicationPath === 'function') {
    w.openWithApplicationPath(appPath, filePath, image);
    return;
  }
  try {
    const req: any = w.require;
    const wElectron: any = req('electron');
    wElectron?.shell?.openPath?.(appPath);
  } catch (err) { /* noop */ }
}
