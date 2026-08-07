EagleApp.directive('notSupportPreview', (PluginCenterFactory) => {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/not-support-preview.html',
        replace: true,
        scope: {
            current: '=current',
            theme: '=theme',
        },
        link: ($scope, element, attrs, controllersArr) => {
            const plugins = PluginCenterFactory.getData().plugins;
            const pluginExtMap = plugins.reduce((acc, plugin) => {
                if (plugin?.exts) {
                    plugin?.exts.forEach(ext => {
                        acc[ext] = true;
                    });
                }
                return acc;
            }, {});
            $scope.hasPlugin = pluginExtMap[$scope.current.ext];
            $scope.openItemContextMenu = $scope.$parent.openItemContextMenu;
            $scope.openPluginCenter = () => {
                currentWindow.webContents.send('open-plugin-center-and-search', $scope.current.ext);
            };
        }
    }
});