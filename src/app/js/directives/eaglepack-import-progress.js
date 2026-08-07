EagleApp.directive('eaglepackImportProgress', ($timeout, $rootScope, $filter) => {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/eaglepack-import-progress.html',
        scope: {},
        link: ($scope, element, attrs, controllersArr) => {
            var ipcRenderer = require('electron').ipcRenderer;

            $scope.isExtracting = false;
            $scope.curr = 0;
            $scope.total = 0;
            var timeLeftInterval;

            $scope.cancel = function () {
                $scope.isExtracting = false;
                $scope.curr = 0;
                $scope.total = 0;
                $scope.updateStartTime = 0;
                clearInterval(timeLeftInterval);
                ipcRenderer.send('cancel.all');
            };

            ipcRenderer.on("show-extract-task", function () {
                $scope.curr = 0;
                $scope.total = 0;
                $scope.isExtracting = true;
                $scope.updateStartTime = Date.now();
                timeLeftInterval = setInterval(function () {
                    calcuteTimeLeft();
                    $scope.$evalAsync();
                }, 1000);
                $scope.$evalAsync();
            });

            ipcRenderer.on("add-extract-task", function () {
                $scope.isExtracting = true;
                $scope.total++;
                $scope.$evalAsync();
            });

            ipcRenderer.on("cancel-extract-task", function () {
                $scope.cancel();
                $scope.$evalAsync();
            });

            ipcRenderer.on("finish-extract-task", function () {
                $scope.curr++;

                if ($scope.curr >= $scope.total) {
                    $scope.isExtracting = false;
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

            function calcuteTimeLeft() {
                // 計算剩餘時間
                var elapsedTime = (new Date().getTime()) - $scope.updateStartTime;
                var chunksPerTime = $scope.curr / elapsedTime;
                var estimatedTotalTime = $scope.total / chunksPerTime;
                $scope.timeLeftInSeconds = parseInt((estimatedTotalTime - elapsedTime) / 1000);
            };

        }
    };
});