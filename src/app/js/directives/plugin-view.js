// 將 webview 放在全域，未來不需要重複 init webview
let pluginWebView = document.createElement('webview');
let pluginWebViewInitialized = false;

angular.module("pluginView",[]).directive('pluginView', function() {
    return {
        restrict: 'E',
        scope: {
            item: '=',
        },
        link: function(scope, element, attrs) {

            function init () {
                let webview;
                const preloadPath = URL_MODULE.pathToFileURL(path.join(appRoot.path, '/app/js/plugin/api-format-extension.js')).href;

                pluginWebView.setAttribute('preload', preloadPath);
                pluginWebView.setAttribute('allowpopups', '');
                pluginWebView.setAttribute('nodeintegration', '');
                pluginWebView.setAttribute('webpreferences', 'contextIsolation=false');
                pluginWebView.setAttribute('src', attrs.ngSrc);
                pluginWebViewInitialized = true;

                webview = pluginWebView;

                if (element.find("webview").length === 0) {
                    $(element).append(webview);
                }

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
                        e.preventDefault();
                        e.stopPropagation();
                        webview.stop();
                        webview.reload();
                    }
                });
                pluginWebView = webview;
                webview.addEventListener('dom-ready', () => {
                    const item = scope.$parent.current;
                    const plugin = pluginModule.previewExtension.getViewerPlugin(item);
                    const allowZoom = pluginModule.previewExtension.allowZoom(item.ext);

                    let style = (allowZoom)? `
                        aspect-ratio: ${item.width / item.height};
                        max-width: 100%;
                        max-height: 100%;
                        width: ${item.width}px;
                        height: ${item.height}px;
                    ` : "";
                    pluginWebView.setAttribute('style', style);

                    try {
                        const script = `
                            window.parentID = ${currentWindow?.webContents?.id};
                            window.windowID = ${webview.getWebContentsId()};
                            window.eagle.app.theme = '${preferences?.theme?.name}';
                            window.eagle.app.version = '${pjson?.version}';
                            window.eagle.app.build = ${pjson?.buildNumber};
                            window.eagle.app.locale = '${preferences?.general?.language}';
                            window.eagle.app.runningUnderARM64Translation = ${app?.runningUnderARM64Translation};
                            window.eagle.plugin = {};
                            window.eagle.plugin.path = '${plugin.path.replace(/\\/gm, "/").replace(/'/g, "\\'")}';
                            window.eagle.plugin.path = require('path').normalize(window.eagle.plugin.path);
                            window.eagle.library.path = '${$bodyScope?.libraryPath?.replace(/\\/gm, "/").replace(/'/g, "\\'")}';
                            window.eagle.library.path = require('path').normalize(window.eagle.library.path);
                            window.eagle.app.userDataPath = '${app.getPath('userData').replace(/\\/gm, "/").replace(/'/g, "\\'")}';
                            
                            try {
                                global.__dirname = eagle.plugin.path;
                                eagle.isDev = !eagle.plugin.path.includes('Eagle/Plugins') && !eagle.plugin.path.includes('Eagle\\Plugins');
                            } catch (err) {
                                console.log(err);
                            }
                        `;
                        webview.executeJavaScript(script);
                    }
                    catch (err) {
                        
                    }
                    setTimeout(() => {
                        webview.send('plugin-create', plugin);
                        webview.send('plugin-run');
                    }, 100);
                });

            }

            if (!pluginWebViewInitialized) {
                init();
            }
            else {
                if (element.find("webview").length === 0) {
                    $(element).append(pluginWebView);
                }
                pluginWebView.setAttribute('src', "");
                setTimeout(() => {
                    pluginWebView.setAttribute('src', attrs.ngSrc);
                }, 50);
            }

            attrs.$observe('ngSrc', function (val) {
                pluginWebView.setAttribute('src', attrs.ngSrc);
            });

            scope.$on('$destroy', function () {
                pluginWebView.setAttribute('src', "");
            });
        }
    };
});