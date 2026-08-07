EagleApp.directive('filterItemTypes', function($rootScope, $timeout) {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/filter-item-types.html',
        replace: true,
        link: function($scope, elem, attrs) {

        	$scope.$body = angular.element("body").scope();
        	$scope.displayName = i18n.__("filter.types");
        	$scope.isEnabled = false;
            $scope.typesKeyword = "";

            $scope.typesFilterChange = function () {
                $("#filter-panel-types-search").scrollTop(0);
                setTimeout(function () {
                    $("#types-filter-item .check-item.active").removeClass("active")
                    $("#types-filter-item .check-item").eq(0).addClass("active");
                }, 33);
            };

            $scope.onTypeItemClick = function () {
                $scope.typesKeyword = "";
            }

        	$scope.changeDisplayName = function () {
        		var displayName = i18n.__("filter.types");
                if (Object.keys(eagle.filter.filterRules.type.includes).length > 0 || Object.keys(eagle.filter.filterRules.type.excludes).length > 0) {
        			displayName = "";
        			var arr = [];

                    Object.keys(eagle.filter.filterRules.type.includes).forEach(function(key) {
                        if (eagle.filter.filterRules.type.includes[key]) { arr.push(key); }
                    });

					Object.keys(eagle.filter.filterRules.type.excludes).forEach(function(key) {
						if (eagle.filter.filterRules.type.excludes[key]) { arr.push("-" + key); }
					});
        			
        			if (arr.length > 0) {
        				$scope.isEnabled = true;
        				displayName += arr.join(",");
        			}
        			$scope.displayName = displayName;
                    analytics.event('Filter', 'Type');
        		}
        		else {
        			$scope.isEnabled = false;
        			$scope.displayName = displayName;
        		}
        		setTimeout(function () { $scope.$body.updateContainerHieght();}, 300);
        	}
        	$scope.clearTypesFilter = function (event) {
        		event && event.stopPropagation();
                eagle.filter.filterRules.type.includes = {}
				eagle.filter.filterRules.type.excludes = {}
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