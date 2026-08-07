EagleApp.directive('filterItemUrl', function($rootScope, $timeout) {
    return {
    	restrict: 'E',
        templateUrl: 'js/directives/filter-item-url.html',
        replace: true,
        link: function($scope, elem, attrs) {
        	$scope.$body = angular.element("body").scope();
        	$scope.displayName = i18n.__("filter.url");
        	$scope.isEnabled = false;
        	$scope.changeDisplayName = function () {
        		var displayName = i18n.__("filter.url");
        		if (eagle.filter.filterRules.url.has || eagle.filter.filterRules.url.no) {
        			displayName = "";
        			var arr = [];
        			if (eagle.filter.filterRules.url.has) { arr.push(i18n.__("Filter.Yes")); }
        			if (eagle.filter.filterRules.url.no) { arr.push(i18n.__("Filter.No")); }

        			if (eagle.filter.filterRules.url.keywords) {
        				$scope.isEnabled = true;
        				displayName += eagle.filter.filterRules.url.keywords;
        			}
        			else if (arr.length > 0) {
        				$scope.isEnabled = true;
        				displayName += arr.join(",");
        			}
        			$scope.displayName = displayName;
                    analytics.event('Filter', 'URL');
        		}
        		else {
        			$scope.isEnabled = false;
        			$scope.displayName = displayName;
        		}
        		setTimeout(function () { $scope.$body.updateContainerHieght();}, 300);
        	}
        	$scope.clearUrlFilter = function (event) {
        		event && event.stopPropagation();
        		eagle.filter.filterRules.url.has = eagle.filter.filterRules.url.no = false;
        		eagle.filter.filterRules.url.keywords = undefined;
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