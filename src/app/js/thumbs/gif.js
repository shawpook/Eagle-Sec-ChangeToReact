const fs = require('fs');
const appRoot = require('app-root-path');
const imageSize = require(appRoot.path + '/app/js/utils/imageSize.js');

module.exports = async ({ src, dest, item }) => {
    return new Promise(async (resolve, reject) => {
        try { 
			let size = await imageSize.async(src);

			item.height = size?.height || item.height;
			item.width = size?.width || item.width;

			await fs.promises.copyFile(src, dest);
			
			return resolve(item);
		} 
		catch (err) {
			return reject(err);
		}
    });
}