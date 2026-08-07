const appRoot = require('app-root-path');
const async = require('async');
const palette = require(appRoot + '/my_modules/image-palette');     // 15 ms 🙈
const ipcRenderer = require('electron').ipcRenderer;

const PALETTE_QUEUE_DELAY = {
    'HIGHT': 500,
    'MEDIUM': 20,
    'LOW': 5,
}

const ColorAnalyzer = {};

ColorAnalyzer.delay = PALETTE_QUEUE_DELAY.MEDIUM;
const DelayPreference = localStorage.getItem("PALETTE_QUEUE_DELAY");
if (DelayPreference && PALETTE_QUEUE_DELAY[DelayPreference]) {
    ColorAnalyzer.delay = PALETTE_QUEUE_DELAY[DelayPreference]
}

ColorAnalyzer.setDelay = (mode) => {
	if (PALETTE_QUEUE_DELAY[mode]) {
        ColorAnalyzer.delay = PALETTE_QUEUE_DELAY[mode];
        localStorage.setItem("PALETTE_QUEUE_DELAY", mode);
    }
};

ColorAnalyzer.queue = async.queue(async.timeout((task, callback) =>  {
	var hasCallback = false;
	if (canAnalytics(task.image, 480, task.thumbnailPath)) {
		try {
			// console.log("开始处理:" + task.thumbnailPath);
			var imagePath = path.normalize(library.imagesDir + task.image.id + ".info/metadata.json");
			if (forceQuit || !library.imagesMapping) {
				return callback(task.image);
			}
			if (!library.imagesMapping[task.image.id]) {
				return callback(task.image);
			}
			// if (!fs.existsSync(task.thumbnailPath)) { return callback(task.image); }
			palette(task.thumbnailPath, function(palettes) {
				try {
					if (!palettes) {
						if (task.image.hasOwnProperty("processingPalette")) {
							delete task.image.processingPalette;
							ipcRenderer.send('image.palette.updated', task.image);
							addToImagesPaletteQueue([task.image]);
						}
						if (!hasCallback) {
							hasCallback = true;
							callback(task.image);
						}
						return;
					}
					var current;
					if (!library.imagesMapping[task.image.id]) {
						console.log("图片已经删除，不需要分析：", imagePath);
						if (!hasCallback) {
							hasCallback = true;
							callback(task.image);
						}
						return;
					}
					else if (fs.existsSync(imagePath)) {
						try {
							if (library.imagesMapping[task.image.id]) {
								current = JSON.parse(library.imagesMapping[task.image.id]);
							}
							else {
								current = requireNoCache(imagePath);
							}
						}
						catch (err) {
							console.log(err);
							current = library.imagesMapping[task.image.id] || task.image;
						}
					}
					else {
						console.log("图片居然不存在：", imagePath);
						if (!hasCallback) {
							hasCallback = true;
							callback(task.image);
						}
						return;
					}
					current.palettes = palettes;
					current.modificationTime = task?.image?.modificationTime || current.modificationTime;
					
					if (current.hasOwnProperty("processingPalette")) {
						delete current.processingPalette;
					}
					// NOTE: 只有更新 palette 不需要更新所有图片信息
					ipcRenderer.send('image.palette.updated', current);
					addToImagesPaletteQueue([current]);

					// NOTE: 故意添加 delay，降低 CPU 使用率
					setTimeout(() => {
						if (!hasCallback) {
							hasCallback = true;
							callback(task.image);
						}
						return;
					}, ColorAnalyzer.delay);
				}
				catch (err) {
					ipcRenderer.send('electron-log', err.stack || err);
					if (!hasCallback) {
						hasCallback = true;
						callback(task.image);
					}
					return;
				}
			});
		}
		catch (err) {
			ipcRenderer.send('electron-log', err.stack || err);
			if (!hasCallback) {
				hasCallback = true;
				callback(task.image);
			}
			return;
		}
	}
	else {
		if (task.image.hasOwnProperty("processingPalette")) {
			delete task.image.processingPalette;
		}
		ipcRenderer.send('image.palette.updated', task.image);
		addToImagesPaletteQueue([task.image]);
		console.log(task.image);
		if (!hasCallback) {
			hasCallback = true;
			callback(undefined);
		}
		return;
	}
}, 30000), 3);

ColorAnalyzer.prepareQueue = async.queue((task, callback) => {
    let item = task.image;
    try {
		if (EagleConfig.SUPPORT_FORMATS[item.ext] || pluginModule?.previewExtension.thumbnailPluginMap[item.ext]) {
			item.processingPalette = true;
			delete item.palettes;
			let thumbnailPath;
			if (item.noThumbnail) {
				thumbnailPath = library.imagesDir + item.id + ".info/" + item.name + "." + item.ext;
			}
			else {
				thumbnailPath = library.imagesDir + item.id + ".info/" + item.name + "_thumbnail.png";
			}
			
			ColorAnalyzer.addTask(item, 480, thumbnailPath);
		}
        return callback();
    }
    catch (err) {
        callback();
        delete image.processingPalette;
        onImagesChange([image]);
        ipcRenderer.send('electron-log', err.stack || err);
    }
}, 1000);

ColorAnalyzer.run = palette;
ColorAnalyzer.addTask = (image, thumbnailSize, thumbnailPath) => {
    
	const IGNORE_TYPES = { mp3: true, wav: true, flac: true, ogg: true, aac: true, m4a: true };
    // if (!image.noThumbnail && !fs.existsSync(thumbnailPath)) return;
	// if (!image.noThumbnail) return;
    if (IGNORE_TYPES[image.ext]) return;

    ColorAnalyzer.queue.push({
        image: image,
        thumbnailSize: thumbnailSize,
        thumbnailPath: thumbnailPath,
    }, function (processedImage) {

        if (image.removeThumbnail) { 
            if (thumbnailPath.indexOf("_thumbnail.png") !== -1) {
                fse.removeSync(thumbnailPath); 
            }
        }

        if (processedImage && processedImage.code && processedImage.code === "ETIMEDOUT") {
            // console.log(`分析图片超时：${thumbnailPath}`);
            if (image.hasOwnProperty("processingPalette")) {
                delete image.processingPalette;
            }
            ipcRenderer.send('image.palette.updated', image);
            addToImagesPaletteQueue([image]);
            return;
        }

        if (!processedImage || processedImage.noThumbnail) {
            return;
        }
    });
};

ColorAnalyzer.addPrepareQueue = (items) => {

	const IGNORE_TYPES = { mp3: true, wav: true, flac: true, ogg: true, aac: true, m4a: true };
	if (!items) return;

	console.time("【图片分析】启动分析程序")

	const needAnalyzeItems = [];

	items.forEach((item) => {
		if (IGNORE_TYPES[item.ext]) return;
		if (item.hasOwnProperty("processingPalette")) {
			try {
				if (item.pure) {
					const json = library.imagesMapping[item.id];
					if (json) {
						item = JSON.parse(json);
					}
				}
				needAnalyzeItems.push(item);
			}
			catch (err) {
				console.log(err);
			}
		}
	});

    console.log("【图片分析】 %d 張圖片未分析", needAnalyzeItems.length);
    console.timeEnd("【图片分析】启动分析程序");

    if (needAnalyzeItems.length <= 0) {
		return ;
	}

	for (let i = 0; i < needAnalyzeItems.length; i++) {
		ColorAnalyzer.prepareQueue.push({
			image: needAnalyzeItems[i]
		});
	}
};

ColorAnalyzer.pause = () => {
	ColorAnalyzer.queue.pause();
};

ColorAnalyzer.resume = () => {
	ColorAnalyzer.queue.resume();
};

ColorAnalyzer.kill = () => {
	ColorAnalyzer.prepareQueue.kill();
	ColorAnalyzer.queue.kill();
};

function canAnalytics (item, thumbnailSize, thumbnailPath) {
    if (!item || !thumbnailSize) { return false; }
    try {
        let max = 30000000;
        let sum = 0;
        let ts = thumbnailSize;
        let newHeight = item.height / (item.width / ts);
        sum = newHeight * ts;
        return sum <= max;
    }
    catch (err) {}
}

ipcRenderer.on('check.image.palette', function (event, images) {
	ColorAnalyzer.addPrepareQueue(images);
});

ipcRenderer.on('change-palette-delay', function(event, mode) {
	ColorAnalyzer.setDelay(mode);
});

ipcRenderer.on('change-palette-pause', function(event) {
    ColorAnalyzer.pause();
});

ipcRenderer.on('change-palette-resume', function(event) {
    ColorAnalyzer.resume();
});

ipcRenderer.on('regenerate-palette', function(event, items) {
    if (!items || items.length <= 0) return;
	// 尝试修复 modifiedTime 一模一样的状况
	let modificationTimeMap = {};
    for (var i = items.length - 1; i >= 0; i--) {
		let file = items[i];
		delete file.palettes;
		file.processingPalette = true;
		if (!modificationTimeMap[file.modificationTime]) {
			modificationTimeMap[file.modificationTime] = file.modificationTime;
		}
		else {
			modificationTimeMap[file.modificationTime]++;
			file.modificationTime = modificationTimeMap[file.modificationTime];
			console.log(file.modificationTime);
		}
    }
	ColorAnalyzer.addPrepareQueue(items);
});

module.exports = ColorAnalyzer;