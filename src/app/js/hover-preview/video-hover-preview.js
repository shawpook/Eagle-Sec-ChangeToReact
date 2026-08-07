// === Shared Hover Preview Observer ===
var hoverPreviewObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
            var sentinelEl = entry.target;
            var $box = $(sentinelEl).closest('.box');
            if (!$box.length && sentinelEl._hoverBox) {
                $box = $(sentinelEl._hoverBox);
            }
            // box 還在被 hover 時不由 observer 清理，避免 cleanup→mouseenter 循環
            if ($box.length && $box.is(':hover')) return;
            cleanupBoxHoverPreview($box);
            hoverPreviewObserver.unobserve(sentinelEl);
        }
    });
}, { threshold: [0] });

function cleanupBoxHoverPreview($box) {
    if (!$box || !$box.length || !$box.hasClass('hover-active')) return;
    $box.removeClass('hover-active');
    clearTimeout($box[0]._spinnerTimeout);

    var $thumbnail = $box.find('.thumbnail');
    var $image = $thumbnail.find('img');
    $image.show();

    // Video — pause 停渲染 → remove 脫離 DOM → 清 src 釋放資源
    $thumbnail.find('video').each(function () {
        try { this.pause(); } catch (e) {}
        $(this).remove();
        try { this.src = ''; this.load(); } catch (e) {}
    });

    // MPV
    $thumbnail.find('mpv-video').each(function () {
        try { this.destroy(); } catch (e) {}
    }).remove();

    // Audio
    $thumbnail.find('audio').each(function () {
        try { this.pause(); this.src = ''; } catch (e) {}
    }).remove();
    playingAudiosElements = [];

    // Iframe (YouTube/Vimeo)
    $thumbnail.find('.iframe-wrap').each(function () {
        try { $(this).find('iframe')[0].src = ''; } catch (e) {}
    }).remove();

    // 停用 iframe postMessage 狀態，避免 stale message handler 繼續更新已移除的 UI
    if (typeof _vimeoPlayerState !== 'undefined') _vimeoPlayerState.active = false;
    if (typeof _ytPlayerState !== 'undefined') _ytPlayerState.active = false;

    // UI
    $thumbnail.find('.video-loading-spinner').remove();
    $thumbnail.find('.video-progress-bar, .audio-progress-bar, .audio-progress-bar-cursor, .current-time, .controls').remove();
    $thumbnail.find('.mute-toggle').off().remove();
    $thumbnail.find('.autoplay-toggle').off();
    $image.off('mousedown.duration').off('mousemove.progressCursor');
    $thumbnail.find('.hover-sentinel').remove();
}

function startHoverPreviewWatch($box) {
    $box.find('.hover-sentinel').each(function () {
        hoverPreviewObserver.unobserve(this);
        $(this).remove();
    });
    $box.addClass('hover-active');
    var sentinel = document.createElement('div');
    sentinel.className = 'hover-sentinel';
    sentinel._hoverBox = $box[0];
    $box.find('.thumbnail').append(sentinel);
    requestAnimationFrame(function () {
        hoverPreviewObserver.observe(sentinel);
    });
}

function disarmHoverSentinel($box) {
    $box.removeClass('hover-active');
    $box.find('.hover-sentinel').each(function () {
        hoverPreviewObserver.unobserve(this);
        $(this).remove();
    });
}

// MP4 文件悬停自动播放
var mouseoverVideoTimeout;
var updateVideoCursorInterval;
var videoHoverSelector = EagleConfig.VIDEO_FORMATS.map(function(ext) {
    return '.box.ext-' + ext + ' .thumbnail';
}).join(', ');
$("#box-container").on('mouseenter', videoHoverSelector, function(event) {
    event.stopPropagation();

    // 避免拖拽时重复触发又在背景无限播放
    if (event.which === 1) return;
    if (rectSelecting) return;
    if ($bodyScope.preferences.video.hoverPlay === "false") return;

    var $scope = angular.element("body").scope();
    var $box = $(".box").has(this);
    var image = $scope.getItemByElement($box[0]);

    if (!image) return;
    if (image.noPreview) return;

    // 悬停 500ms 在开始播放
    clearTimeout(mouseoverVideoTimeout);
    clearInterval(updateVideoCursorInterval);
    mouseoverVideoTimeout = setTimeout(function () {
        var $videos = $box.find("video");
        if ($videos.length > 0) {
            $box.find(".video-loading-spinner").remove();
            $videos[0].load();
            $videos[0].pause();
            $videos[0].src = "";
            $videos.remove();
            return;
        }
        var $mpvVideos = $box.find("mpv-video");
        if ($mpvVideos.length > 0) {
            $box.find(".video-loading-spinner").remove();
            try { $mpvVideos[0].destroy(); } catch (err) {}
            $mpvVideos.remove();
            return;
        }
        var $image = $box.find("img");
        $box.find(".video-progress-bar").remove();
        var $progressbar = $('<div class="video-progress-bar"><div class="current"></div></div>')
        var $currentTime = $(`<div class="current-time">00:00</div>`);
        var $muteToggle = $('<div class="mute-toggle"></div>');
        var muted = localStorage["eagle.list.video.muted"] != 'false';
        if (muted) {
            $muteToggle.addClass("muted");
        }
        else {
            $muteToggle.removeClass("muted");
        }
        console.log(muted);
        var video = $('<video/>', {
            id: 'video',
            src: $bodyScope.getRawUrl(image),
            type: 'video/mp4',
            controls: false,
            autoplay: true,
            muted: muted,
            draggable: true,
            loop: true
        });

        var $controls = $('<div class="controls"></div>');
        $controls.append($currentTime);
        $controls.append($muteToggle);
        $controls.hide();

        var volume = localStorage.getItem("eagle.videoPlayer.volume") || 100;
        video[0].volume = parseInt(volume) / 100;

        if ($box.find("video").length === 0) {

            video.on('dragstart', function (event) {
                event.preventDefault();
                onDragStartContainer(event);
            });

            video.on('drag', function () {
                event.preventDefault();
                onImageDrag(event);
            });

            video.on('dragend', function () {
                event.preventDefault();
                onDragEndContainer(event);
            });

            video.on('mouseover', function (event) {
                event.stopPropagation();
            });

            var autoPlayTimeout;
            var currentTimeTimeout;
            video.on('mousemove', throttle(function (event) {
                if (rectSelecting) return;
                mouseX = event.offsetX;
                var duration = video.get(0).duration;
                var mouseTime = (duration * mouseX / $image.width());
                var width = mouseX / $image.width() * 100;

                $progressbar.find(".current").width("calc(" + width + "%" + " - 2px)");
                $currentTime.addClass("show");
                $controls.show();
                clearTimeout(currentTimeTimeout);
                currentTimeTimeout = setTimeout(() => {
                	$currentTime.removeClass("show");
                }, 600);

                mouseTime = Math.round(mouseTime * 100) / 100;
                if (mouseTime && !isNaN(mouseTime) && isFinite(mouseTime)) {
                    videoHelper.setCurrentTime(video.get(0), parseFloat(mouseTime));
                    video.get(0).pause();
                    clearTimeout(autoPlayTimeout);
                    autoPlayTimeout = setTimeout(function () {
                        try {
                            if (document.body.contains(video.get(0))) {
                                video.get(0).play();
                            }
                        } catch (err) {
                        }
                    }, 200);
                }
            }, 50, true));
            var ratio = image.width / image.height;
            var ratio2 = $image.width() / $image.height();
            if (ratio > ratio2) {
                video.height($image.height());
                video.width();
            }
            else {
                video.width($image.width());
                video.height($image.width() / ratio);
            }
            video.hide();

            $muteToggle.on("mousedown", function (event) {
                event.stopPropagation();
            });

            $muteToggle.on("dblclick", function (event) {
                event.stopPropagation();
            });

            $muteToggle.on("mouseover", function (event) {
                event.stopPropagation();
            });

            $muteToggle.on("click", function (event) {
                console.log("click");
                event.stopPropagation();
                video.get(0).muted = !video.get(0).muted;
                muted = video.get(0).muted;
                if (muted) {
                    $muteToggle.addClass("muted");
                }
                else {
                    $muteToggle.removeClass("muted");
                }
                localStorage.setItem("eagle.list.video.muted", muted);
            });

            var $spinner = $('<div class="video-loading-spinner"></div>');
            var spinnerTimeout = setTimeout(function () {
                $box.find(".thumbnail").prepend($spinner);
            }, 500);
            $box[0]._spinnerTimeout = spinnerTimeout;
            $box.find(".thumbnail").prepend($progressbar).prepend($controls).prepend(video);

            mouseX = event.offsetX;
            var duration = video.get(0).duration;
            var mouseTime = (duration * mouseX / $image.width());
            var width = mouseX / $image.width() * 100;

            // $progressbar.find(".current").width("calc(" + width + "%" + " - 2px)");
            // $progressbar.find(".current").width("calc(" + 1 + "%" + " - 2px)");

            updateVideoCursorInterval = setInterval(function () {
                if (!document.body.contains(video.get(0))) {
                    clearInterval(updateVideoCursorInterval);
                    return;
                }
                var currentTime = video.get(0).currentTime;
                var duration = video.get(0).duration;
                var percentage = currentTime / duration * 100;
                if (percentage > 1 || percentage < 100) {
                    $progressbar.find(".current").width("calc(" + percentage + "%" + " - 2px)");
                }
                $currentTime.html(getDurationString(currentTime, duration));
            }, 16);

            // mouseTime = Math.round(mouseTime * 100) / 100;

            // if (mouseTime) {
            //     video.get(0).muted = muted;
            //     video.get(0).currentTime = parseFloat(mouseTime);
            // }

            
            // TODO: 确定影片可以播放，在淡出
            var onPlaying = function() {
                video.get(0).removeEventListener("playing", onPlaying);
                clearTimeout(spinnerTimeout);
                $spinner.remove();
                $image.hide();
                video.show();
                video.get(0).muted = muted;
            };
            video.get(0).muted = muted;
            video.get(0).addEventListener("playing", onPlaying);

            // === MPV Fallback 機制 ===
            var nativeVideoEl = video.get(0);
            var hasFallenBack = false;
            var hoverFrameRendered = false;

            function fallbackToMpv() {
                if (hasFallenBack) return;
                if (!document.body.contains(nativeVideoEl) && !$box.hasClass('hover-active')) return;
                hasFallenBack = true;
                console.log("[video-hover-preview] Falling back to MPV player");

                // 暫停並移除原生 <video>
                try {
                    nativeVideoEl.pause();
                    nativeVideoEl.src = "";
                } catch (err) {}
                $(nativeVideoEl).remove();

                // 建立 <mpv-video> 元素（不設定 controls，不顯示 control bar）
                var mpvElement = document.createElement("mpv-video");
                mpvElement.src = $bodyScope.getRawUrl(image);
                mpvElement.autoplay = true;
                mpvElement.muted = muted;
                mpvElement.loop = true;
                mpvElement.volume = parseInt(volume) / 100;

                // 尺寸與原生 video 相同
                var $mpv = $(mpvElement);
                var ratio = image.width / image.height;
                var ratio2 = $image.width() / $image.height();
                if (ratio > ratio2) {
                    $mpv.height($image.height());
                } else {
                    $mpv.width($image.width());
                    $mpv.height($image.width() / ratio);
                }
                $mpv.hide();

                // 插入 DOM 相同位置
                $box.find(".thumbnail").prepend($mpv);

                // 更新 video jQuery 變數參考，讓 interval 和後續操作自動生效
                video = $mpv;

                // 綁定 playing 事件（顯示影片、隱藏縮圖）
                mpvElement.addEventListener("playing", function onMpvPlaying() {
                    mpvElement.removeEventListener("playing", onMpvPlaying);
                    clearTimeout(spinnerTimeout);
                    $spinner.remove();
                    $image.hide();
                    $mpv.show();
                    mpvElement.muted = muted;
                });

                // 重新綁定 mousemove 事件（滑鼠拖曳 seek）
                var autoPlayTimeout;
                var currentTimeTimeout;
                $mpv.on('mousemove', throttle(function (event) {
                    if (rectSelecting) return;
                    mouseX = event.offsetX;
                    var duration = mpvElement.duration;
                    var mouseTime = (duration * mouseX / $image.width());
                    var width = mouseX / $image.width() * 100;

                    $progressbar.find(".current").width("calc(" + width + "%" + " - 2px)");
                    $currentTime.addClass("show");
                    $controls.show();
                    clearTimeout(currentTimeTimeout);
                    currentTimeTimeout = setTimeout(() => {
                        $currentTime.removeClass("show");
                    }, 600);

                    mouseTime = Math.round(mouseTime * 100) / 100;
                    if (mouseTime && !isNaN(mouseTime) && isFinite(mouseTime)) {
                        mpvElement.currentTime = parseFloat(mouseTime);
                        mpvElement.pause();
                        clearTimeout(autoPlayTimeout);
                        autoPlayTimeout = setTimeout(function () {
                            try {
                                if (document.body.contains(mpvElement)) {
                                    mpvElement.play();
                                }
                            } catch (err) {}
                        }, 200);
                    }
                }, 50, true));

                // drag 事件
                $mpv.on('dragstart', function (event) {
                    event.preventDefault();
                    onDragStartContainer(event);
                });
                $mpv.on('drag', function () {
                    event.preventDefault();
                    onImageDrag(event);
                });
                $mpv.on('dragend', function () {
                    event.preventDefault();
                    onDragEndContainer(event);
                });
                $mpv.on('mouseover', function (event) {
                    event.stopPropagation();
                });
            }

            // Layer 1: error 事件 → 立即 fallback
            function onNativeVideoError(event) {
                if (!nativeVideoEl.error) return;
                // 忽略 cleanup 時 src='' 觸發的 Empty src error
                if (nativeVideoEl.error.message && nativeVideoEl.error.message.indexOf('Empty src') > -1) return;
                console.log("[video-hover-preview] Native video error code:", nativeVideoEl.error.code, nativeVideoEl.error.message);
                fallbackToMpv();
            }
            nativeVideoEl.addEventListener("error", onNativeVideoError);

            // Layer 2: loadedmetadata 檢查 → videoWidth/videoHeight 為 0 或 duration 異常
            nativeVideoEl.addEventListener("loadedmetadata", function () {
                if ((!nativeVideoEl.videoWidth && !nativeVideoEl.videoHeight) ||
                    !isFinite(nativeVideoEl.duration) || nativeVideoEl.duration <= 0) {
                    console.log("[video-hover-preview] Unplayable video (no dimensions or invalid duration), triggering fallback");
                    fallbackToMpv();
                    return;
                }

                // Layer 3: frame 渲染逾時 → 播放 1.5 秒後 requestVideoFrameCallback 未觸發
                if (typeof nativeVideoEl.requestVideoFrameCallback === 'function') {
                    nativeVideoEl.requestVideoFrameCallback(function () {
                        hoverFrameRendered = true;
                    });
                }
                setTimeout(function () {
                    if (!hoverFrameRendered && !hasFallenBack && !nativeVideoEl.paused) {
                        console.log("[video-hover-preview] No frames rendered after 1.5s, triggering fallback");
                        fallbackToMpv();
                    }
                }, 1500);
            });
            startHoverPreviewWatch($box);
        }
    }, 250);
});

$("#box-container").on('mouseleave', videoHoverSelector, removeBoxVideoPlayer);

function removeBoxVideoPlayer(event) {
    event.stopPropagation();
    var $scope = angular.element("body").scope();
    var $box = $(".box").has(this);
    disarmHoverSentinel($box);
    var image = $scope.getItemByElement($box[0]);

    if (!image) return;

    var $image = $box.find("img");

    // 悬停 500ms 在开始播放
    clearTimeout(mouseoverVideoTimeout);
    clearInterval(updateVideoCursorInterval);
    clearTimeout($box[0]._spinnerTimeout);
    $box.find(".video-loading-spinner").remove();
    $box.find(".video-progress-bar").remove();
    $box.find(".mute-toggle").off();
    $box.find(".controls").remove();
    var $videos = $box.find("video");
    if ($videos.length > 0) {
        $image.show();
            try { $videos[0].pause(); } catch (err) {}
            $videos.remove();
            try { $videos[0].src = ""; $videos[0].load(); } catch (err) {}
    }
    var $mpvVideos = $box.find("mpv-video");
    if ($mpvVideos.length > 0) {
        $image.show();
        try { $mpvVideos[0].destroy(); } catch (err) {}
        $mpvVideos.remove();
    }
}