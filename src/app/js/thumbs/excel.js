const fs = require('fs');
const appRoot = require('app-root-path');
const imageSize = require(appRoot.path + '/app/js/utils/imageSize.js');
const nativeThumb = require(appRoot.path + '/app/js/utils/nativeThumb.js');
const dllRoot = app.getAppPath().replace("\\resources\\app.asar", "");
const EdgeJS = require(appRoot.path + '/app/js/utils/edge.js');
const { ipcRenderer } = require('electron');
const URL_MODULE = require(appRoot + '/my_modules/url');

module.exports = async ({ src, dest, item }) => {
    return new Promise(async (resolve, reject) => {
        try {
			let size;
			if (process.platform === 'win32') {
				await excel2image(src, dest);
				size = await imageSize.async(dest);
			}
			else {
				size = await nativeThumb.async({ src: src, dest: dest, size: 3840, item: item });
			}

			if (!fs.existsSync(dest) || size.width === 0) {
                return reject(new Error(`excel file thumbnail generate fail.`));
            }

            item.height = size?.height || item.height;
            item.width = size?.width || item.width;

            return resolve(item);
        }
        catch (err) {
            return reject(err);
        }
    });
}

async function excel2image (src, dest) {
	return new Promise(async (resolve, reject) => {
		try {
			let excelPath = src;
			let excelThumbnailPath = dest;
			let pdfPath = excelThumbnailPath + ".pdf";

			EdgeJS.generateExcelThumbnail([excelPath, excelThumbnailPath], async function (error, result) {

				if (result !== 'success') return reject(new Error(`Can not generate excel thumbanil with C#`));

				await pdf2image(pdfPath, excelThumbnailPath);

				if (!fs.existsSync(excelThumbnailPath)) return reject(new Error(`Can not generate excel thumbanil with C#`));

				return resolve();
			});
		}
		catch (err) {
			return reject(err);
		}
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
			pdfjsLib.getDocument(pdfPath).promise.then(function (pdf) {
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