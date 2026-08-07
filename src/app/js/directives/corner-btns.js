EagleApp.directive('cornerBtns', ($timeout, $rootScope, $filter) => {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/corner-btns.html', 
        scope: {
            theme: "=theme",
            isAlwaysOnTop: "=isAlwaysOnTop"
        },
        link: ($scope, element, attrs, controllersArr) => {

            if (attrs.hideAlwaysOnTop) {
                $scope.hideAlwaysOnTop = true;
            }

            $scope.minimize = () => {
                currentWindow.minimize();
            };
            
            $scope.maximize = () => {
                if (currentWindow.isFullScreen()) {
                    currentWindow.setFullScreen(false);
                } else if (!currentWindow.isMaximized()) {
                    currentWindow.maximize();
                    $bodyScope.isMaximize = true;
                } else {
                    currentWindow.unmaximize();
                    $bodyScope.isMaximize = false;
                }
            };
            
            $scope.restore = () => {
                if (currentWindow.isFullScreen()) {
                    currentWindow.setFullScreen(false);
                } else if (!currentWindow.isMaximized()) {
                    currentWindow.maximize();
                    $bodyScope.isMaximize = true;
                } else {
                    currentWindow.unmaximize();
                    $bodyScope.isMaximize = false;
                }
            };
            
            $scope.close = () => {
                currentWindow.close();
            };

            $scope.toggleAlwaysOnTop = () => {
                $bodyScope.toggleAlwaysOnTop();
            };
        }
    };
});