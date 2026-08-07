EagleApp.directive("autoFocus", function($rootScope, $timeout) {
    return {
        restrict: "A",
        link: function(scope, ele, attrs) {
            var delay = attrs.autoFocusDelay || 100;
            scope.$on(attrs.autoFocus, function(e) {
                $timeout(function() {
                    $(ele).trigger("click");
                    $(ele).focus();
                    $(ele).select();
                }, delay);
            })
        }
    }
})