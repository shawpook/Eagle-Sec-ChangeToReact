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
