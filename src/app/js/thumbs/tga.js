const fs = require('fs');
const appRoot = require('app-root-path');
const nativeThumb = require(appRoot.path + '/app/js/utils/nativeThumb.js');
const imageSize = require(appRoot.path + '/app/js/utils/imageSize.js');
const { ipcRenderer } = require('electron');

module.exports = async ({ src, dest, item }) => {
    return new Promise(async (resolve, reject) => {
        try {
            let result;
            try {
                result = await tga2image(src, dest);
            }
            catch (err) {
                try {
                    result = await nativeThumb.async({ src: src, dest: dest, size: 480, item: item });
                    if (!fs.existsSync(dest)) {
                        return reject(new Error(`Can not generate tga file with native method.`));
                    }
                    item.width = result.width;
                    item.height = result.height;
                }
                catch (err) {
                    return reject(err);
                }
            }
            
            // 無法產生縮圖時，改用 native 方式處理
            if (!fs.existsSync(dest)) {
                return reject(new Error(`Tga thumbnail generate fail.`));
            }

            item.width = result?.width ?? item.width;
            item.height = result?.height ?? item.height;

            return resolve(item);
        }
        catch (err) {
            return reject(err);
        }
    });
}

async function tga2image(input, output) {
    return new Promise((resolve, reject) => {
        try {

            var img;
            var data = fs.readFileSync(input);

            try {
                var TgaLoader = require(appRoot.path + "/app/js/vendors/tga.js");
                var tga = new TgaLoader();
                tga.load(data);
                var canvas = tga.getCanvas();
                var ctx = canvas.getContext('2d');
                var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                var base64 = canvas.toDataURL('image/png');
                var buffer = decodeBase64Image(base64).data;
                var isEmpty = tagCanNotRead(imageData);
                if (isEmpty) {
                    throw new Error("tga.js 无法分析，用其它方式制作：" + input);
                }
                fs.writeFileSync(output, buffer);
                return resolve({
                    width: canvas.width,
                    height: canvas.height,
                    buffer: buffer,
                });

            } catch (err) {

                ipcRenderer.send('electron-log', err.stack || err);
                var libtga = require(appRoot.path + "/app/js/vendors/libtga.js")
                try { img = libtga.readFile(data.buffer); }
                catch (err) { }

                try {
                    if (img && !tagCanNotRead(img.imageData)) {
                        var canvas = document.createElement('canvas');
                        var context = canvas.getContext('2d');
                        var imageData = context.createImageData(img.width, img.height);
                        canvas.height = img.height;
                        canvas.width = img.width;
                        imageData.data.set(img.imageData);
                        context.putImageData(imageData, 0, 0);

                        var base64 = canvas.toDataURL('image/png');
                        var buffer = decodeBase64Image(base64).data;
                        fs.writeFileSync(output, buffer);

                        return resolve({
                            width: img.width,
                            height: img.height,
                            buffer: buffer,
                        });
                    }
                    else {
                        return reject(new Error(`Can not procee image data from tga.`))
                    }
                }
                catch (err) {
                    ipcRenderer.send('electron-log', err.stack || err);
                    return reject(err);
                }
            }
        }
        catch (err) {
            ipcRenderer.send('electron-log', err.stack || err);
            return reject(err);
        }
    });
}

function tagCanNotRead (imageData) {
    if (!imageData) {
        return false;
    }
    else {
        var isSame = imageData.every( (val, i, arr) => val === arr[0] );
        return isSame;
    }
};
