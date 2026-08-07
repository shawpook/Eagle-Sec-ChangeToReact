const fs = require('fs');
const appRoot = require('app-root-path');
const imageSize = require(appRoot.path + '/app/js/utils/imageSize.js');
const nativeThumb = require(appRoot.path + '/app/js/utils/nativeThumb.js');
const dllRoot = app.getAppPath().replace("\\resources\\app.asar", "");

module.exports = async ({ src, dest, item }) => {
    return new Promise(async (resolve, reject) => {
        try {
			let size;
			if (process.platform === 'win32') {
				await word2image(src, dest);
				size = await imageSize.async(dest);
			}
			else {
				size = await nativeThumb.async({ src: src, dest: dest, size: 3840, item: item });
			}

			if (!fs.existsSync(dest) || size.width === 0) {
                return reject(new Error(`word file thumbnail generate fail.`));
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

async function word2image (src, dest) {
	return new Promise(async (resolve, reject) => {
        let exePath = path.normalize(`${dllRoot}/Thumbnail-Word.exe`);
		execFile(exePath, [src, dest], function (error, stdout, stderr) {
			if (stdout.indexOf("success") > -1) {
				return resolve();
			}
			return reject(new Error(`Can not generate word file thumbnail: ${src}, reason: ${stdout}`));
		});
	});
}