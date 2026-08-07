"use strict";

JibaoApp.directive('drawboard', ['$rootScope', function($rootScope) {
    return {
        scope: {
            // isOpenDrawboard: "=isOpenDrawboard"
        },
        restrict: 'E',
        templateUrl: "/partials/components/drawboard.html",
        link: function($scope, elem, attrs, controller) {

            $scope.bgColor = "transparent";
            $scope.isTransparent = true;
            $scope.color = "#FE5B67";
            $scope.mode = "pencil";
            $scope.thick = 4;
            $scope.lastThick = 4;
            $scope.isEraserMode = false;

            $scope.showPaper = false;
            $scope.showPalette = false;
            $scope.showPens = false;

            $scope.COLORS = {
                "Dark" : "#0E1115",
                "Light" : "#ffffff",
                "Transparent" : "transparent"
            }

            var board = new DrawingBoard.Board("canvas", {
                controls: false,
                webStorage: false,
                background: "rgba(0,0,0,0)",
                color: $scope.color,
                size: $scope.thick,
                eraserColor: "#fff",
                enlargeYourContainer: false
                // controls: [
                    // { Size: { type: "range" } },
                    // { Navigation: { back: false, forward: false } },
                    // 'DrawingMode'
                // ],
            });
            $(".drawing-board-canvas-wrapper, .drawing-board-canvas").css({
                width : screen.width,
                height : screen.height,
            });
            board.canvas.width = screen.width;
            board.canvas.height = screen.height;

            if (screenfull) {
                document.addEventListener(screenfull.raw.fullscreenchange, function () {
                    $scope.$apply(function () {
                        if (!screenfull.isFullscreen) {
                            $scope.closeDrawboard();
                        }
                    }); 
                });
            }

            $scope.$watch("isOpenDrawboard", function (newValue, oldValue) {
                if (newValue === true) {
                    
                    // Mousetrap.bind(['esc'], function(e) {
                    //     e.preventDefault();
                    //     $scope.$apply(function() {
                    //         $scope.closeDrawboard();
                    //     })
                    //     return false;
                    // });

                    Mousetrap.bind(['f2'], function(e) {
                        $scope.$apply(function() {
                            $scope.clear();
                        })
                        return false;
                    });

                    // Mousetrap.bind(['command+z', 'ctrl+z'], function(e) {
                    //     $scope.$apply(function() {
                    //         $scope.undo();
                    //     })
                    //     return false;
                    // });

                    // Mousetrap.bind(['command+shift+z', 'ctrl+shift+z'], function(e) {
                    //     $scope.$apply(function() {
                    //         $scope.redo();
                    //     })
                    //     return false;
                    // });
                }
                else {
                    // Mousetrap.unbind(['command+z', 'ctrl+z']);
                    // Mousetrap.unbind(['command+shift+z', 'ctrl+shift+z']);
                }
            });

            $scope.closeDrawboard = function() {
                $rootScope.isOpenDrawboard = false;
                $rootScope.isNodeListOpen = $rootScope.originNodeListOpen;
            };

            $scope.toogleDrawboard = function() {
                $rootScope.isOpenDrawboard = !$rootScope.isOpenDrawboard;
            };

            $scope.openPaper = function() {
                $scope.showPaper = true;
            };

            $scope.closePaper = function() {
                $scope.showPaper = false;
            };

            $scope.openPalette = function() {
                $scope.showPalette = true;
            };

            $scope.closePalette = function() {
                $scope.showPalette = false;
            };

            $scope.openPens = function() {
                $scope.showPens = true;
            };

            $scope.closePens = function() {
                $scope.showPens = false;
            };

            $scope.setBgColor = function(color) {
                $scope.bgColor = color;
                if (color == $scope.COLORS.Transparent) {
                    $scope.isTransparent = true;
                }
                else {
                    $scope.isTransparent = false;
                }

                if (color == $scope.COLORS.Light) {
                    $scope.eraserColor = color;
                    board.opts.eraserColor = color;
                }
                else if (color == $scope.COLORS.Dark) {
                    $scope.eraserColor = color;
                    board.opts.eraserColor = color;
                }
            };

            $scope.setColor = function(color) {
                board.setColor(color);
                $scope.color = color;
                $scope.setMode('pencil');
                $scope.closePalette();
            };

            $scope.setMode = function(mode) {
                $scope.mode = mode;
                $scope.lastThick = $scope.thick;
                board.setMode(mode);
                if (mode === 'eraser') {
                    $scope.setThick(32);                        
                    $scope.isEraserMode = true;
                } else if (mode === 'pencil') {
                    $scope.isEraserMode = false;
                    $scope.setThick($scope.lastThick);
                    board.setColor($scope.color);
                }
            };

            $scope.setThick = function(thick) {
                $scope.thick = thick;
                board.ctx.lineWidth = thick;
            };

            $scope.undo = function() {
                board.goBackInHistory();
            };

            $scope.redo = function() {
                board.goForthInHistory();
            };

            $scope.clear = function() {
                board.reset({
                    history: true,
                    webStorage: false,
                    background: "rgba(0,0,0,0)",
                    color: $scope.color,
                    size: $scope.thick,
                    eraserColor: "#fff",
                });
            }
        }
    };
}]);
