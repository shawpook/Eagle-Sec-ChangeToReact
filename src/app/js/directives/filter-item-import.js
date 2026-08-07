EagleApp.directive('filterItemImport', function($rootScope, $timeout) {
    return {
    	restrict: 'E',
        templateUrl: 'js/directives/filter-item-import.html',
        replace: true,
        link: function($scope, elem, attrs) {
        	$scope.$body = angular.element("body").scope();
        	$scope.displayName = i18n.__("modal.smartFolder.rule.propertyCreateTime");
        	$scope.isEnabled = false;

            elem.on("open", function () {
                // 計算日期篩選器很耗時，延後到打開在計算
                console.time("calculateDateFilter");
                $scope.$body.calculateDateFilter();
                $scope.$body.filterImportDateMonths = $scope.$body.getDateFilterCountsArray("date");
                $scope.$body.filterModifyDateMonths = $scope.$body.getDateFilterCountsArray("mtime");
                console.timeEnd("calculateDateFilter");
                $scope.$body.$evalAsync();
            });

        	$scope.changeDisplayName = function () {
        		var displayName = i18n.__("modal.smartFolder.rule.propertyCreateTime");
        		if (
        			eagle.filter.filterRules.import.today ||
		            eagle.filter.filterRules.import.yesterday ||
		            eagle.filter.filterRules.import.last7day ||
		            eagle.filter.filterRules.import.last30day ||
		            eagle.filter.filterRules.import.last90day ||
		            eagle.filter.filterRules.import.last365day ||
		            eagle.filter.filterRules.import.usingRange ||
                    Object.keys(eagle.filter.filterRules.import.selectedMonths).length > 0
    			) {
        			displayName = "";
        			var arr = [];
        			if (eagle.filter.filterRules.import.today) { arr.push(i18n.__("filter.import>today")); };
					if (eagle.filter.filterRules.import.yesterday) { arr.push(i18n.__("filter.import>yesterday")); };
					if (eagle.filter.filterRules.import.last7day) { arr.push(i18n.__("filter.import>last7Days")); };
					if (eagle.filter.filterRules.import.last30day) { arr.push(i18n.__("filter.import>last30Days")); };
					if (eagle.filter.filterRules.import.last90day) { arr.push(i18n.__("filter.import>last90Days")); };
					if (eagle.filter.filterRules.import.last365day) { arr.push(i18n.__("filter.import>last365Days")); };
					if (eagle.filter.filterRules.import.usingRange) { arr.push(i18n.__("filter.import>range")); };
                    var keys = Object.keys(eagle.filter.filterRules.import.selectedMonths);

                    arr = [...arr, ...keys];
        			
        			if (arr.length > 0) {
        				$scope.isEnabled = true;
        				displayName += arr.join(",");
        			}
        			$scope.displayName = displayName;
                    analytics.event('Filter', 'Date');
        		}
                else {
        			$scope.isEnabled = false;
        			$scope.displayName = displayName;
        		}
        		setTimeout(function () { $scope.$body.updateContainerHieght();}, 300);
        	}

            $scope.filterImportYYYYMM = function (key) {
                if (!eagle.filter.filterRules.import.selectedMonths[key]) {
                    eagle.filter.filterRules.import.selectedMonths[key] = true;
                }
                else {
                    delete eagle.filter.filterRules.import.selectedMonths[key];
                }
            }

        	$scope.focusDatePicker = function () {
        		setTimeout(function () {
        			$("#filter-date-picker").focus();
        		}, 100);
        	};

        	$scope.clearDateFilter = function (event) {
        		event && event.stopPropagation();
                eagle.filter.filterRules.import.selectedMonths = {};
        		eagle.filter.filterRules.import.today = false;
	            eagle.filter.filterRules.import.yesterday = false;
	            eagle.filter.filterRules.import.last7day = false;
	            eagle.filter.filterRules.import.last30day = false;
	            eagle.filter.filterRules.import.last90day = false;
	            eagle.filter.filterRules.import.last365day = false;
	            eagle.filter.filterRules.import.usingRange = false;
        		$scope.$body.page = 1; 
        		$scope.$body.filterContent();
        		$scope.$body.reload();
				$scope.changeDisplayName();
                $scope.$body.filterImportDateMonths = [];
                $scope.$body.filterModifyDateMonths = [];
        	}
        	$scope.$on("Reset_Filter", function (event) {
        		$scope.changeDisplayName();
        	});
		}
	}
});