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
					size: 1024,
					ext: item.ext
				});
			}
			else {
				const os = require('os');
				const osVersion = os.release() || "";
				const isSequoia = process.platform === 'darwin' && parseInt(osVersion) >= 24;
				if (isSequoia) {
					const qlmanage = require(appRoot + '/app/js/thumbs/qlmanage.js');
					result = await qlmanage({
						src: src,
						dest: dest,
						item: item
					});
				}
				else {
					result = await nativeThumb.async({ src: src, dest: dest, size: 1024, item: item });
				}
			}

			item.height = result?.height || item.height;
			item.width = result?.width || item.width;

			if (!fs.existsSync(dest)) {
                return reject(new Error(`PSD thumbnail generate fail.`));
            }
			
			return resolve(item);
		} 
		catch (err) {
			return reject(err);
		}
    });
}