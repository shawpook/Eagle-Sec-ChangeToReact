EagleApp.directive('fileAddLibraryProgress', ($timeout, $rootScope, $filter) => {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/file-add-library-progress.html',
        scope: {},
        link: ($scope, element, attrs, controllersArr) => {
            var ipcRenderer = require('electron').ipcRenderer;

            $scope.isAdding = false;
            $scope.curr = 0;
            $scope.total = 0;
            $scope.libraryName = "";
            $scope.forceQuit = false;

            $scope.$on("ADD_TO_LIBRARY", function (e, params) {
                if (!params.library || !params.items) return;
                if (params.smartFolder || params.tagGroup) {
                    addToLibrary(params);
                    return;
                }

                if (params.items.length === 1) {
                    addToLibrary(params);
                    $scope.$evalAsync();
                }
                else {
                    var html = $filter('i18n')("Dialog.BulkAction.Descript", [
                        { "property": "count", "value": params.items.length },
                    ]);
                    swal({
                        html: `
                    <div class="alert">
                        <div class="alert-icon warning"></div>
                        <h4 class="alert-title">${i18n.__("Dialog.BulkAction.Title")}</h4>
                        <p class="alert-desc">${html}</p>
                    </div>
                `,
                        showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: false, focusCancel: false, padding: 24,
                        width: 400,
                        customClass: "alert-box",
                        cancelButtonColor: "#777777",
                        confirmButtonText: i18n.__("Dialog.BulkAction.Button"),
                        cancelButtonText: i18n.__("general.cancel"),
                        // allowEnterKey: false,
                    }).then(function (result) {
                        addToLibrary(params);
                        $scope.$evalAsync();
                    }, function () {
                    });
                }
            });

            $scope.cancel = function () {
                $scope.isAdding = false;
                $scope.forceQuit = true;
                ipcRenderer.send('electron-info', `[app] User interrupt the add library task.`);
            };

            function addToLibrary(params) {

                $scope.isAdding = true;
                $scope.total = params.items.length;
                $scope.libraryName = params.library.name;
                $scope.msg = $filter('i18n')("progress.copyingToLibrary.msg", [
                    { "property": "path", "value": $scope.libraryName },
                ]);

                let library = params.library;
                let libraryPath = library.path;
                let items = params.items;
                let folder = angular.copy(params.folder);
                let smartFolder = angular.copy(params.smartFolder);
                let tagGroup = angular.copy(params.tagGroup);
                let success = [];
                let fail = [];

                // 資源庫不存在
                if (!fs.existsSync(libraryPath)) {
                    ipcRenderer.send('show-error-box', {
                        title: i18n.__('dialog.libraryMissed.title'),
                        message: i18n.__('dialog.libraryMissed.desc')
                    });
                    return;
                }

                if (tagGroup) {
                    ipcRenderer.send('electron-info', `[app] Add tagGroup(${tagGroup.name}) to other library: ${libraryPath}`);

                    let targetMetadataPath = path.normalize(`${libraryPath}/metadata.json`);

                    fs.readFile(targetMetadataPath, "utf8", function (err, metadataJSON) {
                        if (err) {
                            ipcRenderer.send('electron-log', "" + err.stack || err);
                        }
                        else {
                            let library = JSON.parse(metadataJSON);
                            let targetTagsGroups = library.tagsGroups;

                            tagGroup.id = guid();
                            targetTagsGroups.unshift(tagGroup);

                            library.modificationTime = Date.now();
                            let newMetadataJSON = JSON.stringify(library);
                            updateLibraryMetadata(targetMetadataPath, newMetadataJSON);
                            $rootScope.notify({
                                message: i18n.__("general.taskFinished"),
                                duration: 800,
                            });
                        }
                    });
                    $scope.isAdding = false;
                    return;
                }

                if (smartFolder) {
                    ipcRenderer.send('electron-info', `[app] Add smartFolder(${smartFolder.name}) to other library: ${libraryPath}`);

                    let targetMetadataPath = path.normalize(`${libraryPath}/metadata.json`);

                    fs.readFile(targetMetadataPath, "utf8", function (err, metadataJSON) {
                        if (err) {
                            ipcRenderer.send('electron-log', "" + err.stack || err);
                        }
                        else {
                            let library = JSON.parse(metadataJSON);
                            let targetSmartFolders = library.smartFolders;

                            // 更换所有智能文件夹 ID
                            smartFolder.id = guid();
                            eagle.utils.tree.walk(smartFolder.children, 'children', function (child, parent) {
                                child.id = guid();
                            });

                            targetSmartFolders.unshift(smartFolder);
                            library.modificationTime = Date.now();
                            let newMetadataJSON = JSON.stringify(library);
                            updateLibraryMetadata(targetMetadataPath, newMetadataJSON);
                            $rootScope.notify({
                                message: i18n.__("general.taskFinished"),
                                duration: 800,
                            });
                        }
                    });
                    $scope.isAdding = false;
                    return;
                }

                if (folder) {
                    let clones = [];
                    cloneTree(clones, [folder]);
                    folder = clones[0];
                    ipcRenderer.send('electron-info', `[app] Add folder(${folder.name}) contains ${items.length} files to other library: ${libraryPath}`);

                    let targetMetadataPath = path.normalize(`${libraryPath}/metadata.json`);

                    fs.readFile(targetMetadataPath, "utf8", function (err, metadataJSON) {
                        if (err) {
                            ipcRenderer.send('electron-log', "" + err.stack || err);
                        }
                        else {
                            let library = JSON.parse(metadataJSON);
                            let targetFolders = library.folders;
                            let existsFolders = {};

                            targetFolders.forEach(function (targetFolder) {
                                existsFolders[targetFolder.id] = true;
                            });
                            eagle.utils.tree.walk(targetFolders, 'children', function (child, parent) {
                                existsFolders[child.id] = true;
                            });

                            // 避免重复文件夹
                            let removeFolders = [];
                            eagle.utils.tree.walk(folder.children, 'children', function (child, parent) {
                                if (parent && existsFolders[child.id]) {
                                    let idx = parent.children.indexOf(child);
                                    if (idx > -1) {
                                        removeFolders.push({
                                            folder: child,
                                            parent: parent
                                        });
                                    }
                                }
                            });
                            removeFolders.forEach(function (f) {
                                let parent = f.parent;
                                let folder = f.folder;
                                let idx = parent.children.indexOf(folder);
                                if (idx > -1) {
                                    parent.children.splice(idx, 1);
                                }
                            })

                            if (!existsFolders[folder.id]) {
                                targetFolders.unshift(folder);
                                library.modificationTime = Date.now();
                                let newMetadataJSON = JSON.stringify(library);
                                updateLibraryMetadata(targetMetadataPath, newMetadataJSON);
                            }
                        }
                    });
                }
                else {
                    ipcRenderer.send('electron-info', `[app] Add ${items.length} files to other library: ${libraryPath}`);
                }

                var cbs = items.map(function (item, index) {
                    return function (callback) {
                        if ($scope.forceQuit) {
                            fail.push(item);
                            callback();
                            return;
                        }
                        copyToLibrary(item, libraryPath, folder, index, function (err) {
                            if (err) {
                                fail.push(item);
                                ipcRenderer.send('electron-log', `[app] Add ${item.name} fail`);
                                ipcRenderer.send('electron-log', "" + err.stack || err);
                            }
                            else {
                                success.push(item);
                            }
                            $scope.curr++;
                            $scope.$evalAsync();
                            callback();
                        });
                    }
                });

                const async = require('async');
                async.parallelLimit(cbs, 5, function (err, result) {
                    $scope.isAdding = false;
                    $scope.curr = 0;
                    $scope.total = 0;
                    $scope.forceQuit = false;
                    ipcRenderer.send('electron-info', `[app] Add to library finished, total: ${items.length}, success: ${success.length}, fail: ${fail.length}`);
                    $rootScope.notify({
                        message: i18n.__("general.taskFinished"),
                        duration: 800,
                    });

                    let targetMtimePath = path.normalize(`${libraryPath}/mtime.json`);
                    fs.readFile(targetMtimePath, "utf8", function (err, data) {
                        if (!err) {
                            var mtimeMappings = JSON.parse(data);
                            items.forEach(function (item) {
                                mtimeMappings[item.id] = item.lastModified;
                            });
                            let updateedMtimeJSON = JSON.stringify(mtimeMappings);
                            fs.writeFile(targetMtimePath, updateedMtimeJSON, function (err) { });
                        }
                    });
                });
            }

            function updateLibraryMetadata(targetMetadataPath, newMetadataJSON) {
                let tempDir = targetMetadataPath.replace("metadata.json", "~$metadata.json.tmp")

                fs.writeFileSync(tempDir, newMetadataJSON);
                var outstream = fs.createWriteStream(targetMetadataPath, {
                    'flags': 'w'
                });
                outstream.write(newMetadataJSON);
                outstream.on('finish', function () {
                    var _jsonBytes = Buffer.byteLength(newMetadataJSON, 'utf8');
                    var _jsonSizeStr = _jsonBytes >= 1048576 ? (_jsonBytes / 1048576).toFixed(2) + ' MB' : (_jsonBytes / 1024).toFixed(2) + ' KB';
                    ipcRenderer.send('electron-info', `[bg] metadata.json updated successfully: ${targetMetadataPath} (${_jsonSizeStr})`);
                    console.log("除存成功");
                    fse.remove(tempDir);
                });
                outstream.on('error', function (err) {
                    ipcRenderer.send('electron-log', "" + err.stack || err);
                    try {
                        fs.renameSync(tempDir, targetMetadataPath);
                    }
                    catch (err) {
                        ipcRenderer.send('electron-log', "" + err.stack || err);
                    }
                });
                outstream.end();
            }

            function copyToLibrary(item, libraryPath, folder, index, callback) {
                try {

                    let itemDir = `${path.dirname(FileUrlHelper.getRawPath(item))}/`;
                    let outDir = path.normalize(`${libraryPath}/images/${item.id}.info/`);
                    let newMetadataFile = path.normalize(`${outDir}/metadata.json`);
                    fs.exists(outDir, function (isExists) {
                        if (isExists) {
                            return callback();
                        }
                        else {
                            fse.copy(itemDir, outDir, function (err) {
                                if (err) {
                                    ipcRenderer.send('electron-log', "" + err.stack || err);
                                    return callback(err);
                                }
                                fs.readFile(newMetadataFile, "utf8", function (err, result) {
                                    try {
                                        let newItem = JSON.parse(result);
                                        // 框选搬移文件，需移除原来的 folders 属性
                                        if (!folder) {
                                            newItem.folders = [];
                                        }
                                        // 自动排序的文件夹，不更新修改时间
                                        if (folder?.orderBy === "MANUAL") {
                                        }
                                        else {
                                            newItem.modificationTime = Date.now() + index;
                                        }
                                        let json = JSON.stringify(newItem);
                                        fs.writeFile(newMetadataFile, json, function (err) {
                                            callback(err);
                                        });
                                    }
                                    catch (err) {
                                        ipcRenderer.send('electron-log', "" + err.stack || err);
                                        return callback(err);
                                    }
                                });
                            });
                        }
                    })
                }
                catch (err) {
                    callback(err);
                }
            }
        }
    }
});