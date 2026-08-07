const path = require('path');
const fs = require('fs');
const electron = require("electron");
const shell = electron.shell;
const clipboard = electron.clipboard;
const remote = require('@electron/remote');
const Menu = remote.Menu;
const MenuItem = remote.MenuItem;
var ipcRenderer = require('electron').ipcRenderer;
const currentWindow = remote.getCurrentWindow();
const electronSettings = require(appRoot + '/my_modules/electron-settings');
const fse = require('fs-extra');
const { app } = require('@electron/remote');
var USER_DATA_PATH = app.getPath('userData');
var EAGLE_THUMBNAIL_TEMP_PATH = require("path").normalize(USER_DATA_PATH + "/eagle-temp");
var $bodyScope;
var fontFolder;
var pluginModule;
if (process.platform === 'darwin') {
    fontFolder = `${app.getPath("home")}/library/Fonts/EagleApp/`;
}
else {
    fontFolder = `${process.env.SYSTEMROOT}/Fonts/`;
}

// MPV Player
const { MpvVideoElement, defaultPlugins, ABLoopPlugin } = require(`mpv-video-player`);
const EagleNotePlugin = require(appRoot + '/app/js/plugins/eagle-note-plugin');
defaultPlugins.forEach(plugin => MpvVideoElement.use(plugin));
MpvVideoElement.use(ABLoopPlugin);
MpvVideoElement.use(EagleNotePlugin);

const pjson = require(appRoot + '/package.json'); 

const VIDEO_TYPES = {}; EagleConfig.VIDEO_FORMATS.forEach(function(ext) { VIDEO_TYPES[ext] = true; });
const AUDIO_TYPES = {}; EagleConfig.AUDIO_FORMATS.forEach(function(ext) { AUDIO_TYPES[ext] = true; });
const MODEL_TYPES = {}; EagleConfig.MODEL_FORMATS.forEach(function(ext) { MODEL_TYPES[ext] = true; });
const FONT_TYPES  = {}; EagleConfig.FONT_FORMATS.forEach(function(ext) { FONT_TYPES[ext] = true; });
const URL_TYPES   = {}; EagleConfig.URL_FORMATS.forEach(function(ext) { URL_TYPES[ext] = true; });

$(document).ready(function() {

    currentWindow.on('enter-full-screen', function () {
        $("body").addClass("fullscreen");
    });

    currentWindow.on('leave-full-screen', function () {
        $("body").removeClass("fullscreen");
    });

    const SeekBar = videojs.getComponent('SeekBar');
    SeekBar.prototype.getPercent = function getPercent() {
        // Allows for smooth scrubbing, when player can't keep up.
        // const time = (this.player_.scrubbing()) ?
        //   this.player_.getCache().currentTime :
        //   this.player_.currentTime()
        const time = this.player_.currentTime()
        const percent = time / this.player_.duration()
        return percent >= 1 ? 1 : percent
    }

    SeekBar.prototype.handleMouseMove = function handleMouseMove(event) {
        var that = this;
        var player = this.player_;
        let newTime = this.calculateDistance(event) * this.player_.duration()
        if (newTime === this.player_.duration()) {
            newTime = newTime - 0.1
        }
        // Note：立即更新画面 by Augus
        // https://github.com/videojs/video.js/issues/4460
        if (player.children_[0]) {
            player.children_[0].currentTime = newTime;
        }
        // player.playPromise = player.play();
        player.currentTime(newTime)
        that.update()
        this.handleMouseUp(event);
    }
});

document.addEventListener('dragover',function(event){
    event.preventDefault();
    return false;
},false);

document.addEventListener('drop',function(event){
    event.preventDefault();
    return false;
},false);

function gup( name, url ) {
    if (!url) url = location.href;
    name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
    var regexS = "[\\?&]"+name+"=([^&#]*)";
    var regex = new RegExp( regexS );
    var results = regex.exec( url );
    return results == null ? null : results[1];
}

var EagleApp = angular.module("EagleApp", ['tippy', 'mgo-mousetrap', 'cgNotify', 'mediaElement', 'mpvMediaElement', 'pluginView', 'tifImg']);

EagleApp.config(function($sceProvider, $httpProvider) {
    $sceProvider.enabled(false);
});

EagleApp.filter('i18n', function($window) {
    return function(key, pairs) {
        var i18nString = i18n.__(key);
        if (pairs) {
            pairs.forEach(function(pair) {
                i18nString = i18nString.replace("{" + pair.property + "}", pair.value);
            })
        }
        return i18nString;
    };
});

EagleApp.filter('mod', function($window) {
    return function(key) {
        if (process.platform != 'darwin') {
            return 'Ctrl';
        } else {
            return '⌘';
        }
    }
});

EagleApp.directive('mouseGesture', function () {
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {

            var $scope = angular.element("body").scope();
            var downTime;
            var isZooming = false;
            var startPoint = { x: 0, y: 0 };
            var endPoint = { x: 0, y: 0 };
            var originData = { x: undefined, y: undefined, ratio: 100 };
            var maxDistanceX = 0;
            
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

            element.on('mousedown', (event) =>{
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
                        var distanceY = (startPoint.y - event.pageY) * 2;
                        var ratio = originData.ratio + (Math.max(originData.ratio + distanceY, Math.abs(originData.ratio - distanceY)) * distanceY) / 800;
                        ratio = parseInt(ratio);
                        if (ratio <= 5) { ratio = 5; }
                        if (ratio >= 800) { ratio = 800; }
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
                        if (Date.now() - downTime <= 333) {
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
                        $scope.openContextMenu(event, $scope.current);
                    }
                }
                downTime = undefined;
                isZooming = false;
                startPoint = { x: 0, y: 0 };
                endPoint = { x: 0, y: 0 };
                originData = { x: undefined, y: undefined, ratio: 100 };
                maxDistanceX = 0;
            });
        }
    }
});

var preferences;

EagleApp.controller("PreviewWindowController", function ($rootScope, $scope, $window, $filter, $timeout, notify) {

	$scope.VIDEO_TYPES = VIDEO_TYPES;
	$scope.AUDIO_TYPES = AUDIO_TYPES;
	$scope.MODEL_TYPES = MODEL_TYPES;
	$scope.FONT_TYPES = FONT_TYPES;
    $scope.URL_TYPES = URL_TYPES;

    $bodyScope = $scope;
    $scope.imageId = gup("id", location.href);
    $scope.platform = process.platform;
    $scope.isMaximize = false;
    preferences = electronSettings.getPreferences();
    electron.webFrame.setZoomFactor(parseInt(preferences.general.zoom) / 100);
    $scope.isDetailMode = true;
    $scope.isGrayscaleMode = false;
    $scope.theme = preferences.theme.css || "gray";
    $scope.MAX_DIMENSION = 120000000;
    if (preferences && preferences.theme.name === 'Auto') {
        if (remote.nativeTheme.shouldUseDarkColors) {
            $scope.theme = "gray";
        }
        else {
            $scope.theme = "light";
        }
    }
    
    $scope.language = preferences.language || "en";
    $rootScope.preferences = preferences;

    $scope.imageSize = {
        modified: false,
        zoomRatio: 100
    };

    $rootScope.undo = function() {};

    $rootScope.closeAll = function() {
        notify.closeAll();
    };

    $rootScope.notify = function(params, restoreCallbackk) {

        if (!params.message) return;

        var messageTemplate = '<span>' + params.message;

        if (restoreCallbackk) {
            messageTemplate = messageTemplate + ' <a ng-click="closeAll();undo();">' + $filter('i18n')("notify.button.undo") + '</a></span>';
        } else {
            messageTemplate = messageTemplate + '</span>';
        }

        notify.closeAll();

        $timeout(function() {
            notify({
                duration: params.duration || 4000,
                messageTemplate: messageTemplate,
                classes: [],
                scope: $rootScope,
                templateUrl: '',
                position: 'center',
            });
            if (restoreCallbackk) {
                $rootScope.undo = restoreCallbackk;
            } else {
                $rootScope.undo = function() {};
            }
        }, 100);
    };

    $scope.getRawPath = function (image) {
        if (!image || !$scope.imagesDir) return;
        return getRawPath($scope.imagesDir, image);
    };

    $scope.toggleGifPlayerMode = function () {
        $scope.usingGifPlayer = !$scope.usingGifPlayer;
    };

    $scope.openGifContextMenu = (event) => {

        event.stopPropagation();

        const contextMenu = new Menu();
        contextMenu.append(new MenuItem({
            label: i18n.__("context.gifViewer.setThumbnail"),
            click: () => {
                $scope.gifViewer.setThumbnail();
                $scope.$evalAsync();
            }
        }));

        contextMenu.append(new MenuItem({
            label: i18n.__("context.gifViewer.cancelRange"),
            click: () => {
                $scope.gifViewer.cancelRange();
                $scope.$evalAsync();
            }
        }));

        contextMenu.popup(currentWindow);
    };

    $scope.getExifRawPath = function () {
        if ($scope.current) {
            // return `./exif-viewer/index.html?orientation=${$scope.current.orientation}&path=${$scope.getRawPath($scope.current)}&width=${$scope.current.width}&height=${$scope.current.height}`;
            return `./exif-viewer/index.html?orientation=${$scope.current.orientation}&path=${encodeURIComponent($scope.getRawPath($scope.current))}&width=${$scope.current.width}&height=${$scope.current.height}&zoom=${$rootScope.preferences.habits.renderBehavior}`;
        }
    };

    $scope.getRawUrl = function (image) {
        if (!$scope.imagesDir || !image) return;
        return FileUrlHelper.getRawUrl(image);
    };

    $scope.getThumbnailUrl = function (image) {
        if (!$scope.imagesDir || !image) return;
        return FileUrlHelper.getThumbnailUrl(image);
    };

    $scope.getThumbnailPath = function (image) {
        return getThumbnailPath($scope.imagesDir, image);
    };

    $scope.getRatioExp = function (ratio) {
        if (ratio > 100) {
            ratio = 100 + (ratio - 100) * 7;
        }
        return parseInt(ratio);
    };

    $scope.getRatioNonExp = function (ratio) {
        if (ratio > 100) {
            ratio = (ratio - 100) / 7 + 100;
        }
        return ratio;
    };

    ipcRenderer.on('change.zoom', function(e, zoom) {
        electron.webFrame.setZoomFactor(parseInt(zoom) / 100);
    });

    ipcRenderer.on('change.current.theme', function(e, theme) {
        if (theme.name === "Auto") {
            if (remote.nativeTheme.shouldUseDarkColors) {
                $scope.theme = "gray";
            }
            else {
                $scope.theme = "light";
            }
        }
        else {
            $scope.theme = theme.css || "gray";
        }
        $scope.$evalAsync();
    });

    ipcRenderer.on('update-preferences', function() {
        $rootScope.preferences = electronSettings.getPreferences();
        $scope.$evalAsync();
    });

    ipcRenderer.send('get.viewer.image', $scope.imageId);

    ipcRenderer.on('init', function (err, params) {
        console.log(params);
        if (params) {
            $scope.images = params.images;
			try {
				pluginModule = $scope.pluginModule = params.pluginModule;
                $scope.pluginModule.previewExtension.allowZoom = (ext) => {
                    const plugin = pluginModule.previewExtension.viewerPluginMap[ext];
                    if (!plugin?.manifest?.preview) return false;
                    
                    const keys = Object.keys(plugin?.manifest?.preview);
                    for (const key of keys) {
                        if (key.includes(ext)) {
                            return plugin?.manifest?.preview[key]?.viewer?.allowZoom === true;
                        }
                    }
                };
				$scope.pluginModule.previewExtension.getViewerPluginExt = (item) => {
					if (!item) return;
					if ($scope.pluginModule.previewExtension.viewerPluginMap[item?.ext]) {
						return 'plugin';
					}
                    const IMAGE_TYPES = {
                        'jpg': true,
                        'jpeg': true,
                        'png': true,
                        'webp': true,
                        'avif': true,
                        'insp': true,
                        'jfif': true,
                        'jpe': true,
                        'jxl': true,
                        'bmp': true,
                        'tif': true,
                        'tiff': true,
                        'hif': true,
                        'heif': true,
                        'heic': true,
                    };
                    if (IMAGE_TYPES[item?.ext]) {
                        return 'image';
                    }
                    if (item.customThumbnail && !EagleConfig.SUPPORT_FORMATS[item.ext]) {
                        return 'custom';
                    }
					return item.ext;
				};
				$scope.pluginModule.previewExtension.getViewerPluginURL = (item) => {
					const path = FileUrlHelper.getRawPath(item);
					const locale = $rootScope.preferences.general.language.replace("_", "-");
					const theme = $bodyScope.theme;
                    const id = item.id;
					return `${$scope.pluginModule?.previewExtension.viewerURL[item?.ext]}?id=${id}&path=${encodeURIComponent(path)}&width=${item.width}&height=${item.height}&lang=${locale}&theme=${theme}`;
				};
                $scope.pluginModule.previewExtension.getViewerPlugin = (item) => {
                    if (!item) return;
                    if ($scope.pluginModule.previewExtension.viewerPluginMap[item?.ext]) {
                        return $scope.pluginModule.previewExtension.viewerPluginMap[item?.ext];
                    }
                    return undefined;
                };
			}
			catch (err) {
				console.error(err);
			}
            // $scope.imagesDir = params.imagesDir;
            if (process.platform == 'darwin') {
                $scope.imagesDir = encodeURI(params.imagesDir);
            } else {
                $scope.imagesDir = encodeURI(params.imagesDir.replace(/\\/g, "/"));
            }
            $scope.libraryImagesPath = params.imagesDir;
            $scope.current = $scope.images[0];
            $scope.metas = $scope.getMetas($scope.current);
            $scope.$evalAsync();
            initContainer();
        }
    });

    // 持压著 Shift 直接拖拽图片窗口位置
    var isDragMode = false;
    $(window).on("keydown.toggleDragMode", function (event) {
        if (event.keyCode === 16) {
            $("#drag-mode-overlay").addClass("show");
            isDragMode = true;
        }
    });

    $(window).on("keyup.toggleDragMode", function (event) {
        if (event.keyCode === 16) {
            $("#drag-mode-overlay").removeClass("show");
            isDragMode = false;
        }
    });

    $("#drag-mode-overlay").on("mouseup", function (event) {
        if (!event.shiftKey) {
            $("#drag-mode-overlay").removeClass("show");
            isDragMode = false;
        }
    });

    $("#drag-mode-overlay").on("mousemove", function (event) {
        if (isDragMode) {
            $("#drag-mode-overlay").removeClass("show");
            isDragMode = false;
        }
    });

    document.addEventListener("mousemove", function (event) {
        if (!isDragMode) {
            if (event.shiftKey) {
                $("#drag-mode-overlay").addClass("show");
                isDragMode = true;
            }
        }
        else {
            $("#drag-mode-overlay").removeClass("show");
            isDragMode = false;
        }
    });

    $("#min-btn").on("click", function(e) {
        currentWindow.minimize();
    });

    $("#max-btn").on("click", function(e) {
        if (currentWindow.isFullScreen()) {
            currentWindow.setFullScreen(false);
        } else if (!currentWindow.isMaximized()) {
            currentWindow.maximize();
            $scope.isMaximize = true;
        } else {
            currentWindow.unmaximize();
            $scope.isMaximize = false;
        }
    });

    $("#restore-btn").on("click", function(e) {
        if (currentWindow.isFullScreen()) {
            currentWindow.setFullScreen(false);
        } else if (!currentWindow.isMaximized()) {
            currentWindow.maximize();
            $scope.isMaximize = true;
        } else {
            currentWindow.unmaximize();
            $scope.isMaximize = false;
        }
    });

    $scope.toggleFullScreen = function () {
        currentWindow.setFullScreen(!currentWindow.isFullScreen());
    }

    $scope.close = function () {
        if (currentWindow.isFullScreen()) {
            currentWindow.setFullScreen(false);
        }
        else {
            currentWindow.close();
        }
    };

    $scope.minimize = () => {
        currentWindow.minimize();
    };

    $scope.maximize = () => {
        if (!currentWindow.isMaximized()) {
            currentWindow.maximize();
            $scope.isMaximize = true;
        } else {
            currentWindow.unmaximize();
            $scope.isMaximize = false;
        }
    };

    $scope.restore = () => {
        if (!currentWindow.isMaximized()) {
            currentWindow.maximize();
            $scope.isMaximize = true;
        } else {
            currentWindow.unmaximize();
            $scope.isMaximize = false;
        }
    };

    // var resizeTimeout;
    $(window).on('resize', throttle(function() {
        $(window).trigger("orientationchange");
        if (!$scope.imageSize.modified) {
            $scope.zoom();
            $timeout(function () {
                $scope.zoom();
            }, 200);
            $scope.$evalAsync();
        }
    }, 16));

    const lastPoint = {};
    setInterval(() => {
        const currentPoint = remote.screen.getCursorScreenPoint();
        const windowBounds = currentWindow.getBounds();
        
        if (currentPoint.x < windowBounds.x || currentPoint.y < windowBounds.y || currentPoint.x > windowBounds.x + windowBounds.width || currentPoint.y > windowBounds.y + windowBounds.height) {
            $("body").addClass("hide-toolbar");
        }
        else {
            // 如果鼠标位置没有变化，不进行操作
            if (lastPoint.x === currentPoint.x && lastPoint.y === currentPoint.y) return;
            $("body").removeClass("hide-toolbar");
        }

        lastPoint.x = currentPoint.x;
        lastPoint.y = currentPoint.y;

    }, 500);

    $(window).on("blur", function () {
        clearTimeout(autoHideToolbarTimeout);
        $("body").addClass("hide-toolbar");
    });

    $(document).on("mouseenter", function () {
        clearTimeout(autoHideToolbarTimeout);
        $("body").removeClass("hide-toolbar");
    });

    $(document).on("mousemove", throttle(function () {
        $("body").removeClass("hide-toolbar");
    }, 200));

    $(document).on("mousemove", function () {
        clearTimeout(autoHideToolbarTimeout);
        autoHideToolbarTimeout = setTimeout(function () {
            $("body").addClass("hide-toolbar");
        }, 1000);
    });

    var autoHideToolbarTimeout;
    function initContainer () {
        $scope.showDetailImage = false;
        $("#detail-container").smoothZoom({
            width: '100%',
            height: '100%',
            responsive: true,
            mouse_WHEEL: true,
            mouse_DOUBLE_CLICK: false,
            zoom_BUTTONS_SHOW: false,
            pan_BUTTONS_SHOW: false,
            background_COLOR: 'transparent',
            border_SIZE: 0,
            animation_SMOOTHNESS: 0,
            animation_SPEED_ZOOM: 0,
            animation_SPEED_PAN: 0,
            zoom_MAX: 800,
            zoom_MIN: 5,
            on_IMAGE_LOAD: function() {
                $timeout(function() {
                    $("#detail-container").smoothZoom('updateNavigator', $scope.current);
                    $(window).trigger("orientationchange");
                    $scope.zoom();
                    $("#detail-container").css("opacity", 1);
                    $timeout(function () {
                        $scope.showDetailImage = true;
                    }, 200);
                }, 200);
            }
        });
    };

    $scope.startDrag = function (event) {
        if ($scope.current) {
            var transformsJSON = JSON.stringify([$scope.current]);
            ipcRenderer.send('ondragstart', { images: transformsJSON, target: $scope.current, resize: 120 });
        }
    };

    $scope.onMiddleClick = function (event) {
        if (event && event.button === 1) {
            if ($rootScope.preferences.habits.middleBtn === "openNewWindow") {
                event && event.preventDefault();
                $scope.close();
                return;
            }
        }
    };

    $scope.openWithDefault = function (event) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        var rawPath = FileUrlHelper.getRawPath($scope.current);
        ipcRenderer.send('open-with-default', rawPath);
    };

    $scope.openWithFinder = function (event) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        var rawPath = FileUrlHelper.getRawPath($scope.current);
        ipcRenderer.send('show-item-in-folder', rawPath);
    };

    $scope.copyAsPath = function (event) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        var rawPath = FileUrlHelper.getRawPath($scope.current);
        clipboard.writeText(rawPath);
        $scope.showCopyToast = true;
        $timeout.cancel(copyImageTimeout);
        copyImageTimeout = $timeout(function () {
            $scope.showCopyToast = false;
        }, 1000)
    };

    $scope.copyAsLink = function (event) {
        if ($scope.current) {
            clipboard.writeText(`http://localhost:41595/item?id=${$scope.current.id}`);
            $scope.showCopyToast = true;
            $timeout.cancel(copyImageTimeout);
            copyImageTimeout = $timeout(function () {
                $scope.showCopyToast = false;
            }, 1000)
        }
    };

    $scope.openContextMenu = function(event) {

        event.stopPropagation();

        var contextMenu = new Menu();
        var openWithDefault = new MenuItem({
            label: $filter('i18n')('context.image.openInDefault'),
            accelerator: preferences.shortcuts.keybinds['view.file.opendefault'],
            click: function() {
                $scope.openWithDefault();
            }
        });

        var openWithFinderLabel = $filter('i18n')('context.image.openInExplorer');
        if (process.platform === 'darwin') {
            openWithFinderLabel = $filter('i18n')('context.image.revealInFinder');
        }
        var openWithFinder = new MenuItem({
            label: openWithFinderLabel,
            accelerator: preferences.shortcuts.keybinds['view.file.openfinder'],
            click: function() {
                $scope.openWithFinder();
            }
        });

        var copyItem = new MenuItem({
            label: $filter('i18n')('context.image.copyItems') + " (&C)",
            accelerator: 'CmdOrCtrl+C',
            click: function() {
                $scope.copyImage();
                $scope.$evalAsync();
            }
        });
        
        var grayscaleItem = new MenuItem({ 
            label: $filter('i18n')('appmenu.view>grayscale'), 
            type: 'checkbox', 
            accelerator: preferences.shortcuts.keybinds['view.grayscale'], 
            checked: $scope.isGrayscaleMode, 
            click: function(event) { $scope.toggleGrayscale(event); $scope.$evalAsync(); } 
        });
        var rotateItem = new MenuItem({ 
            label: $filter('i18n')('toolbar.rotateBtnHint'), 
            accelerator: preferences.shortcuts.keybinds['edit.image.rotate'], 
            click: function(event) { $scope.rotateHandler(event); } 
        });
        var flipItem = new MenuItem({ 
            label: $filter('i18n')('toolbar.flipBtnHint'), 
            accelerator: preferences.shortcuts.keybinds['edit.image.flip'], 
            click: function(event) { $scope.flipHandler(event); } 
        });
        var revealInFolder = new MenuItem({ 
            label: i18n.__("previewWindow.revealInEagle"),
            click: function() {
                ipcRenderer.send('reveal-in-eagle', $scope.current);
            } 
        });

        var current = $scope.current;
        var isVideo = !!(current && (VIDEO_TYPES[current.ext] ));

        contextMenu.append(openWithDefault);
        contextMenu.append(openWithFinder);
        contextMenu.append(new MenuItem({ type: 'separator' }));
        contextMenu.append(copyItem);
        contextMenu.append(new MenuItem({
            label: i18n.__('context.image.copyItemPath'),
            accelerator: preferences.shortcuts.keybinds['edit.copy.path'],
            click: function () {
                $scope.copyAsPath();
                $scope.$evalAsync();
            }
        }));
        contextMenu.append(new MenuItem({
            label: i18n.__("appmenu.edit>copyAsLink"),
            click: function () {
                $scope.copyAsLink();
                $scope.$evalAsync();
            }
        }));
        contextMenu.append(new MenuItem({ type: 'separator' }));

        if (isVideo) {

            var copyCurrentVideoScreen = new MenuItem({
                label: i18n.__("context.image.copyCurrentFrameToClipboard") + " (&P)",
                accelerator: preferences.shortcuts.keybinds['player.thumbnail.copy'],
                click: function() {
                    $scope.videoScreenShot(true);
                }
            });

            var saveCurrentVideoScreen = new MenuItem({
                label: i18n.__("context.image.saveCurrentFrame") + " (&S)",
                accelerator: preferences.shortcuts.keybinds['player.thumbnail.save'],
                click: function() {
                    $scope.videoScreenShot();
                }
            });
            contextMenu.append(copyCurrentVideoScreen);
            contextMenu.append(saveCurrentVideoScreen);
            contextMenu.append(new MenuItem({ type: 'separator' }));
        }

        contextMenu.append(rotateItem);
        contextMenu.append(flipItem);
        contextMenu.append(new MenuItem({
            label: i18n.__("appmenu.view>showNavigator"),
            type: 'checkbox',
            checked: !$scope.isHideNavigator,
            click: function() {
                $scope.isHideNavigator = !$scope.isHideNavigator;
                localStorage["isHideNavigator_Viewer"] = $scope.isHideNavigator;
                $scope.$evalAsync();
            }
        }));
        contextMenu.append(grayscaleItem);
        
        // Opacity submenu
        var opacityMenu = new Menu();
        for (var i = 10; i <= 100; i += 10) {
            (function(opacity) {
                opacityMenu.append(new MenuItem({
                    label: opacity + '%',
                    type: 'checkbox',
                    checked: currentWindow.getOpacity() === opacity / 100,
                    click: function() {
                        currentWindow.setOpacity(opacity / 100);
                    }
                }));
            })(i);
        }
        
        var opacityItem = new MenuItem({
            label: i18n.__('appmenu.view>opacity'),
            submenu: opacityMenu
        });
        
        contextMenu.append(opacityItem);
        contextMenu.append(new MenuItem({ type: 'separator' }));
        contextMenu.append(revealInFolder);

        $timeout(function() {
            contextMenu.popup(currentWindow);
        }, 100);

    };

    $scope.getModelPath = function() {
        if ($scope.current) {
            var rawUrl = FileUrlHelper.getRawUrl($scope.current);
			rawUrl = rawUrl.replaceAll(',', '%2C');
            var type = $scope.current.ext;
            // return `model-viewer/index.html?url=${rawUrl}&type=${type}`;
			return `model-viewer/website/index.html#model=${rawUrl}`;
        }
    };

    $scope.getPDFPath = function() {
        if ($scope.current) {
            var pdfPath = FileUrlHelper.getRawUrl($scope.current);
            var locale = $rootScope.preferences.general.language.replace("_", "-");
            return `pdf-viewer/web/viewer.html?path=${encodeURIComponent(pdfPath)}&locale=${locale}&theme=${$scope.theme}`;
        }
    };

    $scope.getGIFPath = function() {
        if ($scope.current) {
            var gifPath = FileUrlHelper.getRawPath($scope.current);
            var gifUrl = FileUrlHelper.getRawUrl($scope.current);
            var renderBehavior = $rootScope.preferences.habits.renderBehavior;
            return "gif-viewer/index.html?path=" + encodeURIComponent(gifPath) + "&url=" + encodeURIComponent(gifUrl) + "&name=" + encodeURIComponent($scope.current.name + ".gif") + `&render=${renderBehavior}`;
        }
    };

    $scope.getNativeViewerPath = function() {
        if ($scope.current) {
            var filePath = $scope.imagesDir + $scope.current.id + ".info/";
            return "native-viewer/index.html?path=" + encodeURIComponent(filePath) + "&name=" + encodeURIComponent($scope.current.name + "." + $scope.current.ext) + "&ext=" + $scope.current.ext + "&width=" + $scope.current.width + "&height=" + $scope.current.height + "&id=" + $scope.current.id;
        }
    };

    $scope.getRawViewerPath = function() {
        if ($scope.current) {
            var image = $scope.current;
            var rawPath = $scope.imagesDir + $scope.current.id + ".info/";
            return `./raw-viewer/index.html?orientation=${image.orientation}&path=${encodeURIComponent(rawPath)}&name=${encodeURIComponent(image.name)}&ext=${image.ext}&width=${image.width}&height=${image.height}`;
        }
    };

    $scope.getFontPath = function() {
        if ($scope.current) {
            return `./font-viewer/font-viewer.html?id=${$scope.current.id}`;
        }
    };

    $scope.getTxtPath = function() {
        if ($scope.current) {
            return `./text-editor/text-editor.html?id=${$scope.current.id}&theme=${$scope.theme}&language=${$rootScope.preferences.general.language}`;
        }
    };

    $scope.getURLSrc = function () {
        let item = $scope.current;
        if (item.ext === "url") {
            var embed;
            if (item.medium === "youtube") {
                embed = `https://www.youtube-nocookie.com/embed/${item.videoID}?autoplay=1&vq=hq1080`;
            }
            else if (item.medium === "vimeo") {
                embed = `https://player.vimeo.com/video/${item.videoID}?autoplay=1`;
            }
            else {
                embed = item.url;
            }
            return embed;
        }
        else {
            return FileUrlHelper.getRawUrl($scope.current);
        }
    }

    $scope.isFontActivate = function (item) {
        var key = Object.keys(item.fontMetas.postScriptName)[0];
        var postScriptName = item.fontMetas.postScriptName && item.fontMetas.postScriptName[key];
        var outPath = `${fontFolder}/${postScriptName}.${item.ext}`;
        return require("fs").existsSync(outPath);
    };

    $scope.activateFont = function (font, {showNotify, updateView}) {
        ipcRenderer.send('activate-font', font);
        $scope.notify({
            message: $filter('i18n')("notify.font.activate", [
                            { "property": "name", "value": font.name }
                        ]),
            duration: 1000
        });
    };

    $scope.deactivateFont = function (font, {showNotify, updateView}) {
        ipcRenderer.send('deactivate-font', font);
        $scope.notify({
            message: $filter('i18n')("notify.font.deactivate", [
                            { "property": "name", "value": font.name }
                        ]),
            duration: 1000
        });
    };

    $scope.getMetas = function (current) {
        if (!current) return;
        var metas = "";
        if (current && current.fontMetas && current.fontMetas.weight) {
            metas = `${current.name}.${current.ext}`;
        }
        else if (current && current.ext === 'txt'){
            metas = `${current.name}.${current.ext}`;
        }
        else if (current && current.ext === 'url'){
            metas = `${current.name} - ${current.url}`;
        }
        else {
            metas = `${current.name}.${current.ext} (${current.width}×${current.height})`;
        }
        return metas;
    }

    $scope.currentIndex = function() {
        if (!$scope.images) return undefined;
        return $scope.images.indexOf($scope.current) + 1;
    };

    var zoomHintTimeout;
    var updateZoomRatioTimeout;
    $scope.updateZoomRatio = function(ratio, x, y, hasTransition) {

        $scope.imageSize.modified = true;

        var pageX, pageY;

        if (ratio) {
            $scope.imageSize.zoomRatio = parseInt(ratio);
        }

        if ($.isNumeric(x) && $.isNumeric(y)) {
            pageX = x;
            pageY = y;
        } else {
            pageX = $(window).width() / 2;
            pageY = $(window).height() / 2;
        }

        if (hasTransition) {
            clearTimeout(updateZoomRatioTimeout);
            $("#detail-container").addClass("zooming");
            updateZoomRatioTimeout = setTimeout(function () {
                $("#detail-container").removeClass("zooming");
            }, 300);
        }

        $("#detail-container").smoothZoom('focusTo', {
            zoom: $scope.imageSize.zoomRatio,
            pageX: pageX,
            pageY: pageY,
            speed: 0
        });
    };

    $scope.openRatioContextMenu = function() {

        var contextMenu = new Menu();

        var ratio5Item = new MenuItem({ label: '5%', type: 'checkbox', checked: parseInt($scope.imageSize.zoomRatio) == 5, click: function() { $scope.updateZoomRatio(5, undefined, undefined, true); $scope.$evalAsync(); } });
        var ratio10Item = new MenuItem({ label: '10%', type: 'checkbox', checked: parseInt($scope.imageSize.zoomRatio) == 10, click: function() { $scope.updateZoomRatio(10, undefined, undefined, true); $scope.$evalAsync(); } });
        var ratio25Item = new MenuItem({ label: '25%', type: 'checkbox', checked: parseInt($scope.imageSize.zoomRatio) == 25, click: function() { $scope.updateZoomRatio(25, undefined, undefined, true); $scope.$evalAsync(); } });
        var ratio50Item = new MenuItem({ label: '50%', type: 'checkbox', checked: parseInt($scope.imageSize.zoomRatio) == 50, click: function() { $scope.updateZoomRatio(50, undefined, undefined, true); $scope.$evalAsync(); } });
        var ratio100Item = new MenuItem({ label: '100%', type: 'checkbox', checked: parseInt($scope.imageSize.zoomRatio) == 100, click: function() { $scope.updateZoomRatio(100, undefined, undefined, true); $scope.$evalAsync(); } });
        var ratio125Item = new MenuItem({ label: '125%', type: 'checkbox', checked: parseInt($scope.imageSize.zoomRatio) == 125, click: function() { $scope.updateZoomRatio(125, undefined, undefined, true); $scope.$evalAsync(); } });
        var ratio150Item = new MenuItem({ label: '150%', type: 'checkbox', checked: parseInt($scope.imageSize.zoomRatio) == 150, click: function() { $scope.updateZoomRatio(150, undefined, undefined, true); $scope.$evalAsync(); } });
        var ratio200Item = new MenuItem({ label: '200%', type: 'checkbox', checked: parseInt($scope.imageSize.zoomRatio) == 200, click: function() { $scope.updateZoomRatio(200, undefined, undefined, true); $scope.$evalAsync(); } });
        var ratio300Item = new MenuItem({ label: '300%', type: 'checkbox', checked: parseInt($scope.imageSize.zoomRatio) == 300, click: function() { $scope.updateZoomRatio(300, undefined, undefined, true); $scope.$evalAsync(); } });
        var ratio400Item = new MenuItem({ label: '400%', type: 'checkbox', checked: parseInt($scope.imageSize.zoomRatio) == 400, click: function() { $scope.updateZoomRatio(400, undefined, undefined, true); $scope.$evalAsync(); } });
        var ratio800Item = new MenuItem({ label: '800%', type: 'checkbox', checked: parseInt($scope.imageSize.zoomRatio) == 800, click: function() { $scope.updateZoomRatio(800, undefined, undefined, true); $scope.$evalAsync(); } });
        var ratioActualItem = new MenuItem({ 
            label: $filter('i18n')('context.zoom.zoomActural'), 
            accelerator: preferences.shortcuts.keybinds['view.zoom.actual'], 
            click: function() { $scope.zoomActual(); } 
        });
        var ratioFitItem = new MenuItem({ 
            label: $filter('i18n')('context.zoom.zoomFit'), 
            accelerator: preferences.shortcuts.keybinds['view.zoom.fit'], 
            click: function() { $scope.zoomFit(); } 
        });

        contextMenu.append(ratio5Item);
        contextMenu.append(ratio10Item);
        contextMenu.append(ratio25Item);
        contextMenu.append(ratio50Item);
        contextMenu.append(ratio100Item);
        contextMenu.append(ratio125Item);
        contextMenu.append(ratio150Item);
        contextMenu.append(ratio200Item);
        contextMenu.append(ratio300Item);
        contextMenu.append(ratio400Item);
        contextMenu.append(ratio800Item);
        contextMenu.append(new MenuItem({ type: 'separator' }));
        contextMenu.append(ratioActualItem);
        contextMenu.append(ratioFitItem);

        $timeout(function() {
            contextMenu.popup(currentWindow);
        }, 50);
    };

    $scope.nextFrameHandler = throttle(function(event) {
        event && event.preventDefault();
        var amount = 1;
        if (event.shiftKey) amount = 10;
        if ($scope.isDetailMode) {
            if ($scope.current.ext === "gif") {
                $scope.nextGifFrame(amount);
            }
        }
    }, 100, true);

    $scope.prevFrameHandler = throttle(function(event) {
        event && event.preventDefault();
        var amount = 1;
        if (event.shiftKey) amount = 10;
        if ($scope.isDetailMode) {
            if ($scope.current.ext === "gif") {
                $scope.prevGifFrame(amount);
            }
        }
    }, 100, true);

    $scope.videoScreenShot = function (copyMode) {
        if ($scope.current) {

            var video = $(".detail-wrap video")[0];
            var currentTime = video.currentTime;
            var canvas = document.createElement('canvas');
            var ctx = canvas.getContext('2d');
            var width = $scope.current.width;
            var height = $scope.current.height;

            canvas.width = width;
            canvas.height = height;

            video.setAttribute("crossOrigin", 'Anonymous')
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            var base64 = canvas.toDataURL("image/jpeg", 0.95);

            if (copyMode) {
                try {
                    $scope.showCopyToast = true;
                    $timeout.cancel(copyImageTimeout);
                    copyImageTimeout = $timeout(function () {
                        $scope.showCopyToast = false;
                    }, 1000);
                    var nativeImage = electron.nativeImage;
                    var newImage = nativeImage.createFromDataURL(base64);
                    remote.clipboard.writeImage(newImage);
                    $scope.$evalAsync();
                }
                catch (err) {
                    electronLog && electronLog.error(err.stack || err);
                }
            }
            else {
                var data = {
                    id: guid(),
                    name: `${$scope.current.name} - ${currentTime}`,
                    url: $scope.current.url || "",
                    tags: [],
                    modificationTime: Date.now(),
                    base64data:  base64,
                };
                ipcRenderer.send('screencapture-from-extension', data);
            }
        }
    };

    $scope.saveVideoFrame = function () {
        $scope.videoScreenShot();
    };

    $scope.copeVideoFrame = function () {
        $scope.videoScreenShot(true);
    };

    $scope.mHandler = function($event) {
        $(".vjs-mute-control").click();
    };

    $scope.flipHandler = function ($event) {
        $event && $event.preventDefault && $event.preventDefault();
        if (
            $scope.current &&
            (VIDEO_TYPES[$scope.current.ext] || AUDIO_TYPES[$scope.current.ext])
        ) {
            $scope.flipVideo($event, $scope.current);
        }
        else {
            $scope.flipImage($event, $scope.current, true);
        }
    }

    $scope.rotateHandler = function ($event) {
        $event && $event.preventDefault && $event.preventDefault();
        if (
            $scope.current &&
            (VIDEO_TYPES[$scope.current.ext] || AUDIO_TYPES[$scope.current.ext])
        ) {
            $scope.rotateVideo($event, $scope.current);
        }
        else {
            $scope.rotateImage($event, $scope.current, true); // 啟用寫入檔案功能
        }
    }

    $scope.rotateVideo = function (event) {
        var video = $(".detail-wrap video")[0];
        if (video) {
            var $video = $(video);
            var degree = $video.data("degree") || 0;
            // 鼠标点击
            if (event.type === "click") {
                if (!event.shiftKey) {
                    degree = degree - 90;
                }
                else {
                    degree = degree + 90;
                }
            }
            else {
                degree = degree - 90;
            }

            degree = degree % 360;
            if (degree < 0) { degree += 360; }

            $video.data("degree", degree);
            $video.removeClass("r90 r180 r270");
            $video.addClass(`r${degree}`);
        }
    };

    $scope.rotateImage = function (event, image, writeToFile = false) {

        var rotatedImage = image;
        if (!rotatedImage) return;
        const [originalWidth, originalHeight] = [rotatedImage.width, rotatedImage.height];
        [rotatedImage.width, rotatedImage.height] = [originalHeight, originalWidth];

        var degree = $("#detail-image").data("degree") || 0;
        var rotationDegree; // 實際要旋轉的度數
        
        // 鼠标点击
        if (event.type === "click") {
            if (!event.shiftKey) {
                degree = degree - 90;
                rotationDegree = -90;
                $("#detail-container").smoothZoom('rotate', {angle: -90, item: rotatedImage});
            }
            else {
                degree = degree + 90;
                rotationDegree = 90;
                $("#detail-container").smoothZoom('rotate', {angle: 90, item: rotatedImage});
            }
        }
        else {
            degree = degree - 90;
            rotationDegree = -90;
            $("#detail-container").smoothZoom('rotate', {angle: -90, item: rotatedImage});
        }

        $("#detail-image").data("degree", degree);
        $("#detail-image").css({
            "transform": `rotate(${degree}deg) scaleX(1) scaleY(1)`,
            "transition": "transform 100ms ease-in-out"
        });

        // 處理檔案寫入功能，根據設定決定是否寫入
        var shouldWriteToFile = writeToFile && $rootScope.preferences.habits.imageRotateMode === 'write';
        if (shouldWriteToFile && rotatedImage) {
            var rawPath = FileUrlHelper.getRawPath(rotatedImage);
            if (!rawPath) {
                console.warn('Cannot get raw path for image:', rotatedImage);
                return;
            }

            // 載入 rotateImage 工具模組並執行旋轉
            try {
                const rotateImageUtil = require(appRoot.path + '/app/js/utils/rotateImage.js');
                rotateImageUtil(rawPath, rotationDegree)
                    .then((result) => {
                        console.log(`Image rotated (${rotationDegree}°) and saved: ${rawPath}`);
                        
                        // 如果有返回新尺寸，更新圖片物件
                        if (result && result.width && result.height) {
                            rotatedImage.width = result.width;
                            rotatedImage.height = result.height;
                        }
                        
                        // 清除 orientation 屬性
                        delete rotatedImage.orientation;
                        
                        // 重新生成縮圖
                        ipcRenderer.send('regenerate-thumbnail', [rotatedImage]);
                    })
                    .catch(err => {
                        console.error(`Failed to save rotated image: ${err.message}`);
                        // 如果寫入失敗，恢復圖片尺寸
                        rotatedImage.width = originalWidth;
                        rotatedImage.height = originalHeight;
                    });
            } catch (requireErr) {
                console.error(`Failed to load rotateImage module: ${requireErr.message}`);
                // 如果載入失敗，恢復圖片尺寸
                rotatedImage.width = originalWidth;
                rotatedImage.height = originalHeight;
            }
        }
    };


    $scope.flipImage = function (event, image, writeToFile = false) {

        if ($scope.isCropMode) return;
        var rotatedImage = image || $scope.selected[0];
        if (!rotatedImage) return;

        // 直接進行 bitmap 翻轉，不需要狀態追蹤
        var scaleX = 1, scaleY = 1;
        if (event.type === "click") {
            if (!event.shiftKey) {
                scaleX = -1; // 水平翻轉
            }
            else {
                scaleY = -1; // 垂直翻轉
            }
        }
        else {
            scaleX = -1; // 預設水平翻轉
        }
        
        // 調用 smoothZoom flip 方法進行 bitmap 翻轉顯示
        $("#detail-container").smoothZoom('flip', scaleX, scaleY);

        // 處理檔案寫入功能，根據設定決定是否寫入
        var shouldWriteToFile = writeToFile && $rootScope.preferences.habits.imageRotateMode === 'write';
        if (shouldWriteToFile && rotatedImage) {
            // 根據 scaleX 和 scaleY 決定翻轉類型
            var flipType;
            if (scaleX === -1 && scaleY === -1) {
                flipType = 'both';
            } else if (scaleX === -1) {
                flipType = 'horizontal';
            } else if (scaleY === -1) {
                flipType = 'vertical';
            }

            // 使用正確的方式獲取檔案路徑
            var rawPath = FileUrlHelper.getRawPath(rotatedImage);
            if (!rawPath) {
                console.warn('Cannot get raw path for image:', rotatedImage);
                return;
            }

            // 載入 flipImage 工具模組並執行翻轉
            try {
                const flipImageUtil = require(appRoot.path + '/app/js/utils/flipImage.js');
                flipImageUtil(rawPath, flipType)
                    .then(() => {
                        console.log(`Image flipped (${flipType}) and saved: ${rawPath}`);
                        // 重新生成縮圖
                        ipcRenderer.send('regenerate-thumbnail', [rotatedImage]);
                    })
                    .catch(err => {
                        console.error(`Failed to save flipped image: ${err.message}`);
                    });
            } catch (requireErr) {
                console.error(`Failed to load flipImage module: ${requireErr.message}`);
            }
        }
    };

    $scope.flipVideo = function (event) {
        var video = $(".detail-wrap video")[0];
        if (video) {
            var $video = $(video);
            var flip = $video.data("flip") || 1;
            flip = flip * -1;
            if (flip === 1) {
                $video.removeClass("flip");
            }
            else {
                $video.addClass("flip");
            }
            $video.data("flip", flip);
        }
    };

    $scope.zoomActual = function(event) {
        event && event.preventDefault && event.preventDefault();
        $scope.imageSize.zoomRatio = 100;
        $scope.updateZoomRatio(100, undefined, undefined, true);
    };

    $scope.zoomFit = function(event) {
        event && event.preventDefault && event.preventDefault();
        $scope.imageSize.zoomRatio = 100;
        $scope.zoomFitSize = 0;

        $("#detail-container").addClass("zooming");
        setTimeout(function () {
            $("#detail-container").removeClass("zooming");
        }, 300);

        $scope.smartZoom();
        $scope.imageSize.modified = false;
    };

    $scope.isHideNavigator = true;
    if (localStorage.getItem("isHideNavigator_Viewer") == 'false') {
        $scope.isHideNavigator = false;
    }

    $scope.lastZoomMode = localStorage["eagle.viewer.lastZoomMode"] || "fit";
    $scope.toggleZoom = function (event) {
        if (!$scope.isDetailMode) return;
        if ($scope.lastZoomMode !== "edge") {
            $scope.zoomFitEdge(event, true);
            $scope.lastZoomMode = "edge";
        }
        else {
            $scope.zoomFit(event);
            $scope.lastZoomMode = "fit";
        }
    }

    $scope.zoomFitSize = 0;
    $scope.zoomFitEdge = function(event, hasTransition) {
        event && event.preventDefault && event.preventDefault();

        if (hasTransition) {
            $("#detail-container").addClass("zooming");
            setTimeout(function () {
                $("#detail-container").removeClass("zooming");
            }, 300);
        }

        var windowHeight = $(window).height();
        var windowWidth = $(window).width();
        var windowSize = Math.min(windowHeight, windowWidth);
        var ratio = $scope.imageSize.zoomRatio || 100;
        var containerWidth = $(".smooth_zoom_preloader").width();
        var containerHeight = $(".smooth_zoom_preloader").height();
        var offsetY = 0;
        var pageX = $(window).width() / 2;
        var pageY = $(window).height() / 2;

        if (!$scope.current) return;

        var a = Math.ceil((containerHeight) / $scope.current.height * 100);
        var b = Math.ceil((containerWidth) / $scope.current.width * 100);
        ratio = Math.min(a, b);

        var width = $("#detail-container").width();
        var height = $scope.current && $scope.current.height || $("#detail-container").height();

        offsetY = offsetY || 0;

        if (ratio) {
            if (ratio === 99 || ratio === 101) ratio = 100;
            $scope.imageSize.zoomRatio = parseInt(ratio);
            $scope.zoomFitSize = $scope.imageSize.zoomRatio;
        }

        $("#detail-container").smoothZoom('focusTo', {
            x: width / 2,
            y: height / 2 + offsetY,
            zoom: $scope.imageSize.zoomRatio,
            speed: 0,
            pageX: pageX,
            pageY: pageY
        });

    };

    $scope.toggleRatioContextMenu = function() {
        if ($scope.imageSize.zoomRatio != 100) {
            $scope.zoomActual();
        } else {
            $scope.zoom();
        }
    };

    var copyImageTimeout;
    $scope.copyImage = function (event) {
        event && event.preventDefault && event.preventDefault();
        ipcRenderer.send('copy-images', [$scope.current]);
        $scope.showCopyToast = true;
        $timeout.cancel(copyImageTimeout);
        copyImageTimeout = $timeout(function () {
            $scope.showCopyToast = false;
        }, 1000)
    };

    $scope.zoomIn = function(event) {
        event && event.preventDefault && event.preventDefault();
        var ratio = parseInt($scope.imageSize.zoomRatio);
        if (ratio >= 400) { ratio = 800; } else if (ratio >= 200) { ratio = 400; } else if (ratio >= 100) { ratio = 200; } else if (ratio >= 50) { ratio = 100; } else if (ratio >= 25) { ratio = 50; } else if (ratio >= 10) { ratio = 25; } else { ratio = 10; }
        if (ratio > 800) ratio = 800;
        $scope.imageSize.zoomRatio = ratio;
        $scope.updateZoomRatio(undefined, undefined, undefined, true);
    };

    $scope.zoomOut = function(event) {
        event && event.preventDefault && event.preventDefault();
        var ratio = parseInt($scope.imageSize.zoomRatio);
        if (ratio <= 10) { ratio = 5; } else if (ratio <= 25) { ratio = 10; } else if (ratio <= 50) { ratio = 25; } else if (ratio <= 100) { ratio = 50; } else if (ratio <= 200) { ratio = 100; } else if (ratio <= 400) { ratio = 200; } else if (ratio <= 800) { ratio = 400; }
        $scope.imageSize.zoomRatio = ratio;
        $scope.updateZoomRatio(undefined, undefined, undefined, true);
    };

    $scope.toggleGrayscale = function (event) {
        event && event.preventDefault && event.preventDefault();
        $scope.isGrayscaleMode = !$scope.isGrayscaleMode;
    }

    $scope.spaceHandler = function (event) {
        if ($scope.current.ext == 'gif') {
            $scope.toggleGifPlay();    
        }
        else if ($scope.isDetailMode && !$scope.isInlineMode && (VIDEO_TYPES[$scope.current.ext] )) {
            $scope.toggleVideoPlay();
        }
    };

    $scope.toggleVideoPlay = function() {
        var video = $(".detail-wrap video")[0];
        if (!video.paused) { video.pause(); } else { video.play(); }
    };

    $scope.toggleGifPlay = function() {
        if ($scope.gifPlayer && $scope.isGifReady) {
            if ($scope.gifViewer.playing) {
                $scope.gifPlayer.pause();
                $scope.gifViewer.playing = false;
                $scope.$evalAsync();
            }
            else {
                $scope.gifPlayer.play();
                $scope.gifViewer.playing = true;
                $scope.$evalAsync();
            }
            $(".gif-viewer").css("opacity", 0.8);
            setTimeout(function () {
                $(".gif-viewer").css("opacity", 1);
            }, 100);
        }
    };

    $scope.nextGifFrame = function(amount = 1) {
        if ($scope.gifPlayer && $scope.isGifReady) {
            $scope.gifPlayer.pause();
            $scope.gifViewer.playing = false;
            var curr = $scope.gifPlayer.get_current_frame();
            var total = $scope.gifViewer.frames.length;
            var idx = curr + amount;
            if (idx > total) idx = total - 1;
            $scope.gifPlayer.move_to(idx);
            $scope.$evalAsync();
        }
    };

    $scope.prevGifFrame = function(amount = 1) {
        if ($scope.gifPlayer && $scope.isGifReady) {
            $scope.gifPlayer.pause();
            $scope.gifViewer.playing = false;
            var curr = $scope.gifPlayer.get_current_frame();
            var idx = curr - amount;
            if (idx < 0) idx = 0;
            $scope.gifPlayer.move_to(idx);
            $scope.$evalAsync();
        }
    };

    $scope.homeHandler = function(event) {
        $("#detail-container").smoothZoom('goToY', 40);
    };

    $scope.endHandler = function(event) {
        $("#detail-container").smoothZoom('goToY', -99999999);
        $("#detail-container").smoothZoom('moveY', -window.outerHeight + 60);
    };


    $scope.upHandler = function () {
        $("#detail-container").smoothZoom('moveY', -100);
    };

    $scope.downHandler = function () {
        $("#detail-container").smoothZoom('moveY', 100);
    };

    var selectTimeout;
    $scope.selectNext = function(event) {
        event && event.preventDefault && event.preventDefault();
        if ($scope.images.length <= 1) {
            return;
        }
        $scope.imageSize.modified = false;
        var index = $scope.currentIndex() - 1;
        if ($scope.images[index + 1]) {
            $scope.current = $scope.images[index + 1];
        }
        else {
            return;
        }
        $("#detail-container").smoothZoom('updateNavigator', $scope.current);
        $scope.zoom();
    };

    $scope.selectPrev = function(event) {
        event && event.preventDefault && event.preventDefault();
        if ($scope.images.length <= 1) {
            // $("#detail-container").smoothZoom('moveX', -100);
            return;
        }
        $scope.imageSize.modified = false;
        var index = $scope.currentIndex() - 1;
        if ($scope.images[index - 1]) {
            $scope.current = $scope.images[index - 1];
        }
        else {
            return;
        }
        $("#detail-container").smoothZoom('updateNavigator', $scope.current);
        $scope.zoom();
    };

    $scope.toggleAlwaysOnTop = function () {
        $scope.isAlwaysOnTop = !$scope.isAlwaysOnTop;
        if ($scope.isAlwaysOnTop) {
            currentWindow.setAlwaysOnTop(true, "pop-up-menu");
        }
        else {
            currentWindow.setAlwaysOnTop(false);
        }
    };

    $scope.zoom = function () {
        if ($scope.lastZoomMode === "edge") {
            $scope.zoomFitEdge();
        }
        else {
            $scope.smartZoom();
        }
    }

    // 計算出與當前屏幕尺寸最適合的呈現方式
    var detailImageTimeout;
    $scope.smartZoom = function() {

        var windowHeight = $(window).height();
        var windowWidth = $(window).width();
        var windowSize = Math.min(windowHeight, windowWidth);
        var ratio = $scope.imageSize.zoomRatio || 100;
        var containerWidth = $(".smooth_zoom_preloader").width();
        var containerHeight = $(".smooth_zoom_preloader").height();
        var offsetY = 0;
        var pageX = $(window).width() / 2;
        var pageY = $(window).height() / 2;

        if (!$scope.current) return;

        // 不使用智能縮放
        if ($rootScope.preferences.habits.defaultRatio != "auto") {
            ratio = 100;
        }
        // 使用智能縮放
        else {
            if (isMobileResolution($scope.current.width, $scope.current.height) && windowSize > Math.min($scope.current.width,$scope.current.height)) {
                // console.log("smart phone")
                ratio = 100 * isMobileResolution($scope.current.width, $scope.current.height) / $scope.current.height;
            }
            else if (
                ($scope.current.width >= 960 && $scope.current.width * 1.8 < $scope.current.height) ||
                ($scope.current.width >= 320 && $scope.current.width * 2.7 < $scope.current.height)
            ) {
                ratio = parseInt((containerWidth) / $scope.current.width * 100);
                if (ratio > 100) {
                    ratio = 100;
                }
                if ($scope.current.height > $(".smooth_zoom_preloader").height()) {
                    offsetY = ($scope.current.height - $(".smooth_zoom_preloader").height() * 100 / ratio) / -2;
                    // offsetY -= 60 * 100 / ratio;
                }
            } else {
                if ($scope.current.height > containerHeight || $scope.current.width > containerWidth) {
                    var a = Math.ceil((containerHeight) / $scope.current.height * 100);
                    var b = Math.ceil((containerWidth) / $scope.current.width * 100);
                    ratio = Math.min(a, b);
                } else {
                    ratio = 100;
                }
            }

        }

        var width = $("#detail-container").width();
        var height = $scope.current && $scope.current.height || $("#detail-container").height();

        offsetY = offsetY || 0;

        if (ratio) {
            if (ratio === 99 || ratio === 101) ratio = 100;
            $scope.imageSize.zoomRatio = parseInt(ratio);
        }

        $("#detail-container").smoothZoom('focusTo', {
            x: width / 2,
            y: height / 2 + offsetY,
            zoom: $scope.imageSize.zoomRatio,
            speed: 0,
            pageX: pageX,
            pageY: pageY
        });
    };

    function isMobileResolution(w, h) {
        if (w === h) return false;
        for (var i = 0; i < devicesMetrics.length; i++) {

            var size = devicesMetrics[i];
            var remainderW = w % size.w;
            var remainderH = h % size.h;
            var multipleW = w / size.w;
            var multipleH = h / size.h;

            if (remainderW == 0 && remainderH == 0 && multipleW === multipleH) {
                if (w / size.w <= 3) {
                    return size.h;
                }
            }
        }
        return false;
    }

    console.log($scope.imageId);

    // GIF Viewer
        $scope.gifPlayer;
        $scope.gifUpadteInterval;

        $scope.gifViewer = {
            frames: [],
            mousedownTime: 0,
            mousedownX: 0,
            mousedownY: 0,
            range: undefined,
            speed: 1,
            setThumbnail: function () {
                if (!$scope.isGifReady) return;
                var curr = $scope.gifPlayer.get_current_frame();
                var f = $scope.gifPlayer.get_frame(curr);
                if (!f) return;
                var b64 = f.base64;
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');
                var image = new Image();
                image.onload = function() {
                    canvas.width = image.width;
                    canvas.height = image.height;
                    ctx.drawImage(image, 0, 0);

                    var ratio = 1;
                    if (canvas.height > canvas.width) {
                        if (canvas.width > 480) {
                            ratio = 480 / canvas.width;
                        }
                        else {
                            ratio = 1;
                        }
                    }
                    else {
                        if (canvas.height > 480) {
                            ratio = 480 / canvas.height;
                        }
                        else {
                            ratio = 1;
                        }
                    }
                    if (ratio !== 1) { canvasResizeTo(canvas, ratio); }

                    var base64string = canvas.toDataURL();
                    ipcRenderer.send('regenerate-gif-thumbnail', {
                        gif: $scope.current,
                        base64string: base64string
                    });
                };
                image.src = f.base64;
            },
            setSpeed: function (speed = 1) {
                $scope.gifViewer.speed = speed;
                $scope.$evalAsync();
                $scope.gifPlayer.set_speed(speed);
                $(".gif-toolbar-btn.speed span").text(`${speed}x`);
            },
            mousedown: function (event) {
                if (event.button !== 0) return;
                $scope.gifViewer.mousedownX = event.clientX;
                $scope.gifViewer.mousedownY = event.clientY;
                $scope.gifViewer.mousedownTime = Date.now();
            },
            mouseup: function (event) {
                if (event.button !== 0) return;
                // 判断是点击或是拖拽
                if (Date.now() - $scope.gifViewer.mousedownTime < 333 && Math.abs($scope.gifViewer.mousedownX - event.clientX) < 5 && Math.abs($scope.gifViewer.mousedownY - event.clientY) < 5)  {
                    $scope.toggleGifPlay();
                    $scope.$evalAsync();
                }
            },
            cancelRange: function () {
                if ($scope.gifViewer.range !== undefined) {
                    $scope.gifViewer.range = undefined;
                    var $resizableBar = $(".gif-toolbar .resize-bar");
                    $resizableBar.css({
                        left: "0%",
                        width: "100%"
                    });
                    if ($scope.gifPlayer) {
                        $scope.gifPlayer.move_to(0);
                    }
                }
            },
            nextFrame: function () {
                var curr = $scope.gifPlayer.get_current_frame();
                var index = curr + 1;
                if (index + 1 > $scope.gifViewer.frames.length - 1) index = $scope.gifViewer.frames.length - 1;
                $scope.gifViewer.setFrame(index);
                $scope.gifPlayer.pause();
            },
            prevFrame: function () {
                var curr = $scope.gifPlayer.get_current_frame();
                var index = curr - 1;
                if (index - 1 < 0) index = 0;
                $scope.gifViewer.setFrame(index);
                $scope.gifPlayer.pause();
            },
            setFrame: function (index) {
                $scope.gifPlayer.move_to(index);
            },
            onProgress: function (progress, length) {
                clearInterval($scope.gifUpadteInterval);
                if ($scope.isGifReady === true) {
                    $scope.isGifReady = false;
                    $scope.gifViewer.frames = [];
                    $scope.gifViewer.mousedownTime = 0;
                    $scope.gifViewer.mousedownX = 0;
                    $scope.gifViewer.mousedownY = 0;
                    $scope.gifViewer.range = undefined;
                    $scope.gifPlayer = undefined;
                    $scope.$evalAsync();
                }
                updateGifProgressbar(progress);
                $(".gif-toolbar .message span").text(`${parseInt(progress * 100)}%`)
            },
            onFinished: function (result) {
                $scope.gifViewer.range = undefined;
                $scope.gifPlayer = result.gifPlayer;
                $scope.isGifReady = true;
                $scope.gifViewer.frames = result.frames;
                $scope.gifViewer.playing = result.playing;
                $scope.gifViewer.setSpeed(1);
                $scope.$evalAsync();
                var $resizableBar = $(".gif-toolbar .resize-bar");
                $(".gif-toolbar .total-frame").text(`/ ${$scope.gifViewer.frames.length}`);

                if ($resizableBar.is('.ui-resizable')) {
                    $resizableBar.resizable( "destroy" );
                }

                $resizableBar.css({
                    left: 0,
                    width: 'auto'
                });

                $(".gif-toolbar.in").removeClass("in");
                setTimeout(function () {
                    $(".gif-toolbar").addClass("in");
                }, 100);

                var gifPlayerResizeOriginalState = false;
                var gifPlayerResizing = false;
                var gifPlayerLastResizeLeft;
                var gifPlayerLastResizeWidth;
                $resizableBar.resizable({
                    handles: "e, w",
                    containment: ".gif-toolbar .progress-bar",
                    start: function (event, ui) {
                        gifPlayerLastResizeLeft = parseInt(ui.element.css("left"));
                        gifPlayerLastResizeWidth = ui.element.width();
                        gifPlayerResizeOriginalState = $scope.gifPlayer.get_playing();
                        $scope.gifPlayer.pause();
                    },
                    resize: function (event, ui) {
                        $("#gif-progress-indicator").hide();
                        gifPlayerResizing = true;
                    },
                    stop: function (event, ui) {
                        gifPlayerResizing = false;
                        var frames = $scope.gifViewer.frames;
                        var parentWidth = $(".gif-toolbar .progress-bar").width();
                        var left = parseInt(ui.element.css("left"));
                        var width = ui.element.width();
                        var leftP = left / parentWidth * 100;
                        var widthP = width / parentWidth * 100;;
                        $resizableBar.css({
                            left: `${leftP}%`,
                            width: `${widthP}%`
                        });

                        // 移動 start
                        // var index = parseInt($(".gif-toolbar .current-frame").text()) - 1;
                        var index = $scope.gifPlayer.get_current_frame();
                        if (index < 0) index = 0;
                        if (gifPlayerLastResizeLeft !== left) {
                            if ($scope.gifViewer.range === undefined) {
                                $scope.gifViewer.range = [index, $scope.gifViewer.frames.length];
                            }
                            else {
                                $scope.gifViewer.range = [index, $scope.gifViewer.range[1]];
                            }
                        }
                        // 移動 end
                        else if (gifPlayerLastResizeWidth !== width) {
                            if ($scope.gifViewer.range === undefined) {
                                $scope.gifViewer.range = [0, index + 1];
                            }
                            else {
                                $scope.gifViewer.range = [$scope.gifViewer.range[0], index + 1];
                            }
                        }

                        if ($scope.gifViewer.range[0] > $scope.gifViewer.range[1]) {
                            $scope.gifViewer.range = [$scope.gifViewer.range[1], $scope.gifViewer.range[0]];
                        }
                        console.log($scope.gifViewer.range);

                        $("#gif-progress-indicator").show();
                        if (gifPlayerResizeOriginalState) {
                            $scope.gifPlayer.play();
                        }
                    }
                });


                $scope.gifUpadteInterval = setInterval(function () {
                    try {
                        var c = $scope.gifPlayer.get_current_frame();
                        var length = $scope.gifPlayer.get_length();

                        if ($scope.gifViewer.range && !gifPlayerResizing && !gifPlayerProgressDown) {
                            var start = $scope.gifViewer.range[0];
                            var end = $scope.gifViewer.range[1];
                            if (c <= start) { 
                                c = start; 
                                $scope.gifPlayer.move_to(c);
                            }
                            if (c >= end) { 
                                c = start; 
                                $scope.gifPlayer.move_to(c);
                            }
                        }

                        var text = paddingNumber(c + 1, `${length}`.length);
                        if ($(".gif-toolbar .current-frame").text() !== text) {
                            $(".gif-toolbar .current-frame").text(text);
                        }
                        updateGifIndicator(c + 1);
                    }
                    catch (err) {}
                }, 50);
            }
        };

        var updateGifIndicator = function (index) {
            var percent = (index - 1) / ($scope.gifViewer.frames.length - 1) * 100;
            if (percent < 0) percent = 0;
            var value = `${ percent }%`;
            if ($("#gif-progress-indicator").css('left') !== value) {
                $("#gif-progress-indicator").css('left', value);
            }
        };
        
        var updateGifProgressbar = function (progress) {
            $(".gif-toolbar .progress-bar .current").css('width', `${ progress * 100 }%`);
        };

        var gifPlayerProgressDown = false;
        var gifPlayerOriginalState = false;
        $("body").on('mousedown', ".gif-toolbar .progress-bar", function (event) {
            if (event.button === 0) {
                gifPlayerProgressDown = true;
                gifPlayerOriginalState = $scope.gifPlayer.get_playing();
                $("#thumbnail-preview").hide();

                if ($scope.isGifReady) {
                    var width = $(this).width();
                    var currentPosX = event.offsetX;
                    var index = Math.round(currentPosX / width * $scope.gifViewer.frames.length) + 1;
                    if (!index) return;
                    if (index -1  >= $scope.gifViewer.frames.length) index = $scope.gifViewer.frames.length;
                    if ($scope.gifViewer.range !== undefined) {
                        if (index -1 > $scope.gifViewer.range[1] || index -1 < $scope.gifViewer.range[0]) {
                            return;
                        }
                    }
                    $("#gif-progress-indicator").css('left', `${ (index - 1) / ($scope.gifViewer.frames.length - 1) * 100 }%`);
                    $scope.gifPlayer.move_to(index - 1);
                    $scope.gifPlayer.pause();
                }
            }
        });

        $("body").on('mouseup', ".gif-toolbar", function (event) {
            if (event.button === 0) {
                gifPlayerProgressDown = false;
                if (gifPlayerOriginalState) {
                    $scope.gifPlayer.play();
                }
            }
            else if (event.button === 2) {
                $scope.openGifContextMenu(event);
                // $scope.gifViewer.cancelRange();
            }
            $(".gif-toolbar .progress-bar .ui-resizable-handle").css("pointer-events", "");
        });

        $("body").on('mouseleave', ".gif-toolbar .progress-bar", function (event) {
            if (!gifPlayerProgressDown) {
                $("#thumbnail-preview").hide();
            }
        });

        $("body").on('mousemove', ".gif-toolbar .progress-bar .ui-resizable-handle", function (event) {
            event.stopPropagation();
        });

        $("body").on('mousemove', ".gif-toolbar .progress-bar", function (event) {
            if (event.button === 0) {
                var currentPosX = event.offsetX;

                // 显示缩略图
                if ($scope.isGifReady) {
                    var width = $(this).width();
                    var index = Math.round(currentPosX / width * $scope.gifViewer.frames.length) + 1;
                    // if (!index) return;
                    if (index -1  >= $scope.gifViewer.frames.length) index = $scope.gifViewer.frames.length;
                    if (!gifPlayerProgressDown) {
                        var img = $("#thumbnail-preview img")[0];
                        var f = $scope.gifPlayer.get_frame(index - 1);
                        if (!f) return;
                        img.src = f.base64;

                        var w = $("#thumbnail-preview img").width();
                        var left = currentPosX - w / 2;
                        if (left < 0) left = 0;
                        if (left > width - w) left = width - w;

                        $("#thumbnail-preview").css({
                            transform: `translateX(${left}px)`
                        });

                        $("#thumbnail-preview .current-index").text(`${index}`);
                        $("#thumbnail-preview").show();
                    }
                    else {
                        $(".gif-toolbar .progress-bar .ui-resizable-handle").css("pointer-events", "none");
                        $("#gif-progress-indicator").css('left', `${ (index - 1) / ($scope.gifViewer.frames.length - 1) * 100 }%`);
                        $scope.gifPlayer.move_to(index - 1);
                        $scope.gifPlayer.pause();
                    }
                }
            }
        });

        $scope.toggleGifPlay = function() {
            if ($scope.gifPlayer && $scope.isGifReady) {
                if ($scope.gifViewer.playing) {
                    $scope.gifPlayer.pause();
                    $scope.gifViewer.playing = false;
                    $scope.$evalAsync();
                }
                else {
                    $scope.gifPlayer.play();
                    $scope.gifViewer.playing = true;
                    $scope.$evalAsync();
                }
                $(".gif-viewer").css("opacity", 0.8);
                setTimeout(function () {
                    $(".gif-viewer").css("opacity", 1);
                }, 100);
            }
        };

        // End GIF Viewer

    // 動態建立 mousetrap 綁定
    function buildMousetrapBindings() {
        const bindings = {};
        
        // 建立快捷鍵名稱到處理函數的映射
        const shortcutHandlerMap = {
            'player.playAndPause': () => {
                if ($scope.isDetailMode && !$scope.isInlineMode && ($scope.current.ext == 'gif')) {
                    $scope.toggleGifPlay();
                }
            },
            'player.prev1frame': $scope.prevFrameHandler,
            'player.next1frame': $scope.nextFrameHandler,
            'player.prev10frame': $scope.prevFrameHandler,
            'player.next10frame': $scope.nextFrameHandler,

            'player.thumbnail.copy': () => {
                $scope.videoScreenShot(true);
            },
            'player.thumbnail.save': () => {
                $scope.videoScreenShot();
            },
            'edit.copy.path': $scope.copyAsPath,
            // 'player.step.forward': $scope.stepForward,
            // 'player.step.backward': $scope.stepBackward,
            'view.file.openfinder': $scope.openWithFinder,
            'view.file.opendefault': $scope.openWithDefault,
            'edit.image.rotate': $scope.rotateHandler,
            'edit.image.flip': $scope.flipHandler,
            'edit.image.crop': $scope.copeVideoFrame,
            'view.zoom.actual': $scope.zoomActual,
            'view.zoom.fit': $scope.zoomFit,
            'view.zoom.in': $scope.zoomIn,
            'view.zoom.out': $scope.zoomOut,
            'view.grayscale': $scope.toggleGrayscale,
            'view.scroll.home': $scope.homeHandler,
            'view.scroll.end': $scope.endHandler,
            'view.alwaysOnTop': $scope.toggleAlwaysOnTop,
        };
        
        // 檢查 ShortcutManager 是否可用
        if (!window.ShortcutManager || !window.ShortcutManager.electronToMousetrap) {
            console.warn('[Preview] ShortcutManager not available, using hardcoded shortcuts only');
        }
        
        // 從 preferences 載入快捷鍵
        if (preferences && preferences.shortcuts && preferences.shortcuts.keybinds && window.ShortcutManager) {
            for (const [keyName, electronKey] of Object.entries(preferences.shortcuts.keybinds)) {
                if (shortcutHandlerMap[keyName] && electronKey) {
                    const mousetrapKey = window.ShortcutManager.electronToMousetrap(electronKey);
                    if (mousetrapKey) {
                        bindings[mousetrapKey] = shortcutHandlerMap[keyName];
                        console.log(`[Preview] Mapped ${keyName}: ${electronKey} -> ${mousetrapKey}`);
                    }
                }
            }
        }
        
        // 添加硬編碼的快捷鍵（未在 preferences 中定義或沒有對應設定的）
        const hardcodedShortcuts = {
            'esc': $scope.close,
            'mod+c': $scope.copyImage,
            'right': $scope.selectNext,
            'left': $scope.selectPrev,
            'm': $scope.mHandler,
            'a': $scope.selectPrev,
            'd': $scope.selectNext,
            'w': $scope.upHandler,
            's': $scope.downHandler,
            'up': $scope.upHandler,
            'down': $scope.downHandler,
            'shift+s': $scope.saveVideoFrame,
            'mod+8': $scope.zoomFitEdge,
            '`': $scope.toggleZoom,
            '=': $scope.zoomIn,
            '+': $scope.zoomIn,
            '-': $scope.zoomOut,
            'space': $scope.spaceHandler,
            't': $scope.toggleAlwaysOnTop
        };
        
        // 合併硬編碼快捷鍵（如果沒有被 preferences 覆蓋）
        for (const [key, handler] of Object.entries(hardcodedShortcuts)) {
            if (!bindings[key]) {
                bindings[key] = handler;
            }
        }
        
        // 處理 'mod+plus' 的特殊情況（確保 + 號的快捷鍵都能正常工作）
        if (bindings['mod+='] && !bindings['mod+plus']) {
            bindings['mod+plus'] = bindings['mod+='];
        }
        
        console.log('[Preview] Total mousetrap bindings:', Object.keys(bindings).length);
        return bindings;
    }

    // 使用動態建立的快捷鍵綁定
    $scope.mousetrap = buildMousetrapBindings();

});

EagleApp.directive('tgaImg', function ($rootScope) {
    return {
        restrict: 'A',
        scope: {
            tgaImg: "=tgaImg"
        },
        link: function (scope, element, attrs, ngModel) {

            function tagCanNotRead (imageData) {
                if (!imageData) {
                    return false;
                }
                else {
                    var isSame = imageData.every( (val, i, arr) => val === arr[0] );
                    return isSame;
                }
            };

            var $parent = $(element[0].parentNode);

            scope.$watch("tgaImg", loadTga);

            function loadTga(newValue, oldValue) {
                if (!newValue) return;
                if ($parent.find("canvas").length > 0) {
                    element.css("opacity", 0);
                    element.css("position", "absolute");
                    element.css("z-index", "9999");
                    $parent.find("canvas").remove();
                }
                console.time("tga");
                var filePath = scope.tgaImg;
                var filePath2 = FileUrlHelper.getRawPath($bodyScope.current);
                try {
                    var TgaLoader = require(appRoot.path + "/app/js/vendors/tga.js");
                    var tga = new TgaLoader();
                    var buffer = fs.readFileSync(filePath2);
                    tga.load(buffer);
                    var canvas = tga.getCanvas();
                    var base64 = canvas.toDataURL('image/png');
                    var buffer = decodeBase64Image(base64).data;
                    if (buffer.length <= 5000) {
                        throw new Error("");
                        return;
                    }
                    $parent.append(canvas);
                    element.css("opacity", 0);
                    element.css("position", "absolute");
                    element.css("z-index", "9999");
                    console.timeEnd("tga");
                } catch (err) {
                    var libtga = require(appRoot.path + "/app/js/vendors/libtga.js")
                    libtga.loadFile(filePath, function (err, img) {
                        if (!err && img && !tagCanNotRead(img.imageData)) {
                            var canvas = document.createElement('canvas');
                            var context = canvas.getContext('2d');
                            var imageData = context.createImageData(img.width, img.height);
                            canvas.height = img.height;
                            canvas.width = img.width;
                            imageData.data.set(img.imageData);
                            context.putImageData(imageData, 0, 0);

                            $parent.append(canvas);
                            element.css("opacity", 0);
                            element.css("position", "absolute");
                            element.css("z-index", "9999");
                            console.timeEnd("tga");
                        }
                    });
                }
            }
        }
    }
});

EagleApp.filter('encodeHash', function($window) {
    return function(url) {
        if (url) return url.replace(/#/g, '%23');
        return url;
    }
});

EagleApp.directive('ngRightClick', function($parse) {
    return function(scope, element, attrs) {
        var fn = $parse(attrs.ngRightClick);
        scope.$on('$destroy', function() {
            element.off();
        });
        element.bind('contextmenu', function(event) {
            scope.$apply(function() {
                event && event.preventDefault();
                fn(scope, { $event: event });
            });
        });
    };
});

EagleApp.directive('toolbarBtnPin', function () {
    return {
        restrict: 'E',
        template:`
            <div style="-webkit-app-region: no-drag;" class="ic-btn" tippy tippy-placement="bottom" tippy-content="{{'titlebar.alwayTop.off' | i18n}}<key>Shift</key><key>T</key>" ng-click="toggleAlwaysOnTop()" ng-show="isAlwaysOnTop">
                <img ng-src="assets/images/{{theme | themePath}}/icons/ic-toolbar-unpin.svg">
            </div>
        `,
        replace: true
    }
});

EagleApp.directive('toolbarBtnUnpin', function () {
    return {
        restrict: 'E',
        template:`
            <div style="-webkit-app-region: no-drag;" class="ic-btn" tippy tippy-placement="bottom" tippy-content="{{'titlebar.alwayTop.on' | i18n}}<key>Shift</key><key>T</key>" ng-click="toggleAlwaysOnTop()" ng-show="!isAlwaysOnTop">
                <img ng-src="assets/images/{{theme | themePath}}/icons/ic-toolbar-pin.svg">
            </div>
        `,
        replace: true
    }
});

EagleApp.directive('toolbarBtnClose', function () {
    return {
        restrict: 'E',
        template:`
        <div style="
            display: flex;
            align-items: center;
            justify-content: center;
        ">
            <div ng-if="platform === 'win32'" style="-webkit-app-region: no-drag;" class="ic-btn" ng-click="minimize()">
                <img ng-src="assets/images/{{theme | themePath}}/icons/ic-windows-hide.svg">
            </div>
            <div ng-if="platform === 'win32' && !isMaximize" style="-webkit-app-region: no-drag;" class="ic-btn" ng-click="maximize()">
                <img ng-src="assets/images/{{theme | themePath}}/icons/ic-windows-fullscreen.svg">
            </div>
            <div ng-if="platform === 'win32' && isMaximize" style="-webkit-app-region: no-drag;" class="ic-btn" ng-click="restore()">
                <img ng-src="assets/images/{{theme | themePath}}/icons/ic-windows-restore.svg">
            </div>
            <div style="-webkit-app-region: no-drag;" class="ic-btn" ng-click="close()">
                <img ng-src="assets/images/{{theme | themePath}}/icons/ic-toolbar-close.svg">
            </div>
        </div>
        `,
        replace: true
    }
});

EagleApp.directive('toolbarBtnZoomFit', function () {
    return {
        restrict: 'E',
        template:`
            <div ng-class="{'active': lastZoomMode === 'edge'}" style="-webkit-app-region: no-drag;" class="ic-btn" tippy tippy-placement="bottom" tippy-content="{{'toolbar.zoomFitPage' | i18n}}<key>\`</key>" ng-click="toggleZoom($event)">
                <img ng-src="assets/images/{{theme|themePath}}/icons/ic-toolbar-zoom-fit.svg">
            </div>
        `,
        replace: true
    }
});

EagleApp.directive('toolbarBtnFrameByFrame', function () {
    return {
        restrict: 'E',
        template:`
            <div ng-class="{'active': usingGifPlayer}" style="-webkit-app-region: no-drag;" class="ic-btn" tippy tippy-placement="bottom" tippy-content="{{'gifViewer.enableBtn' | i18n}}" ng-click="toggleGifPlayerMode($event)">
                <img ng-src="assets/images/{{theme|themePath}}/icons/ic-toolbar-gif-frames.svg">
            </div>
        `,
        replace: true
    }
});

EagleApp.directive('toolbarBtnZoomActual', function () {
    return {
        restrict: 'E',
        template:`
            <div style="-webkit-app-region: no-drag;" class="ic-btn" tippy tippy-placement="bottom" tippy-content="{{'toolbar.zoomActualBtn' | i18n}}{{ '<key>Command</key><key>0</key>' | shortcuts }}" ng-click="zoomActual($event)">
                <img ng-src="assets/images/{{theme|themePath}}/icons/ic-toolbar-zoom-actual.svg">
            </div>
        `,
        replace: true
    }
});

EagleApp.directive('navigator', function () {
    return {
        restrict: 'E',
        template:`
            <div class="navigator">
                <div style="-webkit-app-region: no-drag;" ng-class="{'disabled': currentIndex() === 1}" class="ic-btn prev" ng-click="selectPrev($event)">
                    <img ng-src="assets/images/{{theme|themePath}}/icons/ic-toolbar-prev.svg">
                </div>
                <div style="-webkit-app-region: no-drag;" ng-class="{'disabled': currentIndex() === images.length}" class="ic-btn next" ng-click="selectNext($event)">
                    <img ng-src="assets/images/{{theme|themePath}}/icons/ic-toolbar-next.svg">
                </div>
            </div>
            <div class="separator"></div>
        `
    }
});