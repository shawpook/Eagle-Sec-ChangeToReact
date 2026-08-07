EagleApp.controller("AutoTaggingController", function($scope, $timeout, $rootScope, $filter) {
    var ipcRenderer = require('electron').ipcRenderer;
    $scope.isOpen = false;
    $scope.folderName = "";
    $scope.folderTags = [];
    $scope.tabIndex = -1;

    $scope.$on("FOLDER_SETTINGS", function(e, folder) {
        $scope.folder = folder;
        $scope.isOpen = true;
        $scope.folderName = folder.name;
        $scope.folderTags = [];
        $scope.originalTags = folder.tags.join(",");

        if (folder.tags && folder.tags.length > 0) {
            folder.tags.forEach(function (tag) {
                $scope.folderTags.push(tag);
            });
        }
        $timeout(function () {
            $scope.tabIndex = 101;
            $("#auto-tagging-name-input").attr("tabindex", 101);
        }, 100);
    });

    $scope.nameKeydown = function(event) {
        var keyCode = event.keyCode;
        if (keyCode === 27) {
            $scope.cancel();
        }
        else if (keyCode === 13) {
            if (event.metaKey || event.ctrlKey) {
                $(event.target).blur();
                $scope.save();
            }
        }
    };

    $scope.save = function() {

        $scope.isOpen = false;
        var needUpdateFolder = $scope.folderName !== $scope.folder.name;
        $scope.folder.name = $scope.folderName;
        $scope.folder.tags = [];
        $scope.folderTags.forEach(function (tag) {
            $scope.folder.tags.push(tag);
        });

        $scope.currentFolderChildren = getChildFoldersMap($scope.folder);

        var needUpdateTags = true;

        if ($scope.originalTags === $scope.folder.tags.join(",")) {
            needUpdateTags = false;
        }
        
        // 將標籤加入到資料夾的圖片中
        if (needUpdateTags) {
            $scope.raw.forEach(function (image) {
                if ( isInFolder(image, $scope.folder, true) ) {
                    if (image.tags) {
                        var tags = image.tags.join();
                        $scope.folder.tags.forEach(function(tag) {
                            image.tags.push(tag);
                        });
                        image.tags = [...new Set(image.tags)];
                        if (tags != image.tags.join()) {
                            ipcRenderer.send('image-change', image);
                        }
                    }
                }
            });
        }

        // 有更动才需要更新
        if (needUpdateFolder || needUpdateTags) {
            $rootScope.$broadcast("SAVE_FOLDER");
            $rootScope.$broadcast("CALCULATE_IMAGE_BINDING");
            $rootScope.$broadcast("UPDATE_SELECTION");
            try {
                electronLog && electronLog.info(`[app] Change folder auto-tags: ${$scope.folder.name}(${$scope.folder.id}) tags: ${JSON.stringify($scope.folderTags)}`);
            } catch (err) {};
        }

        $("#auto-tagging-name-input").attr("tabindex", -1);
    };
    $scope.cancel = function() {
        $scope.folder = undefined;
        $scope.isOpen = false;
        $("#auto-tagging-name-input").attr("tabindex", -1);
    };

    // 判断图片是否属于当前文件夹
    function isInFolder (image, folder, ignore) {

        // 状况1: 该资料夹本身包含图片
        var isContain = image.folders.indexOf(folder.id) > -1;
            
            // 加速版本作法，更快判断图片是否存在于子文件夹
        if ($scope.currentFolderChildren) {
            for (var i = 0; i < image.folders.length; i++) {
                var folderId = image.folders[i];
                if ($scope.currentFolderChildren[folderId]) {
                    return true;
                }
            }
        }
        else {
            eagle.utils.tree.walk(folder.children, 'children', function(child, parent) {
                if (image.folders && image.folders.length > 0 && image.folders.indexOf(child.id) > -1) {
                    isContain = true;
                    return;
                }
            });
        }

        return isContain;
    }

    function getChildFoldersMap (folder) {
        var childs = {};
        eagle.utils.tree.walk(folder.children, 'children', function(child, parent) {
            childs[child.id] = true;
        });
        return childs;
    }
});





