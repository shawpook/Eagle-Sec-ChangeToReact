EagleApp.directive('libraryPanel', function($timeout, $rootScope) {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/library-panel.html',
        scope: {
            libraryHistory: '=libraryHistory',
            theme: '=theme'
        },
        link: function ($scope, element, attrs, controllersArr) {
            $scope.resultList = [];
            $scope.searchKeyword = "";
            $scope.currentIndex = -1;
            var $menu = $("#library-panel");
            var $searchInput = $("#library-panel-search");

            $scope.$on("UPDATE_LIBRARY_PANEL", function () {
                $scope.calculateList();
            });

            $scope.$on("OPEN_LIBRARY_PANEL", function (event, params) {

                $scope.currentIndex = -1;
                $scope.searchKeyword = "";

                $scope.pinnedLibrary = electronSettings.getSync('pinnedLibrary') || [];
                $scope.pinnedLibraryMap = {};
                $scope.pinnedLibrary.forEach(function (libraryPath) {
                    $scope.pinnedLibraryMap[libraryPath] = true;
                });
                $scope.listItems = [];
                $scope.libraryHistory.forEach(function (libraryHistory) {

                    var libraryName = path.basename(libraryHistory).replace('.library', '');
                    var libraryPath = path.normalize(libraryHistory);
					var libraryDirPath = path.normalize(path.dirname(libraryHistory).replace(/\\$/g, "").replace(/\/$/, ""));

                    $scope.listItems.push({
                        name: libraryName,
                        path: libraryPath,
						dir: libraryDirPath,
                        isOpened: $bodyScope.libraryPath === libraryPath
                    });
                })

                $scope.calculateList();

                $timeout(function () {
                    moveToCursorPosition($('#library-panel'));
                    $menu.addClass("open");
                    setTimeout(function () {
                        $scope.focusInput();
                    }, 100);
                }, 30);
            });

            $scope.hoverItem = function (index) {
                $scope.currentIndex = index;
            };

            $scope.scrollToTop = function () {
                $menu.find(".library-container").scrollTop(0);
            };

            $scope.calculateList = function () {
                if ($scope.searchKeyword !== "") {
                    $scope.resultList = filterLibraryItem($scope.listItems, $scope.searchKeyword);
                    if ($scope.resultList.length > 0) {
                        $scope.currentIndex = 0;
                    }
                }
                else {
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
                if (item.isOpened) return;
                $bodyScope.openLibrary(item.path);
                $scope.close();
            };

            $scope.createLibrary = function () {
                $bodyScope.createLibrary();
                $scope.close();
            };

            $scope.loadLibrary = function () {
                $bodyScope.importLibrary();
                $scope.close();
            };

            $scope.reloadLibrary = function () {
                IPCHelper.send('reload-without-cache');
                $scope.close();
            };

            $scope.mergeLibrary = function () {
                $bodyScope.importLibraryData();
                $scope.close();
            };

            function filterLibraryItem (items, keyword) {

                if (!keyword) return items;
                var keyword_cn = chineseConvert.tw2cn(keyword).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\ /g, '').toLowerCase();

                var temp = items.map(item => {
                    var nameCN = chineseConvert.tw2cn(item.name).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                    if (keyword.length >= 30 || item.name.length >= 30) {
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
                        name: item.name,
                        score: _.max(item.search.map(pinyin => pinyin.score(keyword_cn))),
                    };
                })
                
                var result = scores.filter(i => i.score > 0).sort((a, b) => b.score - a.score).map(function (i) {
                    return i.item.item;
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
                if ($scope.currentIndex > 0) {
                    $scope.currentIndex--;
                    $scope.$evalAsync();
                }
            };

            function selectNext () {
                if ($scope.currentIndex < $scope.resultList.length - 1) {
                    $scope.currentIndex++;
                    $scope.$evalAsync();
                }
            };

            function updatePinnedLibrary () {
                if ($scope.pinnedLibrary) {
                    $scope.pinnedLibrary = $scope.pinnedLibrary.sort(function (a, b) {
                        try {
                            var idxa = $scope.libraryHistory.indexOf(a);
                            var idxb = $scope.libraryHistory.indexOf(b);
                            if(idxa > idxb) return 1;
                            if(idxa < idxb) return -1;
                        } catch (err) {}
                        return 0;
                    });
                    electronSettings.setSync('pinnedLibrary', $scope.pinnedLibrary);
                }
                $rootScope.$broadcast("UPDATE_MAIN_NAV");
            }

            function updateLibraryHistory () {
                var libraryHistory = $scope.listItems.map(function (item) {
                    return item.path;
                });
                if (libraryHistory.length > 0) {
                    electronSettings.setSync('libraryHistory', libraryHistory);
                }
                $scope.libraryHistory = libraryHistory;
                IPCHelper.send('update-preferences');
            }

            $scope.openSubmenu = function ($event, item) {
                
                $event && $event.stopPropagation();
                let iconPath = path.normalize(`${item.path}/icon.png`);

                ContextMenu.open({
                    items: [
                        {
                            label: i18n.__("dialog.libraryItem.changeIcon"),
                            icon: 'ic-icon-change.svg',
                            click: () => {
                                dialog.showOpenDialog(currentWindow, {
                                    title: "Select files",
                                    filters: [
                                        { name: 'Image', extensions: ['jpg', 'png', 'jpeg', 'webp', 'gif'] },
                                    ],
                                    properties: ['openFile']
                                }).then(result => {
                                    var paths = result.filePaths;
                                    if (!paths || paths.length === 0) return;
                                    var choosePath = paths[0];
                                    try {
                                        let iconUrl = URL_MODULE.pathToFileURL(iconPath).href;
                                        let image = new Image();
                                        image.onload = function() {
                                            try {
                                                canvasHelper.resize(image, {
                                                    toCropImgX: 0,
                                                    toCropImgY: 0,
                                                    toCropImgW: image.width,
                                                    toCropImgH: image.height,
                                                    imgChangeRatio: 64 / Math.min(image.width, image.height),
                                                    mimeType: "image/png",
                                                    quality: 100
                                                }, function (base64string) {
                                                    let buffer = decodeBase64Image(base64string).data;
                                                    if (fs.existsSync(iconPath)) {
                                                        fse.removeSync(iconPath);
                                                    }
                                                    fs.writeFile(iconPath, buffer, function (err) {
                                                        $rootScope.$broadcast("UPDATE_LIBRARY_ICON", item.path);
                                                        $scope.$evalAsync();
                                                    });
                                                });
                                            }
                                            catch (err) {
                                                finishCallback(null);
                                            }
                                        };
                                        image.onerror = function() {};
                                        image.src = URL_MODULE.pathToFileURL(choosePath).href;
                                    } catch (err) {
                                        electronLog && electronLog.error(err.stack || err);
                                    }
                                });
                            }
                        },
                        {
                            label: i18n.__("dialog.libraryItem.removeIcon"),
                            icon: 'ic-icon-remove.svg',
                            click: () => {
                                var confContextMenu = new Menu();
                                confContextMenu.append(new MenuItem({ 
                                    label: i18n.__("dialog.libraryItem.remove"),
                                    click: function() { 
                                        if (fs.existsSync(iconPath)) {
                                            fs.unlink(iconPath, function () {
                                                $rootScope.$broadcast("UPDATE_LIBRARY_ICON", item.path);
                                                $scope.$evalAsync();
                                            });
                                        }
                                    }
                                }));
                                confContextMenu.append(new MenuItem({ 
                                    label: i18n.__("general.cancel"),
                                    click: function() {}
                                }));
                                confContextMenu.popup(currentWindow);
                            }
                        },
                        {
                            role: 'separator'
                        },
                        {
                            label: (process.platform == 'darwin') ? i18n.__('appmenu.view>openInFinder') : i18n.__('context.image.openInExplorer'),
                            icon: (process.platform === 'darwin')? 'ic-open-finder.svg': 'ic-open-explorer.svg',
                            click: () => {
                                ipcRenderer.send('show-item-in-folder', item.path);
                            }
                        },
                        {
                            label: i18n.__("dialog.libraryItem.removeFromList"),
                            icon: 'ic-remove-from-list.svg',
                            click: () => {
                                var idx = $scope.listItems.indexOf(item);
                                $scope.listItems.splice(idx, 1);
                                $scope.unpinLibrary(undefined, item);
                                updateLibraryHistory();
                                $scope.$evalAsync();
                            }
                        },
                    ],
                    showSearch: false,
                });
            };

            $scope.pinLibrary = function ($event, item) {
                $event && $event.stopPropagation();
                if ($scope.pinnedLibrary.indexOf(item.path) === -1) {
                    $scope.pinnedLibrary.push(item.path);
                    updatePinnedLibrary();
                }
                $scope.pinnedLibrary = [...new Set($scope.pinnedLibrary)];
                $scope.pinnedLibraryMap[item.path] = true;
            };

            $scope.unpinLibrary = function ($event, item) {
                $event && $event.stopPropagation();
                if ($scope.pinnedLibrary.length === 1) return;
                var idx = $scope.pinnedLibrary.indexOf(item.path);
                if (idx !== -1) {
                    $scope.pinnedLibrary.splice(idx, 1);
                    updatePinnedLibrary();
                }
                $scope.pinnedLibrary = [...new Set($scope.pinnedLibrary)];
                delete $scope.pinnedLibraryMap[item.path];
            };

            $scope.sortableOptions = {
                handle: '> .drag-helper',
                animation: 200,
                distance: 10,
                disabled: false,
                update: function(e, ui) {
                    $timeout(function () {
                        updateLibraryHistory();
                        updatePinnedLibrary();
                    }, 500);
                },
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
