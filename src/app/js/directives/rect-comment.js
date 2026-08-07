EagleApp.directive('commentItem', function ($rootScope, $timeout) {
    return {
        restrict: 'A',
        link: function($scope, element, attrs) {

            $scope.dragging = false;
            $scope.resizing = false;
            var startX, startY;
            var currentX, currentY;
            var originTop, originLeft;
            var $container = $("[rect-comment]").eq(0);
            var offset = $container.offset();
            var ipcRenderer = require('electron').ipcRenderer;
            var zoomData;

            $(element).resizable();

            $(element).find(".ui-resizable-handle").on("mousedown", function (event) {
                $scope.resizing = true;
            })

            $(element).find(".annotation").on("mousewheel", function (event) {
                event.stopPropagation();
            })

            var zoomRatio;
            $(element).on( "resizestart", function( event, ui ) {
                if (!$bodyScope.isCommentMode) return;
                event.stopPropagation();
                var zoomData = $("#detail-container").smoothZoom('getZoomData');
                zoomRatio = zoomData.ratio;
            } );

            $(element).on( "resize", function( event, ui ) {
                event.preventDefault();
                event.stopPropagation();
                var originWidth = ui.originalSize.width;
                var originHeight = ui.originalSize.height;
                var size = ui.size;
                var offsetWidth = ui.size.width - originWidth;
                var offsetHeight = ui.size.height - originHeight;
                ui.size.width = Math.round(originWidth + offsetWidth / zoomRatio);
                ui.size.height = Math.round(originHeight + offsetHeight / zoomRatio);
            });

            $(element).on("resizestop", function(event, ui ) {
                event.stopPropagation();

                var height = ui.element.height();
                var width = ui.element.width();

                $scope.$evalAsync(function () {
                    $scope.resizing = false;
                    $scope.comment.width = width * $scope.ratio;
                    $scope.comment.height = height * $scope.ratio;
                    ipcRenderer.send('image-change', $scope.current);
                });
            });

            element.on("mousedown.drag", function (e) {
                e.stopPropagation();
                e.preventDefault();
                if ($scope.resizing) return;
                if (!$bodyScope.isCommentMode) return;
                $scope.dragging = true;
                zoomData = $("#detail-container").smoothZoom('getZoomData');
                originTop = $scope.comment.y;
                originLeft = $scope.comment.x;
                startX = e.pageX;
                startY = e.pageY;
            });

            element.on("mouseup.drag", function (e) {
                if (!$scope.dragging) {return;}
                if (!$bodyScope.isCommentMode) return;
                $scope.$evalAsync(function () {
                    e.stopPropagation();
                    $scope.dragging = false;
                    currentX = e.pageX;
                    currentY = e.pageY;
                    var zoomRatio = zoomData.ratio;
                    var offsetX = (startX - currentX) / zoomRatio,
                        offsetY = (startY - currentY) / zoomRatio;
                    element.css({
                        top: (originTop - offsetY) + "px",
                        left: (originLeft - offsetX) + "px"
                    });

                    var newX = (originLeft - offsetX);
                    var newY = (originTop - offsetY);

                    if (newX !== $scope.comment.x || newY !== $scope.comment.y) {
                        $scope.comment.x = newX;
                        $scope.comment.y = newY;
                        ipcRenderer.send('image-change', $scope.current);
                        setTimeout(function () {
                            AnnotationPreview.show();
                        }, 1);
                    }
                    else {
                        setTimeout(function () {
                            AnnotationPreview.focus();
                        }, 24);
                    }
                });
            });

            $container.on("mousemove.drag", function (e) {

                if (!$scope.dragging) return;
                if (!$bodyScope.isCommentMode) return;

                e.stopPropagation();
                e.preventDefault();

                currentX = e.pageX;
                currentY = e.pageY;

                var zoomRatio = zoomData.ratio;
                var offsetX = (startX - currentX) / zoomRatio,
                    offsetY = (startY - currentY) / zoomRatio;

                var newX = (originLeft - offsetX);
                var newY = (originTop - offsetY);

                if (newX !== $scope.comment.x || newY !== $scope.comment.y) {
                    element.css({
                        top: (newY) + "px",
                        left: (newX) + "px"
                    });
                    $("[contenteditable]:focus").blur();
                    AnnotationPreview.hide();
                }
            });
        }
    }
});

EagleApp.directive('commentsContainer', function ($rootScope, $timeout, $filter) {
    return {
        scope: {
            image: "=image",
            ratio: "=ratio",
        },
        restrict: 'A',
        link: function($scope, element, attrs) {

            var ipcRenderer = require('electron').ipcRenderer;
            element.find(".annotation").blur();

            // $timeout(function () {
            //     $(window).trigger("resize.comments");
            // }, 100);
            var resizeHandler = () => {
                // var $bodyScope = angular.element("body").scope();
                if (!$bodyScope.isDetailMode || !$bodyScope.isCommentMode) return;
                if (!$scope.image) return;
                var $image = $("#detail-image");
                if ($scope.image && $scope.image.width) {
                    $scope.ratio = $scope.image.width / $image.width();
                }
            }

            resizeHandler();
            $(window).on("resize.comments", resizeHandler);

            $scope.$watch("image.id", function () {
                if (!$scope.image) return;
                if (!$scope.image.comments || $scope.image.comments.length === 0) {
                    return;
                }
                var $image = $("#detail-image");
                if ($scope.image && $scope.image.width) {
                    $image.on("load.comment", function () {
                        $scope.ratio = $scope.image.width / $image.width();
                        $scope.$evalAsync();
                        $image.off("load.comment");
                    });
                }
            }, true);

            // $rootScope.commentBlur = function (comment) {
            //     ipcRenderer.send('image-change', $scope.image);
            // }

            $rootScope.removeComment = function (index, comment) {

                var image = $bodyScope.selected[0];
                var originComments = angular.copy(image.comments);

                image.comments.splice(index, 1);
                $rootScope.$broadcast("REBIND_REFRESH", true);
                ipcRenderer.send('image-change', image);

                electronLog && electronLog.info(`[app] Remove image annotation: ${image.name}(${image.id})`);

                var message = $filter('i18n')("notify.annotation.remove");
                // 復原
                $rootScope.notify({
                    message: message,
                    duration: 4000,
                }, function () {
                    image.comments = originComments;
                    $rootScope.$broadcast("REBIND_REFRESH", true);
                    ipcRenderer.send('image-change', image);
                });
                AnnotationPreview.blur();
                AnnotationPreview.hide();
            };

            $("#detail-image").on("click", function () {
                setTimeout(function () {
                    $("#comment-blur").focus();
                }, 24);

                setTimeout(function () {
                    $("#comment-blur").blur();
                }, 100);
                // window.getSelection().removeAllRanges();
            });
        }
    }
});

EagleApp.directive('rectComment', function ($rootScope, $timeout) {
    return {
        scope: {
            image: "=image",
            rect: "=rect",
            enabled: "=enabled"
        },
        link: function($scope, element, attrs) {

            var startX, startY;
            var downX, downY;
            var offset = $(element).offset();
            $scope.rect = {},
            $scope.dragging = false;

            element.on("mousedown", ".image-wrap", function (e) {
                e.preventDefault();
                if (!$scope.enabled) return;
                if (e.button !== 0) return;
                if ($scope.$parent.current && $scope.$parent.current.ext == 'mp4' || $scope.$parent.current.ext == 'pdf') {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                var zoomData = $("#detail-container").smoothZoom('getZoomData');
                var zoomRatio = zoomData.ratio;

                offset = $(element).offset();
                startX = e.pageX;
                startY = e.pageY;
                $scope.rect = {};
                $scope.rect.startX = downX = e.offsetX;
                $scope.rect.startY = downY = e.offsetY + $(element).scrollTop() / zoomRatio;
                $scope.dragging = true;
            });

            element.on("mouseup", function (e) {
                if (!$scope.enabled || !$scope.rect) return;

                AnnotationPreview.hovering = false;
                AnnotationPreview.hide();
                setTimeout(function () {
                    $("#annotation-preview-container-input").focus();
                }, 24);
                setTimeout(function () {
                    $("#annotation-preview-container-input").blur();
                }, 50);
                $scope.$evalAsync(function () {
                    if ($("#box-container").length <= 0) return;
                    var offsetLeft = $("#box-container").offset().left - $("#detail-image").offset().left;
                    var offsetTop = $("#box-container").offset().top - $("#detail-image").offset().top;
                    var $image = $("#detail-image").get(0);
                    var ratio = $scope.image.width / $image.clientWidth;
                    var zoomData = $("#detail-container").smoothZoom('getZoomData');
                    var zoomRatio = zoomData.ratio;

                    $scope.dragging = false;

                    // if (offsetLeft > 0) {
                    //     offsetLeft = -20;
                    // }

                    // if (offsetTop > 0) {
                    //     offsetTop = -20;
                    // }

                    var comment = {
                        id: guid(),
                        x: Math.round(($scope.rect.startX) * ratio),
                        y: Math.round(($scope.rect.startY + $(element).scrollTop()) * ratio),
                        width: Math.round($scope.rect.w * ratio),
                        height: Math.round($scope.rect.h * ratio),
                        annotation: "",
                        lastModified: Date.now()
                    };

                    if (comment.width > 10 && comment.height > 10) {
                        if (!$scope.image.comments) {
                            $scope.image.comments = [];
                        }
                        $scope.image.comments.push(comment);
                        $rootScope.$broadcast("REBIND_REFRESH", true);
                        $(window).trigger("resize.comments");
                        $timeout(function () {
                            AnnotationPreview.lastElem = $("#comment-" + comment.id)[0];
                            AnnotationPreview.show(true);
                            // $("#comment-" + comment.id).find(".annotation div").get(0).focus();
                        }, 100);
                        electronLog && electronLog.info(`[app] New image annoataion: ${$scope.image.name}(${$scope.image.id})`);
                        analytics.event('Annotation', 'Create');
                    }
                    $scope.rect = undefined;
                });
            });

            element.on("mousemove", function (e) {
                if (!$scope.enabled) return;
                if ($scope.dragging) {
                    var zoomData = $("#detail-container").smoothZoom('getZoomData');
                    var zoomRatio = zoomData.ratio;
                    if (!$scope.rect) return;

                    var flipX = startX > e.pageX,
                        flipY = startY > e.pageY;

                    if (flipX) {
                        $scope.rect.startX = downX - (startX - e.pageX) / zoomRatio;
                    }
                    if (flipY) {
                        $scope.rect.startY = downY - (startY - e.pageY) / zoomRatio;
                    }

                    $scope.rect.w = Math.abs(startX - e.pageX) / zoomRatio;
                    $scope.rect.h = Math.abs(startY - e.pageY) / zoomRatio;

                    $scope.$evalAsync();
                }
            });
        }
    }
});
