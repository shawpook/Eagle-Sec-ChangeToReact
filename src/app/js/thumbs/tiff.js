const fs = require('fs');
const appRoot = require('app-root-path');
const imageSize = require(appRoot.path + '/app/js/utils/imageSize.js');
const nativeThumb = require(appRoot.path + '/app/js/utils/nativeThumb.js');

module.exports = async ({ src, dest, item }) => {
    return new Promise(async (resolve, reject) => {
        try { 
			await nativeThumb.async({ src: src, dest: dest, size: 480, item: item });

			let size = await imageSize.async(src);

			item.height = size?.height || item.height;
			item.width = size?.width || item.width;

			if (!fs.existsSync(dest)) {
                return reject(new Error(`TIF thumbnail generate fail.`));
            }
			
			return resolve(item);
		} 
		catch (err) {
			return reject(err);
		}
    });
}