EagleApp.directive('eaglepackExportProgress', ($timeout, $rootScope, $filter) => {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/eaglepack-export-progress.html',
        scope: {},
        link: ($scope, element, attrs, controllersArr) => {

            var ipcRenderer = require('electron').ipcRenderer;

            $scope.isArchiving = false;
            $scope.curr = 0;
            $scope.total = 0;
            $scope.percent = 0;
            $scope.progress = 0;
            var timeLeftInterval;

            $scope.cancel = function () {
                $scope.isArchiving = false;
                $scope.curr = 0;
                $scope.total = 0;
                $scope.percent = 0;
                $scope.updateStartTime = 0;
                clearInterval(timeLeftInterval);
                ipcRenderer.send('cancel.all');
            };

            function calculateProgress() {
                if ($scope.curr === 0) return;
                var a = parseInt($scope.curr / $scope.total * 50);
                var b = parseInt($scope.percent) || 0;
                $scope.progress = a + b;
                if ($scope.progress >= 100) {
                    $scope.progress = 100;
                }
                if ($scope.percent >= 100) {
                    $scope.isArchiving = false;
                    $scope.curr = 0;
                    $scope.total = 0;
                }
            };

            ipcRenderer.on("show-archive-task", function () {
                $scope.curr = 0;
                $scope.total = 0;
                $scope.percent = 0;
                $scope.isArchiving = true;
                $scope.updateStartTime = Date.now();
                timeLeftInterval = setInterval(function () {
                    calcuteTimeLeft();
                    $scope.$evalAsync();
                }, 1000);
                $scope.$evalAsync();
            });

            ipcRenderer.on("add-archive-task", function () {
                $scope.isArchiving = true;
                $scope.total++;
                calculateProgress();
                $scope.$evalAsync();
            });

            ipcRenderer.on("update-archive-percent", function (e, percent) {
                if (percent > $scope.percent) {
                    $scope.percent = percent || 0;
                    calcuteTimeLeft();
                    calculateProgress();
                    $scope.$evalAsync();
                }
            });

            ipcRenderer.on("finish-archive-task", function () {
                $scope.curr++;
                calculateProgress();
                clearInterval(timeLeftInterval);
                $scope.$evalAsync();
            });

            ipcRenderer.on("abort-archive-task", function () {
                $scope.isArchiving = false;
                $scope.curr = 0;
                $scope.total = 0;
                $scope.percent = 0;
                clearInterval(timeLeftInterval);
                $scope.$evalAsync();
            });

            function calcuteTimeLeft() {
                // 计算剩馀时间
                var elapsedTime = (new Date().getTime()) - $scope.updateStartTime;
                var chunksPerTime = $scope.percent / elapsedTime;
                var estimatedTotalTime = 100 / chunksPerTime;
                $scope.timeLeftInSeconds = parseInt((estimatedTotalTime - elapsedTime) / 1000);
            };

        }
    };
});