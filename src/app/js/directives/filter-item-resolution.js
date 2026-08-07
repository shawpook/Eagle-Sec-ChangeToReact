EagleApp.directive('filterItemResolution', function($rootScope, $timeout) {
    return {
    	restrict: 'E',
        templateUrl: 'js/directives/filter-item-resolution.html',
        replace: true,
        link: function($scope, elem, attrs) {
        	$scope.$body = angular.element("body").scope();
        	$scope.displayName = i18n.__("filter.resolution");
        	$scope.isEnabled = false;
        	$scope.changeDisplayName = function () {
        		var displayName = i18n.__("filter.resolution");
        		if (
        			eagle.filter.filterRules.resolution.minW ||
		            eagle.filter.filterRules.resolution.maxW ||
		            eagle.filter.filterRules.resolution.minH ||
		            eagle.filter.filterRules.resolution.maxH
    			) {
        			displayName = "";
        			var arr = [];
        			if (eagle.filter.filterRules.resolution.minW > 0 && eagle.filter.filterRules.resolution.maxW > 0) { 
        				displayName += `${eagle.filter.filterRules.resolution.minW}≤${i18n.__("filter.resolution>width")}≤${eagle.filter.filterRules.resolution.maxW}`
        			}
        			else if (eagle.filter.filterRules.resolution.minW > 0) { 
        				displayName += `${i18n.__("filter.resolution>width")}≥${eagle.filter.filterRules.resolution.minW}`
        			}
        			else if (eagle.filter.filterRules.resolution.maxW > 0) { 
        				displayName += `${i18n.__("filter.resolution>width")}≤${eagle.filter.filterRules.resolution.maxW}`
        			}

        			if ((eagle.filter.filterRules.resolution.minW > 0 || eagle.filter.filterRules.resolution.maxW > 0) && (eagle.filter.filterRules.resolution.minH > 0 || eagle.filter.filterRules.resolution.maxH > 0) ) { 
        				displayName += ", ";
        			}

        			if (eagle.filter.filterRules.resolution.minH > 0 && eagle.filter.filterRules.resolution.maxH > 0) { 
        				displayName += `${eagle.filter.filterRules.resolution.minH}≤${i18n.__("filter.resolution>height")}≤${eagle.filter.filterRules.resolution.maxH}`
        			}
        			else if (eagle.filter.filterRules.resolution.minH > 0) { 
        				displayName += `${i18n.__("filter.resolution>height")}≥${eagle.filter.filterRules.resolution.minH}`
        			}
        			else if (eagle.filter.filterRules.resolution.maxH > 0) { 
        				displayName += `${i18n.__("filter.resolution>height")}≤${eagle.filter.filterRules.resolution.maxH}`
        			}

        			if (displayName !== i18n.__("filter.resolution")) {
        				$scope.isEnabled = true;
        			}

        			$scope.displayName = displayName;
                    analytics.event('Filter', 'Resolution');
        		}
        		else {
        			$scope.isEnabled = false;
        			$scope.displayName = displayName;
        		}

        		setTimeout(function () { $scope.$body.updateContainerHieght();}, 300);
        	}
        	$scope.clearResolutionFilter = function (event) {
        		event && event.stopPropagation();
        		eagle.filter.filterRules.resolution.minW = undefined;
	            eagle.filter.filterRules.resolution.maxW = undefined;
	            eagle.filter.filterRules.resolution.minH = undefined;
	            eagle.filter.filterRules.resolution.maxH = undefined;
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