EagleApp.directive('notificationModal', function ($timeout, $rootScope, $filter) {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/notification-modal.html',
        scope: {
            theme: '=theme'
        },
        link: function ($scope, element, attrs, controllersArr) {
            $scope.isOpen = false;
            $scope.shortcutsScope = $scope;

            $scope.getPageUrl = () => {
                switch (preferences.general.language) {
                    case 'zh_CN':
                        return `https://core.eagle.cool/app-notifications?theme=${$bodyScope.theme}&version=${encodeURIComponent($bodyScope.appVersion)}&buildVersion=${encodeURIComponent($bodyScope.buildVersion)}`;
                        break;
                    case 'zh_TW':
                        return `https://tw.eagle.cool/app-notifications?theme=${$bodyScope.theme}&version=${encodeURIComponent($bodyScope.appVersion)}&buildVersion=${encodeURIComponent($bodyScope.buildVersion)}`;
                        break;
                    case 'ja_JP':
                        return `https://jp.eagle.cool/app-notifications?theme=${$bodyScope.theme}&version=${encodeURIComponent($bodyScope.appVersion)}&buildVersion=${encodeURIComponent($bodyScope.buildVersion)}`;
                        break;
                    default:
                        return `https://en.eagle.cool/app-notifications?theme=${$bodyScope.theme}&version=${encodeURIComponent($bodyScope.appVersion)}&buildVersion=${encodeURIComponent($bodyScope.buildVersion)}`;
                }
            };

            $scope.$on("OPEN_NOTIFICATION", () => {
                $scope.isOpen = true;
            });

            $scope.close = () => {
                $scope.isOpen = false;
            };
        }
    }
});