/**
 * b1-9bo：folderMenuService —— folder/smartFolder 菜单 + CRUD 族归位
 * （controllerFns b1-9ap/b1-9aq 台账区 + 三 builder 整迁，≈2,540 行逐字）。
 *
 * 结构：installFolderMenuFns(fns, getScope) 工厂——提取区原为 makeControllerFns
 * 闭包段（依赖面：fns 表 + getScope 注入 + ContextMenu/i18n/$filter 等模块常量），
 * 整段包进本工厂即与原闭包作用域完全等价，代码体零改动。controllerFns 侧
 * makeControllerFns 尾部调用 installFolderMenuFns(fns, getScope) 批量注册——
 * fns 表条目名/挂载面/键位表零改动（P4 fns 表清零时随壳一并退役）。
 *
 * 符号解析面（itemMenuService 同模式）：
 * - ContextMenu/URL_MODULE → contextMenuDomain（发射端已切 eagleBus）
 * - i18n/preferences/eagle/swal/process/dialog → window 全局回退
 * - $filter → scope $root → machinery getFilter 双轨
 * - $timeout → bundle 同源 shim（延时 + digest）
 * - treeWalkSafe/wElectronLogInfo/wQueryFocusFolderInput → 模块级逐字（原 b1-9ap 辅助）
 */
// @ts-nocheck
import { ContextMenu } from '../core/contextMenuDomain';
import { getFilter as machineryGetFilter, machineryCalculateImageBinding, machineryExistInSmartFilter, machineryOpenAll, machineryPrependFolder, machineryRebindRefresh, machineryReload, machineryRemoveFolder, machineryRemoveSelectedFolders, machineryRemoveSelectedSmartFolders, machineryRemoveSmartFolder, machinerySaveFolderDebounce, machinerySetFolderOrder, machinerySetSmartFolderOrder, machinerySmartFolderCount, machinerySortRawData, machineryUpdateSelection, machineryUpdateSidebarList } from '../core/dataMachinery';
import { syncFolderLock } from '../store/lockState';
import { syncListFromScope } from '../store/listState';
import { syncPanelFromScope } from '../store/panelState';
import { syncInspectorFromScope } from '../store/inspectorState';
import { getBodyScope } from '../core/appCore';
import { exportFolder, getLibraryHistory, newFolder, openFolder, openSmartFolder } from './folderCoreService';
import { toggleAllFolderExpand, toggleCurrentLevelFolders, toggleSelectFolder } from './sidebarService';
import { addToLibraryChannel, editSmartFolderChannel, folderSettingsChannel, newSmartFolderChannel, openMoveFolderModalChannel, setFolderPasswordChannel } from '../global/bus';
import { scopeEvalAsync } from '../global/scopeShim';

import { machineryNewSmartFolder } from '../core/libraryDomain';
import { machineryBatchRenameFolders, machineryBatchRenameSmartFolders, machineryGetFolderImages, machineryRenameFolder, machineryRenameSmartFolder, machinerySaveFolder } from '../core/libraryDomain';
import { machineryCheckOperationSafety2 } from './viewOpsService';
const _req: any = (n: string) => { try { return (window as any).require(n); } catch (err) { return undefined; } };
const i18n: any = (window as any).i18n;
let preferences: any = (window as any).electronSettings?.getPreferences?.() || {};
const eagle: any = (window as any).eagle;
const swal: any = (...args: any[]) => (window as any).swal(...args);
const currentWindow: any = (window as any).electron?.remote?.getCurrentWindow?.() || _req('@electron/remote')?.getCurrentWindow?.();
const remote: any = _req('@electron/remote');
const dialog: any = remote?.dialog;
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

// b1-9ap 模块级辅助（controller 闭包等价物；makeControllerFns 工厂外共享）
// eagle.utils.tree.walk 安全封装（w.eagle.utils.tree.walk 缺席时等价平铺递归，不丢展开态）
// b1-9ap 模块级辅助（controller 闭包等价物；makeControllerFns 工厂外共享）
// eagle.utils.tree.walk 安全封装（w.eagle.utils.tree.walk 缺席时等价平铺递归，不丢展开态）
function treeWalkSafe(nodes: any, childKey: string, fn: (node: any, parent: any, depth?: any) => void) {
  const w = window as any;
  const walk = w.eagle && w.eagle.utils && w.eagle.utils.tree && w.eagle.utils.tree.walk;
  if (walk) {
    walk(nodes, childKey, fn);
    return;
  }
  const walkAll = (nodesInner: any, parent: any, depth: number) => {
    (nodesInner || []).forEach(function (n: any) {
      fn(n, parent, depth);
      walkAll(n[childKey], n, depth + 1);
    });
  };
  walkAll(nodes, null, 0);
}

function wElectronLogInfo(msg: string) {
  const w = window as any;
  w.electronLog && w.electronLog.info(msg);
}

// 原 $("#folder-input-" + id).focus().select()（React Sidebar 沿用同 DOM id 约定）
function wQueryFocusFolderInput(folderId: any) {
  const el = document.getElementById('folder-input-' + folderId);
  if (el) {
    (el as HTMLElement).focus();
    (el as HTMLElement).select && (el as HTMLElement).select();
  }
}

/* b1-9ap/b1-9aq 台账区 + 三 builder（逐字；fns/getScope 为闭包注入） */
export function checkOperationSafety2(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版等价（$filter→getFilter()、swal/i18n→w.*）。
  const s = getBodyScope();
  if (!s) return;   // 原 c3 体的 scope 守卫，逐字保留
  machineryCheckOperationSafety2(s, args[0], args[1], args[2]);
}

export function refreshSubfolderList(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function () {
      // 过滤子文件夹
      if (s.currentFolder) {
        let subFolders: any[] = [];
        if (s.showSubfolderContent) {
          s.subFolders = getAllChildFolder(s.currentFolder);
          syncListFromScope();
          if (s.subFolderSortableOptions) s.subFolderSortableOptions.disabled = true;
        }
        else {
          s.subFolders = s.currentFolder.children;
          syncListFromScope();
          if (s.subFolderSortableOptions) s.subFolderSortableOptions.disabled = false;
        }
        if (s.keyword) {
          s.subFolders = s.subFolders.filter(function (folder: any) {
            if (folder.name.toLowerCase().indexOf(s.keyword.toLowerCase()) > -1) {
              return true;
            }
            if (folder && folder.tags) {
              var folderTags = folder.tags.join('');
              if (folderTags.toLowerCase().indexOf(s.keyword.toLowerCase()) > -1) {
                return true;
              }
            }
          });
          syncListFromScope();
          if (s.subFolderSortableOptions) s.subFolderSortableOptions.disabled = true;
        }
      }
      else {
        s.subFolders = [];
        syncListFromScope();
      }
    }).apply(null, args);
}

export function setFolderPassword(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (folder: any) {
      var f = folder || s.currentFolder;
      if (!f) return;
      setFolderPasswordChannel.emit({ folder: f, mode: 'new' });
    }).apply(null, args);
}

export function changeFolderPassword(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (folder: any) {
      var f = folder || s.currentFolder;
      if (!f) return;
      setFolderPasswordChannel.emit({ folder: f, mode: 'change' });
    }).apply(null, args);
}

export function resetFolderPassword(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (folder: any) {
      var f = folder || s.currentFolder;
      if (!f) return;
      setFolderPasswordChannel.emit({ folder: f, mode: 'reset' });
    }).apply(null, args);
}

export function setFoldersOrder(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (folders: any, orderBy: any, ignoreReload: any) {
      folders.forEach(function (folder: any) {
        machinerySetFolderOrder(s, folder, orderBy);
      });
      machinerySortRawData(s, orderBy);
      machineryRebindRefresh(s);
      scopeEvalAsync();
    }).apply(null, args);
}

export function setFolderOrder(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版等价。
  const s = getBodyScope();
  if (!s) return;   // 原 c3 体的 scope 守卫，逐字保留
  machinerySetFolderOrder(s, args[0], args[1], args[2]);
}

export function setFoldersSortIncrease(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (folders: any, sortIncrease: any, ignoreReload: any) {
      folders.forEach(function (folder: any) {
        setFolderSortIncrease(folder, sortIncrease);
      });
    }).apply(null, args);
}

export function setFolderSortIncrease(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (folder: any, sortIncrease: any, ignoreReload: any) {
      if (!folder) return;
      folder.sortIncrease = !!sortIncrease;
      if (s.currentFolder === folder && !ignoreReload) {
        s.reload();
      }
      machinerySaveFolder(s);
    }).apply(null, args);
}

export function lockFolder(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (event: any, f: any) {
      var folder = f || s.currentFolder;
      if (!folder) return;
      if (!folder.isUnLock || !folder.password) return;
      delete folder.isUnLock;
      s.isLoading = true;
      s.selected = [];
      syncInspectorFromScope();
      machineryUpdateSidebarList(s);
      machineryCalculateImageBinding(s, { ignoreSort: true }, function () {
        machineryRebindRefresh(s);
        machineryUpdateSelection(s);
        s.isLoading = false;
      });
    }).apply(null, args);
}

export function settingFolder(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (event: any, folder: any) {
      var f = folder;
      if (!f) {
        f = s.currentFolder || s.currentSmartFolder;
        if (s.selectedFolderMappings && Object.keys(s.selectedFolderMappings).length > 0) {
          var selectedFolders = Object.keys(s.selectedFolderMappings).map(function (key) {
            return key;
          });
          var folderId = selectedFolders[0];
          if (folderId && s.folderMappings[folderId]) {
            f = s.folderMappings[folderId];
          }
        }
      }
      if (!f) return;

      if (f.conditions) {
        editSmartFolderChannel.emit(f);
      }
      else {
        folderSettingsChannel.emit(f);
      }
    }).apply(null, args);
}

export function renameFolder(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版等价。
  const s = getBodyScope();
  if (!s) return;   // 原 c3 体的 scope 守卫，逐字保留
  machineryRenameFolder(s, args[0], args[1]);
}

export function batchRenameFolders(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版等价。
  const s = getBodyScope();
  if (!s) return;   // 原 c3 体的 scope 守卫，逐字保留
  machineryBatchRenameFolders(s);
}

export function cloneFolder(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (event: any, folder: any) {
      var resetFolder = function (fd: any) {
        delete fd.$$hashKey;
        fd.covers = [];
        fd.images = [];
        fd.imagesMappings = {};
        fd.imageCount = 0;
        fd.modificationTime = Date.now();
        fd.password = '';
        fd.passwordTips = '';
        delete fd.descendantImageCount;
      };
      var newFolder = JSON.parse(JSON.stringify(folder));
      resetFolder(newFolder);

      var children = s.folders;
      if (folder.parent && s.folderMappings[folder.parent]) {
        let parent = s.folderMappings[folder.parent];
        children = parent.children;
      }
      var idx = children.indexOf(folder);
      newFolder.id = guid();
      newFolder.children = newFolder.children || [];

      treeWalkSafe(newFolder.children, 'children', function (sf: any, parent: any) {
        let newId = guid();
        sf.id = newId;
        sf.children = sf.children || [];
        if (parent) {
          sf.parent = parent.id;
        }
        resetFolder(sf);
        s.folderMappings[newId] = sf;
      });

      if (idx > -1) {
        children.splice(idx + 1, 0, newFolder);
        s.folderMappings[newFolder.id] = newFolder;
        machineryUpdateSidebarList(s);
        machinerySaveFolder(s);
        try { wElectronLogInfo(`[app] Clone folder: ${folder.name}(${folder.id}), new folder: ${newFolder.name}(${newFolder.id})`); } catch (err) {}
      }
      machineryCalculateImageBinding(s, { ignoreSort: true }, function () {});
    }).apply(null, args);
}

export function changeFolderIcon(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (event: any, folder: any, icon: any) {
      const w = window as any;
      if (!icon) {
        delete folder.icon;
      }
      else {
        folder.icon = icon;
      }
      machinerySaveFolder(s);
      try { w.electronLog && w.electronLog.info(`[app] Change folder: ${folder.name}(${folder.id}) icon to: ${icon}`); } catch (err) {}
      w.analytics.event('ChangeIcon', 'Folder', icon);
    }).apply(null, args);
}

export function changeSelectedFoldersIcon(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (event: any, icon: any) {
      const w = window as any;
      if (s.$root.selectedFolders.length === 0) return;
      s.$root.selectedFolders.forEach(function (folder: any) {
        if (!icon) {
          delete folder.icon;
        }
        else {
          folder.icon = icon;
        }
      });
      machinerySaveFolder(s);
      try { w.electronLog && w.electronLog.info(`[app] Change ${s.$root.selectedFolders.length} folders icon to: ${icon}`); } catch (err) {}
      w.analytics.event('ChangeIcon', 'Folder', icon);
    }).apply(null, args);
}

export function changeFolderColor(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (event: any, folder: any, color: any) {
      const w = window as any;
      if (!color) {
        delete folder.iconColor;
      }
      else {
        folder.iconColor = color;
      }
      machineryUpdateSidebarList(s);
      machinerySaveFolder(s);
      try { w.electronLog && w.electronLog.info(`[app] Change folder: ${folder.name}(${folder.id}) icon color to: ${color}`); } catch (err) {}
      w.analytics.event('ChangeColor', 'Folder', color);
    }).apply(null, args);
}

export function changeSelectedFoldersColor(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (event: any, color: any) {
      const w = window as any;
      if (s.$root.selectedFolders.length === 0) return;
      s.$root.selectedFolders.forEach(function (folder: any) {
        if (!color) {
          delete folder.iconColor;
        }
        else {
          folder.iconColor = color;
        }
      });
      machineryUpdateSidebarList(s);
      machinerySaveFolder(s);
      try { w.electronLog && w.electronLog.info(`[app] Change ${s.$root.selectedFolders.length} folders icon color to: ${color}`); } catch (err) {}
      w.analytics.event('ChangeColor', 'Folder', color);
    }).apply(null, args);
}

export function folderExportAsPack(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (event: any, folder: any) {
      const w = window as any;
      var images: any[] = [];
      var f: any = {};
      for (var rindex = s.raw.length - 1; rindex >= 0; rindex--) {
        try {
          var image = s.raw[rindex];
          if (image.isDeleted) continue;
          var isContain = image.folders.indexOf(folder.id) > -1;
          if (!isContain) {
            treeWalkSafe(folder.children, 'children', function (child: any, parent: any) {
              if (image.folders.indexOf(child.id) > -1) {
                isContain = true;
                return;
              }
            });
          }
          if (isContain) {
            images.push(image);
          }
        }
        catch (err) {}
      }
      Object.assign(f, folder);
      f.images = images;
      var defaultPath = w.path.join('*/', 'Untitled' + '.eaglepack');
      if (folder) {
        defaultPath = w.path.join('*/', folder.name.replace(/^\./, '') + '.eaglepack');
      }

      dialog.showSaveDialog(currentWindow, {
        defaultPath: defaultPath,
        title: i18n.__('Context.Image.Export'),
        filters: [{ name: 'Eagle Package File', extensions: ['eaglepack'] }]
      }).then((result: any) => {
        var savePath = result.filePath;
        if (!savePath) return;
        if ((window as any).backgroundWindowID === undefined) {
          IPCHelper.send('export-images', {
            folder: f,
            savePath: savePath
          });
        }
        else {
          IPCHelper.sendTo((window as any).backgroundWindowID, 'export-images', {
            folder: f,
            savePath: savePath
          });
        }
      });
    }).apply(null, args);
}

export function folderExportAsFolder(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (event: any, folder: any) {
      const w = window as any;
      var folders = s.$root.selectedFolders;
      if (folder) {
        folders = [folder];
      }
      else {
        if (s.$root.selectedFolders.length === 0) return;
        folders = s.$root.selectedFolders;
      }

      var exportFolder = function (folder2: any, savePath: any) {
        var images: any[] = [];
        if (savePath) {
          for (var rindex = s.raw.length - 1; rindex >= 0; rindex--) {
            try {
              var image = s.raw[rindex];
              if (image.isDeleted) continue;
              var isContain = image.folders.indexOf(folder2.id) > -1;
              if (!isContain) {
                treeWalkSafe(folder2.children, 'children', function (child: any, parent: any) {
                  if (image.folders.indexOf(child.id) > -1) {
                    isContain = true;
                    return;
                  }
                });
              }
              if (isContain && !(s.lockedImages && s.lockedImages[image.id])) {
                images.push(image);
              }
            }
            catch (err) {}
          }

          function sanitizeFolderName(folderName: any) {
            if (typeof folderName !== 'string') return '';

            // 移除 tab，統一空白
            folderName = folderName.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();

            if (w.process.platform === 'darwin') {
              // macOS：僅移除冒號與斜線
              folderName = folderName
                .replace(/[:\/\\]/g, ' ')
                .trim();
            } else {
              // Windows：移除非法字元與控制碼
              folderName = folderName
                .replace(/[<>:"\/\\|?*\x00-\x1F]/g, '')
                .replace(/[ ]+$/, '')
                .replace(/[.]+$/, '')
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

          var folderName = sanitizeFolderName(folder2.name);
          var folderDir = w.path.normalize(savePath + '/' + folderName);
          if (fs.existsSync(folderDir)) {
            var message = $filter('i18n')('Dialog.Folder.Export.As.Folder.Message', [
              { property: 'folderDir', value: folderDir }
            ]);

            swal({
              html: `
                                <div class="alert">
                                    <div class="alert-icon warning"></div>
                                    <h4 class="alert-title">${i18n.__('Dialog.Folder.Export.As.Folder.Title')}</h4>
                                    <p class="alert-desc">${message}</p>
                                </div>
                            `,
              showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
              width: 400,
              customClass: 'alert-box',
              cancelButtonColor: '#777777',
              confirmButtonText: i18n.__('Dialog.Folder.Export.As.Folder.Button'),
              cancelButtonText: i18n.__('general.cancel'),
            }).then(function () {
              if ((window as any).backgroundWindowID === undefined) {
                IPCHelper.send('export-as-folder', {
                  folder: folder2,
                  images: images,
                  savePath: savePath
                });
              }
              else {
                IPCHelper.sendTo((window as any).backgroundWindowID, 'export-as-folder', {
                  folder: folder2,
                  images: images,
                  savePath: savePath
                });
              }
            });
          }
          else {
            if ((window as any).backgroundWindowID === undefined) {
              IPCHelper.send('export-as-folder', {
                folder: folder2,
                images: images,
                savePath: savePath
              });
            }
            else {
              IPCHelper.sendTo((window as any).backgroundWindowID, 'export-as-folder', {
                folder: folder2,
                images: images,
                savePath: savePath
              });
            }
          }
        }
      };
      exportFolder(function (savePath: any) {
        folders.forEach(function (folder2: any) {
          exportFolder(folder2, savePath);
        });
      });
    }).apply(null, args);
}

export function moveFolders(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (selectedFolders: any, node: any) {
      var selected = (selectedFolders && selectedFolders.length > 0) ? selectedFolders : [node];
      if (selected && selected.length > 0) {
        openMoveFolderModalChannel.emit({
          current: s.currentFolder,
          folders: s.folders,
          selectedFolders: selected
        });
      }
    }).apply(null, args);
}

export function copyFolderLink(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (event: any, folder: any) {
      if (folder && folder.id) {
        clipboard.writeText(`http://localhost:41595/folder?id=${folder.id}`);
        s.notify({
          message: i18n.__('notify.colorCopySuccess'),
          duration: 750
        });
      }
    }).apply(null, args);
}

export function showListSubfolderContent(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function () {
      const w = window as any;
      s.showSubfolderContent = !s.showSubfolderContent;
      preferences.showSubfolderContent = s.showSubfolderContent;
      (window as any).electronSettings.set('preferences', preferences).then(function () {});
      machineryCalculateImageBinding(s, { ignoreSort: true }, function () {
        machineryRebindRefresh(s);
        machineryUpdateSelection(s);
        const scrollbar = document.getElementById('box-container-scrollbar');
        if (scrollbar) scrollbar.dispatchEvent(new Event('UPDATE_BOX_SCROLLBAR', { bubbles: true }));
      });

      scopeEvalAsync();
      if (s.showSubfolderContent) { w.electronLog && w.electronLog.info('[app] Show sub-folder on list: ON'); }
      else { w.electronLog && w.electronLog.info('[app] Show sub-folder on list: OFF'); }
    }).apply(null, args);
}

export function openFolderContextMenu(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (event: any, folder: any) {
      const w = window as any;

      if (event && event.target && event.target.tagName === 'INPUT') return;

      const disabled = !!folder.password && !folder.isUnLock;
      const isOpenQuickAccess = s.$root.preferences.sidebar.quickAccess != 'false';
      const isAddedQuickAccess = w.QuickAccessManager.indexOf(folder) > -1;
      const isMultiple = s.selectedFoldersMappings[folder.id];
      const selectedFolders = s.$root.selectedFolders;

      let items: any = null;
      let historyLibraryMenu: any = {};

      historyLibraryMenu.items = getLibraryHistory().filter((history: any) => {
        var isCurrent = false;
        if (s.libraryPath) {
          isCurrent = w.path.normalize(history.path) == w.path.normalize(s.libraryPath);
        }
        return !isCurrent;
      }).map((history: any) => {
        return {
          label: history.name,
          keywords: i18n.__('context.image.addToLibrary') + ' library 資源庫',
          accelerator: history.dir,
          icon: 'ic-library-logo.svg',
          click: () => {
            const items2 = machineryGetFolderImages(s, folder, true);
            addToLibraryChannel.emit({
              folder: folder,
              items: items2,
              library: history
            });
            scopeEvalAsync();
          }
        };
      });

      if (isMultiple && selectedFolders.length > 1) {

        // 當前的排序方式
        const currentOrder = selectedFolders.reduce((prev: any, current: any) => {
          return ((prev && prev.orderBy) === (current && current.orderBy)) ? (prev && prev.orderBy) : undefined;
        }, undefined);

        const currentOrderIncrease = selectedFolders.reduce((prev: any, current: any) => {
          return ((prev && prev.sortIncrease) === (current && current.sortIncrease)) ? (prev && prev.sortIncrease) : undefined;
        }, undefined);

        let defaultOrderItem = {
          checked: !currentOrder,
          label: i18n.__('context.order.orderBy>default'),
          icon: 'ic-order-by.svg',
          click: () => {
            setFoldersOrder(selectedFolders, undefined);
          }
        };

        let orderItems = ['import', 'mtime', 'btime', 'name', 'ext', 'filesize', 'resolution', 'rating', 'duration', 'random'].map((order) => {
          const uppercase = order && order.toUpperCase();
          return {
            checked: currentOrder === uppercase,
            label: i18n.__(`context.order.orderBy>${order}`),
            keywords: order,
            icon: `ic-order-by-${order}.svg`,
            click: () => {
              setFoldersOrder(selectedFolders, uppercase || undefined);
            }
          };
        });

        let increaseItems = [
          {
            checked: currentOrderIncrease === true,
            label: i18n.__('context.order.orderBy>increase'),
            icon: 'ic-order-by-increase.svg',
            click: () => {
              setFoldersSortIncrease(selectedFolders, true);
            }
          },
          {
            checked: currentOrderIncrease === false,
            label: i18n.__('context.order.orderBy>decrease'),
            icon: 'ic-order-by-decrease.svg',
            click: () => {
              setFoldersSortIncrease(selectedFolders, false);
            }
          },
        ];

        let orderByItems = [defaultOrderItem, ...orderItems, { role: 'separator' }, ...increaseItems];

        items = [
          // 添加到最愛 / 從最愛移除
          {
            visible: isOpenQuickAccess && !isAddedQuickAccess,
            label: i18n.__('context.folder.quickAccessAdd'),
            keywords: '最愛 加入 快速存取 add quick access favorite',
            icon: 'ic-favorite-add.svg',
            click: () => {
              w.QuickAccessManager.addMultiple('folder', selectedFolders);
              scopeEvalAsync();
            }
          },
          {
            visible: isOpenQuickAccess && isAddedQuickAccess,
            label: i18n.__('context.folder.quickAccessRemove'),
            keywords: '最愛 移除 快速存取 remove quick access favorite',
            icon: 'ic-favorite-remove.svg',
            click: () => {
              w.QuickAccessManager.removeMultiple('folder', selectedFolders);
              scopeEvalAsync();
            }
          },
          {
            visible: isOpenQuickAccess,
            role: 'separator'
          },
          // 移動文件夾
          {
            label: i18n.__('context.folder.moveFolder'),
            keywords: 'move folder dir 資料夾 文件夾 移动',
            icon: 'ic-folder-move.svg',
            accelerator: s.$root.preferences.shortcuts.keybinds['edit.folder.move'],
            click: () => {
              moveFolders(selectedFolders, folder);
              scopeEvalAsync();
            }
          },
          // 批次命名
          {
            accelerator: s.$root.preferences.shortcuts.keybinds[`edit.rename.${w.process.platform}`],
            label: i18n.__('context.image.batchRename.msg1') + selectedFolders.length + i18n.__('context.image.batchRename.msg2'),
            keywords: '重命名 重新命名 rename',
            icon: 'ic-rename.svg',
            click: () => {
              machineryBatchRenameFolders(s, event);
              scopeEvalAsync();
            }
          },
          // 修改排序
          {
            label: i18n.__('context.order.label.orderBy'),
            icon: 'ic-order-by.svg',
            submenu: {
              items: orderByItems
            }
          },
          // 導出
          {
            disabled: disabled,
            icon: 'ic-export.svg',
            label: i18n.__('context.folder.export'),
            submenu: {
              items: [
                {
                  disabled: disabled,
                  label: i18n.__('context.folder.export>computer'),
                  keywords: '導出 エクスポート 本地 export computer local',
                  icon: 'ic-export-computer.svg',
                  click: () => {
                    folderExportAsFolder(event);
                    scopeEvalAsync();
                  }
                }
              ]
            }
          },
          {
            role: 'separator'
          },
          // emoji
          {
            label: i18n.__('context.folder.icon'),
            icon: 'ic-emoji.svg',
            submenu: {
              items: [{
                role: 'emoji',
                click: (emoji: any) => {
                  changeSelectedFoldersIcon(event, emoji);
                }
              }]
            }
          },
          // color
          {
            role: 'color',
            click: (color: any) => {
              changeSelectedFoldersColor(event, color);
              scopeEvalAsync();
            }
          },
          // ---
          // 刪除
          {
            role: 'separator'
          },
          {
            accelerator: (w.process.platform === 'win32') ? 'Delete' : 'CmdOrCtrl+⌫',
            label: i18n.__('context.folder.remove'),
            keywords: '資料夾 文件夾 刪除 移除 remove delete folder dir',
            icon: 'ic-folder-remove.svg',
            click: () => {
              machineryRemoveSelectedFolders(s);
              scopeEvalAsync();
            }
          },
        ];
      }
      else {
        items = [
          // 新增資料夾
          {
            accelerator: s.$root.preferences.shortcuts.keybinds['file.create.folder'] || 'CmdOrCtrl+Shift+N',
            label: i18n.__('context.folder.newFolder'),
            keywords: 'folder dir new create 資料夾 文件夾 新建 建立 新增 ',
            icon: 'ic-folder-new-folder.svg',
            click: () => {
              newFolder(folder, false, true);
              scopeEvalAsync();
            }
          },
          // 新增子資料夾
          {
            disabled: disabled,
            accelerator: 'Alt+N',
            label: i18n.__('context.folder.newSubFolder'),
            keywords: 'sub folder dir new create 資料夾 文件夾 新建 建立 新增 子資料夾',
            icon: 'ic-folder-new-sub-folder.svg',
            click: () => {
              newFolder(folder, true);
              scopeEvalAsync();
            }
          },
          // 移動文件夾
          {
            label: i18n.__('context.folder.moveFolder'),
            keywords: 'move folder dir 資料夾 文件夾 移动',
            icon: 'ic-folder-move.svg',
            accelerator: s.$root.preferences.shortcuts.keybinds['edit.folder.move'],
            click: () => {
              moveFolders(selectedFolders, folder);
              scopeEvalAsync();
            }
          },
          // ---
          {
            role: 'separator'
          },
          // 添加到最愛 / 從最愛移除
          {
            visible: isOpenQuickAccess && !isAddedQuickAccess,
            label: i18n.__('context.folder.quickAccessAdd'),
            keywords: '最愛 加入 快速存取 add quick access favorite',
            icon: 'ic-favorite-add.svg',
            click: () => {
              w.QuickAccessManager.add('folder', folder);
              scopeEvalAsync();
            }
          },
          {
            visible: isOpenQuickAccess && isAddedQuickAccess,
            label: i18n.__('context.folder.quickAccessRemove'),
            keywords: '最愛 移除 快速存取 remove quick access favorite',
            icon: 'ic-favorite-remove.svg',
            click: () => {
              w.QuickAccessManager.remove('folder', folder);
              scopeEvalAsync();
            }
          },
          {
            visible: isOpenQuickAccess,
            role: 'separator'
          },
          // 重命名
          {
            accelerator: s.$root.preferences.shortcuts.keybinds[`edit.rename.${w.process.platform}`],
            label: i18n.__('context.folder.renameFolder'),
            keywords: '重命名 重新命名 rename',
            icon: 'ic-rename.svg',
            click: () => {
              machineryRenameFolder(s, event, folder);
              scopeEvalAsync();
            }
          },
          // 複製連結
          {
            label: i18n.__('appmenu.edit>copyAsLink'),
            keywords: '複製 連結 copy link',
            icon: 'ic-folder-copy-link.svg',
            click: () => {
              copyFolderLink(event, folder);
              scopeEvalAsync();
            }
          },
          // 自動標籤
          {
            accelerator: 'CmdOrCtrl+Shift+R',
            label: i18n.__('context.folder.autoTagging'),
            icon: 'ic-folder-auto-tag.svg',
            disabled: disabled,
            click: (event2: any) => {
              settingFolder(event2, folder);
              scopeEvalAsync();
            }
          },
          // 密碼保護
          {
            label: i18n.__('context.folder.password'),
            icon: 'ic-password.svg',
            submenu: {
              items: [
                {
                  disabled: !!folder.password,
                  label: i18n.__('context.folder.password>create'),
                  accelerator: preferences.shortcuts.keybinds['edit.folder.password.create'],
                  click: () => {
                    setFolderPassword(folder);
                    scopeEvalAsync();
                  }
                },
                {
                  disabled: !folder.password,
                  label: i18n.__('context.folder.password>change'),
                  accelerator: preferences.shortcuts.keybinds['edit.folder.password.change'],
                  click: () => {
                    changeFolderPassword(folder);
                    scopeEvalAsync();
                  }
                },
                {
                  disabled: !folder.password,
                  label: i18n.__('context.folder.password>reset'),
                  accelerator: preferences.shortcuts.keybinds['edit.folder.password.reset'],
                  click: () => {
                    resetFolderPassword(folder);
                    scopeEvalAsync();
                  }
                },
                {
                  disabled: !(!!folder.password && !!folder.isUnLock),
                  label: i18n.__('context.folder.password>lock'),
                  accelerator: preferences.shortcuts.keybinds['edit.folder.password.lock'],
                  click: () => {
                    lockFolder(event, folder);
                    scopeEvalAsync();
                  }
                }
              ]
            }
          },
          // ---
          // 排序
          {
            label: i18n.__('context.folder.sortByTitle'),
            icon: 'ic-order-by.svg',
            submenu: {
              items: [
                {
                  label: i18n.__('context.folder.sortByTitle>title') + `(${i18n.__('context.folder.sortByCurrentLevel')}) (A→Z)`,
                  keywords: i18n.__('context.folder.sortByTitle'),
                  click: () => {
                    let folders = (folder.parent) ? s.folderMappings[folder.parent].children : s.folders;
                    reorderFolderByTitle(folders);
                  }
                },
                {
                  label: i18n.__('context.folder.sortByTitle>title') + `(${i18n.__('context.folder.sortByCurrentLevel')}) (Z→A)`,
                  keywords: i18n.__('context.folder.sortByTitle'),
                  click: () => {
                    let folders = (folder.parent) ? s.folderMappings[folder.parent].children : s.folders;
                    reorderFolderByTitle(folders, true);
                  }
                },
                {
                  label: i18n.__('context.folder.sortByTitle>title') + `(${i18n.__('context.folder.sortByAllLevel')}) (A→Z)`,
                  keywords: i18n.__('context.folder.sortByTitle'),
                  click: () => {
                    reorderAllFolderByTitle();
                  }
                },
                {
                  label: i18n.__('context.folder.sortByTitle>title') + `(${i18n.__('context.folder.sortByAllLevel')}) (Z→A)`,
                  keywords: i18n.__('context.folder.sortByTitle'),
                  click: () => {
                    reorderAllFolderByTitle(true);
                  }
                },
              ]
            }
          },
          {
            role: 'separator'
          },
          {
            label: i18n.__('Context.Expand.Folder'),
            icon: 'ic-expand.svg',
            click: () => {
              toggleSelectFolder(event, folder);
              scopeEvalAsync();
            }
          },
          {
            label: i18n.__('Context.Expand.SameLevel.Folders'),
            icon: 'ic-expand-same.svg',
            click: () => {
              toggleCurrentLevelFolders(event, folder);
              scopeEvalAsync();
            }
          },
          {
            accelerator: '/',
            label: i18n.__('Context.Expand.All.Folders'),
            icon: 'ic-expand-all.svg',
            click: () => {
              toggleAllFolderExpand(event, folder);
              scopeEvalAsync();
            }
          },
          {
            role: 'separator'
          },
          // 克隆
          {
            disabled: disabled,
            label: i18n.__('context.folder.clone'),
            keywords: '複製 克隆 clone',
            icon: 'ic-clone.svg',
            click: () => {
              cloneFolder(event, folder);
              scopeEvalAsync();
            }
          },
          // ---
          {
            role: 'separator'
          },
          // 導出
          {
            disabled: disabled,
            icon: 'ic-export.svg',
            label: i18n.__('context.folder.export'),
            submenu: {
              items: [
                {
                  disabled: disabled,
                  label: i18n.__('context.folder.export>computer'),
                  keywords: '導出 エクスポート 本地 export computer local',
                  icon: 'ic-export-computer.svg',
                  click: () => {
                    folderExportAsFolder(event, folder);
                    scopeEvalAsync();
                  }
                },
                {
                  disabled: disabled,
                  label: i18n.__('context.folder.export>eaglepack'),
                  keywords: '導出 エクスポート export eaglepack',
                  icon: 'ic-export-eaglepack.svg',
                  click: () => {
                    folderExportAsPack(event, folder);
                    scopeEvalAsync();
                  }
                }
              ]
            }
          },
          // 添加至資源庫
          {
            label: i18n.__('context.image.addToLibrary'),
            keywords: '',
            icon: 'ic-library-add-to.svg',
            submenu: historyLibraryMenu
          },
          // ---
          { role: 'separator' },
          // 在父文件夾顯示子文件夾內容
          {
            checked: s.showSubfolderContent,
            label: i18n.__('context.folder.toogleSubFolderContent'),
            icon: 'ic-folder-show-sub-folder-content.svg',
            click: () => {
              showListSubfolderContent();
              scopeEvalAsync();
            }
          },
          // ---
          { role: 'separator' },
          // emoji
          {
            label: i18n.__('context.folder.icon'),
            icon: 'ic-emoji.svg',
            submenu: {
              items: [{
                role: 'emoji',
                click: (emoji: any) => {
                  changeFolderIcon(event, folder, emoji);
                }
              }]
            }
          },
          // color
          {
            role: 'color',
            click: (color: any) => {
              changeFolderColor(event, folder, color);
              scopeEvalAsync();
            }
          },
          // ---
          // 刪除
          {
            role: 'separator'
          },
          {
            accelerator: (w.process.platform === 'win32') ? 'Delete' : 'CmdOrCtrl+⌫',
            label: i18n.__('context.folder.remove'),
            keywords: '資料夾 文件夾 刪除 移除 remove delete folder dir',
            icon: 'ic-folder-remove.svg',
            click: () => {
              machineryRemoveFolder(s, folder);
              scopeEvalAsync();
            }
          },
        ];
      }
      const folderEl = event && event.currentTarget;
      ContextMenu.open({
        items: items,
        showSearch: true,
        onOpened: () => {
          try { folderEl && folderEl.classList && folderEl.classList.add('context-activate'); } catch (err) {}
        },
        onClosed: () => {
          try { folderEl && folderEl.classList && folderEl.classList.remove('context-activate'); } catch (err2) {}
        }
      });
    }).apply(null, args);
}

export function setSmartFoldersOrder(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (smartFolders: any, orderBy: any, ignoreReload: any) {
      smartFolders.forEach(function (folder: any) {
        machinerySetSmartFolderOrder(s, folder, orderBy);
      });
      machinerySortRawData(s, orderBy);
      machineryRebindRefresh(s);
      scopeEvalAsync();
    }).apply(null, args);
}

export function setSmartFolderOrder(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版等价。
  const s = getBodyScope();
  if (!s) return;   // 原 c3 体的 scope 守卫，逐字保留
  machinerySetSmartFolderOrder(s, args[0], args[1], args[2]);
}

export function setSmartFoldersSortIncrease(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (smartFolders: any, sortIncrease: any, ignoreReload: any) {
      smartFolders.forEach(function (folder: any) {
        setSmartFolderSortIncrease(folder, sortIncrease);
      });
    }).apply(null, args);
}

export function setSmartFolderSortIncrease(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (folder: any, sortIncrease: any) {
      if (!folder) return;
      folder.sortIncrease = !!sortIncrease;
      if (s.currentSmartFolder === folder) {
        s.reload();
      }
      machinerySaveFolder(s);
    }).apply(null, args);
}

export function batchRenameSmartFolders(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版等价。
  const s = getBodyScope();
  if (!s) return;   // 原 c3 体的 scope 守卫，逐字保留
  machineryBatchRenameSmartFolders(s);
}

export function changeSmartFolderIcon(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (event: any, smartFolder: any, icon: any) {
      const w = window as any;
      if (!icon) {
        delete smartFolder.icon;
      }
      else {
        smartFolder.icon = icon;
      }
      machinerySaveFolder(s);
      try { w.electronLog && w.electronLog.info(`[app] Change folder: ${smartFolder.name}(${smartFolder.id}) icon to: ${icon}`); } catch (err) {}
      w.analytics.event('ChangeIcon', 'SmartFolder', icon);
    }).apply(null, args);
}

export function changeSmartFolderColor(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (event: any, smartFolder: any, color: any) {
      const w = window as any;
      if (!color) {
        delete smartFolder.iconColor;
      }
      else {
        smartFolder.iconColor = color;
      }
      machineryUpdateSidebarList(s);
      machinerySaveFolder(s);
      try { w.electronLog && w.electronLog.info(`[app] Change smart-folder: ${smartFolder.name}(${smartFolder.id}) icon color to: ${color}`); } catch (err) {}
      w.analytics.event('ChangeColor', 'SmartFolder', color);
    }).apply(null, args);
}

export function changeSelectedSmartFoldersIcon(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (event: any, icon: any) {
      const w = window as any;
      if (s.$root.selectedSmartFolders.length === 0) return;
      s.$root.selectedSmartFolders.forEach(function (smartFolder: any) {
        if (!icon) {
          delete smartFolder.icon;
        }
        else {
          smartFolder.icon = icon;
        }
      });
      machineryUpdateSidebarList(s);
      machinerySaveFolder(s);
      try { w.electronLog && w.electronLog.info(`[app] Change ${s.$root.selectedSmartFolders.length} smart-folders icon to: ${icon}`); } catch (err) {}
      w.analytics.event('ChangeIcon', 'SmartFolder', icon);
    }).apply(null, args);
}

export function changeSelectedSmartFoldersColor(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (event: any, color: any) {
      const w = window as any;
      if (s.$root.selectedSmartFolders.length === 0) return;
      s.$root.selectedSmartFolders.forEach(function (smartFolder: any) {
        if (!color) {
          delete smartFolder.iconColor;
        }
        else {
          smartFolder.iconColor = color;
        }
      });
      machineryUpdateSidebarList(s);
      machinerySaveFolder(s);
      try { w.electronLog && w.electronLog.info(`[app] Change ${s.$root.selectedSmartFolders.length} smart-folders icon color to: ${color}`); } catch (err) {}
      w.analytics.event('ChangeColor', 'SmartFolder', color);
    }).apply(null, args);
}

export function cloneSmartFolder(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (event: any, smartFolder: any) {
      const w = window as any;
      var newFolder = JSON.parse(JSON.stringify(smartFolder));
      var children = s.smartFolders;
      if (smartFolder.parent && s.smartFolderMappings[smartFolder.parent]) {
        let parent = s.smartFolderMappings[smartFolder.parent];
        children = parent.children;
      }
      var idx = children.indexOf(smartFolder);
      newFolder.id = guid();
      newFolder.children = newFolder.children || [];

      treeWalkSafe(newFolder.children, 'children', function (sf: any, parent: any) {
        let newId = guid();
        sf.id = newId;
        sf.children = sf.children || [];
        if (parent) {
          sf.parent = parent.id;
        }
        s.smartFolderMappings[newId] = sf;
      });

      if (idx > -1) {
        children.splice(idx, 0, newFolder);
        s.smartFolderMappings[newFolder.id] = newFolder;
        machineryUpdateSidebarList(s);
        machinerySaveFolder(s);
        try { w.electronLog && w.electronLog.info(`[app] Clone smart-folder: ${smartFolder.name}(${smartFolder.id}), new smart-folder: ${newFolder.name}(${newFolder.id})`); } catch (err) {}
      }
    }).apply(null, args);
}

export function renameSmartFolder(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版等价。
  const s = getBodyScope();
  if (!s) return;   // 原 c3 体的 scope 守卫，逐字保留
  machineryRenameSmartFolder(s, args[0], args[1]);
}

export function copySmartFolderLink(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (event: any, smartFolder: any) {
      if (smartFolder && smartFolder.id) {
        clipboard.writeText(`http://localhost:41595/smart-folder?id=${smartFolder.id}`);
        s.notify({
          message: i18n.__('notify.colorCopySuccess'),
          duration: 750
        });
      }
    }).apply(null, args);
}

export function smartFolderExportAsPack(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (event: any, smartFolder: any) {
      const w = window as any;
      var isInSmartFolder = function (sf: any, image: any) {
        if (sf.children && sf.children.length === 0 && sf.conditions && sf.conditions.length === 0) {
          return false;
        }
        else if (sf.children && sf.children.length > 0 && sf.conditions && sf.conditions.length === 0) {
          for (let i = 0; i < sf.children.length; i++) {
            let smartFolder = sf.children[i];
            if (machineryExistInSmartFilter(s, smartFolder, image)) {
              return true;
            }
          }
          return false;
        }
        else {
          return machineryExistInSmartFilter(s, s.currentSmartFolder, image);
        }
      };

      var f: any = {};
      var folderId = guid();
      var images: any[] = [];
      for (var i = 0; i < s.raw.length; i++) {
        var image = s.raw[i];
        if (image.isDeleted) continue;
        if (isInSmartFolder(smartFolder, image)) {
          var clone: any = {};
          Object.assign(clone, image);
          clone.folders = [folderId];
          images.push(clone);
        }
      }
      if (images.length === 0) return;
      Object.assign(f, smartFolder);
      f.id = folderId;
      f.images = images;
      delete f.children;

      var defaultPath = w.path.join('*/', 'Untitled' + '.eaglepack');
      if (smartFolder) {
        defaultPath = w.path.join('*/', smartFolder.name.replace(/^\./, '') + '.eaglepack');
      }

      dialog.showSaveDialog(currentWindow, {
        defaultPath: defaultPath,
        title: i18n.__('Context.Image.Export'),
        filters: [{ name: 'Eagle Package File', extensions: ['eaglepack'] }]
      }).then((result: any) => {
        var savePath = result.filePath;
        if (!savePath) return;
        if ((window as any).backgroundWindowID === undefined) {
          IPCHelper.send('export-images', {
            folder: f,
            savePath: savePath
          });
        }
        else {
          IPCHelper.sendTo((window as any).backgroundWindowID, 'export-images', {
            folder: f,
            savePath: savePath
          });
        }
      });
    }).apply(null, args);
}

export function smartFolderExportAsFolder(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (event: any, smartFolder: any) {
      const w = window as any;
      var isInSmartFolder = function (sf: any, image: any) {
        if (sf.children && sf.children.length === 0 && sf.conditions && sf.conditions.length === 0) {
          return false;
        }
        else if (sf.children && sf.children.length > 0 && sf.conditions && sf.conditions.length === 0) {
          for (let i = 0; i < sf.children.length; i++) {
            let smartFolder = sf.children[i];
            if (machineryExistInSmartFilter(s, smartFolder, image)) {
              return true;
            }
          }
          return false;
        }
        else {
          return machineryExistInSmartFilter(s, s.currentSmartFolder, image);
        }
      };

      exportFolder(function (savePath: any) {
        var f: any = {};
        var folderId = guid();
        var images: any[] = [];
        if (savePath) {
          for (var i = 0; i < s.raw.length; i++) {
            var image = s.raw[i];
            if (image.isDeleted) continue;
            if (isInSmartFolder(smartFolder, image)) {
              var clone: any = {};
              Object.assign(clone, image);
              clone.folders = [folderId];
              images.push(clone);
            }
          }
          if (images.length === 0) return;
          Object.assign(f, smartFolder);
          f.id = folderId;
          f.images = images;
          delete f.children;
          var folderDir = w.path.normalize(savePath + '/' + smartFolder.name.replace(/\//g, ' ').replace(/\\/g, ' ').replace(/%/g, ''));
          if (fs.existsSync(folderDir)) {
            var message = $filter('i18n')('Dialog.Folder.Export.As.Folder.Message', [
              { property: 'folderDir', value: folderDir }
            ]);

            swal({
              html: `
                                <div class="alert">
                                    <div class="alert-icon warning"></div>
                                    <h4 class="alert-title">${i18n.__('Dialog.Folder.Export.As.Folder.Title')}</h4>
                                    <p class="alert-desc">${message}</p>
                                </div>
                            `,
              showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
              width: 400,
              customClass: 'alert-box',
              cancelButtonColor: '#777777',
              confirmButtonText: i18n.__('Dialog.Folder.Export.As.Folder.Button'),
              cancelButtonText: i18n.__('general.cancel'),
            }).then(function () {
              if ((window as any).backgroundWindowID === undefined) {
                IPCHelper.send('export-as-folder', {
                  folder: f,
                  images: images,
                  savePath: savePath
                });
              }
              else {
                IPCHelper.sendTo((window as any).backgroundWindowID, 'export-as-folder', {
                  folder: f,
                  images: images,
                  savePath: savePath
                });
              }
            });
          }
          else {
            if ((window as any).backgroundWindowID === undefined) {
              IPCHelper.send('export-as-folder', {
                folder: f,
                images: images,
                savePath: savePath
              });
            }
            else {
              IPCHelper.sendTo((window as any).backgroundWindowID, 'export-as-folder', {
                folder: f,
                images: images,
                savePath: savePath
              });
            }
          }
        }
      });
    }).apply(null, args);
}

export function newSmartFolder(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版等价（原 c3 体为纯包装）。
  const s = getBodyScope();
  if (!s) return;   // 原 c3 体的 scope 守卫，逐字保留
  return machineryNewSmartFolder(s, args[0], args[1]);
}

export function newChildSmartFolder(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (event: any, smartFolder: any) {
      newSmartFolderChannel.emit({ smartFolder: smartFolder || s.currentSmartFolder, parent: smartFolder });
    }).apply(null, args);
}

export function newSmartFolderGroup(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (event: any) {
      const w = window as any;
      var smartFolderGroup = {
        id: guid(),
        name: i18n.__('general.untitled.title'),
        modificationTime: Date.now(),
        children: [],
        conditions: [],
        icon: 'grid'
      };
      s.smartFolders.push(smartFolderGroup);
      machineryUpdateSidebarList(s);
      machinerySaveFolder(s);
      w.analytics.event('SmartFolder', 'CreateGroup');
      return smartFolderGroup;
    }).apply(null, args);
}

export function prependFolder(...args: any[]) {
  // b1-9bz-B：双键单源化 —— 与 machinery 版等价（原 c3 体为纯包装）。
  const s = getBodyScope();
  if (!s) return;   // 原 c3 体的 scope 守卫，逐字保留
  return machineryPrependFolder(s, args[0]);
}

export function openNewSmartFolderContextMenu(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (event: any) {
      ContextMenu.open({
        items: [
          {
            label: i18n.__('appmenu.file>createSmartFolder'),
            icon: 'ic-smart-folder-new.svg',
            accelerator: preferences.shortcuts.keybinds['file.create.smartfolder'],
            click: () => {
              machineryNewSmartFolder(s, event);
              scopeEvalAsync();
            }
          },
          {
            label: i18n.__('appmenu.file>createSmartFolderGroup'),
            icon: 'ic-smart-folder-new-group.svg',
            click: () => {
              var smartFolderGroup = newSmartFolderGroup(event);
              openSmartFolder(smartFolderGroup);
              $timeout(function () {
                machineryRenameSmartFolder(s, event, smartFolderGroup);
              }, 150);
              scopeEvalAsync();
            }
          }
        ],
        showSearch: false,
      });
    }).apply(null, args);
}

export function openSmartFolderContextMenu(...args: any[]) {
    const s = getBodyScope();
    if (!s) return;
    return (function (event: any, smartFolder: any) {
      const w = window as any;

      if (event && event.target && event.target.tagName === 'INPUT') return;

      const isOpenQuickAccess = s.$root.preferences.sidebar.quickAccess != 'false';
      const isAddedQuickAccess = w.QuickAccessManager.indexOf(smartFolder) > -1;
      const isMultiple = s.$root.selectedSmartFoldersMappings && s.$root.selectedSmartFoldersMappings[smartFolder.id];
      const selectedSmartFolders = s.$root.selectedSmartFolders;

      let items: any = null;
      let historyLibraryMenu: any = {};

      historyLibraryMenu.items = getLibraryHistory().filter((history: any) => {
        var isCurrent = false;
        if (s.libraryPath) {
          isCurrent = w.path.normalize(history.path) == w.path.normalize(s.libraryPath);
        }
        return !isCurrent;
      }).map((history: any) => {
        return {
          label: history.name,
          keywords: 'library 資源庫',
          accelerator: history.dir,
          icon: 'ic-library-logo.svg',
          click: () => {
            addToLibraryChannel.emit({
              smartFolder: smartFolder,
              items: [],
              library: history
            });
            scopeEvalAsync();
          }
        };
      });

      if (isMultiple && selectedSmartFolders.length > 1) {

        // 當前的排序方式
        const currentOrder = selectedSmartFolders.reduce((prev: any, current: any) => {
          return ((prev && prev.orderBy) === (current && current.orderBy)) ? (prev && prev.orderBy) : undefined;
        }, undefined);

        const currentOrderIncrease = selectedSmartFolders.reduce((prev: any, current: any) => {
          return ((prev && prev.sortIncrease) === (current && current.sortIncrease)) ? (prev && prev.sortIncrease) : undefined;
        }, undefined);

        let defaultOrderItem = {
          checked: !currentOrder,
          label: i18n.__('context.order.orderBy>default'),
          icon: 'ic-order-by.svg',
          click: () => {
            setSmartFoldersOrder(selectedSmartFolders, undefined);
          }
        };

        let orderItems = ['import', 'mtime', 'btime', 'name', 'ext', 'filesize', 'resolution', 'rating', 'duration', 'random'].map((order) => {
          const uppercase = order && order.toUpperCase();
          return {
            checked: currentOrder === uppercase,
            label: i18n.__(`context.order.orderBy>${order}`),
            keywords: order,
            icon: `ic-order-by-${order}.svg`,
            click: () => {
              setSmartFoldersOrder(selectedSmartFolders, uppercase || undefined);
            }
          };
        });

        let increaseItems = [
          {
            checked: currentOrderIncrease === true,
            label: i18n.__('context.order.orderBy>increase'),
            icon: 'ic-order-by-increase.svg',
            click: () => {
              setSmartFoldersSortIncrease(selectedSmartFolders, true);
            }
          },
          {
            checked: currentOrderIncrease === false,
            label: i18n.__('context.order.orderBy>decrease'),
            icon: 'ic-order-by-decrease.svg',
            click: () => {
              setSmartFoldersSortIncrease(selectedSmartFolders, false);
            }
          },
        ];

        let orderByItems = [defaultOrderItem, ...orderItems, { role: 'separator' }, ...increaseItems];

        items = [
          // 修改排序
          {
            label: i18n.__('context.order.label.orderBy'),
            icon: 'ic-order-by.svg',
            submenu: {
              items: orderByItems
            }
          },
          // 添加到最愛 / 從最愛移除
          {
            visible: isOpenQuickAccess,
            role: 'separator'
          },
          {
            visible: isOpenQuickAccess && !isAddedQuickAccess,
            label: i18n.__('context.smartFolder.quickAccessAdd'),
            keywords: '最愛 加入 快速存取 add quick access favorite',
            icon: 'ic-favorite-add.svg',
            click: () => {
              w.QuickAccessManager.addMultiple('smartFolder', selectedSmartFolders);
              scopeEvalAsync();
            }
          },
          {
            visible: isOpenQuickAccess && isAddedQuickAccess,
            label: i18n.__('context.smartFolder.quickAccessRemove'),
            keywords: '最愛 移除 快速存取 remove quick access favorite',
            icon: 'ic-favorite-remove.svg',
            click: () => {
              w.QuickAccessManager.removeMultiple('smartFolder', selectedSmartFolders);
              scopeEvalAsync();
            }
          },
          // 批次命名
          {
            accelerator: s.$root.preferences.shortcuts.keybinds[`edit.rename.${w.process.platform}`],
            label: i18n.__('context.image.batchRename.msg1') + selectedSmartFolders.length + i18n.__('context.image.batchRename.msg2'),
            keywords: '重命名 重新命名 rename',
            icon: 'ic-rename.svg',
            click: () => {
              machineryBatchRenameSmartFolders(s, event);
              scopeEvalAsync();
            }
          },
          {
            role: 'separator'
          },
          // emoji
          {
            label: i18n.__('context.smartFolder.changeIcon'),
            icon: 'ic-emoji.svg',
            submenu: {
              items: [{
                role: 'emoji',
                click: (emoji: any) => {
                  changeSelectedSmartFoldersIcon(event, emoji);
                }
              }]
            }
          },
          // color
          {
            role: 'color',
            click: (color: any) => {
              changeSelectedSmartFoldersColor(event, color);
              scopeEvalAsync();
            }
          },
          // ---
          // 刪除
          {
            role: 'separator'
          },
          {
            accelerator: (w.process.platform === 'win32') ? 'Delete' : 'CmdOrCtrl+⌫',
            label: i18n.__('context.smartFolder.removeFolder'),
            keywords: '資料夾 文件夾 刪除 移除 remove delete smart folder dir',
            icon: 'ic-smart-folder-remove.svg',
            click: () => {
              machineryRemoveSelectedSmartFolders(s);
              scopeEvalAsync();
            }
          },
        ];
      }
      else {
        items = [
          // 新增智能文件夾
          {
            label: i18n.__('context.smartFolder.newSmartFolder'),
            keywords: '資料夾 文件夾 新建 建立 新增 智能 智慧 new create smart',
            icon: 'ic-smart-folder-new.svg',
            click: function () {
              machineryNewSmartFolder(s, event, smartFolder);
              scopeEvalAsync();
            }
          },
          // 新增子文件夾
          {
            label: i18n.__('context.folder.newSubFolder'),
            keywords: '資料夾 文件夾 新建 建立 新增 智能 智慧 子 smart folder dir new create sub child',
            icon: 'ic-smart-folder-new-sub.svg',
            click: function () {
              newChildSmartFolder(event, smartFolder);
              scopeEvalAsync();
            }
          },
          // 重命名
          {
            accelerator: s.$root.preferences.shortcuts.keybinds[`edit.rename.${w.process.platform}`],
            label: i18n.__('context.smartFolder.renameFolder'),
            keywords: '重命名 重新命名 rename',
            icon: 'ic-rename.svg',
            click: () => {
              machineryRenameSmartFolder(s, event, smartFolder);
              scopeEvalAsync();
            }
          },
          // 修改規則
          {
            accelerator: preferences.shortcuts.keybinds['edit.folder.setting'],
            label: i18n.__('context.smartFolder.editRules'),
            keywords: '規則 修改 編輯 edit rule',
            icon: 'ic-smart-folder-rule.svg',
            click: () => {
              settingFolder(event, smartFolder);
              scopeEvalAsync();
            }
          },
          // 克隆
          {
            label: i18n.__('context.smartFolder.clone'),
            keywords: '複製 克隆 clone',
            icon: 'ic-clone.svg',
            click: () => {
              cloneSmartFolder(event, smartFolder);
              scopeEvalAsync();
            }
          },
          // 複製連結
          {
            label: i18n.__('appmenu.edit>copyAsLink'),
            keywords: '複製 連結 copy link',
            icon: 'ic-copy-link.svg',
            click: () => {
              copySmartFolderLink(event, smartFolder);
              scopeEvalAsync();
            }
          },
          // 刷新
          {
            label: i18n.__('context.order.refresh'),
            keywords: '刷新 重新載入 refresh reload',
            icon: 'ic-refresh.svg',
            click: () => {
              refreshSmartFolderCount(event);
              scopeEvalAsync();
            }
          },
          // 添加到最愛 / 從最愛移除
          {
            visible: isOpenQuickAccess,
            role: 'separator'
          },
          {
            visible: isOpenQuickAccess && !isAddedQuickAccess,
            label: i18n.__('context.smartFolder.quickAccessAdd'),
            keywords: '最愛 加入 快速存取 add quick access favorite',
            icon: 'ic-favorite-add.svg',
            click: () => {
              w.QuickAccessManager.add('smartFolder', smartFolder);
              scopeEvalAsync();
            }
          },
          {
            visible: isOpenQuickAccess && isAddedQuickAccess,
            label: i18n.__('context.smartFolder.quickAccessRemove'),
            keywords: '最愛 移除 快速存取 remove quick access favorite',
            icon: 'ic-favorite-remove.svg',
            click: () => {
              w.QuickAccessManager.remove('smartFolder', smartFolder);
              scopeEvalAsync();
            }
          },
          // ---
          {
            role: 'separator'
          },
          // 導出
          {
            icon: 'ic-export.svg',
            label: i18n.__('context.smartFolder.export'),
            submenu: {
              items: [
                {
                  label: i18n.__('context.smartFolder.export>computer'),
                  keywords: '導出 エクスポート 本地 export computer local',
                  icon: 'ic-export-computer.svg',
                  click: () => {
                    smartFolderExportAsFolder(event, smartFolder);
                    scopeEvalAsync();
                  }
                },
                {
                  label: i18n.__('context.smartFolder.export>eaglepack'),
                  keywords: '導出 エクスポート export eaglepack',
                  icon: 'ic-export-eaglepack.svg',
                  click: () => {
                    smartFolderExportAsPack(event, smartFolder);
                    scopeEvalAsync();
                  }
                }
              ]
            }
          },
          // 添加至資源庫
          {
            label: i18n.__('context.image.addToLibrary'),
            keywords: '',
            icon: 'ic-library-add-to.svg',
            submenu: historyLibraryMenu
          },
          // ---
          // emoji
          {
            label: i18n.__('context.smartFolder.changeIcon'),
            icon: 'ic-emoji.svg',
            submenu: {
              items: [{
                role: 'emoji',
                click: (emoji: any) => {
                  changeSmartFolderIcon(event, smartFolder, emoji);
                }
              }]
            }
          },
          // color
          {
            role: 'color',
            click: (color: any) => {
              changeSmartFolderColor(event, smartFolder, color);
              scopeEvalAsync();
            }
          },
          // ---
          // 刪除
          {
            role: 'separator'
          },
          {
            accelerator: (w.process.platform === 'win32') ? 'Delete' : 'CmdOrCtrl+⌫',
            label: i18n.__('context.smartFolder.removeFolder'),
            keywords: '資料夾 文件夾 刪除 移除 remove delete smart folder dir',
            icon: 'ic-smart-folder-remove.svg',
            click: () => {
              machineryRemoveSmartFolder(s, smartFolder);
              scopeEvalAsync();
            }
          },
        ];
      }

      const folderEl = event && event.currentTarget;
      ContextMenu.open({
        items: items,
        showSearch: true,
        onOpened: () => {
          try { folderEl && folderEl.classList && folderEl.classList.add('context-activate'); } catch (err) {}
        },
        onClosed: () => {
          try { folderEl && folderEl.classList && folderEl.classList.remove('context-activate'); } catch (err2) {}
        }
      });
    }).apply(null, args);
}

/* ── b1-9bz-B-8：以下 3 个函数由 installFolderMenuFns 的匿名表项提升为模块级具名导出 ──
   原形为 `fns["X"] = function (...args) {…}`，依赖 install 内局部闭包，而调用点
   （openFolderContextMenu / openSmartFolderContextMenu）在**模块级函数**内，
   无法用局部 const 替代，故连同依赖闭包一并提升（bundle 41765-41781 / 41782-41829 /
   26287-26290 / 26301-26331 逐字）。 */

function reorderFolderByTitleClosure(folders: any, reverse: any) {
  folders = folders.sort(function (a: any, b: any) {
    try {
      var na = a.name.toLowerCase();
      var nb = b.name.toLowerCase();
      if (na && nb) {
        return na.localeCompare(nb, (window as any).languageBCP, { numeric: true });
      }
    }
    catch (err) {}
  });

  if (reverse) {
    folders = folders.reverse();
  }
}

function ayncsUpdateSmartFoldersCount(smartFolders: any, callback: any) {
  const s = getScope();
  if (!smartFolders || smartFolders.length === 0) return;
  setTimeout(() => {
    let total = smartFolders.length;
    let once = 3;
    let loopCount = total / once;
    let countOfSend = 0;

    function send() {
      var start = countOfSend * once;
      var arr = smartFolders.slice(start, start + once);
      countOfSend += 1;

      for (let i = 0; i < arr.length; i++) {
        arr[i].imageCount = machinerySmartFolderCount(s, arr[i]);
        if (!arr[i].pinyin) {
          arr[i].pinyin = (window as any).tinyPinyin.convertToPinyin(arr[i].name);
        }
      }

      scopeEvalAsync();

      loop();
    }

    function loop() {
      if (countOfSend < loopCount) {
        window.requestAnimationFrame(send);
      }
      else {
        callback && callback();
      }
    }
    loop();
  }, 30);
}

export function reorderFolderByTitle(...args: any[]) {
  const s = getScope();
  if (!s) return;
  return (function (folders: any, reverse: any) {
    swal({
      html: `
                  <div class="alert">
                      <div class="alert-icon warning"></div>
                      <h4 class="alert-title">${i18n.__('dialog.reorderFolder.title')}</h4>
                  </div>
              `,
      showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
      width: 400,
      customClass: 'alert-box',
      cancelButtonColor: '#777777',
      confirmButtonText: i18n.__('dialog.reorderFolder.sortBtn'),
      cancelButtonText: i18n.__('general.cancel'),
    }).then(function () {
      reorderFolderByTitleClosure(folders, reverse);
      machineryUpdateSidebarList(s);
      machinerySaveFolder(s);
      scopeEvalAsync();
      try { wElectronLogInfo('[app] Sort folders by folder name'); } catch (err) {}
    });
  }).apply(null, args);
};

export function reorderAllFolderByTitle(...args: any[]) {
  const s = getScope();
  if (!s) return;
  return (function (reverse: any) {
    swal({
      html: `
                  <div class="alert">
                      <div class="alert-icon warning"></div>
                      <h4 class="alert-title">${i18n.__('dialog.reorderFolder.title')}</h4>
                  </div>
              `,
      showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
      width: 400,
      customClass: 'alert-box',
      cancelButtonColor: '#777777',
      confirmButtonText: i18n.__('dialog.reorderFolder.sortBtn'),
      cancelButtonText: i18n.__('general.cancel'),
    }).then(function () {
      reorderFolderByTitleClosure(s.folders, reverse);
      treeWalkSafe(s.folders, 'children', function (folder: any, parent: any) {
        reorderFolderByTitleClosure(folder.children, reverse);
      });
      machineryUpdateSidebarList(s);
      machinerySaveFolder(s);
      scopeEvalAsync();
      try { wElectronLogInfo('[app] Sort all folders by folder name'); } catch (err) {}
    });
  }).apply(null, args);
};

export function refreshSmartFolderCount(...args: any[]) {
  const s = getScope();
  if (!s) return;
  return (function () {
    ayncsUpdateSmartFoldersCount(s.smartFolderList, () => {});
  }).apply(null, args);
};
