EagleApp.directive('artstationImportModal', function ($timeout, $rootScope) {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/artstation-import-modal.html',
        scope: {},
        link: function ($scope, element, attrs, controllersArr) {

            let ipcRenderer = require('electron').ipcRenderer;
            let $appScope = angular.element("body").scope();

            $scope.artStationScope = $scope;
            $scope.importFolders = [];
            $scope.pageUrl = "";
            $scope.isOpen = false;
            $scope.isLoading = false;
            $scope.current = 0;

            $scope.close = function() {
                $scope.isOpen = false;
                $scope.isLoading = false;
                $scope.total = 0;
                $scope.current = 0;
            };

            $scope.selectFolders = function ($event) {

                const folders = $bodyScope.folders;
                let originalSelectedIds = $scope.importFolders.reduce((map, folder) => {
                    map[folder.id] = true;
                    return map;
                }, {});
                FolderSelectPanel.open({
                    folders: folders,
                    selectedIds: originalSelectedIds,
                    onChanged: (result) => {
                        if (!result?.isDirty) return;
        
                        const { selectedFolderIds, deselectedFolderIds } = result;
        
                        $scope.importFolders = [];
                        Object.keys(selectedFolderIds).forEach((id) => {
                            let folder = $appScope.folderMappings[id];
                            if (folder) {
                                $scope.importFolders.push(folder);
                            }
                        });
                        $scope.$evalAsync();
                    }
                });
            };

            $scope.createNewFolder = function (title) {
                var folder = {
                    id: guid(),
                    name: title,
                    tags: [],
                    images: [],
                    children: [],
                    modificationTime: Date.now(),
                    imagesMappings: {},
                    isExpand: true,
                    description: `${$scope.pageUrl}`
                };
                $appScope.folders.push(folder);
                $appScope.folderMappings[folder.id] = folder;
                $appScope.updateSidebarList();
                $appScope.calculateImageBinding();
                $appScope.saveFolder();
                return folder;
            }

            $scope.getFolderNames = function () {
                if ($scope.importFolders.length === 0) return i18n.__("modal.artstation.defaultFolder");
                return $scope.importFolders.map(function (fd) { return fd.name; }).join(",");
            };

            function open() {
                $scope.importFolders = [];
                $scope.current = 0;
                $scope.total = 0;
                $timeout(function() {
                    
                    $scope.isOpen = true;
                    setTimeout(function () {
                        $("#artstation-url").focus().select();
                    }, 300);
                }, 300);
            };

            $scope.$on('IMPORT_ARTSTATION', function (e) {
                open();
            });

            ipcRenderer.on("import-artstation", function(e) {
                open();
                $scope.$evalAsync();
            });

            $scope.vaildateUrl = function() {
                if (!$scope.pageUrl) return;
                if (!Artstation.isValidUrl($scope.pageUrl)) {
                    $scope.urlError = true;
                }
                else {
                    if (!$scope.pageUrl.match(/^[a-zA-Z]+:\/\//)) {
                        $scope.pageUrl = "https://" + $scope.pageUrl;
                    }
                    $scope.urlError = false;
                }
                return $scope.urlError;
            };

            $scope.importUrl = function() {
                if (!$scope.pageUrl) return;
                if ($scope.isLoading) return;
                if ($scope.vaildateUrl()) return;

                $scope.isLoading = true;

                // 修改 refer 避免图片呈现不出来
                var refer = $scope.pageUrl.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i) && $scope.pageUrl.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i)[0];
                remote.require('electron-referer')(refer, remote.getCurrentWindow());

                // var url = "https://www.artstation.com/rodionvlasov";
                $scope.current = 0;
                console.info("下载网址：" + $scope.pageUrl);
                Artstation.getUserInfo($scope.pageUrl, (err, result) => {

                    if (err) { 
                        console.log(err); return; 
                    }

                    $scope.current = 0;
                    $scope.total = result.total;
                    $scope.userName = result.userName;
                    $scope.$evalAsync();

                    console.info("用户 %s 拥有 %d 张图片", result.userName, result.total);

                    Artstation.getUserProjects({
                        total: result.total,
                        userName: result.userName,
                        url: result.url
                    }, (err, images) => {
                        if (err) return;
                        $scope.current += images.length;
                        console.info("下载进度 %d / %d", $scope.current, result.total);
                        $scope.$evalAsync();
                    }, (err, result) => {
                        console.info("下载完成，共下载了 %d 张图片", $scope.current);
                        console.log(result);
                        $scope.isLoading = false;
                        $scope.import({
                            title: $scope.userName,
                            images: result
                        });
                        $scope.$evalAsync();
                    });
                });
            };

            $scope.importUrlManual = function() {
                if (!$scope.pageUrl) return;
                if ($scope.isLoading) return;
                if ($scope.vaildateUrl()) return;

                $scope.isLoading = true;

                // 修改 refer 避免图片呈现不出来
                var refer = $scope.pageUrl.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i) && $scope.pageUrl.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i)[0];
                remote.require('electron-referer')(refer, remote.getCurrentWindow());

                // var url = "https://www.artstation.com/rodionvlasov";
                $scope.current = 0;
                console.info("下载网址：" + $scope.pageUrl);
                Artstation.getUserInfo($scope.pageUrl, (err, result) => {

                    if (err) { 
                        console.log(err); return; 
                    }

                    $scope.current = 0;
                    $scope.total = result.total;
                    $scope.userName = result.userName;
                    $scope.$evalAsync();

                    console.info("用户 %s 拥有 %d 张图片", result.userName, result.total);

                    Artstation.getUserProjects({
                        total: result.total,
                        userName: result.userName,
                        url: result.url
                    }, (err, images) => {
                        if (err) return;
                        $scope.current += images.length;
                        console.info("下载进度 %d / %d", $scope.current, result.total);
                        $scope.$evalAsync();
                    }, (err, result) => {
                        console.info("下载完成，共下载了 %d 张图片", $scope.current);
                        console.log(result);
                        $scope.isLoading = false;

                        var title = $scope.userName;
                        var images = [];

                        result.forEach(function (img) {

                            var image = {
                                title: img.title,
                                src: img.src,
                                url: img.link || $scope.pageUrl,
                                type: $scope.getImageType(img.src),
                                width: img.width || 200,
                                height: img.height || 200,
                                type: "image"
                            };

                            images.push(image);
                        });

                        let importFolders = $scope.importFolders;
                        if (importFolders.length === 0) {
                            let newFolder = $scope.createNewFolder($scope.userName);
                            importFolders = [newFolder];
                        }

                        $rootScope.$broadcast("IMPORT_IMAGES", {
                            title: $scope.userName,
                            url: $scope.pageUrl,
                            images: images,
                            importFolders: importFolders
                        });

                        $scope.close();
                        $scope.$evalAsync();
                    });
                });
            };

            $scope.getImageType = function (link) {
                if (link.indexOf(".png") > -1) {
                    return 'png';
                }
                else {
                    return 'jpg';
                }
            }

            $scope.urlKeydown = function(event) {
                var keyCode = event.keyCode;
                if (keyCode === 27) {
                    $scope.close();
                }
                else if (keyCode === 13) {
                    if (event.metaKey || event.ctrlKey) {
                        $(event.target).blur();
                        $scope.importUrl();
                    }
                }
            };

            $scope.import = function(params) {

                if ($scope.isLoading) return;

                if (!params.title) {
                    return;
                }

                $scope.isLoading = true;

                var images = params.images;

                if (images.length > 0) {
                    
                    var names = [];
                    var tags = [];
                    var types = []
                    var originals = [];
                    var imageUrls = [];
                    images.forEach(function(image) {
                        imageUrls.push(image.src);
                        names.push(image.title.replace(/%/g, "").replace(/[:|"<>,.^&*?//-]+/g, '').substr(0, 36) || guid());
                        originals.push(image.link || $scope.pageUrl);
                        $appScope.uploadQueue.push({});
                    });

                    let selectedFolderIds = [];
                    if ($scope.importFolders.length === 0) {
                        let newFolder = $scope.createNewFolder($scope.userName);
                        selectedFolderIds = [newFolder.id];
                    }
                    else {
                        selectedFolderIds = $scope.importFolders.map(function (fd) {
                            return fd.id;
                        });
                    }

                    if (selectedFolderIds[0]) {
                        $appScope.openFolder($appScope.folderMappings[selectedFolderIds[0]]);
                    }
                    
                    $appScope.addToRecentFolders(selectedFolderIds);
                    $appScope.uploadUrls(imageUrls, selectedFolderIds, {
                        names: names,
                        urls: originals,
                        tags: tags
                    });

                    electronLog.info(`[app] Import Artstation link: ${$scope.pageUrl}，total: ${imageUrls.length} links`);
                    analytics.event('Artstation', 'Import', $scope.pageUrl);
                }

                $scope.close();
                $scope.$evalAsync();
            };
        }
    }
});