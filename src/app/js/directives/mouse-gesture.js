EagleApp.directive('mouseGesture', function () {
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {

            var $scope = angular.element("body").scope();
            var downTime;
            var isZooming = false;
            var startPoint = { x: 0, y: 0 };
            var endPoint = { x: 0, y: 0 };
            var maxDistanceX = 0;
            var originData = { x: undefined, y: undefined, ratio: 100 };
            var $container = element;
            if (attrs.mouseGesture) {
                $container = $(attrs.mouseGesture);
            }
            
            // 視覺反饋元件
            var $gestureCanvas = null;
            var gestureContext = null;
            var gestureThreshold = 20; // 觸發顯示的閾值
            var animationFrame = null;
            var trailPoints = []; // 軌跡點陣列
            var maxTrailLength = 30; // 適中的軌跡點數
            
            // 創建視覺反饋畫布
            function createGestureCanvas() {
                if (!$gestureCanvas) {
                    $gestureCanvas = $('<canvas class="gesture-canvas"></canvas>');
                    $gestureCanvas.css({
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        zIndex: 99999,
                        pointerEvents: 'none',
                        display: 'none'
                    });
                    
                    $('body').append($gestureCanvas);
                    
                    // 設置畫布大小
                    $gestureCanvas[0].width = window.innerWidth;
                    $gestureCanvas[0].height = window.innerHeight;
                    
                    gestureContext = $gestureCanvas[0].getContext('2d');
                    
                    // 監聽視窗大小變化
                    $(window).on('resize.gestureCanvas', function() {
                        if ($gestureCanvas) {
                            $gestureCanvas[0].width = window.innerWidth;
                            $gestureCanvas[0].height = window.innerHeight;
                        }
                    });
                }
                return $gestureCanvas;
            }
            
            // 繪製軌跡效果
            function drawTrail(ctx, distance) {
                if (trailPoints.length < 2) return;
                
                // 根據拖拽距離計算最大圓圈大小（拉越遠越大）
                var maxRadius = Math.min(8 + (distance / 10), 30); // 最小8px，最大30px
                
                // 繪製軌跡圓圈
                trailPoints.forEach(function(point, index) {
                    // 計算每個圓圈的大小和透明度
                    var progress = index / trailPoints.length;
                    // 使用平方曲線讓起始更小
                    var radius = maxRadius * Math.pow(progress, 1.8); // 起始更小，增長更急劇
                    
                    // 使用非線性曲線，讓起始部分更透明
                    var opacity = Math.pow(progress, 2) * 0.6; // 平方曲線，起始更淡
                    
                    ctx.save();
                    ctx.globalAlpha = opacity;
                    
                    // 繪製圓圈（起始部分更淡）
                    var fillOpacity = 0.1 + (progress * 0.1); // 0.1 -> 0.2
                    ctx.fillStyle = 'rgba(0, 114, 239, ' + fillOpacity + ')';
                    ctx.strokeStyle = 'rgba(0, 114, 239, ' + (fillOpacity * 2) + ')';
                    ctx.lineWidth = 1.5;
                    
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    
                    ctx.restore();
                });
            }
            
            var currentMouseX = 0;
            var currentMouseY = 0;
            
            // 動畫循環
            function animateGesture() {
                if (!gestureContext) {
                    animationFrame = null;
                    return;
                }
                
                // 清除畫布
                gestureContext.clearRect(0, 0, $gestureCanvas[0].width, $gestureCanvas[0].height);
                
                // 更新軌跡點（平滑插值）
                if (trailPoints.length === 0 && startPoint.y) {
                    // 初始化軌跡點
                    for (var i = 0; i < maxTrailLength; i++) {
                        trailPoints.push({ x: startPoint.x, y: startPoint.y });
                    }
                }
                
                if (trailPoints.length > 0) {
                    // 更新軌跡點位置
                    var targetX = startPoint.y ? currentMouseX : trailPoints[trailPoints.length - 1].x;
                    var targetY = startPoint.y ? currentMouseY : trailPoints[trailPoints.length - 1].y;
                    
                    var x = targetX;
                    var y = targetY;
                    
                    for (var i = trailPoints.length - 1; i >= 0; i--) {
                        // 平衡的跟隨速度
                        var followSpeed = startPoint.y ? 0.15 : 0.5; // 拖拽時較慢，釋放後快速消失
                        trailPoints[i].x += (x - trailPoints[i].x) * followSpeed;
                        trailPoints[i].y += (y - trailPoints[i].y) * followSpeed;
                        
                        // 下一個點的目標位置
                        x = trailPoints[i].x;
                        y = trailPoints[i].y;
                    }
                    
                    // 計算距離用於調整大小
                    var distance = Math.sqrt(Math.pow(trailPoints[trailPoints.length - 1].x - trailPoints[0].x, 2) + 
                                           Math.pow(trailPoints[trailPoints.length - 1].y - trailPoints[0].y, 2));
                    
                    // 只在有明顯移動時繪製
                    if (distance > 5) {
                        drawTrail(gestureContext, distance);
                    } else if (!startPoint.y) {
                        // 停止拖拽且軌跡幾乎消失時，停止動畫
                        hideGestureVisual();
                        return;
                    }
                }
                
                animationFrame = requestAnimationFrame(animateGesture);
            }
            
            // 更新視覺反饋
            function updateGestureVisual(mouseX, mouseY) {
                if (!$gestureCanvas) {
                    createGestureCanvas();
                }
                
                currentMouseX = mouseX;
                currentMouseY = mouseY;
                
                var distanceX = mouseX - startPoint.x;
                var absDistance = Math.abs(distanceX);
                
                if (absDistance > gestureThreshold && !isZooming) {
                    $gestureCanvas.css('display', 'block');
                    
                    if (!animationFrame) {
                        animateGesture();
                    }
                } else {
                    hideGestureVisual();
                }
            }
            
            // 隱藏視覺反饋
            function hideGestureVisual() {
                if ($gestureCanvas) {
                    $gestureCanvas.css('display', 'none');
                }
                
                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                    animationFrame = null;
                }
                
                // 清空軌跡點
                trailPoints = [];
                
                if (gestureContext) {
                    gestureContext.clearRect(0, 0, $gestureCanvas[0].width, $gestureCanvas[0].height);
                }
            }

            scope.$on('$destroy', function () {
                $container.off('mousedown.mouseGesture');             
                $(window).off('mousemove.mouseGesture');
                $(window).off('mouseup.mouseGesture');
                $(window).off('resize.gestureCanvas');
                
                // 清理視覺反饋元件
                if ($gestureCanvas) {
                    $gestureCanvas.remove();
                    $gestureCanvas = null;
                    gestureContext = null;
                }
                
                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                    animationFrame = null;
                }
            });

            $container.on('mousedown.mouseGesture', (event) =>{
                document.activeElement.blur();
                if (event.button === 2 || event.button === 1) {
                    event.preventDefault();
                    event.stopPropagation();
                    downTime = Date.now();
                    [startPoint.x, startPoint.y] = [event.pageX, event.pageY];
                    originData.ratio = $scope.imageSize.zoomRatio;
                    originData.x = event.pageX;
                    originData.y = event.pageY;
                    maxDistanceX = 0;
                    // 開始新的手勢時清理
                    hideGestureVisual();
                }
            });

            $(window).on('mousemove.mouseGesture', (event) =>{
                if (startPoint.y) {
                    if (isZooming || Math.abs(startPoint.y - event.pageY) > Math.abs(startPoint.x - event.pageX)) {
                        isZooming = true;
                        hideGestureVisual(); // 縮放時隱藏手勢提示
                        var distanceY = (startPoint.y - event.pageY);
            
                        // 动态调整因子，根据当前缩放比例来调整灵敏度
                        var sensitivityFactor = originData.ratio < 100 ? 100 : 150;
            
                        var scale = Math.exp(distanceY / sensitivityFactor); // 使用调整后的灵敏度因子
                        var ratio = originData.ratio * scale;
            
                        // 确保缩放比例在5%到800%之间
                        ratio = Math.max(5, Math.min(200, ratio));
            
                        $scope.updateZoomRatio(ratio, originData.x, originData.y);
                        $scope.$evalAsync();
                    } else {
                        // 左右拖拽時顯示視覺反饋
                        updateGestureVisual(event.pageX, event.pageY);
                    }
                }
                if (Math.abs(startPoint.x - event.pageX) > maxDistanceX) {
                    maxDistanceX = Math.abs(startPoint.x - event.pageX);
                }
            });

            $(window).on('mouseup.mouseGesture', (event) =>{
                if (event.button === 2 || event.button === 1) {
                    event.preventDefault();
                    event.stopPropagation();
                    [endPoint.x, endPoint.y] = [event.pageX, event.pageY];
                    
                    // 不立即隱藏，讓動畫繼續運行直到尾巴消失
                    // hideGestureVisual();
                    
                    if (Math.abs(startPoint.y - event.pageY) - 5 > Math.abs(startPoint.x - event.pageX)) {
                    }
                    // 左右
                    else if (Math.abs(endPoint.x - startPoint.x) > 20 && originData.ratio === $scope.imageSize.zoomRatio){
                        // 必须在 0.3 秒内拖拽才进行换页功能
                        // console.log(maxDistanceX);
                        // console.log( Math.abs(endPoint.x - startPoint.x))
                        if (Date.now() - downTime <= 1000 && Math.abs(endPoint.x - startPoint.x) > maxDistanceX * 2 / 3) {
                            // 右
                            if (endPoint.x > startPoint.x) {
                                $scope.selectNext();
                                $scope.$evalAsync();
                            }
                            else {
                                $scope.selectPrev();
                                $scope.$evalAsync();
                            }
                        }
                    }
                    else if (!isZooming && Math.abs(endPoint.x - startPoint.x) < 2 && Math.abs(endPoint.y - startPoint.y) < 2) {
                        if (event && event.button === 1) {
                            $scope.openPluginPanel();
                        }
                        else {
                            $scope.openItemContextMenu(event, $scope.current);
                            $scope.$evalAsync();
                        }
                    }
                }
                downTime = undefined;
                isZooming = false;
                startPoint = { x: 0, y: 0 };
                endPoint = { x: 0, y: 0 };
                originData = { x: undefined, y: undefined, ratio: 100 };
            });
        }
    }
});