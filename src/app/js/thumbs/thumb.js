const appRoot = require('app-root-path');
const compress = require(appRoot.path + '/app/js/utils/compress.js');
const MODULE_PATH = appRoot.path + '/app/js/thumbs';
const executeJavaScriptInIsolatedWorld = require(appRoot.path + '/app/js/utils/executeJavaScriptInIsolatedWorld.js');
const ThumbSize = {
	'3mf': 480,
	'3ds': 480,
	'dae': 480,
	'ifc': 480,
	'ply': 480,
	'stl': 480,
    'fbx': 480,
    'obj': 480,
	'glb': 480,

	'icns': 512,
	'ico': 512,
    'xmind': 480,
	'mindnode': 480,
	'pdf': 480,

	'xd': 480,
	'ai': 480,
	'indd': 480,
	'indt': 480,
	'idml': 480,
	'af': 480,
	'afpub': 480,
	'afphoto': 480,
	'afdesign': 480,
	'sketch': 480,
	'graffle': 480,
	'fig': 480,

	'eps': 480,
	'hdr': 480,
	'exr': 480,
	'dds': 480,

	'doc': 480,
	'docx': 480,
	'xls': 480,
	'xlsx': 480,
	'ppt': 480,
	'pptx': 480,
	'potx': 480,
	'key': 480,
	'numbers': 480,
	'pages': 480,

	'cr3': 480,
};

function init (fileName) {
    return require(`${MODULE_PATH}/${fileName}`);
}

// 為插件建立專屬的隔離執行環境
function initPluginScript (filePath, showDevTools, plugin) {
	return async (options)  => {
		return new Promise(async (resolve, reject) => {
			options.filePath = filePath;
			options.showDevTools = showDevTools;
			options.plugin = plugin;
			const extraModule = require(appRoot + '/app/js/plugin/extra-module.js');
			options.extraModule = {
				ffmpeg: {
					isInstalled: extraModule.ffmpeg.isInstalled(),
					paths: extraModule.ffmpeg.getPaths(),
				}
			};
			try {
				if (fs.existsSync(options.filePath)) {
					let item = await executeJavaScriptInIsolatedWorld(options);
					resolve(item);
				}
				else {
					reject(new Error(`Thumbnail plugin not found: ${options.filePath}`));
				}
			}
			catch (err) {
				ipcRenderer.send('electron-log', `Thumbnail plugin execute fail.`);
				ipcRenderer.send('electron-log', "" + err.stack || err);
				reject(err);
			}
		});
	}
}

const Thumb = {

	default: {
		// 連結
		'url': init('url.js'),
		'mhtml': init('mhtml.js'),
		'html': init('mhtml.js'),

		// 圖像
		'gif': init('gif.js'),
		'bmp': init('bmp.js'),
		'png': init('png.js'),
		'avif': init('avif.js'),
		'jpg': init('jpg.js'),
		'jpeg': init('jpg.js'),
		'jfif': init('jpg.js'),
		'jpe': init('jpg.js'),
		'jxl': init('jxl.js'),
		'insp': init('jpg.js'),
		'svg': init('svg.js'),
		'tga': init('tga.js'),
		'webp': init('webp.js'),
		'heic': init('heic.js'),
		'heif': init('heic.js'),
		'hif': init('heic.js'),
		'ico': init('ico.js'),
		'icns': init('icns.js'),
		'dds': init('native.js'),
		'tif': init('tiff.js'),
		'tiff': init('tiff.js'),
		'exr': init('exr.js'),
		'hdr': init('hdr.js'),
		'eps': init('eps.js'),

		// 視頻 — 由 EagleConfig.VIDEO_FORMATS 動態註冊
		// 音頻 — 由 EagleConfig.AUDIO_FORMATS 動態註冊

		// Office
		'doc': init('word.js'),
		'docx': init('word.js'),
		'xls': init('excel.js'),
		'xlsx': init('excel.js'),
		'ppt': init('powerpoint.js'),
		'pptx': init('powerpoint.js'),
		'potx': init('powerpoint.js'),
		'key': init('iwork.js'),
		'numbers': init('iwork.js'),
		'pages': init('iwork.js'),

		'txt': init('txt.js'),
		'pdf': init('pdf.js'),

		// 設計文件
		'ai': init('ai.js'),
		'psb': init('psd.js'),
		'psdt': init('psd.js'),
		'psd': init('psd.js'),
		'xd': init('xd.js'),
		'indd': init('indesign.js'),
		'indt': init('indesign.js'),
		'idml': init('indesign.js'),

		'xmind': init('xmind.js'),
		'eddx': init('edraw.js'),
		'emmx': init('edraw.js'),

		'c4d': init('native.js'),
		'blend': init('native.js'),

		'cdr': init('native.js'),
		'clip': init('native.js'),

		'af': init('native.js'),
		'afdesign': init('native.js'),
		'afpub': init('native.js'),
		'afphoto': init('native.js'),

		'skp': init('native.js'),
		'dwg': init('native.js'),

		'fig': init('quicklook.js'),
		'mindnode': init('quicklook.js'),
		'graffle': init('quicklook.js'),
		'pxd': init('quicklook.js'),
		'sketch': init('qlmanage.js'),

		// 字體
		'otc': init('font.js'),
		'ttc': init('font.js'),
		'ttf': init('font.js'),
		'otf': init('font.js'),
		'woff': init('font.js'),
		'woff2': init('font.js'),

		// RAW
		'3fr': init('raw.js'),
		'arw': init('raw.js'),
		'orf': init('raw.js'),
		'mrw': init('raw.js'),
		'nef': init('raw.js'),
		'nrw': init('raw.js'),
		'raw': init('raw.js'),
		'cr2': init('raw.js'),
		'crw': init('raw.js'),
		'dng': init('raw.js'),
		'erf': init('raw.js'),
		'pef': init('raw.js'),
		'raf': init('raw.js'),
		'rw2': init('raw.js'),
		'sr2': init('raw.js'),
		'srw': init('raw.js'),
		'x3f': init('raw.js'),
		'cr3': init('raw.js'),

		// 3D — 由 EagleConfig.MODEL_FORMATS 動態註冊
	},

	plugins: {},

	initPlugin: (ext, filePath, thumbSize, plugin) => {
		try {
			let showDevTools = plugin?.manifest?.devTools === true;
			console.log(`${ext}: ${filePath}, showDevTools:${showDevTools}`);
			Thumb.plugins[ext] = initPluginScript(filePath, showDevTools, plugin);
			ThumbSize[ext] = thumbSize || ThumbSize[ext] || EagleConfig.THUMBNAIL_SIZE;
		}
		catch (err) {
			console.errer(err);
			ipcRenderer.send('electron-log', `Init thumb plugin faile: ${filePath}`);
			ipcRenderer.send('electron-log', "" + err.stack || err);
		}
	},

    generate: (options) => {
        return new Promise(async (resolve, reject) => {

            let { item, src, dest } = options;
            let ext = item.ext;
            let maxSize = ThumbSize[ext] || EagleConfig.THUMBNAIL_SIZE;

            try {

				var timer = setTimeout(function () {
					ipcRenderer.send('electron-log', 'Thumbnail generate timeout.');
					return reject(new Error("Thumbnail generate timeout."));
				}, 100000);

				// * 優先使用插件，若插件異常，使用預設
				if (Thumb.plugins[ext]) {
					try {
						item = await Thumb.plugins[ext](options);
						
						// 如果 item 没有提供 width / height，默认使用正方形
						if (!item.width || !item.height) {
							const imageSize = require(appRoot.path + '/app/js/utils/imageSize.js');
							const size = await imageSize.async(dest);
							item.height = size?.height || item.height || EagleConfig.THUMBNAIL_SIZE;
							item.width = size?.width || item.width || EagleConfig.THUMBNAIL_SIZE;
						}
					}
					catch (err) {
						ipcRenderer.send('electron-log', "" + err.stack || err);
						if (Thumb.default[ext]) {
							item = await Thumb.default[ext](options);
						}
						else {
							clearTimeout(timer);
							return reject();
						}
					}
				}
                else if (Thumb.default[ext] && EagleConfig.SUPPORT_FORMATS[ext] ) {
                    item = await Thumb.default[ext](options);
                }
                else {
					clearTimeout(timer);
                    return reject();
                }

				if (item?.ext === 'txt') {
					clearTimeout(timer);
                	return resolve(item);
				}

				if (!item.noThumbnail) {
					try {
						await compress({
							start: dest,
							dest: dest,
							format: "image/webp",
							quality: 0.75,
							maxSize: maxSize
						});
						delete item.noPreview;
					}
					catch (err) {
						// 如果縮略圖無法壓縮，則不使用縮略圖
						ipcRenderer.send('electron-log', 'Thumbnail compress fail.');
						delete item.noThumbnail;
						item.noPreview = true;
						fs.unlink(dest, () => {});
						clearTimeout(timer);
						return reject(err);
					}
				}
				clearTimeout(timer);
                return resolve(item);
            }
            catch (err) {
				clearTimeout(timer);
                return reject(err || new Error("Not suport file."));
            }
        });
    }
};

// 動態註冊視頻、音頻、3D 模型格式縮圖（來源：config.js）
EagleConfig.VIDEO_FORMATS.forEach(function(ext) { Thumb.default[ext] = init('video.js'); });
EagleConfig.AUDIO_FORMATS.forEach(function(ext) { Thumb.default[ext] = init('audio.js'); });
EagleConfig.MODEL_FORMATS.forEach(function(ext) { Thumb.default[ext] = init('3d.js'); });

ipcRenderer.on('plugin.loaded', (event, params) => {

	pluginModule = { ...params } ;
	console.log(pluginModule);

	let thumbnailPath = pluginModule.previewExtension.thumbnailPath;
	for (const ext in thumbnailPath) {
		let size = pluginModule?.previewExtension?.thumbnailOptions && pluginModule?.previewExtension?.thumbnailOptions[ext] && pluginModule?.previewExtension?.thumbnailOptions[ext].size;
		Thumb.initPlugin(ext, thumbnailPath[ext], size, pluginModule?.previewExtension?.thumbnailPluginMap[ext], pluginModule?.previewExtension?.thumbnailPluginMap);
	}
});


module.exports = Thumb;