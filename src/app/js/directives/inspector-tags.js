EagleApp.directive('inspectorTags', () => {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/inspector-tags.html',
        replace: true,
        link: ($scope, element, attrs, controllersArr) => {}
    }
});