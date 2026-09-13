/**
 * b1-9bp：miscMenuService —— 剩余菜单 builder 收口（S5 竖切收尾）。
 *
 * 居民（10 个，逐字；原 controllerFns fns 表条目，install 工厂同 folderMenuService）：
 * - openTrashContextMenu / openFileListContextMenu（列表与回收站右键）
 * - openOrderMenu（OPEN_LAYOUT_PANEL 排序面板）
 * - openApplicationContextMenu（原生 Menu.popup）
 * - openFilterAddContextMenu（筛选项「新增」菜单）/ openNewContextMenu（工具栏「新建」）
 * - openQuickAccessContextMenu / openSidebarVisibleContextMenu / openRatioContextMenu
 * - openSmartFolderExpandContextMenu（侧栏智能文件夹展开菜单）
 *
 * 符号解析面（itemMenuService/folderMenuService 同模式）：
 * - ContextMenu → contextMenuDomain（发射端 eagleBus）
 * - updateCurrentOrderAndIncrease → controllerFns 既有导出（openOrderMenu click 面消费；
 *   双侧函数声明提升循环依赖先例——controllerFns install 三 service 同构）
 * - i18n/preferences/swal/dialog/Menu/ipcRenderer/remote/currentWindow/eagle → 模块常量或 window 回退
 * - $filter → scope $root → machinery getFilter 双轨
 */
// @ts-nocheck
import { ContextMenu } from '../core/contextMenuDomain';

import { updateCurrentOrderAndIncrease } from '../core/miscDomain';
import { syncBodyFromScope } from '../store/bodyState';
import { syncDetailFromScope } from '../store/detailState';
import { syncToolbarFromScope } from '../store/toolbarState';
;
import { importFolders } from './uploadService';
import { getRatioNonExp } from './viewOpsService';
import { emptyTrash } from './batchOpsService';
import { emptyRestore, newFolder } from './folderCoreService';
import { openLayoutPanelChannel } from '../global/bus';
import { clickEl, qaHasEl, addClassEl, removeClassEl } from '../utils/domQuery';
import { machineryOpenDuplicate } from '../core/itemDomain';
import { machineryImportLinks, machineryNewSmartFolder, machineryOpenArtstation, machineryOpenHuaban, machineryOpenPinterest } from '../core/libraryDomain';
import { machineryUpdateContainerHieght } from './gridService';
import { machineryUpdateZoomRatio, machineryZoomActual, machineryZoomFit } from './viewOpsService';
import { machineryToggleAllSmartFolderExpand, machineryToggleCurrentLevelSmartFolders } from '../core/libraryDomain';
import { machineryNewFileFromTemplate } from '../core/itemDomain';
import { getFilter, machineryOpenFilter } from '../core/filterDomain';
import { getFilter as machineryGetFilter } from '../core/filterDomain';
import { machineryToggleSelectSmartFolder } from '../core/selectionViewDomain';
import { getToggleFilterByTypeFn } from '../core/filterDomain';
import { useLayoutState } from '../store/layoutState';
import { useItemState } from '../store/itemState';
import { useSelectionState } from '../store/selectionState';
import { usePreferencesState } from '../store/preferencesState';
import { useMiscRawState } from '../store/miscRawState';
const _req: any = (n: string) => { try { return (window as any).require(n); } catch (err) { return undefined; } };
const i18n: any = (window as any).i18n;
let preferences: any = (window as any).electronSettings?.getPreferences?.() || {};
const eagle: any = (window as any).eagle;
const currentWindow: any = (window as any).electron?.remote?.getCurrentWindow?.() || _req('@electron/remote')?.getCurrentWindow?.();
const remote: any = _req('@electron/remote');
const Menu: any = remote?.Menu;
const ipcRenderer: any = (window as any).__eagleIpc || (window as any).electron?.ipcRenderer;
const dialog: any = remote?.dialog;
const $filter: any = (name: string) => {
  // E4：原 `s.$root.$filter`（Angular injector 滤镜服务）在去 Angular 后恒缺席——直接走移植表。
  const inst: any = machineryGetFilter();
  return inst ? inst(name) : undefined;
};

/* b1-9bz-B 收口：本文件 7 处迁移体/shell 头部统一带 `try { initLinkVars(); }` 序言，但
   install 体内此前从未定义 initLinkVars（运行期 ReferenceError 被空 catch 吞掉，无症状）。
   本落点无 __lv_ link 态随迁，补空实现使序言诚实（同 lockService/itemMenuService 处理）。 */
let lvInited = false;
const initLinkVars = () => {
  if (lvInited) return;
  lvInited = true;
};

/* b1-9bz-B：这两个条目此前只能在 install 体内以匿名函数注册，组件侧（BodyBindings 的
   应用菜单按钮 / BoxList 的 callFn 动态派发）只能经 callScope 字符串路由命中。提升为具名
   导出（bz-A 落点同形态：install 注入的 getScope 等价 getBodyScope），表项改指针，
   组件侧改直 import + scopeApply，零行为变化。 */
export function openFileListContextMenu(...args: any[]) {
  return (function (event: any) {
          event.stopPropagation();
          openOrderMenu();
  }).apply(null, args);
}

export function openApplicationContextMenu(...args: any[]) {
  try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
  return (function () {
          var applicationMenu = Menu.getApplicationMenu();
          // b1-9ak：冒烟捕获分支——__EAGLE_MENU_SMOKE 时序列化菜单模板通报 main
          // （原生 popup 无法被 CDP 观察且会阻塞会话；dragSmokeMode 同款先例）。
          // 旗标由 preload 直通（shims 会 stub window.process/window.require，env 不可达）
          if ((window as any).__EAGLE_MENU_SMOKE === true) {
              // 模板由 main 侧原生序列化（remote 经代理读 items 实测为空）
              ipcRenderer.send('smoke:menu-popup', { site: 'application-menu' });
              return;
          }
          applicationMenu.popup(currentWindow);
      }).apply(null, args);
}

/* 10 builder（逐字；fns/getScope 为闭包注入） */
/* b1-9bz-B：原 install 体内匿名注册条目——DetailToolbar 的 call 派发只能字符串命中，
   提升为具名导出（install 注入的 getScope 等价 getBodyScope），表项改指针，
   组件侧改直 import，零行为变化。 */
export function openRatioContextMenu(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function() {
            ContextMenu.open({
                items: [
                    { label: '5%', checked: parseInt(useLayoutState.getState().imageSize.zoomRatioExp) == 5, click: () => { machineryUpdateZoomRatio(getRatioNonExp(5), undefined, undefined, true); useLayoutState.getState().imageSize.zoomRatioExp = 5; } },
                    { label: '10%', checked: parseInt(useLayoutState.getState().imageSize.zoomRatioExp) == 10, click: () => { machineryUpdateZoomRatio(getRatioNonExp(10), undefined, undefined, true); useLayoutState.getState().imageSize.zoomRatioExp = 10; } },
                    { label: '25%', checked: parseInt(useLayoutState.getState().imageSize.zoomRatioExp) == 25, click: () => { machineryUpdateZoomRatio(getRatioNonExp(25), undefined, undefined, true); useLayoutState.getState().imageSize.zoomRatioExp = 25; } },
                    { label: '50%', checked: parseInt(useLayoutState.getState().imageSize.zoomRatioExp) == 50, click: () => { machineryUpdateZoomRatio(getRatioNonExp(50), undefined, undefined, true); useLayoutState.getState().imageSize.zoomRatioExp = 50; } },
                    { label: '100%', checked: parseInt(useLayoutState.getState().imageSize.zoomRatioExp) == 100, click: () => { machineryUpdateZoomRatio(getRatioNonExp(100), undefined, undefined, true); useLayoutState.getState().imageSize.zoomRatioExp = 100; } },
                    { label: '125%', checked: parseInt(useLayoutState.getState().imageSize.zoomRatioExp) == 125, click: () => { machineryUpdateZoomRatio(getRatioNonExp(125), undefined, undefined, true); useLayoutState.getState().imageSize.zoomRatioExp = 125; } },
                    { label: '150%', checked: parseInt(useLayoutState.getState().imageSize.zoomRatioExp) == 150, click: () => { machineryUpdateZoomRatio(getRatioNonExp(150), undefined, undefined, true); useLayoutState.getState().imageSize.zoomRatioExp = 150; } },
                    { label: '200%', checked: parseInt(useLayoutState.getState().imageSize.zoomRatioExp) == 200, click: () => { machineryUpdateZoomRatio(getRatioNonExp(200), undefined, undefined, true); useLayoutState.getState().imageSize.zoomRatioExp = 200; } },
                    { label: '300%', checked: parseInt(useLayoutState.getState().imageSize.zoomRatioExp) == 300, click: () => { machineryUpdateZoomRatio(getRatioNonExp(300), undefined, undefined, true); useLayoutState.getState().imageSize.zoomRatioExp = 300; } },
                    { label: '400%', checked: parseInt(useLayoutState.getState().imageSize.zoomRatioExp) == 400, click: () => { machineryUpdateZoomRatio(getRatioNonExp(400), undefined, undefined, true); useLayoutState.getState().imageSize.zoomRatioExp = 400; } },
                    { label: '800%', checked: parseInt(useLayoutState.getState().imageSize.zoomRatioExp) == 800, click: () => { machineryUpdateZoomRatio(getRatioNonExp(800), undefined, undefined, true); useLayoutState.getState().imageSize.zoomRatioExp = 800; } },
                    { role: 'separator' },
                    { label: i18n.__('context.zoom.zoomActural'), accelerator: preferences.shortcuts.keybinds['view.zoom.actual'], click: () => { machineryZoomActual(); } },
                    { label: i18n.__('context.zoom.zoomFit'), accelerator: preferences.shortcuts.keybinds['view.zoom.fit'], click: () => { machineryZoomFit(); } },
                ],
                showSearch: false,
            });            
        }).apply(null, args);
}

export function openTrashContextMenu(...args: any[]) {
    return (function (event: any) {

            const disabled = useItemState.getState().trash.length === 0;
            const trashEl = event.delegateTarget as HTMLElement;

            ContextMenu.open({
                items: [
                    {
                        disabled: disabled,
                        label: i18n.__('context.emptyTrash.empty'),
                        keywords: `empty delete remove trash`,
                        icon: 'ic-trash-empty.svg',
                        click: () => { emptyTrash(); }
                    },
                    {
                        disabled: disabled,
                        label: $filter('i18n')('context.emptyTrash.restoreAll'),
                        keywords: `restore`,
                        icon: 'ic-trash-restore.svg',
                        click: () => { emptyRestore(); }
                    }
                ],
                showSearch: false,
                onOpened: () => {
                    addClassEl(trashEl, "context-activate");
                },
                onClosed: () => {
                    removeClassEl(trashEl, "context-activate");
                }
            });
    }).apply(null, args);
}

export function openOrderMenu(...args: any[]) {
    return (function (event: any) {
            event && event.stopPropagation();
            openLayoutPanelChannel.emit();
            updateCurrentOrderAndIncrease();
    }).apply(null, args);
}

export function openFilterAddContextMenu(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function () {
            machineryOpenFilter();
            clickEl("#filter-toolbar-overlay");

            const pinFilter = (id, pinned) => {
                eagle.filter.pinned[id] = pinned;
                eagle.filter.savePinned();
                setTimeout(function () { machineryUpdateContainerHieght(); }, 50);
            };

            const openFilter = (id) => {
                clickEl(`#${id}-filter-item`);
                setTimeout(function () { machineryUpdateContainerHieght(); }, 50);
            }

            let items = [
                {
                    id: "color",
                    label: i18n.__('filter.color'),
                    keywords: "color palette 顏色 調色盤",
                    icon: 'ic-filter-item-color.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['color'],
                    toggle: (pinned) => {
                        pinFilter('color', pinned);
                    },
                    click: () => {
                        openFilter('color');
                    }
                },
                // 標籤
                {
                    id: "tags",
                    label: i18n.__('filter.tags'),
                    keywords: "tags label 標籤",
                    icon: 'ic-filter-item-tag.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['tags'],
                    toggle: (pinned) => {
                        pinFilter('tags', pinned);
                    },
                    click: () => {
                        openFilter('tags');
                    }
                },
                // 資料夾
                {
                    id: "folders",
                    label: i18n.__('filter.folders'),
                    keywords: "folders dir 資料夾 文件夾",
                    icon: 'ic-filter-item-folder.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['folders'],
                    toggle: (pinned) => {
                        pinFilter('folders', pinned);
                    },
                    click: () => {
                        openFilter('folders');
                    }
                },
                // 形狀
                {
                    id: "shape",
                    label: i18n.__('filter.orientation'),
                    keywords: "shape orientation 形狀 方向",
                    icon: 'ic-filter-item-shape.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['shape'],
                    toggle: (pinned) => {
                        pinFilter('shape', pinned);
                    },
                    click: () => {
                        getToggleFilterByTypeFn()('shape');
                    }
                },
                // 評分
                {
                    id: "rating",
                    label: i18n.__('filter.rating'),
                    keywords: "rating rate star 評分 星等 星級",
                    icon: 'ic-filter-item-rating.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['rating'],
                    toggle: (pinned) => {
                        pinFilter('rating', pinned);
                    },
                    click: () => {
                        openFilter('rating');
                    }
                },
                // 類型
                {
                    id: "types",
                    label: i18n.__('filter.types'),
                    keywords: "types type extenstion format 類型 格式 副檔名",
                    icon: 'ic-filter-item-ext.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['types'],
                    toggle: (pinned) => {
                        pinFilter('types', pinned);
                    },
                    click: () => {
                        openFilter('types');
                    }
                },
                // 時間
                {
                    id: "import",
                    label: i18n.__('filter.import'),
                    keywords: "date time import 時間 導入 匯入",
                    icon: 'ic-filter-item-import.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['import'],
                    toggle: (pinned) => {
                        pinFilter('import', pinned);
                    },
                    click: () => {
                        openFilter('import');
                    }
                },
                // 修改時間
                {
                    id: "mtime",
                    label: i18n.__('filter.mtime'),
                    keywords: "mtime time modify 修改時間",
                    icon: 'ic-filter-item-modify.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['mtime'],
                    toggle: (pinned) => {
                        pinFilter('mtime', pinned);
                    },
                    click: () => {
                        openFilter('mtime');
                    }
                },
                // 解析度
                {
                    id: "resolution",
                    label: i18n.__('filter.resolution'),
                    keywords: "resolution dimension 解析度 尺寸 分辨率",
                    icon: 'ic-filter-item-resolution.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['resolution'],
                    toggle: (pinned) => {
                        pinFilter('resolution', pinned);
                    },
                    click: () => {
                        openFilter('resolution');
                    }
                },
                // 時長
                {
                    id: "duration",
                    label: i18n.__('filter.duration'),
                    keywords: "duration time 時長 時間",
                    icon: 'ic-filter-item-duration.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['duration'],
                    toggle: (pinned) => {
                        pinFilter('duration', pinned);
                    },
                    click: () => {
                        openFilter('duration');
                    }
                },
                // 檔案大小
                {
                    id: "size",
                    label: i18n.__('filter.fileSize'),
                    keywords: "size filesize 檔案大小 文件大小",
                    icon: 'ic-filter-item-size.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['size'],
                    toggle: (pinned) => {
                        pinFilter('size', pinned);
                    },
                    click: () => {
                        openFilter('size');
                    }
                },
                // 註解
                {
                    id: "annotation",
                    label: i18n.__('filter.comments'),
                    keywords: "comments comment 註解 標注 筆記 annotation",
                    icon: 'ic-filter-item-comment.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['annotation'],
                    toggle: (pinned) => {
                        pinFilter('annotation', pinned);
                    },
                    click: () => {
                        openFilter('annotation');
                    }
                },
                // 筆記
                {
                    id: "note",
                    label: i18n.__('filter.annotation'),
                    // 日文版關鍵字
                    keywords: "note 筆記 註解 註釋",
                    icon: 'ic-filter-item-note.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['note'],
                    toggle: (pinned) => {
                        pinFilter('note', pinned);
                    },
                    click: () => {
                        openFilter('note');
                    }
                },
                // 網址
                {
                    id: "url",
                    label: i18n.__('filter.url'),
                    keywords: "url link website 網址 連結 鏈接",
                    icon: 'ic-filter-item-url.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['url'],
                    toggle: (pinned) => {
                        pinFilter('url', pinned);
                    },
                    click: () => {
                        openFilter('url');
                    }
                },
                // 字型
                {
                    id: "fontActivated",
                    visible: !!eagle.filter.filterExtensions['font'],
                    label: i18n.__('filter.fontActivated'),
                    keywords: "font 字型 字體",
                    icon: 'ic-filter-item-font.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['fontActivated'],
                    toggle: (pinned) => {
                        pinFilter('fontActivated', pinned);
                    },
                    click: () => {
                        openFilter('fontActivated');
                    }
                },
                // BPM 
                {
                    id: "bpm",
                    visible: !!eagle.filter.filterExtensions['audio'],
                    label: "BPM",
                    keywords: "bpm 節拍 節奏",
                    icon: 'ic-filter-item-bpm.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['bpm'],
                    toggle: (pinned) => {
                        pinFilter('bpm', pinned);
                    },
                    click: () => {
                        openFilter('bpm');
                    }
                },
                // 相機
                {
                    id: "camera",
                    visible: !!eagle.filter.filterExtensions['raw'],
                    label: i18n.__('filter.camera'),
                    keywords: "camera 相機 攝影機",
                    icon: 'ic-filter-item-camera.svg',
                    role: "toggle",
                    pinned: eagle.filter.pinned['camera'],
                    toggle: (pinned) => {
                        pinFilter('camera', pinned);
                    },
                    click: () => {
                        openFilter('camera');
                    }
                },
            ];

            items = items.sort(function (a, b) {
                let aIndex = eagle.filter.toolbar.findIndex(function (item) {
                    return item.type === a.id;
                });
                let bIndex = eagle.filter.toolbar.findIndex(function (item) {
                    return item.type === b.id;
                });
                return aIndex - bIndex;
            });
            
            (window as any).__oicmT.push('before-open');
            ContextMenu.open({
                items: items,
                showSearch: true,
                sortable: true,
                sortableHelper: true,
                onSorted: (items) => {
                    if (!items) return;
                    if (eagle.filter.toolbar && eagle.filter.toolbar.length > 0) {
                        let toolbarOrders = [];
                        items.forEach((item) => {
                            toolbarOrders.push(item.id);
                        });
                        localStorage.setItem("eagle.filter.toolbar.orders", JSON.stringify(toolbarOrders));
                        eagle.filter.initOrders();
                    }
                }
            });
        }).apply(null, args);
}

export function openNewContextMenu(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function() {
            ContextMenu.open({
                items: [
                    // 建立资料夹
                    {
                        accelerator: usePreferencesState.getState().preferences.shortcuts.keybinds['file.create.folder'] || 'CmdOrCtrl+Shift+N',
                        label: i18n.__('context.import.createFolder'),
                        keywords: 'folder dir new create 資料夾 文件夾 新建 建立 新增 ',
                        icon: 'ic-folder-new-folder.svg',
                        click: function() { newFolder(); }
                    },
                    // 建立智能资料夹
                    {
                        accelerator: usePreferencesState.getState().preferences.shortcuts.keybinds['file.create.smartfolder'] || 'CmdOrCtrl+Shift+Alt+N',
                        label: i18n.__('context.import.createSmartFolder'),
                        keywords: 'smart folder dir new create 資料夾 文件夾 新建 建立 新增 智能 智慧',
                        icon: 'ic-smart-folder-new.svg',
                        click: function() {
                            machineryNewSmartFolder();
                        }
                    },
                    {
                        role: 'separator'
                    },
                    // 導入本地文件夾
                    {
                        accelerator: usePreferencesState.getState().preferences.shortcuts.keybinds['file.import.folders'],
                        label: i18n.__('context.import.folders'),
                        keywords: 'import folder dir 資料夾 文件夾 導入 local 本地 本機 本机 匯入 导入',
                        icon: 'ic-import-local.svg',
                        click: function() {
                            importFolders();
                        }
                    },
                    // 導入連結
                    {
                        accelerator: usePreferencesState.getState().preferences.shortcuts.keybinds['file.import.links'],
                        label: i18n.__('appmenu.file>links'),
                        keywords: '',
                        icon: 'ic-import-links.svg',
                        click: function() {
                            machineryImportLinks();
                        }
                    },
                    // 導入 eaglepack
                    {
                        accelerator: usePreferencesState.getState().preferences.shortcuts.keybinds['file.import.eaglepack'],
                        label: i18n.__('context.import.eaglepack'),
                        keywords: 'import eaglepack 素材包 導入 匯入',
                        icon: 'ic-import-eaglepack.svg',
                        click: function () {
                            dialog.showOpenDialog(currentWindow, {
                                title: i18n.__("Dialog.Import.Eaglepack.Message"),
                                filters: [
                                    { name: 'Eagle Pack', extensions: ['eaglepack'] },
                                ],
                                properties: ['openFile']
                            }).then(__lv_result => {
                                var paths = __lv_result.filePaths;
                                if (!paths || paths.length === 0) return;
                                var __lv_packPath = paths[0];
                                ipcRenderer.send("open-eaglepack", {
                                    path: __lv_packPath
                                });
                            });
                        }
                    },
                    {
                        label: i18n.__("appmenu.file>autoImport"),
                        icon: 'ic-import-autoimport.svg',
                        submenu: {
                            items: [
                                {
                                    label: i18n.__("appmenu.file>autoImport>settings"),
                                    keywords: `${i18n.__("appmenu.file>autoImport")} 自動導入 設定 設置 settings auto import`,
                                    click: function () {
                                        ipcRenderer.send('open.preferences', {
                                            panel: "autoImport"
                                        });
                                    }
                                },
                                {
                                    disabled: true,
                                    visible: usePreferencesState.getState().preferences.autoImport.enable === 'true' && usePreferencesState.getState().preferences.autoImport.path,
                                    label: usePreferencesState.getState().preferences.autoImport.path,
                                    click: function () {
                                        ipcRenderer.send('open-with-default', usePreferencesState.getState().preferences.autoImport.path);
                                    }
                                }
                            ]
                        }
                    },
                    // 找重複檔案
                    {
                        label: i18n.__("context.import.findDuplicate"),
                        icon: 'ic-find-duplicate.svg',
                        submenu: {
                            items: [
                                {
                                    label: i18n.__("context.import.findDuplicate>all"),
                                    keywords: 'duplicate 重複 搜索 尋找 repeat',
                                    click: function () {
                                        machineryOpenDuplicate();
                                    }
                                },
                                {
                                    disabled: useItemState.getState().allData.length === 0,
                                    label: i18n.__("context.import.findDuplicate>currentList"),
                                    keywords: 'duplicate 重複 搜索 尋找 repeat',
                                    click: function () {
                                        machineryOpenDuplicate({
                                            currentPage: true
                                        });
                                    }
                                },
                                {
                                    disabled: useSelectionState.getState().selected.length <= 1,
                                    label: i18n.__("context.import.findDuplicate>selected"),
                                    keywords: 'duplicate 重複 搜索 尋找 repeat',
                                    click: function () {
                                        machineryOpenDuplicate({
                                            selected: true
                                        });
                                    }
                                }
                            ]
                        }
                    },
                    {
                        role: 'separator'
                    },
                    // 設計文件
                    {
                        visible: process.platform == 'darwin' && installedApplications["sketch"].isInstalled,
                        label: "Sketch " + i18n.__("general.document"),
                        keywords: 'template 模板 file',
                        icon: '/templates/ic-sketch.png',
                        click: function() { machineryNewFileFromTemplate("sketch"); }
                    },
                    {
                        label: "Photoshop " + i18n.__("general.document"),
                        icon: '/templates/ic-photoshop.png',
                        keywords: 'template 模板 file adobe psd photoshop',
                        click: function() { machineryNewFileFromTemplate("psd"); }
                    },
                    {
                        label: "Illustrator " + i18n.__("general.document"),
                        icon: '/templates/ic-illustration.png',
                        keywords: 'template 模板 file adobe ai illustrator',
                        click: function() { machineryNewFileFromTemplate("ai"); }
                    },
                    {
                        label: "XD " + i18n.__("general.document"),
                        icon: '/templates/ic-xd.png',
                        keywords: 'template 模板 file adobe xd',
                        click: function() { machineryNewFileFromTemplate("xd"); }
                    },
                    {
                        role: 'separator'
                    },
                    // 其它文件
                    {
                        accelerator: 'Alt+Shift+N',
                        label: i18n.__("general.txtDocument"),
                        icon: '/templates/ic-txt.png',
                        keywords: 'template 模板 file note txt text',
                        click: function() { machineryNewFileFromTemplate("txt"); }
                    },
                    {
                        label: "Word " + i18n.__("general.document"),
                        icon: '/templates/ic-word.png',
                        keywords: 'template 模板 file office microsoft doc docx word',
                        click: function() { machineryNewFileFromTemplate("docx"); }
                    },
                    {
                        label: "PowerPoint " + i18n.__("general.document"),
                        icon: '/templates/ic-powerpoint.png',
                        keywords: 'template 模板 file office microsoft ppt pptx powerpoint',
                        click: function() { machineryNewFileFromTemplate("pptx"); }
                    },
                    {
                        label: "Excel " + i18n.__("general.document"),
                        icon: '/templates/ic-excel.png',
                        keywords: 'template 模板 file office microsoft xls xlsx csv excel',
                        click: function() { machineryNewFileFromTemplate("xlsx"); }
                    },
                    {
                        visible: process.platform == 'darwin',
                        label: "Keynote " + i18n.__("general.document"),
                        icon: '/templates/ic-keynote.png',
                        keywords: 'template 模板 file apple office',
                        click: function() { machineryNewFileFromTemplate("key"); }
                    },
                    {
                        visible: process.platform == 'darwin',
                        label: "Pages " + i18n.__("general.document"),
                        icon: '/templates/ic-pages.png',
                        keywords: 'template 模板 file apple office',
                        click: function() { machineryNewFileFromTemplate("pages"); }
                    },
                    {
                        visible: process.platform == 'darwin',
                        label: "Numbers " + i18n.__("general.document"),
                        icon: '/templates/ic-numbers.png',
                        keywords: 'template 模板 file apple office',
                        click: function() { machineryNewFileFromTemplate("numbers"); }
                    },
                    {
                        visible: process.platform == 'darwin' && installedApplications["mindnode"].isInstalled,
                        label: "MindNode " + i18n.__("general.document"),
                        icon: '/templates/ic-mindnode.png',
                        keywords: 'template 模板 file mind 脑图 心智图',
                        click: function() { machineryNewFileFromTemplate("mindnode"); }
                    },
                    {
                        visible: (process.platform == 'darwin')? installedApplications["xmind"].isInstalled : true,
                        label: "XMind " + i18n.__("general.document"),
                        icon: '/templates/ic-xmind.png',
                        keywords: 'template 模板 file mind 脑图 心智图',
                        click: function() { machineryNewFileFromTemplate("xmind"); }
                    },
                    {
                        role: 'separator'
                    },
                    {
                        accelerator: usePreferencesState.getState().preferences.shortcuts.keybinds['file.import.pinterest'],
                        label: "Pinterest",
                        icon: '/templates/ic-pinterest.png',
                        click: function() { machineryOpenPinterest(); }
                    },
                    {
                        label: i18n.__('context.import.others>artstation'),
                        icon: '/templates/ic-artstation.png',
                        accelerator: preferences.shortcuts.keybinds['file.import.artstation'] || 'Ctrl+Alt+Shift+S',
                        click: function() { machineryOpenArtstation(); }
                    },
                    {
                        visible: preferences?.general?.language === "zh_CN",
                        label: i18n.__('context.import.others>huaban'),
                        keywords: 'huaban 花瓣',
                        icon: '/templates/ic-huaban.png',
                        click: function() { machineryOpenHuaban(); }
                    }
                ],
                showSearch: true,
            })
        }).apply(null, args);
}

export function openQuickAccessContextMenu(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function (event, item) {
            const targetEl = event.delegateTarget as HTMLElement;
            ContextMenu.open({
                items: [
                    {
                        label: i18n.__("Context.QuickAccess.Remove"),
                        icon: "ic-favorite-remove.svg",
                        click: () => {
                            const __lv_idx = useMiscRawState.getState().quickAccess.indexOf(item);
                            if (__lv_idx !== -1) {
                                QuickAccessManager.removeIndex(__lv_idx);
                            }
                        }
                    }
                ],
                showSearch: false,
                onOpened: () => {
                    addClassEl(targetEl, "context-activate");
                },
                onClosed: () => {
                    removeClassEl(targetEl, "context-activate");
                }
            });
        }).apply(null, args);
}

export function openSidebarVisibleContextMenu(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function () {
            const targetEl = qaHasEl(".sidebar-item-container .item", event.target);
            ContextMenu.open({
                items: [
                    {
                        checked: true, 
                        disabled: true,
                        label: i18n.__('preferencesWindow.sidebar.all'),
                        icon: 'ic-sidebar-all.svg',
                        keepOpen: true,
                        click: () => {}
                    },
                    {
                        checked: usePreferencesState.getState().preferences.sidebar.unfiled === 'true', 
                        label: i18n.__('preferencesWindow.sidebar.unfiled'),
                        icon: 'ic-sidebar-unfiled.svg',
                        keepOpen: true,
                        click: () => {
                            if (usePreferencesState.getState().preferences.sidebar.unfiled === "true") usePreferencesState.getState().preferences.sidebar.unfiled = 'false';
                            else usePreferencesState.getState().preferences.sidebar.unfiled = "true";
                            syncToolbarFromScope();
                            syncBodyFromScope();
                            syncDetailFromScope();
                            syncToolbarFromScope();
                            syncBodyFromScope();
                            syncDetailFromScope();
                            ipcRenderer.send('chnage-preferences', usePreferencesState.getState().preferences);
                        }
                    },
                    {
                        checked: usePreferencesState.getState().preferences.sidebar.untagged === 'true', 
                        label: i18n.__('preferencesWindow.sidebar.untagged'),
                        icon: 'ic-sidebar-untagged.svg',
                        keepOpen: true,
                        click: () => {
                            if (usePreferencesState.getState().preferences.sidebar.untagged === "true") usePreferencesState.getState().preferences.sidebar.untagged = 'false';
                            else usePreferencesState.getState().preferences.sidebar.untagged = "true";
                            syncToolbarFromScope();
                            syncBodyFromScope();
                            syncDetailFromScope();
                            ipcRenderer.send('chnage-preferences', usePreferencesState.getState().preferences);
                        }
                    },
                    {
                        checked: usePreferencesState.getState().preferences.sidebar.recent === 'true', 
                        label: i18n.__('general.pages.recent'),
                        icon: 'ic-sidebar-recent.svg',
                        keepOpen: true,
                        click: () => {
                            if (usePreferencesState.getState().preferences.sidebar.recent === "true") usePreferencesState.getState().preferences.sidebar.recent = 'false';
                                                        else usePreferencesState.getState().preferences.sidebar.recent = "true";
                            syncToolbarFromScope();
                            syncBodyFromScope();
                            syncDetailFromScope();
                            syncToolbarFromScope();
                            syncBodyFromScope();
                            syncDetailFromScope();
                            ipcRenderer.send('chnage-preferences', usePreferencesState.getState().preferences);
                        }
                    },
                    {
                        checked: usePreferencesState.getState().preferences.sidebar.random === 'true', 
                        label: i18n.__('preferencesWindow.sidebar.random'),
                        icon: 'ic-sidebar-random.svg',
                        keepOpen: true,
                        click: () => {
                            if (usePreferencesState.getState().preferences.sidebar.random === "true") usePreferencesState.getState().preferences.sidebar.random = 'false';
                                                        else usePreferencesState.getState().preferences.sidebar.random = "true";
                            syncToolbarFromScope();
                            syncBodyFromScope();
                            syncDetailFromScope();
                            syncToolbarFromScope();
                            syncBodyFromScope();
                            syncDetailFromScope();
                            ipcRenderer.send('chnage-preferences', usePreferencesState.getState().preferences);
                        }
                    },
                    {
                        checked: usePreferencesState.getState().preferences.sidebar.community2 === 'true', 
                        label: i18n.__('preferencesWindow.sidebar.community'),
                        icon: 'ic-sidebar-community.svg',
                        keepOpen: true,
                        click: () => {
                            if (usePreferencesState.getState().preferences.sidebar.community2 === "true") usePreferencesState.getState().preferences.sidebar.community2 = 'false';
                                                        else usePreferencesState.getState().preferences.sidebar.community2 = "true";
                            syncToolbarFromScope();
                            syncBodyFromScope();
                            syncDetailFromScope();
                            syncToolbarFromScope();
                            syncBodyFromScope();
                            syncDetailFromScope();
                            ipcRenderer.send('chnage-preferences', usePreferencesState.getState().preferences);
                        }
                    },
                    {
                        checked: true, 
                        disabled: true, 
                        label: i18n.__('preferencesWindow.sidebar.allTags'),
                        icon: 'ic-sidebar-tag-manager.svg',
                        keepOpen: true,
                        click: () => {}
                    }
                ],
                showSearch: false,
                onOpened: () => {
                    addClassEl(targetEl, "context-activate");
                },
                onClosed: () => {
                    removeClassEl(targetEl, "context-activate");
                }
            });
        }).apply(null, args);
}

export function openSmartFolderExpandContextMenu(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function(event, smartFolder) {
            event.stopPropagation();
            ContextMenu.open({
                items: [
                    {
                        label: i18n.__("Context.Expand.Folder"),
                        icon: 'ic-expand.svg',
                        click: () => {
                            machineryToggleSelectSmartFolder(event, smartFolder);
                        }
                    },
                    {
                        label: i18n.__("Context.Expand.SameLevel.Folders"),
                        icon: 'ic-expand-same.svg',
                        click: () => {
                            machineryToggleCurrentLevelSmartFolders(event, smartFolder);
                        }
                    },
                    {
                        label: i18n.__("Context.Expand.All.Folders"),
                        icon: 'ic-expand-all.svg',
                        click: () => {
                            machineryToggleAllSmartFolderExpand(event, smartFolder);
                        }
                    },
                ],
                showSearch: false,
                onOpened: () => {
                    smartFolder.isSelected = true;
                },
                onClosed: () => {
                    smartFolder.isSelected = false;
                }
            });
        }).apply(null, args);
}
