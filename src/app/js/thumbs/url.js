const fs = require('fs');
const appRoot = require('app-root-path');
const imageSize = require(appRoot.path + '/app/js/utils/imageSize.js');
const captureURL = require(appRoot.path + '/app/js/utils/captureURL.js');

module.exports = async ({ src, dest, item, file }) => {
    return new Promise(async (resolve, reject) => {
        try {
			// 直接添加 .url 檔案
			if (!item?.url) {
				try {
					let urlText = fs.readFileSync(src, 'utf-8');
					let url = urlText.replaceAll('\n', '').split("URL=")[1];
					if (url && is.url(url)) {
						item.url = url;
					}
				}
				catch (err) {
					return reject(err);
				}
			}

			if (!item?.url) {
				return reject(new Error(`The file does not contain any URLs.`));
			}

			if (item?.medium) {
				return resolve(item);
			}

            let size;
            let data = await url2image({
				dest: dest,
				file: file,
				item: item
			});

            try { size = await imageSize.async(dest); } catch (err) {}

            item.height = size?.height || item.height;
            item.width = size?.width || item.width;

			if (file?.videoID) {
				item.videoID = file.videoID;
			}

			if (file?.medium) {
				item.medium = file.medium;
			}

			if (file?.videoEmbed) {
				item.embed = file.videoEmbed;
			}

			if (file?.duration) {
				item.duration = file.duration;
			}

            return resolve(item);
        }
        catch (err) {
            return reject(err);
        }
    });
}


async function url2image ({ dest, file, item }) {
    return new Promise(async (resolve, reject) => {

		try {
			let base64 = file?.base64 ?? undefined;
			let url = item.url;
			if (!base64) {
				let websiteInfo = await captureURL(url, {
					width: item.width,
					height: item.height,
				});
				base64 = websiteInfo.base64;
				if (!item.name && websiteInfo.title) {
					item.name = sanitize(websiteInfo.title).replace(/%/g, "").replace(/&lt;/g,"").replace(/&gt;/g,"").trim();
				}
			}
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