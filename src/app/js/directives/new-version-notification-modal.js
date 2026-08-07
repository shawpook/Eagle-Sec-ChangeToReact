EagleApp.directive('newVersionNotificationModal', ($timeout, $rootScope, $filter, PluginCenterFactory) => {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/new-version-notification-modal.html',
        scope: {
            theme: '=theme'
        },
        link: ($scope, element, attrs, controllersArr) => {

            const preferences = electronSettings.getPreferences();
            const ipcRenderer = require('electron').ipcRenderer;
            const pjson = require(appRoot + '/package.json');

            $scope.autoUpdateScope = $scope;
            $scope.isOpen = false;
            $scope.result;
            rootScope = angular.element("body").scope();

            // 收到更新通知
            ipcRenderer.on("show-update-message", (event, result) => {

                console.log(result);

                $scope.detail = result.content;
                $scope.size = 0;
                $scope.version = result.version;
                $scope.currentVersion = pjson.prerelease || pjson.version;
                $scope.result = result;

                var language = preferences.general.language;

                switch (language) {
                    case 'zh_TW':
                        $scope.detail = result.contentZH || result.content;
                        break;
                    case 'zh_CN':
                        $scope.detail = result.contentCN || result.content;
                        break;
                    case 'ja_JP':
                        $scope.detail = result.contentJP || result.content;
                        break;
                    default:
                        $scope.detail = result.content;
                }

                if (process.platform == 'darwin') { $scope.size = result.file.size; }
                else { $scope.size = result.windows.size; }

                $scope.isOpen = true;
                $scope.$evalAsync();
            });

            $scope.download = () => {
                if (process.platform == 'darwin') {
                    require('electron').shell.openExternal("https:" + $scope.result.dmg.url);
                }
                else {
                    require('electron').shell.openExternal("https:" + $scope.result.windows.url);
                }
            };

            $scope.cancel = () => {
                if (localStorage) {
                    localStorage["lastCheckForUpdateTime"] = Date.now();
                }
                $scope.close();
            };

            $scope.close = () => {
                $scope.isOpen = false;
            };
        }
    }
});