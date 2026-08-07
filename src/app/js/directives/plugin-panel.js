EagleApp.directive('pluginPanel', function($timeout, $rootScope, $filter) {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/plugin-panel.html',
        scope: {
            theme: '=theme'
        },
        link: function ($scope, element, attrs, controllersArr) {
			$scope.pluginModule = $scope.$parent.pluginModule;
            $scope.resultList = [];
            $scope.lastOpenedPlugins = [];
            $scope.searchKeyword = "";
            $scope.currentIndex = -1;
            $scope.typeFilter = (localStorage["eagle.pluginPanel.type"])? localStorage["eagle.pluginPanel.type"] : "window";

            var $menu = $("#plugin-panel");
            var $searchInput = $("#plugin-panel-search");

            $scope.$on("UPDATE_PLUGIN_PANEL", function () {
                $scope.calculateList();
				$scope.$evalAsync();
            });

            const moveToCursorPosition = ($elem) => {
                const windowWidth = $(window).width();
                const windowHeight = $(window).height();
                const containerWidth = $elem.width();
                const containerHeight = $elem.height();
                let x = windowMouseX + 10;
                let y = windowMouseY - 10;
                let maxHeight = windowHeight; // 初始化最大高度為視窗高度
            
                if (windowMouseX + containerWidth > windowWidth) {
                    x = windowMouseX - containerWidth - 20;
                    x = x < 20 ? 20 : x;
                }
            
                if (windowMouseY + containerHeight > windowHeight - 20) {
                    y = windowHeight - containerHeight - 20;
                    y = y < 20 ? 20 : y;
                }
                else if (windowMouseY - 56 < 0) {
                    y = 36;
                }
            
                maxHeight = windowHeight - y - 160;
            
                $elem.css({
                    left: `${x}px`,
                    top: `${y}px`,
                });

                // find .plugin-container and set max-height
                $elem.find(".plugin-container").css({
                    'max-height': `${maxHeight - 40}px` // 設定最大高度
                });
            };

            $scope.$on("OPEN_PLUGIN_PANEL", function (event, params) {

                $scope.currentIndex = -1;
                $scope.searchKeyword = "";
                $scope.lastOpenedPlugins = pluginModule.getLastOpenedPlugins().map((pluginId) => {
                    return pluginModule.installedPluginMaps[pluginId];
                }).filter((plugin) => {
                    return plugin && !plugin.manifest?.main?.serviceMode && !pluginModule.isPluginDisabled(plugin?.manifest?.id);
                });

                $scope.lastOpenedPlugins.length = 3;
                
                $scope.calculateList();

                $timeout(function () {
                    moveToCursorPosition($('#plugin-panel'));
                    $menu.addClass("open");
                    setTimeout(function () {
                        $scope.focusInput();
                    }, 50);
                }, 30);
            });

            $scope.hoverItem = function (index) {
                $scope.currentIndex = index;
            };

            $scope.scrollToTop = function () {
                $menu.find(".plugin-container").scrollTop(0);
            };

            $scope.selectType = function (type) {
                $scope.currentIndex = -1;
                $scope.typeFilter = type;
                localStorage["eagle.pluginPanel.type"] = type;
                $scope.calculateList();
            };

            $scope.installPlugin = () => {
                if ($scope.typeFilter === "window") {
                    $scope.openPluginCenter();
                }
                else if ($scope.typeFilter === "format") {
                    $scope.openPluginCenter('format');
                }
                else if ($scope.typeFilter === "inspector") {
                    $scope.openPluginCenter('inspector');
                }
            };

            $scope.openDevelopmentDocs = () => {
                if (preferences.general.language === "zh_CN") {
                    shell.openExternal('https://developer.eagle.cool/plugin-api/v/zh-cn');
                }
                else {
                    shell.openExternal('https://developer.eagle.cool/plugin-api');
                }
            };

            $scope.calculateList = function () {

				$scope.listItems = [];

				pluginModule.plugins.forEach((plugin) => {
					try {
						const manifest = plugin.manifest;
						$scope.listItems.push({
                            id: `plugin-${plugin.manifest.id}`,
                            type: "plugin",
							icon: `${URL_MODULE.pathToFileURL(`${plugin.path}/${manifest.logo}`).href}?t=${Date.now()}`,
							name: manifest.name,
							dir: manifest?.main?.shortcut || '',
							path: plugin.path,
							executable: !!manifest.main,
							isPreviewPlugin: !!manifest.preview,
							isLocal: plugin.types.includes("development"),
							isDisabled: pluginModule.isPluginDisabled(plugin.manifest.id),
							keyword: `${manifest.name} ${manifest.keywords.join(" ")}`,
                            types: plugin.types,
							plugin: plugin
						});
					}
					catch (err) {
						console.error(err);
					}
				});

                $scope.windowPlugins = $scope.listItems.filter((item) => {
                    return item.types.includes("window");
                });

                // sort by plugin.name
                $scope.listItems = $scope.listItems.sort((a, b) => {
                    return a.name.localeCompare(b.name);
                });

                // 根據類型篩選
                $scope.listItems = $scope.listItems.filter((item) => {
                    return item?.types?.includes($scope.typeFilter);
                });

                if ($scope.searchKeyword !== "") {
                    $scope.resultList = filterPluginItem($scope.listItems, $scope.searchKeyword).filter(item => !item.isDisabled);

                    if ($scope.resultList.length > 0) {
                        $scope.currentIndex = 0;
                    }
                }
                else {
                    // 分離啟用/停用插件（僅非搜尋模式）
                    const enabledItems = [];
                    const disabledItems = [];
                    for (const item of $scope.listItems) {
                        (item.isDisabled ? disabledItems : enabledItems).push(item);
                    }

                    if (disabledItems.length > 0) {
                        const disabledHeader = enabledItems.length > 0
                            ? [{ id: "disabled-separator", type: "separator" }]
                            : [];
                        $scope.listItems = [
                            ...enabledItems,
                            ...disabledHeader,
                            ...disabledItems
                        ];
                    } else {
                        $scope.listItems = enabledItems;
                    }
                    // 顯示最近執行插件
                    if ($scope.windowPlugins.length > 1 && $scope.typeFilter === "window") {
                        $scope.lastOpenedPlugins = $scope.lastOpenedPlugins.filter((plugin) => {
                            return pluginModule.installedPluginMaps[plugin.manifest.id] && !pluginModule.isPluginDisabled(plugin?.manifest?.id);
                        });
                        let lastOpenedItems = $scope.lastOpenedPlugins.map((plugin) => {
                            return {
                                id: `last-opened-${plugin.manifest.id}`,
                                type: "plugin",
                                icon: `${URL_MODULE.pathToFileURL(`${plugin.path}/${plugin.manifest.logo}`).href}?t=${Date.now()}`,
                                name: plugin.manifest.name,
                                dir: plugin.manifest?.main?.shortcut || '',
                                path: plugin.path,
                                executable: !!plugin.manifest.main,
                                isPreviewPlugin: !!plugin.manifest.preview,
                                isLocal: plugin.types.includes("development"),
                                keyword: `${plugin.manifest.name} ${plugin.manifest.keywords.join(" ")}`,
                                types: plugin.types,
                                plugin: plugin
                            };
                        });

                        if (lastOpenedItems.length > 3) lastOpenedItems.length = 3;

                        $scope.listItems = $scope.listItems.filter((item) => {
                            return !lastOpenedItems.find((lastOpenedItem) => {
                                return lastOpenedItem?.plugin?.manifest?.id === item?.plugin?.manifest?.id;
                            });
                        });
    
                        $scope.listItems = [{ id: "label", type: "label", name: i18n.__('modal.pluginPanel.label.recent') }, ...lastOpenedItems, { id: "separator", type: "separator" }, ...$scope.listItems];
                        $scope.currentIndex = 1;
                    }

                    $scope.resultList = $scope.listItems.unique();
                }
            }

            $scope.focusInput = function () {
                setTimeout(() => {
                    $searchInput.focus();
                }, 24);
            };

            $scope.close = function () {
                $scope.scrollToTop();
                $menu.removeClass("open");
                $searchInput.blur();
                $scope.scrollToTop();
            };

            $scope.onItemClick = function (item) {
                if (item.isDisabled) return;
                const plugin = item?.plugin;
				if (!item.executable) {
					const file = $bodyScope.selected[0];
					const ext = file?.ext;
                    const keys = Object.keys(plugin?.manifest?.preview);
                    if (!plugin?.manifest?.preview?.[keys]?.viewer) return;
                    for (const key of keys) {
                        if (key.includes(ext)) {
                            pluginModule.openPreview(plugin, file);
                            $scope.close();
                            return;
                        }
                    }
				}
				else {
					pluginModule.open(plugin);
					$scope.close();
				}
            };

            function filterPluginItem (items, keyword) {

                if (!keyword) return items;
                var keyword_cn = chineseConvert.tw2cn(keyword).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\ /g, '').toLowerCase();

                var temp = items.map(item => {
                    var nameCN = chineseConvert.tw2cn(item.keyword).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                    if (keyword.length >= 30 || item.keyword.length >= 30) {
                        return {
                            item: item,
                            name: nameCN,
                            search: [nameCN]
                        }
                    }
                    return {
                        item: item,
                        name: nameCN,
                        search: [nameCN, ..._.uniq(
                            cartesianProduct(pinyinlite(nameCN, { keepUnrecognized : true }).filter(p => p.length > 0))
                            .map(item => item.join(' '))
                        )],
                    };
                });

                var scores = temp.map(item => {
                    return {
                        item: item,
                        name: item.keyword,
                        score: _.max(item.search.map(pinyin => pinyin.score(keyword_cn))),
                    };
                })
                
                var result = scores.filter(i => i.score > 0).sort((a, b) => b.score - a.score).map(function (i) {
                    return i.item.item;
                });

                // 依據 keyword 的 indexof 來排序, 如果=-1則不改變順序
                const keywordLower = keyword.toLowerCase();
                result = result.sort((a, b) => {
                    var indexA = a.name.toLowerCase().indexOf(keywordLower);
                    var indexB = b.name.toLowerCase().indexOf(keywordLower);
                    if (indexA === -1 && indexB === -1) return 0;
                    if (indexA === -1) return 1;
                    if (indexB === -1) return -1;
                    return indexA - indexB;
                });

                return result;
            }

            function selectCurrent () {
                if ($scope.resultList[$scope.currentIndex]) {
                    $scope.onItemClick($scope.resultList[$scope.currentIndex]);
                    $scope.$evalAsync();
                }
            };

            function selectPrev () {
                var idx = $scope.currentIndex - 1;
                while (idx >= 0) {
                    var item = $scope.resultList[idx];
                    if (item?.type === "plugin" && !item?.isDisabled) break;
                    idx--;
                }
                if (idx >= 0) {
                    $scope.currentIndex = idx;
                    $scope.$evalAsync();
                }
            };

            function selectNext () {
                var idx = $scope.currentIndex + 1;
                var len = $scope.resultList.length;
                while (idx < len) {
                    var item = $scope.resultList[idx];
                    if (item?.type === "plugin" && !item?.isDisabled) break;
                    idx++;
                }
                if (idx < len) {
                    $scope.currentIndex = idx;
                    $scope.$evalAsync();
                }
            };

            function removePlugin (item) {

                let desc = $filter('i18n')('dialog.removePlugin.desc', [
                    { "property": "name", "value": item.name },
                ]);
                let theme  = $filter('themePath')($bodyScope.theme);

                swal({
                    html: `
                        <div class="alert">
                            <div class="alert-icon" style="background-image: url('${item.icon}')">
                                <img class="status" style="width: 20px; height: 20px;" src="assets/images/${theme}/icons/ic-plugin-install-modal-uninstall.svg">
                            </div>
                            <h4 class="alert-title">${i18n.__('dialog.removePlugin.title')}</h4>
                            <p class="alert-desc">${desc}</p>
                        </div>
                    `,
                    showCloseButton: false, showConfirmButton: true, showCancelButton: true, allowOutsideClick: false, focusConfirm: false, focusCancel: false, padding: 24,
                    width: 400,
                    customClass: "alert-box large",
                    cancelButtonColor: "#777777",
                    confirmButtonText: `${i18n.__('dialog.removePlugin.remove')}`,
                    cancelButtonText: i18n.__("general.cancel"),
                }).then(async () => {
                    if (item.isLocal) {
                        pluginModule.localPlugin.uninstall(item.plugin);
                    }
                    else {
                        pluginModule.remotePlugin.uninstall(item.plugin);
                    }
                    $scope.calculateList();
                });
            }

            $scope.pinPlugin = ($event, item) => {
                $event.stopPropagation();
                pluginModule.pinPlugin(item.plugin);
            };

            $scope.unpinPlugin = ($event, item) => {
                $event.stopPropagation();
                pluginModule.unpinPlugin(item.plugin);
            };

            $scope.openSubmenu = function ($event, item) {
                $event.stopPropagation();

                let newPlugin = pluginModule.needUpdatePluginMaps[item.plugin.manifest.id];

                ContextMenu.open({
                    items: [
                        { 
                            label: `${item.plugin.manifest.name} (${item.plugin.manifest.version})`,
                            disabled: true
                        },
                        {
                            visible: !item.isDisabled,
                            role: 'separator'
                        },
                        // 本地插件
                        {
                            visible: !!item.isLocal && !item.isDisabled,
                            label: i18n.__('modal.pluginPanel.contextMenu.reload'),
                            click: () => {
                                pluginModule.reloadPlugin(item.plugin.path);
                            }
                        },
                        {
                            visible: !!item.isLocal && !item.isDisabled,
                            label: i18n.__('modal.pluginPanel.contextMenu.openInExplorer'),
                            click: () => {
                                ipcRenderer.send('show-item-in-folder', item.plugin.path);
                            }
                        },
                        {
                            visible: !!item.isLocal && !item.isDisabled,
                            role: 'separator'
                        },
                        {
                            visible: !!item.isLocal && !item.isDisabled,
                            label: i18n.__('modal.pluginPanel.contextMenu.packPlugin'),
                            click: async () => {
                                try {
                                    const defaultPath = path.join("*/", item.plugin.manifest.name + '.eagleplugin');
                                    let result = await dialog.showSaveDialog(currentWindow, {
                                        defaultPath: defaultPath,
                                        filters: [{ name: 'Eagle Plugin', extensions: ['eagleplugin'] }]
                                    });
                                    const outputPath = result?.filePath;
                                    if (!outputPath || result?.canceled ) return;
                                    await pluginModule.packPlugin(item.plugin.path, outputPath);
                                    ipcRenderer.send('show-item-in-folder', outputPath);
                                }
                                catch (err) {
                                    alert(err.stack || err);
                                    electronLog.error(`[app] Pack Plugin fail.`);
                                    electronLog.error(err.stack || err);
                                }
                            }
                        },
                        {
                            visible: !!item.isLocal && !item.isDisabled,
                            label: i18n.__('modal.pluginPanel.contextMenu.publish'),
                            click: () => {
                                let lng2locale = {
                                    "zh_CN": "cn",
                                    "zh_TW": "tw",
                                    "ja_JP": "jp"
                                };
                                let baseUrl = `https://community-${lng2locale[preferences.general.language] || "en"}.eagle.cool`;
                                shell.openExternal(baseUrl);
                            }
                        },
                        // 安裝版本插件
                        {
                            visible: !item.isLocal && !!newPlugin && !item.isDisabled,
                            label: `${i18n.__('modal.pluginPanel.contextMenu.install')} (${newPlugin?.lasteVersion?.version})`,
                            click: () => {
                                $scope.openPluginCenter('update');
                                $rootScope.$evalAsync();
                            }
                        },
                        {
                            visible: !item.isLocal && !!newPlugin && !item.isDisabled,
                            role: 'separator'
                        },
                        {
                            visible: !item.isLocal && !item.isDisabled,
                            label: i18n.__('modal.pluginPanel.contextMenu.viewInPluginCenter'),
                            click: () => {
                                $scope.close();
                                $rootScope.$broadcast("OPEN_PLUGIN_CENTER_DETAIL", item.plugin.manifest.id);
                                $rootScope.$evalAsync();
                            }
                        },
                        {
                            visible: !item.isLocal && !item.isPreviewPlugin && !item.isDisabled,
                            label: i18n.__('modal.pluginPanel.contextMenu.shortcuts'),
                            click: () => {
                                ipcRenderer.send('open.preferences', {
                                    panel: "shortcuts",
                                    keyword: "plugin"
                                });
                            }
                        },
                        // 啟用/停用（所有插件共用）
                        { role: 'separator' },
                        {
                            label: item.isDisabled
                                ? i18n.__('modal.pluginPanel.contextMenu.enablePlugin')
                                : i18n.__('modal.pluginPanel.contextMenu.disablePlugin'),
                            click: () => {
                                if (item.isDisabled) {
                                    pluginModule.enablePlugin(item.plugin);
                                } else {
                                    pluginModule.disablePlugin(item.plugin);
                                }
                                $scope.calculateList();
                                $scope.$evalAsync();
                            }
                        },
                        {
                            visible: !item.isLocal,
                            role: 'separator'
                        },
                        {
                            visible: !item.isLocal,
                            label: i18n.__('modal.pluginPanel.contextMenu.uninstall'),
                            click: () => {
                                removePlugin(item);
                            }
                        },
                        {
                            visible: !!item.isLocal,
                            role: 'separator'
                        },
                        {
                            visible: !!item.isLocal,
                            label: i18n.__('modal.pluginPanel.contextMenu.uninstall'),
                            click: () => {
                                removePlugin(item);
                            }
                        }
                    ],
                });
            };

			$scope.openDevMenu = function ($event) {

                $event.stopPropagation();

                ContextMenu.open({
                    items: [
                        { 
                            label: i18n.__('modal.pluginPanel.contextMenu.createPlugin'),
                            icon: 'ic-folder-new-folder.svg',
                            click: () => {
                                $rootScope.$broadcast('OPEN_PLUGIN_CREATOR');
                                $rootScope.$evalAsync();
                            }
                        },
                        { 
                            label: i18n.__('modal.pluginPanel.contextMenu.importPlugin'),
                            icon: 'ic-import-local.svg',
                            click: async () => {
                                let result = await dialog.showOpenDialog(currentWindow, {
                                    properties: ['openDirectory']
                                });
                                if (result?.filePaths) {
                                    console.log(`Load local project: ${result?.filePaths[0]}`);
                                    pluginModule.localPlugin.load(result?.filePaths[0]).then(() => {
                                        $scope.selectType("development");
                                    });
                                }
                            }
                        },
                        { 
                            role: 'separator'
                        },
                        { 
                            label: i18n.__('modal.pluginPanel.contextMenu.docs'),
                            icon: 'ic-developer.svg',
                            click: () => {
                                if (preferences.general.language === "zh_CN") {
                                    shell.openExternal('https://developer.eagle.cool/plugin-api/v/zh-cn');
                                }
                                else {
                                    shell.openExternal('https://developer.eagle.cool/plugin-api');
                                }
                            }
                        },
                    ]
                });
            };

			$scope.openPluginCenter = (categoryId) => {
				// return;
				$rootScope.$broadcast("OPEN_PLUGIN_CENTER", categoryId);
			};

            $searchInput.on("keyup", function (event) {
                var keyCode = event.keyCode;
                switch (keyCode) {
                    case 13: 
                        if (event.metaKey || event.ctrlKey) {
                            event.preventDefault();
                            event.stopPropagation();
                            $scope.close();
                        }
                        else {
                            selectCurrent();
                        }
                        break;
                    case 27:
                        event.stopPropagation();
                        $scope.close();
                        break;
                    // up
                    case 38:
                        event.preventDefault();
                        selectPrev();
                        break;
                    // down
                    case 40:
                        event.preventDefault();
                        selectNext();
                        break;
                    case 9:
                        event.preventDefault();
                        event.stopPropagation();
                        break;
                }
            });
        }
    };
});