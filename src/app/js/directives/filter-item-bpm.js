EagleApp.directive('filterItemBpm', function($rootScope, $timeout) {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/filter-item-bpm.html',
        replace: true,
        link: function($scope, elem, attrs) {
            $scope.$body = angular.element("body").scope();
            $scope.displayName = "BPM";
            $scope.isEnabled = false;
            $scope.changeDisplayName = function () {
                var displayName = "BPM";
                if (
                    eagle.filter.filterRules.bpm.min ||
                    eagle.filter.filterRules.bpm.max
                ) {
                    displayName = "";
                    var arr = [];
                    if (eagle.filter.filterRules.bpm.min > 0 && eagle.filter.filterRules.bpm.max > 0) { 
                        displayName += `${eagle.filter.filterRules.bpm.min}≤${"BPM"}≤${eagle.filter.filterRules.bpm.max}`
                    }
                    else if (eagle.filter.filterRules.bpm.min > 0) { 
                        displayName += `${"BPM"}≥${eagle.filter.filterRules.bpm.min}`
                    }
                    else if (eagle.filter.filterRules.bpm.max > 0) { 
                        displayName += `${"BPM"}≤${eagle.filter.filterRules.bpm.max}`
                    }

                    if (displayName !== "BPM") {
                        $scope.isEnabled = true;
                    }

                    $scope.displayName = displayName;
                    analytics.event('Filter', 'BPM');
                }
                else {
                    $scope.isEnabled = false;
                    $scope.displayName = displayName;
                }

                setTimeout(function () { $scope.$body.updateContainerHieght();}, 300);
            }
            $scope.clearBPMFilter = function (event) {
                event && event.stopPropagation();
                eagle.filter.filterRules.bpm.min = undefined;
                eagle.filter.filterRules.bpm.max = undefined;
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
