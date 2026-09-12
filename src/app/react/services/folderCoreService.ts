/**
 * b1-9br：folderCoreService —— 文件夹核心操作族归位（S6 收尾）。
 *
 * 居民（7 个，逐字；原 controllerFns fns 表条目，install 工厂同 bo/bp/bq）：
 * - 创建族：createFolder / newFolder / newFolderWidthSelection
 * - 移动族：moveFoldersAsSibling / moveFoldersToFolder
 * - 归档族：addImagesToFolder
 * - 回收站：emptyRestore（trash 单条恢复）
 * （saveFolder 薄壳在 folderService.ts；moveTo 三兄弟在 FolderModals.tsx；
 *   moveFolders/removeFolder 在 folderMenuService——P4 fns 表清零时统一归拢）
 *
 * 符号解析面（batchOpsService 同模式）：
 * - i18n/eagle/swal/preferences/process/electronLog/analytics → window 全局回退
 * - $filter → 双轨 shim（scope $root → machinery getFilter）
 * - dialog/ipcRenderer → electron 同源
 */
// @ts-nocheck

import { syncListFromScope } from '../store/listState';
import { syncSidebarFromScope } from '../store/sidebarState';
import { syncInspectorFromScope } from '../store/inspectorState';
import { syncDetailFromScope } from '../store/detailState';
import { getBodyScope } from '../core/appCore';

import { syncBodyFromScope } from '../store/bodyState';
import { syncFolderLock } from '../store/lockState';
import { syncPanelFromScope } from '../store/panelState';
import { syncToolbarFromScope } from '../store/toolbarState';
import { debounce } from '../utils/func';
import { getFolderFullPath } from '../core/itemDomain';
import { addToRecentFolders } from './batchOpsService';
import { scopeEvalAsync } from '../core/scopeRuntime';
import { q, focusOn, selectText, offsetTopOf, setAttr } from '../utils/domQuery';
import { machineryGetAncestorSmartFolders, machineryGetChildFoldersMap, machineryGetFolderParentChilder } from '../core/libraryDomain';
import { machineryGetAncestorFolders, machinerySaveFolder } from '../core/libraryDomain';
import { machinerySwitchLayout } from './gridService';
import { machinerySetViewMode } from './viewOpsService';
import { machineryChangeSidebarIndex, machineryExpandFolder, machineryExpandSmartFolder, machineryOpenUnfiled, machinerySmartFolderCount, machineryUnlockFolderWithTouchID, machineryUpdateSidebarList } from '../core/libraryDomain';
import { machineryCalculateImageBinding, machineryRebindRefresh } from '../core/itemDomain';
import { getFilter, machineryUpdateFilterCounts } from '../core/filterDomain';
import { getFilter as machineryGetFilter } from '../core/filterDomain';
import { machineryRefreshSubfolderList } from '../core/tagManagerDomain';
import { machineryUpdateSelection } from '../core/selectionViewDomain';
import { openUrlInPanelChannel } from '../global/bus';
import { machineryUpdateListHeight } from '../services/gridService';
import { hide, setScrollTop } from '../utils/domQuery';
import { machineryOnImageSizeHeightChanged } from '../core/itemDomain';
import { machinerySetLastFolder } from '../core/libraryDomain';

import { machineryLeaveDetailMode } from '../core/miscDomain';
import { machineryResetPage } from './gridService';
import { getTimeout } from '../core/machineryInfra';
import { useMiscRawState } from '../store/miscRawState';
import { useItemState } from '../store/itemState';
import { useFolderState } from '../store/folderState';
import { useSelectionState } from '../store/selectionState';
import { writeScopeField } from '../core/scopeFieldBridge';
import { useBodyState } from '../store/bodyState';
import { useLayoutState } from '../store/layoutState';
// 原 bundle controller 闭包 var（folderCoreService 内 __lv_updateListHeight 唯一使用方）
let updateListHeightTimeout: any = null;
const i18n: any = (window as any).i18n;
const _req: any = (n: string) => { try { return (window as any).require(n); } catch (err) { return undefined; } };
const remote: any = _req('@electron/remote');
const dialog: any = remote?.dialog;
const ipcRenderer: any = (window as any).__eagleIpc || (window as any).electron?.ipcRenderer;
const electronLog: any = (window as any).electronLog || console;
const $filter: any = (name: string) => {
  const s: any = getBodyScope();
  const root = s && s.$root;
  if (root && root.$filter) return root.$filter(name);
  const inst: any = machineryGetFilter();
  return inst ? inst(name) : undefined;
};

/* 7 fns（逐字；fns/getScope 为闭包注入） */
export function createFolder(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function ({ name, parentID, sibling, position = "top", callback }) {

            if (name === undefined) return;

            const folderId = guid();
            const folder = {
                id: folderId,
                name: name,
                folders: [],
                modificationTime: Date.now(),
                editable: false,
                tags: [],
                children: [],
                isExpand: true,
            };

            if (parentID) {
                folder.parent = parentID;
            }

            // 兄弟模式
            if (sibling) {
                const siblingParent = useItemState.getState().folderMappings[sibling.parent];
                let index;
                if (siblingParent) {
                    index = siblingParent.children.indexOf(sibling);
                    if (index === -1) index = siblingParent.children.length - 1;
                    siblingParent.children.splice(index + 1, 0, folder);
                }
                else {
                    index = useFolderState.getState().folders.indexOf(sibling);
                    if (index === -1) index = useFolderState.getState().folders.length - 1;
                    useFolderState.getState().folders.splice(index + 1, 0, folder);
                }
            }
            // 添加成為孩子
            else if (parentID) {
                const parent = useItemState.getState().folderMappings[parentID];
                if (parent) {
                    parent.children.splice(0, 0, folder);
                }
            }
            // 添加在第一層
            else {
                if (position === "top") {
                    useFolderState.getState().folders.splice(0, 0, folder);
                }
                else if (position === "bottom") {
                    useFolderState.getState().folders.splice(useFolderState.getState().folders.length, 0, folder);
                }
            }

            useItemState.getState().folderMappings[folder.id] = folder;
            addToRecentFolders([folder.id]);
            machineryUpdateSidebarList();
            machineryCalculateImageBinding({ ignoreSort: true }, function() {
                machineryRefreshSubfolderList();
                machinerySaveFolder();
                if (callback) callback(folder);
                if (folder.parent) {
                    electronLog && electronLog.info(`[app] New sub-folder: ${folder.id}, parent: ${folder.parent}`);
                }
                else {
                    electronLog && electronLog.info(`[app] New folder: ${folder.id}`);
                }
                analytics.event('Folder', 'Create');
            });
    }).apply(null, args);
}

export function newFolder(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function(parent, isSubFolder, isSiblingFolder, ignoreAutoOpen) {

            var __lv_folderId = guid();
            var folder = {
                id: __lv_folderId,
                name: $filter('i18n')('general.untitled.folder'),
                images: [],
                folders: [],
                modificationTime: Date.now(),
                editable: true,
                imagesMappings: {},
                tags: [],
                children: [],
                isExpand: true,
            };

            // 预设状态：新增同级文件夹
            // 若带有参数 parent 则新增子文件夹
            if (isSiblingFolder) {
                var father = useItemState.getState().folderMappings[parent.parent];
                var children = (father && father.children) ? father.children : useFolderState.getState().folders;
                var __lv_idx = children.indexOf(parent);
                // 创建兄弟文件夹，如果目标及目标父文件夹相同，继承文件夹颜色、图标设置
                if (father) {
                    folder.parent = father.id;
                    if (father.icon) {
                        folder.icon = father.icon;
                    }
                    if (father.iconColor) {
                        folder.iconColor = father.iconColor;
                    }
                    parent.isExpand = true;
                }
                if (__lv_idx === -1) __lv_idx = children.length - 1;
                children.splice(__lv_idx + 1, 0, folder);
            }
            else if (useFolderState.getState().currentFolder || parent) {
				var __lv_target = parent;
                var parent = parent || useItemState.getState().folderMappings[useFolderState.getState().currentFolder.parent];
                var children = (parent && parent.children) ? parent.children : useFolderState.getState().folders;
                var __lv_idx = children.indexOf(useFolderState.getState().currentFolder);
                if (parent) {
                    folder.parent = parent.id;
                    parent.isExpand = true;
                    // 创建新的文件夹自动继承父文件夹的颜色、图标设置
					if (__lv_target) {
						if (parent && parent.icon !== undefined) {
                            folder.icon = parent.icon;
                        }
                        if (parent && parent.iconColor !== undefined) {
                            folder.iconColor = parent.iconColor;
                        }
                    }
                    else if (useFolderState.getState().currentFolder) {
                        if (parent && parent.icon === useFolderState.getState().currentFolder.icon) {
                            folder.icon = parent.icon;
                        }
                        if (parent && parent.iconColor === useFolderState.getState().currentFolder.iconColor) {
                            folder.iconColor = parent.iconColor;
                        }
                    }
                    else {
                        if (parent && parent.icon !== undefined) {
                            folder.icon = parent.icon;
                        }
                        if (parent && parent.iconColor !== undefined) {
                            folder.iconColor = parent.iconColor;
                        }
                    }
                } else {
                    folder.parent = useFolderState.getState().currentFolder.parent;
                }
                if (__lv_idx === -1) __lv_idx = children.length - 1;
                if (isSubFolder) {
                    children.splice(0, 0, folder);
                }
                else {
                    children.splice(__lv_idx + 1, 0, folder);
                }
            }
            // 插入尾端
            else {
                __lv_idx = useFolderState.getState().folders.length;
                useFolderState.getState().folders.splice(__lv_idx, 0, folder);
            }

            useItemState.getState().folderMappings[folder.id] = folder;
			addToRecentFolders([folder.id]);
			
            setTimeout(function() { 
                machineryChangeSidebarIndex(folder); 
                scopeEvalAsync();
                setTimeout(function() { const el = q("#folder-input-" + folder.id); focusOn(el); selectText(el); }, 100);
                setTimeout(function() { const el = q("#folder-input-" + folder.id); focusOn(el); selectText(el); }, 200);
            }, 150);

            setTimeout(function() { 
                machineryChangeSidebarIndex(folder); 
                scopeEvalAsync();
                setTimeout(function() { 
                    if (!q("#folder-input-" + folder.id + ":focus")) {
                        const el = q("#folder-input-" + folder.id); focusOn(el); selectText(el);
                    }
                }, 100);
            }, 250);

            machineryUpdateSidebarList();

            // Note: 如果用戶當前選擇多個文件，表示正在分類，這時候不要跳轉是比較好的選擇
            if (useSelectionState.getState().selected.length === 0 && !ignoreAutoOpen) {
                openFolder(folder);
            }
            setTimeout(function() {
                machineryCalculateImageBinding({ ignoreSort: true }, function() {
                    machineryRefreshSubfolderList();
                    machinerySaveFolder();
                    if (folder.parent) {
                        electronLog && electronLog.info(`[app] New sub-folder: ${folder.id}, parent: ${folder.parent}`);
                    }
                    else {
                        electronLog && electronLog.info(`[app] New folder: ${folder.id}`);
                    }
                    analytics.event('Folder', 'Create');
                });
            }, 300);
        }).apply(null, args);
}

export function newFolderWidthSelection(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function () {
        swal({
            html: `
                <div class="alert">
                    <div class="alert-icon create"></div>
                    <h4 class="alert-title">${i18n.__("dialog.createFolderWithItems.title")}</h4>
                    <p class="alert-desc">${i18n.__("dialog.createFolderWithItems.desc")}</p>
                </div>
            `,
            showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
            width: 400,
            customClass: "alert-box",
            cancelButtonColor: "#777777",
            confirmButtonText: i18n.__("dialog.createFolderWithItems.createBtn"),
            cancelButtonText: i18n.__("general.cancel"),
            input: 'text',
            inputPlaceholder: "",
            inputValue: '',
        }).then(function (name) {
            function sanitizeFolderName(folderName) {
                if (typeof folderName !== 'string') return '';

                // 移除 tab，統一空白
                folderName = folderName.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();

                if (process.platform === 'darwin') {
                    // macOS：僅移除冒號與斜線
                    folderName = folderName
                        .replace(/[:\/\\]/g, ' ')  // 移除冒號、正反斜線
                        .trim();
                } else {
                    // Windows：移除非法字元與控制碼
                    folderName = folderName
                        .replace(/[<>:"\/\\|?*\x00-\x1F]/g, '')  // 非法字元與控制碼
                        .replace(/[ ]+$/, '')                    // 結尾空白
                        .replace(/[.]+$/, '')                    // 結尾句點
                        .trim();

                    // 避免使用保留名稱
                    const reservedNames = new Set([
                        'CON', 'PRN', 'AUX', 'NUL',
                        'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
                        'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
                    ]);
                    if (reservedNames.has(folderName.toUpperCase())) {
                        folderName += '_';
                    }
                }

                return folderName;
            }

            var folderName = sanitizeFolderName(name);

            var folderId = guid();
            var folder = {
                id: folderId,
                name: folderName,
                images: [],
                folders: [],
                modificationTime: Date.now(),
                editable: false,
                imagesMappings: {},
                tags: [],
                children: [],
                isExpand: true,
            };
            useFolderState.getState().folders.splice(useFolderState.getState().folders.length, 0, folder);
            useItemState.getState().folderMappings[folder.id] = folder;
            machineryUpdateSidebarList();
            addToRecentFolders([folder.id]);

            // 添加圖片
            useSelectionState.getState().selected.forEach(function(image) {
                if (!image.folders) image.folders = [];
                image.folders.push(folderId);
            });
            ayncsImagesChange(useSelectionState.getState().selected);
            hiddenByCurrentFilter(useSelectionState.getState().selected);
            machineryCalculateImageBinding({ ignoreSort: true }, function() {
                machineryRebindRefresh();
            });
            openFolder(folder);
            setTimeout(function() {
                machinerySaveFolder();
            }, 1000);
            electronLog && electronLog.info(`[app] Create new folder ${folder.name}(${folder.id}) with ${useSelectionState.getState().selected.length} files`);
            analytics.event('Folder', 'Create-With-Images', folder.name);
        });
    }).apply(null, args);
}

export function addImagesToFolder(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function (images, folder) {

            var origin = [];
            var originFolders = [];
            var originTags = [];

            // 同一個資料夾，不需要移動
            if (images.length === 1 && images[0].folders.indexOf(folder.id) !== -1) {
                return;
            }

            // 移除當前文件夾，放到新的文件夾
            images.forEach(function(image) {

                origin.push(image);
                originFolders.push(Array.isArray(image.folders) ? image.folders.slice() : image.folders);
                originTags.push(Array.isArray(image.tags) ? image.tags.slice() : image.tags);

                if (!image.folders) image.folders = [];
                if (!image.tags) image.tags = [];
                if (image.folders.indexOf(folder.id) === -1) {
                    image.folders.push(folder.id);
                    if (folder.extendTags) {
                        folder.extendTags.forEach(function(tag) {
                            if (image.tags.indexOf(tag) === -1) {
                                image.tags.push(tag);
                            }
                        });
                    }
                }
                image.isDeleted = false;

            });
            ayncsImagesChange(images);
            hiddenByCurrentFilter(images);
            machineryCalculateImageBinding({ ignoreSort: true }, function () {
                machineryRebindRefresh(true);
                machineryUpdateSelection();
            });

            var message = $filter('i18n')("notify.image.moveToFolder", [
                { "property": "imageCount", "value": images.length },
                { "property": "folderName", "value": folder.name }
            ]);
            if (images.length === 1) { message = message.replace("images", "image"); }

            useMiscRawState.getState().notify({
                message: message,
                duration: 4000,
            }, function () {
                origin.forEach(function (image, index) {
                    image.folders = originFolders[index];
                    image.tags = originTags[index];
                });
                writeScopeField('images', origin);
                writeScopeField('current', origin[0]);
                syncDetailFromScope();
                syncInspectorFromScope();
                machineryCalculateImageBinding({ ignoreSort: true }, function () {
                    machineryRebindRefresh();
                    machineryUpdateSelection();
                });
                ayncsImagesChange(origin);
            });

            electronLog && electronLog.info(`[app] Categorize ${images.length} files to ${folder.name}(${folder.id})`);
            analytics.event('File', 'Categorize', 'Context');
        }).apply(null, args);
}

export function moveFoldersAsSibling(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function (folders, folder, isBottom) {

            if (!folder || !folders || folders.length === 0) return;

            // 避免自己拖拽到自己的 Childred
            if (folders.indexOf(folder) > -1) return;
            
            // 避免老爸拖拽到子孙
            var ancestors = machineryGetAncestorFolders(folder, []);
            for (let i = 0; i < folders.length; i++) {
                const ancestor = folders[i];
                if (ancestors.indexOf(ancestor) > -1) {
                    return;
                }
            }

            var moved = {};
            var children = machineryGetFolderParentChilder(folder);
            var __lv_idx = -1;

            if (!children) return;

            __lv_idx = children.indexOf(folder);

            if (__lv_idx === -1)  return;

            folders.forEach(function (folder) {
                moved[folder.id] = folder;
            });

            // 重新排序资料夹（依据视觉顺序）
            folders.sort(function (a, b) {
                try {
                    var aIdx = offsetTopOf(q("#folder-" + a.id));
                    var bIdx = offsetTopOf(q("#folder-" + b.id));
                    if (aIdx < bIdx)
                    return -1;
                    if (aIdx > bIdx)
                        return 1;
                    return 0;
                }
                catch (err) {
                    // debugger
                    return 0;
                }
            });

            var clone = [];
            cloneTree(clone, useFolderState.getState().folders, true);

            try {
                for (var i = folders.length - 1; i >= 0; i--) {
                    var f = folders[i];
                    var p = f.parent;
                    if (f.id === folder.id) break;
                    if (!f.parent || !moved[f.parent]) {
                        // 从原来位置移除
                        var ch;
                        var index = -1;
                        if (p && useItemState.getState().folderMappings[p].children) {
                            ch = useItemState.getState().folderMappings[p].children;
                        }
                        else {
                            ch = useFolderState.getState().folders;
                        }
                        index = ch.indexOf(f);
                        if (index > -1) {
                            ch.splice(index, 1);
                        }
                    }
                }

                __lv_idx = children.indexOf(folder);

                for (var j = folders.length - 1; j >= 0; j--) {
                    var f = folders[j];
                    // 如果老爸也被移动，孩子就不需要在移动了
                    if (!f.parent || !moved[f.parent]) {
                        if (!folder.parent) {
                            delete f.parent;
                        }
                        else {
                            f.parent = folder.parent;
                        }
                        if (!isBottom) {
                            children.splice(__lv_idx, 0, f);
                        }
                        else {
                            children.splice(__lv_idx + 1, 0, f);
                        }
                    }
                }
                machineryUpdateSidebarList();
                machinerySaveFolder();
                try {
                    electronLog && electronLog.info(`[app] Drag ${folders.length} folders as ${folder.name}(${folder.id}) sibling`);
                } catch (err) {};
            }
            catch (err) {
                writeScopeField('folders', clone);
                electronLog && electronLog.error(err.stack || err);
            }
        }).apply(null, args);
}

export function moveFoldersToFolder(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function (folders, folder) {

            if (!folder || !folders || folders.length === 0) return;
        
            // 避免自己拖拽到自己的 Childred
            if (folders.indexOf(folder) > -1) return;

            // 避免老爸拖拽到子孙
            var ancestors = machineryGetAncestorFolders(folder, []);
            for (let i = 0; i < folders.length; i++) {
                const ancestor = folders[i];
                if (ancestors.indexOf(ancestor) > -1) {
                    return;
                }
            }

            if (!folder.children) {
                folder.children = [];
            }

            var moved = {};
            var children = folder.children;

            folders.forEach(function (folder) {
                moved[folder.id] = folder;
            });

            // 重新排序资料夹（依据视觉顺序）
            folders.sort(function (a, b) {
                try {
                    var aIdx = offsetTopOf(q("#folder-" + a.id));
                    var bIdx = offsetTopOf(q("#folder-" + b.id));
                    if (aIdx < bIdx)
                    return -1;
                    if (aIdx > bIdx)
                        return 1;
                    return 0;
                }
                catch (err) {
                    // debugger
                    return 0;
                }
            });

            var clone = [];
            cloneTree(clone, useFolderState.getState().folders, true);

            try {

                for (var i = folders.length - 1; i >= 0; i--) {
                    var f = folders[i];
                    var p = f.parent;
                    if (f.id === folder.id) break;
                    if (!f.parent || !moved[f.parent]) {
                        // 从原来位置移除
                        var ch;
                        var index = -1;
                        if (p && useItemState.getState().folderMappings[p].children) {
                            ch = useItemState.getState().folderMappings[p].children;
                        }
                        else {
                            ch = useFolderState.getState().folders;
                        }
                        index = ch.indexOf(f);
                        if (index > -1) {
                            ch.splice(index, 1);
                        }
                    }
                }

                for (let j = 0; j < folders.length; j++) {
                    var f = folders[j];
                    // 如果老爸也被移动，孩子就不需要在移动了
                    if (!moved[f.parent]) {
                        f.parent = folder.id;
                        children.push(f);
                    }
                }

                folder.isExpand = true;
                machineryUpdateSidebarList();
                machinerySaveFolder();
                try {
                    electronLog && electronLog.info(`[app] Drag ${folders.length} folders as ${folder.name}(${folder.id}) children`);
                } catch (err) {};
            }
            catch (err) {
                writeScopeField('folders', clone);
                electronLog && electronLog.error(err.stack || err);
            }
        }).apply(null, args);
}

export function emptyRestore(...args: any[]) {
    return (function () {
            if (useItemState.getState().trash && useItemState.getState().trash.length > 0) {
                swal({
                    html: `
                        <div class="alert">
                            <div class="alert-icon warning"></div>
                            <h4 class="alert-title">${i18n.__('dialog.restoreAll.title')}</h4>
                            <p class="alert-desc">${i18n.__("dialog.restoreAll.desc")}</p>
                        </div>
                    `,
                    showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: false, focusCancel: false, padding: 24,
                    width: 400,
                    customClass: "alert-box",
                    cancelButtonColor: "#777777",
                    confirmButtonText: i18n.__('dialog.restoreAll.button'),
                    cancelButtonText: i18n.__("general.cancel"),
                }).then(function () {
                    var changes = [];
                    let now = Date.now();
                    useItemState.getState().trash.forEach(function(image: any) {
                        image.isDeleted = false;
                        changes.push(image);
                        machineryUpdateFilterCounts(image, -1, now);
                        // ipcRenderer.send('image-change', image);
                    });
                    if (changes.length > 0) {
                        ayncsImagesChange(changes);
                        try { electronLog && electronLog.info(`[app] Restore ${changes.length} files from trash`); } catch (err) {};
                    }
                    writeScopeField('trash', []);
                    syncSidebarFromScope();
                    syncListFromScope();

                    machineryCalculateImageBinding({ ignoreSort: true }, function() {
                        machineryRebindRefresh();
                        machineryUpdateSelection();
                        scopeEvalAsync();
                    });
                });
            }
    }).apply(null, args);
}

// ═══ b1-9bz-A：controllerFns 表体归位（逐字平移；getScope()→getBodyScope()；表项指针化）═══
// —— controllerFns 模块级声明随迁（verbatim；按原声明顺序防 TDZ）——
const currentWindow: any = (window as any).electron?.remote?.getCurrentWindow?.() || _req('@electron/remote')?.getCurrentWindow?.();

const FixUtils: any = {};

const $timeout: any = (fn: any, ms?: number) => setTimeout(() => {
  try { if (typeof fn === 'function') fn(); } finally { try { scopeEvalAsync(); } catch (err) { /* noop */ } }
}, ms || 0);
// b1-9bz-A 收口：`$timeout.cancel(timer)` 是 Angular 注入服务的第二形态（详见 filterDomain
// 同款注释）。本落点此前只有调用形态 → openSmartFolder/openUnfiled 的
// __lv_openSmartFolderTimeout/__lv_openUnfiledTimeout 取消点 `$timeout.cancel is not a
// function` 即抛，且被上层 electronLog 缺席的 catch 静默吞掉。语义 = 取消延时执行。
$timeout.cancel = function (timer: any): boolean {
  if (timer === null || timer === undefined) return false;
  try { clearTimeout(timer); } catch (err) { /* noop */ }
  return true;
};

// —— link 级共享态（原 makeControllerFns 闭包声明）——
var __lv_image: any;
var __lv_openSmartFolderTimeout: any;
var __lv_openUnfiledTimeout: any;
var __lv_path: any;
var __lv_setLastFolder: any;
var __lv_updateListHeight: any;

let lvInited = false;
const initLinkVars = () => {
  if (lvInited) return;
  lvInited = true;
  // __lv_path（原 initLinkVars 逐字）
        __lv_path = _req('path');

  // __lv_updateListHeight（原 initLinkVars 逐字）
        __lv_updateListHeight = function (height: any) {
              clearTimeout(updateListHeightTimeout);
              updateListHeightTimeout = setTimeout(function () {
                  setAttr("#box-container", "box-size", height);
              }, 50);
          };
  // __lv_setLastFolder（原 initLinkVars 逐字）
        __lv_setLastFolder = debounce(function setLastFolder (folderId: any) {
              if (!folderId) {
                  localStorage.removeItem(`eagle.lastFolder.${useMiscRawState.getState().rootDir}`);
              }
              else {
              	machinerySetViewMode("all");
                  localStorage.setItem(`eagle.lastFolder.${useMiscRawState.getState().rootDir}`, folderId);
              }
          }, 500);
};

const getScope = getBodyScope;  // b1-9bz-A：原 makeControllerFns(getScope) 注入的等价别名

export function getLibraryHistory(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function (length) {
            let result = [];
            useMiscRawState.getState().libraryHistory.forEach(function (history, index) {

                var libraryName = __lv_path.basename(history).replace('.library', '');
                var libraryPath = __lv_path.dirname(history).replace(/\\$/g, "").replace(/\/$/, "");

                if (length === undefined) {
                    result.push({
                        name: libraryName,
                        dir: libraryPath,
                        path: history
                    });
                }
                else if (index + 1 < length) {
                    result.push({
                        name: libraryName,
                        dir: libraryPath,
                        path: history
                    });
                }
            });
            return result;
    }).apply(null, args);
  }

export function openFolder(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function(fd, ignoreHistory, currentId, ignoreReload, focus) {
            const folder = useItemState.getState().folderMappings[fd?.id];

            if (!folder) return;
            
            // Skip if already in the same folder, but NOT when navigating from URL (ignoreHistory = true)
            // Also check viewMode to ensure we're not coming from a different view type
            if (!ignoreHistory && useFolderState.getState().currentFolder === folder && !useBodyState.getState().viewMode && (useItemState.getState().allData.length > 0 || useMiscRawState.getState().subFolders.length > 0) && eagle.filter.filterRules.color.value == undefined &&
                eagle.filter.filterRules.import.type == 'undefined' && useMiscRawState.getState().currentId === currentId
            ) {
                if (useBodyState.getState().isDetailMode) {
                    machineryLeaveDetailMode();
                }
                return;
            }

            ScrollbarSaver.saveScrollPosition();

            writeScopeField('currentSmartFolder', undefined);
            syncPanelFromScope();
            syncListFromScope();
            writeScopeField('currentFocus', focus || "sidebar");
            machineryResetPage();
            writeScopeField('viewMode', undefined);
            writeScopeField('currentId', currentId || "folder-" + folder.id);
            syncSidebarFromScope();
            writeScopeField('currentFolderPath', getFolderFullPath(folder));
            syncToolbarFromScope();
            if (useFolderState.getState().currentFolder != folder) {
                writeScopeField('currentFolder', folder);
                syncPanelFromScope();
                syncFolderLock();
                syncListFromScope();
                writeScopeField('currentFolderChildren', machineryGetChildFoldersMap(folder));
            }

			if (localStorage[`eagle.list.layout.${useFolderState.getState().currentFolder.id}`]) {
                if (useBodyState.getState().layout !== localStorage[`eagle.list.layout.${useFolderState.getState().currentFolder.id}`]) {
                    machinerySwitchLayout(localStorage[`eagle.list.layout.${useFolderState.getState().currentFolder.id}`]);
                }
			}

            if (!currentId || currentId.indexOf("quickaccess-") === -1) {
	            var ancestors = machineryGetAncestorFolders(folder, []);
	            if (ancestors.length > 0) {
	                for (var i = 0; i < ancestors.length; i++) {
	                    machineryExpandFolder(ancestors[i]);
	                }
	            }
            }

            if (!ignoreHistory) {
                UrlStateService.setState({ 
                    view: 'folder', 
                    folder: folder.id,
                    smartfolder: null,
                    tag: null,
                    color: null,
                    page: useMiscRawState.getState().page
                });
            }

            var __lv_height = localStorage.getItem("eagle.list.thumbSize." + folder.id) || 150;
            __lv_height = parseInt(__lv_height);
            useLayoutState.getState().imageSize.height = parseInt(__lv_height / 5) * 5;
            syncToolbarFromScope();
            syncBodyFromScope();
            syncDetailFromScope();
            syncInspectorFromScope();
            __lv_updateListHeight(useLayoutState.getState().imageSize.height);
            if (!ignoreReload) {
                ScrollbarSaver.restoreScrollPosition();
                useMiscRawState.getState().reload();
            }
            else {
                machineryRebindRefresh();
            }
            if (useFolderState.getState().currentFolder) {
                __lv_setLastFolder(useFolderState.getState().currentFolder.id);
            }

            analytics.screenView('Folder');
            
            // 如果文件夾有密碼且未解鎖，並且支援 Touch ID，自動觸發 Touch ID 驗證
            if (useFolderState.getState().currentFolder && useFolderState.getState().currentFolder.password && !useFolderState.getState().currentFolder.isUnLock) {
                if (useMiscRawState.getState().canUseTouchID) {
                    // 延遲一下以確保 UI 已渲染
                    $timeout(function () {
                        machineryUnlockFolderWithTouchID();
                    }, 500);
                }
            }
        }).apply(null, args);
  }

export function openSmartFolder(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function(smartFolder, ignoreHistory, currentId) {
            if (!smartFolder) return;
            if (useFolderState.getState().currentSmartFolder === smartFolder && useItemState.getState().allData.length > 0 && eagle.filter.filterRules.color.value == undefined &&
                eagle.filter.filterRules.import.type == 'undefined' && useMiscRawState.getState().currentId === currentId
            ) {
                if (useBodyState.getState().isDetailMode) {
                    machineryLeaveDetailMode();
                }
                return;
            }

            ScrollbarSaver.saveScrollPosition();

            if (useFolderState.getState().currentFolder) { useFolderState.getState().currentFolder.editable = false; }
            if (useFolderState.getState().currentSmartFolder) { useFolderState.getState().currentSmartFolder.editable = false; }

            writeScopeField('currentFolder', undefined);
            syncPanelFromScope();
            syncFolderLock();
            syncListFromScope();
            eagle.inspector.reset();
            writeScopeField('currentFolderChildren', undefined);
            writeScopeField('selectedSmartFoldersMappings', {});
            writeScopeField('selectedSmartFolders', []);
            writeScopeField('currentFocus', "sidebar");
            machineryResetPage();
            writeScopeField('viewMode', undefined);
            writeScopeField('currentId', currentId || "smart-folder-" + smartFolder.id);
            syncSidebarFromScope();

            if (useFolderState.getState().currentSmartFolder != smartFolder) {
                writeScopeField('currentSmartFolder', smartFolder);
                syncPanelFromScope();
                syncListFromScope();
            }

			if (localStorage[`eagle.list.layout.${useFolderState.getState().currentSmartFolder.id}`]) {
				machinerySwitchLayout(localStorage[`eagle.list.layout.${useFolderState.getState().currentSmartFolder.id}`]); 
			}

            if (!currentId || currentId.indexOf("quickaccess-") === -1) {
	            var ancestors = machineryGetAncestorSmartFolders(smartFolder, []);
	            if (ancestors.length > 0) {
	                for (var i = 0; i < ancestors.length; i++) {
	                    machineryExpandSmartFolder(ancestors[i]);
	                }
	            }
            }

            $timeout.cancel(__lv_openSmartFolderTimeout);
            __lv_openSmartFolderTimeout = $timeout(function() {
                if (!ignoreHistory) {
                    UrlStateService.setState({
                        view: 'smartfolder',
                        smartfolder: smartFolder.id,
                        folder: null,
                        tag: null,
                        color: null
                    });
                }
                useLayoutState.getState().imageSize.height = localStorage.getItem("eagle.list.thumbSize." + smartFolder.id) || 150;
                syncToolbarFromScope();
                syncBodyFromScope();
                syncDetailFromScope();
                syncInspectorFromScope();
                useLayoutState.getState().imageSize.height = parseInt(useLayoutState.getState().imageSize.height);
                syncToolbarFromScope();
                syncBodyFromScope();
                syncDetailFromScope();
                syncInspectorFromScope();
                __lv_updateListHeight(useLayoutState.getState().imageSize.height);
                ScrollbarSaver.restoreScrollPosition();
                useMiscRawState.getState().reload();
                analytics.screenView('SmartFolder');

                if (useFolderState.getState().currentSmartFolder) {
	                __lv_setLastFolder(useFolderState.getState().currentSmartFolder.id);
	            }

            }, 25);
        }).apply(null, args);
  }

export function openUnfiled(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版等价（s.leaveDetailMode/resetPage/reload 挂载即 machinery 版）。
   // 原 c3 体的 scope 守卫，逐字保留
  machineryOpenUnfiled(args[0]);
}

export function smartFolderCount(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版等价，统一转发消除重复实现。
   // 原 c3 体的 scope 守卫，逐字保留
  machinerySmartFolderCount(args[0]);
}

export function switchLibrary(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function (event) {
            var shortcutMode = event.button === undefined;
            var openFixUtils = event && (event.altKey || event.metaKey || event.ctrlKey);
            if (openFixUtils && !shortcutMode) {
                FixUtils.openContextMenu();
            }
            else {
                // b1-9ba：OPEN_LIBRARY_PANEL 廣播全樹無接收者（library-panel 指令檔從未
                // 掛載，bundle 摘除後徹底死亡）——廣播體移除；程式庫面板豎切時按 React
                // 語義歸位。
            }
        }).apply(null, args);
  }

export function duplicateItem(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function (event) {
            event && event.preventDefault();
            event && event.stopPropagation();
            if (useSelectionState.getState().selected[0]) {
                ipcRenderer.send('duplicate-file', useSelectionState.getState().selected[0].id);
            }
        }).apply(null, args);
  }

export function exportFolder(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function(callback) {
        dialog.showOpenDialog(currentWindow, {
            title: $filter('i18n')('dialog.exportAsFolder.title'),
            filters: [],
            properties: ['openDirectory', 'createDirectory'],
            buttonLabel: $filter('i18n')("dialog.exportAsFolder.botton")
        }).then(result => {
            var paths = result.filePaths;
            if (paths && paths[0]) {
                var savePath = paths[0];
                callback(savePath)
            }
            else {
                callback(undefined);
            }
        });
    }).apply(null, args);
  }

export function checkDiskSpace(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function(path, needSpace, callback) {
        callback && callback();
    }).apply(null, args);
  }


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
export function machineryOpenAll(ignoreHistory: any, callback: any): void {
  const w = window as any;
  const $timeout = getTimeout();

  if (useBodyState.getState().viewMode === 'all' && useItemState.getState().allData.length > 0 && w.eagle.filter.filterRules.color.value == undefined) {
    if (callback) {
      callback();
    }
    if (useBodyState.getState().isDetailMode) {
      machineryLeaveDetailMode();
    }
    return;
  }

  w.ScrollbarSaver.saveScrollPosition();

  writeScopeField('viewMode', 'all');
  writeScopeField('currentFocus', "sidebar");
  machineryResetPage();

  $timeout.cancel(openAllTimeout);
  openAllTimeout = $timeout(function () {
    if (!ignoreHistory) {
      useMiscRawState.getState().UrlStateService.setState({ view: 'all', folder: null, smartfolder: null, tag: null, color: null });
    }
    useLayoutState.getState().imageSize.height = localStorage.getItem("eagle.list.thumbSize.all") || 150;
    syncToolbarFromScope();
    syncBodyFromScope();
    syncDetailFromScope();
    syncInspectorFromScope();
    useLayoutState.getState().imageSize.height = parseInt(useLayoutState.getState().imageSize.height);
    // b1-9bz-C-4：原 $watch("imageSize.height") 在 flush 时触发 —— 改为写入点直调
    machineryOnImageSizeHeightChanged();
    syncToolbarFromScope();
    syncBodyFromScope();
    syncDetailFromScope();
    syncInspectorFromScope();
    machinerySetLastFolder(undefined);
    machineryUpdateListHeight(useLayoutState.getState().imageSize.height);
    w.ScrollbarSaver.restoreScrollPosition();
    setScrollTop("#sidebar-item-container", 0);
    useMiscRawState.getState().reload();
    if (callback) {
      callback();
    }
    w.analytics.screenView('All');
  }, 50);
}

export function machineryOpenCommunity(ignoreHistory: any): void {
  const w = window as any;
  w.ScrollbarSaver.saveScrollPosition();
  writeScopeField('viewMode', 'community');
  writeScopeField('currentFocus', "sidebar");
  machineryResetPage();
  writeScopeField('images', []);
  writeScopeField('isDetailMode', false);
  writeScopeField('selected', []);
  syncInspectorFromScope();
  if (!ignoreHistory) {
    w.UrlStateService.setState({ view: 'community', folder: null, smartfolder: null, tag: null, color: null });
  }

  let lng2locale: any = {
    "zh_CN": "cn",
    "zh_TW": "tw",
    "ja_JP": "jp"
  };
  let baseUrl = `https://community-${lng2locale[w.preferences.general.language] || "en"}.eagle.cool`;
  openUrlInPanelChannel.emit(`${baseUrl}`);
  machineryLeaveDetailMode();
}

export function machineryOpenRandom(ignoreHistory: any, callback: any): void {
  const w = window as any;
  const $timeout = getTimeout();
  if (useBodyState.getState().viewMode === 'random' && useItemState.getState().allData.length > 0 && w.eagle.filter.filterRules.color.value == undefined) {
    if (callback) {
      callback();
    }
    if (useBodyState.getState().isDetailMode) {
      machineryLeaveDetailMode();
    }
    return;
  }

  writeScopeField('viewMode', 'random');
  machineryResetPage();
  writeScopeField('currentFocus', "sidebar");

  hide("#image-drop-area");
  $timeout.cancel(openRandomTimeout);
  openRandomTimeout = $timeout(function () {
    if (!ignoreHistory) {
      w.UrlStateService.setState({ view: 'random', folder: null, smartfolder: null, tag: null, color: null });
    }
    useLayoutState.getState().imageSize.height = w.localStorage.getItem("eagle.list.thumbSize.random") || 150;
    syncToolbarFromScope();
    syncBodyFromScope();
    syncDetailFromScope();
    syncInspectorFromScope();
    useLayoutState.getState().imageSize.height = parseInt(useLayoutState.getState().imageSize.height);
    syncToolbarFromScope();
    syncBodyFromScope();
    syncDetailFromScope();
    syncInspectorFromScope();
    machinerySetLastFolder(undefined);
    setScrollTop("#sidebar-item-container", 0);
    useMiscRawState.getState().reload();
    if (callback) {
      callback();
    }
    w.analytics.screenView('Random');
  }, 50);
}

// ── c15d 域内自管（原 controller 闭包 var）──
export let openAllTimeout: any = null;

// ── c18g-2 域内自管（原 controller 闭包 var：openRandomTimeout 36758 邻域 /
//    openUnfiledTimeout 36773 / openUntaggedTimeout 36804 / openRecentTimeout 36835 /
//    openTrashTimeout 36968）──
let openRandomTimeout: any = null;
