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
  // b1-9bz-E5-3：viewer iframe（font/text-editor/gif）经 parent 面读取的字段
  'imagesDir', 'gifViewer', 'subFolders',
];

/** 跨边界可调的动作（machineryInfra 挂载的函数面 + externalSupply 供给）。 */
export const ACTION_FIELDS = [
  'updateSelection', 'zoom', 'changeStar', 'removeSelected', 'toggleAll', 'selectNext',
  'selectPrev', 'enterDetailMode', 'leaveDetailMode', 'notify', 'reload', 'onDropContainer',
  'activateFont', 'deactivateFont', 'isFontActivate', 'escHandler', 'copyAsPath', 'getRawPath',
  'getRawUrl', 'select', 'addImagesToFolder', 'startDrag', 'openWithDefault', 'openWithFinder',
  'copyImage', 'rebindRefresh', 'scrollToSelectedItem', 'quicklook', 'copyImages',
  // F08（m1-f08f09-actions）：字体查看器改造名 + 评级快捷键族的**跨窗**动作。
  // 消费方在 `viewers/font/entry.tsx`（iframe 内，无 ESM 通道）与 `viewers/text-editor/entry.tsx`，
  // 经 `parent.__eagleDriver` 读本面。修前这三族**不在本白名单**，`parentCall` 的
  // `typeof === 'function'` 守卫恒假 → 改名与 0–5 星全部静默无反应（调研报告 §A-1）。
  // 供给见 `core/machineryInfra.ts` 的 `callExternal` 惰性包装 + `core/externalSupplyRegistrar.ts` 注册。
  'imagesChange', 'removeStar',
  'changeTo1Star', 'changeTo2Star', 'changeTo3Star', 'changeTo4Star', 'changeTo5Star',
];

const ACTION_FIELD_SET: ReadonlySet<string> = new Set(ACTION_FIELDS);

/**
 * F08/F09：白名单动作读取时的**非静默**失败面。
 *
 * 缺陷背景：本白名单是静态字面量，与供给面**没有任何运行期关联**——白名单里有名字、
 * scope 面却没挂载时，getter 静默返回 `undefined`，消费方（子窗 `parentCall` 的
 * `typeof === 'function'` 守卫、驱动脚本的裸调）要么静默跳过、要么抛 TypeError 被上层
 * `runInBodyScope` 吞掉。调研报告 §A-3 记录的 10 项即由此而来。
 *
 * 现策略（报告 §E-4 建议 1）：对 `ACTION_FIELDS` 成员，getter 取到非函数值时
 *   ① `console.error('[driverApi] action missing supply:', name, …)` —— 稳定前缀，可 grep；
 *   ② 计入 `window.__eagleDriverMissingActions`（含缺失时的启动状态），供冒烟断言为空。
 *
 * **只在启动就绪后上报**：启动窗口期内供给尚未装载，此时缺失是预期态而非缺陷；
 * 且每个动作名只上报一次，避免属性读取路径刷屏。
 *
 * `DATA_FIELDS` 不参与——它们的 `null`/`undefined` 存在合法空态（`current` 为空即合法）。
 */
const reportedMissingActions = new Set<string>();

function reportMissingDriverAction(name: string, value: any): void {
  if (reportedMissingActions.has(name)) return;
  const w = typeof window !== 'undefined' ? (window as any) : undefined;
  if (w && w.__eagleBootState !== 'ready') return;
  reportedMissingActions.add(name);
  const bootState = w ? (w.__eagleBootState ?? null) : null;
  const supplyState = w ? (w.__eagleSupplyState ?? null) : null;
  if (w) {
    const list = w.__eagleDriverMissingActions || (w.__eagleDriverMissingActions = []);
    list.push({ name, at: Date.now(), valueType: typeof value, bootState, supplyState });
  }
  console.error('[driverApi] action missing supply:', name,
    `(白名单动作 ${name} 解析为 ${typeof value}；__eagleBootState=${bootState}，__eagleSupplyState=${supplyState})`);
}

/** 当前白名单中**解析不到函数**的动作名（空数组 = 白名单与供给面一致）。纯查询，不上报、无副作用。 */
export function collectMissingDriverActions(): string[] {
  return ACTION_FIELDS.filter((name) => {
    const m = getMigratedScopeField(name);
    const value = m ? m.read() : getScopeFace()[name];
    return typeof value !== 'function';
  });
}

/**
 * 显式断言：白名单动作全部有真实供给，否则抛出可定位的错误。
 * 供启动后自检 / 冒烟 / 新增动作时自证使用（对应「缺必需动作时不能安静返回」）。
 */
export function assertDriverActionsSupplied(): void {
  const missing = collectMissingDriverActions();
  if (missing.length) {
    throw new Error(`[driverApi] 白名单动作缺供给（${missing.length}/${ACTION_FIELDS.length}）：${missing.join(', ')}`);
  }
}


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
        const value = m ? m.read() : getScopeFace()[name];
        // F08/F09：白名单动作解析不到函数时**不静默**（见 reportMissingDriverAction 注释）。
        if (ACTION_FIELD_SET.has(name) && typeof value !== 'function') reportMissingDriverAction(name, value);
        return value;
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
