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
import { getBodyScope } from '../global/scopeBridge';
import { getFilter as machineryGetFilter, machineryGetFolderParentChilder } from '../core/dataMachinery';
import { syncListFromScope } from '../store/listState';
import { syncSidebarFromScope } from '../store/sidebarState';
import { syncInspectorFromScope } from '../store/inspectorState';
import { syncDetailFromScope } from '../store/detailState';

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
export function installFolderCoreFns(fns: any, getScope: any): void {
  fns["createFolder"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
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
                const siblingParent = s.folderMappings[sibling.parent];
                let index;
                if (siblingParent) {
                    index = siblingParent.children.indexOf(sibling);
                    if (index === -1) index = siblingParent.children.length - 1;
                    siblingParent.children.splice(index + 1, 0, folder);
                }
                else {
                    index = s.folders.indexOf(sibling);
                    if (index === -1) index = s.folders.length - 1;
                    s.folders.splice(index + 1, 0, folder);
                }
            }
            // 添加成為孩子
            else if (parentID) {
                const parent = s.folderMappings[parentID];
                if (parent) {
                    parent.children.splice(0, 0, folder);
                }
            }
            // 添加在第一層
            else {
                if (position === "top") {
                    s.folders.splice(0, 0, folder);
                }
                else if (position === "bottom") {
                    s.folders.splice(s.folders.length, 0, folder);
                }
            }

            s.folderMappings[folder.id] = folder;
            s.addToRecentFolders([folder.id]);
            s.updateSidebarList();
            s.calculateImageBinding({ ignoreSort: true }, function() {
                s.refreshSubfolderList();
                s.saveFolder();
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
  };

  fns["newFolder"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
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
                var father = s.folderMappings[parent.parent];
                var children = (father && father.children) ? father.children : s.folders;
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
            else if (s.currentFolder || parent) {
				var __lv_target = parent;
                var parent = parent || s.folderMappings[s.currentFolder.parent];
                var children = (parent && parent.children) ? parent.children : s.folders;
                var __lv_idx = children.indexOf(s.currentFolder);
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
                    else if (s.currentFolder) {
                        if (parent && parent.icon === s.currentFolder.icon) {
                            folder.icon = parent.icon;
                        }
                        if (parent && parent.iconColor === s.currentFolder.iconColor) {
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
                    folder.parent = s.currentFolder.parent;
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
                __lv_idx = s.folders.length;
                s.folders.splice(__lv_idx, 0, folder);
            }

            s.folderMappings[folder.id] = folder;
			s.addToRecentFolders([folder.id]);
			
            setTimeout(function() { 
                s.changeSidebarIndex(folder); 
                s.$evalAsync();
                setTimeout(function() { $("#folder-input-" + folder.id).focus().select(); }, 100);
                setTimeout(function() { $("#folder-input-" + folder.id).focus().select(); }, 200);
            }, 150);

            setTimeout(function() { 
                s.changeSidebarIndex(folder); 
                s.$evalAsync();
                setTimeout(function() { 
                    if ($("#folder-input-" + folder.id + ":focus").length === 0) {
                        $("#folder-input-" + folder.id).focus().select(); 
                    }
                }, 100);
            }, 250);

            s.updateSidebarList();

            // Note: 如果用戶當前選擇多個文件，表示正在分類，這時候不要跳轉是比較好的選擇
            if (s.selected.length === 0 && !ignoreAutoOpen) {
                s.openFolder(folder);
            }
            setTimeout(function() {
                s.calculateImageBinding({ ignoreSort: true }, function() {
                    s.refreshSubfolderList();
                    s.saveFolder();
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
  };

  // newFolderWidthSelection（bundle 40442-40531 全体，含 sanitizeFolderName 内层）
  fns["newFolderWidthSelection"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
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
            s.folders.splice(s.folders.length, 0, folder);
            s.folderMappings[folder.id] = folder;
            s.updateSidebarList();
            s.addToRecentFolders([folder.id]);

            // 添加圖片
            s.selected.forEach(function(image) {
                if (!image.folders) image.folders = [];
                image.folders.push(folderId);
            });
            ayncsImagesChange(s.selected);
            hiddenByCurrentFilter(s.selected);
            s.calculateImageBinding({ ignoreSort: true }, function() {
                s.rebindRefresh();
            });
            s.openFolder(folder);
            setTimeout(function() {
                s.saveFolder();
            }, 1000);
            electronLog && electronLog.info(`[app] Create new folder ${folder.name}(${folder.id}) with ${s.selected.length} files`);
            analytics.event('Folder', 'Create-With-Images', folder.name);
        });
    }).apply(null, args);
  };

  fns["addImagesToFolder"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
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
            s.calculateImageBinding({ ignoreSort: true }, function () {
                s.rebindRefresh(true);
                s.updateSelection();
            });

            var message = $filter('i18n')("notify.image.moveToFolder", [
                { "property": "imageCount", "value": images.length },
                { "property": "folderName", "value": folder.name }
            ]);
            if (images.length === 1) { message = message.replace("images", "image"); }

            s.notify({
                message: message,
                duration: 4000,
            }, function () {
                origin.forEach(function (image, index) {
                    image.folders = originFolders[index];
                    image.tags = originTags[index];
                });
                s.images = origin;
                s.current = origin[0];
                syncDetailFromScope();
                syncInspectorFromScope();
                s.calculateImageBinding({ ignoreSort: true }, function () {
                    s.rebindRefresh();
                    s.updateSelection();
                });
                ayncsImagesChange(origin);
            });

            electronLog && electronLog.info(`[app] Categorize ${images.length} files to ${folder.name}(${folder.id})`);
            analytics.event('File', 'Categorize', 'Context');
        }).apply(null, args);
  };

  fns["moveFoldersAsSibling"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (folders, folder, isBottom) {

            if (!folder || !folders || folders.length === 0) return;

            // 避免自己拖拽到自己的 Childred
            if (folders.indexOf(folder) > -1) return;
            
            // 避免老爸拖拽到子孙
            var ancestors = s.getAncestorFolders(folder, []);
            for (let i = 0; i < folders.length; i++) {
                const ancestor = folders[i];
                if (ancestors.indexOf(ancestor) > -1) {
                    return;
                }
            }

            var moved = {};
            var children = machineryGetFolderParentChilder(s, folder);
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
                    var aIdx = $("#folder-" + a.id).offset().top;
                    var bIdx = $("#folder-" + b.id).offset().top;
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
            cloneTree(clone, s.folders, true);

            try {
                for (var i = folders.length - 1; i >= 0; i--) {
                    var f = folders[i];
                    var p = f.parent;
                    if (f.id === folder.id) break;
                    if (!f.parent || !moved[f.parent]) {
                        // 从原来位置移除
                        var ch;
                        var index = -1;
                        if (p && s.folderMappings[p].children) {
                            ch = s.folderMappings[p].children;
                        }
                        else {
                            ch = s.folders;
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
                s.updateSidebarList();
                s.saveFolder();
                try {
                    electronLog && electronLog.info(`[app] Drag ${folders.length} folders as ${folder.name}(${folder.id}) sibling`);
                } catch (err) {};
            }
            catch (err) {
                s.folders = clone;
                electronLog && electronLog.error(err.stack || err);
            }
        }).apply(null, args);
  };

  fns["moveFoldersToFolder"] = function (...args) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getScope();
    if (!s) return;
    return (function (folders, folder) {

            if (!folder || !folders || folders.length === 0) return;
        
            // 避免自己拖拽到自己的 Childred
            if (folders.indexOf(folder) > -1) return;

            // 避免老爸拖拽到子孙
            var ancestors = s.getAncestorFolders(folder, []);
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
                    var aIdx = $("#folder-" + a.id).offset().top;
                    var bIdx = $("#folder-" + b.id).offset().top;
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
            cloneTree(clone, s.folders, true);

            try {

                for (var i = folders.length - 1; i >= 0; i--) {
                    var f = folders[i];
                    var p = f.parent;
                    if (f.id === folder.id) break;
                    if (!f.parent || !moved[f.parent]) {
                        // 从原来位置移除
                        var ch;
                        var index = -1;
                        if (p && s.folderMappings[p].children) {
                            ch = s.folderMappings[p].children;
                        }
                        else {
                            ch = s.folders;
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
                s.updateSidebarList();
                s.saveFolder();
                try {
                    electronLog && electronLog.info(`[app] Drag ${folders.length} folders as ${folder.name}(${folder.id}) children`);
                } catch (err) {};
            }
            catch (err) {
                s.folders = clone;
                electronLog && electronLog.error(err.stack || err);
            }
        }).apply(null, args);
  };

  fns["emptyRestore"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function () {
            if (s.trash && s.trash.length > 0) {
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
                    s.trash.forEach(function(image: any) {
                        image.isDeleted = false;
                        changes.push(image);
                        s.updateFilterCounts(image, -1, now);
                        // ipcRenderer.send('image-change', image);
                    });
                    if (changes.length > 0) {
                        ayncsImagesChange(changes);
                        try { electronLog && electronLog.info(`[app] Restore ${changes.length} files from trash`); } catch (err) {};
                    }
                    s.trash = [];
                    syncSidebarFromScope();
                    syncListFromScope();

                    s.calculateImageBinding({ ignoreSort: true }, function() {
                        s.rebindRefresh();
                        s.updateSelection();
                        s.$evalAsync();
                    });
                });
            }
    }).apply(null, args);
  };
}
