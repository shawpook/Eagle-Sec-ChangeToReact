const fs = require('fs');
const appRoot = require('app-root-path');
const imageSize = require(appRoot.path + '/app/js/utils/imageSize.js');
const nativeThumb = require(appRoot.path + '/app/js/utils/nativeThumb.js');

module.exports = async ({ src, dest, item }) => {
    return new Promise(async (resolve, reject) => {
        try {
			if (process.platform === 'win32') return reject(new Error(`${item.ext} is not supported on Windows.`));

            let result = await nativeThumb.async({ src: src, dest: dest, size: 1080, item: item });

            if (!fs.existsSync(dest)) {
                return reject(new Error(`Thumbnail generate fail.`));
            }

			let thumbSize;
			try {
				thumbSize = await imageSize.async(dest);
			}
			catch (err) {}

            item.width = thumbSize?.width ?? result?.width ?? item.width;
            item.height = thumbSize?.height ?? result?.height ?? item.height;

            return resolve(item);
        }
        catch (err) {
            return reject(err);
        }
    });
}