EagleApp.directive('inspector', ($timeout, $rootScope, $filter) => ({
    restrict: 'E',
    templateUrl: 'js/directives/inspector.html',
    scope: {
        platform: '=platform',
        theme: '=theme',
        isAlwaysOnTop: '=isAlwaysOnTop',
        viewMode: '=viewMode',
        current: '=current',
        selected: '=selected',
        currentFolder: '=currentFolder',
        currentSmartFolder: '=currentSmartFolder',
        folderMappings: '=folderMappings',
        selectedFolderMappings: '=selectedFolderMappings',
        TagManager: '=tagManager',
        trialRemain: '=trialRemain',
    },
    link: function ($scope, element, attrs, controllersArr) {

        ipcRenderer.on('plugin-installed', (event, pluginId) => {
            eagle.inspector.initPlugins();
            $scope.$evalAsync();
        });

        ipcRenderer.on('plugin-reloaded', (event, pluginId) => {
            eagle.inspector.initPlugins();
            $scope.$evalAsync();
        });

        $scope.VIDEO_TYPES = VIDEO_TYPES;
        $scope.AUDIO_TYPES = AUDIO_TYPES;
		$scope.MODEL_TYPES = MODEL_TYPES;
        $scope.FONT_TYPES = FONT_TYPES;
        $scope.URL_TYPES = URL_TYPES;
        $scope.inspector = eagle.inspector;
        $scope.inspectorPreviewStartIndex = 0;
        $scope.selectedIndexMappings = {};

        $(".inspector").on("mouseup", ".image", (event) => {
            const button = event?.button;
            if (button === 1) {
                $bodyScope.openPluginPanel();
                $bodyScope.$evalAsync();
            }
            else if (button !== 0) {
                $bodyScope.openItemContextMenu(event, $scope.selected[0]);
                $bodyScope.$evalAsync();
            }
        });

        $scope.$watchCollection("selected", (newValue, oldValue) => {
            if (!$scope.selected) return;

            $scope.selectedIndexMappings = {};
            $scope.inspectorPreviewStartIndex = $scope.selected.length - 5;

            if ($scope.inspectorPreviewStartIndex < 0) $scope.inspectorPreviewStartIndex = 0

            if ($scope.selected.length > 0) {
                eagle.inspector.activeTab = "ITEM";
                $scope.selected.forEach((image, index) => {
                    $scope.selectedIndexMappings[image.id] = index;
                });
            }
            else {
                eagle.inspector.activeTab = "SIDEBAR";
            }
        });

        var onInspectorResizeTimeout;
        $scope.onInspectorResize = function (e, ui) {
            if (ui && ui.size.width >= 200) {
                clearTimeout(onInspectorResizeTimeout);
                eagle.inspector.width = ui.size.width;
                onInspectorResizeTimeout = setTimeout(() => {
                    $bodyScope.relayout();
                    $bodyScope.offsetScrollbar(30);
                }, 500);
            }
        };

        $scope.hidePluginMap = JSON.parse(localStorage["eagle.inspector.hidePluginMap"] || "{}");
        $scope.togglePlugin = (plugin) => {
            if (!plugin) return;
            if (!$scope.hidePluginMap[plugin?.manifest?.id]) {
                $scope.hidePluginMap[plugin?.manifest?.id] = true;
            }
            else {
                delete $scope.hidePluginMap[plugin?.manifest?.id];
            }
            localStorage["eagle.inspector.hidePluginMap"] = JSON.stringify($scope.hidePluginMap);
        };

        $scope.hasInspectorPlugin = (plugin, items) => {
            let foundPlugins = [];
            if (items.length === 1) {
                const item = items[0];
                foundPlugins = pluginModule.previewExtension.inspectorPluginsMap[item.ext] ?? [];
            }
            else if (items.length > 1) {
                foundPlugins = pluginModule.previewExtension.getMultiSelectInspectorPlugin(items[0].ext) ?? [];
            }

            foundPlugins = foundPlugins.filter((plugin) => {
                return pluginModule.installedPluginMaps[plugin?.manifest?.id];
            });

            if (foundPlugins.length === 0) return false;

            return foundPlugins?.map(plugin => plugin?.manifest?.id).includes(plugin?.manifest?.id);
        };
        
        $scope.quickOpenFolder = (folder) => {
            $bodyScope.quickOpenFolder(folder);
        };

        $scope.autoScroll = () => {
            $bodyScope.autoScroll();
        };

        $scope.openLink = () => {
            $bodyScope.openLink();
        };

        $scope.changeStar = function (star, showNotify, force) {
            $bodyScope.changeStar(star, showNotify, force);
        };

        $scope.openImageExportContextMenu = (event) => {
            $bodyScope.openImageExportContextMenu(event);
        };

        $scope.openFolderFullPathContextMenu = (event, folder) => {
            $bodyScope.openFolderFullPathContextMenu(event, folder);
        };

        $scope.getFolderFullPath = (folder) => {
            return $bodyScope.getFolderFullPath(folder);
        };

        $scope.removeFromFolder = (event, folderId) => {
            $bodyScope.removeFromFolder(event, folderId);
        };

        $scope.preventEnter = (event) => {
            if (event.keyCode === 13) {
                event.preventDefault();
                $(event.target).trigger("blur");
            }
            else if (event.keyCode === 27) {
                event.preventDefault();
                event.stopPropagation();
            }
        };

        $scope.selectLinkInput = ($event) => {
            if ($event && $event.target) {
                $($event.target).select();
            }
        };

        $scope.inspectorNameChange = () => {
            if ($bodyScope.isDetailMode && (VIDEO_TYPES[$scope.current.ext] || AUDIO_TYPES[$scope.current.ext])) {
                eagle.inspector.isRenaming = true;
                $bodyScope.$evalAsync();
                $timeout(() => {
                    $scope.imagesChange();
                    $timeout(() => {
                        eagle.inspector.isRenaming = false;
                    }, 500);
                }, 200);
                
            }
            else {
                $scope.imagesChange();
            }
        };

        $scope.newUrlKeyup = (event) => {
            if (event.keyCode === 13) {
                $scope.urlChange();
            }
        };

        $scope.$on("INSPECTOR_SAVE_CHANGES", () => {
            $scope.imagesChange();
        });

        $scope.$on("PLUGIN_UNINSTALL", () => {
            eagle.inspector.initPlugins();
        });

        $scope.imagesChange = () => {
            var name = eagle.inspector.newName;
            console.log(`before: ${name.length}`)
            name = name.substr(0, remainingFilenameLength($bodyScope.libraryPath));
            console.log(`after: ${name.length}`)
            name = sanitize(name).replace(/%/g, "").replace(/&lt;/g,"").replace(/&gt;/g,"").trim();
            name = _.unescape(name);

            // 禁止清除名稱，一定要有文字
            if (name === "" && $scope.selected.length === 1) {
                $scope.updateSelection();
                return;
            }

            eagle.inspector.newName = name;

            if (emojiRegex.test(name)) {
                name = name.replace(emojiRegex, '');
                eagle.inspector.newName = name;
            }

            let changedItems = [];

            $scope.selected.forEach(function(image) {

                let hasChanged = false;

                if (typeof eagle.inspector.newUrl === "string" && image.url !== eagle.inspector.newUrl) {
                    if (is.url(eagle.inspector.newUrl) || eagle.inspector.newUrl == "" || eagle.inspector.newUrl.indexOf("file://") === 0) {
                        image.url = eagle.inspector.newUrl;
                        hasChanged = true;
                    }
                    else if (fs.existsSync(eagle.inspector.newUrl)) {
                        image.url = eagle.inspector.newUrl;
                        hasChanged = true;
                    }
                    else if (eagle.inspector.newUrl.indexOf("://") > -1) {
                        image.url = eagle.inspector.newUrl;
                        hasChanged = true;
                    }
                }

                let cloneImage = angular.copy(image);

                if (name) {
                    if (cloneImage.name !== name) {
                        cloneImage.oldName = cloneImage.name;
                        cloneImage.name = name;
                        cloneImage.newName = name;
                        hasChanged = true;
                    }
                }

                if (hasChanged) {
                    changedItems.push(cloneImage);
                    $bodyScope.updateItemView(cloneImage);

                    if (!$bodyScope.modifiedMappings[image.id]) {
                        $bodyScope.modifiedMappings[image.id] = 1;
                    }
                    else {
                        $bodyScope.modifiedMappings[image.id]++;
                    }
                }
            });

            if (changedItems.length > 0) {
                ayncsImagesChange(changedItems);
                hiddenByCurrentFilter(changedItems);

                electronLog.info(`[app] Change items info from inspctor, total: ${$scope.selected.length} files`);

                // 避免修改影片名稱造成影片重頭播放
                if ($bodyScope.isDetailMode) {
                    $bodyScope.rememberVideoCurrentTime($scope.current);
                    if ($("#font-viewer").length > 0) {
                        $("iframe#font-viewer").contents().find(".font-name span").text(eagle.inspector.newName);
                    }
                }
                $bodyScope.rebindRefresh(true);
            }
        };

        // 檢查器名稱欄位修改
        var inspectorCategoryNameChangeTimeout;
        $scope.inspectorCategoryNameChange = () => {
            var name = eagle.inspector.category.newName;
            var target;
            if (eagle.inspector.inspectorFolder) {
                target = eagle.inspector.inspectorFolder;
            }
            else {
                target = $scope.currentSmartFolder;
            }
            if (name === "") {
                eagle.inspector.category.newName = target.name;
                return;
            }
            $timeout.cancel(inspectorCategoryNameChangeTimeout);
            inspectorCategoryNameChangeTimeout = $timeout(() => {
                if (target) {
                    const originalName = target.name;
                    name = name.substr(0, 1024);
                    name = name.replaceAll("&amp;", "&");
                    target.name = name;
                    if (_.isString(target.name)) {
                        target.pinyin = tinyPinyin.convertToPinyin(target.name);
                    }
                    try { electronLog && electronLog.info(`[app] Change inspctor folder name: ${originalName}(${target.id}) > ${target.name}`); } catch (err) { };
                }
                $bodyScope.saveFolder();
            }, 1000);
        };

        var inspectorCategoryDescriptionChangeTimeout;
        $scope.inspectorCategoryDescriptionChange = function () {
            const description = eagle.inspector.category.newDescription;
            let target;
            if (eagle.inspector.inspectorFolder) {
                target = eagle.inspector.inspectorFolder;
            }
            else {
                target = $scope.currentSmartFolder;
            }
            if (target) {
                target.description = description;
            }
            $timeout.cancel(inspectorCategoryDescriptionChangeTimeout);
            inspectorCategoryDescriptionChangeTimeout = $timeout(() => {
                $bodyScope.saveFolder();
            }, 1000);
        };

        $scope.annotationChange = function() {
            let annotation = eagle.inspector.newAnnotation;
            annotation = annotation.substr(0, 20480);
            annotation = _.unescape(annotation);

            const items = [...$scope.selected];

            $bodyScope.checkOperationSafety(() => {
                items.forEach((image) => {
                    image.annotation = annotation;
                });
                ayncsImagesChange(items);
                hiddenByCurrentFilter(items);
                $bodyScope.rebindRefresh(true);
                electronLog.info(`[app] Change file comemnt, total: ${items.length} files`);
            });
        };

        $scope.urlChange = () => {
            $bodyScope.checkOperationSafety(() => {
            
                let changedItems = [];

                $scope.selected.forEach(function(image) {

                    let hasChanged = false;

                    if (typeof eagle.inspector.newUrl === "string" && image.url !== eagle.inspector.newUrl) {
                        if (is.url(eagle.inspector.newUrl) || eagle.inspector.newUrl == "" || eagle.inspector.newUrl.indexOf("file://") === 0) {
                            image.url = eagle.inspector.newUrl;
                            hasChanged = true;
                        }
                        else if (fs.existsSync(eagle.inspector.newUrl)) {
                            image.url = eagle.inspector.newUrl;
                            hasChanged = true;
                        }
                        else if (eagle.inspector.newUrl.indexOf("://") > -1) {
                            image.url = eagle.inspector.newUrl;
                            hasChanged = true;
                        }
                    }

                    let cloneImage = angular.copy(image);
                    if (hasChanged) {
                        changedItems.push(cloneImage);
                        $bodyScope.updateItemView(cloneImage);

                        if (!$bodyScope.modifiedMappings[image.id]) {
                            $bodyScope.modifiedMappings[image.id] = 1;
                        }
                        else {
                            $bodyScope.modifiedMappings[image.id]++;
                        }
                    }
                });

                if (changedItems.length > 0) {
                    ayncsImagesChange(changedItems);
                    hiddenByCurrentFilter(changedItems);

                    electronLog.info(`[app] Change items info from inspctor, total: ${$scope.selected.length} files`);

                    // 避免修改影片名稱造成影片重頭播放
                    if ($bodyScope.isDetailMode) {
                        $bodyScope.rememberVideoCurrentTime($scope.current);
                        if ($("#font-viewer").length > 0) {
                            $("iframe#font-viewer").contents().find(".font-name span").text(eagle.inspector.newName);
                        }
                    }
                    $bodyScope.rebindRefresh(true);
                }
            });
        };


        $scope.$on("UPDATE_INSPECTOR", () => {
            $scope.updateSelection();
        });

        var updateSelectionTimeout;
        $scope.updateSelection = function() {

            $timeout.cancel(updateSelectionTimeout);
            updateSelectionTimeout = $timeout(function() {

                var selected = $scope.selected;
                if (selected.length > 1) {
                    $scope.inspector.newNamePlaceholder = i18n.__("inspector.names.multipleTitles");
                    $scope.inspector.newUrlPlaceholder = i18n.__("inspector.names.multipleUrls");
                    $scope.inspector.newName = eagle.inspector.calculateName(selected);
                    $scope.inspector.newUrl = eagle.inspector.calculateUrl(selected);
                    $scope.inspector.newTags = eagle.inspector.calculateTags(selected);
                    $scope.inspector.newAnnotation = eagle.inspector.calculateAnnotation(selected);
                    $scope.inspector.folders = eagle.inspector.calculateFolders(selected);
                    $scope.inspector.star = eagle.inspector.calculateStar(selected);
                    $scope.inspector.size = eagle.inspector.calculateFileSize(selected);
                    $scope.inspector.activeTab = "ITEM";
                } else if (selected.length == 1) {
                    if (selected[0]) {
                        $scope.inspector.newNamePlaceholder = $filter('i18n')("title");
                        $scope.inspector.newUrlPlaceholder = "http://";
                        $scope.inspector.newName = selected[0].name || "";
                        $scope.inspector.newUrl = selected[0].url || "";
                        $scope.inspector.newTags = selected[0].tags;
                        $scope.inspector.newAnnotation = selected[0].annotation || "";
                        $scope.inspector.folders = [];
                        $scope.inspector.star = selected[0].star || 0;
                        $scope.inspector.activeTab = "ITEM";
                    }
                }
                else {
                    $scope.inspector.activeTab = "SIDEBAR";
                    switch ($scope.viewMode) {
                        case "all":
                            $scope.inspector.category = {
                                newName: i18n.__('inspector.names.all'),
                                newDescription: "",
                                createDate: undefined,
                                imageCount: $bodyScope.all.length,
                                fileSize: eagle.inspector.calculateFileSize($bodyScope.all),
                                exportable: false,
                                editable: false
                            };
                            break;
                        case "unfiled":
                            $scope.inspector.category = {
                                newName: i18n.__('inspector.names.unfiled'),
                                newDescription: "",
                                createDate: undefined,
                                imageCount: $bodyScope.unfiledCount,
                                fileSize: eagle.inspector.calculateFileSize($bodyScope.allData),
                                exportable: false,
                                editable: false
                            };
                            break;
                        case "untagged":
                            $scope.inspector.category = {
                                newName: i18n.__('inspector.names.untagged'),
                                newDescription: "",
                                createDate: undefined,
                                imageCount: $bodyScope.untaggedCount,
                                fileSize: eagle.inspector.calculateFileSize($bodyScope.allData),
                                exportable: false,
                                editable: false
                            };
                            break;
                        case "trash":
                            $scope.inspector.category = {
                                newName: i18n.__('inspector.names.trash'),
                                newDescription: "",
                                createDate: undefined,
                                imageCount: $bodyScope.allData.length,
                                fileSize: eagle.inspector.calculateFileSize($bodyScope.allData),
                                exportable: false,
                                editable: false
                            };
                            break;
                        case "duplicate":
                            $scope.inspector.category = {
                                newName: $filter('i18n')('inspector.names.duplicate'),
                                newDescription: "",
                                createDate: undefined,
                                imageCount: $bodyScope.allData.length,
                                fileSize: eagle.inspector.calculateFileSize($bodyScope.allData),
                                exportable: false,
                                editable: false
                            };
                            break;
                        default:
                            if ($rootScope.selectedFolders.length > 0) {
                                $scope.inspector.category = {
                                    newName: i18n.__('inspector.names.multipleTitles'),
                                    newDescription: "",
                                    createDate: undefined,
                                    imageCount: $bodyScope.allData.length,
                                    fileSize: eagle.inspector.calculateFileSize($bodyScope.allData),
                                    exportable: false,
                                    editable: false
                                };
                            }
                            else if ($scope.selectedFolderMappings && Object.keys($scope.selectedFolderMappings).length >= 1) {
                                var selectedFolders = Object.keys($scope.selectedFolderMappings).map(function(key) {
                                    return key;
                                });
                                if (selectedFolders[0] && $scope.folderMappings[selectedFolders[0]]) {
                                    eagle.inspector.inspectorFolder = $scope.folderMappings[selectedFolders[0]];
                                    $scope.inspector.category = {
                                        newName: eagle.inspector.inspectorFolder.name,
                                        newDescription: eagle.inspector.inspectorFolder.description || "",
                                        createDate: eagle.inspector.inspectorFolder.modificationTime,
                                        imageCount: eagle.inspector.inspectorFolder.imageCount,
                                        fileSize: undefined,
                                        exportable: !(eagle.inspector.inspectorFolder.password && !eagle.inspector.inspectorFolder.isUnLock),
                                        editable: !(eagle.inspector.inspectorFolder.password && !eagle.inspector.inspectorFolder.isUnLock)
                                    };
                                }
                            }
                            else if ($scope.currentFolder) {
                                eagle.inspector.inspectorFolder = $scope.currentFolder;
                                $scope.inspector.category = {
                                    newName: eagle.inspector.inspectorFolder.name,
                                    newDescription: eagle.inspector.inspectorFolder.description || "",
                                    createDate: eagle.inspector.inspectorFolder.modificationTime,
                                    imageCount: $bodyScope.allData.length,
                                    fileSize: eagle.inspector.calculateFileSize($bodyScope.allData),
                                    exportable: true,
                                    editable: true
                                };
                            }
                            else if ($scope.currentSmartFolder) {
                                $scope.inspector.category = {
                                    newName: $scope.currentSmartFolder.name,
                                    newDescription: $scope.currentSmartFolder.description || "",
                                    createDate: $scope.currentSmartFolder.modificationTime,
                                    imageCount: $bodyScope.allData.length,
                                    fileSize: eagle.inspector.calculateFileSize($bodyScope.allData),
                                    exportable: true,
                                    editable: true
                                };
                            }
                    }
                }

                // 排序標籤，優先使用群組順序排，皆者使用字母順序排
                if ($scope.inspector.newTags.length > 0) {
                    $scope.inspector.newTags = sortTags($scope.inspector.newTags);
                }
            }, 30);
        };

        function sortTags(original) {
            try {
                if (!original || original.length === 0) return;
                let tags = [...original];

                const tagGroupsIndexMap = {};
                $scope.TagManager.groups.forEach((tagGroup, index) => {
                    tagGroupsIndexMap[tagGroup.id] = index;
                });

                tagGroupsIndexMap['none'] = $scope.TagManager.groups.length;

                tags = tags.sort((tagA, tagB) => {
                    const a = $scope.TagManager.tagMappings[tagA];
                    const b = $scope.TagManager.tagMappings[tagB];
                    const aName = a.name;
                    const bName = b.name;
                    const aGroup = a?.groups?.[0] || 'none';
                    const bGroup = b?.groups?.[0] || 'none';
                    
                    // sort by groups index, if same group, sort by name
                    if (tagGroupsIndexMap[aGroup] < tagGroupsIndexMap[bGroup]) return -1;
                    if (tagGroupsIndexMap[aGroup] > tagGroupsIndexMap[bGroup]) return 1;
                    if (aName < bName) return -1;
                    if (aName > bName) return 1;
                    return 0;
                });

                return tags;
            } catch (err) {
                console.error(err);
                return original;
            }
        }

        $scope.setFolderPassword = function (folder) {
            if (!folder) return;
            $rootScope.$broadcast("SET-FOLDER-PASSWORD", {
                folder: folder,
                mode: 'new'
            });
        };

        $scope.changeFolderPassword = function (folder) {
            if (!folder) return;
            $rootScope.$broadcast("SET-FOLDER-PASSWORD", {
                folder: folder,
                mode: 'change'
            });
        };

        $scope.resetFolderPassword = function (folder) {
            if (!folder) return;
            $rootScope.$broadcast("SET-FOLDER-PASSWORD", {
                folder: folder,
                mode: 'reset'
            });
        };

        $scope.openInspectorTagSelectPanel = () => {
            $bodyScope.openInspectorTagSelectPanel();
        };

        $scope.openInspectorFolderSelectPanel = () => {
            $bodyScope.openInspectorFolderSelectPanel();
        };

        $scope.openFolderExportContextMenu = (event, folder) => {
            $bodyScope.openFolderExportContextMenu(event, folder);
        };

        $scope.openSmartFolderExportContextMenu = (event, smartFolder) => {
            $bodyScope.openSmartFolderExportContextMenu(event, smartFolder);
        };

        $scope.openColorContextMenu = (palette) => {
            $bodyScope.openColorContextMenu(palette);
        };

        $scope.filterWithColor = (color, ignoreHistory) => {
            $bodyScope.filterWithColor(color, ignoreHistory);
        };

        $scope.openTrialModal = (trialRemain) => {
            $bodyScope.openTrialModal(trialRemain);
        };

        $scope.rgbToHex = function(r, g, b) {
            if (r === undefined) {
                return false;
            }
            return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
        }

        $scope.getLastestThumbnailPath = function (image) {
        	return FileUrlHelper.getLastestThumbnailUrl(image);
        };

        $scope.getThumbnailUrl = function (image) {
            return FileUrlHelper.getThumbnailUrl(image);
        };

        $scope.getExifPath = function (image) {
            if (image) {
                return `./exif-viewer/index.html?orientation=${image.orientation}&path=${encodeURIComponent(FileUrlHelper.getLastestThumbnailUrl(image))}&width=${image.width}&height=${image.height}`;
            }
        };

        $scope.tagsInputMouseDown = (event, tag) => {
            if (event.button === 2) {
                event.stopPropagation();
                event.preventDefault();
                let items = [];
                if (tag) {
                    items = [
                        // 篩選
                        {
                            label: i18n.__("Context.Tag.FilterWithTags"),
                            icon: 'ic-tag-filter.svg',
                            click: () => {
                                $scope.TagManager.filterWithTags([tag]);
                                $scope.$evalAsync();
                            }
                        },
                        {
                            role: 'separator'
                        },
                        // 重命名
                        {
                            label: i18n.__("Context.Tag.Edit.Title"),
                            icon: 'ic-rename.svg',
                            click: () => {
                                $bodyScope.editTag($scope.TagManager.tagMappings[tag]);
                                $bodyScope.$evalAsync();
                            }
                        },
                        // 複製
                        {
                            disabled: !(eagle.inspector?.newTags?.length > 0),
                            label: i18n.__('context.tagInput.copyTag'),
                            icon: 'ic-tag-copy.svg',
                            click: () => { 
                                eagle.inspector.copyTags([tag]);
                                $bodyScope.notify({
                                    message: i18n.__("Context.Tag.Copy.Success"),
                                    duration: 750
                                });
                                $bodyScope.$evalAsync();
                            }
                        },
                        // 貼上
                        {
                            disabled: !eagle.inspector.copiedTags,
                            label: i18n.__('context.tagInput.pasteTag'),
                            icon: 'ic-tag-paste.svg',
                            click: () => { $bodyScope.pasteTags(); }
                        }
                    ];
                }
                else {
                    items = [
                        // 複製貼上清除
                        {
                            disabled: !(eagle?.inspector?.newTags?.length > 0),
                            label: i18n.__('context.tagInput.copyTag'),
                            icon: 'ic-tag-copy.svg',
                            accelerator: preferences.shortcuts.keybinds['organize.tag.copy'],
                            click: () => { $bodyScope.copyTags(); }
                        },
                        {
                            disabled: !eagle.inspector.copiedTags,
                            label: i18n.__('context.tagInput.pasteTag'),
                            icon: 'ic-tag-paste.svg',
                            accelerator: preferences.shortcuts.keybinds['organize.tag.paste'],
                            click: () => { $bodyScope.pasteTags(); }
                        },
                        { role: 'separator' },
                        {
                            label: i18n.__("context.tagInput.clearTag"),
                            icon: 'ic-tag-empty.svg',
                            accelerator: preferences.shortcuts.keybinds['organize.tag.clear'],
                            click: () => { 
                                $bodyScope.clearAllTags();
                                $bodyScope.$evalAsync();
                            }
                        }
                    ];
                }
                ContextMenu.open({
                    items: items,
                    showSearch: false,
                });
            }
        };

        $scope.imageCommentsSortableOptions = {
            distance: 5,
            tolerance: "pointer",
            disabled: false,
			helper : 'clone',
            update: function(e, ui) {
                if ($scope.selected[0]) {
                    ayncsImagesChange([$scope.selected[0]]);
                    try { electronLog && electronLog.info(`[app] Sort item's annotations: ${$scope.selected[0].id}`); } catch (err) {};
                }
            },
        };

        $scope.copyComment = function(event, image, comment) {
            if (comment && comment.annotation) {
                clipboard.writeText(_.unescape(comment.annotation));
                $bodyScope.notify({
                    message: i18n.__("previewWindow.copied"),
                    duration: 750
                });
            }
        };

        $scope.openComment = function(event, image, comment) {
            if (!$bodyScope.isDetailMode) {
                $bodyScope.enterDetailMode(event, image);
                $timeout(function () {
                    $bodyScope.openComment(event, image, comment);
                }, 500);
                return;
            }

            // 自动滚动到 annotation 处
            // 如果超過才滾動
            if (comment && comment.y) {
                let $commentElem = $(`#comment-${comment.id}`);
                if ($commentElem.length > 0 && !isElementInViewport($commentElem[0])) {
                    var offsetY = -200;
                    $("#detail-container").smoothZoom('goToY', -(comment.y + offsetY) * $bodyScope.imageSize.zoomRatio / 100);
                    setTimeout(function () {
                        AnnotationPreview.show();
                    }, 100);
                }
            }
        };

        $scope.highlightAnnotation = function(event, comment) {
            if ($bodyScope.isDetailMode && comment) {
                var $comment = $(`#comment-${comment.id}`);
                $comment.addClass("highlight");
                AnnotationPreview.lastElem = $comment[0];
			    AnnotationPreview.hoverTimeout = setTimeout(function () {
			    	AnnotationPreview.show();
			    }, 200);
            }
        };

        $scope.removeHighlightAnnotation = function(event, comment) {
            if ($bodyScope.isDetailMode && comment) {
                var $comment = $(`#comment-${comment.id}`);
                $comment.removeClass("highlight");
                clearTimeout(AnnotationPreview.hoverTimeout);
			    if (AnnotationPreview.lastElem) {
			        AnnotationPreview.hide();
			    }
            }
        };

        $scope.editVideoComment = (event, image, comment) => {
            // event.stopPropagation();

            if (!$bodyScope.isDetailMode) {
                $bodyScope.enterDetailMode(event, image);
                $timeout(function () {
                    $scope.editVideoComment(event, image, comment);
                }, 500);
                return;
            }

            var video = $(".detail-wrap video")[0] || $(".detail-wrap mpv-video")[0];
            if (video) {
                video.currentTime = comment.duration;
                video.pause();
            }

            swal({
                html: `
                    <div class="alert">
                        <div class="alert-icon create"></div>
                        <h4 class="alert-title">${i18n.__('dialog.videoComment.title')}</h4>
                    </div>
                `,
                input: 'textarea',
                inputPlaceholder: i18n.__("dialog.videoComment.placeholder"),
                inputValue: comment.annotation,
                allowEnterKey: false,
                showCloseButton: false,
                showCancelButton: true,
                allowOutsideClick: false,
                focusConfirm: false,
                focusCancel: false,
                padding: 10,
                position: 'bottom',
                width: 400,
                customClass: "alert-box",
                cancelButtonColor: "#777777",
                confirmButtonText: i18n.__("dialog.videoComment.save"),
                cancelButtonText: i18n.__("general.cancel"),
            }).then((result) => {
                if (!result) return;
                comment.annotation = result;
                ipcRenderer.send('image-change', image);
                $rootScope.$broadcast("REFRESH_VIDEO_COMMENTS");
                $bodyScope.updateItemView(video);
                $bodyScope.$evalAsync();
            });
        };

        $scope.openVideoComment = (event, image, comment) => {
            if (!$bodyScope.isDetailMode) {
                $bodyScope.enterDetailMode(event, image);
                $timeout(function () {
                    $scope.openVideoComment(event, image, comment);
                }, 500);
                return;
            }
            if (VIDEO_TYPES[$scope.current.ext] || AUDIO_TYPES[$scope.current.ext]) {
                var video = $(".detail-wrap video")[0] || $(".detail-wrap mpv-video")[0];
                if (video && comment.duration !== undefined) {
                    video.currentTime = comment.duration;
                }
            }
        };

        $scope.removeVideoComment = (event, video, comment) => {
            event.stopPropagation();
            if (video.comments) {
                var idx = video.comments.indexOf(comment);
                if (idx > -1) {

                    var originComments = angular.copy(video.comments);

                    video.comments.splice(idx, 1);
                    ipcRenderer.send('image-change', video);
                    $bodyScope.updateItemView(video);
                    $rootScope.$broadcast("REBIND_REFRESH", true);
                    $rootScope.$broadcast("REFRESH_VIDEO_COMMENTS");

                    electronLog && electronLog.info(`[app] Remove video annotation: ${video.name}(${video.id})`);

                    var message = $filter('i18n')("notify.annotation.remove");
                    // 復原
                    $rootScope.notify({
                        message: message,
                        duration: 4000,
                    }, function () {
                        video.comments = originComments;
                        $rootScope.$broadcast("REBIND_REFRESH", true);
                        $rootScope.$broadcast("REFRESH_VIDEO_COMMENTS");
                        $bodyScope.updateItemView(video);
                        ipcRenderer.send('image-change', video);
                    });
                }
            }
        }

        $scope.removeComment = (item, index) => {
            const originComments = angular.copy(item.comments);

            item.comments.splice(index, 1);
            $rootScope.$broadcast("REBIND_REFRESH", true);
            ipcRenderer.send('image-change', item);

            electronLog && electronLog.info(`[app] Remove image annotation: ${item.name}(${item.id})`);

            const message = $filter('i18n')("notify.annotation.remove");
            // 復原
            $rootScope.notify({
                message: message,
                duration: 4000,
            }, () => {
                item.comments = originComments;
                $rootScope.$broadcast("REBIND_REFRESH", true);
                ipcRenderer.send('image-change', item);
            });
            AnnotationPreview.blur();
            AnnotationPreview.hide();
        };

        $scope.openHelpContextMenu = () => {
            ContextMenu.open({
                items: [
                    {
                        label: i18n.__('appmenu.app>about'),
                        icon: 'ic-eagle-logo.svg',
                        keywords: 'about アバウト 关于',
                        click: () => {
                            $rootScope.$broadcast("OPEN_ABOUT_PANEL");
                            $scope.$evalAsync;
                        }
                    },
                    {
                        label: i18n.__('appmenu.app>checkUpdate'),
                        icon: 'ic-check-for-update.svg',
                        keywords: 'check update 检查更新 檢查更新 アップデート',
                        click: () => {
                            IPCHelper.send('check-for-update', {
                                machineID: machineID,
                                showAlredy: true,
                            });
                        }
                    },
                    {
                        label: i18n.__('appmenu.app>preferences'),
                        icon: 'ic-settings.svg',
                        keywords: 'preferences 偏好设置 偏好設置 設定 設置 settings',
                        accelerator: preferences.shortcuts.keybinds['app.preferences'] || 'CmdOrCtrl+,',
                        enabled: !$rootScope.isAppLocked,
                        click: () => {
                            if ($rootScope.isAppLocked) return;
                            ipcRenderer.send('open.preferences');
                        }
                    },
                    { role: 'separator' },
                    {
                        label: i18n.__("appmenu.help>helpCenter"),
                        icon: 'ic-help.svg',
                        keywords: 'help center 帮助中心 帮助中心 ヘルプセンター',
                        click: () => { $bodyScope.openHelpCenter(); }
                    },
                    {
                        label: i18n.__("appmenu.help>openTips"),
                        icon: 'ic-tips.svg',
                        keywords: 'tips 小技巧 小技巧 ヒント',
                        click: () => { $bodyScope.openGetStarted(); }
                    },
                    {
                        label: i18n.__('appmenu.help>shortcuts'),
                        icon: 'ic-shortcuts.svg',
                        keywords: 'shortcuts 快捷键 ショートカット',
                        click: () => { 
                            ipcRenderer.send('open.preferences', {
                                panel: "shortcuts"
                            });
                        }
                    },
                    { role: 'separator' },
                    // {
                    //     label: i18n.__('appmenu.help>roadmap'),
                    //     icon: 'ic-roadmap.svg',
                    //     keywords: 'roadmap 路线图 ロードマップ',
                    //     click: () => { $bodyScope.openRoadmap(); }
                    // },
                    {
                        label: i18n.__('appmenu.help>privacy'),
                        icon: 'ic-privacy.svg',
                        keywords: 'privacy 隐私 プライバシー',
                        click: () => { $bodyScope.openPrivacy(); }
                    },
                    {
                        label: "Eagle API",
                        icon: 'ic-developer.svg',
                        keywords: 'api developer 開發者 開發者 開発者',
                        click: () => { $bodyScope.openAPIDocument(); }
                    },
                    {
                        label: "Twitter - @eagle_app",
                        icon: 'ic-twitter.svg',
                        keywords: 'twitter social media 社交媒体 社交媒體 ソーシャルメディア',
                        click: () => { $bodyScope.openTwitter(); }
                    }
                ],
                showSearch: true,
            });
        }

    }
}));