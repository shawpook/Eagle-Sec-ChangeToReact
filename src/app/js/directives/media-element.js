angular.module("mediaElement",[]).directive('mediaElement', function ($rootScope, $filter) {
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {


            var isInPreviewWindow = $("#preview-window").length > 0;
            var ipcRenderer = require('electron').ipcRenderer;
            var player;
            var video = element[0];
            var $parentScope = angular.element("body").scope();

            var volume = localStorage.getItem("eagle.videoPlayer.volume") || 100;
            video.volume = parseInt(volume) / 100;

            var minCurrentTime;
            var maxCurrentTime;

            if ($("div.video-js").length > 0) {
                videojs($("div.video-js")[0]).dispose();
                return;
            }

            scope.$on('$destroy', function () {
                console.log("destory")
                try {
                    videojs(element[0]).dispose();

                    let videos = [element[0]];
                    element.find("video").each(function (index, video) {
                        videos.push(video);
                    });

                    videos.forEach(function (video) {
                        video.src = "file://";
                        video.load();
                    });

                    element.off();
                    element.remove();

                    $(".vjs-progress-holder.vjs-slider.vjs-slider-horizontal").off("mousedown.videopreview").off("mousemove.videopreview");
                    $("body").off("mousemove.videopreview").off("mouseup.videopreview");
                    if ($("#not-support-preview").length > 0) {
                        $("#not-support-preview").css("display", "");
                    }
                }
                catch (err) {}
            });

            function initToolbarBtn () {
                document.querySelectorAll('.vjs-button[title]').forEach((element) => {
                    let attrs = element.attributes;
                    let title = attrs.title.value;
                    title = $filter('shortcuts')(title);

                    element.removeAttribute('title');

                    if (element.hasAttribute('data-tippy')) return;
                    tippy(element, {
                        animation: 'scale',
                        arrow: false,
                        content: title,
                        placement: 'top',
                        allowHTML: true,
                    });                    
                });
            }

            function initComments () {
                $(".vjs-progress-control .video-comments").empty();
                if (scope.current && scope.current.comments && scope.current.comments.length > 0) {
                    var $container = $(".vjs-progress-control");
                    var $comments = $(`<div class="video-comments"></div>`);

                    scope.current.comments.forEach(function (comment) {
                        var leftP = (comment.duration / video.duration) * 100;
                        var $comment = $(`<div comment-id="${comment.id}" class="video-comment" style="left: ${leftP}%;"><div class="annotation"><div>${comment.annotation}</div></div></div>`)
                        $comments.append($comment);
                    });

                    $container.append($comments);
                }
            }

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
                    'player.thumbnail.set': () => {
                        $bodyScope.setAsVideoThumbnail();
                    },
                    'player.thumbnail.copy': () => {
                        $bodyScope.videoScreenShot(true);
                    },
                    'player.thumbnail.save': () => {
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

            scope.$on("REFRESH_VIDEO_COMMENTS", function () {
                initComments();
            });

            element.bind('error', debounce(function (event) {
                try {
                    console.log("[mediaElement] Video playback error:", event.target.error);
                    var oldPath = element[0].currentSrc;
                    var newPath = FileUrlHelper.getRawUrl(scope.current);
                    if (oldPath !== newPath) {
                        // File was renamed, update source path
                        setTimeout(function () {
                            element.attr("src", newPath);
                        }, 200);
                        return;
                    }
                    // Native player can't play this format, fall back to MPV player
                    console.log("[mediaElement] Falling back to MPV player");
                    scope.$evalAsync(function () {
                        scope.$parent.useMpvPlayer = true;
                    });
                }
                catch (err) {}
            }, 100, true));

            var initVideoJS = false;

            var avgFPS = 0;
            var lastFrameTime;
            var isPaused = false;
            var frameRendered = false;

			var frameCounter = (time, metadata) => {
                frameRendered = true;
                video.requestVideoFrameCallback(frameCounter);
                if (isPaused) return;
                if (lastFrameTime > 0) {
					let frameTime = (time - lastFrameTime) / 1000;
					if (frameTime) {
						let lastFrameTime = video.frameTime;
						if (lastFrameTime) {
							video.frameTime = (lastFrameTime + frameTime) / 2;
						}
						else {
                    		video.frameTime = frameTime;
						}
                    	video.fps = 1000 / (video.frameTime * 1000);
					}
                }
                lastFrameTime = time;
            }

            video.addEventListener('pause', (event) => {
                isPaused = true;
                lastFrameTime = 0;
                setTimeout(() => {
                    document.querySelectorAll('.vjs-control-bar .vjs-button[title]').forEach((element) => {
                        element.removeAttribute('title');
                    });
                }, 300);
            });

            video.addEventListener('play', (event) => {
                isPaused = false;
                setTimeout(() => {
                    document.querySelectorAll('.vjs-control-bar .vjs-button[title]').forEach((element) => {
                        element.removeAttribute('title');
                    });
                }, 300);
            });

            video.addEventListener('ended', function () {
                if (video.customizeLoop) {
                    video.currentTime = 0;
                    setTimeout(function () {
                        video.play();
                    }, 50);
                }
                else if (minCurrentTime !== 0) {
                    video.pause();
                }
            });

            video.addEventListener('loadedmetadata', function () {

				video.cancelVideoFrameCallback(frameCounter);
            	video.requestVideoFrameCallback(frameCounter);

                console.log("loadedmetadata");

                // 偵測無法播放的影片：metadata 載入但無法解碼
                // 情況 1：拿不到影片尺寸或時間長度 → 立即 fallback
                if ((!video.videoWidth && !video.videoHeight) || !isFinite(video.duration) || video.duration <= 0) {
                    console.log("[mediaElement] Unplayable video detected (no dimensions or duration), falling back to MPV");
                    scope.$evalAsync(function () {
                        scope.$parent.useMpvPlayer = true;
                    });
                    return;
                }

                // 情況 2：metadata 看似正常但實際無法解碼（黑屏）→ 延遲偵測
                // 播放後若 1.5 秒內沒有任何 frame 被渲染，fallback 到 MPV
                frameRendered = false;
                var frameCheckTimeout = setTimeout(function () {
                    if (!frameRendered && !video.paused) {
                        console.log("[mediaElement] No frames rendered during playback, falling back to MPV");
                        scope.$evalAsync(function () {
                            scope.$parent.useMpvPlayer = true;
                        });
                    }
                }, 1500);
                scope.$on('$destroy', function () {
                    clearTimeout(frameCheckTimeout);
                });

                element.find("~ .not-support-preview").hide();

                var updateInterval;
                minCurrentTime = 0;
                maxCurrentTime = video.duration;

                var volume = localStorage.getItem("eagle.videoPlayer.volume") || 100;
                video.volume = parseInt(volume) / 100;

                if (video.videoHeight) {
                    $(video).css({
                        'max-width': video.videoWidth,
                        'max-height': video.videoHeight,
                    });
                }

                scope.$on('$destroy', function () {
                    clearInterval(updateInterval);
                });
                
                var currentTime;
                if (scope.current) { 
                    currentTime = localStorage.getItem("eagle.videoPlayer.currentTime." + scope.current.id) 
                }
                var autoPlay = $rootScope.preferences.video.autoPlay != 'false';
                var zoomFill = $rootScope.preferences.video.zoomFill != 'false';
                var rememberPosition = $rootScope.preferences.video.rememberPosition != 'false';
                var loopShortVideo = $rootScope.preferences.video.loopShortVideo != 'false';
                var duration = video.duration;
                var src = video.src;

                if (loopShortVideo && video.duration <= 30) {
                    video.customizeLoop = true;
                }
                else {
                    video.customizeLoop = localStorage.getItem("eagle.videoPlayer.loop") === 'true';
                }

                if (rememberPosition && currentTime) {
                    currentTime = parseFloat(currentTime);
                    video.currentTime = currentTime;
                }

                if (initVideoJS) {
                    if (autoPlay) {
                        video.play();
                    }
                    else {
                        video.pause();
                    }

                    if (!zoomFill) {
                        $(video).addClass("fit");
                    }
                    else {
                        $(video).removeClass("fit");
                    }

                    if (video.customizeLoop) {
                        $(".vjs-icon-loop").addClass('enabled');
                    }
                    else {
                        $(".vjs-icon-loop").removeClass('enabled');
                    }

                    initTrack();
                    initComments();
                    setTimeout(function () {
                        initThumbnailPewivew();
                    }, 500);

                    return;
                }

                function initResizer () {
                    var $container = $(".vjs-progress-control");
                    var $resizableBar = $(`<div class="resize-bar"><div class="bar"></div></div>`);
                    if ($resizableBar.is('.ui-resizable')) {
                        $resizableBar.resizable( "destroy" );
                    }
                    $resizableBar.css({
                        left: 0,
                        width: 'auto'
                    });
                    $resizableBar.resizable({
                        minWidth: 2,
                        handles: "e, w",
                        containment: ".vjs-progress-control",
                        start: function (event, ui) {
                            minCurrentTime = 0;
                            maxCurrentTime = video.duration;
                            $(".vjs-progress-holder").css("pointer-events", "none");

                        },
                        stop: function (event, ui) {

                            $(".vjs-progress-holder").css("pointer-events", "initial");

                            var resizerLeft = ui.position.left;
                            var resizerWidth = ui.size.width;
                            var progressWith = $(".vjs-progress-holder").width();
                            var resizerLeftP = resizerLeft / progressWith * 100;
                            var resizerWidthP = resizerWidth / progressWith * 100;

                            $resizableBar.css({
                                left: `${resizerLeftP}%`,
                                width: `${resizerWidthP}%`
                            });

                            minCurrentTime = video.duration * resizerLeftP / 100;
                            maxCurrentTime = video.duration * (resizerLeft + resizerWidth) / progressWith;

                            minCurrentTime = minCurrentTime.toFixed(2);
                        }
                    });
                    $container.append($resizableBar);
                }

                function initTrack () {

                    var existsTracks = player.remoteTextTracks().tracks_;
                    existsTracks.forEach(function (track) {
                        player.textTracks().removeTrack(track);
                    });
                    element.find("track").remove();

                    // 載入字幕
                    var videoPath = FileUrlHelper.getRawPath(scope.current);
                    var vttTrackPath = videoPath.replace(`.${scope.current.ext}`, ".vtt");
                    var vttTrackName = path.basename(vttTrackPath);
                    fs.exists(vttTrackPath, function (isExists) {
                        if (!isExists) return;
                        player.addRemoteTextTrack({
                            kind: "captions",
                            label: vttTrackName,
                            srclang: "en",
                            src: URL_MODULE.pathToFileURL(vttTrackPath).href,
                        }, false);
                        player.textTracks().tracks_[0].mode = 'showing'; // 自動啟用字幕
                    })
                    
                    var srtTrackPath = videoPath.replace(`.${scope.current.ext}`, ".srt");
                    var srtTrackName = path.basename(srtTrackPath);
                    fs.readFile(srtTrackPath, "utf8", function (err, str) {
                        if (!str) return;
                        var vtt2srt = require(appRoot + '/my_modules/vtt2srt');
                        vtt2srt(str).then(function (strUrl) {
                            let options = {
                                kind: "captions",
                                label: srtTrackName,
                                srclang: "en",
                                src: strUrl,
                            }
                            player.addRemoteTextTrack(options, false);
                            player.textTracks().tracks_[0].mode = 'showing'; // 自動啟用字幕
                        });
                    });
                }

                function initThumbnailPewivew () {
                    var $container = $(".vjs-progress-holder.vjs-slider.vjs-slider-horizontal");
                    var $thumbnailVideo = $('<video/>', {
                        id: 'video-preview-thumb',
                        src: src,
                        controls: false,
                        autoplay: false,
                        muted: true
                    });
                    var $progressbar = $container.find(".vjs-slider-bar");
                    $container.find("video").off().remove();
                    $container.append($thumbnailVideo);
                    var videoWidth = $thumbnailVideo.width();
                    var updatePreviewTimeout;
                    var startX;
                    var offsetX;
                    var originPaused;
                    var isMouseDown = false;

                    $container.off("mousedown.videopreview").on("mousedown.videopreview", function (event) {
                        event.stopPropagation();
                        startX = event.pageX;
                        offsetX = event.offsetX;
                        if (event.buttons === 1 || (event.buttons === undefined && event.which === 1)) {
                            isMouseDown = true;
                            originPaused = video.paused;
                            if (!video.paused) {
                                video.pause();
                            }
                        }
                    });

                    $progressbar.off("mouseup.videoprocess").on("mouseup.videoprocess", function (event) {
                        startX = undefined;
                        isMouseDown = false;
                    });

                    $container.off("mousemove.videopreview").on("mousemove.videopreview", function (event) {
                        if (startX === undefined) {
                            startX = event.pageX;
                            offsetX = event.offsetX;
                        }
                    });

                    const updateVideoPreview = function (event) {
                        try {
                            // clearTimeout(updatePreviewTimeout);
                            var diff = event.pageX - startX;
                            var mouseX = offsetX + diff;
                            var cw = $container.width();

                            if (mouseTime > cw) mouseTime = cw;
                            if (mouseX < 0) mouseX = 0;
                            
                            var mouseTime = parseFloat(duration * mouseX / cw);
                            var left = mouseX / cw * 100;

                            if (left > 100) left = 100;
                            if (left < 0) left = 0;

                            if (mouseTime >= 0) {
                                $thumbnailVideo.css("left", `${left}%`);
                                if (
                                    (event.buttons === 1 || (event.buttons === undefined && event.which === 1)) && isMouseDown
                                ) {
                                    videoHelper.setVideosCurrentTime([video, $thumbnailVideo[0]], Math.round(mouseTime));
                                    $progressbar.css("width", `${left}%`)
                                    if (Math.round(mouseTime) === 0 && left < 0.2) {
                                        videoHelper.setVideosCurrentTime([video, $thumbnailVideo[0]], Math.round(mouseTime));
                                        $thumbnailVideo.css("left", `0%`);
                                        $progressbar.css("width", `0%`);
                                    }
                                }
                                else {
                                    videoHelper.setCurrentTime($thumbnailVideo[0], mouseTime);
                                }
                            }
                        }
                        catch (err) {};
                    }

                    $("body").off("mousemove.videopreview").on("mousemove.videopreview", function (event) {
                        if (startX === undefined) {
                            return;
                        }
                        updateVideoPreview(event);
                    });

                    $(video).off("mousedown.videopreview").on("mousedown.videopreview", function (event) {
                        startX = undefined;
                        isMouseDown = false;
                        updateVideoPreview(event);
                    });

                    $(".vjs-button").off("mousedown.videopreview").on("mousedown.videopreview", function (event) {
                        startX = undefined;
                        isMouseDown = false;
                    });

                    $("body").off("mouseup.videopreview").on("mouseup.videopreview", function (event) {
                        startX = undefined;
                        isMouseDown = false;
                        if (event.buttons === 0 || (event.buttons === undefined && event.which === 1)) {
                            if (originPaused === false) {
                                video.play();
                            }
                            originPaused = undefined;
                        }
                    });
                }

                initVideoJS = true;
                var $v = videojs(video, {
                    language: (preferences && preferences.general && preferences.general.language) || "en",
                    loadingSpinner: false,
                    volume: volume,
                    playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4, 8],
                    disableSeekBar: true,
                }).ready(function () {
                    if (!$parentScope.isDetailMode) {
                        return;
                    }
                    player = this;
                    // Videojs bug，滑桿不會自動更新
                    $(player.el()).find(".vjs-volume-level").css("width", video.volume * 100 + "%");
                    var $video = $(video);
                    var $playButton = $(player.controlBar.playToggle.el_);
                    var fullScreenButton = player.controlBar.fullscreenToggle.el_;
                    var $fullScreenButton = $(fullScreenButton).detach();
                    var loopBtn = player.controlBar.addChild('button');

                    if (!zoomFill) {
                        $video.addClass("fit");
                    }
                    else {
                        $video.removeClass("fit");
                    }

                    loopBtn.controlText(player.localize('Loop'));
                    loopBtn.addClass('vjs-icon-loop');
                    loopBtn.on('click', function () {
                        video.customizeLoop = !video.customizeLoop;
                        localStorage.setItem("eagle.videoPlayer.loop", video.customizeLoop);
                        updateLoopButton();
                    });
                    $fullScreenButton.insertAfter(loopBtn.el_);

                    // 笔记按钮
                    if (!isInPreviewWindow) {
                        var noteBtn = player.controlBar.addChild('button');
                        noteBtn.controlText(player.localize('Note'));
                        noteBtn.addClass('vjs-icon-note');
                        noteBtn.on('click', function () {
                            video.pause();
                            $bodyScope.addVideoComment(scope.current, video);
                        });
                        var $noteBtn = $(noteBtn.el_).detach();
                        $noteBtn.insertBefore($fullScreenButton);
                    }

                    // 快進退按鈕，壓住不放會持續觸發
                    var forwardBtn = player.controlBar.addChild('button');
                    forwardBtn.controlText(player.localize('Forward'));
                    forwardBtn.addClass('vjs-icon-forward');

                    var forwardInterval;
                    function forwardStep() {
                        var duration = video.duration || 0;
                        var ratio = 0.02; // 2%
                        var maxStep = 20; // 20 秒
                        var step = Math.min(duration * ratio, maxStep);
                        video.currentTime += step;
                    }
                    forwardBtn.on('mousedown', function () {
                        forwardStep();
                        clearInterval(forwardInterval);
                        forwardInterval = setInterval(forwardStep, 100);
                    });
                    $(document).on('mouseup mouseleave', function () {
                        clearInterval(forwardInterval);
                    });

                    var backwardBtn = player.controlBar.addChild('button');
                    backwardBtn.controlText(player.localize('Backward'));
                    backwardBtn.addClass('vjs-icon-backward');

                    var backwardInterval;
                    function backwardStep() {
                        var duration = video.duration || 0;
                        var ratio = 0.02; // 2%
                        var maxStep = 10; // 10 秒
                        var step = Math.min(duration * ratio, maxStep);
                        video.currentTime -= step;
                    }
                    backwardBtn.on('mousedown', function () {
                        backwardStep();
                        clearInterval(backwardInterval);
                        backwardInterval = setInterval(backwardStep, 100);
                    });
                    $(document).on('mouseup mouseleave', function () {
                        clearInterval(backwardInterval);
                    });

                    var $forwardBtn = $(forwardBtn.el_).detach();
                    var $backwardBtn = $(backwardBtn.el_).detach();

                    $forwardBtn.insertAfter($playButton);
                    $backwardBtn.insertAfter($playButton);

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
                        if (!isInPreviewWindow) {
                            ipcRenderer.send('toggle-slideshow');
                        }
                        else {
                            if (currentWindow.isFullScreen()) {
                                currentWindow.setFullScreen(false);
                            }
                            else {
                                currentWindow.setFullScreen(true);
                            }
                        }
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
                    initTrack();
                    initThumbnailPewivew();
                    initResizer();
                    initComments();

                    // 初始化 tooltips
                    initToolbarBtn();

                    // 初始化快速鍵功能
                    initShortcuts();
                });
            }, false);

            updateInterval = setInterval(function () {
                if (video && video.currentTime && !video.paused) {
                    if (video.currentTime >= maxCurrentTime) {
                        videoHelper.setCurrentTime(video, minCurrentTime);
                        if (!video.customizeLoop) { video.pause(); }
                    }
                    else if (video.currentTime < minCurrentTime) {
                        videoHelper.setCurrentTime(video, minCurrentTime);
                        if (!video.customizeLoop) { video.pause(); }
                    }
                }
            }, 32);

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
                if (!isInPreviewWindow) {
                    var $scope = angular.element("body").scope();
                    $scope.leaveDetailMode();
                }
                else {
                    scope.toggleFullScreen();
                    scope.$evalAsync();
                }
            });

            var direction;
            var directionTimeout;
            var doScroll = function (e, player) {

                if (!isInPreviewWindow && $rootScope.preferences.habits.scrollBehavior === 'paging') {
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
                    player.currentTime(newTime);
                    var progress = newTime / video.duration * 100;
                    var $progressbar = $(".vjs-play-progress.vjs-slider-bar");
                    $progressbar.css("width", `${progress}%`)
                } 
                else if (direction == "vertical" && Math.abs(e.deltaY) > 7) {
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