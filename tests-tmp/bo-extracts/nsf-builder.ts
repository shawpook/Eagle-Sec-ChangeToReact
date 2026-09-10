  // openNewSmartFolderContextMenu（bundle 39878-39910 逐字）
  fns["openNewSmartFolderContextMenu"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any) {
      ContextMenu.open({
        items: [
          {
            label: i18n.__('appmenu.file>createSmartFolder'),
            icon: 'ic-smart-folder-new.svg',
            accelerator: preferences.shortcuts.keybinds['file.create.smartfolder'],
            click: () => {
              s.newSmartFolder(event);
              s.$evalAsync();
            }
          },
          {
            label: i18n.__('appmenu.file>createSmartFolderGroup'),
            icon: 'ic-smart-folder-new-group.svg',
            click: () => {
              var smartFolderGroup = s.newSmartFolderGroup(event);
              s.openSmartFolder(smartFolderGroup);
              $timeout(function () {
                s.renameSmartFolder(event, smartFolderGroup);
              }, 150);
              s.$evalAsync();
            }
          }
        ],
        showSearch: false,
      });
    }).apply(null, args);
  };
