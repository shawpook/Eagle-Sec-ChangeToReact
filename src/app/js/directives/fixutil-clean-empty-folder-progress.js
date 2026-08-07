EagleApp.directive('fixutilCleanEmptyFolderProgress', ($timeout, $rootScope, $filter) => {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/fixutil-clean-empty-folder-progress.html',
        // scope: {},
        link: ($scope, element, attrs, controllersArr) => {
        }
    }
});
