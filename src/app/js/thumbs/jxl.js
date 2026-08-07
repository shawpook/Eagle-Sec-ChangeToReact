const fs = require('fs');
const appRoot = require('app-root-path');
const imageSize = require(appRoot.path + '/app/js/utils/imageSize.js');
const EagleConfig = require(appRoot + '/config.js');

module.exports = async ({ src, dest, item }) => {
    return new Promise(async (resolve, reject) => {
        try { 
			let size = await imageSize.async(src);

			item.height = size?.height || item.height;
			item.width = size?.width || item.width;

			let noThumbnail = (item.width <= EagleConfig.NO_THUMBNAIL_SIZE && item.height <= EagleConfig.NO_THUMBNAIL_SIZE) && (item.size <= EagleConfig.NO_THUMBNAIL_FILE_SIZE);
			if (noThumbnail) {
				item.noThumbnail = true;
			}
			else {
				delete item.noThumbnail;
				await fs.promises.copyFile(src, dest);
			}
			return resolve(item);
		} 
		catch (err) {
			return reject(err);
		}
    });
}