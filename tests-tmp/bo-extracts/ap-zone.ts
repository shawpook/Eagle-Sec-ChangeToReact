  // ── b1-9ap：台账⑨主菜单第一批——openFolderContextMenu 及其依赖面（bundle 39012-39549
  //    + 依赖 fns 逐字移植；$scope→s、$rootScope.$broadcast→s.$root 广播总线语义、
  //    angular.copy/extend→JSON 深拷/Object.assign、eagle.utils.tree.walk→treeWalkSafe）──

  // controller 闭包函数 reorderFolderByTitle（bundle 41765-41781 逐字）
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

  // controller 闭包函数 removeFolder（bundle 42050-42205 逐字；angular.copy→JSON 深拷）
  function removeFolderClosure(folder: any, { isDeleteImages, ignoreSelectNext, ignoreRestore }: any) {
    const s = getScope();
    const w = window as any;

    // 支持復原文件夾
    var originalFolders: any[] = [];
    var originalImages: any[] = [];
    var originalImageFolders: any[] = [];
    var folderId = folder.id;
    if (!ignoreRestore) {
      w.cloneTree(originalFolders, s.folders, true);
    }

    // 找到包含 folder 的 list
    var parent = s.folderMappings[folder.parent];
    var children = (parent) ? parent.children : s.folders;
    if (!Array.isArray(children)) return;

    var index = children.indexOf(folder);
    if (index === -1) return;

    // 移除 folder
    children.splice(index, 1);

    // 删除包含 folder.id 的图片
    if (s.raw && s.raw.length > 0) {
      var changed: any[] = [];
      for (var rindex = s.raw.length - 1; rindex >= 0; rindex--) {
        var image = s.raw[rindex];
        if (image.folders) {
          var idx = image.folders.indexOf(folder.id);
          if (idx > -1) {
            if (isDeleteImages) {
              // 如果圖片還存在於其它文件夾，就不丟到垃圾桶
              if (image.folders && image.folders.length === 1) {
                image.isDeleted = true;
              }
            }
            originalImageFolders.push(JSON.parse(JSON.stringify(image.folders)));
            image.folders.splice(idx, 1);
            changed.push(image);
            originalImages.push(image);
          }
        }
      }
      w.ayncsImagesChange(changed);
      w.hiddenByCurrentFilter(changed);
    }

    // 同时删除子文件夹图片
    if (folder.children) {
      treeWalkSafe(folder.children, 'children', function (child: any, parent2: any) {
        if (s.raw && s.raw.length > 0) {
          var changed2: any[] = [];
          for (var rindex2 = s.raw.length - 1; rindex2 >= 0; rindex2--) {
            var image2 = s.raw[rindex2];
            if (image2.folders) {
              var idx2 = image2.folders.indexOf(child.id);
              if (idx2 > -1) {
                if (isDeleteImages) {
                  // 如果圖片還存在於其它文件夾，就不丟到垃圾桶
                  if (image2.folders && image2.folders.length === 1) {
                    image2.isDeleted = true;
                  }
                }
                originalImageFolders.push(JSON.parse(JSON.stringify(image2.folders)));
                image2.folders.splice(idx2, 1);
                changed2.push(image2);
                originalImages.push(image2);
              }
            }
          }
          w.ayncsImagesChange(changed2);
          w.hiddenByCurrentFilter(changed2);
        }
      });
    }

    // 开启下一个文件夹（优先兄弟 → 父 → All）
    if (!ignoreSelectNext) {
      if (children.length > 0) {
        var next = children[index] || children[index - 1] || children[0];
        s.openFolder(next);
      } else if (parent) {
        s.openFolder(parent);
      } else {
        s.openAll();
      }
    }
    else {
      s.rebindRefresh();
    }

    // 播放删除音效
    if (s.$root.preferences.notification.soundEffect.enable != 'false' && s.$root.preferences.notification.soundEffect.when.deleteFolder == 'true') {
      s.removeSound && s.removeSound.play && s.removeSound.play();
    }

    w.QuickAccessManager.remove('folder', folder);
    if (folder.children && s.quickAccess.length > 0) {
      treeWalkSafe(folder.children, 'children', function (child: any, parent3: any) {
        w.QuickAccessManager.remove('folder', child);
      });
    }
    s.updateSidebarList();

    // 移除记录
    delete s.folderMappings[folder.id];
    void folderId;
    s.calculateImageBinding({ ignoreSort: true }, function () {
      s.$evalAsync();
      s.saveFolderDebounce && s.saveFolderDebounce();
      if (isDeleteImages) { w.electronLog && w.electronLog.info(`[app] Delete folder: ${folder.name}(${folder.id}), contains ${originalImages.length} files, all remain ${s.all.length} files, trash remain: ${s.trash.length} files`); }
      else { w.electronLog && w.electronLog.info(`[app] Delete folder: ${folder.name}(${folder.id}), just remove folder not contains ${originalImages.length} files, all remain ${s.all.length} files, trash remain: ${s.trash.length} files`); }
    });

    if (!ignoreRestore) {
      var message = $filter('i18n')('notify.folder.remove', [
        { property: 'folder', value: folder.name },
      ]);
      (s.$root.notify || s.notify).call(s.$root, {
        message: message,
        duration: 7000,
      }, function () {
        s.folders = originalFolders;

        treeWalkSafe(s.folders, 'children', function (folder3: any, parent3: any) {
          if (!folder3.children) { folder3.children = []; }
          if (folder3 && parent3) { folder3.parent = parent3.id; }
          s.folderMappings[folder3.id] = folder3;
        });

        for (var i = originalImages.length - 1; i >= 0; i--) {
          var image3 = originalImages[i];
          var imageOriginalFolders = originalImageFolders[i];
          if (image3.isDeleted && imageOriginalFolders && imageOriginalFolders.length > 0) {
            image3.isDeleted = false;
          }
          image3.folders = JSON.parse(JSON.stringify(imageOriginalFolders));
        }
        s.updateSidebarList();
        s.rebindRefresh();
        w.ayncsImagesChange(originalImages);
      });
    }
  }

  // checkOperationSafety2（bundle 26824-26852 逐字）
  fns["checkOperationSafety2"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return ((count: any, callback: any, amount: any = 100) => {
      try {
        if (count >= amount) {
          var html = $filter('i18n')('Dialog.BulkAction.Descript', [
            { property: 'count', value: count },
          ]);
          swal({
            html: `
                            <div class="alert">
                                <div class="alert-icon warning"></div>
                                <h4 class="alert-title">${i18n.__('Dialog.BulkAction.Title')}</h4>
                                <p class="alert-desc">${html}</p>
                            </div>
                        `,
            showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: false, focusCancel: false, padding: 24,
            allowEnterKey: false,
            width: 400,
            customClass: 'alert-box',
            cancelButtonColor: '#777777',
            confirmButtonText: i18n.__('Dialog.BulkAction.Button'),
            cancelButtonText: i18n.__('general.cancel'),
          }).then(function (result: any) {
            callback && callback();
            s.$evalAsync();
          });
        }
        else {
          callback && callback();
        }
      }
      catch (err) {
        callback && callback();
      }
    }).apply(null, args);
  };

  // refreshSubfolderList（bundle 27462-27490 逐字）——b1-9al 摘除 bundle 后悬空供给
  //（newFolder/removeFolder 回调消费），本批补移植
  fns["refreshSubfolderList"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function () {
      // 过滤子文件夹
      if (s.currentFolder) {
        let subFolders: any[] = [];
        if (s.showSubfolderContent) {
          s.subFolders = getAllChildFolder(s.currentFolder);
          if (s.subFolderSortableOptions) s.subFolderSortableOptions.disabled = true;
        }
        else {
          s.subFolders = s.currentFolder.children;
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
          if (s.subFolderSortableOptions) s.subFolderSortableOptions.disabled = true;
        }
      }
      else {
        s.subFolders = [];
      }
    }).apply(null, args);
  };

  // setFolderPassword / changeFolderPassword / resetFolderPassword（bundle 41324-41349 逐字）
  fns["setFolderPassword"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (folder: any) {
      var f = folder || s.currentFolder;
      if (!f) return;
      s.$root.$broadcast('SET-FOLDER-PASSWORD', { folder: f, mode: 'new' });
    }).apply(null, args);
  };

  fns["changeFolderPassword"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (folder: any) {
      var f = folder || s.currentFolder;
      if (!f) return;
      s.$root.$broadcast('SET-FOLDER-PASSWORD', { folder: f, mode: 'change' });
    }).apply(null, args);
  };

  fns["resetFolderPassword"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (folder: any) {
      var f = folder || s.currentFolder;
      if (!f) return;
      s.$root.$broadcast('SET-FOLDER-PASSWORD', { folder: f, mode: 'reset' });
    }).apply(null, args);
  };

  // setFoldersOrder + setFolderOrder（bundle 41351-41377 逐字）
  fns["setFoldersOrder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (folders: any, orderBy: any, ignoreReload: any) {
      folders.forEach(function (folder: any) {
        s.setFolderOrder(folder, orderBy);
      });
      s.sortRawData(orderBy);
      s.rebindRefresh();
      s.$evalAsync();
    }).apply(null, args);
  };

  fns["setFolderOrder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (folder: any, orderBy: any, ignoreReload: any) {
      if (!folder) return;
      if (!orderBy) {
        delete folder.orderBy;
        delete folder.sortIncrease;
      }
      else {
        folder.orderBy = orderBy;
        if (folder.sortIncrease === undefined) {
          folder.sortIncrease = true;
        }
      }
      if (s.currentFolder === folder && !ignoreReload) {
        s.reload();
      }
      s.saveFolder();
    }).apply(null, args);
  };

  // setFoldersSortIncrease + setFolderSortIncrease（bundle 41379-41395 逐字）
  fns["setFoldersSortIncrease"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (folders: any, sortIncrease: any, ignoreReload: any) {
      folders.forEach(function (folder: any) {
        s.setFolderSortIncrease(folder, sortIncrease);
      });
    }).apply(null, args);
  };

  fns["setFolderSortIncrease"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (folder: any, sortIncrease: any, ignoreReload: any) {
      if (!folder) return;
      folder.sortIncrease = !!sortIncrease;
      if (s.currentFolder === folder && !ignoreReload) {
        s.reload();
      }
      s.saveFolder();
    }).apply(null, args);
  };

  // lockFolder（bundle 41465-41478 逐字）
  fns["lockFolder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, f: any) {
      var folder = f || s.currentFolder;
      if (!folder) return;
      if (!folder.isUnLock || !folder.password) return;
      delete folder.isUnLock;
      s.isLoading = true;
      s.selected = [];
      s.updateSidebarList();
      s.calculateImageBinding({ ignoreSort: true }, function () {
        s.rebindRefresh();
        s.updateSelection();
        s.isLoading = false;
      });
    }).apply(null, args);
  };

  // settingFolder（bundle 41571-41593 逐字）
  fns["settingFolder"] = function (...args) {
    const s = getScope();
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
        s.$root.$broadcast('EDIT.SMART.FOLDER', f);
      }
      else {
        s.$root.$broadcast('FOLDER_SETTINGS', f);
      }
    }).apply(null, args);
  };

  // renameFolder（bundle 41617-41629 逐字）
  fns["renameFolder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, folder: any) {
      s.viewMode = undefined;
      s.currentFolder = folder;
      folder.editable = true;
      folder.newFolderName = folder.name;
      setTimeout(function () {
        wQueryFocusFolderInput(folder.id);
      }, 100);
      setTimeout(function () {
        wQueryFocusFolderInput(folder.id);
      }, 200);
    }).apply(null, args);
  };

  // batchRenameFolders（bundle 41631-41641 逐字）
  fns["batchRenameFolders"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function () {
      var selectedFolders = s.$root.selectedFolders;
      if (selectedFolders.length === 0) return;

      s.$root.$broadcast('OPEN_RENAME', {
        type: 'FOLDER',
        folders: selectedFolders
      });
    }).apply(null, args);
  };

  // reorderFolderByTitle / reorderAllFolderByTitle（bundle 41782-41829 逐字）
  fns["reorderFolderByTitle"] = function (...args) {
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
        s.updateSidebarList();
        s.saveFolder();
        s.$evalAsync();
        try { wElectronLogInfo('[app] Sort folders by folder name'); } catch (err) {}
      });
    }).apply(null, args);
  };

  fns["reorderAllFolderByTitle"] = function (...args) {
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
        s.updateSidebarList();
        s.saveFolder();
        s.$evalAsync();
        try { wElectronLogInfo('[app] Sort all folders by folder name'); } catch (err) {}
      });
    }).apply(null, args);
  };

  // cloneFolder（bundle 41720-41763 逐字；angular.copy→JSON 深拷）
  fns["cloneFolder"] = function (...args) {
    const s = getScope();
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
        s.updateSidebarList();
        s.saveFolder();
        try { wElectronLogInfo(`[app] Clone folder: ${folder.name}(${folder.id}), new folder: ${newFolder.name}(${newFolder.id})`); } catch (err) {}
      }
      s.calculateImageBinding({ ignoreSort: true }, function () {});
    }).apply(null, args);
  };


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

