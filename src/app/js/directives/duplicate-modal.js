EagleApp.directive('duplicateModal', function ($timeout, $rootScope, $filter) {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/duplicate-modal.html',
        scope: {
            theme: '=theme',
            folderMappings: '=folderMappings',
            itemMappings: '=itemMappings',
        },
        link: function ($scope, element, attrs, controllersArr) {
            
            $scope.$body = $bodyScope;
            $scope.duplicateScope = $scope;
            $scope.isOpen = false;
            $scope.left = undefined;
            $scope.right = undefined;
            $scope.duplicates = [];
            $scope.applyAll = 'false';
            $scope.usingExist = 'true';
            rootScope = angular.element("body").scope();

            $("body").on("click", ".duplicate-modal *", function () {
                $("#duplicate-input").focus();
            });

            $scope.$on("OPEN_DUPLICATE", function (e, params) {
                ipcRenderer.send('show');
                $scope.currentFolder = params.currentFolder;
                $scope.mappings = params.mappings;
                $scope.applyAll = 'false';
                params.duplicates.forEach(function (d) {
                    $scope.duplicates.push(d);
                })
                loadFirst();
                $timeout(() => {
                    $scope.isOpen = true;
                    setTimeout(function () {
                        $("#duplicate-input").focus();
                    }, 200);
                }, 300);
            });

            ipcRenderer.on('image.changed', function (event, newImage) {
                if ($scope.duplicates && $scope.duplicates.length > 0) {
                    var hashID = getHashID(newImage);
                    for (var i = 0; i < $scope.duplicates.length; i++) {
                        var img = $scope.duplicates[i];
                        if (hashID == getHashID(img)) {
                            img.palettes = newImage.palettes;
                            delete img.processingPalette;
                        }
                    }
                }
            });

            function loadFirst() {
                var hashID = getHashID($scope.duplicates[0]);
                var image = $scope.duplicates[0];
                $scope.left = $scope.mappings[hashID];
                $scope.right = image;
            };

            $scope.revealInUnfiled = (item) => {
                $bodyScope.openUnfiled();
                $timeout(function () {
                    $bodyScope.selected = [item];
                    $bodyScope.scrollToSelectedItem();
                }, 500);
            };

            $scope.onKeyup = function (event) {
                var keyCode = event.keyCode;
                if (keyCode === 27) {
                    if (event.metaKey || event.ctrlKey) {
                        $scope.cancelAll();
                    }
                    else {
                        $scope.cancel();
                    }
                }
                if (keyCode === 13) {
                    if (event.metaKey || event.ctrlKey) {
                        $scope.saveAll();
                    }
                    else {
                        $scope.save();
                    }
                }
            };

            // 取得继承炼的标签
            function getExtendTags(folder, tags) {
                try {
                    if (folder.tags) {
                        folder.tags.forEach(function (tag) {
                            tags.push(tag);
                        });
                    }
                    var parent = $scope.folderMappings[folder.parent];
                    if (parent && parent.tags && folder.parent) {
                        return getExtendTags(parent, tags);
                    }
                    else {
                        return tags.unique().reverse();
                    }
                }
                catch (err) {
                    electronLog && electronLog.error(err.stack || err);
                    return [];
                }
            }

            $scope.save = function () {

                if ($scope.applyAll == 'true') {
                    $scope.saveAll();
                }
                else {

                    // 如果勾选使用资源库版本
                    if ($scope.usingExist == 'true') {

                        // 将新导入对应的文件夹添加到既有文件上
                        try {
                            var newFileFolders = $scope.right.folders;
                            if (newFileFolders && newFileFolders.length > 0) {
                                newFileFolders.forEach(function (folderId) {
                                    var folder = $bodyScope.folderMappings[folderId];
                                    if (!folder) return;

                                    var idx = $scope.left.folders.indexOf(folderId);
                                    if (idx === -1) {
                                        $scope.left.folders.push(folderId);
                                        // 添加自动标签
                                        if (!$scope.left.tags) {
                                            $scope.left.tags = [];
                                        }
                                        var tags = getExtendTags(folder, []);
                                        tags.forEach(function (tag) {
                                            $scope.left.tags.push(tag);
                                        });
                                    }
                                });
                            }
                        } catch (err) { }

                        $scope.left.folders = [...new Set($scope.left.folders)];
                        $scope.left.tags = [...new Set($scope.left.tags)];

                        $scope.left.modificationTime = $scope.right.modificationTime;
                        ipcRenderer.send('images-change', [$scope.left]);
                        ipcRenderer.send('empty-trash', $scope.right.id);
                    }
                    else {
                        // 將圖片添加至內容列表
                        rootScope.addToDuplicateMapping($scope.right);
                        rootScope.raw.push($scope.right);
                    }
                    $scope.duplicates.splice(0, 1);
                    $rootScope.$broadcast("CALCULATE_IMAGE_BINDING");
                    $rootScope.$broadcast("REBIND_REFRESH", false);

                    ipcRenderer.send('palette-resume');

                    if ($scope.duplicates.length > 0) {
                        loadFirst();
                    }
                    else {
                        $scope.close();
                    }
                }
            };

            $scope.saveAll = function () {

                // 如果勾选使用资源库版本
                if ($scope.usingExist == 'true') {
                    // left: $scope.mappings[hashID]
                    var imageIdString = "";
                    $scope.duplicates.forEach(function (right) {
                        var hashID = getHashID(right);
                        var left = $scope.mappings[hashID];

                        try {
                            var newFileFolders = right.folders;
                            if (newFileFolders && newFileFolders.length > 0) {
                                newFileFolders.forEach(function (folderId) {
                                    var folder = $bodyScope.folderMappings[folderId];
                                    if (!folder) return;

                                    var idx = left.folders.indexOf(folderId);
                                    if (idx === -1) {
                                        left.folders.push(folderId);
                                        // 添加自动标签
                                        if (!left.tags) {
                                            left.tags = [];
                                        }
                                        var tags = getExtendTags(folder, []);
                                        tags.forEach(function (tag) {
                                            left.tags.push(tag);
                                        });
                                    }
                                });
                            }
                        } catch (err) { }

                        left.folders = [...new Set(left.folders)];
                        left.tags = [...new Set(left.tags)];
                        left.modificationTime = right.modificationTime;
                        ipcRenderer.send('images-change', [left]);
                        imageIdString += right.id + ",";
                    });
                    ipcRenderer.send('empty-trash', imageIdString);
                }
                else {
                    $scope.duplicates.forEach(function (image) {
                        rootScope.addToDuplicateMapping(image);
                        rootScope.raw.push(image);
                    });
                }

                $scope.duplicates = [];
                $rootScope.$broadcast("CALCULATE_IMAGE_BINDING");
                $rootScope.$broadcast("REBIND_REFRESH", false);
                ipcRenderer.send('palette-resume');
                $scope.close();
            };

            $scope.cancel = function () {

                if ($scope.applyAll == 'true') {
                    $scope.cancelAll();
                }
                else {
                    // 移除該圖片
                    var image = $scope.right;

                    ipcRenderer.send('empty-trash', image.id);
                    $scope.duplicates.splice(0, 1);
                    delete $scope.itemMappings[image.id];

                    if ($scope.duplicates.length > 0) {
                        loadFirst();
                    }
                    else {
                        if ($bodyScope.selectedMappings[image.id]) {
                            $bodyScope.selectedMappings = {};
                            $bodyScope.selected = [];
                            $bodyScope.updateSelection();
                        }
                        $scope.close();
                    }
                }
            };

            $scope.cancelAll = function () {
                var imageIdString = "";
                $scope.duplicates.forEach(function (r) {
                    imageIdString += r.id + ",";
                    delete $scope.itemMappings[r.id];
                });
                ipcRenderer.send('empty-trash', imageIdString);
                $scope.duplicates = [];
                $rootScope.$broadcast("CALCULATE_IMAGE_BINDING");
                $rootScope.$broadcast("REBIND_REFRESH", false);
                $rootScope.$broadcast("gl:reset", rootScope.allData);
                $scope.close();
            };

            $scope.close = function () {
                $timeout(function () {
                    $scope.left = undefined;
                    $scope.right = undefined;
                    $scope.duplicates = [];
                    $scope.applyAll == 'false'
                }, 500);
                $scope.isOpen = false;
                $("#duplicate-input").blur();
            };
        }
    }
});