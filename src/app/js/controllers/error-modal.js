EagleApp.controller("ErrorModalController", function($scope, $timeout, $rootScope, $filter) {

    var ipcRenderer = require('electron').ipcRenderer;
    $scope.isOpen = false;
    rootScope = angular.element("body").scope();

    $scope.errorList = [];

    $scope.$on("OPEN_ERROR", function(e, params) {
        $scope.errorList = params.errorList;
        $scope.isOpen = true;
    });

    $scope.$on("CLEAN_ALL_ERROR", function(e, params) {
        $scope.errorList = params.errorList;
        $scope.cleanAll();
    });

    // 移除失敗任務
    $scope.remove = function (task) {
        var idx = $scope.errorList.indexOf(task);
        if (idx > -1) {
            $scope.errorList.splice(idx, 1);
        }
    };

    $scope.openPath = function (filePath) {
        if (filePath) {
            ipcRenderer.send('show-item-in-folder', path.normalize(filePath));
        }
    };

    // 全部重试
    $scope.retryAll = function () {

        var urlFiles = [];
        var localFiles = [];
        $scope.errorList.forEach(function (error) {
            if (error.type === 'DOWNLOAD_ERROR') {
                $scope.uploadQueue.push({});
                urlFiles.push({
                    id: guid(),
                    url: error.object.url,
                    folders: error.object.folders || [],
                    tags: error.object.tags || [],
                    type: error.object.type || undefined,
                    name: error.object.name,
                    website: error.object.website || "",
                    modificationTime: error.object.modificationTime
                });
            }
            else if (error.type === 'ADD_ERROR') {
                localFiles.push({
                    id: guid(),
                    path: error.object.path,
                    lastModified: Date.now(),
                    folders: error.object.folders || [],
                    tags: error.object.tags || [],
                    type: error.object.type || undefined,
                    name: error.object.name,
                    website: error.object.website || "",
                    modificationTime: error.object.modificationTime
                });
            }
            else if (error.type === 'EDIT_ERROR') {
                try {
                    if (error.modifiedData && error.modifiedData.id) {
                        var item = rootScope.itemMappings[error.modifiedData.id];
                        if (item) {
                            angular.extend(item, error.modifiedData);
                            rootScope.updateItemView(item);
                            rootScope.updateSelection();
                            rootScope.$evalAsync();
                            ayncsImagesChange([item]);
                        }
                    }
                }
                catch (err) {}
            }
        });

        if (urlFiles.length > 0) {
            ipcRenderer.send('upload-urls', urlFiles);
        }

        if (localFiles.length > 0) {
            var $bodyScope = angular.element("body").scope();
            $bodyScope.uploadFiles(localFiles);
        }

        $scope.errorList.length = 0;
        $scope.close();
    };

    $scope.copyAll = function () {
        let paths = [];
        $scope.errorList.forEach(function (error) {
            if (error.object.path) {
                paths.push(error.object.path);
            }
        });
        ipcRenderer.sendTo(backgroundWindowID, 'copy-paths-to-clipboard', paths);
        $bodyScope.notify({
            message: $filter('i18n')("previewWindow.copied"),
            duration: 1000
        });
    };

    // 清空所有任务并关闭
    $scope.cleanAll = function () {
        swal({
            html: `
                <div class="alert">
                    <div class="alert-icon warning"></div>
                    <h4 class="alert-title">${i18n.__("dialog.importErrorRemoveAll.title")}</h4>
                    <p class="alert-desc">${i18n.__("dialog.importErrorRemoveAll.desc")}</p>
                </div>
            `,
            showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
            width: 400,
            customClass: "alert-box",
            cancelButtonColor: "#777777",
            confirmButtonText: i18n.__("dialog.importErrorRemoveAll.button"),
            cancelButtonText: i18n.__("general.cancel"),
        }).then(function () {
            $scope.errorList.length = 0;
            $scope.close();
            $scope.$evalAsync();
        });
    };

    $scope.close = function () {
        $scope.isOpen = false;
    };
});
