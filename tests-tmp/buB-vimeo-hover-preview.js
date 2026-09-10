var vimeoMouseoverVideoTimeout;
var vimeoUpdateVideoCursorInterval;

// === Vimeo postMessage API helpers ===
// 使用 postMessage 與 Vimeo iframe 通訊，避免跨域 DOM 存取導致 renderer crash
var _vimeoPlayerState = {};

function vimeoPostMessage(iframe, method, value) {
    if (!iframe || !iframe.contentWindow) return;
    var data = { method: method };
    if (value !== undefined) data.value = value;
    try {
        iframe.contentWindow.postMessage(JSON.stringify(data), '*');
    } catch (err) {}
}

function _onVimeoMessage(event) {
    if (!event.data || typeof event.data !== 'string') return;
    // 只處理來自 Vimeo 的訊息
    if (event.origin && !/^https?:\/\/player\.vimeo\.com/.test(event.origin)) return;
    var data;
    try { data = JSON.parse(event.data); } catch (e) { return; }

    var state = _vimeoPlayerState;
    if (!state.active) return;

    if (data.event === 'ready') {
        // 播放器就緒，註冊事件監聽
        vimeoPostMessage(state.iframe, 'addEventListener', 'playProgress');
        vimeoPostMessage(state.iframe, 'addEventListener', 'pause');
        vimeoPostMessage(state.iframe, 'addEventListener', 'play');
        vimeoPostMessage(state.iframe, 'addEventListener', 'finish');
    }

    if (data.event === 'playProgress' && data.data) {
        state.currentTime = data.data.seconds || 0;
        state.duration = data.data.duration || 0;
        state.percent = data.data.percent || 0;

        // 第一次收到 playProgress 代表影片已開始播放
        if (!state.hasPlayed) {
            state.hasPlayed = true;
            clearTimeout(state.spinnerTimeout);
            if (state.$spinner) state.$spinner.remove();
            if (state.$image) state.$image.hide();
            if (state.$iframeWrap) state.$iframeWrap.removeClass("hide");
        }
    }

    if (data.method === 'getDuration') {
        state.duration = data.value || 0;
    }
}

window.addEventListener('message', _onVimeoMessage);

$("#box-container").on('mouseenter', '.box.url.vimeo .thumbnail', function(event) {
    event.stopPropagation();

    if (rectSelecting) return;
    if ($bodyScope.preferences.video.hoverPlay === "false") return;

    let $scope = angular.element("body").scope();
    let $box = $(".box").has(this);
    let image = $scope.getItemByElement($box[0]);

    if (!image) return;

    clearTimeout(vimeoMouseoverVideoTimeout);
    clearInterval(vimeoUpdateVideoCursorInterval);
    vimeoMouseoverVideoTimeout = setTimeout(function () {

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

        var quality = "";
        if ($bodyScope.imageSize.height <= 480) {
            quality = "240p";
        } else {
            quality = "360p";
        }

        var mute = (muted) ? "1" : "0";
        // 加入 api=1 以啟用 postMessage API，使用 player_id 識別播放器
        var playerId = 'vimeo-hover-' + image.videoID;
        var src = `https://player.vimeo.com/video/${image.videoID}?api=1&player_id=${playerId}&autoplay=1&controls=0&muted=${mute}&quality=${quality}&title=0`;
        var $iframeWrap = $(`<div class="iframe-wrap hide"><iframe src="${src}" id="${playerId}"></iframe></div>`);
        var $iframe = $iframeWrap.find("iframe");
        var iframe = $iframe[0];
        var $spinner = $('<div class="video-loading-spinner"></div>');

        // 初始化 postMessage 狀態
        _vimeoPlayerState = {
            active: true,
            iframe: iframe,
            $iframeWrap: $iframeWrap,
            $image: $image,
            $spinner: $spinner,
            currentTime: 0,
            duration: 0,
            percent: 0,
            hasPlayed: false,
            muted: muted
        };

        var spinnerTimeout = setTimeout(function () {
            $box.find(".thumbnail").prepend($spinner);
        }, 500);
        $box[0]._spinnerTimeout = spinnerTimeout;
        _vimeoPlayerState.spinnerTimeout = spinnerTimeout;
        $box.find(".thumbnail").prepend($iframeWrap);
        startHoverPreviewWatch($box);

        // iframe 載入後透過 postMessage 取得 duration
        $iframe.on("load", function () {
            setTimeout(function () {
                if (!iframe.contentWindow) return;
                $box.find(".thumbnail").prepend($progressbar).prepend($controls);

                // 請求 duration
                vimeoPostMessage(iframe, 'getDuration');

                // 等一小段時間後如果 playProgress 沒收到，用 fallback 顯示
                setTimeout(function () {
                    if (!_vimeoPlayerState.hasPlayed && _vimeoPlayerState.active) {
                        _vimeoPlayerState.hasPlayed = true;
                        clearTimeout(_vimeoPlayerState.spinnerTimeout);
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
            var duration = _vimeoPlayerState.duration;
            if (!duration || !isFinite(duration) || duration <= 0) return;

            var mouseTime = (duration * mouseX / $image.width());
            var width = mouseX / $image.width() * 100;

            // 標記正在 seeking，避免 interval 用舊的 playProgress 位置覆蓋進度條
            _vimeoPlayerState.seeking = true;
            clearTimeout(seekResumeTimeout);

            $progressbar.find(".current").width("calc(" + width + "%" + " - 2px)");
            $controls.show();

            mouseTime = Math.round(mouseTime * 100) / 100;
            if (mouseTime && !isNaN(mouseTime) && isFinite(mouseTime)) {
                $currentTime.html(getDurationString(mouseTime, duration));
                vimeoPostMessage(iframe, 'setCurrentTime', parseFloat(mouseTime));
                vimeoPostMessage(iframe, 'pause');
                clearTimeout(autoPlayTimeout);
                autoPlayTimeout = setTimeout(function () {
                    if (document.body.contains(iframe)) {
                        vimeoPostMessage(iframe, 'play');
                    }
                    // 恢復播放後延遲解除 seeking，等 playProgress 追上新位置
                    seekResumeTimeout = setTimeout(function () {
                        _vimeoPlayerState.seeking = false;
                    }, 500);
                }, 150);
            }
        }, 50, true));

        // 進度條更新 — 使用 postMessage state 而非直接讀取 video DOM
        // seeking 期間跳過更新，避免與 mousemove 設定的位置互相衝突造成閃爍
        vimeoUpdateVideoCursorInterval = setInterval(function () {
            if (!document.body.contains(iframe)) {
                clearInterval(vimeoUpdateVideoCursorInterval);
                return;
            }
            if (_vimeoPlayerState.seeking) return;
            var currentTime = _vimeoPlayerState.currentTime;
            var duration = _vimeoPlayerState.duration;
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
            _vimeoPlayerState.muted = muted;
            vimeoPostMessage(iframe, 'setVolume', muted ? 0 : 1);
            if (muted) {
                $muteToggle.addClass("muted");
            } else {
                $muteToggle.removeClass("muted");
            }
            localStorage.setItem("eagle.list.video.muted", muted);
        });

    }, 200);
});

$("#box-container").on('mouseleave', '.box.url.vimeo .thumbnail', function(event) {
    event.stopPropagation();
    let $scope = angular.element("body").scope();
    let $box = $(".box").has(this);
    disarmHoverSentinel($box);
    let image = $scope.getItemByElement($box[0]);

    if (!image) return;

    let $image = $box.find("img");

    clearTimeout(vimeoMouseoverVideoTimeout);
    clearInterval(vimeoUpdateVideoCursorInterval);

    // 停用 postMessage 狀態
    _vimeoPlayerState.active = false;

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