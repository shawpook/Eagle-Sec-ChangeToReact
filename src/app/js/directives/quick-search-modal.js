EagleApp.directive('quickSearchModal', function ($timeout, $rootScope) {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/quick-search-modal.html',
        scope: {},
        link: function ($scope, element, attrs, controllersArr) {
            const $panel = $("#quick-search-panel");
            let $parentScope = $bodyScope;
            $scope.$parentScope = $parentScope;
            $scope.quickSearchKeyword = "";
            $scope.quickSearchHistoryIndex = 0;
            $scope.quickSearchHistory = [];
            $scope.searchMode = "FOLDERS";

            $scope.$on('OPEN_QUICK_SEARCH_MODAL', function (event) {
                if (!$scope.quickSearchIndex) {
                    $scope.quickSearchIndex = 0;
                }
                
                $parentScope.keyword = "";
                $scope.isOpenQuickSearch = true;
                setTimeout(function () {
                    $("#quick-search-input").focus();
                    $(".quick-search .search-result-container").scrollTop(0)
                }, 100);
                setTimeout(function () {
                    $("#quick-search-input").focus();
                }, 200);
                $("#quick-search-input").focus();
                $("#quick-search-input").select();
                $scope.quickSearchKeywordChange();
                // $scope.moveToCursorPosition();
            });

            $scope.$on('CLOSE_QUICK_SEARCH_MODAL', function (event, data) {
                $scope.close();
            });

            if (localStorage.getItem("eagle.quickSearch.history")) {
                $scope.quickSearchHistory = JSON.parse(localStorage.getItem("eagle.quickSearch.history"));
            }

            $scope.close = () => {
                $scope.isOpenQuickSearch = false;
                $("#quick-search-input").blur();
                $rootScope.currentFocus = "content";
            };

            $scope.itemMode = function () {
                $scope.searchMode = "ITEMS";
                $scope.quickSearchKeywordChange();
                $timeout(function () {
                    $("#quick-search-input").focus();
                    $("#quick-search-input").select();
                }, 100);
            };

            $scope.smartFolderMode = function () {
                $scope.searchMode = "SMARTFOLDERS";
                $scope.quickSearchKeywordChange();
                $timeout(function () {
                    $("#quick-search-input").focus();
                    $("#quick-search-input").select();
                }, 100);
            };

            $scope.tagMode = function () {
                $scope.searchMode = "TAGS";
                $scope.quickSearchKeywordChange();
                $timeout(function () {
                    $("#quick-search-input").focus();
                    $("#quick-search-input").select();
                }, 100);
            };

            $scope.folderMode = function () {
                $scope.searchMode = "FOLDERS";
                $scope.quickSearchKeywordChange();
                $timeout(function () {
                    $("#quick-search-input").focus();
                    $("#quick-search-input").select();
                }, 100);
            };

            $scope.getQuickSearchFolderHistory = function () {
                try {
                    if (localStorage.getItem("eagle.quickSearch.folder.history")) {
                        return JSON.parse(localStorage.getItem("eagle.quickSearch.folder.history"));
                    }
                } catch (err) { }
                return [];
            };

            $scope.addQuickSearchFolderHistory = function (folderId) {
                let quickSearchFolderHistory = $scope.getQuickSearchFolderHistory();
                quickSearchFolderHistory.unshift(folderId);
                quickSearchFolderHistory = [...new Set(quickSearchFolderHistory)];
                if (quickSearchFolderHistory.length > 200) {
                    quickSearchFolderHistory.length = 200;
                }
                localStorage.setItem("eagle.quickSearch.folder.history", JSON.stringify(quickSearchFolderHistory));
            };

            $scope.getQuickSearchSmartFolderHistory = function () {
                try {
                    if (localStorage.getItem("eagle.quickSearch.smartFolder.history")) {
                        return JSON.parse(localStorage.getItem("eagle.quickSearch.smartFolder.history"));
                    }
                } catch (err) { }
                return [];
            };

            $scope.addQuickSearchSmartFolderHistory = function (smartFolderId) {
                let quickSearchSmartFolderHistory = $scope.getQuickSearchSmartFolderHistory();
                quickSearchSmartFolderHistory.unshift(smartFolderId);
                quickSearchSmartFolderHistory = [...new Set(quickSearchSmartFolderHistory)];
                if (quickSearchSmartFolderHistory.length > 200) {
                    quickSearchSmartFolderHistory.length = 200;
                }
                localStorage.setItem("eagle.quickSearch.smartFolder.history", JSON.stringify(quickSearchSmartFolderHistory));
            };

            $scope.quickSearchKeywordChange = function () {

                var keyword = $scope.quickSearchKeyword;
                var keyword_cn = chineseConvert.tw2cn(keyword).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\ /g, '').toLowerCase();
                var list = [];

                const cloneWithoutKey = (object, key) => {
                    const { [key]: deletedKey, ...otherKeys } = object;
                    return otherKeys;
                }

                switch ($scope.searchMode) {
                    case 'ITEMS':
                        list = $parentScope.all;
                        break;
                    case 'FOLDERS':
                        // 顯示歷史記錄
                        if (!keyword && $parentScope.folderList.length > 15 && $scope.getQuickSearchFolderHistory().length > 0) {
                            $scope.getQuickSearchFolderHistory().forEach(function (fid) {
                                if (list.length >= 10) return;
                                if ($parentScope.folderMappings[fid]) {
                                    let copy = cloneWithoutKey($parentScope.folderMappings[fid], 'children')
                                    delete copy.$$hashKey;
                                    copy.isRecent = true;
                                    list.push(copy);
                                }
                            });
                        }

                        let folderList = [];
                        let ancestorsCache = {};
                        let guidelinesMap = {};

                        eagle.utils.tree.walk($parentScope.folders, 'children', function(folder, parent, depth) {

                            let item = { ...folder }
                            if (item && parent) {
                                item.parent = parent.id;
                            }

                            // 計算 guidelines 顏色及數量
                            let guidelines = [];
                            if (parent && guidelinesMap[parent.id]) {
                                const parentGuidelines = guidelinesMap[parent.id];
                                guidelines = [...parentGuidelines, item.iconColor || 'normal'];
                            }
                            else {
                                guidelines = [item.iconColor || 'normal'];
                            }
                            guidelinesMap[item.id] = guidelines;

                            // 列表版本 Folders
                            folderList.push(item);
                        });

                        list.push(...folderList);
                        break;

                    case 'TAGS':
                        const tagGroupsIndexMap = {};
                        $parentScope.TagManager.groups.forEach((tagGroup, index) => {
                            tagGroupsIndexMap[tagGroup.id] = index;
                        });
                        list = [...$parentScope.tags];

                        // sort tags by tag.group property
                        list = list.sort((a, b) => {
                            const aGroup = (a.groups[0])? a.groups[0] : undefined;
                            const bGroup = (b.groups[0])? b.groups[0] : undefined;
                            const aGroupIdx = tagGroupsIndexMap[aGroup];
                            const bGroupIdx = tagGroupsIndexMap[bGroup];
                            if (!aGroup && bGroup) return 1;
                            if (aGroup && !bGroup) return -1;
                            if (aGroupIdx < bGroupIdx) return -1;
                            if (aGroupIdx > bGroupIdx) return 1;
                            return 0;
                        });

                        // if group is equal, then sort a-z
                        list = list.sort((a, b) => {
                            const aGroup = (a.groups[0])? a.groups[0] : undefined;
                            const bGroup = (b.groups[0])? b.groups[0] : undefined;
                            const aName = a.name;
                            const bName = b.name;
                            if (aGroup === bGroup) {
                                if (aName < bName) return -1;
                                if (aName > bName) return 1;
                            }
                            return 0;
                        });

                        break;
                    case 'SMARTFOLDERS':
                        if (!keyword && $parentScope.smartFolderList.length > 10 && $scope.getQuickSearchSmartFolderHistory().length > 0) {
                            $scope.getQuickSearchSmartFolderHistory().forEach(function (fid) {
                                if (list.length >= 10) return;
                                if ($parentScope.smartFolderMappings[fid]) {
                                    let copy = cloneWithoutKey($parentScope.smartFolderMappings[fid], 'children')
                                    delete copy.$$hashKey;
                                    delete copy.iconColor;
                                    copy.isRecent = true;
                                    list.push(copy);
                                }
                            });
                        }
                        list.push(...$parentScope.smartFolderList);
                        break;
                }

                if (!keyword) {
                    $scope.quickSearchResult = list;
                }
                else {
                    if ($scope.searchMode !== "ITEMS") {
                        console.time("$scope.quickSearchKeywordChange");
                        const searchItems = list.map(folder => {
                            var folderNameCN = chineseConvert.tw2cn(folder.name).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                            if (keyword.length >= 30 || folder.name.length >= 30) {
                                return {
                                    folder: folder,
                                    name: folderNameCN,
                                    search: [folderNameCN]
                                }
                            }
                            return {
                                folder: folder,
                                name: folderNameCN,
                                search: [folderNameCN, ..._.uniq(
                                    cartesianProduct(pinyinlite(folderNameCN, { keepUnrecognized: true }).filter(p => p.length > 0))
                                        .map(item => item.join(' '))
                                )],
                            };
                        });

                        const scores = searchItems.map(item => {
                            return {
                                item: item,
                                name: item.name,
                                score: _.max(item.search.map(pinyin => pinyin.score(keyword_cn))),
                            };
                        })

                        $scope.quickSearchResult = scores.filter(i => i.score > 0).sort((a, b) => b.score - a.score).map(function (i) {
                            return i.item.folder;
                        });

                        console.timeEnd("$scope.quickSearchKeywordChange");
                    }
                    else {
                        console.time("$scope.quickSearchKeywordChange");
                        $scope.quickSearchResult = list.filter($scope.searchFilterForQuickSeach);
                        console.timeEnd("$scope.quickSearchKeywordChange");
                    }
                }
            }

            $scope.openQuickSearchResult = function (target) {
                if (target) {
                    if ($scope.searchMode === "FOLDERS") {
                        $parentScope.openFolder(target);
                        $scope.addQuickSearchFolderHistory(target.id);
                        setTimeout(function () { $parentScope.changeSidebarIndex(target); $parentScope.$evalAsync(); }, 200);
                    } else if ($scope.searchMode === "TAGS") {
                        $parentScope.viewMode = undefined;
                        $parentScope.openTag(target.name);
                    } else if ($scope.searchMode === "ITEMS") {
                        let folder = null;
                        if (target.folders && target.folders[0]) {
                            folder = $parentScope.folderMappings[target.folders[0]];
                        }
                        $parentScope.openItemLocation(target, folder);
                    }
                    else {
                        $parentScope.openSmartFolder(target);
                        $scope.addQuickSearchSmartFolderHistory(target.id);
                        setTimeout(function () { $parentScope.changeSidebarIndex(target); $parentScope.$evalAsync(); }, 200);
                    }
                    $scope.saveQuickSearchHistory($scope.quickSearchKeyword);
                    $scope.quickSearchHistoryIndex = 0;
                    $scope.close();
                    analytics.event('QuickSearch', 'Open');
                }
            };

            $scope.saveQuickSearchHistory = function (keyword) {
                if (!keyword) { return };
                $scope.quickSearchHistory.unshift(keyword);
                if ($scope.quickSearchHistory.length >= 100) {
                    $scope.quickSearchHistory.length = 100;
                }
                localStorage.setItem("eagle.quickSearch.history", JSON.stringify($scope.quickSearchHistory));
            };

            $scope.selectQuickSearchResult = function (index) {
                $scope.quickSearchIndex = index;
                $scope.quickScrollEnable = false;
            };

            $scope.quickSeachKeyup = function (event) {

                var keyCode = event.keyCode;
                if (keyCode === 38) {
                    event.preventDefault();
                    $scope.quickScrollEnable = true;
                    if ($scope.quickSearchIndex - 1 >= 0) {
                        $scope.quickSearchIndex = $scope.quickSearchIndex - 1;
                    }
                } else if (keyCode === 40) {
                    event.preventDefault();
                    $scope.quickScrollEnable = true;
                    if ($scope.quickSearchIndex + 1 < $scope.quickSearchResult.length) {
                        $scope.quickSearchIndex = $scope.quickSearchIndex + 1;
                    }
                } else if (keyCode === 27) {
                    event.preventDefault();
                    $scope.close();
                } else if (keyCode === 13) {
                    $scope.openQuickSearchResult($scope.quickSearchResult[$scope.quickSearchIndex])
                } else if (keyCode === 9) {
                    event && event.preventDefault();
                    $scope.quickSearchIndex = 0;
                    if (!event.shiftKey) {
                        if ($scope.searchMode == 'FOLDERS') { $scope.tagMode(); } else if ($scope.searchMode == 'TAGS') { $scope.smartFolderMode(); } else if ($scope.searchMode == 'SMARTFOLDERS') { $scope.itemMode(); } else { $scope.folderMode(); }
                    } else {
                        if ($scope.searchMode == 'FOLDERS') { $scope.itemMode(); } else if ($scope.searchMode == 'TAGS') { $scope.folderMode(); } else if ($scope.searchMode == 'SMARTFOLDERS') { $scope.tagMode(); } else { $scope.smartFolderMode(); }
                    }
                    $scope.quickSearchIndex = 0;
                    $scope.quickSearchHistoryIndex = 0;
                    $(".quick-search .search-result-container").scrollTop(0).trigger("scroll");
                } else {
                    $scope.quickSearchIndex = 0;
                    $scope.quickSearchHistoryIndex = 0;
                    $(".quick-search .search-result-container").scrollTop(0).trigger("scroll");
                }
            };

            $scope.quickSearchFilter = function (folder) {

                var pinyinMatch = false;
                var nameMatch = false;
                if ($scope.quickSearchKeyword == "") return true;

                if (folder) {
                    nameMatch = fuzzy_match(folder.name, $scope.quickSearchKeyword).length > 0;
                    if (nameMatch) return true;

                    var keyword_cn = chineseConvert.tw2cn($scope.quickSearchKeyword);
                    var keyword_tw = chineseConvert.cn2tw($scope.quickSearchKeyword);
                    if (keyword_cn !== keyword_tw) {
                        var nameCNMatch = fuzzy_match(folder.name, keyword_cn).length > 0;
                        if (nameCNMatch) return true;

                        var nameTWMatch = fuzzy_match(folder.name, keyword_tw).length > 0;
                        if (nameTWMatch) return true;
                    }

                    if (folder.pinyin) {
                        pinyinMatch = fuzzy_match(folder.pinyin, $scope.quickSearchKeyword).length > 0;
                    }
                    return nameMatch || pinyinMatch;
                }
                return false;
            };

            $scope.quickSearchOrder = function (folder) {
                if (!$scope.quickSearchKeyword) return;
                var sum = 0;
                var firstB = 0;
                $("<div></div>").append(fuzzy_match(folder.name, $scope.quickSearchKeyword)).contents().each(function (idx) {
                    if (this.tagName == 'B') {
                        if (sum == 0) {
                            firstB = idx;
                        }
                        sum -= Math.pow(2, 10 - idx + firstB);
                    }
                });
                return sum;
            };

            $scope.getThumbnailUrl = function (image) {
                if (!$parentScope.imagesDir || !image) return;
                return FileUrlHelper.getThumbnailUrl(image);
            };

            $scope.searchFilterForQuickSeach = function(image) {
                try {
                    var isMatch = false;
                    var keywords = $scope.quickSearchKeyword.toLowerCase().split(" ");
    
                    for (var i = 0; i < keywords.length; i++) {
    
                        var keyword = keywords[i];
                        var isNotLogic = keyword[0] === "-";
                        var isFullMathLogic = keyword[0] === `"` && keyword[keyword.length - 1] === `"`;
    
                        if (keyword === "-") continue;
    
                        var name = image.name,
                            annotation = image.annotation,
                            ext = image.ext,
                            url = image.url,
                            camera = "",
                            postScriptName = "",
                            allText = "";
    
                        if (image.fontMetas && image.fontMetas.postScriptName) {
                            try {
                                let key = Object.keys(image.fontMetas.postScriptName)[0];
                                postScriptName = image.fontMetas.postScriptName && image.fontMetas.postScriptName[key].toLowerCase() || "";
                            }
                            catch (err) {}
                        }
    
                        if (image.text) {
                            allText += image.text.toLowerCase() + " ";
                        }
    
                        if (image.rawMetas && image.rawMetas.camera) {
                            try {
                                camera = image.rawMetas.camera;
                                allText += `${camera} `;
                            }
                            catch (err) {}
                        }
    
                        if (name && $parentScope.isSearchScopeName) {
                            allText += `${name}`;
                        }
    
                        if (ext && $parentScope.isSearchScopeExt) {
                            allText += `.${ext} `;
                        }
                        
                        if (url && $parentScope.isSearchScopeUrl) {
                            if ($parentScope.keyword.length >= 2) {
                                allText += `${url} `;
                            }
                        }
                        
                        if (annotation && $parentScope.isSearchScopeNote) {
                            allText += `${annotation} `;
                        }
    
                        // 提前判断，如果已经符合，就不需要下面的复杂判断
                        allText = allText.toLowerCase();
    
                        if (isNotLogic) {
                            
                        }
                        else if (isFullMathLogic) {
                            if (name === keyword.replace(/"/g, '')) {
                                isMatch = true;
                                continue;
                            }
                            else {
                                var textArray = name.toLowerCase().split(/[ ，,;、]+/);
                                if (textArray.indexOf(keyword.replace(/"/g, '')) > -1) {
                                    isMatch = true;
                                    continue;
                                }
                                else {
                                    // return false;
                                }
                            }
                        }
                        else {
                            if ( (i18n.locale !== "zh_CN" && i18n.locale !== "zh_TW" && i18n.locale !== "en") || $parentScope.isContainAlphabet) {
                                if (allText.indexOf(keyword) != -1) {
                                    isMatch = true;
                                    continue;
                                }
                                else {
                                    
                                }
                            }
                            else {
                                let keyword = keywords[i];
                                if (allText.indexOf(keyword) != -1) {
                                    isMatch = true;
                                    continue;
                                }
                            }
                        }
    
                        var annotations = "";
                        if ($parentScope.isSearchScopeAnnotation) {
                            if (image.comments) {
                                image.comments.forEach(function(comment) {
                                    annotations += comment.annotation;
                                })
                            }
                            allText += `${annotations} `;
                        }
    
                        var tagsString = "";
                        if ($parentScope.isSearchScopeTag && image.tags && image.tags.length > 0) {
                            for (var ti = 0; ti < image.tags.length; ti++) {
                                if (image.tags[ti]) {
                                    tagsString += `${image.tags[ti]} `;
                                }
                            }
                            allText += `${tagsString} `;
                        }
    
                        // 这个很花时间，如果图片名称就已经符合条件，应立即 return 不该等到这个时间
                        var folderNames = " ";
                        var folderDescriptions = " ";
                        if ($parentScope.isSearchScopeFolderDesc || $parentScope.isSearchScopeFolderName) {
                            if (image.folders && image.folders.length > 0) {
                                for (var fi = 0; fi < image.folders.length; fi++) {
                                    var folderId = image.folders[fi];
                                    var folder = $parentScope.folderMappings[folderId];
                                    if (folder) {
                                        if ($parentScope.isSearchScopeFolderName && folder && folder.name) {
                                            folderNames += `${folder.name} `;
                                        }
                                        if ($parentScope.isSearchScopeFolderDesc && folder.description) {
                                            folderDescriptions += `${folder.description} `;
                                        }
                                    }
                                }
                            }
                            allText += folderNames;
                            allText += folderDescriptions;
                        }
    
                        allText = allText.toLowerCase();
                        
                        if (isNotLogic) {
                            var notKeyword = keyword.replace("-", "");
                            if (notKeyword && allText.indexOf(notKeyword) != -1) {
                                return false;
                            }
                            else {
                                isMatch = true;
                            }
                        }
                        else if (isFullMathLogic) {
                            keyword = keyword.replace(/"/g, '');
                            if (name === keyword) {
                                isMatch = true;
                            }
                            else {
                                var textArray = name.toLowerCase().split(/[ ，,;、]+/);
                                if (textArray.indexOf(keyword) > -1) {
                                    isMatch = true;
                                }
                                else {
                                    return false;
                                }
                            }
                        }
                        else {
    
                            if ( (i18n.locale !== "zh_CN" && i18n.locale !== "zh_TW" && i18n.locale !== "en") || $parentScope.isContainAlphabet) {
                                if (allText.indexOf(keyword) != -1) {
                                    isMatch = true;
                                }
                                else {
                                    return false;
                                }
                            }
                            else {
                                let keyword = keywords[i];
                                if (allText.indexOf(keyword) != -1) {
                                    isMatch = true;
                                }
                                else {
                                    return false;
                                }
                            }
                        }
                    }
    
                    return isMatch;
                }
                catch (err) {}
                return false;
            };
    
        }
    }
});