EagleApp.directive('webView', function() {
    return {
        restrict: 'E',
        link: function(scope, element, attrs) {

            function init () {
                let src = attrs.src;
                let current = scope.current;
                let isVideo = current.medium !== undefined;
                let html;
                let tagName = "webview";
                let className = "";
                let userAgent = EagleConfig.USER_AGENT;
                let referrer = "";
                
                if (isVideo) {
                    className = "is-video";
                }

                if (src.indexOf("youtube-nocookie.com") > -1) {
                    referrer = "http://localhost/";
                }

                html = `<${tagName} id="url-viewer" class="${className}" allowpopups useragent="${userAgent}" httpreferrer="${referrer}"></${tagName}>`;    

                let $elem = $(element).html(html);
                if (tagName === "iframe") return;

                const webview = $elem.find("webview")[0];
                
                currentWindow.on('leave-full-screen', function () {
                    webview.executeJavaScript(`document.exitFullscreen();`);
                });

                webview.addEventListener('enter-html-full-screen', (e) => {
                    if (process.platform === 'darwin') {
                        webview.executeJavaScript(`document.exitFullscreen();`);
                    }
                    $bodyScope.toggleSlideshow();
                    $bodyScope.$evalAsync();
                })
                webview.addEventListener('did-fail-load', (e) => {
                    console.log(e);
                })
                webview.addEventListener('console-message', (e) => {
                    console.log(e.message)
                })
                webview.addEventListener('crash', (e) => {
                    console.log(e);  
                })
                webview.addEventListener('will-navigate', (e) => {
                    console.log(e.url);
                    if (e.url && e.url !== webview.src) {
                    }
                    else {
                        // e.preventDefault();
                        // e.stopPropagation();
                        // webview.stop();
                        // // webview.getWebContents().stop();
                        // webview.reload();
                    }
                });

                webview.addEventListener('page-favicon-updated', (e) => {
                    console.log(e.favicons);
                    webview.favicon = e.favicons[0];
                });

                webview.src = src;
            }

            init();

            attrs.$observe('src', function (val) {
                init();
            });
        }
    };
});