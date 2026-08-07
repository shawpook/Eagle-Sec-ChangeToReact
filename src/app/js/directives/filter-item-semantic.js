EagleApp.directive('filterItemSemantic', function($rootScope, $timeout) {
    return {
    	restrict: 'E',
        templateUrl: 'js/directives/filter-item-semantic.html',
        replace: true,
        link: function($scope, elem, attrs) {
        	$scope.$body = angular.element("body").scope();
			$scope.displayName = i18n.__("filter.semantic");
			$scope.isEnabled = false;
			$scope.isSearching = false;

        	$scope.clearSemanticFilter = function (event) {
        		event && event.stopPropagation();
        		eagle.filter.filterRules.semantic.value = '';
				$scope.isEnabled = false;
				$scope.isSearching = false;
				$scope.changeDisplayName();
        		$scope.$body.page = 1;
        		$scope.$body.reload();
                $scope.$body.calculateFilterCounts();
        	}

			$scope.onSemanticChange = function () {
				if (!eagle.aiSearch.isInstalled) {
					eagle.aiSearch.open();
					return;
				}
				$scope.changeDisplayName();
				$scope.$body.page = 1;

				if (eagle.filter.filterRules.semantic.value) {
					$scope.isSearching = true;
					var promise = $scope.$body.rebindRefresh();
					if (promise && typeof promise.then === 'function') {
						promise.then(function () {
							$timeout(function () { $scope.isSearching = false; });
						}).catch(function () {
							$timeout(function () { $scope.isSearching = false; });
						});
					}
					else {
						$timeout(function () { $scope.isSearching = false; }, 1000);
					}
				}
				else {
					$scope.isSearching = false;
					$scope.$body.filterContent();
				}
				$scope.$body.calculateFilterCounts();
			}

			$scope.changeDisplayName = function () {
				var displayName = i18n.__("filter.semantic");
				if (eagle.filter.filterRules.semantic.value) {
					displayName = "";

					if (eagle.filter.filterRules.semantic.value) {
						displayName += eagle.filter.filterRules.semantic.value;
					}
					$scope.displayName = displayName;
					$scope.isEnabled = true;
				}
				else {
					$scope.displayName = displayName;
					$scope.isEnabled = false;
				}
				setTimeout(function () { $scope.$body.updateContainerHieght(); }, 300);
			}
		}
	}
});
