EagleApp.directive('fileThumbnailProgress', ($timeout, $rootScope, $filter) => {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/file-thumbnail-progress.html',
        // scope: {},
        link: ($scope, element, attrs, controllersArr) => {
        }
    }
});