# -*- coding: utf-8 -*-
# b1-9ap 第二部分插入脚本（禁提交）
import io

p = 'src/app/react/core/controllerFns.ts'
s = io.open(p, encoding='utf-8').read()
anchor = '  return fns;\n}'
assert s.count(anchor) == 1, 'anchor must be unique'

block = r'''
  // changeFolderIcon / changeSelectedFoldersIcon（bundle 39981-40006 逐字）
  fns["changeFolderIcon"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, folder: any, icon: any) {
      const w = window as any;
      if (!icon) {
        delete folder.icon;
      }
      else {
        folder.icon = icon;
      }
      s.saveFolder();
      try { w.electronLog && w.electronLog.info(`[app] Change folder: ${folder.name}(${folder.id}) icon to: ${icon}`); } catch (err) {}
      w.analytics.event('ChangeIcon', 'Folder', icon);
    }).apply(null, args);
  };

  fns["changeSelectedFoldersIcon"] = function (...args) {
    const s = getScope();
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
      s.saveFolder();
      try { w.electronLog && w.electronLog.info(`[app] Change ${s.$root.selectedFolders.length} folders icon to: ${icon}`); } catch (err) {}
      w.analytics.event('ChangeIcon', 'Folder', icon);
    }).apply(null, args);
  };

  // changeFolderColor / changeSelectedFoldersColor（bundle 40040-40067 逐字）
  fns["changeFolderColor"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, folder: any, color: any) {
      const w = window as any;
      if (!color) {
        delete folder.iconColor;
      }
      else {
        folder.iconColor = color;
      }
      s.updateSidebarList();
      s.saveFolder();
      try { w.electronLog && w.electronLog.info(`[app] Change folder: ${folder.name}(${folder.id}) icon color to: ${color}`); } catch (err) {}
      w.analytics.event('ChangeColor', 'Folder', color);
    }).apply(null, args);
  };

  fns["changeSelectedFoldersColor"] = function (...args) {
    const s = getScope();
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
      s.updateSidebarList();
      s.saveFolder();
      try { w.electronLog && w.electronLog.info(`[app] Change ${s.$root.selectedFolders.length} folders icon color to: ${color}`); } catch (err) {}
      w.analytics.event('ChangeColor', 'Folder', color);
    }).apply(null, args);
  };

  // folderExportAsPack（bundle 40085-40134 逐字；angular.extend→Object.assign）
  fns["folderExportAsPack"] = function (...args) {
    const s = getScope();
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
  };

  // folderExportAsFolder（bundle 40136-40430 逐字）
  fns["folderExportAsFolder"] = function (...args) {
    const s = getScope();
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
      s.exportFolder(function (savePath: any) {
        folders.forEach(function (folder2: any) {
          exportFolder(folder2, savePath);
        });
      });
    }).apply(null, args);
  };

  // moveFolders（bundle 40431-40440 逐字）
  fns["moveFolders"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (selectedFolders: any, node: any) {
      var selected = (selectedFolders && selectedFolders.length > 0) ? selectedFolders : [node];
      if (selected && selected.length > 0) {
        s.$root.$broadcast('OPEN-MOVE-FOLDER-MODAL', {
          current: s.currentFolder,
          folders: s.folders,
          selectedFolders: selected
        });
      }
    }).apply(null, args);
  };

  // newFolder（bundle 40607-40732 逐字）
  fns["newFolder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (parent: any, isSubFolder: any, isSiblingFolder: any, ignoreAutoOpen: any) {
      const w = window as any;
      var folderId = guid();
      var folder: any = {
        id: folderId,
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

      // 预设状态：新增同级文件夹；若带有参数 parent 则新增子文件夹
      if (isSiblingFolder) {
        var father = s.folderMappings[parent.parent];
        var children = (father && father.children) ? father.children : s.folders;
        var idx = children.indexOf(parent);
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
        if (idx === -1) idx = children.length - 1;
        children.splice(idx + 1, 0, folder);
      }
      else if (s.currentFolder || parent) {
        var target = parent;
        var parent2 = parent || s.folderMappings[s.currentFolder.parent];
        var children2 = (parent2 && parent2.children) ? parent2.children : s.folders;
        var idx2 = children2.indexOf(s.currentFolder);
        if (parent2) {
          folder.parent = parent2.id;
          parent2.isExpand = true;
          // 创建新的文件夹自动继承父文件夹的颜色、图标设置
          if (target) {
            if (parent2 && parent2.icon !== undefined) {
              folder.icon = parent2.icon;
            }
            if (parent2 && parent2.iconColor !== undefined) {
              folder.iconColor = parent2.iconColor;
            }
          }
          else if (s.currentFolder) {
            if (parent2 && parent2.icon === s.currentFolder.icon) {
              folder.icon = parent2.icon;
            }
            if (parent2 && parent2.iconColor === s.currentFolder.iconColor) {
              folder.iconColor = parent2.iconColor;
            }
          }
          else {
            if (parent2 && parent2.icon !== undefined) {
              folder.icon = parent2.icon;
            }
            if (parent2 && parent2.iconColor !== undefined) {
              folder.iconColor = parent2.iconColor;
            }
          }
        } else {
          folder.parent = s.currentFolder.parent;
        }
        if (idx2 === -1) idx2 = children2.length - 1;
        if (isSubFolder) {
          children2.splice(0, 0, folder);
        }
        else {
          children2.splice(idx2 + 1, 0, folder);
        }
      }
      // 插入尾端
      else {
        var idx3 = s.folders.length;
        s.folders.splice(idx3, 0, folder);
      }

      s.folderMappings[folder.id] = folder;
      s.addToRecentFolders([folder.id]);

      setTimeout(function () {
        s.changeSidebarIndex(folder);
        s.$evalAsync();
        setTimeout(function () { wQueryFocusFolderInput(folder.id); }, 100);
        setTimeout(function () { wQueryFocusFolderInput(folder.id); }, 200);
      }, 150);

      setTimeout(function () {
        s.changeSidebarIndex(folder);
        s.$evalAsync();
        setTimeout(function () {
          const el = document.getElementById('folder-input-' + folder.id);
          if (el !== document.activeElement) {
            wQueryFocusFolderInput(folder.id);
          }
        }, 100);
      }, 250);

      s.updateSidebarList();

      // Note: 如果用戶當前選擇多個文件，表示正在分類，這時候不要跳轉是比較好的選擇
      if (s.selected.length === 0 && !ignoreAutoOpen) {
        s.openFolder(folder);
      }
      setTimeout(function () {
        s.calculateImageBinding({ ignoreSort: true }, function () {
          s.refreshSubfolderList();
          s.saveFolder();
          if (folder.parent) {
            w.electronLog && w.electronLog.info(`[app] New sub-folder: ${folder.id}, parent: ${folder.parent}`);
          }
          else {
            w.electronLog && w.electronLog.info(`[app] New folder: ${folder.id}`);
          }
          w.analytics.event('Folder', 'Create');
        });
      }, 300);
    }).apply(null, args);
  };

  // removeFolder / removeSelectedFolders（bundle 41935-42019 逐字；递归引用闭包版）
  fns["removeFolder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (folder: any, params: any = {}) {
      if (folder.password && !folder.isUnLock) return;

      // 如果圖片或子文件夾超過數量，就需要顯示詢問視窗
      if (folder.images && folder.imageCount > 0 || folder && folder.children.length > 0) {
        setTimeout(function () {
          var removeConfirmMsg = $filter('i18n')('dialog.removeFolder.desc', [
            { property: 'folder', value: folder.name },
          ]);
          swal({
            html: `
                            <div class="alert">
                                <div class="alert-icon warning"></div>
                                <h4 class="alert-title">${$filter('i18n')('dialog.removeFolder.title')}</h4>
                                <p class="alert-desc">${removeConfirmMsg}</p>
                            </div>
                        `,
            showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
            width: 400,
            customClass: 'alert-box',
            cancelButtonColor: '#777777',
            input: 'checkbox',
            inputValue: 1,
            inputValidator: function (result: any) {
              return new Promise(function (resolve, reject) {
                resolve(result);
              });
            },
            inputPlaceholder: $filter('i18n')('dialog.removeFolder.checkbox'),
            confirmButtonText: $filter('i18n')('dialog.removeFolder.button'),
            cancelButtonText: $filter('i18n')('general.cancel'),
          }).then(function (result: any) {
            s.checkOperationSafety2(folder.descendantImageCount, function () {
              params.isDeleteImages = (result == 1);
              removeFolderClosure(folder, params);
              s.$evalAsync();
            }, 50);
          }, function () {});
        }, 100);
      }
      else {
        removeFolderClosure(folder, params);
      }
    }).apply(null, args);
  };

  fns["removeSelectedFolders"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function () {
      if (s.$root.selectedFolders.length === 0) return;

      var removeConfirmMsg = $filter('i18n')('dialog.removeFolder.descMultiple', [
        { property: 'count', value: s.$root.selectedFolders.length },
      ]);
      swal({
        html: `
                        <div class="alert">
                            <div class="alert-icon warning"></div>
                            <h4 class="alert-title">${$filter('i18n')('dialog.removeFolder.title')}</h4>
                            <p class="alert-desc">${removeConfirmMsg}</p>
                        </div>
                    `,
        showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
        width: 400,
        customClass: 'alert-box',
        cancelButtonColor: '#777777',
        input: 'checkbox',
        inputValue: 1,
        inputValidator: function (result: any) {
          return new Promise(function (resolve, reject) {
            resolve(result);
          });
        },
        inputPlaceholder: $filter('i18n')('dialog.removeFolder.checkbox'),
        confirmButtonText: $filter('i18n')('dialog.removeFolder.button'),
        cancelButtonText: $filter('i18n')('general.cancel'),
      }).then(function (result: any) {
        s.checkOperationSafety2(s.$root.selectedFolders.length, function () {
          var isDeleteImages = (result == 1);
          s.$root.selectedFolders.forEach(function (folder: any) {
            if (folder.password && !folder.isUnLock) return;
            removeFolderClosure(folder, { isDeleteImages: isDeleteImages, ignoreRestore: true });
          });
        }, 1);
      }, function () {});
    }).apply(null, args);
  };

  // copyFolderLink（bundle 46606-46615 逐字）
  fns["copyFolderLink"] = function (...args) {
    const s = getScope();
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
  };

  // showListSubfolderContent（bundle 45351-45364 逐字）
  fns["showListSubfolderContent"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function () {
      const w = window as any;
      s.showSubfolderContent = !s.showSubfolderContent;
      preferences.showSubfolderContent = s.showSubfolderContent;
      (window as any).electronSettings.set('preferences', preferences).then(function () {});
      s.calculateImageBinding({ ignoreSort: true }, function () {
        s.rebindRefresh();
        s.updateSelection();
        const scrollbar = document.getElementById('box-container-scrollbar') || (w.$ && w.$('#box-container-scrollbar')[0]);
        if (scrollbar) scrollbar.dispatchEvent(new Event('UPDATE_BOX_SCROLLBAR', { bubbles: true }));
      });

      s.$evalAsync();
      if (s.showSubfolderContent) { w.electronLog && w.electronLog.info('[app] Show sub-folder on list: ON'); }
      else { w.electronLog && w.electronLog.info('[app] Show sub-folder on list: OFF'); }
    }).apply(null, args);
  };

  // openFolderContextMenu（bundle 39012-39549 逐字；ContextMenu.open → 模块常量广播；
  // $(event.delegateTarget) → React synthetic currentTarget classList）
  fns["openFolderContextMenu"] = function (...args) {
    const s = getScope();
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

      historyLibraryMenu.items = s.getLibraryHistory().filter((history: any) => {
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
            const items2 = s.getFolderImages(folder, true);
            s.$root.$broadcast('ADD_TO_LIBRARY', {
              folder: folder,
              items: items2,
              library: history
            });
            s.$evalAsync();
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
            s.setFoldersOrder(selectedFolders, undefined);
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
              s.setFoldersOrder(selectedFolders, uppercase || undefined);
            }
          };
        });

        let increaseItems = [
          {
            checked: currentOrderIncrease === true,
            label: i18n.__('context.order.orderBy>increase'),
            icon: 'ic-order-by-increase.svg',
            click: () => {
              s.setFoldersSortIncrease(selectedFolders, true);
            }
          },
          {
            checked: currentOrderIncrease === false,
            label: i18n.__('context.order.orderBy>decrease'),
            icon: 'ic-order-by-decrease.svg',
            click: () => {
              s.setFoldersSortIncrease(selectedFolders, false);
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
              s.$evalAsync();
            }
          },
          {
            visible: isOpenQuickAccess && isAddedQuickAccess,
            label: i18n.__('context.folder.quickAccessRemove'),
            keywords: '最愛 移除 快速存取 remove quick access favorite',
            icon: 'ic-favorite-remove.svg',
            click: () => {
              w.QuickAccessManager.removeMultiple('folder', selectedFolders);
              s.$evalAsync();
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
              s.moveFolders(selectedFolders, folder);
              s.$evalAsync();
            }
          },
          // 批次命名
          {
            accelerator: s.$root.preferences.shortcuts.keybinds[`edit.rename.${w.process.platform}`],
            label: i18n.__('context.image.batchRename.msg1') + selectedFolders.length + i18n.__('context.image.batchRename.msg2'),
            keywords: '重命名 重新命名 rename',
            icon: 'ic-rename.svg',
            click: () => {
              s.batchRenameFolders(event);
              s.$evalAsync();
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
                    s.folderExportAsFolder(event);
                    s.$evalAsync();
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
                  s.changeSelectedFoldersIcon(event, emoji);
                }
              }]
            }
          },
          // color
          {
            role: 'color',
            click: (color: any) => {
              s.changeSelectedFoldersColor(event, color);
              s.$evalAsync();
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
              s.removeSelectedFolders();
              s.$evalAsync();
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
              s.newFolder(folder, false, true);
              s.$evalAsync();
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
              s.newFolder(folder, true);
              s.$evalAsync();
            }
          },
          // 移動文件夾
          {
            label: i18n.__('context.folder.moveFolder'),
            keywords: 'move folder dir 資料夾 文件夾 移动',
            icon: 'ic-folder-move.svg',
            accelerator: s.$root.preferences.shortcuts.keybinds['edit.folder.move'],
            click: () => {
              s.moveFolders(selectedFolders, folder);
              s.$evalAsync();
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
              s.$evalAsync();
            }
          },
          {
            visible: isOpenQuickAccess && isAddedQuickAccess,
            label: i18n.__('context.folder.quickAccessRemove'),
            keywords: '最愛 移除 快速存取 remove quick access favorite',
            icon: 'ic-favorite-remove.svg',
            click: () => {
              w.QuickAccessManager.remove('folder', folder);
              s.$evalAsync();
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
              s.renameFolder(event, folder);
              s.$evalAsync();
            }
          },
          // 複製連結
          {
            label: i18n.__('appmenu.edit>copyAsLink'),
            keywords: '複製 連結 copy link',
            icon: 'ic-folder-copy-link.svg',
            click: () => {
              s.copyFolderLink(event, folder);
              s.$evalAsync();
            }
          },
          // 自動標籤
          {
            accelerator: 'CmdOrCtrl+Shift+R',
            label: i18n.__('context.folder.autoTagging'),
            icon: 'ic-folder-auto-tag.svg',
            disabled: disabled,
            click: (event2: any) => {
              s.settingFolder(event2, folder);
              s.$evalAsync();
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
                    s.setFolderPassword(folder);
                    s.$evalAsync();
                  }
                },
                {
                  disabled: !folder.password,
                  label: i18n.__('context.folder.password>change'),
                  accelerator: preferences.shortcuts.keybinds['edit.folder.password.change'],
                  click: () => {
                    s.changeFolderPassword(folder);
                    s.$evalAsync();
                  }
                },
                {
                  disabled: !folder.password,
                  label: i18n.__('context.folder.password>reset'),
                  accelerator: preferences.shortcuts.keybinds['edit.folder.password.reset'],
                  click: () => {
                    s.resetFolderPassword(folder);
                    s.$evalAsync();
                  }
                },
                {
                  disabled: !(!!folder.password && !!folder.isUnLock),
                  label: i18n.__('context.folder.password>lock'),
                  accelerator: preferences.shortcuts.keybinds['edit.folder.password.lock'],
                  click: () => {
                    s.lockFolder(event, folder);
                    s.$evalAsync();
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
                    s.reorderFolderByTitle(folders);
                  }
                },
                {
                  label: i18n.__('context.folder.sortByTitle>title') + `(${i18n.__('context.folder.sortByCurrentLevel')}) (Z→A)`,
                  keywords: i18n.__('context.folder.sortByTitle'),
                  click: () => {
                    let folders = (folder.parent) ? s.folderMappings[folder.parent].children : s.folders;
                    s.reorderFolderByTitle(folders, true);
                  }
                },
                {
                  label: i18n.__('context.folder.sortByTitle>title') + `(${i18n.__('context.folder.sortByAllLevel')}) (A→Z)`,
                  keywords: i18n.__('context.folder.sortByTitle'),
                  click: () => {
                    s.reorderAllFolderByTitle();
                  }
                },
                {
                  label: i18n.__('context.folder.sortByTitle>title') + `(${i18n.__('context.folder.sortByAllLevel')}) (Z→A)`,
                  keywords: i18n.__('context.folder.sortByTitle'),
                  click: () => {
                    s.reorderAllFolderByTitle(true);
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
              s.toggleSelectFolder(event, folder);
              s.$evalAsync();
            }
          },
          {
            label: i18n.__('Context.Expand.SameLevel.Folders'),
            icon: 'ic-expand-same.svg',
            click: () => {
              s.toggleCurrentLevelFolders(event, folder);
              s.$evalAsync();
            }
          },
          {
            accelerator: '/',
            label: i18n.__('Context.Expand.All.Folders'),
            icon: 'ic-expand-all.svg',
            click: () => {
              s.toggleAllFolderExpand(event, folder);
              s.$evalAsync();
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
              s.cloneFolder(event, folder);
              s.$evalAsync();
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
                    s.folderExportAsFolder(event, folder);
                    s.$evalAsync();
                  }
                },
                {
                  disabled: disabled,
                  label: i18n.__('context.folder.export>eaglepack'),
                  keywords: '導出 エクスポート export eaglepack',
                  icon: 'ic-export-eaglepack.svg',
                  click: () => {
                    s.folderExportAsPack(event, folder);
                    s.$evalAsync();
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
              s.showListSubfolderContent();
              s.$evalAsync();
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
                  s.changeFolderIcon(event, folder, emoji);
                }
              }]
            }
          },
          // color
          {
            role: 'color',
            click: (color: any) => {
              s.changeFolderColor(event, folder, color);
              s.$evalAsync();
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
              s.removeFolder(folder);
              s.$evalAsync();
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
  };

  return fns;
}'''

assert anchor in s, 'anchor missing'
s = s.replace(anchor, block + '\n  return fns;\n}', 1)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('PART2_OK')
