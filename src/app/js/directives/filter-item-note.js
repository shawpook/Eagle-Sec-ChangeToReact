EagleApp.directive('filterItemNote', function($rootScope, $timeout) {
    return {
    	restrict: 'E',
        templateUrl: 'js/directives/filter-item-note.html',
        replace: true,
        link: function($scope, elem, attrs) {
        	$scope.$body = angular.element("body").scope();
        	$scope.displayName = i18n.__("filter.annotation");
        	$scope.isEnabled = false;
        	$scope.changeDisplayName = function () {
        		var displayName = i18n.__("filter.annotation");
        		if (eagle.filter.filterRules.note.has || eagle.filter.filterRules.note.no) {
        			displayName = "";
        			var arr = [];
        			if (eagle.filter.filterRules.note.has) { arr.push(i18n.__("Filter.Yes")); }
        			if (eagle.filter.filterRules.note.no) { arr.push(i18n.__("Filter.No")); }

        			if (eagle.filter.filterRules.note.keywords) {
        				$scope.isEnabled = true;
        				displayName += eagle.filter.filterRules.note.keywords;
        			}
        			else if (arr.length > 0) {
        				$scope.isEnabled = true;
        				displayName += arr.join(",");
        			}
        			$scope.displayName = displayName;
                    analytics.event('Filter', 'Note');
        		}
        		else {
        			$scope.isEnabled = false;
        			$scope.displayName = displayName;
        		}
        		setTimeout(function () { $scope.$body.updateContainerHieght();}, 300);
        	}
        	$scope.clearNoteFilter = function (event) {
        		event && event.stopPropagation();
        		eagle.filter.filterRules.note.has = eagle.filter.filterRules.note.no = false;
        		eagle.filter.filterRules.note.keywords = undefined;
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