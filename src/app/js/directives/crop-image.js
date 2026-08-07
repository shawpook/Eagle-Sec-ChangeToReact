EagleApp.directive('cropImage', function ($rootScope, $timeout, $filter) {
    return {
        restrict: 'A',
        link: function($scope, element, attrs) {

            var draggingCropArea = false;
            var cropResizing = false;

            var startX, startY;
            var currentX, currentY;
            var originTop, originLeft;
            var zoomData;

            var $cropContainer = element;
            var $cropArea = element.find(".crop-area");
            var $cropSize = $("#crop-size");
            var containerWidth = $scope.current.width;
            var containerHeight = $scope.current.height;
            var cropAreaWidth = containerWidth;
            var cropAreaHeight = containerHeight;
            var minCropSize = 24;
            var backgroundImage = $bodyScope.getRawUrl($scope.current);

            var $toolbarWidthInput = $("#crop-width");
            var $toolbarHeightInput = $("#crop-height");

            function updateCropperSize () {
                let w = parseInt($toolbarWidthInput.val());
                let h = parseInt($toolbarHeightInput.val());

                if ($cropArea && w > 0 && h > 0) {

                    w = parseInt(Math.min(w, $scope.current.width));
                    h = parseInt(Math.min(h, $scope.current.height));

                    $cropArea.css({
                        width: w,
                        height: h,
                    });

                    showSize();

                    $toolbarWidthInput.val(w);
                    $toolbarHeightInput.val(h);
                }
            }

            $toolbarWidthInput.off("change").on("change", updateCropperSize);
            $toolbarHeightInput.off("change").on("change", updateCropperSize);
            $toolbarWidthInput.off("keyup").on("keyup", function (event) {
                if (event && event.keyCode === 13) {
                    $toolbarHeightInput.focus();
                    $toolbarHeightInput.select();
                }
            });
            $toolbarHeightInput.off("keyup").on("keyup", function (event) {
                if (event && event.keyCode === 13) {
                    $toolbarHeightInput.blur();
                }
            });

            $cropArea.width(containerWidth);
            $cropArea.height(containerHeight);
            $cropArea.css({
                top: 0,
                left: 0,
                width: $scope.current.width,
                height: $scope.current.height,
                // "background-image": `url("${backgroundImage}")`
            });
            $cropArea.addClass("ui-resizable-resizing");
            $cropArea.resizable({
                handles: "n, e, s, w, ne, se, sw, nw",
            });

            $cropSize.html(`x:${0} y:${0}, ${i18n.__('general.w')}:${$scope.current.width} ${i18n.__('general.h')}:${$scope.current.height}`);
            $cropSize.hide();
            $toolbarWidthInput.val($scope.current.width);
            $toolbarHeightInput.val($scope.current.height);


            element.find(".ui-resizable-handle").css({
                "transform": `scale(${100 / $scope.imageSize.zoomRatio})`
            });

            element.css({
                "outline-width": `${Math.max(100 / $scope.imageSize.zoomRatio*1, 1)}px`
            });

            $cropArea.find(".ui-resizable-handle").on("mousedown", function (event) {
                cropResizing = true;
            });

            $scope.$watch("current", function () {
                containerWidth = $scope.current.width;
                containerHeight = $scope.current.height;
                // backgroundImage = $bodyScope.getRawUrl($scope.current);
                $cropArea.css({
                    top: 0,
                    left: 0,
                    width: containerWidth,
                    height: containerHeight,
                    // "background-image": `url("${backgroundImage}")`
                });
            }, true);

            $scope.$watch("imageSize.zoomRatio", function (newValue) {
                element.find(".ui-resizable-handle").css({
                    "transform": `scale(${100 / newValue})`
                });
                element.css({
                    "border-width": `${100 / newValue * 1}px`
                });
            });

            $scope.$on('$destroy', function () {
                cleanup();
            });

            $scope.$on("MOVE-CROP-TOOL", function (event, params) {
                if (!params) return;
                moveCropper(params.horizontal, params.vertical);
            });

            $scope.$on("RESIZE-CROP-TOOL", function (event, params) {
                if (!params) return;
                resizeCropper(params.horizontal, params.vertical);
            });

            function moveCropper (offsetX, offsetY) {
                var width = $cropArea.width();
                var height = $cropArea.height();
                var top = parseInt($cropArea.css("top"));
                var left = parseInt($cropArea.css("left"));
                var windowWidth = containerWidth;
                var windowHeight = containerHeight;
                if (offsetX !== 0) {
                    if (offsetX > 0) {
                        if (left + offsetX + width > windowWidth) {
                            $cropArea.css("left", windowWidth - width);
                        }
                        else {
                            $cropArea.css("left", left + offsetX);
                        }
                    }
                    else if (offsetX < 0) {
                        if (left + offsetX > 0) {
                            $cropArea.css("left", left + offsetX);
                        }
                        else {
                            $cropArea.css("left", 0);
                        }
                    } 
                }
                if (offsetY !== 0) {
                    if (offsetY > 0) {
                        if (top + offsetY + height > windowHeight) {
                            $cropArea.css("top", windowHeight - height);
                        }
                        else {
                            $cropArea.css("top", top + offsetY);
                        }
                    }
                    else if (offsetY < 0) {
                        if (top + offsetY > 0) {
                            $cropArea.css("top", top + offsetY);
                        }
                        else {
                            $cropArea.css("top", 0);
                        }
                    } 
                }
                // $cropArea.css({
                //     backgroundPosition: `${-parseInt($cropArea.css("left"))}px ${-parseInt($cropArea.css("top"))}px`
                // });
                showSize();
            }

            function resizeCropper (offsetX, offsetY) {
                var width = $cropArea.outerWidth();
                var height = $cropArea.outerHeight();
                var top = parseInt($cropArea.css("top"));
                var left = parseInt($cropArea.css("left"));
                var windowWidth = containerWidth;
                var windowHeight = containerHeight;
                if (offsetX !== 0) {
                    if (offsetX > 0) {
                        if (left + offsetX + width > windowWidth) {
                            $cropArea.css("width", windowWidth - left);
                        }
                        else {
                            $cropArea.css("width", width + offsetX);
                        }
                    }
                    else if (offsetX < 0) {
                        if (width > minCropSize) {
                            $cropArea.css("width", width + offsetX);
                        }
                        else {
                            $cropArea.css("width", minCropSize);
                        }
                    } 
                }
                if (offsetY !== 0) {
                    if (offsetY > 0) {
                        if (top + offsetY + height > windowHeight) {
                            $cropArea.css("height", windowHeight - top);
                        }
                        else {
                            $cropArea.css("height", height + offsetY);
                        }
                    }
                    else if (offsetY < 0) {
                        if (height > minCropSize) {
                            $cropArea.css("height", height + offsetY);
                        }
                        else {
                            $cropArea.css("height", minCropSize);
                        }
                    } 
                }
                // $cropArea.css({
                //     backgroundPosition: `${-parseInt($cropArea.css("left"))}px ${-parseInt($cropArea.css("top"))}px`
                // });
                $toolbarWidthInput.val($cropArea.width());
                $toolbarHeightInput.val($cropArea.height());
                showSize();
            }

            var hideSizeTimeout;
            var showSize = function () {
                updateSize()
                $cropSize.show();
                clearTimeout(hideSizeTimeout);
                hideSizeTimeout = setTimeout(function () {
                    $cropSize.hide();
                }, 1000);
            }

            var updateSize = throttle(function () {
                $cropSize.html(`x:${$filter('number', 0)(parseInt($cropArea.css("left")))} y:${$filter('number', 0)(parseInt($cropArea.css("top")))}, ${i18n.__('general.w')}:${$filter('number', 0)($cropArea.width())} ${i18n.__('general.h')}:${$filter('number', 0)($cropArea.height())}`);
                var position = $cropArea[0].getBoundingClientRect();
                $cropSize.css({
                    left: position.x + position.width - 10,
                    top: position.y + position.height,
                    transform: "translateX(-50%)"
                });
            }, 33);

            function cleanup () {
                $cropArea.find(".ui-resizable-handle").off("mousedown");
                $cropArea.off("resizestart");
                $cropArea.off("resize");
                $cropArea.off("resizestop");
                $cropArea.off("mouseup.cropimage");
                $(window).off("mousemove.cropimage");
                $(window).off("mouseup.cropimage");
            }

            var zoomRatio;
            var originalCanvasX;
            var originalCanvasY;
            var orientationY;
            var orientationX;

            $cropArea.on("dblclick", (event) => {
                var $bodyScope = angular.element("body").scope();
                $bodyScope.saveCrop();
            });

            // Resizable
            $cropArea.on("resizestart", function( event, ui ) {
                event.stopPropagation();

                $cropSize.show();

                var zoomData = $("#detail-container").smoothZoom('getZoomData');
                zoomRatio = zoomData.ratio;

                var targetClass = event.originalEvent.target.classList.value;
                $cropSize.removeClass("orientation-ne orientation-se orientation-nw orientation-sw orientation-n orientation-e orientation-s orientation-w");
                if (targetClass.indexOf("ui-resizable-ne") > -1) {
                    $cropSize.addClass("orientation-ne");
                    orientationY = 'n';
                    orientationX = 'e';
                }
                else if (targetClass.indexOf("ui-resizable-se") > -1) {
                    $cropSize.addClass("orientation-se");
                    orientationY = 's';
                    orientationX = 'e';
                }
                else if (targetClass.indexOf("ui-resizable-sw") > -1) {
                    $cropSize.addClass("orientation-sw");
                    orientationY = 's';
                    orientationX = 'w';
                }
                else if (targetClass.indexOf("ui-resizable-nw") > -1) {
                    $cropSize.addClass("orientation-nw");
                    orientationY = 'n';
                    orientationX = 'w';
                }
                else if (targetClass.indexOf("ui-resizable-w") > -1) {
                    $cropSize.addClass("orientation-w");
                    orientationY = '';
                    orientationX = 'w';
                }
                else if (targetClass.indexOf("ui-resizable-e") > -1) {
                    $cropSize.addClass("orientation-e");
                    orientationY = '';
                    orientationX = 'e';
                }
                else if (targetClass.indexOf("ui-resizable-s") > -1) {
                    $cropSize.addClass("orientation-s");
                    orientationY = 's';
                    orientationX = '';
                }
                else if (targetClass.indexOf("ui-resizable-n") > -1) {
                    $cropSize.addClass("orientation-n");
                    orientationY = 'n';
                    orientationX = '';
                }
                else {
                    orientationX = '';
                    orientationY = '';
                }

                // 記錄原來的 x, y 座標
                originalCanvasX = zoomData.scaledX;
                originalCanvasY = zoomData.scaledY;
            } );

            $cropArea.on("resize", function( event, ui ) {

                event.preventDefault();
                event.stopPropagation();

                $cropSize.css({
                    top: `${event.pageY}px`,
                    left: `${event.pageX}px`,
                });

                zoomData = $("#detail-container").smoothZoom('getZoomData');
                var offsetCanvasX = parseInt((originalCanvasX - zoomData.scaledX) / zoomRatio);
                var offsetCanvasY = parseInt((originalCanvasY - zoomData.scaledY) / zoomRatio);
                
                // 檢查是否按下 Alt 鍵進行對稱裁切
                var isSymmetric = event.altKey;
                // 檢查是否按下 Shift 鍵進行比例縮放
                var isProportional = event.shiftKey;
                
                var finalWidth, finalHeight;
                
                if (isSymmetric) {
                    // 對稱裁切模式
                    var centerX = ui.originalPosition.left + ui.originalSize.width / 2;
                    var centerY = ui.originalPosition.top + ui.originalSize.height / 2;
                    
                    var newWidth = ui.originalSize.width;
                    var newHeight = ui.originalSize.height;
                    
                    // 計算滑鼠拖拽的變化量，考慮 zoomRatio
                    var deltaWidth = (ui.size.width - ui.originalSize.width) / zoomRatio;
                    var deltaHeight = (ui.size.height - ui.originalSize.height) / zoomRatio;
                    
                    // 根據拖拽方向計算新尺寸，考慮 canvas offset
                    if (orientationX === 'e') {
                        // 拖拽右邊 - 寬度增加 deltaWidth * 2
                        var adjustedDeltaWidth = deltaWidth - offsetCanvasX;
                        newWidth = ui.originalSize.width + adjustedDeltaWidth * 2;
                    } else if (orientationX === 'w') {
                        // 拖拽左邊 - 寬度增加 deltaWidth * 2  
                        var adjustedDeltaWidth = deltaWidth + offsetCanvasX;
                        newWidth = ui.originalSize.width + adjustedDeltaWidth * 2;
                    }
                    
                    if (orientationY === 's') {
                        // 拖拽下邊 - 高度增加 deltaHeight * 2
                        var adjustedDeltaHeight = deltaHeight - offsetCanvasY;
                        newHeight = ui.originalSize.height + adjustedDeltaHeight * 2;
                    } else if (orientationY === 'n') {
                        // 拖拽上邊 - 高度增加 deltaHeight * 2
                        var adjustedDeltaHeight = deltaHeight + offsetCanvasY;
                        newHeight = ui.originalSize.height + adjustedDeltaHeight * 2;
                    }
                    
                    // 如果是角落拖拽，同時處理寬高
                    if (orientationX && orientationY) {
                        var adjustedDeltaWidth, adjustedDeltaHeight;
                        
                        if (orientationX === 'e') {
                            adjustedDeltaWidth = deltaWidth - offsetCanvasX;
                        } else {
                            adjustedDeltaWidth = deltaWidth + offsetCanvasX;
                        }
                        
                        if (orientationY === 's') {
                            adjustedDeltaHeight = deltaHeight - offsetCanvasY;
                        } else {
                            adjustedDeltaHeight = deltaHeight + offsetCanvasY;
                        }
                        
                        newWidth = ui.originalSize.width + adjustedDeltaWidth * 2;
                        newHeight = ui.originalSize.height + adjustedDeltaHeight * 2;
                    }
                    
                    // 如果同時按下 Shift 鍵，保持比例
                    if (isProportional) {
                        var aspectRatio = ui.originalSize.width / ui.originalSize.height;
                        
                        if (orientationX && orientationY) {
                            // 角落拖拽，在對稱模式下需要特別處理
                            // 計算基於滑鼠移動距離的縮放比例
                            var scaleFactorX = newWidth / ui.originalSize.width;
                            var scaleFactorY = newHeight / ui.originalSize.height;
                            
                            // 選擇較小的縮放比例以保持比例且避免超出邊界
                            var scaleFactor = Math.min(scaleFactorX, scaleFactorY);
                            
                            newWidth = ui.originalSize.width * scaleFactor;
                            newHeight = ui.originalSize.height * scaleFactor;
                        } else if (orientationX) {
                            // 水平拖拽
                            newHeight = newWidth / aspectRatio;
                        } else if (orientationY) {
                            // 垂直拖拽
                            newWidth = newHeight * aspectRatio;
                        }
                    }
                    
                    // 確保不超過最小尺寸
                    newWidth = Math.max(newWidth, minCropSize);
                    newHeight = Math.max(newHeight, minCropSize);
                    
                    // 計算新的位置（保持中心不變）
                    var newLeft = centerX - newWidth / 2;
                    var newTop = centerY - newHeight / 2;
                    
                    // 檢查邊界限制
                    if (newLeft < 0) {
                        newLeft = 0;
                        newWidth = centerX * 2;
                    }
                    if (newTop < 0) {
                        newTop = 0;
                        newHeight = centerY * 2;
                    }
                    if (newLeft + newWidth > containerWidth) {
                        newWidth = (containerWidth - centerX) * 2;
                    }
                    if (newTop + newHeight > containerHeight) {
                        newHeight = (containerHeight - centerY) * 2;
                    }
                    
                    // 再次確保最小尺寸
                    newWidth = Math.max(newWidth, minCropSize);
                    newHeight = Math.max(newHeight, minCropSize);
                    
                    // 重新計算位置以保持中心
                    newLeft = centerX - newWidth / 2;
                    newTop = centerY - newHeight / 2;
                    
                    // 確保位置不超出邊界
                    newLeft = Math.max(0, Math.min(newLeft, containerWidth - newWidth));
                    newTop = Math.max(0, Math.min(newTop, containerHeight - newHeight));
                    
                    finalWidth = Math.floor(newWidth);
                    finalHeight = Math.floor(newHeight);
                    ui.size.width = finalWidth;
                    ui.size.height = finalHeight;
                    ui.position.left = Math.floor(newLeft);
                    ui.position.top = Math.floor(newTop);
                    
                } else {
                    // 原本的非對稱裁切模式
                    var dx = ui.position.left - ui.originalPosition.left;
                    var dy = ui.position.top - ui.originalPosition.top;
                    var left = ui.originalPosition.left + dx / zoomRatio;
                    var top = ui.originalPosition.top + dy / zoomRatio;
                    var dw = ui.size.width - ui.originalSize.width;
                    var dh = ui.size.height - ui.originalSize.height;
                    var maxWidth = containerWidth;
                    var maxHeight = containerHeight;

                    var maxDx = (maxWidth - minCropSize + offsetCanvasX) * zoomRatio;
                    var maxDy = (maxHeight - minCropSize + offsetCanvasY) * zoomRatio;
                    
                    if (dx < 0) {
                        maxWidth = ui.originalPosition.left + ui.originalSize.width;
                    }
                    // 避免拉出最大值
                    else if (dx >= maxDx) {
                        left = ui.originalPosition.left + maxDx / zoomRatio;
                    }
                    else {
                        maxWidth = containerWidth - ui.originalPosition.left;
                    }

                    if (dy < 0) {
                        maxHeight = ui.originalPosition.top + ui.originalSize.height;
                    }
                    // 避免拉出最大值
                    else if (dy >= maxDy) {
                        top = ui.originalPosition.top + maxDy / zoomRatio;
                    }
                    else {
                        maxHeight = containerHeight - ui.originalPosition.top;
                    }

                    finalWidth = Math.floor(ui.originalSize.width + dw / zoomRatio);
                    finalHeight = Math.floor(ui.originalSize.height + dh / zoomRatio);

                    if (finalWidth <= minCropSize) finalWidth = minCropSize;
                    if (finalHeight <= minCropSize) finalHeight = minCropSize;

                    if (orientationY === 's') {
                        finalHeight = finalHeight - offsetCanvasY;
                    }
                    else if (orientationY === 'n') {
                        finalHeight = finalHeight + offsetCanvasY;
                        top = top - offsetCanvasY;
                    }
                    if (orientationX === 'e') {
                        finalWidth = finalWidth - offsetCanvasX;
                    }
                    else if (orientationX === 'w') {
                        finalWidth = finalWidth + offsetCanvasX;
                        left = left - offsetCanvasX;
                    }

                    // 如果按下 Shift 鍵，保持比例
                    if (isProportional) {
                        var aspectRatio = ui.originalSize.width / ui.originalSize.height;
                        
                        if (orientationX && orientationY) {
                            // 角落拖拽，需要計算固定點來保持比例
                            var anchorX, anchorY; // 固定不動的錨點
                            
                            // 計算錨點位置（拖拽點的對角）
                            if (orientationX === 'w' && orientationY === 'n') {
                                // 拖拽左上角，錨點是右下角
                                anchorX = ui.originalPosition.left + ui.originalSize.width;
                                anchorY = ui.originalPosition.top + ui.originalSize.height;
                            } else if (orientationX === 'e' && orientationY === 'n') {
                                // 拖拽右上角，錨點是左下角
                                anchorX = ui.originalPosition.left;
                                anchorY = ui.originalPosition.top + ui.originalSize.height;
                            } else if (orientationX === 'w' && orientationY === 's') {
                                // 拖拽左下角，錨點是右上角
                                anchorX = ui.originalPosition.left + ui.originalSize.width;
                                anchorY = ui.originalPosition.top;
                            } else if (orientationX === 'e' && orientationY === 's') {
                                // 拖拽右下角，錨點是左上角
                                anchorX = ui.originalPosition.left;
                                anchorY = ui.originalPosition.top;
                            }
                            
                            // 根據較大的變化來決定縮放
                            var newWidth, newHeight;
                            if (Math.abs(dw) > Math.abs(dh * aspectRatio)) {
                                newWidth = finalWidth;
                                newHeight = finalWidth / aspectRatio;
                            } else {
                                newWidth = finalHeight * aspectRatio;
                                newHeight = finalHeight;
                            }
                            
                            // 根據錨點重新計算位置
                            if (orientationX === 'w') {
                                left = anchorX - newWidth;
                            } else {
                                left = anchorX;
                            }
                            
                            if (orientationY === 'n') {
                                top = anchorY - newHeight;
                            } else {
                                top = anchorY;
                            }
                            
                            finalWidth = newWidth;
                            finalHeight = newHeight;
                            
                        } else if (orientationX) {
                            // 水平拖拽
                            finalHeight = finalWidth / aspectRatio;
                        } else if (orientationY) {
                            // 垂直拖拽
                            finalWidth = finalHeight * aspectRatio;
                        }
                    }

                    finalWidth = Math.min(finalWidth, maxWidth);
                    finalHeight = Math.min(finalHeight, maxHeight);

                    finalWidth = Math.max(finalWidth, minCropSize);
                    finalHeight = Math.max(finalHeight, minCropSize);

                    ui.size.width = finalWidth;
                    ui.size.height = finalHeight;

                    ui.position.left = Math.floor(Math.max(left, 0));
                    ui.position.top = Math.floor(Math.max(top, 0));
                }
                
                // $cropArea.css({
                //     backgroundPosition: `${-ui.position.left}px ${-ui.position.top}px`
                // });

                var displayWidth = finalWidth;
                var displayHeight = finalHeight;
                
                $cropSize.html(`x:${$filter('number', 0)(parseInt($cropArea.css("left")))} y:${$filter('number', 0)(parseInt($cropArea.css("top")))}, ${i18n.__('general.w')}:${$filter('number', 0)(displayWidth)} ${i18n.__('general.h')}:${$filter('number', 0)(displayHeight)}`);
                $toolbarWidthInput.val(displayWidth);
                $toolbarHeightInput.val(displayHeight);
            });

            $cropArea.on("resizestop", function(event, ui ) {
                event.stopPropagation();
                cropResizing = false;
                $cropSize.hide();
            });

            // Draggable
            $cropArea.on("mousedown.drag", function (e) {
                e.stopPropagation();
                e.preventDefault();
                if (cropResizing) return;
                draggingCropArea = true;
                zoomData = $("#detail-container").smoothZoom('getZoomData');
                
                var of = $cropArea.position();
                var zoomRatio = zoomData.ratio;

                containerWidth = $cropContainer.width();
                containerHeight = $cropContainer.height();

                cropAreaWidth = $cropArea.width();
                cropAreaHeight = $cropArea.height();

                originTop = of.top / zoomRatio;
                originLeft = of.left / zoomRatio;
                startX = e.pageX;
                startY = e.pageY;

                // 記錄原來的 x, y 座標
                originalCanvasX = zoomData.scaledX;
                originalCanvasY = zoomData.scaledY;

                $cropArea.addClass("ui-resizable-resizing");
            });

            $(window).on("mouseup.cropimage", function (e) {
                if (!draggingCropArea) return;
                e.stopPropagation();
                $cropArea.removeClass("ui-resizable-resizing");    
                draggingCropArea = false;
            });

            $(window).on("mousemove.cropimage", function (e) {

                if (!draggingCropArea) return;

                e.stopPropagation();
                e.preventDefault();

                currentX = e.pageX;
                currentY = e.pageY;
                zoomData = $("#detail-container").smoothZoom('getZoomData');
                zoomRatio = zoomData.ratio;
                
                var offsetX = (startX - currentX) / zoomRatio;
                var offsetY = (startY - currentY) / zoomRatio;
                var offsetCanvasX = parseInt((originalCanvasX - zoomData.scaledX) / zoomRatio);
                var offsetCanvasY = parseInt((originalCanvasY - zoomData.scaledY) / zoomRatio);
                var top = Math.floor(originTop - offsetY - offsetCanvasY);
                var left = Math.floor(originLeft - offsetX - offsetCanvasX);

                // 限制拖拽範圍
                if (top < 0) { top = 0; }
                if (top > containerHeight - cropAreaHeight) { top = containerHeight - cropAreaHeight; }
                if (left < 0) { left = 0; }
                if (left > containerWidth - cropAreaWidth) { left = containerWidth - cropAreaWidth; }

                $cropArea.css({
                    top: `${top}px`,
                    left: `${left}px`,
                    backgroundPosition: `${-left}px ${-top}px`
                });

                showSize();
            });
        }
    }
});
