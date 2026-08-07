const fs = require('fs');
const path = require('path');
const appRoot = require('app-root-path');
const nativeThumb = require(appRoot.path + '/app/js/utils/nativeThumb.js');
const imageSize = require(appRoot.path + '/app/js/utils/imageSize.js');
const { ipcRenderer } = require('electron');

module.exports = async ({ src, dest, item }) => {
    return new Promise(async (resolve, reject) => {
        try {
            let result;
			// macOS 優先使用 native 方式
			if (process.platform === 'darwin') {
				try {
					result = await nativeThumb.async({ src: src, dest: dest, size: 480, item: item });

					let thumbnailSizes = await imageSize.async(dest);
					let imageSizes = await imageSize.sipsAysnc(src);

					if (
						thumbnailSizes.width > thumbnailSizes.height && imageSizes.width < imageSizes.height || 
						thumbnailSizes.width < thumbnailSizes.height && imageSizes.width > imageSizes.height
					) {
						[imageSizes.width, imageSizes.height] = [imageSizes.height, imageSizes.width];
					}

					item.width = imageSizes?.width ?? item.width;
            		item.height = imageSizes?.height ?? item.height;

					if (imageSizes.width > 0 && fs.existsSync(dest)) {
						return resolve(item);
					}
				}
				catch (err) {}
			}

			result = await heic2image(src, dest);
            
            if (!fs.existsSync(dest)) {
                return reject(new Error(`HEIC thumbnail generate fail.`));
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

async function heic2image(src, dest) {
	return new Promise(async (resolve, reject) => {
		try {
			// Pre-load all required files as strings/buffers
			const libheifScript = fs.readFileSync(path.join(appRoot.path, 'app/js/workers/libheif.js'), 'utf8');
			const wasmBuffer = fs.readFileSync(path.join(appRoot.path, 'app/js/workers/libheif.wasm'));
			
			const workerScript = `
				${libheifScript}
				
				self.onmessage = async function(e) {
					try {
						const { imageArrayBuffer, wasmArrayBuffer } = e.data;
						
						// Create libheif with pre-loaded WASM buffer
						const libheifCore = await libheif({
							wasmBinary: wasmArrayBuffer
						});

						// 放寬 ipco 子盒數量限制（預設 100，部分 iPhone HEIC 會超過）
						try {
							const limitsPtr = libheifCore._heif_get_global_security_limits();
							if (limitsPtr && libheifCore.HEAP32) {
								libheifCore.HEAP32[(limitsPtr >> 2) + 15] = 500;
							}
						} catch (e) {}

						// Small delay for WASM initialization
						await new Promise(resolve => setTimeout(resolve, 5));
						const decoder = new libheifCore.HeifDecoder();
						
						const imageData = decoder.decode(imageArrayBuffer);
						const image = imageData[0];
						
						const width = image.get_width();
						const height = image.get_height();
						
						// Direct RGBA conversion
						const rgbaData = new Uint8ClampedArray(width * height * 4);
						
						await new Promise((resolveDisplay, rejectDisplay) => {
							const tempImageData = new ImageData(width, height);
							
							image.display(tempImageData, (convertedImageData) => {
								try {
									rgbaData.set(convertedImageData.data);
									resolveDisplay();
								} catch (e) {
									rejectDisplay(e);
								}
							});
						});
						
						const finalImageData = new ImageData(rgbaData, width, height);
						const bitmap = await createImageBitmap(finalImageData);
						
						postMessage({ bitmap, width, height }, [bitmap]);
					} catch (error) {
						postMessage({ error: error.message });
					}
				};
			`;
			
			const workerBlob = new Blob([workerScript], { type: 'application/javascript' });
			const workerUrl = URL.createObjectURL(workerBlob);
			const worker = new Worker(workerUrl);
			
			worker.onmessage = (e) => {
				try {
					const { bitmap, width, height, error } = e.data;
					
					if (error) {
						return reject(new Error(error));
					}
					
					// Convert ImageBitmap to canvas
					const canvas = document.createElement('canvas');
					canvas.width = width;
					canvas.height = height;
					const ctx = canvas.getContext('2d');
					ctx.drawImage(bitmap, 0, 0);
					
					// Generate JPEG for better compression
					const base64 = canvas.toDataURL('image/jpeg', 0.8);
					
					// Check base64 is valid and not empty
					if (!base64 || base64.length < 10) {
						return reject('Invalid base64');
					}
					
					fs.writeFileSync(dest, base64.replace(/^data:image\/jpeg;base64,/, ''), 'base64');
					
					resolve({
						width: width,
						height: height,
					});
					
				} catch (err) {
					reject(err);
				} finally {
					worker.terminate();
					URL.revokeObjectURL(workerUrl);
				}
			};
			
			worker.onerror = (error) => {
				worker.terminate();
				URL.revokeObjectURL(workerUrl);
				reject(error);
			};
			
			// Read HEIC file and prepare data for worker
			const heicBuffer = fs.readFileSync(src);
			const imageArrayBuffer = heicBuffer.buffer.slice(heicBuffer.byteOffset, heicBuffer.byteOffset + heicBuffer.byteLength);
			const wasmArrayBuffer = wasmBuffer.buffer.slice(wasmBuffer.byteOffset, wasmBuffer.byteOffset + wasmBuffer.byteLength);
			
			worker.postMessage({ imageArrayBuffer, wasmArrayBuffer }, [imageArrayBuffer, wasmArrayBuffer]);
			
		} catch (err) {
			ipcRenderer.send('electron-log', err.stack || err);
			reject(err);
		}
	});
}