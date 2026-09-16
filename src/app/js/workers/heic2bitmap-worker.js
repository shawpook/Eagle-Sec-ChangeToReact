/**
 * 自有协议契约 —— 类型与字符串常量的唯一事实源：
 *   src/app/react/core/workers/protocol.ts
 *
 * 本文件是**经典 script worker**（`new Worker(url)`，无 type: module），没有模块加载器，
 * 无法 import 上面那个 .ts；两端一致性改由 tests/worker-protocol-contract.mjs 用 AST
 * 逐条比对（双向字面量校验）保证：改动本文件的协议字段 / 通道名 / 错误文案而不改
 * protocol.ts，该测试立刻变红。
 *
 * 注意：本文件不是 new Worker() 的入口，而是被 bitmapWorker.js 用 importScripts 装载的
 * 同 Realm 脚本 —— 只安装 self.heic2bitmap 函数，不走消息协议。
 *
 * @protocol-version 1
 * @protocol-module src/app/react/core/workers/protocol.ts
 */

// Web Worker optimized version - direct ArrayBuffer to ImageBitmap
// Skips Canvas creation for better performance

self.heic2bitmap = async (arrayBuffer, wasmPath) => {
    return new Promise(async (resolve, reject) => {
        try {
            // Load libheif if not already loaded
            if (typeof self.libheif === 'undefined') {
                throw new Error('libheif not loaded');
            }
            
            // Initialize libheif with WASM path (defaults to local file)
            const libheifCore = await self.libheif({
                wasmBinaryFile: wasmPath || './libheif.wasm'
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