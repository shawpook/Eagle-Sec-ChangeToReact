EagleApp.directive('emptyTrashProgress', ($timeout, $rootScope, $filter) => {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/empty-trash-progress.html', 
        link: ($scope, element, attrs, controllersArr) => {

        }
    };
});