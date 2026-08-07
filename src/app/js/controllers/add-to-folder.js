EagleApp.controller("AddToFolderController", function($scope, $timeout, $rootScope, $filter) {

    $scope.isOpen = false;
    $scope.currentIndex;
    $scope.showCreateButton = false;
    $scope.filterFolderKeyword = "";
    $scope.folders = [];
    $scope.resultList = [];
    $scope.folderMappings = {};
    $scope.selectedFolders = {};
    $scope.isRemoveFromOriginal = localStorage.getItem("isRemoveFromOriginal") || 'false';

    var $bodyScope = angular.element("body").scope();
    var recentMoveFolders;

    var watchers = {
        openModal: function(e, params) {
            $scope.images = params.images;
            $scope.current = params.current;
            $scope.existsFolders = params.existsFolders;
            $scope.folders = [];
            $scope.selectedFolders = {};

            // 與外界隔離，不需要使用 body scope 的 folders
            cloneTree($scope.folders, params.folders);

            // 预设展开所有第一层
            $scope.folders.forEach(function (folder) {
                folder.isExpand = true;
            });

            eagle.utils.tree.walk($scope.folders, 'children', function (folder, parent) {
                $scope.folderMappings[folder.id] = folder;
                if (folder && parent) {
                    folder.parent = parent.id;
                }
                for (var i = 0; i < $scope.existsFolders.length; i++) {
                    var existsFolder = $scope.existsFolders[i];
                    // 该图片已经收藏在这个文件夹了
                    if (folder.id === existsFolder) {
                        $scope.selectedFolders[folder.id] = true;
                    }
                }
            });

            // 最近使用的文件夹（存id)，去除已经不存在的文件夹
            recentMoveFolders = localStorage.getItem("recentMoveFolders");
            if (recentMoveFolders) {
                recentMoveFolders = JSON.parse(recentMoveFolders);
                recentMoveFolders = recentMoveFolders.slice(0, 8);
            }
            else {
                recentMoveFolders = [];
            }

            $scope.recentMoveFolders = recentMoveFolders.filter(function (folderId) {
                return !!$bodyScope.folderMappings[folderId];
            });

            $scope.filterFolderKeyword = "";
            $scope.renderFolderList();
            $scope.selectedFolder = $scope.resultList[0];

            $timeout(function () {
                $scope.isOpen = true;
            }, 70);
        }
    };

    $scope.$on("OPEN-ADD-FOLDER-MODAL", watchers.openModal);
    $scope.$watch("isRemoveFromOriginal", function (newValue) {
        localStorage.setItem("isRemoveFromOriginal", newValue);
    });

    $scope.changeCurrentIndex = function (node) {
        var idx = $scope.resultList.indexOf(node);
        if (idx !== -1) {
            $scope.currentIndex = idx; 
        }
    };

    function getFolderList () {

        let list = [];
        let isFiltering = !!$scope.filterFolderKeyword;
        let guidelinesMap = {};

        eagle.utils.tree.walk($scope.folders, 'children', function (folder, parent, depth) {

            // 計算 guidelines 顏色及數量
            let guidelines = [];
            if (parent && guidelinesMap[parent.id]) {
                const parentGuidelines = guidelinesMap[parent.id];
                guidelines = [...parentGuidelines, folder.iconColor || 'normal'];
            }
            else {
                guidelines = [folder.iconColor || 'normal'];
            }
            guidelinesMap[folder.id] = guidelines;

            var idx;
            folder.size = 27;
            folder.vstype = 'folder';
            folder.guidelines = guidelines.slice(0, guidelines.length - 1);
            folder.styles = {
                depth: depth,
                first: false,
                last: false
            };

            if (parent) {
                folder.isVisible = folder.isExpand && parent.isVisible;
            }
            else {
                folder.isVisible = folder.isExpand;
            }

            if (depth !== 0 && parent && parent.children) {
                idx = parent.children.indexOf(folder);
                if (idx === 0 && parent.children.length > 1) {
                    folder.styles.first = true;
                    folder.styles.last = false;
                }
                else if (idx === 0 && parent.children.length === 1) {
                    folder.styles.first = false;
                    folder.styles.last = true;
                }
                else if (idx === parent.children.length - 1) {
                    folder.styles.first = false;
                    folder.styles.last = true;
                }
                else {
                    folder.styles.first = false;
                    folder.styles.last = false;
                }
            }
            if (folder && folder.isExpand && folder.children.length > 0) {
                folder.styles.last = true;
            }

            // 决定是否要在画面上显示
            if (!parent) {
                list.push(folder);
            }
            else if (isFiltering) {
                list.push(folder);
            }
            else {
                if (folder && parent.isVisible) {
                    list.push(folder);
                }
            }
        });
        return list;
    };

    $scope.renderFolderList = function () {

        var list = [];
        var folderList = getFolderList();
        var folderLabel = { vstype: 'label-folder', size: 25 };
        var createFolderItem = { vstype: 'createFolder', size: 28 };

        // folderList = $filter('filter')(folderList, $scope.folderMoveSearchFilter);
        folderList = filterFolders(folderList, $scope.filterFolderKeyword);

        if ($scope.filterFolderKeyword.length <= 0) {

            if ($scope.recentMoveFolders.length > 0) {
                list.push({ vstype: 'separator', size: 8 });
            }

            $scope.recentMoveFolders.forEach(function (recentFolderId) {
                if (recentFolderId && $bodyScope.folderMappings[recentFolderId]) {
                    var folder = angular.copy($bodyScope.folderMappings[recentFolderId]);
                    folder.size = 28;
                    folder.styles = {
                        depth: 0,
                        first: false,
                        last: false
                    };
                    folder.vstype = "recentFolder";
                    list.push(folder);
                }
            });

            // if (list.length > 0) {
                list.push({ vstype: 'separator', size: 8 });
            // }
            list.push(folderLabel);
        }
        else {
            list.push({ vstype: 'separator', size: 8 });
        }

        list = list.concat(folderList);


        // 计算是否需要显示创建按钮
        $scope.showCreateButton = false;
        if ($scope.filterFolderKeyword) {
            $scope.showCreateButton = true;
            for (var i = 0; i < list.length; i++) {
                var folder = list[i];
                if (folder.name === $scope.filterFolderKeyword) {
                    $scope.showCreateButton = false;
                    break;
                }
            }
        }

        if ($scope.showCreateButton) {
            list.push(createFolderItem);
        }

        $scope.resultList = list;
    };

    $scope.getMoveFolderItemClass = function (node, folderName, selectedFolder) {
        var result = {
            'hover active-item': node == selectedFolder,
            'checked': $scope.selectedFolders[node.id],
            'collapsed': !node.isExpand && !$scope.filterFolderKeyword,
            'empty-node': node.children && node.children.length == 0,
            'color-red': node.iconColor == 'red',
            'color-orange': node.iconColor == 'orange',
            'color-yellow': node.iconColor == 'yellow',
            'color-green': node.iconColor == 'green',
            'color-aqua': node.iconColor == 'aqua',
            'color-blue': node.iconColor == 'blue',
            'color-purple': node.iconColor == 'purple',
            'color-pink': node.iconColor == 'pink',
            'close': node.children && node.children.length <= 0 && node.isExpand,
        };

        result['icon-' + node.icon] = true;
		let parent = $scope.folderMappings[node.parent];
		if (parent) {
			result[`parent-color-${parent?.iconColor}`] = true;
		}
        return result;
    };

    $scope.toggleFolder = function (event, folder) {
        event.stopPropagation();
        if ($scope.filterFolderKeyword) {
            folder.isExpand = !folder.isExpand;
            folder.showChildren = !folder.showChildren;
        }
        else {
            // 如果用户点击了 ⌘ + alt，展开/收起所有层级
            if (event.altKey && (event.metaKey || event.ctrlKey)) {
                var expand = !folder.isExpand;
                toggleAllFolders($scope.folders, expand);
            }
            // 如果用户点击 ⌘，展开/收起第一层
            else if (event.metaKey || event.ctrlKey) {
                var expand = !folder.isExpand;
                var parent = $scope.folderMappings[folder.parent];
                var folders = $scope.folders;
                if (parent && parent.children) {
                    folders = parent.children;
                }
                toggleCurrentLevelFolders(folders, expand);
            }
            else if (event.altKey) {
                var expand = !folder.isExpand;
                var folders = folder.children;
                folder.isExpand = expand;
                toggleCurrentLevelFolders(folders, expand);
            }
            else {
                folder.isExpand = !folder.isExpand;
            }
        }
        $scope.renderFolderList();
        $scope.focusSeach();
    };

    function toggleAllFolders (folders, isExpand) {
        eagle.utils.tree.walk(folders, 'children', function(f, parent) {
            if (f.isExpand !== isExpand) {
                f.isExpand = isExpand;
            }
        });
    };

    function toggleCurrentLevelFolders (folders, isExpand) {
        folders.forEach(function (f) {
            if (f.isExpand !== isExpand) {
                f.isExpand = isExpand;
            }
        });
    };

    $scope.selectPrevFolder = function () {
        var currentIndex = $scope.resultList.indexOf($scope.selectedFolder);
        var target;
        if (currentIndex === -1) {
            $scope.selectedFolder = $scope.resultList[0];
        }
        else {
            $scope.selectedFolder = $scope.resultList[currentIndex - 1] || $scope.resultList[0];
        }
        if (currentIndex > 0 && $scope.selectedFolder.vstype !== 'folder' && $scope.selectedFolder.vstype !== 'recentFolder'&& $scope.selectedFolder.vstype !== 'createFolder') {
            $scope.selectPrevFolder();
        }
        $scope.changeCurrentIndex($scope.selectedFolder);
        $scope.searchScrollEnable = true;
    };

    $scope.selectNextFolder = function () {
        var currentIndex = $scope.resultList.indexOf($scope.selectedFolder);
        var target;
        if (currentIndex === -1) {
            $scope.selectedFolder = $scope.resultList[0];
        }
        else {
            $scope.selectedFolder = $scope.resultList[currentIndex + 1] || $scope.resultList[$scope.resultList.length - 1];
        }
        if (currentIndex < $scope.resultList.length -1 && $scope.selectedFolder.vstype !== 'folder' && $scope.selectedFolder.vstype !== 'recentFolder'&& $scope.selectedFolder.vstype !== 'createFolder') {
            $scope.selectNextFolder();
        }
        $scope.changeCurrentIndex($scope.selectedFolder);
        $scope.searchScrollEnable = true;
    };

    $scope.keywordChange = function () {

        // 一律清除強制展開的功能
        eagle.utils.tree.walk($scope.folders, 'children', function (folder, parent) {
            delete folder.showChildren;
        });

        $scope.renderFolderList();
        $scope.selectedFolder = $scope.resultList[0];
        $scope.scrollToTop();
    };

    $scope.onSearchKeyup = function(event) {
        var keyCode = event.keyCode;
        if (keyCode === 38) {
            event.preventDefault();
            $scope.selectPrevFolder();
        } else if (keyCode === 40) {
            event.preventDefault();
            $scope.selectNextFolder();
        } else if (keyCode === 37) {
            if ($scope.selectedFolder) {
                $scope.selectedFolder.isExpand = false;
                $scope.selectedFolder.showChildren = false;
                $scope.renderFolderList();
            }
        } else if (keyCode === 39) {
            if ($scope.selectedFolder) {
                $scope.selectedFolder.isExpand = true;
                $scope.selectedFolder.showChildren = true;
                $scope.renderFolderList();
            }
        } else if (keyCode === 27) {
            event.preventDefault();
            $scope.cancel();
        } else if (keyCode === 13) {
            if (event.metaKey || event.ctrlKey) {
                event.preventDefault();
                $scope.save();
            }
            else {
                $scope.select($scope.selectedFolder);
            }
        }
    };

    $scope.scrollToTop = function () {
        $(".move-to-folder-modal .sidebar-item-container").scrollTop(0);
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
            var score = _.max(item.search.map(pinyin => pinyin.score(keyword_cn)));
            // if (score === 0) {
                var folder = item.folder;
                if (folder && folder.parent && $scope.folderMappings[folder.parent]) {
                    if ($scope.folderMappings[folder.parent].showChildren) {
                        score = 1;
                    }
                }
                if (folder.children) {
                    var isMatch = false;
                    eagle.utils.tree.walk(folder.children, 'children', function (child, parent) {
                        if (fuzzy_match(child.name, keyword_cn).length > 0) {
                            folder.isExpand = true;
                            isMatch = true;
                        }
                        if (child.pinyin && keyword_cn.length > 3) {
                            if (fuzzy_match(child.pinyin, keyword_cn).length > 0) {
                                folder.isExpand = true;
                                isMatch = true;
                            }
                        }
                    });
                    if (isMatch) {
                        score = 1;
                    }
                }
            // }
            return {
                item: item,
                name: item.name,
                score: score
            };
        })

        // var result = scores.filter(i => i.score > 0).sort((a, b) => b.score - a.score).map(function (i) {
        var result = scores.filter(i => i.score > 0).map(function (i) {
            return i.item.folder;
        });

        return result;
    }

    $scope.folderMoveSearchFilter = function(folder) {

        var result = false;
        var pinyinMatch = false;
        if (!$scope.filterFolderKeyword) {
            return true;
        }
        if (folder) {
            // NOTE: 如果老爸有著无敌星星，那我就能直接显示
            if (folder.parent && $scope.folderMappings[folder.parent]) {
                if ($scope.folderMappings[folder.parent].showChildren) {
                    return true;
                }
            }
            var match = fuzzy_match(folder.name, $scope.filterFolderKeyword);
            result = match && match.length > 0;
            if (result) {
                return true;
            }
            var keyword_cn = chineseConvert.tw2cn($scope.filterFolderKeyword);
            var keyword_tw = chineseConvert.cn2tw($scope.filterFolderKeyword);
            if (keyword_cn !== keyword_tw) {
                result = fuzzy_match(folder.name, keyword_cn).length > 0;
                if (result) { return true; }

                result = fuzzy_match(folder.name, keyword_tw).length > 0;
                if (result) { return true; }
            }

            if (folder.pinyin && $scope.filterFolderKeyword.length >= 2) {
                pinyinMatch = fuzzy_match(folder.pinyin, $scope.filterFolderKeyword).length > 0;
            }
            if (pinyinMatch) {
                return true;
            }
            if (folder.children) {
                var isMatch = false;
                eagle.utils.tree.walk(folder.children, 'children', function (child, parent) {
                    if (fuzzy_match(child.name, $scope.filterFolderKeyword).length > 0) {
                        folder.isExpand = true;
                        isMatch = true;
                        return;
                    }
                    if (child.pinyin && $scope.filterFolderKeyword.length > 3) {
                        if (fuzzy_match(child.pinyin, $scope.filterFolderKeyword).length > 0) {
                            folder.isExpand = true;
                            isMatch = true;
                            return;
                        }
                    }
                });
                return isMatch;
            }
        }
        return false;
    };

    $scope.hoverFolder = function (folder) {
        $scope.searchScrollEnable = false;
        $scope.selectedFolder = folder;
    };

    $scope.select = function(folder) {
        if (folder && folder.vstype === 'createFolder') {
            $scope.createFolder();
        }
        else {
            if (!$scope.selectedFolders[folder.id]) {
                $scope.selectedFolders[folder.id] = true;
            }
            else {
                delete $scope.selectedFolders[folder.id];
            }
        } 
        $scope.focusSeach();
    };

    $scope.focusSeach = function () {
        setTimeout(() => {
            $("#add-to-folder-search").focus();
        }, 24);
    };

    $scope.createFolder = function () {

        var newFolder = {
            id: guid(),
            name: $scope.filterFolderKeyword,
            folders: [],
            modificationTime: Date.now(),
            editable: false,
            tags: [],
            children: [],
            isExpand: true,
        };

        $scope.selectedFolders[newFolder.id] = true;

        if ($scope.filterFolderKeyword && $scope.showCreateButton) {
            $scope.folders.unshift(newFolder);
            $scope.filterFolderKeyword = "";
            $scope.renderFolderList();
            ipcRenderer.send('prepend-folder', newFolder);
        }
    };

    $scope.hasSelected = function() {
        if (!$scope.isOpen) return;
        return Object.keys($scope.selectedFolders).length > 0;
    };

    $scope.newFolder = function (event) {
        event.stopPropagation();
        var idx = 0;
        createFolder(function (folderName) {
            if (folderName === undefined) return;
            var folderId = guid();
            var newFolder = {
                id: folderId,
                name: folderName,
                images: [],
                folders: [],
                modificationTime: Date.now(),
                imagesMappings: {},
                tags: [],
                children: [],
                isExpand: true,
            };
            var newFolderCopy = angular.copy(newFolder);

            $scope.folders.splice(idx, 0, newFolder);
            $bodyScope.folders.splice(idx, 0, newFolderCopy);
            $scope.folderMappings[newFolder.id] = newFolder;
            $bodyScope.folderMappings[newFolder.id] = newFolderCopy;

            $scope.renderFolderList();
            $bodyScope.updateSidebarList();
            $bodyScope.saveFolder();
            $scope.focusSeach();
        });
    };

    $scope.removeRecentFolder = function (event, folder) {
        if (recentMoveFolders && recentMoveFolders.length > 0) {
        let idx = recentMoveFolders.indexOf(folder.id);
            if (idx > -1) {
                let sidx = $scope.recentMoveFolders.indexOf(folder.id);
                if (sidx > -1) {
                    $scope.recentMoveFolders.splice(sidx, 1);
                }
                recentMoveFolders.splice(idx, 1);
                localStorage.setItem("recentMoveFolders", JSON.stringify(recentMoveFolders));
                $scope.renderFolderList();
            }
        }
    };

    $scope.moreButtonClick = function (event, folder) {

        event.stopPropagation();

        var contextMenu = new Menu();
        var newSubFolderItem = new MenuItem({
            label: $filter('i18n')("context.addToFolder.addChilderFolder"),
            click: function() {
                createFolder(function (folderName) {
                    if (folderName === undefined) return;
                    var folderId = guid();
                    var newFolder = {
                        id: folderId,
                        name: folderName,
                        images: [],
                        folders: [],
                        modificationTime: Date.now(),
                        imagesMappings: {},
                        tags: [],
                        children: [],
                        isExpand: true,
                        parent: folder.id
                    };
                    var newFolderCopy = angular.copy(newFolder);

                    var idx = 0;
                    var bodyFolder = $bodyScope.folderMappings[folder.id];
                    if (!folder.children) folder.children = [];
                    if (!bodyFolder.children) bodyFolder.children = [];

                    folder.children.splice(folder.children.length, 0, newFolder);
                    bodyFolder.children.splice(folder.children.length, 0, newFolderCopy);
                    $scope.folderMappings[newFolder.id] = newFolder;
                    $bodyScope.folderMappings[newFolder.id] = newFolderCopy;

                    folder.isExpand = true;

                    $scope.renderFolderList();
                    $bodyScope.updateSidebarList();
                    $bodyScope.saveFolder();
                    $scope.focusSeach();
                });
            }
        });
        var newSiblingsItem = new MenuItem({
            label: $filter('i18n')("context.addToFolder.addSiblingFolder"),
            click: function() {
                createFolder(function (folderName) {
                    if (folderName === undefined) return;

                    var folderId = guid();
                    var idx = 0;
                    var bodyFolder = $bodyScope.folderMappings[folder.id];
                    var parentId = folder.parent;
                    var parentFolderChildren;
                    var bodyParentFolderChildren;

                    if (!parentId) {
                        parentFolderChildren = $scope.folders;
                        bodyParentFolderChildren = $bodyScope.folders;
                    }
                    else {
                        if (!$scope.folderMappings[parentId]) return;
                        if (!$bodyScope.folderMappings[parentId]) return;
                        parentFolderChildren = $scope.folderMappings[parentId].children;
                        bodyParentFolderChildren = $bodyScope.folderMappings[parentId].children;
                    }

                    var idx = parentFolderChildren.indexOf(folder);
                    if (idx === -1) return;

                    var newFolder = {
                        id: folderId,
                        name: folderName,
                        images: [],
                        folders: [],
                        modificationTime: Date.now(),
                        imagesMappings: {},
                        tags: [],
                        children: [],
                        isExpand: true,
                        parent: parentId
                    };
                    var newFolderCopy = angular.copy(newFolder);

                    parentFolderChildren.splice(idx + 1, 0, newFolder);
                    bodyParentFolderChildren.splice(idx + 1, 0, newFolderCopy);
                    $scope.folderMappings[newFolder.id] = newFolder;
                    $bodyScope.folderMappings[newFolder.id] = newFolderCopy;

                    $scope.renderFolderList();
                    $bodyScope.updateSidebarList();
                    $bodyScope.saveFolder();
                    $scope.focusSeach();
                });
            }
        });

        contextMenu.append(newSubFolderItem);
        contextMenu.append(newSiblingsItem);
        contextMenu.popup(currentWindow);
        setTimeout(function () {
            $scope.focusSeach();
        }, 50);
    };

    function createFolder (callback) {
        swal({
            html: `
                <div class="alert">
                    <div class="alert-icon create"></div>
                    <h4 class="alert-title">${$filter('i18n')("dialog.addToFolder.craeateFolder.title")}</h4>
                </div>
            `,
            showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
            width: 400,
            customClass: "alert-box",
            input: 'text',
            inputPlaceholder: $filter('i18n')("dialog.addToFolder.craeateFolder.placeholder"),
            inputValue: '',
            cancelButtonColor: "#777777",
            confirmButtonText: $filter('i18n')("dialog.addToFolder.craeateFolder.button"),
            cancelButtonText: $filter('i18n')("general.cancel"),
        }).then(function (result) {
            var name = result
            callback(name);
            $scope.focusSeach();
        }, function () {
            $scope.focusSeach();
        });
    };

    $scope.save = function() {

        var ipcRenderer = require('electron').ipcRenderer;
        var selectedFolders = [];

        var origin = [];
        var originFolders = [];
        var originTags = [];
        var originDeleted = [];

        $scope.images.forEach(function(image) {
            origin.push(image);
            originFolders.push(angular.copy(image.folders));
            originTags.push(angular.copy(image.tags));
            originDeleted.push(image.isDeleted);
        });

        // 如果使用者取消打勾既有分类文件夹
        var removedFolderIds = [];
        $scope.existsFolders.forEach(function (exFolderId) {
            if (!$scope.selectedFolders[exFolderId]) {
                removedFolderIds.push(exFolderId);
            }
        });

        var hasChanged = false;
        var hasRemoved = false;
        eagle.utils.tree.walk($scope.folders, 'children', function (folder, parent) {
            if ($scope.selectedFolders[folder.id]) {

                // 添加至最近使用文件夹
                var recentIdx = recentMoveFolders.indexOf(folder.id);
                if (recentIdx !== -1) {
                    recentMoveFolders.splice(recentIdx, 1);
                }
                recentMoveFolders.unshift(folder.id);

                selectedFolders.push(folder);
                $scope.images.forEach(function(image) {
                    if (image.folders.indexOf(folder.id) === -1) {
                        image.folders.push(folder.id);
                        if (folder.extendTags) {
                            folder.extendTags.forEach(function(tag) {
                                if (image.tags.indexOf(tag) === -1) {
                                    image.tags.push(tag);
                                }
                            });
                        }
                    }
                    if ($scope.current && $scope.isRemoveFromOriginal == 'true') {
                        var idx = image.folders.indexOf($scope.current.id);
                        if (idx !== -1) {
                            ig.remove($("#box-" + image.id)[0]);
                            image.folders.splice(idx, 1);
                            $scope.updateFilterCounts(image, true);
                            $scope.current.imagesMappings[image.id] = false;
                            hasRemoved = true;
                        }
                    }

                    // 如果使用者取消打勾既有分类文件夹
                    if (removedFolderIds && removedFolderIds.length > 0) {
                        removedFolderIds.forEach(function (removedFolderId) {
                            var idx = image.folders.indexOf(removedFolderId);
                            if (idx !== -1) {
                                if ($scope.current && $scope.current.id === removedFolderId) {
                                    ig.remove($("#box-" + image.id)[0]);
                                    $scope.current.imagesMappings[image.id] = false;
                                }
                                image.folders.splice(idx, 1);
                                $scope.updateFilterCounts(image, true);
                                hasRemoved = true;
                            }
                        });
                    }

                    image.isDeleted = false;
                });
                hasChanged = true;
            }
        });

        if (hasRemoved) {
            $bodyScope.lastIndex = $bodyScope.getSelection().start;

            // 自動選取下一個圖片，如果沒有下一個，選上一個，都沒有就空
            var next = $bodyScope.allData[$bodyScope.lastIndex + $bodyScope.selected.length];
            var prev = $bodyScope.allData[$bodyScope.lastIndex - 1];
            if (next) {
                $bodyScope.selected = [next];
                $bodyScope.current = next;
                $bodyScope.smartZoom();
            }
            else if (prev) {
                $bodyScope.selected = [prev];
                $bodyScope.current = prev;
                $bodyScope.smartZoom();
            }
            else {
                $bodyScope.selected = [];
                $bodyScope.leaveDetailMode();
            }
        }

        if (hasChanged) {
            ayncsImagesChange($scope.images);
            hiddenByCurrentFilter($scope.images);
        }

        if ($scope.viewMode === 'unfiled') {
            var itemElements = $scope.getSelectedItemElements();
            $rootScope.$broadcast("gl:removeItems", itemElements);
        }
        else {
            ig.layout(false);
        }

        $rootScope.$broadcast("CALCULATE_IMAGE_BINDING");
        $rootScope.$broadcast("REBIND_REFRESH", true);
        $rootScope.$broadcast("UPDATE_SELECTION");

        // 记录最近使用的文件夹
        recentMoveFolders = recentMoveFolders.slice(0, 50);
        localStorage.setItem("recentMoveFolders", JSON.stringify(recentMoveFolders));

        var message = $filter('i18n')("notify.image.moveToFolders", [
            { "property": "imageCount", "value": $scope.images.length },
            { "property": "folderCount", "value": selectedFolders.length }
        ]);
        if ($scope.images.length === 1) { message = message.replace("images", "image"); }
        if (selectedFolders.length === 1) { 
            // message = message.replace(" folders", ""); 
            message = angular.element(document.body).injector().get('$filter')('i18n')("notify.image.moveToFolder", [
                { "property": "folderId", "value": selectedFolders[0].id },
                { "property": "imageCount", "value": $scope.images.length },
                { "property": "folderName", "value": selectedFolders[0].name }
            ]);
        }

        // 復原操作
        $rootScope.notify({
            message: message,
            duration: 4000,
        }, function () {
            origin.forEach(function (image, index) {
                image.folders = originFolders[index];
                image.tags = originTags[index];
                image.isDeleted = originDeleted[index];
            });
            $scope.selected = origin;
            $scope.current = origin[0];
            $rootScope.$broadcast("CALCULATE_IMAGE_BINDING");
            $rootScope.$broadcast("REBIND_REFRESH", true);
            $rootScope.$broadcast("UPDATE_SELECTION");
        });

        $scope.isOpen = false;
        $(".move-to-folder-modal input:focus").blur();
        $scope.scrollToTop();

        electronLog && electronLog.info(`[app] Categorize ${$scope.images.length} files to ${selectedFolders.length} folders`);
        analytics.event('File', 'Categorize', 'AddToFolder');
    };

    $scope.cancel = function() {
        $scope.isOpen = false;
        $(".move-to-folder-modal input:focus").blur();
        $scope.scrollToTop();
    };

});