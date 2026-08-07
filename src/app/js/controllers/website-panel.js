EagleApp.controller("WebsitePanelController", function($scope, $rootScope) {

    $scope.currentUrl = "";

    $scope.$watch('theme', function(newValue, oldValue) {
        if ($bodyScope.theme) {
            let webview = $("#website-panel webview")[0];
            if (webview) {
                try {
                    webview.executeJavaScript(`
                        localStorage["theme"] = "${$bodyScope.theme}";
                        document.querySelector("html").setAttribute("theme", "${$bodyScope.theme}");
                    `, true);
                }
                catch (e) {}
            }
        }
    });

    $scope.$on("OPEN_URL_IN_PANEL", function (e, url) {
        $scope.currentUrl = url;
        let webview = $("#website-panel webview")[0];
        if (webview.src.indexOf("community-") === -1) {
            $("#website-panel webview").attr("src", `${$scope.currentUrl}`);   
        }
        $bodyScope.isOpenWebpagePanel = true;
    });

    $scope.goBack = function () {
        let webview = $("#website-panel webview")[0];
        if (webview.canGoBack()) {
            webview.goBack();
        }
    };

    $scope.goForward = function () {
        let webview = $("#website-panel webview")[0];
        if (webview.canGoForward()) {
            webview.goForward();
        }
    };

    $scope.openInBrowser = function () {
        shell.openExternal($("#website-panel webview")[0].src);
    };

    $scope.refresh = function () {
        let webview = $("#website-panel webview")[0];
        webview.reload();
    };
});


EagleApp.directive('websitePanelWebview', function() {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {

            var webview = element[0];
            
            webview.addEventListener('dom-ready', (e) => {
                try {
                    webview.executeJavaScript(`
                        localStorage["theme"] = "${$bodyScope.theme}";
                        document.querySelector("html").setAttribute("theme", "${$bodyScope.theme}");
                    `, true);
                } catch (e) {}
                webview.focus();
                window.blur();
                window.focus();
                if (webview.src.indexOf("file:///") > -1) {
                    webview.clearHistory();
                    webview.loadURL(`${$bodyScope.currentUrl}`);
                }
            });

            webview.addEventListener('page-title-updated', (e) => {
                let title = webview.getURL();
                $("#website-panel-webview-title").html(title);
                
                if (webview.canGoForward()) {
                    $("#website-panel-webview-go-forward").removeClass("disabled");
                }
                else {
                    $("#website-panel-webview-go-forward").addClass("disabled");
                }
                if (webview.canGoBack()) {
                    $("#website-panel-webview-go-back").removeClass("disabled");
                }
                else {
                    $("#website-panel-webview-go-back").addClass("disabled");
                }
            });
        }
    };
});