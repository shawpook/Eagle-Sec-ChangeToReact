EagleApp.directive('filterItemFolders', function($rootScope, $timeout) {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/filter-item-folders.html',
        replace: true,
        link: function($scope, elem, attrs) {

            $scope.$body = angular.element("body").scope();
            $scope.foldersList = $scope.$body.containFolders;
            $scope.rule;
            $scope.displayName = i18n.__("filter.folders");
            $scope.isEnabled = false;
            $scope.rule = eagle.filter.folderFilterLogic;

            elem.on("open", function () {
                // 计算这批图片里面出现的文件夾
                console.time("calcuteContainFolders");
                if (eagle.filter.folderFilterLogic === "OR") {
                    $scope.$body.calcuteContainFolders($scope.$body.preelaborations);
                }
                else if (eagle.filter.folderFilterLogic === "AND" || eagle.filter.folderFilterLogic === "EQUAL") {
                    $scope.$body.calcuteContainFolders($scope.$body.allData);
                }
                console.timeEnd("calcuteContainFolders");
                $scope.$body.$evalAsync();
            });

            $scope.$watch("$body.containFolders", function (newValue) {
                $scope.updateFoldersList();
            });

            $scope.changeRule = function (rule) {
                eagle.filter.folderFilterLogic = rule;
                if ($scope.selectedCount > 0) {
                    $scope.$body.page = 1; 
                    $scope.$body.filterContent();
                }
                $scope.focusInput();
            };

            function filterFolders (folders, keyword) {

                if (!keyword) return folders;
                var keyword_cn = chineseConvert.tw2cn(keyword).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\ /g, '').toLowerCase();

                var folderSearchItems = folders.map(folder => {
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
                            cartesianProduct(pinyinlite(folderNameCN, { keepUnrecognized : true }).filter(p => p.length > 0))
                            .map(item => item.join(' '))
                        )],
                    };
                });

                var scores = folderSearchItems.map(item => {
                    return {
                        item: item,
                        name: item.name,
                        score: _.max(item.search.map(pinyin => pinyin.score(keyword_cn))),
                    };
                })
                
                var result = scores.filter(i => i.score > 0).sort((a, b) => b.score - a.score).map(function (i) {
                    return i.item.folder;
                });

                return result;
            }

            $scope.updateFoldersList = function () {

                var originLength = $scope.foldersList.length;
                var collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' } );
                var result = $scope.$body.containFolders;

                var selectedFolders = $scope.$body.containFolders.filter(function (folder) {
                    if (!folder) return false;
                    return folder.isSelected;
                });
                $scope.selectedCount = selectedFolders.length;

                if (eagle.filter.filterFolderKeyword) {
                    result = filterFolders(result, eagle.filter.filterFolderKeyword);
                }

                $scope.foldersList = result;

                if ($scope.foldersList.length !== originLength) {
                    $("#filter-folder-list").scrollTop(0);
                }
            };

            $scope.foldersFilterChange = function () {
                $scope.updateFoldersList();
                $("#filter-folder-list").scrollTop(0);
                setTimeout(function () {
                    $("#filter-folder-list .check-item.active").removeClass("active")
                    $("#filter-folder-list .check-item").eq(0).addClass("active");
                }, 33);
            };

            $scope.changeDisplayName = function () {
                var displayName = i18n.__("filter.folders");
                if (Object.keys(eagle.filter.filterRules.folder.includes).length > 0 || Object.values(eagle.filter.filterRules.folder.excludes).length > 0) {
                    displayName = ``;
                    var arr = [];
                    Object.values(eagle.filter.filterRules.folder.includes).forEach(function (folder) {
                        arr.push(folder.name);
                    });
                    Object.values(eagle.filter.filterRules.folder.excludes).forEach(function (folder) {
                        arr.push("-" + folder.name);
                    });
                    if (arr.length > 0) {
                        $scope.isEnabled = true;
                        displayName += arr.join(",");
                        $scope.displayName = displayName;
                    }
                    else {
                        $scope.isEnabled = false;
                        $scope.displayName = i18n.__("filter.folders");
                    }
                }
                else {
                    $scope.isEnabled = false;
                    $scope.displayName = i18n.__("filter.folders");
                }
                setTimeout(function () { $scope.$body.updateContainerHieght();}, 300);
            }
            $scope.clearFoldersFilter = function (event) {
                event && event.stopPropagation();
                eagle.filter.filterRules.folder.includes = {};
                eagle.filter.filterRules.folder.excludes = {};
                $scope.$body.page = 1; 
                $scope.$body.reload();
                $scope.changeDisplayName();
            }
            $scope.$on("Reset_Filter", function (event) {
                $scope.changeDisplayName();
            });
            $scope.$on("Update_Folders_Filter", function () {
                $scope.changeDisplayName(); 
           });
        }
    }
});