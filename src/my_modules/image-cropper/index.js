const nativeImage = require('electron').nativeImage;
module.exports = function (imagePath, croppedImage, top, left, width, height, callback) {
    let ext = croppedImage.ext;
    // if (ext === "jpg" || ext === "png") {
    //     var nativeImage = electron.nativeImage;
    //     var newImage = nativeImage.createFromPath(imagePath);
    //     let scaleFactor = newImage.getScaleFactors()[0] || 1;

    //     debugger

    //     var cropParams = {
    //         x: parseInt(left / scaleFactor),
    //         y: parseInt(top / scaleFactor),
    //         width: parseInt(width / scaleFactor),
    //         height: parseInt(height / scaleFactor)
    //     };

    //     // 带有 orientation 属性的图片
    //     // if (croppedImage.orientation && croppedImage.orientation !== 1) {}

    //     electronLog.info(JSON.stringify(cropParams));

    //     newImage = newImage.crop(cropParams);

    //     electronLog.info(`[app] Crop successfully: ${imagePath}`);

    //     var outputBuffer;
    //     if (croppedImage.ext === "png") {
    //         electronLog.info(`[app] Crop format: PNG`);
    //         outputBuffer = newImage.toPNG();
    //     }
    //     else {
    //         electronLog.info(`[app] Crop format: JPEG`);
    //         outputBuffer = newImage.toJPEG(100);
    //     }
    //     callback(undefined, outputBuffer);
    // }
    // else if (ext === "webp") {
        // electronLog.info(`[app] Crop format: WebP`);
    if (ext === "webp" || ext === "jpg" || ext === "png") {
        let mimeType;
        switch (ext) {
            case "webp":
                mimeType = "image/webp";
                break;
            case "png":
                mimeType = "image/png";
                break;
            default:
                mimeType = "image/jpeg";
        }
        const img = new Image();
        img.onload = function() {
            canvasHelper.crop(img, {
                toCropImgX: parseInt(left),
                toCropImgY: parseInt(top),
                toCropImgW: width,
                toCropImgH: height,
                imgChangeRatio: 1,
                mimeType: mimeType,
                quality: 100
            }, function (base64string) {
                const buffer = decodeBase64Image(base64string).data;
                callback(undefined, {
                    buffer: buffer,
                    base64: base64string
                });
                electronLog.info(`[app] Crop successfully: ${imagePath}`);
            });
        };
        img.onerror = function(event) {
            callback(true);
            electronLog.error(`[app] Crop failed: ${imagePath}`);
            return;
        };
        img.src = URL_MODULE.pathToFileURL(imagePath).href + "?v=" + Date.now();
    }
}