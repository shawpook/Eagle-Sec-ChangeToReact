EagleApp.directive('filterItemColor', function($rootScope, $timeout) {
    return {
    	restrict: 'E',
        templateUrl: 'js/directives/filter-item-color.html',
        replace: true,
        link: function($scope, elem, attrs) {
        	$scope.$body = angular.element("body").scope();
        	$scope.clearColorFilter = function (event) {
        		event && event.stopPropagation();
        		eagle.filter.filterRules.color.value = undefined;
                eagle.filter.filterRules.color.gray = false;
        		$scope.$body.page = 1; 
        		$scope.$body.reload();
                $scope.$body.calculateFilterCounts();
        	}

        	var color = "0087EF";
        	var colorChangeTimeout;
            $('#colorpickerHolder').ColorPicker({
                color: color.replace("#", ""),
                flat: true,
                onChange: function (hsb, hex, rgb) {
                    var color = '#' + hex.toUpperCase();
                    if (!color) return;
                    clearTimeout(colorChangeTimeout);
                    colorChangeTimeout = setTimeout(function () {
                    	if ($rootScope.currentColor) {
		                    $rootScope.currentColor.$setViewValue(color);
		                    $rootScope.currentColor.$render();
		                    $scope.$evalAsync();
		                } else {
		                    $scope.$body.hexColor = color;
		                    $scope.filterWithColor($scope.hexToRGB(color));
		                    $scope.$evalAsync();
		                }
                    }, 33);
	                $("#colors-picker-value").val(color.toUpperCase());
	                $("#colors-picker").val(color);
	                setTimeout(() => {
	                    $(elem).find(".shortcut-input").focus();
	                }, 24);
                }
            });
		}
	}
});