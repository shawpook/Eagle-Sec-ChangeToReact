const fs = require("fs");
const path = require("path");
const piexif = require(appRoot.path + '/app/js/utils/piexif.js');

module.exports = async (src, flipType) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!src || !fs.existsSync(src)) {
                return reject(new Error("Source file does not exist"));
            }

            const ext = path.extname(src).toLowerCase();
            
            // 決定使用 EXIF 或破壞性方法
            if (['.jpg', '.jpeg'].includes(ext)) {
                return await flipWithExif(src, flipType, resolve, reject);
            } else if (['.png', '.webp', '.bmp', '.avif'].includes(ext)) {
                return await flipDestructively(src, flipType, resolve, reject);
            } else {
                return reject(new Error(`Unsupported file format: ${ext}`));
            }
        } catch (err) {
            return reject(err);
        }
    });
};

// EXIF 翻轉方法 (非破壞性)
async function flipWithExif(src, flipType, resolve, reject) {
    try {
        const jpeg = fs.readFileSync(src);
        const data = jpeg.toString("binary");
        
        // EXIF Orientation 翻轉對應表
        const FLIP_HORIZONTAL = {
            1: 2,   // 正常 → 水平翻轉
            2: 1,   // 水平翻轉 → 正常
            3: 4,   // 180° → 垂直翻轉
            4: 3,   // 垂直翻轉 → 180°
            5: 6,   // 90° + 水平翻轉 → 90°
            6: 5,   // 90° → 90° + 水平翻轉
            7: 8,   // 270° + 水平翻轉 → 270°
            8: 7    // 270° → 270° + 水平翻轉
        };
        
        const FLIP_VERTICAL = {
            1: 4,   // 正常 → 垂直翻轉
            2: 3,   // 水平翻轉 → 180°
            3: 2,   // 180° → 水平翻轉
            4: 1,   // 垂直翻轉 → 正常
            5: 8,   // 90° + 水平翻轉 → 270°
            6: 7,   // 90° → 270° + 水平翻轉
            7: 6,   // 270° + 水平翻轉 → 90°
            8: 5    // 270° → 90° + 水平翻轉
        };
        
        const FLIP_BOTH = {
            1: 3,   // 正常 → 180°
            2: 4,   // 水平翻轉 → 垂直翻轉
            3: 1,   // 180° → 正常
            4: 2,   // 垂直翻轉 → 水平翻轉
            5: 7,   // 90° + 水平翻轉 → 270° + 水平翻轉
            6: 8,   // 90° → 270°
            7: 5,   // 270° + 水平翻轉 → 90° + 水平翻轉
            8: 6    // 270° → 90°
        };

        let exifObj = piexif.load(data);
        if (!exifObj['0th']) { 
            exifObj['0th'] = {}; 
        }

        const currentOrientation = exifObj['0th'][piexif.ImageIFD.Orientation] || 1;
        let newOrientation;

        // 根據翻轉類型選擇對應表
        switch (flipType) {
            case 'horizontal':
                newOrientation = FLIP_HORIZONTAL[currentOrientation];
                break;
            case 'vertical':
                newOrientation = FLIP_VERTICAL[currentOrientation];
                break;
            case 'both':
                newOrientation = FLIP_BOTH[currentOrientation];
                break;
            default:
                return reject(new Error(`Invalid flip type: ${flipType}`));
        }

        if (!newOrientation) {
            return reject(new Error(`Cannot calculate orientation for current: ${currentOrientation}, flip: ${flipType}`));
        }

        // 如果已經是目標狀態，跳過處理
        if (currentOrientation === newOrientation) {
            return resolve();
        }

        // 寫入新的 EXIF Orientation
        exifObj['0th'][piexif.ImageIFD.Orientation] = newOrientation;
        
        let exifbytes = piexif.dump(exifObj);
        let newData = piexif.insert(exifbytes, data);
        let newJpeg = Buffer.from(newData, "binary");

        // 安全寫入文件 (先寫 .tmp，後移動)
        try {
            await fs.promises.writeFile(`${src}.tmp`, newJpeg);
        } catch (err) {
            return reject(err);
        }
        
        try {
            await fs.promises.writeFile(`${src}`, newJpeg);
            await fs.promises.unlink(`${src}.tmp`);
        } catch (err) {
            return reject(err);
        }
        
        return resolve();
    } catch (err) {
        return reject(new Error(`EXIF flip failed: ${err.message}`));
    }
}

// 破壞性翻轉方法 (適用於非 JPEG 格式) - 使用瀏覽器 Canvas API
async function flipDestructively(src, flipType, resolve, reject) {
    let image = null;
    let canvas = null;
    let ctx = null;
    
    try {
        // 載入原始圖片
        image = new Image();
        
        // 使用 Promise 處理圖片載入
        const loadImagePromise = new Promise((imageResolve, imageReject) => {
            const timeout = setTimeout(() => {
                imageReject(new Error('Image loading timeout'));
            }, 10000); // 10秒超時
            
            image.onload = () => {
                clearTimeout(timeout);
                imageResolve(image);
            };
            image.onerror = (err) => {
                clearTimeout(timeout);
                imageReject(new Error(`Failed to load image: ${err.message || 'Unknown error'}`));
            };
            
            // 確保清除之前的緩存
            image.src = `file://${src}?t=${Date.now()}`;
        });
        
        const loadedImage = await loadImagePromise;
        
        // 建立 Canvas
        canvas = document.createElement('canvas');
        canvas.width = loadedImage.naturalWidth || loadedImage.width;
        canvas.height = loadedImage.naturalHeight || loadedImage.height;
        ctx = canvas.getContext('2d');
        
        // 清除畫布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 根據翻轉類型設定變換
        ctx.save();
        
        switch (flipType) {
            case 'horizontal':
                // 水平翻轉：scale(-1, 1) + translate(-width, 0)
                ctx.scale(-1, 1);
                ctx.translate(-canvas.width, 0);
                break;
            case 'vertical':
                // 垂直翻轉：scale(1, -1) + translate(0, -height)
                ctx.scale(1, -1);
                ctx.translate(0, -canvas.height);
                break;
            case 'both':
                // 雙向翻轉：scale(-1, -1) + translate(-width, -height)
                ctx.scale(-1, -1);
                ctx.translate(-canvas.width, -canvas.height);
                break;
            default:
                return reject(new Error(`Invalid flip type: ${flipType}`));
        }
        
        // 繪製翻轉後的圖片
        ctx.drawImage(loadedImage, 0, 0);
        ctx.restore();
        
        // 決定輸出格式
        const ext = path.extname(src).toLowerCase();
        let mimeType;
        let quality = 1;
        
        if (ext === '.png') {
            mimeType = 'image/png';
        } else if (ext === '.jpg' || ext === '.jpeg') {
            mimeType = 'image/jpeg';
        } else if (ext === '.webp') {
            mimeType = 'image/webp';
        } else if (ext === '.avif') {
            // AVIF 不支援寫入
            return reject(new Error(`AVIF format does not support writing. File: ${src}`));
        } else if (ext === '.bmp') {
            // BMP 格式，使用 CanvasToBMP 處理
            mimeType = 'image/bmp';
        } else {
            // 其他未知格式不支援
            return reject(new Error(`Unsupported format for writing: ${ext}. File: ${src}`));
        }
        
        // 根據格式使用不同的處理方式
        if (mimeType === 'image/bmp') {
            // 使用 CanvasToBMP 處理 BMP 格式，添加超時保護
            console.log(`[BMP DEBUG] Starting BMP conversion, canvas size: ${canvas.width}x${canvas.height}`);
            
            let bmpCallbackExecuted = false;
            const bmpTimeout = setTimeout(() => {
                if (!bmpCallbackExecuted) {
                    bmpCallbackExecuted = true;
                    console.error(`[BMP DEBUG] CanvasToBMP timeout`);
                    cleanupResources();
                    return reject(new Error('BMP conversion timeout'));
                }
            }, 15000); // 15秒超時
            
            CanvasToBMP.toDataURL(canvas, function (bmpDataUri) {
                if (bmpCallbackExecuted) {
                    console.log(`[BMP DEBUG] CanvasToBMP callback called after timeout, ignoring`);
                    return;
                }
                
                clearTimeout(bmpTimeout);
                bmpCallbackExecuted = true;
                
                console.log(`[BMP DEBUG] CanvasToBMP callback, dataUri length: ${bmpDataUri ? bmpDataUri.length : 'null'}`);
                
                if (!bmpDataUri || bmpDataUri.length < 10) {
                    console.error(`[BMP DEBUG] Invalid BMP data: ${bmpDataUri ? bmpDataUri.substring(0, 50) : 'null'}`);
                    cleanupResources();
                    return reject(new Error('Failed to create BMP data'));
                }
                
                try {
                    // 將 DataURL 轉換為 Blob
                    const byteString = atob(bmpDataUri.split(',')[1]);
                    const arrayBuffer = new ArrayBuffer(byteString.length);
                    const uint8Array = new Uint8Array(arrayBuffer);
                    
                    for (let i = 0; i < byteString.length; i++) {
                        uint8Array[i] = byteString.charCodeAt(i);
                    }
                    
                    console.log(`[BMP DEBUG] Created arrayBuffer size: ${arrayBuffer.byteLength}`);
                    const blob = new Blob([arrayBuffer], { type: 'image/bmp' });
                    
                    // 清理資源後再處理 Blob
                    cleanupResources();
                    convertBlobToBuffer(blob, src, resolve, reject);
                } catch (conversionError) {
                    console.error(`[BMP DEBUG] Conversion error: ${conversionError.message}`);
                    cleanupResources();
                    return reject(new Error(`BMP data conversion failed: ${conversionError.message}`));
                }
            });
        } else {
            // 使用 canvas.toBlob 處理其他格式
            canvas.toBlob((blob) => {
                if (!blob) {
                    cleanupResources();
                    return reject(new Error(`Failed to create ${mimeType} blob`));
                }
                cleanupResources();
                convertBlobToBuffer(blob, src, resolve, reject);
            }, mimeType, quality);
        }
        
    } catch (err) {
        cleanupResources();
        return reject(new Error(`Canvas flip failed: ${err.message}`));
    }
    
    // 清理資源函數
    function cleanupResources() {
        try {
            if (image) {
                image.onload = null;
                image.onerror = null;
                image.src = '';
                image = null;
            }
            if (ctx) {
                ctx.clearRect(0, 0, canvas?.width || 0, canvas?.height || 0);
                ctx = null;
            }
            if (canvas) {
                canvas.width = 0;
                canvas.height = 0;
                canvas = null;
            }
        } catch (cleanupError) {
            console.warn(`[BMP DEBUG] Cleanup warning: ${cleanupError.message}`);
        }
    }
}

// 輔助函數：將 Blob 轉換為 Buffer 並寫入檔案
function convertBlobToBuffer(blob, src, resolve, reject) {
    const reader = new FileReader();
    
    reader.onload = async function() {
        try {
            const arrayBuffer = reader.result;
            const buffer = Buffer.from(arrayBuffer);
            
            // 安全寫入檔案 (先寫 .tmp，後移動)
            const tempPath = `${src}.tmp`;
            
            try {
                await fs.promises.writeFile(tempPath, buffer);
            } catch (err) {
                return reject(new Error(`Failed to write temp file: ${err.message}`));
            }
            
            try {
                await fs.promises.writeFile(src, buffer);
                await fs.promises.unlink(tempPath);
                return resolve();
            } catch (err) {
                // 清理 temp 檔案
                try {
                    await fs.promises.unlink(tempPath);
                } catch (cleanupErr) {
                    // 忽略清理錯誤
                }
                return reject(new Error(`Failed to replace original file: ${err.message}`));
            }
            
        } catch (err) {
            return reject(new Error(`Failed to process blob: ${err.message}`));
        }
    };
    
    reader.onerror = function() {
        return reject(new Error('Failed to read blob as array buffer'));
    };
    
    reader.readAsArrayBuffer(blob);
}