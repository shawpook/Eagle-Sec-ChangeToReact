EagleApp.directive('filterItemRating', function($rootScope, $timeout) {
    return {
    	restrict: 'E',
        templateUrl: 'js/directives/filter-item-rating.html',
        replace: true,
        link: function($scope, elem, attrs) {
        	$scope.$body = angular.element("body").scope();
        	$scope.displayName = i18n.__("filter.rating");
        	$scope.isEnabled = false;
        	$scope.changeDisplayName = function () {
        		var displayName = i18n.__("filter.rating");
        		if (eagle.filter.filterRules.rating['5'] || eagle.filter.filterRules.rating['4'] || eagle.filter.filterRules.rating['3'] || eagle.filter.filterRules.rating['2'] || eagle.filter.filterRules.rating['1'] || eagle.filter.filterRules.rating['0']) {
        			displayName = "";
        			var arr = [];
        			if (eagle.filter.filterRules.rating['5']) { arr.push(5); }
        			if (eagle.filter.filterRules.rating['4']) { arr.push(4); }
        			if (eagle.filter.filterRules.rating['3']) { arr.push(3); }
        			if (eagle.filter.filterRules.rating['2']) { arr.push(2); }
        			if (eagle.filter.filterRules.rating['1']) { arr.push(1); }
        			if (eagle.filter.filterRules.rating['0']) { arr.push(i18n.__("filter.rating>none")); }
        			if (arr.length > 0) {
        				$scope.isEnabled = true;
        				displayName += arr.join(",");
        			}
        			$scope.displayName = displayName;
                    analytics.event('Filter', 'Rating');
        		}
        		else {
        			$scope.isEnabled = false;
        			$scope.displayName = displayName;
        		}
        		setTimeout(function () { $scope.$body.updateContainerHieght();}, 300);
        	}
        	$scope.clearRatingFilter = function (event) {
        		event && event.stopPropagation();
        		eagle.filter.filterRules.rating['5'] = eagle.filter.filterRules.rating['4'] = eagle.filter.filterRules.rating['3'] = eagle.filter.filterRules.rating['2'] = eagle.filter.filterRules.rating['1'] = eagle.filter.filterRules.rating['0'] = false;
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