EagleApp.directive('folderDraggable', function($rootScope) {
    return {
        // A = attribute, E = Element, C = Class and M = HTML Comment
        restrict: 'A',
        //The link function is responsible for registering DOM listeners as well as updating the DOM.
        link: function(scope, element, attrs) {
            var $scope = angular.element("body").scope();
            element.draggable({
                scroll: true,
                scrollSensitivity: 10,
                containment: ".folder-list",
                helper: "clone",
                cursorAt: { top: 5, left: 5 },
                distance: 5,
                // axis: "y",
                revert: false,
                drag: function () {},
                start: function () {
                    $rootScope.currentFocus = '';
                    $scope.$evalAsync();
                },
                stop: function () {
                    $rootScope.currentFocus = 'sidebar';
                    $scope.$evalAsync();
                }
            });
        }
    };
});

EagleApp.directive('folderDroppable', function($compile) {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            element.droppable({
                accept: ".folder",
                tolerance: 'pointer',
                hoverClass: "drop",
                over: function( event, ui ) {
                    event.stopPropagation();
                    $(".group-item").removeClass("drop");
                    $(this).parent().parent().addClass("drop");
                },
                out: function( event, ui ) {
                    event.stopPropagation();
                    $(this).parent().parent().removeClass("drop");
                },
                drop: function(event, ui) {
                    event.stopPropagation();
                    var $scope = angular.element("body").scope();
                    var draggedFolder = angular.element(ui.draggable).scope().child || angular.element(ui.draggable).scope().folder;
                    var droppedFolder = angular.element(this).scope().$parent.folder;
                    
                    // 如果拖曳的資料夾在第一層
                    var idx = $scope.folders.indexOf(draggedFolder);
                    // 僅能拖曳第一層的資料夾到資料夾上，沒有孩子的才能拉
                    if (idx !== -1 && (!draggedFolder.children || draggedFolder.children.length === 0)) {
                        if (!droppedFolder.children) droppedFolder.children = [];
                        $scope.folders.splice(idx, 1);
                        draggedFolder.parent = droppedFolder.id;
                        droppedFolder.children.push(draggedFolder);
                        droppedFolder.isExpand = true;
                        $scope.saveFolder();
                        $scope.calculateImageBinding();
                    }
                    // 第二層內容拖曳至其他第一層
                    else {
                        var cfolder = angular.element(ui.draggable).scope().folder;
                        if (!cfolder.children) return;
                        var cidx = cfolder.children.indexOf(draggedFolder);
                        if (cidx !== -1) {
                            cfolder.children.splice(cidx, 1);
                            if (!droppedFolder.children) droppedFolder.children = [];
                            draggedFolder.parent = droppedFolder.id;
                            droppedFolder.children.push(draggedFolder);
                            droppedFolder.isExpand = true;
                            $scope.saveFolder();
                            $scope.calculateImageBinding();
                        }
                    }
                }
            });
        }
    };
});

EagleApp.directive('sortTopDroppable', function($compile) {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            element.droppable({
                accept: ".folder",
                tolerance: 'pointer',
                hoverClass: "drop",
                greddy: attrs.greddy == "true",
                over: function( event, ui ) {
                    event.stopPropagation();
                },
                drop: function(event, ui) {
                    event.stopPropagation();
                    var $scope = angular.element("body").scope();
                    var draggedScope = angular.element(ui.draggable).scope();
                    var droppedScope = angular.element(this).scope();
                    if (!draggedScope || !droppedScope) return;

                    var draggedFolder = draggedScope && draggedScope.child || draggedScope.folder;
                    var droppedFolder = droppedScope && droppedScope.child || droppedScope.folder;
                    var idx = $scope.folders.indexOf(droppedFolder);
                    if (draggedFolder == droppedScope.folder) return;
                    // 放開的資料夾是否為第一層
                    if (idx !== -1) {
                        var dragIdx = $scope.folders.indexOf(draggedFolder);
                        // 第一層拉到第一層
                        if (dragIdx !== -1) {
                            $scope.folders.splice(dragIdx, 1);
                            if (dragIdx > idx) {
                                $scope.folders.splice(idx, 0, draggedFolder);
                            }
                            else {
                                $scope.folders.splice(idx - 1, 0, draggedFolder);
                            }
                        }
                        // 第二層拉到第一層
                        else {
                            var children = draggedScope.folder.children;
                            var cidx = children.indexOf(draggedFolder);
                            var parentIdx = $scope.folders.indexOf(draggedScope.folder);
                            children.splice(cidx, 1);
                            delete draggedFolder.parent;
                            $scope.folders.splice(idx, 0, draggedFolder);
                        }
                    }
                    // 拖曳至第二層
                    else {
                        var dragIdx = $scope.folders.indexOf(draggedFolder);
                        // 第一層拉到第二層
                        if (dragIdx !== -1) {
                            if (draggedFolder.children && draggedFolder.children.length > 0) return;
                            $scope.folders.splice(dragIdx, 1);
                            var children = droppedScope.folder.children;
                            var cidx = children.indexOf(droppedFolder);
                            draggedFolder.parent = droppedScope.folder.id;
                            children.splice(cidx, 0, draggedFolder);
                            $scope.calculateImageBinding();
                        }
                        // 第二層拉到第二層
                        else {
                            var dragChildren = draggedScope.folder.children;
                            var dragcidx = dragChildren.indexOf(draggedFolder);
                            var droppedChildren = droppedScope.folder.children;

                            dragChildren.splice(dragcidx, 1);

                            var dropcidx = droppedChildren.indexOf(droppedFolder);
                            draggedFolder.parent = draggedScope.folder.id;
                            droppedChildren.splice(dropcidx, 0, draggedFolder);
                            // 如果父親不同，才需要更新畫面
                            if (dragChildren != droppedChildren) {
                                $scope.calculateImageBinding();
                            }
                        }
                    }
                   
                    $(event.target).removeClass("drop");
                    draggingItem = undefined;
                    $scope.saveFolder();
                    $scope.$evalAsync();
                }
            });
        }
    };
});

EagleApp.directive('sortBottomDroppable', function($compile) {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            element.droppable({
                accept: ".folder",
                tolerance: 'pointer',
                hoverClass: "drop",
                greddy: attrs.greddy == "true",
                over: function( event, ui ) {
                    event.stopPropagation();
                },
                drop: function(event, ui) {
                    event.stopPropagation();
                    var $scope = angular.element("body").scope();
                    var draggedScope = angular.element(ui.draggable).scope();
                    var droppedScope = angular.element(this).scope();
                    if (!draggedScope || !droppedScope) return;

                    var draggedFolder = draggedScope && draggedScope.child || draggedScope.folder;
                    var droppedFolder = droppedScope && droppedScope.child || droppedScope.folder;
                    var idx = $scope.folders.indexOf(droppedFolder);
                    if (draggedFolder == droppedScope.folder) return;
                    // 放開的資料夾是否為第一層
                    if (idx !== -1) {
                        var dragIdx = $scope.folders.indexOf(draggedFolder);
                        // 第一層拉到第一層
                        if (dragIdx !== -1) {
                            $scope.folders.splice(dragIdx, 1);
                            if (dragIdx > idx) {
                                $scope.folders.splice(idx +1, 0, draggedFolder);
                            }
                            else {
                                $scope.folders.splice(idx, 0, draggedFolder);
                            }
                        }
                        // 第二層拉到第一層
                        else {
                            var children = draggedScope.folder.children;
                            var cidx = children.indexOf(draggedFolder);
                            var parentIdx = $scope.folders.indexOf(draggedScope.folder);
                            children.splice(cidx, 1);
                            $scope.folders.splice(idx + 1, 0, draggedFolder);
                        }
                    }
                    // 拖曳至第二層
                    else {
                        var dragIdx = $scope.folders.indexOf(draggedFolder);
                        // 第一層拉到第二層
                        if (dragIdx !== -1) {
                            if (draggedFolder.children && draggedFolder.children.length > 0) return;
                            $scope.folders.splice(dragIdx, 1);
                            var children = droppedScope.folder.children;
                            var cidx = children.indexOf(droppedFolder);
                            draggedFolder.parent = droppedScope.folder.id;
                            children.splice(cidx + 1, 0, draggedFolder);
                            $scope.calculateImageBinding();
                        }
                        // 第二層拉到第二層
                        else {
                            var dragChildren = draggedScope.folder.children;
                            var dragcidx = dragChildren.indexOf(draggedFolder);
                            var droppedChildren = droppedScope.folder.children;
                            
                            dragChildren.splice(dragcidx, 1);

                            var dropcidx = droppedChildren.indexOf(droppedFolder);
                            draggedFolder.parent = draggedScope.folder.id;
                            droppedChildren.splice(dropcidx, 0, draggedFolder);
                            if (dragChildren != droppedChildren) {
                                $scope.calculateImageBinding();
                            }
                        }
                    }
                   
                    $(event.target).removeClass("drop");
                    draggingItem = undefined;
                    $scope.saveFolder();
                    $scope.$evalAsync();
                }
            });
        }
    };
});