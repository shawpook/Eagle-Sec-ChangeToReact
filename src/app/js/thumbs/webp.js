const fs = require('fs');
const appRoot = require('app-root-path');
const nativeThumb = require(appRoot.path + '/app/js/utils/nativeThumb.js');
const URL_MODULE = require(appRoot + '/my_modules/url');
const { ipcRenderer } = require('electron');
const EagleConfig = require(appRoot + '/config.js');
const NO_THUMBNAIL_SIZE = EagleConfig.NO_THUMBNAIL_SIZE || 1440;

module.exports = async ({ src, dest, item }) => {
    return new Promise(async (resolve, reject) => {
        try {
            let result;
            try {
                result = await webp2image(src, dest);
            }
            catch (err) {
                try {
                    result = await nativeThumb.async({ src: src, dest: dest, size: 480, item: item });
                    if (!fs.existsSync(dest)) {
                        return reject(new Error(`Can not generate tga file with native method.`));
                    }
                    item.width = result.width;
                    item.height = result.height;
                }
                catch (err) {
                    return reject(err);
                }
            }
            
            // 無法產生縮圖時，改用 native 方式處理
            if (!result.noThumbnail && !fs.existsSync(dest)) {
                return reject(new Error(`WebP thumbnail generate fail.`));
            }

            if (result.animated) { item.animated = true; }
            if (result.noThumbnail) {
                item.noThumbnail = true;
            }
            else {
                delete item.noThumbnail;
            }

            item.width = result?.width ?? item.width;
            item.height = result?.height ?? item.height;

            return resolve(item);
        }
        catch (err) {
            return reject(err);
        }
    });
}

async function webp2image(input, output) {
    return new Promise((resolve, reject) => {
        var img = new Image();
        img.onload = function () {
            try {

                var originWidth = img.width;
                var originHeight = img.height;
                var noThumbnail;

                // 是否是动画 webp
                var webpBuffer = fs.readFileSync(input);
                var isAnimated = webpBuffer.toString().indexOf("ANMF") > -1;

                // 不需要缩略图
                if (!isAnimated && img.width <= NO_THUMBNAIL_SIZE && img.height <= NO_THUMBNAIL_SIZE) {
                    noThumbnail = true;
                }
                else {
                    if (img.width > img.height) {
                        var newHeight = Math.min(EagleConfig.THUMBNAIL_SIZE, img.height);
                        var ratio = newHeight / img.height;
                        img.height = newHeight;
                        img.width = ratio * img.width;
                    }
                    else {
                        var newWidth = Math.min(EagleConfig.THUMBNAIL_SIZE, img.width);
                        var ratio = newWidth / img.width;
                        img.width = newWidth;
                        img.height = ratio * img.height;
                    }

                    var canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    var context = canvas.getContext('2d');
                    context.drawImage(img, 0, 0, img.width, img.height);

                    var hasAlpha = canvasHasAlpha(context, canvas);
                    var base64;

                    if (hasAlpha) {
                        base64 = canvas.toDataURL('image/png');
                    }
                    else {
                        base64 = canvas.toDataURL('image/jpeg', 0.9);
                    }

                    var buffer = decodeBase64Image(base64).data;
                    fs.writeFileSync(output, buffer);
                }

                var result = {
                    width: originWidth,
                    height: originHeight,
                    buffer: buffer,
                    noThumbnail: noThumbnail
                }

                if (isAnimated) {
                    result.animated = true;
                }

                return resolve(result);
            }
            catch (err) {
                reject(err);
                ipcRenderer.send('electron-log', err.stack || err);
            }
        };
        img.onerror = function (event) {
            reject(new Error(`Can not load: ${input}`));
        };
        img.src = URL_MODULE.pathToFileURL(input).href + "?v=" + Date.now();
    });
}

function canvasHasAlpha(context, canvas) {
    var data = context.getImageData(0, 0, canvas.width, canvas.height).data,
        hasAlphaPixels = false;
    for (var i = 3, n = data.length; i < n; i += 4) {
        if (data[i] < 255) {
            hasAlphaPixels = true;
            break;
        }
    }
    return hasAlphaPixels;
}