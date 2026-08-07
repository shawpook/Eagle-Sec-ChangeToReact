EagleApp.directive('smartFolderDraggable', function($rootScope) {
    return {
        restrict: 'A',
        //The link function is responsible for registering DOM listeners as well as updating the DOM.
        link: function(scope, element, attrs) {
            var $scope = angular.element("body").scope();
            element.draggable({
                scroll: true,
                scrollSensitivity: 10,
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

EagleApp.directive('smartSortTopDroppable', function($compile) {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            element.droppable({
            	accept: ".smart-folder",
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

                    var draggedFolder = draggedScope && draggedScope.smartFolder;
                    var droppedFolder = droppedScope && droppedScope.smartFolder;
                    var idx = $scope.smartFolders.indexOf(droppedFolder);
                    if (draggedFolder == droppedScope.smartFolder) return;
                    // 放開的資料夾是否為第一層
                    if (idx !== -1) {
                        var dragIdx = $scope.smartFolders.indexOf(draggedFolder);
                        // 第一層拉到第一層
                        if (dragIdx !== -1) {
                            $scope.smartFolders.splice(dragIdx, 1);
                            if (dragIdx > idx) {
                                $scope.smartFolders.splice(idx, 0, draggedFolder);
                            }
                            else {
                                $scope.smartFolders.splice(idx - 1, 0, draggedFolder);
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

EagleApp.directive('smartSortBottomDroppable', function($compile) {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            element.droppable({
            	accept: ".smart-folder",
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

                    var draggedFolder = draggedScope && draggedScope.smartFolder;
                    var droppedFolder = droppedScope && droppedScope.smartFolder;
                    var idx = $scope.smartFolders.indexOf(droppedFolder);
                    if (draggedFolder == droppedScope.smartFolder) return;
                    // 放開的資料夾是否為第一層
                    if (idx !== -1) {
                        var dragIdx = $scope.smartFolders.indexOf(draggedFolder);
                        // 第一層拉到第一層
                        if (dragIdx !== -1) {
                            $scope.smartFolders.splice(dragIdx, 1);
                            if (dragIdx > idx) {
                                $scope.smartFolders.splice(idx +1, 0, draggedFolder);
                            }
                            else {
                                $scope.smartFolders.splice(idx, 0, draggedFolder);
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