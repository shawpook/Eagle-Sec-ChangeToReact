const fs = require('fs');
const appRoot = require('app-root-path');
const imageSize = require(appRoot.path + '/app/js/utils/imageSize.js');
const captureURL = require(appRoot.path + '/app/js/utils/captureHTML.js');
const URL_MODULE = require(appRoot + '/my_modules/url');

module.exports = async ({ src, dest, item, file }) => {
    return new Promise(async (resolve, reject) => {
        try {
            let size;
            let data = await html2image({
				src: src,
				dest: dest,
				item: item
			});

            try { size = await imageSize.async(dest); } catch (err) {}

            // item.height = size?.height || item.height;
            // item.width = size?.width || item.width;
            item.height = 900;
            item.width = 1440;

            return resolve(item);
        }
        catch (err) {
            return reject(err);
        }
    });
}

async function html2image ({ src, dest, item }) {
    return new Promise(async (resolve, reject) => {

		try {
			let url = URL_MODULE.pathToFileURL(src).href;
			let websiteInfo = await captureURL(url);
			base64 = websiteInfo.base64;
			// if (websiteInfo.title) {
			// 	item.name = sanitize(websiteInfo.title).replace(/%/g, "").replace(/&lt;/g,"").replace(/&gt;/g,"").trim();
			// }
			if (!base64) {
				return reject(new Error(`The URL cannot be accessed: ${file.url}`));
			}

			const buffer = decodeBase64Image(base64).data;
			await fs.promises.writeFile(dest, buffer);

			return resolve(item);
		}
		catch (err) {
			return reject(err);
		}
    });
}