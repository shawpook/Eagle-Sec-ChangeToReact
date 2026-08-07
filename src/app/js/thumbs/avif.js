const fs = require('fs');
const appRoot = require('app-root-path');
const imageSize = require(appRoot.path + '/app/js/utils/imageSize.js');
const EagleConfig = require(appRoot + '/config.js');

/**
 * 檢測 AVIF 是否為動畫格式
 * AVIF 動畫的 ftyp box brand 為 "avis"，單幀 AVIF 為 "avif"
 * @param {string} filePath - AVIF 檔案路徑
 * @returns {boolean} - 是否為動畫 AVIF
 */
function isAnimatedAVIF(filePath) {
    try {
        // 讀取檔案前 32 bytes 來檢查 ftyp box
        const fd = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(32);
        fs.readSync(fd, buffer, 0, 32, 0);
        fs.closeSync(fd);

        // ftyp box 結構: [4 bytes size][4 bytes 'ftyp'][4 bytes brand]...
        // brand 位於 offset 8-12
        const brand = buffer.toString('binary', 8, 12).replace('\0', ' ').trim();
        
        // "avis" 表示 AVIF Image Sequence（動畫）
        return brand === 'avis';
    }
    catch (err) {
        return false;
    }
}

module.exports = async ({ src, dest, item }) => {
    return new Promise(async (resolve, reject) => {
        try { 
			let size = await imageSize.async(src);

			item.height = size?.height || item.height;
			item.width = size?.width || item.width;

			// 檢測是否為動畫 AVIF
			let isAnimated = isAnimatedAVIF(src);
			if (isAnimated) {
				item.animated = true;
			}

			let noThumbnail = !isAnimated && (item.width <= EagleConfig.NO_THUMBNAIL_SIZE && item.height <= EagleConfig.NO_THUMBNAIL_SIZE) && (item.size <= EagleConfig.NO_THUMBNAIL_FILE_SIZE);
			if (noThumbnail) {
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