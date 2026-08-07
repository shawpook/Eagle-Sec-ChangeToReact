EagleApp.directive('filterItemAnnotation', function($rootScope, $timeout) {
    return {
    	restrict: 'E',
        templateUrl: 'js/directives/filter-item-annotation.html',
        replace: true,
        link: function($scope, elem, attrs) {
        	$scope.$body = angular.element("body").scope();
        	$scope.displayName = i18n.__("filter.comments");
        	$scope.isEnabled = false;
        	$scope.changeDisplayName = function () {
        		var displayName = i18n.__("filter.comments");
        		if (eagle.filter.filterRules.annotation.has || eagle.filter.filterRules.annotation.no) {
        			displayName = "";
        			var arr = [];
        			if (eagle.filter.filterRules.annotation.has) { arr.push(i18n.__("Filter.Yes")); }
        			if (eagle.filter.filterRules.annotation.no) { arr.push(i18n.__("Filter.No")); }

        			if (eagle.filter.filterRules.annotation.keywords) {
        				$scope.isEnabled = true;
        				displayName += eagle.filter.filterRules.annotation.keywords;
        			}
        			else if (arr.length > 0) {
        				$scope.isEnabled = true;
        				displayName += arr.join(",");
        			}
        			$scope.displayName = displayName;
                    analytics.event('Filter', 'Annotation');
        		}
        		else {
        			$scope.isEnabled = false;
        			$scope.displayName = displayName;
        		}
        		setTimeout(function () { $scope.$body.updateContainerHieght();}, 300);
        	}
        	$scope.clearAnnotationFilter = function (event) {
        		event && event.stopPropagation();
        		eagle.filter.filterRules.annotation.has = eagle.filter.filterRules.annotation.no = false;
        		eagle.filter.filterRules.annotation.keywords = undefined;
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