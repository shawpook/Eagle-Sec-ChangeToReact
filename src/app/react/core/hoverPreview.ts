/**
 * b1-9bu-A：/vendor/eagle-hover-preview.js 剥壳归位——悬浮预览家族逐字搬迁 install 化
 * （vendor 494 行全量 + js/hover-preview.js Z 键监听段回填——b1-9am 按函数选拼提取时
 * 绑定段落在区间外，Z 键悬停预览自 React 切换起死，b1-9aw 仅回填声明未到位；
 * 考据定案见 PROGRESS「P2-bu」。mouseoverAudioProgressTimeout 为提取片缺失声明补齐
 * （vendor:116 裸引用、全仓无声明，removeBoxAudioPlayer 一调用即 ReferenceError 的哑雷）。
 * 过渡期保留面：$ / FileUrlHelper / throttle 裸标识经 window（bundleGlobals 供给，bl 同款；
 * throttle 必须 bundle 2400 helper——签名 fn/delay/immediate，与 utils/func 版不同）；
 * $bodyScope / playingAudiosElements / HoverPreviewKeydown 显式 _w 前缀（跨世界共享存储：
 * openItemContextMenu 与 controllerFns 清理点同源）。vendor 脚本与 c16b fetch 注入/
 * if-absent 重复定义随本批退役；install 由 bundleGlobals 在 _throttle 挂载后同步调用。
 */
// @ts-nocheck

const _w: any = window as any;

let installed = false;

export function installHoverPreview(): void {
  if (installed) return;
  installed = true;

// b1-9aw：提取片缺失声明补齐（bundle 顶层 var 在原 script 内跨段共享；
// b1-9am 按函数选拼提取时声明行落在区间外——悬停即抛 ReferenceError、
// Z 键预览/hover sentinel 观察器全死。声明原文逐字回填）
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
var mouseoverAudioTimeout;
var updateCursorInterval;
var mouseoverAudioProgressTimeout;   // b1-9bu-A：提取片缺失声明补齐（vendor:116 裸引用全仓无声明）
_w.HoverPreviewKeydown = false;

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
    _w.playingAudiosElements = [];

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


function removePlayingAudios () {
    $('#box-container .box.hover-active').each(function () {
        cleanupBoxHoverPreview($(this));
    });
};


function removeBoxAudioPlayer (event) {
    
    if (event) {
        if (event.originalEvent) {
            if (!event.originalEvent.screenX || !event.originalEvent.screenY) {
                return;
            } 
        }
        event.stopPropagation();
    }

    // b1-9d：去 Angular 后 window.angular 缺席；_w.$bodyScope 即 bundle 世界同对象
    // （同 egjs-infinitegrid.umd.js 内 Eagle 自有写法），bundle 在世时语义零改变。
    var $scope = _w.$bodyScope || angular.element("body").scope();
    var $box = $(".box").has(event.target);
    disarmHoverSentinel($box);
    var image = $scope.getItemByElement($box[0]);

    if (!image) return;

    var $image = $box.find("img");

    // 悬停 500ms 在开始播放
    clearTimeout(mouseoverAudioTimeout);
    clearTimeout(mouseoverAudioProgressTimeout);
    clearInterval(updateCursorInterval);
    $image.off('mousedown.duration').off('mousemove.progressCursor');
    $box.find(".current-time").remove();
    $box.find(".audio-progress-bar").off().remove();
    $box.find(".audio-progress-bar-cursor").remove();
    $box.find(".autoplay-toggle").off();
    $box.find(".controls").remove();

    if (_w.playingAudiosElements.length > 0) {
        _w.playingAudiosElements.forEach(function (audio) {
            audio.pause();
            audio.src = "";
            $(audio).remove();
        });
        _w.playingAudiosElements = [];
    }
}


var HoverPreview = {
    isShow: false,
    lastElem: undefined,
    keyupTimeout: undefined,
    zoomBtnTimeout: undefined,
    loadRawTimeout: undefined,
    showTimeout: undefined,
    $container: $("#hover-preview-container"),
    // 預設延遲時間（毫秒）
    defaultDelay: 200,
    // 獲取元素對應的延遲時間
    // 優先檢查元素的 data-hover-delay 屬性，如果沒有則使用預設值
    getDelay: function(element) {
        var $element = $(element);
        // 先檢查元素本身或其父元素是否有 data-hover-delay 屬性
        var delayAttr = $element.attr('data-hover-delay') || $element.closest('[data-hover-delay]').attr('data-hover-delay');
        if (delayAttr) {
            var delay = parseInt(delayAttr, 10);
            if (!isNaN(delay) && delay >= 0) {
                return delay;
            }
        }
        return this.defaultDelay;
    },
    show: function (event) {
        if (!HoverPreview.lastElem) return;
        if (HoverPreview.isShow) return;
        if ($("input:focus").length > 0) { return; }
        HoverPreview.isShow = true;
        clearTimeout(HoverPreview.loadRawTimeout);
        clearTimeout(HoverPreview.showTimeout);
        var $hoverImage = HoverPreview.$container.find("img");
        var $imageWraper = HoverPreview.$container.find(".image-wraper");
        var image = _w.$bodyScope.getItemByElement(HoverPreview.lastElem.parentElement);
        if (image.noPreview) return;
        var thumbnailPath = FileUrlHelper.getLastestThumbnailUrl(image);
        var offset = $(HoverPreview.lastElem).offset();
        var x = offset.left;
        var y = offset.top;
        var width = Math.min(480, image.width);
        var height = Math.min(480, image.height);
        var boxWidth = $(HoverPreview.lastElem).width();
        var windowWidth = $(window).width() - 20;
        var windowHeight = $(window).height() - 20;
        var boxHeight = Math.min($(HoverPreview.lastElem).height(), windowHeight);
        var imageX = 0;
        var imageY = 0;
        var imageWidth = 0;
        var imageHeight = 0;

        var getMaxImageSizeRatio = function (w1, h1, w2, h2) {
            if (w2 > w1 && h2 > h1) return 1;
            var ratio;
            if (w2 < h2) {
                ratio = h1/h2;
            }
            else {
                ratio = w1/w2;
            }
            return ratio;
        }

        var rotateString = "";
        // if (image.orientation) {
        //     switch (image.orientation) {
        //         case 8:
        //             rotateString = "rotate(-90deg)"
        //             break;
        //         case 7:
        //             rotateString = "rotate(-270deg) scaleX(-1)"
        //             break;
        //         case 6:
        //             rotateString = "rotate(90deg)"
        //             break;
        //         case 5:
        //             rotateString = "rotate(270deg) scaleX(-1)"
        //             break;
        //         case 4:
        //             rotateString = "scaleY(-1)"
        //             break;
        //         case 3:
        //             rotateString = "scaleX(-1) scaleY(-1)"
        //             break;
        //         case 2:
        //             rotateString = "scaleX(-1)"
        //             break;
        //     }
        // }

        $hoverImage.attr("src", thumbnailPath);

        // 计算上下左右哪一个区域，图片可以最大呈现
        var topArea = { name: "top", x: 0, y: 0, w: windowWidth, h: y };
        var bottomArea = { name: "bottom", x: 0, y: y + boxHeight, w: windowWidth, h: windowHeight - y - boxHeight };
        var leftArea = { name: "left", x: 0, y: 0, w: x, h: windowHeight };
        var rightArea = { name: "right", x: x + boxWidth, y: 0, w: windowWidth - boxWidth - x, h: windowHeight };

        var maxDisplayWidthArea;
        var maxDisplayHeightArea;
        var finalArea;

        if (topArea.h > bottomArea.h) {
            maxDisplayWidthArea = topArea;
        }
        else {
            maxDisplayWidthArea = bottomArea;
        }

        if (leftArea.w > rightArea.w) {
            maxDisplayHeightArea = leftArea;
        }
        else {
            maxDisplayHeightArea = rightArea;
        }

        var ratioW = getMaxImageSizeRatio(image.width, image.height, maxDisplayWidthArea.w, maxDisplayWidthArea.h);
        var ratioH = getMaxImageSizeRatio(image.width, image.height, maxDisplayHeightArea.w, maxDisplayHeightArea.h);

        // console.log(`${maxDisplayWidthArea.name}: ${ratioW}`);
        // console.log(`${maxDisplayHeightArea.name}: ${ratioH}`);

        // 相同时，偏好左右，除非元件在画面外
        if (ratioW === ratioH) {
            // 偏好上下
            if (y < 0 || y + boxHeight > windowHeight) { 
                finalArea = maxDisplayWidthArea; 
                finalArea.ratio = ratioW;
            }
            // 默认左右
            else { 
                finalArea = maxDisplayHeightArea; 
                finalArea.ratio = ratioW;
            }
        }
        else if (ratioW > ratioH) { 
            if (maxDisplayWidthArea.name === "top" && y - image.height * ratioW < 0) {
                finalArea = maxDisplayHeightArea; finalArea.ratio = ratioH;
            }
            else if (maxDisplayWidthArea.name === "bottom" && y + boxHeight + image.height * ratioW > windowHeight) {
                finalArea = maxDisplayHeightArea; finalArea.ratio = ratioH;
            }
            else {
                finalArea = maxDisplayWidthArea; 
                finalArea.ratio = ratioW; 
            }
        }
        else { finalArea = maxDisplayHeightArea; finalArea.ratio = ratioH; }

        // console.log(`在 ${finalArea.name} 呈现`);

        // 上下的左右对齐逻辑
        // x 轴一律置图片中心点对齐，然后把超过的部分抓回来
        // 图靠上，y 轴位置 = 当前缩图 y - 放大后图片高
        // 图靠下，y 轴位置 = 当前缩图 y + 缩图高
        // finalArea.ratio = Math.min(finalArea.ratio, 1);
        var transform;
        if (finalArea.name === "top") {
            imageWidth = Math.min(finalArea.w, image.width);
            imageHeight = Math.min(finalArea.h, imageWidth / image.width * image.height, image.height);
            imageWidth = Math.min(finalArea.w, imageHeight / image.height * image.width);
            transform = `translateX(${imageX}px) translateY(${imageY + 10}px) ${rotateString}`;
        }
        else if (finalArea.name === "bottom") {
            imageWidth = Math.min(finalArea.w, image.width);
            imageHeight = Math.min(finalArea.h, imageWidth / image.width * image.height, image.height);
            imageWidth = Math.min(finalArea.w, imageHeight / image.height * image.width);
            transform = `translateX(${imageX}px) translateY(${imageY - 10}px) ${rotateString}`;
        }

        // 左右的左右对齐逻辑
        // y 轴一律置图片中心点对齐，然后把超过的部分抓回来
        // 图靠左，x 轴位置 = 当前缩图 x - 放大后图片宽
        // 图靠右，x 轴位置 = 当前缩图 x + 缩图宽
        else if (finalArea.name === "left") {
            imageHeight = Math.min(finalArea.h, image.height);
            imageWidth = Math.min(finalArea.w, imageHeight / image.height * image.width, image.width);
            imageWidth += (boxWidth*1/1 - 10);
            imageWidth = Math.min(imageWidth, image.width);
            imageHeight = Math.min(finalArea.h, imageWidth / image.width * image.height);
            imageWidth = imageHeight / image.height * image.width;
            // imageHeight = Math.min(imageHeight, imageWidth / image.width * image.height);
            transform = `translateX(${imageX + 10}px) translateY(${imageY}px) ${rotateString}`;
        }
        else if (finalArea.name === "right") {
            imageHeight = Math.min(finalArea.h, image.height);
            imageWidth = Math.min(finalArea.w, imageHeight / image.height * image.width, image.width);
            imageWidth += (boxWidth*1/1 - 10);
            imageWidth = Math.min(imageWidth, image.width);
            imageHeight = Math.min(finalArea.h, imageWidth / image.width * image.height);
            imageWidth = imageHeight / image.height * image.width;
            // imageWidth = Math.min(finalArea.w, imageHeight / image.height * image.width, image.width);
            // imageHeight = Math.min(imageHeight, imageWidth / image.width * image.height);
            transform = `translateX(${imageX - 10}px) translateY(${imageY}px) ${rotateString}`;
        }

        if (x + boxWidth*1/2 > windowWidth / 2) {
            imageX = x - imageWidth - 15 + boxWidth*1/1;
        }
        else {
            imageX = x  + 15;
        }

        if (y > windowHeight / 2) {
            imageY = y + Math.min(boxHeight*1/4, 20);
        }
        else {
            imageY = y + Math.min(boxHeight*1/4, 20);
        }

        if (finalArea.name === "top") {
            imageY = y + Math.min(boxHeight*1/4, 20) - imageHeight;
            imageX = x;
        }
        else if (finalArea.name === "bottom") {
            imageY = y + Math.min(boxHeight*1/4, 20);
            imageX = x;
        }

        var ofy;
        if (imageY + imageHeight > windowHeight) {
            ofy = (imageY + imageHeight) - windowHeight;
            imageY -= ofy;
            imageY += 10;
        }
        else if (imageY < 0) {
            imageY = 10;
        }

        var ofx;
        if (imageX + imageWidth > windowWidth) {
            ofx = (imageX + imageWidth) - windowWidth;
            imageX -= ofx;
            imageX += 10;
        }
        else if (imageX < 0) {
            imageX = 10;
        }

        if (finalArea.name === "top") {
            transform = `translateX(${imageX}px) translateY(${imageY}px) ${rotateString}`;
        }
        else if (finalArea.name === "bottom") {
            transform = `translateX(${imageX}px) translateY(${imageY}px) ${rotateString}`;
        }
        else if (finalArea.name === "left") {
            transform = `translateX(${imageX}px) translateY(${imageY}px) ${rotateString}`;
        }
        else if (finalArea.name === "right") {
            transform = `translateX(${imageX}px) translateY(${imageY}px) ${rotateString}`;
        }

        $hoverImage.css({
            height: parseInt(imageHeight),
            // transform: transform,
            // opacity: 0,
        });

        var loadRaw = function () {
            clearTimeout(HoverPreview.loadRawTimeout);
            HoverPreview.loadRawTimeout = setTimeout(function () {
                var rawPath = _w.$bodyScope.getRawUrl(image);
                var img = new Image();
                img.onload = function() {
                    $hoverImage.attr("src", rawPath);
                };
                img.src = rawPath;
            }, 50);
        }

        if ("avif gif webp png jpg jpeg bmp ico jfif".indexOf(image.ext) > -1 ) {
            if (image.width * image.height < 56000000 && (!image.noThumbnail || (imageWidth > 800 || imageHeight > 800)) ) {
                console.log("loadRaw");
                loadRaw();
            }
        }
        HoverPreview.$container.addClass("show");
        HoverPreview.showTimeout = setTimeout(function () {
            $hoverImage.css({
                transform: `translateX(${imageX}px) translateY(${imageY}px) ${rotateString}`,
                opacity: 1,
            });
        }, 50);
    },
    hide: function () {
        clearTimeout(HoverPreview.showTimeout);
        HoverPreview.isShow = false;
        if (HoverPreview.$container.hasClass("show")) {
            HoverPreview.$container.removeClass("show");
            HoverPreview.$container.find("img").css({
                opacity: 0,
            });
        }
    }
};

// $("#box-container").on('mouseover', '.box .thumbnail', function(event) {
//     clearTimeout(HoverPreview.keyupTimeout);
//     HoverPreview.lastElem = this;

//     if (_w.HoverPreviewKeydown) {
//         HoverPreview.show();
//         return;
//     }
// });

// $("#box-container").on('mouseleave', '.box .thumbnail', function(event) {
//     if (HoverPreview.lastElem) {
//         HoverPreview.hide();
//     }
//     HoverPreview.lastElem = undefined;
// });

$("body").on('mouseover', '.box', throttle(function(event) {
    event.stopPropagation();
    clearTimeout(HoverPreview.keyupTimeout);
    let thumbnail = $(this).find(".thumbnail")[0];
    HoverPreview.lastElem = thumbnail;
    if (_w.HoverPreviewKeydown) {
        HoverPreview.show();
        return;
    }
}, 200, true));

$("body").on('mouseleave', '.box', throttle(function(event) {
    event.stopPropagation();
    if (HoverPreview.lastElem) {
        HoverPreview.hide();
    }
    // HoverPreview.lastElem = undefined;
}, 200, true));


$("body").on('mouseover', '.box .thumbnail .zoom-btn', function(event) {
    if (_w.$bodyScope.preferences.habits.hoverZoom === "on") {
        clearTimeout(HoverPreview.zoomBtnTimeout);
        
        // 找到包含 data-box-id 的父元素（處理不同 DOM 結構）
        var $box = $(this).closest('.box[data-box-id]');
        HoverPreview.lastElem = ($box.length > 0 ? $box.find(".thumbnail")[0] : null) || this.parentElement;
        
        // 根據元素所在場景獲取對應的延遲時間
        var delay = HoverPreview.getDelay(this);
        
        HoverPreview.zoomBtnTimeout = setTimeout(function () {
            HoverPreview.show();
        }, delay);
    }
});

$("body").on('mouseleave', '.box .thumbnail .zoom-btn', function(event) {
    if (_w.$bodyScope.preferences.habits.hoverZoom === "on") {
        clearTimeout(HoverPreview.zoomBtnTimeout);
        if (HoverPreview.lastElem) {
            HoverPreview.hide();
        }
    }
});




// ── b1-9bu-A：Z 键监听回填（js/hover-preview.js 361-387 逐字；b1-9am 提取片缺失段，
// Z 键悬停预览自 React 切换起死——本段即复活路径；$bodyScope/HoverPreviewKeydown → _w）──
$(window).on("keydown.hover-preview", function (event) {
    if (_w.HoverPreviewKeydown || event.ctrlKey || event.metaKey || event.shiftKey) return;

    // Check the currently focused element
    const focusedElement = document.activeElement;
    const tagName = focusedElement.tagName.toLowerCase();

    // Check if the focused element is an input, textarea, select, or contenteditable
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || focusedElement.isContentEditable) {
        return;
    }

    if (_w.$bodyScope.isDetailMode) return;
    
    if (event.keyCode === 90) {
        _w.HoverPreviewKeydown = true;
        HoverPreview.show();
    }
});

$(window).on("keyup.hover-preview", function (event) {
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.keyCode === 90) {
        _w.HoverPreviewKeydown = false;
        HoverPreview.hide();
    }
});




// ── b1-9bu-B：video/audio 悬停播放复活 ─────────────────────────────────
// video-hover-preview.js 78-84/86-475 + audio-hover-preview.js 7-167/169（b1-9s 误删，
// git e8afdfc^ 取回）逐字搬迁。angular.element → _w.$bodyScope（b1-9d 同款）；drag
// 三兄弟 → _w.?.（onDragStartContainer 族 React 世界尚未供给——网格拖拽独立缺口另批，
// preventDefault 先行保证悬停视频拖拽阻断语义）；mouseX bundle 隐式全局显式化；
// videoHelper/getDurationString → _w（bundleGlobals 本批供给）。
// ── disarmHoverSentinel（video-hover-preview.js 78-84 逐字；vendor 提取片缺失，
// 本模块 removeBoxAudioPlayer 裸调用的哑雷随本批拆除）──

function disarmHoverSentinel($box) {
    $box.removeClass('hover-active');
    $box.find('.hover-sentinel').each(function () {
        hoverPreviewObserver.unobserve(this);
        $(this).remove();
    });
}

var mouseX;   // bundle 隐式全局显式化（strict 模式裸赋值即炸）

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
    if (_w.$bodyScope.preferences.video.hoverPlay === "false") return;

    var $scope = _w.$bodyScope;   // b1-9bu-B：去 Angular（b1-9d 同款——_w.$bodyScope 即 bundle 世界同对象）
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
            src: _w.$bodyScope.getRawUrl(image),
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
                _w.onDragStartContainer?.(event);
            });

            video.on('drag', function () {
                event.preventDefault();
                _w.onImageDrag?.(event);
            });

            video.on('dragend', function () {
                event.preventDefault();
                _w.onDragEndContainer?.(event);
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
                    _w.videoHelper.setCurrentTime(video.get(0), parseFloat(mouseTime));
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
                $currentTime.html(_w.getDurationString(currentTime, duration));
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
                mpvElement.src = _w.$bodyScope.getRawUrl(image);
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
                    _w.onDragStartContainer?.(event);
                });
                $mpv.on('drag', function () {
                    event.preventDefault();
                    _w.onImageDrag?.(event);
                });
                $mpv.on('dragend', function () {
                    event.preventDefault();
                    _w.onDragEndContainer?.(event);
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
    var $scope = _w.$bodyScope;   // b1-9bu-B：去 Angular（b1-9d 同款——_w.$bodyScope 即 bundle 世界同对象）
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

// ── audio 悬停播放（audio-hover-preview.js 7-167/169 逐字）──
$("#box-container").on('mouseenter', '.box.mp3 .thumbnail, .box.wav .thumbnail, .box.flac .thumbnail, .box.ogg .thumbnail, .box.aac .thumbnail, .box.m4a .thumbnail', function(event) {
    event.stopPropagation();

    // if (dragging) return;
    if (rectSelecting) return;
    if (event.which === 1) return;

    var $scope = _w.$bodyScope;   // b1-9bu-B：去 Angular（b1-9d 同款——_w.$bodyScope 即 bundle 世界同对象）
    var $box = $(".box").has(this);
    var image = $scope.getItemByElement($box[0]);

    if (!image) return;
    if (image.noPreview) return;

    // 悬停 500ms 在开始播放
    clearTimeout(mouseoverAudioTimeout);
    mouseoverAudioTimeout = setTimeout(function () {
        var $audios = $box.find("audio");
        if ($audios.length > 0) {
            return;
            $audios[0].pause();
            $audios[0].src = "";
            $audios.remove();
        }
        var $image = $box.find("img");

        var $autoPlayBtn = $('<div class="autoplay-toggle"></div>');
        var autoplay = localStorage["listAudioAutoPlay"] != 'false';
        if (autoplay) {
            $autoPlayBtn.addClass("pause");
        }
        else {
            $autoPlayBtn.removeClass("pause");
        }
        console.log(autoplay);

        var imageWidth = $image.width();
        var imageHeight = $image.height();
        var src = $image.attr("src");
        var imageDir = `${_w.$bodyScope.libraryPath.replace(/#/g, '%23')}/images/`
        $box.find(".audio-progress-bar").remove();
        $box.find(".current-time").remove();
        var $progressbar = $(`<div class="audio-progress-bar"><img src="${src}" style="height: ${imageHeight}px !important; width: ${imageWidth}px !important;"/></div>`);
        var $currentTime = $(`<div class="current-time">00:00</div>`);
        var $progressbarCurosr = $(`<div class="audio-progress-bar-cursor"></div>`);
        var audio = $('<audio/>', {
            id: 'audio',
            src: _w.$bodyScope.getRawUrl(image),
            type: 'audio/' + image.ext,
            controls: false,
            autoplay: autoplay,
            // muted: muted,
            draggable: true,
            loop: false
        });

        var $controls = $('<div class="controls"></div>');
        $controls.append($currentTime);
        $controls.append($autoPlayBtn);
        
        var volume = localStorage.getItem("eagle.videoPlayer.volume") || 100;
        audio[0].volume = parseInt(volume) / 100;

        _w.playingAudiosElements.push(audio[0]);

        if ($box.find("audio").length === 0) {

            $autoPlayBtn.on("mouseover", function (event) {
                event.stopPropagation();
            });

            $autoPlayBtn.on("mousedown", function (event) {
                event.stopPropagation();
            });

            $autoPlayBtn.on("dblclick", function (event) {
                event.stopPropagation();
            });

            $autoPlayBtn.on("click", function (event) {
                console.log("click");
                event.stopPropagation();
                // audio.get(0).muted = !audio.get(0).muted;
                // muted = audio.get(0).muted;
                if (!audio[0].paused) {
                    audio[0].pause();
                    $autoPlayBtn.removeClass("pause");
                    autoplay = false;
                }
                else {
                    audio[0].play();
                    $autoPlayBtn.addClass("pause");
                    autoplay = true;
                }
                localStorage.setItem("listAudioAutoPlay", autoplay);
            });

            $box.find(".thumbnail").prepend($controls);

            audio.on('ended', function() {
                var delay = setTimeout(function(){
                    this.currentTime = 0;
                    audio[0].play();
                    clearTimeout(delay);
                }, 200);
            });

            audio.on('playing', function() {
                mouseoverAudioProgressTimeout = setTimeout(function () {
                    $box.find(".thumbnail").prepend($progressbar).prepend($progressbarCurosr);
                    $image.on('mousemove.progressCursor', function (event) {
                        var mouseX = event.offsetX;
                        $progressbarCurosr.css({
                            left: `${mouseX}px`
                        });
                    });
                    setTimeout(function () {
                        $image.on('mousedown.duration', function (event) {
                            var mouseX = event.offsetX;
                            var duration = audio.get(0).duration;
                            var mouseTime = (duration * mouseX / $image.width());
                            if (Number.isFinite(mouseTime) && mouseTime > 0) {
                                audio.get(0).currentTime = mouseTime;
                            }
                        });
                    }, 300);
                }, 100);
            });

            // audio.on('ended', function () {
            //     audio.get(0).currentTime = 0;
            //     setTimeout(function () {
            //         audio.get(0).play();
            //     }, 200);
            // });

            updateCursorInterval = setInterval(function () {
                if (!document.body.contains(audio.get(0))) {
                    clearInterval(updateCursorInterval);
                    return;
                }
                var currentTime = audio.get(0).currentTime;
                var duration = audio.get(0).duration;
                var percentage = currentTime / duration * 100;
                if (percentage > 1 || percentage < 100) {
                    $progressbar.width(percentage + "%");
                }
                else {
                    $progressbar.width("0%");
                }
                $currentTime.html(_w.getDurationString(currentTime, duration));
            }, 16);

            $box.find(".thumbnail").prepend(audio);
            startHoverPreviewWatch($box);
        }
    }, 200);
});

$("#box-container").on('mouseleave', '.box.mp3 .thumbnail, .box.wav .thumbnail, .box.flac .thumbnail, .box.ogg .thumbnail, .box.aac .thumbnail, .box.m4a .thumbnail', removeBoxAudioPlayer);
$("#box-container").on('dragstart', '.box.mp3 .thumbnail, .box.wav .thumbnail, .box.flac .thumbnail, .box.ogg .thumbnail, .box.aac .thumbnail, .box.m4a .thumbnail', removeBoxAudioPlayer);

currentWindow.on('hide', removePlayingAudios);   // b1-9bu-B：窗口隐藏即停播（audio-hover-preview.js 169 逐字）
// ── window facade（classic script 顶层声明→window 属性语义等价；消费点零改动：
// dataMachinery w.HoverPreview/w.removePlayingAudios、itemMenuService removePlayingAudios、
// controllerFns HoverPreview.isShow/HoverPreviewKeydown、gridDirectives delete lastElem）──
_w.cleanupBoxHoverPreview = cleanupBoxHoverPreview;
_w.startHoverPreviewWatch = startHoverPreviewWatch;
_w.removePlayingAudios = removePlayingAudios;
_w.removeBoxAudioPlayer = removeBoxAudioPlayer;
_w.HoverPreview = HoverPreview;
}
