var rectSelection = {};
var rectSelecting = false;

EagleApp.directive('rectSelect', function($rootScope, $filter) {
    return {
        link: function($scope, element, attrs) {

            rectSelection = {},
            rectSelecting = false;
            var startX, startY;
            var offset = $(element).offset();
            var $rect = $('<div class="rect""></div>').hide();
            var maxHeight;
            var gridItems;
            var originSelected = [];
            var originSelectedMappings = {};
            var isMultipleSelecting;
            var selected = [];
            var windowHeight;
            var $container = $("#box-container");

            $container.prepend($rect);

            element.on("mousedown", function(e) {

                if (e && $container.outerWidth() <= e.offsetX + 10) {
                    e.stopPropagation();
                    return;
                }

                if (e.which != 1 || $scope.isDetailMode) return;
                isMultipleSelecting = e.metaKey || e.ctrlKey;

                offset = $(element).offset();
                gridItems = ig.getItems(true);
                windowHeight = $(window).height();
                // maxHeight = $(".box-list").height();

                if (event.metaKey || event.shiftKey || event.ctrlKey) {

                }
                else {
                    for (var i = 0; i < gridItems.length; i++) {
                        var el = gridItems[i].el;
                        if (!isMultipleSelecting) {
                            if (el) {
                                el.classList.remove("selected");
                            }
                        }
                    }
                    if (!isMultipleSelecting) {
                        $scope.selectedMappings = {};
                    }
                }

                originSelectedMappings = angular.copy($scope.selectedMappings);

                rectSelection.startX = startX = e.pageX - offset.left;
                rectSelection.startY = startY = e.pageY - offset.top + $(element).scrollTop();
                rectSelecting = true;

                if ($("#box-container .rect").length == 0) {
                    $container.prepend($rect);
                }

                $rect.css({
                    transform: "none",
                    top: rectSelection.startY,
                    left: rectSelection.startX,
                });

                $rect.show();
                $rootScope.currentFocus = "content";

            });

            $(window).on("mouseup.rectSelect", function(e) {

                if (!rectSelecting) return;
                if ($scope.isDetailMode) {
                    return;
                }

                rectSelection = {};
                rectSelecting = false;

                $rect.css({
                    top: 0,
                    left: 0,
                    width: 0,
                    height: 0,
                    display: "none",
                    transform: "none"
                });

                $scope.selected = $scope.allData.filter(function (image) {
                    return $scope.selectedMappings[image.id];
                });

                $scope.$evalAsync();
            });

            $(window).on("mousemove.rectSelect", function(e) {

                isMultipleSelecting = e.metaKey || e.ctrlKey;

                if (rectSelecting) {

                    var scrollTop = $(element).scrollTop(),
                        flipX = startX > e.pageX - offset.left,
                        flipY = startY > e.pageY - offset.top + scrollTop;

                    rectSelection.w = Math.abs((e.pageX - offset.left) - startX);
                    rectSelection.h = Math.abs((e.pageY - offset.top) - startY + scrollTop);

                    if (flipX) {
                        rectSelection.startX = startX - rectSelection.w;
                    }
                    if (flipY) {
                        rectSelection.startY = startY - rectSelection.h;
                    }

                    // Note: electron@2.0.2 开始，滑鼠拖拽在窗口边缘不会自动滚动，所以自己处理
                    if (e.pageY <= offset.top + 24) {
                        element.scrollTop(scrollTop - 48);
                    }
                    else if (e.pageY >= windowHeight - 24) {
                        element.scrollTop(scrollTop + 48);
                    }

                    $rect.css({
                        transform: "none",
                        top: rectSelection.startY,
                        left: rectSelection.startX,
                        width: rectSelection.w,
                        height: rectSelection.h,
                    });

                    // gridItems = ig.getItems(true);
                    gridItems = ig.getItems(true);
                    for (var i = 0; i < gridItems.length; i++) {

                        var el = gridItems[i].el;
                        if ( !el || !gridItems[i] ) { continue; };
                        // var id = el.id.replace("box-", "");
                        var id = el.getAttribute("data-box-id");

                        if (!isMultipleSelecting) {
                            if (contain(gridItems[i])) {
                                if (!el.classList.contains("selected")) {
                                    el.classList.add("selected");
                                    $scope.selectedMappings[id] = true;
                                }
                            }
                            else {
                                if (el.classList.contains("selected")) {
                                    el.classList.remove("selected");
                                    delete $scope.selectedMappings[id];
                                }
                            }
                        }
                        else {
                            var isOriginalSelected = originSelectedMappings[id];
                            if (contain(gridItems[i])) {
                                if (isOriginalSelected) {
                                    el.classList.remove("selected");
                                    $scope.selectedMappings[id] = false;
                                }
                                else {
                                    el.classList.add("selected");
                                    $scope.selectedMappings[id] = true;
                                }
                            }
                            else {
                                if (isOriginalSelected) {
                                    el.classList.add("selected");
                                    $scope.selectedMappings[id] = true;
                                }
                                else {
                                    el.classList.remove("selected");
                                    $scope.selectedMappings[id] = false;
                                }
                            }
                        }
                    }
                }
            });

            function contain(gridItem) {
                var offsetX = 16;
                var offsetY = 16;
                var w, h;
                if ($scope.layout === "JustifiedLayout") {
                    w = gridItem.rect.width;
                    h = gridItem.rect.height;
                }
                // NOTE: 瀑布流布局取得的属性不同
                else {
                    w = gridItem.size.width;
                    h = gridItem.size.height;
                }
                var a = {
                        width: w,
                        height: h,
                        x: gridItem.rect.left,
                        y: gridItem.rect.top
                    },
                    b = {
                        width: rectSelection.w,
                        height: rectSelection.h,
                        x: rectSelection.startX,
                        y: rectSelection.startY
                    };

                if ($scope.layout === "JustifiedLayout") {
                    a.x += offsetX;
                }

                a.y += offsetY;

                var subFolderHeight = $("#sub-folder-container").height();
                if (subFolderHeight) {
                    a.y += subFolderHeight + 20;
                }

                return !(
                    ((a.y + a.height) < (b.y)) ||
                    (a.y > (b.y + b.height)) ||
                    ((a.x + a.width) < b.x) ||
                    (a.x > (b.x + b.width))
                );
            };
        }
    }
})
