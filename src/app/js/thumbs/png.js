const fs = require('fs');
const appRoot = require('app-root-path');
const imageSize = require(appRoot.path + '/app/js/utils/imageSize.js');
const EagleConfig = require(appRoot + '/config.js');

module.exports = async ({ src, dest, item }) => {
    return new Promise(async (resolve, reject) => {
        try { 
			let size = await imageSize.async(src);
            const ONE_MB = 1024 * 1024;

			item.height = size?.height || item.height;
			item.width = size?.width || item.width;

			let noThumbnail = (item.width <= EagleConfig.NO_THUMBNAIL_SIZE && item.height <= EagleConfig.NO_THUMBNAIL_SIZE) && (item.size <= EagleConfig.NO_THUMBNAIL_FILE_SIZE);
            // 有一些 PNG 圖片很小張，但檔案卻很大（檔案裡面偷塞模型），這些檔案要強制產生縮圖
            let forceThumbnail = (item.width <= EagleConfig.NO_THUMBNAIL_SIZE && item.height <= EagleConfig.NO_THUMBNAIL_SIZE) && (item.size > ONE_MB);
            
			if (!forceThumbnail && noThumbnail) {
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