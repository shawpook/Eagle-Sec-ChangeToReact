const fs = require('fs');
const appRoot = require('app-root-path');
const nativeThumb = require(appRoot.path + '/app/js/utils/nativeThumb.js');

module.exports = async ({ src, dest, item }) => {
    return new Promise(async (resolve, reject) => {
        try {

			if (process.platform !== 'darwin') {
				return reject(new Error(`Not support generate iWork file for Windows.`));
			}

			let size = await nativeThumb.async({ src: src, dest: dest, size: 3840, item: item });

			item.height = size?.height || item.height;
			item.width = size?.width || item.width;

			if (!fs.existsSync(dest) || item.width === 0) {
				return reject(new Error(`iWork file thumbnail generate fail.`));
			}

			return resolve(item);
		} 
		catch (err) {
			return reject(err);
		}
    });
}