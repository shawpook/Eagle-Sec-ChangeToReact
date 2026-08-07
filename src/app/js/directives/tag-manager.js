EagleApp.directive('tagManager', function($timeout, $rootScope, $filter) {
    return {
        replace: true,
        restrict: 'E',
        templateUrl: 'js/directives/tag-manager.html',
        link: function ($scope, element, attrs, controllersArr) {
            let resizeTimeout;
            $(window).on("resize.tagManager", () => {
                if ($scope.viewMode !== "alltags") return;
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    $scope.TagManager.renderTagsResult();
                    $scope.$evalAsync();
                }, 50);
            });
        }
    }
});