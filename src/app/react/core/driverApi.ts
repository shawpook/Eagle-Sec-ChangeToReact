/**
 * b1-9bz-E5-2：跨边界供给面（`window.$bodyScope` 的去 Angular 化替代）。
 *
 * 消费方与用途：
 *  - `electron/main.cjs`（主窗 + 预览窗驱动脚本，**非 ESM 无法 import**）：读库状态
 *    （raw/selected/current/itemMappings/inspector/…）与调动作（updateSelection/enterDetailMode/…）；
 *  - `frontend/public/shims.js`（浏览器/冒烟 harness）：详情交付门控包装 enterDetailMode/leaveDetailMode、
 *    读 current/raw/itemMappings 等；
 *  - 子窗口（viewers）经 `parent.__eagleDriver` 驱动主窗（activateFont/selectPrev/…）。
 *
 * 与旧 `$bodyScope` 的差别：**显式白名单**（下列 DATA/ACTION），不是开放的 scope 对象；
 * 无 `$root`/`$parent`/`$watch` 等 Angular 方法面；`$evalAsync` 仅为兼容提交钩子（no-op）。
 *
 * 后端两级：
 *  ① 已注册到 store 注册表的字段（数据面 + `notify` 等）→ 直连 store（读 `read()`、写 `write(v)`）；
 *  ② 未注册的运行时**函数挂载**（machineryInfra 的 `s.xxx = fn`，如 updateSelection/zoom/
 *     activateFont 等）→ 回落 `scopeFace.getScopeFace()` 的同名属性（`plain` 槽，无 store 登记）。
 *  ②与旧 `$bodyScope` 行为等价，且保证 E5-4 删除 window 别名后这些挂载仍由本面承接。
 */
import { getMigratedScopeField } from './scopeFieldBridge';
import { getScopeFace } from './scopeFace';

/** 跨边界读的状态字段（主窗/预览窗驱动 + shims 实际消费面）。 */
const DATA_FIELDS = [
  'raw', 'images', 'allData', 'all', 'shuffle', 'trash', 'folders', 'smartFolders',
  'selected', 'selectedMappings', 'selectedFolders', 'selectedSmartFolders',
  'current', 'currentFolder', 'currentSmartFolder', 'itemMappings', 'folderMappings',
  'modifiedMappings', 'lockedImages', 'duplicateMappings',
  'inspector', 'TagManager', 'preferences', 'containerSize', 'imageSize',
  'uploadQueue', 'finishQueue', 'listDone', 'viewMode', 'isDetailMode', 'isInlineMode',
  'useMpvPlayer', 'initDetailMode', 'isCropMode', 'isGrayscaleMode', 'isSlideshowMode',
  'showDetailImage', 'theme', 'language', 'platform', 'libraryImagesPath', 'libraryPath',
  'goalTotal', 'canUseTouchID', 'UrlStateService', 'subFolderSortableOptions', 'mousetrap',
];

/** 跨边界可调的动作（machineryInfra 挂载的函数面 + externalSupply 供给）。 */
const ACTION_FIELDS = [
  'updateSelection', 'zoom', 'changeStar', 'removeSelected', 'toggleAll', 'selectNext',
  'selectPrev', 'enterDetailMode', 'leaveDetailMode', 'notify', 'reload', 'onDropContainer',
  'activateFont', 'deactivateFont', 'isFontActivate', 'escHandler', 'copyAsPath', 'getRawPath',
  'getRawUrl', 'select', 'addImagesToFolder', 'startDrag', 'openWithDefault', 'openWithFinder',
  'copyImage', 'rebindRefresh', 'scrollToSelectedItem', 'quicklook', 'copyImages',
];

let driverApi: any = null;

/** 构建并返回驱动供给面（单例）；字段读写委托 store 注册表，未注册者回落内部 scope 面。 */
export function getDriverApi(): any {
  if (driverApi) return driverApi;
  const api: any = {
    __eagleDriver: true,
    // 旧 shim 的 shim-only 分支判据（machineryInfra 用）；语义 = 「非 Angular/bundle 世界」。
    __eagleShim: true,
    // 兼容提交钩子：store 订阅即时生效，无需 digest flush（驱动/测试按旧契约仍可调用）。
    $evalAsync: (_fn?: any) => undefined,
  };
  const define = (name: string): void => {
    Object.defineProperty(api, name, {
      configurable: true,
      enumerable: true,
      get() {
        const m = getMigratedScopeField(name);
        return m ? m.read() : getScopeFace()[name];
      },
      set(v: any) {
        const m = getMigratedScopeField(name);
        if (m) m.write(v);
        else getScopeFace()[name] = v;
      },
    });
  };
  for (const name of [...DATA_FIELDS, ...ACTION_FIELDS]) define(name);
  driverApi = api;
  return api;
}

/** 安装到 window（main.tsx 启动期调用一次；子窗口 entry 亦调用以承接 parent 驱动）。 */
export function installDriverApi(): any {
  const api = getDriverApi();
  (window as any).__eagleDriver = api;
  return api;
}
