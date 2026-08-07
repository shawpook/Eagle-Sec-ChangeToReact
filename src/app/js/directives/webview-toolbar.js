EagleApp.directive('webviewToolbar', ($timeout) => {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/webview-toolbar.html',
        scope: {
            item: '=',
            theme: '=',
        },
        link: ($scope, element, attrs) => {

            attrs.$observe('webviewId', function (val) {
                $scope.webviewControl = {};
                $scope.$evalAsync();
                $timeout(() => {
                    init();
                }, 200);
            });

            function init () {

                const webviewId = attrs.webviewId;
                const webview = document.querySelector(`#${webviewId} webview`);

                $scope.webviewControl = {
                    getTitle: () => {
                        return webview.getTitle();
                    },
                    getURL: () => {
                        return webview.getURL();
                    },
                    favicon: webview.favicon,
                    canGoBack: () => {
                        return webview.canGoBack();
                    },
                    canGoForward: () => {
                        return webview.canGoForward();
                    },
                    isLoading: () => {
                        return webview.isLoading();
                    },
                    stop: () => {
                        webview.stop();
                    },
                    reload: () => {
                        webview.reload();
                    },
                    goBack: () => {
                        webview.goBack();
                    },
                    goForward: () => {
                        webview.goForward();
                    },
                    openExternal: () => {
                        shell.openExternal(webview.src);
                    },
                    copyURL: () => {
                        electron.clipboard.writeText(webview.src);
                    },
                };

                console.log($scope.webviewControl)

                // events
                webview.addEventListener('page-title-updated', (e) => {
                    $scope.webviewControl.title = e.title;
                    $scope.webviewControl.url = webview.getURL()
                    console.log($scope.webviewControl)
                    $scope.$evalAsync();
                });

                webview.addEventListener('page-favicon-updated', (e) => {
                    console.log(e.favicons);
                    $scope.webviewControl.favicon = e.favicons[0];
                    console.log($scope.webviewControl)
                    $scope.$evalAsync();
                });
            }
        }
    }
});