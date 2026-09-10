  // ── b1-9aq：台账⑨第三批——openSmartFolderContextMenu 主菜单 + 依赖面（bundle 39550-40105
  //    + 41395-41440/41652-41719/41831-42049/26287-26331/40267-40430 逐字）──

  // controller 闭包函数 ayncsUpdateSmartFoldersCount（bundle 26301-26331 逐字）
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
          arr[i].imageCount = s.smartFolderCount(arr[i]);
          if (!arr[i].pinyin) {
            arr[i].pinyin = (window as any).tinyPinyin.convertToPinyin(arr[i].name);
          }
        }

        s.$evalAsync();

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

  // refreshSmartFolderCount（bundle 26287-26290 逐字）
  fns["refreshSmartFolderCount"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function () {
      ayncsUpdateSmartFoldersCount(s.smartFolderList, () => {});
    }).apply(null, args);
  };

  // setSmartFoldersOrder + setSmartFolderOrder（bundle 41395-41422 逐字）
  fns["setSmartFoldersOrder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (smartFolders: any, orderBy: any, ignoreReload: any) {
      smartFolders.forEach(function (folder: any) {
        s.setSmartFolderOrder(folder, orderBy);
      });
      s.sortRawData(orderBy);
      s.rebindRefresh();
      s.$evalAsync();
    }).apply(null, args);
  };

  fns["setSmartFolderOrder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (folder: any, orderBy: any) {
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
      if (s.currentSmartFolder === folder) {
        s.reload();
      }
      s.saveFolder();
    }).apply(null, args);
  };

  // setSmartFoldersSortIncrease + setSmartFolderSortIncrease（bundle 41423-41440 逐字）
  fns["setSmartFoldersSortIncrease"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (smartFolders: any, sortIncrease: any, ignoreReload: any) {
      smartFolders.forEach(function (folder: any) {
        s.setSmartFolderSortIncrease(folder, sortIncrease);
      });
    }).apply(null, args);
  };

  fns["setSmartFolderSortIncrease"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (folder: any, sortIncrease: any) {
      if (!folder) return;
      folder.sortIncrease = !!sortIncrease;
      if (s.currentSmartFolder === folder) {
        s.reload();
      }
      s.saveFolder();
    }).apply(null, args);
  };

  // batchRenameSmartFolders（bundle 41654-41662 逐字）
  fns["batchRenameSmartFolders"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function () {
      var selectedSmartFolders = s.$root.selectedSmartFolders;
      if (selectedSmartFolders.length === 0) return;

      s.$root.$broadcast('OPEN_RENAME', {
        type: 'SMART_FOLDER',
        folders: selectedSmartFolders
      });
    }).apply(null, args);
  };

  // changeSmartFolderIcon / changeSmartFolderColor（bundle 41664-41687 逐字）
  fns["changeSmartFolderIcon"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, smartFolder: any, icon: any) {
      const w = window as any;
      if (!icon) {
        delete smartFolder.icon;
      }
      else {
        smartFolder.icon = icon;
      }
      s.saveFolder();
      try { w.electronLog && w.electronLog.info(`[app] Change folder: ${smartFolder.name}(${smartFolder.id}) icon to: ${icon}`); } catch (err) {}
      w.analytics.event('ChangeIcon', 'SmartFolder', icon);
    }).apply(null, args);
  };

  fns["changeSmartFolderColor"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, smartFolder: any, color: any) {
      const w = window as any;
      if (!color) {
        delete smartFolder.iconColor;
      }
      else {
        smartFolder.iconColor = color;
      }
      s.updateSidebarList();
      s.saveFolder();
      try { w.electronLog && w.electronLog.info(`[app] Change smart-folder: ${smartFolder.name}(${smartFolder.id}) icon color to: ${color}`); } catch (err) {}
      w.analytics.event('ChangeColor', 'SmartFolder', color);
    }).apply(null, args);
  };

  // changeSelectedSmartFoldersIcon / changeSelectedSmartFoldersColor（bundle 40022-40084 逐字）
  fns["changeSelectedSmartFoldersIcon"] = function (...args) {
    const s = getScope();
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
      s.updateSidebarList();
      s.saveFolder();
      try { w.electronLog && w.electronLog.info(`[app] Change ${s.$root.selectedSmartFolders.length} smart-folders icon to: ${icon}`); } catch (err) {}
      w.analytics.event('ChangeIcon', 'SmartFolder', icon);
    }).apply(null, args);
  };

  fns["changeSelectedSmartFoldersColor"] = function (...args) {
    const s = getScope();
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
      s.updateSidebarList();
      s.saveFolder();
      try { w.electronLog && w.electronLog.info(`[app] Change ${s.$root.selectedSmartFolders.length} smart-folders icon color to: ${color}`); } catch (err) {}
      w.analytics.event('ChangeColor', 'SmartFolder', color);
    }).apply(null, args);
  };

  // cloneSmartFolder（bundle 41689-41718 逐字；angular.copy→JSON 深拷）
  fns["cloneSmartFolder"] = function (...args) {
    const s = getScope();
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
        s.updateSidebarList();
        s.saveFolder();
        try { w.electronLog && w.electronLog.info(`[app] Clone smart-folder: ${smartFolder.name}(${smartFolder.id}), new smart-folder: ${newFolder.name}(${newFolder.id})`); } catch (err) {}
      }
    }).apply(null, args);
  };

  // renameSmartFolder（bundle 41652-41662 邻接定义逐字）
  fns["renameSmartFolder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, smartFolder: any) {
      s.viewMode = undefined;
      s.currentSmartFolder = smartFolder;
      smartFolder.editable = true;
      smartFolder.newFolderName = smartFolder.name;
      setTimeout(function () {
        wQueryFocusFolderInput(smartFolder.id);
      }, 100);
      setTimeout(function () {
        wQueryFocusFolderInput(smartFolder.id);
      }, 200);
    }).apply(null, args);
  };

  // copySmartFolderLink（bundle 46617-46626 逐字）
  fns["copySmartFolderLink"] = function (...args) {
    const s = getScope();
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
  };

  // controller 闭包函数 removeSmartFolder（bundle 41851-41934 逐字；angular.copy→JSON 深拷）
  function removeSmartFolderClosure(smartFolder: any, { ignoreSelectNext, ignoreRestore }: any) {
    const s = getScope();
    const w = window as any;

    var message = $filter('i18n')('notify.folder.remove', [
      { property: 'folder', value: smartFolder.name },
    ]);

    var children = s.smartFolders;
    if (smartFolder.parent && s.smartFolderMappings[smartFolder.parent]) {
      let parent = s.smartFolderMappings[smartFolder.parent];
      children = parent.children;
    }
    var origin = JSON.parse(JSON.stringify(children));
    var idx = children.indexOf(smartFolder);

    if (idx === -1) return;

    children.splice(idx, 1);
    delete s.smartFolderMappings[smartFolder.id];
    w.QuickAccessManager.remove('smartFolder', smartFolder);

    // 如果已經沒有資料夾
    if (idx === 0) {
      if (children[idx]) {
        s.openSmartFolder(children[idx]);
      } else {
        s.currentSmartFolder = undefined;
        s.openAll();
      }
    }
    // 如果還有資料夾
    else {
      if (children[idx]) {
        s.openSmartFolder(children[idx]);
      } else {
        if (children[idx - 1]) {
          s.openSmartFolder(children[idx - 1]);
        } else {
          s.currentSmartFolder = undefined;
          s.openAll();
        }
      }
    }

    // 如果声音效果是开启的
    if (s.$root.preferences.notification.soundEffect.enable != 'false' && s.$root.preferences.notification.soundEffect.when.deleteFolder == 'true') {
      s.removeSound && s.removeSound.play && s.removeSound.play();
    }
    s.updateSidebarList();

    $timeout(function () {
      s.saveFolderDebounce && s.saveFolderDebounce();
    }, 1000);

    w.electronLog && w.electronLog.info(`[app] Remove smart-folder: ${smartFolder.name}(${smartFolder.id})`);

    if (!ignoreRestore) {
      (s.$root.notify || s.notify).call(s.$root, {
        message: message,
        duration: 5000,
      }, function () {
        if (smartFolder.parent && s.smartFolderMappings[smartFolder.parent]) {
          let parent = s.smartFolderMappings[smartFolder.parent];
          parent.children = origin;
        }
        else {
          s.smartFolders = origin;
        }
        s.smartFolderMappings[smartFolder.id] = smartFolder;
        treeWalkSafe(s.smartFolders, 'children', function (sf: any, parent: any, depth: any) {
          s.smartFolderMappings[sf.id] = sf;
        });
        s.updateSidebarList();
        s.openSmartFolder(smartFolder);
        s.saveFolderDebounce && s.saveFolderDebounce();
        s.$evalAsync();
      });
    }
  }

  // removeSmartFolder / removeSelectedSmartFolders（bundle 41831-42049 逐字）
  fns["removeSmartFolder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (smartFolder: any) {
      setTimeout(function () {
        var removeConfirmMsg = $filter('i18n')('dialog.removeSmartFolder.desc', [
          { property: 'folder', value: smartFolder.name },
        ]);
        swal({
          html: `
                        <div class="alert">
                            <div class="alert-icon warning"></div>
                            <h4 class="alert-title">${i18n.__('dialog.removeSmartFolder.title')}</h4>
                            <p class="alert-desc">${removeConfirmMsg}</p>
                        </div>
                    `,
          showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
          width: 400,
          customClass: 'alert-box',
          cancelButtonColor: '#777777',
          confirmButtonText: i18n.__('dialog.removeSmartFolder.button'),
          cancelButtonText: i18n.__('general.cancel'),
        }).then(function () {
          removeSmartFolderClosure(smartFolder, {});
        });
      }, 100);
    }).apply(null, args);
  };

  fns["removeSelectedSmartFolders"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function () {
      if (s.$root.selectedSmartFolders.length === 0) return;

      var removeConfirmMsg = $filter('i18n')('dialog.removeSmartFolder.descMultiple', [
        { property: 'count', value: s.$root.selectedSmartFolders.length },
      ]);
      swal({
        html: `
                        <div class="alert">
                            <div class="alert-icon warning"></div>
                            <h4 class="alert-title">${$filter('i18n')('dialog.removeSmartFolder.title')}</h4>
                            <p class="alert-desc">${removeConfirmMsg}</p>
                        </div>
                    `,
        showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
        width: 400,
        customClass: 'alert-box',
        cancelButtonColor: '#777777',
        confirmButtonText: $filter('i18n')('dialog.removeSmartFolder.button'),
        cancelButtonText: $filter('i18n')('general.cancel'),
      }).then(function (result: any) {
        s.$root.selectedSmartFolders.forEach(function (smartFolder: any) {
          removeSmartFolderClosure(smartFolder, { ignoreRestore: true });
        });
        s.$root.selectedSmartFolders = [];
      }, function () {});
    }).apply(null, args);
  };

  // smartFolderExportAsPack（bundle 40267-40331 逐字；angular.extend→Object.assign）
  fns["smartFolderExportAsPack"] = function (...args) {
    const s = getScope();
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
            if (s.existInSmartFilter(smartFolder, image)) {
              return true;
            }
          }
          return false;
        }
        else {
          return s.existInSmartFilter(s.currentSmartFolder, image);
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
  };

  // smartFolderExportAsFolder（bundle 40333-40430 逐字）
  fns["smartFolderExportAsFolder"] = function (...args) {
    const s = getScope();
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
            if (s.existInSmartFilter(smartFolder, image)) {
              return true;
            }
          }
          return false;
        }
        else {
          return s.existInSmartFilter(s.currentSmartFolder, image);
        }
      };

      s.exportFolder(function (savePath: any) {
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
  };

  // newSmartFolder / newChildSmartFolder / newSmartFolderGroup / prependFolder（bundle 39866-39910 逐字）
  fns["newSmartFolder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, smartFolder: any) {
      s.$root.$broadcast('NEW.SMART.FOLDER', { smartFolder: smartFolder, parent: undefined });
    }).apply(null, args);
  };

  fns["newChildSmartFolder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (event: any, smartFolder: any) {
      s.$root.$broadcast('NEW.SMART.FOLDER', { smartFolder: smartFolder || s.currentSmartFolder, parent: smartFolder });
    }).apply(null, args);
  };

  fns["newSmartFolderGroup"] = function (...args) {
    const s = getScope();
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
      s.updateSidebarList();
      s.saveFolder();
      w.analytics.event('SmartFolder', 'CreateGroup');
      return smartFolderGroup;
    }).apply(null, args);
  };

  fns["prependFolder"] = function (...args) {
    const s = getScope();
    if (!s) return;
    return (function (folder: any) {
      s.folders.unshift(folder);
      s.folderMappings[folder.id] = folder;
      s.updateSidebarList();
      setTimeout(function () {
        s.calculateImageBinding({ ignoreSort: true }, function () {
          s.saveFolder();
        });
      }, 1000);
    }).apply(null, args);
  };

