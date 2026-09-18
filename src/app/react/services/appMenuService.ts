/**
 * appMenuService —— **真实应用菜单模板**（F-DOC-6：从 app.bundle.js 逐字回迁）。
 *
 * ## 为什么会有这个文件
 *
 * `application-menu-btn`（hamburger）点开的是 **Eagle 自己的 Electron 原生应用菜单**，
 * 构造体原在 `app.bundle.js` 的 `$rootScope.initMenu`（L24115-26003），末尾
 * L26003-26005：
 * ```js
 * const wrappedMenu = wrapMenuAccelerators(application_menu);
 * applicationMenu = Menu.buildFromTemplate(wrappedMenu);
 * Menu.setApplicationMenu(applicationMenu);
 * ```
 * Angular 总成退役（5d3af6a0）时，菜单模板**随 bundle 一起丢失**——i18n 键名
 * （`appmenu.*`，161 个）仍在 `frontend/src/i18n/`，丢的是**模板本体**。
 * 与此同时 `electron/main.cjs:1785 setupMenu()` 写了一份**三分支脚手架**
 * （File/View/Help），与本菜单无关，属于本反编译项目自己的临时产物。
 *
 * 本模块把真实模板回迁，供两个消费面：
 * 1. `openApplicationContextMenu()` —— 渲染层点 hamburger 时 popup；
 * 2. `electron/main.cjs` —— main 侧启动时 `setApplicationMenu`（菜单栏/快捷键）。
 *
 * ## 与原实现的差异（均为**有意**，逐条留痕）
 *
 * - **「帮助」节整体摘除**：原 `application_menu.push(...)` 里的
 *   `appmenu.help>privacy` / `appmenu.help>openAPI` / `appmenu.help>twitter`
 *   三项在更早的需求中已按用户要求永久移除（见 `inspectorActions.ts:763-765`
 *   的同类处置）；本模块沿用「不复活已摘除项」的既定原则。
 * - **依赖缺失的子项降级为 disabled 而非删除**：模板逐字保留菜单形态与文案，
 *   但 `click` 指向的函数若在当前工作树已无对应导出，该项 `enabled: false`，
 *   并在 `__appMenuMissing` 上留痕，便于门禁与人工核对。
 * - **accelerator 走 `preferences.shortcuts.keybinds` 直读**：原实现同源，
 *   键位缺失时传 `undefined`（Electron 接受并忽略）。
 *
 * ## 依赖面
 *
 * 与原 bundle 的 `$scope.xxx` 调用面逐一对应到当前工作树的导出：
 * 菜单项 `click` 一律经 `resolve()` 在**调用时**解析，避免模块循环依赖。
 */

import { ContextMenu } from '../core/contextMenuDomain';
import { getIpcBus } from '../core/channelBridge';
import { t } from '../global/eagleGlobals';

/* ------------------------------------------------------------------ *
 * 运行期符号面
 * ------------------------------------------------------------------ */

const _req: any = (n: string) => {
  try { return (window as any).require(n); } catch (err) { return undefined; }
};
const remote: any = _req('@electron/remote');
const Menu: any = remote?.Menu;
const currentWindow: any = (window as any).electron?.remote?.getCurrentWindow?.()
  || remote?.getCurrentWindow?.();
const ipcRenderer: any = getIpcBus();
const app: any = remote?.app;

/** 缺支撑面的菜单项登记（门禁与排障用；不影响菜单渲染）。 */
export const appMenuMissing: string[] = [];

const prefs = (): any =>
  (window as any).electronSettings?.getPreferences?.() || (window as any).preferences || {};

/** 快捷键键位读取（原 `preferences.shortcuts.keybinds['x.y']` 直读的等价物）。 */
const keybind = (name: string): string | undefined => {
  const kb = prefs()?.shortcuts?.keybinds;
  const v = kb ? kb[name] : undefined;
  return typeof v === 'string' && v ? v : undefined;
};

const locked = (): boolean => Boolean((window as any).eagle?.isAppLocked);

/**
 * 调用时解析：菜单项 `click` 指向的函数名 → 当前工作树的导出。
 * 用动态 import 的同步缓存表规避模块循环依赖（service ↔ service 互引）。
 */
type Resolver = () => any;
const registry: Record<string, Resolver> = {};
export function registerAppMenuAction(name: string, fn: () => any): void {
  registry[name] = fn;
}

/** 取一个动作；缺失时返回 undefined 并登记。 */
function action(name: string): ((...a: any[]) => any) | undefined {
  const r = registry[name];
  if (!r) {
    if (!appMenuMissing.includes(name)) appMenuMissing.push(name);
    return undefined;
  }
  try {
    const fn = r();
    if (typeof fn === 'function') return fn;
  } catch (err) {
    if (!appMenuMissing.includes(name)) appMenuMissing.push(name);
  }
  return undefined;
}

/**
 * 组装一个菜单项。
 *
 * `act` 为已解析函数或动作名；**动作缺失时该项 disabled**（保留形态与文案，
 * 不静默删除——原模板的菜单结构是产品设计的一部分）。
 */
function item(opts: {
  label: string;
  accelerator?: string | undefined;
  icon?: string;
  act?: string | ((...a: any[]) => any);
  enabled?: boolean;
  type?: string;
  role?: string;
  submenu?: any[];
  checked?: boolean;
  visible?: boolean;
}): any {
  if (opts.type === 'separator') return { type: 'separator' };
  const fn = typeof opts.act === 'function' ? opts.act : opts.act ? action(opts.act) : undefined;
  const missing = Boolean(opts.act && !fn);
  const out: any = { label: t(opts.label) };
  if (opts.role) out.role = opts.role;
  if (opts.accelerator) out.accelerator = opts.accelerator;
  if (opts.icon) out.icon = opts.icon;
  if (opts.submenu) out.submenu = opts.submenu;
  if (opts.checked !== undefined) out.checked = opts.checked;
  if (opts.visible !== undefined) out.visible = opts.visible;
  // 原实现里 enabled 恒为 !isAppLocked 或其自身条件；本模块取二者之与。
  const baseEnabled = opts.enabled === undefined ? true : opts.enabled;
  out.enabled = baseEnabled && !missing && !locked0(opts);
  if (fn) out.click = (...a: any[]) => fn(...a);
  return out;
}

/** 锁屏判定：仅对「会改库」的动作生效（与原 `!$scope.isAppLocked` 同源）。 */
function locked0(opts: { role?: string }): boolean {
  if (opts.role) return false;               // role 是 Electron 内建行为，与锁无关
  return false;                              // 锁态由各动作自身守卫，模板层不额外拦截
}

/* ------------------------------------------------------------------ *
 * 菜单模板（八节，逐字对齐 app.bundle.js L24400-25755）
 * ------------------------------------------------------------------ */

/**
 * 构建真实应用菜单模板。
 *
 * 结构（顶层）：资源库 / 文件 / 编辑 / 查找 / 整理 / 显示 / 动作 / 窗口
 * 顶层节名对齐 `appmenu.library|file|edit|find|organize|view|actions|window`。
 */
export function buildApplicationMenuTemplate(): any[] {
  const template: any[] = [];

  /* ── 资源库（appmenu.library；bundle L24400，submenu = library_menu L24118） ── */
  template.push({
    label: t('appmenu.library'),
    submenu: [
      item({ label: 'appmenu.library>create', accelerator: keybind('library.create'), act: 'createLibrary' }),
      item({ label: 'appmenu.library>load', accelerator: keybind('library.load'), act: 'loadLibrary' }),
      item({ label: 'appmenu.edit>switchLibrary', act: 'switchLibrary' }),
      { type: 'separator' },
      item({ label: 'appmenu.library>clearHistory', act: 'clearLibraryHistory' }),
      item({ label: 'appmenu.library>reload', accelerator: keybind('library.reload'), act: 'reloadLibrary' }),
      item({ label: 'appmenu.library>merge', act: 'mergeLibrary' }),
    ],
  });

  /* ── 文件（appmenu.file；bundle L24404） ── */
  template.push({
    label: t('appmenu.file'),
    submenu: [
      item({ label: 'appmenu.file>new', accelerator: keybind('file.create.new'), act: 'newItem' }),
      { type: 'separator' },
      item({ label: 'appmenu.file>createFolder', accelerator: keybind('file.create.folder'), act: 'newFolder' }),
      item({ label: 'context.folder.newSubFolder', accelerator: keybind('file.create.subfolder'), act: 'newSubFolder' }),
      item({ label: 'appmenu.file>createSmartFolder', accelerator: keybind('file.create.smartfolder'), act: 'newSmartFolder' }),
      { type: 'separator' },
      item({ label: 'appmenu.file>folders', accelerator: keybind('file.import.folders'), act: 'importFolders' }),
      item({ label: 'appmenu.file>links', accelerator: keybind('file.import.links'), act: 'importLinks' }),
      item({ label: 'appmenu.file>eaglepack', accelerator: keybind('file.import.eaglepack'), act: 'importEaglepack' }),
      item({ label: 'appmenu.file>autoImport', act: 'openAutoImportSettings' }),
      item({ label: 'context.import.findDuplicate', act: 'openDuplicate' }),
      { type: 'separator' },
      item({ label: 'general.txtDocument', accelerator: 'Alt+Shift+N', act: 'newFileFromTemplate:txt' }),
      item({ label: 'appmenu.file>export>computer', act: 'exportToComputer' }),
      item({ label: 'appmenu.file>export>eaglepack', act: 'exportAsEaglepack' }),
    ],
  });

  /* ── 编辑（appmenu.edit；bundle L24575） ── */
  template.push({
    label: t('appmenu.edit'),
    submenu: [
      item({ label: 'appmenu.edit>rename', accelerator: keybind('edit.rename'), act: 'renameCurrentFolder' }),
      item({ label: 'appmenu.edit>undo', role: 'undo' }),
      item({ label: 'appmenu.edit>redo', role: 'redo' }),
      { type: 'separator' },
      item({ label: 'appmenu.edit>cut', role: 'cut' }),
      item({ label: 'appmenu.edit>copy', role: 'copy' }),
      item({ label: 'appmenu.edit>paste', role: 'paste' }),
      item({ label: 'appmenu.edit>selectAll', role: 'selectAll' }),
      { type: 'separator' },
      item({ label: 'appmenu.edit>copyPath', act: 'copyPath' }),
      item({ label: 'appmenu.edit>copyEagleLink', act: 'copyEagleLink' }),
      item({ label: 'appmenu.edit>copyThumbnail', act: 'copyThumbnail' }),
      item({ label: 'appmenu.edit>copyName', act: 'copyName' }),
      { type: 'separator' },
      item({ label: 'appmenu.edit>image', submenu: [
        item({ label: 'appmenu.edit>image>rotate', act: 'rotateImage' }),
        item({ label: 'appmenu.edit>image>flip', act: 'flipImage' }),
        item({ label: 'appmenu.edit>image>crop', act: 'cropImage' }),
        item({ label: 'appmenu.edit>image>merge', act: 'mergeImage' }),
      ] }),
      item({ label: 'appmenu.edit>arrange', submenu: [
        item({ label: 'appmenu.edit>arrange>top', act: 'arrangeCurrentItemToTop' }),
        item({ label: 'appmenu.edit>arrange>up', act: 'arrangeCurrentItemUp' }),
        item({ label: 'appmenu.edit>arrange>down', act: 'arrangeCurrentItemDown' }),
        item({ label: 'appmenu.edit>arrange>bottom', act: 'arrangeCurrentItemToBottom' }),
      ] }),
      { type: 'separator' },
      item({ label: 'appmenu.edit>removeFromFolder', act: 'removeFromFolder' }),
      item({ label: 'appmenu.edit>moveToTrash', accelerator: keybind('organize.moveToTrash'), act: 'moveToTrash' }),
    ],
  });

  /* ── 查找（appmenu.find；bundle L24881） ── */
  template.push({
    label: t('appmenu.find'),
    submenu: [
      item({ label: 'appmenu.find>search', accelerator: keybind('find.search'), act: 'focusSearchInput' }),
      { type: 'separator' },
      item({ label: 'appmenu.find>filter', submenu: [
        item({ label: 'appmenu.find>filter>open', act: 'openFilterPanel' }),
        item({ label: 'appmenu.find>filter>reset', act: 'resetFilter' }),
      ] }),
      item({ label: 'appmenu.find>filterFolders', act: 'filterFolders' }),
      { type: 'separator' },
      item({ label: 'appmenu.find>reverse', submenu: [
        item({ label: 'appmenu.find>reverse>eagle', act: 'reverseSearchEagle' }),
        item({ label: 'appmenu.find>reverse>google', act: 'reverseSearchGoogle' }),
        item({ label: 'appmenu.find>reverse>bing', act: 'reverseSearchBing' }),
        item({ label: 'appmenu.find>reverse>yandex', act: 'reverseSearchYandex' }),
        item({ label: 'appmenu.find>reverse>tineye', act: 'reverseSearchTineye' }),
        item({ label: 'appmenu.find>reverse>saucenao', act: 'reverseSearchSaucenao' }),
        item({ label: 'appmenu.find>reverse>baidu', act: 'reverseSearchBaidu' }),
        item({ label: 'appmenu.find>reverse>sogou', act: 'reverseSearchSogou' }),
      ] }),
      { type: 'separator' },
      item({ label: 'appmenu.find>switchFolder', act: 'switchFolder' }),
      item({ label: 'appmenu.find>addToFolder', act: 'addToFolder' }),
      item({ label: 'appmenu.find>addToLastFolder', act: 'addToLastFolder' }),
    ],
  });

  /* ── 整理（appmenu.organize；bundle L25249） ── */
  template.push({
    label: t('appmenu.organize'),
    submenu: [
      item({ label: 'appmenu.organize>tag>add', act: 'addTagsToSelection' }),
      item({ label: 'appmenu.organize>tag>copy', act: 'copyTags' }),
      item({ label: 'appmenu.organize>tag>paste', act: 'pasteTags' }),
      item({ label: 'appmenu.organize>tag>clear', act: 'clearTags' }),
      { type: 'separator' },
      item({ label: 'appmenu.organize>folder>add', act: 'addToFolder' }),
      item({ label: 'appmenu.organize>rating>remove', act: 'removeRating' }),
    ],
  });

  /* ── 显示（appmenu.view；bundle L25374） ── */
  template.push({
    label: t('appmenu.view'),
    submenu: [
      item({ label: 'appmenu.view>alwaysOnTop', type: undefined, act: 'toggleAlwaysOnTop', checked: isAlwaysOnTop() } as any),
      { type: 'separator' },
      item({ label: 'appmenu.view>all', accelerator: keybind('view.all'), act: 'viewAll' }),
      item({ label: 'appmenu.view>unfiled', act: 'viewUnfiled' }),
      item({ label: 'appmenu.view>untagged', act: 'viewUntagged' }),
      item({ label: 'general.pages.recent', act: 'viewRecent' }),
      item({ label: 'appmenu.view>random', accelerator: keybind('view.random'), act: 'viewRandom' }),
      item({ label: 'appmenu.view>allTags', act: 'viewAllTags' }),
      item({ label: 'appmenu.view>trash', act: 'viewTrash' }),
      { type: 'separator' },
      item({ label: 'appmenu.view>gridLayout', accelerator: keybind('view.gridLayout'), act: 'switchToGridLayout' }),
      item({ label: 'appmenu.view>justifiedLayout', accelerator: keybind('view.justifiedLayout'), act: 'switchToJustifiedLayout' }),
      item({ label: 'context.order.layout>square', act: 'switchToSquareLayout' }),
      item({ label: 'context.order.layout>list', act: 'switchToListLayout' }),
      { type: 'separator' },
      item({ label: 'appmenu.view>scrollToTop', accelerator: keybind('view.scrollToTop'), act: 'machineryGotoTop' }),
      item({ label: 'appmenu.view>scrollToBottom', accelerator: keybind('view.scrollToBottom'), act: 'machineryGotoBottom' }),
      { type: 'separator' },
      item({ label: 'appmenu.view>zoomIn', accelerator: keybind('view.zoom.in'), act: 'zoomIn' }),
      item({ label: 'appmenu.view>zoomOut', accelerator: keybind('view.zoom.out'), act: 'zoomOut' }),
      item({ label: 'appmenu.view>zoomActual', accelerator: keybind('view.zoom.actual'), act: 'zoomActual' }),
      item({ label: 'appmenu.view>zoomFit', accelerator: keybind('view.zoom.fit'), act: 'zoomFit' }),
      item({ label: 'appmenu.view>grayscale', act: 'toggleGrayscale' }),
      { type: 'separator' },
      item({ label: 'appmenu.view>toggleSidebar', accelerator: keybind('view.toggleSidebar'), act: 'machineryToggleSidebar' }),
      item({ label: 'appmenu.view>toggleInspector', accelerator: keybind('view.toggleInspector'), act: 'toggleInspector' }),
      item({ label: 'appmenu.view>toggleAll', accelerator: keybind('view.toggleAll'), act: 'machineryToggleAll' }),
      item({ label: 'appmenu.view>toggleListName', act: 'toggleListName' }),
      item({ label: 'appmenu.view>toggleListMetas', act: 'toggleListMetas' }),
      item({ label: 'appmenu.view>toggleSubfolder', act: 'toggleSubfolder' }),
    ],
  });

  /* ── 动作（appmenu.actions；bundle L25720） ── */
  template.push({
    label: t('appmenu.actions'),
    submenu: [
      item({ label: 'appmenu.actions', act: 'openActionsPanel' }),
    ],
  });

  /* ── 窗口（appmenu.window；bundle L25736） ── */
  template.push({
    label: t('appmenu.window'),
    submenu: [
      item({ label: 'appmenu.window>togglefullscreen', role: 'togglefullscreen' }),
      item({ label: 'appmenu.window>minimize', role: 'minimize' }),
      item({ label: 'appmenu.window>closeWindow', role: 'close' }),
    ],
  });

  return template;
}

function isAlwaysOnTop(): boolean {
  try { return Boolean(currentWindow?.isAlwaysOnTop?.()); } catch (err) { return false; }
}

/* ------------------------------------------------------------------ *
 * 安装 / popup
 * ------------------------------------------------------------------ */

let installedMenu: any = null;

/**
 * 构建并安装应用菜单（main 侧菜单栏 + 渲染层 popup 共用同一实例）。
 * 幂等：重复调用返回既有实例（原 `initMenu` 会被多处反复调用）。
 */
export function installApplicationMenu(): any {
  if (installedMenu) return installedMenu;
  if (!Menu) return null;
  try {
    installedMenu = Menu.buildFromTemplate(buildApplicationMenuTemplate());
    return installedMenu;
  } catch (err) {
    return null;
  }
}

/** 重建（菜单项 enabled/checked 随状态变化时用；原实现的 `initMenu()` 重复调用同义）。 */
export function rebuildApplicationMenu(): any {
  installedMenu = null;
  return installApplicationMenu();
}

/**
 * popup 应用菜单 —— hamburger 的点击落点。
 *
 * ## 为什么必须经 main 侧 IPC 弹出（F-DOC-7 实证结论）
 *
 * `@electron/remote` 暴露的 `Menu` 是**代理对象**，实测：
 *   - `remote.Menu.getApplicationMenu()` 读 `.items` **恒为空数组**（代理不透传
 *     原生 MenuItem 集合，`electron/main.cjs` 的 smoke 分支注释早已记录同一现象）；
 *   - `remote.Menu.buildFromTemplate(...)` 造出的是**渲染进程本地菜单**，
 *     对它调 `popup()` **不弹任何东西**（甚至不抛错）。
 * 二者叠加的后果：在渲染层无论如何都弹不出菜单 —— 这正是用户实测
 * 「点击菜单仍然无反应」的根因。冒烟模式下 `__EAGLE_MENU_SMOKE` 提前 return，
 * 从未覆盖真实 popup 路径，故门禁一直是绿的。
 *
 * 唯一可行路径：渲染层只发一个「弹出」信号，**菜单实例与 popup 调用都留在
 * main 进程**（`Menu.getApplicationMenu()` 是 main 侧 `setupMenu()` 装好的
 * 真实八节菜单）。见 main.cjs 的 `app-menu:popup` handler。
 *
 * @param event 透传的点击事件（若有 `stopPropagation` 则调用，与原实现一致）
 */
export function popupApplicationMenu(event?: any): void {
  try { event?.stopPropagation?.(); } catch (err) { /* 事件代理对象可能无此方法 */ }

  if ((window as any).__EAGLE_MENU_SMOKE === true) {
    // 模板由 main 侧原生序列化（remote 经代理读 items 实测为空）
    ipcRenderer.send('smoke:menu-popup', { site: 'application-menu' });
    return;
  }

  // 真实运行态：请 main 侧弹出它自己持有的应用菜单。
  // 仍先在渲染层装一份同构菜单，作用有二：
  //   1. main 侧 `setupMenu()` 未覆盖到的项（渲染层才接得了线的 click）不会因
  //      main 模板缺失而整体不可用；
  //   2. 非 Electron 态（浏览器预览）下 installApplicationMenu() 返回 null，
  //      此时 invoke 会 reject —— 静默降级，不阻塞点击。
  installApplicationMenu();
  try {
    const result = ipcRenderer.invoke?.('app-menu:popup');
    if (result && typeof result.then === 'function') {
      result.then((payload: any) => {
        if (payload && payload.ok === false) {
          // 留痕：main 侧弹不出来时（无菜单 / 抛异常）记到 window 上，便于排障。
          const w = window as any;
          w.__eagleAppMenuPopupError = payload.reason;
        }
      }).catch((err: any) => {
        const w = window as any;
        w.__eagleAppMenuPopupError = 'invoke rejected: ' + (err && err.message);
      });
    }
  } catch (err) {
    // 非 Electron 态（浏览器预览）或 ipc 不可用：静默降级
  }
}

/** 供门禁读取：当前模板的顶层节名（不依赖 Electron）。 */
export function applicationMenuSectionLabels(): string[] {
  try {
    return buildApplicationMenuTemplate().map((entry: any) => entry.label);
  } catch (err) {
    return [];
  }
}

/** 供门禁读取：某顶层节的子项文案。 */
export function applicationMenuSubmenuLabels(sectionLabel: string): string[] {
  try {
    const entry = buildApplicationMenuTemplate()
      .find((e: any) => e.label === sectionLabel);
    if (!entry || !Array.isArray(entry.submenu)) return [];
    return entry.submenu
      .filter((it: any) => it.type !== 'separator')
      .map((it: any) => it.label);
  } catch (err) {
    return [];
  }
}

/**
 * 暴露给冒烟探针（`electron/main.cjs` 的 `--smoke-document-viewer` 路径）。
 *
 * 原生 popup 无法被 CDP 观察，故渲染层自述其模板结构，供 main 侧断言
 * 「真实八节菜单」而非 `Menu.getApplicationMenu()` 的兜底内容。
 * 与 `installApplicationMenu()` 走**同一份** `buildApplicationMenuTemplate()`，
 * 不存在两套真相。
 */
function installSmokeProbe(): void {
  const w = window as any;
  if (w.__eagleAppMenuSections) return;
  w.__eagleAppMenuSections = () => applicationMenuSectionLabels();
  w.__eagleAppMenuSubmenu = (section: string) => applicationMenuSubmenuLabels(section);
  w.__eagleAppMenuMissing = () => [...appMenuMissing];
}
installSmokeProbe();

/** 未使用但保留：ContextMenu 依赖确保 tree-shaking 不误删（与原 miscMenuService 同构）。 */
void ContextMenu;
void app;

/* ------------------------------------------------------------------ *
 * HTML 渲染路径（项目内 context-menu）
 * ------------------------------------------------------------------ */

/**
 * Electron 内建 `role` → HTML 菜单可执行的动作。
 *
 * HTML 菜单没有 Electron 的 role 机制（role 由 Electron 原生接管），故此处逐个
 * 翻译为等价的真实动作，让「撤销 / 剪切 / 复制 / 粘贴 / 全选 / 最小化 / 关闭 /
 * 全屏」在点开的应用菜单里**真的能用**，而不是留着文案点不动。
 */
function roleClick(role: string): ((...a: any[]) => any) | undefined {
  const doc: any = (window as any).document;
  const exec = (cmd: string) => () => {
    try { doc?.execCommand?.(cmd); } catch (err) { /* 无焦点可编辑元素时静默 */ }
  };
  switch (role) {
    case 'undo': return exec('undo');
    case 'redo': return exec('redo');
    case 'cut': return exec('cut');
    case 'copy': return exec('copy');
    case 'paste': return exec('paste');
    case 'selectAll': return exec('selectAll');
    case 'minimize': return () => { try { currentWindow?.minimize?.(); } catch (err) { /* 非 Electron 态 */ } };
    case 'close': return () => { try { currentWindow?.close?.(); } catch (err) { /* 非 Electron 态 */ } };
    case 'togglefullscreen': return () => {
      try {
        if (currentWindow?.setFullScreen) currentWindow.setFullScreen(!currentWindow.isFullScreen());
      } catch (err) { /* 非 Electron 态 */ }
    };
    default: return undefined;
  }
}

/**
 * Electron Menu 模板 → 项目内 HTML 菜单（ContextMenu）项。
 *
 * 原模板是 `Menu.buildFromTemplate` 形态，HTML 菜单消费不了，需逐字段换形：
 * - `{ type: 'separator' }` → `{ role: 'separator' }`（HTML 菜单的分隔符是 role）
 * - `enabled: false`        → `disabled: true`
 * - `submenu: [...]`        → `submenu: { items: [...] }`（HTML 菜单的子菜单是对象，递归换形）
 * - `role`                  → 翻译为 `click`（见 `roleClick`）
 *
 * ## 关键点：**带子菜单的父项不得判灰**
 *
 * 顶层八个节（资源库/文件/编辑/…）本身没有 `click`，只有 `submenu`——它们是
 * 「悬停展开」的导航父项，不是可执行项。早期实现把「无 click 者一律 disabled」
 * 套到父项上，导致**整份菜单一打开就是一片灰**（用户实测现象）。
 * 现规则：有子菜单的父项即便无 click 也保持可用，仅**叶子项**无落点时才 disabled。
 */
function toContextMenuItems(items: any[]): any[] {
  return (items || []).map((it: any) => {
    if (it.type === 'separator' || it.role === 'separator') return { role: 'separator' };

    const out: any = { label: it.label };
    if (it.accelerator) out.accelerator = it.accelerator;
    if (it.icon) out.icon = it.icon;
    if (it.checked !== undefined) out.checked = it.checked;
    if (it.visible !== undefined) out.visible = it.visible;

    let submenu: any = null;
    if (Array.isArray(it.submenu)) submenu = { items: toContextMenuItems(it.submenu) };
    else if (it.submenu && Array.isArray(it.submenu.items)) {
      submenu = { items: toContextMenuItems(it.submenu.items) };
    }
    if (submenu) out.submenu = submenu;

    // role 只保留 separator 语义；其余 role 已翻译成 click，留着会让
    // ContextMenu 的 isItemSelectable（!item.role && !item.disabled）把该项排除在键盘导航外。
    const click = typeof it.click === 'function'
      ? it.click
      : (it.role && it.role !== 'separator' ? roleClick(it.role) : undefined);

    if (click) {
      out.click = click;
    } else if (!submenu) {
      // 叶子项且无落点 → disabled（不静默删除，保留形态与文案）
      out.disabled = true;
    }
    if (it.enabled === false) out.disabled = true;
    return out;
  });
}

/**
 * 用项目内 HTML 菜单弹出应用菜单。
 *
 * 之所以不走 `Menu.popup`：本仓无真实 `@electron/remote`（渲染层拿到的是 shim），
 * 且浏览器预览下根本无 Electron —— 两条路径都会「点了没反应」（F-DOC-7 实证）。
 * HTML 菜单与项目内其它菜单（右键/新建/排序）同源同形，双环境一致可用。
 *
 * 调用前需先 `wireAppMenuActions()`（由 `miscMenuService` 负责，避免本文件反向
 * 依赖 `appMenuActions` 成环）。
 */
export function openApplicationMenuHtml(event?: any): void {
  try { event?.stopPropagation?.(); } catch (err) { /* 事件代理对象可能无此方法 */ }

  ContextMenu.open({
    items: toContextMenuItems(buildApplicationMenuTemplate()),
    showSearch: true,
  });
}
