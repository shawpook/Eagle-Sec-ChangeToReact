angular.module("inspectorPluginView",[]).directive('inspectorPluginView', function() {
    return {
        restrict: 'E',
        scope: {
            items: '=',
            plugin: '=',
            hidePluginMap: '=',
        },
        link: function(scope, element, attrs) {

            const plugin = scope.plugin;
            let heightInterval;
            let lastPluginHeight = 0;

            function init () {
                const items = scope.items;
                const item = items[0];

                if (!item || !plugin) return;

                const webviewId = `inspector-plugin-${plugin?.manifest?.id}`;
                const $webview = $(`#${webviewId}`);
                const src = pluginModule.previewExtension.getInspectorPluginURL(plugin, item);
                const hasInspectorPlugin = pluginModule.previewExtension.hasInspectorPlugin(item);

                if (!hasInspectorPlugin) return;

                // 如果 webview 已经存在，则直接更新 src，不再重新创建
                if ($webview.length) {
                    $webview.attr('src', src);
                    return;
                }

                const height = Object.keys(plugin?.manifest?.preview).reduce((acc, key) => {
                    if (key.includes(item.ext)) {
                        return plugin?.manifest?.preview[key]?.inspector?.height || 32;
                    }
                    return acc;
                }, 100) || 32;
                const preloadPath = URL_MODULE.pathToFileURL(path.join(appRoot.path, '/app/js/plugin/api-format-extension.js')).href;
                
                let html;
                let tagName = "webview";
                html = `<${tagName} id="${webviewId}" style="height: ${height}px;" src="${src}" preload="${preloadPath}" allowpopups nodeintegration webpreferences="contextIsolation=false"></${tagName}>`;    

				let $elem = $(element).html(html);
                var webview = $elem.find("webview")[0];
                
                webview.addEventListener('did-fail-load', (e) => {
                    console.log(e);
                })

                // webview.addEventListener('console-message', (e) => {
                    // console.log(e.message)
                // })

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

                webview.addEventListener('dom-ready', () => {
                    try {
                        const script = `
                            window.parentID = ${currentWindow?.webContents?.id};
                            window.windowID = ${webview.getWebContentsId()};
                            window.eagle.app.theme = '${preferences?.theme?.name}';
                            window.eagle.app.version = '${pjson?.version}';
                            window.eagle.app.build = ${pjson?.buildNumber};
                            window.eagle.app.locale = '${preferences?.general?.language}';
                            window.eagle.app.runningUnderARM64Translation = ${app?.runningUnderARM64Translation};
                            window.eagle.library.path = '${$bodyScope.libraryPath.replace(/\\/gm, "/").replace(/'/g, "\\'")}';
                            window.eagle.library.path = require('path').normalize(window.eagle.library.path);
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
                        try {
                            // TODO: 要取得真正的 plugin 对象
                            webview.send('plugin-create', plugin);
                            webview.send('plugin-run');
                        } catch (err) {
                        }
                    }, 100);

                    // get webview body height 
                    clearInterval(heightInterval);
                    heightInterval = setInterval(() => {
                        try {
                            // NOTE: 如果插件被 collapse，则不再更新高度
                            if (scope.hidePluginMap[plugin.id]) {
                                $(webview).height(height);
                                return;
                            }
                            webview.executeJavaScript(`
                                document.body.scrollHeight;
                            `).then((height) => {
                                if (lastPluginHeight === height) return;
                                lastPluginHeight = height;
                                $(webview).height(height);
                            });
                        }
                        catch (err) {
                            // console.log(err);
                        }
                    }, 100);
                });
            }

            init();

            let lastItem;
            scope.$watch('items', throttle((newValue, oldValue) => {
                if (lastItem !== newValue?.[0]) {
                    init();
                }
                lastItem = newValue?.[0];
            }, 300, true));

            scope.$on('$destroy', () => {
                clearInterval(heightInterval);
            });
        }
    };
});