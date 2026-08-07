EagleApp.directive('filterItemCamera', function($rootScope, $timeout) {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/filter-item-camera.html',
        replace: true,
        link: function($scope, elem, attrs) {
            $scope.$body = angular.element("body").scope();
            $scope.displayName = i18n.__("filter.camera");
            $scope.isEnabled = false;
            $scope.selectCamera = function (camera) {
                if (eagle.filter.filterRules.camera[camera]) {
                    delete eagle.filter.filterRules.camera[camera];
                }
                else {
                    eagle.filter.filterRules.camera[camera] = true;
                }
            };
            $scope.changeDisplayName = function () {
                var displayName = i18n.__("filter.camera");
                // if (eagle.filter.filterRules.rating['5'] || eagle.filter.filterRules.rating['4'] || eagle.filter.filterRules.rating['3'] || eagle.filter.filterRules.rating['2'] || eagle.filter.filterRules.rating['1'] || eagle.filter.filterRules.rating['0']) {
                if (Object.keys(eagle.filter.filterRules.camera).length > 0) {
                    displayName = "";

                    var selectedCameras = Object.keys(eagle.filter.filterRules.camera);
                    var arr = [];

                    selectedCameras.forEach(function (camera) {
                        arr.push(camera);
                    });
                    
                    if (arr.length > 0) {
                        $scope.isEnabled = true;
                        displayName += arr.join(",");
                        $scope.displayName = displayName;
                        analytics.event('Filter', 'Camera');
                    }
                    else {
                        $scope.isEnabled = false;
                        $scope.displayName = i18n.__("filter.camera");
                    }
                }
                else {
                    $scope.isEnabled = false;
                    $scope.displayName = displayName;
                }
                setTimeout(function () { $scope.$body.updateContainerHieght();}, 300);
            }
            $scope.clearCameraFilter = function (event) {
                event && event.stopPropagation();
                eagle.filter.filterRules.camera = {};
                $scope.$body.page = 1; 
                $scope.$body.reload();
                $scope.changeDisplayName();
            }
            $scope.$on("Reset_Filter", function (event) {
                $scope.changeDisplayName();
            });
        }
    }
});