EagleApp.directive('mergeEditor', function($timeout, $rootScope, $filter) {
    return {
        replace: true,
        restrict: 'E',
        templateUrl: 'js/directives/merge-editor.html',
        scope: {
            theme: '=theme',
            groups: '=groups',
            selectedGroupMap: '=selectedGroupMap',
            method: '=method',
            onMerged: '=onMerged',
            folderMappings: '=folderMappings',
        },
        link: function ($scope, element, attrs, controllersArr) {

            init();

            function init () {
                $scope.isMerging = false;
                // 計算出選取的 groups
                $scope.selectedGroups = $scope.groups.filter((group) => $scope.selectedGroupMap[group.id]);
                $scope.currentGroup = $scope.selectedGroups[0];

                $scope.selectedItems = [];

                // 剛進入 merge 模式，初始化默認值
                $scope.selectedGroups.forEach((group) => {

                    // 計算每個 group 的 props
                    group.props = {
                        names: [],
                        urls: [],
                        folders: [],
                        tags: [],
                        annotations: [],
                        mergedAnnotation: ""
                    };
                    
                    group.items.forEach((item) => {
                        if (item.name) {
                            group.props.names.push(item.name);
                        }
                        if (item.url) {
                            group.props.urls.push(item.url);
                        }
                        if (item.folders && item.folders.length > 0) {
                            group.props.folders = group.props.folders.concat(item.folders);
                        }
                        if (item.tags && item.tags.length > 0) {
                            group.props.tags = group.props.tags.concat(item.tags);
                        }
                        if (item.annotation) {
                            group.props.annotations.push(item.annotation);
                        }

                        group.props.names = [...new Set(group.props.names)];
                        group.props.urls = [...new Set(group.props.urls)];
                        group.props.folders = [...new Set(group.props.folders)];
                        group.props.tags = [...new Set(group.props.tags)];
                        // sort tags
                        group.props.tags = group.props.tags.sort((a, b) => {
                            try {
                                return a.localeCompare(b, 'zh-Hant-CN');
                            }
                            catch (err) {
                                return 0;
                            }
                        });
                        group.props.annotations = [...new Set(group.props.annotations)];

                        if (item.star && item.star > 0) {
                            if (group.props.star === undefined) {
                                group.props.star = item.star;
                            }
                            else if (group.props.star < item.star) {
                                group.props.star = item.star;
                            }
                        }

                        $scope.selectedItems.push(item);
                    });

                    group.mergedData = {
                        name: group.props.names[0],
                        thumbnailUrl: FileUrlHelper.getThumbnailUrl(group.items[0]),
                        url: group.props.urls[0] || "",
                        folders: [...group.props.folders],
                        foldersMap: {},
                        tags: [...group.props.tags],
                        tagsMap: {},
                        annotation: group.props.annotations[0] || "",
                        star: group.props.star ?? undefined,
                    };

                    group.mergedData.folders.forEach((folder) => {
                        group.mergedData.foldersMap[folder] = folder;
                    });

                    group.mergedData.tags.forEach((tag) => {
                        group.mergedData.tagsMap[tag] = tag;
                    });

                    // 如果 props annotation 超過 2 個以上，建立一個合併的 annotation
                    if (group.props.annotations.length > 1) {
                        group.mergedData.mergedAnnotation = group.props.annotations.join("\n").substring(0, 4096);
                    }
                });

                console.log($scope.selectedGroups);
            };

            $scope.getThumbnailUrl = (item) => {
                return FileUrlHelper.getThumbnailUrl(item);
            };
            
            $scope.selectGroup = (group) => {
                $scope.currentGroup = group;
            };

            $scope.changeName = (group, name) => {
                group.mergedData.name = name;
            };
            
            $scope.changeUrl = (group, url) => {
                group.mergedData.url = url;
            };

            
            $scope.selectCustomAnnotation = (group) => {
                group.customAnnotation = true;
                group.mergedData.annotation = group.props.mergedAnnotation;
            };
            
            $scope.changeAnnotation = (group, annotation) => {
                group.customAnnotation = false;
                group.mergedData.annotation = annotation;
            };
            
            $scope.toggleFolder = (group, folder) => {
                if (group.mergedData.folders.includes(folder)) {
                    group.mergedData.folders = group.mergedData.folders.filter((f) => f !== folder);
                    delete group.mergedData.foldersMap[folder];
                } else {
                    group.mergedData.folders.push(folder);
                    group.mergedData.foldersMap[folder] = folder;
                }
                group.mergedData.folders = [...new Set(group.mergedData.folders)];
            };
            
            $scope.toggleTag = (group, tag) => {
                if (group.mergedData.tags.includes(tag)) {
                    group.mergedData.tags = group.mergedData.tags.filter((t) => t !== tag);
                    delete group.mergedData.tagsMap[tag];
                } else {
                    group.mergedData.tags.push(tag);
                    group.mergedData.tagsMap[tag] = tag;
                }
                group.mergedData.tags = [...new Set(group.mergedData.tags)];
            };

            const checkOperationSafety = (callback, amount = 1) => {
                try {
                    if ($scope.selectedItems && $scope.selectedItems.length >= 1) {
                        var html = $filter('i18n')("Dialog.BulkAction.Descript", [
                            { "property": "count", "value": $scope.selectedItems.length },
                        ]);
                        swal({
                            html: `
                                <div class="alert">
                                    <div class="alert-icon warning"></div>
                                    <h4 class="alert-title">${i18n.__("Dialog.BulkAction.Title")}</h4>
                                    <p class="alert-desc">${html}</p>
                                </div>
                            `,
                            showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: false, focusCancel: false, padding: 24,
                            width: 400,
                            customClass: "alert-box",
                            cancelButtonColor: "#777777",
                            confirmButtonText: i18n.__("Dialog.BulkAction.Button"),
                            cancelButtonText: i18n.__("general.cancel"),
                            allowEnterKey: false,
                        }).then(function (result) {
                            callback && callback();
                            $scope.$evalAsync();
                        });
                    }
                    else {
                        callback && callback();
                    }
                }
                catch (err) {
                    callback && callback();
                }
            };    

            $scope.merge = () => {
                checkOperationSafety(() => {
                    if ($scope.isMerging) return;
                    $scope.isMerging = true;

                    $scope.mergeProgress = 0;
                    
                    const changed = [];
                    const trash = [];
                    $scope.selectedGroups.forEach((group) => {
                        if (!group.choice?.id) return;
                        const choice = $bodyScope.itemMappings[group.choice.id];
                        const originName = choice.name;
                        const newName = group.mergedData.name;
                        choice.name = newName;
                        choice.oldName = originName;
                        choice.newName = newName;
                        choice.tags = group.mergedData.tags ?? choice.tags;
                        choice.folders = group.mergedData.folders ?? choice.folders;
                        choice.star = group.mergedData.star ?? choice.star;
                        
                        if (group.customAnnotation) {
                            choice.annotation = group.mergedData.mergedAnnotation ?? choice.annotation;
                        } else {
                            choice.annotation = group.mergedData.annotation ?? choice.annotation;
                        }
                        choice.url = group.mergedData.url ?? choice.url;

                        group.items.forEach((item) => {
                            const origin = $bodyScope.itemMappings[item.id];
                            if (!origin) return;
                            if (group.choice !== item) {
                                origin.isDeleted = true;
                                trash.push(origin);
                            }
                            changed.push(origin);
                        });
                    });

                    ayncsImagesChange(changed);
                    $bodyScope.calculateImageBinding({}, function() {
                        $bodyScope.notify({
                            message: $filter('i18n')("notify.removeDuplicate.successMsg"),
                            duration: 750
                        });
                        $bodyScope.rebindRefresh();
                        $bodyScope.updateSelection();
                        $scope.isMerging = false;
                        $scope.onMerged({
                            changed: changed,
                            trash: trash,
                        });
                        try { electronLog && electronLog.info(`[app] Clear all duplicate items, ${trash.length} files has been removed to trash`); } catch (err) {};
                    });
                }, 1)
            };
        }
    }
});