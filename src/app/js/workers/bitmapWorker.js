// Initialize native HEIC parser
self.nativeHeicParserAvailable = false;

self.onmessage = async function (e) {
    // Handle initialization message
    if (e.data.type === 'INIT_NATIVE_PARSER') {
        self.nativeHeicParserAvailable = e.data.available;
        return;
    }
    
    // Handle native parser response
    if (e.data.type === 'NATIVE_HEIC_PARSE_RESPONSE') {
        // This will be handled by the promise in tryNativeHeicParse
        return;
    }
    
    const { url, item, tileSize } = e.data;
    try {
        // Check if this is a TIF file
        if (isTifFile(item.ext)) {
            await processTifImage(url, item, tileSize);
            return;
        }

        // Check if this is a HEIF file
        if (isHeifFile(item.ext)) {
            await processHeifImage(url, item, tileSize);
            return;
        }

        // Process other image formats normally
        const response = await fetch(url);
        const blob = await response.blob();
        let orientation = null;

        try {
            // Note: 因為有些 png 其實是 jpg，所以這邊不再限制只有 jpg 才讀取 exif
            // if (item.ext === 'jpg') {
                // console.time("exif");
                orientation = await readOrientation(blob);
                // console.log(`Orientation: ${orientation}`);
                // console.timeEnd("exif");
            // }
        }
        catch (error) {
            if (item.ext === 'jpg') {
                postMessage({ usingImgTag: true });
                return;
            }
            console.error("Error reading EXIF data: ", error);
        }

        const buffer = await blob.arrayBuffer();
        if (shouldUseImgTagForAnimation(buffer, item)) {
            postMessage({ usingImgTag: true });
            return;
        }

        let bitmap = await createImageBitmap(blob);

        if (orientation && orientation !== 1) {
            // console.time("convertToNewBitmap");
            bitmap = await convertToNewBitmap(bitmap);
            // console.timeEnd("convertToNewBitmap");
        }

        const bitmapWidth = bitmap.width;
        const bitmapHeight = bitmap.height;
        let cloneBitmap = await createImageBitmap(bitmap);

        // 計算總磁磚數
        const cols = Math.ceil(bitmapWidth / tileSize);
        const rows = Math.ceil(bitmapHeight / tileSize);
        const totalTiles = cols * rows;

        // msg1: 立即送出 bitmap
        postMessage({
            bitmap,
            orientation,
            usingImgTag: false,
            viewportBitmap: null,
            totalTiles,
            imageWidth: bitmapWidth,
            imageHeight: bitmapHeight
        }, [bitmap]);

        // msg2: tiles
        const tiles = await generateBitmapTiles(cloneBitmap, tileSize, orientation);
        postMessage({ tiles }, [...tiles.map(tile => tile.tile)]);

        // msg3: viewportBitmap（渲染效能優化，不急）
        if (totalTiles > 50) {
            const viewportBitmap = await createViewportBitmap(cloneBitmap);
            if (viewportBitmap) {
                postMessage({ viewportBitmap }, [viewportBitmap]);
            }
        }

        URL.revokeObjectURL(url);
    } catch (error) {
        postMessage({ error: 'Failed to load or process image' });
        console.error(error);
    }
};

async function readOrientation(blob) {
    if (!blob) {
        console.error("No blob provided");
        return Promise.reject("No blob provided");
    }

    // 優化：只讀取前 512KB 來獲取 EXIF，避免讀取整個檔案
    const EXIF_MAX_SIZE = 524288; // 512KB
    const slicedBlob = blob.size > EXIF_MAX_SIZE ? blob.slice(0, EXIF_MAX_SIZE) : blob;
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
        reader.onload = (e) => {
            try {
                const data = e.target.result;

                // 使用 piexifjs 解析图片的 EXIF 数据
                // console.time("piexif");
                const exifData = self.piexif.load(data);
                // console.timeEnd("piexif");

                // 从解析出的 EXIF 数据中获取 Orientation
                const orientation = exifData["0th"][self.piexif.ImageIFD.Orientation];

                // 用获取到的 Orientation 做些什么
                // console.log("Orientation: ", orientation);
                resolve(orientation);
            }
            catch (err) {
                reject(err);
            }
        };

        reader.onerror = (e) => {
            console.error("Error reading file: ", e);
            resolve(null);
        }

        reader.readAsBinaryString(slicedBlob);
    });
}


function shouldUseImgTagForAnimation(buffer, item) {
    if (item.ext === 'svg') return true;
    if (item.ext === 'png' && isAPNG(buffer)) return true;
    if ((item.ext === 'webp' || item.ext === 'avif') && item.animated === true) return true;
    return false;
}

function isAPNG(buffer) {
    const MAX_CHUNKS = 10000; // Arbitrary limit to prevent excessive processing
    const MAX_CHUNK_SIZE = 10000000; // 10MB - 防止異常大的 chunk size
    const bytes = new Uint8Array(buffer);
    
    // 简单的PNG签名检测
    if (bytes.length < 8 || 
        bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4E || bytes[3] !== 0x47 || 
        bytes[4] !== 0x0D || bytes[5] !== 0x0A || bytes[6] !== 0x1A || bytes[7] !== 0x0A) {
        return false;
    }

    // 搜索acTL块，它存在于APNG中，但不在普通的PNG中
    let pos = 8;
    let chunkCount = 0;
    
    while (pos < bytes.length) {
        if (chunkCount++ > MAX_CHUNKS) {
            console.warn('Exceeded maximum chunk count in APNG detection');
            return false;
        }

        // 確保有足夠的字節來讀取 length 和 type
        if (pos + 8 > bytes.length) {
            break;
        }

        const length = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
        
        // 檢查 chunk length 是否合理
        if (length < 0 || length > MAX_CHUNK_SIZE) {
            console.warn('Invalid PNG chunk length detected:', length);
            return false;
        }
        
        // 確保有足夠的字節來讀取整個 chunk
        if (pos + 8 + length + 4 > bytes.length) {
            // 檔案可能被截斷，但這不一定意味著它是無效的
            break;
        }
        
        const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
        
        // acTL块表示该PNG是APNG
        if (type === 'acTL') {
            return true;
        }
        
        // IEND 表示 PNG 結束
        if (type === 'IEND') {
            break;
        }

        // 移动到下一个块
        pos += 8 + length + 4;
    }

    return false;
}

async function createViewportBitmap(bitmap) {
    const assumedViewportWidth = 1920;
    const assumedViewportHeight = 1080;
    const scaleToFit = Math.min(assumedViewportWidth / bitmap.width, assumedViewportHeight / bitmap.height);
    const displayWidth = bitmap.width * scaleToFit;
    const displayHeight = bitmap.height * scaleToFit;
    const devicePixelRatio = 2;
    const safetyFactor = 1.2;

    let targetWidth = Math.floor(displayWidth * devicePixelRatio * safetyFactor);
    let targetHeight = Math.floor(displayHeight * devicePixelRatio * safetyFactor);
    targetWidth = Math.min(targetWidth, bitmap.width);
    targetHeight = Math.min(targetHeight, bitmap.height);

    const minWidth = Math.min(2560, bitmap.width);
    if (targetWidth < minWidth) {
        const scale = minWidth / targetWidth;
        targetWidth = minWidth;
        targetHeight = Math.floor(targetHeight * scale);
        targetHeight = Math.min(targetHeight, bitmap.height);
    }

    const finalScale = Math.min(targetWidth / bitmap.width, targetHeight / bitmap.height);
    const finalWidth = Math.floor(bitmap.width * finalScale);
    const finalHeight = Math.floor(bitmap.height * finalScale);

    if (bitmap.width > finalWidth * 2 || bitmap.height > finalHeight * 2) {
        let currentWidth = bitmap.width;
        let currentHeight = bitmap.height;
        let tempBitmap = bitmap;

        while (currentWidth > finalWidth * 1.5 || currentHeight > finalHeight * 1.5) {
            currentWidth = Math.max(finalWidth, Math.floor(currentWidth * 0.5));
            currentHeight = Math.max(finalHeight, Math.floor(currentHeight * 0.5));
            tempBitmap = await createImageBitmap(tempBitmap, {
                resizeWidth: currentWidth,
                resizeHeight: currentHeight,
                resizeQuality: 'high'
            });
        }

        return await createImageBitmap(tempBitmap, {
            resizeWidth: finalWidth,
            resizeHeight: finalHeight,
            resizeQuality: 'high'
        });
    } else {
        return await createImageBitmap(bitmap, {
            resizeWidth: finalWidth,
            resizeHeight: finalHeight,
            resizeQuality: 'high'
        });
    }
}

async function generateBitmapTiles(bitmap, tileSize, orientation) {
    const tiles = [];
    const width = bitmap.width;
    const height = bitmap.height;
    const rows = Math.ceil(height / tileSize);
    const cols = Math.ceil(width / tileSize);

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const x = j * tileSize;
            const y = i * tileSize;
            const w = Math.min(tileSize, width - x);
            const h = Math.min(tileSize, height - y);
            const tile = await createImageBitmap(bitmap, x, y, w, h);
            tiles.push({ x, y, w, h, tile });
        }
    }   
    return tiles;
}

async function convertToNewBitmap(bitmap) {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    ctx.drawImage(bitmap, 0, 0);

    const blob = await canvas.convertToBlob({ type: 'image/jpeg'});
    const newBitmap = await createImageBitmap(blob);
    return newBitmap;
}

function isTifFile(ext) {
    return ext === 'tif' || ext === 'tiff';
}

function isHeifFile(ext) {
    return ['heif', 'heic', 'hif'].includes(ext.toLowerCase());
}

// Native HEIC parsing function
async function tryNativeHeicParse(filePath) {
    return new Promise((resolve, reject) => {
        const requestId = 'heic_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Set up response handler
        const handleResponse = (event) => {
            const { type, data } = event.data;
            if (type === 'NATIVE_HEIC_PARSE_RESPONSE' && data.requestId === requestId) {
                self.removeEventListener('message', handleResponse);
                
                if (data.success) {
                    resolve(data);
                } else {
                    reject(new Error(data.error));
                }
            }
        };
        
        self.addEventListener('message', handleResponse);
        
        // Send request to main thread
        postMessage({
            type: 'NATIVE_HEIC_PARSE_REQUEST',
            data: { filePath, requestId }
        });
        
        // Set timeout
        setTimeout(() => {
            self.removeEventListener('message', handleResponse);
            reject(new Error('Native HEIC parsing timeout'));
        }, 10000); // 10 seconds timeout
    });
}

async function processHeifImage(url, item, tileSize) {
    try {
        // Fetch HEIF data
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        
        let bitmap = null;
        
        // macOS 上優先嘗試原生解析
        if (self.nativeHeicParserAvailable) {
            try {
                console.time('native-heic-parse');
                // 從 URL 提取文件路徑 (去掉 file:// 前綴並解碼)
                const filePath = decodeURIComponent(url.replace('file://', ''));
                const result = await tryNativeHeicParse(filePath);
                console.timeEnd('native-heic-parse');
                
                if (result.success && result.tempFilePath) {
                    const response = await fetch('file://' + result.tempFilePath);
                    const blob = await response.blob();

                    // 透過 OffscreenCanvas + convertToBlob 烘焙 EXIF orientation
                    // 原因：Chromium 的 createImageBitmap 有兩個問題：
                    // 1. createImageBitmap(blob) 的 sub-region crop 對帶 EXIF 旋轉的圖片會 tile 錯亂
                    // 2. createImageBitmap(canvas) 產出的 bitmap 在 transfer/clone 後縮放會全黑
                    // 解法：canvas → convertToBlob (無 EXIF 的乾淨 JPEG) → createImageBitmap
                    const tempBitmap = await createImageBitmap(blob);
                    const canvas = new OffscreenCanvas(tempBitmap.width, tempBitmap.height);
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(tempBitmap, 0, 0);
                    tempBitmap.close();
                    const bakedBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
                    bitmap = await createImageBitmap(bakedBlob);

                    console.log('Successfully parsed HEIC using native macOS API:', bitmap.width, 'x', bitmap.height);
                }
            } catch (error) {
                console.warn('Native HEIC parsing failed, falling back to libheif:', error);
            }
        }
        
        // 如果原生解析失敗，使用 libheif 備援
        if (!bitmap) {
            console.log('Using libheif fallback for HEIC parsing');
            
            // Dynamically load libheif and heic2bitmap libraries only when needed
            if (!self.libheif) {
                importScripts("./libheif.js");
            }
            if (!self.heic2bitmap) {
                importScripts("./heic2bitmap-worker.js");
            }
            
            // Convert HEIF directly to ImageBitmap (no canvas intermediate step)
            // Use simple relative path since WASM file is in same directory
            const { bitmap: libheifBitmap } = await heic2bitmap(arrayBuffer, './libheif.wasm');
            bitmap = libheifBitmap;
        }
        
        // Check for EXIF orientation (HEIF files can have EXIF too)
        let orientation = null;
        try {
            // HEIF orientation processing would be similar to JPEG
            // For now, we'll skip this as heic2canvas may already handle it
        } catch (error) {}
        
        // Apply orientation if needed
        if (orientation && orientation !== 1) {
            bitmap = await convertToNewBitmap(bitmap);
        }
        
        const bitmapWidth = bitmap.width;
        const bitmapHeight = bitmap.height;
        let cloneBitmap = await createImageBitmap(bitmap);

        const cols = Math.ceil(bitmapWidth / tileSize);
        const rows = Math.ceil(bitmapHeight / tileSize);
        const totalTiles = cols * rows;

        postMessage({
            bitmap,
            orientation,
            usingImgTag: false,
            viewportBitmap: null,
            totalTiles,
            imageWidth: bitmapWidth,
            imageHeight: bitmapHeight
        }, [bitmap]);

        const tiles = await generateBitmapTiles(cloneBitmap, tileSize, orientation);
        postMessage({ tiles }, [...tiles.map(tile => tile.tile)]);

        if (totalTiles > 50) {
            const viewportBitmap = await createViewportBitmap(cloneBitmap);
            if (viewportBitmap) {
                postMessage({ viewportBitmap }, [viewportBitmap]);
            }
        }

        URL.revokeObjectURL(url);
    } catch (error) {
        postMessage({ error: 'Failed to load or process HEIF image' });
        console.error('HEIF processing error:', error);
    }
}

async function processTifImage(url, item, tileSize) {
    try {
        // Dynamically load UTIF library only when needed
        if (!self.UTIF) {
            importScripts("../../../my_modules/utif/UTIF.js");
            try {
                importScripts("../../../my_modules/utif/UDOC.js");
            } catch(e) {
                // UDOC is optional for better CMYK support
            }
        }
        
        // Fetch TIF data
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        
        // Decode TIF using UTIF
        const ifds = UTIF.decode(arrayBuffer);
        UTIF.decodeImage(arrayBuffer, ifds[0]);
        const rgba = UTIF.toRGBA8(ifds[0]);
        
        // Get dimensions
        const width = ifds[0].width;
        const height = ifds[0].height;
        
        // Convert RGBA data to ImageData
        const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
        
        // Create ImageBitmap from ImageData
        let bitmap = await createImageBitmap(imageData);
        
        // Check for EXIF orientation (TIF files can have EXIF too)
        let orientation = null;
        try {
            // TIF files can also have orientation tags
            if (ifds[0].t274) {
                orientation = ifds[0].t274[0];
            }
        } catch (error) {}
        
        // Apply orientation if needed
        if (orientation && orientation !== 1) {
            bitmap = await convertToNewBitmap(bitmap);
        }
        
        const bitmapWidth = bitmap.width;
        const bitmapHeight = bitmap.height;
        let cloneBitmap = await createImageBitmap(bitmap);

        const cols = Math.ceil(bitmapWidth / tileSize);
        const rows = Math.ceil(bitmapHeight / tileSize);
        const totalTiles = cols * rows;

        postMessage({
            bitmap,
            orientation,
            usingImgTag: false,
            viewportBitmap: null,
            totalTiles,
            imageWidth: bitmapWidth,
            imageHeight: bitmapHeight
        }, [bitmap]);

        const tiles = await generateBitmapTiles(cloneBitmap, tileSize, orientation);
        postMessage({ tiles }, [...tiles.map(tile => tile.tile)]);

        if (totalTiles > 50) {
            const viewportBitmap = await createViewportBitmap(cloneBitmap);
            if (viewportBitmap) {
                postMessage({ viewportBitmap }, [viewportBitmap]);
            }
        }

        URL.revokeObjectURL(url);
    } catch (error) {
        postMessage({ error: 'Failed to load or process TIF image' });
        console.error('TIF processing error:', error);
    }
}

(function (window) {
    "use strict";
    var that = {};
    that.version = "1.0.4";

    that.load = function (data) {
        var input_data;
        
        if (typeof (data) == "string") {
            if (data.slice(0, 2) == "\xff\xd8") {
                input_data = data;
            } else if (data.slice(0, 23) == "data:image/jpeg;base64," || data.slice(0, 22) == "data:image/jpg;base64,") {
                // console.time("atob");
                input_data = atob(data.split(",")[1]);
                // console.timeEnd("atob");
            } else if (data.slice(0, 4) == "Exif") {
                input_data = data.slice(6);
            } else {
                throw new Error("'load' gots invalid file data.");
            }
        } else {
            throw new Error("'load' gots invalid type argument.");
        }

        var exifDict = {};
        var exif_dict = {
            "0th": {},
            "Exif": {},
            "GPS": {},
            "Interop": {},
            "1st": {},
            "thumbnail": null
        };
        var exifReader = new ExifReader(input_data);
        if (exifReader.tiftag === null) {
            return exif_dict;
        }

        if (exifReader.tiftag.slice(0, 2) == "\x49\x49") {
            exifReader.endian_mark = "<";
        } else {
            exifReader.endian_mark = ">";
        }

        var pointer = unpack(exifReader.endian_mark + "L",
            exifReader.tiftag.slice(4, 8))[0];
        exif_dict["0th"] = exifReader.get_ifd(pointer, "0th");

        var first_ifd_pointer = exif_dict["0th"]["first_ifd_pointer"];
        delete exif_dict["0th"]["first_ifd_pointer"];

        if (34665 in exif_dict["0th"]) {
            pointer = exif_dict["0th"][34665];
            exif_dict["Exif"] = exifReader.get_ifd(pointer, "Exif");
        }
        if (34853 in exif_dict["0th"]) {
            pointer = exif_dict["0th"][34853];
            exif_dict["GPS"] = exifReader.get_ifd(pointer, "GPS");
        }
        if (40965 in exif_dict["Exif"]) {
            pointer = exif_dict["Exif"][40965];
            exif_dict["Interop"] = exifReader.get_ifd(pointer, "Interop");
        }
        if (first_ifd_pointer != "\x00\x00\x00\x00") {
            pointer = unpack(exifReader.endian_mark + "L",
                first_ifd_pointer)[0];
            exif_dict["1st"] = exifReader.get_ifd(pointer, "1st");
            if ((513 in exif_dict["1st"]) && (514 in exif_dict["1st"])) {
                var end = exif_dict["1st"][513] + exif_dict["1st"][514];
                var thumb = exifReader.tiftag.slice(exif_dict["1st"][513], end);
                exif_dict["thumbnail"] = thumb;
            }
        }

        return exif_dict;
    };


    that.dump = function (exif_dict_original) {
        var TIFF_HEADER_LENGTH = 8;

        var exif_dict = copy(exif_dict_original);
        var header = "Exif\x00\x00\x4d\x4d\x00\x2a\x00\x00\x00\x08";
        var exif_is = false;
        var gps_is = false;
        var interop_is = false;
        var first_is = false;

        var zeroth_ifd,
            exif_ifd,
            interop_ifd,
            gps_ifd,
            first_ifd;
        
        if ("0th" in exif_dict) {
            zeroth_ifd = exif_dict["0th"];
        } else {
            zeroth_ifd = {};
        }
        
        if ((("Exif" in exif_dict) && (Object.keys(exif_dict["Exif"]).length)) ||
            (("Interop" in exif_dict) && (Object.keys(exif_dict["Interop"]).length))) {
            zeroth_ifd[34665] = 1;
            exif_is = true;
            exif_ifd = exif_dict["Exif"];
            if (("Interop" in exif_dict) && Object.keys(exif_dict["Interop"]).length) {
                exif_ifd[40965] = 1;
                interop_is = true;
                interop_ifd = exif_dict["Interop"];
            } else if (Object.keys(exif_ifd).indexOf(that.ExifIFD.InteroperabilityTag.toString()) > -1) {
                delete exif_ifd[40965];
            }
        } else if (Object.keys(zeroth_ifd).indexOf(that.ImageIFD.ExifTag.toString()) > -1) {
            delete zeroth_ifd[34665];
        }

        if (("GPS" in exif_dict) && (Object.keys(exif_dict["GPS"]).length)) {
            zeroth_ifd[that.ImageIFD.GPSTag] = 1;
            gps_is = true;
            gps_ifd = exif_dict["GPS"];
        } else if (Object.keys(zeroth_ifd).indexOf(that.ImageIFD.GPSTag.toString()) > -1) {
            delete zeroth_ifd[that.ImageIFD.GPSTag];
        }
        
        if (("1st" in exif_dict) &&
            ("thumbnail" in exif_dict) &&
            (exif_dict["thumbnail"] != null)) {
            first_is = true;
            exif_dict["1st"][513] = 1;
            exif_dict["1st"][514] = 1;
            first_ifd = exif_dict["1st"];
        }
        
        var zeroth_set = _dict_to_bytes(zeroth_ifd, "0th", 0);
        var zeroth_length = (zeroth_set[0].length + exif_is * 12 + gps_is * 12 + 4 +
            zeroth_set[1].length);

        var exif_set,
            exif_bytes = "",
            exif_length = 0,
            gps_set,
            gps_bytes = "",
            gps_length = 0,
            interop_set,
            interop_bytes = "",
            interop_length = 0,
            first_set,
            first_bytes = "",
            thumbnail;
        if (exif_is) {
            exif_set = _dict_to_bytes(exif_ifd, "Exif", zeroth_length);
            exif_length = exif_set[0].length + interop_is * 12 + exif_set[1].length;
        }
        if (gps_is) {
            gps_set = _dict_to_bytes(gps_ifd, "GPS", zeroth_length + exif_length);
            gps_bytes = gps_set.join("");
            gps_length = gps_bytes.length;
        }
        if (interop_is) {
            var offset = zeroth_length + exif_length + gps_length;
            interop_set = _dict_to_bytes(interop_ifd, "Interop", offset);
            interop_bytes = interop_set.join("");
            interop_length = interop_bytes.length;
        }
        if (first_is) {
            var offset = zeroth_length + exif_length + gps_length + interop_length;
            first_set = _dict_to_bytes(first_ifd, "1st", offset);
            // thumbnail = _get_thumbnail(exif_dict["thumbnail"]);
            if (thumbnail.length > 64000) {
                throw new Error("Given thumbnail is too large. max 64kB");
            }
        }

        var exif_pointer = "",
            gps_pointer = "",
            interop_pointer = "",
            first_ifd_pointer = "\x00\x00\x00\x00";
        if (exif_is) {
            var pointer_value = TIFF_HEADER_LENGTH + zeroth_length;
            var pointer_str = pack(">L", [pointer_value]);
            var key = 34665;
            var key_str = pack(">H", [key]);
            var type_str = pack(">H", [TYPES["Long"]]);
            var length_str = pack(">L", [1]);
            exif_pointer = key_str + type_str + length_str + pointer_str;
        }
        if (gps_is) {
            var pointer_value = TIFF_HEADER_LENGTH + zeroth_length + exif_length;
            var pointer_str = pack(">L", [pointer_value]);
            var key = 34853;
            var key_str = pack(">H", [key]);
            var type_str = pack(">H", [TYPES["Long"]]);
            var length_str = pack(">L", [1]);
            gps_pointer = key_str + type_str + length_str + pointer_str;
        }
        if (interop_is) {
            var pointer_value = (TIFF_HEADER_LENGTH +
                zeroth_length + exif_length + gps_length);
            var pointer_str = pack(">L", [pointer_value]);
            var key = 40965;
            var key_str = pack(">H", [key]);
            var type_str = pack(">H", [TYPES["Long"]]);
            var length_str = pack(">L", [1]);
            interop_pointer = key_str + type_str + length_str + pointer_str;
        }
        if (first_is) {
            var pointer_value = (TIFF_HEADER_LENGTH + zeroth_length +
                exif_length + gps_length + interop_length);
            first_ifd_pointer = pack(">L", [pointer_value]);
            var thumbnail_pointer = (pointer_value + first_set[0].length + 24 +
                4 + first_set[1].length);
            var thumbnail_p_bytes = ("\x02\x01\x00\x04\x00\x00\x00\x01" +
                pack(">L", [thumbnail_pointer]));
            var thumbnail_length_bytes = ("\x02\x02\x00\x04\x00\x00\x00\x01" +
                pack(">L", [thumbnail.length]));
            first_bytes = (first_set[0] + thumbnail_p_bytes +
                thumbnail_length_bytes + "\x00\x00\x00\x00" +
                first_set[1] + thumbnail);
        }

        var zeroth_bytes = (zeroth_set[0] + exif_pointer + gps_pointer +
            first_ifd_pointer + zeroth_set[1]);
        if (exif_is) {
            exif_bytes = exif_set[0] + interop_pointer + exif_set[1];
        }

        return (header + zeroth_bytes + exif_bytes + gps_bytes +
            interop_bytes + first_bytes);
    };


    function copy(obj) {
        return JSON.parse(JSON.stringify(obj));
    }


    function _get_thumbnail(jpeg) {
        var segments = splitIntoSegments(jpeg);
        while (("\xff\xe0" <= segments[1].slice(0, 2)) && (segments[1].slice(0, 2) <= "\xff\xef")) {
            segments = [segments[0]].concat(segments.slice(2));
        }
        return segments.join("");
    }


    function _pack_byte(array) {
        return pack(">" + nStr("B", array.length), array);
    }


    function _pack_short(array) {
        return pack(">" + nStr("H", array.length), array);
    }


    function _pack_long(array) {
        return pack(">" + nStr("L", array.length), array);
    }


    function _value_to_bytes(raw_value, value_type, offset) {
        var four_bytes_over = "";
        var value_str = "";
        var length,
            new_value,
            num,
            den;

        if (value_type == "Byte") {
            length = raw_value.length;
            if (length <= 4) {
                value_str = (_pack_byte(raw_value) +
                    nStr("\x00", 4 - length));
            } else {
                value_str = pack(">L", [offset]);
                four_bytes_over = _pack_byte(raw_value);
            }
        } else if (value_type == "Short") {
            length = raw_value.length;
            if (length <= 2) {
                value_str = (_pack_short(raw_value) +
                    nStr("\x00\x00", 2 - length));
            } else {
                value_str = pack(">L", [offset]);
                four_bytes_over = _pack_short(raw_value);
            }
        } else if (value_type == "Long") {
            length = raw_value.length;
            if (length <= 1) {
                value_str = _pack_long(raw_value);
            } else {
                value_str = pack(">L", [offset]);
                four_bytes_over = _pack_long(raw_value);
            }
        } else if (value_type == "Ascii") {
            new_value = raw_value + "\x00";
            length = new_value.length;
            if (length > 4) {
                value_str = pack(">L", [offset]);
                four_bytes_over = new_value;
            } else {
                value_str = new_value + nStr("\x00", 4 - length);
            }
        } else if (value_type == "Rational") {
            if (typeof (raw_value[0]) == "number") {
                length = 1;
                num = raw_value[0];
                den = raw_value[1];
                new_value = pack(">L", [num]) + pack(">L", [den]);
            } else {
                length = raw_value.length;
                new_value = "";
                for (var n = 0; n < length; n++) {
                    num = raw_value[n][0];
                    den = raw_value[n][1];
                    new_value += (pack(">L", [num]) +
                        pack(">L", [den]));
                }
            }
            value_str = pack(">L", [offset]);
            four_bytes_over = new_value;
        } else if (value_type == "SRational") {
            if (typeof (raw_value[0]) == "number") {
                length = 1;
                num = raw_value[0];
                den = raw_value[1];
                new_value = pack(">l", [num]) + pack(">l", [den]);
            } else {
                length = raw_value.length;
                new_value = "";
                for (var n = 0; n < length; n++) {
                    num = raw_value[n][0];
                    den = raw_value[n][1];
                    new_value += (pack(">l", [num]) +
                        pack(">l", [den]));
                }
            }
            value_str = pack(">L", [offset]);
            four_bytes_over = new_value;
        } else if (value_type == "Undefined") {
            length = raw_value.length;
            if (length > 4) {
                value_str = pack(">L", [offset]);
                four_bytes_over = raw_value;
            } else {
                value_str = raw_value + nStr("\x00", 4 - length);
            }
        }

        var length_str = pack(">L", [length]);

        return [length_str, value_str, four_bytes_over];
    }

    function _dict_to_bytes(ifd_dict, ifd, ifd_offset) {
        var TIFF_HEADER_LENGTH = 8;
        var tag_count = Object.keys(ifd_dict).length;
        var entry_header = pack(">H", [tag_count]);
        var entries_length;
        if (["0th", "1st"].indexOf(ifd) > -1) {
            entries_length = 2 + tag_count * 12 + 4;
        } else {
            entries_length = 2 + tag_count * 12;
        }
        var entries = "";
        var values = "";
        var key;

        for (var key in ifd_dict) {
            if (typeof (key) == "string") {
                key = parseInt(key);
            }
            if ((ifd == "0th") && ([34665, 34853].indexOf(key) > -1)) {
                continue;
            } else if ((ifd == "Exif") && (key == 40965)) {
                continue;
            } else if ((ifd == "1st") && ([513, 514].indexOf(key) > -1)) {
                continue;
            }

            var raw_value = ifd_dict[key];
            var key_str = pack(">H", [key]);
            var value_type = TAGS[ifd][key]["type"];
            var type_str = pack(">H", [TYPES[value_type]]);

            if (typeof (raw_value) == "number") {
                raw_value = [raw_value];
            }
            var offset = TIFF_HEADER_LENGTH + entries_length + ifd_offset + values.length;
            var b = _value_to_bytes(raw_value, value_type, offset);
            var length_str = b[0];
            var value_str = b[1];
            var four_bytes_over = b[2];

            entries += key_str + type_str + length_str + value_str;
            values += four_bytes_over;
        }

        return [entry_header + entries, values];
    }



    function ExifReader(data) {
        var segments,
            app1;
        if (data.slice(0, 2) == "\xff\xd8") { // JPEG
            segments = splitIntoSegments(data);
            app1 = getExifSeg(segments);
            if (app1) {
                this.tiftag = app1.slice(10);
            } else {
                this.tiftag = null;
            }
        } else if (["\x49\x49", "\x4d\x4d"].indexOf(data.slice(0, 2)) > -1) { // TIFF
            this.tiftag = data;
        } else if (data.slice(0, 4) == "Exif") { // Exif
            this.tiftag = data.slice(6);
        } else {
            throw new Error("Given file is neither JPEG nor TIFF.");
        }
    }

    ExifReader.prototype = {
        get_ifd: function (pointer, ifd_name) {
            var ifd_dict = {};
            var tag_count = unpack(this.endian_mark + "H",
                this.tiftag.slice(pointer, pointer + 2))[0];
            var offset = pointer + 2;
            var t;
            if (["0th", "1st"].indexOf(ifd_name) > -1) {
                t = "Image";
            } else {
                t = ifd_name;
            }

            for (var x = 0; x < tag_count; x++) {
                pointer = offset + 12 * x;
                var tag = unpack(this.endian_mark + "H",
                    this.tiftag.slice(pointer, pointer + 2))[0];
                var value_type = unpack(this.endian_mark + "H",
                    this.tiftag.slice(pointer + 2, pointer + 4))[0];
                var value_num = unpack(this.endian_mark + "L",
                    this.tiftag.slice(pointer + 4, pointer + 8))[0];
                var value = this.tiftag.slice(pointer + 8, pointer + 12);

                var v_set = [value_type, value_num, value];
                if (tag in TAGS[t]) {
                    ifd_dict[tag] = this.convert_value(v_set);
                }
            }

            if (ifd_name == "0th") {
                pointer = offset + 12 * tag_count;
                ifd_dict["first_ifd_pointer"] = this.tiftag.slice(pointer, pointer + 4);
            }

            return ifd_dict;
        },

        convert_value: function (val) {
            var data = null;
            var t = val[0];
            var length = val[1];
            var value = val[2];
            var pointer;

            if (t == 1) { // BYTE
                if (length > 4) {
                    pointer = unpack(this.endian_mark + "L", value)[0];
                    data = unpack(this.endian_mark + nStr("B", length),
                        this.tiftag.slice(pointer, pointer + length));
                } else {
                    data = unpack(this.endian_mark + nStr("B", length), value.slice(0, length));
                }
            } else if (t == 2) { // ASCII
                if (length > 4) {
                    pointer = unpack(this.endian_mark + "L", value)[0];
                    data = this.tiftag.slice(pointer, pointer + length - 1);
                } else {
                    data = value.slice(0, length - 1);
                }
            } else if (t == 3) { // SHORT
                if (length > 2) {
                    pointer = unpack(this.endian_mark + "L", value)[0];
                    data = unpack(this.endian_mark + nStr("H", length),
                        this.tiftag.slice(pointer, pointer + length * 2));
                } else {
                    data = unpack(this.endian_mark + nStr("H", length),
                        value.slice(0, length * 2));
                }
            } else if (t == 4) { // LONG
                if (length > 1) {
                    pointer = unpack(this.endian_mark + "L", value)[0];
                    data = unpack(this.endian_mark + nStr("L", length),
                        this.tiftag.slice(pointer, pointer + length * 4));
                } else {
                    data = unpack(this.endian_mark + nStr("L", length),
                        value);
                }
            } else if (t == 5) { // RATIONAL
                pointer = unpack(this.endian_mark + "L", value)[0];
                if (length > 1) {
                    data = [];
                    for (var x = 0; x < length; x++) {
                        data.push([unpack(this.endian_mark + "L",
                                this.tiftag.slice(pointer + x * 8, pointer + 4 + x * 8))[0],
                                   unpack(this.endian_mark + "L",
                                this.tiftag.slice(pointer + 4 + x * 8, pointer + 8 + x * 8))[0]
                                   ]);
                    }
                } else {
                    data = [unpack(this.endian_mark + "L",
                            this.tiftag.slice(pointer, pointer + 4))[0],
                            unpack(this.endian_mark + "L",
                            this.tiftag.slice(pointer + 4, pointer + 8))[0]
                            ];
                }
            } else if (t == 7) { // UNDEFINED BYTES
                if (length > 4) {
                    pointer = unpack(this.endian_mark + "L", value)[0];
                    data = this.tiftag.slice(pointer, pointer + length);
                } else {
                    data = value.slice(0, length);
                }
            } else if (t == 9) { // SLONG
                if (length > 1) {
                    pointer = unpack(this.endian_mark + "L", value)[0];
                    data = unpack(this.endian_mark + nStr("l", length),
                        this.tiftag.slice(pointer, pointer + length * 4));
                } else {
                    data = unpack(this.endian_mark + nStr("l", length),
                        value);
                }
            } else if (t == 10) { // SRATIONAL
                pointer = unpack(this.endian_mark + "L", value)[0];
                if (length > 1) {
                    data = [];
                    for (var x = 0; x < length; x++) {
                        data.push([unpack(this.endian_mark + "l",
                                this.tiftag.slice(pointer + x * 8, pointer + 4 + x * 8))[0],
                                   unpack(this.endian_mark + "l",
                                this.tiftag.slice(pointer + 4 + x * 8, pointer + 8 + x * 8))[0]
                                  ]);
                    }
                } else {
                    data = [unpack(this.endian_mark + "l",
                            this.tiftag.slice(pointer, pointer + 4))[0],
                            unpack(this.endian_mark + "l",
                            this.tiftag.slice(pointer + 4, pointer + 8))[0]
                           ];
                }
            } else {
                throw new Error("Exif might be wrong. Got incorrect value " +
                    "type to decode. type:" + t);
            }

            if ((data instanceof Array) && (data.length == 1)) {
                return data[0];
            } else {
                return data;
            }
        },
    };


    if (typeof window !== "undefined" && typeof window.btoa === "function") {
        var btoa = window.btoa;
    }
    if (typeof btoa === "undefined") {
        var btoa = function (input) {        var output = "";
            var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
            var i = 0;
            var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

            while (i < input.length) {

                chr1 = input.charCodeAt(i++);
                chr2 = input.charCodeAt(i++);
                chr3 = input.charCodeAt(i++);

                enc1 = chr1 >> 2;
                enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
                enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
                enc4 = chr3 & 63;

                if (isNaN(chr2)) {
                    enc3 = enc4 = 64;
                } else if (isNaN(chr3)) {
                    enc4 = 64;
                }

                output = output +
                keyStr.charAt(enc1) + keyStr.charAt(enc2) +
                keyStr.charAt(enc3) + keyStr.charAt(enc4);

            }

            return output;
        };
    }
    
    
    if (typeof window !== "undefined" && typeof window.atob === "function") {
        var atob = window.atob;
    }
    if (typeof atob === "undefined") {
        var atob = function (input) {
            var output = "";
            var chr1, chr2, chr3;
            var enc1, enc2, enc3, enc4;
            var i = 0;
            var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

            input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

            while (i < input.length) {

                enc1 = keyStr.indexOf(input.charAt(i++));
                enc2 = keyStr.indexOf(input.charAt(i++));
                enc3 = keyStr.indexOf(input.charAt(i++));
                enc4 = keyStr.indexOf(input.charAt(i++));

                chr1 = (enc1 << 2) | (enc2 >> 4);
                chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
                chr3 = ((enc3 & 3) << 6) | enc4;

                output = output + String.fromCharCode(chr1);

                if (enc3 != 64) {
                    output = output + String.fromCharCode(chr2);
                }
                if (enc4 != 64) {
                    output = output + String.fromCharCode(chr3);
                }

            }

            return output;
        };
    }


    function getImageSize(imageArray) {
        var segments = slice2Segments(imageArray);
        var seg,
            width,
            height,
            SOF = [192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207];

        for (var x = 0; x < segments.length; x++) {
            seg = segments[x];
            if (SOF.indexOf(seg[1]) >= 0) {
                height = seg[5] * 256 + seg[6];
                width = seg[7] * 256 + seg[8];
                break;
            }
        }
        return [width, height];
    }


    function pack(mark, array) {
        if (!(array instanceof Array)) {
            throw new Error("'pack' error. Got invalid type argument.");
        }
        if ((mark.length - 1) != array.length) {
            throw new Error("'pack' error. " + (mark.length - 1) + " marks, " + array.length + " elements.");
        }

        var littleEndian;
        if (mark[0] == "<") {
            littleEndian = true;
        } else if (mark[0] == ">") {
            littleEndian = false;
        } else {
            throw new Error("");
        }
        var packed = "";
        var p = 1;
        var val = null;
        var c = null;
        var valStr = null;

        while (c = mark[p]) {
            if (c.toLowerCase() == "b") {
                val = array[p - 1];
                if ((c == "b") && (val < 0)) {
                    val += 0x100;
                }
                if ((val > 0xff) || (val < 0)) {
                    throw new Error("'pack' error.");
                } else {
                    valStr = String.fromCharCode(val);
                }
            } else if (c == "H") {
                val = array[p - 1];
                if ((val > 0xffff) || (val < 0)) {
                    throw new Error("'pack' error.");
                } else {
                    valStr = String.fromCharCode(Math.floor((val % 0x10000) / 0x100)) +
                        String.fromCharCode(val % 0x100);
                    if (littleEndian) {
                        valStr = valStr.split("").reverse().join("");
                    }
                }
            } else if (c.toLowerCase() == "l") {
                val = array[p - 1];
                if ((c == "l") && (val < 0)) {
                    val += 0x100000000;
                }
                if ((val > 0xffffffff) || (val < 0)) {
                    throw new Error("'pack' error.");
                } else {
                    valStr = String.fromCharCode(Math.floor(val / 0x1000000)) +
                        String.fromCharCode(Math.floor((val % 0x1000000) / 0x10000)) +
                        String.fromCharCode(Math.floor((val % 0x10000) / 0x100)) +
                        String.fromCharCode(val % 0x100);
                    if (littleEndian) {
                        valStr = valStr.split("").reverse().join("");
                    }
                }
            } else {
                throw new Error("'pack' error.");
            }

            packed += valStr;
            p += 1;
        }

        return packed;
    }

    function unpack(mark, str) {
        if (typeof (str) != "string") {
            throw new Error("'unpack' error. Got invalid type argument.");
        }
        var l = 0;
        for (var markPointer = 1; markPointer < mark.length; markPointer++) {
            if (mark[markPointer].toLowerCase() == "b") {
                l += 1;
            } else if (mark[markPointer].toLowerCase() == "h") {
                l += 2;
            } else if (mark[markPointer].toLowerCase() == "l") {
                l += 4;
            } else {
                throw new Error("'unpack' error. Got invalid mark.");
            }
        }

        if (l != str.length) {
            throw new Error("'unpack' error. Mismatch between symbol and string length. " + l + ":" + str.length);
        }

        var littleEndian;
        if (mark[0] == "<") {
            littleEndian = true;
        } else if (mark[0] == ">") {
            littleEndian = false;
        } else {
            throw new Error("'unpack' error.");
        }
        var unpacked = [];
        var strPointer = 0;
        var p = 1;
        var val = null;
        var c = null;
        var length = null;
        var sliced = "";

        while (c = mark[p]) {
            if (c.toLowerCase() == "b") {
                length = 1;
                sliced = str.slice(strPointer, strPointer + length);
                val = sliced.charCodeAt(0);
                if ((c == "b") && (val >= 0x80)) {
                    val -= 0x100;
                }
            } else if (c == "H") {
                length = 2;
                sliced = str.slice(strPointer, strPointer + length);
                if (littleEndian) {
                    sliced = sliced.split("").reverse().join("");
                }
                val = sliced.charCodeAt(0) * 0x100 +
                    sliced.charCodeAt(1);
            } else if (c.toLowerCase() == "l") {
                length = 4;
                sliced = str.slice(strPointer, strPointer + length);
                if (littleEndian) {
                    sliced = sliced.split("").reverse().join("");
                }
                val = sliced.charCodeAt(0) * 0x1000000 +
                    sliced.charCodeAt(1) * 0x10000 +
                    sliced.charCodeAt(2) * 0x100 +
                    sliced.charCodeAt(3);
                if ((c == "l") && (val >= 0x80000000)) {
                    val -= 0x100000000;
                }
            } else {
                throw new Error("'unpack' error. " + c);
            }

            unpacked.push(val);
            strPointer += length;
            p += 1;
        }

        return unpacked;
    }

    function nStr(ch, num) {
        var str = "";
        for (var i = 0; i < num; i++) {
            str += ch;
        }
        return str;
    }

    function splitIntoSegments(data) {
        if (data.slice(0, 2) != "\xff\xd8") {
            throw new Error("Given data isn't JPEG.");
        }

        var head = 2;
        var segments = ["\xff\xd8"];
        while (true) {
            if (data.slice(head, head + 2) == "\xff\xda") {
                segments.push(data.slice(head));
                break;
            } else {
                var length = unpack(">H", data.slice(head + 2, head + 4))[0];
                var endPoint = head + length + 2;
                segments.push(data.slice(head, endPoint));
                head = endPoint;
            }

            if (head >= data.length) {
                throw new Error("Wrong JPEG data.");
            }
        }
        return segments;
    }


    function getExifSeg(segments) {
        var seg;
        for (var i = 0; i < segments.length; i++) {
            seg = segments[i];
            if (seg.slice(0, 2) == "\xff\xe1" &&
                   seg.slice(4, 10) == "Exif\x00\x00") {
                return seg;
            }
        }
        return null;
    }


    function mergeSegments(segments, exif) {
        var hasExifSegment = false;
        var additionalAPP1ExifSegments = [];

        segments.forEach(function(segment, i) {
            // Replace first occurence of APP1:Exif segment
            if (segment.slice(0, 2) == "\xff\xe1" &&
                segment.slice(4, 10) == "Exif\x00\x00"
            ) {
                if (!hasExifSegment) {
                    segments[i] = exif;
                    hasExifSegment = true;
                } else {
                    additionalAPP1ExifSegments.unshift(i);
                }
            }
        });

        // Remove additional occurences of APP1:Exif segment
        additionalAPP1ExifSegments.forEach(function(segmentIndex) {
            segments.splice(segmentIndex, 1);
        });

        if (!hasExifSegment && exif) {
            segments = [segments[0], exif].concat(segments.slice(1));
        }

        return segments.join("");
    }


    function toHex(str) {
        var hexStr = "";
        for (var i = 0; i < str.length; i++) {
            var h = str.charCodeAt(i);
            var hex = ((h < 10) ? "0" : "") + h.toString(16);
            hexStr += hex + " ";
        }
        return hexStr;
    }


    var TYPES = {
        "Byte": 1,
        "Ascii": 2,
        "Short": 3,
        "Long": 4,
        "Rational": 5,
        "Undefined": 7,
        "SLong": 9,
        "SRational": 10
    };


    var TAGS = {
        'Image': {
            274: {
                'name': 'Orientation',
                'type': 'Short'
            }
        },
        'Exif': {},
        'GPS': {},
        'Interop': {},
    };
    TAGS["0th"] = TAGS["Image"];
    TAGS["1st"] = TAGS["Image"];
    that.TAGS = TAGS;

    
    that.ImageIFD = {
        Orientation:274,
    };

    
    that.ExifIFD = {};


    that.GPSIFD = {};


    that.InteropIFD = {
        InteroperabilityIndex:1,
    };

    that.GPSHelper = {
        degToDmsRational:function (degFloat) {
            var degAbs = Math.abs(degFloat);
            var minFloat = degAbs % 1 * 60;
            var secFloat = minFloat % 1 * 60;
            var deg = Math.floor(degAbs);
            var min = Math.floor(minFloat);
            var sec = Math.round(secFloat * 100);

            return [[deg, 1], [min, 1], [sec, 100]];
        },

        dmsRationalToDeg:function (dmsArray, ref) {
            var sign = (ref === 'S' || ref === 'W') ? -1.0 : 1.0;
            var deg = dmsArray[0][0] / dmsArray[0][1] +
                      dmsArray[1][0] / dmsArray[1][1] / 60.0 +
                      dmsArray[2][0] / dmsArray[2][1] / 3600.0;

            return deg * sign;
        }
    };
    
    
    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = that;
        }
        exports.piexif = that;
    } else {
        self.piexif = that;
    }

})();
