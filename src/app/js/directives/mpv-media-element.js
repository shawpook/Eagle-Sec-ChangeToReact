angular.module("mpvMediaElement",[]).directive('mpvMediaElement', function ($rootScope) {

    // ===== MPV 播放器主題配色 - 對應 Eagle 主題系統 =====
    // 參考: app/style/components/_video-player.scss, app/style/base/_color.scss

    var darkBaseVariables = {
        'primary-color': '#f8f9fb',
        'primary-hover-color': '#f8f9fb',
        'tooltip-bg': 'rgba(0, 0, 0, 0.8)',
        'text-color': '#f8f9fb',
        'text-secondary-color': 'rgba(248, 249, 251, 0.7)',
        'progress-bg': 'rgba(248, 249, 251, 0.25)',
        'progress-buffered-color': 'rgba(248, 249, 251, 0.15)',
        'progress-played-color': 'rgba(248, 249, 251, 0.5)',
        'button-color': '#BDBEC0',
        'button-hover-color': '#f8f9fb',
        'button-active-color': '#f8f9fb',
        '--vp-button-hover-bg': 'rgba(248, 249, 251, 0.05)',
        '--vp-button-active-bg': 'rgba(248, 249, 251, 0.1)',
        'border-color': 'rgba(255, 255, 255, 0.08)',
        'shadow-color': 'rgba(0, 0, 0, 0.3)',
    };

    var lightBaseVariables = {
        'primary-color': '#2c2f32',
        'primary-hover-color': '#2c2f32',
        'tooltip-bg': 'rgba(0, 0, 0, 0.8)',
        'text-color': '#2c2f32',
        'text-secondary-color': 'rgba(44, 47, 50, 0.7)',
        'progress-bg': 'rgba(80, 85, 91, 0.25)',
        'progress-buffered-color': 'rgba(80, 85, 91, 0.15)',
        'progress-played-color': 'rgba(80, 85, 91, 0.75)',
        'button-color': '#50555B',
        'button-hover-color': '#2c2f32',
        'button-active-color': '#2c2f32',
        '--vp-button-hover-bg': 'rgba(44, 47, 50, 0.05)',
        '--vp-button-active-bg': 'rgba(44, 47, 50, 0.08)',
        'border-color': 'rgba(0, 0, 0, 0.1)',
        'shadow-color': 'rgba(0, 0, 0, 0.15)',
    };

    // 每個 Eagle 主題對應的 controls-bg 和基礎變數
    var eagleThemeConfig = {
        dark:      { bg: 'rgba(24, 25, 28, 0.95)',   base: darkBaseVariables },
        gray:      { bg: 'rgba(55, 56, 60, 0.95)',   base: darkBaseVariables },
        blue:      { bg: 'rgba(13, 22, 48, 0.95)',   base: darkBaseVariables },
        purple:    { bg: 'rgba(28, 20, 36, 0.95)',   base: darkBaseVariables },
        light:     { bg: 'rgba(255, 255, 255, 0.95)', base: lightBaseVariables },
        lightgray: { bg: 'rgba(227, 228, 230, 0.95)', base: lightBaseVariables },
    };

    function buildEagleTheme(themeName) {
        var config = eagleThemeConfig[themeName] || eagleThemeConfig.dark;
        var variables = Object.assign({}, config.base, {
            'controls-bg': config.bg,
            'menu-bg': config.bg,
        });
        return { name: 'eagle-' + themeName, variables: variables };
    }

    return {
        restrict: 'A',
        link: function (scope, element, attrs) {

            var video = element[0];
            var isInPreviewWindow = $("#preview-window").length > 0;
            var ipcRenderer = require('electron').ipcRenderer;
            var $bodyScope = angular.element("body").scope();

            // 從 localStorage 恢復音量
            var volume = localStorage.getItem("eagle.videoPlayer.volume") || 100;
            video.volume = parseInt(volume) / 100;

            // 確保 controls-mode 在初始化後正確套用
            if (video.controlsMode !== undefined) {
                video.controlsMode = attrs.controlsMode || 'always';
            }

            // ===== 主題同步 - 將 Eagle 主題套用到 mpv-video Shadow DOM =====
            function applyMpvTheme(theme) {
                try {
                    if (video.theme) {
                        video.theme.apply(buildEagleTheme(theme));
                    }
                }
                catch (err) {
                    console.error("[mpvMediaElement] Error applying theme:", err);
                }
            }

            // 初始套用主題
            applyMpvTheme($bodyScope.theme || 'dark');

            // 監聽主題變更
            var unwatchTheme = $bodyScope.$watch('theme', function (newTheme, oldTheme) {
                if (newTheme !== oldTheme) {
                    applyMpvTheme(newTheme);
                }
            });

            // ===== 監聽 current 變化 - 切換影片時重設為原生播放器 =====
            var unwatchCurrent = scope.$watch('current.id', function (newId, oldId) {
                if (newId !== oldId && oldId !== undefined) {
                    scope.$parent.useMpvPlayer = false;
                }
            });

            // ===== $destroy 清理 - 修復記憶體洩漏 =====
            scope.$on('$destroy', function () {
                console.log("[mpvMediaElement] $destroy");
                try {
                    // 取消監聽
                    if (unwatchTheme) unwatchTheme();
                    if (unwatchCurrent) unwatchCurrent();
                    if (unwatchComments) unwatchComments();

                    // 儲存播放位置
                    if (scope.current && video.currentTime) {
                        localStorage.setItem("eagle.videoPlayer.currentTime." + scope.current.id, video.currentTime);
                    }
                    element.off();
                    // 完整銷毀 MPV 原生資源（WebGL context、native controller、plugins 等）
                    video.destroy();

                    // Reset fallback flag so the next video tries native player first
                    if (scope.$parent) {
                        scope.$parent.useMpvPlayer = false;
                    }
                }
                catch (err) {
                    console.error("[mpvMediaElement] Error during destroy:", err);
                }
            });

            // ===== loadedmetadata 初始化偏好設定 =====
            video.addEventListener('loadedmetadata', function () {

                if (!$bodyScope.isDetailMode && !isInPreviewWindow) {
                    return;
                }

                // 讀取偏好設定
                var autoPlay = $rootScope.preferences.video.autoPlay != 'false';
                var rememberPosition = $rootScope.preferences.video.rememberPosition != 'false';
                var loopShortVideo = $rootScope.preferences.video.loopShortVideo != 'false';

                // 恢復音量
                var volume = localStorage.getItem("eagle.videoPlayer.volume") || 100;
                video.volume = parseInt(volume) / 100;

                // 循環播放設定
                if (loopShortVideo && video.duration <= 30) {
                    video.loop = true;
                }
                else {
                    video.loop = localStorage.getItem("eagle.videoPlayer.loop") === 'true';
                }

                // 恢復上次播放位置
                if (rememberPosition && scope.current) {
                    var savedTime = localStorage.getItem("eagle.videoPlayer.currentTime." + scope.current.id);
                    if (savedTime) {
                        savedTime = parseFloat(savedTime);
                        if (savedTime > 0 && savedTime < video.duration) {
                            video.currentTime = savedTime;
                        }
                    }
                }

                // 自動播放
                if (autoPlay) {
                    video.play();
                }
                else {
                    video.pause();
                }

                // 初始化快速鍵
                initShortcuts();

                // 初始化筆記功能
                var noteManager = video.plugins ? video.plugins.get('eagle-notes') : null;
                if (noteManager) {
                    if (!isInPreviewWindow) {
                        noteManager.setOnAdd(function () {
                            video.pause();
                            $bodyScope.addVideoComment(scope.current, video);
                        });
                    } else {
                        noteManager.hideButton();
                    }

                    if (scope.current && scope.current.comments) {
                        noteManager.setComments(scope.current.comments, video.duration);
                    }
                }
            });

            // ===== ended 事件 - 自訂循環行為 =====
            video.addEventListener('ended', function () {
                if (video.loop) {
                    video.currentTime = 0;
                    setTimeout(function () {
                        video.play();
                    }, 50);
                }
            });

            // ===== 筆記更新事件 =====
            var unwatchComments = scope.$on("REFRESH_VIDEO_COMMENTS", function () {
                var noteManager = video.plugins ? video.plugins.get('eagle-notes') : null;
                if (noteManager && scope.current) {
                    noteManager.setComments(scope.current.comments || [], video.duration);
                }
            });

            // ===== 音量變更處理 =====
            var volumeTimeout;
            video.addEventListener('volumechange', function () {
                var value = Math.round(video.volume * 100);
                if (video.muted) value = 0;
                localStorage.setItem("eagle.videoPlayer.volume", value);

                // 顯示音量提示 UI
                var iconClass = "vol-3";
                if (value === 0) {
                    iconClass = "vol-0";
                }
                else if (value < 30) {
                    iconClass = "vol-1";
                }
                else if (value < 100) {
                    iconClass = "vol-2";
                }
                $("#video-player-tips").removeClass('vol-0 vol-1 vol-2 vol-3').addClass(iconClass);
                $("#video-player-tips .value").html(value + "%");
                $("#video-player-tips").show();
                clearTimeout(volumeTimeout);
                volumeTimeout = setTimeout(function () {
                    $("#video-player-tips").hide();
                }, 1000);
            });

            // ===== 錯誤處理 =====
            video.addEventListener('error', debounce(function () {
                try {
                    element.find("~ .not-support-preview").show();
                }
                catch (err) {}
            }, 100, true));

            // ===== 雙擊處理 =====
            element.on("dblclick", function () {
                if (!isInPreviewWindow) {
                    $bodyScope.leaveDetailMode();
                }
                else {
                    scope.toggleFullScreen();
                    scope.$evalAsync();
                }
            });

            // ===== 滑鼠滾輪處理 =====
            var direction;
            var directionTimeout;
            video.addEventListener("mousewheel", function (e) {

                if (!isInPreviewWindow && $rootScope.preferences.habits.scrollBehavior === 'paging') {
                    return;
                }

                e.preventDefault();
                e.stopPropagation();

                directionTimeout = setTimeout(function () {
                    direction = "";
                }, 300);

                var deltaY = Math.max(-1, Math.min(1, -e.deltaY));

                // 計算 seekStep，根據影片長度、比例與最大上限
                var duration = video.duration || 0;
                var ratio = 0.02;
                var maxStep = 10;
                var baseSeeStep = Math.min(duration * ratio, maxStep);

                // 根據 delta 值調整步長
                var deltaFactor = Math.min(Math.abs(e.deltaY || e.deltaX) / 100, 1);
                var seekStep = baseSeeStep * (0.1 + deltaFactor * 0.9);

                var step = 0;
                if ((e.shiftKey || e.altKey) && e.deltaY) {
                    direction = "horizontal";
                    if (!e.deltaX) {
                        step = -e.deltaY > 0 ? seekStep : -seekStep;
                    }
                }
                else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                    direction = "vertical";
                    if ($rootScope.preferences.habits.videoScrollBehavior === 'progress') {
                        step = -e.deltaY > 0 ? seekStep : -seekStep;
                    }
                }
                else {
                    direction = "horizontal";
                    step = -e.deltaX > 0 ? seekStep : -seekStep;
                }

                if (direction == "horizontal" || $rootScope.preferences.habits.videoScrollBehavior === 'progress') {
                    clearTimeout(directionTimeout);
                    var absStep = Math.abs(step);
                    var newTime = video.currentTime;
                    if (step < 0 && newTime - absStep <= video.duration) { newTime += absStep; }
                    if (step > 0 && newTime + absStep > 0) { newTime -= absStep; }
                    if (newTime < 0) newTime = 0;
                    if (newTime > video.duration) newTime = video.duration;
                    video.currentTime = newTime;
                }
                else if (direction == "vertical" && Math.abs(e.deltaY) > 7) {
                    clearTimeout(directionTimeout);
                    if (deltaY == 1) {
                        video.volume = Math.min(1, video.volume + 0.05);
                    } else {
                        video.volume = Math.max(0, video.volume - 0.05);
                    }
                }
            }, false);

            // ===== 快速鍵 =====
            function initShortcuts() {

                var keybinds = preferences.shortcuts.keybinds;
                var playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4, 8];

                var shortcutHandlerMap = {
                    'player.volume.increase': function () {
                        video.volume = Math.min(1, video.volume + 0.05);
                    },
                    'player.volume.decrease': function () {
                        video.volume = Math.max(0, video.volume - 0.05);
                    },
                    'player.prev1frame': function () {
                        video.prevFrame();
                    },
                    'player.next1frame': function () {
                        video.nextFrame();
                    },
                    'player.prev10frame': function () {
                        video.prevFrame(10);
                    },
                    'player.next10frame': function () {
                        video.nextFrame(10);
                    },
                    'player.step.forward': function () {
                        var duration = video.duration || 0;
                        var step = Math.min(duration * 0.02, 10);
                        video.currentTime += step;
                    },
                    'player.step.backward': function () {
                        var duration = video.duration || 0;
                        var step = Math.min(duration * 0.02, 10);
                        video.currentTime -= step;
                    },
                    'player.speed.up': function () {
                        var idx = playbackRates.indexOf(video.playbackRate);
                        if (idx > -1 && playbackRates[idx + 1]) video.playbackRate = playbackRates[idx + 1];
                    },
                    'player.speed.down': function () {
                        var idx = playbackRates.indexOf(video.playbackRate);
                        if (idx > 0) video.playbackRate = playbackRates[idx - 1];
                    },
                    'player.playAndPause': function () {
                        if (!video.paused) { video.pause(); } else { video.play(); }
                    },
                    'player.thumbnail.set': function () {
                        $bodyScope.setAsVideoThumbnail();
                    },
                    'player.thumbnail.copy': function () {
                        $bodyScope.videoScreenShot(true);
                    },
                    'player.thumbnail.save': function () {
                        $bodyScope.videoScreenShot();
                    },
                };

                function applyWrapper(func) {
                    return throttle(function(event) {
                        event && event.preventDefault();
                        func(event);
                        $bodyScope.$evalAsync();
                    }, 24);
                }

                for (var entry of Object.entries(keybinds)) {
                    var name = entry[0];
                    var electronKey = entry[1];
                    if (shortcutHandlerMap[name] && electronKey) {
                        var key = window.ShortcutManager.electronToMousetrap(electronKey);
                        if ($bodyScope.isInlineMode && key === 'space') continue;
                        if (key) {
                            Mousetrap.unbind(key);
                            Mousetrap.bind(key, applyWrapper(shortcutHandlerMap[name]));
                        }
                    }
                }
            }
        }
    }
});
