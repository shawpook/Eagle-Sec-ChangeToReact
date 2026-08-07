// Web Worker optimized version - direct ArrayBuffer to ImageBitmap
// Skips Canvas creation for better performance

self.heic2bitmap = async (arrayBuffer, wasmPath) => {
    return new Promise(async (resolve, reject) => {
        try {
            // Load libheif if not already loaded
            if (typeof self.libheif === 'undefined') {
                throw new Error('libheif not loaded');
            }
            
            // Initialize libheif with absolute WASM path
            let finalWasmPath = wasmPath;
            if (!finalWasmPath) {
                // Fallback: construct path relative to worker location
                const workerPath = self.location.href;
                const basePath = workerPath.substring(0, workerPath.lastIndexOf('/my_modules/heif/'));
                finalWasmPath = basePath + '/my_modules/heif/libheif.wasm';
            }
            
            const libheifCore = await self.libheif({
                wasmBinaryFile: finalWasmPath
            });

            // 放寬 ipco 子盒數量限制（預設 100，部分 iPhone HEIC 會超過）
            try {
                const limitsPtr = libheifCore._heif_get_global_security_limits();
                if (limitsPtr && libheifCore.HEAP32) {
                    libheifCore.HEAP32[(limitsPtr >> 2) + 15] = 500;
                }
            } catch (e) {}

            // Wait for WASM to be ready
            await new Promise(resolve => setTimeout(resolve, 10));
            const decoder = new libheifCore.HeifDecoder();
            
            // Decode HEIF image
            const imageData = decoder.decode(arrayBuffer);
            const image = imageData[0];

            // Get dimensions
            const [width, height] = [image.get_width(), image.get_height()];

            // Create ImageData directly without Canvas
            const rgbaData = new Uint8ClampedArray(width * height * 4);
            
            // Convert YUV to RGBA directly
            await new Promise((resolveDisplay, rejectDisplay) => {
                // Create a temporary ImageData for the conversion process
                const tempImageData = new ImageData(width, height);
                
                image.display(tempImageData, (convertedImageData) => {
                    try {
                        // Copy the converted data
                        rgbaData.set(convertedImageData.data);
                        resolveDisplay();
                    }
                    catch (e) {
                        rejectDisplay(e);
                    }
                });
            });

            // Create final ImageData
            const finalImageData = new ImageData(rgbaData, width, height);
            
            // Create ImageBitmap directly from ImageData
            const bitmap = await createImageBitmap(finalImageData);

            resolve({
                bitmap: bitmap,
                width: width,
                height: height
            });
        } catch (e) {
            console.error('HEIF to bitmap processing error:', e);
            reject(e);
        }
    });
};