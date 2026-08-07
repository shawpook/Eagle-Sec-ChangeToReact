EagleApp.directive('audioMediaElement', function ($rootScope) {
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {

            var wavesurfer;
            var wavesurferInterval;

            if ($("div.video-js").length > 0) {
                videojs($("div.video-js")[0]).dispose();
                return;
            }

            var ipcRenderer = require('electron').ipcRenderer;
            var video = element[0];
            var $parentScope = angular.element("body").scope();

            var volume = localStorage.getItem("eagle.videoPlayer.volume") || 100;
            video.volume = parseInt(volume) / 100;

            // 播放器初始化
            scope.$on('$destroy', function () {
                console.log("destory")
                if (element[0] && element[0].removeAllListeners) {
                    element[0].removeAllListeners();
                }
                video.src = "";
                videojs(element[0]).dispose();
                element.off();
                element.remove();
                if (wavesurfer) {
                    wavesurfer.destroy();
                }
                clearInterval(wavesurferInterval);
            });
            
            element.bind('error', _.debounce(function () {
                try {
                    var $scope = angular.element("body").scope();
                    var newPath = FileUrlHelper.getRawUrl(scope.current);
                    element.attr("src", newPath);
                    console.log("视频名称更新，重新定位新图片位置: " + newPath);
                }
                catch (err) {

                }
            }, 333, true));

            var initVideoJS = false;

            video.addEventListener('ended', function () {
                if (video.customizeLoop) {
                    video.currentTime = 0;
                    setTimeout(function () {
                        video.play();
                    }, 50);
                }
                else {
                    video.pause();
                }
            });

            video.addEventListener('loadedmetadata', function () {
                console.log("loadedmetadata");

                var volume = localStorage.getItem("eagle.videoPlayer.volume") || 100;
                video.volume = parseInt(volume) / 100;

                var currentTime;
                var autoPlay = true;
                var rememberPosition = false;
                video.customizeLoop = true;

                if (initVideoJS) {
                    if (autoPlay) {
                        video.play();
                    }
                    else {
                        video.pause();
                    }

                    if (video.customizeLoop) {
                        $(".vjs-icon-loop").addClass('enabled');
                    }
                    else {
                        $(".vjs-icon-loop").removeClass('enabled');
                    }

                    initWaveform();

                    initShortcuts();

                    return;
                }

                initVideoJS = true;
                var $v = videojs(video, {
                    language: (preferences && preferences.general && preferences.general.language) || "en",
                    loadingSpinner: false,
                    volume: parseInt(volume) / 100,
                    playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
                }).ready(function () {
                    if (!$parentScope.isDetailMode) {
                        return;
                    }
                    var player = this;
                    // Videojs bug，滑桿不會自動更新
                    $(player.el()).find(".vjs-volume-level").css("width", video.volume * 100 + "%");
                    var $video = $(video);
                    var fullScreenButton = player.controlBar.fullscreenToggle.el_;
                    var $fullScreenButton = $(fullScreenButton).detach();
                    var loopBtn = player.controlBar.addChild('button');
                    loopBtn.controlText(player.localize('Loop'));
                    loopBtn.addClass('vjs-icon-loop');
                    loopBtn.on('click', function () {
                        video.customizeLoop = !video.customizeLoop;
                        localStorage.setItem("eagle.videoPlayer.loop", video.customizeLoop);
                        updateLoopButton();
                    });
                    $fullScreenButton.insertAfter(loopBtn.el_);

                    this.el_.addEventListener("mousewheel", function (event) {
                        doScroll(event, player);
                    }, false);
                    var old_element = $('.vjs-fullscreen-control')[0];
                    if (!old_element) {
                        video.pause();
                        return;
                    }
                    var new_element = old_element.cloneNode(true);
                    old_element.parentNode.replaceChild(new_element, old_element);
                    $('.vjs-fullscreen-control').eq(0).on("click", function (event) {
                        event.preventDefault();
                        ipcRenderer.send('toggle-slideshow');
                    });

                    updateLoopButton();

                    function updateLoopButton() {
                        if (!video.customizeLoop) {
                            $(loopBtn.el_).removeClass("enabled");
                        }
                        else {
                            $(loopBtn.el_).addClass("enabled");
                        }
                    }

                    if (autoPlay) {
                        video.play();
                    }
                    else {
                        video.pause();
                    }
                    initWaveform();
                    initShortcuts();



                });
            }, false);

            function initWaveform () {

                if (video.duration > 3600) return;
                var WaveSurfer = new require(appRoot.path + "/app/js/vendors/wavesurfer.min.js");
                // 
                // 音波效果初始化
                if (wavesurfer) {
                    wavesurfer.destroy();
                    $(video).off('pause');
                    $(video).off('play');
                    $(video).off('timeupdate');
                    clearInterval(wavesurferInterval);
                }
                wavesurfer = WaveSurfer.create({
                    // container: "#detail-wavesurfer",
                    container: ".vjs-progress-holder.vjs-slider.vjs-slider-horizontal",
                    waveColor: '#7C7C7C',
                    progressColor: '#0072EF',
                    cursorColor: "#0072EF",
                    cursorWidth: 1,
                    normalize: true,
                    forceDecode: true,
                    height: 40,
                    responsive: true,
                    interact: false,
                });
                
                wavesurfer.on('ready', function () {

                    wavesurferInterval = setInterval(function () {
                        if (video && video.currentTime) {
                            const currPercent = video.currentTime / video.duration;
                            const curr = wavesurfer.getDuration() * currPercent;
                            wavesurfer.setCurrentTime(curr);
                        }
                    }, 16);

                    wavesurfer.setMute(true);
                });

                var src = video.src;
                var xhr = new XMLHttpRequest();
                xhr.open('GET', src);
                xhr.responseType = 'blob';
                xhr.onload = function (e) { 
                    wavesurfer.loadBlob(xhr.response);
                }
                xhr.send();
            };

            function initShortcuts() {

                const keybinds = preferences.shortcuts.keybinds;
                const playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4, 8];
                const frameTime = 0.04166667;

                // 建立快捷鍵名稱到處理函數的映射
                const shortcutHandlerMap = {
                    'player.volume.increase': () => {
                        video.volume = Math.min(1, video.volume + 0.05);
                    },
                    'player.volume.decrease': () => {
                        video.volume = Math.max(0, video.volume - 0.05);
                    },
                    'player.prev1frame': () => { 
                        video.currentTime -= video.frameTime || frameTime;
                    },
                    'player.next1frame': () => {
                        video.currentTime += video.frameTime || frameTime;
                    },
                    'player.prev10frame': () => {
                        video.currentTime -= (video.frameTime || frameTime) * 10;
                    },
                    'player.next10frame': () => {
                        video.currentTime += (video.frameTime || frameTime) * 10;
                    },
                    // duration：影片總長度（秒）
                    // ratio：比例，例如 1% = 0.01
                    // maxStep：上限，例如 10 秒
                    'player.step.forward': () => {
                        const duration = video.duration || 0;
                        const ratio = 0.02; // 2%
                        const maxStep = 10; // 10 秒
                        const step = Math.min(duration * ratio, maxStep);
                        video.currentTime += step;
                    },
                    'player.step.backward': () => {
                        const duration = video.duration || 0;
                        const ratio = 0.02; // 2%
                        const maxStep = 10; // 10 秒
                        const step = Math.min(duration * ratio, maxStep);
                        video.currentTime -= step;
                    },
                    'player.speed.up': () => {
                        let idx = playbackRates.indexOf(video.playbackRate);
                        if (idx > -1 && playbackRates[idx + 1]) video.playbackRate = playbackRates[idx + 1];
                    },
                    'player.speed.down': () => {
                        let idx = playbackRates.indexOf(video.playbackRate);
                        if (idx > 0) video.playbackRate = playbackRates[idx - 1];
                    },
                    'player.playAndPause': () => {
                        if (!video.paused) { video.pause(); } else { video.play(); }
                    },
                };

                function applyWrapper(func) {
                    return throttle(function(event) {
                        event && event.preventDefault();
                        func(event);
                        $bodyScope.$evalAsync();
                    }, 24);
                }
                
                for (const [name, electronKey] of Object.entries(keybinds)) {
                    if (shortcutHandlerMap[name] && electronKey) {
                        const key = window.ShortcutManager.electronToMousetrap(electronKey);
                        if ($bodyScope.isInlineMode && key === 'space') return;
                        if (key) {
                            Mousetrap.unbind(key);
                            Mousetrap.bind(key, applyWrapper(shortcutHandlerMap[name])); 
                        }
                    }
                }
            }

            var volumeTimeout;
            video.onvolumechange = function (event) {
                let iconClass = "vol-3";
                var value = Math.round(video.volume * 100) / 1;
                if (video.muted) value = 0;
                if (value === 0) {
                    iconClass = "vol-0";
                }
                else if (value < 30) {
                    iconClass = "vol-1";
                }
                else if (value < 100) {
                    iconClass = "vol-2";
                }
                else {
                    iconClass = "vol-3";
                }
                value = value + "%";
                $("#video-player-tips").removeClass('vol-0 vol-1 vol-2 vol-3').addClass(iconClass);
                $("#video-player-tips .value").html(value);
                $("#video-player-tips").show();
                localStorage.setItem("eagle.videoPlayer.volume", value);
                clearTimeout(volumeTimeout);
                volumeTimeout = setTimeout(function () {
                    $("#video-player-tips").hide();
                }, 1000);
            };

            element.on("dblclick", function () {
                var $scope = angular.element("body").scope();
                $scope.leaveDetailMode();
            });

            var direction;
            var directionTimeout;
            var doScroll = function (e, player) {

                if ($rootScope.preferences.habits.scrollBehavior === 'paging') {
                    return;
                }

                e.preventDefault();
                e.stopPropagation();

                if (!player) return;

                directionTimeout = setTimeout(function () {
                    direction = "";
                }, 300);

                var deltaX = Math.max(-1, Math.min(1, -e.deltaX));
                var deltaY = Math.max(-1, Math.min(1, -e.deltaY));
                // 計算 seekStep，根據影片長度、比例與最大上限，並考慮滑鼠滾動量
                var duration = video.duration || 0;
                var ratio = 0.02; // 2%
                var maxStep = 10; // 10 秒
                var baseSeeStep = Math.min(duration * ratio, maxStep);

                // 根據 delta 值調整步長，避免 magic mouse 滑動過快
                var deltaFactor = Math.min(Math.abs(e.deltaY || e.deltaX) / 100, 1);
                var seekStep = baseSeeStep * (0.1 + deltaFactor * 0.9); // 最小 10%，最大 100%

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
                    let newTime = video.currentTime;
                    if (step < 0 && newTime - absStep <= video.duration) { newTime += absStep; }
                    if (step > 0 && newTime + absStep > 0) { newTime -= absStep; }
                    if (newTime === player.duration()) {
                        newTime = newTime - 0.1
                    }
                    player.currentTime(newTime)
                } else if (direction == "vertical" && Math.abs(e.deltaY) > 7) {
                    clearTimeout(directionTimeout);
                    if (deltaY == 1) {
                        if (video.volume + 0.05 > 1) {
                            video.volume = 1;
                        } else {
                            video.volume += 0.05;
                        }
                    } else {
                        if (video.volume - 0.05 < 0) {
                            video.volume = 0;
                        } else {
                            video.volume -= 0.05;
                        }
                    }
                }
            };
        }
    }
});