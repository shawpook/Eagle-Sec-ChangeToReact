const path = require('path');
const appRoot = require('app-root-path');

const getExt = (file) => {
	if (!file?.path) return '';

	let extname = path.extname(file.path).toLowerCase();
	let ext = extname.replace(".", "");
    
	if (EagleConfig.SUPPORT_FORMATS[ext]) {
        try {
			const fileType = require(appRoot + '/my_modules/file-type');
			const readChunk = require('read-chunk');
            const buffer = readChunk.sync(file.path, 0, 262);
            const fileExt = fileType(buffer) && fileType(buffer).ext;
            switch (fileExt) {
                case 'jpg':
                    if (ext === 'jfif') {
                        return 'jfif';
                    }
                    else {
                        return 'jpg';
                    }
                break;
                case 'png':
                case 'gif':
                case 'webp':
                case 'heic':
                // NOTE: 很多相機 RAW 檔實際上都是 tif 格式，但這邊為了避免衝突，所以不判斷 tif 格式
                // case 'tif':
                case 'bmp':
                case 'avif':
                    return fileExt;
            }
        }
        catch (err) {}
        return ext;
    }
    else if (extname === '.dmg') { return 'dmg'; }
    // 下载暂存文件 chrome
    else if (extname === '.crdownload') { return undefined; }
    else if (extname === '.aria') { return undefined; }
    else if (extname === '.aria2') { return undefined; }
    // 下载暂存文件 firefox
    else if (extname === '.part') { return undefined; }
    // 下载暂存文件 safari
    else if (extname === '.download') { return undefined; }
    // JPG 格式不可信任，很多 HEIC 圖片莫名 .jpg 結尾，盡可能使用 filetype 判斷，雖然速度會降低...
    else if (extname === '.jpg' || extname === '.jpeg' || extname === '.png') { 
        delete file.type;
    }
    else if (extname === '.gifv') { return 'mp4'; }
    else if (extname === '.ai') { return 'ai'; }
    else if (extname === '.ait') { return 'ait'; }

    if (file.type) {
        if (ext) { file.type = ext; }
        if (file.type.indexOf("image/gif") != -1 || file.type.indexOf("gif") != -1) { return "gif" }
        else if (file.type.indexOf("png") != -1) { return "png" }
        else if (file.type.indexOf("bmp") != -1) { return "bmp" }
        else if (file.type.indexOf("tiff") != -1) { return "tiff" }
        else if (file.type.indexOf("svga") != -1) { return "svga" }
        else if (file.type.indexOf("svg") != -1) { return "svg" }
        else if (file.type.indexOf("webp") != -1) { return "webp" }
        else if (file.type.indexOf("xd") != -1) { return "xd" }
        else if (file.type.indexOf("pdf") != -1) { return "pdf" }
        else if (file.type.indexOf("eps") != -1) { return "eps" }
        else if (file.type.indexOf("keynote") != -1) { return "key" }
        else if (file.type.indexOf("ms-powerpoint") != -1) { return "ppt"; }
        else if (file.type.indexOf("presentation") != -1 && file.type.indexOf("officedocument") !==1 ) { return "pptx"; }
        else if (file.type.indexOf("postscript") != -1 || file.type.indexOf("image/pdf") != -1) {
            var e = ext = extname.replace(".", "");
            switch (e) {
                case 'eps':
                    return 'eps';
                    break;
                case 'ps':
                    return 'ps';
                    break;
                case 'ai':
                    return 'ai';
                    break;
            }
            return "ai"
        }
        else if (file.type.indexOf("photoshop") != -1 || file.type.indexOf("psd") != -1) { return "psd" }
        else if (file.type.indexOf("icns") != -1) { return "icns" }
        else if (file.type.indexOf("ico") != -1) { return "ico" }
        else {
            return ext;
        }
    }
    else {
        try {
			const fileType = require(appRoot + '/my_modules/file-type');
			const readChunk = require('read-chunk');
            let buffer = readChunk.sync(file.path, 0, 262);
            ext = fileType(buffer) && fileType(buffer).ext;
            let issvg = buffer.toString('utf8').indexOf("<svg") !== -1;
            if (issvg) {
                return "svg";
            }
            else if (!ext) {
                ext = extname.replace(".", "");
            }
			if (ext === 'jpeg') {
				ext = 'jpg';
			}
        }
        catch (err) {
            ext = extname.replace(".", "");
        }
        return ext;
    }
};

module.exports = getExt;