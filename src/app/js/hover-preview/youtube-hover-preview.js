var youtubeMouseoverVideoTimeout;
var youtubeUpdateVideoCursorInterval;

// === YouTube postMessage API helpers ===
// 使用 postMessage 與 YouTube iframe 通訊，避免跨域 DOM 存取導致 renderer crash
var _ytPlayerState = {};

function ytPostCommand(iframe, func, args) {
    if (!iframe || !iframe.contentWindow) return;
    var msg = { event: 'command', func: func, args: args || [] };
    try {
        iframe.contentWindow.postMessage(JSON.stringify(msg), '*');
    } catch (err) {}
}

function _onYouTubeMessage(event) {
    if (!event.data) return;
    var data;
    if (typeof event.data === 'string') {
        try { data = JSON.parse(event.data); } catch (e) { return; }
    } else if (typeof event.data === 'object') {
        data = event.data;
    } else {
        return;
    }

    var state = _ytPlayerState;
    if (!state.active) return;

    // infoDelivery 包含 currentTime、duration、playerState 等
    if (data.event === 'infoDelivery' && data.info) {
        if (data.info.currentTime !== undefined) {
            state.currentTime = data.info.currentTime;
        }
        if (data.info.duration !== undefined && data.info.duration > 0) {
            state.duration = data.info.duration;
        }
        // playerState: 1=playing, 2=paused, 0=ended
        if (data.info.playerState !== undefined) {
            var prevState = state.playerState;
            state.playerState = data.info.playerState;
            // 第一次進入 playing 狀態代表影片已開始播放
            if (data.info.playerState === 1 && !state.hasPlayed) {
                state.hasPlayed = true;
                clearTimeout(state.spinnerTimeout);
                if (state.$spinner) state.$spinner.remove();
                if (state.$image) state.$image.hide();
                if (state.$iframeWrap) state.$iframeWrap.removeClass("hide");
            }
        }
    }

    // onStateChange 也是 YouTube 回報狀態的方式
    if (data.event === 'onStateChange' && data.info !== undefined) {
        state.playerState = data.info;
        if (data.info === 1 && !state.hasPlayed) {
            state.hasPlayed = true;
            clearTimeout(state.spinnerTimeout);
            if (state.$spinner) state.$spinner.remove();
            if (state.$image) state.$image.hide();
            if (state.$iframeWrap) state.$iframeWrap.removeClass("hide");
        }
    }
}

window.addEventListener('message', _onYouTubeMessage);

$("#box-container").on('mouseenter', '.box.url.youtube .thumbnail', function(event) {
    event.stopPropagation();

    if (rectSelecting) return;
    if ($bodyScope.preferences.video.hoverPlay === "false") return;

    let $scope = angular.element("body").scope();
    let $box = $(".box").has(this);
    let image = $scope.getItemByElement($box[0]);

    if (!image) return;

    clearTimeout(youtubeMouseoverVideoTimeout);
    clearInterval(youtubeUpdateVideoCursorInterval);
    youtubeMouseoverVideoTimeout = setTimeout(function () {

        var $iframeWrap = $box.find(".iframe-wrap");
        if ($iframeWrap.length > 0) {
            try { $iframeWrap.find("iframe")[0].src = ""; } catch (e) {}
            $iframeWrap.remove();
            return;
        }

        var $image = $box.find("img");
        $box.find(".video-progress-bar").remove();
        var $progressbar = $('<div class="video-progress-bar"><div class="current"></div><div class="current-time"></div></div>');
        var $currentTime = $progressbar.find(".current-time");
        var $muteToggle = $('<div class="mute-toggle"></div>');

        var $controls = $('<div class="controls"></div>');
        $controls.append($currentTime);
        $controls.append($muteToggle);
        $controls.hide();

        var muted = localStorage["eagle.list.video.muted"] != 'false';
        if (muted) {
            $muteToggle.addClass("muted");
        } else {
            $muteToggle.removeClass("muted");
        }

        var vq = "";
        if ($bodyScope.imageSize.height <= 400) {
            vq = "sd480";
        } else if ($bodyScope.imageSize.height <= 600) {
            vq = "hq720";
        } else {
            vq = "hq1080";
        }

        var mute = (muted) ? "1" : "0";
        // 加入 enablejsapi=1 啟用 postMessage API
        var src = `https://www.youtube-nocookie.com/embed/${image.videoID}?enablejsapi=1&autoplay=1&hd=1&vq=${vq}&controls=0&cc_load_policy=0&modestbranding=1&mute=${mute}`;
        var $iframeWrap = $(`<div class="iframe-wrap hide"><iframe src="${src}"></iframe></div>`);
        var $iframe = $iframeWrap.find("iframe");
        var iframe = $iframe[0];
        var $spinner = $('<div class="video-loading-spinner"></div>');

        // 初始化 postMessage 狀態
        _ytPlayerState = {
            active: true,
            iframe: iframe,
            $iframeWrap: $iframeWrap,
            $image: $image,
            $spinner: $spinner,
            currentTime: 0,
            duration: 0,
            playerState: -1,
            hasPlayed: false,
            muted: muted
        };

        var spinnerTimeout = setTimeout(function () {
            $box.find(".thumbnail").prepend($spinner);
        }, 500);
        $box[0]._spinnerTimeout = spinnerTimeout;
        _ytPlayerState.spinnerTimeout = spinnerTimeout;
        $box.find(".thumbnail").prepend($iframeWrap);
        startHoverPreviewWatch($box);

        // iframe 載入後透過 postMessage 開始監聽 infoDelivery
        $iframe.on("load", function () {
            setTimeout(function () {
                if (!iframe.contentWindow) return;
                $box.find(".thumbnail").prepend($progressbar).prepend($controls);

                // 發送 listening 訊息，讓 YouTube 開始回報 infoDelivery
                try {
                    iframe.contentWindow.postMessage(JSON.stringify({ event: 'listening' }), '*');
                } catch (err) {}

                // fallback：如果 infoDelivery 沒收到 playing 狀態，延遲顯示
                setTimeout(function () {
                    if (!_ytPlayerState.hasPlayed && _ytPlayerState.active) {
                        _ytPlayerState.hasPlayed = true;
                        clearTimeout(_ytPlayerState.spinnerTimeout);
                        $spinner.remove();
                        $image.hide();
                        $iframeWrap.removeClass("hide");
                    }
                }, 3000);
            }, 300);
        });

        // Drag 事件
        $iframeWrap.on('dragstart', function (event) {
            event.preventDefault();
            onDragStartContainer(event);
        });

        $iframeWrap.on('drag', function (event) {
            event.preventDefault();
            onImageDrag(event);
        });

        $iframeWrap.on('dragend', function (event) {
            event.preventDefault();
            onDragEndContainer(event);
        });

        $iframeWrap.on('mouseover', function (event) {
            event.stopPropagation();
        });

        // Mousemove seeking — 透過 postMessage 控制
        var autoPlayTimeout;
        var seekResumeTimeout;
        $iframeWrap.on('mousemove', throttle(function (event) {
            mouseX = event.offsetX;
            var duration = _ytPlayerState.duration;
            if (!duration || !isFinite(duration) || duration <= 0) return;

            var mouseTime = (duration * mouseX / $image.width());
            var width = mouseX / $image.width() * 100;

            // 標記正在 seeking，避免 interval 用舊位置覆蓋進度條
            _ytPlayerState.seeking = true;
            clearTimeout(seekResumeTimeout);

            $progressbar.find(".current").width("calc(" + width + "%" + " - 2px)");
            $controls.show();

            mouseTime = Math.round(mouseTime * 100) / 100;
            if (mouseTime && !isNaN(mouseTime) && isFinite(mouseTime)) {
                $currentTime.html(getDurationString(mouseTime, duration));
                ytPostCommand(iframe, 'seekTo', [parseFloat(mouseTime), true]);
                ytPostCommand(iframe, 'pauseVideo');
                clearTimeout(autoPlayTimeout);
                autoPlayTimeout = setTimeout(function () {
                    if (document.body.contains(iframe)) {
                        ytPostCommand(iframe, 'playVideo');
                    }
                    seekResumeTimeout = setTimeout(function () {
                        _ytPlayerState.seeking = false;
                    }, 500);
                }, 150);
            }
        }, 50, true));

        // 進度條更新 — 從 infoDelivery 的狀態讀取
        youtubeUpdateVideoCursorInterval = setInterval(function () {
            if (!document.body.contains(iframe)) {
                clearInterval(youtubeUpdateVideoCursorInterval);
                return;
            }
            if (_ytPlayerState.seeking) return;
            var currentTime = _ytPlayerState.currentTime;
            var duration = _ytPlayerState.duration;
            if (!duration) return;
            var percentage = currentTime / duration * 100;
            if (percentage >= 0 && percentage <= 100) {
                $progressbar.find(".current").width("calc(" + percentage + "%" + " - 2px)");
            }
            $currentTime.html(getDurationString(currentTime, duration));
        }, 16);

        // 靜音按鈕 — 透過 postMessage 控制
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
            event.stopPropagation();
            muted = !muted;
            _ytPlayerState.muted = muted;
            ytPostCommand(iframe, muted ? 'mute' : 'unMute');
            if (muted) {
                $muteToggle.addClass("muted");
            } else {
                $muteToggle.removeClass("muted");
            }
            localStorage.setItem("eagle.list.video.muted", muted);
        });

    }, 200);
});

$("#box-container").on('mouseleave', '.box.url.youtube .thumbnail', function(event) {
    event.stopPropagation();
    let $scope = angular.element("body").scope();
    let $box = $(".box").has(this);
    disarmHoverSentinel($box);
    let image = $scope.getItemByElement($box[0]);

    if (!image) return;

    let $image = $box.find("img");

    clearTimeout(youtubeMouseoverVideoTimeout);
    clearInterval(youtubeUpdateVideoCursorInterval);

    // 停用 postMessage 狀態
    _ytPlayerState.active = false;

    clearTimeout($box[0]._spinnerTimeout);
    $box.find(".video-loading-spinner").remove();
    $box.find(".video-progress-bar").remove();
    $box.find(".mute-toggle").off().remove();
    $box.find(".controls").remove();
    var $iframeWrap = $box.find(".iframe-wrap");
    if ($iframeWrap.length > 0) {
        $image.show();
        try {
            $iframeWrap.find("iframe")[0].src = "";
            $iframeWrap.remove();
        }
        catch (err) {}
    }
});