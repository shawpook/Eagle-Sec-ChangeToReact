EagleApp.directive('filterItemSize', function($rootScope, $timeout) {
    return {
    	restrict: 'E',
        templateUrl: 'js/directives/filter-item-size.html',
        replace: true,
        link: function($scope, elem, attrs) {
        	$scope.$body = angular.element("body").scope();
        	$scope.displayName = i18n.__("filter.fileSize");
        	$scope.isEnabled = false;
        	$scope.changeDisplayName = function () {
        		var displayName = i18n.__("filter.fileSize");
        		if (
        			eagle.filter.filterRules.file.min ||
		            eagle.filter.filterRules.file.max
    			) {
        			displayName = "";
        			var arr = [];
        			if (eagle.filter.filterRules.file.min > 0 && eagle.filter.filterRules.file.max > 0) { 
        				displayName += `${eagle.filter.filterRules.file.min}≤${i18n.__("filter.fileSize")}≤${eagle.filter.filterRules.file.max}`
        			}
        			else if (eagle.filter.filterRules.file.min > 0) { 
        				displayName += `${i18n.__("filter.fileSize")}≥${eagle.filter.filterRules.file.min}`
        			}
        			else if (eagle.filter.filterRules.file.max > 0) { 
        				displayName += `${i18n.__("filter.fileSize")}≤${eagle.filter.filterRules.file.max}`
        			}

        			if (eagle.filter.filterRules.file.min > 0 || eagle.filter.filterRules.file.max > 0) {
        				displayName += eagle.filter.filterRules.file.unit.toUpperCase();
        			}

        			if (displayName !== i18n.__("filter.fileSize")) {
        				$scope.isEnabled = true;
        			}

        			$scope.displayName = displayName;
                    analytics.event('Filter', 'Size');
        		}
        		else {
        			$scope.isEnabled = false;
        			$scope.displayName = displayName;
        		}

        		setTimeout(function () { $scope.$body.updateContainerHieght();}, 300);
        	}
        	$scope.clearSizeFilter = function (event) {
        		event && event.stopPropagation();
        		eagle.filter.filterRules.file.min = undefined;
            	eagle.filter.filterRules.file.max = undefined;
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