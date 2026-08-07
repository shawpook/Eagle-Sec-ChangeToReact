const fs = require('fs');
const appRoot = require('app-root-path');
const modelThumbnail = require(appRoot + '/my_modules/model-thumbnail');
const imageSize = require(appRoot.path + '/app/js/utils/imageSize.js');

module.exports = async ({ src, dest, item, file }) => {
    return new Promise(async (resolve, reject) => {
        try {
			
            let result = await model2image({
				src: src,
				dest: dest,
				item: item,
				size: 1080
			});
			
			if (!fs.existsSync(dest)) {
                return reject(new Error(`3d file thumbnail generate fail.`));
            }

            item.height = result?.height || item.height;
            item.width = result?.width || item.width;

            return resolve(item);
        }
        catch (err) {
            return reject(err);
        }
    });
}


async function model2image ({ src, dest, item, size }) {
	return new Promise(async (resolve, reject) => {
        modelThumbnail.getDataUrl({
            filePath: src,
            type: item.ext,
            size: size,
        }).then(async (base64) => {
			
            try {
                let buffer = decodeBase64Image(base64).data;
                await fs.promises.writeFile(dest, buffer);
				try { 
					let size = await imageSize.async(dest);
					return resolve(size);
				} catch (err) {
					return reject(err);
				}
            }
            catch (err) {
                return reject(err);
            }
        }).catch((err) => {
            return reject(err);
        });
	});
}