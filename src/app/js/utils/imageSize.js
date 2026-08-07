const nativeImage = require('electron').nativeImage;
const path = require('path');
const appRoot = require('app-root-path');
const sizeOf = require(appRoot + '/my_modules/image-size');

module.exports = {
    sync: () => {},
	winAysnc: (filePath) => {
		return new Promise(async (resolve, reject) => {
			EdgeJS.BitmapSize([filePath], function (err, size) {
				if (err || !size) {
					return reject(new Error(`Can not get size from BitmapDecoder.`));
				}
				return resolve({
					width: size[0],
					height: size[1],
				});
			});
		});
	},
	sipsAysnc: (filePath) => {
		return new Promise(async (resolve, reject) => {

			let params = ['-g', 'pixelWidth', '-g', 'pixelHeight', filePath];
			const spawnSync = require('child_process').spawnSync;

			try {
				var stdoutString = spawnSync('sips', params, {
					timeout: 5000
				}).output.toString();

				if (!stdoutString || stdoutString.indexOf("Error") > -1) {
					return reject(new Error(stdoutString));
				}

				else {
					var array = stdoutString.split("\n");
					var width = 0;
					var height = 0;
					array.forEach(function (str) {
						if (str.indexOf("pixelWidth: ") > -1) {
							width = parseInt(str.replace("pixelWidth: ", ""));
						}
						if (str.indexOf("pixelHeight: ") > -1) {
							height = parseInt(str.replace("pixelHeight: ", ""));
						}
					});
					return resolve({
						width: width,
						height: height
					});
				}
			}
			catch (err) {
				ipcRenderer.send('electron-log', "" + err.stack || err);
				console.log(err);
				return reject(err);
			}
		});
	},
	asyncSizeOf: (filePath) => {
		return new Promise(async (resolve, reject) => {
			try {
				var size = await sizeOf(filePath);
				return resolve(size);
			}
			catch (err) {
				return reject(err);
			}
		});
	},
	asyncImageTag: (filePath) => {
		return new Promise(async (resolve, reject) => {
			try {
				var size = await getImageSizeWithImageElement(filePath);
				return resolve(size);
			}
			catch (err) {
				return resolve(err);
			}
		});
	},			
    async: (filePath) => {
        return new Promise(async (resolve, reject) => {
            
            let imageSizes;

            try {
                if (path.extname(filePath) === '.avif') {
                    imageSizes = await getImageSizeWithImageElement(filePath);
                }
                else {
					imageSizes = sizeOf(filePath);
                }
                return resolve(imageSizes);
            }
            catch (err) {

				imageSizes = await getImageSizeWithImageElement(filePath);
				if (imageSizes.width !== 0) return resolve(imageSizes);
                
                const probe = require('probe-image-size');

                imageSizes = probe.sync(filePath);

                if (imageSizes && imageSizes.width > 0) {
                    return resolve(imageSizes);
                }
                else {
                    try {
                        var nativeImg = nativeImage.createFromPath(filePath);
                        resolve(nativeImg.getSize());
                    }
                    catch (err) {
                        resolve({
                            width: 0,
                            height: 0
                        });
                    }
                }
            }
        });
    },
};

async function getImageSizeWithImageElement(filePath) {
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
        img.src = URL_MODULE.pathToFileURL(filePath).href + `?v=${Date.now()}`;
    });
}