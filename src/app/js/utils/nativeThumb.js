const fs = require('fs');
const path = require('path');
const appRoot = require('app-root-path');
const imageSize = require(appRoot.path + '/app/js/utils/imageSize.js');
const { ipcRenderer } = require('electron');
const SUPPORT_FORMAT = {
	'bmp': true,
	'cur': true,
	'dds': true,
	'gif': true,
	'icns': true,
	'ico': true,
	'j2c': true,
	'jp2': true,
	'jpeg': true,
	'ktx': true,
	'png': true,
	'psd': true,
	'svg': true,
	'tga': true,
	'tiff': true,
	'webp': true,
};

module.exports = {
    async: async ({ src, dest, size, item }) => {
        return new Promise(async (resolve, reject) => {
            await ipcRenderer.invoke('nativeImage.createThumbnailFromPath', {
                tempFilePath: path.normalize(dest),
                filePath: path.normalize(src),
                size: size || 480
            });
            if (fs.existsSync(dest)) {
                try {
                    let size;
					if (SUPPORT_FORMAT[item?.ext]) {
						size = await imageSize.async(src);
						if (size.width === 0) {
							size = await imageSize.async(dest);
						}
					}
					else {
						size = await imageSize.async(dest);
					}
                    return resolve({
                        width: size.width,
                        height: size.height,
                    });
                } catch (err) {
                    return reject(new Error(`Can not get thumbnail size.`));
                }
            }
            else {
                return reject(new Error(`Can not generate thumbnail with native(.NET Framework/Quicklook) method.`));
            }
        });
    }
};