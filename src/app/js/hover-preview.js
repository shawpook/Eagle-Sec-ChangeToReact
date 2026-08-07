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
        var image = $bodyScope.getItemByElement(HoverPreview.lastElem.parentElement);
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
                var rawPath = $bodyScope.getRawUrl(image);
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

//     if (HoverPreviewKeydown) {
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
    if (HoverPreviewKeydown) {
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
    if ($bodyScope.preferences.habits.hoverZoom === "on") {
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
    if ($bodyScope.preferences.habits.hoverZoom === "on") {
        clearTimeout(HoverPreview.zoomBtnTimeout);
        if (HoverPreview.lastElem) {
            HoverPreview.hide();
        }
    }
});


var HoverPreviewKeydown = false;
$(window).on("keydown.hover-preview", function (event) {
    if (HoverPreviewKeydown || event.ctrlKey || event.metaKey || event.shiftKey) return;

    // Check the currently focused element
    const focusedElement = document.activeElement;
    const tagName = focusedElement.tagName.toLowerCase();

    // Check if the focused element is an input, textarea, select, or contenteditable
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || focusedElement.isContentEditable) {
        return;
    }

    if ($bodyScope.isDetailMode) return;
    
    if (event.keyCode === 90) {
        HoverPreviewKeydown = true;
        HoverPreview.show();
    }
});

$(window).on("keyup.hover-preview", function (event) {
    if (event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.keyCode === 90) {
        HoverPreviewKeydown = false;
        HoverPreview.hide();
    }
});