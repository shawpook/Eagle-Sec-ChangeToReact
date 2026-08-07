const fs = require('fs');
const appRoot = require('app-root-path');
const URL_MODULE = require(appRoot + '/my_modules/url');

module.exports = compress;

async function compress({ start, dest, format, quality, maxSize }) {
    return new Promise(async (resolve, reject) => {
        var img = new Image();
        img.onload = async function () {

            try {
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d', { willReadFrequently: true });
                var base64;

                // 設置高品質渲染參數
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                if (Math.max(img.width, img.height) > maxSize) {
                    // 計算目標尺寸
                    let targetWidth, targetHeight;
                    if (img.width > img.height) {
                        targetWidth = parseInt(maxSize * img.width / img.height);
                        targetHeight = maxSize;
                    }
                    else {
                        targetWidth = maxSize;
                        targetHeight = parseInt(maxSize * img.height / img.width);
                    }

                    canvas.width = targetWidth;
                    canvas.height = targetHeight;

                    // 對於大圖縮小，使用多步驟縮放以獲得更好的品質
                    if (img.width > targetWidth * 2 || img.height > targetHeight * 2) {
                        // 創建臨時 Canvas 進行多步驟縮放
                        const tempCanvas = document.createElement('canvas');
                        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
                        tempCtx.imageSmoothingEnabled = true;
                        tempCtx.imageSmoothingQuality = 'high';
                        
                        // 計算中間尺寸
                        let currentWidth = img.width;
                        let currentHeight = img.height;
                        
                        // 第一次繪製原始圖片（使用 5 參數版本避免 GPU 解碼路徑 bug）
                        tempCanvas.width = currentWidth;
                        tempCanvas.height = currentHeight;
                        tempCtx.drawImage(img, 0, 0, currentWidth, currentHeight);
                        
                        // 多步驟縮小，每次縮小不超過 50%
                        while (currentWidth > targetWidth * 1.5 || currentHeight > targetHeight * 1.5) {
                            currentWidth = Math.max(targetWidth, Math.floor(currentWidth * 0.5));
                            currentHeight = Math.max(targetHeight, Math.floor(currentHeight * 0.5));
                            
                            const nextCanvas = document.createElement('canvas');
                            const nextCtx = nextCanvas.getContext('2d', { willReadFrequently: true });
                            nextCtx.imageSmoothingEnabled = true;
                            nextCtx.imageSmoothingQuality = 'high';
                            
                            nextCanvas.width = currentWidth;
                            nextCanvas.height = currentHeight;
                            nextCtx.drawImage(tempCanvas, 0, 0, currentWidth, currentHeight);
                            
                            tempCanvas.width = currentWidth;
                            tempCanvas.height = currentHeight;
                            tempCtx.clearRect(0, 0, currentWidth, currentHeight);
                            tempCtx.drawImage(nextCanvas, 0, 0, currentWidth, currentHeight);
                        }
                        
                        // 最終繪製到目標 Canvas
                        ctx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);
                    } else {
                        // 小幅縮放，直接繪製
                        ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, targetWidth, targetHeight);
                    }
                }
                else {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                }

                let outputFormat = format || "image/jpeg";
                let outputQuality = quality || 0.8;
                const WEBP_MAX_SIZE = 16383;
                if (canvas.width > WEBP_MAX_SIZE || canvas.height > WEBP_MAX_SIZE) {
                    outputFormat = "image/jpeg";
                    outputQuality = 0.7;
                }

                base64 = canvas.toDataURL(outputFormat, outputQuality);

                var decode = decodeBase64Image(base64);
                if (!decode || !decode.data) {
                    resolve(true);
                }
                else {
                    // 先刪除已存在的檔案，避免 Windows 隱藏屬性導致 writeFile EPERM
                    await fs.promises.unlink(dest).catch(() => {});
                    await fs.promises.writeFile(dest, decode.data);
                    resolve(undefined, {
                        width: img.width,
                        height: img.height
                    });
                }
            }
            catch (err) {
                resolve(true);
                return;
            }
        };
        img.onerror = function (event) {
            return reject();
        };
        img.src = URL_MODULE.pathToFileURL(start).href + "?v=" + Date.now();
    });
}