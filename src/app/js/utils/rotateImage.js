const fs = require("fs");
const path = require("path");
const piexif = require(appRoot.path + '/app/js/utils/piexif.js');

module.exports = async (src, degree, options = {}) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!src || !fs.existsSync(src)) {
                return reject(new Error("Source file does not exist"));
            }

            const ext = path.extname(src).toLowerCase();
            
            // 決定使用 EXIF 或 Canvas 方法
            if (['.jpg', '.jpeg'].includes(ext)) {
                return await rotateWithExif(src, degree, resolve, reject);
            } else if (['.png', '.webp', '.bmp', '.avif'].includes(ext)) {
                return await rotateDestructively(src, degree, ext, resolve, reject, options);
            } else {
                return reject(new Error(`Unsupported file format: ${ext}`));
            }
        } catch (err) {
            return reject(err);
        }
    });
};

// EXIF 旋轉方法 (非破壞性)
async function rotateWithExif(src, degree, resolve, reject) {
    try {
        const jpeg = fs.readFileSync(src);
        const data = jpeg.toString("binary");
        
        // 完整的 EXIF Orientation 旋轉對應表
        // 根據 flipImage.js 中的對應關係推導而來
        const ROTATION_MAP = {
            // 90度順時針旋轉 (右轉)
            90: {
                1: 6,   // 正常 → 90°
                2: 7,   // 水平翻轉 → 270° + 水平翻轉
                3: 8,   // 180° → 270°
                4: 5,   // 垂直翻轉 → 90° + 水平翻轉
                5: 2,   // 90° + 水平翻轉 → 水平翻轉
                6: 3,   // 90° → 180°
                7: 4,   // 270° + 水平翻轉 → 垂直翻轉
                8: 1    // 270° → 正常
            },
            // 180度旋轉
            180: {
                1: 3,   // 正常 → 180°
                2: 4,   // 水平翻轉 → 垂直翻轉
                3: 1,   // 180° → 正常
                4: 2,   // 垂直翻轉 → 水平翻轉
                5: 7,   // 90° + 水平翻轉 → 270° + 水平翻轉
                6: 8,   // 90° → 270°
                7: 5,   // 270° + 水平翻轉 → 90° + 水平翻轉
                8: 6    // 270° → 90°
            },
            // 270度順時針旋轉 (等於 90度逆時針，左轉)
            270: {
                1: 8,   // 正常 → 270°
                2: 5,   // 水平翻轉 → 90° + 水平翻轉
                3: 6,   // 180° → 90°
                4: 7,   // 垂直翻轉 → 270° + 水平翻轉
                5: 4,   // 90° + 水平翻轉 → 垂直翻轉
                6: 1,   // 90° → 正常
                7: 2,   // 270° + 水平翻轉 → 水平翻轉
                8: 3    // 270° → 180°
            },
            // -90度 (90度逆時針，左轉) - 直接對應到 270 度
            "-90": {
                1: 8,   // 正常 → 270°
                2: 5,   // 水平翻轉 → 90° + 水平翻轉 (與270度相同)
                3: 6,   // 180° → 90°
                4: 7,   // 垂直翻轉 → 270° + 水平翻轉
                5: 4,   // 90° + 水平翻轉 → 垂直翻轉
                6: 1,   // 90° → 正常
                7: 2,   // 270° + 水平翻轉 → 水平翻轉
                8: 3    // 270° → 180°
            }
        };
        
        // 標準化角度，但保持 -90 作為特殊情況
        let normalizedDegree;
        if (degree === -90) {
            normalizedDegree = "-90";
        } else {
            // 處理其他負角度
            if (degree < 0) {
                degree = 360 + (degree % 360);
            }
            normalizedDegree = degree % 360;
        }
        
        if (![0, 90, 180, 270, "-90"].includes(normalizedDegree)) {
            return reject(new Error(`Error: Target angle ${degree} not supported, please enter a valid angle (-90, 0, 90, 180, 270).`));
        }

        let exifObj = piexif.load(data);
        if (!exifObj['0th']) { 
            exifObj['0th'] = {}; 
        }

        // 取得當前的 EXIF Orientation，預設為 1（正常）
        const currentOrientation = exifObj['0th'][piexif.ImageIFD.Orientation] || 1;
        
        // 如果是 0 度旋轉，直接返回
        if (normalizedDegree === 0) {
            return resolve();
        }
        
        // 根據當前 orientation 和旋轉角度計算新的 orientation
        const targetOrientation = ROTATION_MAP[normalizedDegree][currentOrientation];
        
        if (!targetOrientation) {
            return reject(new Error(`Cannot calculate target orientation for current: ${currentOrientation}, degree: ${normalizedDegree}`));
        }

        // 如果已經是目標狀態，跳過處理
        if (currentOrientation === targetOrientation) {
            return resolve();
        }

        // 寫入新的 EXIF Orientation
        exifObj['0th'][piexif.ImageIFD.Orientation] = targetOrientation;
        
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
        return reject(new Error(`EXIF rotation failed: ${err.message}`));
    }
}

// 破壞性旋轉方法 (適用於非 JPEG 格式) - 使用瀏覽器 Canvas API
async function rotateDestructively(src, degree, ext, resolve, reject, options) {
    let image = null;
    let canvas = null;
    let ctx = null;
    
    try {
        // PNG 格式需要檢查是否為 APNG
        if (ext === '.png') {
            const rawUrl = require('url').pathToFileURL(src).href;
            const APNG = global.APNG;
            
            if (APNG) {
                try {
                    const data = await APNG.parseURL(rawUrl);
                    // 如果是 APNG，拒絕處理
                    return reject(new Error('Not support apng file format.'));
                } catch (err) {
                    // 不是 APNG，繼續處理
                }
            }
        }

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
        
        // 建立 Canvas - 根據旋轉角度調整尺寸
        canvas = document.createElement('canvas');
        const originalWidth = loadedImage.naturalWidth || loadedImage.width;
        const originalHeight = loadedImage.naturalHeight || loadedImage.height;
        
        // 如果是 90度 或 270度 旋轉，需要交換寬高
        if (Math.abs(degree) === 90 || Math.abs(degree) === 270) {
            canvas.width = originalHeight;
            canvas.height = originalWidth;
        } else {
            canvas.width = originalWidth;
            canvas.height = originalHeight;
        }
        
        ctx = canvas.getContext('2d');
        
        // 清除畫布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 根據旋轉角度設定變換
        ctx.save();
        
        // 移動到中心點
        ctx.translate(canvas.width / 2, canvas.height / 2);
        
        // 旋轉
        ctx.rotate((degree * Math.PI) / 180);
        
        // 繪製圖片（從中心點偏移回去）
        ctx.drawImage(loadedImage, -originalWidth / 2, -originalHeight / 2);
        ctx.restore();
        
        // 決定輸出格式
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
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            
            console.log(`[BMP DEBUG] Starting BMP rotation, canvas size: ${canvasWidth}x${canvasHeight}`);
            
            let bmpCallbackExecuted = false;
            const bmpTimeout = setTimeout(() => {
                if (!bmpCallbackExecuted) {
                    bmpCallbackExecuted = true;
                    console.error(`[BMP DEBUG] CanvasToBMP timeout`);
                    cleanupResources();
                    return reject(new Error('BMP rotation timeout'));
                }
            }, 15000); // 15秒超時
            
            const CanvasToBMP = global.CanvasToBMP;
            if (!CanvasToBMP) {
                cleanupResources();
                return reject(new Error('CanvasToBMP not available'));
            }
            
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
                    convertBlobToBuffer(blob, src, canvasWidth, canvasHeight, resolve, reject, options);
                } catch (conversionError) {
                    console.error(`[BMP DEBUG] Conversion error: ${conversionError.message}`);
                    cleanupResources();
                    return reject(new Error(`BMP data conversion failed: ${conversionError.message}`));
                }
            });
        } else {
            // 使用 canvas.toBlob 處理其他格式
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            
            canvas.toBlob((blob) => {
                if (!blob) {
                    cleanupResources();
                    return reject(new Error(`Failed to create ${mimeType} blob`));
                }
                cleanupResources();
                convertBlobToBuffer(blob, src, canvasWidth, canvasHeight, resolve, reject, options);
            }, mimeType, quality);
        }
        
    } catch (err) {
        cleanupResources();
        return reject(new Error(`Canvas rotation failed: ${err.message}`));
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
function convertBlobToBuffer(blob, src, newWidth, newHeight, resolve, reject, options) {
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
                
                // 如果有成功回調選項，執行它們
                if (options.onSuccess) {
                    options.onSuccess(newWidth, newHeight);
                }
                
                return resolve({ width: newWidth, height: newHeight });
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