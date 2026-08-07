EagleApp.directive('tagsPopupDraggable', function($rootScope) {
    return {
        restrict: 'A',
        link: function(scope, element, attrs, ngModel) {

            var $popup = $("#tags-popup");
            var customizeHeight = localStorage["eagle.tagsPopup.height"];
            if (customizeHeight) {
                element.height(parseInt(customizeHeight));
            }

            scope.$watch("isTagsPopupPined", function () {
                if (!scope.isTagsPopupPined) {
                    $(element).draggable( 'disable' );
                    // $(element).resizable( 'disable' );
                }
                else {
                    $(element).draggable( 'enable' );
                    // $(element).resizable( 'enable' );
                }
            });

            // 窗口 draggable
            $(element).draggable({
                scroll: false,
                containment: "body",
                start: function (e, ui) {
                },
                stop: function () {
                }
            });
            $(element).draggable( 'disable' );

            // 窗口 resizable
            $(element).resizable({
                maxWidth: 1280,
                minWidth: 200,
                minHeight: 160,
                maxHeight: 1280,
                containment: "body",
                handles: "n, e, s, w, ne, se, sw, nw",
                // 保存用户设置尺寸
                stop: function (event, ui) {
                    var height = element.height();
                    localStorage.setItem("eagle.tagsPopup.height", height);
                }
            });

            var resizeTimeout;
            $(window).on("resize.popupdnd", function () {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(function () {
                    if ($rootScope.isTagsPopupPined) {

                        if (!$("#tags-popup").hasClass("open")) return;

                        var windowHeight = $(window).height();
                        var windowWidth = $(window).width();
                        var popupHeight = $popup.height();
                        var popupWidth = $popup.width();
                        var popupTop = $popup.offset().top;
                        var popupLeft = $popup.offset().left;

                        if (popupLeft + popupWidth > windowWidth) {
                            var move = popupLeft + popupWidth - windowWidth + 20;
                            $popup.css("left", `${popupLeft - move}px`);
                        }

                        if (popupHeight + 60 + popupTop > windowHeight) {
                            popupHeight = windowHeight - 60;
                            $popup.height(popupHeight - popupTop);
                        }
                    }
                }, 333);
            });

        }
    }
});

EagleApp.directive('tagInputTrigger', function($rootScope) {
    return {
        restrict: 'A',
        link: function(scope, element, attrs, ngModel) {

        	var $popup = $("#tags-popup");
            var $popupOverlay = $("#tags-popup-overlay");
        	var $triangle = $("#tags-popup .triangle");
        	var $trigger = $("[tag-input-trigger]");
            var isMoved = false;
            var $bodyScope = angular.element("body").scope();

        	element.on("click", function (event) {
        		event.stopPropagation();
        		openPopup();
        	});

        	$(".tags-popup-overlay").not(".tags-input").on("click", function () {
        		closeTagPopup();
                // 如果没有做任何更动，不该触发
                if ($bodyScope.TagManager.isDirty) {
                    $bodyScope.TagManager.isDirty = false;
                    $rootScope.$broadcast("CALCULATE_IMAGE_BINDING", {
                        ignoreSort: true
                    });
                }
        	});

            scope.$on("UPDATE-TAGS-POPUP", function () {
                console.time(`$scope.TagManager.getSuggestTags`);
                scope.TagManager.getSuggestTags(scope.selected);
                console.timeEnd(`$scope.TagManager.getSuggestTags`);
               // openPopup();
            });

            scope.$on("MOVE_TAGS_POPUP", function () {
                movePopup();
            });

            scope.$on("CLOSE-TAGS-POPUP", function () {
               closeTagPopup(); 
               $rootScope.$broadcast("CALCULATE_IMAGE_BINDING", {
                    ignoreSort: true
                });
            });

        	element.on("focus", function (event) {
        		openPopup();
        	});

        	var resizeTimeout;
        	$(window).on("resize.popup", function () {
        		clearTimeout(resizeTimeout);
        		resizeTimeout = setTimeout(function () {
                    if (!$rootScope.isTagsPopupPined) {
                        movePopup();
                    }
        		}, 200);
        	});

        	function focusInput () {
				$("#tag-search-input").focus();
				setTimeout(function () {
					$("#tag-search-input").focus();
				}, 50);
			};

        	function openPopup () {
                scope.TagManager.tagSearchKeyword = "";
                console.time(`$scope.TagManager.getSuggestTags`);
                scope.TagManager.getSuggestTags(scope.selected);
                console.timeEnd(`$scope.TagManager.getSuggestTags`);
                setTimeout(function () {
            		$popup.addClass("open");
                    if (!$rootScope.isTagsPopupPined) {
                        movePopup();
                    }
                    scope.TagManager.focusTag(50);
            		focusInput();
                }, 50);
                angular.element("#tags-popup").scope().tagViewLayoutMode = localStorage.getItem("eagle.tagsPopup.layout") || "INLINE";
                angular.element("#tags-popup").scope().$evalAsync();
        	};

        	function movePopup() {

                // TODO: 如果已经跑出画面，需要把视窗重新拉回原来位置
                if (!$popup.hasClass("open") && !$rootScope.isTagsPopupPined) return;

                var windowHeight = $(window).height();
                var popupHeight = $popup.height();
                var popupWidth = $popup.width();

                // if (popupHeight + 80 > windowHeight) {
                //     popupHeight = windowHeight - 80;
                //     $popup.height(popupHeight);
                // }

        		// 计算出现位置
        		var offsetPopup = 15;
        		var top = element.offset().top + element.height() / 2 - popupHeight / 2;
        		var left = element.offset().left - popupWidth - offsetPopup;

        		// 避免跑出視窗外
        		var deltaY = top + popupHeight - windowHeight + 20;
                var fixedY;

                // 避免窗口超出屏幕外
                if (top <= 45) {
                    fixedY = 45 - top;
                    top = 45;
                }
                
        		if (deltaY > 0) {
        			top -= deltaY;
        			$triangle.css("margin-top", deltaY);
        		}
        		else {
                    if (fixedY) {
                        $triangle.css("margin-top", -fixedY);
                    }
                    else {
        			    $triangle.css("margin-top", 0);
                    }
        		}
        		
        		$popup.css({
                    // zIndex: zIndex + 1,
        			top: top,
        			left: left
        		});
        	};
        }
    }
});

EagleApp.controller("TagPopupController", function($scope, $timeout, $rootScope, $filter) {

	var TagManager = $scope.TagManager;
    var $bodyScope = angular.element("body").scope();

    $scope.showCreateButton = true;
    $scope.showSuggestion = true;
    $scope.showRecent = true;
    $scope.showFavorite = true;

	$("#tags-popup").on("mousedown", "*", function () {
		focusInput();
	});

	$scope.$on("FOCUS.TAG.INPUT", function (event) {
		focusInput();
	});

    $scope.closeTagPopup = function () {
        closeTagPopup();
    };

    $scope.toggleSuggestions = function () {
        $scope.showSuggestion = !$scope.showSuggestion;
    }

    $scope.toggleRecents = function () {
        $scope.showRecent = !$scope.showRecent;
    }

    $scope.toggleFavorites = function () {
        $scope.showFavorite = !$scope.showFavorite;
    }

    $scope.toogleAllGroup = function (group) {
        var currentCollapse = true;
        if (group) {
            currentCollapse = !!group.collapse;
        }
        TagManager.groups.forEach(function (g) {
            g.collapse = !currentCollapse;
        })
    };

    $scope.scrollToTagGroupPopup = function(group) {
        var $current = $("#tag-group-" + group.name + '-popup');
        var offsetTop = $(".tags-popup .tags-container").height() / 2 - $current.height() / 2;
        $(".tags-popup .tags-container").scrollTo($current, 200, {
            axis: 'y',
            offset: {
                top: -offsetTop,
            }
        });
    };

    function updateSearchResult () {

        if (!$scope.tags) return;

		$scope.searchResult = $scope.tags.map(function (tag) {
			return {
				name: tag.name,
				pinyin: tag.pinyin,
                color: tag.color
			}
		});

        $scope.showCreateButton = true;
        $scope.searchResult.forEach(function (tag) {
            delete tag.active;
            if ( tag.name === TagManager.tagSearchKeyword ) {
                $scope.showCreateButton = false;
                return;
            }
        });

        // if ($scope.mode === 'all') {
    		TagManager.suggestions.forEach(function (tag) {
                var t = {
                    name: tag,
                    pinyin: tinyPinyin.convertToPinyin(tag)
                };
                // 如果这个标签不是用户创建，那应该要在视觉上做区隔
                if (!TagManager.tagMappings[tag]) {
                    t.suggestion = "not-user-create";
                    $scope.searchResult.push(t);
                }
    		});
            
            TagManager.historyTags.forEach(function (tag) {
                // if (!TagManager.tagMappings[tag]) {
                    $scope.searchResult.push({
                        name: tag,
                        pinyin: tinyPinyin.convertToPinyin(tag)
                    });
                // }
            });
        // }

        $scope.searchResult = filterTags($scope.searchResult, TagManager.tagSearchKeyword);

        // 去重複
        var uniqueMap = {};
        var uniqueResult = [];
        $scope.searchResult.forEach(function (tag) {
            if (!uniqueMap[tag.name]) {
                uniqueResult.push(tag);
                uniqueMap[tag.name] = true;
            }
        });
        $scope.searchResult = uniqueResult;

        // 字数长短排序
        $scope.searchResult = $scope.searchResult.sort(function (a, b) {
            if (!TagManager.tagSearchKeyword) return;
            var keyword = TagManager.tagSearchKeyword.toLowerCase();
            var aName = a.name.toLowerCase();
            var bName = b.name.toLowerCase();
            var idxA = aName.indexOf(keyword);
            if (idxA === -1) return 0;
            var idxB = bName.indexOf(keyword);
            if (idxB === -1) return 0;
            var aName = a.name;
            var bName = b.name;
            if (aName.length > bName.length) {
                return 1;
            }
            else if (aName.length < bName.length) {
                return -1;
            }
            else {
                return 0;
            }
        });

        // indexOf 位置排序
        $scope.searchResult = $scope.searchResult.sort(function (a, b) {
            if (!TagManager.tagSearchKeyword) return;
            
            if (a.name === TagManager.tagSearchKeyword) return -1;
            if (b.name === TagManager.tagSearchKeyword) return 1;

            var keyword = TagManager.tagSearchKeyword.toLowerCase();
            var aName = a.name.toLowerCase();
            var bName = b.name.toLowerCase();
            var idxA = aName.indexOf(keyword);
            var idxB = bName.indexOf(keyword);

            if (idxA === -1 && idxB !== -1) return 1;
            if (idxA !== -1 && idxB === -1) return -1;
            if (idxA > idxB) {
                return 1;
            }
            else if (idxA < idxB) {
                return -1;
            }
        });

        let searchResultTagsMap = {};
        let hasGroupTagsMap = {};
        $scope.searchResult.forEach(function (tag) {
            searchResultTagsMap[tag.name] = tag;
        });

        // 以 tag group 結構顯示
        $scope.searchResultGroups = [];
        TagManager.groups.forEach(function (tagGroup) {
            let newGroup = {
                name: tagGroup.name,
                tags: []
            };
            tagGroup.tags.forEach(function (tag) {
                if (searchResultTagsMap[tag]) {
                    newGroup.tags.push(tag);
                    hasGroupTagsMap[tag] = true;
                }
            });
            if (newGroup.tags.length > 0) {
                $scope.searchResultGroups.push(newGroup);
            }
        });

        let unfiledGroup = {
            name: i18n.__('general.pages.unfiled'),
            tags: []
        };
        $scope.searchResult.forEach(function (tag) {
            if (!hasGroupTagsMap[tag.name]) {
                unfiledGroup.tags.push(tag.name);
            }
        });
        if (unfiledGroup.tags.length > 0) {
            $scope.searchResultGroups.push(unfiledGroup);
        }

        if (!$scope.showCreateButton && $scope.searchResult[0]) {
            $scope.searchResult[0].active = true;
        }
        $timeout(function () {
            $("#tags-popup .tag:visible").eq(0).addClass("active");
        }, 50);
    }

	$scope.$watch('TagManager.tagSearchKeyword', updateSearchResult);

	function focusInput () {
		$("#tag-search-input").focus();
		setTimeout(function () {
			$("#tag-search-input").focus();
		}, 50);
	};

	function autoScroll () {
		var $container = $("#tags-popup .tags-container:visible");
        var height = $container.height(),
        	box = $("#tags-popup .tag.active:visible");
            scrollTop = box || box.offset().top,
            offset = height / 2 - box.height();
        $container.stop().scrollTo(box, 50, { axis: 'y', offset: -offset, queue: false });
	};

    // $scope.tagSearchKeyword = "";
    if (!localStorage["eagle.tagsPopup.mode"]) {
        localStorage.setItem("eagle.tagsPopup.mode", "all")
    }
    $scope.mode = localStorage["eagle.tagsPopup.mode"] || "all" ; // all, recent, starred

    $scope.togglePinned = function () {
        $rootScope.isTagsPopupPined = !$rootScope.isTagsPopupPined;
        $rootScope.$broadcast("MOVE_TAGS_POPUP");
        if ($rootScope.isTagsPopupPined) {
            electronLog && electronLog.info("[app] Tags-popup always on top: ON");
        }
        else {
            electronLog && electronLog.info("[app] Tags-popup always on top: OFF");
        }
    };

	$scope.changeMode = function (mode) {
        $scope.mode = mode;
        localStorage.setItem("eagle.tagsPopup.mode", mode);
		$scope.TagManager.focusTag(10);
	};

    $scope.tagViewLayoutMode = localStorage.getItem("eagle.tagsPopup.layout") || "INLINE";
    $scope.toggleTagLayout = function () {
        if ($scope.tagViewLayoutMode === "LIST") {
            $scope.tagViewLayoutMode = "INLINE";
        }
        else {
            $scope.tagViewLayoutMode = "LIST";
        }
        localStorage.setItem("eagle.tagsPopup.layout", $scope.tagViewLayoutMode);
    }

    $scope.tagPaste = function (event) {

        try {
            var clipboardHTML = clipboard.readHTML();
            var linkTexts = [];
            $(`<div>${clipboardHTML}</div>`).find("a").each(function () {
                if (this.textContent) {
                    linkTexts.push(this.textContent);
                }
            });
            if (linkTexts.length > 2) {
                event.preventDefault();
                TagManager.createTag(linkTexts.join(","));
            }
        } catch (err) {}

        var text = clipboard.readText();
        var tags = text.split(/[，,;\n]+/);
        if (tags.length > 1) {
            event.preventDefault();
            TagManager.createTag(tags.join(","));
        }
    }

	$scope.tagSearchKeyup = throttle(function (event) {
		var keyCode = event.keyCode;
		if (keyCode === 37 || keyCode === 38 || keyCode === 39 || keyCode === 40 || keyCode === 13 || keyCode === 27 ) {
			if (process.platform == 'darwin' && event.shiftKey && event.metaKey && (keyCode === 37 || keyCode === 39)) {
				return;
			}
            if (event.shiftKey || event.metaKey) {
                return;
            }
            // event.preventDefault();
		}
		// up
		if (keyCode === 38) {
            var $arround = $("#tags-popup .tag:visible");
            var $currentActive = $("#tags-popup .tag.active:visible");
            var boxOffest = $currentActive.offset();
            if (!boxOffest) return;
            var boxCenterX = boxOffest.left + $currentActive.width() / 2;
            var boxCenterY = boxOffest.top + $currentActive.height() / 2;
            var $target;
            var d = 100000;
            $arround.each(function(index) {
                var $b = $(this);
                var offset = $b.offset();
                var bx = $b.width() / 2 + offset.left;
                var by = $b.height() / 2 + offset.top;
                var td = Math.sqrt((boxCenterY - by) * (boxCenterY - by) + (boxCenterX - bx) * (boxCenterX - bx));
                if (boxOffest.top > offset.top && Math.abs(boxOffest.top - offset.top) > 20) {
                    if (td < d) {
                        d = td;
                        $target = $b;
                    }
                }
            });
            if ($target) {
	            $currentActive.removeClass("active");
	            $target.addClass("active");
	            autoScroll();
            }
            else {
            	TagManager.focusTag();
            }
        } 
        // down
        else if (keyCode === 40) {
            var $arround = $("#tags-popup .tag:visible");
            var $currentActive = $("#tags-popup .tag.active:visible");
            var boxOffest = $currentActive.offset();
            if (!boxOffest) return;
            var boxCenterX = boxOffest.left + $currentActive.width() / 2;
            var boxCenterY = boxOffest.top + $currentActive.height() / 2;
            var $target;
            var d = 100000;
            $arround.each(function(index) {
                var $b = $(this);
                var offset = $b.offset();
                var bx = $b.width() / 2 + offset.left;
                var by = $b.height() / 2 + offset.top;
                var td = Math.sqrt((boxCenterY - by) * (boxCenterY - by) + (boxCenterX - bx) * (boxCenterX - bx));
                if (boxOffest.top < offset.top && Math.abs(boxOffest.top - offset.top) > 20) {
                    if (td < d) {
                        d = td;
                        $target = $b;
                    }
                }
            });

            if ($target) {
	            $currentActive.removeClass("active");
	            $target.addClass("active");
	            autoScroll();
            }
            else {
            	TagManager.focusTag();
            }
            // autoScroll(target);
        } 
        // left
        else if (keyCode === 37) {
            var $currentActive = $("#tags-popup .tag.active:visible");
            var $tags = $("#tags-popup .tag:visible");
            var idx = $tags.index($currentActive);
            if (idx - 1 >= 0) {
            	var $target = $tags.eq(idx - 1);
	            $currentActive.removeClass("active");
	            $target.addClass("active");
	            autoScroll();
            }
        } 
        // right
        else if (keyCode === 39) {
            var $currentActive = $("#tags-popup .tag.active");
            var $tags = $("#tags-popup .tag:visible");
            var idx = $tags.index($currentActive);
            if (idx + 1 < $tags.length) {
            	var $target = $tags.eq(idx + 1);
	            $currentActive.removeClass("active");
	            $target.addClass("active");
	            autoScroll();
            }
        } 
        // esc
        else if (keyCode === 27) {
            event.preventDefault();
        	if (TagManager.tagSearchKeyword) {
	            TagManager.tagSearchKeyword = "";
	            TagManager.focusTag();
            }
            else {
                if (!$rootScope.isTagsPopupPined) {
                   closeTagPopup();
                }
                else {
                    $("#tag-search-input").blur();
                }
                // 如果没有做任何更动，不该触发
                if ($bodyScope.TagManager.isDirty) {
                    $bodyScope.TagManager.isDirty = false;
                    $rootScope.$broadcast("CALCULATE_IMAGE_BINDING", {
                        ignoreSort: true
                    });
                }
            }
        }
        // enter
        else if (keyCode === 13) {
            var $currentActive = $("#tags-popup .tag.active:visible").eq(0);
            var tagName = $currentActive.find(".name span.keyword").text();
            if (tagName) {
            	TagManager.toggleTag(event, tagName);
            	TagManager.focusTag(150);
            }
        }
        else if (keyCode === 9) {
        	event.preventDefault();
            if (!$rootScope.isTagsPopupPined) {
        	   $(".inspector .annotation").focus();
            }
            else {
                $("#tag-search-input").blur();
            }
        }
	}, 100, true);

	$scope.$on("FOCUS-POPUP-TAG", function (e) {
		TagManager.focusTag(50);
	});

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
	
	$scope.popupSearchFilter = function(tag) {
        var pinyinMatch = false;
        var nameMatch = false;
        if (TagManager.tagSearchKeyword == "") return true;
        if (tag && tag.name) {
            nameMatch = fuzzy_match(tag.name, TagManager.tagSearchKeyword).length > 0;
            if (nameMatch) return true;

            var keyword_cn = chineseConvert.tw2cn(TagManager.tagSearchKeyword);
            var keyword_tw = chineseConvert.cn2tw(TagManager.tagSearchKeyword);
            if (keyword_cn !== keyword_tw) {
                var nameCNMatch = fuzzy_match(tag.name, keyword_cn).length > 0;
                if (nameCNMatch) return true;
                var nameTWMatch = fuzzy_match(tag.name, keyword_tw).length > 0;
                if (nameTWMatch) return true;
            }

            if (tag.pinyin) {
                pinyinMatch = fuzzy_match(tag.pinyin, TagManager.tagSearchKeyword).length > 0;
            }
            return nameMatch || pinyinMatch;
        }
        return false;
    };

    $scope.popupSearchOrder = function(tag) {
        if (!TagManager.tagSearchKeyword) return;
        var sum = 0;
        var firstB = 0;
        $("<div></div>").append(fuzzy_match(tag.name, TagManager.tagSearchKeyword)).contents().each(function(idx) {
            if (this.tagName == 'B') {
                if (sum == 0) {
                    firstB = idx;
                }
                sum -= Math.pow(2, 10 - idx + firstB);
            }
        });
        return sum;
    };
});

function closeTagPopup () {
    $("#tags-popup").removeClass("open");
    $("[tag-input-trigger]").removeClass("focus");
}