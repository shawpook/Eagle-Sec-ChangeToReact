const fs = require('fs');
const appRoot = require('app-root-path');
const imageSize = require(appRoot.path + '/app/js/utils/imageSize.js');
const ExifImage = require(appRoot + '/my_modules/exif').ExifImage;
const EagleConfig = require(appRoot + '/config.js');

module.exports = async ({ src, dest, item }) => {
    return new Promise(async (resolve, reject) => {
        try { 
			let nativeSize = await imageSize.asyncImageTag(src);
			let size = nativeSize;

			if (!nativeSize?.width || !nativeSize?.height) {
				size = await imageSize.asyncSizeOf(src);
			}
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

			new ExifImage({ image: src }, function (error, exifData) {
				if (exifData?.image?.Orientation) {
					switch (exifData?.image?.Orientation) {
						case 5:
						case 6:
						case 7:
						case 8:
							// 瀏覽器預設會拿到正確比例，因此不需要調整
							if (!nativeSize?.width) {
								[item.height, item.width] = [size.width, size.height];
							}
						break;
					}
					delete item.orientation;
				}
                else {
                    delete item.orientation;
                }
				return resolve(item);
			});
		} 
		catch (err) {
			return reject(err);
		}
    });
}