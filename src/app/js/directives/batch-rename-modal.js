EagleApp.directive('batchRenameModal', function ($timeout, $rootScope, $filter) {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/batch-rename-modal.html',
        scope: {},
        link: function ($scope, element, attrs, controllersArr) {

            $scope.isOpen = false;
            $scope.isRenaing = false;
            $scope.startAt = 1;
            $scope.previews = [];
            $scope.newName = "";

            $scope.findString = "";
            $scope.replaceString = "";
            $scope.replaceMethod = "format";

            $scope.type = "";   // IMAGE, FOLDER, TAG, SMART_FOLDER
            $scope.items;
            $scope.findStringHistory = [];
            $scope.showFindStringAutocomplete = false;
            $scope.selectedHistoryIndex = -1;
            $scope.textCase = "none"; // 文本大小寫樣式默認值

            $scope.$on("OPEN_RENAME", (e, params) => {

                $scope.type = params.type;
                switch ($scope.type) {
                    case "IMAGE":
                        $scope.items = params.images;
                        $scope.newName = `${i18n.__('general.untitled.newName')} - %N`;
                        if (localStorage.getItem("BATCH_RENAME_LAST_NAME")) {
                            $scope.newName = localStorage.getItem("BATCH_RENAME_LAST_NAME");
                        }
                        break;
                    case "FOLDER":
                    case "SMART_FOLDER":
                        $scope.items = params.folders;
                        $scope.newName = `${i18n.__('general.untitled.newName')} - %N`;
                        break;
                    case "TAGS":
                        $scope.items = params.tags;
                        $scope.newName = `*`;
                        break;
                }

                if ($scope.items && $scope.items.length) {
                    $scope.isOpen = true;
                    $scope.isRenaing = false;
                    $scope.updatePreview();
                    $scope.findStringHistory = getFindStringHistory($scope.type);
                    setTimeout(function () {
                        $(".batch-rename-modal input[type='text']").first().focus();
                    }, 200);
                }
            });

            // 監聽名稱、開始編號
            $scope.$watch("[newName, startAt]", () => {
                if (!is.number($scope.startAt)) { $scope.startAt = 1; }
                if ($scope.startAt < 0) { $scope.startAt = 0; }
                $scope.updatePreview();
            });

            // 監聽取代字串
            $scope.$watch("[findString, replaceString]", () => {
                try {
                    $scope.regex = createRegexFromString($scope.findString);
                    $scope.isRegex = true;
                } catch (e) {
                    $scope.isRegex = false
                }
                $scope.updatePreview();
            });

            $scope.changeReplaceMethod = (mode) => {
                $scope.replaceMethod = mode;
                $scope.updatePreview();
                setTimeout(() => {
                    $scope.focusInput();
                }, 100);
            };

            $scope.focusInput = () => {
                setTimeout(() => {
                    $(".batch-rename-modal").find("input:visible").eq(0).focus();
                }, 24);
            };

            function createRegexFromString(regexString) {
                // Match the pattern and the flags within the slashes.
                const match = regexString.match(/^\/(.+)\/([a-z]*)$/);
                if (!match) {
                  throw new Error("Invalid regex format");
                }
              
                // Extract pattern and flags from the regex string
                const [_, pattern, flags] = match;
              
                // Return the RegExp object
                return new RegExp(pattern, flags);
              }

            $scope.updatePreview = () => {

                const newName = $scope.newName || "";
                const newNameLower = newName.toLowerCase();

                const getBeforeHTML = (name) => {
                    // 如果原始文字出現 $scope.findString，就將一樣的字串加上刪除線
                    if ($scope.findString) {
                        let findString = escapeRegExp($scope.findString);
                        if ($scope.isRegex) {
                            name = name.replace($scope.regex, `<s>$&</s>`).replaceAll(/\\/g, '');
                        }
                        else {
                            name = name.replace(new RegExp(findString, "g"), `<s>${findString}</s>`).replaceAll(/\\/g, '');
                        }
                    }
                    return name;
                };

                const getAfterHTML = (name) => {
                    // 如果原始文字出現 $scope.replaceString，就將一樣的字串加上<b></b>
                    $scope.replaceString = $scope.replaceString || "";
                    let replaceString = escapeRegExp($scope.replaceString);
                    if ($scope.isRegex) {
                        name = name.replace($scope.regex, `<b>${replaceString}</b>`).replaceAll(/\\/g, '');
                    }
                    else {
                        name = name.replace(new RegExp(replaceString, "g"), `<b>${replaceString}</b>`).replaceAll(/\\/g, '');
                    }
                    return name;
                };

                const escapeRegExp = (string) => {
                    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                };

                if (!$scope.items) return;
                $scope.previews = [];
                if ($scope.replaceMethod === "format") {
                    $scope.previews = $scope.items.map((item, index) => {
                        let formattedName = format(item, newName, {
                            originName: item.name,
                            idx: index + parseInt($scope.startAt)
                        });
                        
                        // 應用大小寫轉換
                        formattedName = $scope.applyTextCase(formattedName);
                        
                        return {
                            item: item,
                            thumbnail: ($scope.type === "IMAGE" ? FileUrlHelper.getLastestThumbnailUrl(item) : null),
                            before: item.name,
                            after: formattedName
                        };
                    });
                }
                else {
                    $scope.previews = $scope.items.map((item, index) => {
                        let replacedName;
                        if ($scope.isRegex) {
                            replacedName = item.name.replace($scope.regex, $scope.replaceString);
                        } else {
                            replacedName = item.name.split($scope.findString).join($scope.replaceString);
                        }
                        
                        // 應用大小寫轉換
                        replacedName = $scope.applyTextCase(replacedName);
                        
                        return {
                            item: item,
                            thumbnail: ($scope.type === "IMAGE" ? FileUrlHelper.getLastestThumbnailUrl(item) : null),
                            before: getBeforeHTML(item.name),
                            after: getAfterHTML(replacedName)
                        };
                    });
                }

                $scope.hasIndex = newNameLower.indexOf("%n") > -1;
                $scope.hasDate = newNameLower.indexOf("%d") > -1 || 
                                newNameLower.indexOf("%m") > -1 || 
                                newNameLower.indexOf("%b") > -1;
                $scope.hasTags = newNameLower.indexOf("%t") > -1;
                $scope.hasFolders = newNameLower.indexOf("%f") > -1;
                $scope.hasOriginal = newNameLower.indexOf("*") > -1;
            }

            // 快速鍵綁定
            $scope.onKeydown = (event) => {
                var keyCode = event.keyCode;
                if (keyCode === 27) {
                    event.preventDefault();
                    event.stopPropagation();
                    $scope.cancel();
                }
                else if (keyCode === 13) {
                    if (event.metaKey || event.ctrlKey) {
                        event.preventDefault();
                        event.stopPropagation();
                        if ($scope.replaceMethod !== "format") {
                            if (!$scope.findString) return;
                        }
                        else {
                            if (!$scope.newName || !is.number($scope.startAt)) return;
                        }
                        $(event.target).blur();
                        $scope.rename();
                    }
                }
            };

            $scope.insertIndex = () => {
                const item = $scope.items[0];
                const items = ["%N", "%NN", "%NNN", "%NNNN"].map((label) => {
                    return {
                        label: format(item, $scope.newName + label, {
                            originName: item.name,
                            idx: parseInt($scope.startAt)
                        }),
                        accelerator: label,
                        click: () => {
                            $scope.newName += label;
                            $scope.$evalAsync();
                        }
                    };
                });

                ContextMenu.open({
                    items: items,
                    showSearch: false,
                    onClosed: () => {
                        $scope.focusInput();
                    }
                });
            };

            $scope.insertDate = () => {
                const item = $scope.items[0];
                
                // 導入時間選項
                const currentDateItems = ["%D", "%DD", "%DDD", "%DHM", "%DHMS"].map((label) => {
                    return {
                        label: format(item, $scope.newName + label, {
                            originName: item.name,
                            idx: parseInt($scope.startAt)
                        }),
                        accelerator: label,
                        click: () => {
                            $scope.newName += label;
                            $scope.$evalAsync();
                        }
                    };
                });
                
                // 創建時間選項
                const createdDateItems = ["%B", "%BB", "%BBB", "%BHM", "%BHMS"].map((label) => {
                    return {
                        label: format(item, $scope.newName + label, {
                            originName: item.name,
                            idx: parseInt($scope.startAt)
                        }),
                        accelerator: label,
                        click: () => {
                            $scope.newName += label;
                            $scope.$evalAsync();
                        }
                    };
                });
                
                // 修改時間選項
                const modifiedDateItems = ["%M", "%MM", "%MMM", "%MHM", "%MHMS"].map((label) => {
                    return {
                        label: format(item, $scope.newName + label, {
                            originName: item.name,
                            idx: parseInt($scope.startAt)
                        }),
                        accelerator: label,
                        click: () => {
                            $scope.newName += label;
                            $scope.$evalAsync();
                        }
                    };
                });
                
                // 組合所有選項
                const items = [
                    { role: 'label', label: i18n.__("inspector.props.createAt") },
                    ...currentDateItems,
                    { role: 'separator' },
                    { role: 'label', label: i18n.__("inspector.props.btime") },
                    ...createdDateItems,
                    { role: 'separator' },
                    { role: 'label', label: i18n.__("inspector.props.mtime") },
                    ...modifiedDateItems,
                ];


                ContextMenu.open({
                    items: items,
                    showSearch: false,
                    onClosed: () => {
                        $scope.focusInput();
                    }
                });
            };

            $scope.insertTags = () => {
                const item = $scope.items[0];
                const items = ["%T"].map((label) => {
                    return {
                        label: format(item, $scope.newName + label, {
                            originName: item.name,
                            idx: parseInt($scope.startAt)
                        }),
                        accelerator: label,
                        click: () => {
                            $scope.newName += label;
                            $scope.$evalAsync();
                        }
                    };
                });

                ContextMenu.open({
                    items: items,
                    showSearch: false,
                    onClosed: () => {
                        $scope.focusInput();
                    }
                });
            };

            $scope.insertFolders = () => {
                const item = $scope.items[0];
                const items = ["%F"].map((label) => {
                    return {
                        label: format(item, $scope.newName + label, {
                            originName: item.name,
                            idx: parseInt($scope.startAt)
                        }),
                        accelerator: label,
                        click: () => {
                            $scope.newName += label;
                            $scope.$evalAsync();
                        }
                    };
                });

                ContextMenu.open({
                    items: items,
                    showSearch: false,
                    onClosed: () => {
                        $scope.focusInput();
                    }
                });
            };

            $scope.insertOriginal = () => {
                const item = $scope.items[0];
                const items = ["*"].map((label) => {
                    return {
                        label: format(item, $scope.newName + label, {
                            originName: item.name,
                            idx: parseInt($scope.startAt)
                        }),
                        accelerator: label,
                        click: () => {
                            $scope.newName += label;
                            $scope.$evalAsync();
                        }
                    };
                });

                ContextMenu.open({
                    items: items,
                    showSearch: false,
                    onClosed: () => {
                        $scope.focusInput();
                    }
                });
            };

            function format(item, name, options) {
                const moment = require('moment');
                var originName = options.originName;
                var idx = options.idx;
                var now = new Date();
                
                // 現有的日期格式
                var date1 = moment(now).format("YYYY-MM-DD");
                var date2 = moment(now).format("MM-DD");
                var date3 = moment(now).format("ll");
                var dateHM = moment(now).format("YYYY-MM-DD HH_mm");
                var dateHMS = moment(now).format("YYYY-MM-DD HH_mm_ss");
                
                // 新增修改時間和創建時間
                var modifiedTime = item.mtime ? new Date(item.mtime) : (item.modificationTime ? new Date(item.modificationTime) : now);
                var createdTime = item.btime ? new Date(item.btime) : (item.modificationTime ? new Date(item.modificationTime) : now);
                
                // 現有的日期格式
                var mTime1 = moment(modifiedTime).format("YYYY_MM_DD");
                var mTime2 = moment(modifiedTime).format("MM_DD");
                var mTime3 = moment(modifiedTime).format("ll");
                var mTimeHM = moment(modifiedTime).format("YYYY_MM_DD HH_mm");
                var mTimeHMS = moment(modifiedTime).format("YYYY_MM_DD HH_mm_ss");
                
                var bTime1 = moment(createdTime).format("YYYY_MM_DD");
                var bTime2 = moment(createdTime).format("MM_DD");
                var bTime3 = moment(createdTime).format("ll");
                var bTimeHM = moment(createdTime).format("YYYY_MM_DD HH_mm");
                var bTimeHMS = moment(createdTime).format("YYYY_MM_DD HH_mm_ss");
                
                var newName = name;
                try {
                    newName = newName.replace(/%NNNNNNNNN+/i, $filter('numberFixedLen')(idx, 9));
                    newName = newName.replace(/%nnnnnnnnn+/i, $filter('numberFixedLen')(idx, 9));
                    newName = newName.replace(/%NNNNNNNNN/i, $filter('numberFixedLen')(idx, 8));
                    newName = newName.replace(/%nnnnnnnnn/i, $filter('numberFixedLen')(idx, 8));
                    newName = newName.replace(/%NNNNNNNN/i, $filter('numberFixedLen')(idx, 8));
                    newName = newName.replace(/%nnnnnnnn/i, $filter('numberFixedLen')(idx, 8));
                    newName = newName.replace(/%NNNNNNN/i, $filter('numberFixedLen')(idx, 7));
                    newName = newName.replace(/%nnnnnnn/i, $filter('numberFixedLen')(idx, 7));
                    newName = newName.replace(/%NNNNNN/i, $filter('numberFixedLen')(idx, 6));
                    newName = newName.replace(/%nnnnnn/i, $filter('numberFixedLen')(idx, 6));
                    newName = newName.replace(/%NNNNN/i, $filter('numberFixedLen')(idx, 5));
                    newName = newName.replace(/%nnnnn/i, $filter('numberFixedLen')(idx, 5));
                    newName = newName.replace(/%NNNN/i, $filter('numberFixedLen')(idx, 4));
                    newName = newName.replace(/%nnnn/i, $filter('numberFixedLen')(idx, 4));
                    newName = newName.replace(/%NNN/i, $filter('numberFixedLen')(idx, 3));
                    newName = newName.replace(/%nnn/i, $filter('numberFixedLen')(idx, 3));
                    newName = newName.replace(/%NN/i, $filter('numberFixedLen')(idx, 2));
                    newName = newName.replace(/%nn/i, $filter('numberFixedLen')(idx, 2));
                    newName = newName.replace(/%N/i, $filter('numberFixedLen')(idx, 1));
                    newName = newName.replace(/%n/i, $filter('numberFixedLen')(idx, 1));
                    newName = newName.replace(/%DDD+/i, date3);
                    newName = newName.replace(/%DDD/i, date3);
                    newName = newName.replace(/%DD/i, date2);
                    newName = newName.replace(/%DHMS/i, dateHMS);
                    newName = newName.replace(/%DHM/i, dateHM);
                    newName = newName.replace(/%D/i, date1);
                    newName = newName.replace(/%ddd+/i, date3);
                    newName = newName.replace(/%ddd/i, date3);
                    newName = newName.replace(/%dd/i, date2);
                    newName = newName.replace(/%dhms/i, dateHMS);
                    newName = newName.replace(/%dhm/i, dateHM);
                    newName = newName.replace(/%d/i, date1);
                    
                    // 修改時間格式
                    newName = newName.replace(/%MMM+/i, mTime3);
                    newName = newName.replace(/%MMM/i, mTime3);
                    newName = newName.replace(/%MM/i, mTime2);
                    newName = newName.replace(/%MHMS/i, mTimeHMS);
                    newName = newName.replace(/%MHM/i, mTimeHM);
                    newName = newName.replace(/%M/i, mTime1);
                    
                    // 小寫版本
                    newName = newName.replace(/%mmm+/i, mTime3);
                    newName = newName.replace(/%mmm/i, mTime3);
                    newName = newName.replace(/%mm/i, mTime2);
                    newName = newName.replace(/%mhms/i, mTimeHMS);
                    newName = newName.replace(/%mhm/i, mTimeHM);
                    newName = newName.replace(/%m/i, mTime1);
                    
                    // 創建時間格式
                    newName = newName.replace(/%BBB+/i, bTime3);
                    newName = newName.replace(/%BBB/i, bTime3);
                    newName = newName.replace(/%BB/i, bTime2);
                    newName = newName.replace(/%BHMS/i, bTimeHMS);
                    newName = newName.replace(/%BHM/i, bTimeHM);
                    newName = newName.replace(/%B/i, bTime1);
                    
                    // 小寫版本
                    newName = newName.replace(/%bbb+/i, bTime3);
                    newName = newName.replace(/%bbb/i, bTime3);
                    newName = newName.replace(/%bb/i, bTime2);
                    newName = newName.replace(/%bhms/i, bTimeHMS);
                    newName = newName.replace(/%bhm/i, bTimeHM);
                    newName = newName.replace(/%b/i, bTime1);
                    
                    newName = newName.replace(/\*/i, originName);
                    if (newName.match("%T")) {
                        let tagString = "";
                        if (item.tags && item.tags.length > 0) {
                            tagString = item.tags.sort().join("-");
                            newName = newName.replace(/%T/i, tagString);
                        }
                        else {
                            newName = newName.replace(/%T/i, "");
                        }
                    }
                    if (newName.match("%F")) {
                        let folderString = "";
                        if (item.folders && item.folders.length > 0) {
                            // 使用 $bodyScope.folderMappings 將 folder id 轉換為名稱
                            let folderNames = [];
                            item.folders.forEach(id => {
                                // 獲取 folder 的名稱
                                if ($bodyScope.folderMappings && $bodyScope.folderMappings[id]) {
                                    folderNames.push($bodyScope.folderMappings[id].name);
                                }
                            });
                            if (folderNames.length > 0) {
                                folderString = folderNames.sort().join("-");
                            }
                            newName = newName.replace(/%F/i, folderString);
                        } else {
                            newName = newName.replace(/%F/i, "");
                        }
                    }
                    if ($scope.type === "IMAGE") {
                        newName = newName.replace(/[/]/g, '').replace(emojiRegex, '').replace(/%/g, "");
                        newName = sanitize(newName);
                    }
                    if (newName.length === 0) {
                        newName = originName;
                    }
                } catch (e) {
                    newName = originName;
                }
                newName = newName.substr(0, 255);
                return newName;
            };

            // 重命名按鈕點擊時
            $scope.rename = () => {

                const rename = () => {

                    if ($scope.isRenaing) return;

                    $scope.isRenaing = true;

                    switch ($scope.type) {
                        case "IMAGE":
                            $scope.renameImages();
                            $scope.close();
                            break;
                        case "FOLDER":
                        case "SMART_FOLDER":
                            $scope.renameFolders();
                            $scope.close();
                            break;
                        case "TAGS":
                            $scope.renameTags();
                            $scope.close();
                            break;
                    }
                };

                let showAlert = 10;
                if ($scope.type === "TAGS") {
                    showAlert = 2;
                }
                if ($scope.items.length >= showAlert) {
                    swal({
                        html: `
                            <div class="alert">
                                <div class="alert-icon warning"></div>
                                <h4 class="alert-title">${i18n.__("dialog.batchRename.title")}</h4>
                                <p class="alert-desc">${i18n.__("dialog.batchRename.desc1") + $scope.items.length + i18n.__("dialog.batchRename.desc2")}</p>
                            </div>
                        `,
                        showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 20,
                        width: 400,
                        customClass: "alert-box",
                        cancelButtonColor: "#777777",
                        confirmButtonText: i18n.__("dialog.batchRename.renameBtn"),
                        cancelButtonText: i18n.__("general.cancel"),
                    }).then(function () {
                        rename();
                    });
                }
                else {
                    rename();
                }
            };

            // 獲取特定類型的搜尋歷史
            function getFindStringHistory(type) {
                const key = `BATCH_RENAME_HISTORY_${type}_FIND_STRING`;
                const history = localStorage.getItem(key);
                return history ? JSON.parse(history) : [];
            }

            // 保存搜尋歷史
            function saveFindStringHistory(type, value) {
                if (!value || value.trim() === "") return;
                
                const key = `BATCH_RENAME_HISTORY_${type}_FIND_STRING`;
                let history = getFindStringHistory(type);
                
                // 如果已經存在相同值，先移除
                history = history.filter(item => item !== value);
                
                // 添加到歷史的開頭
                history.unshift(value);
                
                // 保持最多10個記錄
                if (history.length > 10) {
                    history = history.slice(0, 10);
                }
                
                localStorage.setItem(key, JSON.stringify(history));
            }

            // 批次修改圖片名稱
            $scope.renameImages = () => {

                var changedItems = [];
                var originalItems = [];

                // 全新格式
                if ($scope.replaceMethod == "format") {
                    $scope.items.forEach(function (item, index) {
                        var cloneItem = angular.copy(item);
                        var originItem = angular.copy(item);
                        var originName = cloneItem.name;
                        var newName = format(item, $scope.newName, {
                            originName: originName,
                            idx: index + parseInt($scope.startAt)
                        });
                        
                        // 應用大小寫轉換
                        newName = $scope.applyTextCase(newName);

                        if (cloneItem.name !== newName) {
                            cloneItem.name = newName;
                            cloneItem.oldName = originName;
                            cloneItem.newName = newName;
                            changedItems.push(cloneItem);

                            originItem.name = originName;
                            originItem.oldName = cloneItem.newName;
                            originItem.newName = originName;
                            originalItems.push(originItem);
                        }
                    });
                    ayncsImagesChange(changedItems);
                    hiddenByCurrentFilter(changedItems);
                }

                // 取代字串
                else {
                    $scope.items.forEach(function (item, index) {
                        var cloneItem = angular.copy(item);
                        var originItem = angular.copy(item);
                        var originName = cloneItem.name;
                        var newName;

                        if ($scope.isRegex) {
                            newName = originName.replace($scope.regex, $scope.replaceString);
                        }
                        else {
                            newName = originName.split($scope.findString).join($scope.replaceString);
                        }
                        
                        // 應用大小寫轉換
                        newName = $scope.applyTextCase(newName);

                        if (cloneItem.name !== newName) {
                            cloneItem.name = newName;
                            cloneItem.oldName = originName;
                            cloneItem.newName = newName;
                            changedItems.push(cloneItem);

                            originItem.name = originName;
                            originItem.oldName = cloneItem.newName;
                            originItem.newName = originName;
                            originalItems.push(originItem);
                        }
                    });

                    ayncsImagesChange(changedItems);
                    hiddenByCurrentFilter(changedItems);
                    
                    // 儲存搜尋歷史
                    saveFindStringHistory($scope.type, $scope.findString);
                }

                try { electronLog && electronLog.info(`[app] Batch rename ${$scope.items.length} files, using format: ${$scope.replaceMethod}`); } catch (err) { };

                // 復原
                var message = $filter('i18n')("notify.image.rename", [
                    { "property": "count", "value": $scope.items.length },
                ]);
                if ($scope.items.length === 1) { message = message.replace("images", "image"); }
                $rootScope.notify({
                    message: message,
                    duration: 10000,
                }, function () {
                    ayncsImagesChange(originalItems);
                });

                if ($scope.newName) {
                    localStorage.setItem("BATCH_RENAME_LAST_NAME", $scope.newName);
                }
            }

            // 批次修改資料夾名稱
            $scope.renameFolders = () => {

                var originNames = {};

                // 全新格式
                if ($scope.replaceMethod == "format") {
                    $scope.items.forEach(function (item, index) {
                        var originName = item.name;
                        var newName = format(item, $scope.newName, {
                            originName: originName,
                            idx: index + parseInt($scope.startAt)
                        });
                        
                        // 應用大小寫轉換
                        newName = $scope.applyTextCase(newName);
                        
                        item.name = newName;
                        originNames[item.id] = originName;
                    });
                    $bodyScope.saveFolder();
                    $rootScope.$broadcast("CALCULATE_IMAGE_BINDING");
                }

                // 取代字串
                else {
                    $scope.items.forEach(function (item, index) {
                        var originName = item.name;
                        var newName;
                        if ($scope.isRegex) {
                            newName = originName.replace($scope.regex, $scope.replaceString);
                        }
                        else {
                            newName = originName.split($scope.findString).join($scope.replaceString);
                        }
                        
                        // 應用大小寫轉換
                        newName = $scope.applyTextCase(newName);
                        
                        item.name = newName;
                        originNames[item.id] = originName;
                    });
                    $bodyScope.saveFolder();
                    $rootScope.$broadcast("CALCULATE_IMAGE_BINDING");
                    
                    // 儲存搜尋歷史
                    saveFindStringHistory($scope.type, $scope.findString);
                }

                try { electronLog && electronLog.info(`[app] Batch rename ${$scope.items.length} ${$scope.type}, using format: ${$scope.replaceMethod}`); } catch (err) { };

                // 復原
                var message = $filter('i18n')("notify.image.rename", [
                    { "property": "count", "value": $scope.items.length },
                ]);
                if ($scope.items.length === 1) { message = message.replace("images", "image"); }
                $rootScope.notify({
                    message: message,
                    duration: 10000,
                }, function () {
                    $scope.items.forEach(function (item) {
                        if (originNames[item.id]) {
                            item.name = originNames[item.id];
                        }
                    });
                    $bodyScope.saveFolder();
                    $rootScope.$broadcast("CALCULATE_IMAGE_BINDING");
                });
            }

            // 批次修改標籤名稱
            $scope.renameTags = () => {

                let old2new = {};

                // 全新格式
                if ($scope.replaceMethod == "format") {
                    $scope.items.forEach(function (item, index) {
                        var originName = item.name;
                        var newName = format(item, $scope.newName, {
                            originName: originName,
                            idx: index + parseInt($scope.startAt)
                        });
                        
                        // 應用大小寫轉換
                        newName = $scope.applyTextCase(newName);
                        
                        old2new[originName] = newName;
                    });
                }
                // 取代字串
                else {
                    $scope.items.forEach(function (item, index) {
                        var originName = item.name;
                        var newName;
                        if ($scope.isRegex) {
                            newName = originName.replace($scope.regex, $scope.replaceString);
                        }
                        else {
                            newName = originName.split($scope.findString).join($scope.replaceString);
                        }
                        
                        // 應用大小寫轉換
                        newName = $scope.applyTextCase(newName);
                        
                        old2new[originName] = newName;
                    });
                    
                    // 儲存搜尋歷史
                    saveFindStringHistory($scope.type, $scope.findString);
                }

                let changed = [];
                for (let rindex = $bodyScope.raw.length - 1; rindex >= 0; rindex--) {
                    let item = $bodyScope.raw[rindex];
                    let needUpadate = false;
                    if (item?.tags) {
                        item.tags.forEach((tag, index) => {
                            if (old2new[tag]) {
                                item.tags[index] = old2new[tag];
                                needUpadate = true;
                            }
                        });
                        if (needUpadate) {
                            item.tags = [...new Set(item.tags)];
                            changed.push(item);
                        }
                    }
                }

                // 修改标签群组包含的标签
                if ($bodyScope.TagManager.groups.length > 0) {
                    $bodyScope.TagManager.groups.forEach(function (group) {
                        if (group.tags) {
                            if (group?.tags) {
                                let needUpadate = false;
                                group.tags.forEach((tag, index) => {
                                    if (old2new[tag]) {
                                        group.tags[index] = old2new[tag];
                                        needUpadate = true;
                                    }
                                });
                                if (needUpadate) {
                                    group.tags = [...new Set(group.tags)];
                                }
                            }
                        }
                    });
                }

                // 更新所有文件夹智能标签
                eagle.utils.tree.walk($bodyScope.folders, 'children', function (folder, parent) {
                    if (folder && folder.tags) {
                        let needUpadate = false;
                        folder.tags.forEach((tag, index) => {
                            if (old2new[tag]) {
                                folder.tags[index] = old2new[tag];
                                needUpadate = true;
                            }
                        });
                        if (needUpadate) {
                            folder.tags = [...new Set(folder.tags)];
                        }
                    }
                });

                // 更新智能文件夹的标签属性
                eagle.utils.tree.walk($bodyScope.smartFolders, 'children', function (smartFolder, parent, depth) {
                    if (!smartFolder.conditions) return;
                    smartFolder.conditions.forEach(function (condition) {
                        if (!condition.rules) return;
                        condition.rules.forEach(function (rule) {
                            if (rule && rule.property === 'tags') {
                                var ruleTags = rule.value;
                                let needUpadate = false;
                                if (ruleTags && ruleTags.length > 0) {
                                    ruleTags.forEach((tag, index) => {
                                        if (old2new[tag]) {
                                            ruleTags[index] = old2new[tag];
                                            needUpadate = true;
                                        }
                                    });
                                    if (needUpadate) {
                                        rule.value = [...new Set(rule.value)];
                                    }
                                }
                            }
                        });
                    });
                });

                ayncsImagesChange(changed);
                hiddenByCurrentFilter(changed);
                $bodyScope.saveFolder();
                $bodyScope.calculateImageBinding();
            };

            $scope.cancel = () => {
                $scope.close();
            };

            $scope.close = () => {
                $scope.isOpen = false;
                $scope.isRenaing = false;
            };

            // 顯示搜尋字串自動完成
            $scope.showAutocomplete = () => {
                if ($scope.findStringHistory && $scope.findStringHistory.length > 0) {
                    // 直接顯示所有歷史記錄，不過濾
                    $scope.showFindStringAutocomplete = true;
                    $scope.selectedHistoryIndex = -1;
                }
            };

            // 隱藏搜尋字串自動完成
            $scope.hideAutocomplete = () => {
                $timeout(() => {
                    $scope.showFindStringAutocomplete = false;
                }, 200);
            };

            // 選擇歷史搜尋字串
            $scope.selectFindString = (value) => {
                $scope.findString = value;
                $scope.showFindStringAutocomplete = false;
                $scope.updatePreview();
            };

            // 處理鍵盤事件
            $scope.onFindStringKeydown = (event) => {
                if (!$scope.showFindStringAutocomplete || !$scope.findStringHistory.length) {
                    return $scope.onKeydown(event);
                }

                const keyCode = event.keyCode;
                
                // 上鍵
                if (keyCode === 38) {
                    event.preventDefault();
                    $scope.selectedHistoryIndex = Math.max(-1, $scope.selectedHistoryIndex - 1);
                    if ($scope.selectedHistoryIndex === -1) {
                        $scope.findString = $scope.tempFindString || "";
                    } else {
                        $scope.findString = $scope.findStringHistory[$scope.selectedHistoryIndex];
                    }
                } 
                // 下鍵
                else if (keyCode === 40) {
                    event.preventDefault();
                    if ($scope.selectedHistoryIndex === -1) {
                        $scope.tempFindString = $scope.findString;
                    }
                    $scope.selectedHistoryIndex = Math.min($scope.findStringHistory.length - 1, $scope.selectedHistoryIndex + 1);
                    $scope.findString = $scope.findStringHistory[$scope.selectedHistoryIndex];
                }
                // Enter 鍵
                else if (keyCode === 13) {
                    if ($scope.selectedHistoryIndex !== -1) {
                        event.preventDefault();
                        $scope.findString = $scope.findStringHistory[$scope.selectedHistoryIndex];
                        $scope.showFindStringAutocomplete = false;
                    } else {
                        return $scope.onKeydown(event);
                    }
                }
                // Escape 鍵
                else if (keyCode === 27) {
                    event.preventDefault();
                    $scope.showFindStringAutocomplete = false;
                    return $scope.onKeydown(event);
                } 
                else {
                    return $scope.onKeydown(event);
                }
            };

            $scope.changeTextCase = (caseType) => {
                $scope.textCase = caseType;
                $scope.updatePreview();
            };

            $scope.applyTextCase = (text) => {
                if (!text) return text;
                
                switch ($scope.textCase) {
                    case 'uppercase':
                        return text.toUpperCase();
                    case 'lowercase':
                        return text.toLowerCase();
                    case 'capitalize':
                        return text.replace(/\w\S*/g, function(txt){
                            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
                        });
                    default:
                        return text;
                }
            };
        }
    }
});

// 自動完成 directive
EagleApp.directive('findStringAutocomplete', function() {
    return {
        restrict: 'E',
        replace: true,
        template: `
            <div class="find-string-autocomplete" ng-show="showFindStringAutocomplete && findStringHistory.length > 0">
                <div class="find-string-autocomplete-item" 
                     ng-repeat="item in findStringHistory" 
                     ng-click="selectFindString(item)"
                     ng-class="{'selected': selectedHistoryIndex === $index}">
                    {{item}}
                </div>
            </div>
        `,
        scope: false
    };
});