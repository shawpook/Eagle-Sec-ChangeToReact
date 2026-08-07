EagleApp.directive('libraryMergeProgress', ($timeout, $rootScope, $filter) => {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/library-merge-progress.html',
        scope: {},
        link: ($scope, element, attrs, controllersArr) => {
            var ipcRenderer = require('electron').ipcRenderer;

            $scope.isImporting = false;
            $scope.curr = 0;
            $scope.total = 0;
            var timeLeftInterval;

            $scope.cancel = () => {
                $scope.isImporting = false;
                $scope.curr = 0;
                $scope.total = 0;
                $scope.updateStartTime = 0;
                clearInterval(timeLeftInterval);
                ipcRenderer.send('cancel.all');
            };

            ipcRenderer.on("show-import-library-task", (e, total) => {
                $scope.curr = 0;
                $scope.total = total;
                $scope.isImporting = true;
                $scope.updateStartTime = Date.now();
                timeLeftInterval = setInterval(() => {
                    calcuteTimeLeft();
                    $scope.$evalAsync();
                }, 1000);
                $scope.$evalAsync();
            });

            ipcRenderer.on("finish-import-library-task", () => {
                $scope.curr++;
                if ($scope.curr >= $scope.total) {
                    $scope.isImporting = false;
                    $scope.curr = 0;
                    $scope.total = 0;
                    $scope.timeLeftInSeconds = 0;
                    clearInterval(timeLeftInterval);
                }
                else {
                    calcuteTimeLeft();
                }
                $scope.$evalAsync();
            });

            ipcRenderer.on("close-import-library", () => {

                console.log("导入完成")

                // 如果已经关闭了，就不需要开启了
                // if (!$scope.isImporting) return;

                $scope.isImporting = false;
                $scope.curr = 0;
                $scope.total = 0;
                $scope.timeLeftInSeconds = 0;
                clearInterval(timeLeftInterval);

                swal({
                    html: `
                <div class="alert">
                    <div class="alert-icon success"></div>
                    <h4 class="alert-title">${i18n.__("dialog.mergeLibraryDone.title")}</h4>
                    <p class="alert-desc">${i18n.__("dialog.mergeLibraryDone.descript")}</p>
                </div>
            `,
                    showCloseButton: false, showCancelButton: false, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
                    width: 400,
                    customClass: "alert-box",
                    cancelButtonColor: "#777777",
                    confirmButtonText: i18n.__("dialog.mergeLibraryDone.button")
                }).then(() => {
                    ipcRenderer.send("reload-app");
                });

                $scope.$evalAsync();
            });

            function calcuteTimeLeft() {
                var elapsedTime = (new Date().getTime()) - $scope.updateStartTime;
                var chunksPerTime = $scope.curr / elapsedTime;
                var estimatedTotalTime = $scope.total / chunksPerTime;
                $scope.timeLeftInSeconds = parseInt((estimatedTotalTime - elapsedTime) / 1000);
            };
        }
    };
});