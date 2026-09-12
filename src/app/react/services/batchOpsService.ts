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
import { cleanAllErrorChannel, glRemoveitemsChannel, openAddFolderModalChannel } from '../global/bus';
import { scopeEvalAsync } from '../core/scopeRuntime';
import { q, qa, cssSet, outerWidthOf } from '../utils/domQuery';
import { machineryGetRecentFolders } from '../core/libraryDomain';
import { machineryRelayout } from './gridService';
import { machineryCheckOperationSafety, machineryZoom } from './viewOpsService';
import { machineryCalculateImageBinding, machineryFindDupclipate, machineryForceFitImageSize, machineryRebindRefresh } from '../core/itemDomain';
import { getFilter, machineryFilterContent } from '../core/filterDomain';
import { getFilter as machineryGetFilter } from '../core/filterDomain';
import { machineryGetSelectedItemElements, machineryGetSelectedTags, machineryGetSelection, machineryUpdateSelection } from '../core/selectionViewDomain';
import { machineryLeaveDetailMode } from '../core/miscDomain';
import { machineryAutoScroll, machineryResetPage } from './gridService';
import { useMiscRawState } from '../store/miscRawState';
import { useItemState } from '../store/itemState';
import { useSelectionState } from '../store/selectionState';
import { useFolderState } from '../store/folderState';
import { useBodyState } from '../store/bodyState';
import { usePreferencesState } from '../store/preferencesState';
import { writeScopeField } from '../core/scopeFieldBridge';
// b1-9bl-B：bq 迁移漏带的闭包 link 变量（原 controllerFns closure 层共享 var）。
// initLinkVars 本体留在 controllerFns（闭包私有）；服务侧本地重建 TagManager 解析
// （原 initLinkVars 278 行同式：getBodyScope().TagManager 晚挂载兜底），使各 fn 首行
// try { initLinkVars(); } 从 no-op 转为真实供给。
var __lv_cleanSelectedTimeout;
var __lv_TagManager;
const initLinkVars = () => {
	if (useMiscRawState.getState().TagManager) __lv_TagManager = useMiscRawState.getState().TagManager;
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
  try { if (typeof fn === 'function') fn(); } finally { try { scopeEvalAsync(); } catch (err) { /* noop */ } }
}, ms || 0);

/* b1-9bz-B：ToastAlerts 的「清空全部错误」此前只能经 callScope 字符串路由命中（条目在
   install 体内匿名注册）。提升为具名导出（bz-A 落点同形态：install 注入的 getScope 等价
   getBodyScope），表项改指针、组件侧改直 import + scopeApply，零行为变化。 */
export function cleanAllError(...args: any[]) {
  try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
  return (function (event: any) {
          event && event.stopPropagation();
          cleanAllErrorChannel.emit({
              errorList: useMiscRawState.getState().errorList
          });
      }).apply(null, args);
}

/* 19 fns（逐字；fns/getScope 为闭包注入） */
export function cancelEmptyTrash(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function () {
            writeScopeField('isCleaningTrash', false);
            syncSidebarFromScope();
            writeScopeField('trashRemoved', 0);
            writeScopeField('currentTrashRemoved', 0);
            IPCHelper.send('palette-resume');
            IPCHelper.sendTo((window as any).backgroundWindowID, 'cancel-empty-trash');
    }).apply(null, args);
}

export function emptyTrash(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function () {
            if (useItemState.getState().trash && useItemState.getState().trash.length > 0) {
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

                    var removeCount = useItemState.getState().trash.length;

                    var willDelete = {};
                    useItemState.getState().trash.forEach(function(r: any) {
                        if (r.id) {
                            willDelete[r.id] = true;
                        }
                    });

                    for (var i = 0; i < useItemState.getState().raw.length; i++) {
                        var image = useItemState.getState().raw[i];
                        if (image.id && willDelete[image.id]) {
                            useItemState.getState().raw.splice(i, 1);
                            syncListFromScope();
                            delete useItemState.getState().itemMappings[image.id];
                            i--;
                            continue;
                        }
                    }

                    try { electronLog && electronLog.info(`[app] Empty trash`); } catch (err) {};
                    ayncsImagesRemove(useItemState.getState().trash);

                    s.trash = [];
                    syncSidebarFromScope();
                    syncListFromScope();
                    machineryUpdateSelection(s);
                    machineryRebindRefresh(s);
                    machineryFindDupclipate(undefined);

                    // 更新進度
                    s.removeProgress = 0;
                    s.currentTrashRemoved = 0;
                    s.trashRemoved += removeCount;
                    s.isCleaningTrash = true;
                    syncSidebarFromScope();
                    // 觸發 AI Search 全量同步
                    eagle.aiSearch.fullSync();

                    // 如果声音效果是开启的
                    if (usePreferencesState.getState().preferences.notification.soundEffect.enable != 'false' && usePreferencesState.getState().preferences.notification.soundEffect.when.deleteFolder == 'true') {
                        s.removeSound.play();
                    }
                });
            }
    }).apply(null, args);
}

export function addToFolders(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function (e) {
            if (useSelectionState.getState().selected.length > 0) {
                openAddFolderModalChannel.emit({
                    current: useFolderState.getState().currentFolder,
                    folders: useFolderState.getState().folders,
                    images: useSelectionState.getState().selected,
                    existsFolders: eagle.inspector.calculateFolders(useSelectionState.getState().selected),
                });
            }
    }).apply(null, args);
}

export function addToRecentFolders(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
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
        machineryCheckOperationSafety(function () {
            var recentFolders = machineryGetRecentFolders();
            if (!recentFolders || recentFolders.length === 0) return;
            if (!recentFolders[0] || !useSelectionState.getState().selected[0]) return;
            var folder = recentFolders[0];
            addToRecentFolders([folder.id]);
            addImagesToFolder(useSelectionState.getState().selected, folder);
            if (s.viewMode === 'unfiled') {
                var itemElements = machineryGetSelectedItemElements();
                glRemoveitemsChannel.emit(itemElements);
                // 自動選取下一個圖片，如果沒有下一個，選上一個，都沒有就空
                s.lastIndex = machineryGetSelection().start;
                var next = useItemState.getState().allData[s.lastIndex + useSelectionState.getState().selected.length];
                var prev = useItemState.getState().allData[s.lastIndex - 1];
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
            if (event && outerWidthOf(q("#box-container")) <= event.offsetX + 10) {
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
        if (useSelectionState.getState().selected && useSelectionState.getState().selected.length > 0 && copiedTags && copiedTags.length > 0) {
            useSelectionState.getState().selected.forEach(function (image) {
                copiedTags.forEach(function (tag) {
                    if (image.tags.indexOf(tag) === -1) {
                        image.tags.push(tag);
                    }
                });
            });
            machineryUpdateSelection(s);
            ayncsImagesChange(useSelectionState.getState().selected);
            hiddenByCurrentFilter(useSelectionState.getState().selected);
            electronLog.info(`[app] Paste tags ${JSON.stringify(copiedTags)} to ${useSelectionState.getState().selected.length} files`);
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

        if (!folderId && useSelectionState.getState().selected.length <= 0) return;

        var origins = [];

        useSelectionState.getState().selected.forEach(function(image) {
            var idx = image.folders.indexOf(folderId);
            if (idx !== -1) {
                origins.push(image);
                image.folders.splice(idx, 1);
            }
        });

        try {
            electronLog && electronLog.info(`[app] Remove ${useSelectionState.getState().selected.length} files from ${useItemState.getState().folderMappings[folderId].name}(${folderId})`);
        } catch (err) {};

        ayncsImagesChange(useSelectionState.getState().selected);
        hiddenByCurrentFilter(useSelectionState.getState().selected);

        var message = $filter('i18n')("notify.image.removeFromFolder", [
            { "property": "imageCount", "value": useSelectionState.getState().selected.length },
            { "property": "folderName", "value": useItemState.getState().folderMappings[folderId].name }
        ]);

        if (useSelectionState.getState().selected.length === 1) { message = message.replace("images", "image"); }

        // 自動選取下一個圖片，如果沒有下一個，選上一個，都沒有就空
        if (useFolderState.getState().currentFolder && useFolderState.getState().currentFolder.id === folderId) {
            s.lastIndex = machineryGetSelection().start;
            var next = useItemState.getState().allData[s.lastIndex + useSelectionState.getState().selected.length];
            var prev = useItemState.getState().allData[s.lastIndex - 1];
            if (next) {
                s.selected = [next];
                syncInspectorFromScope();
                if (useBodyState.getState().isDetailMode) {
                    s.current = next;
                    syncDetailFromScope();
                    syncInspectorFromScope();
                }
            } else if (prev) {
                s.selected = [prev];
                syncInspectorFromScope();
                if (useBodyState.getState().isDetailMode) {
                    s.current = prev;
                    syncDetailFromScope();
                    syncInspectorFromScope();
                }
            } else {
                s.selected = [];
                syncInspectorFromScope();
                machineryLeaveDetailMode(s);
            }

            if (useBodyState.getState().isDetailMode) {
                $timeout(function() {
                    machineryForceFitImageSize(useSelectionState.getState().current);
                    machineryZoom(s);
                }, 100);
            }
            ScrollbarSaver.saveScrollPosition();

            var itemElements = machineryGetSelectedItemElements();
            glRemoveitemsChannel.emit(itemElements);
        }

        if (usePreferencesState.getState().preferences.notification.soundEffect.enable != 'false' && usePreferencesState.getState().preferences.notification.soundEffect.when.deleteImage == 'true') {
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
            if (useFolderState.getState().currentFolder && useFolderState.getState().currentFolder.id === folderId) {
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
   // 原 c3 体的 scope 守卫，逐字保留
  return machineryGetSelectedTags();
}

export function getSelectedItemElements(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版等价（原 c3 体为纯包装）。
   // 原 c3 体的 scope 守卫，逐字保留
  return machineryGetSelectedItemElements();
}

export function scrollToSelectedItem(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function() {
            var __lv_target = useSelectionState.getState().selected[0];
            // 自动定位
            if (__lv_target) {

                if (__lv_target.id) {
                    var boxEl = q(`#box-${__lv_target.id}`);
                    if (boxEl && isElementVisible(boxEl) ) {
                        console.log("无须滚动");
                        return;
                    }
                }
                // var originSelected = [];
                // originSelected = originSelected.concat(s.selected);
                if (useFolderState.getState().currentFolder && useFolderState.getState().currentFolder.orderBy === "RANDOM") {
                    return;        
                }

                for (var i = useItemState.getState().allData.length - 1; i >= 0; i--) {
                    var __lv_image = useItemState.getState().allData[i];
                    if (__lv_target && __lv_target === __lv_image) {
                        var startPage = parseInt(i / 60);
                        console.log(`目标在第 ${startPage} 页`);
                        console.log(qa(`#box-${__lv_target.id}`).length);
                        // 東西不在畫面上，強制更新畫面然後定位
                        if (!q(`#box-${__lv_target.id}`) || startPage !== useFolderState.getState().startCursor) {
                            machineryRebindRefresh(s, undefined, undefined, startPage);
                            machineryRelayout();    
                        }
                        cssSet("#box-container", { visibility: "hidden" });
                        s.startCursor = startPage;
                        s.$root.currentFocus = "content";
                        $timeout(function () {
                            // s.selected = originSelected;
                            useSelectionState.getState().selected.forEach(function (item) {
                                select(undefined, item);
                            })
                            machineryAutoScroll();
                            setTimeout(function () {
                                cssSet("#box-container", { visibility: "initial" });
                            }, 50);
                        }, 200);
                        scopeEvalAsync();
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
    return (function () {
        if (useSelectionState.getState().selected.length === 0) return;
        exportFolder(function (savePath) {
            if (savePath) {
                var imageNames = {};
                for (var i = 0; i < useSelectionState.getState().selected.length; i++) {
                    var image = useSelectionState.getState().selected[i];
                    imageNames[image.name + "." + image.ext] = image.name;
                }

                var needSpace = eagle.inspector.calculateFileSize(useSelectionState.getState().selected);
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
                                        images: useSelectionState.getState().selected,
                                        savePath: savePath,
                                        needSpace: needSpace
                                    });
                                }
                                else {
                                    IPCHelper.sendTo((window as any).backgroundWindowID, 'export-as-folder', {
                                        folder: undefined,
                                        images: useSelectionState.getState().selected,
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
                                    images: useSelectionState.getState().selected,
                                    savePath: savePath,
                                    needSpace: needSpace
                                });
                            }
                            else {
                                IPCHelper.sendTo((window as any).backgroundWindowID, 'export-as-folder', {
                                    folder: undefined,
                                    images: useSelectionState.getState().selected,
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
    return (function () {
        if (useSelectionState.getState().selected.length === 0) return;
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
                    images: useSelectionState.getState().selected,
                    savePath: savePath
                });
            }
            else {
                IPCHelper.sendTo((window as any).backgroundWindowID, 'export-images', {
                    images: useSelectionState.getState().selected,
                    savePath: savePath
                });
            }
        });
    }).apply(null, args);
}

export function exportSelectedAsFormat(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    return (function () {
        if (useSelectionState.getState().selected.length === 0) return;
        eagle.customExport.open(useSelectionState.getState().selected);
    }).apply(null, args);
}

export function exportSelectedToCsv(...args: any[]) {
    try { initLinkVars(); } catch (err) { /* link var 初始化失败不阻塞（bundle 后备仍在） */ }
    const s = getBodyScope();
    if (!s) return;
    return (function () {
        if (useSelectionState.getState().selected.length === 0) return;

        electronLog.info(`[App] Export CSV started, selected count: ${useSelectionState.getState().selected.length}`);

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

            const rows = useSelectionState.getState().selected.map(item => {
                // 獲取文件夾名稱
                let folderNames = [];
                if (item.folders && item.folders.length > 0) {
                    folderNames = item.folders.map(folderId => {
                        // 使用 folderMappings 取得文件夾名稱
                        const folder = useItemState.getState().folderMappings[folderId];
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


// ═══ b1-9bz-D-1 B-5：零依赖声明归位（dataMachinery 剪出，逐字）═══
export function machineryRemovePermanently(s: any): void {
  const w = window as any;
  if (s.viewMode !== "trash") { return; }
  var images = s.selected;

  images.forEach(function (r: any) {
    var idx = s.raw.indexOf(r);
    if (idx != -1) {
      s.raw.splice(idx, 1);
      syncListFromScope();
    }
  });

  w.ayncsImagesRemove(images);

  var itemElements = machineryGetSelectedItemElements();
  glRemoveitemsChannel.emit(itemElements);
  s.selected = [];
  syncInspectorFromScope();
  machineryCalculateImageBinding(s, { ignoreSort: true }, function () {
    machineryRebindRefresh(s, true);
    machineryUpdateSelection(s);
  });
}
