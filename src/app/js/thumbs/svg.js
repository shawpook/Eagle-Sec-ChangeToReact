const fs = require('fs');
const appRoot = require('app-root-path');
const imageSize = require(appRoot.path + '/app/js/utils/imageSize.js');
const URL_MODULE = require(appRoot + '/my_modules/url');

module.exports = async ({ src, dest, item }) => {
    return new Promise(async (resolve, reject) => {
        try {
            let size;
            let data = await svg2png(src, dest);
            try { size = await imageSize.async(src); } catch (err) {}

			// 100k 以下 svg 使用原檔顯示
            if (item.size < 100000) {
                item.removeThumbnail = true;
				item.noThumbnail = true;
            }
			else {
				item.forceThumbnail = true;
				delete item.noThumbnail;
			}

            item.height = size?.height || data.height;
            item.width = size?.width || data.width;

            return resolve(item);
        }
        catch (err) {
            item.noThumbnail = true;
            return resolve(item);
        }
    });
}


async function svg2png (src, output) {
    return new Promise((resolve, reject) => {
        try {
            let $preview = jQuery(`<div class="svg-preview"><img crossorigin="anonymous" src="${URL_MODULE.pathToFileURL(src).href}?t=${Date.now()}"/></div>`)
            $preview.appendTo("body");
            document.body.style.display = "block";

            $preview.find("img").on("error", function (event) {
                return reject(new Error(`Can not load the svg file.`));
            });

            $preview.find("img").on("load", function (event) {
                try {

                    let canvas = document.createElement('canvas');
                    let context = canvas.getContext('2d');
                    let image = this;

                    image.setAttribute("crossOrigin",'Anonymous');

                    canvas.width = image.width;
                    canvas.height = image.height;
                    context.drawImage(image, 0, 0);

                    try {
                        const base64data = canvas.toDataURL("image/webp", 0.75);
                        const buffer = decodeBase64Image(base64data).data;

                        fs.writeFileSync(output, buffer);
                        $preview.remove();

                        return resolve({
                            width: image.width,
                            height: image.height,
                        });
                    }
                    catch (err) {
                        ipcRenderer.invoke('nativeImage.getFileThumbnailBase64', { filePath: src, size: 480 }).then(function(base64) {
                            if (!base64) {
                                return reject(new Error(`Regenerate with nativeImage failed`));
                            }
                            const buffer = decodeBase64Image(base64).data;

                            fs.writeFileSync(output, buffer);
                            $preview.remove();
                            return resolve({
                                width: image.width,
                                height: image.height,
                            });
                        });
                    }
                }
                catch (err) {
                    return reject(err);
                }
            });
        }
        catch (err) {
            return reject(err);
        }
    });
}