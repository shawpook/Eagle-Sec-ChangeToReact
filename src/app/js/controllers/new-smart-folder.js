EagleApp.controller("NewSmartFolderController", function($scope, $timeout, $rootScope, $filter) {
    var ipcRenderer = require('electron').ipcRenderer;
    var $bodyScope = angular.element("body").scope();
    $scope.smartFolderScope = $scope;
    $scope.parent;
    $scope.isOpen = false;
    $scope.folderName= "";
    $scope.foldersSuggestion = [];
    $scope.conditions = [{
        rules: [{
            property: "name",
            method: "contain",
            value: ""
        }],
        match: "OR",
        boolean: "TRUE"
    }];
    $scope.totalCount = 0;
    $scope.dateOpts1 = {
	    dateFormat: 'Y-m-d',
	    allowInput: false,
        locale: ($scope.language.indexOf('zh') > -1)? "zh": "en",
	    // defaultDate: ["2016-10-20"],
	    onChange: function (selectedDates, dateStr, instance) {
            var rule = angular.element(instance._input).scope().rule;
	    	if (selectedDates.length == 1) {
	    		var date = selectedDates[0].getTime();
                rule.value = [date];
                $scope.recalculateResult();
	    		console.log(date)
	    	}
	    }
	};
	$scope.dateOpts2 = {
	    dateFormat: 'Y-m-d',
	    allowInput: false,
        locale: ($scope.language.indexOf('zh') > -1)? "zh": "en",
	    // defaultDate: ["2016-10-20", "2016-11-04"],
	    mode: 'range',
	    onChange: function (selectedDates, dateStr, instance) {
            var rule = angular.element(instance._input).scope().rule;
	    	if (selectedDates.length == 2) {
	    		var start = selectedDates[0].getTime();
	    		var end = selectedDates[1].getTime();
                rule.value = [start, end];
                $scope.recalculateResult();
	    		console.log(start, end)
	    	}
	    }
	};

    $scope.datePostSetup = function (fpItem, rule) {
        var value = rule.value;
        if (value.length === 1) {
            fpItem.setDate(new Date(value[0]))
        }
        else if (value.length === 2) {
            fpItem.setDate([
                new Date(value[0]),
                new Date(value[1])
            ]);
        }
    };

    $scope.$on("NEW.SMART.FOLDER", function(e, { smartFolder, parent }) {
        $scope.init();
        $scope.parent = undefined;
    	$scope.isOpen = true;
        $scope.smartFolder = undefined;
        $scope.folderName= '';
        $scope.conditions = [{
            rules: [{
                property: "name",
                method: "contain",
                value: ""
            }],
            match: "OR",
            boolean: "TRUE"
        }];
        $scope.originSmartFolder = smartFolder;
        if (!parent) {
            if (smartFolder && smartFolder.parent && $bodyScope.smartFolderMappings[smartFolder.parent]) {
                $scope.parent = $bodyScope.smartFolderMappings[smartFolder.parent];
            }
        }
        else {
            $scope.parent = $bodyScope.smartFolderMappings[parent.id];
        }
        $timeout(function () {
            $("#smart-folder-name-input").focus();
        }, 100);
    });

    $scope.$on("EDIT.SMART.FOLDER", function(e, smartFolder) {
        $scope.init();
        if (smartFolder) {
            var sf = angular.copy(smartFolder);
            $scope.isEditMode = true;
            $scope.smartFolder = smartFolder;
            $scope.isOpen = true;
            $scope.folderName= sf.name;
            $scope.conditions = sf.conditions;
            $scope.conditions.forEach(function (condition) {
                if (!condition.boolean) {
                    condition.boolean = "TRUE";
                }
            });
        }
        $scope.recalculateResult();
        $timeout(function () {
            $("#smart-folder-name-input").focus();
        }, 100);
    });

    $scope.init = function () {
        $scope.foldersSuggestion = [];
        eagle.utils.tree.walk($bodyScope.folders, 'children', function(folder, parent) {
            $scope.foldersSuggestion.push({
                value: folder.id,
                text: folder.name
            });
        });
    }

    $scope.nameKeydown = function(event) {
        var keyCode = event.keyCode;
        if (keyCode === 27) {
            $scope.cancel();
        }
        else if (keyCode === 13) {
            if (event.metaKey || event.ctrlKey) {
                $(event.target).blur();
                $scope.save();
            }
        }
    };

    $scope.createRule = function (condition, index) {
    	if (condition.rules.length >= 30) return;
    	var newRule = {
	        property: "name",
	        method: "contain",
	        value: ""
	    };
	    condition.rules.splice(index, 0, newRule);
        $scope.recalculateResult();
    };

    $scope.removeRule = function (condition, rule) {
        if (condition.rules.length == 1) return;
        var idx = condition.rules.indexOf(rule);
        if (idx > -1) {
            condition.rules.splice(idx, 1);
            $scope.recalculateResult();
        }
    };

    $scope.createCondition = function (index) {
        if ($scope.conditions.length >= 30) return;
        var newCondition = {
            rules: [{
                property: "name",
                method: "contain",
                value: ""
            }],
            match: "OR",
            boolean: "TRUE"
        };
        $scope.conditions.splice(index, 0, newCondition);
        $scope.recalculateResult();
    };

    $scope.removeCondition = function (condition) {
    	if ($scope.conditions.length === 0) return;
    	var idx = $scope.conditions.indexOf(condition);
    	if (idx > -1) {
    		$scope.conditions.splice(idx, 1);
            $scope.recalculateResult();
    	}
    };

    $scope.changeProperty = function (rule) {
    	switch(rule.property) {
    		case 'name':
    		case 'url':
    		case 'annotation':
            case 'camera':
    			rule.method = "contain";
    			rule.value = "";
    			break;
			case 'width':
    		case 'height':
    			rule.method = ">";
    			rule.value = [480, 0];
    			break;
            case 'fileSize':
                rule.method = ">";
                rule.value = [1, 0];
                rule.unit = 'mb';
                break;
			case 'shape':
    			rule.method = "equal";
    			rule.value = "landscape";
    			break;
            case 'rating':
                rule.method = "equal";
                rule.value = "5";
                break;
			case 'type':
    			rule.method = "equal";
    			rule.value = eagle.filter.filterTypes[0] || "png";
    			break;
			case 'color':
    			rule.method = "similar";
    			rule.value = "#0087EF";
    			break;
			case 'tags':
    			rule.method = "intersection";
    			rule.value = [];
    			break;
            case 'folders':
                rule.method = "intersection";
                rule.value = [];
                break;
			case 'createTime':
    			rule.method = "before";
    			rule.value = [];
    			// $scope.dateOpts = singleDate;
    			break;
            case 'mtime':
                rule.method = "before";
                rule.value = [];
                break;
            case 'btime':
                rule.method = "before";
                rule.value = [];
                break;
            case 'duration':
                rule.method = "<=";
                rule.value = [30, 0];
                rule.unit = 's';
                break;
            case 'bpm':
                rule.method = ">=";
                rule.value = [160, 0];
                break;
            case 'iso':
                rule.method = ">";
                rule.value = [100, 0];
                break;
            case 'aperture':
                rule.method = ">";
                rule.value = [3.5, 0];
                break;
            case 'focalLength':
                rule.method = ">";
                rule.value = [20.0, 0];
                break;
            case 'shutter':
                rule.method = ">";
                rule.value = [100.0, 0];
                break;
            case 'timestamp':
                rule.method = "before";
                rule.value = [];
                break;
            case 'fontActivated':
                rule.method = "activate";
                break;
    	}
        $scope.recalculateResult();
    };

    $scope.changeMethod = function (rule) {
    	switch(rule.property) {
    		case 'createTime':
            case 'mtime':
            case 'btime':
    			if (rule.method === 'between') {
    				rule.value = "";
    			}
                else if (rule.value.indexOf("~") > -1) {
                    rule.value = "";
                }
                else if (rule.method === 'within') {
                    rule.value[0] = 30;
                }
    			break;
    	}
        $scope.recalculateResult();
    };

    $scope.changeValue = function (rule, tags) {
        $scope.recalculateResult();
    };

    $scope.recalculateResult = function () {
        var $bodyScope = angular.element("body").scope();

        $bodyScope.currentSmartFolder = {
            "name": "",
            "conditions": $scope.conditions
        };
        if ($scope.smartFolder && $scope.smartFolder.parent) {
            $bodyScope.currentSmartFolder.parent = $scope.smartFolder.parent;
        }
        var result = $filter('filter')($bodyScope.raw, $bodyScope.contentFilter);
        var totalCount = result.length;
        $scope.totalCount = totalCount;
        $bodyScope.rebindRefresh();
    }; 

    $scope.save = function () {
        if (!$scope.folderName) {
            $scope.isNoFolderName = true;
            return;
        }
        else {
            $scope.isNoFolderName = false;
        }
        var $bodyScope = angular.element("body").scope();

        if (!$scope.isEditMode) {

            var smartFolder = {
                "id": guid(),
                "name": $scope.folderName,
                "conditions": $scope.conditions,
                "modificationTime": Date.now(),
                "children": []
            };

            let children = $bodyScope.smartFolders;
            if ($scope.parent) {
                if (!$scope.parent.children) {
                    $scope.parent.children = [];
                }
                children = $scope.parent.children;
                smartFolder.parent = $scope.parent.id;
                $scope.parent.isExpand = true;
            }

            var idx = children && children.length || 0;
            if ($scope.originSmartFolder) {
                idx = children.indexOf($scope.originSmartFolder) + 1;
            }

            children.splice(idx, 0, smartFolder);
            smartFolder.imageCount = $bodyScope.smartFolderCount(smartFolder);
            $bodyScope.smartFolderMappings[smartFolder.id] = smartFolder;
            $bodyScope.updateSidebarList();
            $bodyScope.openSmartFolder(smartFolder);
            setTimeout(function () { $bodyScope.changeSidebarIndex(smartFolder); }, 400);
            try {
                electronLog && electronLog.info(`[app] Create new smart-folder: ${smartFolder.name}(${smartFolder.id})`);
                electronLog && electronLog.info(`${JSON.stringify(smartFolder)}`);
                analytics.event('SmartFolder', 'Create', smartFolder.name);
            } catch (err) {}
        }
        else {
            $scope.smartFolder.name = $scope.folderName;
            $scope.smartFolder.conditions = $scope.conditions;
            $scope.smartFolder.modificationTime = Date.now();
            $scope.smartFolder.imageCount = $bodyScope.smartFolderCount($scope.smartFolder);
            if ($scope.smartFolder) {
                $bodyScope.updateSidebarList();
                $bodyScope.openSmartFolder($scope.smartFolder);
                setTimeout(function () { $bodyScope.changeSidebarIndex($scope.smartFolder); }, 400);
                try {
                    electronLog && electronLog.info(`[app] Edit smart-folder: ${$scope.smartFolder.name}(${$scope.smartFolder.id})`);
                    electronLog && electronLog.info(`${JSON.stringify($scope.smartFolder)}`);
                    analytics.event('SmartFolder', 'Rename', smartFolder.name);
                } catch (err) {}

                setTimeout(function () {
                    eagle.utils.tree.walk($scope.smartFolder.children, 'children', function (csf, parent, depth) {
                        csf.imageCount = $scope.smartFolderCount(csf);
                    });
                    $scope.$evalAsync();
                }, 200);
            }
        }
        $bodyScope.saveFolder();
        $scope.isEditMode = undefined;
        $scope.smartFolders = undefined;
        $scope.isOpen = false;
        $("#smart-folder-name-input").attr("tabindex", -1);
    };

    $scope.cancel = function() {
        var $bodyScope = angular.element("body").scope();
        // if ($scope.smartFolder) {
        //     $bodyScope.openSmartFolder($scope.smartFolder, false);
        // }
        $("#smart-folder-name-input").attr("tabindex", -1);
        if ($scope.isEditMode) {
            $bodyScope.currentSmartFolder = $scope.smartFolder || undefined;
        }
        else {
            $bodyScope.currentSmartFolder = $scope.originSmartFolder || undefined;
        }
        $scope.folder = undefined;
        $scope.isEditMode = undefined;
        $scope.isOpen = false;
        $bodyScope.rebindRefresh();
        // $bodyScope.filterContent();
        $bodyScope.$evalAsync();
    };
});
