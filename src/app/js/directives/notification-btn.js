EagleApp.directive('notificationBtn', function($timeout, $rootScope) {
    return {
        restrict: 'A',
        link: function ($scope, element, attrs, controllersArr) {

            function init() {
                let lastOpenAppNotificationDate = localStorage["lastOpenAppNotificationDate"];
                if (!lastOpenAppNotificationDate) {
                    localStorage["lastOpenAppNotificationDate"] = 0;
                    lastOpenAppNotificationDate = localStorage["lastOpenAppNotificationDate"];
                }
                fetch(`https://eagle.cool/api/get-app-notifications?date=${lastOpenAppNotificationDate}&version=${encodeURIComponent(appVersion)}&buildVersion=${encodeURIComponent(buildVersion)}`, { referrer: '', mode: 'cors', method: 'GET', }).then(function(response) {
                    return response.json();
                }).then(function(result) {
                    console.log(result);
                    if (result && result.unread > 0) {
                        $scope.unreadNotification = result.unread;
                        if (result.autoShow) {
                            $scope.openNofication();
                        }
                    } else {
                        $scope.unreadNotification = 0;
                    }
                });
            }

            $scope.openNofication = function() {
                localStorage["lastOpenAppNotificationDate"] = Date.now();
                $rootScope.$broadcast("OPEN_NOTIFICATION");
                $scope.unreadNotification = 0;
                $scope.$evalAsync();
            };

            init();
        }
    }
});