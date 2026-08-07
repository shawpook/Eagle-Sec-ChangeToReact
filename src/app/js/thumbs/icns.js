const fs = require('fs');
const appRoot = require('app-root-path');
const icns2png = require(appRoot.path + '/app/js/utils/icns2png.js');
const imageSize = require(appRoot.path + '/app/js/utils/imageSize.js');
const nativeThumb = require(appRoot.path + '/app/js/utils/nativeThumb.js');

module.exports = async ({ src, dest, item }) => {
    return new Promise(async (resolve, reject) => {
        try {
            await icns2png(src, dest);
            let size = await imageSize.async(dest);

            // icns 可能有 jpeg2000 的格式，需要使用 nativeThumb 方式產生縮圖
            if (size.type === 'jp2' && process.platform === 'darwin') {
                // 使用 nativeThumb 方式產生縮圖
                await nativeThumb.async({ src: src, dest: dest, item: item });
                size = await imageSize.async(dest);
            }
			
			if (!fs.existsSync(dest) || size.width === 0) {
                return reject(new Error(`icns file thumbnail generate fail.`));
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