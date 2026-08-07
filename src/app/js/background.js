console.time("[background] init");
console.time("Load module");

// Global variable
const appRoot = require('app-root-path');
const EagleConfig = require(appRoot + '/config.js');

const { MpvVideoElement } = require(`mpv-video-player`);

const pjson = require(appRoot + '/package.json');
const appVersion = pjson.version;
const buildVersion = pjson.buildVersion;
const buildNumber = pjson.buildNumber;
const prereleaseVersion = pjson.prerelease;

var i18n = new(require(appRoot + '/i18n'));             // 150 ms 🙈
var settings = require(appRoot + '/my_modules/electron-settings');            // 100 ms 🙈 性能杀手
var preferences = settings.getPreferences();

// Node Modules
const fs = require('fs');
const fse = require('fs-extra');  // 45 ms 🙈 性能杀手
const path = require('path');
const exec = require('child_process').exec;
const execFile = require('child_process').execFile;
const os = require('os');
os.tmpDir = os.tmpdir;
const async = require('async');
const sanitize = require(appRoot + '/my_modules/sanitize-filename');
const unrom = require(appRoot.path + '/app/js/utils/unorm.js');

// Electron Modules
const electron = require('electron');
const { ipcRenderer, clipboard, nativeImage } = electron;
const remote = require('@electron/remote');
const { app, dialog, BrowserWindow } = remote;
const currentWindow = remote.getCurrentWindow();

// File processing
var pluginModule = require(`${appRoot}/app/js/plugin`);
const safeCopy = require(appRoot.path + '/app/js/utils/safeCopy.js');
const EdgeJS = require(appRoot.path + '/app/js/utils/edge.js');
// TODO: 重構相關呼叫方式
const captureURL = require(appRoot.path + '/app/js/utils/captureURL.js');
const imageSize = require(appRoot.path + '/app/js/utils/imageSize.js');
const getExt = require(appRoot.path + '/app/js/utils/getExt.js');
const ThumbGenerator = require(appRoot.path + '/app/js/thumbs/thumb.js');
const ColorAnalyzer = require(appRoot.path + '/app/js/analyzer/color-analyzer.js');
const AutoImport = require(appRoot.path + '/app/js/auto-import/auto-import.js');
const Downloader = require(appRoot.path + '/app/js/downloader/downloader.js');
const remainingFilenameLength = require(appRoot.path + '/app/js/utils/remainingFilenameLength.js');

const MTIMENAME = "mtime.json";



const URL_MODULE = require(appRoot + '/my_modules/url');
const ACCESS = require(appRoot + '/my_modules/access');


// TODO: 把所有 Path 相關變數都放在同一個物件管理
const USER_DATA_PATH = app.getPath('userData');
const EAGLE_THUMBNAIL_BACKUP_PATH = path.normalize(USER_DATA_PATH + "/eagle-backup");
const EAGLE_THUMBNAIL_TEMP_PATH = path.normalize(USER_DATA_PATH + "/eagle-temp");
var RESOURCES_PATH;
var isDev = !remote.app.isPackaged;
if (isDev) { RESOURCES_PATH = path.join(appRoot.path, '/build_files/'); }
else { RESOURCES_PATH = path.join(process.resourcesPath); }
if (!fs.existsSync(EAGLE_THUMBNAIL_TEMP_PATH)) {
    try {
        fs.mkdirSync(EAGLE_THUMBNAIL_TEMP_PATH);
    }
    catch (err) {
        ipcRenderer.send('electron-log', `Create ${EAGLE_THUMBNAIL_TEMP_PATH} fail...`);
        ipcRenderer.send('electron-log', err.stack || err);
    }
}
const PATHS = {

};

// TODO: 把 Watcher 獨立到 watcher module
// ImagesWatcher.init();
// MetadataWatcher.init();

// TODO: 把 add file 相關功能獨立成 module
// TODO: 完美情況是建立一個 Library class，提供眾多方法
// library.addFile
// library.load
// library.reload
// library.....


// TODO: 把儲存 metadata.json 相關功能重構，現在命名太怪了

var nsfwUpdateThumbnailTimeout = {};





const tokenSource = require('cancellation');            // 0.8 ms



console.timeEnd("Load module");
ipcRenderer.send('electron-info', `[bg] Modules laoded`);


var _invalidateRequireCacheForFile = function(filePath){
    delete require.cache[require.resolve(filePath)];
};

var requireNoCache =  function(filePath){
    _invalidateRequireCacheForFile(filePath);
    return require(filePath);
};

var appPath = path.normalize(app.getAppPath().replace("\\resources\\app.asar", ""));
var dllRoot = app.getAppPath().replace("\\resources\\app.asar", "");
var userChcaePath;
var metadataWatcherPath;
var mtimeWatcherPath;



let needUpdateCache = false;    // 关闭软件时，是否需要更新缓存

// TODO: 所有當前資源庫相關變數放在這裡
var library = {};
var libraryDir;
var libraryLoaded = false;
var newCacheDir;
var folderCount = 0;
var encryptedFolderCount = 0;
var imagesWatcher;

var importItemDateMap = {};
var metadataQueueImagesMapping = {};        // 用来避免连续修改图片，重复的写入操作，这此采用分身表的方式处理
var lastModifiedTimeMappings = {};
var taskTokens = [];
var openWithInfo = {};
var forceQuit;

// drain callback timeout handles - 提升為模組級以便 cancelAll 切換資源庫時能正確清除
var _drainSaveCacheFileTimeout;
var _drainSaveMtimeFileTimeout;
var _drainWatchSaveCacheFileTimeout;
var _drainTrashQueueTimeout;
var backgroundStateInterbal;
var mainWindowID;


ipcRenderer.on('update-main-window-id', (event, id) => {
    mainWindowID = id;
});

ipcRenderer.on('add-to-history-and-open', (event, path) => {
    addToHisotryAndOpen(path);
});

ipcRenderer.on('reload-without-cache', (event) => {
    reloadWithoutCache();
});

ipcRenderer.on('refresh-library', (event) => {
    if (!library || !library.rootDir) return;

    var mtimeLogsPath = path.normalize(library.rootDir + `/${MTIMENAME}`);
    refreshLibrary(mtimeLogsPath, true);

    var metadataPath = path.normalize(library.rootDir + `/metadata.json`);
    refreshMetadata(metadataPath);

    ipcRenderer.send('electron-info', `[bg] refresh-library: ${library.rootDir}`);
});

console.time("start-load-library");
ipcRenderer.on('start-load-library', () => {
    initLibrary();
    console.timeEnd("start-load-library");
});

ipcRenderer.on('import-inboard', (event, path) => {
    importInboardApp(path);
});

// 清空 temp 資料夾
removeDirAllFiles(EAGLE_THUMBNAIL_TEMP_PATH);
removeDirAllFiles(`${path.normalize(EAGLE_THUMBNAIL_TEMP_PATH + "/preview")}`);
removeDirAllFiles(`${path.normalize(EAGLE_THUMBNAIL_TEMP_PATH + "/thumbs")}`);

function quit () {
    ipcRenderer.send('quit');
}

var saveCacheFile = debounce(function saveCacheFile (callback, ignoreMtime) { 

    if (!libraryLoaded) {
        callback();
        return;
    }

    if (!newCacheDir) {
        callback();
        return;
    }

    if (!library) {
        callback();
        return;
    }

    if (!fs.existsSync(userChcaePath)) {
        fs.mkdirSync(userChcaePath, 0755);
    }

    let mtimeLogsPath = path.normalize(library.rootDir + `/${MTIMENAME}`);

    if (!fs.existsSync(mtimeLogsPath)) {
        createMTimeLogs(() => {
            updateCacheFile(callback);
        });
        return;
    }
    
    if (!ignoreMtime) {
        ipcRenderer.send('electron-info', `[bg] Update mtime.json ...`);
        updateMTimeLogs(function () {
            ipcRenderer.send('electron-info', `[bg] Update mtime.json success`);
            updateCacheFile(callback);
        });
        return;
    }

    updateCacheFile(callback);

}, 250);

function updateCacheFile (callback) {

    var hasCallback = false;
    var finalCallback = function () {
        hasCallback = true;
        needUpdateCache = false;
        callback();
    };

    ipcRenderer.send('electron-info', `[bg] Update library cache: ${newCacheDir}`);
    try {

        if (!needUpdateCache) {
            ipcRenderer.send('electron-info', `[bg] No Changes, ignore update cache.`);
            return finalCallback();
        }

        if (library && library.imagesMapping) {
            console.time("准备输出");

            var tempDir = newCacheDir + "." + Date.now();
            var tempWStream = fs.createWriteStream(tempDir, { flags: 'w' });
            var imgs = Object.keys(library.imagesMapping);
            for (var i = 0; i < imgs.length; i++) {
                var key = imgs[i];
                var imageString = library.imagesMapping[key].replace(/[\r\n]/g, "");
                if (imageString) {
                    tempWStream.write(imageString + "\n");
                }
            }

            tempWStream.on('error', function(err) {
                ipcRenderer.send('electron-info', "[bg] An error has occurred updating library cache");
                ipcRenderer.send('electron-log', "" + err.stack || err);
            });

            tempWStream.on('finish', function () {
                console.timeEnd("准备输出");
                try {
                    if (fs.existsSync(tempDir)) {
                        if (fs.existsSync(newCacheDir) && ACCESS.safeAccessSync(newCacheDir)) {
                            fse.removeSync(newCacheDir);
                        }
                        fse.moveSync(tempDir, newCacheDir, { overwrite: true });
                        ipcRenderer.send('electron-info', `[bg] Update library cache successfully`);
                        // fs.renameSync(tempDir, newCacheDir);
                        if (fs.existsSync(tempDir)) {
                            fse.removeSync(tempDir);
                        }
                        if (!hasCallback) {
                            return finalCallback();
                        }
                    }
                    else {
                        ipcRenderer.send('electron-log', `[bg] Update library cache fail`);
                        if (!hasCallback) {
                            return finalCallback();
                        }
                    }
                }
                catch (err) {
                    ipcRenderer.send('electron-info', "[bg] An error has occurred updating library cache");
                    ipcRenderer.send('electron-log', "" + err.stack || err);
                    if (!hasCallback) {
                        hasCallback = true;
                        // callback();
                    }
                }
            });
            tempWStream.end();
        }
        else {
            if (!hasCallback) {
                return finalCallback();
            }
        }
    }
    catch (err) {
        ipcRenderer.send('electron-info', "[bg] An error has occurred updating library cache");
        ipcRenderer.send('electron-log', "" + err.stack || err);
        hasCallback = true;
        callback();
    }
}

try {
    ipcRenderer.on('before-quit', function () {
        forceQuit = true;
        ipcRenderer.send('electron-info', `[bg] before-quit event`);
        cancelAll(function () {
            saveCacheFile(function () {
                ipcRenderer.send('electron-info', "[bg] ---------------------------------------");
                ipcRenderer.send('process-exit2');
            });
        }, true);
    });
}
catch (err) {
    console.log(err);
    ipcRenderer.send('electron-log', "" + err.stack || err);
}

try {
    ipcRenderer.on('save-cache-file', function () {
        cancelAll(function () {
            saveCacheFile(function () {});
        }, true);
    });
}
catch (err) {
    console.log(err);
    ipcRenderer.send('electron-log', "" + err.stack || err);
}

ipcRenderer.on('analytics.event', function(e, data) {
    if (analytics) {
        analytics.event(data.category, data.action, data.label, data.value || undefined);
    }
});

ipcRenderer.on('cancel.all', function () {
    cancelAll();
});


// 取消批量制作缩略图
ipcRenderer.on('cancel.generate.thumbnail', function () {
    regerateThumbnailQueue.kill();
    regerateThumbnailQueue = async.queue(async.timeout(generateThumbnailQueueCallback, 60000), 4);
});

// 取消 WebP 转档
ipcRenderer.on('cancel.webp.convert', function () {
    webpConvertQueue.kill();
    webpConvertQueue = async.queue(async.timeout(webpConvertQueueCallback, 60000), 10);
});

function cancelAll (callback, quitApp) {

    try {
        for (var i = 0; i < taskTokens.length; i++) {
            var source = taskTokens[i];
            if (source.token.isCancelled()) {
                taskTokens.splice(i, 1);
                i--;
            }
            else {
                source.cancel('Operation cancel');
                // console.log("cancel task");
            }
        }
		
        // 清空 queue，并重新建立 queue
		Downloader.kill();
        processQueue.kill();
        ColorAnalyzer.kill();
        regerateThumbnailQueue.kill();
        writeLibraryQueue.kill();
		trashQueue.kill();
        imageMatadataQueue.kill();
        imagePaletteQueue.kill();

        // 清除所有 drain callback 的 pending timeout，避免切換資源庫後舊 timeout 寫入新資源庫路徑
        clearTimeout(_drainSaveCacheFileTimeout);
        clearTimeout(_drainSaveMtimeFileTimeout);
        clearTimeout(_drainWatchSaveCacheFileTimeout);
        clearTimeout(_drainTrashQueueTimeout);
        clearTimeout(updateMTimeLogsTimeoutByMeta);
        clearTimeout(updateMTimeLogsTimeoutByPalette);

        if (!quitApp) {
            initAllQueue();
        }
        if (callback) {
            callback();
        }
    }
    catch (err) {
        ipcRenderer.send('electron-log', "" + err.stack || err);
        if (callback) {
            callback();
        }
    }
};

ipcRenderer.on('check-for-update', function (event, params) {
    checkForUpdates(params);
});

ipcRenderer.on('screencapture', async (event, params) => {
    if (!library || !library.rootDir) return;
    const item = await eagle.screenCapture.capture({
        mode: params.mode,
        item: params.image
    });

    // 是否显示收藏视窗
    if (preferences.general.showCaptureCollectModal === 'true' && params?.mode !== 3) {
        ipcRenderer.send('open-collect-window', item);
    }
    else {
        var mute = preferences.notification.soundEffect.enable != 'true' || preferences.notification.soundEffect.when.screencapture != 'true';
        if (params.mode === 3) {
            if (!mute) {
                jQuery.playSound('sounds/notification.wav');
            }
        }
        else if (preferences.notification.notification.enable !== 'false' && preferences.notification.notification.when.screencapture != 'false') {
            ipcRenderer.send('notification', {
                progress: false,
                mute: mute,
                title: i18n.__('Notification.ScreenCapture.Done.Title'),
                description: i18n.__('Notification.ScreenCapture.Done.Descript'),
                thumbnailUrl: item.path,
                fileName: item.name || item?.id,
                duration: 1500
            });
        }
        addToProcessQueue(item, true);
    }
});

ipcRenderer.on('open-with-dialog', function (event, filePath) {
    console.log(filePath);
    if (EdgeJS.openAppDialog) {
        EdgeJS.openAppDialog(path.normalize(filePath), function (err, result) {
            // console.log(err);
        });
    }
});

ipcRenderer.on('create-library', function(event, params) {
    createLibrary(params.name, params.savePath);
});

ipcRenderer.on('open-library', function(event, path) {
    openLibrary(path);
});

ipcRenderer.on('start-import-library-content', function(event, path) {
    importLibraryContent(path);
});

ipcRenderer.on('image-change', function(event, image) {
    onImageChange(image);
});

ipcRenderer.on('images-change', function(event, images) {
    onImagesChange(images, undefined, "modified");
});

ipcRenderer.on('export-images', function(event, params) {
    var source = tokenSource();
    taskTokens.push(source);
    exportEaglePackage(params, source.token);
});

ipcRenderer.on('export-as-folder', function(event, params) {
    if (params.folder) {
        var source = tokenSource();
        var total = 0;
        taskTokens.push(source);
        params.showWhenFinish = true;
        params.folder.images = params.images;
        params.folder.images = params.folder.images.filter(function (image) {
            if (image.folders.indexOf(params.folder.id) === -1) {
                return false;
            }
            return true;
        });
        total += params.folder.images.length;
        if (params.folder.children && params.folder.children.length > 0) {
            eagle.utils.tree.walk(params.folder.children, 'children', function (folder, parent) {
                if (folder) {
                    folder.images = params.images.filter(function (image) {
                        if (image.folders.indexOf(folder.id) === -1) {
                            return false;
                        }
                        return true;
                    });
                    if (folder && folder.images) {
                        total += folder.images.length;
                    }
                }
            });
        }
        else {
            params.showWhenFinish = true;
        }
        ipcRenderer.send('show-export-task', total);
        exportFolder(params, source.token);
    }
    // 单存图片导出
    else if (params.images) {
        ipcRenderer.send('show-export-task', params.images.length);
        exportImages(params);
    }
});

ipcRenderer.on('extrack-eaglepack', function(event, params) {
    if (!library || !library.rootDir) {
        ipcRenderer.send('electron-log', `[bg] can not import eaglepack, because library path not exists: ${library.rootDir}`);
        return;
    }
    if (fs.existsSync(params.path)) {
        var source = tokenSource();
        taskTokens.push(source);
        importEaglePackage(params.path, params.folderId, source.token);
    }
	else {
		ipcRenderer.send('electron-log', `[bg] eaglepack does not exist, path: ${params.path}`);
	}
});

ipcRenderer.on('upload-images', function(event, params) {

    var paths = params.paths;
    var filePaths = [];

    paths.forEach(function(filePath, index) {
        // 路径是文件夹
        let ext = getExt({ path: filePath });
		if (ext && (EagleConfig.SUPPORT_FORMATS[ext] || pluginModule?.previewExtension.thumbnailPluginMap[ext]) ) {

            ipcRenderer.send("add-download-task-end");
            var file = {
                id: guid(),
                path: filePath,
                name: path.basename(filePath).replace(/[/]/g, '').replace(/%/g, ""),
                ext: ext,
            };
            var source = tokenSource();
            taskTokens.push(source);
            uploadFileQueue([file], index, source.token);

        }
    });
});

ipcRenderer.on('folders-change', function(event, params) {
    saveLibraryMetadata(params);
});

function trashQueueCallback (task, callback) {

    var imageId = task.imageId;
    if (!imageId) {
        callback();
        return;
    }

    try {
        var dir = library.imagesDir + imageId + ".info/";
        delete library.imagesMapping[imageId];

        if (fs.existsSync(dir)) {
            fse.remove(dir, function (err) {
                if (err) {
                    ipcRenderer.send('electron-log', "" + err.stack || err);
                }
                ipcRenderer.send('remove-trash-item');
                setTimeout(callback, 5);
            });
        }
        else {
            ipcRenderer.send('remove-trash-item');
            setTimeout(callback, 5);
        }

    } catch (err) {
        ipcRenderer.send('electron-log', "" + err.stack || err);
        ipcRenderer.send('remove-trash-item');
        setTimeout(callback, 5);
    }
};

ipcRenderer.on('empty-trash', function(event, imageIdString) {

    if (!imageIdString || !imageIdString.split) return;

    var imageIds = imageIdString.split(",");
    if (imageIds && imageIds.length > 0) {
        
        ColorAnalyzer.pause();
        imageMatadataQueue.pause();
        imagePaletteQueue.pause();

        imageIds.forEach(function(imageId, index) {
            if (!imageId) return;
            trashQueue.push({
                imageId: imageId
            });
        });
    }
});

ipcRenderer.on('cancel-empty-trash', () => {
    trashQueue.pause();
    trashQueue.remove(function(task) {
        return true;
    });
});

ipcRenderer.on('remove-empty-folders', function(event, imageIdString) {

    if (!imageIdString || !imageIdString.split) return;

    ColorAnalyzer.pause();
    imageMatadataQueue.pause();
    imagePaletteQueue.pause();
    removeAllWatchers();

    var removed = 0;
    var imageIds = imageIdString.split(",");

    if (imageIds && imageIds.length > 0) {
        ipcRenderer.send('electron-info', `[bg] Clean ${imageIds.length} invalid files`);
        var cbs = imageIds.map(function(imageId, index) {
            ColorAnalyzer.pause();
            imageMatadataQueue.pause();
            imagePaletteQueue.pause();
            if (!imageId) return function (callback) {
                setTimeout(callback, 10);
            };
            return function(callback) {
                try {
                    var dir = path.normalize(library.imagesDir + imageId + ".info/");
                    if (fs.existsSync(dir)) {
                    // if (!library.imagesMapping[imageId] && fs.existsSync(dir)) {
                        removed++;
                        // 為了避免無法反悔，這此改用丟垃圾桶方式處理
                        fse.remove(dir, function (err) {
                            if (err) {
                                ipcRenderer.send('electron-log', "" + err.stack || err);
                                try {
                                    var rimrafSync = require('rimraf').sync;
                                    rimrafSync(dir);
                                }
                                catch (err) {
                                    ipcRenderer.send('electron-log', "" + err.stack || err);
                                }
                            }
                            ipcRenderer.send('electron-info', `[bg] Remove ${dir}`);
                            ipcRenderer.send('remove-empty-folder-item');
                            setTimeout(callback, 10);
                        });
                    }
                    else {
                        ipcRenderer.send('remove-empty-folder-item');
                        setTimeout(callback, 5);
                    }
                } catch (err) {
                    ipcRenderer.send('electron-log', "" + err.stack || err);
                    ipcRenderer.send('remove-empty-folder-item');
                    setTimeout(callback, 5);
                }
            }
        });

        async.parallelLimit(cbs, 24, function(err, result) {
            ipcRenderer.send('remove-empty-folder-item-done', {
                count : removed
            });
            ColorAnalyzer.resume();
            imageMatadataQueue.resume();
            imagePaletteQueue.resume();
        });
    }
});


ipcRenderer.on('palette-resume', function(event) {
    ColorAnalyzer.resume();
    imagePaletteQueue.resume();
    imageMatadataQueue.resume();
});

ipcRenderer.on('power-suspend', function(event) {
    removeAllWatchers();
    ipcRenderer.send('electron-info', "[bg] stop nsfw service");
});

ipcRenderer.on('power-resume', function(event) {
    initWatcher(library.rootDir);
    ipcRenderer.send('electron-info', "[bg] start nsfw service");
});

ipcRenderer.on('resume-metadata-queue', () => {
    imageMatadataQueue.resume();
});

ipcRenderer.on('screencapture-from-extension', function(event, file) {
    uploadBse64Image(file, function (base64) {
        if (preferences.notification.notification.enable !== 'false' && preferences.notification.notification.when.extension != 'false') {
            ipcRenderer.send('notification', {
                mute: !(preferences.notification.soundEffect.enable != 'false' && preferences.notification.soundEffect.when.extension == 'true'),
                progress: false,
                title: i18n.__('Notification.ScreenCapture.Done.Title'),
                description: i18n.__('Notification.ScreenCapture.Done.Descript'),
                webUrl: base64 || file?.path,
                fileName: file.name,
                duration: 1500
            });
        }
    });
});

process.on('SIGTERM', function () {
    ipcRenderer.send('electron-log', "SIGTERM");
});

process.on('SIGINT', function () {
    ipcRenderer.send('electron-log', "SIGINT");
});

process.on('unhandledRejection', (reason, p) => {
    // 记录日志、抛出错误、或其他逻辑。
    console.log('未处理的 rejection：', p, '原因：', reason);
});

process.on('uncaughtException', function (err) {
    console.error(err);
    ipcRenderer.send('electron-log', "[bg] " + err.stack || err);

    // 将错误发送至 google 分析
    if (analytics.errorTracking && err.stack) {
        setTimeout(() => {
            analytics.exception("" + err.stack);
        }, 0);
    }
});

ipcRenderer.on('upload-from-extension', function(event, params) {

    var source = tokenSource();
    taskTokens.push(source);

    if (params.url) {
        params.url = params.url.trim();
    }

    uploadUrl(params, function (result) {
        ipcRenderer.send('open-all-end');
        ipcRenderer.send('analytics.event-end', {
            EventId: "插件收藏圖片",
            Label: params.url
        });
        if (result) {
            var name = sanitize(encodeURIComponent(params.name).replace(/\(/g, "\\(").replace(/%/g, "").replace(/\)/g, "\\)")).trim();
            var imagesDir = library.imagesDir;
            if( process.platform == 'darwin' ) { imagesDir = encodeURI(imagesDir); }
            else { imagesDir = encodeURI(imagesDir.replace(/\\/g, "/"));}
            // console.log(imagesDir);
            ipcRenderer.send('notification', {
                progress: false,
                title: i18n.__('Notification.SaveImage.Done.Title'),
                description: i18n.__('Notification.SaveImage.Done.Descript'),
                thumbnailUrl: path.join(imagesDir + params.id + ".info/" + name + '_thumbnail.png'),
                fileName: name,
            });
        }
        else {
            ipcRenderer.send('notification', {
                progress: false,
                title: i18n.__('Notification.SaveImage.Failed.Title'),
                description: i18n.__('Notification.SaveImage.Failed.Descript'),
                fileName: name,
            });
        }
    }, source.token);
});

ipcRenderer.on('url-from-extension', async function(event, params) {

    var source = tokenSource();
    taskTokens.push(source);

    if (params.url) {
        params.url = params.url.trim();
    }

    if (!params.base64) {
        let websiteInfo = await captureURL(params.url);
        params.base64 = websiteInfo.base64;
        if (websiteInfo.title) {
            params.name = sanitize(websiteInfo.title).replace(/%/g, "").replace(/&lt;/g,"").replace(/&gt;/g,"").trim();
        }
    }

    var urlFile = `${EAGLE_THUMBNAIL_TEMP_PATH}/${params.name || guid()}.url`;
    var urlFileContent = `[InternetShortcut]
URL=${params.url}
     `;
    fs.writeFileSync(urlFile, urlFileContent, 'utf8');
    params.path = urlFile;

    addToProcessQueue(params);
    var mute = preferences.notification.soundEffect.enable != 'true' || preferences.notification.soundEffect.when.extension != 'true';
    ipcRenderer.send('notification', {
        mute: mute,
        progress: false,
        title: i18n.__('Notification.SaveImage.Done.Title'),
        description: i18n.__('Notification.SaveImage.Done.Descript'),
        webUrl: params.base64
    });
});

ipcRenderer.on('add-files', function(event, images) {
    images.forEach(function (image) {
        addToProcessQueue(image);
    })
});

ipcRenderer.on('upload-local-files', function(event, params) {
    if (!params.files || params.files.length <= 0) return;
    console.time("ipc.upload-files");
    var source = tokenSource();
    var token = source.token;
    taskTokens.push(source);
    uploadFileQueue(params.files, 0, token);
    console.timeEnd("ipc.upload-files");
});


function uploadFileQueue (files, index, cancellationToken) {

    if (index > files.length - 1) return;

    if (cancellationToken.isCancelled()) {
        return;
    }

    // console.time("uploadFileQueue");
	let modificationTimeMap = {};
    files.forEach(function (file, index) {

        if (!file.folders) {
            console.log(file);
        }
        var url = file.url;
        var image = {
            id: file.id || guid(),
            name: file.name || crypto.randomUUID(),
            tags: Array.from(file.tags || []),
            folders: file.folders || [],
            size: file.size || undefined,
            star: file.star || undefined,
            path: file.path,
            type: file.type,
            url: file.url || "",
            annotation: file.annotation || "",
            modificationTime: file.modificationTime || Date.now() + index
        };
		// 避免檔案添加時間一模一樣
		if (!modificationTimeMap[image.modificationTime]) {
			modificationTimeMap[image.modificationTime] = image.modificationTime;
		}
		else {
			modificationTimeMap[image.modificationTime]++;
			image.modificationTime = modificationTimeMap[image.modificationTime];
			console.log(image.modificationTime);
		}

        if (file.cutMode) image.cutMode = true;
        if (file.merged) image.merged = true;

        addToProcessQueue(image);
    });
    // console.timeEnd("uploadFileQueue");
};

ipcRenderer.on('upload-url', function(event, params) {
    var url = params.url;
    var id = guid();
    var params = {
        id: id,
        name: params.name || id,
        tags: params.tags || [],
        url: url,
        website: params.website || "",
        folders: params.folders || []
    };
    var source = tokenSource();
    taskTokens.push(source);
    uploadUrl(params, function () {}, source.token);
});

ipcRenderer.on('upload-urls', function(event, files) {
    Downloader.download(files);
});

ipcRenderer.on('paste-image', function(event, params) {
    addFilesFromClipboard(params);
});

ipcRenderer.on('duplicate-file', function(event, id) {
    duplicateFile(id);
});

ipcRenderer.on('paste-paths', function(event, params) {
    pasteFromPaths(params);
});

ipcRenderer.on('copy-paths-to-clipboard', function (event, paths) {
    if (!paths || paths.length === 0) return;
    copyFilesToClipboard(paths);
});

ipcRenderer.on('copy-images', function(event, images) {
    var imagePaths = images.map(function(image) {
        return library.imagesDir + image.id + ".info/" + image.name + "." + image.ext;
    })
    if (imagePaths && imagePaths.length > 0) {
        copyFilesToClipboard(imagePaths);
    }
});

ipcRenderer.on('copy-thumbnails', function(event, images) {
    var imagePaths = images.map(function(image) {
        if (image.noThumbnail) {
            return `${library.imagesDir}${image.id}.info/${image.name}.${image.ext}`;
        }
        else {
            return `${library.imagesDir}${image.id}.info/${image.name}_thumbnail.png`;
        }
    })
    if (imagePaths && imagePaths.length > 0) {
        copyFilesToClipboard(imagePaths);
    }
});

ipcRenderer.on('activate-windows-font', function (event, params) {
    activateFontQueue.push({
        params: params
    });
});

ipcRenderer.on('deactivate-windows-font', function (event, params) {
    deactivateFontQueue.push({
        params: params
    });
});

var generateHightResolutionThumbnailTimeout;
ipcRenderer.on('generate-hight-resolution-thumbnail', function (event, params) {
    var delay = 1;
    if (generateHightResolutionThumbnailTimeout) delay = 333;
    clearTimeout(generateHightResolutionThumbnailTimeout);
    generateHightResolutionThumbnailTimeout = setTimeout(function () {
        gerateHightResolutionThumbnailQueue.remove();
        gerateHightResolutionThumbnailQueue.push({
            params: params
        });
    });
});

function gerateHightResolutionThumbnailQueueCallback (task, callback) {
    generateHightResolutionThumbnail(task.params, function () {
        callback();
    });
}

function generateHightResolutionThumbnail (params, callback) {
    try {
        var filePath = params.filePath;
        var tempFile = params.tempFile;
        var finalFile = params.finalFile;
        var size = params.size;
        var ext = params.ext;

        var options = [filePath, tempFile, "png", size, EdgeJS.GHOST_SCRIPT_PATH];
        if (ext === 'pptx' || ext === 'ppt' || ext === 'potx') {
            EdgeJS.generatePPTXThumbnail([filePath, finalFile], function (err, size) {
                // fs.renameSync(tempFile, finalFile);
                callback && callback();
                console.timeEnd("test")
            });
        }
        else {
            EdgeJS.Magick(options, function (err, size) {
                fs.renameSync(tempFile, finalFile);
                callback && callback();
                console.timeEnd("test")
            });    
        }
    }
    catch (err) {
        callback && callback();
    }
}

ipcRenderer.on('set-custom-thumbnail', async function(event, params) {

    if (!params || !params.thumbnailPath || !params.item) return;

    try {

        let file = params.item;
        let newThumbnailPath = params.thumbnailPath;
        let dir = library.imagesDir + file.id + ".info/";
        let thumbnailPath = path.resolve(dir + file.name + "_thumbnail.png");

        if (fs.existsSync(thumbnailPath)) {
            fse.removeSync(thumbnailPath);
        }

        fse.copySync(newThumbnailPath, thumbnailPath);

		let size = await imageSize.async(thumbnailPath);

		file.height = params.height || size.height || file.height;
		file.width = params.width || size.width || file.width;

		ColorAnalyzer.run(thumbnailPath, function(palettes) {
			delete file.noThumbnail;
			delete file.noPreview;
			file.customThumbnail = true;
			file.palettes = palettes;
			onImagesChange([file], true);
			ipcRenderer.send('thumbnail-generated', file);
		});
    }
    catch (err) {
        ipcRenderer.send('electron-log', "Cann't change thumbnail, beacuse: ");
        ipcRenderer.send('electron-log', "" + err.stack || err);
    }
});

// 重新製作縮圖
ipcRenderer.on('regenerate-thumbnail', function(event, files) {
    if (!files || files.length <= 0) return;

    // 尝试修复 modifiedTime 一模一样的状况
	let modificationTimeMap = {};
    for (var i = files.length - 1; i >= 0; i--) {
		let file = files[i];
		let next = files[i + 1];
		if (!modificationTimeMap[file.modificationTime]) {
			modificationTimeMap[file.modificationTime] = file.modificationTime;
		}
		else {
			modificationTimeMap[file.modificationTime]++;
			file.modificationTime = modificationTimeMap[file.modificationTime];
			console.log(file.modificationTime)
		}
    }

    for (var i = 0; i < files.length; i++) {
		let file = files[i];
        regerateThumbnailQueue.push({
            file: file
        });
    }

    ipcRenderer.send('electron-info', `[bg] Re-renerate ${files.length} files thumbnail`);
});

// webp 文件转档
ipcRenderer.on('webp-convert', function(event, tasks) {
    if (!tasks || tasks.length <= 0) return;

    for (var i = 0; i < tasks.length; i++) {
        webpConvertQueue.push({
            task: tasks[i]
        });
    }

    ipcRenderer.send('electron-info', `[bg] Convert ${tasks.length} files to WebP format`);
});

// 視頻指定更新到某分某秒
ipcRenderer.on('regenerate-video-thumbnail', function(event, params) {
    if (!params.video) return;
    var file = params.video;
    var startAt = params.startAt;
    file.startAt = startAt;
    regerateThumbnailQueue.push({
        file: file
    });
    ipcRenderer.send('electron-info', `[bg] Re-generate video thumbnail，startAt: ${startAt}`);
    ipcRenderer.send('electron-info', `${JSON.stringify(file)}`);
});

ipcRenderer.on('regenerate-gif-thumbnail', function(event, params) {
    try {
        var file = params.gif;
        var id = file.id;
        var dir = library.imagesDir + id + ".info/";
        var thumbnailPath = path.resolve(dir + file.name + "_thumbnail.png");
        var thumbnailSize = EagleConfig.THUMBNAIL_SIZE || 400;
        var buffer = decodeBase64Image(params.base64string).data;
        fs.writeFileSync(thumbnailPath, buffer);
        ColorAnalyzer.addTask(file, thumbnailSize, thumbnailPath);
        ipcRenderer.send('thumbnail-generated', file);
        ipcRenderer.send('electron-info', `[bg] Re-generate GIF thumbnail`);
        ipcRenderer.send('electron-info', `${JSON.stringify(file)}`);
    }
    catch (err) {
        ipcRenderer.send('electron-log', err.stack || err);
    }
});

function activateFontQueueCallback (task, callback) {

    var params = task.params;
    var sudo = require(appRoot + '/my_modules/sudo-prompt');
    var options = { name: 'Eagle' };
    var fontPath = params.fontPath;
    var fontName = params.fontName;
    var postScriptName = params.postScriptName;
    var fullName = params.fullName;
    var fontExt = params.fontExt;
    var fontId = params.fontId;

    ipcRenderer.send('electron-info', "[bg] Install font file: " + fontPath);
    try {
        if (!fs.existsSync(EAGLE_THUMBNAIL_TEMP_PATH)) {
            fs.mkdirSync(EAGLE_THUMBNAIL_TEMP_PATH);
        }
        var tempFontPath = path.normalize(`${EAGLE_THUMBNAIL_TEMP_PATH}/${postScriptName}.${fontExt}`);
        safeCopy.sync(fontPath, tempFontPath);
    }
    catch (err) {
        ipcRenderer.send('electron-log', err.stack || err);
        callback();
        return;
    }

    const systemRoot = process.env['SystemRoot'] || process.env['windir'];
    const systemDrive = systemRoot && systemRoot[0];
    sudo.exec(`copy "${tempFontPath}" "${systemDrive || "C"}:\\Windows\\Fonts\\"`, options,
        function(err, stdout, stderr) {
            console.log('stdout: ' + stdout);
            fse.remove(tempFontPath);
            ipcRenderer.send('update-item-view-by-id', fontId);
            if (err) {
                ipcRenderer.send('electron-log', err.stack || err);
                callback();
                return;
            }
            else {
                EdgeJS.activateFontWithEdge(`${postScriptName}.${fontExt}`, function(error, result) {
                    if (result && result !== 0) {
                        var actualFontName = result;
                        console.log(actualFontName);
                        //　將字體寫入註冊表
                        sudo.exec(`REG ADD "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts" /v "${fullName} (TrueType)" /t REG_SZ /d "${postScriptName}.${fontExt}" /f`, options,
                            function(err, stdout, stderr) {
                                if (err) {
                                    ipcRenderer.send('electron-log', "[bg] Install font reg fail: " + fontPath);
                                    ipcRenderer.send('electron-log', err.stack || err);
                                }
                                console.log('stdout: ' + stdout);
                                callback();
                            }
                        );
                    }
                    else {
                        ipcRenderer.send('electron-log', "[bg] Install font file fail: " + fontPath);
                        if (error) {
                            ipcRenderer.send('electron-log', error.stack || error);
                        }
                        callback();
                        return;
                    }
                });
            }
        }
    );

};

function deactivateFontQueueCallback (task, callback) {
    
    var params = task.params;
    var sudo = require(appRoot + '/my_modules/sudo-prompt');
    var options = { name: 'Eagle' };
    var fontPath = params.fontPath;
    var fontName = params.fontName;
    var postScriptName = params.postScriptName;
    var fullName = params.fullName;
    var fontExt = params.fontExt;
    var fontId = params.fontId;
    const systemRoot = process.env['SystemRoot'] || process.env['windir'];
    const systemDrive = systemRoot && systemRoot[0];

    ipcRenderer.send('electron-info', "[bg] Uninstall font file: " + fontPath);

    EdgeJS.deactivateFontWithEdge(`${postScriptName}.${fontExt}`, function(error, result) {
        if (result && result !== 0) {
            var actualFontName = result;
            // 刪除字體
            sudo.exec(`del "${systemDrive || "C"}:\\Windows\\Fonts\\${postScriptName}.${fontExt}" /F /Q`, options,
                function(err, stdout, stderr) {
                    console.log('stdout: ' + stdout);
                    ipcRenderer.send('update-item-view-by-id', fontId);
                    if (err) {
                        console.log(err);
                        ipcRenderer.send('electron-log', err.stack || err);
                        callback();
                        return;
                    }
                    if (fs.existsSync(`${systemDrive || "C"}:\\Windows\\Fonts\\${postScriptName}.${fontExt}`)) {
                        ipcRenderer.send('electron-log', "[bg] Unisntall font fail, File is in use: " + fontPath);
                        ipcRenderer.send('show-swal', {
                            title: i18n.__("Dialog.Deactivate.Error.Title"),
                            description: postScriptName + i18n.__("Dialog.Deactivate.Error.Description"),
                            button: i18n.__("general.ok")
                        });
                        callback();
                        return;
                    }
                    else {
                        //　將字體從註冊表移除
                        sudo.exec(`REG DELETE "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts" /v "${fullName} (TrueType)" /f`, options,
                            function(err, stdout, stderr) {
                                if (err) {
                                    ipcRenderer.send('electron-log', "[bg] Can not delete font into from regedit: " + fontPath);
                                    ipcRenderer.send('electron-log', err.stack || err);
                                }
                                callback();
                                console.log('stdout: ' + stdout);
                                return;
                            }
                        );
                    }
                }
            );
        }
        else {
            ipcRenderer.send('electron-log', "[bg] Uninstall font file fail: " + fontPath);
            ipcRenderer.send('electron-log', "" + error.stack || error);
            callback();
            return;
        }
    });
};

function webpConvertQueueCallback (task, callback) {
    try {
        var task = task.task;
        if (!task) {
            ipcRenderer.send('webp.converted');
            setTimeout(callback, 1);
            return;
        }
        var image = task.image;
        var format = task.format;
        var id = image.id;
        var dir = library.imagesDir + id + ".info/";
        var rawPath = dir + image.name + ".webp";
        var thumbnailPath = dir + image.name + "_thumbnail.png";
        var tempPath = dir + image.name + "." + format;
        
        // 1. 排除 webp animate 文件
        var buffer = fs.readFileSync(rawPath);
        var isAnimated = buffer.toString().indexOf("ANMF") > -1;
        if (isAnimated) {
            ipcRenderer.send('webp.converted');
            ipcRenderer.send('electron-log', "[bg] " + rawPath + ", not support animated-webp format");
            setTimeout(callback, 1);
            return;
        }

        // 2. 将 WebP 画在 Canvas
        var img = new Image();
        img.onload = function() {

            try {
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');
                var base64;
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // 3. 依据 format 输出 base64
                if (format === "jpg") {
                    base64 = canvas.toDataURL("image/jpeg", 1.0);
                }
                else {
                    base64 = canvas.toDataURL();
                }

                // 4. 将 base64 转为文件，储存至 tmp
                var decode = decodeBase64Image(base64);
                if (!decode || !decode.data) {
                    ipcRenderer.send('electron-log', "[bg] webp buffer is null");
                    ipcRenderer.send('webp.converted');
                    setTimeout(callback, 1);
                    return;
                }
                fs.writeFileSync(tempPath, decode.data);

                // 5. 检查文件是否正常，如正常取代原文件
                var stat = fs.statSync(tempPath);
                if (!fs.existsSync(tempPath) || stat.size === 0) {
                    ipcRenderer.send('electron-log', "[bg] Conver WebP fail: " + rawPath);
                    ipcRenderer.send('webp.converted');
                    setTimeout(callback, 1);
                    return;
                }
                fse.remove(rawPath);

                // 6. 如果图片尺寸较小，移除缩略图，并让 noThumbnail = true
                if (img.width <= EagleConfig.NO_THUMBNAIL_SIZE && img.height <= EagleConfig.NO_THUMBNAIL_SIZE) {
                    image.noThumbnail = true;
                    fse.remove(thumbnailPath);
                }

                image.size = stat.size;
                image.ext = format;

                // 7. 完成转换
                removeUnusedProperities(image);
                onImagesChange([image], true);
                ipcRenderer.send('webp.converted', image);
                setTimeout(callback, 1);
            }
            catch (err) {
                ipcRenderer.send('webp.converted');
                setTimeout(callback, 1);
                ipcRenderer.send('electron-log', "" + err.stack || err);
                return;
            }
        };
        img.onerror = function(event) {
            ipcRenderer.send('webp.converted');
            setTimeout(callback, 1);
            return;
        };
        img.src = URL_MODULE.pathToFileURL(rawPath).href;
    }
    catch (err) {
        ipcRenderer.send('webp.converted');
        setTimeout(callback, 1);
        ipcRenderer.send('electron-log', "" + err.stack || err);
        return;
    }
}

function generateThumbnailQueueCallback (task, callback) {

    var file = task.file;
    if (!file || file.customThumbnail) {
        ipcRenderer.send('thumbnail-generated', file);
        callback();
        return;
    }

    var thumbnailSize = EagleConfig.THUMBNAIL_SIZE || 400;
    var id = file.id;
    var dir = library.imagesDir + id + ".info/";
    var rawPath;
    var thumbnailPath;
    var ext;
    
    if (!(EagleConfig.SUPPORT_FORMATS[file.ext] || pluginModule?.previewExtension.thumbnailPluginMap[file.ext])) {
        let thumbnailPath = path.resolve(dir + file.name + "_thumbnail.png");
        if (fs.existsSync(thumbnailPath)) {
            fse.remove(thumbnailPath);
        }
        delete file.palettes;
        delete file.width;
        delete file.height;
        file.noPreview = true;
        ipcRenderer.send('thumbnail-generated', file);
        onImagesChange([file], true);
        callback();
        return;
    }

    ColorAnalyzer.pause();

    try {
        let rawFilePath = path.resolve(dir + file.name + "." + file.ext);
        ipcRenderer.send('electron-info', `[bg] Refresh [${file.name}.${file.ext}]`);
        var fileStat = fs.statSync(rawFilePath);
        file.size = fileStat.size;
        if (file.btime !== parseInt(fileStat.birthtimeMs) || file.mtime !== parseInt(fileStat.mtimeMs)) {
            file.btime = parseInt(fileStat.birthtimeMs);    
            file.mtime = parseInt(fileStat.mtimeMs);
            if (file.noThumbnail) {
                onImagesChange([file], true);
            }
        }
    }
    catch (err) {
        ipcRenderer.send('thumbnail-generated', file);
        ipcRenderer.send('electron-log', "" + err.stack || err);
        return callback();
    }


    rawPath = path.resolve(dir + file.name + "." + file.ext);
    thumbnailPath = path.resolve(dir + file.name + "_thumbnail.png");

    (async () => {
        try {
            const item = await ThumbGenerator.generate({
                src: rawPath,
                dest: thumbnailPath,
                item: file,
                thumbnailSize: thumbnailSize,
                startAt: file.startAt ?? file.thumbnailAt
            });
            
            if (item.noThumbnail && !item.removeThumbnail) {
                ColorAnalyzer.addTask(item, thumbnailSize, rawPath);
            }
            else {
                ColorAnalyzer.addTask(item, thumbnailSize, thumbnailPath);
            }
            removeUnusedProperities(item);
            onImagesChange([item], true);
            ipcRenderer.send('thumbnail-generated', item);
            callback();
        }
        catch (err) {
            ipcRenderer.send('thumbnail-generated', file);
            return callback();
        }
    })();
};

function initBridge () {
    if( process.platform == 'darwin' ) {;
        // 移除不需要的缓存文件
        var cachePattern = path.normalize(userChcaePath + "/*.txt.*");

        const glob = require('fast-glob');                      // 245ms
        glob([cachePattern]).then((entries) => {
            if (entries.length === 0) return;
            entries.forEach(function (oldCache) {
                try {
                    if (fs.existsSync(oldCache)) {
                        fse.remove(oldCache);
                        console.log("移除占用缓存", oldCache);
                    }
                }
                catch (err) {
                    console.log(err);
                    ipcRenderer.send('electron-log', "" + err.stack || err);
                }
            });
        });
    }
    else {
        ipcRenderer.send('app-status-module-loading');
		EdgeJS.init();
        ipcRenderer.send('app-status-module-loaded');
    }
};

function removeLibraryCache () {
    try {
        if (fs.existsSync(newCacheDir)) {
            fse.removeSync(newCacheDir);
            console.info("移除緩存文件");
        }
    }
    catch (err) {
        ipcRenderer.send('electron-log', `[bg] Can not remove cache file: ${newCacheDir}`);
        ipcRenderer.send('electron-log', "" + err.stack || err);
    }
}

function reloadWithoutCache () {
    var mtimeLogsPath = path.normalize(library.rootDir + `/${MTIMENAME}`);

    removeAllWatchers();
    cancelAll();

    try {
        if (fs.existsSync(mtimeLogsPath)) {
            fse.removeSync(mtimeLogsPath);
            createMTimeLogs(function () {});
        }
    } catch (err) {
        ipcRenderer.send('electron-log', `[bg] Can not remove cache file: ${mtimeLogsPath}`);
        ipcRenderer.send('electron-log', "" + err.stack || err);
    }
    ipcRenderer.send('electron-info', `[bg] Clean library cache and force reload: ${library.rootDir}`);
    removeLibraryCache();
    libraryLoaded = false;
    setTimeout(() => {
        initLibrary();
    }, 500);
};

function removeAllWatchers () {
    unwatchMtimeFile();
    unwatchMetadataFile();
    AutoImport.stop();
    if (imagesWatcher) {
        imagesWatcher.stop();
        imagesWatcher = undefined;
    }
}

function initWatcher (rootDir) {

    var metadataFilePath = path.normalize(rootDir + "/metadata.json");
    metadataWatcherPath = metadataFilePath;

    var mtimeFilePath = path.normalize(`${rootDir}/${MTIMENAME}`)
    mtimeWatcherPath = mtimeFilePath;

    watchMetadataFile(metadataWatcherPath);
    watchMtimeFile(mtimeWatcherPath);
    AutoImport.watch(library);

    try {
        if (imagesWatcher) {
            imagesWatcher.stop();
        }
        if (!fs.existsSync(rootDir)) {
            ipcRenderer.send('electron-log', `[bg] nsfw watcher start fail, because path is not exists: ${rootDir}`);
            return;
        }

        var isNetworkDrive = require(appRoot + '/my_modules/is-network-drive');
        if (!isNetworkDrive(rootDir)) {
            ipcRenderer.send('electron-info', `[bg] Network Drive: NO`);
            const nsfw = require('nsfw');
            nsfw(rootDir + "/images", function(events) {

                if (!library || !library.imagesMapping) return;
                if (!events) return;
                
                events.forEach(function (event) {
                    try {
                        if (event.file === ".DS_Store") return;
                        var filePath = event.directory + "/" + (event.file || event.newFile);

                        // 暫存檔案無須理會
                        if (filePath.endsWith(".tmp")) return;
                        if (/\.[0-9]*$/.test(filePath)) return;

                        // iCloud 同步时会多带一个 icloud 字串，需要去除
                        var isiCloud = new RegExp(".icloud$").test(filePath);
                        if (isiCloud) {
                            filePath = filePath.substr(0, filePath.length - 7);
                        }

						var imageId = filePath.match(/.library[\/|\\]images[\/|\\](.*).info/)?.[1];
						let importDate = importItemDateMap[imageId];
						if (importDate) {
							if (Date.now() - importDate < 10000 && event.action === 1) {
								console.log(`ignore watch callback`)
								return;
							}
							else {
								delete importItemDateMap[imageId];
							}
						}
                        console.log(event)
						const editHandler = (filePath) => {
							try {
								var parentFolder = path.dirname(filePath);
								var parentFolderName = path.basename(parentFolder);
								var size;
								let fileName = path.basename(filePath);
								if (parentFolderName && parentFolderName.indexOf(".info") > -1) {
									
									let originalJSON = library.imagesMapping[imageId];
									let originalObj = {};
									try {
										originalObj = JSON.parse(originalJSON);
									}
									catch (err) {
										originalObj = {};
									}
									let needUpdate = (`${originalObj?.name}.${originalObj?.ext}` === fileName);
									if (!needUpdate) return;
									// 更新缩略图
									clearTimeout(nsfwUpdateThumbnailTimeout[imageId]);
									nsfwUpdateThumbnailTimeout[imageId] = setTimeout(function () {

										console.log(`${imageId} 发生更动`);
										if (fs.existsSync(filePath) && fs.existsSync(parentFolder + "/metadata.json")) {
											var json = fs.readFileSync(path.normalize(parentFolder + "/metadata.json"), 'utf8');
											if (!json) return;
											try {
												var image = JSON.parse(json);
												var stat = fs.statSync(filePath);
												var mtime = parseInt(stat.mtimeMs);
												size = stat.size;
												if (image && image.id && mtime !== image.mtime) {
													image.mtime = mtime;
													image.size = size;
													if (!(EagleConfig.SUPPORT_FORMATS[image.ext] ||pluginModule?.previewExtension.thumbnailPluginMap[image.ext])) {
														onImagesChange([image], true);
														console.log(`${imageId} 开始更新缩略图`);
														ipcRenderer.send('thumbnail-generated', image);
														return;
													}
													else {
														regerateThumbnailQueue.push({
															file: image
														});
													}
												}
												else {
													console.log(`${imageId} 没有更动`);
												}
											}
											catch (err) {
												
											}
										}
										else {
											if (library.imagesMapping && library.imagesMapping[imageId]) {
												ipcRenderer.send('electron-log', `[bg] File Watcher: File is deleted by other programs: ${imageId}`);
											}
											console.log(`${imageId} 已被删除`);
										}
									}, 2500);
								}
							}
							catch (err) {
								ipcRenderer.send('electron-log', "" + err.stack || err);
							}
						};
                        // console.log(event.action);
                        switch(event.action) {
                            // 新增
                            case 0:
								if (filePath && filePath.indexOf("_thumbnail.png") === -1 && !filePath.endsWith(".info")) {
                                    if (filePath.endsWith(".url")) return;
									editHandler(filePath);
                                }
                                watchCallback({
                                    type: "create",
                                    filePath: filePath
                                });
                                break;
                            // 删除
                            case 1:
                                if (event.file.indexOf(".info") !== -1) {
                                    var filePaths = event.file.split('/');
                                    if (!filePaths[filePaths.length - 1]) return;
                                    var id = filePaths[filePaths.length - 1].replace(".info", "");

                                    watchCallback({
                                        type: "delete",
                                        id: id
                                    });
                                }
                                break;
                            case 2:
                            // Note: 有些軟體修改檔案會先寫在 temp 在 remove 在 rename，所以要把 3 考慮進來
                            case 3:
                                // console.log(filePath);
                                if (filePath.indexOf(".json") !== -1) {
                                    watchCallback({
                                        type: "edit",
                                        filePath: filePath
                                    })
                                }
                                else if (filePath && filePath.indexOf("_thumbnail.png") === -1 && !filePath.endsWith(".info")) {
									editHandler(filePath);
                                }
                                // console.log("【修改档案】", event.file);
                                break;
                            case 3:
                                // console.log("【重新命名】", event.oldFile);
                                break;
                        }
                    }
                    catch (err) {
                        ipcRenderer.send('electron-log', "" + err.stack || err);
                    }
                })
            }, {
                errorCallback: function (err) {
                    console.error(err);
                }
            })
            .then(function(watcher) {
                imagesWatcher = watcher;
                return watcher.start();
            })
            .then(function() {

            });
        }
        else {
            ipcRenderer.send('electron-info', `[bg] Network Drive: YES`);
            console.log("禁用 nsfw，因为路径是局域网路径");
        }
    }
    catch (err) {
        console.log(err);
        ipcRenderer.send('electron-log', err.stack || err);
    };
}

function unwatchMetadataFile () {
    if (metadataWatcherPath) {
        if (fs.existsSync(metadataWatcherPath)) {
            fs.unwatchFile(metadataWatcherPath);
            console.log(`【文件监听】暂停监听 ${metadataWatcherPath}`);
        }
    }
}

function watchMetadataFile (metadataFilePath) {
    console.log(`【文件监听】开始监听 ${metadataFilePath}`);
    if (!fs.existsSync(metadataFilePath)) {
        ipcRenderer.send('electron-log', `[bg] metadata watcher start fail, because path is not exists: ${metadataFilePath}`);
        return;
    }
    fs.watchFile(metadataFilePath, { persistent: true, interval: 4000 }, function(curr, prev) {

        if (curr.mtimeMs === prev.mtimeMs) return;

        console.log("【雲端同步監測】 : 資料夾資訊修改");
        refreshMetadata(metadataFilePath);
    });
}

var refreshMetadata = throttle(function (metadataFilePath, forceReload) {
    if (!fs.existsSync(library.rootDir)) {
        ipcRenderer.send('electron-log', `[bg] Library path is missing, path: ${metadataFilePath}`);
        ipcRenderer.send('welcome-end', {
            libraryMissed: true,
            libraryPath: path.normalize(metadataFilePath),
        });
    }
    else if (!fs.existsSync(metadataFilePath)) {
        ipcRenderer.send('electron-log', `[bg] metadata.json deleted by other applications, path: ${metadataFilePath}`);
        ipcRenderer.send('welcome-end', {
            libraryMissed: true,
            libraryPath: path.normalize(metadataFilePath),
        });
    }
    else {
        var newLibrary;
        var data = fs.readFileSync(metadataFilePath, 'utf8');
        if (data || data !== '') {
            try {
                newLibrary = JSON.parse(data);
                if (!forceReload && library && newLibrary && library.modificationTime >= newLibrary.modificationTime) {
                    console.info("【雲端同步監測】 : 无需更新");
                    return;
                }
                // console.log("【雲端同步監測】 : 资源库更新");
                // ipcRenderer.send('electron-info', `[bg] metadata.json modified by other applications, path: ${metadataFilePath}`);
                console.info("【雲端同步監測】 : 更新成雲端版本");
                library.modificationTime = newLibrary.modificationTime;
                ipcRenderer.send('library.changed', newLibrary);
                ipcRenderer.send('electron-info', `[bg] Detect metadata.json modified, refresh UI`);
            }
            catch (err) {
                ipcRenderer.send('electron-log', `[bg] metadata.json is damaged, path: ${metadataFilePath}`);
                ipcRenderer.send('electron-log', "" + err.stack || err);
            }
        }
        else {
            ipcRenderer.send('electron-log', `metadata.json is damaged, path: ${metadataFilePath}`);
        }
    }
}, 500, true);

function unwatchMtimeFile () {
    if (mtimeWatcherPath) {
        if (fs.existsSync(mtimeWatcherPath)) {
            fs.unwatchFile(mtimeWatcherPath);
            console.log(`【文件监听】暂停监听 ${mtimeWatcherPath}`);
        }
    }
}

function watchMtimeFile (mtimeFilePath) {
    console.log(`【文件监听】开始监听 ${mtimeFilePath}`);
    try {
        if (!fs.existsSync(mtimeFilePath)) {
            ipcRenderer.send('electron-log', `[bg] mtime watcher start fail, because path is not exists: ${mtimeFilePath}`);
            return;
        }
        fs.watchFile(mtimeFilePath, { persistent: true, interval: 4000 }, function(curr, prev) {

            if (curr.size === 0 || curr.mtimeMs === prev.mtimeMs) return;

            console.log("[bg] mtime.json 有修改");
            refreshLibrary(mtimeFilePath);
        });
    }
    catch (err) {
        ipcRenderer.send('electron-log', `[bg] watch ${mtimeFilePath} error...`);
        ipcRenderer.send('electron-log', "" + err.stack || err);
    }
}

var isRefreshingLibrary = false;
var refreshLibrary = throttle(function (mtimeFilePath, forceScanDir) {

    if (isRefreshingLibrary) return;
    if (!fs.existsSync(mtimeFilePath)) {
        return;
    }

    isRefreshingLibrary = true;

    console.time("[bg] 读取 mtime");
    var jsonStr = fs.readFileSync(mtimeFilePath);
    var mtimeMappings = JSON.parse(jsonStr);
    console.timeEnd("[bg] 读取 mtime");

    var editFiles = [];
    var newFiles = [];

    var newIds = Object.keys(mtimeMappings);
    var oldIds = Object.keys(lastModifiedTimeMappings);

    for (var i = 0; i < newIds.length; i++) {
        var id = newIds[i];
        if (id === "all") continue;
        // 新增项目
        if (!lastModifiedTimeMappings[id]) {
            newFiles.push(id);
            lastModifiedTimeMappings[id] = mtimeMappings[id];
        }
        // 修改项目
        else if (mtimeMappings[id] > lastModifiedTimeMappings[id]) {
            editFiles.push(id);
            lastModifiedTimeMappings[id] = mtimeMappings[id];
        }
    }

    // 判斷是否需要重新掃描數量(註: 這個方法可能會有機率不觸發，如果剛好清空垃圾桶的數量等於新圖片數量)
    if ( forceScanDir || 
        (mtimeMappings["all"] !== Object.keys(library.imagesMapping).length && Object.keys(mtimeMappings).length !== Object.keys(lastModifiedTimeMappings).length)
    ) {
        console.time("[bg] 重新掃描文件夾");
        let realIdMaps = {};
        // Note: 如果檔案很多，這裡會有效能瓶頸
        fs.readdir(library.imagesDir, function (err, dirs) {

            let newFiles = [];
            let deleteFiles = [];

            dirs.forEach(function(dir) {
                if (dir == '.DS_Store') return;
                if (dir == 'Icon') return;
                var id = dir.replace(".info", "");
                realIdMaps[id] = true;
            });

            // 檢查是否有文件被刪除
            for (var i = 0; i < oldIds.length; i++) {
                var id = oldIds[i];
                if (id === "all") continue;
                // 刪除项目
                if (!realIdMaps[id]) {
                    deleteFiles.push(id);
                }
            }

            // 檢查是否有新文件
            var realIds = Object.keys(realIdMaps);
            for (var j = 0; j < realIds.length; j++) {
                let id = realIds[j];
                if (!library.imagesMapping[id]) {
                    newFiles.push(id);
                }
            }

            // lastModifiedTimeMappings = mtimeMappings;
            console.timeEnd("[bg] 重新掃描文件夾");

            newFiles.forEach(function (id) {
                var filePath = library.imagesDir + id + ".info/metadata.json";
                watchCallback({
                    type: "create",
                    filePath: filePath
                });
            });

            deleteFiles.forEach(function (id) {
                watchCallback({
                    type: "delete",
                    id: id
                });
            });

            console.log(`newFiles: ${newFiles}`);
            console.log(`deleteFiles: ${deleteFiles}`);

            isRefreshingLibrary = false;
        });
    }
    else {
        console.log("[bg] 沒有刪除操作，無須掃描")
        isRefreshingLibrary = false;
    }

    console.log(`newFiles: ${newFiles}`);
    console.log(`editFiles: ${editFiles}`);
    
    newFiles.forEach(function (id) {
        var filePath = library.imagesDir + id + ".info/metadata.json";
        watchCallback({
            type: "create",
            filePath: filePath
        });
    });
    
    editFiles.forEach(function (id) {
        var filePath = library.imagesDir + id + ".info/metadata.json";
        watchCallback({
            type: "edit",
            filePath: filePath
        });
    });
}, 500, true);

var watchCallback = function (task) {

    var type = task.type;
    var filePath = task.filePath;
    var id = task.id;

    switch (type) {
        case "create":
            if (filePath && filePath.indexOf && filePath.endsWith("metadata.json")) {

                try {
                    let itemId = filePath.split(".info")[0].split(path.normalize("images/"))?.[1] ?? "";
                    if (itemId.length !== 36 && itemId.length !== 13) return;
                } catch (err) {};

                fs.readFile(filePath, 'utf8', (err, json) => {
                    if (err) return;
                    try {
                        var image = JSON.parse(json);
                        var currentJSON = library.imagesMapping[image.id];
                        // 新增
                        if (!currentJSON) {
                            console.log("【雲端同步監測】 : 新的檔案添加，路徑為", filePath);
                            library.imagesMapping[image.id] = json;
                            imageWatchUpdateQueue.push({
                                eventName: 'image.added',
                                image: image,
                                json: json
                            });
                        }
                        // 修改
                        else {
                            fs.readFile(filePath, 'utf8', (err, json) => {
                                var image = JSON.parse(json);
                                if (json == currentJSON) {
                                    // console.log("【雲端同步監測】 : 本地更新，不需要更新");
                                } else {
                                    if (library.imagesMapping[image.id]) {
                                        console.log("【雲端同步監測】 : 發現雲同步後有檔案需更新，檔案路徑是：", filePath);
                                        library.imagesMapping[image.id] = json;
                                        imageWatchUpdateQueue.push({
                                            eventName: 'image.changed',
                                            image: image,
                                            json: json
                                        });
                                    }
                                }
                            });
                        }
                    } catch (e) {
                        ipcRenderer.send('analytics.exception', '' + e);
                    };
                });
            }
            // SVG 文件修改，刷新缩略图
            else if (filePath && filePath.endsWith(".svg")) {
                var parentFolder = path.dirname(filePath);
                var parentFolderName = path.basename(parentFolder);
                var imageId;
                if (parentFolderName && parentFolderName.indexOf(".info") > -1) {

                    imageId = parentFolderName.replace(".info", "");
                    console.log(`${imageId} 发生更动`);

                    clearTimeout(nsfwUpdateThumbnailTimeout[imageId]);
                    nsfwUpdateThumbnailTimeout[imageId] = setTimeout(function () {
                        if (fs.existsSync(filePath) && fs.existsSync(parentFolder + "/metadata.json")) {
                            var json = fs.readFileSync(path.normalize(parentFolder + "/metadata.json"), 'utf8');
                            if (!json) return;
                            try {
                                var image = JSON.parse(json);
                                var stat = fs.statSync(filePath);
                                var mtime = parseInt(stat.mtimeMs);
                                size = stat.size;
                                if (image && image.id && mtime !== image.mtime) {
                                    image.mtime = mtime;
                                // if (image && image.id && size !== image.size) {
                                    console.log(`${imageId} 开始更新缩略图`);
                                    regerateThumbnailQueue.push({
                                        file: image
                                    });
                                }
                                else {
                                    console.log(`${imageId} 没有更动`);
                                }
                                ipcRenderer.send('thumbnail-generated', image);
                            }
                            catch (err) {
                                
                            }
                        }
                        else {
                            if (library.imagesMapping && library.imagesMapping[imageId]) {
                                ipcRenderer.send('electron-log', `[bg] File Watcher: File is deleted by other programs: ${imageId}`);
                                library.imagesMapping[id] = undefined;
                                delete library.imagesMapping[id];
                            }
                            console.log(`${imageId} 已被删除`);
                        }
                    }, 2500);
                }
            }
        break;
        case "delete":
            if ( (id.length === 36 || id.length === 13) && library.imagesMapping[id]) {
                ipcRenderer.send('electron-log', `[bg] File Watcher: File is deleted by other programs: ${library.rootDir}/${id}.info/`);
                library.imagesMapping[id] = undefined;
                delete library.imagesMapping[id];
                imageWatchUpdateQueue.push({
                    eventName: 'image.removed',
                    id: id,
                });
            }
        break;
        case "edit":
            let itemId;
            try {
                itemId = filePath.split(".info")[0].split(path.normalize("images/"))?.[1] ?? "";
                if (itemId.length !== 36 && itemId.length !== 13) return;
            } catch (err) {};
            if (filePath && filePath.indexOf && filePath.endsWith("metadata.json")) {
                // NOTE: 防止自己觸發自己
                if (Date.now() - lastModifiedTimeMappings[itemId] < 500) {
                    console.log(`ignore watch callback: ${Date.now() - lastModifiedTimeMappings[itemId]}`)
                    return;
                }
                fs.readFile(filePath, 'utf8', (err, json) => {
                    if (err) return;
                    try {
                        var image = JSON.parse(json);
                        var currentJSON = library.imagesMapping[image.id];
                        if (json == currentJSON) {
                            lastModifiedTimeMappings[image.id] = image.lastModified;
                        } else {
                            if (library.imagesMapping[image.id]) {
                                console.log("【雲端同步監測】 : 發現雲同步後有檔案需更新，檔案路徑是：", filePath);
                                if (image.lastModified) {
                                    lastModifiedTimeMappings[image.id] = image.lastModified;
                                }
                                imageWatchUpdateQueue.push({
                                    eventName: 'image.changed',
                                    image: image,
                                    json: json
                                });
                            }
                            else {
                                console.log("【雲端同步監測】 : 發現雲同步後有檔案新增，檔案路徑是：", filePath);
                                if (image.lastModified) {
                                    lastModifiedTimeMappings[image.id] = image.lastModified;
                                }
                                imageWatchUpdateQueue.push({
                                    eventName: 'image.added',
                                    image: image,
                                    json: json
                                });
                            }
                        }
                    } catch (e) {
                        ipcRenderer.send('analytics.exception', '' + e);
                    }
                });
            }
        break;
    }

};

function parseMetadataJSON (json) {
    try {
        const id = json.match(/"id":\s*"(.*?)"/)?.[1];
        const lastModified = json.match(/"lastModified":\s*(\d+)/)?.[1];
        const processingPalette = json.includes("processingPalette");
        const item = {
            id,
            lastModified: parseInt(lastModified),
            pure: true
        };
        if (processingPalette) {
            item.processingPalette = true;
        }
        return item;
    }
    catch (err) {
        return undefined;
    }
}


// ----------------------------------------
// 載入資源庫
// ----------------------------------------
function initLibrary (forcePath) {

    var startTime = Date.now();

    library = {};

    unwatchMetadataFile();
    unwatchMtimeFile();
    AutoImport.stop();

	ipcRenderer.send('electron-info', `[bg] Prepare to load library.`);

    console.time("【background.js】总耗时");
    console.time("【background.js】initLibrary");

    async function initFromCacheFile () {
        return new Promise((resolve, reject) => {

            console.time("【本地缓存】读取新版缓存");
            const items = [];
            library.imagesMapping = {};

            ipcRenderer.send('preload-library', {
                cachePath: newCacheDir
            });

            ipcRenderer.send('app-status-library-cache-loading');

			const lineByLine = require(appRoot + '/my_modules/n-readlines');
            var liner = new lineByLine(newCacheDir, {
                readChunk: 2048
            });

            let line;
            let lines = [];
            console.time("line + parse");

            while (line = liner.next()) {
                lines.push(line.toString());
            }

            lines.forEach((line) => {
                try {
                    const item = parseMetadataJSON(line);
                    if (item) {
                        library.imagesMapping[item.id] = line;
                        items.push(item);
                    }
                }
                catch (err) {}
            });

            console.timeEnd("line + parse");
            console.timeEnd("【本地缓存】读取新版缓存");
            ipcRenderer.send('app-status-library-cache-loaded');
            return resolve(items);
        });
    };

    // console.log("開始載入內容");
    settings.get('rootDir').then(function(rootDir) {

        if (forcePath) {
            rootDir = forcePath;
        }
        ipcRenderer.send('electron-info', `[bg] Start to load library: ${rootDir}`);
        
        console.log("【background.js】准备载入资源库：" + rootDir);
        libraryDir = rootDir;
        
        if (!rootDir || Object.keys(rootDir).length === 0) {
            ipcRenderer.send('welcome-end');
            return;
        }

		// 不存在
		if (
            !fs.existsSync(libraryDir) || !fs.existsSync(`${libraryDir}/metadata.json`)
        ) {
			ipcRenderer.send('electron-log', "[bg] Library missing, path: " + libraryDir);
            ipcRenderer.send('welcome-end', {
                libraryMissed: true,
                libraryPath: path.normalize(rootDir),
            });
            return;
        }

        if (!rootDir || !fs.existsSync(path.normalize(rootDir + "/metadata.json"))) {
            if (!rootDir) {
                ipcRenderer.send('show-error-box', {
                    title: i18n.__('dialog.libraryMissed.title'),
                    message: i18n.__('dialog.libraryMissed.desc')
                });
            }
            ipcRenderer.send('welcome-end', {
                libraryMissed: true,
                libraryPath: path.normalize(rootDir),
            });
            ipcRenderer.send('electron-info', `[bg] Library missing, path: ${rootDir}`);
            return;
        }
        else {
            try {
                // 應該讓使用者選擇建立
                if (!fs.existsSync(rootDir)) {
                    fs.mkdirSync(rootDir, 0755);
                }

                if (!fs.existsSync(rootDir + "/images/")) {
                    fs.mkdirSync(rootDir + "/images/", 0755);
                }
            }
            catch (err) {
                ipcRenderer.send('electron-log', `Can not create library path: ${rootDir}`);
                ipcRenderer.send('electron-log', "" + err.stack || err);
                ipcRenderer.send('show-swal', {
                    title: i18n.__('dialog.libraryPathReadOnly.title'),
                    description: i18n.__('dialog.libraryPathReadOnly.desc') + `(${err.message})`,
                    button: i18n.__("general.ok")
                });
            }
        }

        // 清空 extract 文件夹
        if (fs.existsSync(`${libraryDir}/extract`)) {
            fse.remove(`${libraryDir}/extract`);
        }

        // var backupPath = EAGLE_THUMBNAIL_BACKUP_PATH + "/";
        // if (!fs.existsSync(backupPath)) {
        //     fs.mkdirSync(backupPath, 0755);
        // }

        // 讀取 Metadata.json
        libraryLoaded = false;
        library = loadLibrary(path.normalize(rootDir + "/metadata.json"));

        if (!library) { 
            return; 
        }

        library.rootDir = path.normalize(rootDir).replace(/\\$/g, "").replace(/\/$/, "");
        library.imagesDir = path.normalize(rootDir + "/images/");

        // 資源庫使用更新的版本建写入资源库发生错误立，需要更新到最新版本
        if (library.applicationVersion && require('compare-versions')(appVersion, library.applicationVersion) == -1) {
            ipcRenderer.send('show-error-box', {
                title: i18n.__('dialog.libraryLowerVersion.title'),
                message: i18n.__('dialog.libraryLowerVersion.desc')
            });
            ipcRenderer.send('electron-info', `[bg] Unable to open library, software version is too old: ${appVersion}`);
            checkForUpdates({
                showAlredy: true,
            });
            return;
        }

        var imageJSONCount = 0;
        var cache;
        var cacheID = hashFnv32a(library.rootDir, true);
        var userData = app.getPath('userData');
        userChcaePath = path.normalize(userData + "/library-caches");

        if (!fs.existsSync(userChcaePath)) {
            fs.mkdirSync(userChcaePath, 0755);
        }
        else {
            ACCESS.safeAccessSync(userChcaePath);
        }

        newCacheDir = path.normalize(userChcaePath + "/" + cacheID + ".txt");
        
        // 有暫存檔案，这里需要花费 300ms
        if (fs.existsSync(newCacheDir) && ACCESS.safeAccessSync(newCacheDir)) {
            ipcRenderer.send('electron-info', `[bg] Load library(cache): ${newCacheDir}`);
            console.log("【本地缓存】正在载入资源库款存：", newCacheDir);
            ipcRenderer.send('app-status-loading-end', true);
            startTime = Date.now();
            try {
                // *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-
                // *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-
                // *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-
                console.time("loadLibraryImageIdsPromise + initFromCacheFilePromise");
                var loadLibraryImageIdsPromise = loadLibraryImageIds(library);
                var initFromCacheFilePromise = initFromCacheFile();

                Promise.all([loadLibraryImageIdsPromise, initFromCacheFilePromise]).then(function (result) {
                    console.timeEnd("loadLibraryImageIdsPromise + initFromCacheFilePromise");
                    var ids = result?.[0];
                    var cacheImages = result?.[1];

                    if (!cacheImages || cacheImages.length === 0) {
                        // 如果出错，强制清除缓存，重新载入
                        removeLibraryCache();
                        initLibrary();
                        return;
                    }
                    var loadedTime = (Date.now() - startTime) / 1000;
                    console.log("【initLibrary】 : 發現本地端存在暫存檔案，正在載入...");

                    // 時間在 cache.modificationTime 之後的檔案都必需要重新讀取並重新寫入 cache
                    // 只尋找在 checkTime 之後更動的檔案
                    var stat = fs.statSync(newCacheDir);
                    var lastCheckTime = Date.parse(stat.mtime);

                    library.images = cacheImages;
                    library.lastCheckTime = lastCheckTime;

                    console.log("【initLibrary】 : 缓存最后修改时间为, ", stat.mtime);
                    console.time("【本地缓存】載入最近更改的圖片");

                    // NOTE: 僅用 length 比較有點危險，因為可能同時存在增加與刪除的情況，因此只要有新圖片就需要更新
                    var hasNewImages = false;
                    var originalLength = library.images.length;

                    loadRecentImages(library, ids, function(allImageIds, newImages) {

                        hasNewImages = newImages.length > 0;

                        console.timeEnd("【本地缓存】載入最近更改的圖片");
                        console.time("【本地缓存】暫存載入花費時間");

                        // 判斷是否有圖片已經被刪除，需要更新 Cache 檔案
                        // 這一段花費了 800ms
                        console.time("【本地缓存】Normalize Each Image Object");
                        library.imageMetadatas = [];
                        imageMetadatas = [];
                        
                        library.images = library.images.filter(function(img) {
                            // 这些图片在本地并不存在，不要显示在前台
                            if (!allImageIds[img.id]) {
                                delete library.imagesMapping[img.id];
                                return false;
                            }
                            return true;
                        });

                        console.timeEnd("【本地缓存】Normalize Each Image Object");

                        ipcRenderer.send('app-status-library-metadata-loaded-end');

                        console.timeEnd("【本地缓存】暫存載入花費時間");

                        if (forceQuit) {
                            ipcRenderer.send('electron-info', "[bg] User force quit, skip library load.");
                            return;
                        }

                        // 检查缓存是否有差异
                        checkLibraryDiff(allImageIds, function (needUpdateImages) {

                            let finishCallback = function ({usingPreloadCache}) {
                                console.time("【本地缓存】传送到前台");
                                ipcRenderer.send('app-status-library-loaded-end', {
                                    usingPreloadCache: usingPreloadCache,
                                    imagesStringPath: newCacheDir,
                                    rootDir: library.rootDir,
                                    imagesDir: library.imagesDir,
                                    folders: library.folders,
                                    smartFolders: library.smartFolders,
                                    quickAccess: library.quickAccess,
                                    tagsGroups: library.tagsGroups,
                                    usingCache: true,
                                    modificationTime: library.modificationTime,
                                    loadedTime: loadedTime
                                });
                                if (openWithInfo) {
                                    ipcRenderer.send('load-open-with', openWithInfo);
                                }
                                console.timeEnd("【本地缓存】传送到前台");
                                console.info("【本地缓存】緩存載入完成，一共 %d 筆內容", library.images.length);
                                console.timeEnd("【background.js】initLibrary");
                                console.timeEnd("【background.js】总耗时");

                                
                                ipcRenderer.send('electron-info', "[bg] ---------------------------------------");
                                ipcRenderer.send('electron-info', `[bg]     Eagle version: ${prereleaseVersion || appVersion} Build${buildNumber} (${buildVersion})`);
                                ipcRenderer.send('electron-info', "[bg]  Library location: " + library.rootDir);
                                ipcRenderer.send('electron-info', "[bg]        Cache File: YES (" + newCacheDir + ")");
                                ipcRenderer.send('electron-info', "[bg]           Folders: " + folderCount);
                                ipcRenderer.send('electron-info', "[bg] Encrypted-folders: " + encryptedFolderCount);
                                ipcRenderer.send('electron-info', "[bg]             Files: " + imageJSONCount);
                                ipcRenderer.send('electron-info', "[bg]      Loading time: " + loadedTime + " sec");
                                ipcRenderer.send('electron-info', "[bg]     Loading speed: " + (cacheImages.length / loadedTime).toFixed(2) + " files/sec. (Cache)");
                                ipcRenderer.send('electron-info', "[bg] ---------------------------------------");

                                // TODO: 功能失效
								ColorAnalyzer.addPrepareQueue(library.images);
                                library.images = [];
                                library.tagsGroups = [];
                                library.imageMetadatas = [];
                                libraryLoaded = true;

                                // Watch Files
                                initWatcher(rootDir);

                                fs.readdir(rootDir, function (err, files) {
                                    if (files) {
                                        files.forEach(function (file) {
                                            if (file !== `${MTIMENAME}` && file.indexOf("mtime") >-1) {
                                                fse.remove(path.normalize(`${rootDir}/${file}`));
                                            }
                                        })
                                    }
                                });
                            };

                            let noChanges = !hasNewImages && originalLength === library.images.length && needUpdateImages && needUpdateImages.length === 0;
                            
                            if (noChanges) {
                                imageJSONCount = library.images.length;
                                ipcRenderer.send('electron-info', `[bg] Cache no changes.`);
                                finishCallback({
                                    usingPreloadCache: true
                                });
                            }
                            else {
                                console.time("【本地缓存】写出结果");
                                var writeStream = fs.createWriteStream(newCacheDir, {flags: 'w'});
                                imageJSONCount = 0;
                                Object.keys(library.imagesMapping).forEach(function(key) {
                                    var imageString = library.imagesMapping[key];
                                    if (imageString) {
                                        imageJSONCount++;
                                        writeStream.write(imageString + "\n");
                                    }
                                });
                                writeStream.on('finish', function () {
                                    console.log('All done!');
                                    console.timeEnd("【本地缓存】写出结果");
                                    finishCallback({
                                        usingPreloadCache: false
                                    });
                                });
                                writeStream.end();
                            }
                        });
                    });
                });
                // *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-
                // *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-
                // *-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-
            }
            catch (err) {
                ipcRenderer.send('electron-log', "[bg] Can not load cache file, path: " + newCacheDir);
                ipcRenderer.send('electron-log', "" + err.stack || err);
                // 如果出错，强制清除缓存，重新载入
                removeLibraryCache();
                initLibrary();
                cache = undefined;
            }
        }
        else {
            hasLibraryCache = false;
            startTime = Date.now();
            ipcRenderer.send('app-status-loading-end', false);
            ipcRenderer.send('electron-info', `[bg] No library cache`);
            // 多檔案讀取
            loadImages(library, function(images) {

                if (forceQuit) {
                    ipcRenderer.send('electron-info', "[bg] User force quit, skip library load.");
                    return;
                }

                var loadedTime = (Date.now() - startTime) / 1000;
                try {
                    ipcRenderer.send('app-status-library-metadata-loaded-end');

                    library.lastCheckTime = Date.now();
                    library.applicationVersion = appVersion;

                    console.time("【background.js】渲染前台畫面");
                    console.time("【本地缓存】写出结果");
                    var writeStream = fs.createWriteStream(newCacheDir, {flags: 'w'});
                    imageJSONCount = 0;
                    Object.keys(library.imagesMapping).forEach(function(key) {
                        if (library.imagesMapping[key]) {
                            imageJSONCount++;
                            writeStream.write(library.imagesMapping[key] + "\n");
                        }
                    });

                    writeStream.on('finish', function () {
                        console.log('All done!');
                        console.timeEnd("【本地缓存】写出结果");
                        console.timeEnd("【本地缓存】序列图片");

                        ipcRenderer.send('app-status-library-loaded-end', {
                            usingPreloadCache: false,
                            imagesStringPath: newCacheDir,
                            rootDir: library.rootDir,
                            imagesDir: library.imagesDir,
                            folders: library.folders,
                            smartFolders: library.smartFolders,
                            quickAccess: library.quickAccess,
                            tagsGroups: library.tagsGroups,
                            modificationTime: library.modificationTime,
                            loadedTime: loadedTime
                        });

                        library.images = [];
                        library.tagsGroups = [];
                        library.imageMetadatas = [];
                        libraryLoaded = true;

                        if (openWithInfo) {
                            ipcRenderer.send('load-open-with', openWithInfo);
                        }
                        console.timeEnd("【background.js】渲染前台畫面");
                        console.timeEnd("【background.js】总耗时");

                        ipcRenderer.send('electron-info', "[bg] ---------------------------------------");
                        ipcRenderer.send('electron-info', `[bg]     Eagle version: ${prereleaseVersion || appVersion} Build${buildNumber} (${buildVersion})`);
                        ipcRenderer.send('electron-info', "[bg]  Library location: " + library.rootDir);
                        ipcRenderer.send('electron-info', "[bg]        Cache File: No");
                        ipcRenderer.send('electron-info', "[bg]           Folders: " + folderCount);
                        ipcRenderer.send('electron-info', "[bg] Encrypted-folders: " + encryptedFolderCount);
                        ipcRenderer.send('electron-info', "[bg]             Files: " + imageJSONCount);
                        ipcRenderer.send('electron-info', "[bg]      Loading time: " + loadedTime + " sec");
                        ipcRenderer.send('electron-info', "[bg]     Loading speed: " + (imageJSONCount / loadedTime).toFixed(2) + " files/sec");
                        ipcRenderer.send('electron-info', "[bg] ---------------------------------------");

                        // 應該不需要在呼叫，上面已經呼叫過了！？
                        // saveCacheFile(function () {});

                        // Watch Files
                        initWatcher(rootDir);

                    });

                    writeStream.end();
                }
                catch (e) {
                    console.log(e)
                    ipcRenderer.send('electron-log', "[bg] Library missing, path: " + e.toString());

                }
            });
        }
    });

    // 定期发送背景状态信息到前台
    var lastStateCount = 0;
    clearInterval(backgroundStateInterbal);
    backgroundStateInterbal = setInterval(function () {
        try {
            var metadataQueueLength = 0;
            if (imageMatadataQueue && imageMatadataQueue._tasks.length) {
                metadataQueueLength += imageMatadataQueue._tasks.length;
            }
            if (imagePaletteQueue && imagePaletteQueue._tasks.length) {
                metadataQueueLength += imagePaletteQueue._tasks.length;
            }
            var state = {
                downloadQueueLength: Downloader.queue && Downloader.queue._tasks.length || 0,
                paletteQueuePaused: ColorAnalyzer.queue && ColorAnalyzer.queue.paused,
                paletteQueueLength: ColorAnalyzer.queue && ColorAnalyzer.queue._tasks.length || 0,
                processQueuePaused: processQueue && processQueue.paused,
                metadataQueuePaused: imageMatadataQueue && imageMatadataQueue.paused,
                metadataQueueLength: imageMatadataQueue && imageMatadataQueue._tasks.length,
                paletteQueueDelay: ColorAnalyzer.delay
            };
            var totalCount = state.downloadQueueLength + state.paletteQueueLength + state.metadataQueueLength;

            // if (JSON.stringify(lastStateCount) !== JSON.stringify(state)) {
            if (lastStateCount !== totalCount) {
                ipcRenderer.send('background-state', state);
            }
            else {
                // 仅呼吸，不提供数据，避免 UI 更新
                ipcRenderer.send('background-state', undefined);
            }
            lastStateCount = totalCount;
        }
        catch (err) {
            ipcRenderer.send('background-state', undefined);
            ipcRenderer.send('electron-log', err.stack || err);
        }
    }, 1000);
};


// ----------------------------------------
// 載入 Library 檔案
// ----------------------------------------
function loadLibrary(metadataPath) {

    // ipcRenderer.send('electron-info', "用户载入资源库：" + metadataPath);
    folderCount = 0;
    encryptedFolderCount = 0;

    if (
        // path.normalize(metadataPath).indexOf(appPath) !== -1 || 
        path.dirname(path.dirname(metadataPath)) === appPath ||
        (process.platform === 'darwin' && metadataPath.indexOf("/Eagle.app/") !== -1) 
    ) {
        ipcRenderer.send('electron-log', "[bg] " + metadataPath + ", It is forbidden to put metadata.json in the installation directory: " + appPath);
        console.log("非法资源库路径：" + metadataPath + "，资源库禁止放在安装目录：" + appPath);
        dialog.showErrorBox(i18n.__('dialog.illegalLibraryPath.title'), i18n.__('dialog.illegalLibraryPath.desc'))
        if (library && library.rootDir) {}
        else {
            ipcRenderer.send('welcome-end', {
                libraryMissed: true,
                libraryPath: path.normalize(metadataPath),
            });
        }
        return;
    }

    try {
        var libPath = metadataPath.replace("metadata.json", "");
        // 资源库不存在
        if (!fs.existsSync(metadataPath)) {
            ipcRenderer.send('show-error-box', {
                title: i18n.__('dialog.libraryMissed.title'),
                message: i18n.__('dialog.libraryMissed.desc')
            });
            ipcRenderer.send('welcome-end');
            ipcRenderer.send('electron-log', "[bg] Library missing, path: " + metadataPath);
            return;
        }

        var data;
        var library;
        // 文件存在，但却无法读取或者档案已经无法 parse，尝试使用 backup 进行复原
        try {
            data = fs.readFileSync(metadataPath, 'utf8');
            library = JSON.parse(data);
        }
        catch (err) {
            ipcRenderer.send('electron-log', "[bg] metadata.json exception, path: " + metadataPath);
            ipcRenderer.send('electron-log', "" + err.stack || err);

            ipcRenderer.send('electron-info', "[bg] Restore metadata.json with backup file");

            // 使用备份进行复原
            var restoreResult = restoreMetadataFile(libPath);
            if (restoreResult) {
                ipcRenderer.send('electron-info', "[bg] Restore metadata.json successfully, reload library");
                initLibrary();
            }
            else {
                ipcRenderer.send('electron-log', "[bg] Restore metadata.json fail");
                ipcRenderer.send('welcome-end', {
                    libraryMissed: true,
                    libraryPath: path.normalize(metadataPath),
                });
            }
            return;
        }
    
        var folderMappings = {};

        // 避免用户随意改 metadata 或者把 image metadata 覆盖资源库的
        if (!library.applicationVersion) {
            throw new Error("资源库文件异常");
        }
        
        library.folders.forEach(function(folder) {
            folder.images = [];
            folderMappings[folder.id] = folder;
        });

        // bind parent
        eagle.utils.tree.walk(library.folders, 'children', function (folder, parent) {
            folderCount++;
            if (folder && parent) {
                folder.parent = parent.id;
            }
            if (folder && folder.password) {
                encryptedFolderCount++;
            }
        });

        var smartFolderChanged = false;
        if (library.smartFolders && library.smartFolders.forEach) {
            library.smartFolders.forEach(function(smartFolder) {
                // 1.9.2 调整了 smartFolder 结构，这里做了自动转换的工作
                try {
                    if (!smartFolder.conditions && smartFolder.set) {
                        smartFolder.conditions = [
                            {
                                rules: smartFolder.rules,
                                match: (smartFolder.set === 'intersection')? 'AND':'OR'
                            }
                        ];
                        smartFolderChanged = true;
                    }
                }
                catch (err) {
                    ipcRenderer.send('electron-log', "" + err.stack || err);
                }
            });
        }

        library.metadataPath = metadataPath;
        return library;

    } catch (err) {
        ipcRenderer.send('electron-log', "[bg] metadata.json exception, path: " + metadataPath);
        ipcRenderer.send('electron-log', "" + err.stack || err);

        ipcRenderer.send('electron-info', "[bg] Restore metadata.json with backup file");

        // 使用备份进行复原
        var restoreResult = restoreMetadataFile(libPath);
        if (restoreResult) {
            ipcRenderer.send('electron-info', "[bg] Restore metadata.json successfully, reload library");
            initLibrary();
        }
        else {
            ipcRenderer.send('electron-log', "[bg] Restore metadata.json fail");
            ipcRenderer.send('show-error-box', {
                title: i18n.__('dialog.libraryMissed.title'),
                message: i18n.__('dialog.libraryMissed.desc')
            });
            ipcRenderer.send('welcome-end');
        }
    }
};

// ----------------------------------------
// 載入所有圖片 metadatas 檔案
// ----------------------------------------
function loadImages(library, callback) {

    console.time("fs.readdir")
    ipcRenderer.send('electron-info', `[bg] Get /images folders...`);
    ipcRenderer.send('app-status-library-dirs-loading');

    let readDirTimeout = setTimeout(function () {
        ipcRenderer.send('electron-log', `[bg] Get /images folders timeout, over 120s...(${library.imagesDir})`);
    }, 120000);

    fs.readdir(library.imagesDir, function(err, files) {
        clearTimeout(readDirTimeout);
        if (err) {
            ipcRenderer.send('electron-log', `[bg] load images folder ${library.imagesDir} error...`);
            ipcRenderer.send('electron-log', "" + err.stack || err);
            ipcRenderer.send('show-error-box', {
                title: 'Unable to load library',
                message: '' + err.stack
            });
            return;
        }
        ipcRenderer.send('electron-info', `[bg] Get /images folders finished, total: ${files.length}`);
        console.timeEnd("fs.readdir")
        // console.log("files: %d", files.length);
        // ipcRenderer.send('log', "file paths loaded!");
        ipcRenderer.send('app-status-library-dirs-loaded-end');

        // 讀取資料夾中所有的
        var imageIds = [];
        var dirs = [];
        library.imageMetadatas = [];
        library.imagesMapping = {};
        console.time("【background.js】载入资源库所有图片文件夹");
        files.forEach(function(file) {
            if (file == '.DS_Store') return;
            var folderId = file.replace(".info", "");
            // Note: 避免载入非 Eagle guid() 长度的内容
            if (folderId.length === 36 || folderId.length === 13) {
                imageIds.push(folderId);
                library.imageMetadatas.push({
                    id: folderId,
                    path: path.normalize(library.imagesDir + file + "/metadata.json")
                });
                dirs.push(library.imagesDir + file);
            }
        });
        console.timeEnd("【background.js】载入资源库所有图片文件夹");

        // 将总数量传送到画面上，让使用者有预期
        var total = library.imageMetadatas.length;
        ipcRenderer.send('app-status-library-dirs-loaded-end', total);
        
        readMetadataFiles(library.imageMetadatas, 'utf8', function(err, result) {
            try {
                for (var i = 0; i < result.length; i++) {
                    if (result[i]) {
                        let json = result[i].json;
                        const id = result[i].id;
                        try {
                            if (json && json?.endsWith && json.endsWith("}")) {
                                json = json.replace(/[\r\n]/g, "");
                                library.imagesMapping[id] = json;
                            }
                            else {
                            }
                        } catch (e) {}
                    }
                }
                callback();
            }
            catch (err) {
                ipcRenderer.send('electron-log', err.stack || err);
            }
        });
    });
};

// var stripBom = require('strip-bom');
function readMetadataFiles(items, options, cb) {
  if (cb === undefined) {
    cb = options;
    options = null;
  }

  if (typeof cb !== 'function') {
    // throw new TypeError(
    //   cb +
    //   ' is not a function. Last argument to read-multiple-files must be a callback function.'
    // );
  }

//   if (!Array.isArray(filePaths)) {
    // throw new TypeError(
    //   filePaths +
    //   ' is not an array. First Argument to read-multiple-files must be an array of file paths.'
    // );
//   }
    const filePaths = items.map(function (item) {
        return item.path;
    });

    var cbs = filePaths.map(function(filePath, index) {
        return function(callback) {

            if (forceQuit) {
                // setTimeout(callback, 0);
                return callback();
            }

            // fs.readFile(filePath, 'utf8', callback);
            fs.readFile(filePath, 'utf8', function (err, data) {
                // 每次 + 10 通知，减少通知事件数量
                if (index % 10 === 0 || index + 10 >= filePaths.length) {
                    ipcRenderer.send('app-status-library-metadata-loading-end');
                }
                if (!err) {
                    callback(null, {
                        json: data,
                        id: items[index].id
                    });
                }
                else {
                    callback(null);
                }
            });
        }
    });
    async.parallelLimit(cbs, 32, function(err, result) {
        if (err) {
            cb(err);
            return;
        }
        cb(null, result);
    });
};


var _getAllFilesFromFolder = function(dir) {

    var filesystem = require("fs");
    var results = [];

    filesystem.readdirSync(dir).forEach(function(file) {

        file = dir+'/'+file;
        var stat = filesystem.statSync(file);

        if (stat && stat.isDirectory()) {
            results = results.concat(_getAllFilesFromFolder(file))
        } else results.push(file);

    });

    return results;

};

async function loadLibraryImageIds (library) {
    return new Promise((resolve, reject) => {
        console.time("fs.readdir");
        ipcRenderer.send('electron-info', `[bg] Get /images folders...`);
        ipcRenderer.send('app-status-library-dirs-loading');
        fs.readdir(library.imagesDir, function(err, files) {
            console.timeEnd("fs.readdir");
            ipcRenderer.send('electron-info', `[bg] Get /images folders finished, total: ${files.length}`);
            var ids = files.map(function (file) {
                return file.replace(".info", "");
            });
            return resolve(ids);
        });
    });
}

// ----------------------------------------
// 載入在 Cache 檔案更新時間之後的所有圖片 metadatas 檔案
// ----------------------------------------
function loadRecentImages(library, ids, callback) {
    // console.time("fs.readdir");
    // fs.readdir(library.imagesDir, function(err, files) {
    //     console.timeEnd("fs.readdir");
    var allImageIds = {};
    var imageIds = [];
    var dirs = [];
    var imageMetadatas = [];
    var newImages = [];
    var total = 0;

    ids.forEach(function (id) {
        allImageIds[id] = true;
        total++;
        // 图片 id 不存在于当前的库
        if (id && (id.length === 36 || id.length === 13) && !library.imagesMapping[id]) {
            var metaPath = path.normalize(library.imagesDir + id + ".info/metadata.json");
            if (fs.existsSync(metaPath)) {
                newImages.push(id);
            }
        }
    });

    console.info("【本地缓存】比对缓存过后，有 %d 张新的图片", newImages.length);

    ipcRenderer.send('app-status-library-dirs-loaded-end', newImages.length);
    // 事先载入图片
    console.time("【本地缓存】事先载入图片");
    if (newImages && newImages.length > 0) {
        var cbs = newImages.map(function(id, index) {
            return function(cb) {
                
                var metaPath = path.normalize(library.imagesDir + "/" + id + ".info/metadata.json");
                var isCallback = false;
                var fcb = function () {
                    if (isCallback) return;
                    isCallback = true;
                    cb();
                };

                fs.readFile(metaPath, 'utf8', function (err, json) {
                    try {
                        if (err) {
                            fcb();
                        }
                        else {
                            if (json && json.length > 0) {
                                try {
                                    library.imagesMapping[id] = json;
                                    const item = parseMetadataJSON(json);
                                    library.images.push(item);
                                }
                                catch (err) {}
                            }
                            // 每次 + 10 通知，减少通知事件数量
                            if (index % 10 === 0 || index + 10 >= newImages.length) {
                                ipcRenderer.send('app-status-library-metadata-loading-end');
                            }
                            fcb();
                        }
                    }
                    catch (err) {
                        console.log(err);
                        fcb();
                    }
                });
            }
        });
        async.parallelLimit(cbs, 24, function(err, result) {
            console.timeEnd("【本地缓存】事先载入图片");
            callback(allImageIds, newImages);
        });
    }
    else {
        callback(allImageIds, newImages);
    }
};

function createMTimeLogs (callback) {
    console.time("【本地缓存】创建 mtime.json");
    try {

        var mtimeLogsPath = path.normalize(library.rootDir + `/${MTIMENAME}`);
        var tempDir = `${EAGLE_THUMBNAIL_TEMP_PATH}/mtime-${guid()}.json`;

        if (!fs.existsSync(EAGLE_THUMBNAIL_TEMP_PATH)) {
            fs.mkdirSync(EAGLE_THUMBNAIL_TEMP_PATH);
        }

        lastModifiedTimeMappings = {};

        for (var i = 0; i < library.images.length; i++) {
            var img = library.images[i];
            if (img.lastModified) {
                lastModifiedTimeMappings[img.id] = img.lastModified;
            }
        }
        var json = JSON.stringify(lastModifiedTimeMappings);
        fs.writeFile(mtimeLogsPath, json, function (err) {
            console.timeEnd("【本地缓存】创建 mtime.json");
            try {
                if (err) {
                    ipcRenderer.send('electron-log', `[bg] create and write ${mtimeLogsPath} error...`);
                    ipcRenderer.send('electron-log', "" + err.stack || err);
                }
                else {
                    if (fs.existsSync(tempDir)) {
                        fse.moveSync(tempDir, mtimeLogsPath, { overwrite: true });
                        // fs.renameSync(tempDir, mtimeLogsPath);
                        fse.removeSync(tempDir);
                    }
                }
                if (callback) { callback(); }
            }
            catch (err) {
                if (callback) { callback(); }
            }
        });
    }
    catch (err) {
        ipcRenderer.send('electron-log', `[bg] create mtime.json error...`);
        ipcRenderer.send('electron-log', "" + err.stack || err);
        if (callback) { callback(); }
    }
};

var updateMTimeLogsTimeoutByMeta;
var updateMTimeLogsWithTimeoutByMeta = function (callback) {
    clearTimeout(updateMTimeLogsTimeoutByMeta);
    updateMTimeLogsTimeoutByMeta = setTimeout(function () {
        updateMTimeLogs(callback);
    }, 1000);
};

var updateMTimeLogsTimeoutByPalette;
var updateMTimeLogsWithTimeoutByPalette = function (callback) {
    clearTimeout(updateMTimeLogsTimeoutByPalette);
    updateMTimeLogsTimeoutByPalette = setTimeout(function () {
        updateMTimeLogs(callback);
    }, 1000);
};

var updateMTimeLogs = function (callback) {

    if (!library || !library.rootDir) {
        if (callback) {
            callback();
        }
        return;
    }

    var mtimeLogsPath = path.normalize(library.rootDir + `/${MTIMENAME}`);
    var tempDir = `${EAGLE_THUMBNAIL_TEMP_PATH}/mtime-${guid()}.json`;

    if (!fs.existsSync(EAGLE_THUMBNAIL_TEMP_PATH)) {
        fs.mkdirSync(EAGLE_THUMBNAIL_TEMP_PATH);
    }

    console.time("【本地缓存】更新 mtime.json");

    fs.stat(mtimeLogsPath, function (err, mtimeStat) {
        try {

            var needUpdate = false;

            if (err) { needUpdate = true; }

            var jsonStr = fs.readFileSync(mtimeLogsPath);
            var mtimeMappings;
            try {
                mtimeMappings = JSON.parse(jsonStr);
            }
            catch (err) {
                mtimeMappings = {};
            }
            var currentIds = Object.keys(mtimeMappings);

            for (let i = 0; i < currentIds.length; i++) {
                var id = currentIds[i];
                if (id === "all") continue;
                // 新增项目
                if (!lastModifiedTimeMappings[id]) {
                    lastModifiedTimeMappings[id] = mtimeMappings[id];
                    needUpdate = true;
                }
                // 修改项目
                // else if (mtimeMappings[id] > lastModifiedTimeMappings[id]) {
                    // lastModifiedTimeMappings[id] = mtimeMappings[id];
                // }
            }

            var max = 0;
            var imgs = Object.keys(lastModifiedTimeMappings);
            for (var i = 0; i < imgs.length; i++) {
                var key = imgs[i];
                if (!library.imagesMapping[key]) {
                    delete lastModifiedTimeMappings[key];
                }
                if (!needUpdate && lastModifiedTimeMappings[key] > max) {
                    max = lastModifiedTimeMappings[key];
                }
            }

            if (!needUpdate) {
                if (max > mtimeStat.mtimeMs) {
                    needUpdate = true;
                }
            }

            lastModifiedTimeMappings["all"] = Object.keys(library.imagesMapping).length;

            if (needUpdate) {

                unwatchMtimeFile(mtimeWatcherPath);

                var json = JSON.stringify(lastModifiedTimeMappings);
                fs.writeFileSync(tempDir, json);

                try {
                    fse.moveSync(tempDir, mtimeLogsPath, { overwrite: true });
                    fse.remove(tempDir);
                }
                catch (err) {
                    ipcRenderer.send('electron-log', "" + err.stack || err);
                }

                watchMtimeFile(mtimeWatcherPath);
                backupMetadata();
            }
            else {
                console.log("沒有任何修改，無須更新 mtime.json");
            }

            console.timeEnd("【本地缓存】更新 mtime.json");
            if (callback) {
                setTimeout(function () {
                    callback();
                }, 10);
            }
        }
        catch (err) {
            ipcRenderer.send('electron-log', `[bg] update ${mtimeLogsPath} error...`);
            ipcRenderer.send('electron-log', "" + err.stack || err);
            if (fs.existsSync(tempDir)) {
                fse.remove(tempDir);
            }
            if (callback) { callback(); }
        }
    });
};

// 每 30 分钟自動備份 metadata.json
var TEN_MIN = 3 * 1000 * 60 * 10;
setInterval(function() {
    backupMetadata();
}, TEN_MIN);

function backupMetadata () {

    console.log("准备备份 metadata.json");

    // 保留 200 份修改记录
    // 用户有修改关闭软件或者 timer 触发进行备份
    // 备份格式 backup-2019-12-01 10:23:123
    // 当数量超过 200 份时，自动删除最旧版本
    // 備份 Metadata.json 避免未來某天損毀
    // 避免备份了已经损坏的文件
    try {
        if (library && library.applicationVersion) {

            if (!fs.existsSync(library.rootDir)) {
                return;
            }

            var MAX_BACKUP_COUNT = 100;
            var localBackupPath = path.normalize(library.rootDir + "/backup/");
            var currentMetadataPath = path.normalize(library.rootDir + "/metadata.json");
            if (!fs.existsSync(localBackupPath)) { fs.mkdirSync(localBackupPath, 0755); }

            // 确保不会备份到坏的文件
            var data = fs.readFileSync(currentMetadataPath, 'utf8');
            try {
                var testLibrary = JSON.parse(data);
                if (!testLibrary.applicationVersion) {
                    ipcRenderer.send('electron-log', `[bg] Backup metadata.json fail, because current metadata.json is damaged`);
                    return;
                }
            }
            catch (err) {
                ipcRenderer.send('electron-log', `[bg] Backup metadata.json fail, because current metadata.json is damaged`);
                ipcRenderer.send('electron-log', "" + err.stack || err);
                return;
            }

            var time = require('moment')().format("YYYY-MM-DD HH.mm.ss.SSS");
            var backupPath = path.normalize(`${localBackupPath}backup-${time}.json`);

            var backupFiles = fs.readdirSync(localBackupPath);
            backupFiles = backupFiles.filter(function (file) {
                return file.indexOf("backup-") > -1;
            });

            if (backupFiles.length > 0) {

                backupFiles = backupFiles.sort(function (a, b) {
                    if(a > b) return -1;
                    if(a < b) return 1;
                    return 0;
                });

                var latestBackup = localBackupPath + backupFiles[0];
                var lastestBackupSize = fs.statSync(latestBackup).size;
                var currentSize = fs.statSync(currentMetadataPath).size;
                if (lastestBackupSize !== currentSize) {
                    safeCopy.async(currentMetadataPath, backupPath);
                    ipcRenderer.send('electron-info', `[bg] Backup metadata.json to ${backupPath}`);

                    try {
                        if (!fs.existsSync(EAGLE_THUMBNAIL_BACKUP_PATH)) { fs.mkdirSync(EAGLE_THUMBNAIL_BACKUP_PATH, 0755); }
                        let cacheID = hashFnv32a(library.rootDir, true);
                        let appDataBackupPath = path.normalize(`${EAGLE_THUMBNAIL_BACKUP_PATH}/${cacheID}.json`);
                        if (fs.existsSync(appDataBackupPath)) { fse.removeSync(appDataBackupPath); }
                        safeCopy.async(currentMetadataPath, appDataBackupPath);
                        ipcRenderer.send('electron-info', `[bg] Backup metadata.json to ${appDataBackupPath}`);
                    } catch (err) {}

                }
                
                // 删除多的备份
                var needDeletes = backupFiles.slice(MAX_BACKUP_COUNT - 1);
                if (needDeletes.length > 0) {                    
                    console.log(needDeletes);
                    needDeletes.forEach(function (file) {
                        try {
                            fse.removeSync(`${localBackupPath}${file}`);
                        }
                        catch (err) {}
                    });
                }
            }
            else {
                safeCopy.async(currentMetadataPath, backupPath);
                ipcRenderer.send('electron-info', `[bg] Backup metadata.json to ${backupPath}`);
            }
        }
    }
    catch (err) {
        ipcRenderer.send('electron-log', err.stack || err);
    }
}

function restoreMetadataFile (libPath) {
    var localBackupPath = path.normalize(libPath + "/backup/");
    var currentMetadataPath = path.normalize(libPath + "/metadata.json");

    if (!fs.existsSync(localBackupPath)) { 
        ipcRenderer.send('electron-log', `[bg] ${localBackupPath} does not exist`);
        fs.mkdirSync(localBackupPath, 0755);
        return false;
    }

    var backupFiles = fs.readdirSync(localBackupPath);
    backupFiles = backupFiles.filter(function (file) {
        if (file.indexOf("backup-") > -1) {
            try {
                var size = fs.statSync(path.normalize(localBackupPath + file)).size;
                return size > 0;
            }
            catch (err) {}
        }
    });

    if (backupFiles.length > 0) {

        backupFiles = backupFiles.sort(function (a, b) {
            if(a > b) return -1;
            if(a < b) return 1;
            return 0;
        });

        // 找出可还原的最后版本
        for (var i = 0; i < backupFiles.length; i++) {
            var backupFileName = backupFiles[i];
            var backupFilePath = path.normalize(localBackupPath + backupFileName);

            ipcRenderer.send('electron-info', `[bg] Restore with backup file: ${backupFilePath} ...`);

            var data = fs.readFileSync(backupFilePath, 'utf8');
            if (!data || data ===  "") continue;
            try {
                var libraryData = JSON.parse(data);
                if (libraryData.modificationTime) {
                    ipcRenderer.send('electron-info', `[bg] File verification succeeded: ${backupFilePath} , start restoring...`);

                    // 将异常文件保留
                    try { 
                        var damagedBackupPath = path.normalize(localBackupPath + "metadata.json.damaged-" + Date.now())
                        safeCopy.sync(currentMetadataPath, damagedBackupPath); 
                    } catch (err) {}

                    // 移除原文件，使用备份替代
                    try {
                        var rimrafSync = require('rimraf').sync;              // 10-15 ms
                        rimrafSync(currentMetadataPath);
                        safeCopy.sync(backupFilePath, currentMetadataPath);
                        ipcRenderer.send('electron-info', `[bg] ${backupFilePath} copy successfully`);
                        return true;
                    }
                    catch (err) {
                        ipcRenderer.send('electron-log', "" + err.stack || err);
                        ipcRenderer.send('electron-log', `[bg] ${backupFilePath} copy fail, skip this file...`);
                    }
                }
                else {
                    ipcRenderer.send('electron-log', `[bg] ${backupFilePath} incomplete format, skip this file...`);
                }
            }
            catch (err) {
                ipcRenderer.send('electron-log', `[bg] Unable to read ${backupFilePath}, skip this file...`);
            }
        }
    }
    else {
        ipcRenderer.send('electron-log', `[bg] ${localBackupPath} has no backup files`);
    }
}

// 非同步檢測緩存的資源庫是否有更新
function checkLibraryDiff (allImageIds, checkCallback) {

    try {
        var imageMetadatas = [];
        var mtimeLogsPath = path.normalize(library.rootDir + `/${MTIMENAME}`);

        if (!fs.existsSync(mtimeLogsPath)) {
            createMTimeLogs(function () {
                if (checkCallback) { checkCallback([]); }
            });
            return;
        }

        // 检查当前缓存图片的时间点，如果时间点较早，就需要重新载入
        var jsonStr = fs.readFileSync(mtimeLogsPath);
        lastModifiedTimeMappings = JSON.parse(jsonStr);
        var needUpdateImages = [];
        for (var i = 0; i < library.images.length; i++) {
            var img = library.images[i];
            // 沒有在 images 裡面的檔案不需要進行更新，可以避免 mtime 存留著垃圾
            if (allImageIds[img.id]) {
                var originalMTime = lastModifiedTimeMappings[img.id];
                // TODO: 請確認這裡沒有異常
                if (originalMTime && img.lastModified && img.lastModified < originalMTime) {
                    // console.log("图片：" + img.id + "需要更新");
                    needUpdateImages.push(img);
                }
            }
        }

        if (needUpdateImages.length === 0) {
            if (checkCallback) { checkCallback(needUpdateImages); }
            return;
        }

        // 開始檢查更新
        ipcRenderer.send('checking-library-cache', needUpdateImages.length);
        var startTime = Date.now();
        ipcRenderer.send('electron-info', `[bg] Need to update cache, total: ${needUpdateImages.length} files`);
        var cbs = needUpdateImages.map(function(image, index) {

            return function(callback) {

                var hasCallback = false;
                var finalCallback = function () {
                    if (!hasCallback) {
                        hasCallback = true;
                        // setTimeout(callback, 1);
                        callback();
                    }
                }

                if (forceQuit) {
                    finalCallback();
                    return;
                }

                var id = image.id;
                var metaPath = path.normalize(library.imagesDir + image.id + ".info/metadata.json");

                // 每次 + 10 通知，减少通知事件数量
                if (index % 10 === 0 || index + 10 >= needUpdateImages.length) {
                    ipcRenderer.send('checking-library-cache-increase');
                }

                imageMetadatas.push(metaPath);
                if (!library.imageMetadatas) library.imageMetadatas = [];

                library.imageMetadatas.push(metaPath);

                fs.readFile(metaPath, 'utf8', function (err, json) {
                    if (!err) {
                        try {
                            json = json.replace(/[\r\n]/g, "");
                            var imageObj = JSON.parse(json);
                            if (imageObj) {
                                if (library.imagesMapping[imageObj.id]) {
                                    library.imagesMapping[imageObj.id] = json;
                                    if (imageObj.lastModified) {
                                        lastModifiedTimeMappings[imageObj.id] = imageObj.lastModified;
                                    }
                                }
                            }
                            finalCallback();
                        }
                        catch (error) {
                            finalCallback();
                        }
                    }
                    else {
                        delete library.imagesMapping[image.id];
                        delete lastModifiedTimeMappings[image.id]
                        ipcRenderer.send('electron-log', "[bg] metadata.json file missing: " + metaPath);
                        finalCallback();
                    }
                });
            }
        });

        console.time("【缓存检查】总耗时");
        async.parallelLimit(cbs, 32, function(err, result) {

            console.timeEnd("【缓存检查】总耗时");
            var totalTime = (Date.now() - startTime) / 1000;
            ipcRenderer.send('electron-info', `[bg] Cache update successfully, total: ${totalTime} sec`);

            if (forceQuit) {
                return;
            }

            console.info("【缓存检查】有 %d 筆內容需要更新", imageMetadatas.length);

            library.imageMetadatas = [];

            if (imageMetadatas.length > 0) {
                saveCacheFile(function () {});
            }

            if (checkCallback) {
                checkCallback([]);
            }
        });
    }
    catch (err) {
        // 如果不存在 lastModifiedTimeMappings ，就创建一个
        lastModifiedTimeMappings = {};
        if (checkCallback) {
            checkCallback([]);
        }
        if (err) { ipcRenderer.send('electron-log', "" + err.stack || err); }
        console.log(err);
    }
}

function normalizeProperities (image) {
    try {
        if (image && image.url && image.url.length > 2000) {
            image.url = image.url.slice(0, 2000);
        }
    }
    catch (err) {
        ipcRenderer.send('electron-log', "" + err.stack || err);
    }
};

// NOTE: 暂时修复 1.8.0 buffer 会被记录在 metadata.json 的 bug
function fix18VersionBug (image) {
    try {
        ipcRenderer.send('electron-log', `[bg] Upgrade image info from 1.8 version : ${image.id}`);
        delete image.buffer;
        if (!image.ext) image.ext = "png";
        if (!image.width) {
            image.width = 0;
            image.height = 0;
        }
        if (!image.modificationTime) {
            var time = new Date(image.name.replace(/\./g, ":")).getTime();
            if (time) {
                image.modificationTime = time;
            }
            else {
                image.modificationTime = Date.now();
            }
        }
    }
    catch (err) {
        ipcRenderer.send('electron-log', err.stack || err);
    }
}

function removeUnusedProperities (image) {
    try {
        // delete image["thumbWith"];
        delete image["encodeName"];
        delete image["disable"];
        delete image["buffer"];
        delete image["startAt"];
        delete image["oldName"];
        delete image["newName"];
        delete image["playing"];
        delete image["thumbnailPath"];
        delete image["rawPath"];
        delete image["$$hashKey"];
        delete image["activating"];
        delete image["deactivating"];
    }
    catch (err) {
        ipcRenderer.send('electron-log', "" + err.stack || err);
    }
    return image;
};

function onImageChange (image) {
    try {
        if (!image) return;
        if (forceQuit) return;
        // 如果不存在队列，添加到队列中
        if (!metadataQueueImagesMapping[image.id]) {
            metadataQueueImagesMapping[image.id] = image;
            imageMatadataQueue.push({
                type: "modified",
                image: metadataQueueImagesMapping[image.id]
            }, function () {
                console.log("image.metadata.saved");
            });
            imageMatadataQueue.resume();
        }
        // 已存在队列但尚未处理，立即更新分身
        else {
            // console.log("已经存在不添加");
            metadataQueueImagesMapping[image.id] = image;
        }
    }
    catch (err) {
        ipcRenderer.send('electron-log', "" + err.stack || err);
    }
};

function onImagesChange (images, unshift, type) {
    try {
        if (!images) return;
        if (forceQuit) return;

        for (var i = 0; i < images.length; i++) {
            // 如果不存在队列，添加到队列中
            if (!metadataQueueImagesMapping[images[i].id]) {
                metadataQueueImagesMapping[images[i].id] = images[i];
                if (unshift) {
                    imageMatadataQueue.unshift({
                        type: type,
                        image: metadataQueueImagesMapping[images[i].id],
                        unshift: unshift
                    }, function () {
                        // console.log("images.metadata.saved");
                    });
                    // imageMatadataQueue.resume();
                }
                else {
                    imageMatadataQueue.push({
                        type: type,
                        image: metadataQueueImagesMapping[images[i].id],
                        unshift: unshift
                    }, function () {
                        // console.log("images.metadata.saved");
                    });
                    // imageMatadataQueue.resume();
                }
            }
            // 已存在队列但尚未处理，立即更新分身
            else {
                // console.log("已经存在不添加");
                metadataQueueImagesMapping[images[i].id] = images[i];
            }
        }
        imageMatadataQueue.resume();
    }
    catch (err) {
        ipcRenderer.send('electron-log', "" + err.stack || err);
    }
};

function addToImagesPaletteQueue (images, unshift) {
    try {
        if (!images) return;
        if (forceQuit) return;

        for (var i = 0; i < images.length; i++) {
            // 如果不存在队列，添加到队列中
            if (!metadataQueueImagesMapping[images[i].id]) {
                metadataQueueImagesMapping[images[i].id] = images[i];
                if (unshift) {
                    imagePaletteQueue.unshift({
                        type: "palette-change",
                        image: metadataQueueImagesMapping[images[i].id],
                        unshift: unshift
                    }, function () {
                        // console.log("palette.saved");
                    });
                }
                else {
                    imagePaletteQueue.push({
                        type: "palette-change",
                        image: metadataQueueImagesMapping[images[i].id],
                        unshift: unshift
                    }, function () {
                        // console.log("palette.saved");
                    });
                }
            }
            // 已存在队列但尚未处理，立即更新分身
            else {
                // console.log("已经存在不添加");
                metadataQueueImagesMapping[images[i].id] = images[i];
            }
        }
    }
    catch (err) {
        ipcRenderer.send('electron-log', "" + err.stack || err);
    }
};

var saveLibraryMetadata = debounce(function (params) {

    if (!params.libraryDir) return;

    var originalPalettePaused = ColorAnalyzer.queue.paused;
    console.log("saveLibraryMetadata");
    console.log("分析队列「暂停」");

    ColorAnalyzer.pause();
    unwatchMetadataFile();
    writeLibraryQueue.push({
        params: params,
    }, function (err) {
        var metadataFilePath = path.normalize(library.rootDir + "/metadata.json");
        metadataWatcherPath = metadataFilePath;
        watchMetadataFile(metadataWatcherPath);
        if (!originalPalettePaused) {
            console.log("分析队列「继续」");
            ColorAnalyzer.resume();
        }
        if (err) {
            console.log(err)
            ipcRenderer.send('electron-log', "[bg] Save library cache fail");
            ipcRenderer.send('electron-log', "" + err.stack || err);
        }
    });
}, 300);

function decodeBase64Image(dataString) {
    try {
        let response = {};
        if (dataString.indexOf(`data:image/svg+xml;utf8,`) > -1) {
            let svgStr = dataString.split(`data:image/svg+xml;utf8,`)[1];
            response.data = new Buffer(decodeURIComponent(svgStr), 'utf-8');
        }
        else {
            let base64 = dataString.split(";base64,")?.[1];
            let type = dataString.match(/^data:(.+?);/)?.[1];
            if (!base64 || !type) return;
            response.type = type;
            response.data = new Buffer(base64, 'base64');
        }
        return response;
    }
    catch (err) {
        ipcRenderer.send('electron-log', "" + err.stack || err);
    }
}

function uploadBse64Image (file, callback) {
    try {
        if (!file || !file.id) return;
        let base64 = file.base64data;
		let src = path.normalize(`${EAGLE_THUMBNAIL_TEMP_PATH}/${file.id}`);
        let buffer = file.buffer || decodeBase64Image(file.base64data).data;
		delete file.buffer;
        delete file.base64data;

		fs.writeFileSync(src, buffer);

		file.path = src;
		file.cutMode = true;

		addToProcessQueue(file);
		callback && callback(base64);
    }
    catch (err) {
        console.log(err);
        ipcRenderer.send('file-uploaded-end', {});
        ipcRenderer.send('electron-log', "" + err.stack || err);
        callback && callback();
    }
}

// ----------------------------------------
// 從剪貼簿貼上內容
// ----------------------------------------
function addFilesFromClipboard (params) {
    var image = clipboard.readImage();
    if(image && !image.isEmpty()) {
        var isJPG = clipboard.readBuffer("public.jpeg").length > 0;
        var buffer;
        if (!isJPG) {
            buffer = image.toPNG();
        }
        else {
            buffer = image.toJPEG(100);
        }
        var file = {
            id: guid(),
            name: params.name || "Clipboard - " + require('moment')().format("YYYY-MM-DD HH.mm.ss"),
            url: params.url || "",
            folders: [],
            buffer: buffer,
            size: buffer.byteLength,
            tags: [],
        };
        if (params.folder) {
            file.folders.push(params.folder.id);
            file.tags = params.folder.extendTags;
        }
        ipcRenderer.send("add-download-task-end");
        uploadBse64Image(file, function (result) {
            ipcRenderer.send('file-uploaded-end', {});
        });
    }
};

// ----------------------------------------
// 從檔案路徑添加
// ----------------------------------------
function pasteFromPaths (params) {
    var images = [];
    var files = params.files;

    if (files && files.length > 0) {
        files.forEach(function(file) {
            if (!fs.existsSync(file)) {
                ipcRenderer.send('file-uploaded-end', {});
                return;
            }
            if (fs.statSync(file).isDirectory() && path.extname(file).toLowerCase() !== '.sketch') {
                ipcRenderer.send('file-uploaded-end', {});
                return;
            }
            var ext = getExt({path: file});
            var id = guid();
            var image = {
                id: id,
                name: path.basename(file).replace(path.extname(file), "").replace(/[/]/g, '').replace(/%/g, "").trim() || id,
                path: file,
                type: ext,
                size: file.size,
                lastModified: file.lastModified,
                folders: []
            };
            if (params.folder) {
                image.folders.push(params.folder.id);
                image.tags = params.folder.extendTags || [];
            }
            addToProcessQueue(image);
        });
    }
};

function duplicateFile (id) {
    try {
        // 建立新路径文件 + id
        let newId = guid();
        let originFilePath = path.normalize(`${libraryDir}/images/${id}.info`);
        let originMetadata = path.normalize(`${originFilePath}/metadata.json`);
        let newFilePath = path.normalize(`${libraryDir}/images/${newId}.info`);
        let newMetadata = path.normalize(`${newFilePath}/metadata.json`);

        ipcRenderer.send('electron-info', `[bg] Duplicate file: ${originFilePath}`);

        if (!fs.existsSync(newFilePath)) {
            fs.mkdirSync(newFilePath);
        }

        // 拷贝除 metadata 以外的所有文件到新路径
        fse.copySync(originFilePath, newFilePath);
        fse.removeSync(newMetadata);

        // 读取 metadata，换 id，写到新路径
        let originMetadataJSON = fs.readFileSync(originMetadata, 'utf8');
        let originMetadataObj = JSON.parse(originMetadataJSON);
        originMetadataObj.id = newId;

        fs.writeFileSync(newMetadata, JSON.stringify(originMetadataObj), "utf8");
        
        watchCallback({
            type: "create",
            filePath: newFilePath
        });

        setTimeout(function () {
            ipcRenderer.send('rebind-refresh');
        }, 1000);
    }
    catch (err) {
        ipcRenderer.send('electron-log', err.stack || err);
    }
}

// ----------------------------------------
// 下載圖片
// ----------------------------------------
function uploadUrl (params, callback, cancellationToken) {
    Downloader.download([params], true);
};

// ----------------------------------------
// 將路徑檔案複製到剪貼簿
// ----------------------------------------
function copyFilesToClipboard(paths) {
    if( process.platform == 'darwin' ) {
        // 如果只有选择单一文件，将文件本身写入剪贴板
        if (paths.length === 1) {

            // macOS 拷贝路径如果没有对 #& 做额外处理，会出现异常，变成拷贝粘贴父文件夹
            // clipboard.writeBuffer('public.file-url', Buffer.from('file://' + paths[0].replace(/#/g, '%23')) );
            clipboard.writeBuffer('public.file-url', Buffer.from(URL_MODULE.pathToFileURL(paths[0]).href) );
            clipboard.writeBuffer('NSFilenamesPboardType', Buffer.from(
`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<array>
    <string>${paths[0].replace(/&/g, '&amp;')}</string>
</array>
</plist>`
            ));

            // NOTE: 我也很希望可以同时拷贝路径+图像，但苹果的世界，路径跟图像无法共存，只能选择一个
            // ai 无法粘贴图片，因为我们选择了粘贴文件路径的功能，让 finder 或更多软件可以使用
            var ext = path.extname(paths[0]).toLowerCase();
            let extToIdent = {
                ".bmp": "jpeg",
                ".jpg": "jpeg",
                ".jpeg": "jpeg",
                ".png": "png"
            };
            if (extToIdent[ext]) {
                try {
                    let buffer = fs.readFileSync(paths[0]);
                    if (buffer && buffer.length > 0) {
                        clipboard.writeBuffer(`public.${extToIdent[ext]}`, buffer);
                    }
                }
                catch (err) {
                    console.error(err);
                }
                const exec = require('child_process').exec;
                const scriptPath = path.normalize(`${RESOURCES_PATH}/AppleScript/copyImage.applescript`);
                exec(`osascript "${scriptPath}" "${paths[0]}" "public.${extToIdent[ext]}"`, function (err, stdout, stderr) {
                    console.log(`copy with applescript: ${stdout}`);
                });
            }
        }
        else {
            var xmlStrings = "";
            paths.forEach(function(image) {
                xmlStrings += `<string>${image.replace(/&/g, '&amp;')}</string>
`;
            });
            clipboard.writeBuffer('NSFilenamesPboardType', Buffer.from(
`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<array>
    ${xmlStrings}
</array>
</plist>`
            ));
        }
    }
    // Windows clipboard write
    else {
        // 無法同時複製檔案+圖片，這樣的方式不夠完美
        // if (paths.length === 1 && path.extname(paths[0]).toLowerCase() === ".png") {
        //     clipboard.writeImage(nativeImage.createFromPath(paths[0]));
        // }
        // else {
            // Windows 版本無法再 background 複製圖片，將訊息傳送到 main.js
            ipcRenderer.send("copy-win-files", paths);
        // }
    }
};

function compressWithCanvas (start, dest, format, quality, maxSize, callback) {

    var img = new Image();
    img.onload = function() {

        try {
            var canvas = document.createElement('canvas');
            var ctx = canvas.getContext('2d');
            var base64;

            if (maxSize) {
                if (img.width > img.height) {
                    canvas.width = parseInt(maxSize * img.width / img.height);
                    canvas.height = maxSize;
                }
                else {
                    canvas.width = maxSize;
                    canvas.height = parseInt(maxSize * img.height / img.width);
                }
                ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvas.width, canvas.height);
            }
            else {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            }

            let outputFormat = format || "image/jpeg";
            let outputQuality = quality || 0.8;
            const WEBP_MAX_SIZE = 16383;
            if (canvas.width > WEBP_MAX_SIZE || canvas.height > WEBP_MAX_SIZE) {
                outputFormat = "image/jpeg";
                outputQuality = 0.7;
            }

            base64 = canvas.toDataURL(outputFormat, outputQuality);

            var decode = decodeBase64Image(base64);
            if (!decode || !decode.data) {
                callback(true);
            }
            else {
                fs.writeFileSync(dest, decode.data);
                callback(undefined, {
                    width: img.width,
                    height: img.height
                });
            }
        }
        catch (err) {
            callback(true);
            ipcRenderer.send('electron-log', "" + err.stack || err);
            return;
        }
    };
    img.onerror = function(event) {
        callback(true);
        return;
    };
    img.src = URL_MODULE.pathToFileURL(start).href + "?v=" + Date.now();

}

// --------------------------- -------------
// 建立 Library
// ----------------------------------------
function createLibrary(libraryName, savePath) {

    var libraryPath = path.normalize(savePath + "/" + libraryName + ".library/");
    ipcRenderer.send('electron-info', "[bg] Create new library: " + libraryPath);

    if (fs.existsSync(savePath)) {

        try {
            fs.accessSync(savePath, fs.W_OK)
        }
        catch (err) {
            ipcRenderer.send('electron-log', "[bg] Create library fail, No write permission, path: " + savePath);
            ipcRenderer.send('electron-log', err.stack || err);
            ipcRenderer.send('show-swal', {
                title: i18n.__('dialog.libraryPathReadOnly.title'),
                description: i18n.__('dialog.libraryPathReadOnly.desc') + `(${err.message})`,
                button: i18n.__("general.ok")
            });
            return;
        }

        if (
            fs.existsSync(path.normalize(libraryPath + "/metadata.json")) ||
            savePath.includes(".library")
        ) {
            ipcRenderer.send('show-error-box', {
                title: i18n.__('dialog.libraryExist.title'),
                message: i18n.__('dialog.libraryExist.desc')
            });
        } 
        else {
            var metadata = {
                "applicationVersion": appVersion,
                "folders": [],
                "smartFolders": [],
                "quickAccess": [],
                "tagsGroups": [],
                "modificationTime": Date.now()
            };
            fs.mkdirSync(libraryPath, 0755);
            fs.writeFileSync(path.normalize(libraryPath + "/metadata.json"), JSON.stringify(metadata));
            addToHisotryAndOpen(libraryPath);
            
            ipcRenderer.send('analytics.event-end', {
                EventId: "建立資源庫",
                Label: libraryName
            });
        }
    }
};

function addToHisotryAndOpen (openPath) {

    if (
        path.dirname(openPath) === appPath ||
        // path.normalize(openPath).indexOf(appPath) !== -1 || 
        (process.platform === 'darwin' && openPath.indexOf("/Eagle.app/") !== -1) 
    ) {
        ipcRenderer.send('electron-log', "[bg] Library path error: " + openPath + ", It is forbidden to put metadata.json in the installation directory: " + appPath);
        console.log("非法资源库路径：" + openPath + "，资源库禁止放在安装目录：" + appPath);
        ipcRenderer.send('show-swal', {
            title: i18n.__('dialog.illegalLibraryPath.title'),
            description: i18n.__('dialog.illegalLibraryPath.desc'),
            button: i18n.__("general.ok"),
        });
        return;
    }

    // 判断载入路径的资源库是否合法（避免用户载入其他软件或者图片 metadata.json 路径）
    if (openPath.indexOf(".library/images/") > -1 || openPath.indexOf(".library\\images\\") > -1) {
        ipcRenderer.send('show-error-box', {
            title: i18n.__("dialog.libraryPathError.title"),
            message: i18n.__('dialog.libraryPathError.desc')
        });
        return;
    }

    var libraryHistory = settings.getSync('libraryHistory') || [];
    // libraryHistory = libraryHistory.slice(0, 20);
    if (libraryHistory.indexOf(openPath) === -1) {
        libraryHistory.push(openPath);
    }
    libraryHistory = [...new Set(libraryHistory)];
    
    saveCacheFile(function () {
        ipcRenderer.send('app-status-loading-end', true);
        console.log("緩存更新完成");
        settings.setSync('libraryHistory', libraryHistory);
        settings.setSync('rootDir', openPath);
        ipcRenderer.send('electron-info', "---------------------------------------");
        ipcRenderer.send('electron-info', "[bg] Switch library: " + openPath);
        setTimeout(function () {
            console.log("路徑儲存完成");
            cancelAll();
            removeAllWatchers();
            initLibrary(openPath);
        }, 50);
    });

}

// ----------------------------------------
// 匯入 Library
// ----------------------------------------
function openLibrary(path) {
    addToHisotryAndOpen(path);
};

function sanitizeFolderName(folderName) {
    if (typeof folderName !== 'string') return '';

    // 移除 tab，統一空白
    folderName = folderName.replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();

    if (process.platform === 'darwin') {
        // macOS：僅移除冒號與斜線
        folderName = folderName
            .replace(/[:\/\\]/g, ' ')  // 移除冒號、正反斜線
            .trim();
    } else {
        // Windows：移除非法字元與控制碼
        folderName = folderName
            .replace(/[<>:"\/\\|?*\x00-\x1F]/g, '')  // 非法字元與控制碼
            .replace(/[ ]+$/, '')                    // 結尾空白
            .replace(/[.]+$/, '')                    // 結尾句點
            .trim();

        // 避免使用保留名稱
        const reservedNames = new Set([
            'CON', 'PRN', 'AUX', 'NUL',
            'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
            'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
        ]);
        if (reservedNames.has(folderName.toUpperCase())) {
            folderName += '_';
        }
    }

    return folderName;
}

// 导出文件夹内容
function exportFolder (params, cancellationToken) {
    try {
        if (!params.folder) {
            return;
        }
        var folder = params.folder;
        var outputDir = params.savePath;
        var folderName = sanitize(sanitizeFolderName(folder.name));

        if (folderName.endsWith(".")) {
            folderName = folderName.slice(0, -1);
        }
        var folderDir = path.normalize(outputDir + "/" + folderName);
        var finishDir = params.finishDir || folderDir;

        if (!ACCESS.safeAccessSync(outputDir)) {
            ipcRenderer.send("close-export-task");
            ipcRenderer.send('electron-log', `[bg] Export folder fail, because path no permission[access]: ${outputDir}`);
            ACCESS.showReadOnlyDialog(outputDir);
            return;
        }

        if (!ACCESS.checkALCs(outputDir)) {
            ipcRenderer.send("close-export-task");
            ipcRenderer.send('electron-log', `[bg] Export folder fail, because path no permission[acl]: ${outputDir}`);
            ACCESS.showALCDialog(outputDir);
            return;
        }

        if (!fs.existsSync(folderDir)) {
            fs.mkdirSync(folderDir, 0755);
        }

        ipcRenderer.send('electron-info', `[bg] Export folder: ${folder.name}(${folder.id}) to computer: ${outputDir}, total: ${params.images.length} files`);

        var nameCount = {};
        var nameLength = {};

        params.images.forEach(function (image) {
            let imageName = `${image.name}.${image.ext}`;
            let lowercaseName = imageName.toLowerCase();
            if (nameLength[lowercaseName] === undefined) {
                nameLength[lowercaseName] = 1;
                nameCount[lowercaseName] = 0;
            }
            else {
                nameLength[lowercaseName] = nameLength[lowercaseName] + 1;
            }
        })

        var exportedCount = 0;
        var cbs = folder.images.map(function(image) {
            return function(callback) {
                try {

                    cancellationToken = cancellationToken || tokenSource.empty;
                    if (cancellationToken.isCancelled()) {
                        callback(null);
                        return;
                    }

                    // 被父文件夹包含的图片，不该输出
                    if (image.folders.indexOf(folder.id) === -1) {
                        callback(null);
                        return;
                    }

                    var dir = library.imagesDir + image.id + ".info/";
                    var imageName = `${image.name}.${image.ext}`;
                    var lowercaseName = imageName.toLowerCase();
                    var fileName = image.name + "." + image.ext;
                    var rawPath = path.normalize(dir + fileName);
                    var outputPath;

                    if (nameLength[lowercaseName] === 1) {
                        outputPath = path.normalize(folderDir + "/" + fileName);
                        nameCount[lowercaseName] = 1;
                    }
                    else {
                        nameCount[lowercaseName] = nameCount[lowercaseName] + 1;
                        var len = ('' + nameLength[lowercaseName]).length;
                        var countLabel = (1e4 + "" + nameCount[lowercaseName]).slice(-len);
                        outputPath = path.normalize(folderDir + "/" + image.name + "-" + countLabel + "." + image.ext);
                    }
                    safeCopy.async(rawPath, outputPath, { preserveTimestamps: true, overwrite: true }, function (err) {
                        if (err) {
                            ipcRenderer.send('electron-log', "" + err.stack || err);   
                        }
                        else {
                            exportedCount++;
                        }
                        ipcRenderer.send("finish-export-task", finishDir);
                        callback(null);
                    });
                }
                catch (err) {
                    ipcRenderer.send('electron-log', "" + err.stack || err);   
                    callback();
                    console.error(err);
                }
            }
        });

        async.parallelLimit(cbs, 24, function(err, result) {

            cancellationToken = cancellationToken || tokenSource.empty;
            if (cancellationToken.isCancelled()) {
                if (fs.existsSync(folderDir)) {
                    fse.removeSync(folderDir);
                }
                return;
            }

            ipcRenderer.send('electron-info', `[bg] Export folder: ${folderDir} finish, total: ${exportedCount} files`);

            if (folder.children && folder.children.length > 0) {
                folder.children.forEach(function (child, index) {
                    exportFolder({
                        images: child.images,
                        finishDir: finishDir,
                        folder: child,
                        savePath: folderDir,
                        showWhenFinish: false
                    }, cancellationToken);
                })
            }
        });
    }
    catch (err) {
        ipcRenderer.send('show-error-box', {
            title: i18n.__('Export Error'),
            message: i18n.__('  .')
        });
        ipcRenderer.send('electron-log', "[bg] Export folder error:");
        ipcRenderer.send('electron-log', "" + err.stack || err);
    }
}

// 导出文件夹内容
function exportImages (params) {
    try {
        if (!params.images) {
            return;
        }

        var outputDir = params.savePath;
        var outputPaths = [];

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, 0755);
        }

        ipcRenderer.send('electron-info', `[bg] Export files to computer: ${outputDir}, total: ${params.images.length} files`);
        if (!ACCESS.safeAccessSync(outputDir)) {
            ipcRenderer.send("close-export-task");
            ipcRenderer.send('electron-log', `[bg] Export images fail, because path no permission[access]: ${outputDir}`);
            ACCESS.showReadOnlyDialog(outputDir);
            return;
        }

        if (!ACCESS.checkALCs(outputDir)) {
            ipcRenderer.send("close-export-task");
            ipcRenderer.send('electron-log', `[bg] Export images fail, because path no permission[acl]: ${outputDir}`);
            ACCESS.showALCDialog(outputDir);
            return;
        }
        
        var nameCount = {};
        var nameLength = {};

        // 先载入该文件夹所有文件名称，避免导出时，发生文件覆盖的状况
        var existingFiles = fs.readdirSync(outputDir);
        existingFiles.forEach(function (fileName) {
            var imageName = fileName.replace(/-[0-9].*/, "");
            var lowercaseName = imageName.toLowerCase();
            if (nameLength[lowercaseName] === undefined) {
                nameLength[lowercaseName] = 1;
                nameCount[lowercaseName] = 1;
            }
            else {
                nameLength[lowercaseName] = nameLength[lowercaseName] + 1;
                nameCount[lowercaseName] = nameCount[lowercaseName] + 1;
            }
        })

        params.images.forEach(function (image) {
            var imageName = `${image.name}.${image.ext}`;
            var lowercaseName = imageName.toLowerCase();
            if (nameLength[lowercaseName] === undefined) {
                nameLength[lowercaseName] = 1;
                nameCount[lowercaseName] = 0;
            }
            else {
                nameLength[lowercaseName] = nameLength[lowercaseName] + 1;
            }
        })

        var cbs = params.images.map(function(image) {
            return function(callback) {
                try {

                    var dir = library.imagesDir + image.id + ".info/";
                    var imageName = `${image.name}.${image.ext}`;
                    var lowercaseName = imageName.toLowerCase();
                    var fileName = image.name + "." + image.ext;
                    var rawPath = path.normalize(dir + fileName);
                    var outputPath;

                    if (nameLength[lowercaseName] === 1) {
                        outputPath = path.normalize(outputDir + "/" + fileName);
                        nameCount[lowercaseName] = 1;
                        // if (fs.existsSync(outputPath)) {
                            // rawPath = path.normalize(dir + image.name + " copy." + image.ext);
                            // outputPath = path.normalize(outputDir + "/" + fileName);
                        // }
                    }
                    else {
                        nameCount[lowercaseName] = nameCount[lowercaseName] + 1;
                        var len = ('' + nameLength[lowercaseName]).length;
                        var countLabel = (1e4 + "" + nameCount[lowercaseName]).slice(-len);
                        outputPath = path.normalize(outputDir + "/" + image.name + "-" + countLabel + "." + image.ext);
                        if (fs.existsSync(outputPath)) {
                            outputPath = path.normalize(outputDir + "/" + image.name + "-" + countLabel + " copy." + image.ext);
                        }
                    }

                    safeCopy.async(rawPath, outputPath, { preserveTimestamps: true }, function (err) {
                        if (err) {
                            ipcRenderer.send('electron-log', "" + err.stack || err);   
                        }
                        else {
                            outputPaths.push(outputPath);
                        }
                        ipcRenderer.send("finish-export-task");
                        callback(null);
                    });

                }
                catch (err) {
                    callback();
                }
            }
        });

        async.parallelLimit(cbs, 24, function(err, result) {

            var finderMaxSelectSize = 500;
            var explorerMaxSelectSize = 1000;

            ipcRenderer.send('electron-info', `[bg] Export files finish, total: ${outputPaths.length} files`);

            if( process.platform === 'darwin' ) {
                if (outputPaths.length <= finderMaxSelectSize) {
                    revealFilesInFinder(outputPaths);
                }
                else {
                    ipcRenderer.send('show-item-in-folder', outputDir);
                }
            }
            else {
                if (outputPaths.length <= explorerMaxSelectSize) {
                    revealFilesInExplorer(outputPaths);
                }
                else {
                    ipcRenderer.send('show-item-in-folder', outputDir);
                }
            }
        });
    }
    catch (err) {
        ipcRenderer.send('show-error-box', {
            title: i18n.__('Export Error'),
            message: i18n.__('The export failed due to an unexpected error.')
        });
        ipcRenderer.send('electron-log', "[bg] Export files error: ");
        ipcRenderer.send('electron-log', "" + err.stack || err);
    }
}

// 導出 Eagle 內容
function exportEaglePackage (params, cancellationToken) {
    var archiver = require('archiver');                   // 135ms
    var savePath = params.savePath;
    var json = {
        images: []
    }
    var dirPath = path.dirname(savePath);
    if (!ACCESS.safeAccessSync(dirPath)) {
        ipcRenderer.send('electron-log', `[bg] Export eaglepack fail, because path no permission[access]: ${dirPath}`);
        ACCESS.showReadOnlyDialog(dirPath);
        return;
    }

    if (!ACCESS.checkALCs(dirPath)) {
        ipcRenderer.send('electron-log', `[bg] Export eaglepack fail, because path no permission[acl]: ${dirPath}`);
        ACCESS.showALCDialog(dirPath);
        return;
    }

    ipcRenderer.send("show-archive-task");
    ipcRenderer.send("add-archive-task");
    analytics.event('Eaglepack', 'Export');

    // 步骤一：重新制作 Folder 结构
    var imageIdMappings = {};

    // 导出文件夹
    if (params.folder) {

        // 创建与 folder 一模一样的结构，并存入 json.folder
        var folders = [];
        cloneTree(folders, [params.folder]);

        // 失败
        if (!folders[0]) {
            return;
        }

        json.folder = folders[0];
        ipcRenderer.send('electron-info', `[bg] Export folder: ${params.folder.name}(${params.folder.id}) as .eaglepack, total: ${params.folder.images.length} files, path: ${savePath}`);
        params.folder.images.forEach(function (img) {
            // Note: Windows & macOS 支持的字元不同，旧版本 eagle 可能会有图片名称 Windows 无法支持的，这会造成一些问题
            if (sanitize(img.name) !== img.name) {
                ipcRenderer.send('electron-log', `[bg] Contains characters that are not supported by the system: ${img.name}`);
                return;
            }
            if(!imageIdMappings[img.id] && !img.isDeleted) {
                var formated = removeUnusedProperities(img);
                json.images.push(formated);
            }
        });

        // 将所有图片添加至 json.images，需去除重复的
        eagle.utils.tree.walk(params.folder.children, 'children', function (folder) {
            if (!folder.images) return;
            folder.images.forEach(function (img) {
                // Note: Windows & macOS 支持的字元不同，旧版本 eagle 可能会有图片名称 Windows 无法支持的，这会造成一些问题
                if (sanitize(img.name) !== img.name) {
                    ipcRenderer.send('electron-log', `[bg] Contains characters that are not supported by the system: ${img.name}`);
                    return;
                }
                if(!imageIdMappings[img.id] && !img.isDeleted) {
                    var formated = removeUnusedProperities(img);
                    json.images.push(formated);
                }
            });
        });
    }
    // 导出多选的图片
    else {
        ipcRenderer.send('electron-info', `[bg] Export ${params.images.length} files as .eaglepack, path: ${savePath}`);
        params.images.forEach(function (img) {
            // Note: Windows & macOS 支持的字元不同，旧版本 eagle 可能会有图片名称 Windows 无法支持的，这会造成一些问题
            if (sanitize(img.name) !== img.name) {
                ipcRenderer.send('electron-log', `[bg] Contains characters that are not supported by the system: ${img.name}`);
                return;
            }
            // 支持导出垃圾桶的文件
            if (img.isDeleted) {
                var clone = Object.assign({}, img);
                var formated = removeUnusedProperities(clone);
                formated.folders = [];
                delete formated.isDeleted;
                json.images.push(formated);
            }
            else {
                var formated = removeUnusedProperities(img);
                formated.folders = [];
                json.images.push(formated);
            }
        });
    }

    json.images.sort(function(a, b) {
        ipcRenderer.send("add-archive-task");
        return b.modificationTime - a.modificationTime;
    });

    // 建立暫時使用資料夾
    var tempPath = path.dirname(savePath) + "/";
    var packageName = path.basename(savePath).replace(".eaglepack", "");
    var zipPath;
    zipPath = path.normalize(tempPath + packageName + ".eaglepack");

    var archive = archiver('zip', {
        store: true
        // zlib: { level: 1, chunkSize: 16 * 1024 * 4 } // Sets the compression level.
    });
    var isAbort = false;
    var output = fs.createWriteStream(zipPath);
    archive.pipe(output);

    // 加入 pack.json 文件
    archive.append(JSON.stringify(json), { name: 'pack.json' });

    // 将图片路径批量添加到压缩路径中
    var cbs = json.images.map(function(image) {
        return function(callback) {
            var hasCallback = false;
            var finalCallback = function () {
                if (!hasCallback) {
                    hasCallback = true;
                    if (process.platform === 'darwin') {
                        callback();
                    }
                    else {
                        setTimeout(callback, 1);   
                    }
                }
            };
            try {
                if (isAbort) {
                    return finalCallback();
                }
                var input = library.imagesDir + image.id + ".info";
                archive.directory(input, image.id + ".info");
                return finalCallback();
            }
            catch (err) {
                // console.log(err);
                ipcRenderer.send('electron-log', `[bg] Can not export file: ${image.id}`);
                ipcRenderer.send('electron-log', "" + err.stack || err);
                return finalCallback();
            }
        }
    });

    output.on('error', function(err) {
        if (fs.existsSync(zipPath)) fse.remove(zipPath);
        let message = err.message;
        if (message && message.indexOf && message.indexOf("ENOSPC") > -1) { message = i18n.__("Dialog.NoSpace.Title"); }
        isAbort = true;
        archive.abort();
        ipcRenderer.send('electron-log', `[eaglepack] Verify fail, The file is incomplete, and a prompt pops up to inform the user`);
        ipcRenderer.send('electron-log', `[eaglepack] Export fail, path: ${zipPath}`);
        ipcRenderer.send('show-swal', {
            title: i18n.__('Export Error'),
            button: i18n.__("general.ok"),
            description: message
        });
        ipcRenderer.send('electron-log', `[bg] Export .eaglepack error，path: ${zipPath}`);
        ipcRenderer.send('electron-log', "" + err.stack || err);
        ipcRenderer.send("abort-archive-task");
    });

    async.parallelLimit(cbs, 4, function(err, result) {

        cancellationToken = cancellationToken || tokenSource.empty;
        if (cancellationToken.isCancelled()) {
            if (fs.existsSync(zipPath)) fse.removeSync(zipPath);
            return;
        }

        console.log("开始压缩...");
        archive.finalize();

        archive.on('error', function(err) {
            if (fs.existsSync(zipPath)) fse.removeSync(zipPath);
            archive.abort();
            ipcRenderer.send('show-swal', {
                title: i18n.__('Export Error'),
                button: i18n.__("general.ok"),
                description: i18n.__('The export failed due to an unexpected error: ') + err.message
            });
            ipcRenderer.send('electron-log', `[bg] Export .eaglepack error，path: ${zipPath}`);
            ipcRenderer.send('electron-log', "" + err.stack || err);
            ipcRenderer.send("abort-archive-task");
        });

        archive.on('progress', throttle(function(progress) {

            cancellationToken = cancellationToken || tokenSource.empty;
            if (cancellationToken.isCancelled()) {
                if (fs.existsSync(zipPath)) fse.removeSync(zipPath);
                archive.abort();
                return;
            }

            var processed = progress.entries.processed;
            var total = progress.entries.total;
            var percent = (processed / total) * 100;
            if (percent < 100) {
                ipcRenderer.send("update-archive-percent", percent);
                console.log(percent);
            }
        }, 500));
        
        // listen for all archive data to be written
        output.on('close', function() {

            var totalSize = archive._pointer;

            ipcRenderer.send("update-archive-percent", 100);
            cancellationToken = cancellationToken || tokenSource.empty;

            if (cancellationToken.isCancelled()) {
                if (fs.existsSync(zipPath)) fse.removeSync(zipPath);
                return;
            }

            // fse.removeSync(resultPath);
            console.log("压缩完成");
            ipcRenderer.send('electron-info', `[bg] Export complete`);

            var actualSize = fs.statSync(zipPath).size;

            // 检查是否能解压缩
            ipcRenderer.send('electron-info', `[bg] Verify export results...`);
            checkEaglePack(zipPath, function (err) {
                if (!err) {
                    ipcRenderer.send('electron-info', `[bg] Verify finished, The file format is correct`);

                    // 检查文件尺寸
                    ipcRenderer.send('electron-info', `[bg] Verify eaglepack file size...`);

                    if (actualSize / totalSize < 0.8) {
                        ipcRenderer.send('show-swal', {
                            title: i18n.__('Export Error'),
                            button: i18n.__("general.ok"),
                            description: i18n.__('Export failed, please try again.')
                        });
                        ipcRenderer.send("abort-archive-task");
                        ipcRenderer.send('electron-log', `[bg] Verify fail, expected: ${totalSize}　actual: ${actualSize}`);
                        ipcRenderer.send('electron-log', `[bg] Export fail, path: ${zipPath}`);
                        fse.remove(zipPath);
                        return;
                    }
                    else {
                        ipcRenderer.send('electron-info', `[bg] Verify success, expected: ${totalSize}　actual: ${actualSize}`);
                        ipcRenderer.send('electron-info', `[bg] Export successfully, path: ${zipPath}`);
                    }

                    ipcRenderer.send("finish-archive-task");
                    ipcRenderer.send('show-item-in-folder', zipPath);

                    var message = i18n.__("Notification.Export.Success.Descript1") + json.images.length + i18n.__("Notification.Export.Success.Descript2");
                    if (json.images.length === 1) { message = message.replace("images", "image"); }
                    ipcRenderer.send('notification', {
                        progress: false,
                        title: i18n.__('Notification.Export.Success.Title'),
                        description: message,
                        duration: 1500
                    });
                }
                else {
                    ipcRenderer.send('electron-log', `[eaglepack] Verify fail, The file is damaged, and a prompt pops up to inform the user`);
                    ipcRenderer.send('electron-log', `[eaglepack] Export fail, path: ${zipPath}`);
                    ipcRenderer.send('show-swal', {
                        title: i18n.__('Export Error'),
                        button: i18n.__("general.ok"),
                        description: i18n.__('Export failed, please try again.')
                    });
                    ipcRenderer.send("abort-archive-task");
                    fse.remove(zipPath);
                    return;
                }
            });
        });
    });
};

function checkEaglePack (zipPath, callback) {
    try {
        var isZip = false;
        if (!zipPath) callback(true);
        var buffer = new Buffer(4);
        var fd = fs.openSync(zipPath, 'r');
        if(fd) {
            fs.readSync(fd, buffer, 0, 4, 0);
            if (buffer && buffer.length === 4) {
                isZip = (buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) && (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08));
            }
            fs.closeSync(fd);
        }
        if (isZip) { callback(); }
        else { callback(true); }
    }
    catch (err) {
        callback(true);
    }
}

// 导入其他资源库的内容
function importLibraryContent (libraryPath) {

    var metadataPath = libraryPath + "/metadata.json";
    var imagesPath = libraryPath + "/images/";

    if (!fs.existsSync(metadataPath)) { return; }

    ipcRenderer.send('electron-info', `[bg] Merge library: ${libraryPath}`);

    var data = fs.readFileSync(metadataPath, 'utf8');
    var newLibrary = JSON.parse(data);
    var folders = newLibrary.folders;
    var smartFolders = newLibrary.smartFolders;
    var imageFolders = fs.readdirSync(imagesPath);
    var images = [];

    var smartFolderChanged = false;
    smartFolders.forEach(function(smartFolder) {
        // 1.9.2 调整了 smartFolder 结构，这里做了自动转换的工作
        try {
            if (!smartFolder.conditions && smartFolder.set) {
                smartFolder.conditions = [
                    {
                        rules: smartFolder.rules,
                        match: (smartFolder.set === 'intersection')? 'AND':'OR'
                    }
                ];
                smartFolderChanged = true;
            }
        }
        catch (err) {
            ipcRenderer.send('electron-log', "" + err.stack || err);
        }
    });

    ipcRenderer.send("show-import-library-task", imageFolders.length);

    removeAllWatchers();

    var source = tokenSource();
    taskTokens.push(source);
    imageFolders.forEach(function (imagePath) {
        images.push({
            cancellationToken: source.token,
            folderName: imagePath
        });
    });

    ipcRenderer.send('electron-info', `[bg] ${images.length} new files will be imported`);

    // 复制图片
    var cbs = images.map(function(image, index) {
        return function(callback) {
            // 任務已經取消
            if (image.cancellationToken.isCancelled()) {
                // setTimeout(callback, 0);
                async.setImmediate(function() {
                    callback();
                });
                return;
            }

            if (image && image.folderName === ".DS_Store") {
                ipcRenderer.send("finish-import-library-task");
                // setTimeout(callback, 0);
                async.setImmediate(function() {
                    callback();
                });
                return;
            }
            else {
                // 复制图片到新路径
                if (!fs.existsSync(library.rootDir + "/images/" + image.folderName)) {
                    safeCopy.async(imagesPath + image.folderName, library.rootDir + "/images/" + image.folderName, {}, function (err) {
                        if (!err) {
                            ipcRenderer.send("finish-import-library-task");
                            ipcRenderer.send('background-state', undefined);
                            // setTimeout(callback, 0);        
                            async.setImmediate(function() {
                                callback();
                            });
                            return;
                        }
                        else {
                            ipcRenderer.send('electron-log', "" + err.stack || err);
                            ipcRenderer.send("finish-import-library-task");
                            // setTimeout(callback, 0);
                            async.setImmediate(function() {
                                callback();
                            });
                            return;
                        }
                    });
                }
                else {
                //     // setTimeout(callback, 0);
                    async.setImmediate(function() {
                        callback();
                    });
                    return;
                }
            }
        }
    });

    // async.parallelLimit 比 each 還來的快非常多
    async.parallelLimit(cbs, 12, function(err, result) {
        needUpdateCache = true;     // 此次关闭软件，必须刷新缓存
        ipcRenderer.send("close-import-library");
        ipcRenderer.send('electron-info', `[bg] Library merge successfully: ${libraryPath}`);
        if (imagesWatcher) {
            ipcRenderer.send('electron-info', `[bg] Resume file watcher`);
            try { imagesWatcher.start(); }
            catch (err) {}
        }
    });

    analytics.event('Library', 'Import');
}

// 導入 Eagle 圖片
// folderId: 将要导入的 FolderId（拖曳才支持，预设导入到 all）
var importingEaglePackage = false;
function importEaglePackage (packPath, folderId, cancellationToken) {

    if (importingEaglePackage) return;
    importingEaglePackage = true;

    try {
        let extract;
        const nativeExtract = require(appRoot + '/my_modules/native-extract-zip');
        if (process.platform === 'darwin') {
            if (nativeExtract.available()) {
                ipcRenderer.send('electron-info', `[bg] Using native extraction method`);
                extract = nativeExtract;
            } else {
                ipcRenderer.send('electron-info', `[bg] Native extraction not available, falling back to extract-zip`);
                extract = require('extract-zip');
            }
        }
        else {
            extract = require('extract-zip');
        }

        ipcRenderer.send('electron-info', `[bg] Loading .eaglepack: ${packPath}`);

        try {
            fs.accessSync(packPath, fs.W_OK)
        }
        catch (err) {
            ipcRenderer.send('electron-log', `[bg] No permission to access this .eaglepack file`);
            try {
                ipcRenderer.send('electron-log', `[bg] Try to request permission...`);
                fse.chmodSync(packPath, 0755);
                ipcRenderer.send('electron-log', `[bg] Request permission successfully`);
            }
            catch (err) {
                ipcRenderer.send('electron-log', "[bg] Request permission fail");
                ipcRenderer.send('electron-log', "" + err.stack || err);
            }
        }

        try {
            var eaglepackStat = fs.statSync(packPath);
            ipcRenderer.send('electron-info', `[bg] .eaglepack size：${eaglepackStat.size}`);
            ipcRenderer.send('electron-info', `[bg] .eaglepack mode：${eaglepackStat.mode}`);
        }
        catch (err) {
            ipcRenderer.send('electron-log', `[bg] fs.stat error`);
            ipcRenderer.send('electron-log', "" + err.stack || err);
            return;
        }

        var extractFolder = `${libraryDir}/extract/`;
        if (!fs.existsSync(extractFolder)) {
            fs.mkdirSync(extractFolder, 0755);
        }

        var extractPath = `${libraryDir}/extract/${guid()}/`;
        if (fs.existsSync(extractPath)) {
            fse.removeSync(extractPath);
        }

        needUpdateCache = true;     // 此次关闭软件，必须刷新缓存

        var total;
        var count = 0;
        ipcRenderer.send("show-extract-task");
        ipcRenderer.send('electron-info', `[bg] Extract .eaglepack file ...`);
        analytics.event('Eaglepack', 'Import');
        var extractPack = extract(packPath, {
            resourcesPath: RESOURCES_PATH, dir: extractPath, onEntry: function (entry, zipfile) {
            if (!total) {
                total = zipfile.entryCount;
                for (var i = 0; i < total; i++) {
                    ipcRenderer.send("add-extract-task");
                }
            }
            count++;
            ipcRenderer.send('finish-extract-task', {});
            console.log("目前进度 %d/%d...", count, total);
        }}, function (err) {

            if (err || !fs.existsSync(extractPath)) {
                ipcRenderer.send('electron-log', `[bg] Extract .eaglepack fail`);
                ipcRenderer.send('electron-log', "" + err.stack || err);
                ipcRenderer.send('cancel-extract-task', {});
                // 中断解压缩，并告诉用户发生错误
                ipcRenderer.send('show-swal', {
                    title: i18n.__('Dialog.Import.Eaglepack.Error.Title'),
                    button: i18n.__("general.ok"),
                    description: i18n.__('Dialog.Import.Eaglepack.Error.Message')
                });
                importingEaglePackage = false;
                return;
            }
            else {
                ipcRenderer.send('electron-info', `[bg] Extract .eaglepack successfully: ${extractPath}`);
            }

            cancellationToken = cancellationToken || tokenSource.empty;
            if (cancellationToken.isCancelled()) { fse.removeSync(extractPath); importingEaglePackage = false; return; }

            if (!fs.existsSync(extractPath + '/pack.json')) {
                ipcRenderer.send('electron-log', `[bg] Extract .eaglepack fail, "pack.json" does not exist`);
                console.log("找不到 pack.json");
                importingEaglePackage = false;
                return;
            }

            var package = require(extractPath + '/pack.json');
            var originalImages = package.images.reverse();
            var folder = package.folder;
            var coverImage;
            var imageIdMap = {};
            var newIdMap = {};

            // Note: 将要导入的图片发到前台，检查是否有重复物件，duplicatesItemsMap 会将重复的 id 标记出来
            ipcRenderer.sendTo(mainWindowID, 'get-duplicate-map', originalImages);
            ipcRenderer.once('get-duplicate-map-done', async function (event, duplicatesItemsMap) {

                var images = [];

                if (!duplicatesItemsMap) {
                    images = originalImages;
                }
                else {
                    originalImages.forEach(function (image) {
                        if (!duplicatesItemsMap[image.id]) {
                            images.push(image);
                        }
                    });
                }

                // if (images.length === 0) {
                //     ipcRenderer.send('electron-info', `[bg] stop import, because total: 0 files`);
                //     fse.remove(extractPath);
                //     return;
                // }

                ipcRenderer.send('electron-info', `[bg] total: ${images.length} files`);

                images.forEach(function (image) {
                    let newId = guid();
                    newIdMap[image.id] = newId;
                    imageIdMap[newId] = image.id;
                });

                // 如果导入的包是文件夹包，建立新的文件夹结构，主要是更换 id
                var folderIdMappings = {};
                if (folder) {

                    // 替換資料夾 id
                    var oldFolderId = folder.id;
                    
                    folderIdMappings[folder.id] = guid();
                    folder.id = folderIdMappings[folder.id];
                    folder.isExpand = true;

                    if (folder.coverId) {
                        folder.coverId = newIdMap[folder.coverId];
                    }

                    if (folder.children) {
                        eagle.utils.tree.walk(folder.children, 'children', function (child) {
                            folderIdMappings[child.id] = guid();
                            child.id = folderIdMappings[child.id];
                            child.isExpand = true;
                            if (child.coverId) {
                                child.coverId = newIdMap[child.coverId];
                            }
                        });
                    }

                    // 确保排序正确（如果使用者原先使用自定义排序）
                    images = images.sort(function(a, b) {
                        var aTime = _.get(a, `order[${oldFolderId}]`, a.modificationTime);
                        var bTime = _.get(b, `order[${oldFolderId}]`, b.modificationTime);
                        if(aTime > bTime) return 1;
                        if(aTime < bTime) return -1;
                        return 0;
                    });

                    // 替換圖片資料夾 id
                    images.forEach(function (image) {
                        var folders = [];
                        if (image.folders) {
                            image.folders.forEach(function (fid) {
                                folders.push(folderIdMappings[fid]);
                            });
                        }
                        image.folders = folders;
                    });
                    ipcRenderer.send('new-folders-end', [folder]);
                }
                else if (folderId) {
                    images.forEach(function (image) {
                        image.folders = [folderId];
                    });
                }

                images.forEach(function (image) {
                    ipcRenderer.send("add-download-task-end");
                });

                // 所有的內容一律當作新的內容來導入
                images.forEach(function (image, index) {

                    try {
                        cancellationToken = cancellationToken || tokenSource.empty;
                        if (cancellationToken.isCancelled()) { fse.removeSync(extractPath); return; }

                        var newId = newIdMap[image.id];
                        var input = extractPath + "/" + image.id + ".info";
                        var renamedPath = extractPath + "/" + newId + ".info";
                        var output = library.imagesDir + "/" + newId + ".info";

                        // 重寫 metadata.json 與資料夾名稱
                        image.id = newId;
                        image.modificationTime = Date.now() + index;

                        var json = JSON.stringify(image);

                        if (fs.existsSync(input)) {
                            fse.moveSync(input, renamedPath, { overwrite: true });
                            fs.writeFileSync(path.normalize(renamedPath + "/metadata.json"), json);
                            fse.moveSync(renamedPath, output, { overwrite: true });
                        }

                        ipcRenderer.send('file-uploaded-end', {});

                        // 添加到画面更新
                        var currentJSON = library.imagesMapping[image.id];
                        if (!currentJSON) {
                            console.log("【Eaglepack 导入】 : 新的檔案添加，路徑為", output);
                            library.imagesMapping[image.id] = json;
                            lastModifiedTimeMappings[image.id] = image.lastModified;
                            if (image.id) {
                                ipcRenderer.send('image.added', image);
                            }
                        }
                    }
                    catch (err) {
                        ipcRenderer.send('electron-log', "" + err.stack || err);
                    }
                });

                // 開啟對應的資料夾
                if (folder && !folderId) {
                    ipcRenderer.send('go-folder', folder.id);
                }

                fse.remove(extractPath);
                importingEaglePackage = false;
            });
        });
    }
    catch (err) {
        importingEaglePackage = false;
        ipcRenderer.send('electron-log', "" + err.stack || err);
    }
}

// 匯入 Inboard 內容
function importInboardApp (backupPath) {

    ipcRenderer.send('electron-info', `Load Inboard Library: ${backupPath}`);

    if (!fs.existsSync(backupPath + '/InboardBackup.json')) {
        console.log("找不到備份資料");
        return;
    }

    var inboard = require(backupPath + '/InboardBackup.json');
    var paths = [];
    var images = [];
    var folders = [];
    var foldersMappings = {};

    inboard.folders.forEach(function (f, index) {
        var folder = {
            id: guid(),
            name: f.title,
            modificationTime: Date.now() + index,
            imagesMappings: {},
            tags: [],
            images: [],
            children: [],
            isExpand: true,
        };
        foldersMappings[f.title] = folder;
        folders.push(folder);
    });

    inboard.items.forEach(function (item) {
        if (item.type !== 'image') return;
        var id = guid();
        var image = {
            id: id,
            name: item.title,
            folders: [],
            tags: item.tags,
            url: item.url,
            isDeleted: item.isTrashed !== 0,
            modificationTime: new Date(item.date).getTime(),
        };
        item.folders.forEach(function (f) {
            if (foldersMappings[f]) {
                image.folders.push(foldersMappings[f].id);
            }
        });
        var idx = item.path.lastIndexOf("/");

        var path;
        // Inboard 圖片有兩種模式，一種放在 /images 一種放在 /screenshots
        if (item.path.indexOf("\/screenshots\/") !== -1) {
            path = backupPath + "/screenshots" + item.path.substring(idx);
        }
        else {
            path = backupPath + "/images" + item.path.substring(idx);
        }

        if (fs.existsSync(path)) {
            image.path = path;
            images.push(image);
            paths.push(path);
            ipcRenderer.send("add-download-task-end");
        }
    });

    ipcRenderer.send('new-folders-end', folders);

    images.forEach(function (image) {
        addToProcessQueue(image);
    });

    analytics.event('Inboard', 'Import');
}

function checkForUpdates (params) {

    var machineID = params.machineID;
    var showAlredy = params.showAlredy;

    // 如果用户上次点击暂时不提示按钮的的时间 > 6 小时，并且检查并非用户主动发起，就不需要执行检查更新代码
    var lastCheckForUpdateTime = localStorage["lastCheckForUpdateTime"] || undefined;
    var now = Date.now();
    var SIX_HOUR = 1000 * 60 * 60 * 6;
    if (!showAlredy && lastCheckForUpdateTime) {
        lastCheckForUpdateTime = parseInt(lastCheckForUpdateTime);
        if (now - lastCheckForUpdateTime < SIX_HOUR) {
            console.log("6小时内暂时不检查更新");
            return;
        }
    }

    var version = appVersion;
    var serverURL = `https://cn.eagle.cool/check-for-update`;
    const getJSON = require('get-json');                    // 240ms
    getJSON(serverURL, function (err, result) {
        if (err || !result) {
            console.log(result);
            console.log(err);
            ipcRenderer.send('electron-log', "[bg] Can not access: " + serverURL);
            serverURL = `https://en.eagle.cool/check-for-update`;
            getJSON(serverURL, function (err, result) {
                if (err || !result) {
                    ipcRenderer.send('electron-log', "[bg] Can not access: " + serverURL);
                    if (showAlredy) {
                        ipcRenderer.send('show-error-box', {
                            title: 'No Internet connection',
                            message: 'Your computer is currently offline. Please check your network settings.'
                        });
                    }
                    return;
                }
                else {
                    showCheckForUpdateResult(showAlredy, result);
                }
            });
        }
        else {
            showCheckForUpdateResult(showAlredy, result);
        }
    });
    
};

function showCheckForUpdateResult (showAlredy, result) {
    if (result && require('compare-versions')(appVersion, result.version) == -1) {
        console.log("【更新檢查】 : 發現新版本" + result.version);
        ipcRenderer.send('show-update-message', result);
    }
    else {

        const buildVersion = result.buildVersion;
        const buildNumber = result.buildNumber;

        console.log(result);

        // 只在用戶主動檢查更新時顯示小版本更新提示（需要 result.buildVersion 存在）
        if (showAlredy && buildVersion && parseInt(pjson.buildVersion) < parseInt(buildVersion)) {
            ipcRenderer.send('show-minor-update-message', {
                newBuildNumber: buildNumber,
                newBuildVersion: buildVersion,
                currentBuildNumber: pjson.buildNumber,
                currentBuildVersion: pjson.buildVersion
            });
            return;
        }

        console.log("【更新檢查】 : 沒有新版本");
        if (showAlredy) {
            ipcRenderer.send('show-swal', {
                title: i18n.__("dialog.checkUpdate.title"),
                button: i18n.__("dialog.checkUpdate.ok"),
                description: `Eagle ${(prereleaseVersion || appVersion)} Build${pjson.buildNumber} (${pjson.buildVersion})${i18n.__("dialog.checkUpdate.newestVersion")}`
            });
        }
    }
}

// ------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------
// 圖片處理住列
// ------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------
// ------------------------------------------------------------------------------------------------------------------------------------
var writeLibraryQueue;
var processQueue;
var imagePaletteQueue;
var imageMatadataQueue;
var regerateThumbnailQueue;
var gerateHightResolutionThumbnailQueue;
var webpConvertQueue;
var activateFontQueue;
var deactivateFontQueue;
var trashQueue;
var imageWatchUpdateQueue;

function initAllQueue () {

    function writeLibraryQueueCallback (task, callback) {
        console.log("正在储存资源库");
        try {
            var params = task.params;
            var folders = params.folders;
            var smartFolders = params.smartFolders;
            var quickAccess = params.quickAccess;
            var tagsGroups = params.tagsGroups;
            var libraryPath = params.libraryDir;
            var metadataPath = path.normalize(`${params.libraryDir}/metadata.json`);

            if (!folders) {
                return callback('储存操作有问题，储存资源库居然是空的 folders');
            }

            if (!ACCESS.safeAccessSync(metadataPath)) {
                ipcRenderer.send("close-export-task");
                ipcRenderer.send('electron-log', `[bg] Save library metadata.json fail, because path no permission[access]: ${metadataPath}`);
                refreshMetadata(metadataPath, true);
                ACCESS.showReadOnlyDialog(metadataPath);
                return callback();
            }

            if (!ACCESS.checkALCs(path.dirname(metadataPath))) {
                ipcRenderer.send("close-export-task");
                ipcRenderer.send('electron-log', `[bg] Save library metadata.json fail, because path no permission[acl]: ${metadataPath}`);
                refreshMetadata(metadataPath, true);
                ACCESS.showALCDialog(metadataPath);
                return callback();
            }

            try {
                // var oldLibrary = loadLibrary(path.normalize(params.libraryDir + "/metadata.json"));
                var oldLibraryData = fs.readFileSync(path.normalize(metadataPath), 'utf8');
                var oldLibrary = JSON.parse(oldLibraryData);
                var modificationTime = oldLibrary.modificationTime;

                if (oldLibrary.applicationVersion && require('compare-versions')(appVersion, oldLibrary.applicationVersion) == -1) {
                    ipcRenderer.send('show-error-box', {
                        title: i18n.__('dialog.libraryLowerVersion.title'),
                        message: i18n.__('dialog.libraryLowerVersion.desc'),
                    });
                    checkForUpdates({});
                    return callback('用户尚未更新版本');
                }

                // TODO: 盡可能必面這件事情
                else if (modificationTime > library.modificationTime) {
                    ipcRenderer.send('show-error-box', {
                        title: i18n.__('dialog.syncConflict.title'),
                        message: i18n.__("dialog.syncConflict.desc")
                    });
                    initLibrary();
                    return callback('资源库冲突');
                }
                else {

                    eagle.utils.tree.walk(folders, 'children', function (folder) {
                        if (folder) {
                            delete folder.covers;
                            delete folder.images;
                            delete folder.folders;
                            delete folder.newFolderName;
                            delete folder.editable;
                            delete folder.pinyin;
                            delete folder.__root;
                            delete folder.extendTags;
                            delete folder["$$hashKey"];
                        }
                    });

                    eagle.utils.tree.walk(smartFolders, 'children', function (smartFolder, parent, depth) {
                        delete smartFolder.newFolderName;
                        delete smartFolder.editable;
                        delete smartFolder["$$hashKey"];
                    });

                    var newLibrary = {
                        folders: folders,
                        smartFolders: smartFolders,
                        quickAccess: quickAccess,
                        tagsGroups: tagsGroups,
                        modificationTime: Date.now(),
                        applicationVersion: appVersion
                    };

                    var json = JSON.stringify(newLibrary);

                    try {
                        JSON.parse(json);
                    }
                    catch (err) {
                        ipcRenderer.send('electron-log', "[bg] JSON.stringify metadata.json error");
                        ipcRenderer.send('electron-log', "" + err.stack || err);
                        json = JSON.stringify(newLibrary);
                    }

                    // NOTE: 避免被同步工具锁上或同步
                    // var tempDir = `${library.metadataPath}.${Date.now()}`;
                    var tempDir = metadataPath.replace("metadata.json", "~$metadata.json.tmp");

                    try {
                        fs.writeFileSync(tempDir, json);
                    }
                    catch (err) {}

                    // if (safeAccessSync(library.metadataPath)) {
                    var outstream = fs.createWriteStream(metadataPath, {
                        'flags': 'w'
                    });
                    outstream.write(json);
                    outstream.on('finish', function() {
                        library.modificationTime = newLibrary.modificationTime;
                        var _jsonBytes = Buffer.byteLength(json, 'utf8');
                        var _jsonSizeStr = _jsonBytes >= 1048576 ? (_jsonBytes / 1048576).toFixed(2) + ' MB' : (_jsonBytes / 1024).toFixed(2) + ' KB';
                        ipcRenderer.send('electron-info', `[bg] metadata.json updated successfully: ${metadataPath} (${_jsonSizeStr})`);
                        console.log("除存成功");
                        fse.remove(tempDir);
                        return callback();
                    });
                    outstream.on('error', function(err) {
                        ipcRenderer.send('electron-log', "[bg] Save metadata.json error, retry with renameSync...");
                        ipcRenderer.send('electron-log', "" + err.stack || err);    
                        try {
                            fs.writeFileSync(metadataPath, json);
                        }
                        catch (err) {
                            ipcRenderer.send('electron-log', "[bg] Save metadata.json error...");
                            ipcRenderer.send('electron-log', "" + err.stack || err);
                        }
                        return callback();
                    });
                    outstream.end();
                    // }
                    // else {
                    //     fse.remove(tempDir);
                    //     ipcRenderer.send('electron-log', `[bg] metadata.json updated fail, No write permission: ${library.metadataPath}`);
                    //     return callback();
                    // }
                }
            }
            catch (err) {
                ipcRenderer.send('electron-log', `[bg] metadata.json updated fail：${metadataPath}`);
                ipcRenderer.send('electron-log', "" + err.stack || err);
                return callback(err);
            }
        }
        catch (err) {
            ipcRenderer.send('electron-log', `[bg] metadata.json updated fail2：${metadataPath}`);
            ipcRenderer.send('electron-log', "" + err.stack || err);
            return callback(err);
        }
    };

    writeLibraryQueue = async.queue(async.timeout(writeLibraryQueueCallback, 40000), 1);

    function metadataQueueCallback (task, callback) {
        var hasCallback = false;
        
        try {
            var startTime = Date.now();
            var type  = task.type;
            var shift = task.shift;
            var image = metadataQueueImagesMapping[task.image.id];
            delete metadataQueueImagesMapping[image.id];

            var returnCallback = function (param1, param2) {

                if (!param1) {
                    ipcRenderer.send('file-save-success', image);
                }
                else {
                    ipcRenderer.send('file-save-fail', image);
                }

                try {
                    needUpdateCache = true;     // 此次关闭软件，必须刷新缓存

                    if (!hasCallback) {
                        hasCallback = true;
                        if (!param2) {
                            callback(param1);
                        }
                        else {
                            callback(param1, param2);
                        }
                    }
                }
                catch (err) {
                    ipcRenderer.send('electron-log', "" + err.stack || err);
                }
            }

            // 啟動計時器 超過 20s 仍沒有處理成功就當作失敗
            var timer = setTimeout(function () {
                return returnCallback({ err: true, msg: "File processing timeout" });
            }, 20000);

            if (forceQuit) {
                setTimeout(returnCallback, 1);
                clearTimeout(timer);
                return;
            }

            // 儲存前進行正規劃處理
            normalizeProperities(image);

            var dir = library.imagesDir + image.id + ".info/";
                if (!image.name || image.name == '') {
                    image.name = image.id;
                }

                // 使用者更改了檔案名稱
                if (image.oldName && image.newName && image.oldName != image.newName) {

                    var oldName = decodeURIComponent(image.oldName);
                    var newName = decodeURIComponent(image.newName);

                    var outputDir = path.normalize(dir + "metadata.json");
                    var tempDir = `${EAGLE_THUMBNAIL_TEMP_PATH}/${image.id}.json.${Date.now()}`;
                    var newRawPath = dir + newName + "." + image.ext;
                    var originRawPath = dir + image.oldName + "." + image.ext;

                    if (!fs.existsSync(EAGLE_THUMBNAIL_TEMP_PATH)) {
                        fs.mkdirSync(EAGLE_THUMBNAIL_TEMP_PATH);
                    }

                    // 先检查 metadata.json 及 原文件是可以读写的，如果无法读写，跳出错误并恢复前端 UI 文件名称
                    if (type === "modified") {
                        try {
                            if (fs.existsSync(outputDir)) {
                                fs.accessSync(outputDir, fs.W_OK);
                            }
                            if (fs.existsSync(originRawPath)) {
                                fs.accessSync(originRawPath, fs.W_OK);
                            }
                        }
                        catch (err) {
                            ipcRenderer.send('electron-log', `[bg] Rename file fail: ${originRawPath}, oldName: ${image.oldName}, newName: ${newName}`);
                            ipcRenderer.send('electron-log', "" + err.stack || err);
                            ipcRenderer.send('image-processing-error', {
                                type: "EDIT_ERROR",
                                modifiedData: image,
                                reason: i18n.__("error.usedByAnotherProgram"),
                                object: {
                                    name: image.name,
                                    path: originRawPath,
                                }
                            });
                            image.name = image.oldName;
                            ipcRenderer.send("image.changed", image);
                            setTimeout(returnCallback, 1);
                            clearTimeout(timer);
                            return;
                        }
                    }

                    removeUnusedProperities(image);

                    try {
                        image.lastModified = Date.now();
                        lastModifiedTimeMappings[image.id] = image.lastModified;
                        var json = JSON.stringify(image);
                        var originJSON = library.imagesMapping[image.id];

                        // 避免存入損壞的字串的東西
                        if (json && typeof JSON.parse(json) == 'object') {
                            fs.writeFileSync(tempDir, json);
                            
                            try {

                                // 如果新文件已经存在，不需要搬移
                                if (!fs.existsSync(newRawPath)) {
                                    fse.moveSync(originRawPath, newRawPath, { overwrite: true });
                                    if (image.ext === "txt" || image.ext === "svg" || image.noThumbnail) {
                                        
                                    }
                                    else {
                                        // Note: 縮圖移動失敗不該影響整個流程
                                        try {
                                            let oldThumbnailPath = `${dir}${oldName}_thumbnail.png`;
                                            let newThumbnailPath = `${dir}${newName}_thumbnail.png`
                                            if (fs.existsSync(oldThumbnailPath)) {
                                                fse.moveSync(oldThumbnailPath, newThumbnailPath, { overwrite: true });
                                            }
                                        }
                                        catch (err) {
                                            ipcRenderer.send('electron-log', "Can not rename thumbnail");
                                            ipcRenderer.send('electron-log', "" + err.stack || err);
                                        }
                                    }
                                }
                                
                                // 延后写入的操作，等到文件名称修改无误，再进行操作
                                if (fs.existsSync(tempDir)) {

                                    var outstream = fs.createWriteStream(outputDir, {'flags': 'w'});
                                    outstream.write(json);
                                    outstream.on('finish', function () {
                                        fs.unlink(tempDir, function () {});
                                        setTimeout(returnCallback, 1);
                                        clearTimeout(timer);
                                        imageWatchUpdateQueue.push({
                                            eventName: 'image.changed',
                                            image: image,
                                            json: library.imagesMapping[image.id]
                                        });
                                    });
                                    outstream.on('error', function (err) {
                                        library.imagesMapping[image.id] = originJSON;
                                        fse.moveSync(tempDir, outputDir, { overwrite: true });
                                        ipcRenderer.send('electron-log', "" + err.stack || err);
                                        setTimeout(returnCallback, 1);
                                        clearTimeout(timer);
                                        imageWatchUpdateQueue.push({
                                            eventName: 'image.changed',
                                            image: image,
                                            json: library.imagesMapping[image.id]
                                        });
                                    });
                                    outstream.end();
                                }
                                else {
                                    setTimeout(returnCallback, 1);
                                    clearTimeout(timer);
                                    return;
                                }
								library.imagesMapping[image.id] = json;
                                // setTimeout(callback, 1);
                            }
                            catch (err) {
                                fse.remove(tempDir);
                                library.imagesMapping[image.id] = originJSON;
                                ipcRenderer.send('electron-log', "" + err.stack || err);
                                setTimeout(returnCallback, 1);
                                clearTimeout(timer);
                            }
                        }
                        else {
                            setTimeout(returnCallback, 1);
                            clearTimeout(timer);
                        }
                    }
                    catch (err) {
                        library.imagesMapping[image.id] = originJSON;
                        ipcRenderer.send('electron-log', "" + err.stack || err);
                        setTimeout(function () {
                            returnCallback(err);
                            clearTimeout(timer);
                        }, 1);
                        fse.remove(tempDir);
                    }
                }
                else {

                    var outputDir = path.normalize(dir + "metadata.json");

                    removeUnusedProperities(image);

                    try {
                        var now = Date.now();
                        image.lastModified = now;
                        lastModifiedTimeMappings[image.id] = image.lastModified;
                        var json = JSON.stringify(image);
                        var originJSON = library.imagesMapping[image.id];
                        var tempDir = `${EAGLE_THUMBNAIL_TEMP_PATH}/${image.id}.json.${now}`;

                        // 避免存入損壞的字串的東西
                        if (json.length > 0 && typeof JSON.parse(json) == 'object') {
                            library.imagesMapping[image.id] = json;
                            var outstream = fs.createWriteStream(outputDir, {'flags': 'w'});
                            outstream.write(json);
                            outstream.on('finish', function () {
                                clearTimeout(timer);
                                returnCallback();
                            });
                            outstream.on('error', function (err) {

                                // 先检查 metadata.json 及 原文件是可以读写的，如果无法读写，跳出错误并恢复前端 UI 文件名称
                                if (type === "modified") {
                                    try {
                                        fs.accessSync(outputDir, fs.W_OK);
                                    }
                                    catch (err) {
                                        if (!fs.existsSync(dir)) {
                                            clearTimeout(timer);
                                            returnCallback();
                                            return;
                                        }
                                        if (err.code !== "ENOENT") {
                                            ipcRenderer.send('electron-log', `[bg] Save metadata fail: ${outputDir}`);
                                            ipcRenderer.send('electron-log', "" + err.stack || err);
                                            ipcRenderer.send('image-processing-error', {
                                                type: "EDIT_ERROR",
                                                reason: i18n.__("error.usedByAnotherProgram"),
                                                modifiedData: image,
                                                object: {
                                                    name: image.name,
                                                    path: outputDir,
                                                }
                                            });
                                            var originImage;
                                            if (library.imagesMapping[image.id]) {
                                                try {
                                                    originImage = JSON.parse(library.imagesMapping[image.id]);
                                                }
                                                catch (err) {
                                                    originImage = image;
                                                }
                                            }
                                            ipcRenderer.send("image.changed", originImage);
                                            setTimeout(returnCallback, 1);
                                            clearTimeout(timer);
                                            return;
                                        }
                                    }
                                }
                                try {
                                    fs.writeFileSync(outputDir, json, "utf8");
                                }
                                catch (err) {
                                    // TODO: 提示錯誤
                                    ipcRenderer.send('electron-log', "[bg] Can't update file metadata.json file, because: " + err.stack || err);
                                    library.imagesMapping[image.id] = originJSON;
                                    ipcRenderer.send("image.changed", JSON.parse(library.imagesMapping[image.id]));
                                    ipcRenderer.send('image-processing-error', {
                                        type: "EDIT_ERROR",
                                        modifiedData: image,
                                        reason: i18n.__("error.usedByAnotherProgram"),
                                        object: {
                                            name: image.name,
                                            path: outputDir,
                                        }
                                    });
                                }
                                clearTimeout(timer);
                                returnCallback(err);
                                ipcRenderer.send('electron-log', "" + err.stack || err);
                            });
                            outstream.end();
                        }
                        else {
                            console.log("JSON 格式錯誤");
                            clearTimeout(timer);
                            returnCallback();
                        }
                    }
                    catch (err) {
                        if (!fs.existsSync(outputDir)) {
                            try {
                                fs.writeFileSync(outputDir, json, "utf8");
                            }
                            catch (err) {}
                        }
                        console.log(err);
                        if (library.imagesMapping[image.id]) {
                            library.imagesMapping[image.id] = originJSON;
                        }
                        ipcRenderer.send('electron-log', "" + err.stack || err);
                        clearTimeout(timer);
                        returnCallback(err);
                    }
                }

                // NOTE: 为了解决电脑直接关机缓存没有正常更新的状况，这里添加了增量缓存的功能，如果使用者采用非预期的方式关闭软件，也不会导致软件损毁
                // 目前已经有 drain 的方案，应该不需要在用这个，这个有很高的机率出现 Error: EMFILE: too many open files, open 问题
                // if (!shift) {
                    // appendImageToLibraryCache(image);
                // }
            // }
            // else {
                // clearTimeout(timer);
                // returnCallback();
            // }
        }
        catch (err) {
            ipcRenderer.send('metadataQueueCallback 发生错误');
            ipcRenderer.send('electron-log', "" + err.msg);
            clearTimeout(timer);
            returnCallback();
        }
    };

    imageMatadataQueue = async.queue(async.timeout(metadataQueueCallback, 30000), 8);
    imagePaletteQueue = async.queue(async.timeout(function(task, callback) {
        // NOTE: 應該共用 queue 避免 steam 同時寫入檔案造成 JSON 格式錯誤
        imageMatadataQueue.push(task, callback);
    }, 30000), 1);

    imageMatadataQueue.drain = function () {
        clearTimeout(_drainSaveMtimeFileTimeout);
        _drainSaveMtimeFileTimeout = setTimeout(function () {
            if (imageMatadataQueue.length() === 0) {
                updateMTimeLogsWithTimeoutByMeta();
            }
        }, 2000);
        // NOTE: 用户在修改任意文件20秒后，强制更新缓存，如果20秒内还有其他修改，则取消本次修改任务
        // 这样做可以有效避免软件缓存与实际文件不同步的问题，特别是 Windows 直接关机造成缓存没办法跟上问题
        clearTimeout(_drainSaveCacheFileTimeout);
        _drainSaveCacheFileTimeout = setTimeout(function () {
            if (imageMatadataQueue.length() === 0) {
                ipcRenderer.send('electron-info', `[bg] auto-save start`);
                saveCacheFile(function () {});
            }
        }, 12000);
    };

    imagePaletteQueue.drain = function () {
        clearTimeout(_drainSaveMtimeFileTimeout);
        _drainSaveMtimeFileTimeout = setTimeout(function () {
            if (ColorAnalyzer.queue.length() === 0) {
                updateMTimeLogsWithTimeoutByPalette();
            }
        }, 2000);
    };

    regerateThumbnailQueue = async.queue(async.timeout(generateThumbnailQueueCallback, 60000), 4);
    regerateThumbnailQueue.drain = function () {
        ColorAnalyzer.resume();
    };

    gerateHightResolutionThumbnailQueue = async.queue(async.timeout(gerateHightResolutionThumbnailQueueCallback, 60000), 2);

    webpConvertQueue = async.queue(async.timeout(webpConvertQueueCallback, 60000), 10);

    activateFontQueue = async.queue(async.timeout(activateFontQueueCallback, 60000), 5);

    deactivateFontQueue = async.queue(async.timeout(deactivateFontQueueCallback, 60000), 5);

    trashQueue = async.queue(async.timeout(trashQueueCallback, 60000), 20);

    imageWatchUpdateQueue = async.queue(async.timeout(imageWatchUpdateQueueCallback, 20000), 20);

    function imageWatchUpdateQueueCallback (task, callback) {

        try {
            var id = task.id;
            var image = task.image;
            var json = task.json;
            var eventName = task.eventName;

            needUpdateCache = true;     // 此次关闭软件，必须刷新缓存

            console.log(`type: ${eventName}`);

            if (eventName === 'image.removed') {
                if (!id) {
                    setTimeout(callback, 1);
                    return;
                }
                if (library.imagesMapping) {
                    delete library.imagesMapping[id];
                }
                if (lastModifiedTimeMappings) {
                    delete lastModifiedTimeMappings[id];
                }
                ipcRenderer.send('image.removed', id);
            }
            else {
                if (!image || !image.id) {
                    setTimeout(callback, 1);
                    return;
                }
                // 這裡造成 Mtime 異常
                // image.lastModified = Date.now();
                if (lastModifiedTimeMappings && image.lastModified) {
                    lastModifiedTimeMappings[image.id] = image.lastModified;
                }
                ipcRenderer.send(eventName, image);
                library.imagesMapping[image.id] = JSON.stringify(image) || json;
            }
        }
        catch (err) {
            ipcRenderer.send('electron-log', "" + err.stack || err);
        }
        return callback();
    };

    imageWatchUpdateQueue.drain = function () {
        if (imageWatchUpdateQueue.length() === 0) {
            // updateMTimeLogsWithTimeoutByMeta();
            // NOTE: 用户在修改任意文件20秒后，强制更新缓存，如果20秒内还有其他修改，则取消本次修改任务
            // 这样做可以有效避免软件缓存与实际文件不同步的问题，特别是 Windows 直接关机造成缓存没办法跟上问题
            clearTimeout(_drainWatchSaveCacheFileTimeout);
            _drainWatchSaveCacheFileTimeout = setTimeout(function () {
                ipcRenderer.send('electron-info', `[bg] auto-save start`);
                saveCacheFile(function () {}, true);
            }, 12000);
        }
    };

    trashQueue.drain = function () {
        clearTimeout(_drainTrashQueueTimeout);
        _drainTrashQueueTimeout = setTimeout(function () {
            if (trashQueue.length() === 0) {
                ColorAnalyzer.resume();
                imageMatadataQueue.resume();
                imagePaletteQueue.resume();
                updateMTimeLogsWithTimeoutByMeta();
                saveCacheFile(function () {});
            }
        }, 500);
    };

    function processQueueCallback (task, callback) {

        var hasCallback = false;
        var returnCallback = function (param1, param2) {
            try {
                if (!hasCallback) {
                    hasCallback = true;
                    if (!param2) {
                        callback(param1);
                    }
                    else {
                        callback(param1, param2);
                    }
                }
            }
            catch (err) {
                ipcRenderer.send('electron-log', "" + err.stack || err);
            }
        };

        try {
            // console.log("处理任务添加")
            // task.cancellationToken = task.cancellationToken || tokenSource.empty; 
            if (task.cancellationToken.isCancelled()) {
                return returnCallback({ msg: "User interrupt task" });
            }

            if (task.cancellationToken.isCancelled()) {
                try {
                    let dir = library.imagesDir + task.image.id + ".info/";
                    if (fs.existsSync(dir)) { fse.remove(dir); }
                } catch (err) {
                    console.error(err);
                }
                return returnCallback({ msg: "User interrupt task" });  
            }
        }
        catch (err) {
            ipcRenderer.send('electron-log', "" + err.stack || err);
            return returnCallback({ msg: "" + err.stack || err });
        }
        // console.time("圖片處理時間");

        processImage(task.image, function (errorObj, image) {

            var imageId = task.image.id;
            var dir = library.imagesDir + imageId + ".info/";

            if (task.cancellationToken.isCancelled()) {
                if (fs.existsSync(dir)) { fse.remove(dir); }
                return returnCallback({ msg: "User interrupt task" });  
            }

            // 删除自动导入图片
            var removeAutoImportFile = function () {
                if (task.image && task.image.path) {
                    var basename = path.basename(task.image.path)
                    if (AutoImport.lock[basename]) {
                        setTimeout(function () {
                            fs.unlink(task.image.path, function () { });
                        }, 50);
                        delete AutoImport.lock[basename];
                    }
                }
            };

            if (errorObj) {
                const errorMessage = errorObj?.msg || errorObj.err?.message;

                // 如果無法產生縮圖，嘗試使用 icon 模式添加
                if (image && image.ext && fs.existsSync(path.resolve(dir + image.name + "." + image.ext))) {
                    image.noPreview = true;
                    onImagesChange([image], true);
                    ipcRenderer.send('file-uploaded-end', image);
                    ipcRenderer.send('electron-info', `[bg] >> add with icon-only mode`);
                    // 删除自动导入图片
                    removeAutoImportFile();
                    return returnCallback(undefined, image);
                }
                else {
                    ipcRenderer.send('electron-log', errorMessage);
                    if (fs.existsSync(dir)) {
                        fse.removeSync(dir);
                    }
                    var errorItem = {
                        type: "ADD_ERROR",
                        reason: errorMessage,
                        object: task.image
                    };
                    ipcRenderer.send('image-processing-error', errorItem);
                    ipcRenderer.send('file-uploaded-end', {});
                    return returnCallback();
                }
            }
            // 沒有錯誤，回傳結果
            else {
                ipcRenderer.send('electron-info', `[bg] >> Done`);
                // 删除自动导入图片
                removeAutoImportFile();
                return returnCallback(image);
            }
        }, task.cancellationToken);
    };

    processQueue = async.queue(async.timeout(processQueueCallback, 300000), 4);
}

initAllQueue();

// 添加至處理對列
function addToProcessQueue (image, unshift) {

    if (!image) return;

    // console.log("開始處理");
    var source = tokenSource();

    taskTokens.push(source);
    image.name = image.name || image.id;

    // 圖片下載完成，立即丟進添加流程
    if (!unshift) {
        processQueue.push({
            image: image,
            cancellationToken: source.token
        }, function (processedImage) {

        })
    }
    else {
        processQueue.unshift({
            image: image,
            cancellationToken: source.token
        }, function (processedImage) {

        })
    }
}

async function copyProcessFile (params) {
    return new Promise((resolve, reject) => {
        var cutMode = params.cutMode;
        var file = params.file;
        var filePath = params.filePath;
        var rawPath = params.rawPath;

        if (cutMode) {
            safeCopy.async(filePath, rawPath, undefined, function (err) {
                if (err) {
                    return reject(err);
                }
                setTimeout(function () {
                    fs.unlink(filePath, function () { });
                }, 50);
                file.path = rawPath;
                return resolve();
            });
        }
        else {
            fs.copyFile(file.path, rawPath, function (err) {
                ACCESS.safeAccessSync(rawPath)
                if (err) {
                    if (err && err.code && err.code === "ENOSPC") { 
                        return reject(err);
                    }
                    try {
                        safeCopy.sync(file.path, rawPath, undefined);
                        fs.stat(file.path, function (err, stat) {
                            if (stat) {
                                fs.utimes(rawPath, stat.atime, stat.mtime, (err) => {});
                            }
                        });
                        return resolve();
                    }
                    catch (err) {
                        return reject(err);
                    }
                }
                else {
                    try {
                        fs.stat(file.path, function (err, stat) {
                            if (stat) {
                                fs.utimes(rawPath, stat.atime, stat.mtime, (err) => {});
                            }
                        });
                    }
                    catch (err) {
                        console.error(err);
                    }
                    return resolve();
                }
            });
        }
    });
}

// ------------------------------------------------------------------
// 處理圖片，一律從檔案格式處理（過去版本會有各種模式，全部取消）
// ------------------------------------------------------------------
async function processImage (file, callback, cancellationToken) {
    try {
        var thumbnailSize = 480;
        var filePath = file.path;
        var id = file.id;
        var dir = library.imagesDir + id + ".info/";
        var name, rawPath, width, height, thumbnailPath;
        var originPath = file.path;
        var item;
        var hasCallback = false;
        var returnCallback = function (param1, param2) {
            try {

                if (cancellationToken.isCancelled()) {
                    if (fs.existsSync(dir)) { fse.remove(dir);}
                }

                if (!hasCallback) {
                    hasCallback = true;
                    if (!param2) {
                        callback(param1, item);
                    }
                    else {
                        callback(param1, param2 || item);
                    }
                }
            }
            catch (err) {
                ipcRenderer.send('electron-log', "" + err.stack || err);
            }
        }

        // console.time("processImage-preprocess-屬性預處理");
        // 如果任務已經取消，就完成任務並關閉
        cancellationToken = cancellationToken || tokenSource.empty;
        if (cancellationToken.isCancelled()) { returnCallback({ err: new Error(`User interrupt task`), path: filePath }); return; }

        // 需要一個變數，用來判斷圖片需要移動或複製
        var ext = file.ext;
        var cutMode;

        if (file && file.path) {
            cutMode = (file.path.indexOf(USER_DATA_PATH) !== -1);
        }

        if (file.cutMode) {
            cutMode = true;
        }

        if (file.path) {
            var stat = await fs.promises.stat(file.path);
            file.size = stat.size;
            file.btime = parseInt(stat.birthtimeMs);
            file.mtime = parseInt(stat.mtimeMs);
        }

        // 啟動計時器 超過 300s 仍沒有處理成功就當作失敗
        var timerDuration = 500000;
        if (file.size && file.size >= 1000000000) {
            // 每多 1GB 多等 100s
            timerDuration = Math.round(file.size / 1000000000) * 200000 + timerDuration;
        }
        var timer = setTimeout(function () {
            return returnCallback({ err: new Error(`File processing timeout`) });
        }, timerDuration);

        if (!ext) {
            ext = getExt(file);
            file.ext = ext;
        }
        if (!ext) {
            return returnCallback({ err: new Error("File format is not recognized"), path: filePath });
        }

        if (file.size === 0 && file.ext !== 'txt') {
            return returnCallback({ err: new Error("Invalid File Detected. The file is 0kb and cannot be processed. "), path: filePath });
        }

        file.name = sanitize(file.name.replace("." + ext, "")).trim();
        file.name = file.name.substr(0, remainingFilenameLength(library.rootDir));
        file.name = unrom.nfc(file.name);

        // 避免文件名称是空格键
        if (file.name === "") {
            file.name = "_";
        }

        // console.time("processImage-preprocess-處理文件複製");
        rawPath = path.resolve(dir + file.name + "." + ext);
        thumbnailPath = path.resolve(dir + file.name + "_thumbnail.png");
        // fs.mkdirSync(dir, 0755);
        await fs.promises.mkdir(dir, 0755);

        item = {
            id: id,
            name: file.name,
            size: file.size,
            btime: file.btime,
            mtime: file.mtime,
            ext: ext,
            tags: Array.from(file.tags || []),
            folders: file.folders,
            isDeleted: file.isDeleted || false,
            url: file.url || "",
            annotation: file.annotation || "",
            modificationTime: file.modificationTime || Date.now(),
            star: file.star || undefined
        };

        // 只有網路下載的圖片才能控制 modificationTime
        if ( (file.src || file.merged) && file.modificationTime) {
            item.modificationTime = file.modificationTime;
        }

        if (file.star) {
            item.star = file.star;
        }

        // 导入图片时，自动将 IPTC 关键字做为图片标签
        if (preferences.general.IPTC === "true" && item.ext === "jpg") {
            try {
				const iptc = require(appRoot + '/my_modules/iptc')
                var data = fs.readFileSync(file.path);
                var iptc_data = iptc(data);
                if (iptc_data && iptc_data.keywords) {
                    if (iptc_data.keywords && iptc_data.keywords.forEach) {
                        iptc_data.keywords.forEach(function (tag) {
                            if (tag && tag.length <= 200) {
                                // 根據分號分割
                                const tags = tag.split(";");
                                item.tags = item.tags.concat(tags);
                            }
                        });
                    }
                    item.tags = [...new Set(item.tags)];
                }
            }
            catch (err) {
                ipcRenderer.send('electron-log', "" + err.stack || err);
            }
        }

        // 將原始檔案搬移進入資源庫路徑
        ipcRenderer.send('electron-info', `[bg] Add [${item.name}.${item.ext}](${item.id})`);
		importItemDateMap[item.id] = Date.now();

        try {
            await copyProcessFile({
                cutMode: cutMode,
                file: file,
                filePath: filePath,
                rawPath: rawPath
            });

            if (cancellationToken.isCancelled()) {
                if (fs.existsSync(dir)) { fse.remove(dir); }
                return returnCallback({ err: new Error("User interrupt task"), path: filePath });
            }
            try {
                item = await ThumbGenerator.generate({
                    src: rawPath,
                    dest: thumbnailPath,
                    item: item,
                    file: file,
                    thumbnailSize: thumbnailSize,
                    startAt: item.startAt ?? item.thumbnailAt
                });
				delete item.noPreview;
                item.processingPalette = true;
				if (item.noThumbnail && !item.removeThumbnail) {
					ColorAnalyzer.addTask(item, thumbnailSize, rawPath);
				}
				else {
					ColorAnalyzer.addTask(item, thumbnailSize, thumbnailPath);
				}
                ColorAnalyzer.pause();
                onImagesChange([item], true);
                returnCallback(undefined, item);
                ipcRenderer.send('file-uploaded-end', item);
            }
            catch (err) {
                clearTimeout(timer);
				// 無法添加文件一律使用 icon 模式添加
				item.noPreview = true;
				onImagesChange([item], true);
				returnCallback(undefined, item);

				ipcRenderer.send('file-uploaded-end', item);
				ipcRenderer.send('electron-log', err?.stack || err);
            }
            finally {
                clearTimeout(timer);
            }
        } catch (err) {
            ipcRenderer.send('electron-log', "" + err.stack || err);
            let msg = (err && err.message) || "File read-only";
            return returnCallback({ err: new Error(msg), path: filePath });
        }
    }
    catch (err) {
        ipcRenderer.send('electron-log', "" + err.stack || err);
        var msg = "" + err.stack;
        try {
            if (!msg) msg = err;
            if (msg && msg.indexOf && msg.indexOf("ENOSPC") > -1) { msg = i18n.__("error.ENOSPC"); }
        } catch (err) {}
        return returnCallback({ err: err, msg: msg, path: filePath });
    }
}

// 在 Finder 查看文件（支持多选）
function revealFilesInFinder (paths) {
	ipcRenderer.send('show-item-in-folder', paths[0]);
	return;
};

// 在 Explorer 查看文件（支持多选）
function revealFilesInExplorer (paths) {

    // 如果操作系统不支持 nodobjc
    if (!EdgeJS.RevealFilesInExplorer) {
        ipcRenderer.send('show-item-in-folder', paths[0]);
        return;
    }

    for (var i = 0; i < paths.length; i++) {
        paths[i] = path.normalize(paths[i]);
    }

    EdgeJS.RevealFilesInExplorer(paths);
};

// ----------------------------------------
// 建立不重複 ID
// ----------------------------------------
function guid() {
    return (Date.now().toString(36) + Math.random().toString(36).substr(2, 5)).toUpperCase();
}

// ----------------------------------------
// 刪除資料夾
// ----------------------------------------
var rmdir = function(dir) {
    var list = fs.readdirSync(dir);
    for (var i = 0; i < list.length; i++) {
        var filename = path.join(dir, list[i]);
        var stat = fs.statSync(filename);

        if (filename == "." || filename == "..") {
            // pass these files
        } else if (stat.isDirectory()) {
            // rmdir recursively
            rmdir(filename);
        } else {
            // rm fiilename
            // fs.unlinkSync(filename);
            fse.removeSync(filename);
        }
    }
    fs.rmdirSync(dir);
};

const junk = require(appRoot + '/my_modules/junk');
var walk = function(dir) {
    var results = []
    var list = fs.readdirSync(dir);
    list.forEach(function(file) {
        var filepath = dir + '/' + file;
        var stat = fs.statSync(filepath)
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(filepath))
        }
        else {
            if (!junk.is(file)) {
                results.push(filepath)
            }
        }
    })
    return results;
}

// path should have trailing slash
function removeDirAllFiles(dir) {
    if (!dir) return;
    fs.readdir(dir, function(err, files) {
        if (err) return;
        files.forEach(function (file) {
            fs.unlink(path.join(dir, file), function(err) {
                if (err) {
                    // console.log(err.toString());
                }
            });
        });
    });
}

function hashFnv32a(str, asString, seed) {
    /*jshint bitwise:false */
    var i, l,
        hval = (seed === undefined) ? 0x811c9dc5 : seed;

    for (i = 0, l = str.length; i < l; i++) {
        hval ^= str.charCodeAt(i);
        hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
    }
    if ( asString ){
        // Convert to 8 digit hex string
        return ("0000000" + (hval >>> 0).toString(16)).substr(-8);
    }
    return hval >>> 0;
}

console.timeEnd("[background] init");

ipcRenderer.send('electron-info', "[bg] Start init library...");

initBridge();
initLibrary();