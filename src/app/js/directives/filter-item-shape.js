EagleApp.directive('filterItemShape', function($rootScope, $timeout) {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/filter-item-shape.html',
        replace: true,
        link: function($scope, elem, attrs) {
        	$scope.$body = angular.element("body").scope();
        	$scope.displayName = i18n.__("filter.orientation");
        	$scope.isEnabled = false;
        	$scope.changeDisplayName = function () {
        		var displayName = i18n.__("filter.orientation");
        		if (eagle.filter.filterRules.shape.landscape || eagle.filter.filterRules.shape.portrait || eagle.filter.filterRules.shape.square || eagle.filter.filterRules.shape.panoramicLandscape || eagle.filter.filterRules.shape.panoramicPortrait || eagle.filter.filterRules.shape.custom || eagle.filter.filterRules.shape['43'] || eagle.filter.filterRules.shape['34'] || eagle.filter.filterRules.shape['169'] || eagle.filter.filterRules.shape['916']) {
        			displayName = "";
        			var arr = [];
        			if (eagle.filter.filterRules.shape.landscape) { arr.push(i18n.__("filter.orientation>landscape")); }
        			if (eagle.filter.filterRules.shape.portrait) { arr.push(i18n.__("filter.orientation>portrait")); }
        			if (eagle.filter.filterRules.shape.square) { arr.push(i18n.__("filter.orientation>square")); }
        			if (eagle.filter.filterRules.shape.panoramicLandscape) { arr.push(i18n.__("filter.orientation>panoramicLandscape")); }
        			if (eagle.filter.filterRules.shape.panoramicPortrait) { arr.push(i18n.__("filter.orientation>panoramicPortrait")); }
                    if (eagle.filter.filterRules.shape['43']) { arr.push("4:3"); }
                    if (eagle.filter.filterRules.shape['34']) { arr.push("3:4"); }
                    if (eagle.filter.filterRules.shape['169']) { arr.push("16:9"); }
                    if (eagle.filter.filterRules.shape['916']) { arr.push("9:16"); }
                    if (eagle.filter.filterRules.shape.custom && eagle.filter.filterRules.shape.width && eagle.filter.filterRules.shape.height) { 
                        arr.push(`${eagle.filter.filterRules.shape.width}:${eagle.filter.filterRules.shape.height}`); 
                    }
        			if (arr.length > 0) {
        				$scope.isEnabled = true;
        				displayName += arr.join(",");
        			}
        			$scope.displayName = displayName;
                    analytics.event('Filter', 'Shape');
        		}
        		else {
        			$scope.isEnabled = false;
        			$scope.displayName = displayName;
        		}
        		setTimeout(function () { $scope.$body.updateContainerHieght();}, 300);
        	}
            $scope.focusCustomFilterWidth = function () {
                setTimeout(function () {
                    if (eagle.filter.filterRules.shape.custom) {
                        $("#custom-shape-filter-w").focus();
                    }
                    else {
                        $scope.focusInput();
                    }
                }, 200);
            }
        	$scope.clearShapeFilter = function (event) {
        		event && event.stopPropagation();
        		eagle.filter.filterRules.shape.landscape = eagle.filter.filterRules.shape.portrait = eagle.filter.filterRules.shape.square = eagle.filter.filterRules.shape.panoramicLandscape = eagle.filter.filterRules.shape.panoramicPortrait = eagle.filter.filterRules.shape.custom = eagle.filter.filterRules.shape['43'] = eagle.filter.filterRules.shape['34'] = eagle.filter.filterRules.shape['169'] = eagle.filter.filterRules.shape['916'] = false;
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