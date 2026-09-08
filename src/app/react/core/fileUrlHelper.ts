import { getBodyScope } from './appCore';
/**
 * c1：FileUrlHelper 逐字移植（bundle 2287 起对象字面量提取；b1 数据面接管前置）。
 * 机械替换：$bodyScope → getBodyScope()；path → window.require('path')（mock 经 shims
 * bareModules，Electron 经 nodeIntegration——与 bundle 内同名全局语义一致）。
 * bundle 的 window.FileUrlHelper 在过渡期共存；React 消费方一律改走本模块 import。
 */
// @ts-nocheck

const path = (window as any).require
  ? (window as any).require('path')
  : (window as any).path;

// URL_MODULE 是 bundle 顶层 const（classic script 的全局词法绑定，**不是 window 属性**，见
// PROGRESS 第 5 节全局契约）。app.bundle.js 从 index.html 摘除后该绑定消失，本模块裸引用即抛
// ReferenceError 并被下方各 try/catch 吞掉 → 所有 raw/thumbnail URL 静默变空串（详情原图
// 无 URL → smoothZoom 不装载 → 交付闸门永不释放）。改为按契约本地解析（同 apiServerDomain
// 的 require(appRoot + '/my_modules/url') 手法，退到 require('url')）。
const URL_MODULE = (() => {
  const req = (window as any).require;
  if (typeof req !== 'function') return (window as any).URL_MODULE;
  const appRoot = (window as any).appRoot;
  const rootPath = appRoot && (appRoot.path || appRoot);
  if (rootPath) {
    try { return req(`${rootPath}/my_modules/url`); } catch (err) { /* 退到内建 url */ }
  }
  try { return req('url'); } catch (err) { return (window as any).URL_MODULE; }
})();

export const FileUrlHelper = {
    getMetadataPath: function (image) {
        try {
            if (!image || !image.name) return "";
            return path.normalize(`${getBodyScope().libraryImagesPath}/${image.id}.info/metadata.json`);
        }
        catch (err) { }
    },
    getRawPath: function (image) {
        try {
            if (!image || !image.name) return "";
            let rawPath = path.normalize(`${getBodyScope().libraryImagesPath}/${image.id}.info/${image.name}.${image.ext}`);
            return rawPath;
        }
        catch (err) { }
    },
    getThumbnailPath: function (image) {
        try {
            if (!image || !image.name) return "";

            if (image.noThumbnail) {
                return FileUrlHelper.getRawPath(image);
            }

            let forceRaw = (image.ext === 'svg' && !image.forceThumbnail);

            if (forceRaw) {
                return FileUrlHelper.getRawPath(image);
            }
            else {
                let thumbnailPath = path.normalize(`${getBodyScope().libraryImagesPath}/${image.id}.info/${image.name}_thumbnail.png`);
                return thumbnailPath;
            }
        }
        catch (err) { }
    },
    getThumbnailUrl: function (image) {
        try {
            var thumbnailPath = FileUrlHelper.getThumbnailPath(image);
            return URL_MODULE.pathToFileURL(thumbnailPath).href;
        }
        catch (err) { }
    },
    getLastestThumbnailUrl: function (image) {
        try {
            let thumbnailUrl = FileUrlHelper.getThumbnailUrl(image);
            if (getBodyScope().modifiedMappings && getBodyScope().modifiedMappings[image.id]) {
                thumbnailUrl = `${thumbnailUrl}?v=${getBodyScope().modifiedMappings[image.id]}`;
            }
            return thumbnailUrl;
        }
        catch (err) { }
    },
    getRawUrl: function (image) {
        try {
            return URL_MODULE.pathToFileURL(FileUrlHelper.getRawPath(image)).href;
        }
        catch (err) { }
    }
}

function getRawPath(imagesDir, image, force) {
    if (!image || !image.name) return;
    var imageDir = imagesDir + image.id + ".info/";
    var rawPath = "";
    var encodeName = encodeURIComponent(image.name);

    if (image.ext === 'svg') {
        rawPath = imageDir + encodeName + ".svg";
    } else {
        rawPath = imageDir + encodeName + "." + image.ext;
    }

    return rawPath.replace(/#/g, '%23');
}

function getThumbnailPath(imagesDir, image) {
    if (!image || !image.name) return;
    if (image.noThumbnail) {
        return getRawPath(imagesDir, image);
    }
    else {

        var imageDir = imagesDir + image.id + ".info/";
        var thumbnailPath = "";
        var encodeName = encodeURIComponent(image.name);

        if (image.ext === 'svg') {
            if (image.forceThumbnail) {
                thumbnailPath = `${imageDir}${encodeName}_thumbnail.png`;
            }
            else {
                thumbnailPath = `${imageDir}${encodeName}.svg`;
            }
        }
        else {
            thumbnailPath = `${imageDir}${encodeName}_thumbnail.png`;
            // thumbnailPath = "http://localhost:41592/?filePath=" + imageDir + encodeName + "_thumbnail.png";
        }

        return thumbnailPath.replace(/#/g, '%23');
    }
}

/**
 * 產生不重複的 ID
 *
 * @return     {<type>}  { 不重複 ID }
 */
function guid() {
    return (Date.now().toString(36) + Math.random().toString(36).substr(2, 5)).toUpperCase();
};
