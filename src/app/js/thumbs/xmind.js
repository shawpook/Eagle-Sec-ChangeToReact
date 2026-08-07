const appRoot = require('app-root-path');
const imageSize = require(appRoot.path + '/app/js/utils/imageSize.js');
const extractFromZip = require(appRoot + '/my_modules/extract-file-from-zip'); 

module.exports = async ({ src, dest, item }) => {
    return new Promise(async (resolve, reject) => {
        extractFromZip({
            input: src,
            fileName: "Thumbnails/thumbnail.png",
            output: dest
        }, async (err) => {
            if (err) return reject(err);
            try {
                const size = await imageSize.async(dest);
                [item.width, item.height] = [size.width, size.height];
                return resolve(item);
            }
            catch (err) {
                return reject(err);
            }
        });
    });
}