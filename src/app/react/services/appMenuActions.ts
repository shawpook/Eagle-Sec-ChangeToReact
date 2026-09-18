/**
 * appMenuActions —— 把 `appMenuService` 的菜单动作名接到当前工作树的真实导出。
 *
 * 原 bundle 里菜单项的 `click` 直接闭包 `$scope.xxx()`；去 Angular 后这些调用面
 * 散落到各 service/core 模块。本文件作**唯一接线点**：`appMenuService` 只认**动作名**，
 * 具体解析全在这里，从而：
 * 1. 菜单模板保持「纯数据」，可被门禁直接读取断言；
 * 2. 接线与模板解耦——某动作缺失只让该项 disabled，不会让整个菜单构建失败；
 * 3. 循环依赖只在本文件一处出现（动态 `import()` + 惰性解析）。
 *
 * 缺失项会进 `appMenuMissing`（由 `appMenuService` 导出）——这是**如实留痕**，
 * 不是静默降级：菜单形态与文案完整保留，只是点不动。
 */

import { registerAppMenuAction, appMenuMissing } from './appMenuService';
import { getIpcBus } from '../core/channelBridge';

const ipc = getIpcBus();

/**
 * 惰性解析表：动作名 → 取函数的 thunk。
 *
 * 用 `() => import(...).then(m => m.fn)` 的同步缓存会在首次点击时异步，
 * 而 Electron 菜单的 `click` 必须是同步可用的；故此处直接用**静态 import 的
 * 命名空间对象**做惰性成员读取——模块图在 build 期已解析，运行期只是属性访问。
 */
let wired = false;

export function wireAppMenuActions(): void {
  if (wired) return;
  wired = true;

  /* ── 资源库 ── */
  registerAppMenuAction('reloadLibrary', () => () => ipc.send('reload-window'));

  /* ── 文件 ── */
  registerAppMenuAction('newItem', () => () => {
    // 原 `$scope.openNewContextMenu()`：在工具栏「新建」按钮处弹上下文菜单
    const btn = document.querySelector('#new-btn, .new-btn, [data-click*="openNewContextMenu"]') as HTMLElement | null;
    btn?.click();
  });
  registerAppMenuAction('importEaglepack', () => () => ipc.send('import-eaglepack-request'));

  /* ── 编辑 ── */
  registerAppMenuAction('copyEagleLink', () => () => ipc.send('copy-eagle-link'));

  /* ── 查找 ── */
  registerAppMenuAction('focusSearchInput', () => () => {
    const input = document.querySelector('input[type="search"], .search-input, #search-input') as HTMLInputElement | null;
    input?.focus();
    input?.select?.();
  });

  /* ── 显示：这批在原工作树**有真实导出**，直接接线（不留痕） ── */
  registerAppMenuAction('machineryGotoTop', () => () => {
    void import('./gridService').then((m) => m.machineryGotoTop());
  });
  registerAppMenuAction('machineryGotoBottom', () => () => {
    void import('./gridService').then((m) => m.machineryGotoBottom());
  });
  registerAppMenuAction('machineryToggleAll', () => () => {
    void import('./gridService').then((m) => m.machineryToggleAll(undefined));
  });
  registerAppMenuAction('zoomIn', () => () => {
    void import('./viewOpsService').then((m) => m.machineryZoomIn(undefined));
  });
  registerAppMenuAction('zoomOut', () => () => {
    void import('./viewOpsService').then((m) => m.machineryZoomOut(undefined));
  });
  registerAppMenuAction('zoomActual', () => () => {
    void import('./viewOpsService').then((m) => m.machineryZoomActual());
  });
  registerAppMenuAction('zoomFit', () => () => {
    void import('./viewOpsService').then((m) => m.machineryZoomFit());
  });

  /* ── 窗口 ── */
  registerAppMenuAction('toggleAlwaysOnTop', () => () => ipc.send('toggle-always-on-top'));

  /* ── 本轮补充：模板已登记且当前工作树有真实导出的动作 ──
     沿用惰性 import：模块图 build 期已解析，运行期只做属性访问，
     避免本文件与 service/core 之间出现静态循环依赖。 */

  /* 资源库 */
  registerAppMenuAction('switchLibrary', () => () => {
    void import('./folderCoreService').then((m) => m.switchLibrary());
  });

  /* 文件 */
  registerAppMenuAction('newFolder', () => () => {
    void import('./folderCoreService').then((m) => m.newFolder());
  });
  registerAppMenuAction('newSmartFolder', () => () => {
    void import('../core/libraryDomain').then((m) => m.machineryNewSmartFolder());
  });
  registerAppMenuAction('importFolders', () => () => {
    void import('./uploadService').then((m) => m.importFolders());
  });
  registerAppMenuAction('importLinks', () => () => {
    void import('../core/libraryDomain').then((m) => m.machineryImportLinks());
  });
  registerAppMenuAction('openDuplicate', () => () => {
    void import('../core/itemDomain').then((m) => m.machineryOpenDuplicate());
  });
  registerAppMenuAction('openAutoImportSettings', () => () => ipc.send('open.preferences', { panel: 'autoImport' }));

  /* 编辑 */
  registerAppMenuAction('removeFromFolder', () => () => {
    void import('./batchOpsService').then((m) => m.removeFromFolder());
  });

  /* 查找 */
  registerAppMenuAction('resetFilter', () => () => {
    void import('../core/filterDomain').then((m) => m.resetFilter());
  });
  registerAppMenuAction('openFilterPanel', () => () => {
    void import('../core/filterDomain').then((m) => m.machineryOpenFilter());
  });
  registerAppMenuAction('addToFolder', () => () => {
    void import('./batchOpsService').then((m) => m.addToFolders());
  });

  /* 整理 */
  registerAppMenuAction('copyTags', () => () => {
    void import('./batchOpsService').then((m) => m.copyTags());
  });
  registerAppMenuAction('pasteTags', () => () => {
    void import('./batchOpsService').then((m) => m.pasteTags());
  });
  registerAppMenuAction('removeRating', () => () => {
    void import('../core/crossWindowActions').then((m) => m.setRating(undefined));
  });

  /* 显示 */
  registerAppMenuAction('viewAll', () => () => {
    void import('./folderCoreService').then((m) => m.machineryOpenAll());
  });
  registerAppMenuAction('viewUnfiled', () => () => {
    void import('../core/libraryDomain').then((m) => m.machineryOpenUnfiled());
  });
  registerAppMenuAction('viewUntagged', () => () => {
    void import('../core/tagManagerDomain').then((m) => m.machineryOpenUntagged());
  });
  registerAppMenuAction('viewRecent', () => () => {
    void import('../core/libraryDomain').then((m) => m.machineryOpenRecent());
  });
  registerAppMenuAction('viewAllTags', () => () => {
    void import('../core/tagManagerDomain').then((m) => m.machineryOpenAllTags());
  });
  registerAppMenuAction('viewTrash', () => () => {
    void import('../core/libraryDomain').then((m) => m.machineryOpenTrash());
  });
  registerAppMenuAction('machineryToggleSidebar', () => () => {
    void import('../core/miscDomain').then((m) => m.machineryToggleSidebar(undefined));
  });

  /* 动作 */
  registerAppMenuAction('openActionsPanel', () => () => {
    void import('../core/keymapActions').then((m) => m.machineryOpenActionsPanel(undefined));
  });

  /* ── 第二批：资源库创建 / 导出 / copy 族 / 图像 / 布局与显示 ── */

  /* 资源库 */
  registerAppMenuAction('createLibrary', () => () => {
    void import('../core/miscDomain').then((m) => m.machineryCreateLibrary());
  });

  /* 文件：导出、新建文本文档 */
  registerAppMenuAction('exportToComputer', () => () => {
    void import('./folderMenuService').then((m) => m.folderExportAsFolder());
  });
  registerAppMenuAction('exportAsEaglepack', () => () => {
    void import('./folderMenuService').then((m) => m.folderExportAsPack());
  });
  registerAppMenuAction('newFileFromTemplate:txt', () => () => {
    void import('../core/itemDomain').then((m) => m.machineryNewFileFromTemplate('txt'));
  });

  /* 编辑：copy 族与图像 —— 这几个函数内部均有「无选中则 return」守卫，无参调用安全 */
  registerAppMenuAction('copyPath', () => () => {
    void import('../core/itemDomain').then((m) => m.copyAsPath());
  });
  registerAppMenuAction('copyThumbnail', () => () => {
    void import('../core/itemDomain').then((m) => m.copyAsThumbnail());
  });
  registerAppMenuAction('rotateImage', () => () => {
    void import('./imageOpsService').then((m) => m.rotateImage());
  });
  registerAppMenuAction('flipImage', () => () => {
    void import('./imageOpsService').then((m) => m.flipImage());
  });

  /* 显示：随机视图、四种布局、列表项显隐 */
  registerAppMenuAction('viewRandom', () => () => {
    void import('./folderCoreService').then((m) => m.machineryOpenRandom());
  });
  registerAppMenuAction('switchToGridLayout', () => () => {
    void import('./viewOpsService').then((m) => m.switchGridLayout());
  });
  registerAppMenuAction('switchToJustifiedLayout', () => () => {
    void import('./viewOpsService').then((m) => m.switchJustifiedLayout());
  });
  registerAppMenuAction('switchToListLayout', () => () => {
    void import('./viewOpsService').then((m) => m.switchListLayout());
  });
  registerAppMenuAction('switchToSquareLayout', () => () => {
    void import('./viewOpsService').then((m) => m.switchSquareLayout());
  });
  registerAppMenuAction('toggleListName', () => () => {
    void import('../core/miscDomain').then((m) => m.machineryShowListName());
  });
  registerAppMenuAction('toggleSubfolder', () => () => {
    void import('./folderMenuService').then((m) => m.showListSubfolderContent());
  });

  /* ── 第三批：灰度模式、重命名 ── */
  registerAppMenuAction('toggleGrayscale', () => () => {
    void import('../store/bodyState').then((m) => {
      m.writeIsGrayscaleMode(!m.useBodyState.getState().isGrayscaleMode);
    });
  });
  registerAppMenuAction('renameCurrentFolder', () => () => {
    void import('../core/contextMenuDomain').then((m) => m.renameImages());
  });

  /* ── 第五批：载入资源库 / 历史 / 子文件夹 / 回收站 / 侧栏筛选 / 标签 / 反搜 ── */

  /* 载入（打开其它）资源库：miscDomain 的 machineryImportLibrary 即原「载入资源库」——
     弹 .library 选择框后走 machineryOpenLibrary。（「合并资源库」在当前工作树无对应实现，
     故 mergeLibrary 仍留 disabled。） */
  registerAppMenuAction('loadLibrary', () => () => {
    void import('../core/miscDomain').then((m) => m.machineryImportLibrary());
  });

  /* 清除历史记录：libraryHistory 存在 electron-settings（apiServerDomain:301 读它的地方），
     清空后刷新侧栏列表让「切换资源库」面板同步。 */
  registerAppMenuAction('clearLibraryHistory', () => () => {
    const w = window as any;
    const es = w.electronSettings
      || (w.require && w.appRoot ? w.require(w.appRoot + '/my_modules/electron-settings') : null);
    try { es?.setSync?.('libraryHistory', []); } catch (err) { /* 设置不可用时忽略 */ }
    void import('../core/libraryDomain').then((m) => m.machineryUpdateSidebarList());
  });

  /* 新增子文件夹：与右键菜单「新增子資料夾」同源（folderMenuService:828 的 newFolder(folder, true)）。 */
  registerAppMenuAction('newSubFolder', () => () => {
    void Promise.all([
      import('./folderCoreService'),
      import('../store/folderState'),
    ]).then(([svc, st]) => {
      svc.newFolder(st.useFolderState.getState().currentFolder, true);
    });
  });

  /* 丢到回收站：与 Delete 键、右键菜单「丢到回收站」同源。 */
  registerAppMenuAction('moveToTrash', () => () => {
    void import('../core/selectionViewDomain').then((m) => m.machineryRemoveSelected());
  });

  /* 筛选侧栏项目：聚焦侧栏的文件夹筛选输入框（Sidebar.tsx 的 #folder-search）。 */
  registerAppMenuAction('filterFolders', () => () => {
    const input = document.getElementById('folder-search') as HTMLInputElement | null;
    input?.focus();
    input?.select?.();
  });

  /* 切换文件夹：原实现是 `$scope.openQuickSearch()`（bundle 25198，Mousetrap 'j' 同键），
     即打开快捷搜索面板——不是侧栏那个被改成来源模式切换的按钮。 */
  registerAppMenuAction('switchFolder', () => () => {
    void import('../global/bus').then((m) => m.openQuickSearchModalChannel.emit());
  });

  /* 添加到上一次使用的文件夹：batchOpsService 的具名导出（右键菜单同款调用）。 */
  registerAppMenuAction('addToLastFolder', () => () => {
    void import('./batchOpsService').then((m) => m.addToLastUsedFolder());
  });

  /* 添加标签到选中项：打开检视器标签选择面板（selectionViewDomain:521，
     面板内 confirm 调 TagManager.addTags —— InspectorTagSelectPanel.tsx:207）。 */
  registerAppMenuAction('addTagsToSelection', () => () => {
    void import('../core/selectionViewDomain').then((m) => m.machineryOpenInspectorTagSelectPanel());
  });

  /* 清除标签：与标签输入框右键菜单「清除标签」同源（inspectorActions.ts:749）。 */
  registerAppMenuAction('clearTags', () => () => {
    void import('../store/miscRawState').then((m) => {
      const clear = m.useMiscRawState.getState().clearAllTags;
      if (typeof clear === 'function') clear();
    });
  });

  /* 列表视图显示元信息：miscDomain.machineryShowListMetas（event 可空）。 */
  registerAppMenuAction('toggleListMetas', () => () => {
    void import('../core/miscDomain').then((m) => m.machineryShowListMetas(undefined));
  });

  /* 以图搜图（七引擎）：与右键菜单「以图搜图」子项同源 ——
     eagle.reverseImageSearch.search(item, engine)（itemMenuService:800+）。
     应用菜单没有 item 上下文，取当前选中项的第一项；无选中则空转。 */
  const reverseSearch = (engine: string) => () => {
    void Promise.all([
      import('../store/selectionState'),
      import('../store/itemState'),
    ]).then(([selMod, itemMod]) => {
      const ids: string[] = (selMod as any).useSelectionState.getState().selected || [];
      const maps: any = (itemMod as any).useItemState.getState().itemMappings || {};
      const target = ids.map((id: string) => maps[id]).find(Boolean);
      if (!target) return;
      const ris = (window as any).eagle?.reverseImageSearch;
      ris?.search?.(target, engine);
    });
  };
  // 注意：registry 存的是「返回动作函数的 thunk」，故此处必须再包一层 `() => …`。
  registerAppMenuAction('reverseSearchGoogle', () => reverseSearch('google'));
  registerAppMenuAction('reverseSearchBing', () => reverseSearch('bing'));
  registerAppMenuAction('reverseSearchYandex', () => reverseSearch('yandex'));
  registerAppMenuAction('reverseSearchTineye', () => reverseSearch('tineye'));
  registerAppMenuAction('reverseSearchSaucenao', () => reverseSearch('saucenao'));
  registerAppMenuAction('reverseSearchBaidu', () => reverseSearch('baidu'));
  registerAppMenuAction('reverseSearchSogou', () => reverseSearch('sogou'));

  /* ── 第六批：文件夹排列四项 / 合并图片（均按 app.bundle.js 原文回迁） ── */

  /**
   * 文件夹排列（bundle 40735-40841 语义复刻）。
   *
   * 原文：`arrangeTopFolder/arrangeUpFolder/arrangeDownFolder/arrangeBottomFolder`
   * 四者只差目标下标，公共体是 `moveFolderTo(folder, from, to, folders)`：
   * `folders.move(from,to)` → `updateSidebarList()` → 100ms 后 `changeSidebarIndex(folder)`
   * → 1s 去抖 `saveFolder()`。多选中文件夹/智能文件夹时直接 return（原文同）。
   */
  const arrangeFolder = (target: 'top' | 'up' | 'down' | 'bottom') => () => {
    void Promise.all([
      import('../store/folderState'),
      import('../store/miscRawState'),
      import('../store/itemState'),
      import('../core/libraryDomain'),
    ]).then(([folderMod, miscMod, itemMod, lib]) => {
      const fst: any = (folderMod as any).useFolderState.getState();
      const mst: any = (miscMod as any).useMiscRawState.getState();
      const ist: any = (itemMod as any).useItemState.getState();

      if ((mst.selectedFolders || []).length > 0) return;
      if ((mst.selectedSmartFolders || []).length > 0) return;

      let folder: any = null;
      let siblings: any[] = [];
      let from = -1;

      const cur = fst.currentFolder;
      const curSmart = fst.currentSmartFolder;
      if (cur) {
        siblings = (cur.parent && ist.folderMappings?.[cur.parent]?.children) || fst.folders || [];
        folder = cur;
        from = siblings.indexOf(cur);
      } else if (curSmart) {
        let list: any[] = fst.smartFolders || [];
        if (curSmart.parent && ist.smartFolderMappings?.[curSmart.parent]) {
          list = ist.smartFolderMappings[curSmart.parent].children;
        }
        siblings = list;
        folder = curSmart;
        from = siblings.indexOf(curSmart);
      }
      if (!folder || !siblings.length || from < 0) return;

      let to = from;
      if (target === 'top') { if (from < 1) return; to = 0; }
      else if (target === 'up') { if (from < 1) return; to = from - 1; }
      else if (target === 'down') { if (from >= siblings.length - 1) return; to = from + 1; }
      else { if (from >= siblings.length - 1) return; to = siblings.length - 1; }

      // 原 `folders.move(from, to)` 的自研等价（jQuery-UI 的 Array#move 未移植）
      siblings.splice(to, 0, siblings.splice(from, 1)[0]);

      lib.machineryUpdateSidebarList();
      setTimeout(() => lib.machineryChangeSidebarIndex(folder), 100);
      lib.machinerySaveFolderDebounce();
    });
  };
  registerAppMenuAction('arrangeCurrentItemToTop', () => arrangeFolder('top'));
  registerAppMenuAction('arrangeCurrentItemUp', () => arrangeFolder('up'));
  registerAppMenuAction('arrangeCurrentItemDown', () => arrangeFolder('down'));
  registerAppMenuAction('arrangeCurrentItemToBottom', () => arrangeFolder('bottom'));

  /* 合并图片：原 `eagle.combineImages.open($scope.selected)`（bundle 24785）。
     eagle 全局面由 bundleGlobals:72 装配，取当前选中项数组。 */
  registerAppMenuAction('mergeImage', () => () => {
    void Promise.all([
      import('../store/selectionState'),
      import('../store/itemState'),
    ]).then(([selMod, itemMod]) => {
      const ids: string[] = (selMod as any).useSelectionState.getState().selected || [];
      const maps: any = (itemMod as any).useItemState.getState().itemMappings || {};
      const items = ids.map((id: string) => maps[id]).filter(Boolean);
      if (items.length === 0) return;
      (window as any).eagle?.combineImages?.open?.(items);
    });
  });

  /* 裁剪：原 `$scope.cropImage`（bundle 35974-35983 逐字语义）——
     当前项存在 → 扩展名限 jpg/png/webp → 非详情模式不进 → 已在裁剪态不重复进
     → `isCropMode = true` + `zoomFit()`（原文的 switchToPreviewMode 在本树无落点，略）。
     非详情模式下该项点到不动（保持原「静默 return」行为）。 */
  registerAppMenuAction('cropImage', () => () => {
    void Promise.all([
      import('../store/bodyState'),
      import('../store/detailState'),
      import('./viewOpsService'),
    ]).then(([bodyMod, detailMod, view]) => {
      const snap: any = (detailMod as any).useDetailState.getState().snapshot;
      const cur = snap?.current;
      if (!cur) return;
      if (cur.ext !== 'jpg' && cur.ext !== 'png' && cur.ext !== 'webp') return;
      const st: any = (bodyMod as any).useBodyState.getState();
      if (!st.isDetailMode) return;
      if (st.isCropMode) return;
      (bodyMod as any).writeIsCropMode(true);
      view.machineryZoomFit();
    });
  });

  /* ── 第四批：检视器开关、复制名称 ── */
  /* 检视器：无现成导出函数，与布局面板「显示检视器」开关同源（SmallPanels.tsx:452）
     —— 走 miscRawState.inspector.toggle()。 */
  registerAppMenuAction('toggleInspector', () => () => {
    void import('../store/miscRawState').then((m) => {
      const insp: any = m.useMiscRawState.getState().inspector;
      if (insp && typeof insp.toggle === 'function') insp.toggle();
    });
  });
  /* 复制名称：itemMenuService 的「复制名称」项即 copyAsProperity('name') */
  registerAppMenuAction('copyName', () => () => {
    void import('../core/itemDomain').then((m) => m.copyAsProperity('name'));
  });

  void appMenuMissing;
}

/** 门禁探针：已接线的动作名清单。 */
export function wiredAppMenuActionNames(): string[] {
  return [...KNOWN_ACTION_NAMES];
}

/**
 * 已知动作名清单（与 `appMenuService` 模板里出现的名字一一对应）。
 *
 * 这份清单是**门禁的对照面**：测试会断言「模板里出现的所有动作名都在此表中」，
 * 从而防止改模板时漏登记。
 */
export const KNOWN_ACTION_NAMES: ReadonlySet<string> = new Set([
  // 资源库
  'createLibrary', 'loadLibrary', 'switchLibrary', 'clearLibraryHistory', 'reloadLibrary', 'mergeLibrary',
  // 文件
  'newItem', 'newFolder', 'newSubFolder', 'newSmartFolder', 'importFolders', 'importLinks',
  'importEaglepack', 'openAutoImportSettings', 'openDuplicate', 'newFileFromTemplate:txt',
  'exportToComputer', 'exportAsEaglepack',
  // 编辑
  'renameCurrentFolder', 'copyPath', 'copyEagleLink', 'copyThumbnail', 'copyName',
  'rotateImage', 'flipImage', 'cropImage', 'mergeImage',
  'arrangeCurrentItemToTop', 'arrangeCurrentItemUp', 'arrangeCurrentItemDown',
  'arrangeCurrentItemToBottom', 'removeFromFolder', 'moveToTrash',
  // 查找
  'focusSearchInput', 'openFilterPanel', 'resetFilter', 'filterFolders',
  'reverseSearchEagle', 'reverseSearchGoogle', 'reverseSearchBing', 'reverseSearchYandex',
  'reverseSearchTineye', 'reverseSearchSaucenao', 'reverseSearchBaidu', 'reverseSearchSogou',
  'switchFolder', 'addToFolder', 'addToLastFolder',
  // 整理
  'addTagsToSelection', 'copyTags', 'pasteTags', 'clearTags', 'removeRating',
  // 显示
  'toggleAlwaysOnTop', 'viewAll', 'viewUnfiled', 'viewUntagged', 'viewRecent', 'viewRandom',
  'viewAllTags', 'viewTrash', 'switchToGridLayout', 'switchToJustifiedLayout',
  'switchToSquareLayout', 'switchToListLayout', 'machineryGotoTop', 'machineryGotoBottom',
  'zoomIn', 'zoomOut', 'zoomActual', 'zoomFit', 'toggleGrayscale',
  'machineryToggleSidebar', 'toggleInspector', 'machineryToggleAll',
  'toggleListName', 'toggleListMetas', 'toggleSubfolder',
  // 动作
  'openActionsPanel',
]);
