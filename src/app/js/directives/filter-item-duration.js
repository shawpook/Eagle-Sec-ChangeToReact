EagleApp.directive('filterItemDuration', function($rootScope, $timeout) {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/filter-item-duration.html',
        replace: true,
        link: function($scope, elem, attrs) {
            $scope.$body = angular.element("body").scope();
            $scope.displayName = i18n.__("filter.duration");
            $scope.isEnabled = false;
            $scope.changeDisplayName = function () {
                var displayName = i18n.__("filter.duration");
                if (
                    eagle.filter.filterRules.duration.min ||
                    eagle.filter.filterRules.duration.max
                ) {
                    displayName = "";
                    var arr = [];
                    if (eagle.filter.filterRules.duration.min > 0 && eagle.filter.filterRules.duration.max > 0) { 
                        displayName += `${eagle.filter.filterRules.duration.min}≤${i18n.__("filter.duration")}≤${eagle.filter.filterRules.duration.max}`
                    }
                    else if (eagle.filter.filterRules.duration.min > 0) { 
                        displayName += `${i18n.__("filter.duration")}≥${eagle.filter.filterRules.duration.min}`
                    }
                    else if (eagle.filter.filterRules.duration.max > 0) { 
                        displayName += `${i18n.__("filter.duration")}≤${eagle.filter.filterRules.duration.max}`
                    }

                    if (eagle.filter.filterRules.duration.min > 0 || eagle.filter.filterRules.duration.max > 0) {
                        displayName += eagle.filter.filterRules.duration.unit;
                    }

                    if (displayName !== i18n.__("filter.duration")) {
                        $scope.isEnabled = true;
                    }

                    $scope.displayName = displayName;
                    analytics.event('Filter', 'Duration');
                }
                else {
                    $scope.isEnabled = false;
                    $scope.displayName = displayName;
                }

                setTimeout(function () { $scope.$body.updateContainerHieght();}, 300);
            }
            $scope.clearDurationFilter = function (event) {
                event && event.stopPropagation();
                eagle.filter.filterRules.duration.min = undefined;
                eagle.filter.filterRules.duration.max = undefined;
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