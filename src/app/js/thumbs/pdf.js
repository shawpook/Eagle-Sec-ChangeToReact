const fs = require('fs');
const appRoot = require('app-root-path');
const nativeThumb = require(appRoot.path + '/app/js/utils/nativeThumb.js');
const { ipcRenderer } = require('electron');
const imageSize = require(appRoot.path + '/app/js/utils/imageSize.js');
const URL_MODULE = require(appRoot + '/my_modules/url');

module.exports = async ({ src, dest, item }) => {
    return new Promise(async (resolve, reject) => {
        try {
            let result;

			// 無法產生縮圖時，改用 native 方式處理
			if (process.platform === 'win32') {
				try {
					result = await pdf2image(src, dest);
				}
				catch (err) {
					ipcRenderer.send('electron-log', `Can not generate pdf thumbnail with pdf2image. ${err?.stack ?? err}`);
					try {
						await generateWithEdge(src, dest);
						result = await imageSize.async(dest);
					}
					catch (err) {
						return reject(err);
					}
				}
			}
			else {
				try {
					result = result = await nativeThumb.async({ src: src, dest: dest, size: 480, item: item });
					if (!fs.existsSync(dest)) {
						return reject(new Error(`Can not generate tga file with native method.`));
					}
				}
				catch (err) {
					try {
						result = await pdf2image(src, dest);
					}
					catch (err) {
						return reject(err);
					}
				}
			}

            if (!fs.existsSync(dest)) {
                return reject(new Error(`PDF thumbnail generate fail.`));
            }

            item.width = result?.width || item.width;
            item.height = result?.height || item.height;

            return resolve(item);
        }
        catch (err) {
            return reject(err);
        }
    });
}

async function generateWithEdge(src, dest) {
    return new Promise((resolve, reject) => {
		EdgeJS.Magick([src, dest], async function (error, result) {
			if (result !== 'success') return reject(new Error(`Can not generate excel thumbanil with C#`));
			return resolve();
		});
	});
}

async function pdf2image(input, output) {
    return new Promise((resolve, reject) => {
        var timeout;
		var hasCallback = false;
		var errorCallback = function (err) {
			hasCallback = true;
			reject(err);
			ipcRenderer.send('electron-log', err.stack || err);
		};

		try {
			var pdfPath = URL_MODULE.pathToFileURL(input).href;
			var pdfjsLib = require(appRoot.path + "/app/pdf-viewer/build/pdf.js");
			pdfjsLib.GlobalWorkerOptions.workerSrc = appRoot.path + "/app/pdf-viewer/build/pdf.worker.js";
			pdfjsLib.getDocument({
				"url": pdfPath,
				"cMapPacked": true,
				"cMapUrl": "../web/cmaps/",
				"disableAutoFetch": false,
				"disableFontFace": false,
				"disableRange": false,
				"disableStream": false,
				"docBaseUrl": "",
				"enableXfa": true,
				"fontExtraProperties": false,
				"isEvalSupported": true,
				"isOffscreenCanvasSupported": true,
				"maxImageSize": -1,
				"pdfBug": false,
				"standardFontDataUrl": "../web/standard_fonts/",
				"verbosity": 1
			}).promise.then(function (pdf) {
				pdf.getPage(1).then(function (page) {
					var canvas = document.createElement("canvas");
					var viewport = page.getViewport({scale: 1.0});
					var context = canvas.getContext('2d');
					canvas.height = viewport.height;
					canvas.width = viewport.width;
					var renderContext = {
						canvasContext: context,
						viewport: viewport,
						intent: 'display'
					};
					currentWindow.show();
					var renderTask = page.render(renderContext);
					renderTask.promise.then(function () {
						
						clearTimeout(timeout);
						if (hasCallback) return;
						var base64 = canvas.toDataURL();
						var decodeData = decodeBase64Image(base64);

						if (!decodeData) {
							errorCallback(new Error("decodeBase64Image undefined"));
							return;
						}

						var buffer = decodeData.data;
						fs.writeFileSync(output, buffer);
						resolve({
							width: canvas.width,
							height: canvas.height,
							buffer: buffer,
						});

						pdf.cleanup();
						pdf.destroy();
						page.cleanup();

					}, function (err) {
						errorCallback(err);
						pdf.cleanup();
						pdf.destroy();
						page.cleanup();
					});
				}, function (err) {
					errorCallback(err);
					pdf.cleanup();
					pdf.destroy();
				})
			}, function (err) {
				errorCallback(err);
			});

			// 超时机制，如果超过 60 秒无法处理，改用其他方式
			timeout = setTimeout(function() {
				errorCallback(new Error("Procee pdf timeout."));
			}, 60000);
		}
		catch (err) {
			errorCallback(err);
		}
    });
}