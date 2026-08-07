EagleApp.directive('duplicateScanPanel', function($timeout, $rootScope, $filter) {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/duplicate-scan-panel.html',
        scope: {
            theme: '=theme',
            folderMappings: '=folderMappings',
        },
        link: function ($scope, element, attrs, controllersArr) {

            $scope.init = (options) => {
                $scope.isOpen = false;
                $scope.items = [...options.items] || [];
                $scope.onMergedCallback = options.onMergedCallback || function() {};
                $scope.fingerprintMap = {};
                $scope.step = "INITIAL";
                $scope.reset();
            };

            $scope.reset = () => {
                $scope.scanMethod = undefined;
                $scope.similarity = 0.8;
                $scope.selectedItems = [];
                $scope.reducedSize = 0;
                $scope.total = $scope.items.length;
                $scope.current = 0;
                $scope.scanProgress = 0;

                $scope.groups = [];
                $scope.selectedGroupMap = {};
                $scope.hasPotentialSimilarResults = false;
            };

            $scope.back = () => {
                if ($scope.cancelControl) {
                    $scope.cancelControl.cancel("user cancelled");
                }
                $scope.step = "INITIAL";
                $scope.reset();
            }

            $scope.goResult = () => {
                $scope.goToStep("SCAN-RESULT");
            };

            $scope.scanSame = () => {
                const tokenSource = require('cancellation');
                $scope.cancelControl = tokenSource();
                $scope.scanMethod = "SAME";
                $timeout(async () => {
                    $scope.goToStep("SCAN");
                    const result = await eagle.duplicateChecker.findDuplicateFiles($scope.items, $scope.cancelControl.token, {
                        onProgress: (curr, total) => {
                            const progress = Math.floor(curr / total * 100);
                            // console.log(`progress: ${progress}% curr: ${curr} total: ${total}`);
                            $scope.total = total;
                            $scope.current = curr;
                            $scope.scanProgress = progress;
                            $scope.$evalAsync();
                        }
                    });
                    console.log(result);

                    if (result.cancel) return;

                    $scope.groups = result.groups;
                    $scope.groups.forEach((group) => {
                        $scope.selectedGroupMap[group.id] = group;
                        group.choice = group.items[0];
                    });
                    $scope.subsetItems = [];
                    $scope.groups.forEach((group) => {
                        $scope.subsetItems = $scope.subsetItems.concat(group.items);
                    });
                    $scope.updateSelectedItems();
                    $scope.goToStep("SCAN-RESULT");
                    $scope.$evalAsync();
                }, 600);
            };

            $scope.scanSimilar = () => {
                const tokenSource = require('cancellation');
                $scope.cancelControl = tokenSource();
                $scope.scanMethod = "SIMILAR";
                $timeout(async () => {
                    $scope.goToStep("SCAN");
                    const startTime = Date.now();

                    const calcuteTimeLeft = (percent) => {
                        // 计算剩馀时间
                        var elapsedTime = Date.now() - startTime;
                        var chunksPerTime = percent / elapsedTime;
                        var estimatedTotalTime = 100 / chunksPerTime;
                        $scope.timeLeftInSeconds = parseInt((estimatedTotalTime - elapsedTime) / 1000);
                    };
                    
                    const result = await eagle.duplicateChecker.findSimilarFiles($scope.items, $scope.cancelControl.token, {
                        fingerprintMap: $scope.fingerprintMap,
                        fingerprintWeighted: $scope.similarity,
                        onProgress: throttle((curr, total) => {
                            const progress = Math.floor(curr / total * 100);
                            // console.log(`progress: ${progress}% curr: ${curr} total: ${total}`);
                            $scope.total = total;
                            $scope.current = curr;
                            $scope.scanProgress = progress;
                            calcuteTimeLeft(progress);
                            $scope.$evalAsync();
                        }, 16, true)
                    });

                    console.log(result);
                    if (result.cancel) return;
                    
                    $scope.fingerprintMap = result.fingerprintMap;
                    $scope.groups = result.groups;

                    $scope.subsetItems = [];
                    $scope.groups.forEach((group) => {
                        $scope.subsetItems = $scope.subsetItems.concat(group.items);
                    });

                    // 記錄是否有潛在的相似結果（在最低相似度下）
                    $scope.hasPotentialSimilarResults = $scope.subsetItems.length > 0;

                    $scope.initSimilarGroups();
                    $scope.goToStep("SCAN-RESULT");
                    $scope.$evalAsync();
                }, 600);
            };

            $scope.changeSimilarityTimeout = undefined;
            $scope.changeSimilarity = (similarity) => {
                clearTimeout($scope.changeSimilarityTimeout);
                $scope.changeSimilarityTimeout = setTimeout(async () => {
                    $scope.similarity = similarity;
                    console.time("changeSimilarity");
                    const result = await eagle.duplicateChecker.findSimilarFiles($scope.subsetItems, $scope.cancelControl.token, {
                        fingerprintMap: $scope.fingerprintMap,
                        fingerprintWeighted: $scope.similarity,
                    });
                    console.timeEnd("changeSimilarity");
                    console.log(result);
                    $scope.selectedItems = [];
                    $scope.reducedSize = 0;
                    $scope.groups = result.groups;
                    $scope.selectedGroupMap = {};
                    $scope.initSimilarGroups();
                    $scope.$evalAsync();   
                }, 100);
            };

            $scope.initSimilarGroups = () => {
                // 根據 group item 的格式、分辨率、檔案大小進行排序
                // 優先使用最大分辨率的圖片
                // 第二使用格式最好的圖片，順序如下 PNG > BMP > JPG > JPEG > WEBP > AVIF > JXL > HEIC > HEIF > JFIF
                // 第三使用檔案大小最大的圖片
                $scope.groups.forEach((group) => {
                    group.items.sort((a, b) => {
                        const aArea = a.width * a.height;
                        const bArea = b.width * b.height;
                        if (aArea > bArea) return -1;
                        if (aArea < bArea) return 1;
                        const aFormat = a.ext;
                        const bFormat = b.ext;
                        if (aFormat === bFormat) {
                            const aSize = a.size;
                            const bSize = b.size;
                            if (aSize > bSize) return -1;
                            if (aSize < bSize) return 1;
                        }
                        if (aFormat === "png") return -1;
                        if (bFormat === "png") return 1;
                        if (aFormat === "bmp") return -1;
                        if (bFormat === "bmp") return 1;
                        if (aFormat === "jpg") return -1;
                        if (bFormat === "jpg") return 1;
                        if (aFormat === "jpeg") return -1;
                        if (bFormat === "jpeg") return 1;
                        if (aFormat === "webp") return -1;
                        if (bFormat === "webp") return 1;
                        if (aFormat === "avif") return -1;
                        if (bFormat === "avif") return 1;
                        if (aFormat === "jxl") return -1;
                        if (bFormat === "jxl") return 1;
                        if (aFormat === "heic") return -1;
                        if (bFormat === "heic") return 1;
                        if (aFormat === "heif") return -1;
                        if (bFormat === "heif") return 1;
                        if (aFormat === "jfif") return -1;
                        if (bFormat === "jfif") return 1;
                    
                        return 0;
                    });

                    group.choice = group.items[0];
                });

                $scope.groups.forEach((group) => {
                    $scope.selectedGroupMap[group.id] = group;
                });
                
                $scope.updateSelectedItems();
            };

            $scope.startMerge = () => {
                $scope.goToStep("MERGE");
            };

            $scope.goToStep = (step) => {
                $scope.step = step;
            };

            $scope.scanSameFiles = () => {
                $scope.scanMethod = "SAME";
            };

            $scope.scanSimilarFiles = () => {
                $scope.scanMethod = "SIMILAR";
            };

            $scope.isGroupSelected = (group) => {
                return $scope.selectedGroupMap[group.id] ? true : false;
            };

            $scope.removeGroup = (group) => {
                const idx = $scope.groups.indexOf(group);
                if (idx > -1) {
                    $scope.groups.splice(idx, 1);
                }
                // remove form items
                $scope.subsetItems = $scope.subsetItems.filter((item) => {
                    return group.items.indexOf(item) === -1;
                });
                delete $scope.selectedGroupMap[group.id];
                $scope.updateSelectedItems();
            };

            $scope.toggleGroupSelection = (group) => {
                if ($scope.isGroupSelected(group)) {
                    delete $scope.selectedGroupMap[group.id];
                } else {
                    $scope.selectedGroupMap[group.id] = group;
                }
                $scope.updateSelectedItems();
            }

            $scope.selectChoice = (group, item) => {
                group.choice = item;
                $scope.updateSelectedItems();
            };

            $scope.openInNewWindow = (item) => {
                openInNewWindow([item]);
            };

            $scope.onItemMouseup = (event, item) => {
                if (event.which === 2) {
                    event.stopPropagation();
                    $scope.openInNewWindow(item);
                }
            };

            $scope.openItemContextMenu = (group, item) => {
                ContextMenu.open({
                    items: [
                        {
                            label: i18n.__('context.image.openInDefault'),
                            icon: 'ic-open-default.svg',
                            click: () => {
                                const rawPath = FileUrlHelper.getRawPath(item);
                                ipcRenderer.send('open-with-default', rawPath);
                            },
                        },
                        // 在新窗口打开
                        {
                            label: i18n.__('Context.Open.New.Window'),
                            icon: 'ic-open-new-window.svg',
                            click: () => {
                                $scope.openInNewWindow(item);
                            },
                        },
                        { 
                            label: i18n.__('duplicatePanel.step3.list.removeItem'), 
                            icon: 'ic-file-delete-permanently.svg',
                            click: () => { 
                                // remove item from group.items
                                const idx = group.items.indexOf(item);
                                if (idx > -1) {
                                    group.items.splice(idx, 1);
                                    group.choice = group.items[0];
                                }

                                // remove from items
                                const idx2 = $scope.subsetItems.indexOf(item);
                                if (idx2 > -1) {
                                    $scope.subsetItems.splice(idx2, 1);
                                }

                                // remove group if group.items is empty
                                if (group.items.length === 1) {
                                    $scope.removeGroup(group);
                                }
                                $scope.$evalAsync();
                            } 
                        },
                    ],
                    showSearch: false,
                });
            };

            $scope.updateSelectedItems = () => {
                $scope.reducedSize = 0;
                $scope.selectedItems = [];

                for (var key in $scope.selectedGroupMap) {
                    const group = $scope.selectedGroupMap[key];
                    const items = group.items;
                    $scope.selectedItems = $scope.selectedItems.concat(items);

                    if ($scope.scanMethod === "SAME") {
                        items.forEach((item, index) => {
                            if (items.length - 1 === index) return;
                            $scope.reducedSize += item.size;
                        });
                    }
                    else {
                        const choice = group.choice;
                        items.forEach((item, index) => {
                            if (item === choice) return;
                            $scope.reducedSize += item.size;
                        });
                    }
                }
            };

            $scope.getThumbnailUrl = (item) => {
                return FileUrlHelper.getThumbnailUrl(item);
            };

            $scope.onMerged = ({ changed, trash }) => {

                $scope.onMergedCallback({
                    changed: changed,
                    trash: trash,
                });

                const totalSize = trash.reduce((acc, item) => {
                    return acc + item.size;
                }, 0);
                const size = $filter('filesize')(totalSize);
                const count= trash.length;

                const desc = $filter('i18n')("duplicatePanel.dialog.desc", [
                    { "property": "count", "value": count },
                    { "property": "size", "value": size }
                ]);

                swal({
                    html: `
                    <div class="alert">
                        <div class="alert-icon success"></div>
                        <h4 class="alert-title">${i18n.__('duplicatePanel.dialog.title')}</h4>
                        <p class="alert-desc">${desc}</p>
                    </div>
                    `,
                    showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
                    width: 400,
                    customClass: "alert-box",
                    cancelButtonColor: "#777777",
                    confirmButtonText: i18n.__('duplicatePanel.dialog.continue'),
                    cancelButtonText: i18n.__('duplicatePanel.dialog.exit'),
                }).then(() => {
                    $scope.groups = $scope.groups.filter((group) => {
                        return !$scope.selectedGroupMap[group.id];
                    });
                    $scope.selectedGroupMap = {};
                    $scope.selectedItems = [];
                    $scope.goResult();
                    $scope.$evalAsync();
                }, () => {
                    $scope.close();
                    $scope.$evalAsync();
                });
            }

            $scope.$on("OPEN_DUPLICATE_SCAN_PANEL", (event, params) => {
                $scope.init(params);
                $scope.isOpen = true;
            });

            $scope.close = function () {
                if ($scope.cancelControl) {
                    $scope.cancelControl.cancel("user cancelled");
                }
                $scope.isOpen = false;
            };
        }
    }
});