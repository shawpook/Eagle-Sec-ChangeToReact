  fns["openSmartFolderContextMenu"] = function (...args) {
    const s = getScope();
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

      historyLibraryMenu.items = s.getLibraryHistory().filter((history: any) => {
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
            s.$root.$broadcast('ADD_TO_LIBRARY', {
              smartFolder: smartFolder,
              items: [],
              library: history
            });
            s.$evalAsync();
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
            s.setSmartFoldersOrder(selectedSmartFolders, undefined);
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
              s.setSmartFoldersOrder(selectedSmartFolders, uppercase || undefined);
            }
          };
        });

        let increaseItems = [
          {
            checked: currentOrderIncrease === true,
            label: i18n.__('context.order.orderBy>increase'),
            icon: 'ic-order-by-increase.svg',
            click: () => {
              s.setSmartFoldersSortIncrease(selectedSmartFolders, true);
            }
          },
          {
            checked: currentOrderIncrease === false,
            label: i18n.__('context.order.orderBy>decrease'),
            icon: 'ic-order-by-decrease.svg',
            click: () => {
              s.setSmartFoldersSortIncrease(selectedSmartFolders, false);
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
              s.$evalAsync();
            }
          },
          {
            visible: isOpenQuickAccess && isAddedQuickAccess,
            label: i18n.__('context.smartFolder.quickAccessRemove'),
            keywords: '最愛 移除 快速存取 remove quick access favorite',
            icon: 'ic-favorite-remove.svg',
            click: () => {
              w.QuickAccessManager.removeMultiple('smartFolder', selectedSmartFolders);
              s.$evalAsync();
            }
          },
          // 批次命名
          {
            accelerator: s.$root.preferences.shortcuts.keybinds[`edit.rename.${w.process.platform}`],
            label: i18n.__('context.image.batchRename.msg1') + selectedSmartFolders.length + i18n.__('context.image.batchRename.msg2'),
            keywords: '重命名 重新命名 rename',
            icon: 'ic-rename.svg',
            click: () => {
              s.batchRenameSmartFolders(event);
              s.$evalAsync();
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
                  s.changeSelectedSmartFoldersIcon(event, emoji);
                }
              }]
            }
          },
          // color
          {
            role: 'color',
            click: (color: any) => {
              s.changeSelectedSmartFoldersColor(event, color);
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
            label: i18n.__('context.smartFolder.removeFolder'),
            keywords: '資料夾 文件夾 刪除 移除 remove delete smart folder dir',
            icon: 'ic-smart-folder-remove.svg',
            click: () => {
              s.removeSelectedSmartFolders();
              s.$evalAsync();
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
              s.newSmartFolder(event, smartFolder);
              s.$evalAsync();
            }
          },
          // 新增子文件夾
          {
            label: i18n.__('context.folder.newSubFolder'),
            keywords: '資料夾 文件夾 新建 建立 新增 智能 智慧 子 smart folder dir new create sub child',
            icon: 'ic-smart-folder-new-sub.svg',
            click: function () {
              s.newChildSmartFolder(event, smartFolder);
              s.$evalAsync();
            }
          },
          // 重命名
          {
            accelerator: s.$root.preferences.shortcuts.keybinds[`edit.rename.${w.process.platform}`],
            label: i18n.__('context.smartFolder.renameFolder'),
            keywords: '重命名 重新命名 rename',
            icon: 'ic-rename.svg',
            click: () => {
              s.renameSmartFolder(event, smartFolder);
              s.$evalAsync();
            }
          },
          // 修改規則
          {
            accelerator: preferences.shortcuts.keybinds['edit.folder.setting'],
            label: i18n.__('context.smartFolder.editRules'),
            keywords: '規則 修改 編輯 edit rule',
            icon: 'ic-smart-folder-rule.svg',
            click: () => {
              s.settingFolder(event, smartFolder);
              s.$evalAsync();
            }
          },
          // 克隆
          {
            label: i18n.__('context.smartFolder.clone'),
            keywords: '複製 克隆 clone',
            icon: 'ic-clone.svg',
            click: () => {
              s.cloneSmartFolder(event, smartFolder);
              s.$evalAsync();
            }
          },
          // 複製連結
          {
            label: i18n.__('appmenu.edit>copyAsLink'),
            keywords: '複製 連結 copy link',
            icon: 'ic-copy-link.svg',
            click: () => {
              s.copySmartFolderLink(event, smartFolder);
              s.$evalAsync();
            }
          },
          // 刷新
          {
            label: i18n.__('context.order.refresh'),
            keywords: '刷新 重新載入 refresh reload',
            icon: 'ic-refresh.svg',
            click: () => {
              s.refreshSmartFolderCount(event);
              s.$evalAsync();
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
              s.$evalAsync();
            }
          },
          {
            visible: isOpenQuickAccess && isAddedQuickAccess,
            label: i18n.__('context.smartFolder.quickAccessRemove'),
            keywords: '最愛 移除 快速存取 remove quick access favorite',
            icon: 'ic-favorite-remove.svg',
            click: () => {
              w.QuickAccessManager.remove('smartFolder', smartFolder);
              s.$evalAsync();
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
                    s.smartFolderExportAsFolder(event, smartFolder);
                    s.$evalAsync();
                  }
                },
                {
                  label: i18n.__('context.smartFolder.export>eaglepack'),
                  keywords: '導出 エクスポート export eaglepack',
                  icon: 'ic-export-eaglepack.svg',
                  click: () => {
                    s.smartFolderExportAsPack(event, smartFolder);
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
          // emoji
          {
            label: i18n.__('context.smartFolder.changeIcon'),
            icon: 'ic-emoji.svg',
            submenu: {
              items: [{
                role: 'emoji',
                click: (emoji: any) => {
                  s.changeSmartFolderIcon(event, smartFolder, emoji);
                }
              }]
            }
          },
          // color
          {
            role: 'color',
            click: (color: any) => {
              s.changeSmartFolderColor(event, smartFolder, color);
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
            label: i18n.__('context.smartFolder.removeFolder'),
            keywords: '資料夾 文件夾 刪除 移除 remove delete smart folder dir',
            icon: 'ic-smart-folder-remove.svg',
            click: () => {
              s.removeSmartFolder(smartFolder);
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
