const fs = require('fs');
const appRoot = require('app-root-path');
const nativeThumb = require(appRoot.path + '/app/js/utils/nativeThumb.js');
const magick = require(appRoot.path + '/app/js/utils/magick.js');

module.exports = async ({ src, dest, item }) => {
    return new Promise(async (resolve, reject) => {
        try { 
			let result;

			if (process.platform === 'win32') {
				result = await magick({
					src: src,
					dest: dest,
					size: 1440,
					ext: item.ext
				});
			}
			else {
				result = await nativeThumb.async({ src: src, dest: dest, size: 1440, item: item });
			}

			item.height = result?.height || item.height;
			item.width = result?.width || item.width;

			if (!fs.existsSync(dest)) {
                return reject(new Error(`EPS thumbnail generate fail.`));
            }
			
			return resolve(item);
		} 
		catch (err) {
			return reject(err);
		}
    });
}