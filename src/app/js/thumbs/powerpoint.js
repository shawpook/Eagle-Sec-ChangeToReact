const fs = require('fs');
const appRoot = require('app-root-path');
const imageSize = require(appRoot.path + '/app/js/utils/imageSize.js');
const nativeThumb = require(appRoot.path + '/app/js/utils/nativeThumb.js');
const EdgeJS = require(appRoot.path + '/app/js/utils/edge.js');
const { ipcRenderer } = require('electron');

module.exports = async ({ src, dest, item }) => {
    return new Promise(async (resolve, reject) => {
        try {
			let size;
			if (process.platform === 'win32') {
				await ppt2image(src, dest);
				size = await imageSize.async(dest);
			}
			else {
				size = await nativeThumb.async({ src: src, dest: dest, size: 3840, item: item });
			}

			if (!fs.existsSync(dest) || size.width === 0) {
                return reject(new Error(`ppt file thumbnail generate fail.`));
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

async function ppt2image (src, dest) {
	return new Promise(async (resolve, reject) => {
		try {
			let pptPath = src;
			let pptTempPath = `${pptPath}.${Date.now()}`;
			let pptThumbnailPath = dest;

			fse.copySync(pptPath, pptTempPath);

			ipcRenderer.send('electron-info', "[bg] >> generate with C#");
			EdgeJS.generatePPTXThumbnail([pptTempPath, pptThumbnailPath], function (error, result) {
				fse.remove(pptTempPath);
				if (result !== 'success') return reject(new Error(`Can not generate PowerPoint thumbanil with C#`));
				if (!fs.existsSync(pptThumbnailPath)) return reject(new Error(`Can not generate PowerPoint thumbanil with C#`));
				return resolve();
			});
		}
		catch (err) {
			return reject(err);
		}
	});
}