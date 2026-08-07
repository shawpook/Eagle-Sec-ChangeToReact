EagleApp.directive('filterItemTags', function($rootScope, $timeout) {
    return {
        restrict: 'E',
        templateUrl: 'js/directives/filter-item-tags.html',
        replace: true,
        link: function($scope, elem, attrs) {

        	$scope.$body = angular.element("body").scope();
        	$scope.tagsList = $scope.$body.containTags;
        	$scope.rule;
        	$scope.displayName = i18n.__("filter.tags");
        	$scope.isEnabled = false;
        	$scope.filterMode = "ALL";
        	$scope.selectedGroup = undefined;
        	$scope.tagsGroupsSidebar = {};
            $scope.rule = eagle.filter.tagFilterLogic;

        	$scope.$watch("$body.containTags", function (newValue) {
        		$scope.updateTagsList();
        	});

            $scope.toggleAllTags = function () {
                var isAllSelected = $scope.isAllSelected();
                if (isAllSelected) {
                    for (var i = 0; i < $scope.tagsList.length; i++) {
                        var tag = $scope.tagsList[i];
                        delete tag.isSelected;
                        var idx = eagle.filter.filterRules.tag.includes.indexOf(tag.name);
                        if (idx > -1) {
                            eagle.filter.filterRules.tag.includes.splice(idx, 1);
                        }
                    }
                }
                else {
                    for (var i = 0; i < $scope.tagsList.length; i++) {
                        var tag = $scope.tagsList[i];
                        tag.isSelected = true;
                        eagle.filter.filterRules.tag.includes.push(tag.name);
                    }
                }
                eagle.filter.filterRules.tag.includes = [...new Set(eagle.filter.filterRules.tag.includes)];
                if (eagle.filter.tagFilterLogic === "AND" || eagle.filter.tagFilterLogic === "EQUAL") {
                    $("#filter-panel .tags-container").scrollTop(0);
                }

                $scope.$body.filterContent();
                $scope.$body.calculateFilterCounts();
                $scope.focusInput();
                $scope.changeDisplayName();
            };

            $scope.isAllSelected = function () {
                if (!$scope.isEnabled) { return false; }
                for (var i = 0; i < $scope.tagsList.length; i++) {
                    if (!$scope.tagsList[i].isSelected) {
                        return false;
                    }
                }
                return true;
            };

        	$scope.filterSelected = function () {
        		$scope.filterMode = "SELECTED";
        		$scope.updateTagsList();
        	};

        	$scope.filterAll = function () {
        		$scope.filterMode = "ALL";
        		$scope.selectedGroup = undefined;
        		$scope.updateTagsList();
        	};

        	$scope.filterWithGroup = function (group) {
        		$scope.filterMode = "GROUP";
        		$scope.selectedGroup = group;
        		$scope.updateTagsList();
        	};

        	$scope.changeRule = function (rule) {
                eagle.filter.tagFilterLogic = rule;
        		if ($scope.selectedCount > 0) {
	        		$scope.$body.page = 1; 
	        		$scope.$body.filterContent();
        		}
        		$scope.focusInput();
        	};

            function filterTags (tags, keyword) {

                if (!keyword) return tags;
                var keyword_cn = chineseConvert.tw2cn(keyword).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\ /g, '').toLowerCase();

                var tagSearchItems = tags.map(tag => {
                    var tagNameCN = chineseConvert.tw2cn(tag.name).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                    if (keyword.length >= 30 || tag.name.length >= 30) {
                        return {
                            tag: tag,
                            name: tagNameCN,
                            search: [tagNameCN]
                        }
                    }
                    return {
                        tag: tag,
                        name: tagNameCN,
                        search: [tagNameCN, ..._.uniq(
                            cartesianProduct(pinyinlite(tagNameCN, { keepUnrecognized : true }).filter(p => p.length > 0))
                            .map(item => item.join(' '))
                        )],
                    };
                });

                var scores = tagSearchItems.map(item => {
                    return {
                        item: item,
                        name: item.name,
                        score: _.max(item.search.map(pinyin => pinyin.score(keyword_cn))),
                    };
                })
                
                var result = scores.filter(i => i.score > 0).sort((a, b) => b.score - a.score).map(function (i) {
                    return i.item.tag;
                });

                return result;
            }

        	$scope.updateTagsList = function () {

        		var originLength = $scope.tagsList.length;
        		var collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' } );
        		var result = $scope.$body.containTags;

                var selectedTags = $scope.$body.containTags.filter(function (tag) {
            		if (!tag) return false;
		            return tag.isSelected || tag.isExcluded;
        		});
        		$scope.selectedCount = selectedTags.length;

                if ($scope.filterMode === 'SELECTED') {
                	result = selectedTags;
                }
                else {
                	if ($scope.$body.tagKeyword) {
                        result = filterTags(result, $scope.$body.tagKeyword);
	                }

	                $scope.tagsGroupsSidebar = {};
	                result.forEach(function (tag) {
                        if (!tag) return;
                        try {
                            let originTag = $scope.$body.TagManager.tagMappings[tag.name];
                            if (originTag && originTag.groups && originTag.groups.length > 0) {
                                originTag.groups.forEach(function (groupId) {
                                    if (!$scope.tagsGroupsSidebar[groupId]) {
                                        $scope.tagsGroupsSidebar[groupId] = 1;
                                    }
                                    else {
                                        $scope.tagsGroupsSidebar[groupId]++;
                                    }
                                });
                            }
                        } catch (err) {}
	                });

	                $scope.allTagsCount = result.length;

	                if ($scope.selectedGroup) {

                        let groupTagsMap = {};
                        $scope.selectedGroup.tags.forEach(function (tag) {
                            groupTagsMap[tag] = true;
                        });

                        result = result.filter(function (tag) {
                            return groupTagsMap[tag.name];
                        });
	                }

                    if (!$scope.$body.tagKeyword) {

                        const tagGroupsIndexMap = {};
                        $bodyScope.TagManager.groups.forEach((tagGroup, index) => {
                            tagGroupsIndexMap[tagGroup.id] = index;
                        });

                        // sort by group and alphabet
                        result = result.sort((a, b) => {
                            const aName = a.name;
                            const bName = b.name;
                            const aGroup = (a?.group?.id)? a?.group?.id : undefined;
                            const bGroup = (b?.group?.id)? b?.group?.id : undefined;
                            
                            if (aGroup === bGroup) {
                                if (aName < bName) return -1;
                                if (aName > bName) return 1;
                            }
                
                            const aGroupIdx = tagGroupsIndexMap[aGroup];
                            const bGroupIdx = tagGroupsIndexMap[bGroup];
                            if (!aGroup && bGroup) return 1;
                            if (aGroup && !bGroup) return -1;
                            if (aGroupIdx < bGroupIdx) return -1;
                            if (aGroupIdx > bGroupIdx) return 1;
                       
                            return 0;
                        });
                    }
                }

                $scope.tagsList = result;

        		if ($scope.tagsList.length !== originLength) {
        			$("#filter-tags-container").scrollTop(0);
        		}
        	};

        	$scope.tagsFilterChange = function () {
        		$scope.updateTagsList();
        		$("#filter-tags-container").scrollTop(0);
                setTimeout(function () {
                    $("#filter-tags-container .check-item.active").removeClass("active")
                    $("#filter-tags-container .check-item").eq(0).addClass("active");
                }, 33);
        	};

        	$scope.changeDisplayName = function () {
        		var displayName = i18n.__("filter.tags");
    			if (eagle.filter.filterRules.tag.includes.length > 0 || eagle.filter.filterRules.tag.excludes.length > 0 || eagle.filter.filterRules.tag.no) {
    				displayName = ``;
    				var arr = [];
    				if (eagle.filter.filterRules.tag.no) {
    					arr.push(i18n.__("Filter.NoTags"));
    				}
    				eagle.filter.filterRules.tag.includes.forEach(function (tagName) {
    					arr.push(tagName);
    				});
    				eagle.filter.filterRules.tag.excludes.forEach(function (tagName) {
    					arr.push(`-${tagName}`);
    				});
    				if (arr.length > 0) {
    					$scope.isEnabled = true;
    					displayName += arr.join(",");
    					$scope.displayName = displayName;
                        analytics.event('Filter', 'Tag');
    				}
    				else {
    					$scope.isEnabled = false;
    					$scope.displayName = i18n.__("filter.tags");
    				}
    			}
    			else {
    				$scope.isEnabled = false;
    				$scope.displayName = i18n.__("filter.tags");
    			}
        		setTimeout(function () { $scope.$body.updateContainerHieght();}, 300);
        	}
        	$scope.clearTagsFilter = function (event) {
        		event && event.stopPropagation();
        		eagle.filter.filterRules.tag.includes.length = 0;
        		eagle.filter.filterRules.tag.excludes.length = 0;
        		eagle.filter.filterRules.tag.no = false;
        		$scope.$body.page = 1;
                $scope.$body.reload();
        		$scope.changeDisplayName();
        	}
        	$scope.$on("Reset_Filter", function (event) {
        		$scope.changeDisplayName();
        	});
            $scope.$on("Update_Tags_Filter", function () {
                $scope.changeDisplayName(); 
           });
		}
	}
});
