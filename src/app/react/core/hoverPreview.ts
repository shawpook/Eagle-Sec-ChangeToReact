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


// ── window facade（classic script 顶层声明→window 属性语义等价；消费点零改动：
// dataMachinery w.HoverPreview/w.removePlayingAudios、itemMenuService removePlayingAudios、
// controllerFns HoverPreview.isShow/HoverPreviewKeydown、gridDirectives delete lastElem）──
_w.cleanupBoxHoverPreview = cleanupBoxHoverPreview;
_w.startHoverPreviewWatch = startHoverPreviewWatch;
_w.removePlayingAudios = removePlayingAudios;
_w.removeBoxAudioPlayer = removeBoxAudioPlayer;
_w.HoverPreview = HoverPreview;
}
