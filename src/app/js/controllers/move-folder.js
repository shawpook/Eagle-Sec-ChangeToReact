EagleApp.controller("MoveFolderController", function($scope, $timeout, $rootScope, $filter) {

    $scope.isOpen = false;
    $scope.currentIndex;
    $scope.showCreateButton = false;
    $scope.filterFolderKeyword = "";
    $scope.folders = [];
    $scope.resultList = [];
    $scope.folderMappings = {};
    $scope.selectedFoldersMappings = {};

    var $bodyScope = angular.element("body").scope();

    var watchers = {
        openModal: function(e, params) {
            $scope.images = params.images;
            $scope.current = params.current;
            $scope.existsFolders = params.existsFolders;
            $scope.folders = [];

            $scope.selectedFoldersMappings = {};
            $scope.selectedFolders = params.selectedFolders;
            $scope.selectedFolders.forEach(function (f) {
            	$scope.selectedFoldersMappings[f.id] = true;
            });

            // 與外界隔離，不需要使用 body scope 的 folders
            cloneTree($scope.folders, params.folders, true);

            eagle.utils.tree.walk($scope.folders, 'children', function (folder, parent) {
                $scope.folderMappings[folder.id] = folder;
                if (folder && parent) {
                    folder.parent = parent.id;
                }
            });

            // $scope.filterFolderKeyword = "";
            $scope.renderFolderList();
            $scope.selectedFolder = $scope.resultList[0];
            
            $timeout(function () {
                $scope.isOpen = true;
            }, 70);
        }
    };

    $scope.$on("OPEN-MOVE-FOLDER-MODAL", watchers.openModal);
    $scope.$watch("isRemoveFromOriginal", function (newValue) {
        localStorage.setItem("isRemoveFromOriginal", newValue);
    });
    
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

            if ($scope.selectedFoldersMappings[folder.id]) {
                folder.isVisible = false;
            }
            else if (parent) {
                folder.isVisible = folder.isExpand && parent.isVisible && !$scope.selectedFoldersMappings[parent.id];
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

        folderList = $filter('filter')(folderList, $scope.folderMoveSearchFilter);

        if ($scope.filterFolderKeyword.length <= 0) {
            list.push({ vstype: 'separator', size: 8 });
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

    $scope.getMoveFolderItemClass = function (node, folderName, selectedFolder) {
        var result = {
            'hover active-item': node == selectedFolder,
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
            'disabled': !!$scope.selectedFoldersMappings[node.id]
        };

        result['icon-' + node.icon] = true;
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
        if (keyCode === 27) {
            $scope.cancel();
        }
    };

    $scope.scrollToTop = function () {
        $(".move-to-folder-modal .sidebar-item-container").scrollTop(0);
    };

    $scope.focusSeach = function () {
        setTimeout(() => {
            $("#move-folder-search").focus();
        }, 24);
    };

    
    // 两种文案撰写方式
    // 1 > 1
    // N > 1
    $scope.moveToFolderTop = function (node) {

        var msg;
        if ($scope.selectedFolders.length === 1) {
            msg = $filter('i18n')("dialog.moveFolder.descTop", [
                { "property": "first", "value": $scope.selectedFolders[0].name },
                { "property": "target", "value": node.name },
            ]);
        }
        else {
            msg = $filter('i18n')("dialog.moveFolder.descTopMultiple", [
                { "property": "first", "value": $scope.selectedFolders[0].name },
                { "property": "count", "value": $scope.selectedFolders.length - 1 },
                { "property": "target", "value": node.name },
            ]);
        }
    	
    	swal({
            html: `
                <div class="alert">
                    <div class="alert-icon warning"></div>
                    <h4 class="alert-title">${i18n.__("dialog.moveFolder.title")}</h4>
                    <p class="alert-desc">${msg}</p>
                </div>
            `,
            showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
            width: 400,
            customClass: "alert-box",
            cancelButtonColor: "#777777",
            confirmButtonText: $filter('i18n')('dialog.moveFolder.button'),
            cancelButtonText: $filter('i18n')("general.cancel"),
            onOpen: () => {
                $("#move-folder-search").blur();
                var button = swal.getConfirmButton();
                if (button) {
                    $(button).focus();
                }
            }
        }).then(function () {
        	var folder = $bodyScope.folderMappings[node.id];
        	$scope.focusSeach();
        	if (folder) {
                $bodyScope.moveFoldersAsSibling($scope.selectedFolders, folder);
                $scope.cancel();
                $bodyScope.$evalAsync();
            }
        }, function () {
        	$scope.focusSeach();
        });
    };

    $scope.moveToFolderInner = function (node) {

    	var msg;
        if ($scope.selectedFolders.length === 1) {
            msg = $filter('i18n')("dialog.moveFolder.descInner", [
                { "property": "first", "value": $scope.selectedFolders[0].name },
                { "property": "target", "value": node.name },
            ]);
        }
        else {
            msg = $filter('i18n')("dialog.moveFolder.descInnerMultiple", [
                { "property": "first", "value": $scope.selectedFolders[0].name },
                { "property": "count", "value": $scope.selectedFolders.length - 1 },
                { "property": "target", "value": node.name },
            ]);
        }

    	swal({
            html: `
                <div class="alert">
                    <div class="alert-icon warning"></div>
                    <h4 class="alert-title">${i18n.__("dialog.moveFolder.title")}</h4>
                    <p class="alert-desc">${msg}</p>
                </div>
            `,
            showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
            width: 400,
            customClass: "alert-box",
            cancelButtonColor: "#777777",
            confirmButtonText: $filter('i18n')('dialog.moveFolder.button'),
            cancelButtonText: $filter('i18n')("general.cancel"),
            onOpen: () => {
                $("#move-folder-search").blur();
                var button = swal.getConfirmButton();
                if (button) {
                    $(button).focus();
                }
            }
        }).then(function () {
        	var folder = $bodyScope.folderMappings[node.id];
            if (folder) {
                $bodyScope.moveFoldersToFolder($scope.selectedFolders, folder);
                $scope.cancel();
                $bodyScope.$evalAsync();
            }
        	$scope.focusSeach();
        }, function () {
        	$scope.focusSeach();
        });
    };

    $scope.moveToFolderBottom = function (node) {

    	var msg;
        if ($scope.selectedFolders.length === 1) {
            msg = $filter('i18n')("dialog.moveFolder.descBottom", [
                { "property": "first", "value": $scope.selectedFolders[0].name },
                { "property": "target", "value": node.name },
            ]);
        }
        else {
            msg = $filter('i18n')("dialog.moveFolder.descBottomMultiple", [
                { "property": "first", "value": $scope.selectedFolders[0].name },
                { "property": "count", "value": $scope.selectedFolders.length - 1 },
                { "property": "target", "value": node.name },
            ]);
        }

    	swal({
            html: `
                <div class="alert">
                    <div class="alert-icon warning"></div>
                    <h4 class="alert-title">${i18n.__("dialog.moveFolder.title")}</h4>
                    <p class="alert-desc">${msg}</p>
                </div>
            `,
            showCloseButton: false, showCancelButton: true, allowOutsideClick: false, focusConfirm: true, focusCancel: false, padding: 24,
            width: 400,
            customClass: "alert-box",
            cancelButtonColor: "#777777",
            confirmButtonText: $filter('i18n')('dialog.moveFolder.button'),
            cancelButtonText: $filter('i18n')("general.cancel"),
            onOpen: () => {
                $("#move-folder-search").blur();
                var button = swal.getConfirmButton();
                if (button) {
                    $(button).focus();
                }
            }
        }).then(function () {
        	$scope.focusSeach();
        	var folder = $bodyScope.folderMappings[node.id];
        	if (folder) {
                $bodyScope.moveFoldersAsSibling($scope.selectedFolders, folder, true);
                $scope.cancel();
                $bodyScope.$evalAsync();
            }
        }, function () {
        	$scope.focusSeach();
        });
    };

    $scope.save = function() {
        var ipcRenderer = require('electron').ipcRenderer;
        $scope.isOpen = false;
    };

    $scope.cancel = function() {
        $scope.isOpen = false;
        $(".move-to-folder-modal input:focus").blur();
        // $scope.scrollToTop();
    };

});
