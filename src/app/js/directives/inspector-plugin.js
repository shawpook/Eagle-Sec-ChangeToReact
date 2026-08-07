EagleApp.directive('inspectorPlugin', () => {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/inspector-plugin.html',
        replace: true,
        link: ($scope, element, attrs, controllersArr) => {}
    }
});