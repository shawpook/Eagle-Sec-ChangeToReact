/**
 * b1-9bq：batchOpsService —— 批量操作（移动/打标/删除/导出）+ 回收站 fns 归位。
 *
 * 居民（19 个，逐字；原 controllerFns fns 表条目，install 工厂同 folderMenuService）：
 * - 移动族：addToFolders / addToLastUsedFolder / addToRecentFolders / removeFromFolder
 * - 打标族：copyTags / pasteTags / excludeWithTag / getSelectedTags / openTag
 * - 删除/回收站：emptyTrash / cancelEmptyTrash / cleanAllError / cleanSelected
 * - 选中/滚动：getSelectedItemElements / scrollToSelectedItem
 * - 导出族：exportSelectedAsFolder / exportSelectedAsEaglepack / exportSelectedAsFormat /
 *   exportSelectedToCsv
 * （moveTo 三兄弟已在 FolderModals.tsx；moveToFolders/removeSelected 已在 dataMachinery）
 *
 * 符号解析面（itemMenuService/folderMenuService 同模式）：
 * - i18n/eagle/swal/preferences/process/ipcRenderer/electronLog/hiddenByCurrentFilter/
 *   ayncsImagesChange → window 全局回退（bundleGlobals 供给）
 * - IPCHelper → core 同源 import
 * - $filter/$timeout → 双轨 shim（scope $root → machinery getFilter）
 * - throttle → utils/func（b1-9bc 原生版）
 * - dialog/remote/currentWindow → electron 同源
 */
// @ts-nocheck
import { IPCHelper } from '../core/ipcHelper';
import { getFilter as machineryGetFilter, machineryAutoScroll, machineryCalculateImageBinding, machineryCheckOperationSafety, machineryFilterContent, machineryFindDupclipate, machineryForceFitImageSize, machineryGetRecentFolders, machineryGetSelectedItemElements, machineryGetSelectedItems, machineryGetSelectedTags, machineryGetSelection, machineryLeaveDetailMode, machineryRebindRefresh, machineryRelayout, machineryResetPage, machineryUpdateSelection, machineryZoom } from '../core/dataMachinery';
import { throttle } from '../utils/func';
import { syncFolderLock } from '../store/lockState';
import { syncListFromScope } from '../store/listState';
import { syncPanelFromScope } from '../store/panelState';
import { syncSidebarFromScope } from '../store/sidebarState';
import { syncFilterFromScope } from '../store/filterState';
import { syncInspectorFromScope } from '../store/inspectorState';
import { syncDetailFromScope } from '../store/detailState';
import { getBodyScope } from '../core/appCore';
import { checkDiskSpace, exportFolder } from './folderCoreService';
import { select } from './selectionService';
import { addImagesToFolder } from './folderCoreService';
// b1-9bl-B：bq 迁移漏带的闭包 link 变量（原 controllerFns closure 层共享 var）。
// initLinkVars 本体留在 controllerFns（闭包私有）；服务侧本地重建 TagManager 解析
// （原 initLinkVars 278 行同式：getBodyScope().TagManager 晚挂载兜底），使各 fn 首行
// try { initLinkVars(); } 从 no-op 转为真实供给。
var __lv_cleanSelectedTimeout;
var __lv_TagManager;
const initLinkVars = () => {
	const s0: any = getBodyScope();
	if (s0 && s0.TagManager) __lv_TagManager = s0.TagManager;
};

export function cancelCleanSelectedTimeout(): void {
	try { $timeout.cancel(__lv_cleanSelectedTimeout); } catch (err) { /* $timeout shim 未就绪时无 timer 可取消 */ }
}

const _req: any = (n: string) => { try { return (window as any).require(n); } catch (err) { return undefined; } };
const i18n: any = (window as any).i18n;
let preferences: any = (window as any).electronSettings?.getPreferences?.() || {};
const eagle: any = (window as any).eagle;
const swal: any = (...args: any[]) => (window as any).swal(...args);
const currentWindow: any = (window as any).electron?.remote?.getCurrentWindow?.() || _req('@electron/remote')?.getCurrentWindow?.();
const remote: any = _req('@electron/remote');
const dialog: any = remote?.dialog;
const electronLog: any = (window as any).electronLog || console;
const ipcRenderer: any = (window as any).__eagleIpc || (window as any).electron?.ipcRenderer;
const $filter: any = (name: string) => {
  const s: any = getBodyScope();
  const root = s && s.$root;
  if (root && root.$filter) return root.$filter(name);
  const inst: any = machineryGetFilter();
  return inst ? inst(name) : undefined;
};
// $timeout 语义 = 延时执行 + digest（controllerFns 同源）
const $timeout: any = (fn: any, ms?: number) => setTimeout(() => {
  try { if (typeof fn === 'function') fn(); } finally { try { getBodyScope().$apply(); } catch (err) { /* noop */ } }
}, ms || 0);

/* b1-9bz-B：ToastAlerts 的「清空全部错误」此前只能经 callScope 字符串路由命中（条目在
   install 体内匿名注册）。提升为具名导出（bz-A 落点同形态：install 注入的 getScope 等价
   getBodyScope），表项改指针、组件侧改直 import + scopeApply，零行为变化。 */
export function cleanAllError(...args: any[]) {
  try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
  const s = getBodyScope();
  if (!s) return;
  return (function (event: any) {
          event && event.stopPropagation();
          s.$root.$broadcast("CLEAN_ALL_ERROR", {
              errorList: s.errorList
          });
      }).apply(null, args);
}

/* 19 fns（逐字；fns/getScope 为闭包注入） */
export function cancelEmptyTrash(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function () {
            s.isCleaningTrash = false;
            syncSidebarFromScope();
            s.trashRemoved = 0;
            s.currentTrashRemoved = 0;
            IPCHelper.send('palette-resume');
            IPCHelper.sendTo((window as any).backgroundWindowID, 'cancel-empty-trash');
    }).apply(null, args);
}

export function emptyTrash(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function () {
            if (s.trash && s.trash.length > 0) {
                swal({
                    html: `
                        <div class="alert">
                            <div class="alert-icon warning"></div>
                            <h4 class="alert-title">${i18n.__('dialog.emptyTrash.title')}</h4>
                            <p class="alert-desc">${i18n.__("dialog.emptyTrash.desc")}</p>
                        </div>
                    `,
                    showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: false, focusCancel: false, padding: 24,
                    width: 400,
                    customClass: "alert-box",
                    cancelButtonColor: "#777777",
                    confirmButtonText: i18n.__('dialog.emptyTrash.button'),
                    cancelButtonText: i18n.__("general.cancel"),
                }).then(function () {

                    var removeCount = s.trash.length;

                    var willDelete = {};
                    s.trash.forEach(function(r: any) {
                        if (r.id) {
                            willDelete[r.id] = true;
                        }
                    });

                    for (var i = 0; i < s.raw.length; i++) {
                        var image = s.raw[i];
                        if (image.id && willDelete[image.id]) {
                            s.raw.splice(i, 1);
                            syncListFromScope();
                            delete s.itemMappings[image.id];
                            i--;
                            continue;
                        }
                    }

                    try { electronLog && electronLog.info(`[app] Empty trash`); } catch (err) {};
                    ayncsImagesRemove(s.trash);

                    s.trash = [];
                    syncSidebarFromScope();
                    syncListFromScope();
                    machineryUpdateSelection(s);
                    machineryRebindRefresh(s);
                    machineryFindDupclipate(s, undefined);

                    // 更新進度
                    s.removeProgress = 0;
                    s.currentTrashRemoved = 0;
                    s.trashRemoved += removeCount;
                    s.isCleaningTrash = true;
                    syncSidebarFromScope();
                    // 觸發 AI Search 全量同步
                    eagle.aiSearch.fullSync();

                    // 如果声音效果是开启的
                    if (s.$root.preferences.notification.soundEffect.enable != 'false' && s.$root.preferences.notification.soundEffect.when.deleteFolder == 'true') {
                        s.removeSound.play();
                    }
                });
            }
    }).apply(null, args);
}

export function addToFolders(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function (e) {
            if (s.selected.length > 0) {
                s.$root.$broadcast("OPEN-ADD-FOLDER-MODAL", {
                    current: s.currentFolder,
                    folders: s.folders,
                    images: s.selected,
                    existsFolders: eagle.inspector.calculateFolders(s.selected),
                });
            }
    }).apply(null, args);
}

export function addToRecentFolders(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function (folderIDs) {
            if (!folderIDs || folderIDs.length == 0 ) return;
            var recentMoveFolders = localStorage.getItem("recentMoveFolders");
            if (recentMoveFolders) {
                recentMoveFolders = JSON.parse(recentMoveFolders);
            }
            else {
                recentMoveFolders = [];
            }
            folderIDs.forEach(function (folderID) {
                recentMoveFolders.unshift(folderID);
            });
            recentMoveFolders = recentMoveFolders.unique();
            recentMoveFolders = recentMoveFolders.slice(0, 50);

            localStorage.setItem("recentMoveFolders", JSON.stringify(recentMoveFolders));
        }).apply(null, args);
}

export function addToLastUsedFolder(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function () {
        machineryCheckOperationSafety(s, function () {
            var recentFolders = machineryGetRecentFolders(s);
            if (!recentFolders || recentFolders.length === 0) return;
            if (!recentFolders[0] || !s.selected[0]) return;
            var folder = recentFolders[0];
            addToRecentFolders([folder.id]);
            addImagesToFolder(s.selected, folder);
            if (s.viewMode === 'unfiled') {
                var itemElements = machineryGetSelectedItemElements(s);
                s.$root.$broadcast("gl:removeItems", itemElements);
                // 自動選取下一個圖片，如果沒有下一個，選上一個，都沒有就空
                s.lastIndex = machineryGetSelection(s).start;
                var next = s.allData[s.lastIndex + s.selected.length];
                var prev = s.allData[s.lastIndex - 1];
                if (next) {
                    s.selected = [next];
                    syncInspectorFromScope();
                    s.current = next;
                    syncDetailFromScope();
                    syncInspectorFromScope();
                }
                else if (prev) {
                    s.selected = [prev];
                    syncInspectorFromScope();
                    s.current = prev;
                    syncDetailFromScope();
                    syncInspectorFromScope();
                }
                else {
                    s.selected = [];
                    syncInspectorFromScope();
                    machineryLeaveDetailMode(s);
                }
            }
        });
    }).apply(null, args);
}

export function cleanSelected(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function(event) {
            // 忽略事件传送
            if (event && $("#box-container").outerWidth() <= event.offsetX + 10) {
                event.stopPropagation();
                return;
            }

            // event && event.stopPropagation();
            if (event.metaKey || event.shiftKey || event.ctrlKey) return;
            __lv_cleanSelectedTimeout = $timeout(function() {
                s.selected = [];
                syncInspectorFromScope();
                s.selectedFolderMappings = {};
                syncListFromScope();
                machineryUpdateSelection(s);
            }, 100);
        }).apply(null, args);
}

export function copyTags(...args: any[]) {
    if (!__cc_copyTags) {
      __cc_copyTags = throttle(function () {
        const s = getBodyScope();
        if (!s) return;
        eagle.inspector.copyTags();
        s.notify({
          message: $filter('i18n')("Context.Tag.Copy.Success"),
          duration: 750
        });
      }, 500);
    }
    return __cc_copyTags(...args);
}

export function pasteTags(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function(event) {
        event && event.preventDefault();
        event && event.stopPropagation();
        var copiedTags = eagle.inspector.copiedTags;
        if (s.selected && s.selected.length > 0 && copiedTags && copiedTags.length > 0) {
            s.selected.forEach(function (image) {
                copiedTags.forEach(function (tag) {
                    if (image.tags.indexOf(tag) === -1) {
                        image.tags.push(tag);
                    }
                });
            });
            machineryUpdateSelection(s);
            ayncsImagesChange(s.selected);
            hiddenByCurrentFilter(s.selected);
            electronLog.info(`[app] Paste tags ${JSON.stringify(copiedTags)} to ${s.selected.length} files`);
        }
    }).apply(null, args);
}

export function removeFromFolder(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function(event, folderId) {

        if (event && event.stopPropagation) {
            event.stopPropagation();
        }

        if (!folderId && s.selected.length <= 0) return;

        var origins = [];

        s.selected.forEach(function(image) {
            var idx = image.folders.indexOf(folderId);
            if (idx !== -1) {
                origins.push(image);
                image.folders.splice(idx, 1);
            }
        });

        try {
            electronLog && electronLog.info(`[app] Remove ${s.selected.length} files from ${s.folderMappings[folderId].name}(${folderId})`);
        } catch (err) {};

        ayncsImagesChange(s.selected);
        hiddenByCurrentFilter(s.selected);

        var message = $filter('i18n')("notify.image.removeFromFolder", [
            { "property": "imageCount", "value": s.selected.length },
            { "property": "folderName", "value": s.folderMappings[folderId].name }
        ]);

        if (s.selected.length === 1) { message = message.replace("images", "image"); }

        // 自動選取下一個圖片，如果沒有下一個，選上一個，都沒有就空
        if (s.currentFolder && s.currentFolder.id === folderId) {
            s.lastIndex = machineryGetSelection(s).start;
            var next = s.allData[s.lastIndex + s.selected.length];
            var prev = s.allData[s.lastIndex - 1];
            if (next) {
                s.selected = [next];
                syncInspectorFromScope();
                if (s.isDetailMode) {
                    s.current = next;
                    syncDetailFromScope();
                    syncInspectorFromScope();
                }
            } else if (prev) {
                s.selected = [prev];
                syncInspectorFromScope();
                if (s.isDetailMode) {
                    s.current = prev;
                    syncDetailFromScope();
                    syncInspectorFromScope();
                }
            } else {
                s.selected = [];
                syncInspectorFromScope();
                machineryLeaveDetailMode(s);
            }

            if (s.isDetailMode) {
                $timeout(function() {
                    machineryForceFitImageSize(s, s.current);
                    machineryZoom(s);
                }, 100);
            }
            ScrollbarSaver.saveScrollPosition();

            var itemElements = machineryGetSelectedItemElements(s);
            s.$root.$broadcast("gl:removeItems", itemElements);
        }

        if (s.$root.preferences.notification.soundEffect.enable != 'false' && s.$root.preferences.notification.soundEffect.when.deleteImage == 'true') {
            s.removeSound.play();
        }

        machineryCalculateImageBinding(s, { ignoreSort: true }, function() {
            machineryRebindRefresh(s, true);
            machineryUpdateSelection(s);
        });

        s.$root.notify({
            message: message,
            duration: 5000,
        }, function() {
            origins.forEach(function(image) {
                if (image.folders.indexOf(folderId) === -1) {
                    image.folders.push(folderId);
                    image.folders = [...new Set(image.folders)];
                }
            });

            // 如果這張圖片就在這個資料夾，畫面需要更新
            if (s.currentFolder && s.currentFolder.id === folderId) {
                machineryCalculateImageBinding(s, { ignoreSort: true }, function() {
                    machineryRebindRefresh(s);
                    machineryUpdateSelection(s);
                });
            } else {
                machineryUpdateSelection(s);
                machineryRebindRefresh(s, true);
            }

            ayncsImagesChange(origins);
        });
    }).apply(null, args);
}

export function getSelectedTags(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版等价（原 c3 体为纯包装）。
  const s = getBodyScope();
  if (!s) return;   // 原 c3 体的 scope 守卫，逐字保留
  return machineryGetSelectedTags(s);
}

export function getSelectedItemElements(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版等价（原 c3 体为纯包装）。
  const s = getBodyScope();
  if (!s) return;   // 原 c3 体的 scope 守卫，逐字保留
  return machineryGetSelectedItemElements(s);
}

export function scrollToSelectedItem(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function() {
            var __lv_target = s.selected[0];
            // 自动定位
            if (__lv_target) {

                if (__lv_target.id) {
                    var $box =$(`#box-${__lv_target.id}`);
                    if ($box.length > 0 && isElementVisible($box[0]) ) {
                        console.log("无须滚动");
                        return;
                    }
                }
                // var originSelected = [];
                // originSelected = originSelected.concat(s.selected);
                if (s.currentFolder && s.currentFolder.orderBy === "RANDOM") {
                    return;        
                }

                for (var i = s.allData.length - 1; i >= 0; i--) {
                    var __lv_image = s.allData[i];
                    if (__lv_target && __lv_target === __lv_image) {
                        var startPage = parseInt(i / 60);
                        console.log(`目标在第 ${startPage} 页`);
                        console.log($(`#box-${__lv_target.id}`).length);
                        // 東西不在畫面上，強制更新畫面然後定位
                        if ($(`#box-${__lv_target.id}`).length === 0 || startPage !== s.startCursor) {
                            machineryRebindRefresh(s, undefined, undefined, startPage);
                            machineryRelayout(s);    
                        }
                        $("#box-container").css("visibility", "hidden");
                        s.startCursor = startPage;
                        s.$root.currentFocus = "content";
                        $timeout(function () {
                            // s.selected = originSelected;
                            s.selected.forEach(function (item) {
                                select(undefined, item);
                            })
                            machineryAutoScroll(s);
                            setTimeout(function () {
                                $("#box-container").css("visibility", "initial");
                            }, 50);
                        }, 200);
                        s.$evalAsync();
                        break;
                    }
                }
            }
        }).apply(null, args);
}

export function excludeWithTag(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function (tag) {
            // 已存在
            if (tag.isNoTags) {
                eagle.filter.filterRules.tag.no = !eagle.filter.filterRules.tag.no;
                tag.isSelected = false;
                tag.isExcluded = true;
            }
            else {
                var tagName = tag.name;
                var __lv_idx = eagle.filter.filterRules.tag.includes.indexOf(tagName);
                if (__lv_idx > -1) {
                    eagle.filter.filterRules.tag.includes.splice(__lv_idx, 1);
                    tag.isSelected = false;
                }
                else {
                    var eidx = eagle.filter.filterRules.tag.excludes.indexOf(tagName);
                    if (eidx > -1) {
                        eagle.filter.filterRules.tag.excludes.splice(eidx, 1);
                        tag.isExcluded = false;
                    }
                    else {
                        eagle.filter.filterRules.tag.excludes.push(tagName);
                        tag.isExcluded = true;
                        tag.isSelected = false;
                    }
                }
            }

            s.tagKeyword = "";
            syncFilterFromScope();
            machineryFilterContent(s);
        }).apply(null, args);
}

export function openTag(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function(tag, ignoreHistory) {
            machineryResetPage(s);
            s.$root.currentFocus = "content";
            s.currentFolder = undefined;
            syncPanelFromScope();
            syncFolderLock();
            syncListFromScope();
            s.currentFolderChildren = undefined;
            __lv_TagManager.filterWithTags([tag], ignoreHistory);
        }).apply(null, args);
}

export function exportSelectedAsFolder(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function () {
        if (s.selected.length === 0) return;
        exportFolder(function (savePath) {
            if (savePath) {
                var imageNames = {};
                for (var i = 0; i < s.selected.length; i++) {
                    var image = s.selected[i];
                    imageNames[image.name + "." + image.ext] = image.name;
                }

                var needSpace = eagle.inspector.calculateFileSize(s.selected);
                checkDiskSpace(savePath, needSpace, function () {

                    fs.readdir(savePath, function(err, files) {

                        var sameFileCount = 0;

                        files.forEach(function (filename) {
                            if (imageNames[filename]) {
                                sameFileCount++;
                            }
                        });

                        if (sameFileCount > 0) {

                            var message = $filter('i18n')("Dialog.Export.As.Folder.Message", [
                                { "property": "savePath", "value": savePath },
                                { "property": "sameFileCount", "value": sameFileCount },
                            ]);

                            swal({
                                html: `
                                    <div class="alert">
                                        <div class="alert-icon warning"></div>
                                        <h4 class="alert-title">${i18n.__("Dialog.Export.As.Folder.Title")}</h4>
                                        <p class="alert-desc">${message}</p>
                                    </div>
                                `,
                                showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
                                width: 400,
                                customClass: "alert-box",
                                cancelButtonColor: "#777777",
                                confirmButtonText: i18n.__("Dialog.Export.As.Folder.Button"),
                                cancelButtonText: i18n.__("general.cancel"),
                            }).then(function () {
                                if ((window as any).backgroundWindowID === undefined) {
                                    IPCHelper.send('export-as-folder', {
                                        folder: undefined,
                                        images: s.selected,
                                        savePath: savePath,
                                        needSpace: needSpace
                                    });
                                }
                                else {
                                    IPCHelper.sendTo((window as any).backgroundWindowID, 'export-as-folder', {
                                        folder: undefined,
                                        images: s.selected,
                                        savePath: savePath,
                                        needSpace: needSpace
                                    });
                                }
                            });
                        }
                        else {
                            if ((window as any).backgroundWindowID === undefined) {
                                IPCHelper.send('export-as-folder', {
                                    folder: undefined,
                                    images: s.selected,
                                    savePath: savePath,
                                    needSpace: needSpace
                                });
                            }
                            else {
                                IPCHelper.sendTo((window as any).backgroundWindowID, 'export-as-folder', {
                                    folder: undefined,
                                    images: s.selected,
                                    savePath: savePath,
                                    needSpace: needSpace
                                });
                            }
                        }
                    });
                });
            }
        });
    }).apply(null, args);
}

export function exportSelectedAsEaglepack(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function () {
        if (s.selected.length === 0) return;
        var defaultPath = path.join("*/", 'Untitled' + '.eaglepack');

        dialog.showSaveDialog(currentWindow, {
            defaultPath: defaultPath,
            title: i18n.__('Context.Image.Export'),
            filters: [{ name: 'Eagle Package File', extensions: ['eaglepack'] }]
        }).then(result => {
            var savePath = result.filePath;
            if (!savePath) return;
            if ((window as any).backgroundWindowID === undefined) {
                IPCHelper.send('export-images', {
                    images: s.selected,
                    savePath: savePath
                });
            }
            else {
                IPCHelper.sendTo((window as any).backgroundWindowID, 'export-images', {
                    images: s.selected,
                    savePath: savePath
                });
            }
        });
    }).apply(null, args);
}

export function exportSelectedAsFormat(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function () {
        if (s.selected.length === 0) return;
        eagle.customExport.open(s.selected);
    }).apply(null, args);
}

export function exportSelectedToCsv(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function () {
        if (s.selected.length === 0) return;

        electronLog.info(`[App] Export CSV started, selected count: ${s.selected.length}`);

        const options = {
            title: i18n.__('dialog.exportCsv.title'),
            defaultPath: 'eagle-export.csv',
            filters: [
                { name: 'CSV Files', extensions: ['csv'] }
            ]
        };

        const filePath = dialog.showSaveDialogSync(options);
        if (!filePath) return;

        // CSV 字串轉義函數
        function escapeCSV(str) {
            if (!str) return '';
            str = String(str);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        }

        // 日期格式化函數
        function formatDate(timestamp) {
            if (!timestamp) return '';
            const date = new Date(timestamp);
            return date.toISOString().replace('T', ' ').slice(0, 19);
        }

        try {
            // 準備 CSV 數據
            const headers = ['ID', 'Name', 'Extension', 'Width', 'Height', 'Duration',
                             'URL', 'Annotation', 'Comments', 'Tags', 'Folders',
                             'Size', 'Rating', 'Imported At', 'Modified At', 'File Path'];

            const rows = s.selected.map(item => {
                // 獲取文件夾名稱
                let folderNames = [];
                if (item.folders && item.folders.length > 0) {
                    folderNames = item.folders.map(folderId => {
                        // 使用 folderMappings 取得文件夾名稱
                        const folder = s.folderMappings[folderId];
                        return folder ? folder.name : folderId;
                    });
                }
                // item.comments[0].annotation
                const commentString = item?.comments ? item?.comments?.map(comment => comment.annotation).join('\n') : '';

                return [
                    item.id,
                    escapeCSV(item.name),
                    item.ext || '',
                    item.width || '',
                    item.height || '',
                    item.duration || '', // 影片持續時間
                    escapeCSV(item.url || ''),
                    escapeCSV(item.annotation || ''),
                    escapeCSV(commentString), // 圖片標住
                    escapeCSV((item.tags || []).join(', ')),
                    escapeCSV(folderNames.join(', ')), // 使用文件夾名稱
                    item.size || '',
                    item.star || '',
                    formatDate(item.modificationTime),
                    formatDate(item.lastModified),
                    escapeCSV(FileUrlHelper.getRawPath(item))
                ];
            });

            // 寫入檔案
            const csvContent = [headers, ...rows]
                .map(row => row.join(','))
                .join('\n');

            fs.writeFileSync(filePath, '\uFEFF' + csvContent, 'utf8'); // BOM for Excel

            // 顯示成功訊息
            s.$root.notify({
                message: i18n.__('notify.exporCSV.title'),
                duration: 5000,
            });

            ipcRenderer.send('show-item-in-folder', filePath);

        } catch (error) {
            electronLog.error('[App] Export CSV failed:', error);
        }
    }).apply(null, args);
}

export function installBatchOpsFns(fns: any, getScope: any): void {
  fns["cancelEmptyTrash"] = cancelEmptyTrash;

  fns["emptyTrash"] = emptyTrash;

  fns["addToFolders"] = addToFolders;

  fns["addToRecentFolders"] = addToRecentFolders;

  // addToLastUsedFolder（bundle 43211-43251 全体）
  fns["addToLastUsedFolder"] = addToLastUsedFolder;

  fns["cleanAllError"] = cleanAllError;

  fns["cleanSelected"] = cleanSelected;

  fns["copyTags"] = copyTags;

  // pasteTags（bundle 30236-30253）
  fns["pasteTags"] = pasteTags;

  // removeFromFolder（bundle 30074-30176 全体）
  fns["removeFromFolder"] = removeFromFolder;

  fns["getSelectedTags"] = getSelectedTags;

  fns["getSelectedItemElements"] = getSelectedItemElements;

  fns["scrollToSelectedItem"] = scrollToSelectedItem;

  fns["excludeWithTag"] = excludeWithTag;

  fns["openTag"] = openTag;

  // exportSelectedAsFolder（bundle 26364-26449）
  fns["exportSelectedAsFolder"] = exportSelectedAsFolder;

  // exportSelectedAsEaglepack（bundle 26589-26613）
  fns["exportSelectedAsEaglepack"] = exportSelectedAsEaglepack;

  // exportSelectedAsFormat（bundle 26633-26636）
  fns["exportSelectedAsFormat"] = exportSelectedAsFormat;

  // exportSelectedToCsv（bundle 26638-26730；bundle 体内局部 const fs = require('fs')
  // 与模块级 fs 同物，收编）
  fns["exportSelectedToCsv"] = exportSelectedToCsv;
}
