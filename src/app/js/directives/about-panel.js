EagleApp.directive('aboutPanel', function($timeout, $rootScope, $filter) {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/about-panel.html',
        scope: {
            theme: '=theme'
        },
        link: function ($scope, element, attrs, controllersArr) {

            const pjson = require(appRoot + '/package.json');         // 0.54 ms
            $scope.pjson = pjson;
            $scope.appVersion = pjson.version;
            $scope.buildVersion = pjson.buildVersion;
            $scope.buildNumber = pjson.buildNumber;

            $scope.$on("OPEN_ABOUT_PANEL", function (event, params) {
                $("#about-panel").addClass("open");
            });
            $scope.close = function () {
                $("#about-panel").removeClass("open");
            };
        }
    }
});