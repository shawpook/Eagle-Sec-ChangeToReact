EagleApp.directive('mousewheelSettingModal', function($timeout, $rootScope, $filter) {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/mousewheel-setting-modal.html',
        scope: {
            theme: '=theme'
        },
        link: ($scope) => {
            $scope.mode = "zoom";
            $scope.isOpen = false;

            $scope.$on("OPEN_MOUSEWHEEL_PREFERENCE_WINDOW", function () {
                $scope.isOpen = true;
                $scope.$evalAsync();
            });

            $scope.changeMode = function (mode) {
                $scope.mode = mode;		
            };

            $scope.save = function () {
                $scope.isOpen = false;
                $rootScope.preferences.habits.scrollBehaviorTour = true;
                $rootScope.preferences.habits.scrollBehavior = $scope.mode;
                ipcRenderer.send("chnage-scrollBehavior", $scope.mode);
            };
        }
    }
});