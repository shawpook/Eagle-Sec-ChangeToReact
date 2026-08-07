EagleApp.directive('filterItemFonts', function($rootScope, $timeout) {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/filter-item-fonts.html',
        replace: true,
        link: function($scope, elem, attrs) {
            $scope.$body = angular.element("body").scope();
            $scope.displayName = i18n.__("filter.fontActivated");
            $scope.isEnabled = false;
            $scope.changeDisplayName = function () {
                var displayName = i18n.__("filter.fontActivated");
                if (eagle.filter.filterRules.font.activated || eagle.filter.filterRules.font.deactivated) {
                    $scope.isEnabled = true;
                    if (eagle.filter.filterRules.font.activated) {
                        $scope.displayName = i18n.__("filter.fontActivated>activated");
                    }
                    else if (eagle.filter.filterRules.font.deactivated) {
                        $scope.displayName = i18n.__("filter.fontActivated>deactivated");
                    }
                    analytics.event('Filter', 'Font');
                }
                else {
                    $scope.displayName = i18n.__("filter.fontActivated");
                    $scope.isEnabled = false;
                }
                setTimeout(function () { $scope.$body.updateContainerHieght();}, 300);
            }
            $scope.clearFontActivatedFilter = function (event) {
                event && event.stopPropagation();
                eagle.filter.filterRules.font.activated = false;
                eagle.filter.filterRules.font.deactivated = false;
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