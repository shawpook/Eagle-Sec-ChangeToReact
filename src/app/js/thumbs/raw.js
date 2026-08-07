const fs = require('fs');
const appRoot = require('app-root-path');
const nativeThumb = require(appRoot.path + '/app/js/utils/nativeThumb.js');
const imageSize = require(appRoot.path + '/app/js/utils/imageSize.js');
const { ipcRenderer } = require('electron');

module.exports = async ({ src, dest, item }) => {
    return new Promise(async (resolve, reject) => {
        try {
            let result = await raw2img(src, dest);

            // 無法產生縮圖時，改用 native 方式處理
            if (!fs.existsSync(dest)) {
                try {
                    result = await nativeThumb.async({ src: src, dest: dest, size: 1920, item: item });
                    if (!fs.existsSync(dest)) {
                        return reject(new Error(`Can not generate raw file with native method.`));
                    }
                    item.width = result.width;
                    item.height = result.height;
                }
                catch (err) {
                    return reject(err);
                }
            }

            if (result.rawMetas) {
				if (Object.keys(result.rawMetas).length > 0) {
					item.rawMetas = result.rawMetas ?? item.rawMetas;
				}
				else {
					delete item.rawMetas;
				}
                item.width = result?.rawMetas?.width ?? item.width;
                item.height = result?.rawMetas?.height ?? item.height;
            }

			// 假如無法取得 rawMetas 寬高資訊
			if (!result?.rawMetas?.width) {
				if (process.platform === 'darwin') {
					let rawSize = await imageSize.sipsAysnc(src);
					if (rawSize.width) {
						item.width = rawSize?.width ?? item.width;
						item.height = rawSize?.height ?? item.height;
					}
				}
				else {
					let rawSize = await imageSize.winAysnc(src);
					if (rawSize.width) {
						item.width = rawSize?.width ?? item.width;
						item.height = rawSize?.height ?? item.height;
					}
				}
			}

            // 判斷旋轉方向
            let thumbSize = await imageSizeNative(dest);
            if (
                (item.width > item.height && thumbSize.width < thumbSize.height) ||
                (item.width < item.height && thumbSize.width > thumbSize.height)
            ) {
                [item.height, item.width] = [item.width, item.height];
            }

            return resolve(item);
        }
        catch (err) {
            return reject(err);
        }
    });
}

async function imageSizeNative (filePath) {
    return new Promise((resolve, reject) => {
        var img = new Image();
        img.onload = function () {
            resolve({
                width: img.width,
                height: img.height,
            })
        };
        img.onerror = function (event) {
            resolve({
                width: 0,
                height: 0,
            })
        };
        img.src = require("url").pathToFileURL(filePath).href;
    });
}

async function raw2img(input, output) {
    return new Promise((resolve, reject) => {
        const rawParser = require(appRoot + '/my_modules/raw-parser');
        fs.readFile(input, function (err, buf) {
            rawParser.extractRawMetadata(buf, function (err, metadata) {
                if (!err && metadata) {
                    console.log(metadata);
                    rawParser.extractRawThumbnail(input, buf, output, function (err, outputPath) {
                        if (err) {
                            console.log(err);
                            rawParser.getTiffData(buf, function (err, tiffData) {
                                // 改用 tif 解析方式处理
                                try {
                                    const UTIF = require(appRoot + '/my_modules/utif');
                                    var thumbnailSize = 1920;
                                    var base64;
                                    var ifds = UTIF.decode(tiffData);
                                    UTIF.decodeImage(tiffData, ifds[0])
                                    var rgba = UTIF.toRGBA8(ifds[0]);  // Uint8Array with RGBA pixels
                                    var w = ifds[0].width;
                                    var h = ifds[0].height;
                                    var canvas = document.createElement("canvas");
                                    canvas.width = w;
                                    canvas.height = h;
                                    var ctx = canvas.getContext("2d");
                                    var imgd = ctx.createImageData(w, h);
                                    for (var i = 0; i < rgba.length; i++) {
                                        imgd.data[i] = rgba[i];
                                    }
                                    ctx.putImageData(imgd, 0, 0);
                                    if (w > thumbnailSize || h > thumbnailSize) {
                                        var resizeCanvas = document.createElement("canvas");
                                        var targetWidth, targetHeight;
                                        if (w > h) {
                                            targetHeight = thumbnailSize;
                                            targetWidth = parseInt(thumbnailSize / h * w);
                                        }
                                        else {
                                            targetWidth = thumbnailSize;
                                            targetHeight = parseInt(thumbnailSize / w * h);
                                        }
                                        resizeCanvas.width = targetWidth;
                                        resizeCanvas.height = targetHeight;
                                        
                                        var resizeCtx = resizeCanvas.getContext('2d');
                                        // 設置高品質渲染
                                        resizeCtx.imageSmoothingEnabled = true;
                                        resizeCtx.imageSmoothingQuality = 'high';
                                        
                                        // 對於大幅縮小，使用多步驟縮放
                                        if (w > targetWidth * 2 || h > targetHeight * 2) {
                                            // 創建臨時 canvas 進行漸進式縮放
                                            var tempCanvas = document.createElement("canvas");
                                            var tempCtx = tempCanvas.getContext('2d');
                                            tempCtx.imageSmoothingEnabled = true;
                                            tempCtx.imageSmoothingQuality = 'high';
                                            
                                            var currentWidth = w;
                                            var currentHeight = h;
                                            var sourceCanvas = canvas;
                                            
                                            // 多步驟縮小，每次縮小不超過 50%
                                            while (currentWidth > targetWidth * 1.5 || currentHeight > targetHeight * 1.5) {
                                                currentWidth = Math.max(targetWidth, Math.floor(currentWidth * 0.5));
                                                currentHeight = Math.max(targetHeight, Math.floor(currentHeight * 0.5));
                                                
                                                tempCanvas.width = currentWidth;
                                                tempCanvas.height = currentHeight;
                                                tempCtx.clearRect(0, 0, currentWidth, currentHeight);
                                                tempCtx.drawImage(sourceCanvas, 0, 0, currentWidth, currentHeight);
                                                
                                                // 準備下一次迭代
                                                sourceCanvas = tempCanvas;
                                                tempCanvas = document.createElement("canvas");
                                                tempCtx = tempCanvas.getContext('2d');
                                                tempCtx.imageSmoothingEnabled = true;
                                                tempCtx.imageSmoothingQuality = 'high';
                                            }
                                            
                                            // 最終繪製到目標尺寸
                                            resizeCtx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
                                        } else {
                                            // 小幅縮放，直接繪製
                                            resizeCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, targetWidth, targetHeight);
                                        }
                                        base64 = resizeCanvas.toDataURL("image/jpeg", 0.7);
                                    }
                                    else {
                                        base64 = canvas.toDataURL("image/jpeg", 0.7);
                                    }
                                    var buffer = decodeBase64Image(base64).data;
                                    fs.writeFileSync(output, buffer);
                                    return resolve({
                                        width: metadata.width,
                                        height: metadata.height,
                                        rawMetas: metadata
                                    });
                                }
                                catch (err) {
                                    ipcRenderer.send('electron-log', err.stack || err);
                                    return resolve({
                                        width: metadata.width,
                                        height: metadata.height,
                                        rawMetas: metadata
                                    });
                                }
                            });
                        }
                        else {
                            return resolve({
                                width: metadata.width,
                                height: metadata.height,
                                rawMetas: metadata
                            });
                        }
                    });
                }
                else {
                    ipcRenderer.send('electron-log', err.stack || err);
                    return resolve({
                        width: 0,
                        height: 0
                    });
                }
            })
        });
    });
}