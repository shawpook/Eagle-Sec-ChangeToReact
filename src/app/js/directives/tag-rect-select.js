var tagRectSelecting = false;

EagleApp.directive('tagSelect', function($rootScope, $filter) {
    return {
        link: ($scope, element) => {

            tagRectSelecting = false;

            let tagRectSelection = {};
            let startX, startY;
            let offset = $(element).offset();
            const $rect = $('<div class="rect""></div>').hide();
            let tagItems = [];
            let $container;
            let windowHeight;

            const contain = (element) => {
                const a = {
                    width: element.width,
                    height: element.height,
                    x: element.left,
                    y: element.top,
                }, b = {
                    width: tagRectSelection.w,
                    height: tagRectSelection.h,
                    x: tagRectSelection.startX,
                    y: tagRectSelection.startY
                };
                const isContain = !(
                    ((a.y + a.height) < (b.y)) ||
                    (a.y > (b.y + b.height)) ||
                    ((a.x + a.width) < b.x) ||
                    (a.x > (b.x + b.width))
                );
                return isContain;
            };

            const drawRect = () => {
                $rect.css({
                    transform: "none",
                    top: tagRectSelection.startY,
                    left: tagRectSelection.startX,
                    width: tagRectSelection.w,
                    height: tagRectSelection.h,
                    opacity: 1
                });
            };

            const hideRect = () => {
                $rect.css({
                    top: 0,
                    left: 0,
                    width: 0,
                    height: 0,
                    display: "none !important",
                    transform: "none",
                    opacity: 0
                });
            };

            const onMouseDown = (e) => {

                if (e.metaKey || e.ctrlKey || e.shiftKey) {
                    e.stopPropagation();
                    e.preventDefault();
                    return;
                }

                tagItems = [];
                tagRectSelection = {};
                $container = $(element).find(".tag-manager-container");
                $rect.appendTo($container);
                windowHeight = $(window).height();
                tagRectSelection = {};

                if (e.which != 1 || $scope.isDetailMode) return;

                offset = $container.offset();
                if (!offset) return;


                const displayData = $bodyScope.TagManager.tagsResult.display;
                const columnWidth = $bodyScope.TagManager.tagsResult.columnWidth;
                const tagWidth = $container.find(".tag").width();
                const gapWidth = columnWidth - tagWidth;
                const containerPaddingLeft = parseInt($container.css("padding-left"));
                const containerPaddingTop = parseInt($container.css("padding-top"));

                // 獲取 group-description 的實際高度（如果存在）
                const $groupDescription = $container.find(".group-description");
                let descriptionHeight = 0;
                if ($groupDescription.length > 0) {
                    descriptionHeight = $groupDescription.outerHeight(true); // 包含 margin
                }

                // 計算所有 tags 的位置，需要考慮 description 高度
                let currentY = 0;
                displayData.forEach((vsRepeatItem) => {
                    if (vsRepeatItem.type === "group") {
                        currentY += 32; // group name 高度
                        currentY += descriptionHeight; // 加上 description 高度
                    }
                    else if (vsRepeatItem.type === "starred") {
                        currentY += 32;
                    }
                    else if (vsRepeatItem.type === "row") {
                        vsRepeatItem.tags.forEach((tag, index) => {
                            tagItems.push({
                                width: columnWidth - gapWidth,
                                height: 27,
                                left: index * columnWidth + containerPaddingLeft,
                                top: currentY + containerPaddingTop,
                                name: tag
                            });
                        });
                        currentY += 27;
                    }
                    else if (vsRepeatItem.type === "separator") {
                        currentY += 25;
                    }
                });

                $scope.selectedTags = {};
                $scope.selectingTags = {};

                tagRectSelection.startX = startX = e.pageX - offset.left;
                tagRectSelection.startY = startY = e.pageY - offset.top + $container.scrollTop();
                tagRectSelecting = true;

                if ($container.length == 0) {
                    $container.prepend($rect);
                }

                $rect.css({
                    opacity: 1,
                    transform: "none",
                    top: tagRectSelection.startY,
                    left: tagRectSelection.startX,
                });

                $rect.show();
                $rootScope.currentFocus = "content";
                $scope.$evalAsync();
            };

            const onMouseUp = (e) => {
                if (!tagRectSelecting) return;
                if ($scope.isDetailMode) return;

                hideRect();

                tagRectSelection = {};
                tagRectSelecting = false;

                $bodyScope.selectedTags = { ...$scope.selectingTags };
                $scope.selectingTags = {};
                $bodyScope.$evalAsync();
            };

            const onMouseMove = (e) => {
                if (!tagRectSelecting) return;

                const scrollTop = $container.scrollTop();
                const flipX = startX > e.pageX - offset.left;
                const flipY = startY > e.pageY - offset.top + scrollTop;

                tagRectSelection.w = Math.abs((e.pageX - offset.left) - startX);
                tagRectSelection.h = Math.abs((e.pageY - offset.top) - startY + scrollTop);

                // Note: electron@2.0.2 开始，滑鼠拖拽在窗口边缘不会自动滚动，所以自己处理
                if (e.pageY <= offset.top + 24) {
                    $container.scrollTop(scrollTop - 48);
                }
                else if (e.pageY >= windowHeight - 24) {
                    $container.scrollTop(scrollTop + 48);
                }

                if (flipX) {
                    tagRectSelection.startX = startX - tagRectSelection.w;
                }
                if (flipY) {
                    tagRectSelection.startY = startY - tagRectSelection.h;
                }

                drawRect();
                
                if (tagItems.length > 0) {
                    $scope.selectingTags = {};
                    for (let i = 0; i < tagItems.length; i++) {
                        const tagName = tagItems[i].name;
                        if (!tagName) { continue; };
                        if (contain(tagItems[i])) {
                            $scope.selectingTags[tagName] = true;
                        }
                    }
                    $scope.$evalAsync();
                }
            };

            element.on("mousedown", onMouseDown);
            $(window).on("mouseup", onMouseUp);
            $(window).on("mousemove", onMouseMove);
        }
    }
});
