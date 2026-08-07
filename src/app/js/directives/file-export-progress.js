EagleApp.directive('fileExportProgress', ($timeout, $rootScope, $filter) => {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/file-export-progress.html',
        scope: {},
        link: ($scope, element, attrs, controllersArr) => {
            var ipcRenderer = require('electron').ipcRenderer;

            $scope.isExporting = false;
            $scope.curr = 0;
            $scope.total = 0;
            var timeLeftInterval;

            $scope.cancel = function () {
                close();
                ipcRenderer.send('cancel.all');
            };

            ipcRenderer.on("show-export-task", (event, total) => {
                if (total > 0) {
                    // $scope.curr = 0;
                    $scope.total += total;
                    $scope.isExporting = true;
                    $scope.updateStartTime = Date.now();
                    timeLeftInterval = setInterval(() => {
                        calcuteTimeLeft();
                        $scope.$evalAsync();
                    }, 1000);
                    $scope.$evalAsync();
                }
            });

            ipcRenderer.on("finish-export-task", (event, finishDir) => {
                $scope.curr++;
                if ($scope.curr >= $scope.total) {
                    if ($scope.isExporting && finishDir) {
                        ipcRenderer.send('show-item-in-folder', finishDir);
                    }
                    close();
                }
                else {
                    calcuteTimeLeft();
                }
                $scope.$evalAsync();
            });

            ipcRenderer.on("close-export-task", (event, total) => {
                // $scope.curr = 0;
                // $scope.total = 0;
                // $scope.isExporting = false;
                $scope.$evalAsync();
                clearInterval(timeLeftInterval);
            });

            function calcuteTimeLeft() {
                // 計算剩餘時間
                var elapsedTime = (new Date().getTime()) - $scope.updateStartTime;
                var chunksPerTime = $scope.curr / elapsedTime;
                var estimatedTotalTime = $scope.total / chunksPerTime;
                $scope.timeLeftInSeconds = parseInt((estimatedTotalTime - elapsedTime) / 1000);
            };

            function close() {
                $scope.curr = 0;
                $scope.total = 0;
                $scope.isExporting = false;
                $scope.timeLeftInSeconds = 0;
                clearInterval(timeLeftInterval);
            }
        }
    }
});